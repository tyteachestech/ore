import { describe, expect, test } from "bun:test";
import { findCard, writeNewCard } from "../src/cards.ts";
import { createItem, findItem, renameItem, setItemAuthor } from "../src/items.ts";
import { addSkill, setItemSkills } from "../src/skills.ts";
import { tempLibrary } from "./helpers.ts";

describe("editing a source", () => {
  test("rename trims and refuses an empty title", async () => {
    const lib = await tempLibrary();
    const { meta } = await createItem(lib, { type: "markdown", title: "Old", body: "Text.\n" });
    expect((await renameItem(lib, meta.id, "  New title ")).title).toBe("New title");
    expect(findItem(lib, meta.id).meta.title).toBe("New title");
    expect(renameItem(lib, meta.id, "  ")).rejects.toThrow("needs a title");
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
});
