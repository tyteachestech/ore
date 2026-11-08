import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { openIndex } from "../src/db.ts";
import { doctor } from "../src/doctor.ts";
import { addSnippet } from "../src/ingest/index.ts";
import { backlinks, brokenLinks, linkUrl, parseLinks } from "../src/links.ts";
import { appendNote, attachToNote, getNotes, setNotes, skillNotesPath } from "../src/notes.ts";
import { tempLibrary } from "./helpers.ts";

async function setup() {
  const lib = await tempLibrary();
  const a = (await addSnippet(lib, { text: "Spacing beats massing for long-term retention." })).item.meta;
  const b = (await addSnippet(lib, { text: "Self-explanation prompts help novices most." })).item.meta;
  return { lib, a, b };
}

describe("parseLinks (D39)", () => {
  test("finds item and skill links with their text; ignores other links", () => {
    const t = "See [Make It Stick](ore:item/01ABC) and [Learning](ore:skill/learning), not [web](https://x.y) or [[raw]].";
    expect(parseLinks(t).map((l) => [l.text, l.target.kind, l.target.id])).toEqual([
      ["Make It Stick", "item", "01ABC"],
      ["Learning", "skill", "learning"],
    ]);
    expect(linkUrl({ kind: "skill", id: "ai" })).toBe("ore:skill/ai");
  });
});

describe("skill notes (D41)", () => {
  test("get/set/append in skills/<id>/notes.md; unknown skill fails", async () => {
    const { lib } = await setup();
    expect(getNotes(lib, { skill: "learning" })).toEqual({ skill: "learning", text: "", path: "skills/learning/notes.md", dir: join(lib.root, "skills/learning") });
    const r = await appendNote(lib, { skill: "learning" }, "Retrieval beats rereading.", "Recall");
    expect(r.text).toBe("## Recall\n\nRetrieval beats rereading.");
    expect(readFileSync(skillNotesPath(lib, "learning"), "utf8")).toBe(r.text);
    await setNotes(lib, { skill: "learning" }, "# Learning\n");
    expect(getNotes(lib, { skill: "learning" }).text).toBe("# Learning\n");
    expect(() => getNotes(lib, { skill: "nope" })).toThrow('unknown skill "nope"');
  });

  test("skill notes are searchable", async () => {
    const { lib } = await setup();
    await setNotes(lib, { skill: "teaching" }, "Worked examples before problem solving.");
    const index = openIndex(lib);
    try {
      expect(index.search("worked examples").map((h) => [h.kind, h.ref, h.title])).toEqual([["skill-notes", "teaching", "Notes: Teaching"]]);
    } finally {
      index.close();
    }
  });
});

describe("backlinks (D39)", () => {
  test("lists the linking note, the heading above the link and its line as text", async () => {
    const { lib, a, b } = await setup();
    await setNotes(lib, b.id, `Intro.\n\n## Why it works\n\n- Like [spacing](${linkUrl({ kind: "item", id: a.id })}), it adds effort.\n`);
    await setNotes(lib, { skill: "learning" }, `[Spacing source](ore:item/${a.id}) is the core of my plan.\n`);
    await setNotes(lib, a.id, `Self link [here](ore:item/${a.id}) is not a backlink.\n`);
    expect(backlinks(lib, { kind: "item", id: a.id })).toEqual([
      { from: { kind: "item", id: b.id, title: b.title }, heading: "Why it works", line: "Like spacing, it adds effort." },
      { from: { kind: "skill", id: "learning", title: "Learning" }, heading: null, line: "Spacing source is the core of my plan." },
    ]);
    expect(backlinks(lib, { kind: "skill", id: "learning" })).toEqual([]);
  });

  test("a fenced code block holds no headings or links", async () => {
    const { lib, a, b } = await setup();
    const code = "```md\n# not a heading\n[in code](ore:item/" + a.id + ")\n[gone](ore:skill/old)\n```";
    await setNotes(lib, b.id, `## Setup\n\n${code}\n\nThen [spacing](ore:item/${a.id}).\n`);
    expect(backlinks(lib, { kind: "item", id: a.id })).toEqual([{ from: { kind: "item", id: b.id, title: b.title }, heading: "Setup", line: "Then spacing." }]);
    expect(brokenLinks(lib)).toEqual([]);
  });

  test("doctor reports links that no longer resolve", async () => {
    const { lib, a } = await setup();
    await setNotes(lib, a.id, "[Gone](ore:item/01ZZZZZZZZZZZZZZZZZZZZZZZZ) and [Old skill](ore:skill/old) and [Fine](ore:skill/ai)");
    expect(brokenLinks(lib).map((l) => l.text)).toEqual(["Gone", "Old skill"]);
    const report = await doctor(lib);
    expect(report.issues.filter((i) => i.message.startsWith("link ")).map((i) => i.message)).toEqual([
      'link "Gone" points to a missing source (01ZZZZZZZZZZZZZZZZZZZZZZZZ)',
      'link "Old skill" points to a missing skill (old)',
    ]);
  });
});

describe("attachToNote (D38 images)", () => {
  test("copies into images/ beside the note with a unique slug name; text unchanged", async () => {
    const { lib, a } = await setup();
    const png = join(lib.root, "My Diagram.PNG");
    writeFileSync(png, "fake");
    const one = await attachToNote(lib, a.id, png);
    const two = await attachToNote(lib, a.id, png);
    expect([one.attached, two.attached]).toEqual(["images/my-diagram.png", "images/my-diagram-2.png"]);
    expect(one.text).toBe("");
    const s = await attachToNote(lib, { skill: "ai" }, png);
    expect(existsSync(join(lib.root, "skills/ai", s.attached))).toBe(true);
    writeFileSync(join(lib.root, "x.txt"), "no");
    expect(attachToNote(lib, a.id, join(lib.root, "x.txt"))).rejects.toThrow("attach an image");
  });

  test("a pasted image (bytes, no name) is saved as pasted.png, then pasted-2.png", async () => {
    const { lib, a } = await setup();
    const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const one = await attachToNote(lib, a.id, { ext: "png", data });
    const two = await attachToNote(lib, a.id, { ext: ".PNG", data });
    expect([one.attached, two.attached]).toEqual(["images/pasted.png", "images/pasted-2.png"]);
    expect(readFileSync(join(lib.root, dirname(one.path), one.attached))).toEqual(Buffer.from(data));
    expect(attachToNote(lib, a.id, { ext: "exe", data })).rejects.toThrow("attach an image");
    expect(attachToNote(lib, a.id, { ext: "png", data: new Uint8Array() })).rejects.toThrow("empty");
  });
});
