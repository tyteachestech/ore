import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { mustAnswer } from "../src/ore";

// F346 (review of #440): which `ore` commands call the AI was written three times (the app's
// "must answer", the phone's "needs AI", the mock bridge's), and they disagreed: `check --covered`, a plain write
// of his own marks (Finish's flip), was one that must answer, so a run that printed nothing read as a failure.
test("only a command that answers with what the AI said must answer: not his own marks stored by check --covered", () => {
  expect(mustAnswer(["check", "01ABC", "2"])).toBe(true);
  expect(mustAnswer(["check", "01ABC", "2", "--covered", "1,0"])).toBe(false);
  expect(mustAnswer(["check", "01ABC", "2", "--covered=1,0"])).toBe(false);
  expect(mustAnswer(["recall", "01ABC", "--feedback"])).toBe(true);
  expect(mustAnswer(["recall", "01ABC", "--text", "what I recall"])).toBe(false);
  expect(mustAnswer(["tutor", "01ABC"])).toBe(true);
});

test("the phone and the mock bridge ask the same list which commands call the AI", () => {
  for (const f of ["src/phone/core.ts", "scripts/mock/bridge.ts"]) {
    const src = readFileSync(join(import.meta.dir, "..", f), "utf8");
    expect({ f, uses: /\bcallsAi\(/.test(src), own: /\[\s*"(grade|enrich|tutor)"/.test(src) }).toEqual({ f, uses: true, own: false });
  }
});
