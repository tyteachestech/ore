import { PARTS } from "./mole-fine-data";
import type { State } from "./Mole";

/* The mole at 48 px and up (D251): concept 4 itself, every dot traced from the drawing, so his dots sit where the
   drawing put them and not on a grid. He moves as a cut-out puppet on the same springs as the small one: the head
   (fur, face, helmet) rides up and down and leans, each lobe of the moustache swings from under his nose, the paws
   lift on their arms, and a dot under a part above it (fur under the helmet, a lid under an eye) shrinks away, so
   nothing shows through and nothing pops. Positions come out in the small mole's 22 by 18 space, so he drops into
   the same box. */

/** Greys run from 0, the page, to 9, the text colour: `fine-0` … `fine-9`. */
export type FineTone = `fine-${number}` | "eye" | "glint" | "nose" | "lamp" | "dirt";
export const FINE_ORDER: FineTone[] = ["dirt", ...Array.from({ length: 10 }, (_, i) => `fine-${i}` as const), "nose", "lamp", "eye", "glint"];
export type FineDot = [x: number, y: number, radius: number, tone: FineTone];

/** The small mole's box and its dome's top row at rest (`COLS`, `ROWS`, `REST.top` in Mole.tsx, which imports this file). */
export const COLS = 22, ROWS = 18, REST_TOP = -0.3;
/** One dot of his pitch in the 22-wide space: he is 33 dots across. */
const U = COLS / 33;
const MID = COLS / 2, GROUND = ROWS - 0.36;
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const grey = (b: number): FineTone => `fine-${Math.round(clamp((b - 25) / 215) * 9)}`;

type P = { x: number; y: number; r: number; tone: FineTone };
const part = (name: string, tone?: FineTone): P[] => {
  const a = PARTS[name]!, out: P[] = [];
  for (let i = 0; i < a.length; i += 4) out.push({ x: a[i]! * U, y: a[i + 1]! * U, r: a[i + 2]! * U, tone: tone ?? grey(a[i + 3]!) });
  return out;
};
const FUR = part("fur"), GAP = part("gap"), NOSE = part("nose", "nose"), HELMET = part("helmet"), LAMP = part("lamp", "lamp");
const SIDES = [-1, 1].map((side) => {
  const s = side < 0 ? "L" : "R";
  const eye = part(`eye${s}`, "eye"), glint = part(`glint${s}`, "glint")[0]!;
  const top = Math.min(...eye.map((d) => d.y)), cx = eye.reduce((a, d) => a + d.x, 0) / eye.length;
  return { side, eye, glint, top, cx, lobe: part(`lobe${s}`), paw: part(`paw${s}`) };
});
/** Top of his head, for how far a lean carries a dot; where each lobe hangs from; the mouth, between the lobes. */
const CROWN = -27 * U, BRIM = -15.5 * U, PIVOT_Y = -10.4 * U, PIVOT_X = 0.9 * U, MOUTH_Y = -6.1 * U;
/** Pleased, his cheeks lift: each lobe swings out a little (radians), rises and parts (dots). An open mouth parts them too. */
const SMILE = 0.2, LIFT = 0.4, APART = 0.6, PART = 0.1;

/** Every dot of the fine mole in state `s`, in the small mole's space (x 0 to 22, the dirt along the foot of row 17). */
export function fineDots(s: State): FineDot[] {
  // The head rides his height and a hop (`top` above its rest is a hop, below it a squat), and leans from the ground up.
  // The small mole flattens its dome when it is pleased or startled; this one keeps its head, so that part is taken back out.
  const wide = clamp(s.tall), arc = clamp(s.arc), shutBoth = 1 - clamp(s.open);
  const rise = s.top - REST_TOP - 1.7 * wide - 0.9 * arc, sy = 1 - rise * 0.022, sx = 1 / sy;
  // A brow, cocked on the side he looks up to and both when he is startled, tips his helmet back to show.
  const brows = SIDES.map(({ side }) => Math.max(wide, clamp(side * s.lx) * clamp(-s.ly)));
  const tip = -(wide * 1.5 + Math.max(brows[0]!, brows[1]!) * (1 - wide) * 1.0 + s.hat);
  const frown = clamp(s.frown), tc = Math.cos(s.tilt), ts = Math.sin(s.tilt);
  // The helmet tips about the middle of its brim.
  const tilted = (p: P): P => { const dx = p.x, dy = p.y - BRIM; return { ...p, x: dx * tc - dy * ts, y: BRIM + dx * ts + dy * tc }; };
  const head = (p: P, dx = 0, dy = 0, lean = 1): [number, number] => {
    const up = clamp(p.y / CROWN) * lean;
    return [MID + (p.x + dx) * sx + s.hx * 0.8 * up, GROUND + (p.y + dy) * sy + s.y + rise];
  };
  // Layers from the top down: a dot shrinks under any dot of a layer above it.
  const layers: [x: number, y: number, r: number, tone: FineTone, hides: boolean][][] = [];
  const layer = () => { const l: (typeof layers)[number] = []; layers.push(l); return l; };

  const paws = layer();
  for (const { side, paw } of SIDES) {
    const lift = side < 0 ? s.pawL : s.pawR;
    for (const p of paw) paws.push([MID + p.x, GROUND + p.y + s.y - lift, p.r, p.tone, true]);
  }
  const hat = layer();
  for (const p of HELMET) { const [x, y] = head(tilted(p), 0, tip, 1.12); hat.push([x, y, p.r, p.tone, true]); }
  for (const p of LAMP) { const [x, y] = head(tilted(p), 0, tip, 1.12); hat.push([x, y, p.r * (1 + 0.3 * clamp(s.lamp)), p.tone, true]); }

  // The face looks where he looks: eyes most, nose and moustache a little less. Eyes never rise into the brim.
  const fx = s.lx * 0.5, ex = s.lx * 0.3, ey = Math.max(0, s.ly) * 0.3, fy = s.ly * 0.2;
  const lobes = layer();
  for (const { side, lobe } of SIDES) {
    const a = -side * (arc * SMILE + clamp(s.mouth) * PART + s.puff * 0.3 - clamp(s.droop) * 0.07), cos = Math.cos(a), sin = Math.sin(a), px = side * PIVOT_X;
    for (const p of lobe) {
      const rx = p.x - px, ry = p.y - PIVOT_Y;
      const [x, y] = head({ ...p, x: px + rx * cos - ry * sin + side * APART * U * arc, y: PIVOT_Y + rx * sin + ry * cos - LIFT * U * arc + 0.35 * U * clamp(s.droop) }, fx, fy);
      lobes.push([x, y, p.r, p.tone, true]);
    }
  }
  const face = layer();
  for (const p of NOSE) { const [x, y] = head(p, fx, fy); face.push([x, y, p.r, "nose", true]); }
  const o = clamp((s.mouth - 0.15) / 0.3), O = clamp((s.mouth - 0.6) / 0.3);
  for (const [dy, k] of [[0, o], [U, O]] as const) if (k > 0.02) { const [x, y] = head({ x: 0, y: MOUTH_Y + dy, r: 0, tone: "eye" }, fx, fy); face.push([x, y, 0.4 * U * k, "eye", true]); }
  for (const [n, { eye, glint, top, cx, side }] of SIDES.entries()) {
    // Open: the traced block, a row taller when he is startled. A blink leaves its lower row as a line. Pleased: an arc.
    const shut = side > 0 ? Math.max(shutBoth, clamp(s.wink)) : shutBoth;
    for (const p of eye) {
      const upper = p.y < top + U / 2, k = (upper ? 1 - shut : 1 - 0.25 * shut) * (1 - arc);
      const [x, y] = head(p, ex, ey);
      if (k > 0.02) face.push([x, y, p.r * k, "eye", true]);
      if (upper && wide * (1 - arc) > 0.02) { const [x2, y2] = head(p, ex, ey - U); face.push([x2, y2, p.r * wide * (1 - arc) * (1 - shut), "eye", true]); }
    }
    const [gx, gy] = head(glint, ex, ey - wide * U);
    face.push([gx, gy, glint.r * (1 - shut) * (1 - arc), "glint", false]);
    if (arc > 0.02) for (const [dx, dy] of [[-1.5, 1.25], [-0.8, 0.5], [0, 0.2], [0.8, 0.5], [1.5, 1.25]] as const) {
      const [x, y] = head({ x: cx + dx * U, y: top + dy * U, r: 0, tone: "eye" }, ex, ey);
      face.push([x, y, 0.36 * U * arc, "eye", true]);
    }
    const brow = brows[n]!;
    if (brow > 0.02) for (let i = 0; i < 4; i++) {
      const [x, y] = head({ x: cx + (i - 1.5) * U, y: top - (1.45 + wide * 0.9 - Math.abs(i - 1.5 - side * 0.5) * 0.3 * (1 - wide)) * U, r: 0, tone: "glint" }, ex, ey);
      face.push([x, y, 0.34 * U * brow, "fine-9", true]);
    }
      // A frown: both brows low on his eyes, their inner ends down.
    if (frown > 0.02) for (let i = 0; i < 4; i++) {
      const inner = (1.5 - side * (i - 1.5)) / 3;
      const [x, y] = head({ x: cx + (i - 1.5) * U, y: top - (0.85 - 0.75 * inner) * U, r: 0, tone: "glint" }, ex, ey);
      face.push([x, y, 0.36 * U * frown, "glint", true]);
    }
  }
  const fur = layer();
  for (const p of FUR) { const [x, y] = head(p); fur.push([x, y, p.r, p.tone, true]); }
  for (const p of GAP) { const [x, y] = head(p, fx, fy); fur.push([x, y, p.r, p.tone, true]); }

  // Top layer first: each dot is sized by the nearest dot above it, then joins what hides the layers below.
  const out: FineDot[] = [], cell = 0.75, grid = new Map<number, number[]>();
  const key = (cx: number, cy: number) => cx * 4096 + cy;
  const floor = GROUND - 0.28;
  for (const l of layers) {
    const kept: [number, number, number][] = [];
    for (const [x, y, r0, tone, hides] of l) {
      // The dirt hides what is below it.
      let r = r0 * clamp((floor - y) / 0.3 + 0.5);
      if (r < 0.02) continue;
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      let vis = 1;
      for (let i = -1; i <= 1 && vis > 0; i++) for (let j = -1; j <= 1; j++) {
        const b = grid.get(key(cx + i, cy + j));
        if (!b) continue;
        for (let n = 0; n < b.length; n += 3) vis = Math.min(vis, clamp((Math.hypot(b[n]! - x, b[n + 1]! - y) - b[n + 2]! * 1.75) / 0.12));
      }
      r *= vis;
      if (r < 0.02) continue;
      out.push([x, y, r, tone]);
      if (hides) kept.push([x, y, r]);
    }
    for (const [x, y, r] of kept) {
      const k = key(Math.floor(x / cell), Math.floor(y / cell));
      let b = grid.get(k);
      if (!b) grid.set(k, (b = []));
      b.push(x, y, r);
    }
  }
  // The dirt swells where he comes up through it.
  for (let i = 0; i < 33; i++) out.push([(i + 0.5) * U, ROWS - 0.3, 0.42 * U * (1 + 0.22 * clamp(s.kick, -1, 1) * Math.exp(-(((i - 16) / 9) ** 2))), "dirt"]);
  return out;
}
