import { describe, expect, test } from "bun:test";
import { MATRIX, STILL, type Stage } from "../src/Working";

// The dot matrix before a wait's label (D146): one frame list per stage, so what the AI is doing
// reads from the pattern, not only the words.
const stages = Object.keys(MATRIX) as Stage[];

describe("working matrix", () => {
  test("every frame is 5 rows of 5 cells, lit, dim or off", () => {
    for (const s of stages) for (const f of MATRIX[s]) {
      expect(f).toHaveLength(5);
      for (const row of f) expect(row).toMatch(/^[Xx.]{5}$/);
    }
  });

  test("every stage moves: at least three different frames", () => {
    for (const s of stages) expect(new Set(MATRIX[s].map((f) => f.join())).size).toBeGreaterThan(2);
  });

  test("each stage's still frame is its own and lights something", () => {
    const stills = stages.map((s) => MATRIX[s][STILL[s]]!.join());
    expect(new Set(stills).size).toBe(stages.length);
    for (const f of stills) expect(f).toContain("X");
  });

  const lit = (f: string[]) => f.flatMap((row, y) => [...row].flatMap((c, x) => (c === "X" ? [[x, y]] : [])));
  const edge = ([x, y]: number[]) => x === 0 || x === 4 || y === 0 || y === 4;

  test("work: two lit cells chase round the edge, never a corner", () => {
    for (const f of MATRIX.work) {
      const on = lit(f);
      expect(on).toHaveLength(2);
      for (const c of on) expect(edge(c) && !(c[0] !== 2 && c[1] !== 2 && (c[0] === 0 || c[0] === 4) && (c[1] === 0 || c[1] === 4))).toBe(true);
    }
  });

  test("search: an arm of three from the centre to the edge, in every direction", () => {
    const ends = new Set<string>();
    for (const f of MATRIX.search) {
      const on = lit(f);
      expect(on).toHaveLength(3);
      expect(on).toContainEqual([2, 2]);
      ends.add(on.filter(edge).map(String).join());
    }
    expect(ends.size).toBe(8);
  });

  test("write: the middle rows fill one cell at a time behind one dim cursor cell", () => {
    const counts = MATRIX.write.slice(0, 15).map((f) => lit(f).length);
    expect(counts).toEqual(Array.from({ length: 15 }, (_, i) => i));
    for (const f of MATRIX.write.slice(0, 15)) expect(f.join("").split("x")).toHaveLength(2);
    for (const f of MATRIX.write) expect(f[0]).toBe(".....");
  });

  test("check ends as the pixel check and read passes down every row", () => {
    expect(MATRIX.check[STILL.check]).toEqual(["....X", "....X", "X...X", ".X.X.", "..X.."]);
    expect(MATRIX.read.slice(0, 5).map((f) => f.findIndex((r) => r.includes("X")))).toEqual([0, 1, 2, 3, 4]);
  });
});
