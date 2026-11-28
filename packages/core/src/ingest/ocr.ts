import { join } from "node:path";
import { lineBreakSpace } from "./check.ts";
import { run, swiftHelper } from "./swift.ts";

// Text recognition (D96 phase 3): a scanned PDF or an image read with Apple's Vision framework,
// through a small Swift helper compiled on first use, then laid out as Markdown paragraphs here.

export interface OcrLine {
  t: string;
  /** Box as fractions of the page, y from the top. */
  x: number;
  y: number;
  w: number;
  h: number;
}
export type OcrPage = { lines: OcrLine[] };

/** The text on each page of a PDF, or in an image, as Vision reads it. Mac only. */
export async function recognize(path: string, pages?: number[]): Promise<OcrPage[]> {
  // ORE_OCR names a stand-in helper (tests); both paths have the same recovery message.
  if (!process.env.ORE_OCR && process.platform !== "darwin") throw new Error("Reading scanned pages works on a Mac only. Copy the text and paste it here instead.");
  try {
    const helper = process.env.ORE_OCR ?? await swiftHelper("ocr");
    return (JSON.parse(await run(helper, [path, ...(pages?.map(String) ?? [])])) as { pages: OcrPage[] }).pages;
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new Error(`Text recognition failed: ${reason}. Export a fresh PDF or image and add that copy, or paste the text you need.`, { cause });
  }
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

/** A page's lines as Markdown: lines join into paragraphs, a gap or a jump to a new column starts
 *  the next one, a short line set clearly larger is a heading, and a word broken across lines is whole. */
export function ocrMarkdown(page: OcrPage): string {
  const lines = page.lines.filter((l) => l.t.trim());
  if (!lines.length) return "";
  const h = median(lines.map((l) => l.h));
  const out: string[] = [];
  let para = "";
  const flush = () => {
    if (para) out.push(para);
    para = "";
  };
  lines.forEach((l, i) => {
    const text = l.t.replace(/\s+/g, " ").trim();
    if (l.h > h * 1.35 && text.length < 90 && !/[.,;:]$/.test(text)) {
      flush();
      out.push(`## ${text}`);
      return;
    }
    const prev = lines[i - 1];
    const gap = prev ? l.y - (prev.y + prev.h) : 0;
    if (prev && (gap > h * 0.7 || l.y < prev.y - h * 0.5 || Math.abs(l.x - prev.x) > 0.25)) flush();
    para = !para ? text : /\p{L}-$/u.test(para) && /^\p{Ll}/u.test(text) ? para.slice(0, -1) + text : para + lineBreakSpace(para, text) + text;
  });
  flush();
  return out.join("\n\n");
}

/** Markdown from each page, or from selected PDF pages by their one-based numbers. */
export async function recognizedPages(data: Uint8Array, ext: string, pages?: number[], read = recognize): Promise<string[]> {
  const { mkdtempSync, rmSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(join(tmpdir(), "ore-ocr-"));
  try {
    const file = join(dir, `scan.${ext}`);
    writeFileSync(file, data);
    return (await read(file, pages)).map(ocrMarkdown);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A scanned PDF or an image as a body of text: one `<!-- page N -->` section per PDF page. Throws
 *  with the next step when there is no text to find. */
export async function scannedText(data: Uint8Array, ext: string, read = recognize): Promise<{ title?: string; body: string }> {
  const pages = await recognizedPages(data, ext, undefined, read);
  const text = pages.join("\n\n");
  if (text.replace(/\s/g, "").length < 20)
    throw new Error(ext === "pdf" ? "Found no text on this PDF’s pages: they may be photos or drawings. Add a version with text, or paste what you need." : "Found no text in that image. Add a screenshot with text, or paste what you need.");
  const body = ext === "pdf" ? pages.map((p, i) => `<!-- page ${i + 1} -->\n\n${p}`).join("\n\n") : text;
  const title = text.match(/^## (.+)$/m)?.[1] ?? text.split("\n")[0]!.slice(0, 80);
  return { title: title.length > 3 ? title : undefined, body: body + "\n" };
}
