// bun reads.ts <checkout> <lib> <out.json>: every read the app makes, as that checkout's CLI answers it.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
const [wt, lib, out] = process.argv.slice(2) as [string, string, string];
const CLI = join(wt, "packages/cli/src/ore.ts");
const env = { ...process.env, ORE_LIBRARY: lib, ORE_NO_ENRICH: "1", ORE_AI: "none", TZ: "UTC" };
const res: Record<string, unknown> = {};
function ore(key: string, args: string[]) {
  const p = Bun.spawnSync(["bun", CLI, ...args, "--json"], { env });
  if (p.exitCode !== 0) return (res[key] = { ERROR: p.stderr.toString().trim().split("\n").pop() });
  try { return (res[key] = JSON.parse(p.stdout.toString())); } catch { return (res[key] = p.stdout.toString()); }
}
const ls = ore("ls", ["ls"]) as any[];
const arch = ore("ls --archived", ["ls", "--archived"]) as any[];
for (const k of ["skills", "cards", "stats", "today", "questions", "tries", "chat", "doctor"]) ore(k, [k]);
ore("due --all", ["due", "--all"]);
ore("search spacing", ["search", "spacing"]);
for (const i of [...(Array.isArray(ls) ? ls : []), ...(Array.isArray(arch) ? arch : [])]) {
  const id = i.id ?? i.meta?.id;
  ore(`show ${id}`, ["show", id]);
  ore(`ann ${id}`, ["show", id, "--annotations"]);
  ore(`notes ${id}`, ["notes", id]);
  ore(`backlinks ${id}`, ["backlinks", id]);
}
for (const c of (res.cards as any[]) ?? []) ore(`card ${c.id ?? c.meta?.id}`, ["card", "show", c.id ?? c.meta?.id]);
ore("notes skill learning", ["notes", "--skill", "learning"]);
ore("chat old-chat", ["chat", "old-chat"]);
writeFileSync(out, JSON.stringify(res, null, 1));
console.log(Object.keys(res).length, "reads;", Object.entries(res).filter(([, v]) => (v as any)?.ERROR).map(([k, v]) => `${k}: ${(v as any).ERROR}`).join("\n"));
