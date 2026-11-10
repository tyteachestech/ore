import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";

// D190 on the end screen itself: the cart is there whenever the session lit a ring dot or cut a gem, the mole
// waits for it, everything settles, and Reduce Motion shows the settled screen at once. Real timers: the tip
// takes about three seconds.
const w = new Window();
for (const k of ["window", "document", "HTMLElement", "Node", "MutationObserver", "getComputedStyle", "navigator"] as const) {
  const v = (w as unknown as Record<string, unknown>)[k];
  (globalThis as Record<string, unknown>)[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
let reduce = false;
g.matchMedia = () => ({ matches: reduce, addEventListener() {}, removeEventListener() {} });
g.requestAnimationFrame = (fn: (t: number) => void) => setTimeout(() => fn(performance.now()), 16);
g.cancelAnimationFrame = (id: number) => clearTimeout(id);
(w.Element.prototype as unknown as Record<string, unknown>).animate = () => ({ cancel() {} });
const { createRoot } = await import("react-dom/client");
const { EndScreen } = await import("../src/Review");
const { TooltipProvider } = await import("@radix-ui/react-tooltip");

const today = (met: boolean, active_ms: number) => ({ goal_minutes: 10, goal_ms: 600_000, active_ms, met, counts: true, caught_up: false, new_waiting: 0, skills: [] });
const end = (cut: string[], before = today(false, 0), now = today(true, 600_000)) => ({ session: { id: "s", reviews: 5, kept: 5, rescued: 0, cut }, today: now, before, next: null }) as never;
const skills = [{ id: "ai", name: "AI", color: "purple", icon: "ai" }] as never;
const wait = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)));
async function mount(e: never) {
  const body = document.createElement("div");
  body.className = "review-body";
  document.body.appendChild(body);
  const root = createRoot(body);
  await act(async () => root.render(<TooltipProvider><EndScreen end={e} skills={skills} onDone={() => {}} onAgain={() => {}} onTry={() => {}} /></TooltipProvider>));
  const q = (s: string) => body.querySelectorAll(s).length;
  return { q, body, done: () => act(async () => (root.unmount(), body.remove())) };
}
/** The mole's nose is two dots at rest and four when it cheers. */
const cheering = (body: HTMLElement) => (body.querySelector(".mole-nose")?.getAttribute("d")?.match(/M/g)?.length ?? 0) === 4;

test("a session that filled the ring and cut a gem: the cart is there, the mole and the gem wait, then all of it settles", async () => {
  const s = await mount(end(["ai"]));
  expect(s.q(".review-end.carted .cart-tip .cart")).toBe(1);
  expect(s.q(".review-mole .mole")).toBe(0);
  expect(s.q(".dot-ring .on")).toBe(0);
  expect(s.q(".review-cut > span[data-wait]")).toBe(1);
  let up = 0, cheer = 0;
  for (const t0 = Date.now(); Date.now() - t0 < 6000 && !(cheer && !s.q(".cart-tip")); ) {
    await wait(40);
    if (!up && s.q(".review-mole .mole")) up = Date.now();
    if (up && !cheer && cheering(s.body)) cheer = Date.now();
  }
  expect(s.q(".cart-tip")).toBe(0);
  expect(s.q(".cart-ore")).toBe(0);
  expect(s.q(".dot-ring .on")).toBe(30);
  expect(s.q(".review-cut > span[data-wait]")).toBe(0);
  // The mole cheers once it is up (560ms), not when the cart has finished leaving.
  expect(cheer - up).toBeGreaterThan(400);
  expect(cheer - up).toBeLessThan(800);
  await s.done();
}, 10_000);

test("a gem cut with the ring already full: the ring is full from the start, and only the stone falls", async () => {
  const s = await mount(end(["ai"], today(true, 600_000)));
  expect(s.q(".cart-tip .cart")).toBe(1);
  expect(s.q(".dot-ring .on")).toBe(30);
  expect(s.q(".cart-ore-in")).toBe(0);
  await s.done();
});

test("nothing to tip, or Reduce Motion: no cart, and the mole, the ring and the gems are there at once", async () => {
  const none = await mount(end([], today(true, 600_000)));
  expect(none.q(".cart-tip")).toBe(0);
  expect(none.q(".review-mole .mole")).toBe(1);
  await none.done();
  reduce = true;
  const still = await mount(end(["ai"]));
  reduce = false;
  expect(still.q(".cart-tip")).toBe(0);
  expect(still.q(".review-mole .mole")).toBe(1);
  expect(still.q(".review-cut > span[data-wait]")).toBe(0);
  await still.done();
});
