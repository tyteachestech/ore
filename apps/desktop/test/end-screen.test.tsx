import { afterEach, expect, jest, test } from "bun:test";
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
// A test that fails before it unmounts must not leave its screen (and its timers) running under the next file's
// tests: that made a note test fail whenever one here did (F91).
const open = new Set<() => Promise<void>>();
afterEach(async () => {
  jest.useRealTimers();
  reduce = false;
  for (const done of [...open]) await done();
});
async function mount(e: never, roll = 0) {
  const body = document.createElement("div");
  body.className = "review-body";
  document.body.appendChild(body);
  const root = createRoot(body);
  // One roll for every end screen here, so the mole's pun is the first of its kind (only while it mounts: ids elsewhere need real ones).
  const random = Math.random;
  Math.random = () => roll;
  try {
    await act(async () => root.render(<TooltipProvider><EndScreen end={e} skills={skills} onDone={() => {}} onAgain={() => {}} onTry={() => {}} /></TooltipProvider>));
  } finally {
    Math.random = random;
  }
  const q = (s: string) => body.querySelectorAll(s).length;
  const done = async () => { if (open.delete(done)) await act(async () => (root.unmount(), body.remove())); };
  open.add(done);
  return { q, body, done };
}
/** The mole is reacting to the day. These sessions cut a gem, which pleases him: the hop is a new level's alone (D258). */
const reacted = (body: HTMLElement, mood = "happy") => body.querySelector(".review-mole .mole")?.getAttribute("data-mood") === mood;

test("a session that filled the ring and cut a gem: the cart is there, the mole and the gem wait, then all of it settles", async () => {
  jest.useFakeTimers();
  // The roll picks the ending where he comes up out of the ground (the cart nap has its own test below).
  const s = await mount(end(["ai"]), 0.9);
  expect(s.q(".review-end.carted .cart-tip .cart")).toBe(1);
  expect(s.q(".review-mole .mole")).toBe(0);
  expect(s.q(".dot-ring .on")).toBe(0);
  expect(s.q(".review-cut > span[data-wait]")).toBe(1);
  // A clock the test turns by hand, so the gap between the mole coming up and its reaction is exact on any runner.
  let up = -1, react = -1;
  for (let t = 0; t < 6000 && !(react >= 0 && !s.q(".cart-tip")); t += 20) {
    await act(async () => void jest.advanceTimersByTime(20));
    if (up < 0 && s.q(".review-mole .mole")) up = t;
    if (up >= 0 && react < 0 && reacted(s.body)) react = t;
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
  expect(react - up).toBeGreaterThanOrEqual(540);
  expect(react - up).toBeLessThanOrEqual(580);
  await s.done();
}, 10_000);

test("the mole rides the cart in asleep, falls out onto the ring once it has gone, and covers for it (D255)", async () => {
  jest.useFakeTimers();
  const s = await mount(end(["ai"]));
  // Asleep on the load, his whole body; nobody on the ring yet.
  expect(s.body.querySelector(".cart-mole .mole")?.getAttribute("data-mood")).toBe("doze");
  expect(s.q(".cart-zzz")).toBe(1);
  expect(s.q(".review-mole .mole")).toBe(0);
  let awake = false, grounded = false;
  for (let t = 0; t < 6000 && s.q(".cart-tip"); t += 20) {
    await act(async () => void jest.advanceTimersByTime(20));
    // Awake in the air before he lands, and never two moles at once: while he is on the cart or in the air, his hole is empty.
    if (s.body.querySelector(".cart-mole .mole")?.getAttribute("data-mood") === "fall") awake = true;
    if (s.q(".cart-mole")) expect(s.body.querySelector(".review-mole .mole")?.getAttribute("data-mood") ?? "hole").toBe("hole");
    // He falls into his hole: under the dirt line nothing of him is drawn, so the ring never crosses his belly (F94).
    if (s.body.querySelector<HTMLElement>(".cart-ground")?.style.clipPath.startsWith("inset(")) grounded = true;
  }
  expect(awake).toBe(true);
  expect(grounded).toBe(true);
  // Down the hole, and up he pops: the same mole, and only then does he speak.
  expect(s.body.querySelector(".review-mole .mole")?.getAttribute("data-mood")).toBe("pop");
  expect(s.q(".end-says")).toBe(0);
  for (let i = 0; i < 200; i++) await act(async () => void jest.advanceTimersByTime(50));
  expect(s.body.querySelector(".end-says")!.textContent).toContain("Goal met. I supervised.");
  jest.useRealTimers();
  await s.done();
  // One ending in three with a cart he comes up out of the ground as before, and says his usual line.
  const plain = await mount(end(["ai"]), 0.9);
  expect(plain.q(".cart-tip .cart")).toBe(1);
  expect(plain.q(".cart-mole")).toBe(0);
  await plain.done();
});

test("the fall off the cart has weight: he is pressed short then pulled long, dives swept back, throws dirt, knocks the ring, and the cart hops as he leaves it", async () => {
  jest.useFakeTimers();
  const proto = w.Element.prototype as unknown as Record<string, unknown>, plain = proto.animate;
  const seen: { cls: string; keys: Record<string, string>[]; o: { composite?: string } }[] = [];
  proto.animate = function (this: Element, keys: Record<string, string>[], o: { composite?: string }) { seen.push({ cls: this.getAttribute("class") ?? this.tagName, keys, o }); return { cancel() {} }; };
  try {
    const s = await mount(end(["ai"]));
    let dived = false, dirt = 0;
    for (let t = 0; t < 6000 && s.q(".cart-tip"); t += 20) {
      await act(async () => void jest.advanceTimersByTime(20));
      if (s.body.querySelector(".cart-mole .mole")?.getAttribute("data-mood") === "dive") dived = true;
      dirt = Math.max(dirt, s.q(".cart-dirt"));
    }
    expect(dived).toBe(true);
    expect(dirt).toBeGreaterThanOrEqual(8);
    // Squash and stretch are on his body, inside the wrapper that places him: shorter than 1 along his length, then longer.
    const pulls = seen.filter((a) => a.cls === "cart-mole-body").flatMap((a) => a.keys.map((k) => Number(/scale\(([\d.]+), ([\d.]+)\)/.exec(k.transform!)![2])));
    expect(Math.min(...pulls)).toBeLessThan(0.9);
    expect(Math.max(...pulls)).toBeGreaterThan(1.15);
    // The cart's hop is added to its roll, never in place of it.
    expect(seen.some((a) => a.cls === "cart" && a.o.composite === "add" && a.keys.some((k) => k.transform === "translateY(-4px)"))).toBe(true);
    await s.done();
  } finally { proto.animate = plain; jest.useRealTimers(); }
});

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
  expect(reacted(still.body)).toBe(true);
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
  // The mole speaks (D243); the depth is a number in the row of results.
  expect(s.q(".end-says .says-line")).toBe(1);
  expect(s.body.querySelector('.end-tally [data-key="depth"]')!.textContent).toBe("+41days of memory");
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
  expect(none.q('.end-tally [data-key="depth"]')).toBe(0);
  await none.done();
});

test("the mole says one line at a session's end: typed out a letter at a time with his block, then it stays; under Reduce Motion it stands at once (D243, D245, D252)", async () => {
  jest.useFakeTimers();
  // No cart (the goal was met before), so the lines start turning at once.
  const e = end([], today(true, 600_000)) as unknown as { session: Record<string, unknown> };
  Object.assign(e.session, { depth_days: 41 });
  const s = await mount(e as never);
  const line = () => s.body.querySelector(".end-says .says-line");
  const typed = () => line()!.firstChild?.nodeType === 3 ? line()!.firstChild!.textContent : "";
  // He speaks once he has come up and cheered.
  expect(s.q(".end-says")).toBe(0);
  await act(async () => void jest.advanceTimersByTime(560));
  // The verdict first, and the whole line is in the page from its first letter: only the typed part shows,
  // the rest holds its place unseen, the block between them.
  expect(line()!.textContent).toBe("Gneiss work.");
  expect(typed()).toBe("");
  expect(s.q(".says[data-typing] .says-line > .says-block + .says-rest")).toBe(1);
  for (let i = 0; i < 4; i++) await act(async () => void jest.advanceTimersByTime(28));
  expect(typed()).toBe("Gnei");
  expect(s.body.querySelector(".says-rest")!.textContent).toBe("ss work.");
  for (let i = 0; i < 40 && s.q(".says[data-typing]"); i++) await act(async () => void jest.advanceTimersByTime(28));
  expect(typed()).toBe("Gneiss work.");
  // He says one line and it stays (D252): the numbers are the row's, not his.
  await act(async () => void jest.advanceTimersByTime(9000));
  expect(line()!.textContent).toBe("Gneiss work.");
  await s.done();
  reduce = true;
  const flat = await mount(e as never);
  // Reduce Motion: the line stands whole at once, nothing left to type.
  expect(flat.body.querySelector(".end-says .says-line")!.firstChild!.textContent).toBe("Gneiss work.");
  expect(flat.q(".says[data-typing]")).toBe(0);
  reduce = false;
  jest.useRealTimers();
  // Under the emblem nothing of Ore's is left but the row of results (D252).
  expect(flat.q(".review-end > p, .review-end > .end-lines")).toBe(0);
  expect(flat.q(".review-end > .end-tally > li")).toBe(2);
  expect(flat.q(".review-end h2")).toBe(0);
  await flat.done();
});

test("the end screen is one emblem over one row of results (D242, D252): the gems sit inside the ring, the numbers stand under it in dots, and the quick quiz keeps its lines", async () => {
  reduce = true;
  const two = end(["ai", "ai"]) as unknown as { session: Record<string, unknown> };
  Object.assign(two.session, { depth_days: 41, depth_extra_days: 12 });
  const s = await mount(two as never);
  expect(s.q(".end-emblem .end-ring > .ring")).toBe(1);
  expect(s.q(".end-emblem .end-ring > .review-cut > span")).toBe(2);
  // One row, three at most, in one order: kept, the days they added, then the rarest thing (here the gems cut).
  const row = [...s.body.querySelectorAll(".end-emblem + .end-tally > li")];
  expect(row.map((li) => li.getAttribute("data-key"))).toEqual(["kept", "depth", "cut"]);
  // Each number is drawn in dots, and its text is the true number for a reader and for a test.
  expect(row.map((li) => li.querySelectorAll("b .dot-number circle").length > 5)).toEqual([true, true, true]);
  expect(row.map((li) => li.textContent)).toEqual(["5memories kept", "+41days of memory", "2gems cut"]);
  // Each result's mark is a shaded dot object on the number's own line (D259): a gem for memories kept, a calendar for the days added.
  expect(row.map((li) => li.querySelector(".end-tally-pair > .end-tally-mark + b") !== null)).toEqual([true, true, true]);
  expect(row.slice(0, 2).map((li) => li.querySelector(".end-mark")?.getAttribute("data-kind"))).toEqual(["gem", "calendar"]);
  expect(s.q('.end-tally [data-key="kept"] .end-mark circle')).toBeGreaterThan(60);
  // The marks loop, each its own way (D260): every dot of the gem takes a turn, and only the calendar's days.
  expect(s.q('.end-tally [data-key="kept"] .end-mark circle:not([data-turn])')).toBe(0);
  expect(s.q('.end-tally .end-mark[data-kind="calendar"] circle[data-turn]')).toBe(15);
  // The count is said once, and nothing rare is dressed as rare.
  expect(s.q(".review-kept")).toBe(0);
  expect(s.q(".end-tally [data-rare]")).toBe(0);
  // The gem's own hint names its skill, so no icon repeats it under the gem.
  expect(s.q(".review-cut-skill")).toBe(0);
  await s.done();
  // With no gem cut the ring holds nothing, and the row has what there is.
  const none = await mount(end([]));
  expect(none.q(".end-ring > :not(.ring)")).toBe(0);
  expect([...none.body.querySelectorAll(".end-tally > li")].map((li) => li.textContent)).toEqual(["5memories kept"]);
  await none.done();
  // The rarest thing takes the third place and wears its own colour: a new level its skill's, a memory pulled back the gold.
  const up = end(["ai"], { ...today(false, 0), skills: [{ skill: "ai", level: 1 }] } as never, { ...today(true, 600_000), skills: [{ skill: "ai", level: 2 }] } as never) as unknown as { session: Record<string, unknown> };
  Object.assign(up.session, { rescued: 2, depth_days: 400 });
  const u = await mount(up as never);
  const third = u.body.querySelector(".end-tally > li:nth-child(3)")!;
  expect([third.getAttribute("data-key"), third.getAttribute("data-rare"), third.getAttribute("data-color"), third.textContent]).toEqual(["level", "level", "purple", "2AI level"]);
  expect(u.body.querySelector('.end-tally [data-key="depth"]')!.textContent).toBe("+13months of memory");
  await u.done();
  const back = end([]) as unknown as { session: Record<string, unknown> };
  Object.assign(back.session, { rescued: 2 });
  const b = await mount(back as never);
  expect(b.body.querySelector('.end-tally [data-rare="rescued"]')!.textContent).toBe("2pulled back in time");
  await b.done();
  // A session of misses has no count to stand anywhere: the mole says why it was worth it (D62).
  const missed = end([]) as unknown as { session: Record<string, unknown> };
  missed.session.kept = 0;
  const m = await mount(missed as never);
  expect(m.q(".review-kept, .end-tally")).toBe(0);
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
  const base = { today: today(true, 600_000) as never, closed: false, short: false, ups: [], minutesLeft: null };
  const session = (o: Record<string, unknown>) => ({ id: "s", reviews: 8, kept: 5, rescued: 0, ...o }) as never;
  expect(endSays({ ...base, session: session({}) }).map((l) => l.text)).toEqual(["Gneiss work."]);
  expect(endSays({ ...base, closed: true, session: session({}) })[0]!.text).toBe("Goal met. You rock.");
  expect(endSays({ ...base, short: true, session: session({}) })[0]!.text).toBe("Seam’s empty. Today counts.");
  // No guilt for a session of misses, whatever else is true (D62).
  expect(endSays({ ...base, closed: true, session: session({ kept: 0 }) })[0]!.text).toBe("Schist happens. Every miss comes back sooner.");
  // Three lines at most (D247). The rare things lead, rarest first, each with its mark; days of memory keeps its place.
  const all = endSays({ ...base, session: session({ depth_days: 212, longest_days: 9, rescued: 2 }), ups: [{ skill: "ai", name: "AI", level: 3 }], minutesLeft: "4" });
  expect(all.map((l) => l.text)).toEqual(["AI hit level 3.", "9 days gone and you still had it.", "+7 months of memory. You dug that."]);
  expect(all.map((l) => l.rare?.kind)).toEqual(["level", "long", undefined]);
  expect(endSays({ ...base, session: session({ rescued: 2 }) }).map((l) => [l.text, l.rare?.kind])).toEqual([["2 pulled back just before you’d have lost them.", "rescued"], ["Gneiss work.", undefined]]);
  // The one number that needs explaining keeps its hint, and says what came after the goal (D246).
  expect(all[2]!.hint).toContain("added up");
  expect(endSays({ ...base, session: session({ depth_days: 41, depth_extra_days: 12 }) })[1]!.text).toBe("+41 days of memory, 12 of them extra. You dug that.");
  expect(endSays({ ...base, session: session({ depth_days: 212, depth_extra_days: 61 }) })[1]!.text).toBe("+7 months of memory, 2 months of it extra. You dug that.");
  expect(endSays({ ...base, session: session({ depth_days: 41, depth_extra_days: 41 }) })[1]!.text).toBe("+41 days of memory. You dug that.");
  // With nothing rare the verdict opens, picked by the roll; the same roll picks the same.
  const plain = (roll: number) => endSays({ ...base, roll, session: session({}), minutesLeft: "4" }).map((l) => l.text);
  expect(plain(0)).toEqual(["Gneiss work.", "4 min to today’s goal. Your call."]);
  expect(plain(0.9)).toEqual(["Don’t take that for granite.", "4 min to today’s goal. Your call."]);
  // His pose is for the line he says, sized to how rare it is (D258): the hop is a new level's alone.
  const { endMood } = await import("../src/end-says");
  const pose = (o: Parameters<typeof endSays>[0]) => endMood(endSays(o)[0], o);
  expect(pose({ ...base, ups: [{ name: "AI", level: 3 }], session: session({}) })).toBe("cheer");
  expect(pose({ ...base, session: session({ rescued: 2 }) })).toBe("proud");
  expect(pose({ ...base, session: session({ kept: 0 }) })).toBe("set");
  expect(pose({ ...base, session: session({ cut: ["ai"] }) })).toBe("happy");
  expect(pose({ ...base, closed: true, session: session({}) })).toBe("happy");
  expect(pose({ ...base, session: session({}) })).toBe("nod");
  // Off the cart he is already startled, so a long gap gets his nod; without the nap, the start.
  const gap = { ...base, session: session({ longest_days: 41 }) };
  expect([pose(gap), pose({ ...gap, napped: true })]).toEqual(["surprised", "nod"]);
  // Reduce Motion holds one pose for as long as the screen is up: a resting one, never a start or a frown.
  expect([endMood(endSays(gap)[0], { ...gap, still: true }), endMood(undefined, { ...base, session: session({ kept: 0 }), still: true })]).toEqual(["happy", "idle"]);
  // The quick quiz has no mole: its line for a session of misses stays in plain words.
  expect(endSays({ ...base, plain: true, session: session({ kept: 0 }) })[0]!.text).toBe("Every miss comes back sooner. That’s how they stick.");
  // The verdict is a pun, one of a few of its kind by the roll; every one for a session of misses says why it was worth it.
  const { PUNS } = await import("../src/end-says");
  expect(endSays({ ...base, roll: 0.5, session: session({}) })[0]!.text).toBe("Ore-some.");
  expect(endSays({ ...base, roll: 0.99, closed: true, session: session({}) })[0]!.text).toBe("Goal met. Mine blown.");
  expect(PUNS.missed.every((t) => t.includes("Every miss comes back sooner"))).toBe(true);
  // Fallen out of the cart asleep, he covers for it; a day with nothing left due still says it counts.
  expect(endSays({ ...base, napped: true, session: session({}) })[0]!.text).toBe("Wasn’t asleep. Supervising.");
  expect(endSays({ ...base, napped: true, closed: true, session: session({}) })[0]!.text).toBe("Goal met. I supervised.");
  expect(endSays({ ...base, napped: true, short: true, session: session({}) })[0]!.text).toBe("Seam’s empty. Today counts.");
  // Caught up short of the goal counts as the goal met: that line still wins, napped or not, as before the nap.
  expect(endSays({ ...base, closed: true, short: true, session: session({}) })[0]!.text).toBe(PUNS.closed[0]!);
  expect(endSays({ ...base, napped: true, closed: true, short: true, session: session({}) })[0]!.text).toBe("Goal met. I supervised.");
  // A session of misses opens with why it was worth it, whatever else is true (D62).
  expect(endSays({ ...base, session: session({ kept: 0, longest_days: 9 }), ups: [{ name: "AI", level: 3 }] })[0]!.verdict).toBe(true);
  // A gap under a week, and rescues that were most of the session, go unsaid.
  expect(endSays({ ...base, session: session({ longest_days: 3, rescued: 6 }) })).toHaveLength(1);
});

test("a rare line leads the mole's lines and wears its own mark (D247)", async () => {
  jest.useFakeTimers();
  const e = end([], today(true, 600_000)) as unknown as { session: Record<string, unknown> };
  Object.assign(e.session, { depth_days: 41, rescued: 2 });
  const s = await mount(e as never);
  await act(async () => void jest.advanceTimersByTime(560));
  const line = s.body.querySelector(".end-says .says-line")!;
  expect(line.textContent).toBe("2 pulled back just before you’d have lost them.");
  // The gold-rimmed gem, the drawing a won-back memory already has.
  expect(line.querySelectorAll(".says-mark .gem").length).toBe(1);
  jest.useRealTimers();
  await s.done();
});

test("then and now: his answer from weeks ago over today's, under the ring, and the mole points at it (D248)", async () => {
  jest.useFakeTimers();
  const e = end([], today(true, 600_000)) as unknown as { session: Record<string, unknown> };
  const then_ts = new Date(Date.now() - 29 * 864e5).toISOString();
  Object.assign(e.session, { depth_days: 41, then_now: { card: "c", question: "Why does testing beat rereading?", then_ts, then: "no idea", now: "Retrieval strengthens the memory itself" } });
  const s = await mount(e as never);
  const box = s.body.querySelector(".then-now")!;
  expect(box.querySelector(".then-now-q")!.textContent).toBe("Why does testing beat rereading?");
  expect([...box.querySelectorAll("dt, dd")].map((x) => x.textContent)).toEqual(["4 weeks ago", "no idea", "Today", "Retrieval strengthens the memory itself"]);
  await act(async () => void jest.advanceTimersByTime(560));
  expect(s.body.querySelector(".end-says .says-line")!.textContent).toBe("4 weeks back that one beat you. Read it now.");
  jest.useRealTimers();
  await s.done();
  // Most sessions have none, and then nothing stands there.
  const none = await mount(end([], today(true, 600_000)) as never);
  expect(none.q(".then-now")).toBe(0);
  await none.done();
});

test("the results land one after another and count up, and the mole speaks once the last is in (D252)", async () => {
  jest.useFakeTimers();
  // No cart (the goal was met before), so the row starts at once.
  const e = end([], today(true, 600_000)) as unknown as { session: Record<string, unknown> };
  Object.assign(e.session, { depth_days: 41, rescued: 2 });
  const s = await mount(e as never);
  const waiting = () => s.q(".end-tally > li[data-wait]");
  // All three hold their place from the start, so nothing under them moves as they land.
  expect(s.q(".end-tally > li")).toBe(3);
  await act(async () => void jest.advanceTimersByTime(1));
  expect(waiting()).toBe(2);
  await act(async () => void jest.advanceTimersByTime(320));
  expect(waiting()).toBe(1);
  await act(async () => void jest.advanceTimersByTime(320));
  expect(waiting()).toBe(0);
  // A number runs up from nothing in the dots; its text is the true number throughout.
  expect(s.body.querySelector('.end-tally [data-key="kept"] .sr-only')!.textContent).toBe("5");
  for (let i = 0; i < 60; i++) await act(async () => void jest.advanceTimersByTime(16));
  // A 5 in the ring's dots is 17 of them.
  expect(s.q('.end-tally [data-key="kept"] .dot-number circle')).toBe(17);
  jest.useRealTimers();
  await s.done();
});

test("the row of results (D252): kept, days of memory, then the rarest true thing; a session of misses has none", async () => {
  const { endTiles } = await import("../src/end-says");
  const session = (o: Record<string, unknown>) => ({ id: "s", reviews: 8, kept: 5, rescued: 0, ...o }) as never;
  const keys = (o: Record<string, unknown>, ups: { skill?: string; name: string; level: number }[] = []) => endTiles({ session: session(o), ups }).map((t) => `${t.key} ${t.value} ${t.label}`);
  expect(keys({})).toEqual(["kept 5 memories kept"]);
  expect(keys({ kept: 1, depth_days: 1 })).toEqual(["kept 1 memory kept", "depth +1 day of memory"]);
  // The third place goes to one thing: a level over a rescue over a long gap over the gems cut.
  const all = { depth_days: 212, longest_days: 9, rescued: 2, cut: ["ai", "ai"] };
  expect(keys(all, [{ skill: "ai", name: "AI", level: 3 }])).toEqual(["kept 5 memories kept", "depth +7 months of memory", "level 3 AI level"]);
  expect(keys(all)[2]).toBe("rescued 2 pulled back in time");
  expect(keys({ ...all, rescued: 0 })[2]).toBe("long 9 days since you saw one");
  expect(keys({ cut: ["ai"] })[1]).toBe("cut 1 gem cut");
  // A gap under a week, and rescues that were most of the session, take no place.
  expect(keys({ longest_days: 3, rescued: 6 })).toHaveLength(1);
  // The one number that needs explaining keeps its hint, and says what came after the goal (D246).
  const depth = endTiles({ session: session({ depth_days: 41, depth_extra_days: 12 }), ups: [] })[1]!;
  expect(depth.hint).toContain("added up");
  expect(depth.hint).toContain("12 days of it came after today’s goal");
  expect(endTiles({ session: session({ kept: 0, depth_days: 9 }), ups: [{ name: "AI", level: 3 }] })).toEqual([]);
  // Years keep their fraction, and one pulled back is "it".
  expect(endTiles({ session: session({ depth_days: 900 }), ups: [] })[1]).toMatchObject({ value: "+2.5", label: "years of memory" });
  expect(endTiles({ session: session({ rescued: 1 }), ups: [] })[1]!.hint).toContain("lose it");
});

test("the glint (D257): a light crosses the ring and the field behind it only when this session closed the goal, and each number once it has landed; Reduce Motion plays none", async () => {
  reduce = true;
  try {
    // The goal closed in this session: the ring, the field and the numbers all carry it.
    const closed = await mount(end([]));
    expect(closed.q(".ring.glint")).toBe(1);
    expect(closed.q(".end-emblem[data-glint]")).toBe(1);
    expect(closed.q(".end-tally .dot-number.glint")).toBe(closed.q(".end-tally .dot-number"));
    expect(closed.q(".end-tally .dot-number")).toBeGreaterThan(0);
    await closed.done();
    // The goal was already met before it: the numbers still land, but the ring and the field stay still.
    const met = await mount(end([], today(true, 600_000), today(true, 660_000)));
    expect(met.q(".ring.glint")).toBe(0);
    expect(met.q(".end-emblem[data-glint]")).toBe(0);
    await met.done();
  } finally {
    reduce = false;
  }
  const css = await Bun.file(new URL("../src/styles.css", import.meta.url)).text();
  // Once, never a loop, and off under Reduce Motion.
  expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.glint circle, \.end-emblem\[data-glint\]::after \{ animation: none; \} \}/);
  // The marks beside the numbers are the one loop, and they too stand still under Reduce Motion.
  expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{ \.end-tally li, \.end-tally \.end-mark circle \{ animation: none !important; \} \}/);
  for (const [rule] of css.matchAll(/[^{}]*glint[^{}]*\{[^{}]*animation:[^{}]*\}/g)) expect(rule).not.toContain("infinite");
});
