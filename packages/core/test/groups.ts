import type { Skill } from "../src/skills.ts";

// The sidebar's grouping (apps/desktop/src/Skills.tsx skillGroups), as a layout.
export function skillGroupsOf(skills: Skill[]) {
  const names = [...new Set(skills.flatMap((s) => (s.collection ? [s.collection] : [])))];
  const groups = names.map((c) => ({ collection: c, skills: skills.filter((s) => s.collection === c).map((s) => s.id) }));
  const rest = skills.filter((s) => !s.collection).map((s) => s.id);
  return rest.length ? [...groups, { collection: "", skills: rest }] : groups;
}
