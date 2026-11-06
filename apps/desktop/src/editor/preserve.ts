import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

// D38: saving from the editor must not change lines he did not edit. The editor rewrites
// Markdown in its own style (bullets, escapes, breaks), so each top-level block it emits
// unchanged is replaced by that block's original text, along with the original spacing
// between two such blocks.

const parser = unified().use(remarkParse).use(remarkGfm);

type Blocks = { text: string[]; gaps: string[]; types: string[] }; // gaps[0] before the first block, gaps[n] after the last

// A link reference definition (`[p]: https://…`) is no block to the editor, which resolves the
// links that use it and drops the line. Here it stays part of the gap around it, so it is kept
// with its neighbours; one whose neighbour was edited goes to the end of the note (see below).
const isDef = (n: { type: string }) => n.type === "definition";

function blocks(md: string): Blocks {
  const nodes = parser.parse(md).children.filter((n) => !isDef(n));
  const text: string[] = [];
  const gaps: string[] = [];
  const types = nodes.map((n) => n.type);
  let at = 0;
  for (const n of nodes) {
    const start = n.position!.start.offset!;
    const end = n.position!.end.offset!;
    gaps.push(md.slice(at, start));
    text.push(md.slice(start, end));
    at = end;
  }
  gaps.push(md.slice(at));
  return { text, gaps, types };
}

/** The link reference definitions of `md`, each as written. */
function definitions(md: string): string[] {
  return parser.parse(md).children.filter(isDef).map((n) => md.slice(n.position!.start.offset!, n.position!.end.offset!));
}

/** `out` with every definition of `original` it lost added at the end, where unedited blocks still find them. */
function keepDefinitions(original: string, out: string): string {
  const have = new Set(definitions(out));
  const lost = definitions(original).filter((d) => !have.has(d));
  if (!lost.length) return out;
  return `${out.replace(/\n*$/, "")}\n\n${lost.join("\n")}\n`;
}

/** For each block of `b`, the index of the equal block of `a` on a longest common subsequence, or -1. */
function lcs(a: string[], b: string[]): number[] {
  const L = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--) L[i]![j] = a[i] === b[j] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
  const out = new Array<number>(b.length).fill(-1);
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (a[i] === b[j]) out[j++] = i++;
    else if (L[i + 1]![j]! >= L[i]![j + 1]!) i++;
    else j++;
  }
  return out;
}

/**
 * `original` is the file as loaded, `base` the editor's Markdown for it before any edit, and
 * `edited` the editor's Markdown now. Returns `edited` with every untouched block restored to
 * its original text; `original` itself when nothing changed.
 */
export function keepUnedited(original: string, base: string, edited: string): string {
  if (edited === base) return original;
  const o = blocks(original);
  const b = blocks(base);
  const e = blocks(edited);
  // Blocks of the original and of its re-serialization pair up by position; if the editor
  // merged or split one (rare), fall back to its own output.
  if (o.text.length !== b.text.length || !e.text.length) return keepDefinitions(original, edited);
  const m = lcs(b.text, e.text);
  const join = (m: number[]) => {
    const used = new Set<number>();
    const gap = (g: number) => (used.add(g), o.gaps[g]!);
    // An original gap beside an edited block is not kept, but the definitions in it are, each once.
    const defs = (g: number) => {
      if (used.has(g)) return "";
      used.add(g);
      return definitions(o.gaps[g]!).join("\n");
    };
    const lead = m[0] === 0 ? gap(0) : defs(0);
    let out = lead && m[0] !== 0 ? `${lead}\n\n` : lead;
    e.text.forEach((t, i) => {
      const cur = m[i]!;
      if (i > 0) {
        const prev = m[i - 1]!;
        // Between blocks the editor writes one blank line (an empty paragraph would add more).
        if (prev >= 0 && cur === prev + 1) out += gap(cur);
        else out += `\n\n${[prev >= 0 ? defs(prev + 1) : "", cur >= 0 ? defs(cur) : ""].filter(Boolean).map((d) => `${d}\n\n`).join("")}`;
      }
      out += cur >= 0 ? o.text[cur]! : t;
    });
    const last = m[e.text.length - 1]!;
    if (last === o.text.length - 1) return out + gap(o.text.length);
    const tail = [last >= 0 ? defs(last + 1) : "", defs(o.text.length)].filter(Boolean).join("\n");
    return `${out}\n${tail ? `\n${tail}\n` : ""}`;
  };
  // An original block beside one the editor wrote can read differently from how the editor
  // meant it: two lists with the same bullet merge into one, so the editor alternates bullets
  // there. Where the blocks no longer parse as the editor's, its own text goes on both sides
  // of each such seam; failing that, its whole output.
  const same = (md: string) => blocks(md).types.join() === e.types.join();
  let out = join(m);
  if (same(out)) return keepDefinitions(original, out);
  const kept = m.map((k, i) => (k >= 0 && (m[i - 1] ?? 0) >= 0 && (m[i + 1] ?? 0) >= 0 ? k : -1));
  out = join(kept);
  return keepDefinitions(original, same(out) ? out : edited);
}
