// How a reply's text splits into its prose and the parts that are not prose, and what a citation marker is
// there. One rule for the tutor's check and repair (core) and the app's pills and formulas, so they agree.

// Code: a fenced block (one still open, as a reply cut off mid-block, runs to the end) or an inline span. With
// math, a `$$…$$` formula too.
const CODE = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)/;
const CODE_OR_MATH = /(```[\s\S]*?(?:```|$)|`[^`\n]*`|\$\$[\s\S]*?\$\$)/;

/** The text with `f` applied to its prose only: never inside code, nor inside a `$$…$$` formula. */
export const inProse = (text: string, f: (prose: string) => string, { math = true } = {}) =>
  text.split(math ? CODE_OR_MATH : CODE).map((part, at) => (at % 2 ? part : f(part))).join("");

// A citation marker, [n], with the space before it, never in code or a formula, nor starting a Markdown link.
const ANY = / ?\[(\d+)\](?!\()/g;
const WORD = /[\p{L}\p{N}_]/u;

/** Each citation marker in a reply's prose, given to `f` (the marker as written, its number), which returns what
 *  stands in its place. A [n] glued right after a letter, digit or _ is a marker only when the reply has citation
 *  n (`has`): models often write "claim[1]", while `arr[2]` with no citation 2 is an index, the reply's own words
 *  (F-new-code-index-marker, F-new-pill-on-index). [0] is passed on; callers drop it. */
export const eachMarker = (text: string, has: (n: number) => boolean, f: (marker: string, n: number) => string) =>
  inProse(text, (prose) =>
    prose.replace(ANY, (all: string, n: string, at: number) => {
      const glued = !all.startsWith(" ") && WORD.test(prose[at - 1] ?? "");
      return glued && !has(Number(n)) ? all : f(all, Number(n));
    }),
  );

/** The numbers of the markers in a reply's prose. */
export const markerNumbers = (text: string, has: (n: number) => boolean): number[] => {
  const ns: number[] = [];
  eachMarker(text, has, (all, n) => (ns.push(n), all));
  return ns;
};
