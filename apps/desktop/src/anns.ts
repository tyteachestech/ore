import type { Annotation } from "./ore";

/** A source's highlights read again from the library (a wake after a write elsewhere), merged with what is on
 *  screen. It keeps two things: a highlight still being made (a `pending-` stand-in the library doesn't have
 *  yet; `saved` maps a stand-in whose save has landed to its id, so it isn't listed twice), and a highlight still on
 *  screen with a write of his in flight (`busy`), whose copy wins over the library's older one. It does not
 *  cover two cases: a highlight whose save landed after this read began can still be dropped by the older read, and
 *  one he just removed or brought back with ⌘Z can flip back until its write lands. */
export function mergeAnns(server: Annotation[], local: Annotation[], busy: ReadonlySet<string>, saved: ReadonlyMap<string, string> = new Map()): Annotation[] {
  const mine = new Map(local.map((a) => [a.id, a]));
  const out = server.map((a) => (busy.has(a.id) && mine.get(a.id)) || a);
  const have = new Set(server.map((a) => a.id));
  for (const a of local) if (a.id.startsWith("pending-") && !have.has(saved.get(a.id) ?? "")) out.push(a);
  return out;
}
