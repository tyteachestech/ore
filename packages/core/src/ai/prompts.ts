import { parseFrontmatter } from "../frontmatter.ts";
// Imported as text so the bundled `ore` (one compiled file in the app) carries them.
import enrich from "./prompts/enrich.md" with { type: "text" };
import grade from "./prompts/grade.md" with { type: "text" };
import research from "./prompts/research.md" with { type: "text" };
import explain from "./prompts/explain.md" with { type: "text" };
import recallFeedback from "./prompts/recall-feedback.md" with { type: "text" };
import keyPoints from "./prompts/key-points.md" with { type: "text" };
import check from "./prompts/check.md" with { type: "text" };
import chat from "./prompts/chat.md" with { type: "text" };
import variant from "./prompts/variant.md" with { type: "text" };
import variantCheck from "./prompts/variant-check.md" with { type: "text" };
import leaveOut from "./prompts/leave-out.md" with { type: "text" };
import askLibrary from "./prompts/ask-library.md" with { type: "text" };
import tutor from "./prompts/tutor.md" with { type: "text" };
import judge from "./prompts/judge.md" with { type: "text" };

export type PromptName = "enrich" | "grade" | "research" | "explain" | "recall-feedback" | "key-points" | "check" | "chat" | "variant" | "variant-check" | "leave-out" | "ask-library" | "tutor" | "judge";

const TEXT: Record<PromptName, string> = { enrich, grade, research, explain, "recall-feedback": recallFeedback, "key-points": keyPoints, check, chat, variant, "variant-check": variantCheck, "leave-out": leaveOut, "ask-library": askLibrary, tutor, judge };

export interface Prompt {
  name: PromptName;
  version: string; // recorded as prompt_version, e.g. "enrich@1"
  text: string;
}

export function loadPrompt(name: PromptName): Prompt {
  const raw = TEXT[name];
  const { data, body } = parseFrontmatter<{ name: string; version: number | string }>(raw);
  if (data.name !== name || data.version === undefined) throw new Error(`prompt ${name}: missing name/version header`);
  return { name, version: `${name}@${data.version}`, text: body.trim() };
}
