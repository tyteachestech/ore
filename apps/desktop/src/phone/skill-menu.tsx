import { importanceActions, LEVELS } from "../importance";
import type { MenuAction } from "../Menu";
import { layoutOf, skillGroups } from "../Skills";
import { opt, ore, type Priority, type Skill } from "../ore";
import { errorText, type Notify } from "../util";

let arranging: Promise<unknown> = Promise.resolve();

/** A skill's long-press menu on the iPhone: the Mac's right-click (App.tsx skillMenu), less Delete, which stays on
 *  the Mac where a slip can't take a skill's exercises with it. Each change is at once, with Undo. */
export function skillMenu({ skills, refresh, notify, open, review, edit }: {
  skills: Skill[];
  refresh: () => Promise<void> | void;
  notify: Notify;
  open: (s: Skill) => void;
  review: (s: Skill) => void;
  edit: (s: Skill) => void;
}): (s: Skill) => MenuAction[] {
  // A failed write puts the step back (refresh) and says why; from the history it throws, so Undo says it.
  const write = async (run: () => Promise<unknown>, fromHistory = false) => {
    try {
      await run();
    } catch (e) {
      if (fromHistory) throw e;
      notify(errorText(e), "error");
    } finally {
      void refresh();
    }
  };
  // One after another, as the Mac's are (App.tsx layoutWrites): an Undo tapped mid-write must land last.
  const arrange = (layout: ReturnType<typeof layoutOf>, fromHistory = false) => {
    const run = arranging.then(() => ore("skills", "arrange", JSON.stringify(layout)));
    arranging = run.catch(() => {});
    return write(() => run, fromHistory);
  };
  const moveSkill = (s: Skill, collection: string) => {
    const before = layoutOf(skillGroups(skills));
    const out = before.map((g) => ({ ...g, skills: g.skills.filter((id) => id !== s.id) }));
    const into = out.find((g) => g.collection === collection);
    const after = (into ? out.map((g) => (g === into ? { ...g, skills: [...g.skills, s.id] } : g)) : [...out, { collection, skills: [s.id] }]).filter((g) => g.skills.length);
    void arrange(after);
    notify(collection ? `Moved “${s.name}” to ${collection}` : `Moved “${s.name}” out of ${s.collection}`, "info", () => arrange(before, true), () => arrange(after, true));
  };
  const change = (id: string, patch: Pick<Skill, "priority" | "archived">, fromHistory = false) =>
    write(async () => {
      if (patch.priority) await ore("skills", "set", id, opt("priority", patch.priority));
      if (patch.archived !== undefined) await ore("skills", "archive", id, ...(patch.archived ? [] : ["--undo"]));
    }, fromHistory);
  const setImportance = (s: Skill, p: Priority) => {
    const before = { priority: s.priority ?? "P2", ...(s.archived && { archived: true }) };
    const after = { priority: p, ...(s.archived && { archived: false }) };
    if (before.priority === p && !s.archived) return;
    void change(s.id, after);
    notify(`${s.name}: ${LEVELS.find((l) => l.p === p)!.label}`, before.archived ? "info" : "quiet", () => change(s.id, before, true), () => change(s.id, after, true));
  };
  const archive = (s: Skill, on: boolean) => {
    void change(s.id, { archived: on });
    notify(on ? `Archived “${s.name}”` : `Brought back “${s.name}”`, "info", () => change(s.id, { archived: !on }, true), () => change(s.id, { archived: on }, true));
  };
  const collections = [...new Set(skills.flatMap((s) => (s.collection ? [s.collection] : [])))];
  return (s) => [
    { id: "open", label: "Open", run: () => open(s) },
    { id: "review", label: "Review this skill", run: () => review(s) },
    { id: "edit", label: "Edit skill…", run: () => edit(s) },
    ...(collections.some((c) => c !== s.collection) || s.collection
      ? [{
          id: "move",
          label: "Move to",
          run: () => {},
          sub: [
            ...collections.filter((c) => c !== s.collection).map((c) => ({ id: `to:${c}`, label: c, run: () => moveSkill(s, c) })),
            ...(s.collection ? [{ id: "to:", label: "No collection", run: () => moveSkill(s, "") }] : []),
          ],
        }]
      : []),
    { id: "importance", label: "Importance", run: () => {}, sub: importanceActions(s, setImportance) },
    s.archived ? { id: "unarchive", label: "Bring back", run: () => archive(s, false) } : { id: "archive", label: "Archive skill", danger: true, divider: true, run: () => archive(s, true) },
  ];
}
