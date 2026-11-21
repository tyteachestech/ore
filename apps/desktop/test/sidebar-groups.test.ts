import { expect, test } from "bun:test";
import type { Skill } from "../src/ore";
import { sidebarGroups } from "../src/Skills";

const skill = (id: string, collection?: string, archived?: boolean) => ({ id, name: id, collection, archived }) as unknown as Skill;

// F442: the Mac's sidebar listed the skills in no collection first with no heading (D36, 2026-11-20)
// while the iPhone's drawer still listed them last under "Other". Both lists now read this one order.
test("the sidebar and the iPhone's drawer list skills in one order: those in no collection first with no heading, then each collection", () => {
  const groups = sidebarGroups([skill("a", "Craft"), skill("loose"), skill("b", "Work"), skill("c", "Craft"), skill("gone", "Work", true)]);
  expect(groups.map((g) => [g.collection, g.bare, g.skills.map((s) => s.id)])).toEqual([
    ["", true, ["loose"]],
    ["Craft", false, ["a", "c"]],
    ["Work", false, ["b"]],
  ]);
  // With no collections the one group keeps its heading, "Skills".
  expect(sidebarGroups([skill("x"), skill("y")]).map((g) => [g.name, g.bare])).toEqual([["Skills", false]]);
});
