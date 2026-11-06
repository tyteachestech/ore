import { localDay } from "./ids.ts";
import type { Review } from "./reviews.ts";

export const MIN_RETENTION_N = 10;


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

export const MIN_CALIBRATION_N = 20;
const CALIBRATION_DAYS = 84;

/** Calibration (D69): of his Explain answers marked Sure in the last 12 weeks, the share the AI's
 *  key-point check rated Good or Easy. Only typed, AI-graded answers count: the check is independent
 *  of his own rating, and on Fact cards the confidence key also reveals the answer. Null below 20. */
export function calibration(reviews: Review[], now = new Date()): { sure_n: number; sure_right: number | null } {
  const since = now.getTime() - CALIBRATION_DAYS * 864e5;
  const sure = reviews.filter((r) => r.confidence === 3 && r.ai_rating !== undefined && !r.in_head && Date.parse(r.ts) >= since && Date.parse(r.ts) <= now.getTime());
  return { sure_n: sure.length, sure_right: sure.length >= MIN_CALIBRATION_N ? sure.filter((r) => r.ai_rating! >= 3).length / sure.length : null };
}
