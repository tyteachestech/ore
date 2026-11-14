import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanAuthor, cleanDate, cleanTitle, refusal, wordCount } from "../src/ingest/check.ts";
import { addPageText, addSource, addTab, addText, audioOf, fillOwed, hasPageText, redoPageText, reimportSource, undoPageText } from "../src/ingest/index.ts";
import { addHighlight, readAnnotations } from "../src/annotations.ts";
import { cutText } from "../src/cut.ts";
import { findItem } from "../src/items.ts";
import { doctor } from "../src/doctor.ts";
import { frontTab } from "../src/ingest/tab.ts";
import { ocrMarkdown } from "../src/ingest/ocr.ts";
import { rtfToDoc } from "../src/ingest/rtf.ts";
import { xlsxToDoc } from "../src/ingest/sheets.ts";
import { pageAudio, transcribe, transcribeFile } from "../src/ingest/audio.ts";
import { absolutize, rewrite } from "../src/ingest/links.ts";
import { htmlToDoc, inlineMath } from "../src/ingest/web.ts";
import { chapterLines } from "../src/ai/recall.ts";
import { srtToVtt, vttToBody } from "../src/ingest/youtube.ts";
import { strToU8, zipSync } from "fflate";
import { tempLibrary } from "./helpers.ts";

// Import coverage (docs/reviews/2026-10-28-import-coverage.md): every content type Ore reads has a
// saved example here, and each must keep what a learner needs from it. Pages are real ones, saved
// with scripts and styles stripped; `bun run intake:live` re-checks the live sites. The repo is
// public, so a page that isn't openly licensed keeps its site's markup but not its words
// (fixtures/intake/rewrite-page.ts), which is why its phrases below read as nonsense.

const FIX = join(import.meta.dir, "fixtures/intake");
const web = (f: string) => readFileSync(join(FIX, "web", f), "utf8");
const file = (f: string) => join(FIX, "files", f);

// The desktop tests leave happy-dom's `window` and `getComputedStyle` on globalThis; Defuddle then
// reads the page as if in a browser and fails. The CLI (where intake runs) has neither, so these
// tests hide them while they run.
const g = globalThis as Record<string, unknown>;
const leaked = { window: g.window, getComputedStyle: g.getComputedStyle };
beforeAll(() => {
  delete g.window;
  delete g.getComputedStyle;
});
afterAll(() => {
  for (const [k, v] of Object.entries(leaked)) if (v) g[k] = v;
});

const realFetch = globalThis.fetch;
let unserved: string[] = [];
beforeEach(() => {
  unserved = [];
  // Refusals can catch a fetch error themselves; afterEach also checks that no live request was attempted.
  globalThis.fetch = (async (input: string | URL | Request): Promise<Response> => {
    const url = String(input instanceof Request ? input.url : input);
    unserved.push(url);
    throw new Error(`Unit tests must serve a local fixture: ${url}`);
  }) as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  expect(unserved).toEqual([]);
});
/** Serves saved pages by URL, with a content type; anything else is a 404. */
function serve(pages: Record<string, { body: BodyInit; type: string }>) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input);
    const p = pages[url];
    if (!p) return new Response("not found", { status: 404 });
    return new Response(p.body, { headers: { "content-type": p.type } });
  }) as typeof fetch;
}
const HTML = "text/html; charset=utf-8";

/** The saved images a body shows, in order. */
const images = (body: string) => [...body.matchAll(/!\[([^\]]*)\]\((assets\/[0-9a-f]{16}\.\w+)\)/g)].map((m) => ({ alt: m[1], path: m[2]! }));
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const words = (s: string) => s.split(/\s+/).filter((w) => /\w/.test(w)).length;

interface Case {
  name: string;
  url: string;
  fixture: string;
  type?: string;
  title: string;
  author?: string;
  published?: string;
  minWords: number;
  /** Phrases from the start, middle and end of the text. */
  has: string[];
  headings?: number;
  images?: number;
  code?: number;
  tables?: number;
  /** Paragraphs and links: a page laid out in tables keeps them (its text is no table cell). */
  paragraphs?: number;
  links?: number;
}

const PAGES: Case[] = [
  { name: "essay", url: "https://paulgraham.com/greatwork.html", fixture: "essay.html", title: "How to Do Great Work", minWords: 11000, has: ["If you research drill of elaboration", "But the note reading gap of forgetting concept", "for elaboration and for example writing"], paragraphs: 100, links: 20 },
  { name: "blog with diagrams and code", url: "https://lilianweng.github.io/posts/2023-06-23-agent/", fixture: "blog-images.html", title: "LLM Powered Autonomous Agents", author: "Lilian Weng", published: "2023-06-23T00:00:00Z", minWords: 6000, has: ["In a LLM-powered autonomous index reading", "In the FACT-Check interval", "Test model answer idea review and plan"], headings: 12, images: 13, code: 6 },
  { name: "docs with code (Python)", url: "https://docs.python.org/3/tutorial/classes.html", fixture: "docs-python.html", title: "9. Classes", minWords: 5000, has: ["Compared with other programming languages", "If the same attribute name occurs in", "Some simple generators can be coded succinctly"], headings: 15, code: 30 },
  { name: "docs with code (MDN)", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures", fixture: "docs-mdn.html", title: "Closures", published: "2025-11-04T07:08:26.000Z", minWords: 2500, has: ["closure", "One solution in this case is to", "However, redefining the prototype is not recommended."], headings: 6, code: 25 },
  { name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Spaced_repetition", fixture: "wikipedia.html", title: "Spaced repetition", author: "Wikipedia", published: "2001-08-09T02:05:34Z", minWords: 3500, has: ["Spaced repetition is", "In the Leitner system, correctly answered cards"], headings: 8, images: 3 },
  { name: "newsletter (Substack)", url: "https://www.astralcodexten.com/p/the-psychopolitics-of-trauma", fixture: "substack.html", title: "The Psychopolitics Of Trauma", author: "Scott Alexander", published: "2024-01-25T03:34:57+00:00", minWords: 5000, has: ["Research prompt teacher mind learn habit", "As chunk, this learn’t habit drill to", "But feedback of focus this deck step"], headings: 5, images: 3 },
  { name: "tutorial", url: "https://www.freecodecamp.org/news/git-and-github-for-beginners/", fixture: "tutorial.html", title: "Git and GitHub Tutorial – Version Control for Beginners", author: "Ihechikara Abba", published: "2021-11-05T18:25:06.000Z", minWords: 2500, has: ["Git and GitHub are two elaboration that", "Trace we \"plan\" and \"model\" our trace", "If you note exercise up to this"], headings: 15, images: 8, code: 3 },
  { name: "blog with two kinds of footnotes (Wait But Why)", url: "https://waitbutwhy.com/2015/01/artificial-intelligence-revolution-1.html", fixture: "footnotes-waitbutwhy.html", title: "The AI Revolution: The Road to Superintelligence", author: "Tim Urban", published: "2015-01-22T14:21:52+00:00", minWords: 7500, has: ["We gap a review CUE of this read", "Elaboration the mind", "That’s the learn of [Part 2 of this skill]"], headings: 8, images: 10 },
  { name: "course page: junk metadata is dropped", url: "https://www.coursera.org/learn/learning-how-to-learn", fixture: "coursera.html", title: "Learning How to Learn: Powerful mental tools to help you master tough subjects", minWords: 300, has: ["In this student, we’re mind to be"] },
];

describe("import coverage: web pages", () => {
  for (const c of PAGES)
    test(c.name, async () => {
      serve({ [c.url]: { body: web(c.fixture), type: HTML } });
      const item = await addSource(await tempLibrary(), c.url);
      expect(item.meta.type).toBe((c.type ?? "article") as typeof item.meta.type);
      expect(item.meta.title).toBe(c.title);
      expect(item.meta.author).toBe(c.author);
      expect(item.meta.published).toBe(c.published);
      expect(words(item.body)).toBeGreaterThanOrEqual(c.minWords);
      for (const p of c.has) expect(item.body).toContain(p);
      expect(count(item.body, /^#{1,6} /gm)).toBeGreaterThanOrEqual(c.headings ?? 0);
      expect(count(item.body, /!\[[^\]]*\]\(/g)).toBeGreaterThanOrEqual(c.images ?? 0);
      expect(count(item.body, /^```/gm) / 2).toBeGreaterThanOrEqual(c.code ?? 0);
      expect(count(item.body, /\n\s*\n/g)).toBeGreaterThanOrEqual(c.paragraphs ?? 0);
      expect(count(item.body, /\]\(/g)).toBeGreaterThanOrEqual(c.links ?? 0);
    });

  test("footnotes in a list the extractor doesn't know become Markdown footnotes, so their markers jump", async () => {
    const url = "https://waitbutwhy.com/2015/01/artificial-intelligence-revolution-1.html";
    serve({ [url]: { body: web("footnotes-waitbutwhy.html"), type: HTML } });
    const { body } = await addSource(await tempLibrary(), url);
    // Both lists, the "fun" notes and the sources, numbered as one series.
    expect(body).toMatch(/no one skill it AI reading\.”\[\^7\]/);
    expect(body).toMatch(/^\[\^7\]: Review, /m);
    expect(count(body, /^\[\^\d+\]: /gm)).toBe(15);
    expect(body).not.toContain("](#footnote");
  });

  test("other languages and scripts: Arabic (right to left), Russian, Japanese (no spaces between words)", async () => {
    const cases = [
      { url: "https://ar.wikipedia.org/wiki/تكرار_متباعد", fixture: "wikipedia-ar.html", title: "تكرار متباعد", has: ["**التكرار المتباعد**", "وعلى الرغم من أن هذا المبدأ مفيد"], headings: 0 },
      { url: "https://ru.wikipedia.org/wiki/Интервальные_повторения", fixture: "wikipedia-ru.html", title: "Интервальные повторения", has: ["В системе Лейтнера правильно ответившие карточки", "## Программы и сайты"], headings: 4 },
      { url: "https://ja.wikipedia.org/wiki/間隔反復", fixture: "wikipedia-ja.html", title: "間隔反復", has: ["ライトナーシステム は、正しく答えられたカード", "## ソフトウェア"], headings: 4 },
    ];
    for (const c of cases) {
      serve({ [c.url]: { body: web(c.fixture), type: HTML } });
      const item = await addSource(await tempLibrary(), c.url);
      expect(item.meta.title).toBe(c.title); // the site's name after a dash is not part of it
      for (const p of c.has) expect(item.body).toContain(p);
      expect(count(item.body, /^#{1,6} /gm)).toBeGreaterThanOrEqual(c.headings);
    }
    // Words in any script count, so a short page in Arabic or Japanese is not "almost no text".
    expect(wordCount("Это короткий текст")).toBe(3);
    expect(wordCount("هذا نص قصير")).toBe(3);
    expect(wordCount("間隔反復は記憶術")).toBe(8); // one per character where words have no spaces
    expect(refusal("تكرار", "هذا نص قصير ".repeat(30), "ar.wikipedia.org")).toBeNull();
  });

  test("arXiv abstract link reads the full paper from its HTML version", async () => {
    serve({ "https://arxiv.org/html/1706.03762": { body: web("arxiv-html.html"), type: HTML } });
    const item = await addSource(await tempLibrary(), "https://arxiv.org/abs/1706.03762");
    expect(item.meta.url).toBe("https://arxiv.org/abs/1706.03762");
    expect(item.meta.title).toBe("Attention Is All You Need");
    expect(item.meta.author).toBe("Ashish Vaswani et al."); // the paper's authors, not the site's
    expect(words(item.body)).toBeGreaterThan(5000);
    expect(item.body).toContain("Skill Card-Strength Attention");
    expect(item.body).toContain("\\sqrt{d_{k}}");
    expect(count(item.body, /^#{1,6} /gm)).toBeGreaterThanOrEqual(20);
    expect(count(item.body, /!\[[^\]]*\]\(https:\/\/arxiv\.org\/html\//g)).toBeGreaterThanOrEqual(2);
  });

  test("GitHub repo reads its README, relative images pointed at the repo", async () => {
    const readme = "# Demo\n\n![diagram](./docs/flow.png)\n\nSee [the guide](docs/guide.md) and [site](https://example.com).\n\n" + "Spacing beats cramming. ".repeat(30);
    serve({ "https://raw.githubusercontent.com/acme/demo/HEAD/README.md": { body: readme, type: "text/plain" } });
    const item = await addSource(await tempLibrary(), "https://github.com/acme/demo");
    expect(item.meta.type).toBe("markdown");
    expect(item.meta.title).toBe("Demo");
    expect(item.meta.author).toBe("acme");
    expect(item.body).toContain("![diagram](https://raw.githubusercontent.com/acme/demo/HEAD/docs/flow.png)");
    expect(item.body).toContain("[the guide](https://github.com/acme/demo/blob/HEAD/docs/guide.md)");
    expect(item.body).toContain("[site](https://example.com)");
  });

  test("GitHub file link reads the raw file (a real README)", async () => {
    const raw = "https://raw.githubusercontent.com/open-spaced-repetition/ts-fsrs/main/README.md";
    serve({ [raw]: { body: web("github-readme.md"), type: "text/plain; charset=utf-8" } });
    const item = await addSource(await tempLibrary(), "https://github.com/open-spaced-repetition/ts-fsrs/blob/main/README.md");
    expect(item.meta.title).toBe("ts-fsrs");
    expect(item.body).toContain("```");
    expect(count(item.body, /^#{1,6} /gm)).toBeGreaterThanOrEqual(5);
  });

  test("a forum thread (Hacker News): its title, poster and date, every comment under its author, replies nested", async () => {
    // hn-thread.html: a real thread's markup (2026), its words, names and links rewritten; HN no longer marks names with .hnuser.
    const url = "https://news.ycombinator.com/item?id=11408447";
    serve({ [url]: { body: web("hn-thread.html"), type: HTML } });
    const item = await addSource(await tempLibrary(), url);
    expect(item.meta).toMatchObject({ title: "Spaced repetition and practice", author: "spaced", published: "2016-04-01" });
    const b = item.body;
    expect(b).toStartWith("[https://example.com/srspractice/](https://example.com/srspractice/)\n\n---\n\n## Comments\n\n> **generation** · [2016-04-01](https://news.ycombinator.com/item?id=11408947)\n");
    expect(b).toContain("> > **feedback** · [2016-04-01](https://news.ycombinator.com/item?id=11409221)");
    expect(b).not.toContain("[deleted]");
    expect(count(b, /^(?:> )+\*\*/gm)).toBe(24); // every comment
  });

  test("a forum topic (Discourse): the first post as its text, then every reply under its author, quotes kept", async () => {
    // discourse-topic.html: a real topic's page (2026), its words and names rewritten; what search engines are served.
    const url = "https://meta.discourse.org/t/discourse-new-user-guide/96331";
    serve({ [url]: { body: web("discourse-topic.html"), type: HTML } });
    const item = await addSource(await tempLibrary(), url);
    expect(item.meta).toMatchObject({ title: "Understanding Discourse for new users", author: "Discourse", published: "2018-09-07T13:52:59+00:00" });
    const b = item.body;
    expect(b).toStartWith("> This model chunk the interleaving reading");
    expect(b).toContain("\n## Card Pause Mind by Discourse\n");
    expect(b).toContain("---\n\n## Comments\n\n> **Fact** · [2025-01-14](https://meta.discourse.org/t/understanding-discourse-for-new-users/96331/131)\n> \n> > Discourse:\n> > \n> > Generation at the spaced of the OP");
    expect(b).toContain("> **reading** · [2025-09-18](https://meta.discourse.org/t/understanding-discourse-for-new-users/96331/134)");
    expect(count(b, /^> \*\*/gm)).toBe(2); // every reply
    expect(b).toContain("> [![Knowledge_20250114_094145_Example](https://global.discourse-cdn.com/meta/optimized/4X/d/2/0/d202079c06ae53472d1dd6ac81330cd400643737_2_690x226.jpeg)]");
    expect(b).not.toContain("Likes");
  });

  test("a Discourse topic's corners: later pages, a page that won't load, link previews, dates, a link partway in", async () => {
    const post = (n: number, who: string, html: string) =>
      `<div class="topic-body crawler-post"><span itemprop="author"><span itemprop="name">${who}</span></span><time datetime="2025-01-0${n}T10:00:00Z"></time><span itemprop="position">${n}</span><div class="post" itemprop="text">${html}</div><span class="post-likes">3 Likes</span></div>`;
    const page = (posts: string, next?: number) =>
      `<html><head><meta name="generator" content="Discourse 2026.11.0"><meta property="og:title" content="Spacing questions"><link rel="canonical" href="https://forum.test/t/spacing/7">${next ? `<link rel="next" href="/t/spacing/7?page=${next}">` : ""}</head><body>${posts}</body></html>`;
    const first = post(1, "josé", `<p>${"How far apart should reviews be when the test is a month away? ".repeat(5)}</p>`);
    const preview = `<aside class="onebox" data-onebox-src="https://example.com/spacing"><header class="source">example.com</header><article class="onebox-body"><h3><a href="https://example.com/spacing">The spacing effect</a></h3><p>A summary.</p></article></aside>`;
    const when = `<span class="discourse-local-date" data-date="2025-01-09" data-email-preview="Thursday, January 9, 2025 10:00 AM UTC">2025-01-09T10:00:00Z</span>`;
    const quoted = `<aside class="quote" data-username="ada" data-topic="3"><div class="title"><img class="avatar" src="https://forum.test/a.png"> <a href="https://forum.test/t/other/3/2">ada:</a></div><blockquote><p>Space them out.</p></blockquote></aside>`;
    serve({
      "https://forum.test/t/spacing/7?page=2": { body: page(post(3, "lin", `<p>Read this: ${when}.</p>`), 3), type: HTML },
    });
    const b = (await htmlToDoc(page(first + post(2, "ada", quoted + preview)), "https://forum.test/t/spacing/7")).markdown;
    expect(b).toContain("> **ada** · [2025-01-02](https://forum.test/t/spacing/7/2)\n> \n> > [ada](https://forum.test/t/other/3/2):\n> > \n> > Space them out.\n> \n> [The spacing effect](https://example.com/spacing)");
    expect(b).not.toContain("page=2"); // no next page on the first one: nothing more to read
    const paged = (await htmlToDoc(page(first + post(2, "ada", "<p>Space them out.</p>"), 2), "https://forum.test/t/spacing/7"));
    expect(paged.author).toBe("josé");
    expect(paged.markdown).toContain("> **lin** · [2025-01-03](https://forum.test/t/spacing/7/3)\n> \n> Read this: Thursday, January 9, 2025 10:00 AM UTC.");
    // Page 3 won't load: the doc says where the rest are rather than ending as if whole.
    expect(paged.markdown).toEndWith("Later replies aren't here: [read them on the forum](https://forum.test/t/spacing/7?page=3)\n");
    expect(paged.markdown).not.toContain("Likes");
    await expect(htmlToDoc(page(post(21, "lin", `<p>${"A reply far down the topic. ".repeat(10)}</p>`)), "https://forum.test/t/spacing/7/21")).rejects.toThrow("Add the topic from its start instead: https://forum.test/t/spacing/7");
  });

  test("slides online (Speaker Deck): every slide's picture and words, in order, not the site's other decks", async () => {
    // speakerdeck.html: a real deck's page (2026), its words rewritten; the slides' words are in its transcript.
    const url = "https://speakerdeck.com/jennybc/how-to-name-files";
    const slides = "https://files.speakerdeck.com/presentations/5e4b07f0d9a94f8e9a29b902bad6ed0b";
    serve({ [url]: { body: web("speakerdeck.html"), type: HTML }, [`${slides}/slide_0.jpg`]: { body: new Uint8Array(400).fill(7), type: "image/jpeg" } });
    const item = await addSource(await tempLibrary(), url);
    expect(item.meta).toMatchObject({ title: "How to name files", author: "Jennifer (Jenny) Bryan", published: "2015-05-14" });
    const b = item.body;
    expect(b).toStartWith("Test-skill session recall index knowledge.");
    expect(b).toMatch(/\n<!-- slide 1 -->\n\n## Slide 1\n\n!\[Slide 1\]\(assets\/\w+\.jpg\)\n\nsense learn teacher by Jenny Bryan for Understanding Teacher Strength\n/);
    // A slide's words come in two parts on the page (its title link, then the rest): one paragraph here.
    expect(b).toContain(`![Slide 3](${slides}/slide_2.jpg)\n\nelaboration.level Idea’s Knowledge Deck Lesson and Forgetting.step chunk 1.mind ﬁg 2.gap`);
    expect(b).toContain("\n<!-- slide 27 -->\n");
    expect(count(b, /^## Slide \d+$/gm)).toBe(27);
    expect(b).not.toContain("More Decks");
    expect(b).not.toContain("Other Decks");
    // Served with no space between a slide's two parts, its words still don't run together.
    const page = web("speakerdeck.html");
    const tight = await htmlToDoc(page.replace(/<\/a>\s*<\/h3>\s*/g, "</a></h3>"), url);
    expect(tight.markdown).toContain("chunk 1.mind ﬁg 2.gap");
    // A talk without its slides' words is refused with how to get them, not saved as the site's other decks.
    await expect(htmlToDoc(page.replace(/<div class="slide-transcript">/g, '<div class="other">'), url)).rejects.toThrow("Download its PDF");
  });

  test("Wikipedia's formulas: the TeX its authors wrote, inline and on their own line", async () => {
    // wikipedia-math.html: "Forgetting curve" (CC BY-SA 4.0), whose formulas are MathML with their TeX in data-mw.
    const url = "https://en.wikipedia.org/wiki/Forgetting_curve";
    serve({ [url]: { body: web("wikipedia-math.html"), type: HTML } });
    const b = (await addSource(await tempLibrary(), url)).body;
    expect(b).toContain("\n$$\nb = \\frac{100k}{(\\log(t))^c +k}\n$$\n");
    expect(b).toContain("\n$$\nR = e^{-\\frac{t}{S}},\n$$\n");
    expect(b).toContain("Here, $$b$$ represents 'Savings'");
    expect(b).not.toContain("\\left(\\right.");
  });

  test("Wikipedia's formula corners: indented on its own, older pages, chemistry, a page of stories", async () => {
    const words = `<p>${"Words about memory and forgetting that fill out the page. ".repeat(10)}</p>`;
    const page = (body: string) => `<html><head><title>T</title></head><body><article><h1>T</h1>${words}${body}${words}</article></body></html>`;
    // An indented formula (`:<math>`) is all its line holds; an older page marks a display one inside it.
    const today = `<dl><dd><math class="mwe-math-element mwe-math-element-block" data-mw='{"name":"math","body":{"extsrc":"x^2"}}'><annotation encoding="application/x-tex">{\\displaystyle x^2}</annotation></math></dd></dl>`;
    const older = `<dl><dd><span class="mwe-math-element"><math display="block"><annotation encoding="application/x-tex">{\\displaystyle y^{3}}</annotation></math><img class="mwe-math-fallback-image-display" alt="{\\displaystyle y^{3}}"></span></dd></dl>`;
    // <chem>'s own data lacks its \ce{}; two groups side by side keep both braces.
    const chem = `<p>Water is <span class="mwe-math-element" data-mw='{"name":"chem","body":{"extsrc":"H2O"}}'><annotation encoding="application/x-tex">{\\displaystyle \\ce{H2O}}</annotation></span> here, and <span class="mwe-math-element"><annotation encoding="application/x-tex">{\\displaystyle a}{b}</annotation></span> is two groups.</p>`;
    const b = (await htmlToDoc(page(today + older + chem), "https://en.wikipedia.org/wiki/T")).markdown;
    expect(b).toContain("\n$$\nx^2\n$$\n");
    expect(b).toContain("\n$$\ny^{3}\n$$\n");
    expect(b).toContain("Water is $$\\ce{H2O}$$ here");
    expect(b).toContain("$${\\displaystyle a}{b}$$ is two groups");
    // Hacker News' front page has a poster on every row: the page has no one author.
    const stories = `<table><tr><td class="subline">by <a href="user?id=someone">someone</a></td></tr></table>`;
    expect((await htmlToDoc(page(stories), "https://news.ycombinator.com/news")).author).toBeUndefined();
  });

  test("nbviewer and Google links point at what to read", () => {
    expect(rewrite("https://nbviewer.org/github/jakevdp/PythonDataScienceHandbook/blob/master/notebooks/a.ipynb")).toMatchObject({ kind: "fetch", url: "https://raw.githubusercontent.com/jakevdp/PythonDataScienceHandbook/master/notebooks/a.ipynb" });
    expect(rewrite("https://docs.google.com/document/d/abc_123/edit?usp=sharing")).toEqual({ kind: "fetch", url: "https://docs.google.com/document/d/abc_123/export?format=docx" });
    expect(rewrite("https://docs.google.com/presentation/d/abc_123/edit#slide=id.p")).toEqual({ kind: "fetch", url: "https://docs.google.com/presentation/d/abc_123/export/pptx" });
    expect(rewrite("https://docs.google.com/spreadsheets/d/abc_123/edit#gid=0")).toEqual({ kind: "fetch", url: "https://docs.google.com/spreadsheets/d/abc_123/export?format=xlsx" });
    expect(rewrite("https://github.com/topics/learning")).toBeNull();
    expect(rewrite("https://example.com/a")).toBeNull();
    expect(absolutize("![a](img/x.png) [b](#top)", "https://raw.githubusercontent.com/o/r/main/README.md")).toBe("![a](https://raw.githubusercontent.com/o/r/main/img/x.png) [b](#top)");
  });
});

describe("import coverage: junk is refused with the next step", () => {
  test("a bot check is never saved as the page", async () => {
    const url = "https://www.khanacademy.org/science/biology/a/overview-of-transcription";
    serve({ [url]: { body: web("wall-khan.html"), type: HTML } });
    await expect(addSource(await tempLibrary(), url)).rejects.toThrow(/showed a bot check.*add it from the browser.*paste its text here/);
  });

  test("archive.today's CAPTCHA (HTTP 429) is a bot check; a real 429 says to wait", async () => {
    const status = (body: string, code: number) => (async () => new Response(body, { status: code, headers: { "content-type": "text/html" } })) as unknown as typeof fetch;
    globalThis.fetch = status(web("archive-captcha.html"), 429);
    await expect(addSource(await tempLibrary(), "https://archive.ph/AbCdE")).rejects.toThrow(/archive\.ph showed a bot check.*pass the check.*add it from the browser/);
    globalThis.fetch = status("Too Many Requests", 429);
    await expect(addSource(await tempLibrary(), "https://example.com/post")).rejects.toThrow(/too many requests right now \(HTTP 429\)\. Try again in a few minutes/);
  });

  test("a page built in the browser (Notion) says to paste it", async () => {
    const url = "https://www.notion.so/Help-8c11dd01c9d24ad4b27b31d6f19e1fd8";
    serve({ [url]: { body: web("wall-notion.html"), type: HTML } });
    await expect(addSource(await tempLibrary(), url)).rejects.toThrow(/add it from the browser/);
  });

  test("a near-empty page (a video site's shell) is refused", async () => {
    const url = "https://vimeo.com/channels/staffpicks";
    serve({ [url]: { body: web("wall-vimeo.html"), type: HTML } });
    await expect(addSource(await tempLibrary(), url)).rejects.toThrow(/almost no text/);
  });

  test("a podcast feed asks for one episode", async () => {
    const url = "https://feeds.megaphone.fm/hubermanlab";
    serve({ [url]: { body: web("feed.xml"), type: "text/xml; charset=utf-8" } });
    await expect(addSource(await tempLibrary(), url)).rejects.toThrow(/feed, not one episode/);
  });

  test("a video file link is refused before it downloads; an endless audio file stops at 200 MB", async () => {
    // Endless bodies: reading one whole would never finish.
    const endless = (type: string) => (async () => new Response(new ReadableStream({ pull: (c) => c.enqueue(new Uint8Array(1 << 20)) }), { headers: { "content-type": type } })) as unknown as typeof fetch;
    globalThis.fetch = endless("video/mp4");
    await expect(addSource(await tempLibrary(), "https://cdn.example.com/talk.mp4")).rejects.toThrow(/video file/);
    globalThis.fetch = endless("audio/mpeg");
    await expect(addSource(await tempLibrary(), "https://traffic.megaphone.fm/EP1.mp3")).rejects.toThrow(/over 200 MB/);
  });

  test("links Ore can't read yet say why at once, without network access (F108)", async () => {
    // Spotify reads its page before refusing it; this unit test must never contact the live site.
    serve({});
    const lib = await tempLibrary();
    await expect(addSource(lib, "https://x.com/karpathy/status/1617979122625712128")).rejects.toThrow(/X only shows posts to signed-in browsers/);
    await expect(addSource(lib, "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk")).rejects.toThrow(/Couldn’t read that Spotify episode’s page.*Apple Podcasts/);
    await expect(addSource(lib, "https://www.youtube.com/playlist?list=PLAqhIrjkxbuWI23v9cThsA9GvCAUhRvKZ")).rejects.toThrow(/playlist.*course/);
  });

  test("refusal keeps real short pages", () => {
    expect(refusal("Prompt engineering overview", "word ".repeat(240), "docs.claude.com")).toBeNull();
    expect(refusal("Client Challenge", "A required part of this site couldn’t load.", "x.org")).toMatch(/bot check/);
    expect(refusal("Account", "Log in to continue reading", "x.org")).toMatch(/signed-in/);
  });

  test("metadata a page gets wrong is left blank", () => {
    expect(cleanAuthor("the end, you’ll be able to")).toBeUndefined();
    expect(cleanAuthor("AK, AM, BH, CM, CD")).toBeUndefined();
    expect(cleanAuthor("Ashish Vaswani, Noam Shazeer")).toBe("Ashish Vaswani, Noam Shazeer");
    expect(cleanAuthor("Microsoft Office User")).toBeUndefined();
    expect(cleanAuthor("openpyxl")).toBeUndefined();
    expect(cleanTitle("Book1")).toBeUndefined();
    expect(cleanTitle("vocab.xlsx")).toBeUndefined();
    expect(cleanDate("2026-10-26, 2026-10-21, 2026-10-19")).toBeUndefined();
    expect(cleanDate("Elapsed00:00")).toBeUndefined();
    expect(cleanDate("1 month ago")).toBeUndefined();
    expect(cleanDate("October 28, 2026")).toBe("October 28, 2026");
    expect(cleanDate("2023-11-17")).toBe("2023-11-17");
  });
});

describe("import coverage: files", () => {
  test("Word: headings, lists, tables, title and author", async () => {
    const item = await addSource(await tempLibrary(), file("notes.docx"));
    expect(item.meta.type).toBe("article");
    expect(item.meta.title).toBe("Retrieval practice notes");
    expect(item.meta.author).toBe("Ada Learner");
    expect(item.body).toContain("# Retrieval practice");
    expect(item.body).toContain("## Spacing");
    expect(item.body).toMatch(/^-\s+Short gaps first$/m);
    expect(item.body).toContain("| Retrieval practice | 0.61 |");
    expect(item.body).toContain("Mix problem types");
  });

  test("Word: a never-titled file (Word's \"Document1\") is titled by its first heading", async () => {
    const item = await addSource(await tempLibrary(), file("document1.docx"));
    expect(item.meta.title).toBe("Retrieval practice");
    expect(item.meta.author).toBe("Ada Learner");
    // The same filter serves PDFs and EPUBs: a tool's or file's name is no title.
    for (const junk of ["Document1", "Untitled", "Untitled document", "Microsoft Word - draft.docx", "PowerPoint Presentation", "Presentation 2", "1706", "paper.pdf", "  "]) expect(cleanTitle(junk)).toBeUndefined();
    expect(cleanTitle("Untitled-1")).toBeUndefined();
    for (const real of ["Document design", "Microsoft Word 2019 Step by Step", "Untitled Goose Game: a postmortem"]) expect(cleanTitle(real)).toBe(real);
    expect(cleanTitle("1984", { numbers: true })).toBe("1984"); // a book's own title (EPUB)
    expect(cleanTitle(" Retrieval  practice ")).toBe("Retrieval practice");
  });

  test("PowerPoint: each slide's title, text and speaker notes, in order", async () => {
    const item = await addSource(await tempLibrary(), file("deck.pptx"));
    expect(item.meta.title).toBe("How memory works");
    expect(item.meta.author).toBeUndefined(); // "python-pptx" is the tool, not a person
    const slides = item.body.split(/<!-- slide \d+ -->/).filter((s) => s.trim());
    expect(slides.map((s) => s.match(/^## (.+)$/m)?.[1])).toEqual(["Encoding", "Storage", "Retrieval"]);
    expect(item.body).toContain("- Attention decides what gets in\n  - Sub point for Encoding");
    expect(item.body).toContain("> **Speaker notes:** Start with the cocktail party example.");
    expect(slides[1]).not.toContain("Speaker notes");
  });

  test("PDF: title from page 1 when the metadata has only a number, headings for the outline", async () => {
    const item = await addSource(await tempLibrary(), file("paper.pdf"));
    expect(item.meta.type).toBe("pdf");
    expect(item.meta.title).toBe("Retrieval practice");
    expect(item.body).toContain("<!-- page 1 -->");
    expect(item.body.match(/^#{2,3} .+$/gm)).toEqual(["### Retrieval practice", "### Spacing", "### Interleaving"]);
    expect(item.body).toContain("Testing yourself beats rereading");
  });

  test("PDF: a textbook page without its margin notes, running heads or page numbers", async () => {
    // Laid out like a dvips textbook (AIMA): blue glossary terms in the margin beside the line that
    // defines them, "2  Chapter 1  Learning" over each page, numbered headings barely larger than
    // the body, bullets and footnotes.
    const item = await addSource(await tempLibrary(), file("textbook.pdf"));
    expect(item.meta.title).toBe("Chapter 1: Learning"); // not "chap01.dvi"
    expect(item.body).toContain("because **memory** is so central"); // a bold term stays bold
    const b = item.body.replace(/\*\*/g, "");
    for (const said of ["because memory is so central", "The study of learning science tries", "practise retrieval, pulling", "The testing effect, found again", "This spacing effect is among", "called interleaving, helps"]) expect(b).toContain(said);
    for (const note of ["Memory", "Learning science", "Retrieval,", "Testing effect", "Free recall", "Cued recall", "Practice testing", "Spacing effect", "Interleaving"]) expect(b).not.toContain(note);
    expect(b).not.toContain("Chapter 1 Learning");
    expect(b).not.toContain("Section 1.1 Why Retrieval Works");
    expect(b).not.toMatch(/^\d$/m);
    expect(b.match(/^#{2,3} .+$/gm)).toEqual(["## LEARNING", "### 1.1 Why Retrieval Works", "### 1.1.1 Testing beats rereading", "### 1.1.2 Spacing out sessions"]);
    expect(b).toContain("A test can take many forms:\n\n- free recall to write down all you remember;\n\n- cued recall to answer from a prompt or a question;\n\n- practice testing to work through problems without the answers in view.\n\nEach one asks");
    expect(b).toContain("it does not.\n\n1 Ebbinghaus measured the curve on himself in the 1880s, with lists of nonsense syllables.\n\n2 A later replication");
  });

  test("PDF: its outline (bookmarks) makes the chapters, though the headings are set in the body's size", async () => {
    // outline.pdf (make-outline-pdf.py): three chapters of two pages, each named in the PDF outline.
    const it = await addSource(await tempLibrary(), file("outline.pdf"));
    expect(it.meta.title).toBe("Remembering on purpose");
    const b = it.body;
    expect(b.match(/^<!-- chapter \d+ -->$/gm)).toEqual(["<!-- chapter 1 -->", "<!-- chapter 2 -->", "<!-- chapter 3 -->"]);
    expect(b.match(/^## .+$/gm)).toEqual(["## Why memories fade", "## How retrieval rebuilds them", "## Spacing the practice"]);
    expect(b).toContain("<!-- page 3 -->\n\n<!-- chapter 2 -->\n\n## How retrieval rebuilds them\n\nEach "); // on the page it opens, the title line made the heading
    expect(b).not.toMatch(/^How retrieval rebuilds them$/m);
    const lines = chapterLines(readFileSync(it.docPath, "utf8"), 2)!;
    const text = readFileSync(it.docPath, "utf8").split("\n").slice(lines.from - 1, lines.to).join("\n");
    expect(text).toContain("## How retrieval rebuilds them");
    expect(text).not.toContain("## Spacing the practice");
  });

  test("PDF: a programming book's code keeps its lines and indents, typewriter words in a sentence are code (F65)", async () => {
    // code.pdf (make-code-pdf.py): set as LaTeX books are, prose in a serif face and code in a typewriter one.
    // It came in as prose: lines run together, indents gone, "# inside class Card:" a heading over the whole book.
    const b = (await addSource(await tempLibrary(), file("code.pdf"))).body;
    expect(b).toContain("and one short method moves it on:\n\n```\n# inside class Card:\ndef review(self, grade):\n    if grade < 3:\n        self.interval = 1\n    else:\n        self.interval *= 2\n\n    return self.interval\n```\n\nCall it from the prompt");
    expect(b).toContain("on its own line:\n\n```\n>>> card = Card()\n>>> card.review(4)\n2\n```\n\n");
    expect(b).toContain("The name `__init__` has two underscores on each side, and `interval *= 2` doubles the gap after every answer");
    expect(b).toContain("\n\n\\# starts a comment in Python, so"); // a sentence that starts with # is still a sentence
    expect(b.replace(/```[\s\S]*?```/g, "").match(/^#+ .*$/gm)).toEqual(["## Spacing in Code"]); // the only heading
  });

  test("PDF: footnotes, bold and italic, powers, hyphens at line and page ends, running heads written last", async () => {
    // Each line of hazards.pdf (make-hazards-pdf.py) is one hazard found reading 15 real PDFs (D121).
    const b = (await addSource(await tempLibrary(), file("hazards.pdf"))).body;
    expect(b).toContain("the mind as rational[^2] and as a habit"); // a footnote's raised "2" is its mark, not part of the word
    expect(b).toContain("how we **remember** what we read"); // bold and italic from the fonts' names
    expect(b).toContain("the other *misses*, which is why the *field keeps both* views in mind."); // one run across a line break
    expect(b).toContain("about 10¹¹ neurons and a signal crosses a synapse in 10⁻³ s, so a search costs O(n · d²) steps");
    expect(b).toContain("when they are fine-tuned again later"); // the document spells it with a hyphen elsewhere
    expect(b).toContain("the class of NP-complete problems");
    expect(b).toContain("a memory reviewed frequently is cheaper"); // the hyphen was never written into the text
    // A sentence that runs onto the next page is joined on the page it starts on, before its footnotes.
    expect(b).toContain("1950 article “Computing Machinery and Intelligence,” which asked whether machines can think.\n\n[^2]: We are not suggesting that people are irrational, only that habits matter as much as reasons do when we study.\n\n<!-- page 2 -->\n\nEach later chapter");
    expect(b.match(/How Memory Works/g)).toEqual(["How Memory Works"]); // the heading, not the running head
    expect(b).toContain("practice at once.\n\nA book starts a paragraph by indenting"); // a first line indented starts one
    expect(b).toContain("Experimental Psychology, translated by"); // a reference's second line, indented, doesn't
  });

  test("notebook: Markdown cells, code in its language, text output", async () => {
    const item = await addSource(await tempLibrary(), file("numpy.ipynb"));
    expect(item.meta.title).toBe("Introducing NumPy");
    expect(item.body).toContain("```python\nimport numpy as np\nnp.arange(3) * 2\n```");
    expect(item.body).toContain("```text\narray([0, 2, 4])\n```");
    expect(item.body).toContain("## Broadcasting");
  });

  test("notebook: a # comment in code is not the title; code holding ``` stays one block", async () => {
    const item = await addSource(await tempLibrary(), file("pandas-notes.ipynb"));
    expect(item.meta.title).toBe("pandas-notes");
    expect(item.body).toStartWith('````python\n# Load the survey\nimport pandas as pd\nfence = "```"\n````');
    expect(item.body).toContain("## Cleaning the columns\nRename first, then drop the empty ones.");
    expect(item.body).toEndWith("````text\n```md\n# Report\n```\n````\n");
  });

  test("subtitles: a timed transcript", async () => {
    const item = await addSource(await tempLibrary(), file("lecture.srt"));
    expect(item.meta.title).toBe("lecture");
    expect(item.body).toBe("[00:01] Welcome to the lecture on memory. Today we cover spacing and retrieval.\n\n[00:41] Now the forgetting curve.\n");
    expect(srtToVtt("1\n00:00:01,000 --> 00:00:02,500\nHi\n")).toBe("WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.500\nHi\n");
  });

  test("an unreadable file type says which ones work", async () => {
    const sketch = join(mkdtempSync(join(tmpdir(), "ore-sketch-")), "talk.sketch");
    writeFileSync(sketch, "x");
    await expect(addSource(await tempLibrary(), sketch)).rejects.toThrow(/can’t read “.sketch” files yet.*docx, pptx.*png/);
  });

  test("RTF from TextEdit: its heading, bold and italic, list, accents and dashes", async () => {
    const item = await addSource(await tempLibrary(), file("textedit.rtf"));
    expect(item.meta).toMatchObject({ type: "article", title: "Notes on retrieval practice" });
    const b = item.body;
    expect(b).toStartWith("### Notes on retrieval practice\n\nTesting yourself beats rereading. A café study group");
    expect(b).toContain("rereads its notes together — even when");
    expect(b).toContain("Three habits help, and the **first** matters most:\n\n- Space reviews out over days\n- Mix topics in one session\n- Explain each answer in your own words\n\n");
    expect(b).toEndWith("*Write the question before you read the answer.* Then check it the next day: that’s the retrieval that sticks.\n");
    expect(b).not.toMatch(/Helvetica|disc|\\/);
  });

  test("RTF from Word: title, author and date, outline headings, a table, a picture, a link, a footnote, Unicode, a numbered list, no header, comment or field codes", async () => {
    const item = await addSource(await tempLibrary(), file("word.rtf"));
    expect(item.meta).toMatchObject({ title: "Mixing topics in practice", author: "Ada Learner", published: "2025-03-04" });
    const b = item.body;
    expect(b).toStartWith("# Why mixing works\n\nPractising one kind of problem at a time");
    expect(b).toContain("**Interleaving** the kinds of problem beats blocking them.");
    expect(b).toContain("In Japanese the idea is 間隔反復 (spaced repetition), and its root word is 記憶.");
    expect(b).toContain("[The original study](https://example.edu/interleaving)[^1] is in the appendix.");
    expect(b).toContain("# A mixed week\n\n| **Day** | **Problems** |\n| --- | --- |\n| Monday | area, volume |\n| Tuesday | volume, angles |\n\nScores on the mixed test:");
    const pic = b.match(/!\[\]\((assets\/[0-9a-f]{16}\.png)\)/)?.[1];
    expect(readFileSync(join(item.dir, pic!)).subarray(1, 4).toString()).toBe("PNG");
    // Word writes a numbered item's marker before its paragraph, and a comment's own paragraph inside his.
    expect(b).toContain("1. Mix two kinds of problem.\n1. Add a third next week.\n\nKeep a log of each session so you see the spread.");
    expect(b).not.toContain("Ask about logs");
    expect(b).toEndWith("That's all for this week.\n\n[^1]: Rohrer and Taylor, 2007.\n");
    expect(b).not.toMatch(/Study guide, draft|HYPERLINK|Times New Roman|Normal;|wordml/);
    expect(readFileSync(join(item.dir, "source.rtf"), "utf8")).toStartWith("{\\rtf1");
  });

  test("RTF's awkward corners: fallbacks across line breaks, fonts' own code pages, numbered and nested lists, hidden text, Markdown's own characters", () => {
    const rtf = (s: string) => rtfToDoc(new TextEncoder().encode(`{\\rtf1\\ansi\\ansicpg1252{\\fonttbl{\\f0 Arial;}{\\f1\\fcharset134 SimSun;}}${s}}`)).body;
    // Word wraps its lines anywhere, even between a character and its fallback; a group's end ends the fallback.
    expect(rtf("A\\u38291\r\n\\'3fB {\\u8212}CD\\par")).toBe("A間B —CD\n");
    expect(rtf("\\f1 \\'c4\\'e3\\'ba\\'c3\\f0  ok\\par")).toBe("你好 ok\n");
    expect(rtf("\\pard\\ls1\\ilvl0{\\listtext 1.\\tab}First\\par\\pard\\ls1\\ilvl1{\\listtext a.\\tab}Inner\\par\\pard\\ls1\\ilvl0{\\listtext 2.\\tab}Second\\par")).toBe("1. First\n  1. Inner\n1. Second\n");
    expect(rtf("visible{\\v hidden} and {\\deleted gone}kept\\par")).toBe("visible and kept\n");
    // Word writes a numbered item's {\listtext} before the paragraph's own \pard, which used to make it a bullet.
    expect(rtf("{\\listtext 1.\\tab}\\pard\\ls1\\ilvl0 First\\par{\\listtext 2.\\tab}\\pard\\ls1\\ilvl0 Second\\par")).toBe("1. First\n1. Second\n");
    // A comment or a header is skipped, its paragraph and table marks too: they used to split his paragraph and end his heading.
    expect(rtf("\\pard\\outlinelevel0 Why mixing{\\*\\annotation \\pard\\plain Check this\\par} works\\par\\pard Body{\\header \\pard\\intbl Page\\cell\\row} text\\par")).toBe("# Why mixing works\n\nBody text\n");
    expect(rtf("\\pard Why{\\*\\annotation note\\\n more} works\\par")).toBe("Why works\n"); // an escaped line break is a \\par
    expect(rtf("{\\header \\pard\\plain {\\listtext 1.\\tab}Page 1\\par}\\pard Body text\\par")).toBe("Body text\n");
    // A list item that ends in a table cell leaves no marker for the paragraph after the table.
    expect(rtf("\\pard\\intbl\\ls1{\\listtext 1.\\tab}Item\\cell\\row\\pard Plain\\par")).toBe("| Item |\n| --- |\n\nPlain\n");
    expect(rtf("5*3 and 2*4 are [products]\\par - 5 degrees\\par {\\b bold}{\\b\\i both}{\\i it}\\par")).toBe("5\\*3 and 2\\*4 are \\[products\\]\n\n\\- 5 degrees\n\n**bold*both****it*\n");
  });

  test("Excel: each sheet a table under its name, dates as dates, percents as percents, formulas' values, its title and author", async () => {
    const item = await addSource(await tempLibrary(), file("vocab.xlsx"));
    expect(item.meta).toMatchObject({ type: "article", title: "Spanish vocabulary", author: "Ada Learner" });
    expect(item.body).toBe(
      [
        "## Spanish",
        "",
        "| Word | Meaning | Example | Added | Reviews | Right |",
        "| --- | --- | --- | --- | --- | --- |",
        '| cocinar | to cook | Sin sal, "cocinamos" mal. | 2025-03-04 | 3 | 75% |',
        "| hornear | to bake, to roast | Hornear es esperar \\| de verdad. | 2025-03-05 | 5 | 63% |",
        "| hervir | to boil |  | 2025-03-06 | 8 | 33.3% |",
        "",
        "## Grammar",
        "",
        "| Rule | Example |",
        "| --- | --- |",
        "| Ser for what something is | La sopa es rica. |",
        "| Estar for how it is now | Estoy cansado. |",
        "",
      ].join("\n"),
    );
    expect(existsSync(join(item.dir, "source.xlsx"))).toBe(true);
  });

  test("Excel's corners: the 1904 calendar, times and durations, prefixed XML, a table that starts at B2, empty formatted rows", async () => {
    const xml = (sheet: string, workbookPr = "") =>
      zipSync({
        "[Content_Types].xml": strToU8("<Types/>"),
        "_rels/.rels": strToU8('<Relationships><Relationship Id="r1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
        "xl/workbook.xml": strToU8(`<x:workbook xmlns:x="main" xmlns:r="rel">${workbookPr}<x:sheets><x:sheet name="Log" sheetId="1" r:id="rId1"/></x:sheets></x:workbook>`),
        "xl/_rels/workbook.xml.rels": strToU8('<Relationships><Relationship Id="rId1" Type=".../worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="strings.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
        "xl/strings.xml": strToU8("<x:sst><x:si><x:t>Day</x:t></x:si><x:si><x:t>Start</x:t></x:si><x:si><x:t>Studied</x:t></x:si></x:sst>"),
        "xl/styles.xml": strToU8('<x:styleSheet><x:numFmts><x:numFmt numFmtId="170" formatCode="[h]:mm"/><x:numFmt numFmtId="171" formatCode="0.0%"/></x:numFmts><x:cellXfs><x:xf numFmtId="0"/><x:xf numFmtId="14"/><x:xf numFmtId="20"/><x:xf numFmtId="170"/><x:xf numFmtId="9"/><x:xf numFmtId="10"/><x:xf numFmtId="171"/></x:cellXfs></x:styleSheet>'),
        "xl/worksheets/sheet1.xml": strToU8(`<x:worksheet><x:sheetData><x:row r="1" ht="20"/>${sheet}<x:row r="9" ht="20"/></x:sheetData></x:worksheet>`),
      });
    const rows = '<x:row r="2"><x:c r="B2" t="s"><x:v>0</x:v></x:c><x:c r="C2" t="s"><x:v>1</x:v></x:c><x:c r="D2" t="s"><x:v>2</x:v></x:c><x:c r="Z2" s="1"/></x:row><x:row r="3"><x:c r="B3" s="1"><x:v>43894</x:v></x:c><x:c r="C3" s="2"><x:v>0.5208333333</x:v></x:c><x:c r="D3" s="3"><x:v>1.5</x:v></x:c></x:row>';
    const table = "## Log\n\n| Day | Start | Studied |\n| --- | --- | --- |\n| ROW |\n";
    expect(xlsxToDoc(xml(rows)).body).toBe(table.replace("ROW", "2020-03-04 | 12:30 | 36:00"));
    // Older Mac Excel counts days from 1904.
    expect(xlsxToDoc(xml(rows, '<x:workbookPr date1904="1"/>')).body).toBe(table.replace("ROW", "2024-03-05 | 12:30 | 36:00"));
    // A cell says what the sheet shows: a percent as a percent, a sum without the float's last-digit noise.
    const shown = '<x:row r="2"><x:c r="B2" s="4"><x:v>0.25</x:v></x:c><x:c r="C2" s="5"><x:v>0.12345</x:v></x:c><x:c r="D2" s="6"><x:v>0.5</x:v></x:c><x:c r="E2"><x:v>0.30000000000000004</x:v></x:c><x:c r="F2"><x:v>12</x:v></x:c></x:row>';
    expect(xlsxToDoc(xml(shown)).body).toBe("## Log\n\n| 25% | 12.35% | 50.0% | 0.3 | 12 |\n| --- | --- | --- | --- | --- |\n");
    // Half rounds away from zero, as Excel does, though 0.145 × 100 is 14.499999999999998 in a double.
    const half = '<x:row r="2"><x:c r="B2" s="4"><x:v>0.145</x:v></x:c><x:c r="C2" s="6"><x:v>0.0115</x:v></x:c><x:c r="D2" s="4"><x:v>-0.145</x:v></x:c></x:row>';
    expect(xlsxToDoc(xml(half)).body).toBe("## Log\n\n| 15% | 1.2% | -15% |\n| --- | --- | --- |\n");
  });

  test("CSV and TSV: a table, quotes, commas and line breaks inside cells, Excel's semicolons", async () => {
    const d = mkdtempSync(join(tmpdir(), "ore-csv-"));
    // verbs.csv: a byte-order mark, Windows line ends, an empty first column, a space before a quote,
    // Markdown's own characters in a cell.
    const csv = await addSource(await tempLibrary(), file("verbs.csv"));
    expect(csv.meta.title).toBe("verbs");
    expect(csv.body).toBe('| word | meaning | note |\n| --- | --- | --- |\n| cocinar | to cook, prepare | irregular? no, regular |\n| hornear | to bake to roast | regular: "horneo" |\n| \\*soler\\* | to usually do | \\<always\\> \\[with\\] an infinitive |\n');
    writeFileSync(join(d, "es.csv"), "palabra;significado\ncocinar;to cook, prepare\n");
    expect((await addSource(await tempLibrary(), join(d, "es.csv"))).body).toBe("| palabra | significado |\n| --- | --- |\n| cocinar | to cook, prepare |\n");
    writeFileSync(join(d, "terms.tsv"), "term\tdefinition\nspacing\treviews spread over days\n");
    expect((await addSource(await tempLibrary(), join(d, "terms.tsv"))).body).toContain("| spacing | reviews spread over days |");
    writeFileSync(join(d, "empty.csv"), "\n\n");
    await expect(addSource(await tempLibrary(), join(d, "empty.csv"))).rejects.toThrow(/no rows/);
    // A dataset is not something to read, and half of one would be worse.
    writeFileSync(join(d, "data.csv"), "id,value\n" + "1,2\n".repeat(6000));
    await expect(addSource(await tempLibrary(), join(d, "data.csv"))).rejects.toThrow(/6,001 rows, too many to read/);
  });

  test("a damaged or empty RTF file says so", async () => {
    const d = mkdtempSync(join(tmpdir(), "ore-rtf-"));
    writeFileSync(join(d, "cut.rtf"), new Uint8Array(readFileSync(file("deck.pptx")).subarray(0, 300)));
    await expect(addSource(await tempLibrary(), join(d, "cut.rtf"))).rejects.toThrow(/That RTF file is damaged.*save it again/);
    writeFileSync(join(d, "empty.rtf"), "{\\rtf1\\ansi{\\fonttbl\\f0 Helvetica;}\\par}");
    await expect(addSource(await tempLibrary(), join(d, "empty.rtf"))).rejects.toThrow(/no text to read/);
  });

  test("Pages, Keynote, Kindle and old Word files say how to save a copy Ore reads", async () => {
    const d = mkdtempSync(join(tmpdir(), "ore-export-"));
    const lib = await tempLibrary();
    // Pages and Keynote save either one file or a package Finder shows as one (a folder underneath).
    writeFileSync(join(d, "essay.pages"), "x");
    mkdirSync(join(d, "talk.key"));
    for (const name of ["essay.pages", "talk.key"]) await expect(addSource(lib, join(d, name))).rejects.toThrow(/^Ore can’t read (Pages|Keynote) files\. Open it in \1 and choose File › Export To › (Word|PowerPoint), then add that file\.$/);
    writeFileSync(join(d, "grades.numbers"), "x");
    await expect(addSource(lib, join(d, "grades.numbers"))).rejects.toThrow(/Export To › Excel/);
    writeFileSync(join(d, "novel.mobi"), "x");
    await expect(addSource(lib, join(d, "novel.mobi"))).rejects.toThrow(/Kindle book.*EPUB/);
    writeFileSync(join(d, "old.doc"), "x");
    await expect(addSource(lib, join(d, "old.doc"))).rejects.toThrow(/older Word file.*Save As.*\.docx/);
  });
});

describe("import coverage: awkward files", () => {
  const dir = () => mkdtempSync(join(tmpdir(), "ore-awkward-"));
  const put = (name: string, bytes: string | Uint8Array) => {
    const f = join(dir(), name);
    writeFileSync(f, bytes);
    return f;
  };

  test("text in any encoding an editor saves: UTF-16 (Notepad), Windows-1252, a UTF-8 BOM, CRLF", async () => {
    const lib = await tempLibrary();
    const utf16 = new Uint8Array([0xff, 0xfe, ...[..."# Notepad note\n\nCafé au lait."].flatMap((c) => [c.charCodeAt(0), 0])]);
    expect((await addSource(lib, put("a.txt", utf16))).meta.title).toBe("Notepad note");
    const latin1 = await addSource(lib, put("b.txt", new Uint8Array([...Buffer.from("# Caf"), 0xe9, ...Buffer.from(" r"), 0xe9, ...Buffer.from("sum"), 0xe9, 0x0a])));
    expect(latin1.meta.title).toBe("Café résumé");
    expect((await addSource(lib, put("c.md", "\ufeff# With a BOM\n\nText."))).meta.title).toBe("With a BOM");
    const crlf = await addSource(lib, put("d.md", "# Windows\r\n\r\nLine one.\r\nLine two.\r\n"));
    expect(crlf.body).toBe("# Windows\n\nLine one.\nLine two.\n");
    expect((await doctor(lib)).warnings).toBe(0);
  });

  test("a text file with no extension is read; a binary one, a folder and a huge file say why not", async () => {
    const lib = await tempLibrary();
    expect((await addSource(lib, put("README", "# Read me\n\nPlain text with no extension."))).meta.title).toBe("Read me");
    await expect(addSource(lib, put("blob", new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 0, 1, 2, 3])))).rejects.toThrow(/can’t read/);
    await expect(addSource(lib, dir())).rejects.toThrow(/That’s a folder/);
    await expect(addSource(lib, "/nope/missing.pdf")).rejects.toThrow("There’s no file at /nope/missing.pdf. Check the path");
    await expect(addSource(lib, "example.com/post")).rejects.toThrow("add its full link: https://example.com/post");
    await expect(addSource(lib, "notes.md")).rejects.toThrow("Check the path");
  });

  test("the same file added twice is the source already here, filed under the new skill too", async () => {
    const lib = await tempLibrary();
    const f = put("notes.md", "# Same\n\nThe same text, dropped twice.");
    const first = await addSource(lib, f);
    const again = await addSource(lib, f, { skills: ["ai"] });
    expect(again.meta.id).toBe(first.meta.id);
    expect(again.kept).toBe(true);
    expect(again.meta.skills).toEqual(["ai"]);
  });

  test("a damaged or locked PDF says what to do", async () => {
    const lib = await tempLibrary();
    await expect(addSource(lib, put("cut.pdf", readFileSync(file("paper.pdf")).subarray(0, 900)))).rejects.toThrow(/isn’t a readable PDF.*Export as PDF/);
    await expect(addSource(lib, file("locked.pdf"))).rejects.toThrow(/locked with a password/);
  });

  test("a link that isn't the web, or is cut off, says so before anything is fetched", async () => {
    const lib = await tempLibrary();
    await expect(addSource(lib, "http://")).rejects.toThrow(/looks cut off/);
    await expect(addSource(lib, "ftp://example.com/file.txt")).rejects.toThrow(/web links \(http or https\)/);
  });

  test("a Markdown note's own frontmatter (Obsidian) fills title, author and date and is not read as text", async () => {
    const lib = await tempLibrary();
    const item = await addSource(lib, file("obsidian-note.md"));
    expect(item.meta).toMatchObject({ type: "markdown", title: "Retrieval practice: notes", author: "Ann Example", published: "2024-03-05" });
    expect(item.body.startsWith("# Notes on retrieval\n")).toBe(true);
    for (const p of ["Retrieval practice means pulling", "Each recall changes what is stored", "this line ends the note."]) expect(item.body).toContain(p);
    expect(count(item.body, /^#{1,6} /gm)).toBe(3);
    expect(count(item.body, /^```/gm)).toBe(2);
    expect(item.body).not.toContain("tags:");
    expect(readFileSync(join(item.dir, "source.md"), "utf8")).toBe(readFileSync(file("obsidian-note.md"), "utf8"));
    // The same note pasted (ore add --stdin) reads the same.
    const pasted = await addText(lib, readFileSync(file("obsidian-note.md"), "utf8"));
    expect(pasted.meta).toMatchObject({ title: "Retrieval practice: notes", author: "Ann Example", published: "2024-03-05" });
    expect(pasted.body.startsWith("# Notes on retrieval\n")).toBe(true);
    expect(pasted.body).not.toContain("tags:");
    // A file that opens with a rule and no mapping keeps all its text.
    const rule = await addSource(lib, put("rule.md", "---\n\nJust prose after a rule.\n\n---\n\nMore prose.\n"));
    expect(rule.body).toContain("Just prose after a rule.");
  });

  test("a pasted ChatGPT answer keeps its headings, tables, math, code and images", async () => {
    // What ⌘C on a ChatGPT answer puts on the clipboard as HTML (ore add --stdin --html).
    const png = readFileSync(file("screenshot.png"));
    serve({ "https://images.example.org/starter-rise.png": { body: png, type: "image/png" } });
    const lib = await tempLibrary();
    const paste = readFileSync(file("chatgpt-copy.html"), "utf8");
    const item = await addText(lib, paste, { html: true });
    expect(item.meta).toMatchObject({ type: "markdown", title: "How sourdough rises" });
    for (const p of ["opens with the main claim: a starter's wild yeast", "Yeast numbers grow along a curve", "bake when it has doubled."]) expect(item.body).toContain(p);
    expect(item.body.match(/^#{2,3} .+$/gm)).toEqual(["## What the starter does", "## Proof times that work", "### A feeding calculator"]);
    expect(item.body).toContain("| 26 °C | Four to five hours |");
    expect(item.body).toContain("$$\nN = N_0 e^{rt}\n$$");
    expect(item.body).toContain("population after $$t$$ hours");
    // The code reads as written: no "python" label or "Copy code" button glued to it.
    expect(item.body).toContain("```python\ndef feed(starter):\n");
    expect(item.body).not.toMatch(/Copy (code|table)/);
    // A citation pill is its source's link, without its "+1".
    expect(item.body).toContain("[example.org](https://example.org/sourdough-science)");
    const [rise] = images(item.body);
    expect(rise?.alt).toBe("A starter doubling in its jar over six hours");
    expect(readFileSync(join(item.dir, rise!.path))).toEqual(png);
    expect(item.body).toMatch(/\n\n!\[A starter doubling[^\n]*\)\n\n- \*\*Yeast/);
    // The paste is kept whole as the original, and a reimport reads it as it was pasted.
    expect(readFileSync(join(item.dir, "source.html"), "utf8")).toContain("Four to five hours</td>");
    expect((await reimportSource(lib, item.meta.id)).changed).toBe(false);
    // Pasted again (a retry), it is the source already here.
    expect((await addText(lib, paste, { html: true })).meta.id).toBe(item.meta.id);
    // A short paste keeps its table too, and an image with no address of its own is left out.
    const short = await addText(lib, "<h2>Proof</h2><p>Warm dough rises faster.</p><img src='/rel.png'><table><tr><th>At</th><th>Hours</th></tr><tr><td>26 °C</td><td>4</td></tr></table>", { html: true });
    expect(short.body).toBe("## Proof\n\nWarm dough rises faster.\n\n| At | Hours |\n| --- | --- |\n| 26 °C | 4 |\n");
  });

  test("pasted Markdown's images are saved beside it", async () => {
    const png = readFileSync(file("screenshot.png"));
    serve({ "https://images.example.org/curve.png": { body: png, type: "image/png" } });
    const item = await addText(await tempLibrary(), "# Spacing\n\nForgetting makes the next recall harder.\n\n![curve](https://images.example.org/curve.png)\n");
    const [curve] = images(item.body);
    expect(curve?.path).toMatch(/^assets\/[0-9a-f]{16}\.png$/);
    expect(readFileSync(join(item.dir, curve!.path))).toEqual(png);
  });

  test("Finder's own files are refused, not saved as a source", async () => {
    const lib = await tempLibrary();
    await expect(addSource(lib, put(".DS_Store", new Uint8Array([0, 0, 0, 1, 0x42, 0x75, 0x64, 0x31])))).rejects.toThrow(/Finder keeps for itself.*Add the file you meant/);
    await expect(addSource(lib, put("._notes.md", "x"))).rejects.toThrow(/Finder keeps for itself/);
    await expect(addSource(lib, put("blob", new Uint8Array([0x7f, 0x45, 0, 1])))).rejects.toThrow(/no extension and isn’t text/);
  });

  test("a # comment in fenced code is not the title", async () => {
    const lib = await tempLibrary();
    const code = "```sh\n# install it\nbrew install ore\n```\n\n";
    expect((await addSource(lib, put("setup.md", code + "Then run it.\n\n# Real title\n"))).meta.title).toBe("Real title");
    expect((await addSource(lib, put("bare.md", code + "Then run it.\n"))).meta.title).toBe("bare");
    expect((await addText(lib, "Setup notes\n\n" + code)).meta.title).toBe("Setup notes");
  });

  test("a title is one line", async () => {
    const lib = await tempLibrary();
    const item = await addSource(lib, put("t.html", "<title>Two\n   lines</title><article><h1>Two\n lines</h1><p>" + "Words to read in a paragraph. ".repeat(40) + "</p></article>"));
    expect(item.meta.title).toBe("Two lines");
  });
});

describe("import coverage: video", () => {
  const VTT = "WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nWelcome to the talk.\n\n00:00:05.000 --> 00:00:40.000\nFirst we tokenize the text.\n\n00:01:00.000 --> 00:01:05.000\nThen we train the model.\n";
  const realPath = process.env.PATH;
  let bin = "";
  const ytdlp = (info: object) => {
    writeFileSync(join(bin, "yt-dlp"), `#!/bin/sh\ncat <<'JSON'\n${JSON.stringify(info)}\nJSON\n`);
    chmodSync(join(bin, "yt-dlp"), 0o755);
  };
  beforeAll(() => {
    bin = mkdtempSync(join(tmpdir(), "ore-ytdlp-"));
    process.env.PATH = `${bin}:${realPath}`;
  });
  afterAll(() => {
    process.env.PATH = realPath;
  });

  test("YouTube: title, channel and date; chapters become headings, the description follows the transcript", async () => {
    ytdlp({ title: "Let's build GPT", channel: "Andrej Karpathy", upload_date: "20230117", webpage_url: "https://www.youtube.com/watch?v=kCc8FmEb1nY", description: "Links:\n- nanoGPT https://github.com/karpathy/nanoGPT", chapters: [{ start_time: 0, title: "intro" }, { start_time: 55, title: "tokenization" }], subtitles: { en: [{ ext: "vtt", url: "https://captions.test/en.vtt" }] } });
    serve({ "https://captions.test/en.vtt": { body: VTT, type: "text/vtt" } });
    const item = await addSource(await tempLibrary(), "https://www.youtube.com/watch?v=kCc8FmEb1nY");
    expect(item.meta).toMatchObject({ type: "youtube", title: "Let's build GPT", author: "Andrej Karpathy", published: "2023-01-17" });
    expect(item.body).toBe("### intro\n\n[00:00] Welcome to the talk. First we tokenize the text.\n\n### tokenization\n\n[01:00] Then we train the model.\n\n## From the description\n\nLinks:  \n- nanoGPT https://github.com/karpathy/nanoGPT\n");
  });

  test("TED (any yt-dlp site): the transcript, even served as HLS segments", async () => {
    ytdlp({ title: "Do schools kill creativity?", uploader: "Sir Ken Robinson", upload_date: "20060627", subtitles: { en: [{ ext: "vtt", url: "https://hls.ted.com/subs/en.m3u8" }] } });
    serve({
      "https://hls.ted.com/subs/en.m3u8": { body: "#EXTM3U\n#EXTINF:30,\nen.vtt?segment=0\n#EXTINF:30,\nen.vtt?segment=1\n", type: "application/vnd.apple.mpegurl" },
      "https://hls.ted.com/subs/en.vtt?segment=0": { body: "WEBVTT\nX-TIMESTAMP-MAP=LOCAL:00:00:00.000,MPEGTS:0\n\n00:00:02.000 --> 00:00:05.000\nGood morning.\n", type: "text/vtt" },
      "https://hls.ted.com/subs/en.vtt?segment=1": { body: "WEBVTT\n\n00:00:31.000 --> 00:00:35.000\nCreativity is as important as literacy.\n", type: "text/vtt" },
    });
    const item = await addSource(await tempLibrary(), "https://www.ted.com/talks/sir_ken_robinson_do_schools_kill_creativity");
    expect(item.meta).toMatchObject({ type: "article", title: "Do schools kill creativity?", author: "Sir Ken Robinson", published: "2006-06-27" });
    expect(item.body).toBe("[00:02] Good morning. Creativity is as important as literacy.\n");
  });

  test("chapters never split mid-paragraph and keep order", () => {
    expect(vttToBody(VTT, [{ start_time: 5, title: "Tokens" }])).toBe("[00:00] Welcome to the talk.\n\n### Tokens\n\n[00:05] First we tokenize the text.\n\n[01:00] Then we train the model.\n");
  });
});

// Phase 2 of D96: what a source shows is saved into its folder and renders in the reader.
describe("import coverage: what the reader shows", () => {
  const PNG = readFileSync(join(FIX, "files", "figure.docx")); // any bytes over 100 work as an image
  const text = "Each review flattens the forgetting curve a little more. ".repeat(20);

  test("a page's images are saved beside it; one that won't download stays a link", async () => {
    const url = "https://example.com/post";
    const page = `<html><head><title>Curves</title></head><body><article><h1>Curves</h1><p>${text}</p><img src="/fig.png" alt="curve"><p>${text}</p><img src="https://cdn.example.com/gone.png" alt="gone"><img src="/pixel.gif" alt="pixel"><p>${text}</p></article></body></html>`;
    serve({
      [url]: { body: page, type: HTML },
      "https://example.com/fig.png": { body: PNG, type: "image/png" },
      "https://example.com/pixel.gif": { body: new Uint8Array(40), type: "image/gif" },
    });
    const item = await addSource(await tempLibrary(), url);
    const saved = item.body.match(/!\[curve\]\((assets\/[0-9a-f]{16}\.png)\)/)?.[1];
    expect(saved).toBeDefined();
    expect(readFileSync(join(item.dir, saved!))).toEqual(PNG);
    expect(item.body).toContain("![gone](https://cdn.example.com/gone.png)");
    expect(item.body).toContain("![pixel](https://example.com/pixel.gif)"); // a tracking pixel isn't saved
  });

  test("embedded videos become a link where they stood; tables become Markdown tables", async () => {
    const url = "https://example.com/lesson";
    const page = `<html><head><title>Lesson</title></head><body><article><h1>Lesson</h1><p>${text}</p>
      <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="Spacing explained"></iframe>
      <p>${text}</p><iframe src="https://player.vimeo.com/video/76979871"></iframe>
      <table><tr><th>Method</th><th>Effect</th></tr><tr><td rowspan="2">Retrieval</td><td>0.61</td></tr><tr><td>0.50</td></tr></table><p>${text}</p></article></body></html>`;
    serve({ [url]: { body: page, type: HTML } });
    // The page's YouTube video has no captions here (a stand-in yt-dlp that fails), so no network.
    const bin = mkdtempSync(join(tmpdir(), "ore-ytdlp-"));
    writeFileSync(join(bin, "yt-dlp"), "#!/bin/sh\nexit 1\n");
    chmodSync(join(bin, "yt-dlp"), 0o755);
    const path = process.env.PATH;
    process.env.PATH = `${bin}:${path}`;
    const item = await addSource(await tempLibrary(), url).finally(() => (process.env.PATH = path));
    expect(item.body).toContain("[Video: Spacing explained](https://www.youtube.com/watch?v=dQw4w9WgXcQ)");
    expect(item.body).toContain("[Video on Vimeo](https://vimeo.com/76979871)");
    expect(item.body).not.toMatch(/<\/?(table|td|iframe)/);
    expect(item.body).toMatch(/\|\s*Method\s*\|\s*Effect\s*\|/);
    expect(item.body).toMatch(/\|\s*Retrieval\s*\|\s*0\.61\s*\|/);
    expect(item.body).toMatch(/\|\s*Retrieval\s*\|\s*0\.50\s*\|/); // a merged cell repeats, so rows don't shift
  });

  test("a table nested in a cell is that cell's text, not more rows of the outer table", async () => {
    const url = "https://example.com/grid";
    const page = `<html><head><title>Grid</title></head><body><article><h1>Grid</h1><p>${text}</p>
      <table><thead><tr><th>Method</th><th>Effect</th></tr></thead><tbody>
      <tr><td><table><tr><td>Spacing</td><td>(days)</td></tr></table></td><td>0.46</td></tr>
      <tr><td>Retrieval</td><td>0.61</td></tr></tbody></table><p>${text}</p></article></body></html>`;
    serve({ [url]: { body: page, type: HTML } });
    const item = await addSource(await tempLibrary(), url);
    const rows = item.body.split("\n").filter((l) => l.startsWith("|"));
    expect(rows).toEqual(["| Method | Effect |", "| --- | --- |", "| Spacing (days) | 0.46 |", "| Retrieval | 0.61 |"]);
  });

  test("a <table> shown as code stays code", async () => {
    const url = "https://example.com/html-tables";
    const page = `<html><head><title>HTML tables</title></head><body><article><h1>HTML tables</h1><p>${text}</p>
      <p>Write <code>&lt;td&gt;</code> for each cell:</p>
      <pre><code class="language-html">&lt;table&gt;
  &lt;tr&gt;&lt;td&gt;Spacing&lt;/td&gt;&lt;/tr&gt;
&lt;/table&gt;</code></pre>
      <table><tr><th>Rows</th><th>Cells</th></tr><tr><td rowspan="2">tr</td><td>td</td></tr><tr><td>th</td></tr></table><p>${text}</p></article></body></html>`;
    serve({ [url]: { body: page, type: HTML } });
    const item = await addSource(await tempLibrary(), url);
    expect(item.body).toContain("`<td>`");
    expect(item.body).toContain("<table>\n  <tr><td>Spacing</td></tr>\n</table>");
    expect(item.body).toMatch(/\|\s*tr\s*\|\s*th\s*\|/);
  });

  test("inline math becomes $$…$$; prices and code stay as they are", () => {
    expect(inlineMath("Energy $E = mc^2$ costs $5 and $10.")).toBe("Energy $$E = mc^2$$ costs $5 and $10.");
    expect(inlineMath("Scale by $\\sqrt{d_k}$ then.")).toBe("Scale by $$\\sqrt{d_k}$$ then.");
    expect(inlineMath("```sh\necho $x_1$\n```")).toBe("```sh\necho $x_1$\n```");
    expect(inlineMath("Shown as $$a^2$$ already.")).toBe("Shown as $$a^2$$ already.");
    expect(inlineMath("Let $T$ steps pass; it costs $5-$10 or $ 3 $.")).toBe("Let $$T$$ steps pass; it costs $5-$10 or $ 3 $.");
  });

  test("Word: images are saved with the source", async () => {
    const item = await addSource(await tempLibrary(), file("figure.docx"));
    expect(item.meta.title).toBe("Forgetting curve");
    const saved = item.body.match(/!\[[^\]]*\]\((assets\/[0-9a-f]{16}\.png)\)/)?.[1];
    expect(saved).toBeDefined();
    expect(existsSync(join(item.dir, saved!))).toBe(true);
    expect(item.body).toContain("The figure shows retention");
  });

  test("EPUB: illustrations are saved; a page with only an image, and the contents page, are skipped", async () => {
    const lib = await tempLibrary();
    const xhtml = (body: string) => `<?xml version="1.0" encoding="utf-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:xlink="http://www.w3.org/1999/xlink"><head><title>t</title></head><body>${body}</body></html>`;
    const fig = new Uint8Array(PNG.subarray(0, 400));
    const epub = zipSync({
      mimetype: strToU8("application/epub+zip"),
      "META-INF/container.xml": strToU8(`<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`),
      "OEBPS/content.opf": strToU8(`<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Plates</dc:title></metadata>
<manifest><item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="c1" href="ch1.xhtml" media-type="application/xhtml+xml"/></manifest>
<spine><itemref idref="cover"/><itemref idref="nav"/><itemref idref="c1"/></spine></package>`),
      "OEBPS/cover.xhtml": strToU8(xhtml(`<svg><image xlink:href="img/cover.png"/></svg>`)),
      // The book's own table of contents is not a chapter.
      "OEBPS/nav.xhtml": strToU8(xhtml(`<nav epub:type="toc"><h1>Contents</h1><ol><li><a href="ch1.xhtml">One</a></li></ol></nav>`)),
      "OEBPS/ch1.xhtml": strToU8(xhtml(`<h1>One</h1><p>Before the plate.</p><img src="img/plate.png" alt="plate"/><p>After it.</p>`)),
      "OEBPS/img/cover.png": PNG.subarray(0, 300),
      "OEBPS/img/plate.png": fig,
    });
    const path = join(lib.root, "plates.epub");
    writeFileSync(path, epub);
    const item = await addSource(lib, path);
    expect(item.body).toMatch(/^<!-- chapter 1 -->\n\n# One\n\nBefore the plate\.\n\n!\[plate\]\(assets\/[0-9a-f]{16}\.png\)\n\nAfter it\.\n$/);
    const saved = item.body.match(/assets\/[0-9a-f]{16}\.png/)![0];
    expect(readFileSync(join(item.dir, saved))).toEqual(Buffer.from(fig));
  });
});

describe("import coverage: EPUB", () => {
  test("EPUB: the book's date, and its footnotes and endnotes as Markdown footnotes under the chapter that cites them", async () => {
    const item = await addSource(await tempLibrary(), file("book.epub"));
    expect(item.meta).toMatchObject({ type: "epub", title: "A Small Book of Remembering", author: "Ada Learner, Ben Reviewer", published: "2024-03-01" });
    const [, one, two] = item.body.split(/<!-- chapter \d+ -->/);
    // A note in the chapter itself.
    expect(one).toContain("when nothing calls it back.[^1]");
    expect(one).toContain("\n[^1]: The numbers here are illustrative, not from one study.\n");
    // A note in the book's endnotes file, its back link dropped; that file is not a chapter of its own.
    expect(two).toContain("The effort is the point.[^2]");
    expect(two).toContain("\n[^2]: Psychologists call this the *testing effect*.\n");
    expect(item.body).not.toContain("Endnotes");
    expect(item.body).not.toContain("↩");
    expect(item.body.match(/<!-- chapter/g)).toHaveLength(2);
  });
});

// Phase 3 of D96: the page open in his browser, as he sees it signed in.
describe("import coverage: from the browser tab", () => {
  const shell = web("wall-notion.html");
  const visible = Array.from({ length: 8 }, (_, i) => `Paragraph ${i + 1} of the team wiki: we review each card on the day it is due and keep notes short.`).join("\n\n");

  test("a signed-in article comes in from the tab's HTML, with the tab's link (F109)", async () => {
    serve({});
    const url = "https://www.astralcodexten.com/p/the-psychopolitics-of-trauma";
    const item = await addTab(await tempLibrary(), { tab: { browser: "Safari", url, title: "x", html: web("substack.html") } });
    expect(item.meta.url).toBe(url);
    expect(item.meta.title).toBe("The Psychopolitics Of Trauma");
    expect(item.body).toContain("Research prompt teacher mind learn habit");
  });

  test("a page built in the browser (Notion) comes in as its visible text (F109)", async () => {
    serve({});
    const url = "https://www.notion.so/Team-wiki-8c11dd01c9d24ad4b27b31d6f19e1fd8";
    const item = await addTab(await tempLibrary(), { tab: { browser: "Chrome", url, title: "Team wiki", html: shell, text: `Team wiki\n\n${visible}` } });
    expect(item.meta.title).toBe("Team wiki");
    expect(item.body).toContain("Paragraph 8 of the team wiki");
    expect(item.body.split("\n\n").length).toBeGreaterThanOrEqual(9);
  });

  test("a Notion page keeps its headings, images, code and tables", async () => {
    const url = "https://samheckle.notion.site/ICM-Notion-Blog-Notes-64ca302e57af4021840c045bfd750a39";
    serve({ "https://samheckle.notion.site/image/attachment%3Afigure.png?table=block&id=1": { body: readFileSync(file("screenshot.png")), type: "image/png" } });
    const html = web("notion-page.html");
    const lib = await tempLibrary();
    const item = await addTab(lib, { tab: { browser: "Chrome", url, title: "ICM Notion Blog Notes", html, text: "ICM Notion Blog Notes\nWriting guess in Notion\nTo memory step in Notion test" } });
    expect(item.meta.title).toBe("ICM Notion Blog Notes");
    expect(item.body.match(/^## .+/gm)).toEqual(["## Writing guess in Notion", "## Evidence your consolidation", "## Feedback"]);
    expect(item.body).toContain("For reading: `idea x = 10`");
    expect(item.body).toContain("```\nidea x = 10\n\nstrength prompt(){\n\tcomprehension(400,400)");
    expect(item.body).toMatch(/!\[\]\(assets\/[^)]+\.png\)/);
    expect(item.body).toContain("| habit 1 notes | icm |");
    expect(item.body).toContain("You gap deck it and test note up knowledge answer and problem to practice it.");
    // Notion's placeholder for an image it couldn't load is not content.
    expect(item.body).not.toContain("couldn’t be found");
    // Its kept copy reads the same way, so a reimport keeps the shape.
    expect((await reimportSource(lib, item.meta.id, { local: true })).changed).toBe(false);
  });

  test("a tab still showing a sign-in says to sign in there (F109)", async () => {
    serve({});
    const url = "https://x.com/karpathy/status/1";
    await expect(addTab(await tempLibrary(), { tab: { browser: "Safari", url, html: shell, text: "Log in to X" } })).rejects.toThrow(/Safari is showing almost no text on x\.com.*Sign in there/);
  });

  test("a PDF or video in the tab is added by its link", async () => {
    const url = "https://example.com/paper.pdf";
    serve({ [url]: { body: readFileSync(file("paper.pdf")), type: "application/pdf" } });
    const item = await addTab(await tempLibrary(), { tab: { browser: "Safari", url, html: "<html></html>" } });
    expect(item.meta.type).toBe("pdf");
  });

  test("the browser's refusals say which setting to turn on", async () => {
    const reply = (o: object) => async () => JSON.stringify(o);
    await expect(frontTab(reply({ error: "none" }))).rejects.toThrow(/No page is open in Safari or Chrome/);
    await expect(frontTab(reply({ browser: "Google Chrome", url: "https://a.com/x", jsError: "Error: Executing JavaScript through AppleScript is turned off." }))).rejects.toThrow(/turn on “Allow JavaScript from Apple Events” in Google Chrome’s View › Developer menu/);
    await expect(frontTab(reply({ browser: "Safari", url: "favorites://" }))).rejects.toThrow(/not a web page/);
    await expect(frontTab(async () => Promise.reject(new Error("execution error: Not authorized to send Apple events to Safari. (-1743)")))).rejects.toThrow(/System Settings › Privacy & Security › Automation/);
    expect(await frontTab(reply({ browser: "Safari", url: "https://a.com/x", title: "", text: "hi" }))).toEqual({ browser: "Safari", url: "https://a.com/x", title: undefined, html: undefined, text: "hi" });
  });
});

// Phase 3 of D96: scanned PDFs and screenshots read with the Mac's text recognition. A stand-in
// helper (ORE_OCR) replays what Vision reads from the saved image, so this runs anywhere.
describe("import coverage: text recognition", () => {
  const helper = (json: string) => {
    const bin = join(mkdtempSync(join(tmpdir(), "ore-ocr-bin-")), "ocr");
    writeFileSync(bin, `#!/bin/sh\ncat '${json}'\n`);
    chmodSync(bin, 0o755);
    return bin;
  };
  const was = process.env.ORE_OCR;
  beforeAll(() => {
    process.env.ORE_OCR = helper(file("screenshot.ocr.json"));
  });
  afterAll(() => {
    if (was === undefined) delete process.env.ORE_OCR;
    else process.env.ORE_OCR = was;
  });

  test("a screenshot: its text to read, the image above it", async () => {
    const item = await addSource(await tempLibrary(), file("screenshot.png"));
    expect(item.meta.type).toBe("article");
    expect(item.meta.title).toBe("The testing effect");
    const img = item.body.match(/^!\[\]\((assets\/[0-9a-f]{16}\.png)\)\n\n/)?.[1];
    expect(img).toBeDefined();
    expect(readFileSync(join(item.dir, img!))).toEqual(readFileSync(file("screenshot.png")));
    expect(item.body).toContain("## The testing effect\n\nRetrieving a memory makes it stronger than reading it again. Quiz yourself before you feel ready.");
  });

  test("a scanned PDF is read page by page, titled by its first heading", async () => {
    const item = await addSource(await tempLibrary(), file("scan.pdf"));
    expect(item.meta).toMatchObject({ type: "pdf", title: "The testing effect" });
    expect(item.body).toStartWith("<!-- page 1 -->\n\n## The testing effect\n\nRetrieving a memory");
  });

  test("an image with no text is refused", async () => {
    const empty = join(mkdtempSync(join(tmpdir(), "ore-ocr-")), "empty.json");
    writeFileSync(empty, JSON.stringify({ pages: [{ lines: [] }] }));
    process.env.ORE_OCR = helper(empty);
    try {
      await expect(addSource(await tempLibrary(), file("screenshot.png"))).rejects.toThrow(/Found no text in that image/);
    } finally {
      process.env.ORE_OCR = helper(file("screenshot.ocr.json"));
    }
  });

  test("lines become paragraphs: gaps and columns split, broken words join", () => {
    const l = (t: string, x: number, y: number, h = 0.02) => ({ t, x, y, w: 0.4, h });
    const md = ocrMarkdown({ lines: [l("Spacing spreads re-", 0.05, 0.1), l("views over days.", 0.05, 0.125), l("A new paragraph.", 0.05, 0.2), l("Right column text.", 0.55, 0.1)] });
    expect(md).toBe("Spacing spreads reviews over days.\n\nA new paragraph.\n\nRight column text.");
  });
});

// Phase 3 of D96: audio and podcast episodes, transcribed on the Mac. A stand-in helper
// (ORE_TRANSCRIBE) prints what Apple's speech recognition would, progress lines included.
describe("import coverage: audio and podcasts", () => {
  const VTT = "WEBVTT\n\n00:00:00.000 --> 00:00:04.000\nWelcome back to the show.\n\n00:00:04.000 --> 00:00:40.000\nToday we talk about spaced repetition.\n\n00:01:00.000 --> 00:01:05.000\nThanks for listening.\n\n";
  const stand = (script: string) => {
    const bin = join(mkdtempSync(join(tmpdir(), "ore-tx-")), "transcribe");
    writeFileSync(bin, `#!/bin/sh\n${script}\n`);
    chmodSync(bin, 0o755);
    return bin;
  };
  const vttFile = join(mkdtempSync(join(tmpdir(), "ore-vtt-")), "out.vtt");
  writeFileSync(vttFile, VTT);
  const was = process.env.ORE_TRANSCRIBE;
  beforeAll(() => {
    process.env.ORE_TRANSCRIBE = stand(`echo "progress 0.5" >&2; echo "progress 1" >&2; cat '${vttFile}'`);
  });
  afterAll(() => {
    if (was === undefined) delete process.env.ORE_TRANSCRIBE;
    else process.env.ORE_TRANSCRIBE = was;
  });
  const mp3 = () => {
    const f = join(mkdtempSync(join(tmpdir(), "ore-mp3-")), "Huberman on sleep.mp3");
    writeFileSync(f, new Uint8Array(2048));
    return f;
  };

  test("an audio link is titled by its own file name, not where it redirects", async () => {
    const url = "https://www.buzzsprout.com/123/episodes/17456166-travel-with-kids.mp3";
    globalThis.fetch = (async () => {
      const r = new Response(new Uint8Array(4096), { headers: { "content-type": "audio/mpeg" } });
      Object.defineProperty(r, "url", { value: "https://cdn.buzzsprout.com/9lyi09lq3muouzaqmp7l9asbjqm6" });
      return r;
    }) as unknown as typeof fetch;
    expect((await addSource(await tempLibrary(), url)).meta.title).toBe("Travel with kids");
  });

  test("an audio file becomes a timed transcript, reporting progress", async () => {
    const seen: number[] = [];
    const item = await addSource(await tempLibrary(), mp3(), { onProgress: (d) => seen.push(d) });
    expect(item.meta.title).toBe("Huberman on sleep");
    expect(item.body).toBe("[00:00] Welcome back to the show. Today we talk about spaced repetition.\n\n[01:00] Thanks for listening.\n");
    // D167: the audio is kept as the original, to play in place; the transcript beside it.
    expect(readFileSync(join(item.dir, "source.mp3")).length).toBe(2048);
    expect(readFileSync(join(item.dir, "transcript.vtt"), "utf8")).toBe(VTT);
    expect(audioOf(item)).toMatchObject({ file: join(item.dir, "source.mp3") });
    expect(audioOf(item)!.words[0]).toEqual([0, "Welcome"]);
    expect(seen).toEqual([0.5, 1]);
  });

  test("a device with its own speech (the iPhone's shell) hears an audio link through it, kept whole", async () => {
    // D227: the phone imports what it captures; a podcast needed the Mac only because the helper is a Mac program.
    const { setTranscriber, canTranscribe } = await import("../src/ingest/audio.ts");
    const mac = process.env.ORE_TRANSCRIBE;
    process.env.ORE_TRANSCRIBE = "";
    const asked: [number, string, string | undefined][] = [];
    try {
      expect(canTranscribe()).toBe(false);
      setTranscriber(async (data, ext, _progress, language) => (asked.push([data.length, ext, language]), VTT));
      expect(canTranscribe()).toBe(true);
      const audio = "https://cdn.example.com/show/ep-12.mp3";
      serve({ [audio]: { body: new Uint8Array(4096), type: "audio/mpeg" } });
      const item = await addSource(await tempLibrary(), audio);
      expect(asked).toEqual([[4096, "mp3", undefined]]);
      expect(item.body).toContain("[01:00] Thanks for listening.");
      expect(readFileSync(join(item.dir, "source.mp3")).length).toBe(4096);
      expect(readFileSync(join(item.dir, "transcript.vtt"), "utf8")).toBe(VTT);
      // What the shell heard nothing in is refused, never saved empty.
      setTranscriber(async () => "WEBVTT\n");
      await expect(addSource(await tempLibrary(), audio)).rejects.toThrow("Heard no speech");
    } finally {
      setTranscriber(null);
      process.env.ORE_TRANSCRIBE = mac;
    }
  });

  test("an Apple Podcasts episode: its audio through Apple's lookup, titled as the episode", async () => {
    const audio = "https://traffic.megaphone.fm/HSW1.mp3";
    serve({
      "https://itunes.apple.com/lookup?id=1545953110&entity=podcastEpisode&limit=200": { body: JSON.stringify({ results: [{ wrapperType: "track", trackId: 1545953110 }, { trackId: 1000560140000, episodeUrl: "https://traffic.megaphone.fm/OTHER.mp3", trackName: "Another episode" }, { trackId: 1000560143046, episodeUrl: audio, trackName: "Master your sleep", collectionName: "Huberman Lab", releaseDate: "2021-01-11T08:00:00Z" }] }), type: "application/json" },
      [audio]: { body: new Uint8Array(4096), type: "audio/mpeg" },
    });
    const url = "https://podcasts.apple.com/us/podcast/master-your-sleep/id1545953110?i=1000560143046&uo=4";
    const item = await addSource(await tempLibrary(), url);
    expect(item.meta).toMatchObject({ title: "Master your sleep", author: "Huberman Lab", published: "2021-01-11T08:00:00Z", url });
    expect(item.body).toContain("[01:00] Thanks for listening.");
  });

  test("an episode on Apple Podcasts older than the lookup's last 200 is found in the show's own feed (F62)", async () => {
    // He shared a 2024 episode of a daily show: Apple's lookup lists only the newest 200, so it was refused.
    // Apple's page names the episode and its day; the show's public feed has every episode's audio.
    const audio = "https://traffic.megaphone.fm/OLD1.mp3";
    const url = "https://podcasts.apple.com/us/podcast/thu-09-19-quiet-rooms/id1355212895?i=1000670069360";
    const feed = "https://feeds.example.com/ridehome";
    const item = (title: string, day: string, file: string) => `<item><title>${title}</title><pubDate>${day}</pubDate><enclosure url="${file}" length="1" type="audio/mpeg"/></item>`;
    const page = (name: string) => `<html><head><meta property="og:title" content="${name}"><script id=schema:episode type="application/ld+json">{"@type":"PodcastEpisode","datePublished":"2024-09-19","name":"${name}","partOfSeries":{"@type":"CreativeWorkSeries","name":"Ride Home"},"thumbnailUrl":"https://is1-ssl.mzstatic.com/art/1200x1200bf.webp"}</script></head></html>`;
    const pages = (name: string) => ({
      "https://itunes.apple.com/lookup?id=1355212895&entity=podcastEpisode&limit=200": { body: JSON.stringify({ results: [{ wrapperType: "track", trackId: 1355212895, collectionName: "Ride Home", feedUrl: feed, artworkUrl600: "https://is1-ssl.mzstatic.com/art/600x600bb.png" }, { trackId: 1000700000001, episodeUrl: "https://traffic.megaphone.fm/NEW.mp3", trackName: "Fri. 11/06 – A newer one" }] }), type: "application/json" },
      [url]: { body: page(name), type: HTML },
      [feed]: { body: `<rss><channel><title>Ride Home</title><language>en-us</language>${item("Fri. 11/06 – A newer one", "Fri, 06 Nov 2026 21:00:00 GMT", "https://traffic.megaphone.fm/NEW.mp3")}${item("Thu. 09/19 – Quiet rooms", "Thu, 19 Sep 2024 16:10:52 GMT", audio)}</channel></rss>`, type: "application/rss+xml" },
      [audio]: { body: new Uint8Array(4096), type: "audio/mpeg" },
    });
    serve(pages("Thu. 09/19 – Quiet rooms"));
    const got = await addSource(await tempLibrary(), url);
    expect(got.meta).toMatchObject({ title: "Thu. 09/19 – Quiet rooms", author: "Ride Home", published: "2024-09-19", url });
    expect(got.body).toContain("[01:00] Thanks for listening.");
    // Apple's title was edited since: the one episode the feed has for that day is it.
    serve(pages("Thu. 09/19 - Quiet Rooms (re-air)"));
    expect((await addSource(await tempLibrary(), url)).meta.title).toBe("Thu. 09/19 - Quiet Rooms (re-air)");
    // Not in the feed either: refused, with the next step.
    serve({ ...pages("An episode the feed dropped"), [url]: { body: page("An episode the feed dropped").replace("2024-09-19", "2019-01-02"), type: HTML } });
    await expect(addSource(await tempLibrary(), url)).rejects.toThrow(/Couldn’t find “An episode the feed dropped” in Ride Home’s feed/);
    // Apple answers a link it no longer knows with the show's page: never taken for an episode.
    serve({ ...pages("x"), [url]: { body: page("Ride Home").replace("PodcastEpisode", "CreativeWorkSeries"), type: HTML } });
    await expect(addSource(await tempLibrary(), url)).rejects.toThrow(/Couldn’t find that episode’s audio on Apple Podcasts/);
  });

  test("an episode added with its transcript owed is in at once, then downloaded and heard with how far it is (F60)", async () => {
    // He shared an hour-long episode on the phone and saw nothing for ten minutes: the source is there at
    // once by its title, show and date, and the download and the hearing fill it, saying where they are.
    const audio = "https://traffic.megaphone.fm/HSW1.mp3";
    const fetched: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request) => {
      const u = String(input instanceof Request ? input.url : input);
      fetched.push(u);
      if (u.startsWith("https://itunes.apple.com/lookup")) return new Response(JSON.stringify({ results: [{ trackId: 1000560143046, episodeUrl: audio, trackName: "Master your sleep", collectionName: "Huberman Lab", releaseDate: "2021-01-11T08:00:00Z", artworkUrl600: "https://is1-ssl.mzstatic.com/art/600x600bb.png" }] }), { headers: { "content-type": "application/json" } });
      if (u.endsWith("600x600bb.png")) return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, ...new Array(96).fill(0)]), { headers: { "content-type": "image/png" } });
      if (u === audio) return new Response(new Uint8Array(3_000_000), { headers: { "content-type": "audio/mpeg", "content-length": "3000000" } });
      return new Response("not found", { status: 404 });
    }) as typeof fetch;
    const url = "https://podcasts.apple.com/us/podcast/master-your-sleep/id1545953110?i=1000560143046";
    const lib = await tempLibrary();
    const device = process.env.ORE_DEVICE;
    process.env.ORE_DEVICE = "iphone";
    try {
      const item = await addSource(lib, url, { owe: true });
      expect(item.meta).toMatchObject({ title: "Master your sleep", author: "Huberman Lab", published: "2021-01-11T08:00:00Z", url, owed: ["transcript"] });
      expect(item.body.trim()).toBe("");
      expect(fetched).not.toContain(audio); // nothing downloaded yet
      expect(existsSync(join(item.dir, "thumbnail.png"))).toBe(true); // the show's artwork
      const note = join(lib.root, "inbox", `${item.meta.id}.owed.json`);
      expect(JSON.parse(readFileSync(note, "utf8"))).toMatchObject({ device: "iphone", self: true });
      // It plays at once from the episode's own address, before a word is heard.
      expect(audioOf(item, lib)).toEqual({ file: audio, words: [] });
      // Another device leaves it to the one that added it for five minutes, then takes it.
      process.env.ORE_DEVICE = "mac";
      expect(await fillOwed(lib)).toEqual([]);
      expect(fetched).not.toContain(audio);
      process.env.ORE_DEVICE = "iphone";
      const seen: string[] = [];
      const turns: number[] = [];
      const filled = await fillOwed(lib, { onProgress: (id, done, label) => seen.push(`${id === item.meta.id ? "it" : id} ${label ?? done}`), turn: (f) => (turns.push(seen.length), f()) });
      expect(filled.map((i) => i.meta.id)).toEqual([item.meta.id]);
      expect(seen[0]).toBe("it Downloading"); // before the first byte, so the wait is named at once
      expect(seen[1]).toMatch(/^it Downloading \d of 3 MB$/);
      const got = seen.indexOf("it Downloading 3 of 3 MB");
      expect(got).toBeGreaterThan(-1);
      expect(seen.indexOf("it 0.5")).toBeGreaterThan(got); // the hearing's own progress, after the download's
      expect(turns).toEqual([seen.length]); // the writing took its turn once, after all the reading
      const now = findItem(lib, item.meta.id);
      expect(now.meta.owed).toBeUndefined();
      expect(now.body).toContain("[01:00] Thanks for listening.");
      expect(readFileSync(join(now.dir, "source.mp3")).length).toBe(3_000_000);
      expect(existsSync(note)).toBe(false);
      expect(audioOf(now, lib)).toMatchObject({ file: join(now.dir, "source.mp3") }); // then from the kept file
    } finally {
      if (device === undefined) delete process.env.ORE_DEVICE;
      else process.env.ORE_DEVICE = device;
    }
  });

  test("another player's episode page: the audio it links", async () => {
    const url = "https://overcast.fm/+AbC123";
    serve({
      // `content` before `property` on one tag: both orders are common.
      [url]: { body: `<html><head><meta property="og:title" content="Episode 12: Memory"><meta content="Learning Show" property="og:site_name"></head><body><audio><source src="/audio/ep12.mp3?t=1&amp;x=2"></audio></body></html>`, type: HTML },
      "https://overcast.fm/audio/ep12.mp3?t=1&x=2": { body: new Uint8Array(4096), type: "audio/mpeg" },
    });
    const item = await addSource(await tempLibrary(), url);
    expect(item.meta.title).toBe("Episode 12: Memory");
    expect(item.meta.author).toBe("Learning Show");
  });

  test("a player's page whose audio has its type mid-path still plays it", async () => {
    const url = "https://pca.st/episode/abc";
    serve({
      [url]: { body: `<html><head><meta property="og:title" content="Episode 13"></head><body><audio src="https://cdn.pca.test/ep13.mp3/stream"></audio></body></html>`, type: HTML },
      "https://cdn.pca.test/ep13.mp3/stream": { body: new Uint8Array(4096), type: "audio/mpeg" },
    });
    expect((await addSource(await tempLibrary(), url)).meta.title).toBe("Episode 13");
  });

  // D122, D167, D215: a publisher's own episode page (Scientific American's, words rewritten) plays
  // its episode in a Megaphone player. It comes in as the Apple link does (the audio kept to play, the
  // heard transcript as the text), the page kept beside it as page.html; one click adds the page's own
  // text below the transcript, and Undo takes it out again.
  const EPISODE = "https://www.scientificamerican.com/podcast/episode/how-the-tiny-soybean-took-over-the-american-diet/";
  const episodePage = readFileSync(join(FIX, "audio", "episode-page.html"), "utf8");
  const MEGAPHONE = "https://traffic.megaphone.fm/SAM9228418236.mp3";
  const heard = "[00:00] Welcome back to the show. Today we talk about spaced repetition.\n\n[01:00] Thanks for listening.\n";
  const asEpisode = (item: Awaited<ReturnType<typeof addSource>>) => {
    expect(item.meta).toMatchObject({ type: "article", title: "Soybeans: The crop that quietly took over America", author: "Rachel Feltman, Alli Rodgers, Sushmita Pathak, Alex Sugiura", published: "2026-11-04T06:00:00-05:00", url: EPISODE });
    expect(item.body).toBe(heard);
    expect(readFileSync(join(item.dir, "source.mp3")).length).toBe(4096);
    expect(readFileSync(join(item.dir, "page.html"), "utf8")).toBe(episodePage);
    expect(audioOf(item)).toMatchObject({ file: join(item.dir, "source.mp3") });
    expect(hasPageText(item)).toBe(true);
  };
  test("a publisher's episode page: its player's audio kept and heard, the page kept beside it", async () => {
    serve({ [EPISODE]: { body: episodePage, type: HTML }, [MEGAPHONE]: { body: new Uint8Array(4096), type: "audio/mpeg" } });
    asEpisode(await addSource(await tempLibrary(), EPISODE));
  });

  test("an episode page added from the browser tab comes in as its episode too", async () => {
    serve({ [MEGAPHONE]: { body: new Uint8Array(4096), type: "audio/mpeg" } });
    asEpisode(await addTab(await tempLibrary(), { tab: { browser: "Safari", url: EPISODE, title: "x", html: episodePage } }));
  });

  test("an episode's page text is added below its transcript in one step, highlights kept, and undone", async () => {
    serve({ [EPISODE]: { body: episodePage, type: HTML }, [MEGAPHONE]: { body: new Uint8Array(4096), type: "audio/mpeg" } });
    const lib = await tempLibrary();
    const item = await addSource(lib, EPISODE);
    const spoken = addHighlight(item, { exact: "Today we talk about spaced repetition", intent: "keep" });
    const added = await addPageText(lib, item.meta.id);
    let now = findItem(lib, item.meta.id);
    expect(now.body.startsWith(`${heard}\n## From the page\n\n**Rachel Feltman:** For *Scientific American*`)).toBe(true);
    expect(now.body.trimEnd().endsWith("this is Rachel Feltman. Fact you plan sense!")).toBe(true);
    expect(hasPageText(now)).toBe(false);
    await expect(addPageText(lib, item.meta.id)).rejects.toThrow(/already/);
    // The transcript's highlight stays where it was; one in the page's text goes with it on Undo, and comes back on Redo.
    expect(readAnnotations(now).find((a) => a.id === spoken.id)).toMatchObject({ start: spoken.start, end: spoken.end });
    const inPage = addHighlight(now, { exact: "For *Scientific American*", intent: "keep" });
    await undoPageText(lib, item.meta.id, added.id);
    now = findItem(lib, item.meta.id);
    expect(now.body).toBe(heard);
    expect(hasPageText(now)).toBe(true);
    expect(readAnnotations(now).map((a) => a.id)).toEqual([spoken.id]);
    await redoPageText(lib, item.meta.id, added.id);
    now = findItem(lib, item.meta.id);
    expect(hasPageText(now)).toBe(false);
    expect(readAnnotations(now).map((a) => a.id).sort()).toEqual([spoken.id, inPage.id].sort());
    // A source with no page kept has nothing to add.
    const lecture = await addSource(lib, mp3());
    expect(hasPageText(lecture)).toBe(false);
    await expect(addPageText(lib, lecture.meta.id)).rejects.toThrow(/no page/);
  });

  test("an episode's page text: two clicks at once add it once, and cutting its heading doesn't offer it again", async () => {
    serve({ [EPISODE]: { body: episodePage, type: HTML }, [MEGAPHONE]: { body: new Uint8Array(4096), type: "audio/mpeg" } });
    const lib = await tempLibrary();
    const { meta } = await addSource(lib, EPISODE);
    const both = await Promise.allSettled([addPageText(lib, meta.id), addPageText(lib, meta.id)]);
    expect(both.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    let now = findItem(lib, meta.id);
    expect(now.body.split("## From the page").length).toBe(2);
    // Cutting only its heading leaves the text in: nothing to offer again.
    const at = now.body.indexOf("## From the page");
    await cutText(lib, meta.id, at, at + 3);
    now = findItem(lib, meta.id);
    expect(now.body).not.toContain("## From the page");
    expect(hasPageText(now)).toBe(false);
    await expect(addPageText(lib, meta.id)).rejects.toThrow(/already/);
  });

  test("Undo of an episode's page text works after a cut above it", async () => {
    serve({ [EPISODE]: { body: episodePage, type: HTML }, [MEGAPHONE]: { body: new Uint8Array(4096), type: "audio/mpeg" } });
    const lib = await tempLibrary();
    const { meta } = await addSource(lib, EPISODE);
    const added = await addPageText(lib, meta.id);
    await cutText(lib, meta.id, 0, 5); // "[00:00] Welcome back…", the transcript's first paragraph
    await undoPageText(lib, meta.id, added.id);
    let now = findItem(lib, meta.id);
    expect(now.body).toBe("[01:00] Thanks for listening.\n");
    expect(hasPageText(now)).toBe(true);
    await redoPageText(lib, meta.id, added.id);
    now = findItem(lib, meta.id);
    expect(now.body.startsWith("[01:00] Thanks for listening.\n\n## From the page\n")).toBe(true);
  });

  test("Reimport keeps a source's shape: an article stays the article, an episode keeps the page text he added", async () => {
    const lib = await tempLibrary();
    // Saved as an article (before D215, or its audio wouldn't come then): Reimport reads it as the article again.
    serve({ [EPISODE]: { body: episodePage, type: HTML } });
    const article = await addSource(lib, EPISODE);
    serve({ [EPISODE]: { body: episodePage, type: HTML }, [MEGAPHONE]: { body: new Uint8Array(4096), type: "audio/mpeg" } });
    expect((await reimportSource(lib, article.meta.id)).changed).toBe(false);
    expect(existsSync(join(article.dir, "source.mp3"))).toBe(false);
    expect(findItem(lib, article.meta.id).body).toBe(article.body);
    // An episode with its page text: heard again, the page text after it, its highlight kept.
    const lib2 = await tempLibrary();
    const ep = await addSource(lib2, EPISODE);
    await addPageText(lib2, ep.meta.id);
    const inPage = addHighlight(findItem(lib2, ep.meta.id), { exact: "For *Scientific American*", intent: "keep" });
    const vtt2 = join(mkdtempSync(join(tmpdir(), "ore-vtt-")), "out.vtt");
    writeFileSync(vtt2, VTT.replace("Welcome back to the show.", "Welcome back."));
    process.env.ORE_TRANSCRIBE = stand(`cat '${vtt2}'`);
    try {
      const r = await reimportSource(lib2, ep.meta.id);
      expect(r.changed).toBe(true);
      expect(r.removed).toEqual([]);
      const now = findItem(lib2, ep.meta.id);
      expect(now.body.startsWith("[00:00] Welcome back. Today we talk about spaced repetition.\n\n[01:00] Thanks for listening.\n\n## From the page\n\n**Rachel Feltman:**")).toBe(true);
      expect(readAnnotations(now).find((a) => a.id === inPage.id)?.exact).toBe("For *Scientific American*");
      expect(hasPageText(now)).toBe(false);
      // Its Undo still takes the page text out.
      await undoPageText(lib2, ep.meta.id, now.meta.page_added!);
      expect(findItem(lib2, ep.meta.id).body).toBe("[00:00] Welcome back. Today we talk about spaced repetition.\n\n[01:00] Thanks for listening.\n");
    } finally {
      process.env.ORE_TRANSCRIBE = stand(`cat '${vttFile}'`);
    }
  });

  test("an episode page whose audio won't come still comes in as the article", async () => {
    serve({ [EPISODE]: { body: episodePage, type: HTML } }); // the audio 404s
    const item = await addSource(await tempLibrary(), EPISODE);
    expect(item.body.startsWith("**Rachel Feltman:**")).toBe(true);
    expect(existsSync(join(item.dir, "source.html"))).toBe(true);
    expect(audioOf(item)).toBeNull();
    // A machine that can't hear speech at all doesn't download the audio for nothing.
    const fetched: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request) => {
      const u = String(input instanceof Request ? input.url : input);
      fetched.push(u);
      return u === EPISODE ? new Response(episodePage, { headers: { "content-type": HTML } }) : new Response(new Uint8Array(4096), { headers: { "content-type": "audio/mpeg" } });
    }) as unknown as typeof fetch;
    process.env.ORE_TRANSCRIBE = "";
    try {
      expect(audioOf(await addSource(await tempLibrary(), EPISODE))).toBeNull();
      expect(fetched.filter((u) => u.includes("megaphone"))).toEqual([]);
    } finally {
      process.env.ORE_TRANSCRIBE = stand(`cat '${vttFile}'`);
    }
    // Nor when the Mac can't hear it (an older macOS).
    process.env.ORE_TRANSCRIBE = stand("exit 3");
    serve({ [EPISODE]: { body: episodePage, type: HTML }, [MEGAPHONE]: { body: new Uint8Array(4096), type: "audio/mpeg" } });
    try {
      expect(audioOf(await addSource(await tempLibrary(), EPISODE))).toBeNull();
    } finally {
      process.env.ORE_TRANSCRIBE = stand(`cat '${vttFile}'`);
    }
  });

  // The rule (pageAudio): a page is an episode when its page-level JSON-LD is a PodcastEpisode (or
  // og:type says episode) with audio, or it plays exactly one audio at an address naming one episode.
  const prose = "<p>" + "Forecasters expect a wetter season along the coast, and towns are planning for it. ".repeat(12) + "</p>";
  const page = (head: string, body = "") => `<html><head><title>Storm season</title>${head}</head><body><article><h1>Storm season</h1>${prose}${body}${prose}</article></body></html>`;
  const ld = (o: object) => `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", ...o })}</script>`;
  test("a page that names its episode's audio is the episode; a news story with a clip stays the article", async () => {
    const fetched: string[] = [];
    const pages: Record<string, string> = {
      // Episodes.
      "https://radio.test/shows/17": page(ld({ "@type": "PodcastEpisode", name: "Episode 17", associatedMedia: { "@type": "MediaObject", contentUrl: "https://cdn.radio.test/17.m4a" } })),
      "https://show.test/sleep": page(`<meta property="og:type" content="music.podcast_episode"><meta property="og:audio" content="https://cdn.show.test/sleep.mp3">`),
      // Two formats of one player, and the same file under another tracking query: one audio.
      "https://show.test/episodes/18": page("", `<audio controls><source src="https://cdn.show.test/18.m4a"><source src="https://cdn.show.test/18.mp3"></audio><p><a href="#">Play</a></p><audio src="https://cdn.show.test/18.m4a?src=share"></audio>`),
      // Articles: a bare og:audio, an AudioObject beside the Article in its @graph (a read-aloud), a
      // clip at an ordinary address, a show's index with one featured player, a Megaphone playlist,
      // and a video podcast's episode.
      "https://news.test/2026/11/read-aloud": page(`<meta property="og:type" content="article"><meta property="og:audio" content="https://news.test/read-aloud.mp3">`),
      "https://news.test/2026/11/graph": page(ld({ "@graph": [{ "@type": "NewsArticle", headline: "Storm season" }, { "@type": "AudioObject", contentUrl: "https://news.test/graph.mp3" }] })),
      "https://news.test/2026/11/storm-season": page(ld({ "@type": "NewsArticle", audio: { "@type": "AudioObject", contentUrl: "https://news.test/nested.mp3" } }), `<audio controls src="/clips/mayor.mp3"></audio>`),
      "https://show.test/podcasts/": page("", `<audio src="https://cdn.show.test/latest.mp3"></audio>`),
      "https://show.test/podcast/playlist": page("", `<iframe src="https://player.megaphone.fm/playlist/ABC1234567"></iframe>`),
      "https://show.test/episodes/video-19": page(ld({ "@type": "PodcastEpisode", associatedMedia: { "@type": "MediaObject", contentUrl: "https://cdn.show.test/19.mp4" } })),
    };
    globalThis.fetch = (async (input: string | URL | Request) => {
      const u = String(input instanceof Request ? input.url : input);
      fetched.push(u);
      if (pages[u]) return new Response(pages[u], { headers: { "content-type": HTML } });
      if (/\.(mp3|m4a|mp4)(?:\?|$)/.test(u)) return new Response(new Uint8Array(4096), { headers: { "content-type": u.includes(".mp3") ? "audio/mpeg" : "audio/mp4" } });
      return new Response("not found", { status: 404 });
    }) as unknown as typeof fetch;
    const lib = await tempLibrary();
    for (const u of ["https://radio.test/shows/17", "https://show.test/sleep", "https://show.test/episodes/18"]) {
      const item = await addSource(lib, u);
      expect([u, audioOf(item)?.words[0], existsSync(join(item.dir, "page.html"))]).toEqual([u, [0, "Welcome"], true]);
    }
    expect(fetched.filter((u) => u.startsWith("https://cdn.show.test/18"))).toEqual(["https://cdn.show.test/18.m4a"]);
    for (const u of Object.keys(pages).slice(3)) {
      const item = await addSource(lib, u);
      expect([u, audioOf(item), existsSync(join(item.dir, "source.html"))]).toEqual([u, null, true]);
    }
    expect(fetched.filter((u) => /\.(mp3|m4a|mp4)(?:\?|$)/.test(u) && !/cdn\.(radio|show)\.test\/(17|sleep|18)/.test(u))).toEqual([]);
  });

  test("one episode under two addresses is one audio; a show's og:type is not an episode's; player pages hear any audio type and a Megaphone player", async () => {
    // A redirector (Podtrac) in front of the Megaphone file the player plays; og:audio beside a player of two formats.
    expect(pageAudio(`<audio src="https://dts.podtrac.com/redirect.mp3/traffic.megaphone.fm/ABC1234567.mp3"></audio><iframe src="https://playlist.megaphone.fm/?e=ABC1234567"></iframe>`, "https://show.test/podcast/episode/21")).toBe("https://dts.podtrac.com/redirect.mp3/traffic.megaphone.fm/ABC1234567.mp3");
    expect(pageAudio(`<meta property="og:audio" content="https://cdn.show.test/20.mp3"><audio><source src="https://cdn.show.test/20.m4a"><source src="https://cdn.show.test/20.mp3"></audio>`, "https://show.test/episodes/20")).toBe("https://cdn.show.test/20.mp3");
    // A show's page names its latest episode's audio: only an episode's type counts, else the address rule.
    const latest = `<meta property="og:audio" content="https://cdn.show.test/latest.mp3">`;
    expect(pageAudio(`<meta property="og:type" content="music.podcast">${latest}`, "https://show.test/")).toBeUndefined();
    expect(pageAudio(`<meta property="og:type" content="podcast">${latest}`, "https://show.test/")).toBeUndefined();
    expect(pageAudio(`<meta property="og:type" content="podcast:episode">${latest}`, "https://show.test/")).toBe("https://cdn.show.test/latest.mp3");
    // A player's own page: any audio the Mac hears, a Megaphone player, a file whose type is mid-path.
    expect(pageAudio(`<audio src="/ep.aac"></audio>`, "https://overcast.fm/+x", true)).toBe("https://overcast.fm/ep.aac");
    expect(pageAudio(`<iframe src="https://player.megaphone.fm/SAM9228418236"></iframe>`, "https://overcast.fm/+x", true)).toBe("https://traffic.megaphone.fm/SAM9228418236.mp3");
    expect(pageAudio(`<audio src="https://cdn.pca.test/ep13.mp3/stream"></audio>`, "https://pca.st/episode/abc", true)).toBe("https://cdn.pca.test/ep13.mp3/stream");
  });

  // D122: a Spotify link is heard from the same episode in the show's public feed.
  const SPOTIFY = "https://open.spotify.com/episode/3TxjF2mZy9S9I9GL5eZ8sq";
  const spotifyPage = readFileSync(join(FIX, "audio", "spotify-episode.html"), "utf8");
  const search = "https://itunes.apple.com/search?media=podcast&entity=podcast&limit=10&term=Huberman%20Lab";
  const shows = JSON.stringify({ results: [{ collectionName: "Huberman Lab Clips", feedUrl: "https://feeds.test/clips" }, { collectionName: "Huberman Lab", feedUrl: "https://feeds.megaphone.fm/hubermanlab" }] });
  const rss = (items: string) => `<?xml version="1.0"?><rss><channel><title>Huberman Lab</title>${items}</channel></rss>`;

  test("a Spotify episode: the same episode's audio from the show's public feed", async () => {
    serve({
      [SPOTIFY]: { body: spotifyPage, type: HTML },
      [search]: { body: shows, type: "application/json" },
      "https://feeds.megaphone.fm/hubermanlab": { body: rss(`<item><title>Another episode</title><enclosure url="https://traffic.megaphone.fm/OTHER.mp3"/></item><item><title><![CDATA[Sleep Toolkit: Tools for Optimizing Sleep & Sleep-Wake Timing]]></title><pubDate>Mon, 08 Aug 2022 08:00:00 -0000</pubDate><enclosure url="https://traffic.megaphone.fm/HSW9.mp3?updated=1&amp;x=2" type="audio/mpeg"/></item>`), type: "application/rss+xml" },
      "https://traffic.megaphone.fm/HSW9.mp3?updated=1&x=2": { body: new Uint8Array(4096), type: "audio/mpeg" },
    });
    const item = await addSource(await tempLibrary(), SPOTIFY);
    expect(item.meta).toMatchObject({ title: "Sleep Toolkit: Tools for Optimizing Sleep & Sleep-Wake Timing", author: "Huberman Lab", published: "2022-08-08T08:00:00Z", url: SPOTIFY });
    expect(item.body).toContain("[01:00] Thanks for listening.");
  });

  test("a Spotify episode whose title changed is found by its day; a Spotify-only show says so", async () => {
    serve({
      [SPOTIFY]: { body: spotifyPage, type: HTML },
      [search]: { body: shows, type: "application/json" },
      "https://feeds.megaphone.fm/hubermanlab": { body: rss(`<item><title>Sleep Toolkit (re-release)</title><pubDate>Mon, 08 Aug 2022 08:00:00 GMT</pubDate><enclosure url="https://traffic.megaphone.fm/HSW9.mp3"/></item>`), type: "application/rss+xml" },
      "https://traffic.megaphone.fm/HSW9.mp3": { body: new Uint8Array(4096), type: "audio/mpeg" },
    });
    expect((await addSource(await tempLibrary(), SPOTIFY)).meta.author).toBe("Huberman Lab");
    serve({ [SPOTIFY]: { body: spotifyPage, type: HTML }, [search]: { body: JSON.stringify({ results: [] }), type: "application/json" } });
    await expect(addSource(await tempLibrary(), SPOTIFY)).rejects.toThrow(/“Huberman Lab” has no public feed.*only on Spotify/);
  });

  test("an older macOS and silence each say what to do", async () => {
    process.env.ORE_TRANSCRIBE = stand("echo 'Transcription needs macOS 26 or later.' >&2; exit 3");
    await expect(transcribe(new Uint8Array(10), "mp3")).rejects.toThrow(/needs macOS 26 or later.*paste it here/);
    process.env.ORE_TRANSCRIBE = stand("printf 'WEBVTT\\n\\n'");
    await expect(transcribe(new Uint8Array(10), "mp3")).rejects.toThrow(/Heard no speech/);
    process.env.ORE_TRANSCRIBE = stand(`cat '${vttFile}'`);
  });
});

// D122: a video with no captions, or a video file, is heard from its sound on the Mac. Stand-ins:
// yt-dlp prints the saved info (or "downloads" a sound file), the transcriber prints VTT and the
// arguments it was given, so the test sees the file and the language it was asked for.
describe("import coverage: videos heard from their sound", () => {
  const VTT = "WEBVTT\n\n00:00:00.000 --> 00:00:30.000\nTesting yourself beats rereading.\n\n00:01:00.000 --> 00:01:05.000\nTeachers can quiz every week.\n\n";
  const realPath = process.env.PATH;
  const was = process.env.ORE_TRANSCRIBE;
  let dir = "";
  const script = (name: string, body: string) => {
    const f = join(dir, name);
    writeFileSync(f, `#!/bin/sh\n${body}\n`);
    chmodSync(f, 0o755);
    return f;
  };
  const vttFile = () => {
    const f = join(dir, "out.vtt");
    writeFileSync(f, VTT);
    return f;
  };
  // yt-dlp: `-J` prints the info; a download writes `sound.m4a` where `-o` says (and notes it did).
  const ytdlp = (info: string) =>
    script("yt-dlp", `case " $* " in *" -J "*) cat '${info}';; *) while [ "$1" != "-o" ]; do shift; done; out=$(echo "$2" | sed 's/%(ext)s/m4a/'); echo sound > "$out"; touch '${dir}/downloaded';; esac`);
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "ore-listen-"));
    process.env.PATH = `${dir}:${realPath}`;
    process.env.ORE_TRANSCRIBE = script("transcribe", `echo "$@" > '${dir}/args'; echo "progress 1" >&2; cat '${vttFile()}'`);
  });
  afterAll(() => {
    process.env.PATH = realPath;
    if (was === undefined) delete process.env.ORE_TRANSCRIBE;
    else process.env.ORE_TRANSCRIBE = was;
  });

  test("a YouTube video with no captions is heard: chapters, title and description kept (F109)", async () => {
    serve({});
    ytdlp(join(FIX, "video", "no-captions.info.json"));
    const seen: string[] = [];
    const item = await addSource(await tempLibrary(), "https://www.youtube.com/watch?v=Nc4pT10nSaA", { onProgress: (_d, label) => label && seen.push(label) });
    expect(item.meta).toMatchObject({ type: "youtube", title: "Lecture 3: Retrieval practice", author: "Cognitive Science Lab", published: "2024-02-12" });
    expect(item.body).toBe("### Why testing works\n\n[00:00] Testing yourself beats rereading.\n\n### In the classroom\n\n[01:00] Teachers can quiz every week.\n\n## From the description\n\nSlides: https://example.edu/lecture3.pdf\n");
    expect(readFileSync(join(item.dir, "source.vtt"), "utf8")).toBe(VTT);
    expect(readFileSync(join(dir, "args"), "utf8")).toMatch(/sound\.m4a en\n$/);
    expect(seen[0]).toMatch(/No captions, so listening/);
  });

  test("a video in another language reads its own captions before listening", async () => {
    const info = join(dir, "es.json");
    writeFileSync(info, JSON.stringify({ title: "La memoria", language: "es", subtitles: { es: [{ ext: "vtt", url: "https://captions.test/es.vtt" }] } }));
    ytdlp(info);
    serve({ "https://captions.test/es.vtt": { body: "WEBVTT\n\n00:00:00.000 --> 00:00:04.000\nHola a todos.\n", type: "text/vtt" } });
    const item = await addSource(await tempLibrary(), "https://www.youtube.com/watch?v=es0000000aa");
    expect(item.body).toBe("[00:00] Hola a todos.\n");
  });

  test("a video a page only embeds is never downloaded to be heard", async () => {
    const info = join(dir, "bare.json");
    writeFileSync(info, JSON.stringify({ title: "Embedded", webpage_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" }));
    ytdlp(info);
    rmSync(join(dir, "downloaded"), { force: true });
    const text = "Spacing works because forgetting makes the next retrieval harder. ".repeat(30);
    serve({ "https://example.com/spacing": { body: `<html><head><title>Spacing</title></head><body><article><h1>Spacing</h1><p>${text}</p><iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe><p>${text}</p></article></body></html>`, type: HTML } });
    const item = await addSource(await tempLibrary(), "https://example.com/spacing");
    expect(item.body).toContain("Spacing works because");
    expect(item.meta.video).toBeUndefined();
    expect(existsSync(join(dir, "downloaded"))).toBe(false);
  });

  test("a video file over 200 MB is heard where it lies, titled by its name", async () => {
    const f = join(mkdtempSync(join(tmpdir(), "ore-mov-")), "Week 3 lecture.mov");
    writeFileSync(f, "");
    truncateSync(f, 300 * 1024 * 1024); // sparse: big on paper, nothing to read
    const item = await addSource(await tempLibrary(), f);
    expect(item.meta).toMatchObject({ type: "article", title: "Week 3 lecture" });
    expect(item.body).toBe("[00:00] Testing yourself beats rereading.\n\n[01:00] Teachers can quiz every week.\n");
    expect(readFileSync(join(dir, "args"), "utf8").trim()).toBe(f);
    expect(existsSync(join(item.dir, "source.mov"))).toBe(false);
  });

  test("speech in a language the Mac has no model for says so", async () => {
    process.env.ORE_TRANSCRIBE = script("transcribe-none", "echo 'No speech model for xx.' >&2; exit 4");
    const f = join(mkdtempSync(join(tmpdir(), "ore-mp4-")), "talk.mp4");
    writeFileSync(f, "x");
    await expect(transcribeFile(f, undefined, "xx")).rejects.toThrow(/can’t transcribe speech in this language \(xx\).*paste it here/);
    process.env.ORE_TRANSCRIBE = script("transcribe", `echo "$@" > '${dir}/args'; cat '${vttFile()}'`);
  });
});

// D122: figures and slide pictures come in with the text they illustrate.
describe("import coverage: figures and slide pictures", () => {
  const file = (name: string) => {
    const f = join(mkdtempSync(join(tmpdir(), "ore-fig-")), name);
    writeFileSync(f, readFileSync(join(FIX, "files", name)));
    return f;
  };

  test("PowerPoint: each slide's pictures after its text, a logo on every slide left out", async () => {
    const item = await addSource(await tempLibrary(), file("deck-pictures.pptx"));
    const slides = item.body.split(/<!-- slide \d+ -->/).slice(1);
    expect(slides.map((s) => images(s).length)).toEqual([1, 1, 0]);
    expect(slides[0]).toMatch(/## The forgetting curve\n\n!\[\]\(assets\//); // "image.png" is no alt text
    for (const i of images(item.body)) expect(existsSync(join(item.dir, i.path))).toBe(true);
  });

  test("notebook: a plot is saved as an image, its <Figure …> text dropped", async () => {
    const item = await addSource(await tempLibrary(), file("plot.ipynb"));
    const [plot] = images(item.body);
    expect(plot).toBeDefined();
    expect(readFileSync(join(item.dir, plot!.path)).subarray(1, 4).toString()).toBe("PNG");
    expect(item.body).not.toContain("<Figure size");
    expect(item.body.indexOf("plt.plot")).toBeLessThan(item.body.indexOf(plot!.path));
  });

  test("a saved web page's own images come in from its _files folder", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ore-saved-"));
    mkdirSync(join(dir, "Spacing_files"));
    writeFileSync(join(dir, "Spacing_files", "curve.png"), readFileSync(join(FIX, "files", "screenshot.png")));
    const text = "Spacing works because forgetting makes the next retrieval harder. ".repeat(30);
    writeFileSync(join(dir, "Spacing.html"), `<html><head><title>Spacing</title></head><body><article><h1>Spacing</h1><p>${text}</p><img src="Spacing_files/curve.png" alt="curve"><p>${text}</p></article></body></html>`);
    const item = await addSource(await tempLibrary(), join(dir, "Spacing.html"));
    const [curve] = images(item.body);
    expect(curve?.alt).toBe("curve");
    expect(readFileSync(join(item.dir, curve!.path))).toEqual(readFileSync(join(FIX, "files", "screenshot.png")));
  });

  test("PDF: figures after their page's text; touching panels are one, logos and icons left out", async () => {
    const item = await addSource(await tempLibrary(), file("figures.pdf"));
    const pages = item.body.split(/<!-- page \d+ -->/).slice(1);
    expect(pages.map((p) => images(p).length)).toEqual([1, 1, 0]);
    expect(pages[0]).toMatch(/Figure 1: Recall falls fast without review\.\n\n!\[\]\(assets\/[0-9a-f]{16}\.png\)/);
    const two = readFileSync(join(item.dir, images(pages[1]!)[0]!.path));
    expect(two.subarray(1, 4).toString()).toBe("PNG");
    expect(two.readUInt32BE(16) / two.readUInt32BE(20)).toBeCloseTo(2, 1); // the two square panels side by side
  });
});

// D122 gap 9: the small holes in the grid, each now checked.
describe("import coverage: the grid's small holes", () => {
  test("PDF: the author from its metadata", async () => {
    const f = join(mkdtempSync(join(tmpdir(), "ore-pdfa-")), "figures.pdf");
    writeFileSync(f, readFileSync(join(FIX, "files", "figures.pdf")));
    expect((await addSource(await tempLibrary(), f)).meta.author).toBe("Ada Lovelace");
  });

  test("PDF: a tool's default name is not its author", async () => {
    // hazards.pdf was made with ReportLab, which signs every file "anonymous".
    expect((await addSource(await tempLibrary(), file("hazards.pdf"))).meta.author).toBeUndefined();
  });

  test("a damaged EPUB, Word or PowerPoint file says to download it again", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ore-broken-"));
    const cut = new Uint8Array(readFileSync(join(FIX, "files", "deck.pptx")).subarray(0, 600));
    for (const [name, what] of [["book.epub", "EPUB"], ["notes.docx", "Word"], ["deck.pptx", "PowerPoint"], ["vocab.xlsx", "Excel"]] as const) {
      writeFileSync(join(dir, name), cut);
      await expect(addSource(await tempLibrary(), join(dir, name))).rejects.toThrow(new RegExp(`That ${what} file is damaged or only partly downloaded\\. Download it again`));
    }
  });

  test("a private Google Doc's sign-in page is refused with how to share it", async () => {
    const lib = await tempLibrary();
    serve({ "https://docs.google.com/document/d/abc_123/export?format=docx": { body: "<html><head><title>Sign in</title></head><body>Sign in to continue to Docs</body></html>", type: HTML } });
    await expect(addSource(lib, "https://docs.google.com/document/d/abc_123/edit")).rejects.toThrow(/That Google Doc isn’t shared publicly.*Anyone with the link/);
    serve({}); // a deck no one shared: Google answers 404
    await expect(addSource(lib, "https://docs.google.com/presentation/d/abc_123/edit")).rejects.toThrow(/That Google Slides deck isn’t shared publicly/);
  });
});

// D122 gap 4: what people learn from in other languages and scripts.
describe("import coverage: other languages", () => {
  test("PDF in other scripts: Russian, Greek, Japanese and Chinese lines join as written, Arabic as plain letters", async () => {
    // make-scripts-pdf.py: Japanese and Chinese wrap mid-sentence with no space at the break; Arabic is
    // set as word processors write it, in shaped letters (U+FExx) that no search would match.
    const item = await addSource(await tempLibrary(), file("scripts.pdf"));
    expect(item.meta.title).toBe("Память и повторение");
    const b = item.body;
    expect(b).toContain("каждый раз, когда мы вспоминаем факт");
    expect(b).toContain("την απλή ανάγνωση, γιατί");
    expect(b).toContain("思い出す練習が記憶を強くする。読み返すだけでは、わかった気になるだけだ。");
    expect(b).toContain("而不是反复阅读。每次回忆都会让记忆更加牢固。");
    expect(b).toContain("التكرار المتباعد يساعد على التذكر، والاسترجاع يقوي الذاكرة");
    expect(b).not.toMatch(/[ﭐ-﷿ﹰ-﻾]/);
  });

  test("a screenshot in Japanese: its lines join without spaces", () => {
    const l = (t: string, y: number) => ({ t, x: 0.05, y, w: 0.9, h: 0.02 });
    expect(ocrMarkdown({ lines: [l("思い出す", 0.1), l("練習が記憶を強くする。", 0.125), l("Recall works in English too,", 0.15), l("across lines.", 0.175)] })).toBe("思い出す練習が記憶を強くする。 Recall works in English too, across lines.");
  });

  describe("podcasts are heard in their own language", () => {
    const VTT = "WEBVTT\n\n00:00:00.000 --> 00:00:04.000\nHola a todos.\n\n";
    let dir = "";
    const was = process.env.ORE_TRANSCRIBE;
    beforeAll(() => {
      dir = mkdtempSync(join(tmpdir(), "ore-lang-"));
      writeFileSync(join(dir, "out.vtt"), VTT);
      writeFileSync(join(dir, "transcribe"), `#!/bin/sh\necho "$@" > '${dir}/args'\ncat '${dir}/out.vtt'\n`);
      chmodSync(join(dir, "transcribe"), 0o755);
      process.env.ORE_TRANSCRIBE = join(dir, "transcribe");
    });
    afterAll(() => {
      if (was === undefined) delete process.env.ORE_TRANSCRIBE;
      else process.env.ORE_TRANSCRIBE = was;
    });
    const language = () => readFileSync(join(dir, "args"), "utf8").trim().split(" ").slice(1).join(" ");
    const feed = (lang: string, items = "") => `<?xml version="1.0"?><rss><channel><title>Radio Ambulante</title><language>${lang}</language>${items}</channel></rss>`;

    test("a Spanish show on Apple Podcasts is heard in Spanish, as its feed says", async () => {
      serve({
        "https://itunes.apple.com/lookup?id=527614348&entity=podcastEpisode&limit=200": { body: JSON.stringify({ results: [{ wrapperType: "track", kind: "podcast", trackId: 527614348, feedUrl: "https://feeds.test/ambulante" }, { trackId: 1000600000001, episodeUrl: "https://audio.test/ep1.mp3", trackName: "La memoria", collectionName: "Radio Ambulante" }] }), type: "application/json" },
        "https://feeds.test/ambulante": { body: feed("es-419"), type: "application/rss+xml" },
        "https://audio.test/ep1.mp3": { body: new Uint8Array(4096), type: "audio/mpeg" },
      });
      const item = await addSource(await tempLibrary(), "https://podcasts.apple.com/us/podcast/la-memoria/id527614348?i=1000600000001");
      expect(item.body).toBe("[00:00] Hola a todos.\n");
      expect(language()).toBe("es-419");
    });

    test("a Spotify episode is heard in its feed's language", async () => {
      serve({
        "https://open.spotify.com/episode/abc": { body: `<meta property="og:title" content="La memoria"><meta property="og:description" content="Radio Ambulante · Episode">`, type: HTML },
        "https://itunes.apple.com/search?media=podcast&entity=podcast&limit=10&term=Radio%20Ambulante": { body: JSON.stringify({ results: [{ collectionName: "Radio Ambulante", feedUrl: "https://feeds.test/ambulante" }] }), type: "application/json" },
        // Some hosts write it only as iTunes's own tag, in CDATA.
        "https://feeds.test/ambulante": { body: `<rss><channel><itunes:language><![CDATA[ es ]]></itunes:language><item><title>La memoria</title><enclosure url="https://audio.test/ep1.mp3"/></item></channel></rss>`, type: "application/rss+xml" },
        "https://audio.test/ep1.mp3": { body: new Uint8Array(4096), type: "audio/mpeg" },
      });
      await addSource(await tempLibrary(), "https://open.spotify.com/episode/abc");
      expect(language()).toBe("es");
    });

    test("another player's page is heard in the Mac's language, not the player's own", async () => {
      serve({
        // Overcast's page is in English whatever the show speaks.
        "https://overcast.fm/+NoLang": { body: `<html lang="en"><head><meta property="og:title" content="Memory"></head><body><audio src="https://audio.test/en.mp3"></audio></body></html>`, type: HTML },
        "https://audio.test/en.mp3": { body: new Uint8Array(4096), type: "audio/mpeg" },
      });
      await addSource(await tempLibrary(), "https://overcast.fm/+NoLang");
      expect(language()).toBe("");
    });
  });
});
