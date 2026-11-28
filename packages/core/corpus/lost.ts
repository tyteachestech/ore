// What a doc.md dropped from its original, for a `text-lost` or `order-changed` flag:
//   bun packages/core/corpus/lost.ts <original file> <doc.md>
// Prints the longest runs of the original's words that are nowhere in the doc, longest first.
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { readOriginal, words } from "./original.ts";

const [file, docPath] = process.argv.slice(2);
if (!file || !docPath) throw new Error("usage: lost.ts <original file> <doc.md>");
const orig = await readOriginal(new Uint8Array(readFileSync(file)), extname(file));
if (!orig) throw new Error(`Can't read a ${extname(file)} file's own text`);
const doc = words(readFileSync(docPath, "utf8").replace(/^---\n[\s\S]*?\n---\n/, ""));
const N = 5;
const have = new Set<string>();
for (let i = 0; i + N <= doc.length; i++) have.add(doc.slice(i, i + N).join(" "));
// A word is kept when a run of five around it is in the doc.
const kept = orig.words.map(() => false);
for (let i = 0; i + N <= orig.words.length; i++) if (have.has(orig.words.slice(i, i + N).join(" "))) for (let j = i; j < i + N; j++) kept[j] = true;
const runs: { at: number; len: number }[] = [];
for (let i = 0; i < kept.length; ) {
  if (kept[i]) {
    i++;
    continue;
  }
  let j = i;
  while (j < kept.length && !kept[j]) j++;
  runs.push({ at: i, len: j - i });
  i = j;
}
const lost = runs.reduce((n, r) => n + r.len, 0);
console.log(`${lost} of ${orig.words.length} words in no run of ${N} the doc has, in ${runs.length} places. Longest:`);
for (const r of runs.sort((a, b) => b.len - a.len).slice(0, Number(process.argv[4] ?? 12)))
  console.log(`- at ${Math.round((r.at / orig.words.length) * 100)}%, ${r.len} words: ${orig.words.slice(r.at, r.at + Math.min(r.len, 40)).join(" ")}${r.len > 40 ? " …" : ""}`);
