/** A fading hint before No idea (guidebook L246: "add cues" when nothing comes back; brief-exercise-types
 *  §hints: a hint belongs before a blank attempt). Hint 1 keeps each word's first letter and its length;
 *  hint 2 gives the first half of the words whole. His rating stays his (D21); the review records `cued`. */
export const CUE_LEVELS = 2;

// A word is letters or digits (a year, a number the point turns on is masked too); an underscore inside
// one (snake_case) stays part of it.
const WORD = /[\p{L}\p{N}][\p{L}\p{M}\p{N}'’_-]*/gu;
const mask = (w: string, keep: number) => w.slice(0, keep) + w.slice(keep).replace(/[\p{L}\p{M}\p{N}]/gu, "_");

export function cue(text: string, level: number): string {
  // Markdown marks come off at a word's edges only, never from inside one.
  const plain = text.replace(/(^|\s)[*_`~]+/g, "$1").replace(/[*_`~]+(?=\s|$|[.,;:!?)])/g, "").trim();
  const words = plain.match(WORD) ?? [];
  if (words.length === 1 && level >= 2) return plain.replace(WORD, (w) => mask(w, Math.floor(w.length / 2)));
  const whole = level >= 2 ? Math.ceil(words.length / 2) : 0;
  let i = 0;
  return plain.replace(WORD, (w) => (i++ < whole ? w : mask(w, 1)));
}

/** What the hint is drawn from: an Explain exercise's first key point, a Fact's answer. An Explain exercise
 *  with no key point has none (its whole answer is too long to cue): "" offers no hint. */
export const cueSource = (c: { kind: "card" | "prompt"; answer: string; rubric: string[] }): string =>
  c.kind === "prompt" ? (c.rubric[0]?.trim() ?? "") : c.answer;
