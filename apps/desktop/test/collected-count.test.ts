// The reader's collected chips name what they count: one of a thing is singular (F164).
import { expect, test } from "bun:test";
import { collectedCount } from "../src/Collected";
import { count } from "../src/util";

test("one of a type is singular, more are plural", () => {
  expect(collectedCount("question", 1)).toBe("1 Question");
  expect(collectedCount("question", 2)).toBe("2 Questions");
  expect(collectedCount("keep", 1)).toBe("1 Highlight");
  expect(collectedCount("card", 1)).toBe("1 Key point");
  expect(collectedCount("card", 3)).toBe("3 Key points");
  expect(collectedCount("apply", 1)).toBe("1 To try");
});

test("a counted thing: one lesson, two lessons, 1,200 words", () => {
  expect(count(1, "word")).toBe("1 word");
  expect(count(1200, "word")).toBe((1200).toLocaleString() + " words");
  expect(count(1, "lesson")).toBe("1 lesson");
  expect(count(0, "day")).toBe("0 days");
});
