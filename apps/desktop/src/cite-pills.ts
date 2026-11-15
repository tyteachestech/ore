import { eachMarker } from "../../../packages/core/src/markers";

// How a tutor reply's citations read (ChatGPT's desktop app): each run of [n] markers becomes one small
// pill named for its source, "britannica +1" for a run of two, with the passage or page on hover.

/** A site's name as people say it: "britannica.com" → "britannica", "en.wikipedia.org" → "wikipedia",
 *  "bbc.co.uk" → "bbc". */
export function siteName(site: string): string {
  if (/^[\d.]+$|:/.test(site)) return site; // an address, not a name
  const parts = site.toLowerCase().replace(/^www\./, "").split(".").filter(Boolean);
  // A country's second level (co.uk, com.au, ac.jp) is part of the ending, not the name.
  if (parts.length > 2 && parts.at(-1)!.length === 2 && /^(?:co|com|ac|gov|go|gob|org|net|edu|ne|or)$/.test(parts.at(-2)!)) parts.pop();
  return parts.length > 1 ? parts.at(-2)! : (parts[0] ?? site);
}

/** The reply's Markdown with each run of markers ("[1]", "[1][2]", "[1] [2]") as one link to `#cite-1,2`, which
 *  the reply renders as a pill. A marker is as the tutor's check reads one (core's `eachMarker`): never in code
 *  or a formula, nor a [n] that starts a Markdown link, and glued to a word ("again[1]") only when the reply has
 *  citation n (`has`), so `arr[2]` with no citation 2 keeps its brackets. */
export const citeRuns = (text: string, has: (n: number) => boolean = () => false) =>
  eachMarker(text, has, (all, n) => `${all.startsWith(" ") ? " " : ""}\u0000${n}\u0001`).replace(
    /(?:[ \t]?\u0000\d+\u0001)+/g,
    (run) => ` [·](#cite-${[...new Set(run.match(/\d+/g)!)].join(",")})`,
  );
