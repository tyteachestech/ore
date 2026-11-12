import type { CardGem, CardHistory } from "./ore";

/** The moment after a rating (D237): shown only when the exercise's gem changes for good or a hard recall
 *  bought a lot. `days`: memory added (FSRS stability). `line`: one true sentence about this case, never a
 *  phrase picked from a bank. Everything else gets no moment: a rating he gives a hundred times a day moves on. */
export type Moment = { from: CardGem; to: CardGem; days: number; line: string; tone: "cut" | "miss" | "deep" };

/** A recall that adds this many days of memory is a moment even on a gem already cut: three weeks, a cut gem's worth. */
export const DEEP_DAYS = 21;
const DAY = 86_400_000;

const ago = (ts: string | undefined, now: number): string => {
  const days = ts ? Math.round((now - Date.parse(ts)) / DAY) : 0;
  return days >= 2 ? `Last seen ${days} days ago, and you still had it.` : "";
};

/** `sure`: he said he was sure before the answer showed. `remix`: he answered a new case of it (D66). */
export function momentFor(history: CardHistory | undefined, rating: 1 | 2 | 3 | 4, o: { sure?: boolean; remix?: boolean; now?: number } = {}): Moment | null {
  const gem = history?.gem;
  if (!gem) return null;
  const { days, ...after } = gem.after[rating];
  const from: CardGem = { kind: gem.kind, seam: gem.seam, polished: gem.polished };
  const polished = after.kind === "cut" && (after.polished || (!!o.remix && rating >= 3));
  const to: CardGem = { ...after, ...(polished ? { polished: true } : {}) };
  const seen = ago(history.reviews.at(-1)?.ts, o.now ?? Date.now());
  if (gem.kind === "cut" && to.kind === "dull")
    return { from, to, days: 0, tone: "miss", line: `${o.sure ? "You were sure, and a miss you were sure of is the one a correction fixes best." : "Loose, not lost: it was cut once, so it comes back faster."} It returns this session.` };
  if (gem.kind !== "cut" && to.kind === "cut")
    return { from, to, days, tone: "cut", line: gem.kind === "dull" ? "Won back. It keeps a gold rim." : [seen, "Cut: you'd still recall this three weeks from now."].filter(Boolean).join(" ") };
  if (to.kind === "cut" && polished && !gem.polished) return { from, to, days, tone: "cut", line: "Polished: you recalled it on a new case." };
  if (to.kind === "cut" && days >= DEEP_DAYS && seen) return { from, to, days, tone: "deep", line: seen };
  return null;
}
