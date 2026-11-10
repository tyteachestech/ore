import { z } from "zod";
import { findAnnotation } from "../annotations.ts";
import { findCard } from "../cards.ts";
import type { Library } from "../library.ts";
import { findVariant } from "../remix.ts";
import { parseOutput, runChatTurn, vendorSchema } from "./adapter.ts";
import { loadPrompt } from "./prompts.ts";

export const ChatOutput = z.strictObject({
  reply: z.string().min(1),
  card: z.strictObject({ question: z.string().min(1), answer: z.string().min(1) }).nullable(),
});

/** One message in "Ask about this" (D61), after he has answered the card (D34.3). The first turn
 *  sends the card, his answer and the passage; later turns pass `session` and only his message.
 *  A proposed card is returned for him to apply (`ore card set`); nothing is written here, and no
 *  rating is suggested (D21). */
// On a variant (D66) the chat sees the variant he answered and the original, so "why is this the
// same idea?" has an answer.
export async function askAboutCard(lib: Library, cardRef: string, a: { message: string; answer?: string; session?: string; variant?: string }) {
  if (!a.message.trim()) throw new Error("message is empty");
  const card = findCard(lib, cardRef);
  const prompt = loadPrompt("chat");
  let message = a.message.trim();
  if (!a.session) {
    let passage: { source: string; text: string } | undefined;
    if (card.meta.annotation) {
      try {
        const { item, annotation } = findAnnotation(lib, card.meta.annotation);
        passage = { source: item.meta.title, text: annotation.exact };
      } catch {
        // the highlight is gone; the chat still has the card
      }
    }
    const v = a.variant ? findVariant(lib, card.meta.id, a.variant) : null;
    const shown = v ? { question: v.question, model_answer: v.answer, rubric: v.rubric } : { question: card.question, model_answer: card.answer, rubric: card.rubric };
    const original = v ? { original: { question: card.question, model_answer: card.answer, rubric: card.rubric, note: "He answered a new version of this exercise that tests the same idea in a new case." } } : {};
    const context = { ...shown, his_answer: a.answer?.trim() || "(no idea)", passage, ...original };
    message = `Exercise (JSON):\n${JSON.stringify(context, null, 2)}\n\nHis message:\n${message}`;
  }
  const r = await runChatTurn(lib, { system: prompt.text, message, schema: vendorSchema(ChatOutput), session: a.session, cwd: lib.root });
  const out = ChatOutput.parse(parseOutput(r.output));
  return { card: card.meta.id, reply: out.reply, proposal: out.card, session: r.session, ai: { vendor: r.vendor, model: r.model, prompt_version: prompt.version } };
}
