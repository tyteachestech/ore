import { describe, expect, test } from "bun:test";
import type { z } from "zod";
import { vendorSchema } from "../src/ai/adapter.ts";
import { AskLibraryOutput } from "../src/ai/ask.ts";
import { ChatOutput } from "../src/ai/chat.ts";
import { CheckOutput, KeyPointsOutput } from "../src/ai/check.ts";
import { EnrichOutput } from "../src/ai/enrich.ts";
import { ExplainOutput } from "../src/ai/explain.ts";
import { GradeOutput } from "../src/ai/grade.ts";
import { RecallFeedbackOutput } from "../src/ai/recall.ts";
import { ResearchOutput } from "../src/ai/research.ts";
import { TutorOutput } from "../src/ai/tutor.ts";

const SCHEMAS: Record<string, z.ZodType> = { AskLibraryOutput, ChatOutput, CheckOutput, EnrichOutput, ExplainOutput, GradeOutput, KeyPointsOutput, RecallFeedbackOutput, ResearchOutput, TutorOutput };

/** Every object in a JSON Schema whose properties aren't all required, or that allows other keys. */
function loose(v: unknown, at: string, out: string[] = []): string[] {
  if (Array.isArray(v)) v.forEach((x, i) => loose(x, `${at}[${i}]`, out));
  else if (v && typeof v === "object") {
    const o = v as { properties?: object; required?: string[]; additionalProperties?: unknown };
    if (o.properties) {
      for (const k of Object.keys(o.properties)) if (!o.required?.includes(k)) out.push(`${at}.${k} is not required`);
      if (o.additionalProperties !== false) out.push(`${at} allows other keys`);
    }
    for (const [k, x] of Object.entries(v)) loose(x, `${at}/${k}`, out);
  }
  return out;
}

// codex exec --output-schema sends the schema in OpenAI's strict mode, which refuses one with a key left
// out of `required` (every reply failed for a Codex user). A field that may be absent is `.nullable()`
// or has a `.default()`, never `.optional()`.
describe("AI output schemas", () => {
  for (const [name, schema] of Object.entries(SCHEMAS))
    test(`${name} is strict: every key required, no others`, () => expect(loose(vendorSchema(schema), name)).toEqual([]));
});
