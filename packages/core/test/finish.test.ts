import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { parseFrontmatter } from "../src/frontmatter.ts";
import { addSnippet } from "../src/ingest/index.ts";
import { findItem, ItemMetaSchema, setPrequestionAttempt, updateItemMeta } from "../src/items.ts";
import { setRecall } from "../src/notes.ts";
import { tempLibrary } from "./helpers.ts";

async function setup() {
  const lib = await tempLibrary();
  const { item } = await addSnippet(lib, { text: "Retrieval practice strengthens memory more than restudy." });
  await updateItemMeta(lib, item.meta.id, (m) => ({ ...m, prequestions: [{ q: "Why does retrieval beat restudy?" }, { q: "When would restudy be enough?" }] }));
  return { lib, id: item.meta.id };
}

describe("prequestion attempts and free recall (D18)", () => {
  test("before/after and recall round-trip through doc.md; body and text_sha256 untouched", async () => {
    const { lib, id } = await setup();
    const before = findItem(lib, id);
    expect(await setPrequestionAttempt(lib, id, 1, { before: "no idea" })).toEqual({ item: id, n: 1, q: "Why does retrieval beat restudy?", before: "no idea" });
    expect(await setPrequestionAttempt(lib, id, 1, { after: " effortful recall strengthens the trace " })).toEqual({
      item: id, n: 1, q: "Why does retrieval beat restudy?", before: "no idea", after: "effortful recall strengthens the trace",
    });
    const r = await setRecall(lib, id, "Testing yourself works: it's \"effortful\"\nand durable: yes.");
    expect(Object.keys(r.recall)).toEqual(["text", "at"]);
    const after = findItem(lib, id);
    expect(after.body).toBe(before.body);
    expect(after.meta.text_sha256).toBe(before.meta.text_sha256);
    expect(after.meta.prequestions).toEqual([{ q: "Why does retrieval beat restudy?", before: "no idea", after: "effortful recall strengthens the trace" }, { q: "When would restudy be enough?" }]);
    expect(after.meta.recall).toEqual(r.recall);
    const raw = parseFrontmatter(readFileSync(after.docPath, "utf8"));
    expect(ItemMetaSchema.parse(raw.data)).toEqual(after.meta);
  });

  test("prequestion n out of range and flag validation", async () => {
    const { lib, id } = await setup();
    await expect(setPrequestionAttempt(lib, id, 0, { before: "x" })).rejects.toThrow(/out of range \(1-2\)/);
    await expect(setPrequestionAttempt(lib, id, 3, { before: "x" })).rejects.toThrow(/out of range/);
    await expect(setPrequestionAttempt(lib, id, 1, {})).rejects.toThrow(/exactly one of --before or --after/);
    await expect(setPrequestionAttempt(lib, id, 1, { before: "a", after: "b" })).rejects.toThrow(/exactly one/);
    await expect(setPrequestionAttempt(lib, id, 1, { after: "  " })).rejects.toThrow(/empty/);
    const { item: bare } = await addSnippet(lib, { text: "No enrichment yet." });
    await expect(setPrequestionAttempt(lib, bare.meta.id, 1, { before: "x" })).rejects.toThrow(/no prequestions/);
  });

  test("new recall text overwrites the old and clears its feedback", async () => {
    const { lib, id } = await setup();
    await setRecall(lib, id, "first");
    const ai = { vendor: "claude", model: "m", prompt_version: "recall-feedback@1" };
    await updateItemMeta(lib, id, (m) => ({ ...m, recall: { ...m.recall, feedback: { feedback: "ok", questions: [], missed: [], ai } } }));
    expect(findItem(lib, id).meta.recall?.feedback).toBeDefined();
    const r = await setRecall(lib, id, "second");
    expect(findItem(lib, id).meta.recall).toEqual({ text: "second", at: r.recall.at });
    await expect(setRecall(lib, id, " ")).rejects.toThrow(/empty/);
  });
});
