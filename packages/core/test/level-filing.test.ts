import { expect, test } from "bun:test";
import { rebuildIndex } from "../src/db.ts";
import { addText } from "../src/ingest/index.ts";
import { writeNewCard } from "../src/cards.ts";
import { readReviews } from "../src/reviews.ts";
import { recordReview } from "../src/study.ts";
import { itemCardSkills, setItemSkills } from "../src/skills.ts";
import { skillStrength, today } from "../src/today.ts";
import { tempLibrary } from "./helpers.ts";

test("moving solid exercises keeps the earned level after rebuilding, and its Undo gives the other skill none", async () => {
  const lib = await tempLibrary();
  const item = await addText(lib, "# Level\n\nMemory matters.", { skills: ["learning"] });
  for (let i = 0; i < 5; i++) {
    const c = writeNewCard(lib, { kind: "card", item: item.meta.id, skills: ["learning"], topics: [], content_type: "concept", question: `Question ${i}?`, answer: "Memory.", rubric: [] });
    for (const day of ["01", "12"]) await recordReview(lib, c.meta.id, { rating: 3, confidence: 2, now: new Date(`2026-06-${day}T12:00:00Z`) });
  }
  expect(skillStrength(lib, "learning")).toMatchObject({ solid: 5, peak: 5, level: 1 });
  const reviews = readReviews(lib);
  const cards = itemCardSkills(lib, item.meta.id);
  await setItemSkills(lib, item.meta.id, ["habits"]);
  expect(skillStrength(lib, "learning")).toMatchObject({ solid: 0, peak: 5, level: 1 });
  rebuildIndex(lib);
  expect(today(lib).skills.find(s => s.skill === "learning")).toMatchObject({ solid: 0, peak: 5, level: 1 });
  await setItemSkills(lib, item.meta.id, ["learning"], cards);
  expect(skillStrength(lib, "learning")).toMatchObject({ solid: 5, peak: 5, level: 1 });
  // The filing was taken back: habits never kept those exercises, so it earned nothing.
  expect(skillStrength(lib, "habits")).toMatchObject({ solid: 0, peak: 0, level: 0 });
  expect(readReviews(lib)).toEqual(reviews);
});
