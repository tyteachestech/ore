import { z } from "zod";
import { locate } from "../anchoring.ts";
import { findItem, listItems, type AiStamp } from "../items.ts";
import { cardTextProblem, ContentType, writeNewCard, type Card } from "../cards.ts";
import { getDiagram, sceneOutline } from "../diagrams.ts";
import { withLock } from "../lock.ts";
import { paths } from "../library.ts";
import { loadSkills } from "../skills.ts";
import type { Library } from "../library.ts";
import { isWebUrl, runAgent, samePage, type Usage } from "./adapter.ts";
import { PASSAGES, plainText, retrieve, splitPassages, type Citation, type Passage, type WebCitation } from "./ask.ts";

// The tutor (D128): the chat docked at the window's right, grown out of Ask your library. It answers
// his own questions from his sources with citations; when they don't hold the answer it says so, then
// searches the web (cited the same way) or answers from general knowledge under a label. It gives hints
// instead of answers on practice, and uses the source he has open, and the sources and skills he
// @-mentions, as context.

/** One earlier turn. A turn that set an exercise carries it, with the card committed then (D158). */
export interface TutorTurn { message: string; reply: string; exercise?: Exercise }

/** A reply with its worked answer's steps numbered under it (D142): what it said, as text. */
export const withSteps = (r: { reply: string; steps: string[] }) => [r.reply, ...r.steps.map((s, i) => `${i + 1}. ${s}`)].join("\n");

export const TutorCard = z.strictObject({
  kind: z.enum(["card", "prompt"]),
  content_type: ContentType,
  question: z.string().min(1),
  answer: z.string().min(1),
  rubric: z.array(z.string().min(1)),
});
export type TutorCard = z.infer<typeof TutorCard>;

/** An open exercise (D128.6) and, since D158, the review card it becomes if he misses: its model answer
 *  and rubric points are written before he answers, so the feedback judges against something fixed. */
export const Exercise = z.strictObject({ heading: z.string().min(1).max(100), prompts: z.array(z.string().min(1)).max(3), card: TutorCard });
export type Exercise = z.infer<typeof Exercise>;

export const TutorOutput = z.strictObject({
  reply: z.string().min(1),
  // `passage` is a passage id, or the URL of a page the web search returned.
  citations: z.array(z.strictObject({ passage: z.string(), quote: z.string().min(1) })),
  general: z.boolean(),
  // The reply holds back an answer he is meant to find (a hint rung): the app offers "Show me".
  hint: z.boolean(),
  // One idea from this reply worth keeping, as a card he can add with one click; null when none.
  card: TutorCard.nullable(),
  // An open exercise for him to write (D128.6): its heading in his note, placeholder lines under it, and its card.
  exercise: Exercise.nullable(),
  // A worked answer in its steps, which the app shows one at a time (D142); [] for any other reply.
  steps: z.array(z.string().min(1)).max(8),
  // Feedback on the open exercise (D158): one boolean per rubric point of its card, true when his answer covers it.
  covered: z.array(z.boolean()).optional(),
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
  const rest = (inSkills ? (inSkills.length ? retrieve(lib, query, PASSAGES, inSkills) : []) : retrieve(lib, query, PASSAGES)).filter((p) => !focused.includes(p.item));
  return [...here, ...rest].slice(0, Math.max(PASSAGES, here.length)).map((p, i) => ({ ...p, id: `P${i + 1}` }));
}

/** The reply so far in a structured answer's half-written JSON (its `reply` string, unescaped), or null. */
export function partialReply(json: string): string | null {
  const m = json.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (!m) return null;
  try {
    // A \u escape cut off mid-way waits for the next chunk (an escaped backslash before a u is no escape).
    return JSON.parse(`"${m[1]!.replace(/((?:^|[^\\])(?:\\\\)*)\\u[0-9a-fA-F]{0,3}$/, "$1")}"`) as string;
  } catch {
    return null;
  }
}

/** While a reply is written: its text so far ("" when a retry starts it over), or a web search starting or done (claude only). */
export type TutorProgress = { reply: string } | { searching: boolean };

/** One turn of the tutor. `earlier` is the conversation so far; `item` the source he is reading. */
/** What a quote from a web page is checked against: its title as the search gave it, then the results' text,
 *  which lists titles JSON-escaped (a title with "quotes" in it reads \"quotes\" there). */
const pageWords = (page: { title: string; text: string }) => `${page.title}\n${page.text}`;

export async function tutor(lib: Library, message: string, { earlier = [], onProgress, ...focus }: { earlier?: TutorTurn[]; onProgress?: (p: TutorProgress) => void } & TutorFocus = {}) {
  const m = withDiagrams(lib, focus.item, message.trim());
  if (!m) throw new Error("message is empty");
  const recent = earlier.slice(-6).map(({ message, reply }) => ({ message, reply }));
  // The exercise he is answering: the last one set, however long ago, with the card committed then.
  const open = earlier.flatMap((t) => { const e = Exercise.safeParse(t.exercise); return e.success ? [e.data] : []; }).at(-1);
  const reading = focus.item ? findItem(lib, focus.item).meta.title : undefined;
  const skillNames = new Map(loadSkills(lib).skills.map((s) => [s.id, s.name]));
  for (const s of focus.skills ?? []) if (!skillNames.has(s)) throw new Error(`no skill "${s}"`);
  const pointed = [...(focus.sources ?? []).map((id) => findItem(lib, id).meta.title), ...(focus.skills ?? []).map((s) => `the skill ${skillNames.get(s)}`)];
  const passages = tutorPassages(lib, [...recent.slice(-2).map((t) => t.message), m].join(" "), focus);
  let last = 0;
  const byId = new Map(passages.map((p) => [p.id, p]));
  const { data, ai, usage, web } = await runAgent(lib, {
    prompt: "tutor",
    cwd: lib.root,
    web: true,
    onProgress: onProgress && ((p) => {
      if ("searching" in p) return onProgress(p);
      if (!p.partial) return (last = 0), onProgress({ reply: "" });
      // A few updates a second read as smooth; reading the whole JSON again on every token would not be.
      if (Date.now() - last < 50) return;
      const reply = partialReply(p.partial);
      if (reply) (last = Date.now()), onProgress({ reply });
    }),
    schema: TutorOutput,
    input: { message: m, earlier: recent, ...(open ? { exercise: { heading: open.heading, card: open.card } } : {}), ...(reading ? { reading: { title: reading } } : {}), ...(pointed.length ? { about: pointed } : {}), passages: passages.map(({ id, title, heading, text }) => ({ id, source: title, heading, text })) },
    check: (d, seen) => {
      for (const c of d.citations) {
        if (isWebUrl(c.passage)) {
          if (!URL.canParse(c.passage.trim())) return `${c.passage} is not a link`;
          // Claude reports what its searches returned, so a web citation is checked as a passage is; codex doesn't.
          if (!seen) continue;
          const page = seen.pages.find((p) => samePage(p.url, c.passage));
          // The retry is a fresh run that can't see this one's results, so the reason lists them.
          const returned = seen.pages.slice(0, 8).map((p) => p.url).join(", ") || "none: search first";
          if (!page) return `${c.passage} is not a page your web search returned (it returned ${returned}): cite one of those, or a passage`;
          if (!locate(pageWords(page), c.quote)) return `the quote "${c.quote}" is not in what the web search returned for ${page.url}: copy its exact words`;
          continue;
        }
        const p = byId.get(c.passage);
        if (!p) return `no passage ${c.passage}; cite one of ${passages.map((x) => x.id).join(", ") || "none (there are no passages)"}, or a page your web search returned`;
        if (!locate(p.text, c.quote)) return `the quote "${c.quote}" is not in ${c.passage}: copy its exact words`;
      }
      const top = Math.max(0, ...[...[d.reply, ...d.steps].join("\n").matchAll(/\[(\d+)\]/g)].map((x) => +x[1]!));
      if (d.steps.length === 1 || d.steps.length > 6) return "steps: give 2 to 6 steps, or [] when the reply isn't a worked answer";
      if (d.steps.length && (d.hint || d.exercise)) return "steps are a worked answer: not with a hint or an exercise";
      if (top > d.citations.length) return `marker [${top}] has no citation`;
      if (d.card && d.card.kind === "prompt" && !d.card.rubric.length) return "a prompt card needs 2 to 4 rubric points";
      if (d.exercise && d.card) return "an exercise is for him to answer: propose no card with it";
      if (d.exercise) {
        if (!d.exercise.heading.trim().endsWith("?")) return "exercise.heading: the task as a short question";
        if (d.exercise.card.kind !== "prompt" || d.exercise.card.rubric.length < 2 || d.exercise.card.rubric.length > 4) return "exercise.card: a prompt card with 2 to 4 rubric points";
        const problem = cardTextProblem(d.exercise.card);
        if (problem) return `exercise.card: ${problem}`;
      }
      if (d.covered?.length) {
        if (!open) return "covered: [] when there is no open exercise";
        if (d.covered.length !== open.card.rubric.length) return `covered: one boolean per rubric point (${open.card.rubric.length})`;
      }
      return d.card ? cardTextProblem(d.card) : null;
    },
  });
  const citations: (Citation | WebCitation)[] = data.citations.map((c, i) => {
    if (isWebUrl(c.passage)) {
      const page = web?.pages.find((p) => samePage(p.url, c.passage));
      const url = page?.url ?? c.passage.trim();
      const at = page ? locate(pageWords(page), c.quote) : null;
      const quote = at ? pageWords(page!).slice(at.start, at.end) : c.quote;
      // A fetched page has no title of its own here: "" (the app shows its site alone).
      return { n: i + 1, url, title: page?.title ?? "", site: new URL(url).hostname.replace(/^www\./, ""), quote, text: plainText(quote) };
    }
    const p = byId.get(c.passage)!;
    const at = locate(p.text, c.quote)!;
    const quote = p.text.slice(at.start, at.end);
    return { n: i + 1, item: p.item, title: p.title, heading: p.heading, quote, text: plainText(quote), start: p.start + at.start, end: p.start + at.end };
  });
  // Feedback that found a point missing offers the exercise's own card (D158), never one the model wrote after his answer.
  const missed = !!open && !!data.covered?.length && data.covered.some((c) => !c);
  const card = missed ? open.card : data.card ? { ...data.card, rubric: data.card.kind === "card" ? [] : data.card.rubric } : null;
  return { message: m, reply: data.reply, citations, general: data.general, searched: web?.searched ?? false, hint: data.hint, exercise: data.exercise, steps: data.steps, card, ai, usage: usage as Usage };
}

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
