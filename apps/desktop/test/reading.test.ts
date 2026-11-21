import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

const w = new Window();
for (const k of ["document", "HTMLElement", "Node", "localStorage"] as const) (globalThis as Record<string, unknown>)[k] = (w as unknown as Record<string, unknown>)[k];
const { DEFAULT_SIZE, placeOf, placeAt, toPlace, readingNow, setSpacing, SIZES, stepSize } = await import("../src/reading");

describe("reading page", () => {
  test("text size steps and holds at the ends", () => {
    expect(stepSize(DEFAULT_SIZE, 1)).toBe(18);
    expect(stepSize(18, 1)).toBe(20);
    expect(stepSize(DEFAULT_SIZE, -1)).toBe(16);
    expect(stepSize(SIZES[0], -1)).toBe(SIZES[0]);
    expect(stepSize(SIZES[SIZES.length - 1], 1)).toBe(SIZES[SIZES.length - 1]);
    expect(stepSize(19, 1)).toBe(DEFAULT_SIZE); // a stored value that is no longer a step
  });

  // Another test file may have loaded reading.ts on its own document first, so this reads the module's state.
  test("line spacing starts Normal and steps", () => {
    expect(readingNow().spacing).toBe("normal");
    setSpacing("loose");
    expect(readingNow().spacing).toBe("loose");
    setSpacing("normal");
  });

  test("a reflow keeps the paragraph at the top of the view where it was", () => {
    // Ten 100px paragraphs; scrolled so the view's top is 40% into the fourth.
    const scroll = document.createElement("div");
    const doc = document.createElement("article");
    scroll.append(doc);
    let line = 100;
    const ps = Array.from({ length: 10 }, (_, i) => {
      const p = document.createElement("p");
      p.getBoundingClientRect = () => ({ top: i * line - scroll.scrollTop, height: line }) as DOMRect;
      doc.append(p);
      return p;
    });
    scroll.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    let top = 340;
    Object.defineProperty(scroll, "scrollTop", { get: () => top, set: (v: number) => (top = v) });
    expect(ps.length).toBe(10);

    const restore = placeOf(scroll, doc);
    line = 150; // bigger text: every paragraph grows
    restore();
    expect(top).toBe(3 * 150 + 0.4 * 150);
  });

  // F444: the place was saved as a distance down the page, which pictures above it change as they
  // load (or don't: a picture far above stays unloaded). Saved as the passage at the top, it is the same passage again.
  test("a saved place is the block at the top and how far into it, and goes back there whatever the heights above it now are", () => {
    const scroll = document.createElement("div");
    const doc = document.createElement("div");
    scroll.append(doc);
    let picture = 400; // a picture above the place, loaded
    const tops = () => [0, picture, picture + 100, picture + 200];
    const els = ["img", "p", "p", "p"].map((tag, i) => {
      const el = document.createElement(tag);
      el.getBoundingClientRect = () => ({ top: tops()[i]! - scroll.scrollTop, height: i ? 100 : picture }) as DOMRect;
      doc.append(el);
      return el;
    });
    expect(els.length).toBe(4);
    scroll.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    let top = 525; // a quarter into the third block
    Object.defineProperty(scroll, "scrollTop", { get: () => top, set: (v: number) => (top = v) });
    const place = placeAt(scroll, doc);
    expect(place).toBe("2:0.25");
    picture = 0; // reopened: the picture has not loaded
    top = 0;
    expect(toPlace(scroll, doc, place!)).toBe(true);
    expect(top).toBe(125);
    // A place the text no longer has (reimported shorter), or nothing saved: left to the caller.
    expect(toPlace(scroll, doc, "9:0.5")).toBe(false);
    expect(toPlace(scroll, doc, "")).toBe(false);
  });
});
