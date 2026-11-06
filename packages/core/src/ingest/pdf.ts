import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { Asset } from "../items.ts";
import { assetName } from "./assets.ts";
import { cleanTitle } from "./check.ts";
import { pageFigures, png } from "./pdf-figures.ts";

export interface PdfDoc {
  title?: string;
  author?: string;
  body: string;
  /** The figures its pages show, saved as `assets/<name>` (D122). */
  assets?: Asset[];
}

/** Figures kept per PDF, and the size of one past which it is left out. */
const MAX_FIGURES = 80;
const MAX_FIGURE = 5 * 1024 * 1024;

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

const SUPER: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "−": "⁻", "-": "⁻", "+": "⁺" };

/** Small digits raised above the line: a power after a number or a lone letter ("10¹¹", "d²"),
 *  else a footnote's mark after a word ("rational²"), which is dropped. A footnote's own number,
 *  first on its line, stays. */
function raised(cur: Line, it: Item, after: boolean): string | null {
  const t = it.str.trim();
  if (!t || !(/^[−+-]?\d[\d.]*$|^[−+-]$/.test(t) || (after && /^[.\d]+$/.test(t))) || !cur.text.trim() || !it.size || it.size >= cur.size * 0.85 || it.y <= cur.y + 1) return null;
  // A mark sits right after a word or its punctuation; a raised number after a space (a fraction's
  // top, "¹⁄₂") is left as it is.
  if (/\s$/.test(cur.text) && !after) return null;
  const power = after || /[−+-]/.test(t) || /\d$/.test(cur.text) || /(?:^|[^\p{L}])\p{L}$/u.test(cur.text);
  return power ? [...t].map((c) => SUPER[c] ?? c).join("") : "";
}

function pageLines(items: Item[]): Line[] {
  const lines: Line[] = [];
  let cur: Line | null = null;
  /** The last text added was a raised power, so a sign or digit right after it belongs to it. */
  let up = false;
  for (const it of items) {
    // A line starts where its first kept text is, so a dropped margin note never moves it.
    if (it.str.trim()) {
      cur ??= { text: "", y: it.y, x: it.x, size: 0 };
      const sup = raised(cur, it, up);
      up = !!sup;
      if (sup !== null) {
        cur.text += sup;
        continue;
      }
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
  const top = (p: Line[]) => p.reduce<Line | undefined>((a, l) => (!a || l.y > a.y ? l : a), undefined);
  const bottom = (p: Line[]) => p.reduce<Line | undefined>((a, l) => (!a || l.y < a.y ? l : a), undefined);
  const heads = count(pages.map((p) => key(top(p))));
  const feet = count(pages.map((p) => key(bottom(p))));
  const number = /^(?:page\s*)?\d{1,4}(?:\s*(?:of|\/)\s*\d+)?$/i;
  // A page number, or a front-matter one ("viii"), at either end of the line.
  const folio = /^(?:\d{1,4}|[ivxlc]{1,6})\s|\s(?:\d{1,4}|[ivxlc]{1,6})$/;
  return pages.map((lines) => {
    // Highest and lowest on the page, whatever order the file writes them in (Chromium and many
    // print-to-PDF tools write the head and the page number after the body).
    const byY = [...lines].sort((a, b) => b.y - a.y);
    const drop = new Set<Line>();
    const [head, next] = byY;
    if (head && next && head.text.length <= 80 && head.size <= body * 1.1 && head.y - next.y > typical * 1.5 && (number.test(head.text) || folio.test(head.text) || heads.get(key(head))! > 1)) drop.add(head);
    const rest = byY.filter((l) => !drop.has(l));
    const foot = rest.at(-1);
    const prev = rest.at(-2);
    if (foot && prev && foot.text.length <= 80 && foot.size <= body * 1.1 && prev.y - foot.y > typical * 1.5 && (number.test(foot.text) || feet.get(key(foot))! > 1)) drop.add(foot);
    return lines.filter((l) => !drop.has(l));
  });
}

const BULLET = /^[•◦▪‣·●○■□–]\s*/;
/** A section number before a heading's words: "1.1.1 Acting humanly", "2. Methods". */
const NUMBERED = /^\d+(?:\.\d+)*\.?\s+\p{L}/u;
/** A footnote's first line: its number or mark, then its text. */
const FOOTNOTE = /^(?:\d{1,3}|[*†‡§])\s+\S/;

// Join lines into paragraphs: a vertical gap clearly larger than the document's
// typical line spacing (or a jump upwards, i.e. a new column) starts a paragraph.
function paragraphs(lines: Line[], body = 0, typical = 12, words = new Set<string>()): { text: string; note: boolean }[] {
  const out: string[] = [];
  /** Paragraphs that are footnotes: a sentence running onto the next page joins the one above them. */
  const notes = new Set<string>();
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
    para = para ? join(para, text, words) : text;
    if (note) notes.add(para);
  });
  if (para) out.push(para);
  return out.map((p) => ({ text: p, note: notes.has(p) }));
}

/** Words seen inside lines across the document (not first or last on a line, where a break may cut
 *  them): what a word split at a line's end should be joined back into. */
function wordsOf(pages: Line[][]): Set<string> {
  const words = new Set<string>();
  for (const l of pages.flat()) for (const w of l.text.toLowerCase().match(/[\p{L}\d]+(?:-[\p{L}\d]+)*/gu)?.slice(1, -1) ?? []) words.add(w);
  return words;
}

/** Joins a line to the paragraph before it. A word broken at the end with a hyphen ("intel-"
 *  "lectual") loses it, unless the document spells the word with one elsewhere ("fine-tuned"), or
 *  the hyphen follows a capital ("NP-complete"). A word broken with no hyphen in the text at all
 *  (some apps never write it) is joined when the whole word is used elsewhere and the piece is not. */
function join(para: string, text: string, words: Set<string>): string {
  const left = para.match(/([\p{L}\d]+)-$/u)?.[1];
  const right = text.match(/^[\p{L}\d]+/u)?.[0] ?? "";
  if (left !== undefined && right) {
    if (/[a-z]$/.test(left) && /^[a-z]/.test(right)) {
      const both = `${left}-${right}`.toLowerCase();
      return words.has(both) && !words.has((left + right).toLowerCase()) ? para + text : para.slice(0, -1) + text;
    }
    return para + text;
  }
  const piece = para.match(/(?:^|[^\p{L}])(\p{Ll}{2,})$/u)?.[1];
  if (piece && /^\p{Ll}{2,}/u.test(right) && words.has(piece + right) && !words.has(piece)) return para + text;
  return para + " " + text;
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
  const task = getDocument({ data: data.slice(), useSystemFonts: true, verbosity: 0, isOffscreenCanvasSupported: false, isImageDecoderSupported: false });
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
  const figures: Asset[][] = [];
  const seen = new Map<string, number>();
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const tc = await page.getTextContent();
    items.push(tc.items.filter((i): i is TextItem => "str" in i).map(toItem));
    // A figure that won't decode never costs the text.
    const figs = (await pageFigures(page).catch(() => [])).map((f) => png(f.width, f.height, f.rgba)).filter((d) => d.length <= MAX_FIGURE).map((d) => ({ name: assetName(d, "png"), data: d }));
    for (const name of new Set(figs.map((f) => f.name))) seen.set(name, (seen.get(name) ?? 0) + 1);
    figures.push(figs);
  }
  await task.destroy();
  // On three or more pages it is a logo or a header band, not a figure.
  const kept = figures.map((f) => f.filter((a) => (seen.get(a.name) ?? 0) < 3));
  const assets = [...new Map(kept.flat().slice(0, MAX_FIGURES).map((a) => [a.name, a])).values()];
  const body = bodySize(items);
  const raw = items.map((p) => pageLines(dropMargins(p, body)));
  const typical = lineGap(raw);
  const lines = dropRunning(raw, body, typical);
  const words = wordsOf(lines);
  const paras = lines.map((l) => paragraphs(l, body, typical, words));
  // A paragraph that runs onto the next page ends there: its last sentence is finished on the page
  // it starts on, above that page's footnotes.
  paras.forEach((page, i) => {
    const next = paras[i + 1];
    const at = page.findLastIndex((p) => !p.note);
    const last = page[at]?.text;
    const first = next?.[0];
    if (!last || !first || first.note || /^(?:#|- )/.test(last) || /^(?:#|- )/.test(first.text)) return;
    if (/-$/.test(last) || (!/[.!?:;”"’)\]]$/.test(last) && /^\p{Ll}/u.test(first.text))) {
      page[at] = { text: join(last, first.text, words), note: false };
      next.shift();
    }
  });
  const shown = new Set(assets.map((a) => a.name));
  const pages = paras.map((p, i) => `<!-- page ${i + 1} -->\n\n${[...p.map((x) => x.text), ...kept[i]!.filter((a) => shown.has(a.name)).map((a) => `![](assets/${a.name})`)].join("\n\n")}`);
  const text = pages.join("\n\n") + "\n";
  if (text.replace(/<!-- page \d+ -->|!\[\]\(assets\/[^)]+\)/g, "").trim().length < 20) {
    throw new ScannedPdf();
  }
  // A metadata title that is only a file or tool name ("1706", "Microsoft Word - draft.docx") loses to page 1's.
  return { title: cleanTitle(meta.title) ?? titleFrom(lines[0] ?? [], body), author: meta.author, body: text, assets };
}
