import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { paths } from "../src/library.ts";
import { addSkill, arrangeSkills, loadSkills, setSkillLook } from "../src/skills.ts";
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

  test("refuses a layout that repeats a skill", async () => {
    const lib = await tempLibrary();
    const all = loadSkills(lib).skills.map((s) => s.id);
    await expect(arrangeSkills(lib, [{ collection: "", skills: [...all, all[0]!] }])).rejects.toThrow("twice");
    await expect(arrangeSkills(lib, [{ collection: "A", skills: all.slice(0, 1) }, { collection: "a", skills: all.slice(1) }])).rejects.toThrow("twice");
  });

  test("a layout drawn before the other device added or deleted a skill still saves: the new one keeps its place, the gone one is passed over (F761)", async () => {
    const lib = await tempLibrary();
    await setSkillLook(lib, "ai", { collection: "Work" });
    await setSkillLook(lib, "habits", { collection: "Work" });
    // The Mac's sidebar as it was drawn, then the iPhone adds "Juggling" to Work and the Mac's drag lands.
    const drawn = skillGroupsOf(loadSkills(lib).skills);
    await addSkill(lib, "Juggling", "Work");
    const work = drawn.find((g) => g.collection === "Work")!;
    const moved = drawn.map((g) => (g === work ? { ...g, skills: [...g.skills].reverse() } : g));
    // And a skill deleted on the phone is still in the Mac's drawing.
    moved[moved.length - 1]!.skills.push("gone-elsewhere");
    await arrangeSkills(lib, moved);
    const after = skillGroupsOf(loadSkills(lib).skills);
    expect(after.find((g) => g.collection === "Work")!.skills).toEqual([...work.skills].reverse().concat("juggling"));
    expect(after.flatMap((g) => g.skills)).not.toContain("gone-elsewhere");
    expect(after.flatMap((g) => g.skills).sort()).toEqual(loadSkills(lib).skills.map((s) => s.id).sort());
    // The Mac's layout respelled Work as "work" meanwhile: the phone's new skill joins it, never a second Work.
    await addSkill(lib, "Unicycling", "Work");
    const respelled = skillGroupsOf(loadSkills(lib).skills).map((g) => (g.collection === "Work" ? { collection: "work", skills: g.skills.filter((s) => s !== "unicycling") } : g));
    await arrangeSkills(lib, respelled);
    const groups = skillGroupsOf(loadSkills(lib).skills);
    expect(groups.filter((g) => g.collection.toLowerCase() === "work")).toEqual([{ collection: "work", skills: [...respelled.find((g) => g.collection === "work")!.skills, "unicycling"] }]);
    await arrangeSkills(lib, groups);
  });

  test("refuses a collection named Other, the name the sidebar and Home give the skills in no collection", async () => {
    const lib = await tempLibrary();
    const all = loadSkills(lib).skills.map((s) => s.id);
    await expect(arrangeSkills(lib, [{ collection: " other ", skills: all.slice(0, 1) }, { collection: "", skills: all.slice(1) }])).rejects.toThrow("no collection");
    await expect(setSkillLook(lib, all[0]!, { collection: "Other" })).rejects.toThrow("no collection");
    expect(loadSkills(lib).skills.every((s) => !s.collection)).toBe(true);
    await expect(addSkill(lib, "Juggling", "other ")).rejects.toThrow("no collection");
    expect(loadSkills(lib).skills.some((s) => s.name === "Juggling")).toBe(false);
  });

  test("a collection named Other saved before it was refused reads as no collection, so the sidebar can still be arranged", async () => {
    const lib = await tempLibrary();
    await setSkillLook(lib, "ai", { collection: "Work" });
    writeFileSync(paths.skills(lib), readFileSync(paths.skills(lib), "utf8").replace("collection: Work", "collection: \" Other \""));
    const ai = loadSkills(lib).skills.find((s) => s.id === "ai")!;
    expect(ai.collection).toBeUndefined();
    const layout = skillGroupsOf(loadSkills(lib).skills);
    await arrangeSkills(lib, layout);
    expect(readFileSync(paths.skills(lib), "utf8")).not.toMatch(/collection: .*Other/i);
  });

  test("a collection set from the skill editor is saved tidied, as arrange and add save it", async () => {
    const lib = await tempLibrary();
    await setSkillLook(lib, "ai", { collection: "  Physics   Lab " });
    expect(loadSkills(lib).skills.find((s) => s.id === "ai")?.collection).toBe("Physics Lab");
  });
});

test("a collection name that differs from another only in its capitals is refused, by add and by a skill's own setting (COURSES-05)", async () => {
  const lib = await tempLibrary();
  await addSkill(lib, "Alpha", "Work");
  await expect(addSkill(lib, "Beta", "work")).rejects.toThrow('already a collection named "Work"');
  const beta = await addSkill(lib, "Beta", " Work ");
  await expect(setSkillLook(lib, beta.id, { collection: "WORK" })).rejects.toThrow('already a collection named "Work"');
  expect(loadSkills(lib).skills.filter((s) => s.collection).map((s) => s.collection)).toEqual(["Work", "Work"]);
  // The only skill in a collection may change its capitals: no other collection has the name.
  const solo = await addSkill(lib, "Gamma", "play");
  await setSkillLook(lib, solo.id, { collection: "Play" });
  expect(loadSkills(lib).skills.find((s) => s.id === solo.id)!.collection).toBe("Play");
});
