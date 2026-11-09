import { expect, test } from "bun:test";
import { rescuedWorthSaying } from "../src/ore";

test("the end screen's rescued line only when rescues are a minority of the session: over a backlog it would be every card (daily-session doc)", () => {
  expect(rescuedWorthSaying({ reviews: 20, rescued: 13 })).toBe(false);
  expect(rescuedWorthSaying({ reviews: 20, rescued: 10 })).toBe(false);
  expect(rescuedWorthSaying({ reviews: 20, rescued: 4 })).toBe(true);
  expect(rescuedWorthSaying({ reviews: 3, rescued: 1 })).toBe(true);
  expect(rescuedWorthSaying({ reviews: 20, rescued: 0 })).toBe(false);
});
