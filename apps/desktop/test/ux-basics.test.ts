import { expect, test } from "bun:test";
import { Glob } from "bun";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dir, "..", "src");
const read = (f: string) => readFileSync(join(SRC, f), "utf8");

// F444: `useLayoutEffect(() => el.scrollIntoView())` hands React whatever the call returns as the
// effect's clean-up. Where scrollIntoView answers with a promise (Chromium), React called it and the whole app
// went down on the iPhone's New skill. TypeScript can't see it (the DOM types say void), so the source is read.
test("no effect returns the value of a call that may answer with a promise (scroll, play, animate)", () => {
  const bad: string[] = [];
  for (const f of new Glob("**/*.{ts,tsx}").scanSync(SRC)) {
    read(f).split("\n").forEach((line, i) => {
      if (/use(Layout|Insertion)?Effect\(\s*\(\)\s*=>(?!\s*void\b)[^{\n]*\.(scrollIntoView|scrollTo|scrollBy|scroll|play|animate|requestFullscreen|writeText)\(/.test(line)) bad.push(`${f}:${i + 1}`);
    });
  }
  expect(bad).toEqual([]);
});

// F443: every window's tree sits in one last boundary, so a crash no screen caught still has a way back.
test("the whole app sits in a last-resort crash boundary with a way back", () => {
  const main = read("main.tsx");
  expect(/<Boundary what="Ore"[^>]*onBack=\{startOver\}>\s*\{PHONE \? <PhoneApp \/>/.test(main)).toBe(true);
  // The phone reopens at its saved place, which may be the screen that broke: starting over forgets it.
  expect(main.includes("if (PHONE) localStorage.removeItem(PLACE)")).toBe(true);
});

// F446: the setting never said what it styles.
test("Settings names the diagram's style controls as the diagram's", () => {
  const settings = read("Settings.tsx");
  expect(settings.includes('title="Diagram style controls"')).toBe(true);
  expect(settings.includes('title="Style controls"')).toBe(false);
});
