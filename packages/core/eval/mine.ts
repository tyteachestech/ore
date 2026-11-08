// Finds real reviews where Tyler's recorded rating and the grader's proposal fall on different sides
// (right = Good or Easy, wrong = Again or Hard) and prints each as a candidate golden case, labeled by
// his rating. The grader's real misses make the best new cases; read each before adding it, since a
// card may have been edited since. Read-only: `bun run eval:mine` (ORE_LIBRARY picks the library).
import { findCard } from "../src/cards.ts";
import { openLibrary, type Library } from "../src/library.ts";
import { findVariant } from "../src/remix.ts";
import { readReviews } from "../src/reviews.ts";
import { verdict, type Case } from "./grade.ts";

export function disagreements(lib: Library): Case[] {
  const out: Case[] = [];
  for (const r of readReviews(lib)) {
    if (r.ai_rating === undefined || !r.answer?.trim() || r.in_head || verdict(r.ai_rating) === verdict(r.rating)) continue;
    let shown: Pick<Case, "kind" | "question" | "model_answer" | "rubric">;
    try {
      const card = findCard(lib, r.card);
      const v = r.variant ? findVariant(lib, card.meta.id, r.variant) : null;
      shown = v ? { kind: "prompt", question: v.question, model_answer: v.answer, rubric: v.rubric }
        : { kind: card.meta.kind, question: card.question, model_answer: card.answer, rubric: card.rubric };
    } catch { continue; } // the card or its variant is gone
    out.push({
      id: `real-${r.card.slice(-6).toLowerCase()}-${r.ts.slice(0, 10)}`, level: "tricky", ...shown, answer: r.answer,
      label: verdict(r.rating), why: `From review ${r.ts}: the grader proposed ${r.ai_rating}, Tyler recorded ${r.rating}.`,
    });
  }
  return out;
}

if (import.meta.main) {
  const found = disagreements(openLibrary());
  console.error(`${found.length} review${found.length === 1 ? "" : "s"} where Tyler and the grader disagreed.`);
  console.log(JSON.stringify(found, null, 2));
}
