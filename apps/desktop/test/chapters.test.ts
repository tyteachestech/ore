import { describe, expect, test } from "bun:test";
import { chapterMarks } from "../src/Margin";

// D115: a chapter is a division the author made, so chapter recall comes to videos with their own chapters.
describe("chapter marks", () => {
  test("an EPUB's chapters come from its markers", () => {
    const body = "<!-- chapter 1 -->\n\n# One\n\ntext\n\n<!-- chapter 2 -->\n\n# Two\n\nmore\n";
    expect(chapterMarks(body, "epub").map((m) => m.n)).toEqual([1, 2]);
  });

  test("a YouTube video's chapter list (its ### headings) are its chapters, titled by them", () => {
    const body = "### Intro\n\n[00:00] hello\n\n### The testing effect\n\n[03:10] retrieval\n";
    const marks = chapterMarks(body, "youtube");
    expect(marks.map((m) => [m.n, m.title])).toEqual([[1, "Intro"], [2, "The testing effect"]]);
    expect(body.slice(marks[1]!.text, marks[1]!.text + 3)).toBe("The");
  });

  test("an article's headings are not chapters (never invented from headings)", () => {
    expect(chapterMarks("### A\n\ntext\n\n### B\n\ntext\n", "article")).toEqual([]);
  });
});
