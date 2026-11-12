// What the share card (apps/phone/share, native Swift) needs to draw a skill as the app does: its name, its
// icon as the lit cells of the 16 grid (the drawing `dots()` makes, centred the same way) and its colour.
import auto from "../skill-icons.json";
import { cells } from "../dots";
import { FIXES } from "../skill-icon-fixes";

const COLORS: Record<string, string> = { gray: "#999999", red: "#ff7b72", orange: "#ffa657", yellow: "#e8c24a", green: "#5fcf8a", teal: "#4fd1c5", blue: "#6aa8f7", purple: "#b98af5", pink: "#f38bb8" };

const rows = (name: string): readonly string[] | undefined =>
  FIXES[name] ?? (auto as Record<string, string[]>)[name]?.map((h) => parseInt(h, 16).toString(2).padStart(16, "0").replace(/1/g, "#"));

export type ShareSkill = { id: string; name: string; dots?: number[]; color?: string };

/** `dots` is x, y, x, y… of each lit cell; a skill with no icon, or one the set no longer has, sends none. */
export const shareList = (skills: { id: string; name: string; icon?: string; color?: string }[]): ShareSkill[] =>
  skills.map(({ id, name, icon, color }) => {
    const on = icon?.startsWith("mc:") ? cells(rows(icon.slice(3)) ?? []) : [];
    return { id, name, ...(on.length ? { dots: on.flat() } : {}), ...(color && COLORS[color] ? { color: COLORS[color] } : {}) };
  });
