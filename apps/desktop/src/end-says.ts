import type { Mood } from "./Mole";
import { depthParts, depthText, longGapText, rescuedWorthSaying, type SessionEnd, type Today } from "./ore";

/** One of the end screen's results (D252): a number, what it counts, and for a rare one what kind. */
export type Tile = { key: "kept" | "depth" | "level" | "rescued" | "long" | "cut"; value: string; label: string; hint?: string; rare?: Said["rare"] };

/** A line of the mole's. `rare`: a thing most sessions don't have, which leads and wears its own mark (D247). */
export type Said = { text: string; hint?: string; verdict?: true; rare?: { kind: "level"; skill: string } | { kind: "then" } | { kind: "long" } | { kind: "rescued" } };

/** How many lines a session's end may say (Tyler: "keep it to 2, maybe 3 max"). */
export const SAID_MAX = 3;

/** What the mole says at a session's end (D243), three lines at most (D247). The full end screen has him say
 *  only the first, since its numbers stand in the row under the ring (`endTiles`); the quick quiz lists them all. The rare things
 *  lead, rarest first: a skill's new level, a long gap he recalled across, memories pulled back in time. Days
 *  of memory always has its place. What room is left goes to the everyday lines, in an order `roll` (0 to 1,
 *  one per end screen) shuffles: which true line shows varies, never whether something was won (D62). With
 *  nothing rare the verdict opens, and a session of misses always opens with why it was worth it (D62).
 *  His voice is an old miner's: short, dry, fond of a pun, and only ever what the numbers say, never about the person. */
export function endSays(o: { session: SessionEnd; today: Today; closed: boolean; short: boolean; ups: { skill?: string; name: string; level: number }[]; minutesLeft: string | null; roll?: number; plain?: boolean; napped?: boolean }): Said[] {
  const s = o.session;
  // His verdict is a corny mining pun (Tyler, 2026-11-13), one of a few per case so it isn't the same every day.
  // `plain`: the quick quiz has no mole, so its one verdict (a session of misses) stays in plain words.
  const verdict: Said = { verdict: true, text: o.plain && s.kept === 0 ? "Every miss comes back sooner. That’s how they stick." : pick(s.kept === 0 ? PUNS.missed : o.closed ? (o.napped ? PUNS.nappedClosed : PUNS.closed) : o.short ? PUNS.short : o.napped ? PUNS.napped : PUNS.plain, o.roll ?? 0) };
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
  const common: Said[] = o.minutesLeft ? [{ text: `${o.minutesLeft} min to today’s goal. Your call.` }] : [];
  // The verdict opens unless something rare does; then it is one more everyday line.
  const opens = rare.length && s.kept > 0 ? [] : [verdict];
  const rest = shuffled(opens.length ? common : [verdict, ...common], o.roll ?? 0);
  const lead = [...opens, ...rare].slice(0, SAID_MAX - depth.length);
  return [...lead, ...depth, ...rest].slice(0, SAID_MAX);
}

/** The mole's pose once he is up (D256), for the line he is about to say, sized to how rare it is: the hop is a
 *  new level's alone; a session of misses gets a steady look, never a sad one (D62). `napped`: off the cart he is
 *  already startled, so a long gap gets his nod. `still` (Reduce Motion): he holds one pose for as long as the
 *  screen is up, so it is a resting one, never a start, a question or a frown. */
export function endMood(first: Said | undefined, o: { session: SessionEnd; closed: boolean; napped?: boolean; still?: boolean }): Mood {
  if (o.still) return o.session.kept === 0 ? "idle" : "happy";
  const rare = first?.rare?.kind;
  if (rare) return rare === "level" ? "cheer" : rare === "then" ? "curious" : rare === "long" ? (o.napped ? "nod" : "surprised") : "proud";
  if (o.session.kept === 0) return "set";
  return o.session.cut?.length || o.closed ? "happy" : "nod";
}

/** The end screen's row of results (D252), three at most, always in this order: memories kept, the
 *  days of memory they added, then the rarest true thing of the session (a skill's new level, memories pulled
 *  back in time, a long gap recalled across, else the gems cut). A session of misses has none (D62). */
export function endTiles(o: { session: SessionEnd; ups: { skill?: string; name: string; level: number }[] }): Tile[] {
  const s = o.session;
  if (s.kept === 0) return [];
  const days = s.depth_days ?? 0, extra = s.depth_extra_days ?? 0, cut = s.cut?.length ?? 0, up = o.ups[0];
  const { n, unit } = depthParts(days);
  const third: Tile | null = up
    ? { key: "level", value: String(up.level), label: `${up.name} level`, rare: { kind: "level", skill: up.skill ?? "" } }
    : rescuedWorthSaying(s)
      ? { key: "rescued", value: String(s.rescued), label: "pulled back in time", hint: s.rescued === 1 ? "Due so long you were about to lose it, and you still recalled it" : "Due so long you were about to lose them, and you still recalled them", rare: { kind: "rescued" } }
      : longGapText(s)
        ? { key: "long", value: String(s.longest_days), label: "days since you saw one", hint: longGapText(s)!, rare: { kind: "long" } }
        : cut
          ? { key: "cut", value: String(cut), label: cut === 1 ? "gem cut" : "gems cut", hint: "Cut: you’d still recall it three weeks from now" }
          : null;
  return [
    { key: "kept", value: String(s.kept), label: s.kept === 1 ? "memory kept" : "memories kept" },
    ...(days > 0 ? [{ key: "depth", value: `+${n}`, label: `${unit} of memory`, hint: `How much longer the exercises you passed today will now last, added up (at most 30 days each)${extra > 0 && extra < days ? `; ${depthText(extra)} of it came after today’s goal` : ""}` } satisfies Tile] : []),
    ...(third ? [third] : []),
  ];
}

/** The mole's verdicts. A session of misses still says why it was worth it (D62); none is about the person. */
export const PUNS = {
  plain: ["Gneiss work.", "You rock.", "Ore-some.", "Can you dig it? You can.", "Don’t take that for granite."],
  closed: ["Goal met. You rock.", "Goal met. Quarry on tomorrow.", "Goal met. Mine blown."],
  short: ["Seam’s empty. Today counts.", "Vein’s run dry. Today counts."],
  // He fell out of the cart asleep (D255) and covers for it.
  napped: ["Wasn’t asleep. Supervising.", "Resting my eyes. Both of them.", "You dig, I nap. Good system.", "I’m awake. Schist."],
  nappedClosed: ["Goal met. I supervised.", "Goal met. Slept right through it.", "Goal met. Wake me tomorrow."],
  missed: ["Schist happens. Every miss comes back sooner.", "Rocky one. Every miss comes back sooner."],
} as const;
const pick = (xs: readonly string[], roll: number) => xs[Math.min(xs.length - 1, Math.floor(roll * xs.length))]!;

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
