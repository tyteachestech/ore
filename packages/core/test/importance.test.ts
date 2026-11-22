// D173: a skill's importance (Focus P1, Normal P2, Light P3) and Archived.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { writeNewCard } from "../src/cards.ts";
import { addSnippet, addSource, addText } from "../src/ingest/index.ts";
import { paths } from "../src/library.ts";
import { acceptSuggestedSkill, addSkill, archiveSkill, cardPriority, desiredRetention, loadSkills, setItemSkills, setSkillLook } from "../src/skills.ts";
import { findItem, setItemPriority, updateItemMeta } from "../src/items.ts";
import { openIndex } from "../src/db.ts";
import { dueQueue } from "../src/study.ts";
import { today } from "../src/today.ts";
import { tempLibrary } from "./helpers.ts";

const tomorrow = () => new Date(Date.now() + 864e5); // drafts wait a day (D65)

async function setup() {
  const lib = await tempLibrary();
  const { item } = await addSnippet(lib, { text: "Positioning picks the market you win." });
  const mk = (q: string, skills: string[]) => writeNewCard(lib, { kind: "card", item: item.meta.id, skills, topics: [], content_type: "fact", question: q, answer: "A", rubric: [] });
  return { lib, item, mk };
}

describe("skill importance (D173)", () => {
  test("a new skill starts Light; its importance is set and read back", async () => {
    const lib = await tempLibrary();
    const s = await addSkill(lib, "Go-to-market");
    expect(s.priority).toBe("P3");
    expect(loadSkills(lib).skills.find((k) => k.id === s.id)!.priority).toBe("P3");
    expect((await setSkillLook(lib, s.id, { priority: "p1" })).priority).toBe("P1");
    await expect(setSkillLook(lib, s.id, { priority: "P4" })).rejects.toThrow(/P1 \(Focus\), P2 \(Normal\) or P3 \(Light\)/);
    expect(readFileSync(paths.skills(lib), "utf8")).toContain("Priority maps to desired retention"); // comments kept
  });

  test("an accepted suggestion makes a Light skill", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Pricing pages convert when…" });
    await updateItemMeta(lib, item.meta.id, (m) => ({ ...m, suggested_skill: { name: "Pricing", hook: "" } }));
    expect((await acceptSuggestedSkill(lib, item.meta.id)).skill.priority).toBe("P3");
  });

  test("an archived skill's own cards leave review; a card shared with a live skill stays, at the live skill's priority", async () => {
    const { lib, mk } = await setup();
    const gtm = await addSkill(lib, "Go-to-market");
    const own = mk("What is positioning?", [gtm.id]);
    const shared = mk("Who do you sell to first?", [gtm.id, "creator-business"]);
    const none = mk("Untagged?", []);
    await setSkillLook(lib, gtm.id, { priority: "P1" });
    await archiveSkill(lib, gtm.id, true);
    const skills = loadSkills(lib).skills;
    expect(cardPriority([gtm.id, "creator-business"], skills)).toBe("P2"); // the archived P1 doesn't count
    expect(cardPriority([gtm.id], skills)).toBe("P1"); // all archived: its own
    const ids = dueQueue(lib, tomorrow()).map((e) => e.id);
    expect(ids).not.toContain(own.meta.id);
    expect(ids).toContain(shared.meta.id);
    expect(ids).toContain(none.meta.id);
    // picked by name, it reviews
    expect(dueQueue(lib, tomorrow(), { skills: [gtm.id] }).map((e) => e.id).sort()).toEqual([own.meta.id, shared.meta.id].sort());
    // Home lists nothing due for it, so Start review never offers it
    expect(today(lib, tomorrow()).skills.find((k) => k.skill === gtm.id)!.due).toBe(0);
    // brought back: its cards return, FSRS state untouched
    expect((await archiveSkill(lib, gtm.id, false)).archived).toBeUndefined();
    expect(dueQueue(lib, tomorrow()).map((e) => e.id)).toContain(own.meta.id);
  });

  test("filing a source under an archived skill brings it back", async () => {
    const { lib, item } = await setup();
    const gtm = await addSkill(lib, "Go-to-market");
    await archiveSkill(lib, gtm.id, true);
    await setItemSkills(lib, item.meta.id, [gtm.id]);
    expect(loadSkills(lib).skills.find((s) => s.id === gtm.id)!.archived).toBeUndefined();
    await archiveSkill(lib, gtm.id, true);
    await addText(lib, "A podcast on sales-led growth.", { skills: [gtm.id] });
    expect(loadSkills(lib).skills.find((s) => s.id === gtm.id)!.archived).toBeUndefined();
  });

  test("a hand-edited archived value that isn't true or false is dropped, not fatal", async () => {
    const lib = await tempLibrary();
    const file = paths.skills(lib);
    const text = readFileSync(file, "utf8").replace("name: Habits\n", "name: Habits\n    archived: maybe\n");
    await Bun.write(file, text);
    expect(loadSkills(lib).skills.find((s) => s.id === "habits")!.archived).toBeUndefined();
  });

  test("archiving never changes a card's retention, so its history replays to the same schedule", async () => {
    const lib = await tempLibrary();
    await archiveSkill(lib, "ai", true);
    expect(desiredRetention(["ai", "habits"], loadSkills(lib).skills)).toBe(0.92);
  });

  test("a snippet filed under an archived skill brings it back; a preview doesn't", async () => {
    const lib = await tempLibrary();
    await archiveSkill(lib, "habits", true);
    const file = `${lib.root}/page.md`;
    await Bun.write(file, "# Cues\n\nA cue starts the habit.\n");
    await addSource(lib, file, { skills: ["habits"], preview: true });
    expect(loadSkills(lib).skills.find((s) => s.id === "habits")!.archived).toBe(true);
    await addSnippet(lib, { text: "Tiny habits start small.", skills: ["habits"] });
    expect(loadSkills(lib).skills.find((s) => s.id === "habits")!.archived).toBeUndefined();
  });
});

// A source's own importance (Tyler, 2026-11-22): set by him it wins over its skills', else its exercises
// take the highest of their skills', else Normal. Nothing is copied onto the source.
describe("a source's own importance", () => {
  test("his own setting wins, either way; unset, the skills' highest; with no skill, Normal", () => {
    const skills = [{ id: "a", name: "A", priority: "P1" as const }, { id: "b", name: "B", priority: "P3" as const }];
    expect(cardPriority([], skills)).toBe("P2");
    expect(cardPriority(["b"], skills)).toBe("P3");
    expect(cardPriority(["a", "b"], skills)).toBe("P1");
    expect(cardPriority([], skills, "P1")).toBe("P1"); // no skill, and it matters
    expect(cardPriority(["a"], skills, "P3")).toBe("P3"); // a light read inside a Focus skill
    expect(desiredRetention([], skills, "P1")).toBe(0.92);
    expect(desiredRetention(["a"], skills, "P3")).toBe(0.8);
  });

  test("it is set, read back, refused when it isn't a level, and handed back to the skills", async () => {
    const { lib, item } = await setup();
    expect((await setItemPriority(lib, item.meta.id, "p1")).priority).toBe("P1");
    expect(findItem(lib, item.meta.id).meta.priority).toBe("P1");
    await expect(setItemPriority(lib, item.meta.id, "high")).rejects.toThrow(/P1 \(Focus\), P2 \(Normal\), P3 \(Light\)/);
    expect((await setItemPriority(lib, item.meta.id, "")).priority).toBeUndefined();
    expect(readFileSync(findItem(lib, item.meta.id).docPath, "utf8")).not.toContain("priority:");
  });

  test("a source with no skill, set to Focus, has its exercises ranked and kept as Focus", async () => {
    const { lib, item, mk } = await setup();
    const card = mk("What does positioning pick?", []);
    const of = () => dueQueue(lib, tomorrow()).find((e) => e.id === card.meta.id)!.priority;
    const kept = () => {
      const index = openIndex(lib);
      try {
        return index.cards().find((c) => c.id === card.meta.id)!.retention;
      } finally {
        index.db.close();
      }
    };
    expect(of()).toBe("P2");
    expect(kept()).toBe(0.88);
    await setItemPriority(lib, item.meta.id, "P1");
    expect(of()).toBe("P1");
    expect(kept()).toBe(0.92);
  });

  test("a skill's importance changing moves the sources that follow it, and leaves one he set", async () => {
    const { lib, item, mk } = await setup();
    const { item: other } = await addSnippet(lib, { text: "A second source, set by hand." });
    await setItemSkills(lib, item.meta.id, ["habits"]);
    await setItemSkills(lib, other.meta.id, ["habits"]);
    const follows = mk("Follows its skill?", ["habits"]);
    const set = writeNewCard(lib, { kind: "card", item: other.meta.id, skills: ["habits"], topics: [], content_type: "fact", question: "Set by hand?", answer: "A", rubric: [] });
    await setItemPriority(lib, other.meta.id, "P2");
    const of = (id: string) => dueQueue(lib, tomorrow()).find((e) => e.id === id)!.priority;
    expect([of(follows.meta.id), of(set.meta.id)]).toEqual(["P3", "P2"]);
    await setSkillLook(lib, "habits", { priority: "P1" });
    expect([of(follows.meta.id), of(set.meta.id)]).toEqual(["P1", "P2"]);
  });
});
