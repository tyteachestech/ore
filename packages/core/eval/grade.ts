// Grading eval: runs Ore's grader on the golden cards in grade-cases.json with each AI vendor and
// scores it against the labels. It spends real AI usage, so it runs only by hand: `bun run eval:grade`
// (never in CI). Flags: --vendor claude|codex (repeatable, default both), --model <id> (with one vendor),
// --cases <file> (repeatable; default the golden set; outside/*.json are the public slices), --runs N (each
// vendor N times: mean accuracy, its spread, and the cases whose verdict flipped between runs).
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import type { Usage, Vendor } from "../src/ai/adapter.ts";
import { gradeShown } from "../src/ai/grade.ts";
import { initLibrary } from "../src/init.ts";

const Case = z.strictObject({
  id: z.string(),
  level: z.string().min(1), // golden: easy|partial|tricky; outside sets keep their dataset's own label names
  kind: z.enum(["card", "prompt"]),
  question: z.string(),
  model_answer: z.string(),
  rubric: z.array(z.string()),
  answer: z.string(),
  label: z.enum(["right", "wrong"]),
  why: z.string().min(1), // the label's reason, so a disputed label can be argued with
});
export type Case = z.infer<typeof Case>;

export function loadCases(path = join(import.meta.dir, "grade-cases.json")): Case[] {
  return z.object({ cases: z.array(Case).refine((cs) => new Set(cs.map((c) => c.id)).size === cs.length, "case ids must be unique") })
    .parse(JSON.parse(readFileSync(path, "utf8"))).cases;
}

/** The public slices beside the golden set (provenance: outside/README.md). */
export const OUTSIDE = ["saf", "scientsbank"].map((n) => join(import.meta.dir, "outside", `grade-${n}.json`));

/** Several case files as one set; ids must stay unique across them. */
export function loadSets(paths: string[]): Case[] {
  const cases = paths.flatMap((p) => loadCases(p));
  if (new Set(cases.map((c) => c.id)).size !== cases.length) throw new Error("case ids must be unique across sets");
  return cases;
}

/** A short fingerprint of the case set, saved with each result: scores from different sets don't compare. */
export const setId = (cases: unknown[]) => createHash("sha256").update(JSON.stringify(cases)).digest("hex").slice(0, 8);

/** Good or Easy counts as right; Again or Hard as wrong. */
export const verdict = (rating: number) => (rating >= 3 ? "right" : "wrong");

export interface CaseResult { id: string; level: Case["level"]; label: Case["label"]; rating?: number; got?: "right" | "wrong"; correct: boolean; feedback?: string; ms: number; usage?: Usage; error?: string }
export interface VendorRun { vendor: Vendor; model: string; prompt_version: string; accuracy: number; ci95: [number, number]; kappa: number; correct: number; total: number; false_pass: number; false_fail: number; by_level: Record<string, string>; errors: number; wall_s: number; cost_usd?: number; input_tokens: number; output_tokens: number; cases: CaseResult[] }

/** The 95% Wilson interval for k right out of n: with 20 cases one miss moves accuracy 5 points, so a
 *  score is only as sharp as this range (20/20 means at least 84%). */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (!n) return [0, 1];
  const p = k / n, d = 1 + (z * z) / n;
  const mid = (p + (z * z) / (2 * n)) / d, half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, mid - half), Math.min(1, mid + half)];
}

/** Cohen's kappa between the grader's verdicts and the labels: agreement beyond what the two would reach
 *  by chance given how often each says "right". On a set that is 70% wrong, a grader saying "wrong" every
 *  time scores 70% accuracy and kappa 0; Husain and the grading literature report kappa for this reason.
 *  Above 0.8 is near-perfect, 0.6–0.8 substantial (Landis and Koch). */
export function kappa(cases: { label: "right" | "wrong"; got?: "right" | "wrong" }[]): number {
  const n = cases.length;
  if (!n) return 0;
  const agree = cases.filter((c) => c.got === c.label).length / n;
  const pr = (k: "label" | "got") => cases.filter((c) => c[k] === "right").length / n;
  const chance = pr("label") * pr("got") + (1 - pr("label")) * (1 - pr("got"));
  return chance === 1 ? 1 : (agree - chance) / (1 - chance);
}

/** Scores one vendor's results: an error counts as a miss. A false pass (a wrong answer graded right)
 *  is the costly miss: the card is scheduled far out while he doesn't know it. A false fail brings it
 *  back too soon. */
export function score(vendor: Vendor, model: string, prompt_version: string, cases: CaseResult[], wall_s: number): VendorRun {
  const correct = cases.filter((c) => c.correct).length;
  const by_level: Record<string, string> = {};
  for (const lvl of [...new Set(cases.map((c) => c.level))]) {
    const of = cases.filter((c) => c.level === lvl);
    by_level[lvl] = `${of.filter((c) => c.correct).length}/${of.length}`;
  }
  const costs = cases.map((c) => c.usage?.cost_usd).filter((x): x is number => x !== undefined);
  const sum = (k: "input_tokens" | "output_tokens") => cases.reduce((n, c) => n + (c.usage?.[k] ?? 0), 0);
  return {
    vendor, model, prompt_version,
    accuracy: cases.length ? correct / cases.length : 0, ci95: wilson(correct, cases.length), kappa: Math.round(kappa(cases) * 1000) / 1000, correct, total: cases.length,
    false_pass: cases.filter((c) => c.label === "wrong" && c.got === "right").length,
    false_fail: cases.filter((c) => c.label === "right" && c.got === "wrong").length,
    by_level,
    errors: cases.filter((c) => c.error).length, wall_s,
    ...(costs.length ? { cost_usd: costs.reduce((a, b) => a + b, 0) } : {}),
    input_tokens: sum("input_tokens"), output_tokens: sum("output_tokens"),
    cases,
  };
}

/** The no-AI floor (Eugene Yan's advice: beat string matching first): an answer is right when it
 *  contains the model answer, ignoring case and punctuation. A grader that can't clear this adds nothing. */
export function baseline(cases: Case[]): { correct: number; total: number } {
  const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const got = (c: Case) => (norm(c.model_answer) && norm(c.answer).includes(norm(c.model_answer)) ? "right" : "wrong");
  return { correct: cases.filter((c) => got(c) === c.label).length, total: cases.length };
}

export async function pool<T, R>(items: T[], n: number, f: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await f(items[i]!); }
  }));
  return out;
}

/** Runs `f` with ORE_AI (and ORE_AI_MODEL) set to one vendor in a fresh scratch library, so his own
 *  skills.yaml plays no part; both come back as they were. */
export async function withVendor<T>(vendor: Vendor, model: string | undefined, f: (root: string) => Promise<T>): Promise<T> {
  const root = mkdtempSync(join(tmpdir(), "ore-eval-"));
  const saved = { ai: process.env.ORE_AI, model: process.env.ORE_AI_MODEL };
  process.env.ORE_AI = vendor;
  if (model) process.env.ORE_AI_MODEL = model;
  else delete process.env.ORE_AI_MODEL;
  try {
    await initLibrary(root);
    return await f(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
    for (const [k, v] of [["ORE_AI", saved.ai], ["ORE_AI_MODEL", saved.model]] as const) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
}

/** Grades every case with one vendor. */
export function runVendor(vendor: Vendor, cases: Case[], model?: string, concurrency = 4): Promise<VendorRun> {
  return withVendor(vendor, model, async (root) => {
    let stamp = { model: model ?? "", prompt_version: "" };
    const t0 = performance.now();
    const results = await pool(cases, concurrency, async (c): Promise<CaseResult> => {
      const start = performance.now();
      const base = { id: c.id, level: c.level, label: c.label };
      try {
        const r = await gradeShown({ root }, { kind: c.kind, question: c.question, model_answer: c.model_answer, rubric: c.rubric }, c.answer);
        stamp = r.ai;
        const got = verdict(r.data.rating);
        return { ...base, rating: r.data.rating, got, correct: got === c.label, feedback: [...r.data.gaps, r.data.feedback].join(" "), ms: Math.round(performance.now() - start), usage: r.usage };
      } catch (e) {
        return { ...base, correct: false, ms: Math.round(performance.now() - start), error: (e as Error).message };
      }
    });
    return score(vendor, stamp.model || "(no run succeeded)", stamp.prompt_version, results, Math.round((performance.now() - t0) / 100) / 10);
  });
}

/** Where today's results go: results/<eval>-YYYY-MM-DD.json, with -2, -3… for a second run that day. */
export function resultPath(dir: string, now = new Date(), name = "grade"): string {
  const day = now.toISOString().slice(0, 10);
  for (let n = 1; ; n++) {
    const p = join(dir, `${name}-${day}${n > 1 ? `-${n}` : ""}.json`);
    if (!existsSync(p)) return p;
  }
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const range = ([lo, hi]: [number, number]) => `${Math.round(lo * 100)}–${Math.round(hi * 100)}%`;
export const costText = (r: { cost_usd?: number; input_tokens: number; output_tokens: number }) =>
  r.cost_usd === undefined ? `${r.input_tokens + r.output_tokens} tokens` : `$${r.cost_usd.toFixed(3)}`;

export function table(runs: VendorRun[]): string {
  return columns(["vendor", "model", "accuracy", "95% CI", "kappa", "false pass", "false fail", "by level", "cost", "time", "errors"], runs.map((r) => [
    r.vendor, r.model, `${pct(r.accuracy)} (${r.correct}/${r.total})`, range(r.ci95), r.kappa.toFixed(2), String(r.false_pass), String(r.false_fail),
    Object.entries(r.by_level).map(([k, v]) => `${k} ${v}`).join(", "),
    costText(r), `${r.wall_s}s`, String(r.errors),
  ]));
}

/** Repeated runs of one vendor, read together (skill-creator's benchmark: mean and spread over runs, and
 *  which cases are flaky): a case that flips between runs is one the grader is unsure of, and a prompt
 *  change that moves accuracy by less than the spread has not been shown to do anything. */
export function summarize(runs: VendorRun[]): { mean: number; sd: number; flips: string[]; missed: string[] } {
  const acc = runs.map((r) => r.accuracy);
  const mean = acc.reduce((a, b) => a + b, 0) / (acc.length || 1);
  const sd = acc.length > 1 ? Math.sqrt(acc.reduce((a, b) => a + (b - mean) ** 2, 0) / (acc.length - 1)) : 0;
  const ids = [...new Set(runs.flatMap((r) => r.cases.map((c) => c.id)))];
  const flips = ids.filter((id) => new Set(runs.map((r) => r.cases.find((c) => c.id === id)?.got)).size > 1);
  const missed = ids.filter((id) => runs.some((r) => r.cases.find((c) => c.id === id)?.correct === false));
  return { mean, sd, flips, missed };
}

export function columns(head: string[], rows: string[][]): string {
  const w = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i]!.length)));
  return [head, ...rows].map((r) => r.map((c, i) => c.padEnd(w[i]!)).join("  ")).join("\n");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const vendors = args.flatMap((a, i) => (args[i - 1] === "--vendor" ? [a] : [])) as Vendor[];
  const model = args[args.indexOf("--model") + 1];
  if (vendors.some((v) => v !== "claude" && v !== "codex")) throw new Error("--vendor must be claude or codex");
  const pick: Vendor[] = vendors.length ? vendors : ["claude", "codex"];
  if (args.includes("--model") && pick.length > 1) throw new Error("--model needs one --vendor");
  const files = args.flatMap((a, i) => (args[i - 1] === "--cases" ? [a] : []));
  const times = args.includes("--runs") ? Number(args[args.indexOf("--runs") + 1]) : 1;
  if (!Number.isInteger(times) || times < 1) throw new Error("--runs needs a whole number");
  const cases = files.length ? loadSets(files) : loadCases();
  const runs: VendorRun[] = [];
  const summary: Record<string, ReturnType<typeof summarize>> = {};
  for (const v of pick) {
    const mine: VendorRun[] = [];
    for (let n = 1; n <= times; n++) {
      console.error(`Grading ${cases.length} cards with ${v}${times > 1 ? ` (run ${n} of ${times})` : ""}…`);
      const r = await runVendor(v, cases, args.includes("--model") ? model : undefined);
      // Each miss with the label's reason and the grader's, to read side by side (error analysis).
      for (const c of r.cases.filter((c) => !c.correct)) {
        console.error(`  miss ${c.id}: labeled ${c.label}, ${c.error ? `error: ${c.error}` : `rated ${c.rating}`}`);
        console.error(`    label: ${cases.find((x) => x.id === c.id)?.why}${c.feedback ? `\n    grader: ${c.feedback}` : ""}`);
      }
      mine.push(r);
    }
    runs.push(...mine);
    if (times > 1) summary[v] = summarize(mine);
  }
  const base = baseline(cases);
  const dir = join(import.meta.dir, "results");
  mkdirSync(dir, { recursive: true });
  const out = resultPath(dir);
  writeFileSync(out, JSON.stringify({ eval: "grade", date: new Date().toISOString(), cases: cases.length, sets: files.length ? files.map((f) => f.replace(/^.*\//, "")) : ["grade-cases.json"], set: setId(cases), baseline: base, runs, ...(times > 1 ? { summary } : {}) }, null, 2) + "\n");
  console.log(table(runs));
  for (const [v, s] of Object.entries(summary))
    console.log(`\n${v} over ${times} runs: mean ${pct(s.mean)} ± ${Math.round(s.sd * 100)} points; ${s.flips.length} of ${cases.length} verdicts flipped between runs${s.flips.length ? ` (${s.flips.join(", ")})` : ""}; missed in some run: ${s.missed.length}`);
  console.log(`\nNo-AI baseline (answer contains the model answer): ${pct(base.correct / base.total)} (${base.correct}/${base.total})`);
  console.log(`Saved ${out}`);
}
