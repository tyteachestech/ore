import { strFromU8, strToU8, zipSync } from "fflate";
import { unzip } from "./unzip.ts";
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
  // Mammoth does not expose w:outlineLvl. Map explicit outline levels to its heading styles
  // in a conversion copy only; the original document kept by intake stays byte-for-byte intact.
  const files = unzip(data);
  for (const path of ["word/document.xml", "word/footnotes.xml", "word/endnotes.xml"]) {
    if (!files[path]) continue;
    const xml = strFromU8(files[path]!);
    const headings = xml.replace(/<w:pPr\b[^>]*(?<!\/)>[\s\S]*?<\/w:pPr>/g, (props) => {
      // What a tracked change records after <w:pPrChange> is the paragraph as it was, not as it is.
      const level = props.replace(/<w:pPrChange\b[\s\S]*$/, "").match(/<w:outlineLvl\b[^>]*w:val="([0-8])"/)?.[1];
      if (level === undefined) return props;
      const style = `<w:pStyle w:val="Heading${Math.min(6, Number(level) + 1)}"/>`;
      return props.replace(/<w:pStyle\b[^>]*(?:\/>|>[\s\S]*?<\/w:pStyle>)/g, "").replace(/(<w:pPr\b[^>]*>)/, `$1${style}`);
    });
    if (headings !== xml) files[path] = strToU8(headings);
  }
  // Always the parts unzip() unpacked, never the file itself: mammoth unpacks a part however big it really is
  // (F753), and unzip() stopped each at the size it declared.
  const converted = zipSync(files);
  // Node's build of mammoth takes a Buffer; its browser build (the iPhone app) takes the bytes themselves.
  const input = (typeof Buffer !== "undefined" ? { buffer: Buffer.from(converted) } : { arrayBuffer: converted.buffer.slice(converted.byteOffset, converted.byteOffset + converted.byteLength) }) as { buffer: Buffer };
  // Code paragraphs (Word's and Pandoc's "Source Code" style) keep their lines and indent, fenced (F177);
  // comments come along at the end instead of vanishing (F187).
  const styleMap = ["p[style-name='Source Code'] => pre:separator('\\n')", "p[style-name='HTML Preformatted'] => pre:separator('\\n')", "comment-reference => sup"];
  const { value, messages } = await mammoth.convertToHtml(input, { convertImage, styleMap }).catch((cause: unknown) => {
    throw new Error("That Word file is damaged or only partly downloaded. Download it again, or open it in Word or Pages and save a fresh copy.", { cause });
  });
  // Mammoth reports OMML as ignored. Never save the remaining prose as a complete source.
  if (messages.some((m) => m.message.includes("/officeDocument/2006/math}") && /oMath/.test(m.message)))
    throw new Error("This Word file contains an equation Ore cannot read yet. Open it in Word or Pages and export it as a PDF, then add that copy.");
  const { document } = parseHTML(`<html><body>${value}</body></html>`);
  // A code block reads as one fenced block: its line breaks as lines, inside <code> as turndown fences it.
  for (const pre of document.querySelectorAll("pre")) pre.innerHTML = `<code>${pre.innerHTML.replace(/<br\s*\/?>/g, "\n")}</code>`;
  const body = td.turndown(document.body as unknown as HTMLElement).trim();
  if (!body) throw new Error("This Word file has no text to read.");
  const meta = coreProps(files);
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
  const files = unzip(data);
  const read = (p: string) => (files[p] ? strFromU8(files[p]) : "");
  // Slide order is the presentation's list of slide ids, through its relationships.
  const rels = new Map([...read("ppt/_rels/presentation.xml.rels").matchAll(/<Relationship\b[^>]*>/g)].map((r) => [r[0].match(/Id="([^"]+)"/)?.[1], r[0].match(/Target="([^"]+)"/)?.[1]]));
  const order = [...read("ppt/presentation.xml").matchAll(/<p:sldId\b[^>]*r:id="([^"]+)"/g)].map((m) => {
    const target = rels.get(m[1]!);
    if (!target) throw new Error("This PowerPoint file is missing a listed slide relationship. Download it again or save a fresh copy in PowerPoint.");
    return target;
  });
  const slides: string[] = [];
  let first: string | undefined;
  const paths = order.map((target) => posix.join("ppt", target.replace(/^\/?ppt\//, "")));
  if (paths.some((path) => !files[path]))
    throw new Error("This PowerPoint file is missing a listed slide. Download it again or save a fresh copy in PowerPoint.");
  // Each slide's pictures, in the order they sit on it. A small one on three or more slides is a logo or
  // a footer graphic, not what the slide teaches, so it is left out. A large one that comes again is kept
  // (Tyler, 2026-11-25): a figure shown step by step, or a diagram each slide adds to. Small: under a
  // twentieth of the slide, where logos sit (the sample's is under a hundredth); one of no known size stays.
  const [, slideW, slideH] = read("ppt/presentation.xml").match(/<p:sldSz\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/) ?? [];
  const small = (area: number | undefined) => area !== undefined && !!slideW && area < (Number(slideW) * Number(slideH)) / 20;
  const pictures = paths.map((path) => slidePictures(read(path), read(posix.join(posix.dirname(path), "_rels", posix.basename(path) + ".rels")), posix.dirname(path)));
  const uses = new Map<string, number>();
  for (const media of pictures.map((ps) => new Set(ps.map((p) => p.media)))) for (const m of media) uses.set(m, (uses.get(m) ?? 0) + 1);
  const assets = new Map<string, Asset>();
  for (const [i, path] of paths.entries()) {
    const xml = read(path);
    const shapes = [...xml.matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)].map((s) => s[1]!);
    const isTitle = (s: string) => /<p:ph\b[^>]*type="(?:title|ctrTitle)"/.test(s);
    const title = shapes.filter(isTitle).flatMap(paragraphs).map((p) => p.text).join(" ");
    // Text shapes and native tables share the slide's document order.
    const content = [...xml.matchAll(/<p:(sp|graphicFrame)\b[^>]*>([\s\S]*?)<\/p:\1>/g)].flatMap((m) => {
      if (m[1] === "sp") return isTitle(m[2]!) ? [] : paragraphs(m[2]!).map((p) => `${"  ".repeat(p.level)}- ${p.text}`);
      return [...m[2]!.matchAll(/<a:tbl\b[^>]*>([\s\S]*?)<\/a:tbl>/g)].map((t) => {
        const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const rows = [...t[1]!.matchAll(/<a:tr\b[^>]*>([\s\S]*?)<\/a:tr>/g)].map((r) => {
          const cells = [...r[1]!.matchAll(/<a:tc\b([^>]*)>([\s\S]*?)<\/a:tc>/g)].map((c) => {
            if (/\b(?:hMerge|vMerge)="(?:1|true)"/.test(c[1]!)) return "";
            const width = c[1]!.match(/\bgridSpan="(\d+)"/)?.[1] ?? "1";
            const height = c[1]!.match(/\browSpan="(\d+)"/)?.[1] ?? "1";
            return `<td colspan="${width}" rowspan="${height}">${escape(paragraphs(c[2]!).map((p) => p.text).join(" "))}</td>`;
          });
          return `<tr>${cells.join("")}</tr>`;
        });
        return td.turndown(`<table>${rows.join("")}</table>`);
      });
    });
    const notesRel = read(posix.join(posix.dirname(path), "_rels", posix.basename(path) + ".rels")).match(/Target="([^"]*notesSlide[^"]*)"/)?.[1];
    // A notes page also repeats the slide number; only its body placeholder is the speaker's notes.
    const notes = notesRel
      ? [...read(packageTarget(posix.dirname(path), notesRel)).matchAll(/<p:sp>([\s\S]*?)<\/p:sp>/g)].filter((s) => /<p:ph\b[^>]*type="body"/.test(s[1]!)).flatMap((s) => paragraphs(s[1]!)).map((p) => p.text)
      : [];
    const n = slides.length + 1;
    first ??= title || undefined;
    const parts = [`<!-- slide ${n} -->`, `## ${title || `Slide ${n}`}`];
    if (content.length) parts.push(content.join("\n\n").replace(/^( *- .*)\n\n(?= *- )/gm, "$1\n"));
    for (const pic of pictures[i]!) {
      const ext = IMAGE_EXT[posix.extname(pic.media).slice(1).toLowerCase()];
      const data = files[pic.media];
      if (!ext || !data || (paths.length >= 3 && uses.get(pic.media)! >= 3 && small(pic.area))) continue;
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
function slidePictures(xml: string, rels: string, dir: string): { media: string; alt: string; area?: number }[] {
  const targets = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map((r) => [r[0].match(/Id="([^"]+)"/)?.[1], r[0].match(/Target="([^"]+)"/)?.[1]]));
  return [...xml.matchAll(/<p:pic>([\s\S]*?)<\/p:pic>/g)].flatMap((m) => {
    const target = targets.get(m[1]!.match(/<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1]);
    if (!target || /^https?:/.test(target)) return [];
    const descr = xmlText(m[1]!.match(/<p:cNvPr\b[^>]*descr="([^"]*)"/)?.[1] ?? "").replace(/[\[\]\n]/g, " ").trim();
    const [, w, h] = m[1]!.match(/<a:ext\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/) ?? [];
    return [{ media: packageTarget(dir, target), alt: /^[\w -]+\.(png|jpe?g|gif|svg|emf|wmf|tiff?)$/i.test(descr) ? "" : descr, ...(w ? { area: Number(w) * Number(h) } : {}) }];
  });
}

/** OOXML targets starting with / address the package root, not the referring part's folder. */
function packageTarget(dir: string, target: string): string {
  return posix.normalize(target.startsWith("/") ? target.slice(1) : posix.join(dir, target));
}
