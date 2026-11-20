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
const end = (cut: string[], before = today(false, 0), now = today(true, 600_000)) => ({ session: { id: "s", reviews: 5, kept: 5, rescued: 0, cut }, today: now, before }) as never;
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
    await act(async () => root.render(<TooltipProvider><EndScreen end={e} skills={skills} onDone={() => {}} onAgain={() => {}} /></TooltipProvider>));
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
  let up = -1, react = -1, cut = 0;
  for (let t = 0; t < 6000 && !(react >= 0 && !s.q(".cart-tip")); t += 20) {
    await act(async () => void jest.advanceTimersByTime(20));
    cut = Math.max(cut, s.q('.review-cut .gem[data-kind="cut"] rect'));
    if (up < 0 && s.q(".review-mole .mole")) up = t;
    if (up >= 0 && react < 0 && reacted(s.body)) react = t;
  }
  expect(s.q(".cart-tip")).toBe(0);
  expect(s.q(".cart-ore")).toBe(0);
  expect(s.q(".dot-ring .on")).toBe(30);
  // The stone that landed is cut where it stands: it ends as a gem of solid pixels (D239). Then it makes way
  // for the day's minutes in the ring's centre (D274).
  expect(cut).toBeGreaterThan(50);
  for (let t = 0; t < 3000 && !s.q(".end-ring > .end-lap"); t += 20) await act(async () => void jest.advanceTimersByTime(20));
  jest.useRealTimers();
  expect(s.q(".end-ring > .end-lap")).toBe(1);
  expect(s.q(".review-cut")).toBe(0);
  expect(s.body.querySelector(".end-lap-n")!.getAttribute("aria-label")).toBe("10 minutes today");
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

test("the fall off the cart has weight, and the bucket never turns through him: he lies along its tipped rim, is pressed short then pulled long, drops feet first, throws dirt, knocks the ring, and the cart hops as he leaves it", async () => {
  jest.useFakeTimers();
  const proto = w.Element.prototype as unknown as Record<string, unknown>, plain = proto.animate;
  const seen: { cls: string; keys: Record<string, string>[]; o: { composite?: string; duration?: number }; at: number }[] = [];
  let now = 0;
  proto.animate = function (this: Element, keys: Record<string, string>[], o: { composite?: string; duration?: number }) { seen.push({ cls: this.getAttribute("class") ?? this.tagName, keys, o, at: now }); return { cancel() {} }; };
  try {
    const s = await mount(end(["ai"]));
    const backed = s.q("#cart-solid") + s.q("#cart-solid-fine");
    let dived = false, dirt = 0;
    for (let t = 0; t < 6000 && s.q(".cart-tip"); t += 20) {
      await act(async () => void jest.advanceTimersByTime(20));
      now = t + 20;
      if (s.body.querySelector(".cart-mole .mole")?.getAttribute("data-mood") === "dive") dived = true;
      dirt = Math.max(dirt, s.q(".cart-dirt"));
    }
    expect(dived).toBe(true);
    expect(dirt).toBeGreaterThanOrEqual(8);
    // Squash and stretch are on his body, inside the wrapper that places him: shorter than 1 along his length, then longer.
    const pulls = seen.filter((a) => a.cls === "cart-mole-body").flatMap((a) => a.keys.map((k) => Number(/scale\(([\d.]+), ([\d.]+)\)/.exec(k.transform!)![2])));
    expect(Math.min(...pulls)).toBeLessThan(0.9);
    expect(Math.max(...pulls)).toBeGreaterThan(1.15);
    // F155: tipped, he lies along the bucket's rim at the bucket's own angle (58°) and slides
    // down it, so the bucket never turns through him; and his dots and the bucket's are backed, so neither shows through the other.
    const slide = seen.filter((a) => a.cls === "cart-mole" && a.keys.length > 13 && a.keys[0]!.transform!.includes("scale(0.45)"))[0]!;
    for (const k of slide.keys) expect(k.transform).toContain("rotate(58deg)");
    expect(backed).toBe(2);
    // His slide is over when the next move takes him, however short the pour: he never jumps the rest of the way.
    const next = seen.filter((a) => a.cls === "cart-mole" && a.at > slide.at)[0]!;
    expect(slide.at + slide.o.duration!).toBeLessThanOrEqual(next.at + 20);
    // The cart's hop is added to its roll, never in place of it.
    expect(seen.some((a) => a.cls === "cart" && a.o.composite === "add" && a.keys.some((k) => k.transform === "translateY(-4px)"))).toBe(true);
    // The load slides down the tipped bucket to its low lip before it falls, and the wheels lock before the cart has stopped.
    expect(seen.some((a) => a.cls.startsWith("cart-ore-in") && a.keys.length === 2 && a.keys[0]!.transform === "translate(0px, 0px)")).toBe(true);
    expect(seen.some((a) => a.cls === "cart-wheel" && a.keys.length === 3 && a.keys[1]!.transform === a.keys[2]!.transform)).toBe(true);
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
  const e = end(["ai", "ai"]) as unknown as { session: Record<string, unknown> };
  Object.assign(e.session, { grades: ["mended", "cut"], polished: ["ai"], depth_days: 41 });
  // The gems are cut in the ring before they make way for the minutes (D274), so they are read there.
  jest.useFakeTimers();
  const c = await mount(e as never, 0.9);
  let seams: number[] = [], n = 0, label: string | null = null;
  for (let t = 0; t < 8000 && !c.q(".end-lap"); t += 20) {
    await act(async () => void jest.advanceTimersByTime(20));
    const gems = [...c.body.querySelectorAll(".review-cut > span")];
    if (!gems.length) continue;
    n = gems.length;
    label = c.body.querySelector(".review-cut")!.getAttribute("aria-label");
    const now = gems.map((g) => g.querySelectorAll('rect[data-gold]').length);
    if (now.some(Boolean)) seams = now;
  }
  jest.useRealTimers();
  await c.done();
  expect(n).toBe(3);
  expect(seams[0]).toBeGreaterThan(0);
  expect(seams.slice(1)).toEqual([0, 0]);
  expect(label).toBe("2 became solid, 1 won back, 1 polished");
  reduce = true;
  const s = await mount(e as never);
  reduce = false;
  // The mole speaks (D243); the depth is a number in the row of results.
  expect(s.q(".end-says .says-line")).toBe(1);
  // The box is an outline with no tail (D266): nothing is drawn in it but the line.
  expect(s.q(".end-says svg.says-tail")).toBe(0);
  expect(s.body.querySelector('.end-tally [data-key="depth"]')!.textContent).toBe("+41days of memory");
  await s.done();
  // More gems than fit: the count covers the polished ones left out too.
  const many = end(Array(8).fill("ai")) as unknown as { session: Record<string, unknown> };
  Object.assign(many.session, { polished: ["ai", "ai"] });
  jest.useFakeTimers();
  const m = await mount(many as never, 0.9);
  let more: string | null = null;
  for (let t = 0; t < 8000 && !m.q(".end-lap"); t += 20) {
    await act(async () => void jest.advanceTimersByTime(20));
    more = m.body.querySelector(".review-cut > b")?.textContent ?? more;
  }
  jest.useRealTimers();
  expect(more).toBe("+2");
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
  // He speaks once he has come up and the results have landed.
  expect(s.q(".end-says")).toBe(0);
  // Step through the row as well as the mole: each React effect schedules the next result.
  for (let i = 0; i < 28; i++) await act(async () => void jest.advanceTimersByTime(20));
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
  expect(flat.q(".review-end > .end-tally > li")).toBe(1);
  expect(flat.q(".review-end h2")).toBe(0);
  await flat.done();
});

test("the end screen is one emblem over one row of results (D242, D252): the gems sit inside the ring, the numbers stand under it in dots, and the quick quiz keeps its lines", async () => {
  reduce = true;
  const two = end(["ai", "ai"]) as unknown as { session: Record<string, unknown> };
  Object.assign(two.session, { depth_days: 41, depth_extra_days: 12 });
  const s = await mount(two as never);
  expect(s.q(".end-emblem .end-ring > .ring")).toBe(1);
  // Settled, the ring holds the day's minutes; the gems were cut there first (D274).
  expect(s.q(".end-emblem .end-ring > .end-lap")).toBe(1);
  expect(s.q(".end-emblem .end-ring > .review-cut")).toBe(0);
  reduce = false;
  const first = await mount(two as never, 0.9);
  expect(first.q(".end-emblem .end-ring > .review-cut > span")).toBe(2);
  expect(first.q(".end-lap")).toBe(0);
  await first.done();
  reduce = true;
  // One row, two at most, in one order: the days the session added, then the gems it cut.
  const row = [...s.body.querySelectorAll(".end-emblem + .end-tally > li")];
  expect(row.map((li) => li.getAttribute("data-key"))).toEqual(["depth", "cut"]);
  // Each number is drawn in dots, and its text is the true number for a reader and for a test.
  expect(row.map((li) => li.querySelectorAll("b .dot-number circle").length > 5)).toEqual([true, true]);
  expect(row.map((li) => li.textContent)).toEqual(["+41days of memory", "2gems cut"]);
  // Each result's mark stands on the number's own line (D259): a calendar for the days added, a cut gem for the gems.
  expect(row.map((li) => li.querySelector(".end-tally-pair > .end-tally-mark + b") !== null)).toEqual([true, true]);
  expect(row[0]!.querySelector(".end-mark")?.getAttribute("data-kind")).toBe("calendar");
  // The calendar loops (D260): only its added days take a turn.
  expect(s.q('.end-tally .end-mark[data-kind="calendar"] circle[data-turn]')).toBe(15);
  // The count is said once, and nothing rare is dressed as rare.
  expect(s.q(".review-kept")).toBe(0);
  expect(s.q(".end-tally [data-rare]")).toBe(0);
  // The gem's own hint names its skill, so no icon repeats it under the gem.
  expect(s.q(".review-cut-skill")).toBe(0);
  await s.done();
  // With no gem cut the ring holds the minutes alone, and the row has what there is.
  const none = await mount(end([]));
  expect(none.q(".end-ring > :not(.ring):not(.end-lap)")).toBe(0);
  expect(none.q(".end-tally")).toBe(0);
  await none.done();
  // A new level stands on its skill's row under the ring, in the skill's colour, never in the row of results.
  const up = end(["ai"], { ...today(false, 0), skills: [{ skill: "ai", level: 1, solid: 19, next_level_at: 20 }] } as never, { ...today(true, 600_000), skills: [{ skill: "ai", level: 2, solid: 20, next_level_at: 45 }] } as never) as unknown as { session: Record<string, unknown> };
  Object.assign(up.session, { rescued: 2, depth_days: 400, kept_skills: [{ skill: "ai", n: 5 }] });
  const u = await mount(up as never);
  const reel = u.body.querySelector(".end-emblem + .end-skills + .end-tally")!.previousElementSibling!.querySelector(".end-skill[data-up]")!;
  expect([reel.getAttribute("data-color"), reel.textContent]).toEqual(["purple", "AILevel 1 → 2"]);
  expect([...u.body.querySelectorAll(".end-tally > li")].map((li) => li.textContent)).toEqual(["+13months of memory", "1gem cut"]);
  await u.done();
  const back = end([]) as unknown as { session: Record<string, unknown> };
  Object.assign(back.session, { rescued: 2 });
  const b = await mount(back as never);
  // Memories pulled back in time need a sentence, so they are never a number in the row; this session met the day's goal, so the mole says that.
  expect(b.q('.end-tally [data-rare="rescued"]')).toBe(0);
  expect(b.body.querySelector(".end-says")!.textContent).toContain("Goal met.");
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
  await act(async () => root.render(<TooltipProvider><EndScreen quick end={end(["ai"])} skills={skills} onDone={() => {}} onAgain={() => {}} /></TooltipProvider>));
  expect(body.querySelectorAll(".end-emblem").length).toBe(0);
  expect(body.querySelectorAll(".review-end > .review-cut").length).toBe(1);
  expect(body.querySelectorAll(".review-kept").length).toBe(1);
  // Its title says what was done, never a cheer.
  expect(body.querySelector("h2")!.textContent).toBe("Goal met");
  await act(async () => root.render(<TooltipProvider><EndScreen quick end={end(["ai"], today(true, 600_000))} skills={skills} onDone={() => {}} onAgain={() => {}} /></TooltipProvider>));
  expect(body.querySelector("h2")!.textContent).toBe("5 answered");
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
  expect(pose({ ...base, session: session({ kept: 0 }) })).toBe("nod");
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

test("a rare line leads the mole's lines, in words alone: no icon in his speech box (D247 as amended)", async () => {
  jest.useFakeTimers();
  const e = end([], today(true, 600_000)) as unknown as { session: Record<string, unknown> };
  // The rarest thing a number can't say is his to say: here the long gap.
  Object.assign(e.session, { depth_days: 41, rescued: 2, longest_days: 18 });
  const s = await mount(e as never);
  await act(async () => void jest.advanceTimersByTime(560));
  const line = s.body.querySelector(".end-says .says-line")!;
  expect(line.textContent).toBe("18 days gone and you still had it.");
  // Tyler, 2026-11-14: "remove the random ass icon in the text box".
  expect(line.querySelectorAll("svg, .gem, .skill-icon").length).toBe(0);
  // He comes up through a mound of dirt, drawn in front of him and solid, so nothing of him shows between its dots.
  const mound = s.body.querySelector(".end-emblem .review-mole .mole + .mole-mound")!;
  expect(mound.querySelectorAll("circle").length).toBeGreaterThan(100);
  expect(mound.querySelectorAll("circle.back").length).toBe(mound.querySelectorAll("circle:not(.back)").length);
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
  const e = end([], { ...today(true, 600_000), skills: [{ skill: "ai", level: 1 }] } as never, { ...today(true, 600_000), skills: [{ skill: "ai", level: 2 }] } as never) as unknown as { session: Record<string, unknown> };
  Object.assign(e.session, { depth_days: 41 });
  const s = await mount(e as never);
  const waiting = () => s.q(".end-tally > li[data-wait]");
  // A result holds its place from the start, so nothing under it moves as it lands.
  expect(s.q(".end-tally > li")).toBe(1);
  expect(waiting()).toBe(1);
  await act(async () => void jest.advanceTimersByTime(1));
  expect(waiting()).toBe(0);
  // A number runs up from nothing in the dots; its text is the true number throughout.
  expect(s.body.querySelector('.end-tally [data-key="depth"] .sr-only')!.textContent).toBe("+41");
  const early = s.q('.end-tally [data-key="depth"] .dot-number circle');
  for (let i = 0; i < 60; i++) await act(async () => void jest.advanceTimersByTime(16));
  expect(s.q('.end-tally [data-key="depth"] .dot-number circle')).toBeGreaterThan(early);
  jest.useRealTimers();
  await s.done();
});

test("the row of results (D252): days of memory, then the gems cut; a session of misses has none", async () => {
  const { endTiles } = await import("../src/end-says");
  const session = (o: Record<string, unknown>) => ({ id: "s", reviews: 8, kept: 5, rescued: 0, ...o }) as never;
  const keys = (o: Record<string, unknown>) => endTiles({ session: session(o) }).map((t) => `${t.key} ${t.value} ${t.label}`);
  // The memories kept are said above the row, skill by skill, so the row never counts them again.
  expect(keys({})).toEqual([]);
  expect(keys({ kept: 1, depth_days: 1 })).toEqual(["depth +1 day of memory"]);
  // A long gap and memories pulled back in time take no place: a number can't say them (Tyler, 2026-11-19).
  const all = { depth_days: 212, longest_days: 9, rescued: 2, cut: ["ai", "ai"] };
  expect(keys(all)).toEqual(["depth +7 months of memory", "cut 2 gems cut"]);
  expect(keys({ ...all, cut: [] })).toHaveLength(1);
  expect(keys({ cut: ["ai"] })).toEqual(["cut 1 gem cut"]);
  // The one number that needs explaining keeps its hint, and says what came after the goal (D246).
  const depth = endTiles({ session: session({ depth_days: 41, depth_extra_days: 12 }) })[0]!;
  expect(depth.hint).toContain("added up");
  expect(depth.hint).toContain("12 days of it came after today’s goal");
  expect(endTiles({ session: session({ kept: 0, depth_days: 9 }) })).toEqual([]);
  // Years keep their fraction.
  expect(endTiles({ session: session({ depth_days: 900 }) })[0]).toMatchObject({ value: "+2.5", label: "years of memory" });
});

test("the glint (D257): a light crosses the ring and the field behind it only when this session closed the goal, and each number once it has landed; Reduce Motion plays none", async () => {
  reduce = true;
  try {
    // The goal closed in this session: the ring, the field and the numbers all carry it.
    const days = end([]) as unknown as { session: Record<string, unknown> };
    Object.assign(days.session, { depth_days: 41 });
    const closed = await mount(days as never);
    expect(closed.q(".ring.glint")).toBe(1);
    expect(closed.q(".end-emblem[data-glint]")).toBe(1);
    expect(closed.q(".end-tally .dot-number.glint")).toBe(closed.q(".end-tally .count-up > .dot-number"));
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

test("D252: the mole starts typing only after the last result lands (F106)", async () => {
  jest.useFakeTimers();
  const e = end([], today(true, 600_000), { ...today(true, 600_000), caught_up: true, new_waiting: 7 }) as unknown as { session: Record<string, unknown> };
  Object.assign(e.session, { depth_days: 41, rescued: 2 });
  const s = await mount(e as never);
  // The line may reserve its space earlier; no visible letters may arrive while a tile is waiting.
  for (let elapsed = 0; elapsed < 1200; elapsed += 20) {
    const line = s.body.querySelector(".end-says .says-line");
    if (s.q(".end-tally > li[data-wait]")) expect([...line?.childNodes ?? []].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("")).toBe("");
    await act(async () => void jest.advanceTimersByTime(20));
  }
  expect(s.q(".end-tally > li[data-wait]")).toBe(0);
  expect([...s.body.querySelector(".end-says .says-line")!.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").length).toBeGreaterThan(0);
  await s.done();
});

test("D252: a caught-up session still names the new exercises held until tomorrow under the results", async () => {
  reduce = true;
  const e = end([], today(true, 600_000), { ...today(true, 600_000), caught_up: true, new_waiting: 7 }) as unknown as { session: Record<string, unknown> };
  Object.assign(e.session, { depth_days: 9 });
  const s = await mount(e as never);
  expect(s.body.querySelector(".end-tally + .quiz-faint")?.textContent).toContain("7");
  expect(s.body.querySelector(".end-tally + .quiz-faint")?.textContent).toMatch(/new|tomorrow/i);
  await s.done();
});

test("D255: the quick quiz never rides the cart even with ore and a gem", async () => {
  jest.useFakeTimers();
  const body = document.createElement("div"); document.body.append(body);
  const root = createRoot(body);
  try {
    await act(async () => root.render(<TooltipProvider><EndScreen quick end={end(["ai"])} skills={skills} onDone={() => {}} onAgain={() => {}} /></TooltipProvider>));
    expect(body.querySelectorAll(".cart-tip, .cart-mole, .review-mole")).toHaveLength(0);
    expect(body.querySelectorAll(".review-cut .gem")).toHaveLength(1);
  } finally { await act(async () => root.unmount()); body.remove(); }
});

test("D257: each result glints only after its own count finishes, in landing order", async () => {
  jest.useFakeTimers();
  const raf = globalThis.requestAnimationFrame, caf = globalThis.cancelAnimationFrame;
  const clock = jest.spyOn(performance, "now");
  let now = 0, id = 0;
  const frames = new Map<number, FrameRequestCallback>();
  clock.mockImplementation(() => now);
  globalThis.requestAnimationFrame = (fn) => (frames.set(++id, fn), id);
  globalThis.cancelAnimationFrame = (n) => void frames.delete(n);
  try {
    const e = end([], { ...today(true, 600_000), skills: [{ skill: "ai", level: 1 }] } as never, { ...today(true, 600_000), skills: [{ skill: "ai", level: 2 }] } as never) as unknown as { session: Record<string, unknown> };
    Object.assign(e.session, { depth_days: 41 });
    const s = await mount(e as never);
    const first = new Map<string, number>();
    for (now = 0; now <= 2000; now += 16) {
      await act(async () => {
        jest.advanceTimersByTime(16);
        const due = [...frames.values()]; frames.clear();
        for (const fn of due) fn(now);
      });
      const glints = [...s.body.querySelectorAll(".end-tally li:has(.dot-number.glint)")].map((el) => el.getAttribute("data-key")!);
      for (const key of glints) if (!first.has(key)) first.set(key, now);
      if (now < 600) expect(glints).toEqual([]);
    }
    expect([...first.keys()]).toEqual(["depth"]);
    expect(first.get("depth")!).toBeGreaterThanOrEqual(600);
    expect(s.q(".ring.glint, .end-emblem[data-glint]")).toBe(0); // goal was met before this session
    await s.done();
  } finally {
    globalThis.requestAnimationFrame = raf; globalThis.cancelAnimationFrame = caf;
    clock.mockRestore(); jest.useRealTimers();
  }
});

test("D258: then-and-now gets the curious pose on the mounted end screen, without a victory hop", async () => {
  jest.useFakeTimers();
  const e = end([], today(true, 600_000)) as unknown as { session: Record<string, unknown> };
  Object.assign(e.session, { then_now: { card: "c", question: "Why retrieval?", then_ts: new Date(Date.now() - 29 * 864e5).toISOString(), then: "No idea", now: "It strengthens recall" } });
  const s = await mount(e as never);
  await act(async () => void jest.advanceTimersByTime(560));
  expect(s.body.querySelector(".review-mole .mole")?.getAttribute("data-mood")).toBe("curious");
  await s.done();
});

// F138
test("on the full end screen the mole never says a number the row under the ring already shows", async () => {
  const { endSays, endTiles } = await import("../src/end-says");
  const base = { today: today(true, 600_000) as never, closed: false, short: false, ups: [], minutesLeft: null, row: true };
  const session = (o: Record<string, unknown>) => ({ id: "s", reviews: 8, kept: 5, rescued: 0, ...o }) as never;
  // A new level is the rarest thing a session has, so he says it, on the day the goal was met too; and never the days of memory.
  expect(endSays({ ...base, ups: [{ skill: "ai", name: "AI", level: 3 }], session: session({ depth_days: 30 }) })[0]!.text).toBe("AI hit level 3.");
  expect(endSays({ ...base, closed: true, ups: [{ skill: "ai", name: "AI", level: 3 }], session: session({ depth_days: 30 }) })[0]!.text).toBe("AI hit level 3.");
  expect(endSays({ ...base, closed: true, session: session({ depth_days: 30 }) })[0]!.text).toBe("Goal met. You rock.");
  // A long gap and memories pulled back are no longer numbers in the row (Tyler, 2026-11-19: "as a user idk what
  // 'day gap recalled' means"), so they are his to say, in a sentence.
  const gap = { ...base, session: session({ depth_days: 30, longest_days: 18 }) };
  expect(endTiles(gap).map((t) => t.key)).toEqual(["depth"]);
  expect(endSays(gap)[0]!.text).toBe("18 days gone and you still had it.");
  expect(endSays({ ...base, session: session({ rescued: 2 }) })[0]!.text).toBe("2 pulled back just before you’d have lost them.");
  // The session that met the day's goal says so in words, whatever else was rare.
  expect(endSays({ ...gap, closed: true })[0]!.text).toBe("Goal met. You rock.");
  expect(endSays({ ...base, closed: true, session: session({ rescued: 2 }) })[0]!.text).toBe("Goal met. You rock.");
  // The level leads a long gap.
  expect(endSays({ ...base, ups: [{ skill: "ai", name: "AI", level: 3 }], session: session({ longest_days: 18 }) })[0]!.text).toBe("AI hit level 3.");
  // Then and now is never in the row.
  expect(endSays({ ...base, closed: true, session: session({ longest_days: 18, then_now: { then_ts: new Date(Date.now() - 28 * 864e5).toISOString() } }) })[0]!.rare?.kind).toBe("then");
});

// F134
test("the memory line ends by saying in words when the next review falls for the rating in hand", async () => {
  const { Timeline } = await import("../src/Timeline");
  // Days are counted on the calendar, so the dates sit at noon: a minute past now is tomorrow in the day's last
  // minute, and "21 days" read 22 on a run at 23:59 (F398).
  const noon = new Date().setHours(12, 0, 0, 0);
  const at = (days: number) => new Date(noon + days * 864e5).toISOString();
  const history = { reviews: [{ ts: at(-9), rating: 3 }], next: { 1: at(0), 2: at(4), 3: at(21), 4: at(40) } } as never;
  const body = document.createElement("div");
  document.body.appendChild(body);
  const root = createRoot(body);
  const said = async (rating: 1 | 2 | 3 | 4) => {
    await act(async () => root.render(<TooltipProvider><Timeline history={history} rating={rating} /></TooltipProvider>));
    const el = body.querySelector(".timeline-next")!;
    return [el.textContent, el.getAttribute("aria-hidden")];
  };
  expect(await said(3)).toEqual(["next in 21 days", "true"]);
  expect(await said(4)).toEqual(["next in 1 month", "true"]);
  await act(async () => (root.unmount(), body.remove()));
});

// Tyler, 2026-11-19, of the try line: "i cant tell if its telling me what to do or something i already did", then
// "run it" to taking it off: the end screen closes the session, and a try has its own place on the skill page.
test("the end screen has no try line, even with a try open", async () => {
  reduce = true;
  const e = end([]) as unknown as Record<string, unknown>;
  e.next = { id: "t", item: "i", note: "Write an if-then plan for Thursday's recording", exact: "x", item_title: "If-then plans" };
  const s = await mount(e as never);
  expect(s.q(".review-try")).toBe(0);
  expect(s.body.textContent).not.toContain("if-then plan");
  await s.done();
  reduce = false;
});

// F413
test("a result's number never shows a minus on its first frame, and holds its final width as it runs up", async () => {
  const { countText } = await import("../src/Review");
  // The first frame's clock can read just before the count began.
  expect(countText("+3", -0.004)).toBe("+0");
  expect(countText("+3", 1.2)).toBe("+3");
  expect(countText("2.5", 0.5)).toBe("1.3");
  jest.useFakeTimers();
  const e = end([], today(true, 600_000) as never, today(true, 600_000) as never) as unknown as { session: Record<string, unknown> };
  Object.assign(e.session, { depth_days: 12 });
  const s = await mount(e as never);
  await act(async () => void jest.advanceTimersByTime(1));
  // "+0" on its way to "+12": the room is the final number's from the start, so the row never shifts.
  const sized = s.body.querySelector('.end-tally [data-key="depth"] .count-size .dot-number')!;
  expect(sized.getAttribute("viewBox")).toBe("0 0 17 7");
  jest.useRealTimers();
  await s.done();
});
