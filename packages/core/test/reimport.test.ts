import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdtempSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addHighlight, readAnnotations } from "../src/annotations.ts";
import { addSnippet, addSource, addText, canReimport, reimportSource, undoReimport } from "../src/ingest/index.ts";
import { findItem, renameItem, setItemStatus } from "../src/items.ts";
import { readNotes, setNotes } from "../src/notes.ts";
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
    await expect(reimportSource(lib, pasted.meta.id)).rejects.toThrow("from a link or a file");
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

  // F181: Reimport is offered for every source with an original to read, so a recording is heard again
  // (D167), a Word file or a screenshot read again, by a better reader.
  const FILES = join(import.meta.dir, "fixtures/intake/files");
  const vtt = (lines: string[]) => "WEBVTT\n\n" + lines.map((w, i) => `00:00:${String(i * 10).padStart(2, "0")}.000 --> 00:00:${String(i * 10 + 9).padStart(2, "0")}.000\n${w}`).join("\n\n") + "\n";
  /** A stand-in for the Mac's transcriber that prints `out`, or fails with `code` (3: macOS too old). */
  const hears = (out: string | { code: number }) => {
    const dir = mkdtempSync(join(tmpdir(), "ore-tx-"));
    writeFileSync(join(dir, "out.vtt"), typeof out === "string" ? out : "");
    writeFileSync(join(dir, "transcribe"), typeof out === "string" ? `#!/bin/sh\ncat '${join(dir, "out.vtt")}'\n` : `#!/bin/sh\nexit ${out.code}\n`);
    chmodSync(join(dir, "transcribe"), 0o755);
    process.env.ORE_TRANSCRIBE = join(dir, "transcribe");
  };
  const was = process.env.ORE_TRANSCRIBE;
  afterEach(() => {
    if (was === undefined) delete process.env.ORE_TRANSCRIBE;
    else process.env.ORE_TRANSCRIBE = was;
  });
  const recording = () => {
    const f = join(mkdtempSync(join(tmpdir(), "ore-rec-")), "Lecture on recall.mp3");
    writeFileSync(f, new Uint8Array(4096).map((_, i) => i % 251));
    return f;
  };

  test("Reimport is offered for a link and for every file with its original kept, not for text, a snippet or a file whose original is gone (F181)", async () => {
    const lib = await tempLibrary();
    hears(vtt(["Retrieval makes memories last."]));
    const audio = await addSource(lib, recording());
    const word = await addSource(lib, join(FILES, "word-code.docx"));
    const shot = await addSource(lib, join(FILES, "screenshot.png")).catch(() => undefined); // OCR is the Mac's
    const pdf = await addSource(lib, join(FILES, "textbook.pdf"));
    page = V1;
    serve();
    const link = await addSource(lib, URL_);
    for (const i of [audio, word, pdf, link, ...(shot ? [shot] : [])]) expect([i.meta.title, canReimport(i)]).toEqual([i.meta.title, true]);
    const md = await addSource(lib, join(FILES, "obsidian-note.md"));
    const pasted = await addText(lib, "Just some text");
    const snip = (await addSnippet(lib, { text: "A passage he kept.", url: URL_ })).item;
    for (const i of [md, pasted, snip]) expect([i.meta.title, canReimport(i)]).toEqual([i.meta.title, false]);
    // Its original deleted in Finder: not offered, and a Reimport already on its way leaves the source as it was.
    unlinkSync(join(audio.dir, "source.mp3"));
    expect(canReimport(findItem(lib, audio.meta.id))).toBe(false);
    const before = readFileSync(audio.docPath, "utf8");
    await expect(reimportSource(lib, audio.meta.id)).rejects.toThrow("from a link or a file");
    expect(readFileSync(audio.docPath, "utf8")).toBe(before);
  });

  test("a recording is heard again from its kept audio: highlights on words still spoken stay, notes, title and status stay, Undo and redo swap (F181, D167)", async () => {
    const lib = await tempLibrary();
    hears(vtt(["Welcome to the lecture.", "Retrieval makes memories last.", "Sleep helps the memory settle.", "Cramming is the old way of the lecture hall."]));
    const item = await addSource(lib, recording());
    const audio = readFileSync(join(item.dir, "source.mp3"));
    const ino = statSync(join(item.dir, "source.mp3")).ino;
    await renameItem(lib, item.meta.id, "Lecture 4");
    await setItemStatus(lib, item.meta.id, "reading");
    await setNotes(lib, item.meta.id, "My own thoughts on recall.");
    const stays = addHighlight(findItem(lib, item.meta.id), { exact: "Retrieval makes memories last", intent: "keep" });
    const near = addHighlight(findItem(lib, item.meta.id), { exact: "Sleep helps the memory settle", intent: "keep" });
    const goes = addHighlight(findItem(lib, item.meta.id), { exact: "Cramming is the old way", intent: "keep" });
    const asked = addHighlight(findItem(lib, item.meta.id), { exact: "of the lecture hall", intent: "question", note: "Why did cramming last?" });
    // A better transcriber hears a line more rightly, and hears the last one as what was really said.
    hears(vtt(["Welcome to the lecture.", "Retrieval makes memories last.", "Sleep helps the memories settle overnight.", "Spacing beats a long night of study."]));
    const r = await reimportSource(lib, item.meta.id);
    expect(r.changed).toBe(true);
    expect(r.item.body).toContain("Sleep helps the memories settle overnight.");
    expect(r.item.meta).toMatchObject({ title: "Lecture 4", status: "reading" });
    expect(readNotes(r.item)).toBe("My own thoughts on recall.");
    const anns = readAnnotations(r.item);
    // Its passage gone, a highlight goes; a question is his own words and stays (D93).
    expect(anns.map((a) => a.id).sort()).toEqual([stays.id, near.id, asked.id].sort());
    expect(r.removed.map((a) => a.id)).toEqual([goes.id]);
    // The audio is the same original, still there to play, and its new transcript beside it.
    expect(readFileSync(join(item.dir, "source.mp3")).equals(audio)).toBe(true);
    expect(readFileSync(join(item.dir, "transcript.vtt"), "utf8")).toContain("overnight");
    // The kept audio (up to 200 MB) isn't written again: the same file, read in place.
    expect(statSync(join(item.dir, "source.mp3")).ino).toBe(ino);
    const back = await undoReimport(lib, item.meta.id);
    expect(back.body).toContain("Cramming is the old way");
    expect(readAnnotations(back).map((a) => a.id)).toContain(goes.id);
    expect(readFileSync(join(item.dir, "source.mp3")).equals(audio)).toBe(true);
    expect((await undoReimport(lib, item.meta.id)).body).toContain("overnight");
    expect(readNotes(findItem(lib, item.meta.id))).toBe("My own thoughts on recall.");
  });

  test("a recording that can't be heard again here, or is heard as silence, keeps its transcript and says why without a paste step (F181)", async () => {
    const lib = await tempLibrary();
    hears(vtt(["Retrieval makes memories last."]));
    const item = await addSource(lib, recording());
    addHighlight(findItem(lib, item.meta.id), { exact: "Retrieval makes memories last", intent: "keep" });
    const before = readFileSync(item.docPath, "utf8");
    for (const [out, says] of [[{ code: 3 }, "needs macOS 26"], ["WEBVTT\n\n", "Heard no speech"]] as const) {
      hears(out);
      const e = await reimportSource(lib, item.meta.id).then(() => undefined, (e: Error) => e);
      expect(e?.message).toContain(says);
      expect(e?.message).not.toContain("paste it here");
      expect(e?.message).toContain("transcript is as it was");
      expect(readFileSync(item.docPath, "utf8")).toBe(before);
      expect(readAnnotations(findItem(lib, item.meta.id))).toHaveLength(1);
    }
    expect(existsSync(join(lib.root, ".ore", "reimport", item.meta.id))).toBe(false);
    // The same for a recording added from its link: it is fetched again, then can't be heard.
    hears(vtt(["Retrieval makes memories last."]));
    globalThis.fetch = (async () => new Response(new Uint8Array(4096), { headers: { "content-type": "audio/mpeg" } })) as unknown as typeof fetch;
    const linked = await addSource(lib, "https://media.example.com/lecture-on-recall.mp3");
    hears({ code: 3 });
    const e = await reimportSource(lib, linked.meta.id).then(() => undefined, (e: Error) => e);
    expect(e?.message).toBe("Transcribing audio needs macOS 26 or later. Its transcript is as it was.");
  });

  test("a Word file is read again from its kept copy, so a better reader fixes what an older one got wrong (F181)", async () => {
    const lib = await tempLibrary();
    const item = await addSource(lib, join(FILES, "word-code.docx"));
    // What an older reader made of it: its code as a run of plain lines.
    writeFileSync(item.docPath, readFileSync(item.docPath, "utf8").replace("```\ndef learn():\n    return 42\n```", "def learn(): return 42"));
    const h = addHighlight(findItem(lib, item.meta.id), { exact: "START OFFICE: retrieval improves memory.", intent: "keep" });
    const r = await reimportSource(lib, item.meta.id);
    expect(r.changed).toBe(true);
    expect(r.item.body).toContain("```\ndef learn():\n    return 42\n```");
    expect(readAnnotations(r.item).map((a) => a.id)).toEqual([h.id]);
    expect((await reimportSource(lib, item.meta.id)).changed).toBe(false);
  });
});
