// bun writes.ts <lib>: master's writes on an old library: reimport every source, review every due card, a highlight
// and a note edit on an old source, doctor; reports highlights that lost their place, and errors.
import { join } from "node:path";
const [lib] = process.argv.slice(2) as [string];
const CLI = "/home/user/ore/packages/cli/src/ore.ts";
const env = { ...process.env, ORE_LIBRARY: lib, ORE_NO_ENRICH: "1", ORE_AI: "none" };
const out: string[] = [];
function ore(args: string[], stdin?: string): any {
  const p = Bun.spawnSync(["bun", CLI, ...args, "--json"], { env, stdin: stdin ? Buffer.from(stdin) : undefined });
  if (p.exitCode !== 0) { out.push(`FAIL ${args.join(" ").slice(0, 120)}: ${p.stderr.toString().trim().split("\n").pop()}`); return undefined; }
  try { return JSON.parse(p.stdout.toString()); } catch { return p.stdout.toString(); }
}
const anchors = (id: string) => {
  const a = ore(["show", id, "--annotations"]);
  const rows: any[] = Array.isArray(a) ? a : a?.annotations ?? [];
  return rows.map((r) => `${r.id}:${r.anchor?.status ?? r.status ?? r.anchor_status ?? "?"}:${r.exact ?? r.anchor?.exact ?? ""}`.slice(0, 90));
};
const items: any[] = [...(ore(["ls"]) ?? []), ...(ore(["ls", "--archived"]) ?? [])];
for (const i of items) {
  const before = anchors(i.id);
  const r = ore(["reimport", i.id]);
  if (!r) continue;
  const after = anchors(i.id);
  const lost = before.filter((b) => !after.some((a) => a.split(":")[0] === b.split(":")[0]));
  const moved = after.filter((a) => !before.includes(a));
  if (lost.length || moved.length || r.removed?.length || r.unplaced?.length) out.push(`reimport ${i.title?.slice(0, 40)} (${i.type ?? i.content_type}): lost ${JSON.stringify(lost)} changed ${JSON.stringify(moved)} removed ${JSON.stringify(r.removed ?? [])} unplaced ${JSON.stringify(r.unplaced ?? [])}`);
}
const due: any[] = ore(["due", "--all"]) ?? [];
const list = Array.isArray(due) ? due : due.cards ?? due.queue ?? [];
for (const c of list.slice(0, 15)) ore(["review", c.id ?? c.card?.id ?? c.meta?.id, "--rating", "3", "--confidence", "2", "--answer", "new answer"]);
const first = items[0];
const shown = ore(["show", first.id]);
const exact = String(shown?.body ?? "").match(/[A-Z][a-z]+ [a-z]+ [a-z]+/)?.[0];
if (exact) ore(["highlight", first.id, "--exact", exact, "--intent", "keep"]);
const n = ore(["notes", first.id]);
ore(["notes", first.id, "--set", (n?.text ?? "") + "\nAdded by master.\n", "--base", n?.text ?? ""]);
ore(["reindex"]);
out.push("doctor: " + JSON.stringify(ore(["doctor"])?.issues ?? "failed"));
console.log(out.join("\n"));
