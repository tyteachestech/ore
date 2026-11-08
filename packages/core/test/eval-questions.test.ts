import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { byCheck, codeFailures, judgeFailures, loadQuestionCases, readAndFinish, addSource, sourcePath, type Question } from "../eval/questions.ts";
import { readAnnotations } from "../src/annotations.ts";
import { findItem } from "../src/items.ts";
import { initLibrary } from "../src/init.ts";

const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

const q = (over: Partial<Question>): Question => ({ n: 1, kind: "prompt", question: "In bread baking, why does dough rise?", answer: "Gluten traps the gas.", rubric: ["Gluten traps gas"], ...over });

describe("question-quality eval", () => {
  test("cases load with unique ids, and each source exists", () => {
    const cases = loadQuestionCases();
    expect(cases.length).toBeGreaterThanOrEqual(5);
    for (const c of cases) expect(existsSync(sourcePath(c.source))).toBe(true);
  });

  // No AI: every highlight, line and try anchors in its source, so a run never dies on a typo in the set.
  test("every case reads and finishes in a scratch library", async () => {
    for (const c of loadQuestionCases()) {
      const root = mkdtempSync(join(tmpdir(), "ore-qeval-"));
      roots.push(root);
      await initLibrary(root);
      const lib = { root };
      const item = await addSource(lib, c.source);
      const skip = await readAndFinish(lib, item, c);
      const done = findItem(lib, item.meta.id);
      expect(done.meta.status).toBe("done");
      expect(readAnnotations(done).length).toBe(c.highlights.length + (c.points?.length ?? 0));
      expect(skip.size).toBe(c.highlights.filter((h) => h.skip).length);
    }
  });

  test("a prequestion that asks what the source or its author says fails; one about the idea passes", () => {
    expect(codeFailures(q({ kind: "prequestion", question: "Why do highlights feel like learning?" }), "Priya Natarajan")).toEqual([]);
    for (const bad of ["According to the essay, why do highlights fail?", "Why does Natarajan delete old notes?", "What does the author recommend after reading?"])
      expect(codeFailures(q({ kind: "prequestion", question: bad }), "Priya Natarajan")).toEqual(["code:attributed"]);
    expect(codeFailures(q({ kind: "prequestion", question: "Why do Smith notes fail?" }), "J. (Smith)")).toEqual(["code:attributed"]);
  });

  test("a card points at no source, asks for no list, and keeps its answer short; a prompt may explain a set", () => {
    expect(codeFailures(q({}))).toEqual([]);
    expect(codeFailures(q({ question: "Why does the article say dough rises?" }))).toEqual(["code:points_at_source"]);
    expect(codeFailures(q({ kind: "card", question: "Name the three results of the poke test." }))).toEqual(["code:list_all"]);
    expect(codeFailures(q({ question: "In baking, what are the three results of the poke test, and what does each mean?" }))).toEqual([]);
    expect(codeFailures(q({ kind: "card", answer: "x".repeat(201) }))).toEqual(["code:long_card_answer"]);
  });

  test("the judge's false checks are the failures, counted most first", () => {
    const failed = judgeFailures({ n: 1, faithful: true, distinct: false, rubric_fits: false, why: "distinct: repeats card 1" });
    expect(failed).toEqual(["distinct", "rubric_fits"]);
    const scored = [{ ...q({}), case: "a", failed, why: "" }, { ...q({}), case: "a", failed: ["distinct"], why: "" }];
    expect(byCheck(scored)).toEqual({ distinct: 2, rubric_fits: 1 });
  });
});
