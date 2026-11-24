/** Case and runs of space aside. */
const fold = (s: string) => s.toLowerCase().replace(/\s+/g, " ");
/** Accents aside too, as search matches: "cafe" finds and marks [café]. */
const bare = (s: string) => fold(s.normalize("NFD").replace(/\p{M}/gu, "").normalize("NFC"));

/** A line of a snippet as the reader shows it: its Markdown block mark gone. Undefined when Markdown is left
 *  inside it (bold, a link, code), since the page's text would not hold it as written. */
const shown = (line: string): string | undefined => {
  const t = line.replace(/^\s*(?:#{1,6}|[-*+]|\d+\.|>)\s+/, "").trim();
  return t && !/[*_`[\]()|\\<>]/.test(t) ? t : undefined;
};

/** The longest stretch one find may light: past it, a lit clause reads as a highlight, not a match. */
const STRETCH = 60;

/** What Find should look for, and near which passage, for a search match in a source's text. Search matches his
 *  words apart, and marks each in its snippet as `[word]` around `…`; Find lights one literal run. So: his
 *  query when the snippet holds it as typed; else the stretch of one line from its first matched word to its last,
 *  when that is short and plain; else the first matched word. `near` is that line as the page shows it, so Find
 *  starts at the match the result showed, not the first in the source. */
export function foundIn(snippet: string, query: string): { words: string; near: string | undefined } {
  const asked = bare(query).split(" ").filter(Boolean);
  // A source's own brackets (a link's text, a footnote's [1]) are not marks: a mark holds a word he asked for,
  // or one that starts as it does (search matches a word's other endings too).
  const marks = (l: string) => [...l.matchAll(/\[([^[\]]+)\]/g)].filter((m) => asked.some((w) => bare(m[1]!).startsWith(w.slice(0, 4)) || w.startsWith(bare(m[1]!))));
  const lines = snippet.split(/…|\n/).filter((l) => marks(l).length);
  const plain = (s: string) => s.replace(/[[\]]/g, "");
  // As typed means accents too: Find keeps them, so "cafe" lands on the snippet's own [café] below.
  const typed = lines.find((l) => fold(plain(l)).includes(fold(query.trim())));
  if (typed !== undefined && query.trim()) return { words: query.trim(), near: shown(plain(typed)) };
  // The line with the most matched words; the first of them on a tie.
  const line = lines.reduce<string | undefined>((best, l) => (best === undefined || marks(l).length > marks(best).length ? l : best), undefined);
  if (line === undefined) return { words: query, near: undefined };
  const near = shown(plain(line));
  const found = marks(line);
  const [first, last] = [found[0]!, found.at(-1)!];
  const stretch = plain(line.slice(first.index, last.index + last[0].length));
  if (near && stretch.length <= STRETCH) return { words: stretch, near };
  return { words: first[1]!, near };
}
