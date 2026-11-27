import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { mergeSourceRows } from "../src/source-rows";
import { change } from "../src/change";
import { sourceActions } from "../src/list-actions";
import { readGuard } from "../src/reads";
import type { Item } from "../src/ore";

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
// Run each screen's actual loader and the shared actions without mounting a browser.
function screen(phone: boolean) {
  const source = readFileSync(new URL(phone ? "../src/phone/PhoneApp.tsx" : "../src/App.tsx", import.meta.url), "utf8");
  const start = source.indexOf("  const guard = useRef(readGuard()).current;");
  const end = source.indexOf(phone ? '  useEffect(() => void (tab === "archive"' : "  // Which reads of the skills", start);
  const code = new Bun.Transpiler({ loader: "tsx" }).transformSync(source.slice(start, end));
  const a = { id: "a", title: "A", skills: [], status: "reading" } as unknown as Item;
  const b = { ...a, id: "b", title: "B" };
  let items = [a, b], archived: Item[] = [];
  const disk = [a, b].map((i) => ({ ...i }));
  const calls: string[][] = [], held: (() => void)[] = [];
  const control = { hold: false, fail: false };
  let undo!: () => Promise<unknown>;
  const deps = {
    useRef: <T>(current: T) => ({ current }), useCallback: <T>(fn: T) => fn,
    readGuard, change, mergeSourceRows,
    notify: (_: string, _kind: unknown, inverse?: () => Promise<unknown>) => { if (inverse) undo = inverse; return () => {}; },
    ore: async (...args: string[]) => {
      calls.push(args);
      if (args[0] === "archive") {
        if (control.fail) throw new Error("Write failed");
        disk.find((i) => i.id === args[1])!.archived_at = args.includes("--undo") ? undefined : "2026-11-27";
        return;
      }
      if (args[0] === "edit") { disk.find((i) => i.id === args[1])!.skills = args[3]!.split(","); return; }
      if (args[0] !== "ls") return [];
      const rows = structuredClone(disk.filter((i) => args.includes("--ids") ? args[2]!.split(",").includes(i.id) : !!i.archived_at === args.includes("--archived")));
      return control.hold ? new Promise<Item[]>((resolve) => held.push(() => resolve(rows))) : rows;
    },
    setItems: (v: Item[] | ((all: Item[]) => Item[])) => { items = typeof v === "function" ? v(items) : v; },
    setArchived: (v: Item[] | ((all: Item[]) => Item[])) => { archived = typeof v === "function" ? v(archived) : v; },
    setListError() {}, errorText: String,
    tabNow: { current: "archive" }, removing: { current: new Set() }, setWaiting() {}, setSkills() {}, shareSkills() {}, setError() {}, setStartKnown() {},
  };
  const { listChange, refresh } = new Function(...Object.keys(deps), code + "\nreturn { listChange, refresh };")(...Object.values(deps));
  const actions = sourceActions({ ...deps, ore: deps.ore as never, change: listChange, skillChange: listChange, items: deps.setItems, archived: deps.setArchived, skills: [], reloadSkills() {} });
  return { a, disk, actions, refresh, control, calls, held, state: () => ({ items, archived }), undo: () => undo() };
}

for (const phone of [false, true]) {
  const device = phone ? "iPhone" : "Mac";
  test(`F294 ${device}: one archive reads one changed row; Undo and filing do the same`, async () => {
    const s = screen(phone);
    await s.actions.archive(s.a); await settle();
    expect(s.calls.filter((c) => c[0] === "ls")).toEqual([["ls", "--ids", "a"]]);
    expect(s.state().items.map((i) => i.id)).toEqual(["b"]);
    expect(s.state().archived.map((i) => i.id)).toEqual(["a"]);
    s.calls.length = 0;
    await s.undo(); await settle();
    expect(s.calls.filter((c) => c[0] === "ls")).toEqual([["ls", "--ids", "a"]]);
    expect(s.state().items.map((i) => i.id).sort()).toEqual(["a", "b"]);
    expect(s.state().archived).toEqual([]);
    s.calls.length = 0;
    await s.actions.refile(s.a, ["learning"], [], { id: "learning", name: "Learning" } as never); await settle();
    expect(s.calls.filter((c) => c[0] === "ls")).toEqual([["ls", "--ids", "a"]]);
    expect(s.state().items.find((i) => i.id === "a")!.skills).toEqual(["learning"]);
  });

  test(`F294 ${device}: an overlapping full read still refreshes unrelated rows and cannot land late`, async () => {
    const s = screen(phone);
    s.control.hold = true;
    const old = s.refresh();
    s.disk[1]!.title = "Outside rename";
    s.control.hold = false;
    await s.actions.archive(s.a); await settle();
    expect(s.calls.filter((c) => c[0] === "ls")).toEqual([["ls"], ["ls", "--archived"], ["ls"], ["ls", "--archived"]]);
    for (const land of s.held) land();
    await old; await settle();
    expect(s.state().items.map((i) => i.title)).toEqual(["Outside rename"]);
    expect(s.state().archived.map((i) => i.id)).toEqual(["a"]);
    // Once the full read has landed, a late old read must not force the next change to read both lists.
    s.calls.length = 0;
    await s.undo(); await settle();
    expect(s.calls.filter((c) => c[0] === "ls")).toEqual([["ls", "--ids", "a"]]);
  });

  test(`F294 ${device}: a failed first write rolls back without a needless read`, async () => {
    const s = screen(phone); s.control.fail = true;
    expect(await s.actions.archive(s.a)).toBe(false); await settle();
    expect(s.state().items.map((i) => i.id).sort()).toEqual(["a", "b"]);
    expect(s.state().archived).toEqual([]);
    expect(s.calls.filter((c) => c[0] === "ls")).toEqual([]);
  });
}
