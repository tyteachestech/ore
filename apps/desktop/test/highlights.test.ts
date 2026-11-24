import { expect, test } from "bun:test";
import { highlights } from "../src/highlights";
import type { Annotation } from "../src/ore";

// One source's highlights as the Reader holds them (highlights.ts): the stand-in id a new highlight has until its
// save lands, the writes still out, and a read again that must not take either back. Headless: no page, no ranges.

const ann = (id: string, over: Partial<Annotation> = {}): Annotation => ({ id, rev: 1, intent: "keep", exact: id, prefix: "", suffix: "", start: 0, end: 1, status: "open", ...over });

/** A write that lands when the test says so. */
function later<T>() {
  let ok!: (v: T) => void, fail!: (e: unknown) => void;
  const promise = new Promise<T>((a, b) => ((ok = a), (fail = b)));
  return { promise, ok, fail };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

/** The store over a library whose `annotate` calls land when the test lets each go, in the order they were sent. */
function open(list: Annotation[] = []) {
  const sent: { id: string; args: string[]; ok: (v?: unknown) => void; fail: (e: unknown) => void }[] = [];
  const shown: string[][] = [];
  let landed = 0;
  const hl = highlights({
    annotate: <T,>(id: string, ...args: string[]) => {
      const w = later<T>();
      sent.push({ id, args, ok: (v) => w.ok(v as T), fail: w.fail });
      return w.promise;
    },
    show: (l) => shown.push(l.map((a) => a.id)),
    landed: () => landed++,
  });
  hl.read(list, false);
  return { hl, sent, shown, landed: () => landed };
}

test("a new highlight answers to its stand-in and, once saved, to its id", async () => {
  const { hl } = open([ann("a")]);
  const save = later<Annotation>();
  hl.set((l) => [...l, ann("pending-1")]);
  hl.make("pending-1", save.promise);
  expect(hl.idOf("pending-1")).toBe("pending-1");
  expect(hl.same("pending-1", "b")).toBe(false);

  save.ok(ann("b"));
  hl.made("pending-1", "b");
  // The page hasn't drawn the swap: the list still says the stand-in, and either id finds it.
  expect(hl.idOf("pending-1")).toBe("b");
  expect(hl.same("pending-1", "b")).toBe(true);
  expect(hl.find("b")?.id).toBe("pending-1");
  expect(hl.find("pending-1")?.id).toBe("pending-1");
  expect(await hl.realId("pending-1")).toBe("b");
  expect(await hl.realId("a")).toBe("a");
  expect(hl.same(null, "a")).toBe(false);
  expect(hl.find(null)).toBeUndefined();
});

test("a change to a highlight still being made waits for its id, and fails with its save", async () => {
  const { hl } = open();
  const save = later<Annotation>();
  hl.make("pending-1", save.promise);
  let id = "";
  void hl.realId("pending-1").then((r) => (id = r));
  await tick();
  expect(id).toBe("");
  save.ok(ann("b"));
  await tick();
  expect(id).toBe("b");

  const bad = later<Annotation>();
  hl.make("pending-2", bad.promise);
  bad.fail(new Error("no such passage"));
  expect(hl.realId("pending-2")).rejects.toThrow("no such passage");
});

test("writes to one highlight go out one at a time, in the order he made them", async () => {
  const { hl, sent, landed } = open([ann("a"), ann("b")]);
  const woken: Promise<unknown>[] = [];
  const first = hl.annotate((w) => woken.push(w), "a", "--intent", "card");
  const second = hl.annotate((w) => woken.push(w), "a", "--note", "why");
  void hl.annotate(() => {}, "b", "--intent", "question");
  await tick();
  // The second waits its turn; another highlight's write does not.
  expect(sent.map((s) => `${s.id} ${s.args.join(" ")}`)).toEqual(["a --intent card", "b --intent question"]);
  expect(woken).toEqual([first, second]);
  sent[0]!.fail(new Error("offline"));
  expect(first).rejects.toThrow("offline");
  await tick();
  // A write that failed still gives the next its turn, and counts as landed.
  expect(sent.map((s) => s.args.join(" "))).toEqual(["--intent card", "--intent question", "--note why"]);
  expect(landed()).toBe(1);
  sent[2]!.ok();
  await second;
  await tick();
  expect(landed()).toBe(2);
});

test("a read again keeps his copy of a highlight until every write to it has landed", async () => {
  const { hl, sent } = open([ann("a")]);
  hl.set((l) => l.map((a) => ({ ...a, intent: "card" as const, note: "why" })));
  void hl.annotate(() => {}, "a", "--intent", "card");
  void hl.annotate(() => {}, "a", "--note", "why");
  await tick();
  hl.read([ann("a")], true);
  expect(hl.list()[0]).toMatchObject({ intent: "card", note: "why" });
  sent[0]!.ok();
  await tick();
  // One of the two is still out.
  hl.read([ann("a", { intent: "card" })], true);
  expect(hl.list()[0]!.note).toBe("why");
  sent[1]!.ok();
  await tick();
  hl.read([ann("a", { intent: "card", note: "why", rev: 3 })], true);
  expect(hl.list()[0]!.rev).toBe(3);
});

test("a read again keeps a highlight still being made, and lists it once when its save has landed", () => {
  const { hl, shown } = open([ann("a")]);
  hl.set((l) => [...l, ann("pending-1")]);
  hl.make("pending-1", new Promise(() => {}));
  hl.read([ann("a")], true);
  expect(hl.list().map((a) => a.id)).toEqual(["a", "pending-1"]);
  // Saved, and the library read again before the page drew the swap.
  hl.made("pending-1", "b");
  hl.read([ann("a"), ann("b")], true);
  expect(hl.list().map((a) => a.id)).toEqual(["a", "b"]);
  expect(shown.at(-1)).toEqual(["a", "b"]);
});

test("another source opened takes the library's list whole", () => {
  const { hl } = open([ann("a")]);
  hl.set((l) => [...l, ann("pending-1")]);
  hl.read([ann("z")], false);
  expect(hl.list().map((a) => a.id)).toEqual(["z"]);
});

test("the closing count waits for every change still saving, the ones begun meanwhile too", async () => {
  const { hl } = open();
  const one = later<void>(), two = later<void>();
  void hl.track(one.promise);
  let done = false;
  void hl.allSaved().then(() => (done = true));
  void hl.track(two.promise).catch(() => {});
  one.ok();
  await tick();
  expect(done).toBe(false);
  two.fail(new Error("offline")); // a failed write has settled too
  await tick();
  expect(done).toBe(true);
});
