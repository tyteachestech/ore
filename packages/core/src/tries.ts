import { findAnnotation, readAnnotations, reviseAnnotation, type Annotation } from "./annotations.ts";
import { listItems, type Item } from "./items.ts";
import { paths, type Library } from "./library.ts";
import { withLock } from "./lock.ts";
import { nowIso } from "./ids.ts";

// D127: techniques he plans to try on his own work (Apply-intent highlights). His plan is the note;
// checking one off records how it went (`reflection`), and enrich then drafts one Explain card from it.
// D148: "Next time I'll…" closes the round into `uses` and opens the try again with that line as its plan.

export interface TryView extends Annotation {
  item_title: string;
}

/** Tries filed under `skill` (the skills of the source they were highlighted in): to try first, then
 *  tried; newest first in each. */
export function listTries(lib: Library, opts: { skill?: string } = {}): TryView[] {
  return listItems(lib)
    .filter((i) => !opts.skill || i.meta.skills.includes(opts.skill))
    .flatMap((i) => readAnnotations(i).filter((a) => a.intent === "apply").map((a) => ({ ...a, item_title: i.meta.title })))
    .sort((a, b) => (a.status === b.status ? b.id.localeCompare(a.id) : a.status === "open" ? -1 : 1));
}

/** Every "how it went" he wrote on a try, earlier rounds first: what enrich drafts the card from. */
export const reflections = (a: Annotation): string[] => [...(a.uses ?? []).map((u) => u.reflection), a.reflection].filter((r): r is string => !!r);

export interface TriedInput {
  /** How it went, in his words. Empty or missing: checked off with no reflection, so no card. */
  reflection?: string;
  /** "Next time I'll…": the round closes into `uses` and the try is open again with this as its plan. */
  next?: string;
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
        ? reviseAnnotation(item, annotation, { status: "done", note: last.plan, reflection: last.reflection, uses: annotation.uses!.slice(0, -1) })
        : reviseAnnotation(item, annotation, { status: "open", reflection: undefined });
      return { tried, item, card: false };
    }
    const tried = next
      ? reviseAnnotation(item, annotation, { status: "open", note: next, reflection: undefined, uses: [...(annotation.uses ?? []), { ts: nowIso(), plan: annotation.note, reflection }] })
      : reviseAnnotation(item, annotation, { status: "done", ...(reflection ? { reflection } : {}) });
    return { tried, item, card: !!reflection };
  });
}
