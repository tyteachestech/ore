import { annotationRevs } from "./annotations.ts";
import { findCard } from "./cards.ts";
import { withIndex, type CardRow, type LibraryIndex } from "./db.ts";
import { latestRevs } from "./fsutil.ts";
import { itemDirs } from "./items.ts";
import { localDay, nowIso } from "./ids.ts";
import { paths, type Library } from "./library.ts";
import { withLock } from "./lock.ts";
import { orderQueue, type QueueEntry } from "./queue.ts";
import { findVariant } from "./remix.ts";
import { appendReview, appendUndo, readReviews, type FsrsState, type Review } from "./reviews.ts";
import { emptyState, loadParams, nextState, replay, retrievability } from "./scheduler.ts";
import { openSessionId, readSessions } from "./sessions.ts";
import { cardPriority, desiredRetention, loadSkills, reviewSettings } from "./skills.ts";
import { retentionMetric } from "./stats.ts";

export interface ReviewInput {
  rating: 1 | 2 | 3 | 4;
  confidence: number;
  answer?: string;
  ai_rating?: number;
  elapsed_ms?: number;
  finishing?: boolean;
  session?: string;
  /** The remixed version shown (D66); its review updates the card's one schedule. */
  variant?: string;
  /** Answered in his head and self-marked (D68). */
  in_head?: boolean;
  now?: Date;
}

export interface ReviewResult {
  card: string;
  /** The logged review's time, which names it for `undoReview`. */
  ts: string;
  rating: number;
  due_next: string;
  state_after: FsrsState;
  finishing: boolean;
  session: string | null;
}

// Log one review. A draft's first review is its finishing step (D20): the
// card goes live. FSRS state before the review is replayed from the log.
export async function recordReview(lib: Library, cardRef: string, input: ReviewInput): Promise<ReviewResult> {
  return withLock(paths.lock(lib), () => {
    const card = findCard(lib, cardRef);
    if (card.meta.state === "retired") throw new Error(`card ${card.meta.id} is retired`);
    const retention = desiredRetention(card.meta.skills, loadSkills(lib).skills);
    const w = loadParams(lib);
    const prior = readReviews(lib).filter((r) => r.card === card.meta.id);
    const now = input.now ?? new Date();
    const before = replay(prior, retention, w) ?? emptyState(now);
    // A review synced from a device whose clock ran ahead can be dated after now. The review is logged
    // now; FSRS counts the time since that one as none, rather than refusing time that runs backwards.
    const last = before.last_review ? new Date(before.last_review) : now;
    const after = nextState(before, last > now ? last : now, input.rating, retention, w);
    // A draft's first review finishes it; it counts as live from then on (the index reads that from the
    // log), so the card file is only written when its text changes.
    const finishing = card.meta.state === "draft" && prior.length === 0;
    const variant = input.variant ? findVariant(lib, card.meta.id, input.variant).id : undefined;
    const session = input.session ?? openSessionId(lib) ?? undefined;
    const review: Review = {
      ts: nowIso(now),
      card: card.meta.id,
      session,
      confidence: input.confidence,
      answer: input.answer,
      ai_rating: input.ai_rating,
      rating: input.rating,
      elapsed_ms: input.elapsed_ms,
      state_before: before,
      state_after: after,
      finishing: finishing || undefined,
      variant,
      in_head: input.in_head || undefined,
    };
    appendReview(lib, review);
    return { card: card.meta.id, ts: review.ts, rating: input.rating, due_next: after.due, state_after: after, finishing, session: session ?? null };
  });
}

// Take back a mis-tapped rating: the card's latest review only, so replay stays true. The log gets an
// undo record rather than losing the line; a draft whose finishing review is taken back is a draft again.
// A review dated after now (another device's clock ahead) was not given since, so it doesn't stand in the way.
export async function undoReview(lib: Library, cardRef: string, ts: string, now = new Date()): Promise<void> {
  return withLock(paths.lock(lib), () => {
    const card = findCard(lib, cardRef);
    const own = readReviews(lib).filter((r) => r.card === card.meta.id);
    const since = own.filter((r) => r.ts > ts && Date.parse(r.ts) <= now.getTime());
    if (!own.some((r) => r.ts === ts) || since.length) throw new Error(`the review at ${ts} is not ${card.meta.id}'s latest`);
    appendUndo(lib, { ts: nowIso(now), card: card.meta.id, undo: ts });
  });
}


export const ACTIVE_CAP_MS = 3 * 60_000; // one card adds at most 3 minutes of active time
const DEFAULT_MS = { card: 20_000, prompt: 90_000 }; // per card until 50 reviews of that kind
/** Active review time of these reviews (D60). */
export const activeMs = (rs: Review[]) => rs.reduce((t, r) => t + Math.min(r.elapsed_ms ?? 0, ACTIVE_CAP_MS), 0);

/** Typical time for one card of a kind: the median of his last 200 reviews of it, once there are 50. */
export function medianMs(rs: Review[], kind: "card" | "prompt", kinds: Map<string, string>): number {
  const xs = rs.filter((r) => kinds.get(r.card) === kind && r.elapsed_ms).slice(-200).map((r) => Math.min(r.elapsed_ms!, ACTIVE_CAP_MS)).sort((a, b) => a - b);
  return xs.length >= 50 ? xs[Math.floor(xs.length / 2)]! : DEFAULT_MS[kind];
}

/** `medianMs` for both kinds at once, for loops over the queue. */
export const medians = (rs: Review[], kinds: Map<string, string>): Record<"card" | "prompt", number> => ({ card: medianMs(rs, "card", kinds), prompt: medianMs(rs, "prompt", kinds) });

export interface QueueOptions {
  /** Only cards filed under one of these skills (Home's skill chips, D58); all when absent. */
  skills?: string[];
  /** Apply the new-card limits (D60, D65, D144): at most `new_per_day`, and none drafted today. On by default. */
  newLimit?: boolean;
}

/** One card in this many is new while due cards last (D144). */
const NEW_EVERY = 5;

// Due queue (SPEC §3): live cards due now in queue order, with unseen drafts (freshest source first,
// D60) taking every fifth place, and today's pending relearn passes last. A draft waits until the day
// after it was written, so its first review is spaced from the reading (D65). Up to `new_per_day` a day.
export function dueQueue(lib: Library, now = new Date(), opts: QueueOptions = {}, open?: LibraryIndex): QueueEntry[] {
  return withIndex(lib, open, (index) => {
    const skills = loadSkills(lib).skills;
    const w = loadParams(lib);
    const items = new Map(index.items().map((i) => [i.id, i]));
    const reviews = readReviews(lib);
    const today = localDay(now);
    const doneToday = reviews.filter((r) => localDay(r.ts) === today);
    // Relearn passes are owed for misses today, or since the open session began if that was earlier (a
    // session running past midnight).
    const session = openSessionId(lib);
    const began = session ? readSessions(lib).find((s) => s.type === "start" && s.id === session)?.ts : undefined;
    const ownToday = new Map<string, Review[]>();
    for (const r of reviews) {
      if (localDay(r.ts) !== today && !(began && r.ts >= began)) continue;
      const own = ownToday.get(r.card);
      if (own) own.push(r);
      else ownToday.set(r.card, [r]);
    }
    const settings = reviewSettings(lib);
    const limit = opts.newLimit !== false;
    const newLeft = limit ? Math.max(0, settings.new_per_day - doneToday.filter((r) => r.finishing).length) : Infinity;
    const picked = opts.skills && new Set(opts.skills);

    const entries: QueueEntry[] = [];
    const unseen: { entry: QueueEntry; fresh: string }[] = [];
    const cards = index.cards();
    for (const c of cards) {
      if (c.state === "retired") continue;
      if (picked && !c.skills.some((s) => picked.has(s))) continue;
      // A miss today owes one relearn pass (D21) until he answers the card again, in this session or a
      // later one today: the session ending as the goal closes (D65), or Esc then ⌘R, doesn't drop it.
      const own = ownToday.get(c.id) ?? [];
      const relearn = own.length === 1 && own[0]!.rating === 1;
      const due = c.fsrs ? new Date(c.fsrs.due) <= now : true;
      if (!due && !relearn) continue;
      if (limit && !c.fsrs && !relearn && localDay(c.created) === today) continue;
      const finished = items.get(c.item)?.finished_at;
      const entry: QueueEntry = {
        id: c.id,
        kind: c.kind,
        state: c.state,
        content_type: c.content_type,
        item: c.item,
        skills: c.skills,
        topics: c.topics,
        priority: cardPriority(c.skills, skills),
        question: c.question,
        due: c.fsrs?.due ?? null,
        retrievability: retrievability(c.fsrs, now, c.retention, w),
        relearn,
      };
      if (!c.fsrs && !relearn) unseen.push({ entry, fresh: finished ?? "" });
      else entries.push(entry);
    }
    unseen.sort((a, b) => b.fresh.localeCompare(a.fresh) || a.entry.id.localeCompare(b.entry.id));
    // A backlog of due cards is the normal case (D144): new cards get every fifth place of the session,
    // so new learning comes in whatever is due, and the due cards fill the rest, most urgent first.
    const fresh = unseen.slice(0, newLeft).map((u) => u.entry);
    const ordered = orderQueue(entries);
    const live = ordered.filter((e) => !e.relearn);
    const out: QueueEntry[] = [];
    for (const e of live) {
      out.push(e);
      if (out.length % NEW_EVERY === NEW_EVERY - 1 && fresh.length) out.push(fresh.shift()!);
    }
    return [...out, ...fresh, ...ordered.filter((e) => e.relearn)];
  });
}

export interface SkillStats {
  skill: string;
  name: string;
  priority: string;
  items_read: number;
  items_live: number;
  cards_live: number;
  reviews: number;
  retention: number | null;
  retention_n: number;
  // D34.8: items drafted from his own words (My notes, or a highlight with a note) vs from a highlight without one.
  retention_own_words: number | null;
  retention_own_words_n: number;
  retention_no_note: number | null;
  retention_no_note_n: number;
  session_starts: number;
}

// Latest note of every annotation, deleted ones included (their cards stay).
function annotationNotes(lib: Library): Map<string, string> {
  const out = new Map<string, string>();
  for (const dir of itemDirs(lib)) for (const a of latestRevs(annotationRevs(dir))) out.set(a.id, a.note?.trim() ?? "");
  return out;
}

export function libraryStats(lib: Library, open?: LibraryIndex): { skills: SkillStats[]; total: Omit<SkillStats, "name" | "priority"> } {
  return withIndex(lib, open, (index) => {
    const items = index.items();
    const cards = index.cards();
    const reviews = readReviews(lib);
    const starts = new Set(readSessions(lib).filter((s) => s.type === "start").map((s) => s.id));
    const skillsOf = new Map(cards.map((c) => [c.id, c.skills]));
    const notes = annotationNotes(lib);
    const ownWords = (c: CardRow) => c.from_notes || (!!c.annotation && !!notes.get(c.annotation));
    const noNote = (c: CardRow) => !c.from_notes && !!c.annotation && notes.get(c.annotation) === "";
    const own = new Set(cards.filter(ownWords).map((c) => c.id));
    const bare = new Set(cards.filter(noNote).map((c) => c.id));

    const compute = (has: (skills: string[]) => boolean) => {
      const live = cards.filter((c) => c.state === "live" && has(c.skills));
      const rs = reviews.filter((r) => has(skillsOf.get(r.card) ?? []));
      const m = retentionMetric(rs);
      const mo = retentionMetric(rs.filter((r) => own.has(r.card)));
      const mb = retentionMetric(rs.filter((r) => bare.has(r.card)));
      return {
        items_read: items.filter((i) => i.status === "done" && has(i.skills)).length,
        items_live: new Set(live.map((c) => c.item)).size,
        cards_live: live.length,
        reviews: rs.length,
        retention: m.retention,
        retention_n: m.n,
        retention_own_words: mo.retention,
        retention_own_words_n: mo.n,
        retention_no_note: mb.retention,
        retention_no_note_n: mb.n,
        session_starts: new Set(rs.flatMap((r) => (r.session && starts.has(r.session) ? [r.session] : []))).size,
      };
    };
    const skills = loadSkills(lib).skills.map((s) => ({ skill: s.id, name: s.name, priority: s.priority, ...compute((xs) => xs.includes(s.id)) }));
    return { skills, total: { skill: "all", ...compute(() => true), session_starts: starts.size } };
  });
}
