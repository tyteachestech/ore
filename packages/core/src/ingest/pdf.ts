import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { Asset } from "../items.ts";
import { assetName } from "./assets.ts";
import { cleanTitle } from "./check.ts";
import type { Box, Region } from "./docling.ts";
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
  /** Set in a bold or an italic face, by the font's name. */
  bold?: boolean;
  italic?: boolean;
}

interface Line {
  text: string;
  y: number;
  /** Where the line starts: a list item's later lines start past its bullet. */
  x: number;
  /** The tallest glyph height on the line, in points: a heading is set larger than body text. */
  size: number;
}

function toItem(it: TextItem, font: (name: string) => string): Item {
  const [a = 0, b = 0, c = 0, d = 0, x = 0, y = 0] = it.transform;
  const size = b || c ? 0 : Math.round(Math.hypot(c, d) * 10) / 10;
  return { str: it.str, x, y, end: x + (it.width ?? 0) * (a < 0 ? -1 : 1), size, eol: it.hasEOL, ...faceOf(font(it.fontName)) };
}

/** Math fonts set every variable in italic: that is notation, not emphasis. */
const MATH_FONT = /^(?:cmmi|cmsy|cmex|cmbsy|msam|msbm|eufm|rsfs|stmary|wasy)|math|symbol/i;
const BOLD_FONT = /bold|black|heavy|semibold|demi|[-_](?:bd|blk|medi)|^cm(?:ss)?bx|^sfbx/i;
const ITALIC_FONT = /italic|oblique|ita(?:l)?$|[-_]it(?:[A-Z]|$)|^cmti|^cmsl|^cmssi|^sfti|^sfsl/i;

/** Bold and italic from the font's name ("NimbusRomNo9L-Medi", "Helvetica-BoldOblique", TeX's
 *  "CMBX10" and "CMTI10"), its subset tag ("ABCDEF+") left off. */
function faceOf(font: string): { bold?: boolean; italic?: boolean } {
  const name = font.replace(/^[A-Z]{6}\+/, "");
  if (!name || MATH_FONT.test(name)) return {};
  return { bold: BOLD_FONT.test(name) || undefined, italic: ITALIC_FONT.test(name) || undefined };
}

// Marks kept in the text while lines are joined, written as Markdown once a paragraph is whole:
// bold and italic runs, and a footnote's mark (its label between REF and END).
const B = "\uE000", B_ = "\uE001", I = "\uE002", I_ = "\uE003", REF = "\uE010", END = "\uE011";
/** The text with its marks left out, for every check on what a line says. */
const plain = (s: string) => s.replace(/\uE010[^\uE011]*\uE011/g, "").replace(/[\uE000-\uE003]/g, "");

/** A paragraph's runs as Markdown: one run across a line break or a hyphen stays one. */
function emphasis(s: string): string {
  return s
    .replace(new RegExp(`${I_}${B_}(\\s*)${B}${I}`, "g"), "$1")
    .replace(new RegExp(`${B_}(\\s*)${B}`, "g"), "$1")
    .replace(new RegExp(`${I_}(\\s*)${I}`, "g"), "$1")
    .replace(new RegExp(`${B}(\\s*)${B_}|${I}(\\s*)${I_}`, "g"), "$1$2")
    .replace(/[\uE000\uE001]/g, "**")
    .replace(/[\uE002\uE003]/g, "*");
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
 *  else a footnote's mark after a word ("rational²"), kept apart as REF…END until its note is
 *  found. A footnote's own number, first on its line, stays. */
function raised(cur: Line, it: Item, after: boolean): { text: string; power: boolean } | null {
  const t = it.str.trim();
  const text = plain(cur.text);
  if (!t || !(/^[−+-]?\d[\d.]*$|^[−+-]$/.test(t) || (after && /^[.\d]+$/.test(t))) || !text.trim() || !it.size || it.size >= cur.size * 0.85 || it.y <= cur.y + 1) return null;
  // A mark sits right after a word or its punctuation; a raised number after a space (a fraction's
  // top, "¹⁄₂") is left as it is.
  if (/\s$/.test(text) && !after) return null;
  const power = after || /[−+-]/.test(t) || /\d$/.test(text) || /(?:^|[^\p{L}])\p{L}$/u.test(text);
  return power ? { text: [...t].map((c) => SUPER[c] ?? c).join(""), power } : { text: /^\d{1,3}$/.test(t) ? REF + t + END : "", power };
}

/** An item's text with its bold or italic run marked, spaces kept outside the marks. */
function styled(it: Item): string {
  if (!(it.bold || it.italic) || !/[\p{L}\d]/u.test(it.str)) return it.str;
  const [, lead, core, tail] = it.str.match(/^(\s*)(.*?)(\s*)$/s)!;
  return lead + (it.bold ? B : "") + (it.italic ? I : "") + core + (it.italic ? I_ : "") + (it.bold ? B_ : "") + tail;
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
      up = !!sup?.power;
      if (sup !== null) {
        cur.text += sup.text;
        continue;
      }
      cur.size = Math.max(cur.size, it.size);
    }
    if (cur) cur.text += styled(it);
    if (it.eol && cur) {
      lines.push(cur);
      cur = null;
    }
  }
  if (cur) lines.push(cur);
  return lines.map((l) => ({ ...l, text: l.text.replace(/\s+/g, " ").trim() })).filter((l) => plain(l.text).trim());
}

/** The usual distance from one line to the next, across the whole document: a short page can't tell. */
function lineGap(pages: Line[][]): number {
  // A table or formula Docling read (D123) is one line standing for many, so its gaps don't count.
  const gaps = pages.flatMap((lines) => lines.slice(1).map((l, i) => (isBlock(l.text) || isBlock(lines[i]!.text) ? 0 : lines[i]!.y - l.y))).filter((g) => g > 0).sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)] ?? 12;
}

/** Running heads and feet ("2  Chapter 1  Introduction", "Section 1.1 What Is AI?  3", a bare page
 *  number): the first or last line of a page, set apart from the text, that is a page number, starts
 *  or ends with one, or comes back on other pages. */
function dropRunning(pages: Line[][], body: number, typical: number): Line[][] {
  const key = (l?: Line) => (l ? plain(l.text) : "").replace(/\d+/g, "#").toLowerCase();
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
    const t = (l: Line) => plain(l.text);
    if (head && next && t(head).length <= 80 && head.size <= body * 1.1 && head.y - next.y > typical * 1.5 && (number.test(t(head)) || folio.test(t(head)) || heads.get(key(head))! > 1)) drop.add(head);
    const rest = byY.filter((l) => !drop.has(l));
    const foot = rest.at(-1);
    const prev = rest.at(-2);
    if (foot && prev && t(foot).length <= 80 && foot.size <= body * 1.1 && prev.y - foot.y > typical * 1.5 && (number.test(t(foot)) || feet.get(key(foot))! > 1)) drop.add(foot);
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
  const out: { text: string; note: boolean }[] = [];
  let para = "";
  /** The open paragraph is a footnote: a sentence running onto the next page joins the one above them. */
  let inNote = false;
  const push = () => {
    if (para) out.push({ text: para, note: inNote });
    para = "";
    inNote = false;
  };
  let skip = 0;
  /** Where the open list item's text starts, while one is open. */
  let item: number | null = null;
  lines.forEach((l, i) => {
    if (skip > i) return;
    const gap = i === 0 ? 0 : lines[i - 1]!.y - l.y;
    const line = plain(l.text);
    // A table or formula Docling read stands alone (D123).
    if (isBlock(line)) {
      push();
      out.push({ text: line, note: false });
      item = null;
      return;
    }
    // Lines set clearly larger than the body text, then body text, are a heading (the outline's);
    // a heading that wraps is joined. Large text not followed by body text is a figure's labels.
    // A numbered heading ("1.1.1 Acting humanly") may be set only a little larger, often in bold.
    if (body && (l.size >= body * 1.15 || (l.size >= body * 1.05 && NUMBERED.test(line)))) {
      let j = i + 1;
      while (j < lines.length && lines[j]!.size === l.size) j++;
      const text = lines.slice(i, j).map((x) => plain(x.text)).join(" ");
      const next = lines[j];
      if (text.length <= 150 && /\p{L}{3}/u.test(text) && !/[.,;:<>]$/.test(text) && (!next || Math.abs(next.size - body) <= body * 0.1)) {
        push();
        out.push({ text: `${l.size >= body * 1.6 ? "##" : "###"} ${text}`, note: false });
        item = null;
        skip = j;
        return;
      }
    }
    const bullet = BULLET.test(line) && line.replace(BULLET, "").length > 0;
    const note = !!body && l.size <= body * 0.85 && FOOTNOTE.test(line);
    // A list item goes on while its lines start past its bullet; a line back at the margin ends it.
    const ended = item !== null && l.x < item - 2;
    // A book's paragraph starts with its first line indented: the lines around it start further left,
    // together, and the line before it ends a sentence. A list of references indents an entry's
    // second line instead ("hanging"), so the second line after it must start back at the margin too.
    const [before, after, later] = [lines[i - 1], lines[i + 1], lines[i + 2]];
    const back = (o?: Line) => !!o && !!before && Math.abs(o.x - before.x) <= 2;
    const indent = !!body && item === null && !!before && gap > 0 && l.x - before.x > body * 1.2 && l.x - before.x < body * 4 && /[.!?:”"’)]$/.test(plain(before.text)) && back(after) && (!later || back(later) || later.y > after!.y || after!.y - later.y > typical * 1.4);
    if (i > 0 && (gap > typical * 1.4 || gap < 0 || bullet || note || ended || indent)) {
      push();
      if (!bullet) item = ended || gap > typical * 1.4 || gap < 0 ? null : item;
    }
    const text = bullet ? "- " + l.text.replace(/^([\uE000-\uE003]*)[•◦▪‣·●○■□–]\s*/, "$1") : l.text;
    if (bullet) item = l.x + 4;
    if (!para) inNote = note;
    para = para ? join(para, text, words) : text;
  });
  push();
  return out;
}

/** Words seen inside lines across the document (not first or last on a line, where a break may cut
 *  them): what a word split at a line's end should be joined back into. */
function wordsOf(pages: Line[][]): Set<string> {
  const words = new Set<string>();
  for (const l of pages.flat()) for (const w of plain(l.text).toLowerCase().match(/[\p{L}\d]+(?:-[\p{L}\d]+)*/gu)?.slice(1, -1) ?? []) words.add(w);
  return words;
}

/** Joins a line to the paragraph before it. A word broken at the end with a hyphen ("intel-"
 *  "lectual") loses it, unless the document spells the word with one elsewhere ("fine-tuned"), or
 *  the hyphen follows a capital ("NP-complete"). A word broken with no hyphen in the text at all
 *  (some apps never write it) is joined when the whole word is used elsewhere and the piece is not.
 *  A bold or italic run's marks may sit around the break. */
function join(para: string, text: string, words: Set<string>): string {
  const p = plain(para);
  const left = p.match(/([\p{L}\d]+)-$/u)?.[1];
  const right = plain(text).match(/^[\p{L}\d]+/u)?.[0] ?? "";
  if (left !== undefined && right) {
    if (/[a-z]$/.test(left) && /^[a-z]/.test(right)) {
      const both = `${left}-${right}`.toLowerCase();
      return words.has(both) && !words.has((left + right).toLowerCase()) ? para + text : para.replace(/-([\uE000-\uE003]*)$/, "$1") + text;
    }
    return para + text;
  }
  const piece = p.match(/(?:^|[^\p{L}])(\p{Ll}{2,})$/u)?.[1];
  if (piece && /^\p{Ll}{2,}/u.test(right) && words.has(piece + right) && !words.has(piece)) return para + text;
  return para + " " + text;
}

/** A face most of the text is set in (a deck all in bold) marks nothing: only a face used for some
 *  words is emphasis. */
function plainFaces(pages: Item[][]): void {
  const all = pages.flat();
  const chars = (f: (i: Item) => boolean | undefined) => all.reduce((n, i) => n + (f(i) ? i.str.trim().length : 0), 0);
  const total = chars(() => true);
  const bold = chars((i) => i.bold) > total * 0.4;
  const italic = chars((i) => i.italic) > total * 0.4;
  if (bold || italic) for (const i of all) {
    if (bold) i.bold = undefined;
    if (italic) i.italic = undefined;
  }
}

/** Footnotes as Markdown's: a mark in the text ("rational²") becomes `[^2]` when its page, or the
 *  next one (a paragraph joined across the break), has that note, and the note becomes `[^2]: …`.
 *  A mark with no note found is dropped, and a note no mark points to stays as it was printed. */
function footnotes(paras: { text: string; note: boolean }[][]): (text: string, page: number) => string {
  const label = (p: { text: string; note: boolean }) => (p.note ? plain(p.text).match(/^(\d{1,3})\s/)?.[1] : undefined);
  const defs = paras.map((page) => new Set(page.map(label).filter(Boolean)));
  const refs = paras.map((page) => new Set(page.filter((p) => !p.note).flatMap((p) => [...p.text.matchAll(/\uE010(\d+)\uE011/g)].map((m) => m[1]!))));
  return (text, page) => {
    const n = text.match(/^[\uE000-\uE003]*(\d{1,3})[\uE000-\uE003]*\s+/);
    if (n && defs[page]!.has(n[1]!) && (refs[page]!.has(n[1]!) || refs[page - 1]?.has(n[1]!)) && plain(text).startsWith(n[1]!)) {
      if (paras[page]!.some((p) => p.note && p.text === text)) text = `[^${n[1]}]: ` + text.slice(n[0].length);
    }
    return emphasis(text.replace(/\uE010(\d+)\uE011/g, (_, l: string) => (defs[page]!.has(l) || defs[page + 1]?.has(l) ? `[^${l}]` : "")));
  };
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
  const lines = [plain(first[at]!.text)];
  for (let i = at + 1; i < first.length && first[i]!.size === top; i++) lines.push(plain(first[i]!.text));
  let t = lines.join(" ").trim();
  const name = LABEL.test(t) ? first.slice(at + lines.length).find((l) => l.size >= body * 1.6) : undefined;
  if (name) t = `${unshout(t)}: ${unshout(plain(name.text))}`;
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
  const task = getDocument({ data: data.slice(), useSystemFonts: true, fontExtraProperties: true, verbosity: 0, isOffscreenCanvasSupported: false, isImageDecoderSupported: false });
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

/** A table or formula Docling found (D123), held in the text as BLOCK…BLOCK_ until the page is put together. */
const BLOCK = "\uE020", BLOCK_ = "\uE021";
const isBlock = (t: string) => new RegExp(`^${BLOCK}\\d+${BLOCK_}$`).test(t);

const inside = (i: Item, b: Box) => {
  const x = (i.x + i.end) / 2;
  const y = i.y + (i.size || 8) / 3;
  return x >= b.l - 2 && x <= b.r + 2 && y >= b.b - 2 && y <= b.t + 2;
};

/** A page's items with each region's text taken out and one BLOCK item put where it started, and
 *  the Markdown each block stands for: a table built cell by cell from pdf.js's own reading of the
 *  text in each cell's box (its powers and bold kept), Docling's where pdf.js finds none; a formula as
 *  Docling's LaTeX. */
function swapRegions(items: Item[], regions: Region[], blocks: string[]): Item[] {
  let out = items;
  for (const r of regions) {
    const at = out.findIndex((i) => i.str.trim() && inside(i, r.box));
    if (at < 0) continue;
    const md = r.kind === "formula" ? `$$\n${r.latex}\n$$` : table(r, out.filter((i) => i.str.trim() && inside(i, r.box)));
    if (!md) continue;
    const mark: Item = { str: BLOCK + blocks.length + BLOCK_, x: r.box.l, y: r.box.t, end: r.box.r, size: 0, eol: true };
    blocks.push(md);
    const kept = out.filter((i, n) => n < at || !(i.str.trim() && inside(i, r.box)));
    if (at > 0) kept[at - 1] = { ...kept[at - 1]!, eol: true };
    out = [...kept.slice(0, at), mark, ...kept.slice(at)];
  }
  return out;
}

function table(r: Extract<Region, { kind: "table" }>, items: Item[]): string {
  const grid = Array.from({ length: r.rows }, () => Array.from({ length: r.cols }, () => ""));
  for (const c of r.cells) {
    if (c.row >= r.rows || c.col >= r.cols) continue;
    // A cell's text may wrap: a step down to the next line ends one, a raised power doesn't.
    const its = items.filter((i) => inside(i, c.box));
    const own = pageLines(its.map((i, n) => ({ ...i, eol: i.eol || (!!its[n + 1] && its[n + 1]!.y < i.y - (i.size || 8) * 0.6) })))
      .map((l) => l.text)
      .join(" ");
    const text = emphasis(own.replace(/\uE010[^\uE011]*\uE011/g, "")).trim() || c.text;
    grid[c.row]![c.col] = text.replace(/\|/g, "\\|").replace(/\s+/g, " ");
  }
  const head = Math.max(0, r.cells.findIndex((c) => c.header) >= 0 ? Math.max(...r.cells.filter((c) => c.header).map((c) => c.row + c.rows - 1)) : 0);
  // Markdown has one header row: a header set over two rows reads as one, its parts joined.
  const top = grid.slice(0, head + 1).reduce((a, row) => a.map((t, i) => [t, row[i]].filter(Boolean).join(" ")), grid[0]!.map(() => ""));
  // A header row is bold already: its own bold marks would only repeat that.
  const rows = [top.map((t) => t.replace(/^\*\*(.*)\*\*$/, "$1")), ...grid.slice(head + 1)].filter((row) => row.some(Boolean));
  if (rows.length < 2) return "";
  const line = (row: string[]) => `| ${row.join(" | ")} |`;
  return [line(rows[0]!), line(rows[0]!.map(() => "---")), ...rows.slice(1).map(line)].join("\n");
}

export async function pdfToDoc(data: Uint8Array, regions: Region[] = []): Promise<PdfDoc> {
  const task = openPdf(data);
  const doc = await task.promise;
  const meta = await pdfMeta(doc);
  const items: Item[][] = [];
  const figures: Asset[][] = [];
  const seen = new Map<string, number>();
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const tc = await page.getTextContent();
    // A figure that won't decode never costs the text. Reading the figures loads the page's fonts,
    // whose names say which text is bold or italic.
    const figs = (await pageFigures(page).catch(() => [])).map((f) => png(f.width, f.height, f.rgba)).filter((d) => d.length <= MAX_FIGURE).map((d) => ({ name: assetName(d, "png"), data: d }));
    const font = (id: string) => {
      try {
        return String((page.commonObjs.has(id) && (page.commonObjs.get(id) as { name?: string })?.name) || "");
      } catch {
        return "";
      }
    };
    items.push(tc.items.filter((i): i is TextItem => "str" in i).map((i) => toItem(i, font)));
    for (const name of new Set(figs.map((f) => f.name))) seen.set(name, (seen.get(name) ?? 0) + 1);
    figures.push(figs);
  }
  await task.destroy();
  // On three or more pages it is a logo or a header band, not a figure.
  const kept = figures.map((f) => f.filter((a) => (seen.get(a.name) ?? 0) < 3));
  const assets = [...new Map(kept.flat().slice(0, MAX_FIGURES).map((a) => [a.name, a])).values()];
  const body = bodySize(items);
  plainFaces(items);
  const blocks: string[] = [];
  const raw = items.map((p, i) => pageLines(swapRegions(dropMargins(p, body), regions.filter((r) => r.page === i + 1), blocks)));
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
    if (!last || !first || first.note || /^(?:#|- )/.test(last) || /^(?:#|- )/.test(first.text) || isBlock(last) || isBlock(first.text)) return;
    const end = plain(last);
    if (/-$/.test(end) || (!/[.!?:;”"’)\]]$/.test(end) && /^\p{Ll}/u.test(plain(first.text)))) {
      page[at] = { text: join(last, first.text, words), note: false };
      next.shift();
    }
  });
  const shown = new Set(assets.map((a) => a.name));
  const notes = footnotes(paras);
  const pages = paras.map((p, i) => `<!-- page ${i + 1} -->\n\n${[...p.map((x) => (isBlock(x.text) ? blocks[Number(x.text.slice(1, -1))]! : notes(x.text, i))), ...kept[i]!.filter((a) => shown.has(a.name)).map((a) => `![](assets/${a.name})`)].join("\n\n")}`);
  const text = pages.join("\n\n") + "\n";
  if (text.replace(/<!-- page \d+ -->|!\[\]\(assets\/[^)]+\)/g, "").trim().length < 20) {
    throw new ScannedPdf();
  }
  // A metadata title that is only a file or tool name ("1706", "Microsoft Word - draft.docx") loses to page 1's.
  return { title: cleanTitle(meta.title) ?? titleFrom(lines[0] ?? [], body), author: meta.author, body: text, assets };
}
