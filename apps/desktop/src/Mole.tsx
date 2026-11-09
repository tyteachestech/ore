import { useEffect, useMemo, useRef, useState } from "react";

/* The tutor's mole (D168, redrawn D169): its head and two paws over a strip of dirt, drawn as round dots on a
   22 by 18 grid, like Nothing's dot glyphs. Every dot is the same size; only its tone changes. The face is an
   Animal Crossing mole's: a lighter muzzle, black eyes with one highlight, a pink nose.
   It never leaves the grid: each move shifts whole dots (a blink, a glance, a hop, a paw tap), stepped like an
   8-bit sprite, so every pose is one grid from `moleGrid`. A mood is a timeline of poses (MOVES). */
export const COLS = 22, ROWS = 18;
const MID = (COLS - 1) / 2;

export type Tone = "fur" | "lit" | "muzzle" | "white" | "paw" | "eye" | "glint" | "nose" | "dirt";
export type Pose = {
  /** Head: half width in dots, top row, and how square its dome is (2 round, 4 boxy). */
  rx: number; top: number; ex: number;
  eyes: "open" | "tall" | "half" | "shut" | "arc";
  /** Where the eyes look, in whole dots. */
  lx: number; ly: number;
  /** A bigger nose (2 by 2) when excited. */
  nose2: boolean;
  /** Paw width, and how many rows each paw is raised. */
  paw: 5 | 6; pawL: number; pawR: number;
  /** Rows the head and paws have sunk into the hole. */
  y: number;
};
export const REST: Pose = { rx: 10.2, top: 0.3, ex: 2.4, eyes: "open", lx: 0, ly: 0, nose2: false, paw: 5, pawL: 0, pawR: 0, y: 0 };

const PAWS = { 5: [".ppp.", "ppppp", "p.p.p"], 6: [".pppp.", "pppppp", "p.pp.p"] } as const;

/** The pose as a grid of tones, null where there is no dot. The last row is the dirt; nothing goes below it. */
export function moleGrid(pose: Partial<Pose> = {}): (Tone | null)[][] {
  const p = { ...REST, ...pose };
  const g: (Tone | null)[][] = Array.from({ length: ROWS }, () => Array<Tone | null>(COLS).fill(null));
  const put = (r: number, c: number, v: Tone | null) => { if (r >= 0 && r < ROWS - 1 && c >= 0 && c < COLS) g[r]![c] = v; };
  // Face marks only land on the head, so a sunk mole's eyes never float over the dirt.
  const face = (r: number, c: number, v: Tone) => { if (g[r]?.[c]) g[r]![c] = v; };
  const bottom = ROWS - 1.5, ry = bottom - p.top;
  for (let r = 0; r < ROWS - 1; r++) for (let c = 0; c < COLS; c++) {
    const dx = (c - MID) / p.rx, dy = (r - p.y + 0.5 - bottom) / ry;
    if (Math.abs(dx) ** p.ex + Math.abs(dy) ** p.ex <= 1) g[r]![c] = c - MID < -2 && dy < -0.55 ? "lit" : "fur";
  }
  // The muzzle: a light bell from between the eyes to the dirt, whitest in the middle.
  const my = 12.2 + p.y;
  for (let r = 0; r < ROWS - 1; r++) for (let c = 0; c < COLS; c++) {
    if (!g[r]![c] || ((c - MID) / 4.6) ** 2 + ((r - my) / 3.8) ** 2 > 1) continue;
    g[r]![c] = ((c - MID) / 3.4) ** 2 + ((r - my) / 3) ** 2 <= 1 ? "white" : "muzzle";
  }
  const eL = 5 + p.lx, eR = 15 + p.lx, er = 7 + p.ly + p.y;
  if (p.eyes === "arc") {
    // Happy: each eye a ∩, four dots wide.
    for (const c0 of [eL - 1, eR]) for (const [dc, dr] of [[0, 1], [1, 0], [2, 0], [3, 1]] as const) face(er + 1 + dr, c0 + dc, "eye");
  } else if (p.eyes === "shut") {
    for (const c0 of [eL, eR]) { face(er + 2, c0, "eye"); face(er + 2, c0 + 1, "eye"); }
  } else {
    const rows = p.eyes === "tall" ? [er - 1, er, er + 1, er + 2] : p.eyes === "half" ? [er + 1, er + 2] : [er, er + 1, er + 2];
    for (const c0 of [eL, eR]) {
      for (const r of rows) { face(r, c0, "eye"); face(r, c0 + 1, "eye"); }
      // One highlight, top right of each eye (the light comes from the upper right).
      if (p.eyes !== "half") face(rows[0]!, c0 + 1, "glint");
    }
  }
  const nr = 11 + p.y;
  for (const c of [10, 11]) { face(nr, c, "nose"); if (p.nose2) face(nr + 1, c, "nose"); }
  // The paws hook over the dirt with their toes split; a one-dot gap keeps them apart from the head.
  for (const side of [0, 1]) {
    const w = p.paw, c0 = side ? COLS - w : 0, lift = side ? p.pawR : p.pawL, top = ROWS - 4 - lift + p.y;
    const gap = side ? c0 - 1 : c0 + w;
    for (let r = top; r < top + 3; r++) if (g[r]?.[gap] === "fur" || g[r]?.[gap] === "lit" || g[r]?.[gap] === "muzzle") g[r]![gap] = null;
    PAWS[w].forEach((row, i) => [...row].forEach((ch, j) => {
      if (ch === "p") put(top + i, c0 + j, "paw");
      else if (!lift) put(top + i, c0 + j, null);
    }));
  }
  g[ROWS - 1]!.fill("dirt");
  return g;
}

export type Mood = "idle" | "peek" | "thinking" | "happy" | "surprised" | "cheer";
/** Poses held from their time (ms) until the next; at `end` a loop starts over and any other move rests.
 *  `still` is the one pose shown under reduced motion or in a hidden window. */
type Move = { keys: [ms: number, pose: Partial<Pose>][]; end: number; loop?: boolean; still: Partial<Pose> };
const HAPPY: Partial<Pose> = { eyes: "arc", nose2: true, paw: 6, ex: 3.6, rx: 10, top: 1 };
const CHEER: Partial<Pose> = { eyes: "arc", nose2: true, ex: 3 };
const WIDE: Partial<Pose> = { eyes: "tall", nose2: true, rx: 10.6, top: 2 };
const UP_R: Partial<Pose> = { lx: 1, ly: -1 }, UP_L: Partial<Pose> = { lx: -1, ly: -1 };
export const MOVES: Record<Exclude<Mood, "idle">, Move> = {
  // Out of the hole: rises in three steps, overshoots a dot, settles, blinks.
  peek: { keys: [[0, { y: 17 }], [90, { y: 9 }], [180, { y: 5 }], [270, { y: 2 }], [360, { top: 1.3 }], [450, { top: -0.3 }], [540, {}], [1200, { eyes: "shut" }], [1330, {}]], end: 1330, still: {} },
  // Looks up to one side and taps a paw, then the other.
  thinking: { loop: true, keys: [[0, UP_R], [400, { ...UP_R, pawR: 1 }], [600, UP_R], [800, { ...UP_R, pawR: 1 }], [1000, UP_R], [2000, UP_L], [2400, { ...UP_L, pawL: 1 }], [2600, UP_L], [2800, { ...UP_L, pawL: 1 }], [3000, UP_L]], end: 4000, still: UP_R },
  // Arc eyes and a hop with both paws.
  happy: { keys: [[0, HAPPY], [100, { ...HAPPY, top: 0, pawL: 1, pawR: 1 }], [220, HAPPY]], end: 1800, still: HAPPY },
  // Wide eyes and a jolt.
  surprised: { keys: [[0, WIDE], [80, { ...WIDE, rx: 10, top: -0.4 }], [180, WIDE]], end: 1400, still: WIDE },
  // Both paws waving, a bounce on each beat, then it settles pleased.
  cheer: { keys: [[0, { ...CHEER, pawL: 3, pawR: 1 }], [180, { ...CHEER, top: -0.4, pawL: 1, pawR: 3 }], [360, { ...CHEER, pawL: 3, pawR: 1 }], [540, { ...CHEER, top: -0.4, pawL: 1, pawR: 3 }], [720, { ...CHEER, pawL: 3, pawR: 1 }], [900, HAPPY]], end: 2400, still: HAPPY },
};
/** One path per tone: a circle per dot (eyes a little bigger, so each reads as one black shape). */
function paths(g: (Tone | null)[][]): [Tone, string][] {
  const by = new Map<Tone, string[]>();
  g.forEach((row, r) => row.forEach((t, c) => {
    if (!t) return;
    const rad = t === "eye" ? 0.56 : 0.44, x = c + 0.5 - rad, y = r + 0.5;
    if (!by.has(t)) by.set(t, []);
    by.get(t)!.push(`M${x.toFixed(2)} ${y}a${rad} ${rad} 0 1 0 ${2 * rad} 0a${rad} ${rad} 0 1 0 ${-2 * rad} 0`);
  }));
  // Painted back to front: eyes over the face, glints over the eyes.
  const order: Tone[] = ["dirt", "fur", "lit", "muzzle", "white", "paw", "nose", "eye", "glint"];
  return order.filter((t) => by.has(t)).map((t) => [t, by.get(t)!.join("")]);
}
const cache = new Map<string, [Tone, string][]>();
const drawn = (p: Partial<Pose>) => {
  const k = JSON.stringify(p);
  if (!cache.has(k)) cache.set(k, paths(moleGrid(p)));
  return cache.get(k)!;
};

/** In its button the sprite sits 3.3 dots below a square's top, so its dirt lands low and it pokes out of the ground. */
const LIFT = 3.3;
const BLINK_MS = 130, LOOK_MS = 900;
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

/** The mole, `size` px wide (in its button, the dirt sits low in a square; `bare`, just the sprite). `mood` plays its move (one that doesn't loop then rests); at rest it blinks every
 *  5 to 9 s and glances to a side every 15 to 20 s. `look` (hover or focus on its button) faces him with a blink.
 *  Still under reduced motion and while the window is hidden (a mood shows its still pose). */
export function Mole({ size = 40, mood = "idle", cue, look = false, bare = false }: { size?: number; mood?: Mood; cue?: unknown; look?: boolean; bare?: boolean }) {
  const [pose, setPose] = useState<Partial<Pose>>({});
  const [busy, setBusy] = useState(false);
  const looking = useRef(look);
  looking.current = look;
  const resting = useRef(true);
  const blink = useRef<() => void>(() => {});

  // A mood's move: its first pose now (so the frame before it never shows), the rest at their times; a loop starts
  // over, any other move hands back to rest. `cue` replays the same mood for a new event (another reply landing).
  // Reduced motion, or a hidden window, shows its still pose; a window shown again plays it then (a move that already played once stays done).
  useEffect(() => {
    if (mood === "idle") { setBusy(false); setPose({}); return; }
    const move = MOVES[mood];
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => { const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
    let played = false;
    const run = () => {
      if (still() || document.hidden) { setPose(move.still); setBusy(!!move.loop); return; }
      played = !move.loop;
      setPose(move.keys[0]![1]);
      for (const [ms, p] of move.keys.slice(1)) later(() => setPose(p), ms);
      later(() => (move.loop && !document.hidden ? run() : (setBusy(!!move.loop), setPose(move.loop ? move.still : {}))), move.end);
    };
    const shown = () => { if (!document.hidden && !played) { timers.forEach(clearTimeout); timers.clear(); run(); } };
    setBusy(true);
    run();
    document.addEventListener("visibilitychange", shown);
    return () => { timers.forEach(clearTimeout); document.removeEventListener("visibilitychange", shown); };
  }, [mood, cue]);
  resting.current = !busy;

  // At rest: blinks and glances, never while it is facing him, hidden, or asked for less motion.
  useEffect(() => {
    const timers = new Set<number>();
    let alive = true;
    const later = (fn: () => void, ms: number) => {
      const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms);
      timers.add(id);
    };
    const quiet = () => !resting.current || looking.current || document.hidden || still();
    const show = (p: Partial<Pose>, ms: number) => {
      setPose(p);
      later(() => setPose((q) => (q === p && resting.current ? {} : q)), ms);
    };
    blink.current = () => { if (resting.current && !still()) show({ eyes: "shut" }, BLINK_MS); };
    const blinks = () => later(() => { if (!quiet()) blink.current(); if (alive) blinks(); }, between(5000, 9000));
    const turns = () =>
      later(() => {
        if (!quiet()) {
          const first = Math.random() < 0.5 ? -1 : 1;
          show({ lx: first }, LOOK_MS);
          if (Math.random() < 0.5) later(() => { if (!quiet()) show({ lx: -first }, LOOK_MS); }, LOOK_MS + 400);
        }
        if (alive) turns();
      }, between(15000, 20000));
    blinks();
    turns();
    return () => { alive = false; timers.forEach(clearTimeout); };
  }, []);

  // Hovered or focused: it faces him and blinks.
  useEffect(() => {
    if (!look) return;
    if (resting.current) setPose({});
    blink.current();
  }, [look]);

  const d = useMemo(() => drawn(pose), [pose]);
  // The dirt sits low in the button, so the mole reads as poking out of the ground at its foot.
  return (
    <svg className="mole" width={size} height={bare ? (size * ROWS) / COLS : size} viewBox={bare ? `0 0 ${COLS} ${ROWS}` : `0 ${-LIFT} ${COLS} ${COLS}`} aria-hidden="true">
      {d.map(([tone, path]) => (
        <path key={tone} className={`mole-${tone}`} d={path} />
      ))}
    </svg>
  );
}
