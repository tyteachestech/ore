import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { readGuard } from "../src/reads";

// SOAK-01: the home-race red script's held replies, without its browser/CLI.
// Execute Home's actual read callbacks (as settings-saves.test.ts does), with local
// state/cache sinks and deferred ore replies. No copied refresh implementation.
function home() {
  const source = readFileSync(new URL("../src/Home.tsx", import.meta.url), "utf8");
  const start = source.indexOf("  const [today, setToday]");
  const end = source.indexOf("  const [picking, setPicking]", start);
  if (start < 0 || end < 0) throw new Error("Home read callbacks not found");
  const code = new Bun.Transpiler({ loader: "tsx" }).transformSync(source.slice(start, end));
  type Snapshot = { goal_minutes: number };
  const state: unknown[] = [];
  let cached: Snapshot | null = null;
  const replies: { resolve: (t: Snapshot) => void; reject: (e: Error) => void }[] = [];
  const cleanups: (() => void)[] = [];
  const deps = {
    useState(initial: unknown) {
      const n = state.length;
      state.push(typeof initial === "function" ? initial() : initial);
      return [state[n], (value: unknown) => { state[n] = value; }];
    },
    useRef: <T>(current: T) => ({ current }),
    useCallback: <T>(fn: T) => fn,
    useEffect(fn: () => void | (() => void)) { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); },
    useLayoutEffect(fn: () => void) { fn(); },
    useLibraryChanges: () => 0, useDay: () => "2026-11-24", reload: 0,
    readGuard,
    ore: () => new Promise<Snapshot>((resolve, reject) => replies.push({ resolve, reject })),
    lastToday: () => cached,
    rememberToday: (t: Snapshot) => { cached = t; },
    errorText: (e: Error) => e.message,
  };
  const refresh: () => void = new Function(...Object.keys(deps), code + "; return refresh;")(...Object.values(deps));
  return {
    refresh,
    reply: async (n: number, minutes: number) => { replies[n]!.resolve({ goal_minutes: minutes }); await Promise.resolve(); },
    fail: async (n: number) => { replies[n]!.reject(new Error("Today unavailable")); await Promise.resolve(); },
    shown: () => state[0], error: () => state[1], cached: () => cached,
    unmount: () => cleanups.forEach((cleanup) => cleanup()),
  };
}

test("SOAK-01: an older Today reply cannot replace the newer goal on Home or in its cache", async () => {
  const h = home(); // First read held at ten minutes.
  h.refresh();
  await h.reply(1, 15);
  expect(h.shown()).toEqual({ goal_minutes: 15 });
  await h.reply(0, 10);
  expect(h.shown()).toEqual({ goal_minutes: 15 });
  expect(h.cached()).toEqual({ goal_minutes: 15 });
  h.unmount();
});

test("SOAK-01: serial Today replies still update Home and its cache", async () => {
  const h = home();
  await h.reply(0, 10);
  expect(h.shown()).toEqual({ goal_minutes: 10 });
  h.refresh();
  await h.reply(1, 15);
  expect(h.shown()).toEqual({ goal_minutes: 15 });
  expect(h.cached()).toEqual({ goal_minutes: 15 });
  h.unmount();
});

test("SOAK-01: a late failed read cannot hide a newer successful Today", async () => {
  const h = home();
  h.refresh();
  await h.reply(1, 15);
  await h.fail(0);
  expect(h.error()).toBeNull();
  expect(h.cached()).toEqual({ goal_minutes: 15 });
  h.unmount();
});

test("SOAK-01: an old success cannot clear the latest error, and retry can recover", async () => {
  const h = home();
  h.refresh();
  await h.fail(1);
  await h.reply(0, 10);
  expect(h.error()).toBe("Today unavailable");
  expect(h.cached()).toBeNull();
  h.refresh();
  await h.reply(2, 15);
  expect(h.error()).toBeNull();
  expect(h.shown()).toEqual({ goal_minutes: 15 });
  h.unmount();
});

test("SOAK-01: a Today reply after Home unmounts cannot update the shared cache", async () => {
  const h = home();
  h.unmount();
  await h.reply(0, 10);
  expect(h.cached()).toBeNull();
});
