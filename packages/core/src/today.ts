import { dirname } from "node:path";
import { openIndex, withIndex, type CardRow, type LibraryIndex } from "./db.ts";
import { errorLine } from "./fsutil.ts";
import { readItemDir } from "./items.ts";
import type { Library } from "./library.ts";
import { readReviews, type Review } from "./reviews.ts";
import { readSessions } from "./sessions.ts";
import { loadSkills, reviewSettings } from "./skills.ts";
import { localDay } from "./ids.ts";
import { loadParams, nextState } from "./scheduler.ts";
import { activeMs as active, dueQueue, medians } from "./study.ts";

// Home's Today and Skills (D58, D60, D62): the daily goal, what is due, and skill strength.

export const SOLID_DAYS = 21; // a solid memory: a live card with FSRS stability of 21 days or more

const isWeekend = (day: string) => [0, 6].includes(new Date(`${day}T12:00:00`).getDay());

/** Level from solid memories: 5 for level 1, 20 for 2, 45 for 3, 80 for 4, … */
export const level = (solid: number) => Math.floor(Math.sqrt(solid / 5));
export const nextLevelAt = (solid: number) => 5 * (level(solid) + 1) ** 2;

/** A skill's strength (D62, D63). `solid`: live cards with stability of 21 days or more. `growing`:
 *  live, not solid yet. `ready`: growing cards that turn solid if he recalls them (Good) at their
 *  next review, the near goal beside the level (D90); `ready_today`: those due by the end of today. `new`: drafts not reviewed yet. `win_back`: once solid, now below.
 *  `level` comes from the most solid memories the skill ever had (`peak`), so it never drops.
 *  `explain`: his solid Explain cards, the latest to turn solid first. */
export interface Strength {
  solid: number;
  growing: number;
  ready: number;
  ready_today: number;
  new: number;
  win_back: number;
  peak: number;
  level: number;
  next_level_at: number;
  explain: { id: string; question: string }[];
}

export function strength(cards: CardRow[], reviews: Review[], skill: string, w?: number[], now = new Date()): Strength {
  const mine = cards.filter((c) => c.state !== "retired" && c.skills.includes(skill));
  const ids = new Set(mine.map((c) => c.id));
  const stab = new Map<string, number>();
  const solidAt = new Map<string, string>();
  const wasSolid = new Set<string>();
  let solidNow = 0;
  let peak = 0;
  for (const r of reviews) {
    if (!ids.has(r.card)) continue;
    const before = (stab.get(r.card) ?? 0) >= SOLID_DAYS;
    const after = r.state_after.stability >= SOLID_DAYS;
    stab.set(r.card, r.state_after.stability);
    if (after && !before) solidAt.set(r.card, r.ts);
    if (after) wasSolid.add(r.card);
    solidNow += Number(after) - Number(before);
    peak = Math.max(peak, solidNow);
  }
  const live = mine.filter((c) => c.state === "live");
  const isSolid = (c: CardRow) => (c.fsrs?.stability ?? 0) >= SOLID_DAYS;
  const solid = live.filter(isSolid);
  const top = Math.max(peak, solid.length);
  const ready = live.filter((c) => c.fsrs && !isSolid(c) && nextState(c.fsrs, new Date(c.fsrs.due), 3, c.retention, w).stability >= SOLID_DAYS);
  const tonight = new Date(now);
  tonight.setHours(24, 0, 0, 0);
  return {
    solid: solid.length,
    growing: live.length - solid.length,
    ready: ready.length,
    ready_today: ready.filter((c) => new Date(c.fsrs!.due) < tonight).length,
    new: mine.filter((c) => c.state === "draft").length,
    win_back: live.filter((c) => !isSolid(c) && wasSolid.has(c.id)).length,
    peak: top,
    level: level(top),
    next_level_at: nextLevelAt(top),
    explain: solid
      .filter((c) => c.kind === "prompt")
      .sort((a, b) => (solidAt.get(b.id) ?? "").localeCompare(solidAt.get(a.id) ?? ""))
      .map((c) => ({ id: c.id, question: c.question })),
  };
}

export type DayStatus = "met" | "open" | "off";

export interface Today {
  goal_minutes: number;
  weekdays_only: boolean;
  new_per_day: number;
  /** Today counts toward the goal (false on a weekend with weekdays_only). */
  counts: boolean;
  active_ms: number;
  goal_ms: number;
  /** Goal reached, or he reviewed today and nothing is left (D60). */
  met: boolean;
  caught_up: boolean;
  due: number;
  new_today: number;
  /** New cards held back by the daily limits (D65): "caught up" must not hide them. */
  new_waiting: number;
  estimate_ms: number;
  /** Today's slice (D65): the most urgent cards that fit what is left of the goal. */
  slice_ms: number;
  /** D67: the cue in "After <plan>, I review." ("" for none) and the reminder time ("" off). */
  plan: string;
  reminder: string;
  /** Monday to Sunday of this week. */
  week: { date: string; status: DayStatus; active_ms: number }[];
  days_met: number;
  skills: ({ skill: string; due: number } & Omit<Strength, "explain">)[];
  /** Sources whose doc.md can't be read (files-10): they drop out of every list, so Home names them. */
  unreadable: { dir: string; error: string }[];
}

export function today(lib: Library, now = new Date()): Today {
  const s = reviewSettings(lib);
  const goal = s.goal_minutes * 60_000;
  const reviews = readReviews(lib);
  const byDay = new Map<string, Review[]>();
  for (const r of reviews) {
    const d = localDay(r.ts);
    const list = byDay.get(d);
    if (list) list.push(r);
    else byDay.set(d, [r]);
  }
  const caughtUpDays = new Set(readSessions(lib).filter((x) => x.type === "end" && x.caught_up).map((x) => localDay(x.ts)));
  const counts = (day: string) => !(s.weekdays_only && isWeekend(day));
  const metOn = (day: string) => counts(day) && (active(byDay.get(day) ?? []) >= goal || ((byDay.get(day)?.length ?? 0) > 0 && caughtUpDays.has(day)));

  const index = openIndex(lib);
  try {
    const queue = dueQueue(lib, now, {}, index);
    const day = localDay(now);
    const done = byDay.get(day) ?? [];
    const caughtUp = queue.length === 0;
    const met = counts(day) && (active(done) >= goal || (done.length > 0 && caughtUp));

    const monday = new Date(now);
    monday.setHours(12, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const date = localDay(d);
      const status: DayStatus = !counts(date) ? "off" : (date === day ? met : metOn(date)) ? "met" : "open";
      return { date, status, active_ms: active(byDay.get(date) ?? []) };
    });
    const daysMet = new Set([...byDay.keys()].filter((d) => d !== day && metOn(d)));
    if (met) daysMet.add(day);

    const cards = index.cards();
    const med = medians(reviews, new Map(cards.map((c) => [c.id, c.kind])));
    const estimate = queue.reduce((t, e) => t + med[e.kind], 0);
    const w = loadParams(lib);
    const skills = loadSkills(lib).skills.map((k) => {
      const { explain: _, ...st } = strength(cards, reviews, k.id, w, now);
      return { skill: k.id, due: queue.filter((e) => e.skills.includes(k.id)).length, ...st };
    });
    return {
      ...s,
      counts: counts(day),
      active_ms: active(done),
      goal_ms: goal,
      met,
      caught_up: caughtUp,
      due: queue.length,
      new_today: done.filter((r) => r.finishing).length,
      new_waiting: cards.filter((c) => c.state !== "retired" && !c.fsrs).length - queue.filter((e) => !e.due && !e.relearn).length,
      estimate_ms: estimate,
      slice_ms: Math.max(0, Math.min(estimate, goal - active(done))),
      week,
      days_met: daysMet.size,
      skills,
      unreadable: unreadable(index),
    };
  } finally {
    index.close();
  }
}

/** Read again for the reason: a folder that reads now lost its row to another with the same id, which doctor names. */
function unreadable(index: LibraryIndex): Today["unreadable"] {
  return index.unindexedDocs().flatMap((doc) => {
    try {
      readItemDir(dirname(doc));
      return [];
    } catch (e) {
      return [{ dir: dirname(doc), error: errorLine(e) }];
    }
  });
}

/** A skill's strength from the library (for `ore stats --skill`). */
export function skillStrength(lib: Library, skill: string, now = new Date(), open?: LibraryIndex): Strength {
  return withIndex(lib, open, (index) => strength(index.cards(), readReviews(lib), skill, loadParams(lib), now));
}

/** Solid memories of a skill at the end of each of the last `weeks` weeks, oldest first (D62's growth line). */
export function skillGrowth(lib: Library, skill: string, now = new Date(), weeks = 12, open?: LibraryIndex): { week_end: string; solid: number }[] {
  return withIndex(lib, open, (index) => {
    const ids = new Set(index.cards().filter((c) => c.state !== "retired" && c.skills.includes(skill)).map((c) => c.id));
    const reviews = readReviews(lib).filter((r) => ids.has(r.card));
    return Array.from({ length: weeks }, (_, i) => {
      const end = new Date(now.getTime() - (weeks - 1 - i) * 7 * 864e5);
      const last = new Map<string, Review>();
      for (const r of reviews) if (new Date(r.ts) <= end) last.set(r.card, r);
      return { week_end: localDay(end), solid: [...last.values()].filter((r) => r.state_after.stability >= SOLID_DAYS).length };
    });
  });
}

/** The day's one reminder (D67): only when a time is set, today counts, the goal is not met yet and
 *  cards are waiting. Worded like Home, with his plan as the title. */
export function reminderNote(lib: Library, now = new Date()): { notify: boolean; title: string; body: string } {
  const t = today(lib, now);
  return {
    notify: !!t.reminder && t.counts && !t.met && t.due > 0,
    title: t.plan ? `After ${t.plan}, I review.` : "Time for today’s review",
    body: `About ${Math.max(1, Math.round(t.slice_ms / 60_000))} min of your most urgent cards.`,
  };
}
