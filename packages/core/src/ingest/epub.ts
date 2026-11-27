import { strFromU8, unzipSync } from "fflate";
import { DOMParser, parseHTML } from "linkedom";
import { posix } from "node:path";
import type { Asset } from "../items.ts";
import { assetName } from "./assets.ts";
import { cleanDate, cleanTitle } from "./check.ts";
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
  const html = xhtml.replace(new RegExp(`<(?!(?:${VOID})\\b)([a-zA-Z][\\w:-]*)([^<>]*?)\\s*/>`, "g"), "<$1$2></$1>");
  return parseHTML(html).document as unknown as Document;
}

const kind = (e: Element) => `${e.getAttribute("epub:type") ?? ""} ${e.getAttribute("role") ?? ""}`;
const NOTE = /\b(?:doc-)?(?:foot|end|rear)?note\b/;
const BACKLINK = /\b(?:doc-)?backlink\b/;

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

export function epubToDoc(data: Uint8Array): EpubDoc {
  const files = unzipSync(data);
  const read = (p: string) => {
    const f = files[p];
    if (!f) throw new Error(`EPUB is missing ${p}`);
    return strFromU8(f);
  };
  const opfPath = read("META-INF/container.xml").match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath) throw new Error("EPUB container.xml has no rootfile");
  const opf = new DOMParser().parseFromString(read(opfPath), "text/xml");
  // An element by its name without its prefix: a package may write `<opf:item>` or `<dc:Title>` (deep import pass).
  const all = Array.from(opf.querySelectorAll("*"));
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
  for (const r of Array.from(tags("reference"))) say(kinds, opfPath, r.getAttribute("href"), r.getAttribute("type"));
  for (const e of Array.from(tags("item"))) {
    const file = posix.join(dir, decodeURIComponent(e.getAttribute("href") ?? ""));
    if (!files[file]) continue;
    if (/\bnav\b/.test(e.getAttribute("properties") ?? "")) {
      for (const nav of Array.from(parse(read(file)).querySelectorAll("nav"))) {
        const type = nav.getAttribute("epub:type") ?? "";
        for (const a of Array.from(nav.querySelectorAll("a[href]"))) {
          if (/\blandmarks\b/.test(type)) for (const t of (a.getAttribute("epub:type") ?? "").split(/\s+/)) say(kinds, file, a.getAttribute("href"), t);
          else if (/\btoc\b/.test(type)) say(labels, file, a.getAttribute("href"), a.textContent);
        }
      }
    } else if (e.getAttribute("media-type") === "application/x-dtbncx+xml") {
      const ncx = new DOMParser().parseFromString(read(file), "text/xml");
      for (const point of Array.from(ncx.getElementsByTagName("navPoint"))) say(labels, file, point.getElementsByTagName("content")[0]?.getAttribute("src") ?? null, point.getElementsByTagName("text")[0]?.textContent);
    }
  }
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
  return { title: cleanTitle(text("dc:title")[0], { numbers: true }), author: creators.length ? creators.join(", ") : undefined, published: cleanDate(text("dc:date")[0]), body: chapters.join("\n\n") + "\n", assets: [...assets.values()] };
}
