import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";

const w = new Window();
for (const k of ["window", "document", "HTMLElement", "Node", "navigator", "localStorage"] as const) {
  const v = (w as unknown as Record<string, unknown>)[k];
  (globalThis as Record<string, unknown>)[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

/** The Mac's audio element, enough of it: a time, a length once its metadata is read, and events. */
class FakeAudio extends EventTarget {
  static last: FakeAudio;
  currentTime = 0;
  duration = 0;
  paused = true;
  ended = false;
  playbackRate = 1;
  preload = "";
  constructor(readonly src: string) {
    super();
    FakeAudio.last = this;
  }
  play = () => Promise.resolve();
  pause = () => {};
  /** The file's metadata arrives. */
  loaded(duration: number) {
    this.duration = duration;
    this.dispatchEvent(new Event("loadedmetadata"));
  }
}
(globalThis as Record<string, unknown>).Audio = FakeAudio;

const { createRoot } = await import("react-dom/client");
const { useAudio } = await import("../src/Video");

// He opens a podcast he left at 12:00 and clicks a [03:10] stamp before the file's metadata is read:
// the saved place used to win when the metadata came, so it played from 12:00.
test("a seek made before the metadata loads is where it plays from, not the saved place", () => {
  localStorage.setItem("ore.video.pod", "720");
  let player: ReturnType<typeof useAudio> | undefined;
  const Probe = () => ((player = useAudio("data:audio/mpeg;base64,", "pod")), null);
  const root = createRoot(document.createElement("div"));
  act(() => root.render(<Probe />));
  act(() => player!.seek(190));
  act(() => FakeAudio.last.loaded(3600));
  expect(FakeAudio.last.currentTime).toBe(190);
  act(() => root.unmount());
});

test("with no seek first, it picks up at the saved place", () => {
  localStorage.setItem("ore.video.pod2", "720");
  const Probe = () => (useAudio("data:audio/mpeg;base64,", "pod2"), null);
  const root = createRoot(document.createElement("div"));
  act(() => root.render(<Probe />));
  act(() => FakeAudio.last.loaded(3600));
  expect(FakeAudio.last.currentTime).toBe(720);
  act(() => root.unmount());
});
