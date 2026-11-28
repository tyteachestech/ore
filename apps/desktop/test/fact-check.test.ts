import { expect, test } from "bun:test";
import { factMatches } from "../src/fact-check";

// D359: a Fact exercise is typed, and code says whether what he typed is the answer, so ↵ suggests
// Good only when it is. It may say "no" to a right answer worded differently (he rates it himself then), but
// never "yes" to a wrong one: a wrong number, a different word, an empty box.

test("the same answer, whatever its case, spacing, punctuation, accents or leading article", () => {
  expect(factMatches("hippocampus", "The hippocampus.")).toBe(true);
  expect(factMatches("  Working   Memory ", "working memory")).toBe(true);
  expect(factMatches("cafe", "Café")).toBe(true);
  expect(factMatches("an index", "Index")).toBe(true);
  expect(factMatches("spaced-repetition", "spaced repetition")).toBe(true);
});

test("a typo in a longer word still matches; a short word or a number must be exact", () => {
  expect(factMatches("hipocampus", "hippocampus")).toBe(true);
  expect(factMatches("interleavnig", "interleaving")).toBe(true);
  expect(factMatches("cat", "car")).toBe(false);
  expect(factMatches("1907", "1906")).toBe(false);
  expect(factMatches("0.43", "0.48")).toBe(false);
});

test("what an answer puts in brackets is optional", () => {
  expect(factMatches("FSRS", "FSRS (Free Spaced Repetition Scheduler)")).toBe(true);
  expect(factMatches("Free Spaced Repetition Scheduler", "FSRS (Free Spaced Repetition Scheduler)")).toBe(true);
});

test("an empty box, a different answer or part of a phrase never matches", () => {
  expect(factMatches("", "hippocampus")).toBe(false);
  expect(factMatches("   ", "hippocampus")).toBe(false);
  expect(factMatches("amygdala", "hippocampus")).toBe(false);
  expect(factMatches("recall", "The group that took a recall test.")).toBe(false);
  expect(factMatches("the", "The")).toBe(true);
});
