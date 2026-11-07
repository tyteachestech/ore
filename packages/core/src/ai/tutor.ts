import { z } from "zod";
import { locate } from "../anchoring.ts";
import { findItem, listItems } from "../items.ts";
import { loadSkills } from "../skills.ts";
import type { Library } from "../library.ts";
import { runAgent, type Usage } from "./adapter.ts";
import { plainText, retrieve, splitPassages, type Citation, type Passage } from "./ask.ts";

// The tutor (D128): the chat docked at the window's right, grown out of Ask your library. It answers
// his own questions from his sources with citations, falls back to general knowledge only when it says
// so, gives hints instead of answers on practice, and uses the source he has open, and the sources
// and skills he @-mentions, as context.

export interface TutorTurn { message: string; reply: string }

export const TutorOutput = z.strictObject({
  reply: z.string().min(1),
  citations: z.array(z.strictObject({ passage: z.string(), quote: z.string().min(1) })),
  general: z.boolean(),
});

/** What the tutor is pointed at: the source he is reading, and the sources and skills he @-mentioned. */
export interface TutorFocus { item?: string; sources?: string[]; skills?: string[] }

/** The passages the tutor sees: the focused sources' best (or their opening, when the message names no
 *  words in them, as "what's this about?" doesn't), then the rest of the library's, or only of the
 *  @-mentioned skills' sources when he named a skill. */
export function tutorPassages(lib: Library, query: string, focus: TutorFocus = {}): Passage[] {
  const focused = [...new Set([...(focus.item ? [focus.item] : []), ...(focus.sources ?? [])])];
  const each = focused.length ? Math.max(2, Math.floor(8 / focused.length)) : 0;
  const here: Passage[] = [];
  for (const id of focused) {
    let ps = retrieve(lib, query, each, id);
    if (!ps.length) {
      const it = findItem(lib, id);
      ps = splitPassages(it.body).slice(0, each).map((p) => ({ ...p, id: "", item: it.meta.id, title: it.meta.title }));
    }
    here.push(...ps);
  }
  const inSkills = focus.skills?.length ? listItems(lib).filter((i) => i.meta.skills.some((s) => focus.skills!.includes(s))).map((i) => i.meta.id) : undefined;
  const rest = (inSkills ? (inSkills.length ? retrieve(lib, query, 10, inSkills) : []) : retrieve(lib, query, 8)).filter((p) => !focused.includes(p.item));
  return [...here, ...rest].slice(0, Math.max(10, here.length)).map((p, i) => ({ ...p, id: `P${i + 1}` }));
}

/** One turn of the tutor. `earlier` is the conversation so far; `item` the source he is reading. */
export async function tutor(lib: Library, message: string, { earlier = [], ...focus }: { earlier?: TutorTurn[] } & TutorFocus = {}) {
  const m = message.trim();
  if (!m) throw new Error("message is empty");
  const recent = earlier.slice(-6);
  const reading = focus.item ? findItem(lib, focus.item).meta.title : undefined;
  const skillNames = new Map(loadSkills(lib).skills.map((s) => [s.id, s.name]));
  for (const s of focus.skills ?? []) if (!skillNames.has(s)) throw new Error(`no skill "${s}"`);
  const pointed = [...(focus.sources ?? []).map((id) => findItem(lib, id).meta.title), ...(focus.skills ?? []).map((s) => `the skill ${skillNames.get(s)}`)];
  const passages = tutorPassages(lib, [...recent.slice(-2).map((t) => t.message), m].join(" "), focus);
  const byId = new Map(passages.map((p) => [p.id, p]));
  const { data, ai, usage } = await runAgent(lib, {
    prompt: "tutor",
    cwd: lib.root,
    schema: TutorOutput,
    input: { message: m, earlier: recent, ...(reading ? { reading: { title: reading } } : {}), ...(pointed.length ? { about: pointed } : {}), passages: passages.map(({ id, title, heading, text }) => ({ id, source: title, heading, text })) },
    check: (d) => {
      for (const c of d.citations) {
        const p = byId.get(c.passage);
        if (!p) return `no passage ${c.passage}; cite one of ${passages.map((x) => x.id).join(", ") || "none (there are no passages)"}`;
        if (!locate(p.text, c.quote)) return `the quote "${c.quote}" is not in ${c.passage}: copy its exact words`;
      }
      const top = Math.max(0, ...[...d.reply.matchAll(/\[(\d+)\]/g)].map((x) => +x[1]!));
      return top > d.citations.length ? `marker [${top}] has no citation` : null;
    },
  });
  const citations: Citation[] = data.citations.map((c, i) => {
    const p = byId.get(c.passage)!;
    const at = locate(p.text, c.quote)!;
    const quote = p.text.slice(at.start, at.end);
    return { n: i + 1, item: p.item, title: p.title, heading: p.heading, quote, text: plainText(quote), start: p.start + at.start, end: p.start + at.end };
  });
  return { message: m, reply: data.reply, citations, general: data.general, ai, usage: usage as Usage };
}
