import { z } from "zod";
import { findAnnotation } from "./annotations.ts";
import { findCard, rubricProblem, type Card } from "./cards.ts";
import { appendJsonl, latestRevs, readJsonl } from "./fsutil.ts";
import { nowIso, ulid } from "./ids.ts";
import { AiStamp } from "./items.ts";
import { paths, type Library } from "./library.ts";
import { withLock } from "./lock.ts";
import { readReviews, type Review } from "./reviews.ts";
import { loadSkills, reviewSettings } from "./skills.ts";
import { runAgent } from "./ai/adapter.ts";

// Card remixing (D66): once he knows a card, it comes back as a variant that asks him to use the
// same idea on a case he hasn't seen. One card, one FSRS schedule; variants change how it is
// asked, never when.

export const VariantType = z.enum(["new-case", "predict", "diagnose", "choose", "name-it"]);
export type VariantType = z.infer<typeof VariantType>;

export const VariantSchema = z.object({
  id: z.string(),
  rev: z.number().int().positive(),
  card: z.string(),
  type: VariantType,
  setting: z.string(), // the scenario's setting in a few words, so the next one picks another
  question: z.string(),
  answer: z.string(),
  rubric: z.array(z.string()),
  maps: z.array(z.number().int().nonnegative()), // per rubric point, the original point it tests
  status: z.enum(["ready", "rejected"]),
  reason: z.string().optional(), // why it was rejected (the checker, or B in review)
  created: z.string(),
  ai: AiStamp,
  check_ai: AiStamp.optional(),
});
export type Variant = z.infer<typeof VariantSchema>;

/** Each variant is shown at most this often; after that it is as familiar as the original. */
export const VARIANT_USES = 2;
/** Ready variants kept ahead of review. */
const AHEAD = 2;

const isCloze = (c: Card) => /\{\{c\d+::/.test(c.question);

/** The variant types a card can take: none for facts and cloze cards, which stay as written. */
export function remixTypes(c: Card): VariantType[] {
  if (isCloze(c)) return [];
  switch (c.meta.content_type) {
    case "definition": return ["name-it"];
    case "concept": return ["new-case", "predict", "diagnose", "choose"];
    case "procedure": return ["new-case"];
    default: return [];
  }
}

/** What a variant may test: the card's key points, or its answer when it has none. */
export const originalPoints = (c: Card) => (c.rubric.length ? c.rubric : [c.answer]);

export function readVariants(lib: Library, cardId: string): Variant[] {
  return latestRevs(readJsonl<Variant>(paths.variants(lib, cardId)).filter((v) => VariantSchema.safeParse(v).success));
}

const usesOf = (id: string, reviews: Review[]) => reviews.filter((r) => r.variant === id).length;

/** His last two reviews of the original since its last miss were Good or Easy. `reviews` are this
 *  card's, oldest first. */
export function passedTwice(reviews: Review[]): boolean {
  const miss = reviews.findLastIndex((r) => r.rating === 1);
  const orig = reviews.slice(miss + 1).filter((r) => !r.variant);
  return orig.length >= 2 && orig.slice(-2).every((r) => r.rating >= 3);
}

/** A card in review (passing twice means it is past its draft) he has passed twice on the original since its last miss (D66). */
export function remixable(c: Card, reviews: Review[]): boolean {
  return c.meta.state !== "retired" && remixTypes(c).length > 0 && passedTwice(reviews);
}

/** An Explain card he may answer in his head (D68): passed twice on the original since its last
 *  miss, so new and missed cards stay typed. Variants are always typed. */
export function inHeadOk(lib: Library, c: Card): boolean {
  return c.meta.kind === "prompt" && c.meta.state !== "retired" && passedTwice(readReviews(lib).filter((r) => r.card === c.meta.id));
}

/** The version to show next: variant, variant, original once remixable; null for the original. A
 *  variant is never shown twice in a row or more than VARIANT_USES times, and the ask changes from
 *  the last variant shown when another type is ready. */
export function pickVariant(c: Card, reviews: Review[], variants: Variant[]): Variant | null {
  if (!remixable(c, reviews)) return null;
  const lastTwo = reviews.slice(-2);
  if (lastTwo.length === 2 && lastTwo.every((r) => r.variant)) return null;
  const lastId = reviews.findLast((r) => r.variant)?.variant;
  const lastType = variants.find((v) => v.id === lastId)?.type;
  const usable = variants.filter((v) => v.status === "ready" && v.id !== lastId && usesOf(v.id, reviews) < VARIANT_USES);
  usable.sort((a, b) => Number(a.type === lastType) - Number(b.type === lastType) || usesOf(a.id, reviews) - usesOf(b.id, reviews) || a.created.localeCompare(b.created));
  return usable[0] ?? null;
}

/** How many more variants to write ahead for this card: none until it is remixable. */
export function variantsNeeded(c: Card, reviews: Review[], variants: Variant[]): number {
  if (!remixable(c, reviews)) return 0;
  const ready = variants.filter((v) => v.status === "ready" && usesOf(v.id, reviews) < VARIANT_USES).length;
  return Math.max(0, AHEAD - ready);
}

/** The version of a card to review now (D66): a variant when remixing is on and one is due its turn. */
export function reviewVersion(lib: Library, c: Card): Variant | null {
  if (!reviewSettings(lib).remix) return null;
  return pickVariant(c, readReviews(lib).filter((r) => r.card === c.meta.id), readVariants(lib, c.meta.id));
}

/** Cards whose variants should be written now. */
export function cardsToRemix(lib: Library, cards: Card[]): string[] {
  if (!reviewSettings(lib).remix) return [];
  const reviews = readReviews(lib);
  return cards.filter((c) => variantsNeeded(c, reviews.filter((r) => r.card === c.meta.id), readVariants(lib, c.meta.id)) > 0).map((c) => c.meta.id);
}

const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
const runs = (s: string, n: number) => {
  const w = words(s);
  return new Set(w.slice(0, Math.max(0, w.length - n + 1)).map((_, i) => w.slice(i, i + n).join(" ")));
};

/** A run of 5 or more words the variant's question shares with the original question or answer,
 *  or null. Catches the commonest failure: the original sentence with a new first line. */
export function sharedRun(question: string, original: { question: string; answer: string }, n = 5): string | null {
  const theirs = new Set([...runs(original.question, n), ...runs(original.answer, n)]);
  for (const r of runs(question, n)) if (theirs.has(r)) return r;
  return null;
}

const WriterOutput = z.strictObject({
  type: VariantType,
  setting: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
  points: z.array(z.strictObject({ text: z.string().min(1), tests: z.number().int() })),
});
type WriterOutput = z.infer<typeof WriterOutput>;

const CheckOutput = z.strictObject({
  in_scope: z.boolean(),
  answerable: z.boolean(),
  same_claim: z.boolean(),
  gives_away: z.boolean(),
  reason: z.string(),
});

/** The plain checks in code (no AI): an allowed type, 2–4 key points that each map to a real
 *  original point, a new setting, and no shared 5-word run with the original. */
export function variantProblem(c: Card, v: WriterOutput, earlier: Pick<Variant, "type" | "setting">[], avoidType?: VariantType): string | null {
  const types = remixTypes(c);
  if (!types.includes(v.type)) return `type must be one of ${types.join(", ")}`;
  if (avoidType && types.length > 1 && v.type === avoidType) return `type must differ from the last one (${avoidType})`;
  if (v.points.length < 2 || v.points.length > 4) return "give 2 to 4 key points";
  const n = originalPoints(c).length;
  const bad = v.points.find((p) => p.tests < 0 || p.tests >= n);
  if (bad) return `each point's "tests" must be an original point index from 0 to ${n - 1}`;
  if (earlier.some((e) => e.setting.trim().toLowerCase() === v.setting.trim().toLowerCase())) return "use a setting no earlier variant used";
  const run = sharedRun(v.question, c);
  if (run) return `the question repeats "${run}" from the original; write it fresh`;
  return null;
}

/** Write variants ahead for one card (D66) until it has enough ready, in the background. Each is
 *  checked in code, then by a separate AI call; a rejected one is kept with its reason so the
 *  writer sees it next time. Never writes a card. */
export async function remixCard(lib: Library, ref: string): Promise<{ card: string; written: Variant[]; rejected: number; dropped: string[] }> {
  const card = findCard(lib, ref);
  const id = card.meta.id;
  const reviews = () => readReviews(lib).filter((r) => r.card === id);
  const out = { card: id, written: [] as Variant[], rejected: 0, dropped: [] as string[] };
  let passage: { text: string; note?: string } | undefined;
  if (card.meta.annotation) {
    try {
      const { annotation } = findAnnotation(lib, card.meta.annotation);
      passage = { text: annotation.exact, note: annotation.note?.trim() || undefined };
    } catch {
      // the highlight is gone; the card alone bounds the variant
    }
  }
  const skills = loadSkills(lib).skills.filter((s) => card.meta.skills.includes(s.id)).map((s) => ({ name: s.name, hook: s.hook }));
  const points = originalPoints(card);
  const original = { kind: card.meta.kind, content_type: card.meta.content_type, question: card.question, answer: card.answer, points };

  for (let guard = 0; guard < AHEAD + 2 && variantsNeeded(card, reviews(), readVariants(lib, id)) > 0; guard++) {
    const earlier = readVariants(lib, id);
    const shown = reviews().findLast((r) => r.variant)?.variant;
    const last = earlier.find((v) => v.id === shown) ?? earlier.filter((v) => v.status === "ready").at(-1);
    let written;
    try {
      written = await runAgent(lib, {
        prompt: "variant",
        cwd: lib.root,
        schema: WriterOutput,
        input: {
          original,
          passage,
          skills,
          allowed_types: remixTypes(card),
          avoid_type: remixTypes(card).length > 1 ? last?.type : undefined,
          earlier: earlier.map((v) => ({ type: v.type, setting: v.setting, question: v.question, status: v.status, reason: v.reason })),
        },
        check: (d) => variantProblem(card, d, earlier, remixTypes(card).length > 1 ? last?.type : undefined),
      });
    } catch (e) {
      out.dropped.push((e as Error).message);
      break;
    }
    const v = written.data;
    let checked;
    try {
      checked = await runAgent(lib, {
        prompt: "variant-check",
        cwd: lib.root,
        schema: CheckOutput,
        input: { original, passage, variant: { type: v.type, question: v.question, answer: v.answer, points: v.points.map((p) => ({ text: p.text, tests: points[p.tests] })) } },
      });
    } catch (e) {
      out.dropped.push((e as Error).message);
      break;
    }
    const ok = checked.data.in_scope && checked.data.answerable && checked.data.same_claim && !checked.data.gives_away;
    const record: Variant = {
      id: ulid(),
      rev: 1,
      card: id,
      type: v.type,
      setting: v.setting.trim(),
      question: v.question.trim(),
      answer: v.answer.trim(),
      rubric: v.points.map((p) => p.text.trim()),
      maps: v.points.map((p) => p.tests),
      status: ok ? "ready" : "rejected",
      reason: ok ? undefined : checked.data.reason || "failed the check",
      created: nowIso(),
      ai: written.ai,
      check_ai: checked.ai,
    };
    // Two runs for one card can overlap; the second keeps only what is still needed.
    const kept = await withLock(paths.lock(lib), () => {
      if (ok && variantsNeeded(card, reviews(), readVariants(lib, id)) === 0) return false;
      appendJsonl(paths.variants(lib, id), VariantSchema.parse(record));
      return true;
    });
    if (!kept) break;
    if (ok) out.written.push(record);
    else out.rejected++;
  }
  return out;
}

export function findVariant(lib: Library, cardRef: string, variantRef: string): Variant {
  const id = findCard(lib, cardRef).meta.id;
  const key = variantRef.toUpperCase();
  const v = readVariants(lib, id).find((x) => x.id === key || x.id.endsWith(key));
  if (!v) throw new Error(`card ${id} has no variant "${variantRef}"`);
  return v;
}

/** B in review, "Bad version" (D66): drops the variant; the reason goes to the writer next time. */
export async function rejectVariant(lib: Library, cardRef: string, variantRef: string, reason = "Tyler marked it a bad version in review"): Promise<Variant> {
  return withLock(paths.lock(lib), () => {
    const v = findVariant(lib, cardRef, variantRef);
    const next = { ...v, rev: v.rev + 1, status: "rejected" as const, reason };
    appendJsonl(paths.variants(lib, v.card), VariantSchema.parse(next));
    return next;
  });
}

/** Undo for B: the variant is ready again. */
export async function restoreVariant(lib: Library, cardRef: string, variantRef: string): Promise<Variant> {
  return withLock(paths.lock(lib), () => {
    const v = findVariant(lib, cardRef, variantRef);
    const next = { ...v, rev: v.rev + 1, status: "ready" as const, reason: undefined };
    appendJsonl(paths.variants(lib, v.card), VariantSchema.parse(next));
    return next;
  });
}

/** E in review on a variant edits the variant, not the original (D66). */
export async function setVariant(lib: Library, cardRef: string, variantRef: string, edit: { question?: string; answer?: string; rubric?: string[] }): Promise<Variant> {
  return withLock(paths.lock(lib), () => {
    const v = findVariant(lib, cardRef, variantRef);
    if (edit.rubric) {
      const problem = rubricProblem("prompt", edit.rubric);
      if (problem) throw new Error(problem);
      // Each point stands for one of the original's (maps): reword them, don't add or drop one.
      if (edit.rubric.length !== v.rubric.length) throw new Error(`This version keeps its ${v.rubric.length} key points: reword them, or drop the version for the original.`);
    }
    const next = { ...v, rev: v.rev + 1, question: edit.question?.trim() || v.question, answer: edit.answer?.trim() || v.answer, rubric: edit.rubric?.map((p) => p.trim()) ?? v.rubric };
    appendJsonl(paths.variants(lib, v.card), VariantSchema.parse(next));
    return next;
  });
}

/** For us, never shown to him (D66): pass rates (Good or Easy) on variants vs the original, over
 *  cards that have been remixed, counting original reviews from the first variant on. A variant
 *  rate well below the original's means the variants drift and the prompts need fixing. */
export function remixStats(lib: Library) {
  const byCard = new Map<string, Review[]>();
  for (const r of readReviews(lib)) byCard.set(r.card, [...(byCard.get(r.card) ?? []), r]);
  const v = { reviews: 0, passed: 0 }, o = { reviews: 0, passed: 0 };
  for (const rs of byCard.values()) {
    const first = rs.findIndex((r) => r.variant);
    if (first === -1) continue;
    for (const r of rs.slice(first)) {
      const g = r.variant ? v : o;
      g.reviews++;
      if (r.rating >= 3) g.passed++;
    }
  }
  const rate = (g: typeof v) => ({ reviews: g.reviews, pass_rate: g.reviews ? g.passed / g.reviews : null });
  return { variant: rate(v), original: rate(o) };
}
