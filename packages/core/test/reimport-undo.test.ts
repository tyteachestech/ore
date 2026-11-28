import { afterEach, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { addHighlight, annotationRevs, readAnnotations, reviseAnnotation } from "../src/annotations.ts";
import { addSource, reimportSource, undoReimport } from "../src/ingest/index.ts";
import { findItem, setItemAuthor } from "../src/items.ts";
import { tempLibrary } from "./helpers.ts";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const body = "# Lesson\n\nAlpha practice strengthens recall.\n";
async function setup(author = "Original author") {
  const lib = await tempLibrary();
  let page = `---\nauthor: ${author}\n---\n\n${body}`;
  globalThis.fetch = (async () => new Response(page, { headers: { "content-type": "text/markdown" } })) as unknown as typeof fetch;
  const item = await addSource(lib, "https://example.test/lesson.md");
  return { lib, item, setPage: (next: string) => { page = next; } };
}

for (const original of ["Original author", ""]) test(`reimport Undo and Redo preserve an independent author correction (original: ${original || "absent"})`, async () => {
  const { lib, item, setPage } = await setup(original);
  setPage(`---\nauthor: Upstream author\n---\n\n${body}\nNew ending.\n`);
  const r = await reimportSource(lib, item.meta.id);
  await setItemAuthor(lib, item.meta.id, "Manual correction");
  const back = await undoReimport(lib, item.meta.id, r.step);
  expect(back.body).toBe(body);
  expect(back.meta.author).toBe("Manual correction");
  const redo = await undoReimport(lib, item.meta.id, r.step);
  expect(redo.body).toContain("New ending.");
  expect(redo.meta.author).toBe("Manual correction");
});

test("reimport Undo and Redo still reverse the author it added", async () => {
  const { lib, item, setPage } = await setup("");
  setPage(`---\nauthor: Upstream author\n---\n\n${body}\nNew ending.\n`);
  const r = await reimportSource(lib, item.meta.id);
  expect(r.item.meta.author).toBe("Upstream author");
  expect((await undoReimport(lib, item.meta.id, r.step)).meta.author).toBeUndefined();
  expect((await undoReimport(lib, item.meta.id, r.step)).meta.author).toBe("Upstream author");
});

for (const moved of [false, true]) test(`reimport Undo keeps a separately deleted highlight deleted (anchor moved: ${moved})`, async () => {
  const { lib, item, setPage } = await setup();
  const a = addHighlight(item, { exact: "Alpha practice strengthens recall.", intent: "keep" });
  setPage(moved ? body.replace("Alpha", "New introduction.\n\nAlpha") : body + "\nNew ending.\n");
  const r = await reimportSource(lib, item.meta.id);
  expect(r.removed).toHaveLength(0);
  const now = findItem(lib, item.meta.id);
  reviseAnnotation(now, readAnnotations(now).find((x) => x.id === a.id)!, { status: "deleted" });
  for (let n = 0; n < 3; n++) {
    const back = await undoReimport(lib, item.meta.id, r.step);
    expect(readAnnotations(back)).toHaveLength(0);
  }
});

test("reimport Undo restores its removed highlight while keeping a later note", async () => {
  const { lib, item, setPage } = await setup();
  const a = addHighlight(item, { exact: "Alpha practice strengthens recall.", intent: "keep" });
  setPage("# Lesson\n\nDifferent words about sleeping.\n");
  const r = await reimportSource(lib, item.meta.id);
  expect(r.removed.map((x) => x.id)).toEqual([a.id]);
  reviseAnnotation(r.item, annotationRevs(r.item.dir).filter((x) => x.id === a.id).at(-1)!, { note: "My later note" });
  const back = await undoReimport(lib, item.meta.id, r.step);
  expect(readAnnotations(back)).toHaveLength(1);
  expect(readAnnotations(back)[0]).toMatchObject({ exact: a.exact, note: "My later note" });
  expect(readAnnotations(await undoReimport(lib, item.meta.id, r.step))).toHaveLength(0);
});

test("reimport receipts written before after.json still undo and redo", async () => {
  const { lib, item, setPage } = await setup();
  const a = addHighlight(item, { exact: "Alpha practice strengthens recall.", intent: "keep" });
  setPage("# Lesson\n\nDifferent words about sleeping.\n");
  const r = await reimportSource(lib, item.meta.id);
  rmSync(join(lib.root, ".ore", "reimport", item.meta.id, r.step!, "after.json"));
  const back = await undoReimport(lib, item.meta.id, r.step);
  expect(back.body).toBe(body);
  expect(readAnnotations(back).map((x) => x.id)).toEqual([a.id]);
  expect(readAnnotations(await undoReimport(lib, item.meta.id, r.step))).toEqual([]);
});
