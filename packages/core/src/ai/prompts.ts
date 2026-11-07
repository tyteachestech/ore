import { readFileSync } from "node:fs";
import { parseFrontmatter } from "../frontmatter.ts";

export type PromptName = "enrich" | "grade" | "research" | "explain" | "recall-feedback" | "key-points" | "check" | "chat" | "variant" | "variant-check" | "leave-out" | "ask-library";

export interface Prompt {
  name: PromptName;
  version: string; // recorded as prompt_version, e.g. "enrich@1"
  text: string;
}

export function loadPrompt(name: PromptName): Prompt {
  const raw = readFileSync(new URL(`./prompts/${name}.md`, import.meta.url), "utf8");
  const { data, body } = parseFrontmatter<{ name: string; version: number | string }>(raw);
  if (data.name !== name || data.version === undefined) throw new Error(`prompt ${name}: missing name/version header`);
  return { name, version: `${name}@${data.version}`, text: body.trim() };
}
