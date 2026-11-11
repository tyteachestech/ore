import { describe, expect, test } from "bun:test";
import { findCard, writeCardMeta } from "../src/cards.ts";
import { addCellCard } from "../src/cell.ts";
import { addSnippet } from "../src/ingest/index.ts";
import { tempLibrary } from "./helpers.ts";

async function source() {
  const lib = await tempLibrary();
  const { item } = await addSnippet(lib, { text: "Sampling\n\n| Setting | What it changes | Range |\n|---|---|---|\n| **Top-p** | How much of the *probability mass* stays in play | 0.8 to 1 |\n| Top-k | How many candidates stay | 20 to 100 |\n\nNot a table: Top-k and 0.8 to 1." });
  return { lib, id: item.meta.id };
}

describe("cards from a table's cell (D200)", () => {
  test("a cell becomes a Fact card that asks its row and column, round-tripped through its file", async () => {
    const { lib, id } = await source();
    const c = await addCellCard(lib, id, { row: " Top-p ", column: "What it changes", answer: "How much of the probability mass\n stays in play" });
    expect(c.meta.kind).toBe("card");
    expect(c.meta.content_type).toBe("fact");
    expect(c.meta.state).toBe("draft");
    expect(c.meta.item).toBe(id);
    const again = findCard(lib, c.meta.id);
    expect(again.question).toBe("Top-p · What it changes?");
    expect(again.answer).toBe("How much of the probability mass stays in play");
  });

  test("refuses an empty cell, a missing row or column, and a row and answer no table row holds", async () => {
    const { lib, id } = await source();
    await expect(addCellCard(lib, id, { row: "Top-p", column: "Range", answer: " " })).rejects.toThrow("nothing to recall");
    await expect(addCellCard(lib, id, { row: "", column: "Range", answer: "0.8 to 1" })).rejects.toThrow("row and column");
    await expect(addCellCard(lib, id, { row: "Top-k", column: "Range", answer: "0.8 to 1" })).rejects.toThrow("aren’t in one row");
    await expect(addCellCard(lib, id, { row: "Top-p", column: "Range", answer: "1 to 2" })).rejects.toThrow("aren’t in one row");
  });

  test("a cell makes one exercise, and another once that one is retired", async () => {
    const { lib, id } = await source();
    const c = await addCellCard(lib, id, { row: "Top-k", column: "Range", answer: "20 to 100" });
    await expect(addCellCard(lib, id, { row: "Top-k", column: "Range", answer: "20 to 100" })).rejects.toThrow("already has an exercise");
    writeCardMeta(findCard(lib, c.meta.id), { ...findCard(lib, c.meta.id).meta, state: "retired" });
    expect((await addCellCard(lib, id, { row: "Top-k", column: "Range", answer: "20 to 100" })).meta.id).not.toBe(c.meta.id);
  });
});
