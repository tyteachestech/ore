import { describe, expect, test } from "bun:test";
import { titleScore, asksQuestion } from "../src/Palette";

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

test("accents fold both ways, as Raycast and Linear match them", () => {
  expect(titleScore("Résumé café naïve", "cafe")).toBeGreaterThan(0);
  expect(titleScore("Résumé café naïve", "resume")).toBeGreaterThan(0);
  expect(titleScore("Cafe", "Café")).toBeGreaterThan(0);
  // A look-alike letter from another script is another word.
  expect(titleScore("Spаnish", "spanish")).toBe(0);
});

test("a query of emoji or other non-letters matches the titles that hold it", () => {
  expect(titleScore("🔥📚🧠", "🔥")).toBeGreaterThan(0);
  expect(titleScore("Go to skill: 🔥🔥🔥", "🔥")).toBeGreaterThan(0);
  expect(titleScore("🔥📚🧠", "🔥📚🧠")).toBeGreaterThan(0);
  expect(titleScore("Building effective agents", "🔥")).toBe(0);
});

test("punctuation alone matches nothing, so : . - never list every “Go to skill: …”", () => {
  for (const q of [":", ".", "-", ": -", "&"]) expect(titleScore("Go to skill: AI - notes. & more", q)).toBe(0);
});

test("a title that is the query ranks above one that starts with it", () => {
  expect(titleScore("Spanish", "spanish")).toBeGreaterThan(titleScore("Spanish pronunciation", "spanish"));
  expect(titleScore("Café", "cafe")).toBeGreaterThan(titleScore("Cafe culture", "cafe"));
});

describe("Ask your library in ⌘K", () => {
  test("a query that reads as a question puts Ask first; a title-like query leaves it last", () => {
    for (const q of ["Why does spacing work?", "what is the testing effect", "How do Leitner boxes work", "leitner?"]) expect(asksQuestion(q)).toBe(true);
    for (const q of ["leitner", "testing effect", "what if", "Spaced repetition"]) expect(asksQuestion(q)).toBe(false);
  });
});
