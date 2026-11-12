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

// Tyler, 2026-11-09: the brain read "messed up and asymmetrical" at 20px. Symmetric subjects are drawn
// mirror-symmetric on the grid (about the 16-wide box, or about pixel 7 for a 15-wide shape), so the
// round dots fall the same way on both sides.
test("symmetric subjects mirror left to right", () => {
  const mirrored = (r: string) => r === [...r].reverse().join("") || (r.endsWith(".") && r.slice(0, 15) === [...r.slice(0, 15)].reverse().join(""));
  for (const name of ["brain", "basketball", "star_2", "user_1", "heart", "bulb", "football", "coin", "target", "headphone", "mortarboard", "cat", "medal", "test_tube", "bus", "mountain", "movie", "magnet", "eyeglass", "chip", "dental", "gift", "airplane", "church", "house", "baseball", "bug", "science", "wine"]) {
    const rows = FIXES[name];
    expect(rows).toBeDefined();
    for (const r of rows!) expect(mirrored(r) ? "mirrored" : r).toBe("mirrored");
  }
});
