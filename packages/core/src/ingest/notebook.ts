// A Jupyter notebook (.ipynb, a file or a link through GitHub or nbviewer): its Markdown cells as
// text, code cells as code blocks in the notebook's language, and their output after each: its text,
// and the plots it drew, saved as images (D122).
import type { Asset } from "../items.ts";
import { assetName } from "./assets.ts";

export interface NotebookDoc {
  title?: string;
  body: string;
  assets: Asset[];
}

type Cell = { cell_type: string; source: string | string[]; outputs?: { output_type: string; text?: string | string[]; data?: Record<string, string | string[]> }[] };

const joined = (s: string | string[] | undefined) => (Array.isArray(s) ? s.join("") : s ?? "");
/** Output past this many characters is cut: a training log or a dataframe dump is not reading. */
const MAX_OUTPUT = 2000;
/** Output images a notebook stores, and the file type each is saved as. */
const PLOTS = [["image/png", "png"], ["image/jpeg", "jpg"], ["image/svg+xml", "svg"]] as const;

/** A code block whose fence is longer than any run of backticks inside it, so a cell that prints
 *  Markdown (or holds a ``` string) stays one block. */
const fenced = (lang: string, text: string) => {
  const fence = "`".repeat(Math.max(3, ...[...text.matchAll(/`+/g)].map((m) => m[0].length + 1)));
  return `${fence}${lang}\n${text}\n${fence}`;
};

export function notebookToDoc(json: string): NotebookDoc {
  let nb: { cells?: Cell[]; metadata?: { language_info?: { name?: string }; kernelspec?: { language?: string } } };
  try {
    nb = JSON.parse(json);
  } catch {
    throw new Error("This notebook file isn’t valid JSON, so Ore couldn’t read it.");
  }
  const lang = nb.metadata?.language_info?.name ?? nb.metadata?.kernelspec?.language ?? "";
  const parts: string[] = [];
  // The title is a Markdown cell's `# heading`, never a `# comment` in a Python cell.
  let title: string | undefined;
  const assets = new Map<string, Asset>();
  for (const c of nb.cells ?? []) {
    const src = joined(c.source).trim();
    if (c.cell_type === "markdown" && src) {
      parts.push(src);
      title ??= src.match(/^#\s+(.+)$/m)?.[1]?.trim();
    }
    if (c.cell_type !== "code" || !src) continue;
    parts.push(fenced(lang, src));
    // A plot's own text/plain is only "<Figure size 640x480 with 1 Axes>": the image stands for it.
    const out = (c.outputs ?? []).map((o) => joined(o.text ?? (PLOTS.some(([t]) => o.data?.[t]) ? "" : o.data?.["text/plain"]))).join("").trim();
    if (out) parts.push(fenced("text", out.length > MAX_OUTPUT ? out.slice(0, MAX_OUTPUT) + "\n…" : out));
    for (const o of c.outputs ?? []) {
      // A plot: a PNG or JPEG is base64 in the notebook, an SVG is its text.
      const [type, ext] = PLOTS.find(([t]) => o.data?.[t]) ?? [];
      if (!type || !ext) continue;
      const raw = joined(o.data![type]);
      const data = ext === "svg" ? new TextEncoder().encode(raw) : Uint8Array.from(atob(raw.replace(/\s+/g, "")), (c) => c.charCodeAt(0));
      const name = assetName(data, ext);
      assets.set(name, { name, data });
      parts.push(`![](assets/${name})`);
    }
  }
  if (!parts.length) throw new Error("This notebook has no cells to read.");
  return { title, body: parts.join("\n\n") + "\n", assets: [...assets.values()] };
}
