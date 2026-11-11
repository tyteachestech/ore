import { expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";

const w = new Window();
for (const k of ["window", "document", "HTMLElement", "Node", "MutationObserver", "getComputedStyle", "navigator"] as const) {
  const v = (w as unknown as Record<string, unknown>)[k];
  (globalThis as Record<string, unknown>)[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client");
const { HintProvider } = await import("../src/Hint");
const { SkillChips } = await import("../src/Skills");

const skills = ["Learning", "Teaching", "Creativity", "Storytelling", "Web design", "Creatine"].map((name) => ({ id: name.toLowerCase(), name }));
const shown = (n: number) => {
  const div = document.createElement("div");
  const root = createRoot(div);
  act(() => root.render(<HintProvider><SkillChips ids={skills.slice(0, n).map((s) => s.id)} skills={skills} /></HintProvider>));
  const out = { names: [...div.querySelectorAll(".chips > .chip .chip-name")].map((c) => c.textContent), more: div.querySelector(".chip-more") };
  act(() => root.unmount());
  return out;
};

// D198: a row names two skills whole and counts the rest, instead of squeezing six into "L." and "Story…".
test("a source's row names its first two skills and counts the rest", () => {
  expect(shown(2)).toEqual({ names: ["Learning", "Teaching"], more: null });
  const six = shown(6);
  expect(six.names).toEqual(["Learning", "Teaching"]);
  expect(six.more?.textContent).toBe("+4");
  // The hidden ones are still named to VoiceOver, as the hover says them.
  expect(six.more?.getAttribute("aria-label")).toBe("Creativity, Storytelling, Web design, Creatine");
  expect(shown(3).more?.textContent).toBe("+1");
});
