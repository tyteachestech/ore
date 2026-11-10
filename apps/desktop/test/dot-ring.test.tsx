import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Gem } from "../src/Gem";
import { DotRing, lit } from "../src/Ring";

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

test("every gem state is drawn in dots at both sizes, and a cracked one differs from a cut one", () => {
  for (const size of [16, 36]) {
    const draw = (kind: Parameters<typeof Gem>[0]["kind"]) => renderToStaticMarkup(<Gem kind={kind} size={size} />);
    for (const kind of ["cut", "ready", "rough", "dull", "empty"] as const) {
      expect(draw(kind)).toContain("<circle");
      expect(draw(kind)).not.toContain("<rect");
      expect(draw(kind)).not.toContain("crispEdges");
    }
    expect(draw("dull").match(/<circle/g)!.length).toBeLessThan(draw("cut").match(/<circle/g)!.length);
    expect(draw("empty").match(/<circle/g)!.length).toBeLessThan(draw("cut").match(/<circle/g)!.length);
  }
});
