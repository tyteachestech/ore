import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codexUsage } from "../src/ai/adapter.ts";
import { writeNewCard } from "../src/cards.ts";
import { addSnippet } from "../src/ingest/index.ts";
import { recordReview } from "../src/study.ts";
import { baseline, type Case, kappa, loadCases, loadSets, OUTSIDE, resultPath, runVendor, setId, summarize, table, verdict, wilson } from "../eval/grade.ts";
import { disagreements } from "../eval/mine.ts";
import { tempLibrary } from "./helpers.ts";

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
const rating = /Canberra|spread|Sydney/.test(input.answer) ? 3 : 1;
console.log(JSON.stringify({ is_error: false, structured_output: { rating, gaps: [], feedback: "ok", covered: input.rubric.map(() => true), evidence: input.rubric.map(() => "") },
  total_cost_usd: 0.002, usage: { input_tokens: 100, cache_read_input_tokens: 50, output_tokens: 20 }, modelUsage: { "claude-fake-1": { outputTokens: 20 } } }));
`);
  chmodSync(join(binDir, "claude"), 0o755);
});
afterEach(() => { process.env.PATH = savedPath; });

describe("grading eval", () => {
  test("the golden set is at least 20 labeled cards with reasons: about half right, every level, unique ids", () => {
    const cases = loadCases(); // it may grow with eval:mine
    expect(cases.length).toBeGreaterThanOrEqual(20);
    const right = cases.filter((c) => c.label === "right").length / cases.length;
    expect(right).toBeGreaterThanOrEqual(0.4);
    expect(right).toBeLessThanOrEqual(0.6);
    for (const lvl of ["easy", "partial", "tricky"]) expect(cases.filter((c) => c.level === lvl).length).toBeGreaterThanOrEqual(4);
    for (const lvl of ["partial", "tricky"]) { // the hard levels test both ways of failing
      expect(cases.some((c) => c.level === lvl && c.label === "right")).toBe(true);
      expect(cases.some((c) => c.level === lvl && c.label === "wrong")).toBe(true);
    }
    expect(setId(cases)).toMatch(/^[0-9a-f]{8}$/);
    // String matching alone gets little more than "always wrong" would: the set needs a real grader.
    expect(baseline(cases).correct / cases.length).toBeLessThanOrEqual(0.6);
    for (const c of cases) if (c.kind === "prompt") expect(c.rubric.length).toBeGreaterThan(0);
  });

  test("the outside slices load as cases: SAF 60 (20 correct, 20 partial, 20 incorrect), SciEntsBank 83 (20 each, 3 non_domain), ids unique across all sets, every label a reason", () => {
    const [saf, seb] = OUTSIDE.map((p) => loadCases(p)) as [Case[], Case[]];
    const count = (cs: Case[]) => Object.fromEntries([...new Set(cs.map((c) => c.level))].map((l) => [l, cs.filter((c) => c.level === l).length]));
    expect(count(saf)).toEqual({ correct: 20, partial: 20, incorrect: 20 });
    expect(count(seb)).toEqual({ correct: 20, contradictory: 20, incomplete: 20, irrelevant: 20, non_domain: 3 });
    // The datasets' own verdicts map onto Ore's line: only their "correct" is right.
    for (const c of [...saf, ...seb]) expect(c.label).toBe(c.level === "correct" ? "right" : "wrong");
    const all = loadSets([join(import.meta.dir, "../eval/grade-cases.json"), ...OUTSIDE]);
    expect(all).toHaveLength(20 + 60 + 83);
    expect(() => loadSets([OUTSIDE[0]!, OUTSIDE[0]!])).toThrow("unique across sets");
  });

  test("Cohen's kappa: a grader that says wrong to everything on a mostly-wrong set scores 0, perfect agreement 1", () => {
    const mk = (label: "right" | "wrong", got: "right" | "wrong") => ({ label, got });
    expect(kappa([mk("wrong", "wrong"), mk("wrong", "wrong"), mk("wrong", "wrong"), mk("right", "wrong")])).toBe(0); // 75% accuracy, no skill
    expect(kappa([mk("wrong", "wrong"), mk("right", "right")])).toBe(1);
    expect(kappa([mk("wrong", "right"), mk("right", "wrong")])).toBe(-1);
    expect(kappa([])).toBe(0);
    // A missing verdict (an error) counts as disagreement, not as "right".
    expect(kappa([mk("wrong", "wrong"), mk("right", "right"), { label: "right" }])).toBeCloseTo(0.4);
  });

  test("repeated runs summarize to mean, spread, flipped verdicts and cases missed in any run", () => {
    const run = (verdicts: Record<string, "right" | "wrong">): Parameters<typeof summarize>[0][number] => {
      const cases = Object.entries(verdicts).map(([id, got]) => ({ id, level: "easy", label: "right" as const, got, correct: got === "right", ms: 1 }));
      return { accuracy: cases.filter((c) => c.correct).length / cases.length, cases } as Parameters<typeof summarize>[0][number];
    };
    const s = summarize([run({ a: "right", b: "right", c: "wrong" }), run({ a: "right", b: "wrong", c: "wrong" })]);
    expect(s.mean).toBeCloseTo(0.5);
    expect(s.sd).toBeCloseTo(0.2357);
    expect(s.flips).toEqual(["b"]);
    expect(s.missed).toEqual(["b", "c"]);
    expect(summarize([run({ a: "right" })]).sd).toBe(0);
  });

  test("Good and Easy count as right, Again and Hard as wrong", () => {
    expect([1, 2, 3, 4].map(verdict)).toEqual(["wrong", "wrong", "right", "right"]);
  });

  test("runs the real grader on each card and scores it, with cost, tokens and time; a failed run is a miss", async () => {
    const mk = (id: string, answer: string, label: Case["label"]): Case => ({ id, level: "easy", kind: "card", question: "Capital of Australia?", model_answer: "Canberra.", rubric: [], answer, label, why: "test" });
    const cases = [mk("easy-capital", "Canberra", "right"), mk("easy-capital-wrong", "Sydney", "wrong"), mk("easy-blank", "no idea", "wrong"), mk("easy-spacing", "Canberra, I think", "right"), mk("fails", "boom", "right")];
    const r = await runVendor("claude", cases);
    expect(r.model).toBe("claude-fake-1");
    expect(r.prompt_version).toBe("grade@3");
    expect(r.cases.map((c) => [c.id, c.got, c.correct])).toEqual([
      ["easy-capital", "right", true], ["easy-capital-wrong", "right", false], ["easy-blank", "wrong", true], ["easy-spacing", "right", true], ["fails", undefined, false],
    ]);
    expect(r.cases[4]!.error).toContain("Not logged in");
    expect(r.cases[0]!.feedback).toBe("ok"); // kept for reading the misses
    expect([r.correct, r.total, r.accuracy, r.errors]).toEqual([3, 5, 0.6, 1]);
    // Sydney graded right is a false pass; the failed run is an error, not a false fail.
    expect([r.false_pass, r.false_fail]).toEqual([1, 0]);
    expect(r.by_level).toEqual({ easy: "3/5" });
    expect(r.cost_usd).toBeCloseTo(0.008);
    expect([r.input_tokens, r.output_tokens]).toEqual([600, 80]);
    expect(process.env.ORE_AI).toBeUndefined(); // the vendor pick doesn't leak out of the run
    expect(table([r])).toContain("60% (3/5)");
    expect(table([r])).toContain("23–88%");
    expect(r.kappa).toBe(0.167); // 60% accuracy on a 60%-right set with one false pass and one error: little beyond chance
    expect(table([r])).toContain("0.17");
  });

  test("loadCases refuses duplicate ids; the baseline never passes an empty model answer", () => {
    const dir = mkdtempSync(join(tmpdir(), "ore-eval-cases-"));
    const c = loadCases()[0]!;
    writeFileSync(join(dir, "c.json"), JSON.stringify({ cases: [c, c] }));
    expect(() => loadCases(join(dir, "c.json"))).toThrow("unique");
    expect(baseline([{ ...c, model_answer: "→", answer: "no idea", label: "wrong" }]).correct).toBe(1);
  });

  test("accuracy carries its 95% Wilson interval: 20/20 is only known to be at least 84%", () => {
    expect(wilson(20, 20).map((x) => Math.round(x * 100))).toEqual([84, 100]);
    expect(wilson(18, 20).map((x) => Math.round(x * 100))).toEqual([70, 97]);
    expect(wilson(0, 0)).toEqual([0, 1]);
  });

  test("eval:mine turns real reviews where Tyler overrode the grader across the line into labeled candidates", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Retrieval practice strengthens memory." });
    const card = writeNewCard(lib, { kind: "prompt", item: item.meta.id, skills: ["learning"], topics: [], content_type: "concept", question: "Why does testing help?", answer: "Retrieval strengthens memory.", rubric: ["Retrieval strengthens memory"] });
    const at = (d: number) => new Date(Date.parse("2026-11-01T12:00:00Z") + d * 864e5);
    await recordReview(lib, card.meta.id, { rating: 3, ai_rating: 2, confidence: 2, answer: "pulling it out makes it stick", now: at(1) }); // disagree: he passed it
    await recordReview(lib, card.meta.id, { rating: 4, ai_rating: 3, confidence: 3, answer: "it strengthens memory", now: at(5) }); // same side
    await recordReview(lib, card.meta.id, { rating: 1, ai_rating: 4, confidence: 1, now: at(9) }); // no typed answer
    const found = disagreements(lib);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ kind: "prompt", question: "Why does testing help?", rubric: ["Retrieval strengthens memory"], answer: "pulling it out makes it stick", label: "right", level: "tricky" });
    expect(found[0]!.why).toContain("the grader proposed 2, Tyler recorded 3");
    expect(found[0]!.id).toMatch(/^real-[0-9a-z]{6}-20261102\d{6}$/); // to the second: two on one day differ
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
