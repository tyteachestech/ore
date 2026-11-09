import { Archive, ImportanceFocus, ImportanceLight, ImportanceNormal, type Icon } from "./icons";
import type { MenuAction } from "./Menu";
import type { Priority, Skill } from "./ore";

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
