import { expect, test } from "bun:test";
import auto from "../src/skill-icons.json";
import { FIXES } from "../src/skill-icon-fixes";
import { SKILL_ICON_SET } from "../src/skill-icon-set";

const drawn = auto as Record<string, string[]>;

// Every icon the picker offers has its 16-grid drawing (scripts/pixel-skill-icons.ts), so none falls back to nothing,
// and nothing outside the set is shipped.
test("the skill icon set and its drawings match", () => {
  const names = SKILL_ICON_SET.map(([n]) => n);
  expect(new Set(names).size).toBe(names.length);
  expect(names.filter((n) => !drawn[n] || drawn[n]!.length !== 16 || drawn[n]!.some((r) => !/^[0-9a-f]{4}$/.test(r)))).toEqual([]);
  expect(Object.keys(drawn).filter((n) => !names.includes(n))).toEqual([]);
});

test("hand fixes are 16x16 sprites of icons in the set", () => {
  for (const [name, rows] of Object.entries(FIXES)) {
    expect(drawn[name]).toBeDefined();
    expect(rows.length).toBe(16);
    for (const r of rows) expect(r).toMatch(/^[#.]{16}$/);
  }
});
