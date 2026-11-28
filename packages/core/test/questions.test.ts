import { describe, expect, test } from "bun:test";
import { findAnnotation } from "../src/annotations.ts";
import { pendingHighlights } from "../src/ai/enrich.ts";
import { addSnippet, addText } from "../src/ingest/index.ts";
import { findItem } from "../src/items.ts";
import { answerQuestion, listQuestions, matchQuestion } from "../src/questions.ts";
import { tempLibrary } from "./helpers.ts";
import { setSystemTime } from "bun:test";
import { reviseAnnotation } from "../src/annotations.ts";

const ARTICLE = "# Spacing\n\nThe best gap is about a tenth of the time until the test.\n";

test("answers written in one millisecond can each be edited and removed by their timestamp", async () => {
  const lib = await tempLibrary();
  const { annotation: q } = await addSnippet(lib, { text: "Why space practice?", intent: "question" });
  let answers;
  try {
    setSystemTime(new Date("2026-11-28T12:00:00Z"));
    await answerQuestion(lib, q.id, { text: "First explanation" });
    await answerQuestion(lib, q.id, { text: "Second explanation" });
    ({ question: { answers } } = await answerQuestion(lib, q.id, { text: "Third explanation" }));
  } finally {
    setSystemTime();
  }
  const second = answers![1]!.ts;
  const edited = await answerQuestion(lib, q.id, { edit: second, text: "Second corrected" });
  expect(edited.question.answers!.map((a) => a.text)).toEqual(["First explanation", "Second corrected", "Third explanation"]);
  expect(new Set(answers!.map((a) => a.ts)).size).toBe(3);
  const removed = await answerQuestion(lib, q.id, { remove: second });
  expect(removed.question.answers!.map((a) => a.text)).toEqual(["First explanation", "Third explanation"]);
});

test("new answer timestamps avoid occupied slots without rewriting legacy contributions", async () => {
  const lib = await tempLibrary();
  const { item, annotation: q } = await addSnippet(lib, { text: "Why space practice?", intent: "question" });
  const old = [
    { ts: "2026-11-28T12:00:00.000Z", text: "First" },
    { ts: "2026-11-28T12:00:00.000Z", text: "Old duplicate" },
    { ts: "2026-11-28T12:00:00.001Z", text: "Next slot" },
    { ts: "hand-edited timestamp", text: "Older accepted data" },
  ];
  reviseAnnotation(item, q, { answers: old });
  try {
    setSystemTime(new Date("2026-11-28T12:00:00Z"));
    const { question } = await answerQuestion(lib, q.id, { text: "New answer" });
    expect(question.answers!.slice(0, 4)).toEqual(old);
    expect(question.answers![4]!.ts).toBe("2026-11-28T12:00:00.002Z");
  } finally {
    setSystemTime();
  }
});

describe("questions → answers and sources (D75)", () => {
  test("contributions build up from several sources; a contribution links its source", async () => {
    const lib = await tempLibrary();
    const { annotation: q } = await addSnippet(lib, { text: "How long should the gap be?", intent: "question", skills: ["learning"] });
    const a = await addText(lib, ARTICLE, { skills: ["learning"] });
    const b = await addText(lib, "# Gaps\n\nLonger gaps cost a little, shorter ones a lot.\n", { skills: ["learning"] });
    await answerQuestion(lib, q.id, { text: "About 10% of the delay.", item: a.meta.id, quote: "a tenth of the time" });
    const { question } = await answerQuestion(lib, q.id, { text: "Err long.", item: b.meta.id });
    expect(question.status).toBe("open");
    const [view] = listQuestions(lib, { skill: "learning" });
    expect(view!.answers.map((c) => [c.text, c.item_title])).toEqual([["About 10% of the delay.", "Spacing"], ["Err long.", "Gaps"]]);
    expect(view!.answers[0]!.quote).toBe("a tenth of the time");

    const ts = view!.answers[1]!.ts;
    await answerQuestion(lib, q.id, { remove: ts });
    expect(findAnnotation(lib, q.id).annotation.answers).toHaveLength(1);
  });

  test("a contribution can be rewritten in place: same place, same source, new words", async () => {
    const lib = await tempLibrary();
    const { annotation: q } = await addSnippet(lib, { text: "How long should the gap be?", intent: "question" });
    const a = await addText(lib, ARTICLE);
    await answerQuestion(lib, q.id, { text: "About 10%.", item: a.meta.id });
    await answerQuestion(lib, q.id, { text: "Err long." });
    const ts = findAnnotation(lib, q.id).annotation.answers![0]!.ts;
    const { question } = await answerQuestion(lib, q.id, { edit: ts, text: "About a tenth of the delay." });
    expect(question.answers!.map((c) => [c.text, c.item])).toEqual([["About a tenth of the delay.", a.meta.id], ["Err long.", undefined]]);
    expect(question.answers![0]!.ts).toBe(ts);
    await expect(answerQuestion(lib, q.id, { edit: ts })).rejects.toThrow(/--text/);
    await expect(answerQuestion(lib, q.id, { edit: "nope", text: "x" })).rejects.toThrow(/no contribution/);
  });

  test("Answered closes it; Answered + card also asks enrich for a card from his answer", async () => {
    const lib = await tempLibrary();
    const { item, annotation: q } = await addSnippet(lib, { text: "Why space practice?", intent: "question" });
    await expect(answerQuestion(lib, q.id, { card: true })).rejects.toThrow(/write one first/);
    expect(pendingHighlights(findItem(lib, item.meta.id), [])).toHaveLength(0);
    const { question } = await answerQuestion(lib, q.id, { text: "Forgetting a little makes recall stronger.", card: true });
    expect(question).toMatchObject({ status: "done", card: true });
    expect(pendingHighlights(findItem(lib, item.meta.id), []).map((a) => a.id)).toEqual([q.id]);
    await expect(answerQuestion(lib, q.id, {})).rejects.toThrow(/nothing to do/);
  });

  test("a source lists questions of its skills, asked in it, or matched to it; Not answered here drops a match", async () => {
    const lib = await tempLibrary();
    const { annotation: mine } = await addSnippet(lib, { text: "How long should the gap be?", intent: "question", skills: ["learning"] });
    const { annotation: far } = await addSnippet(lib, { text: "Do agents need memory?", intent: "question", skills: ["ai"] });
    const { annotation: unrelated } = await addSnippet(lib, { text: "What is a good hook?", intent: "question", skills: ["storytelling-writing"] });
    const src = await addText(lib, ARTICLE, { skills: ["learning"] });
    await matchQuestion(lib, src.meta.id, far.id, { quote: "a tenth of the time", start: 20 });
    const here = listQuestions(lib, { item: src.meta.id });
    expect(Object.fromEntries(here.map((q) => [q.id, q.here]))).toEqual({ [mine.id]: "skill", [far.id]: "match" });
    expect(here.find((q) => q.id === far.id)!.matches).toEqual([{ item: src.meta.id, title: "Spacing", quote: "a tenth of the time", start: 20 }]);
    expect(here.some((q) => q.id === unrelated.id)).toBe(false);

    await matchQuestion(lib, src.meta.id, far.id, { drop: true });
    expect(listQuestions(lib, { item: src.meta.id }).map((q) => q.id)).toEqual([mine.id]);
    expect(findItem(lib, src.meta.id).meta.question_matches).toBeUndefined();
  });
});
