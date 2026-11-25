// Where a passage of the text sits among a PDF page's own runs of words (D315), so the Original
// tab can light it. The approach is Lector's (anaralabs/lector, MIT): match on the page's text layer, with
// everything but letters and digits dropped, since import rejoins hyphens, spaces and ligatures its own way.

const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/** The first and last of `runs` (a page's text items, in order) that hold `text`, or null when the page has no
 *  such words: a scan, a formula import rewrote, a table read by its cells. Never a guess. */
export function passage(runs: string[], text: string): [number, number] | null {
  const want = norm(text);
  if (want.length < 4) return null;
  const starts: number[] = [];
  let page = "";
  for (const r of runs) {
    starts.push(page.length);
    page += norm(r);
  }
  // Three probes along the passage: its start, middle and end. Import and the page spell a formula or a footnote
  // mark differently, so the two texts are not the same length: the place runs from the first probe the page
  // holds to the last, and never past what was found. A probe that comes again elsewhere on the page says
  // nothing about where he is (a passage may repeat itself, within its own length).
  const size = Math.min(32, want.length);
  let from = -1, to = -1, wantFrom = 0, wantTo = 0;
  for (const at of want.length <= size ? [0] : [0, Math.floor((want.length - size) / 2), want.length - size]) {
    const probe = want.slice(at, at + size);
    const first = page.indexOf(probe), last = page.lastIndexOf(probe);
    if (first < 0 || last - first >= want.length) continue;
    if (from < 0) [from, wantFrom] = [first, at];
    if (last >= from && last + size - 1 > to) [to, wantTo] = [last + size - 1, at + size - 1];
  }
  if (from < 0 || to < from) return null;
  // Endpoints alone do not establish a passage: a PDF's runs can alternate columns, and then the page holds
  // about twice the letters between the probes that the passage does. A fifth more is a formula or a footnote
  // mark spelled another way; asking for the very same letters lit nothing on a real textbook page.
  if (to - from + 1 > (wantTo - wantFrom + 1) * 1.2 + 4) return null;
  /** The run that holds a place in the page's letters: the last one starting at or before it. */
  const run = (pos: number) => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid]! <= pos) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  const a = run(from);
  return [a, Math.max(a, run(to))];
}

export type Box = { left: number; top: number; width: number; height: number };

/** Runs' boxes joined a line at a time: one bar per line of the passage, as a marker pen draws it. */
export function lines(boxes: Box[]): Box[] {
  const out: Box[] = [];
  for (const b of boxes) {
    if (b.width <= 0 || b.height <= 0) continue;
    const last = out[out.length - 1];
    // The same line: the tops agree within half a line's height, and it carries on to the right.
    if (last && Math.abs(last.top - b.top) < Math.min(last.height, b.height) / 2 && b.left >= last.left) {
      const right = Math.max(last.left + last.width, b.left + b.width);
      const top = Math.min(last.top, b.top);
      last.height = Math.max(last.top + last.height, b.top + b.height) - top;
      last.top = top;
      last.width = right - last.left;
    } else out.push({ ...b });
  }
  return out;
}
