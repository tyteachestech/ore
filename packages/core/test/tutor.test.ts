import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addTutorCard, tutor, tutorPassages, type TutorCard } from "../src/ai/tutor.ts";
import { sceneOutline, setDiagram } from "../src/diagrams.ts";
import { findCard } from "../src/cards.ts";
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
    fakeClaude([{ reply: "It drops back to box one [1].", citations: [{ passage: "P1", quote: "A card you miss goes back to the first box." }], general: false, hint: false, exercise: null, card: null }]);
    const r = await tutor(lib, "what happens to a card I miss?", { item: a.meta.id });
    expect(r.ai).toEqual({ vendor: "claude", model: "claude-fake-1", prompt_version: "tutor@4" });
    expect(r.general).toBe(false);
    const c = r.citations[0]!;
    expect(c).toMatchObject({ n: 1, item: a.meta.id, heading: "The Leitner system" });
    expect(findItem(lib, a.meta.id).body.slice(c.start, c.end)).toBe("A card you miss goes back to the first box.");
    expect(sent()[0]!.reading).toEqual({ title: "Flashcard boxes" });
  });

  test("a made-up quote or a marker with no citation goes back once to fix", async () => {
    const { lib, a } = await library();
    fakeClaude([
      { reply: "Box one [1] [2].", citations: [{ passage: "P1", quote: "goes back to the first box" }], general: false, hint: false, exercise: null, card: null },
      { reply: "Box one [1].", citations: [{ passage: "P1", quote: "Missed cards return to box one." }], general: false, hint: false, exercise: null, card: null },
      { reply: "Box one [1].", citations: [{ passage: "P1", quote: "goes back to the first box" }], general: false, hint: false, exercise: null, card: null },
    ]);
    await expect(tutor(lib, "missed card", { item: a.meta.id })).rejects.toThrow("is not in P1: copy its exact words");
    expect(readFileSync(join(binDir, "msgs.jsonl"), "utf8")).toContain("marker [2] has no citation");
    const r = await tutor(lib, "missed card", { item: a.meta.id });
    expect(r.citations[0]!.quote).toBe("goes back to the first box");
  });

  test("with nothing in the library it still talks, marking general knowledge as such", async () => {
    const lib = await tempLibrary();
    fakeClaude([{ reply: "Photosynthesis turns light into sugar.", citations: [], general: true, hint: false, exercise: null, card: null }]);
    const r = await tutor(lib, "what is photosynthesis?");
    expect(r).toMatchObject({ general: true, citations: [] });
    expect(sent()[0]!.passages).toEqual([]);
  });

  test("a follow-up sends the conversation so far", async () => {
    const { lib } = await library();
    fakeClaude([{ reply: "Less often.", citations: [], general: false, hint: false, exercise: null, card: null }]);
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
    fakeClaude([{ reply: "Easier each time.", citations: [], general: false, hint: false, exercise: null, card: null }]);
    await tutor(lib, "what does this say?", { sources: [b.meta.id], skills: ["learning"] });
    expect((sent()[0] as unknown as { about: string[] }).about).toEqual(["Memory", "the skill Learning"]);
    await expect(tutor(lib, "hi", { skills: ["nope"] })).rejects.toThrow('no skill "nope"');
  });
});

describe("tutor: hints and cards", () => {
  test("a reply says when it is a hint and may propose a card; a card with a broken rubric goes back to fix", async () => {
    const { lib, a } = await library();
    const card: TutorCard = { kind: "prompt", content_type: "concept", question: "In the Leitner system, why does a missed card go back to box one?", answer: "So it comes back often until it sticks.", rubric: ["it is reviewed more often"] };
    fakeClaude([
      { reply: "Look at what happens to a card you miss.", citations: [], general: false, hint: true, exercise: null, card: null },
      { reply: "It goes back to box one [1].", citations: [{ passage: "P1", quote: "goes back to the first box" }], general: false, hint: false, exercise: null, card: { ...card, rubric: [] } },
      { reply: "It goes back to box one [1].", citations: [{ passage: "P1", quote: "goes back to the first box" }], general: false, hint: false, exercise: null, card },
    ]);
    expect(await tutor(lib, "what's the answer to my card about missed cards?", { item: a.meta.id })).toMatchObject({ hint: true, exercise: null, card: null });
    const r = await tutor(lib, "show me the missed card answer", { item: a.meta.id });
    expect(r.card).toEqual(card);
    expect(readFileSync(join(binDir, "msgs.jsonl"), "utf8")).toContain("a prompt card needs 2 to 4 rubric points");
  });

  test("a kept card is a draft on its source, with its skills and the reply's AI recorded", async () => {
    const lib = await tempLibrary();
    const a = await createItem(lib, { type: "article", title: "Flashcard boxes", body: LEITNER, skills: ["learning"] });
    const c = await addTutorCard(lib, a.meta.id, { kind: "card", content_type: "fact", question: "In the Leitner system, where does a missed card go?", answer: "Back to the first box.", rubric: [] }, { vendor: "claude", model: "claude-fake-1", prompt_version: "tutor@3" });
    expect(c.meta).toMatchObject({ item: a.meta.id, from: "tutor", state: "draft", skills: ["learning"], ai: { prompt_version: "tutor@3" } });
    expect(findCard(lib, c.meta.id).answer).toBe("Back to the first box.");
    await expect(addTutorCard(lib, a.meta.id, { kind: "prompt", content_type: "concept", question: "Why?", answer: "Because.", rubric: [] }, { vendor: "claude", model: "m", prompt_version: "tutor@3" })).rejects.toThrow("rubric");
  });
});

describe("tutor: practice", () => {
  test("Practice sets an open exercise with a heading for his note; an exercise with a card goes back to fix", async () => {
    const { lib, a } = await library();
    const exercise = { heading: "Why does a missed card go back to box one?", prompts: ["What happens to it next", "Why that helps"] };
    const card: TutorCard = { kind: "card", content_type: "fact", question: "In the Leitner system, where does a missed card go?", answer: "Back to the first box.", rubric: [] };
    fakeClaude([
      { reply: "Explain why a missed card goes back to box one.", citations: [], general: false, hint: false, exercise, card },
      { reply: "Explain why a missed card goes back to box one.", citations: [], general: false, hint: false, exercise, card: null },
    ]);
    const r = await tutor(lib, "Practice", { item: a.meta.id });
    expect(r).toMatchObject({ exercise, card: null, hint: false });
    expect(readFileSync(join(binDir, "msgs.jsonl"), "utf8")).toContain("propose no card with it");
  });

  test("a diagram he drew in his note reaches the tutor as lines: labels, then arrows", async () => {
    const { lib, a } = await library();
    const scene = { type: "excalidraw" as const, elements: [
      { id: "r1", type: "rectangle" }, { id: "t1", type: "text", text: "Missed card", containerId: "r1" },
      { id: "r2", type: "ellipse" }, { id: "t2", type: "text", text: "Box one", containerId: "r2" },
      { id: "ar", type: "arrow", startBinding: { elementId: "r1" }, endBinding: { elementId: "r2" } }, { id: "t3", type: "text", text: "goes back", containerId: "ar" },
      { id: "gone", type: "text", text: "Deleted", isDeleted: true },
    ] };
    expect(sceneOutline(scene)).toBe("- Missed card\n- Box one\n- Missed card → Box one (goes back)");
    await setDiagram(lib, a.meta.id, "boxes", JSON.stringify(scene));
    fakeClaude([{ reply: "Right: a miss sends it back.", citations: [], general: false, hint: false, exercise: null, card: null }]);
    await tutor(lib, "My answer:\n\n![Diagram](diagrams/boxes.excalidraw)\n\n![Diagram](diagrams/nothing.excalidraw)", { item: a.meta.id });
    const m = sent()[0]!.message;
    expect(m).toContain("[Diagram he drew:\n- Missed card\n- Box one\n- Missed card → Box one (goes back)\n]");
    expect(m).toContain("![Diagram](diagrams/nothing.excalidraw)");
  });
});
