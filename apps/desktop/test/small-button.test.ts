import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

// The small button is one build under three class names (D196, DESIGN.md "Small button"), so its
// keyboard focus must be one rule too: a sheet measured from the app found three rings (F20).
const css = ["styles.css", "retro.css"].map((f) => readFileSync(join(import.meta.dir, "../src", f), "utf8")).join("\n");
const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2].trim() }));
const CLASSES = ["note-toggle", "warm-start", "settings-btn"];

describe("small button", () => {
  test("every small button takes its focus ring from one shared rule", () => {
    // The rules that style each class's own :focus-visible (not a descendant's, not a variant like .rec).
    const own = (c: string) => rules.filter((r) => r.sel.split(",").some((s) => new RegExp(`(^|\\s)\\.${c}:focus-visible$`).test(s.trim()))).map((r) => r.sel);
    const sets = CLASSES.map(own);
    for (const s of sets) expect(s.length).toBeGreaterThan(0);
    for (const s of sets) expect(s).toEqual(sets[0]);
  });
});
