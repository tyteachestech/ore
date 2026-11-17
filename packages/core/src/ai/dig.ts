import { z } from "zod";
import { nowIso } from "../ids.ts";
import { digState, reviseDig, type Dig } from "../digs.ts";
import type { Library } from "../library.ts";
import { loadSkills } from "../skills.ts";
import { runAgent } from "./adapter.ts";

export const DigOutput = z.strictObject({
  came: z.array(z.number().int()),
  asks: z.array(z.strictObject({ n: z.number().int(), q: z.string().min(1).max(200) })).max(2),
});

const open = (lib: Library, skill: string): Dig => {
  const d = digState(lib, skill).last;
  if (!d) throw new Error(`no dig for ${skill} yet: ore dig ${skill} --text "…"`);
  if (d.done_at) throw new Error("this dig is finished");
  return d;
};
const skillOf = (lib: Library, skill: string) => ({ name: loadSkills(lib).skills.find((s) => s.id === skill)!.name });
const numbered = (d: Dig) => d.ideas.map((i, n) => ({ n: n + 1, text: i.text, source: i.source }));

/** The mole reads what he wrote (D-new-dig): which of the skill's ideas are in it, and one or two
 *  questions, each at an idea he left out. With nothing left out the dig is done. Never a grade. */
export async function digAsk(lib: Library, skill: string): Promise<Dig> {
  const d = open(lib, skill);
  if (d.asks) throw new Error("the mole has asked already: answer with ore dig --answer");
  const { data, ai } = await runAgent(lib, {
    prompt: "dig",
    cwd: lib.root,
    schema: DigOutput,
    input: { stage: "ask", skill: skillOf(lib, skill), goal: d.goal, text: d.text, ideas: numbered(d) },
    check: (o) => {
      const bad = [...o.came, ...o.asks.map((a) => a.n)].filter((n, i, all) => n < 1 || n > d.ideas.length || all.indexOf(n) !== i);
      return bad.length ? `came and asks[].n must be different idea numbers from 1 to ${d.ideas.length}, an idea in one of them only; got ${bad.join(", ")}` : null;
    },
  });
  return reviseDig(lib, skill, d.id, (cur) => {
    if (cur.text !== d.text || cur.asks) throw new Error("the dig changed while the mole was reading");
    const came = new Set(data.came);
    const asked = new Set(data.asks.map((a) => a.n));
    return {
      ...cur,
      ideas: cur.ideas.map((i, n) => (came.has(n + 1) ? { ...i, state: "own" as const } : asked.has(n + 1) || data.asks.length ? i : { ...i, state: "missed" as const })),
      asks: data.asks.map((a) => ({ idea: cur.ideas[a.n - 1]!.id, q: a.q.trim() })),
      ...(data.asks.length ? {} : { done_at: nowIso() }),
      ai,
    };
  });
}

/** He answered the mole's questions: an asked idea that is in its answer came with a nudge; the rest didn't come. */
export async function digAnswer(lib: Library, skill: string, answers: string[]): Promise<Dig> {
  const d = open(lib, skill);
  if (!d.asks) throw new Error("the mole has not read it yet: ore dig --ask");
  const asks = d.asks.map((a, i) => ({ ...a, ...(answers[i]?.trim() ? { answer: answers[i]!.trim() } : {}) }));
  const answered = asks.filter((a) => a.answer);
  const n = (id: string) => d.ideas.findIndex((i) => i.id === id) + 1;
  let came = new Set<number>();
  let ai = d.ai;
  if (answered.length) {
    const r = await runAgent(lib, {
      prompt: "dig",
      cwd: lib.root,
      schema: DigOutput,
      input: { stage: "check", skill: skillOf(lib, skill), goal: d.goal, ideas: numbered(d).filter((i) => answered.some((a) => n(a.idea) === i.n)), asks: answered.map((a) => ({ n: n(a.idea), q: a.q, answer: a.answer })) },
      check: (o) => {
        const bad = o.came.filter((c) => !answered.some((a) => n(a.idea) === c));
        return o.asks.length ? "asks must be [] at the check stage" : bad.length ? `came must hold only the numbers asked about (${answered.map((a) => n(a.idea)).join(", ")}); got ${bad.join(", ")}` : null;
      },
    });
    came = new Set(r.data.came);
    ai = r.ai;
  }
  return reviseDig(lib, skill, d.id, (cur) => {
    if (cur.done_at || cur.text !== d.text) throw new Error("the dig changed while the mole was reading");
    return { ...cur, asks, ideas: cur.ideas.map((i, k) => ({ ...i, state: i.state ?? (came.has(k + 1) ? ("nudge" as const) : ("missed" as const)) })), done_at: nowIso(), ...(ai ? { ai } : {}) };
  });
}
