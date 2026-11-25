import { expect, test } from "bun:test";
import { cpSync, mkdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { createItem, findItem, findItemDir, listItems } from "../src/items.ts";
import { tempLibrary } from "./helpers.ts";
import { readProbe } from "./helpers/read-probe.ts";

for (const operation of ["notes", "directory"]) test(`${operation} lookup checks only matching source documents`, async () => {
  const lib = await tempLibrary();
  const target = await createItem(lib, { type: "snippet", title: "Target", body: "A thought." });
  const other = await createItem(lib, { type: "snippet", title: "Other", body: "Another thought." });
  const probe = readProbe(lib, operation === "notes" ? `
    const { itemCommands } = await import(core + "../../cli/src/cmd-items.ts");
    active = true;
    const result = (await itemCommands.notes.run([${JSON.stringify(target.meta.id)}], { set: "My note" })).data;
  ` : `
    const { findItemDir } = await import(core + "items.ts");
    active = true;
    const result = findItemDir(lib, ${JSON.stringify(target.meta.id.toLowerCase())});
  `);
  expect(probe.checks.filter((p) => p === other.docPath)).toEqual([]);
  expect(probe.checks.filter((p) => p.endsWith("/doc.md")).every((p) => p === target.docPath)).toBe(true);
  if (operation === "directory") {
    expect(probe.result).toBe(target.dir);
    expect(probe.reads.filter((p) => p.endsWith("/doc.md"))).toEqual([]);
  }
});

test("filtered lookup keeps copy selection, prefix ambiguity, empty folders and renamed fallbacks", async () => {
  const lib = await tempLibrary();
  const a = await createItem(lib, { type: "snippet", title: "First", body: "A thought." });
  const b = await createItem(lib, { type: "snippet", title: "Second", body: "Another thought." });
  mkdirSync(join(dirname(a.dir), `empty-${a.meta.id}`));
  expect(findItem(lib, a.meta.id).dir).toBe(a.dir);
  cpSync(a.dir, join(dirname(a.dir), `copy-${a.meta.id}`), { recursive: true });
  const listed = listItems(lib).find((i) => i.meta.id === a.meta.id)!;
  expect(findItem(lib, a.meta.id).dir).toBe(listed.dir);
  expect(findItemDir(lib, a.meta.id)).toBe(listed.dir);
  expect(findItem(lib, a.meta.id.slice(-8)).dir).toBe(listed.dir);
  expect(() => findItem(lib, a.meta.id.slice(0, 2))).toThrow(/matches.*items/);
  const renamed = join(dirname(b.dir), "My renamed source");
  renameSync(b.dir, renamed);
  expect(findItem(lib, b.meta.id).dir).toBe(renamed);
  expect(findItemDir(lib, b.meta.id)).toBe(renamed);
});
