import { expect, test } from "bun:test";
import { copyFileSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findCard, writeNewCard } from "../src/cards.ts";
import { createItem } from "../src/items.ts";
import { setItemSkills } from "../src/skills.ts";
import { tempLibrary } from "./helpers.ts";
import { readProbe } from "./helpers/read-probe.ts";

for (const renamed of [false, true]) test(`filing collects exercises once for Undo and updates, including ${renamed ? "renamed" : "normally named"} files`, async () => {
  const lib = await tempLibrary();
  const item = await createItem(lib, { type: "snippet", title: "Target", body: "An idea.", skills: [] });
  const other = await createItem(lib, { type: "snippet", title: "Other", body: "Other idea.", skills: ["ai"] });
  const card = (id: string, skills: string[]) => writeNewCard(lib, { kind: "card", item: id, skills, topics: [], content_type: "fact", question: "What?", answer: "An idea.", rubric: [] });
  const target = card(item.meta.id, ["learning"]);
  const unrelated = card(other.meta.id, ["ai"]);
  let targetPath = target.path;
  if (renamed) {
    targetPath = join(lib.root, "cards", "hand-renamed.md");
    renameSync(target.path, targetPath);
  } else {
    copyFileSync(target.path, target.path.replace(/\.md$/, " 2.md"));
  }
  // An existing hand edit must still be the value captured for Undo.
  writeFileSync(targetPath, readFileSync(targetPath, "utf8").replace("- learning", "- teaching"));
  const untouched = readFileSync(unrelated.path, "utf8");
  const probe = readProbe(lib, `
    const { itemCommands } = await import(core + "../../cli/src/cmd-items.ts");
    active = true;
    const result = (await itemCommands.edit.run([${JSON.stringify(item.meta.id)}], { skills: "habits" })).data;
  `);
  expect(probe.result.cards_before).toEqual({ [target.meta.id]: ["teaching"] });
  expect(probe.reads.filter((p) => p === unrelated.path)).toHaveLength(1);
  // One collection read, then writeCardMeta rereads the raw body to preserve its exact formatting.
  expect(probe.reads.filter((p) => p === targetPath)).toHaveLength(2);
  expect(readFileSync(unrelated.path, "utf8")).toBe(untouched);
  await setItemSkills(lib, item.meta.id, [], probe.result.cards_before);
  // Use the actual path for a renamed file, as the old listing has always done.
  if (renamed) expect(readFileSync(targetPath, "utf8")).toContain("- teaching");
  else expect(findCard(lib, target.meta.id).meta.skills).toEqual(["teaching"]);
});
