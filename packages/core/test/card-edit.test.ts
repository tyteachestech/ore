import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gradeAnswer } from "../src/ai/grade.ts";
import { findCard, writeCardContent, writeNewCard } from "../src/cards.ts";
import { addSnippet } from "../src/ingest/index.ts";
import { tempLibrary } from "./helpers.ts";

// Editing an Explain card in review corrects the key points the grader marks against, not only the words shown.
let binDir = "";
const savedPath = process.env.PATH;
beforeEach(() => {
  binDir = mkdtempSync(join(tmpdir(), "ore-fakebin-"));
  writeFileSync(
    join(binDir, "claude"),
    `#!/usr/bin/env bun
require("fs").appendFileSync(${JSON.stringify(binDir)} + "/args.jsonl", JSON.stringify(process.argv.slice(2)) + "\\n");
console.log(JSON.stringify({ is_error: false, structured_output: { rating: 3, gaps: [], feedback: "Good.", covered: [true, false], evidence: ["forgetting", ""] }, modelUsage: { "claude-fake-1": { outputTokens: 10 } } }));
`,
  );
  chmodSync(join(binDir, "claude"), 0o755);
  process.env.PATH = `${binDir}:${savedPath}`;
  process.env.ORE_AI = "claude";
});
afterEach(() => {
  process.env.PATH = savedPath;
  delete process.env.ORE_AI;
});

async function explain() {
  const lib = await tempLibrary();
  const { item } = await addSnippet(lib, { text: "Spacing works." });
  const c = writeNewCard(lib, { kind: "prompt", item: item.meta.id, skills: [], topics: [], content_type: "concept", question: "Why space?", answer: "Forgetting.", rubric: ["names forgetting", "names retreival"] });
  return { lib, c };
}

describe("editing an Explain card's key points", () => {
  test("saves the corrected points with the answer, and grading marks against them", async () => {
    const { lib, c } = await explain();
    const e = writeCardContent(findCard(lib, c.meta.id), { answer: "Some forgetting makes retrieval effortful.", rubric: [" names forgetting ", "names retrieval effort"] });
    expect(e).toMatchObject({ answer: "Some forgetting makes retrieval effortful.", rubric: ["names forgetting", "names retrieval effort"] });
    expect(findCard(lib, c.meta.id).rubric).toEqual(["names forgetting", "names retrieval effort"]);
    expect(e.meta).toEqual(c.meta);
    await gradeAnswer(lib, c.meta.id, "forgetting");
    const input = JSON.parse(readFileSync(join(binDir, "args.jsonl"), "utf8").split("\n")[0]!)[1] as string;
    expect(input).toContain("names retrieval effort");
    expect(input).toContain("Some forgetting makes retrieval effortful.");
    expect(input).not.toContain("retreival");
  });

  test("refuses points that wouldn't read back: none, an empty one, or two lines in one", async () => {
    const { lib, c } = await explain();
    expect(() => writeCardContent(findCard(lib, c.meta.id), { rubric: [] })).toThrow(/at least one key point/);
    expect(() => writeCardContent(findCard(lib, c.meta.id), { rubric: ["names forgetting", "  "] })).toThrow(/empty/);
    expect(() => writeCardContent(findCard(lib, c.meta.id), { rubric: ["names\nforgetting"] })).toThrow(/one line/);
    expect(findCard(lib, c.meta.id).rubric).toEqual(["names forgetting", "names retreival"]);
  });

  test("a Fact card has no key points to give", async () => {
    const { lib } = await explain();
    const { item } = await addSnippet(lib, { text: "Two." });
    const f = writeNewCard(lib, { kind: "card", item: item.meta.id, skills: [], topics: [], content_type: "fact", question: "One plus one?", answer: "Two.", rubric: [] });
    expect(() => writeCardContent(findCard(lib, f.meta.id), { rubric: ["says two"] })).toThrow(/Fact exercise/);
  });
});
