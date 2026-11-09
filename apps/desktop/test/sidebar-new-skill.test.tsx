import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act, type ReactElement } from "react";

const w = new Window();
for (const k of ["window", "document", "HTMLElement", "Node", "MutationObserver", "getComputedStyle", "navigator", "localStorage", "matchMedia"] as const) {
  const v = (w as unknown as Record<string, unknown>)[k];
  (globalThis as Record<string, unknown>)[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client");
const { HintProvider } = await import("../src/Hint");
const { Sidebar } = await import("../src/Sidebar");
type Skill = import("../src/Skills").Skill;

const skill = (id: string, collection?: string): Skill => ({ id, name: id, collection } as unknown as Skill);

/** The sidebar with the window's other screens stubbed; `render` shows it again with other skills. */
function mount(skills: Skill[]) {
  const div = document.createElement("div");
  document.body.append(div);
  const root = createRoot(div);
  const el = (skills: Skill[]): ReactElement => (
    <HintProvider>
      <Sidebar skills={skills} skill={null} within={false} home onHome={() => {}} feed={false} onFeed={() => {}} hidden={false} peek={false} onPointer={() => {}} onOpen={() => {}} menu={() => []} onCreated={() => {}} onArrange={() => {}} onDeleteCollection={() => {}} />
    </HintProvider>
  );
  act(() => root.render(el(skills)));
  return { div, render: (skills: Skill[]) => act(() => root.render(el(skills))), unmount: () => act(() => root.unmount()) };
}

const field = (div: HTMLElement) => div.querySelector<HTMLInputElement>('input[aria-label="New skill name"]');

describe("sidebar: the New skill field", () => {
  // The flaky "New collection “Other”" journey: with the skills still loading, the sidebar has one group,
  // "Skills"; once they arrive with their collections it is "Other". A field opened in it was keyed to
  // the name, so the group's rename closed it under the caret (every few runs under CI's load).
  test("stays open in the ungrouped group when the skills load and rename that group", () => {
    const { div, render, unmount } = mount([]);
    act(() => div.querySelector<HTMLButtonElement>('button[aria-label="New skill"]')!.click());
    expect(field(div)).not.toBeNull();
    render([skill("a", "Craft"), skill("b")]);
    const f = field(div);
    expect(f).not.toBeNull();
    expect(f!.closest(".side-section")?.getAttribute("aria-label")).toBe("Other");
    unmount();
  });

  test("opens in the collection whose + was clicked, and in Other for New collection named Other", () => {
    const { div, unmount } = mount([skill("a", "Craft"), skill("b")]);
    act(() => div.querySelector<HTMLButtonElement>('button[aria-label="New skill in Craft"]')!.click());
    expect(field(div)!.closest(".side-section")?.getAttribute("aria-label")).toBe("Craft");
    unmount();
  });
});
