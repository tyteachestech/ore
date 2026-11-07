import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tutor, tutorPassages } from "../src/ai/tutor.ts";
import { createItem, findItem } from "../src/items.ts";
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
type Sent = { message: string; reading?: { title: string }; earlier: unknown[]; passages: { id: string; source: string; heading: string; text: string }[] };
const sent = (): Sent[] =>
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

Spaced repetition is a way to remember.

## The Leitner system

Cards you answer correctly move to the next box, which you review less often. A card you miss goes back to the first box.`;

async function library() {
  const lib = await tempLibrary();
  const a = await createItem(lib, { type: "article", title: "Flashcard boxes", body: LEITNER });
  const b = await createItem(lib, { type: "article", title: "Memory", body: "Every card you review again gets easier to recall." });
  const c = await createItem(lib, { type: "article", title: "Bread", body: "Knead the dough for ten minutes." });
  return { lib, a, b, c };
}

describe("tutor: what it sees", () => {
  test("the open source's passages come first, then the library's; unrelated sources stay out", async () => {
    const { lib, a, b } = await library();
    const ps = tutorPassages(lib, "card box", { item: a.meta.id });
    expect(ps.map((p) => p.id)).toEqual(ps.map((_, i) => `P${i + 1}`));
    expect(ps[0]!.item).toBe(a.meta.id);
    expect(ps.some((p) => p.item === b.meta.id)).toBe(true);
    expect(ps.some((p) => p.title === "Bread")).toBe(false);
    expect(new Set(ps.map((p) => `${p.item}:${p.start}`)).size).toBe(ps.length); // no passage twice
  });

  test("a message with no words from the source (\"what's this about?\") still gets its opening", async () => {
    const { lib, a } = await library();
    const ps = tutorPassages(lib, "summarize", { item: a.meta.id });
    expect(ps[0]).toMatchObject({ item: a.meta.id, heading: "Boxes", text: "Spaced repetition is a way to remember." });
  });
});

describe("tutor: replies", () => {
  test("cites the open source, placed in its doc.md, and sends the title he is reading", async () => {
    const { lib, a } = await library();
    fakeClaude([{ reply: "It drops back to box one [1].", citations: [{ passage: "P1", quote: "A card you miss goes back to the first box." }], general: false }]);
    const r = await tutor(lib, "what happens to a card I miss?", { item: a.meta.id });
    expect(r.ai).toEqual({ vendor: "claude", model: "claude-fake-1", prompt_version: "tutor@2" });
    expect(r.general).toBe(false);
    const c = r.citations[0]!;
    expect(c).toMatchObject({ n: 1, item: a.meta.id, heading: "The Leitner system" });
    expect(findItem(lib, a.meta.id).body.slice(c.start, c.end)).toBe("A card you miss goes back to the first box.");
    expect(sent()[0]!.reading).toEqual({ title: "Flashcard boxes" });
  });

  test("a made-up quote or a marker with no citation goes back once to fix", async () => {
    const { lib, a } = await library();
    fakeClaude([
      { reply: "Box one [1] [2].", citations: [{ passage: "P1", quote: "goes back to the first box" }], general: false },
      { reply: "Box one [1].", citations: [{ passage: "P1", quote: "Missed cards return to box one." }], general: false },
      { reply: "Box one [1].", citations: [{ passage: "P1", quote: "goes back to the first box" }], general: false },
    ]);
    await expect(tutor(lib, "missed card", { item: a.meta.id })).rejects.toThrow("is not in P1: copy its exact words");
    expect(readFileSync(join(binDir, "msgs.jsonl"), "utf8")).toContain("marker [2] has no citation");
    const r = await tutor(lib, "missed card", { item: a.meta.id });
    expect(r.citations[0]!.quote).toBe("goes back to the first box");
  });

  test("with nothing in the library it still talks, marking general knowledge as such", async () => {
    const lib = await tempLibrary();
    fakeClaude([{ reply: "Photosynthesis turns light into sugar.", citations: [], general: true }]);
    const r = await tutor(lib, "what is photosynthesis?");
    expect(r).toMatchObject({ general: true, citations: [] });
    expect(sent()[0]!.passages).toEqual([]);
  });

  test("a follow-up sends the conversation so far", async () => {
    const { lib } = await library();
    fakeClaude([{ reply: "Less often.", citations: [], general: false }]);
    await tutor(lib, "and the right ones?", { earlier: [{ message: "What happens to a missed card?", reply: "First box." }] });
    expect(sent()[0]!.earlier).toEqual([{ message: "What happens to a missed card?", reply: "First box." }]);
  });
});

describe("tutor: @ sources and skills", () => {
  test("@-mentioned sources come first, each with its best passages; an @ skill keeps the rest to its sources", async () => {
    const lib = await tempLibrary();
    const a = await createItem(lib, { type: "article", title: "Flashcard boxes", body: LEITNER, skills: ["learning"] });
    const b = await createItem(lib, { type: "article", title: "Memory", body: "Every card you review again gets easier to recall.", skills: ["learning"] });
    const c = await createItem(lib, { type: "article", title: "Teaching cards", body: "A card that asks one thing teaches best.", skills: ["teaching"] });
    const ps = tutorPassages(lib, "card", { sources: [b.meta.id] });
    expect(ps[0]!.item).toBe(b.meta.id);
    expect(ps.some((p) => p.item === c.meta.id)).toBe(true);
    const inSkill = tutorPassages(lib, "card", { skills: ["learning"] });
    expect(new Set(inSkill.map((p) => p.item))).toEqual(new Set([a.meta.id, b.meta.id]));
  });

  test("the AI is told what he pointed it at; an unknown skill is refused", async () => {
    const { lib, b } = await library();
    fakeClaude([{ reply: "Easier each time.", citations: [], general: false }]);
    await tutor(lib, "what does this say?", { sources: [b.meta.id], skills: ["learning"] });
    expect((sent()[0] as unknown as { about: string[] }).about).toEqual(["Memory", "the skill Learning"]);
    await expect(tutor(lib, "hi", { skills: ["nope"] })).rejects.toThrow('no skill "nope"');
  });
});
