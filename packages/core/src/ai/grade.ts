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

// Proposes a rating; never logs it (D21). With a variant (D66), grades against its key points.
export async function gradeAnswer(lib: Library, cardRef: string, answer: string, variantRef?: string) {
  const card = findCard(lib, cardRef);
  const v = variantRef ? findVariant(lib, card.meta.id, variantRef) : null;
  const shown = v ? { kind: "prompt", question: v.question, model_answer: v.answer, rubric: v.rubric } : { kind: card.meta.kind, question: card.question, model_answer: card.answer, rubric: card.rubric };
  const { data, ai } = await runAgent(lib, {
    prompt: "grade",
    cwd: lib.root,
    schema: GradeOutput,
    input: { ...shown, answer },
    check: (d) => (d.covered.length === shown.rubric.length ? null : `covered needs exactly ${shown.rubric.length} entries, one per rubric point`),
  });
  return { card: card.meta.id, ...data, ai };
}
