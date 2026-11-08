import { strFromU8, unzipSync } from "fflate";
import { parseHTML } from "linkedom";
import { posix } from "node:path";
import type { Asset } from "../items.ts";
import { assetName } from "./assets.ts";
import { cleanTitle, fileAuthor } from "./check.ts";
import { td } from "./markdown.ts";

// Word and PowerPoint files (and Google Docs and Slides, exported as them). A .docx goes through
// mammoth (BSD-2) to HTML, then Markdown; a .pptx is read slide by slide from its XML: each slide's
// title, its text and its speaker notes, under `<!-- slide N -->` markers.

export interface OfficeDoc {
  title?: string;
  author?: string;
  body: string;
  /** Images the document shows, to save as `assets/<name>` (D96). */
  assets?: Asset[];
}

export const xmlText = (s: string) =>
  s.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

/** Title and author from docProps/core.xml, which Word, PowerPoint and Excel files all carry. */
export function coreProps(files: Record<string, Uint8Array>): { title?: string; author?: string } {
  const core = files["docProps/core.xml"] ? strFromU8(files["docProps/core.xml"]) : "";
  const tag = (t: string) => xmlText(core.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`))?.[1] ?? "").trim() || undefined;
  // A tool's or a template's default name is not the author, nor Word's "Document1" the title.
  return { title: cleanTitle(tag("dc:title")), author: fileAuthor(tag("dc:creator")) };
}

export async function docxToDoc(data: Uint8Array): Promise<OfficeDoc> {
  const mammoth = await import("mammoth");
  // Images are saved beside the source, never inlined as data URLs.
  const assets = new Map<string, Asset>();
  const convertImage = mammoth.images.imgElement(async (image) => {
    const ext = ({ "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/svg+xml": "svg", "image/webp": "webp" } as Record<string, string>)[image.contentType];
    if (!ext) return { src: "" };
    const bytes = new Uint8Array(await image.readAsArrayBuffer());
    const name = assetName(bytes, ext);
    assets.set(name, { name, data: bytes });
    return { src: `assets/${name}` };
  });
  const { value } = await mammoth.convertToHtml({ buffer: Buffer.from(data) }, { convertImage });
  const { document } = parseHTML(`<html><body>${value}</body></html>`);
  const body = td.turndown(document.body as unknown as HTMLElement).trim();
  if (!body) throw new Error("This Word file has no text to read.");
  const meta = coreProps(unzipSync(data));
  return { ...meta, title: meta.title ?? body.match(/^#+\s+(.+)$/m)?.[1]?.trim(), body: body + "\n", assets: [...assets.values()] };
}

/** The text paragraphs of a slide or notes XML, in order, with list levels as indented bullets. */
function paragraphs(xml: string): { text: string; level: number }[] {
  const out: { text: string; level: number }[] = [];
  for (const m of xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>|<a:p\s[^>]*>([\s\S]*?)<\/a:p>/g)) {
    const p = m[0];
    const text = [...p.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => xmlText(t[1]!)).join("").replace(/\s+/g, " ").trim();
    if (text) out.push({ text, level: Number(p.match(/<a:pPr[^>]*\blvl="(\d)"/)?.[1] ?? 0) });
  }
  return out;
}

export function pptxToDoc(data: Uint8Array): OfficeDoc {
  const files = unzipSync(data);
  const read = (p: string) => (files[p] ? strFromU8(files[p]) : "");
  // Slide order is the presentation's list of slide ids, through its relationships.
  const rels = new Map([...read("ppt/_rels/presentation.xml.rels").matchAll(/<Relationship\b[^>]*>/g)].map((r) => [r[0].match(/Id="([^"]+)"/)?.[1], r[0].match(/Target="([^"]+)"/)?.[1]]));
  const order = [...read("ppt/presentation.xml").matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"/g)].map((m) => rels.get(m[1]!)).filter(Boolean) as string[];
  const slides: string[] = [];
  let first: string | undefined;
  const paths = order.map((target) => posix.join("ppt", target.replace(/^\/?ppt\//, "")));
  // Each slide's pictures, in the order they sit on it. One on three or more slides is a logo or a
  // footer graphic, not what the slide teaches, so it is left out.
  const pictures = paths.map((path) => slidePictures(read(path), read(posix.join(posix.dirname(path), "_rels", posix.basename(path) + ".rels")), posix.dirname(path)));
  const uses = new Map<string, number>();
  for (const media of pictures.map((ps) => new Set(ps.map((p) => p.media)))) for (const m of media) uses.set(m, (uses.get(m) ?? 0) + 1);
  const assets = new Map<string, Asset>();
  for (const [i, path] of paths.entries()) {
    const xml = read(path);
    const shapes = [...xml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)].map((s) => s[1]!);
    const isTitle = (s: string) => /<p:ph\b[^>]*type="(?:title|ctrTitle)"/.test(s);
    const title = shapes.filter(isTitle).flatMap(paragraphs).map((p) => p.text).join(" ");
    const text = shapes.filter((s) => !isTitle(s)).flatMap(paragraphs);
    const notesRel = read(posix.join(posix.dirname(path), "_rels", posix.basename(path) + ".rels")).match(/Target="([^"]*notesSlide[^"]*)"/)?.[1];
    // A notes page also repeats the slide number; only its body placeholder is the speaker's notes.
    const notes = notesRel
      ? [...read(posix.normalize(posix.join(posix.dirname(path), notesRel))).matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)].filter((s) => /<p:ph\b[^>]*type="body"/.test(s[1]!)).flatMap((s) => paragraphs(s[1]!)).map((p) => p.text)
      : [];
    const n = slides.length + 1;
    first ??= title || undefined;
    const parts = [`<!-- slide ${n} -->`, `## ${title || `Slide ${n}`}`];
    if (text.length) parts.push(text.map((p) => `${"  ".repeat(p.level)}- ${p.text}`).join("\n"));
    for (const pic of pictures[i]!) {
      const ext = IMAGE_EXT[posix.extname(pic.media).slice(1).toLowerCase()];
      const data = files[pic.media];
      if (!ext || !data || (paths.length >= 3 && uses.get(pic.media)! >= 3)) continue;
      const name = assetName(data, ext);
      assets.set(name, { name, data });
      parts.push(`![${pic.alt}](assets/${name})`);
    }
    if (notes.length) parts.push(`> **Speaker notes:** ${notes.join(" ")}`);
    slides.push(parts.join("\n\n"));
  }
  if (!slides.length) throw new Error("This PowerPoint file has no slides to read.");
  const meta = coreProps(files);
  return { ...meta, title: meta.title ?? first, body: slides.join("\n\n") + "\n", assets: [...assets.values()] };
}

/** Picture types a browser shows; a Windows metafile (emf, wmf) or a TIFF isn't one, so it is skipped. */
const IMAGE_EXT: Record<string, string> = { png: "png", jpg: "jpg", jpeg: "jpg", gif: "gif", svg: "svg", webp: "webp" };

/** A slide's pictures (`<p:pic>`) in order: the media file each embeds, and its alt text unless that
 *  is only a file name ("image.png", which PowerPoint writes by default). */
function slidePictures(xml: string, rels: string, dir: string): { media: string; alt: string }[] {
  const targets = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map((r) => [r[0].match(/Id="([^"]+)"/)?.[1], r[0].match(/Target="([^"]+)"/)?.[1]]));
  return [...xml.matchAll(/<p:pic>([\s\S]*?)<\/p:pic>/g)].flatMap((m) => {
    const target = targets.get(m[1]!.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1]);
    if (!target || /^https?:/.test(target)) return [];
    const descr = xmlText(m[1]!.match(/<p:cNvPr\b[^>]*descr="([^"]*)"/)?.[1] ?? "").replace(/[\[\]\n]/g, " ").trim();
    return [{ media: posix.normalize(posix.join(dir, target)), alt: /^[\w -]+\.(png|jpe?g|gif|svg|emf|wmf|tiff?)$/i.test(descr) ? "" : descr }];
  });
}
