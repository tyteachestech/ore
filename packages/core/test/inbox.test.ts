// Links added on the iPhone wait in inbox/ for the Mac to import them (D223).
import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { importQueued, queueFile, queueLink, queuedLinks, removeQueuedLink } from "../src/inbox.ts";
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

test("the device that captured a link imports it first; another takes it after a few minutes, or at once when the first couldn't", async () => {
  const lib = await tempLibrary();
  const l = queueLink(lib, "https://example.com/shared");
  const file = join(paths.inbox(lib), `${l.id}.link.json`);
  const from = (patch: object) => writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, "utf8")), ...patch }));
  const tried: string[] = [];
  const add = async (url: string) => {
    tried.push(url);
    throw new Error("offline");
  };
  // Shared on the iPhone a minute ago: this device leaves it for the phone.
  from({ device: "iphone", added: new Date(Date.now() - 60_000).toISOString() });
  expect((await importQueued(lib, add)).failed).toEqual([]);
  expect(tried).toEqual([]);
  expect(queuedLinks(lib)[0]!.error).toBeUndefined();
  // The phone tried and couldn't (a video needs the Mac's tools): this device takes it at once.
  from({ error: "only on the Mac" });
  await importQueued(lib, add);
  expect(tried).toEqual(["https://example.com/shared"]);
  // Still waiting six minutes on with no word from the phone (its app never opened): this device takes it.
  from({ error: undefined, added: new Date(Date.now() - 6 * 60_000).toISOString() });
  await importQueued(lib, add);
  expect(tried).toHaveLength(2);
});

test("a file waits beside its item, is handed to the import by its path, and leaves nothing behind", async () => {
  const lib = await tempLibrary();
  const src = join(lib.root, "picked.md");
  writeFileSync(src, "# Spacing\n\nSpace your reviews.\n");
  const q = queueFile(lib, src, ["ai"], "Spacing notes.md");
  expect(queuedLinks(lib).map((l) => [l.url, l.file, l.skills])).toEqual([["Spacing notes.md", `${q.id}/Spacing notes.md`, ["ai"]]]);
  // It fails once (the phone can't read this kind): the file stays for the next device.
  await importQueued(lib, async () => {
    throw new Error("only on the Mac");
  });
  expect(readFileSync(join(paths.inbox(lib), q.file!), "utf8")).toContain("Space your reviews");
  const seen: string[] = [];
  const r = await importQueued(lib, async (input) => {
    seen.push(readFileSync(input, "utf8"));
    return { id: "01F", title: "Spacing notes" };
  });
  expect(seen).toEqual(["# Spacing\n\nSpace your reviews.\n"]);
  expect(r.added).toEqual([{ id: "01F", title: "Spacing notes", url: "Spacing notes.md" }]);
  expect(readdirSync(paths.inbox(lib))).toEqual([]);
  // Removed before any import: the file goes too. An item whose file hasn't arrived yet isn't listed.
  const again = queueFile(lib, src);
  removeQueuedLink(lib, again.id);
  expect(readdirSync(paths.inbox(lib))).toEqual([]);
  const late = queueFile(lib, src);
  unlinkSync(join(paths.inbox(lib), late.file!));
  expect(queuedLinks(lib)).toEqual([]);
});
