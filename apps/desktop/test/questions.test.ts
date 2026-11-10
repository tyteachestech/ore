import { expect, test } from "bun:test";
import { questionText, typedQuestion } from "../src/Questions";

test("a typed question is told from a highlighted one, however long it is", () => {
  expect(typedQuestion({ exact: "Why does sleep help memory?", item_title: "Why does sleep help memory?" })).toBe(true);
  // addSnippet titles a long question by its first 77 characters and "…".
  const long = "Why does a very long question about the way families negotiate chores across generations keep going?";
  expect(typedQuestion({ exact: long, item_title: long.slice(0, 77).trimEnd() + "…" })).toBe(true);
  // A passage highlighted as a question in a real source.
  expect(typedQuestion({ exact: "The hippocampus replays the day", item_title: "Why We Sleep" })).toBe(false);
  expect(typedQuestion({ exact: long, item_title: "Why does a very long question…" })).toBe(false);
});

test("a question's one line: a highlight's passage reads without its Markdown, a typed question stays as typed", () => {
  expect(questionText({ exact: "Retrieval is **the** [learning event](https://example.test/a),\nnot a measurement", item_title: "Make It Stick" })).toBe("Retrieval is the learning event, not a measurement");
  expect(questionText({ exact: "What do __init__ and *args do?", item_title: "What do __init__ and *args do?" })).toBe("What do __init__ and *args do?");
  expect(questionText({ exact: "The hippocampus *replays* the day", item_title: "Why We Sleep", note: " Why replay? " })).toBe("Why replay?");
});
