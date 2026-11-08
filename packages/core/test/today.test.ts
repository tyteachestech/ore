import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { findCard, writeCardContent, writeNewCard } from "../src/cards.ts";
import { addSnippet } from "../src/ingest/index.ts";
import { setItemStatus } from "../src/items.ts";
import { paths } from "../src/library.ts";
import { endSession, firstEndThisWeek, startSession } from "../src/sessions.ts";
import type { Review } from "../src/reviews.ts";
import { calibration } from "../src/stats.ts";
import { loadSkills, reviewSettings, setAiVendor, setReviewSettings, setSkillLook } from "../src/skills.ts";
import { dueQueue, recordReview } from "../src/study.ts";
import { level, nextLevelAt, reminderNote, skillGrowth, skillStrength, today } from "../src/today.ts";
import { tempLibrary } from "./helpers.ts";

/** Drafts wait until the day after they were written (D65), so queue checks run a day later. */
const T = () => new Date(Date.now() + 864e5);

async function library(n: number, skills = ["learning"]) {
  const lib = await tempLibrary();
  const { item } = await addSnippet(lib, { text: "Spacing beats massing." });
  const cards = Array.from({ length: n }, (_, i) =>
    writeNewCard(lib, { kind: "card", item: item.meta.id, skills, topics: ["spacing"], content_type: "fact", question: `Q${i}?`, answer: "A", rubric: [] }));
  return { lib, item, cards };
}

describe("daily review settings (D60)", () => {
  test("defaults, then set in skills.yaml keeping comments", async () => {
    const { lib } = await library(0);
    expect(reviewSettings(lib)).toEqual({ goal_minutes: 10, weekdays_only: false, new_per_day: 10, remix: true, plan: "", reminder: "" });
    expect(await setReviewSettings(lib, { goal_minutes: 15, weekdays_only: true })).toEqual({ goal_minutes: 15, weekdays_only: true, new_per_day: 10, remix: true, plan: "", reminder: "" });
    expect(readFileSync(paths.skills(lib), "utf8")).toContain("# Skills (D25)");
    await expect(setReviewSettings(lib, { goal_minutes: 0 })).rejects.toThrow();
  });
});

describe("daily plan and reminder (D67)", () => {
  test("one reminder, only when set, the day counts, the goal is unmet and cards wait", async () => {
    const { lib, cards } = await library(2);
    const later = T();
    expect(reminderNote(lib, later).notify).toBe(false); // no time set
    await setReviewSettings(lib, { reminder: "08:30", plan: "my morning coffee" });
    expect(reminderNote(lib, later)).toEqual({ notify: true, title: "After my morning coffee, I review.", body: "About 1 min of your most urgent cards." });
    await expect(setReviewSettings(lib, { reminder: "8:30" })).rejects.toThrow("HH:MM");
    await setReviewSettings(lib, { plan: "" });
    expect(reminderNote(lib, later).title).toBe("Time for today’s review");
    for (const c of cards) await recordReview(lib, c.meta.id, { rating: 3, confidence: 2, now: later }); // caught up: met
    expect(reminderNote(lib, later).notify).toBe(false);
  });
});

describe("calibration (D69)", () => {
  const r = (confidence: number, ai_rating: number | undefined, days = 1, in_head = false) =>
    ({ ts: new Date(Date.now() - days * 864e5).toISOString(), card: "C", confidence, ai_rating, in_head, rating: 3 }) as unknown as Review;
  test("Sure answers on typed Explain cards in the last 12 weeks, checked by the AI's marks; null below 20", () => {
    const rs = [...Array.from({ length: 17 }, () => r(3, 4)), ...Array.from({ length: 3 }, () => r(3, 2))];
    expect(calibration(rs.slice(0, 19))).toEqual({ sure_n: 19, sure_right: null });
    expect(calibration(rs)).toEqual({ sure_n: 20, sure_right: 0.85 });
    // Fact cards (no AI rating), in-head answers, other confidences and old reviews don't count.
    expect(calibration([...rs, r(3, undefined), r(3, 1, 1, true), r(2, 1), r(3, 1, 90)]).sure_n).toBe(20);
  });

  test("shows on the week's first session end that had reviews", async () => {
    const { lib, cards } = await library(1);
    await startSession(lib);
    await endSession(lib); // left at once: no reviews
    expect(firstEndThisWeek(lib)).toBe(false);
    // Reviews of one card are one review per millisecond (a repeated log line is dropped), so the
    // second is a millisecond later, as a fast machine could otherwise write both in the same one.
    const t = Date.now();
    await startSession(lib);
    await recordReview(lib, cards[0]!.meta.id, { rating: 3, confidence: 2, now: new Date(t) });
    await endSession(lib);
    expect(firstEndThisWeek(lib)).toBe(true);
    await startSession(lib);
    await recordReview(lib, cards[0]!.meta.id, { rating: 3, confidence: 2, now: new Date(t + 1) });
    await endSession(lib);
    expect(firstEndThisWeek(lib)).toBe(false);
  });
});

describe("AI vendor setting", () => {
  test("sets ai: in skills.yaml keeping comments; rejects unknown vendors", async () => {
    const { lib } = await library(0);
    expect(loadSkills(lib).ai).toBe("claude");
    await setAiVendor(lib, "codex");
    expect(loadSkills(lib).ai).toBe("codex");
    expect(readFileSync(paths.skills(lib), "utf8")).toContain("# ai: claude | codex");
    await expect(setAiVendor(lib, "gpt" as "codex")).rejects.toThrow();
  });
});

describe("new-card limit and skill filter (D58, D60)", () => {
  test("at most new_per_day unseen drafts a day, counting drafts already finished today", async () => {
    const { lib, cards } = await library(14);
    const at = T();
    expect(dueQueue(lib, at)).toHaveLength(10);
    expect(dueQueue(lib, at, { newLimit: false })).toHaveLength(14);
    for (const c of cards.slice(0, 4)) await recordReview(lib, c.meta.id, { rating: 3, confidence: 2, now: at });
    expect(dueQueue(lib, at)).toHaveLength(6); // 10 − 4 introduced today
    await setReviewSettings(lib, { new_per_day: 0 });
    expect(dueQueue(lib, at)).toHaveLength(0);
  });

  test("a draft waits until the day after it was written (D65)", async () => {
    const { lib } = await library(2);
    expect(dueQueue(lib)).toHaveLength(0);
    expect(dueQueue(lib, new Date(), { newLimit: false })).toHaveLength(2);
    expect(dueQueue(lib, T())).toHaveLength(2);
  });

  test("over a backlog of due cards, every fifth card is new, up to new_per_day (D144)", async () => {
    const { lib, cards } = await library(40);
    const day1 = T();
    for (const c of cards.slice(0, 30)) await recordReview(lib, c.meta.id, { rating: 3, confidence: 2, now: day1 });
    const later = new Date(day1.getTime() + 90 * 864e5); // all 30 are overdue: a backlog far past the goal
    const q = dueQueue(lib, later);
    const fresh = q.flatMap((e, i) => (e.due === null ? [i] : []));
    expect(fresh).toEqual([4, 9, 14, 19, 24, 29, 34, 37, 38, 39]); // 1 in 5 while due cards last, then the rest of the 10
    await setReviewSettings(lib, { new_per_day: 2 });
    expect(dueQueue(lib, later).filter((e) => e.due === null)).toHaveLength(2);
  });

  test("with nothing due, new drafts come up to new_per_day, whatever the goal (D144)", async () => {
    const { lib } = await library(20);
    await setReviewSettings(lib, { goal_minutes: 1 });
    expect(dueQueue(lib, T())).toHaveLength(10);
    await setReviewSettings(lib, { new_per_day: 200 });
    expect(dueQueue(lib, T())).toHaveLength(20);
  });

  test("the relearn passes owed today come after the new cards, which take no place among them (D144, D21)", async () => {
    const { lib, cards } = await library(12);
    const day1 = T();
    for (const c of cards.slice(0, 6)) await recordReview(lib, c.meta.id, { rating: 3, confidence: 2, now: day1 });
    const later = new Date(day1.getTime() + 90 * 864e5);
    await recordReview(lib, cards[0]!.meta.id, { rating: 1, confidence: 3, now: later }); // a miss today owes one pass
    const q = dueQueue(lib, new Date(later.getTime() + 60_000));
    expect(q.map((e) => (e.relearn ? "R" : e.due === null ? "N" : "D")).join("")).toBe("DDDDNDNNNNNR");
    expect(q.at(-1)!.id).toBe(cards[0]!.meta.id);
  });

  test("a draft written today takes no fifth place; it gets one tomorrow (D65, D144)", async () => {
    const { lib, cards } = await library(6);
    const past = new Date(Date.now() - 90 * 864e5);
    for (const c of cards.slice(0, 5)) await recordReview(lib, c.meta.id, { rating: 3, confidence: 2, now: past });
    expect(dueQueue(lib).map((e) => e.due === null)).toEqual([false, false, false, false, false]);
    expect(dueQueue(lib, T()).map((e) => e.due === null)).toEqual([false, false, false, false, true, false]);
  });

  test("the new cards' own order is the freshest finished source first (D60), under the skill filter too", async () => {
    const { lib, item: a, cards } = await library(8);
    const { item: b } = await addSnippet(lib, { text: "Interleaving beats blocking." });
    const { item: c } = await addSnippet(lib, { text: "Testing beats rereading." });
    const draftOn = (item: string, skills: string[], q: string) => writeNewCard(lib, { kind: "card", item, skills, topics: ["spacing"], content_type: "fact", question: q, answer: "A", rubric: [] });
    const fromB = draftOn(b.meta.id, ["learning"], "B?");
    const fromC = draftOn(c.meta.id, ["learning"], "C?");
    const habit = draftOn(c.meta.id, ["habits"], "H?");
    await setItemStatus(lib, a.meta.id, "done", "2026-01-01T00:00:00Z");
    await setItemStatus(lib, b.meta.id, "done", "2026-03-01T00:00:00Z");
    await setItemStatus(lib, c.meta.id, "done", "2026-02-01T00:00:00Z");
    const day1 = T();
    for (const card of cards) await recordReview(lib, card.meta.id, { rating: 3, confidence: 2, now: day1 });
    const later = new Date(day1.getTime() + 90 * 864e5);
    const fresh = dueQueue(lib, later).filter((e) => e.due === null).map((e) => e.id);
    expect(fresh).toEqual([fromB.meta.id, fromC.meta.id, habit.meta.id]);
    // Only the picked skill's new cards take the fifth places; the other skill's wait for their own session.
    const picked = dueQueue(lib, later, { skills: ["learning"] });
    expect(picked.flatMap((e, i) => (e.due === null ? [i] : []))).toEqual([4, 9]);
    expect(picked.filter((e) => e.due === null).map((e) => e.id)).toEqual([fromB.meta.id, fromC.meta.id]);
    expect(dueQueue(lib, later, { skills: ["habits"] }).map((e) => e.id)).toEqual([habit.meta.id]);
  });

  test("--skill keeps only cards of the picked skills", async () => {
    const { lib, item } = await library(2, ["learning"]);
    writeNewCard(lib, { kind: "card", item: item.meta.id, skills: ["habits"], topics: ["cues"], content_type: "fact", question: "Cue?", answer: "A", rubric: [] });
    expect(dueQueue(lib, T(), { skills: ["habits"] }).map((e) => e.skills)).toEqual([["habits"]]);
    expect(dueQueue(lib, T(), { skills: ["learning", "habits"] })).toHaveLength(3);
  });
});

describe("today (D60)", () => {
  test("active time is capped per card; caught up with a review counts as met", async () => {
    const { lib, cards } = await library(2);
    const at = T();
    let t = today(lib, at);
    expect(t).toMatchObject({ due: 2, met: false, caught_up: false, active_ms: 0, goal_ms: 600_000, estimate_ms: 40_000 });
    await startSession(lib, at);
    await recordReview(lib, cards[0]!.meta.id, { rating: 3, confidence: 2, elapsed_ms: 10 * 60_000, now: at });
    t = today(lib, at);
    expect(t.active_ms).toBe(180_000);
    expect(t.met).toBe(false);
    await recordReview(lib, cards[1]!.meta.id, { rating: 3, confidence: 2, elapsed_ms: 30_000, now: at });
    t = today(lib, at);
    expect(t).toMatchObject({ caught_up: true, met: true, days_met: 1, new_today: 2 });
    expect(t.week.filter((d) => d.status === "met")).toHaveLength(1);
    expect(await endSession(lib, at, true)).toMatchObject({ reviews: 2, kept: 2, rescued: 0, caught_up: true });
  });

  test("new cards held back by the daily limit are counted, so caught up doesn't hide them (D65)", async () => {
    const { lib } = await library(5);
    await setReviewSettings(lib, { new_per_day: 2 });
    const t = today(lib, T());
    expect(t).toMatchObject({ due: 2, new_waiting: 3 });
    expect(today(lib, new Date()).new_waiting).toBe(5); // drafted today: all wait for tomorrow
  });

  test("rescued means faded well below the card's own target, so on-time P3 reviews don't count", async () => {
    const { lib, cards } = await library(2, ["habits"]); // P3: aims at 0.80
    const at = T();
    const first = await recordReview(lib, cards[0]!.meta.id, { rating: 3, confidence: 2, now: at });
    await recordReview(lib, cards[1]!.meta.id, { rating: 3, confidence: 2, now: at });
    await startSession(lib, new Date(Date.parse(first.due_next)));
    await recordReview(lib, cards[0]!.meta.id, { rating: 3, confidence: 2, now: new Date(Date.parse(first.due_next)) }); // on time
    await recordReview(lib, cards[1]!.meta.id, { rating: 3, confidence: 2, now: new Date(Date.parse(first.due_next) + 60 * 864e5) }); // two months late
    expect(await endSession(lib, new Date(Date.parse(first.due_next) + 61 * 864e5))).toMatchObject({ kept: 2, rescued: 1 });
  });

  test("a source whose doc.md can't be read is named, every time, until it reads again (files-10)", async () => {
    const { lib, item } = await library(1);
    expect(today(lib).unreadable).toEqual([]);
    const good = readFileSync(item.docPath, "utf8");
    writeFileSync(item.docPath, "---\nid: [broken\n---\nText\n");
    for (const _ of [1, 2]) {
      // The index reports a bad file only on the sync that saw it change, so the second call checks it is still named.
      const [bad, ...rest] = today(lib).unreadable;
      expect(rest).toEqual([]);
      expect(bad).toMatchObject({ dir: item.dir });
      expect(bad!.error).not.toBe("");
    }
    writeFileSync(item.docPath, good);
    expect(today(lib).unreadable).toEqual([]);
  });

  test("weekdays only: a weekend day is off", async () => {
    const { lib } = await library(0);
    await setReviewSettings(lib, { weekdays_only: true });
    const sat = new Date("2026-10-24T12:00:00");
    const t = today(lib, sat);
    expect(t.counts).toBe(false);
    expect(t.week.map((d) => d.status).slice(5)).toEqual(["off", "off"]);
  });
});

describe("skill strength (D62)", () => {
  test("levels grow with solid memories", () => {
    expect([0, 4, 5, 19, 20, 45, 80].map(level)).toEqual([0, 0, 1, 1, 2, 3, 4]);
    expect(nextLevelAt(0)).toBe(5);
    expect(nextLevelAt(20)).toBe(45);
  });

  test("a card counts as solid once its stability reaches 21 days", async () => {
    const { lib, cards } = await library(1);
    const id = cards[0]!.meta.id;
    let at = new Date("2026-01-01T09:00:00Z");
    for (let i = 0; i < 6; i++) {
      const r = await recordReview(lib, id, { rating: 3, confidence: 2, now: at });
      at = new Date(r.due_next);
    }
    expect(today(lib, at).skills.find((s) => s.skill === "learning")!.solid).toBe(1);
    const growth = skillGrowth(lib, "learning", at, 4);
    expect(growth).toHaveLength(4);
    expect(growth.at(-1)!.solid).toBe(1);
  });
});

describe("strength breakdown and peak level (D63)", () => {
  test("a forgotten memory lowers the count, not the level, and waits to be won back", async () => {
    const { lib, item, cards } = await library(1);
    const prompts = Array.from({ length: 5 }, (_, i) =>
      writeNewCard(lib, { kind: "prompt", item: item.meta.id, skills: ["learning"], topics: [], content_type: "concept", question: `Why ${i}?`, answer: "A", rubric: ["a"] }));
    let at = new Date("2026-01-01T09:00:00Z");
    for (const c of prompts) {
      let t = at;
      for (let i = 0; i < 6; i++) t = new Date((await recordReview(lib, c.meta.id, { rating: 3, confidence: 2, now: t })).due_next);
      if (t > at) at = t;
    }
    await recordReview(lib, cards[0]!.meta.id, { rating: 3, confidence: 2, now: at });
    let s = skillStrength(lib, "learning");
    expect(s).toMatchObject({ solid: 5, growing: 1, new: 0, win_back: 0, peak: 5, level: 1, next_level_at: 20 });
    writeNewCard(lib, { kind: "card", item: item.meta.id, skills: ["learning"], topics: [], content_type: "fact", question: "Later?", answer: "A", rubric: [] });
    expect(skillStrength(lib, "learning").new).toBe(1);
    expect(s.explain).toHaveLength(5);

    await recordReview(lib, prompts[0]!.meta.id, { rating: 1, confidence: 3, now: new Date(at.getTime() + 864e5) });
    s = skillStrength(lib, "learning");
    expect(s).toMatchObject({ solid: 4, win_back: 1, peak: 5, level: 1 });
    expect(s.explain.map((e) => e.id)).not.toContain(prompts[0]!.meta.id);
    expect(today(lib, at).skills.find((k) => k.skill === "learning")).toMatchObject({ solid: 4, level: 1, win_back: 1 });
  });

  test("ready: growing cards one Good review from solid; ready_today: those due by tonight; cut: cards that became solid this session (D90)", async () => {
    const { lib, cards } = await library(1);
    const id = cards[0]!.meta.id;
    let at = new Date("2026-01-01T09:00:00Z");
    at = new Date((await recordReview(lib, id, { rating: 3, confidence: 2, now: at })).due_next);
    expect(skillStrength(lib, "learning")).toMatchObject({ solid: 0, growing: 1, ready: 0 }); // one more Good isn't enough yet
    at = new Date((await recordReview(lib, id, { rating: 3, confidence: 2, now: at })).due_next);
    expect(skillStrength(lib, "learning", at)).toMatchObject({ solid: 0, growing: 1, ready: 1, ready_today: 1 });
    expect(skillStrength(lib, "learning", new Date(at.getTime() - 3 * 864e5))).toMatchObject({ ready: 1, ready_today: 0 }); // due in three days
    await startSession(lib, at);
    await recordReview(lib, id, { rating: 3, confidence: 2, now: at });
    expect(skillStrength(lib, "learning")).toMatchObject({ solid: 1, growing: 0, ready: 0 });
    expect((await endSession(lib, at)).cut).toEqual(["learning"]);
  });

  test("the hook is his why, one line, set in skills.yaml", async () => {
    const { lib } = await library(0);
    expect((await setSkillLook(lib, "learning", { hook: "  So I can   build study tools  " })).hook).toBe("So I can build study tools");
    expect(loadSkills(lib).skills.find((k) => k.id === "learning")!.hook).toBe("So I can build study tools");
    await expect(setSkillLook(lib, "learning", { hook: "x".repeat(141) })).rejects.toThrow();
    expect((await setSkillLook(lib, "learning", { hook: "" })).hook).toBeUndefined();
  });

  test("the goal is one line he could show, set in skills.yaml (D101)", async () => {
    const { lib } = await library(0);
    expect((await setSkillLook(lib, "learning", { goal: " Explain spacing  to a new teacher " })).goal).toBe("Explain spacing to a new teacher");
    expect(loadSkills(lib).skills.find((k) => k.id === "learning")!.goal).toBe("Explain spacing to a new teacher");
    await expect(setSkillLook(lib, "learning", { goal: "x".repeat(141) })).rejects.toThrow();
    expect((await setSkillLook(lib, "learning", { goal: "" })).goal).toBeUndefined();
  });
});

describe("editing a card in review (D59)", () => {
  test("question and answer change, rubric and meta stay", async () => {
    const { lib, item } = await library(0);
    const c = writeNewCard(lib, { kind: "prompt", item: item.meta.id, skills: ["learning"], topics: [], content_type: "concept", question: "Why space?", answer: "Forgetting.", rubric: ["names forgetting", "names retrieval"] });
    const e = writeCardContent(findCard(lib, c.meta.id), { answer: "Some forgetting makes retrieval effortful." });
    expect(e).toMatchObject({ question: "Why space?", answer: "Some forgetting makes retrieval effortful.", rubric: ["names forgetting", "names retrieval"] });
    expect(e.meta).toEqual(c.meta);
  });
});
