import { expect, test } from "bun:test";
import auto from "../src/skill-icons.json";
import { FIXES } from "../src/skill-icon-fixes";
import { findSkillIcons, SKILL_ICON_SET } from "../src/skill-icon-set";

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
  for (const name of ["basketball", "star_2", "user_1", "heart", "bulb", "football", "coin", "target", "headphone", "mortarboard", "cat", "medal", "test_tube", "bus", "mountain", "movie", "magnet", "eyeglass", "chip", "dental", "gift", "airplane", "church", "house", "baseball", "bug", "science", "wine"]) {
    const rows = FIXES[name];
    expect(rows).toBeDefined();
    for (const r of rows!) expect(mirrored(r) ? "mirrored" : r).toBe("mirrored");
  }
});

// Tyler, 2026-11-11: search finds an icon by what it is for, not only by its name. Every icon carries related
// words (synonyms, the subjects someone studying it would type), and a word matches only from its start.
test("icon search finds a subject by related words, without matches from the middle of a word", () => {
  const found = (q: string) => findSkillIcons(q).map((i) => i.name);
  for (const [q, name] of [["teacher", "black_board"], ["psychology", "brain"], ["finance", "coin"], ["spanish", "translate"], ["gym", "barbell"], ["machine learning", "ai"], ["nutrition", "fork_knife"], ["cybersecurity", "lock"], ["startup", "rocket"], ["mindfulness", "zazen"], ["Biology ", "microscope"]] as const)
    expect(found(q).includes(name) ? name : `${q}: ${found(q)}`).toBe(name);
  expect(found("ai")[0]).toBe("ai");
  for (const noise of ["train", "paint_brush", "brain", "mountain"]) expect(found("ai")).not.toContain(noise);
  expect(found("art")[0]).toBe("palette");
  expect(found("xyzzy")).toEqual([]);
  expect(findSkillIcons("").length).toBe(SKILL_ICON_SET.length);
  for (const [name, words = ""] of SKILL_ICON_SET) expect(words.split(" ").filter(Boolean).length >= 3 ? "ok" : name).toBe("ok");
});
