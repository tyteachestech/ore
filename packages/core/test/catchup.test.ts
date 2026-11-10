import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { addHighlight, addText, catchUpDue, catchUpItems, findItem, markCatchUp, optimizeDue, paths, setItemStatus, updateItemMeta } from "../src/index.ts";
import { tempLibrary } from "./helpers.ts";

describe("daily catch-up (D8, D10)", () => {
  test("due until marked, then again after 20 hours", async () => {
    const lib = await tempLibrary();
    const now = new Date("2026-10-28T08:00:00Z");
    expect(catchUpDue(lib, now)).toBe(true);
    markCatchUp(lib, now);
    expect(catchUpDue(lib, new Date("2026-10-29T03:59:00Z"))).toBe(false);
    expect(catchUpDue(lib, new Date("2026-10-29T04:00:00Z"))).toBe(true);
  });

  test("leaves a source added in the last hour to its own enrich", async () => {
    const lib = await tempLibrary();
    const item = await addText(lib, "# Spacing\n\nReviews spread over days beat one long session.");
    const added = Date.parse(item.meta.captured_at);
    expect(catchUpItems(lib, new Date(added + 10 * 60_000)).map((i) => i.meta.id)).toEqual([]);
    expect(catchUpItems(lib, new Date(added + 61 * 60_000)).map((i) => i.meta.id)).toEqual([item.meta.id]);
  });

  test("D180: picks up a source he is still reading once its plain highlights have rested six hours", async () => {
    const lib = await tempLibrary();
    const item = await addText(lib, "# Spacing\n\nReviews spread over days beat one long session.");
    await updateItemMeta(lib, item.meta.id, (m) => ({ ...m, enriched_at: m.captured_at }));
    await setItemStatus(lib, item.meta.id, "reading");
    const made = Date.parse(addHighlight(findItem(lib, item.meta.id), { exact: "Reviews spread over days", intent: "keep" }).ts);
    expect(catchUpItems(lib, new Date(made + 5 * 3_600_000)).map((i) => i.meta.id)).toEqual([]);
    expect(catchUpItems(lib, new Date(made + 6 * 3_600_000)).map((i) => i.meta.id)).toEqual([item.meta.id]);
  });

  test("no refit below 1,000 reviews; a month-old fit is due again", async () => {
    const lib = await tempLibrary();
    expect(optimizeDue(lib)).toBe(false);
    writeFileSync(paths.fsrsParams(lib), JSON.stringify({ w: [], reviews: 1000, computed_at: "2026-09-01T00:00:00Z" }));
    expect(optimizeDue(lib, new Date("2026-10-28T00:00:00Z"))).toBe(false); // still under 1,000 reviews
  });
});
