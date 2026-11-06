import { computeParameters, FSRSBindingItem, FSRSBindingReview } from "@open-spaced-repetition/binding";
import { writeAtomic } from "./fsutil.ts";
import { nowIso } from "./ids.ts";
import { paths, type Library } from "./library.ts";
import { readReviews, type Review } from "./reviews.ts";

export const MIN_REVIEWS_TO_OPTIMIZE = 1000;

const dayNumber = (iso: string) => Math.floor((Date.parse(iso) - new Date(iso).getTimezoneOffset() * 60_000) / 86_400_000);

// One training item per review after a card's first: the history up to and
// including it, with whole-day gaps (fsrs-rs convention).
export function trainingItems(reviews: Review[]): FSRSBindingItem[] {
  const byCard = new Map<string, Review[]>();
  for (const r of reviews) byCard.set(r.card, [...(byCard.get(r.card) ?? []), r]);
  const items: FSRSBindingItem[] = [];
  for (const rs of byCard.values()) {
    rs.sort((a, b) => a.ts.localeCompare(b.ts));
    const history = rs.map((r, i) => new FSRSBindingReview(r.rating, i === 0 ? 0 : dayNumber(r.ts) - dayNumber(rs[i - 1]!.ts)));
    for (let k = 2; k <= history.length; k++) items.push(new FSRSBindingItem(history.slice(0, k)));
  }
  return items;
}

export async function optimize(lib: Library, opts: { force?: boolean } = {}) {
  const reviews = readReviews(lib);
  if (reviews.length < MIN_REVIEWS_TO_OPTIMIZE && !opts.force) {
    return { optimized: false, reviews: reviews.length, needed: MIN_REVIEWS_TO_OPTIMIZE };
  }
  const w = await computeParameters(trainingItems(reviews), { enableShortTerm: true, numRelearningSteps: 0, timeout: 500 });
  writeAtomic(paths.fsrsParams(lib), JSON.stringify({ w, reviews: reviews.length, computed_at: nowIso() }, null, 2) + "\n");
  return { optimized: true, reviews: reviews.length, w };
}
