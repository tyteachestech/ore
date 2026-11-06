import { expect, test } from "bun:test";
import { Window } from "happy-dom";

// Math renders through KaTeX (D96): its glyphs and the `$$…$$` TeX stay out of both skeletons, so a
// highlight across a formula still lines up with the source.
const w = new Window();
for (const k of ["document", "NodeFilter"] as const) (globalThis as Record<string, unknown>)[k] = (w as unknown as Record<string, unknown>)[k];
const { indexText, sourceSkeleton } = await import("../src/text");

test("math is left out of the source and rendered skeletons alike", () => {
  const md = "Fit $$R = e^{-t/S}$$ to data.\n\n$$\n\\frac{a}{b}\n$$\n\nThen review.\n";
  const root = document.createElement("article");
  root.innerHTML = `<p>Fit <span class="katex"><span>R=e−t/S</span></span> to data.</p><span class="katex-display"><span class="katex">ab</span></span><p>Then review.</p>`;
  expect(sourceSkeleton(md).chars).toBe("Fittodata.Thenreview.");
  expect(indexText(root as unknown as HTMLElement).chars).toBe("Fittodata.Thenreview.");
});
