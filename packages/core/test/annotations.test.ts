import { describe, expect, test } from "bun:test";
import { appendFileSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { openIndex } from "../src/db.ts";
import { doctor } from "../src/doctor.ts";
import { addHighlight, addPoint, anchorAnnotations, sentenceAt, annotationRevs, annotationsPath, findAnnotation, isQuestionOnly, moveHighlight, readAnnotations, reanchorItem, reviseAnnotation } from "../src/annotations.ts";
import { addSnippet } from "../src/ingest/index.ts";
import { listQuestions } from "../src/questions.ts";
import { findItem } from "../src/items.ts";
import { tempLibrary } from "./helpers.ts";

const TEXT =
  "Desirable difficulties make learning slower but more durable.\n\n" +
  "Retrieval practice strengthens memory more than restudy does.\n\n" +
  "Interleaving mixes problem types so learners must choose a strategy.";

describe("annotations", () => {
  test("highlight writes W3C-style selectors; annotate appends a rev", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: TEXT });
    const h = addHighlight(item, { exact: "Retrieval practice strengthens memory", intent: "card", note: "core" });
    expect(h.prefix.endsWith("durable.\n\n")).toBe(true);
    expect(h.suffix.startsWith(" more than restudy")).toBe(true);
    const { annotation } = findAnnotation(lib, h.id);
    const r2 = reviseAnnotation(item, annotation, { intent: "keep", note: "changed" });
    expect(r2.rev).toBe(2);
    const latest = readAnnotations(findItem(lib, item.meta.id)).find((a) => a.id === h.id)!;
    expect(latest).toMatchObject({ rev: 2, intent: "keep", note: "changed", exact: h.exact });
    expect(annotationRevs(item.dir)).toHaveLength(3); // snippet + 2 revs
  });

  test("re-anchoring after doc.md edits: moved, fuzzy, orphaned; hash updated", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: TEXT });
    const moved = addHighlight(item, { exact: "Retrieval practice strengthens memory", intent: "card" });
    const fuzzy = addHighlight(item, { exact: "Interleaving mixes problem types", intent: "card" });
    const gone = addHighlight(item, { exact: "Desirable difficulties make learning slower", intent: "keep" });

    const doc = readFileSync(item.docPath, "utf8")
      .replaceAll("Desirable difficulties make learning slower but more durable.", "A much longer new opening line replaced the first sentence entirely, and it shifts offsets.")
      .replace("Interleaving mixes problem types", "Interleaving mixes the problem types");
    writeFileSync(item.docPath, doc);

    const edited = findItem(lib, item.meta.id);
    const anchored = Object.fromEntries(anchorAnnotations(edited).map((a) => [a.id, a.anchor?.method ?? null]));
    expect(anchored[moved.id]).toBe("exact");
    expect(anchored[fuzzy.id]).toBe("fuzzy");
    expect(anchored[gone.id]).toBeNull();

    const report = await reanchorItem(lib, edited);
    expect(report.hashChanged).toBe(true);
    expect(report.moved.map((m) => m.id).sort()).toEqual([moved.id, fuzzy.id].sort());
    expect(report.orphaned).toContain(gone.id);

    const after = findItem(lib, item.meta.id);
    const methods = Object.fromEntries(anchorAnnotations(after).map((a) => [a.id, a.anchor?.method ?? null]));
    expect(methods[moved.id]).toBe("position");
    expect(methods[fuzzy.id]).toBe("position");
    expect(after.body.slice(...(() => { const a = readAnnotations(after).find((x) => x.id === fuzzy.id)!; return [a.start, a.end] as const; })())).toContain("the problem types");
    expect((await reanchorItem(lib, after)).hashChanged).toBe(false);
    // The orphan stays reported once the hash is current again (doctor --fix), not only while it differs.
    expect((await doctor(lib)).issues.filter((i) => i.message.includes(gone.id))).toHaveLength(1);
  });

  test("a deleted highlight is hidden from reads, anchoring, search and doctor", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: TEXT });
    const keep = addHighlight(item, { exact: "Retrieval practice strengthens memory", intent: "card" });
    const del = addHighlight(item, { exact: "Interleaving mixes problem types", intent: "keep", note: "zebrafish" });
    const r = reviseAnnotation(item, findAnnotation(lib, del.id).annotation, { status: "deleted" });
    expect(r).toMatchObject({ rev: 2, status: "deleted" });
    const ids = anchorAnnotations(findItem(lib, item.meta.id)).map((a) => a.id);
    expect(ids).toContain(keep.id);
    expect(ids).not.toContain(del.id);
    const index = openIndex(lib);
    expect(index.search("zebrafish")).toEqual([]);
    index.close();
    // body edit orphans the deleted quote: no warning for it
    writeFileSync(item.docPath, readFileSync(item.docPath, "utf8").replace("Interleaving mixes problem types", "Mixing"));
    const report = await doctor(lib);
    expect(report.issues.some((i) => i.message.includes(del.id))).toBe(false);
    expect(report.errors).toBe(0);
  });

  test("older Research highlights read as questions (D91)", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: TEXT, skills: ["learning"] });
    const h = addHighlight(item, { exact: "Interleaving mixes problem types", intent: "keep" });
    appendFileSync(annotationsPath(item.dir), JSON.stringify({ ...h, rev: 2, intent: "research", note: "look into this" }) + "\n");
    const latest = readAnnotations(findItem(lib, item.meta.id)).find((a) => a.id === h.id)!;
    expect(latest).toMatchObject({ rev: 2, intent: "question", note: "look into this" });
    expect(listQuestions(lib).map((q) => q.id)).toContain(h.id);
    expect((await doctor(lib)).errors).toBe(0);
  });
});

describe("questions (D47)", () => {
  test("lists Question highlights by skill, open before answered", async () => {
    const lib = await tempLibrary();
    const { item: a } = await addSnippet(lib, { text: TEXT, skills: ["learning"] });
    const { item: b } = await addSnippet(lib, { text: TEXT, skills: ["ai"] });
    const q1 = addHighlight(a, { exact: "Retrieval practice", intent: "question", note: "Why?" });
    const q2 = addHighlight(a, { exact: "Interleaving", intent: "question" });
    addHighlight(a, { exact: "Desirable difficulties", intent: "card" });
    const other = addHighlight(b, { exact: "Interleaving", intent: "question" });
    reviseAnnotation(a, q1, { status: "done" });

    const mine = listQuestions(lib, { skill: "learning" });
    expect(mine.map((q) => [q.id, q.status])).toEqual([[q2.id, "open"], [q1.id, "done"]]);
    expect(mine[1]).toMatchObject({ note: "Why?", item_title: a.meta.title });
    expect(listQuestions(lib).map((q) => q.id)).toContain(other.id);
  });

  test("a question-only snippet stays under Questions, out of the source lists", async () => {
    const lib = await tempLibrary();
    const q = await addSnippet(lib, { text: "Does spacing work for kids?", intent: "question" });
    const kept = await addSnippet(lib, { text: TEXT });
    expect(isQuestionOnly(findItem(lib, q.item.meta.id))).toBe(true);
    expect(isQuestionOnly(findItem(lib, kept.item.meta.id))).toBe(false);
    expect(listQuestions(lib).map((x) => x.id)).toContain(q.annotation.id);
  });

  test("a question snippet stays out of the source lists after its question is deleted", async () => {
    const lib = await tempLibrary();
    const q = await addSnippet(lib, { text: "Does spacing work for kids?", intent: "question" });
    reviseAnnotation(q.item, q.annotation, { status: "deleted" });
    expect(isQuestionOnly(findItem(lib, q.item.meta.id))).toBe(true);
  });

  test("highlighting an already highlighted passage gives back that highlight", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: TEXT });
    const h = addHighlight(item, { exact: "Retrieval practice strengthens memory", intent: "card", note: "core" });
    const again = addHighlight(findItem(lib, item.meta.id), { exact: "Retrieval practice strengthens memory", intent: "keep" });
    expect(again).toMatchObject({ id: h.id, intent: "card", note: "core" });
    const inside = addHighlight(findItem(lib, item.meta.id), { exact: "strengthens", intent: "keep" });
    expect(inside.id).not.toBe(h.id);
  });

  test("highlighting an already highlighted passage with a note keeps one highlight, now with that intent and note", async () => {
    // `ore highlight --intent apply --note "<plan>"` over a passage he already marked (the /ore skill, the CLI):
    // the plan must not vanish silently, and the passage never gets a second highlight (one highlight per idea).
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: TEXT });
    const h = addHighlight(item, { exact: "Retrieval practice strengthens memory", intent: "question" });
    const tried = addHighlight(findItem(lib, item.meta.id), { exact: "Retrieval practice strengthens memory", intent: "apply", note: "Open the next lesson with a quiz" });
    expect(tried).toMatchObject({ id: h.id, rev: 2, intent: "apply", note: "Open the next lesson with a quiz" });
    expect(readAnnotations(findItem(lib, item.meta.id)).filter((a) => a.id === h.id)).toHaveLength(1);
  });

  test("selecting past a highlight's edge grows that highlight instead of stacking a second", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: TEXT });
    const h = addHighlight(item, { exact: "practice strengthens", intent: "card", note: "core" });
    const end = addHighlight(findItem(lib, item.meta.id), { exact: "strengthens memory more", intent: "keep" });
    expect(end).toMatchObject({ id: h.id, rev: 2, intent: "card", note: "core", exact: "practice strengthens memory more" });
    const both = addHighlight(findItem(lib, item.meta.id), { exact: "Retrieval practice strengthens memory more than", intent: "keep" });
    expect(both).toMatchObject({ id: h.id, exact: "Retrieval practice strengthens memory more than" });
    expect(both.suffix.startsWith(" restudy")).toBe(true);
    // Over two highlights, it is a new one: neither note is merged away.
    addHighlight(findItem(lib, item.meta.id), { exact: "restudy does", intent: "keep" });
    const over = addHighlight(findItem(lib, item.meta.id), { exact: "than restudy", intent: "keep" });
    expect([h.id]).not.toContain(over.id);
    expect(readAnnotations(findItem(lib, item.meta.id)).filter((a) => a.exact.includes("restudy"))).toHaveLength(3);
  });

  test("moving a highlight's edges keeps its id, type and note, and re-anchors", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: TEXT });
    const h = addHighlight(item, { exact: "Retrieval practice strengthens memory", intent: "card", note: "core" });
    const moved = moveHighlight(findItem(lib, item.meta.id), h, "practice strengthens memory more than restudy", h.start);
    expect(moved).toMatchObject({ id: h.id, rev: 2, intent: "card", note: "core", start: h.start + "Retrieval ".length });
    expect(moved.prefix.endsWith("Retrieval ")).toBe(true);
    const fresh = findItem(lib, item.meta.id);
    expect(anchorAnnotations(fresh).find((a) => a.id === h.id)?.anchor?.method).toBe("position");
    expect(moveHighlight(fresh, moved, moved.exact, moved.start)).toBe(moved); // no change, no rev
    expect(() => moveHighlight(fresh, moved, "not in the text")).toThrow(/text not found/);
  });

  test("each device appends to its own highlight log; the latest rev wins across them", async () => {
    const lib = await tempLibrary();
    const was = process.env.ORE_DEVICE;
    try {
      process.env.ORE_DEVICE = "mac";
      const { item } = await addSnippet(lib, { text: TEXT });
      const h = addHighlight(item, { exact: "Retrieval practice strengthens memory", intent: "keep" });
      process.env.ORE_DEVICE = "iphone";
      reviseAnnotation(item, findAnnotation(lib, h.id).annotation, { note: "from the phone" });
      expect(readdirSync(item.dir).filter((f) => f.startsWith("annotations")).sort()).toEqual(["annotations.iphone.jsonl", "annotations.mac.jsonl"]);
      expect(readAnnotations(findItem(lib, item.meta.id)).find((a) => a.id === h.id)).toMatchObject({ rev: 2, note: "from the phone" });
      const idx = openIndex(lib);
      expect(idx.search("phone").map((x) => x.ref)).toEqual([h.id]);
      idx.close();
    } finally {
      if (was === undefined) delete process.env.ORE_DEVICE;
      else process.env.ORE_DEVICE = was;
    }
  });
});

describe("Card here: a card from a typed line", () => {
  const body = "[00:42] So why not talk to the database directly? The first reason is security. The API is a gate.\n\n[01:30] The second reason is that it's modular.";
  test("sentenceAt gives the sentence around an offset, without a transcript stamp", () => {
    const at = body.indexOf("first reason") + 3;
    expect(body.slice(...Object.values(sentenceAt(body, at)) as [number, number])).toBe("The first reason is security.");
    expect(body.slice(...Object.values(sentenceAt(body, 2)) as [number, number])).toBe("So why not talk to the database directly?");
    expect(body.slice(...Object.values(sentenceAt(body, body.length - 2)) as [number, number])).toBe("The second reason is that it's modular.");
  });

  test("addPoint anchors his line at the sentence where he was, marked point; it re-anchors like any highlight", async () => {
    const lib = await tempLibrary();
    const { item } = await addSnippet(lib, { text: TEXT });
    const p = addPoint(item, { at: TEXT.indexOf("restudy"), note: "  Why retrieval beats restudy  ", intent: "card" });
    expect(p).toMatchObject({ intent: "card", point: true, note: "Why retrieval beats restudy", exact: "Retrieval practice strengthens memory more than restudy does." });
    // a highlight on the same sentence is a separate thing, not merged into the point
    const h = addHighlight(findItem(lib, item.meta.id), { exact: "Retrieval practice strengthens memory more than restudy does.", intent: "keep" });
    expect(h.id).not.toBe(p.id);
    expect(anchorAnnotations(findItem(lib, item.meta.id)).find((a) => a.id === p.id)!.anchor).not.toBeNull();
    expect(() => addPoint(item, { at: 3, note: " ", intent: "card" })).toThrow(/needs the line/);
  });
});

