import { z } from "zod";
import { locate } from "../anchoring.ts";
import { findItem } from "../items.ts";
import type { Library } from "../library.ts";
import { runAgent, type Usage } from "./adapter.ts";
import { plainText, retrieve, splitPassages, type Citation, type Passage } from "./ask.ts";

// The tutor (D128): the chat docked at the window's right, grown out of Ask your library. It answers
// his own questions from his sources with citations, falls back to general knowledge only when it says
// so, gives hints instead of answers on practice, and uses the source he has open as context.

export interface TutorTurn { message: string; reply: string }

export const TutorOutput = z.strictObject({
  reply: z.string().min(1),
  citations: z.array(z.strictObject({ passage: z.string(), quote: z.string().min(1) })),
  general: z.boolean(),
});

/** The passages the tutor sees: the open source's best (or its opening, when the message names no
 *  words in it, as "what's this about?" doesn't), then the rest of the library's. */
export function tutorPassages(lib: Library, query: string, item?: string): Passage[] {
  let here: Passage[] = [];
  if (item) {
    here = retrieve(lib, query, 6, item);
    if (!here.length) {
      const it = findItem(lib, item);
      here = splitPassages(it.body).slice(0, 6).map((p) => ({ ...p, id: "", item: it.meta.id, title: it.meta.title }));
    }
  }
  const seen = new Set(here.map((p) => `${p.item}:${p.start}`));
  const rest = retrieve(lib, query, 8).filter((p) => !seen.has(`${p.item}:${p.start}`) && p.item !== item);
  return [...here, ...rest.slice(0, 10 - here.length)].map((p, i) => ({ ...p, id: `P${i + 1}` }));
}

/** One turn of the tutor. `earlier` is the conversation so far; `item` the source he is reading. */
export async function tutor(lib: Library, message: string, { earlier = [], item }: { earlier?: TutorTurn[]; item?: string } = {}) {
  const m = message.trim();
  if (!m) throw new Error("message is empty");
  const recent = earlier.slice(-6);
  const reading = item ? findItem(lib, item).meta.title : undefined;
  const passages = tutorPassages(lib, [...recent.slice(-2).map((t) => t.message), m].join(" "), item);
  const byId = new Map(passages.map((p) => [p.id, p]));
  const { data, ai, usage } = await runAgent(lib, {
    prompt: "tutor",
    cwd: lib.root,
    schema: TutorOutput,
    input: { message: m, earlier: recent, ...(reading ? { reading: { title: reading } } : {}), passages: passages.map(({ id, title, heading, text }) => ({ id, source: title, heading, text })) },
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
