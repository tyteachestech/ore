import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { locate } from "../anchoring.ts";
import { inProse, MARKER, markerNumbers } from "../markers.ts";
import { findItem, listItems, type AiStamp } from "../items.ts";
import { readAnnotations } from "../annotations.ts";
import { blankProblem, cardTextProblem, ContentType, hideBlanks, listCards, writeNewCard, type Card } from "../cards.ts";
import { readReviews } from "../reviews.ts";
import { chatFilePath } from "../chats.ts";
import { getDiagram, sceneOutline } from "../diagrams.ts";
import { withLock } from "../lock.ts";
import { paths } from "../library.ts";
import { loadSkills } from "../skills.ts";
import type { Library } from "../library.ts";
import { aiStampFor, isWebUrl, partialReply, runAgent, samePage, type Usage } from "./adapter.ts";
export { partialReply };
import { nearestSentence, PASSAGES, passageCitation, plainText, retrieve, splitPassages, type Citation, type Passage, type WebCitation } from "./ask.ts";
import { quoteIn } from "./grade.ts";

// The tutor (D128): the chat docked at the window's right, grown out of Ask your library. It answers
// his own questions from his sources with citations; when they don't hold the answer it says so, then
// searches the web (cited the same way) or answers from general knowledge under a label. It gives hints
// instead of answers on practice, and uses the source he has open, and the sources and skills he
// @-mentions, as context.

/** One earlier turn. A turn that set an exercise carries it, with the card committed then (D158). */
/** `files`: what he attached to that message (D189), as `attachToChat` returned them. */
export interface TutorTurn { message: string; reply: string; exercise?: z.input<typeof Exercise>; files?: { name: string; path: string }[] }

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
export const Exercise = z.strictObject({
  heading: z.string().min(1).max(100),
  prompts: z.array(z.string().min(1)).max(3),
  card: TutorCard,
  // A tell apart's two cases, each in full, which the app shows side by side with an answer line under each (D163).
  cases: z.array(z.string().min(1)).nullable().default(null),
});
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
  covered: z.array(z.boolean()).default([]),
  // With `covered`: per rubric point, the shortest stretch of his answer that states it, word for word; "" when not covered (D162).
  evidence: z.array(z.string()).default([]),
  // A short name for the chat, written with its first reply (D172), so the list of chats reads by topic; "" after that.
  title: z.string().default(""),
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
/** `at`: the heading of the section on his screen in the source he is reading (D294). */
export interface TutorFocus { item?: string; sources?: string[]; skills?: string[]; at?: string }

/** The source he has open goes to the tutor whole up to this many words (about 20k tokens a turn, D290):
 *  "Summarize this", "What's this about?" and Practice share no words with it, and got its opening alone. */
export const WHOLE_WORDS = 15_000;
/** How much of the chat so far goes with each message, in words (about 4k tokens). */
const EARLIER_WORDS = 3_000;
const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** What the tutor is told of the open source: whether its passages hold all of it (its headings when they
 *  don't), the section on his screen, and what he highlighted in it (D294), Key points marked,
 *  each with his note: the parts he chose to keep, in the order they come. */
export function readingOf(lib: Library, item: string, at?: string) {
  const it = findItem(lib, item);
  const marked = readAnnotations(it).filter((a) => (a.intent === "keep" || a.intent === "card") && !a.point).slice(0, 40)
    .map((a) => ({ text: cut(plainText(a.exact), 300), ...(a.intent === "card" ? { key: true } : {}), ...(a.note?.trim() ? { note: cut(a.note.trim(), 200) } : {}) }));
  const whole = wordCount(it.body) <= WHOLE_WORDS;
  // Headings only: a `# comment` inside a code block is not one.
  const outline = whole ? undefined : [...it.body.replace(/^(```|~~~)[\s\S]*?^\1.*$/gm, "").matchAll(/^#{1,6}[ \t]+(.+)$/gm)].map((m) => m[1]!.replace(/\\/g, "").trim()).slice(0, 80);
  return { title: it.meta.title, whole, ...(outline ? { outline } : {}), ...(at?.trim() ? { at: at.trim() } : {}), ...(marked.length ? { marked } : {}) };
}
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

/** The exercises he got wrong the last time review brought them (D294), newest miss first, question
 *  only: from the source he is reading and the ones he @-mentioned, and from the skills he named. */
export function missedIn(lib: Library, focus: TutorFocus): string[] {
  if (!focus.item && !focus.sources?.length && !focus.skills?.length) return [];
  const items = new Set([...(focus.item ? [focus.item] : []), ...(focus.sources ?? [])].map((id) => findItem(lib, id).meta.id));
  const cards = listCards(lib).filter((c) => c.meta.state !== "retired" && (items.has(c.meta.item) || c.meta.skills.some((s) => focus.skills?.includes(s))));
  if (!cards.length) return [];
  const last = new Map<string, { ts: string; rating: number }>();
  for (const r of readReviews(lib)) if (!last.has(r.card) || last.get(r.card)!.ts <= r.ts) last.set(r.card, r);
  return cards.filter((c) => last.get(c.meta.id)?.rating === 1).sort((a, b) => last.get(b.meta.id)!.ts.localeCompare(last.get(a.meta.id)!.ts)).slice(0, 5).map((c) => cut(c.question, 240));
}

/** The passages the tutor sees: the source he is reading whole (past WHOLE_WORDS, its best, or ones from across
 *  it when the message names no words in it), the @-mentioned sources' best, then the rest of the library's, or
 *  only of the @-mentioned skills' sources when he named a skill. */
export function tutorPassages(lib: Library, query: string, focus: TutorFocus = {}): Passage[] {
  const focused = [...new Set([...(focus.item ? [focus.item] : []), ...(focus.sources ?? [])])];
  const each = focused.length ? Math.max(2, Math.floor(8 / focused.length)) : 0;
  const here: Passage[] = [];
  let whole = false;
  for (const id of focused) {
    const it = findItem(lib, id);
    const all = () => splitPassages(it.body).map((p) => ({ ...p, id: "", item: it.meta.id, title: it.meta.title }));
    if (id === focus.item && wordCount(it.body) <= WHOLE_WORDS) {
      whole = true;
      here.push(...all());
      continue;
    }
    let ps = retrieve(lib, query, each, id);
    if (!ps.length) {
      const every = all();
      const n = Math.min(each, every.length);
      ps = Array.from({ length: n }, (_, i) => every[Math.floor((i * every.length) / n)]!);
    }
    here.push(...ps);
  }
  const inSkills = focus.skills?.length ? listItems(lib).filter((i) => i.meta.skills.some((s) => focus.skills!.includes(s))).map((i) => i.meta.id) : undefined;
  const rest = (inSkills ? (inSkills.length ? retrieve(lib, query, PASSAGES, inSkills) : []) : retrieve(lib, query, PASSAGES)).filter((p) => !focused.includes(p.item));
  // A whole source can fill the count alone: a few of the library's still come, so "how does this connect to…" has them.
  const room = Math.max(PASSAGES - here.length, whole ? 6 : 0);
  return [...here, ...rest.slice(0, room)].map((p, i) => ({ ...p, id: `P${i + 1}` }));
}

/** While a reply is written: its text so far ("" when a retry starts it over), or a web search starting or done. Codex sends its reply whole, so from it only the search shows. */
export type TutorProgress = { reply: string } | { searching: boolean } | { ai: AiStamp };

/** What a quote from a web page is checked against: its title as the search gave it, then the results' text,
 *  which lists titles JSON-escaped (a title with "quotes" in it reads \"quotes\" there). */
const pageWords = (page: { title: string; text: string }) => `${page.title}\n${page.text}`;

/** One turn of the tutor. `earlier` is the conversation so far; `item` the source he is reading. */
export async function tutor(lib: Library, message: string, { earlier = [], files = [], onProgress, ...focus }: { earlier?: TutorTurn[]; files?: { name: string; path: string }[]; onProgress?: (p: TutorProgress) => void } & TutorFocus = {}) {
  const m = withDiagrams(lib, focus.item, message.trim());
  if (!m) throw new Error("message is empty");
  // Files attached to this message and to the recent ones (D189): the agent reads them from chats/files/, so a
  // follow-up about "the second chart" still has the picture. `attached` names each by its path.
  // A file gone from an earlier turn (deleted, or not synced to this Mac yet) is left out; one missing from this message is an error.
  const filesOf = (fs: { name: string; path: string }[] = [], strict = false) => fs.flatMap((f) => {
    try { return [{ name: String(f.name), file: chatFilePath(lib, String(f.path)) }]; } catch (e) { if (strict) throw e; return []; }
  });
  const attached = filesOf(files, true);
  // Earlier turns go by size, newest first (D293): a chat of short turns goes whole, long replies push
  // the oldest out, and never fewer than six go. Of the turns left out, what he asked stays, a line each, so a long
  // chat still knows what it set out to do. Only the last six turns' files are read again.
  // Turns come as JSON from the app or an agent: one with no reply (or no message) is an empty one.
  earlier = earlier.map((t) => ({ ...t, message: String(t.message ?? ""), reply: String(t.reply ?? "") }));
  let from = earlier.length;
  for (let words = 0; from > 0; from--) {
    words += wordCount(earlier[from - 1]!.message) + wordCount(earlier[from - 1]!.reply);
    if (words > EARLIER_WORDS && earlier.length - from >= 6) break;
  }
  const before = earlier.slice(0, from).slice(-30).map((t) => cut(t.message, 120));
  const recent = earlier.slice(from).map(({ message, reply, files }, i, all) => { const a = i >= all.length - 6 ? filesOf(files) : []; return { message, reply, ...(a.length ? { attached: a } : {}) }; });
  const toRead = [...new Set([...recent.flatMap((t) => t.attached ?? []), ...attached].map((f) => f.file))];
  // The exercise he is answering: the last one set, however long ago, with the card committed then.
  const open = earlier.flatMap((t) => { const e = Exercise.safeParse(t.exercise); return e.success ? [e.data] : []; }).at(-1);
  const reading = focus.item ? readingOf(lib, focus.item, focus.at) : undefined;
  const missedBefore = missedIn(lib, focus);
  const skillNames = new Map(loadSkills(lib).skills.map((s) => [s.id, s.name]));
  for (const s of focus.skills ?? []) if (!skillNames.has(s)) throw new Error(`no skill "${s}"`);
  const pointed = [...(focus.sources ?? []).map((id) => findItem(lib, id).meta.title), ...(focus.skills ?? []).map((s) => `the skill ${skillNames.get(s)}`)];
  const passages = tutorPassages(lib, [...recent.slice(-2).map((t) => t.message), m].join(" "), focus);
  let last = 0;
  // First, who is answering: a reply he stops part way is kept with it, as a whole one is.
  onProgress?.({ ai: aiStampFor(lib, "tutor") });
  const byId = new Map(passages.map((p) => [p.id, p]));
  // What the check mended in the reply that was kept (a retry starts the count over).
  let repaired = { moved: 0, dropped: 0 };
  // Each turn leaves a line in the library's logs (D295): how long he waited, for the first words and
  // for the whole reply, whether it went back, what was mended, or why it failed. Never what was said.
  const started = Date.now();
  let firstWords: number | undefined;
  const log = (line: object) => {
    try {
      mkdirSync(paths.logs(lib), { recursive: true });
      appendFileSync(join(paths.logs(lib), "tutor.jsonl"), `${JSON.stringify({ ts: new Date(started).toISOString(), ms: Date.now() - started, ...(firstWords !== undefined ? { first_ms: firstWords } : {}), ...line })}\n`);
    } catch { /* a log is a nicety: the reply still goes */ }
  };
  const { data, ai, usage, web, runs } = await runAgent(lib, {
    prompt: "tutor",
    // With a file to read it starts in chats/files, not the library: what sits in its folder it may read (D292).
    cwd: toRead.length ? dirname(toRead[0]!) : lib.root,
    web: true,
    ...(toRead.length ? { files: toRead } : {}),
    onProgress: onProgress && ((p) => {
      if ("searching" in p) return onProgress(p);
      if (!p.partial) return (last = 0), onProgress({ reply: "" });
      // A few updates a second read as smooth; reading the whole JSON again on every token would not be.
      if (Date.now() - last < 50) return;
      const reply = partialReply(p.partial);
      if (reply) (last = Date.now()), (firstWords ??= last - started), onProgress({ reply });
    }),
    schema: TutorOutput,
    input: { message: m, ...(attached.length ? { attached } : {}), ...(before.length ? { before } : {}), earlier: recent, ...(open ? { exercise: { heading: open.heading, card: open.card } } : {}), ...(reading ? { reading } : {}), ...(missedBefore.length ? { missed: missedBefore } : {}), ...(pointed.length ? { about: pointed } : {}), passages: passages.map(({ id, title, heading, text }) => ({ id, source: title, heading, text })) },
    check: (d, seen) => {
      repaired = { moved: 0, dropped: 0 };
      // A citation that fails is mended here, never a reason to write the reply again (D291): a quote a
      // few words off moves to the sentence that says it; one with no such sentence, or naming a passage that
      // wasn't given, goes with its marker, and the reply is then marked as not all from his sources.
      const mend = (c: (typeof d.citations)[number], text: string | undefined) => {
        if (text === undefined) return false;
        if (locate(text, c.quote)) return true;
        const near = nearestSentence(text, c.quote);
        if (!near || !locate(text, near)) return false;
        c.quote = near;
        repaired.moved++;
        return true;
      };
      // A web page is held to more: a link the search never returned is a made-up source, so it goes back to fix.
      for (const c of d.citations) {
        if (!isWebUrl(c.passage)) continue;
        if (!URL.canParse(c.passage.trim())) return `${c.passage} is not a link`;
        // Claude reports the text its searches returned, so a web citation is checked as a passage is; codex
        // reports each result's snippet alone, which a quote from the page itself would fail.
        if (!seen || seen.snippets) continue;
        const page = seen.pages.find((p) => samePage(p.url, c.passage));
        // The retry is a fresh run that can't see this one's results, so the reason lists them.
        const returned = seen.pages.slice(0, 8).map((p) => p.url).join(", ") || "none: search first";
        if (!page) return `${c.passage} is not a page your web search returned (it returned ${returned}): cite one of those, or a passage`;
        if (!mend(c, pageWords(page))) return `the quote "${c.quote}" is not in what the web search returned for ${page.url}: copy its exact words`;
      }
      const keep = d.citations.map((c) => isWebUrl(c.passage) || mend(c, byId.get(c.passage)?.text));
      if (keep.includes(false)) {
        repaired.dropped += keep.filter((k) => !k).length;
        const renumber = (text: string) => inProse(text, (part) => part.replace(MARKER, (all, n: string) => {
          const i = +n - 1;
          if (i < 0 || i >= keep.length) return all;
          return keep[i] ? `${all.startsWith(" ") ? " " : ""}[${keep.slice(0, i + 1).filter(Boolean).length}]` : "";
        }));
        d.reply = renumber(d.reply);
        d.steps = d.steps.map(renumber);
        d.citations = d.citations.filter((_, i) => keep[i]);
        d.general = true;
      }
      const top = Math.max(0, ...[d.reply, ...d.steps].flatMap(markerNumbers));
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
        if (d.exercise.cases && d.exercise.cases.length !== 2) return "exercise.cases: a tell apart's two cases, each in full; null for any other kind";
      }
      if (d.covered.length) {
        if (!open) return "covered: [] when there is no open exercise";
        if (d.covered.length !== open.card.rubric.length) return `covered: one boolean per rubric point (${open.card.rubric.length})`;
        if (d.evidence.length !== d.covered.length) return `evidence: one per rubric point (${d.covered.length}), "" where not covered`;
      }
      if (!d.card) return null;
      d.card.question = hideBlanks(d.card.question); // what the + Exercise chip shows, before it is kept
      return cardTextProblem(d.card) ?? blankProblem(d.card);
    },
  }).catch((e: unknown) => { log({ error: String((e as Error)?.message ?? e).slice(0, 300) }); throw e; });
  log({ runs, searched: web?.searched ?? false, ...repaired, input_tokens: usage.input_tokens, output_tokens: usage.output_tokens, model: ai.model, prompt: ai.prompt_version });
  const citations: (Citation | WebCitation)[] = data.citations.map((c, i) => {
    if (isWebUrl(c.passage)) {
      const page = web?.pages.find((p) => samePage(p.url, c.passage));
      const url = page?.url ?? c.passage.trim();
      const at = page ? locate(pageWords(page), c.quote) : null;
      const quote = at ? pageWords(page!).slice(at.start, at.end) : c.quote;
      // A fetched page has no title of its own here: "" (the app shows its site alone).
      return { n: i + 1, url, title: page?.title ?? "", site: new URL(url).hostname.replace(/^www\./, ""), quote, text: plainText(quote) };
    }
    return passageCitation(byId.get(c.passage)!, c.quote, i + 1);
  });
  // Feedback that found a point missing offers the exercise's own card (D158), never one the model wrote after his answer.
  const missed = !!open && data.covered.length > 0 && data.covered.some((c) => !c);
  const card = missed ? open.card : data.card ? { ...data.card, rubric: data.card.kind === "card" ? [] : data.card.rubric } : null;
  // Each point of the committed card with its mark and the words of his that earned it (D162), as Review's
  // check shows them (D141): a quote is kept only for a covered point and only when it is in what he wrote.
  const marks = open && data.covered.length ? open.card.rubric.map((point, i) => ({ point, covered: data.covered[i]!, quote: data.covered[i] ? quoteIn(message.trim(), data.evidence[i] ?? "") : "" })) : [];
  return { message: m, title: earlier.length ? "" : data.title.trim().slice(0, 80), reply: data.reply, citations, general: data.general, searched: web?.searched ?? false, hint: data.hint, exercise: data.exercise, steps: data.steps, card, marks, repaired, ai, usage: usage as Usage };
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
