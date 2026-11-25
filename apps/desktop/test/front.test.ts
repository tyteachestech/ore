import { expect, test } from "bun:test";
import { frontEnd } from "../src/front";

const MARK = "<!-- end of front matter -->";

test("front matter: a book folds at the mark the import writes, on a line of its own", () => {
  const md = `<!-- chapter 1 -->\n\nCopyright © 2020\n\n${MARK}\n\n<!-- chapter 2 -->\n\n# One\n`;
  expect(frontEnd(md, true)).toBe(md.indexOf(MARK));
});

test("front matter: the mark's words quoted in a paragraph or code, or in a source that is not a book, fold nothing", () => {
  expect(frontEnd(`Ore writes \`${MARK}\` after a book's front matter.\n\nMore text.\n`, true)).toBe(-1);
  expect(frontEnd("```\n" + MARK + " here\n```\n", true)).toBe(-1);
  expect(frontEnd(`Intro\n\n${MARK}\n\nText\n`, false)).toBe(-1);
});
