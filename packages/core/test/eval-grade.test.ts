import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codexUsage } from "../src/ai/adapter.ts";
import { loadCases, resultPath, runVendor, table, verdict } from "../eval/grade.ts";

// A fake `claude` that rates each answer by a word in it, and reports usage the way `claude -p` does.
let binDir = "";
const savedPath = process.env.PATH;
beforeEach(() => {
  binDir = mkdtempSync(join(tmpdir(), "ore-fakebin-"));
  process.env.PATH = `${binDir}:${savedPath}`;
  writeFileSync(join(binDir, "claude"), `#!/usr/bin/env bun
const msg = process.argv[process.argv.indexOf("-p") + 1];
const input = JSON.parse(msg.slice(msg.indexOf("{")));
if (input.answer === "boom") { console.log(JSON.stringify({ is_error: true, result: "Not logged in" })); process.exit(0); }
const rating = /Canberra|CO2/.test(input.answer) ? 3 : 1;
console.log(JSON.stringify({ is_error: false, structured_output: { rating, gaps: [], feedback: "ok", covered: input.rubric.map(() => true) },
  total_cost_usd: 0.002, usage: { input_tokens: 100, cache_read_input_tokens: 50, output_tokens: 20 }, modelUsage: { "claude-fake-1": { outputTokens: 20 } } }));
`);
  chmodSync(join(binDir, "claude"), 0o755);
});
afterEach(() => { process.env.PATH = savedPath; });

describe("grading eval", () => {
  test("the golden set is 20 labeled cards: half right, half wrong, every level, unique ids", () => {
    const cases = loadCases();
    expect(cases).toHaveLength(20);
    expect(new Set(cases.map((c) => c.id)).size).toBe(20);
    expect(cases.filter((c) => c.label === "right")).toHaveLength(10);
    for (const lvl of ["easy", "partial", "tricky"]) expect(cases.filter((c) => c.level === lvl).length).toBeGreaterThanOrEqual(5);
    for (const c of cases) if (c.kind === "prompt") expect(c.rubric.length).toBeGreaterThan(0);
  });

  test("Good and Easy count as right, Again and Hard as wrong", () => {
    expect([1, 2, 3, 4].map(verdict)).toEqual(["wrong", "wrong", "right", "right"]);
  });

  test("runs the real grader on each card and scores it, with cost, tokens and time; a failed run is a miss", async () => {
    const cases = loadCases().filter((c) => c.level === "easy").slice(0, 4); // Canberra, Sydney, no idea, CO2
    cases.push({ ...cases[0]!, id: "fails", answer: "boom" });
    const r = await runVendor("claude", cases);
    expect(r.model).toBe("claude-fake-1");
    expect(r.prompt_version).toBe("grade@2");
    expect(r.cases.map((c) => [c.id, c.got, c.correct])).toEqual([
      ["easy-capital", "right", true], ["easy-capital-wrong", "wrong", true], ["easy-blank", "wrong", true], ["easy-photosynthesis", "right", true], ["fails", undefined, false],
    ]);
    expect(r.cases[4]!.error).toContain("Not logged in");
    expect([r.correct, r.total, r.accuracy, r.errors]).toEqual([4, 5, 0.8, 1]);
    expect(r.by_level).toEqual({ easy: "4/5" });
    expect(r.cost_usd).toBeCloseTo(0.008);
    expect([r.input_tokens, r.output_tokens]).toEqual([600, 80]);
    expect(process.env.ORE_AI).toBeUndefined(); // the vendor pick doesn't leak out of the run
    expect(table([r])).toContain("80% (4/5)");
  });

  test("codex usage is summed from its turn.completed events", () => {
    const out = ['{"type":"thread.started","thread_id":"t"}', '{"type":"turn.completed","usage":{"input_tokens":900,"cached_input_tokens":800,"output_tokens":40}}', "not json"].join("\n");
    expect(codexUsage(out)).toEqual({ input_tokens: 900, output_tokens: 40 });
  });

  test("results go in a dated file, numbered when the day already has one", () => {
    const dir = mkdtempSync(join(tmpdir(), "ore-eval-out-"));
    const day = new Date("2026-11-07T12:00:00Z");
    expect(resultPath(dir, day)).toBe(join(dir, "grade-2026-11-07.json"));
    writeFileSync(join(dir, "grade-2026-11-07.json"), "{}");
    expect(resultPath(dir, day)).toBe(join(dir, "grade-2026-11-07-2.json"));
  });
});
