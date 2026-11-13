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
  // The mole says it (D243).
  expect(s.body.querySelector(".end-says")!.textContent).toContain("+41 days of memory");
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
  reduce = true;
  const none = await mount(end([]));
  reduce = false;
  expect(none.body.querySelector(".end-says")!.textContent).not.toContain("of memory");
  await none.done();
});

test("the mole's lines share one bubble: one shows, the next rolls up after a hold, and under Reduce Motion they still take turns (D241, D243)", async () => {
  jest.useFakeTimers();
  // No cart (the goal was met before), so the lines start turning at once.
  const e = end([], today(true, 600_000)) as unknown as { session: Record<string, unknown> };
  Object.assign(e.session, { depth_days: 41, rescued: 2 });
  const s = await mount(e as never);
  const on = () => s.body.querySelector('.end-says .end-lines > [data-at="on"]')?.textContent;
  // He speaks once he has come up and cheered.
  expect(s.q(".end-says")).toBe(0);
  await act(async () => void jest.advanceTimersByTime(560));
  expect(s.q(".end-lines > div")).toBeGreaterThanOrEqual(2);
  expect(s.q('.end-lines > [data-at="on"]')).toBe(1);
  // The verdict first. The count of memories kept is the hero under the ring (D242), not one of his lines.
  expect(on()).toBe("Honest work.");
  // Every line but the one showing is out of reach of the keyboard and the reader.
  expect(s.q(".end-lines > div[inert]")).toBe(s.q(".end-lines > div") - 1);
  await act(async () => void jest.advanceTimersByTime(2600));
  const second = on();
  expect(second).toBe("+41 days of memory. You dug that.");
  expect(s.body.querySelector('.end-lines > [data-at="was"]')?.textContent).toBe("Honest work.");
  // The pointer on a line holds it.
  await act(async () => void s.body.querySelector(".end-lines")!.dispatchEvent(new (s.body.ownerDocument.defaultView as unknown as { MouseEvent: typeof MouseEvent }).MouseEvent("mouseover", { bubbles: true })));
  await act(async () => void jest.advanceTimersByTime(6000));
  expect(on()).toBe(second);
  // Focus on the line holds it too, and the pointer leaving doesn't let go of that hold.
  const win = s.body.ownerDocument.defaultView as unknown as { MouseEvent: typeof MouseEvent; FocusEvent: typeof FocusEvent };
  await act(async () => void s.body.querySelector(".end-lines")!.dispatchEvent(new win.FocusEvent("focusin", { bubbles: true })));
  await act(async () => void s.body.querySelector(".end-lines")!.dispatchEvent(new win.MouseEvent("mouseout", { bubbles: true })));
  await act(async () => void jest.advanceTimersByTime(6000));
  expect(on()).toBe(second);
  jest.useRealTimers();
  await s.done();
  // One line has nothing to take turns with.
  const one = await mount(end([], today(true, 600_000)));
  await wait(700);
  expect(one.q(".end-lines")).toBe(0);
  expect(one.body.querySelector(".end-says > p")!.textContent).toBe("Honest work.");
  await one.done();
  reduce = true;
  const flat = await mount(e as never);
  reduce = false;
  // The bubble has room for one line, so they still take turns; only the roll is gone (CSS).
  expect(flat.q('.end-says .end-lines > [data-at="on"]')).toBe(1);
  // Under the emblem nothing of Ore's is left but the count, and with no gem cut that stands in the ring (D242, D243).
  expect(flat.q(".review-end > p, .review-end > .end-lines")).toBe(0);
  expect(flat.q(".review-end h2")).toBe(0);
  await flat.done();
});

test("the end screen is one emblem (D242): the gems sit inside the ring with the count under it, the count stands in the ring when no gem was cut, and the quick quiz keeps its row", async () => {
  reduce = true;
  const s = await mount(end(["ai", "ai"]));
  expect(s.q(".end-emblem .end-ring > .ring")).toBe(1);
  expect(s.q(".end-emblem .end-ring > .review-cut > span")).toBe(2);
  // The count is said once: under the emblem, never also among the lines.
  expect(s.q(".review-kept")).toBe(1);
  expect(s.q(".end-emblem + .review-kept")).toBe(1);
  // The count is drawn in dots (a 7 is 11 of them), and its text is the true number for a reader and for a test.
  expect(s.q(".review-kept b .dot-number circle")).toBeGreaterThan(5);
  expect(s.body.querySelector(".review-kept")!.textContent).toBe("5 memories kept");
  // The gem's own hint names its skill, so no icon repeats it under the gem.
  expect(s.q(".review-cut-skill")).toBe(0);
  await s.done();
  const none = await mount(end([]));
  expect(none.q(".end-ring > .review-kept")).toBe(1);
  expect(none.q(".review-kept")).toBe(1);
  await none.done();
  // A session of misses has no count to stand anywhere: the mole says why it was worth it (D62).
  const missed = end([]) as unknown as { session: Record<string, unknown> };
  missed.session.kept = 0;
  const m = await mount(missed as never);
  expect(m.q(".review-kept")).toBe(0);
  expect(m.body.querySelector(".end-says")!.textContent).toContain("Every miss comes back sooner");
  await m.done();
  const body = document.createElement("div");
  document.body.appendChild(body);
  const root = createRoot(body);
  await act(async () => root.render(<TooltipProvider><EndScreen quick end={end(["ai"])} skills={skills} onDone={() => {}} onAgain={() => {}} onTry={() => {}} /></TooltipProvider>));
  expect(body.querySelectorAll(".end-emblem").length).toBe(0);
  expect(body.querySelectorAll(".review-end > .review-cut").length).toBe(1);
  expect(body.querySelectorAll(".review-kept").length).toBe(1);
  await act(async () => (root.unmount(), body.remove()));
  reduce = false;
});

test("what the mole says at a session's end (D243): the verdict, then only what the numbers say", async () => {
  const { endSays } = await import("../src/end-says");
  const base = { today: today(true, 600_000) as never, closed: false, short: false, ups: [], waiting: null, minutesLeft: null };
  const session = (o: Record<string, unknown>) => ({ id: "s", reviews: 8, kept: 5, rescued: 0, ...o }) as never;
  expect(endSays({ ...base, session: session({}) }).map((l) => l.text)).toEqual(["Honest work."]);
  expect(endSays({ ...base, closed: true, session: session({}) })[0]!.text).toBe("Goal met. Tools down.");
  expect(endSays({ ...base, short: true, session: session({}) })[0]!.text).toBe("Seam’s empty. Today counts.");
  // No guilt for a session of misses, whatever else is true (D62).
  expect(endSays({ ...base, closed: true, session: session({ kept: 0 }) })[0]!.text).toBe("Every miss comes back sooner. That’s how they stick.");
  const all = endSays({ ...base, session: session({ depth_days: 212, longest_days: 9, rescued: 2 }), ups: [{ name: "AI", level: 3 }], waiting: "2 new exercises start tomorrow.", minutesLeft: "4" });
  expect(all.map((l) => l.text)).toEqual(["Honest work.", "+7 months of memory. You dug that.", "9 days gone and you still had it.", "2 pulled back just before you’d have lost them.", "AI hit level 3.", "4 min to today’s goal. Your call.", "2 new exercises start tomorrow."]);
  // The one number that needs explaining keeps its hint.
  expect(all[1]!.hint).toContain("added up");
  // A gap under a week, and rescues that were most of the session, go unsaid.
  expect(endSays({ ...base, session: session({ longest_days: 3, rescued: 6 }) })).toHaveLength(1);
});
