import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { along, CartTip, flight, oreFor } from "../src/CartTip";
import { ringDots } from "../src/Ring";

// D190: the cart's ore falls as a thrown thing does, and the cart is drawn in round dots like the rest.

test("ore lands exactly on its ring dot, wherever that is", () => {
  for (const [dx, dy] of [[40, 12], [110, 60], [-20, 118], [60, 330]] as const) {
    const T = flight(dy), [x, y] = along(dx, dy, T, T);
    expect(x).toBeCloseTo(dx, 6);
    expect(y).toBeCloseTo(dy, 6);
  }
});

test("it hops up out of the bucket, then falls faster and faster, and a longer drop takes longer", () => {
  const T = flight(120);
  expect(along(0, 120, T, 0.01)[1]).toBeLessThan(0);
  const step = (t: number) => along(0, 120, T, t + 0.02)[1] - along(0, 120, T, t)[1];
  expect(step(T * 0.8)).toBeGreaterThan(step(T * 0.4));
  expect(flight(300)).toBeGreaterThan(T);
  expect(flight(300)).toBeLessThan(0.6);
});

test("the cart is round dots only, carries at most thirty dots of ore and three stones, and is hidden from VoiceOver", () => {
  const html = (lit: number, stones: number) => renderToStaticMarkup(<CartTip host={null} lit={Array.from({ length: lit }, (_, i) => i)} stones={Array<string>(stones).fill("pink")} onStone={() => {}} onPoured={() => {}} onLeave={() => {}} onDone={() => {}} />);
  const full = html(40, 8);
  expect(full).toContain('aria-hidden="true"');
  expect(full.match(/class="cart-ore-in"/g)?.length).toBe(30);
  expect(full.match(/class="cart-rough-in"/g)?.length).toBe(3);
  expect(full.match(/class="cart-rough"/g)?.length).toBe(8);
  expect(full).not.toMatch(/<path|<polygon|<line/);
  expect(html(2, 0).match(/class="cart-ore-in"/g)?.length).toBe(2);
  expect(html(0, 1)).not.toContain("cart-ore-in");
});

test("the cart carries one dot of ore for each ring dot the session lit, and none when the ring did not move", () => {
  const n = ringDots(120);
  expect(oreFor(0, 1, n)).toEqual(Array.from({ length: n }, (_, i) => i));
  expect(oreFor(0.5, 0.6, n)).toEqual([15, 16, 17]);
  expect(oreFor(0, 0.01, n)).toEqual([0]);
  expect(oreFor(1, 1, n)).toEqual([]);
  expect(oreFor(0.5, 0.5, n)).toEqual([]);
});
