import search from "approx-string-match";

// W3C-style selectors over the doc body: TextQuoteSelector (exact, prefix,
// suffix) + TextPositionSelector (start, end). Re-anchoring follows the
// Hypothesis pattern: position → exact → fuzzy → orphan, where a position whose context
// changed is checked against the quote's other occurrences first.

export const CONTEXT = 32;

export interface Selector {
  exact: string;
  prefix: string;
  suffix: string;
  start: number;
  end: number;
}

export type AnchorMethod = "position" | "exact" | "fuzzy";

export interface Anchor {
  start: number;
  end: number;
  method: AnchorMethod;
}

export function quoteSelector(text: string, start: number, end: number): Selector {
  return {
    exact: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT), start),
    suffix: text.slice(end, end + CONTEXT),
    start,
    end,
  };
}

function occurrences(text: string, needle: string): number[] {
  const out: number[] = [];
  if (!needle) return out;
  for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + 1)) out.push(i);
  return out;
}

// Text with whitespace and Markdown emphasis markers removed, plus a map
// from each kept character back to its offset in the original.
const IGNORED = /[\s*_`]/;
function skeleton(text: string): { chars: string; map: number[] } {
  let chars = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (IGNORED.test(text[i]!)) continue;
    chars += text[i];
    map.push(i);
  }
  return { chars, map };
}

// For creating a highlight from user-supplied text: exact match, then a match
// that ignores whitespace and Markdown emphasis (text copied from a rendered
// page has neither line breaks nor ** or _ markers). With several hits, the
// one nearest `hint` wins (the first one without a hint).
export function locate(text: string, exact: string, hint = 0): { start: number; end: number } | null {
  const needle = exact.trim();
  if (!needle) return null;
  const nearest = (xs: { start: number; end: number }[]) =>
    xs.sort((a, b) => Math.abs(a.start - hint) - Math.abs(b.start - hint))[0] ?? null;
  const hits = occurrences(text, needle).map((s) => ({ start: s, end: s + needle.length }));
  if (hits.length) return nearest(hits);
  const doc = skeleton(text);
  const pat = skeleton(needle).chars;
  if (!pat) return null;
  return nearest(occurrences(doc.chars, pat).map((s) => ({ start: doc.map[s]!, end: doc.map[s + pat.length - 1]! + 1 })));
}

// Normalized similarity 0..1 by Levenshtein distance (short strings only).
export function similarity(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return 1 - prev[b.length]! / Math.max(a.length, b.length);
}

// Score a candidate span by context agreement and closeness to the old position.
function contextScore(text: string, sel: Selector, start: number, end: number): number {
  const prefix = similarity(sel.prefix, text.slice(Math.max(0, start - sel.prefix.length), start));
  const suffix = similarity(sel.suffix, text.slice(end, end + sel.suffix.length));
  const pos = 1 - Math.min(1, Math.abs(start - sel.start) / Math.max(1, text.length));
  return 20 * prefix + 20 * suffix + 2 * pos;
}

export const MAX_FUZZY_ERROR_RATE = 0.25;
// An edit to a passage is local: the text on at least one side of it still reads as it did. When the quote was
// reworded and the text on both sides changed too, the match is another passage written alike (a deleted
// passage's neighbour), and taking it would move a question onto words it was never about (F567).
export const MIN_FUZZY_CONTEXT = 0.9;
// Or the quote and both its sides, taken together, still read as they did: a few words corrected all through
// the text. Another passage written alike differs more than that (the heron test reads 0.82).
export const MIN_FUZZY_WINDOW = 0.85;
// Or the quote is long and all but word for word: a page footer inside it dropped by a better PDF read, which
// also rejoined its paragraph and moved the footnotes, so neither side reads as it did. A passage merely
// written alike is short or differs more than this (the heron test: 50 letters, a fifth of them changed).
export const SURE_FUZZY_LENGTH = 120;
export const SURE_FUZZY_ERROR_RATE = 0.1;

export function anchor(text: string, sel: Selector): Anchor | null {
  if (!sel.exact) return null;
  const atOld = text.slice(sel.start, sel.end) === sel.exact;
  // The quote and its context where they were: nothing elsewhere can match better.
  if (atOld && text.slice(sel.start - sel.prefix.length, sel.start) === sel.prefix && text.slice(sel.end, sel.end + sel.suffix.length) === sel.suffix)
    return { start: sel.start, end: sel.end, method: "position" };

  // A quote found more than once goes to the copy whose context matches best; the old offset only
  // breaks a tie (contextScore's position term), so a reworded copy left there doesn't keep it.
  const exact = occurrences(text, sel.exact);
  if (exact.length) {
    const best = exact
      .map((s) => ({ s, score: contextScore(text, sel, s, s + sel.exact.length) }))
      .sort((a, b) => b.score - a.score)[0]!;
    return { start: best.s, end: best.s + sel.exact.length, method: atOld && best.s === sel.start ? "position" : "exact" };
  }

  const maxErrors = Math.floor(sel.exact.length * MAX_FUZZY_ERROR_RATE);
  if (maxErrors < 1) return null;
  const matches = search(text, sel.exact, maxErrors);
  if (!matches.length) return null;
  const best = matches
    .map((m) => ({ m, score: 50 * (1 - m.errors / sel.exact.length) + contextScore(text, sel, m.start, m.end) }))
    .sort((a, b) => b.score - a.score)[0]!;
  const span = refineBounds(text, sel, best.m.start, best.m.end, 2 * maxErrors);
  const before = text.slice(Math.max(0, span.start - sel.prefix.length), span.start);
  const after = text.slice(span.end, span.end + sel.suffix.length);
  // Only a side the highlight had counts: one at the document's start or end has nothing to compare.
  const sides = [sel.prefix ? similarity(sel.prefix, before) : -1, sel.suffix ? similarity(sel.suffix, after) : -1].filter((s) => s >= 0);
  const local = !sides.length || Math.max(...sides) >= MIN_FUZZY_CONTEXT;
  // A text read again all through (a transcript heard again, D167; a better PDF reader) changes a few words
  // everywhere, its sides too: then the quote and its sides, taken together, still read alike.
  const whole = similarity(sel.prefix + sel.exact + sel.suffix, before + text.slice(span.start, span.end) + after) >= MIN_FUZZY_WINDOW;
  const sure = sel.exact.length >= SURE_FUZZY_LENGTH && best.m.errors <= sel.exact.length * SURE_FUZZY_ERROR_RATE;
  if (local || whole) return { ...span, method: "fuzzy" };
  // Neither side reads as it did, so they say nothing about where the quote ends: the match's own ends stand.
  return sure ? { ...trimLostEnd(text, sel.exact, best.m.start, best.m.end), method: "fuzzy" } : null;
}

/** A quote that lost words at one end (a page footer it began or ended with): the closest match pairs those
 *  lost letters with the text beside it, so the highlight would start or stop mid-word in its neighbour. The
 *  rest of the quote is there letter for letter, and that run is the highlight. */
function trimLostEnd(text: string, exact: string, start: number, end: number): { start: number; end: number } {
  const enough = exact.length * (1 - SURE_FUZZY_ERROR_RATE);
  let tail = 0;
  while (tail < exact.length && end - tail > 0 && text[end - 1 - tail] === exact[exact.length - 1 - tail]) tail++;
  if (tail >= enough) return { start: end - tail + (text.slice(end - tail, end).match(/^\s*/)?.[0].length ?? 0), end };
  let head = 0;
  while (head < exact.length && text[start + head] === exact[head]) head++;
  if (head >= enough) return { start, end: start + text.slice(start, start + head).trimEnd().length };
  return { start, end };
}

const WORD = /[\p{L}\p{N}\p{M}_]/u;
/** Whether a boundary between two characters falls between words (either side missing counts). */
const between = (a: string | undefined, b: string | undefined) => !(a && b && WORD.test(a) && WORD.test(b));

// A minimal-edit match can stop short of (or overrun) the real passage when
// words were inserted. Move each boundary within the error budget to where
// the stored prefix/suffix agree best with the surrounding text. Where two places agree alike, the one that
// falls between words as the highlight's own boundary did wins, then the nearer: a word that grew at the
// highlight's end ("memory." → "memories") scores its suffix the same after "memorie" (F577).
function refineBounds(text: string, sel: Selector, start: number, end: number, slack: number): { start: number; end: number } {
  const pick = (from: number, wasBetween: boolean, score: (i: number) => number) => {
    let best = from;
    const fits = (i: number) => between(text[i - 1], text[i]) === wasBetween;
    for (let i = from - slack; i <= from + slack; i++) {
      if (i < 0 || i > text.length) continue;
      const d = score(i) - score(best);
      const tie = Math.abs(d) <= 1e-9;
      if (d > 1e-9 || (tie && fits(i) && !fits(best)) || (tie && fits(i) === fits(best) && Math.abs(i - from) < Math.abs(best - from))) best = i;
    }
    return best;
  };
  const s = sel.prefix ? pick(start, between(sel.prefix.at(-1), sel.exact[0]), (i) => similarity(sel.prefix, text.slice(Math.max(0, i - sel.prefix.length), i))) : start;
  const e = sel.suffix ? pick(end, between(sel.exact.at(-1), sel.suffix[0]), (i) => similarity(sel.suffix, text.slice(i, i + sel.suffix.length))) : end;
  return e > s ? { start: s, end: e } : { start, end };
}
