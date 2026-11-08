import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { readAnnotations, type Annotation } from "../annotations.ts";
import { reflections } from "../tries.ts";
import { locate } from "../anchoring.ts";
import { listQuestions } from "../questions.ts";
import { cardTextProblem, ContentType, CardKind, listCards, writeNewCard, type Card } from "../cards.ts";
import { stringifyFrontmatter } from "../frontmatter.ts";
import { sha256, writeAtomic } from "../fsutil.ts";
import { nowIso, slugify } from "../ids.ts";
import { findItem, hasAttempts, listItems, ItemMetaSchema, type Item } from "../items.ts";
import { paths, type Library } from "../library.ts";
import { withLock } from "../lock.ts";
import { pendingNotes } from "../notes.ts";
import { loadSkills, matchSkill } from "../skills.ts";
import { ensureTopic, listTopics } from "../topics.ts";
import { runAgent, type Usage } from "./adapter.ts";
import { anchorEvidence, finishScope } from "./check.ts";

export const EnrichOutput = z.strictObject({
  prequestions: z.array(z.string().min(1)).min(2).max(4),
  skills: z.array(z.string()).max(3),
  suggested_skill: z.strictObject({ name: z.string().min(1), hook: z.string() }).nullable(),
  topics: z.array(z.strictObject({ slug: z.string().min(1), name: z.string().min(1), summary: z.string() })).min(1).max(3),
  drafts: z.array(
    z.strictObject({
      annotation: z.string().nullable(),
      from_notes: z.boolean(),
      prequestion: z.number().int().nullable(),
      kind: CardKind,
      content_type: ContentType,
      question: z.string().min(1),
      answer: z.string().min(1),
      rubric: z.array(z.string()),
      topics: z.array(z.string()),
      // D118: the other highlights this draft is planned from, when one idea spans several.
      also: z.array(z.string()).default([]),
      // For a highlight he typed with nothing selected ("Card here"): the sentences of the document that answer it.
      evidence: z.array(z.string()).default([]),
    }),
  ),
  // D75: open questions (from `open_questions`) this document answers, with the exact sentence that does.
  question_matches: z.array(z.strictObject({ question: z.string(), quote: z.string().min(1) })).max(3).default([]),
});
export type EnrichOutput = z.infer<typeof EnrichOutput>;

/** Plain highlights the finish plan writes no more than this many cards from (D118); key points come on top. */
export const PLAN_CAP = 5;

// Highlights that should become review items and have none yet (D19, D118): a key point (`card` intent
// in the files) at once, a question he answered with "Answered + card" (D75), and once the source is
// finished every plain highlight the plan has not weighed yet. They are signals: the plan groups them
// into ideas, so one card can come from several and most plain ones get none.
export function pendingHighlights(item: Item, cards: Card[]): Annotation[] {
  const drafted = new Set(cards.flatMap((c) => [c.meta.annotation, ...(c.meta.also ?? [])]).filter(Boolean));
  const planned = new Set(item.meta.planned ?? []);
  const wanted = (a: Annotation) =>
    a.intent === "card" ||
    (a.intent === "question" && a.card && a.status === "done" && a.answers?.length) ||
    // D148: a try re-planned with "Next time I'll…" is open again, but the round he wrote up still gets its card.
    (a.intent === "apply" && reflections(a).length > 0) ||
    (a.intent === "keep" && item.meta.status === "done" && !planned.has(a.id));
  return readAnnotations(item).filter((a) => wanted(a) && !drafted.has(a.id));
}

// D118: what the skills already ask, so the plan never writes a card twice. Newest first, a cap for the prompt.
function skillCards(cards: Card[], item: Item): string[] {
  const mine = new Set(item.meta.skills);
  return cards
    .filter((c) => c.meta.state !== "retired" && (c.meta.item === item.meta.id || c.meta.skills.some((s) => mine.has(s))))
    .sort((a, b) => b.meta.created.localeCompare(a.meta.created))
    .slice(0, 80)
    .map((c) => c.question);
}

// D75: open questions a newly captured source might answer: those of its skills (all, when it has
// none yet), never its own, newest first.
function openQuestions(lib: Library, item: Item) {
  const qs = item.meta.skills.length ? listQuestions(lib, { item: item.meta.id }).filter((q) => q.here === "skill") : listQuestions(lib);
  return qs
    .filter((q) => q.status === "open" && q.item !== item.meta.id)
    .slice(0, 30)
    .map((q) => ({ id: q.id, question: q.note ?? q.exact, passage: q.note ? q.exact : null }));
}

// Prequestions (1-based) of a finished item that have no review item yet (D19).
// Never before the finish: until then they are still being answered.
export function pendingPrequestions(item: Item, cards: Card[]): { n: number; q: string }[] {
  if (item.meta.status !== "done") return [];
  const drafted = new Set(cards.filter((c) => c.meta.item === item.meta.id && c.meta.from === "prequestion").map((c) => c.meta.prequestion));
  // A prequestion left out of a partway finish (D100) gets no card.
  return (item.meta.prequestions ?? []).map((p, i) => ({ n: i + 1, q: p.q, skipped: !!p.skipped })).filter((p) => !p.skipped && !drafted.has(p.n)).map(({ n, q }) => ({ n, q }));
}

// Also true when the source note changed since the last enrich drafted from it,
// or a finished item has prequestions without a review item.
export function needsEnrich(item: Item, cards: Card[]): boolean {
  return !item.meta.enriched_at || pendingHighlights(item, cards).length > 0 || pendingNotes(item) !== null || pendingPrequestions(item, cards).length > 0;
}

export interface EnrichResult {
  item: string;
  title: string;
  skipped?: string;
  prequestions: string[];
  skills: string[];
  topics: string[];
  topics_created: string[];
  cards: { id: string; kind: string; content_type: string; question: string; answer: string; rubric: string[]; annotation?: string; from?: "notes" | "prequestion" | "tutor"; prequestion?: number }[];
  ai?: { vendor: string; model: string; prompt_version: string };
  /** What the AI run spent (absent when nothing needed drafting). */
  usage?: Usage;
}

const errorFile = (lib: Library, id: string) => join(paths.logs(lib), `enrich-${id}.error`);

/** Why the last enrich of an item failed, until one succeeds: the reader shows it at once instead of waiting
 *  on a background run that already died. */
export function enrichError(lib: Library, id: string): string | null {
  try {
    return readFileSync(errorFile(lib, id), "utf8").trim() || null;
  } catch {
    return null;
  }
}

const skipFile = (lib: Library, id: string) => join(paths.logs(lib), `enrich-${id}.skipped`);

/** Added with no enrich on its way (`--no-enrich`): the reader doesn't wait for prequestions nothing is
 *  writing, and offers to write them. The next enrich (by hand, or the day's catch-up) clears it. */
export function markEnrichSkipped(lib: Library, id: string): void {
  mkdirSync(paths.logs(lib), { recursive: true });
  writeFileSync(skipFile(lib, id), "");
}
/** What the logs say of each source's last enrich, from one read of the logs folder: `ore ls` asks it of
 *  every source not enriched, and a file check each was one more disk call per source. */
export function enrichLogs(lib: Library): (id: string) => { enrich_error?: string; enrich_skipped?: true } {
  let names: Set<string>;
  try {
    names = new Set(readdirSync(paths.logs(lib)));
  } catch {
    names = new Set();
  }
  return (id) => {
    const why = names.has(`enrich-${id}.error`) ? enrichError(lib, id) : null;
    return why ? { enrich_error: why } : names.has(`enrich-${id}.skipped`) ? { enrich_skipped: true } : {};
  };
}

export async function enrichItem(lib: Library, ref: string): Promise<EnrichResult> {
  const id = findItem(lib, ref).meta.id;
  rmSync(skipFile(lib, id), { force: true });
  try {
    const r = await enrichOnce(lib, id);
    rmSync(errorFile(lib, id), { force: true });
    return r;
  } catch (e) {
    mkdirSync(paths.logs(lib), { recursive: true });
    writeFileSync(errorFile(lib, id), e instanceof Error ? e.message : String(e));
    throw e;
  }
}

async function enrichOnce(lib: Library, ref: string): Promise<EnrichResult> {
  const item = findItem(lib, ref);
  const allCards = listCards(lib);
  const pending = pendingHighlights(item, allCards);
  const notes = pendingNotes(item);
  const preqs = pendingPrequestions(item, allCards);
  const base = { item: item.meta.id, title: item.meta.title, prequestions: (item.meta.prequestions ?? []).map((p) => p.q), skills: item.meta.skills, topics: item.meta.topics, topics_created: [], cards: [] };
  if (item.meta.enriched_at && !pending.length && notes === null && !preqs.length) return { ...base, skipped: "already enriched; no new highlights to plan, note changes or undrafted prequestions" };

  const skills = loadSkills(lib).skills;
  const topics = listTopics(lib);
  const pendingIds = new Set(pending.map((a) => a.id));
  const plain = pending.filter((a) => a.intent === "keep");
  const plainIds = new Set(plain.map((a) => a.id));
  const keyIds = pending.filter((a) => a.intent === "card").map((a) => a.id);
  const preqNs = preqs.map((p) => p.n);
  const questions = item.meta.enriched_at ? [] : openQuestions(lib, item);
  const questionIds = new Set(questions.map((q) => q.id));
  const { data, ai, usage } = await runAgent(lib, {
    prompt: "enrich",
    cwd: lib.root,
    files: [item.docPath],
    schema: EnrichOutput,
    input: {
      item: { id: item.meta.id, title: item.meta.title, type: item.meta.type, url: item.meta.url, author: item.meta.author },
      item_skills: item.meta.skills,
      skills: skills.map((s) => ({ id: s.id, name: s.name, hook: s.hook, goal: s.goal ?? null })),
      existing_topics: topics.map((t) => ({ slug: t.slug, name: t.meta.name, aliases: t.meta.aliases })),
      highlights: pending.map((a) => ({
        annotation: a.id,
        intent: a.intent === "card" ? "key_point" : a.intent === "keep" ? "highlight" : a.intent,
        note: a.note ?? null,
        text: a.exact,
        context: `${a.prefix}[[${a.exact}]]${a.suffix}`,
        answer: a.intent === "question" ? (a.answers ?? []).map((c) => c.text).join("\n") : null,
        point: a.point ?? false,
        reflection: a.intent === "apply" ? reflections(a).join("\n") || null : null,
      })),
      open_questions: questions,
      notes,
      notes_cards: notes === null ? [] : allCards.filter((c) => c.meta.item === item.meta.id && c.meta.from === "notes").map((c) => c.question),
      prequestions_to_draft: preqs,
      skill_cards: skillCards(allCards, item),
      missed: preqs.length || plain.length ? (item.meta.recall?.feedback?.missed ?? []) : [],
      scope: finishScope(item),
    },
    check: (d) => {
      if (notes === null && d.drafts.some((x) => x.from_notes)) return "from_notes drafts are only allowed when `notes` is given";
      if (d.drafts.some((x) => x.from_notes && x.annotation !== null)) return "from_notes drafts must have annotation null";
      const fromPreq = d.drafts.filter((x) => x.prequestion !== null);
      if (fromPreq.some((x) => x.from_notes || x.annotation !== null || x.kind !== "prompt")) return "prequestion drafts must be prompts with annotation null and from_notes false";
      const got = fromPreq.map((x) => x.prequestion!).sort((a, b) => a - b);
      if (got.join() !== preqNs.join()) return `exactly one prompt per number in prequestions_to_draft (${preqNs.join(", ") || "none"}); got ${got.join(", ") || "none"}`;
      const bad = d.drafts.flatMap((x) => (!x.from_notes && x.prequestion === null ? [x.annotation ?? "", ...x.also] : x.also)).filter((id) => !pendingIds.has(id));
      if (bad.length) return `drafts reference unknown highlight ids: ${bad.join(", ")}`;
      const perHighlight = new Map<string, number>();
      for (const x of d.drafts) for (const id of new Set([x.annotation, ...x.also])) if (id) perHighlight.set(id, (perHighlight.get(id) ?? 0) + 1);
      const over = [...perHighlight].filter(([, k]) => k > 2).map(([id]) => id);
      if (over.length) return `at most two drafts per highlight: ${over.join(", ")}`;
      const tries = pending.filter((a) => a.intent === "apply").map((a) => a.id);
      const offTry = tries.filter((id) => d.drafts.filter((x) => x.annotation === id).length !== 1 || d.drafts.some((x) => x.annotation !== id && x.also.includes(id)));
      if (offTry.length) return `exactly one draft per "apply" highlight, as its annotation and never in also: ${offTry.join(", ")}`;
      const uncovered = keyIds.filter((id) => !perHighlight.has(id));
      if (uncovered.length) return `every key point needs a draft (annotation or also): ${uncovered.join(", ")}`;
      const fromPlain = d.drafts.filter((x) => x.annotation && [x.annotation, ...x.also].every((id) => plainIds.has(id))).length;
      if (fromPlain > PLAN_CAP) return `at most ${PLAN_CAP} drafts from plain highlights alone (got ${fromPlain}): merge them into fewer ideas or skip the minor ones`;
      const points = new Set(pending.filter((a) => a.point).map((a) => a.id));
      const ungrounded = d.drafts.filter((x) => x.annotation && points.has(x.annotation) && !anchorEvidence(item.body, x.evidence).length).map((x) => x.annotation);
      if (ungrounded.length) return `drafts for point highlights need evidence: sentences copied exactly from the document (none found for ${ungrounded.join(", ")})`;
      const unreadable = d.drafts.map((x) => cardTextProblem(x)).find(Boolean);
      if (unreadable) return unreadable;
      const prompts = d.drafts.filter((x) => x.kind === "prompt" && (x.rubric.length < 2 || x.rubric.length > 4));
      if (prompts.length) return "every prompt draft needs 2–4 rubric points";
      const strayQ = d.question_matches.filter((m) => !questionIds.has(m.question));
      if (strayQ.length) return `question_matches reference ids not in open_questions: ${strayQ.map((m) => m.question).join(", ")}`;
      const unknown = d.skills.filter((s) => !skills.some((k) => k.id === s));
      if (unknown.length) return `unknown skill ids: ${unknown.join(", ")}`;
      if (!d.skills.length && !d.suggested_skill && !item.meta.skills.length) return "no skills and no suggested_skill: suggest the skill this document belongs to";
      return null;
    },
  });

  // A suggestion that names an existing skill is just that skill.
  const known = data.suggested_skill && matchSkill(skills, data.suggested_skill.name);
  const skillIds = known ? [...new Set([...data.skills, known.id])] : data.skills;
  const suggested = !known && data.suggested_skill ? { name: data.suggested_skill.name, hook: data.suggested_skill.hook || undefined } : undefined;

  return withLock(paths.lock(lib), () => {
    const fresh = findItem(lib, item.meta.id);
    const firstRun = !fresh.meta.enriched_at;
    const created: string[] = [];
    const slugs = data.topics.map((t) => {
      const { topic, created: isNew } = ensureTopic(lib, { slug: slugify(t.slug), name: t.name, status: "active", skills: skillIds, summary: t.summary, ai });
      if (isNew) created.push(topic.slug);
      return topic.slug;
    });
    let meta = fresh.meta;
    if (firstRun) {
      meta = {
        ...meta,
        // Prequestions Tyler has attempted are never regenerated (D18).
        prequestions: hasAttempts(fresh.meta) ? fresh.meta.prequestions : data.prequestions.map((q) => ({ q })),
        skills: [...new Set([...fresh.meta.skills, ...skillIds])],
        suggested_skill: suggested,
        topics: [...new Set([...fresh.meta.topics, ...slugs])],
        enriched_at: nowIso(),
        ai,
      };
      // A match shows only with the sentence that answers it, found in the text: an invented quote is dropped (as D56).
      const found = data.question_matches.flatMap((m) => {
        const span = locate(fresh.body, m.quote);
        return span && !meta.question_matches?.some((x) => x.question === m.question) ? [{ question: m.question, quote: fresh.body.slice(span.start, span.end), start: span.start }] : [];
      });
      if (found.length) meta = { ...meta, question_matches: [...(meta.question_matches ?? []), ...found] };
    }
    if (notes !== null) meta = { ...meta, notes_drafted: sha256(notes) };
    if (plain.length) meta = { ...meta, planned: [...new Set([...(meta.planned ?? []), ...plain.map((a) => a.id)])] };
    if (meta !== fresh.meta) {
      meta = ItemMetaSchema.parse(meta);
      writeAtomic(fresh.docPath, stringifyFrontmatter(meta, fresh.body));
    }
    // Highlights and prequestions drafted by an earlier run are skipped; one run may give a highlight two drafts.
    const existing = listCards(lib);
    const already = new Set(existing.flatMap((c) => (c.meta.annotation ? [c.meta.annotation] : [])));
    const preqOpen = new Set(pendingPrequestions(fresh, existing).map((p) => p.n));
    const points = new Set(pending.filter((a) => a.point).map((a) => a.id));
    const source = (d: EnrichOutput["drafts"][number]) =>
      d.from_notes ? { from: "notes" as const } : d.prequestion !== null ? { from: "prequestion" as const, prequestion: d.prequestion } : { annotation: d.annotation! };
    const cards = data.drafts
      .filter((d) => d.from_notes || (d.prequestion !== null ? preqOpen.has(d.prequestion) : !already.has(d.annotation!)))
      .map((d) => {
        const ts = d.topics.map(slugify).filter((s) => slugs.includes(s) || meta.topics.includes(s));
        return writeNewCard(lib, {
          kind: d.kind, item: meta.id, ...source(d), also: d.from_notes || d.prequestion !== null ? undefined : d.also.filter((id) => id !== d.annotation), skills: meta.skills,
          topics: ts.length ? ts : meta.topics.slice(0, 1), content_type: d.content_type, question: d.question, answer: d.answer,
          rubric: d.kind === "prompt" ? d.rubric : [], ai,
          evidence: d.annotation && points.has(d.annotation) ? anchorEvidence(fresh.body, d.evidence) : undefined,
        });
      });
    return {
      item: meta.id,
      title: meta.title,
      prequestions: (meta.prequestions ?? []).map((p) => p.q),
      skills: meta.skills,
      topics: meta.topics,
      topics_created: created,
      cards: cards.map((c) => ({ id: c.meta.id, kind: c.meta.kind, content_type: c.meta.content_type, question: c.question, answer: c.answer, rubric: c.rubric, annotation: c.meta.annotation, from: c.meta.from, prequestion: c.meta.prequestion })),
      ai,
      usage,
    };
  });
}

export function pendingItems(lib: Library): Item[] {
  const cards = listCards(lib);
  return listItems(lib).filter((i) => needsEnrich(i, cards));
}
