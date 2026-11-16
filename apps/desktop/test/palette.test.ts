import { describe, expect, test } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { titleScore, asksQuestion, textHits, snippet } from "../src/Palette";

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

// F343 (review of #440): a source found in ⌘K by its author, skill or type was listed in
// Sources, and its match in the text was dropped with it, losing the snippet and the place it lands.
test("only a source listed by its title loses its row in “In the text”", () => {
  const listed = [{ id: "a", title: "Retrieval practice" }, { id: "b", title: "Make it stick" }];
  const hits = [{ key: "text item a", item: "a", title: "Retrieval practice" }, { key: "text item b", item: "b", title: "Make it stick", at: "find:retrieval" }, { key: "skill notes s", skill: "s", title: "Memory" }];
  expect(textHits(hits, listed, "retrieval").map((h) => h.key)).toEqual(["text item b", "skill notes s"]);
});

// F-new-snippet-markup (round 7 walk): a PDF's match read "<!-- page 1 --> ### Retrieval practice Testing…",
// and a book's kept its code fence and quote mark.
test("a search snippet shows the source's words without its Markdown", () => {
  const words = (text: string) => renderToStaticMarkup(createElement("p", null, snippet(text, "test")));
  expect(words("<!-- page 1 -->\n\n### Retrieval practice\n\n[Testing] yourself beats rereading")).toBe("<p>Retrieval practice <mark>Testing</mark> yourself beats rereading</p>");
  expect(words("return gap * 2.5 if remembered else 1\n```\n\n> [Test] yourself **before** you `look`")).toBe("<p>return gap * 2.5 if remembered else 1 <mark>Test</mark> yourself before you look</p>");
  // A comment the snippet's edge cut in two goes too, from either end.
  expect(words("ge 3 --> the [test] came <!-- pa")).toBe("<p>the <mark>test</mark> came </p>");
  // A link's own brackets stay, and so does a # or > that is part of the words.
  expect(words("see [the paper](x) on C# and a > b [tests]")).toBe("<p>see [the paper](x) on C# and a &gt; b <mark>tests</mark></p>");
});
