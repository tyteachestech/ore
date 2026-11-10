import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// D185: one motion system. Every everyday speed and every curve in the stylesheets is a token, so a new
// animation can't quietly bring its own. Longer, authored moments (over 400ms), stepped pixel frames and
// endless loops keep their own time.
const css = ["styles.css", "retro.css"].map((f) => readFileSync(join(import.meta.dir, "../src", f), "utf8")).join("\n");

test("curves are only defined as tokens", () => {
  const raw = css.match(/cubic-bezier\([^)]*\)/g) ?? [];
  expect(raw.length).toBe(3); // --ease-out, --ease-in-out, --ease-spring
  expect(css.match(/--ease-(out|in-out|spring): cubic-bezier/g)?.length).toBe(3);
});

test("no transition or animation of 400ms or less carries its own duration", () => {
  const stray: string[] = [];
  for (const [, , value] of css.matchAll(/((?:transition|animation)(?:-duration)?\s*:)([^;{}]*)/g)) {
    for (const part of value!.split(/,(?![^(]*\))/)) {
      if (/steps\(|infinite/.test(part)) continue;
      const first = part.match(/(?<![\w.-])(\d*\.?\d+)(ms|s)\b/);
      if (!first) continue;
      // After a token the first literal time is a delay, which is free.
      if (/var\(--t-/.test(part.slice(0, first.index))) continue;
      const ms = Number(first[1]) * (first[2] === "s" ? 1000 : 1);
      if (ms > 0 && ms <= 400) stray.push(part.trim());
    }
  }
  expect(stray).toEqual([]);
});

test("the spring is kept for moments: nothing that opens, slides or toggles uses it", () => {
  for (const [rule] of css.matchAll(/[^{}]*\{[^{}]*var\(--ease-spring\)[^{}]*\}/g)) {
    expect(rule).not.toMatch(/\.(menu|popover|panel|toast|switch-thumb|seg|side-item)\b[^{]*\{/);
  }
});
