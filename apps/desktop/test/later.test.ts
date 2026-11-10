import { expect, test } from "bun:test";
import { putOff, type DueEntry } from "../src/ore";

const due = (id: string, over: Partial<DueEntry> = {}): DueEntry => ({ id, kind: "card", state: "live", item: "I", skills: [], question: "q", relearn: false, due: "2026-10-01T00:00:00Z", retrievability: 0.8, ...over });
const ids = (q: DueEntry[] | null) => q?.map((e) => e.id) ?? null;

test("Later sends the exercise on screen to the end of the session, the rest in their order", () => {
  expect(ids(putOff([due("a"), due("b"), due("c")], new Set()))).toEqual(["b", "c", "a"]);
  // A miss waiting for its relearn pass keeps it (D21).
  const q = putOff([due("a", { relearn: true }), due("b")], new Set());
  expect(q?.map((e) => [e.id, e.relearn])).toEqual([["b", false], ["a", true]]);
});

test("the session ends when every exercise left has been put off: the only one left, or a whole pass of Laters", () => {
  expect(putOff([due("a")], new Set())).toBeNull();
  expect(putOff([due("c"), due("a"), due("b")], new Set(["a", "b"]))).toBeNull();
  expect(putOff([], new Set())).toBeNull();
});

test("one put off before can be put off again while one he hasn't put off is still waiting", () => {
  expect(ids(putOff([due("a"), due("b"), due("c")], new Set(["a"])))).toEqual(["b", "c", "a"]);
  expect(ids(putOff([due("a"), due("b")], new Set(["a"])))).toEqual(["b", "a"]);
});

test("Laters in a row always reach the end: each one either meets a new exercise or ends the session", () => {
  let q: DueEntry[] | null = [due("a"), due("b"), due("c"), due("d")];
  const off = new Set<string>();
  let n = 0;
  while (q) {
    const head: string = q[0]!.id;
    q = putOff(q, off);
    off.add(head);
    if (++n > 10) throw new Error("Later looped");
  }
  expect(n).toBe(4);
});
