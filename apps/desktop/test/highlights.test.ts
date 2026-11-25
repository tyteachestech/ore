import { afterEach, expect, test } from "bun:test";
import { highlights } from "../src/highlights";
import type { Annotation } from "../src/ore";
import type { Forget } from "../src/util";

// One source's highlights as the Reader holds them (highlights.ts): the stand-in id a new highlight has until its
// save lands, every change he makes to one with a save that is slow or fails, and a read again that must not take
// any of it back. Headless: no page, no ranges; the Reader's part is the `page` it hands over.

// `whileOut` (ore.ts) lets go a frame after its write settles.
(globalThis as Record<string, unknown>).requestAnimationFrame ??= (fn: (t: number) => void) => setTimeout(() => fn(performance.now()), 0);

const ann = (id: string, over: Partial<Annotation> = {}): Annotation => ({ id, rev: 1, intent: "keep", exact: id, prefix: "", suffix: "", start: 0, end: 1, status: "open", ...over });
const tick = () => new Promise((r) => setTimeout(r, 0));

// Writes to one highlight queue under its id for the whole app (util.ts `inOrder`), so a write a test leaves out
// would hold the next test's: each test's library answers what is still out as it ends.
const libraries: { ok: (v?: unknown) => void }[][] = [];
afterEach(async () => {
  // Three rounds: a write let go may send the one waiting behind it.
  for (let round = 0; round < 3; round++, await tick()) libraries.flat().forEach((w) => w.ok(ann("left-out")));
  libraries.length = 0;
});

/** The store over a library whose commands land when the test lets each go. */
function open(list: Annotation[] = []) {
  const sent: { args: string; ok: (v?: unknown) => void; fail: (why: string) => void }[] = [];
  libraries.push(sent);
  const steps: { message: string; kind?: string; undo?: () => Promise<unknown>; redo?: () => Promise<unknown>; forgotten: boolean; held?: Promise<unknown> }[] = [];
  const page: string[] = [];
  const unsaved = new Map<string, { note: string; was: string }>();
  let landed = 0;
  const hl = highlights({
    run: <T,>(...args: string[]) => new Promise<T>((ok, fail) => sent.push({ args: args.join(" "), ok: (v) => ok(v as T), fail: (why) => fail(new Error(why)) })),
    show: () => {},
    landed: () => landed++,
    notify: (message, kind, undo, redo) => {
      const step: (typeof steps)[number] = { message, kind, undo, redo, forgotten: false };
      steps.push(step);
      return Object.assign(() => void (step.forgotten = true), { undo: () => {}, hold: (w: Promise<unknown>) => void (step.held = w) }) as Forget;
    },
    label: (i) => ({ keep: "Highlight", card: "Key point", question: "Question", apply: "Try it" })[i],
    page: (id) => ({ off: () => page.push(`off ${id}`), on: () => page.push(`on ${id}`) }),
    unsaved,
  });
  hl.read(list, false);
  const ids = () => hl.list().map((a) => a.id);
  /** The last command sent, which must be `args`; a write to a highlight goes out a moment after it is asked for. */
  const last = async (args: string) => {
    await tick();
    expect(sent.at(-1)?.args).toBe(args);
    return sent.at(-1)!;
  };
  return { hl, sent, steps, page, unsaved, landed: () => landed, ids, last, said: () => steps.map((s) => s.message) };
}

/** A highlight being made: its draft on the list, its save out. */
function making(t: ReturnType<typeof open>, tmp = "pending-1") {
  const seen: string[] = [];
  t.hl.create(["highlight", "src", "--exact=words"], ann(tmp, { rev: 0 }), {
    saved: (a, was) => seen.push(`saved ${a.id}${was ? " (was there)" : ""}, the list says ${t.ids().join()}`),
    shown: (a, existing) => seen.push(`shown ${a.id}${existing ? " existing" : ""}, the list says ${t.ids().join()}`),
    failed: (e) => seen.push(`failed: ${(e as Error).message}`),
  });
  return { seen, save: t.sent.at(-1)! };
}

test("a new highlight shows at once under a stand-in, and answers to either id once it is saved", async () => {
  const t = open([ann("a")]);
  const { seen, save } = making(t);
  expect(t.ids()).toEqual(["a", "pending-1"]);
  expect(t.said()).toEqual(["Highlighted"]);
  expect(t.hl.same("pending-1", "b")).toBe(false);

  save.ok(ann("b", { rev: 1 }));
  await tick();
  // The page is told before the list swaps: it still says the stand-in, and either id finds it.
  expect(seen).toEqual(["saved b, the list says a,pending-1", "shown b, the list says a,b"]);
  expect(t.hl.idOf("pending-1")).toBe("b");
  expect(t.hl.same("pending-1", "b")).toBe(true);
  expect(t.hl.find("pending-1")?.id).toBe("b");
  expect(await t.hl.realId("pending-1")).toBe("b");
  expect(await t.hl.realId("a")).toBe("a");
  expect(t.hl.same(null, "a")).toBe(false);
  expect(t.hl.find(null)).toBeUndefined();
  expect(t.steps[0]!.forgotten).toBe(false);
});

test("a type and a note given before the save lands are kept through it, and written to the saved highlight in order", async () => {
  const t = open();
  const { save } = making(t);
  void t.hl.setIntent("pending-1", "card");
  void t.hl.setNote("pending-1", "why it matters");
  expect(t.hl.list()[0]).toMatchObject({ id: "pending-1", intent: "card", note: "why it matters" });
  await tick();
  expect(t.sent.length).toBe(1); // both wait for the highlight's id

  save.ok(ann("b"));
  await tick();
  // The library's copy has neither yet: his stay on screen.
  expect(t.hl.list()[0]).toMatchObject({ id: "b", intent: "card", note: "why it matters" });
  (await t.last("annotate b --intent card")).ok();
  await tick();
  (await t.last("annotate b --note=why it matters")).ok();
  await tick();
  expect(t.said()).toEqual(["Highlighted", "Changed to Key point", "Highlight note saved"]);
  expect(t.landed()).toBe(2);
});

test("⌘Z right after a drag takes the new highlight back once its save is in, whole, and ⇧⌘Z brings it back", async () => {
  const t = open();
  const { save } = making(t);
  const undo = t.steps[0]!.undo!();
  await tick();
  expect(t.ids()).toEqual(["pending-1"]); // nothing to take back until it is saved
  save.ok(ann("b"));
  await tick();
  expect(t.ids()).toEqual([]);
  expect(t.page).toEqual(["off b"]);
  (await t.last("annotate b --status deleted")).ok();
  await undo;

  const redo = t.steps[0]!.redo!();
  await tick();
  expect(t.ids()).toEqual(["b"]);
  expect(t.page).toEqual(["off b", "on b"]);
  (await t.last("annotate b --status open --intent keep --note=")).fail("offline");
  await expect(redo).rejects.toThrow("offline");
  await tick();
  // A Redo that fails leaves it gone again; the history says why.
  expect(t.ids()).toEqual([]);
});

test("a passage already highlighted gives that highlight back: no second one, no step, its new span taken", async () => {
  const t = open([ann("a", { intent: "question", note: "why?", start: 10, end: 20 })]);
  const { seen, save } = making(t);
  save.ok(ann("a", { start: 5, end: 20, exact: "longer", rev: 2 }));
  await tick();
  expect(seen).toEqual(["saved a (was there), the list says a,pending-1", "shown a existing, the list says a"]);
  expect(t.hl.list()[0]).toMatchObject({ id: "a", intent: "question", note: "why?", start: 5, exact: "longer", rev: 2 });
  expect(t.steps[0]!.forgotten).toBe(true);
});

test("a highlight whose save fails leaves the list and the history", async () => {
  const t = open([ann("a")]);
  const { seen, save } = making(t);
  save.fail("no such passage");
  await tick();
  expect(t.ids()).toEqual(["a"]);
  expect(seen).toEqual(["failed: no such passage"]);
  expect(t.steps[0]!.forgotten).toBe(true);
  await expect(t.hl.realId("pending-1")).rejects.toThrow("no such passage");
});

test("a type that fails to save goes back to what it was, off the history, and says why", async () => {
  const t = open([ann("a")]);
  let back: (() => void) | undefined;
  const done = t.hl.setIntent("a", "card", true, (b) => (back = b));
  expect(t.hl.list()[0]!.intent).toBe("card");
  expect(back).toBeDefined();
  (await t.last("annotate a --intent card")).fail("offline");
  await done;
  expect(t.hl.list()[0]!.intent).toBe("keep");
  expect(t.steps[0]).toMatchObject({ message: "Changed to Key point", forgotten: true });
  expect(t.steps[1]).toMatchObject({ kind: "error" });
});

test("a type's Undo writes the old type after it, and one that fails is the history's to report", async () => {
  const t = open([ann("a")]);
  void t.hl.setIntent("a", "question");
  const undo = t.steps[0]!.undo!();
  await tick();
  expect(t.hl.list()[0]!.intent).toBe("keep");
  (await t.last("annotate a --intent question")).ok(); // the Undo's write waits its turn
  await tick();
  (await t.last("annotate a --intent keep")).fail("offline");
  await expect(undo).rejects.toThrow("offline");
  await tick();
  expect(t.hl.list()[0]!.intent).toBe("question");
  expect(t.said()).toEqual(["Changed to Question"]); // no second step, no toast of its own
});

test("the same type again changes nothing on the history", async () => {
  const t = open([ann("a", { intent: "card" })]);
  void t.hl.setIntent("a", "card");
  expect(t.steps).toEqual([]);
  (await t.last("annotate a --intent card")).ok();
});

test("a note that fails to save is kept for the next time its highlight opens", async () => {
  const t = open([ann("a", { note: "old" })]);
  const done = t.hl.setNote("a", "new words");
  expect(t.hl.list()[0]!.note).toBe("new words");
  (await t.last("annotate a --note=new words")).fail("offline");
  await done;
  expect(t.hl.list()[0]!.note).toBe("old");
  expect(t.unsaved.get("a")).toEqual({ note: "new words", was: "old" });
  expect(t.steps.at(-1)).toMatchObject({ kind: "error" });
  expect(t.steps.at(-1)!.message).toContain("Your note is kept");

  // Saved the next time: the kept draft goes, and the step is on the history only once it has landed.
  const again = t.hl.setNote("a", "new words");
  expect(t.steps.length).toBe(1);
  (await t.last("annotate a --note=new words")).ok();
  await again;
  expect(t.unsaved.has("a")).toBe(false);
  expect(t.steps.at(-1)!.message).toBe("Highlight note saved");
  void t.steps.at(-1)!.undo!();
  expect(t.hl.list()[0]!.note).toBe("old");
});

test("a removed highlight goes at once with its step held for the write, and comes back if the write fails", async () => {
  const t = open([ann("a", { intent: "card", note: "why" }), ann("b")]);
  const gone = t.hl.remove("a");
  expect(t.ids()).toEqual(["b"]);
  expect(t.page).toEqual(["off a"]);
  const write = (await t.last("annotate a --status deleted"));
  expect(t.steps[0]).toMatchObject({ message: "Highlight removed", kind: "info" });
  expect(t.steps[0]!.held).toBeDefined();
  write.fail("offline");
  await gone;
  expect(t.ids()).toEqual(["b", "a"]);
  expect(t.page).toEqual(["off a", "on a"]);
  expect(t.steps[1]).toMatchObject({ kind: "error" });

  // Removed for good, then ⌘Z: it comes back as it went, type and note too.
  const again = t.hl.remove("a");
  (await t.last("annotate a --status deleted")).ok();
  await again;
  void t.steps[2]!.undo!();
  expect(t.hl.find("a")).toMatchObject({ intent: "card", note: "why" });
  await tick();
  (await t.last("annotate a --status open --intent card --note=why")).ok();
});

test("a fresh highlight he drops leaves no step behind", async () => {
  const t = open();
  const { save } = making(t);
  save.ok(ann("b"));
  await tick();
  void t.hl.remove("b", false);
  expect(t.ids()).toEqual([]);
  expect(t.steps).toHaveLength(1);
  expect(t.steps[0]).toMatchObject({ message: "Highlighted", forgotten: true });
  (await t.last("annotate b --status deleted")).ok();
});

test("a key point typed with nothing selected shows at once, then is the saved one with its step; a failed save takes it off", async () => {
  const t = open();
  const made = t.hl.point(["highlight", "src", "--at", "40", "--note=Say it aloud"], ann("pending-9", { intent: "card", point: true, note: "Say it aloud" }));
  expect(t.ids()).toEqual(["pending-9"]);
  expect(t.steps).toEqual([]);
  (await t.last("highlight src --at 40 --note=Say it aloud")).ok(ann("p", { intent: "card", point: true, note: "Say it aloud" }));
  expect((await made).id).toBe("p");
  expect(t.ids()).toEqual(["p"]);
  expect(t.said()).toEqual(["Key point added"]);
  // A read again before the page drew the swap lists it once.
  t.hl.read([ann("p", { intent: "card", point: true })], true);
  expect(t.ids()).toEqual(["p"]);

  const bad = t.hl.point(["highlight", "src", "--at", "50", "--note=x"], ann("pending-10", { point: true }));
  (await t.last("highlight src --at 50 --note=x")).fail("offline");
  await expect(bad).rejects.toThrow("offline");
  await tick();
  expect(t.ids()).toEqual(["p"]);
});

test("a looked-up mark shows at once and stays when its save fails", async () => {
  const t = open([ann("a")]);
  const done = t.hl.lookedUp("a");
  expect(t.hl.list()[0]!.looked_up).toBe(true);
  (await t.last("annotate a --looked-up")).fail("offline");
  await done;
  expect(t.hl.list()[0]!.looked_up).toBe(true);
  expect(t.steps).toEqual([]);
});

test("writes to one highlight go out one at a time, in the order he made them", async () => {
  const t = open([ann("a"), ann("b")]);
  const first = t.hl.annotate("a", "--intent", "card");
  const second = t.hl.annotate("a", "--note=why");
  void t.hl.annotate("b", "--intent", "question");
  await tick();
  // The second waits its turn; another highlight's write does not.
  expect(t.sent.map((s) => s.args)).toEqual(["annotate a --intent card", "annotate b --intent question"]);
  t.sent[0]!.fail("offline");
  await expect(first).rejects.toThrow("offline");
  await tick();
  // A write that failed still gives the next its turn, and counts as landed.
  expect(t.sent.map((s) => s.args)).toEqual(["annotate a --intent card", "annotate b --intent question", "annotate a --note=why"]);
  expect(t.landed()).toBe(1);
  t.sent[2]!.ok();
  await second;
  await tick();
  expect(t.landed()).toBe(2);
});

test("a read again keeps his copy of a highlight until every write to it has landed", async () => {
  const t = open([ann("a")]);
  void t.hl.setIntent("a", "card");
  void t.hl.setNote("a", "why");
  await tick();
  t.hl.read([ann("a")], true);
  expect(t.hl.list()[0]).toMatchObject({ intent: "card", note: "why" });
  t.sent[0]!.ok();
  await tick();
  // One of the two is still out.
  t.hl.read([ann("a", { intent: "card" })], true);
  expect(t.hl.list()[0]!.note).toBe("why");
  t.sent[1]!.ok();
  await tick();
  t.hl.read([ann("a", { intent: "card", note: "why", rev: 3 })], true);
  expect(t.hl.list()[0]!.rev).toBe(3);
});

test("a read again keeps a highlight still being made, and lists it once when its save has landed", async () => {
  const t = open([ann("a")]);
  const { save } = making(t);
  t.hl.read([ann("a")], true);
  expect(t.ids()).toEqual(["a", "pending-1"]);
  save.ok(ann("b"));
  await tick();
  t.hl.read([ann("a"), ann("b")], true);
  expect(t.ids()).toEqual(["a", "b"]);
});

// F620: the read was asked for before the save landed, so its answer doesn't have the highlight.
test("a highlight saved while the library was being read stays when that older read arrives", async () => {
  const t = open([ann("a")]);
  const since = t.hl.reading();
  const { save } = making(t);
  save.ok(ann("b", { exact: "words" }));
  await tick();
  t.hl.read([ann("a")], true, since);
  expect(t.ids()).toEqual(["a", "b"]);
  // So does a key point typed with nothing selected.
  const point = t.hl.point(["highlight", "src", "--at", "4", "--note=x"], ann("pending-2", { point: true }));
  (await t.last("highlight src --at 4 --note=x")).ok(ann("p", { point: true }));
  await point;
  t.hl.read([ann("a")], true, since);
  expect(t.ids()).toEqual(["a", "b", "p"]);
  // A read begun after they landed is the library's word: one it no longer has (removed on the phone) goes.
  t.hl.read([ann("a"), ann("p", { point: true })], true, t.hl.reading());
  expect(t.ids()).toEqual(["a", "p"]);
});

test("a highlight grown over a passage keeps its new span when an older read arrives", async () => {
  const t = open([ann("a", { start: 10, end: 20 })]);
  const since = t.hl.reading();
  const { save } = making(t);
  save.ok(ann("a", { start: 5, end: 20, exact: "longer", rev: 2 }));
  await tick();
  t.hl.read([ann("a", { start: 10, end: 20 })], true, since);
  expect(t.hl.list()[0]).toMatchObject({ start: 5, exact: "longer" });
});

// F621: a read that lands while the removal (or the ⌘Z that brings it back) is still saving.
test("a highlight he removed stays gone, and one ⌘Z brought back stays, when the library is read again before the write lands", async () => {
  const t = open([ann("a", { intent: "card" }), ann("b")]);
  const gone = t.hl.remove("a");
  t.hl.read([ann("a", { intent: "card" }), ann("b")], true, t.hl.reading());
  expect(t.ids()).toEqual(["b"]);
  (await t.last("annotate a --status deleted")).ok();
  await gone;

  void t.steps[0]!.undo!();
  expect(t.ids()).toEqual(["b", "a"]);
  t.hl.read([ann("b")], true, t.hl.reading()); // the library still has it deleted
  expect(t.ids()).toEqual(["b", "a"]);
  (await t.last("annotate a --status open --intent card --note=")).ok();
  await tick();
  t.hl.read([ann("b"), ann("a", { intent: "card", rev: 3 })], true, t.hl.reading());
  expect(t.hl.find("a")!.rev).toBe(3);
});

test("⌘Z right after a drag over a passage already highlighted leaves that older highlight alone", async () => {
  const t = open([ann("a", { note: "mine" })]);
  const { save } = making(t);
  const undo = t.steps[0]!.undo!(); // before the save is back
  save.ok(ann("a", { rev: 2 })); // the core gives back the one already there
  await undo;
  await tick();
  expect(t.ids()).toEqual(["a"]);
  expect(t.sent.map((s) => s.args)).toEqual(["highlight src --exact=words"]);
});

test("a highlight removed from the list while it is still saving is removed under its saved id", async () => {
  const t = open();
  const { save } = making(t);
  const gone = t.hl.remove("pending-1");
  await tick();
  expect(t.sent.map((s) => s.args)).toEqual(["highlight src --exact=words"]); // waits for its id
  save.ok(ann("b"));
  (await t.last("annotate b --status deleted")).ok();
  await gone;
  expect(t.ids()).toEqual([]);
  expect(t.steps.filter((s) => s.kind === "error")).toEqual([]);
});

test("a typed key point still saving takes a change under its saved id", async () => {
  const t = open();
  const made = t.hl.point(["highlight", "src", "--at", "3", "--note=a line"], ann("pending-1", { point: true, intent: "card", note: "a line" }));
  const save = t.sent.at(-1)!;
  void t.hl.setIntent("pending-1", "question");
  await tick();
  expect(t.sent.length).toBe(1); // waits for its id
  let closed = false;
  void t.hl.allSaved().then(() => (closed = true));
  await tick();
  expect(closed).toBe(false); // the closing count waits for the key point's save
  save.ok(ann("b", { point: true, intent: "card", note: "a line" }));
  await made;
  (await t.last("annotate b --intent question")).ok();
  await tick();
  expect(t.hl.list()[0]).toMatchObject({ id: "b", intent: "question" });
  expect(t.steps.filter((s) => s.kind === "error")).toEqual([]);
});

test("another source opened takes the library's list whole", () => {
  const t = open([ann("a")]);
  making(t);
  t.hl.read([ann("z")], false);
  expect(t.ids()).toEqual(["z"]);
});

test("the closing count waits for every change still saving, the ones begun meanwhile too", async () => {
  const t = open([ann("a")]);
  void t.hl.setIntent("a", "card");
  let done = false;
  void t.hl.allSaved().then(() => (done = true));
  void t.hl.setNote("a", "why");
  await tick();
  t.sent[0]!.ok();
  await tick();
  expect(done).toBe(false);
  (await t.last("annotate a --note=why")).fail("offline"); // a failed write has settled too
  await tick();
  await tick();
  expect(done).toBe(true);
});
