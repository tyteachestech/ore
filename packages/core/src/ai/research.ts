import { z } from "zod";
import { findAnnotation } from "../annotations.ts";
import type { Library } from "../library.ts";
import { runAgent } from "./adapter.ts";
import { paragraphAt } from "./explain.ts";

export const ResearchOutput = z.strictObject({
  sources: z
    .array(
      z.strictObject({
        title: z.string().min(1),
        url: z.string().regex(/^https?:\/\//).refine((u) => URL.canParse(u), "not a link"),
        site: z.string(),
        type: z.string(),
        why: z.string().min(1),
        minutes: z.number().positive().nullable().default(null),
      }),
    )
    .min(3)
    .max(5),
});
// D17, D75: a question → 3–5 sources, returned for him to pick from; nothing is ingested or written.
export async function research(lib: Library, ref: string) {
  const { item, annotation } = findAnnotation(lib, ref);
  const { data, ai } = await runAgent(lib, {
    prompt: "research",
    cwd: lib.root,
    web: true,
    schema: ResearchOutput,
    input: {
      question: { text: annotation.exact, note: annotation.note ?? null, paragraph: paragraphAt(item.body, annotation.start), from: { title: item.meta.title, url: item.meta.url ?? null } },
    },
  });
  return { sources: data.sources, ai };
}
