import { skillDir } from "./skill-path.ts";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { readAnnotations } from "./annotations.ts";
import { writeAtomic } from "./fsutil.ts";
import { nowIso, ulid } from "./ids.ts";
import { AiStamp, listItems, type Item } from "./items.ts";
import { paths, type Library } from "./library.ts";
import { withLock } from "./lock.ts";
import { loadSkills, type Skill } from "./skills.ts";

/** One idea of the skill, fixed before he answers: a key point of one of its sources. */
export const DigIdea = z.object({
  id: z.string(), // the key point's annotation id
  item: z.string(),
  source: z.string(),
  text: z.string(),
  /** own: in what he wrote; nudge: after the mole's question; missed: not at all. Absent until the mole has read it. */
  state: z.enum(["own", "nudge", "missed"]).optional(),
});
export type DigIdea = z.infer<typeof DigIdea>;

/** The Dig (D325): the whole skill explained from memory, the mole's one or two questions at
 *  ideas he left out, and which ideas came. No grade, no card, outside FSRS. */
export const Dig = z.object({
  id: z.string(),
  at: z.string(),
  goal: z.string(),
  text: z.string(),
  ideas: z.array(DigIdea),
  asks: z.array(z.object({ idea: z.string(), q: z.string(), answer: z.string().optional() })).optional(),
  /** Set once nothing more is asked of him: the ideas' states stand. */
  done_at: z.string().optional(),
  /** First-stage questions and own marks; absent in older records. ai remains the latest stage. */
  ask_ai: AiStamp.optional(),
  ai: AiStamp.optional(),
});
export type Dig = z.infer<typeof Dig>;

/** The most ideas one dig checks: the newest key points of the skill. */
export const DIG_IDEAS_MAX = 40;
/** Below this many key points there is nothing to check a dig against: it is saved as written. */
export const DIG_IDEAS_MIN = 2;
/** Days until a skill is ready to dig again, by how many digs it has had: a widening gap, never a due date. */
export const DIG_GAPS = [7, 14, 30, 60, 90];
/** Days after any dig before a session offers another, whatever the skill: about one a week at most. */
export const DIG_REST_DAYS = 7;

const digsPath = (lib: Library, skill: string) => join(skillDir(lib, skill), "digs.json");

export function readDigs(lib: Library, skill: string): Dig[] {
  const path = digsPath(lib, skill);
  if (!existsSync(path)) return [];
  const all = z.array(Dig).safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!all.success) throw new Error(`${path} is not a list of digs: ${all.error.issues[0]?.message}`);
  return all.data;
}
const writeDigs = (lib: Library, skill: string, digs: Dig[]) => writeAtomic(digsPath(lib, skill), `${JSON.stringify(digs, null, 2)}\n`);

/** The skill's ideas as they stand now: the key points of its sources, newest first. */
export function digIdeas(lib: Library, skill: string): DigIdea[] {
  return ideasFromItems(listItems(lib), skill);
}

function ideasFromItems(items: Item[], skill: string): DigIdea[] {
  return items
    .filter((i) => i.meta.skills.includes(skill))
    .flatMap((i) =>
      readAnnotations(i)
        .filter((a) => a.intent === "card")
        .map((a) => ({ id: a.id, item: i.meta.id, source: i.meta.title, text: (a.point ? a.note : a.exact)?.replace(/\s+/g, " ").trim() ?? "" })),
    )
    .filter((i) => i.text)
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, DIG_IDEAS_MAX);
}

export interface DigState {
  skill: string;
  goal: string | null;
  /** How many ideas a dig would be checked against now. */
  ideas: number;
  /** Has a goal, and the gap since the last dig has passed (or there is none yet). Never "overdue". */
  ready: boolean;
  last: Dig | null;
}

export function digState(lib: Library, skill: string, now = new Date()): DigState {
  const s = loadSkills(lib).skills.find((x) => x.id === skill);
  if (!s) throw new Error(`unknown skill "${skill}"`);
  return { ...readiness(lib, s, now), ideas: digIdeas(lib, skill).length };
}

/** Readiness depends on the goal and history, not on source text. */
function readiness(lib: Library, s: Skill, now: Date): Omit<DigState, "ideas"> {
  const digs = readDigs(lib, s.id);
  const last = digs.at(-1) ?? null;
  const gap = DIG_GAPS[Math.min(digs.length, DIG_GAPS.length) - 1] ?? 0;
  const ready = !!s.goal && (!last || now.getTime() - new Date(last.at).getTime() >= gap * 86_400_000);
  return { skill: s.id, goal: s.goal ?? null, ready, last };
}

/** The one skill a session may offer a dig for: ready, with ideas to check against, the one dug longest
 *  ago (never dug first); none in the week after a dig of any skill. */
export function digReady(lib: Library, skills?: string[], now = new Date()): DigState | null {
  const live = loadSkills(lib).skills.filter((s) => !s.archived).map((s) => readiness(lib, s, now));
  if (live.some((d) => d.last && now.getTime() - new Date(d.last.at).getTime() < DIG_REST_DAYS * 86_400_000)) return null;
  const eligible = live.filter((d) => (!skills?.length || skills.includes(d.skill)) && d.ready);
  if (!eligible.length) return null;
  const items = listItems(lib);
  const all = eligible.map((d) => ({ ...d, ideas: ideasFromItems(items, d.skill).length })).filter((d) => d.ideas >= DIG_IDEAS_MIN);
  return all.sort((a, b) => (a.last?.at ?? "").localeCompare(b.last?.at ?? ""))[0] ?? null;
}

/** He wrote the skill out from memory: kept with the ideas as they stood, before anything reads it. */
export function startDig(lib: Library, skill: string, text: string, now = new Date()): Promise<Dig> {
  const t = text.trim();
  if (!t) throw new Error("write what you remember first");
  return withLock(paths.lock(lib), () => {
    const { goal } = digState(lib, skill, now);
    if (!goal) throw new Error(`${skill} has no goal to dig for: ore skills set ${skill} --goal "…"`);
    const ideas = digIdeas(lib, skill);
    const dig: Dig = { id: ulid(now.getTime()), at: nowIso(now), goal, text: t, ideas, ...(ideas.length < DIG_IDEAS_MIN ? { done_at: nowIso(now) } : {}) };
    writeDigs(lib, skill, [...readDigs(lib, skill), dig]);
    return dig;
  });
}

/** Changes the skill's latest dig under the lock; `same` guards a change made from an older read. */
export function reviseDig(lib: Library, skill: string, id: string, change: (d: Dig) => Dig): Promise<Dig> {
  return withLock(paths.lock(lib), () => {
    const digs = readDigs(lib, skill);
    const i = digs.findIndex((d) => d.id === id);
    if (i === -1) throw new Error("the dig changed while the mole was reading");
    const next = change(digs[i]!);
    writeDigs(lib, skill, digs.with(i, next));
    return next;
  });
}

/** Takes a dig back (undo of writing it). */
export function dropDig(lib: Library, skill: string, id: string): Promise<void> {
  return withLock(paths.lock(lib), () => writeDigs(lib, skill, readDigs(lib, skill).filter((d) => d.id !== id)));
}

/** He is done with the mole's questions without answering (the rest of) them: what was asked and not answered didn't come. */
export function endDig(lib: Library, skill: string, id: string, now = new Date()): Promise<Dig> {
  return reviseDig(lib, skill, id, (d) => ({ ...d, ideas: d.ideas.map((i) => ({ ...i, state: i.state ?? "missed" })), done_at: d.done_at ?? nowIso(now) }));
}
