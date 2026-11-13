import { expect, test } from "bun:test";
import { sectionName } from "../src/Outline.tsx";

test("the reading pill names the section he is in, and above the first heading never one from further down (F66)", () => {
  const book = [{ level: 2, title: "Preface" }, { level: 2, title: "Classes" }, { level: 1, title: "inside class Time:" }];
  expect(sectionName(book, 1)).toBe("Classes");
  expect(sectionName(book, -1)).toBe(""); // at the top of a book whose only top heading is on page 188
  // An article that opens with its own title as the top heading is in it from the start.
  expect(sectionName([{ level: 1, title: "Great work" }, { level: 2, title: "Curiosity" }], -1)).toBe("Great work");
  expect(sectionName([], -1)).toBe("");
});
