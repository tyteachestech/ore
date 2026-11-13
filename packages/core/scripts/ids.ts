// `bun run ids`: gives each new finding and decision its number at merge time.
// A branch writes a new row as `F-new-<slug>` in docs/reviews/findings.md and a new decision as
// `D-new-<slug>` in docs/DECISIONS.md, and mentions it by that name anywhere (tests, journeys, docs).
// Run after the last rebase onto origin/master: each placeholder becomes the next free number,
// in the order it appears in its file, everywhere in the repo. Open PRs never claim the same number.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const FINDINGS = "docs/reviews/findings.md";
export const DECISIONS = "docs/DECISIONS.md";
const NAME = "new-[a-z0-9]+(?:-[a-z0-9]+)*";
const PLACEHOLDER = new RegExp(`\\b[FD]-${NAME}\\b`, "g");

/** Maps every placeholder to its number, from the two files that define them. */
export function numbers(findings: string, decisions: string): Map<string, string> {
  const out = new Map<string, string>();
  const take = (text: string, defined: RegExp, used: RegExp, prefix: string) => {
    let next = Math.max(0, ...[...text.matchAll(used)].map((m) => Number(m[1]))) + 1;
    for (const [, name] of text.matchAll(defined)) if (!out.has(name!)) out.set(name!, `${prefix}${next++}`);
  };
  take(findings, new RegExp(`^\\| (F-${NAME}) \\|`, "gm"), /^\| F(\d+) \|/gm, "F");
  take(decisions, new RegExp(`^- (D-${NAME})\\. `, "gm"), /^- D(\d+)\. /gm, "D");
  return out;
}

/** Replaces each placeholder in a text; throws on one no file defines. */
export function renumber(text: string, map: Map<string, string>): string {
  return text.replace(PLACEHOLDER, (name) => {
    const n = map.get(name);
    if (!n) throw new Error(`${name} is used but has no row in ${name.startsWith("F") ? FINDINGS : DECISIONS}`);
    return n;
  });
}

/** The findings table with its rows in number order: a merge of master puts a branch's new rows above the
 *  rows master added since, and the findings test wants F1, F2, … (twice moved by hand, 2026-11-13). */
export function ordered(findings: string): string {
  const lines = findings.split("\n");
  const at = lines.flatMap((l, i) => (/^\| F\d+ \|/.test(l) ? [i] : []));
  const rows = at.map((i) => lines[i]!).sort((x, y) => Number(x.match(/\d+/)![0]) - Number(y.match(/\d+/)![0]));
  at.forEach((i, n) => (lines[i] = rows[n]!));
  return lines.join("\n");
}

if (import.meta.main) {
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  const read = (f: string) => readFileSync(join(root, f), "utf8");
  const map = numbers(read(FINDINGS), read(DECISIONS));
  let files: string[] = [];
  try {
    files = execFileSync("git", ["grep", "-lE", "\\b[FD]-new-[a-z0-9]"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  } catch {} // git grep exits 1 when nothing matches
  files = files.filter((f) => !f.endsWith("scripts/ids.ts") && !f.endsWith("test/ids.test.ts"));
  const out = files.map((f) => [f, renumber(read(f), map)] as const); // all or nothing: a bad name writes no file
  for (const [f, text] of out) writeFileSync(join(root, f), text);
  writeFileSync(join(root, FINDINGS), ordered(read(FINDINGS)));
  for (const [name, n] of map) console.log(`${name} → ${n}`);
  if (!map.size) console.log("no new findings or decisions");
}
