// Links added on the iPhone wait in inbox/ for the Mac to import them (D223).
import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, unlinkSync, utimesSync, writeFileSync } from "node:fs";
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
  // `inbox` names the waiting item it came from, so the phone can open what a share became.
  expect(r.added).toEqual([{ id: "01X", title: "A", url: "https://example.com/a", inbox: expect.any(String) }]);
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
  expect(r.added).toEqual([{ id: "01F", title: "Spacing notes", url: "Spacing notes.md", inbox: q.id }]);
  expect(readdirSync(paths.inbox(lib))).toEqual([]);
  // Removed before any import: the file goes too. An item whose file hasn't arrived yet isn't listed.
  const again = queueFile(lib, src);
  removeQueuedLink(lib, again.id);
  expect(readdirSync(paths.inbox(lib))).toEqual([]);
  const late = queueFile(lib, src);
  unlinkSync(join(paths.inbox(lib), late.file!));
  expect(queuedLinks(lib)).toEqual([]);
  removeQueuedLink(lib, late.id);
  // A name with two dots in a row is a name, not a way out of the inbox; a path that leaves it is never listed.
  const dotted = queueFile(lib, src, [], "report..final.md");
  expect(queuedLinks(lib).map((l) => l.url)).toEqual(["report..final.md"]);
  writeFileSync(join(paths.inbox(lib), `${dotted.id}.file.json`), JSON.stringify({ ...dotted, file: "../skills.yaml" }));
  expect(queuedLinks(lib)).toEqual([]);
});

test("removing a waiting file with Undo keeps its bytes and descriptor through repeated restore (PHONE-02)", async () => {
  const { restoreQueuedLink } = await import("../src/inbox.ts");
  const lib = await tempLibrary();
  const input = join(lib.root, "paper.pdf");
  const bytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0xff, 0x00]);
  writeFileSync(input, bytes);
  const q = queueFile(lib, input, ["ai"]);
  unlinkSync(input);
  const descriptor = join(paths.inbox(lib), `${q.id}.file.json`);
  const original = readFileSync(descriptor, "utf8");
  for (let i = 0; i < 2; i++) {
    removeQueuedLink(lib, q.id, true);
    expect(queuedLinks(lib)).toEqual([]);
    expect(readFileSync(join(paths.inbox(lib), q.file!))).toEqual(bytes);
    restoreQueuedLink(lib, q.id);
    expect(queuedLinks(lib)).toEqual([q]);
    expect(readFileSync(descriptor, "utf8")).toBe(original);
  }
  removeQueuedLink(lib, q.id);
  expect(existsSync(join(paths.inbox(lib), q.file!))).toBe(false);
});

test("Undo of a waiting link keeps its original metadata and refuses to replace a live entry (PHONE-02)", async () => {
  const { restoreQueuedLink } = await import("../src/inbox.ts");
  const lib = await tempLibrary();
  const q = queueLink(lib, "https://example.com/a", ["ai"]);
  removeQueuedLink(lib, q.id, true);
  const descriptor = join(paths.inbox(lib), `${q.id}.link.json`);
  writeFileSync(descriptor, JSON.stringify({ ...q, url: "https://example.com/new" }));
  expect(() => restoreQueuedLink(lib, q.id)).toThrow(/already waiting/);
  expect(queuedLinks(lib)[0]!.url).toBe("https://example.com/new");
  unlinkSync(descriptor);
  restoreQueuedLink(lib, q.id);
  expect(queuedLinks(lib)).toEqual([q]);
});

test("a removed entry kept for Undo is dropped, with its file, a day after it was removed (PHONE-02)", async () => {
  const { restoreQueuedLink, KEEP_REMOVED_MS } = await import("../src/inbox.ts");
  const lib = await tempLibrary();
  const input = join(lib.root, "old.pdf");
  writeFileSync(input, "x");
  const old = queueFile(lib, input);
  const fresh = queueLink(lib, "https://example.com/b");
  removeQueuedLink(lib, old.id, true);
  const kept = join(paths.inbox(lib), "removed", `${old.id}.file.json`);
  // Queued long ago, removed just now: still there for an Undo.
  removeQueuedLink(lib, fresh.id, true);
  expect(existsSync(kept)).toBe(true);
  const then = new Date(Date.now() - KEEP_REMOVED_MS - 1000);
  utimesSync(kept, then, then);
  restoreQueuedLink(lib, fresh.id);
  removeQueuedLink(lib, fresh.id, true);
  expect(existsSync(kept)).toBe(false);
  expect(existsSync(join(paths.inbox(lib), old.id))).toBe(false);
  expect(() => restoreQueuedLink(lib, old.id)).toThrow(/no removed link/);
});
