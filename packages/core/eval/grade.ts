// Grading eval: runs Ore's grader on the golden cards in grade-cases.json with each AI vendor and
// scores it against the labels. It spends real AI usage, so it runs only by hand: `bun run eval:grade`
// (never in CI). Flags: --vendor claude|codex (repeatable, default both), --model <id> (with one vendor).
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import type { Usage, Vendor } from "../src/ai/adapter.ts";
import { gradeShown } from "../src/ai/grade.ts";
import { initLibrary } from "../src/init.ts";

const Case = z.strictObject({
  id: z.string(),
  level: z.enum(["easy", "partial", "tricky"]),
  kind: z.enum(["card", "prompt"]),
  question: z.string(),
  model_answer: z.string(),
  rubric: z.array(z.string()),
  answer: z.string(),
  label: z.enum(["right", "wrong"]),
});
export type Case = z.infer<typeof Case>;

export function loadCases(path = join(import.meta.dir, "grade-cases.json")): Case[] {
  return z.object({ cases: z.array(Case) }).parse(JSON.parse(readFileSync(path, "utf8"))).cases;
}

/** Good or Easy counts as right; Again or Hard as wrong. */
export const verdict = (rating: number) => (rating >= 3 ? "right" : "wrong");

export interface CaseResult { id: string; level: Case["level"]; label: Case["label"]; rating?: number; got?: "right" | "wrong"; correct: boolean; ms: number; usage?: Usage; error?: string }
export interface VendorRun { vendor: Vendor; model: string; prompt_version: string; accuracy: number; correct: number; total: number; by_level: Record<string, string>; errors: number; wall_s: number; cost_usd?: number; input_tokens: number; output_tokens: number; cases: CaseResult[] }

/** Scores one vendor's results: an error counts as a miss. */
export function score(vendor: Vendor, model: string, prompt_version: string, cases: CaseResult[], wall_s: number): VendorRun {
  const correct = cases.filter((c) => c.correct).length;
  const by_level: Record<string, string> = {};
  for (const lvl of ["easy", "partial", "tricky"]) {
    const of = cases.filter((c) => c.level === lvl);
    if (of.length) by_level[lvl] = `${of.filter((c) => c.correct).length}/${of.length}`;
  }
  const costs = cases.map((c) => c.usage?.cost_usd).filter((x): x is number => x !== undefined);
  const sum = (k: "input_tokens" | "output_tokens") => cases.reduce((n, c) => n + (c.usage?.[k] ?? 0), 0);
  return {
    vendor, model, prompt_version,
    accuracy: cases.length ? correct / cases.length : 0, correct, total: cases.length, by_level,
    errors: cases.filter((c) => c.error).length, wall_s,
    ...(costs.length ? { cost_usd: costs.reduce((a, b) => a + b, 0) } : {}),
    input_tokens: sum("input_tokens"), output_tokens: sum("output_tokens"),
    cases,
  };
}

async function pool<T, R>(items: T[], n: number, f: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await f(items[i]!); }
  }));
  return out;
}

/** Grades every case with one vendor in a scratch library (so his own skills.yaml plays no part). */
export async function runVendor(vendor: Vendor, cases: Case[], model?: string, concurrency = 4): Promise<VendorRun> {
  const root = mkdtempSync(join(tmpdir(), "ore-eval-"));
  const saved = { ai: process.env.ORE_AI, model: process.env.ORE_AI_MODEL };
  process.env.ORE_AI = vendor;
  if (model) process.env.ORE_AI_MODEL = model;
  else delete process.env.ORE_AI_MODEL;
  let stamp = { model: model ?? "", prompt_version: "" };
  const t0 = performance.now();
  try {
    await initLibrary(root);
    const results = await pool(cases, concurrency, async (c): Promise<CaseResult> => {
      const start = performance.now();
      const base = { id: c.id, level: c.level, label: c.label };
      try {
        const r = await gradeShown({ root }, { kind: c.kind, question: c.question, model_answer: c.model_answer, rubric: c.rubric }, c.answer);
        stamp = r.ai;
        const got = verdict(r.data.rating);
        return { ...base, rating: r.data.rating, got, correct: got === c.label, ms: Math.round(performance.now() - start), usage: r.usage };
      } catch (e) {
        return { ...base, correct: false, ms: Math.round(performance.now() - start), error: (e as Error).message };
      }
    });
    return score(vendor, stamp.model || "(no run succeeded)", stamp.prompt_version, results, Math.round((performance.now() - t0) / 100) / 10);
  } finally {
    rmSync(root, { recursive: true, force: true });
    for (const [k, v] of [["ORE_AI", saved.ai], ["ORE_AI_MODEL", saved.model]] as const) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
}

/** Where today's results go: results/grade-YYYY-MM-DD.json, with -2, -3… for a second run that day. */
export function resultPath(dir: string, now = new Date()): string {
  const day = now.toISOString().slice(0, 10);
  for (let n = 1; ; n++) {
    const p = join(dir, `grade-${day}${n > 1 ? `-${n}` : ""}.json`);
    if (!existsSync(p)) return p;
  }
}

export function table(runs: VendorRun[]): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const rows = runs.map((r) => [
    r.vendor, r.model, `${pct(r.accuracy)} (${r.correct}/${r.total})`,
    Object.entries(r.by_level).map(([k, v]) => `${k} ${v}`).join(", "),
    r.cost_usd === undefined ? `${r.input_tokens + r.output_tokens} tokens` : `$${r.cost_usd.toFixed(3)}`,
    `${r.wall_s}s`, String(r.errors),
  ]);
  const head = ["vendor", "model", "accuracy", "by level", "cost", "time", "errors"];
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
  const cases = loadCases();
  const runs: VendorRun[] = [];
  for (const v of pick) {
    console.error(`Grading ${cases.length} cards with ${v}…`);
    const r = await runVendor(v, cases, args.includes("--model") ? model : undefined);
    for (const c of r.cases.filter((c) => !c.correct)) console.error(`  miss ${c.id}: labeled ${c.label}, ${c.error ? `error: ${c.error}` : `rated ${c.rating}`}`);
    runs.push(r);
  }
  const dir = join(import.meta.dir, "results");
  mkdirSync(dir, { recursive: true });
  const out = resultPath(dir);
  writeFileSync(out, JSON.stringify({ eval: "grade", date: new Date().toISOString(), cases: cases.length, runs }, null, 2) + "\n");
  console.log(table(runs));
  console.log(`\nSaved ${out}`);
}
