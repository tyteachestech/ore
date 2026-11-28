import { expect, test } from "bun:test";
import { History } from "../src/history";

const log: string[] = [];
const step = (name: string, redoable = true) => ({
  message: name,
  undo: async () => void log.push(`undo ${name}`),
  redo: redoable ? async () => void log.push(`redo ${name}`) : undefined,
});

test("undo walks back a run of steps, redo walks forward, newest first", async () => {
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
  await Bun.sleep(0);
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

test("a toast's own Undo takes back its step out of order, and its Redo does it again", async () => {
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
  await Bun.sleep(0);
  expect(log).toEqual(["undo a", "undo b", "redo a"]);
  expect(h.undo()?.message).toBe("a");
});

test("an undo whose write fails goes back on the history and says why; redo can't replay it", async () => {
  const failed: string[] = [];
  const h = new History((s, e, what) => failed.push(`${what} ${s.message}: ${(e as Error).message}`));
  const ok = step("a");
  h.push(ok);
  const bad = { message: "b", undo: () => Promise.reject(new Error("disk full")), redo: async () => {} };
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
  const s = { message: "a", undo: async () => {}, redo: () => Promise.reject(new Error("offline")) };
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
  const ok = { message: "c", undo: async () => {}, redo: () => Promise.reject(new Error("offline")) };
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

// A step that throws its write's promise away can't fail: the history counts it done, and a failed
// write (the figure card's Undo) was an unhandled rejection with no message. Each returns its write.
test("no undo or redo step throws away its write's promise", async () => {
  const { Glob } = await import("bun");
  const found: string[] = [];
  for await (const f of new Glob("**/*.tsx").scan(`${import.meta.dir}/../src`)) {
    const lines = (await Bun.file(`${import.meta.dir}/../src/${f}`).text()).split("\n");
    lines.forEach((l, i) => /(?:^|, )\s*\(\) => void (?:ore|apply)\(/.test(l) && found.push(`${f}:${i + 1}`));
  }
  expect(found).toEqual([]);
});

test("a step that lands is reported, so screens opened since can read their data again; one that fails isn't", async () => {
  let landed = 0;
  const h = new History(undefined, () => landed++);
  h.push({ message: "a", undo: async () => {}, redo: () => Promise.reject(new Error("offline")) });
  h.undo();
  await Promise.resolve();
  await Promise.resolve();
  expect(landed).toBe(1);
  h.redo();
  await new Promise((r) => setTimeout(r, 0));
  expect(landed).toBe(1);
});

test("it names what undo and redo would take and says each time that changes, for the iPhone's shake and swipe (F161)", async () => {
  const h = new History();
  const seen: [string | undefined, string | undefined][] = [];
  h.onChange = () => seen.push([h.undoName, h.redoName]);
  h.push(step("a"));
  h.push(step("b"));
  h.undo();
  h.redo();
  h.forget(h.undo()!);
  h.push({ message: "c", undo: () => Promise.reject(new Error("offline")) });
  h.undo();
  await new Promise((r) => setTimeout(r, 0));
  expect(seen).toEqual([
    ["a", undefined],
    ["b", undefined],
    ["a", "b"],
    ["b", undefined],
    ["a", "b"],
    ["a", undefined],
    ["c", undefined],
    ["a", undefined],
    ["c", undefined], // its undo failed: it is back on top
  ]);
});

/** A write that lands when `land` is called (or fails with `fail`). */
const slow = () => {
  let land!: () => void, fail!: (e: Error) => void;
  const p = new Promise<void>((res, rej) => ((land = res), (fail = rej)));
  return { p, land, fail };
};

test("a held step's undo and redo wait for its write, then run in the order asked (review of #442)", async () => {
  log.length = 0;
  const h = new History();
  const a = step("a");
  h.push(a);
  const b = step("b");
  h.push(b);
  const w = slow();
  h.hold(b, w.p);
  h.undo(); // b: waits for its write
  h.redo(); // b again: after that undo
  h.undo(); // b
  h.undo(); // a: after b's undo, though its own write is long done
  await Bun.sleep(0);
  expect(log).toEqual([]);
  w.land();
  await Bun.sleep(0);
  expect(log).toEqual(["undo b", "redo b", "undo b", "undo a"]);
});

test("a step after a slow undo waits for it: each undo's write lands in the order he pressed ⌘Z (review of #442)", async () => {
  const seen: string[] = [];
  const h = new History();
  const w = slow();
  h.push({ message: "a", undo: async () => void seen.push("undo a") });
  h.push({ message: "b", undo: () => w.p.then(() => void seen.push("undo b")) });
  h.undo();
  h.undo();
  await Bun.sleep(0);
  expect(seen).toEqual([]);
  w.land();
  await Bun.sleep(0);
  expect(seen).toEqual(["undo b", "undo a"]);
});

test("a held step whose write fails is taken off, and an undo already asked for never runs (review of #442)", async () => {
  log.length = 0;
  const h = new History();
  h.push(step("a"));
  const b = step("b");
  h.push(b);
  const w = slow();
  h.hold(b, w.p);
  h.undo();
  w.fail(new Error("offline"));
  await Bun.sleep(0);
  expect(log).toEqual([]);
  expect(h.canRedo).toBe(false);
  expect(h.undoName).toBe("a");
});

// History recovery pass (app-02): after a restore from the library's history, a step whose change the restore took
// back (a rating no longer in the log, a note or importance changed since) failed the same way on every ⌘Z and hid
// every step before it. One that can never apply leaves the history; the next ⌘Z goes on to the step before.
test("an undo that can never apply says why and leaves the history: the next ⌘Z takes the step before", async () => {
  const { Stale } = await import("../src/history");
  const failed: string[] = [];
  const h = new History((s, e, what) => failed.push(`${what} ${s.message}: ${(e as Error).message}`));
  const ok = step("a");
  h.push(ok);
  const gone = { message: "b", undo: () => Promise.reject(new Stale("that rating is no longer in the library")), redo: async () => {} };
  h.push(gone);
  expect(h.undo()).toBe(gone);
  await Bun.sleep(0);
  expect(failed).toEqual(["undo b: that rating is no longer in the library"]);
  expect(h.canRedo).toBe(false);
  expect(h.undo()).toBe(ok);
});
