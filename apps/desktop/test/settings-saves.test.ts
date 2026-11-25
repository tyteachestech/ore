import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { change, valueChange } from "../src/change";
import { inOrder, type Notify } from "../src/util";

// Run the screens' actual callbacks without mounting a window or replacing the shared change queue.
function settings(device: "phone" | "mac", failures: number) {
  const source = readFileSync(new URL(device === "phone" ? "../src/phone/Settings.tsx" : "../src/Settings.tsx", import.meta.url), "utf8");
  const start = source.indexOf(device === "phone" ? "  const set = <K extends Key>" : "  const setting = async");
  const end = source.indexOf(device === "phone" ? "\n  /** On asks iOS" : "\n  /** The reminder lives", start);
  if (start < 0 || end < 0) throw new Error("Settings callback not found");
  const code = new Bun.Transpiler({ loader: "tsx" }).transformSync(source.slice(start, end));
  let shown = { goal_minutes: 10 };
  let disk = 10;
  const now = { current: shown };
  const dataRef = { current: { review: shown } };
  const history: { undo: () => Promise<unknown> }[] = [];
  const errors: string[] = [];
  const notify: Notify = (message, kind, undo) => {
    const step = undo ? { undo: async () => undo() } : undefined;
    if (step) history.push(step);
    if (kind === "error") errors.push(message);
    return Object.assign(() => { if (step) history.splice(history.indexOf(step), 1); }, { undo() {}, hold() {} });
  };
  let release!: () => void;
  let began!: () => void;
  const started = new Promise<void>((r) => began = r);
  const held = new Promise<void>((r) => release = r);
  let calls = 0;
  const ore = async (cmd: string, option: string) => {
    if (cmd === "settings") return { review: { goal_minutes: disk } };
    const n = ++calls;
    if (n === 1) { began(); await held; }
    if (n <= failures) throw new Error("write refused");
    disk = Number(option.split("=")[1]);
  };
  const deps = {
    now, dataRef, change, valueChange, inOrder, notify, ore, SETTINGS: "settings",
    setReview: (v: typeof shown | ((v: typeof shown) => typeof shown)) => { shown = typeof v === "function" ? v(shown) : v; now.current = shown; },
    setData: (v: typeof dataRef.current) => { shown = v.review; dataRef.current = v; },
    opt: (k: string, v: string) => `--${k}=${v}`,
    planReminders() {}, FLAG: { goal_minutes: "minutes" }, NAME: { goal_minutes: "Minutes a day" },
  };
  const set = new Function(...Object.keys(deps), code + `; return ${device === "phone" ? "set" : "setGoal"};`)(...Object.values(deps));
  return {
    set: (n: number): Promise<boolean> => device === "phone" ? set("goal_minutes", n) : set("goal_minutes", "minutes", n),
    started, release: () => release(), history, errors, state: () => ({ shown: shown.goal_minutes, disk }),
  };
}

for (const device of ["phone", "mac"] as const) {
  test(`${device}: an older failed goal save never hides the newer saved goal, and Undo returns to the saved predecessor (PHONE-05)`, async () => {
    const s = settings(device, 1);
    const first = s.set(20);
    await s.started;
    const second = s.set(30);
    s.release();
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    await Promise.resolve();
    expect(s.state()).toEqual({ shown: 30, disk: 30 });
    expect(s.errors).toEqual(["write refused"]);
    await s.history[0]!.undo();
    await Promise.resolve();
    expect(s.state()).toEqual({ shown: 10, disk: 10 });
  });

  test(`${device}: two failed goal saves restore the last persisted goal (PHONE-05)`, async () => {
    const s = settings(device, 2);
    const first = s.set(20);
    await s.started;
    const second = s.set(30);
    s.release();
    await first;
    await second;
    await Promise.resolve();
    expect(s.state()).toEqual({ shown: 10, disk: 10 });
    expect(s.history).toEqual([]);
  });
}
