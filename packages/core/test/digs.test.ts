import { describe, expect, test } from "bun:test";
import { addHighlight } from "../src/annotations.ts";
import { DIG_GAPS, digIdeas, digReady, digState, dropDig, endDig, readDigs, startDig } from "../src/digs.ts";
import { addText } from "../src/ingest/index.ts";
import { findItem } from "../src/items.ts";
import { addSkill, setSkillLook } from "../src/skills.ts";
import { tempLibrary } from "./helpers.ts";

const TEXT = "# Learning\n\nTesting yourself beats rereading.\n\nSpace the sessions out.\n\nMix the topics.\n";
const day = (n: number) => new Date(Date.UTC(2026, 10, 1 + n, 12));

async function skillWithIdeas() {
  const lib = await tempLibrary();
  const src = await addText(lib, TEXT, { skills: ["learning"] });
  const it = findItem(lib, src.meta.id);
  const ideas = ["Testing yourself beats rereading.", "Space the sessions out.", "Mix the topics."].map((exact) => addHighlight(it, { exact, intent: "card" }));
  addHighlight(it, { exact: "Learning", intent: "keep" });
  await setSkillLook(lib, "learning", { goal: "Explain how to study to a new teacher, from memory" });
  return { lib, ideas };
}

describe("the Dig: a skill explained from memory against its key points (D-new-dig)", () => {
  test("a dig keeps what he wrote with the ideas as they stood: the skill's key points, fixed before anything reads it", async () => {
    const { lib, ideas } = await skillWithIdeas();
    expect(digIdeas(lib, "learning").map((i) => i.text).sort()).toEqual(["Mix the topics.", "Space the sessions out.", "Testing yourself beats rereading."]);
    const d = await startDig(lib, "learning", "  Test yourself, and spread it out.  ", day(0));
    expect(d).toMatchObject({ goal: "Explain how to study to a new teacher, from memory", text: "Test yourself, and spread it out." });
    expect(d.ideas.map((i) => [i.id, i.source, i.state])).toEqual(ideas.map((a) => [a.id, "Learning", undefined]).reverse());
    expect(d.done_at).toBeUndefined();
    // A key point marked afterwards is rock for the next dig, not this one.
    addHighlight(findItem(lib, d.ideas[0]!.item), { exact: "Learning", intent: "card" });
    expect(readDigs(lib, "learning")[0]!.ideas.length).toBe(3);
    // Ended with no question answered, what was not marked didn't come; taking the dig back leaves none.
    expect((await endDig(lib, "learning", d.id, day(0))).ideas.map((i) => i.state)).toEqual(["missed", "missed", "missed"]);
    await dropDig(lib, "learning", d.id);
    expect(readDigs(lib, "learning")).toEqual([]);
  });

  test("the gap widens with each dig and a skill is only ever ready, never owed; no goal, nothing to dig", async () => {
    const { lib } = await skillWithIdeas();
    expect(digState(lib, "learning", day(0)).ready).toBe(true);
    let at = 0;
    for (const gap of DIG_GAPS.slice(0, 3)) {
      await startDig(lib, "learning", "What I remember.", day(at));
      expect(digState(lib, "learning", day(at + gap - 1)).ready).toBe(false);
      expect(digState(lib, "learning", day(at + gap)).ready).toBe(true);
      // Left for a year, it is still just ready.
      expect(digState(lib, "learning", day(at + 365)).ready).toBe(true);
      at += gap;
    }
    await setSkillLook(lib, "learning", { goal: "" });
    expect(digState(lib, "learning", day(at + 365)).ready).toBe(false);
    await expect(startDig(lib, "learning", "More.", day(at))).rejects.toThrow(/no goal/);
  });

  test("a session offers one skill: ready, with ideas to check against, the one dug longest ago, and none in the week after a dig", async () => {
    const { lib } = await skillWithIdeas();
    await addSkill(lib, "Storytelling");
    await addSkill(lib, "Focus");
    const other = await addText(lib, "# Hooks\n\nOpen on the change.\n\nThen rewind.\n", { skills: ["storytelling"] });
    for (const exact of ["Open on the change.", "Then rewind."]) addHighlight(findItem(lib, other.meta.id), { exact, intent: "card" });
    // No goal: never offered.
    expect(digReady(lib, undefined, day(0))?.skill).toBe("learning");
    await setSkillLook(lib, "storytelling", { goal: "Open a video well" });
    await startDig(lib, "learning", "First.", day(0));
    // In the week after a dig, no session offers another, whatever the skill.
    expect(digReady(lib, undefined, day(6))).toBeNull();
    expect(digReady(lib, undefined, day(7))?.skill).toBe("storytelling");
    expect(digReady(lib, ["learning"], day(7))?.skill).toBe("learning");
    await startDig(lib, "storytelling", "First.", day(7));
    expect(digReady(lib, undefined, day(14))?.skill).toBe("learning");
    // A skill with one key point has nothing to check a dig against: its dig is kept as written.
    const thin = await addText(lib, "# One\n\nOnly this.\n", { skills: ["focus"] });
    addHighlight(findItem(lib, thin.meta.id), { exact: "Only this.", intent: "card" });
    await setSkillLook(lib, "focus", { goal: "Stay on one thing" });
    expect(digReady(lib, ["focus"], day(30))).toBeNull();
    expect((await startDig(lib, "focus", "One thing.", day(30))).done_at).toBeDefined();
  });
});
