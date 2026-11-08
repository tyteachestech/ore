import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import auto from "../src/skill-icons.json";
import { FIXES } from "../src/skill-icon-fixes";

// Every MingCute icon the picker offers has its 16-grid drawing (scripts/pixel-skill-icons.ts), so none falls back to nothing.
test("every MingCute fill icon has a pixel drawing", () => {
  const dir = new URL("../node_modules/mingcute_icon/svg/", import.meta.url).pathname;
  const names = readdirSync(dir).flatMap((c) => readdirSync(dir + c).filter((f) => f.endsWith("_fill.svg")).map((f) => f.slice(0, -9)));
  const drawn = auto as Record<string, string[]>;
  expect(names.filter((n) => !drawn[n] || drawn[n]!.length !== 16 || drawn[n]!.some((r) => !/^[0-9a-f]{4}$/.test(r)))).toEqual([]);
});

test("hand fixes are 16x16 sprites of MingCute icons", () => {
  for (const [name, rows] of Object.entries(FIXES)) {
    expect((auto as Record<string, unknown>)[name]).toBeDefined();
    expect(rows.length).toBe(16);
    for (const r of rows) expect(r).toMatch(/^[#.]{16}$/);
  }
});

// A skill icon that is also a UI icon draws the same sprite, so the app has one compass, not two.
test("skill icons with a UI twin match it", () => {
  const ui = readFileSync(new URL("../src/icons.tsx", import.meta.url), "utf8");
  const sprite = (name: string) => [...ui.match(new RegExp(`export const ${name} = sprite\\(\\[([\\s\\S]*?)\\]\\);`))![1]!.matchAll(/"([.#]{16})"/g)].map((m) => m[1]);
  expect(FIXES.compass).toEqual(sprite("Compass"));
});
