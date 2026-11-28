import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { commands } from "../../cli/src/commands.ts";
import { pendingPrequestions } from "../src/ai/enrich.ts";
import { addText } from "../src/ingest/index.ts";
import { findItem, updateItemMeta } from "../src/items.ts";
import { tempLibrary } from "./helpers.ts";
import { readDigs } from "../src/digs.ts";
import { skillNotesPath } from "../src/notes.ts";
import { setSkillLook } from "../src/skills.ts";

const root = join(import.meta.dir, "../../..");
const guide = () => readFileSync(join(root, "skills/ore/SKILL.md"), "utf8");

test("the shell recipe passes delimiter lines, quotes and shell syntax as literal answer text", () => {
  const dir = mkdtempSync(join(tmpdir(), "ore-guide-"));
  try {
    const marker = join(dir, "executed");
    const answer = `  Tyler's example:\nORE_EOF\nprintf executed > '${marker}'\n$(touch '${marker}') \`touch '${marker}'\` $HOME \\ \"\n\n`;
    const text = guide();
    const recipe = text.match(/  ```bash\n([\s\S]*?)  ```/)![1]!.replace(/^  /gm, "");
    // Apply the guide's single-quote escaping rule; the former heredoc took raw text.
    const command = recipe.replace("<shell-escaped text>", answer.replaceAll("'", "'\\''"))
      .replace("<Tyler's answer, verbatim>", answer).replace("<card>", "fixture");
    const result = spawnSync("/bin/sh", ["-c", `ore() { printf '%s' "$4" > "$CAPTURE"; }\n${command}`], {
      encoding: "utf8", timeout: 5000, env: { ...process.env, CAPTURE: join(dir, "answer") },
    });
    expect(existsSync(marker)).toBe(false);
    expect(result.status).toBe(0);
    expect(readFileSync(join(dir, "answer"), "utf8")).toBe(answer);
    expect(text).toContain("replace every single quote (`'`) in the text with `'\\''`");
    expect(text).not.toContain("<<'ORE_EOF'");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("every exercise-edit recipe supplies the replacement author's AI stamp", () => {
  for (const file of ["skills/ore/SKILL.md", "skills/ore/reference/cards.md", "packages/core/src/templates/library-agents.md"]) {
    const text = readFileSync(join(root, file), "utf8");
    const recipes = [...text.matchAll(/`(ore card set <id>[^`]+)`/g)];
    expect(recipes.length).toBeGreaterThan(0);
    for (const [, recipe] of recipes) expect(recipe).toContain("--ai");
    expect(text).toContain("--ai null");
    expect(text).toContain("prompt_version");
    expect(text).toContain("ore ask");
    expect(text).not.toContain("ai: {vendor, model, prompt_version}   # leave as is");
  }
  const spec = readFileSync(join(root, "docs/SPEC.md"), "utf8");
  expect(spec.split("\n").find((line) => line.startsWith("ore card show|"))).toContain("--ai");
});

test("both Dig guide recipes save his words once in the dated skill note and in the Dig record", async () => {
  for (const file of ["skills/ore/SKILL.md", "packages/core/src/templates/library-agents.md"]) {
    const text = readFileSync(join(root, file), "utf8");
    const section = text.split("## Saving a Dig")[1];
    expect(section).toBeDefined();
    const recipe = section!.match(/```bash\n([\s\S]*?)```/)?.[1];
    expect(recipe).toBeDefined();
    expect(recipe).toContain('ore notes --skill <skill> --append "$ANS"');
    expect(recipe).toContain('ore dig <skill> --text "$ANS"');
    expect(commands.dig!.usage).toContain("does not append to the skill note");
    const lib = await tempLibrary();
    try {
      await setSkillLook(lib, "learning", { goal: "Explain how to space retrieval" });
      const words = "I'd retrieve over several days, then check what I missed.\nKeep $HOME and `examples` literal.";
      const result = spawnSync("/bin/sh", ["-c", 'ore() { "$BUN" "$CLI" "$@"; }\n' + recipe!
        .replaceAll("<skill>", "learning").replaceAll("<YYYY-MM-DD>", "2026-11-28").replace("<shell-escaped text>", words.replaceAll("'", "'\\''"))], {
        encoding: "utf8", timeout: 10000,
        env: { ...process.env, BUN: process.execPath, CLI: join(root, "packages/cli/src/ore.ts"),
          ORE_LIBRARY: lib.root, ORE_NO_ENRICH: "1" },
      });
      expect(result.status).toBe(0);
      const note = readFileSync(skillNotesPath(lib, "learning"), "utf8");
      expect(note).toContain("## Dig, 2026-11-28");
      expect(note.split(words)).toHaveLength(2);
      expect(readDigs(lib, "learning").map((d) => d.text)).toEqual([words]);
      expect(readDigs(lib, "learning")[0]!.done_at).toBeDefined();
    } finally {
      rmSync(lib.root, { recursive: true, force: true });
    }
  }
});

test("the review guide presents card show --review and keeps that variant through grading and rating", () => {
  const review = guide().split("## 1 · Review")[1]!.split("## 2 · Add")[0]!;
  const probe = review.split("**Probe turn.**")[1]!.split("**Answer turn.**")[0]!;
  expect(probe).toContain("ore card show <card> --review --json");
  expect(probe).not.toContain("question` field of that `ore due`");
  expect(probe).toContain("figure_file");
  expect(probe).toContain("figure.box");
  expect(probe).toContain("opaque");
  expect(probe).toContain("do not grade or log");
  const grade = review.split("\n").find((line) => line.startsWith("ore grade "))!;
  const rate = review.split("\n").find((line) => line.startsWith("ore review "))!;
  expect(grade).toContain("[--variant V]");
  expect(rate).toContain("[--variant V]");
  expect(review).toContain("same presentation's `answer`");
  expect(review).toContain("omit `--variant` for the original");
});

test("the after-reading guide marks a complete source Done after saving answers, enabling prequestion drafts", async () => {
  const mode = guide().split("## 3 · Prequestions")[1]!.split("## 4 · Fix")[0]!;
  const finish = mode.match(/`ore status <id> done --json`/);
  expect(finish).not.toBeNull();
  expect(mode.indexOf("ore prequestion")).toBeLessThan(mode.indexOf("ore status"));
  expect(mode).toContain("partway");
  const savedLibrary = process.env.ORE_LIBRARY;
  const savedEnrich = process.env.ORE_NO_ENRICH;
  try {
    process.env.ORE_NO_ENRICH = "1";
    for (const status of ["inbox", "reading"] as const) {
      const lib = await tempLibrary();
      process.env.ORE_LIBRARY = lib.root;
      const item = await addText(lib, "# Spacing\n\nRetrieve over several days.");
      await updateItemMeta(lib, item.meta.id, (meta) => ({
        ...meta, status, prequestions: [{ q: "Why retrieve?", before: "No idea", after: "To strengthen recall" }],
      }));
      expect(pendingPrequestions(findItem(lib, item.meta.id), [])).toHaveLength(0);
      const [, command, , state] = finish![0].replaceAll("`", "").split(" ");
      await commands[command!]!.run([item.meta.id, state!], { json: true });
      const finished = findItem(lib, item.meta.id);
      expect(finished.meta.status).toBe("done");
      expect(finished.meta.finished_at).toBeDefined();
      expect(pendingPrequestions(finished, [])).toHaveLength(1);
    }
  } finally {
    if (savedLibrary === undefined) delete process.env.ORE_LIBRARY;
    else process.env.ORE_LIBRARY = savedLibrary;
    if (savedEnrich === undefined) delete process.env.ORE_NO_ENRICH;
    else process.env.ORE_NO_ENRICH = savedEnrich;
  }
});
