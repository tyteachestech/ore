// One thing keeps one name wherever it shows (round 8's consistency pass, F166, F167).
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { BINDINGS } from "../src/keys";

const src = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");

test("the Shortcuts row for ⌘C carries both names its menus use, so a search for either finds it", () => {
  const row = BINDINGS.find((k) => k.id === "copy")!.label;
  expect(row).toContain("Copy as Markdown"); // a source's menu
  expect(row).toContain("with the source"); // a highlight's button, "Copy with source"
});

test("Add's field and the empty lists say the same words", () => {
  const words = "Paste a link, a file or any text";
  expect(src("Add.tsx").includes(`placeholder="${words}…"`)).toBe(true);
  expect(src("App.tsx").includes(words)).toBe(true);
  expect(src("Home.tsx").includes(words)).toBe(true);
});
