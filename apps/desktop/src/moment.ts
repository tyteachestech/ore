import type { CardGem, CardHistory } from "./ore";
import type { Mood } from "./Mole";

/** The moment after a rating (D237): shown only when the exercise's gem changes for good or a hard recall
 *  bought a lot. `days`: memory added (FSRS stability). `line`: what became of the gem, in a word or two, and how long since he
 *  saw it (D271): the days are the message, the words only name it. Everything else gets no moment: a rating he gives a hundred times a day moves on. */
export type Moment = { from: CardGem; to: CardGem; days: number; line: string; tone: "cut" | "miss" | "deep"; kind: "cut" | "won" | "polished" | "deep" | "miss" };

/** The mole's pose for each kind of moment (D258), sized to how rare it is: winning a gem back is the hardest
 *  thing in a session, so it alone gets the laugh; a miss gets a steady look, never a sad one (D62). */
export const MOMENT_MOOD = { cut: "proud", won: "laugh", polished: "wink", deep: "surprised", miss: "set" } as const satisfies Record<Moment["kind"], Mood>;
/** How the box behaves for each kind: a win springs in, a miss stays longer. */
const TONE = { cut: "cut", won: "cut", polished: "cut", deep: "deep", miss: "miss" } as const satisfies Record<Moment["kind"], Moment["tone"]>;
const moment = (kind: Moment["kind"], m: Omit<Moment, "kind" | "tone">): Moment => ({ ...m, kind, tone: TONE[kind] });

/** A recall that adds this many days of memory is a moment even on a gem already cut: three weeks, a cut gem's worth. */
export const DEEP_DAYS = 21;
const DAY = 86_400_000;

const ago = (ts: string | undefined, now: number): string => {
  const days = ts ? Math.round((now - Date.parse(ts)) / DAY) : 0;
  return days >= 2 ? `last seen ${days} days ago` : "";
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
    return moment("miss", { from, to, days: 0, line: "Came loose" });
  if (gem.kind !== "cut" && to.kind === "cut")
    return moment(gem.kind === "dull" ? "won" : "cut", { from, to, days, line: gem.kind === "dull" ? "Won back" : ["Cut", seen].filter(Boolean).join(" · ") });
  if (to.kind === "cut" && polished && !gem.polished) return moment("polished", { from, to, days, line: "Polished" });
  if (to.kind === "cut" && days >= DEEP_DAYS && seen) return moment("deep", { from, to, days, line: seen[0]!.toUpperCase() + seen.slice(1) });
  return null;
}
