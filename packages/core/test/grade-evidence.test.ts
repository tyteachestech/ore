import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gradeAnswer, quoteIn } from "../src/ai/grade.ts";
import { writeNewCard } from "../src/cards.ts";
import { addSnippet } from "../src/ingest/index.ts";
import { tempLibrary } from "./helpers.ts";

// D140: the grader quotes the words of his answer that earned each key point, so Review can show them.
describe("quoteIn", () => {
  const answer = "Spacing works because some  forgetting makes\nretrieval “effortful”, which strengthens it.";
  test("finds the quote as he spelled it, across case, curly quotes and spacing", () => {
    expect(quoteIn(answer, "Some forgetting makes retrieval")).toBe("some  forgetting makes\nretrieval");
    expect(quoteIn(answer, 'retrieval "effortful"')).toBe("retrieval “effortful”");
    expect(quoteIn(answer, "…which strengthens it.")).toBe("which strengthens it.");
  });
  test("words he didn't write find nothing", () => {
    expect(quoteIn(answer, "forgetting makes recall effortful")).toBe("");
    expect(quoteIn(answer, "")).toBe("");
    expect(quoteIn(answer, "…")).toBe("");
  });
});

describe("grading quotes his words per key point", () => {
  let binDir = "";
  const savedPath = process.env.PATH;
  beforeEach(() => {
    binDir = mkdtempSync(join(tmpdir(), "ore-fakebin-"));
    const out = { rating: 2, gaps: ["names effort"], feedback: "Close.", covered: [true, true, false], evidence: ["SOME FORGETTING", "retrieval is easier", "makes retrieval"] };
    writeFileSync(join(binDir, "claude"), `#!/usr/bin/env bun\nconsole.log(JSON.stringify({ is_error: false, structured_output: ${JSON.stringify(out)}, modelUsage: { "claude-fake-1": { outputTokens: 10 } } }));\n`);
    chmodSync(join(binDir, "claude"), 0o755);
    process.env.PATH = `${binDir}:${savedPath}`;
    process.env.ORE_AI = "claude";
  });
  afterEach(() => {
    process.env.PATH = savedPath;
    delete process.env.ORE_AI;
  });

  test("keeps a quote only where the point is covered and the words are his", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Spacing works." });
    const c = writeNewCard(lib, { kind: "prompt", item: item.meta.id, skills: [], topics: [], content_type: "concept", question: "Why space?", answer: "Forgetting.", rubric: ["names forgetting", "names retrieval", "names effort"] });
    const g = await gradeAnswer(lib, c.meta.id, "Some forgetting makes retrieval harder.");
    // Covered and his words: kept as he wrote them. Covered but not his words: dropped. Not covered: dropped.
    expect(g.evidence).toEqual(["Some forgetting", "", ""]);
  });
});
