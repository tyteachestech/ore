import { describe, expect, test } from "bun:test";
import { clampSide } from "../src/split";

// A dragged panel's width (D44): the note panel and the tutor up to 60% of the window, the sidebar
// between 180 and the smaller of 360 and 40% of the window.
describe("clampSide", () => {
  test("a right-hand panel stays between its min and 60% of the window", () => {
    expect(clampSide(100, 1280, { min: 280 })).toBe(280);
    expect(clampSide(500, 1280, { min: 280 })).toBe(500);
    expect(clampSide(1000, 1280, { min: 280 })).toBe(768);
  });

  test("the sidebar stops at 360, or at 40% of a narrow window", () => {
    const sidebar = { min: 180, share: 0.4, cap: 360 };
    expect(clampSide(120, 1280, sidebar)).toBe(180);
    expect(clampSide(250.4, 1280, sidebar)).toBe(250);
    expect(clampSide(900, 1280, sidebar)).toBe(360);
    expect(clampSide(360, 720, sidebar)).toBe(288);
  });

  test("a right-hand panel gives back what the sidebar takes past 216, so the reader keeps what it had (≥ 224 at 1100)", () => {
    const vw = 1100;
    const right = clampSide(2000, vw, { min: 280, less: 360 - 216 });
    expect(right).toBe(516);
    expect(vw - 360 - right).toBe(224);
    expect(clampSide(2000, vw, { min: 280, less: 0 })).toBe(660);
  });

  test("the min wins in a window too small for both", () => {
    expect(clampSide(300, 300, { min: 180, share: 0.4, cap: 360 })).toBe(180);
  });
});
