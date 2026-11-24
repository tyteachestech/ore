import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { parseFrontmatter } from "../src/frontmatter.ts";
import { findCard, writeNewCard } from "../src/cards.ts";
import { createItem, findItem, renameItem, setItemAuthor } from "../src/items.ts";
import { addSkill, itemCardSkills, setItemSkills } from "../src/skills.ts";
import { tempLibrary } from "./helpers.ts";

describe("editing a source", () => {
  test("rename trims and refuses an empty title", async () => {
    const lib = await tempLibrary();
    const { meta } = await createItem(lib, { type: "markdown", title: "Old", body: "Text.\n" });
    expect((await renameItem(lib, meta.id, "  New title ")).title).toBe("New title");
    expect(findItem(lib, meta.id).meta.title).toBe("New title");
    expect(renameItem(lib, meta.id, "  ")).rejects.toThrow("needs a title");
  });

  test("rename keeps frontmatter he wrote by hand that Ore doesn't know, and still clears what it removes (F607)", async () => {
    const lib = await tempLibrary();
    const { meta, docPath } = await createItem(lib, { type: "markdown", title: "Old", body: "Text.\n", author: "Someone" });
    writeFileSync(docPath, readFileSync(docPath, "utf8").replace("---\n", '---\ncustom: "0012"\nmine:\n  - a\n'));
    await renameItem(lib, meta.id, "New title");
    await setItemAuthor(lib, meta.id, "");
    const data = parseFrontmatter(readFileSync(docPath, "utf8")).data;
    expect(data).toMatchObject({ title: "New title", custom: "0012", mine: ["a"] });
    expect("author" in data).toBe(false);
  });

  test("author: set by hand on one line, cleared when empty", async () => {
    const lib = await tempLibrary();
    const { meta } = await createItem(lib, { type: "pdf", title: "AIMA", body: "Text.\n" });
    expect((await setItemAuthor(lib, meta.id, "  Stuart Russell,\nPeter Norvig ")).author).toBe("Stuart Russell, Peter Norvig");
    expect(findItem(lib, meta.id).meta.author).toBe("Stuart Russell, Peter Norvig");
    expect((await setItemAuthor(lib, meta.id, "  ")).author).toBeUndefined();
    expect(findItem(lib, meta.id).meta.author).toBeUndefined();
  });

  test("re-filing moves its cards with it and refuses unknown skills", async () => {
    const lib = await tempLibrary();
    await addSkill(lib, "Writing"); // "learning" is a starter skill
    const { meta } = await createItem(lib, { type: "markdown", title: "S", body: "Text.\n", skills: ["learning"] });
    const card = writeNewCard(lib, { kind: "card", item: meta.id, skills: ["learning", "other"], topics: [], content_type: "fact", question: "Q?", answer: "A", rubric: [] });
    expect((await setItemSkills(lib, meta.id, ["writing"])).skills).toEqual(["writing"]);
    expect(findCard(lib, card.meta.id).meta.skills).toEqual(["other", "writing"]);
    expect(setItemSkills(lib, meta.id, ["nope"])).rejects.toThrow('unknown skill "nope"');
    expect((await setItemSkills(lib, meta.id, [])).skills).toEqual([]);
    expect(findCard(lib, card.meta.id).meta.skills).toEqual(["other"]);
  });

  test("Undo of a filing puts each card back to its own skills (Codex sweep 3, lifecycle)", async () => {
    const lib = await tempLibrary();
    const { meta } = await createItem(lib, { type: "markdown", title: "S", body: "Text.\n", skills: ["learning", "teaching"] }); // starter skills
    const fact = writeNewCard(lib, { kind: "card", item: meta.id, skills: ["learning"], topics: [], content_type: "fact", question: "Q?", answer: "A", rubric: [] });
    const both = writeNewCard(lib, { kind: "card", item: meta.id, skills: ["learning", "teaching"], topics: [], content_type: "fact", question: "Q2?", answer: "A", rubric: [] });
    const before = itemCardSkills(lib, meta.id);
    await setItemSkills(lib, meta.id, ["learning"]);
    await setItemSkills(lib, meta.id, ["learning", "teaching"], before);
    expect(findCard(lib, fact.meta.id).meta.skills).toEqual(["learning"]);
    expect(findCard(lib, both.meta.id).meta.skills).toEqual(["learning", "teaching"]);
    expect(setItemSkills(lib, meta.id, ["learning"], { [fact.meta.id]: ["nope"] })).rejects.toThrow('unknown skill "nope"');
  });
});
