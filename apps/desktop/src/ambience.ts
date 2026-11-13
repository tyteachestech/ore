import { useSyncExternalStore } from "react";
import { CHANNELS, type ChannelId } from "./ambience-art";

/* The ambience radio's sound (D253): one channel at a time, looped without a gap through Web Audio, off until he
   picks one. The files are ElevenLabs output, which may ship inside the app but not as loose files in a public repo,
   so they never live in git: the build takes them from a folder on his Mac (vite.config.ts, `ambienceSounds`) and
   serves them at /sounds/<id>.mp3. A channel whose file is missing says so and stays off. */

type State = { playing: ChannelId | null; since: number; missing: ChannelId[]; loading: ChannelId | null };
let state: State = { playing: null, since: 0, missing: [], loading: null };
const subs = new Set<() => void>();
const emit = (s: Partial<State>) => { state = { ...state, ...s }; subs.forEach((f) => f()); };
export const useAmbience = () => useSyncExternalStore((f) => (subs.add(f), () => void subs.delete(f)), () => state);
export const ambienceState = () => state;

let ctx: AudioContext | null = null, out: GainNode | null = null, meter: AnalyserNode | null = null, wave: Uint8Array<ArrayBuffer> | null = null;
let live: { id: ChannelId; src: AudioBufferSourceNode; gain: GainNode } | null = null;
const buffers = new Map<ChannelId, Promise<AudioBuffer | null>>();
/** How long a channel takes to fade in and out, in seconds: a cut would click. */
const FADE = 0.4;

function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    out = ctx.createGain();
    meter = ctx.createAnalyser();
    meter.fftSize = 512;
    wave = new Uint8Array(meter.fftSize);
    out.connect(meter).connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function load(id: ChannelId) {
  let b = buffers.get(id);
  if (!b) {
    b = fetch(`/sounds/${id}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((a) => audio().decodeAudioData(a))
      .catch(() => null);
    buffers.set(id, b);
  }
  return b;
}

function fadeOut() {
  if (!live || !ctx) return;
  const { src, gain } = live;
  gain.gain.setTargetAtTime(0, ctx.currentTime, FADE / 4);
  src.stop(ctx.currentTime + FADE);
  live = null;
}

/** Plays `id`, or stops when it is already playing. */
export async function toggle(id: ChannelId) {
  if (state.playing === id || state.loading === id) return stop();
  audio();
  fadeOut();
  emit({ loading: id, playing: null });
  const buf = await load(id);
  if (state.loading !== id) return; // he picked another, or stopped, while it loaded
  if (!buf) {
    buffers.delete(id); // try again next time: the file may have been added since
    return emit({ loading: null, missing: [...new Set([...state.missing, id])] });
  }
  const c = audio(), src = c.createBufferSource(), gain = c.createGain();
  src.buffer = buf;
  src.loop = true;
  // MP3 pads its start and end with silence; looping inside them keeps the seam quiet.
  src.loopStart = Math.min(0.05, buf.duration / 4);
  src.loopEnd = Math.max(src.loopStart, buf.duration - 0.05);
  gain.gain.value = 0;
  gain.gain.setTargetAtTime(1, c.currentTime, FADE / 4);
  src.connect(gain).connect(out!);
  src.start(0, src.loopStart);
  live = { id, src, gain };
  emit({ loading: null, playing: id, since: performance.now() / 1000, missing: state.missing.filter((m) => m !== id) });
}

export function stop() {
  fadeOut();
  if (state.playing || state.loading) emit({ playing: null, loading: null });
}

/** How loud the sound is right now, 0 to 1, for the dots that move with it. */
export function level() {
  if (!meter || !wave || !live) return 0;
  meter.getByteTimeDomainData(wave);
  let s = 0;
  for (const v of wave) s += ((v - 128) / 128) ** 2;
  return Math.min(1, Math.sqrt(s / wave.length) * 6);
}

export const channelName = (id: ChannelId) => CHANNELS.find((c) => c.id === id)!.name;
