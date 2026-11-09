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

  test("a stem matches every form of the word: memories and memory, studying and study", () => {
    expect(queryTerms("memories memory studying study studies")).toEqual(["memor", "stud"]);
    expect(queryTerms("days day keys quizzing quiz stopped stop")).toEqual(["day", "key", "quiz", "stop"]);
  });

  test("a stem never gets so short it matches other words: carry stays off card, added off adaptive", () => {
    expect(queryTerms("carry carries carried")).toEqual(["carr"]);
    expect(queryTerms("added add")).toEqual(["add"]);
    expect(queryTerms("very many only notes miss")).toEqual(["very", "many", "only", "note", "miss"]);
    // -ying is cut only after a consonant (studying): playing stayed "pla", a prefix of plan and place.
    expect(queryTerms("playing play staying stay")).toEqual(["play", "stay"]);
  });

  test("BM25: a short passage about the question beats a long one that mentions its words once, wherever it sits", async () => {
    const lib = await tempLibrary();
    const filler = Array.from({ length: 60 }, (_, i) => `Filler sentence ${i} about many other things entirely.`).join(" ");
    const body = `## History

The Leitner system and many other things. ${filler}

## Origin

The Leitner system was proposed by Sebastian Leitner, who wrote about the Leitner system in the 1970s.`;
    await createItem(lib, { type: "article", title: "Boxes", body });
    expect(retrieve(lib, "Who came up with the Leitner system?")[0]!.heading).toBe("Origin");
  });

  test("a long passage that names a word never scores below one that only sits under it in the title", async () => {
    const lib = await tempLibrary();
    const filler = (n: number) => Array.from({ length: n }, (_, i) => `Filler sentence ${i} about other things.`).join(" ");
    await createItem(lib, { type: "article", title: "Leitner", body: `## B\n\nBoxes in Leitner order. ${filler(60)}\n\n## A\n\nBoxes are reviewed often. ${filler(60)}${Array.from({ length: 8 }, (_, i) => `\n\n## S${i}\n\nShort one.`).join("")}` });
    expect(retrieve(lib, "Leitner boxes")[0]!.heading).toBe("B");
  });

  test("a source splits into paragraphs under their headings, at their place in doc.md; page markers and bare images are left out", () => {
    const ps = splitPassages(LEITNER);
    expect(ps.map((p) => [p.heading, p.text.slice(0, 20)])).toEqual([["Boxes", "Intro line."], ["The Leitner system", "Cards you answer cor"], ["Sleep", "Consolidation happen"]]);
    for (const p of ps) expect(LEITNER.slice(p.start, p.end)).toBe(p.text);
  });

  test("a list stays in one passage with the line that leads into it, however long the lead-in", () => {
    const lead = "A test can take many forms, and each one asks the mind to rebuild what it learned from the page before it, which is the part that makes it last:";
    const md = `## Testing\n\n${lead}\n\n- **free recall** to write down all you remember;\n\n- **cued recall** to answer from a prompt;\n\n- **practice testing** to work problems.\n\nA new paragraph that is long enough to stand on its own, so it starts a passage of its own here, with more than forty words in it to be sure it does not join the one before it at all.`;
    const ps = splitPassages(md);
    expect(ps).toHaveLength(2);
    expect(ps[0]!.text).toContain("practice testing");
    expect(ps[1]!.text).toStartWith("A new paragraph");
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

describe("Ask your library: how a quote reads", () => {
  test("a quote keeps its exact Markdown for the jump, and reads as plain text: link text without its URL, no emphasis marks", async () => {
    const lib = await tempLibrary();
    await createItem(lib, { type: "article", title: "SR", body: "**Spaced repetition** is an [evidence-based learning](https://en.wikipedia.org/wiki/X \"X\") technique done with *flashcards*.[^1]" });
    const quote = '**Spaced repetition** is an [evidence-based learning](https://en.wikipedia.org/wiki/X "X") technique done with *flashcards*.';
    fakeClaude([{ found: true, answer: "A technique [1].", citations: [{ passage: "P1", quote }] }]);
    const c = (await askLibrary(lib, "What is spaced repetition?")).citations[0]!;
    expect(c.quote).toBe(quote);
    expect(c.text).toBe("Spaced repetition is an evidence-based learning technique done with flashcards.");
  });
});
