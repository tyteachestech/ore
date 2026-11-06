import { z } from "zod";
import { locate, quoteSelector } from "../anchoring.ts";
import { sentenceAt } from "../annotations.ts";
import { findItem, updateItemMeta, updatePrequestion, type AiStamp, type Evidence, type Item, type KeyPoint } from "../items.ts";
import type { Library } from "../library.ts";
import { runAgent } from "./adapter.ts";

export const KeyPointsOutput = z.strictObject({
  questions: z.array(
    z.strictObject({
      n: z.number().int(),
      points: z.array(z.strictObject({ text: z.string().min(1), evidence: z.array(z.string().min(1)).min(1).max(3) })).min(2).max(4),
    }),
  ),
});

export const CheckOutput = z.strictObject({ covered: z.array(z.boolean()) });

/** Each quote located in the body and stored as a selector; quotes that do not anchor are dropped
 *  (D56), as are repeats. */
export function anchorEvidence(body: string, quotes: string[]): Evidence[] {
  const out: Evidence[] = [];
  for (const q of quotes) {
    const at = locate(body, q);
    if (at && !out.some((e) => e.start === at.start)) out.push(quoteSelector(body, at.start, at.end));
  }
  return out;
}

// D56: the key points of every prequestion that has none yet, each with the passages that support
// it. Runs when the quiz opens, while Tyler writes his free recall.
export async function writeKeyPoints(lib: Library, ref: string) {
  const item = findItem(lib, ref);
  const qs = item.meta.prequestions ?? [];
  if (!qs.length) throw new Error(`item ${item.meta.id} has no prequestions (ore enrich ${item.meta.id})`);
  const todo = qs.map((p, i) => ({ n: i + 1, q: p.q, has: !!p.points })).filter((p) => !p.has);
  if (!todo.length) return { item: item.meta.id, prequestions: qs, skipped: "every prequestion has key points" };
  const want = todo.map((p) => p.n);
  const { data, ai } = await runAgent(lib, {
    prompt: "key-points",
    cwd: lib.root,
    files: [item.docPath],
    schema: KeyPointsOutput,
    input: { item: { id: item.meta.id, title: item.meta.title, type: item.meta.type }, prequestions: todo.map(({ n, q }) => ({ n, q })) },
    check: (d) => {
      const got = d.questions.map((q) => q.n).sort((a, b) => a - b);
      return got.join() === want.join() ? null : `questions[].n must be exactly ${want.join(", ")}; got ${got.join(", ") || "none"}`;
    },
  });
  // Each answer is for the question it was asked about, by number and by its text: the prequestions
  // may have been re-enriched or reordered while the AI ran, so a number alone could land on another.
  const asked = new Map(todo.map((p) => [p.n, p.q]));
  const byQ = new Map(todo.map((p) => [p.q, p.n]));
  const byN = new Map(data.questions.map((q) => [q.n, q.points.map((p): KeyPoint => ({ text: p.text, evidence: anchorEvidence(item.body, p.evidence) }))]));
  const meta = await updateItemMeta(lib, item.meta.id, (m) => ({
    ...m,
    prequestions: (m.prequestions ?? []).map((p, i) => {
      if (p.points) return p;
      const n = asked.get(i + 1) === p.q ? i + 1 : byQ.get(p.q);
      const points = n === undefined ? undefined : byN.get(n);
      return points ? { ...p, points, points_ai: ai } : p;
    }),
  }));
  return { item: meta.id, prequestions: meta.prequestions ?? [], ai };
}

// D56: which key points his closed-book answer covers. Proposed by AI; his flips (setCovered) win.
export async function checkPrequestion(lib: Library, ref: string, n: number) {
  const item = findItem(lib, ref);
  const p = item.meta.prequestions?.[n - 1];
  if (!p) throw new Error(`prequestion ${n} out of range (1-${item.meta.prequestions?.length ?? 0})`);
  if (!p.after) throw new Error(`record an answer first (ore prequestion ${item.meta.id} ${n} --after)`);
  if (!p.points?.length) throw new Error(`prequestion ${n} has no key points yet (ore key-points ${item.meta.id})`);
  const points = p.points;
  const after = p.after;
  const { data, ai } = await runAgent(lib, {
    prompt: "check",
    cwd: lib.root,
    schema: CheckOutput,
    input: { question: p.q, key_points: points.map((k) => k.text), answer: after },
    check: (d) => (d.covered.length === points.length ? null : `covered must have exactly ${points.length} entries, one per key point`),
  });
  return updatePrequestion(lib, item.meta.id, n, (cur) => {
    if (cur.after !== after) throw new Error("the answer changed while checking; check again");
    return { ...cur, check: { covered: data.covered, ai } };
  });
}

/** His own marks after the AI check: one boolean per key point. */
export async function setCovered(lib: Library, ref: string, n: number, covered: boolean[]) {
  return updatePrequestion(lib, ref, n, (p) => {
    if (!p.check) throw new Error(`prequestion ${n} has not been checked yet`);
    if (covered.length !== (p.points?.length ?? 0)) throw new Error(`give one mark per key point (${p.points?.length ?? 0})`);
    return { ...p, check: { ...p.check, covered, edited: true } };
  });
}

const LeaveOutOutput = z.strictObject({ drop: z.array(z.number().int().positive()) });

/** D100: what a finish covers. `reached` (a body offset) drops prequestions whose every key-point passage
 *  lies past it; `leaveOut`, his own words, has the AI drop the ones it rules out. Each call starts over,
 *  so finishing again after reading further brings questions back. */
export async function scopeFinish(lib: Library, ref: string, opts: { reached?: number; leaveOut?: string }) {
  const item = findItem(lib, ref);
  const qs = item.meta.prequestions ?? [];
  // The last few lines (credits, a sign-off) left unread still count as the whole.
  const reached = opts.reached !== undefined && item.body.length - opts.reached > 400 ? opts.reached : undefined;
  const past = (p: (typeof qs)[number]) => {
    const ev = (p.points ?? []).flatMap((k) => k.evidence);
    return reached !== undefined && ev.length > 0 && ev.every((e) => e.start >= reached);
  };
  const text = opts.leaveOut?.trim() || undefined;
  const open = qs.map((p, i) => ({ n: i + 1, q: p.q })).filter((_, i) => !past(qs[i]!));
  let drop = new Set<number>();
  let ai: AiStamp | undefined;
  if (text && open.length) {
    const want = new Set(open.map((p) => p.n));
    const r = await runAgent(lib, {
      prompt: "leave-out",
      cwd: lib.root,
      schema: LeaveOutOutput,
      input: { item: { title: item.meta.title, type: item.meta.type }, leave_out: text, prequestions: open },
      check: (d) => (d.drop.every((n) => want.has(n)) ? null : `drop may only hold numbers from prequestions (${[...want].join(", ")})`),
    });
    drop = new Set(r.data.drop);
    ai = r.ai;
  }
  const meta = await updateItemMeta(lib, item.meta.id, (m) => ({
    ...m,
    reached,
    leave_out: text ? { text, ai } : undefined,
    prequestions: (m.prequestions ?? []).map((p, i) => {
      const { skipped: _, ...rest } = p;
      const skipped = past(p) ? ("past" as const) : drop.has(i + 1) ? ("left_out" as const) : undefined;
      return skipped ? { ...rest, skipped } : rest;
    }),
  }));
  return { item: meta.id, reached: meta.reached ?? null, leave_out: meta.leave_out ?? null, prequestions: meta.prequestions ?? [] };
}

/** What the AI is told about a partway finish (D100), or null when it covers the whole source. */
export function finishScope(item: Item): { stopped_after: string | null; leave_out: string | null } | null {
  const { reached, leave_out } = item.meta;
  if (reached === undefined && !leave_out) return null;
  const s = reached === undefined ? null : sentenceAt(item.body, Math.max(0, reached - 1));
  return { stopped_after: s ? item.body.slice(s.start, s.end) : null, leave_out: leave_out?.text ?? null };
}
