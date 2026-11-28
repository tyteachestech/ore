import { strFromU8 } from "fflate";
import { unzip } from "./unzip.ts";
import { DOMParser, parseHTML } from "linkedom";
import { posix } from "node:path";
import type { Asset } from "../items.ts";
import { assetName } from "./assets.ts";
import { authorList, cleanDate, cleanTitle } from "./check.ts";
import { BACK_START, FRONT_END, backPages, frontPages, type PageFacts } from "./front-matter.ts";
import { td } from "./markdown.ts";

export interface EpubDoc {
  title?: string;
  author?: string;
  published?: string;
  body: string;
  /** The book's illustrations the text shows, to save as `assets/<name>` (D96). */
  assets: Asset[];
}

const IMAGE_EXT: Record<string, string> = { png: "png", jpg: "jpg", jpeg: "jpg", gif: "gif", webp: "webp", svg: "svg" };

const VOID = "area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr";

/** A chapter file parsed as HTML. */
function parse(xhtml: string): Document {
  // XHTML self-closing non-void tags (<a id="x"/>) would swallow content under an HTML parser.
  // A tab the typesetting tool escaped twice (`&amp;#9;`) at a line's start, around its list number, shows as
  // "&#9;" in every reader: it is a space (corpus run 2026-11-28). In the text ("write &amp;#9; for a tab") it stays.
  const html = xhtml.replace(/(>[ \t]*)&amp;#x?9;((?:[\da-z]{1,3}[.)]|[•·–-])?)(?:&amp;#x?9;)?/gi, "$1$2 ").replace(new RegExp(`<(?!(?:${VOID})\\b)([a-zA-Z][\\w:-]*)([^<>]*?)\\s*/>`, "g"), "<$1$2></$1>");
  return parseHTML(html).document as unknown as Document;
}

const kind = (e: Element) => `${e.getAttribute("epub:type") ?? ""} ${e.getAttribute("role") ?? ""}`;
const NOTE = /\b(?:doc-)?(?:foot|end|rear)?note\b/;
const BACKLINK = /\b(?:doc-)?backlink\b/;
const BACK_TEXT = /^(?:go to note reference in text|back to (?:the )?(?:text|note reference)|return to (?:the )?text|↩\uFE0E?|⮌)$/i;

/** A chapter as Markdown, its images pointed at saved copies; `image` saves one by its path in the book
 *  (undefined: not one to keep, null: the book names it but doesn't hold it).
 *  A link to a note (`note` finds it, in this file or the book's endnotes) becomes a Markdown footnote,
 *  numbered from `next`, and the note is written under the chapter. `pictures`: the page holds only pictures,
 *  saved or missing (a cover, a plate), and no text. */
function chapterMarkdown(document: Document, image: (src: string) => string | null | undefined, note: (href: string) => Element | undefined, next: () => number): { md: string; pictures: boolean } {
  // An SVG wrapper around a cover or plate (<svg><image xlink:href>) becomes a plain image.
  for (const svg of Array.from(document.querySelectorAll("svg"))) {
    const href = svg.querySelector("image")?.getAttribute("xlink:href") ?? svg.querySelector("image")?.getAttribute("href");
    if (!href) continue;
    const img = document.createElement("img");
    img.setAttribute("src", href);
    svg.replaceWith(img);
  }
  // A picture the book names but doesn't hold is a marked gap with its alt text, so the text that points at it
  // isn't left pointing at nothing (D351).
  const gaps: string[] = [];
  for (const img of Array.from(document.querySelectorAll("img"))) {
    const saved = image(img.getAttribute("src") ?? "");
    if (saved) img.setAttribute("src", saved);
    else if (saved === null) {
      const alt = (img.getAttribute("alt") ?? "").replace(/\s+/g, " ").trim();
      const p = document.createElement("p");
      p.textContent = `OREGAP${gaps.push(alt ? `[missing figure: ${alt}]` : "[missing figure]") - 1}OREGAP`;
      img.replaceWith(p);
    } else img.remove();
  }
  // A link back from a note to the words it explains is the book's way around, not text: Penguin Random House's
  // "GO TO NOTE REFERENCE IN TEXT" under each of a book's 391 notes (corpus run 2026-11-28).
  for (const a of Array.from(document.querySelectorAll("a[href*='#']"))) {
    if (!BACK_TEXT.test(a.textContent?.trim() ?? "") && !BACKLINK.test(kind(a))) continue;
    const block = a.parentElement;
    a.remove();
    if (block && block !== document.body && !block.textContent?.trim() && !block.querySelector("img")) block.remove();
  }
  // A heading inside a figure is its caption (O'Reilly sets "Figure 1-5. …" as an <h6>: 56 in one book filled its
  // outline, corpus run 2026-11-28): it stays under the picture as a line of text.
  for (const h of Array.from(document.querySelectorAll("figure h1, figure h2, figure h3, figure h4, figure h5, figure h6, div.figure h1, div.figure h2, div.figure h3, div.figure h4, div.figure h5, div.figure h6"))) {
    const p = document.createElement("p");
    p.append(...Array.from(h.childNodes));
    h.replaceWith(p);
  }
  const notes: string[] = [];
  for (const a of Array.from(document.querySelectorAll("a[href]"))) {
    const target = note(a.getAttribute("href")!);
    if (!target || !target.isConnected) continue;
    const n = next();
    for (const back of Array.from(target.querySelectorAll("a"))) if (BACKLINK.test(kind(back))) back.remove();
    const text = td.turndown(target as unknown as HTMLElement).trim().replace(/^\\?\[?\d+\\?\]?\\?[.)]?\s+/, "").replace(/\s*\n\s*/g, " ");
    target.remove();
    // The mark is the link, or the <sup> around it.
    const sup = a.parentElement?.tagName === "SUP" && a.parentElement.textContent?.trim() === a.textContent?.trim() ? a.parentElement : a;
    sup.replaceWith(document.createTextNode(`ORENOTE${n}ORENOTE`));
    notes.push(`[^${n}]: ${text}`);
  }
  // A notes section left with only its heading is not text to read.
  for (const box of Array.from(document.querySelectorAll("section, aside, div, ol"))) if (/\b(?:doc-)?(?:foot|end|rear)notes\b/.test(kind(box)) && !box.querySelector("li, p, aside")) box.remove();
  const raw = td.turndown(document.body as unknown as HTMLElement).trim();
  const pictures = !notes.length && !raw.replace(/!\[[^\]]*\]\([^)]*\)|OREGAP\d+OREGAP/g, "").trim();
  const md = raw.replace(/ORENOTE(\d+)ORENOTE/g, "[^$1]").replace(/OREGAP(\d+)OREGAP/g, (_, i) => gaps[Number(i)]!);
  return { md: notes.length ? `${md}\n\n${notes.join("\n\n")}` : md, pictures };
}

/** Each class rule's font size in the book's CSS (`h1.name` or `.name` → em), and whether it is set not bold. */
function classSizes(sheets: string[]): Map<string, { size: number; plain: boolean }> {
  const sizes = new Map<string, { size: number; plain: boolean }>();
  for (const css of sheets) {
    for (const [, sel, body] of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const size = /(?:^|;)\s*font-size\s*:\s*([\d.]+)(em|rem|%)/i.exec(body!);
      if (!size) continue;
      const plain = /(?:^|;)\s*font-weight\s*:\s*(?:normal|400|lighter)\b/i.test(body!);
      for (const one of sel!.split(",")) {
        const m = /^\s*([a-z][a-z0-9]*)?\.([\w-]+)\s*$/i.exec(one);
        if (m) sizes.set(`${m[1]?.toLowerCase() ?? ""}.${m[2]}`, { size: Number(size[1]) / (size[2] === "%" ? 100 : 1), plain });
      }
    }
  }
  return sizes;
}

const squash = (s: string | null | undefined) => (s ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
const BLOCK = "p, div, h1, h2, h3, h4, h5, h6, li, blockquote, section, header";

/** A book that sets its chapter titles as styled paragraphs (`<p class="ct">Book 10</p>`), not headings,
 *  came in with no outline at all: 29 of 184 books in Tyler's library (corpus run 2026-11-28). The book's own
 *  table of contents names each title and where it is, so the line there that says that title becomes a
 *  heading, as deep as the entry sits in the contents. Only a line that says the entry's words (or most of
 *  them: "1" and "Turning" under "1 Turning") is changed, and only where no heading already says it. */
function outlineFromToc(docs: Map<string, Document>, toc: { file: string; id?: string; label: string; depth: number }[]): void {
  for (const e of toc) {
    const page = docs.get(e.file);
    const body = page?.body;
    if (!page || !body) continue;
    const want = squash(e.label);
    if (want.length < 1 || want.length > 200) continue;
    if (Array.from(body.querySelectorAll("h1, h2, h3, h4, h5, h6")).some((h) => squash(h.textContent) === want || (squash(h.textContent).length > 2 && want.includes(squash(h.textContent))))) continue;
    // Where the entry points: its anchor, or the page's start; then the next few lines from there, each a
    // block with text and no block inside it.
    const anchor = e.id ? page.getElementById(e.id) : null;
    if (e.id && !anchor) continue;
    const lines = Array.from(body.querySelectorAll(BLOCK)).filter((b) => !b.querySelector(BLOCK) && b.textContent?.trim());
    const from = anchor ? lines.findIndex((b) => b === anchor || b.contains(anchor) || !!(anchor.compareDocumentPosition(b) & 4)) : 0;
    if (from < 0) continue;
    const leaves = lines.slice(from, from + 4);
    const hit = leaves.find((b) => squash(b.textContent) === want) ?? leaves.find((b) => {
      const t = squash(b.textContent);
      return t.length >= 3 && want.includes(t) && t.length >= want.length * 0.5;
    });
    if (!hit || hit.closest("nav, table, li")) continue;
    const h = page.createElement(`h${Math.min(6, e.depth)}`);
    h.append(...Array.from(hit.childNodes));
    hit.replaceWith(h);
  }
}

export function epubToDoc(data: Uint8Array): EpubDoc {
  const files = unzip(data);
  const read = (p: string) => {
    const f = files[p];
    if (!f) throw new Error(`EPUB is missing ${p}`);
    return strFromU8(f);
  };
  const opfPath = read("META-INF/container.xml").match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath) throw new Error("EPUB container.xml has no rootfile");
  const opf = new DOMParser().parseFromString(read(opfPath), "text/xml");
  // An element by its name without its prefix: a package may write `<opf:item>` or `<dc:Title>` (deep import pass).
  const all = Array.from(opf.querySelectorAll("*")) as Element[];
  const tags = (tag: string) => {
    const local = tag.replace(/^.*:/, "").toLowerCase();
    return all.filter((e) => e.nodeName.replace(/^.*:/, "").toLowerCase() === local);
  };
  const text = (tag: string) =>
    Array.from(tags(tag)).map((e) => e.textContent?.replace(/\s+/g, " ").trim()).filter(Boolean);
  const manifest = new Map(
    Array.from(tags("item")).map((e) => [e.getAttribute("id"), { href: e.getAttribute("href") ?? "", type: e.getAttribute("media-type") ?? "", nav: /\bnav\b/.test(e.getAttribute("properties") ?? "") }]),
  );
  const dir = posix.dirname(opfPath);
  const chapters: string[] = [];
  const assets = new Map<string, Asset>();
  // The book's own table of contents (EPUB 3 nav document) is not a chapter to read.
  const spine = Array.from(tags("itemref"))
    .map((ref) => {
      const id = ref.getAttribute("idref");
      const item = manifest.get(id);
      if (!id || !item?.href) throw new Error(`This EPUB has an unresolved chapter (${id || "unnamed"}). Download the book again or export a fresh EPUB, then add it again.`);
      return item;
    })
    // A fixed-layout book may list a page as its picture: that page is the picture.
    .filter((item) => (/html/.test(item.type) && !item.nav) || /^image\//.test(item.type))
    .map((item) => ({ path: posix.join(dir, decodeURIComponent(item.href.split("#")[0]!)), picture: /^image\//.test(item.type) }));
  const docs = new Map(spine.map(({ path, picture }) => [path, parse(picture ? `<html><body><img src="${encodeURIComponent(posix.basename(path))}"/></body></html>` : read(path))]));
  // A heading the book's own styles set well under its text's size and not bold is a line set apart (a program's
  // lines in Tyler's AI book), not a heading: it read as a run of big titles and filled the outline. A small heading
  // near the text's size stays one (that book's section heads are 0.896em over 0.92em text).
  const sizes = classSizes(Array.from(manifest.values()).filter((i) => i.type === "text/css").map((i) => files[posix.join(dir, decodeURIComponent(i.href))]).flatMap((f) => (f ? [strFromU8(f)] : [])));
  if (sizes.size) {
    const styleOf = (e: Element) => Array.from(e.classList).map((c) => sizes.get(`${e.tagName.toLowerCase()}.${c}`) ?? sizes.get(`.${c}`)).find(Boolean);
    // The text's size: the size of the paragraph style the book uses most.
    const used = new Map<number, number>();
    for (const page of docs.values()) for (const para of Array.from(page.querySelectorAll("p"))) {
      const size = styleOf(para)?.size ?? 1;
      used.set(size, (used.get(size) ?? 0) + 1);
    }
    const text = [...used].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 1;
    for (const page of docs.values()) {
      const paras = Array.from(page.querySelectorAll("p")).filter((x) => x.textContent?.trim());
      for (const h of Array.from(page.querySelectorAll("h1, h2, h3, h4, h5, h6"))) {
        const style = styleOf(h);
        if (!style?.plain || style.size >= text * 0.85) continue;
        // A page's opening heading names the page, however small the book sets it (its endnotes' heads).
        if (!paras.some((x) => x.compareDocumentPosition(h) & 4 /* h follows x */)) continue;
        const p = page.createElement("p");
        p.append(...Array.from(h.childNodes));
        h.replaceWith(p);
      }
    }
  }
  // The cover picture as the book names it: EPUB 3's cover-image, EPUB 2's <meta name="cover">, or a picture
  // the book calls cover (cover.jpg, id="cover", coverImage), as many older books do: cover as a word of its
  // name, not inside one (discovery.png, recovery-curve.png). Known by path, held in the book or not.
  const coverId = Array.from(tags("meta")).find((m) => m.getAttribute("name") === "cover")?.getAttribute("content");
  const coverWord = (name: string) => /(?:^|[^a-z])cover(?![a-z])/i.test(name.replace(/([a-z])([A-Z])/g, "$1 $2"));
  const covers = new Set(
    Array.from(tags("item"))
      .filter((e) => /\bcover-image\b/.test(e.getAttribute("properties") ?? "") || (coverId && e.getAttribute("id") === coverId) || (/^image\//.test(e.getAttribute("media-type") ?? "") && coverWord(`${e.getAttribute("id")} ${posix.basename(e.getAttribute("href") ?? "")}`)))
      .map((e) => posix.normalize(posix.join(dir, decodeURIComponent(e.getAttribute("href") ?? "")))),
  );
  // What the book says each page is: its guide and landmarks (kinds), and its table of contents (names).
  const kinds = new Map<string, string[]>();
  const labels = new Map<string, string[]>();
  const say = (map: Map<string, string[]>, from: string, href: string | null, what: string | null | undefined) => {
    const word = what?.replace(/\s+/g, " ").trim();
    if (!href || !word || /^[a-z]+:/i.test(href)) return;
    let file: string;
    try {
      file = posix.normalize(posix.join(posix.dirname(from), decodeURIComponent(href.split("#")[0]!)));
    } catch {
      return;
    }
    map.set(file, [...(map.get(file) ?? []), word]);
  };
  // The table of contents in order, each entry with the page and the place on it it points at.
  const toc: { file: string; id?: string; label: string; depth: number }[] = [];
  const entry = (from: string, href: string | null, what: string | null | undefined, depth: number) => {
    const label = what?.replace(/\s+/g, " ").trim();
    if (!href || !label || /^[a-z]+:/i.test(href)) return;
    try {
      const [path, id] = href.split("#");
      toc.push({ file: path ? posix.normalize(posix.join(posix.dirname(from), decodeURIComponent(path))) : from, id: id ? decodeURIComponent(id) : undefined, label, depth: Math.max(1, depth) });
    } catch {}
  };
  for (const r of Array.from(tags("reference"))) say(kinds, opfPath, r.getAttribute("href"), r.getAttribute("type"));
  for (const e of Array.from(tags("item"))) {
    const file = posix.join(dir, decodeURIComponent(e.getAttribute("href") ?? ""));
    if (!files[file]) continue;
    if (/\bnav\b/.test(e.getAttribute("properties") ?? "")) {
      for (const nav of Array.from(parse(read(file)).querySelectorAll("nav"))) {
        const type = nav.getAttribute("epub:type") ?? "";
        for (const a of Array.from(nav.querySelectorAll("a[href]"))) {
          if (/\blandmarks\b/.test(type)) for (const t of (a.getAttribute("epub:type") ?? "").split(/\s+/)) say(kinds, file, a.getAttribute("href"), t);
          else if (/\btoc\b/.test(type)) {
            say(labels, file, a.getAttribute("href"), a.textContent);
            let depth = 0;
            for (let up: Element | null = a; up && up !== nav; up = up.parentElement) if (up.tagName === "OL" || up.tagName === "UL") depth++;
            entry(file, a.getAttribute("href"), a.textContent, depth);
          }
        }
      }
    } else if (e.getAttribute("media-type") === "application/x-dtbncx+xml") {
      const ncx = new DOMParser().parseFromString(read(file), "text/xml");
      for (const point of Array.from(ncx.getElementsByTagName("navPoint"))) {
        const src = point.getElementsByTagName("content")[0]?.getAttribute("src") ?? null;
        const label = point.getElementsByTagName("text")[0]?.textContent;
        say(labels, file, src, label);
        let depth = 0;
        for (let up: Element | null = point; up; up = up.parentElement) if (up.nodeName.replace(/^.*:/, "") === "navPoint") depth++;
        entry(file, src, label, depth);
      }
    }
  }
  // A book whose own table of contents is missing or a stub (calibre's one "Start" entry) still has its
  // contents page: the page that links to the most other chapters stands in for it.
  if (toc.length < 3) {
    let best: { from: string; links: Element[] } | undefined;
    for (const [from, page] of docs) {
      const links = Array.from(page.querySelectorAll("a[href]")).filter((a) => {
        const href = a.getAttribute("href") ?? "";
        if (/^[a-z]+:/i.test(href) || !href.split("#")[0]) return false;
        try {
          return docs.has(posix.normalize(posix.join(posix.dirname(from), decodeURIComponent(href.split("#")[0]!))));
        } catch {
          return false;
        }
      });
      if (links.length >= 5 && links.length > (best?.links.length ?? 0)) best = { from, links };
    }
    for (const a of best?.links ?? []) entry(best!.from, a.getAttribute("href"), a.textContent, 1);
  }
  outlineFromToc(docs, toc);
  const facts: PageFacts[] = [];
  let notes = 0;
  // Picture pages before the first page of words: a title plate or two is not the book, but a run of them
  // (a comic, a picture book) is: past PLATES they come in as the book's first pages (deep import pass).
  const PLATES = 2;
  let leading: { md: string; used: Map<string, Asset> }[] = [];
  const keepLeading = () => {
    if (leading.length > PLATES) {
      for (const page of leading) for (const [k, v] of page.used) assets.set(k, v);
      facts.push({ types: [], labels: [], text: "", links: 0, linkWords: 0 });
      chapters.push(`<!-- chapter ${chapters.length + 1} -->\n\n${leading.map((p) => p.md).join("\n\n")}`);
    }
    leading = [];
  };
  for (const { path } of spine) {
    const image = (src: string) => {
      const file = posix.normalize(posix.join(posix.dirname(path), decodeURIComponent(src.split("#")[0]!)));
      const ext = IMAGE_EXT[posix.extname(file).slice(1).toLowerCase()];
      const data = files[file];
      if (!ext || /^[a-z]+:/i.test(src)) return undefined;
      seen.add(file);
      if (!data) return null;
      const name = assetName(data, ext);
      used.set(name, { name, data });
      return `assets/${name}`;
    };
    const used = new Map<string, Asset>();
    const seen = new Set<string>(); // the pictures this page names, held or missing
    const note = (href: string) => {
      const [file, id] = href.split("#");
      if (!id || /^[a-z]+:/i.test(href)) return undefined;
      const doc = docs.get(file ? posix.normalize(posix.join(posix.dirname(path), decodeURIComponent(file))) : path);
      const target = doc?.getElementById(decodeURIComponent(id));
      return target && NOTE.test(kind(target)) ? target : undefined;
    };
    const page = docs.get(path)!;
    // The page's own kind, from its body and the blocks that hold it: a heading marked "title" names the heading, not the page.
    const own = Array.from(page.querySelectorAll(":is(body, section, article, div, nav, aside)[epub\\:type], :is(body, section, article, div, nav, aside)[role]")).flatMap((e) => kind(e).replace(/\bdoc-/g, "").split(/\s+/).filter(Boolean));
    const anchors = Array.from(page.querySelectorAll("a[href]"));
    const fact: PageFacts = { types: [...own, ...(kinds.get(path) ?? [])], labels: labels.get(path) ?? [], text: page.body?.textContent ?? "", links: anchors.length, linkWords: anchors.reduce((n, a) => n + (a.textContent?.match(/\S+/g) ?? []).length, 0) };
    const { md, pictures } = chapterMarkdown(page, image, note, () => ++notes);
    if (pictures) {
      // A page with only an image before the text begins (the cover, a title plate), or one the book marks
      // as its cover, is not part of the book to read. One after the text has begun is an illustration on a
      // page of its own: it stays where it is, under the chapter it follows, with no recall of its own
      // (F569). A picture missing from the book is such a page too, its gap in its place.
      const cover = /\bcover\b/.test(kind(page.body ?? page.documentElement)) || [...seen].some((f) => covers.has(f));
      if (!md || cover) continue;
      if (!chapters.length) {
        leading.push({ md, used });
        continue;
      }
      for (const [k, v] of used) assets.set(k, v);
      chapters[chapters.length - 1] += `\n\n${md}`;
      continue;
    }
    if (leading.length) keepLeading();
    for (const [k, v] of used) assets.set(k, v);
    facts.push({ ...fact, heading: md.match(/^#{1,6}[ \t]+(.+)$/m)?.[1]?.replace(/[*_`\\]/g, "") });
    chapters.push(`<!-- chapter ${chapters.length + 1} -->\n\n${md}`);
  }
  if (!chapters.length) {
    // A book of only pictures, however few, is its pictures.
    leading = leading.length ? [...leading, ...Array(PLATES).fill({ md: "", used: new Map() })] : leading;
    keepLeading();
    if (chapters.length) chapters[0] = chapters[0]!.replace(/\n\n+$/, "");
  }
  if (!chapters.length) throw new Error("This EPUB has no text Ore can read: it may be locked with DRM, or its pages may be drawn as pictures Ore can't see. If you bought it, export a DRM-free copy from the store's app or add the book's PDF instead.");
  const creators = text("dc:creator");
  // The publisher's pages before the text stay, in their place; the mark after them lets the reader fold them.
  const title = text("dc:title")[0];
  const names = [title, title?.split(/[:\u2014(]/)[0], ...creators].filter((s): s is string => !!s);
  const front = frontPages(facts, names);
  const back = backPages(facts, names, front);
  if (back < chapters.length) chapters[back] = `${BACK_START}\n\n${chapters[back]}`;
  if (front) chapters[front] = `${FRONT_END}\n\n${chapters[front]}`;
  return { title: cleanTitle(text("dc:title")[0], { numbers: true }), author: authorList(creators), published: cleanDate(text("dc:date")[0]), body: chapters.join("\n\n") + "\n", assets: [...assets.values()] };
}
