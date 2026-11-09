import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Citation } from "../src/ai/ask.ts";
import { addTutorCard, partialReply, tutor, tutorPassages, type TutorCard } from "../src/ai/tutor.ts";
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
fs.writeFileSync(dir + "/argv.json", JSON.stringify(process.argv));
// An entry { web: [events…], out } first prints those stream-json events (what its web search returned).
const q = JSON.parse(fs.readFileSync(dir + "/queue.json", "utf8"))[n];
for (const e of q?.web ?? []) console.log(JSON.stringify(e));
console.log(JSON.stringify({ type: "result", is_error: false, structured_output: q?.web ? q.out : q, modelUsage: { "claude-fake-1": { outputTokens: 5 } } }));
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
    fakeClaude([{ reply: "It drops back to box one [1].", citations: [{ passage: "P1", quote: "A card you miss goes back to the first box." }], general: false, hint: false, steps: [], exercise: null, card: null }]);
    const r = await tutor(lib, "what happens to a card I miss?", { item: a.meta.id });
    expect(r.ai).toEqual({ vendor: "claude", model: "claude-fake-1", prompt_version: "tutor@11" });
    expect(r.general).toBe(false);
    const c = r.citations[0] as Citation;
    expect(c).toMatchObject({ n: 1, item: a.meta.id, heading: "The Leitner system" });
    expect(findItem(lib, a.meta.id).body.slice(c.start, c.end)).toBe("A card you miss goes back to the first box.");
    expect(sent()[0]!.reading).toEqual({ title: "Flashcard boxes" });
  });

  test("a made-up quote or a marker with no citation goes back once to fix", async () => {
    const { lib, a } = await library();
    fakeClaude([
      { reply: "Box one [1] [2].", citations: [{ passage: "P1", quote: "goes back to the first box" }], general: false, hint: false, steps: [], exercise: null, card: null },
      { reply: "Box one [1].", citations: [{ passage: "P1", quote: "Missed cards return to box one." }], general: false, hint: false, steps: [], exercise: null, card: null },
      { reply: "Box one [1].", citations: [{ passage: "P1", quote: "goes back to the first box" }], general: false, hint: false, steps: [], exercise: null, card: null },
    ]);
    await expect(tutor(lib, "missed card", { item: a.meta.id })).rejects.toThrow("is not in P1: copy its exact words");
    expect(readFileSync(join(binDir, "msgs.jsonl"), "utf8")).toContain("marker [2] has no citation");
    const r = await tutor(lib, "missed card", { item: a.meta.id });
    expect(r.citations[0]!.quote).toBe("goes back to the first box");
  });

  test("with nothing in the library it still talks, marking general knowledge as such", async () => {
    const lib = await tempLibrary();
    fakeClaude([{ reply: "Photosynthesis turns light into sugar.", citations: [], general: true, hint: false, steps: [], exercise: null, card: null }]);
    const r = await tutor(lib, "what is photosynthesis?");
    expect(r).toMatchObject({ general: true, citations: [] });
    expect(sent()[0]!.passages).toEqual([]);
  });

  test("a follow-up sends the conversation so far", async () => {
    const { lib } = await library();
    fakeClaude([{ reply: "Less often.", citations: [], general: false, hint: false, steps: [], exercise: null, card: null }]);
    await tutor(lib, "and the right ones?", { earlier: [{ message: "What happens to a missed card?", reply: "First box." }] });
    expect(sent()[0]!.earlier).toEqual([{ message: "What happens to a missed card?", reply: "First box." }]);
  });
});

/** What a stream-json run prints when its web search returns these pages, with this summary text. */
const searched = (pages: { url: string; title: string }[], text: string) => [
  { type: "system", subtype: "init", model: "claude-main-1" },
  { type: "assistant", message: { content: [{ type: "tool_use", id: "t1", name: "WebSearch", input: { query: "q" } }] } },
  { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t1", content: `Links: ${JSON.stringify(pages)}\n\n${text}` }] }, tool_use_result: { query: "q", results: [{ content: pages }] } },
];
const BRIT = { url: "https://www.britannica.com/biography/Hermann-Ebbinghaus", title: "Hermann Ebbinghaus | Britannica" };

describe("tutor: the web", () => {
  test("when his sources don't hold it, a web page the search returned is cited by its URL, title and site", async () => {
    const { lib } = await library();
    fakeClaude([{ web: searched([BRIT], "Hermann Ebbinghaus was born on January 24, 1850, in Barmen."), out: { reply: "Your sources don't give it; he was born in 1850 [1].", citations: [{ passage: "https://britannica.com/biography/Hermann-Ebbinghaus/", quote: "born on January 24, 1850" }], general: false, hint: false, steps: [], exercise: null, card: null } }]);
    const r = await tutor(lib, "When was Ebbinghaus born?");
    expect(r.searched).toBe(true);
    expect(r.ai.model).toBe("claude-main-1"); // not the search's helper model, which wrote more
    expect(r.citations).toEqual([{ n: 1, url: BRIT.url, title: BRIT.title, site: "britannica.com", quote: "born on January 24, 1850", text: "born on January 24, 1850" }]);
  });

  test("a link the search never returned, or a quote it never gave, goes back once to fix", async () => {
    const { lib } = await library();
    const web = searched([BRIT], "Hermann Ebbinghaus was born on January 24, 1850, in Barmen.");
    const reply = (passage: string, quote: string) => ({ web, out: { reply: "Born in 1850 [1].", citations: [{ passage, quote }], general: false, hint: false, steps: [], exercise: null, card: null } });
    fakeClaude([reply("https://en.wikipedia.org/wiki/Hermann_Ebbinghaus", "born on January 24, 1850"), reply(BRIT.url, "born on 24 January 1850 in Bonn"), reply(BRIT.url, "born on January 24, 1850")]);
    await expect(tutor(lib, "When was Ebbinghaus born?")).rejects.toThrow("is not in what the web search returned");
    expect(sent()).toHaveLength(2);
    expect(readFileSync(join(binDir, "msgs.jsonl"), "utf8")).toContain("is not a page your web search returned");
  });

  test("a quote of a page's title with quotes in it holds, though the search lists titles JSON-escaped", async () => {
    const { lib } = await library();
    const page = { url: "https://www.hackster.io/news/python-3-8-walrus", title: 'Python 3.8 Brings "Walrus Operator," Standardizes ABI' };
    fakeClaude([{ web: searched([page], "Python 3.8 added assignment expressions."), out: { reply: "Python 3.8 [1].", steps: [], citations: [{ passage: page.url, quote: page.title }], general: false, hint: false, exercise: null, card: null } }]);
    const r = await tutor(lib, "When did the walrus operator arrive?");
    expect(r.citations[0]).toMatchObject({ url: page.url, quote: page.title });
    expect(sent()).toHaveLength(1);
  });

  test("a quote is checked against its own page's results, and a link inside a fetched page isn't a page it returned", async () => {
    const { lib } = await library();
    const blog = { url: "https://blog.example.com/ebbinghaus", title: "A blog" };
    const web = [
      ...searched([BRIT], "Hermann Ebbinghaus was born on January 24, 1850."),
      { type: "assistant", message: { content: [{ type: "tool_use", id: "t2", name: "WebFetch", input: { url: blog.url } }] } },
      { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t2", content: "He was born in Barmen. More at [an archive](https://archive.example.org/eb)." }] } },
    ];
    const reply = (passage: string, quote: string) => ({ web, out: { reply: "Born in Barmen [1].", citations: [{ passage, quote }], general: false, hint: false, steps: [], exercise: null, card: null } });
    fakeClaude([reply(BRIT.url, "He was born in Barmen."), reply("https://archive.example.org/eb", "He was born in Barmen.")]);
    await expect(tutor(lib, "Where was Ebbinghaus born?")).rejects.toThrow("is not a page your web search returned (it returned https://www.britannica.com/biography/Hermann-Ebbinghaus, https://blog.example.com/ebbinghaus)");
    expect(readFileSync(join(binDir, "msgs.jsonl"), "utf8")).toContain("is not in what the web search returned for https://www.britannica.com");
    // The fetched page itself is citable, by its site alone: it has no title here.
    fakeClaude([reply(blog.url, "He was born in Barmen.")]);
    expect((await tutor(lib, "Where was Ebbinghaus born?")).citations[0]).toMatchObject({ url: blog.url, title: "", site: "blog.example.com" });
  });

  test("the reply so far is read out of half-written JSON, escapes and all; a half-cut escape waits", () => {
    expect(partialReply('{"rep')).toBeNull();
    expect(partialReply('{"reply": "Hel')).toBe("Hel");
    expect(partialReply('{"reply": "a\\nb\\')).toBe("a\nb");
    expect(partialReply('{"reply": "x \\u00')).toBe("x ");
    expect(partialReply('{"reply": "say \\"hi\\" [1]", "citations": [')).toBe('say "hi" [1]');
    expect(partialReply('{"reply": "C:\\\\u')).toBe("C:\\u"); // an escaped backslash, then a plain u
  });

  test("--stream: the reply comes as it is written, and a search says so as it starts", async () => {
    const { lib } = await library();
    const delta = (index: number, partial_json: string) => ({ type: "stream_event", event: { type: "content_block_delta", index, delta: { type: "input_json_delta", partial_json } } });
    const web = [
      { type: "stream_event", event: { type: "content_block_start", index: 0, content_block: { type: "tool_use", name: "WebSearch" } } },
      delta(0, '{"query": "reply"'), // the search's own input is not the reply
      { type: "stream_event", event: { type: "content_block_start", index: 1, content_block: { type: "tool_use", name: "StructuredOutput" } } },
      delta(1, '{"reply": "Your sources'), delta(1, ' don\'t say \\u00e'), delta(1, '9 [1'), delta(1, ']", "citations": []'),
    ];
    fakeClaude([{ web, out: { reply: "Your sources don't say é.", citations: [], general: true, hint: false, steps: [], exercise: null, card: null } }]);
    const seen: unknown[] = [];
    const r = await tutor(lib, "When was Ebbinghaus born?", { onProgress: (p) => seen.push(p) });
    // The run starts the answer over, then the search starts; the reply's first words come at once and
    // later ones a few times a second (these all came within 50 ms, so only the first shows).
    expect(seen).toEqual([{ reply: "" }, { searching: true }, { reply: "Your sources" }]);
    expect(r.reply).toBe("Your sources don't say é.");
    expect(readFileSync(join(binDir, "argv.json"), "utf8")).toContain("--include-partial-messages");
  });

  test("a retry after a failed check starts the streamed reply over, and a search's results end the search wait", async () => {
    const { lib } = await library();
    const run = (reply: string, citations: unknown[]) => ({
      web: [
        { type: "stream_event", event: { type: "content_block_start", index: 0, content_block: { type: "tool_use", name: "WebSearch" } } },
        { type: "user", message: { content: [] } },
        { type: "stream_event", event: { type: "message_start" } },
        { type: "stream_event", event: { type: "content_block_start", index: 0, content_block: { type: "tool_use", name: "StructuredOutput" } } },
        { type: "stream_event", event: { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: `{"reply": "${reply}"` } } },
      ],
      out: { reply, citations, general: true, hint: false, steps: [], exercise: null, card: null },
    });
    fakeClaude([run("Born in 1850 [1].", [{ passage: "https://made.up/page", quote: "1850" }]), run("Your sources don't say.", [])]);
    const seen: unknown[] = [];
    await tutor(lib, "When was Ebbinghaus born?", { onProgress: (p) => seen.push(p) });
    const twice = [{ reply: "" }, { searching: true }, { searching: false }];
    expect(seen).toEqual([...twice, { reply: "Born in 1850 [1]." }, ...twice, { reply: "Your sources don't say." }]);
  });

  test("a web citation with no search at all is refused: the link would be made up", async () => {
    const { lib } = await library();
    const out = { reply: "Born in 1850 [1].", citations: [{ passage: BRIT.url, quote: "born in 1850" }], general: false, hint: false, steps: [], exercise: null, card: null };
    fakeClaude([{ web: [], out }, { web: [], out }]);
    await expect(tutor(lib, "When was Ebbinghaus born?")).rejects.toThrow("is not a page your web search returned");
  });

  test("the tutor may search: its tools are web search and fetch, no file tools", async () => {
    const { lib } = await library();
    fakeClaude([{ reply: "Hi!", citations: [], general: false, hint: false, steps: [], exercise: null, card: null }]);
    await tutor(lib, "hello");
    const args = JSON.parse(readFileSync(join(binDir, "argv.json"), "utf8")) as string[];
    // Only the web tools: it is given its passages, so file tools would be input it never uses.
    expect(args[args.indexOf("--tools") + 1]).toBe("WebSearch,WebFetch");
    expect(args).toContain("stream-json");
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
    fakeClaude([{ reply: "Easier each time.", citations: [], general: false, hint: false, steps: [], exercise: null, card: null }]);
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
      { reply: "Look at what happens to a card you miss.", citations: [], general: false, hint: true, steps: [], exercise: null, card: null },
      { reply: "It goes back to box one [1].", citations: [{ passage: "P1", quote: "goes back to the first box" }], general: false, hint: false, steps: [], exercise: null, card: { ...card, rubric: [] } },
      { reply: "It goes back to box one [1].", citations: [{ passage: "P1", quote: "goes back to the first box" }], general: false, hint: false, steps: [], exercise: null, card },
    ]);
    expect(await tutor(lib, "what's the answer to my card about missed cards?", { item: a.meta.id })).toMatchObject({ hint: true, steps: [], exercise: null, card: null });
    const r = await tutor(lib, "show me the missed card answer", { item: a.meta.id });
    expect(r.card).toEqual(card);
    expect(readFileSync(join(binDir, "msgs.jsonl"), "utf8")).toContain("a prompt card needs 2 to 4 rubric points");
  });

  test("Show me's worked answer comes as steps, cited like the reply (D142); one step, or steps with a hint, go back to fix", async () => {
    const { lib, a } = await library();
    const steps = ["A card you miss is one you don't know yet [1].", "So it goes back where cards come up most often: box one."];
    fakeClaude([
      { reply: "Here's the working.", citations: [], general: false, hint: false, steps: [steps[0]!], exercise: null, card: null },
      { reply: "Here's the working.", citations: [{ passage: "P1", quote: "goes back to the first box" }], general: false, hint: true, steps, exercise: null, card: null },
      { reply: "Here's the working.", citations: [], general: false, hint: false, steps, exercise: null, card: null },
      { reply: "Here's the working.", citations: [{ passage: "P1", quote: "goes back to the first box" }], general: false, hint: false, steps, exercise: null, card: null },
      { reply: "Here's the working.", citations: [], general: false, hint: false, steps: Array(7).fill(steps[1]), exercise: null, card: null },
      { reply: "Here's the working.", citations: [], general: false, hint: false, steps: [steps[1]!, steps[1]!], exercise: null, card: null },
    ]);
    // A lone step: retried, and the retry's hint with steps is refused too (two tries, then it fails).
    await expect(tutor(lib, "show me the missed card answer", { item: a.meta.id })).rejects.toThrow();
    const msgs = readFileSync(join(binDir, "msgs.jsonl"), "utf8");
    expect(msgs).toContain("give 2 to 6 steps");
    // A marker in a step needs its citation, as one in the reply does.
    await expect(tutor(lib, "show me the missed card answer", { item: a.meta.id })).resolves.toMatchObject({ steps, citations: [{ n: 1, quote: "goes back to the first box" }] });
    expect(readFileSync(join(binDir, "msgs.jsonl"), "utf8")).toContain("marker [1] has no citation");
    // Seven steps is more than the 2 to 6 a worked answer gets: sent back.
    await expect(tutor(lib, "show me the missed card answer", { item: a.meta.id })).resolves.toMatchObject({ steps: [steps[1], steps[1]] });
    expect(readFileSync(join(binDir, "msgs.jsonl"), "utf8").split("give 2 to 6 steps").length).toBe(3);
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
  const key: TutorCard = { kind: "prompt", content_type: "concept", question: "In the Leitner system, why does a missed card go back to box one?", answer: "A miss means the memory is weak, so the card is seen again soonest.", rubric: ["A miss shows the memory is weak", "Box one is reviewed most often"] };
  const exercise = { heading: "Why does a missed card go back to box one?", prompts: ["What happens to it next", "Why that helps"], card: key };
  const out = (over: object) => ({ reply: "Explain why a missed card goes back to box one.", citations: [], general: false, hint: false, steps: [], exercise: null, card: null, ...over });

  test("Practice sets an open exercise with a heading for his note and the card committed with it; an exercise with a card, a heading that isn't a question, or a thin key goes back to fix", async () => {
    const { lib, a } = await library();
    const card: TutorCard = { kind: "card", content_type: "fact", question: "In the Leitner system, where does a missed card go?", answer: "Back to the first box.", rubric: [] };
    fakeClaude([out({ exercise, card }), out({ exercise })]);
    const r = await tutor(lib, "Practice", { item: a.meta.id });
    expect(r).toMatchObject({ exercise, card: null, hint: false });
    expect(readFileSync(join(binDir, "msgs.jsonl"), "utf8")).toContain("propose no card with it");
    fakeClaude([out({ exercise: { ...exercise, heading: "The Leitner system" } }), out({ exercise })]);
    await tutor(lib, "Practice", { item: a.meta.id });
    expect(readFileSync(join(binDir, "msgs.jsonl"), "utf8")).toContain("exercise.heading: the task as a short question");
    fakeClaude([out({ exercise: { ...exercise, card: { ...key, rubric: ["one"] } } }), out({ exercise })]);
    await tutor(lib, "Practice", { item: a.meta.id });
    expect(readFileSync(join(binDir, "msgs.jsonl"), "utf8")).toContain("exercise.card: a prompt card with 2 to 4 rubric points");
    expect(sent()[0]).not.toHaveProperty("exercise"); // nothing open yet
  });

  test("the open exercise reaches the tutor with its card, and feedback that finds a point missing offers that card, never one written after his answer (D158)", async () => {
    const { lib, a } = await library();
    const earlier = [{ message: "Practice", reply: "Explain why a missed card goes back to box one.", exercise }, { message: "wait, what's box one?", reply: "The box reviewed most often." }];
    const late: TutorCard = { kind: "card", content_type: "fact", question: "Where does a missed card go?", answer: "Box one.", rubric: [] };
    fakeClaude([
      out({ reply: "Right that it comes back sooner [1]. Missing: why box one. What does a miss say about the memory?", citations: [{ passage: "P1", quote: "goes back to the first box" }], covered: [false, true], card: late }),
      out({ reply: "Both points, nicely put. What about a card you get right?", covered: [true, true] }),
      out({ reply: "Both points.", covered: [true] }),
      out({ reply: "Both points.", covered: [true, true] }),
    ]);
    const r = await tutor(lib, "Because you see it again soon", { item: a.meta.id, earlier });
    expect(r.card).toEqual(key);
    const seen = sent()[0]!;
    expect(seen).toMatchObject({ exercise: { heading: exercise.heading, card: key } });
    expect(seen.earlier).toEqual([{ message: "Practice", reply: "Explain why a missed card goes back to box one." }, { message: "wait, what's box one?", reply: "The box reviewed most often." }]);
    expect((await tutor(lib, "A miss shows the memory is weak, and box one comes round most often", { item: a.meta.id, earlier })).card).toBeNull();
    expect((await tutor(lib, "Both", { item: a.meta.id, earlier })).card).toBeNull();
    expect(readFileSync(join(binDir, "msgs.jsonl"), "utf8")).toContain("covered: one boolean per rubric point (2)");
  });

  test("feedback marks each point of the committed card with the words of his that earned it; a quote he didn't write is dropped (D162)", async () => {
    const { lib, a } = await library();
    const earlier = [{ message: "Practice", reply: "Explain why a missed card goes back to box one.", exercise }];
    const answer = "A miss says the memory is weak, so it starts over";
    fakeClaude([
      out({ reply: "Good on weak memory.", covered: [true, false], evidence: ["the memory is weak"] }),
      out({ reply: "Good on weak memory.", covered: [true, false], evidence: ["the memory is weak", ""] }),
      out({ reply: "Both.", covered: [true, true], evidence: ["the memory is   WEAK", "reviewed most often"] }),
    ]);
    const r = await tutor(lib, answer, { item: a.meta.id, earlier });
    expect(readFileSync(join(binDir, "msgs.jsonl"), "utf8")).toContain("evidence: one per rubric point (2)");
    expect(r.marks).toEqual([{ point: key.rubric[0]!, covered: true, quote: "the memory is weak" }, { point: key.rubric[1]!, covered: false, quote: "" }]);
    // Case and spacing are folded as Review's grader does; a quote that isn't in his answer marks nothing.
    expect((await tutor(lib, answer, { item: a.meta.id, earlier })).marks).toEqual([{ point: key.rubric[0]!, covered: true, quote: "the memory is weak" }, { point: key.rubric[1]!, covered: true, quote: "" }]);
  });

  test("a reply with no open exercise has no marks", async () => {
    const { lib, a } = await library();
    fakeClaude([out({ reply: "Hello." })]);
    expect((await tutor(lib, "hi", { item: a.meta.id })).marks).toEqual([]);
  });

  test("a tell apart carries its two cases for the app to set side by side; one case, or three, go back to fix (D163)", async () => {
    const { lib, a } = await library();
    const cases = ["Ana reviews a card the day after she misses it.", "Ben reviews a card a week after he gets it right."];
    const apart = { ...exercise, heading: "Which idea fits each case, and what decides it?", cases };
    fakeClaude([out({ exercise: { ...apart, cases: [cases[0]] } }), out({ exercise: apart })]);
    expect((await tutor(lib, "Practice", { item: a.meta.id })).exercise).toEqual(apart);
    expect(readFileSync(join(binDir, "msgs.jsonl"), "utf8")).toContain("exercise.cases: a tell apart's two cases, each in full");
    // Sent back with the turn, the cases are part of the exercise it judges against.
    fakeClaude([out({ reply: "Both right.", covered: [true, true], evidence: ["", ""] })]);
    await tutor(lib, "A: box one. B: a later box.", { item: a.meta.id, earlier: [{ message: "Practice", reply: "Tell these apart.", exercise: apart }] });
    expect(sent().at(-1)).toMatchObject({ exercise: { heading: apart.heading, card: key } });
  });

  test("covered marks with no open exercise go back to fix", async () => {
    const { lib, a } = await library();
    fakeClaude([out({ reply: "Good.", covered: [true] }), out({ reply: "Good." })]);
    expect((await tutor(lib, "Box one", { item: a.meta.id, earlier: [{ message: "hi", reply: "hello" }] })).card).toBeNull();
    expect(readFileSync(join(binDir, "msgs.jsonl"), "utf8")).toContain("covered: [] when there is no open exercise");
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
    fakeClaude([{ reply: "Right: a miss sends it back.", citations: [], general: false, hint: false, steps: [], exercise: null, card: null }]);
    await tutor(lib, "My answer:\n\n![Diagram](diagrams/boxes.excalidraw)\n\n![Diagram](diagrams/nothing.excalidraw)", { item: a.meta.id });
    const m = sent()[0]!.message;
    expect(m).toContain("[Diagram he drew:\n- Missed card\n- Box one\n- Missed card → Box one (goes back)\n]");
    expect(m).toContain("![Diagram](diagrams/nothing.excalidraw)");
  });
});
