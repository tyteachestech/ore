import { describe, expect, test } from "bun:test";
import { orderQueue, pace, winFirst, type QueueEntry } from "../src/queue.ts";

let n = 0;
function e(over: Partial<QueueEntry>): QueueEntry {
  n++;
  return {
    id: `C${String(n).padStart(3, "0")}`, kind: "card", state: "live", content_type: "fact", item: "I1",
    skills: ["ai"], topics: ["t"], priority: "P1", question: "q", due: "2026-10-01T00:00:00.000Z",
    retrievability: 0.5, relearn: false, ...over,
  };
}
const ids = (q: QueueEntry[]) => q.map((x) => x.id);

describe("due queue ordering", () => {
  test("interleaves topics round-robin, each topic sorted by weight × (1 − R)", () => {
    const a1 = e({ id: "a1", topics: ["agents"], retrievability: 0.2 });
    const a2 = e({ id: "a2", topics: ["agents"], retrievability: 0.6 });
    const a3 = e({ id: "a3", topics: ["agents"], retrievability: 0.9 });
    const b1 = e({ id: "b1", topics: ["memory"], retrievability: 0.3 });
    const b2 = e({ id: "b2", topics: ["memory"], retrievability: 0.7 });
    const c1 = e({ id: "c1", topics: ["writing"], retrievability: 0.5 });
    expect(ids(orderQueue([a3, b2, c1, a1, b1, a2]))).toEqual(["a1", "b1", "c1", "a2", "b2", "a3"]);
  });

  test("priority weight dominates retrievability; ties broken by priority", () => {
    const p3low = e({ id: "p3", priority: "P3", topics: ["x"], retrievability: 0 }); // 1 × 1 = 1
    const p1mid = e({ id: "p1", priority: "P1", topics: ["x"], retrievability: 0.5 }); // 3 × .5 = 1.5
    expect(ids(orderQueue([p3low, p1mid]))).toEqual(["p1", "p3"]);
    // equal score 1.0: P2 at R=.5 vs P3 at R=0 → P2 first under the tie
    const p2tie = e({ id: "p2", priority: "P2", topics: ["y"], retrievability: 0.5 });
    const p3tie = e({ id: "p3b", priority: "P3", topics: ["y"], retrievability: 0 });
    expect(ids(orderQueue([p3tie, p2tie]))).toEqual(["p2", "p3b"]);
  });

  test("definitions from one source stay together; same-topic concepts adjacent", () => {
    const d1 = e({ id: "d1", content_type: "definition", item: "SRC", topics: ["agents"], retrievability: 0.1 });
    const d2 = e({ id: "d2", content_type: "definition", item: "SRC", topics: ["agents"], retrievability: 0.95 });
    const d3 = e({ id: "d3", content_type: "definition", item: "SRC", topics: ["memory"], retrievability: 0.9 });
    const k1 = e({ id: "k1", content_type: "concept", topics: ["memory"], retrievability: 0.2 });
    const k2 = e({ id: "k2", content_type: "concept", topics: ["memory"], retrievability: 0.99 });
    const f1 = e({ id: "f1", content_type: "fact", topics: ["agents"], retrievability: 0.3 });
    const q = ids(orderQueue([d2, k2, f1, d3, k1, d1]));
    expect(q).toEqual(["d1", "d3", "d2", "k1", "k2", "f1"]);
    const pos = (id: string) => q.indexOf(id);
    expect(Math.abs(pos("k1") - pos("k2"))).toBe(1);
    expect([pos("d1"), pos("d2"), pos("d3")].sort()).toEqual([0, 1, 2]);
  });

  test("relearn passes last", () => {
    const due = e({ id: "due", retrievability: 0.5 });
    const draft = e({ id: "draft", state: "draft", due: null, retrievability: 0 });
    const relearn = e({ id: "relearn", retrievability: 0, relearn: true });
    expect(ids(orderQueue([relearn, due, draft]))).toEqual(["draft", "due", "relearn"]);
  });
});

describe("a session opens on a likely recall (D176)", () => {
  const facts = (rs: number[]) => rs.map((retrievability, i) => e({ id: `f${i}`, topics: [`t${i}`], retrievability }));
  test("the likeliest recall among the first ten comes first; the rest keep their order", () => {
    const q = facts([0.2, 0.3, 0.9, 0.4]);
    expect(ids(winFirst(q))).toEqual(["f2", "f0", "f1", "f3"]);
  });
  test("a likelier card further down than ten stays where it is", () => {
    const q = facts([0.2, 0.25, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.99]);
    expect(ids(winFirst(q))[0]).toBe("f2");
    expect(ids(winFirst(q))[10]).toBe("f10");
  });
  test("a card served in a block stays in its block", () => {
    const k1 = e({ id: "k1", content_type: "concept", topics: ["memory"], retrievability: 0.2 });
    const k2 = e({ id: "k2", content_type: "concept", topics: ["memory"], retrievability: 0.95 });
    const f = e({ id: "f", topics: ["x"], retrievability: 0.6 });
    expect(ids(winFirst([k1, k2, f]))).toEqual(["f", "k1", "k2"]);
  });
  test("already the likeliest, or nothing to choose from: unchanged", () => {
    const q = facts([0.9, 0.3]);
    expect(winFirst(q)).toBe(q);
    expect(winFirst([])).toEqual([]);
  });
});

describe("never more than two likely misses in a row (D360)", () => {
  const facts = (rs: number[]) => rs.map((retrievability, i) => e({ id: `f${i}`, topics: [`t${i}`], retrievability }));
  test("after two likely misses the next likely recall is brought forward; everything else keeps its order", () => {
    const q = facts([0.2, 0.3, 0.35, 0.4, 0.45, 0.7, 0.8, 0.9]);
    expect(ids(pace(q))).toEqual(["f0", "f1", "f5", "f2", "f3", "f6", "f4", "f7"]);
  });
  test("with no likely recall left the misses run on: nothing is dropped or held back", () => {
    const q = facts([0.2, 0.3, 0.35, 0.7, 0.4, 0.45, 0.3]);
    expect(ids(pace(q))).toEqual(["f0", "f1", "f3", "f2", "f4", "f5", "f6"]);
  });
  test("a block (confusables, one source's definitions) is never split and never pulled forward", () => {
    const k = [0.2, 0.3, 0.4].map((retrievability, i) => e({ id: `k${i}`, content_type: "concept", topics: ["memory"], retrievability }));
    const d = [0.9, 0.95].map((retrievability, i) => e({ id: `d${i}`, content_type: "definition", item: "S1", topics: ["x"], retrievability }));
    const [a, b] = facts([0.3, 0.8]) as [QueueEntry, QueueEntry];
    // The block of three misses stays whole; the single likely recall comes right after it, ahead of the next miss.
    expect(ids(pace([...k, a, ...d, b]))).toEqual(["k0", "k1", "k2", "f1", "f0", "d0", "d1"]);
  });
  test("a queue that already breathes is returned as it is", () => {
    const q = facts([0.2, 0.7, 0.3, 0.3, 0.8]);
    expect(pace(q)).toBe(q);
    expect(pace([])).toEqual([]);
  });
  test("a block that opens on a miss is not interrupted: the pull waits for the next single miss", () => {
    const [m0, m1, m2, w] = facts([0.2, 0.3, 0.35, 0.8]) as [QueueEntry, QueueEntry, QueueEntry, QueueEntry];
    const d = [0.3, 0.9, 0.3].map((retrievability, i) => e({ id: `d${i}`, content_type: "definition", item: "S1", topics: ["x"], retrievability }));
    expect(ids(pace([m0, m1, ...d, m2, w]))).toEqual(["f0", "f1", "d0", "d1", "d2", "f2", "f3"]);
  });
  test("misses he has just made count: a fetch after two of them opens on a likely recall", () => {
    const q = facts([0.2, 0.3, 0.7]);
    expect(ids(pace(q, 2))).toEqual(["f2", "f0", "f1"]);
    expect(ids(pace(q, 1))).toEqual(["f0", "f2", "f1"]);
  });
  test("a backlog of 40,000 misses is ordered in well under a second", () => {
    const q = Array.from({ length: 40_000 }, (_, i) => e({ id: `m${i}`, topics: [`t${i}`], retrievability: 0.1 }));
    const t0 = performance.now();
    pace(q);
    expect(performance.now() - t0).toBeLessThan(500);
  });
  test("the opening win counts: it is not followed by a third thing moved for nothing", () => {
    const q = winFirst(facts([0.2, 0.3, 0.9, 0.4, 0.7]));
    expect(ids(pace(q))).toEqual(["f2", "f0", "f1", "f4", "f3"]);
  });
});
