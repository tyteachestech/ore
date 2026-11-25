import { allOrNone, valueChange, type Change } from "./change";
import { LEVELS } from "./importance";
import { opt, pinBetween, type CardSkills, type Doc, type Item, type Priority, type Skill } from "./ore";
import { layoutOf, skillGroups, type SkillLayout } from "./Skills";
import { isOther, tidyCollection } from "../../../packages/core/src/collection-name";
import { count } from "./util";

// What the lists of sources and skills do, once for the Mac (App.tsx) and the iPhone (phone/PhoneApp.tsx): archive,
// restore, move, file, pin, rename, importance, several at once, and the skills' layout. Each device keeps only how
// he asks for one (keys, drags and right-clicks; swipes, sheets and long presses) and where he goes after. Written
// twice, the two drifted (F442, F486, F492 to F494, F573, F620, F621, F622); here a fix reaches both.
// Reopen it if a device needs an action to behave differently on purpose: that one takes the difference as an
// argument here, and says why.

type Up<T> = (f: (all: T[]) => T[]) => void;

/** What a device hands over: its lists as they show, and how it writes. */
export type Lists = {
  ore: <T>(...args: string[]) => Promise<T>;
  skills: Skill[];
  /** The listed sources, the Archive list and the skills as they show, changed at once. */
  items: Up<Item>;
  archived: Up<Item>;
  setSkills: Up<Skill>;
  /** `change` (change.ts) with this device's toasts, its guard on reads and its read once the newest write settles:
   *  one for the sources, one for the skills. */
  change: (c: Change) => Promise<boolean>;
  skillChange: (c: Change) => Promise<boolean>;
  /** Reads the skills again, where the sources' read doesn't bring them (the Mac). */
  reloadSkills: () => void;
  /** The selected row, where there is one (the Mac): Undo selects what it puts back, as Finder does. */
  cursor?: { now: string | null; set: (id: string | null) => void };
};

/** `ore status` arguments: a source going back to Done (an Undo) keeps the day it was finished. */
export const statusArgs = (i: Item, to: Item["status"]) => (to === "done" && i.status === "done" && i.finished_at ? [to, opt("at", i.finished_at)] : [to]);

export function sourceActions(env: Lists) {
  const { ore } = env;
  const patch = (id: string, to: (i: Item) => Item) => env.items((all) => all.map((i) => (i.id === id ? to(i) : i)));
  /** One field of these sources as it will be (true) or as it was; whatever else changed on a row meanwhile stays. */
  const each = <K extends keyof Item>(sel: Item[], key: K, to: (i: Item) => Item[K]) => {
    const was = new Map(sel.map((i) => [i.id, i]));
    return (forward: boolean) => env.items((all) => all.map((i) => (was.has(i.id) ? { ...i, [key]: forward ? to(was.get(i.id)!) : was.get(i.id)![key] } : i)));
  };
  /** Rows leave the lists for Archive (true), or come back from it. */
  const away = (sel: Item[], on: boolean) => {
    const ids = new Set(sel.map((i) => i.id));
    const at = on ? new Date().toISOString() : undefined;
    const moved = sel.map((i) => ({ ...i, archived_at: at }));
    env.items((all) => (on ? all.filter((i) => !ids.has(i.id)) : [...moved, ...all.filter((i) => !ids.has(i.id))]));
    env.archived((all) => (on ? [...moved, ...all.filter((i) => !ids.has(i.id))] : all.filter((i) => !ids.has(i.id))));
  };
  /** Filing under an archived skill brings it back (D173, the CLI does that); taking the filing back archives it
   *  again. Either way the skills are read again. */
  const rearchive = (ids: string[]) => Promise.all(ids.map((id) => ore("skills", "archive", id))).finally(env.reloadSkills);
  const isArchived = (id: string) => env.skills.some((s) => s.id === id && s.archived);

  /** Archives a source (hidden from lists and search, files and exercises kept), or brings one back, with Undo.
   *  Both under the source's key, so an Archive and a Restore of one source are written in the order he made them. */
  const fileAway = (item: Item, archived: boolean) =>
    env.change({
      message: `${archived ? "Archived" : "Restored"} “${item.title}”`,
      key: item.id,
      show: (on) => {
        away([item], on === archived);
        if (!on) env.cursor?.set(item.id);
      },
      write: (on) => ore("archive", item.id, ...(on === archived ? [] : ["--undo"])),
    });
  const archive = (item: Item) => fileAway(item, true);
  const restore = (item: Item) => fileAway(item, false);

  /** Moves a source between To read and Done, with Undo (the finish step stays the way to finish one). */
  const moveTo = (item: Item, to: Item["status"]) =>
    env.change({
      message: to === "done" ? `Moved “${item.title}” to Done` : `Moved “${item.title}” to To read`,
      key: item.id,
      // At once, so a swiped row doesn't come back to its old section while the write runs.
      show: (on) => patch(item.id, (i) => ({ ...i, status: on ? to : item.status })),
      write: (on) => ore("status", item.id, ...statusArgs(item, on ? to : item.status)),
    });

  /** Pins a source to the top of its lists, or unpins it. Undoing an unpin puts it back where it was among the pinned. */
  const pin = (item: Item) => {
    const was = item.pinned_at;
    const now = was ? undefined : new Date().toISOString();
    return env.change({
      message: now ? `Pinned “${item.title}”` : `Unpinned “${item.title}”`,
      kind: "quiet",
      key: item.id,
      show: (on) => patch(item.id, (i) => ({ ...i, pinned_at: on ? now : was })),
      write: (on) => ore("pin", item.id, ...(on ? (now ? [] : ["--undo"]) : was ? ["--at", was] : ["--undo"])),
    });
  };
  /** A pinned source moved to `to` among `pinned`, the pinned of its list in their order. */
  const movePinned = (item: Item, pinned: Item[], to: number) => {
    const from = pinned.findIndex((i) => i.id === item.id);
    if (from < 0 || to === from) return;
    const rest = pinned.filter((i) => i.id !== item.id);
    const at = pinBetween(rest[to - 1]?.pinned_at, rest[to]?.pinned_at);
    void env.change({
      message: `Moved “${item.title}”`,
      kind: "quiet",
      key: item.id,
      show: (on) => patch(item.id, (i) => ({ ...i, pinned_at: on ? at : item.pinned_at })),
      write: (on) => ore("pin", item.id, "--at", on ? at : item.pinned_at!),
    });
  };
  /** Move up and Move down among the pinned: a menu's way to the drag. */
  const pinMoves = (item: Item, pinned: Item[]) => {
    const at = pinned.findIndex((i) => i.id === item.id);
    if (!item.pinned_at || item.archived_at || at < 0) return [];
    return [
      ...(at > 0 ? [{ id: "pin-up", label: "Move up", run: () => movePinned(item, pinned, at - 1) }] : []),
      ...(at < pinned.length - 1 ? [{ id: "pin-down", label: "Move down", run: () => movePinned(item, pinned, at + 1) }] : []),
    ];
  };

  /** A title edited in place. Resolves false when the write failed (a toast said why), so the field keeps his words. */
  const retitle = (id: string, before: string, typed: string) => {
    const t = typed.trim();
    if (!t || t === before) return Promise.resolve(true);
    let first = true;
    let since: string | undefined;
    return env.change(valueChange({
      message: `Renamed to “${t}”`, kind: "quiet", key: id, field: `source ${id} title`, before, after: t,
      show: (title) => patch(id, (i) => ({ ...i, title: since ?? title })),
      write: async (title, from) => {
        since = undefined;
        // Undo and Redo must not replace a title written outside this history (F175), on either device.
        if (!first && (since = (await ore<Doc>("show", id)).title) !== from) throw new Error(`Left as “${since}”: it was renamed since`);
        first = false;
        since = undefined;
        await ore("edit", id, "--title", title);
      },
    }));
  };

  /** How much a source matters, over its skills' importance ("" hands it back to them). */
  const setImportance = (item: Item, p: Priority | "") => {
    const before = item.priority ?? "";
    const said = p ? LEVELS.find((l) => l.p === p)!.label : item.skills.length ? "same as its skills" : "Normal";
    return env.change(valueChange<Priority | "">({
      message: `${item.title}: ${said}`,
      kind: "quiet", key: item.id,
      field: `source ${item.id} priority`, before, after: p,
      show: (priority) => patch(item.id, (i) => ({ ...i, priority: priority || undefined })),
      write: (priority) => ore("edit", item.id, opt("priority", priority)),
    }));
  };

  /** Files a source under exactly `next` skills (its exercises follow), with Undo back to `before`. */
  const refile = (item: Item, next: string[], before: string[], changed: Skill) => {
    // Filing under an archived skill brings it back (D173); Undo archives it again.
    const revived = next.filter((id) => !before.includes(id) && isArchived(id));
    // Either way round: an Undo that files it under an archived skill again brings that skill back too.
    const archivedOne = [...next, ...before].some(isArchived);
    const edit = (skills: string[], cards?: CardSkills) => ore<{ cards_before?: CardSkills } | undefined>("edit", item.id, "--skills", skills.join(","), ...(cards ? [opt("cards", JSON.stringify(cards))] : []));
    // Each exercise gets back its own skills, not every skill the source had (Codex sweep 3): the write says which.
    let cards: CardSkills | undefined;
    return env.change({
      message: next.includes(changed.id) ? `Filed “${item.title}” under ${changed.name}` : `Removed “${item.title}” from ${changed.name}`,
      slot: `refile:${item.id}`,
      // One source's filings are written in the order he ticked them.
      key: item.id,
      show: (on) => patch(item.id, (i) => ({ ...i, skills: on ? next : before })),
      write: (on) =>
        (on ? edit(next).then((r) => void (cards = r?.cards_before)) : edit(before, cards).then(() => (revived.length ? rearchive(revived) : undefined))).finally(() => {
          if (archivedOne) env.reloadSkills();
        }),
    });
  };
  /** Files a source under a skill, or takes it off one. */
  const fileUnder = (item: Item, k: Skill) => refile(item, item.skills.includes(k.id) ? item.skills.filter((s) => s !== k.id) : [...item.skills, k.id], item.skills, k);

  /** Writes each of these sources in turn, as one step with one Undo and Redo. `after`: what follows the writes
   *  each way (a skill a filing brought back). */
  const batch = (message: string, sel: Item[], show: (forward: boolean) => void, write: (i: Item, forward: boolean) => Promise<unknown>, after?: (forward: boolean) => unknown) => {
    const was = env.cursor?.now;
    return env.change({
      message,
      key: sel.map((i) => i.id),
      show: (forward) => {
        show(forward);
        if (!forward && was !== undefined) env.cursor!.set(was);
      },
      write: (forward) => allOrNone([...sel.map((i) => (on: boolean) => write(i, on)), async (on) => void (await after?.(on))], forward),
    });
  };
  const archiveMany = (sel: Item[]) => batch(`Archived ${count(sel.length, "source")}`, sel, (f) => away(sel, f), (i, f) => ore("archive", i.id, ...(f ? [] : ["--undo"])));
  const restoreMany = (sel: Item[]) => batch(`Restored ${count(sel.length, "source")}`, sel, (f) => away(sel, !f), (i, f) => ore("archive", i.id, ...(f ? ["--undo"] : [])));
  const moveMany = (sel: Item[], to: Item["status"]) =>
    batch(`Moved ${count(sel.length, "source")} to ${to === "done" ? "Done" : "To read"}`, sel, each(sel, "status", () => to), (i, f) => ore("status", i.id, ...statusArgs(i, f ? to : i.status)));
  /** Puts `k` on each of these sources, or takes it off, each keeping its other skills. `what` names them. */
  const fileItems = (sel: Item[], what: string, k: Skill, on: boolean) => {
    const next = (i: Item) => (on ? [...new Set([...i.skills, k.id])] : i.skills.filter((s) => s !== k.id));
    // What each source's exercises were filed under before, so Undo puts each one back as it was.
    const was = new Map<string, CardSkills | undefined>();
    // Every completed filing owns its part of the revival. The last inverse rearchives it,
    // whether that inverse is normal Undo or compensation for a later failed source.
    const filed = new Set<string>();
    return batch(
      on ? `Filed ${what} under ${k.name}` : `Removed ${what} from ${k.name}`,
      sel,
      each(sel, "skills", next),
      async (i, f) => {
        const edit = async (forward: boolean) => {
          const cards = was.get(i.id);
          const restoreCards = cards ? [opt("cards", JSON.stringify(cards))] : [];
          if (forward) {
            const r = await ore<{ cards_before?: CardSkills } | undefined>("edit", i.id, "--skills", next(i).join(","));
            was.set(i.id, r?.cards_before);
            filed.add(i.id);
          } else {
            await ore("edit", i.id, "--skills", i.skills.join(","), ...restoreCards);
            filed.delete(i.id);
          }
        };
        await allOrNone([
          edit,
          async (forward) => {
            if (!forward && on && k.archived && !filed.size) await rearchive([k.id]);
          },
        ], f);
      },
      on && k.archived ? () => env.reloadSkills() : undefined,
    );
  };
  const fileMany = (sel: Item[], k: Skill, on: boolean) => fileItems(sel, count(sel.length, "source"), k, on);

  /** Archives a course's listed lessons (files and exercises kept), in one write. Undo brings back the lessons
   *  this Archive put away, not one he archived before it (F573): the write's answer names them. */
  const archiveCourse = (c: { id: string; title: string }, lessons: Item[]) => {
    let changed: string[] = [];
    const was = env.cursor?.now;
    return env.change({
      message: `Archived “${c.title}”`,
      key: [`course ${c.id}`, ...lessons.map((i) => i.id)],
      show: (on) => {
        away(on || !changed.length ? lessons : lessons.filter((l) => changed.includes(l.id)), on);
        if (!on && was !== undefined) env.cursor!.set(was);
      },
      write: (on) => (on ? ore<{ lessons: string[] }>("course", "archive", c.id).then((r) => void (changed = r.lessons)) : ore("course", "archive", c.id, "--undo", "--lessons", changed.join(","))),
    });
  };

  return { archive, restore, moveTo, pin, movePinned, pinMoves, retitle, setImportance, refile, fileUnder, archiveMany, restoreMany, moveMany, fileItems, fileMany, archiveCourse, rearchive };
}

export function skillActions(env: Lists) {
  const { ore } = env;
  /** Every skill, the archived ones in their collections too, so a layout written never loses one. */
  const whole = () => layoutOf(skillGroups(env.skills));
  /** Lays the skills out at once, then saves through `ore skills arrange`. Resolves false when the write was
   *  refused (said in a toast), so a rename field can open again with his words. */
  const arrange = (message: string, layout: SkillLayout, kind: "info" | "quiet" = "info") => {
    const before = whole();
    // From the skills as they are now: one made or renamed since the step keeps its place and its name.
    const show = (l: SkillLayout) =>
      env.setSkills((all) => {
        const byId = new Map(all.map((s) => [s.id, s]));
        const placed = l.flatMap((g) => g.skills.flatMap((id) => (byId.has(id) ? [{ ...byId.get(id)!, collection: g.collection || undefined }] : [])));
        const ids = new Set(placed.map((s) => s.id));
        return [...placed, ...all.filter((s) => !ids.has(s.id))];
      });
    return env.skillChange(valueChange({ message, kind, key: "sidebar layout", field: "sidebar layout", before, after: layout, show, write: (value) => ore("skills", "arrange", JSON.stringify(value)) }));
  };
  /** Files a skill under another collection (or none), at the end of it. */
  const move = (s: Skill, collection: string) => {
    const out = whole().map((g) => ({ ...g, skills: g.skills.filter((id) => id !== s.id) }));
    const into = out.find((g) => g.collection === collection);
    const next = into ? out.map((g) => (g === into ? { ...g, skills: [...g.skills, s.id] } : g)) : [...out, { collection, skills: [s.id] }];
    return arrange(collection ? `Moved “${s.name}” to ${collection}` : `Moved “${s.name}” out of ${s.collection}`, next.filter((g) => g.skills.length));
  };
  /** Removes a collection: its skills, the archived ones too, join the ones in none. */
  const deleteCollection = (collection: string) => {
    const before = whole();
    const kept = before.filter((g) => g.collection !== collection);
    const freed = before.find((g) => g.collection === collection)?.skills ?? [];
    const rest = kept.find((g) => !g.collection);
    return arrange(`Deleted collection “${collection}”`, rest ? kept.map((g) => (g === rest ? { ...g, skills: [...freed, ...g.skills] } : g)) : [...kept, { collection: "", skills: freed }]);
  };
  /** Renames a collection, its archived skills with it; an empty name, the same one or "Other" changes nothing.
   *  Resolves false when the rename was refused (it said why), so the field opens again with what he typed. */
  const renameCollection = (from: string, to: string): Promise<boolean> => {
    const v = tidyCollection(to);
    if (!v || v === from || isOther(v)) return Promise.resolve(true);
    return arrange(`Renamed collection “${from}” to “${v}”`, whole().map((g) => (g.collection === from ? { ...g, collection: v } : g)));
  };

  /** Writes a skill's importance or archived flag (D173) at once, then saves through `ore`. */
  type Patch = Partial<Pick<Skill, "priority" | "archived">>;
  const set = (message: string, kind: "info" | "quiet", id: string, before: Patch, after: Patch) => {
    const skill = env.skills.find((s) => s.id === id);
    const current: { priority: Priority; archived: boolean } = { priority: skill?.priority ?? "P2", archived: !!skill?.archived };
    return env.skillChange(valueChange({
      message, kind, key: `skill ${id}`, field: `skill ${id} settings`,
      before: { ...current, ...before }, after: { ...current, ...after },
      rebase: (saved) => ({ ...saved, ...after }),
      show: (value) => env.setSkills((all) => all.map((k) => k.id === id ? { ...k, ...value } : k)),
      write: (to, from) => allOrNone([
        async (forward) => {
          if (to.priority !== from.priority) await ore("skills", "set", id, opt("priority", (forward ? to : from).priority));
        },
        async (forward) => {
          if (to.archived !== from.archived) await ore("skills", "archive", id, ...((forward ? to : from).archived ? [] : ["--undo"]));
        },
      ], true),
    }));
  };
  /** Picks a level; picking one on an archived skill brings it back too. */
  const setImportance = (s: Skill, p: Priority) => {
    // Archived only when it changes: a live skill's level is one write.
    const before = { priority: s.priority ?? "P2", ...(s.archived && { archived: true }) };
    const after = { priority: p, ...(s.archived && { archived: false }) };
    if (before.priority === p && !s.archived) return;
    void set(`${s.name}: ${LEVELS.find((l) => l.p === p)!.label}`, before.archived ? "info" : "quiet", s.id, before, after);
  };
  /** Archives a skill or brings it back: said in a toast, since it moves in the list. */
  const archive = (s: Skill, on: boolean) => void set(on ? `Archived “${s.name}”` : `Brought back “${s.name}”`, "info", s.id, { archived: !on }, { archived: on });
  const collections = () => [...new Set(env.skills.flatMap((s) => (s.collection ? [s.collection] : [])))];

  return { arrange, move, deleteCollection, renameCollection, setImportance, archive, collections };
}
