import { expect, test } from "bun:test";
import { History } from "../src/history";

const log: string[] = [];
const step = (name: string, redoable = true) => ({
  message: name,
  undo: () => log.push(`undo ${name}`),
  redo: redoable ? () => log.push(`redo ${name}`) : undefined,
});

test("undo walks back a run of steps, redo walks forward, newest first", () => {
  log.length = 0;
  const h = new History();
  h.push(step("a"));
  h.push(step("b"));
  expect(h.undo()?.message).toBe("b");
  expect(h.undo()?.message).toBe("a");
  expect(h.undo()).toBeUndefined();
  expect(h.redo()?.message).toBe("a");
  expect(h.redo()?.message).toBe("b");
  expect(h.redo()).toBeUndefined();
  expect(log).toEqual(["undo b", "undo a", "redo a", "redo b"]);
});

test("a new step drops what could be redone", () => {
  const h = new History();
  h.push(step("a"));
  h.undo();
  h.push(step("b"));
  expect(h.canRedo).toBe(false);
});

test("undoing a step that can't be redone ends the redo run", () => {
  const h = new History();
  h.push(step("a", false));
  h.push(step("b"));
  h.undo();
  expect(h.canRedo).toBe(true);
  h.undo();
  expect(h.canRedo).toBe(false);
});

test("a forgotten step is gone from undo, as if it never went on", () => {
  log.length = 0;
  const h = new History();
  h.push(step("a"));
  const b = step("b");
  h.push(b);
  h.forget(b);
  expect(h.undo()?.message).toBe("a");
  expect(h.canUndo).toBe(false);
  expect(log).toEqual(["undo a"]);
});

test("a toast's own Undo takes back its step out of order, and its Redo does it again", () => {
  log.length = 0;
  const h = new History();
  const a = step("a");
  const b = step("b");
  h.push(a);
  h.push(b);
  expect(h.take(a)).toBe(true);
  expect(h.take(a)).toBe(false);
  expect(h.undo()?.message).toBe("b");
  expect(h.again(a)).toBe(true);
  expect(h.again(a)).toBe(false);
  expect(log).toEqual(["undo a", "undo b", "redo a"]);
  expect(h.undo()?.message).toBe("a");
});

test("an undo whose write fails goes back on the history and says why; redo can't replay it", async () => {
  const failed: string[] = [];
  const h = new History((s, e, what) => failed.push(`${what} ${s.message}: ${(e as Error).message}`));
  const ok = step("a");
  h.push(ok);
  const bad = { message: "b", undo: () => Promise.reject(new Error("disk full")), redo: () => {} };
  h.push(bad);
  expect(h.undo()).toBe(bad);
  await Bun.sleep(0);
  expect(failed).toEqual(["undo b: disk full"]);
  expect(h.canRedo).toBe(false); // nothing was undone, so nothing to redo
  expect(h.undo()).toBe(bad); // ⌘Z tries it again, not the step before it
});

test("a redo whose write fails goes back to the redo stack", async () => {
  const failed: string[] = [];
  const h = new History((s, _e, what) => failed.push(`${what} ${s.message}`));
  const s = { message: "a", undo: () => {}, redo: () => Promise.reject(new Error("offline")) };
  h.push(s);
  h.undo();
  expect(h.redo()).toBe(s);
  await Bun.sleep(0);
  expect(failed).toEqual(["redo a"]);
  expect(h.canUndo).toBe(false);
  expect(h.canRedo).toBe(true);
});

test("a toast's own Undo whose write fails puts the step back, and so does its Redo", async () => {
  const failed: string[] = [];
  const h = new History((s, _e, what) => failed.push(`${what} ${s.message}`));
  const a = step("a");
  const bad = { message: "b", undo: () => Promise.reject(new Error("disk full")), redo: () => Promise.reject(new Error("offline")) };
  h.push(bad);
  h.push(a);
  expect(h.take(bad)).toBe(true);
  await Bun.sleep(0);
  expect(failed).toEqual(["undo b"]);
  expect(h.canRedo).toBe(false);
  expect(h.take(bad)).toBe(true); // still on the history, so its toast's Undo can try again
  await Bun.sleep(0);
  const ok = { message: "c", undo: () => {}, redo: () => Promise.reject(new Error("offline")) };
  h.push(ok);
  h.undo();
  expect(h.again(ok)).toBe(true);
  await Bun.sleep(0);
  expect(failed).toEqual(["undo b", "undo b", "redo c"]);
  expect(h.canRedo).toBe(true); // nothing was redone, so Redo offers it again
  expect(h.again(ok)).toBe(true);
});

test("the history keeps the newest 50 steps; the oldest fall off", () => {
  const h = new History();
  for (let i = 1; i <= 55; i++) h.push(step(String(i)));
  const undone: string[] = [];
  for (let s = h.undo(); s; s = h.undo()) undone.push(s.message);
  expect(undone).toHaveLength(50);
  expect(undone[0]).toBe("55");
  expect(undone.at(-1)).toBe("6");
});
