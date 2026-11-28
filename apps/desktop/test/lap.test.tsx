import { afterEach, expect, jest, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";

// The ring's bonus lap on the end screen: minutes past the day's goal keep going round as dots with a white
// centre, the minutes stand alone in the ring's middle, and under the ring a row each names the skills
// the session kept memories in.
const w = new Window();
for (const k of ["window", "document", "HTMLElement", "Node", "MutationObserver", "getComputedStyle", "navigator", "DOMRect"] as const) {
  const v = (w as unknown as Record<string, unknown>)[k];
  (globalThis as Record<string, unknown>)[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
let reduce = true;
g.matchMedia = () => ({ matches: reduce, addEventListener() {}, removeEventListener() {} });
g.requestAnimationFrame = (fn: (t: number) => void) => setTimeout(() => fn(performance.now()), 16);
g.cancelAnimationFrame = (id: number) => clearTimeout(id);
(w.Element.prototype as unknown as Record<string, unknown>).animate = () => ({ cancel() {}, set onfinish(f: () => void) { setTimeout(f, 0); } }); // a flight lands at once
const { createRoot } = await import("react-dom/client");
const { EndScreen } = await import("../src/Review");
const { DotRing } = await import("../src/Ring");
const { lapPlan, overDots, lapSteps, lapTickUp, SkillRows, endPlan, levelAt } = await import("../src/Lap");
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
  expect(lapPlan(null, { ...today(0), active_ms: 573_084, met: true, caught_up: true } as never)).toEqual({ from: 0, to: 9, goal: 10 });
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
const waitingRoom = (body: Element) => body.querySelector(".end-skills")!.getAttribute("style")!;
const str = (skill: string, solid: number, level: number, ready = 0) => ({ skill, solid, peak: solid, ready, level, next_level_at: 5 * (level + 1) ** 2 });
// Tyler, 2026-11-23: "I don't want to read it. I want to feel it"; and of names cut short in a row of small medals: "a
// fundementally bad layout".
test("under the ring: each skill the session fed has a line: its medal and level, its whole name, and today's gems and stones at the right", async () => {
  // AI went from 18 solid (level 1) to 20 (level 2); Learning from 50 to 57, on level 3 (45 to 80).
  const body = await screen(today(4, { skills: [str("ai", 18, 1), str("learning", 50, 3)] }), today(16, { skills: [str("ai", 20, 2), str("learning", 57, 3, 2)] }));
  // Under the ring, never in it, and above the row of results.
  expect(body.querySelectorAll(".end-ring .end-skills").length).toBe(0);
  expect(body.querySelectorAll(".end-emblem + .end-skills + .end-tally").length).toBe(1);
  const rows = [...body.querySelectorAll(".end-medal")];
  const pips = (r: Element) => [...r.querySelectorAll(".end-medal-pips > span:not([data-wait]) .gem")].map((x) => x.getAttribute("data-kind"));
  // The skill that went up a level leads, in its colour, its new level on the medal's rim.
  expect([rows[0]!.getAttribute("data-color"), rows[0]!.hasAttribute("data-up"), rows[0]!.querySelector(".end-medal-name")!.textContent, rows[0]!.querySelector(".gem-ring-lv")!.textContent]).toEqual(["purple", true, "AI", "2"]);
  // What today added stands at the right: the gem it cut, then a stone for each other memory kept.
  expect(pips(rows[0]!)).toEqual(["cut", "rough", "rough"]);
  // One that stayed on its level shows the level all the same. A memory kept and not cut is a rough stone: the
  // skill's count of memories one answer from a gem is of the whole skill, not of this session (F579).
  expect([rows[1]!.hasAttribute("data-up"), rows[1]!.querySelector(".end-medal-name")!.textContent, rows[1]!.querySelector(".gem-ring-lv")!.textContent]).toEqual([false, "Learning", "3"]);
  expect(pips(rows[1]!)).toEqual(["rough", "rough", "rough", "rough", "rough"]);
  // No sentence in a line: the name is its only words.
  expect(rows.map((r) => r.textContent)).toEqual(["2AI", "3Learning"]);
  // A reader gets every line at once.
  expect(body.querySelector(".end-skills .sr-only")!.textContent).toBe("AI · 3 kept · 1 became a gem · level 2. Learning · 5 kept · level 3");
  // A session of misses has no lines.
  expect((await screen(today(0), today(6), { kept: 0, kept_skills: [], cut: [] })).querySelectorAll(".end-skills").length).toBe(0);
});

test("the plan: level-ups lead, then gems, then memories kept; a line holds five; the big ring goes to a new level, or to the one skill that won most", () => {
  const now = [str("a", 20, 2), str("b", 9, 1), str("c", 7, 1), str("d", 3, 0, 1)] as never, was = [str("a", 18, 1), str("b", 7, 1), str("c", 6, 1), str("d", 3, 0, 1)] as never;
  const kept = [{ skill: "d", n: 9 }, { skill: "c", n: 2 }, { skill: "b", n: 2 }, { skill: "a", n: 2 }, { skill: "gone", n: 1 }];
  const plan = endPlan(["b", "b", "a", "c"], kept, was, now);
  // A memory filed under no skill has its line too, last here with one memory kept; it has no level.
  expect(plan.rows.map((r) => `${r.skill} ${r.cut}/${r.kept}${r.solo ? " solo" : ""}`)).toEqual(["a 1/2 solo", "b 2/2", "c 1/2", "d 0/9", "gone 0/1"]);
  expect(levelAt(plan.rows[4]!, 0, true, was, now)).toMatchObject({ lv: 0, up: false, share: 0 });
  // Nine memories kept draw five stones, so the name beside them keeps its room.
  expect(plan.rows[3]!.slots).toEqual(["rough", "rough", "rough", "rough", "rough"]);
  // One memory kept in a skill that has one other memory close to a gem: nothing says the kept one is that one.
  expect(endPlan([], [{ skill: "d", n: 1 }], was, now).rows[0]!.slots).toEqual(["rough"]);
  // One flier for each stone drawn, in the lines' order.
  expect(plan.fliers.map((f) => f.skill).join("")).toBe("aabbccdddddgone");
  expect(plan.rows.map((r) => r.first)).toEqual([0, 2, 4, 6, 11]);
  // No new level: the big ring goes to the skill with most gems, and only to it.
  expect(endPlan(["b", "b", "c"], kept, now, now).rows.filter((r) => r.solo).map((r) => r.skill)).toEqual(["b"]);
  // No gem at all: no turn in the big ring.
  expect(endPlan([], kept, now, now).rows.some((r) => r.solo)).toBe(false);
  // A level as the gems land: 18 solid is level 1; the second gem makes 20, level 2, and the ring it filled stays full.
  const a = plan.rows[0]!, two = { ...a, cut: 2 };
  expect([levelAt(two, 1, false, was, now).lv, levelAt(two, 1, false, was, now).up, levelAt(two, 2, false, was, now).lv, levelAt(two, 2, false, was, now).up, levelAt(two, 2, false, was, now).share]).toEqual([1, false, 2, true, 1]);
});

test("a line's level is the skill's true level: a gem won back below its best adds none, and a day with no 'before' adds nothing twice", () => {
  // Its best was 19 gems (level 1, level 2 at 20) and it held 10; the session won one back: 11 held, best still 19.
  const was = [{ ...str("a", 10, 1), peak: 19 }] as never, now = [{ ...str("a", 11, 1), peak: 19 }] as never;
  const row = endPlan(["a"], [{ skill: "a", n: 1 }], was, now).rows[0]!;
  expect([false, true].map((done) => { const l = levelAt(row, 1, done, was, now); return [l.lv, l.up]; })).toEqual([[1, false], [1, false]]);
  // Where the day stood before is unknown: the after state stands for it, and the session's gems are not added again.
  const after = [str("a", 18, 1)] as never, three = endPlan(["a", "a", "a"], [], after, after).rows[0]!;
  expect([levelAt(three, 3, false, after, after).lv, levelAt(three, 3, false, after, after).up, levelAt(three, 3, true, after, after).lv]).toEqual([1, false, 1]);
  // Six gems in one skill take it from 14 to 20, level 2: the line draws five, and the level counts all six.
  const b6 = [str("a", 14, 1)] as never, n6 = [str("a", 20, 2)] as never, six = endPlan(Array(6).fill("a"), [], b6, n6).rows[0]!;
  expect([six.slots.length, six.cut, levelAt(six, six.cut, false, b6, n6).up]).toEqual([5, 6, true]);
});

test("more lines than the window has room for roll like credits; Reduce Motion shows them all; the room is held until the lines come in", async () => {
  const ids = ["a", "b", "c", "d"], now = ids.map((id) => str(id, 6, 1)) as never, named = ids.map((id) => ({ id, name: `Skill ${id}`, color: "green" })) as never;
  const plan = endPlan(["a"], ids.map((skill) => ({ skill, n: 2 })), now, now);
  const over = { cut: plan.rows.map((r) => r.cut), stone: plan.rows.map(() => 0), shown: plan.rows.map(() => true), done: true };
  // Reduce Motion: nothing rolls, every line stands.
  const flat = await mount(<SkillRows plan={plan} prog={over} was={now} now={now} skills={named} run />);
  expect([flat.querySelectorAll(".end-skills[data-rolls]").length, flat.querySelectorAll(".end-medal").length]).toEqual([0, 4]);
  reduce = false;
  // Four lines in a window with room for two: they roll, and the first two stand in again after the last so the roll comes round.
  const rolling = await mount(<SkillRows plan={plan} prog={over} was={now} now={now} skills={named} run />);
  expect(rolling.querySelector(".end-skills")!.getAttribute("style")).toContain("--seen: 2");
  // One line holds one line's room, however tall the window: no gap before the results.
  expect(waitingRoom(await mount(<SkillRows plan={endPlan([], [{ skill: "a", n: 1 }], now, now)} prog={{ cut: [0], stone: [0], shown: [true], done: true }} was={now} now={now} skills={named} run />))).toContain("--seen: 1");
  expect([rolling.querySelectorAll(".end-skills[data-rolls]").length, rolling.querySelectorAll(".end-medal").length]).toEqual([1, 6]);
  // Until the session's stones have landed it stays on its first lines, and none is drawn twice.
  const early = await mount(<SkillRows plan={plan} prog={{ ...over, shown: plan.rows.map(() => false), done: false }} was={now} now={now} skills={named} run />);
  expect([early.querySelectorAll(".end-medal").length, early.querySelectorAll(".end-medal[data-wait]").length]).toEqual([4, 4]);
  // Before the lines come in their room is held and nothing is seen.
  const waiting = await mount(<SkillRows plan={plan} prog={over} was={now} now={now} skills={named} run={false} />);
  expect(waiting.querySelectorAll(".end-skills[data-wait]").length).toBe(1);
  // A long name gets a third line of smaller type; no name is cut to one line.
  const long = await mount(<SkillRows plan={endPlan([], [{ skill: "a", n: 1 }], now, now)} prog={{ cut: [0], stone: [0], shown: [true], done: true }} was={now} now={now} skills={[{ id: "a", name: "Machine learning systems design and evaluation", color: "green" }] as never} run />);
  expect(long.querySelectorAll(".end-medal-name[data-long]").length).toBe(1);
});

// Tyler, 2026-11-20: "the alignment is off in some parts of the reward screen".
test("the ring's minutes and a result's mark are boxed to their dots, so what is centred is centred by eye", async () => {
  const body = await screen(today(4), today(14), { depth_days: 41 });
  // "14": a 1 has an empty column at its left and a 4 none at its right; untrimmed it stood half a dot right.
  expect(body.querySelector(".end-lap-n svg")?.getAttribute("viewBox")).toBe("1 0 10 7");
  // The calendar's sprite has three empty columns at its left and two at its right.
  expect(body.querySelector(".end-tally .end-mark")?.getAttribute("viewBox")).toBe("3 1 11 13");
  // "+41" ends in a 1, with an empty column at its right.
  expect(body.querySelector('.end-tally [data-key="depth"] .dot-number')?.getAttribute("viewBox")).toBe("0 0 16 7");
  const css = (await import("node:fs")).readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  // On the iPhone the rows and the results are as wide as Done, and the results stand in equal columns.
  expect(css).toContain(".phone .end-skills { width: 100%; }");
  expect(css).toMatch(/\.phone \.end-tally \{ display: grid; grid-auto-flow: column; grid-auto-columns: minmax\(0, 1fr\);[^}]*width: 100%;/);
});

// D336
test("the end screen's sounds are layered: a gem chimes on the ring, each stone taps on its line a step higher, the minutes tick as they count, each result after them", async () => {
  const { setPlayer, setSounds } = await import("../src/sfx");
  const heard: string[] = [];
  setSounds(true);
  setPlayer((id, o) => heard.push(`${id}${o.over ? "+" : ""}${Math.round(Math.log2(o.rate) * 12)}`));
  reduce = false;
  const now = today(16, { skills: [str("ai", 45, 3), str("learning", 9, 1)] });
  const was = today(4, { skills: [str("ai", 44, 2), str("learning", 6, 1)] });
  const body = await screen(was, now, { depth_days: 41 });
  for (let i = 0; i < 80 && !body.querySelector(".end-tally li:last-child:not([data-wait])"); i++) await act(async () => void (await new Promise((r) => setTimeout(r, 100))));
  setPlayer(null);
  const layers = heard.filter((h) => h.includes("+"));
  // The skill that went up has the big ring: its gem lands with a chime, and the new level's chime over it.
  expect(layers.slice(0, 2)).toEqual(["right+0", "goal+0"]);
  // Then the stones, a soft tap each as it lands on its line, each line a step higher: AI's two, Learning's five.
  expect(layers.slice(2, 9)).toEqual(["tap+0", "tap+0", "tap+2", "tap+2", "tap+2", "tap+2", "tap+2"]);
  // The minutes: a tick each, climbing; then the results' shines above them all.
  expect(layers.slice(9)).toEqual(["tap+1", "tap+2", "tap+3", "tap+4", "tap+5", "tap+6", "tap+7", "right+7", "tap+7", "right+9"]);
  // The jingle still plays on its own, and takes its turn as before.
  expect(heard).toContain("done0");
}, 15000);

test("the minutes' ticks climb a semitone each step the count shows, up to an octave, also in a long session that skips minutes (D336)", () => {
  for (const plan of [{ from: 0, to: 8, goal: 10 }, { from: 0, to: 66, goal: 20 }, { from: 12, to: 90, goal: 30 }]) {
    const ups = lapSteps(plan).slice(1).map((m) => lapTickUp(plan, m));
    expect(ups).toEqual(ups.map((_, i) => Math.min(12, i + 1)));
  }
});
