import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

/** A box on a PDF page in points, measured from its bottom-left corner as pdf.js does. */
export interface Box {
  l: number;
  r: number;
  /** The top and bottom edges: top > bottom. */
  t: number;
  b: number;
}

export interface Cell {
  row: number;
  col: number;
  rows: number;
  cols: number;
  box: Box;
  header: boolean;
  /** Docling's reading of the cell, used where pdf.js finds no text in its box. */
  text: string;
}

/** A part of a page that Docling reads as structure (D123): a table or a display formula. pdf.js still
 *  reads the text everywhere else, so highlights on the prose never move. */
export type Region = { page: number; box: Box } & ({ kind: "table"; rows: number; cols: number; cells: Cell[] } | { kind: "formula"; latex: string });

type DBox = { l: number; t: number; r: number; b: number; coord_origin?: string };
type Prov = { page_no: number; bbox: DBox };
type DoclingDoc = {
  texts?: { label: string; text?: string; prov?: Prov[] }[];
  tables?: { prov?: Prov[]; data?: { num_rows: number; num_cols: number; table_cells?: { bbox?: DBox; row_span?: number; col_span?: number; start_row_offset_idx: number; start_col_offset_idx: number; column_header?: boolean; text?: string }[] } }[];
  pages?: Record<string, { size: { width: number; height: number }; page_no: number }>;
};

/** Docling's JSON (a DoclingDocument) as the regions Ore swaps in: its tables, cell by cell, and its
 *  display formulas as LaTeX. Boxes are turned to bottom-left points whatever origin Docling gave. */
export function regionsFrom(doc: DoclingDoc): Region[] {
  const height = (page: number) => Object.values(doc.pages ?? {}).find((p) => p.page_no === page)?.size.height ?? 792;
  const box = (b: DBox, page: number): Box => (b.coord_origin === "TOPLEFT" ? { l: b.l, r: b.r, t: height(page) - b.t, b: height(page) - b.b } : { l: b.l, r: b.r, t: b.t, b: b.b });
  const out: Region[] = [];
  for (const t of doc.tables ?? []) {
    const p = t.prov?.[0];
    const d = t.data;
    if (!p || !d?.table_cells?.length || d.num_rows < 2 || d.num_cols < 2) continue;
    const cells = d.table_cells.filter((c) => c.bbox).map((c) => ({ row: c.start_row_offset_idx, col: c.start_col_offset_idx, rows: c.row_span ?? 1, cols: c.col_span ?? 1, box: box(c.bbox!, p.page_no), header: !!c.column_header, text: (c.text ?? "").trim() }));
    out.push({ kind: "table", page: p.page_no, box: box(p.bbox, p.page_no), rows: d.num_rows, cols: d.num_cols, cells });
  }
  for (const t of doc.texts ?? []) {
    const p = t.prov?.[0];
    const latex = tidyLatex(t.text ?? "");
    if (t.label !== "formula" || !p || !latex) continue;
    out.push({ kind: "formula", page: p.page_no, box: box(p.bbox, p.page_no), latex });
  }
  return out;
}

/** The formula model's LaTeX, made safe for KaTeX: an equation's number set as `\tag`, and the
 *  alignment marks it leaves outside any environment dropped. */
export function tidyLatex(s: string): string {
  let t = s.trim().replace(/\s+/g, " ");
  const n = t.match(/(?:&\s*)*\(\s*(\d+)\s*\)\s*$/);
  if (n && /&/.test(n[0])) t = `${t.slice(0, n.index).trim()} \\tag{${n[1]}}`;
  if (!/\\begin\{/.test(t)) t = t.replace(/(?<!\\)&/g, " ").replace(/\s+/g, " ").trim();
  return t;
}

/** Where the optional download puts Docling (D120: big tools are optional Mac downloads), or
 *  ORE_DOCLING for one installed elsewhere. */
export function doclingPath(): string | undefined {
  const own = process.env.ORE_DOCLING || join(homedir(), "Library", "Application Support", "Ore", "docling", "bin", "docling");
  return existsSync(own) ? own : undefined;
}

/** Reads a PDF with Docling and returns its regions. Slow (seconds to minutes a paper), so it runs
 *  in the background after the PDF is added, never while he waits to open it. */
export async function runDocling(pdf: string, bin = doclingPath()): Promise<Region[]> {
  if (!bin) throw new Error("The table and formula reader isn't installed. Get it in Settings › General › Import.");
  const out = await mkdtemp(join(tmpdir(), "ore-docling-"));
  try {
    const proc = Bun.spawn([bin, "convert", pdf, "--to", "json", "--enrich-formula", "--table-mode", "accurate", "--image-export-mode", "placeholder", "--output", out, "-q"], { stdout: "ignore", stderr: "pipe" });
    const [code, err] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
    const json = (await readdir(out)).find((f) => f.endsWith(".json"));
    if (code !== 0 || !json) throw new Error(`The table and formula reader couldn't read this PDF: ${err.trim().split("\n").at(-1) || `exit ${code}`}`);
    return regionsFrom(JSON.parse(await readFile(join(out, json), "utf8")));
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}
