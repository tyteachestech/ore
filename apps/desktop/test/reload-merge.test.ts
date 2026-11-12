import { expect, test } from "bun:test";
import { mergeAnns } from "../src/anns";
import type { Annotation } from "../src/ore";
import { singleFlight } from "../src/util";

// A screen that reads the library again while his own changes are still saving (the wake after a highlight
// write, D194's deflake review) must not undo them on screen, nor start a second of a slow job.

const ann = (id: string, over: Partial<Annotation> = {}): Annotation => ({ id, rev: 1, intent: "keep", exact: id, prefix: "", suffix: "", start: 0, end: 1, status: "open", ...over });

test("a reload keeps a highlight still being made, which the library doesn't have yet", () => {
  const local = [ann("a"), ann("pending-1", { intent: "apply" })];
  expect(mergeAnns([ann("a")], local, new Set()).map((a) => a.id)).toEqual(["a", "pending-1"]);
});

test("a reload keeps his unsaved change to a highlight over the library's older copy", () => {
  const local = [ann("a", { intent: "apply", note: "Try it tonight" })];
  expect(mergeAnns([ann("a")], local, new Set(["a"]))).toEqual(local);
});

test("a reload takes the library's copy of a highlight with nothing saving", () => {
  const server = [ann("a", { intent: "question", rev: 2 })];
  expect(mergeAnns(server, [ann("a")], new Set())).toEqual(server);
});

test("a highlight whose save has landed is not kept twice", () => {
  const local = [ann("pending-1")];
  expect(mergeAnns([ann("a")], local, new Set(), new Map([["pending-1", "a"]])).map((a) => a.id)).toEqual(["a"]);
});

test("a key point whose save landed is listed once when a read again lands before the page draws the swap", () => {
  const local = [ann("pending-2", { intent: "card", point: true, note: "Say it aloud" })];
  const server = [ann("p", { intent: "card", point: true, note: "Say it aloud" })];
  expect(mergeAnns(server, local, new Set(), new Map([["pending-2", "p"]])).map((a) => a.id)).toEqual(["p"]);
});

test("a reload drops what the library no longer has, unless it is his own change still saving", () => {
  expect(mergeAnns([], [ann("gone")], new Set()).map((a) => a.id)).toEqual([]);
});

test("a check started while one runs gets that one, and the next starts once it ends", async () => {
  let runs = 0;
  let finish!: () => void;
  const check = singleFlight(() => {
    runs++;
    return new Promise<void>((ok) => (finish = ok));
  });
  const a = check();
  const b = check();
  expect(runs).toBe(1);
  expect(b).toBe(a);
  finish();
  await a;
  void check();
  expect(runs).toBe(2);
  finish();
});
