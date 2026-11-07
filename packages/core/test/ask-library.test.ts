import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { askLibrary, NOT_FOUND, queryTerms, retrieve, splitPassages } from "../src/ai/ask.ts";
import { createItem, findItem, setItemArchived } from "../src/items.ts";
import { tempLibrary } from "./helpers.ts";

// A fake `claude` that replays canned outputs in order and keeps what it was sent.
let binDir = "";
const savedPath = process.env.PATH;
function fakeClaude(outputs: unknown[]) {
  writeFileSync(join(binDir, "queue.json"), JSON.stringify(outputs));
  writeFileSync(join(binDir, "count"), "0");
  writeFileSync(join(binDir, "claude"), `#!/usr/bin/env bun
const fs = require("fs");
const dir = ${JSON.stringify(binDir)};
const n = Number(fs.readFileSync(dir + "/count", "utf8"));
fs.writeFileSync(dir + "/count", String(n + 1));
fs.appendFileSync(dir + "/msgs.jsonl", JSON.stringify(process.argv[process.argv.indexOf("-p") + 1]) + "\\n");
console.log(JSON.stringify({ is_error: false, structured_output: JSON.parse(fs.readFileSync(dir + "/queue.json", "utf8"))[n], modelUsage: { "claude-fake-1": { outputTokens: 5 } } }));
`);
  chmodSync(join(binDir, "claude"), 0o755);
}
const sent = (): { question: string; passages: { id: string; source: string; heading: string; text: string }[] }[] =>
  readFileSync(join(binDir, "msgs.jsonl"), "utf8").trim().split("\n").map((l) => { const m = JSON.parse(l) as string; return JSON.parse(m.slice(m.indexOf("{"), m.lastIndexOf("}") + 1)); });

beforeEach(() => {
  binDir = mkdtempSync(join(tmpdir(), "ore-fakebin-"));
  process.env.PATH = `${binDir}:${savedPath}`;
  process.env.ORE_AI = "claude";
});
afterEach(() => {
  process.env.PATH = savedPath;
  delete process.env.ORE_AI;
});

const LEITNER = `# Boxes

Intro line.

## The Leitner system

Cards you answer correctly move to the next box, which you review less often. A card you miss goes back to the first box.

<!-- page 2 -->

![](assets/box.png)

## Sleep

Consolidation happens during sleep.`;

async function library() {
  const lib = await tempLibrary();
  const a = await createItem(lib, { type: "article", title: "Flashcard boxes", body: LEITNER });
  const b = await createItem(lib, { type: "article", title: "Bread", body: "Knead the dough for ten minutes.\n\nLet it rise overnight." });
  return { lib, a, b };
}

describe("Ask your library: retrieval", () => {
  test("question words lose stop words and are cut to stems", () => {
    expect(queryTerms("What happens to a card you get wrong in the Leitner boxes?")).toEqual(["happen", "card", "get", "wrong", "leitner", "box"]);
  });

  test("a source splits into paragraphs under their headings, at their place in doc.md; page markers and bare images are left out", () => {
    const ps = splitPassages(LEITNER);
    expect(ps.map((p) => [p.heading, p.text.slice(0, 20)])).toEqual([["Boxes", "Intro line."], ["The Leitner system", "Cards you answer cor"], ["Sleep", "Consolidation happen"]]);
    for (const p of ps) expect(LEITNER.slice(p.start, p.end)).toBe(p.text);
  });

  test("finds the passages that hold the question's words, best first; archived sources and unrelated ones stay out", async () => {
    const { lib, a } = await library();
    const hits = retrieve(lib, "What happens to a missed card in the Leitner boxes?");
    expect(hits[0]).toMatchObject({ id: "P1", item: a.meta.id, title: "Flashcard boxes", heading: "The Leitner system" });
    expect(hits.some((h) => h.title === "Bread")).toBe(false);
    await setItemArchived(lib, a.meta.id, true);
    expect(retrieve(lib, "Leitner boxes")).toEqual([]);
  });
});

describe("Ask your library: answers", () => {
  test("answers from the passages with each quote placed in its source, so the reader can jump to it", async () => {
    const { lib, a } = await library();
    fakeClaude([{ found: true, answer: "It goes back to the first box [1].", citations: [{ passage: "P1", quote: "A card you miss goes back to the first box." }] }]);
    const r = await askLibrary(lib, "What happens to a card I miss in the Leitner system?");
    expect(r.found).toBe(true);
    expect(r.ai).toEqual({ vendor: "claude", model: "claude-fake-1", prompt_version: "ask-library@1" });
    expect(r.citations).toHaveLength(1);
    const c = r.citations[0]!;
    expect(c).toMatchObject({ n: 1, item: a.meta.id, title: "Flashcard boxes", heading: "The Leitner system" });
    expect(findItem(lib, a.meta.id).body.slice(c.start, c.end)).toBe("A card you miss goes back to the first box.");
    expect(sent()[0]!.passages[0]).toMatchObject({ id: "P1", source: "Flashcard boxes", heading: "The Leitner system" });
  });

  test("a made-up quote, an unknown passage or a found answer with no citation is sent back once to fix", async () => {
    const { lib } = await library();
    fakeClaude([
      { found: true, answer: "Back to box one [1].", citations: [{ passage: "P1", quote: "Missed cards return to box one." }] },
      { found: true, answer: "Back to the first box [1].", citations: [{ passage: "P1", quote: "goes back to the first box" }] },
    ]);
    const r = await askLibrary(lib, "Leitner missed card");
    expect(r.citations[0]!.quote).toBe("goes back to the first box");
    expect(readFileSync(join(binDir, "msgs.jsonl"), "utf8")).toContain("is not in P1: copy its exact words");
  });

  test("says so when the library doesn't hold the answer: from the AI, or at once when no source has the words", async () => {
    const { lib } = await library();
    fakeClaude([{ found: false, answer: "Your library doesn't cover that.", citations: [] }]);
    expect(await askLibrary(lib, "Which box holds cards you know well?")).toMatchObject({ found: false, citations: [] });
    const none = await askLibrary(lib, "photosynthesis chlorophyll");
    expect(none).toMatchObject({ found: false, answer: NOT_FOUND, citations: [], ai: null });
    expect(existsSync(join(binDir, "count")) && readFileSync(join(binDir, "count"), "utf8")).toBe("1"); // no AI call for that one
  });

  test("a follow-up searches with the earlier question too and sends the turns so far", async () => {
    const { lib } = await library();
    fakeClaude([{ found: true, answer: "Less often [1].", citations: [{ passage: "P1", quote: "which you review less often" }] }]);
    await askLibrary(lib, "and the ones I get right?", [{ question: "What happens to a missed card in the Leitner system?", answer: "First box." }]);
    const msg = sent()[0]! as unknown as { earlier: unknown[]; passages: { heading: string }[] };
    expect(msg.earlier).toHaveLength(1);
    expect(msg.passages[0]!.heading).toBe("The Leitner system");
  });

  test("an empty question is refused", async () => {
    const { lib } = await library();
    expect(askLibrary(lib, "  ")).rejects.toThrow("question is empty");
  });
});
