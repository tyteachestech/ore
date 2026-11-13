import { expect, jest, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";

// D190 on the end screen itself: the cart is there whenever the session lit a ring dot or cut a gem, the mole
// waits for it, everything settles, and Reduce Motion shows the settled screen at once.
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
const { CartTip } = await import("../src/CartTip");
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
/** The mole is playing its cheer. */
const cheering = (body: HTMLElement) => body.querySelector(".review-mole .mole")?.getAttribute("data-mood") === "cheer";

test("a session that filled the ring and cut a gem: the cart is there, the mole and the gem wait, then all of it settles", async () => {
  jest.useFakeTimers();
  const s = await mount(end(["ai"]));
  expect(s.q(".review-end.carted .cart-tip .cart")).toBe(1);
  expect(s.q(".review-mole .mole")).toBe(0);
  expect(s.q(".dot-ring .on")).toBe(0);
  expect(s.q(".review-cut > span[data-wait]")).toBe(1);
  // A clock the test turns by hand, so the gap between the mole coming up and its cheer is exact on any runner.
  let up = -1, cheer = -1;
  for (let t = 0; t < 6000 && !(cheer >= 0 && !s.q(".cart-tip")); t += 20) {
    await act(async () => void jest.advanceTimersByTime(20));
    if (up < 0 && s.q(".review-mole .mole")) up = t;
    if (up >= 0 && cheer < 0 && cheering(s.body)) cheer = t;
  }
  jest.useRealTimers();
  expect(s.q(".cart-tip")).toBe(0);
  expect(s.q(".cart-ore")).toBe(0);
  expect(s.q(".dot-ring .on")).toBe(30);
  expect(s.q(".review-cut > span[data-wait]")).toBe(0);
  // The stone that landed is cut where it stands: it ends as a gem of solid pixels (D239).
  for (const t0 = Date.now(); Date.now() - t0 < 3000 && s.q(".gem-cutting[data-cutting]"); ) await act(async () => void (await wait(40)));
  expect(s.q(".gem-cutting[data-cutting]")).toBe(0);
  expect(s.q('.review-cut .gem[data-kind="cut"] rect')).toBeGreaterThan(50);
  // The mole cheers once it is up (560ms), not when the cart has finished leaving.
  expect(cheer - up).toBeGreaterThanOrEqual(540);
  expect(cheer - up).toBeLessThanOrEqual(580);
  await s.done();
}, 10_000);

test("a gem cut with the ring already full: the cart still comes, carrying only the stone", async () => {
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
  // With no cart before it, it still comes up out of the ground first, as it does after the cart.
  expect(none.body.querySelector(".review-mole .mole")?.getAttribute("data-mood")).toBe("peek");
  await none.done();
  reduce = true;
  const still = await mount(end(["ai"]));
  reduce = false;
  expect(still.q(".cart-tip")).toBe(0);
  expect(still.q(".review-mole .mole")).toBe(1);
  expect(cheering(still.body)).toBe(true);
  expect(still.q(".review-cut > span[data-wait]")).toBe(0);
  await still.done();
});

test("an ore whose ring dot is missing still counts, so the ring is told it is full", async () => {
  const body = document.createElement("div");
  body.className = "review-body";
  body.innerHTML = `<div class="host"><div class="ring"><svg class="dot-ring"><circle></circle></svg></div></div>`;
  document.body.appendChild(body);
  const host = body.querySelector<HTMLElement>(".host")!, slot = document.createElement("div");
  host.appendChild(slot);
  const root = createRoot(slot);
  let poured = 0;
  await act(async () => root.render(<CartTip host={host} lit={[0, 7]} stones={[]} onStone={() => {}} onPoured={() => poured++} onLeave={() => {}} onDone={() => {}} />));
  for (const t0 = Date.now(); Date.now() - t0 < 4000 && !poured; ) await wait(40);
  expect(poured).toBe(1);
  expect(body.querySelectorAll(".dot-ring .on").length).toBe(1);
  await act(async () => (root.unmount(), body.remove()));
}, 10_000);

test("gem grades on the end screen (D197): a won-back gem has a gold rim, a gem polished this session shows after the cut ones, and the session's depth is one line", async () => {
  reduce = true;
  const e = end(["ai", "ai"]) as unknown as { session: Record<string, unknown> };
  Object.assign(e.session, { grades: ["mended", "cut"], polished: ["ai"], depth_days: 41 });
  const s = await mount(e as never);
  reduce = false;
  const gems = [...s.body.querySelectorAll(".review-cut > span")];
  expect(gems).toHaveLength(3);
  const seams = gems.map((g) => g.querySelectorAll('rect[data-gold]').length);
  expect(seams[0]).toBeGreaterThan(0);
  expect(seams.slice(1)).toEqual([0, 0]);
  expect(s.body.querySelector(".review-cut")!.getAttribute("aria-label")).toBe("2 became solid, 1 won back, 1 polished");
  expect(s.body.querySelector(".review-depth")!.textContent).toBe("+41 days of memory");
  await s.done();
  // More gems than fit: the count covers the polished ones left out too.
  const many = end(Array(8).fill("ai")) as unknown as { session: Record<string, unknown> };
  Object.assign(many.session, { polished: ["ai", "ai"] });
  reduce = true;
  const m = await mount(many as never);
  reduce = false;
  expect(m.body.querySelector(".review-cut > b")!.textContent).toBe("+2");
  await m.done();
  // Nothing gained, nothing said.
  const none = await mount(end([]));
  expect(none.q(".review-depth")).toBe(0);
  await none.done();
});
