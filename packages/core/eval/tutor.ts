// Tutor pedagogy eval: does the tutor teach as D128 says? Hints, not answers, on practice; the answer on
// "show me" or after two tries; Quiz me asks one question and gives feedback with no score; Practice sets
// an open exercise; his own questions get a cited answer; small talk stays small. Each case in
// tutor-cases.json is one turn over the golden docs and the checks its reply must pass. Spends AI usage,
// so by hand only: `bun run eval:tutor` (--vendor claude|codex, --model <id>).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { Usage, Vendor } from "../src/ai/adapter.ts";
import { tutor } from "../src/ai/tutor.ts";
import { addGolden } from "./ask.ts";
import { columns, costText, pct, pool, range, resultPath, setId, wilson, withVendor } from "./grade.ts";

const Expect = z.strictObject({
  hint: z.boolean().optional(),
  gives: z.array(z.string()).optional(),
  withholds: z.array(z.string()).optional(),
  exercise: z.boolean().optional(),
  asks: z.boolean().optional(),
  cites: z.boolean().optional(),
  no_score: z.boolean().optional(),
  no_search: z.boolean().optional(),
  max_chars: z.number().optional(),
});
const TutorCase = z.strictObject({
  id: z.string(), message: z.string(), reading: z.string().optional(),
  earlier: z.array(z.strictObject({ message: z.string(), reply: z.string() })).optional(),
  expect: Expect,
});
export type TutorCase = z.infer<typeof TutorCase>;

export const loadTutorCases = (path = join(import.meta.dir, "tutor-cases.json")) => z.object({ cases: z.array(TutorCase) }).parse(JSON.parse(readFileSync(path, "utf8"))).cases;

/** What a reply did, for the checks. */
export interface Reply { reply: string; hint: boolean; exercise: boolean; cited: number; searched: boolean }

// A score, grade or rating ("7/10", "8 out of 10", "B+", "you scored"): he rates his own cards (D21).
const SCORE = /\b\d+\s*(?:\/|out of)\s*\d+\b|\b(?:score|grade|rating)\b|\b[A-F][+-](?=\s|$)/i;

/** The checks a reply fails, by name; none means it passed. */
export function failures(e: z.infer<typeof Expect>, r: Reply): string[] {
  const out: string[] = [];
  if (e.hint !== undefined && r.hint !== e.hint) out.push(e.hint ? "not a hint" : "a hint");
  for (const p of e.gives ?? []) if (!new RegExp(p, "i").test(r.reply)) out.push(`no /${p}/`);
  for (const p of e.withholds ?? []) if (new RegExp(p, "i").test(r.reply)) out.push(`gave /${p}/`);
  if (e.exercise !== undefined && r.exercise !== e.exercise) out.push(e.exercise ? "no exercise" : "an exercise");
  // Asks: it puts a question to him ("Is that a sign of weak minds? Explain…" counts).
  if (e.asks && !r.reply.includes("?")) out.push("doesn't ask");
  if (e.cites && !r.cited) out.push("no citation");
  if (e.no_score && SCORE.test(r.reply)) out.push("a score");
  if (e.no_search && r.searched) out.push("searched the web");
  if (e.max_chars && r.reply.length > e.max_chars) out.push(`${r.reply.length} chars`);
  return out;
}

export interface TutorResult { id: string; ok: boolean; failed: string[]; reply?: string; ms: number; usage?: Usage; error?: string }

export function runTutorEval(vendor: Vendor, model?: string, concurrency = 4) {
  const cases = loadTutorCases();
  return withVendor(vendor, model, async (root) => {
    const lib = { root };
    const names = await addGolden(lib);
    const id = (golden: string) => [...names].find(([, n]) => n === golden)?.[0];
    let stamp = { model: model ?? "", prompt_version: "" };
    const t0 = performance.now();
    const results = await pool(cases, concurrency, async (c): Promise<TutorResult> => {
      const start = performance.now();
      try {
        const r = await tutor(lib, c.message, { earlier: c.earlier ?? [], item: c.reading ? id(c.reading) : undefined });
        stamp = r.ai;
        const failed = failures(c.expect, { reply: r.reply, hint: r.hint, exercise: !!r.exercise, cited: r.citations.length, searched: r.searched });
        return { id: c.id, ok: !failed.length, failed, reply: r.reply, ms: Math.round(performance.now() - start), usage: r.usage };
      } catch (e) {
        return { id: c.id, ok: false, failed: ["error"], ms: Math.round(performance.now() - start), error: (e as Error).message };
      }
    });
    const ok = results.filter((r) => r.ok).length;
    const costs = results.map((r) => r.usage?.cost_usd).filter((x): x is number => x !== undefined);
    return {
      vendor, model: stamp.model || "(no run succeeded)", prompt_version: stamp.prompt_version,
      passed: `${ok}/${results.length}`, accuracy: ok / results.length, ci95: wilson(ok, results.length),
      errors: results.filter((r) => r.error).length, wall_s: Math.round((performance.now() - t0) / 100) / 10,
      ...(costs.length ? { cost_usd: costs.reduce((a, b) => a + b, 0) } : {}),
      input_tokens: results.reduce((s, r) => s + (r.usage?.input_tokens ?? 0), 0), output_tokens: results.reduce((s, r) => s + (r.usage?.output_tokens ?? 0), 0),
      cases: results,
    };
  });
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const vendors = args.flatMap((a, i) => (args[i - 1] === "--vendor" ? [a] : [])) as Vendor[];
  if (vendors.some((v) => v !== "claude" && v !== "codex")) throw new Error("--vendor must be claude or codex");
  const pick: Vendor[] = vendors.length ? vendors : ["claude", "codex"];
  if (args.includes("--model") && pick.length > 1) throw new Error("--model needs one --vendor");
  const model = args.includes("--model") ? args[args.indexOf("--model") + 1] : undefined;
  const runs = [];
  for (const v of pick) {
    console.error(`Tutoring with ${v}…`);
    const r = await runTutorEval(v, model);
    for (const c of r.cases.filter((c) => !c.ok)) console.error(`  miss ${c.id}: ${c.error ?? c.failed.join(", ")} | ${c.reply?.replace(/\s+/g, " ").slice(0, 200)}`);
    runs.push(r);
  }
  const dir = join(import.meta.dir, "results");
  mkdirSync(dir, { recursive: true });
  const out = resultPath(dir, new Date(), "tutor");
  writeFileSync(out, JSON.stringify({ eval: "tutor", date: new Date().toISOString(), set: setId([loadTutorCases()]), runs }, null, 2) + "\n");
  console.log(columns(["vendor", "model", "passed", "95% CI", "cost", "time", "errors"], runs.map((r) => [r.vendor, r.model, `${pct(r.accuracy)} (${r.passed})`, range(r.ci95), costText(r), `${r.wall_s}s`, String(r.errors)])));
  console.log(`\nSaved ${out}`);
}
