import { expect, test } from "bun:test";
import { importQueued, queueLink, queuedLinks, removeQueuedLink } from "../src/inbox.ts";
import { commands } from "../../cli/src/commands.ts";
import { tempLibrary } from "./helpers.ts";

test("inbox retries report every attempted error while announcing only changed errors", async () => {
  const lib = await tempLibrary();
  const bad = queueLink(lib, "https://example.com/missing");
  const fail = async () => { throw new Error("Still offline"); };
  await importQueued(lib, fail);
  const again = await importQueued(lib, fail);
  expect(again).toMatchObject({ added: [], failed: [], errors: [{ id: bad.id, error: "Still offline" }] });
  queueLink(lib, "https://example.com/works");
  const mixed = await importQueued(lib, async (url) => {
    if (url === bad.url) return fail();
    return { id: "saved", title: "Saved" };
  });
  expect(mixed).toMatchObject({ added: [{ id: "saved" }], failed: [], errors: [{ id: bad.id, error: "Still offline" }] });
  expect(queuedLinks(lib).map((l) => l.id)).toEqual([bad.id]);
});

test("the inbox command names an unchanged failed retry in errors, and exits 0 so the Mac does not repeat it", async () => {
  const lib = await tempLibrary();
  const savedLibrary = process.env.ORE_LIBRARY;
  const savedFetch = globalThis.fetch;
  let requests = 0;
  try {
    process.env.ORE_LIBRARY = lib.root;
    globalThis.fetch = Object.assign(async () => {
      requests++;
      return new Response("Not found", { status: 404 });
    }, { preconnect: savedFetch.preconnect });
    const link = queueLink(lib, "https://example.com/missing");
    const first = await commands.inbox!.run([], { import: true, json: true });
    expect(first.exitCode).toBe(1);
    const retry = await commands.inbox!.run([], { import: true, json: true });
    expect(retry.exitCode).toBe(0);
    expect(requests).toBe(2);
    expect(retry.data).toMatchObject({ failed: [], errors: [{ id: link.id, error: expect.stringContaining("404") }] });
    expect(retry.text).toContain("404");
    expect(queuedLinks(lib)).toHaveLength(1);
  } finally {
    globalThis.fetch = savedFetch;
    if (savedLibrary === undefined) delete process.env.ORE_LIBRARY;
    else process.env.ORE_LIBRARY = savedLibrary;
  }
});

test("a link removed on the iPhone while it was importing is not an error", async () => {
  const lib = await tempLibrary();
  const gone = queueLink(lib, "https://example.com/removed");
  const r = await importQueued(lib, async () => {
    removeQueuedLink(lib, gone.id);
    throw new Error("cancelled");
  });
  expect(r).toMatchObject({ added: [], failed: [], errors: [] });
});
