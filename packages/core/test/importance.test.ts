// D173: a skill's importance (Focus P1, Normal P2, Light P3) and Archived.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { writeNewCard } from "../src/cards.ts";
import { addSnippet, addSource, addText } from "../src/ingest/index.ts";
import { paths } from "../src/library.ts";
import { acceptSuggestedSkill, addSkill, archiveSkill, cardPriority, desiredRetention, loadSkills, setItemSkills, setSkillLook } from "../src/skills.ts";
import { updateItemMeta } from "../src/items.ts";
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
