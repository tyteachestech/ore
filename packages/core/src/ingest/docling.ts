import { existsSync, writeFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { doclingHome, doclingPath } from "./docling-path.ts";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";

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

/** A part of a page that Docling reads as structure (D125): a table or a display formula. pdf.js still
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

/** The pinned tools the download installs: uv (MIT/Apache) fetches Python and Docling (MIT; its
 *  models Apache-2.0) into one folder Ore owns, so removing it removes everything. */
const UV = "0.11.32";
const DOCLING = "2.142.0";
const MODELS = ["layout", "tableformer", "code_formula"];

export { doclingHome, doclingPath } from "./docling-path.ts";

async function run(cmd: string[], env: Record<string, string> = {}): Promise<void> {
  const proc = Bun.spawn(cmd, { stdout: "ignore", stderr: "pipe", env: { ...process.env, ...env } });
  const [code, err] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
  if (code !== 0) throw new Error(`The table and formula reader didn't finish downloading: ${err.trim().split("\n").at(-1) || `exit ${code}`}. Check the connection and try again.`);
}

/** Downloads Docling and its models (about 2 GB), step by step. A run that was cut off starts over. */
export async function installDocling(onStep: (step: number, of: number, label: string) => void = () => {}): Promise<string> {
  const home = doclingHome();
  await rm(home, { recursive: true, force: true });
  await mkdir(home, { recursive: true });
  const venv = join(home, "env");
  const env = { UV_CACHE_DIR: join(home, "cache"), UV_PYTHON_INSTALL_DIR: join(home, "python"), UV_NO_CONFIG: "1" };
  const target = `${process.arch === "arm64" ? "aarch64" : "x86_64"}-${process.platform === "darwin" ? "apple-darwin" : "unknown-linux-gnu"}`;
  onStep(1, 4, "Getting the installer");
  const res = await fetch(`https://github.com/astral-sh/uv/releases/download/${UV}/uv-${target}.tar.gz`).catch(() => undefined);
  if (!res?.ok) throw new Error("Couldn't reach GitHub to download the table and formula reader. Check the connection and try again.");
  // Read whole, then written: Bun 1.3 never finishes writing a streamed fetch body (Bun.write(path, res)),
  // and the run ends silently mid-download.
  await Bun.write(join(home, "uv.tar.gz"), await res.arrayBuffer());
  await run(["tar", "xzf", join(home, "uv.tar.gz"), "-C", home]);
  const uv = join(home, `uv-${target}`, "uv");
  onStep(2, 4, "Getting Python");
  await run([uv, "venv", "--python", "3.12", "--managed-python", venv], env);
  onStep(3, 4, "Getting the reader (about 1 GB)");
  await run([uv, "pip", "install", "--python", join(venv, "bin", "python"), `docling==${DOCLING}`], env);
  onStep(4, 4, "Getting its models (about 1 GB)");
  // Beside the command, where runDocling looks for them.
  await run([join(venv, "bin", "docling-tools"), "models", "download", "-o", join(venv, "models"), ...MODELS], env);
  await rm(env.UV_CACHE_DIR, { recursive: true, force: true });
  await rm(join(home, "uv.tar.gz"), { force: true });
  await rm(dirname(uv), { recursive: true, force: true });
  writeFileSync(join(home, "ready"), `docling ${DOCLING}\n`);
  return home;
}

/** Deletes the download, and with it everything it installed. */
export async function removeDocling(): Promise<void> {
  await rm(doclingHome(), { recursive: true, force: true });
}

/** Reads a PDF with Docling and returns its regions. Slow (seconds to minutes a paper), so it runs
 *  in the background after the PDF is added, never while he waits to open it. pdf.js already has the
 *  text of every page Docling reads, so it runs without text recognition. */
export async function runDocling(pdf: string, bin = doclingPath()): Promise<Region[]> {
  if (!bin) throw new Error("The table and formula reader isn't installed. Get it in Settings › General › Import.");
  const out = await mkdtemp(join(tmpdir(), "ore-docling-"));
  const models = join(dirname(dirname(bin)), "models");
  try {
    const proc = Bun.spawn([bin, "convert", pdf, "--to", "json", "--no-ocr", "--enrich-formula", "--table-mode", "accurate", "--image-export-mode", "placeholder", ...(existsSync(models) ? ["--artifacts-path", models] : []), "--output", out, "-q"], { stdout: "ignore", stderr: "pipe" });
    const [code, err] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
    const json = (await readdir(out)).find((f) => f.endsWith(".json"));
    if (code !== 0 || !json) throw new Error(`The table and formula reader couldn't read this PDF: ${err.trim().split("\n").at(-1) || `exit ${code}`}`);
    return regionsFrom(JSON.parse(await readFile(join(out, json), "utf8")));
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}
