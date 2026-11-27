import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// Exercise the real postMessage effect with a deterministic clock; no player/network/browser.
async function player() {
  const source = readFileSync(new URL("../src/Video.tsx", import.meta.url), "utf8");
  const from = source.indexOf("  // Handshake:");
  const to = source.indexOf("  // Offline,", from);
  const code = new Bun.Transpiler({ loader: "tsx" }).transformSync(source.slice(from, to));
  const { bufferingState } = await import("../src/video-stall").catch(() => ({ bufferingState: undefined }));
  let now = 0, error: number | null = null, message!: (e: unknown) => void, cleanup!: () => void;
  const intervals = new Map<number, () => void>();
  let next = 0;
  const contentWindow = { postMessage() {} };
  const deps = {
    useEffect: (fn: () => () => void) => { cleanup = fn(); },
    video: "abcdefghijk", origin: "http://127.0.0.1:1", frame: { current: { contentWindow } },
    performance: { now: () => now },
    setInterval: (fn: () => void) => { intervals.set(++next, fn); return next; }, clearInterval: (id: number) => intervals.delete(id),
    window: { addEventListener: (_: string, f: typeof message) => { message = f; }, removeEventListener() {} },
    base: { current: { t: 0, at: 0, rate: 1, playing: false } },
    state: { current: -1 }, durationRef: { current: 100 }, seekedAt: { current: -10000 },
    time: () => 1, post() {}, persist() {}, setReady() {}, setRateState() {}, setDuration() {}, setPlaying() {}, setStarted() {}, setEnded() {}, setBlocked() {},
    setError: (v: number | null | ((e: number | null) => number | null)) => { error = typeof v === "function" ? v(error) : v; },
    bufferingState,
  };
  new Function(...Object.keys(deps), code)(...Object.values(deps));
  return {
    state: (info: number) => message({ source: contentWindow, data: JSON.stringify({ event: "onStateChange", info }) }),
    error: () => error,
    fail: (info: number) => message({ source: contentWindow, data: JSON.stringify({ event: "onError", info }) }),
    advance: (ms: number) => { now += ms; for (const fn of [...intervals.values()]) fn(); },
    close: () => { cleanup(); expect(intervals.size).toBe(0); },
  };
}

test("F2: sustained buffering after playback reports a stall and recovery clears it", async () => {
  const p = await player();
  try {
    p.state(1); p.state(3);
    p.advance(4000); expect(p.error()).toBeNull();
    p.state(3); // Repeated buffering reports must not restart the wait.
    p.advance(2000); expect(p.error()).toBe(-4);
    p.state(1); expect(p.error()).toBeNull();
    p.state(2); p.advance(6000); expect(p.error()).toBeNull();
    p.state(3); p.advance(1000); p.state(0); p.advance(6000); expect(p.error()).toBeNull();
    p.fail(100); p.state(3); p.advance(6000); expect(p.error()).toBe(100);
    p.state(1); expect(p.error()).toBe(100);
  } finally { p.close(); }
});

test("buffering detection resets on seek, pause, end and a new buffering period", async () => {
  const { bufferingState } = await import("../src/video-stall");
  expect(bufferingState(null, 3, 100)).toEqual({ since: 100, stalled: false });
  expect(bufferingState(100, 3, 5100)).toEqual({ since: 100, stalled: true });
  expect(bufferingState(100, 3, 5100, 5000)).toEqual({ since: 5000, stalled: false });
  for (const state of [-1, 0, 1, 2, 5]) expect(bufferingState(100, state, 6000)).toEqual({ since: null, stalled: false });
  expect(bufferingState(null, 3, 7000)).toEqual({ since: 7000, stalled: false });
});
