import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { runAgent, runChatTurn, vendorFailure } from "../src/ai/adapter.ts";
import { aiModel, listModels, parseCodexModels, savedModel, setAiModel } from "../src/ai/models.ts";
import { askAboutCard } from "../src/ai/chat.ts";
import { explainTerm, paragraphAt } from "../src/ai/explain.ts";
import { research } from "../src/ai/research.ts";
import { enrichError, enrichItem, needsEnrich, pendingHighlights, pendingItems, pendingPrequestions } from "../src/ai/enrich.ts";
import { chapterRecallFeedback, recallFeedback } from "../src/ai/recall.ts";
import { anchorEvidence, checkPrequestion, finishScope, scopeFinish, setCovered, writeKeyPoints } from "../src/ai/check.ts";
import { addHighlight, addPoint, findAnnotation, readAnnotations, reviseAnnotation } from "../src/annotations.ts";
import { markTried } from "../src/tries.ts";
import { listCards, writeNewCard } from "../src/cards.ts";
import { addSnippet } from "../src/ingest/index.ts";
import { sha256 } from "../src/fsutil.ts";
import { createItem, findItem, setItemStatus, setPrequestionAttempt, updateItemMeta } from "../src/items.ts";
import { appendNote, setChapterRecall, setNotes, setRecall } from "../src/notes.ts";
import { acceptSuggestedSkill, addSkill, archiveSkill, dismissSuggestedSkill, loadSkills, setItemSkills, undoSuggestedSkill } from "../src/skills.ts";
import { readTopic } from "../src/topics.ts";
import { tempLibrary } from "./helpers.ts";

// A fake `claude` on PATH that replays canned structured outputs in order.
let binDir = "";
const savedPath = process.env.PATH;
function fakeClaude(outputs: unknown[]) {
  const queue = join(binDir, "queue.json");
  writeFileSync(queue, JSON.stringify(outputs));
  writeFileSync(join(binDir, "count"), "0");
  const script = `#!/usr/bin/env bun
const fs = require("fs");
const dir = ${JSON.stringify(binDir)};
const n = Number(fs.readFileSync(dir + "/count", "utf8"));
fs.writeFileSync(dir + "/count", String(n + 1));
fs.appendFileSync(dir + "/args.jsonl", JSON.stringify(process.argv.slice(2)) + "\\n");
const out = JSON.parse(fs.readFileSync(dir + "/queue.json", "utf8"))[n];
if (fs.existsSync(dir + "/while.js")) require(dir + "/while.js"); // what happens in the library while the AI runs
console.log(JSON.stringify({ type: "result", is_error: false, structured_output: out, modelUsage: { "claude-fake-1": { outputTokens: 10 } } }));
`;
  writeFileSync(join(binDir, "claude"), script);
  chmodSync(join(binDir, "claude"), 0o755);
}
const calls = () => Number(readFileSync(join(binDir, "count"), "utf8"));

beforeEach(() => {
  binDir = mkdtempSync(join(tmpdir(), "ore-fakebin-"));
  process.env.PATH = `${binDir}:${savedPath}`;
  process.env.ORE_AI = "claude";
});
afterEach(() => {
  process.env.PATH = savedPath;
  delete process.env.ORE_AI;
});

const Schema = z.strictObject({ rating: z.number().int().min(1).max(4) });

describe("Ask about this (D61)", () => {
  test("the first turn sends the card, his answer and the passage under a new session; a follow-up resumes it", async () => {
    const lib = await tempLibrary();
    const { item, annotation } = await addSnippet(lib, { text: "Retrieval practice changes what is stored." });
    const card = writeNewCard(lib, { kind: "prompt", item: item.meta.id, annotation: annotation.id, skills: [], topics: ["t"], content_type: "concept", question: "Why test yourself?", answer: "Recall changes memory.", rubric: ["Recall is learning"] });
    fakeClaude([{ reply: "Because recall rewrites.", card: null }, { reply: "Try this.", card: { question: "What does recall do?", answer: "Strengthens it." } }]);
    const first = await askAboutCard(lib, card.meta.id, { message: "Why?", answer: "effort" });
    expect(first).toMatchObject({ reply: "Because recall rewrites.", proposal: null, ai: { vendor: "claude", prompt_version: "chat@2" } });
    const next = await askAboutCard(lib, card.meta.id, { message: "Clearer card?", session: first.session });
    expect(next.proposal).toEqual({ question: "What does recall do?", answer: "Strengthens it." });
    const [a, b] = readFileSync(join(binDir, "args.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as string[]);
    expect(a![1]).toContain("Retrieval practice changes what is stored.");
    expect(a![1]).toContain("effort");
    expect(a![a!.indexOf("--session-id") + 1]).toBe(first.session);
    expect(b![1]).toBe("Clearer card?");
    expect(b![b!.indexOf("--resume") + 1]).toBe(first.session);
  });
});

describe("AI adapter", () => {
  test("invalid output is retried once, then accepted; stamp records vendor/model/prompt version", async () => {
    const lib = await tempLibrary();
    fakeClaude([{ rating: 9 }, { rating: 3 }]);
    const r = await runAgent(lib, { prompt: "grade", cwd: lib.root, schema: Schema, input: {} });
    expect(r.data.rating).toBe(3);
    expect(r.ai).toEqual({ vendor: "claude", model: "claude-fake-1", prompt_version: "grade@4" });
    expect(calls()).toBe(2);
    const second = JSON.parse(readFileSync(join(binDir, "args.jsonl"), "utf8").trim().split("\n")[1]!) as string[];
    expect(second[1]).toContain("previous output was invalid");
  });

  test("a vendor failure shows its reason, not a raw event line, and says what to do next", () => {
    const run = { stderr: "", code: 1, timedOut: false };
    const codex = vendorFailure("codex", { ...run, stdout: '{"type":"thread.started","thread_id":"t"}\n{"type":"turn.failed","error":{"message":"401 Unauthorized"}}\n' });
    expect(codex.message).toBe("codex failed (exit 1): 401 Unauthorized. Run `codex login`, or pick Claude in Settings → AI.");
    expect(vendorFailure("codex", { ...run, stdout: '{"type":"error","message":"stream disconnected"}\n' }).message).toBe("codex failed (exit 1): stream disconnected");
    expect(vendorFailure("claude", { ...run, stdout: "" }).message).toBe("claude failed (exit 1) with no output");
    expect(vendorFailure("claude", { ...run, stdout: "", code: 143, timedOut: true }).message).toMatch(/took over 15 minutes and was stopped; try again/);
    // "log in" inside another word is no sign-in problem.
    expect(vendorFailure("codex", { ...run, stdout: '{"type":"error","message":"could not read the catalog index"}\n' }).message).toBe("codex failed (exit 1): could not read the catalog index");
    expect(vendorFailure("claude", { ...run, stdout: "", stderr: "Please log in again" }).message).toContain("/login");
  });

  test("claude runs without his MCP servers, skills or settings: on his Mac they added ~360k tokens to every call", async () => {
    const lib = await tempLibrary();
    fakeClaude([{ rating: 3 }, { reply: "ok", card: null }]);
    await runAgent(lib, { prompt: "grade", cwd: lib.root, schema: Schema, input: {} });
    await runChatTurn(lib, { system: "s", message: "m", schema: {}, cwd: lib.root });
    for (const line of readFileSync(join(binDir, "args.jsonl"), "utf8").trim().split("\n")) {
      const args = JSON.parse(line) as string[];
      expect(args).toContain("--strict-mcp-config");
      expect(args).toContain("--disable-slash-commands");
      expect(args[args.indexOf("--setting-sources") + 1]).toBe("");
    }
  });

  test("each vendor runs its own saved model: Sonnet by default for Claude, Codex's own default for Codex; ORE_AI_MODEL wins", async () => {
    const lib = await tempLibrary();
    const modelArg = () => {
      const args = JSON.parse(readFileSync(join(binDir, "args.jsonl"), "utf8").trim().split("\n").pop()!) as string[];
      return args[args.indexOf("--model") + 1];
    };
    fakeClaude([{ rating: 3 }]);
    await runAgent(lib, { prompt: "grade", cwd: lib.root, schema: Schema, input: {} });
    expect(modelArg()).toBe("sonnet");
    expect(aiModel(lib, "codex")).toBeUndefined();

    await setAiModel(lib, "claude", "opus");
    await setAiModel(lib, "codex", "gpt-6.1-sol");
    expect([savedModel(lib, "claude"), savedModel(lib, "codex")]).toEqual(["opus", "gpt-6.1-sol"]);
    fakeClaude([{ rating: 3 }]);
    await runAgent(lib, { prompt: "grade", cwd: lib.root, schema: Schema, input: {} });
    expect(modelArg()).toBe("opus");

    process.env.ORE_AI_MODEL = "haiku";
    try {
      expect(aiModel(lib, "claude")).toBe("haiku");
    } finally {
      delete process.env.ORE_AI_MODEL;
    }

    // Back to the defaults: the models block leaves skills.yaml, and his comments stay.
    await setAiModel(lib, "claude", "sonnet");
    await setAiModel(lib, "codex", "");
    const yaml = readFileSync(join(lib.root, "skills.yaml"), "utf8");
    expect(yaml).not.toContain("models:");
    expect(yaml).toContain("# Skills (D25)");
    await expect(setAiModel(lib, "claude", "not a model")).rejects.toThrow("isn’t a model name");
  });

  test("Codex's list is what its own picker shows, in its order, and a saved model it dropped stays pickable", async () => {
    const catalog = JSON.stringify({ models: [
      { slug: "b", display_name: "B", visibility: "list", priority: 2 },
      { slug: "hidden", display_name: "H", visibility: "hide", priority: 0 },
      { slug: "a", display_name: "A", description: "first", visibility: "list", priority: 1 },
    ] });
    expect(parseCodexModels(catalog)).toEqual([{ id: "a", label: "A", description: "first" }, { id: "b", label: "B" }]);
    writeFileSync(join(binDir, "codex"), `#!/bin/sh\necho '${catalog}'\n`);
    chmodSync(join(binDir, "codex"), 0o755);
    expect((await listModels("codex", "old-model")).map((m) => m.id)).toEqual(["", "a", "b", "old-model"]);
    expect((await listModels("claude")).map((m) => m.id)).toEqual(["sonnet", "opus", "fable", "haiku"]);
    expect(vendorFailure("claude", { stderr: "", code: 1, timedOut: false, stdout: "", }).message).not.toContain("model");
    expect(vendorFailure("codex", { stderr: "", code: 1, timedOut: false, stdout: '{"type":"error","message":"The model gpt-x does not exist"}\n' }).message).toContain("Pick another model in Settings → AI.");
  });

  test("two invalid outputs fail with a clear message", async () => {
    const lib = await tempLibrary();
    fakeClaude([{ nope: 1 }, { rating: 0 }]);
    await expect(runAgent(lib, { prompt: "grade", cwd: lib.root, schema: Schema, input: {} })).rejects.toThrow(/claude returned invalid grade output twice/);
  });

  test("a failed enrich leaves its reason for the reader until one succeeds", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Spacing beats massing." });
    fakeClaude([{ nope: 1 }, { nope: 2 }, { prequestions: ["Why space?", "Why not mass?"], skills: [], suggested_skill: { name: "Learning", hook: "" }, topics: [{ slug: "spacing", name: "Spacing", summary: "s" }], drafts: [] }]);
    await expect(enrichItem(lib, item.meta.id)).rejects.toThrow(/invalid enrich output twice/);
    expect(enrichError(lib, item.meta.id)).toMatch(/invalid enrich output twice/);
    await enrichItem(lib, item.meta.id);
    expect(enrichError(lib, item.meta.id)).toBeNull();
  });

  test("enrich writes prequestions, topics and draft cards from Card highlights only", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Workflows follow predefined code paths. Agents direct their own tool use. Keep it simple." });
    const it = findItem(lib, item.meta.id);
    const card = addHighlight(it, { exact: "Agents direct their own tool use.", intent: "card" });
    fakeClaude([
      {
        prequestions: ["When would a workflow beat an agent?", "What makes an agent different from a workflow?"],
        skills: ["ai"],
        suggested_skill: null,
        topics: [{ slug: "agent-workflows", name: "Agent workflows", summary: "How LLM systems are structured." }],
        drafts: [{ annotation: card.id, from_notes: false, prequestion: null, kind: "prompt", content_type: "concept", question: "In LLM system design, how does an agent differ from a workflow?", answer: "An agent decides its own steps and tool use; a workflow follows predefined code paths.", rubric: ["Agent directs its own process", "Workflow follows fixed paths"], topics: ["agent-workflows"] }],
      },
    ]);
    const r = await enrichItem(lib, item.meta.id);
    expect(r.prequestions).toHaveLength(2);
    expect(r.topics_created).toEqual(["agent-workflows"]);
    expect(readTopic(lib, "agent-workflows")!.meta.status).toBe("active");
    const after = findItem(lib, item.meta.id).meta;
    expect(after.enriched_at).toBeDefined();
    expect(after.ai).toEqual({ vendor: "claude", model: "claude-fake-1", prompt_version: "enrich@16" });
    const cards = listCards(lib);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.meta).toMatchObject({ state: "draft", kind: "prompt", annotation: card.id, topics: ["agent-workflows"], ai: after.ai });
    expect(cards[0]!.rubric).toHaveLength(2);
    // second run: nothing pending, no AI call
    const again = await enrichItem(lib, item.meta.id);
    expect(again.skipped).toBeDefined();
    expect(calls()).toBe(1);
  });

  test("a try checked off with how it went gets exactly one Explain card, with his plan and reflection sent (D127)", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Open on the moment of change. Then rewind to how we got there." });
    const t = addHighlight(findItem(lib, item.meta.id), { exact: "Open on the moment of change.", intent: "apply", note: "my next video" });
    await markTried(lib, t.id, { reflection: "Hooked people; the rewind ran long." });
    const prompt = { annotation: t.id, from_notes: false, prequestion: null, kind: "prompt", content_type: "procedure", question: "You're opening a talk on budgeting. How would you open it, and what would you watch for?", answer: "Start on the moment things changed, then rewind briefly.", rubric: ["Open on the change", "Keep the rewind short"], topics: [] };
    const out = (drafts: object[]) => ({ prequestions: ["Q one?", "Q two?"], skills: ["ai"], suggested_skill: null, topics: [{ slug: "openings", name: "Openings", summary: "" }], drafts });
    fakeClaude([out([]), out([prompt])]);
    const r = await enrichItem(lib, item.meta.id);
    expect(calls()).toBe(2);
    expect(r.cards.map((c) => [c.kind, c.annotation])).toEqual([["prompt", t.id]]);
    expect(readFileSync(join(binDir, "args.jsonl"), "utf8")).toContain("Hooked people; the rewind ran long.");
    expect(pendingHighlights(findItem(lib, item.meta.id), listCards(lib))).toEqual([]);
  });

  const enrichOut = (prequestions: string[], drafts: object[] = []) => ({
    prequestions, skills: ["ai"], suggested_skill: null, topics: [{ slug: "agent-workflows", name: "Agent workflows", summary: "" }], drafts,
  });
  const draft = (annotation: string) => ({ annotation, from_notes: false, prequestion: null, kind: "card", content_type: "fact", question: "In LLM agents, what directs tool use?", answer: "The agent itself.", rubric: [], topics: [] });

  test("D118: plain highlights wait for the finish, then the plan groups them; a key point is always covered", async () => {
    const lib = await tempLibrary();
    const text = "Three reasons we doubt forecasts. We think in straight lines. Recent history misleads. Experience makes us stubborn. Exponentials surprise us. Buy the PDF. Nobody saw it coming.";
    const id = (await createItem(lib, { type: "article", title: "Forecasts", body: text })).meta.id;
    await updateItemMeta(lib, id, (m) => ({ ...m, skills: ["ai"], enriched_at: "2026-10-25T00:00:00Z" }));
    const old = writeNewCard(lib, { kind: "card", item: "elsewhere", skills: ["ai"], topics: ["t"], content_type: "fact", question: "In AI, what is ANI?", answer: "Narrow AI.", rubric: [] });
    const hl = (exact: string, intent: "keep" | "card" = "keep") => addHighlight(findItem(lib, id), { exact, intent });
    const [lead, a, b, c] = ["Three reasons we doubt forecasts.", "We think in straight lines.", "Recent history misleads.", "Experience makes us stubborn."].map((t) => hl(t));
    const stray = hl("Buy the PDF.");
    // still reading: plain highlights are only signals for later, nothing to draft
    expect(pendingHighlights(findItem(lib, id), listCards(lib))).toEqual([]);
    expect(needsEnrich(findItem(lib, id), listCards(lib))).toBe(false);
    const key = hl("Exponentials surprise us.", "card");
    expect(pendingHighlights(findItem(lib, id), listCards(lib)).map((x) => x.id)).toEqual([key.id]);

    await setItemStatus(lib, id, "done");
    const ai = { vendor: "claude", model: "claude-fake-1", prompt_version: "recall-feedback@4" };
    await updateItemMeta(lib, id, (m) => ({ ...m, recall: { text: "lines", at: m.captured_at, feedback: { feedback: "ok", questions: [], missed: ["Experience makes us stubborn."], section_lines: null, ai } } }));
    expect(pendingHighlights(findItem(lib, id), listCards(lib))).toHaveLength(6);
    const group = { ...draft(lead!.id), kind: "prompt", content_type: "concept", question: "Why do people doubt bold forecasts?", answer: "Linear thinking, misleading recent history, stubborn experience.", rubric: ["Linear thinking", "Recent history", "Experience"], also: [a!.id, b!.id, c!.id] };
    fakeClaude([
      enrichOut(["Q1?", "Q2?"], [group]), // the key point isn't covered → retried
      enrichOut(["Q1?", "Q2?"], [{ ...group, also: [a!.id, b!.id, c!.id, key.id] }]),
    ]);
    await enrichItem(lib, id);
    expect(calls()).toBe(2);
    const sent = JSON.parse(inputOf(0).slice(inputOf(0).indexOf("{"), inputOf(0).lastIndexOf("}") + 1));
    expect(sent.highlights.map((h: { intent: string }) => h.intent).sort()).toEqual(["highlight", "highlight", "highlight", "highlight", "highlight", "key_point"]);
    expect(sent.skill_cards).toEqual([old.question]);
    expect(sent.missed).toEqual(["Experience makes us stubborn."]);
    expect(readFileSync(join(binDir, "args.jsonl"), "utf8").split("\n")[1]).toContain("every key point needs a draft");
    const made = listCards(lib).filter((x) => x.meta.item === id);
    expect(made.map((x) => [x.meta.annotation, x.meta.also])).toEqual([[lead!.id, [a!.id, b!.id, c!.id, key.id]]]);
    // the stray one was weighed and skipped: nothing is pending, so the plan never runs again for them
    expect(findItem(lib, id).meta.planned?.sort()).toEqual([lead, a, b, c, stray].map((x) => x!.id).sort());
    expect(needsEnrich(findItem(lib, id), listCards(lib))).toBe(false);
    // a highlight made after the plan is weighed next time
    const late = hl("Nobody saw it coming.");
    expect(pendingHighlights(findItem(lib, id), listCards(lib)).map((x) => x.id)).toEqual([late.id]);
  });

  test("D180: on a source he is still reading, plain highlights are planned once it has rested; prequestions wait for the finish", async () => {
    const lib = await tempLibrary();
    const text = "Three reasons we doubt forecasts. We think in straight lines. Recent history misleads. Experience makes us stubborn. Nobody saw it coming.";
    const id = (await createItem(lib, { type: "article", title: "Forecasts", body: text })).meta.id;
    await updateItemMeta(lib, id, (m) => ({ ...m, skills: ["ai"], enriched_at: "2026-10-25T00:00:00Z", prequestions: [{ q: "Why do forecasts miss?" }, { q: "What misleads us?" }] }));
    await setItemStatus(lib, id, "reading");
    const hl = (exact: string) => addHighlight(findItem(lib, id), { exact, intent: "keep" });
    const [lead, a, b] = ["Three reasons we doubt forecasts.", "We think in straight lines.", "Recent history misleads."].map(hl);
    const at = (h: number) => new Date(Date.now() + h * 3_600_000);
    const pending = (now: Date) => pendingHighlights(findItem(lib, id), listCards(lib), now).map((x) => x.id);
    // He may still be in that sitting: nothing to plan, and the day's catch-up leaves the source alone.
    expect(pending(at(5))).toEqual([]);
    expect(needsEnrich(findItem(lib, id), listCards(lib), at(5))).toBe(false);
    expect(pendingItems(lib, at(5))).toEqual([]);
    // Six hours with no new highlight: the plan weighs them, as it would at the finish.
    expect(pending(at(7)).sort()).toEqual([lead, a, b].map((x) => x!.id).sort());
    expect(pendingItems(lib, at(7)).map((i) => i.meta.id)).toEqual([id]);
    // An inbox source he never opened is not being read.
    await setItemStatus(lib, id, "inbox");
    expect(pending(at(7))).toEqual([]);
    await setItemStatus(lib, id, "reading");

    const group = { ...draft(lead!.id), kind: "prompt", content_type: "concept", question: "Why do people doubt bold forecasts?", answer: "Linear thinking and misleading recent history.", rubric: ["Linear thinking", "Recent history"], also: [a!.id, b!.id] };
    fakeClaude([enrichOut(["Q1?", "Q2?"], [group])]);
    const r = await enrichItem(lib, id, at(7));
    const sent = JSON.parse(inputOf(0).slice(inputOf(0).indexOf("{"), inputOf(0).lastIndexOf("}") + 1));
    expect(sent.highlights.map((h: { intent: string }) => h.intent)).toEqual(["highlight", "highlight", "highlight"]);
    // Still being answered: no review prompt from a prequestion before the finish.
    expect(sent.prequestions_to_draft).toEqual([]);
    expect(sent.plain_cap).toBe(5);
    expect(r.cards.map((c) => c.annotation)).toEqual([lead!.id]);
    expect(findItem(lib, id).meta.status).toBe("reading");
    expect(findItem(lib, id).meta.planned?.sort()).toEqual([lead, a, b].map((x) => x!.id).sort());
    expect(pending(at(7))).toEqual([]);
    // The next sitting's highlight waits its own rest, and holds nothing else back.
    const late = hl("Nobody saw it coming.");
    expect(pending(at(5))).toEqual([]);
    expect(pending(at(7))).toEqual([late.id]);
    // The finish still plans what is left and writes the prequestions' prompts.
    await setItemStatus(lib, id, "done");
    expect(pending(new Date())).toEqual([late.id]);
    expect(pendingPrequestions(findItem(lib, id), listCards(lib)).map((p) => p.n)).toEqual([1, 2]);
  });

  test("D118: more plain-only drafts than the cap are refused", async () => {
    const lib = await tempLibrary();
    const id = (await createItem(lib, { type: "article", title: "Six", body: "A one. B two. C three. D four. E five. F six." })).meta.id;
    await updateItemMeta(lib, id, (m) => ({ ...m, enriched_at: "2026-10-25T00:00:00Z" }));
    const ids = ["A one.", "B two.", "C three.", "D four.", "E five.", "F six."].map((t) => addHighlight(findItem(lib, id), { exact: t, intent: "keep" }).id);
    await setItemStatus(lib, id, "done");
    fakeClaude([enrichOut(["Q1?", "Q2?"], ids.map(draft)), enrichOut(["Q1?", "Q2?"], ids.slice(0, 2).map(draft))]);
    await enrichItem(lib, id);
    expect(readFileSync(join(binDir, "args.jsonl"), "utf8").split("\n")[1]).toContain("at most 5 drafts from plain highlights alone");
    expect(listCards(lib)).toHaveLength(2);
    expect(findItem(lib, id).meta.planned).toHaveLength(6);
  });

  test("D173: a Light source drafts at most 2 cards from plain highlights; archived skills aren't offered", async () => {
    const lib = await tempLibrary();
    const gtm = await addSkill(lib, "Go-to-market"); // new skills start Light
    await archiveSkill(lib, "habits", true);
    const id = (await createItem(lib, { type: "article", title: "Four", body: "A one. B two. C three. D four.", skills: [gtm.id] })).meta.id;
    await updateItemMeta(lib, id, (m) => ({ ...m, enriched_at: "2026-10-25T00:00:00Z" }));
    const ids = ["A one.", "B two.", "C three.", "D four."].map((t) => addHighlight(findItem(lib, id), { exact: t, intent: "keep" }).id);
    await setItemStatus(lib, id, "done");
    const out = (ds: object[]) => ({ ...enrichOut(["Q1?", "Q2?"], ds), skills: [gtm.id] });
    fakeClaude([out(ids.slice(0, 3).map(draft)), out(ids.slice(0, 2).map(draft))]);
    await enrichItem(lib, id);
    const lines = readFileSync(join(binDir, "args.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as string[]);
    const sent = JSON.parse(lines[0]![1]!.slice(lines[0]![1]!.indexOf("{"), lines[0]![1]!.lastIndexOf("}") + 1));
    expect(sent.plain_cap).toBe(2);
    expect(sent.skills.map((s: { id: string }) => s.id)).not.toContain("habits");
    expect(lines[1]!.join(" ")).toContain("at most 2 drafts from plain highlights alone");
    expect(listCards(lib)).toHaveLength(2);
  });

  test("enrich matches a new source to his open questions only with a quote it can find (D75)", async () => {
    const lib = await tempLibrary();
    const { annotation: q1 } = await addSnippet(lib, { text: "Do agents choose their own tools?", intent: "question", skills: ["ai"] });
    const { annotation: q2 } = await addSnippet(lib, { text: "Are workflows cheaper?", intent: "question", skills: ["ai"] });
    for (const id of [q1.item, q2.item]) await updateItemMeta(lib, id, (m) => ({ ...m, enriched_at: "2026-10-25T00:00:00Z" }));
    const { item } = await addSnippet(lib, { text: "Workflows follow predefined code paths. Agents direct their own tool use.", skills: ["ai"] });
    fakeClaude([{ ...enrichOut(["Q1?", "Q2?"]), question_matches: [{ question: q1.id, quote: "Agents direct their own tool use." }, { question: q2.id, quote: "Workflows cost half as much." }] }]);
    await enrichItem(lib, item.meta.id);
    const input = JSON.stringify(readFileSync(join(binDir, "args.jsonl"), "utf8"));
    expect(input).toContain(q1.id);
    expect(findItem(lib, item.meta.id).meta.question_matches).toEqual([{ question: q1.id, quote: "Agents direct their own tool use.", start: 40 }]);
  });

  test("Answered + card: enrich drafts one card from his answer", async () => {
    const lib = await tempLibrary();
    const { item, annotation: q } = await addSnippet(lib, { text: "Why space practice?", intent: "question" });
    await updateItemMeta(lib, item.meta.id, (m) => ({ ...m, enriched_at: "2026-10-25T00:00:00Z" }));
    const fresh = findItem(lib, item.meta.id);
    reviseAnnotation(fresh, q, { status: "done", card: true, answers: [{ ts: "2026-10-25T01:00:00Z", text: "Forgetting a little makes recall stronger." }] });
    fakeClaude([enrichOut(["Q1?", "Q2?"], [{ ...draft(q.id), question: "In learning, why space practice?", answer: "Forgetting a little makes recall stronger." }])]);
    await enrichItem(lib, item.meta.id);
    expect(readFileSync(join(binDir, "args.jsonl"), "utf8")).toContain("Forgetting a little makes recall stronger.");
    expect(listCards(lib).map((c) => [c.meta.annotation, c.answer])).toEqual([[q.id, "Forgetting a little makes recall stronger."]]);
  });

  test("Card here: a typed line is drafted from the whole source and keeps only quotes found in it; none at all is retried", async () => {
    const lib = await tempLibrary();
    const text = "The first reason is security. The second reason is modularity. The third reason is that language doesn't matter. Now let's code.";
    const { item } = await addSnippet(lib, { text });
    await updateItemMeta(lib, item.meta.id, (m) => ({ ...m, enriched_at: "2026-10-25T00:00:00Z" }));
    const p = addPoint(findItem(lib, item.meta.id), { at: text.indexOf("code"), note: "The 3 benefits of an API", intent: "card" });
    const pointDraft = (evidence: string[]) => ({ ...draft(p.id), kind: "prompt", content_type: "concept", question: "In web development, what are the three benefits of an API?", answer: "Security, modularity, language independence.", rubric: ["Security", "Modularity", "Language independence"], evidence });
    fakeClaude([
      enrichOut(["Q1?", "Q2?"], [pointDraft(["Invented sentence."])]),
      enrichOut(["Q1?", "Q2?"], [pointDraft(["The first reason is security.", "The second reason is modularity.", "Made up."])]),
    ]);
    await enrichItem(lib, item.meta.id);
    expect(calls()).toBe(2);
    const sent = readFileSync(join(binDir, "args.jsonl"), "utf8");
    expect(sent).toMatch(/point.{0,12}true/);
    const [c] = listCards(lib);
    expect(c!.meta.annotation).toBe(p.id);
    expect(c!.meta.evidence!.map((e) => e.exact)).toEqual(["The first reason is security.", "The second reason is modularity."]);
    expect(text.slice(c!.meta.evidence![1]!.start, c!.meta.evidence![1]!.end)).toBe("The second reason is modularity.");
  });

  test("enrich keeps prequestion attempts and recall; never regenerates attempted prequestions", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Workflows follow predefined code paths. Agents direct their own tool use." });
    fakeClaude([enrichOut(["Q1?", "Q2?"])]);
    await enrichItem(lib, item.meta.id);
    await setPrequestionAttempt(lib, item.meta.id, 1, { before: "no idea" });
    await setPrequestionAttempt(lib, item.meta.id, 2, { after: "fixed paths" });
    await setRecall(lib, item.meta.id, "agents choose");
    const expected = [{ q: "Q1?", before: "no idea" }, { q: "Q2?", after: "fixed paths" }];
    // later run drafting from a new Card highlight
    const key = addHighlight(findItem(lib, item.meta.id), { exact: "Agents direct their own tool use.", intent: "card" });
    fakeClaude([enrichOut(["NEW1?", "NEW2?"], [draft(key.id)]), enrichOut(["NEW3?", "NEW4?"])]);
    expect((await enrichItem(lib, item.meta.id)).prequestions).toEqual(["Q1?", "Q2?"]);
    expect(findItem(lib, item.meta.id).meta.prequestions).toEqual(expected);
    expect(findItem(lib, item.meta.id).meta.recall?.text).toBe("agents choose");
    // a forced first run (enriched_at cleared) still keeps attempted prequestions
    await updateItemMeta(lib, item.meta.id, (m) => ({ ...m, enriched_at: undefined }));
    await enrichItem(lib, item.meta.id);
    expect(findItem(lib, item.meta.id).meta.prequestions).toEqual(expected);
    expect(calls()).toBe(2);
  });

  test("recall feedback: needs recall or after-answers; stores feedback with ai stamp", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Workflows follow predefined code paths. Agents direct their own tool use." });
    const id = item.meta.id;
    await updateItemMeta(lib, id, (m) => ({ ...m, prequestions: [{ q: "Q1?" }, { q: "Q2?" }, { q: "Q3?" }] }));
    await setPrequestionAttempt(lib, id, 1, { before: "no idea" });
    await expect(recallFeedback(lib, id)).rejects.toThrow(/nothing to give feedback on/);
    await setPrequestionAttempt(lib, id, 2, { after: "agents pick tools" });
    await setRecall(lib, id, "Workflows are fixed.");
    const out = { feedback: "You have the workflow half right.", questions: [{ n: 1, feedback: "Now you know." }, { n: 2, feedback: "Right." }], missed: ["Agents direct their own process."], section_lines: null };
    fakeClaude([{ ...out, questions: [{ n: 3, feedback: "unanswered" }] }, out]);
    const r = await recallFeedback(lib, id);
    expect(calls()).toBe(2); // n=3 was unanswered → retried
    const ai = { vendor: "claude", model: "claude-fake-1", prompt_version: "recall-feedback@4" };
    expect(r).toEqual({ item: id, ...out, ai });
    const input = JSON.parse(readFileSync(join(binDir, "args.jsonl"), "utf8").split("\n")[0]!)[1] as string;
    expect(input).toContain('"recall": "Workflows are fixed."');
    expect(input).toContain('"after": "agents pick tools"');
    expect(input).toContain(item.docPath);
    const meta = findItem(lib, id).meta;
    expect(meta.recall).toMatchObject({ text: "Workflows are fixed.", feedback: { ...out, ai } });
    await setRecall(lib, id, "Rewritten.");
    expect(findItem(lib, id).meta.recall?.feedback).toBeUndefined();
  });

  test("a deleted highlight never produces a draft; its existing card stays", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Workflows follow predefined code paths. Agents direct their own tool use." });
    const it = findItem(lib, item.meta.id);
    const kept = addHighlight(it, { exact: "Agents direct their own tool use.", intent: "card" });
    const gone = addHighlight(it, { exact: "Workflows follow predefined code paths.", intent: "card" });
    reviseAnnotation(it, findAnnotation(lib, gone.id).annotation, { status: "deleted" });
    expect(pendingHighlights(findItem(lib, item.meta.id), []).map((a) => a.id)).toEqual([kept.id]);
    fakeClaude([enrichOut(["Q1?", "Q2?"], [draft(kept.id)])]);
    await enrichItem(lib, item.meta.id);
    expect(listCards(lib).map((c) => c.meta.annotation)).toEqual([kept.id]);
    // deleting a drafted highlight leaves its card alone and does not re-trigger enrich
    reviseAnnotation(it, findAnnotation(lib, kept.id).annotation, { status: "deleted" });
    expect((await enrichItem(lib, item.meta.id)).skipped).toBeDefined();
    expect(listCards(lib)).toHaveLength(1);
    expect(calls()).toBe(1);
  });

  test("enrich suggests a missing skill instead of forcing one; accepting creates it and files item and cards", async () => {
    const lib = await tempLibrary();
    const web = (text: string) => addSnippet(lib, { text });
    const { item } = await web("Browsers send HTTP requests to servers. DNS turns names into addresses.");
    const hl = addHighlight(findItem(lib, item.meta.id), { exact: "DNS turns names into addresses.", intent: "card" });
    const suggestion = { name: "Web Development", hook: "Build and ship things on the web" };
    fakeClaude([
      { ...enrichOut(["Q1?", "Q2?"], [draft(hl.id)]), skills: [], suggested_skill: suggestion },
      { ...enrichOut(["Q1?", "Q2?"]), skills: [], suggested_skill: { name: "web development", hook: "" } },
      { ...enrichOut(["Q1?", "Q2?"]), skills: [], suggested_skill: { name: "ai", hook: "" } },
    ]);
    await enrichItem(lib, item.meta.id);
    expect(findItem(lib, item.meta.id).meta).toMatchObject({ skills: [], suggested_skill: suggestion });
    const second = (await web("HTTP status codes say what went wrong.")).item;
    await enrichItem(lib, second.meta.id);

    const r = await acceptSuggestedSkill(lib, item.meta.id);
    expect(r.created).toBe(true);
    expect(r.skill).toEqual({ id: "web-development", name: "Web Development", priority: "P3", hook: suggestion.hook });
    expect(loadSkills(lib).skills.at(-1)).toEqual(r.skill);
    expect(readFileSync(join(lib.root, "skills.yaml"), "utf8")).toContain("# Skills (D25)");
    expect(findItem(lib, item.meta.id).meta.suggested_skill).toBeUndefined();
    expect(findItem(lib, item.meta.id).meta.skills).toEqual(["web-development"]);
    expect(listCards(lib)[0]!.meta.skills).toEqual(["web-development"]);
    expect(readTopic(lib, "agent-workflows")!.meta.skills).toEqual(["web-development"]);

    // the same suggestion on another item, made before the skill existed, reuses it
    const again = await acceptSuggestedSkill(lib, second.meta.id);
    expect(again.created).toBe(false);
    expect(loadSkills(lib).skills.filter((s) => s.id === "web-development")).toHaveLength(1);

    // once a skill exists, a suggestion naming it (or any existing skill) is filed under it directly
    const third = (await web("Agents call tools.")).item;
    await enrichItem(lib, third.meta.id);
    expect(findItem(lib, third.meta.id).meta).toMatchObject({ skills: ["ai"] });
    expect(findItem(lib, third.meta.id).meta.suggested_skill).toBeUndefined();
  });

  test("dismissing a suggested skill clears it; accept then fails", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Index funds track a market." });
    fakeClaude([{ ...enrichOut(["Q1?", "Q2?"]), skills: [], suggested_skill: { name: "Personal Finance", hook: "" } }]);
    await enrichItem(lib, item.meta.id);
    await dismissSuggestedSkill(lib, item.meta.id);
    expect(findItem(lib, item.meta.id).meta.suggested_skill).toBeUndefined();
    await expect(acceptSuggestedSkill(lib, item.meta.id)).rejects.toThrow(/no suggested skill/);
  });

  test("Undo takes back a dismiss or an accept exactly, so Accept works again", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Index funds track a market. Fees compound." });
    const hl = addHighlight(findItem(lib, item.meta.id), { exact: "Fees compound.", intent: "card" });
    const suggestion = { name: "Personal Finance", hook: "Money that lasts" };
    fakeClaude([{ ...enrichOut(["Q1?", "Q2?"], [draft(hl.id)]), skills: [], suggested_skill: suggestion }]);
    await enrichItem(lib, item.meta.id);
    const topic = findItem(lib, item.meta.id).meta.topics[0]!;
    const skillsBefore = loadSkills(lib).skills.map((k) => k.id);
    await dismissSuggestedSkill(lib, item.meta.id);
    await undoSuggestedSkill(lib, item.meta.id, { suggestion });
    expect(findItem(lib, item.meta.id).meta.suggested_skill).toEqual(suggestion);

    // An accept that made the skill: undo takes it off the source, its cards and topics, and deletes it.
    const r = await acceptSuggestedSkill(lib, item.meta.id);
    expect(r.undo).toMatchObject({ skill: "personal-finance", created: true, filed: true, topics: [topic] });
    expect(r.undo.cards).toHaveLength(1);
    await undoSuggestedSkill(lib, item.meta.id, r.undo);
    expect(findItem(lib, item.meta.id).meta).toMatchObject({ skills: [], suggested_skill: suggestion });
    expect(listCards(lib)[0]!.meta.skills).toEqual([]);
    expect(readTopic(lib, topic)!.meta.skills).not.toContain("personal-finance");
    expect(loadSkills(lib).skills.map((k) => k.id)).toEqual(skillsBefore);

    // Filed elsewhere since the accept: the skill stays for that; only what the accept filed comes off.
    const again = await acceptSuggestedSkill(lib, item.meta.id);
    const other = (await addSnippet(lib, { text: "Budgets plan spending." })).item;
    await setItemSkills(lib, other.meta.id, ["personal-finance"]);
    await undoSuggestedSkill(lib, item.meta.id, again.undo);
    expect(findItem(lib, item.meta.id).meta.skills).toEqual([]);
    expect(loadSkills(lib).skills.some((k) => k.id === "personal-finance")).toBe(true);

    // Into a skill that exists: the skill stays; the source comes off it.
    const into = await acceptSuggestedSkill(lib, item.meta.id);
    expect(into.undo).toMatchObject({ created: false, filed: true });
    await undoSuggestedSkill(lib, item.meta.id, into.undo);
    expect(findItem(lib, item.meta.id).meta).toMatchObject({ skills: [], suggested_skill: suggestion });
    expect(loadSkills(lib).skills.some((k) => k.id === "personal-finance")).toBe(true);
    await expect(undoSuggestedSkill(lib, item.meta.id, { suggestion: { name: "  " } })).rejects.toThrow(/name/);
  });

  const inputOf = (call: number) => JSON.parse(readFileSync(join(binDir, "args.jsonl"), "utf8").split("\n")[call]!)[1] as string;
  const noteDraft = (question: string) => ({ annotation: null, from_notes: true, prequestion: null, kind: "prompt", content_type: "concept", question, answer: "Agents choose steps; workflows follow fixed paths.", rubric: ["Agent chooses", "Workflow fixed"], topics: [] });

  test("enrich drafts from changed My notes (from: notes), records notes_drafted, and allows a pair per highlight", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Workflows follow predefined code paths. Agents direct their own tool use." });
    const id = item.meta.id;
    const hl = addHighlight(findItem(lib, id), { exact: "Agents direct their own tool use.", intent: "card" });
    const notes = "My metaphor: workflows are trains, agents are drivers.";
    await setNotes(lib, id, notes);
    fakeClaude([
      enrichOut(["Q1?", "Q2?"], [draft(hl.id), { ...draft(hl.id), kind: "prompt", content_type: "concept", question: "Apply it", rubric: ["a", "b"] }, noteDraft("Explain agents vs workflows with a metaphor.")]),
      enrichOut(["NEW1?", "NEW2?"], [noteDraft("When would a driver beat a train in your work?")]),
    ]);
    await enrichItem(lib, id);
    expect(inputOf(0)).toContain(`"notes": ${JSON.stringify(notes)}`);
    expect(inputOf(0)).toContain('"notes_cards": []');
    const cards = listCards(lib);
    expect(cards.filter((c) => c.meta.annotation === hl.id)).toHaveLength(2);
    const fromNotes = cards.filter((c) => c.meta.from === "notes");
    expect(fromNotes).toHaveLength(1);
    expect(fromNotes[0]!.meta.annotation).toBeUndefined();
    expect(readFileSync(fromNotes[0]!.path, "utf8")).toContain("from: notes");
    expect(findItem(lib, id).meta.notes_drafted).toBe(sha256(notes));
    expect(needsEnrich(findItem(lib, id), listCards(lib))).toBe(false);
    expect((await enrichItem(lib, id)).skipped).toBeDefined();

    // changed notes make the item pending again; the rerun sees earlier note cards and keeps prequestions
    const changed = await appendNote(lib, id, "Drivers can take detours.", "Use and connections");
    expect(needsEnrich(findItem(lib, id), listCards(lib))).toBe(true);
    expect(pendingItems(lib).map((i) => i.meta.id)).toEqual([id]);
    const r = await enrichItem(lib, id);
    expect(inputOf(1)).toContain('"notes_cards": [\n    "Explain agents vs workflows with a metaphor."');
    expect(r.prequestions).toEqual(["Q1?", "Q2?"]);
    expect(r.cards).toEqual([expect.objectContaining({ from: "notes", question: "When would a driver beat a train in your work?" })]);
    expect(findItem(lib, id).meta.notes_drafted).toBe(sha256(changed.text));
    expect(pendingItems(lib)).toEqual([]);
    expect(calls()).toBe(2);
  });

  test("enrich rejects from_notes drafts when no notes were sent, and a third draft per highlight", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Workflows follow predefined code paths. Agents direct their own tool use." });
    const hl = addHighlight(findItem(lib, item.meta.id), { exact: "Agents direct their own tool use.", intent: "card" });
    fakeClaude([enrichOut(["Q1?", "Q2?"], [noteDraft("x")]), enrichOut(["Q1?", "Q2?"], [draft(hl.id), draft(hl.id), draft(hl.id)])]);
    await expect(enrichItem(lib, item.meta.id)).rejects.toThrow(/at most two drafts per highlight/);
    const second = JSON.parse(readFileSync(join(binDir, "args.jsonl"), "utf8").trim().split("\n")[1]!) as string[];
    expect(second[1]).toContain("from_notes drafts are only allowed when `notes` is given");
    expect(inputOf(0)).toContain('"notes": null');
    expect(listCards(lib)).toEqual([]);
  });

  test("chapter recall feedback covers one chapter, no prequestions, stored in chapter_recalls", async () => {
    const lib = await tempLibrary();
    const book = await createItem(lib, { type: "epub", title: "Book", body: "<!-- chapter 1 -->\n\nOne idea.\n\n<!-- chapter 2 -->\n\nTwo ideas.\n\n<!-- chapter 3 -->\n\nThree.\n" });
    const id = book.meta.id;
    await updateItemMeta(lib, id, (m) => ({ ...m, prequestions: [{ q: "Q1?", after: "something" }] }));
    await expect(chapterRecallFeedback(lib, id, 2)).rejects.toThrow(/no recall for chapter 2/);
    await setChapterRecall(lib, id, 2, "Two ideas, roughly.");
    const out = { feedback: "You have both.", questions: [], missed: ["How the two connect."], section_lines: null };
    const file = readFileSync(book.docPath, "utf8").split("\n");
    const lines = { from: file.indexOf("<!-- chapter 2 -->") + 1, to: file.indexOf("<!-- chapter 3 -->") };
    expect(file.slice(lines.from - 1, lines.to).join("\n").trim()).toBe("<!-- chapter 2 -->\n\nTwo ideas.");
    fakeClaude([{ ...out, questions: [{ n: 1, feedback: "no" }] }, out]);
    const r = await chapterRecallFeedback(lib, id, 2);
    expect(calls()).toBe(2);
    const ai = { vendor: "claude", model: "claude-fake-1", prompt_version: "recall-feedback@4" };
    expect(r).toEqual({ item: id, chapter: 2, feedback: out.feedback, missed: out.missed, section_lines: null, ai });
    const input = inputOf(0);
    expect(input).toContain('"chapter": 2');
    expect(input).toContain('"prequestions": []');
    expect(input).toContain('"recall": "Two ideas, roughly."');
    expect(JSON.parse(input.slice(input.indexOf("{"), input.lastIndexOf("}") + 1)).chapter_lines).toEqual(lines);
    expect(findItem(lib, id).meta.chapter_recalls).toEqual([{ n: 2, text: "Two ideas, roughly.", at: expect.any(String), feedback: { feedback: out.feedback, missed: out.missed, section_lines: null, ai } }]);
    expect(findItem(lib, id).meta.recall).toBeUndefined();
  });
  const preqDraft = (n: number, question: string) => ({ annotation: null, from_notes: false, prequestion: n, kind: "prompt", content_type: "concept", question, answer: "Agents choose their steps.", rubric: ["Agent chooses steps", "Workflow is fixed"], topics: [] });

  test("prequestions become prompts once the item is done: one per prequestion, from: prequestion, missed ideas sent", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Workflows follow predefined code paths. Agents direct their own tool use." });
    const id = item.meta.id;
    fakeClaude([
      enrichOut(["Why do agents differ?", "When is a workflow better?"]),
      enrichOut(["X?", "Y?"], [preqDraft(1, "In LLM systems, why do agents differ from workflows?")]), // misses n=2 → retried
      enrichOut(["X?", "Y?"], [preqDraft(1, "In LLM systems, why do agents differ from workflows?"), preqDraft(2, "In LLM systems, when is a workflow better than an agent?")]),
    ]);
    await enrichItem(lib, id);
    // still reading: the prequestions are being answered, so nothing is drafted from them
    expect(pendingPrequestions(findItem(lib, id), listCards(lib))).toEqual([]);
    expect(needsEnrich(findItem(lib, id), listCards(lib))).toBe(false);
    expect((await enrichItem(lib, id)).skipped).toBeDefined();
    expect(calls()).toBe(1);

    await setItemStatus(lib, id, "done");
    const ai = { vendor: "claude", model: "claude-fake-1", prompt_version: "recall-feedback@4" };
    await updateItemMeta(lib, id, (m) => ({ ...m, recall: { text: "agents", at: m.captured_at, feedback: { feedback: "ok", questions: [], missed: ["Workflows are predictable."], section_lines: null, ai } } }));
    expect(needsEnrich(findItem(lib, id), listCards(lib))).toBe(true);
    expect(pendingItems(lib).map((i) => i.meta.id)).toEqual([id]); // nightly catch-up picks up already-finished items
    const r = await enrichItem(lib, id);
    expect(calls()).toBe(3);
    const input = JSON.parse(inputOf(1).slice(inputOf(1).indexOf("{"), inputOf(1).lastIndexOf("}") + 1));
    expect(input.prequestions_to_draft).toEqual([{ n: 1, q: "Why do agents differ?" }, { n: 2, q: "When is a workflow better?" }]);
    expect(input.missed).toEqual(["Workflows are predictable."]);
    const retry = JSON.parse(readFileSync(join(binDir, "args.jsonl"), "utf8").trim().split("\n")[2]!) as string[];
    expect(retry[1]).toContain("exactly one prompt per number in prequestions_to_draft (1, 2); got 1");
    expect(r.prequestions).toEqual(["Why do agents differ?", "When is a workflow better?"]);
    expect(r.cards.map((c) => [c.from, c.prequestion, c.annotation])).toEqual([["prequestion", 1, undefined], ["prequestion", 2, undefined]]);
    const cards = listCards(lib);
    expect(cards.map((c) => c.meta)).toEqual([expect.objectContaining({ kind: "prompt", from: "prequestion", prequestion: 1 }), expect.objectContaining({ kind: "prompt", from: "prequestion", prequestion: 2 })]);
    expect(cards[0]!.meta.annotation).toBeUndefined();
    expect(readFileSync(cards[0]!.path, "utf8")).toContain("from: prequestion\nprequestion: 1");
    // once drafted, never again
    expect(needsEnrich(findItem(lib, id), listCards(lib))).toBe(false);
    expect((await enrichItem(lib, id)).skipped).toBeDefined();
    expect(calls()).toBe(3);
  });

  // The plan folds a highlight whose idea a prequestion already asks into that prequestion's prompt, so
  // the idea comes back once (eval:questions found it asked twice): the prompt keeps the highlight.
  test("a highlight folded into a prequestion's prompt is drafted, not drafted again", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Workflows follow predefined code paths. Agents direct their own tool use." });
    const id = item.meta.id;
    fakeClaude([enrichOut(["Why do agents differ?", "When is a workflow better?"])]);
    await enrichItem(lib, id);
    const key = addHighlight(findItem(lib, id), { exact: "Agents direct their own tool use.", intent: "card" });
    const plain = addHighlight(findItem(lib, id), { exact: "Workflows follow predefined code paths.", intent: "keep" });
    await setItemStatus(lib, id, "done");
    fakeClaude([enrichOut(["X?", "Y?"], [{ ...preqDraft(1, "In LLM systems, why do agents differ from workflows?"), also: [key.id, plain.id] }, preqDraft(2, "In LLM systems, when is a workflow better than an agent?")])]);
    await enrichItem(lib, id);
    const first = listCards(lib).find((c) => c.meta.prequestion === 1)!;
    expect(first.meta.also).toEqual([key.id, plain.id]);
    expect(pendingHighlights(findItem(lib, id), listCards(lib))).toEqual([]);
    expect(needsEnrich(findItem(lib, id), listCards(lib))).toBe(false);
  });

  // A mistyped id in `also` (eval:questions saw a whole enrich fail on one, twice) is dropped, not a failed run:
  // the key point it should have named is still checked for a draft.
  test("an unknown highlight id in also is dropped; an unknown annotation is still rejected", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Workflows follow predefined code paths. Agents direct their own tool use." });
    const id = item.meta.id;
    fakeClaude([enrichOut(["Why do agents differ?", "When is a workflow better?"])]);
    await enrichItem(lib, id);
    const key = addHighlight(findItem(lib, id), { exact: "Agents direct their own tool use.", intent: "card" });
    fakeClaude([enrichOut(["X?", "Y?"], [{ ...draft(key.id), also: ["01NOPE"] }])]);
    await enrichItem(lib, id);
    expect(calls()).toBe(1);
    expect(listCards(lib)[0]!.meta.also).toBeUndefined();
    fakeClaude([enrichOut(["X?", "Y?"], [draft("01NOPE")]), enrichOut(["X?", "Y?"], [draft("01NOPE")])]);
    addHighlight(findItem(lib, id), { exact: "Workflows follow predefined code paths.", intent: "card" });
    await expect(enrichItem(lib, id)).rejects.toThrow(/unknown highlight ids: 01NOPE/);
  });

  test("enrich rejects prequestion drafts before the item is done", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Workflows follow predefined code paths. Agents direct their own tool use." });
    fakeClaude([enrichOut(["Q1?", "Q2?"], [preqDraft(1, "x")]), enrichOut(["Q1?", "Q2?"], [preqDraft(1, "x")])]);
    await expect(enrichItem(lib, item.meta.id)).rejects.toThrow(/exactly one prompt per number in prequestions_to_draft \(none\); got 1/);
    expect(inputOf(0)).toContain('"prequestions_to_draft": []');
    expect(listCards(lib)).toEqual([]);
  });

  test("recall feedback judges section lines, stores section_lines; reserved headings are not section lines", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Workflows follow predefined code paths. Agents direct their own tool use." });
    const id = item.meta.id;
    await setNotes(lib, id, "## Workflows\n\nFixed paths, predictable.\n\n## Use and connections\n\nIn my course.");
    await setRecall(lib, id, "Workflows are fixed.");
    const out = { feedback: "Right.", questions: [], missed: [], section_lines: "Your line states the main idea in your words." };
    fakeClaude([{ ...out, section_lines: null }, out]);
    const r = await recallFeedback(lib, id);
    expect(calls()).toBe(2); // null with section lines given → retried
    const input = JSON.parse(inputOf(0).slice(inputOf(0).indexOf("{"), inputOf(0).lastIndexOf("}") + 1));
    expect(input.section_lines).toEqual([{ heading: "Workflows", text: "Fixed paths, predictable." }]);
    expect(r.section_lines).toBe(out.section_lines);
    expect(findItem(lib, id).meta.recall?.feedback?.section_lines).toBe(out.section_lines);
  });

  test("chapter recall feedback gets only that chapter's section lines", async () => {
    const lib = await tempLibrary();
    const body = "<!-- chapter 1 -->\n\n## Alpha basics\n\nOne idea.\n\n<!-- chapter 2 -->\n\n## Beta methods\n\nTwo ideas.\n";
    const id = (await createItem(lib, { type: "epub", title: "Book", body })).meta.id;
    await setNotes(lib, id, "## Alpha basics\n\nAlpha is one idea.\n\n## Beta methods\n\nBeta has two.");
    await setChapterRecall(lib, id, 2, "Two ideas.");
    const out = { feedback: "Yes.", questions: [], missed: [], section_lines: "Main idea, your words." };
    fakeClaude([out]);
    const r = await chapterRecallFeedback(lib, id, 2);
    const input = JSON.parse(inputOf(0).slice(inputOf(0).indexOf("{"), inputOf(0).lastIndexOf("}") + 1));
    expect(input.section_lines).toEqual([{ heading: "Beta methods", text: "Beta has two." }]);
    expect(r.section_lines).toBe(out.section_lines);
    expect(findItem(lib, id).meta.chapter_recalls?.[0]?.feedback?.section_lines).toBe(out.section_lines);
  });
});

describe("quiz check (D56)", () => {
  const body = "# Testing\n\nRetrieval changes the memory itself. Rereading feels **fluent** but fades.\n\nThe benefit grows with delay.\n";
  async function quizItem() {
    const lib = await tempLibrary();
    const id = (await createItem(lib, { type: "markdown", title: "Testing", body })).meta.id;
    await updateItemMeta(lib, id, (m) => ({ ...m, prequestions: [{ q: "Why test?" }, { q: "When does it pay off?" }] }));
    return { lib, id };
  }

  test("evidence anchors exact and Markdown-stripped quotes, drops invented ones and repeats", () => {
    const ev = anchorEvidence(body, ["Retrieval changes the memory itself.", "Rereading feels fluent but fades.", "Testing is fun.", "Retrieval changes the memory itself."]);
    expect(ev.map((e) => e.exact)).toEqual(["Retrieval changes the memory itself.", "Rereading feels **fluent** but fades."]);
    expect(body.slice(ev[0]!.start, ev[0]!.end)).toBe(ev[0]!.exact);
  });

  test("key points are written once per prequestion, with anchored passages and an AI stamp", async () => {
    const { lib, id } = await quizItem();
    fakeClaude([
      { questions: [{ n: 1, points: [{ text: "Retrieval strengthens memory", evidence: ["Retrieval changes the memory itself."] }, { text: "Rereading fades", evidence: ["Made up sentence."] }] }] },
      {
        questions: [
          { n: 1, points: [{ text: "Retrieval strengthens memory", evidence: ["Retrieval changes the memory itself."] }, { text: "Rereading fades", evidence: ["Made up sentence."] }] },
          { n: 2, points: [{ text: "After a delay", evidence: ["The benefit grows with delay."] }, { text: "Not at once", evidence: ["The benefit grows with delay."] }] },
        ],
      },
    ]);
    const r = await writeKeyPoints(lib, id);
    expect(calls()).toBe(2); // the first answer missed prequestion 2 and was retried
    const [p1, p2] = findItem(lib, id).meta.prequestions!;
    expect(p1!.points!.map((k) => k.evidence.length)).toEqual([1, 0]);
    expect(p2!.points![0]!.evidence[0]!.exact).toBe("The benefit grows with delay.");
    expect(p1!.points_ai?.prompt_version).toBe("key-points@1");
    expect(r.prequestions).toHaveLength(2);
    expect((await writeKeyPoints(lib, id)).skipped).toBeDefined();
    expect(calls()).toBe(2);
  });

  test("key points land on the question they were written for, even when the prequestions move while the AI runs", async () => {
    const { lib, id } = await quizItem();
    const doc = findItem(lib, id).docPath;
    // While the AI works, the prequestions are reordered and the second is replaced.
    writeFileSync(join(binDir, "while.js"), `const fs = require("fs"); const p = ${JSON.stringify(doc)};
fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace("Why test?", "@@").replace("When does it pay off?", "Does it pay off at all?").replace("@@", "When does it pay off?").replace("Does it pay off at all?", "Why test?"));`);
    try {
      fakeClaude([{ questions: [{ n: 1, points: [{ text: "For 1", evidence: ["Retrieval changes the memory itself."] }, { text: "Also 1", evidence: ["x"] }] }, { n: 2, points: [{ text: "For 2", evidence: ["The benefit grows with delay."] }, { text: "Also 2", evidence: ["x"] }] }] }]);
      await writeKeyPoints(lib, id);
    } finally {
      rmSync(join(binDir, "while.js"), { force: true });
    }
    const [p1, p2] = findItem(lib, id).meta.prequestions!;
    expect(p1!.q).toBe("When does it pay off?");
    expect(p1!.points!.map((k) => k.text)).toEqual(["For 2", "Also 2"]);
    expect(p2!.q).toBe("Why test?");
    expect(p2!.points!.map((k) => k.text)).toEqual(["For 1", "Also 1"]);
  });

  test("key points for a question that was replaced while the AI ran are not kept", async () => {
    const { lib, id } = await quizItem();
    const doc = findItem(lib, id).docPath;
    writeFileSync(join(binDir, "while.js"), `const fs = require("fs"); const p = ${JSON.stringify(doc)};
fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace("When does it pay off?", "Does it pay off at all?"));`);
    try {
      fakeClaude([{ questions: [{ n: 1, points: [{ text: "For 1", evidence: ["x"] }, { text: "Also 1", evidence: ["x"] }] }, { n: 2, points: [{ text: "For 2", evidence: ["x"] }, { text: "Also 2", evidence: ["x"] }] }] }]);
      await writeKeyPoints(lib, id);
    } finally {
      rmSync(join(binDir, "while.js"), { force: true });
    }
    const [p1, p2] = findItem(lib, id).meta.prequestions!;
    expect(p1!.points!.map((k) => k.text)).toEqual(["For 1", "Also 1"]);
    expect(p2!.q).toBe("Does it pay off at all?");
    expect(p2!.points).toBeUndefined();
  });

  test("check marks the answer, a new answer drops the check, and his flips are stored", async () => {
    const { lib, id } = await quizItem();
    await updateItemMeta(lib, id, (m) => ({ ...m, prequestions: m.prequestions!.map((p) => ({ ...p, points: [{ text: "A", evidence: [] }, { text: "B", evidence: [] }] })) }));
    await expect(checkPrequestion(lib, id, 1)).rejects.toThrow(/record an answer first/);
    await setPrequestionAttempt(lib, id, 1, { after: "it strengthens memory", confidence: 3 });
    fakeClaude([{ covered: [true] }, { covered: [true, false] }]);
    const r = await checkPrequestion(lib, id, 1);
    expect(r.check?.covered).toEqual([true, false]);
    expect(r.confidence).toBe(3);
    const flipped = await setCovered(lib, id, 1, [true, true]);
    expect(flipped.check).toMatchObject({ covered: [true, true], edited: true });
    await expect(setCovered(lib, id, 1, [true])).rejects.toThrow(/one mark per key point/);
    // the same answer keeps its check; a new one drops it
    expect((await setPrequestionAttempt(lib, id, 1, { after: "it strengthens memory" })).check).toBeDefined();
    expect((await setPrequestionAttempt(lib, id, 1, { after: "no idea" })).check).toBeUndefined();
    await expect(setPrequestionAttempt(lib, id, 1, { before: "x", confidence: 2 })).rejects.toThrow(/--confidence/);
  });
});

describe("side quests: a term he doesn't know", () => {
  const body = "# Claude\n\nIntro line.\n\nClaude is reached through a RESTful API. Each request is an HTTPS call.\n\n## Streaming\n\nThe RESTful API streams events.";

  test("paragraphAt gives the paragraph around an offset, cut around it when long", () => {
    expect(paragraphAt(body, body.indexOf("RESTful"))).toBe("Claude is reached through a RESTful API. Each request is an HTTPS call.");
    expect(paragraphAt(body, 0)).toBe("# Claude");
    const long = "a ".repeat(2000) + "TERM " + "b ".repeat(2000);
    const p = paragraphAt(long, long.indexOf("TERM"), 200);
    expect(p).toContain("TERM");
    expect(p.length).toBeLessThanOrEqual(202);
  });

  test("explain sends the term and its own paragraph, writes nothing, and stamps the AI", async () => {
    const lib = await tempLibrary();
    const item = await createItem(lib, { type: "markdown", title: "Claude", body, skills: [] });
    fakeClaude([{ here: "You call Claude with web requests.", general: "An API used over plain HTTP." }]);
    const r = await explainTerm(lib, item.meta.id, "RESTful API", body.lastIndexOf("RESTful"));
    expect(r).toMatchObject({ here: "You call Claude with web requests.", ai: { vendor: "claude", prompt_version: "explain@1" } });
    const [args] = readFileSync(join(binDir, "args.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as string[]);
    expect(args![1]).toContain("The RESTful API streams events.");
    expect(args![1]).not.toContain("HTTPS call");
    expect(readAnnotations(findItem(lib, item.meta.id))).toEqual([]);
    await expect(explainTerm(lib, item.meta.id, "  ")).rejects.toThrow(/nothing to explain/);
  });

  test("research on a question sends the paragraph it was asked in and keeps each source's minutes, null when it can't tell", async () => {
    const lib = await tempLibrary();
    const item = await createItem(lib, { type: "markdown", title: "Claude", body, skills: [] });
    const q = addHighlight(findItem(lib, item.meta.id), { exact: "RESTful API", intent: "question", note: "What is a RESTful API?" });
    const src = (n: number, minutes?: number | null) => ({ title: `S${n}`, url: `https://example.com/${n}`, site: "Ex", type: "article", why: "w", ...(minutes !== undefined && { minutes }) });
    fakeClaude([{ sources: [src(1, 6), src(2, null), src(3)] }]);
    const r = await research(lib, q.id);
    expect(r.sources.map((s) => s.minutes)).toEqual([6, null, null]);
    const [args] = readFileSync(join(binDir, "args.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as string[]);
    expect(args![1]).toContain("Each request is an HTTPS call.");
    expect(r.ai.prompt_version).toBe("research@3");
  });
});

describe("a partway finish (D100)", () => {
  const theory = "The first reason is security. The second reason is modularity.";
  const code = "Now install Flask and write the first route.";
  const body = `# REST\n\n${theory}\n\n${"Filler about the theory. ".repeat(20)}\n\n${code}\n\n${"Filler about the code. ".repeat(30)}\n`;
  const ev = (q: string) => anchorEvidence(body, [q]);
  async function finishing() {
    const lib = await tempLibrary();
    const id = (await createItem(lib, { type: "markdown", title: "REST", body })).meta.id;
    await updateItemMeta(lib, id, (m) => ({
      ...m,
      prequestions: [
        { q: "Why an API?", points: [{ text: "Security", evidence: ev("The first reason is security.") }] },
        { q: "How do you start a Flask app?", points: [{ text: "Install Flask", evidence: ev("Now install Flask and write the first route.") }] },
        { q: "What is a route?", points: [{ text: "Unanchored", evidence: [] }] },
      ],
    }));
    return { lib, id };
  }

  test("questions answered only past where he stopped are left out; finishing again further brings them back", async () => {
    const { lib, id } = await finishing();
    const reached = body.indexOf(code) - 10;
    const r = await scopeFinish(lib, id, { reached });
    expect(r.prequestions.map((p) => p.skipped ?? null)).toEqual([null, "past", null]); // no passages: kept
    expect(finishScope(findItem(lib, id))).toEqual({ stopped_after: expect.stringContaining("Filler about the theory."), leave_out: null });
    await setItemStatus(lib, id, "done");
    expect(pendingPrequestions(findItem(lib, id), []).map((p) => p.n)).toEqual([1, 3]);
    // Read to the end: the whole source again.
    const again = await scopeFinish(lib, id, { reached: body.length - 5 });
    expect(again.prequestions.every((p) => !p.skipped)).toBe(true);
    expect(again.reached).toBeNull();
    expect(finishScope(findItem(lib, id))).toBeNull();
  });

  test("his leave-out note has the AI drop what it rules out, with its stamp; numbers it can't have are retried", async () => {
    const { lib, id } = await finishing();
    fakeClaude([{ drop: [9] }, { drop: [3] }]);
    const r = await scopeFinish(lib, id, { reached: body.indexOf(code) - 10, leaveOut: " the coding part " });
    expect(calls()).toBe(2);
    expect(r.prequestions.map((p) => p.skipped ?? null)).toEqual([null, "past", "left_out"]);
    expect(r.leave_out).toEqual({ text: "the coding part", ai: { vendor: "claude", model: "claude-fake-1", prompt_version: "leave-out@2" } });
    const [args] = readFileSync(join(binDir, "args.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as string[]);
    expect(args!.join(" ")).not.toContain("How do you start a Flask app?"); // already out: not sent
  });
});
