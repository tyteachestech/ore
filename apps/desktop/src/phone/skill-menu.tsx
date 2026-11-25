import { Folder, X } from "../icons";
import { importanceActions } from "../importance";
import type { MenuAction } from "../Menu";
import { layoutOf, skillGroups } from "../Skills";
import type { Skill } from "../ore";
import type { skillActions } from "../list-actions";

/** A skill's long-press menu on the iPhone: the Mac's right-click (App.tsx skillMenu), less Delete, which stays on
 *  the Mac where a slip can't take a skill's exercises with it. With it, a collection heading's menu and its
 *  rename: the Mac sidebar's Rename…, Move up, Move down and Delete collection (parity by default, Tyler
 *  2026-11-22). What each does is the Mac's own (list-actions.ts): at once, with Undo. */
export function skillMenu({ skills, actions, open, review, edit }: {
  skills: Skill[];
  actions: ReturnType<typeof skillActions>;
  open: (s: Skill) => void;
  review: (s: Skill) => void;
  edit: (s: Skill) => void;
}) {
  const { move: moveSkill, setImportance, archive } = actions;
  const collections = actions.collections();
  /** The drawer as it shows: archived skills (D173) are out of it, so a move never swaps with one he can't see. */
  const layout = () => layoutOf(skillGroups(skills.filter((s) => !s.archived)));
  /** A layout of what shows, with the archived skills put back in their collections, as the Mac's sidebar writes it. */
  const withArchived = (lay: ReturnType<typeof layoutOf>) => {
    const out = lay.map((g) => ({ ...g, skills: [...g.skills] }));
    for (const s of skills.filter((k) => k.archived)) {
      const g = out.find((x) => x.collection === (s.collection ?? ""));
      if (g) g.skills.push(s.id);
      else out.push({ collection: s.collection ?? "", skills: [s.id] });
    }
    return out;
  };
  const relayout = (label: string, shown: ReturnType<typeof layoutOf>) => actions.arrange(label, withArchived(shown));
  const swap = <T,>(l: T[], i: number, j: number) => {
    const out = [...l];
    [out[i], out[j]] = [out[j]!, out[i]!];
    return out;
  };
  const nudgeSkill = (s: Skill, by: number) => {
    const now = layout();
    const g = now.find((x) => x.skills.includes(s.id))!;
    const i = g.skills.indexOf(s.id);
    relayout(`Moved “${s.name}” ${by < 0 ? "up" : "down"}`, now.map((x) => (x === g ? { ...x, skills: swap(x.skills, i, i + by) } : x)));
  };
  const placeIn = (s: Skill) => {
    const g = layout().find((x) => x.skills.includes(s.id));
    return g ? { i: g.skills.indexOf(s.id), n: g.skills.length } : { i: 0, n: 1 };
  };
  const menu = (s: Skill): MenuAction[] => {
    const at = placeIn(s);
    return [
    { id: "open", label: "Open", run: () => open(s) },
    { id: "review", label: "Review this skill", run: () => review(s) },
    { id: "edit", label: "Edit skill…", run: () => edit(s) },
    ...(at.i > 0 ? [{ id: "up", label: "Move up", run: () => nudgeSkill(s, -1) }] : []),
    ...(at.i < at.n - 1 ? [{ id: "down", label: "Move down", run: () => nudgeSkill(s, 1) }] : []),
    ...(collections.some((c) => c !== s.collection) || s.collection
      ? [{
          id: "move",
          label: "Move to",
          run: () => {},
          sub: [
            ...collections.filter((c) => c !== s.collection).map((c) => ({ id: `to:${c}`, label: c, icon: <Folder />, run: () => moveSkill(s, c) })),
            ...(s.collection ? [{ id: "to:", label: "No collection", icon: <X />, run: () => moveSkill(s, "") }] : []),
          ],
        }]
      : []),
    { id: "importance", label: "Importance", run: () => {}, sub: importanceActions(s, setImportance) },
    s.archived ? { id: "unarchive", label: "Bring back", run: () => archive(s, false) } : { id: "archive", label: "Archive skill", danger: true, divider: true, run: () => archive(s, true) },
  ];
  };
  /** A collection heading's menu; `rename` opens its name field in place. */
  const collection = (name: string, rename: () => void): MenuAction[] => {
    const named = layout().filter((g) => g.collection);
    const i = named.findIndex((g) => g.collection === name);
    const nudge = (by: number) => {
      const now = layout();
      const a = now.findIndex((g) => g.collection === name), b = now.findIndex((g) => g.collection === named[i + by]!.collection);
      relayout(`Moved “${name}” ${by < 0 ? "up" : "down"}`, swap(now, a, b));
    };
    return [
      { id: "rename", label: "Rename…", run: rename },
      ...(i > 0 ? [{ id: "up", label: "Move up", run: () => nudge(-1) }] : []),
      ...(i >= 0 && i < named.length - 1 ? [{ id: "down", label: "Move down", run: () => nudge(1) }] : []),
      { id: "delete", label: "Delete collection", danger: true, divider: true, run: () => void actions.deleteCollection(name) },
    ];
  };
  return Object.assign(menu, { collection, renameCollection: actions.renameCollection });
}
