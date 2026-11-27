// bun compare.ts old.json master.json: what the old CLI saw that master's doesn't (lost or changed values).
import { readFileSync } from "node:fs";
const [a, b] = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f!, "utf8")));
const out: string[] = [];
// Leaf values the old answer had that master's lacks or changed; new keys on master's side are fine.
function walk(x: any, y: any, path: string) {
  if (out.length > 400) return;
  if (x === null || typeof x !== "object") {
    if (JSON.stringify(x) !== JSON.stringify(y)) out.push(`${path}: ${JSON.stringify(x)?.slice(0, 120)} → ${JSON.stringify(y)?.slice(0, 120)}`);
    return;
  }
  if (y === null || typeof y !== "object") return void out.push(`${path}: object → ${JSON.stringify(y)?.slice(0, 80)}`);
  if (Array.isArray(x)) {
    if (!Array.isArray(y)) return void out.push(`${path}: array → not array`);
    if (x.length !== y.length) out.push(`${path}: length ${x.length} → ${y.length}`);
    // Match by id when the rows have one.
    const key = (r: any) => r?.id ?? r?.meta?.id ?? r?.ts;
    const byId = new Map(y.map((r: any) => [key(r), r]));
    x.forEach((r: any, i: number) => walk(r, key(r) !== undefined && byId.has(key(r)) ? byId.get(key(r)) : y[i], `${path}[${key(r) ?? i}]`));
    return;
  }
  for (const k of Object.keys(x)) walk(x[k], y[k], `${path}.${k}`);
}
for (const k of Object.keys(a)) walk(a[k], b[k], k);
console.log(out.join("\n"));
