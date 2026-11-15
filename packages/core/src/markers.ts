// How a reply's text splits into its prose and the parts that are not prose, and what a citation marker is
// there. One rule for the tutor's check and repair (core) and the app's pills and formulas, so they agree.

// Code: a fenced block (one still open, as a reply cut off mid-block, runs to the end) or an inline span. With
// math, a `$$…$$` formula too.
const CODE = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)/;
const CODE_OR_MATH = /(```[\s\S]*?(?:```|$)|`[^`\n]*`|\$\$[\s\S]*?\$\$)/;

/** The text with `f` applied to its prose only: never inside code, nor inside a `$$…$$` formula. */
export const inProse = (text: string, f: (prose: string) => string, { math = true } = {}) =>
  text.split(math ? CODE_OR_MATH : CODE).map((part, at) => (at % 2 ? part : f(part))).join("");

/** A citation marker, [n], with the space before it: never right after a letter, digit or _, where `arr[2]`
 *  is an index, nor in code or a formula (F-new-code-index-marker). [0] matches; callers drop it. */
export const MARKER = / ?(?<![\p{L}\p{N}_])\[(\d+)\]/gu;

/** The numbers of the markers in a reply's prose. */
export const markerNumbers = (text: string): number[] => {
  const ns: number[] = [];
  inProse(text, (prose) => {
    for (const m of prose.matchAll(MARKER)) ns.push(Number(m[1]));
    return prose;
  });
  return ns;
};
