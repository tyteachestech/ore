import { annotationRevs } from "./annotations.ts";
import { findCard } from "./cards.ts";
import { withIndex, type CardRow, type LibraryIndex } from "./db.ts";
import { deviceLog, latestRevs, readJsonl } from "./fsutil.ts";
import { itemDirs, type AiStamp } from "./items.ts";
import { localDay, nowIso } from "./ids.ts";
import { paths, type Library } from "./library.ts";
import { withLock } from "./lock.ts";
import { orderQueue, winFirst, type QueueEntry } from "./queue.ts";
import { findVariant } from "./remix.ts";
import { appendReview, appendUndo, lineId, readReviews, reviewTimes, type FsrsState, type Review } from "./reviews.ts";
import { emptyState, loadParams, merged, nextState, replay, retrievability } from "./scheduler.ts";
import { NO_SKILL } from "./no-skill.ts";
import { openSessionId, openSessionIds, readSessions } from "./sessions.ts";
import { archivedOnly, cardPriority, unfiled, desiredRetention, loadSkills, reviewSettings, sourcePriority } from "./skills.ts";
import { retentionMetric } from "./stats.ts";
import { gemPast, mergedReviews, SOLID_DAYS } from "./today.ts";

export interface ReviewInput {
  rating: 1 | 2 | 3 | 4;
  confidence: number;
  answer?: string;
  ai_rating?: number;
  /** Who suggested `ai_rating` (the stamp `ore grade` returned): all AI output records it. */
  ai?: AiStamp;
  elapsed_ms?: number;
  finishing?: boolean;
  session?: string;
  /** The remixed version shown (D66); its review updates the card's one schedule. */
  variant?: string;
  /** Answered in his head and self-marked (D68). */
  in_head?: boolean;
  /** How many hints he took before answering, 1 or 2; 0 or none for no hint (D358). */
  cued?: number;
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
/** Where a card stands before a review at `now`: its retention and params, its prior reviews, the state
 *  they replay to, and the moment to rate it at. A review synced from a device whose clock ran ahead can
 *  be dated after now: the review is logged now, and FSRS counts the time since that one as none, rather
 *  than refusing time that runs backwards. Shared by the review itself and the timeline's lookahead. */
function stateBefore(lib: Library, card: ReturnType<typeof findCard>, now: Date) {
  const retention = desiredRetention(card.meta.skills, loadSkills(lib).skills, sourcePriority(lib, card.meta.item));
  const w = loadParams(lib);
  const prior = readReviews(lib).filter((r) => r.card === card.meta.id);
  const before = replay(prior, retention, w) ?? emptyState(now);
  const last = before.last_review ? new Date(before.last_review) : now;
  return { retention, w, prior, before, at: last > now ? last : now };
}

export async function recordReview(lib: Library, cardRef: string, input: ReviewInput): Promise<ReviewResult> {
  return withLock(paths.lock(lib), () => {
    const card = findCard(lib, cardRef);
    if (card.meta.state === "retired") throw new Error(`card ${card.meta.id} is retired: \`ore card restore ${card.meta.id}\` puts it back in review`);
    if (input.cued && input.cued !== 1 && input.cued !== 2) throw new Error("--cued is 1 or 2");
    // A time this card already has a review at (taken back or not, here or synced) moves on a millisecond:
    // an undo names its review by card and time, so two reviews sharing one would stand or fall together.
    let now = input.now ?? new Date();
    const taken = reviewTimes(lib, card.meta.id);
    while (taken.has(nowIso(now))) now = new Date(now.getTime() + 1);
    const { retention, w, prior, before, at } = stateBefore(lib, card, now);
    const after = nextState(before, at, input.rating, retention, w);
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
      ai: input.ai_rating === undefined ? undefined : input.ai,
      rating: input.rating,
      elapsed_ms: input.elapsed_ms,
      state_before: before,
      state_after: after,
      finishing: finishing || undefined,
      variant,
      in_head: input.in_head || undefined,
      cued: input.cued || undefined,
    };
    // A review dated after now (a clock that ran ahead) comes after this one when the log is replayed, as the
    // index does: the state saved is that replay, so the two never disagree (Codex sweep 4). Doctor names that review.
    if (at > now) review.state_after = replay([...prior, review], retention, w) ?? after;
    appendReview(lib, review);
    const saved = review.state_after;
    return { card: card.meta.id, ts: review.ts, rating: input.rating, due_next: saved.due, state_after: saved, finishing, session: session ?? null };
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
    let at = own.filter((r) => r.ts === ts);
    if (!at.length || since.length) throw new Error(`the review at ${ts} is not ${card.meta.id}'s latest`);
    // Another device rated it in the same millisecond, offline (Codex deep scan 3): the one taken back is the one
    // given here, in this device's own log, and the other stands.
    if (at.length > 1) {
      const mine = new Set(readJsonl<Review>(deviceLog(paths.reviewLog(lib, new Date(ts)))).map((r) => JSON.stringify(r)));
      at = at.filter((r) => mine.has(JSON.stringify(r)));
      if (at.length !== 1) throw new Error(`${card.meta.id} has two reviews at ${ts} from other devices; neither was given here`);
    }
    appendUndo(lib, { ts: nowIso(now), card: card.meta.id, undo: ts, of: lineId(at[0]!) });
  });
}


/** New exercises he met on `day`: drafts whose first review in the merged logs is a finishing one that day. A draft
 *  finished on two devices offline counts once, and on the day it was first finished (D65). */
export function firstSeenToday(reviews: Review[], day: string): number {
  const first = new Map<string, Review>();
  for (const r of reviews) if (!first.has(r.card)) first.set(r.card, r);
  return [...first.values()].filter((r) => r.finishing && localDay(r.ts) === day).length;
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
  /** Only cards filed under one of these skills (D80's pick), or under none with NO_SKILL (D204); all when absent. */
  skills?: string[];
  /** Only one source's cards ("Review this source"), its unseen drafts included; with `skills`, both must hold. */
  item?: string;
  /** Apply the new-card limits (D60, D65, D144): at most `new_per_day`, and none drafted today. On by default. */
  newLimit?: boolean;
  /** A session's first fetch: its first card is a likely recall (D176). A fetch mid-session leaves the order alone. */
  start?: boolean;
}

/** One card in this many is new while due cards last (D144). */
const NEW_EVERY = 5;
/** A source finished this long ago or less still counts as just read (D279). */
const RECENT_MS = 7 * 864e5;

// Due queue (SPEC §3): live cards due now in queue order, opening on a likely recall (D176), with unseen
// drafts (his own work first, D176, then the freshest source, D60) taking every fifth place, and today's pending relearn passes last. A draft waits until the day
// after it was written, so its first review is spaced from the reading (D65). Up to `new_per_day` a day.
export function dueQueue(lib: Library, now = new Date(), opts: QueueOptions = {}, open?: LibraryIndex): QueueEntry[] {
  return withIndex(lib, open, (index) => {
    const skills = loadSkills(lib).skills;
    const w = loadParams(lib);
    const items = new Map(index.items().map((i) => [i.id, i]));
    const reviews = readReviews(lib);
    const today = localDay(now);
    // Relearn passes are owed for misses today, or since an open session began if that was earlier (a
    // session running past midnight, even while the quick quiz has one open too).
    const openIds = new Set(openSessionIds(lib));
    const began = readSessions(lib).find((s) => s.type === "start" && openIds.has(s.id))?.ts;
    const ownToday = new Map<string, Review[]>();
    for (const r of reviews) {
      if (localDay(r.ts) !== today && !(began && r.ts >= began)) continue;
      const own = ownToday.get(r.card);
      if (own) own.push(r);
      else ownToday.set(r.card, [r]);
    }
    const settings = reviewSettings(lib);
    const limit = opts.newLimit !== false;
    const newLeft = limit ? Math.max(0, settings.new_per_day - firstSeenToday(reviews, today)) : Infinity;
    const picked = opts.skills && new Set(opts.skills);

    const entries: QueueEntry[] = [];
    const unseen: { entry: QueueEntry; fresh: string; tier: number }[] = [];
    const cards = index.cards();
    for (const c of cards) {
      if (c.state === "retired") continue;
      if (opts.item && c.item !== opts.item) continue;
      if (picked && !c.skills.some((s) => picked.has(s)) && !(picked.has(NO_SKILL) && unfiled(c.skills, skills))) continue;
      // An archived skill's cards wait out of review (D173), unless he picks the skill by name.
      if (!picked && !opts.item && archivedOnly(c.skills, skills)) continue;
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
        priority: cardPriority(c.skills, skills, items.get(c.item)?.priority),
        question: c.question,
        due: c.fsrs?.due ?? null,
        retrievability: retrievability(c.fsrs, now, c.retention, w),
        relearn,
      };
      if (!c.fsrs && !relearn) unseen.push({ entry, fresh: finished ?? "", tier: c.from_notes ? 0 : c.annotation ? 1 : 2 });
      else entries.push(entry);
    }
    // D176: his own work first (a card from his notes, then one from his highlight, then the AI's
    // prequestion cards), freshest finished source first within each (D60).
    unseen.sort((a, b) => a.tier - b.tier || b.fresh.localeCompare(a.fresh) || a.entry.id.localeCompare(b.entry.id));
    // A backlog of due cards is the normal case (D144): new cards get every fifth place of the session,
    // so new learning comes in whatever is due, and the due cards fill the rest, most urgent first.
    // D279: what he finished this week takes up to half of today's new places first, freshest
    // first, so it's reviewed while fresh, not queued behind a backlog of older drafts; his own work fills the rest.
    const recent = unseen.filter((u) => u.fresh && now.getTime() - Date.parse(u.fresh) <= RECENT_MS).sort((a, b) => b.fresh.localeCompare(a.fresh) || a.tier - b.tier || a.entry.id.localeCompare(b.entry.id));
    const room = recent.slice(0, Math.ceil(newLeft / 2));
    const fresh = [...room, ...unseen.filter((u) => !room.includes(u))].slice(0, newLeft).map((u) => u.entry);
    const ordered = orderQueue(entries);
    const due = ordered.filter((e) => !e.relearn);
    const live = opts.start ? winFirst(due) : due;
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
    // Retention reads each review's state before it as the merged logs replay it: a device that hadn't seen
    // another's reviews yet saved its own (Codex deep scan 3).
    const reviews = mergedReviews(cards, readReviews(lib), loadParams(lib));
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

/** A card's reviews in time and where each rating would put the next one (D149): the dates the review
 *  screen draws as a line of dots, so he sees the gaps widen while recall holds. Read from the log,
 *  nothing new stored. `now` for tests. */
/** What a card's gem looks like (D236): `empty` never reviewed, `rough` growing, `ready` one Good review from
 *  cut, `cut` solid, `dull` cut once and missed since. `seam`: it has been missed and won back (a gold rim it
 *  keeps); `polished`: passed on a new case (D197). */
export type CardGem = { kind: "empty" | "rough" | "ready" | "cut" | "dull"; seam?: boolean; polished?: boolean };
type Rating = 1 | 2 | 3 | 4;

/** A card's reviews, where each rating would put the next one (D149), and its gem: as it is now and as each
 *  rating would leave it, with the days of memory (FSRS stability) that rating adds. */
export function cardHistory(lib: Library, cardRef: string, now = new Date()): { reviews: { ts: string; rating: Rating }[]; next: Record<Rating, string>; gem: CardGem & { after: Record<Rating, CardGem & { days: number }> } } {
  const { retention, w, prior, before, at } = stateBefore(lib, findCard(lib, cardRef), now);
  const after = (rating: Rating) => nextState(before, at, rating, retention, w);
  const solid = (stability: number) => stability >= SOLID_DAYS;
  const was = prior.length ? before.stability : 0;
  // Its past by the one rule (`gemPast`), read from the log; where it stands now is the schedule's own state.
  // The two can differ after the schedule is re-fitted, so "missed since" needs both to say it isn't solid.
  const past = gemPast(merged(prior, () => retention, w));
  const polished = past.applied || undefined;
  const near = (state: FsrsState, when: Date) => solid(nextState(state, when, 3, retention, w).stability);
  // The rim is gold once it has fallen and been cut again; a first miss has none yet.
  const today = (): CardGem => {
    if (!prior.length) return { kind: "empty" };
    if (solid(was)) return { kind: "cut", ...(past.fell ? { seam: true } : {}), ...(polished ? { polished } : {}) };
    if (past.cutOnce && !past.solid) return { kind: "dull", ...(past.wonBack ? { seam: true } : {}) };
    // Nearly cut means what the Good on offer says: one given now, not on the day it falls due.
    return { kind: near(before, at) ? "ready" : "rough" };
  };
  const then = (rating: Rating) => {
    const a = after(rating);
    const days = Math.max(0, Math.round(a.stability - was));
    if (solid(a.stability)) return { kind: "cut" as const, ...(past.fell ? { seam: true } : {}), ...(polished ? { polished } : {}), days };
    if (past.cutOnce || solid(was)) return { kind: "dull" as const, ...(past.wonBack ? { seam: true } : {}), days };
    return { kind: near(a, new Date(a.due)) ? ("ready" as const) : ("rough" as const), days };
  };
  return {
    reviews: prior.map((r) => ({ ts: r.ts, rating: r.rating as Rating })),
    next: { 1: after(1).due, 2: after(2).due, 3: after(3).due, 4: after(4).due },
    gem: { ...today(), after: { 1: then(1), 2: then(2), 3: then(3), 4: then(4) } },
  };
}
