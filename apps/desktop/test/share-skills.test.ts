import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dots } from "../src/dots";
import { FIXES } from "../src/skill-icon-fixes";
import { SKILL_COLORS } from "../src/ore";
import { shareList } from "../src/phone/share-skills";

test("the share card gets each skill's icon as the dots the app draws, and its colour", () => {
  const [brain, plain, gone] = shareList([
    { id: "learning", name: "Learning", icon: "mc:brain", color: "green" },
    { id: "plain", name: "Plain" },
    { id: "old", name: "Old", icon: "📚", color: "nope" },
  ]);
  expect(brain!.color).toBe("#5fcf8a");
  // The same cells, in the same places, as the app's own path for this icon.
  const path = dots(FIXES.brain!);
  expect(brain!.dots!.length / 2).toBe(path.split("M").length - 1);
  for (let i = 0; i < brain!.dots!.length; i += 2) expect(path).toContain(`M${brain!.dots![i]! + 0.5} `);
  expect(plain).toEqual({ id: "plain", name: "Plain" });
  expect(gone).toEqual({ id: "old", name: "Old" });
});

test("an icon only in the automatic set comes through too", () => {
  const [s] = shareList([{ id: "a", name: "A", icon: "mc:anchor" }]);
  expect(s!.dots!.length).toBeGreaterThan(20);
});

test("the card's colours are the app's dark-theme skill colours", () => {
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  for (const c of SKILL_COLORS) {
    const hex = css.match(new RegExp(`--c-${c}: (#[0-9a-f]{6});`))![1]!;
    expect(shareList([{ id: "a", name: "A", color: c }])[0]!.color).toBe(hex);
  }
});
