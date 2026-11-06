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
