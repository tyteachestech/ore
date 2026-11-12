import { describe, expect, test } from "bun:test";
import { strToU8, zipSync } from "fflate";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { addSnippet, addSource, addText } from "../src/ingest/index.ts";
import { vttToBody, vttWords, youtubeId } from "../src/ingest/youtube.ts";
import { findItem, listItems, sourceFile } from "../src/items.ts";
import { readAnnotations } from "../src/annotations.ts";
import { sha256 } from "../src/fsutil.ts";
import { tempLibrary } from "./helpers.ts";

const ROLLING_VTT = `WEBVTT
Kind: captions
Language: en

00:00:00.320 --> 00:00:02.000 align:start position:0%
 
Welcome<00:00:00.500><c> to</c><00:00:00.800><c> the</c><00:00:01.000><c> talk</c>

00:00:02.000 --> 00:00:02.010 align:start position:0%
Welcome to the talk
 

00:00:02.010 --> 00:00:05.000 align:start position:0%
Welcome to the talk
about spaced repetition.

00:00:40.000 --> 00:00:43.000 align:start position:0%
about spaced repetition.
Next idea &amp; more.
`;

describe("ingest", () => {
  test("VTT rolling captions → de-duplicated paragraphs with [mm:ss]", () => {
    expect(vttToBody(ROLLING_VTT)).toBe("[00:00] Welcome to the talk about spaced repetition.\n\n[00:40] Next idea & more.\n");
  });

  test("VTT → word times in body order: inline times for auto-captions, spread over the cue otherwise", () => {
    const words = vttWords(ROLLING_VTT);
    expect(words.map((w) => w.w).join(" ")).toBe("Welcome to the talk about spaced repetition. Next idea & more.");
    expect(words.slice(0, 4).map((w) => w.t)).toEqual([0.32, 0.5, 0.8, 1]);
    // "about spaced repetition." has no inline times: spread over 2.01–5.00 by characters.
    expect(words[4]!.t).toBe(2.01);
    expect(words[5]!.t).toBeGreaterThan(2.01);
    expect(words[6]!.t).toBeLessThan(5);
    expect(words[7]!.t).toBe(40);
    for (let i = 1; i < words.length; i++) expect(words[i]!.t).toBeGreaterThanOrEqual(words[i - 1]!.t);
    // The body is built from the same lines, so its words (minus [mm:ss]) line up one to one.
    const body = vttToBody(ROLLING_VTT).replace(/\[\d+:\d{2}\]/g, "").split(/\s+/).filter(Boolean);
    expect(body).toEqual(words.map((w) => w.w));
  });

  test("youtubeId reads watch, youtu.be, shorts and live URLs", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtu.be/dQw4w9WgXcQ?si=x")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeId("https://example.com/watch")).toBeNull();
  });

  test("markdown file → item in inbox with frontmatter and source copy", async () => {
    const lib = await tempLibrary();
    const path = join(lib.root, "inbox", "note.md");
    writeFileSync(path, "# My Note\n\nSome text worth keeping.\n");
    const item = await addSource(lib, path);
    expect(item.meta.title).toBe("My Note");
    expect(item.meta.status).toBe("inbox");
    expect(item.meta.text_sha256).toBe(sha256(item.body));
    expect(item.dir).toMatch(/items\/\d{4}\/my-note-[0-9A-Z]{26}$/);
    expect(readFileSync(join(item.dir, "source.md"), "utf8")).toContain("Some text");
    expect(existsSync(path)).toBe(false); // moved out of inbox/
    expect(findItem(lib, item.meta.id.slice(-6)).meta.id).toBe(item.meta.id);
  });

  test("epub file → chapters in spine order as Markdown with chapter markers", async () => {
    const lib = await tempLibrary();
    const xhtml = (body: string) => `<?xml version="1.0" encoding="utf-8"?>\n<html xmlns="http://www.w3.org/1999/xhtml"><head><title>t</title></head><body>${body}</body></html>`;
    const epub = zipSync({
      mimetype: strToU8("application/epub+zip"),
      "META-INF/container.xml": strToU8(`<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`),
      "OEBPS/content.opf": strToU8(`<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Make It Stick</dc:title><dc:creator>Peter C. Brown</dc:creator></metadata>
<manifest><item id="c2" href="text/ch2.xhtml" media-type="application/xhtml+xml"/><item id="c1" href="text/ch1.xhtml" media-type="application/xhtml+xml"/><item id="blank" href="text/blank.xhtml" media-type="application/xhtml+xml"/><item id="cover" href="images/cover.jpg" media-type="image/jpeg"/></manifest>
<spine><itemref idref="cover"/><itemref idref="c1"/><itemref idref="blank"/><itemref idref="c2"/></spine></package>`),
      "OEBPS/text/ch1.xhtml": strToU8(xhtml(`<h1>Learning Is Misunderstood</h1><a id="p1"/><p>Retrieval is <em>effortful</em> and <strong>durable</strong>.</p><h2>Tips</h2><ul><li>Space it</li><li>Mix it</li></ul><img src="../images/fig.png" alt="figure"/><p>See <a href="ch2.xhtml#x">chapter two</a>.</p>`)),
      "OEBPS/text/blank.xhtml": strToU8(xhtml(`<div><img src="../images/cover.jpg"/></div>`)),
      "OEBPS/text/ch2.xhtml": strToU8(xhtml(`<h1>To Learn, Retrieve</h1><p>Quizzing beats rereading.</p>`)),
      "OEBPS/images/cover.jpg": new Uint8Array([1, 2, 3]),
    });
    const path = join(lib.root, "book.epub");
    writeFileSync(path, epub);
    const item = await addSource(lib, path);
    expect(item.meta.type).toBe("epub");
    expect(item.meta.title).toBe("Make It Stick");
    expect(item.meta.author).toBe("Peter C. Brown");
    expect(item.body).toBe(
      "<!-- chapter 1 -->\n\n# Learning Is Misunderstood\n\nRetrieval is *effortful* and **durable**.\n\n## Tips\n\n-   Space it\n-   Mix it\n\nSee chapter two.\n\n" +
        "<!-- chapter 2 -->\n\n# To Learn, Retrieve\n\nQuizzing beats rereading.\n",
    );
    expect(readFileSync(join(item.dir, "source.epub"))).toEqual(Buffer.from(epub));
    expect(sourceFile(item)).toBe(join(item.dir, "source.epub"));
  });

  test("snippet → item + one annotation covering the body", async () => {
    const lib = await tempLibrary();
    const { item, annotation } = await addSnippet(lib, { text: "Interleaving helps discrimination.", app: "Safari", url: "https://x.y", intent: "card", note: "use in talk" });
    expect(item.meta.type).toBe("snippet");
    expect(item.meta.source_app).toBe("Safari");
    expect(existsSync(join(item.dir, "source.md"))).toBe(false);
    expect(readAnnotations(findItem(lib, item.meta.id))).toEqual([annotation]);
    expect(annotation.intent).toBe("card");
  });

  test("pasted text → Markdown source titled by its heading or first line, filed under a skill", async () => {
    const lib = await tempLibrary();
    const a = await addText(lib, "\n# Story spine\n\nOnce upon a time…\n", { skills: ["writing"] });
    expect(a.meta.type).toBe("markdown");
    expect(a.meta.title).toBe("Story spine");
    expect(a.meta.skills).toEqual(["writing"]);
    expect(readFileSync(join(a.dir, "source.md"), "utf8")).toBe("# Story spine\n\nOnce upon a time…\n");
    const b = await addText(lib, "x".repeat(100) + "\nmore");
    expect(b.meta.title).toBe("x".repeat(77) + "…");
    expect(addText(lib, "  \n ")).rejects.toThrow("text is empty");
  });

  test("the same text pasted again is the source already here, filed under the new skill too", async () => {
    const lib = await tempLibrary();
    const a = await addText(lib, "# Pasted twice\n\nThe very same paragraph, pasted again.");
    const b = await addText(lib, "# Pasted twice\n\nThe very same paragraph, pasted again.\n", { skills: ["learning"] }); // a starter skill
    expect(b.meta.id).toBe(a.meta.id);
    expect(b).toMatchObject({ kept: true, filed: ["learning"] });
    expect(listItems(lib).length).toBe(1);
    expect(findItem(lib, a.meta.id).meta.skills).toEqual(["learning"]);
  });

  test("the same text with Windows line ends is the same source, pasted or as a file", async () => {
    const lib = await tempLibrary();
    const a = await addText(lib, "# Line ends\n\nThe same words, whatever ends the lines.\n");
    expect((await addText(lib, "# Line ends\r\n\r\nThe same words, whatever ends the lines.\r\n")).meta.id).toBe(a.meta.id);
    const file = join(lib.root, "line-ends.md");
    writeFileSync(file, "# Line ends\r\n\r\nThe same words, whatever ends the lines.\r\n");
    expect((await addSource(lib, file)).meta.id).toBe(a.meta.id);
    expect(listItems(lib).length).toBe(1);
  });
});

describe("tracking links", () => {
  test("a link's tracking tags are dropped, so the page added again with them is the source already here", async () => {
    const lib = await tempLibrary();
    const real = globalThis.fetch;
    globalThis.fetch = (async () => new Response("# Brief history\n\nComputers changed fast.\n", { headers: { "content-type": "text/markdown" } })) as unknown as typeof fetch;
    try {
      const a = await addSource(lib, "https://example.com/history?utm_source=chatgpt.com&id=7&fbclid=x#part");
      expect(a.meta.url).toBe("https://example.com/history?id=7#part");
      const b = await addSource(lib, "https://example.com/history?id=7&utm_medium=social#part", { skills: ["ai"] });
      expect(b).toMatchObject({ kept: true, filed: ["ai"] });
      expect(listItems(lib).length).toBe(1);
      // The rest of the link is kept as written, and the same link typed another way is the same source.
      const c = await addSource(lib, "https://Example.com/other?q=a%20b&utm_source=x");
      expect(c.meta.url).toBe("https://example.com/other?q=a%20b");
      expect((await addSource(lib, "https://example.com:443/other?q=a%20b")).meta.id).toBe(c.meta.id);
    } finally {
      globalThis.fetch = real;
    }
  });
});
