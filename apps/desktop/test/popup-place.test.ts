import { describe, expect, test } from "bun:test";
import { popupPlace } from "../src/popup-place";

const line = (top: number, left = 100, width = 500) => ({ top, bottom: top + 24, left, width });
const view = { top: 0, bottom: 800 };

describe("highlight popup place (D112)", () => {
  test("a downward drag opens it under the last line, at the pointer", () => {
    expect(popupPlace(line(300), line(356), view, 80, { x: 420, y: 368 })).toEqual({ y: 394, x: 420, below: true });
  });
  test("an upward drag opens it above the first line", () => {
    expect(popupPlace(line(300), line(356), view, 80, { x: 160, y: 312, up: true })).toEqual({ y: 286, x: 160, below: false });
  });
  test("no room under the passage: above it, never over it", () => {
    const at = popupPlace(line(640), line(720), view, 80, { x: 300, y: 732 });
    expect(at.below).toBe(false);
    expect(at.y).toBe(626);
  });
  test("an upward drag at the top of the view: under it", () => {
    expect(popupPlace(line(20), line(76), view, 80, { up: true }).below).toBe(true);
  });
  test("a passage taller than the view: just under the pointer", () => {
    expect(popupPlace(line(-200), line(900), view, 80, { x: 300, y: 400 })).toEqual({ y: 414, x: 300, below: true });
  });
  test("no pointer (keyboard, margin mark): centred under the last line", () => {
    expect(popupPlace(line(300), line(356, 100, 200), view, 80)).toEqual({ y: 394, x: 200, below: true });
  });
});
