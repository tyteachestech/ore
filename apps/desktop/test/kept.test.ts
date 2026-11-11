// kept(): the drafts he typed and hasn't sent, in localStorage (util.ts).
import { afterAll, expect, test } from "bun:test";
import { Window } from "happy-dom";

const w = new Window();
const g = globalThis as Record<string, unknown>;
const KEYS = ["window", "document", "localStorage", "addEventListener"] as const;
const prior = Object.fromEntries(KEYS.map((k) => [k, g[k]]));
afterAll(() => KEYS.forEach((k) => (g[k] = prior[k])));
g.window = w;
g.document = w.document;
g.localStorage = w.localStorage;
g.addEventListener = w.addEventListener.bind(w);
// Its own copy of util.ts, whose page listeners go on this window (another test file may have loaded it already).
const { kept, flushKept, DRAFT_MS } = await import("../src/util?kept-test");

test("a draft kept before the store stamped its rows ({...draft, at}) still comes back", () => {
  const at = Date.now() - 1000;
  localStorage.setItem("t.old", JSON.stringify([["c1", { text: "half an answer", conf: 2, asked: "q", at }]]));
  const k = kept<{ text: string; conf?: number; asked: string }>("t.old");
  expect(k.get("c1")).toEqual({ text: "half an answer", conf: 2, asked: "q" });
  expect(k.at("c1")).toBe(at);
});

test("one older than a day reads as gone, without writing while it is read; the next write drops it", () => {
  const old = Date.now() - DRAFT_MS - 1000;
  localStorage.setItem("t.age", JSON.stringify([["a", { v: "stale", at: old }], ["b", { v: "fresh", at: Date.now() }]]));
  const k = kept<string>("t.age");
  const before = localStorage.getItem("t.age");
  expect(k.get("a")).toBeUndefined();
  expect(k.get("b")).toBe("fresh");
  expect(localStorage.getItem("t.age")).toBe(before);
  k.set("c", "new");
  flushKept();
  expect(JSON.parse(localStorage.getItem("t.age")!).map(([id]: [string]) => id).sort()).toEqual(["b", "c"]);
});

test("a write waits a moment, and goes at once as the app quits or the page goes", () => {
  const k = kept<string>("t.quit");
  k.set("x", "typed just now");
  expect(localStorage.getItem("t.quit")).toBeNull();
  w.dispatchEvent(new w.Event("beforeunload"));
  expect(JSON.parse(localStorage.getItem("t.quit")!)[0][1].v).toBe("typed just now");
});
