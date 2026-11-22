import { existsSync, writeFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { paddleHome, paddlePath, READY } from "./paddle-path.ts";
import { tmpdir } from "node:os";
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
  /** Where the reader placed the cell. PaddleOCR-VL places only the whole table, so its cells have
   *  none and their own text is used. */
  box?: Box;
  header: boolean;
  /** The reader's reading of the cell, used where pdf.js finds no text in its box or the cell has none. */
  text: string;
}

/** A part of a page as the page reader saw it (D-new-paddle-pages), in the order it is read: a table,
 *  a display formula, or a block of text (a paragraph, a caption, or with `head` a heading), and one
 *  `page` region for every page it read, so a page it found no heading on shows none. Where the PDF has
 *  its own text, pdf.js still reads the words, so highlights on the prose never move and no word is the
 *  model's guess; a block's own `text` is used only where the page has none there (a scan, a table
 *  that is a picture). */
export type Region = { page: number; box: Box } & ({ kind: "table"; rows: number; cols: number; cells: Cell[] } | { kind: "formula"; latex: string } | { kind: "text"; text: string; head?: true; caption?: true } | { kind: "page" });

/** A page as PaddleOCR-VL read it: its picture's size in pixels and its blocks, each with a label
 *  ("text", "paragraph_title", "table", "display_formula", …), its content (a table as HTML, a formula
 *  as LaTeX) and its box in pixels from the picture's top-left corner. */
export interface PaddlePage {
  page: number;
  width: number;
  height: number;
  blocks: { label: string; content: string; bbox: [number, number, number, number] }[];
}

const unescape = (t: string) => t.replace(/<[^>]+>/g, " ").replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, e: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " })[e]!).replace(/\s+/g, " ").trim();

/** An HTML table's cells on a grid, a cell that spans rows or columns holding its place. */
export function cellsFrom(html: string): { rows: number; cols: number; cells: Cell[] } {
  const cells: Cell[] = [];
  const taken = new Set<string>();
  let row = 0, cols = 0;
  for (const tr of html.match(/<tr[\s>][\s\S]*?<\/tr>/gi) ?? []) {
    let col = 0;
    for (const m of tr.matchAll(/<(t[dh])([^>]*)>([\s\S]*?)<\/t[dh]>/gi)) {
      while (taken.has(`${row},${col}`)) col++;
      const span = (name: string) => Math.max(1, Number(m[2]!.match(new RegExp(`${name}=["']?(\\d+)`, "i"))?.[1] ?? 1));
      const rows = span("rowspan"), wide = span("colspan");
      for (let r = 0; r < rows; r++) for (let c = 0; c < wide; c++) taken.add(`${row + r},${col + c}`);
      cells.push({ row, col, rows, cols: wide, header: m[1]!.toLowerCase() === "th" || (row === 0 && !/<th[\s>]/i.test(html)), text: unescape(m[3]!) });
      col += wide;
      cols = Math.max(cols, col);
    }
    row++;
  }
  return { rows: row, cols, cells };
}

/** The blocks that are the page's own reading text. A running head or foot, a page number and the
 *  words inside a chart are not. */
/** The reader pads its inline math with spaces ("$ ^{2} $"), which Markdown reads as no math at all. */
const prose = (t: string) => t.trim().replace(/\$ ([^$\n]+?) \$/g, "$$$1$$").replace(/ {2,}/g, " ");

const TEXT = new Set(["text", "abstract", "figure_title", "footnote", "vision_footnote", "reference_content", "algorithm", "aside_text"]);

/** PaddleOCR-VL's pages as the regions Ore uses. `views` is each PDF page's box in points
 *  ([left, bottom, right, top], as pdf.js gives it): the picture's pixels are scaled onto it. */
export function regionsFrom(pages: PaddlePage[], views: number[][]): Region[] {
  const out: Region[] = [];
  for (const p of pages) {
    const v = views[p.page - 1];
    if (!v || !p.width || !p.height) continue;
    const sx = (v[2]! - v[0]!) / p.width, sy = (v[3]! - v[1]!) / p.height;
    const box = (b: number[]): Box => ({ l: v[0]! + b[0]! * sx, r: v[0]! + b[2]! * sx, t: v[3]! - b[1]! * sy, b: v[3]! - b[3]! * sy });
    out.push({ kind: "page", page: p.page, box: { l: v[0]!, b: v[1]!, r: v[2]!, t: v[3]! } });
    for (const b of p.blocks) {
      if (b.label === "table") {
        const t = cellsFrom(b.content);
        if (t.rows >= 2 && t.cols >= 2) out.push({ kind: "table", page: p.page, box: box(b.bbox), ...t });
      } else if (b.label === "display_formula" || b.label === "formula") {
        const latex = tidyLatex(b.content.replace(/^\s*(?:\$\$|\\\[)|(?:\$\$|\\\])\s*$/g, ""));
        if (latex) out.push({ kind: "formula", page: p.page, box: box(b.bbox), latex });
      } else if (b.label === "paragraph_title" || b.label === "doc_title") out.push({ kind: "text", page: p.page, box: box(b.bbox), text: prose(b.content.replace(/^#+\s*/, "")), head: true });
      else if (TEXT.has(b.label) && b.content.trim()) out.push({ kind: "text", page: p.page, box: box(b.bbox), text: prose(b.content), ...((b.label === "figure_title" || b.label === "vision_footnote") && { caption: true as const }) });
    }
  }
  return out;
}

/** The reader's LaTeX, made safe for KaTeX: an equation's number, set apart by alignment marks or a
 *  space, as `\tag`, a stray space at the start dropped, and the alignment marks it leaves outside any
 *  environment dropped. */
export function tidyLatex(s: string): string {
  let t = s.trim().replace(/\s+/g, " ").replace(/^(?:\\ )+/, "");
  const n = t.match(/(?:(?:&|(?<!\\)\\q?quad|(?<!\\)\\[ ,;])\s*)+\(\s*(\d+)\s*\)\s*$/);
  if (n) t = `${t.slice(0, n.index).trim()} \\tag{${n[1]}}`;
  if (!/\\begin\{/.test(t)) t = t.replace(/(?<!\\)&/g, " ").replace(/\s+/g, " ").trim();
  return t;
}

/** The pinned tools the download installs, into one folder Ore owns, so removing it removes
 *  everything: uv (MIT/Apache-2.0) fetches Python, PaddleOCR with its document parser (paddleocr,
 *  paddlex, paddlepaddle: Apache-2.0) and, on Apple silicon, mlx-vlm (MIT), which runs the model on the
 *  Mac's GPU. The models: PaddleOCR-VL 1.6 (Apache-2.0, 1.9 GB) reads each block, PP-DocLayoutV3
 *  (Apache-2.0) finds the blocks. Every licence is permissive (D273's rule). */
const UV = "0.11.32";
const PADDLEOCR = "3.7.0";
const PADDLEPADDLE = "3.2.1";
const MLX_VLM = "0.8.0";
const MLX = process.platform === "darwin" && process.arch === "arm64";

export { paddleHome, paddlePath } from "./paddle-path.ts";

/** The reader's driver, run by its own Python as `<script> <pdf> <out.json>` (or `--warm`, which only
 *  fetches the models). On Apple silicon the model runs in mlx-vlm's server, started here on a free
 *  port and stopped after: one request at a time, since mlx-vlm 0.8.0 garbles pages read side by side. */
export const DRIVER = `
import json, os, socket, subprocess, sys, time
MODEL = "PaddlePaddle/PaddleOCR-VL-1.6"
mlx = sys.platform == "darwin" and os.uname().machine == "arm64"
warm = sys.argv[1] == "--warm"
srv = None
try:
    if warm:
        from huggingface_hub import snapshot_download
        if mlx: snapshot_download(MODEL)
    from paddleocr import PaddleOCRVL
    if mlx:
        s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
        if not warm:
            srv = subprocess.Popen([sys.executable, "-m", "mlx_vlm.server", "--model", MODEL, "--port", str(port), "--max-num-seqs", "1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            for _ in range(600):
                if srv.poll() is not None: raise RuntimeError("the model's server stopped")
                try: socket.create_connection(("127.0.0.1", port), 1).close(); break
                except OSError: time.sleep(1)
        pipe = PaddleOCRVL(pipeline_version="v1.6", vl_rec_backend="mlx-vlm-server", vl_rec_server_url=f"http://127.0.0.1:{port}/", vl_rec_api_model_name=MODEL)
    else:
        pipe = PaddleOCRVL(pipeline_version="v1.6")
    if not warm:
        pages = []
        for r in pipe.predict(sys.argv[1]):
            j = r.json; j = j.get("res", j)
            pages.append({"page": j["page_index"] + 1, "width": j["width"], "height": j["height"], "blocks": [{"label": b["block_label"], "content": b["block_content"] or "", "bbox": b["block_bbox"]} for b in j["parsing_res_list"]]})
        json.dump(pages, open(sys.argv[2], "w"))
finally:
    if srv: srv.terminate()
`;

async function run(cmd: string[], env: Record<string, string> = {}): Promise<void> {
  const proc = Bun.spawn(cmd, { stdout: "ignore", stderr: "pipe", env: { ...process.env, ...env } });
  const [code, err] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
  if (code !== 0) throw new Error(`The PDF page reader didn't finish downloading: ${err.trim().split("\n").at(-1) || `exit ${code}`}. Check the connection and try again.`);
}

/** Everything the reader fetches stays in Ore's folder: its models too, not ~/.paddlex or ~/.cache. */
const cacheEnv = (home: string) => ({ PADDLE_PDX_CACHE_HOME: join(home, "models"), HF_HOME: join(home, "hf") });

async function driver(dir: string): Promise<string> {
  const f = join(dir, "read.py");
  await Bun.write(f, DRIVER);
  return f;
}

/** Downloads the reader and its models (about 4 GB), step by step. A run that was cut off starts over. */
export async function installPaddle(onStep: (step: number, of: number, label: string) => void = () => {}): Promise<string> {
  const home = paddleHome();
  await rm(home, { recursive: true, force: true });
  // The reader this one replaced (Granite-Docling, D273), about 2 GB, where it was installed.
  if (!process.env.ORE_PADDLE_HOME) await rm(join(dirname(home), "docling"), { recursive: true, force: true });
  await mkdir(home, { recursive: true });
  const venv = join(home, "env");
  const env = { UV_CACHE_DIR: join(home, "cache"), UV_PYTHON_INSTALL_DIR: join(home, "python"), UV_NO_CONFIG: "1" };
  const target = `${process.arch === "arm64" ? "aarch64" : "x86_64"}-${process.platform === "darwin" ? "apple-darwin" : "unknown-linux-gnu"}`;
  onStep(1, 4, "Getting the installer");
  const res = await fetch(`https://github.com/astral-sh/uv/releases/download/${UV}/uv-${target}.tar.gz`).catch(() => undefined);
  if (!res?.ok) throw new Error("Couldn't reach GitHub to download the PDF page reader. Check the connection and try again.");
  // Read whole, then written: Bun 1.3 never finishes writing a streamed fetch body (Bun.write(path, res)),
  // and the run ends silently mid-download.
  await Bun.write(join(home, "uv.tar.gz"), await res.arrayBuffer());
  await run(["tar", "xzf", join(home, "uv.tar.gz"), "-C", home]);
  const uv = join(home, `uv-${target}`, "uv");
  onStep(2, 4, "Getting Python");
  await run([uv, "venv", "--python", "3.12", "--managed-python", venv], env);
  onStep(3, 4, "Getting the reader");
  const python = join(venv, "bin", "python");
  await run([uv, "pip", "install", "--python", python, `paddlepaddle==${PADDLEPADDLE}`, `paddleocr[doc-parser]==${PADDLEOCR}`, ...(MLX ? [`mlx-vlm==${MLX_VLM}`] : [])], env);
  onStep(4, 4, "Getting its models (about 2 GB)");
  await run([python, await driver(home), "--warm"], cacheEnv(home));
  await rm(env.UV_CACHE_DIR, { recursive: true, force: true });
  await rm(join(home, "uv.tar.gz"), { force: true });
  await rm(dirname(uv), { recursive: true, force: true });
  writeFileSync(join(home, READY), `paddleocr ${PADDLEOCR}\n`);
  return home;
}

/** Deletes the download, and with it everything it installed. */
export async function removePaddle(): Promise<void> {
  await rm(paddleHome(), { recursive: true, force: true });
}

/** Reads a PDF with PaddleOCR-VL and returns its pages. About 6 s a page on Apple silicon, so it runs
 *  in the background after the PDF is added, never while he waits to open it. */
export async function runPaddle(pdf: string, bin = paddlePath()): Promise<PaddlePage[]> {
  if (!bin) throw new Error("The PDF page reader isn't installed. Get it in Settings › AI.");
  const out = await mkdtemp(join(tmpdir(), "ore-paddle-"));
  try {
    const proc = Bun.spawn([bin, await driver(out), pdf, join(out, "pages.json")], { stdout: "ignore", stderr: "pipe", env: { ...process.env, ...cacheEnv(dirname(dirname(dirname(bin)))) } });
    const [code, err] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
    if (code !== 0 || !existsSync(join(out, "pages.json"))) throw new Error(`The PDF page reader couldn't read this PDF: ${err.trim().split("\n").at(-1) || `exit ${code}`}`);
    return JSON.parse(await readFile(join(out, "pages.json"), "utf8")) as PaddlePage[];
  } finally {
    await rm(out, { recursive: true, force: true });
  }
}
