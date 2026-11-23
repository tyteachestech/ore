import { expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Codex UX sweeps 1 to 4 (F459, F467, F470, F480 and on): a change put on the Undo history only once its write had
// landed let a ⌘Z (or the shake) pressed meanwhile take back the step before it. Each such write is now marked with
// `whileOut` (ore.ts), which ⌘Z waits for, or its step goes on at once with `.hold(write)`. This finds a new one: a
// notify with an Undo that comes after an `await` in the lines before it, with neither.
const ALLOWED = [
  // A source added in the background by the phone's inbox, not a change he just asked for.
  "phone/PhoneApp.tsx: else notify(`Added “${a.title}”`",
  // Imports and fetches that can take a minute (a source added for a question, a feed followed, a page's text):
  // ⌘Z meanwhile acts on the steps already made, and theirs goes on once they land. Counted, they held ⌘Z for all.
  "SkillPage.tsx: else notify(`Added “${r.title}”`",
  "App.tsx: else notify(`Following ${r.feed.title}",
  "Reader.tsx: p.notify(`Added the page’s text",
  // The step goes on before its write (void go(true), then notify); its queue keeps Undo after the write.
  "App.tsx: notify(message, \"info\", () => go(false, true)",
];
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
});

test("a change whose step goes on the history after its write is marked, so ⌘Z waits for it", () => {
  const src = join(import.meta.dir, "../src");
  const found: string[] = [];
  for (const f of files(src)) {
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((l, i) => {
      if (!/notify\(.*"(info|quiet)",\s*(\(\)|async|[a-zA-Z_.]+\()/.test(l) || lines.slice(i, i + 3).join("\n").includes(".hold(")) return;
      // Its step goes on before the write: `const forget = notify(…)`, or the write started just before (`void go()`).
      if (/const forget =/.test(l) || /^\s*void /.test(lines[i - 1] ?? "")) return;
      const before = lines.slice(Math.max(0, i - 15), i).join("\n");
      if (!/await (?!whileOut)/.test(before) || before.includes("whileOut") || before.includes(".hold(")) return;
      const at = `${f.slice(src.length + 1)}: ${l.trim()}`;
      if (!ALLOWED.some((a) => at.startsWith(a))) found.push(at.slice(0, 140));
    });
  }
  expect(found).toEqual([]);
});
