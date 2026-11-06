import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { appendJsonl, deviceLog, readJsonl, visible } from "./fsutil.ts";
import { paths, type Library } from "./library.ts";

export const FsrsStateSchema = z.object({
  due: z.string(),
  stability: z.number(),
  difficulty: z.number(),
  elapsed_days: z.number(),
  scheduled_days: z.number(),
  reps: z.number(),
  lapses: z.number(),
  learning_steps: z.number().optional(),
  state: z.number(),
  last_review: z.string().optional(),
});
export type FsrsState = z.infer<typeof FsrsStateSchema>;

export const ReviewSchema = z.object({
  ts: z.string(),
  card: z.string(),
  session: z.string().optional(),
  confidence: z.number().int().min(1).max(3),
  answer: z.string().optional(),
  ai_rating: z.number().int().min(1).max(4).optional(),
  rating: z.number().int().min(1).max(4),
  elapsed_ms: z.number().int().nonnegative().optional(),
  state_before: FsrsStateSchema,
  state_after: FsrsStateSchema,
  finishing: z.boolean().optional(),
  variant: z.string().optional(), // the remixed version shown (D66); absent for the original
  in_head: z.boolean().optional(), // an Explain card answered in his head, self-marked (D68)
});
export type Review = z.infer<typeof ReviewSchema>;

/** A taken-back review (`ore review --undo`): appended, so the log is never rewritten (a synced
 *  folder would turn a rewrite racing another device's append into a conflicted copy). */
export const UndoSchema = z.object({ ts: z.string(), card: z.string(), undo: z.string() });
export type Undo = z.infer<typeof UndoSchema>;

/** The month logs: `2026-10.jsonl` from before, one per device (`2026-10.<device>.jsonl`), and any
 *  conflicted copy a synced folder made. */
export function reviewLogFiles(lib: Library): string[] {
  const dir = paths.reviews(lib);
  if (!existsSync(dir)) return [];
  return visible(dir).filter((f) => /^\d{4}-\d{2}\b.*\.jsonl$/.test(f)).sort().map((f) => join(dir, f));
}

// All reviews, oldest first, without the ones taken back. The log is the source of truth for
// scheduling. A review is named by its card and time, so one read twice (a conflicted copy) counts once.
export function readReviews(lib: Library): Review[] {
  // A line without its card and time (a hand edit) can't be placed in the replay, so it is skipped.
  const lines = reviewLogFiles(lib)
    .flatMap((f) => readJsonl<Review | Undo>(f))
    .filter((l) => typeof l.card === "string" && typeof l.ts === "string" && ("undo" in l ? typeof l.undo === "string" : typeof l.rating === "number"));
  const undone = new Set(lines.flatMap((l) => ("undo" in l ? [`${l.card}|${l.undo}`] : [])));
  const seen = new Set<string>();
  return lines
    .filter((l): l is Review => {
      if ("undo" in l) return false;
      const key = `${l.card}|${l.ts}`;
      if (undone.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.ts.localeCompare(b.ts));
}

export function appendReview(lib: Library, r: Review): void {
  appendJsonl(deviceLog(paths.reviewLog(lib, new Date(r.ts))), ReviewSchema.parse(r));
}

export function appendUndo(lib: Library, u: Undo): void {
  appendJsonl(deviceLog(paths.reviewLog(lib, new Date(u.ts))), UndoSchema.parse(u));
}
