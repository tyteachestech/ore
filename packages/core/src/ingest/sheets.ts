import { strFromU8, unzipSync } from "fflate";
import { posix } from "node:path";
import { cleanTitle, fileAuthor } from "./check.ts";

// Spreadsheets (D122 gap 8): a vocabulary list, a glossary, a class's data. An Excel workbook comes
// in as each sheet's table under the sheet's name; a CSV or TSV file as its one table.

/** More rows than this is a dataset, not something to read: refused rather than half-read (D96). */
const MAX_ROWS = 5000;

export interface SheetDoc {
  title?: string;
  author?: string;
  body: string;
}

/** Rows as a GFM table: the first row is the header, empty rows and columns at the edges dropped. */
function table(rows: string[][]): string | null {
  const kept = rows.map((r) => r.map((c) => c.replace(/\s+/g, " ").trim())).filter((r) => r.some(Boolean));
  if (!kept.length) return null;
  if (kept.length > MAX_ROWS) throw new Error(`That spreadsheet has ${kept.length.toLocaleString("en-US")} rows, too many to read as a source. Copy the part you want to learn from into a new file, or paste it here.`);
  const width = Math.max(...kept.map((r) => r.reduce((w, c, i) => (c ? i + 1 : w), 0)));
  const line = (r: string[]) => `| ${Array.from({ length: width }, (_, i) => (r[i] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`;
  return [line(kept[0]!), `|${" --- |".repeat(width)}`, ...kept.slice(1).map(line)].join("\n");
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
    } else if (ch === '"' && !cell) quoted = true;
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

const xmlText = (s: string) =>
  s
    .replace(/<rPh\b[\s\S]*?<\/rPh>/g, "") // Japanese reading hints, not the text
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

/** A column's letters as its index: A → 0, AA → 26. */
const column = (ref: string) => [...ref.replace(/\d+$/, "")].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

/** Excel's built-in number formats that show a date. */
const DATE_FORMATS = new Set([14, 15, 16, 17, 22, 27, 30, 36, 45, 46, 47, 50, 57]);

/** An Excel workbook's sheets, each as a table under its name; a sheet with nothing in it is left out. */
export function xlsxToDoc(data: Uint8Array): SheetDoc {
  const files = unzipSync(data);
  const read = (p: string) => (files[p] ? strFromU8(files[p]) : "");
  const book = read("xl/workbook.xml");
  if (!book) throw new Error("is missing its workbook");
  const rels = new Map([...read("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)].map((m) => [attr(m[0], "Id"), attr(m[0], "Target")]));
  const strings = [...read("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => xmlText(m[1]!));
  // Which cell styles show a date: a built-in date format, or one of the book's own with y, m or d.
  const styles = read("xl/styles.xml");
  const custom = new Map([...styles.matchAll(/<numFmt\b[^>]*>/g)].map((m) => [Number(attr(m[0], "numFmtId")), xmlText(attr(m[0], "formatCode") ?? "")]));
  // A format's day or year letters, outside its quoted text and [colour] codes.
  const isDate = (id: number) => DATE_FORMATS.has(id) || /[dy]/i.test(custom.get(id)?.replace(/\[[^\]]*\]|"[^"]*"|\\./g, "") ?? "");
  const xfs = (styles.match(/<cellXfs\b[\s\S]*?<\/cellXfs>/)?.[0].match(/<xf\b[^>]*>/g) ?? []).map((x) => isDate(Number(attr(x, "numFmtId") ?? 0)));
  const sections: string[] = [];
  for (const s of book.matchAll(/<sheet\b[^>]*>/g)) {
    if (attr(s[0], "state") === "hidden" || attr(s[0], "state") === "veryHidden") continue;
    const target = rels.get(attr(s[0], "r:id"));
    if (!target) continue;
    const xml = read(target.startsWith("/") ? target.slice(1) : posix.join("xl", target));
    const rows: string[][] = [];
    for (const r of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
      const at = Number(attr(r[1]!, "r") ?? rows.length + 1) - 1;
      const row: string[] = [];
      for (const c of r[2]!.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const a = c[1]!;
        const inner = c[2] ?? "";
        const v = xmlText(inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "");
        const t = attr(a, "t");
        let text = t === "s" ? (strings[Number(v)] ?? "") : t === "inlineStr" ? xmlText(inner.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? "") : t === "b" ? (v === "1" ? "TRUE" : "FALSE") : v;
        if ((!t || t === "n") && v && xfs[Number(attr(a, "s") ?? 0)]) {
          // A date is days since 1899-12-30, as Excel counts them.
          const d = new Date(Math.round((Number(v) - 25569) * 86400) * 1000);
          text = Number(v) % 1 ? d.toISOString().slice(0, 16).replace("T", " ") : d.toISOString().slice(0, 10);
        }
        row[attr(a, "r") ? column(attr(a, "r")!) : row.length] = text;
      }
      rows[at] = Array.from(row, (c) => c ?? "");
    }
    const t = table(Array.from(rows, (r) => r ?? []));
    if (t) sections.push(`## ${xmlText(attr(s[0], "name") ?? "Sheet")}\n\n${t}`);
  }
  if (!sections.length) throw new Error("That workbook has no rows to read.");
  const core = read("docProps/core.xml");
  const tag = (name: string) => xmlText(core.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] ?? "").trim() || undefined;
  return { title: cleanTitle(tag("dc:title")), author: fileAuthor(tag("dc:creator")), body: sections.join("\n\n") + "\n" };
}
