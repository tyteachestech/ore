import type { Item } from "./ore";

// Filters on All sources (D286), Linear's: each field narrows by any of its values
// picked, and fields narrow together.

export type Field = "kind" | "skill" | "author";
export type Filter = { field: Field; values: string[] };
export type Option = { value: string; label: string; n: number };

export const FIELDS: { id: Field; label: string; plural: string }[] = [
  { id: "kind", label: "Kind", plural: "kinds" },
  { id: "skill", label: "Skill", plural: "skills" },
  { id: "author", label: "Author", plural: "authors" },
];

/** Source kinds as he would say them, on the rows, in Add and in the filter alike. */
const KINDS: Record<string, string> = { article: "Article", youtube: "Video", pdf: "PDF", epub: "Book", markdown: "Text", snippet: "Snippet" };
export const kindLabel = (type: string) => KINDS[type] ?? type.charAt(0).toUpperCase() + type.slice(1);

/** No skill is a value of its own, so the unfiled can be found. */
export const NO_SKILL = "";

/** The list is narrowed to the sources with no skill and by nothing else: the sidebar's No skill row is lit. */
export const onlyNoSkill = (filters: Filter[]) => filters.length === 1 && filters[0]!.field === "skill" && filters[0]!.values.length === 1 && filters[0]!.values[0] === NO_SKILL;

function valuesOf(i: Item, field: Field): string[] {
  if (field === "kind") return [i.type];
  if (field === "skill") return i.skills.length ? i.skills : [NO_SKILL];
  return i.author?.trim() ? [i.author.trim()] : [];
}

export const passes = (i: Item, filters: Filter[]) => filters.every((f) => !f.values.length || valuesOf(i, f.field).some((v) => f.values.includes(v)));

/** A field's values among `items`, most sources first, each with how many it would show. */
export function options(items: Item[], field: Field, skillName: (id: string) => string): Option[] {
  const n = new Map<string, number>();
  for (const i of items) for (const v of valuesOf(i, field)) n.set(v, (n.get(v) ?? 0) + 1);
  const label = (v: string) => (field === "kind" ? kindLabel(v) : field === "skill" ? (v === NO_SKILL ? "No skill" : skillName(v)) : v);
  return [...n].map(([value, k]) => ({ value, label: label(value), n: k })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
}

/** `filters` with `value` picked or let go in `field`; a field left with nothing picked goes, unless `keep`
 *  (its list is open: the chip it opened from stays until the list closes, as Linear's does). */
export function toggle(filters: Filter[], field: Field, value: string, keep = false): Filter[] {
  const at = filters.findIndex((f) => f.field === field);
  if (at < 0) return [...filters, { field, values: [value] }];
  const was = filters[at]!.values;
  const values = was.includes(value) ? was.filter((v) => v !== value) : [...was, value];
  return values.length || keep ? filters.map((f, i) => (i === at ? { field, values } : f)) : filters.filter((_, i) => i !== at);
}

/** Filters with the fields left empty while a list was open taken out. */
export const settled = (filters: Filter[]) => (filters.some((f) => !f.values.length) ? filters.filter((f) => f.values.length) : filters);

/** What a chip says it holds: the one value, or how many. */
export function summary(f: Filter, label: (v: string) => string): string {
  if (!f.values.length) return "any";
  if (f.values.length === 1) return label(f.values[0]!);
  return `${f.values.length} ${FIELDS.find((x) => x.id === f.field)!.plural}`;
}
