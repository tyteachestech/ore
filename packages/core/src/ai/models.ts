import { readFileSync } from "node:fs";
import { loadYaml } from "../frontmatter.ts";
import { writeAtomic } from "../fsutil.ts";
import { paths, type Library } from "../library.ts";
import { withLock } from "../lock.ts";
import { loadSkills, SkillsFileSchema } from "../skills.ts";
import type { Vendor } from "./adapter.ts";

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

/** The model a vendor runs with: ORE_AI_MODEL, else his pick in skills.yaml, else Sonnet for Claude
 *  and Codex's own default (`model` in ~/.codex/config.toml) for Codex. undefined passes no flag. */
export function aiModel(lib: Library, vendor: Vendor): string | undefined {
  const env = process.env.ORE_AI_MODEL;
  if (env) return env;
  let saved: string | undefined;
  try {
    saved = loadSkills(lib).models?.[vendor];
  } catch { /* a broken skills.yaml says so on every screen; AI runs on the default */ }
  return saved || DEFAULT[vendor] || undefined;
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
    SkillsFileSchema.parse(doc.toJSON());
    writeAtomic(paths.skills(lib), doc.toString({ lineWidth: 0 }));
    return id || DEFAULT[vendor];
  });
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
