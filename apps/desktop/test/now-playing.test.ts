import { describe, expect, test } from "bun:test";
import { announce, position } from "../src/now-playing";
import type { Player } from "../src/Video";

// A podcast answers the keyboard's play keys, AirPods and Control Center (round 8, pick 4).
const fake = () => {
  const handlers: Record<string, MediaSessionActionHandler | null> = {};
  const state: { position?: MediaPositionState } = {};
  const session = {
    metadata: null as unknown,
    playbackState: "none",
    setActionHandler: (a: string, h: MediaSessionActionHandler | null) => {
      if (a === "seekto") throw new TypeError("not known here");
      handlers[a] = h;
    },
    setPositionState: (s: MediaPositionState) => void (state.position = s),
  };
  return { session: session as unknown as MediaSession, raw: session, handlers, state };
};
const player = (over: Partial<Player> = {}) => {
  const calls: string[] = [];
  const p = { playing: false, play: () => calls.push("play"), toggle: () => calls.push("toggle"), skip: (by: number) => calls.push(`skip ${by}`), seek: (t: number) => calls.push(`seek ${t}`), ...over } as unknown as Player;
  return { p, calls };
};

describe("a playing recording and the system's media controls", () => {
  test("play, pause and the skip and track keys drive the player; an action the webview refuses leaves the rest", () => {
    const { session, handlers } = fake();
    let now = player();
    const off = announce(session, { title: "Episode 12" }, () => now.p);
    handlers.play!({ action: "play" });
    handlers.pause!({ action: "pause" }); // already paused: nothing to do
    now = player({ playing: true });
    handlers.pause!({ action: "pause" });
    handlers.seekbackward!({ action: "seekbackward" });
    handlers.seekforward!({ action: "seekforward", seekOffset: 10 });
    handlers.previoustrack!({ action: "previoustrack" });
    handlers.nexttrack!({ action: "nexttrack" });
    expect(now.calls).toEqual(["toggle", "skip -15", "skip 10", "skip -15", "skip 30"]);
    off();
    expect(handlers.play).toBeNull();
  });

  test("leaving the source takes its name and its place off the controls", () => {
    const { session, raw } = fake();
    (globalThis as { MediaMetadata?: unknown }).MediaMetadata = class {
      constructor(public init: MediaMetadataInit) {}
    };
    try {
      const off = announce(session, { title: "Episode 12", artist: "The Show", artwork: "asset://thumb.jpg" }, () => player().p);
      expect((raw.metadata as { init: MediaMetadataInit }).init).toEqual({ title: "Episode 12", artist: "The Show", artwork: [{ src: "asset://thumb.jpg" }] });
      off();
      expect(raw.metadata).toBeNull();
      expect(raw.playbackState).toBe("none");
    } finally {
      delete (globalThis as { MediaMetadata?: unknown }).MediaMetadata;
    }
  });

  test("the place is told only once the length is known, and never past the end", () => {
    const { session, raw, state } = fake();
    position(session, { duration: 0, rate: 1, playing: true, at: 5 });
    expect(state.position).toBeUndefined();
    expect(raw.playbackState).toBe("playing");
    position(session, { duration: 100, rate: 1.5, playing: false, at: 130 });
    expect(state.position).toEqual({ duration: 100, playbackRate: 1.5, position: 100 });
    expect(raw.playbackState).toBe("paused");
  });
});
