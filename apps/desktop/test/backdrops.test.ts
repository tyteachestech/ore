import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// A sheet closed by a click on its backdrop unmounts the field he was typing in before it loses focus, so a field
// that saves on blur loses his typing (Edit skill's name, Codex sweep 5). Such a sheet closes through `onBackdrop`
// (Trap.tsx), which saves first and stays open when the save fails. Every backdrop that still closes bare is listed
// here with why: none of them holds a field that saves on a click away.
const BARE: Record<string, [number, string]> = {
  "Add.tsx": [1, "the add box: what he typed is an entry, not an edit in place; a click away cancels, as Spotlight's does"],
  "phone/AddLink.tsx": [1, "the phone's add box, as Add.tsx"],
  "Palette.tsx": [1, "a search field: nothing to save"],
  "ReviewPick.tsx": [1, "a list of skills to pick: no field"],
  "Outline.tsx": [1, "the sections sheet: a list, no field"],
  "Reader.tsx": [1, "the phone's Reading for sheet: a list of questions, no field"],
  "Menu.tsx": [1, "an action sheet: rows, no field"],
  "Skills.tsx": [1, "Delete skill's Keep or Archive choice: buttons, no field"],
  "Shortcuts.tsx": [1, "the list of shortcuts: read only"],
  "SkillPage.tsx": [1, "the recall box closes only while it is empty, so typing is never lost"],
  "phone/ReadingLooks.tsx": [1, "the reader's Aa: buttons and choices that apply at once, no field"],
  "Diagram.tsx": [1, "the diagram's close() saves the drawing itself before it goes"],
  "draw/Editor.tsx": [5, "the diagram's commands, map, link-to-node and link panels: lists and entry boxes applied with ↵, cancelled like Esc"],
};

test("every sheet backdrop that closes bare is listed, with why it has no field to save first", () => {
  const src = join(import.meta.dir, "../src");
  const found: Record<string, number> = {};
  for (const f of readdirSync(src, { recursive: true }).map(String).filter((f) => /\.tsx$/.test(f))) {
    const n = readFileSync(join(src, f), "utf8").match(/onMouseDown=\{\(e\) => [^}]*e\.target === e\.currentTarget/g)?.length ?? 0;
    if (n) found[f] = n;
  }
  expect(found).toEqual(Object.fromEntries(Object.entries(BARE).map(([f, [n]]) => [f, n])));
});
