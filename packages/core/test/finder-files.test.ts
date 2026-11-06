import { describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { openIndex } from "../src/db.ts";
import { listCards } from "../src/cards.ts";
import { doctor } from "../src/doctor.ts";
import { addSnippet } from "../src/ingest/index.ts";
import { listItems } from "../src/items.ts";
import { paths } from "../src/library.ts";
import { readReviews } from "../src/reviews.ts";
import { readSessions } from "../src/sessions.ts";
import { listTopics } from "../src/topics.ts";
import { tempLibrary } from "./helpers.ts";

// Finder drops .DS_Store (and AppleDouble ._ files on some drives) into any folder he opens.
describe("Finder files in the library", () => {
  test("are skipped by every folder walk", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Retrieval practice beats rereading." });
    const junk = [
      join(paths.items(lib), ".DS_Store"),
      join(dirname(item.dir), ".DS_Store"),
      join(item.dir, ".DS_Store"),
      join(paths.skillNotes(lib), ".DS_Store"),
      join(paths.cards(lib), "._x.md"),
      join(paths.topics(lib), "._x.md"),
      join(paths.reviews(lib), "._2026-10.jsonl"),
      join(paths.sessions(lib), ".DS_Store"),
    ];
    for (const f of junk) {
      mkdirSync(dirname(f), { recursive: true });
      writeFileSync(f, "\0\x05\x16\x07 not json or yaml");
    }
    expect(listItems(lib).map((i) => i.meta.id)).toEqual([item.meta.id]);
    const index = openIndex(lib);
    try {
      expect(new Set(index.search("retrieval").map((h) => h.item))).toEqual(new Set([item.meta.id]));
    } finally {
      index.close();
    }
    expect(listCards(lib)).toEqual([]);
    expect(listTopics(lib)).toEqual([]);
    expect(readReviews(lib)).toEqual([]);
    expect(readSessions(lib)).toEqual([]);
    expect((await doctor(lib)).issues.filter((i) => i.level === "error")).toEqual([]);
  });
});
