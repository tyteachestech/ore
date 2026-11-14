import { afterAll, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { Mole, MOVES, type Mood } from "../src/Mole";
const w = new Window();
const g = globalThis as Record<string, unknown>;
const saved = new Map<string, unknown>();
for (const k of ["window", "document", "HTMLElement", "Node", "MutationObserver", "navigator", "matchMedia", "IS_REACT_ACT_ENVIRONMENT", "requestAnimationFrame", "cancelAnimationFrame"]) saved.set(k, g[k]);
for (const k of ["window", "document", "HTMLElement", "Node", "MutationObserver", "navigator"]) g[k] = (w as unknown as Record<string, unknown>)[k];
g.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
g.IS_REACT_ACT_ENVIRONMENT = true;
g.requestAnimationFrame = () => 0;
g.cancelAnimationFrame = () => {};
const { createRoot } = await import("react-dom/client");
afterAll(() => { for (const [k, v] of saved) if (v === undefined) delete g[k]; else g[k] = v; });

test("D253/D261: every emotion draws the same traced paths at chat, button, moment and end-screen sizes", async () => {
  const body = document.createElement("div"); document.body.append(body);
  const root = createRoot(body);
  try {
    for (const mood of ["idle", ...Object.keys(MOVES)] as Mood[]) {
      let large: string[] | undefined;
      for (const size of [96, 48, 40, 28]) {
        await act(async () => root.render(<Mole mood={mood} size={size} />));
        const svg = body.querySelector("svg")!;
        expect(Number(svg.getAttribute("width"))).toBe(size);
        expect(svg.getAttribute("data-mood")).toBe(mood);
        const paths = [...svg.querySelectorAll("path")].map((p) => `${p.getAttribute("class")}:${p.getAttribute("d")}`);
        expect(paths.length).toBeGreaterThan(0);
        expect(paths.every((p) => !p.includes("NaN"))).toBe(true);
        if (large) expect(paths).toEqual(large); else large = paths;
      }
    }
  } finally { await act(async () => root.unmount()); body.remove(); }
});
