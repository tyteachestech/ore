import { expect, test } from "bun:test";
import { dateRows } from "../src/editor/dates";
import { menuTrigger } from "../src/editor/editor";

// Notion's @ dates in a note: what he types after @ and the dates offered. A Thursday.
const NOW = new Date(2026, 10, 5, 15, 30);
const iso = (q: string) => dateRows(q, NOW).map((r) => r.iso);

test("@ alone offers today, tomorrow and yesterday; words narrow them", () => {
  expect(iso("")).toEqual(["2026-11-05", "2026-11-06", "2026-11-04"]);
  expect(iso("to")).toEqual(["2026-11-05", "2026-11-06"]);
  expect(iso("tom")).toEqual(["2026-11-06"]);
  expect(dateRows("", NOW)[0]!.label).toBe("Today");
  expect(dateRows("nov 12", NOW)[0]!.label).toBe("Thursday, Nov 12, 2026");
});

test("weekdays, next and last, in N days or weeks, N days ago", () => {
  expect(iso("mon")).toEqual(["2026-11-09"]);
  expect(iso("thu")).toEqual(["2026-11-12"]); // the coming one, not today
  expect(iso("next fri")).toEqual(["2026-11-13"]);
  expect(iso("last tue")).toEqual(["2026-11-03"]);
  expect(iso("in 3 days")).toEqual(["2026-11-08"]);
  expect(iso("in 2 weeks")).toEqual(["2026-11-19"]);
  expect(iso("4 days ago")).toEqual(["2026-11-01"]);
});

test("a month and day, either way round, and ISO dates", () => {
  expect(iso("nov 12")).toEqual(["2026-11-12"]);
  expect(iso("12 november")).toEqual(["2026-11-12"]);
  expect(iso("jan 3 2027")).toEqual(["2027-01-03"]);
  expect(iso("2026-12-25")).toEqual(["2026-12-25"]);
  expect(iso("feb 30")).toEqual([]);
  expect(iso("banana")).toEqual([]);
});

test("@ opens the menu only at the start of a word, so an email address stays typing", () => {
  expect(menuTrigger("Quiz on @fri")).toEqual({ kind: "date", query: "fri", typed: 4 });
  expect(menuTrigger("@")).toEqual({ kind: "date", query: "", typed: 1 });
  expect(menuTrigger("mail tyler@gmail")).toBe(null);
});
