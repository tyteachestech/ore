// CI gate for Impeccable's detector: fails when apps/desktop/src has a finding the baseline doesn't.
// Findings are counted per file and anti-pattern (not line, so edits above one don't move it).
//   bun apps/desktop/scripts/mock/impeccable-gate.ts            check
//   bun apps/desktop/scripts/mock/impeccable-gate.ts --update   accept today's findings (say why in the PR)
import { join, relative } from "node:path";

const root = join(import.meta.dir, "../../../..");
const baselinePath = join(import.meta.dir, "impeccable-baseline.json");
const run = Bun.spawnSync([join(root, ".claude/skills/impeccable/scripts/impeccable"), "detect", "apps/desktop/src", "--no-advisory", "--json"], { cwd: root });
// The detector exits 0 when clean and 2 with findings; anything else (or no JSON) means it didn't run.
if (![0, 2].includes(run.exitCode ?? -1) || !run.stdout.toString().trim().startsWith("[")) {
  console.log(`impeccable did not run (exit ${run.exitCode}): ${run.stderr.toString().slice(0, 500)}`);
  process.exit(1);
}
const found: { antipattern: string; file: string; line: number; name: string }[] = JSON.parse(run.stdout.toString());
const counts: Record<string, number> = {};
for (const f of found) {
  const key = `${relative(root, f.file)}\t${f.antipattern}`;
  counts[key] = (counts[key] ?? 0) + 1;
}

if (process.argv.includes("--update")) {
  const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  await Bun.write(baselinePath, JSON.stringify(sorted, null, 2) + "\n");
  console.log(`baseline: ${found.length} findings`);
  process.exit(0);
}

const baseline: Record<string, number> = await Bun.file(baselinePath).json();
const fresh = Object.entries(counts).filter(([key, n]) => n > (baseline[key] ?? 0));
for (const [key] of fresh) {
  const [file, antipattern] = key.split("\t");
  for (const f of found.filter((f) => relative(root, f.file) === file && f.antipattern === antipattern)) console.log(`new: ${file}:${f.line} ${f.name}`);
}
console.log(fresh.length ? `${fresh.length} new Impeccable findings: fix them, or accept with --update and say why in the PR` : "impeccable: no new findings");
process.exit(fresh.length ? 1 : 0);
