import { expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { openIndex } from "../src/db.ts";
import { addText } from "../src/ingest/index.ts";
import { paths } from "../src/library.ts";
import { tempLibrary } from "./helpers.ts";

for (const damage of ["junk", "truncated"]) test(`search rebuilds a ${damage} index without changing its source`, async () => {
  const lib = await tempLibrary();
  const item = await addText(lib, "# Index\n\nUniquequartz is preserved.");
  const source = readFileSync(item.docPath, "utf8");
  openIndex(lib).close();
  const path = paths.index(lib);
  writeFileSync(path, damage === "junk" ? "broken cache" : readFileSync(path).subarray(0, 100));
  const index = openIndex(lib);
  try { expect(index.search("Uniquequartz").some(r => r.ref === item.meta.id)).toBe(true); }
  finally { index.close(); }
  expect(readFileSync(item.docPath, "utf8")).toBe(source);
});
