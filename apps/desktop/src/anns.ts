import type { Annotation } from "./ore";

/** A source's highlights read again from the library (a wake after a write elsewhere), merged with what is on
 *  screen: a highlight still being made (a `pending-` stand-in the library doesn't have yet) stays, and one with a
 *  change of his still saving (`busy`) keeps his copy over the library's older one. `saved` maps a stand-in to
 *  the id its save came back with, so one that has landed isn't listed twice. */
export function mergeAnns(server: Annotation[], local: Annotation[], busy: ReadonlySet<string>, saved: ReadonlyMap<string, string> = new Map()): Annotation[] {
  const mine = new Map(local.map((a) => [a.id, a]));
  const out = server.map((a) => (busy.has(a.id) && mine.get(a.id)) || a);
  const have = new Set(server.map((a) => a.id));
  for (const a of local) if (a.id.startsWith("pending-") && !have.has(saved.get(a.id) ?? "")) out.push(a);
  return out;
}
