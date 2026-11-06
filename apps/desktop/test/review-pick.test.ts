import { expect, test } from "bun:test";
import type { Skill, Today } from "../src/ore";
import { dueSkills } from "../src/ReviewPick";

test("what to review lists only skills with cards due, most due first (D80)", () => {
  const skills = [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }] as Skill[];
  const today = { skills: [{ skill: "a", due: 1 }, { skill: "b", due: 0 }, { skill: "c", due: 4 }, { skill: "gone", due: 9 }] } as Today;
  expect(dueSkills(today, skills).map((r) => [r.skill.id, r.due])).toEqual([["c", 4], ["a", 1]]);
});
