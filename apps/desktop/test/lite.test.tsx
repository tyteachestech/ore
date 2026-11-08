import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act, type ReactElement } from "react";

const w = new Window();
for (const k of ["window", "document", "HTMLElement", "Node", "MutationObserver", "getComputedStyle", "navigator"] as const) {
  const v = (w as unknown as Record<string, unknown>)[k];
  (globalThis as Record<string, unknown>)[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client");
const { Lite } = await import("../src/Lite");
const { MoreButton, WithMenu } = await import("../src/Menu");
const { Hint, HintProvider } = await import("../src/Hint");
const { SkillPicker } = await import("../src/Skills");

const renderToStaticMarkup = (el: ReactElement) => {
  const div = document.createElement("div");
  const root = createRoot(div);
  act(() => root.render(<HintProvider>{el}</HintProvider>));
  const html = div.innerHTML;
  act(() => root.unmount());
  return html;
};

// A long list's off-screen rows render their controls without Radix (Lite.tsx): All sources with
// 950 rows opened in 0.65 s with every row's menus built, 0.2 s without. The button must stay the same.
const both = (el: ReactElement) => [true, false].map((lite) => renderToStaticMarkup(<Lite.Provider value={lite}>{el}</Lite.Provider>));
const attrs = (html: string) => html.replace(/ (data-state|id|aria-controls)="[^"]*"/g, "");

describe("lite rows", () => {
  test("⋯ is the same button either way, without its menu off screen", () => {
    const [lite, full] = both(<MoreButton label="Actions for A source" actions={() => []} />);
    expect(attrs(lite!)).toBe(attrs(full!));
    expect(lite).not.toContain("data-state");
    expect(full).toContain("data-state");
  });

  test("the skill pills are the same button either way", () => {
    const [lite, full] = both(<SkillPicker skills={[]} value={[]} title="A source" onChange={() => {}} onCreate={async () => undefined} />);
    expect(attrs(lite!)).toBe(attrs(full!));
    expect(lite).not.toContain("data-state");
  });

  test("a hint and a right-click menu render only what they wrap", () => {
    const [lite] = both(<WithMenu actions={() => []}><Hint text="Done"><span className="row">x</span></Hint></WithMenu>);
    expect(lite).toBe('<span class="row">x</span>');
  });

  test("outside a list, nothing is lite", () => {
    expect(renderToStaticMarkup(<MoreButton label="Actions" actions={() => []} />)).toContain("data-state");
  });
});
