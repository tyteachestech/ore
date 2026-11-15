// A video's or recording's sections on its scrubber (D285): the outline's headings at the
// time their first word is spoken, so hovering the bar says where in the talk a point is.

export type Section = { t: number; title: string };

/** The outermost heading level the transcript has: a talk's chapters, not every sub-point. */
export function topLevel(levels: number[]): number {
  return levels.length ? Math.min(...levels) : 0;
}

/** Sections in time order, one per moment, the first kept when two headings share a time. */
export function byTime(list: Section[]): Section[] {
  const out: Section[] = [];
  for (const s of [...list].sort((a, b) => a.t - b.t)) if (s.title && (!out.length || s.t > out[out.length - 1]!.t)) out.push(s);
  return out;
}

/** The section playing at `t`: the last one that has started, or none before the first. */
export function sectionAt(list: Section[], t: number): string | undefined {
  let title: string | undefined;
  for (const s of list) {
    if (s.t > t) break;
    title = s.title;
  }
  return title;
}

/** The tip's centre along the bar, kept whole inside it. */
export function tipX(x: number, bar: number, tip: number): number {
  return Math.max(tip / 2, Math.min(x, bar - tip / 2));
}
