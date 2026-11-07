// Ask-your-library eval: imports the golden sample docs into a scratch library, asks the questions in
// ask-cases.json with each AI vendor, and scores answer accuracy, citation accuracy and whether it says
// so when the library doesn't hold the answer. It spends real AI usage, so it runs only by hand:
// `bun run eval:ask` (never in CI). Flags as for eval:grade: --vendor claude|codex, --model <id>.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { z } from "zod";
import type { Usage, Vendor } from "../src/ai/adapter.ts";
import { askLibrary } from "../src/ai/ask.ts";
import { parseFrontmatter } from "../src/frontmatter.ts";
import { createItem, findItem, ItemType } from "../src/items.ts";
import type { Library } from "../src/library.ts";
import { columns, costText, pct, pool, resultPath, withVendor } from "./grade.ts";

const Case = z.strictObject({ id: z.string(), question: z.string(), sources: z.array(z.string()).min(1), answer: z.array(z.string()).min(1), evidence: z.string() });
const Absent = z.strictObject({ id: z.string(), question: z.string() });
export type AskCase = z.infer<typeof Case>;

export function loadAskCases(path = join(import.meta.dir, "ask-cases.json")) {
  return z.object({ cases: z.array(Case), absent: z.array(Absent) }).parse(JSON.parse(readFileSync(path, "utf8")));
}

export const GOLDEN = join(import.meta.dir, "../test/golden");

/** Each golden doc.md as a source in the library; returns item id → golden name. */
export async function addGolden(lib: Library, dir = GOLDEN): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
    const { data, body } = parseFrontmatter<{ type?: string; title?: string; author?: string }>(readFileSync(join(dir, f), "utf8"));
    const type = ItemType.safeParse(data.type).data ?? "article";
    const item = await createItem(lib, { type, title: data.title ?? basename(f, ".md"), author: data.author, body });
    names.set(item.meta.id, basename(f, ".md"));
  }
  return names;
}

type Answer = Awaited<ReturnType<typeof askLibrary>>;
export interface AskResult { id: string; absent: boolean; found?: boolean; answer?: string; cited?: string[]; answer_ok: boolean; citation_ok: boolean; ms: number; usage?: Usage | null; error?: string }

/** Answer: every pattern matches. Citations: every quote is really where it says, and one is from an
 *  expected source and holds the evidence. An absent question is right only when it says so and cites nothing. */
export function scoreAnswer(c: AskCase | z.infer<typeof Absent>, r: Answer, names: Map<string, string>, body: (item: string) => string) {
  if (!("answer" in c)) return { answer_ok: !r.found && !r.citations.length, citation_ok: !r.citations.length };
  const answer_ok = r.found && c.answer.every((p) => new RegExp(p, "i").test(r.answer));
  const real = r.citations.every((x) => body(x.item).slice(x.start, x.end) === x.quote);
  const hit = r.citations.some((x) => c.sources.includes(names.get(x.item) ?? "") && new RegExp(c.evidence, "i").test(x.quote));
  return { answer_ok, citation_ok: r.found && r.citations.length > 0 && real && hit };
}

export interface AskRun { vendor: Vendor; model: string; prompt_version: string; answer_accuracy: number; citation_accuracy: number; says_absent: string; answered: string; cited: string; errors: number; wall_s: number; cost_usd?: number; input_tokens: number; output_tokens: number; cases: AskResult[] }

export function runAsk(vendor: Vendor, model?: string, concurrency = 4): Promise<AskRun> {
  const { cases, absent } = loadAskCases();
  return withVendor(vendor, model, async (root) => {
    const lib = { root };
    const names = await addGolden(lib);
    const bodies = new Map<string, string>();
    const body = (id: string) => bodies.get(id) ?? bodies.set(id, findItem(lib, id).body).get(id)!;
    let stamp = { model: model ?? "", prompt_version: "" };
    const t0 = performance.now();
    const all = [...cases, ...absent];
    const results = await pool(all, concurrency, async (c): Promise<AskResult> => {
      const start = performance.now();
      const isAbsent = !("answer" in c);
      try {
        const r = await askLibrary(lib, c.question);
        if (r.ai) stamp = r.ai;
        return { id: c.id, absent: isAbsent, found: r.found, answer: r.answer, cited: r.citations.map((x) => `${names.get(x.item)}: ${x.quote}`), ...scoreAnswer(c, r, names, body), ms: Math.round(performance.now() - start), usage: r.usage };
      } catch (e) {
        return { id: c.id, absent: isAbsent, answer_ok: false, citation_ok: false, ms: Math.round(performance.now() - start), error: (e as Error).message };
      }
    });
    const answerable = results.filter((r) => !r.absent);
    const none = results.filter((r) => r.absent);
    const n = (xs: AskResult[], k: "answer_ok" | "citation_ok") => xs.filter((x) => x[k]).length;
    const costs = results.map((r) => r.usage?.cost_usd).filter((x): x is number => x !== undefined);
    const sum = (k: "input_tokens" | "output_tokens") => results.reduce((s, r) => s + (r.usage?.[k] ?? 0), 0);
    return {
      vendor, model: stamp.model || "(no run succeeded)", prompt_version: stamp.prompt_version,
      answer_accuracy: n(answerable, "answer_ok") / answerable.length, citation_accuracy: n(answerable, "citation_ok") / answerable.length,
      answered: `${n(answerable, "answer_ok")}/${answerable.length}`, cited: `${n(answerable, "citation_ok")}/${answerable.length}`, says_absent: `${n(none, "answer_ok")}/${none.length}`,
      errors: results.filter((r) => r.error).length, wall_s: Math.round((performance.now() - t0) / 100) / 10,
      ...(costs.length ? { cost_usd: costs.reduce((a, b) => a + b, 0) } : {}), input_tokens: sum("input_tokens"), output_tokens: sum("output_tokens"),
      cases: results,
    };
  });
}

export function askTable(runs: AskRun[]): string {
  return columns(["vendor", "model", "answers", "citations", "says not there", "cost", "time", "errors"], runs.map((r) => [
    r.vendor, r.model, `${pct(r.answer_accuracy)} (${r.answered})`, `${pct(r.citation_accuracy)} (${r.cited})`, r.says_absent, costText(r), `${r.wall_s}s`, String(r.errors),
  ]));
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const vendors = args.flatMap((a, i) => (args[i - 1] === "--vendor" ? [a] : [])) as Vendor[];
  if (vendors.some((v) => v !== "claude" && v !== "codex")) throw new Error("--vendor must be claude or codex");
  const pick: Vendor[] = vendors.length ? vendors : ["claude", "codex"];
  if (args.includes("--model") && pick.length > 1) throw new Error("--model needs one --vendor");
  const model = args.includes("--model") ? args[args.indexOf("--model") + 1] : undefined;
  const runs: AskRun[] = [];
  for (const v of pick) {
    console.error(`Asking with ${v}…`);
    const r = await runAsk(v, model);
    for (const c of r.cases.filter((c) => !c.answer_ok || !c.citation_ok))
      console.error(`  miss ${c.id}: ${c.error ? `error: ${c.error}` : `${c.answer_ok ? "" : "answer "}${c.citation_ok ? "" : "citation "}| ${c.answer?.slice(0, 120)} | ${c.cited?.join(" / ").slice(0, 160)}`}`);
    runs.push(r);
  }
  const dir = join(import.meta.dir, "results");
  mkdirSync(dir, { recursive: true });
  const out = resultPath(dir, new Date(), "ask");
  writeFileSync(out, JSON.stringify({ eval: "ask", date: new Date().toISOString(), runs }, null, 2) + "\n");
  console.log(askTable(runs));
  console.log(`\nSaved ${out}`);
}
