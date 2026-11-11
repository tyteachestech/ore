/** Lower case with accents taken off, so "cafe" and "Café" are one word. */
export const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** A word keeps a trailing # or + (C#, C++, F#), or "c#" would match every title with a c-word. */
export const WORDS = /[\p{L}\p{N}_]+[#+]*/gu;

/** Edits between a word and each start of another (entry j: its first j letters): a letter added,
 *  dropped or changed, or two swapped ("teh"). */
function editsRow(a: string, b: string): number[] {
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
  return one;
}

const TYPO = 0.25;

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
  for (const w of words) if (w[0] === term[0] && w.length >= term.length - allowed && typo(term, w, allowed)) return TYPO;
  return 0;
}

/** Whether a word's start is a typo of the term, remembered: titles share their words, so most of a
 *  search's checks are ones it has made already. */
const typos = new Map<string, boolean>();
function typo(term: string, w: string, allowed: number): boolean {
  const key = term + "\u0000" + w;
  let hit = typos.get(key);
  if (hit === undefined) {
    if (typos.size > 100_000) typos.clear();
    const head = w.slice(0, term.length + 1);
    // One table for the word's start at the term's length and one letter either side.
    const row = editsRow(term, head);
    hit = false;
    for (let n = Math.max(0, term.length - 1); n <= head.length; n++) if (row[n]! <= allowed) hit = true;
    typos.set(key, hit);
  }
  return hit;
}

/** A field folded and cut into words, kept across keystrokes, so a key on a big library only ranks.
 *  Cleared when it grows past any library's fields, so it can't grow without end. */
const folded = new Map<string, { text: string; words: string[] }>();
function prepared(field: string): { text: string; words: string[] } {
  let f = folded.get(field);
  if (!f) {
    if (folded.size > 50_000) folded.clear();
    const text = fold(field);
    f = { text, words: text.match(WORDS) ?? [] };
    folded.set(field, f);
  }
  return f;
}

/** How well a row matches a list's search, 0 when it doesn't, in tiers: the title is the query (2),
 *  every word in the title (1), a word found only in the other `fields` (author, site, skill: 0.4), a word
 *  found only as a typo (0.25 in the title, 0.1 elsewhere). The first field is the title. Every query word
 *  must be found somewhere. Rows in one tier keep the list's order, so typing narrows the list without
 *  shuffling it (Raindrop), which also keeps a big library's list from being rebuilt on every key (bench
 *  "filter sources"). */
export function rankScore(fields: (string | undefined)[], query: string): number {
  const q = fold(query).trim();
  const prep = fields.map((f) => prepared(f ?? ""));
  const texts = prep.map((p) => p.text);
  const terms = q.match(WORDS) ?? [];
  // No letters: emoji (🔥) match the rows that hold them; punctuation alone (: . -) matches nothing.
  if (!terms.length) return /\p{Extended_Pictographic}/u.test(q) && texts.some((t) => t.includes(q)) ? 1 : 0;
  let tier = 1;
  for (const term of terms) {
    let best = 0;
    // A word of one or two letters, as one starts to type, counts outside the title only as a whole
    // word ("ai"): as a word's start it matches nearly every author, site and skill.
    texts.forEach((t, i) => {
      if (best === 1 || (i && term.length < 3 && !prep[i]!.words.includes(term))) return;
      const w = wordScore(t, prep[i]!.words, term);
      if (w) best = Math.max(best, i ? (w === TYPO ? 0.1 : 0.4) : w === TYPO ? 0.25 : 1);
    });
    if (!best) return 0;
    tier = Math.min(tier, best);
  }
  return tier + (texts[0]?.trim() === q ? 1 : 0);
}

/** The rows a search finds, best tier first; rows in one tier keep the list's order. */
export function ranked<T>(rows: T[], query: string, fields: (row: T) => (string | undefined)[]): T[] {
  return rows
    .map((row) => ({ row, s: rankScore(fields(row), query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.row);
}
