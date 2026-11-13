import { localDay } from "./ids.ts";
import type { Review } from "./reviews.ts";
import { nextState, retrievability } from "./scheduler.ts";

export const MIN_RETENTION_N = 10;
/** A solid memory, as `SOLID_DAYS` in today.ts (which imports this file). */
const SOLID = 21;


export interface RetentionResult {
  retention: number | null; // null below MIN_RETENTION_N qualifying reviews
  n: number;
  passed: number;
}

// Retention adapted from Anki's "true retention":
// - skip each card's first rating (learning, not retention)
// - skip relearn re-asks (a review that follows a miss of that card in the same session)
// - skip early reviews (done on a day before the card was due)
// - pass = rating 3 or 4; partial (2) counts as a fail
export function retentionMetric(reviews: Review[]): RetentionResult {
  const seen = new Map<string, Review>();
  let n = 0;
  let passed = 0;
  for (const r of [...reviews].sort((a, b) => a.ts.localeCompare(b.ts))) {
    const prev = seen.get(r.card);
    seen.set(r.card, r);
    if (!prev) continue;
    if (prev.rating === 1 && r.session && prev.session === r.session) continue;
    if (localDay(r.ts) < localDay(r.state_before.due)) continue;
    n++;
    if (r.rating >= 3) passed++;
  }
  return { retention: n >= MIN_RETENTION_N ? passed / n : null, n, passed };
}

/** Two numbers for us to watch, never shown in the app (science pass 2026-11-02, rec 5; `ore stats --json`).
 *  `ai_agreement`: of typed answers the AI checked, how often his rating is its suggestion. Near 1, the AI
 *  is in effect setting the rating D21 keeps for him. `explain`: pass rates (Good or Easy) of typed and
 *  in-head answers on cards old enough for either (D68; passed twice at least), the fluency risk D68 took on.
 *  `near_cut` (D246): how often he rates Good or Easy on an exercise one Good from solid, against the other
 *  growing ones, each with its mean recall chance at the time. Good cuts the gem, and people just short of a
 *  goal overstate (Schweitzer 2004): `near` well above `other` at a like recall chance says the gem bends his rating. */
export function raterStats(reviews: Review[], w?: number[]) {
  const growing = reviews.filter((r) => (r.state_before.reps ?? 0) > 0 && r.state_before.stability < SOLID);
  const isNear = (r: Review) => nextState(r.state_before, new Date(r.ts), 3, 0.9, w).stability >= SOLID;
  const watch = (rs: Review[]) => ({
    reviews: rs.length,
    pass_rate: rs.length ? rs.filter((r) => r.rating >= 3).length / rs.length : null,
    recall: rs.length ? rs.reduce((t, r) => t + retrievability(r.state_before, new Date(r.ts), 0.9, w), 0) / rs.length : null,
  });
  const checked = reviews.filter((r) => r.ai_rating !== undefined && !r.in_head);
  const same = checked.filter((r) => r.rating === r.ai_rating).length;
  const old = reviews.filter((r) => (r.state_before.reps ?? 0) >= 2);
  const rate = (rs: Review[]) => ({ reviews: rs.length, pass_rate: rs.length ? rs.filter((r) => r.rating >= 3).length / rs.length : null });
  return {
    ai_agreement: {
      n: checked.length,
      same,
      share: checked.length ? same / checked.length : null,
      his_higher: checked.filter((r) => r.rating > r.ai_rating!).length,
      his_lower: checked.filter((r) => r.rating < r.ai_rating!).length,
    },
    explain: { typed: rate(old.filter((r) => !r.in_head && r.answer)), in_head: rate(old.filter((r) => r.in_head)) },
    near_cut: { near: watch(growing.filter(isNear)), other: watch(growing.filter((r) => !isNear(r))) },
  };
}

export const MIN_CALIBRATION_N = 20;
const CALIBRATION_DAYS = 84;

/** A confidence tap shows its bar from this many answers (D165); Sure's line keeps D69's 20. */
export const MIN_LEVEL_N = 10;
/** Calibration (D69): of his Explain answers marked Sure in the last 12 weeks, the share the AI's
 *  key-point check rated Good or Easy. Only typed, AI-graded answers count: the check is independent
 *  of his own rating, and on Fact cards the confidence key also reveals the answer. Null below 20.
 *  `levels`: the same share for each tap (D165), null below MIN_LEVEL_N. */
export function calibration(reviews: Review[], now = new Date()): { sure_n: number; sure_right: number | null; levels: { confidence: 1 | 2 | 3; n: number; right: number | null }[] } {
  const since = now.getTime() - CALIBRATION_DAYS * 864e5;
  const counted = reviews.filter((r) => r.ai_rating !== undefined && !r.in_head && Date.parse(r.ts) >= since && Date.parse(r.ts) <= now.getTime());
  const at = (c: number) => counted.filter((r) => r.confidence === c);
  const share = (rs: Review[]) => rs.filter((r) => r.ai_rating! >= 3).length / rs.length;
  const sure = at(3);
  // Each tap's share right (D165), so he sees whether Guess, Think so and Sure mean different things; a tap
  // with too few answers has none yet.
  const levels = ([1, 2, 3] as const).map((confidence) => {
    const rs = at(confidence);
    return { confidence, n: rs.length, right: rs.length >= MIN_LEVEL_N ? share(rs) : null };
  });
  return { sure_n: sure.length, sure_right: sure.length >= MIN_CALIBRATION_N ? share(sure) : null, levels };
}
