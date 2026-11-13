import { PARTS } from "./mole-fine-data";
import type { State } from "./Mole";

/* The mole, at every size (D251, D-new-one-mole): concept 4 itself, every dot traced from the drawing, so his dots sit where the
   drawing put them and not on a grid. He moves as a cut-out puppet on springs (`Mole.tsx`): the head
   (fur, face, helmet) rides up and down and leans, each lobe of the moustache swings from under his nose, the paws
   lift on their arms, and a dot under a part above it (fur under the helmet, a lid under an eye) shrinks away, so
   nothing shows through and nothing pops. Positions come out in a 22 by 18 space, the box the springs' values are written for. */

/** Greys run from 0, the page, to 9, the text colour: `fine-0` … `fine-9`. */
export type FineTone = `fine-${number}` | "eye" | "glint" | "nose" | "lamp" | "dirt";
export const FINE_ORDER: FineTone[] = ["dirt", ...Array.from({ length: 10 }, (_, i) => `fine-${i}` as const), "nose", "lamp", "eye", "glint"];
export type FineDot = [x: number, y: number, radius: number, tone: FineTone];

/** His box and the dome's top row at rest (`COLS`, `ROWS`, `REST.top` in Mole.tsx, which imports this file). */
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

type Layers = [x: number, y: number, r: number, tone: FineTone, hides: boolean][][];
/** The layers as dots, top layer first: each dot shrinks under any dot of a layer above it, and under `floor`. */
function settle(layers: Layers, floor: number): FineDot[] {
  // Top layer first: each dot is sized by the nearest dot above it, then joins what hides the layers below.
  const out: FineDot[] = [], cell = 0.75, grid = new Map<number, number[]>();
  const key = (cx: number, cy: number) => cx * 4096 + cy;
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
  return out;
}

const seg = (x: number, y: number, x1: number, y1: number, x2: number, y2: number, r: number) => {
  const dx = x2 - x1, dy = y2 - y1, t = clamp(((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy));
  return Math.hypot(x - x1 - dx * t, y - y1 - dy * t) - r;
};
const oval = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);

/** Asleep on his back, seen from the side (`s.side`): head to the left, belly up, lying along the foot of the box and
 *  about 12 rows out past each side of it. He is drawn standing in profile, facing right, in his own dots (x forward,
 *  y down from where the dirt would be), then laid back: the traced helmet tipped over his eyes, one lobe of the
 *  moustache draped on his chest, a paw behind his head, a belly like a hill and two feet with no legs. */
function sideDots(s: State): FineDot[] {
  const b = clamp(s.breath), layers: Layers = [], layer = () => { const l: Layers[number] = []; layers.push(l); return l; };
  const BED = -11.5, MIDDLE = 1;
  const lay = (x: number, y: number): [number, number] => [MID + (y - MIDDLE) * U, GROUND - 0.5 * U - (x - BED) * U + s.y];
  const put = (l: Layers[number], x: number, y: number, r: number, tone: FineTone) => { const [X, Y] = lay(x, y); l.push([X, Y, r, tone, true]); };
  const turn = (x: number, y: number, a: number, px: number, py: number): [number, number] => { const c = Math.cos(a), n = Math.sin(a); return [px + (x - px) * c - (y - py) * n, py + (x - px) * n + (y - py) * c]; };
  // His nose in the air and the lobe off it, lifting on each breath out.
  const face = layer(), NX = 13.6, NY = -8.2;
  for (const p of NOSE) put(face, NX + p.x / U, NY + p.y / U + 10, p.r, "nose");
  for (const p of SIDES[0]!.lobe) { const [x, y] = turn(p.x / U + 0.9 + 11.2, p.y / U + 10.4 - 6.6, 0.25 - s.puff * 0.3 - b * 0.12, 11.2, -6.6); put(face, x, y, p.r, p.tone); }
  // The helmet, tipped forward over his eyes; its lamp rides round to the front.
  const hat = layer(), TIP = 0.42;
  for (const p of HELMET) { const [x, y] = turn(p.x / U + 1.5, p.y / U, TIP, 0, -10); put(hat, x, y, p.r, p.tone); }
  for (const p of LAMP) { const [x, y] = turn(p.x / U + 7.5, p.y / U + 0.6, TIP, 0, -10); put(hat, x, y, p.r, p.tone); }
  // Mega stout (Tyler, 2026-11-13: "no legs just feet", "mega stout so it's funny"): his belly is a hill higher
  // than his nose, and two big flat feet stand on its far end like paddles, one behind the other, the near one bobbing (then "a bit
  // less fat and feet bigger and flat").
  const under = layer(), foot = clamp(s.legs) * 1.6;
  const TONES: FineTone[] = ["fine-9", "fine-7", "fine-9", "fine-5", "fine-5", "fine-5", "fine-5", "fine-7"], d = new Array<number>(8).fill(0);
  for (let j = -27; j <= 30; j++) for (let i = -14; i <= 28; i++) {
    const x = i + 0.07, y = j - 0.02;
    d[0] = seg(x, y, 0.5 + foot, 23.2, 10.5 + foot, 23.2, 2.7);                               // the near foot: big, flat, sole to the sky
    d[1] = oval(x, y, 10.6 + b * 1.1, 9, 6.6, 8.4);                                         // the pale of his belly
    d[2] = oval(x, y, -8, -18.5, 2.6, 3);                                                   // a paw behind his head
    d[3] = seg(x, y, -2.5, 1.5, -9, -14.5, 2.6);                                            // and its arm
    d[4] = oval(x, y, 10.6, -7.6, 3.6, 3.2);                                                // snout
    d[5] = oval(x, y, 0, -10, 11.2, 11);                                                    // head
    d[6] = oval(x, y, 2.8 + b * 0.5, 8.5, 14 + b * 0.9, 12.6);                              // the belly: a hill
    d[7] = seg(x, y, 4.5, 24.6, 14, 24.6, 2.5);                                             // the far foot, behind it and a little higher
    for (let n = 0; n < 8; n++) {
      let tone: FineTone | undefined;
      if (d[n]! < 0) tone = n === 6 && x < -5 ? "fine-4" : TONES[n];
      // A dark dot where a part ends over the one below it.
      else if (n !== 1 && n !== 4 && d[n]! < 0.8) for (let m = n + 1; m < 8; m++) if (d[m]! < -0.4) { tone = "fine-2"; break; }
      if (tone) { put(under, x, y, 0.4 * U, tone); break; }
    }
  }
  return settle(layers, Infinity);
}

/** Every dot of the fine mole in state `s`, in that space (x 0 to 22, the dirt along the foot of row 17).
 *  `s.whole` draws his whole body and no dirt (falling out of the cart): his feet reach 17 rows below the box.
 *  `s.side` draws him asleep in profile instead (`sideDots`). */
export function fineDots(s: State): FineDot[] {
  if (s.side > 0.5) return sideDots(s);
  const body = s.whole > 0.5;
  // The head rides his height and a hop (`top` above its rest is a hop, below it a squat), and leans from the ground up.
  // The pleased and startled poses lower `top` (written for a dome that flattened); he keeps his head, so that part is taken back out.
  const wide = clamp(s.tall), arc = clamp(s.arc), shutBoth = 1 - clamp(s.open);
  const rise = s.top - REST_TOP - 1.7 * wide - 0.9 * arc, sy = 1 - rise * 0.022, sx = 1 / sy;
  // A brow, cocked on the side he looks up to and both when he is startled, tips his helmet back to show.
  const brows = SIDES.map(({ side }) => Math.max(wide, clamp(side * s.lx) * clamp(-s.ly)));
  const tip = -(wide * 1.5 + Math.max(brows[0]!, brows[1]!) * (1 - wide) * 1.0 + s.hat);
  const frown = clamp(Math.abs(s.frown)), worry = s.frown < 0, tc = Math.cos(s.tilt), ts = Math.sin(s.tilt);
  // The helmet tips about the middle of its brim.
  const tilted = (p: P): P => { const dx = p.x, dy = p.y - BRIM; return { ...p, x: dx * tc - dy * ts, y: BRIM + dx * ts + dy * tc }; };
  const head = (p: P, dx = 0, dy = 0, lean = 1): [number, number] => {
    const up = clamp(p.y / CROWN) * lean;
    return [MID + (p.x + dx) * sx + s.hx * 0.8 * up, GROUND + (p.y + dy) * sy + s.y + rise];
  };
  // Layers from the top down: a dot shrinks under any dot of a layer above it.
  const layers: Layers = [];
  const layer = () => { const l: Layers[number] = []; layers.push(l); return l; };

  // Drawn marks sit over everything, each riding his head.
  const marks = layer();
  const mark = (x: number, y: number, r: number, tone: FineTone, lean = 1) => { if (r * U > 0.02) { const [X, Y] = head({ x: x * U, y: y * U, r: 0, tone }, 0, 0, lean); marks.push([X, Y, r * U, tone, true]); } };
  /** Nothing at 0 and from 0.9 on, whole between: a mark that travels shows only on its way. */
  const show = (v: number) => clamp(v * 7) * clamp((0.9 - v) * 7);
  const drop = (v: number, x0: number, y0: number, x1: number, y1: number) => {
    const k = show(v), x = x0 + (x1 - x0) * v, y = y0 + (y1 - y0) * v;
    mark(x, y, 0.6 * k, "glint"); mark(x - (x1 - x0) * 0.1, y - 0.85, 0.46 * k, "glint"); mark(x - (x1 - x0) * 0.2, y - 1.6, 0.28 * k, "glint");
  };
  const sparkle = (x: number, y: number, k: number, tone: FineTone = "glint") => {
    mark(x, y, 0.42 * k, tone);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { mark(x + dx * 0.85, y + dy * 0.85, 0.3 * k, tone); mark(x + dx * 1.55, y + dy * 1.55, 0.17 * k, tone); }
  };
  /** His eye as a star: bigger, its arms three dots long, a small dot in each corner. */
  const bigStar = (x: number, y: number, k: number) => {
    mark(x, y, 0.52 * k, "lamp");
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { mark(x + dx * 0.98, y + dy * 0.98, 0.46 * k, "lamp"); mark(x + dx * 1.85, y + dy * 1.85, 0.33 * k, "lamp"); mark(x + dx * 2.55, y + dy * 2.55, 0.19 * k, "lamp"); }
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) mark(x + dx * 0.8, y + dy * 0.8, 0.27 * k, "lamp");
  };
  drop(s.tear, -6.6, -10.4, -10.5, -4.6);
  drop(s.sweat, 9.8, -10.6, 10.6, -4.8);
  for (const side of [-1, 1]) {
    // Steam: three dots a side, out and up from under the brim, spreading as they go.
    const v = clamp(s.steam), k = show(v), x = side * (14 + 2.4 * v), y = -14.5 - 6.5 * v, w = 0.75 + 0.5 * v;
    for (const [dx, dy, r, tone] of [[0, 0, 0.56, "fine-8"], [1, -0.5, 0.5, "fine-7"], [-0.7, -0.8, 0.46, "fine-7"], [0.4, -1.4, 0.4, "fine-6"], [1.5, -1.5, 0.28, "fine-5"]] as const) mark(x + side * dx * w, y + dy * w, r * k, tone, 0.4);
  }
  // Two Zs, the second bigger and later, drifting up off his helmet.
  for (const [at, x0, y0, pitch] of [[0, 11.4, -22, 0.7], [0.28, 13.4, -25.6, 0.95]] as const) {
    const v = clamp((s.zzz - at) / (1 - at)), k = show(v);
    for (const [i, j] of [[0, 0], [1, 0], [2, 0], [3, 0], [2, 1], [1, 2], [0, 3], [1, 3], [2, 3], [3, 3]] as const) mark(x0 + i * pitch + v * 1.2, y0 + j * pitch - v * 2.6, pitch * 0.4 * k, "glint", 0.3);
  }
  for (const [at, x, y] of [[0, -14.2, -8.5], [0.25, 14.6, -11], [0.5, -12.6, -23.6]] as const) sparkle(x, y, show(clamp((s.spark - at) / 0.5)), "lamp");
  sparkle(14, -9.2, clamp(s.twinkle));
  // A "?" and a "!" over his helmet, as in a comic: each pops up whole and a little big, then settles.
  const glyph = (cells: readonly (readonly [number, number])[], k: number, x0: number) => { for (const [i, j] of cells) mark(x0 + i * 0.82, -28.6 + j * 0.82 + (1 - clamp(k)) * 1.5, 0.37 * clamp(k, 0, 1.08), "glint", 0.5); };
  glyph([[1, 0], [2, 0], [0, 0.9], [3, 0.9], [3, 1.9], [2.1, 2.8], [1.6, 3.8], [1.6, 5.5]], s.ask, 11.6);
  glyph([[0, 0], [0, 1], [0, 2], [0, 3], [0, 4.7]], s.bang, 13.2);
  const star = clamp(s.star, 0, 1.08), blush = clamp(s.blush);

  const paws = layer();
  if (!body) for (const { side, paw } of SIDES) {
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
      // Pleased, his cheeks push the lower lids up: the eyes stay open and bright, a little narrowed.
      const upper = p.y < top + U / 2, k = (upper ? 1 - shut : (1 - 0.25 * shut) * (1 - 0.3 * arc)) * (1 - clamp(star));
      const [x, y] = head(p, ex, ey);
      if (k > 0.02) face.push([x, y, p.r * k, "eye", true]);
      if (upper && wide * (1 - arc) > 0.02) { const [x2, y2] = head(p, ex, ey - U); face.push([x2, y2, p.r * wide * (1 - shut), "eye", true]); }
    }
    // The glint is what makes his eyes alive, so an open eye never loses it: it rides over the brim's shadow, slides
    // down the eye when the helmet comes low, grows when he is pleased, and goes only as the lid closes (Tyler,
    // 2026-11-13: without it he looks spooky; "the white dot should maybe only be gone if ... his eyes are closed").
    const [gx, gy] = head(glint, ex, ey - wide * U + clamp(tip, 0, 0.55));
    marks.push([gx, gy, glint.r * clamp((1 - shut) * 2.5) * (1 + 0.45 * arc) * (1 - clamp(star)), "glint", false]);
    if (star > 0.02) bigStar((cx + ex) / U, (top + U / 2 + ey) / U, star);
    if (blush > 0.02) for (const [dx, dy] of [[2.1, 1.9], [3.1, 1.9], [4.1, 1.9], [2.6, 2.75], [3.6, 2.75]] as const) mark(cx / U + side * dx, top / U + dy, 0.36 * blush, "nose");
    const brow = brows[n]!;
    if (brow > 0.02) for (let i = 0; i < 4; i++) {
      const [x, y] = head({ x: cx + (i - 1.5) * U, y: top - (1.45 + wide * 0.9 - Math.abs(i - 1.5 - side * 0.5) * 0.3 * (1 - wide)) * U, r: 0, tone: "glint" }, ex, ey);
      face.push([x, y, 0.34 * U * brow, "fine-9", true]);
    }
    // A frown: both brows low on his eyes, their inner ends down (worried: up).
    if (frown > 0.02) for (let i = 0; i < 4; i++) {
      const inner = (1.5 - side * (i - 1.5)) / 3;
      const [x, y] = head({ x: cx + (i - 1.5) * U, y: top - (worry ? 0.9 + 0.75 * inner : 0.85 - 0.75 * inner) * U, r: 0, tone: "glint" }, ex, ey);
      face.push([x, y, 0.36 * U * frown, "glint", true]);
    }
  }
  const fur = layer();
  // Whole, the shadows his paws cast on his chest go with the paws.
  for (const p of FUR) { const [x, y] = head(p); fur.push([x, y, p.r, body && p.y > -2.5 * U && p.tone < "fine-4" ? "fine-5" : p.tone, true]); }
  for (const p of GAP) { const [x, y] = head(p, fx, fy); fur.push([x, y, p.r, p.tone, true]); }

  if (body) {
    // Under his head, on the same pitch: belly, feet, legs, torso, then the arms behind it all. Units are his dots.
    const b = clamp(s.breath), k = clamp(s.arms), under = layer();
    const mixed = (a: number, c: number) => a + (c - a) * k;
    const TONES: FineTone[] = ["fine-7", "fine-9", "fine-4", "fine-5", "fine-9", "fine-4"], d = [0, 0, 0, 0, 0, 0];
    const ex = mixed(17.5, 16), ey2 = mixed(-7, -3), hx = mixed(11, 21), hy = mixed(-17, -11);
    for (let j = -21; j <= 26; j++) for (let i = -24; i <= 24; i++) {
      const x = i + 0.07, y = j - 0.02, ax = Math.abs(x);
      const kick = clamp((x < 0 ? -1 : 1) * s.legs) * 2.2, fy = 23 - kick, lx = 6.4 + kick * 0.5;
      d[0] = oval(ax, y, 0, 11, 7.6, 6.4 + b * 0.8);
      d[1] = oval(ax, y, lx + 1.6, fy, 3.5, 2.3);
      d[2] = seg(ax, y, 5, 16, lx, fy - 1.5, 2.9);
      d[3] = Math.min(oval(ax, y, 0, 11.5, 13 + b * 0.6, 8.6 + b * 0.5), oval(ax, y, 0, 5, 11.6, 7));
      d[4] = oval(ax, y, hx, hy, 3, 3);
      d[5] = Math.min(seg(ax, y, 9.5, 2.5, ex, ey2, 2.5), seg(ax, y, ex, ey2, hx, hy, 2.3));
      for (let n = 0; n < 6; n++) {
        let tone: FineTone | undefined;
        if (d[n]! < 0) tone = n === 3 && y > 16 ? "fine-4" : TONES[n];
        // A dark dot where a part ends over the one below it.
        else if (n && d[n]! < 0.8) for (let m = n + 1; m < 6; m++) if (d[m]! < -0.4) { tone = "fine-2"; break; }
        if (tone) { under.push([MID + x * U, GROUND + y * U + s.y, 0.4 * U, tone, true]); break; }
      }
    }
  }

  const out = settle(layers, body ? Infinity : GROUND - 0.28);
  // The dirt swells where he comes up through it.
  if (!body) for (let i = 0; i < 33; i++) out.push([(i + 0.5) * U, ROWS - 0.3, 0.42 * U * (1 + 0.22 * clamp(s.kick, -1, 1) * Math.exp(-(((i - 16) / 9) ** 2))), "dirt"]);
  return out;
}
