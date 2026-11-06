// The docs that tell agents and Tyler how to call `ore` name only commands and flags the CLI has.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { commands } from "../../cli/src/commands.ts";

const root = join(import.meta.dir, "../../..");
/** Commands the SPEC plans for maps (D35, deferred by D95): not built, so not in the CLI yet. */
const PLANNED = new Set(["map", "resolve"]);
// What agents and Tyler read to run `ore` (decisions and design docs are records of their day, not checked).
const DOCS = ["skills/ore/SKILL.md", "skills/ore/README.md", "skills/ore/reference/cards.md", "AGENTS.md", "CLAUDE.md", ".claude/skills/interaction-check/SKILL.md", "packages/core/src/templates/library-agents.md", "docs/SPEC.md", "README.md"];

/** Code in a Markdown file: fenced blocks line by line, and inline `spans`. */
function codeOf(md: string): string[] {
  const out: string[] = [];
  let fenced = false;
  for (const line of md.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      fenced = !fenced;
      continue;
    }
    // A fenced line's own `spans` are calls of their own, so a span's flag never counts for the line's command.
    if (fenced) out.push(...line.split("`"));
    else for (const m of line.matchAll(/`([^`]+)`/g)) out.push(m[1]!);
  }
  return out;
}

/** Each `ore <command> …` call in the code, with the --flags written after it (up to the next call). */
function calls(code: string): { cmd: string; flags: string[]; text: string }[] {
  return code.split(/(?<![\w/.-])ore (?=\S)/).slice(1).map((rest) => {
    const cmd = rest.split(/\s/)[0]!;
    return { cmd, flags: [...rest.matchAll(/(?<![\w-])--([a-z][a-z-]*)/g)].map((m) => m[1]!), text: `ore ${rest}`.trim() };
  });
}

describe("CLI docs match the CLI", () => {
  for (const doc of DOCS) {
    test(doc, () => {
      const wrong: string[] = [];
      for (const code of codeOf(readFileSync(join(root, doc), "utf8"))) {
        for (const c of calls(code)) {
          if (c.cmd === "--help" || c.cmd === "…" || PLANNED.has(c.cmd)) continue;
          const command = commands[c.cmd.replace(/[^a-z-]+$/, "")];
          if (!command) {
            wrong.push(`unknown command: ${c.text}`);
            continue;
          }
          const known = new Set(["json", "help", ...Object.keys(command.options ?? {})]);
          for (const f of c.flags) if (!known.has(f)) wrong.push(`ore ${c.cmd} has no --${f}: ${c.text}`);
        }
      }
      expect(wrong).toEqual([]);
    });
  }
});
