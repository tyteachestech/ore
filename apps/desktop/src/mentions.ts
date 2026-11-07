/** A source or skill he pointed the tutor at by typing @. */
export type Mention = { kind: "source" | "skill"; id: string; name: string };

/** What @ lists: skills, then sources, those whose name starts with the query first, eight at most. */
export function mentionMatches(query: string, sources: { id: string; title: string }[], skills: { id: string; name: string }[], taken: Mention[]): Mention[] {
  const q = query.toLowerCase();
  const all: Mention[] = [...skills.map((s) => ({ kind: "skill" as const, id: s.id, name: s.name })), ...sources.map((s) => ({ kind: "source" as const, id: s.id, name: s.title }))];
  const free = all.filter((m) => !taken.some((t) => t.kind === m.kind && t.id === m.id));
  const at = (m: Mention) => m.name.toLowerCase().indexOf(q);
  const words = (m: Mention) => m.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q));
  const rank = (m: Mention) => (at(m) === 0 ? 0 : words(m) ? 1 : 2);
  return free.filter((m) => at(m) >= 0).sort((a, b) => rank(a) - rank(b)).slice(0, 8);
}
