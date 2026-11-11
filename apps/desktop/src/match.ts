/** Lower case with accents taken off, so "cafe" and "Café" are one word. */
export const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** A word keeps a trailing # or + (C#, C++, F#), or "c#" would match every title with a c-word. */
export const WORDS = /[\p{L}\p{N}_]+[#+]*/gu;

/** Edits between two short words: a letter added, dropped or changed, or two swapped ("teh"). */
function edits(a: string, b: string): number {
  let two: number[] = [];
  let one = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const swap = i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] ? two[j - 2]! + 1 : Infinity;
      row[j] = Math.min(one[j]! + 1, row[j - 1]! + 1, one[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1), swap);
    }
    two = one;
    one = row;
  }
  return one[b.length]!;
}

/** How well one query word is found in a text: 1 at the start of a word, 0.5 inside one, 0.25 for a
 *  typo. A typo is one wrong letter in a word of four or more, two in eight or more, against the
 *  start of a word that begins with the same letter (so it still matches while he is typing it). */
function wordScore(text: string, words: string[], term: string): number {
  let inside = false;
  for (let i = text.indexOf(term); i >= 0; i = text.indexOf(term, i + 1)) {
    if (i === 0 || !/[\p{L}\p{N}]/u.test(text.charAt(i - 1))) return 1;
    inside = true;
  }
  if (inside) return 0.5;
  const allowed = term.length >= 8 ? 2 : term.length >= 4 ? 1 : 0;
  if (!allowed) return 0;
  for (const w of words) {
    if (w[0] !== term[0]) continue;
    for (let n = term.length - 1; n <= term.length + 1; n++) if (edits(term, w.slice(0, n)) <= allowed) return 0.25;
  }
  return 0;
}

/** How well a row matches a list's search, 0 when it doesn't. `fields` are what the row is known by,
 *  the first its title: every query word must be found in one of them, a word found in the title
 *  counts most, the rest (author, site, skill) under half of that, and a typo least (Raycast, Linear). */
export function rankScore(fields: (string | undefined)[], query: string): number {
  const q = fold(query).trim();
  const texts = fields.map((f) => fold(f ?? ""));
  const terms = q.match(WORDS) ?? [];
  // No letters: emoji (🔥) match the rows that hold them; punctuation alone (: . -) matches nothing.
  if (!terms.length) return /\p{Extended_Pictographic}/u.test(q) && texts.some((t) => t.includes(q)) ? 1 : 0;
  const words = texts.map((t) => t.match(WORDS) ?? []);
  let score = 0;
  for (const term of terms) {
    let best = 0;
    texts.forEach((t, i) => (best = Math.max(best, wordScore(t, words[i]!, term) * (i ? 0.4 : 1))));
    if (!best) return 0;
    score += best;
  }
  const title = texts[0] ?? "";
  return score / terms.length + (title.startsWith(terms[0]!) ? 0.5 : 0) + (title.trim() === q ? 1 : 0);
}

/** The rows a search finds, best match first; rows that match as well keep the list's order. */
export function ranked<T>(rows: T[], query: string, fields: (row: T) => (string | undefined)[]): T[] {
  return rows
    .map((row) => ({ row, s: rankScore(fields(row), query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.row);
}
