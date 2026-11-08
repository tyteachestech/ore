import { z } from "zod";
import { locate } from "../anchoring.ts";
import { findItem, listItems, type AiStamp } from "../items.ts";
import { cardTextProblem, ContentType, writeNewCard, type Card } from "../cards.ts";
import { getDiagram, sceneOutline } from "../diagrams.ts";
import { withLock } from "../lock.ts";
import { paths } from "../library.ts";
import { loadSkills } from "../skills.ts";
import type { Library } from "../library.ts";
import { runAgent, samePage, type Usage } from "./adapter.ts";
import { plainText, retrieve, splitPassages, type Citation, type Passage, type WebCitation } from "./ask.ts";

// The tutor (D128): the chat docked at the window's right, grown out of Ask your library. It answers
// his own questions from his sources with citations; when they don't hold the answer it says so, then
// searches the web (cited the same way) or answers from general knowledge under a label. It gives hints
// instead of answers on practice, and uses the source he has open, and the sources and skills he
// @-mentions, as context.

export interface TutorTurn { message: string; reply: string }

export const TutorCard = z.strictObject({
  kind: z.enum(["card", "prompt"]),
  content_type: ContentType,
  question: z.string().min(1),
  answer: z.string().min(1),
  rubric: z.array(z.string().min(1)),
});
export type TutorCard = z.infer<typeof TutorCard>;

export const TutorOutput = z.strictObject({
  reply: z.string().min(1),
  // `passage` is a passage id, or the URL of a page the web search returned.
  citations: z.array(z.strictObject({ passage: z.string(), quote: z.string().min(1) })),
  general: z.boolean(),
  // The reply holds back an answer he is meant to find (a hint rung): the app offers "Show me".
  hint: z.boolean(),
  // One idea from this reply worth keeping, as a card he can add with one click; null when none.
  card: TutorCard.nullable(),
  // An open exercise for him to write (D128.6): its heading in his note, and placeholder lines under it.
  exercise: z.strictObject({ heading: z.string().min(1).max(100), prompts: z.array(z.string().min(1)).max(3) }).nullable(),
});

/** His message with each diagram from his source note written out as lines, so a map he drew from
 *  memory is read back like his writing. A diagram that can't be read stays a link. */
export function withDiagrams(lib: Library, item: string | undefined, text: string): string {
  if (!item) return text;
  return text.replace(/!\[[^\]]*\]\(diagrams\/([a-z0-9-]+)\.excalidraw\)/g, (all, name: string) => {
    try {
      const scene = getDiagram(lib, item, name).scene;
      const lines = scene ? sceneOutline(scene) : "";
      return lines ? `[Diagram he drew:\n${lines}\n]` : all;
    } catch {
      return all;
    }
  });
}

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
  const m = withDiagrams(lib, focus.item, message.trim());
  if (!m) throw new Error("message is empty");
  const recent = earlier.slice(-6);
  const reading = focus.item ? findItem(lib, focus.item).meta.title : undefined;
  const skillNames = new Map(loadSkills(lib).skills.map((s) => [s.id, s.name]));
  for (const s of focus.skills ?? []) if (!skillNames.has(s)) throw new Error(`no skill "${s}"`);
  const pointed = [...(focus.sources ?? []).map((id) => findItem(lib, id).meta.title), ...(focus.skills ?? []).map((s) => `the skill ${skillNames.get(s)}`)];
  const passages = tutorPassages(lib, [...recent.slice(-2).map((t) => t.message), m].join(" "), focus);
  const byId = new Map(passages.map((p) => [p.id, p]));
  const { data, ai, usage, web } = await runAgent(lib, {
    prompt: "tutor",
    cwd: lib.root,
    web: true,
    schema: TutorOutput,
    input: { message: m, earlier: recent, ...(reading ? { reading: { title: reading } } : {}), ...(pointed.length ? { about: pointed } : {}), passages: passages.map(({ id, title, heading, text }) => ({ id, source: title, heading, text })) },
    check: (d, seen) => {
      for (const c of d.citations) {
        if (isUrl(c.passage)) {
          if (!URL.canParse(c.passage)) return `${c.passage} is not a link`;
          // Claude reports what its searches returned, so a web citation is checked as a passage is; codex doesn't.
          if (seen && !seen.pages.some((p) => samePage(p.url, c.passage))) return `${c.passage} is not a page your web search returned: cite one it returned, or a passage`;
          if (seen && !locate(seen.text, c.quote)) return `the quote "${c.quote}" is not in what the web search returned: copy its exact words`;
          continue;
        }
        const p = byId.get(c.passage);
        if (!p) return `no passage ${c.passage}; cite one of ${passages.map((x) => x.id).join(", ") || "none (there are no passages)"}, or a page your web search returned`;
        if (!locate(p.text, c.quote)) return `the quote "${c.quote}" is not in ${c.passage}: copy its exact words`;
      }
      const top = Math.max(0, ...[...d.reply.matchAll(/\[(\d+)\]/g)].map((x) => +x[1]!));
      if (top > d.citations.length) return `marker [${top}] has no citation`;
      if (d.card && d.card.kind === "prompt" && !d.card.rubric.length) return "a prompt card needs 2 to 4 rubric points";
      if (d.exercise && d.card) return "an exercise is for him to answer: propose no card with it";
      return d.card ? cardTextProblem(d.card) : null;
    },
  });
  const citations: (Citation | WebCitation)[] = data.citations.map((c, i) => {
    if (isUrl(c.passage)) {
      const page = web?.pages.find((p) => samePage(p.url, c.passage));
      const url = page?.url ?? c.passage;
      const site = new URL(url).hostname.replace(/^www\./, "");
      const at = web ? locate(web.text, c.quote) : null;
      const quote = at ? web!.text.slice(at.start, at.end) : c.quote;
      return { n: i + 1, url, title: page?.title || site, site, quote, text: plainText(quote) };
    }
    const p = byId.get(c.passage)!;
    const at = locate(p.text, c.quote)!;
    const quote = p.text.slice(at.start, at.end);
    return { n: i + 1, item: p.item, title: p.title, heading: p.heading, quote, text: plainText(quote), start: p.start + at.start, end: p.start + at.end };
  });
  return { message: m, reply: data.reply, citations, general: data.general, searched: web?.searched ?? false, hint: data.hint, exercise: data.exercise, card: data.card ? { ...data.card, rubric: data.card.kind === "card" ? [] : data.card.rubric } : null, ai, usage: usage as Usage };
}

const isUrl = (s: string) => /^https?:\/\//i.test(s.trim());

/** Keeps a card the tutor proposed (D128, D9: it goes into review like any draft). It belongs to the
 *  source it came from (the first one cited, else the one he was reading) and takes that source's
 *  skills and first topic; the AI that wrote it is recorded. */
export async function addTutorCard(lib: Library, item: string, card: TutorCard, ai: AiStamp): Promise<Card> {
  const c = TutorCard.parse(card);
  const problem = cardTextProblem(c);
  if (problem) throw new Error(problem);
  if (c.kind === "prompt" && !c.rubric.length) throw new Error("a prompt card needs rubric points");
  return withLock(paths.lock(lib), () => {
    const it = findItem(lib, item);
    return writeNewCard(lib, {
      kind: c.kind, item: it.meta.id, from: "tutor", skills: it.meta.skills, topics: it.meta.topics.slice(0, 1), content_type: c.content_type,
      question: c.question, answer: c.answer, rubric: c.kind === "prompt" ? c.rubric : [], ai,
    });
  });
}
