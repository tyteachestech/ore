import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Gem } from "../src/Gem";
import { DotBar, DotRing, lit } from "../src/Ring";

// D183: one way of drawing. Gems, rings and icons are round dots; no square pixel is left beside them.

test("any progress lights one dot, and only a whole share lights them all", () => {
  expect(lit(0, 14)).toBe(0);
  expect(lit(0.01, 14)).toBe(1);
  expect(lit(0.5, 14)).toBe(7);
  expect(lit(0.99, 14)).toBe(13);
  expect(lit(1, 14)).toBe(14);
});

test("a ring shows its lit dots, then today's dimmer ones, then the track", () => {
  const html = renderToStaticMarkup(<DotRing size={56} share={0.25} ghost={0.1} />);
  expect(html.match(/<circle/g)?.length).toBe(20);
  expect(html.match(/class="on"/g)?.length).toBe(5);
  expect(html.match(/class="soon"/g)?.length).toBe(2);
});

test("a bar is whole dots: a sliver of progress lights one, and no dot is ever cut (D184)", () => {
  const bar = (share: number) => renderToStaticMarkup(<DotBar className="home-meter small" share={share} n={10} />);
  expect(bar(0.02).match(/<i/g)?.length).toBe(10);
  expect(bar(0.02).match(/class="on"/g)?.length).toBe(1);
  expect(bar(0.5).match(/class="on"/g)?.length).toBe(5);
  expect(bar(0).includes('class="on"')).toBe(false);
  expect(bar(0.5)).not.toContain("width");
});

test("a gem is loose dots until it is cut, then solid pixels, and no state glows (D236)", () => {
  for (const size of [16, 36]) {
    const draw = (kind: Parameters<typeof Gem>[0]["kind"], more = {}) => renderToStaticMarkup(<Gem kind={kind} size={size} {...more} />);
    const count = (html: string, tag: string) => html.match(new RegExp(`<${tag}`, "g"))?.length ?? 0;
    for (const kind of ["rough", "empty"] as const) {
      expect(count(draw(kind), "circle")).toBeGreaterThan(0);
      expect(draw(kind)).not.toContain("<rect");
    }
    // Nearly cut: every cell a swollen dot, a rounded square that has not yet filled its cell.
    expect(draw("ready")).not.toContain("<circle");
    expect(draw("ready")).toMatch(/<rect[^>]* rx="0\.[0-9]+/);
    // Cut: every cell a full square.
    expect(draw("cut")).not.toContain("<circle");
    expect(draw("cut")).not.toMatch(/rx="0\.[0-9]/);
    expect(count(draw("ready"), "rect")).toBe(count(draw("cut"), "rect"));
    // A crack is a line of missing cells; mended, gold fills it; polished adds the sparkle and no white block.
    expect(count(draw("dull"), "rect")).toBeLessThan(count(draw("cut"), "rect"));
    expect(count(draw("cut", { seam: true }), "rect")).toBe(count(draw("cut"), "rect"));
    expect(draw("cut", { seam: true })).toContain("var(--seam)");
    expect(draw("cut", { polished: true })).toContain("gem-sparkle");
    expect(draw("cut")).not.toContain("gem-sparkle");
    expect(count(draw("empty"), "circle")).toBeLessThan(count(draw("cut"), "rect"));
    for (const kind of ["cut", "ready", "rough", "dull", "empty"] as const) expect(draw(kind)).not.toContain("crispEdges");
  }
});

