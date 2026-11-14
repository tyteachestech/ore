import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { appendJsonl, deviceLog, readJsonl, visible, writeAtomic } from "./fsutil.ts";
import { localDay, nowIso, ulid } from "./ids.ts";
import { paths, type Library } from "./library.ts";
import { withLock } from "./lock.ts";
import { readReviews } from "./reviews.ts";
import { findCard } from "./cards.ts";
import { loadParams, retrievability } from "./scheduler.ts";
import { desiredRetention, loadSkills, reviewSettings } from "./skills.ts";
import { ACTIVE_CAP_MS } from "./study.ts";
import { gemGrade, type GemGrade } from "./today.ts";

export interface SessionReceipt {
  type: "start" | "end";
  id: string;
  ts: string;
  reviews?: number;
  /** End receipts (D62): cards he passed this session, and those passed after fading well below their
   *  own target (see `rescuedAt`). */
  kept?: number;
  rescued?: number;
  /** Cards that became solid memories this session (stability reached 21 days, D90), as each card's
   *  first skill, so the end screen can show one cut gem in that skill's colour. */
  cut?: string[];
  /** Per `cut` gem, its grade (D197): mended when it had been solid before and was missed since, polished when
   *  he has passed it as a remix. Absent when every one is a plain cut. */
  grades?: GemGrade[];
  /** Gems that were solid already and were polished this session (their first passed remix), as each one's first skill (D197). */
  polished?: string[];
  /** How much longer the cards he passed this session now last than before it, in whole days added up
   *  (FSRS stability); a miss takes nothing off it (D197). */
  depth_days?: number;
  /** The part of `depth_days` from exercises he answered after today's goal had closed (D246): the end
   *  screen says how much of the session was extra. Absent when none was. */
  depth_extra_days?: number;
  /** The memories kept this session by each card's first skill, most first: the end screen names them one
   *  skill at a time. Absent when none was kept. */
  kept_skills?: { skill: string; n: number }[];
  /** The longest gap, in whole days, between a card he passed this session and when he last saw it (D177):
   *  the end screen names it, so spacing's delayed gain is something he sees. */
  longest_days?: number;
  /** Nothing was left to review when the session ended, so the day's goal counts as met (D60). */
  caught_up?: boolean;
  /** Then and now (D248), at most once every four weeks: an exercise he missed or guessed three weeks
   *  or more ago and passed in this session, with what he typed then and what he typed now. */
  then_now?: { card: string; question: string; then_ts: string; then: string; now: string };
}

/** Then and now shows at most once in this many days, and looks this far back for the earlier answer (D248). */
export const THEN_NOW_EVERY_DAYS = 28;
export const THEN_NOW_BACK_DAYS = 21;

export const RESCUE_BELOW = 0.85;
/** A card is rescued when its recall chance had fallen under 85% and at least 5 points under the
 *  retention its skill aims for. Without the second part, every on-time P3 review (aimed at 0.80, D22)
 *  would count as a rescue. */
export const rescuedAt = (target: number) => Math.min(RESCUE_BELOW, target - 0.05);

export function readSessions(lib: Library): SessionReceipt[] {
  const dir = paths.sessions(lib);
  if (!existsSync(dir)) return [];
  // Every device's month logs (`2026-10.<device>.jsonl`); a receipt read twice (a conflicted copy) counts once.
  const all = visible(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .flatMap((f) => readJsonl<SessionReceipt>(join(dir, f)))
    .filter((s) => typeof s.ts === "string" && typeof s.id === "string");
  // A receipt read twice (a conflicted copy, same time) counts once, the first copy read; a session
  // reopened by an undo on its end screen ends again, and its later end receipt counts.
  const latest = new Map<string, SessionReceipt>();
  for (const r of all) {
    const k = `${r.type} ${r.id}`;
    const had = latest.get(k);
    if (!had || r.ts > had.ts) latest.set(k, r);
  }
  return [...latest.values()].sort((a, b) => a.ts.localeCompare(b.ts));
}

/** Opens an ended session again, so a rating taken back on the end screen (⌘Z) returns him to that
 *  session's cards; its next end writes a new receipt that replaces the first. */
export function reopenSession(lib: Library, id: string): Promise<void> {
  return withLock(paths.lock(lib), () => {
    if (!readSessions(lib).some((r) => r.type === "start" && r.id === id)) throw new Error(`no session ${id}`);
    // Another window's session open meanwhile (the quick quiz) stays the default; the app names its own.
    if (!openSessionId(lib)) writeAtomic(paths.openSession(lib), id);
  });
}

// The last session started lives in .ore/session: a review given no session attaches to it. Two windows
// can each have one open (the main window and the quick quiz, D76), so the app names its own by id.
export function openSessionId(lib: Library): string | null {
  const p = paths.openSession(lib);
  return existsSync(p) ? readFileSync(p, "utf8").trim() || null : null;
}

// Starting, ending and reopening read and write .ore/session under the library lock, so one window's
// end never removes the pointer another window's start has just written.
export function startSession(lib: Library, now = new Date()): Promise<SessionReceipt> {
  return withLock(paths.lock(lib), () => {
    const r: SessionReceipt = { type: "start", id: ulid(now.getTime()), ts: nowIso(now) };
    appendJsonl(deviceLog(paths.sessionLog(lib, now)), r);
    writeAtomic(paths.openSession(lib), r.id);
    return r;
  });
}

/** The first session end with reviews this week (Monday on, local time): where calibration shows, at most weekly (D69). */
export function firstEndThisWeek(lib: Library, now = new Date()): boolean {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return readSessions(lib).filter((s) => s.type === "end" && (s.reviews ?? 0) > 0 && Date.parse(s.ts) >= monday.getTime() && Date.parse(s.ts) <= now.getTime()).length === 1;
}

/** The most one exercise adds to a session's depth (D246). Uncapped, one Good on an old exercise outweighed
 *  twenty young ones and an Easy paid more than a Good, so the sum followed the library's age and how
 *  generous his ratings were. Capped, it follows how many memories the session made stronger. */
export const DEPTH_CAP_DAYS = 30;

/** Ends session `id` (the open one by default); the open file goes only when it names this session. */
export function endSession(lib: Library, now = new Date(), caughtUp = false, which?: string): Promise<SessionReceipt> {
  return withLock(paths.lock(lib), () => receipt(lib, now, caughtUp, which ?? openSessionId(lib)));
}

function receipt(lib: Library, now: Date, caughtUp: boolean, id: string | null): SessionReceipt {
  if (!id) throw new Error("no open session (ore session start)");
  if (!readSessions(lib).some((r) => r.type === "start" && r.id === id)) throw new Error(`no session ${id}`);
  const all = readReviews(lib);
  const own = all.filter((x) => x.session === id);
  // A card counts once, by its first answer this session; a relearn pass doesn't make it kept.
  const first = new Map([...own].reverse().map((x) => [x.card, x]));
  const w = loadParams(lib);
  const kept = [...first.values()].filter((x) => x.rating > 1);
  const skills = loadSkills(lib).skills;
  const target = (card: string) => {
    try {
      return desiredRetention(findCard(lib, card).meta.skills, skills);
    } catch {
      return 0.9; // a card file gone since: the default target
    }
  };
  const rescued = kept.filter((x) => x.state_before.reps > 0 && retrievability(x.state_before, new Date(x.ts), 0.9, w) < rescuedAt(target(x.card)));
  // Solid before its first answer this session, or not; solid after its last one.
  const last = new Map(own.map((x) => [x.card, x]));
  const skillOf = (card: string) => {
    try {
      return findCard(lib, card).meta.skills[0] ?? "";
    } catch {
      return "";
    }
  };
  // Each card's gem before this session and after it, by one rule (`gemGrade`): a card gets one gem here,
  // when it became solid or when a solid one was polished.
  const start = own[0]?.ts ?? "";
  const changed = [...first.keys()].map((card) => {
    const before = all.filter((x) => x.card === card && x.session !== id && x.ts < start);
    return { card, before: gemGrade(before), after: gemGrade([...before, ...own.filter((x) => x.card === card)]) };
  });
  const cutNow = changed.filter((c) => c.after && !c.before);
  const cut = cutNow.map((c) => skillOf(c.card));
  const grades = cutNow.map((c) => c.after!);
  const polished = changed.filter((c) => c.before && c.before !== "polished" && c.after === "polished").map((c) => skillOf(c.card));
  const gain = (x: (typeof kept)[number]) => Math.min(DEPTH_CAP_DAYS, Math.max(0, last.get(x.card)!.state_after.stability - x.state_before.stability));
  const depth = Math.round(kept.reduce((n, x) => n + gain(x), 0));
  // Past the goal (D246): answered once the day's active time had already reached it. An off day has no goal.
  const settings = reviewSettings(lib);
  const day = own[0] ? localDay(own[0].ts) : "";
  const off = settings.weekdays_only && [0, 6].includes(new Date(`${day}T12:00:00`).getDay());
  const pastGoal = new Set<string>();
  let active = 0;
  for (const x of all) {
    if (localDay(x.ts) !== day) continue;
    if (!off && active >= settings.goal_minutes * 60_000) pastGoal.add(x.ts + x.card);
    active += Math.min(x.elapsed_ms ?? 0, ACTIVE_CAP_MS);
  }
  const extra = Math.round(kept.filter((x) => pastGoal.has(x.ts + x.card)).reduce((n, x) => n + gain(x), 0));
  // Then and now (D248): the oldest typed answer he missed or guessed, on an exercise he typed and passed today.
  // Once shown, not again for four weeks, so it marks the month and never becomes a thing to chase.
  const at = now.getTime();
  const shown = readSessions(lib).some((r) => r.type === "end" && r.id !== id && r.then_now && at - Date.parse(r.ts) < THEN_NOW_EVERY_DAYS * 864e5);
  let thenNow: SessionReceipt["then_now"];
  if (!shown) {
    for (const x of kept) {
      if (!x.answer?.trim()) continue;
      const was = all.find((r) => r.card === x.card && r.session !== id && !!r.answer?.trim() && (r.rating === 1 || r.confidence === 1) && at - Date.parse(r.ts) >= THEN_NOW_BACK_DAYS * 864e5);
      if (!was || (thenNow && was.ts >= thenNow.then_ts)) continue;
      try {
        thenNow = { card: x.card, question: findCard(lib, x.card).question, then_ts: was.ts, then: was.answer!.trim(), now: x.answer.trim() };
      } catch {
        // its file is gone since: nothing to show the answers against
      }
    }
  }
  const gaps = kept.flatMap((x) => (x.state_before.reps > 0 && x.state_before.last_review ? [Math.floor((Date.parse(x.ts) - Date.parse(x.state_before.last_review)) / 864e5)] : []));
  const longest = Math.max(0, ...gaps);
  const bySkill = new Map<string, number>();
  for (const x of kept) bySkill.set(skillOf(x.card), (bySkill.get(skillOf(x.card)) ?? 0) + 1);
  const keptSkills = [...bySkill].map(([skill, n]) => ({ skill, n })).sort((x, y) => y.n - x.n);
  const r: SessionReceipt = { type: "end", id, ts: nowIso(now), ...(thenNow ? { then_now: thenNow } : {}), reviews: own.length, kept: kept.length, rescued: rescued.length, cut, ...(grades.some((g) => g !== "cut") ? { grades } : {}), ...(polished.length ? { polished } : {}), ...(depth > 0 ? { depth_days: depth } : {}), ...(extra > 0 ? { depth_extra_days: extra } : {}), ...(longest > 0 ? { longest_days: longest } : {}), ...(keptSkills.length ? { kept_skills: keptSkills } : {}), ...(caughtUp ? { caught_up: true } : {}) };
  appendJsonl(deviceLog(paths.sessionLog(lib, now)), r);
  if (openSessionId(lib) === id) unlinkSync(paths.openSession(lib));
  return r;
}
