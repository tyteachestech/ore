import { expect, test } from "bun:test";
import { COLS, MOVES, ROWS, moleGrid } from "../src/Mole";

// D169: every pose is one grid of dots, so the mole never leaves the grid while it moves.
const mask = (g: ReturnType<typeof moleGrid>) => g.map((r) => r.map((t) => (t ? "#" : ".")).join(""));
const cells = (g: ReturnType<typeof moleGrid>, tone: string) => g.flatMap((r, y) => r.flatMap((t, x) => (t === tone ? [[x, y]] : [])));

test("every pose of every move is a 22 by 18 grid over the same row of dirt", () => {
  for (const move of Object.values(MOVES))
    for (const [, pose] of move.keys) {
      const g = moleGrid(pose);
      expect(g).toHaveLength(ROWS);
      for (const r of g) expect(r).toHaveLength(COLS);
      expect(g[ROWS - 1]!.every((t) => t === "dirt")).toBe(true);
      expect(g.slice(0, -1).flat().includes("dirt")).toBe(false);
    }
});

test("at rest the silhouette is mirror-symmetric, with two eyes, two glints and a nose on the midline", () => {
  const g = moleGrid();
  for (const row of mask(g)) expect(row).toBe([...row].reverse().join(""));
  expect(cells(g, "glint")).toHaveLength(2);
  expect(cells(g, "nose").map(([x]) => x)).toEqual([10, 11]);
  // The glints both sit top right (one light), so the eyes are symmetric with them counted in.
  const eyes = [...cells(g, "eye"), ...cells(g, "glint")].map(([x]) => x!);
  expect(eyes.map((x) => COLS - 1 - x).sort((a, b) => a - b)).toEqual([...eyes].sort((a, b) => a - b));
});

test("a blink only touches the eyes, and a glance moves them a whole column", () => {
  const rest = moleGrid(), shut = moleGrid({ eyes: "shut" });
  expect(mask(shut)).toEqual(mask(rest));
  expect(cells(shut, "nose")).toEqual(cells(rest, "nose"));
  expect(cells(shut, "eye").length).toBeLessThan(cells(rest, "eye").length);
  const right = moleGrid({ lx: 1 });
  expect(cells(right, "eye")).toEqual(cells(rest, "eye").map(([x, y]) => [x! + 1, y!]));
});

test("sunk all the way into its hole, only the dirt is left", () => {
  const g = moleGrid(MOVES.peek.keys[0]![1]);
  expect(g.slice(0, -1).flat().every((t) => t === null)).toBe(true);
});
