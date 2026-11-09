// Tutor pedagogy eval: does the tutor teach as D128 says? Hints, not answers, on practice; the answer on
// "show me" or after two tries; Quiz me asks one question and gives feedback with no score; Practice sets
// an open exercise; his own questions get a cited answer; small talk stays small. Each case in
// tutor-cases.json is one turn over the golden docs and the checks its reply must pass. Spends AI usage,
// so by hand only: `bun run eval:tutor` (--vendor claude|codex, --model <id>, --runs <n>, --against <git ref or file>).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { addUsage, runAgent, type Usage, type Vendor } from "../src/ai/adapter.ts";
import type { Library } from "../src/library.ts";
import { Exercise, tutor, withSteps } from "../src/ai/tutor.ts";
import { usePromptText } from "../src/ai/prompts.ts";
import { addGolden } from "./ask.ts";
import { columns, costText, pct, pool, range, resultPath, setId, wilson, withVendor } from "./grade.ts";

const Expect = z.strictObject({
  hint: z.boolean().optional(),
  gives: z.array(z.string()).optional(),
  withholds: z.array(z.string()).optional(),
  exercise: z.boolean().optional(),
  /** It offers a card: after exercise feedback that found a point missing, the committed one (D158). */
  card: z.boolean().optional(),
  /** A worked answer split into steps he reveals one at a time (D142). */
  steps: z.boolean().optional(),
  asks: z.boolean().optional(),
  cites: z.boolean().optional(),
  no_score: z.boolean().optional(),
  no_search: z.boolean().optional(),
  max_chars: z.number().optional(),
  /** Checks a regex can't make, read by a judge model (prompts/judge.md): "it never states the result for a gap of 4". */
  judge: z.array(z.string()).optional(),
});
const TutorCase = z.strictObject({
  id: z.string(), message: z.string(), reading: z.string().optional(),
  earlier: z.array(z.strictObject({ message: z.string(), reply: z.string(), exercise: Exercise.optional() })).optional(),
  expect: Expect,
});
export type TutorCase = z.infer<typeof TutorCase>;

export const loadTutorCases = (path = join(import.meta.dir, "tutor-cases.json")) => z.object({ cases: z.array(TutorCase) }).parse(JSON.parse(readFileSync(path, "utf8"))).cases;

/** What a reply did, for the checks. */
export interface Reply { reply: string; hint: boolean; exercise: boolean; card?: boolean; steps: number; cited: number; searched: boolean }

// A score, grade or rating of his answer ("7/10", "8 out of 10", "B+", "you scored"): he rates his own
// cards (D21). A fraction from the material ("about 1/4 is left") is not one.
const SCORE = /\b\d+\s*(?:\/|out of)\s*(?:5|10|100)\b(?!\s*%)|\b(?:you )?scored?\b|\bgrade (?:of|is|:)|\brat(?:e|ing) (?:it|this|your answer)\b|\b[A-F][+-](?=\s|$)/i;

/** The earlier turns as he saw them: a committed exercise card (D158) is hidden from him, so from the judge too. */
const shown = (earlier: { message: string; reply: string }[]) => earlier.map(({ message, reply }) => ({ message, reply }));

/** The checks a reply fails, by name; none means it passed. */
export function failures(e: z.infer<typeof Expect>, r: Reply): string[] {
  const out: string[] = [];
  if (e.hint !== undefined && r.hint !== e.hint) out.push(e.hint ? "not a hint" : "a hint");
  for (const p of e.gives ?? []) if (!new RegExp(p, "i").test(r.reply)) out.push(`no /${p}/`);
  for (const p of e.withholds ?? []) if (new RegExp(p, "i").test(r.reply)) out.push(`gave /${p}/`);
  if (e.exercise !== undefined && r.exercise !== e.exercise) out.push(e.exercise ? "no exercise" : "an exercise");
  if (e.card !== undefined && !!r.card !== e.card) out.push(e.card ? "no card" : "a card");
  if (e.steps !== undefined && r.steps > 0 !== e.steps) out.push(e.steps ? "no steps" : "steps");
  // Asks: it puts a question to him ("Is that a sign of weak minds? Explain…" counts).
  // A question mark inside a quote ("you said … 'how much is recalled?'") isn't one put to him.
  if (e.asks && !r.reply.replace(/"[^"\n]*"|“[^”\n]*”/g, "").includes("?")) out.push("doesn't ask");
  if (e.cites && !r.cited) out.push("no citation");
  if (e.no_score && SCORE.test(r.reply)) out.push("a score");
  if (e.no_search && r.searched) out.push("searched the web");
  if (e.max_chars && r.reply.length > e.max_chars) out.push(`${r.reply.length} chars`);
  return out;
}

export interface TutorResult { id: string; ok: boolean; failed: string[]; reply?: string; ms: number; usage?: Usage; error?: string; evidence?: string[] }

const Verdicts = z.object({ checks: z.array(z.object({ passed: z.boolean(), evidence: z.string() })) });

/** The judge's checks a reply fails, each named "judge: <check>", with the words that decided each. */
export async function judged(lib: Library, c: TutorCase, reply: string): Promise<{ failed: string[]; evidence: string[]; usage: Usage }> {
  const checks = c.expect.judge ?? [];
  const { data, usage } = await runAgent(lib, {
    prompt: "judge", cwd: lib.root, schema: Verdicts,
    input: { learner: c.message, ...(c.earlier?.length ? { earlier: shown(c.earlier) } : {}), reply, checks },
    check: (d) => (d.checks.length === checks.length ? null : `return ${checks.length} checks, one per check`),
  });
  return { failed: checks.filter((_, i) => !data.checks[i]!.passed).map((k) => `judge: ${k}`), evidence: data.checks.map((v) => v.evidence), usage };
}

/** Pooled over every run of every case: how many passed, and the cases that passed only some runs. */
export function summary(runs: TutorResult[][]) {
  const all = runs.flat();
  const ok = all.filter((r) => r.ok).length;
  const ids = [...new Set(all.map((r) => r.id))];
  const flaky = ids.flatMap((id) => {
    const k = all.filter((r) => r.id === id && r.ok).length, n = all.filter((r) => r.id === id).length;
    return k && k < n ? [`${id} ${k}/${n}`] : [];
  });
  return { passed: `${ok}/${all.length}`, accuracy: all.length ? ok / all.length : 0, ci95: wilson(ok, all.length), flaky };
}

/** The tutor's reply to one case, its steps written out. */
async function replyTo(lib: Library, c: TutorCase, id: (golden: string) => string | undefined) {
  if (c.reading && !id(c.reading)) throw new Error(`${c.id}: no golden doc ${c.reading}`);
  const r = await tutor(lib, c.message, { earlier: c.earlier ?? [], item: c.reading ? id(c.reading) : undefined });
  return { r, said: withSteps(r) };
}

const Better = z.object({ better: z.enum(["A", "B", "same"]), why: z.string() });
export type Pick = "new" | "old" | "same";

/** The comparator saw the new reply as A unless `flipped`: which one it picked. */
export const unblind = (better: z.infer<typeof Better>["better"], flipped: boolean): Pick =>
  better === "same" ? "same" : (better === "A") !== flipped ? "new" : "old";

/** New against old over every case and run, and the cases where the old prompt won at least once. */
export function tally(picks: { id: string; pick: Pick }[]) {
  const n = (p: Pick) => picks.filter((x) => x.pick === p).length;
  return { new: n("new"), old: n("old"), same: n("same"), old_won: [...new Set(picks.filter((x) => x.pick === "old").map((x) => x.id))] };
}

/** Blind A/B (skill-creator's comparator): each case answered by today's tutor prompt and by `oldRaw`
 *  (an older tutor.md), then a judge model, shown the two in random order, says which teaches better. */
export function compareTutor(vendor: Vendor, model: string | undefined, oldRaw: string, runs = 1, concurrency = 4) {
  const cases = loadTutorCases();
  return withVendor(vendor, model, async (root) => {
    const lib = { root };
    const names = await addGolden(lib);
    const id = (golden: string) => [...names].find(([, n]) => n === golden)?.[0];
    const each = Array.from({ length: runs }, () => cases).flat();
    const answer = () => pool(each, concurrency, (c) => replyTo(lib, c, id).then((x) => ({ said: x.said, ai: x.r.ai, usage: x.r.usage }), (e: Error) => ({ error: e.message })));
    const now = await answer();
    usePromptText("tutor", oldRaw);
    const was = await answer().finally(() => usePromptText("tutor"));
    const versions = (xs: typeof now) => [...new Set(xs.flatMap((x) => ("ai" in x ? [x.ai.prompt_version] : [])))].join(", ");
    const picks = await pool(each.map((c, i) => [c, i] as const), concurrency, async ([c, i]) => {
      const a = now[i]!, b = was[i]!;
      if (!("said" in a) || !("said" in b)) return { id: c.id, pick: "same" as Pick, why: "", error: ("error" in a ? a.error : "") || ("error" in b ? b.error : "") };
      const flipped = Math.random() < 0.5;
      const [A, B] = flipped ? [b.said, a.said] : [a.said, b.said];
      try {
        const { data, usage } = await runAgent(lib, {
          prompt: "compare", cwd: lib.root, schema: Better,
          input: { learner: c.message, ...(c.earlier?.length ? { earlier: shown(c.earlier) } : {}), ...(c.expect.judge?.length ? { checks: c.expect.judge } : {}), A, B },
        });
        return { id: c.id, pick: unblind(data.better, flipped), why: data.why, new: a.said, old: b.said, usage: addUsage(addUsage(a.usage, b.usage), usage) };
      } catch (e) {
        return { id: c.id, pick: "same" as Pick, why: "", error: (e as Error).message };
      }
    });
    const ok = picks.filter((p) => !p.error);
    const costs = picks.map((p) => p.usage?.cost_usd).filter((x): x is number => x !== undefined);
    return { vendor, new_prompt: versions(now), old_prompt: versions(was), runs, ...tally(ok), errors: picks.length - ok.length, ...(costs.length ? { cost_usd: costs.reduce((x, y) => x + y, 0) } : {}), cases: picks };
  });
}

export function runTutorEval(vendor: Vendor, model?: string, runs = 1, concurrency = 4) {
  const cases = loadTutorCases();
  return withVendor(vendor, model, async (root) => {
    const lib = { root };
    const names = await addGolden(lib);
    const id = (golden: string) => [...names].find(([, n]) => n === golden)?.[0];
    let stamp = { model: model ?? "", prompt_version: "" };
    const t0 = performance.now();
    const each = Array.from({ length: runs }, () => cases).flat();
    const results = await pool(each, concurrency, async (c): Promise<TutorResult> => {
      const start = performance.now();
      try {
        const { r, said } = await replyTo(lib, c, id);
        stamp = r.ai;
        const failed = failures(c.expect, { reply: said, hint: r.hint, exercise: !!r.exercise, card: !!r.card, steps: r.steps.length, cited: r.citations.length, searched: r.searched });
        const ms = Math.round(performance.now() - start); // the tutor's reply time, not the judge's
        if (!c.expect.judge?.length) return { id: c.id, ok: !failed.length, failed, reply: said, ms, usage: r.usage };
        const j = await judged(lib, c, said);
        return { id: c.id, ok: !failed.length && !j.failed.length, failed: [...failed, ...j.failed], reply: said, ms, usage: addUsage(r.usage, j.usage), evidence: j.evidence };
      } catch (e) {
        return { id: c.id, ok: false, failed: ["error"], ms: Math.round(performance.now() - start), error: (e as Error).message };
      }
    });
    const byRun = Array.from({ length: runs }, (_, i) => results.slice(i * cases.length, (i + 1) * cases.length));
    const costs = results.map((r) => r.usage?.cost_usd).filter((x): x is number => x !== undefined);
    return {
      vendor, model: stamp.model || "(no run succeeded)", prompt_version: stamp.prompt_version, runs,
      ...summary(byRun),
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
  if (args.includes("--model") && !model) throw new Error("--model needs a model id");
  const runs = args.includes("--runs") ? Number(args[args.indexOf("--runs") + 1]) : 1;
  if (!Number.isInteger(runs) || runs < 1) throw new Error("--runs needs a whole number, 1 or more");
  const against = args.includes("--against") ? args[args.indexOf("--against") + 1] : undefined;
  if (args.includes("--against") && !against) throw new Error("--against needs a git ref or a tutor.md file");
  const dir = join(import.meta.dir, "results");
  mkdirSync(dir, { recursive: true });
  if (against) {
    // An older tutor.md: a file, or the prompt as it was at a git ref ("HEAD~3", a commit, a branch).
    const old = existsSync(against) ? readFileSync(against, "utf8") : Bun.spawnSync(["git", "show", `${against}:packages/core/src/ai/prompts/tutor.md`], { cwd: import.meta.dir }).stdout.toString();
    if (!old.trim()) throw new Error(`--against ${against}: no tutor.md there`);
    const out_runs = [];
    for (const v of pick) {
      console.error(`Comparing with ${v}${runs > 1 ? `, ${runs} runs` : ""}…`);
      const r = await compareTutor(v, model, old, runs);
      for (const c of r.cases.filter((c) => c.pick === "old" || c.error)) console.error(`  ${c.error ? `error ${c.id}: ${c.error}` : `old won ${c.id}: ${c.why}`}`);
      out_runs.push(r);
    }
    const out = resultPath(dir, new Date(), "tutor-compare");
    writeFileSync(out, JSON.stringify({ eval: "tutor-compare", against, date: new Date().toISOString(), set: setId([loadTutorCases()]), runs: out_runs }, null, 2) + "\n");
    console.log(columns(["vendor", "new", "old", "new wins", "old wins", "same", "cost", "errors"], out_runs.map((r) => [r.vendor, r.new_prompt, r.old_prompt, String(r.new), String(r.old), String(r.same), r.cost_usd === undefined ? "?" : `$${r.cost_usd.toFixed(2)}`, String(r.errors)])));
    console.log(`\nSaved ${out}`);
    process.exit(0);
  }
  const out_runs = [];
  for (const v of pick) {
    console.error(`Tutoring with ${v}${runs > 1 ? `, ${runs} runs` : ""}…`);
    const r = await runTutorEval(v, model, runs);
    for (const c of r.cases.filter((c) => !c.ok)) console.error(`  miss ${c.id}: ${c.error ?? c.failed.join(", ")} | ${c.reply?.replace(/\s+/g, " ").slice(0, 200)}`);
    if (r.flaky.length) console.error(`  passed only some runs: ${r.flaky.join(", ")}`);
    out_runs.push(r);
  }
  const out = resultPath(dir, new Date(), "tutor");
  writeFileSync(out, JSON.stringify({ eval: "tutor", date: new Date().toISOString(), set: setId([loadTutorCases()]), runs: out_runs }, null, 2) + "\n");
  console.log(columns(["vendor", "model", "passed", "95% CI", "cost", "time", "errors"], out_runs.map((r) => [r.vendor, r.model, `${pct(r.accuracy)} (${r.passed})`, range(r.ci95), costText(r), `${r.wall_s}s`, String(r.errors)])));
  console.log(`\nSaved ${out}`);
}
