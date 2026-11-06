import { describe, expect, test } from "bun:test";
import { addHighlight, anchorAnnotations, readAnnotations } from "../src/annotations.ts";
import { blocks, cutSpan, cutText, redoCut, restoreCut } from "../src/cut.ts";
import { sha256 } from "../src/fsutil.ts";
import { addText } from "../src/ingest/index.ts";
import { findItem } from "../src/items.ts";
import { tempLibrary } from "./helpers.ts";

// Removing junk from a source's text (a site's table of contents, a footer): whole blocks go, highlights
// after the cut shift exactly, highlights inside it go with it, and Undo puts it all back.

const BODY = [
  "# Spacing",
  "",
  "## Contents",
  "",
  "- Intro",
  "- Why it works",
  "",
  "## Why it works",
  "",
  "Spaced practice beats massed practice.",
  "It holds for years.",
  "",
  "```",
  "code one",
  "",
  "code two",
  "```",
  "",
  "Sleep consolidates memory.",
  "",
  "## Share this",
  "",
  "Tweet · Facebook",
  "",
].join("\n");

describe("blocks", () => {
  test("paragraphs, headings, one block per list item, a fence with blank lines as one", () => {
    const parts = blocks(BODY).map((b) => BODY.slice(b.start, b.end).trim());
    expect(parts).toEqual(["# Spacing", "## Contents", "- Intro", "- Why it works", "## Why it works", "Spaced practice beats massed practice.\nIt holds for years.", "```\ncode one\n\ncode two\n```", "Sleep consolidates memory.", "## Share this", "Tweet · Facebook"]);
  });

  test("a selection inside a paragraph takes the whole paragraph and its blank line", () => {
    const at = BODY.indexOf("massed");
    const s = cutSpan(BODY, at, at + 6);
    expect(BODY.slice(s.start, s.end)).toBe("Spaced practice beats massed practice.\nIt holds for years.\n\n");
  });

  test("a section runs to the next heading of the same level; at the end it takes the blank lines before", () => {
    const toc = cutSpan(BODY, BODY.indexOf("Contents"), BODY.indexOf("Contents") + 2, true);
    expect(BODY.slice(toc.start, toc.end)).toBe("## Contents\n\n- Intro\n- Why it works\n\n");
    const share = cutSpan(BODY, BODY.indexOf("Share"), BODY.indexOf("Share"), true);
    const left = BODY.slice(0, share.start) + BODY.slice(share.end);
    expect(left.endsWith("Sleep consolidates memory.\n")).toBe(true);
  });
});

describe("cutText", () => {
  test("highlights after the cut shift exactly, inside it are removed, questions stay; restore puts all back", async () => {
    const lib = await tempLibrary();
    const item = await addText(lib, BODY);
    const before = findItem(lib, item.meta.id).body;
    const inToc = addHighlight(item, { exact: "Why it works", intent: "keep", start: before.indexOf("- Why") });
    const asked = addHighlight(item, { exact: "Intro", intent: "question" });
    const after = addHighlight(item, { exact: "Sleep consolidates memory.", intent: "card" });

    const cut = await cutText(lib, item.meta.id, before.indexOf("Contents"), before.indexOf("Contents") + 1, { section: true });
    expect(cut.section).toBe(true);
    expect(cut.removed.map((a) => a.id)).toEqual([inToc.id]);
    let now = findItem(lib, item.meta.id);
    expect(now.body).not.toContain("## Contents");
    expect(now.meta.text_sha256).toBe(sha256(now.body));
    const moved = readAnnotations(now).find((a) => a.id === after.id)!;
    expect(now.body.slice(moved.start, moved.end)).toBe("Sleep consolidates memory.");
    expect(anchorAnnotations(now).find((a) => a.id === after.id)!.anchor!.method).toBe("position");
    expect(readAnnotations(now).some((a) => a.id === asked.id)).toBe(true);

    await restoreCut(lib, item.meta.id, cut.id);
    now = findItem(lib, item.meta.id);
    expect(now.body).toBe(before);
    for (const a of anchorAnnotations(now).filter((a) => a.id !== asked.id)) expect(a.anchor?.method).toBe("position");
    expect(readAnnotations(now).map((a) => a.id).sort()).toEqual([inToc.id, asked.id, after.id].sort());
    expect(restoreCut(lib, item.meta.id, cut.id)).rejects.toThrow("already back");

    const again = await redoCut(lib, item.meta.id, cut.id);
    expect(again.removed.map((a) => a.id)).toEqual([inToc.id]);
    now = findItem(lib, item.meta.id);
    expect(now.body).not.toContain("## Contents");
    const back = readAnnotations(now).find((a) => a.id === after.id)!;
    expect(now.body.slice(back.start, back.end)).toBe("Sleep consolidates memory.");
  });

  test("the video transcript part of a page can't be cut", async () => {
    const lib = await tempLibrary();
    const body = "## Video transcript\n\n[00:00] hello there\n\n<!-- end of video transcript -->\n\nPage text.\n\nFooter.\n";
    const item = await addText(lib, body);
    const b = findItem(lib, item.meta.id).body;
    expect(cutText(lib, item.meta.id, b.indexOf("hello"), b.indexOf("hello") + 2)).rejects.toThrow("transcript");
    const c = await cutText(lib, item.meta.id, b.indexOf("Footer"), b.indexOf("Footer") + 2);
    expect(findItem(lib, item.meta.id).body.endsWith("Page text.\n")).toBe(true);
    await restoreCut(lib, item.meta.id, c.id);
    await redoCut(lib, item.meta.id, c.id);
    expect(findItem(lib, item.meta.id).body.endsWith("Page text.\n")).toBe(true);
  });
});
