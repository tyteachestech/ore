import { lessonsOf, nextLesson, type Item, type Tab } from "./ore";
import type { Filter } from "./filters";

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

/** Both devices group unfiltered courses by the whole course's completion. A narrowed list and
 *  Archive show its matching lessons individually (D79.2), with each lesson's own status. */
export function courseGroups(items: Item[], rows: Item[], status: Tab, filters: Filter[] = [], openCourses: string[] = []): Line[][] {
  if (status === "archived" || filters.some((f) => f.values.length)) return rows.map((item) => [{ kind: "item", item }]);
  const out: Line[][] = [];
  const seen = new Set<string>();
  for (const item of rows) {
    const c = item.course;
    if (!c) {
      out.push([{ kind: "item", item }]);
      continue;
    }
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    const lessons = lessonsOf(items, c.id);
    const next = nextLesson(lessons);
    if ((status === "done") !== !next) continue;
    const open = openCourses.includes(c.id);
    const head: Line = { kind: "course", id: c.id, title: c.title, url: c.url, lessons, next, open };
    out.push([head]);
  }
  return out;
}
