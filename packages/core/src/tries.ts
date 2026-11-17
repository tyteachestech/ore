import { findAnnotation, readAnnotations, reviseAnnotation, type Annotation } from "./annotations.ts";
import { addSnippet } from "./ingest/index.ts";
import { listItems, type Item } from "./items.ts";
import { paths, type Library } from "./library.ts";
import { withLock } from "./lock.ts";
import { nowIso, ulid } from "./ids.ts";

// D127: techniques he plans to try on his own work (Apply-intent highlights). His plan is the note;
// checking one off records how it went (`reflection`), and enrich then drafts one Explain card from it.
// D148: "Next time I'll…" closes the round into `uses` and opens the try again with that line as its plan.
// D-new-forge: one try per skill is the one he is trying now (the one he picked last, else the oldest open);
// the rest wait. A plan is "When… I'll…", with what might get in the way. Done means it is his.

export interface TryView extends Annotation {
  item_title: string;
  /** The heading its passage sits under in the source, when there is one. */
  section?: string;
  /** With a skill: the one try of that skill he is trying now. */
  active?: boolean;
}

/** The heading above `at` in a source's Markdown; a `#` line inside a fenced code block is a comment, not a heading. */
function sectionAt(body: string, at: number): string | undefined {
  let found: string | undefined;
  let fence: string | null = null;
  let pos = 0;
  for (const line of body.split("\n")) {
    if (pos > at) break;
    const f = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if (f && (!fence || f.startsWith(fence))) fence = fence ? null : f;
    else if (!fence) found = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)?.[1] ?? found;
    pos += line.length + 1;
  }
  return found;
}

/** Times he has used a try's idea: the rounds he closed, and the last one once it is his. */
export const useCount = (a: Annotation): number => (a.uses?.length ?? 0) + (a.status === "done" ? 1 : 0);

/** Tries filed under `skill` (the skills of the source they were highlighted in): to try first, then
 *  tried; newest first in each. With a skill, one open try is `active`. */
export function listTries(lib: Library, opts: { skill?: string } = {}): TryView[] {
  const all = listItems(lib)
    .filter((i) => !opts.skill || i.meta.skills.includes(opts.skill))
    .flatMap((i) =>
      readAnnotations(i)
        .filter((a) => a.intent === "apply")
        .map((a): TryView => ({ ...a, item_title: i.meta.title, ...(a.point ? {} : { section: sectionAt(i.body, a.start) }) })),
    )
    .sort((a, b) => (a.status === b.status ? b.id.localeCompare(a.id) : a.status === "open" ? -1 : 1));
  if (!opts.skill) return all;
  const open = all.filter((t) => t.status === "open");
  // The one he picked last; before any pick, the first he marked (ids sort by time).
  const active = open.filter((t) => t.picked).sort((a, b) => b.picked!.localeCompare(a.picked!))[0] ?? open.at(-1);
  return all.map((t) => (t.id === active?.id ? { ...t, active: true } : t));
}

/** Every "how it went" he wrote on a try, earlier rounds first: what enrich drafts the card from. */
export const reflections = (a: Annotation): string[] => [...(a.uses ?? []).map((u) => u.reflection), a.reflection].filter((r): r is string => !!r);

export interface PlanInput {
  /** "I'll…": what he will do. Empty clears it, except on a try he typed, which is its plan. */
  plan?: string;
  /** "When…": the moment that cues it. Empty clears it. */
  when?: string;
  /** "If… then I'll…": what might get in the way. Empty clears it. */
  obstacle?: string;
  /** Makes it the one he is trying now (an open try only). */
  pick?: boolean;
}

/** Writes a try's plan, or picks it as the one he is trying now (D-new-forge). */
export async function planTry(lib: Library, ref: string, input: PlanInput): Promise<{ tried: Annotation; item: Item }> {
  return withLock(paths.lock(lib), () => {
    const { item, annotation } = findAnnotation(lib, ref);
    if (annotation.intent !== "apply") throw new Error(`${annotation.id} is a ${annotation.intent} highlight, not a try`);
    if (input.pick && annotation.status !== "open") throw new Error("this one is already yours; put it back to try it again");
    const text = (v: string) => v.trim() || undefined;
    if (annotation.point && input.plan !== undefined && !input.plan.trim()) throw new Error("a try needs what you'll do");
    const patch = {
      ...(input.plan !== undefined ? { note: text(input.plan) } : {}),
      ...(input.when !== undefined ? { when: text(input.when) } : {}),
      ...(input.obstacle !== undefined ? { obstacle: text(input.obstacle) } : {}),
      ...(input.pick ? { picked: ulid() } : {}),
    };
    return { tried: Object.keys(patch).length ? reviseAnnotation(item, annotation, patch) : annotation, item };
  });
}

/** A try he typed in a skill's Forge, with no passage behind it: its own snippet, kept out of the source lists. */
export async function addTry(lib: Library, input: { skill: string; plan: string; when?: string }): Promise<{ tried: Annotation; item: Item }> {
  const plan = input.plan.trim();
  if (!plan) throw new Error("a try needs what you'll do");
  const { item, annotation } = await addSnippet(lib, { text: plan, intent: "apply", note: plan, skills: [input.skill], point: true, when: input.when });
  return { tried: annotation, item };
}

export interface TriedInput {
  /** How it went, in his words. Empty or missing: checked off with no reflection, so no card. */
  reflection?: string;
  /** "Next time I'll…": the round closes into `uses` and the try is open again with this as its plan. */
  next?: string;
  /** He used it and keeps going: the round closes into `uses` and the try stays open with the same plan. */
  again?: boolean;
  /** One step back (Undo): a tried try goes back to "to try" and its reflection goes too; a try
   *  re-planned with `next` gets its last round back as it was. Redo sends the step again. */
  undo?: boolean;
}

/** Checks a try off with how it went, plans the next round, or steps back (D127, D148). */
export async function markTried(lib: Library, ref: string, input: TriedInput): Promise<{ tried: Annotation; item: Item; card: boolean }> {
  return withLock(paths.lock(lib), () => {
    const { item, annotation } = findAnnotation(lib, ref);
    if (annotation.intent !== "apply") throw new Error(`${annotation.id} is a ${annotation.intent} highlight, not a try`);
    const reflection = input.reflection?.trim() || undefined;
    const next = input.next?.trim() || undefined;
    if (input.undo) {
      const last = annotation.status === "open" && !annotation.reflection ? annotation.uses?.at(-1) : undefined;
      const tried = last
        ? reviseAnnotation(item, annotation, { status: "done", note: last.plan, reflection: last.reflection, done_at: last.ts, uses: annotation.uses!.slice(0, -1) })
        : reviseAnnotation(item, annotation, { status: "open", reflection: undefined, done_at: undefined });
      return { tried, item, card: false };
    }
    const tried = next || input.again
      ? reviseAnnotation(item, annotation, { status: "open", note: next ?? annotation.note, reflection: undefined, done_at: undefined, uses: [...(annotation.uses ?? []), { ts: nowIso(), plan: annotation.note, reflection }] })
      : reviseAnnotation(item, annotation, { status: "done", done_at: annotation.status === "done" ? annotation.done_at : nowIso(), ...(reflection ? { reflection } : {}) });
    return { tried, item, card: !!reflection };
  });
}
