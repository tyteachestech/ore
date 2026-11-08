import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { paths } from "../src/library.ts";
import { arrangeSkills, loadSkills, setSkillLook } from "../src/skills.ts";
import { skillGroupsOf } from "./groups.ts";
import { tempLibrary } from "./helpers.ts";

describe("sidebar layout (arrangeSkills)", () => {
  test("moves, reorders and renames in one write, keeping comments; undo is the old layout", async () => {
    const lib = await tempLibrary();
    await setSkillLook(lib, "ai", { collection: "Work" });
    await setSkillLook(lib, "habits", { collection: "Work" });
    writeFileSync(paths.skills(lib), readFileSync(paths.skills(lib), "utf8").replace("  - id: habits", "  # keep this\n  - id: habits"));
    const before = skillGroupsOf(loadSkills(lib).skills);
    const ids = loadSkills(lib).skills.map((s) => s.id).filter((id) => id !== "ai" && id !== "habits" && id !== "learning");
    const layout = [
      { collection: "Life", skills: ["habits", "learning"] },
      { collection: "Work", skills: ["ai"] },
      { collection: "", skills: ids },
    ];
    await arrangeSkills(lib, layout);
    expect(skillGroupsOf(loadSkills(lib).skills)).toEqual(layout);
    expect(readFileSync(paths.skills(lib), "utf8")).toMatch(/# keep this\n\s+- id: habits/);
    await arrangeSkills(lib, before);
    expect(skillGroupsOf(loadSkills(lib).skills)).toEqual(before);
  });

  test("refuses a layout that drops, repeats or invents a skill", async () => {
    const lib = await tempLibrary();
    const all = loadSkills(lib).skills.map((s) => s.id);
    await expect(arrangeSkills(lib, [{ collection: "", skills: all.slice(1) }])).rejects.toThrow("leaves out");
    await expect(arrangeSkills(lib, [{ collection: "", skills: [...all, all[0]!] }])).rejects.toThrow("twice");
    await expect(arrangeSkills(lib, [{ collection: "", skills: [...all, "nope"] }])).rejects.toThrow("unknown");
    await expect(arrangeSkills(lib, [{ collection: "A", skills: all.slice(0, 1) }, { collection: "a", skills: all.slice(1) }])).rejects.toThrow("twice");
  });

  test("refuses a collection named Other, the name the sidebar and Home give the skills in no collection", async () => {
    const lib = await tempLibrary();
    const all = loadSkills(lib).skills.map((s) => s.id);
    await expect(arrangeSkills(lib, [{ collection: " other ", skills: all.slice(0, 1) }, { collection: "", skills: all.slice(1) }])).rejects.toThrow("no collection");
    await expect(setSkillLook(lib, all[0]!, { collection: "Other" })).rejects.toThrow("no collection");
    expect(loadSkills(lib).skills.every((s) => !s.collection)).toBe(true);
  });
});
