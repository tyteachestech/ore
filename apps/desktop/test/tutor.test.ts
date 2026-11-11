import { expect, test } from "bun:test";
import { mentionMatches, pointedAt } from "../src/mentions";

const sources = [{ id: "s1", title: "The Testing Effect" }, { id: "s2", title: "Building Effective Agents" }, { id: "s3", title: "Effortful learning" }];
const skills = [{ id: "learning", name: "Learning" }, { id: "ai", name: "AI" }];

test("@ lists skills and sources whose name holds the query, a name starting with it first, then a word starting with it", () => {
  expect(mentionMatches("eff", sources, skills, []).map((m) => m.id)).toEqual(["s3", "s1", "s2"]);
  expect(mentionMatches("learn", sources, skills, []).map((m) => [m.kind, m.id])).toEqual([["skill", "learning"], ["source", "s3"]]);
  expect(mentionMatches("", sources, skills, []).length).toBe(5);
});

test("@ leaves out what he already pointed at, and lists eight at most", () => {
  expect(mentionMatches("", sources, skills, [{ kind: "skill", id: "ai", name: "AI" }]).some((m) => m.id === "ai")).toBe(false);
  const many = Array.from({ length: 20 }, (_, i) => ({ id: `x${i}`, title: `Source ${i}` }));
  expect(mentionMatches("source", many, [], []).length).toBe(8);
});

test("a message on a skill's page points at the @s in effect and that skill, once even if he @s it too", () => {
  const learning = { kind: "skill" as const, id: "learning", name: "Learning" };
  const source = { kind: "source" as const, id: "s1", name: "Effective agents" };
  expect(pointedAt([], [learning])).toEqual([learning]);
  expect(pointedAt([source], [learning])).toEqual([source, learning]);
  expect(pointedAt([learning], [{ ...learning }])).toEqual([learning]);
  expect(pointedAt([source], [])).toEqual([source]);
});
