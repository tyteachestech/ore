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
  // The mole speaks (D243); what he says of the depth is in the lines test below.
  expect(s.q(".end-says .says-line")).toBe(1);
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

test("the mole's lines share one speech box: each is typed out a letter at a time with his block, holds, then the next is typed; under Reduce Motion a line stands at once (D241, D243, D245)", async () => {
  jest.useFakeTimers();
  // No cart (the goal was met before), so the lines start turning at once.
  const e = end([], today(true, 600_000)) as unknown as { session: Record<string, unknown> };
  Object.assign(e.session, { depth_days: 41, rescued: 2 });
  const s = await mount(e as never);
  const line = () => s.body.querySelector(".end-says .says-line");
  const typed = () => line()!.firstChild?.nodeType === 3 ? line()!.firstChild!.textContent : "";
  // He speaks once he has come up and cheered.
  expect(s.q(".end-says")).toBe(0);
  await act(async () => void jest.advanceTimersByTime(560));
  // The verdict first, and the whole line is in the page from its first letter: only the typed part shows,
  // the rest holds its place unseen, the block between them.
  expect(line()!.textContent).toBe("Honest work.");
  expect(typed()).toBe("");
  expect(s.q(".says[data-typing] .says-line > .says-block + .says-rest")).toBe(1);
  for (let i = 0; i < 4; i++) await act(async () => void jest.advanceTimersByTime(28));
  expect(typed()).toBe("Hone");
  expect(s.body.querySelector(".says-rest")!.textContent).toBe("st work.");
  for (let i = 0; i < 40 && s.q(".says[data-typing]"); i++) await act(async () => void jest.advanceTimersByTime(28));
  expect(typed()).toBe("Honest work.");
  // A whole line holds, then the next is typed from nothing.
  await act(async () => void jest.advanceTimersByTime(2599));
  expect(line()!.textContent).toBe("Honest work.");
  await act(async () => void jest.advanceTimersByTime(1));
  expect(line()!.textContent).toBe("+41 days of memory. You dug that.");
  expect(typed()).toBe("");
  for (let i = 0; i < 80; i++) await act(async () => void jest.advanceTimersByTime(28));
  const second = "+41 days of memory. You dug that.";
  expect(typed()).toBe(second);
  // The pointer on the box holds the line.
  const win = s.body.ownerDocument.defaultView as unknown as { MouseEvent: typeof MouseEvent; FocusEvent: typeof FocusEvent };
  const box = s.body.querySelector(".end-says")!;
  await act(async () => void box.dispatchEvent(new win.MouseEvent("mouseover", { bubbles: true })));
  await act(async () => void jest.advanceTimersByTime(6000));
  expect(line()!.textContent).toBe(second);
  // Focus on the line holds it too, and the pointer leaving doesn't let go of that hold.
  await act(async () => void box.dispatchEvent(new win.FocusEvent("focusin", { bubbles: true })));
  await act(async () => void box.dispatchEvent(new win.MouseEvent("mouseout", { bubbles: true })));
  await act(async () => void jest.advanceTimersByTime(6000));
  expect(line()!.textContent).toBe(second);
  await s.done();
  reduce = true;
  const flat = await mount(e as never);
  // Reduce Motion: the line stands whole at once, nothing left to type.
  expect(flat.body.querySelector(".end-says .says-line")!.firstChild!.textContent).toBe("Honest work.");
  expect(flat.q(".says[data-typing]")).toBe(0);
  // And the lines still take turns, each whole, round and round.
  const said = () => flat.body.querySelector(".end-says .says-line")!.textContent;
  await act(async () => void jest.advanceTimersByTime(2600));
  expect(said()).toBe("+41 days of memory. You dug that.");
  await act(async () => void jest.advanceTimersByTime(2600));
  expect(said()).toBe("2 pulled back just before you’d have lost them.");
  reduce = false;
  jest.useRealTimers();
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
