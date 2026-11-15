import { useSyncExternalStore } from "react";
import { load, save } from "./util";

/* Review's sounds (D-new-review-sounds): one short sound on each key moment of a review and nowhere else. Showing
   the answer is a pickaxe tick, a recall a gem's shine, a miss a gem chipping, the day's goal a chime; the end screen
   has the cart's roll, the mole's pop and a closing jingle. Nothing plays on undo, Later, an edit or any other key.
   The files are ElevenLabs output, kept out of git and taken from the Mac's sounds folder as the radio's are (D254,
   vite.config.ts): one that is missing is just silent. Settings › General › Sound turns them off. */

export const SFX = ["tap", "right", "missed", "goal", "cart", "pop", "done"] as const;
export type Sfx = (typeof SFX)[number];

const KEY = "ore.sounds";
let on = load(KEY) !== "off";
const subs = new Set<() => void>();
export const soundsOn = () => on;
export const useSounds = () => useSyncExternalStore((f) => (subs.add(f), () => void subs.delete(f)), soundsOn);
export function setSounds(v: boolean) {
  on = v;
  save(KEY, v ? "on" : "off");
  subs.forEach((f) => f());
}

// The quick quiz is a window of its own: a change in Settings reaches it too.
if (typeof window !== "undefined")
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    on = e.newValue !== "off";
    subs.forEach((f) => f());
  });

/** How loud they play against the files' own level: under the radio and anything else he has on. */
const LEVEL = 0.6;
/** `rate` 1 is the file as it is, higher plays it higher; `after` is seconds from now. */
type Opts = { rate?: number; after?: number };
type Player = (id: Sfx, o: Required<Opts>) => void;

const PHONE = import.meta.env?.VITE_PHONE === "1"; // the iPhone build carries no sound files
let ctx: AudioContext | null = null;
const buffers = new Map<Sfx, Promise<AudioBuffer | null>>();
function audio() {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}
function buffer(id: Sfx) {
  let b = buffers.get(id);
  if (!b) {
    b = fetch(`/sounds/fx-${id}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((a) => audio().decodeAudioData(a))
      .catch(() => null);
    buffers.set(id, b);
  }
  return b;
}
const webAudio: Player = (id, { rate, after }) => {
  if (PHONE || typeof AudioContext !== "function") return;
  const due = performance.now() + after * 1000;
  void buffer(id).then((buf) => {
    // A sound that loaded too late for its moment is dropped: late, it would land on something else.
    const wait = (due - performance.now()) / 1000;
    if (!buf || !on || wait < -0.3) return;
    const c = audio(), src = c.createBufferSource(), gain = c.createGain();
    src.buffer = buf;
    src.playbackRate.value = rate;
    gain.gain.value = LEVEL;
    src.connect(gain).connect(c.destination);
    src.start(c.currentTime + Math.max(0, wait));
  });
};
let player = webAudio;
/** Tests listen here in place of the speakers. */
export const setPlayer = (p: Player | null) => void (player = p ?? webAudio);

/** Reads the files ahead of the first moment, so the first tick isn't late. */
export function warm() {
  if (on && !PHONE && typeof AudioContext === "function") for (const id of SFX) void buffer(id);
}

export function sfx(id: Sfx, o: Opts = {}) {
  if (!on) return;
  // The journeys' ear: `window.__ORE_SFX = []` collects what played.
  if (import.meta.env?.DEV) (globalThis as { __ORE_SFX?: string[] }).__ORE_SFX?.push(id);
  player(id, { rate: o.rate ?? 1, after: o.after ?? 0 });
}

/** Recalls in a row this session: each plays the shine a semitone higher, up to four (Duolingo's run of right
 *  answers). Heard only, never counted or shown (D23). */
let run = 0;
const TOP = 4;
export const newSession = () => void (run = 0);
/** The sound of a rating: Again (1) is the miss and ends the run; Hard, Good and Easy are a recall, and Good or Easy raise the next one. */
export function rated(rating: number) {
  if (rating <= 1) {
    run = 0;
    return sfx("missed");
  }
  sfx("right", { rate: 2 ** (Math.min(run, TOP) / 12) });
  if (rating >= 3) run++;
}
