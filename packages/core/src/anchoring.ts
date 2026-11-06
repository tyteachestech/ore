import search from "approx-string-match";

// W3C-style selectors over the doc body: TextQuoteSelector (exact, prefix,
// suffix) + TextPositionSelector (start, end). Re-anchoring follows the
// Hypothesis pattern: position → exact → fuzzy → orphan.

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

export function anchor(text: string, sel: Selector): Anchor | null {
  if (!sel.exact) return null;
  if (text.slice(sel.start, sel.end) === sel.exact) return { start: sel.start, end: sel.end, method: "position" };

  const exact = occurrences(text, sel.exact);
  if (exact.length) {
    const best = exact
      .map((s) => ({ s, score: contextScore(text, sel, s, s + sel.exact.length) }))
      .sort((a, b) => b.score - a.score)[0]!;
    return { start: best.s, end: best.s + sel.exact.length, method: "exact" };
  }

  const maxErrors = Math.floor(sel.exact.length * MAX_FUZZY_ERROR_RATE);
  if (maxErrors < 1) return null;
  const matches = search(text, sel.exact, maxErrors);
  if (!matches.length) return null;
  const best = matches
    .map((m) => ({ m, score: 50 * (1 - m.errors / sel.exact.length) + contextScore(text, sel, m.start, m.end) }))
    .sort((a, b) => b.score - a.score)[0]!;
  return { ...refineBounds(text, sel, best.m.start, best.m.end, 2 * maxErrors), method: "fuzzy" };
}

// A minimal-edit match can stop short of (or overrun) the real passage when
// words were inserted. Move each boundary within the error budget to where
// the stored prefix/suffix agree best with the surrounding text.
function refineBounds(text: string, sel: Selector, start: number, end: number, slack: number): { start: number; end: number } {
  const pick = (from: number, score: (i: number) => number) => {
    let best = from;
    for (let i = from - slack; i <= from + slack; i++) {
      if (i < 0 || i > text.length) continue;
      const d = score(i) - score(best);
      if (d > 1e-9 || (Math.abs(d) <= 1e-9 && Math.abs(i - from) < Math.abs(best - from))) best = i;
    }
    return best;
  };
  const s = sel.prefix ? pick(start, (i) => similarity(sel.prefix, text.slice(Math.max(0, i - sel.prefix.length), i))) : start;
  const e = sel.suffix ? pick(end, (i) => similarity(sel.suffix, text.slice(i, i + sel.suffix.length))) : end;
  return e > s ? { start: s, end: e } : { start, end };
}
