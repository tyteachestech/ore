import { afterEach, beforeEach, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { runAgent, runChatTurn } from "../src/ai/adapter.ts";
import { tempLibrary } from "./helpers.ts";

const savedPath = process.env.PATH, savedAi = process.env.ORE_AI;
let bin: string;
const reply = { reply: "Yes.", citations: [], general: false, hint: false, steps: [], exercise: null, card: null, title: "Chat" };
beforeEach(() => {
  bin = mkdtempSync(join(tmpdir(), "ore-stdin-"));
  process.env.PATH = `${bin}:${savedPath}`;
  process.env.ORE_AI = "codex";
  for (const vendor of ["codex", "claude"]) {
    writeFileSync(join(bin, vendor), `#!/usr/bin/env bun
const fs = require("node:fs");
const args = process.argv.slice(2);
const input = fs.readFileSync(0, "utf8");
fs.appendFileSync(${JSON.stringify(join(bin, "calls"))}, JSON.stringify({ args, input }) + "\\n");
const reply = ${JSON.stringify(reply)};
if (args.includes("-o")) {
  fs.writeFileSync(args[args.indexOf("-o") + 1], JSON.stringify(reply));
  console.log(JSON.stringify({ type: "thread.started", thread_id: "test-thread" }));
} else console.log(JSON.stringify({ type: "result", is_error: false, structured_output: reply }));
`);
    chmodSync(join(bin, vendor), 0o755);
  }
});
afterEach(() => {
  process.env.PATH = savedPath;
  if (savedAi === undefined) delete process.env.ORE_AI; else process.env.ORE_AI = savedAi;
  rmSync(bin, { recursive: true, force: true });
});
const calls = (): { args: string[]; input: string }[] => readFileSync(join(bin, "calls"), "utf8").trim().split("\n").map((line) => JSON.parse(line));
// Multibyte text crosses the byte limit even when its character count does not.
const message = "知".repeat(30_000) + " END";
test("F421: Codex tasks pipe long prompts intact on new and resumed sessions", async () => {
  const lib = await tempLibrary();
  for (const session of [{}, { id: "test-thread" }]) {
    await runAgent(lib, { prompt: "tutor", input: { message }, schema: z.object({ reply: z.string() }), cwd: lib.root, session });
  }
  for (const call of calls()) {
    expect(call.args.at(-1)).toBe("-");
    expect(call.args.every((a) => Buffer.byteLength(a) < 64_000)).toBe(true);
    expect(call.input).toContain(message);
  }
  expect(calls()[0]!.input).toContain("<instructions>");
  expect(calls()[1]!.args).toContain("resume");
});
for (const vendor of ["codex", "claude"] as const) test(`F421: ${vendor} review chats pipe long prompts on new and resumed sessions`, async () => {
  process.env.ORE_AI = vendor;
  const lib = await tempLibrary();
  for (const session of [undefined, "test-thread"]) await runChatTurn(lib, { system: "Be helpful.", message, schema: {}, cwd: lib.root, session });
  for (const call of calls()) {
    expect(call.args.every((a) => Buffer.byteLength(a) < 64_000)).toBe(true);
    expect(call.input).toContain(message);
  }
});
test("F421: tutor reads a long earlier chat from stdin and still accepts inline JSON", async () => {
  const lib = await tempLibrary();
  const earlier = JSON.stringify([{ message, reply: "I remember." }]);
  for (const value of ["-", JSON.stringify([{ message: "short", reply: "Hello." }])]) {
    const p = Bun.spawn([process.execPath, join(import.meta.dir, "../../cli/src/ore.ts"), "tutor", "continue", "--earlier", value, "--json"], {
      env: { ...process.env, ORE_LIBRARY: lib.root }, stdin: new Blob([earlier]), stdout: "pipe", stderr: "pipe",
    });
    const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
    expect({ code, err }).toEqual({ code: 0, err: "" });
    expect(JSON.parse(out).reply).toBe("Yes.");
  }
  expect(calls()[0]!.input).toContain(message);
  expect(calls()[1]!.args.at(-1)).toContain("short");
});
