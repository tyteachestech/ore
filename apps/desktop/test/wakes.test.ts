import { expect, test } from "bun:test";
import { wakesScreens } from "../src/ore";

// Codex sweep 5: a note's Linked from names the skills and sources that link to it, so renaming one,
// deleting it or putting it back reads every open screen again; a skill's goal, colour or icon doesn't.
test("a rename, delete or restore of a skill or source wakes open screens; other skill settings don't", () => {
  expect(wakesScreens(["skills", "set", "habits", "--name=Habit loops"])).toBe(true);
  expect(wakesScreens(["edit", "01ABC", "--title", "New title"])).toBe(true);
  expect(wakesScreens(["edit", "01ABC", "--title=New title"])).toBe(true);
  expect(wakesScreens(["skills", "rm", "habits"])).toBe(true);
  expect(wakesScreens(["skills", "restore", "{}"])).toBe(true);
  for (const quiet of ["--priority=high", "--color=red", "--icon=brain", "--goal=Ship it"]) expect(wakesScreens(["skills", "set", "habits", quiet])).toBe(false);
  expect(wakesScreens(["edit", "01ABC", "--author", "Ann"])).toBe(false);
});

// Codex UX sweep (iPhone): a source taken out of a skill left that skill's open page with its question and counts.
test("a source filed in or out of a skill wakes open screens", () => {
  expect(wakesScreens(["edit", "01ABC", "--skills", "learning"])).toBe(true);
  expect(wakesScreens(["edit", "01ABC", "--skills="])).toBe(true);
});

