import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanAuthor, cleanDate, cleanTitle, refusal, wordCount } from "../src/ingest/check.ts";
import { addSource, addTab, addText } from "../src/ingest/index.ts";
import { doctor } from "../src/doctor.ts";
import { frontTab } from "../src/ingest/tab.ts";
import { ocrMarkdown } from "../src/ingest/ocr.ts";
import { transcribe } from "../src/ingest/audio.ts";
import { absolutize, rewrite } from "../src/ingest/links.ts";
import { inlineMath } from "../src/ingest/web.ts";
import { srtToVtt, vttToBody } from "../src/ingest/youtube.ts";
import { strToU8, zipSync } from "fflate";
import { tempLibrary } from "./helpers.ts";

// Import coverage (docs/reviews/2026-10-28-import-coverage.md): every content type Ore reads has a
// saved example here, and each must keep what a learner needs from it. Pages are real ones, saved
// with scripts and styles stripped; `bun run intake:live` re-checks the live sites.

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
afterEach(() => {
  globalThis.fetch = realFetch;
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
  { name: "essay", url: "https://paulgraham.com/greatwork.html", fixture: "essay.html", title: "How to Do Great Work", minWords: 11000, has: ["If you collected lists of techniques", "Curiosity", "for suggestions and for reading drafts"], paragraphs: 100, links: 20 },
  { name: "blog with diagrams and code", url: "https://lilianweng.github.io/posts/2023-06-23-agent/", fixture: "blog-images.html", title: "LLM Powered Autonomous Agents", author: "Lilian Weng", published: "2023-06-23T00:00:00Z", minWords: 6000, has: ["In a LLM-powered autonomous agent system", "In the API-Bank workflow", "After going through key ideas and demos"], headings: 12, images: 13, code: 6 },
  { name: "docs with code (Python)", url: "https://docs.python.org/3/tutorial/classes.html", fixture: "docs-python.html", title: "9. Classes", minWords: 5000, has: ["Compared with other programming languages", "If the same attribute name occurs in", "Some simple generators can be coded succinctly"], headings: 15, code: 30 },
  { name: "docs with code (MDN)", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures", fixture: "docs-mdn.html", title: "Closures", published: "2025-11-04T07:08:26.000Z", minWords: 2500, has: ["closure", "One solution in this case is to", "However, redefining the prototype is not recommended."], headings: 6, code: 25 },
  { name: "Wikipedia", url: "https://en.wikipedia.org/wiki/Spaced_repetition", fixture: "wikipedia.html", title: "Spaced repetition", author: "Wikipedia", published: "2001-08-09T02:05:34Z", minWords: 3500, has: ["Spaced repetition is", "In the Leitner system, correctly answered cards"], headings: 8, images: 3 },
  { name: "newsletter (Substack)", url: "https://www.astralcodexten.com/p/the-psychopolitics-of-trauma", fixture: "substack.html", title: "The Psychopolitics Of Trauma", author: "Scott Alexander", published: "2024-01-25T03:34:57+00:00", minWords: 5000, has: ["Everyone knows politics makes people crazy", "As stated, this doesn’t really apply to", "But thinking of things this way has"], headings: 5, images: 3 },
  { name: "tutorial", url: "https://www.freecodecamp.org/news/git-and-github-for-beginners/", fixture: "tutorial.html", title: "Git and GitHub Tutorial – Version Control for Beginners", author: "Ihechikara Abba", published: "2021-11-05T18:25:06.000Z", minWords: 2500, has: ["Git and GitHub are two technologies that", "Before we \"add\" and \"commit\" our files", "If you have followed up to this"], headings: 15, images: 8, code: 3 },
  { name: "blog with two kinds of footnotes (Wait But Why)", url: "https://waitbutwhy.com/2015/01/artificial-intelligence-revolution-1.html", fixture: "footnotes-waitbutwhy.html", title: "The AI Revolution: The Road to Superintelligence", author: "Tim Urban", published: "2015-01-22T14:21:52+00:00", minWords: 7500, has: ["We made a fancy PDF of this post", "Plagiarize the brain", "That’s the topic of [Part 2 of this post]"], headings: 8, images: 10 },
  { name: "course page: junk metadata is dropped", url: "https://www.coursera.org/learn/learning-how-to-learn", fixture: "coursera.html", title: "Learning How to Learn: Powerful mental tools to help you master tough subjects", minWords: 300, has: ["In this module, we’re going to be"] },
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
    expect(body).toMatch(/no one calls it AI anymore\.”\[\^7\]/);
    expect(body).toMatch(/^\[\^7\]: Vardi, /m);
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
    expect(words(item.body)).toBeGreaterThan(5000);
    expect(item.body).toContain("Scaled Dot-Product Attention");
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

  test("nbviewer and Google links point at what to read", () => {
    expect(rewrite("https://nbviewer.org/github/jakevdp/PythonDataScienceHandbook/blob/master/notebooks/a.ipynb")).toMatchObject({ kind: "fetch", url: "https://raw.githubusercontent.com/jakevdp/PythonDataScienceHandbook/master/notebooks/a.ipynb" });
    expect(rewrite("https://docs.google.com/document/d/abc_123/edit?usp=sharing")).toEqual({ kind: "fetch", url: "https://docs.google.com/document/d/abc_123/export?format=docx" });
    expect(rewrite("https://docs.google.com/presentation/d/abc_123/edit#slide=id.p")).toEqual({ kind: "fetch", url: "https://docs.google.com/presentation/d/abc_123/export/pptx" });
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

  test("links Ore can't read yet say why at once", async () => {
    const lib = await tempLibrary();
    await expect(addSource(lib, "https://x.com/karpathy/status/1617979122625712128")).rejects.toThrow(/X only shows posts to signed-in browsers/);
    await expect(addSource(lib, "https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk")).rejects.toThrow(/Spotify keeps its episodes locked/);
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
    const b = item.body;
    for (const said of ["because memory is so central", "The study of learning science tries", "practise retrieval, pulling", "The testing effect, found again", "This spacing effect is among", "called interleaving, helps"]) expect(b).toContain(said);
    for (const note of ["Memory", "Learning science", "Retrieval,", "Testing effect", "Free recall", "Cued recall", "Practice testing", "Spacing effect", "Interleaving"]) expect(b).not.toContain(note);
    expect(b).not.toContain("Chapter 1 Learning");
    expect(b).not.toContain("Section 1.1 Why Retrieval Works");
    expect(b).not.toMatch(/^\d$/m);
    expect(b.match(/^#{2,3} .+$/gm)).toEqual(["## LEARNING", "### 1.1 Why Retrieval Works", "### 1.1.1 Testing beats rereading", "### 1.1.2 Spacing out sessions"]);
    expect(b).toContain("A test can take many forms:\n\n- free recall to write down all you remember;\n\n- cued recall to answer from a prompt or a question;\n\n- practice testing to work through problems without the answers in view.\n\nEach one asks");
    expect(b).toContain("it does not.\n\n1 Ebbinghaus measured the curve on himself in the 1880s, with lists of nonsense syllables.\n\n2 A later replication");
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
    const key = join(mkdtempSync(join(tmpdir(), "ore-key-")), "talk.key");
    writeFileSync(key, "x");
    await expect(addSource(await tempLibrary(), key)).rejects.toThrow(/can’t read “.key” files yet.*docx, pptx.*png/);
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
    expect(item.meta.type).toBe("article");
    expect(item.meta.author).toBe("Sir Ken Robinson");
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

// Phase 3 of D96: the page open in his browser, as he sees it signed in.
describe("import coverage: from the browser tab", () => {
  const shell = web("wall-notion.html");
  const visible = Array.from({ length: 8 }, (_, i) => `Paragraph ${i + 1} of the team wiki: we review each card on the day it is due and keep notes short.`).join("\n\n");

  test("a signed-in article comes in from the tab's HTML, with the tab's link", async () => {
    const url = "https://www.astralcodexten.com/p/the-psychopolitics-of-trauma";
    const item = await addTab(await tempLibrary(), { tab: { browser: "Safari", url, title: "x", html: web("substack.html") } });
    expect(item.meta.url).toBe(url);
    expect(item.meta.title).toBe("The Psychopolitics Of Trauma");
    expect(item.body).toContain("Everyone knows politics makes people crazy");
  });

  test("a page built in the browser (Notion) comes in as its visible text", async () => {
    const url = "https://www.notion.so/Team-wiki-8c11dd01c9d24ad4b27b31d6f19e1fd8";
    const item = await addTab(await tempLibrary(), { tab: { browser: "Chrome", url, title: "Team wiki", html: shell, text: `Team wiki\n\n${visible}` } });
    expect(item.meta.title).toBe("Team wiki");
    expect(item.body).toContain("Paragraph 8 of the team wiki");
    expect(item.body.split("\n\n").length).toBeGreaterThanOrEqual(9);
  });

  test("a tab still showing a sign-in says to sign in there", async () => {
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

  test("a scanned PDF is read page by page", async () => {
    const item = await addSource(await tempLibrary(), file("scan.pdf"));
    expect(item.meta.type).toBe("pdf");
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
    expect(readFileSync(join(item.dir, "source.vtt"), "utf8")).toBe(VTT);
    expect(seen).toEqual([0.5, 1]);
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

  test("an older macOS and silence each say what to do", async () => {
    process.env.ORE_TRANSCRIBE = stand("echo 'Transcription needs macOS 26 or later.' >&2; exit 3");
    await expect(transcribe(new Uint8Array(10), "mp3")).rejects.toThrow(/needs macOS 26 or later.*paste it here/);
    process.env.ORE_TRANSCRIBE = stand("printf 'WEBVTT\\n\\n'");
    await expect(transcribe(new Uint8Array(10), "mp3")).rejects.toThrow(/Heard no speech/);
    process.env.ORE_TRANSCRIBE = stand(`cat '${vttFile}'`);
  });
});
