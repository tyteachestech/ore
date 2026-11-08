import { z } from "zod";
import { findCard } from "../cards.ts";
import type { Library } from "../library.ts";
import { findVariant } from "../remix.ts";
import { runAgent } from "./adapter.ts";

export const GradeOutput = z.strictObject({
  rating: z.number().int().min(1).max(4),
  gaps: z.array(z.string()),
  feedback: z.string(),
  covered: z.array(z.boolean()), // one per rubric point, in order (D59); empty without a rubric
});

/** What the grader sees of a card: the question, its model answer and rubric. */
export interface Shown { kind: string; question: string; model_answer: string; rubric: string[] }

/** One grading run on what the card shows (the eval calls this with its golden cards). */
export function gradeShown(lib: Library, shown: Shown, answer: string) {
  return runAgent(lib, {
    prompt: "grade",
    cwd: lib.root,
    schema: GradeOutput,
    input: { ...shown, answer },
    check: (d) => (d.covered.length === shown.rubric.length ? null : `covered needs exactly ${shown.rubric.length} entries, one per rubric point`),
  });
}

/** What the grader is shown for a card, or for the variant he was shown (D66): its key points. */
export function shownFor(lib: Library, cardRef: string, variantRef?: string): Shown & { card: string } {
  const card = findCard(lib, cardRef);
  const v = variantRef ? findVariant(lib, card.meta.id, variantRef) : null;
  return v ? { card: card.meta.id, kind: "prompt", question: v.question, model_answer: v.answer, rubric: v.rubric }
    : { card: card.meta.id, kind: card.meta.kind, question: card.question, model_answer: card.answer, rubric: card.rubric };
}

// Proposes a rating; never logs it (D21).
export async function gradeAnswer(lib: Library, cardRef: string, answer: string, variantRef?: string) {
  const { card, ...shown } = shownFor(lib, cardRef, variantRef);
  const { data, ai } = await gradeShown(lib, shown, answer);
  return { card, ...data, ai };
}
