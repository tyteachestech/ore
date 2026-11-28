import { expect, test } from "bun:test";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findCard, listCards, writeNewCard } from "../src/cards.ts";
import { openIndex, rebuildIndex } from "../src/db.ts";
import { doctor } from "../src/doctor.ts";
import { addText } from "../src/ingest/index.ts";
import { paths } from "../src/library.ts";
import { tempLibrary } from "./helpers.ts";

for (const prefix of ["000-copy-", "zzz-copy-"]) test(`canonical exercise wins over ${prefix} copy in lists, direct reads and index`, async () => {
  const lib = await tempLibrary();
  const item = await addText(lib, "# Lesson\n\nRecall helps learning.\n");
  const card = writeNewCard(lib, { kind: "card", item: item.meta.id, skills: [], topics: [], content_type: "fact", question: "What helps learning?", answer: "Recall", rubric: [] });
  const copy = join(paths.cards(lib), `${prefix}${card.meta.id}.md`);
  const content = readFileSync(card.path, "utf8").replace("What helps learning?", "Which question is this?");
  writeFileSync(copy, content);
  for (const fix of [false, true]) {
    expect((await doctor(lib, { fix })).issues.some((i) => i.path === `cards/${prefix}${card.meta.id}.md`)).toBe(true);
    expect(listCards(lib).map((c) => c.question)).toEqual([card.question]);
    expect(findCard(lib, card.meta.id).question).toBe(card.question);
    rebuildIndex(lib);
    const index = openIndex(lib);
    try { expect(index.cards().map((c) => c.question)).toEqual([card.question]); } finally { index.close(); }
    expect(readFileSync(copy, "utf8")).toBe(content);
  }
  // A hand-renamed older file still reads when it is the only copy.
  rmSync(card.path);
  expect(listCards(lib).map((c) => c.question)).toEqual(["Which question is this?"]);
});
