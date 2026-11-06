import { describe, expect, test } from "bun:test";
import { addSnippet } from "../src/ingest/index.ts";
import { findItem, markOpened, OPEN_STAMP_MS, setItemStatus } from "../src/items.ts";
import { tempLibrary } from "./helpers.ts";

describe("opening a source (D110)", () => {
  test("starts it, stamps opened_at, and leaves the file alone when opened again soon", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Last touched comes first." });
    const id = item.meta.id;
    const t0 = new Date("2026-11-03T10:00:00Z");
    const m = await markOpened(lib, id, t0);
    expect(m.status).toBe("reading");
    expect(m.opened_at).toBe(t0.toISOString());
    expect((await markOpened(lib, id, new Date(t0.getTime() + 60_000))).opened_at).toBe(t0.toISOString());
    const later = new Date(t0.getTime() + OPEN_STAMP_MS + 1);
    expect((await markOpened(lib, id, later)).opened_at).toBe(later.toISOString());
    expect(findItem(lib, id).body).toBe(item.body);
  });

  test("a finished source stays done", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: "Done stays done." });
    await setItemStatus(lib, item.meta.id, "done");
    expect((await markOpened(lib, item.meta.id)).status).toBe("done");
  });
});
