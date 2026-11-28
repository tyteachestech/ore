// A Jupyter notebook (.ipynb, a file or a link through GitHub or nbviewer): its Markdown cells as
// text, code cells as code blocks in the notebook's language, and their output after each: its text,
// and the plots it drew, saved as images (D122).
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Asset } from "../items.ts";
import { assetName } from "./assets.ts";
// `fenced`: a fence longer than any run of backticks inside, so a cell that prints Markdown (or holds a ``` string) stays one block.
import { fenced, rewriteImageUrls, td } from "./markdown.ts";

export interface NotebookDoc {
  title?: string;
  body: string;
  assets: Asset[];
}

type Cell = { cell_type: string; source: string | string[]; attachments?: Record<string, Record<string, string | string[]>>; outputs?: { output_type: string; ename?: string; evalue?: string; traceback?: string[]; text?: string | string[]; data?: Record<string, string | string[]> }[] };

const joined = (s: string | string[] | undefined) => (Array.isArray(s) ? s.join("") : s ?? "");
/** Output past this many characters is cut: a training log or a dataframe dump is not reading. */
const MAX_OUTPUT = 2000;
/** Output images a notebook stores, and the file type each is saved as. */
const PLOTS = [["image/png", "png"], ["image/jpeg", "jpg"], ["image/svg+xml", "svg"]] as const;

/** An `<img>` on a line of its own as `![alt](src)`: the reader shows no raw HTML, so fastbook's figures
 *  (`<img alt="…" src="images/…">` in its Markdown) were dropped (import corpus). Code is left as written. */
function htmlImages(md: string): string {
  let fence: string | null = null;
  return md
    .split("\n")
    .map((line) => {
      const f = line.match(/^ {0,3}(`{3,}|~{3,})/)?.[1];
      if (fence) {
        if (f && f[0] === fence[0] && f.length >= fence.length) fence = null;
        return line;
      }
      if (f) fence = f;
      if (f || !/^ {0,3}<img\b[^>]*>\s*$/i.test(line)) return line;
      const attr = (name: string) => line.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.slice(1).find((v) => v !== undefined) ?? "";
      const src = attr("src");
      return src ? `![${attr("alt").replace(/[[\]\n]/g, " ")}](${src.replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29")})` : line;
    })
    .join("\n");
}

/** `base`: where the notebook is (its link, or its file as a file:// URL), so a picture its Markdown shows
 *  from beside it ("images/neuron.png") is found and saved like any other. */
export function notebookToDoc(json: string, base?: string): NotebookDoc {
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
  let bold: string | undefined;
  const assets = new Map<string, Asset>();
  for (const c of nb.cells ?? []) {
    const src = joined(c.source).trim();
    if (c.cell_type === "markdown" && src) {
      parts.push(rewriteImageUrls(htmlImages(src), (url) => {
        if (!url.startsWith("attachment:")) {
          if (!base || /^[a-z][\w+.-]*:|^\/\/|^#/i.test(url)) return;
          try {
            const href = new URL(url, base).href;
            // A picture that isn't beside the file stays as written: never a link to this Mac's folder in a doc.md.
            return !href.startsWith("file:") || existsSync(fileURLToPath(href)) ? href : undefined;
          } catch { return; }
        }
        const name = url.slice("attachment:".length);
        let decoded = name;
        try { decoded = decodeURIComponent(name); } catch { /* A literal percent is also a valid attachment name. */ }
        const bundle = c.attachments?.[name] ?? c.attachments?.[decoded];
        const [type, ext] = PLOTS.find(([t]) => bundle?.[t]) ?? [];
        if (!type || !ext) return;
        const raw = joined(bundle![type]);
        const data = ext === "svg" ? new TextEncoder().encode(raw) : Uint8Array.from(atob(raw.replace(/\s+/g, "")), (c) => c.charCodeAt(0));
        const saved = assetName(data, ext);
        assets.set(saved, { name: saved, data });
        return `assets/${saved}`;
      }));
      // `# Title`, or `Title` underlined with `===`; else a first cell that is one bold line
      // ("**Chapter 4 – Training Models**", before a "# Setup").
      title ??= src.match(/^#\s+(.+)$|^(\S.*)\n=+\s*$/m)?.slice(1).find(Boolean)?.trim();
      bold ??= parts.length === 1 ? src.match(/^\*\*([^*\n]+)\*\*$/)?.[1]?.trim() : undefined;
    }
    if (c.cell_type !== "code" || !src) continue;
    parts.push(fenced(lang, src));
    // A plot's own text/plain is only "<Figure size 640x480 with 1 Axes>": the image stands for it.
    let text = "";
    const flushText = () => {
      const out = text.trim();
      if (out) parts.push(fenced("text", out.length > MAX_OUTPUT ? out.slice(0, MAX_OUTPUT) + "\n…" : out));
      text = "";
    };
    for (const o of c.outputs ?? []) {
      const [type, ext] = PLOTS.find(([t]) => o.data?.[t]) ?? [];
      if (type && ext) {
        flushText();
        // A plot: a PNG or JPEG is base64 in the notebook, an SVG is its text.
        const raw = joined(o.data![type]);
        const data = ext === "svg" ? new TextEncoder().encode(raw) : Uint8Array.from(atob(raw.replace(/\s+/g, "")), (c) => c.charCodeAt(0));
        const name = assetName(data, ext);
        assets.set(name, { name, data });
        parts.push(`![](assets/${name})`);
      } else if (o.output_type === "error") {
        flushText();
        text = (o.traceback?.length ? o.traceback.join("\n") : [o.ename, o.evalue].filter(Boolean).join(": ")).replace(/\x1b\[[0-9;]*m/g, "");
        flushText();
      } else if (o.data?.["text/html"] && !o.data["text/plain"]) {
        flushText();
        const html = td.turndown(joined(o.data["text/html"])).trim();
        if (html) parts.push(html);
      } else text += joined(o.text ?? o.data?.["text/plain"]);
    }
    flushText();
  }
  if (!parts.length) throw new Error("This notebook has no cells to read.");
  return { title: bold ?? title, body: parts.join("\n\n") + "\n", assets: [...assets.values()] };
}
