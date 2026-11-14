import { useEffect, useLayoutEffect, useRef } from "react";
import { COLS, FINE_ORDER, ROWS, fineDots } from "./mole-fine";

/* The tutor's mole (D168, a puppet since D214, an old miner since D238, traced from concept 4 since D251, one drawing
   at every size since D261): its head and two paws over a strip of dirt, drawn as round dots
   (`mole-fine.ts`). It moves like a puppet: each value of its shape (how high it stands, its paws, where it looks)
   follows a spring, and every frame the drawing is laid out from those values. */
/** The puppet's values. y: rows sunk into the hole. top: the dome's top row. rx: head half width. ex: how square the
 *  dome is (2 round, 4 boxy). hx: head lean. lx, ly: where the eyes look. open: 1 open, 0 shut. tall: wide eyes.
 *  arc: ∩ eyes and the moustache spread wide. pawL, pawR: rows each paw is raised. pw: paw width. kick: dirt swell. mouth: an o, then an O. */
export const REST = { y: 0, top: -0.3, rx: 10.2, ex: 2.6, hx: 0, lx: 0, ly: 0, open: 1, tall: 0, arc: 0, pawL: 0, pawR: 0, pw: 5, kick: 0, mouth: 0,
  // Read by the traced mole only (D251). wink: his right eye shut. frown: both brows down over his eyes. hat: rows the
  // helmet sits up (down over his brows when negative). tilt: the helmet tipped (radians). lamp: the lamp flared.
  // droop: the moustache hanging in. puff: the moustache blown out.
  // glow: the lamp lit and throwing rays, for a thing that is running (the lamp, D263).
  wink: 0, frown: 0, hat: 0, tilt: 0, lamp: 0, glow: 0, droop: 0, puff: 0,
  // Drawn marks, as in a comic (the traced mole only). star: his eyes as stars. blush: his cheeks pink. twinkle: a star
  // popping beside his winking eye. ask, bang: a "?" and a "!" over his helmet. The rest run from 0 to 1 and show nothing at either end: tear, a drop down his
  // cheek; sweat, a bead down his temple; steam, a puff out of each side of his helmet; zzz, two Zs rising off him;
  // spark, three sparkles round his head, one after another. A frown below 0 is a worried brow, inner ends up.
  star: 0, blush: 0, twinkle: 0, ask: 0, bang: 0, tear: 0, sweat: 0, steam: 0, zzz: 0, spark: 0,
  // Out of the ground (the traced mole only). whole: over a half he is drawn with his whole body and no dirt.
  // breath: his belly swelling. arms: from folded behind his head, 0, to flung out, 1. legs: one foot kicks, then the other.
  // side: over a half he is drawn asleep on his back in profile (the cart rolling in).
  whole: 0, breath: 0, arms: 0, legs: 0, side: 0 };
export type State = typeof REST;
type Key = keyof State;
const KEYS = Object.keys(REST) as Key[];
/** Spring per value: [stiffness, damping]. Eyes snap; the body carries a little bounce. */
const SPRING: Record<Key, [number, number]> = { y: [130, 12], top: [210, 15], rx: [210, 16], ex: [200, 22], hx: [70, 13], lx: [90, 15], ly: [90, 15], open: [900, 52], tall: [420, 26], arc: [320, 30], pawL: [260, 14], pawR: [260, 14], pw: [260, 24], kick: [160, 9], mouth: [380, 22], wink: [900, 52], frown: [320, 30], hat: [210, 16], tilt: [160, 14], lamp: [200, 18], glow: [60, 14], droop: [120, 18], puff: [260, 12],
  star: [300, 22], blush: [90, 16], twinkle: [420, 20], ask: [380, 17], bang: [520, 19], tear: [5, 4.5], sweat: [5, 4.5], steam: [90, 19], zzz: [7, 5.3], spark: [6, 4.9],
  whole: [900, 60], breath: [16, 7], arms: [220, 17], legs: [300, 14], side: [900, 60] };

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** One path per tone, painted back to front: eyes over the face, glints over the eyes. */
function paths<T extends string>(dots: readonly (readonly [number, number, number, T])[], order: readonly T[]): Record<T, string> {
  const by = Object.fromEntries(order.map((t) => [t, ""])) as Record<T, string>;
  for (const [c, r, rad, t] of dots) {
    if (rad < 0.05) continue;
    const x = c - rad;
    by[t] += `M${x.toFixed(2)} ${r.toFixed(2)}a${rad.toFixed(2)} ${rad.toFixed(2)} 0 1 0 ${(2 * rad).toFixed(2)} 0a${rad.toFixed(2)} ${rad.toFixed(2)} 0 1 0 ${(-2 * rad).toFixed(2)} 0`;
  }
  return by;
}

const LIMITS: [Key, number, number][] = [["rx", 8, 11.5], ["top", -2.5, 6], ["ex", 2, 4.5]];
/** One spring step of `dt` seconds toward `to`. */
export function step(v: State, vel: State, to: State, dt: number) {
  for (const k of KEYS) {
    const [st, da] = SPRING[k];
    vel[k] += (st * (to[k] - v[k]) - da * vel[k]) * dt;
    v[k] += vel[k] * dt;
  }
  // At a limit the value stops there, so it springs back from it at once instead of sticking.
  for (const [k, lo, hi] of LIMITS) if (v[k] < lo || v[k] > hi) { v[k] = clamp(v[k], lo, hi); vel[k] = 0; }
}

export type Mood = "idle" | "peek" | "hole" | "pop" | "thinking" | "happy" | "surprised" | "cheer" | "nod" | "shake" | "wink" | "laugh" | "proud" | "curious" | "sad" | "sleepy" | "set" | "shy" | "wave" | "huff" | "lookdown" | "anxious" | "ecstatic" | "nap" | "doze" | "fall" | "dive";
/** A mood: where each value should settle (`to`), where it starts (`from`), pushes that set it moving (`kick`), timed
 *  changes after (`at`), paws waving until `wave` ms, and when it rests (`end`) or starts over (`loop`).
 *  `still` is the one pose shown under reduced motion or in a hidden window. */
/** `set` puts a value somewhere at once (a drop back at its start, where it shows nothing). */
type Beat = { to?: Partial<State>; kick?: Partial<State>; set?: Partial<State> };
type Move = Beat & { from?: Partial<State>; at?: [ms: number, Beat][]; wave?: number; end?: number; loop?: number; still: Partial<State> };
const HAPPY: Partial<State> = { arc: 1, pw: 6, ex: 3.6, rx: 10, top: 0.6 };
/** Pushes, in dots a second: a paw's tap, both paws thrown up, a hop of the dome, a jolt; and the dome's top row in a squat. */
const TAP = 45, THROW = 70, HOP = 95, JOLT = 62, SQUAT = 1.7;
const WIDE: Partial<State> = { tall: 1, mouth: 1, rx: 10.4, top: 1.4 };
/** Drawn whole. Asleep, and awake in mid-air. */
const NAP: Partial<State> = { whole: 1, open: 0, hat: -0.9, droop: 0.4 }, DOZE: Partial<State> = { side: 1, open: 0 }, FALL: Partial<State> = { ...WIDE, whole: 1, arms: 1, hat: 0.5 };
const BLINK: (ms: number) => [number, Beat][] = (ms) => [[ms, { to: { open: 0 } }], [ms + 120, { to: { open: 1 } }]];
/* Sizes here are in dots, and a dot is under 2px in the button and the chat: a move that shifts less than a row
   and a half is not seen. Each hop is a squat first (anticipation), then the spring up, then the dirt as he lands. */
/** How lit his lamp is while he thinks with nothing arriving; words arriving take it to 1 (`signal`). */
const GLOW = 0.45;
export const MOVES: Record<Exclude<Mood, "idle">, Move> = {
  // Up out of the hole with a spray of dirt, then a blink.
  peek: { from: { y: 21 }, at: [[260, { kick: { kick: 9 } }], ...BLINK(1200)], end: 1500, still: {} },
  // Looks up to one side and taps a paw twice, blinks, then the other.
  thinking: { to: { lx: 1, ly: -1, hx: 0.6, glow: GLOW }, loop: 4000, still: { lx: 1, ly: -1, glow: 0.7 },
    at: [[400, { kick: { pawR: TAP } }], [800, { kick: { pawR: TAP } }], ...BLINK(1500), [2000, { to: { lx: -1, hx: -0.6 } }], [2400, { kick: { pawL: TAP } }], [2800, { kick: { pawL: TAP } }], ...BLINK(3500)] },
  // A squat, then arc eyes, the moustache spread wide and a hop with both paws thrown up, and the dirt as he lands.
  happy: { to: { top: SQUAT }, end: 1700, still: HAPPY,
    at: [[110, { to: HAPPY, kick: { top: -HOP, pawL: THROW, pawR: THROW } }], [420, { kick: { kick: 7 } }]] },
  // After his fall off the cart. `hole`: his hole with nobody up, only the dirt. `pop`: the dirt kicks as he goes in,
  // a beat on the empty hole, then up with a start, helmet knocked askew, which he lets settle.
  hole: { from: { y: 21 }, to: { y: 21 }, loop: 60_000, still: { y: 21 } },
  pop: { from: { y: 21 }, to: { y: 21 }, kick: { kick: 12 }, end: 1900, still: { ...WIDE, bang: 1 },
    at: [[150, { kick: { kick: 6 } }], [260, { to: { ...WIDE, y: 0, bang: 1, tilt: 0.35, hat: 0.8 }, kick: { pawL: THROW, pawR: THROW } }], [400, { kick: { kick: 8 } }], [780, { to: { tilt: 0, hat: 0 } }], [900, { to: { bang: 0 } }]] },
  // A jolt up with both paws, his helmet jumping off his brows, wide eyes, an O, and a "!" over him (the traced mole).
  surprised: { to: { ...WIDE, bang: 1 }, kick: { top: -JOLT, pawL: THROW, pawR: THROW, kick: 6 }, end: 1400, still: { ...WIDE, bang: 1 }, at: [[1000, { to: { bang: 0 } }]] },
  // Both paws waving, bobbing on each beat, then a squat, a last hop and it settles pleased.
  cheer: { to: { arc: 1, ex: 3 }, wave: 900, end: 2400, still: HAPPY,
    at: [[900, { to: { ...HAPPY, top: SQUAT, pawL: 0, pawR: 0 } }], [1010, { to: HAPPY, kick: { top: -HOP, pawL: THROW, pawR: THROW } }], [1320, { kick: { kick: 7 } }]] },
  /* A broad range for the traced mole (D251). */
  // Yes: two nods, his whole head dipping.
  nod: { end: 1000, still: {}, at: [[0, { to: { top: 1.1, ly: 1 } }], [190, { to: { top: REST.top, ly: 0 } }], [400, { to: { top: 1.1, ly: 1 } }], [590, { to: { top: REST.top, ly: 0 } }]] },
  // No: eyes shut, his head from side to side.
  shake: { to: { open: 0 }, end: 1150, still: { open: 0 },
    at: [[0, { to: { hx: 1.5, lx: 1 } }], [170, { to: { hx: -1.5, lx: -1 } }], [340, { to: { hx: 1.5, lx: 1 } }], [510, { to: { hx: -1.5, lx: -1 } }], [680, { to: { hx: 0, lx: 0 } }], [800, { to: { open: 1 } }]] },
  // A wink: one eye, a lean and the moustache lifting on that side.
  wink: { to: { hx: 0.7, puff: 0.5 }, end: 1100, still: { wink: 1, hx: 0.7, twinkle: 1 }, at: [[140, { to: { wink: 1, twinkle: 1 } }], [520, { to: { wink: 0, twinkle: 0 } }], [700, { to: { hx: 0, puff: 0 } }]] },
  // A laugh from the belly, deep and slow: three heaves. On each his head goes back, helmet tipping, mouth wide and
  // the moustache blown out, paws lifting; then he sinks under it. The last is the biggest and shakes the dirt.
  laugh: { to: { arc: 1, mouth: 0.5 }, end: 2700, still: { arc: 1, mouth: 1, top: -1.2, hat: 0.5, tilt: -0.1, puff: 0.8 },
    at: [...[150, 760, 1400].flatMap((ms, i): [number, Beat][] => [
      [ms, { to: { top: -1.2 - i * 0.25, hat: 0.5, tilt: -0.1, mouth: 1, puff: 0.8, pawL: 1.6, pawR: 1.6 }, kick: { puff: 3 } }],
      [ms + 300, { to: { top: 1, hat: -0.15, tilt: 0, mouth: 0.4, puff: 0, pawL: 0, pawR: 0 } }]]),
      [1720, { kick: { kick: 6 } }], [2150, { to: { top: REST.top, hat: 0, mouth: 0, arc: 0 } }]] },
  // Proud: he draws up and tips his helmet back, pleased, lamp bright, cheeks pink.
  proud: { to: { top: -1.3, hat: 1.1, tilt: -0.16, arc: 1, lamp: 1, blush: 0.8 }, kick: { top: -30 }, end: 1900, still: { top: -1.3, hat: 1.1, tilt: -0.16, arc: 1, lamp: 1, blush: 0.8 }, at: [[1300, { to: { hat: 0, tilt: 0, lamp: 0, blush: 0 } }]] },
  // Curious: his head cocked, one brow up, a look, a "?" over him.
  curious: { to: { hx: 1.2, lx: 1, ly: -0.8, tilt: 0.1 }, end: 2100, still: { hx: 1.2, lx: 1, ly: -0.8, tilt: 0.1, ask: 1 }, at: [[250, { to: { ask: 1 } }], ...BLINK(1000), [1650, { to: { ask: 0 } }]] },
  // Sorry for a miss: helmet low, eyes down, a worried brow, the moustache hanging in, and one tear down his cheek.
  sad: { to: { hat: -0.7, ly: 1, droop: 1, top: 0.3, open: 0.7, frown: -1 }, end: 3000, still: { hat: -0.7, ly: 1, droop: 1, top: 0.3, open: 0.7, frown: -1, tear: 0.5 },
    at: [[450, { to: { tear: 1 } }], ...BLINK(1500), [2500, { set: { tear: 0 } }]] },
  // Nodding off: lids half down, his head sinks, Zs rise off him, then he starts awake.
  sleepy: { to: { open: 0.5 }, end: 3300, still: { open: 0.3, top: 1, zzz: 0.45 },
    at: [[600, { to: { open: 0.12, top: 1.1, ly: 1, hat: -0.4, zzz: 1 } }], [2300, { set: { zzz: 0 }, to: { open: 1, top: REST.top, ly: 0, hat: 0, tall: 0.7 }, kick: { top: -55 } }], [2600, { to: { tall: 0 } }]] },
  // Set on it: brows down, lamp up, one firm nod.
  set: { to: { frown: 1, lamp: 1, hat: -0.25 }, end: 2000, still: { frown: 1, lamp: 1, hat: -0.25 }, at: [[320, { to: { top: 0.9 } }], [500, { to: { top: REST.top } }]] },
  // Shy: down in his hole to the eyes, cheeks pink, a look each way, then back up.
  shy: { to: { y: 6.6, blush: 1 }, end: 2600, still: { lx: -1, blush: 1 }, at: [[550, { to: { lx: -1 } }], [950, { to: { lx: 1 } }], [1350, { to: { lx: 0 } }], [1500, { to: { y: 0 }, kick: { kick: 6 } }], [2200, { to: { blush: 0 } }]] },
  // A wave: one paw, his head leaning to it, eyes open on whoever he waves at.
  wave: { to: { hx: 0.6, puff: 0.35 }, end: 1500, still: { pawR: 3, hx: 0.6, puff: 0.35 },
    at: [...[0, 150, 300, 450, 600, 750].map((ms, i): [number, Beat] => [ms, { to: { pawR: i % 2 ? 2 : 3.4 } }]), [900, { to: { pawR: 0 } }]] },
  // Looking down at what lands under him: head and helmet dipped, eyes down, held (with a blink) for as long as it is his mood.
  lookdown: { to: { ly: 1, top: 0.6, hat: -0.3 }, loop: 5000, still: { ly: 1, top: 0.6, hat: -0.3 }, at: [...BLINK(2600)] },
  // A huff: brows down, helmet low, the moustache blown out twice, steam out of both sides of his helmet.
  huff: { to: { frown: 1, hat: -0.45 }, end: 1900, still: { frown: 1, hat: -0.45, steam: 0.45 },
    at: [[300, { to: { mouth: 0.5, steam: 1 }, kick: { puff: 6 } }], [520, { to: { mouth: 0 } }], [760, { set: { steam: 0 }, to: { mouth: 0.5, steam: 1 }, kick: { puff: 6 } }], [980, { to: { mouth: 0 } }], [1500, { set: { steam: 0 } }]] },
  // Anxious: a worried brow, eyes darting, a shiver, and a bead of sweat down his temple.
  anxious: { to: { frown: -1, mouth: 0.35, hat: -0.2 }, end: 2600, still: { frown: -1, mouth: 0.35, hat: -0.2, sweat: 0.45, lx: -1 },
    at: [[150, { to: { sweat: 1, lx: -1 } }], ...[400, 480, 560, 640, 720, 800].map((ms, i): [number, Beat] => [ms, { kick: { hx: i % 2 ? -9 : 9 } }]), [900, { to: { lx: 1 } }], [1500, { to: { lx: -1 } }],
      ...[1600, 1680, 1760, 1840].map((ms, i): [number, Beat] => [ms, { kick: { hx: i % 2 ? -9 : 9 } }]), [2100, { to: { lx: 0 } }], [2200, { set: { sweat: 0 } }]] },
  // Ecstatic: star eyes, sparkles round him, two hops with both paws up.
  ecstatic: { to: { top: SQUAT }, end: 2600, still: { star: 1, arc: 1, mouth: 0.5, spark: 0.5, pawL: 3, pawR: 3 },
    at: [[110, { to: { star: 1, arc: 1, mouth: 0.5, top: REST.top, spark: 1 }, kick: { top: -HOP, pawL: THROW, pawR: THROW } }], [420, { kick: { kick: 7 } }],
      [800, { to: { top: SQUAT } }], [910, { to: { top: REST.top }, kick: { top: -HOP, pawL: THROW, pawR: THROW } }], [1220, { kick: { kick: 7 } }], [1300, { kick: { star: 5 } }], [1700, { kick: { star: 5 } }], [2300, { set: { spark: 0 } }]] },
  /* Out of the ground, his whole body (the cart at the end of a review turns him on his back; a move does not). */
  // Asleep, from the front: paws behind his head, helmet down over his eyes, his belly and moustache rising on each snore.
  nap: { from: NAP, to: NAP, loop: 3000, still: NAP,
    at: [[0, { to: { breath: 1, puff: 0.5, droop: 0 } }], [1300, { to: { breath: 0, puff: 0, droop: 0.4 } }], [2100, { to: { legs: 1 } }], [2300, { to: { legs: 0 } }]] },
  // Asleep on his back in profile, already lying down (the cart rolling in): helmet over his eyes, a paw behind his
  // head, his belly and moustache rising on each snore, the foot in the air bobbing.
  doze: { from: DOZE, to: DOZE, loop: 3000, still: DOZE,
    at: [[0, { to: { breath: 1 } }], [1300, { to: { breath: 0 }, kick: { puff: 2 } }], [2000, { to: { legs: 1 } }], [2250, { to: { legs: 0 } }]] },
  // Awake on nothing: a start (eyes wide, a "!", arms flung out, his helmet floating off his brows a beat late), a
  // look down, his feet running on air while his arms go, then he stops and looks at us before he drops.
  fall: { from: { whole: 1, side: 0, hat: -0.8 }, to: { ...FALL, hat: 0.9, bang: 1 }, loop: 3000, still: FALL,
    at: [[330, { to: { ly: 1, bang: 0, hat: 0.3 } }],
      ...[0, 1, 2, 3, 4].map((i): [number, Beat] => [450 + i * 108, { to: { legs: i % 2 ? -1 : 1, arms: i % 2 ? 0.8 : 1.5, tilt: i % 2 ? 0.2 : -0.2 }, kick: { legs: i % 2 ? -30 : 30 } }]),
      [985, { to: { legs: 0, arms: 1, tilt: 0, ly: 0, hat: 0 } }]] },
  // Dropping feet first: his arms go straight up over him and his helmet is left behind, feet together.
  dive: { from: { whole: 1, side: 0 }, to: { ...FALL, hat: 1.4, arms: 2, legs: 0, tilt: 0 }, loop: 3000, still: { ...FALL, hat: 1.4, arms: 2, legs: 0 } },
};

/** The puppet's moving parts: its values, their speeds, where they are headed, and the move playing. */
export type Puppet = { v: State; vel: State; to: State; move: Move | null; mood: Mood; t0: number; fired: number };
const zero = () => Object.fromEntries(KEYS.map((k) => [k, 0])) as State;
export const puppet = (): Puppet => ({ v: { ...REST }, vel: zero(), to: { ...REST }, move: null, mood: "idle", t0: 0, fired: 0 });
const push = (s: Puppet, b: Beat) => {
  for (const [k, x] of Object.entries(b.set ?? {})) { s.v[k as Key] = x; s.to[k as Key] = x; s.vel[k as Key] = 0; }
  Object.assign(s.to, b.to);
  for (const [k, x] of Object.entries(b.kick ?? {})) s.vel[k as Key] += x;
};
/** Starts a mood's move at `now`. */
export function start(s: Puppet, mood: Exclude<Mood, "idle">, now: number) {
  const m = MOVES[mood];
  Object.assign(s, { move: m, mood, t0: now, fired: 0, to: { ...REST } });
  Object.assign(s.v, m.from);
  push(s, m);
}
/** Shows `pose` at once, with nothing moving. */
export function hold(s: Puppet, mood: Mood, pose: Partial<State>) {
  Object.assign(s, { move: null, mood, to: { ...REST, ...pose }, v: { ...REST, ...pose }, vel: zero() });
}
const settled = (s: Puppet) => KEYS.every((k) => Math.abs(s.to[k] - s.v[k]) < 0.002 && Math.abs(s.vel[k]) < 0.002);
/** One frame at `now` (ms), `dt` s after the last: the beats now due, the waving paws, a loop or the rest, then the
 *  springs. True while it is still moving. */
export function advance(s: Puppet, now: number, dt: number) {
  const m = s.move, t = now - s.t0;
  if (m) {
    const at = m.at ?? [];
    while (s.fired < at.length && t >= at[s.fired]![0]) push(s, at[s.fired++]![1]);
    if (m.wave && t < m.wave) {
      const ph = (t / 360) * 2 * Math.PI;
      Object.assign(s.to, { pawL: 2 + 1.1 * Math.cos(ph), pawR: 2 - 1.1 * Math.cos(ph), top: REST.top - 0.35 * Math.abs(Math.sin(ph)) });
    }
    if (m.loop && t >= m.loop) start(s, s.mood as Exclude<Mood, "idle">, now);
    else if (m.end && t >= m.end) Object.assign(s, { move: null, mood: "idle", to: { ...REST } });
  }
  // Two half steps keep the stiff eye spring steady at 60 Hz.
  step(s.v, s.vel, s.to, dt / 2);
  step(s.v, s.vel, s.to, dt / 2);
  return !!s.move || !settled(s);
}

/** In its button the sprite sits 3.3 dots below a square's top, so its dirt lands low and it pokes out of the ground. */
const LIFT = 3.3;
const BLINK_MS = 120, LOOK_MS = 900;
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/** The mole, `size` px wide (in its button, the dirt sits low in a square; `bare`, just the sprite; the dome may
 *  rise into the room above it). `mood` plays its move (one that doesn't loop then rests); at rest it blinks every
 *  5 to 9 s and glances to a side every 15 to 20 s. `look` (hover or focus on its button) faces him with a blink.
 *  `cue` replays the mood for a new event (another reply landing). Frames run only while it moves. Still under
 *  reduced motion and while the window is hidden (a mood shows its still pose). */
export function Mole({ size = 40, mood = "idle", cue, look = false, bare = false, signal }: { size?: number; mood?: Mood; cue?: unknown; look?: boolean; bare?: boolean; /** While he thinks, how much is happening right now, 0 to 1: his lamp follows it (D263). */ signal?: () => number }) {
  const svg = useRef<SVGSVGElement>(null);
  const tones = useRef<Record<string, SVGPathElement | null>>({});
  const p = useRef(puppet());
  const run = useRef({ frame: 0, last: 0 });
  const looking = useRef(look);
  looking.current = look;
  const sig = useRef(signal);
  sig.current = signal;

  // `data-mood` is the move it is playing (or showing still), for tests.
  const draw = () => {
    const d: Record<string, string> = paths(fineDots(p.current.v), FINE_ORDER);
    for (const t of FINE_ORDER) tones.current[t]?.setAttribute("d", d[t]!);
    svg.current?.setAttribute("data-mood", p.current.mood);
  };
  // Frames run while anything moves or a beat is still to come, then stop.
  const tick = (now: number) => {
    const dt = Math.min(0.033, Math.max(0, (now - run.current.last) / 1000));
    run.current.last = now;
    if (sig.current && p.current.mood === "thinking") p.current.to.glow = GLOW + (1 - GLOW) * sig.current();
    const moving = advance(p.current, now, dt);
    draw();
    run.current.frame = moving ? requestAnimationFrame(tick) : 0;
  };
  const wake = () => {
    if (run.current.frame) return;
    run.current.last = performance.now();
    run.current.frame = requestAnimationFrame(tick);
  };
  const stop = () => { cancelAnimationFrame(run.current.frame); run.current.frame = 0; };

  // A mood's move, set up before the first paint so the frame before it never shows (a peek starts in the hole).
  // Reduced motion, or a hidden window, shows its still pose; a window shown again plays it then (a move that
  // already played once stays done).
  useLayoutEffect(() => {
    const s = p.current;
    if (mood === "idle") {
      if (still() || document.hidden) { stop(); hold(s, "idle", {}); draw(); return; }
      Object.assign(s, { move: null, mood: "idle", to: { ...REST } });
      draw();
      wake();
      return;
    }
    const move = MOVES[mood];
    let played = false;
    const play = () => {
      if (still() || document.hidden) { stop(); hold(s, mood, move.still); draw(); return; }
      played = !move.loop;
      start(s, mood, performance.now());
      draw();
      wake();
    };
    const shown = () => { if (!document.hidden && !played) play(); };
    play();
    document.addEventListener("visibilitychange", shown);
    return () => document.removeEventListener("visibilitychange", shown);
  }, [mood, cue]);

  // At rest: blinks and glances, never while it is facing him, hidden, or asked for less motion.
  useEffect(() => {
    const timers = new Set<number>();
    let alive = true;
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms);
      timers.add(id);
    };
    const quiet = () => !!p.current.move || looking.current || document.hidden || still();
    const brief = (pose: Partial<State>, ms: number) => {
      Object.assign(p.current.to, pose);
      wake();
      later(() => { if (!p.current.move) { for (const k of Object.keys(pose) as Key[]) p.current.to[k] = REST[k]; wake(); } }, ms);
    };
    const blinks = () => later(() => { if (!quiet()) brief({ open: 0 }, BLINK_MS); if (alive) blinks(); }, between(5000, 9000));
    const turns = () =>
      later(() => {
        if (!quiet()) {
          const first = Math.random() < 0.5 ? -1 : 1;
          brief({ lx: first, hx: first * 0.45 }, LOOK_MS);
          if (Math.random() < 0.5) later(() => { if (!quiet()) brief({ lx: -first, hx: -first * 0.45 }, LOOK_MS); }, LOOK_MS + 400);
        }
        if (alive) turns();
      }, between(15000, 20000));
    blinks();
    turns();
    return () => { alive = false; timers.forEach(clearTimeout); stop(); };
  }, []);

  // Hovered or focused: it faces him and blinks. Its eyes open again however soon the pointer leaves.
  useEffect(() => {
    if (!look || p.current.move || still()) return;
    const s = p.current, open = () => { s.to.open = REST.open; wake(); };
    Object.assign(s.to, { lx: 0, ly: 0, hx: 0, open: 0 });
    wake();
    const id = window.setTimeout(open, BLINK_MS);
    return () => { clearTimeout(id); open(); };
  }, [look]);

  // The dirt sits low in the button, so the mole reads as poking out of the ground at its foot.
  return (
    <svg ref={svg} className="mole" width={size} height={bare ? (size * ROWS) / COLS : size} viewBox={bare ? `0 0 ${COLS} ${ROWS}` : `0 ${-LIFT} ${COLS} ${COLS}`} overflow="visible" aria-hidden="true">
      {FINE_ORDER.map((t) => (
        <path key={t} ref={(el) => { tones.current[t] = el; }} className={`mole-${t}`} />
      ))}
    </svg>
  );
}

/** The mound's clods on the fine grid, back to front: [column, rows above the dirt line, radius]. A big one at each
 *  side of him, smaller ones along the front, low enough that his paws rest on them. */
const CLODS: [number, number, number][] = [[-7.5, -0.4, 2.2], [40.5, -0.4, 2.2], [-2.5, 1.4, 4.3], [35.5, 1.6, 4.5], [4.5, -1.2, 3], [28.5, -1.1, 3.1], [10.5, -1.4, 2.4], [22, -1.3, 2.5], [16.5, -1.6, 2.3]];
/** Its dots: [column, row, tone]. Each clod is lit along its top and dark at its foot, so it reads as a lump; all sit on one floor. */
const MOUND: [number, number, "lit" | "earth" | "deep"][] = (() => {
  const out: [number, number, "lit" | "earth" | "deep"][] = [];
  for (let c = -10; c <= 43; c++) for (let r = -2; r <= 7; r++) {
    const [x, y, R] = CLODS.findLast(([x, y, R]) => Math.hypot(c - x, r - y) <= R) ?? [0, 0, 0];
    // The floor's two ends are rounded off.
    if (!R || Math.abs(c - 16.5) > 25 + r * 1.5) continue;
    const up = (r - y) / R, far = Math.hypot(c - x, r - y) / R;
    out.push([c, r, r === -2 || (up < 0.1 && far > 0.72) ? "deep" : up > 0.25 && far > 0.55 ? "lit" : "earth"]);
  }
  return out;
})();

/** The mound of dirt the mole comes up through at a session's end, drawn in front of him in his own fine dots
 *  (Tyler, 2026-11-14: "so it looks like he's popping out of a hole"). It lies over a `bare` mole of the same `size`. */
export function Mound({ size = 96 }: { size?: number }) {
  const u = COLS / 33;
  return (
    <svg className="mole-mound" width={size} height={(size * ROWS) / COLS} viewBox={`0 0 ${COLS} ${ROWS}`} overflow="visible" aria-hidden="true">
      {/* Dots have gaps, so each sits on a wider round of the page: nothing of him shows through his mound. */}
      {MOUND.map(([c, r]) => <circle key={`b${c},${r}`} className="back" cx={(c + 0.5) * u} cy={ROWS - 0.3 - r * u} r={0.72 * u} />)}
      {MOUND.map(([c, r, tone]) => <circle key={`${c},${r}`} className={tone} cx={(c + 0.5) * u} cy={ROWS - 0.3 - r * u} r={0.42 * u} />)}
    </svg>
  );
}
