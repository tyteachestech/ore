import katex from "katex";
import { parseHTML } from "linkedom";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import * as pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { Asset } from "../items.ts";
import { assetName } from "./assets.ts";
import { pdfData } from "./pdf-data.ts";
import { cleanTitle, fileAuthor, lineBreakSpace } from "./check.ts";
import { recognizedPages } from "./ocr.ts";
import type { Box, Region } from "./paddle.ts";
import { pageFigures, png } from "./pdf-figures.ts";

export interface PdfDoc {
  title?: string;
  author?: string;
  body: string;
  /** The figures its pages show, saved as `assets/<name>` (D122). */
  assets?: Asset[];
  /** Tables or formulas pdf.js reads only as lines of text, which the page reader would read properly (D125). */
  structure?: Structure[];
}

export type Structure = "tables" | "formulas";

/** Figures kept per PDF, and the size of one past which it is left out. */
// pdf.js runs its worker in-process here; handing it the module up front means it never has to find
// pdf.worker.mjs on disk, which a compiled `ore` (the app's bundled CLI) doesn't have.
(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfWorker;

const MAX_FIGURES = 80;
/** Stands where a scanned page's words couldn't be read. */
export const SCAN_UNREAD = "*This page is a scan, and its words couldn’t be read here. Open the original to see it.*";
const MAX_FIGURE = 5 * 1024 * 1024;
/** Where a figure past the first MAX_FIGURES was: marked, as a missing one is (D351), not left out unsaid (deep import pass, pdfs-06). */
const PAST_FIGURES = `[missing figure: Ore keeps a PDF's first ${MAX_FIGURES} figures; this one is in the original]`;

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
  /** Set in a math font (TeX's cmmi, Cambria Math): a formula's letters and symbols. */
  math?: boolean;
  /** Set in a typewriter face (Courier, TeX's cmtt): code. */
  mono?: boolean;
  /** Which heading the page reader found this text in (D346), counted from 1; 0 on a
   *  page it read and found this text no heading on. Unset on a page it has not read, where the
   *  text's size decides. */
  head?: number;
}

interface Line {
  text: string;
  y: number;
  /** Where the line starts: a list item's later lines start past its bullet. */
  x: number;
  /** The tallest glyph height on the line, in points: a heading is set larger than body text. */
  size: number;
  /** Every word on the line is set in a typewriter face: a line of code, as written (`raw`, its
   *  spaces kept), with the width of one of its letters for the indent. */
  code?: { raw: string; cw: number };
  /** The page reader's word on whether this line is a heading, and which (Item.head). */
  head?: number;
}

function toItem(it: TextItem, font: (name: string) => string): Item {
  const [a = 0, b = 0, c = 0, d = 0, x = 0, y = 0] = it.transform;
  // Turned text (a margin stamp, an axis label) has no size; a scan's text layer, tilted a degree or two with
  // the page, is the text's own size, or the page's text reads as a margin to drop (deep import pass, pdfs-01).
  const tilted = Math.abs(Math.atan2(b, a)) > 0.1 || Math.abs(Math.atan2(-c, d)) > 0.1 || a <= 0 || d <= 0;
  const size = (b || c) && tilted ? 0 : Math.round(Math.hypot(c, d) * 10) / 10;
  // Arabic set in its shaped letters (how word processors write it) reads as plain Arabic letters,
  // which search, highlights and the tutor can match.
  const str = it.str.replace(/[\uFB50-\uFDFF\uFE70-\uFEFE]+/g, (s) => s.normalize("NFKC"));
  return { str, x, y, end: x + (it.width ?? 0) * (a < 0 ? -1 : 1), size, eol: it.hasEOL, ...faceOf(font(it.fontName)) };
}

/** Math fonts set every variable in italic: that is notation, not emphasis. */
const MATH_FONT = /^(?:cmmi|cmsy|cmex|cmbsy|msam|msbm|eufm|rsfs|stmary|wasy)|math|symbol/i;
const BOLD_FONT = /bold|black|heavy|semibold|demi|[-_](?:bd|blk|medi)|^cm(?:ss)?bx|^sfbx/i;
/** Typewriter faces: Courier, Consolas, Menlo, anything "Mono" (the Monotype foundry's aside), and TeX's (cmtt, sftt, lmtt, Nimbus Mono). */
const MONO_FONT = /mono(?!type)|monaco|courier|consolas|menlo|inconsolata|typewriter|^(?:cm|sf|lm|ec|cmsl)tt|^nimbusmon/i;
const ITALIC_FONT = /italic|oblique|ita(?:l)?$|[-_]it(?:[A-Z]|$)|^cmti|^cmsl|^cmssi|^sfti|^sfsl/i;

/** Bold and italic from the font's name ("NimbusRomNo9L-Medi", "Helvetica-BoldOblique", TeX's
 *  "CMBX10" and "CMTI10"), its subset tag ("ABCDEF+") left off. */
function faceOf(font: string): { bold?: boolean; italic?: boolean; math?: boolean; mono?: boolean } {
  const name = font.replace(/^[A-Z]{6}\+/, "");
  if (!name) return {};
  if (MATH_FONT.test(name)) return { math: true };
  if (MONO_FONT.test(name)) return { mono: true };
  return { bold: BOLD_FONT.test(name) || undefined, italic: ITALIC_FONT.test(name) || undefined };
}

// Marks kept in the text while lines are joined, written as Markdown once a paragraph is whole:
// bold, italic and typewriter runs, and a footnote's mark (its label between REF and END).
const B = "\uE000", B_ = "\uE001", I = "\uE002", I_ = "\uE003", C = "\uE004", C_ = "\uE005", REF = "\uE010", END = "\uE011";
/** The text with its marks left out, for every check on what a line says. */
const plain = (s: string) => s.replace(/\uE010[^\uE011]*\uE011/g, "").replace(/[\uE000-\uE005]/g, "");

/** A paragraph's runs as Markdown: one run across a line break or a hyphen stays one. */
function emphasis(s: string): string {
  return s
    .replace(new RegExp(`${C_}(\\s*)${C}`, "g"), "$1")
    .replace(/[\uE004\uE005]/g, "`")
    .replace(new RegExp(`${I_}${B_}(\\s*)${B}${I}`, "g"), "$1")
    .replace(new RegExp(`${B_}(\\s*)${B}`, "g"), "$1")
    .replace(new RegExp(`${I_}(\\s*)${I}`, "g"), "$1")
    .replace(new RegExp(`${B}(\\s*)${B_}|${I}(\\s*)${I_}`, "g"), "$1$2")
    .replace(/[\uE000\uE001]/g, "**")
    .replace(/[\uE002\uE003]/g, "*");
}

/** Text set smaller than the body entirely beside the body's column: a textbook's margin notes,
 *  taken out of the lines they sit beside. Two columns of body text are both the body, so only
 *  smaller text outside every column goes. A note that defines its term (a psychology or biology
 *  textbook's margin glossary, D319) is kept, in its order, for the page's end; one
 *  that only repeats a word of the text beside it (AIMA's margin terms) or is too short to say
 *  anything ("see p. 12") says nothing the text doesn't, and goes. */
function splitMargins(items: Item[], body: number): { items: Item[]; notes: string[] } {
  const lines = items.filter((i) => i.str.trim().length >= 20 && Math.abs(i.size - body) <= body * 0.1);
  if (!body || !lines.length) return { items, notes: [] };
  const left = Math.min(...lines.map((i) => i.x));
  const right = Math.max(...lines.map((i) => i.end));
  const beside = (i: Item) => !!i.str.trim() && i.size < body * 0.9 && (i.end <= left - 2 || i.x >= right + 2);
  // A note's lines follow each other a line apart on one side; a gap or the other side starts the next.
  const groups: Item[][] = [];
  let last: Item | undefined;
  for (const i of items.filter((i) => beside(i) && i.size)) {
    const same = last && i.x >= right === last.x >= right && Math.abs(i.y - last.y) <= last.size * 1.4;
    // A small table's rows set further apart than a note's lines, each starting where the one above does, are one
    // note: alone, a row of three words ("Year Bend Shift") read as too short to say anything (deep import pass, pdfs-03).
    // A row is cells side by side; terms stacked one to a line down the margin (AIMA's) stay notes of their own.
    const head = groups.at(-1)?.[0];
    const cells = head ? groups.at(-1)!.filter((c) => Math.abs(c.y - head.y) <= 1 && c.str.trim()).length : 0;
    const row = last && head && cells >= 2 && i.x >= right === last.x >= right && Math.abs(i.x - head.x) <= 2 && Math.abs(i.y - last.y) <= last.size * 2.5;
    if (same || row) groups.at(-1)!.push(i);
    else groups.push([i]);
    last = i;
  }
  const text = items.filter((i) => !beside(i)).map((i) => i.str).join(" ");
  const norm = (t: string) => plain(t).toLowerCase().replace(/[\s\u00ad]+/g, " ").replace(/[.,;:]$/, "").trim();
  const said = norm(text);
  const notes = groups.flatMap((g) => {
    let note = "";
    g.forEach((i, k) => {
      const prev = g[k - 1];
      if (prev && Math.abs(i.y - prev.y) > 1) note = /\p{L}-$/u.test(plain(note)) && /^\p{Ll}/u.test(i.str) ? note.replace(/-(?=[\uE000-\uE005]*$)/, "") : note.trimEnd() + " ";
      else if (prev && i.x > prev.end + 0.5 && !/\s$/.test(note)) note += " "; // the space between two runs is an item of its own, left out
      note += styled(i);
    });
    const words = plain(note).trim().split(/\s+/).length;
    return words < 4 || said.includes(norm(note)) ? [] : [note.trim()];
  });
  return { items: items.map((i) => (beside(i) ? { ...i, str: "" } : i)), notes };
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
  if (it.mono && it.str.trim()) return it.str.replace(/^(\s*)(.*?)(\s*)$/s, `$1${C}$2${C_}$3`);
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
      cur ??= { text: "", y: it.y, x: it.x, size: 0, head: it.head, code: { raw: "", cw: it.mono ? (it.end - it.x) / it.str.length : 0 } };
      if (!it.mono) cur.code = undefined;
      const sup = raised(cur, it, up);
      up = !!sup?.power;
      if (sup !== null) {
        cur.text += sup.text;
        cur.code = undefined;
        continue;
      }
      cur.size = Math.max(cur.size, it.size);
    }
    if (cur) cur.text += styled(it);
    if (cur?.code) cur.code.raw += it.str;
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
  // A table or formula the page reader read (D125) is one line standing for many, so its gaps don't count.
  const gaps = pages.flatMap((lines) => lines.slice(1).map((l, i) => (isBlock(l.text) || isBlock(lines[i]!.text) ? 0 : lines[i]!.y - l.y))).filter((g) => g > 0).sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)] ?? 12;
}

/** Running heads and feet ("2  Chapter 1  Introduction", "Section 1.1 What Is AI?  3", a bare page
 *  number): the first or last line of a page, set apart from the text, that is a page number, starts
 *  or ends with one, or comes back on other pages. One set larger than the text (a guide's "Solved
 *  VALUES GUIDE 7", its name in bold) is one only when it comes back on three pages or more: a
 *  heading alone at a page's foot is set large too. */
function dropRunning(pages: Line[][], body: number, typical: number): Line[][] {
  // Numbers left out: the contents pages' foot has no page number, the others' do.
  const key = (l?: Line) => (l ? plain(l.text) : "").replace(/\d+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
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
    // A table or formula the page reader read (D125) is never a running head, though many pages start with one.
    if (head && next && !isBlock(head.text) && t(head).length <= 80 && (head.size <= body * 1.1 || heads.get(key(head))! >= 3) && head.y - next.y > typical * 1.5 && (number.test(t(head)) || folio.test(t(head)) || heads.get(key(head))! > 1)) drop.add(head);
    const rest = byY.filter((l) => !drop.has(l));
    const foot = rest.at(-1);
    const prev = rest.at(-2);
    if (foot && prev && !isBlock(foot.text) && t(foot).length <= 80 && (foot.size <= body * 1.1 || feet.get(key(foot))! >= 3) && prev.y - foot.y > typical * 1.5 && (number.test(t(foot)) || feet.get(key(foot))! > 1)) drop.add(foot);
    return lines.filter((l) => !drop.has(l));
  });
}

const BULLET = /^[•◦▪‣·●○■□–]\s*/;
/** A section number before a heading's words: "1.1.1 Acting humanly", "2. Methods". */
const NUMBERED = /^\d+(?:\.\d+)*\.?\s+\p{L}/u;
/** A footnote's first line: its number or mark, then its text. */
const FOOTNOTE = /^(?:\d{1,3}|[*†‡§])\s+\S/;

/** A contents entry's last line ends in its page number: "Beyond Happiness 8", "Methods . . . 12". */
const ENTRY = /\S[\s.·…]*\s\d{1,4}$/;

/** A contents page's entries from line `i`: three or more in a row, set close, each a line or two
 *  ending in a page number and starting in capitals, as prose that wraps does not. One entry per
 *  list item, a section indented under its part as on the page (Tyler's Values Guide, 2026-11-22). */
function contents(lines: Line[], i: number, body: number, typical: number, words: Set<string>): { text: string; end: number } | null {
  const entries: Line[][] = [];
  let cur: Line[] = [];
  let end = i;
  for (let j = i; j < lines.length; j++) {
    const l = lines[j]!;
    const gap = j > i ? lines[j - 1]!.y - l.y : 1;
    if (gap <= 0 || gap > typical * 1.4 || isBlock(l.text) || l.code || (body && l.size < body * 0.9)) break;
    if (!cur.length && /^\p{Ll}/u.test(plain(l.text))) break;
    cur.push(l);
    if (ENTRY.test(plain(l.text))) {
      entries.push(cur);
      cur = [];
      end = j + 1;
    } else if (cur.length > 1) break;
  }
  if (entries.length < 3) return null;
  const xs = [...new Set(entries.map((e) => Math.round(e[0]!.x)))].sort((a, b) => a - b).filter((x, n, a) => n === 0 || x - a[n - 1]! > 2);
  const depth = (x: number) => Math.min(xs.filter((s) => x >= s - 2).length - 1, 2);
  const text = entries.map((e) => "  ".repeat(depth(e[0]!.x)) + "- " + e.map((l) => l.text).reduce((a, t) => join(a, t, words))).join("\n");
  return { text, end };
}

// Join lines into paragraphs: a vertical gap clearly larger than the document's
// typical line spacing (or a jump upwards, i.e. a new column) starts a paragraph.
function paragraphs(lines: Line[], body = 0, typical = 12, words = new Set<string>(), blocks: string[] = []): { text: string; note: boolean }[] {
  const out: { text: string; note: boolean }[] = [];
  let para = "";
  /** The open paragraph is a footnote: a sentence running onto the next page joins the one above them. */
  let inNote = false;
  const push = () => {
    // A sentence that starts with "#" or ">" (a comment or a prompt quoted in the text) is still a sentence.
    if (para) out.push({ text: para.replace(/^([\uE000-\uE003]*)(#{1,6}\s|>)/, "$1\\$2"), note: inNote });
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
    // A table or formula the page reader read stands alone (D125).
    if (isBlock(line)) {
      push();
      out.push({ text: line, note: false });
      item = null;
      return;
    }
    // Lines of code, one under the other, are one block: each line kept, indented by how far in it
    // starts, a wider gap a blank line. A typewriter word alone on a line in the middle of a
    // sentence is that sentence's.
    if (l.code && !(para && gap > 0 && gap <= typical * 1.4 && !/[.!?:;]$/.test(plain(para)))) {
      let j = i + 1;
      while (j < lines.length && lines[j]!.code && lines[j]!.y < lines[j - 1]!.y) j++;
      const rows = lines.slice(i, j);
      const left = Math.min(...rows.map((r) => r.x));
      const pitch = Math.min(...rows.slice(1).map((r, n) => rows[n]!.y - r.y));
      const code = rows.map((r, n) => (n > 0 && rows[n - 1]!.y - r.y > pitch * 1.6 ? "\n" : "") + " ".repeat(Math.round((r.x - left) / (r.code!.cw || l.code!.cw || 1))) + r.code!.raw.trimEnd()).join("\n");
      const fence = code.includes("```") ? "````" : "```";
      push();
      out.push({ text: `${BLOCK}${blocks.push(`${fence}\n${code}\n${fence}`) - 1}${BLOCK_}`, note: false });
      item = null;
      skip = j;
      return;
    }
    if (!para || gap > typical * 1.4 || gap < 0) {
      const toc = contents(lines, i, body, typical, words);
      if (toc) {
        push();
        out.push({ text: toc.text, note: false });
        item = null;
        skip = toc.end;
        return;
      }
    }
    // Lines set clearly larger than the body text, then body text, are a heading (the outline's);
    // a heading that wraps is joined. Large text not followed by body text is a figure's labels.
    // A numbered heading ("1.1.1 Acting humanly") may be set only a little larger, often in bold.
    // On a page the page reader read (D346), a heading is what it saw as one, whatever
    // its size: a heading set in the body's size in bold is found, a large pull quote is not.
    if (l.head === undefined ? body && (l.size >= body * 1.15 || (l.size >= body * 1.05 && NUMBERED.test(line))) : l.head) {
      let j = i + 1;
      while (j < lines.length && (l.head ? lines[j]!.head === l.head : lines[j]!.size === l.size)) j++;
      const text = lines.slice(i, j).map((x) => plain(x.text)).reduce((a, t) => a + lineBreakSpace(a, t) + t);
      const next = lines[j];
      if (text.length <= 150 && /\p{L}{3}/u.test(text) && (l.head || (!/[.,;:<>]$/.test(text) && (!next || Math.abs(next.size - body) <= body * 0.1)))) {
        push();
        out.push({ text: `${l.size >= body * 1.6 ? "##" : "###"} ${text}`, note: false });
        item = null;
        skip = j;
        return;
      }
    }
    const bullet = BULLET.test(line) && line.replace(BULLET, "").length > 0;
    // A footnote starts with its mark, or is small print set apart at the foot of the page, below
    // the text (its mark read as a raised number): a sentence running onto the next page skips it.
    const small = (o: Line) => o.size <= body * 0.85;
    const note = !!body && small(l) && (FOOTNOTE.test(line) || (i > 0 && !small(lines[i - 1]!) && gap > typical * 1.4 && lines.slice(i).every(small)));
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
    const text = bullet ? "- " + l.text.replace(/^([\uE000-\uE005]*)[•◦▪‣·●○■□–]\s*/, "$1") : l.text;
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
      return words.has(both) && !words.has((left + right).toLowerCase()) ? para + text : para.replace(/-([\uE000-\uE005]*)$/, "$1") + text;
    }
    return para + text;
  }
  const piece = p.match(/(?:^|[^\p{L}])(\p{Ll}{2,})$/u)?.[1];
  if (piece && /^\p{Ll}{2,}/u.test(right) && words.has(piece + right) && !words.has(piece)) return para + text;
  return para + lineBreakSpace(p, plain(text)) + text;
}

/** A face most of the text is set in (a deck all in bold) marks nothing: only a face used for some
 *  words is emphasis. */
/** What pdf.js can only read as lines (D125). Formulas: many glyphs set in math fonts (a paper's
 *  symbols in passing are a few dozen). Tables: three rows in a row with the same three or more
 *  columns, a column lining up by its left or right edge, short cells and a word among them (a
 *  page set in columns has long cells; a chart's axis has only numbers). Checked on the bake-off
 *  papers, books, a magazine, slides and a form. */
function structureOf(pages: Item[][]): Structure[] | undefined {
  const out: Structure[] = [];
  if (pages.flat().filter((i) => i.math && i.str.trim()).length >= 50) out.push("formulas");
  const table = pages.some((items) => {
    const rows = new Map<number, Item[]>();
    for (const i of items) if (i.str.trim() && i.size) rows.set(Math.round(i.y), [...(rows.get(Math.round(i.y)) ?? []), i]);
    let prev: { l: number; r: number; text: string }[] | undefined;
    let run: string[] = [];
    for (const y of [...rows.keys()].sort((a, b) => b - a)) {
      const row = rows.get(y)!.sort((a, b) => a.x - b.x);
      const cells: { l: number; r: number; text: string }[] = [];
      for (const i of row) {
        const c = cells.at(-1);
        if (c && i.x - c.r <= i.size) Object.assign(c, { r: i.end, text: c.text + i.str });
        else cells.push({ l: i.x, r: i.end, text: i.str });
      }
      const lined = !!prev && cells.length >= 3 && cells.length === prev.length && cells.every((c, k) => Math.abs(c.l - prev![k]!.l) < 4 || Math.abs(c.r - prev![k]!.r) < 4);
      const short = cells.every((c) => c.text.trim().length <= 24);
      run = lined && short ? [...run, ...cells.map((c) => c.text)] : short && cells.length >= 3 ? cells.map((c) => c.text) : [];
      prev = cells;
      if (run.length >= cells.length * 3 && run.some((t) => /\p{L}{2}/u.test(t))) return true;
    }
    return false;
  });
  if (table) out.push("tables");
  return out.length ? out : undefined;
}

function plainFaces(pages: Item[][]): void {
  const all = pages.flat();
  const chars = (f: (i: Item) => boolean | undefined) => all.reduce((n, i) => n + (f(i) ? i.str.trim().length : 0), 0);
  const total = chars(() => true);
  const bold = chars((i) => i.bold) > total * 0.4;
  const italic = chars((i) => i.italic) > total * 0.4;
  // A paper typed in Courier is prose, not code.
  const mono = chars((i) => i.mono) > total * 0.4;
  if (bold || italic || mono) for (const i of all) {
    if (bold) i.bold = undefined;
    if (italic) i.italic = undefined;
    if (mono) i.mono = undefined;
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
    const n = text.match(/^[\uE000-\uE005]*(\d{1,3})[\uE000-\uE005]*\s+/);
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
  let t = lines.reduce((a, l) => a + lineBreakSpace(a, l) + l).trim();
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
  return { title: info.Title?.trim() || undefined, author: fileAuthor(author) };
}

/** Opens a PDF quietly (pdf.js warns on stdout about any damage it works around), refusing one it
 *  can't open with the next step. */
export function openPdf(data: Uint8Array) {
  const task = getDocument({ data: new Uint8Array(data), ...pdfData, useSystemFonts: true, fontExtraProperties: true, verbosity: 0, isOffscreenCanvasSupported: false, isImageDecoderSupported: false });
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

/** A table or formula the page reader found (D125), held in the text as BLOCK…BLOCK_ until the page is put together. */
const BLOCK = "\uE020", BLOCK_ = "\uE021";
const isBlock = (t: string) => new RegExp(`^${BLOCK}\\d+${BLOCK_}$`).test(t);

const inside = (i: Item, b: Box) => {
  const x = (i.x + i.end) / 2;
  const y = i.y + (i.size || 8) / 3;
  return x >= b.l - 2 && x <= b.r + 2 && y >= b.b - 2 && y <= b.t + 2;
};

/** Compare visible operators, so a command such as \cdot counts and TeX syntax doesn't. */
const operators = (text: string) => text.normalize("NFC").replace(/-/g, "−").replace(/·/g, "⋅").match(/[=≠<>≤≥+−×÷⋅]/g) ?? [];

function formulaKeepsText(latex: string, items: Item[]): boolean {
  let mathml: string;
  try {
    mathml = katex.renderToString(latex, { displayMode: true, output: "mathml", throwOnError: true, strict: "ignore" });
  } catch {
    return false;
  }
  const { document } = parseHTML(mathml);
  const counts = new Map<string, number>();
  for (const node of document.querySelectorAll("mo")) {
    for (const op of operators(node.textContent)) counts.set(op, (counts.get(op) ?? 0) + 1);
  }
  // A derivation may use the same operator several times, so compare occurrences.
  for (const item of items) {
    for (const op of operators(item.str)) {
      const count = counts.get(op) ?? 0;
      if (count === 0) return false;
      counts.set(op, count - 1);
    }
  }
  return true;
}

/** A page's items with each region's text taken out and one BLOCK item put where it started, and
 *  the Markdown each block stands for: a table built cell by cell from pdf.js's own reading of the
 *  text in each cell's box (its powers and bold kept), the reader's where pdf.js finds none; a formula
 *  as the reader's LaTeX if it renders and keeps the operators found by pdf.js. */
function swapRegions(items: Item[], regions: Region[], blocks: string[], scan: boolean): Item[] {
  let out = items;
  const read = regions.some((r) => r.kind === "page");
  const parts = regions.filter((r) => r.kind !== "page");
  if (read) {
    // A page the reader read says which text is a heading; one it has not read leaves that to the size.
    const heads = parts.filter((r) => r.kind === "text" && r.head);
    out = out.map((i) => ({ ...i, head: heads.findIndex((h) => inside(i, h.box)) + 1 }));
    // And in what order its blocks are read: a designed page's text is often drawn in another. Text in
    // no block goes before the nearest block below it in its own column, where it sits: the reader
    // sometimes leaves a column's first paragraph out (BERT's page 4), and drawn after a block in the
    // other column it followed the whole page. With none below (a page number), it stays with the
    // text drawn before it.
    const below = (i: Item) => {
      const x = (i.x + i.end) / 2;
      let best = -1;
      parts.forEach((r, k) => {
        if (x >= r.box.l && x <= r.box.r && r.box.t <= i.y && (best < 0 || r.box.t > parts[best]!.box.t)) best = k;
      });
      return best;
    };
    let at = -1;
    const order = out.map((i) => {
      if (!i.str.trim()) return at;
      const n = parts.findIndex((r) => inside(i, r.box));
      if (n >= 0) return (at = n);
      const b = below(i);
      // Just before that block's own text, whichever the PDF drew first.
      return b >= 0 ? b - 0.5 : at;
    });
    // Its order is trusted only where it never climbs back up a column, which reading never does: on
    // a two-column paper the reader's order is sometimes scrambled, and the PDF's own is right.
    const climbs = parts.some((r, k) => parts.slice(0, k).some((p) => r.box.b >= p.box.t - 1 && Math.min(r.box.r, p.box.r) - Math.max(r.box.l, p.box.l) > Math.min(r.box.r - r.box.l, p.box.r - p.box.l) / 2));
    if (!climbs && order.some((n, k) => k > 0 && n < order[k - 1]!)) {
      const sorted = out.map((i, k) => ({ i, n: order[k]!, k })).sort((a, b) => a.n - b.n || a.k - b.k);
      // A block ends its line: the next one starts a new one, wherever the PDF broke its lines.
      out = sorted.map((x, k) => (sorted[k + 1] && sorted[k + 1]!.n !== x.n ? { ...x.i, eol: true } : x.i));
    }
  }
  // A formula the reader found inside a table is one of its cells, read with the table.
  const within = (a: Box, b: Box) => (a.l + a.r) / 2 >= b.l && (a.l + a.r) / 2 <= b.r && (a.t + a.b) / 2 >= b.b && (a.t + a.b) / 2 <= b.t;
  const tables = regions.filter((r) => r.kind === "table");
  /** Where the block before this one ended, so a block the PDF has no text for lands after it. */
  let after = 0;
  for (const r of parts) {
    if (r.kind === "formula" && tables.some((t) => within(r.box, t.box))) continue;
    const ins = (i: Item) => !!i.str.trim() && !isBlock(i.str) && inside(i, r.box);
    const at = out.findIndex(ins);
    if (r.kind === "formula" && !formulaKeepsText(r.latex, out.filter(ins))) {
      if (at >= 0) after = out.findLastIndex(ins) + 1;
      continue;
    }
    if (r.kind === "text" && at >= 0 && !scan) {
      after = out.findLastIndex(ins) + 1;
      continue;
    }
    // Where the PDF has no text of its own (a scanned page, a table that is a picture), the reader's.
    // Prose only in a picture (a screenshot's words) stays in the picture; a scanned page is all picture.
    if (r.kind === "text" && !scan && !r.caption) continue;
    const md = r.kind === "formula" ? `$$\n${r.latex}\n$$` : r.kind === "table" ? table(r, out.filter(ins)) : r.head ? `### ${r.text.replace(/\s+/g, " ")}` : r.text;
    if (!md) continue;
    const mark: Item = { str: BLOCK + blocks.length + BLOCK_, x: r.box.l, y: r.box.t, end: r.box.r, size: 0, eol: true };
    blocks.push(md);
    const from = at < 0 ? after : at;
    const kept = out.filter((i, n) => n < from || !ins(i));
    if (from > 0) kept[from - 1] = { ...kept[from - 1]!, eol: true };
    out = [...kept.slice(0, from), mark, ...kept.slice(from)];
    after = from + 1;
  }
  return out;
}

/** The letters and digits of a text, for matching a reader's cell to pdf.js's items whatever their
 *  spacing, dots or dashes. */
const bare = (t: string) => t.normalize("NFKC").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();

function table(r: Extract<Region, { kind: "table" }>, items: Item[]): string {
  const grid = Array.from({ length: r.rows }, () => Array.from({ length: r.cols }, () => ""));
  // A cell with no box (the reader places only the whole table) takes the first unused run of
  // pdf.js items that spells the same letters and digits, in reading order, so its powers and bold
  // stay; with none, the reader's own text.
  const used = new Set<Item>();
  const spelled = (text: string): Item[] => {
    const want = bare(text);
    if (!want) return [];
    for (let s = 0; s < items.length; s++) {
      if (!bare(items[s]!.str)) continue; // a dash or a space starts no cell's run
      let got = "";
      for (let e = s; e < items.length && !used.has(items[e]!); e++) {
        got += bare(items[e]!.str);
        if (got === want) {
          const run = items.slice(s, e + 1);
          for (const i of run) used.add(i);
          return run;
        }
        if (!want.startsWith(got)) break;
      }
    }
    return [];
  };
  for (const c of r.cells) {
    if (c.row >= r.rows || c.col >= r.cols) continue;
    // A cell's text may wrap: a step down to the next line ends one, a raised power doesn't.
    const its = c.box ? items.filter((i) => inside(i, c.box!)) : spelled(c.text);
    const own = pageLines(its.map((i, n) => ({ ...i, eol: i.eol || (!!its[n + 1] && its[n + 1]!.y < i.y - (i.size || 8) * 0.6) })))
      .map((l) => l.text)
      .join(" ");
    const text = emphasis(own.replace(/\uE010[^\uE011]*\uE011/g, "")).trim() || c.text;
    grid[c.row]![c.col] = text.replace(/\|/g, "\\|").replace(/\s+/g, " ");
  }
  // The header is the run of rows from the top whose every cell is a header; the reader may also mark a
  // label row lower down (a table's "FLOPs" line), which stays in the body.
  let head = 0;
  while (head + 1 < r.rows && r.cells.some((c) => c.row === head + 1) && r.cells.every((c) => c.row !== head + 1 || c.header)) head++;
  // Markdown has one header row: a header set over two rows reads as one, its parts joined.
  const top = grid.slice(0, head + 1).reduce((a, row) => a.map((t, i) => [t, row[i]].filter(Boolean).join(" ")), grid[0]!.map(() => ""));
  // A header row is bold already: its own bold marks would only repeat that.
  const rows = [top.map((t) => t.replace(/^\*\*(.*)\*\*$/, "$1")), ...grid.slice(head + 1)].filter((row) => row.some(Boolean));
  if (rows.length < 2) return "";
  const line = (row: string[]) => `| ${row.join(" | ")} |`;
  return [line(rows[0]!), line(rows[0]!.map(() => "---")), ...rows.slice(1).map(line)].join("\n");
}

type Doc = Awaited<ReturnType<typeof openPdf>["promise"]>;

/** A filled form's answers on a page, each as "Field: value": the values live in the form's fields, not the
 *  page's text, so a filled form came in blank (deep import pass, pdfs-04). A box ticked is ✓; one left empty, none. */
async function formValues(page: Awaited<ReturnType<Doc["getPage"]>>): Promise<string[]> {
  type Widget = { subtype?: string; fieldName?: string; alternativeText?: string; fieldValue?: unknown; checkBox?: boolean; radioButton?: boolean; buttonValue?: string; exportValue?: string };
  const out: string[] = [];
  for (const a of (await page.getAnnotations()) as Widget[]) {
    if (a.subtype !== "Widget") continue;
    const name = (a.alternativeText || a.fieldName || "").replace(/\s+/g, " ").trim();
    const raw = [a.fieldValue ?? ""].flat().map(String).join(", ").trim();
    // A ticked box is ✓; a choice of several is the one picked, once for its group (code review).
    const value = a.checkBox ? (raw && raw !== "Off" ? "✓" : "") : a.radioButton ? (raw && raw !== "Off" && raw === a.buttonValue ? raw : "") : raw;
    if (name && value) out.push(`${name}: ${value}`);
  }
  return out;
}

/** The PDF's own outline (its bookmarks): each top-level entry's title and the page it opens on
 *  (0-based). The author's chapters, where the outline has them (D115). */
type Entry = { title: string; page: number };
async function outlineOf(doc: Doc): Promise<{ chapters: Entry[]; sections: (Entry & { depth: number })[] }> {
  const top = (await doc.getOutline()) ?? [];
  type Node = (typeof top)[number];
  const place = async (e: Node): Promise<Entry | null> => {
    const dest = typeof e.dest === "string" ? await doc.getDestination(e.dest) : e.dest;
    const ref = Array.isArray(dest) ? dest[0] : null;
    if (!ref || !e.title?.trim()) return null;
    return { title: e.title.replace(/\s+/g, " ").trim(), page: typeof ref === "number" ? ref : await doc.getPageIndex(ref) };
  };
  const chapters: Entry[] = [];
  for (const e of top) {
    const at = await place(e);
    if (!at) return { chapters: [], sections: [] }; // one it can't place: trust none of them
    chapters.push(at);
  }
  // The sections inside each chapter, as subheadings (deep import pass, pdfs-07): one that can't be placed is left out alone.
  const sections: (Entry & { depth: number })[] = [];
  const walk = async (list: Node[], depth: number) => {
    for (const e of list) {
      const at = depth > 1 ? await place(e).catch(() => null) : null;
      if (at) sections.push({ ...at, depth });
      if (depth < 3 && e.items?.length) await walk(e.items, depth + 1);
    }
  };
  await walk(top, 1);
  return { chapters, sections };
}

/** Each outline entry becomes a chapter: a `<!-- chapter N -->` marker and a `## title` where its
 *  page has the title's line (or at the page's top), so chapter recall and the outline rail see the
 *  chapters the author made. An outline of one entry, or out of page order, is not a table of chapters.
 *  A paper prints "1 Introduction" where its outline says "Introduction": the line is found with or without
 *  its section number, and the heading keeps the page's number. A line of the title's own length is looked for
 *  first, so a paragraph that only opens with the same word never takes the heading from the line below it.
 *  Each entry goes below the one before it on its page: one with no line of its own went in at the page's top,
 *  last first, above the page's own headings (F733). */
function markChapters(paras: { text: string; note: boolean }[][], outline: { title: string; page: number; depth?: number }[], sections = false): boolean {
  if (sections) outline = outline.filter((e) => e.page < paras.length);
  else if (outline.length < 2 || outline.some((e, i) => e.page >= paras.length || (i > 0 && e.page < outline[i - 1]!.page))) return false;
  const words = (t: string) => plain(t).replace(/^#+\s*/, "").replace(/[*_]/g, "").replace(/\s+/g, " ").trim();
  const fold = (t: string) => words(t).toLowerCase();
  const NUMBER = /^\d+(\.\d+)*\.?\s+(?=\S)/;
  const unnumbered = (t: string) => t.replace(NUMBER, "");
  /** Where the last chapter head went on each page: the next one on that page goes below it. */
  const last = new Map<number, number>();
  outline.forEach((e, n) => {
    const page = paras[e.page]!;
    const from = (last.get(e.page) ?? -1) + 1;
    const full = fold(e.title);
    const text = (p: { text: string; note: boolean }) => (!p.note && !isBlock(p.text) ? fold(p.text) : null);
    const find = (fits: (got: string) => boolean) => page.findIndex((p, i) => i >= from && text(p) !== null && fits(text(p)!));
    const starts = (want: string) => (got: string) => got.startsWith(want) || (got.length >= 3 && want.startsWith(got));
    // The title's own line: as the outline has it, or the same words behind (or without) a section number.
    const short = (got: string) => unnumbered(got).length <= unnumbered(full).length + 3;
    let at = find((got) => short(got) && (starts(full.slice(0, 40))(got) || starts(unnumbered(full).slice(0, 40))(unnumbered(got))));
    const line = at >= 0 ? page[at]!.text : null;
    // A section is marked only on its own line: the page shows it, the outline only names it.
    if (sections && line === null) return;
    // No such line: a paragraph that opens with the title, which the heading goes above.
    if (at < 0) at = find(starts(full.slice(0, 40)));
    // The page's section number, when the outline left it off.
    const number = line !== null && !NUMBER.test(full) ? (NUMBER.exec(words(line))?.[0].trim() ?? "") : "";
    const title = `${number ? `${number} ` : ""}${e.title}`;
    const head = { text: sections ? `${"#".repeat(Math.min(6, 2 + (e.depth ?? 1) - 1))} ${title}` : `<!-- chapter ${n + 1} -->\n\n## ${title}`, note: false };
    if (line !== null) page[at] = head;
    else page.splice((at = at >= 0 ? at : from), 0, head);
    last.set(e.page, at);
  });
  return true;
}

/** Each page's box in points ([left, bottom, right, top]), for placing what the page reader saw in
 *  its picture of the page. */
export async function pageViews(data: Uint8Array): Promise<number[][]> {
  const task = openPdf(data);
  const doc = await task.promise;
  const out: number[][] = [];
  for (let n = 1; n <= doc.numPages; n++) out.push([...(await doc.getPage(n)).view]);
  await task.destroy();
  return out;
}

/** Each page's words as pdf.js reads them: two files with the same are the same pages, whatever else differs. */
export async function pageTexts(data: Uint8Array): Promise<string[]> {
  const task = openPdf(data);
  const doc = await task.promise;
  const out: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) out.push((await (await doc.getPage(n)).getTextContent()).items.map((i) => ("str" in i ? i.str : "")).join(" "));
  await task.destroy();
  return out;
}

export async function pdfToDoc(data: Uint8Array, regions: Region[] = []): Promise<PdfDoc> {
  const task = openPdf(data);
  const doc = await task.promise;
  const meta = await pdfMeta(doc);
  const outline = await outlineOf(doc).catch(() => ({ chapters: [], sections: [] }));
  const items: Item[][] = [];
  const figures: Asset[][] = [];
  const pageImages: boolean[] = [];
  const fields: string[][] = [];
  const seen = new Map<string, number>();
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const tc = await page.getTextContent();
    // A figure that won't decode never costs the text. Reading the figures loads the page's fonts,
    // whose names say which text is bold or italic.
    const read = await pageFigures(page).catch(() => ({ figures: [], pageImage: false }));
    const figs = read.figures.map((f) => png(f.width, f.height, f.rgba)).filter((d) => d.length <= MAX_FIGURE).map((d) => ({ name: assetName(d, "png"), data: d }));
    pageImages.push(read.pageImage);
    const font = (id: string) => {
      try {
        return String((page.commonObjs.has(id) && (page.commonObjs.get(id) as { name?: string })?.name) || "");
      } catch {
        return "";
      }
    };
    items.push(tc.items.filter((i): i is TextItem => "str" in i).map((i) => toItem(i, font)));
    fields.push(await formValues(page).catch(() => []));
    for (const name of new Set(figs.map((f) => f.name))) seen.set(name, (seen.get(name) ?? 0) + 1);
    figures.push(figs);
  }
  await task.destroy();
  // On three or more pages it is a logo or a header band, not a figure.
  const kept = figures.map((f) => f.filter((a) => (seen.get(a.name) ?? 0) < 3));
  const assets = [...new Map(kept.flat().slice(0, MAX_FIGURES).map((a) => [a.name, a])).values()];
  const body = bodySize(items);
  plainFaces(items);
  const structure = structureOf(items);
  const blocks: string[] = [];
  const split = items.map((p) => splitMargins(p, body));
  // A scanned PDF: most of its pages have no text of their own.
  const worded = (i: Item) => /[\p{L}\p{N}]{2}/u.test(i.str);
  const scanned = items.filter((p) => p.filter(worded).length < 5).length * 2 > items.length;
  const needsRecognition: number[] = [];
  const raw = split.map((p, i) => {
    // A scan can have a page number or a small stamp in its text layer.
    // A page the size of its picture with no words of its own: a page number or a stamp may be there, letters of a
    // caption may not (a full-page figure and its caption keep the picture's words in the picture). A file that is
    // mostly such pages (a scan stored some other way) counts every page with no text of its own.
    const own = items[i]!.map((item) => item.str).join("");
    const scan = (pageImages[i] === true || scanned) && bare(own).length < 20 && bare(own).replace(/\p{N}/gu, "").length < 3;
    const before = blocks.length;
    const page = i + 1;
    const lines = pageLines(swapRegions(p.items, regions.filter((r) => r.page === page), blocks, scan));
    if (scan && blocks.length === before) needsRecognition.push(page);
    return lines;
  });
  const typical = lineGap(raw);
  const lines = dropRunning(raw, body, typical);
  const words = wordsOf(lines);
  const paras = lines.map((l) => paragraphs(l, body, typical, words, blocks));
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
  // Sections only under chapters it could mark: an outline out of page order is no table of chapters (code review).
  if (markChapters(paras, outline.chapters)) markChapters(paras, outline.sections, true);
  // A margin glossary's definitions after the page's text, above its footnotes.
  paras.forEach((page, i) => {
    const at = page.findIndex((p) => p.note);
    page.splice(at < 0 ? page.length : at, 0, ...split[i]!.notes.map((text) => ({ text, note: false })));
  });
  const shown = new Set(assets.map((a) => a.name));
  const notes = footnotes(paras);
  const pages = paras.map((p, i) => [...p.map((x) => (isBlock(x.text) ? blocks[Number(x.text.slice(1, -1))]! : notes(x.text, i))), ...kept[i]!.map((a) => (shown.has(a.name) ? `![](assets/${a.name})` : PAST_FIGURES)), ...fields[i]!].join("\n\n"));
  const text = pages.join("\n\n");
  // Letters and numbers only: a font pdf.js can't map leaves its punctuation, which is no text to read.
  // The form's answers aren't the page's own text: a scanned form is still a scan (code review).
  if (fields.flat().reduce((t, f) => t.replace(f, ""), text.replaceAll(PAST_FIGURES, "")).replace(/!\[\]\(assets\/[^)]+\)/g, "").replace(/[^\p{L}\p{N}]/gu, "").length < 20) {
    throw new ScannedPdf();
  }
  if (needsRecognition.length) {
    // Where its words can't be read (the iPhone, which has no recognizer here; a recognizer that fails), the page
    // says so, never left empty unsaid (D96).
    const recognized = await recognizedPages(data, "pdf", needsRecognition).catch(() => null);
    needsRecognition.forEach((page, i) => {
      // A page it read and found no words on says so too, never left empty unsaid.
      const words = (recognized && recognized[i]?.trim()) || SCAN_UNREAD;
      if (words) pages[page - 1] = [words, pages[page - 1]].filter(Boolean).join("\n\n");
    });
  }
  // A metadata title that is only a file or tool name ("1706", "Microsoft Word - draft.docx") loses to page 1's.
  const markdown = pages.map((p, i) => `<!-- page ${i + 1} -->\n\n${p}`).join("\n\n") + "\n";
  return { title: cleanTitle(meta.title) ?? titleFrom(lines[0] ?? [], body), author: meta.author, body: markdown, assets, structure };
}
