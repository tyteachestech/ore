import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { appendJsonl, deviceLog, readJsonl, visible, writeAtomic } from "./fsutil.ts";
import { nowIso, ulid } from "./ids.ts";
import { paths, type Library } from "./library.ts";
import { readReviews } from "./reviews.ts";
import { findCard } from "./cards.ts";
import { loadParams, retrievability } from "./scheduler.ts";
import { desiredRetention, loadSkills } from "./skills.ts";
import { SOLID_DAYS } from "./today.ts";

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
  /** Nothing was left to review when the session ended, so the day's goal counts as met (D60). */
  caught_up?: boolean;
}

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
export function reopenSession(lib: Library, id: string): void {
  const open = openSessionId(lib);
  if (open && open !== id) throw new Error(`session ${open} is open; end it first`);
  if (!readSessions(lib).some((r) => r.type === "start" && r.id === id)) throw new Error(`no session ${id}`);
  writeAtomic(paths.openSession(lib), id);
}

// The open session id lives in .ore/session; reviews attach to it.
export function openSessionId(lib: Library): string | null {
  const p = paths.openSession(lib);
  return existsSync(p) ? readFileSync(p, "utf8").trim() || null : null;
}

export function startSession(lib: Library, now = new Date()): SessionReceipt {
  const r: SessionReceipt = { type: "start", id: ulid(now.getTime()), ts: nowIso(now) };
  appendJsonl(deviceLog(paths.sessionLog(lib, now)), r);
  writeAtomic(paths.openSession(lib), r.id);
  return r;
}

/** The first session end with reviews this week (Monday on, local time): where calibration shows, at most weekly (D69). */
export function firstEndThisWeek(lib: Library, now = new Date()): boolean {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return readSessions(lib).filter((s) => s.type === "end" && (s.reviews ?? 0) > 0 && Date.parse(s.ts) >= monday.getTime() && Date.parse(s.ts) <= now.getTime()).length === 1;
}

export function endSession(lib: Library, now = new Date(), caughtUp = false): SessionReceipt {
  const id = openSessionId(lib);
  if (!id) throw new Error("no open session (ore session start)");
  const own = readReviews(lib).filter((x) => x.session === id);
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
  const cut = [...first.values()]
    .filter((x) => x.state_before.stability < SOLID_DAYS && last.get(x.card)!.state_after.stability >= SOLID_DAYS)
    .map((x) => {
      try {
        return findCard(lib, x.card).meta.skills[0] ?? "";
      } catch {
        return "";
      }
    });
  const r: SessionReceipt = { type: "end", id, ts: nowIso(now), reviews: own.length, kept: kept.length, rescued: rescued.length, cut, ...(caughtUp ? { caught_up: true } : {}) };
  appendJsonl(deviceLog(paths.sessionLog(lib, now)), r);
  unlinkSync(paths.openSession(lib));
  return r;
}
