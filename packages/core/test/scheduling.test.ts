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
