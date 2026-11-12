import { Readability } from "@mozilla/readability";
import { Defuddle } from "defuddle/node";
import { parseHTML } from "linkedom";
import { cleanAuthor, cleanDate, escapeMarkdown, FROM_TAB } from "./check.ts";
import { td } from "./markdown.ts";
import { notionMarkdown } from "./rendered.ts";
import { youtubeId } from "./youtube.ts";

export interface WebDoc {
  title: string;
  author?: string;
  published?: string;
  markdown: string;
}

/** An embedded player's page: YouTube, Vimeo or Loom, else null. */
function videoPage(src: string): string | null {
  const yt = /youtube(?:-nocookie)?\.com\/embed\//.test(src) && youtubeId(src);
  if (yt) return `https://www.youtube.com/watch?v=${yt}`;
  const vimeo = src.match(/player\.vimeo\.com\/video\/(\d+)/)?.[1];
  if (vimeo) return `https://vimeo.com/${vimeo}`;
  const loom = src.match(/loom\.com\/embed\/(\w+)/)?.[1];
  return loom ? `https://www.loom.com/share/${loom}` : null;
}

/** Embedded videos as a "Video: …" link where they stand, so the text says a video is there and
 *  one click opens it; an extractor drops the iframe itself. */
function videoLinks(document: Document) {
  for (const f of Array.from(document.querySelectorAll("iframe"))) {
    const page = videoPage(f.getAttribute("src") ?? f.getAttribute("data-src") ?? "");
    if (!page) continue;
    const p = document.createElement("p");
    const a = document.createElement("a");
    a.setAttribute("href", page);
    const title = f.getAttribute("title")?.trim();
    a.textContent = title ? `Video: ${title}` : `Video on ${/youtube/.test(page) ? "YouTube" : /vimeo/.test(page) ? "Vimeo" : "Loom"}`;
    p.appendChild(a);
    f.replaceWith(p);
  }
}

/** Footnotes in a list Defuddle doesn't know (Wait But Why's second, "footnotes2" list): marked the
 *  way it reads them, so they become Markdown footnotes and their markers jump to them. A list is
 *  footnotes when text outside it links to its items and its items link back to those markers. */
function footnoteLists(document: Document) {
  const inPage = new Map<string, Element[]>();
  for (const a of Array.from(document.querySelectorAll('a[href^="#"]'))) {
    const id = a.getAttribute("href")!.slice(1);
    if (id) inPage.set(id, [...(inPage.get(id) ?? []), a]);
  }
  for (const list of Array.from(document.querySelectorAll("ol, ul"))) {
    if (list.closest(".footnotes, .footnote, #footnotes")) continue;
    const items = Array.from(list.children).filter((li) => li.tagName === "LI" && li.id && inPage.has(li.id));
    const refs = items.flatMap((li) => inPage.get(li.id)!.filter((a) => !list.contains(a)));
    const backs = items.filter((li) => Array.from(li.querySelectorAll('a[href^="#"]')).some((a) => refs.some((r) => r.id && a.getAttribute("href") === `#${r.id}`)));
    if (!refs.length || backs.length * 2 < items.length) continue;
    for (const r of refs) r.classList.add("footnote-anchor");
    const box = document.createElement("div");
    box.className = "footnotes";
    list.replaceWith(box);
    box.appendChild(list);
  }
}

/** Merged cells spread out, so each row reads whole as a Markdown table: a cell spanning rows repeats
 *  its text in each, one spanning columns leaves the rest empty. Without it the rows below a merged
 *  cell shift left under the wrong headings. */
function flatTables(document: Document) {
  // A small table nested in a cell (a value and its unit) becomes that cell's text, innermost first:
  // Defuddle would otherwise keep the inner one and spill the outer table's rows as plain text. A
  // table that holds the page's text (an essay laid out in tables, like paulgraham.com) is content:
  // flattening it would run its paragraphs, links and images into one line.
  for (const inner of Array.from(document.querySelectorAll("table table")).reverse()) {
    if (inner.querySelector("p, br, div, img, ul, ol, pre, blockquote, h1, h2, h3, h4, h5, h6, a") || (inner.textContent ?? "").length > 300) continue;
    const span = document.createElement("span");
    span.textContent = Array.from(inner.querySelectorAll("th,td"))
      .map((c) => c.textContent?.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join(" ");
    inner.replaceWith(span);
  }
  for (const table of Array.from(document.querySelectorAll("table"))) {
    const rows = Array.from(table.querySelectorAll("tr")).filter((tr) => tr.closest("table") === table);
    if (!rows.some((tr) => Array.from(tr.children).some((c) => c.hasAttribute("rowspan") || c.hasAttribute("colspan")))) continue;
    const below: { col: number; cell: Element; left: number }[] = [];
    for (const tr of rows) {
      const cells = Array.from(tr.children).filter((c) => /^t[hd]$/i.test(c.tagName));
      const out: Element[] = [];
      const fill = () => {
        for (let p = below.find((b) => b.col === out.length && b.left > 0); p; p = below.find((b) => b.col === out.length && b.left > 0)) {
          out.push(p.cell.cloneNode(true) as Element);
          p.left--;
        }
      };
      for (const c of cells) {
        fill();
        const rs = Math.min(Number(c.getAttribute("rowspan")) || 1, 50);
        const cs = Math.min(Number(c.getAttribute("colspan")) || 1, 50);
        c.removeAttribute("rowspan");
        c.removeAttribute("colspan");
        if (rs > 1) below.push({ col: out.length, cell: c, left: rs - 1 });
        out.push(c);
        for (let i = 1; i < cs; i++) out.push(document.createElement(c.tagName));
      }
      fill();
      tr.replaceChildren(...out);
    }
  }
}

/** Tables an extractor kept as raw HTML (rowspans, math in cells), which the reader never renders,
 *  as Markdown tables of their cells' text. */
function htmlTables(md: string): string {
  const convert = (t: string) => {
    const { document } = parseHTML(`<html><body>${t}</body></html>`);
    return td.turndown(document.body as unknown as HTMLElement).trim();
  };
  // A whole table, nested ones included: the first `</table>` after `<table>` may close an inner one.
  // A `<table>` in code (a tutorial on HTML) is text to show, not a table: fences and code spans are skipped.
  let out = "";
  let pos = 0;
  let depth = 0;
  let start = 0;
  for (const m of md.matchAll(/(?:^|\n)(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1[^\S\n]*(?=\n|$)|`[^`\n]+`|<\/?table\b[^>]*>/gi)) {
    if (m[0][0] !== "<") continue;
    if (m[0][1] !== "/") {
      if (depth++ === 0) start = m.index;
    } else if (depth > 0 && --depth === 0) {
      const end = m.index + m[0].length;
      out += md.slice(pos, start) + convert(md.slice(start, end));
      pos = end;
    }
  }
  return out + md.slice(pos);
}

/** Inline math as `$$…$$`, which the reader renders, so a plain `$` (prices) never reads as math.
 *  A span is math as Pandoc reads it: no space inside either `$`, no digit after the closing one
 *  ("$5 and $10" stays). Code is left alone. */
export function inlineMath(md: string): string {
  let fence = false;
  return md
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) fence = !fence;
      if (fence || !line.includes("$")) return line;
      return line.replace(/(^|[^$\\])\$(?!\$)(\S(?:[^$\n]*?\S)?)\$(?![$\d])/g, (_, pre, tex) => `${pre}$$${tex}$$`);
    })
    .join("\n");
}

/** Defuddle's extractors log fetch failures (Reddit's feed) as stack traces; the add says what failed. */
async function quiet<T>(f: () => Promise<T>): Promise<T> {
  const error = console.error;
  console.error = () => {};
  try {
    return await f();
  } finally {
    console.error = error;
  }
}

/** A title as the page's own heading shows it: "Интервальные повторения — Википедия" is "Интервальные повторения".
 *  Defuddle drops a site name it can match to the link ("- Wikipedia"), which misses one in another language. */
function siteless(title: string, h1: string | undefined): string {
  const h = h1?.replace(/\s+/g, " ").trim();
  const rest = h && title.startsWith(h) ? title.slice(h.length) : "";
  return rest.length <= 60 && /^\s+[-–—|·]\s+\S/.test(rest) ? h! : title;
}

// Defuddle → Markdown. Fallback: Readability text as paragraphs.
// linkedom instead of jsdom: jsdom 30's selector engine rejects Defuddle's long selectors.
/** A paper's authors from LaTeXML's markup (arXiv's HTML papers): each `.ltx_personname`'s own text,
 *  before its footnote marks and affiliations. "A", "A and B", or "A et al." past two. */
function paperAuthors(doc: Document): string | undefined {
  const names = [...doc.querySelectorAll(".ltx_authors .ltx_personname")]
    .map((el) => [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent?.trim())?.textContent?.replace(/[\s∗*†‡]+$/u, "").replace(/\s+/g, " ").trim())
    .filter((n): n is string => !!n && /\p{L}/u.test(n));
  if (!names.length) return undefined;
  return names.length === 1 ? names[0] : names.length === 2 ? names.join(" and ") : `${names[0]} et al.`;
}

/** Wikipedia's formulas as the TeX their authors wrote (each one's annotation), not TeX rebuilt from
 *  its MathML, which comes out as `\left(\right. log \left(t\right)`. */
function wikiMath(doc: Document) {
  for (const el of doc.querySelectorAll(".mwe-math-element")) {
    let raw = el.querySelector('annotation[encoding="application/x-tex"]')?.textContent ?? el.querySelector("img")?.getAttribute("alt") ?? "";
    // Today's pages carry a <math> formula's source in the element's own data (`body.extsrc`);
    // a <chem> one's source there lacks its \ce{}, so it keeps its annotation.
    try {
      const mw = JSON.parse(el.getAttribute("data-mw") ?? "{}") as { name?: string; body?: { extsrc?: string } };
      if (mw.name === "math" && mw.body?.extsrc) raw = mw.body.extsrc;
    } catch { /* not Wikipedia's data after all */ }
    raw = raw.trim();
    const wrapped = raw.match(/^\{\\displaystyle\s*([\s\S]*)\}$/)?.[1];
    // Only when that last brace closes the wrapper: `{\displaystyle a}{b}` is two groups.
    const tex = (wrapped !== undefined && balanced(wrapped) ? wrapped : raw).trim();
    if (!tex) continue;
    const math = doc.createElement("span");
    const block =
      el.classList.contains("mwe-math-element-block") ||
      el.getAttribute("display") === "block" ||
      !!el.querySelector('math[display="block"], img.mwe-math-fallback-image-display');
    math.className = block ? "math math-display" : "math math-inline";
    math.setAttribute("data-latex", tex);
    // With text in it, a formula that is the only thing in its line (Wikipedia indents display ones) stays.
    math.textContent = tex;
    el.replaceWith(math);
  }
}

/** Whether every brace in a TeX string closes one opened before it. */
function balanced(tex: string): boolean {
  let depth = 0;
  for (const m of tex.matchAll(/\\.|[{}]/g)) {
    if (m[0] === "{") depth++;
    else if (m[0] === "}" && --depth < 0) return false;
  }
  return depth === 0;
}

/** Text as one Markdown paragraph that says what it says: no heading, list or quote from its first mark. */
const paragraph = (s: string) =>
  escapeMarkdown(s.replace(/\s+/g, " ").trim()).replace(/^(\d+)([.)])/, "$1\\$2").replace(/^([#>+=-])/, "\\$1");

/** A Speaker Deck talk as its slides, the way PowerPoint's come in: each slide's picture, then its
 *  words from the page's transcript (the site's reader keeps its other decks instead). A talk with
 *  no transcript is refused with how to get its slides. */
function speakerDeck(html: string, url: string): WebDoc | undefined {
  if (!/^https?:\/\/(?:www\.)?speakerdeck\.com\/[^/]+\/[^/?#]+/.test(url)) return undefined;
  const doc = parseHTML(html).document as unknown as Document;
  let talk: { name?: string; description?: string; datePublished?: string; author?: { name?: string } } | undefined;
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const ld = JSON.parse(s.textContent ?? "") as typeof talk & { "@type"?: string };
      if (ld?.["@type"] === "PresentationDigitalDocument") talk = ld;
    } catch { /* another script's data */ }
  }
  if (!talk) return undefined; // a profile or a list of talks
  const slides = [...doc.querySelectorAll("#transcript .slide-transcript")];
  if (!slides.length) throw new Error("Speaker Deck hasn't shared this talk's slide text. Download its PDF from the talk's page (the download button under the slides), then add that file.");
  const parts = talk.description?.trim() ? [paragraph(talk.description)] : [];
  slides.forEach((s, i) => {
    const n = i + 1;
    const image = s.querySelector("a[href]")?.getAttribute("href")?.match(/^https:\/\/[^\s()]+$/)?.[0];
    // Its words come in two parts, the title link and the rest, kept apart so they never run together.
    const head = s.querySelector("h3");
    const first = head?.textContent ?? "";
    head?.remove();
    const words = paragraph(`${first} ${s.textContent ?? ""}`);
    parts.push(`<!-- slide ${n} -->`, `## Slide ${n}`, ...(image ? [`![Slide ${n}](${image})`] : []), ...(words ? [words] : []));
  });
  const title = talk.name?.trim() || doc.querySelector('meta[property="og:title"]')?.getAttribute("content")?.trim() || url;
  return { title, author: cleanAuthor(talk.author?.name), published: cleanDate(talk.datePublished), markdown: parts.join("\n\n") + "\n" };
}

/** Pages of a Discourse topic read, 20 replies each; past them (or a page that won't load) the doc
 *  says where the rest are. */
const DISCOURSE_PAGES = 25;

/** A Discourse topic (a course's, a tool's or a community's forum) as a Hacker News thread comes in:
 *  the first post as the text, then every reply under its author and date, page after page. The page
 *  lays them out for search engines with no names a reader keeps, beside like counts and lists of
 *  linked topics. Returns the first post's author. */
async function discourse(doc: Document, url: string): Promise<string | undefined> {
  if (!/^Discourse\b/.test(doc.querySelector('meta[name="generator"]')?.getAttribute("content") ?? "")) return undefined;
  const postsOf = (d: Document) => [...d.querySelectorAll(".crawler-post")].filter((p) => p.querySelector(".post"));
  const posts = postsOf(doc);
  if (!posts.length) return undefined;
  const topic = (doc.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? url).replace(/\?.*$/, "");
  const position = (p: Element) => p.querySelector('[itemprop="position"]')?.textContent?.trim();
  if (position(posts[0]!) !== "1") throw new Error(`That link opens partway through the topic. Add the topic from its start instead: ${topic}`);
  let next = doc.querySelector('link[rel="next"]')?.getAttribute("href");
  for (let pages = 1; next && pages < DISCOURSE_PAGES; pages++) {
    const res = await fetch(new URL(next, url).href, { headers: { "user-agent": "Mozilla/5.0 (Macintosh)" }, signal: AbortSignal.timeout(15000) }).catch(() => null);
    if (!res?.ok) break;
    const page = parseHTML(await res.text()).document as unknown as Document;
    const seen = new Set(posts.map(position));
    posts.push(...postsOf(page).filter((p) => !seen.has(position(p))));
    next = page.querySelector('link[rel="next"]')?.getAttribute("href");
  }
  const el = (tag: string, text?: string) => Object.assign(doc.createElement(tag), text === undefined ? {} : { textContent: text });
  const name = (p: Element) => p.querySelector('[itemprop="author"] [itemprop="name"]')?.textContent?.trim() ?? "";
  const article = el("article");
  article.append(el("h1", doc.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? doc.title));
  posts.forEach((p, i) => {
    const body = p.querySelector(".post")!;
    const own = body.ownerDocument;
    const mk = (tag: string, text?: string) => Object.assign(own.createElement(tag), text === undefined ? {} : { textContent: text });
    const link = (text: string, href: string) => Object.assign(mk("a", text), { href });
    // An image's file name and size under it, and avatars, are the forum's chrome.
    for (const x of body.querySelectorAll(".lightbox-wrapper .meta, img.avatar, .quote-controls")) x.remove();
    // A date as its reader sees it (the page holds it in a form Defuddle drops).
    for (const d of body.querySelectorAll(".discourse-local-date")) d.replaceWith(d.getAttribute("data-email-preview") ?? d.textContent ?? "");
    // A quoted post under the name of who wrote it, linked when it is from elsewhere.
    for (const q of body.querySelectorAll("aside.quote")) {
      const quote = q.querySelector("blockquote") ?? mk("blockquote");
      const who = q.getAttribute("data-username");
      const from = q.querySelector(".title a[href]");
      if (who) {
        const line = mk("p");
        line.append(from ? link(who, from.getAttribute("href")!) : who, ":");
        quote.prepend(line);
      }
      q.replaceWith(quote);
    }
    // A pasted link's preview, as the link under its title.
    for (const o of body.querySelectorAll("aside.onebox")) {
      const href = o.getAttribute("data-onebox-src") ?? o.querySelector("a[href]")?.getAttribute("href");
      const line = mk("p");
      if (href) line.append(link(o.querySelector("h3")?.textContent?.trim() || href, href));
      o.replaceWith(line);
    }
    if (i === 0) return void article.insertAdjacentHTML("beforeend", body.innerHTML + (posts.length > 1 ? "<hr><h2>Comments</h2>" : ""));
    const reply = mk("blockquote");
    const head = mk("p");
    const who = name(p);
    const date = p.querySelector("time")?.getAttribute("datetime")?.slice(0, 10);
    const n = position(p);
    if (who) head.append(mk("strong", who));
    if (date) head.append(who ? " · " : "", n ? link(date, `${topic}/${n}`) : date);
    if (head.childNodes.length) reply.append(head);
    reply.append(...body.childNodes);
    article.insertAdjacentHTML("beforeend", reply.outerHTML);
  });
  if (next) {
    const rest = el("p", "Later replies aren't here: ");
    rest.append(Object.assign(el("a", "read them on the forum"), { href: new URL(next, url).href }));
    article.append(rest);
  }
  doc.body.replaceChildren(article);
  // Discourse names are letters, digits, dots, dashes and underscores, in any script.
  const op = name(posts[0]!);
  return /^[\p{L}\p{N}_.-]{1,60}$/u.test(op) ? op : undefined;
}

/** A Hacker News thread as Defuddle's reader for it expects: names marked `.hnuser` (HN dropped the
 *  class, so every comment read as "[deleted]"), and no site after the title ("(example.com)").
 *  Returns the poster's name. */
function hackerNews(doc: Document, url: string): string | undefined {
  if (!/^https?:\/\/news\.ycombinator\.com\//.test(url)) return undefined;
  for (const a of doc.querySelectorAll('.comhead a[href^="user?id="], .subline a[href^="user?id="]')) a.classList.add("hnuser");
  for (const s of doc.querySelectorAll(".titleline .sitebit")) s.remove();
  // Only a thread has one poster: a list of stories has one per row. HN names are 2 to 15 of these.
  const name = /\/item\?id=/.test(url) ? doc.querySelector(".subline .hnuser")?.textContent?.trim() : undefined;
  return name && /^[\w-]{2,15}$/.test(name) ? name : undefined;
}

/** `min`: the fewest characters a page's article holds before the plain reader is tried instead; a
 *  paste is all content, however short. */
export async function htmlToDoc(html: string, url: string, min = 200): Promise<WebDoc> {
  // A Notion page as the browser drew it (added from the tab, or reimported from its copy).
  const notion = notionMarkdown(html, url);
  if (notion) {
    const title = parseHTML(html).document.querySelector("title")?.textContent?.trim();
    return { title: title || url, markdown: notion };
  }
  const deck = speakerDeck(html, url);
  if (deck) return deck;
  const { document } = parseHTML(html);
  // A forum's thread, rebuilt for the reader; a link partway into one is refused, not read as the page.
  const poster = hackerNews(document as unknown as Document, url) ?? (await discourse(document as unknown as Document, url));
  try {
    videoLinks(document as unknown as Document);
    flatTables(document as unknown as Document);
    footnoteLists(document as unknown as Document);
    wikiMath(document as unknown as Document);
    const h1 = document.querySelector("h1")?.textContent ?? undefined;
    const paper = paperAuthors(document as unknown as Document);
    // linkedom's window is the real one where there is one (the iPhone's web view), and its
    // getComputedStyle throws on a parsed element: without a window Defuddle reads styles as it does on the Mac.
    Object.defineProperty(document, "defaultView", { value: null });
    const r = await quiet(() => Defuddle(document as unknown as Document, url, { markdown: true }));
    const markdown = inlineMath(htmlTables(r.content.trim()));
    if (markdown.length > min) {
      return { title: siteless(r.title, h1) || url, author: paper ?? poster ?? cleanAuthor(r.author), published: cleanDate(r.published), markdown: markdown + "\n" };
    }
  } catch {
    // fall through to Readability
  }
  const r = new Readability(parseHTML(html).document as unknown as Document).parse();
  if (!r?.textContent?.trim()) throw new Error(`Couldn’t find article text on ${new URL(url).host}: it may be built in the browser or need a sign-in. Open it in your browser and ${FROM_TAB}, or paste its text here instead.`);
  const paragraphs = r.textContent
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return { title: r.title || url, author: cleanAuthor(r.byline ?? undefined), markdown: paragraphs.join("\n\n") + "\n" };
}
