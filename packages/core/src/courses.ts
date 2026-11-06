import { listItems, setItemArchived, updateItemMeta, type Item } from "./items.ts";
import type { Library } from "./library.ts";
import { setItemSkills } from "./skills.ts";

// A course's lessons are sources that share `course.id` (D79); the course has no file of its own, so
// each change below is made on every lesson.

/** A course's lessons in course order; with `archived`, archived lessons too. */
export function courseLessons(lib: Library, id: string, opts: { archived?: boolean } = {}): Item[] {
  const all = opts.archived ? [...listItems(lib), ...listItems(lib, { archived: true })] : listItems(lib);
  const lessons = all.filter((i) => i.meta.course?.id === id).sort((a, b) => a.meta.course!.part - b.meta.course!.part);
  if (!lessons.length) throw new Error(`no course matches "${id}"`);
  return lessons;
}

/** Renames a course on every lesson. */
export async function renameCourse(lib: Library, id: string, title: string): Promise<Item[]> {
  const t = title.trim();
  if (!t) throw new Error("a course needs a title");
  const lessons = courseLessons(lib, id, { archived: true });
  for (const l of lessons) await updateItemMeta(lib, l.meta.id, (m) => ({ ...m, course: { ...m.course!, title: t } }));
  return courseLessons(lib, id, { archived: true });
}

/** Files every lesson under exactly these skills (their cards follow, as for one source). */
export async function setCourseSkills(lib: Library, id: string, skills: string[]): Promise<Item[]> {
  for (const l of courseLessons(lib, id, { archived: true })) await setItemSkills(lib, l.meta.id, skills);
  return courseLessons(lib, id, { archived: true });
}

/** Archives every lesson (files and cards kept), or brings them all back. */
export async function setCourseArchived(lib: Library, id: string, archived: boolean): Promise<number> {
  const lessons = courseLessons(lib, id, { archived: true }).filter((l) => !!l.meta.archived_at !== archived);
  for (const l of lessons) await setItemArchived(lib, l.meta.id, archived);
  return lessons.length;
}
