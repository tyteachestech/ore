import { describe, expect, test } from "bun:test";
import { readGuard } from "../src/reads";

// The list's reads (`ore ls`) race its writes (`ore archive`, its Undo); which read lands decides
// whether a row he archived comes back, or the row an Undo put back stays selected.
describe("readGuard", () => {
  const settled = () => new Promise<void>((ok) => setTimeout(ok, 0));

  test("only the newest read lands", () => {
    const g = readGuard();
    const first = g.begin();
    const second = g.begin();
    expect(first.newest()).toBe(false);
    expect(first.lands()).toBe(false);
    expect(second.lands()).toBe(true);
  });

  test("a read begun before a write is dropped once the write starts", () => {
    const g = readGuard();
    const read = g.begin();
    g.writing(new Promise(() => {}));
    expect(read.lands()).toBe(false);
    expect(read.newest()).toBe(true);
  });

  test("a read begun while a write still saves is dropped when that write settles (Undo during the archive's save)", async () => {
    const g = readGuard();
    let done!: () => void;
    const undo = g.writing(new Promise<void>((ok) => (done = ok)));
    const read = g.begin();
    expect(read.lands()).toBe(false);
    done();
    await undo;
    await settled();
    expect(read.lands()).toBe(false);
  });

  test("a failed write lets fresh reads land, but an outstanding write keeps optimistic rows", async () => {
    const g = readGuard();
    const bad = g.writing(Promise.reject(new Error("offline")));
    await bad.catch(() => {});
    await settled();
    const read = g.begin();
    expect(read.lands()).toBe(true);
    g.writing(new Promise(() => {}));
    const later = g.begin();
    expect(later.lands()).toBe(false);
    expect(read.lands()).toBe(false);
  });
});

test("a source read begun during a queued skill Undo cannot put the removed skill back", async () => {
  const guard = readGuard();
  let finishFirst!: () => void, finishSecond!: () => void;
  const first = guard.writing(new Promise<void>((r) => { finishFirst = r; }));
  const second = guard.writing(new Promise<void>((r) => { finishSecond = r; }));
  finishFirst(); await first;
  // The first landing starts a read while the second Undo is still waiting for its reply.
  const read = guard.begin();
  let skills = ["learning", "teaching"];
  const stale = ["learning", "teaching", "ai"];
  if (read.lands()) skills = stale;
  finishSecond(); await second;
  expect(skills).toEqual(["learning", "teaching"]);
  expect(read.lands()).toBe(false);
  expect(guard.begin().lands()).toBe(true);
});


test("field reads remember outstanding writes at their start independently of other reads", async () => {
  const g = readGuard();
  const idle = g.begin();
  g.begin();
  expect(idle.newest()).toBe(false);
  expect(idle.unchanged()).toBe(true);
  let finish!: () => void;
  const write = g.writing(new Promise<void>((r) => { finish = r; }));
  const during = g.begin();
  expect(during.unchanged()).toBe(false);
  finish(); await write;
  expect(during.unchanged()).toBe(false);
  expect(idle.unchanged()).toBe(false);
  expect(g.begin().unchanged()).toBe(true);
});
