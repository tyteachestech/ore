import { afterEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";

// The ring's bonus lap on the end screen: minutes past the day's goal keep going round as dots with a white
// centre, the minutes stand in the ring's middle with what came after the goal beside them, and one line
// names the skill the session fed most.
const w = new Window();
for (const k of ["window", "document", "HTMLElement", "Node", "MutationObserver", "getComputedStyle", "navigator"] as const) {
  const v = (w as unknown as Record<string, unknown>)[k];
  (globalThis as Record<string, unknown>)[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
let reduce = true;
g.matchMedia = () => ({ matches: reduce, addEventListener() {}, removeEventListener() {} });
g.requestAnimationFrame = (fn: (t: number) => void) => setTimeout(() => fn(performance.now()), 16);
g.cancelAnimationFrame = (id: number) => clearTimeout(id);
(w.Element.prototype as unknown as Record<string, unknown>).animate = () => ({ cancel() {} });
const { createRoot } = await import("react-dom/client");
const { EndScreen } = await import("../src/Review");
const { DotRing } = await import("../src/Ring");
const { lapPlan, overDots, lapSteps } = await import("../src/Lap");
const { TooltipProvider } = await import("@radix-ui/react-tooltip");

const today = (active_min: number, o: Record<string, unknown> = {}) => ({ goal_minutes: 10, goal_ms: 600_000, active_ms: active_min * 60_000, met: active_min >= 10, counts: true, caught_up: false, new_waiting: 0, skills: [], ...o });
const skills = [{ id: "ai", name: "AI", color: "purple", icon: "ai" }, { id: "learning", name: "Learning", color: "pink", icon: "brain" }] as never;
const open = new Set<() => Promise<void>>();
afterEach(async () => {
  reduce = true;
  for (const done of [...open]) await done();
});
async function mount(node: React.ReactNode) {
  const body = document.createElement("div");
  document.body.appendChild(body);
  const root = createRoot(body);
  await act(async () => root.render(<TooltipProvider>{node}</TooltipProvider>));
  const done = async () => { if (open.delete(done)) await act(async () => (root.unmount(), body.remove())); };
  open.add(done);
  return body;
}
const screen = (before: unknown, now: unknown, session: Record<string, unknown> = {}) =>
  mount(<EndScreen end={{ session: { id: "s", reviews: 9, kept: 8, rescued: 0, cut: ["ai"], kept_skills: [{ skill: "learning", n: 5 }, { skill: "ai", n: 3 }], ...session }, today: now, before, next: null } as never} skills={skills} onDone={() => {}} onAgain={() => {}} onTry={() => {}} />);

test("the plan: minutes run from where the day stood to where it stands, and what is past the goal is the bonus", () => {
  expect(lapPlan(today(4) as never, today(16) as never)).toEqual({ from: 4, to: 16, goal: 10 });
  // No goal today (a weekend under Weekdays only), or caught up short of it: minutes, and no bonus.
  expect(lapPlan(null, today(16, { counts: false }) as never)).toEqual({ from: 0, to: 16, goal: 0 });
  expect(lapSteps({ from: 4, to: 16, goal: 10 })).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  // A long session never takes long to count: at most 24 steps.
  expect(lapSteps({ from: 0, to: 90, goal: 10 }).length).toBeLessThanOrEqual(25);
  expect(lapSteps({ from: 0, to: 90, goal: 10 }).at(-1)).toBe(90);
  expect(lapSteps({ from: 0, to: 90, goal: 10 })).toContain(10);
});

test("bonus minutes become dots at the ring's own rate, lap after lap", () => {
  expect(overDots(0, 10, 30)).toBe(0);
  expect(overDots(6, 10, 30)).toBe(18);
  expect(overDots(14, 10, 30)).toBe(42);
  // Any bonus lights a dot, as any progress does.
  expect(overDots(1, 60, 30)).toBe(1);
  expect(overDots(5, 0, 30)).toBe(0);
});

test("a ring's bonus dots are bigger and carry a white centre; a third lap's are bigger again", async () => {
  const lap2 = await mount(<DotRing size={236} share={1} over={18} />);
  expect(lap2.querySelectorAll("circle.on").length).toBe(30);
  expect(lap2.querySelectorAll("circle.over").length).toBe(18);
  expect(lap2.querySelectorAll("circle.core").length).toBe(18);
  expect(lap2.querySelectorAll("circle.over2, circle.core.big").length).toBe(0);
  const lap3 = await mount(<DotRing size={236} share={1} over={42} />);
  expect(lap3.querySelectorAll("circle.over2").length).toBe(12);
  expect(lap3.querySelectorAll("circle.over").length).toBe(18);
  expect(lap3.querySelectorAll("circle.core").length).toBe(30);
  expect(lap3.querySelectorAll("circle.core.big").length).toBe(12);
  // A ring with no bonus draws nothing new.
  expect((await mount(<DotRing size={92} share={1} />)).querySelectorAll(".over, .core").length).toBe(0);
});

test("sixteen minutes on a ten minute goal: the minutes, what came after the goal, the bonus dots and the top skill", async () => {
  const body = await screen(today(4), today(16));
  expect(body.querySelector(".end-lap-n")?.getAttribute("aria-label")).toBe("16 minutes today");
  expect(body.querySelector(".end-lap-plus")?.getAttribute("aria-label")).toBe("6 minutes past today’s goal");
  expect(body.querySelectorAll(".end-ring circle.core").length).toBe(18);
  // The skill the session fed most is the one that stays.
  expect(body.querySelector(".end-lap-skill")?.textContent).toBe("Learning+5");
  // Settled, the gems have made way for the minutes.
  expect(body.querySelectorAll(".end-ring .review-cut").length).toBe(0);
});

test("the goal just met, or not met: minutes, and nothing that says bonus", async () => {
  const met = await screen(today(4), today(10));
  expect(met.querySelector(".end-lap-n")?.getAttribute("aria-label")).toBe("10 minutes today");
  expect(met.querySelectorAll(".end-lap-plus, .end-ring circle.core, .ring-sparkle").length).toBe(0);
  const short = await screen(today(0), today(6));
  expect(short.querySelector(".end-lap-n")?.getAttribute("aria-label")).toBe("6 minutes today");
  expect(short.querySelectorAll(".end-lap-plus, .end-ring circle.core").length).toBe(0);
  // A session of misses kept nothing, so no skill is named.
  const missed = await screen(today(0), today(6), { kept: 0, kept_skills: undefined, cut: [] });
  expect(missed.querySelectorAll(".end-lap-skill").length).toBe(0);
});

test("the quick quiz keeps its small ring: no minutes in it", async () => {
  const body = await mount(<EndScreen quick end={{ session: { id: "s", reviews: 9, kept: 8, rescued: 0, cut: [] }, today: today(16), before: today(4), next: null } as never} skills={skills} onDone={() => {}} onAgain={() => {}} onTry={() => {}} />);
  expect(body.querySelectorAll(".end-lap, circle.core").length).toBe(0);
});
