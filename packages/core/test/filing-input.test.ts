import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { writeNewCard } from "../src/cards.ts";
import { createItem } from "../src/items.ts";
import { checkSkills, setItemSkills } from "../src/skills.ts";
import { tempLibrary } from "./helpers.ts";

test("a malformed exercise-skill map is rejected before any exercise is written (JSON-01)", async () => {
  const lib = await tempLibrary();
  const item = await createItem(lib, { type: "markdown", title: "Learning", body: "Recall helps.", skills: ["learning"] });
  const make = () => writeNewCard(lib, { kind: "card", item: item.meta.id, skills: ["learning"], topics: [], content_type: "fact", question: "What helps?", answer: "Recall", rubric: [] });
  const first = make(), second = make();
  const files = [item.docPath, first.path, second.path];
  const before = files.map((p) => readFileSync(p, "utf8"));
  for (const cards of [{ [first.meta.id]: [], [second.meta.id]: "learning" }, null, [], "learning", { [first.meta.id]: [null] }, { [first.meta.id]: [1] }]) {
    await expect(setItemSkills(lib, item.meta.id, ["learning"], cards as unknown as Record<string, string[]>)).rejects.toThrow("--cards must be an object mapping exercise IDs to arrays of skill IDs");
    expect(files.map((p) => readFileSync(p, "utf8"))).toEqual(before);
  }
  await setItemSkills(lib, item.meta.id, ["learning"], { [first.meta.id]: [] });
});

test("an empty skill ID is unknown and cannot replace an exercise's skills (JSON-02)", async () => {
  const lib = await tempLibrary();
  const item = await createItem(lib, { type: "markdown", title: "Learning", body: "Recall helps.", skills: ["learning"] });
  const card = writeNewCard(lib, { kind: "card", item: item.meta.id, skills: ["learning"], topics: [], content_type: "fact", question: "What helps?", answer: "Recall", rubric: [] });
  const before = readFileSync(card.path, "utf8");
  await expect(setItemSkills(lib, item.meta.id, ["learning"], { [card.meta.id]: [""] })).rejects.toThrow('unknown skill ""');
  expect(readFileSync(card.path, "utf8")).toBe(before);
  expect(() => checkSkills(lib, [""])).toThrow('unknown skill ""');
  expect(() => checkSkills(lib, [])).not.toThrow();
});
