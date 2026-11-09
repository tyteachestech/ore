import { afterAll, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";

const w = new Window();
for (const k of ["window", "document", "HTMLElement", "HTMLFormElement", "HTMLInputElement", "HTMLButtonElement", "Element", "Node", "MutationObserver", "getComputedStyle", "navigator", "localStorage", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame"] as const) {
  const v = (w as unknown as Record<string, unknown>)[k];
  (globalThis as Record<string, unknown>)[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
// Radix's focus scope dispatches a CustomEvent on the panel a tick after it unmounts, and happy-dom
// takes only its own events; other test files dispatch native ones, so the native class comes back after.
const NativeCustomEvent = globalThis.CustomEvent;
globalThis.CustomEvent = w.CustomEvent as unknown as typeof CustomEvent;
afterAll(() => void (globalThis.CustomEvent = NativeCustomEvent));
const { createRoot } = await import("react-dom/client");
const { HintProvider } = await import("../src/Hint");
const { SkillEditor } = await import("../src/Skills");
type Skill = import("../src/Skills").Skill;

const esc = (target: Element) => void target.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));

/** The Edit skill dialog for Habits; `closed` counts the Escapes that closed it. */
async function withEditor(run: (t: { panel: HTMLElement; closed: () => number }) => void) {
  const div = document.createElement("div");
  document.body.append(div);
  const root = createRoot(div);
  let closed = 0;
  const skill = { id: "habits", name: "Habits" } as unknown as Skill;
  try {
    act(() => root.render(
      <HintProvider>
        <SkillEditor skill={skill} collections={[]} onSaved={() => {}} onClose={() => closed++} onDelete={() => {}} notify={() => {}} />
      </HintProvider>,
    ));
    run({ panel: div.querySelector<HTMLElement>(".skill-edit")!, closed: () => closed });
  } finally {
    act(() => root.unmount());
    div.remove();
    await new Promise((ok) => setTimeout(ok, 0)); // the focus scope's unmount tick
  }
}

describe("Edit skill: Esc", () => {
  // The flaky "icon picker: it opens with the caret in Filter" journey: Esc closed the picker, and the
  // next Esc did nothing, so the click on the sidebar behind the dialog timed out. Radix hands focus
  // back to the Change icon button a tick after the picker unmounts (a setTimeout 0), so an Esc in
  // that tick lands on the body, outside the panel, and the panel's own key handler never saw it.
  test("closes the dialog from inside the panel, and from the body in the tick after a popover closed", () =>
    withEditor(({ panel, closed }) => {
      act(() => esc(panel.querySelector('button[aria-label="Add icon"]')!));
      expect(closed()).toBe(1);
      act(() => esc(document.body));
      expect(closed()).toBe(2);
    }));

  // The picker's popover is portaled beside the panel, not inside it: that Esc is Radix's, closing the popover.
  test("from a popover outside the panel it leaves the dialog open", () =>
    withEditor(({ closed }) => {
      const portal = document.createElement("div");
      document.body.append(portal);
      act(() => esc(portal));
      expect(closed()).toBe(0);
      portal.remove();
    }));
});
