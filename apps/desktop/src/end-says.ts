import { depthText, longGapText, rescuedWorthSaying, type SessionEnd, type Today } from "./ore";

/** A line of the mole's. `rare`: a thing most sessions don't have, which leads and wears its own mark (D247). */
export type Said = { text: string; hint?: string; verdict?: true; rare?: { kind: "level"; skill: string } | { kind: "then" } | { kind: "long" } | { kind: "rescued" } };

/** How many lines a session's end may say (Tyler: "keep it to 2, maybe 3 max"). */
export const SAID_MAX = 3;

/** What the mole says at a session's end (D243), one line at a time, three at most (D247). The rare things
 *  lead, rarest first: a skill's new level, a long gap he recalled across, memories pulled back in time. Days
 *  of memory always has its place. What room is left goes to the everyday lines, in an order `roll` (0 to 1,
 *  one per end screen) shuffles: which true line shows varies, never whether something was won (D62). With
 *  nothing rare the verdict opens, and a session of misses always opens with why it was worth it (D62).
 *  His voice is an old miner's: short, dry, and only ever what the numbers say, never about the person. */
export function endSays(o: { session: SessionEnd; today: Today; closed: boolean; short: boolean; ups: { skill?: string; name: string; level: number }[]; waiting: string | null; minutesLeft: string | null; roll?: number }): Said[] {
  const s = o.session;
  const verdict: Said = { verdict: true, text: s.kept === 0 ? "Every miss comes back sooner. That’s how they stick." : o.closed ? "Goal met. Tools down." : o.short ? "Seam’s empty. Today counts." : "Honest work." };
  const rare: Said[] = [
    ...o.ups.map((k): Said => ({ text: `${k.name} hit level ${k.level}.`, rare: { kind: "level", skill: k.skill ?? "" } })),
    // Then and now (D248): the two answers stand under the ring; he only points at them.
    ...(s.then_now ? [{ text: `${weeksAgo(s.then_now.then_ts)} back that one beat you. Read it now.`, rare: { kind: "then" } } satisfies Said] : []),
    ...(longGapText(s) ? [{ text: `${s.longest_days} days gone and you still had it.`, rare: { kind: "long" } } satisfies Said] : []),
    ...(rescuedWorthSaying(s) ? [{ text: `${s.rescued} pulled back just before you’d have lost ${s.rescued === 1 ? "it" : "them"}.`, rare: { kind: "rescued" } } satisfies Said] : []),
  ];
  const extra = s.depth_extra_days ?? 0;
  const depth: Said[] = (s.depth_days ?? 0) > 0
    ? [{ text: `+${depthText(s.depth_days!)} of memory${extraText(s.depth_days!, extra)}. You dug that.`, hint: `How much longer the exercises you passed today will now last, added up (at most 30 days each)${extraText(s.depth_days!, extra) ? "; extra is what came after today’s goal" : ""}` }]
    : [];
  const common: Said[] = [...(o.minutesLeft ? [{ text: `${o.minutesLeft} min to today’s goal. Your call.` }] : []), ...(o.waiting ? [{ text: o.waiting }] : [])];
  // The verdict opens unless something rare does; then it is one more everyday line.
  const opens = rare.length && s.kept > 0 ? [] : [verdict];
  const rest = shuffled(opens.length ? common : [verdict, ...common], o.roll ?? 0);
  const lead = [...opens, ...rare].slice(0, SAID_MAX - depth.length);
  return [...lead, ...depth, ...rest].slice(0, SAID_MAX);
}

/** `xs` in an order picked by `roll` (0 to 1): the same roll, the same order. */
function shuffled<T>(xs: T[], roll: number): T[] {
  const left = [...xs], out: T[] = [];
  for (let r = roll; left.length; r = (r * 7919) % 1) out.push(...left.splice(Math.min(left.length - 1, Math.floor(r * left.length)), 1));
  return out;
}

/** ", 12 of them extra": the part of the days that came after the goal, in the total's own unit when that is days. */
const extraText = (total: number, extra: number) => (extra <= 0 || extra >= total ? "" : total < 60 ? `, ${extra} of them extra` : `, ${depthText(extra)} of it extra`);

/** "4 weeks", "3 months": how long ago `ts` was, in the unit a person would say. */
export const weeksAgo = (ts: string, now = Date.now()) => {
  const days = Math.max(0, Math.round((now - Date.parse(ts)) / 864e5));
  return days < 60 ? `${Math.max(1, Math.round(days / 7))} ${Math.round(days / 7) <= 1 ? "week" : "weeks"}` : `${Math.round(days / 30.44)} months`;
};
