import { expect, test } from "bun:test";
import { lines, passage } from "../src/original-match";

// D-new-original-lit: the Original tab lights the passage he clicked in the text, found among the page's own runs.
const page = ["Chapter 1", " ", "Spacing out ses-", "sions beats cram", "ming. The ef", "ﬁ", "cient way is", "to wait.", "x = y + 2", "Spacing again."];

test("a passage is found across the page's runs, however import rejoined its hyphens, spaces and ligatures", () => {
  expect(passage(page, "Spacing out sessions beats cramming.")).toEqual([2, 4]);
  expect(passage(page, "The efficient way is to wait.")).toEqual([4, 7]);
  expect(passage(page, "Chapter 1")).toEqual([0, 0]);
  // A passage that says a thing twice is still one place.
  expect(passage(["Title", "Test yourself often. ", "Test yourself often.", "End"], "Test yourself often. Test yourself often.")).toEqual([1, 2]);
});

test("a passage whose start import rewrote (a formula) is still found by its middle or end", () => {
  expect(passage(["Given ", "α²+β²", " the efficient learner waits between each of the sessions and gains."], "Given $\\alpha^2+\\beta^2$ the efficient learner waits between each of the sessions and gains.")).toEqual([0, 2]);
});

test("words the page lacks, or has twice, light nothing: never a wrong place", () => {
  expect(passage(page, "Nothing like this is on the page")).toBeNull();
  expect(passage([], "A scanned page has no runs at all")).toBeNull();
  expect(passage(["Spacing works.", "Spacing works."], "Spacing works.")).toBeNull();
  expect(passage(page, "a.")).toBeNull();
});

test("the runs' boxes join into one bar a line", () => {
  expect(lines([
    { left: 10, top: 10, width: 30, height: 10 },
    { left: 42, top: 11, width: 20, height: 10 },
    { left: 10, top: 24, width: 15, height: 10 },
    { left: 0, top: 0, width: 0, height: 10 },
  ])).toEqual([
    { left: 10, top: 10, width: 52, height: 11 },
    { left: 10, top: 24, width: 15, height: 10 },
  ]);
});
