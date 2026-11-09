import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";

const w = new Window();
for (const k of ["window", "document", "HTMLElement", "Node", "getComputedStyle", "navigator"] as const) {
  const v = (w as unknown as Record<string, unknown>)[k];
  (globalThis as Record<string, unknown>)[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

/** Counts the observers made and still connected. */
const live = new Set<FakeObserver>();
class FakeObserver {
  watched = new Set<Element>();
  constructor() {
    live.add(this);
  }
  observe = (el: Element) => void this.watched.add(el);
  unobserve = (el: Element) => void this.watched.delete(el);
  disconnect = () => void live.delete(this);
}
(globalThis as Record<string, unknown>).IntersectionObserver = FakeObserver;

const { createRoot } = await import("react-dom/client");
const { OnScreen } = await import("../src/Lite");

// One observer per scrolling list: each time a list's container mounted again (a screen switch), its
// old observer stayed in a module map for good, holding the detached list.
test("a list's observer goes once its rows are gone", () => {
  for (let round = 0; round < 3; round++) {
    const list = document.createElement("div");
    list.style.overflowY = "auto";
    document.body.append(list);
    const root = createRoot(list);
    act(() => root.render(["a", "b"].map((id) => <div key={id} id={`row-${round}-${id}`}><OnScreen id={`row-${round}-${id}`}>{id}</OnScreen></div>)));
    expect(live.size).toBe(1);
    act(() => root.unmount());
    list.remove();
  }
  expect(live.size).toBe(0);
});
