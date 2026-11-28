import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { hostname } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import { locate } from "../anchoring.ts";
import { eachMarker, markerNumbers } from "../markers.ts";
import { AiStamp, findItem, listItems, wordCount, type Item } from "../items.ts";
import { readAnnotations } from "../annotations.ts";
import { blankProblem, cardTextProblem, ContentType, hideBlanks, listCards, writeNewCard, type Card } from "../cards.ts";
import { readReviews } from "../reviews.ts";
import { chatFilePath } from "../chats.ts";
import { withIndex } from "../db.ts";
import { getDiagram, sceneOutline } from "../diagrams.ts";
import { writeAtomic } from "../fsutil.ts";
import { withLock } from "../lock.ts";
import { paths } from "../library.ts";
import { loadSkills } from "../skills.ts";
import type { Library } from "../library.ts";
import { aiStampFor, chooseVendor, isWebUrl, partialReply, runAgent, samePage, type Usage } from "./adapter.ts";
export { partialReply };
import { nearestSentence, PASSAGES, passageCitation, plainText, retrieve, splitPassages, type Citation, type Passage, type WebCitation } from "./ask.ts";
import { quoteIn } from "./grade.ts";
import { anchorEvidence } from "./check.ts";

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

/** Keep a link's visible Markdown, including any emphasis, when its destination can't cite a source. */
function withoutLocalLinks(text: string): string {
  if (!text.includes("[") && !text.includes("<")) return text;
  const { fromMarkdown } = require("mdast-util-from-markdown") as typeof import("mdast-util-from-markdown");
  type Node = { type: string; url?: string; identifier?: string; children?: Node[]; position?: { start: { offset?: number }; end: { offset?: number } } };
  const links: Node[] = [];
  const definitions = new Map<string, string>();
  const walk = (node: Node) => {
    if (node.type === "link" || node.type === "linkReference") links.push(node);
    if (node.type === "definition" && !definitions.has(node.identifier!)) definitions.set(node.identifier!, node.url!);
    node.children?.forEach(walk);
  };
  walk(fromMarkdown(text));
  for (const link of links.reverse()) {
    const url = link.type === "link" ? link.url! : definitions.get(link.identifier!);
    if (url === undefined || isWebUrl(url) || /^#cite-\d+(?:,\d+)*$/.test(url)) continue;
    const label = link.children?.length ? text.slice(link.children[0]!.position!.start.offset!, link.children.at(-1)!.position!.end.offset!) : "";
    text = text.slice(0, link.position!.start.offset!) + label + text.slice(link.position!.end.offset!);
  }
  return text;
}

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
  general: z.boolean().nullable(),
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
/** How much of a chat goes whole when it is handed to a new session, in words (about 40k tokens): past it the
 *  oldest turns shrink to what he asked. */
const EARLIER_WORDS = 30_000;
/** How long a source can be and still go whole. A chat he had elsewhere (D339) is the history the tutor
 *  carries on from, so it goes as a chat handed over does. */
const wholeUpTo = (it: Item) => (it.meta.chat ? EARLIER_WORDS : WHOLE_WORDS);
/** A session this large (tokens in front of the model) is left for a new one started from the saved turns: the
 *  source and the turns go again, word for word, and the web searches' bulk stays behind. The vendor's program would
 *  otherwise sum the oldest part up at its own limit, passages and all, and a quote from one could no longer be exact. */
const SESSION_ROOM = 150_000;

// D338: a chat is one session of the vendor's own program, as Review's "Ask about this" is (D61),
// so the model keeps every turn, its own replies and the source it was given once. What this Mac's session has
// been sent is kept beside it, in .ore/tutor/<chat>.json: disposable, like the session itself. The chat's file
// stays the record (D172), and a chat with no session to pick up starts one from it.
const TutorState = z.object({
  host: z.string(),
  vendor: z.string(),
  session: z.string(),
  /** What he has asked in it, as one key: saved turns that end otherwise (an edit, Try again, another Mac) don't match. */
  turns: z.string(),
  passages: z.array(z.object({ id: z.string(), item: z.string(), title: z.string(), heading: z.string(), text: z.string(), start: z.number(), end: z.number() })),
  reading: z.record(z.string(), z.unknown()).nullable(),
  missed: z.array(z.string()),
  /** The source that was open. */
  item: z.string().nullable(),
  /** The pages its web searches have returned so far. */
  web: z.array(z.object({ url: z.string(), title: z.string() })),
  context: z.number(),
});
type TutorState = z.infer<typeof TutorState>;
const stateFile = (lib: Library, chat: string) => {
  if (!/^[A-Za-z0-9-]{1,40}$/.test(chat)) throw new Error(`no chat "${chat}"`);
  return paths.tutorSession(lib, chat);
};
const readState = (lib: Library, chat: string): TutorState | null => {
  try { return TutorState.parse(JSON.parse(readFileSync(stateFile(lib, chat), "utf8"))); } catch { return null; }
};
/** The chat as the session knows it: every turn, his words and the reply. A turn he edited, a reply he swapped for
 *  another version, or a worked answer of which he has seen only some steps (the app hands over the steps shown,
 *  the session wrote them all) no longer matches, and the chat starts a new session from what is on screen. */
const turnsKey = (turns: { message: string; reply: string }[]) => createHash("sha256").update(JSON.stringify(turns.map((t) => [t.message.trim(), t.reply.trim()]))).digest("hex");
/** The vendor's words for a session it no longer has (cleared, or made on another Mac). */
const SESSION_GONE = /^(claude: |(claude|codex) failed \(exit \d+\): ).*(no conversation found|(session|thread|conversation|rollout)\b.*\bnot found|no (such )?(session|thread|rollout))/i;

/** What the tutor is told of the open source: whether its passages hold all of it (its headings when they
 *  don't), the section on his screen, and what he highlighted in it (D294), Key points marked,
 *  each with his note: the parts he chose to keep, in the order they come. */
export function readingOf(lib: Library, item: string, at?: string) {
  const it = findItem(lib, item);
  const marked = readAnnotations(it).filter((a) => (a.intent === "keep" || a.intent === "card") && !a.point).slice(0, 40)
    .map((a) => ({ text: cut(plainText(a.exact), 300), ...(a.intent === "card" ? { key: true } : {}), ...(a.note?.trim() ? { note: cut(a.note.trim(), 200) } : {}) }));
  const whole = wordCount(it.body) <= wholeUpTo(it);
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

const titleWords = (text: string) => text.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();

/** The open source and sources named by title can go whole, up to the whole-source budget. Longer and
 *  @-mentioned sources send their best passages, or passages from across the source when none match. */
export function tutorPassages(lib: Library, query: string, focus: TutorFocus = {}): Passage[] {
  return withIndex(lib, undefined, (index) => {
    const inSkills = focus.skills?.length ? new Set(listItems(lib).filter((i) => i.meta.skills.some((s) => focus.skills!.includes(s))).map((i) => i.meta.id)) : undefined;
    const question = ` ${titleWords(query)} `;
    const named = new Set(index.items().flatMap(({ id, title }) => {
      const words = titleWords(title);
      // A title of one short or common word ("Memory", "Notes") is in everyday questions: only a longer one names a source.
      const naming = !!words && (words.includes(" ") || words.length >= 8);
      return naming && question.includes(` ${words} `) && (!inSkills || inSkills.has(id)) ? [id] : [];
    }));
    const explicit = new Set([...(focus.item ? [focus.item] : []), ...(focus.sources ?? [])]);
    const focused = new Set([...explicit, ...named]);
    const each = focused.size ? Math.max(2, Math.floor(8 / focused.size)) : 0;
    const here: Passage[] = [];
    let whole = false;
    let wholeRoom = WHOLE_WORDS;
    for (const id of focused) {
      let it: Item;
      try { it = findItem(lib, id); } catch (e) { if (explicit.has(id)) throw e; continue; } // gone since indexing
      const all = () => splitPassages(it.body).map((p) => ({ ...p, id: "", item: it.meta.id, title: it.meta.title }));
      const words = wordCount(it.body);
      if (id === focus.item ? words <= wholeUpTo(it) : !explicit.has(id) && words <= wholeRoom) {
        whole = true;
        wholeRoom -= words;
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
    const rest = (inSkills?.size === 0 ? [] : retrieve(lib, query, PASSAGES, inSkills ? [...inSkills] : undefined, index)).filter((p) => !focused.has(p.item));
    // A whole source can fill the count alone: a few of the library's still come, so "how does this connect to…" has them.
    const room = Math.max(PASSAGES - here.length, whole ? 6 : 0);
    return [...here, ...rest.slice(0, room)].map((p, i) => ({ ...p, id: `P${i + 1}` }));
  });
}

/** While a reply is written: its text so far ("" when a retry starts it over), or a web search starting or done. Codex sends its reply whole, so from it only the search shows. */
export type TutorProgress = { reply: string } | { searching: boolean } | { ai: AiStamp };

/** What a quote from a web page is checked against: its title as the search gave it, then the results' text,
 *  which lists titles JSON-escaped (a title with "quotes" in it reads \"quotes\" there). */
const pageWords = (page: { title: string; text: string }) => `${page.title}\n${page.text}`;

/** One turn of the tutor. `earlier` is the conversation so far; `item` the source he is reading. `chat`: the
 *  saved chat this turn belongs to, which makes it a turn of that chat's session (D338); with none
 *  (an agent's one-off, the eval) nothing is kept and everything is sent. */
export async function tutor(lib: Library, message: string, { earlier = [], files = [], chat, onProgress, ...focus }: { earlier?: TutorTurn[]; files?: { name: string; path: string }[]; chat?: string; onProgress?: (p: TutorProgress) => void } & TutorFocus = {}) {
  const m = withDiagrams(lib, focus.item, message.trim());
  if (!m) throw new Error("message is empty");
  // Turns come as JSON from the app or an agent: one with no reply (or no message) is an empty one.
  earlier = earlier.map((t) => ({ ...t, message: String(t.message ?? ""), reply: String(t.reply ?? "") }));
  const vendor = chooseVendor(lib, "tutor");
  const saved = chat ? readState(lib, chat) : null;
  const live = saved && saved.host === hostname() && saved.vendor === vendor && saved.turns === turnsKey(earlier) && saved.context < SESSION_ROOM ? saved : null;
  if (chat) stateFile(lib, chat); // a chat id that is no file name is refused before anything runs
  const started = Date.now();
  /** `st`: the session to pick up, which has the turns so far and what was sent with them; null to send it all. */
  const once = async (st: TutorState | null) => {
    // Files attached to this message and to the recent ones (D189): the agent reads them from chats/files/, so a
    // follow-up about "the second chart" still has the picture. `attached` names each by its path.
    // A file gone from an earlier turn (deleted, or not synced to this Mac yet) is left out; one missing from this message is an error.
    const filesOf = (fs: { name: string; path: string }[] = [], strict = false) => fs.flatMap((f) => {
      try { return [{ name: String(f.name), file: chatFilePath(lib, String(f.path)) }]; } catch (e) { if (strict) throw e; return []; }
    });
    const attached = filesOf(files, true);
    // A session has the turns so far. Handed to a new one, they go whole, newest first, up to EARLIER_WORDS and
    // never fewer than six; of any left out, what he asked stays, a line each, so the chat still knows what it set
    // out to do. Only the last six turns' files are read again.
    let from = st ? 0 : earlier.length;
    for (let words = 0; from > 0; from--) {
      words += wordCount(earlier[from - 1]!.message) + wordCount(earlier[from - 1]!.reply);
      if (words > EARLIER_WORDS && earlier.length - from >= 6) break;
    }
    const before = earlier.slice(0, from).slice(-30).map((t) => cut(t.message, 120));
    const recent = (st ? [] : earlier.slice(from)).map(({ message, reply, files }, i, all) => { const a = i >= all.length - 6 ? filesOf(files) : []; return { message, reply, ...(a.length ? { attached: a } : {}) }; });
    const toRead = [...new Set([...recent.flatMap((t) => t.attached ?? []), ...attached].map((f) => f.file))];
    // The exercise he is answering: the last one set, however long ago, with the card committed then.
    const open = earlier.flatMap((t) => { const e = Exercise.safeParse(t.exercise); return e.success ? [e.data] : []; }).at(-1);
    // What a session was told stays told: of the open source, where he is and what he marked go again only as
    // they change (a source he has since closed as null), and the exercises he last missed when that list does.
    const nowReading = focus.item ? (readingOf(lib, focus.item, focus.at) as Record<string, unknown>) : null;
    const was = st?.reading ?? null;
    let reading: Record<string, unknown> | null | undefined = nowReading ?? (was ? null : undefined);
    if (was && nowReading && st?.item === focus.item) {
      // A part that is no longer so (he scrolled above the first heading, removed his highlights) goes as null.
      const changed = [...new Set([...Object.keys(was), ...Object.keys(nowReading)])].filter((k) => k !== "title" && JSON.stringify(nowReading[k]) !== JSON.stringify(was[k]));
      reading = changed.length ? { title: nowReading.title, ...Object.fromEntries(changed.map((k) => [k, nowReading[k] ?? null])) } : undefined;
    }
    const missedNow = missedIn(lib, focus);
    // To a session the list goes when it changed, empty too (he has since got them right); to a new one when there is any.
    const missedBefore = st ? (JSON.stringify(st.missed) === JSON.stringify(missedNow) ? undefined : missedNow) : missedNow.length ? missedNow : undefined;
    const skillNames = new Map(loadSkills(lib).skills.map((s) => [s.id, s.name]));
    for (const s of focus.skills ?? []) if (!skillNames.has(s)) throw new Error(`no skill "${s}"`);
    const pointed = [...(focus.sources ?? []).map((id) => findItem(lib, id).meta.title), ...(focus.skills ?? []).map((s) => `the skill ${skillNames.get(s)}`)];
    // A passage keeps the number it was first sent under for the whole chat, so a later reply can cite it; only
    // the ones the session hasn't seen go with this message, numbered on from there.
    // One whose source has changed under it since (an edit, a reimport) is no longer where it says: it stays
    // counted and is sent again, as it now reads, under a new number.
    const sent = st?.passages ?? [];
    const bodies = new Map<string, string>();
    const bodyOf = (item: string) => { if (!bodies.has(item)) { try { bodies.set(item, findItem(lib, item).body); } catch { bodies.set(item, ""); } } return bodies.get(item)!; };
    const known = sent.filter((p) => bodyOf(p.item).slice(p.start, p.end) === p.text);
    const passages = tutorPassages(lib, [...earlier.slice(-2).map((t) => t.message), m].join(" "), focus)
      .filter((p) => !known.some((k) => k.item === p.item && k.start === p.start && k.end === p.end && k.text === p.text))
      .map((p, i) => ({ ...p, id: `P${sent.length + i + 1}` }));
    const oldWeb = st?.web ?? [];
    let last = 0;
    // First, who is answering: a reply he stops part way is kept with it, as a whole one is.
    onProgress?.({ ai: aiStampFor(lib, "tutor") });
    const byId = new Map([...known, ...passages].map((p) => [p.id, p]));
    // What the check mended in the reply that was kept (a retry starts the count over).
    let repaired = { moved: 0, dropped: 0 };
    // Each turn leaves a line in the library's logs (D295): how long he waited, for the first words and
    // for the whole reply, whether it went back, what was mended, or why it failed. Never what was said.
    let firstWords: number | undefined;
    const log = (line: object) => {
      try {
        mkdirSync(paths.logs(lib), { recursive: true });
        appendFileSync(join(paths.logs(lib), "tutor.jsonl"), `${JSON.stringify({ ts: new Date(started).toISOString(), ms: Date.now() - started, ...(firstWords !== undefined ? { first_ms: firstWords } : {}), ...line })}\n`);
      } catch { /* a log is a nicety: the reply still goes */ }
    };
    // A session is found again from the folder it started in, so a chat's every turn starts in the same one.
    const home = join(paths.chats(lib), "files");
    if (chat) mkdirSync(home, { recursive: true });
    // What is kept goes before the run and comes back with its reply: a turn that fails, or that he stops, leaves
    // half of itself in the session, so the next one starts a new session from the saved turns.
    if (chat) rmSync(stateFile(lib, chat), { force: true });
    const { data, ai, usage, web, runs, session } = await runAgent(lib, {
      prompt: "tutor",
      // With a file to read it starts in chats/files, not the library: what sits in its folder it may read (D292).
      cwd: chat ? home : toRead.length ? dirname(toRead[0]!) : lib.root,
      ...(chat ? { session: { id: st?.session } } : {}),
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
      input: { message: m, ...(attached.length ? { attached } : {}), ...(before.length ? { before } : {}), ...(st ? {} : { earlier: recent }), ...(open ? { exercise: { heading: open.heading, card: open.card } } : {}), ...(reading !== undefined ? { reading } : {}), ...(missedBefore ? { missed: missedBefore } : {}), ...(pointed.length ? { about: pointed } : {}), passages: passages.map(({ id, title, heading, text }) => ({ id, source: title, heading, text })) },
      check: (d, seen, attempt) => {
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
          // A page an earlier message's search returned is still in the session: its link holds, and its text isn't kept to check a quote against.
          if (!page && oldWeb.some((p) => samePage(p.url, c.passage))) continue;
          // The retry is a fresh run that can't see this one's results, so the reason lists them.
          const returned = seen.pages.slice(0, 8).map((p) => p.url).join(", ") || "none: search first";
          if (!page) return `${c.passage} is not a page your web search returned (it returned ${returned}): cite one of those, or a passage`;
          if (!mend(c, pageWords(page))) return `the quote "${c.quote}" is not in what the web search returned for ${page.url}: copy its exact words`;
        }
        const keep = d.citations.map((c) => isWebUrl(c.passage) || mend(c, byId.get(c.passage)?.text));
        if (keep.includes(false)) {
          repaired.dropped += keep.filter((k) => !k).length;
          const cited = (n: number) => n >= 1 && n <= keep.length;
          const renumber = (text: string) => eachMarker(text, cited, (all, n) => {
            const i = n - 1;
            if (i < 0 || i >= keep.length) return all;
            return keep[i] ? `${all.startsWith(" ") ? " " : ""}[${keep.slice(0, i + 1).filter(Boolean).length}]` : "";
          });
          d.reply = renumber(d.reply);
          d.steps = d.steps.map(renumber);
          d.citations = d.citations.filter((_, i) => keep[i]);
          d.general = true;
        }
        if (d.steps.length === 1 || d.steps.length > 6) return "steps: give 2 to 6 steps, or [] when the reply isn't a worked answer";
        if (d.steps.length && (d.hint || d.exercise)) return "steps are a worked answer: not with a hint or an exercise";
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
        if (d.card) {
          d.card.question = hideBlanks(d.card.question); // what the + Exercise chip shows, before it is kept
          const problem = cardTextProblem(d.card) ?? blankProblem(d.card);
          if (problem) return problem;
        }
        // Every text that reaches the screen: the reply and its steps, an exercise’s heading, a proposed card.
        const texts: [() => string | null | undefined, (t: string) => void][] = [
          [() => d.reply, (t) => (d.reply = t)],
          ...d.steps.map((_, i): [() => string, (t: string) => void] => [() => d.steps[i]!, (t) => (d.steps[i] = t)]),
          [() => d.exercise?.heading, (t) => (d.exercise!.heading = t)],
          [() => d.card?.question, (t) => (d.card!.question = t)],
          [() => d.card?.answer, (t) => (d.card!.answer = t)],
        ];
        const linked = texts.filter(([get]) => { const t = get(); return typeof t === "string" && withoutLocalLinks(t) !== t; });
        if (linked.length) {
          if (attempt === 1) return "the answer links to a local path: cite the passage in citations instead, with its [n] marker in the reply or step";
          for (const [get, set] of linked) set(withoutLocalLinks(get()!));
        }
        const uncited = d.general === false && !d.citations.length && !d.hint && !d.exercise && !d.covered.length;
        if (uncited && attempt === 2) {
          const unmark = (text: string) => eachMarker(text, () => false, (marker, n) => n > 0 ? "" : marker);
          d.reply = unmark(d.reply);
          d.steps = d.steps.map(unmark);
          d.general = true;
        }
        // A glued [n] counts only when citation n exists, so it never fails this (markers.ts).
        const top = Math.max(0, ...[d.reply, ...d.steps].flatMap((t) => markerNumbers(t, (n) => n >= 1 && n <= d.citations.length)));
        if (top > d.citations.length) return `marker [${top}] has no citation`;
        if (uncited && attempt === 1) return "citations are missing: cite the passages or web results that support the answer, or set general to true for outside knowledge, or null if it only responds to his message or attachments without factual claims from other sources";
        return null;
      },
    }).catch((e: unknown) => {
      // A session that is gone is no failure of this turn: it runs again in a new one, and that run leaves the line.
      const why = String((e as Error)?.message ?? e);
      if (!(st && SESSION_GONE.test(why))) log({ error: why.slice(0, 300) });
      throw e;
    });
    log({ runs, searched: web?.searched ?? false, ...repaired, input_tokens: usage.input_tokens, output_tokens: usage.output_tokens, model: ai.model, prompt: ai.prompt_version });
    const citations: (Citation | WebCitation)[] = data.citations.map((c, i) => {
      if (isWebUrl(c.passage)) {
        const page = web?.pages.find((p) => samePage(p.url, c.passage));
        const old = page ? undefined : oldWeb.find((p) => samePage(p.url, c.passage));
        const url = page?.url ?? old?.url ?? c.passage.trim();
        const at = page ? locate(pageWords(page), c.quote) : null;
        const quote = at ? pageWords(page!).slice(at.start, at.end) : c.quote;
        // A fetched page has no title of its own here: "" (the app shows its site alone).
        return { n: i + 1, url, title: page?.title ?? old?.title ?? "", site: new URL(url).hostname.replace(/^www\./, ""), quote, text: plainText(quote) };
      }
      return passageCitation(byId.get(c.passage)!, c.quote, i + 1);
    });
    if (chat && session) {
      const pages = [...oldWeb, ...(web?.pages ?? []).filter((p) => !oldWeb.some((o) => samePage(o.url, p.url))).map(({ url, title }) => ({ url, title }))];
      const next: TutorState = { host: hostname(), vendor, session, turns: turnsKey([...earlier, { message, reply: data.reply }]), passages: [...sent, ...passages], item: focus.item ?? null, reading: nowReading, missed: missedNow, web: pages, context: usage.context_tokens ?? 0 };
      mkdirSync(dirname(stateFile(lib, chat)), { recursive: true });
      writeAtomic(stateFile(lib, chat), JSON.stringify(next));
    }
    // Feedback that found a point missing offers the exercise's own card (D158), never one the model wrote after his answer.
    const missed = !!open && data.covered.length > 0 && data.covered.some((c) => !c);
    const card = missed ? open.card : data.card ? { ...data.card, rubric: data.card.kind === "card" ? [] : data.card.rubric } : null;
    // Each point of the committed card with its mark and the words of his that earned it (D162), as Review's
    // check shows them (D141): a quote is kept only for a covered point and only when it is in what he wrote.
    const marks = open && data.covered.length ? open.card.rubric.map((point, i) => ({ point, covered: data.covered[i]!, quote: data.covered[i] ? quoteIn(message.trim(), data.evidence[i] ?? "") : "" })) : [];
    return { message: m, title: earlier.length ? "" : data.title.trim().slice(0, 80), reply: data.reply, citations, general: data.general ?? false, searched: web?.searched ?? false, hint: data.hint, exercise: data.exercise, steps: data.steps, card, marks, repaired, ai, usage: usage as Usage };
  };
  if (!live) return once(null);
  try {
    return await once(live);
  } catch (e) {
    // The program no longer has that session (it clears old ones): the saved turns start another.
    if (!SESSION_GONE.test(String((e as Error)?.message ?? e))) throw e;
    return once(null);
  }
}

const CitedPassage = z.object({ item: z.string(), quote: z.string().min(1), start: z.number().int().nonnegative() });

/** Keeps a card the tutor proposed (D128, D9: it goes into review like any draft). It belongs to the
 *  source it came from (the first one cited, else the one he was reading) and takes that source's
 *  skills and first topic; the AI that wrote it is recorded. */
export async function addTutorCard(lib: Library, item: string, card: TutorCard, ai: AiStamp, citations: z.input<typeof CitedPassage>[] = []): Promise<Card> {
  const c = TutorCard.parse(card);
  const problem = cardTextProblem(c);
  if (problem) throw new Error(problem);
  if (c.kind === "prompt" && !c.rubric.length) throw new Error("a prompt card needs rubric points");
  // Checked as a card's read checks it: a stamp missing a field made a card no list could read (F811).
  const stamp = AiStamp.safeParse(ai);
  if (!stamp.success) throw new Error(`--ai: ${stamp.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  // A citation that doesn't read as a passage (an empty quote, an old chat's) is left out; the rest still anchor.
  const passages = citations.flatMap((c) => { const r = CitedPassage.safeParse(c); return r.success ? [r.data] : []; });
  return withLock(paths.lock(lib), () => {
    const it = findItem(lib, item);
    return writeNewCard(lib, {
      kind: c.kind, item: it.meta.id, from: "tutor", skills: it.meta.skills, topics: it.meta.topics.slice(0, 1), content_type: c.content_type,
      question: c.question, answer: c.answer, rubric: c.kind === "prompt" ? c.rubric : [], ai: stamp.data,
      evidence: anchorEvidence(it.body, passages.filter((p) => p.item === it.meta.id)),
    });
  });
}
