import { describe, expect, test } from "bun:test";
import { Rating } from "ts-fsrs";
import { emptyState, nextState, replay } from "../src/scheduler.ts";
import { retentionMetric } from "../src/stats.ts";
import type { FsrsState, Review } from "../src/reviews.ts";

const DAY = 86_400_000;
const T0 = Date.parse("2026-09-01T15:00:00.000Z");

// Build a log the way `ore review` does: state_before replayed, state_after computed.
function log(card: string, steps: { day: number; rating: 1 | 2 | 3 | 4; session?: string; minutes?: number }[], retention = 0.9): Review[] {
  const out: Review[] = [];
  let s: FsrsState | null = null;
  for (const st of steps) {
    const at = new Date(T0 + st.day * DAY + (st.minutes ?? 0) * 60_000);
    const before: FsrsState = s ?? emptyState(at);
    s = nextState(before, at, st.rating, retention);
    out.push({ ts: at.toISOString(), card, session: st.session, confidence: 2, rating: st.rating, state_before: before, state_after: s });
  }
  return out;
}

describe("review-log replay", () => {
  test("replaying the log reproduces the logged FSRS state, in any input order", () => {
    const reviews = log("A", [{ day: 0, rating: 3 }, { day: 3, rating: 3 }, { day: 12, rating: 1 }, { day: 13, rating: 3 }, { day: 20, rating: 4 }]);
    const final = reviews.at(-1)!.state_after;
    expect(replay(reviews, 0.9)).toEqual(final);
    expect(replay([...reviews].reverse(), 0.9)).toEqual(final);
    expect(final.reps).toBe(5);
    expect(final.lapses).toBe(1);
    expect(replay([], 0.9)).toBeNull();
  });

  test("desired retention changes intervals, not stability/difficulty", () => {
    const steps = [{ day: 0, rating: 3 as const }, { day: 4, rating: 3 as const }];
    const p1 = replay(log("A", steps, 0.95), 0.95)!;
    const p3 = replay(log("A", steps, 0.85), 0.85)!;
    expect(p1.stability).toBeCloseTo(p3.stability, 10);
    expect(p1.difficulty).toBeCloseTo(p3.difficulty, 10);
    expect(Date.parse(p1.due)).toBeLessThan(Date.parse(p3.due));
  });

  test("a miss schedules a later day (no FSRS minute steps)", () => {
    const s = nextState(emptyState(new Date(T0)), new Date(T0), Rating.Again, 0.9);
    expect(Date.parse(s.due) - T0).toBeGreaterThanOrEqual(DAY);
  });
});

describe("retention metric (Anki-adapted)", () => {
  test("excludes first ratings, relearn re-asks and early reviews; partial counts as fail", () => {
    const reviews = [
      // A: first (excluded), on-time pass, on-time miss, relearn re-ask same session (excluded)
      ...log("A", [{ day: 0, rating: 3 }, { day: 30, rating: 3 }, { day: 400, rating: 1, session: "S" }, { day: 400, rating: 3, session: "S", minutes: 5 }]),
      // B: first (excluded), on-time partial (fail), early review the next day (excluded)
      ...log("B", [{ day: 0, rating: 3 }, { day: 30, rating: 2 }, { day: 31, rating: 4 }]),
    ];
    const m = retentionMetric(reviews);
    expect(m.n).toBe(3); // A pass, A miss, B partial
    expect(m.passed).toBe(1);
    expect(m.retention).toBeNull(); // below 10 qualifying reviews
  });

  test("reports a value once 10 qualifying reviews exist", () => {
    const reviews = Array.from({ length: 10 }, (_, i) => log(`C${i}`, [{ day: 0, rating: 3 }, { day: 60, rating: i < 8 ? 3 : 2 }])).flat();
    const m = retentionMetric(reviews);
    expect(m.n).toBe(10);
    expect(m.retention).toBeCloseTo(0.8);
  });
});

describe("card history (D149)", async () => {
  const { tempLibrary } = await import("./helpers.ts");
  const { addSnippet } = await import("../src/ingest/index.ts");
  const { writeNewCard } = await import("../src/cards.ts");
  const { recordReview, cardHistory } = await import("../src/study.ts");
  const lib = await tempLibrary();
  const { item } = await addSnippet(lib, { text: "Retrieval practice strengthens memory." });
  const card = writeNewCard(lib, { kind: "card", item: item.meta.id, skills: ["learning"], topics: [], content_type: "fact", question: "q", answer: "a", rubric: [] });

  test("a new card has no reviews and four next dates, Again soonest and Easy furthest", () => {
    const h = cardHistory(lib, card.meta.id, new Date(T0));
    expect(h.reviews).toEqual([]);
    const d = [1, 2, 3, 4].map((r) => Date.parse(h.next[r as 1 | 2 | 3 | 4]));
    expect(d[0]).toBeLessThanOrEqual(d[1]!); // a new card's Again and Hard both come back within the day
    expect(d[1]).toBeLessThanOrEqual(d[2]!);
    expect(d[2]).toBeLessThan(d[3]!);
    for (const t of d) expect(t).toBeGreaterThan(T0);
  });

  test("after reviews, the log's dates and ratings come back oldest first and the next gap is from the last review", async () => {
    await recordReview(lib, card.meta.id, { rating: 3, confidence: 2, now: new Date(T0) });
    await recordReview(lib, card.meta.id, { rating: 1, confidence: 2, now: new Date(T0 + 3 * DAY) });
    await recordReview(lib, card.meta.id, { rating: 3, confidence: 2, now: new Date(T0 + 4 * DAY) });
    const h = cardHistory(lib, card.meta.id, new Date(T0 + 10 * DAY));
    expect(h.reviews.map((r) => r.rating)).toEqual([3, 1, 3]);
    expect(h.reviews.map((r) => Date.parse(r.ts))).toEqual([T0, T0 + 3 * DAY, T0 + 4 * DAY]);
    expect(Date.parse(h.next[3])).toBeGreaterThan(T0 + 10 * DAY);
  });

  test("its gem (D236): empty before a review, a rock while it grows, cut at three weeks of memory, loose when missed, and a gold rim once won back", async () => {
    const { item: it } = await addSnippet(lib, { text: "Spacing beats cramming." });
    const c = writeNewCard(lib, { kind: "card", item: it.meta.id, skills: ["learning"], topics: [], content_type: "fact", question: "q2", answer: "a2", rubric: [] });
    const gem = (at: number) => cardHistory(lib, c.meta.id, new Date(at)).gem;
    expect(gem(T0).kind).toBe("empty");
    expect(gem(T0).after[3].kind).not.toBe("empty");
    // Good reviews, each when it comes due, until it is cut; the step before says so.
    let at = T0;
    let kinds: string[] = [];
    for (let i = 0; i < 12 && kinds.at(-1) !== "cut"; i++) {
      const g = gem(at);
      const said = g.after[3];
      await recordReview(lib, c.meta.id, { rating: 3, confidence: 2, now: new Date(at) });
      at = Date.parse(cardHistory(lib, c.meta.id, new Date(at)).next[3]) - 1;
      // What it said a Good would give is what the Good gave.
      expect({ kind: gem(at).kind, seam: gem(at).seam }).toEqual({ kind: said.kind, seam: said.seam });
      // Nearly cut and "a Good now cuts it" are the same claim, both ways.
      expect(g.kind === "ready").toBe(said.kind === "cut");
      expect(said.days).toBeGreaterThan(0);
      kinds.push(gem(at).kind);
    }
    expect(kinds.at(-1)).toBe("cut");
    expect(kinds.slice(0, -1).every((k) => k === "rough" || k === "ready")).toBe(true);
    expect(gem(at).seam).toBeUndefined();
    // A miss: it comes loose, adds no days, and has no rim yet.
    expect(gem(at).after[1]).toEqual({ kind: "dull", days: 0 });
    await recordReview(lib, c.meta.id, { rating: 1, confidence: 3, now: new Date(at) });
    expect(gem(at).kind).toBe("dull");
    // Won back: cut again with the rim, which it keeps through a later miss.
    for (let i = 0; i < 12 && gem(at).kind !== "cut"; i++) {
      await recordReview(lib, c.meta.id, { rating: 3, confidence: 2, now: new Date(at) });
      at = Date.parse(cardHistory(lib, c.meta.id, new Date(at)).next[3]) - 1;
    }
    expect(gem(at)).toMatchObject({ kind: "cut", seam: true });
    expect(gem(at).after[1]).toEqual({ kind: "dull", seam: true, days: 0 });
  });
});
