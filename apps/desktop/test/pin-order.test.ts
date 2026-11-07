import { describe, expect, test } from "bun:test";
import { pinBetween } from "../src/ore";

// Pinned sources list by their pin time; a move gives the source a time between its new neighbours.
describe("pinned order", () => {
  const a = "2026-11-01T00:00:00.000Z";
  const b = "2026-11-03T00:00:00.000Z";
  test("between two, at the top, at the bottom", () => {
    expect(pinBetween(a, b)).toBe("2026-11-02T00:00:00.000Z");
    expect(pinBetween(undefined, a) < a).toBe(true);
    expect(pinBetween(b, undefined) > b).toBe(true);
  });
});
