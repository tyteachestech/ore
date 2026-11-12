import { expect, test } from "bun:test";
import { momentFor } from "../src/moment";
import type { CardGem, CardHistory } from "../src/ore";

const NOW = Date.parse("2026-11-12T12:00:00Z");
const DAY = 86_400_000;
const h = (now: CardGem, after: Partial<Record<1 | 2 | 3 | 4, CardGem & { days: number }>>, lastDaysAgo = 38): CardHistory => ({
  reviews: [{ ts: new Date(NOW - lastDaysAgo * DAY).toISOString(), rating: 3 }],
  next: { 1: "", 2: "", 3: "", 4: "" },
  gem: { ...now, after: { 1: { kind: "rough", days: 0 }, 2: { kind: "rough", days: 1 }, 3: { kind: "rough", days: 3 }, 4: { kind: "rough", days: 6 }, ...after } },
});

test("the moment after a rating (D237): only a gem that is cut, comes loose, is polished, or a recall worth three weeks; an everyday rating has none", () => {
  // An everyday Good on a growing rock, and on a cut gem that gains a few days: no moment.
  expect(momentFor(h({ kind: "rough" }, {}), 3, { now: NOW })).toBeNull();
  expect(momentFor(h({ kind: "cut" }, { 3: { kind: "cut", days: 9 } }), 3, { now: NOW })).toBeNull();
  // No history (a phone without it): nothing, and no crash.
  expect(momentFor(undefined, 3)).toBeNull();
  // Cut: the days it added and how long since he saw it.
  const cut = momentFor(h({ kind: "ready" }, { 3: { kind: "cut", days: 27 } }), 3, { now: NOW })!;
  expect(cut).toMatchObject({ tone: "cut", days: 27, from: { kind: "ready" }, to: { kind: "cut" } });
  expect(cut.line).toBe("Last seen 38 days ago, and you still had it. Cut: you'd still recall this three weeks from now.");
  // Missed a cut gem: it comes loose, no days, and the line is true to whether he was sure.
  const miss = momentFor(h({ kind: "cut" }, { 1: { kind: "dull", days: 0 } }), 1, { now: NOW, sure: true })!;
  expect(miss).toMatchObject({ tone: "miss", days: 0, to: { kind: "dull" } });
  expect(miss.line).toContain("You were sure");
  expect(momentFor(h({ kind: "cut" }, { 1: { kind: "dull", days: 0 } }), 1, { now: NOW })!.line).toStartWith("Loose, not lost");
  // A miss on a rock that was never cut loses nothing he had: no moment.
  expect(momentFor(h({ kind: "rough" }, {}), 1, { now: NOW, sure: true })).toBeNull();
  // Won back: the rim.
  const back = momentFor(h({ kind: "dull" }, { 3: { kind: "cut", seam: true, days: 22 } }), 3, { now: NOW })!;
  expect(back).toMatchObject({ tone: "cut", to: { kind: "cut", seam: true } });
  expect(back.line).toBe("Won back. It keeps a gold rim.");
  // Polished: a new case passed on a cut gem, once.
  expect(momentFor(h({ kind: "cut" }, { 3: { kind: "cut", days: 4 } }), 3, { now: NOW, remix: true })).toMatchObject({ tone: "cut", to: { polished: true }, line: "Polished: you recalled it on a new case." });
  expect(momentFor(h({ kind: "cut", polished: true }, { 3: { kind: "cut", polished: true, days: 4 } }), 3, { now: NOW, remix: true })).toBeNull();
  // A hard recall on a gem already cut: three weeks or more of memory is the biggest reward there is.
  expect(momentFor(h({ kind: "cut" }, { 3: { kind: "cut", days: 61 } }), 3, { now: NOW })).toMatchObject({ tone: "deep", days: 61, line: "Last seen 38 days ago, and you still had it." });
});
