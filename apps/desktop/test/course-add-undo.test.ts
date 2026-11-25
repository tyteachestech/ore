import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

// Execute the complete Add handler with its IO boundary replaced, not a copy of its branches.
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const block = app.split("const addSources = useCallback(")[1]!.split("[notify, progress, refresh, skills, openSource, reloadSkills],")[0]!;
const source = new Bun.Transpiler({ loader: "ts" }).transformSync(`return (${block.trim().replace(/,$/, "")});`);

for (const branch of ["added", "filled", "kept"]) {
  test(`course re-add Undo and Redo include restored and filed lessons on the ${branch} branch`, async () => {
    let undo: (() => Promise<unknown>) | undefined;
    let redo: (() => Promise<unknown>) | undefined;
    const archived = new Set<string>(); // The import has restored old; active was already here.
    let filed = ["before", "new-skill"];
    const calls: string[][] = [];
    const receipt = {
      course: { id: "course", title: "Course" },
      lessons: branch === "added" ? [{ id: "new", title: "New" }] : [],
      filled: branch === "filled" ? ["old"] : [],
      failed: [], filed: ["new-skill"], restored: ["old"], skills: filed,
      first: { id: "old", title: "Old", status: "inbox" },
    };
    const env = {
      PHONE: true, skills: [], viewRef: { current: { openId: null } },
      progress() {}, refresh: async () => {}, reloadSkills() {},
      addArgs: () => ({ args: ["add", "https://course.test", "--course"], stdin: null }),
      listen: async () => () => {}, oreJob: async () => receipt,
      ore: async (...args: string[]) => {
        calls.push(args);
        if (args[0] === "course" && args[1] === "set") {
          filed = args.find((s) => s.startsWith("--skills="))!.slice(9).split(",");
        } else {
          const ids = args[0] === "archive" ? [args[1]!] : args.find((s) => s.startsWith("--lessons="))!.slice(10).split(",");
          for (const id of ids) args.includes("--undo") ? archived.delete(id) : archived.add(id);
        }
      },
      opt: (k: string, v: string) => `--${k}=${v}`, count: (n: number, t: string) => `${n} ${t}`,
      notify: (_s: string, _k: string, u: typeof undo, r: typeof redo) => { undo = u; redo = r; },
      setStatus() {}, setPlace() {}, setSkill() {}, setCursor() {}, setOpenId() {}, setFinishing() {}, clearToast() {}, openSource() {},
      errorText: (e: Error) => e.message,
    };
    const add = new Function(...Object.keys(env), source)(...Object.values(env));
    expect((await add([{ kind: "url", url: "https://course.test" }], [])).failure).toBeNull();
    expect(undo).toBeFunction();
    await undo!();
    expect([...archived].sort()).toEqual(branch === "added" ? ["new", "old"] : ["old"]);
    expect(filed).toEqual(["before"]);
    expect(calls.some((args) => args.includes("--lessons=old"))).toBe(true);
    await redo!();
    expect([...archived]).toEqual([]);
    expect(filed).toEqual(["before", "new-skill"]);
  });
}
