import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { cleanTitle } from "./check.ts";

export interface PdfDoc {
  title?: string;
  author?: string;
  body: string;
}

interface Item {
  str: string;
  x: number;
  y: number;
  /** Where the item ends, left to right. */
  end: number;
  /** Glyph height in points; 0 for rotated text (a margin stamp, an axis label), which is never a heading or title. */
  size: number;
  eol: boolean;
}

interface Line {
  text: string;
  y: number;
  /** Where the line starts: a list item's later lines start past its bullet. */
  x: number;
  /** The tallest glyph height on the line, in points: a heading is set larger than body text. */
  size: number;
}

function toItem(it: TextItem): Item {
  const [a = 0, b = 0, c = 0, d = 0, x = 0, y = 0] = it.transform;
  const size = b || c ? 0 : Math.round(Math.hypot(c, d) * 10) / 10;
  return { str: it.str, x, y, end: x + (it.width ?? 0) * (a < 0 ? -1 : 1), size, eol: it.hasEOL };
}

/** Text set smaller than the body entirely beside the body's column: a textbook's margin notes
 *  (glossary terms, "see also"), which repeat a word of the text next to them. Two columns of body
 *  text are both the body, so only smaller text outside every column goes. */
function dropMargins(items: Item[], body: number): Item[] {
  const lines = items.filter((i) => i.str.trim().length >= 20 && Math.abs(i.size - body) <= body * 0.1);
  if (!body || !lines.length) return items;
  const left = Math.min(...lines.map((i) => i.x));
  const right = Math.max(...lines.map((i) => i.end));
  return items.map((i) => (i.str.trim() && i.size < body * 0.9 && (i.end <= left - 2 || i.x >= right + 2) ? { ...i, str: "" } : i));
}

function pageLines(items: Item[]): Line[] {
  const lines: Line[] = [];
  let cur: Line | null = null;
  for (const it of items) {
    // A line starts where its first kept text is, so a dropped margin note never moves it.
    if (it.str.trim()) {
      cur ??= { text: "", y: it.y, x: it.x, size: 0 };
      cur.size = Math.max(cur.size, it.size);
    }
    if (cur) cur.text += it.str;
    if (it.eol && cur) {
      lines.push(cur);
      cur = null;
    }
  }
  if (cur) lines.push(cur);
  return lines.map((l) => ({ ...l, text: l.text.replace(/\s+/g, " ").trim() })).filter((l) => l.text);
}

/** The usual distance from one line to the next, across the whole document: a short page can't tell. */
function lineGap(pages: Line[][]): number {
  const gaps = pages.flatMap((lines) => lines.slice(1).map((l, i) => lines[i]!.y - l.y)).filter((g) => g > 0).sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)] ?? 12;
}

/** Running heads and feet ("2  Chapter 1  Introduction", "Section 1.1 What Is AI?  3", a bare page
 *  number): the first or last line of a page, set apart from the text, that is a page number, starts
 *  or ends with one, or comes back on other pages. */
function dropRunning(pages: Line[][], body: number, typical: number): Line[][] {
  const key = (l?: Line) => l?.text.replace(/\d+/g, "#").toLowerCase() ?? "";
  const count = (keys: string[]) => keys.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map<string, number>());
  const heads = count(pages.map((p) => key(p[0])));
  const feet = count(pages.map((p) => key(p.at(-1))));
  const number = /^(?:page\s*)?\d{1,4}(?:\s*(?:of|\/)\s*\d+)?$/i;
  // A page number, or a front-matter one ("viii"), at either end of the line.
  const folio = /^(?:\d{1,4}|[ivxlc]{1,6})\s|\s(?:\d{1,4}|[ivxlc]{1,6})$/;
  return pages.map((lines) => {
    let out = lines;
    const [head, next] = out;
    if (head && next && head.text.length <= 80 && head.size <= body * 1.1 && head.y - next.y > typical * 1.5 && (number.test(head.text) || folio.test(head.text) || heads.get(key(head))! > 1)) out = out.slice(1);
    const foot = out.at(-1);
    const prev = out.at(-2);
    if (foot && prev && foot.text.length <= 80 && foot.size <= body * 1.1 && prev.y - foot.y > typical * 1.5 && (number.test(foot.text) || feet.get(key(foot))! > 1)) out = out.slice(0, -1);
    return out;
  });
}

const BULLET = /^[•◦▪‣·●○■□–]\s*/;
/** A section number before a heading's words: "1.1.1 Acting humanly", "2. Methods". */
const NUMBERED = /^\d+(?:\.\d+)*\.?\s+\p{L}/u;
/** A footnote's first line: its number or mark, then its text. */
const FOOTNOTE = /^(?:\d{1,3}|[*†‡§])\s+\S/;

// Join lines into paragraphs: a vertical gap clearly larger than the document's
// typical line spacing (or a jump upwards, i.e. a new column) starts a paragraph.
function paragraphs(lines: Line[], body = 0, typical = 12): string[] {
  const out: string[] = [];
  let para = "";
  let skip = 0;
  /** Where the open list item's text starts, while one is open. */
  let item: number | null = null;
  lines.forEach((l, i) => {
    if (skip > i) return;
    const gap = i === 0 ? 0 : lines[i - 1]!.y - l.y;
    // Lines set clearly larger than the body text, then body text, are a heading (the outline's);
    // a heading that wraps is joined. Large text not followed by body text is a figure's labels.
    // A numbered heading ("1.1.1 Acting humanly") may be set only a little larger, often in bold.
    if (body && (l.size >= body * 1.15 || (l.size >= body * 1.05 && NUMBERED.test(l.text)))) {
      let j = i + 1;
      while (j < lines.length && lines[j]!.size === l.size) j++;
      const text = lines.slice(i, j).map((x) => x.text).join(" ");
      const next = lines[j];
      if (text.length <= 150 && /\p{L}{3}/u.test(text) && !/[.,;:<>]$/.test(text) && (!next || Math.abs(next.size - body) <= body * 0.1)) {
        if (para) out.push(para);
        out.push(`${l.size >= body * 1.6 ? "##" : "###"} ${text}`);
        para = "";
        item = null;
        skip = j;
        return;
      }
    }
    const bullet = BULLET.test(l.text) && l.text.replace(BULLET, "").length > 0;
    const note = body && l.size <= body * 0.85 && FOOTNOTE.test(l.text);
    // A list item goes on while its lines start past its bullet; a line back at the margin ends it.
    const ended = item !== null && l.x < item - 2;
    if (i > 0 && (gap > typical * 1.4 || gap < 0 || bullet || note || ended)) {
      if (para) out.push(para);
      para = "";
      if (!bullet) item = ended || gap > typical * 1.4 || gap < 0 ? null : item;
    }
    const text = bullet ? "- " + l.text.replace(BULLET, "") : l.text;
    if (bullet) item = l.x + 4;
    if (!para) para = text;
    else if (/[a-z]-$/.test(para) && /^[a-z]/.test(text)) para = para.slice(0, -1) + text;
    else para += " " + text;
  });
  if (para) out.push(para);
  return out;
}

/** The size most of the text is set in, by characters. */
function bodySize(pages: Item[][]): number {
  const chars = new Map<number, number>();
  for (const i of pages.flat()) if (i.size) chars.set(i.size, (chars.get(i.size) ?? 0) + i.str.trim().length);
  return [...chars].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
}

/** A chapter opener's label above its name ("CHAPTER 1" over "INTRODUCTION"). */
const LABEL = /^(?:chapter|part|unit|lesson|lecture|module|section)\s+[\w.]+$/i;
/** "INTRODUCTION TO AI" as "Introduction to AI": a word in capitals reads as a word, short ones as an acronym. */
const unshout = (t: string) => (/\p{Ll}/u.test(t) ? t : t.replace(/\p{L}{4,}/gu, (w) => w[0] + w.slice(1).toLowerCase()).replace(/^\p{L}/u, (c) => c.toUpperCase()));

/** Page 1's largest lines, when they read as a title (a file with no title in its metadata). A
 *  chapter label set largest is joined to the name under it: "Chapter 1: Introduction". */
function titleFrom(first: Line[], body: number): string | undefined {
  const top = Math.max(0, ...first.map((l) => l.size));
  if (top < body * 1.15) return undefined;
  const at = first.findIndex((l) => l.size === top);
  const lines = [first[at]!.text];
  for (let i = at + 1; i < first.length && first[i]!.size === top; i++) lines.push(first[i]!.text);
  let t = lines.join(" ").trim();
  const name = LABEL.test(t) ? first.slice(at + lines.length).find((l) => l.size >= body * 1.6) : undefined;
  if (name) t = `${unshout(t)}: ${unshout(name.text)}`;
  return t.length >= 4 && t.length <= 200 ? t : undefined;
}

type PdfDocument = Awaited<ReturnType<typeof getDocument>["promise"]>;

async function pdfMeta(doc: PdfDocument): Promise<{ title?: string; author?: string }> {
  const meta = await doc.getMetadata().catch(() => null);
  const info = (meta?.info ?? {}) as { Title?: string; Author?: string };
  // The Info dictionary's Author, else the XMP creator list many publishers fill instead.
  const xmp = meta?.metadata?.get("dc:creator") as string | string[] | undefined;
  const author = info.Author?.trim() || [xmp ?? []].flat().map((a) => String(a).trim()).filter(Boolean).join(", ");
  return { title: info.Title?.trim() || undefined, author: author || undefined };
}

/** Opens a PDF quietly (pdf.js warns on stdout about any damage it works around), refusing one it
 *  can't open with the next step. */
function openPdf(data: Uint8Array) {
  const task = getDocument({ data: data.slice(), useSystemFonts: true, verbosity: 0 });
  const promise = task.promise.catch((e: Error) => {
    if (e.name === "PasswordException") throw new Error("That PDF is locked with a password. Open it in Preview, enter the password, choose File › Export as PDF, and add the copy.");
    throw new Error("That file isn’t a readable PDF: it may be damaged or only partly downloaded. Download it again, or open it in Preview and choose File › Export as PDF.");
  });
  return { promise, destroy: () => task.destroy() };
}

/** The PDF's author from its metadata alone, without reading its pages. */
export async function pdfAuthor(data: Uint8Array): Promise<string | undefined> {
  const task = openPdf(data);
  try {
    return (await pdfMeta(await task.promise)).author;
  } finally {
    await task.destroy();
  }
}

/** A PDF whose pages are images with no text layer: read with text recognition instead (D96). */
export class ScannedPdf extends Error {
  constructor() {
    super("This PDF is scanned pages with no text.");
  }
}

export async function pdfToDoc(data: Uint8Array): Promise<PdfDoc> {
  const task = openPdf(data);
  const doc = await task.promise;
  const meta = await pdfMeta(doc);
  const items: Item[][] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const tc = await page.getTextContent();
    items.push(tc.items.filter((i): i is TextItem => "str" in i).map(toItem));
  }
  await task.destroy();
  const body = bodySize(items);
  const raw = items.map((p) => pageLines(dropMargins(p, body)));
  const typical = lineGap(raw);
  const lines = dropRunning(raw, body, typical);
  const pages = lines.map((l, i) => `<!-- page ${i + 1} -->\n\n${paragraphs(l, body, typical).join("\n\n")}`);
  const text = pages.join("\n\n") + "\n";
  if (text.replace(/<!-- page \d+ -->/g, "").trim().length < 20) {
    throw new ScannedPdf();
  }
  // A metadata title that is only a file or tool name ("1706", "Microsoft Word - draft.docx") loses to page 1's.
  return { title: cleanTitle(meta.title) ?? titleFrom(lines[0] ?? [], body), author: meta.author, body: text };
}
