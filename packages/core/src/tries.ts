import { findAnnotation, readAnnotations, reviseAnnotation, type Annotation } from "./annotations.ts";
import { listItems, type Item } from "./items.ts";
import { paths, type Library } from "./library.ts";
import { withLock } from "./lock.ts";

// D127: techniques he plans to try on his own work (Apply-intent highlights). His plan is the note;
// checking one off records how it went (`reflection`), and enrich then drafts one Explain card from it.

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

export interface TriedInput {
  /** How it went, in his words. Empty or missing: checked off with no reflection, so no card. */
  reflection?: string;
  /** Back to "to try" (Undo): the reflection goes too, and Redo sends it again. */
  undo?: boolean;
}

/** Checks a try off with how it went, or puts it back (D127). */
export async function markTried(lib: Library, ref: string, input: TriedInput): Promise<{ tried: Annotation; item: Item; card: boolean }> {
  return withLock(paths.lock(lib), () => {
    const { item, annotation } = findAnnotation(lib, ref);
    if (annotation.intent !== "apply") throw new Error(`${annotation.id} is a ${annotation.intent} highlight, not a try`);
    const reflection = input.reflection?.trim() || undefined;
    const tried = input.undo
      ? reviseAnnotation(item, annotation, { status: "open", reflection: undefined })
      : reviseAnnotation(item, annotation, { status: "done", ...(reflection ? { reflection } : {}) });
    return { tried, item, card: !input.undo && !!tried.reflection };
  });
}
