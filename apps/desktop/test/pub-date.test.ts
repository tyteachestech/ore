import { expect, test } from "bun:test";
import { pubDate } from "../src/original";

// The date under a source's title (D122: every source keeps its own date).
test("a source's published date reads as a date, never a wrong one", () => {
  expect(pubDate("2024-12-19")).toBe("Dec 19, 2024");
  expect(pubDate("2024-12-19T23:30:00-08:00")).toBe("Dec 19, 2024");
  expect(pubDate("2024-03")).toBe("Mar 2024");
  expect(pubDate("1999")).toBe("1999");
  expect(pubDate("yesterday")).toBeNull();
  expect(pubDate(undefined)).toBeNull();
});
