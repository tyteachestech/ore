import { expect, test } from "bun:test";
import { COLS, FINE_FROM, HEAD, MOVES, REST, ROWS, advance, moleDots, puppet, start, type State } from "../src/Mole";
import * as FINE from "../src/mole-fine";
import { fineDots } from "../src/mole-fine";

// D214: the mole is a puppet, a smooth shape sampled onto the fixed dot grid. Its body glides (dot sizes change),
// its face stays whole dots.
const at = (s: Partial<State> = {}) => moleDots({ ...REST, ...s });
const cells = (d: ReturnType<typeof moleDots>, tone: string) => d.flatMap(([c, r, , t]) => (t === tone ? [[c, r]] : []));
const key = (d: ReturnType<typeof moleDots>) => d.map(([c, r, rad, t]) => `${c},${r},${rad.toFixed(2)},${t}`).sort();

/** Plays a mood for `ms` at 60 Hz, frame by frame as the component does. */
function play(name: keyof typeof MOVES, ms: number) {
  const s = puppet(), frames: State[] = [];
  start(s, name, 0);
  for (let t = 1000 / 60; t <= ms; t += 1000 / 60) { advance(s, t, 1 / 60); frames.push({ ...s.v }); }
  return frames;
}

test("every frame of every move stays on the grid, over one row of dirt", () => {
  for (const name of Object.keys(MOVES) as (keyof typeof MOVES)[])
    for (const s of play(name, 2 * (MOVES[name].end ?? MOVES[name].loop!))) {
      const d = moleDots(s);
      for (const [c, r, rad] of d) {
        expect(Number.isInteger(c) && Number.isInteger(r)).toBe(true);
        expect(c >= 0 && c < COLS && r >= -HEAD && r < ROWS).toBe(true);
        expect(rad).toBeLessThanOrEqual(0.56);
      }
      expect(cells(d, "dirt")).toHaveLength(COLS);
      expect(cells(d, "dirt").every(([, r]) => r === ROWS - 1)).toBe(true);
    }
});

test("at rest it is mirror-symmetric, with two eyes, two glints and a nose on the midline", () => {
  // The glints both sit top right (one light), so they count as eye here.
  const d = at(), size = ([, , rad, t]: (typeof d)[number]) => (t === "glint" ? 0.56 : rad).toFixed(3);
  const shape = new Set(d.map((dot) => `${dot[0]},${dot[1]},${size(dot)}`));
  for (const dot of d) expect(shape.has(`${COLS - 1 - dot[0]},${dot[1]},${size(dot)}`)).toBe(true);
  expect(cells(d, "glint")).toHaveLength(2);
  expect(cells(d, "nose").map(([c]) => c)).toEqual([9, 10, 11, 12, 10, 11]);
  expect(cells(d, "eye")).toHaveLength(6);
});

// D238: the old miner. A helmet with a lit lamp, a brim the grid's whole width, a moustache in two long lobes.
test("he wears a helmet: a lamp of four dots on the midline, over a brim that spans the grid", () => {
  const d = at();
  expect(cells(d, "lamp")).toEqual([[10, 1], [11, 1], [10, 2], [11, 2]]);
  expect(cells(d, "brim").map(([c]) => c)).toEqual(Array.from({ length: COLS }, (_, c) => c));
  expect(new Set(cells(d, "brim").map(([, r]) => r))).toEqual(new Set([5]));
  // The eyes sit under the brim, never behind it.
  expect(Math.min(...cells(d, "eye").map(([, r]) => r!))).toBeGreaterThan(5);
});

test("his moustache hangs in two lobes to the dirt, and spreads wide when he is pleased", () => {
  const rows = (d: ReturnType<typeof moleDots>) => cells(d, "stache").map(([, r]) => r!);
  const hang = at(), wide = at(MOVES.happy.still);
  expect(Math.max(...rows(hang))).toBe(ROWS - 2);
  // Parted under the nose: nothing on the two middle columns below the lobes' join.
  expect(cells(hang, "stache").filter(([c, r]) => (c === 10 || c === 11) && r! > 11)).toHaveLength(0);
  expect(Math.max(...rows(wide))).toBeLessThan(14);
  const reach = (d: ReturnType<typeof moleDots>) => Math.min(...cells(d, "stache").map(([c]) => c!));
  expect(reach(wide)).toBeLessThan(reach(hang));
});

test("startled, his helmet jumps and both brows show; thinking cocks the one on the side he looks to", () => {
  const brimRow = (d: ReturnType<typeof moleDots>) => Math.min(...cells(d, "brim").map(([, r]) => r!));
  const wide = at(MOVES.surprised.still);
  expect(brimRow(wide)).toBeLessThan(brimRow(at()));
  expect(cells(wide, "brow")).toHaveLength(8);
  expect(cells(at(), "brow")).toHaveLength(0);
  const think = cells(at(MOVES.thinking.still), "brow");
  expect(think).toHaveLength(4);
  expect(think.every(([c]) => c! > COLS / 2)).toBe(true);
  // The brow sits over the eye, never on it: both eyes keep their four dots (three and a glint) as he looks up.
  const up = at(MOVES.thinking.still);
  expect(cells(up, "eye").length + cells(up, "glint").length).toBe(8);
});

test("the helmet never comes down over his eyes, whatever the move", () => {
  for (const name of Object.keys(MOVES) as (keyof typeof MOVES)[])
    for (const s of play(name, MOVES[name].end ?? MOVES[name].loop!)) {
      if (s.y > 1) continue; // still coming up out of his hole
      expect(cells(moleDots(s), "eye").length).toBeGreaterThanOrEqual(4);
    }
});

test("the face is whole dots: eyes, glints and nose are full size wherever the body glides", () => {
  for (const s of play("thinking", 4000)) for (const [, , rad, t] of moleDots(s)) {
    if (t === "eye") expect(rad).toBe(0.56);
    if (t === "glint" || t === "nose") expect(rad).toBe(0.44);
  }
});

test("a blink only touches the eyes, and a glance moves them a whole column", () => {
  const rest = at(), shut = at({ open: 0 });
  const body = (d: ReturnType<typeof moleDots>) => d.map(([c, r]) => `${c},${r}`).sort();
  expect(body(shut)).toEqual(body(rest));
  expect(cells(shut, "nose")).toEqual(cells(rest, "nose"));
  expect(cells(shut, "eye").length).toBeLessThan(cells(rest, "eye").length);
  expect(cells(at({ lx: 1 }), "eye")).toEqual(cells(rest, "eye").map(([c, r]) => [c! + 1, r!]));
});

test("sunk into its hole only the dirt is left, and a peek brings it up", () => {
  expect(at(MOVES.peek.from).every(([, r, , t]) => t === "dirt" || r === ROWS - 1)).toBe(true);
  const frames = play("peek", 3000);
  expect(key(moleDots(frames.at(-1)!))).toEqual(key(at()));
});

test("surprised opens an O under the nose; happy and cheer close their eyes to arcs", () => {
  const wide = at(MOVES.surprised.still);
  const nose = cells(wide, "nose"), mouth = cells(wide, "eye").filter(([, r]) => r! > Math.max(...nose.map(([, y]) => y!)));
  expect(mouth).toHaveLength(4);
  expect(cells(at(MOVES.happy.still), "glint")).toHaveLength(0);
});

test("a move plays, rests, and its springs settle so the frames can stop", () => {
  for (const name of ["happy", "surprised", "cheer"] as const) {
    const s = puppet();
    start(s, name, 0);
    const mid = MOVES[name].end! - 100;
    let t = 0, moving = true;
    for (; t < mid; t += 1000 / 60) advance(s, t, 1 / 60);
    // Before it rests it has reached its still pose.
    expect(key(moleDots(s.v))).toEqual(key(at(MOVES[name].still)));
    for (; moving && t < 20_000; t += 1000 / 60) moving = advance(s, t, 1 / 60);
    expect(moving).toBe(false);
    expect(s.mood).toBe("idle");
    expect(key(moleDots(s.v))).toEqual(key(at()));
  }
});

test("each mood's still pose (reduced motion, hidden window) shows the whole mole out of its hole", () => {
  for (const move of Object.values(MOVES)) {
    const d = at(move.still);
    expect(cells(d, "paw").some(([, r]) => r === ROWS - 2)).toBe(true);
    expect(cells(d, "eye").length).toBeGreaterThan(0);
  }
});

test("a move is big enough to see at button size: a squat, then a hop of a row and a half; a tap as high", () => {
  // A dot is 1.6 to 1.8px in the chat and the button, so less than a row and a half of travel is lost.
  for (const name of ["happy", "cheer"] as const) {
    const frames = play(name, MOVES[name].end!), pose = { ...REST, ...MOVES[name].still }.top;
    const low = frames.findIndex((f) => f.top > REST.top + 1), high = frames.findIndex((f) => f.top < pose - 1.5);
    expect(low).toBeGreaterThanOrEqual(0);
    expect(high).toBeGreaterThan(low);
    // Both paws go up with it, and never past the room above the grid.
    expect(Math.max(...frames.map((f) => Math.min(f.pawL, f.pawR)))).toBeGreaterThan(1.5);
    expect(Math.min(...frames.map((f) => f.top))).toBeGreaterThan(-HEAD);
  }
  expect(Math.min(...play("surprised", 400).map((f) => f.top))).toBeLessThan(REST.top - 1);
  const think = play("thinking", 4000);
  expect(Math.max(...think.map((f) => f.pawR))).toBeGreaterThan(1.4);
  expect(Math.max(...think.map((f) => f.pawL))).toBeGreaterThan(1.4);
});

test("stretched tall the head is narrower than at rest, squashed it is wider", () => {
  // How much of row 9 the head covers: the sum of its dots' sizes.
  const width = (s: Partial<State>) => at(s).reduce((n, [, r, rad, t]) => (r === 9 && t !== "paw" ? n + rad : n), 0);
  expect(width({ top: -2 })).toBeLessThan(width({}));
  expect(width({ top: 1.7, rx: 9 })).toBeGreaterThan(width({ rx: 9 }));
});

// D-new-traced-mole: from 48px up he is concept 4 itself, traced dot by dot, moving as a cut-out puppet on the same springs.
const fine = (s: Partial<State> = {}) => fineDots({ ...REST, ...s });
const ink = (d: ReturnType<typeof fineDots>, tone?: string) => d.reduce((a, [, , r, t]) => a + (!tone || t === tone ? r * r : 0), 0);

test("the traced mole shares the small one's box", () => {
  expect([FINE.COLS, FINE.ROWS, FINE.REST_TOP]).toEqual([COLS, ROWS, REST.top]);
  expect(FINE_FROM).toBe(48);
});

test("traced, at rest: every dot of the drawing, a lamp, a nose, two eyes with a glint each, over 33 dots of dirt", () => {
  const d = fine(), count = (t: string) => d.filter(([, , , x]) => x === t).length;
  expect(d.length).toBeGreaterThan(560);
  expect([count("lamp"), count("nose"), count("eye"), count("glint"), count("dirt")]).toEqual([8, 7, 8, 2, 33]);
  // He fits the small mole's box: across its width, and his helmet no more than a row over its top.
  for (const [x, y, r] of d) { expect(x - r).toBeGreaterThanOrEqual(-0.2); expect(x + r).toBeLessThanOrEqual(COLS + 0.2); expect(y - r).toBeGreaterThan(-1); }
});

test("traced: every frame of every move is whole, stays over the dirt, and no frame jumps", () => {
  for (const name of Object.keys(MOVES) as (keyof typeof MOVES)[]) {
    let before = -1;
    for (const s of play(name, 2 * (MOVES[name].end ?? MOVES[name].loop!))) {
      const d = fineDots(s);
      for (const [x, y, r, t] of d) {
        expect(Number.isFinite(x) && Number.isFinite(y) && r > 0 && r < 0.4).toBe(true);
        // Nothing of him shows under the dirt line.
        if (t !== "dirt") expect(y).toBeLessThan(ROWS - 0.5);
      }
      // A part never pops in or out: what is drawn changes by a small share from one frame to the next.
      const now = ink(d);
      if (before >= 0) expect(Math.abs(now - before)).toBeLessThan(7);
      before = now;
    }
  }
});

test("traced: a blink shuts his eyes to a line, pleased swings the lobes wide, startled lifts the helmet off his brows", () => {
  expect(ink(fine({ open: 0 }), "eye")).toBeLessThan(ink(fine(), "eye") * 0.5);
  expect(fine({ open: 0 }).some(([, , , t]) => t === "glint")).toBe(false);
  const white = (d: ReturnType<typeof fineDots>) => d.filter(([, y, , t]) => t === "fine-9" && y > 8 && y < 14.5).map(([x]) => x);
  expect(Math.min(...white(fine(MOVES.happy.still)))).toBeLessThan(Math.min(...white(fine())) - 1);
  const top = (d: ReturnType<typeof fineDots>) => Math.min(...d.map(([, y]) => y));
  expect(top(fine(MOVES.surprised.still))).toBeLessThan(top(fine()) - 0.8);
  // A look to a side alone raises no brow; thinking (up and to a side) cocks one.
  expect(fine({ lx: 1 }).length).toBeLessThan(fine({ lx: 1, ly: -1 }).length);
});

test("traced: nothing shows through a part above it (fur under the helmet, a lid under an open eye)", () => {
  const d = fine();
  const over = d.filter(([, , , t]) => t === "eye");
  for (const [x, y, r, t] of d) if (t.startsWith("fine-")) for (const [ex, ey, er] of over) expect(Math.hypot(x - ex, y - ey)).toBeGreaterThan(Math.min(r, er));
});
