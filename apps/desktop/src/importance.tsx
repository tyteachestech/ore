import { Archive, ImportanceFocus, ImportanceLight, ImportanceNormal, type Icon } from "./icons";
import type { MenuAction } from "./Menu";
import type { Item, Priority, Skill } from "./ore";

/** D173: how much a skill matters to him, as Linear's priority (its bars, its menu). Focus keeps its cards
 *  best and ranks them first; Light, what a new skill starts as, keeps fewer cards and lets them wait. */
export const LEVELS: { p: Priority; label: string; Icon: Icon }[] = [
  { p: "P1", label: "Focus", Icon: ImportanceFocus },
  { p: "P2", label: "Normal", Icon: ImportanceNormal },
  { p: "P3", label: "Light", Icon: ImportanceLight },
];

/** A skill's level; an older skill with none written reads as Normal, as core does. */
export const levelOf = (s: Skill) => LEVELS.find((l) => l.p === (s.priority ?? "P2"))!;

/** The level's icon, or the archive box once the skill is archived. */
export const ImportanceIcon = ({ skill, size = 16 }: { skill: Skill; size?: number }) => {
  const I = skill.archived ? Archive : levelOf(skill).Icon;
  return <I size={size} aria-hidden="true" />;
};

/** The levels to pick, ticked at the current one (none while archived): the skill page's button, and
 *  Importance ▸ on the sidebar's right-click and ⋯. */
export const importanceActions = (s: Skill, set: (s: Skill, p: Priority) => void): MenuAction[] =>
  LEVELS.map((l) => ({ id: `level:${l.p}`, label: l.label, icon: <l.Icon size={16} aria-hidden="true" />, checked: !s.archived && levelOf(s).p === l.p, run: () => set(s, l.p) }));

/** The level a source's exercises take from its skills, as core's `cardPriority` does: the highest among
 *  them (an archived skill counts only when all are archived), Normal with none. */
export function skillsLevel(ids: string[], skills: Skill[]): Priority {
  const own = skills.filter((s) => ids.includes(s.id));
  const live = own.filter((s) => !s.archived);
  return (live.length ? live : own).map((s) => s.priority ?? "P2").sort()[0] ?? "P2";
}

/** A source's Importance ▸: the levels, ticked at the one its exercises have now (his own setting, else its
 *  skills'). Picking one sets it on the source, over its skills. Once he has set one on a source that has
 *  skills, a last row hands it back to them; with no skill, Normal is that. `set("")` clears his setting. */
export function sourceImportanceActions(item: Pick<Item, "skills" | "priority">, skills: Skill[], set: (p: Priority | "") => void): MenuAction[] {
  const from = skillsLevel(item.skills, skills);
  const filed = item.skills.some((id) => skills.some((s) => s.id === id));
  const now = item.priority ?? from;
  const Back = LEVELS.find((l) => l.p === from)!.Icon;
  return [
    ...LEVELS.map((l) => ({ id: `level:${l.p}`, label: l.label, icon: <l.Icon size={16} aria-hidden="true" />, checked: now === l.p, run: () => now !== l.p && set(!filed && l.p === "P2" ? "" : l.p) })),
    ...(filed && item.priority ? [{ id: "level:", label: "Same as its skills", icon: <Back size={16} aria-hidden="true" />, checked: false, run: () => set("") }] : []),
  ];
}
