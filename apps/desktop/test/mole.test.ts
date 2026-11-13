import { expect, test } from "bun:test";
import { FINE_FROM, MOVES, REST, SMALL_PX, advance, puppet, start, type State } from "../src/Mole";
import * as FINE from "../src/mole-fine";
import { fineDots } from "../src/mole-fine";
import { COLS, ROWS, smallDots } from "../src/mole-small";

// D-new-small-mole: under 48px the mole is drawn by hand on a 16-dot grid, whole dots of one size, and moves as a
// cut-out puppet on the springs of D214.
type Dots = ReturnType<typeof smallDots>;
const at = (s: Partial<State> = {}) => smallDots({ ...REST, ...s });
const of = (d: Dots, tone: string) => d.filter(([, , , t]) => t === tone);
const key = (d: Dots) => d.map(([x, y, r, t]) => `${x.toFixed(2)},${y.toFixed(2)},${r.toFixed(2)},${t}`).sort();
const DIRT = ROWS - 0.5;
/** A dot that is whole and on the grid: what keeps him sharp. */
const whole = (v: number) => Math.abs(v - 0.5 - Math.round(v - 0.5)) < 0.01;
const crisp = ([x, y, r, t]: Dots[number]) => whole(x) && whole(y) && (r === 0.44 || (t === "eye" && r === 0.56));

/** Plays a mood for `ms` at 60 Hz, frame by frame as the component does. */
function play(name: keyof typeof MOVES, ms: number) {
  const s = puppet(), frames: State[] = [];
  start(s, name, 0);
  for (let t = 1000 / 60; t <= ms; t += 1000 / 60) { advance(s, t, 1 / 60); frames.push({ ...s.v }); }
  return frames;
}
/** The moods the small mole is asked for: the tutor button, his chat, the Review moment. */
const USED = ["peek", "thinking", "happy", "surprised"] as const;

test("his dots land on whole Retina pixels: 16 across 40px", () => {
  expect((SMALL_PX / COLS) * 2).toBe(5);
  expect(FINE_FROM).toBeGreaterThan(SMALL_PX);
});

test("at rest, and held in each mood, every dot is whole and on the grid (no mush)", () => {
  expect(at().every(crisp)).toBe(true);
  expect(at({ open: 0 }).every(crisp)).toBe(true);
  expect(at({ lx: 1, hx: 0.45 }).every(crisp)).toBe(true);
  for (const name of USED) expect(at(MOVES[name].still).every(crisp)).toBe(true);
  // Thinking holds its look for two seconds a side: once the paw's tap is over he is sharp again.
  const think = play("thinking", 1900);
  expect(smallDots(think.at(-1)!).every(crisp)).toBe(true);
});

test("every frame of every move stays in his box, over one row of dirt", () => {
  for (const name of Object.keys(MOVES) as (keyof typeof MOVES)[])
    for (const s of play(name, 2 * (MOVES[name].end ?? MOVES[name].loop!))) {
      const d = smallDots(s);
      for (const [x, y, r, t] of d) {
        expect(Number.isFinite(x) && Number.isFinite(y) && r > 0 && r <= 0.56).toBe(true);
        // A lean carries the brim's ends a dot past his box.
        expect(x > -1.5 && x < COLS + 1.5).toBe(true);
        // Nothing of him shows under the dirt line.
        if (t !== "dirt") expect(y).toBeLessThan(DIRT);
      }
      expect(of(d, "dirt")).toHaveLength(COLS);
      expect(of(d, "dirt").every(([, y]) => y === DIRT)).toBe(true);
    }
});

test("at rest he is the old miner: mirror-symmetric, a lamp of four dots, two eyes with a glint each, a nose on the midline", () => {
  // The glints both sit top right (one light), so they count as eye here.
  // The helmet's dome is dented on one side, as in the drawing; from the brim down he mirrors.
  const d = at().filter(([, y]) => y > 4), shape = new Set(d.map(([x, y, , t]) => `${x},${y},${t === "glint" ? "eye" : t}`));
  for (const [x, y, , t] of d) expect(shape.has(`${COLS - x},${y},${t === "glint" ? "eye" : t}`)).toBe(true);
  expect(of(at(), "lamp").map(([x, y]) => [x, y])).toEqual([[7.5, 2.5], [8.5, 2.5], [7.5, 3.5], [8.5, 3.5]]);
  expect(of(d, "nose").map(([x]) => x)).toEqual([7.5, 8.5]);
  expect(of(d, "glint")).toHaveLength(2);
  expect(of(d, "eye")).toHaveLength(6);
  // His brim is the grid's whole width, and droops at both ends over eyes that sit under it.
  const white = of(d, "fine-9"), rowOf = (x: number) => white.filter((w) => w[0] === x).map(([, y]) => y);
  expect(rowOf(0.5)).toContain(6.5);
  expect(rowOf(COLS - 0.5)).toContain(6.5);
  expect(Math.min(...of(d, "eye").map(([, y]) => y))).toBeGreaterThan(5);
});

test("an open eye never loses its glint, in any frame of any move", () => {
  for (const name of Object.keys(MOVES) as (keyof typeof MOVES)[])
    for (const s of play(name, MOVES[name].end ?? MOVES[name].loop!)) {
      if (s.y > 1 || s.open < 0.35 || s.arc > 0.5) continue; // in his hole, shut, or pleased (arcs)
      expect(of(smallDots(s), "glint")).toHaveLength(2);
    }
});

test("a blink only touches the eyes, and a glance moves them a whole column", () => {
  const rest = at(), shut = at({ open: 0 });
  const body = (d: Dots) => d.filter(([, , , t]) => t !== "eye" && t !== "glint" && t !== "fine-5").map(([x, y]) => `${x},${y}`).sort();
  expect(body(shut)).toEqual(body(rest));
  expect(of(shut, "eye")).toHaveLength(4);
  expect(of(shut, "glint")).toHaveLength(0);
  expect(of(at({ lx: 1 }), "eye").map(([x, y]) => [x, y])).toEqual(of(rest, "eye").map(([x, y]) => [x + 1, y]));
});

test("pleased, his eyes are arcs and the moustache spreads wide; startled, the helmet jumps over wide eyes and an O", () => {
  const reach = (d: Dots) => Math.min(...of(d, "fine-9").filter(([, y]) => y > 8 && y < 11).map(([x]) => x));
  const happy = at(MOVES.happy.still), wide = at(MOVES.surprised.still);
  expect(of(happy, "glint")).toHaveLength(0);
  expect(of(happy, "eye")).toHaveLength(8);
  expect(reach(happy)).toBeLessThan(reach(at()));
  const lampTop = (d: Dots) => Math.min(...of(d, "lamp").map(([, y]) => y));
  expect(lampTop(wide)).toBe(lampTop(at()) - 2);
  // Eyes a row taller (five dots and a glint each), and four dots of mouth under the nose.
  expect(of(wide, "eye")).toHaveLength(10 + 4);
  expect(of(wide, "glint")).toHaveLength(2);
});

test("the helmet never comes down over his eyes, whatever the move", () => {
  for (const name of Object.keys(MOVES) as (keyof typeof MOVES)[])
    for (const s of play(name, MOVES[name].end ?? MOVES[name].loop!)) {
      if (s.y > 1) continue; // still coming up out of his hole
      // His eyes (the dots over his nose's row; the mouth is under it) are never shrunk by the helmet.
      const nose = Math.min(...of(smallDots(s), "nose").map(([, y]) => y));
      for (const [, y, r] of of(smallDots(s), "eye")) if (y <= nose) expect(r).toBe(0.56);
    }
});

test("sunk into its hole only the dirt is left, and a peek brings it up", () => {
  expect(at(MOVES.peek.from).every(([, , , t]) => t === "dirt")).toBe(true);
  expect(key(smallDots(play("peek", 3000).at(-1)!))).toEqual(key(at()));
});

test("a move plays, rests, and its springs settle so the frames can stop", () => {
  for (const name of ["happy", "surprised", "cheer"] as const) {
    const s = puppet();
    start(s, name, 0);
    const mid = MOVES[name].end! - 100;
    let t = 0, moving = true;
    for (; t < mid; t += 1000 / 60) advance(s, t, 1 / 60);
    // Before it rests it has reached its still pose.
    expect(key(smallDots(s.v))).toEqual(key(at(MOVES[name].still)));
    for (; moving && t < 20_000; t += 1000 / 60) moving = advance(s, t, 1 / 60);
    expect(moving).toBe(false);
    expect(s.mood).toBe("idle");
    expect(key(smallDots(s.v))).toEqual(key(at()));
  }
});

test("each mood's still pose (reduced motion, hidden window) shows the whole mole out of its hole", () => {
  for (const move of Object.values(MOVES)) {
    if (move.still.whole || move.still.side) continue; // drawn only by the traced mole
    const d = at(move.still);
    expect(of(d, "lamp")).toHaveLength(4);
    expect(of(d, "eye").length).toBeGreaterThan(0);
  }
});

test("a move is big enough to see: a squat, then a hop with both paws up; a tap as high", () => {
  // The springs count in rows of the 22-dot mole they were written on, 1.8px each.
  for (const name of ["happy", "cheer"] as const) {
    const frames = play(name, MOVES[name].end!), pose = { ...REST, ...MOVES[name].still }.top;
    const low = frames.findIndex((f) => f.top > REST.top + 1), high = frames.findIndex((f) => f.top < pose - 1.5);
    expect(low).toBeGreaterThanOrEqual(0);
    expect(high).toBeGreaterThan(low);
    expect(Math.max(...frames.map((f) => Math.min(f.pawL, f.pawR)))).toBeGreaterThan(1.5);
    // On screen: his lamp travels more than a dot (2.5px) up from where it rests.
    const lamp = (f: State) => Math.min(...of(smallDots(f), "lamp").map(([, y]) => y));
    expect(Math.min(...frames.map(lamp))).toBeLessThan(lamp({ ...REST }) - 1);
  }
  expect(Math.min(...play("surprised", 400).map((f) => f.top))).toBeLessThan(REST.top - 1);
  const think = play("thinking", 4000);
  expect(Math.max(...think.map((f) => f.pawR))).toBeGreaterThan(1.4);
  expect(Math.max(...think.map((f) => f.pawL))).toBeGreaterThan(1.4);
});

// D251: from 48px up he is concept 4 itself, traced dot by dot, moving as a cut-out puppet on the same springs.
const fine = (s: Partial<State> = {}) => fineDots({ ...REST, ...s });
const ink = (d: ReturnType<typeof fineDots>, tone?: string) => d.reduce((a, [, , r, t]) => a + (!tone || t === tone ? r * r : 0), 0);

test("the traced mole is drawn from 48px, in a 22 by 18 box, on the springs' own rest", () => {
  expect([FINE.COLS, FINE.ROWS, FINE.REST_TOP]).toEqual([22, 18, REST.top]);
  expect(FINE_FROM).toBe(48);
});

test("traced, at rest: every dot of the drawing, a lamp, a nose, two eyes with a glint each, over 33 dots of dirt", () => {
  const d = fine(), count = (t: string) => d.filter(([, , , x]) => x === t).length;
  expect(d.length).toBeGreaterThan(560);
  expect([count("lamp"), count("nose"), count("eye"), count("glint"), count("dirt")]).toEqual([8, 7, 8, 2, 33]);
  // He fits the small mole's box: across its width, and his helmet no more than a row over its top.
  for (const [x, y, r] of d) { expect(x - r).toBeGreaterThanOrEqual(-0.2); expect(x + r).toBeLessThanOrEqual(FINE.COLS + 0.2); expect(y - r).toBeGreaterThan(-1); }
});

test("traced: every frame of every move is whole, stays over the dirt, and no frame jumps", () => {
  for (const name of Object.keys(MOVES) as (keyof typeof MOVES)[]) {
    let before = -1;
    for (const s of play(name, 2 * (MOVES[name].end ?? MOVES[name].loop!))) {
      const d = fineDots(s);
      for (const [x, y, r, t] of d) {
        expect(Number.isFinite(x) && Number.isFinite(y) && r > 0 && r < 0.4).toBe(true);
        // Nothing of him shows under the dirt line (drawn whole, there is no dirt).
        if (t !== "dirt" && s.whole < 0.5 && s.side < 0.5) expect(y).toBeLessThan(FINE.ROWS - 0.5);
      }
      // A part never pops in or out: what is drawn changes by a small share from one frame to the next.
      const now = ink(d);
      if (before >= 0) expect(Math.abs(now - before)).toBeLessThan(7);
      before = now;
    }
  }
  // Every dot of every frame of 22 moves: the whole-body ones draw twice the dots.
}, 20_000);

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

// D253: fourteen more emotions on the same puppet, each a move that ends back at rest.
const EMOTIONS = ["nod", "shake", "wink", "laugh", "proud", "curious", "sad", "sleepy", "set", "shy", "wave", "huff", "anxious", "ecstatic"] as const;

test("traced: each emotion plays, differs from rest while it plays, and settles back to the rest drawing", () => {
  const sig = (d: ReturnType<typeof fineDots>) => d.map(([x, y, r, t]) => `${x.toFixed(1)},${y.toFixed(1)},${r.toFixed(2)},${t}`).sort().join(";");
  const rest = sig(fine()), seen = new Set<string>();
  for (const name of EMOTIONS) {
    const s = puppet();
    start(s, name, 0);
    let t = 0, moving = true, moved = false;
    for (; moving && t < 20_000; t += 1000 / 60) { moving = advance(s, t, 1 / 60); moved ||= sig(fineDots(s.v)) !== rest; }
    expect(moved).toBe(true);
    expect(moving).toBe(false);
    expect(s.mood).toBe("idle");
    for (const k of Object.keys(REST) as (keyof State)[]) expect(Math.abs(s.v[k] - REST[k])).toBeLessThan(0.02);
    // No two emotions hold the same pose.
    seen.add(sig(fine(MOVES[name].still)));
  }
  expect(seen.size).toBe(EMOTIONS.length);
});

test("traced: a wink shuts one eye, a frown draws two brows, the lamp flares, sad hangs the moustache in under a low helmet", () => {
  const glints = (d: ReturnType<typeof fineDots>) => d.filter(([, , , t]) => t === "glint").length;
  expect(glints(fine({ wink: 1 }))).toBe(1);
  expect(ink(fine({ wink: 1 }), "eye")).toBeGreaterThan(ink(fine({ open: 0 }), "eye"));
  expect(glints(fine({ frown: 1 }))).toBe(glints(fine()) + 8);
  expect(ink(fine({ lamp: 1 }), "lamp")).toBeGreaterThan(ink(fine(), "lamp") * 1.5);
  const top = (d: ReturnType<typeof fineDots>) => Math.min(...d.map(([, y]) => y));
  expect(top(fine(MOVES.sad.still))).toBeGreaterThan(top(fine()) + 0.5);
  expect(top(fine(MOVES.proud.still))).toBeLessThan(top(fine()) - 1);
});

test("traced: comic marks. A tear and a bead of sweat show only on their way down, stars take his eyes' place, a wave keeps his eyes' glints", () => {
  const white = (d: ReturnType<typeof fineDots>) => ink(d, "glint");
  for (const k of ["tear", "sweat", "zzz"] as const) {
    // Nothing at either end, so a move can put it back at its start unseen.
    expect(white(fine({ [k]: 0 }))).toBeCloseTo(white(fine()), 5);
    expect(white(fine({ [k]: 1 }))).toBeCloseTo(white(fine()), 5);
    expect(white(fine({ [k]: 0.5 }))).toBeGreaterThan(white(fine()) + 0.1);
  }
  // The tear falls: lower at 0.7 than at 0.3.
  const low = (d: ReturnType<typeof fineDots>) => Math.max(...d.filter(([, y, , t]) => t === "glint" && y < FINE.ROWS - 1).map(([, y]) => y));
  expect(low(fine({ tear: 0.7 }))).toBeGreaterThan(low(fine({ tear: 0.3 })) + 1);
  const stars = fine({ star: 1 });
  expect(ink(stars, "eye")).toBe(0);
  expect(ink(stars, "lamp")).toBeGreaterThan(ink(fine(), "lamp") * 1.5);
  expect(ink(fine({ blush: 1 }), "nose")).toBeGreaterThan(ink(fine(), "nose") * 1.5);
  expect(fine({ steam: 0.5 }).length).toBe(fine().length + 10);
});

test("traced: an open eye never loses its glint, in any frame of any move (Tyler, 2026-11-13: without it he looks spooky)", () => {
  const rest = fine(), eyes = ink(rest, "eye"), glint = Math.max(...rest.filter(([, , , t]) => t === "glint").map(([, , r]) => r));
  for (const name of Object.keys(MOVES) as (keyof typeof MOVES)[]) for (const s of play(name, MOVES[name].end ?? MOVES[name].loop!)) {
    // Only closed eyes lose it: star eyes and a wink have no open eye to light, and a lid mostly down takes its glint with it.
    if (s.star > 0.03 || s.wink > 0.03 || s.open < 0.75) continue;
    const d = fineDots(s);
    if (ink(d, "eye") < eyes * 0.6) continue;
    // Both glints at full size (the dirt may cover them while he is down in his hole).
    const whole = d.filter(([, y, r, t]) => t === "glint" && r > glint * 0.85 && y < FINE.ROWS - 1).length;
    if (s.y < 5) expect(whole).toBeGreaterThanOrEqual(2);
  }
  // A low helmet no longer covers it: sad, huff and the look down keep both.
  for (const pose of [MOVES.huff.still, MOVES.lookdown.still, { hat: -0.7 }]) expect(fine(pose).filter(([, , r, t]) => t === "glint" && r > glint * 0.9).length).toBeGreaterThanOrEqual(2);
});

test("a mark that travels is put back at its start only once it has passed out of sight", () => {
  // tear, sweat, steam, zzz and spark show nothing from 0.9 on; a `set` before that would make the mark vanish mid-air.
  for (const name of Object.keys(MOVES) as (keyof typeof MOVES)[]) {
    const m = MOVES[name], s = puppet(), sets = (m.at ?? []).filter(([, b]) => b.set);
    start(s, name, 0);
    for (let t = 0, i = 0; t < (m.end ?? m.loop!); t += 1000 / 60) {
      for (; i < sets.length && t + 1000 / 60 >= sets[i]![0]; i++) for (const k of Object.keys(sets[i]![1].set!) as (keyof State)[]) expect(s.v[k]).toBeGreaterThanOrEqual(0.9);
      advance(s, t, 1 / 60);
    }
  }
});

test("traced: out of the ground he has a whole body and no dirt; asleep his eyes are covered, falling they are wide", () => {
  const low = (d: ReturnType<typeof fineDots>) => Math.max(...d.map(([, y]) => y));
  const nap = fine(MOVES.nap.still), fall = fine(MOVES.fall.still);
  for (const d of [nap, fall]) {
    expect(d.some(([, , , t]) => t === "dirt")).toBe(false);
    // His feet, well under where the dirt would be.
    expect(low(d)).toBeGreaterThan(FINE.ROWS + 14);
  }
  expect(low(fine())).toBeLessThan(FINE.ROWS);
  expect(ink(nap, "glint")).toBe(0);
  expect(ink(fall, "glint")).toBeGreaterThan(0);
  // Asleep his paws are behind his head; falling they are flung out past it.
  const wide = (d: ReturnType<typeof fineDots>) => Math.max(...d.filter(([, , , t]) => t === "fine-9").map(([x]) => Math.abs(x - 11)));
  expect(wide(fall)).toBeGreaterThan(wide(nap) + 3);
  // His belly rises as he breathes in.
  expect(ink(fine({ ...MOVES.nap.still, breath: 1 }), "fine-7")).toBeGreaterThan(ink(nap, "fine-7"));
});

test("traced: asleep in profile he lies along the foot of the box, head to the left, and breathes", () => {
  const d = fine(MOVES.doze.still), xs = d.map(([x]) => x), ys = d.map(([, y]) => y);
  expect(d.some(([, , , t]) => t === "dirt" || t === "eye" || t === "glint")).toBe(false);
  // Longer than he is tall, and nothing under the bed.
  expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(30);
  expect(Math.max(...ys)).toBeLessThan(FINE.ROWS);
  expect(Math.min(...ys)).toBeGreaterThan(-7);
  // Stout (Tyler, 2026-11-13): his belly is a hill higher than his nose, and he has feet but no legs: the white of
  // his feet starts within five rows of his far end.
  const nose = Math.min(...d.filter(([, , , t]) => t === "nose").map(([, y]) => y));
  expect(Math.min(...ys)).toBeLessThan(nose - 1);
  const feet = d.filter(([x, , , t]) => t === "fine-9" && x > FINE.COLS / 2 + 13);
  expect(feet.length).toBeGreaterThan(40);
  expect(Math.max(...xs) - Math.min(...feet.map(([x]) => x))).toBeLessThan(5.5);
  // The lamp is at the head end, the feet at the other.
  const lamp = d.filter(([, , , t]) => t === "lamp").map(([x]) => x);
  expect(Math.max(...lamp)).toBeLessThan(FINE.COLS / 2 - 8);
  // Breathing in, his belly rises.
  const belly = (e: typeof d) => Math.min(...e.filter(([x]) => x > 13 && x < 17).map(([, y]) => y));
  expect(belly(fine({ ...MOVES.doze.still, breath: 1 }))).toBeLessThan(belly(d) - 0.3);
});

test("traced: no dot of the helmet is alone a shade whiter than the dots round it", () => {
  const top = fine().filter(([, y, , t]) => t === "fine-9" && y < 8);
  for (const [x, y] of top) expect(top.some(([a, b]) => (a !== x || b !== y) && Math.hypot(a - x, b - y) < 1)).toBe(true);
});
