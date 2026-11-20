import { afterEach, expect, jest, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";

// The ring's bonus lap on the end screen: minutes past the day's goal keep going round as dots with a white
// centre, the minutes stand alone in the ring's middle, and under the ring a row each names the skills
// the session kept memories in.
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
const { lapPlan, overDots, lapSteps, lapTickUp, SkillRows } = await import("../src/Lap");
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
  mount(<EndScreen end={{ session: { id: "s", reviews: 9, kept: 8, rescued: 0, cut: ["ai"], kept_skills: [{ skill: "learning", n: 5 }, { skill: "ai", n: 3 }], ...session }, today: now, before} as never} skills={skills} onDone={() => {}} onAgain={() => {}} />);

test("the plan: minutes run from where the day stood to where it stands, and what is past the goal is the bonus", () => {
  expect(lapPlan(today(4) as never, today(16) as never)).toEqual({ from: 4, to: 16, goal: 10 });
  // No goal today (a weekend under Weekdays only), or caught up short of it: minutes, and no bonus.
  expect(lapPlan(null, today(16, { counts: false }) as never)).toEqual({ from: 0, to: 16, goal: 0 });
  // 9 min 40 s rounds to 10 but is not the goal: the count stops short of it, so nothing says the goal was met.
  expect(lapPlan(null, { ...today(0), active_ms: 580_000, met: false } as never)).toEqual({ from: 0, to: 9, goal: 10 });
  // Met because nothing is left due (D60), one minute in: the count shows the one minute, never the goal's 10.
  expect(lapPlan(null, today(1, { met: true, caught_up: true }) as never)).toEqual({ from: 0, to: 1, goal: 10 });
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
  // A lap's last dot waits for the whole lap, as the first lap's does: 119 of 60 is not twice the goal.
  expect(overDots(59, 60, 30)).toBe(29);
  expect(overDots(60, 60, 30)).toBe(30);
  expect(overDots(61, 60, 30)).toBe(31);
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

test("sixteen minutes on a ten minute goal: the ring holds the minutes alone, and the bonus is its dots", async () => {
  const body = await screen(today(4), today(16));
  expect(body.querySelector(".end-lap-n")?.getAttribute("aria-label")).toBe("16 minutes today");
  // Nothing else stands in the ring (Tyler, 2026-11-19: "the wording in the circle feels cramped"): the minutes and "min".
  expect(body.querySelector(".end-lap")?.textContent).toBe("min");
  expect(body.querySelectorAll(".end-lap > *").length).toBe(2);
  expect(body.querySelectorAll(".end-ring circle.core").length).toBe(18);
  // Settled, the gems have made way for the minutes.
  expect(body.querySelectorAll(".end-ring .review-cut").length).toBe(0);
});

test("the goal just met, or not met: minutes, and nothing that says bonus", async () => {
  const met = await screen(today(4), today(10));
  expect(met.querySelector(".end-lap-n")?.getAttribute("aria-label")).toBe("10 minutes today");
  expect(met.querySelectorAll(".end-ring circle.core, .ring-sparkle").length).toBe(0);
  const short = await screen(today(0), today(6));
  expect(short.querySelector(".end-lap-n")?.getAttribute("aria-label")).toBe("6 minutes today");
  expect(short.querySelectorAll(".end-ring circle.core").length).toBe(0);
});

test("the quick quiz keeps its small ring: no minutes in it", async () => {
  const body = await mount(<EndScreen quick end={{ session: { id: "s", reviews: 9, kept: 8, rescued: 0, cut: [] }, today: today(16), before: today(4)} as never} skills={skills} onDone={() => {}} onAgain={() => {}} />);
  expect(body.querySelectorAll(".end-lap, circle.core").length).toBe(0);
});

// Tyler, 2026-11-20: the one small line was "very underwhelming. It almost looks like a subtitle rather than the reward".
const str = (skill: string, solid: number, level: number) => ({ skill, solid, peak: solid, level, next_level_at: 5 * (level + 1) ** 2 });
test("under the ring: each skill the session fed has a row, with what it kept, its level and the way to the next", async () => {
  // AI went from 18 solid (level 1) to 20 (level 2); Learning from 50 to 57, on level 3 (45 to 80).
  const body = await screen(today(4, { skills: [str("ai", 18, 1), str("learning", 50, 3)] }), today(16, { skills: [str("ai", 20, 2), str("learning", 57, 3)] }));
  // Under the ring, never in it, and above the row of results.
  expect(body.querySelectorAll(".end-ring .end-skills").length).toBe(0);
  expect(body.querySelectorAll(".end-emblem + .end-skills + .end-tally").length).toBe(1);
  const rows = [...body.querySelectorAll(".end-skill")];
  const dots = (r: Element) => [r.querySelectorAll(".end-skill-bar i[data-on]").length, r.querySelectorAll(".end-skill-bar i[data-new]").length, r.querySelectorAll(".end-skill-bar i").length];
  // The skill that went up a level leads: its new level is the row's figure, and the bar it filled is all in its colour.
  expect([rows[0]!.getAttribute("data-color"), rows[0]!.hasAttribute("data-up"), rows[0]!.textContent]).toEqual(["purple", true, "AILevel 3 kept"]);
  expect(rows[0]!.querySelectorAll("b > .dot-number").length).toBe(1);
  expect(dots(rows[0]!)).toEqual([0, 10, 10]);
  // One that stayed on its level says the level all the same, and how far along it is.
  expect([rows[1]!.hasAttribute("data-up"), rows[1]!.textContent]).toEqual([false, "LearningLevel 5 kept"]);
  expect(dots(rows[1]!)).toEqual([1, 2, 10]);
  // A reader gets every row at once.
  expect(body.querySelector(".end-skills .sr-only")!.textContent).toBe("AI, 3 kept, level 2 · Learning, 5 kept");
  // The row under it never counts the memories again.
  expect(body.querySelector(".end-tally")?.textContent ?? "").not.toContain("kept");
  // A session of misses has no rows.
  expect((await screen(today(0), today(6), { kept: 0, kept_skills: [], cut: [] })).querySelectorAll(".end-skills").length).toBe(0);
});

test("three rows at most, most fed first; no skill has no level; its room is held until the minutes have counted", async () => {
  const kept = [{ skill: "learning", n: 5 }, { skill: "ai", n: 3 }, { skill: "x", n: 2 }, { skill: "y", n: 1 }];
  const now = [str("learning", 50, 3), str("ai", 6, 1)] as never;
  const body = await mount(<SkillRows kept={kept} was={now} now={now} skills={skills} run />);
  // A memory filed under no known skill is named as the picker names it, with its colour's dot and no bar.
  expect([...body.querySelectorAll(".end-skill")].map((r) => r.textContent)).toEqual(["LearningLevel 5 kept", "AILevel 3 kept", "No skill2 kept"]);
  expect(body.querySelectorAll(".end-skill:nth-of-type(3) .end-skill-bar, .end-skill:nth-of-type(3) > .skill-icon.glyph, .end-skill:nth-of-type(3) > b").length).toBe(0);
  // Nothing gained on the way to the next level lights no new dot.
  expect(body.querySelectorAll(".end-skill-bar i[data-new]").length).toBe(0);
  // The fourth is counted, and a reader hears them all.
  expect(body.querySelector(".end-skills-more")!.textContent).toBe("and 1 more skill");
  expect(body.querySelector(".end-skills .sr-only")!.textContent).toBe("Learning, 5 kept · AI, 3 kept · No skill, 2 kept · No skill, 1 kept");
  // A skill with an icon shows it, in its colour.
  const drawn = await mount(<SkillRows kept={[{ skill: "b", n: 1 }]} was={[]} now={[]} skills={[{ id: "b", name: "Biology", color: "green", icon: "mc:leaf" }] as never} run />);
  expect(drawn.querySelector('.end-skill > .skill-icon.glyph[data-color="green"]')).not.toBeNull();
  expect(drawn.querySelectorAll(".end-skills-more").length).toBe(0);
  // Before the minutes have counted its room is held and nothing is seen.
  const waiting = await mount(<SkillRows kept={kept} was={now} now={now} skills={skills} run={false} />);
  expect([waiting.querySelectorAll(".end-skills[data-wait]").length, waiting.querySelectorAll(".end-skill").length]).toEqual([1, 3]);
});

// Tyler, 2026-11-20: "the alignment is off in some parts of the reward screen".
test("the ring's minutes and a result's mark are boxed to their dots, so what is centred is centred by eye", async () => {
  const body = await screen(today(4), today(14), { depth_days: 41 });
  // "14": a 1 has an empty column at its left and a 4 none at its right; untrimmed it stood half a dot right.
  expect(body.querySelector(".end-lap-n svg")?.getAttribute("viewBox")).toBe("1 0 10 7");
  // The calendar's sprite has three empty columns at its left and two at its right.
  expect(body.querySelector(".end-tally .end-mark")?.getAttribute("viewBox")).toBe("3 1 11 13");
  expect(body.querySelector(".end-tally .dot-number")?.getAttribute("viewBox")).toBe("0 0 16 7");
  // "+41" ends in a 1, with an empty column at its right.
  // A skill's level keeps its full cell, so "Level" stands in one column down the rows whatever the figure.
  expect(body.querySelector(".end-skill .dot-number")?.getAttribute("viewBox") ?? "0 0 5 7").toBe("0 0 5 7");
  const css = (await import("node:fs")).readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  // On the iPhone the rows and the results are as wide as Done, and the results stand in equal columns.
  expect(css).toContain(".phone .end-skills { max-width: none; }");
  expect(css).toMatch(/\.phone \.end-tally \{ display: grid; grid-auto-flow: column; grid-auto-columns: minmax\(0, 1fr\);[^}]*width: 100%;/);
});

// D336
test("the end screen's sounds are layered: the minutes tick as they count, each row lands a step higher, each result after them", async () => {
  const { setPlayer, setSounds } = await import("../src/sfx");
  const heard: string[] = [];
  setSounds(true);
  setPlayer((id, o) => heard.push(`${id}${o.over ? "+" : ""}${Math.round(Math.log2(o.rate) * 12)}`));
  reduce = false;
  const now = today(16, { skills: [{ skill: "ai", level: 3, solid: 45, next_level_at: 80 }, { skill: "learning", level: 1, solid: 9, next_level_at: 20 }] });
  const was = today(4, { skills: [{ skill: "ai", level: 2, solid: 40, next_level_at: 45 }, { skill: "learning", level: 1, solid: 6, next_level_at: 20 }] });
  const body = await screen(was, now, { depth_days: 41 });
  for (let i = 0; i < 80 && !body.querySelector(".end-tally li:last-child:not([data-wait])"); i++) await act(async () => void (await new Promise((r) => setTimeout(r, 100))));
  setPlayer(null);
  const layers = heard.filter((h) => h.includes("+"));
  // The minutes: a tick each, climbing.
  expect(layers.filter((h) => h.startsWith("tap+")).slice(0, 3)).toEqual(["tap+1", "tap+2", "tap+3"]);
  // Two rows a step apart, the level-up's chime under them, then the results' shines above both.
  const rest = layers.filter((h) => !/^tap\+([1-9]|1[0-2])$/.test(h) || h === "tap+7");
  expect(rest.slice(rest.indexOf("right+0"))).toEqual(["right+0", "right+2", "goal+0", "tap+7", "right+7", "tap+7", "right+9"]);
  // The jingle still plays on its own, and takes its turn as before.
  expect(heard).toContain("done0");
}, 15000);

test("the minutes' ticks climb a semitone each step the count shows, up to an octave, also in a long session that skips minutes (D336)", () => {
  for (const plan of [{ from: 0, to: 8, goal: 10 }, { from: 0, to: 66, goal: 20 }, { from: 12, to: 90, goal: 30 }]) {
    const ups = lapSteps(plan).slice(1).map((m) => lapTickUp(plan, m));
    expect(ups).toEqual(ups.map((_, i) => Math.min(12, i + 1)));
  }
});
