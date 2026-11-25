import { expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { relative } from "node:path";
import { addText } from "../src/ingest/index.ts";
import { setNotes, skillNotesPath } from "../src/notes.ts";
import { loadSkills } from "../src/skills.ts";
import { tempLibrary } from "./helpers.ts";

test("a handwritten skill ID cannot overwrite a source note", async () => {
  const lib = await tempLibrary();
  const item = await addText(lib, "# Source\n\nPreserve this note.");
  await setNotes(lib, item.meta.id, "My original source note.");
  const id = "../" + relative(lib.root, item.dir);
  writeFileSync(lib.root + "/skills.yaml", JSON.stringify({ skills: [{ id, name: "Unsafe", priority: "P2" }] }));
  await expect(setNotes(lib, { skill: id }, "Replacement")).rejects.toThrow();
  expect(readFileSync(item.dir + "/notes.md", "utf8")).toBe("My original source note.");
});

for (const id of ["", "..", "../source", "a/b", "a\\b", "/absolute", "a..b"]) test(`invalid skill ID ${JSON.stringify(id)} is refused at read and path boundaries`, async () => {
  const lib = await tempLibrary();
  writeFileSync(lib.root + "/skills.yaml", JSON.stringify({ skills: [{ id, name: "Unsafe", priority: "P2" }] }));
  expect(() => loadSkills(lib)).toThrow();
  expect(() => skillNotesPath(lib, id)).toThrow();
});

test("Unicode skill slugs keep their own note folder", async () => {
  const lib = await tempLibrary();
  for (const id of ["日本語", "русский", "café", "safe-subject"]) {
    writeFileSync(lib.root + "/skills.yaml", JSON.stringify({ skills: [{ id, name: id, priority: "P2" }] }));
    await setNotes(lib, { skill: id }, id);
    expect(readFileSync(skillNotesPath(lib, id), "utf8")).toBe(id);
  }
});
