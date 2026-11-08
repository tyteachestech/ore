import { describe, expect, test } from "bun:test";
import { addSnippet } from "../src/ingest/index.ts";
import { findItem, setItemStatus } from "../src/items.ts";
import { tempLibrary } from "./helpers.ts";

describe("reading status", () => {
  test("Undo of a move to To read puts the finish date back as it was, not now", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Finished last week." });
    const id = item.meta.id;
    await setItemStatus(lib, id, "done");
    expect((await setItemStatus(lib, id, "reading")).finished_at).toBeUndefined();
    const back = await setItemStatus(lib, id, "done", "2026-11-01T09:00:00.000Z");
    expect(back.finished_at).toBe("2026-11-01T09:00:00.000Z");
    expect(findItem(lib, id).meta.finished_at).toBe("2026-11-01T09:00:00.000Z");
    // Finished again by hand, it is finished now.
    await setItemStatus(lib, id, "reading");
    expect((await setItemStatus(lib, id, "done")).finished_at).not.toBe("2026-11-01T09:00:00.000Z");
  });

  test("a finish date that isn't a date, or one on a source that isn't done, is refused", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Not a date." });
    await expect(setItemStatus(lib, item.meta.id, "done", "last tuesday")).rejects.toThrow();
    await expect(setItemStatus(lib, item.meta.id, "reading", "2026-11-01T09:00:00.000Z")).rejects.toThrow();
    expect(findItem(lib, item.meta.id).meta.status).not.toBe("done");
  });
});
