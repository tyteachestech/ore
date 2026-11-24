import { existsSync, readFileSync } from "node:fs";
import { createEmptyCard, fsrs, generatorParameters, type Card as FsrsCard, type FSRS, type Grade } from "ts-fsrs";
import { paths, type Library } from "./library.ts";
import type { FsrsState, Review } from "./reviews.ts";

// FSRS-6 defaults (ts-fsrs). Learning/relearning steps are off: a miss gets
// exactly one relearn pass, scheduled by the review queue within the session
// (SPEC §3), not by FSRS minute steps. No fuzz, so replay is deterministic.
const cache = new Map<string, FSRS>();

export function scheduler(retention: number, w?: number[]): FSRS {
  const key = `${retention}:${w?.join(",") ?? ""}`;
  let f = cache.get(key);
  if (!f) {
    f = fsrs(generatorParameters({ request_retention: retention, enable_fuzz: false, learning_steps: [], relearning_steps: [], ...(w ? { w } : {}) }));
    cache.set(key, f);
  }
  return f;
}

// Optimized weights from `ore optimize`, if any.
export function loadParams(lib: Library): number[] | undefined {
  const p = paths.fsrsParams(lib);
  if (!existsSync(p)) return undefined;
  // A damaged file (cut off, hand-edited) falls back to the default weights; `ore doctor` names it.
  let w: unknown;
  try {
    w = (JSON.parse(readFileSync(p, "utf8")) as { w?: unknown })?.w;
  } catch {
    return undefined;
  }
  return Array.isArray(w) && w.length === 21 && w.every((x) => typeof x === "number" && Number.isFinite(x)) ? w : undefined;
}

export const toState = (c: FsrsCard): FsrsState => ({
  due: c.due.toISOString(),
  stability: c.stability,
  difficulty: c.difficulty,
  elapsed_days: c.elapsed_days,
  scheduled_days: c.scheduled_days,
  reps: c.reps,
  lapses: c.lapses,
  learning_steps: c.learning_steps,
  state: c.state,
  last_review: c.last_review?.toISOString(),
});

export const fromState = (s: FsrsState): FsrsCard => ({
  ...s,
  learning_steps: s.learning_steps ?? 0,
  due: new Date(s.due),
  last_review: s.last_review ? new Date(s.last_review) : undefined,
});

export const emptyState = (at: Date): FsrsState => toState(createEmptyCard(at));

export function nextState(before: FsrsState, at: Date, rating: Grade, retention: number, w?: number[]): FsrsState {
  return toState(scheduler(retention, w).next(fromState(before), at, rating).card);
}

// Card state = replay of its reviews in time order from an empty card.
export function replay(reviews: Review[], retention: number, w?: number[]): FsrsState | null {
  let s: FsrsState | null = null;
  for (const r of [...reviews].sort((a, b) => a.ts.localeCompare(b.ts))) {
    const at = new Date(r.ts);
    s = nextState(s ?? emptyState(at), at, r.rating as Grade, retention, w);
  }
  return s;
}

const sameState = (a: FsrsState, b: FsrsState) =>
  a.due === b.due && a.stability === b.stability && a.difficulty === b.difficulty && a.reps === b.reps && a.lapses === b.lapses && a.state === b.state;

/** The reviews in time order, each with the states the merged log replays to before and after it. A review
 *  keeps the states it saved while its saved "before" is where the merged history stood (nearly always, so
 *  this costs one comparison each); one made on a device that hadn't seen another's reviews yet (offline,
 *  then synced) is replayed, at its card's `retention` (undefined: a card gone since, kept as saved). The
 *  history every count of solid memories reads (D63), so it agrees with the schedule's own replay. */
export function merged(reviews: Review[], retention: (card: string) => number | undefined, w?: number[]): Review[] {
  const at = new Map<string, FsrsState>();
  return [...reviews]
    .sort((a, b) => a.ts.localeCompare(b.ts))
    .map((r) => {
      const prev = at.get(r.card);
      const k = prev ? sameState(prev, r.state_before) : r.state_before.reps === 0;
      const target = k ? undefined : retention(r.card);
      if (target === undefined) {
        at.set(r.card, r.state_after);
        return r;
      }
      const when = new Date(r.ts);
      const before = prev ?? emptyState(when);
      const after = nextState(before, when, r.rating as Grade, target, w);
      at.set(r.card, after);
      return { ...r, state_before: before, state_after: after };
    });
}

export function retrievability(s: FsrsState | null, now: Date, retention: number, w?: number[]): number {
  if (!s || s.reps === 0) return 0;
  return scheduler(retention, w).get_retrievability(fromState(s), now, false);
}
