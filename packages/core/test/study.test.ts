import { describe, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { doctor } from "../src/doctor.ts";
import { cardStates, findCard, readCardFile, writeNewCard } from "../src/cards.ts";
import { openIndex, rebuildIndex } from "../src/db.ts";
import { addSnippet } from "../src/ingest/index.ts";
import { setItemStatus } from "../src/items.ts";
import { readReviews } from "../src/reviews.ts";
import { endSession, openSessionId, readSessions, reopenSession, startSession } from "../src/sessions.ts";
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
    await startSession(lib);
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

  test("ratings of one exercise in the same millisecond all count, on one device or two offline, and a copy still counts once (F560)", async () => {
    const { lib, a, b } = await setup();
    const now = new Date(Date.now() + 864e5);
    const was = process.env.ORE_DEVICE;
    try {
      const dir = join(lib.root, "reviews");
      const month = now.toISOString().slice(0, 7);
      // One device: rated, taken back and rated again within one millisecond, the new rating stands.
      process.env.ORE_DEVICE = "mac";
      const first = await recordReview(lib, a.meta.id, { rating: 1, confidence: 1, now });
      await undoReview(lib, a.meta.id, first.ts, now);
      const again = await recordReview(lib, a.meta.id, { rating: 3, confidence: 3, now });
      expect(readReviews(lib).map((r) => r.rating)).toEqual([3]);
      // Rated again in that millisecond: both count, and what came back is what the log replays to.
      const third = await recordReview(lib, a.meta.id, { rating: 3, confidence: 3, now });
      expect(readReviews(lib).filter((r) => r.card === a.meta.id)).toHaveLength(2);
      let idx = openIndex(lib);
      expect(idx.cards().find((c) => c.id === a.meta.id)?.fsrs).toEqual(third.state_after);
      idx.close();
      expect(again.ts < third.ts).toBe(true);
      // Two devices offline, each rating b in the same millisecond without the other's log: both count.
      await recordReview(lib, b.meta.id, { rating: 1, confidence: 1, now, answer: "On the Mac" });
      const macLog = join(dir, `${month}.mac.jsonl`);
      const held = readFileSync(macLog, "utf8");
      rmSync(macLog);
      process.env.ORE_DEVICE = "iphone";
      await recordReview(lib, b.meta.id, { rating: 3, confidence: 3, now, answer: "On the phone" });
      writeFileSync(macLog, held);
      expect(readReviews(lib).filter((r) => r.card === b.meta.id).map((r) => r.rating).sort()).toEqual([1, 3]);
      // A synced folder's copy of a log still counts once.
      writeFileSync(join(dir, `${month}.mac 2.jsonl`), held);
      expect(readReviews(lib).filter((r) => r.card === b.meta.id)).toHaveLength(2);
      idx = openIndex(lib);
      expect(idx.cards().find((c) => c.id === b.meta.id)?.fsrs?.reps).toBe(2);
      idx.close();
    } finally {
      if (was === undefined) delete process.env.ORE_DEVICE;
      else process.env.ORE_DEVICE = was;
    }
  });

  test("a rating taken back on the end screen reopens its session; the next end's receipt replaces the first", async () => {
    const { lib, a, b } = await setup();
    const s = await startSession(lib);
    await recordReview(lib, a.meta.id, { rating: 3, confidence: 2 });
    const second = await recordReview(lib, b.meta.id, { rating: 3, confidence: 2 });
    expect((await endSession(lib, new Date(Date.now() + 1000))).reviews).toBe(2);
    await expect(reopenSession(lib, "nope")).rejects.toThrow(/no session/);
    await undoReview(lib, b.meta.id, second.ts);
    await reopenSession(lib, s.id);
    await Bun.sleep(5); // an undo names its review by time; the next one is never in the same millisecond
    const again = await recordReview(lib, b.meta.id, { rating: 4, confidence: 3 });
    expect(again.session).toBe(s.id);
    await endSession(lib, new Date(Date.now() + 2000));
    const ends = readSessions(lib).filter((r) => r.type === "end" && r.id === s.id);
    expect(ends).toHaveLength(1);
    expect(ends[0]!.reviews).toBe(2);
  });

  test("a miss in an open session queues one relearn pass, accepted twice in one session", async () => {
    const { lib, a } = await setup();
    const s = await startSession(lib);
    const miss = await recordReview(lib, a.meta.id, { rating: 1, confidence: 3 });
    expect(miss.session).toBe(s.id);
    const q = dueQueue(lib);
    expect(q.at(-1)).toMatchObject({ id: a.meta.id, relearn: true });
    await recordReview(lib, a.meta.id, { rating: 3, confidence: 2 });
    expect(dueQueue(lib).some((e) => e.id === a.meta.id)).toBe(false);
    expect((await endSession(lib)).reviews).toBe(2);
  });

  test("the end receipt keeps the longest gap he recalled across, in days (D177)", async () => {
    const { lib, a, b } = await setup();
    const t0 = Date.now() + 864e5;
    const day = (d: number) => new Date(t0 + d * 864e5);
    await recordReview(lib, a.meta.id, { rating: 3, confidence: 2, now: day(0) });
    await recordReview(lib, b.meta.id, { rating: 3, confidence: 2, now: day(20) });
    await startSession(lib, day(30));
    await recordReview(lib, a.meta.id, { rating: 3, confidence: 2, now: day(30) }); // 30 days since he last saw it
    await recordReview(lib, b.meta.id, { rating: 1, confidence: 2, now: day(30) }); // a miss is no recall
    expect((await endSession(lib, day(30))).longest_days).toBe(30);
    // A session of first answers only has no gap to name.
    const { lib: lib2, a: c } = await setup();
    await startSession(lib2, day(0));
    await recordReview(lib2, c.meta.id, { rating: 3, confidence: 2, now: day(0) });
    expect((await endSession(lib2, day(0))).longest_days).toBeUndefined();
  });

  test("a miss keeps its relearn pass when the session ends right after it (the goal closed, or Esc then ⌘R)", async () => {
    const { lib, a, b } = await setup();
    const t0 = Date.now() + 864e5;
    const at = (s: number) => new Date(t0 + s * 1000);
    await startSession(lib, at(0));
    await recordReview(lib, a.meta.id, { rating: 1, confidence: 3, now: at(1) });
    await endSession(lib, at(2));
    expect(dueQueue(lib, at(3)).find((e) => e.id === a.meta.id)?.relearn).toBe(true); // no session open
    await startSession(lib, at(4));
    expect(dueQueue(lib, at(5)).at(-1)).toMatchObject({ id: a.meta.id, relearn: true }); // the next session owes it
    await recordReview(lib, a.meta.id, { rating: 3, confidence: 2, now: at(6) });
    expect(dueQueue(lib, at(7)).some((e) => e.id === a.meta.id)).toBe(false); // once only
    // A miss on its relearn pass waits for its FSRS date, and yesterday's miss is not today's to relearn.
    await recordReview(lib, b.meta.id, { rating: 1, confidence: 3, now: at(8) });
    await recordReview(lib, b.meta.id, { rating: 1, confidence: 3, now: at(9) });
    expect(dueQueue(lib, at(10)).some((e) => e.id === b.meta.id)).toBe(false);
    const { lib: lib2, a: c } = await setup();
    await recordReview(lib2, c.meta.id, { rating: 1, confidence: 3, now: at(0) });
    const tomorrow = new Date(t0 + 864e5);
    expect(dueQueue(lib2, tomorrow).find((e) => e.id === c.meta.id)?.relearn ?? false).toBe(false);
  });

  test("a miss just before midnight keeps its relearn pass in a session that runs past it, once", async () => {
    const { lib, a } = await setup();
    const midnight = new Date(Date.now() + 2 * 864e5);
    midnight.setHours(0, 0, 0, 0);
    const at = (min: number) => new Date(midnight.getTime() + min * 60_000);
    await startSession(lib, at(-10));
    await recordReview(lib, a.meta.id, { rating: 1, confidence: 3, now: at(-5) });
    expect(dueQueue(lib, at(5)).find((e) => e.id === a.meta.id)?.relearn).toBe(true);
    await recordReview(lib, a.meta.id, { rating: 1, confidence: 3, now: at(6) }); // missed again on its pass
    expect(dueQueue(lib, at(7)).find((e) => e.id === a.meta.id)?.relearn ?? false).toBe(false);
  });

  test("two windows' sessions overlap: each logs and ends its own, by id", async () => {
    const { lib, a, b } = await setup();
    const main = await startSession(lib);
    await recordReview(lib, a.meta.id, { rating: 3, confidence: 2, session: main.id });
    const quiz = await startSession(lib); // the quick quiz shows while the main window reviews
    await recordReview(lib, b.meta.id, { rating: 3, confidence: 2, session: quiz.id });
    expect(await endSession(lib, new Date(Date.now() + 1000), false, quiz.id)).toMatchObject({ id: quiz.id, reviews: 1 });
    await Bun.sleep(5);
    const next = await recordReview(lib, b.meta.id, { rating: 1, confidence: 2, session: main.id });
    expect(next.session).toBe(main.id);
    expect(await endSession(lib, new Date(Date.now() + 2000), false, main.id)).toMatchObject({ id: main.id, reviews: 2 });
    await expect(endSession(lib, new Date(), false, "nope")).rejects.toThrow(/no session/);
    // Ending one session by id leaves another one's open file alone.
    const open = await startSession(lib);
    await endSession(lib, new Date(Date.now() + 3000), false, main.id);
    expect(openSessionId(lib)).toBe(open.id);
    // Reopening a session (⌘Z on its end screen) while another window's is open doesn't fail.
    await reopenSession(lib, main.id); // no throw
    expect(openSessionId(lib)).toBe(open.id);
  });

  test("a miss rated after a review dated a year ahead (a wrong clock) is saved with the state the log replays to, and doctor names that review (Codex sweep 4)", async () => {
    const { lib, a } = await setup();
    const now = new Date();
    await recordReview(lib, a.meta.id, { rating: 3, confidence: 2, now: new Date(now.getTime() + 365 * 864e5) });
    const miss = await recordReview(lib, a.meta.id, { rating: 1, confidence: 1, now });
    const idx = openIndex(lib);
    const rebuilt = idx.cards().find((c) => c.id === a.meta.id)?.fsrs;
    idx.close();
    expect(rebuilt?.lapses).toBe(miss.state_after.lapses);
    expect(rebuilt?.due).toBe(miss.state_after.due);
    expect(rebuilt?.stability).toBe(miss.state_after.stability);
    // The review from the wrong clock is named, with the way out.
    expect((await doctor(lib)).issues.some((i) => i.message.includes("ahead of today (a clock was wrong)"))).toBe(true);
  });

  test("a review on another device dated later than now (its clock ahead) doesn't block rating the card", async () => {
    const { lib, a } = await setup();
    const now = new Date(Date.now() + 864e5);
    const was = process.env.ORE_DEVICE;
    try {
      process.env.ORE_DEVICE = "iphone";
      const ahead = await recordReview(lib, a.meta.id, { rating: 3, confidence: 2, now: new Date(now.getTime() + 20 * 3600e3) });
      process.env.ORE_DEVICE = "mac";
      const r = await recordReview(lib, a.meta.id, { rating: 3, confidence: 2, now });
      // Logged when he rated it, never at the other clock's time (which can be tomorrow, for the day's goal).
      expect(r.ts).toBe(now.toISOString());
      expect(r.state_after.reps).toBe(2);
      // ⌘Z right after takes back the rating he just gave, though the phone's is dated later.
      await undoReview(lib, a.meta.id, r.ts, new Date(now.getTime() + 1000));
      expect(readReviews(lib).map((x) => x.ts)).toEqual([ahead.ts]);
      // Read back in time order, the log still replays: the index has the card, from both reviews.
      const again = await recordReview(lib, a.meta.id, { rating: 3, confidence: 2, now: new Date(now.getTime() + 2000) });
      const idx = openIndex(lib);
      expect(idx.cards().find((c) => c.id === a.meta.id)?.fsrs?.reps).toBe(2);
      idx.close();
      expect(again.ts < ahead.ts).toBe(true);
    } finally {
      if (was === undefined) delete process.env.ORE_DEVICE;
      else process.env.ORE_DEVICE = was;
    }
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

  test("search by source: every source that holds the words, each once with its best match, past the first 20 matches (F335)", async () => {
    const lib = await tempLibrary();
    // Each snippet is a source and its highlight: 50 matches from 25 sources.
    const ids: string[] = [];
    for (let i = 0; i < 25; i++) ids.push((await addSnippet(lib, { text: `Durability usually wins, says note ${i}.` })).item.meta.id);
    const idx = openIndex(lib);
    try {
      expect(idx.search("durability usually wins")).toHaveLength(20);
      const hits = idx.search("durability usually wins", 1000, true);
      expect(hits.map((h) => h.item).sort()).toEqual([...ids].sort());
      expect(hits.every((h) => h.snippet.includes("[Durability]"))).toBe(true);
      expect(idx.search("durability usually wins", 3, true).map((h) => h.item)).toEqual(hits.slice(0, 3).map((h) => h.item));
    } finally {
      idx.close();
    }
  });

  // F344 (review of #440): by source only the best 60 library-wide got a snippet, so a
  // filtered list, or one in its own order, showed matches with no line under them.
  test("search by source within the sources a list shows: only those, in its order, the first ones with their line", async () => {
    const lib = await tempLibrary();
    const ids: string[] = [];
    for (let i = 0; i < 70; i++) ids.push((await addSnippet(lib, { text: `Durability usually wins, says note ${i}.` })).item.meta.id);
    const idx = openIndex(lib);
    try {
      const best = idx.search("durability usually wins", Infinity, true).map((h) => h.item!);
      const shown = [...best].reverse(); // the list's own order: the library's worst matches first
      const hits = idx.search("durability usually wins", Infinity, true, shown);
      expect(hits.map((h) => h.item)).toEqual(shown);
      expect(hits.slice(0, 60).every((h) => h.snippet.includes("[Durability]"))).toBe(true);
      const some = [ids[3]!, ids[40]!];
      expect(idx.search("durability usually wins", Infinity, true, some).map((h) => [h.item, h.snippet.includes("[Durability]")])).toEqual(some.map((id) => [id, true]));
    } finally {
      idx.close();
    }
  });

  test("a first build of the index drops no rows; a changed file is still indexed once (F84)", async () => {
    // Each drop scans the whole search table, so on a fresh index (every launch on the phone) 2,800 files
    // spent 1.35 s of a 1.75 s first Today deleting rows that were not there.
    const { lib, a } = await setup();
    const run = Database.prototype.run;
    let drops = 0;
    Database.prototype.run = function (this: Database, sql: string, ...rest: never[]) {
      if (/^delete from fts where/.test(sql)) drops++;
      return (run as (...all: unknown[]) => unknown).call(this, sql, ...rest);
    } as typeof run;
    try {
      rebuildIndex(lib);
      openIndex(lib).close();
      expect(drops).toBe(0);
      writeFileSync(a.path, readFileSync(a.path, "utf8").replace("What beats restudy?", "Which practice beats rereading?"));
      const idx = openIndex(lib);
      expect(drops).toBeGreaterThan(0);
      expect(idx.search("rereading").filter((h) => h.ref === a.meta.id)).toHaveLength(1);
      expect(idx.search("restudy").filter((h) => h.ref === a.meta.id)).toHaveLength(0);
      idx.close();
    } finally {
      Database.prototype.run = run;
    }
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

describe("two sessions open at once (D76)", () => {
  test("starting and ending a quick quiz leaves the main session's relearn pass owed past midnight (F-new-quick-session-pointer)", async () => {
    const { lib, a } = await setup();
    const main = await startSession(lib, new Date(2026, 5, 1, 23, 58));
    await recordReview(lib, a.meta.id, { rating: 1, confidence: 1, session: main.id, now: new Date(2026, 5, 1, 23, 59) });
    const now = new Date(2026, 5, 2, 0, 1);
    const owed = () => dueQueue(lib, now).some((e) => e.id === a.meta.id && e.relearn);
    expect(owed()).toBe(true);
    const quick = await startSession(lib, now);
    expect(owed()).toBe(true);
    await endSession(lib, now, false, quick.id);
    expect(owed()).toBe(true);
    expect(openSessionId(lib)).toBe(main.id); // a review given no session goes to the main one again
  });
});
