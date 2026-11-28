import { History } from "../src/history";
import { expect, test } from "bun:test";
import type { CardFull, DueEntry, SessionEnd, Today } from "../src/ore";
import type { Forget } from "../src/util";

// A review session (review-session.ts) through what the screen calls, with no screen: when one rating becomes the
// next exercise, with a save that is slow or fails, a second press, a close in the middle, and every step taken
// back. The order used to be kept by convention across seven handlers in Review.tsx (architecture reviews of
// 2026-11-13 and 2026-11-24); these pin it where it now lives. Review's journeys still check it through the screen.
const g = globalThis as Record<string, unknown>;
g.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const { ReviewSession } = await import("../src/review-session");
const { setPlayer } = await import("../src/sfx");
setPlayer(() => {});

const due = (id: string, over: Partial<DueEntry> = {}): DueEntry => ({ id, kind: "card", state: "live", item: "I", skills: [], question: "q", relearn: false, due: "2026-10-01T00:00:00Z", retrievability: 0.8, ...over });
const card = (id: string): CardFull => ({ id, kind: "card", state: "live", item: "I", question: "q", answer: "a", rubric: [] }) as CardFull;
const today = (over: Partial<Today> = {}): Today => ({ goal_minutes: 10, goal_ms: 600_000, active_ms: 0, counts: true, met: false, due: 3, exercises: 3, new_waiting: 0, skills: [], ...over }) as Today;
const receipt = { id: "S1", reviews: 1, kept: 1, rescued: 0 } as SessionEnd;
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

type Call = { args: string[]; land: (v?: unknown) => void; fail: (why: string) => void };
/** A session on a fake library and a fake history. Commands in `slow` wait until the test lands or fails them. */
async function open(o: { queue?: DueEntry[]; quick?: boolean; slow?: string[]; today?: Today; begin?: boolean; failReopen?: boolean; retired?: string[]; deleted?: string[] } = {}) {
  const calls: string[] = [];
  const waiting: Call[] = [];
  const slow = new Set(o.slow ?? []);
  let n = 0;
  const answer = (args: string[]): unknown => {
    const [a, b] = args;
    if (a === "session" && b === "start") return { id: "S1" };
    if (a === "session" && b === "end") return receipt;
    if (a === "today") return o.today ?? today();
    if (a === "due") return o.queue ?? [due("a"), due("b"), due("c")];
    if (a === "review" && !args.some((x) => x.startsWith("--undo"))) return { ts: `t${++n}` };
    if (a === "card" && b === "show") return o.retired?.includes(args[2]!) ? { ...card(args[2]!), state: "retired" } : card(args[2]!);
    return null;
  };
  const run = ((...args: string[]) => {
    calls.push(args.join(" "));
    if (o.failReopen && args[0] === "session" && args[1] === "reopen") return Promise.reject(new Error("reopen refused"));
    if (args[0] === "card" && args[1] === "show" && o.deleted?.includes(args[2]!)) return Promise.reject(new Error(`no card matches "${args[2]}"`));
    if (!slow.has(args[0]!)) return Promise.resolve(answer(args));
    return new Promise((ok, no) => waiting.push({ args, land: (v) => ok(v ?? answer(args)), fail: (why) => no(new Error(why)) }));
  }) as never;
  /** Every step put on the app history, oldest first: what ⌘Z and ⇧⌘Z would run. `gone`: taken off it. */
  const steps: { name: string; undo?: () => Promise<unknown>; redo?: () => Promise<unknown>; gone?: boolean }[] = [];
  const said: string[] = [];
  const pressed: unknown[] = [];
  let closed = 0, logged = 0;
  let shown: { id: string; shown: string } | null = null;
  const s = new ReviewSession<string>(!!o.quick, run);
  s.screen = {
    notify: (name, kind, undo, redo) => {
      const step: (typeof steps)[number] = { name, undo, redo };
      if (undo) steps.push(step);
      else said.push(`${kind === "error" ? "error: " : ""}${name}`);
      return Object.assign(() => void (step.gone = true), { undo: () => void undo?.(), hold() {} }) as Forget;
    },
    onClose: () => void closed++,
    onLogged: () => void logged++,
    shown: () => shown,
    unrated() {},
    press: (k) => void pressed.push(k),
  };
  const stop = o.begin === false ? () => {} : s.begin();
  await tick();
  return {
    s, calls, waiting, steps, said, pressed, stop,
    get closed() { return closed; },
    get logged() { return logged; },
    ids: () => s.queue?.map((e) => e.id) ?? null,
    on: (id: string | null, as = "as he had it") => void (shown = id ? { id, shown: as } : null),
    rate: (id: string, rating = 3) => s.rate({ card: card(id), rating, answer: "", grade: null, inHead: false, noteSeen: true }),
    wrote: (what: string) => calls.filter((c) => c.startsWith(what)),
  };
}

test("it starts a session, reads today and what is due, and names the session in every rating", async () => {
  const t = await open();
  expect(t.calls).toEqual(["session start", "today", "due --start"]);
  expect(t.ids()).toEqual(["a", "b", "c"]);
  await t.rate("a");
  expect(t.wrote("review a")[0]).toContain("--session=S1");
  expect(t.ids()).toEqual(["b", "c"]);
  expect([t.s.done, t.s.reviewed, t.s.canUndo, t.s.busy]).toEqual([1, 1, true, false]);
  expect(t.steps.map((x) => x.name)).toEqual(["Rating"]);
});

test("a rating given before the session has started waits for it, so it never goes in unnamed", async () => {
  const t = await open({ slow: ["session"], begin: false });
  t.s.begin();
  const rating = t.rate("a");
  await tick();
  expect(t.wrote("review")).toEqual([]);
  t.waiting[0]!.land();
  await rating;
  expect(t.wrote("review a")[0]).toContain("--session=S1");
});

test("a second press while a rating saves does nothing: one review is written, one step moves on", async () => {
  const t = await open({ slow: ["review"] });
  void t.rate("a");
  void t.rate("a", 4);
  void t.s.later();
  await tick();
  expect(t.wrote("review")).toHaveLength(1);
  expect(t.s.busy).toBe(true);
  // Slow, it is still on that exercise.
  expect(t.ids()).toEqual(["a", "b", "c"]);
  t.waiting[0]!.land();
  await tick();
  expect(t.ids()).toEqual(["b", "c"]);
  expect([t.s.done, t.s.busy]).toEqual([1, false]);
});

test("a rating that fails to save says why and leaves the exercise, the count and the time as they were", async () => {
  const t = await open({ slow: ["review"] });
  let saved = 0;
  const rating = t.s.rate({ card: card("a"), rating: 3, answer: "", grade: null, inHead: false, noteSeen: true, saved: () => void saved++ });
  await tick();
  t.waiting[0]!.fail("The library is locked.");
  await rating;
  expect(t.said).toEqual(["error: The library is locked."]);
  expect(t.ids()).toEqual(["a", "b", "c"]);
  expect([t.s.done, t.s.reviewed, t.s.activeMs, t.s.canUndo, t.s.busy, saved]).toEqual([0, 0, 0, false, false, 0]);
  expect(t.steps).toEqual([]);
  // He can rate it again.
  void t.rate("a");
  await tick();
  t.waiting[1]!.land();
  await tick();
  expect(t.ids()).toEqual(["b", "c"]);
});

test("an exercise retired or deleted elsewhere while it was on screen (an agent, the iPhone) leaves the session when rated: no raw error, no exercise that can't be rated", async () => {
  for (const [how, o] of [["retired", { retired: ["a"] }], ["deleted", { deleted: ["a"] }]] as const) {
    const t = await open({ slow: ["review"], ...o });
    const rating = t.rate("a");
    await tick();
    t.waiting[0]!.fail("card a is retired: `ore card restore a` puts it back in review");
    await rating;
    expect(t.said).toEqual(["This exercise was retired elsewhere, so it left this review."]);
    expect([how, t.ids()]).toEqual([how, ["b", "c"]]);
    expect([t.s.done, t.s.reviewed, t.s.canUndo, t.s.busy]).toEqual([0, 0, false, false]);
    expect(t.steps).toEqual([]);
  }
});

test("a miss comes back a few exercises on, and its second answer is one more step", async () => {
  const t = await open({ queue: [due("a"), due("b")] });
  await t.rate("a", 1);
  expect(t.s.queue?.map((e) => [e.id, e.relearn])).toEqual([["b", false], ["a", true]]);
  await t.rate("b");
  await t.rate("a", 1);
  expect(t.ids()).toEqual([]);
  expect(t.s.done).toBe(3);
});

test("⌘Z takes the newest rating back and shows that exercise again; ⇧⌘Z gives the same rating again", async () => {
  const t = await open();
  await t.rate("a");
  await t.rate("b", 2);
  await t.steps[1]!.undo!();
  expect(t.wrote("review b --undo")).toEqual(["review b --undo=t2"]);
  expect(t.ids()).toEqual(["b", "c"]);
  expect([t.s.done, t.s.reviewed]).toEqual([1, 1]);
  await t.steps[1]!.redo!();
  expect(t.wrote("review b --rating=2")).toHaveLength(2);
  expect(t.ids()).toEqual(["c"]);
  expect([t.s.done, t.s.reviewed]).toEqual([2, 2]);
  // Given again, its new line is the one a second ⌘Z takes back.
  await t.steps[1]!.undo!();
  expect(t.wrote("review b --undo").at(-1)).toBe("review b --undo=t3");
});

test("a ⌘Z pressed while a rating saves waits, and goes to the history once it has", async () => {
  const t = await open({ slow: ["review"] });
  void t.rate("a");
  await tick();
  const key = { key: "z", metaKey: true };
  t.s.holdUndo(key);
  t.s.holdUndo(key);
  expect(t.pressed).toEqual([]);
  t.waiting[0]!.land();
  await tick();
  expect(t.pressed).toEqual([key, key]);
});

test("the last rating ends the session on the end screen, and ⌘Z there opens it again on that exercise", async () => {
  const t = await open({ queue: [due("a")] });
  await t.rate("a");
  await tick();
  expect(t.wrote("session end")).toEqual(["session end S1"]);
  expect(t.s.end?.session).toBe(receipt);
  expect(t.closed).toBe(0);
  await t.steps[0]!.undo!();
  expect(t.calls.slice(-2)).toEqual(["review a --undo=t1", "session reopen S1"]);
  expect(t.s.end).toBeNull();
  expect(t.ids()).toEqual(["a"]);
  // Open again, leaving ends it again, with nothing rated: it just closes.
  await t.s.finish();
  expect(t.wrote("session end")).toHaveLength(2);
  expect(t.closed).toBe(1);
});

test("Esc while a rating saves does nothing; after it, the session ends once and closes", async () => {
  const t = await open({ slow: ["review"] });
  void t.rate("a");
  await tick();
  await t.s.finish(false);
  expect(t.wrote("session end")).toEqual([]);
  t.waiting[0]!.land();
  await tick();
  await t.s.finish(false);
  expect(t.wrote("session end")).toEqual(["session end S1"]);
  expect([t.closed, t.s.end]).toEqual([1, null]);
});

test("closed mid-save (a click away from the quick quiz): the session ends by its id, the rating still lands, and its ⌘Z then only changes the log", async () => {
  const t = await open({ slow: ["review"], quick: true });
  void t.rate("a");
  await tick();
  t.stop();
  t.s.leave();
  t.s.gone();
  expect(t.wrote("session end")).toEqual(["session end S1"]);
  t.waiting[0]!.land();
  await tick();
  expect(t.steps.map((x) => x.name)).toEqual(["Rating"]);
  t.waiting.length = 0;
  void t.steps[0]!.undo!();
  await tick();
  t.waiting[0]!.land();
  await tick();
  expect(t.waiting[0]!.args).toEqual(["review", "a", "--undo=t1"]);
  expect(t.logged).toBe(1);
  // Given again after it closed, it goes in with no session: that one has ended.
  void t.steps[0]!.redo!();
  await tick();
  expect(t.waiting[1]!.args.some((a) => a.startsWith("--session"))).toBe(false);
});

test("closed before the session began: it ends at once, by its id, when it has", async () => {
  const t = await open({ slow: ["session"], begin: false });
  const stop = t.s.begin();
  stop();
  t.s.leave();
  t.waiting[0]!.land();
  await tick();
  expect(t.calls).toEqual(["session start", "session end S1"]);
});

test("left before rating anything: it closes with no end screen, and with nothing due it says why", async () => {
  const t = await open();
  await t.s.finish();
  expect([t.closed, t.s.end, t.said]).toEqual([1, null, []]);
  const none = await open({ queue: [], today: today({ due: 0, exercises: 4 }) });
  await tick();
  expect(none.closed).toBe(1);
  expect(none.said).toEqual(["All caught up. Nothing is due right now."]);
  // The quick quiz says so in its window and waits for Esc.
  const quick = await open({ queue: [], quick: true });
  await tick();
  expect([quick.closed, quick.wrote("session end")]).toEqual([0, []]);
});

test("Later puts the exercise at the end and records nothing; ⌘Z brings it back as he had it, its clock going on", async () => {
  const t = await open();
  t.on("a", "half typed");
  expect(t.s.later()).toBe(true);
  expect(t.ids()).toEqual(["b", "c", "a"]);
  expect(t.wrote("review")).toEqual([]);
  expect([t.s.done, t.s.reviewed, t.s.activeMs]).toEqual([0, 0, 0]);
  await t.steps[0]!.undo!();
  expect(t.ids()).toEqual(["a", "b", "c"]);
  expect(t.s.takeRestored("a")).toBe("half typed");
  expect(t.s.takeRestored("a")).toBeNull();
  await t.steps[0]!.redo!();
  expect(t.ids()).toEqual(["b", "c", "a"]);
  // No exercise on screen to put off (still loading, its editor open): nothing happens.
  t.on(null);
  expect(t.s.later()).toBe(false);
});

test("Later on every exercise left ends the session with them still due; ⌘Z opens it again on the last", async () => {
  const t = await open({ queue: [due("a"), due("b")] });
  await t.rate("a");
  t.on("b");
  expect(t.s.later()).toBe(true);
  await tick();
  expect(t.s.end).not.toBeNull();
  expect(t.ids()).toEqual(["b"]);
  await t.steps[1]!.undo!();
  expect(t.calls.at(-1)).toBe("session reopen S1");
  expect(t.s.end).toBeNull();
});

test("a Later whose exercise has left the session leaves the history, and the press goes on to the step before", async () => {
  const t = await open();
  t.on("a");
  t.s.later();
  t.s.stillDue(new Set(["b", "c"]), true, false);
  expect(t.ids()).toEqual(["b", "c"]);
  await t.steps[0]!.undo!();
  await tick();
  expect(t.steps[0]!.gone).toBe(true);
  expect(t.pressed).toEqual(["undo"]);
});

test("an exercise retired since stays out when an older rating is taken back", async () => {
  const t = await open();
  await t.rate("a");
  expect(await t.s.retire({ id: "b", state: "live" }, false)).toBe(true);
  expect(t.ids()).toEqual(["c"]);
  expect(t.steps.map((x) => x.name)).toEqual(["Rating", "Exercise retired"]);
  await t.steps[0]!.undo!();
  expect(t.ids()).toEqual(["a", "c"]);
  // Restored, it comes back in a later review, not into this session.
  await t.steps[1]!.undo!();
  expect(t.wrote("card restore")).toEqual(["card restore b --state=live"]);
});

test("the day's goal closing is said once and the session goes on; taking that rating back opens it again", async () => {
  const t = await open({ today: today({ goal_ms: 1, active_ms: 0 }) });
  t.s.clock(5000);
  await t.rate("a");
  expect(t.s.goalSaid).toBe(true);
  expect(t.ids()).toEqual(["b", "c"]);
  expect(t.wrote("session end")).toEqual([]);
  // The next rating takes the note down, and it is not said again.
  await t.rate("b");
  expect(t.s.goalSaid).toBe(false);
  await t.steps[1]!.undo!();
  await t.steps[0]!.undo!();
  expect(t.s.activeMs).toBe(0);
  t.s.clock(5000);
  await t.rate("a");
  expect(t.s.goalSaid).toBe(true);
});

test("a goal that closes on a miss gets one likely recall first (D177); the quick quiz ends at its goal", async () => {
  const t = await open({ today: today({ goal_ms: 1 }), queue: [due("a"), due("b", { retrievability: 0.5 }), due("c", { retrievability: 0.9 })] });
  t.s.clock(5000);
  await t.rate("a", 1);
  expect(t.s.goalSaid).toBe(false);
  expect(t.ids()).toEqual(["c", "b", "a"]);
  await t.rate("c");
  expect(t.s.goalSaid).toBe(true);

  const q = await open({ today: today({ goal_ms: 1 }), quick: true });
  q.s.clock(5000);
  await q.rate("a");
  await tick();
  expect(q.wrote("session end")).toEqual(["session end S1"]);
  expect(q.s.end).not.toBeNull();
});

test("one write at a time on the exercise on screen: an edit holds a rating off until it has saved", async () => {
  const t = await open();
  let done!: () => void;
  const edit = t.s.hold(() => new Promise<void>((r) => (done = r)));
  await t.rate("a");
  expect(t.wrote("review")).toEqual([]);
  expect(await t.s.hold(async () => {})).toBe(false);
  done();
  expect(await edit).toBe(true);
  await t.rate("a");
  expect(t.wrote("review")).toHaveLength(1);
});

test("the next exercise loads ahead and is used only when a rating or a Later moved on to it", async () => {
  const t = await open();
  t.s.loadAhead("b");
  t.s.loadAhead("b");
  expect(t.wrote("card show b")).toHaveLength(1);
  // Something else moved the session (an undo, an edit): it loads afresh.
  expect(t.s.takeAhead("b")).toBeUndefined();
  t.s.loadAhead("b");
  await t.rate("a");
  expect((await t.s.takeAhead("b"))?.id).toBe("b");
  expect(t.s.takeAhead("b")).toBeUndefined();
});

// Code review of #533: the held ⌘Z goes on as soon as the rating has landed, which can be before the screen has
// drawn the exercise after it. The exercise then comes back as the same entry, and a screen that only compared
// entries would leave it answered and marked, its rating gone.
test("an exercise ⌘Z brings back is a new showing, even when the screen never drew the one between", async () => {
  const t = await open({ slow: ["review"] });
  const shownAs = t.s.turn;
  void t.rate("a");
  await tick();
  t.s.holdUndo({ key: "z" });
  t.waiting[0]!.land();
  await tick();
  expect(t.pressed).toHaveLength(1);
  void t.steps[0]!.undo!();
  await tick();
  t.waiting[1]!.land();
  await tick();
  expect(t.ids()).toEqual(["a", "b", "c"]);
  expect(t.s.turn).toBe(shownAs + 2);
});

// F617
test("a rating's undo that arrives while another rating saves is refused, not counted as done", async () => {
  const t = await open({ slow: ["review"] });
  void t.rate("a");
  await tick();
  t.waiting[0]!.land();
  await tick();
  void t.rate("b");
  await tick();
  // Past Review's own keys (the palette open over it, the phone's shake): the history asks for a's rating back.
  expect(t.steps[0]!.undo!()).rejects.toThrow("Still saving. Try again in a moment.");
  expect(t.wrote("review a --undo")).toEqual([]);
  t.waiting[1]!.land();
  await tick();
  expect([t.s.done, t.s.reviewed]).toEqual([2, 2]);
});

// Use the real window history: its queued callbacks can run after a step entered Redo.
function withHistory(t: Awaited<ReturnType<typeof open>>) {
  const h = new History();
  t.s.screen.notify = (message, kind, undo, redo) => {
    const step = { message, undo: undo!, redo };
    if (undo) h.push(step);
    return Object.assign(() => h.forget(step), { undo: () => h.take(step), hold: (p: Promise<unknown>) => h.hold(step, p) });
  };
  const press = () => t.s.busy ? t.s.holdUndo({ key: "z", metaKey: true }) : h.undo();
  t.s.screen.press = press;
  return { h, press };
}

test("two Undos held during review saving can both be redone in the same session", async () => {
  const t = await open({ slow: ["review"] });
  const { h, press } = withHistory(t);
  void t.rate("a");
  await tick(); t.waiting[0]!.land(); await tick();
  void t.rate("b");
  await tick(); t.waiting[1]!.land(); await tick();
  press();
  await tick();
  press();
  t.waiting[2]!.land();
  await tick(); t.waiting[3]!.land(); await tick();
  expect(t.s.done).toBe(0);
  h.redo();
  await tick(); t.waiting[4]!.land(); await tick();
  h.redo();
  await tick();
  expect(t.waiting).toHaveLength(6);
  t.waiting[5]!.land(); await tick();
  expect(t.s.done).toBe(2);
  expect(t.ids()).toEqual(["c"]);
  expect(t.wrote("review").slice(-2).every((c) => c.includes("--session=S1"))).toBe(true);
  t.stop(); t.s.gone();
});

test("end-screen Undo stays removed when reopening fails and can be redone after recovery", async () => {
  const options = { queue: [due("a")], failReopen: true };
  const t = await open(options);
  const { h } = withHistory(t);
  await t.rate("a"); await tick();
  expect(t.s.end).not.toBeNull();
  t.s.undoLast(); await tick();
  expect([t.s.done, t.s.reviewed, t.s.canUndo, h.canUndo]).toEqual([0, 0, false, false]);
  expect(t.s.end).toBeNull();
  expect(t.ids()).toEqual(["a"]);
  t.s.undoLast(); await tick();
  expect(t.wrote("review a --undo")).toHaveLength(1);
  options.failReopen = false;
  h.redo(); await tick();
  expect(t.s.done).toBe(1);
  expect(t.wrote("session reopen")).toHaveLength(2);
  expect(t.wrote("session end")).toHaveLength(2);
  t.stop(); t.s.gone();
});

test("a session that can't be opened again after an end-screen Undo still takes his next rating, in no session (F618)", async () => {
  const options = { queue: [due("a")], failReopen: true };
  const t = await open(options);
  withHistory(t);
  await t.rate("a"); await tick();
  t.s.undoLast(); await tick();
  await t.rate("a"); await tick();
  const ratings = t.wrote("review a --rating");
  expect(ratings).toHaveLength(2);
  expect(ratings[1]).not.toContain("--session=");
  expect(t.s.done).toBe(1);
  t.stop(); t.s.gone();
});

test("time with Ore out of sight is not review time: an hour in the background adds nothing to the exercise's clock (F730)", async () => {
  const t = await open();
  const real = Date.now;
  let now = real();
  Date.now = () => now;
  try {
    t.s.clock();
    now += 20_000;
    t.s.away(true);
    now += 3_600_000;
    t.s.away(false);
    now += 10_000;
    await t.rate("a");
    expect(t.wrote("review")[0]).toContain("--elapsed-ms=30000");
    expect(t.s.activeMs).toBe(30_000);
    // Rated while still out of sight (a key from a script, the quick quiz closing): the time away so far is left out too.
    t.s.clock();
    now += 5_000;
    t.s.away(true);
    now += 600_000;
    await t.rate("b");
    expect(t.wrote("review")[1]).toContain("--elapsed-ms=5000");
    // The next exercise showed while he was away: its clock starts when he is back.
    t.s.clock();
    now += 600_000;
    t.s.away(false);
    now += 2_000;
    await t.rate("c");
    expect(t.wrote("review")[2]).toContain("--elapsed-ms=2000");
  } finally {
    Date.now = real;
  }
});

test("Review this source while its exercises are still being drafted says so, not that nothing is due (F734)", async () => {
  const { nothingDue } = await import("../src/review-session");
  const { drafting } = await import("../src/drafting");
  expect(nothingDue(null, null, "I")).toBe("Nothing from this source is due right now.");
  const done = drafting("I", new Promise<void>((r) => setTimeout(r, 5)));
  expect(nothingDue(null, null, "I")).toBe("This source’s exercises are still being drafted.");
  expect(nothingDue(null, null, "J")).toBe("Nothing from this source is due right now.");
  await done;
  // Drafted, or failed (which says so itself, with Try again): the plain line again.
  expect(nothingDue(null, null, "I")).toBe("Nothing from this source is due right now.");
  await drafting("I", Promise.reject(new Error("no"))).catch(() => {});
  expect(nothingDue(null, null, "I")).toBe("Nothing from this source is due right now.");
});
