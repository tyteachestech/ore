// Ask-your-library eval: imports the golden sample docs into a scratch library, asks the questions in
// ask-cases.json with each AI vendor, and scores retrieval (no AI: did the evidence reach the AI?),
// answer accuracy, citation accuracy and whether it says so when the library doesn't hold the answer.
// It asks the tutor (D128), the chat the app ships; `--chat ask` asks `ore ask-library` instead. It
// spends real AI usage, so it runs only by hand: `bun run eval:ask` (never in CI). Flags as for
// eval:grade: --vendor claude|codex, --model <id>.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { z } from "zod";
import type { Usage, Vendor } from "../src/ai/adapter.ts";
import { askLibrary, retrieve, type Citation, type Passage } from "../src/ai/ask.ts";
import { tutor, tutorPassages } from "../src/ai/tutor.ts";
import { parseFrontmatter } from "../src/frontmatter.ts";
import { createItem, findItem, ItemType } from "../src/items.ts";
import type { Library } from "../src/library.ts";
import { columns, costText, pct, pool, range, resultPath, setId, wilson, withVendor } from "./grade.ts";

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

export type Chat = "tutor" | "ask";

/** What both chats give back, for scoring: the answer, its citations, and whether it said the answer
 *  is not from his sources (the tutor's "Not from your sources"; ask-library's found: false). */
export interface Answer { found: boolean; answer: string; citations: Citation[]; outside: boolean }

/** Asks one chat a question the way the app does: the tutor with nothing open, or `ore ask-library`. */
export async function ask(lib: Library, chat: Chat, question: string) {
  if (chat === "ask") {
    const r = await askLibrary(lib, question);
    return { found: r.found, answer: r.answer, citations: r.citations, outside: !r.found, ai: r.ai, usage: r.usage };
  }
  const r = await tutor(lib, question);
  return { found: r.citations.length > 0, answer: r.reply, citations: r.citations, outside: r.general, ai: r.ai, usage: r.usage };
}

/** The passages that chat would put in front of the AI for the question. */
export const passagesFor = (lib: Library, chat: Chat, question: string): Passage[] => (chat === "ask" ? retrieve(lib, question) : tutorPassages(lib, question));

/** Retrieval, before any AI: one passage from an expected source holds the evidence. A miss here is the
 *  search's, not the model's. */
export const retrieved = (c: AskCase, ps: Passage[], names: Map<string, string>) =>
  ps.some((p) => c.sources.includes(names.get(p.item) ?? "") && new RegExp(c.evidence, "i").test(p.text));

export interface AskResult { id: string; absent: boolean; retrieved?: boolean; found?: boolean; answer?: string; cited?: string[]; answer_ok: boolean; citation_ok: boolean; ms: number; usage?: Usage | null; error?: string }

/** Answer: every pattern matches. Citations: every quote is really where it says, and one is from an
 *  expected source and holds the evidence. An absent question is right only when it cites nothing and
 *  says the answer isn't from his sources. */
export function scoreAnswer(c: AskCase | z.infer<typeof Absent>, r: Answer, names: Map<string, string>, body: (item: string) => string) {
  if (!("answer" in c)) return { answer_ok: !r.found && !r.citations.length && r.outside, citation_ok: !r.citations.length };
  const answer_ok = r.found && c.answer.every((p) => new RegExp(p, "i").test(r.answer));
  const real = r.citations.every((x) => body(x.item).slice(x.start, x.end) === x.quote);
  const hit = r.citations.some((x) => c.sources.includes(names.get(x.item) ?? "") && new RegExp(c.evidence, "i").test(x.quote));
  return { answer_ok, citation_ok: r.found && r.citations.length > 0 && real && hit };
}

export interface AskRun { vendor: Vendor; chat: Chat; model: string; prompt_version: string; retrieval: string; answer_accuracy: number; answer_ci95: [number, number]; citation_accuracy: number; citation_ci95: [number, number]; says_absent: string; answered: string; cited: string; errors: number; wall_s: number; cost_usd?: number; input_tokens: number; output_tokens: number; cases: AskResult[] }

export function runAsk(vendor: Vendor, model?: string, chat: Chat = "tutor", concurrency = 4): Promise<AskRun> {
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
      const got = isAbsent ? undefined : retrieved(c as AskCase, passagesFor(lib, chat, c.question), names);
      try {
        const r = await ask(lib, chat, c.question);
        if (r.ai) stamp = r.ai;
        return { id: c.id, absent: isAbsent, retrieved: got, found: r.found, answer: r.answer, cited: r.citations.map((x) => `${names.get(x.item)}: ${x.quote}`), ...scoreAnswer(c, r, names, body), ms: Math.round(performance.now() - start), usage: r.usage };
      } catch (e) {
        return { id: c.id, absent: isAbsent, retrieved: got, answer_ok: false, citation_ok: false, ms: Math.round(performance.now() - start), error: (e as Error).message };
      }
    });
    const answerable = results.filter((r) => !r.absent);
    const none = results.filter((r) => r.absent);
    const n = (xs: AskResult[], k: "answer_ok" | "citation_ok") => xs.filter((x) => x[k]).length;
    const costs = results.map((r) => r.usage?.cost_usd).filter((x): x is number => x !== undefined);
    const sum = (k: "input_tokens" | "output_tokens") => results.reduce((s, r) => s + (r.usage?.[k] ?? 0), 0);
    return {
      vendor, chat, model: stamp.model || "(no run succeeded)", prompt_version: stamp.prompt_version,
      retrieval: `${answerable.filter((r) => r.retrieved).length}/${answerable.length}`,
      answer_accuracy: n(answerable, "answer_ok") / answerable.length, answer_ci95: wilson(n(answerable, "answer_ok"), answerable.length),
      citation_accuracy: n(answerable, "citation_ok") / answerable.length, citation_ci95: wilson(n(answerable, "citation_ok"), answerable.length),
      answered: `${n(answerable, "answer_ok")}/${answerable.length}`, cited: `${n(answerable, "citation_ok")}/${answerable.length}`, says_absent: `${n(none, "answer_ok")}/${none.length}`,
      errors: results.filter((r) => r.error).length, wall_s: Math.round((performance.now() - t0) / 100) / 10,
      ...(costs.length ? { cost_usd: costs.reduce((a, b) => a + b, 0) } : {}), input_tokens: sum("input_tokens"), output_tokens: sum("output_tokens"),
      cases: results,
    };
  });
}

export function askTable(runs: AskRun[]): string {
  return columns(["vendor", "chat", "model", "retrieval", "answers", "citations", "says not there", "cost", "time", "errors"], runs.map((r) => [
    r.vendor, r.chat, r.model, r.retrieval, `${pct(r.answer_accuracy)} (${r.answered}, ${range(r.answer_ci95)})`, `${pct(r.citation_accuracy)} (${r.cited}, ${range(r.citation_ci95)})`, r.says_absent, costText(r), `${r.wall_s}s`, String(r.errors),
  ]));
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const vendors = args.flatMap((a, i) => (args[i - 1] === "--vendor" ? [a] : [])) as Vendor[];
  if (vendors.some((v) => v !== "claude" && v !== "codex")) throw new Error("--vendor must be claude or codex");
  const pick: Vendor[] = vendors.length ? vendors : ["claude", "codex"];
  if (args.includes("--model") && pick.length > 1) throw new Error("--model needs one --vendor");
  const model = args.includes("--model") ? args[args.indexOf("--model") + 1] : undefined;
  const chat = (args.includes("--chat") ? args[args.indexOf("--chat") + 1] : "tutor") as Chat;
  if (chat !== "tutor" && chat !== "ask") throw new Error("--chat must be tutor or ask");
  const runs: AskRun[] = [];
  for (const v of pick) {
    console.error(`Asking the ${chat} with ${v}…`);
    const r = await runAsk(v, model, chat);
    for (const c of r.cases.filter((c) => !c.answer_ok || !c.citation_ok))
      console.error(`  miss ${c.id}: ${c.error ? `error: ${c.error}` : `${c.retrieved === false ? "retrieval " : ""}${c.answer_ok ? "" : "answer "}${c.citation_ok ? "" : "citation "}| ${c.answer?.slice(0, 160)} | ${c.cited?.join(" / ").slice(0, 160)}`}`);
    runs.push(r);
  }
  const dir = join(import.meta.dir, "results");
  mkdirSync(dir, { recursive: true });
  const out = resultPath(dir, new Date(), "ask");
  writeFileSync(out, JSON.stringify({ eval: "ask", date: new Date().toISOString(), set: setId([loadAskCases()]), runs }, null, 2) + "\n");
  console.log(askTable(runs));
  console.log(`\nSaved ${out}`);
}
