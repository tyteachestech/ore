import { readFileSync } from "node:fs";
import { loadYaml } from "../frontmatter.ts";
import { writeAtomic } from "../fsutil.ts";
import { paths, type Library } from "../library.ts";
import { withLock } from "../lock.ts";
import { loadSkills, parseSkillsFile, type AiJob } from "../skills.ts";
import type { Vendor } from "./adapter.ts";
import type { PromptName } from "./prompts.ts";

export interface ModelOption { id: string; label: string; description?: string }

/** Claude Code's own aliases: each always points at that family's newest model, so a new Sonnet
 *  needs no change here. `claude` has no command that lists models, so these names are fixed. */
export const CLAUDE_MODELS: ModelOption[] = [
  { id: "sonnet", label: "Sonnet", description: "Fast and strong; the default" },
  { id: "opus", label: "Opus", description: "Deeper, slower, uses more of your plan" },
  { id: "fable", label: "Fable", description: "The most capable, if your plan has it" },
  { id: "haiku", label: "Haiku", description: "Fastest and lightest" },
];
const DEFAULT: Record<Vendor, string> = { claude: "sonnet", codex: "" }; // "" = Codex's own default

/** The job each prompt does: a job's AI (`jobs:` in skills.yaml) runs all of its prompts. */
export const JOB_OF: Record<PromptName, AiJob> = {
  tutor: "tutor", chat: "tutor", explain: "tutor",
  grade: "grade", check: "grade", "recall-feedback": "grade", "variant-check": "grade", dig: "grade", "try-line": "grade", judge: "grade", compare: "grade",
  enrich: "write", variant: "write", "key-points": "write", "leave-out": "write",
  "ask-library": "ask", research: "ask",
};

const saved = (lib: Library) => {
  try {
    return loadSkills(lib);
  } catch {
    return null; // a broken skills.yaml says so on every screen; AI runs on the default
  }
};

/** The AI he set for one job, with the model it runs; null when the job runs on the default AI. A job's
 *  pick stands by itself: with no model it is Sonnet or Codex's own default (""), never the model saved
 *  for the default AI, so changing that one leaves the job as he set it. */
export function jobAi(lib: Library, job: AiJob): { ai: Vendor; model: string } | null {
  const file = saved(lib);
  const own = file?.jobs?.[job];
  return own ? { ai: own.ai, model: own.model || DEFAULT[own.ai] } : null;
}

/** The model a vendor runs with: ORE_AI_MODEL, else the job's own when that job has its own AI on this vendor, else his
 *  pick for the vendor in skills.yaml, else Sonnet for Claude and Codex's own default (`model` in
 *  ~/.codex/config.toml) for Codex. undefined passes no flag. A job's AI is set aside while ORE_AI is
 *  set, as its vendor is, so its model never goes to the other vendor. */
export function aiModel(lib: Library, vendor: Vendor, job?: AiJob): string | undefined {
  const env = process.env.ORE_AI_MODEL;
  if (env) return env;
  const file = saved(lib);
  const own = job && !process.env.ORE_AI ? file?.jobs?.[job] : undefined;
  if (own?.ai === vendor) return own.model || DEFAULT[vendor] || undefined;
  return file?.models?.[vendor] || DEFAULT[vendor] || undefined;
}

/** The pick shown in Settings: the saved one, or the default ("" for Codex default). */
export const savedModel = (lib: Library, vendor: Vendor): string => {
  try {
    return loadSkills(lib).models?.[vendor] || DEFAULT[vendor];
  } catch {
    return DEFAULT[vendor];
  }
};

/** Save the model for one vendor (`models:` in skills.yaml), keeping comments; "" goes back to the default. */
export async function setAiModel(lib: Library, vendor: Vendor, model: string): Promise<string> {
  const id = model.trim();
  if (id && !/^[\w.:\-[\]/]+$/.test(id)) throw new Error(`"${model}" isn’t a model name`);
  return withLock(paths.lock(lib), () => {
    const doc = loadYaml().parseDocument(readFileSync(paths.skills(lib), "utf8"));
    if (id && id !== DEFAULT[vendor]) doc.setIn(["models", vendor], id);
    else if (doc.hasIn(["models", vendor])) {
      doc.deleteIn(["models", vendor]);
      if (!Object.keys((doc.toJSON() as { models?: object }).models ?? {}).length) doc.delete("models");
    }
    parseSkillsFile(doc.toJSON());
    writeAtomic(paths.skills(lib), doc.toString({ lineWidth: 0 }));
    return id || DEFAULT[vendor];
  });
}

/** Give one job its own AI (`jobs:` in skills.yaml), keeping comments; null puts it back on the default AI. */
export async function setJobAi(lib: Library, job: AiJob, own: { ai: Vendor; model?: string } | null): Promise<{ ai: Vendor; model: string } | null> {
  const model = own?.model?.trim() ?? "";
  if (model && !/^[\w.:\-[\]/]+$/.test(model)) throw new Error(`"${own!.model}" isn’t a model name`);
  await withLock(paths.lock(lib), () => {
    const doc = loadYaml().parseDocument(readFileSync(paths.skills(lib), "utf8"));
    if (own) {
      doc.setIn(["jobs", job], doc.createNode(model && model !== DEFAULT[own.ai] ? { ai: own.ai, model } : { ai: own.ai }));
    } else if (doc.hasIn(["jobs", job])) {
      doc.deleteIn(["jobs", job]);
      if (!Object.keys((doc.toJSON() as { jobs?: object }).jobs ?? {}).length) doc.delete("jobs");
    }
    parseSkillsFile(doc.toJSON());
    writeAtomic(paths.skills(lib), doc.toString({ lineWidth: 0 }));
  });
  return jobAi(lib, job);
}

interface CodexCatalog { models?: { slug?: string; display_name?: string; description?: string; visibility?: string; priority?: number }[] }

/** Codex's models as its own picker lists them, in its order. */
export function parseCodexModels(json: string): ModelOption[] {
  const list = (JSON.parse(json) as CodexCatalog).models ?? [];
  return list
    .filter((m) => m.slug && m.visibility === "list")
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
    .map((m) => ({ id: m.slug!, label: m.display_name || m.slug!, ...(m.description ? { description: m.description } : {}) }));
}

async function codexCatalog(args: string[], ms: number): Promise<ModelOption[] | null> {
  const bin = Bun.which("codex", { PATH: process.env.PATH ?? "" });
  if (!bin) return null;
  const proc = Bun.spawn([bin, "debug", "models", ...args], { stdin: "ignore", stdout: "pipe", stderr: "ignore" });
  const timer = setTimeout(() => proc.kill(), ms);
  const [out, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
  clearTimeout(timer);
  try {
    return code === 0 ? parseCodexModels(out) : null;
  } catch {
    return null;
  }
}

/** The models to pick from for a vendor. Codex asks `codex debug models` (refreshed from OpenAI when
 *  signed in, so new models appear by themselves), falling back to the catalog the installed Codex
 *  ships with. The saved pick stays in the list even if Codex stops offering it, so it never vanishes. */
export async function listModels(vendor: Vendor, saved = ""): Promise<ModelOption[]> {
  if (vendor === "claude") {
    return CLAUDE_MODELS.some((m) => m.id === saved) || !saved ? CLAUDE_MODELS : [...CLAUDE_MODELS, { id: saved, label: saved }];
  }
  const live = (await codexCatalog([], 10_000)) ?? (await codexCatalog(["--bundled"], 5_000)) ?? [];
  const all = [{ id: "", label: "Codex default", description: "The model set in Codex itself" }, ...live];
  return !saved || all.some((m) => m.id === saved) ? all : [...all, { id: saved, label: saved }];
}
