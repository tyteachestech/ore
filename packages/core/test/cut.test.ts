import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { addHighlight, anchorAnnotations, readAnnotations } from "../src/annotations.ts";
import { blocks, cutSpan, cutText, redoCut, restoreCut } from "../src/cut.ts";
import { sha256 } from "../src/fsutil.ts";
import { addText } from "../src/ingest/index.ts";
import { findItem, renameItem } from "../src/items.ts";
import { paths } from "../src/library.ts";
import { withLock } from "../src/lock.ts";
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

describe("cuts while the source changes", () => {
  const TEXT = "# Source\n\nAlpha paragraph.\n\nBeta paragraph.\n\nGamma paragraph that is long enough to remain beyond the old cut position.\n";

  test("a cut that waited for the library keeps the title a rename just saved (F605)", async () => {
    const lib = await tempLibrary();
    const item = await addText(lib, TEXT);
    const at = item.body.indexOf("Beta");
    let release!: () => void;
    const held = withLock(paths.lock(lib), () => new Promise<void>((r) => (release = r)));
    const rename = renameItem(lib, item.meta.id, "Renamed while cutting");
    const cut = cutText(lib, item.meta.id, at, at + 1);
    release();
    await Promise.all([held, rename, cut]);
    const now = findItem(lib, item.meta.id);
    expect(now.meta.title).toBe("Renamed while cutting");
    expect(now.body).not.toContain("Beta");
  });

  test("Undo of a cut after another cut above it puts the text back between whole paragraphs, never mid-word (F606)", async () => {
    const lib = await tempLibrary();
    const item = await addText(lib, TEXT);
    const beta = await cutText(lib, item.meta.id, item.body.indexOf("Beta"), item.body.indexOf("Beta") + 1);
    const mid = findItem(lib, item.meta.id).body;
    await cutText(lib, item.meta.id, mid.indexOf("Alpha"), mid.indexOf("Alpha") + 1);
    await restoreCut(lib, item.meta.id, beta.id);
    expect(findItem(lib, item.meta.id).body).toBe("# Source\n\nBeta paragraph.\n\nGamma paragraph that is long enough to remain beyond the old cut position.\n");
  });

  test("Redo after an Undo that found the text a new place takes it out again from there (F606)", async () => {
    const lib = await tempLibrary();
    const item = await addText(lib, TEXT);
    addHighlight(item, { exact: "Beta paragraph", intent: "keep" });
    const beta = await cutText(lib, item.meta.id, item.body.indexOf("Beta"), item.body.indexOf("Beta") + 1);
    const mid = findItem(lib, item.meta.id).body;
    await cutText(lib, item.meta.id, mid.indexOf("Alpha"), mid.indexOf("Alpha") + 1);
    const back = await restoreCut(lib, item.meta.id, beta.id);
    const record = JSON.parse(readFileSync(join(lib.root, ".ore", "cuts", item.meta.id, `${beta.id}.json`), "utf8"));
    expect(record.at).toBe(back.body.indexOf("Beta"));
    expect(record.removed.map((a: { start: number }) => a.start)).toEqual([back.body.indexOf("Beta")]);
    await redoCut(lib, item.meta.id, beta.id);
    expect(findItem(lib, item.meta.id).body).toBe("# Source\n\nGamma paragraph that is long enough to remain beyond the old cut position.\n");
  });
});

for (const move of [false, true]) test(`Undo restores a cut question's passage through Redo (moved: ${move})`, async () => {
  const lib = await tempLibrary();
  const item = await addText(lib, "# Recall\n\nAlpha practice strengthens recall.\n\nBeta spacing helps learning.\n\nGamma sleep consolidates memory.\n");
  const asked = addHighlight(item, { exact: "Beta spacing helps learning.", intent: "question", note: "Why?" });
  const after = addHighlight(item, { exact: "Gamma sleep consolidates memory.", intent: "question" });
  const cut = await cutText(lib, item.meta.id, asked.start, asked.start + 1);
  if (move) {
    const body = findItem(lib, item.meta.id).body;
    await cutText(lib, item.meta.id, body.indexOf("Alpha"), body.indexOf("Alpha") + 1);
  }
  for (let n = 0; n < 2; n++) {
    const back = await restoreCut(lib, item.meta.id, cut.id);
    for (const was of [asked, after]) {
      const now = readAnnotations(back).find((a) => a.id === was.id)!;
      expect(now.exact).toBe(was.exact);
      expect(now.start).toBe(back.body.indexOf(was.exact));
      expect(back.body.slice(now.start, now.end)).toBe(was.exact);
      expect(now.note).toBe(was.note);
    }
    if (!n) await redoCut(lib, item.meta.id, cut.id);
  }
});

test("an older cut receipt without retained questions restores their quote", async () => {
  const lib = await tempLibrary();
  const item = await addText(lib, "# Recall\n\nBeta spacing helps learning.\n\nGamma sleep consolidates memory.\n");
  const a = addHighlight(item, { exact: "Beta spacing helps learning.", intent: "question" });
  const cut = await cutText(lib, item.meta.id, a.start, a.start + 1);
  const { retained: _, ...old } = cut;
  writeFileSync(join(lib.root, ".ore", "cuts", item.meta.id, `${cut.id}.json`), JSON.stringify(old));
  const back = await restoreCut(lib, item.meta.id, cut.id);
  expect(readAnnotations(back)[0]).toMatchObject({ exact: a.exact, start: a.start, end: a.end });
});
