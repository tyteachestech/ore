import { expect, test } from "bun:test";
import { writeNewCard } from "../src/cards.ts";
import { createItem } from "../src/items.ts";
import { tempLibrary } from "./helpers.ts";
import { readProbe } from "./helpers/read-probe.ts";

test("F727: a warm source filing does not read unrelated exercise files", async () => {
  const lib = await tempLibrary();
  const item = await createItem(lib, { type: "snippet", title: "Target", body: "An idea.", skills: [] });
  const make = (id: string) => writeNewCard(lib, { kind: "card", item: id, skills: [], topics: [], content_type: "fact", question: "What?", answer: "An idea.", rubric: [] });
  const target = make(item.meta.id), other = make("another-source");
  const probe = readProbe(lib, `
    const { itemCardSkills, fileItemSkills } = await import(core + "skills.ts");
    itemCardSkills(lib, ${JSON.stringify(item.meta.id)});
    active = true;
    const result = await fileItemSkills(lib, ${JSON.stringify(item.meta.id)}, ["habits"]);
  `);
  expect(probe.result.cards_before).toEqual({ [target.meta.id]: [] });
  expect(probe.reads.filter((p) => p === other.path)).toHaveLength(0);
  expect(probe.reads.filter((p) => p === target.path)).toHaveLength(2);
});

import { copyFileSync, readFileSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { listCards, readCardFile, writeCardMeta } from "../src/cards.ts";

test("source membership rebuilds and follows additions, hand edits, renamed files and duplicate winners", async () => {
  const lib = await tempLibrary();
  const make = (item: string) => writeNewCard(lib, { kind: "card", item, skills: [], topics: [], content_type: "fact", question: "What?", answer: "An idea.", rubric: [] });
  const a = make("source-a"), b = make("source-b");
  const sameAsFullRead = (item: string) => expect(listCards(lib, item)).toEqual(listCards(lib).filter((c) => c.meta.item === item));
  sameAsFullRead("source-a");
  const copy = a.path.replace(/\.md$/, " 2.md");
  copyFileSync(a.path, copy);
  writeCardMeta(readCardFile(copy), { ...a.meta, item: "source-b" });
  sameAsFullRead("source-b"); // The normal file wins, even when its copy names another source.
  const renamed = join(lib.root, "cards", "my exercise.md");
  renameSync(b.path, renamed);
  sameAsFullRead("source-b");
  // Same-length hand edit with its old mtime restored: ctime still invalidates the Mac cache.
  const before = statSync(renamed);
  writeFileSync(renamed, readFileSync(renamed, "utf8").replace("source-b", "source-a"));
  utimesSync(renamed, before.atime, before.mtime);
  sameAsFullRead("source-a");
  make("source-a");
  sameAsFullRead("source-a");
  rmSync(a.path);
  sameAsFullRead("source-b"); // The surviving copy is now the winner.
  writeFileSync(join(lib.root, ".index", "cards-by-source.json"), "broken cache");
  sameAsFullRead("source-b");
  rmSync(join(lib.root, ".index"), { recursive: true });
  sameAsFullRead("source-a");
  expect(listCards(lib, "no-exercises")).toEqual([]);
});
