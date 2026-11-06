import { describe, expect, test } from "bun:test";
import { placeQuick } from "../src/draw/quick";

// The diagram's quick style picker (S): by the pointer, inside the canvas, never over what it styles.
const size = { w: 200, h: 180 };
const area = { w: 1000, h: 700 };
const overlaps = (p: { left: number; top: number }, r: { x: number; y: number; w: number; h: number }) =>
  p.left < r.x + r.w && r.x < p.left + size.w && p.top < r.y + r.h && r.y < p.top + size.h;

describe("quick style placement", () => {
  test("up and to the right of the pointer when there is room", () => {
    expect(placeQuick({ x: 400, y: 400 }, null, size, area)).toMatchObject({ left: 416, top: 204, origin: "left bottom" });
  });
  test("flips left and down at the canvas's top-right corner, and stays inside", () => {
    const p = placeQuick({ x: 950, y: 30 }, null, size, area);
    expect(p.left + size.w).toBeLessThanOrEqual(area.w - 8);
    expect(p.top).toBeGreaterThanOrEqual(8);
    expect(p.origin).toBe("right top");
  });
  test("never covers the selection: goes beside it, at the pointer's height", () => {
    const sel = { x: 380, y: 250, w: 300, h: 200 }; // the pointer is inside a big selected box
    const p = placeQuick({ x: 420, y: 300 }, sel, size, area);
    expect(overlaps(p, sel)).toBe(false);
    expect(p.left).toBe(sel.x + sel.w + 16);
  });
  test("a selection as wide as the canvas: it goes under or over it", () => {
    const sel = { x: 20, y: 100, w: 960, h: 150 };
    const p = placeQuick({ x: 500, y: 200 }, sel, size, area);
    expect(overlaps(p, sel)).toBe(false);
  });
});
