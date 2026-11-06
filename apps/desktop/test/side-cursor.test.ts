import { describe, expect, test } from "bun:test";
import { hopFrames } from "../src/SideCursor";

describe("sidebar cursor hop", () => {
  test("lands on the row after one frame past it, on the 2 px grid", () => {
    const f = hopFrames(10, 110);
    expect(f.at(-1)).toBe(110);
    expect(f.at(-2)).toBe(114);
    expect(f.length).toBe(5);
    for (const v of f.slice(0, -2)) expect((v - 10) % 2).toBe(0);
  });
  test("overshoots upward when moving up", () => {
    const f = hopFrames(200, 40);
    expect(f.at(-2)).toBe(36);
    expect(f.at(-1)).toBe(40);
    expect(f.slice(0, -2).every((v, i, a) => v < 200 && (i === 0 || v <= a[i - 1]))).toBe(true);
  });
  test("no frames to play when it stays", () => expect(hopFrames(50, 50)).toEqual([50]));
});
