import { expect, test } from "bun:test";
import { COLS, HEAD, MOVES, REST, ROWS, advance, moleDots, puppet, start, type State } from "../src/Mole";

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
  expect(cells(d, "nose").map(([c]) => c)).toEqual([10, 11]);
  expect(cells(d, "eye")).toHaveLength(10);
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
