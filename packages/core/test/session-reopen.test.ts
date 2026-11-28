import { expect, test } from "bun:test";
import { rmSync } from "node:fs";
import { writeCardMeta, writeNewCard } from "../src/cards.ts";
import { doctor } from "../src/doctor.ts";
import { addText } from "../src/ingest/index.ts";
import { localDay } from "../src/ids.ts";
import { paths } from "../src/library.ts";
import { endSession, readSessions, reopenSession, startSession } from "../src/sessions.ts";
import { recordReview, undoReview } from "../src/study.ts";
import { today } from "../src/today.ts";
import { tempLibrary } from "./helpers.ts";

test("reopening a caught-up session removes its historical goal credit even without the local pointer", async () => {
  const lib = await tempLibrary();
  const at = new Date();
  const before = new Date(at.getTime() - 864e5);
  const item = await addText(lib, "# Lesson\n\nSpacing helps recall.\n");
  const cards = ["What helps?", "Why space?"].map((question) => {
    const c = writeNewCard(lib, { kind: "card", item: item.meta.id, skills: [], topics: [], content_type: "fact", question, answer: "Recall", rubric: [] });
    writeCardMeta(c, { ...c.meta, created: before.toISOString() });
    return c;
  });
  const session = await startSession(lib, at);
  await recordReview(lib, cards[0]!.meta.id, { rating: 3, confidence: 2, elapsed_ms: 1000, now: at });
  const review = await recordReview(lib, cards[1]!.meta.id, { rating: 3, confidence: 2, elapsed_ms: 1000, now: at });
  await endSession(lib, at, true, session.id);
  await undoReview(lib, cards[1]!.meta.id, review.ts);
  await reopenSession(lib, session.id);
  expect(readSessions(lib).filter((s) => s.type === "end")).toEqual([]);
  expect(today(lib, at).met).toBe(false);
  // A restart or the other device cannot rely on this Mac's unsynced open-session pointer.
  rmSync(paths.openSession(lib));
  const later = today(lib, new Date(at.getTime() + 864e5));
  expect(later.days_met).toBe(0);
  const day = later.week.find((d) => d.date === localDay(at));
  if (day) expect(day.status).toBe("short"); // reviewed, no longer met (D362)
  expect((await doctor(lib)).issues).toEqual([]);
  // A fast end/reopen/end under one clock tick still leaves only the newest ending effective.
  await endSession(lib, at, true, session.id);
  expect(readSessions(lib).filter((s) => s.type === "end")).toHaveLength(1);
  await reopenSession(lib, session.id);
  expect(readSessions(lib).filter((s) => s.type === "end")).toEqual([]);
  await endSession(lib, at, false, session.id);
  expect(readSessions(lib).filter((s) => s.type === "end")).toHaveLength(1);
  expect(today(lib, new Date(at.getTime() + 864e5)).days_met).toBe(0);
});
