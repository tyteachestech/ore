import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gradeAnswer } from "../src/ai/grade.ts";
import { findCard, writeNewCard, type NewCard } from "../src/cards.ts";
import { appendJsonl } from "../src/fsutil.ts";
import { addSnippet } from "../src/ingest/index.ts";
import { paths, type Library } from "../src/library.ts";
import {
  cardsToRemix, inHeadOk, pickVariant, readVariants, rejectVariant, remixable, remixCard, remixStats, remixTypes, reviewVersion, setVariant, sharedRun, variantProblem, type Variant,
} from "../src/remix.ts";
import { readReviews } from "../src/reviews.ts";
import { setReviewSettings } from "../src/skills.ts";
import { recordReview } from "../src/study.ts";
import { tempLibrary } from "./helpers.ts";

let binDir = "";
const savedPath = process.env.PATH;
function fakeClaude(outputs: unknown[]) {
  writeFileSync(join(binDir, "queue.json"), JSON.stringify(outputs));
  writeFileSync(join(binDir, "count"), "0");
  writeFileSync(
    join(binDir, "claude"),
    `#!/usr/bin/env bun
const fs = require("fs");
const dir = ${JSON.stringify(binDir)};
const n = Number(fs.readFileSync(dir + "/count", "utf8"));
fs.writeFileSync(dir + "/count", String(n + 1));
fs.appendFileSync(dir + "/args.jsonl", JSON.stringify(process.argv.slice(2)) + "\\n");
const out = JSON.parse(fs.readFileSync(dir + "/queue.json", "utf8"))[n];
console.log(JSON.stringify({ is_error: false, structured_output: out, modelUsage: { "claude-fake-1": { outputTokens: 10 } } }));
`,
  );
  chmodSync(join(binDir, "claude"), 0o755);
}
beforeEach(() => {
  binDir = mkdtempSync(join(tmpdir(), "ore-fakebin-"));
  process.env.PATH = `${binDir}:${savedPath}`;
  process.env.ORE_AI = "claude";
});
afterEach(() => {
  process.env.PATH = savedPath;
  delete process.env.ORE_AI;
});

const CONCEPT = {
  kind: "prompt",
  content_type: "concept",
  question: "Why do prequestions help you learn from a text, and when do they not help?",
  answer: "They direct attention to what they ask about, so that material is learned better. They do not help with material they do not ask about.",
  rubric: ["Direct attention to what they ask about", "Don't help with material they don't ask about", "Broad questions spread the benefit wider"],
} as const;

async function concept(lib: Library, over: Partial<NewCard> = {}) {
  const { item } = await addSnippet(lib, { text: "Prequestions direct attention." });
  return writeNewCard(lib, { ...CONCEPT, rubric: [...CONCEPT.rubric], item: item.meta.id, skills: ["learning"], topics: [], ...over });
}

let t0 = Date.parse("2026-01-01T09:00:00Z");
const day = () => new Date((t0 += 864e5));
const review = (lib: Library, id: string, rating: 1 | 2 | 3 | 4, variant?: string) => recordReview(lib, id, { rating, confidence: 2, variant, now: day() });
const own = (lib: Library, id: string) => readReviews(lib).filter((r) => r.card === id);

function variant(lib: Library, card: string, type: Variant["type"], setting: string): Variant {
  const v: Variant = {
    id: `V${type.toUpperCase().replace("-", "")}${setting.length}`.padEnd(26, "0").slice(0, 26),
    rev: 1, card, type, setting, question: `In ${setting}, what happens?`, answer: "It helps the asked parts only.",
    rubric: ["Asked parts improve", "Applies it to the case"], maps: [0, 1], status: "ready",
    created: new Date(t0).toISOString(), ai: { vendor: "claude", model: "fake", prompt_version: "variant@1" },
  };
  appendJsonl(paths.variants(lib, card), v);
  return v;
}

const goodWriter = (setting: string, type: Variant["type"] = "new-case") => ({
  type, setting,
  question: `You are ${setting} and open with two broad questions on screen. What will viewers take away better, and what not?`,
  answer: "The parts the two questions point at stick better; the rest does not. Broad questions cover more of the video.",
  points: [{ text: "Says the parts the questions point at stick better", tests: 0 }, { text: "Says the rest of the video gets no boost", tests: 1 }],
});
const pass = { in_scope: true, answerable: true, same_claim: true, gives_away: false, reason: "" };

describe("card remixing (D66)", () => {
  test("facts and fill in the blanks stay as written; concepts, procedures and definitions remix", async () => {
    const lib = await tempLibrary();
    expect(remixTypes(await concept(lib))).toEqual(["new-case", "predict", "diagnose", "choose"]);
    expect(remixTypes(await concept(lib, { content_type: "procedure" }))).toEqual(["new-case"]);
    expect(remixTypes(await concept(lib, { kind: "card", content_type: "definition", rubric: [] }))).toEqual(["name-it"]);
    expect(remixTypes(await concept(lib, { kind: "card", content_type: "fact", rubric: [] }))).toEqual([]);
    expect(remixTypes(await concept(lib, { kind: "card", content_type: "definition", question: "{{c1::Prequestions}} direct attention.", rubric: [] }))).toEqual([]);
    expect(remixTypes(await concept(lib, { kind: "card", content_type: "definition", question: "____ direct attention.", rubric: [] }))).toEqual([]);
  });

  test("starts after two passes on the original, rotates variant, variant, original, and uses each variant twice at most", async () => {
    const lib = await tempLibrary();
    const c = await concept(lib);
    const a = variant(lib, c.meta.id, "new-case", "a YouTube explainer");
    const b = variant(lib, c.meta.id, "predict", "a teacher's chapter");
    const next = () => pickVariant(findCard(lib, c.meta.id), own(lib, c.meta.id), readVariants(lib, c.meta.id));
    await review(lib, c.meta.id, 3); // finishing: the draft goes live
    expect(next()).toBeNull();
    await review(lib, c.meta.id, 3);
    expect(remixable(findCard(lib, c.meta.id), own(lib, c.meta.id))).toBe(true);

    const shown: (string | null)[] = [];
    for (let i = 0; i < 6; i++) {
      const v = next();
      shown.push(v?.id ?? null);
      await review(lib, c.meta.id, 3, v?.id);
    }
    // a, b, original, then the other order so the ask changes from the last one, original; both used twice.
    expect(shown).toEqual([a.id, b.id, null, a.id, b.id, null]);
    expect(next()).toBeNull(); // both used up: the original until new ones are written
    expect(cardsToRemix(lib, [findCard(lib, c.meta.id)])).toEqual([c.meta.id]);
    // One card, one schedule: every version's review updated the same FSRS state.
    const rs = own(lib, c.meta.id);
    expect(rs.map((r) => r.variant ?? null).filter(Boolean)).toHaveLength(4);
    rs.slice(1).forEach((r, i) => expect(r.state_before).toEqual(rs[i]!.state_after));
  });

  test("a miss goes back to the original until two passes again", async () => {
    const lib = await tempLibrary();
    const c = await concept(lib);
    const a = variant(lib, c.meta.id, "new-case", "a YouTube explainer");
    variant(lib, c.meta.id, "predict", "a teacher's chapter");
    const next = () => pickVariant(findCard(lib, c.meta.id), own(lib, c.meta.id), readVariants(lib, c.meta.id));
    await review(lib, c.meta.id, 3);
    await review(lib, c.meta.id, 3);
    expect(next()?.id).toBe(a.id);
    await review(lib, c.meta.id, 1, a.id);
    expect(next()).toBeNull();
    await review(lib, c.meta.id, 3);
    expect(next()).toBeNull();
    await review(lib, c.meta.id, 3);
    expect(next()).not.toBeNull();
  });

  test("B drops a variant, E edits it, and the Remix cards switch turns variants off", async () => {
    const lib = await tempLibrary();
    const c = await concept(lib);
    const a = variant(lib, c.meta.id, "new-case", "a YouTube explainer");
    await review(lib, c.meta.id, 3);
    await review(lib, c.meta.id, 3);
    expect(reviewVersion(lib, findCard(lib, c.meta.id))?.id).toBe(a.id);
    const edited = await setVariant(lib, c.meta.id, a.id, { question: "A new question?" });
    expect(readVariants(lib, c.meta.id)[0]).toMatchObject({ rev: 2, question: "A new question?", answer: a.answer });
    // Its key points are reworded in place, one for one, since each tests one of the original's.
    await setVariant(lib, c.meta.id, a.id, { rubric: a.rubric.map((p) => `${p}, reworded`) });
    expect(readVariants(lib, c.meta.id)[0]!.rubric).toEqual(a.rubric.map((p) => `${p}, reworded`));
    await expect(setVariant(lib, c.meta.id, a.id, { rubric: [a.rubric[0]!] })).rejects.toThrow(/keeps its 2 key points/);
    await setReviewSettings(lib, { remix: false });
    expect(reviewVersion(lib, findCard(lib, c.meta.id))).toBeNull();
    expect(cardsToRemix(lib, [findCard(lib, c.meta.id)])).toEqual([]);
    await setReviewSettings(lib, { remix: true });
    await rejectVariant(lib, c.meta.id, edited.id);
    expect(readVariants(lib, c.meta.id)[0]).toMatchObject({ status: "rejected", reason: expect.stringContaining("bad version") });
    expect(reviewVersion(lib, findCard(lib, c.meta.id))).toBeNull();
  });

  test("the code check: real point indices, 2 to 4 points, a new setting, and no 5-word run from the original", async () => {
    const lib = await tempLibrary();
    const c = await concept(lib);
    expect(sharedRun("So: they direct attention to what they ask about here?", c)).toBe("they direct attention to what");
    expect(sharedRun("Two broad questions open the video. What sticks?", c)).toBeNull();
    const ok = goodWriter("planning a YouTube explainer");
    expect(variantProblem(c, ok, [])).toBeNull();
    expect(variantProblem(c, { ...ok, points: [{ text: "x", tests: 0 }, { text: "y", tests: 7 }] }, [])).toContain("index");
    expect(variantProblem(c, { ...ok, points: [{ text: "x", tests: 0 }] }, [])).toContain("2 to 4");
    expect(variantProblem(c, { ...ok, type: "name-it" }, [])).toContain("type");
    expect(variantProblem(c, ok, [{ type: "predict", setting: "Planning a YouTube explainer" }])).toContain("setting");
    expect(variantProblem(c, ok, [], "new-case")).toContain("differ");
    expect(variantProblem(c, { ...ok, question: `${CONCEPT.question} Think of a video.` }, [])).toContain("repeats");
  });

  test("remixCard writes two ahead: a failed code check is retried, a checker no is kept with its reason", async () => {
    const lib = await tempLibrary();
    const c = await concept(lib);
    await review(lib, c.meta.id, 3);
    await review(lib, c.meta.id, 3);
    fakeClaude([
      { ...goodWriter("a YouTube explainer"), question: CONCEPT.question }, // shares wording: retried
      goodWriter("a YouTube explainer"),
      pass,
      goodWriter("a creator newsletter", "predict"),
      { ...pass, in_scope: false, reason: "Point 2 needs an idea the card doesn't have." },
      goodWriter("a workshop for teachers", "diagnose"),
      pass,
    ]);
    const r = await remixCard(lib, c.meta.id);
    expect(r).toMatchObject({ written: [{ setting: "a YouTube explainer" }, { setting: "a workshop for teachers" }], rejected: 1, dropped: [] });
    const vs = readVariants(lib, c.meta.id);
    expect(vs.map((v) => v.status)).toEqual(["ready", "rejected", "ready"]);
    expect(vs[1]!.reason).toContain("idea the card doesn't have");
    expect(vs[0]).toMatchObject({ maps: [0, 1], ai: { prompt_version: "variant@2" }, check_ai: { prompt_version: "variant-check@2" } });
    // The writer saw the rejected one and why; the checker saw each point beside the original point it tests.
    const calls = readFileSync(join(binDir, "args.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l) as string[]);
    expect(calls[5]![1]).toContain("idea the card doesn't have");
    expect(calls[2]![1]).toContain(CONCEPT.rubric[0]);
    expect(cardsToRemix(lib, [findCard(lib, c.meta.id)])).toEqual([]);
  });

  test("grading a variant uses its key points; stats compare variant and original pass rates", async () => {
    const lib = await tempLibrary();
    const c = await concept(lib);
    const a = variant(lib, c.meta.id, "new-case", "a YouTube explainer");
    fakeClaude([{ rating: 3, gaps: [], feedback: "Good.", covered: [true, true], evidence: ["", ""] }]);
    expect((await gradeAnswer(lib, c.meta.id, "the asked parts", a.id)).covered).toEqual([true, true]);
    const input = JSON.parse(readFileSync(join(binDir, "args.jsonl"), "utf8").split("\n")[0]!)[1] as string;
    expect(input).toContain(a.question);
    expect(remixStats(lib)).toEqual({ variant: { reviews: 0, pass_rate: null }, original: { reviews: 0, pass_rate: null } });
    await review(lib, c.meta.id, 3);
    await review(lib, c.meta.id, 3);
    await review(lib, c.meta.id, 1, a.id);
    await review(lib, c.meta.id, 3);
    expect(remixStats(lib)).toEqual({ variant: { reviews: 1, pass_rate: 0 }, original: { reviews: 1, pass_rate: 1 } });
  });
});

describe("answering in his head (D68)", () => {
  test("offered on an Explain card passed twice since its last miss, never on facts; logged as in_head", async () => {
    const lib = await tempLibrary();
    const c = await concept(lib);
    const fact = await concept(lib, { kind: "card", content_type: "fact", rubric: [] });
    const ok = () => inHeadOk(lib, findCard(lib, c.meta.id));
    expect(ok()).toBe(false); // new: typed
    await review(lib, c.meta.id, 3);
    await review(lib, c.meta.id, 3);
    expect(ok()).toBe(true);
    await recordReview(lib, c.meta.id, { rating: 1, confidence: 3, in_head: true, now: day() });
    expect(own(lib, c.meta.id).at(-1)).toMatchObject({ in_head: true, rating: 1 });
    expect(ok()).toBe(false); // missed: back to typing until two passes
    await review(lib, fact.meta.id, 3);
    await review(lib, fact.meta.id, 3);
    expect(inHeadOk(lib, findCard(lib, fact.meta.id))).toBe(false);
  });
});
