import { expect, test } from "bun:test";
import { depthText, lastWin, longGapText, rescuedWorthSaying, type DueEntry } from "../src/ore";

test("the end screen's rescued line only when rescues are a minority of the session: over a backlog it would be every card (daily-session doc)", () => {
  expect(rescuedWorthSaying({ reviews: 20, rescued: 13 })).toBe(false);
  expect(rescuedWorthSaying({ reviews: 20, rescued: 10 })).toBe(false);
  expect(rescuedWorthSaying({ reviews: 20, rescued: 4 })).toBe(true);
  expect(rescuedWorthSaying({ reviews: 3, rescued: 1 })).toBe(true);
  expect(rescuedWorthSaying({ reviews: 20, rescued: 0 })).toBe(false);
});

const due = (id: string, retrievability: number, over: Partial<DueEntry> = {}): DueEntry => ({ id, kind: "card", state: "live", item: "I", skills: [], question: "q", relearn: false, due: "2026-10-01T00:00:00Z", retrievability, ...over });
const ids = (q: DueEntry[] | null) => q?.map((e) => e.id) ?? null;

test("a goal that closes on a miss gets one more card first, the likeliest recall of the next ten (D177)", () => {
  expect(ids(lastWin([due("a", 0.4), due("b", 0.9), due("c", 0.7)]))).toEqual(["b", "a", "c"]);
  // The card just missed (its relearn pass) and a new card are no sure win.
  expect(ids(lastWin([due("miss", 0.99, { relearn: true }), due("new", 0, { due: null }), due("ok", 0.8)]))).toEqual(["ok", "miss", "new"]);
  // Nothing likely enough in reach: the session ends as it did.
  expect(lastWin([due("a", 0.4), due("b", 0.5)])).toBeNull();
  expect(lastWin([...Array.from({ length: 10 }, (_, i) => due(`x${i}`, 0.3)), due("far", 0.95)])).toBeNull();
  expect(lastWin([])).toBeNull();
});

test("the end screen names the longest gap he recalled across, from a week up (D177)", () => {
  expect(longGapText({ longest_days: 23 })).toBe("You recalled one you last saw 23 days ago");
  expect(longGapText({ longest_days: 7 })).toBe("You recalled one you last saw 7 days ago");
  expect(longGapText({ longest_days: 6 })).toBeNull();
  expect(longGapText({})).toBeNull();
});

test("a span of memory reads in the unit a person would say it in (D197)", () => {
  expect(depthText(1)).toBe("1 day");
  expect(depthText(41)).toBe("41 days");
  expect(depthText(90)).toBe("3 months");
  expect(depthText(729)).toBe("24 months");
  expect(depthText(730)).toBe("2 years");
  expect(depthText(880)).toBe("2.4 years");
});
