import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { doctor } from "../src/doctor.ts";
import { cardStates, findCard, readCardFile, writeNewCard } from "../src/cards.ts";
import { openIndex, rebuildIndex } from "../src/db.ts";
import { addSnippet } from "../src/ingest/index.ts";
import { setItemStatus } from "../src/items.ts";
import { readReviews } from "../src/reviews.ts";
import { endSession, readSessions, reopenSession, startSession } from "../src/sessions.ts";
import { paths } from "../src/library.ts";
import { setReviewSettings } from "../src/skills.ts";
import { dueQueue, libraryStats, recordReview, undoReview } from "../src/study.ts";
import { tempLibrary } from "./helpers.ts";

async function setup() {
  const lib = await tempLibrary();
  const { item } = await addSnippet(lib, { text: "Retrieval practice strengthens memory more than restudy." });
  const mk = (q: string, skills: string[], topics: string[]) =>
    writeNewCard(lib, { kind: "card", item: item.meta.id, skills, topics, content_type: "fact", question: q, answer: "A", rubric: [] });
  return { lib, item, a: mk("What beats restudy?", ["learning"], ["retrieval"]), b: mk("Habit cue?", ["habits"], ["habits"]) };
}

describe("review loop", () => {
  test("reads of the review log within one process see every new review, an undo and a hand edit", async () => {
    // readReviews keeps its last parse while the log files are unchanged (one command reads them several times).
    const { lib, a, b } = await setup();
    const now = new Date(Date.now() + 864e5);
    expect(readReviews(lib)).toEqual([]);
    const r = await recordReview(lib, a.meta.id, { rating: 3, confidence: 2, now });
    expect(readReviews(lib).map((x) => x.card)).toEqual([a.meta.id]);
    const mine = readReviews(lib);
    mine.pop();
    expect(readReviews(lib)).toHaveLength(1);
    await recordReview(lib, b.meta.id, { rating: 2, confidence: 2, now });
    expect(readReviews(lib).map((x) => x.card)).toEqual([a.meta.id, b.meta.id]);
    await undoReview(lib, a.meta.id, r.ts);
    expect(readReviews(lib).map((x) => x.card)).toEqual([b.meta.id]);
    const log = readdirSync(paths.reviews(lib)).find((f) => f.endsWith(".jsonl"))!;
    writeFileSync(join(paths.reviews(lib), log), "");
    expect(readReviews(lib)).toEqual([]);
  });

  test("draft → finishing review → live; log replays into the index; due respects schedule", async () => {
    const { lib, a, b } = await setup();
    const now = new Date(Date.now() + 864e5); // drafts wait a day (D65)
    expect(dueQueue(lib, now).map((e) => e.id).sort()).toEqual([a.meta.id, b.meta.id].sort());

    const r = await recordReview(lib, a.meta.id, { rating: 3, confidence: 2, answer: 'it\'s "retrieval" $(x)', now });
    expect(r.finishing).toBe(true);
    expect(readCardFile(a.path).meta.state).toBe("draft"); // the card file is not rewritten; the log says it is live
    expect(cardStates(lib)(readCardFile(a.path))).toBe("live");
    expect(Date.parse(r.due_next)).toBeGreaterThan(now.getTime());
    expect(readReviews(lib)[0]!.answer).toBe('it\'s "retrieval" $(x)');

    const idx = openIndex(lib);
    const row = idx.cards().find((c) => c.id === a.meta.id)!;
    expect(row.fsrs).toEqual(r.state_after);
    expect(row.state).toBe("live");
    expect(row.retention).toBe(0.92); // learning is P1
    idx.close();

    expect(dueQueue(lib, now).map((e) => e.id)).toEqual([b.meta.id]);
    expect(dueQueue(lib, new Date(Date.parse(r.due_next) + 1000)).map((e) => e.id)).toContain(a.meta.id);
  });

  test("undoing a rating drops only the latest review, and a first review puts the card back to draft", async () => {
    const { lib, a, b } = await setup();
    const now = new Date(Date.now() + 864e5);
    const first = await recordReview(lib, a.meta.id, { rating: 3, confidence: 2, now });
    const other = await recordReview(lib, b.meta.id, { rating: 3, confidence: 2, now: new Date(now.getTime() + 1000) });
    await expect(undoReview(lib, a.meta.id, "2000-01-01T00:00:00.000Z")).rejects.toThrow();
    await undoReview(lib, a.meta.id, first.ts);
    expect(readReviews(lib).map((r) => r.ts)).toEqual([other.ts]);
    expect(readCardFile(a.path).meta.state).toBe("draft");
    expect(dueQueue(lib, now).map((e) => e.id)).toContain(a.meta.id);
    const again = await recordReview(lib, a.meta.id, { rating: 1, confidence: 1, now });
    expect(again.finishing).toBe(true);
    expect(again.state_after.reps).toBe(1);
  });

  test("⌘Z takes back a run of ratings newest first: a relearn pass, then its miss, then another card", async () => {
    const { lib, a, b } = await setup();
    const t0 = Date.now() + 864e5;
    const at = (s: number) => new Date(t0 + s * 1000);
    startSession(lib);
    const rb = await recordReview(lib, b.meta.id, { rating: 3, confidence: 2, now: at(0) });
    const miss = await recordReview(lib, a.meta.id, { rating: 1, confidence: 3, now: at(1) });
    const pass = await recordReview(lib, a.meta.id, { rating: 3, confidence: 2, now: at(2) });
    // Only the card's latest review can go: the miss is not, while the pass stands.
    await expect(undoReview(lib, a.meta.id, miss.ts, at(3))).rejects.toThrow();
    await undoReview(lib, a.meta.id, pass.ts, at(3));
    expect(dueQueue(lib, at(3)).find((e) => e.id === a.meta.id)?.relearn).toBe(true); // the pass is owed again
    await undoReview(lib, a.meta.id, miss.ts, at(4));
    await undoReview(lib, b.meta.id, rb.ts, at(5));
    expect(readReviews(lib)).toEqual([]);
    expect(dueQueue(lib, at(5)).map((e) => e.id).sort()).toEqual([a.meta.id, b.meta.id].sort());
    const redo = await recordReview(lib, a.meta.id, { rating: 3, confidence: 2, now: at(6) });
    expect(redo).toMatchObject({ finishing: true, state_after: { reps: 1, lapses: 0 } });
  });

  test("two devices: each appends to its own month log, an undo is appended, conflicted copies count once", async () => {
    const { lib, a, b } = await setup();
    const now = new Date(Date.now() + 864e5);
    const was = process.env.ORE_DEVICE;
    try {
      process.env.ORE_DEVICE = "Tys Mac";
      const onMac = await recordReview(lib, a.meta.id, { rating: 3, confidence: 2, now });
      process.env.ORE_DEVICE = "iphone";
      const onPhone = await recordReview(lib, b.meta.id, { rating: 3, confidence: 2, now: new Date(now.getTime() + 1000) });
      const month = now.toISOString().slice(0, 7);
      const dir = join(lib.root, "reviews");
      expect(readdirSync(dir).sort()).toEqual([`${month}.iphone.jsonl`, `${month}.tys-mac.jsonl`]);
      const macLog = readFileSync(join(dir, `${month}.tys-mac.jsonl`), "utf8");
      // A synced folder's conflicted copy of a log, and a log from before device files: read, not double counted.
      writeFileSync(join(dir, `${month}.tys-mac 2.jsonl`), macLog);
      writeFileSync(join(dir, `${month}.jsonl`), macLog);
      expect(readReviews(lib).map((r) => r.ts)).toEqual([onMac.ts, onPhone.ts]);

      await undoReview(lib, b.meta.id, onPhone.ts, new Date(now.getTime() + 2000)); // same month as the reviews, even on the last day of one
      expect(readFileSync(join(dir, `${month}.iphone.jsonl`), "utf8").trim().split("\n")).toHaveLength(2); // appended, never rewritten
      expect(readReviews(lib).map((r) => r.card)).toEqual([a.meta.id]);
      const idx = openIndex(lib);
      expect(Object.fromEntries(idx.cards().map((c) => [c.id, c.state]))).toEqual({ [a.meta.id]: "live", [b.meta.id]: "draft" });
      idx.close();
      expect((await doctor(lib)).errors).toBe(0);
    } finally {
      if (was === undefined) delete process.env.ORE_DEVICE;
      else process.env.ORE_DEVICE = was;
    }
  });

  test("a rating taken back on the end screen reopens its session; the next end's receipt replaces the first", async () => {
    const { lib, a, b } = await setup();
    const s = startSession(lib);
    await recordReview(lib, a.meta.id, { rating: 3, confidence: 2 });
    const second = await recordReview(lib, b.meta.id, { rating: 3, confidence: 2 });
    expect(endSession(lib, new Date(Date.now() + 1000)).reviews).toBe(2);
    expect(() => reopenSession(lib, "nope")).toThrow(/no session/);
    await undoReview(lib, b.meta.id, second.ts);
    reopenSession(lib, s.id);
    await Bun.sleep(5); // an undo names its review by time; the next one is never in the same millisecond
    const again = await recordReview(lib, b.meta.id, { rating: 4, confidence: 3 });
    expect(again.session).toBe(s.id);
    endSession(lib, new Date(Date.now() + 2000));
    const ends = readSessions(lib).filter((r) => r.type === "end" && r.id === s.id);
    expect(ends).toHaveLength(1);
    expect(ends[0]!.reviews).toBe(2);
  });

  test("a miss in an open session queues one relearn pass, accepted twice in one session", async () => {
    const { lib, a } = await setup();
    const s = startSession(lib);
    const miss = await recordReview(lib, a.meta.id, { rating: 1, confidence: 3 });
    expect(miss.session).toBe(s.id);
    const q = dueQueue(lib);
    expect(q.at(-1)).toMatchObject({ id: a.meta.id, relearn: true });
    await recordReview(lib, a.meta.id, { rating: 3, confidence: 2 });
    expect(dueQueue(lib).some((e) => e.id === a.meta.id)).toBe(false);
    expect(endSession(lib).reviews).toBe(2);
  });

  test("unseen drafts from the most recently finished source come first", async () => {
    const { lib, item, a, b } = await setup();
    const { item: other } = await addSnippet(lib, { text: "Other source." });
    const c = writeNewCard(lib, { kind: "card", item: other.meta.id, skills: ["ai"], topics: ["agents"], content_type: "fact", question: "Q?", answer: "A", rubric: [] });
    await setReviewSettings(lib, { new_per_day: 2 });
    await setItemStatus(lib, item.meta.id, "done");
    const q = dueQueue(lib, new Date(Date.now() + 864e5)).map((e) => e.id);
    expect(q.sort()).toEqual([a.meta.id, b.meta.id].sort());
    expect(q).not.toContain(c.meta.id);
  });

  test("stats per skill; search covers docs, annotations and cards; direct edits re-sync", async () => {
    const { lib, item, a } = await setup();
    await recordReview(lib, a.meta.id, { rating: 3, confidence: 2 });
    await setItemStatus(lib, item.meta.id, "done");
    const st = libraryStats(lib);
    const learning = st.skills.find((s) => s.skill === "learning")!;
    expect(learning).toMatchObject({ cards_live: 1, items_live: 1, reviews: 1, retention: null, retention_n: 0 });
    expect(st.total.reviews).toBe(1);

    const idx = openIndex(lib);
    expect(idx.search("restudy").map((h) => h.kind).sort()).toEqual(["annotation", "card", "item"]);
    // A card made from a highlight names it, so ⌘K can land there; one that wasn't names nothing.
    const ann = idx.search("restudy").find((h) => h.kind === "annotation")!.ref;
    const fromHl = writeNewCard(lib, { kind: "card", item: item.meta.id, skills: ["learning"], topics: [], content_type: "fact", question: "Zebra quagga?", answer: "A", rubric: [], annotation: ann });
    idx.close();
    const idx1 = openIndex(lib);
    expect(idx1.search("quagga")).toMatchObject([{ kind: "card", ref: fromHl.meta.id, annotation: ann }]);
    expect(idx1.search("Habit cue")[0]!.annotation).toBeUndefined();
    idx1.close();

    writeFileSync(a.path, readFileSync(a.path, "utf8").replace("What beats restudy?", "Which practice beats rereading?"));
    expect(findCard(lib, a.meta.id).question).toBe("Which practice beats rereading?");
    const idx2 = openIndex(lib);
    expect(idx2.search("rereading").some((h) => h.ref === a.meta.id)).toBe(true);
    idx2.close();
  });

  test("the index replays only changed cards and always matches a full rebuild", async () => {
    const { lib, a, b } = await setup();
    const now = new Date(Date.now() + 864e5);
    const states = () => {
      const idx = openIndex(lib);
      const out = idx.cards().map((c) => ({ id: c.id, retention: c.retention, fsrs: c.fsrs })).sort((x, y) => x.id.localeCompare(y.id));
      idx.close();
      return out;
    };
    const rebuilt = () => {
      rebuildIndex(lib);
      return states();
    };
    await recordReview(lib, a.meta.id, { rating: 3, confidence: 2, now });
    expect(states()).toEqual(rebuilt());
    const second = await recordReview(lib, b.meta.id, { rating: 1, confidence: 1, now: new Date(now.getTime() + 1000) });
    expect(states()).toEqual(rebuilt());
    await undoReview(lib, b.meta.id, second.ts);
    expect(states()).toEqual(rebuilt());
    // A priority change moves retention (D25), so every card under that skill is replayed.
    const before = states().find((c) => c.id === a.meta.id)!;
    writeFileSync(paths.skills(lib), readFileSync(paths.skills(lib), "utf8").replace(/(id: learning[\s\S]*?priority: )P1/, "$1P3"));
    const after = states().find((c) => c.id === a.meta.id)!;
    expect(after.retention).not.toBe(before.retention);
    expect(states()).toEqual(rebuilt());
  });
});
