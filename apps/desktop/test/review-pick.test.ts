import { expect, test } from "bun:test";
import type { Skill, Today } from "../src/ore";
import { dueSkills } from "../src/ReviewPick";

test("what to review lists only skills with cards due, most due first (D80)", () => {
  const skills = [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }] as Skill[];
  const today = { skills: [{ skill: "a", due: 1 }, { skill: "b", due: 0 }, { skill: "c", due: 4 }, { skill: "gone", due: 9 }] } as Today;
  expect(dueSkills(today, skills).map((r) => [r.skill.id, r.due])).toEqual([["c", 4], ["a", 1]]);
});

test("what to review puts Focus skills first, then Normal, then Light, and never lists an archived one (D173)", () => {
  const skills = [{ id: "light", name: "L", priority: "P3" }, { id: "focus", name: "F", priority: "P1" }, { id: "old", name: "O" }, { id: "gone", name: "G", priority: "P1", archived: true }] as Skill[];
  const today = { skills: [{ skill: "light", due: 9 }, { skill: "focus", due: 1 }, { skill: "old", due: 3 }, { skill: "gone", due: 5 }] } as Today;
  expect(dueSkills(today, skills).map((r) => r.skill.id)).toEqual(["focus", "old", "light"]);
});

test("a row carries what a session there could win: gems one Good from cut today, and loose ones (D249)", () => {
  const skills = [{ id: "a", name: "A" }, { id: "b", name: "B" }] as Skill[];
  const today = { skills: [{ skill: "a", due: 3, ready_today: 2, win_back: 1 }, { skill: "b", due: 5, ready_today: 0, win_back: 0 }], no_skill_due: 1 } as Today;
  expect(dueSkills(today, skills).map((r) => [r.skill.name, r.near, r.loose])).toEqual([["B", 0, 0], ["A", 2, 1], ["No skill", 0, 0]]);
});
