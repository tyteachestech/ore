import { isDrafting } from "./drafting";
import { rememberToday } from "./ReviewPick";
import { waiting } from "./Home";
import { newSession, rated, sfx, warm } from "./sfx";
import { afterAnswer, lastWin, opt, ore, PHONE, putOff, type CardFull, type DueEntry, type Grade, type SessionEnd, type Today } from "./ore";
import { errorText, type Forget, type Notify } from "./util";

/** One card adds at most this much active time (D60, as in core). */
const ACTIVE_CAP_MS = 3 * 60_000;

/** The session receipt, and today before and after it (for the ring and level-ups). `dig`: a skill ready to be
 *  explained whole (D325), offered once on the end screen; null when none. */
export type End = { session: SessionEnd; today: Today; before: Today | null; dig?: { skill: string; goal: string } | null };

/** A rating as he gave it: the exercise, his answer and how sure he was, and the AI's grade if it gave one (D21). */
export type Answer = {
  card: CardFull;
  rating: number;
  conf?: number;
  answer: string;
  grade: Grade | null;
  inHead: boolean;
  /** No moment was over the goal's note as he rated, so he has seen it: this rating takes it down. */
  noteSeen: boolean;
  /** Once the rating is in the log, before anything else: its moment, its draft dropped. */
  saved?: () => void;
};

/** What the screen gives its session. `S` is an exercise as he has it on screen, which Later keeps for ⌘Z (D192). */
export type Screen<S> = {
  notify: Notify;
  onClose: () => void;
  /** A rating taken back (⌘Z) or given again after Review closed: today's numbers changed. */
  onLogged?: () => void;
  /** The exercise on screen as he has it, for Later; null when none can be put off (still loading, its editor open). */
  shown: () => { id: string; shown: S } | null;
  /** Keeps the time on an unfinished draft when Review leaves the exercise. */
  keepDraftTime?: (elapsedMs: number) => void;
  /** A rating is being taken back: its moment goes at once. */
  unrated: () => void;
  /** Sends a key press on to the app history: his own ⌘Z that waited for a save, or the history's Undo or Redo. */
  press: (key: "undo" | "redo" | KeyboardEventInit) => void;
};

/** One Later on the history: the session after it (null: it ended the session), and what it changed.
 *  `elapsed`: the exercise's clock so far. */
type Put<S> = { id: string; after: DueEntry[] | null; off: Set<string>; won: boolean; shown: S; elapsed: number; forget?: Forget };
/** A rating of this session, with the session as it was before it. */
type Rated = { card: string; ts: string; queue: DueEntry[]; done: number; activeMs: number; off: Set<string>; won: boolean; told: boolean; forget: Forget; day: string; ms: number };
type Again = { forget: Forget; setTs: (ts: string) => void };

/** What `ore due` is asked for: the picked skills, or one source. */
export const pickArgs = (pick: string[] | null, source?: string) => [...(pick ?? []).map((s) => opt("skill", s)), ...(source ? [opt("source", source)] : [])];

/** The remixed version shown, for the CLI calls that act on it (D66). */
export const variantOpt = (c: CardFull) => (c.variant ? [opt("variant", c.variant)] : []);

/** Why a session has no cards, honestly: the pick leaves out skills with cards due, or the daily limits hold
 *  new cards back (D65), and only then "nothing is due". */
export function nothingDue(t: Today | null, pick: string[] | null, source?: string): string {
  if (source) return isDrafting(source) ? "This source’s exercises are still being drafted." : "Nothing from this source is due right now.";
  if (pick && t && t.due > 0) return `Nothing is due in the skills you picked today. ${t.due} ${t.due === 1 ? "exercise waits" : "exercises wait"} in the others.`;
  if (t && !t.exercises) return "No exercises yet. Mark Key points in a source and Finish it: they start the next day.";
  return t?.new_waiting ? `All caught up. ${waiting(t)}` : "All caught up. Nothing is due right now.";
}

const localDay = () => new Date().toLocaleDateString("sv");

/** One review session, for Review, the quick quiz (D76) and the iPhone: when it starts and ends, what is next,
 *  the time and the day's goal it counts toward, and every step he can take back. The screen says what he did
 *  (`rate`, `later`, `retire`, `finish`) and draws what it reads here; the order things happen in is kept here:
 *  one write at a time, a rating never before its session has started, a ⌘Z never before the rating it is for.
 *  Every rating is logged at once (D59), by his choice alone (D21); nothing here touches a schedule (D22). */
export class ReviewSession<S> {
  /** Set by the screen on every draw. */
  screen!: Screen<S>;
  pick: string[] | null = null;
  source?: string;

  // What the screen draws.
  queue: DueEntry[] | null = null;
  /** Goes up each time another exercise comes to the front. The screen starts an exercise afresh on this, not only
   *  on a new first entry: a rating and its ⌘Z can both land between two draws, and the entry is then the same one. */
  turn = 0;
  /** Ratings so far: every one is a step, a miss too (D59). */
  done = 0;
  /** A write is out: nothing else starts until it lands. */
  busy = false;
  end: End | null = null;
  /** Why the session could not start. */
  error: string | null = null;
  /** Today as the session started, for the quick quiz's ring. */
  start: Today | null = null;
  /** D246: the day's goal closed during this session. The mole says so once, over the next exercise, and the
   *  session goes on: everything after is extra, and Esc (his Done) ends it on the end screen. */
  goalSaid = false;
  /** Active time in this session, to tell when today's goal closes (D65). */
  activeMs = 0;
  reviewed = 0;
  get canUndo() {
    return this.undos.length > 0;
  }

  /** This window's session, named by id in every call: the main window and the quick quiz can each have
   *  one open (D76), and the last one started is not always this one. `open`: not ended yet. */
  private session: { id: string; open: boolean } | null = null;
  /** Settles once this showing's `session start` has: a rating waits for it, so it never goes in unnamed. */
  private ready: Promise<unknown> = Promise.resolve();
  /** False once Review has closed: ⌘Z and ⇧⌘Z on a rating from it then only change the log. */
  private mounted = false;
  /** It asked to be closed: nothing more starts by itself. */
  private closing = false;
  /** Runs once the session is idle again, after it has closed. */
  private whenIdle: (() => void) | null = null;
  /** The goal closed on a miss and one more card was served first (D177): the next answer ends the session. */
  private wonLast = false;
  private goalTold = false;
  private before: Today | null = null;
  /** The local day `before` was read on. */
  private beforeDay = "";
  /** What was rated since midnight that no new day's start has counted yet (its Today read failed): the next
   *  `newDay` takes it as this session's, never as none (review of #443). */
  private turnedMs = 0;
  /** The ratings of this session, newest last, to take back with ⌘Z one after another (Anki's Undo). */
  private undos: Rated[] = [];
  /** Cards retired in this session: taking back a rating before one brings the queue back without it. */
  private retired = new Set<string>();
  /** Exercises put off this session (D192), by id: once every one left is, the session ends. A rating takes its own off. */
  private off = new Set<string>();
  /** The Laters on the app history: nothing is recorded, so once Review closes there is nothing to take back. */
  private laterSteps = new Set<Forget>();
  /** An exercise ⌘Z brought back from Later: it shows again as he had it, not loaded afresh. */
  private restore: { id: string; shown: S; elapsed: number } | null = null;
  /** The next card, loaded while he answers this one, so a rating moves on without waiting for it. Only
   *  a rating or a Later arms it; anything else that moves the queue or changes a card (an undo, an edit,
   *  a retire, a version dropped, Try again) drops it, and that card loads afresh. */
  private ahead: { id: string; card: Promise<CardFull>; armed: boolean } | null = null;
  /** When the exercise on screen showed. */
  private shownAt = Date.now();
  /** When Ore went out of sight, while it is. */
  private awaySince: number | null = null;
  /** ⌘Z presses while a rating saved or the session wrapped up: they go to the history once that is
   *  done, so they take back the newest steps (that rating first), never an older card's meanwhile. */
  private waiting: { n: number; key: KeyboardEventInit } = { n: 0, key: {} };
  private watchers = new Set<() => void>();
  private settling = false;

  constructor(private quick = false, private run: typeof ore = ore) {}

  /** `draw` runs whenever what the screen draws has changed. */
  watch(draw: () => void) {
    this.watchers.add(draw);
    return () => void this.watchers.delete(draw);
  }

  private changed() {
    for (const f of this.watchers) f();
    if (this.settling) return;
    this.settling = true;
    queueMicrotask(() => {
      this.settling = false;
      this.settle();
    });
  }

  /** What follows by itself once the session is still: it ends when nothing is left, and the ⌘Z presses that waited go on. */
  private settle() {
    if (!this.mounted || this.closing) return;
    // The quick quiz with nothing due says so and waits for Esc instead of closing under his hand.
    // Again once the last rating has saved: the queue can empty while it still is (the phone's `ore` runs in the
    // page, so the rating saves inside the tap's own event and the queue is empty before it is done).
    if (this.queue && !this.queue.length && !this.end && !this.busy && !(this.quick && !this.reviewed)) void this.finish();
    if (!this.busy && this.waiting.n) this.sendUndos();
  }

  private setBusy(on: boolean) {
    this.busy = on;
    this.changed();
    const f = !on && this.whenIdle;
    if (f) {
      this.whenIdle = null;
      setTimeout(f);
    }
  }

  private setQueue(q: DueEntry[] | null) {
    if (q?.[0] !== this.queue?.[0]) this.turn++;
    this.queue = q;
    this.changed();
  }

  private close() {
    this.closing = true;
    this.screen.onClose();
  }

  /** Starts the session, or after a failed start tries again. Returns what to call as the screen goes. */
  begin(): () => void {
    let live = true;
    this.closing = false;
    this.error = null;
    this.changed();
    newSession();
    warm();
    const { quick, run } = this;
    void (async () => {
      try {
        // Try again after `due` failed keeps the session already started: a second would be left open.
        if (!this.session?.open) {
          const started = run<{ id: string }>("session", "start", ...(quick ? ["--stack"] : []));
          this.ready = started.catch(() => {});
          const s = await started;
          // Closed before the session began: it ends at once, as leaving would have ended it.
          if (!live) return void run("session", "end", s.id).catch(() => {});
          this.session = { id: s.id, open: true };
        }
        const t = run<Today>("today").then((t) => {
          this.before = t;
          this.beforeDay = localDay();
          this.start = t;
          this.changed();
        }, () => {});
        // --start: a session opens on a likely recall (D176); the quick quiz asks the card that is next.
        const q = await run<DueEntry[]>("due", ...(quick ? [] : ["--start"]), ...pickArgs(this.pick, this.source));
        // An empty queue ends the session at once, and why ("nothing due in the skills you picked",
        // new cards waiting) reads today: let it land first.
        if (!q.length) await t;
        this.setQueue(q);
      } catch (e) {
        this.error = errorText(e);
        this.changed();
      }
    })();
    this.mounted = true;
    const doc = typeof document === "undefined" ? null : document;
    const seen = () => this.away(!!doc?.hidden);
    doc?.addEventListener("visibilitychange", seen);
    seen();
    return () => {
      live = false;
      this.mounted = false;
      doc?.removeEventListener("visibilitychange", seen);
    };
  }

  /** Gone any other way than Esc or Done (a click away from the quick quiz, Open in source from it):
   *  this session ends, by its id, never another window's. */
  leave() {
    const s = this.session;
    if (s?.open) {
      this.keepDraftTime();
      void this.run("session", "end", s.id).catch(() => {});
    }
    this.session = null;
  }

  /** The screen has closed for good. */
  gone() {
    // A Later recorded nothing, so ⌘Z after it has nothing of Review's to take back.
    for (const f of this.laterSteps) f();
    this.laterSteps.clear();
    // Closed with presses still waiting (a click away from the quick quiz): the history still gets them.
    if (!this.waiting.n) return;
    if (this.busy) this.whenIdle = this.sendUndos;
    else setTimeout(this.sendUndos);
  }

  /** A ⌘Z pressed while a write is out: it waits for it. */
  holdUndo(key: KeyboardEventInit) {
    this.waiting.n++;
    this.waiting.key = key;
  }
  private sendUndos = () => {
    const w = this.waiting;
    const n = w.n;
    w.n = 0;
    // While the first is taken back the session is busy again, so the rest queue up anew and wait their turn.
    for (let i = 0; i < n; i++) this.screen.press(w.key);
  };

  // The day and its goal.

  /** Past midnight the day's minutes start again: `t` is the new day's Today, read as if just before this session,
   *  with `add` ms of this session already in it (F184, F365). A skill's level is no day's, so
   *  the session's level-ups still count from where it started. */
  private newDay(t: Today, add: number) {
    this.turnedMs = 0;
    this.before = { ...t, skills: this.before?.skills ?? t.skills, active_ms: t.active_ms - add, met: t.active_ms - add >= t.goal_ms };
    this.beforeDay = localDay();
    this.start = this.before;
    this.activeMs = add;
    // Yesterday's goal note was yesterday's: today's goal is told when it closes.
    this.goalTold = false;
    this.goalSaid = false;
    this.changed();
  }
  private dayTurned = () => !!this.before && localDay() !== this.beforeDay;

  /** Midnight with an exercise open: the quick quiz's ring starts the new day at once, not at the next rating. */
  dayChanged() {
    if (this.dayTurned()) void this.run<Today>("today").then((t) => this.dayTurned() && this.newDay(t, Math.min(this.turnedMs, t.active_ms)), () => {});
  }

  /** A setting changed while the session is open (paused on a source, Settings, then back): the goal it counts
   *  toward and the day's new-exercise limit follow the saved ones, as a fresh session would (Codex sweep 4). */
  settingsChanged() {
    if (this.quick) return;
    void this.run<Today>("today").then((t) => {
      const b = this.before;
      if (!b) return;
      this.before = { ...b, goal_minutes: t.goal_minutes, goal_ms: t.goal_ms, counts: t.counts, met: t.counts && (b.active_ms >= t.goal_ms || (b.met && b.active_ms < b.goal_ms)) };
      this.start = this.before;
      this.changed();
    }, () => {});
    // A source's own review is past the limits on purpose; otherwise new exercises the limit no longer lets in go.
    if (this.source) return;
    void this.run<DueEntry[]>("due", ...pickArgs(this.pick, this.source)).then((capped) => {
      const keep = new Set(capped.map((e) => e.id));
      // The card on screen stays: he is in the middle of it.
      this.setQueue(this.queue && this.queue.filter((e, i) => i === 0 || e.due || e.relearn || keep.has(e.id)));
    }, () => {});
  }

  /** `due` is what is still due, read after the quick quiz or something outside Ore (the CLI, `/ore`, the phone)
   *  may have rated, changed or deleted exercises: the ones no longer due drop out, so none comes up twice. The
   *  one on screen goes only if he hasn't `started` on it. */
  stillDue(due: ReadonlySet<string>, outside: boolean, started: boolean) {
    if (outside) this.dropAhead();
    const q = this.queue;
    this.setQueue(q && (q.every((e) => due.has(e.id)) ? q : q.filter((e, i) => due.has(e.id) || (i === 0 && started))));
  }

  // The exercise on screen: its card and its clock.

  load = (id: string) => this.run<CardFull>("card", "show", id, "--review");
  dropAhead = () => void (this.ahead = null);
  /** Once this card is on screen, the one after it loads. */
  loadAhead(id: string) {
    if (this.ahead?.id === id) return;
    const slot = { id, card: this.load(id), armed: false };
    slot.card.catch(() => this.ahead === slot && this.dropAhead());
    this.ahead = slot;
  }
  /** The card loaded ahead, if a rating or Later just moved on to it. */
  takeAhead(id: string): Promise<CardFull> | undefined {
    const early = this.ahead?.armed && this.ahead.id === id ? this.ahead.card : undefined;
    this.dropAhead();
    return early;
  }
  /** The exercise as he had it when he put it off, if ⌘Z just brought it back; its clock goes on from there. */
  takeRestored(id: string): S | null {
    const back = this.restore?.id === id ? this.restore : null;
    this.restore = null;
    if (!back) return null;
    this.dropAhead();
    this.clock(back.elapsed);
    return back.shown;
  }
  /** Starts the clock of the exercise on screen, `elapsed` ms in. */
  clock(elapsed = 0) {
    this.shownAt = Date.now() - elapsed;
    if (this.awaySince !== null) this.awaySince = Date.now();
  }
  /** Ore went out of sight (the phone locked, another app in front of it on the phone, the window minimized) or
   *  came back: the time between is not review time. The three-minute cap (D60) was all that held it, so a
   *  glance at a message mid-exercise put three minutes on the day's goal. */
  away(hidden: boolean) {
    if (hidden) this.awaySince ??= Date.now();
    else if (this.awaySince !== null) {
      this.shownAt += Math.max(0, Date.now() - this.awaySince);
      this.awaySince = null;
    }
  }
  /** A wall clock set back since it showed (a time zone fix, a sync) never makes it negative (F183). */
  private elapsed = () => Math.max(0, (this.awaySince ?? Date.now()) - this.shownAt);

  keepDraftTime = () => {
    if (!this.end) this.screen.keepDraftTime?.(this.elapsed());
  };

  /** One write on the exercise on screen (an edit, a version dropped): nothing else starts until it is done.
   *  False if one is already out. */
  async hold(work: () => Promise<void>): Promise<boolean> {
    if (this.busy) return false;
    this.setBusy(true);
    try {
      await work();
    } finally {
      this.setBusy(false);
    }
    return true;
  }

  // What he does.

  /** Ends the session; `endScreen` shows the end screen if he rated anything (never on leaving the quick quiz). */
  async finish(endScreen = true): Promise<void> {
    if (this.busy) return;
    const s = this.session;
    const { quick, run, pick, source } = this;
    // Left before the session began: closing ends it once it has.
    if (!s?.open) return this.close();
    this.keepDraftTime();
    this.setBusy(true);
    try {
      const receipt = await run<SessionEnd>("session", "end", s.id);
      s.open = false;
      if (this.reviewed && !endScreen) return this.close();
      if (!this.reviewed) {
        if (quick) return this.close();
        // Left before rating anything while cards were waiting: just close, they stay due.
        if (this.queue?.length) return this.close();
        // Nothing came up (all caught up, or the picked skills have nothing due): say so, never just vanish.
        this.screen.notify(nothingDue(this.before, pick, source));
        return this.close();
      }
      // So is the dig a finished session may offer (D325): one skill, of the ones he reviewed; the Mac's mole reads it.
      const dig = quick || source || PHONE ? null : run<{ skill: string; goal: string } | null>("dig", "--ready", ...(pick ?? []).map((s) => opt("skill", s))).catch(() => null);
      // Home draws the Today it last read until a fresh one lands (F125): hand it this one,
      // so Done doesn't show the morning's progress and then push the list down when the goal line appears.
      const today = await run<Today>("today");
      rememberToday(today);
      // Left after midnight: the ring is the new day's, which this session added only what it rated since to.
      if (this.dayTurned()) this.newDay(today, Math.min(this.turnedMs, today.active_ms));
      this.end = { session: receipt, today, before: this.before, dig: await dig };
      this.changed();
    } catch (e) {
      this.screen.notify(errorText(e), "error");
      this.close();
    } finally {
      this.setBusy(false);
    }
  }

  /** Records his rating and moves on. A second press while it saves does nothing; one that fails to save says
   *  why and leaves the exercise, its clock and the session as they were. */
  async rate(a: Answer): Promise<void> {
    if (this.busy) return;
    const { card, rating } = a;
    this.setBusy(true);
    let goalClosed = false, saved = false;
    try {
      const elapsed = this.elapsed();
      await this.ready;
      const args = [
        card.id,
        opt("rating", String(rating)),
        opt("confidence", String(a.conf ?? 2)),
        ...(a.answer.trim() ? [opt("answer", a.answer)] : []),
        // The AI's rating goes with its stamp or not at all (D21; the CLI refuses one without the other).
        ...(a.grade?.ai ? [opt("ai-rating", String(a.grade.rating)), opt("ai-by", `${a.grade.ai.vendor} ${a.grade.ai.model} ${a.grade.ai.prompt_version}`)] : []),
        opt("elapsed-ms", String(elapsed)),
        ...variantOpt(card),
        ...(a.inHead ? ["--in-head"] : []),
        ...(this.session ? [opt("session", this.session.id)] : []),
      ];
      await this.submit(args, rating, elapsed);
      saved = true;
      // Its sound, once it is saved: a rating that failed to save is silent.
      rated(rating);
      a.saved?.();
      // Past midnight the day's minutes start again: read the new day's Today, as if it was read just before this
      // rating, so the goal and the ring count today's minutes, not yesterday's plus these (F184).
      if (this.dayTurned()) {
        const add = this.turnedMs + Math.min(elapsed, ACTIVE_CAP_MS);
        const t = await this.run<Today>("today").catch(() => null);
        if (t) this.newDay(t, Math.min(add, t.active_ms));
        else this.turnedMs = add;
      }
      // The day's goal closing (D65) is told by the mole; the session flows on (D246).
      const b = this.before;
      goalClosed = !!b && b.counts && !b.met && b.active_ms + this.activeMs >= b.goal_ms;
    } catch (e) {
      this.screen.notify(errorText(e), "error");
    } finally {
      this.setBusy(false);
    }
    // The mole's goal note stays until the next rating; one still waiting behind a moment (a gem cut by the
    // rating that closed the goal) gets its turn first.
    if (!saved) return;
    if (this.goalTold && a.noteSeen) {
      this.goalSaid = false;
      this.changed();
    }
    if (!goalClosed || this.goalTold) return;
    // D177: a goal that closes on a miss gets one more card first, a likely recall, so its moment doesn't
    // follow a failure. Once only: whatever he answers next, the goal is told.
    const win = rating === 1 && !this.wonLast ? lastWin(this.queue ?? []) : null;
    if (win) {
      this.wonLast = true;
      return this.setQueue(win);
    }
    // The quick quiz is a glance: it still ends at the goal. A full session flows on (D246).
    if (this.quick) return void this.finish();
    this.goalTold = true;
    this.goalSaid = true;
    this.changed();
    // After the rating's own sound, so the two are heard apart.
    sfx("goal", { after: 0.5 });
  }

  /** Writes a rating and moves on. The first time (`again` absent) it goes on the app history, so
   *  ⌘Z takes it back and ⇧⌘Z gives it again: the same rating, answer and time. Throws if the write fails. */
  private async submit(args: string[], rating: number, elapsed: number, again?: Again) {
    const { run } = this;
    const was = { queue: this.queue ?? [], done: this.done, activeMs: this.activeMs, off: new Set(this.off), won: this.wonLast, told: this.goalTold };
    // An Undo on the end screen whose reopen failed (F618): open the session again before the next rating. If
    // that fails too, the rating still goes in, as one in no session, and he can carry on (code review of #538).
    if (this.session && !this.session.open) {
      try {
        await run("session", "reopen", this.session.id);
        this.session.open = true;
      } catch (e) {
        this.screen.notify(errorText(e), "error");
        args = args.filter((a) => !a.startsWith("--session="));
      }
    }
    const r = await run<{ ts: string }>("review", ...args);
    this.reviewed++;
    const id = args[0]!;
    // Answered: a miss's relearn pass is a new turn, not one he put off.
    this.off.delete(id);
    let ts = r.ts;
    again?.setTs(ts);
    const setTs = (t: string) => void (ts = t);
    const forget: Forget =
      again?.forget ??
      this.screen.notify(
        "Rating",
        "quiet",
        // With Review closed, only the log changes (its session stays ended), and Home reads its numbers again.
        (): Promise<unknown> => (this.mounted && this.undoRated(ts)) || run("review", id, opt("undo", ts)).then(() => this.screen.onLogged?.()),
        // Given again after Review closed: its session has ended, so the rating goes in with none.
        (): Promise<unknown> =>
          (this.mounted && this.redoRated(id, args, rating, elapsed, { forget, setTs })) ||
          run<{ ts: string }>("review", ...args.filter((a) => !a.startsWith("--session="))).then((x) => (setTs(x.ts), this.screen.onLogged?.())),
      );
    this.undos = [...this.undos, { card: id, ts: r.ts, ...was, forget, day: this.beforeDay, ms: Math.min(elapsed, ACTIVE_CAP_MS) }];
    // Every rating is a step, a miss too: a rating always moves "Exercise N of M" on, and a miss adds its retry
    // as one more step (D59).
    this.done++;
    if (this.ahead) this.ahead.armed = true;
    this.activeMs += Math.min(elapsed, ACTIVE_CAP_MS);
    this.setQueue(this.queue && afterAnswer(this.queue, rating === 1));
  }

  /** The Undo button: takes the newest rating back as ⌘Z would, so it can be given again. */
  undoLast() {
    this.undos.at(-1)?.forget.undo();
  }

  /** ⌘Z: takes back the last rating and shows that card again, unanswered. On the end screen it
   *  opens the session again, back on that card (Anki's Undo after Congratulations). */
  private async undoRating() {
    const last = this.undos.at(-1);
    if (!last || this.busy) return;
    const { end } = this;
    this.screen.unrated();
    this.dropAhead();
    // The history is already moving this step to Redo. Forgetting it here can erase that
    // entry when a held Undo runs behind the history's previous write.
    this.setBusy(true);
    try {
      await this.run("review", last.card, opt("undo", last.ts));
      if (end) {
        try {
          await this.run("session", "reopen", end.session.id);
          if (this.session) this.session.open = true;
        } catch (e) {
          // The rating is already gone. Keep its Undo completed; the next rating retries reopening.
          this.screen.notify(errorText(e), "error");
        }
        this.end = null;
      }
      this.reviewed--;
      // A rating from before midnight's rollover: the count is the new day's now, so only its own time comes off.
      this.activeMs = last.day === this.beforeDay ? last.activeMs : Math.max(0, this.activeMs - last.ms);
      // One rated after midnight that no new day counted yet: it is no longer this session's either.
      if (this.turnedMs) this.turnedMs = Math.max(0, this.turnedMs - last.ms);
      this.off = new Set(last.off);
      // D177's one more goes with the rating that earned it.
      this.wonLast = last.won;
      // So does the goal's note: undo the rating that closed the goal and it is open again, to be told again.
      if (!last.told) {
        this.goalTold = false;
        this.goalSaid = false;
      }
      this.done = last.done;
      this.undos = this.undos.slice(0, -1);
      this.setQueue(last.queue.filter((e) => !this.retired.has(e.id)));
    } finally {
      // A failure goes to the history, which puts the step back and says why.
      this.setBusy(false);
    }
  }

  /** The history's undo and redo of a rating while Review shows it: the write's promise, or null when it isn't the session's to do. */
  private undoRated = (ts: string) => {
    if (this.undos.at(-1)?.ts !== ts) return null;
    // Asked for past Review's own keys, which hold a ⌘Z while a write is out (the palette over it, the phone's
    // shake): refused, so the history keeps the step, never counted as taken back with the rating still in the log.
    return this.busy ? Promise.reject(new Error("Still saving. Try again in a moment.")) : this.undoRating();
  };
  // ⇧⌘Z right after ⌘Z: that card is showing again, so the rating goes in again and Review moves on.
  private redoRated(id: string, args: string[], rating: number, elapsed: number, again: Again) {
    if (this.end || this.busy || this.queue?.[0]?.id !== id) return null;
    this.setBusy(true);
    return this.submit(args, rating, elapsed, again).finally(() => this.setBusy(false));
  }

  /** Later (D192, Anki's Bury for this session): the exercise goes to the end of the session, before or after
   *  its answer, and nothing is recorded: no rating, no review line, no FSRS change (D21, D22), no minutes.
   *  When every exercise left has been put off the session ends, and they stay due. On the app history: ⌘Z
   *  brings it back as it was, ⇧⌘Z puts it off again (`redo`). */
  later(redo?: Put<S>): boolean {
    const on = this.screen.shown();
    const { queue } = this;
    if (!on || on.id !== queue?.[0]?.id || !queue || this.end || this.busy) return false;
    const p: Put<S> = Object.assign(redo ?? ({} as Put<S>), { id: on.id, after: putOff(queue, this.off), off: new Set(this.off), won: this.wonLast, shown: on.shown, elapsed: this.elapsed() });
    this.off.add(on.id);
    // D177's one more after a miss was this one: put off, it is no answer, so the next one he answers takes that turn.
    this.wonLast = false;
    if (!redo) {
      p.forget = this.screen.notify("Later", "quiet", () => (this.mounted && this.undoLater(p)) || this.passOn(p, "undo"), () => (this.mounted && this.redoLater(p)) || this.passOn(p, "redo"));
      this.laterSteps.add(p.forget);
    }
    if (!p.after) {
      void this.finish();
      return true;
    }
    if (this.ahead) this.ahead.armed = true;
    this.setQueue(p.after);
    return true;
  }
  /** A Later the session has moved past (its exercise has left the session: answered in the quick quiz, retired
   *  on its next turn): nothing is left to take back, so it leaves the history and the press goes on to the step
   *  before it, never spent on nothing. */
  private passOn(p: Put<S>, what: "undo" | "redo") {
    setTimeout(() => {
      if (p.forget) {
        p.forget();
        this.laterSteps.delete(p.forget);
      }
      this.screen.press(what);
    });
    return Promise.resolve();
  }
  // ⌘Z after a Later: the exercise is the current one again, as he had it, wherever the session has put it since
  // (a step since, like a Retire, may have moved the rest). One that ended the session opens it again on it.
  private undoLater(p: Put<S>): Promise<void> | null {
    const { queue, end } = this;
    if (!queue) return null;
    if (this.busy) return Promise.reject(new Error("Still saving. Try again in a moment."));
    const at = queue.findIndex((e) => e.id === p.id);
    if (at < 0 || (end && at !== 0)) return null;
    this.off = new Set(p.off);
    this.wonLast = p.won;
    if (end) {
      this.setBusy(true);
      return this.run("session", "reopen", end.session.id)
        .then(() => {
          if (this.session) this.session.open = true;
          // Its clock goes on from the Later, so the time on the end screen never counts (D60).
          this.clock(p.elapsed);
          this.end = null;
        })
        .finally(() => this.setBusy(false));
    }
    this.dropAhead();
    this.restore = { id: p.id, shown: p.shown, elapsed: p.elapsed };
    this.setQueue([queue[at]!, ...queue.slice(0, at), ...queue.slice(at + 1)]);
    return Promise.resolve();
  }
  private redoLater = (p: Put<S>) => (this.queue?.[0]?.id === p.id && this.later(p) ? Promise.resolve() : null);

  /** Retires the exercise on screen (a new one is deleted) and moves on; on the history. False if it did not. */
  async retire(card: { id: string; state: string }, isNew: boolean): Promise<boolean> {
    if (this.busy) return false;
    const { run } = this;
    const { notify } = this.screen;
    this.dropAhead();
    this.setBusy(true);
    try {
      await run("card", "retire", card.id);
      const { id, state } = card;
      this.retired.add(id);
      notify(
        isNew ? "Exercise deleted" : "Exercise retired",
        "info",
        async () => {
          if (state === "retired") return;
          this.dropAhead();
          return run("card", "restore", id, opt("state", state)).then(() => {
            this.retired.delete(id);
            notify("Exercise restored. It comes back in a later review.");
          });
        },
        () => (this.dropAhead(), run("card", "retire", id).then(() => void this.retired.add(id))),
      );
      this.setQueue(this.queue && afterAnswer(this.queue, false));
      return true;
    } catch (e) {
      notify(errorText(e), "error");
      return false;
    } finally {
      this.setBusy(false);
    }
  }
}
