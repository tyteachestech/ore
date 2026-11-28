import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { appendJsonl, deviceLog, readJsonl, visible } from "./fsutil.ts";
import { AiStamp } from "./items.ts";
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
  ai: AiStamp.optional(), // who suggested ai_rating: vendor, model, prompt version

  rating: z.number().int().min(1).max(4),
  elapsed_ms: z.number().int().nonnegative().optional(),
  state_before: FsrsStateSchema,
  state_after: FsrsStateSchema,
  finishing: z.boolean().optional(),
  variant: z.string().optional(), // the remixed version shown (D66); absent for the original
  in_head: z.boolean().optional(), // an Explain card answered in his head, self-marked (D68)
  cued: z.number().int().min(1).max(2).optional(), // how many hints he took before answering (D-new-hint-before-no-idea)
});
export type Review = z.infer<typeof ReviewSchema>;

/** A taken-back review (`ore review --undo`): appended, so the log is never rewritten (a synced
 *  folder would turn a rewrite racing another device's append into a conflicted copy). `of` names the one
 *  review line it takes back (`lineId`), since two devices can rate a card in the same millisecond; an undo
 *  without it (an older build) takes back every review of that card at that time. */
export const UndoSchema = z.object({ ts: z.string(), card: z.string(), undo: z.string(), of: z.string().optional() });
export type Undo = z.infer<typeof UndoSchema>;

/** A short name for one review line, as read from the log. */
export const lineId = (r: Review): string => createHash("sha256").update(JSON.stringify(r)).digest("hex").slice(0, 16);

// What a review line needs to be replayed: looser than ReviewSchema, so a line from an older build still counts,
// but a rating outside 1–4 or a missing state (which stopped every screen) doesn't.
const Replayable = z.object({ ts: z.string(), card: z.string(), rating: z.number().int().min(1).max(4), state_before: z.object({}), state_after: z.object({}) });

/** The month logs: `2026-10.jsonl` from before, one per device (`2026-10.<device>.jsonl`), and any
 *  conflicted copy a synced folder made. */
export function reviewLogFiles(lib: Library): string[] {
  const dir = paths.reviews(lib);
  if (!existsSync(dir)) return [];
  return visible(dir).filter((f) => /^\d{4}-\d{2}\b.*\.jsonl$/.test(f)).sort().map((f) => join(dir, f));
}

// All reviews, oldest first, without the ones taken back. The log is the source of truth for
// scheduling. A review is counted once per distinct line, so one read twice (a conflicted copy) counts
// once, while two devices' ratings of a card in the same millisecond both count. An undo names its
// review by card, time and line (`lineId`); a new review never takes a time its card already has here (`reviewTimes`).
/** The last read, kept while no log file changed (the logs only grow): one command often reads them
 *  several times (Home's Today, a skill page's stats), and 4,000 reviews take ~25 ms to parse.
 *  Callers share its Review objects, so they read them and never change them. */
let last: { key: string; reviews: Review[]; times: Map<string, Set<string>> } | null = null;

/** Every time a card has a review at in the logs, taken back or not. */
export function reviewTimes(lib: Library, card: string): ReadonlySet<string> {
  readReviews(lib);
  return last!.times.get(card) ?? new Set();
}

export function readReviews(lib: Library): Review[] {
  const files = reviewLogFiles(lib);
  const key = [lib.root, ...files.map((f) => {
    // A file a sync removes after the listing (a conflicted copy) reads as empty, as it did before.
    try {
      const s = statSync(f);
      return `${f}|${s.mtimeMs}|${s.size}`;
    } catch {
      return `${f}|gone`;
    }
  })].join("\n");
  if (last?.key !== key) last = { key, ...parseReviews(files) };
  return [...last.reviews];
}

function parseReviews(files: string[]): { reviews: Review[]; times: Map<string, Set<string>> } {
  // A line that isn't a whole review or undo (a hand edit, a rating of 5, a state cut off) can't be
  // replayed, so it is skipped rather than stopping every screen; `ore doctor` names it.
  const lines = files
    .flatMap((f) => readJsonl<unknown>(f))
    .filter((l): l is Review | Undo => (l && typeof l === "object" && "undo" in l ? UndoSchema : Replayable).safeParse(l).success);
  const undone = new Set(lines.flatMap((l) => ("undo" in l && !l.of ? [`${l.card}|${l.undo}`] : [])));
  const undoneLines = new Map<string, Set<string>>();
  for (const l of lines) if ("undo" in l && l.of) undoneLines.set(`${l.card}|${l.undo}`, (undoneLines.get(`${l.card}|${l.undo}`) ?? new Set()).add(l.of));
  const seen = new Set<string>();
  const times = new Map<string, Set<string>>();
  const reviews = lines
    .filter((l): l is Review => {
      if ("undo" in l) return false;
      const own = times.get(l.card);
      if (own) own.add(l.ts);
      else times.set(l.card, new Set([l.ts]));
      const line = JSON.stringify(l);
      if (undone.has(`${l.card}|${l.ts}`) || seen.has(line)) return false;
      if (undoneLines.get(`${l.card}|${l.ts}`)?.has(lineId(l))) return false;
      seen.add(line);
      return true;
    })
    .sort((a, b) => a.ts.localeCompare(b.ts));
  return { reviews, times };
}

export function appendReview(lib: Library, r: Review): void {
  appendJsonl(deviceLog(paths.reviewLog(lib, new Date(r.ts))), ReviewSchema.parse(r));
}

export function appendUndo(lib: Library, u: Undo): void {
  appendJsonl(deviceLog(paths.reviewLog(lib, new Date(u.ts))), UndoSchema.parse(u));
}
