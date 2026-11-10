import { afterAll, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act, useState } from "react";

const w = new Window();
const g = globalThis as Record<string, unknown>;
const KEYS = ["window", "document", "HTMLElement", "HTMLTextAreaElement", "Node", "ResizeObserver", "getComputedStyle", "navigator", "IS_REACT_ACT_ENVIRONMENT"] as const;
// Put back what was there, so the browser stand-ins don't leak into the test files run after this one.
const prior = Object.fromEntries(KEYS.map((k) => [k, g[k]]));
afterAll(() => KEYS.forEach((k) => (g[k] = prior[k])));
for (const k of KEYS.slice(0, -1)) {
  const v = (w as unknown as Record<string, unknown>)[k];
  g[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
g.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client");
const { Grow } = await import("../src/Grow");

// A field emptied by the app (a send) starts over as a new element, focus kept, so WebKit's undo stack for it
// goes with the old one and ⇧⌘Z can't redo the sent text into the next draft. One he empties himself stays,
// so ⌘Z still brings back what he deleted.
let clear: () => void = () => {};
function Field() {
  const [v, setV] = useState("");
  clear = () => setV("");
  return <Grow aria-label="f" value={v} onChange={(e) => setV(e.target.value)} />;
}

function mount() {
  const div = document.createElement("div");
  document.body.appendChild(div);
  const root = createRoot(div);
  act(() => root.render(<Field />));
  return { field: () => div.querySelector("textarea")!, done: () => (act(() => root.unmount()), div.remove()) };
}

/** Types into the field as a person does: the browser sets its value and fires input. */
function type(el: HTMLTextAreaElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")!.set!.call(el, value);
    el.dispatchEvent(new w.Event("input", { bubbles: true }) as unknown as Event);
  });
}

describe("Grow", () => {
  test("emptied by the app, the field starts over as a new element and keeps focus", () => {
    const m = mount();
    const was = m.field();
    was.focus();
    type(was, "First message");
    act(() => clear());
    expect(m.field()).not.toBe(was);
    expect(m.field().value).toBe("");
    expect(document.activeElement).toBe(m.field());
    m.done();
  });

  test("emptied by him, it stays the same element", () => {
    const m = mount();
    const was = m.field();
    was.focus();
    type(was, "Typo");
    type(was, "");
    expect(m.field()).toBe(was);
    expect(document.activeElement).toBe(was);
    m.done();
  });

  test("an empty field the app empties again stays", () => {
    const m = mount();
    const was = m.field();
    act(() => clear());
    expect(m.field()).toBe(was);
    m.done();
  });
});
