import { Folder, X } from "../icons";
import { importanceActions, LEVELS } from "../importance";
import type { MenuAction } from "../Menu";
import { layoutOf, skillGroups } from "../Skills";
import { opt, ore, type Priority, type Skill } from "../ore";
import { isOther, tidyCollection } from "../../../../packages/core/src/collection-name";
import { allOrNone, change } from "../change";
import type { Notify } from "../util";

/** A skill's long-press menu on the iPhone: the Mac's right-click (App.tsx skillMenu), less Delete, which stays on
 *  the Mac where a slip can't take a skill's exercises with it. Each change is at once, with Undo. With it, a
 *  collection heading's menu and its rename: the Mac sidebar's Rename…, Move up, Move down and Delete collection
 *  (parity by default, Tyler 2026-11-22). */
export function skillMenu({ skills, refresh, notify, open, review, edit }: {
  skills: Skill[];
  refresh: () => Promise<void> | void;
  notify: Notify;
  open: (s: Skill) => void;
  review: (s: Skill) => void;
  edit: (s: Skill) => void;
}) {
  // The layout's writes go one after another, as the Mac's do (App.tsx arrange): an Undo tapped mid-write lands last.
  /** A new layout, with Undo back to the one before. Resolves false when it was refused (a toast said why). */
  const arrange = (message: string, after: ReturnType<typeof layoutOf>) => {
    const before = layoutOf(skillGroups(skills));
    return change(notify, { message, key: "sidebar layout", write: (on) => ore("skills", "arrange", JSON.stringify(on ? after : before)), settled: () => void refresh() });
  };
  const moveSkill = (s: Skill, collection: string) => {
    const out = layoutOf(skillGroups(skills)).map((g) => ({ ...g, skills: g.skills.filter((id) => id !== s.id) }));
    const into = out.find((g) => g.collection === collection);
    const after = (into ? out.map((g) => (g === into ? { ...g, skills: [...g.skills, s.id] } : g)) : [...out, { collection, skills: [s.id] }]).filter((g) => g.skills.length);
    void arrange(collection ? `Moved “${s.name}” to ${collection}` : `Moved “${s.name}” out of ${s.collection}`, after);
  };
  type Patch = Partial<Pick<Skill, "priority" | "archived">>;
  const set = (message: string, kind: "info" | "quiet", id: string, before: Patch, after: Patch) =>
    void change(notify, {
      message,
      kind,
      key: `skill ${id}`,
      write: (on) =>
        allOrNone([
          async (to) => void ((to ? after : before).priority && (await ore("skills", "set", id, opt("priority", (to ? after : before).priority!)))),
          async (to) => void ((to ? after : before).archived !== undefined && (await ore("skills", "archive", id, ...((to ? after : before).archived ? [] : ["--undo"])))),
        ], on),
      settled: () => void refresh(),
    });
  const setImportance = (s: Skill, p: Priority) => {
    const before = { priority: s.priority ?? "P2", ...(s.archived && { archived: true }) };
    const after = { priority: p, ...(s.archived && { archived: false }) };
    if (before.priority === p && !s.archived) return;
    set(`${s.name}: ${LEVELS.find((l) => l.p === p)!.label}`, before.archived ? "info" : "quiet", s.id, before, after);
  };
  const archive = (s: Skill, on: boolean) => set(on ? `Archived “${s.name}”` : `Brought back “${s.name}”`, "info", s.id, { archived: !on }, { archived: on });
  const collections = [...new Set(skills.flatMap((s) => (s.collection ? [s.collection] : [])))];
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
  const relayout = (label: string, shown: ReturnType<typeof layoutOf>) => arrange(label, withArchived(shown));
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
    const remove = () => {
      const now = layout();
      const freed = now.find((g) => g.collection === name)?.skills ?? [];
      const kept = now.filter((g) => g.collection !== name);
      const rest = kept.find((g) => !g.collection);
      relayout(`Deleted collection “${name}”`, rest ? kept.map((g) => (g === rest ? { ...g, skills: [...freed, ...g.skills] } : g)) : [...kept, { collection: "", skills: freed }]);
    };
    return [
      { id: "rename", label: "Rename…", run: rename },
      ...(i > 0 ? [{ id: "up", label: "Move up", run: () => nudge(-1) }] : []),
      ...(i >= 0 && i < named.length - 1 ? [{ id: "down", label: "Move down", run: () => nudge(1) }] : []),
      { id: "delete", label: "Delete collection", danger: true, divider: true, run: remove },
    ];
  };
  /** Renames a collection as the Mac's sidebar does; an empty name, the same one or "Other" changes nothing. */
  /** Resolves false when the rename was refused (it said why), so the field opens again with what he typed. */
  const renameCollection = (from: string, to: string): Promise<boolean> => {
    const v = tidyCollection(to);
    if (!v || v === from || isOther(v)) return Promise.resolve(true);
    return relayout(`Renamed collection “${from}” to “${v}”`, layout().map((g) => (g.collection === from ? { ...g, collection: v } : g)));
  };
  return Object.assign(menu, { collection, renameCollection });
}
