/** A fading hint before No idea (guidebook L246: "add cues" when nothing comes back; brief-exercise-types
 *  §hints: a hint belongs before a blank attempt). Hint 1 keeps each word's first letter and its length;
 *  hint 2 gives the first half of the words whole. His rating stays his (D21); the review records `cued`. */
export const CUE_LEVELS = 2;

const WORD = /\p{L}[\p{L}\p{M}'’-]*/gu;
const mask = (w: string, keep: number) => w.slice(0, keep) + w.slice(keep).replace(/[\p{L}\p{M}]/gu, "_");

export function cue(text: string, level: number): string {
  const plain = text.replace(/[*_`~]+(?=\S)|(?<=\S)[*_`~]+/g, "").trim();
  const words = plain.match(WORD) ?? [];
  if (words.length === 1 && level >= 2) return plain.replace(WORD, (w) => mask(w, Math.floor(w.length / 2)));
  const whole = level >= 2 ? Math.ceil(words.length / 2) : 0;
  let i = 0;
  return plain.replace(WORD, (w) => (i++ < whole ? w : mask(w, 1)));
}

/** What the hint is drawn from: an Explain exercise's first key point (its whole answer is too long to
 *  cue), else the answer. */
export const cueSource = (c: { kind: "card" | "prompt"; answer: string; rubric: string[] }): string =>
  (c.kind === "prompt" && c.rubric[0]?.trim()) || c.answer;
