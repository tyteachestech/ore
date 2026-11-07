import { describe, expect, test } from "bun:test";
import { clampSize, HOME, MIN, sizeOf, withSize, zoomAt } from "../src/editor/board";

describe("diagram preview board", () => {
  test("the size lives in the alt text, and comes out again", () => {
    expect(sizeOf("Diagram")).toBeNull();
    expect(sizeOf("Diagram|640x320")).toEqual({ w: 640, h: 320 });
    expect(withSize("Diagram", { w: 640.4, h: 319.6 })).toBe("Diagram|640x320");
    expect(withSize("Diagram|640x320", { w: 500, h: 200 })).toBe("Diagram|500x200");
    expect(withSize("Diagram|640x320", null)).toBe("Diagram");
    expect(withSize("", null)).toBe("Diagram");
  });

  test("a size stays within the column and a usable minimum", () => {
    expect(clampSize({ w: 2000, h: 10 }, 600)).toEqual({ w: 600, h: MIN.h });
    expect(clampSize({ w: 20, h: 9000 }, 600)).toEqual({ w: MIN.w, h: 1600 });
  });

  test("zoom keeps the point under the pointer still", () => {
    const v = zoomAt(HOME, 2, 100, 50);
    // The point 100,50 from the drawing's corner is local 100,50; at 2× the corner moves back by as much.
    expect(v).toEqual({ x: -100, y: -50, z: 2 });
    // Again from there: the point is now 300-100 = 200 px from the moved corner (local 100 at 2×).
    const w = zoomAt(v, 4, 200, 100);
    expect(w).toEqual({ x: -300, y: -150, z: 4 });
    expect(zoomAt(HOME, 100, 0, 0).z).toBe(8);
    expect(zoomAt(HOME, 0.01, 0, 0).z).toBe(0.25);
  });
});
