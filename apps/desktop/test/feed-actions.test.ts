import { expect, test } from "bun:test";
import { markFeedRead } from "../src/feed-actions";
import { History } from "../src/history";
import type { Notify } from "../src/util";

const tick = () => new Promise<void>((r) => setTimeout(r, 0));
function feed(states: boolean[]) {
  let posts = states.map((read, n) => ({ url: `post-${n}`, read }));
  const disk = posts.map((p) => ({ ...p }));
  const calls: string[][] = [];
  const h = new History();
  const notify: Notify = (message, kind, undo, redo) => {
    const step = { message, undo: undo!, redo };
    if (undo) h.push(step);
    return Object.assign(() => h.forget(step), { undo: () => h.take(step), hold: (p: Promise<unknown>) => h.hold(step, p) });
  };
  return {
    h, calls, disk, shown: () => posts.map((p) => p.read),
    mark: (on: boolean) => markFeedRead(posts, on, {
      notify,
      show: (update) => { posts = update(posts); },
      run: async (...args) => {
        calls.push(args);
        for (const p of disk) if (args.slice(2).includes(p.url)) p.read = args[1] === "read";
      },
    }),
  };
}

for (const on of [true, false]) {
  test(`Undo of Mark ${on ? "read" : "unread"} restores each selected post's own state`, async () => {
    const f = feed([true, false]);
    await f.mark(on);
    expect(f.shown()).toEqual([on, on]);
    f.h.undo(); await tick();
    expect(f.disk.map((p) => p.read)).toEqual([true, false]);
    expect(f.shown()).toEqual([true, false]);
    f.h.redo(); await tick();
    expect(f.disk.map((p) => p.read)).toEqual([on, on]);
  });
}


test("Mark read with nothing to change adds no write or Undo step", async () => {
  const f = feed([true, true]);
  await f.mark(true);
  expect(f.calls).toEqual([]);
  expect(f.h.canUndo).toBe(false);
});

test("Mark read and Undo on unread posts still change the whole selection", async () => {
  const f = feed([false, false]);
  await f.mark(true);
  expect(f.calls[0]).toEqual(["feed", "read", "post-0", "post-1"]);
  f.h.undo(); await tick();
  expect(f.disk.map((p) => p.read)).toEqual([false, false]);
});
