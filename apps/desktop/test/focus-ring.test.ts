import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// One keyboard focus ring (DESIGN.md: "the 2px `focus` ring"; round 8, pick 6): wherever a rule draws a ring on
// :focus-visible, it is 2px of `--focus`, as an outline or as a shadow that follows the control's corners. Not checked:
// a control that shows focus by its fill (a menu row) or by its border (a text field).
const KNOWN: Record<string, string> = {
  // The selected row of a list that has the keys: a 1px edge on the selection, not a ring (DESIGN.md "Rows").
  ".list:focus-visible .row.on": "selection edge",
  // A ring a 2px gap out from the control, so it clears the control's own colour or lip.
  ".swatch:focus-visible": "ring past a gap",
  ".review-rate button[data-armed]:focus-visible": "ring past the armed edge",
  // The ring, then a rim of the page so it stands off a picture's own edge.
  ".preview:focus-visible > span:first-child": "ring with a rim",
};

test("every focus ring is 2px of the focus colour", () => {
  const odd: string[] = [];
  for (const file of ["styles.css", "retro.css"]) {
    const css = readFileSync(join(import.meta.dir, "../src", file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!selector!.includes(":focus-visible")) continue;
      if (selector!.split(",").some((s) => KNOWN[s.trim()])) continue;
      const rings = [...body!.matchAll(/outline:\s*([^;]+)/g), ...body!.matchAll(/box-shadow:\s*([^;]*0 0 0 \d[^;]*)/g)].map((m) => m[1]!.trim()).filter((v) => v !== "none");
      for (const ring of rings) {
        const parts = ring.split(/,(?![^(]*\))/).filter((p) => /^\d+px solid|0 0 0 \d/.test(p.trim()));
        if (parts.some((p) => !/^(2px solid var\(--focus\)|(inset )?0 0 0 2px var\(--focus\))$/.test(p.trim()))) odd.push(`${file}: ${selector!.trim().slice(0, 80)} { ${ring} }`);
      }
    }
  }
  expect(odd).toEqual([]);
});
