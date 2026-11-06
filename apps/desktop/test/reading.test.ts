import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";

const w = new Window();
for (const k of ["document", "HTMLElement", "Node", "localStorage"] as const) (globalThis as Record<string, unknown>)[k] = (w as unknown as Record<string, unknown>)[k];
const { DEFAULT_SIZE, placeOf, SIZES, stepSize } = await import("../src/reading");

describe("reading page", () => {
  test("text size steps and holds at the ends", () => {
    expect(stepSize(DEFAULT_SIZE, 1)).toBe(18);
    expect(stepSize(18, 1)).toBe(20);
    expect(stepSize(DEFAULT_SIZE, -1)).toBe(16);
    expect(stepSize(SIZES[0], -1)).toBe(SIZES[0]);
    expect(stepSize(SIZES[SIZES.length - 1], 1)).toBe(SIZES[SIZES.length - 1]);
    expect(stepSize(19, 1)).toBe(DEFAULT_SIZE); // a stored value that is no longer a step
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
});
