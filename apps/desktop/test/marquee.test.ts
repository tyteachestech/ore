import { expect, test } from "bun:test";
import { combine, crossing } from "../src/marquee";

// The box dragged over rows or note blocks (D188, D194): what it crosses, by height only.
const rows = [
  { id: "a", top: 0, bottom: 70 },
  { id: "b", top: 70, bottom: 140 },
  { id: "c", top: 140, bottom: 210 },
];
const ids = (y0: number, y1: number) => crossing(rows, y0, y1).map((r) => r.id);

test("a box takes every row it overlaps, whichever way it is drawn", () => {
  expect(ids(10, 150)).toEqual(["a", "b", "c"]);
  expect(ids(150, 10)).toEqual(["a", "b", "c"]);
  expect(ids(75, 100)).toEqual(["b"]);
});

test("touching a row's edge is not crossing it; a box above or below the rows takes none", () => {
  expect(ids(70, 140)).toEqual(["b"]);
  expect(ids(-40, -5)).toEqual([]);
  expect(ids(220, 400)).toEqual([]);
  expect(ids(200, 400)).toEqual(["c"]);
});

test("a flat box (dragged sideways) takes the row it lies across", () => {
  expect(ids(100, 100)).toEqual(["b"]);
});

const all = ["a", "b", "c", "d", "e"];
test("a plain drag selects only what the box crosses", () => {
  expect(combine(all, ["a", "e"], ["c", "b"], "set")).toEqual(["b", "c"]);
});

test("⇧ adds what it crosses to the selection there was, in list order", () => {
  expect(combine(all, ["e", "a"], ["c"], "add")).toEqual(["a", "c", "e"]);
  expect(combine(all, ["a", "c"], ["c", "d"], "add")).toEqual(["a", "c", "d"]);
});

test("⌘ toggles what it crosses, as Finder does", () => {
  expect(combine(all, ["a", "c"], ["c", "d"], "toggle")).toEqual(["a", "d"]);
  expect(combine(all, [], ["b"], "toggle")).toEqual(["b"]);
});

test("a row no longer in the list is never picked", () => {
  expect(combine(all, ["gone", "a"], ["b"], "add")).toEqual(["a", "b"]);
});
