// A Jupyter notebook (.ipynb, a file or a link through GitHub or nbviewer): its Markdown cells as
// text, code cells as code blocks in the notebook's language, and their text output after each.

export interface NotebookDoc {
  title?: string;
  body: string;
}

type Cell = { cell_type: string; source: string | string[]; outputs?: { output_type: string; text?: string | string[]; data?: Record<string, string | string[]> }[] };

const joined = (s: string | string[] | undefined) => (Array.isArray(s) ? s.join("") : s ?? "");
/** Output past this many characters is cut: a training log or a dataframe dump is not reading. */
const MAX_OUTPUT = 2000;

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
  for (const c of nb.cells ?? []) {
    const src = joined(c.source).trim();
    if (c.cell_type === "markdown" && src) {
      parts.push(src);
      title ??= src.match(/^#\s+(.+)$/m)?.[1]?.trim();
    }
    if (c.cell_type !== "code" || !src) continue;
    parts.push(fenced(lang, src));
    const out = (c.outputs ?? []).map((o) => joined(o.text ?? o.data?.["text/plain"])).join("").trim();
    if (out) parts.push(fenced("text", out.length > MAX_OUTPUT ? out.slice(0, MAX_OUTPUT) + "\n…" : out));
  }
  if (!parts.length) throw new Error("This notebook has no cells to read.");
  return { title, body: parts.join("\n\n") + "\n" };
}
