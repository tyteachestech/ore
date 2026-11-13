import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Threads build in parallel and each takes "the next" decision number, so two can land on the same
// one (D123 and D124 both did, 2026-11-06). CI runs on the PR merged with master, so this catches it.
test("every decision in DECISIONS.md has its own number", () => {
  const text = readFileSync(join(import.meta.dir, "..", "..", "..", "docs", "DECISIONS.md"), "utf8");
  const seen = new Map<string, number>();
  for (const [, n] of text.matchAll(/^- (D\d+)\./gm)) seen.set(n!, (seen.get(n!) ?? 0) + 1);
  expect([...seen].filter(([, c]) => c > 1).map(([n]) => n)).toEqual([]);
});

// A placeholder row numbered on one side of a merge can come back beside its numbered copy, since
// `merge=union` keeps both sides' lines (the glint's placeholder row stayed next to D257, 2026-11-13).
test("no decision is written twice under two ids", () => {
  const text = readFileSync(join(import.meta.dir, "..", "..", "..", "docs", "DECISIONS.md"), "utf8");
  const ids = new Map<string, string[]>();
  // Keyed on how it opens, so a word changed further on, on one side of the merge, still counts as the same decision.
  for (const [, id, body] of text.matchAll(/^- (D[\w-]+)\. (.+)$/gm)) {
    const key = body!.toLowerCase().replace(/\s+/g, " ").slice(0, 120);
    ids.set(key, [...(ids.get(key) ?? []), id!]);
  }
  expect([...ids.values()].filter((v) => v.length > 1)).toEqual([]);
});
