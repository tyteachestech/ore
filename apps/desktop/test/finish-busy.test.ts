import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The finish panel's Continue while it works. A source finished partway waits there for the AI's key points (they
// say which questions he hasn't reached, D100), up to a minute, under "Saving…": he took a save for stuck
// (F735, the simulated learner run of 2026-11-25). The label is drawn in the panel (waits.test.ts wants it beside
// its spinner), so this reads it there.
test("Continue says what it is waiting for: a part left out, the key points of a source finished partway, or a save", () => {
  const src = readFileSync(join(import.meta.dir, "../src/Finish.tsx"), "utf8");
  expect(src).toContain('<Working label={leave.trim() ? "Leaving that out…" : scoped && finding ? "Finding the key points…" : "Saving…"} />');
  // The same test of "is anything left out" decides the wait and its label, and it says so only while the key
  // points are still being found: not on the iPhone, which finds none, or once that has failed.
  expect(src).toContain("if (!scoped) return n;");
  expect(src).toContain('ore<{ prequestions: Prequestion[] }>("key-points", doc.id).finally(() => setFinding(false))');
});
