import type { Item } from "./ore";

/** A line of a source list: a source, or a course (D79) standing for its lessons, listed under it when open. */
export type Line = { kind: "item"; item: Item; lesson?: boolean } | { kind: "course"; id: string; title: string; url?: string; lessons: Item[]; next: Item | null; open: boolean };
export const lineKey = (l: Line) => (l.kind === "item" ? l.item.id : `course:${l.id}`);
/** The row of `now` that came after `key` in `was` (else the nearest before it), for a row that left the list.
 *  A lesson that left because its course was collapsed hands it to the course, as Finder does for a folder. */
export const lineAfter = (was: Line[], now: Line[], key: string): Line | undefined => {
  const at = was.findIndex((l) => lineKey(l) === key);
  if (at < 0) return undefined;
  const here = new Map(now.map((l) => [lineKey(l), l]));
  const gone = was[at]!;
  const head = gone.kind === "item" && gone.lesson && gone.item.course ? here.get(`course:${gone.item.course.id}`) : undefined;
  if (head?.kind === "course" && !head.open) return head;
  for (const l of [...was.slice(at + 1), ...was.slice(0, at).reverse()]) if (here.has(lineKey(l))) return here.get(lineKey(l));
  return undefined;
};
