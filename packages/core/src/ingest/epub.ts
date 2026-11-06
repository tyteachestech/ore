import { strFromU8, unzipSync } from "fflate";
import { DOMParser, parseHTML } from "linkedom";
import { posix } from "node:path";
import type { Asset } from "../items.ts";
import { assetName } from "./assets.ts";
import { cleanTitle } from "./check.ts";
import { td } from "./markdown.ts";

export interface EpubDoc {
  title?: string;
  author?: string;
  body: string;
  /** The book's illustrations the text shows, to save as `assets/<name>` (D96). */
  assets: Asset[];
}

const IMAGE_EXT: Record<string, string> = { png: "png", jpg: "jpg", jpeg: "jpg", gif: "gif", webp: "webp", svg: "svg" };

const VOID = "area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr";

/** A chapter as Markdown, its images pointed at saved copies; `image` saves one by its path in the book. */
function chapterMarkdown(xhtml: string, image: (src: string) => string | undefined): string {
  // XHTML self-closing non-void tags (<a id="x"/>) would swallow content under an HTML parser.
  const html = xhtml.replace(new RegExp(`<(?!(?:${VOID})\\b)([a-zA-Z][\\w:-]*)([^<>]*?)\\s*/>`, "g"), "<$1$2></$1>");
  const { document } = parseHTML(html);
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
  return td.turndown(document.body as unknown as HTMLElement).trim();
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
  for (const ref of Array.from(opf.getElementsByTagName("itemref"))) {
    const item = manifest.get(ref.getAttribute("idref"));
    // The book's own table of contents (EPUB 3 nav document) is not a chapter to read.
    if (!item || !/html/.test(item.type) || item.nav) continue;
    const path = posix.join(dir, decodeURIComponent(item.href.split("#")[0]!));
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
    const md = chapterMarkdown(read(path), image);
    // A page with only an image (the cover, a title plate) is not a chapter to read.
    if (!md.replace(/!\[[^\]]*\]\([^)]*\)/g, "").trim()) continue;
    for (const [k, v] of used) assets.set(k, v);
    if (md) chapters.push(`<!-- chapter ${chapters.length + 1} -->\n\n${md}`);
  }
  if (!chapters.length) throw new Error("EPUB has no readable text (DRM-protected?)");
  const creators = text("dc:creator");
  return { title: cleanTitle(text("dc:title")[0], { numbers: true }), author: creators.length ? creators.join(", ") : undefined, body: chapters.join("\n\n") + "\n", assets: [...assets.values()] };
}
