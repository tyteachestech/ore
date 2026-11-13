import type { State } from "./Mole";
import { REST_TOP, type FineDot, type FineTone } from "./mole-fine";

/* The mole under 48 px (D-new-small-mole): the tutor button, his chat, the Review moment. The traced mole's dots would
   be near 1 px there, so this one is drawn by hand for 40 px: 16 dots across, the grid the icons use, each dot 2.5 px,
   which is five whole pixels on a Retina screen. It keeps what makes him the same old miner: the dented helmet, its
   lamp and drooping brim, black eyes with a glint, the pink nose, the moustache in two slanted lobes, two paws.
   Every dot is whole and one size, so nothing blurs. He moves as a cut-out puppet on the springs both moles share:
   head and helmet ride up and down together, the helmet jumps, paws lift, and the face changes a whole dot at a
   time. At rest every part sits on the grid. */
export const COLS = 16, ROWS = 14;
const DIRT = ROWS - 1;
/** A row of the springs' space (they were written on a 22-dot mole) in his dots: the same travel on screen. */
const K = COLS / 22;

const TONE: Record<string, FineTone> = { h: "fine-7", H: "fine-8", s: "fine-5", k: "fine-2", L: "lamp", b: "fine-9", f: "fine-5", d: "fine-3", W: "fine-9", m: "fine-4", P: "fine-9" };
type Cell = [c: number, r: number, tone: FineTone];
/** A drawing: one character a dot, `.` for none, its first line row `top`. */
const cells = (top: number, art: string): Cell[] =>
  art.trim().split("\n").flatMap((line, r) => [...line.trim()].flatMap((ch, c): Cell[] => (ch === "." ? [] : [[c, top + r, TONE[ch]!]])));

const HAT = cells(0, `
  .....hhhh.hh....
  ...hHHhhhhhhh...
  ..hHHhkLLkhhhs..
  ..hhhhkLLkhhhs..
  .bbbbbbbbbbbbbb.
  bbb..........bbb
  b..............b`);
/** His fur, shaded under the brim; its last rows carry on under the dirt, for when he hops. */
const FUR = cells(4, `
  ...dddddddddd...
  ...dddddddddd...
  ..ffffffffffff..
  ..ffffffffffff..
  ..ffffffffffff..
  ..ffffffffffff..
  ..ffffffffffff..
  ...ffffffffff...
  ....ffffffff....
  ....ffffffff....
  ....ffffffff....
  ....ffffffff....`);
const HANG = cells(8, `
  .....WWWWWW.....
  ....WWWmmWWW....
  ...WWWm..mWWW...
  ...WWW....WWW...
  ....WW....WW....`);
const SPREAD = cells(8, `
  ....WWWWWWWW....
  ..WWWWWmmWWWWW..
  ..WWWm....mWWW..
  ...W........W...`);
/** A paw, and under the dirt the arm that shows when he lifts it. */
const PAW = cells(11, `
  PP..............
  PPP.............
  PPP.............
  PPP.............
  PPP.............`);
/** Row of his eyes' tops, each eye's left column (they are two dots wide), and the nose's row. */
const EYE_ROW = 6, EYES = [3, 11], NOSE_ROW = 7, MID = COLS / 2 - 1;

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
type Layer = [x: number, y: number, r: number, tone: FineTone][];

/** Every dot of the small mole in state `s`: centres in his own 16 by 14 space, the dirt along row 13. */
export function smallDots(s: State): FineDot[] {
  const wide = s.tall > 0.5, arc = s.arc > 0.5;
  // The springs flatten the old mole's dome when he is pleased or startled; he keeps his head, so that is taken out.
  // Rounded to a thousandth of a dot, so a pose that adds up to rest is exactly rest.
  const sink = s.y * K, rise = Math.round((s.top - REST_TOP - 1.7 * clamp(s.tall) - 0.9 * clamp(s.arc)) * K * 1000) / 1000;
  // A lean is a whole dot, so he never rests between two.
  const hx = Math.round(s.hx * 0.8), hy = sink + rise;
  // The helmet jumps clear of his brows when he is startled, and never comes down over his eyes.
  const hatY = hy - clamp(s.tall) * 2 - Math.max(0, s.hat) * K;
  const at = (list: Cell[], dx: number, dy: number, r = 0.44): Layer => list.map(([c, row, tone]) => [c + 0.5 + dx, row + 0.5 + dy, r, tone]);
  const mirror = (list: Cell[]): Cell[] => list.map(([c, r, t]) => [COLS - 1 - c, r, t]);

  // The face: whole dots that swap, a column at a time.
  const look = Math.round(s.lx * 0.65), face: Cell[] = [], eyes: Cell[] = [];
  for (const c of EYES.map((e) => e + look)) {
    if (arc) eyes.push([c - 1, EYE_ROW + 1, "eye"], [c, EYE_ROW, "eye"], [c + 1, EYE_ROW, "eye"], [c + 2, EYE_ROW + 1, "eye"]);
    else if (s.open < 0.35) eyes.push([c, EYE_ROW + 1, "eye"], [c + 1, EYE_ROW + 1, "eye"]);
    else {
      const top = wide ? EYE_ROW - 1 : EYE_ROW;
      // One glint, top right of each eye: an open eye always has it.
      for (let r = top; r <= EYE_ROW + 1; r++) {
        eyes.push([c, r, "eye"]);
        if (r === top) face.push([c + 1, r, "glint"]);
        else eyes.push([c + 1, r, "eye"]);
      }
      if (wide) for (let i = -1; i <= 2; i++) face.push([c + i, top - 1, "fine-9"]);
    }
  }
  face.push([MID, NOSE_ROW, "nose"], [MID + 1, NOSE_ROW, "nose"]);
  // The mouth, between the lobes: an o, then an O.
  if (s.mouth > 0.25) face.push([MID, NOSE_ROW + 2, "eye"], [MID + 1, NOSE_ROW + 2, "eye"]);
  if (s.mouth > 0.7) face.push([MID, NOSE_ROW + 3, "eye"], [MID + 1, NOSE_ROW + 3, "eye"]);

  // Top layer first: a dot shrinks away under a dot of a layer above it, and under the dirt.
  const layers: Layer[] = [
    [...at(PAW, 0, sink - s.pawL * K), ...at(mirror(PAW), 0, sink - s.pawR * K)],
    at(HAT, hx, hatY),
    [...at(face, hx, hy), ...at(eyes, hx, hy, 0.56)],
    at(arc ? SPREAD : HANG, hx, hy),
    at(FUR, hx, hy),
  ];
  const out: FineDot[] = [], above: Layer = [];
  for (const layer of layers) {
    const kept: Layer = [];
    for (const [x, y, r0, tone] of layer) {
      let k = clamp((DIRT - y) / 0.5 + 0.1);
      for (let i = 0; i < above.length && k > 0; i++) k = Math.min(k, clamp((Math.hypot(above[i]![0] - x, above[i]![1] - y) - 0.45) / 0.5));
      if (k * r0 < 0.03) continue;
      out.push([x, y, r0 * k, tone]);
      kept.push([x, y, r0, tone]);
    }
    above.push(...kept);
  }
  // The dirt swells where he comes up through it.
  for (let c = 0; c < COLS; c++) out.push([c + 0.5, DIRT + 0.5, 0.44 * (1 + 0.22 * clamp(s.kick, -1, 1) * Math.exp(-(((c - 7.5) / 4.4) ** 2))), "dirt"]);
  return out;
}
