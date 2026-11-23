import { useSyncExternalStore } from "react";
import { load, save } from "./util";

/* Review's sounds (D336, which replaced D277's "one sound on each key moment and nowhere else"):
   as satisfying as the apps whose sounds reward, and layered where that is better. Showing the answer is a pickaxe
   tick, a recall a gem's shine, a miss a gem chipping, the day's goal a chime; the end screen has the cart's roll,
   the mole's pop and a closing jingle, and over them a layer for each thing that lands (`layer`): the minutes
   counting, each skill's row, each result, the mole's letters.
   The files are ElevenLabs output, kept out of git and taken from the Mac's sounds folder as the radio's are (D254,
   vite.config.ts): one that is missing is just silent. The iPhone build carries them too. Settings › General › Sound
   has a switch for the sound effects and one for the mole. */

export const SFX = ["tap", "right", "missed", "goal", "cart", "pop", "done"] as const;
export type Sfx = (typeof SFX)[number];
/** The mole's voice (D330): what he says aloud as he comes up at a session's end, and only on a day worth a word
 *  (`endVoice` in end-says.ts). Files `vo-<line>.mp3`, kept beside the others. */
export const VOICE = ["cheer", "happy", "proud", "surprised", "curious"] as const;
export type MoleLine = (typeof VOICE)[number];
export type Sound = Sfx | MoleLine;
/** The mole's own: his voice and the pop as he comes up. Settings turns these off apart from the rest. */
const moles = (id: Sound) => id === "pop" || (VOICE as readonly string[]).includes(id);
const file = (id: Sound) => `${(VOICE as readonly string[]).includes(id) ? "vo" : "fx"}-${id}`;

/** A switch in Settings, kept on this device. The quick quiz is a window of its own: a change reaches it too.
 *  Never set, it starts as `was` is: Mole's voice came in after Sound effects, which had his pop, so someone who had
 *  turned that off doesn't start hearing him. */
function kept(key: string, was?: string) {
  let on = (load(key) ?? (was ? load(was) : null)) !== "off";
  const subs = new Set<() => void>();
  const tell = () => subs.forEach((f) => f());
  if (typeof window !== "undefined")
    window.addEventListener("storage", (e) => {
      if (e.key !== key) return;
      on = e.newValue !== "off";
      tell();
    });
  const get = () => on;
  return { get, use: () => useSyncExternalStore((f) => (subs.add(f), () => void subs.delete(f)), get), set: (v: boolean) => (on = v, save(key, v ? "on" : "off"), tell()) };
}
const effects = kept("ore.sounds"), voice = kept("ore.voice", "ore.sounds");
export const useSounds = effects.use, setSounds = effects.set;
export const useVoice = voice.use, setVoice = voice.set;
const allowed = (id: Sound) => (moles(id) ? voice : effects).get();

/** How loud they play against the files' own level: under the radio and anything else he has on. */
const LEVEL = 0.6;
/** `rate` 1 is the file as it is, higher plays it higher; `after` is seconds from now; `level` is how loud against a
 *  sound on its own; `over` plays it over whatever is sounding (`layer`). */
type Opts = { rate?: number; after?: number; level?: number; over?: boolean };
type Player = (id: Sound, o: Required<Opts>) => void;

/** The sounds this build has (vite.config.ts): one whose file was not on the Mac at build time is never asked for. */
declare const __ORE_FX__: string[] | undefined;
const HAVE = typeof __ORE_FX__ === "undefined" || typeof AudioContext !== "function" ? [] : __ORE_FX__;
let ctx: AudioContext | null = null;
const buffers = new Map<Sound, Promise<AudioBuffer | null>>();
function audio() {
  ctx ??= new AudioContext();
  // Not only "suspended": iOS leaves it "interrupted" after a call or a trip to another app.
  if (ctx.state !== "running") void ctx.resume();
  return ctx;
}
function buffer(id: Sound) {
  let b = buffers.get(id);
  if (!b) {
    b = fetch(`/sounds/${file(id)}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((a) => audio().decodeAudioData(a))
      .catch(() => null);
    buffers.set(id, b);
  }
  return b;
}
const webAudio: Player = (id, { rate, after, level, over }) => {
  if (!HAVE.includes(id)) return;
  // Made and woken here, inside his key or click: WebKit leaves a context asleep that was woken outside one.
  audio();
  const due = performance.now() + after * 1000, turns = feedback(id) && !over;
  const play = (buf: AudioBuffer | null) => {
    // A sound that loaded too late for its moment is dropped: late, it would land on something else.
    const wait = (due - performance.now()) / 1000;
    if (!buf || !allowed(id) || hidden() || wait < -0.3) return;
    const c = audio(), src = c.createBufferSource(), gain = c.createGain();
    src.buffer = buf;
    src.playbackRate.value = rate;
    gain.gain.value = LEVEL * level;
    src.connect(gain).connect(c.destination);
    const at = c.currentTime + Math.max(0, wait);
    // A quick fade, not a click, where the next sound cuts this one.
    const cut = (t: number) => (gain.gain.setTargetAtTime(0, t, 0.01), src.stop(t + 0.05));
    src.start(turns ? take(at, buf.duration / rate, id === "goal", cut) : at);
  };
  if (turns) void inOrder(buffer(id), play);
  else void buffer(id).then(play);
};

/** A hidden window (another app in front, the Mac asleep) hears nothing: a save that lands then is not a moment he sees. */
const hidden = () => typeof document !== "undefined" && document.hidden;

/** The sounds that answer him during a review. At most one plays at a time: rating fast, each new one cuts the one
 *  still playing, so they never pile up (four at once, Codex sweep 5); the goal's chime waits for the rating's sound to end. */
const FEEDBACK: Sound[] = ["tap", "right", "missed", "goal"];
const feedback = (id: Sound) => FEEDBACK.includes(id);
type Slot = { start: number; end: number; cut: (at: number) => void };
/** The tick, recall or miss last placed, and the goal's chime, which may still be waiting its turn. */
let sounding: Slot | null = null;
let goal: Slot | null = null;
/** When a feedback sound asked for `at` (audio clock seconds) and lasting `length` starts. A tick, recall or miss
 *  starts at once and cuts whatever is sounding then; the goal (`waits`) starts once the sound before it has ended,
 *  and is never cut while it waits for its turn, only once it is sounding. */
export function take(at: number, length: number, waits: boolean, cut: (at: number) => void): number {
  if (waits) {
    const start = Math.max(at, sounding?.end ?? at);
    goal = { start, end: start + length, cut };
    return start;
  }
  for (const v of [sounding, goal]) if (v && v.start <= at && v.end > at) v.cut(at);
  sounding = { start: at, end: at + length, cut };
  return at;
}
/** Feedback sounds are placed in the order they were asked for, not the order their files load: on a cold start an
 *  older tick must not cut the rating after it, and the goal must see the rating it waits for. */
let queue: Promise<unknown> = Promise.resolve();
export function inOrder<T>(load: Promise<T>, place: (v: T) => void): Promise<void> {
  const turn = queue.then(() => load).then(place, () => {});
  queue = turn;
  return turn;
}
let player = webAudio;
/** Tests listen here in place of the speakers. */
export const setPlayer = (p: Player | null) => void (player = p ?? webAudio);

/** Reads the files ahead of the first moment, so the first tick isn't late. */
export function warm() {
  for (const id of HAVE as Sound[]) if (allowed(id)) void buffer(id);
}

export function sfx(id: Sound, o: Opts = {}) {
  // The mole's sounds have no key or click of their own, and WebKit only wakes audio inside one: with the sound
  // effects off, their moments still wake it for him.
  if (!allowed(id)) return void (player === webAudio && HAVE.length && voice.get() && audio());
  if (hidden()) return;
  // The journeys' ear: `window.__ORE_SFX = []` collects what played.
  if (import.meta.env?.DEV) (globalThis as { __ORE_SFX?: string[] }).__ORE_SFX?.push(id);
  player(id, { rate: o.rate ?? 1, after: o.after ?? 0, level: o.level ?? 1, over: !!o.over });
}

/** A layer on a reward screen: a sound over the ones already sounding. It cuts nothing and nothing cuts it, so a run
 *  of them rings together (a review's own sounds take turns, `take`). `up` is semitones above the file. */
export const layer = (id: Sfx, { up = 0, after = 0, level = 1 }: { up?: number; after?: number; level?: number } = {}) => sfx(id, { rate: 2 ** (up / 12), after, level, over: true });

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
