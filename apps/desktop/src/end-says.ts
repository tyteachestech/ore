import { depthText, longGapText, rescuedWorthSaying, type SessionEnd, type Today } from "./ore";

export type Said = { text: string; hint?: string };

/** What the mole says at a session's end (D243), one line at a time: the verdict first, then each thing the
 *  session won. His voice is an old miner's: short, dry, and only ever what the numbers say. Every line names
 *  the work or its result, never the person, and a session of misses gets the reason it was worth it (D62). */
export function endSays(o: { session: SessionEnd; today: Today; closed: boolean; short: boolean; ups: { name: string; level: number }[]; waiting: string | null; minutesLeft: string | null }): Said[] {
  const s = o.session, said: Said[] = [];
  said.push({ text: s.kept === 0 ? "Every miss comes back sooner. That’s how they stick." : o.closed ? "Goal met. Tools down." : o.short ? "Seam’s empty. Today counts." : "Honest work." });
  if ((s.depth_days ?? 0) > 0) said.push({ text: `+${depthText(s.depth_days!)} of memory. You dug that.`, hint: "How much longer the exercises you passed today will now last, added up" });
  if (longGapText(s)) said.push({ text: `${s.longest_days} days gone and you still had it.` });
  if (rescuedWorthSaying(s)) said.push({ text: `${s.rescued} pulled back just before you’d have lost ${s.rescued === 1 ? "it" : "them"}.` });
  for (const k of o.ups) said.push({ text: `${k.name} hit level ${k.level}.` });
  if (o.minutesLeft) said.push({ text: `${o.minutesLeft} min to today’s goal. Your call.` });
  if (o.waiting) said.push({ text: o.waiting });
  return said;
}
