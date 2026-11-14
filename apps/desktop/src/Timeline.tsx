import { Hint } from "./Hint";
import type { CardHistory } from "./ore";

const RATINGS = ["Again", "Hard", "Good", "Easy"] as const;
const DAY = 86_400_000;

/** Where each review and the next one sit on a line, 0 to 100, time to scale from the first review to
 *  `end` (the furthest any rating would put the next one, so the line holds still while the rating under
 *  the pointer moves the hollow dot along it) (D149). Two reviews a minute apart land on the same spot:
 *  that is the truth of it. */
export function layout(reviews: { ts: string; rating: 1 | 2 | 3 | 4 }[], next: string, end = next): { dots: { x: number; rating: 1 | 2 | 3 | 4; ts: string }[]; nextX: number } {
  const times = reviews.map((r) => Date.parse(r.ts));
  const t0 = times[0] ?? Date.parse(next) - DAY;
  const t1 = Math.max(Date.parse(end), Date.parse(next), t0 + DAY);
  const x = (t: number) => Math.round(((t - t0) / (t1 - t0)) * 1000) / 10;
  return { dots: reviews.map((r, i) => ({ x: x(times[i]!), rating: r.rating, ts: r.ts })), nextX: x(Date.parse(next)) };
}

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const count = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
/** "in 12 days", "tomorrow", "later today". */
export function inWords(iso: string, now = Date.now()): string {
  const days = Math.round((Date.parse(iso) - now) / DAY);
  return days <= 0 ? "later today" : days === 1 ? "tomorrow" : days < 30 ? `in ${days} days` : days < 365 ? `in ${count(Math.round(days / 30), "month")}` : `in ${count(Math.round(days / 365), "year")}`;
}

/** A card's reviews on a line (D149): a dot per review in its rating's colour, the gaps between them
 *  to scale, and a hollow dot where the rating he is about to give puts the next one, said in words at
 *  the line's end. Hovering a dot names it. Nothing animates: he sees this on every card. */
export function Timeline({ history, rating }: { history: CardHistory; rating: 1 | 2 | 3 | 4 }) {
  const { dots, nextX } = layout(history.reviews, history.next[rating], history.next[4]);
  return (
    <>
    <div className="timeline" role="img" aria-label={`${dots.length} review${dots.length === 1 ? "" : "s"}; next ${inWords(history.next[rating])} if ${RATINGS[rating - 1]}`}>
      {dots.map((d, i) => (
        <Hint key={i} text={`${RATINGS[d.rating - 1]} · ${day(d.ts)}`} side="top">
          <i className={`rate-${d.rating}`} style={{ left: `${d.x}%` }} />
        </Hint>
      ))}
      <Hint text={`Next ${inWords(history.next[rating])} if ${RATINGS[rating - 1]} · ${day(history.next[rating])}`} side="top">
        <i className={`next rate-${rating}`} style={{ left: `${nextX}%` }} />
      </Hint>
    </div>
    {/* What the hollow dot means, in words (F-new-r7y127): the line's own label says the same to VoiceOver. */}
    <span className="timeline-next" aria-hidden="true">next {inWords(history.next[rating])}</span>
    </>
  );
}
