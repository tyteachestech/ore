/** Finder's type-select: letters typed within `TYPE_GAP` ms of each other make a prefix, and the row whose
 *  title starts with it takes the selection. The same letter typed again steps to the next row starting with
 *  it (as a list box does), so "s s s" walks the S rows. Case and accents
 *  are ignored, as in Finder. Returns the index to select, or -1 when no row matches (the selection stays). */
export const TYPE_GAP = 1000;

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trimStart();

export function typeJump(titles: string[], typed: string, from: number): number {
  const p = fold(typed);
  if (!p) return -1;
  const n = titles.length;
  const starts = (i: number, prefix: string) => fold(titles[i]!).startsWith(prefix);
  const any = (prefix: string) => titles.some((_, i) => starts(i, prefix));
  // One letter, or one letter repeated that no title starts with ("ss" with no "Ssh"): step to the next row
  // starting with that letter, after the selected one.
  if ([...p].every((c) => c === p[0]) && (p.length === 1 || !any(p))) {
    for (let k = 1; k <= n; k++) {
      const i = (((from < 0 ? -1 : from) + k) % n + n) % n;
      if (starts(i, p[0]!)) return i;
    }
    return -1;
  }
  // A longer prefix: the selected row if it still matches, else the first that does.
  if (from >= 0 && from < n && starts(from, p)) return from;
  for (let i = 0; i < n; i++) if (starts(i, p)) return i;
  return -1;
}

/** Whether a key press types a letter of a title: a printable character with no ⌘, ⌃ or ⌥. Space counts
 *  only inside a prefix already begun ("New York"), as in Finder. */
export const typesTitle = (e: { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean }, begun: boolean) =>
  !e.metaKey && !e.ctrlKey && !e.altKey && [...e.key].length === 1 && (e.key !== " " || begun);
