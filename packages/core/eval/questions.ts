// Question-quality eval: are the questions Ore's AI writes good learning material? Each case in
// question-cases.json is one source used the way he uses it: added (enrich writes the prequestions he
// guesses before reading and answers in the in-reader quiz), then highlighted and finished (enrich plans
// his review exercises and turns each prequestion into one). Every question is checked by code
// (`codeFailures`) and by a judge model that reads the source (question-judge.md), and each plan by
// whether it drafted a card from a highlight a good plan skips. Spends AI usage, so by hand only:
// `bun run eval:questions` (--vendor claude|codex, --model <id> for the writer; --judge <model>, default opus).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { z } from "zod";
import { vendorSchema, type Usage, type Vendor } from "../src/ai/adapter.ts";
import { enrichItem } from "../src/ai/enrich.ts";
import { loadPrompt } from "../src/ai/prompts.ts";
import { addHighlight, addPoint, readAnnotations, reviseAnnotation } from "../src/annotations.ts";
import { listCards, type Card } from "../src/cards.ts";
import { parseFrontmatter } from "../src/frontmatter.ts";
import { initLibrary } from "../src/init.ts";
import { createItem, findItem, ItemType, setItemStatus, updateItemMeta, type Item } from "../src/items.ts";
import type { Library } from "../src/library.ts";
import { sharedRun } from "../src/remix.ts";
import { loadSkills } from "../src/skills.ts";
import { GOLDEN } from "./ask.ts";
import { columns, costText, pct, pool, range, resultPath, setId, wilson, withVendor } from "./grade.ts";

const Highlight = z.strictObject({
  exact: z.string().min(1), intent: z.enum(["keep", "card", "apply"]), note: z.string().optional(), reflection: z.string().optional(),
  /** A good plan gives it no card: a stray word, an aside whose note names no idea. */
  skip: z.boolean().optional(),
});
const QuestionCase = z.strictObject({
  id: z.string(), source: z.string().regex(/^(golden|eval):[\w-]+$/),
  highlights: z.array(Highlight).min(1),
  points: z.array(z.strictObject({ at: z.string().min(1), note: z.string().min(1) })).optional(),
  missed: z.array(z.string()).optional(),
});
export type QuestionCase = z.infer<typeof QuestionCase>;

export const loadQuestionCases = (path = join(import.meta.dir, "question-cases.json")) =>
  z.object({ cases: z.array(QuestionCase).refine((cs) => new Set(cs.map((c) => c.id)).size === cs.length, "case ids must be unique") })
    .parse(JSON.parse(readFileSync(path, "utf8"))).cases;

export const SOURCES = join(import.meta.dir, "question-sources");
export const sourcePath = (source: string) => {
  const [where, name] = source.split(":") as [string, string];
  return join(where === "golden" ? GOLDEN : SOURCES, `${name}.md`);
};

/** The case's source as an item in the library, as a capture would leave it. */
export async function addSource(lib: Library, source: string): Promise<Item> {
  const { data, body } = parseFrontmatter<{ type?: string; title?: string; author?: string; url?: string }>(readFileSync(sourcePath(source), "utf8"));
  return createItem(lib, { type: ItemType.safeParse(data.type).data ?? "article", title: data.title ?? basename(source), author: data.author, url: data.url, body });
}

/** Reads it the way the case says: its highlights, lines and tries, what his recall missed, then Finish.
 *  Returns the ids of the highlights a good plan skips. */
export async function readAndFinish(lib: Library, item: Item, c: QuestionCase): Promise<Set<string>> {
  const skip = new Set<string>();
  for (const h of c.highlights) {
    const a = addHighlight(item, { exact: h.exact, intent: h.intent, note: h.note });
    if (h.intent === "apply") reviseAnnotation(item, a, { status: "done", reflection: h.reflection });
    if (h.skip) skip.add(a.id);
  }
  for (const p of c.points ?? []) {
    const at = item.body.indexOf(p.at);
    if (at < 0) throw new Error(`${c.id}: point "${p.at}" not in the source`);
    addPoint(item, { at, note: p.note, intent: "card" });
  }
  if (c.missed?.length) {
    const ai = { vendor: "eval", model: "eval", prompt_version: "eval" };
    await updateItemMeta(lib, item.meta.id, (m) => ({ ...m, recall: { ...m.recall, feedback: { feedback: "", questions: [], missed: c.missed!, ai } } }));
  }
  await setItemStatus(lib, item.meta.id, "done");
  return skip;
}

export type Kind = "prequestion" | "card" | "prompt";
/** One question the AI wrote, as the judge sees it. */
export interface Question { n: number; kind: Kind; question: string; answer?: string; rubric?: string[]; from?: "highlights" | "prequestion" | "try" | "notes" | "line" }

// Pointing at the source instead of naming it: a card is seen among other subjects months later (enrich
// "must stand alone"), and a prequestion asks about the idea, not what the source says (prequestion-framing).
const POINTS_AT = /\b(?:the|this) (?:article|author|essay|video|speaker|talk|post|piece|text|passage|document|chapter|reading|writer|source|tutorial)\b/i;
const ATTRIBUTED = /\baccording to\b|\bwhat does .{1,40} (?:say|argue|claim|recommend)\b/i;
// "Name the three…", "list all…" on a card: one retrieval target per card (D118); a set is a prompt with a rubric point per item.
const LIST_ALL = /\b(?:name|list|what are|give) (?:all |the |each of the )?(?:two|three|four|five|six|seven|\d+)\b|\blist (?:all|every)\b/i;
/** A card is a short answer to recall; a paragraph is a prompt in a card's clothes. */
export const CARD_ANSWER_MAX = 200;
/** This many words in a row from the source and the question is its sentence, turned around or with a word
 *  taken out: answerable from the sentence's shape, and it helps that sentence only (D182, step 4). */
export const LIFTED_RUN = 8;

/** The checks a question fails by code, by name; none means it passed them. */
export function codeFailures(q: Question, author?: string, source?: string): string[] {
  const out: string[] = [];
  // Letters only, so a name like "Smith)" or "C++" makes no broken pattern.
  const surname = author?.split(/[^\p{L}]+/u).filter((w) => w.length > 2).pop();
  if (q.kind === "prequestion") {
    if (ATTRIBUTED.test(q.question) || POINTS_AT.test(q.question) || (surname && new RegExp(`\\b${surname}\\b`, "i").test(q.question))) out.push("code:attributed");
    return out;
  }
  if (POINTS_AT.test(q.question)) out.push("code:points_at_source");
  if (q.kind === "card" && LIST_ALL.test(q.question)) out.push("code:list_all");
  if (q.kind === "card" && (q.answer?.length ?? 0) > CARD_ANSWER_MAX) out.push("code:long_card_answer");
  // A blank is read with its word back in, so the source's sentence with one word hidden counts.
  if (source && sharedRun(q.question.replace(/_{4,}/g, () => q.answer ?? ""), { question: source, answer: "" }, LIFTED_RUN)) out.push("code:lifted");
  return out;
}

const PreJudged = z.strictObject({ n: z.number().int(), attemptable: z.boolean(), central: z.boolean(), deep: z.boolean(), answered: z.boolean(), why: z.string() });
const CardJudged = z.strictObject({
  n: z.number().int(), faithful: z.boolean(), clear_target: z.boolean(), no_giveaway: z.boolean(), blank_fits: z.boolean(), one_target: z.boolean(),
  rubric_fits: z.boolean(), worth_it: z.boolean(), standalone: z.boolean(), distinct: z.boolean(), attribution: z.boolean(), why: z.string(),
});
const Judged = z.strictObject({ prequestions: z.array(PreJudged), cards: z.array(CardJudged) });
export type Judged = z.infer<typeof Judged>;

/** The judge's checks an item failed, by name. */
export const judgeFailures = (j: Record<string, unknown>): string[] => Object.entries(j).filter(([, v]) => v === false).map(([k]) => k);

const JUDGE = readFileSync(join(import.meta.dir, "question-judge.md"), "utf8").trim();

/** One judge call over a source's questions: `claude -p` with only Read, on a model other than the
 *  writer's by default, so it isn't marking its own work. Retried once on bad output. */
async function judge(cwd: string, docPath: string, input: object, model: string): Promise<{ data: Judged; usage: Usage; model: string }> {
  const bin = Bun.which("claude");
  if (!bin) throw new Error("the judge runs on Claude Code: no `claude` on PATH");
  let message = `Task input (JSON):\n${JSON.stringify(input, null, 2)}\n\nFiles to read:\n- ${docPath}`;
  let usage: Usage = { input_tokens: 0, output_tokens: 0, cost_usd: 0 };
  for (let attempt = 1; ; attempt++) {
    const p = Bun.spawn([
      bin, "-p", message, "--output-format", "json", "--json-schema", JSON.stringify(vendorSchema(Judged)), "--system-prompt", JUDGE,
      "--tools", "Read", "--allowedTools", "Read", "--permission-mode", "dontAsk",
      "--strict-mcp-config", "--disable-slash-commands", "--setting-sources", "", "--no-session-persistence", "--model", model,
    ], { cwd, stdout: "pipe", stderr: "pipe" });
    const [out, err] = [await new Response(p.stdout).text(), await new Response(p.stderr).text()];
    await p.exited;
    try {
      const r = JSON.parse(out) as { structured_output?: unknown; result?: string; is_error?: boolean; total_cost_usd?: number; usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }; modelUsage?: Record<string, unknown> };
      const u = r.usage ?? {};
      usage = { input_tokens: usage.input_tokens + (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0), output_tokens: usage.output_tokens + (u.output_tokens ?? 0), cost_usd: (usage.cost_usd ?? 0) + (r.total_cost_usd ?? 0) };
      if (r.is_error) throw new Error(r.result ?? "judge failed");
      const data = Judged.parse(r.structured_output ?? JSON.parse(String(r.result)));
      return { data, usage, model: Object.keys(r.modelUsage ?? {})[0] ?? model };
    } catch (e) {
      if (attempt === 2) throw new Error(`judge: ${(e as Error).message.slice(0, 300)}${err ? ` (${err.trim().split("\n").pop()})` : ""}`);
      message += `\n\nYour previous output was invalid: ${(e as Error).message.slice(0, 300)}. Return only JSON that matches the schema.`;
    }
  }
}

/** What each review card was drafted from, for the judge and the report. */
const cardFrom = (c: Card, tries: Set<string>, lines: Set<string>): Question["from"] =>
  c.meta.from === "prequestion" ? "prequestion" : c.meta.from === "notes" ? "notes" : c.meta.annotation && tries.has(c.meta.annotation) ? "try" : c.meta.annotation && lines.has(c.meta.annotation) ? "line" : "highlights";

export interface Scored extends Question { case: string; failed: string[]; why: string }
export interface CaseResult { id: string; questions: Scored[]; plan_failed: string[]; ms: number; usage: Usage; judge_usage?: Usage; prompt_version?: string; model?: string; error?: string }

export async function runCase(root: string, c: QuestionCase, judgeModel: string): Promise<CaseResult> {
  const start = performance.now();
  const lib = { root: join(root, c.id) };
  let usage: Usage = { input_tokens: 0, output_tokens: 0 };
  const add = (u?: Usage) => (usage = { input_tokens: usage.input_tokens + (u?.input_tokens ?? 0), output_tokens: usage.output_tokens + (u?.output_tokens ?? 0), ...(u?.cost_usd !== undefined || usage.cost_usd !== undefined ? { cost_usd: (usage.cost_usd ?? 0) + (u?.cost_usd ?? 0) } : {}) });
  try {
    await initLibrary(lib.root);
    const item = await addSource(lib, c.source);
    const added = await enrichItem(lib, item.meta.id);
    add(added.usage);
    const skip = await readAndFinish(lib, findItem(lib, item.meta.id), c);
    const finished = await enrichItem(lib, item.meta.id);
    add(finished.usage);
    const cards = listCards(lib).filter((k) => k.meta.item === item.meta.id);
    const anns = readAnnotations(findItem(lib, item.meta.id));
    const tries = new Set(anns.filter((a) => a.intent === "apply").map((a) => a.id));
    const lines = new Set(anns.filter((a) => a.point).map((a) => a.id));
    // Grouped into a real idea's `also` is fine; a card of its own is not.
    const plan_failed = cards.filter((k) => k.meta.annotation && skip.has(k.meta.annotation)).map((k) => `drafted a card from "${anns.find((a) => a.id === k.meta.annotation)?.exact}"`);
    const pre: Question[] = added.prequestions.map((q, i) => ({ n: i + 1, kind: "prequestion", question: q }));
    const qs: Question[] = cards.map((k, i) => ({ n: i + 1, kind: k.meta.kind as Kind, question: k.question, answer: k.answer, rubric: k.rubric, from: cardFrom(k, tries, lines) }));
    const { meta, body } = findItem(lib, item.meta.id);
    const j = await judge(lib.root, item.docPath, {
      source: { title: meta.title, author: meta.author ?? null, type: meta.type },
      skills: loadSkills(lib).skills.filter((s) => meta.skills.includes(s.id)).map((s) => ({ name: s.name, hook: s.hook })),
      prequestions: pre.map(({ n, question }) => ({ n, question })),
      cards: qs.map(({ n, kind, question, answer, rubric, from }) => ({ n, kind, question, answer, rubric, from })),
    }, judgeModel);
    const scored = (list: Question[], judged: Record<string, unknown>[]): Scored[] => list.map((q) => {
      const v = judged.find((x) => x.n === q.n);
      const failed = [...codeFailures(q, meta.author, q.kind === "prequestion" ? undefined : body), ...(v ? judgeFailures(v) : ["judge:missing"])];
      return { ...q, case: c.id, failed, why: typeof v?.why === "string" ? v.why : "" };
    });
    return {
      id: c.id, questions: [...scored(pre, j.data.prequestions), ...scored(qs, j.data.cards)], plan_failed,
      ms: Math.round(performance.now() - start), usage, judge_usage: j.usage, prompt_version: finished.ai?.prompt_version ?? added.ai?.prompt_version, model: finished.ai?.model ?? added.ai?.model,
    };
  } catch (e) {
    return { id: c.id, questions: [], plan_failed: [], ms: Math.round(performance.now() - start), usage, error: (e as Error).message };
  }
}

/** Pass rate (every check) for a set of questions, with its 95% interval. */
const rate = (qs: Scored[]) => {
  const ok = qs.filter((q) => !q.failed.length).length;
  return { passed: `${ok}/${qs.length}`, rate: qs.length ? ok / qs.length : 0, ci95: wilson(ok, qs.length) };
};

/** How often each check failed, most first. */
export function byCheck(qs: Scored[]): Record<string, number> {
  const n: Record<string, number> = {};
  for (const q of qs) for (const f of q.failed) n[f] = (n[f] ?? 0) + 1;
  return Object.fromEntries(Object.entries(n).sort((a, b) => b[1] - a[1]));
}

export function runQuestionEval(vendor: Vendor, model: string | undefined, judgeModel: string, only?: string[], concurrency = 3) {
  const cases = loadQuestionCases().filter((c) => !only?.length || only.includes(c.id));
  return withVendor(vendor, model, async (root) => {
    const t0 = performance.now();
    const results = await pool(cases, concurrency, (c) => runCase(root, c, judgeModel));
    const all = results.flatMap((r) => r.questions);
    const sum = (k: "input_tokens" | "output_tokens", u: "usage" | "judge_usage") => results.reduce((s, r) => s + (r[u]?.[k] ?? 0), 0);
    const cost = (u: "usage" | "judge_usage") => results.reduce((s, r) => s + (r[u]?.cost_usd ?? 0), 0);
    return {
      vendor, model: results.find((r) => r.model)?.model ?? "(no run succeeded)", prompt_version: results.find((r) => r.prompt_version)?.prompt_version ?? "", judge: judgeModel,
      all: rate(all), prequestions: rate(all.filter((q) => q.kind === "prequestion")), cards: rate(all.filter((q) => q.kind !== "prequestion")),
      by_check: byCheck(all), plan_failed: results.flatMap((r) => r.plan_failed.map((p) => `${r.id}: ${p}`)),
      errors: results.filter((r) => r.error).length, wall_s: Math.round((performance.now() - t0) / 100) / 10,
      cost_usd: cost("usage"), judge_cost_usd: cost("judge_usage"), input_tokens: sum("input_tokens", "usage"), output_tokens: sum("output_tokens", "usage"),
      cases: results,
    };
  });
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const flag = (f: string) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);
  const vendors = args.flatMap((a, i) => (args[i - 1] === "--vendor" ? [a] : [])) as Vendor[];
  if (vendors.some((v) => v !== "claude" && v !== "codex")) throw new Error("--vendor must be claude or codex");
  const pick: Vendor[] = vendors.length ? vendors : ["claude"];
  if (args.includes("--model") && pick.length > 1) throw new Error("--model needs one --vendor");
  const only = args.flatMap((a, i) => (args[i - 1] === "--case" ? [a] : []));
  const judgeModel = flag("--judge") ?? "opus";
  const runs = [];
  for (const v of pick) {
    console.error(`Writing questions with ${v}, judged by ${judgeModel}…`);
    const r = await runQuestionEval(v, flag("--model"), judgeModel, only);
    for (const c of r.cases) {
      if (c.error) console.error(`  error ${c.id}: ${c.error}`);
      for (const p of c.plan_failed) console.error(`  plan ${c.id}: ${p}`);
      for (const q of c.questions.filter((q) => q.failed.length)) console.error(`  miss ${c.id} ${q.kind}${q.from ? `/${q.from}` : ""} ${q.failed.join(", ")} | ${q.question.replace(/\s+/g, " ").slice(0, 160)}${q.why ? `\n      ${q.why}` : ""}`);
    }
    runs.push(r);
  }
  const dir = join(import.meta.dir, "results");
  mkdirSync(dir, { recursive: true });
  const out = resultPath(dir, new Date(), "questions");
  writeFileSync(out, JSON.stringify({ eval: "questions", date: new Date().toISOString(), set: setId([loadQuestionCases(), JUDGE]), prompt: loadPrompt("enrich").version, runs }, null, 2) + "\n");
  console.log(columns(["vendor", "model", "all", "95% CI", "prequestions", "cards", "plan misses", "cost", "judge", "time", "errors"], runs.map((r) => [
    r.vendor, r.model, `${pct(r.all.rate)} (${r.all.passed})`, range(r.all.ci95), `${pct(r.prequestions.rate)} (${r.prequestions.passed})`, `${pct(r.cards.rate)} (${r.cards.passed})`,
    String(r.plan_failed.length), costText({ cost_usd: r.cost_usd || undefined, input_tokens: r.input_tokens, output_tokens: r.output_tokens }), `$${r.judge_cost_usd.toFixed(3)}`, `${r.wall_s}s`, String(r.errors),
  ])));
  for (const r of runs) console.log(`\n${r.vendor} failed checks: ${Object.entries(r.by_check).map(([k, n]) => `${k} ${n}`).join(", ") || "none"}`);
  console.log(`\nSaved ${out}`);
}
