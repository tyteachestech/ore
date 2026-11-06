import { expect, test } from "bun:test";
import { titleScore } from "../src/Palette";

test("a title matches only when every query word is in it", () => {
  expect(titleScore("Notes on spaced repetition scheduling (FSRS)", "section")).toBe(0);
  expect(titleScore("The Testing Effect: Why Retrieval Beats Rereading", "retrieval")).toBeGreaterThan(0);
  expect(titleScore("The Testing Effect", "testing nope")).toBe(0);
});

test("C# and C++ match as words, not as every title with a c-word", () => {
  expect(titleScore("Chord voicings, explained", "c#")).toBe(0);
  expect(titleScore("Common idioms", "c++")).toBe(0);
  expect(titleScore("Advanced C# and .NET Runtime Internals", "c#")).toBeGreaterThan(0);
  expect(titleScore("Go to skill: C++", "c++")).toBeGreaterThan(0);
});

test("a word start ranks above a match inside a word, and the title's first word above both", () => {
  const start = titleScore("How to write good prompts", "prompt");
  const inside = titleScore("Teleprompters for creators", "prompt");
  const first = titleScore("Prompting basics", "prompt");
  expect(start).toBeGreaterThan(inside);
  expect(first).toBeGreaterThan(start);
});
