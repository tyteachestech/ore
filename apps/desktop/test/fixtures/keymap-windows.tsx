import { strict as assert } from "node:assert";
import { Window } from "happy-dom";
import { act } from "react";

const w = new Window();
const g = globalThis as Record<string, unknown>;
for (const k of ["window", "document", "HTMLElement", "Node", "MutationObserver", "navigator", "localStorage", "KeyboardEvent"] as const) g[k] = w[k];
g.IS_REACT_ACT_ENVIRONMENT = true;
const main: typeof import("../../src/keys") = await import("../../src/keys?" + "main-keymap-test");
const quiz: typeof import("../../src/keys") = await import("../../src/keys?" + "quiz-keymap-test");
const { createRoot } = await import("react-dom/client");
const root = createRoot(document.createElement("div"));
let shown = "";
let renders = 0;
function Probe() { shown = quiz.useKeymap().later; renders++; return null; }
const event = (combo: string) => {
  const parts = combo.split("+");
  return new w.KeyboardEvent("keydown", { code: parts.pop(), metaKey: parts.includes("Meta"), ctrlKey: parts.includes("Ctrl"), altKey: parts.includes("Alt") }) as unknown as KeyboardEvent;
};
const storage = (key: string | null, area = w.localStorage) => w.dispatchEvent(new w.StorageEvent("storage", { key, storageArea: area }));
try {
  await act(async () => root.render(<Probe />));
  assert.equal(quiz.is(event("Meta+KeyL"), "later"), true);
  await act(async () => {
    assert.equal(main.rebind("later", "Ctrl+Alt+KeyL"), null);
    storage("ore.keys");
  });
  assert.equal(quiz.is(event("Ctrl+Alt+KeyL"), "later"), true, "already-open quiz must match the new binding");
  assert.equal(quiz.is(event("Meta+KeyL"), "later"), false, "old binding must stop acting");
  assert.equal(shown, "Ctrl+Alt+KeyL", "subscribed labels must refresh too");
  const count = renders;
  await act(async () => { storage("ore.unrelated"); storage("ore.keys", w.sessionStorage); });
  assert.equal(renders, count, "unrelated storage must not notify subscribers");
  // A hidden webview may miss a storage event. Becoming focused must catch it up.
  main.resetKeys();
  await act(async () => { w.dispatchEvent(new w.Event("focus")); });
  assert.equal(shown, "Meta+KeyL");
  await act(async () => { main.rebind("later", "Ctrl+Alt+KeyL"); storage("ore.keys"); });
  await act(async () => { w.localStorage.removeItem("ore.keys"); storage("ore.keys"); });
  assert.equal(shown, "Meta+KeyL", "removing overrides restores defaults");
  await act(async () => { main.rebind("later", "Ctrl+Alt+KeyL"); storage("ore.keys"); });
  await act(async () => { w.localStorage.clear(); storage(null); });
  assert.equal(shown, "Meta+KeyL", "clear restores defaults in existing windows");
  console.log("PASS: existing windows, subscribed labels, focus catch-up, removal and clear");
} finally { await act(async () => root.unmount()); await w.happyDOM.abort(); }
