import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Citation } from "../src/ai/ask.ts";
import { addTutorCard, partialReply, tutor, tutorPassages, type TutorCard } from "../src/ai/tutor.ts";
import { attachToChat } from "../src/chats.ts";
import { sceneOutline, setDiagram } from "../src/diagrams.ts";
import { findCard, writeCardMeta, writeNewCard } from "../src/cards.ts";
import { addHighlight } from "../src/annotations.ts";
import { recordReview } from "../src/study.ts";
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
// A long message comes on stdin, as the real one takes it; a short one is the argument after -p.
const arg = process.argv[process.argv.indexOf("-p") + 1];
fs.appendFileSync(dir + "/msgs.jsonl", JSON.stringify(arg.startsWith("--") ? fs.readFileSync(0, "utf8") : arg) + "\\n");
fs.writeFileSync(dir + "/argv.json", JSON.stringify(process.argv));
fs.appendFileSync(dir + "/argvs.jsonl", JSON.stringify(process.argv) + "\\n");
fs.writeFileSync(dir + "/cwd", process.cwd());
// An entry { web: [events…], out } first prints those stream-json events (what its web search returned).
const q = JSON.parse(fs.readFileSync(dir + "/queue.json", "utf8"))[n];
// An entry { fail } is a run the program refuses, as claude 2.1.329 does a session it doesn't have: the reason
// on stderr, a result event that says only that it failed, exit 1.
if (q?.fail) { console.error(q.fail); console.log(JSON.stringify({ type: "result", subtype: "error_during_execution", is_error: true })); process.exit(1); }
for (const e of q?.web ?? []) console.log(JSON.stringify(e));
console.log(JSON.stringify({ type: "result", is_error: false, structured_output: q?.web ? q.out : q, modelUsage: { "claude-fake-1": { outputTokens: 5 } } }));
`);
  chmodSync(join(binDir, "claude"), 0o755);
}
type Sent = { message: string; reading?: { title: string; whole?: boolean; outline?: string[] }; earlier: unknown[]; passages: { id: string; source: string; heading: string; text: string }[] };
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

const OK = { reply: "Yes.", citations: [], general: false, hint: false, steps: [], exercise: null, card: null, title: "A chat" };

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

  test("files he attached reach the agent: this message's and the recent turns', by path, with the Read tool; a path outside chats/files is refused (D189)", async () => {
    const { lib } = await library();
    const png = await attachToChat(lib, { name: "chart.png", data: new Uint8Array([137, 80, 78, 71]) });
    const txt = await attachToChat(lib, { name: "notes.txt", data: new TextEncoder().encode("spacing") });
    const out = { reply: "It shows a forgetting curve.", citations: [], general: false, hint: false, steps: [], exercise: null, card: null, title: "A chart" };
    fakeClaude([out]);
    await tutor(lib, "what does this show?", { files: [png], earlier: [{ message: "see my notes", reply: "Read them.", files: [txt] }] });
    const m = JSON.parse(readFileSync(join(binDir, "msgs.jsonl"), "utf8").trim()) as string;
    const abs = (f: { path: string }) => join(lib.root, f.path);
    expect(m).toContain(`Files to read:\n- ${abs(txt)}\n- ${abs(png)}`);
    const input = sent()[0] as unknown as { attached: unknown; earlier: { attached?: unknown }[] };
    expect(input.attached).toEqual([{ name: "chart.png", file: abs(png) }]);
    expect(input.earlier[0]!.attached).toEqual([{ name: "notes.txt", file: abs(txt) }]);
    const argv = JSON.parse(readFileSync(join(binDir, "argv.json"), "utf8")) as string[];
    // F263: with a file attached the run could read any file on the Mac, and fetch web addresses too.
    // It reads the attached files and nothing else (D292): no search-the-disk tools, and it starts in chats/files.
    expect(argv[argv.indexOf("--tools") + 1]).toBe("Read,WebSearch,WebFetch");
    const real = (f: { path: string }) => realpathSync(abs(f));
    expect(argv.slice(argv.indexOf("--allowedTools") + 1, argv.indexOf("--permission-mode"))).toEqual([`Read(/${real(txt)})`, `Read(/${real(png)})`, "WebSearch", "WebFetch"]);
    expect(readFileSync(join(binDir, "cwd"), "utf8")).toBe(realpathSync(join(lib.root, "chats/files")));
    await expect(tutor(lib, "and this?", { files: [{ name: "x", path: "../secrets.txt" }] })).rejects.toThrow('no attached file "../secrets.txt"');
    // An earlier turn's file that is gone is left out, and the follow-up still goes.
    fakeClaude([out]);
    await tutor(lib, "go on", { earlier: [{ message: "see this", reply: "Seen.", files: [{ name: "gone.png", path: "chats/files/0000000000000000.png" }] }] });
    expect((sent().at(-1) as unknown as { earlier: { attached?: unknown }[] }).earlier[0]!.attached).toBeUndefined();
  });

  test("a message with no words from the source (\"what's this about?\") still gets its opening", async () => {
    const { lib, a } = await library();
    const ps = tutorPassages(lib, "summarize", { item: a.meta.id });
    expect(ps[0]).toMatchObject({ item: a.meta.id, heading: "Boxes", text: "Spaced repetition is a way to remember." });
  });
});

describe("tutor: replies", () => {
  // F-new-ask-archived
  test("the tutor retrieves and cites an archived source named in the question", async () => {
    const { lib, a } = await library();
    await setItemArchived(lib, a.meta.id, true);
    const quote = "A card you miss goes back to the first box.";
    fakeClaude([{ ...OK, reply: "Back to the first box [1].", citations: [{ passage: "P1", quote }] }]);

    const r = await tutor(lib, "In Flashcard boxes, where does a missed card go?");

    expect(sent()[0]!.passages[0]).toMatchObject({ id: "P1", source: "Flashcard boxes", heading: "The Leitner system" });
    expect(r.citations).toMatchObject([{ item: a.meta.id, title: "Flashcard boxes", quote }]);
  });

  // F261: "Summarize this", "What's this about?" and Practice got the open source's first 8 passages (16% of a 4,000-word article).
  test("the source he has open goes whole, in order, whatever his words: a summary or an exercise can draw on its end (D290)", async () => {
    const lib = await tempLibrary();
    const body = Array.from({ length: 30 }, (_, i) => `## Part ${i + 1}\n\n${`Section ${i + 1} explains idea number ${i + 1} in enough words to stand as a passage of its own, well past the forty that would join it to the one before, so every part is kept apart from its neighbours here. `.repeat(2)}`).join("\n\n");
    const a = await createItem(lib, { type: "article", title: "Thirty parts", body });
    await createItem(lib, { type: "article", title: "Elsewhere", body: "Summarize a text by naming its claim first." });
    for (const q of ["summarize this", "Practice", "idea number 3"]) {
      const ps = tutorPassages(lib, q, { item: a.meta.id });
      const own = ps.filter((p) => p.item === a.meta.id);
      expect(own.map((p) => p.heading)).toEqual(Array.from({ length: 30 }, (_, i) => `Part ${i + 1}`));
      expect(ps.slice(0, 30)).toEqual(own); // his source first, the library's after
    }
    expect(tutorPassages(lib, "summarize this", { item: a.meta.id }).some((p) => p.title === "Elsewhere")).toBe(true); // other sources still reach it
    fakeClaude([{ reply: "It covers thirty ideas.", citations: [], general: false, hint: false, steps: [], exercise: null, card: null, title: "Thirty parts" }]);
    await tutor(lib, "summarize this", { item: a.meta.id });
    expect(sent()[0]!.reading).toEqual({ title: "Thirty parts", whole: true });
  });

  test("a source too long to send whole says so: its headings as an outline, and passages from across it when his words match none", async () => {
    const lib = await tempLibrary();
    const part = (i: number) => `## Chapter ${i + 1}\n\n${`Chapter ${i + 1} sentence about topic${i + 1}. `.repeat(60)}`;
    const a = await createItem(lib, { type: "epub", title: "A long book", body: Array.from({ length: 60 }, (_, i) => part(i)).join("\n\n") });
    const ps = tutorPassages(lib, "summarize this", { item: a.meta.id });
    expect(ps.length).toBeLessThan(20);
    expect(ps[0]!.heading).toBe("Chapter 1");
    expect(ps.some((p) => +p.heading.slice(8) > 45)).toBe(true); // not only its opening
    expect(tutorPassages(lib, "topic37", { item: a.meta.id })[0]!.heading).toBe("Chapter 37"); // his words still pick the part
    fakeClaude([{ reply: "From the parts I can see, it runs to sixty chapters.", citations: [], general: false, hint: false, steps: [], exercise: null, card: null, title: "A long book" }]);
    await tutor(lib, "summarize this", { item: a.meta.id });
    const r = sent()[0]!.reading as { title: string; whole: boolean; outline: string[] };
    expect(r.whole).toBe(false);
    expect(r.outline.slice(0, 2)).toEqual(["Chapter 1", "Chapter 2"]);
    expect(r.outline).toHaveLength(60);
  });

  test("cites the open source, placed in its doc.md, and sends the title he is reading", async () => {
    const { lib, a } = await library();
    fakeClaude([{ reply: "It drops back to box one [1].", citations: [{ passage: "P2", quote: "A card you miss goes back to the first box." }], general: false, hint: false, steps: [], exercise: null, card: null }]);
    const r = await tutor(lib, "what happens to a card I miss?", { item: a.meta.id });
    expect(r.ai).toEqual({ vendor: "claude", model: "claude-fake-1", prompt_version: "tutor@17" });
    expect(r.general).toBe(false);
    const c = r.citations[0] as Citation;
    expect(c).toMatchObject({ n: 1, item: a.meta.id, heading: "The Leitner system" });
    expect(findItem(lib, a.meta.id).body.slice(c.start, c.end)).toBe("A card you miss goes back to the first box.");
    expect(sent()[0]!.reading).toEqual({ title: "Flashcard boxes", whole: true });
  });

  test("the first reply names the chat (D172); later ones don't rename it", async () => {
    const { lib, a } = await library();
    const out = (title: string) => ({ reply: "Box one.", citations: [], general: false, hint: false, steps: [], exercise: null, card: null, title });
    fakeClaude([out(" Leitner boxes "), out("Something else")]);
    expect((await tutor(lib, "Explain this simply", { item: a.meta.id })).title).toBe("Leitner boxes");
    expect((await tutor(lib, "and then?", { item: a.meta.id, earlier: [{ message: "Explain this simply", reply: "Box one." }] })).title).toBe("");
  });

  test("an over-long title is cut, never a reason to refuse the reply", async () => {
    const { lib, a } = await library();
    fakeClaude([{ reply: "Box one.", citations: [], general: false, hint: false, steps: [], exercise: null, card: null, title: "x".repeat(120) }]);
    expect((await tutor(lib, "boxes?", { item: a.meta.id })).title).toBe("x".repeat(80));
  });

  // F262: one quote a word off reran the whole turn (the reply on screen started over), and a second miss lost the answer to an error.
  test("a quote a few words off is moved to the sentence that says it, with no second run (D291)", async () => {
    const { lib, a } = await library();
    fakeClaude([{ reply: "Box one [1].", citations: [{ passage: "P2", quote: "A card you miss goes back to box one." }], general: false, hint: false, steps: [], exercise: null, card: null }]);
    const r = await tutor(lib, "missed card", { item: a.meta.id });
    expect(r.citations[0]!.quote).toBe("A card you miss goes back to the first box.");
    expect(r).toMatchObject({ reply: "Box one [1].", general: false, repaired: { moved: 1, dropped: 0 } });
    expect(readFileSync(join(binDir, "count"), "utf8")).toBe("1");
  });

  // Models often glue a marker to its word ("claim[1]"): one with its citation is a marker (repaired like any),
  // one with none (`arr[2]`) is the reply's own words and never fails the check.
  test("a marker glued to its word is renumbered with the rest; a glued [n] with no citation is left as written", async () => {
    const { lib, a } = await library();
    fakeClaude([{
      reply: "It goes to box one[1], every time[2]. Use arr[5] for the fifth.",
      citations: [{ passage: "P2", quote: "Leitner invented this in a Hamburg cellar." }, { passage: "P2", quote: "goes back to the first box" }],
      general: false, hint: false, steps: [], exercise: null, card: null,
    }]);
    const r = await tutor(lib, "missed card", { item: a.meta.id });
    expect(r.reply).toBe("It goes to box one, every time[1]. Use arr[5] for the fifth.");
    expect(readFileSync(join(binDir, "count"), "utf8")).toBe("1");
  });

  test("a made-up quote or passage loses its marker and the rest keep their order; the reply stays, marked as not from his sources", async () => {
    const { lib, a } = await library();
    fakeClaude([{
      reply: "It goes to box one [1], every time [2]. Reviewed again it gets easier [3].",
      citations: [{ passage: "P2", quote: "Leitner invented this in a Hamburg cellar." }, { passage: "P9", quote: "every time" }, { passage: "P2", quote: "goes back to the first box" }],
      general: false, hint: false, steps: ["Miss it [3].", "Box one [1]."], exercise: null, card: null,
    }]);
    const r = await tutor(lib, "missed card", { item: a.meta.id });
    expect(r.reply).toBe("It goes to box one, every time. Reviewed again it gets easier [1].");
    expect(r.steps).toEqual(["Miss it [1].", "Box one."]);
    expect(r.citations.map((c) => [c.n, c.quote])).toEqual([[1, "goes back to the first box"]]);
    expect(r).toMatchObject({ general: true, repaired: { moved: 0, dropped: 2 } });
    expect(readFileSync(join(binDir, "count"), "utf8")).toBe("1");
  });

  // Found by the review of #426, before it merged.
  test("a mended quote is a whole sentence across a decimal, and small words alone never make a quote real", async () => {
    const { nearestSentence } = await import("../src/ai/ask.ts");
    const text = "Version 2.5 of the scheduler improves recall by a wide margin over fixed intervals. It is the gap that matters, and that is the point.";
    expect(nearestSentence(text, "Version 2.5 of the scheduler improved recall by a wide margin")).toBe("Version 2.5 of the scheduler improves recall by a wide margin over fixed intervals.");
    expect(nearestSentence(text, "it is the tide that matters")).toBeNull();
  });

  test("dropping a citation leaves code and [0] in the reply alone", async () => {
    const { lib, a } = await library();
    fakeClaude([{ ...OK, reply: "Use `box[1]` or xs[0] for the first box [1], never the last [2].", citations: [{ passage: "P9", quote: "nothing like this is anywhere" }, { passage: "P2", quote: "A card you miss goes back to the first box." }] }]);
    const r = await tutor(lib, "Which box?", { item: a.meta.id });
    expect(r.reply).toBe("Use `box[1]` or xs[0] for the first box, never the last [1].");
  });

  test("an earlier turn with no reply, as an agent may send it, is read as an empty one", async () => {
    const { lib, a } = await library();
    fakeClaude([OK]);
    await tutor(lib, "And then?", { item: a.meta.id, earlier: [{ message: "hi" } as never] });
    expect(sent()[0]!.earlier).toEqual([{ message: "hi", reply: "" }]);
  });

  test("a long source's outline is its headings, never a # comment inside its code", async () => {
    const { lib } = await library();
    const { readingOf } = await import("../src/ai/tutor.ts");
    const long = await createItem(lib, { type: "article", title: "Shell", body: `# Shell\n\n\`\`\`sh\n# install deps\nmake\n\`\`\`\n\n## Pipes\n\n${"word ".repeat(15_100)}` });
    expect(readingOf(lib, long.meta.id).outline).toEqual(["Shell", "Pipes"]);
  });

  test("a marker with no citation still goes back once to fix", async () => {
    const { lib, a } = await library();
    fakeClaude([
      { reply: "Box one [1] [2].", citations: [{ passage: "P2", quote: "goes back to the first box" }], general: false, hint: false, steps: [], exercise: null, card: null },
      { reply: "Box one [1].", citations: [{ passage: "P2", quote: "goes back to the first box" }], general: false, hint: false, steps: [], exercise: null, card: null },
    ]);
    const r = await tutor(lib, "missed card", { item: a.meta.id });
    expect(readFileSync(join(binDir, "msgs.jsonl"), "utf8")).toContain("marker [2] has no citation");
    expect(r.citations[0]!.quote).toBe("goes back to the first box");
  });

  // F318: `xs[1]` in code was taken for a citation marker, so a plain reply went back to fix.
  test("an index in code or after a name is no citation marker: the reply is taken as it came", async () => {
    const { lib, a } = await library();
    const reply = "Use `xs[1]` for the second element, as in\n\n```py\nys[2] = xs[1]\n```\n\nand arr[3] the fourth.";
    fakeClaude([{ ...OK, reply, general: true }, { ...OK, reply: "Rewritten.", general: true }]);
    const r = await tutor(lib, "how do I index a list?", { item: a.meta.id });
    expect(r.reply).toBe(reply);
    expect(readFileSync(join(binDir, "msgs.jsonl"), "utf8")).not.toContain("has no citation");
  });

  // F264: only the last six turns reached the tutor, so a long chat lost what he had said he was after.
  test("a chat handed over whole keeps every turn, his words and the replies; only past 30,000 words do the oldest shrink to what he asked, a line each (D338)", async () => {
    const { lib } = await library();
    const out = { reply: "On it.", citations: [], general: false, hint: false, steps: [], exercise: null, card: null };
    const long = Array.from({ length: 20 }, (_, i) => ({ message: i ? `question ${i + 1}` : `I'm learning this for my exam on Friday. ${"So ".repeat(80)}`, reply: `answer ${i + 1} ${"word ".repeat(600)}` }));
    fakeClaude([out, out]);
    await tutor(lib, "and now?", { earlier: long });
    const first = sent()[0] as unknown as { earlier: unknown[]; before?: string[] };
    expect(first.earlier).toEqual(long); // 12,000 words: all of it, where 3,000 used to be the cut
    expect(first.before).toBeUndefined();
    // Short words: the whole message is one argument, and Linux caps one at 128 KB.
    const huge = long.map((t, i) => ({ ...t, reply: `answer ${i + 1} ${"a ".repeat(2000)}` }));
    await tutor(lib, "and now?", { earlier: huge });
    const second = sent()[1] as unknown as { earlier: { message: string }[]; before: string[] };
    expect(second.earlier.map((t) => t.message)).toEqual(huge.slice(-14).map((t) => t.message));
    expect(second.before).toHaveLength(6);
    expect(second.before[0]).toBe(`${huge[0]!.message.slice(0, 120).trimEnd()}…`);
    expect(second.before[5]).toBe("question 6");
  });

  test("it is told where he is, what he marked and what he last missed, so \"this part\" and Practice aim there (D294)", async () => {
    const { lib, a, c } = await library();
    addHighlight(findItem(lib, a.meta.id), { exact: "A card you miss goes back to the first box.", intent: "card", note: "why the first?" });
    addHighlight(findItem(lib, a.meta.id), { exact: "Spaced repetition is a way to remember.", intent: "keep" });
    addHighlight(findItem(lib, c.meta.id), { exact: "Knead the dough", intent: "keep" }); // another source's: not sent
    const card = (item: string, question: string) => writeNewCard(lib, { kind: "card", item, skills: [], topics: [], content_type: "fact", question, answer: "x", rubric: [] });
    const missed = card(a.meta.id, "Where does a missed card go?");
    const got = card(a.meta.id, "What moves a card up a box?");
    const mended = card(a.meta.id, "How often is box one reviewed?");
    const other = card(c.meta.id, "How long do you knead?");
    for (const x of [missed, got, mended, other]) writeCardMeta(findCard(lib, x.meta.id), { ...x.meta, state: "live" });
    await recordReview(lib, missed.meta.id, { rating: 1, confidence: 2 });
    await recordReview(lib, got.meta.id, { rating: 3, confidence: 2 });
    await recordReview(lib, mended.meta.id, { rating: 1, confidence: 2 });
    await Bun.sleep(3); // two reviews of one card in the same millisecond read as one
    await recordReview(lib, mended.meta.id, { rating: 3, confidence: 2 }); // missed, then got: no longer a miss
    await recordReview(lib, other.meta.id, { rating: 1, confidence: 2 });
    fakeClaude([{ reply: "Here.", citations: [], general: false, hint: false, steps: [], exercise: null, card: null }]);
    await tutor(lib, "Practice", { item: a.meta.id, at: "The Leitner system" });
    const input = sent()[0] as unknown as { reading: unknown; missed: unknown };
    expect(input.reading).toEqual({
      title: "Flashcard boxes", whole: true, at: "The Leitner system",
      marked: [{ text: "Spaced repetition is a way to remember." }, { text: "A card you miss goes back to the first box.", key: true, note: "why the first?" }],
    });
    expect(input.missed).toEqual(["Where does a missed card go?"]);
  });

  test("each turn leaves a line in the library's logs: how long it took, whether it went back, what was mended, or why it failed (D295)", async () => {
    const { lib, a } = await library();
    const ok = { reply: "Box one [1].", citations: [{ passage: "P2", quote: "A card you miss goes back to box one." }], general: false, hint: false, steps: [], exercise: null, card: null };
    fakeClaude([{ ...ok, reply: "Box one [1] [2]." }, ok, { nope: true }, { nope: true }]);
    await tutor(lib, "missed card", { item: a.meta.id });
    await expect(tutor(lib, "and then?", { item: a.meta.id })).rejects.toThrow("invalid tutor output twice");
    const lines = readFileSync(join(lib.root, ".ore/logs/tutor.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ runs: 2, searched: false, moved: 1, dropped: 0, model: "claude-fake-1", prompt: "tutor@17" });
    expect(lines[0].ms).toBeGreaterThanOrEqual(0);
    expect(Date.parse(lines[0].ts)).not.toBeNaN();
    expect(lines[1].error).toContain("invalid tutor output twice");
    expect(JSON.stringify(lines)).not.toContain("missed card"); // what he wrote stays in the chat's own file
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
    fakeClaude([reply("https://en.wikipedia.org/wiki/Hermann_Ebbinghaus", "born on January 24, 1850"), reply(BRIT.url, "he died at Halle in 1909"), reply(BRIT.url, "born on January 24, 1850")]);
    await expect(tutor(lib, "When was Ebbinghaus born?")).rejects.toThrow("is not in what the web search returned");
    expect(sent()).toHaveLength(2);
    expect(readFileSync(join(binDir, "msgs.jsonl"), "utf8")).toContain("is not a page your web search returned");
  });

  // The retry's reason lists what the first run's search returned and asks for one of those; the retry
  // that cites one without searching again holds, since the search did return it.
  test("a retry may cite a page the first run's search returned", async () => {
    const { lib } = await library();
    const out = (passage: string) => ({ reply: "Born in 1850 [1].", citations: [{ passage, quote: "born on January 24, 1850" }], general: false, hint: false, steps: [], exercise: null, card: null });
    fakeClaude([{ web: searched([BRIT], "Hermann Ebbinghaus was born on January 24, 1850, in Barmen."), out: out("https://en.wikipedia.org/wiki/Hermann_Ebbinghaus") }, { web: [{ type: "system", subtype: "init", model: "claude-main-1" }], out: out(BRIT.url) }]);
    const r = await tutor(lib, "When was Ebbinghaus born?");
    expect(sent()).toHaveLength(2);
    expect(r.searched).toBe(true);
    expect(r.citations[0]).toMatchObject({ url: BRIT.url, title: BRIT.title, quote: "born on January 24, 1850" });
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
    expect(seen.filter((p) => !(p as object).hasOwnProperty("ai"))).toEqual([{ reply: "" }, { searching: true }, { reply: "Your sources" }]);
    // Who is answering comes first, so a reply stopped part way still records it (F186).
    expect(seen[0]).toMatchObject({ ai: { vendor: "claude", prompt_version: expect.stringMatching(/^tutor@\d+$/) } });
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
    expect(seen.slice(1)).toEqual([...twice, { reply: "Born in 1850 [1]." }, ...twice, { reply: "Your sources don't say." }]);
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

/** Each run's arguments, in order. */
const argvs = (): string[][] => readFileSync(join(binDir, "argvs.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const after = (argv: string[], flag: string) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);

// D338: a chat is one session of the vendor's own program, as Review's "Ask about this" always was (D61).
// Before, every message started a new run and sent the open source and the last 3,000 words again (D293).
describe("tutor: a chat he had elsewhere (D339)", () => {
  test("it goes whole where another source its length would go in parts: it is the history the tutor carries on from", async () => {
    const lib = await tempLibrary();
    const body = Array.from({ length: 400 }, (_, i) => `## Question ${i + 1}\n\n${"A reply about boxes of cards and when each comes back. ".repeat(4)}`).join("\n\n");
    const chat = await createItem(lib, { type: "article", title: "A chat", body, chat: "claude" });
    const long = await createItem(lib, { type: "article", title: "A long read", body });
    expect(body.split(/\s+/).length).toBeGreaterThan(15_000);
    const { readingOf } = await import("../src/ai/tutor.ts");
    expect(readingOf(lib, chat.meta.id).whole).toBe(true);
    expect(readingOf(lib, long.meta.id).whole).toBe(false);
    fakeClaude([OK]);
    await tutor(lib, "Where did we stop?", { item: chat.meta.id });
    const own = sent()[0]!.passages.filter((p) => p.source === "A chat");
    // From its first turn to its last, and long enough that it went in on stdin (F421).
    expect(own.map((p) => p.heading)).toContain("Question 1");
    expect(own.map((p) => p.heading)).toContain("Question 400");
    expect(argvs()[0]!.some((a) => a.includes("Where did we stop?"))).toBe(false);
  });
});

describe("tutor: one session per chat (D338)", () => {
  const T1 = { message: "What happens to a missed card?", reply: "Yes." };

  test("the first message starts a session; the next resumes it and sends only what is new: no source again, no earlier turns", async () => {
    const { lib, a } = await library();
    fakeClaude([OK, OK]);
    await tutor(lib, T1.message, { chat: "c1", item: a.meta.id });
    await tutor(lib, "And a right one?", { chat: "c1", item: a.meta.id, earlier: [T1] });
    const [one, two] = argvs();
    const id = after(one!, "--session-id");
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(one).not.toContain("--no-session-persistence");
    expect(after(two!, "--resume")).toBe(id);
    expect(two).not.toContain("--session-id");
    expect(sent()[0]!.passages.some((p) => p.source === "Flashcard boxes")).toBe(true);
    const next = sent()[1] as unknown as Partial<Sent>;
    expect(next.message).toBe("And a right one?");
    expect(next.earlier).toBeUndefined();
    expect(next.reading).toBeUndefined();
    expect((next.passages ?? []).some((p) => p.source === "Flashcard boxes")).toBe(false);
  });

  test("a passage sent in an earlier message keeps its number, so a later reply can cite it; new ones count on", async () => {
    const { lib, a, c } = await library();
    fakeClaude([OK]);
    await tutor(lib, T1.message, { chat: "c1", item: a.meta.id });
    const first = sent()[0]!.passages.map((p) => p.id);
    fakeClaude([{ ...OK, reply: "Back to box one [1]. Knead it [2].", citations: [{ passage: "P2", quote: "A card you miss goes back to the first box." }, { passage: `P${first.length + 1}`, quote: "Knead the dough for ten minutes." }] }]);
    const r = await tutor(lib, "And how long do I knead dough?", { chat: "c1", item: a.meta.id, earlier: [T1] });
    const more = sent().at(-1)!.passages;
    expect(more.map((p) => p.source)).toEqual(["Bread"]);
    expect(more[0]!.id).toBe(`P${first.length + 1}`);
    expect(r.citations.map((x) => (x as Citation).item)).toEqual([a.meta.id, c.meta.id]);
    expect(r.general).toBe(false);
  });

  test("a passage whose source was edited since is sent again as it now reads, under a new number", async () => {
    const { lib, a } = await library();
    fakeClaude([OK, OK]);
    await tutor(lib, T1.message, { chat: "c1", item: a.meta.id });
    const n = sent()[0]!.passages.length;
    const file = join(a.dir, "doc.md");
    writeFileSync(file, readFileSync(file, "utf8").replace("goes back to the first box", "goes back to box one"));
    await tutor(lib, "And a right one?", { chat: "c1", item: a.meta.id, earlier: [T1] });
    const again = sent()[1]!.passages.filter((p) => p.source === "Flashcard boxes");
    expect(again.map((p) => p.text).join(" ")).toContain("goes back to box one");
    expect(again.every((p) => Number(p.id.slice(1)) > n)).toBe(true);
  });

  test("where he is goes again only when it moved", async () => {
    const { lib, a } = await library();
    fakeClaude([OK, OK, OK]);
    await tutor(lib, T1.message, { chat: "c1", item: a.meta.id, at: "Boxes" });
    await tutor(lib, "two", { chat: "c1", item: a.meta.id, at: "Boxes", earlier: [T1] });
    await tutor(lib, "three", { chat: "c1", item: a.meta.id, at: "The Leitner system", earlier: [T1, { message: "two", reply: "Yes." }] });
    expect(sent()[0]!.reading).toMatchObject({ title: "Flashcard boxes", whole: true, at: "Boxes" });
    expect(sent()[1]!.reading).toBeUndefined();
    expect(sent()[2]!.reading).toEqual({ title: "Flashcard boxes", at: "The Leitner system" } as never);
  });

  test("a chat with no session here (another Mac's, or an old one) starts one from its saved turns, whole, with the source", async () => {
    const { lib, a } = await library();
    fakeClaude([OK]);
    await tutor(lib, "And a right one?", { chat: "c2", item: a.meta.id, earlier: [T1] });
    expect(after(argvs()[0]!, "--session-id")).toBeTruthy();
    expect(sent()[0]!.earlier).toEqual([T1]);
    expect(sent()[0]!.passages.some((p) => p.source === "Flashcard boxes")).toBe(true);
  });

  test("an edited message or Try again, where the saved turns no longer end as the session does, starts a new session from the saved turns", async () => {
    const { lib, a } = await library();
    fakeClaude([OK, OK, OK]);
    await tutor(lib, T1.message, { chat: "c1", item: a.meta.id });
    await tutor(lib, "And a right one?", { chat: "c1", item: a.meta.id, earlier: [T1] });
    await tutor(lib, "And a right one, in a word?", { chat: "c1", item: a.meta.id, earlier: [T1] });
    const [one, , three] = argvs();
    expect(after(three!, "--session-id")).toBeTruthy();
    expect(after(three!, "--session-id")).not.toBe(after(one!, "--session-id"));
    expect(sent()[2]!.earlier).toEqual([T1]);
  });

  test("a session the program no longer has is started again from the saved turns, in the same call", async () => {
    const { lib, a } = await library();
    fakeClaude([OK, { fail: "No conversation found with session ID: 0" }, { ...OK, reply: "Less often." }]);
    await tutor(lib, T1.message, { chat: "c1", item: a.meta.id });
    const r = await tutor(lib, "And a right one?", { chat: "c1", item: a.meta.id, earlier: [T1] });
    expect(r.reply).toBe("Less often.");
    const [, two, three] = argvs();
    expect(after(two!, "--resume")).toBeTruthy();
    expect(after(three!, "--session-id")).toBeTruthy();
    expect(sent()[2]!.earlier).toEqual([T1]);
  });

  test("a reply he swapped for another version, or a worked answer he has seen part of, is not what the session wrote: a new session starts from what is on screen", async () => {
    const { lib, a } = await library();
    fakeClaude([OK, OK]);
    await tutor(lib, T1.message, { chat: "c1", item: a.meta.id });
    const shown = { message: T1.message, reply: "An older version of the reply." };
    await tutor(lib, "Why did you say that?", { chat: "c1", item: a.meta.id, earlier: [shown] });
    expect(after(argvs()[1]!, "--session-id")).toBeTruthy();
    expect(sent()[1]!.earlier).toEqual([shown]);
  });

  test("what is no longer so is said: no section on screen goes as null, and a source with the same title is still another source", async () => {
    const { lib, a } = await library();
    const twin = await createItem(lib, { type: "article", title: "Flashcard boxes", body: "A different text about boxes of cards." });
    fakeClaude([OK, OK, OK]);
    await tutor(lib, T1.message, { chat: "c1", item: a.meta.id, at: "Boxes" });
    await tutor(lib, "two", { chat: "c1", item: a.meta.id, earlier: [T1] });
    await tutor(lib, "three", { chat: "c1", item: twin.meta.id, earlier: [T1, { message: "two", reply: "Yes." }] });
    expect(sent()[1]!.reading).toEqual({ title: "Flashcard boxes", at: null } as never);
    expect(sent()[2]!.reading).toMatchObject({ title: "Flashcard boxes", whole: true });
  });

  test("a message refused before it runs (an attached file that isn't here) leaves the session as it was", async () => {
    const { lib, a } = await library();
    fakeClaude([OK, OK]);
    await tutor(lib, T1.message, { chat: "c1", item: a.meta.id });
    await expect(tutor(lib, "And this?", { chat: "c1", item: a.meta.id, earlier: [T1], files: [{ name: "x.png", path: "gone.png" }] })).rejects.toThrow();
    await tutor(lib, "And a right one?", { chat: "c1", item: a.meta.id, earlier: [T1] });
    expect(argvs()).toHaveLength(2);
    expect(after(argvs()[1]!, "--resume")).toBeTruthy();
  });

  test("a reply refused twice is a failure, never a lost session, whatever words its reason quotes", async () => {
    const { lib, a } = await library();
    const bad = { ...OK, reply: "See [1].", citations: [{ passage: "http://session not found", quote: "x" }] };
    fakeClaude([OK, bad, bad, OK]);
    await tutor(lib, T1.message, { chat: "c1", item: a.meta.id });
    await expect(tutor(lib, "And a right one?", { chat: "c1", item: a.meta.id, earlier: [T1] })).rejects.toThrow("twice");
    expect(argvs()).toHaveLength(3);
  });

  test("a message that failed leaves no half turn behind: the next one starts a new session", async () => {
    const { lib, a } = await library();
    fakeClaude([OK, { fail: "overloaded" }, OK]);
    await tutor(lib, T1.message, { chat: "c1", item: a.meta.id });
    await expect(tutor(lib, "And a right one?", { chat: "c1", item: a.meta.id, earlier: [T1] })).rejects.toThrow("overloaded");
    await tutor(lib, "And a right one?", { chat: "c1", item: a.meta.id, earlier: [T1] });
    expect(after(argvs()[2]!, "--session-id")).toBeTruthy();
  });

  test("a reply that goes back to fix goes back in the same session, with the reason alone", async () => {
    const { lib, a } = await library();
    fakeClaude([{ ...OK, reply: "See [1]." }, OK]);
    await tutor(lib, T1.message, { chat: "c1", item: a.meta.id });
    const [one, two] = argvs();
    expect(after(two!, "--resume")).toBe(after(one!, "--session-id"));
    const again = readFileSync(join(binDir, "msgs.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as string)[1]!;
    expect(again).toContain("marker [1] has no citation");
    expect(again).not.toContain("Task input");
  });

  test("a web page an earlier message's search returned can be cited again", async () => {
    const { lib } = await library();
    const cite = { ...OK, reply: "He published it in 1885 [1].", citations: [{ passage: BRIT.url, quote: "published in 1885" }] };
    fakeClaude([{ web: searched([BRIT], "Ebbinghaus published in 1885."), out: cite }, { web: [], out: cite }]);
    const first = { message: "When did Ebbinghaus publish?", reply: cite.reply };
    await tutor(lib, first.message, { chat: "c1" });
    const r = await tutor(lib, "Which page said so?", { chat: "c1", earlier: [first] });
    expect(r.citations[0]).toMatchObject({ url: BRIT.url, title: BRIT.title });
  });

  test("with no chat named (an agent's one-off, the eval) nothing is kept: no session, everything sent", async () => {
    const { lib, a } = await library();
    fakeClaude([OK]);
    await tutor(lib, "And a right one?", { item: a.meta.id, earlier: [T1] });
    expect(argvs()[0]).toContain("--no-session-persistence");
    expect(sent()[0]!.earlier).toEqual([T1]);
  });

  test("on Codex the chat is a thread, picked up with `exec resume`", async () => {
    const { lib, a } = await library();
    writeFileSync(join(binDir, "codex"), `#!/usr/bin/env bun
const fs = require("fs");
fs.appendFileSync(${JSON.stringify(join(binDir, "argvs.jsonl"))}, JSON.stringify(process.argv) + "\\n");
console.log(JSON.stringify({ type: "thread.started", thread_id: "th-1" }));
fs.writeFileSync(process.argv[process.argv.indexOf("-o") + 1], ${JSON.stringify(JSON.stringify(OK))});
`);
    chmodSync(join(binDir, "codex"), 0o755);
    process.env.ORE_AI = "codex";
    await tutor(lib, T1.message, { chat: "c1", item: a.meta.id });
    await tutor(lib, "And a right one?", { chat: "c1", item: a.meta.id, earlier: [T1] });
    const [one, two] = argvs();
    expect(one).not.toContain("--ephemeral");
    expect(one).not.toContain("resume");
    expect(two!.slice(two!.indexOf("resume"), two!.indexOf("resume") + 2)).toEqual(["resume", "th-1"]);
    expect(two!.at(-1)).not.toContain("<instructions>");
    expect(two!.at(-1)).not.toContain("Flashcard boxes");
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
      { reply: "It goes back to box one [1].", citations: [{ passage: "P2", quote: "goes back to the first box" }], general: false, hint: false, steps: [], exercise: null, card: { ...card, rubric: [] } },
      { reply: "It goes back to box one [1].", citations: [{ passage: "P2", quote: "goes back to the first box" }], general: false, hint: false, steps: [], exercise: null, card },
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
      { reply: "Here's the working.", citations: [{ passage: "P2", quote: "goes back to the first box" }], general: false, hint: true, steps, exercise: null, card: null },
      { reply: "Here's the working.", citations: [], general: false, hint: false, steps, exercise: null, card: null },
      { reply: "Here's the working.", citations: [{ passage: "P2", quote: "goes back to the first box" }], general: false, hint: false, steps, exercise: null, card: null },
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
      out({ reply: "Right that it comes back sooner [1]. Missing: why box one. What does a miss say about the memory?", citations: [{ passage: "P2", quote: "goes back to the first box" }], covered: [false, true], evidence: ["", "you see it again soon"], card: late }),
      out({ reply: "Both points, nicely put. What about a card you get right?", covered: [true, true], evidence: ["memory is weak", "comes round most often"] }),
      out({ reply: "Both points.", covered: [true], evidence: ["Both"] }),
      out({ reply: "Both points.", covered: [true, true], evidence: ["", ""] }),
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
    fakeClaude([out({ reply: "Good.", covered: [true], evidence: [""] }), out({ reply: "Good." })]);
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

describe("tutor on Codex (D297)", () => {
  // The lines `codex exec --json` printed on Tyler's Mac (0.167.0, 2026-11-15): a search starts with no query, ends
  // with each result's title and snippet, and the reply comes whole in the last-message file, never in pieces.
  test("a web search shows while it runs, counts as searched, and its result names the page cited", async () => {
    const { lib } = await library();
    const url = "https://example.org/ebbinghaus";
    const events = [
      { type: "thread.started", thread_id: "t" },
      { type: "item.started", item: { id: "s1", type: "web_search", query: "", action: { type: "other" } } },
      { type: "item.completed", item: { id: "s1", type: "web_search", query: "ebbinghaus", results: [{ type: "text_result", domain: "example.org", snippet: "He ran the tests on himself.", title: "Hermann Ebbinghaus", url }] } },
      { type: "turn.completed", usage: { input_tokens: 9, output_tokens: 3 } },
    ];
    // The quote is from the page itself, not the snippet: codex never reports the page's text, so it is not held to it.
    const out = { title: "Ebbinghaus", reply: "He published it in 1885 [1].", citations: [{ passage: url, quote: "published in 1885" }], general: false, hint: false, exercise: null, card: null, steps: [] };
    writeFileSync(join(binDir, "codex"), `#!/usr/bin/env bun
const fs = require("fs");
for (const e of ${JSON.stringify(events)}) console.log(JSON.stringify(e));
fs.writeFileSync(process.argv[process.argv.indexOf("-o") + 1], ${JSON.stringify(JSON.stringify(out))});
`);
    chmodSync(join(binDir, "codex"), 0o755);
    process.env.ORE_AI = "codex";
    const seen: unknown[] = [];
    const r = await tutor(lib, "When did Ebbinghaus publish?", { onProgress: (p) => seen.push(p) });
    expect(seen.filter((p) => "searching" in (p as object))).toEqual([{ searching: true }, { searching: false }]);
    expect(r.searched).toBe(true);
    expect(r.citations[0]).toMatchObject({ title: "Hermann Ebbinghaus" });
  });

  test("a retry on Codex still holds a web quote to nothing more than its link", async () => {
    const { lib } = await library();
    const url = "https://example.org/ebbinghaus";
    const search = { type: "item.completed", item: { id: "s1", type: "web_search", query: "e", results: [{ snippet: "He ran the tests on himself.", title: "Hermann Ebbinghaus", url }] } };
    const out = { title: "E", reply: "He published it in 1885 [1].", citations: [{ passage: url, quote: "published in 1885" }], general: false, hint: false, exercise: null, card: null, steps: [] };
    // The first run's reply has one step, which goes back; the second is right.
    writeFileSync(join(binDir, "n"), "0");
    writeFileSync(join(binDir, "codex"), `#!/usr/bin/env bun
const fs = require("fs");
const n = Number(fs.readFileSync(${JSON.stringify(join(binDir, "n"))}, "utf8"));
fs.writeFileSync(${JSON.stringify(join(binDir, "n"))}, String(n + 1));
console.log(${JSON.stringify(JSON.stringify(search))});
const out = ${JSON.stringify(out)};
fs.writeFileSync(process.argv[process.argv.indexOf("-o") + 1], JSON.stringify(n ? out : { ...out, steps: ["one"] }));
`);
    chmodSync(join(binDir, "codex"), 0o755);
    process.env.ORE_AI = "codex";
    const r = await tutor(lib, "When did Ebbinghaus publish?");
    expect(r.reply).toBe("He published it in 1885 [1].");
  });
});
