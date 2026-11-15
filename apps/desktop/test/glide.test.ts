import { expect, test } from "bun:test";
import { glidePlan } from "../src/glide";

// D284: a source that leaves closes its gap; one that comes back opens one. Nothing else slides.
const m = (o: Record<string, number>) => new Map(Object.entries(o));

test("a row that leaves: the rows below move up by its height", () => {
  expect(glidePlan(m({ a: 0, b: 72, c: 144 }), m({ a: 0, c: 72 }))).toEqual({ moved: [["c", 72]], added: [], removed: 1 });
});

test("a row that comes back with Undo arrives, the rows below move down", () => {
  expect(glidePlan(m({ a: 0, c: 72 }), m({ a: 0, b: 72, c: 144 }))).toEqual({ moved: [["c", -72]], added: ["b"], removed: 0 });
});

test("a refilter (rows both leave and arrive), a big change or no change slides nothing", () => {
  expect(glidePlan(m({ a: 0, b: 72 }), m({ a: 0, c: 72 }))).toBeNull();
  expect(glidePlan(m({ a: 0, b: 72 }), m({ a: 0, b: 72 }))).toBeNull();
  const many = m(Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`r${i}`, i * 72])));
  expect(glidePlan(many, m({ r0: 0 }))).toBeNull();
});
