import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openIndex } from "../src/db.ts";
import { addSnippet } from "../src/ingest/index.ts";
import { allItems, findItem, listItems, setItemArchived, setItemPinned } from "../src/items.ts";
import { loadSkills, removeSkill, restoreSkill } from "../src/skills.ts";
import { tempLibrary } from "./helpers.ts";

const search = (lib: Awaited<ReturnType<typeof tempLibrary>>, q: string) => {
  const index = openIndex(lib);
  try {
    return index.search(q).map((h) => h.item);
  } finally {
    index.close();
  }
};

describe("archive a source", () => {
  test("hides it from lists and search, keeps its files, and --undo brings it back", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Interleaving mixes problem types." });
    const id = item.meta.id;
    expect(search(lib, "interleaving")).toContain(id);
    await setItemArchived(lib, id, true);
    expect(listItems(lib).map((i) => i.meta.id)).not.toContain(id);
    expect(listItems(lib, { archived: true }).map((i) => i.meta.id)).toEqual([id]);
    expect(allItems(lib).map((i) => i.meta.id)).toEqual([id]); // live and archived in one read
    expect(findItem(lib, id).body).toBe(item.body);
    expect(search(lib, "interleaving")).not.toContain(id);
    await setItemArchived(lib, id, false);
    expect(findItem(lib, id).meta.archived_at).toBeUndefined();
    expect(search(lib, "interleaving")).toContain(id);
  });
});

describe("search terms with + or #", () => {
  test('"c++" finds C++, not every c-word; "c#" finds C# only', async () => {
    const lib = await tempLibrary();
    const cpp = (await addSnippet(lib, { text: "Templates in C++ are compile-time." })).item.meta.id;
    const cs = (await addSnippet(lib, { text: "LINQ makes C# queries short." })).item.meta.id;
    const cats = (await addSnippet(lib, { text: "Cats sleep a lot, c is a letter." })).item.meta.id;
    const items = (q: string) => [...new Set(search(lib, q))].sort();
    expect(items("c++")).toEqual([cpp]);
    expect(items("C#")).toEqual([cs]);
    expect(items("c++ templates")).toEqual([cpp]);
    expect(items("c")).toEqual([cpp, cs, cats].sort());
  });
});

describe("delete a skill", () => {
  test("untags its sources by default; --archive archives only the ones filed nowhere else", async () => {
    const lib = await tempLibrary();
    const only = (await addSnippet(lib, { text: "Only habits.", skills: ["habits"] })).item.meta.id;
    const both = (await addSnippet(lib, { text: "Habits and focus.", skills: ["habits", "focus-attention"] })).item.meta.id;
    const r = await removeSkill(lib, "habits");
    expect(r).toMatchObject({ skill: { id: "habits" }, untagged: 2, archived: 0 });
    expect(loadSkills(lib).skills.some((s) => s.id === "habits")).toBe(false);
    expect(readFileSync(join(lib.root, "skills.yaml"), "utf8")).toContain("# Skills (D25)");
    expect(findItem(lib, only).meta.skills).toEqual([]);
    expect(findItem(lib, both).meta.skills).toEqual(["focus-attention"]);
    await expect(removeSkill(lib, "habits")).rejects.toThrow('unknown skill "habits"');

    const a = (await addSnippet(lib, { text: "Only focus.", skills: ["focus-attention"] })).item.meta.id;
    expect(await removeSkill(lib, "focus-attention", { archive: true })).toMatchObject({ untagged: 2, archived: 2 });
    expect(findItem(lib, a).meta.archived_at).toBeDefined();
    expect(findItem(lib, only).meta.archived_at).toBeUndefined();
  });

  test("restore puts the skill back in its place, refiles its sources and unarchives what the delete archived", async () => {
    const lib = await tempLibrary();
    const order = () => loadSkills(lib).skills.map((s) => s.id);
    const before = order();
    const only = (await addSnippet(lib, { text: "Only habits.", skills: ["habits"] })).item.meta.id;
    const both = (await addSnippet(lib, { text: "Habits and focus.", skills: ["focus-attention", "habits"] })).item.meta.id;
    const gone = (await addSnippet(lib, { text: "Archived already.", skills: ["habits"] })).item.meta.id;
    await setItemArchived(lib, gone, true);
    const r = await removeSkill(lib, "habits", { archive: true });
    expect(findItem(lib, only).meta.archived_at).toBeDefined();
    await restoreSkill(lib, JSON.parse(JSON.stringify(r.removed)));
    expect(order()).toEqual(before);
    expect(findItem(lib, only).meta.skills).toEqual(["habits"]);
    expect(findItem(lib, only).meta.archived_at).toBeUndefined();
    expect(findItem(lib, both).meta.skills).toEqual(["focus-attention", "habits"]);
    expect(findItem(lib, gone).meta.archived_at).toBeDefined(); // archived before the delete: stays archived
    await expect(restoreSkill(lib, r.removed)).rejects.toThrow("already exists");
  });
});

describe("pin a source", () => {
  test("stamps when it was pinned, keeps that stamp on a second pin, and --undo clears it", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Pinned sources come first." });
    const id = item.meta.id;
    const first = (await setItemPinned(lib, id, true)).pinned_at;
    expect(first).toBeString();
    expect((await setItemPinned(lib, id, true)).pinned_at).toBe(first!);
    expect(findItem(lib, id).body).toBe(item.body);
    await setItemPinned(lib, id, false);
    expect(findItem(lib, id).meta.pinned_at).toBeUndefined();
  });

  test("a pinned source moves among the pinned by its pin time; a time that isn't one is refused", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Pinned sources can be put in his order." });
    const id = item.meta.id;
    await setItemPinned(lib, id, true);
    expect((await setItemPinned(lib, id, true, "2020-01-01T00:00:00.000Z")).pinned_at).toBe("2020-01-01T00:00:00.000Z");
    await expect(setItemPinned(lib, id, true, "tomorrow")).rejects.toThrow(/ISO time/);
    expect(findItem(lib, id).meta.pinned_at).toBe("2020-01-01T00:00:00.000Z");
  });
});
