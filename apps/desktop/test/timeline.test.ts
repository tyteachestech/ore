import { describe, expect, test } from "bun:test";
import { inWords, layout } from "../src/Timeline";

const DAY = 86_400_000;
const T0 = Date.parse("2026-10-01T12:00:00.000Z");
const at = (d: number) => new Date(T0 + d * DAY).toISOString();

describe("review timeline (D149)", () => {
  test("the first review sits at 0, the next due at 100, the rest at their time to scale", () => {
    const { dots, nextX } = layout([{ ts: at(0), rating: 3 }, { ts: at(2), rating: 1 }, { ts: at(5), rating: 3 }], at(10));
    expect(dots.map((d) => d.x)).toEqual([0, 20, 50]);
    expect(nextX).toBe(100);
    expect(dots.map((d) => d.rating)).toEqual([3, 1, 3]);
  });

  test("a next due before the last review (a lapse due in minutes) still draws inside the line", () => {
    const { dots, nextX } = layout([{ ts: at(0), rating: 3 }, { ts: at(4), rating: 1 }], new Date(T0 + 4 * DAY + 600_000).toISOString());
    expect(nextX).toBeGreaterThanOrEqual(dots.at(-1)!.x);
    expect(nextX).toBeLessThanOrEqual(100);
  });

  test("the line ends at the furthest rating's due, so a softer rating's dot sits short of the end", () => {
    const { nextX } = layout([{ ts: at(0), rating: 3 }], at(2), at(10));
    expect(nextX).toBe(20);
  });

  test("with no reviews the next due is the only dot, at the right", () => {
    expect(layout([], at(3))).toEqual({ dots: [], nextX: 100 });
  });

  test("the next review in words", () => {
    expect(inWords(at(0), T0)).toBe("later today");
    expect(inWords(at(1), T0)).toBe("tomorrow");
    expect(inWords(at(12), T0)).toBe("in 12 days");
    expect(inWords(at(95), T0)).toBe("in 3 months");
    expect(inWords(at(800), T0)).toBe("in 2 years");
  });

  test("one month and one year are said in the singular", () => {
    expect(inWords(at(35), T0)).toBe("in 1 month");
    expect(inWords(at(400), T0)).toBe("in 1 year");
  });
});

