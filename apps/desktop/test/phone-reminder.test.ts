import { expect, test } from "bun:test";
import { reminderText, reminderTimes } from "../src/phone/reminder";

// The iPhone can't ask at reminder time whether today's goal is open (D67), so it hands iOS the days ahead (D228).
const day = { reminder: "09:30", weekdays_only: false, counts: true, met: false, due: 12 };
const at = (d: Date) => `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
// Wednesday 11 Nov 2026, local time.
const wed = (h: number, m = 0) => new Date(2026, 10, 11, h, m);

test("before the time, today's reminder comes first, then one a day at the same time", () => {
  const times = reminderTimes(day, wed(8), 3).map(at);
  expect(times).toEqual(["11/11 9:30", "11/12 9:30", "11/13 9:30"]);
});

test("today's goes once the goal is met, nothing is due, or the time has passed; later days stay", () => {
  expect(reminderTimes({ ...day, met: true }, wed(8), 2).map(at)).toEqual(["11/12 9:30"]);
  expect(reminderTimes({ ...day, due: 0 }, wed(8), 2).map(at)).toEqual(["11/12 9:30"]);
  expect(reminderTimes(day, wed(10), 2).map(at)).toEqual(["11/12 9:30"]);
});

test("weekdays only leaves the weekend out; off means none at all", () => {
  // Friday the 13th to Monday the 16th.
  const fri = new Date(2026, 10, 13, 8);
  expect(reminderTimes({ ...day, weekdays_only: true }, fri, 4).map(at)).toEqual(["11/13 9:30", "11/16 9:30"]);
  expect(reminderTimes({ ...day, reminder: "" }, fri)).toEqual([]);
});

test("it says his plan, and today's minutes from the slice, later days the goal", () => {
  const t = { plan: "my morning coffee", slice_ms: 7 * 60_000, goal_minutes: 10 };
  expect(reminderText(t, true)).toEqual({ title: "After my morning coffee, I review.", body: "About 7 min of your most urgent exercises." });
  expect(reminderText({ ...t, plan: "" }, false)).toEqual({ title: "Time for today’s review", body: "About 10 min of your most urgent exercises." });
});
