import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { snapshot } from "../src/history.ts";
import { addSnippet } from "../src/ingest/index.ts";
import { mergeNotes, notesPath, setNotes } from "../src/notes.ts";
import { findItem } from "../src/items.ts";
import { tempLibrary } from "./helpers.ts";

const log = (root: string) => Bun.spawnSync(["git", "log", "--oneline"], { cwd: root }).stdout.toString().trim().split("\n").filter(Boolean);

describe("library history (D5)", () => {
  test("snapshots at most every ten minutes, unless forced", async () => {
    const lib = await tempLibrary();
    const now = Date.now();
    expect(snapshot(lib, { now }).committed).toBe(true);
    writeFileSync(join(lib.root, "skills.yaml"), readFileSync(join(lib.root, "skills.yaml"), "utf8") + "\n# edit\n");
    expect(snapshot(lib, { now: now + 60_000 }).committed).toBe(false);
    expect(snapshot(lib, { force: true }).committed).toBe(true);
    expect(snapshot(lib, { force: true }).committed).toBe(false); // nothing changed
    expect(log(lib.root)).toHaveLength(2);
  });
});

describe("source note saves never drop outside changes", () => {
  test("mergeNotes keeps his edit and an appended recall", () => {
    const base = "## Main idea\n\nSpacing works.\n";
    const mine = "## Main idea\n\nSpacing works because forgetting helps.\n";
    const theirs = base + "\n## Recall\n\nRetrieval beats restudy.\n";
    expect(mergeNotes(mine, base, theirs)).toBe("## Main idea\n\nSpacing works because forgetting helps.\n\n## Recall\n\nRetrieval beats restudy.\n");
  });

  test("his edit to the last line and an append right after it merge without a copy", () => {
    const base = "My first line.";
    const theirs = "My first line.\n\n## Agent\n\nAgent wrote this.";
    expect(mergeNotes("My first line. And more.", base, theirs)).toBe("My first line. And more.\n\n## Agent\n\nAgent wrote this.");
    expect(mergeNotes("Intro\n\nMy first line.", base, theirs)).toBe("Intro\n\nMy first line.\n\n## Agent\n\nAgent wrote this.");
  });

  test("both changed the same line: both versions stay, his first", () => {
    expect(mergeNotes("a\nmine\nc", "a\nb\nc", "a\ntheirs\nc")).toBe("a\nmine\ntheirs\nc");
  });

  test("setNotes with a stale base merges instead of overwriting", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Some source text." });
    const id = item.meta.id;
    await setNotes(lib, id, "One.\n");
    writeFileSync(notesPath(findItem(lib, id)), "One.\n\n## Recall\n\nFrom /ore.\n"); // an agent appends
    const r = await setNotes(lib, id, "One, edited.\n", "One.\n");
    expect(r.merged).toBe(true);
    expect(r.text).toBe("One, edited.\n\n## Recall\n\nFrom /ore.\n");
    expect(readFileSync(notesPath(findItem(lib, id)), "utf8")).toBe(r.text);
    const plain = await setNotes(lib, id, "Fresh.", r.text);
    expect(plain).toMatchObject({ merged: false, text: "Fresh." });
  });
});
