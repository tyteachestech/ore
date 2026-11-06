import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { addHighlight } from "../src/annotations.ts";
import { writeNewCard } from "../src/cards.ts";
import { openIndex } from "../src/db.ts";
import { sha256 } from "../src/fsutil.ts";
import { addSnippet } from "../src/ingest/index.ts";
import { createItem, findItem, updateItemMeta } from "../src/items.ts";
import { appendNote, appendNoteText, getNotes, notesPath, sectionLines, setChapterRecall, setNotes, setRecall } from "../src/notes.ts";
import { libraryStats, recordReview } from "../src/study.ts";
import { tempLibrary } from "./helpers.ts";

describe("appendNoteText (D31 append rule)", () => {
  test("new file gets the heading with no leading blank lines", () => {
    expect(appendNoteText("", "  First thought. ", "Recall")).toBe("## Recall\n\nFirst thought.");
    expect(appendNoteText("\n\n", "x", "Recall")).toBe("## Recall\n\nx");
  });

  test("existing heading: appended at the end of its block, before the next heading", () => {
    const cur = "Intro line.\n\n## Recall\n\nOne.\n\n## Use and connections\n\nAt work.\n";
    expect(appendNoteText(cur, "Two.", "Recall")).toBe("Intro line.\n\n## Recall\n\nOne.\n\nTwo.\n\n## Use and connections\n\nAt work.\n");
    expect(appendNoteText(cur, "In class.", "Use and connections")).toBe("Intro line.\n\n## Recall\n\nOne.\n\n## Use and connections\n\nAt work.\n\nIn class.");
  });

  test("a heading inside fenced code is code, not the block to append to", () => {
    const cur = "```md\n## Recall\n\nexample\n```\n";
    expect(appendNoteText(cur, "Mine.", "Recall")).toBe("```md\n## Recall\n\nexample\n```\n\n## Recall\n\nMine.");
    const two = "## Recall\n\nOne.\n\n```\n## Not a heading\n```\n\n## Next\n";
    expect(appendNoteText(two, "Two.", "Recall")).toBe("## Recall\n\nOne.\n\n```\n## Not a heading\n```\n\nTwo.\n\n## Next\n");
    expect(sectionLines("## Setup\n\n```sh\n## comment\nrun\n```")).toEqual([{ heading: "Setup", text: "```sh\n## comment\nrun\n```" }]);
  });

  test("new heading goes at the end", () => {
    expect(appendNoteText("My own synthesis.\n", "Chapter one is about X.", "Chapter 1 recall")).toBe("My own synthesis.\n\n## Chapter 1 recall\n\nChapter one is about X.");
  });

  test("text already present verbatim is not added again", () => {
    const cur = "## Recall\n\nRetrieval beats restudy.";
    expect(appendNoteText(cur, " Retrieval beats restudy. ", "Recall")).toBe(cur);
    expect(appendNoteText(cur, "Retrieval beats restudy.", "Other")).toBe(cur);
  });
});

async function setup() {
  const lib = await tempLibrary();
  const { item } = await addSnippet(lib, { text: "Retrieval practice strengthens memory more than restudy." });
  return { lib, id: item.meta.id };
}

describe("My notes storage", () => {
  test("get/set/append round-trip in notes.md; doc.md is untouched", async () => {
    const { lib, id } = await setup();
    const before = readFileSync(findItem(lib, id).docPath, "utf8");
    const empty = getNotes(lib, id);
    expect(empty.text).toBe("");
    expect(empty.path).toMatch(new RegExp(`^items/\\d{4}/.+-${id}/notes\\.md$`));
    expect(existsSync(notesPath(findItem(lib, id)))).toBe(false);

    const text = "# Thesis\n\nTesting *beats* rereading: it's effortful.\n";
    expect(await setNotes(lib, id, text)).toEqual({ item: id, text, path: empty.path, dir: findItem(lib, id).dir, merged: false });
    expect(getNotes(lib, id).text).toBe(text);
    const r = await appendNote(lib, id, "I'd use this in my course.", "Use and connections");
    expect(r.text).toBe(`${text.trimEnd()}\n\n## Use and connections\n\nI'd use this in my course.`);
    expect(readFileSync(notesPath(findItem(lib, id)), "utf8")).toBe(r.text);

    const item = findItem(lib, id);
    expect(readFileSync(item.docPath, "utf8")).toBe(before);
    expect(item.meta.text_sha256).toBe(sha256(item.body));

    await setNotes(lib, id, "");
    expect(existsSync(notesPath(findItem(lib, id)))).toBe(true);
    expect(getNotes(lib, id).text).toBe("");
    await expect(appendNote(lib, id, "  ", "Recall")).rejects.toThrow(/empty/);
  });

  test("recall --text is also appended to My notes under Recall", async () => {
    const { lib, id } = await setup();
    await setNotes(lib, id, "Written while reading.");
    const r = await setRecall(lib, id, " Testing yourself works. ");
    expect(r.notes).toBe("Written while reading.\n\n## Recall\n\nTesting yourself works.");
    expect(findItem(lib, id).meta.recall?.text).toBe("Testing yourself works.");
    const again = await setRecall(lib, id, "Testing yourself works.");
    expect(again.notes).toBe(r.notes);
    expect((await setRecall(lib, id, "Spacing too.")).notes).toBe(`${r.notes}\n\nSpacing too.`);
  });

  test("chapter recall upserts chapter_recalls[n], drops old feedback, and appends to notes", async () => {
    const lib = await tempLibrary();
    const book = await createItem(lib, { type: "epub", title: "Book", body: "<!-- chapter 1 -->\n\nOne idea.\n\n<!-- chapter 2 -->\n\nTwo ideas.\n" });
    const id = book.meta.id;
    const r = await setChapterRecall(lib, id, 2, "Two things.");
    expect(r).toMatchObject({ item: id, chapter: 2, recall: { text: "Two things." }, notes: "## Chapter 2 recall\n\nTwo things." });
    await setChapterRecall(lib, id, 1, "One thing.");
    const ai = { vendor: "claude", model: "m", prompt_version: "recall-feedback@2" };
    await updateItemMeta(lib, id, (m) => ({ ...m, chapter_recalls: m.chapter_recalls!.map((c) => ({ ...c, feedback: { feedback: "ok", missed: [], ai } })) }));
    const again = await setChapterRecall(lib, id, 2, "Two things, revised.");
    const meta = findItem(lib, id).meta;
    expect(meta.chapter_recalls!.map((c) => c.n)).toEqual([1, 2]);
    expect(meta.chapter_recalls![0]!.feedback).toBeDefined();
    expect(meta.chapter_recalls![1]).toEqual({ n: 2, text: "Two things, revised.", at: again.recall.at });
    expect(again.notes).toBe("## Chapter 2 recall\n\nTwo things.\n\nTwo things, revised.\n\n## Chapter 1 recall\n\nOne thing.");
    await expect(setChapterRecall(lib, id, 3, "x")).rejects.toThrow(/no <!-- chapter 3 --> marker/);
    await expect(setChapterRecall(lib, id, 0, "x")).rejects.toThrow(/positive integer/);
    // D115: the block he wrote in the note under the chapter's title is recorded, not appended twice.
    await setNotes(lib, id, `${again.notes}\n\n## The second idea\n\nMy own words.`);
    const block = await setChapterRecall(lib, id, 2, "My own words.", "The second idea");
    expect(block.notes.endsWith("## The second idea\n\nMy own words.")).toBe(true);
    expect(block.notes.split("My own words.").length).toBe(2);
  });

  test("search finds My notes text (kind notes, ref = item id) and follows edits", async () => {
    const { lib, id } = await setup();
    await setNotes(lib, id, "My metaphor: memory is a muddy path.");
    let idx = openIndex(lib);
    expect(idx.search("muddy")).toEqual([expect.objectContaining({ kind: "notes", ref: id, item: id })]);
    idx.close();
    await setNotes(lib, id, "Now about trails.");
    idx = openIndex(lib);
    expect(idx.search("muddy")).toEqual([]);
    expect(idx.search("trails").map((h) => h.kind)).toEqual(["notes"]);
    idx.close();
  });
});

describe("sectionLines (D32)", () => {
  test("blocks under non-reserved ## headings; recall and finish-line headings and empty blocks excluded", () => {
    const notes = [
      "Loose intro.",
      "## Recall", "", "From memory.",
      "## Why retrieval works", "", "Recall rebuilds the path.", "", "Second line.",
      "## Chapter 2 recall", "", "Chapter memory.",
      "## Use and connections", "", "In my course.",
      "## Use or dispute", "", "Old line.",
      "## Empty", "",
      "## Notes", "", "Headingless section line.",
    ].join("\n");
    expect(sectionLines(notes)).toEqual([
      { heading: "Why retrieval works", text: "Recall rebuilds the path.\n\nSecond line." },
      { heading: "Notes", text: "Headingless section line." },
    ]);
    expect(sectionLines("")).toEqual([]);
  });
});

describe("stats: own words vs no note (D34.8)", () => {
  test("splits retention counts by where a card was drafted from", async () => {
    const { lib, id } = await setup();
    const item = findItem(lib, id);
    const noted = addHighlight(item, { exact: "Retrieval practice", intent: "card", note: "Recall builds the path" });
    const bare = addHighlight(item, { exact: "more than restudy", intent: "card" });
    const mk = (extra: { annotation?: string; from?: "notes" | "prequestion"; prequestion?: number }) =>
      writeNewCard(lib, { kind: "card", item: id, skills: ["learning"], topics: [], content_type: "fact", question: "Q?", answer: "A", rubric: [], ...extra });
    // A prequestion prompt (D19) counts in neither group.
    const cards = [mk({ from: "notes" }), mk({ annotation: noted.id }), mk({ annotation: bare.id }), mk({}), mk({ from: "prequestion", prequestion: 1 })];
    const t0 = new Date("2026-01-01T12:00:00Z");
    for (const c of cards) {
      const first = await recordReview(lib, c.meta.id, { rating: 3, confidence: 2, now: t0 });
      await recordReview(lib, c.meta.id, { rating: 3, confidence: 2, now: new Date(Date.parse(first.due_next) + 86_400_000) });
    }
    const s = libraryStats(lib);
    const learning = s.skills.find((x) => x.skill === "learning")!;
    expect(learning).toMatchObject({ retention_n: 5, retention_own_words: null, retention_own_words_n: 2, retention_no_note: null, retention_no_note_n: 1 });
    expect(s.total).toMatchObject({ retention_own_words_n: 2, retention_no_note_n: 1 });
  });
});
