import { describe, expect, test } from "bun:test";
import { dotsFor, grown } from "../src/HideDots";

describe("hide the source as dots (D204)", () => {
  test("a line becomes a row of dots its own length, on its midline", () => {
    const d = dotsFor({ x1: 100, x2: 400, y: 50, size: 18 });
    expect(d.every(([x, y]) => y === 50 && x > 100 && x < 400)).toBe(true);
    expect(d.at(-1)![0]).toBeGreaterThan(390); // reaches the line's end
    const short = dotsFor({ x1: 100, x2: 160, y: 50, size: 18 });
    expect(short.length).toBeLessThan(d.length / 3);
  });

  test("a heading's dots are bigger and wider apart than body text's", () => {
    const [h1, h2] = dotsFor({ x1: 0, x2: 300, y: 0, size: 32 });
    const [b1, b2] = dotsFor({ x1: 0, x2: 300, y: 0, size: 16 });
    expect(h1[2]).toBeGreaterThan(b1[2]);
    expect(h2[0] - h1[0]).toBeGreaterThan(b2[0] - b1[0]);
  });

  test("a picture is a sparse even field inside its box", () => {
    const d = dotsFor({ box: true, x1: 0, x2: 120, y: 0, y2: 60 });
    expect(d.length).toBe(10 * 5);
    expect(d.every(([x, y]) => x < 120 && y < 60)).toBe(true);
  });

  test("the sweep runs top to bottom: none before it starts, all once it ends", () => {
    expect(grown(0, 0, 800)).toBe(0);
    expect(grown(800, 1, 800)).toBe(1);
    expect(grown(100, 0.4, 800)).toBe(1);
    expect(grown(700, 0.4, 800)).toBe(0);
  });
});
