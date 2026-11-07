import { existsSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { libraryRoot, paths, type Library } from "./library.ts";
import { defaultSkillsYaml } from "./skills.ts";
import template from "./templates/library-agents.md" with { type: "text" };

const DIRS = ["topics", "items", "cards", "reviews", "sessions", "inbox", ".ore", ".index"];

export async function agentsTemplate(): Promise<string> {
  return template;
}

// Idempotent: creates what is missing and never overwrites existing files.
export async function initLibrary(path?: string): Promise<{ root: string; created: string[] }> {
  const lib: Library = { root: libraryRoot(path) };
  const created: string[] = [];
  const write = (p: string, content: string) => {
    if (existsSync(p)) return;
    writeFileSync(p, content);
    created.push(p);
  };
  for (const d of DIRS) {
    const p = join(lib.root, d);
    if (!existsSync(p)) {
      mkdirSync(p, { recursive: true });
      created.push(p + "/");
    }
  }
  write(paths.skills(lib), defaultSkillsYaml());
  write(paths.agents(lib), await agentsTemplate());
  write(join(lib.root, ".gitignore"), ".index/\n.ore/\n.DS_Store\n");
  const claude = join(lib.root, "CLAUDE.md");
  if (!existsSync(claude)) {
    symlinkSync("AGENTS.md", claude);
    created.push(claude);
  }
  if (!existsSync(join(lib.root, ".git"))) {
    const r = Bun.spawnSync(["git", "init", "-q"], { cwd: lib.root });
    if (r.exitCode !== 0) throw new Error(`git init failed: ${r.stderr.toString().trim()}`);
    created.push(join(lib.root, ".git/"));
  }
  return { root: lib.root, created };
}
