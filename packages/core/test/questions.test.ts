import { describe, expect, test } from "bun:test";
import { findAnnotation } from "../src/annotations.ts";
import { pendingHighlights } from "../src/ai/enrich.ts";
import { addSnippet, addText } from "../src/ingest/index.ts";
import { findItem } from "../src/items.ts";
import { answerQuestion, listQuestions, matchQuestion } from "../src/questions.ts";
import { tempLibrary } from "./helpers.ts";

const ARTICLE = "# Spacing\n\nThe best gap is about a tenth of the time until the test.\n";

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
