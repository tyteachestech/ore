/** Saved tutor chats under the day headings Notion AI's list uses (D171): Today, Yesterday, Past 7 days,
 *  Older, by the local calendar day each was last changed, newest first within each. */
export const GROUPS = ["Today", "Yesterday", "Past 7 days", "Older"] as const;

export function chatGroups<T extends { updated: string }>(rows: T[], now = new Date()): { heading: (typeof GROUPS)[number]; rows: T[] }[] {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86400_000;
  const group = (iso: string) => {
    const t = new Date(iso).getTime();
    return !(t >= 0) ? 3 : t >= midnight ? 0 : t >= midnight - day ? 1 : t >= midnight - 6 * day ? 2 : 3;
  };
  const sorted = [...rows].sort((a, b) => b.updated.localeCompare(a.updated));
  return GROUPS.map((heading, i) => ({ heading, rows: sorted.filter((r) => group(r.updated) === i) })).filter((g) => g.rows.length);
}
