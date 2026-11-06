import { z } from "zod";
import { locate } from "../anchoring.ts";
import { findItem } from "../items.ts";
import type { Library } from "../library.ts";
import { runAgent } from "./adapter.ts";

export const ExplainOutput = z.strictObject({
  here: z.string().min(1),
  general: z.string().min(1),
});

/** The paragraph of `body` around offset `at`, trimmed to a readable length, as context for the AI. */
export function paragraphAt(body: string, at: number, max = 1200): string {
  const from = body.lastIndexOf("\n\n", at);
  const to = body.indexOf("\n\n", at);
  const p = body.slice(from < 0 ? 0 : from + 2, to < 0 ? body.length : to).trim();
  if (p.length <= max) return p;
  const local = Math.max(0, at - (from < 0 ? 0 : from + 2));
  const start = Math.max(0, Math.min(local - max / 2, p.length - max));
  return `…${p.slice(start, start + max).trim()}…`;
}

/** Explain (side quests): a term he doesn't know, in this paragraph and in general, so he can keep
 *  reading. Reading support, like the dictionary: nothing is written, and it is never his answer (D75). */
export async function explainTerm(lib: Library, ref: string, term: string, start?: number) {
  const item = findItem(lib, ref);
  const t = term.replace(/\s+/g, " ").trim();
  if (!t) throw new Error("nothing to explain");
  const at = locate(item.body, t, start ?? 0)?.start ?? start ?? 0;
  const { data, ai } = await runAgent(lib, {
    prompt: "explain",
    cwd: lib.root,
    schema: ExplainOutput,
    input: { term: t, paragraph: paragraphAt(item.body, at), source: item.meta.title },
  });
  return { ...data, ai };
}
