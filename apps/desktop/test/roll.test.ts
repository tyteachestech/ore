import { expect, test } from "bun:test";
import { rollPlan } from "../src/Roll";

test("a number rolls only the digits that change, right-aligned, up when it grows", () => {
  expect(rollPlan("9", "10")).toEqual({ chars: [{ was: " ", now: "1" }, { was: "9", now: "0" }], up: true });
  expect(rollPlan("12", "13").chars.filter((c) => c.was !== c.now)).toEqual([{ was: "2", now: "3" }]);
  expect(rollPlan("10", "9").up).toBe(false);
  expect(rollPlan("<1", "2").up).toBe(true);
});
