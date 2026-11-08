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

  test("check ends as the pixel check and read passes down every row", () => {
    expect(MATRIX.check[STILL.check]).toEqual(["....X", "....X", "X...X", ".X.X.", "..X.."]);
    expect(MATRIX.read.slice(0, 5).map((f) => f.findIndex((r) => r.includes("X")))).toEqual([0, 1, 2, 3, 4]);
  });
});
