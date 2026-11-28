import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { readGuard } from "../src/reads";

// SOAK-02: run the real App list/skill loaders and return-from-absence effect.
// Like the saved focus-sidebar script, rename outside the page, flush the blur
// callback, advance twelve seconds, then focus. No browser, native app or CLI.
async function app() {
  const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const start = source.indexOf("  const guard = useRef(readGuard()).current;");
  const end = source.indexOf('  useEffect(() => save("ore.view"', start);
  if (start < 0 || end < 0) throw new Error("App reload callbacks not found");
  const code = new Bun.Transpiler({ loader: "tsx" }).transformSync(source.slice(start, end));
  type Skill = { id: string; name: string };
  const disk = { skills: [{ id: "creativity", name: "Creativity" }] as Skill[], sources: [{ title: "Before" }] };
  let skills: Skill[] = [], items: unknown[] = [], selected: string | null = "creativity", now = 1000, wakes = 0;
  let skillsLoading = true;
  const saved = new Map<string, string>();
  const commands: string[] = [];
  const events = new Map<string, () => void>();
  const timers = new Map<number, { fn: () => void; delay: number }>();
  const cleanups: (() => void)[] = [];
  let timerId = 0;
  const document = { activeElement: { tagName: "BODY" } };
  const deps = {
    useRef: <T>(current: T) => ({ current }),
    useCallback: <T>(fn: T) => fn,
    useEffect(fn: () => void | (() => void)) { const cleanup = fn(); if (cleanup) cleanups.push(cleanup); },
    readGuard, document, Date: { now: () => now },
    addEventListener: (name: string, fn: () => void) => events.set(name, fn),
    removeEventListener: (name: string) => events.delete(name),
    setTimeout: (fn: () => void, delay = 0) => { timers.set(++timerId, { fn, delay }); return timerId; },
    clearTimeout: (id: number) => timers.delete(id),
    ore: async (cmd: string) => {
      commands.push(cmd);
      if (cmd === "ls") return structuredClone(disk.sources);
      if (cmd === "inbox") return { added: [], failed: [] };
      throw new Error(`Unexpected command: ${cmd}`);
    },
    loadSkills: async () => { commands.push("skills"); return structuredClone(disk.skills); },
    setItems: (all: unknown[]) => { items = all; }, setArchived() {}, setListError() {},
    setSkills: (all: Skill[]) => { skills = all; },
    setSkillsLoading: (loading: boolean) => { skillsLoading = loading; },
    setSkill: (fn: (k: string | null) => string | null) => { selected = fn(selected); },
    save: (key: string, value: string) => saved.set(key, value), LAST_SKILLS: "ore.skills",
    notify() {}, errorText: (e: Error) => e.message,
    wakeScreens: () => { wakes++; },
  };
  new Function(...Object.keys(deps), code)(...Object.values(deps));
  const settle = () => new Promise<void>((resolve) => setImmediate(resolve));
  await settle();
  commands.length = 0;
  return {
    disk, commands,
    state: () => ({ skills, skillsLoading, items, selected, cached: JSON.parse(saved.get("ore.skills")!), wakes }),
    async back(after = 12_000, tagName = "BODY") {
      document.activeElement.tagName = tagName;
      events.get("blur")!();
      // The red script must flush this before advancing time too: iframe detection is deferred.
      for (const [id, timer] of timers) if (timer.delay === 0) { timers.delete(id); timer.fn(); }
      now += after;
      events.get("focus")!();
      await settle();
    },
    async focusAgain() { events.get("focus")!(); await settle(); },
    unmount() { cleanups.forEach((cleanup) => cleanup()); expect(events.size).toBe(0); expect(timers.size).toBe(0); },
  };
}

test("SOAK-02: returning after an outside rename refreshes sidebar skills, their cache and source lists", async () => {
  const a = await app();
  expect(a.state().skills[0]!.name).toBe("Creativity");
  expect(a.state().skillsLoading).toBe(false);
  a.disk.skills[0]!.name = "Soak external skill";
  a.disk.sources[0]!.title = "Outside edit";
  await a.back();
  expect(a.state().skills[0]!.name).toBe("Soak external skill");
  expect(a.state().cached).toEqual(a.disk.skills);
  expect(a.state().items).toEqual(a.disk.sources);
  expect(a.commands).toEqual(["ls", "ls", "skills", "inbox"]);
  expect(a.state().wakes).toBe(1);
  await a.focusAgain();
  expect(a.commands).toHaveLength(4);
  a.unmount();
});

test("SOAK-02: returning after an outside skill deletion clears its stale filter", async () => {
  const a = await app();
  a.disk.skills = [];
  await a.back();
  expect(a.state().selected).toBeNull();
  expect(a.state().skills).toEqual([]);
  a.unmount();
});

test("SOAK-02: a short absence or focus entering a video iframe does not reload", async () => {
  const a = await app();
  await a.back(9_999);
  expect(a.commands).toEqual([]);
  a.unmount();
  const video = await app();
  await video.back(12_000, "IFRAME");
  expect(video.commands).toEqual([]);
  video.unmount();
});
