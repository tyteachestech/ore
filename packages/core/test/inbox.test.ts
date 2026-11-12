// Links added on the iPhone wait in inbox/ for the Mac to import them (D223).
import { expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { importQueued, queueLink, queuedLinks, removeQueuedLink } from "../src/inbox.ts";
import { paths } from "../src/library.ts";
import { tempLibrary } from "./helpers.ts";

test("a queued link waits, the Mac imports it, and a failure keeps its reason", async () => {
  const lib = await tempLibrary();
  expect(() => queueLink(lib, "not a link")).toThrow(/isn’t a link/);
  const a = queueLink(lib, " https://example.com/a ", ["ai"]);
  const b = queueLink(lib, "https://example.com/broken");
  expect(queuedLinks(lib).map((l) => [l.url, l.skills])).toEqual([
    ["https://example.com/a", ["ai"]],
    ["https://example.com/broken", []],
  ]);

  const seen: [string, string[]][] = [];
  const r = await importQueued(lib, async (url, skills) => {
    seen.push([url, skills]);
    if (url.endsWith("broken")) throw new Error("Couldn’t open that page (HTTP 404 from example.com).");
    return { id: "01X", title: "A" };
  });
  expect(seen).toEqual([["https://example.com/a", ["ai"]], ["https://example.com/broken", []]]);
  expect(r.added).toEqual([{ id: "01X", title: "A", url: "https://example.com/a" }]);
  expect(queuedLinks(lib).map((l) => [l.id, l.error])).toEqual([[b.id, "Couldn’t open that page (HTTP 404 from example.com)."]]);

  // A failed one is tried again (the Mac may have been offline), and the same failure isn't reported twice.
  const again = await importQueued(lib, async () => {
    throw new Error("Couldn’t open that page (HTTP 404 from example.com).");
  });
  expect([again.added, again.failed]).toEqual([[], []]);
  expect(queuedLinks(lib)).toHaveLength(1);
  removeQueuedLink(lib, b.id);
  // A link pasted without its scheme gets https://.
  expect(queueLink(lib, "example.com/c").url).toBe("https://example.com/c");
  removeQueuedLink(lib, queuedLinks(lib)[0]!.id);
  expect(queuedLinks(lib)).toEqual([]);
  expect(existsSync(paths.inbox(lib)) ? readdirSync(paths.inbox(lib)) : []).toEqual([]);
  expect(a.device.length).toBeGreaterThan(0);
});
