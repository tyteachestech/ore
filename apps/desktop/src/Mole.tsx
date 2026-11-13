import { useEffect, useLayoutEffect, useRef } from "react";
import { FINE_ORDER, fineDots } from "./mole-fine";

/* The tutor's mole (D168, drawn D169, a puppet since D214, an old miner since D238): its head and two paws over a
   strip of dirt, drawn as round dots on a 22 by 18 grid, like Nothing's dot glyphs. He is the mine's old hand: a
   helmet with a lit lamp, small black eyes under its brim, a pink nose over a white moustache in two long lobes.
   It moves like a puppet: each value of its shape (how high it stands, its dome, its paws, where it looks) follows a
   spring, and every frame the smooth shape is sampled onto the fixed grid. A dot's size says how much of it the
   shape covers, so the head and paws glide (halftone, D183). The face reads as features, so eyes, glints, the nose
   the moustache and the mouth stay whole dots that move a whole column at a time and never shimmer. */
export const COLS = 22, ROWS = 18;
const MID = (COLS - 1) / 2;
/** Rows of room above the grid: his helmet stands 3 over it, and rides higher on a hop or a start. */
export const HEAD = 8;

export type Tone = "fur" | "helmet" | "band" | "housing" | "lamp" | "brim" | "paw" | "stache" | "brow" | "eye" | "glint" | "nose" | "dirt";
/** The puppet's values. y: rows sunk into the hole. top: the dome's top row. rx: head half width. ex: how square the
 *  dome is (2 round, 4 boxy). hx: head lean. lx, ly: where the eyes look. open: 1 open, 0 shut. tall: wide eyes.
 *  arc: ∩ eyes and the moustache spread wide. pawL, pawR: rows each paw is raised. pw: paw width. kick: dirt swell. mouth: an o, then an O. */
export const REST = { y: 0, top: -0.3, rx: 10.2, ex: 2.6, hx: 0, lx: 0, ly: 0, open: 1, tall: 0, arc: 0, pawL: 0, pawR: 0, pw: 5, kick: 0, mouth: 0,
  // Read by the traced mole only (D251). wink: his right eye shut. frown: both brows down over his eyes. hat: rows the
  // helmet sits up (down over his brows when negative). tilt: the helmet tipped (radians). lamp: the lamp flared.
  // droop: the moustache hanging in. puff: the moustache blown out.
  wink: 0, frown: 0, hat: 0, tilt: 0, lamp: 0, droop: 0, puff: 0,
  // Drawn marks, as in a comic (the traced mole only). star: his eyes as stars. blush: his cheeks pink. twinkle: a star
  // popping beside his winking eye. The rest run from 0 to 1 and show nothing at either end: tear, a drop down his
  // cheek; sweat, a bead down his temple; steam, a puff out of each side of his helmet; zzz, two Zs rising off him;
  // spark, three sparkles round his head, one after another. A frown below 0 is a worried brow, inner ends up.
  star: 0, blush: 0, twinkle: 0, tear: 0, sweat: 0, steam: 0, zzz: 0, spark: 0 };
export type State = typeof REST;
type Key = keyof State;
const KEYS = Object.keys(REST) as Key[];
/** Spring per value: [stiffness, damping]. Eyes snap; the body carries a little bounce. */
const SPRING: Record<Key, [number, number]> = { y: [130, 12], top: [210, 15], rx: [210, 16], ex: [200, 22], hx: [70, 13], lx: [90, 15], ly: [90, 15], open: [900, 52], tall: [420, 26], arc: [320, 30], pawL: [260, 14], pawR: [260, 14], pw: [260, 24], kick: [160, 9], mouth: [380, 22], wink: [900, 52], frown: [320, 30], hat: [210, 16], tilt: [160, 14], lamp: [200, 18], droop: [120, 18], puff: [260, 12],
  star: [300, 22], blush: [90, 16], twinkle: [420, 20], tear: [5, 4.5], sweat: [5, 4.5], steam: [30, 11], zzz: [4, 4], spark: [10, 6.4] };

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const roundBox = (px: number, py: number, cx: number, cy: number, hw: number, hh: number, rad: number) => {
  const qx = Math.abs(px - cx) - hw + rad, qy = Math.abs(py - cy) - hh + rad;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
};

const span = (r: number, a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => [r, a + i] as const);
/** The moustache's left lobe (the right mirrors it): hanging at rest, spread wide when he is pleased. */
const HANG = [[10, 8], [10, 9], ...span(11, 6, 10), ...span(12, 5, 9), ...span(13, 5, 9), ...span(14, 5, 8), ...span(15, 6, 8), [16, 6], [16, 7]] as const;
const SPREAD = [[10, 9], ...span(11, 6, 10), ...span(12, 3, 9), ...span(13, 2, 6), [11, 2], [12, 2]] as const;
const NOSE = [[9, 9], [9, 10], [10, 10]] as const;

/** The face as whole dots, keyed r * 100 + c. Its position rounds to a dot; how open the eyes are picks a drawn shape. */
function face(s: State, fx: number, fy: number) {
  const m = new Map<number, Tone>();
  const ox = Math.round(fx + s.lx * 0.65), oy = Math.round(fy + s.ly * 0.75), nx = Math.round(fx * 1.1), er = 7;
  const set = (r: number, c: number, t: Tone, dx = ox, dy = oy) => m.set((r + dy) * 100 + c + dx, t);
  const both = (cells: readonly (readonly [number, number])[], t: Tone, dx = ox, dy = oy) => { for (const [r, c] of cells) { set(r, c, t, dx, dy); set(r, COLS - 1 - c, t, dx, dy); } };
  // His eyes and brows never rise into the brim: a look up moves his nose and moustache, and cocks a brow.
  const ey = Math.round(s.y + Math.max(0, s.ly));
  if (s.arc > 0.5) both([[er + 1, 5], [er, 6], [er, 7], [er + 1, 8]], "eye", ox, ey);
  else if (s.open < 0.35) both([[er + 1, 6], [er + 1, 7]], "eye", ox, ey);
  else {
    const top = s.tall > 0.5 ? er - 1 : er;
    for (let r = top; r <= er + 1; r++) both([[r, 6], [r, 7]], "eye", ox, ey);
    // One highlight, top right of each eye (the light comes from the upper right).
    set(top, 7, "glint", ox, ey); set(top, 15, "glint", ox, ey);
  }
  // His brows sit under the brim, a row over his eyes: one shows, cocked, on the side he looks to, and both when
  // his helmet jumps.
  const brow = s.tall > 0.5 ? er - 2 : er - 1;
  if (s.lx > 0.5 || s.tall > 0.5) for (const [r, c] of span(brow, 13, 16)) set(r, c, "brow", ox, ey);
  if (s.lx < -0.5 || s.tall > 0.5) for (const [r, c] of span(brow, 5, 8)) set(r, c, "brow", ox, ey);
  both(NOSE, "nose", nx);
  both(s.arc > 0.5 ? SPREAD : HANG, "stache", nx);
  // The mouth, between the lobes: a small o, then a round O when he's surprised.
  if (s.mouth > 0.25) both([[13, 10]], "eye", nx);
  if (s.mouth > 0.7) both([[14, 10]], "eye", nx);
  return m;
}

/** His head is a little narrower than the grid, so the helmet's brim overhangs it. */
const NARROW = 0.93;
/** The helmet, in its own rows (y 0 is the grid's top row at rest): a dome from -2.5 to a darker band, over a brim
 *  the grid's whole width, with the lamp in its housing at the front. The size of the dot at (x from its middle, y). */
function helmet(x: number, y: number): [cover: number, tone: Tone] | null {
  const brim = roundBox(x, y, 0, 5, 10.9, 0.5, 0.5);
  if (brim < 0.1) return [clamp(-brim * 4 + 0.6), "brim"];
  const t = (4.5 - y) / 7;
  if (t < 0 || t > 1) return null;
  const cover = clamp((9 * (1 - t ** 2.2) ** (1 / 2.2) - Math.abs(x)) / 0.5 + 0.6);
  if (cover <= 0.15) return null;
  const lamp = Math.hypot(x, y - 1.5);
  return lamp < 1 ? [1.25, "lamp"] : lamp < 2.3 ? [cover, "housing"] : [cover, Math.round(y) === 4 ? "band" : "helmet"];
}

export type Dot = [c: number, r: number, radius: number, tone: Tone];
/** Every dot of the mole in state `s`, rows from -HEAD (room above the grid) to the dirt at ROWS - 1. */
export function moleDots(s: State): Dot[] {
  const out: Dot[] = [], bottom = ROWS - 1.5, ry = Math.max(4, bottom - s.top);
  const fx = s.hx * 0.8 + s.lx * 0.35, fy = s.y + s.ly * 0.25;
  // Squash and stretch: stretched tall the head narrows, squashed it spreads, so it keeps its mass through a hop.
  const rx = s.rx * NARROW * clamp((bottom - REST.top) / ry, 0.86, 1.06);
  // The helmet rides the top of his head: up with a hop, never down over his eyes, and it jumps when he is startled.
  const hatY = Math.min(s.top - REST.top, 0.3) + s.y - s.tall * 1.6, hatX = MID + s.hx * 0.9;
  // Each paw a rounded box, and a box one dot wider that keeps the head apart from it.
  const paws = [0, 1].map((side) => {
    const w = s.pw, top = ROWS - 4 - (side ? s.pawR : s.pawL) + s.y;
    const x0 = side ? COLS - w - 0.25 : -0.25, x1 = x0 + w - 0.5, y0 = top - 0.25, y1 = ROWS + 1;
    const hh = Math.max(0.3, (y1 - y0) / 2);
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, hw: (x1 - x0) / 2, hh, rad: Math.min(1, hh) };
  });
  const paw = (i: number, c: number, r: number) => {
    const b = paws[i]!;
    return [roundBox(c, r, b.cx, b.cy, b.hw, b.hh, b.rad), roundBox(c, r, b.cx, b.cy, b.hw + 1, b.hh, b.rad)] as const;
  };
  const marks = face(s, fx, fy);
  for (let r = -HEAD; r < ROWS - 1; r++) for (let c = 0; c < COLS; c++) {
    const up = clamp((bottom - (r - s.y + 0.5)) / ry);
    const dx = (c - MID - s.hx * up) / rx, dy = (r - s.y + 0.5 - bottom) / ry;
    // Squarer at the cheeks, round at the crown.
    const e = lerp(s.ex, 2, clamp((-dy - 0.45) / 0.55)), f = (Math.abs(dx) ** e + Math.abs(dy) ** e) ** (1 / e);
    let head = dy > 0.3 ? 0 : clamp(((1 - f) * Math.min(rx, ry)) / 0.5 + 0.6);
    const [pl, gl] = paw(0, c, r), [pr, gr] = paw(1, c, r);
    const pawCov = clamp(-Math.min(pl, pr) * 4);
    head *= clamp(Math.min(gl, gr) * 4);
    if (pawCov > 0.15) { out.push([c, r, 0.44 * pawCov ** 0.6, "paw"]); continue; }
    const hat = helmet(c - hatX, r - hatY);
    if (hat) { out.push([c, r, 0.44 * hat[0] ** 0.6, hat[1]]); continue; }
    if (head <= 0.15) continue;
    const mark = head >= 0.5 ? marks.get(r * 100 + c) : undefined;
    if (mark) { out.push([c, r, mark === "eye" ? 0.56 : 0.44, mark]); continue; }
    out.push([c, r, 0.44 * head ** 0.6, "fur"]);
  }
  // The dirt swells where he comes up through it.
  for (let c = 0; c < COLS; c++) out.push([c, ROWS - 1, 0.44 * (1 + 0.22 * clamp(s.kick, -1, 1) * Math.exp(-(((c - MID) / 6) ** 2))), "dirt"]);
  return out;
}

/** One path per tone, painted back to front: eyes over the face, glints over the eyes. */
const ORDER: Tone[] = ["dirt", "fur", "helmet", "band", "housing", "brim", "paw", "stache", "brow", "nose", "lamp", "eye", "glint"];
function paths<T extends string>(dots: readonly (readonly [number, number, number, T])[], order: readonly T[], half = 0.5): Record<T, string> {
  const by = Object.fromEntries(order.map((t) => [t, ""])) as Record<T, string>;
  for (const [c, r, rad, t] of dots) {
    if (rad < 0.05) continue;
    const x = c + half - rad;
    by[t] += `M${x.toFixed(2)} ${(r + half).toFixed(2)}a${rad.toFixed(2)} ${rad.toFixed(2)} 0 1 0 ${(2 * rad).toFixed(2)} 0a${rad.toFixed(2)} ${rad.toFixed(2)} 0 1 0 ${(-2 * rad).toFixed(2)} 0`;
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

export type Mood = "idle" | "peek" | "thinking" | "happy" | "surprised" | "cheer" | "nod" | "shake" | "wink" | "laugh" | "proud" | "curious" | "sad" | "sleepy" | "set" | "shy" | "wave" | "huff" | "lookdown" | "anxious" | "ecstatic";
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
const BLINK: (ms: number) => [number, Beat][] = (ms) => [[ms, { to: { open: 0 } }], [ms + 120, { to: { open: 1 } }]];
/* Sizes here are in dots, and a dot is under 2px in the button and the chat: a move that shifts less than a row
   and a half is not seen. Each hop is a squat first (anticipation), then the spring up, then the dirt as he lands. */
export const MOVES: Record<Exclude<Mood, "idle">, Move> = {
  // Up out of the hole with a spray of dirt, then a blink.
  peek: { from: { y: 21 }, at: [[260, { kick: { kick: 9 } }], ...BLINK(1200)], end: 1500, still: {} },
  // Looks up to one side and taps a paw twice, blinks, then the other.
  thinking: { to: { lx: 1, ly: -1, hx: 0.6 }, loop: 4000, still: { lx: 1, ly: -1 },
    at: [[400, { kick: { pawR: TAP } }], [800, { kick: { pawR: TAP } }], ...BLINK(1500), [2000, { to: { lx: -1, hx: -0.6 } }], [2400, { kick: { pawL: TAP } }], [2800, { kick: { pawL: TAP } }], ...BLINK(3500)] },
  // A squat, then arc eyes, the moustache spread wide and a hop with both paws thrown up, and the dirt as he lands.
  happy: { to: { top: SQUAT }, end: 1700, still: HAPPY,
    at: [[110, { to: HAPPY, kick: { top: -HOP, pawL: THROW, pawR: THROW } }], [420, { kick: { kick: 7 } }]] },
  // A jolt up with both paws, his helmet jumping off his brows, wide eyes and an O.
  surprised: { to: WIDE, kick: { top: -JOLT, pawL: THROW, pawR: THROW, kick: 6 }, end: 1400, still: WIDE },
  // Both paws waving, bobbing on each beat, then a squat, a last hop and it settles pleased.
  cheer: { to: { arc: 1, ex: 3 }, wave: 900, end: 2400, still: HAPPY,
    at: [[900, { to: { ...HAPPY, top: SQUAT, pawL: 0, pawR: 0 } }], [1010, { to: HAPPY, kick: { top: -HOP, pawL: THROW, pawR: THROW } }], [1320, { kick: { kick: 7 } }]] },
  /* A broad range for the traced mole (D251); the small one plays what its shape can show of each. */
  // Yes: two nods, his whole head dipping.
  nod: { end: 1000, still: {}, at: [[0, { to: { top: 1.1, ly: 1 } }], [190, { to: { top: REST.top, ly: 0 } }], [400, { to: { top: 1.1, ly: 1 } }], [590, { to: { top: REST.top, ly: 0 } }]] },
  // No: eyes shut, his head from side to side.
  shake: { to: { open: 0 }, end: 1150, still: { open: 0 },
    at: [[0, { to: { hx: 1.5, lx: 1 } }], [170, { to: { hx: -1.5, lx: -1 } }], [340, { to: { hx: 1.5, lx: 1 } }], [510, { to: { hx: -1.5, lx: -1 } }], [680, { to: { hx: 0, lx: 0 } }], [800, { to: { open: 1 } }]] },
  // A wink: one eye, a lean and the moustache lifting on that side.
  wink: { to: { hx: 0.7, puff: 0.5 }, end: 1100, still: { wink: 1, hx: 0.7, twinkle: 1 }, at: [[140, { to: { wink: 1, twinkle: 1 } }], [520, { to: { wink: 0, twinkle: 0 } }], [700, { to: { hx: 0, puff: 0 } }]] },
  // A laugh: arc eyes, mouth open, his head and moustache shaking with it.
  laugh: { to: { arc: 1, mouth: 0.5 }, end: 1500, still: { arc: 1, mouth: 0.5 },
    at: [0, 170, 340, 510, 680, 850].map((ms): [number, Beat] => [ms + 120, { kick: { top: -34, puff: 2.5 } }]) },
  // Proud: he draws up and tips his helmet back, pleased.
  proud: { to: { top: -1.3, hat: 1.1, tilt: -0.16, arc: 1 }, kick: { top: -30 }, end: 1700, still: { top: -1.3, hat: 1.1, tilt: -0.16, arc: 1 }, at: [[1150, { to: { hat: 0, tilt: 0 } }]] },
  // Curious: his head cocked, one brow up, a look.
  curious: { to: { hx: 1.2, lx: 1, ly: -0.8, tilt: 0.1 }, end: 1900, still: { hx: 1.2, lx: 1, ly: -0.8, tilt: 0.1 }, at: [...BLINK(900)] },
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

/** From this width up he is drawn as the traced concept (`mole-fine.ts`, D251); under it his dots would be under 2px,
 *  so the small grid mole above stands in. */
export const FINE_FROM = 48;

/** The mole, `size` px wide (in its button, the dirt sits low in a square; `bare`, just the sprite; the dome may
 *  rise into the room above it). `mood` plays its move (one that doesn't loop then rests); at rest it blinks every
 *  5 to 9 s and glances to a side every 15 to 20 s. `look` (hover or focus on its button) faces him with a blink.
 *  `cue` replays the mood for a new event (another reply landing). Frames run only while it moves. Still under
 *  reduced motion and while the window is hidden (a mood shows its still pose). */
export function Mole({ size = 40, mood = "idle", cue, look = false, bare = false }: { size?: number; mood?: Mood; cue?: unknown; look?: boolean; bare?: boolean }) {
  const svg = useRef<SVGSVGElement>(null);
  const fine = size >= FINE_FROM, order: readonly string[] = fine ? FINE_ORDER : ORDER;
  const tones = useRef<Record<string, SVGPathElement | null>>({});
  const p = useRef(puppet());
  const run = useRef({ frame: 0, last: 0 });
  const looking = useRef(look);
  looking.current = look;

  // `data-mood` is the move it is playing (or showing still), for tests.
  const draw = () => {
    const d: Record<string, string> = fine ? paths(fineDots(p.current.v), FINE_ORDER, 0) : paths(moleDots(p.current.v), ORDER);
    for (const t of order) tones.current[t]?.setAttribute("d", d[t]!);
    svg.current?.setAttribute("data-mood", p.current.mood);
  };
  // Frames run while anything moves or a beat is still to come, then stop.
  const tick = (now: number) => {
    const dt = Math.min(0.033, Math.max(0, (now - run.current.last) / 1000));
    run.current.last = now;
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
  }, [mood, cue, fine]);

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
    <svg ref={svg} className="mole" data-fine={fine || undefined} width={size} height={bare ? (size * ROWS) / COLS : size} viewBox={bare ? `0 0 ${COLS} ${ROWS}` : `0 ${-LIFT} ${COLS} ${COLS}`} overflow="visible" aria-hidden="true">
      {order.map((t) => (
        <path key={t} ref={(el) => { tones.current[t] = el; }} className={`mole-${t}`} />
      ))}
    </svg>
  );
}
