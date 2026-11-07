import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { appendJsonl, deviceLog, latestRevs, logFiles, readLog, sha256 } from "./fsutil.ts";
import { nowIso, ulid } from "./ids.ts";
import { findItem, itemDirs, listItems, updateItemMeta, type Item } from "./items.ts";
import type { Library } from "./library.ts";
import { anchor, locate, quoteSelector, type Anchor } from "./anchoring.ts";

export const Intent = z.enum(["keep", "card", "question", "apply"]);
export type Intent = z.infer<typeof Intent>;

// deleted: a removed highlight. Hidden from reads, index, anchoring and drafting.
export const AnnotationStatus = z.enum(["open", "done", "deleted"]);
export type AnnotationStatus = z.infer<typeof AnnotationStatus>;

// A piece of his answer to a question (D75), in his words; `item` is the source he wrote it from
// (the link between a question and its sources), `quote` the passage he had selected there.
export const Contribution = z.object({ ts: z.string(), text: z.string().min(1), item: z.string().optional(), quote: z.string().optional() });
export type Contribution = z.infer<typeof Contribution>;

export const AnnotationSchema = z.object({
  id: z.string(),
  rev: z.number().int().positive(),
  item: z.string(),
  ts: z.string(),
  intent: z.preprocess(fromResearch, Intent),
  exact: z.string(),
  prefix: z.string(),
  suffix: z.string(),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
  note: z.string().optional(),
  status: AnnotationStatus,
  answers: z.array(Contribution).optional(), // Question intent only (D75)
  card: z.boolean().optional(), // Question intent: "Answered + card", so enrich drafts a card from his answer
  reflection: z.string().optional(), // Apply intent (D127): how it went, written when he checked it off
  // A card or question he typed with nothing selected ("Card here"): `exact` is only the sentence where he
  // was; the note is what counts, and a card is drafted from it and the whole source, with quotes.
  point: z.boolean().optional(),
});
export type Annotation = z.infer<typeof AnnotationSchema>;

// D91: Research folded into Question (research starts from a question). Logs are append-only and
// shared across devices, so older "research" revisions are read as questions rather than rewritten.
function fromResearch(intent: unknown) {
  return intent === "research" ? "question" : intent;
}

/** A source's highlight log, read across devices (`annotations.jsonl` and `annotations.<device>.jsonl`). */
export const annotationsPath = (dir: string) => join(dir, "annotations.jsonl");
/** Every revision of every highlight in the source folder `dir`, deleted ones included. */
export const annotationRevs = (dir: string): Annotation[] =>
  readLog<Annotation>(annotationsPath(dir))
    // Every line was written through the schema; one that no longer fits (a hand edit) is skipped, not fatal.
    .filter((a) => AnnotationSchema.safeParse(a).success)
    .map((a) => ({ ...a, intent: fromResearch(a.intent) as Intent }));
const append = (item: Item, a: Annotation) => appendJsonl(deviceLog(annotationsPath(item.dir)), AnnotationSchema.parse(a));

// Latest rev of each live annotation (deleted ones omitted).
export function readAnnotations(item: Item): Annotation[] {
  return latestRevs(annotationRevs(item.dir)).filter((a) => a.status !== "deleted").sort((a, b) => a.start - b.start);
}

export interface HighlightInput {
  exact: string;
  intent: Intent;
  note?: string;
  start?: number;
}

// Locate the passage in the body (exact, then whitespace-insensitive; nearest
// to `start` when it occurs more than once) and append a new annotation. Selecting a passage that is
// already highlighted, exactly, gives back that highlight. Selecting past the edge of one highlight
// gives back that one, grown to cover both, instead of a second on top of it (Readwise Reader). A
// passage inside a bigger highlight (a snippet's whole text) is its own; over two, no note is merged away.
export function addHighlight(item: Item, input: HighlightInput): Annotation {
  const span = locate(item.body, input.exact, input.start);
  if (!span) throw new Error(`text not found in item ${item.meta.id}: "${input.exact.slice(0, 60)}"`);
  const live = readAnnotations(item).filter((a) => !a.point);
  const same = live.find((a) => a.start === span.start && a.end === span.end);
  if (same) return same;
  const edge = live.filter((a) => a.start < span.end && a.end > span.start && !(a.start <= span.start && a.end >= span.end));
  if (edge.length === 1) {
    const a = edge[0]!;
    return reviseAnnotation(item, a, quoteSelector(item.body, Math.min(a.start, span.start), Math.max(a.end, span.end)));
  }
  const ann: Annotation = {
    id: ulid(),
    rev: 1,
    item: item.meta.id,
    ts: nowIso(),
    intent: input.intent,
    ...quoteSelector(item.body, span.start, span.end),
    note: input.note?.trim() || undefined,
    status: "open",
  };
  append(item, ann);
  return ann;
}

/** The sentence of `body` around offset `at`: a "Card here" anchors to it (`point`), so it sits where he was. */
export function sentenceAt(body: string, at: number): { start: number; end: number } {
  const i = Math.max(0, Math.min(at, body.length - 1));
  let start = i;
  while (start > 0 && !/[\n]/.test(body[start - 1]!) && !(/[.!?]/.test(body[start - 2] ?? "") && body[start - 1] === " ")) start--;
  let end = i;
  while (end < body.length && body[end] !== "\n" && !(/[.!?]/.test(body[end]!) && /\s|$/.test(body[end + 1] ?? ""))) end++;
  if (end < body.length && body[end] !== "\n") end++;
  // A transcript paragraph opens with its [mm:ss]; the anchor is the words, not the stamp.
  const lead = /^\[\d+(?::\d+){1,2}\]\s*/.exec(body.slice(start, end));
  if (lead) start += lead[0].length;
  return { start, end: Math.max(end, start + 1) };
}

/** "Card here" (or a question typed with nothing selected): his line, anchored at the sentence around `at`. */
export function addPoint(item: Item, input: { at: number; note: string; intent: "card" | "question" }): Annotation {
  const note = input.note.trim();
  if (!note) throw new Error("a card from a line needs the line (--note)");
  const span = sentenceAt(item.body, input.at);
  const ann: Annotation = {
    id: ulid(), rev: 1, item: item.meta.id, ts: nowIso(), intent: input.intent,
    ...quoteSelector(item.body, span.start, span.end),
    note, status: "open", point: true,
  };
  append(item, ann);
  return ann;
}

export function findAnnotation(lib: Library, ref: string): { item: Item; annotation: Annotation } {
  const key = ref.toUpperCase();
  const hits: { dir: string; annotation: Annotation }[] = [];
  for (const dir of itemDirs(lib)) {
    const files = logFiles(annotationsPath(dir));
    if (!files.some((f) => readFileSync(f, "utf8").includes(key.slice(0, 8)))) continue;
    const anns = latestRevs(annotationRevs(dir));
    for (const a of anns) if (a.id === key || a.id.startsWith(key) || a.id.endsWith(key)) hits.push({ dir, annotation: a });
  }
  if (hits.length === 0) throw new Error(`no annotation matches "${ref}"`);
  if (hits.length > 1) throw new Error(`"${ref}" matches ${hits.length} annotations; use more of the id`);
  const hit = hits[0]!;
  return { item: findItem(lib, hit.dir.slice(-26)), annotation: hit.annotation };
}

/** A snippet that only carries a question (typed on a skill page, or captured with Question intent):
 *  nothing to read, so it lives under Questions and stays out of the source lists, also once the
 *  question is deleted (else it would turn up under To read). */
export function isQuestionOnly(item: Item): boolean {
  if (item.meta.type !== "snippet") return false;
  const all = latestRevs(annotationRevs(item.dir));
  return all.length > 0 && all.every((a) => a.intent === "question");
}

export type AnnotationPatch = Partial<Pick<Annotation, "note" | "intent" | "status" | "exact" | "prefix" | "suffix" | "start" | "end" | "answers" | "card" | "reflection">>;

// Edits never rewrite history: they append the same id with rev + 1.
export function reviseAnnotation(item: Item, current: Annotation, patch: AnnotationPatch): Annotation {
  const next = AnnotationSchema.parse({ ...current, ...patch, rev: current.rev + 1, ts: nowIso() });
  append(item, next);
  return next;
}

/** A highlight's passage moved (its edges dragged): `exact` located nearest `start`, as a new highlight is. */
export function moveHighlight(item: Item, current: Annotation, exact: string, start?: number): Annotation {
  if (current.point) throw new Error("a card typed with nothing selected has no passage to move");
  const span = locate(item.body, exact, start);
  if (!span) throw new Error(`text not found in item ${item.meta.id}: "${exact.slice(0, 60)}"`);
  if (span.start === current.start && span.end === current.end) return current;
  return reviseAnnotation(item, current, quoteSelector(item.body, span.start, span.end));
}

export interface AnchoredAnnotation extends Annotation {
  anchor: Anchor | null;
}

// Re-anchor every annotation against the current body. Cheap when the body
// hash is unchanged (position check succeeds).
export function anchorAnnotations(item: Item): AnchoredAnnotation[] {
  return readAnnotations(item).map((a) => ({ ...a, anchor: anchor(item.body, a) }));
}

export interface ReanchorReport {
  item: string;
  hashChanged: boolean;
  moved: { id: string; method: Anchor["method"] }[];
  orphaned: string[];
}

// After doc.md body edits: re-anchor annotations, append a new rev for each
// one that moved (fresh quote + position selectors), and record the new
// body hash. Orphans are kept untouched and reported.
export async function reanchorItem(lib: Library, item: Item): Promise<ReanchorReport> {
  const report: ReanchorReport = { item: item.meta.id, hashChanged: sha256(item.body) !== item.meta.text_sha256, moved: [], orphaned: [] };
  if (!report.hashChanged) return report;
  for (const a of anchorAnnotations(item)) {
    if (!a.anchor) report.orphaned.push(a.id);
    else if (a.anchor.method !== "position") {
      const { anchor: found, ...current } = a;
      reviseAnnotation(item, current, quoteSelector(item.body, found.start, found.end));
      report.moved.push({ id: a.id, method: found.method });
    }
  }
  await updateItemMeta(lib, item.meta.id, (m) => ({ ...m, text_sha256: sha256(item.body) }));
  return report;
}
