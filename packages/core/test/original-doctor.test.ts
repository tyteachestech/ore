import { expect, test } from "bun:test";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join, relative } from "node:path";
import { doctor } from "../src/doctor.ts";
import { addSource, addText } from "../src/ingest/index.ts";
import { sourceFile } from "../src/items.ts";
import { tempLibrary } from "./helpers.ts";

for (const name of ["notes.docx", "paper.pdf", "deck.pptx"]) test(`doctor reports a missing original for ${name} without inventing a repair`, async () => {
  const lib = await tempLibrary();
  const item = await addSource(lib, join(import.meta.dir, "fixtures/intake/files", name));
  expect((await doctor(lib)).issues).toEqual([]);
  const original = sourceFile(item)!;
  unlinkSync(original);
  const before = readFileSync(item.docPath);
  for (const fix of [false, true]) {
    const report = await doctor(lib, { fix });
    expect(report.issues).toContainEqual({
      level: "warn", path: relative(lib.root, item.dir),
      message: "no kept original; add the file again to restore it, or reimport from its link if it has one",
    });
    expect(report.fixed).toEqual([]);
    expect(existsSync(original)).toBe(false);
    expect(readFileSync(item.docPath)).toEqual(before);
  }
});

test("doctor does not require an original for plain text or a pending transcript", async () => {
  const lib = await tempLibrary();
  const pasted = await addText(lib, "# My note\n\nThese are words I wrote myself.");
  unlinkSync(sourceFile(pasted)!);
  const { createItem } = await import("../src/items.ts");
  await createItem(lib, { type: "article", title: "Waiting for audio", body: "", url: "https://example.com/episode", owed: ["transcript"] });
  expect((await doctor(lib)).issues).toEqual([]);
});
