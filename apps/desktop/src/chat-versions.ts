import type { TutorTurn } from "./Tutor";

// A turn's versions (D201): Try another reply and Edit put the message and reply on screen aside instead of
// replacing them, so he can flip back (ChatGPT's and Claude's ‹ 2 / 2 ›). The turn itself holds the version
// shown; `alts` holds the others in order, and `alt` is where the shown one sits among them all.

const PARTS = ["message", "mentions", "pointed", "files", "item", "title", "reply", "citations", "general", "hint", "exercise", "card", "ai", "steps", "marks", "stopped", "kept", "error"] as const;
/** One message as he sent it and the reply it got. */
export type Version = Pick<TutorTurn, (typeof PARTS)[number]>;

const version = (t: TutorTurn): Version => Object.fromEntries(PARTS.filter((k) => t[k] !== undefined).map((k) => [k, t[k]])) as Version;
/** How many versions a turn has, the shown one counted. */
export const versionCount = (t: TutorTurn) => (t.alts?.length ?? 0) + 1;
/** Which one shows, from 0. */
export const versionShown = (t: TutorTurn) => Math.max(0, Math.min(t.alt ?? t.alts?.length ?? 0, t.alts?.length ?? 0));
const all = (t: TutorTurn): Version[] => {
  const list = [...(t.alts ?? [])];
  list.splice(versionShown(t), 0, version(t));
  return list;
};

/** Puts the shown version with the others, for a turn about to get another: the new one goes last. A turn
 *  with no reply to keep (an error, a stop with nothing written) is replaced where it stands. */
export function shelve(t: TutorTurn): Pick<TutorTurn, "alts" | "alt"> {
  if (t.reply === undefined) return t.alts?.length ? { alts: t.alts, alt: versionShown(t) } : {};
  const alts = all(t).map(({ kept, ...v }) => (kept && kept !== "adding" ? { ...v, kept } : v));
  return { alts, alt: alts.length };
}

/** The turn showing version `i` of its own. */
export function flip(t: TutorTurn, i: number): TutorTurn {
  const list = all(t);
  const v = list[i];
  if (!v || i === versionShown(t)) return t;
  return { id: t.id, ...v, alts: list.filter((_, j) => j !== i), alt: i };
}
