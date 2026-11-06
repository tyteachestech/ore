import { strFromU8, unzipSync } from "fflate";
import { DOMParser, parseHTML } from "linkedom";
import { posix } from "node:path";
import type { Asset } from "../items.ts";
import { assetName } from "./assets.ts";
import { cleanDate, cleanTitle } from "./check.ts";
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
const NOTE = /\b(?:doc-)?(?:foot|end|rear)note\b/;
const BACKLINK = /\b(?:doc-)?backlink\b/;

/** A chapter as Markdown, its images pointed at saved copies; `image` saves one by its path in the book.
 *  A link to a note (`note` finds it, in this file or the book's endnotes) becomes a Markdown footnote,
 *  numbered from `next`, and the note is written under the chapter. */
function chapterMarkdown(document: Document, image: (src: string) => string | undefined, note: (href: string) => Element | undefined, next: () => number): string {
  // An SVG wrapper around a cover or plate (<svg><image xlink:href>) becomes a plain image.
  for (const svg of Array.from(document.querySelectorAll("svg"))) {
    const href = svg.querySelector("image")?.getAttribute("xlink:href") ?? svg.querySelector("image")?.getAttribute("href");
    if (!href) continue;
    const img = document.createElement("img");
    img.setAttribute("src", href);
    svg.replaceWith(img);
  }
  for (const img of Array.from(document.querySelectorAll("img"))) {
    const saved = image(img.getAttribute("src") ?? "");
    if (saved) img.setAttribute("src", saved);
    else img.remove();
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
  const md = td.turndown(document.body as unknown as HTMLElement).trim().replace(/ORENOTE(\d+)ORENOTE/g, "[^$1]");
  return notes.length ? `${md}\n\n${notes.join("\n\n")}` : md;
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
  const text = (tag: string) =>
    Array.from(opf.getElementsByTagName(tag)).map((e) => e.textContent?.replace(/\s+/g, " ").trim()).filter(Boolean);
  const manifest = new Map(
    Array.from(opf.getElementsByTagName("item")).map((e) => [e.getAttribute("id"), { href: e.getAttribute("href") ?? "", type: e.getAttribute("media-type") ?? "", nav: /\bnav\b/.test(e.getAttribute("properties") ?? "") }]),
  );
  const dir = posix.dirname(opfPath);
  const chapters: string[] = [];
  const assets = new Map<string, Asset>();
  // The book's own table of contents (EPUB 3 nav document) is not a chapter to read.
  const spine = Array.from(opf.getElementsByTagName("itemref"))
    .map((ref) => manifest.get(ref.getAttribute("idref")))
    .filter((item) => item && /html/.test(item.type) && !item.nav)
    .map((item) => posix.join(dir, decodeURIComponent(item!.href.split("#")[0]!)));
  const docs = new Map(spine.map((path) => [path, parse(read(path))]));
  let notes = 0;
  for (const path of spine) {
    const image = (src: string) => {
      const file = posix.normalize(posix.join(posix.dirname(path), decodeURIComponent(src.split("#")[0]!)));
      const ext = IMAGE_EXT[posix.extname(file).slice(1).toLowerCase()];
      const data = files[file];
      if (!ext || !data || /^[a-z]+:/i.test(src)) return undefined;
      const name = assetName(data, ext);
      used.set(name, { name, data });
      return `assets/${name}`;
    };
    const used = new Map<string, Asset>();
    const note = (href: string) => {
      const [file, id] = href.split("#");
      if (!id || /^[a-z]+:/i.test(href)) return undefined;
      const doc = docs.get(file ? posix.normalize(posix.join(posix.dirname(path), decodeURIComponent(file))) : path);
      const target = doc?.getElementById(decodeURIComponent(id));
      return target && NOTE.test(kind(target)) ? target : undefined;
    };
    const md = chapterMarkdown(docs.get(path)!, image, note, () => ++notes);
    // A page with only an image (the cover, a title plate) is not a chapter to read.
    if (!md.replace(/!\[[^\]]*\]\([^)]*\)/g, "").trim()) continue;
    for (const [k, v] of used) assets.set(k, v);
    if (md) chapters.push(`<!-- chapter ${chapters.length + 1} -->\n\n${md}`);
  }
  if (!chapters.length) throw new Error("EPUB has no readable text (DRM-protected?)");
  const creators = text("dc:creator");
  return { title: cleanTitle(text("dc:title")[0], { numbers: true }), author: creators.length ? creators.join(", ") : undefined, published: cleanDate(text("dc:date")[0]), body: chapters.join("\n\n") + "\n", assets: [...assets.values()] };
}
