import { expect, test } from "bun:test";
import { pageChunks, pageOf } from "../src/text";

test("a PDF's body is sliced where its pages start, and each slice knows its page", () => {
  const md = "<!-- page 1 -->\n\n# Title\n\nOne.\n\n<!-- page 2 -->\n\nTwo.\n\n```\n<!-- page 9 -->\n```\n\n<!-- page 3 -->\n\nThree.";
  const parts = pageChunks(md);
  expect(parts.map(pageOf)).toEqual([1, 2, 3]); // the one inside a code block is text
  expect(parts.join("\n")).toBe(md);
});

test("a page longer than a slice is cut again, and only its first slice starts the page", () => {
  const long = Array.from({ length: 400 }, (_, i) => `Paragraph ${i} of a long page, with enough words to add up.`).join("\n\n");
  const parts = pageChunks(`<!-- page 1 -->\n\n${long}\n\n<!-- page 2 -->\n\nEnd.`);
  expect(parts.length).toBeGreaterThan(2);
  expect(parts.map(pageOf).filter(Boolean)).toEqual([1, 2]);
});

test("a body with no page marks is sliced as any other", () => {
  expect(pageChunks("# A\n\nText.").map(pageOf)).toEqual([null]);
});
