import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { aiStampFor, chooseVendor, runAgent } from "../src/ai/adapter.ts";
import { aiModel, jobAi, setAiModel, setJobAi } from "../src/ai/models.ts";
import { tempLibrary } from "./helpers.ts";

// Each AI job can have its own AI (D356): a fake `claude` and a fake `codex` on PATH, each logging what it was run with.
let binDir = "";
const savedPath = process.env.PATH;
const savedAi = process.env.ORE_AI;
const fake = (name: "claude" | "codex", body: string) => {
  writeFileSync(join(binDir, name), `#!/usr/bin/env bun
const fs = require("fs");
const argv = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(binDir)} + "/${name}.jsonl", JSON.stringify(argv) + "\\n");
${body}
`);
  chmodSync(join(binDir, name), 0o755);
};
const runs = (name: "claude" | "codex") => {
  try {
    return readFileSync(join(binDir, `${name}.jsonl`), "utf8").trim().split("\n").map((l) => JSON.parse(l) as string[]);
  } catch {
    return [];
  }
};
const after = (argv: string[], flag: string) => argv[argv.indexOf(flag) + 1];
const Schema = z.object({ ok: z.boolean() });

beforeEach(() => {
  binDir = mkdtempSync(join(tmpdir(), "ore-fakebin-"));
  process.env.PATH = `${binDir}:${savedPath}`;
  delete process.env.ORE_AI;
  fake("claude", `console.log(JSON.stringify({ type: "result", is_error: false, structured_output: { ok: true }, modelUsage: { "claude-fake-1": { outputTokens: 1 } } }));`);
  fake("codex", `fs.writeFileSync(argv[argv.indexOf("-o") + 1], JSON.stringify({ ok: true }));
console.log(JSON.stringify({ type: "thread.started", thread_id: "t" }));`);
});
afterEach(() => {
  process.env.PATH = savedPath;
  if (savedAi === undefined) delete process.env.ORE_AI;
  else process.env.ORE_AI = savedAi;
});

describe("an AI for each job", () => {
  test("from skills.yaml, grading goes to codex while the tutor goes to claude", async () => {
    const lib = await tempLibrary();
    const file = join(lib.root, "skills.yaml");
    writeFileSync(file, readFileSync(file, "utf8").replace(/^ai: claude$/m, "ai: claude\njobs:\n  grade:\n    ai: codex\n    model: gpt-test"));

    const graded = await runAgent(lib, { prompt: "grade", cwd: lib.root, schema: Schema, input: {} });
    expect(graded.ai).toMatchObject({ vendor: "codex", model: "gpt-test" });
    expect(runs("claude")).toHaveLength(0);
    expect(after(runs("codex")[0]!, "-m")).toBe("gpt-test");

    const tutored = await runAgent(lib, { prompt: "tutor", cwd: lib.root, schema: Schema, input: {} });
    expect(tutored.ai.vendor).toBe("claude");
    expect(runs("codex")).toHaveLength(1);
    expect(after(runs("claude")[0]!, "--model")).toBe("sonnet");

    // Every prompt of a job goes with it, and a reply's stamp names the same AI before it runs.
    expect(chooseVendor(lib, "grade")).toBe("codex");
    expect(aiStampFor(lib, "check")).toMatchObject({ vendor: "codex", model: "gpt-test" });
    expect(aiStampFor(lib, "explain").vendor).toBe("claude");
    expect(aiStampFor(lib, "enrich").vendor).toBe("claude");
  });

  test("a library with only `ai:` runs every job on it, as before", async () => {
    const lib = await tempLibrary();
    for (const job of ["tutor", "grade", "write", "ask"] as const) {
      expect(jobAi(lib, job)).toBeNull();
      expect(chooseVendor(lib, job)).toBe("claude");
      expect(aiModel(lib, "claude", job)).toBe("sonnet");
    }
    await runAgent(lib, { prompt: "grade", cwd: lib.root, schema: Schema, input: {} });
    expect(runs("codex")).toHaveLength(0);
    expect(after(runs("claude")[0]!, "--model")).toBe("sonnet");
  });

  test("a job's AI is saved and taken back in skills.yaml, his comments kept", async () => {
    const lib = await tempLibrary();
    expect(await setJobAi(lib, "grade", { ai: "claude", model: "haiku" })).toEqual({ ai: "claude", model: "haiku" });
    expect(jobAi(lib, "grade")).toEqual({ ai: "claude", model: "haiku" });
    expect(aiModel(lib, "claude", "grade")).toBe("haiku");
    // A job's pick stands by itself: with no model it is the provider's default, whatever model the default AI has saved.
    await setAiModel(lib, "codex", "gpt-saved");
    await setAiModel(lib, "claude", "opus");
    await setJobAi(lib, "ask", { ai: "codex" });
    await setJobAi(lib, "write", { ai: "claude", model: "sonnet" });
    expect(jobAi(lib, "ask")).toEqual({ ai: "codex", model: "" });
    expect(aiModel(lib, "codex", "ask")).toBeUndefined();
    expect(aiModel(lib, "claude", "write")).toBe("sonnet");
    expect(aiModel(lib, "claude", "tutor")).toBe("opus");
    await setAiModel(lib, "codex", "");
    await setAiModel(lib, "claude", "sonnet");
    await setJobAi(lib, "write", null);
    // Back to the default: the block leaves the file.
    await setJobAi(lib, "grade", null);
    await setJobAi(lib, "ask", null);
    const yaml = readFileSync(join(lib.root, "skills.yaml"), "utf8");
    expect(yaml).not.toMatch(/^jobs:/m);
    expect(yaml).toContain("# Skills (D25)");
    await expect(setJobAi(lib, "grade", { ai: "claude", model: "not a model" })).rejects.toThrow("isn’t a model name");
  });

  test("ORE_AI still decides every job, so an eval's vendor is the one it asked for", async () => {
    const lib = await tempLibrary();
    await setJobAi(lib, "grade", { ai: "codex", model: "gpt-test" });
    process.env.ORE_AI = "claude";
    expect(chooseVendor(lib, "grade")).toBe("claude");
    expect(aiModel(lib, "claude", "grade")).toBe("sonnet");
  });
});
