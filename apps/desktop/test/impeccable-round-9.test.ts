// Small fixes from Impeccable round 9 (2026-11-15): docs/reviews/2026-11-15-design-critique-round-9.md.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { kindLabel } from "../src/filters";
import { missedOf } from "../src/util";

const src = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
const css = src("styles.css");
const sprite = (name: string) =>
  [...src("icons.tsx").match(new RegExp(`export const ${name} = sprite\\(\\[([\\s\\S]*?)\\]\\);`))![1]!.matchAll(/"([.#]{16})"/g)].map((r) => r[1]!);

test("a source's kind has one name: the filter, the rows and Add all say Text (F217)", () => {
  expect(kindLabel("markdown")).toBe("Text");
  // One map: All sources' rows read it from filters.ts instead of keeping their own.
  expect(src("App.tsx")).not.toMatch(/const KIND\b/);
  expect(src("App.tsx")).toContain("kindLabel(r.type)");
});

test("the pick bar's × is Clear the pick, with Esc on hover, as the Shortcuts sheet names it (F220)", () => {
  const bar = src("PickBar.tsx");
  expect(bar).not.toContain("Let go of the pick");
  expect(bar).toContain('<Hint text={<>Clear the pick <kbd>Esc</kbd></>}>');
  expect(bar).toContain('aria-label="Clear the pick"');
});

test("the − beside a + is the same bare stroke as the +'s bar, not a disc (F221)", () => {
  const minus = sprite("Minus");
  const plus = sprite("Plus");
  const bar = plus.filter((r) => r.split("#").length - 1 > 2);
  expect(minus.filter((r) => r.includes("#"))).toEqual(bar);
  expect(minus.findIndex((r) => r.includes("#"))).toBe(plus.indexOf(bar[0]!));
});

test("Home and Review say the goal is met the same way (F226)", () => {
  expect(src("Home.tsx")).not.toContain("Anything more is a bonus");
  expect(src("Home.tsx")).toContain('"Goal met. The rest is extra."');
});

test("a picked row's author and kind are lifted to muted, as on hover (F222)", () => {
  expect(css).toContain(".row:is(:hover, .on, .sel) :is(.kind, .sub, .snip, .col, .by, .course-next, .part)");
});

test("a menu's list fades within its own 4px padding, so it never scrolls sideways (F223)", () => {
  expect(css).toContain(".popover.menu [cmdk-list].fade-more { --fade-pad: 4px; }");
});

test("a source's title wraps balanced, never one word alone on its last line (F224)", () => {
  expect(css).toMatch(/\.doc-head h1 \{[^}]*text-wrap: balance/);
});

test("counts of one in the singular: a course's lessons on the iPhone, a missed key point in Review (F225)", () => {
  expect(src("phone/PhoneApp.tsx")).not.toContain("`${line.lessons.length} lessons`");
  expect(src("phone/PhoneApp.tsx")).toContain('count(line.lessons.length, "lesson")');
  expect(missedOf([false])).toBe("1 of 1 key point is marked missed.");
  expect(missedOf([false, true, true])).toBe("1 of 3 key points is marked missed.");
  expect(missedOf([false, false, true])).toBe("2 of 3 key points are marked missed.");
  // A point not marked yet is not a miss (code review on #422).
  expect(missedOf([false, undefined, undefined])).toBe("1 of 3 key points is marked missed.");
});

test("Tyler's round 9 picks: All sources' field is Search, the pick bar's move is Mark done (F227, F228)", () => {
  const app = src("App.tsx");
  expect(app).toContain('placeholder={filters.length ? "" : "Search"}');
  expect(app).toContain('aria-label="Search sources"');
  expect(app).not.toContain("Filter sources");
  expect(src("PickBar.tsx")).toContain('"Mark done"');
});
