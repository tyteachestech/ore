import { describe, expect, test } from "bun:test";
import { lineShown, menuPlace } from "../src/popup-place";

// The caret's line box, where the menu opens: 20px tall at the given top.
const caret = (top: number, left = 200) => ({ left, top, bottom: top + 20 });
const view = { width: 1280, height: 900 };
const menu = { width: 320, height: 670 };

describe("menu at the caret stays inside the window (Notion's / menu)", () => {
  test("room below: just under the caret, as tall as it is", () => {
    expect(menuPlace(caret(100), menu, view)).toEqual({ left: 200, top: 124, maxHeight: 900 - 8 - 124, side: "below" });
  });
  test("no room below: above the caret, its bottom just over the line", () => {
    const at = menuPlace(caret(870), menu, view);
    expect(at.side).toBe("above");
    expect(at.top + menu.height).toBe(866);
    expect(at.top).toBeGreaterThanOrEqual(8);
  });
  test("neither side fits: the roomier side, height capped to the room so the list scrolls", () => {
    const short = { width: 1280, height: 500 };
    const low = menuPlace(caret(400), menu, short);
    expect(low).toEqual({ left: 200, top: 8, maxHeight: 400 - 4 - 8, side: "above" });
    const high = menuPlace(caret(60), menu, short);
    expect(high).toEqual({ left: 200, top: 84, maxHeight: 500 - 8 - 84, side: "below" });
  });
  test("never past the right edge, nor the left", () => {
    expect(menuPlace(caret(100, 1200), menu, view).left).toBe(1280 - 8 - 320);
    expect(menuPlace(caret(100, -40), menu, view).left).toBe(8);
  });
  test("a caret scrolled out of the window: the menu still fits inside it", () => {
    const short = { width: 1280, height: 420 };
    const at = menuPlace(caret(476), menu, short, "above");
    expect(at.top).toBeGreaterThanOrEqual(8);
    expect(at.top + Math.min(menu.height, at.maxHeight)).toBeLessThanOrEqual(420);
    expect(menuPlace(caret(-60), menu, short).top).toBeGreaterThanOrEqual(0);
  });
  test("as the list narrows it stays on the side it opened on while it fits there", () => {
    // Opened above at the bottom of the page; typing leaves three rows, which would fit below too.
    const small = { width: 320, height: 100 };
    expect(menuPlace(caret(700), small, view, "above")).toMatchObject({ side: "above", top: 700 - 4 - 100 });
    // Fresh, it goes under the caret.
    expect(menuPlace(caret(700), small, view).side).toBe("below");
    // The side it was on no longer fits (the window got short): it moves.
    expect(menuPlace(caret(60), small, view, "above").side).toBe("below");
  });
});

describe("the menu shows only while its line does", () => {
  const pane = { top: 60, bottom: 700 }; // the note's scrolling panel, inside the window
  test("a line inside the panel shows it", () => {
    expect(lineShown(caret(300), pane)).toBe(true);
  });
  test("a line scrolled above or below the panel hides it, even while it is still inside the window", () => {
    expect(lineShown(caret(20), pane)).toBe(false);
    expect(lineShown(caret(720), pane)).toBe(false);
  });
  test("a line cut in half by the panel's edge counts by its middle", () => {
    expect(lineShown(caret(45), pane)).toBe(false); // 45..65, middle 55: above the edge
    expect(lineShown(caret(55), pane)).toBe(true); // 55..75, middle 65
    expect(lineShown(caret(685), pane)).toBe(true); // middle 695
    expect(lineShown(caret(695), pane)).toBe(false);
  });
});
