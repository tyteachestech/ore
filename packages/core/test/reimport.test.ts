import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { addHighlight, readAnnotations } from "../src/annotations.ts";
import { addSource, addText, reimportSource, undoReimport } from "../src/ingest/index.ts";
import { findItem, renameItem, setItemStatus } from "../src/items.ts";
import { tempLibrary } from "./helpers.ts";

// Reimport: the original is fetched again and its new text replaces the old in the same source.

const URL_ = "https://example.com/notes.md";
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});
let page = "";
const serve = () => {
  globalThis.fetch = (async () => new Response(page, { headers: { "content-type": "text/markdown" } })) as unknown as typeof fetch;
};

const V1 = "# Spacing\n\nSpaced practice beats massed practice.\n\nSleep consolidates memory.\n\nTesting yourself is the strongest study move.\n";
const V2 = "# Spacing\n\nAn intro paragraph that is new.\n\nSpaced practice beats massed practice.\n\nTesting yourself is the strongest study move.\n";

describe("reimport", () => {
  test("re-anchors highlights that still match, removes the ones whose passage is gone, keeps the rest of the source", async () => {
    const lib = await tempLibrary();
    page = V1;
    serve();
    const item = await addSource(lib, URL_);
    const kept = addHighlight(item, { exact: "Spaced practice beats massed practice.", intent: "card" });
    const gone = addHighlight(item, { exact: "Sleep consolidates memory.", intent: "keep" });
    const asked = addHighlight(item, { exact: "Sleep consolidates", intent: "question" });
    await renameItem(lib, item.meta.id, "My spacing notes");
    await setItemStatus(lib, item.meta.id, "reading");

    page = V2;
    const r = await reimportSource(lib, item.meta.id);
    expect(r.changed).toBe(true);
    expect(r.removed.map((a) => a.id)).toEqual([gone.id]);
    const now = findItem(lib, item.meta.id);
    expect(now.body).toBe(V2);
    expect(now.meta.title).toBe("My spacing notes");
    expect(now.meta.status).toBe("reading");
    const anns = readAnnotations(now);
    // A question is his own words: kept even though its passage is gone.
    expect(anns.map((a) => a.id).sort()).toEqual([kept.id, asked.id].sort());
    const k = anns.find((a) => a.id === kept.id)!;
    expect(V2.slice(k.start, k.end)).toBe("Spaced practice beats massed practice.");
    expect(readFileSync(`${now.dir}/source.md`, "utf8")).toBe(V2);
  });

  test("undo puts back the old text and highlights, and running it again redoes", async () => {
    const lib = await tempLibrary();
    page = V1;
    serve();
    const item = await addSource(lib, URL_);
    const gone = addHighlight(item, { exact: "Sleep consolidates memory.", intent: "keep" });
    const kept = addHighlight(item, { exact: "Testing yourself", intent: "keep" });
    page = V2;
    await reimportSource(lib, item.meta.id);
    await setItemStatus(lib, item.meta.id, "done");

    let back = await undoReimport(lib, item.meta.id);
    expect(back.body).toBe(V1);
    expect(back.meta.status).toBe("done"); // what he did since stays
    expect(readFileSync(`${back.dir}/source.md`, "utf8")).toBe(V1);
    let anns = readAnnotations(back);
    expect(anns.map((a) => a.id).sort()).toEqual([gone.id, kept.id].sort());
    expect(anns.every((a) => V1.slice(a.start, a.end) === a.exact)).toBe(true);

    back = await undoReimport(lib, item.meta.id);
    expect(back.body).toBe(V2);
    anns = readAnnotations(back);
    expect(anns.map((a) => a.id)).toEqual([kept.id]);
    expect(V2.slice(anns[0]!.start, anns[0]!.end)).toBe("Testing yourself");
  });

  test("an unchanged original changes nothing; a source with no link can't be reimported", async () => {
    const lib = await tempLibrary();
    page = V1;
    serve();
    const item = await addSource(lib, URL_);
    const before = readFileSync(item.docPath, "utf8");
    expect((await reimportSource(lib, item.meta.id)).changed).toBe(false);
    expect(readFileSync(item.docPath, "utf8")).toBe(before);
    expect(undoReimport(lib, item.meta.id)).rejects.toThrow("no reimport");
    const pasted = await addText(lib, "Just some text");
    expect(reimportSource(lib, pasted.meta.id)).rejects.toThrow("from a link or a file");
  });

  test("a file is read again from the copy kept with it, so a better reader fixes text it once got wrong", async () => {
    const lib = await tempLibrary();
    const item = await addSource(lib, join(import.meta.dir, "fixtures/intake/files/textbook.pdf"));
    // The text an older reader made of it: a margin note glued into the line beside it.
    const old = readFileSync(item.docPath, "utf8").replace("The **testing effect**, found", "TheTesting effect testing effect, found");
    writeFileSync(item.docPath, old);
    const h = addHighlight(findItem(lib, item.meta.id), { exact: "found again and again since the 1900s", intent: "keep" });
    const r = await reimportSource(lib, item.meta.id);
    expect(r.changed).toBe(true);
    expect(r.item.body).toContain("The **testing effect**, found");
    expect(r.item.meta.title).toBe(item.meta.title);
    expect(readAnnotations(r.item).find((a) => a.id === h.id)?.status).not.toBe("deleted");
    expect((await undoReimport(lib, item.meta.id)).body).toContain("TheTesting effect");
  });
});
