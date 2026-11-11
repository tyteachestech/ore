import { useEffect, useLayoutEffect, useRef } from "react";

/* The tutor's mole (D168, drawn D169, a puppet since D214): its head and two paws over a strip of dirt, drawn as
   round dots on a 22 by 18 grid, like Nothing's dot glyphs. The face is an Animal Crossing mole's: a lighter
   muzzle, black eyes with one highlight, a pink nose.
   It moves like a puppet: each value of its shape (how high it stands, its dome, its paws, where it looks) follows a
   spring, and every frame the smooth shape is sampled onto the fixed grid. A dot's size says how much of it the
   shape covers, so the head and paws glide (halftone, D183). The face reads as features, so eyes, glints, the nose
   and the mouth stay whole dots that move a whole column at a time and never shimmer. */
export const COLS = 22, ROWS = 18;
const MID = (COLS - 1) / 2;
/** Rows of room above the grid, so the dome never runs off its top. */
export const HEAD = 3;

export type Tone = "fur" | "muzzle" | "white" | "paw" | "eye" | "glint" | "nose" | "dirt";
/** The puppet's values. y: rows sunk into the hole. top: the dome's top row. rx: head half width. ex: how square the
 *  dome is (2 round, 4 boxy). hx: head lean. lx, ly: where the eyes look. open: 1 open, 0 shut. tall: wide eyes.
 *  arc: ∩ eyes. nose: a bigger nose. pawL, pawR: rows each paw is raised. pw: paw width. kick: dirt swell. mouth: an o, then an O. */
export const REST = { y: 0, top: -0.3, rx: 10.2, ex: 2.6, hx: 0, lx: 0, ly: 0, open: 1, tall: 0, arc: 0, nose: 0, pawL: 0, pawR: 0, pw: 5, kick: 0, mouth: 0 };
export type State = typeof REST;
type Key = keyof State;
const KEYS = Object.keys(REST) as Key[];
/** Spring per value: [stiffness, damping]. Eyes snap; the body carries a little bounce. */
const SPRING: Record<Key, [number, number]> = { y: [130, 12], top: [210, 15], rx: [210, 16], ex: [200, 22], hx: [70, 13], lx: [90, 15], ly: [90, 15], open: [900, 52], tall: [420, 26], arc: [320, 30], nose: [300, 26], pawL: [260, 14], pawR: [260, 14], pw: [260, 24], kick: [160, 9], mouth: [380, 22] };

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const roundBox = (px: number, py: number, cx: number, cy: number, hw: number, hh: number, rad: number) => {
  const qx = Math.abs(px - cx) - hw + rad, qy = Math.abs(py - cy) - hh + rad;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad;
};

/** The face as whole dots, keyed r * 100 + c. Its position rounds to a dot; how open the eyes are picks a drawn shape. */
function face(s: State, fx: number, fy: number) {
  const m = new Map<number, Tone>(), set = (r: number, c: number, t: Tone) => m.set(r * 100 + c, t);
  const ox = Math.round(fx + s.lx * 0.65), oy = Math.round(fy + s.ly * 0.75), er = 7 + oy;
  for (const c0 of [5 + ox, 15 + ox]) {
    if (s.arc > 0.5) { for (const [dc, dr] of [[0, 1], [1, 0], [2, 0], [3, 1]] as const) set(er + 1 + dr, c0 - 1 + dc, "eye"); continue; }
    const rows = s.open < 0.35 ? [er + 2] : s.open < 0.75 ? [er + 1, er + 2] : s.tall > 0.5 ? [er - 1, er, er + 1, er + 2] : [er, er + 1, er + 2];
    for (const r of rows) { set(r, c0, "eye"); set(r, c0 + 1, "eye"); }
    // One highlight, top right of each eye (the light comes from the upper right).
    if (rows.length > 2) set(rows[0]!, c0 + 1, "glint");
  }
  const nx = Math.round(fx * 1.1), nr = 11 + oy;
  for (const c of [10 + nx, 11 + nx]) { set(nr, c, "nose"); if (s.nose > 0.5) set(nr + 1, c, "nose"); }
  // The mouth, under the nose: a small o, then a round O when he's surprised.
  const mr = 13 + oy + (s.nose > 0.5 ? 1 : 0);
  if (s.mouth > 0.25) { set(mr, 10 + nx, "eye"); set(mr, 11 + nx, "eye"); }
  if (s.mouth > 0.7) { set(mr + 1, 10 + nx, "eye"); set(mr + 1, 11 + nx, "eye"); }
  return m;
}

export type Dot = [c: number, r: number, radius: number, tone: Tone];
/** Every dot of the mole in state `s`, rows from -HEAD (room above the grid) to the dirt at ROWS - 1. */
export function moleDots(s: State): Dot[] {
  const out: Dot[] = [], bottom = ROWS - 1.5, ry = Math.max(4, bottom - s.top);
  const fx = s.hx * 0.8 + s.lx * 0.35, fy = s.y + s.ly * 0.25;
  const paw = (side: number, c: number, r: number) => {
    const w = s.pw, lift = side ? s.pawR : s.pawL, top = ROWS - 4 - lift + s.y;
    const x0 = side ? COLS - w - 0.25 : -0.25, x1 = x0 + w - 0.5, y0 = top - 0.25, y1 = ROWS + 1;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hw = (x1 - x0) / 2, hh = Math.max(0.3, (y1 - y0) / 2), rad = Math.min(1, hh);
    // The paw, and a box one dot wider that keeps the head apart from it.
    return [roundBox(c, r, cx, cy, hw, hh, rad), roundBox(c, r, cx, cy, hw + 1, hh, rad)] as const;
  };
  const marks = face(s, fx, fy);
  for (let r = -HEAD; r < ROWS - 1; r++) for (let c = 0; c < COLS; c++) {
    const up = clamp((bottom - (r - s.y + 0.5)) / ry);
    const dx = (c - MID - s.hx * up) / s.rx, dy = (r - s.y + 0.5 - bottom) / ry;
    // Squarer at the cheeks, round at the crown.
    const e = lerp(s.ex, 2, clamp((-dy - 0.45) / 0.55)), f = (Math.abs(dx) ** e + Math.abs(dy) ** e) ** (1 / e);
    let head = dy > 0.3 ? 0 : clamp(((1 - f) * Math.min(s.rx, ry)) / 0.5 + 0.6);
    const [pl, gl] = paw(0, c, r), [pr, gr] = paw(1, c, r);
    const pawCov = clamp(-Math.min(pl, pr) * 4);
    head *= clamp(Math.min(gl, gr) * 4);
    if (pawCov > 0.15) { out.push([c, r, 0.44 * pawCov ** 0.6, "paw"]); continue; }
    if (head <= 0.15) continue;
    const mark = head >= 0.5 ? marks.get(r * 100 + c) : undefined;
    if (mark) { out.push([c, r, mark === "eye" ? 0.56 : 0.44, mark]); continue; }
    // Fur, then the muzzle: a light bell from between the eyes to the dirt, whitest in the middle.
    const mx = c - MID - fx, my = r - 12.2 - fy;
    const tone: Tone = (mx / 3.4) ** 2 + (my / 3) ** 2 <= 1 ? "white" : (mx / 4.6) ** 2 + (my / 3.8) ** 2 <= 1 ? "muzzle" : "fur";
    out.push([c, r, 0.44 * head ** 0.6, tone]);
  }
  // The dirt swells where he comes up through it.
  for (let c = 0; c < COLS; c++) out.push([c, ROWS - 1, 0.44 * (1 + 0.22 * clamp(s.kick, -1, 1) * Math.exp(-(((c - MID) / 6) ** 2))), "dirt"]);
  return out;
}

/** One path per tone, painted back to front: eyes over the face, glints over the eyes. */
const ORDER: Tone[] = ["dirt", "fur", "muzzle", "white", "paw", "nose", "eye", "glint"];
function paths(dots: Dot[]): Record<Tone, string> {
  const by = Object.fromEntries(ORDER.map((t) => [t, ""])) as Record<Tone, string>;
  for (const [c, r, rad, t] of dots) {
    if (rad < 0.05) continue;
    const x = c + 0.5 - rad;
    by[t] += `M${x.toFixed(2)} ${r + 0.5}a${rad.toFixed(2)} ${rad.toFixed(2)} 0 1 0 ${(2 * rad).toFixed(2)} 0a${rad.toFixed(2)} ${rad.toFixed(2)} 0 1 0 ${(-2 * rad).toFixed(2)} 0`;
  }
  return by;
}

/** One spring step of `dt` seconds toward `to`. */
export function step(v: State, vel: State, to: State, dt: number) {
  for (const k of KEYS) {
    const [st, da] = SPRING[k];
    vel[k] += (st * (to[k] - v[k]) - da * vel[k]) * dt;
    v[k] += vel[k] * dt;
  }
  v.rx = clamp(v.rx, 8, 11.5); v.top = clamp(v.top, -2.5, 6); v.ex = clamp(v.ex, 2, 4.5);
}

export type Mood = "idle" | "peek" | "thinking" | "happy" | "surprised" | "cheer";
/** A mood: where each value should settle (`to`), where it starts (`from`), pushes that set it moving (`kick`), timed
 *  changes after (`at`), paws waving until `wave` ms, and when it rests (`end`) or starts over (`loop`).
 *  `still` is the one pose shown under reduced motion or in a hidden window. */
type Beat = { to?: Partial<State>; kick?: Partial<State> };
type Move = Beat & { from?: Partial<State>; at?: [ms: number, Beat][]; wave?: number; end?: number; loop?: number; still: Partial<State> };
const HAPPY: Partial<State> = { arc: 1, nose: 1, pw: 6, ex: 3.6, rx: 10, top: 0.6 };
const WIDE: Partial<State> = { tall: 1, nose: 1, mouth: 1, rx: 10.4, top: 1.4 };
export const MOVES: Record<Exclude<Mood, "idle">, Move> = {
  // Up out of the hole with a spray of dirt, then a blink.
  peek: { from: { y: 18 }, at: [[260, { kick: { kick: 9 } }], [1200, { to: { open: 0 } }], [1330, { to: { open: 1 } }]], end: 1500, still: {} },
  // Looks up to one side and taps a paw twice, then the other.
  thinking: { to: { lx: 1, ly: -1, hx: 0.6 }, loop: 4000, still: { lx: 1, ly: -1 },
    at: [[400, { kick: { pawR: 16 } }], [800, { kick: { pawR: 16 } }], [2000, { to: { lx: -1, hx: -0.6 } }], [2400, { kick: { pawL: 16 } }], [2800, { kick: { pawL: 16 } }]] },
  // Arc eyes and a hop with both paws.
  happy: { to: HAPPY, kick: { top: -26, pawL: 14, pawR: 14, kick: 6 }, end: 1800, still: HAPPY },
  // A jolt, wide eyes and an O.
  surprised: { to: WIDE, kick: { top: -34, rx: -5 }, end: 1400, still: WIDE },
  // Both paws waving, bobbing on each beat, then a last hop and it settles pleased.
  cheer: { to: { arc: 1, nose: 1, ex: 3 }, wave: 900, at: [[900, { to: { ...HAPPY, pawL: 0, pawR: 0 }, kick: { top: -14 } }]], end: 2400, still: HAPPY },
};

/** In its button the sprite sits 3.3 dots below a square's top, so its dirt lands low and it pokes out of the ground. */
const LIFT = 3.3;
const BLINK_MS = 120, LOOK_MS = 900;
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const settled = (v: State, vel: State, to: State) => KEYS.every((k) => Math.abs(to[k] - v[k]) < 0.002 && Math.abs(vel[k]) < 0.002);

/** The mole, `size` px wide (in its button, the dirt sits low in a square; `bare`, just the sprite; the dome may
 *  rise into the room above it). `mood` plays its move (one that doesn't loop then rests); at rest it blinks every
 *  5 to 9 s and glances to a side every 15 to 20 s. `look` (hover or focus on its button) faces him with a blink.
 *  `cue` replays the mood for a new event (another reply landing). Frames run only while it moves. Still under
 *  reduced motion and while the window is hidden (a mood shows its still pose). */
export function Mole({ size = 40, mood = "idle", cue, look = false, bare = false }: { size?: number; mood?: Mood; cue?: unknown; look?: boolean; bare?: boolean }) {
  const tones = useRef<Partial<Record<Tone, SVGPathElement | null>>>({});
  const p = useRef({ v: { ...REST }, vel: { ...REST, ...Object.fromEntries(KEYS.map((k) => [k, 0])) } as State, to: { ...REST }, move: null as Move | null, t0: 0, fired: 0, frame: 0, last: 0 });
  const looking = useRef(look);
  looking.current = look;

  const draw = () => {
    const d = paths(moleDots(p.current.v));
    for (const t of ORDER) tones.current[t]?.setAttribute("d", d[t]);
  };
  // Springs run while anything is moving or a beat is still to come, then stop.
  const tick = (now: number) => {
    const s = p.current, m = s.move, t = now - s.t0;
    const dt = Math.min(0.033, (now - s.last) / 1000);
    s.last = now;
    if (m) {
      const at = m.at ?? [];
      while (s.fired < at.length && t >= at[s.fired]![0]) {
        const b = at[s.fired++]![1];
        Object.assign(s.to, b.to);
        for (const [k, v] of Object.entries(b.kick ?? {})) s.vel[k as Key] += v;
      }
      if (m.wave && t < m.wave) {
        const ph = (t / 360) * 2 * Math.PI;
        Object.assign(s.to, { pawL: 2 + 1.1 * Math.cos(ph), pawR: 2 - 1.1 * Math.cos(ph), top: REST.top - 0.35 * Math.abs(Math.sin(ph)) });
      }
      if (m.loop && t >= m.loop) start(m, now);
      else if (m.end && t >= m.end) { s.move = null; s.to = { ...REST }; }
    }
    // Two half steps keep the stiff eye spring steady at 60 Hz.
    step(s.v, s.vel, s.to, dt / 2);
    step(s.v, s.vel, s.to, dt / 2);
    draw();
    if (!s.move && settled(s.v, s.vel, s.to)) { s.frame = 0; return; }
    s.frame = requestAnimationFrame(tick);
  };
  const wake = () => {
    const s = p.current;
    if (s.frame) return;
    s.last = performance.now();
    s.frame = requestAnimationFrame(tick);
  };
  const start = (m: Move, now: number) => {
    const s = p.current;
    Object.assign(s, { move: m, t0: now, fired: 0, to: { ...REST, ...m.to } });
    Object.assign(s.v, m.from);
    for (const [k, v] of Object.entries(m.kick ?? {})) s.vel[k as Key] += v;
  };
  const rest = (pose: Partial<State>) => {
    const s = p.current;
    if (s.frame) cancelAnimationFrame(s.frame);
    Object.assign(s, { move: null, frame: 0, to: { ...REST, ...pose }, v: { ...REST, ...pose } });
    for (const k of KEYS) s.vel[k] = 0;
    draw();
  };

  // A mood's move, set up before the first paint so the frame before it never shows (a peek starts in the hole).
  // Reduced motion, or a hidden window, shows its still pose; a window shown again plays it then (a move that
  // already played once stays done).
  useLayoutEffect(() => {
    if (mood === "idle") {
      if (p.current.move) { p.current.move = null; p.current.to = { ...REST }; wake(); } else draw();
      return;
    }
    const move = MOVES[mood];
    let played = false;
    const run = () => {
      if (still() || document.hidden) return rest(move.still);
      played = !move.loop;
      start(move, performance.now());
      draw();
      wake();
    };
    const shown = () => { if (!document.hidden && !played) run(); };
    run();
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
    const hold = (pose: Partial<State>, ms: number) => {
      Object.assign(p.current.to, pose);
      wake();
      later(() => { if (!p.current.move) { for (const k of Object.keys(pose) as Key[]) p.current.to[k] = REST[k]; wake(); } }, ms);
    };
    const blinks = () => later(() => { if (!quiet()) hold({ open: 0 }, BLINK_MS); if (alive) blinks(); }, between(5000, 9000));
    const turns = () =>
      later(() => {
        if (!quiet()) {
          const first = Math.random() < 0.5 ? -1 : 1;
          hold({ lx: first, hx: first * 0.45 }, LOOK_MS);
          if (Math.random() < 0.5) later(() => { if (!quiet()) hold({ lx: -first, hx: -first * 0.45 }, LOOK_MS); }, LOOK_MS + 400);
        }
        if (alive) turns();
      }, between(15000, 20000));
    blinks();
    turns();
    return () => { alive = false; timers.forEach(clearTimeout); if (p.current.frame) cancelAnimationFrame(p.current.frame); p.current.frame = 0; };
  }, []);

  // Hovered or focused: it faces him and blinks.
  useEffect(() => {
    if (!look || p.current.move || still()) return;
    const s = p.current;
    Object.assign(s.to, { lx: 0, ly: 0, hx: 0, open: 0 });
    wake();
    const id = window.setTimeout(() => { s.to.open = REST.open; wake(); }, BLINK_MS);
    return () => clearTimeout(id);
  }, [look]);

  // The dirt sits low in the button, so the mole reads as poking out of the ground at its foot.
  return (
    <svg className="mole" data-mood={mood} width={size} height={bare ? (size * ROWS) / COLS : size} viewBox={bare ? `0 0 ${COLS} ${ROWS}` : `0 ${-LIFT} ${COLS} ${COLS}`} overflow="visible" aria-hidden="true">
      {ORDER.map((t) => (
        <path key={t} ref={(el) => { tones.current[t] = el; }} className={`mole-${t}`} />
      ))}
    </svg>
  );
}
