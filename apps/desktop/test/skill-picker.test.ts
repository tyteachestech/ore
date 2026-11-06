import { expect, test } from "bun:test";
import type { Skill } from "../src/ore";
import { skillsFirst } from "../src/Skills";

test("the skill picker lists a source's skills first, each part in sidebar order", () => {
  const skills = [{ id: "teach" }, { id: "web" }, { id: "ai" }, { id: "cs" }, { id: "habits" }] as Skill[];
  expect(skillsFirst(skills, ["cs", "ai"]).map((k) => k.id)).toEqual(["ai", "cs", "teach", "web", "habits"]);
  expect(skillsFirst(skills, []).map((k) => k.id)).toEqual(["teach", "web", "ai", "cs", "habits"]);
  expect(skillsFirst(skills, ["gone"]).map((k) => k.id)).toEqual(["teach", "web", "ai", "cs", "habits"]);
});
