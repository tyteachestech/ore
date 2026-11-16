// Where a passage of the text sits among a PDF page's own runs of words (D-new-original-lit), so the Original
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
  // Three probes along the passage: a formula or footnote mark in one part of it must not lose the rest.
  const size = Math.min(32, want.length);
  let from = -1;
  for (const at of want.length <= size ? [0] : [0, Math.floor((want.length - size) / 2), want.length - size]) {
    const found = page.indexOf(want.slice(at, at + size));
    if (found < 0) continue;
    const start = Math.max(0, found - at);
    // Words that come again elsewhere on the page say nothing about where he is (a passage may repeat itself).
    const again = page.indexOf(want.slice(at, at + size), found + 1);
    if (again >= 0 && again >= start + want.length) continue;
    from = start;
    break;
  }
  if (from < 0) return null;
  const to = Math.min(page.length, from + want.length) - 1;
  const run = (pos: number) => {
    let lo = 0, hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid]! <= pos) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  let a = run(from);
  // An empty run (a space of its own) shares its start with the next: begin at the one that has the words.
  while (a < runs.length - 1 && starts[a + 1] === starts[a]) a++;
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
