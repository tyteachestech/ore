import { expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tempLibrary } from "./helpers.ts";

async function fixture() {
  const lib = await tempLibrary();
  const bin = mkdtempSync(join(tmpdir(), "ore-json-ai-"));
  const sent = join(bin, "sent.jsonl");
  const fake = `#!${process.execPath}
import { appendFileSync } from "node:fs";
appendFileSync(${JSON.stringify(sent)}, JSON.stringify(process.argv) + "\\n");
console.log(JSON.stringify({ type: "result", is_error: false, structured_output: { reply: "Yes.", citations: [], general: true, hint: false, steps: [], exercise: null, card: null, title: "A chat" }, modelUsage: { "claude-fixture": { outputTokens: 1 } } }));
`;
  for (const vendor of ["claude", "codex"]) {
    writeFileSync(join(bin, vendor), fake);
    chmodSync(join(bin, vendor), 0o755);
  }
  return {
    sent,
    close: () => { rmSync(bin, { recursive: true, force: true }); rmSync(lib.root, { recursive: true, force: true }); },
    async run(args: string[], json = true) {
      const p = Bun.spawn(["bun", join(import.meta.dir, "../../cli/src/ore.ts"), ...args, ...(json ? ["--json"] : [])], {
        env: { ...process.env, ORE_LIBRARY: lib.root, ORE_NO_ENRICH: "1", ORE_AI: "claude", ORE_AI_MODEL: "", PATH: `${bin}:${process.env.PATH}` },
        stdin: "ignore", stdout: "pipe", stderr: "pipe",
      });
      const [out, err, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
      return { out, err, code };
    },
  };
}

const cases = [
  ...["{}", "null", "[null]", "[1]", "[[]]", "{"].flatMap((value) => [
    ["tutor", "--earlier", value], ["tutor", "--files", value], ["ask-library", "--earlier", value],
  ]),
  ["tutor", "--earlier", '[{"message":"hi","files":{}}]'],
  ["tutor", "--files", '[{"name":"image"}]'],
  ["ask-library", "--earlier", '[{"question":3,"answer":"yes"}]'],
];

test.each(cases)("%s %s %s gives a flag/schema error before AI runs (JSON-10)", async (command, flag, value) => {
  const f = await fixture();
  try {
    const r = await f.run([command!, "Recall", flag!, value!]);
    expect(r.code).toBe(1);
    expect(JSON.parse(r.out).error).toContain(flag!);
    expect(JSON.parse(r.out).error).toMatch(/JSON array.*objects/);
    expect(existsSync(f.sent)).toBe(false);
  } finally { f.close(); }
});

test("structured flag errors also explain text mode; valid arrays and incomplete tutor turns still work (JSON-10)", async () => {
  const f = await fixture();
  try {
    const invalid = await f.run(["tutor", "Recall", "--files", "{}"], false);
    expect(invalid.code).toBe(1);
    expect(invalid.err).toContain("--files");
    expect(existsSync(f.sent)).toBe(false);
    for (const earlier of [[], [{ message: "hi" }], [{ reply: "yes" }], [{ message: null, reply: null }], [{ message: "hi", reply: "yes", files: [{ name: "gone", path: "chats/files/gone.txt" }], exercise: { older: true } }]]) {
      const r = await f.run(["tutor", "Recall", "--earlier", JSON.stringify(earlier), "--files", "[]"]);
      expect(r.code).toBe(0);
      expect(JSON.parse(r.out).reply).toBe("Yes.");
    }
    expect(readFileSync(f.sent, "utf8").trim().split("\n")).toHaveLength(5);
    expect((await f.run(["ask-library", "Recall", "--earlier", '[{"question":"What?","answer":"Recall"}]'])).code).toBe(0);
  } finally { f.close(); }
});
