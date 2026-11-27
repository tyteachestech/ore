import type { Item } from "./ore";

/** Replace just the requested rows, including moves between the live and Archive lists. */
export function mergeSourceRows(before: Item[] | null, rows: Item[], ids: readonly string[], archived: boolean): Item[] {
  const touched = new Set(ids);
  const incoming = new Map(rows.filter((i) => !!i.archived_at === archived).map((i) => [i.id, i]));
  const result = (before ?? []).flatMap((i) => {
    if (!touched.has(i.id)) return [i];
    const next = incoming.get(i.id);
    incoming.delete(i.id);
    return next ? [next] : [];
  });
  return [...result, ...incoming.values()];
}
