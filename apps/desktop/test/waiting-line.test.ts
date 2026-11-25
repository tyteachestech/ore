import { expect, test } from "bun:test";
import { waiting } from "../src/Home";
import type { Today } from "../src/ore";

// What Home and the end of Review say about new exercises the daily limit held back. It gave the rule D144 replaced
// ("as your goal leaves room"), so a learner with a backlog read that more review would crowd new ones out (F731).
const t = (new_waiting: number, new_per_day = 10) => ({ new_waiting, new_per_day }) as Today;

test("more new exercises waiting than a day takes: it gives the day's limit, the rule that holds them", () => {
  expect(waiting(t(19))).toBe("19 new exercises wait. Up to 10 start each day.");
  expect(waiting(t(19, 1))).toBe("19 new exercises wait. One starts each day.");
});

test("a day's worth or fewer start tomorrow; with new exercises off it says where", () => {
  expect(waiting(t(7))).toBe("7 new exercises start tomorrow.");
  expect(waiting(t(1))).toBe("1 new exercise starts tomorrow.");
  expect(waiting(t(3, 0))).toBe("3 new exercises wait. New exercises are off in Settings.");
});
