import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";

const w = new Window();
for (const k of ["window", "document", "HTMLElement", "HTMLFormElement", "Node", "navigator", "localStorage", "ResizeObserver", "getComputedStyle"] as const) {
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
  /** Let go of its file, as an element whose `src` is taken off and loaded again does. */
  released = false;
  removeAttribute = (name: string) => void (name === "src" && (this.released = true));
  load = () => {};
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

test("a skip before the metadata loads goes from the saved place", () => {
  localStorage.setItem("ore.video.pod3", "1500");
  let player: ReturnType<typeof useAudio> | undefined;
  const Probe = () => ((player = useAudio("data:audio/mpeg;base64,", "pod3")), null);
  const root = createRoot(document.createElement("div"));
  act(() => root.render(<Probe />));
  act(() => player!.skip(10));
  act(() => FakeAudio.last.loaded(3600));
  expect(FakeAudio.last.currentTime).toBe(1510);
  act(() => root.unmount());
});

// Codex sweep 5: the reader holds a YouTube player for every source, idle on a recording, while the recording's
// own player lives above it (App's, so it plays on across screens). Leaving, the idle one's cleanup saved the
// place it read on opening over the recording's, so a second visit lost its progress.
test("leaving a recording keeps where it got to, not where it opened", async () => {
  const { useYouTube } = await import("../src/Video");
  localStorage.setItem("ore.video.rec", "30");
  let player: ReturnType<typeof useAudio> | undefined;
  const Reader = () => (useYouTube(undefined, "rec"), null);
  const App = ({ reading }: { reading: boolean }) => ((player = useAudio("data:audio/mpeg;base64,", "rec")), reading ? <Reader /> : null);
  const root = createRoot(document.createElement("div"));
  act(() => root.render(<App reading />));
  act(() => FakeAudio.last.loaded(60));
  act(() => player!.skip(-15));
  act(() => root.render(<App reading={false} />));
  expect(localStorage.getItem("ore.video.rec")).toBe("15");
  act(() => root.unmount());
});

// Codex sweep 5 review: Try again on a recording that never loaded makes a new element; the old one must let go
// of its stalled request, not keep it open beside the new one.
test("Try again lets go of the file the stalled element still waits on", () => {
  let player: ReturnType<typeof useAudio> | undefined;
  const Probe = () => ((player = useAudio("data:audio/mpeg;base64,", "stall")), null);
  const root = createRoot(document.createElement("div"));
  act(() => root.render(<Probe />));
  const first = FakeAudio.last;
  act(() => player!.retry!());
  expect(FakeAudio.last).not.toBe(first);
  expect(first.released).toBe(true);
  act(() => root.unmount());
});

// Codex sweep 5 review: the loading line's delay said true for one more render once the wait was over,
// so a frame of "Loading the recording…" could show over a recording that had just loaded.
test("a wait's delayed line is gone in the very render its wait ends", async () => {
  const { useAfter } = await import("../src/Video");
  const seen: boolean[] = [];
  const Probe = ({ on }: { on: boolean }) => (seen.push(useAfter(on, 1)), null);
  const root = createRoot(document.createElement("div"));
  act(() => root.render(<Probe on />));
  await act(() => new Promise((r) => setTimeout(r, 20)));
  expect(seen.at(-1)).toBe(true);
  const from = seen.length;
  act(() => root.render(<Probe on={false} />));
  expect(seen.slice(from)).not.toContain(true);
  act(() => root.unmount());
});

// Codex sweep 5 review: an episode whose transcript is still owed (D227) has none below; its file that never came
// says so as its other error does.
test("an owed episode's file that hasn't loaded says its transcript is on its way", async () => {
  const { VideoPlayer } = await import("../src/Video");
  const { HintProvider } = await import("../src/Hint");
  const said = (owed: boolean) => {
    const box = document.createElement("div");
    const root = createRoot(box);
    const player = { frame: { current: null }, src: "", ready: false, playing: false, started: false, ended: false, error: -3, blocked: false, duration: 0, rate: 1, elapsed: 0, time: () => 0, toggle() {}, play() {}, seek() {}, skip() {}, setRate() {}, retry() {} };
    act(() => root.render(<HintProvider><VideoPlayer player={player} title="Episode" onFinish={() => {}} onOpen={() => {}} audio owed={owed} /></HintProvider>));
    const text = box.querySelector(".video-error")?.textContent ?? "";
    act(() => root.unmount());
    return text;
  };
  expect(said(true)).toContain("Its transcript is on its way.");
  expect(said(false)).toContain("Its transcript is below.");
});
