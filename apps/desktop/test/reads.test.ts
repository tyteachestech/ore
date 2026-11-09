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
    expect(read.lands()).toBe(true);
    done();
    await undo;
    await settled();
    expect(read.lands()).toBe(false);
  });

  test("a failed write counts as settled too, and a write that hangs lets a later read land", async () => {
    const g = readGuard();
    const bad = g.writing(Promise.reject(new Error("offline")));
    await bad.catch(() => {});
    await settled();
    const read = g.begin();
    expect(read.lands()).toBe(true);
    g.writing(new Promise(() => {}));
    const later = g.begin();
    expect(later.lands()).toBe(true);
    expect(read.lands()).toBe(false);
  });
});
