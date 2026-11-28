/** A fading hint before No idea (guidebook L246: "add cues" when nothing comes back; brief-exercise-types
 *  §hints: a hint belongs before a blank attempt). Hint 1 keeps each word's first letter and its length;
 *  hint 2 gives the first half of the words whole. His rating stays his (D21); the review records `cued`. */
export const CUE_LEVELS = 2;

// A word is letters or digits (a year, a number the point turns on is masked too); an underscore inside
// one (snake_case) stays part of it.
const WORD = /[\p{L}\p{N}][\p{L}\p{M}\p{N}'’_-]*/gu;
const mask = (w: string, keep: number) => w.slice(0, keep) + w.slice(keep).replace(/[\p{L}\p{M}\p{N}]/gu, "_");

// Markdown marks come off at a word's edges only, never from inside one.
const bare = (text: string) => text.replace(/(^|\s)[*_`~]+/g, "$1").replace(/[*_`~]+(?=\s|$|[.,;:!?)])/g, "").trim();

export function cue(text: string, level: number): string {
  const plain = bare(text);
  const words = plain.match(WORD) ?? [];
  if (words.length === 1 && level >= 2) return plain.replace(WORD, (w) => mask(w, Math.floor(w.length / 2)));
  const whole = level >= 2 ? Math.ceil(words.length / 2) : 0;
  let i = 0;
  return plain.replace(WORD, (w) => (i++ < whole ? w : mask(w, 1)));
}

/** How many hints a text has: the levels that still hide some of it. "7" has none (its first letter is all of
 *  it); "Vitamin C" has one, since its second would spell it out whole. */
export const cueLevels = (text: string): number => {
  let n = 0;
  while (n < CUE_LEVELS && cue(text, n + 1) !== bare(text)) n++;
  return n;
};

/** What the hint is drawn from: an Explain exercise's first key point, a Fact's answer. An Explain exercise
 *  with no key point has none (its whole answer is too long to cue). */
export const cueSource = (c: { kind: "card" | "prompt"; answer: string; rubric: string[] }): string =>
  c.kind === "prompt" ? (c.rubric[0]?.trim() ?? "") : c.answer;
