import { afterAll, expect, test } from "bun:test";
import { Window } from "happy-dom";

// Review closed while the screen behind it was still drawing (a source being read again): nothing there could take
// focus yet, so focus stayed on <body>, and when Try again came a moment later nothing put it there (master red
// after #585, F873). settleFocus waits for what it names, as it already did for one that left.
// The page's globals for this file only: put back after, so the files after it in the same run keep theirs.
const w = new Window();
const g = globalThis as Record<string, unknown>;
const keys = ["window", "document", "HTMLElement", "Element", "Node", "MutationObserver", "addEventListener", "removeEventListener"] as const;
const was = keys.map((k) => [k, Object.getOwnPropertyDescriptor(g, k)] as const);
for (const k of keys) {
  const v = (w as unknown as Record<string, unknown>)[k];
  g[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
afterAll(() => {
  for (const [k, d] of was) d ? Object.defineProperty(g, k, d) : delete g[k];
  void w.happyDOM.close();
});
const { settleFocus } = await import("../src/util");
const tick = () => new Promise((r) => setTimeout(r, 20));

test("nothing to focus as it closes: the control that comes within the wait takes focus", async () => {
  document.body.innerHTML = `<main class="main"><div class="reader">Loading…</div></main>`;
  expect(document.activeElement).toBe(document.body);
  settleFocus(() => document.querySelector<HTMLElement>("main button"));
  await tick();
  expect(document.activeElement).toBe(document.body);
  document.querySelector(".reader")!.innerHTML = `<button>Try again</button>`;
  await tick();
  expect(document.activeElement).toBe(document.querySelector("main button"));
});

test("a control he moved to meanwhile keeps focus", async () => {
  document.body.innerHTML = `<main class="main"><input id="his"><div class="reader"></div></main>`;
  settleFocus(() => document.querySelector<HTMLElement>(".reader button"));
  document.querySelector<HTMLElement>("#his")!.focus();
  document.querySelector(".reader")!.innerHTML = `<button>Try again</button>`;
  await tick();
  expect((document.activeElement as HTMLElement).id).toBe("his");
});
