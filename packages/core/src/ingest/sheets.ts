import { strFromU8, unzipSync } from "fflate";
import { posix } from "node:path";
import { escapeMarkdown } from "./check.ts";
import { coreProps, xmlText } from "./office.ts";

// Spreadsheets (D122 gap 8): a vocabulary list, a glossary, a class's data. An Excel workbook comes
// in as each sheet's table under the sheet's name; a CSV or TSV file as its one table.

/** More rows than this is a dataset, not something to read: refused rather than half-read (D96). */
const MAX_ROWS = 5000;

export interface SheetDoc {
  title?: string;
  author?: string;
  body: string;
}

/** Rows as a GFM table: the first row is the header; empty rows, and empty columns at either edge,
 *  are dropped (a sheet's table often starts at B2). A cell says what it says, never Markdown. */
function table(rows: string[][]): string | null {
  const kept = rows.map((r) => Array.from(r, (c) => (c ?? "").replace(/\s+/g, " ").trim())).filter((r) => r.some(Boolean));
  if (!kept.length) return null;
  if (kept.length > MAX_ROWS) throw new Error(`That spreadsheet has ${kept.length.toLocaleString("en-US")} rows, too many to read as a source. Copy the part you want to learn from into a new file, or paste it here.`);
  const from = Math.min(...kept.map((r) => r.findIndex(Boolean)));
  const to = Math.max(...kept.map((r) => r.reduce((w, c, i) => (c ? i + 1 : w), 0)));
  const line = (r: string[]) => `| ${Array.from({ length: to - from }, (_, i) => escapeMarkdown(r[from + i] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`;
  return [line(kept[0]!), `|${" --- |".repeat(to - from)}`, ...kept.slice(1).map(line)].join("\n");
}

/** A CSV or TSV file's rows: quoted cells may hold the delimiter, quotes ("") and line breaks. The
 *  delimiter is the one the first line uses most: Excel in much of Europe writes semicolons. */
export function csvToDoc(text: string, tsv = false): SheetDoc {
  const src = text.replace(/^\uFEFF/, "");
  const first = src.split(/\r?\n/, 1)[0]!.replace(/"[^"]*"/g, "");
  const delim = tsv ? "\t" : [",", ";", "\t"].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0]![0];
  const rows: string[][] = [[]];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && !cell.trim()) (quoted = true), (cell = ""); // a space may sit before the quote
    else if (ch === delim) rows[rows.length - 1]!.push(cell), (cell = "");
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      rows[rows.length - 1]!.push(cell);
      cell = "";
      rows.push([]);
    } else cell += ch;
  }
  rows[rows.length - 1]!.push(cell);
  const body = table(rows);
  if (!body) throw new Error("That file has no rows to read.");
  return { body: body + "\n" };
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
/** XML with its tags' namespace prefixes dropped: some exporters write `<x:row>` for `<row>`. */
const bare = (xml: string) => xml.replace(/<(\/?)[a-z][\w.-]*:(?=[a-z])/gi, "<$1");
/** A cell's text, without the reading hints Japanese sheets carry. */
const cellText = (s: string) => xmlText(s.replace(/<rPh\b[\s\S]*?<\/rPh>/g, ""));

/** A column's letters as its index: A → 0, AA → 26. */
const column = (ref: string) => [...ref.replace(/\d+$/, "")].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

/** Excel's built-in number formats that show a date, a date and time, or a time or duration. */
const DATES = new Set([14, 15, 16, 17, 27, 30, 36, 50, 57]);
const DATE_TIMES = new Set([22]);
const TIMES = new Set([18, 19, 20, 21, 45, 46, 47]);
/** Its built-in percent formats, by their decimals: 0% and 0.00%. */
const PERCENTS = new Map([[9, 0], [10, 2]]);
type Shown = "date" | "datetime" | "time" | { percent: number } | undefined;

/** How a cell format shows a number: a format of the book's own by its letters, outside quoted text. */
function shown(id: number, code: string | undefined): Shown {
  if (DATES.has(id)) return "date";
  if (DATE_TIMES.has(id)) return "datetime";
  if (TIMES.has(id)) return "time";
  if (PERCENTS.has(id)) return { percent: PERCENTS.get(id)! };
  const c = code?.replace(/\[(?![hms]+\])[^\]]*\]|"[^"]*"|\\./gi, "").toLowerCase() ?? "";
  if (c.includes("%")) return { percent: c.match(/\.(0+)/)?.[1]!.length ?? 0 };
  const day = /[dy]/.test(c);
  const time = /h|s|\[m+\]/.test(c);
  return day && time ? "datetime" : day ? "date" : time ? "time" : undefined;
}

/** A number to `d` decimals as Excel shows it: read to its 15 digits first, half away from zero. */
const round = (n: number, d: number) => {
  const scaled = Number((Math.abs(n) * 10 ** d).toPrecision(15));
  return ((Math.sign(n) * Math.round(scaled)) / 10 ** d).toFixed(d);
};
const pad = (n: number) => String(n).padStart(2, "0");
/** A time of day or a duration from its fraction of a day: 0.5208 → 12:30, 1.5 → 36:00. */
function clock(days: number): string {
  const secs = Math.round(days * 86400);
  const s = secs % 60;
  return `${Math.floor(secs / 3600)}:${pad(Math.floor(secs / 60) % 60)}${s ? `:${pad(s)}` : ""}`;
}

/** An Excel workbook's sheets, each as a table under its name; a hidden or empty sheet is left out. */
export function xlsxToDoc(data: Uint8Array): SheetDoc {
  const files = unzipSync(data);
  const read = (p: string) => (files[p] ? bare(strFromU8(files[p])) : "");
  const rels = (part: string) => {
    const xml = read(posix.join(posix.dirname(part), "_rels", `${posix.basename(part)}.rels`));
    return [...xml.matchAll(/<Relationship\b[^>]*>/g)].map((m) => {
      const target = attr(m[0], "Target") ?? "";
      return { id: attr(m[0], "Id"), type: attr(m[0], "Type") ?? "", path: target.startsWith("/") ? target.slice(1) : posix.join(posix.dirname(part), target) };
    });
  };
  // The workbook, and its strings and styles, are where its relationships say.
  const bookPath = rels("").find((r) => r.type.endsWith("/officeDocument"))?.path ?? "xl/workbook.xml";
  const book = read(bookPath);
  if (!book) throw new Error("is missing its workbook");
  const parts = rels(bookPath);
  const part = (type: string) => read(parts.find((r) => r.type.endsWith(`/${type}`))?.path ?? "");
  const strings = [...part("sharedStrings").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => cellText(m[1]!));
  const styles = part("styles");
  const custom = new Map([...styles.matchAll(/<numFmt\b[^>]*>/g)].map((m) => [Number(attr(m[0], "numFmtId")), xmlText(attr(m[0], "formatCode") ?? "")]));
  const xfs = (styles.match(/<cellXfs\b[\s\S]*?<\/cellXfs>/)?.[0].match(/<xf\b[^>]*>/g) ?? []).map((x) => {
    const id = Number(attr(x, "numFmtId") ?? 0);
    return shown(id, custom.get(id));
  });
  // Days are counted from 1899-12-30, or from 1904-01-01 in older Mac Excel.
  const epoch = /<workbookPr\b[^>]*\bdate1904="(?:1|true)"/.test(book) ? 24107 : 25569;
  const sections: string[] = [];
  for (const s of book.matchAll(/<sheet\b[^>]*>/g)) {
    if (/hidden/i.test(attr(s[0], "state") ?? "")) continue;
    const xml = read(parts.find((r) => r.id === attr(s[0], "r:id"))?.path ?? "");
    const rows: string[][] = [];
    for (const r of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      if (!r[2]) continue;
      const row: string[] = [];
      for (const c of r[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const a = c[1]!;
        const inner = c[2] ?? "";
        const v = xmlText(inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "");
        const t = attr(a, "t");
        let text = t === "s" ? (strings[Number(v)] ?? "") : t === "inlineStr" ? cellText(inner.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? "") : t === "b" ? (v === "1" ? "TRUE" : "FALSE") : v;
        const num = (!t || t === "n") && v && !Number.isNaN(Number(v));
        const as = num ? xfs[Number(attr(a, "s") ?? 0)] : undefined;
        if (as === "time") text = clock(Number(v));
        else if (typeof as === "object") text = `${round(Number(v) * 100, as.percent)}%`;
        else if (as) {
          const iso = new Date(Math.round((Number(v) - epoch) * 86400) * 1000).toISOString();
          text = as === "date" ? iso.slice(0, 10) : iso.slice(0, 16).replace("T", " ");
        } else if (num) text = String(Number(Number(v).toPrecision(15))); // as Excel shows it: 15 digits, so 0.1+0.2 is 0.3
        // Only cells with something in them count: a styled empty cell far to the right is nothing.
        if (text) row[attr(a, "r") ? column(attr(a, "r")!) : row.length] = text;
      }
      if (row.length) rows[Number(attr(r[1]!, "r") ?? rows.length + 1) - 1] = row;
    }
    const t = table(rows.filter(Boolean));
    if (t) sections.push(`## ${xmlText(attr(s[0], "name") ?? "Sheet")}\n\n${t}`);
  }
  if (!sections.length) throw new Error("That workbook has no rows to read.");
  return { ...coreProps(files), body: sections.join("\n\n") + "\n" };
}
