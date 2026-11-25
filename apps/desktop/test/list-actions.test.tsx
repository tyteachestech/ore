import { afterEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";

// What the Mac's and the iPhone's lists do (list-actions.ts), once for both, through the real toasts and history:
// what shows at once, what is written each way and in what order.
const w = new Window();
for (const k of ["window", "document", "HTMLElement", "Node", "MutationObserver", "getComputedStyle", "navigator"] as const) {
  const v = (w as unknown as Record<string, unknown>)[k];
  (globalThis as Record<string, unknown>)[k] = typeof v === "function" && /^[a-z]/.test(k) ? (v as (...a: unknown[]) => unknown).bind(w) : v;
}
const g = globalThis as Record<string, unknown>;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
g.requestAnimationFrame = (fn: (t: number) => void) => setTimeout(() => fn(performance.now()), 16);
g.cancelAnimationFrame = (id: number) => clearTimeout(id);
const { createRoot } = await import("react-dom/client");
const { TooltipProvider } = await import("@radix-ui/react-tooltip");
const { useToast } = await import("../src/Toast");
const { change } = await import("../src/change");
const { sourceActions, skillActions } = await import("../src/list-actions");
type Item = import("../src/ore").Item;
type Skill = import("../src/ore").Skill;

type Toasts = ReturnType<typeof useToast>;
const open = new Set<() => Promise<void>>();
afterEach(async () => {
  for (const done of [...open]) await done();
});
async function mount(): Promise<Toasts> {
  const at = document.createElement("div");
  document.body.appendChild(at);
  const root = createRoot(at);
  let toasts!: Toasts;
  const Host = () => {
    toasts = useToast();
    return <TooltipProvider>{toasts.view}</TooltipProvider>;
  };
  await act(async () => root.render(<Host />));
  const done = async () => {
    open.delete(done);
    await act(async () => root.unmount());
    at.remove();
  };
  open.add(done);
  return new Proxy({} as Toasts, { get: (_, k) => toasts[k as keyof Toasts] });
}
const tick = () => act(() => new Promise<void>((r) => setTimeout(r, 0)));

const item = (id: string, more: Partial<Item> = {}): Item => ({ id, type: "article", title: id.toUpperCase(), dir: `/lib/${id}`, captured_at: "2026-11-01T00:00:00Z", status: "reading", skills: [], ...more }) as Item;

/** A device's lists and a fake library: every `ore` call is kept, and lands at once unless `hold` is set. */
async function device(start: { items?: Item[]; archived?: Item[]; skills?: Skill[]; answers?: (args: string[]) => unknown } = {}) {
  const t = await mount();
  const state = { items: start.items ?? [], archived: start.archived ?? [], skills: start.skills ?? [], cursor: null as string | null, reads: 0, skillReads: 0 };
  const calls: string[] = [];
  const held: (() => void)[] = [];
  const lib = { hold: false, fail: null as string | null };
  const ore = <T,>(...args: string[]) => {
    calls.push(args.join(" "));
    if (lib.fail) return Promise.reject(new Error(lib.fail));
    const answer = start.answers?.(args) as T;
    return lib.hold ? new Promise<T>((land) => held.push(() => land(answer))) : Promise.resolve(answer);
  };
  const env = () => ({
    ore,
    skills: state.skills,
    items: (f: (all: Item[]) => Item[]) => void (state.items = f(state.items)),
    archived: (f: (all: Item[]) => Item[]) => void (state.archived = f(state.archived)),
    setSkills: (f: (all: Skill[]) => Skill[]) => void (state.skills = f(state.skills)),
    change: (c: Parameters<typeof change>[1]) => change(t.notify, { settled: () => void state.reads++, ...c }),
    skillChange: (c: Parameters<typeof change>[1]) => change(t.notify, { settled: () => void state.skillReads++, ...c }),
    reloadSkills: () => void state.skillReads++,
    cursor: { now: state.cursor, set: (id: string | null) => void (state.cursor = id) },
  });
  // The newest lists each time, as a screen's render gives them.
  return { t, state, calls, held, lib, sources: () => sourceActions(env()), skills: () => skillActions(env()) };
}
const ids = (l: Item[]) => l.map((i) => i.id).join(",");

test("Archive takes a source to the Archive list at once; Undo brings it back and selects it; Restore is its mirror", async () => {
  const d = await device({ items: [item("a"), item("b")] });
  await act(async () => void d.sources().archive(d.state.items[0]!));
  expect(ids(d.state.items)).toBe("b");
  expect(ids(d.state.archived)).toBe("a");
  expect(d.state.archived[0]!.archived_at).toBeTruthy();
  await tick();
  await act(async () => d.t.undo());
  await tick();
  expect(ids(d.state.items)).toBe("a,b");
  expect(d.state.items[0]!.archived_at).toBeUndefined();
  expect(ids(d.state.archived)).toBe("");
  expect(d.state.cursor).toBe("a");
  expect(d.calls).toEqual(["archive a", "archive a --undo"]);

  const e = await device({ archived: [item("z", { archived_at: "2026-11-02T00:00:00Z" })] });
  await act(async () => void e.sources().restore(e.state.archived[0]!));
  await tick();
  expect(ids(e.state.items)).toBe("z");
  expect(ids(e.state.archived)).toBe("");
  await act(async () => e.t.undo());
  await tick();
  expect(ids(e.state.archived)).toBe("z");
  expect(e.calls).toEqual(["archive z --undo", "archive z"]);
});

test("a Restore asked for while the source's Archive still saves is written after it (F622)", async () => {
  const d = await device({ items: [item("a")] });
  d.lib.hold = true;
  await act(async () => void d.sources().archive(d.state.items[0]!));
  await act(async () => void d.sources().restore(d.state.archived[0]!));
  expect(d.calls).toEqual(["archive a"]);
  d.held.shift()!();
  await tick();
  expect(d.calls).toEqual(["archive a", "archive a --undo"]);
  d.held.shift()!();
  await tick();
});

test("Move to Done shows at once; taken back, a finished source keeps the day it was finished", async () => {
  const d = await device({ items: [item("a", { status: "done", finished_at: "2026-11-03T00:00:00Z" })] });
  await act(async () => void d.sources().moveTo(d.state.items[0]!, "reading"));
  expect(d.state.items[0]!.status).toBe("reading");
  await tick();
  await act(async () => d.t.undo());
  await tick();
  expect(d.state.items[0]!.status).toBe("done");
  expect(d.calls).toEqual(["status a reading", "status a done --at=2026-11-03T00:00:00Z"]);
});

test("Undo of an Unpin puts the source back where it was among the pinned; Move up lands between its neighbours", async () => {
  const d = await device({ items: [item("a", { pinned_at: "2026-11-01T00:00:00.000Z" }), item("b", { pinned_at: "2026-11-01T00:00:10.000Z" }), item("c", { pinned_at: "2026-11-01T00:00:20.000Z" })] });
  await act(async () => void d.sources().pin(d.state.items[1]!));
  expect(d.state.items[1]!.pinned_at).toBeUndefined();
  await tick();
  await act(async () => d.t.undo());
  await tick();
  expect(d.calls).toEqual(["pin b --undo", "pin b --at 2026-11-01T00:00:10.000Z"]);
  const moves = d.sources().pinMoves(d.state.items[2]!, d.state.items);
  expect(moves.map((m) => m.id)).toEqual(["pin-up"]);
  await act(async () => moves[0]!.run());
  await tick();
  expect(d.calls.at(-1)).toBe("pin c --at 2026-11-01T00:00:05.000Z");
  expect(d.state.items[2]!.pinned_at).toBe("2026-11-01T00:00:05.000Z");
});

test("Undo of a filing under an archived skill archives the skill again, and each exercise gets its own skills back (F620)", async () => {
  const old: Skill = { id: "old", name: "Old", archived: true };
  const d = await device({ items: [item("a", { skills: ["ai"] })], skills: [{ id: "ai", name: "AI" }, old], answers: (a) => (a[0] === "edit" ? { cards_before: { c1: ["ai"] } } : undefined) });
  await act(async () => void d.sources().fileUnder(d.state.items[0]!, old));
  // At once, before the write.
  expect(d.state.items[0]!.skills).toEqual(["ai", "old"]);
  await tick();
  // The CLI brought the skill back: the skills are read again.
  expect(d.state.skillReads).toBeGreaterThan(0);
  await act(async () => d.t.undo());
  await tick();
  expect(d.state.items[0]!.skills).toEqual(["ai"]);
  expect(d.calls).toEqual(["edit a --skills ai,old", `edit a --skills ai --cards=${JSON.stringify({ c1: ["ai"] })}`, "skills archive old"]);
});

test("several sources filed under an archived skill: one Undo gives each its skills back and archives the skill again (F620)", async () => {
  const old: Skill = { id: "old", name: "Old", archived: true };
  const d = await device({ items: [item("a", { skills: ["ai"] }), item("b"), item("c")], skills: [old] });
  const sel = d.state.items.slice(0, 2);
  await act(async () => void d.sources().fileMany(sel, old, true));
  expect(d.state.items.map((i) => i.skills.join("+"))).toEqual(["ai+old", "old", ""]);
  await tick();
  await act(async () => d.t.undo());
  await tick();
  expect(d.state.items.map((i) => i.skills.join("+"))).toEqual(["ai", "", ""]);
  expect(ids(d.state.items)).toBe("a,b,c");
  expect(d.calls).toEqual(["edit a --skills ai,old", "edit b --skills old", "edit a --skills ai", "edit b --skills ", "skills archive old"]);
});

test("several archived as one step: one Undo brings all back, in place of the Archive list, and the selection returns", async () => {
  const d = await device({ items: [item("a"), item("b"), item("c")] });
  d.state.cursor = "b";
  const sel = [d.state.items[0]!, d.state.items[2]!];
  await act(async () => void d.sources().archiveMany(sel));
  expect(ids(d.state.items)).toBe("b");
  expect(ids(d.state.archived)).toBe("a,c");
  await tick();
  d.state.cursor = "x";
  await act(async () => d.t.undo());
  await tick();
  expect(ids(d.state.archived)).toBe("");
  expect(ids(d.state.items)).toBe("a,c,b");
  expect(d.state.cursor).toBe("b");
  expect(d.calls).toEqual(["archive a", "archive c", "archive a --undo", "archive c --undo"]);
});

test("several moved to Done, one of which fails: the ones written are written back and nothing has changed", async () => {
  const d = await device({ items: [item("a"), item("b")] });
  let n = 0;
  const sources = sourceActions({ ...envOf(d), ore: (...args: string[]) => (d.calls.push(args.join(" ")), ++n === 2 ? Promise.reject(new Error("The disk is full.")) : Promise.resolve(undefined as never)) });
  await act(async () => void sources.moveMany(d.state.items, "done"));
  await tick();
  expect(d.state.items.map((i) => i.status)).toEqual(["reading", "reading"]);
  expect(d.calls).toEqual(["status a done", "status b done", "status a reading"]);
  expect(d.t.history.canUndo).toBe(false);
});

test("Undo of Archive course brings back the lessons it archived, not one archived before (F573)", async () => {
  const lessons = [item("l1", { course: { id: "c", title: "Course", part: 1 } } as Partial<Item>), item("l2", { course: { id: "c", title: "Course", part: 2 } } as Partial<Item>)];
  const d = await device({ items: [...lessons, item("x")], answers: (a) => (a[0] === "course" && !a.includes("--undo") ? { lessons: ["l1"] } : undefined) });
  await act(async () => void d.sources().archiveCourse({ id: "c", title: "Course" }, lessons));
  expect(ids(d.state.items)).toBe("x");
  await tick();
  await act(async () => d.t.undo());
  await tick();
  expect(ids(d.state.items)).toBe("l1,x");
  expect(d.calls).toEqual(["course archive c", "course archive c --undo --lessons l1"]);
});

test("a skill moved to a collection shows at once and is written as a whole layout, archived skills kept in theirs", async () => {
  const d = await device({ skills: [{ id: "a", name: "A" }, { id: "b", name: "B", collection: "Work" }, { id: "gone", name: "Gone", collection: "Work", archived: true }] });
  await act(async () => void d.skills().move(d.state.skills[0]!, "Work"));
  expect(d.state.skills.find((s) => s.id === "a")!.collection).toBe("Work");
  await tick();
  expect(d.calls).toEqual([`skills arrange ${JSON.stringify([{ collection: "Work", skills: ["b", "gone", "a"] }])}`]);
  await act(async () => d.t.undo());
  await tick();
  expect(d.state.skills.find((s) => s.id === "a")!.collection).toBeUndefined();
  expect(d.state.skillReads).toBe(2);
  // A skill made or renamed since the step keeps its place and its name when the step is done again.
  d.state.skills = [...d.state.skills.map((s) => (s.id === "b" ? { ...s, name: "B2" } : s)), { id: "new", name: "New" }];
  await act(async () => d.t.redo());
  expect(d.state.skills.map((s) => s.name).sort()).toEqual(["A", "B2", "Gone", "New"]);
  await tick();
});

test("a collection renamed or deleted takes its archived skills with it (F621)", async () => {
  const skills: Skill[] = [{ id: "a", name: "A" }, { id: "b", name: "B", collection: "Work" }, { id: "gone", name: "Gone", collection: "Work", archived: true }];
  const d = await device({ skills });
  let ok: boolean | undefined;
  await act(async () => void d.skills().renameCollection("Work", "  Job ").then((r) => (ok = r)));
  await tick();
  expect(ok).toBe(true);
  expect(d.calls).toEqual([`skills arrange ${JSON.stringify([{ collection: "Job", skills: ["b", "gone"] }, { collection: "", skills: ["a"] }])}`]);
  expect(d.state.skills.filter((s) => s.collection === "Job").map((s) => s.id)).toEqual(["b", "gone"]);

  const e = await device({ skills });
  await act(async () => void e.skills().deleteCollection("Work"));
  await tick();
  expect(e.calls).toEqual([`skills arrange ${JSON.stringify([{ collection: "", skills: ["b", "gone", "a"] }])}`]);
  // The same name, an empty one or "Other" changes nothing.
  for (const name of ["Work", " ", "Other"]) expect(await e.skills().renameCollection("Work", name)).toBe(true);
  expect(e.calls.length).toBe(1);
});

test("a level picked on an archived skill brings it back too, as one step: both written, both taken back", async () => {
  const d = await device({ skills: [{ id: "a", name: "A", archived: true, priority: "P3" }] });
  await act(async () => d.skills().setImportance(d.state.skills[0]!, "P1"));
  expect(d.state.skills[0]).toMatchObject({ priority: "P1", archived: false });
  await tick();
  await act(async () => d.t.undo());
  await tick();
  expect(d.state.skills[0]).toMatchObject({ priority: "P3", archived: true });
  expect(d.calls).toEqual(["skills set a --priority=P1", "skills archive a --undo", "skills set a --priority=P3", "skills archive a"]);
});

/** A device's env with its own `ore` swapped (a write that fails part-way). */
function envOf(d: Awaited<ReturnType<typeof device>>) {
  return {
    skills: d.state.skills,
    items: (f: (all: Item[]) => Item[]) => void (d.state.items = f(d.state.items)),
    archived: (f: (all: Item[]) => Item[]) => void (d.state.archived = f(d.state.archived)),
    setSkills: (f: (all: Skill[]) => Skill[]) => void (d.state.skills = f(d.state.skills)),
    change: (c: Parameters<typeof change>[1]) => change(d.t.notify, c),
    skillChange: (c: Parameters<typeof change>[1]) => change(d.t.notify, c),
    reloadSkills: () => {},
  };
}

test("a later move of one source waits for an older batch touching that source", async () => {
  const d = await device({ items: [item("batch-a"), item("batch-b")] });
  d.lib.hold = true;
  await act(async () => { void d.sources().moveMany(d.state.items, "done"); });
  await act(async () => { void d.sources().moveTo(d.state.items[1]!, "reading"); });
  const beforeRelease = [...d.calls];
  d.lib.hold = false;
  for (const land of d.held) land();
  await tick(); await tick();
  expect(beforeRelease).toEqual(["status batch-a done"]);
  expect(d.calls).toEqual(["status batch-a done", "status batch-b done", "status batch-b reading"]);
  expect(d.state.items[1]!.status).toBe("reading");
});

test("Undo of importance after an earlier failed save restores the last saved importance", async () => {
  const t = await mount();
  let items = [item("importance-failure")];
  let saved: string | undefined;
  let fail!: (e: Error) => void;
  let first = true;
  const calls: string[] = [];
  const run = async <T,>(...args: string[]): Promise<T> => {
    calls.push(args.join(" "));
    if (first) {
      first = false;
      await new Promise<void>((_, reject) => { fail = reject; });
    }
    saved = args[2]!.split("=")[1] || undefined;
    return undefined as T;
  };
  const actions = () => sourceActions({
    ore: run, skills: [], items: (f) => { items = f(items); }, archived() {}, setSkills() {}, reloadSkills() {},
    change: (c) => change(t.notify, c), skillChange: (c) => change(t.notify, c),
  });
  let a!: Promise<boolean>, b!: Promise<boolean>;
  await act(async () => { a = actions().setImportance(items[0]!, "P1"); });
  await act(async () => { b = actions().setImportance(items[0]!, "P3"); });
  await act(async () => { fail(new Error("first edit refused")); await Promise.all([a, b]); });
  expect(saved).toBe("P3");
  const shownAfterSave = items[0]!.priority;
  await act(async () => t.undo()); await tick();
  expect(saved).toBeUndefined();
  expect(items[0]!.priority).toBeUndefined();
  expect(t.history.canUndo).toBe(false);
  expect(calls.at(-1)).toBe("edit importance-failure --priority=");
  expect(shownAfterSave).toBe("P3");
});

test("a failed batch filing puts its revived skill back in Archive with no Undo left", async () => {
  const old: Skill = { id: "rollback-skill", name: "Old", archived: true };
  let archived = true;
  const filed = new Map<string, string[]>();
  const d = await device({ items: [item("rollback-a"), item("rollback-b")], skills: [old], answers: (a) => {
    if (a[0] === "edit") {
      if (a[1] === "rollback-b" && a[3] === old.id) throw new Error("second source refused");
      filed.set(a[1]!, a[3] ? a[3].split(",") : []);
      if (a[3] === old.id) archived = false;
    }
    if (a[0] === "skills" && a[1] === "archive") archived = true;
  } });
  let ok = true;
  await act(async () => { ok = await d.sources().fileMany(d.state.items, old, true); });
  expect(ok).toBe(false);
  expect(filed.get("rollback-a")).toEqual([]);
  expect(archived).toBe(true);
  expect(d.state.items.map((i) => i.skills)).toEqual([[], []]);
  expect(d.t.history.canUndo).toBe(false);
});

test("archiving a skill after its failed importance edit does not save that failed importance", async () => {
  let fail!: (e: Error) => void;
  let first = true;
  const t = await mount();
  let skills: Skill[] = [{ id: "skill-patch", name: "Skill", priority: "P3" }];
  let saved: Skill = { ...skills[0]! };
  const env = () => ({
    ore: async <T,>(...a: string[]): Promise<T> => {
      if (first) { first = false; await new Promise<void>((_, no) => { fail = no; }); }
      if (a[1] === "set") saved.priority = a[3]!.split("=")[1] as Skill["priority"];
      else saved.archived = !a.includes("--undo");
      return undefined as T;
    },
    skills, items() {}, archived() {}, setSkills: (f: (all: Skill[]) => Skill[]) => { skills = f(skills); }, reloadSkills() {},
    change: (c: Parameters<typeof change>[1]) => change(t.notify, c), skillChange: (c: Parameters<typeof change>[1]) => change(t.notify, c),
  });
  await act(async () => { skillActions(env()).setImportance(skills[0]!, "P1"); });
  await act(async () => { skillActions(env()).archive(skills[0]!, true); });
  fail(new Error("importance refused")); await tick();
  expect(saved.priority).toBe("P3");
  expect(saved.archived).toBe(true);
  expect(skills[0]!.priority).toBe("P3");
  await act(async () => t.undo()); await tick();
  expect(saved.priority).toBe("P3");
  expect(saved.archived).toBe(false);
});

test("list title Undo and Redo preserve a newer external title (PHONE-03)", async () => {
  let disk = "Original";
  const d = await device({ items: [item("a", { title: disk })], answers: (args) => {
    if (args[0] === "show") return { title: disk };
    if (args[0] === "edit") disk = args[3]!;
  } });
  await act(async () => void await d.sources().retitle("a", "Original", "Phone"));
  await act(async () => d.t.undo());
  await tick();
  expect(disk).toBe("Original");
  await act(async () => d.t.redo());
  await tick();
  expect(disk).toBe("Phone");
  disk = "Mac";
  await act(async () => d.t.undo());
  await tick();
  expect(disk).toBe("Mac");
  expect(d.state.items[0]!.title).toBe("Mac");
  expect(document.body.textContent).toContain("it was renamed since");
});
