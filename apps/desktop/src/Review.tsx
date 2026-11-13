import { Archive, ArrowCounterClockwise, ArrowSquareOut, CaretLeft, CaretRight, ChatCircleDots, Check, Circle, Clock, PencilSimple, ThumbsDown, Trash, X } from "./icons";
import { listen } from "@tauri-apps/api/event";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { Children, useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { Grow } from "./Grow";
import { Ask, NO_ASK, type AskChat } from "./Ask";
import { Cutting, Gem } from "./Gem";
import { Mole } from "./Mole";
import { CartTip, oreFor } from "./CartTip";
import { still } from "./SideCursor";
import { Hint } from "./Hint";
import { MoreButton } from "./Menu";
import { inTextField, is, label, useKeymap, type KeyId } from "./keys";
import { keydownFor } from "./menubar";
import { ownsUndo } from "./history";
import { lastWin, ore, opt, PHONE, putOff, rescuedWorthSaying, type Annotation, type CardFull, type CardGem, type DueEntry, type Grade, type SessionEnd, type Skill, type Today, type Try } from "./ore";
import { PixelTry } from "./PixelIcon";
import { endSays } from "./end-says";
import { DotBar, DotNumber, minutes, minutesText, Ring, ringDots } from "./Ring";
import { SkillChip } from "./Skills";
import { errorText, focusPicked, kept, useFocusWhileMounted, type Forget, type Notify } from "./util";
import { Working } from "./Working";
import { Timeline } from "./Timeline";
import { momentFor, type Moment } from "./moment";
import { Trap } from "./Trap";
import { waiting } from "./Home";
import { stampBefore } from "./transcript";
import { passageText } from "./text";
import { Evidence } from "./Evidence";
import { Occluded } from "./Occluded";

const SURE = ["Guess", "Think so", "Sure"] as const;
const KEY_POINTS_CHANGED = "The key points changed.";
const RATINGS = ["Again", "Hard", "Good", "Easy"] as const;
/** How long after the first press of a guarded rating the second one starts to count: past a double click. */
const GUARD_MS = 500;
/** The exercise's gem in words, for its hover. */
const GEM_SAYS: Record<CardGem["kind"], string> = {
  empty: "Not reviewed yet",
  rough: "Growing: not near cut yet",
  ready: "Nearly cut: cut if you recall it now",
  cut: "Cut: you'd still recall this three weeks from now",
  dull: "Missed since it was cut: recall it to win it back",
};
/** A missed card comes back this many cards later (D59). */
const AGAIN_GAP = 3;
/** The queue once its first card is answered. A miss comes back once (D59), a few cards later; a second
 *  miss waits for its next FSRS date. */
function afterAnswer(q: DueEntry[], again: boolean): DueEntry[] {
  if (!q.length) return q;
  const [head, ...rest] = q;
  if (!again || head!.relearn) return rest;
  return [...rest.slice(0, AGAIN_GAP), { ...head!, relearn: true }, ...rest.slice(AGAIN_GAP)];
}
/** One card adds at most this much active time (D60, as in core). */
const ACTIVE_CAP_MS = 3 * 60_000;
/** Cut gems drawn on the end screen; the rest show as "+N". */
const CUT_SHOWN = 8;
/** The end screen's ring, in px (the quick quiz's is smaller and has no cart). */
// D242: wide enough to hold the session's gems, which land inside it.
const END_RING = 236;

type Phase = "answer" | "checked" | "edit";
/** The passage a card came from, shown after the answer (see `passage` in Review). */
type Passage = { item: string; title: string; quotes: { text: string; at: string; time?: string }[] };
/** An exercise as he had it on screen when he put it off: ⌘Z brings it back so (D192). `elapsed`: its clock so far. */
type Shown = {
  card: CardFull; phase: "answer" | "checked"; answer: string; conf?: number; inHead: boolean; grade: Grade | null; marks: (boolean | undefined)[] | null;
  remark: boolean; gradeError: string | null; passage: Passage | null; quoteAt: number; passageGone: string | null; asking: boolean; elapsed: number;
};
/** One Later on the history: the session before and after it (null: it ended the session), and what it changed. */
type Put = { id: string; before: DueEntry[]; after: DueEntry[] | null; off: Set<string>; won: boolean; shown: Shown; forget?: Forget };
type Rating = 1 | 2 | 3 | 4;
/** The session receipt, and today before and after it (for the ring and level-ups). */
/** `next`: the oldest try still to try on his own work (D148), shown once on the end screen; null when none. */
type End = { session: SessionEnd; today: Today; before: Today | null; next: Try | null };

/** The remixed version shown, for the CLI calls that act on it (D66). */
const variantOpt = (c: CardFull) => (c.variant ? [opt("variant", c.variant)] : []);

/** Answers typed but not checked, and how sure he said he was, by card: putting the quick quiz away
 *  (D76), Esc, Open in source or quitting the app keep them for when the card comes up again (for a day, `kept`). */
const drafts = kept<{ text: string; conf?: number; asked: string }>("ore.review-drafts");
/** What a draft was typed for: the question, or the remixed version shown (D66). One for another is dropped. */
const askedOf = (c: CardFull) => `${c.variant ?? ""}\n${c.question}`;
const draftFor = (c: CardFull) => {
  const d = drafts.get(c.id);
  if (d && d.asked !== askedOf(c)) return void drafts.delete(c.id);
  return d;
};
const keepDraft = (c: CardFull, text: string, conf?: number) => drafts.set(c.id, { text, conf, asked: askedOf(c) });

/** Review mode (D59), full window like Raycast's command view: one card at a time, typed answers for
 *  Explain cards (AI marks the rubric and suggests a rating; he decides), self-rated Fact cards. Every
 *  rating is logged at once, so leaving with Esc loses nothing. `quick` is the quick quiz window (D76):
 *  today's ring instead of the session bar, and leaving closes it with no end screen unless the goal
 *  just closed or nothing is left. */
export function Review({ pick, source, skills, onOpenSource, onClose, onLogged, notify, quick = false, paused = false, under = false, leave, giveBack }: {
  /** Skills to review, or null for all. */
  pick: string[] | null;
  /** Review this source: only its exercises, its new ones included. */
  source?: string;
  /** Hidden while he reads the source a card opened; it waits on that card, its keys off. */
  paused?: boolean;
  /** Under the palette or the shortcuts sheet (controls-08): its keys are theirs until they close. */
  under?: boolean;
  /** Set to what Esc does without the end screen, for a palette action to leave Review first. */
  leave?: MutableRefObject<(() => Promise<void>) | null>;
  skills: Skill[];
  onOpenSource: (item: string, at?: string) => void;
  onClose: (again?: boolean) => void;
  /** A rating taken back (⌘Z) or given again after Review closed: today's numbers changed. */
  onLogged?: () => void;
  notify: Notify;
  quick?: boolean;
  /** Where focus goes as it closes when what started it is gone (the What to review sheet): the screen's own place. */
  giveBack?: () => HTMLElement | null | undefined;
}) {
  const [queue, setQueue] = useState<DueEntry[] | null>(null);
  /** The header's form, chosen from the session's length at its first exercise: step dots up to 30, else a bar.
   *  A miss adds a step, so deciding on every rating flipped a 30-step session to the bar. */
  const asDots = useRef(true);
  const [done, setDone] = useState(0);
  const [card, setCard] = useState<CardFull | null>(null);
  const [phase, setPhase] = useState<Phase>("answer");
  const [answer, setAnswer] = useState("");
  const [conf, setConf] = useState<number | undefined>();
  const [askSure, setAskSure] = useState(false);
  const [grade, setGrade] = useState<Grade | null>(null);
  /** The key point under the pointer, and the one whose mark has focus: its evidence is marked in his answer (D141). */
  const [hoverPoint, setHoverPoint] = useState<number | null>(null);
  const [focusPoint, setFocusPoint] = useState<number | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);
  /** One per key point: got, missed, or not marked yet (an in-head answer starts unmarked, D68). */
  const [marks, setMarks] = useState<(boolean | undefined)[] | null>(null);
  /** A key point changed under his marks: nothing is suggested until he marks again. */
  const [remark, setRemark] = useState(false);
  /** Answered in his head (D68): no typing, no AI; he marks the key points himself. */
  const [inHead, setInHead] = useState(false);
  /** What answers the card in its source, shown after the answer: the passage it came from, or for a line
   *  he typed (D99) the quotes the AI found, one at a time. `at` opens the source there. A card with no
   *  passage (one the tutor kept, or whose highlight is gone) has no quotes and opens the source at the top. */
  const [passage, setPassage] = useState<Passage | null>(null);
  const [quoteAt, setQuoteAt] = useState(0);
  /** Why the passage can't show (its source deleted since the card was made), in its place. */
  const [passageGone, setPassageGone] = useState<string | null>(null);
  /** The editor's text; `points` is an Explain card's key points, one a line. */
  const [draft, setDraft] = useState({ question: "", answer: "", points: "" });
  const [busy, showBusy] = useState(false);
  /** `busy` as of now, for the guards: two keys in one task would both see the state before either set it. */
  const busyNow = useRef(false);
  /** The goal closed on a miss and one more card was served first (D177): the next answer ends the session. */
  const wonLast = useRef(false);
  /** Runs once Review is idle again, after it has closed (when no effect will run it). */
  const whenIdle = useRef<(() => void) | null>(null);
  const setBusy = (on: boolean) => {
    busyNow.current = on;
    showBusy(on);
    const f = !on && whenIdle.current;
    if (f) {
      whenIdle.current = null;
      setTimeout(f);
    }
  };
  const [asking, setAsking] = useState(false);
  /** The rating under the pointer or focus, for where the timeline puts the next review (D149). */
  const [preview, setPreview] = useState<number | undefined>();
  /** A rating two steps over what the marks say waits for a second press (D237); this is the one waiting. */
  const [guard, setGuard] = useState<number | undefined>();
  const guardAt = useRef(0);
  /** The moment after a rating that changed the exercise's gem (D237). It sits over the next card and never holds it back. */
  const [moment, setMoment] = useState<(Moment & { n: number; color?: string }) | null>(null);
  useEffect(() => {
    if (!moment) return;
    const t = setTimeout(() => setMoment(null), moment.tone === "miss" ? 6000 : 4000);
    return () => clearTimeout(t);
  }, [moment]);
  /** Each card's Ask chat, kept while he closes and reopens it. */
  const [asks, setAsks] = useState<Record<string, AskChat>>({});
  const [end, setEnd] = useState<End | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Bumped by Try again after a card failed to load: loads the same card again, the session as it was. */
  const [loadTry, setLoadTry] = useState(0);
  /** Bumped by Try again after the session failed to start (`ore` down): starts it again. */
  const [startTry, setStartTry] = useState(0);
  const retryLoad = () => (queue ? setLoadTry : setStartTry)((n) => n + 1);
  const shownAt = useRef(Date.now());
  /** When the answer showed: a rating key right after it is the confidence key pressed twice. */
  const shownAnswerAt = useRef(0);
  const field = useRef<HTMLTextAreaElement>(null);
  const sureRef = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  // Closed (Esc, Done, Later on the last one), focus goes back to what started it, else to `giveBack`.
  useFocusWhileMounted(root, giveBack, !PHONE); // the phone's screens move focus their own way
  const reviewed = useRef(0);
  /** This window's session, named by id in every call: the main window and the quick quiz can each have
   *  one open (D76), and the last one started is not always this one. `open`: not ended yet. */
  const session = useRef<{ id: string; open: boolean } | null>(null);
  /** Settles once this showing's `session start` has: a rating waits for it, so it never goes in unnamed. */
  const sessionReady = useRef<Promise<unknown>>(Promise.resolve());
  /** False once Review has closed: ⌘Z and ⇧⌘Z on a rating from it then only change the log. */
  const mounted = useRef(false);
  /** Active time in this session, to end it when today's goal closes (D65). */
  const activeMs = useRef(0);
  const before = useRef<Today | null>(null);
  /** Today as the session started, for the quick quiz's ring. */
  const [start, setStart] = useState<Today | null>(null);
  /** The ratings of this session, newest last, to take back with ⌘Z one after another (Anki's Undo): each
   *  review's ts and the session as it was before it. */
  const [undos, setUndos] = useState<{ card: string; ts: string; queue: DueEntry[]; done: number; activeMs: number; off: Set<string>; won: boolean; forget: Forget }[]>([]);
  const last = undos.at(-1);
  /** Cards retired in this session: taking back a rating before one brings the queue back without it. */
  const retired = useRef(new Set<string>());
  /** Exercises put off this session (D192), by id: once every one left is, the session ends. A rating takes its own off. */
  const putOffIds = useRef(new Set<string>());
  /** An exercise ⌘Z brought back from Later: it shows again as he had it, not loaded afresh. */
  const restoreTo = useRef<{ id: string; was: Shown } | null>(null);
  /** The Laters on the app history: nothing is recorded, so once Review closes there is nothing to take back. */
  const laterSteps = useRef(new Set<Forget>());
  const undoLaterNow = useRef<(p: Put) => Promise<void> | null>(() => null);
  const redoLaterNow = useRef<(p: Put) => Promise<void> | null>(() => null);
  /** Ratings go on the app history (⌘Z) with every other step; while Review is open, taking back its
   *  newest rating also shows that card again. */
  /** The history's undo and redo of a rating while Review shows it: the write's promise, or null when it isn't Review's to do. */
  const undoNow = useRef<(ts: string) => Promise<void> | null>(() => null);
  const redoNow = useRef<(id: string, args: string[], rating: number, elapsed: number, again: { forget: Forget; setTs: (ts: string) => void }) => Promise<void> | null>(() => null);
  /** Counts card showings, so a grade or passage that lands after he moved on is dropped, not shown on the next card. */
  const showing = useRef(0);
  /** Counts grading runs, so a grade still on its way when the key points change is dropped. */
  const grading = useRef(0);
  /** What is on screen now, for a card edit (or its undo) that lands later. */
  const now = useRef({ card, answer, inHead, phase, marks, grade, draft });
  now.current = { card, answer, inHead, phase, marks, grade, draft };
  /** The card's words as the editor last loaded them: an undo refreshes the editor only if he hasn't typed since. */
  const loaded = useRef(draft);
  const entry = queue?.[0];
  /** For a press a Later passes on (`passOn`): the history's own keys, as he has them set. */
  const keymap = useKeymap();

  useEffect(() => {
    let live = true;
    setError(null);
    void (async () => {
      try {
        // Try again after `due` failed keeps the session already started: a second would be left open.
        if (!session.current?.open) {
          const started = ore<{ id: string }>("session", "start");
          sessionReady.current = started.catch(() => {});
          const s = await started;
          // Closed before the session began: it ends at once, as leaving would have ended it.
          if (!live) return void ore("session", "end", s.id).catch(() => {});
          session.current = { id: s.id, open: true };
        }
        const t = ore<Today>("today").then((t) => {
          before.current = t;
          setStart(t);
        }, () => {});
        // --start: a session opens on a likely recall (D176); the quick quiz asks the card that is next.
        const q = await ore<DueEntry[]>("due", ...(quick ? [] : ["--start"]), ...pickArgs(pick, source));
        // An empty queue ends the session at once, and why ("nothing due in the skills you picked",
        // new cards waiting) reads today: let it land first.
        if (!q.length) await t;
        asDots.current = q.length <= 30;
        setQueue(q);
      } catch (e) {
        setError(errorText(e));
      }
    })();
    mounted.current = true;
    return () => {
      live = false;
      mounted.current = false;
    };
  }, [pick, source, startTry]);
  // Gone any other way than Esc or Done (a click away from the quick quiz, Open in source from it):
  // this session ends, by its id, never another window's. Try again keeps it.
  useEffect(() => () => {
    const s = session.current;
    if (s?.open) void ore("session", "end", s.id).catch(() => {});
    session.current = null;
  }, [pick, source]);

  // Closed: a Later recorded nothing, so ⌘Z after it has nothing of Review's to take back.
  useEffect(() => () => {
    for (const f of laterSteps.current) f();
    laterSteps.current.clear();
  }, []);

  // The quick quiz (D76) rated cards while this window waited: the ones no longer due drop out, so none
  // comes up twice. Past the day's new-card limits, so a draft it didn't rate stays; the card on screen
  // goes only if he hasn't started on it.
  useEffect(() => {
    if (quick || PHONE) return;
    const un = listen("quiz-closed", () => {
      ore<DueEntry[]>("due", "--all", ...pickArgs(pick, source)).then((fresh) => {
        const due = new Set(fresh.map((e) => e.id));
        const s = now.current;
        const started = s.phase !== "answer" || !!s.answer.trim();
        setQueue((q) => q && (q.every((e) => due.has(e.id)) ? q : q.filter((e, i) => due.has(e.id) || (i === 0 && started))));
      }, () => {});
    });
    return () => void un.then((f) => f());
  }, [quick, pick, source]);

  /** A fresh start on a card: no answer, no marks, its clock not yet started. */
  const reset = () => {
    showing.current++;
    setPhase("answer");
    setAnswer("");
    setConf(undefined);
    setAskSure(false);
    setGrade(null);
    setHoverPoint(null);
    setFocusPoint(null);
    setGradeError(null);
    setMarks(null);
    setRemark(false);
    setInHead(false);
    setPassage(null);
    setPassageGone(null);
    setAsking(false);
    setPreview(undefined);
    setGuard(undefined);
  };

  /** The next card, loaded while he answers this one, so a rating moves on without waiting for it. Only
   *  a rating arms it (`submit`); anything else that moves the queue or changes a card (an undo, an edit,
   *  a retire, a version dropped, Try again) drops it, and that card loads afresh. */
  const ahead = useRef<{ id: string; card: Promise<CardFull>; armed: boolean } | null>(null);
  /** Shows an exercise as Later found it (`Shown`), its clock where it was. */
  const showAgain = (s: Shown) => {
    dropAhead();
    setCard(s.card);
    setPhase(s.phase);
    setAnswer(s.answer);
    setConf(s.conf);
    setInHead(s.inHead);
    setGrade(s.grade);
    setMarks(s.marks);
    setRemark(s.remark);
    setGradeError(s.gradeError);
    setPassage(s.passage);
    setQuoteAt(s.quoteAt);
    setPassageGone(s.passageGone);
    setAsking(s.asking);
    shownAt.current = Date.now() - s.elapsed;
    shownAnswerAt.current = 0;
    // Put off before its passage landed: that reply was dropped as it moved on, so it loads now.
    if (s.phase === "checked" && !s.passage && !s.passageGone) loadPassage(s.card);
  };
  const dropAhead = () => void (ahead.current = null);
  const loadCard = (id: string) => ore<CardFull>("card", "show", id, "--review");
  // Each card: load the version to review (a remix in its turn, D66), reset the answer, start its clock.
  useEffect(() => {
    if (!entry) return;
    let live = true;
    setCard(null);
    setError(null);
    reset();
    const back = restoreTo.current?.id === entry.id ? restoreTo.current.was : null;
    restoreTo.current = null;
    if (back) return void showAgain(back);
    // The card loaded ahead, if a rating or Later just moved on to it; one whose early load failed loads again.
    const early = ahead.current?.armed && ahead.current.id === entry.id ? ahead.current.card : undefined;
    dropAhead();
    (early ? early.catch(() => loadCard(entry.id)) : loadCard(entry.id)).then(
      (c) => {
        if (!live) return;
        setCard(c);
        const draft = c.kind === "prompt" ? draftFor(c) : undefined;
        setAnswer(draft?.text ?? "");
        setConf(draft?.conf);
        shownAt.current = Date.now();
      },
      (e) => live && setError(errorText(e)),
    );
    return () => {
      live = false;
    };
  }, [entry, loadTry]);

  // Once this card is on screen, the one after it loads.
  const nextUp = queue?.[1]?.id;
  useEffect(() => {
    if (!card || card.id !== entry?.id || !nextUp || ahead.current?.id === nextUp) return;
    const slot = { id: nextUp, card: loadCard(nextUp), armed: false };
    slot.card.catch(() => ahead.current === slot && dropAhead());
    ahead.current = slot;
  }, [card, entry, nextUp]);

  useEffect(() => {
    if (paused) return;
    if (card && phase === "answer") (card.kind === "prompt" && !PHONE ? field.current : root.current)?.focus({ preventScroll: true });
    if (phase === "checked") root.current?.focus({ preventScroll: true });
  }, [card, phase, paused]);

  /** Ends the session; `endScreen` shows the end screen if he rated anything (never on leaving the quick quiz). */
  const finish = useCallback(async (endScreen = true) => {
    if (busyNow.current) return;
    const s = session.current;
    // Left before the session began: closing ends it once it has.
    if (!s?.open) return onClose();
    setBusy(true);
    try {
      const receipt = await ore<SessionEnd>("session", "end", s.id);
      s.open = false;
      if (reviewed.current && !endScreen) return onClose();
      if (!reviewed.current) {
        if (quick) return onClose();
        // Left before rating anything while cards were waiting: just close, they stay due.
        if (queue?.length) return onClose();
        // Nothing came up (all caught up, or the picked skills have nothing due): say so, never just vanish.
        notify(nothingDue(before.current, pick, source));
        return onClose();
      }
      // The try line is a nicety: the end screen never waits on or fails for it.
      const next = ore<Try[]>("tries").then((ts) => ts.filter((t) => t.status === "open").at(-1) ?? null, () => null);
      setEnd({ session: receipt, today: await ore<Today>("today"), before: before.current, next: await next });
    } catch (e) {
      notify(errorText(e), "error");
      onClose();
    } finally {
      setBusy(false);
    }
  }, [notify, onClose, queue, quick, pick, source]);

  useEffect(() => {
    // The quick quiz with nothing due says so and waits for Esc instead of closing under his hand.
    // Again once the last rating has saved: the queue can empty while it still is (the phone's `ore` runs in the
    // page, so the rating saves inside the tap's own event and the queue renders before it is done).
    if (queue && !queue.length && !end && !busy && !(quick && !reviewed.current)) void finish();
  }, [queue, end, finish, quick, busy]);

  /** ⌘Z presses while a rating saved or the session wrapped up: they go to the history once that is
   *  done, so they take back the newest steps (that rating first), never an older card's meanwhile. */
  const undosWaiting = useRef<{ n: number; key: KeyboardEventInit }>({ n: 0, key: {} });
  const sendUndos = () => {
    const w = undosWaiting.current;
    const n = w.n;
    w.n = 0;
    // While the first is taken back Review is busy again, so the rest queue up anew and wait their turn.
    for (let i = 0; i < n; i++) document.body.dispatchEvent(new KeyboardEvent("keydown", { ...w.key, bubbles: true, cancelable: true }));
  };
  useEffect(() => {
    if (!busy && !busyNow.current && undosWaiting.current.n) sendUndos();
  }, [busy]);
  // Closed with presses still waiting (a click away from the quick quiz): the history still gets them.
  useEffect(
    () => () => {
      if (!undosWaiting.current.n) return;
      if (busyNow.current) whenIdle.current = sendUndos;
      else setTimeout(sendUndos);
    },
    [],
  );

  /** The passage the card came from, shown only after the answer (D59). */
  const loadPassage = (c: CardFull) => {
    setQuoteAt(0);
    const at = showing.current;
    ore<{ title: string; body: string; annotations: Annotation[] }>("show", c.item).then(
      (s) => {
        if (at !== showing.current) return;
        if (c.evidence?.length)
          return setPassage({ item: c.item, title: s.title, quotes: c.evidence.map((e) => ({ text: passageText(e.exact.replace(/\[[\d:.]+\]\s*/g, "")), at: `q:${e.start}:${e.end}`, time: stampBefore(s.body, e.start) })) });
        const a = c.annotation ? s.annotations.find((x) => x.id === c.annotation && x.status !== "deleted") : undefined;
        setPassage({ item: c.item, title: s.title, quotes: a ? [{ text: passageText(a.exact), at: a.id }] : [] });
      },
      (e) => {
        if (at !== showing.current) return;
        const why = errorText(e);
        setPassageGone(/no item matches/.test(why) ? "Its source is no longer in the library." : `Couldn’t load its source. ${why}`);
      },
    );
  };

  /** What a confidence pick finishes when ⌘↵ or ⌥↵ asked for it first. */
  const pending = useRef<"check" | "head">("check");

  /** ⌥↵ on a card he has passed twice (D68): show the answer and key points for him to mark. */
  const answerInHead = () => {
    if (!card || phase !== "answer" || !card.in_head_ok) return;
    if (conf === undefined) {
      pending.current = "head";
      setAskSure(true);
      sureRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      return;
    }
    setAnswer("");
    setInHead(true);
    setMarks(card.rubric.map(() => undefined));
    setPhase("checked");
    shownAnswerAt.current = Date.now();
    loadPassage(card);
  };

  const check = async (noIdea = false) => {
    if (!card || phase !== "answer") return;
    // ⌘↵ with nothing typed does what the disabled Check button does: nothing (⌘⌫ is No idea).
    if (card.kind === "prompt" && !noIdea && !answer.trim()) return;
    if (card.kind === "prompt" && !noIdea && conf === undefined) {
      // ⌘↵ before saying how sure: ask, and 1–3 then checks.
      pending.current = "check";
      setAskSure(true);
      sureRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      return;
    }
    if (noIdea) {
      setAnswer("");
      setConf(1);
    }
    setPhase("checked");
    shownAnswerAt.current = Date.now();
    loadPassage(card);
    if (card.kind !== "prompt") return;
    if (noIdea) {
      setMarks(card.rubric.map(() => false));
      return;
    }
    void runGrade();
  };

  /** Asks the AI to mark his answer. If it can't, he marks the key points himself (as for an
   *  in-head answer, D68) or tries again. */
  const runGrade = async () => {
    if (!card) return;
    setGradeError(null);
    setMarks(null);
    setRemark(false);
    const at = showing.current;
    const run = ++grading.current;
    const stale = () => at !== showing.current || run !== grading.current;
    const failed = (why: string) => {
      if (stale()) return;
      setGradeError(why);
      setMarks(card.rubric.map(() => undefined));
    };
    try {
      const g = await ore<Grade>("grade", card.id, opt("answer", answer), ...variantOpt(card));
      if (stale()) return;
      // Marks that don't line up with the rubric can't be trusted: no suggestion, he marks them himself.
      if (g.covered.length !== card.rubric.length) return failed("Couldn’t check this one: the marks didn’t match the key points.");
      setGrade(g);
      setMarks(g.covered);
    } catch (e) {
      // Say why (AI signed out, offline, timed out), so he knows whether a retry can work.
      const why = errorText(e);
      failed(e instanceof TypeError || e instanceof SyntaxError ? "Couldn’t check this one: got an unexpected reply." : `Couldn’t check this one. ${why}${/[.!?]$/.test(why) ? "" : "."}`);
    }
  };

  /** His words that earned key point i, as the grader quoted them; none once he marks it missed. A grade
   *  is dropped when the key points change, so its evidence always lines up with them. */
  const quoteFor = (i: number) => (marks?.[i] && grade?.evidence?.[i]) || "";
  const shown = hoverPoint ?? focusPoint;
  const shownQuote = shown === null ? "" : quoteFor(shown);

  /** The rating to highlight: the AI's, or (once he flips a mark) one that follows his marks. Never logged by itself (D21). */
  const suggested = ((): number | undefined => {
    if (!card || phase !== "checked") return undefined;
    if (card.kind === "card") return 3; // D59: ↵ is Good on a Fact card
    if (inHead || gradeError) {
      // His own marks decide; nothing is suggested until he marks one.
      if (remark || !marks || marks.every((m) => m === undefined)) return undefined;
      const got = marks.filter(Boolean).length;
      return got === marks.length ? 3 : got ? 2 : 1;
    }
    if (!answer.trim()) return 1;
    if (!grade || !marks) return undefined;
    if (marks.every((m, i) => m === grade.covered[i])) return grade.rating;
    const got = marks.filter(Boolean).length;
    return got === marks.length ? Math.max(3, grade.rating) : got ? 2 : 1;
  })();

  // A rating waits only for what the marks say now: when they change, it stops waiting.
  useEffect(() => setGuard(undefined), [suggested]);

  const advance = (again: boolean) => setQueue((q) => q && afterAnswer(q, again));

  const rate = async (rating: number) => {
    if (!card || phase !== "checked" || busyNow.current) return;
    // D237: his rating is the one recorded (D21), but Good or Easy over a miss, by his own marks, takes a second
    // press, so a slip of the finger can't turn a gem that should come loose into a cut one.
    // The second press is a decision, so one that lands within the first's double click doesn't count. With nothing
    // to go by yet (the check still running, or no mark of his own), there is no guard: that rating is his alone.
    if (card.kind !== "card" && suggested !== undefined && rating >= suggested + 2 && (guard !== rating || Date.now() - guardAt.current < GUARD_MS)) {
      if (guard !== rating) guardAt.current = Date.now();
      return void setGuard(rating);
    }
    const after = momentFor(card.history, rating as 1 | 2 | 3 | 4, { sure: conf === 3, remix: !!card.variant });
    const color = entry ? skillOf(entry.skills[0] ?? "").color : undefined;
    setBusy(true);
    let goalClosed = false;
    try {
      const elapsed = Date.now() - shownAt.current;
      await sessionReady.current;
      const args = [
        card.id,
        opt("rating", String(rating)),
        opt("confidence", String(conf ?? 2)),
        ...(answer.trim() ? [opt("answer", answer)] : []),
        ...(grade ? [opt("ai-rating", String(grade.rating)), ...(grade.ai ? [opt("ai-by", `${grade.ai.vendor} ${grade.ai.model} ${grade.ai.prompt_version}`)] : [])] : []),
        opt("elapsed-ms", String(elapsed)),
        ...variantOpt(card),
        ...(inHead ? ["--in-head"] : []),
        ...(session.current ? [opt("session", session.current.id)] : []),
      ];
      await submit(args, rating, elapsed);
      // An everyday rating leaves a moment still showing to run its time.
      if (after) setMoment({ ...after, n: Date.now(), color });
      drafts.delete(card.id);
      // The session is today's slice (D65): it ends when the goal closes, and Keep going goes on.
      const b = before.current;
      goalClosed = !!b && b.counts && !b.met && b.active_ms + activeMs.current >= b.goal_ms;
    } catch (e) {
      notify(errorText(e), "error");
    } finally {
      setBusy(false);
    }
    if (!goalClosed) return;
    // D177: a goal that closes on a miss gets one more card first, a likely recall, so the session doesn't
    // end on a failure. Once only: whatever he answers next, it ends.
    const win = rating === 1 && !wonLast.current ? lastWin(afterAnswer(queue ?? [], true)) : null;
    if (!win) return void finish();
    wonLast.current = true;
    setQueue(win);
  };

  /** Records a rating and moves on. The first time (`forget` absent) it goes on the app history, so
   *  ⌘Z takes it back and ⇧⌘Z gives it again: the same rating, answer and time. Throws if the write fails. */
  const submit = async (args: string[], rating: number, elapsed: number, again?: { forget: Forget; setTs: (ts: string) => void }) => {
    const was = { queue: queue ?? [], done, activeMs: activeMs.current, off: new Set(putOffIds.current), won: wonLast.current };
    const r = await ore<{ ts: string }>("review", ...args);
    reviewed.current++;
    const id = args[0]!;
    // Answered: a miss's relearn pass is a new turn, not one he put off.
    putOffIds.current.delete(id);
    let ts = r.ts;
    again?.setTs(ts);
    const setTs = (t: string) => void (ts = t);
    const forget: Forget =
      again?.forget ??
      notify(
        "Rating",
        "quiet",
        // With Review closed, only the log changes (its session stays ended), and Home reads its numbers again.
        (): Promise<unknown> => {
          return (mounted.current && undoNow.current(ts)) || ore("review", id, opt("undo", ts)).then(() => onLogged?.());
        },
        (): Promise<unknown> => {
          // Given again after Review closed: its session has ended, so the rating goes in with none.
          return (
            (mounted.current && redoNow.current(id, args, rating, elapsed, { forget, setTs })) ||
            ore<{ ts: string }>("review", ...args.filter((a) => !a.startsWith("--session="))).then((x) => (setTs(x.ts), onLogged?.()))
          );
        },
      );
    setUndos((u) => [...u, { card: id, ts: r.ts, ...was, forget }]);
    // Every rating is a step, a miss too: a rating always moves "Exercise N of M" on, and a miss adds its retry
    // as one more step (D59).
    setDone((n) => n + 1);
    if (ahead.current) ahead.current.armed = true;
    advance(rating === 1);
    activeMs.current += Math.min(elapsed, ACTIVE_CAP_MS);
  };

  /** ⌘Z: takes back the last rating and shows that card again, unanswered. On the end screen it
   *  opens the session again, back on that card (Anki's Undo after Congratulations). */
  const undoRating = async () => {
    if (!last || busyNow.current) return;
    setMoment(null);
    dropAhead();
    last.forget();
    setBusy(true);
    try {
      await ore("review", last.card, opt("undo", last.ts));
      if (end) {
        await ore("session", "reopen", end.session.id);
        if (session.current) session.current.open = true;
        setEnd(null);
      }
      reviewed.current--;
      activeMs.current = last.activeMs;
      putOffIds.current = new Set(last.off);
      // D177's one more goes with the rating that earned it.
      wonLast.current = last.won;
      setDone(last.done);
      setQueue(last.queue.filter((e) => !retired.current.has(e.id)));
      setUndos((u) => u.slice(0, -1));
    } finally {
      // A failure goes to the history, which puts the step back and says why.
      setBusy(false);
    }
  };

  undoNow.current = (ts) => (last?.ts === ts ? undoRating() : null);
  // ⇧⌘Z right after ⌘Z: that card is showing again, so the rating goes in again and Review moves on.
  redoNow.current = (id, args, rating, elapsed, again) => {
    if (end || busyNow.current || queue?.[0]?.id !== id) return null;
    setBusy(true);
    return submit(args, rating, elapsed, again).finally(() => setBusy(false));
  };

  /** What he has on screen, for ⌘Z after a Later. An Explain answer still being checked comes back to check
   *  again (that grade is dropped as it moves on), with what he typed and how sure he was. */
  const shownNow = (c: CardFull): Shown => {
    const base = { card: c, answer, conf, elapsed: Date.now() - shownAt.current };
    if (phase !== "checked" || (c.kind === "prompt" && !inHead && !marks && !gradeError))
      return { ...base, phase: "answer", inHead: false, grade: null, marks: null, remark: false, gradeError: null, passage: null, quoteAt: 0, passageGone: null, asking: false };
    // Ask open (D192): it comes back open, its chat kept as closing and opening it keeps it.
    return { ...base, phase: "checked", inHead, grade, marks, remark, gradeError, passage, quoteAt, passageGone, asking };
  };

  /** Later (D192, Anki's Bury for this session): the exercise goes to the end of the session, before or after
   *  its answer, and nothing is recorded: no rating, no review line, no FSRS change (D21, D22), no minutes.
   *  When every exercise left has been put off the session ends, and they stay due. What he typed and how sure
   *  he was wait for it in `drafts`, as on Esc. On the app history: ⌘Z brings it back as it was, ⇧⌘Z puts it
   *  off again (`redo`). */
  const later = (redo?: Put): boolean => {
    if (!card || card.id !== entry?.id || !queue || phase === "edit" || end || busyNow.current) return false;
    const p: Put = Object.assign(redo ?? ({} as Put), { id: card.id, before: queue, after: putOff(queue, putOffIds.current), off: new Set(putOffIds.current), won: wonLast.current, shown: shownNow(card) });
    putOffIds.current.add(card.id);
    // D177's one more after a miss was this one: put off, it is no answer, so the next one he answers takes that turn.
    wonLast.current = false;
    if (!redo) {
      p.forget = notify("Later", "quiet", () => (mounted.current && undoLaterNow.current(p)) || passOn(p, "undo"), () => (mounted.current && redoLaterNow.current(p)) || passOn(p, "redo"));
      laterSteps.current.add(p.forget);
    }
    if (!p.after) {
      void finish();
      return true;
    }
    if (ahead.current) ahead.current.armed = true;
    setQueue(p.after);
    return true;
  };
  /** A Later the session has moved past (its exercise has left the session: answered in the quick quiz, retired
   *  on its next turn): nothing is left to take back, so it leaves the history and the press goes on to the step
   *  before it, never spent on nothing. */
  const passOn = (p: Put, what: "undo" | "redo") => {
    setTimeout(() => {
      if (p.forget) {
        p.forget();
        laterSteps.current.delete(p.forget);
      }
      document.body.dispatchEvent(keydownFor(keymap[what]));
    });
    return Promise.resolve();
  };
  // ⌘Z after a Later: the exercise is the current one again, as he had it, wherever the session has put it since
  // (a step since, like a Retire, may have moved the rest). One that ended the session opens it again on it.
  undoLaterNow.current = (p) => {
    if (!queue) return null;
    if (busyNow.current) return Promise.reject(new Error("Still saving. Try again in a moment."));
    const at = queue.findIndex((e) => e.id === p.id);
    if (at < 0 || (end && at !== 0)) return null;
    putOffIds.current = new Set(p.off);
    wonLast.current = p.won;
    if (end) {
      const id = end.session.id;
      setBusy(true);
      return ore("session", "reopen", id)
        .then(() => {
          if (session.current) session.current.open = true;
          // Its clock goes on from the Later, so the time on the end screen never counts (D60).
          shownAt.current = Date.now() - p.shown.elapsed;
          setEnd(null);
        })
        .finally(() => setBusy(false));
    }
    dropAhead();
    restoreTo.current = { id: p.id, was: p.shown };
    setQueue([queue[at]!, ...queue.slice(0, at), ...queue.slice(at + 1)]);
    return Promise.resolve();
  };
  redoLaterNow.current = (p) => (queue?.[0]?.id === p.id && later(p) ? Promise.resolve() : null);

  const retire = async () => {
    if (!card || busyNow.current) return;
    dropAhead();
    setBusy(true);
    try {
      await ore("card", "retire", card.id);
      const { id, state } = card;
      retired.current.add(id);
      drafts.delete(id); // what he typed goes with it
      notify(
        entry?.state === "draft" ? "Exercise deleted" : "Exercise retired",
        "info",
        async () => {
          if (state === "retired") return;
          dropAhead();
          return ore("card", "restore", id, opt("state", state)).then(() => {
            retired.current.delete(id);
            notify("Exercise restored. It comes back in a later review.");
          });
        },
        () => (dropAhead(), ore("card", "retire", id).then(() => void retired.current.add(id))),
      );
      advance(false);
    } catch (e) {
      notify(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  };

  /** B, Bad version (D66): drops the remix without logging a review and shows the original. */
  const badVersion = async () => {
    if (!card?.variant || busyNow.current) return;
    dropAhead();
    setBusy(true);
    try {
      const { id, variant } = card;
      await ore("variant", "reject", id, variant);
      const original = await ore<CardFull>("card", "show", id);
      reset();
      setCard(original);
      shownAt.current = Date.now();
      notify(
        "Dropped that version. Here’s the original.",
        "info",
        () => (dropAhead(), ore("variant", "restore", id, variant)),
        () => (dropAhead(), ore("variant", "reject", id, variant)),
      );
    } catch (e) {
      notify(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const edit = () => {
    if (!card) return;
    loaded.current = { question: card.question, answer: card.answer, points: card.rubric.join("\n") };
    setDraft(loaded.current);
    setPhase("edit");
  };

  /** A card's new wording, and an Explain card's key points when given, on the history: undo puts the old
   *  ones back (and on screen, if it still is). */
  const setText = async (c: CardFull, question: string, answer: string, rubric?: string[], undoable = true) => {
    const was = { question: c.question, answer: c.answer, rubric: rubric && c.rubric };
    dropAhead();
    const saved = await ore<CardFull>("card", "set", c.id, opt("question", question), opt("answer", answer), ...(rubric ?? []).map((p) => opt("point", p)), ...variantOpt(c));
    const s = now.current;
    setCard((cur) => (cur?.id === c.id ? saved : cur));
    // New key points: the AI's grade was for the old ones, so it goes (and one still on its way). A point
    // whose words stayed keeps its mark; a changed one waits for his. "No idea" still missed them all.
    if (rubric && s.card?.id === c.id && s.phase !== "answer" && saved.rubric.join("\n") !== s.card.rubric.join("\n")) {
      const noIdea = !s.answer.trim() && !s.inHead;
      const marked = new Map(s.card.rubric.map((p, i) => [p, s.marks?.[i]]));
      grading.current++;
      setGrade(null);
      setMarks(saved.rubric.map((p) => (noIdea ? false : marked.get(p))));
      // Marks carried over from the AI's grade are its, not his: he marks again before a suggestion.
      if (!noIdea) setRemark(!!s.grade || saved.rubric.some((p) => !marked.has(p)));
      if (!noIdea && !s.inHead) setGradeError(KEY_POINTS_CHANGED);
    }
    // The editor open on this card (an undo landed meanwhile): it shows the card as it now is.
    const d = s.draft, l = loaded.current;
    if (s.card?.id === c.id && s.phase === "edit" && d.question === l.question && d.answer === l.answer && d.points === l.points) {
      loaded.current = { question: saved.question, answer: saved.answer, points: saved.rubric.join("\n") };
      setDraft(loaded.current);
    }
    if (undoable) {
      const put = (w: typeof was) => () => setText(c, w.question, w.answer, w.rubric, false);
      notify("Exercise edit", "quiet", put(was), put({ question, answer, rubric }));
    }
  };

  const draftPoints = draft.points.split("\n").map((p) => p.trim()).filter(Boolean);
  const draftOk = !!draft.question.trim() && !!draft.answer.trim() && (card?.kind !== "prompt" || draftPoints.length > 0);

  const saveEdit = async () => {
    if (!card || busyNow.current || !draftOk) return;
    setBusy(true);
    try {
      await setText(card, draft.question, draft.answer, card.kind === "prompt" ? draftPoints : undefined);
      setPhase("checked");
    } catch (e) {
      notify(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const pickSure = (n: number) => {
    setConf(n);
    if (card?.kind === "prompt") keepDraft(card, answer, n);
    if (card?.kind === "card") {
      setPhase("checked");
      shownAnswerAt.current = Date.now();
      loadPassage(card);
    } else if (askSure) {
      setAskSure(false);
      // Check (or reveal for an in-head answer) with the confidence just picked.
      setTimeout(() => document.getElementById(pending.current === "head" ? "review-head" : "review-check")?.click());
    }
  };

  if (leave) leave.current = () => finish(false);
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (paused || under) return;
    if (is(e, "undo") && busyNow.current && !((e.target as HTMLElement).isContentEditable || ownsUndo(e.target))) {
      // The step it should take back isn't on the history yet (or is being taken back): it waits.
      e.preventDefault();
      e.stopPropagation();
      undosWaiting.current.n++;
      undosWaiting.current.key = { code: e.code, key: e.key, metaKey: e.metaKey, ctrlKey: e.ctrlKey, altKey: e.altKey, shiftKey: e.shiftKey };
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (phase === "edit") {
        if (!busy) setPhase("checked");
      }
      else if (asking) {
        setAsking(false);
        root.current?.focus({ preventScroll: true });
      }
      else if (end) onClose();
      else void finish(!quick);
      return;
    }
    // Enter on a focused control (Again, Edit card, Open in source, Undo) is that control's; Enter's
    // shortcuts below are for the Review surface itself.
    const onSurface = e.target === root.current || e.target === document.body;
    // A held ↵ gave the last rating once; its repeats never press Done (focused) or Try again.
    if ((end || !card) && e.key === "Enter" && e.repeat) return e.preventDefault();
    if (end) {
      if (e.key === "Enter" && onSurface) {
        e.preventDefault();
        onClose();
      }
      return;
    }
    if (!card) {
      if (e.key === "Enter" && onSurface && error && (entry || !queue)) {
        e.preventDefault();
        retryLoad();
      }
      return;
    }
    if (phase === "edit") {
      if (is(e, "finish")) {
        e.preventDefault();
        void saveEdit();
      }
      return;
    }
    if (is(e, "retire-card")) {
      e.preventDefault();
      void retire();
      return;
    }
    if (is(e, "later")) {
      e.preventDefault();
      // A held ⌘L puts off the one on screen, never the ones after it.
      if (!e.repeat) later();
      return;
    }
    if (phase === "answer") {
      if (is(e, "no-idea") && card.kind === "prompt") {
        e.preventDefault();
        void check(true);
      } else if (is(e, "in-head") && card.in_head_ok) {
        e.preventDefault();
        answerInHead();
      } else if (is(e, "finish") && card.kind === "prompt") {
        e.preventDefault();
        void check();
      } else if (!inTextField(e) && !e.metaKey && !e.ctrlKey && !e.altKey && /^Digit[1-3]$/.test(e.code)) {
        e.preventDefault();
        pickSure(Number(e.code.slice(5)));
      }
      return;
    }
    if (inTextField(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.repeat || Date.now() - shownAnswerAt.current < 300) return;
    if (/^Digit[1-4]$/.test(e.code)) {
      e.preventDefault();
      void rate(Number(e.code.slice(5)));
    } else if (e.key === "Enter" && suggested && onSurface) {
      e.preventDefault();
      void rate(suggested);
    } else if (is(e, "edit-card")) {
      e.preventDefault();
      edit();
    } else if (is(e, "ask") && !PHONE) {
      e.preventDefault();
      setAsking(true);
    } else if (is(e, "bad-version") && card.variant) {
      e.preventDefault();
      void badVersion();
    } else if (passage && (is(e, "passage-next") || is(e, "passage-prev"))) {
      e.preventDefault();
      setQuoteAt((i) => Math.max(0, Math.min(passage.quotes.length - 1, i + (is(e, "passage-next") ? 1 : -1))));
    }
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", on, true);
    return () => window.removeEventListener("keydown", on, true);
  }, []);

  const left = queue?.length ?? 0;
  const progress = done + left ? done / (done + left) : 0;
  const skillOf = (id: string): Skill => skills.find((k) => k.id === id) ?? { id, name: id };
  const sureMiss = phase === "checked" && conf === 3 && suggested !== undefined && suggested <= 2;

  return (
    // A full-window sheet: Tab and ⇧Tab stay on the card, never in the hidden app behind it. Let go while a
    // layer sits over it (⌘K, ⌘/) or it is paused on a source, so that layer owns focus and Esc.
    <Trap off={paused || under}>
    <div className="review" ref={root} tabIndex={-1} role="dialog" aria-modal={!paused} aria-label="Review" hidden={paused} data-gives-back="">
      <div className="review-head" data-tauri-drag-region>
        {quick ? (
          // The quick quiz has no fixed length; what matters is that it counts toward today's goal (D60).
          start && !end && start.counts && (
            <Hint text={`${minutes(start.active_ms + activeMs.current)} of ${start.goal_minutes} minutes today`}>
              <div className="quick-ring">
                <Ring value={start.goal_ms ? (start.active_ms + activeMs.current) / start.goal_ms : 0} met={start.met} size={22} label={`${minutes(start.active_ms + activeMs.current)} of ${start.goal_minutes} minutes today`} />
              </div>
            </Hint>
          )
        ) : asDots.current && !end ? (
          <div className="quiz-steps review-steps" role="progressbar" aria-label="Session" aria-valuemin={0} aria-valuemax={done + left} aria-valuenow={done}>
            {Array.from({ length: done + left }, (_, i) => (
              <span key={i} className={i < done ? "done" : i === done ? "now" : ""} />
            ))}
          </div>
        ) : (
          <div className="review-bar" role="progressbar" aria-label="Session" aria-valuemin={0} aria-valuemax={done + left} aria-valuenow={done}>
            {/* 6px dots: 60 need 360px, which the phone's head does not have. */}
            <DotBar className="review-dots" share={end ? 1 : progress} n={PHONE ? 30 : 60} />
          </div>
        )}
        {last && (
          <Hint text="Undo last rating" keys="undo">
            <button className="quiz-close" aria-label="Undo last rating" disabled={busy} onClick={() => last?.forget.undo()}>
              <ArrowCounterClockwise size={16} weight="bold" aria-hidden="true" />
            </button>
          </Hint>
        )}
        {/* The phone's exercise actions, one ⋯ as Mail's and Notes' (D235): Later before or after the answer, Edit
            once the answer is out (before, it would show it), and Retire. The Mac's toolbar under the answer
            holds them there, with Ask, which needs the Mac's AI (D7). */}
        {PHONE && card && entry && !end && phase !== "edit" && (
          <MoreButton
            className="quiz-close"
            label="Exercise actions"
            actions={() => [
              { id: "later", label: "Later", run: () => void later() },
              ...(phase !== "answer" ? [{ id: "edit", label: "Edit exercise", run: edit }] : []),
              ...(phase !== "answer" && card.variant ? [{ id: "bad-version", label: "Bad version: show the original", run: () => void badVersion() }] : []),
              entry.state === "draft"
                ? { id: "retire", label: "Delete exercise", danger: true, divider: true, run: () => void retire() }
                : { id: "retire", label: "Retire exercise", danger: true, divider: true, run: () => void retire() },
            ]}
          />
        )}
        <Hint text={<>Leave review <kbd>Esc</kbd></>}>
          <button className="quiz-close" aria-label="Leave review" onClick={() => (end ? onClose() : void finish(!quick))}>
            <X size={16} weight="bold" aria-hidden="true" />
          </button>
        </Hint>
      </div>

      {/* VoiceOver hears each new card and the key points as marked (by the AI, or by him), not only the end screen. */}
      <div className="sr-only" aria-live="polite">
        {card && !end && queue?.length ? `Exercise ${done + 1} of ${done + left}. ${card.question.replace(/_{4,}/g, "blank")}${marks?.some((m) => m !== undefined) ? `. Marked ${marks.filter(Boolean).length} of ${marks.length} key points` : ""}` : ""}
      </div>
      <div className="review-body">
        {error && (
          <p className="err">
            {error}
            {(!queue || (entry && !card)) && (
              <>
                {" "}
                <Hint text={<>Try again <kbd>↵</kbd></>}>
                  <button className="link" autoFocus onClick={retryLoad}>
                    Try again
                  </button>
                </Hint>
              </>
            )}
          </p>
        )}
        {!error && !end && (!queue || (entry && !card)) && <p className="loading"><Working label="Getting your exercises…" /></p>}
        {!error && !end && queue && !queue.length && reviewed.current > 0 && <p className="loading"><Working label="Wrapping up…" /></p>}
        {quick && !error && queue && !queue.length && !reviewed.current && <p className="loading">{nothingDue(start, pick, source)}</p>}

        {moment && !end && (
          <div className="review-moment" key={moment.n} data-tone={moment.tone} data-color={moment.color} role="status">
            {!quick && <span className="moment-mole"><Mole bare size={40} mood={moment.tone === "miss" ? "peek" : "happy"} /></span>}
            <span className="moment-gem" aria-hidden="true">
              <Gem kind={moment.from.kind} size={36} seam={moment.from.seam} polished={moment.from.polished} />
              <Gem kind={moment.to.kind} size={36} seam={moment.to.seam} polished={moment.to.polished} />
            </span>
            <span className="moment-text">
              {moment.days > 0 && <b>+{moment.days} {moment.days === 1 ? "day" : "days"}</b>}
              <span>{moment.line}</span>
            </span>
          </div>
        )}
        {end && <EndScreen end={end} skills={skills} quick={quick} onDone={() => onClose()} onAgain={() => onClose(true)} onTry={(t) => (onClose(), onOpenSource(t.item, t.id))} />}

        {!end && card && entry && (
          <div className="review-card" key={`${card.id}-${done}-${left}`}>
            <div className="review-meta">
              {entry.skills.map((s) => (
                <SkillChip key={s} skill={skillOf(s)} />
              ))}
              {entry.state === "draft" && (
                <Hint text="First time you see this exercise">
                  <span className="review-new">New</span>
                </Hint>
              )}
              {entry.relearn && (
                <Hint text="Back for another try">
                  <span className="review-new again">Again</span>
                </Hint>
              )}
            </div>

            {phase === "edit" ? (
              <EditCard draft={draft} setDraft={setDraft} points={card.kind === "prompt"} ok={draftOk} busy={busy} onSave={() => void saveEdit()} onCancel={() => setPhase("checked")} />
            ) : (
              <h1 className="review-q">{card.question}</h1>
            )}
            {card.figure && card.figure_file && phase !== "edit" && <Occluded file={card.figure_file} box={card.figure.box} shown={phase === "checked"} />}

            {phase === "answer" && card.kind === "prompt" && (
              <>
                <Grow
                  ref={field}
                  // In the empty answer field there is no text to undo, so ⌘Z walks the app history.
                  data-app-undo={answer ? undefined : ""}
                  className="field quiz-answer"
                  aria-label="Your answer"
                  placeholder="In your own words…"
                  value={answer}
                  onChange={(e) => {
                    setAnswer(e.target.value);
                    keepDraft(card, e.target.value, conf);
                  }}
                />
                <div className={`quiz-label${askSure ? " ask" : ""}`} id="review-sure">
                  How sure are you?
                </div>
                <Sure refEl={sureRef} conf={conf} onPick={(n) => (conf === n ? (setConf(undefined), keepDraft(card, answer)) : pickSure(n))} />
                <div className="review-foot">
                  {card.in_head_ok && (
                    <Hint text="Answered in my head" keys="in-head" side="top">
                      <button id="review-head" className="quiz-ghost" onClick={answerInHead}>
                        In my head
                      </button>
                    </Hint>
                  )}
                  <Hint text="No idea" keys="no-idea" side="top">
                    <button className="quiz-ghost" onClick={() => void check(true)}>
                      No idea
                    </button>
                  </Hint>
                  <Hint text="Check your answer" keys="finish" side="top">
                    <button id="review-check" className="pill-btn quiz-go" disabled={!answer.trim()} onClick={() => void check()}>
                      Check
                    </button>
                  </Hint>
                </div>
              </>
            )}

            {phase === "answer" && card.kind === "card" && (
              <>
                <div className="quiz-label" id="review-sure">
                  How sure are you?
                </div>
                <Sure refEl={sureRef} conf={conf} onPick={pickSure} />
              </>
            )}

            {phase === "checked" && (
              <>
                {card.kind === "prompt" && !inHead && (
                  <>
                    <div className="quiz-kicker">Your answer</div>
                    <p className="quiz-yours">{answer.trim() ? <Evidence answer={answer.trim()} quote={shownQuote} /> : <span className="quiz-faint">No idea</span>}</p>
                  </>
                )}
                <div className="quiz-kicker">Answer</div>
                <p className="review-answer">{card.answer}</p>
                {card.kind === "prompt" && card.rubric.length > 0 && (
                  <>
                    <div className="quiz-kicker">{inHead || gradeError ? "Key points · which did you get?" : "Key points"}</div>
                    <ul className="quiz-points">
                      {card.rubric.map((p, i) => {
                        const mark = marks?.[i];
                        const quote = quoteFor(i);
                        return (
                          <li key={i} className={mark === false ? "missed" : mark ? "got" : ""} onMouseEnter={() => setHoverPoint(i)} onMouseLeave={() => setHoverPoint(null)}>
                            {marks ? (
                              <Hint text={mark ? "Mark as missed" : "Mark as got"}>
                                <button
                                  className="quiz-mark"
                                  onFocus={() => setFocusPoint(i)}
                                  onBlur={() => setFocusPoint(null)}
                                  aria-pressed={mark}
                                  aria-label={mark ? `Got: ${p}${quote ? `, from “${quote}”` : ""}. Mark as missed` : mark === false ? `Missed: ${p}. Mark as got` : `${p}. Mark as got`}
                                  onClick={() => (setRemark(false), setMarks((m) => m!.map((x, j) => (j === i ? !x : x))))}
                                >
                                  {mark ? <Check size={14} weight="bold" /> : <Circle size={14} weight="bold" />}
                                </button>
                              </Hint>
                            ) : (
                              <span className="quiz-mark wait" aria-hidden="true" />
                            )}
                            <span className="quiz-point">{p}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
                {card.kind === "prompt" && !marks && !gradeError && (
                  <p className="loading review-grading"><Working stage="check" label="Checking your answer…" slow="This can take about 20 seconds." /></p>
                )}
                {grade?.feedback && <p className="review-feedback">{grade.feedback}</p>}
                {gradeError && PHONE ? (
                  // The phone can't run the AI that checks answers (D7); a retry would fail the same way.
                  <p className="review-grade-failed">{gradeError === KEY_POINTS_CHANGED ? gradeError : "Checking answers runs on your Mac for now."} Mark what you got.</p>
                ) : gradeError && (
                  <p className="review-grade-failed">
                    {gradeError} Mark what you got, or{" "}
                    <button className="link" onClick={() => void runGrade()}>
                      try again
                    </button>
                    .
                  </p>
                )}
                {card.original && (
                  <details className="review-original">
                    <summary>Same idea as: {card.original.question}</summary>
                    <p className="review-answer">{card.original.answer}</p>
                  </details>
                )}
                {sureMiss && <p className="quiz-sure-miss">You were sure about this one. Worth a careful look.</p>}
                {passage && (
                  <figure className="review-passage">
                    {passage.quotes.length > 1 ? (
                      <div className="review-quotes">
                        <Hint text="Previous passage" keys="passage-prev" side="top">
                          <button aria-label="Previous passage" disabled={quoteAt === 0} onClick={() => setQuoteAt(quoteAt - 1)}>
                            <CaretLeft size={14} weight="bold" aria-hidden="true" />
                          </button>
                        </Hint>
                        <blockquote>{passage.quotes[quoteAt]!.text}</blockquote>
                        <Hint text="Next passage" keys="passage-next" side="top">
                          <button aria-label="Next passage" disabled={quoteAt === passage.quotes.length - 1} onClick={() => setQuoteAt(quoteAt + 1)}>
                            <CaretRight size={14} weight="bold" aria-hidden="true" />
                          </button>
                        </Hint>
                      </div>
                    ) : (
                      passage.quotes[0] && <blockquote>{passage.quotes[0].text}</blockquote>
                    )}
                    <figcaption>
                      <span>
                        {passage.quotes[quoteAt]?.time && <span className="review-time">{passage.quotes[quoteAt]!.time} · </span>}
                        {passage.title}
                      </span>
                      <button
                        // The session stays open: leaving the source picks it up again on this card.
                        onClick={() => onOpenSource(passage.item, passage.quotes[quoteAt]?.at)}
                      >
                        Open in source <ArrowSquareOut size={12} aria-hidden="true" />
                      </button>
                    </figcaption>
                  </figure>
                )}
                {passageGone && (
                  <figure className="review-passage">
                    <figcaption>
                      <span>{passageGone}</span>
                    </figcaption>
                  </figure>
                )}

                {/* Its reviews so far and where the rating under the pointer puts the next (D149); a card never reviewed has nothing to show. */}
                {card.history && card.history.reviews.length > 0 && (
                  <div className="review-memory" data-color={skillOf(entry.skills[0] ?? "").color}>
                    {/* D237: the exercise's own gem, as it is before this rating. */}
                    {card.history.gem && (
                      <Hint text={GEM_SAYS[card.history.gem.kind]} side="top">
                        <span className="review-gem" tabIndex={0} aria-label={GEM_SAYS[card.history.gem.kind]}><Gem kind={card.history.gem.kind} size={18} seam={card.history.gem.seam} polished={card.history.gem.polished} /></span>
                      </Hint>
                    )}
                    <Timeline history={card.history} rating={(preview ?? suggested ?? 3) as Rating} />
                  </div>
                )}
                <div className="review-rate" role="group" aria-label="How well did you remember it?" onMouseLeave={() => setPreview(undefined)} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setPreview(undefined)}>
                  {RATINGS.map((r, i) => (
                    <Hint key={r} text={<>{i + 1 === suggested ? `${r}, suggested` : r} <kbd>{i + 1}</kbd>{i + 1 === suggested && <kbd>↵</kbd>}</>} side="top">
                      <button className={`rate-${i + 1}${i + 1 === suggested ? " suggested" : ""}`} data-armed={guard === i + 1 || undefined} disabled={busy} onClick={() => void rate(i + 1)} onMouseEnter={() => setPreview(i + 1)} onFocus={() => setPreview(i + 1)}>
                        {r}
                      </button>
                    </Hint>
                  ))}
                </div>
                {guard !== undefined && (
                  <p className="review-guard" role="status">
                    {marks?.some((m) => !m) ? `${marks.filter((m) => !m).length} of ${marks.length} key points are marked missed.` : "This one is down as a miss."} Press {RATINGS[guard - 1]} again to keep it.
                  </p>
                )}
                {!PHONE && <div className="review-tools">
                  <Hint text="Ask about this" keys="ask" side="top">
                    <button aria-label="Ask about this" aria-pressed={asking} onClick={() => setAsking((v) => !v)}>
                      <ChatCircleDots size={14} aria-hidden="true" />
                    </button>
                  </Hint>
                  <Hint text="Edit exercise" keys="edit-card" side="top">
                    <button aria-label="Edit exercise" onClick={edit}>
                      <PencilSimple size={14} aria-hidden="true" />
                    </button>
                  </Hint>
                  {card.variant && (
                    <Hint text="Bad version: show the original exercise" keys="bad-version" side="top">
                      <button aria-label="Bad version" disabled={busy} onClick={() => void badVersion()}>
                        <ThumbsDown size={14} aria-hidden="true" />
                      </button>
                    </Hint>
                  )}
                  <Hint text="Later: at the end of this session" keys="later" side="top">
                    <button aria-label="Later" disabled={busy} onClick={() => later()}>
                      <Clock size={14} aria-hidden="true" />
                    </button>
                  </Hint>
                  {entry.state === "draft" ? (
                    <Hint text="Delete exercise" keys="retire-card" side="top">
                      <button aria-label="Delete exercise" onClick={() => void retire()}>
                        <Trash size={14} aria-hidden="true" />
                      </button>
                    </Hint>
                  ) : (
                    <Hint text="Retire exercise: it won’t come back" keys="retire-card" side="top">
                      <button aria-label="Retire exercise" onClick={() => void retire()}>
                        <Archive size={14} aria-hidden="true" />
                      </button>
                    </Hint>
                  )}
                </div>}
                {asking && (
                  <Ask
                    card={card}
                    answer={answer}
                    chat={asks[card.id] ?? NO_ASK}
                    setChat={(f) => setAsks((a) => ({ ...a, [card.id]: f(a[card.id] ?? NO_ASK) }))}
                    onApply={async (p) => {
                      try {
                        await setText(card, p.question, p.answer);
                      } catch (e) {
                        notify(errorText(e), "error");
                        throw e;
                      }
                    }}
                    onClose={() => {
                      setAsking(false);
                      root.current?.focus({ preventScroll: true });
                    }}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
      {!end && card && entry && <KeyFoot phase={phase} kind={card.kind} suggested={suggested} variant={!!card.variant} inHead={!!card.in_head_ok} />}
    </div>
    </Trap>
  );
}

/** What `ore due` is asked for: the picked skills, or one source. */
const pickArgs = (pick: string[] | null, source?: string) => [...(pick ?? []).map((s) => opt("skill", s)), ...(source ? [opt("source", source)] : [])];

/** Why a session has no cards, honestly: the pick leaves out skills with cards due, or the daily limits hold
 *  new cards back (D65), and only then "nothing is due". */
function nothingDue(t: Today | null, pick: string[] | null, source?: string): string {
  if (source) return "Nothing from this source is due right now.";
  if (pick && t && t.due > 0) return `Nothing is due in the skills you picked today. ${t.due} ${t.due === 1 ? "exercise waits" : "exercises wait"} in the others.`;
  return t?.new_waiting ? `All caught up. ${waiting(t)}` : "All caught up. Nothing is due right now.";
}

/** The review footer: the keys for this step, Raycast's action bar (DESIGN.md). `suggested`: the rating ↵ gives,
 *  named in the bar as its button is (Again, Hard, Good or Easy); none, no ↵. */
function KeyFoot({ phase, kind, suggested, variant, inHead }: { phase: Phase; kind: CardFull["kind"]; suggested?: number; variant: boolean; inHead: boolean }) {
  const map = useKeymap();
  const k = (id: KeyId) => label(map[id]);
  const rows: [string, string][] =
    phase === "edit"
      ? [[k("finish"), "Save"], ["Esc", "Cancel"]]
      : phase === "answer"
        ? kind === "prompt"
          ? // No "1 2 3" here: digits type into the answer; ⌘↵ asks how sure, and then 1–3 work.
            [[k("finish"), "Check"], ...(inHead ? [[k("in-head"), "In my head"] as [string, string]] : []), [k("no-idea"), "No idea"], [k("later"), "Later"], ["Esc", "Leave"]]
          : [["1 2 3", "How sure, then show"], [k("later"), "Later"], ["Esc", "Leave"]]
        : [["1–4", "Rate"], ...(suggested ? [["↵", RATINGS[suggested - 1]!] as [string, string]] : []), [k("ask"), "Ask"], [k("edit-card"), "Edit"], ...(variant ? [[k("bad-version"), "Bad version"] as [string, string]] : []), [k("later"), "Later"], ["Esc", "Leave"]];
  return (
    <div className="review-keys" aria-hidden="true">
      {rows.map(([key, what]) => (
        <span key={what}>
          <kbd>{key}</kbd> {what}
        </span>
      ))}
    </div>
  );
}

function Sure({ refEl, conf, onPick }: { refEl: React.RefObject<HTMLDivElement | null>; conf?: number; onPick: (n: number) => void }) {
  return (
    // One Tab stop, ← → between the three (Radix, as Settings' segmented rows); a click on the one picked picks it again.
    <ToggleGroup.Root type="single" className="quiz-sure" aria-labelledby="review-sure" ref={refEl} value={conf ? String(conf) : ""} onValueChange={(v) => onPick(v ? Number(v) : conf!)} onFocus={focusPicked}>
      {SURE.map((label, i) => (
        <Hint key={label} text={<>{label} <kbd>{i + 1}</kbd></>} side="top">
          {/* Keeps focus in the answer, so on iPhone the keyboard stays up and Check doesn't move under the finger. */}
          <ToggleGroup.Item value={String(i + 1)} onMouseDown={(e) => e.preventDefault()}>
            {label}
          </ToggleGroup.Item>
        </Hint>
      ))}
    </ToggleGroup.Root>
  );
}

function EditCard({ draft, setDraft, points, ok, busy, onSave, onCancel }: {
  draft: { question: string; answer: string; points: string };
  setDraft: (d: { question: string; answer: string; points: string }) => void;
  /** An Explain card: its key points, what his answer is marked against, are edited too. */
  points: boolean;
  ok: boolean;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="review-edit">
      <label className="quiz-label" htmlFor="edit-q">Question</label>
      <Grow id="edit-q" autoFocus readOnly={busy} className="field quiz-answer short" value={draft.question} onChange={(e) => setDraft({ ...draft, question: e.target.value })} />
      <label className="quiz-label" htmlFor="edit-a">Answer</label>
      <Grow id="edit-a" readOnly={busy} className="field quiz-answer" value={draft.answer} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} />
      {points && (
        <>
          <Hint text="One key point a line: what an answer is marked against">
            <label className="quiz-label" htmlFor="edit-p">Key points</label>
          </Hint>
          <Grow id="edit-p" readOnly={busy} className="field quiz-answer" value={draft.points} onChange={(e) => setDraft({ ...draft, points: e.target.value })} />
        </>
      )}
      <div className="review-foot">
        {/* While it saves, Esc waits (and so does Cancel), so the hint doesn't promise it. */}
        <Hint text={<>Cancel <kbd>Esc</kbd></>} side="top" off={busy}>
          <button className="quiz-ghost" aria-disabled={busy || undefined} onClick={() => !busy && onCancel()}>
            Cancel
          </button>
        </Hint>
        <Hint text="Save exercise" keys="finish" side="top">
          <button className="pill-btn quiz-go" disabled={busy || !ok} onClick={onSave}>
            Save
          </button>
        </Hint>
      </div>
    </div>
  );
}

/** How long one line of the end screen holds before the next rolls up. */
const LINE_MS = 2600;

/** The end screen's lines (D241): one place, one line at a time. Each rolls up into it, holds, and rolls on up
 *  as the next arrives, round and round; the pointer or the keyboard on a line holds it. Every line is in the
 *  page throughout, so a single line just sits there, and under Reduce Motion they are a plain list. */
function EndLines({ run, turn = false, children }: { run: boolean; turn?: boolean; children: React.ReactNode }) {
  const lines = Children.toArray(children);
  const [at, setAt] = useState(0);
  // The pointer and the keyboard each hold it on their own: leaving with one never lets go for the other.
  const [over, setOver] = useState(false);
  const [within, setWithin] = useState(false);
  const held = over || within;
  // `turn`: there is room for one line only (the mole's bubble), so under Reduce Motion they still take turns, without the roll.
  const flat = still() && !turn;
  useEffect(() => {
    if (flat || !run || held || lines.length < 2) return;
    const id = setInterval(() => setAt((i) => i + 1), LINE_MS);
    return () => clearInterval(id);
  }, [flat, run, held, lines.length]);
  if (flat || lines.length < 2) return <>{lines}</>;
  const on = at % lines.length, was = at ? (at - 1) % lines.length : -1;
  return (
    <div className="end-lines" onMouseEnter={() => setOver(true)} onMouseLeave={() => setOver(false)} onFocus={() => setWithin(true)} onBlur={() => setWithin(false)}>
      {lines.map((line, i) => (
        <div key={i} data-at={i === on ? "on" : i === was ? "was" : undefined} inert={i !== on}>{line}</div>
      ))}
    </div>
  );
}

/** The end of a session (D62): the ring fills by this session's minutes and bursts if it closed
 *  just now, a skill that went up a level says so, and the count is of memories kept, never a score. */
export function EndScreen({ end, skills, quick, onDone, onAgain, onTry }: { end: End; skills: Skill[]; quick?: boolean; onDone: () => void; onAgain: () => void; onTry: (t: Try) => void }) {
  const { session: s, today: t, before: b } = end;
  const part = (x: Today | null) => (!x ? 0 : x.met ? 1 : x.goal_ms ? x.active_ms / x.goal_ms : 0);
  const closed = t.met && !!b && !b.met;
  // Caught up short of the goal still counts (D60), but it isn't the goal being met.
  const short = t.counts && t.caught_up && t.active_ms < t.goal_ms;
  const title = short ? "All caught up · today counts" : closed ? "Goal met!" : "Nice work";
  const ups = t.skills.filter((k) => k.level > (b?.skills.find((x) => x.skill === k.skill)?.level ?? k.level));
  // D190: the cart tips this session's ore into the ring, once, when there is something to tip: ring dots this
  // session lit, or gems it cut. Not in the quick quiz, on the phone, or under Reduce Motion.
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const shown = (s.cut ?? []).slice(0, CUT_SHOWN);
  const [pour] = useState(() => {
    const dots = oreFor(part(b), part(t), ringDots(END_RING));
    return !quick && !PHONE && !document.hidden && !still() && (dots.length > 0 || shown.length > 0) ? dots : null;
  });
  // cart: rolling and pouring · poured: the ring is full · leaving: the mole comes up · done: the cart has gone.
  const [stage, setStage] = useState<"cart" | "poured" | "leaving" | "done">(pour ? "cart" : "done");
  const [landed, setLanded] = useState(pour ? 0 : shown.length);
  // It always comes up out of the ground first, with or without a cart before it (under Reduce Motion it is just there, pleased).
  const [mood, setMood] = useState<"peek" | "cheer">(() => (still() ? "cheer" : "peek"));
  // The mole cheers 560ms after it comes up (its rise), whatever the cart does after that.
  const up = stage === "leaving" || stage === "done";
  useEffect(() => {
    if (!up) return;
    const id = setTimeout(() => setMood("cheer"), 560);
    return () => clearTimeout(id);
  }, [up]);
  const full = stage !== "cart";
  // D242: the count of memories kept runs up from nothing once the cart has filled the ring; with no cart it is just there.
  const [count, setCount] = useState(pour ? 0 : s.kept);
  useEffect(() => {
    if (!pour || !full) return;
    const ms = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--t-moment")) || 600, t0 = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const k = Math.min(1, (now - t0) / ms);
      setCount(Math.round(s.kept * (1 - (1 - k) ** 3)));
      if (k < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [pour, full, s.kept]);
  // D197: a cut gem that was won back has a gold rim; a gem passed on a new case this session shows polished.
  const cutN = s.cut?.length ?? 0;
  const mendedN = (s.grades ?? []).filter((g) => g === "mended").length;
  const polishedN = (s.polished?.length ?? 0) + (s.grades ?? []).filter((g) => g === "polished").length;
  // `old`: a gem that was cut before this session and polished in it; it shows once the cart has poured.
  const gems = [...shown.map((skill, i) => ({ skill, seam: s.grades?.[i] === "mended", polished: s.grades?.[i] === "polished", old: false })), ...(s.polished ?? []).slice(0, CUT_SHOWN - shown.length).map((skill) => ({ skill, seam: false, polished: true, old: true }))];
  const more = cutN + (s.polished?.length ?? 0) - gems.length;
  // D242: the gems land inside the ring, sized to fit it; with none cut, the count of memories kept stands there instead.
  const gemSize = quick ? 36 : gems.length <= 3 ? 56 : gems.length <= 6 ? 48 : 32;
  const cluster = gems.length > 0 && (
        <p className="review-cut" aria-label={[cutN && `${cutN} became solid`, mendedN && `${mendedN} won back`, polishedN && `${polishedN} polished`].filter(Boolean).join(", ")}>
          {gems.map((g, i) => {
            const sk = skills.find((x) => x.id === g.skill);
            return (
              // With the cart, a gem is cut the moment its rough stone lands; its place is kept until then. A gem cut before today and polished now shows once the cart has poured.
              <Hint key={i} text={`${sk ? `${sk.name} · ` : ""}${g.polished ? "Polished: you passed it as a remix" : g.seam ? "Won back: you missed it once and cut it again" : "Cut: you'd still recall it three weeks from now"}`}>
                <span data-color={sk?.color} data-stone={(pour && !g.old) || undefined} data-wait={(g.old ? stage === "cart" : i >= landed) || undefined} style={{ animationDelay: pour ? "0ms" : `${500 + i * 90}ms` }}>
                  {/* With the cart, the stone that lands is cut where it stands: its dots fuse into pixels (D239). */}
                  {pour && !g.old ? <Cutting go={i < landed} size={gemSize} seam={g.seam} polished={g.polished} /> : <Gem kind="cut" size={gemSize} seam={g.seam} polished={g.polished} />}
                </span>
              </Hint>
            );
          })}
          {more > 0 && landed >= shown.length && <b>+{more}</b>}
        </p>
  );
  const kept = s.kept > 0 && (
    <p className="review-kept">
      {/* The emblem's count is drawn in the ring's dots and counts up as the ring fills; its text is the true number throughout. */}
      <b>{quick ? s.kept : <><DotNumber value={count} height={56} /><span className="sr-only">{s.kept}</span></>}</b> {s.kept === 1 ? "memory" : "memories"} kept
    </p>
  );
  const said = endSays({
    session: s, today: t, closed, short,
    ups: ups.map((k) => ({ name: skills.find((x) => x.id === k.skill)?.name ?? k.skill, level: k.level })),
    // The quick quiz says it under its headline already.
    waiting: !quick && t.caught_up && t.new_waiting > 0 ? waiting(t) : null,
    minutesLeft: !t.met && t.counts ? minutesText(Math.max(0, t.goal_ms - t.active_ms)) : null,
  });
  const ring = <Ring value={part(full ? t : b)} from={part(b)} met={full ? t.met : !!b?.met} burst={closed && full} size={quick ? 72 : END_RING} label={`${minutes(t.active_ms)} of ${t.goal_minutes} minutes today`} />;
  // "Caught up" never hides the new cards the daily limits hold back (D65).
  const held = t.caught_up && t.new_waiting > 0 && <p className="quiz-faint">{waiting(t)}</p>;
  return (
    <div className={`review-end${pour ? " carted" : ""}`} role="status" ref={setHost}>
      {pour && stage !== "done" && host && (
        <CartTip host={host} lit={pour} rich={rescuedWorthSaying(s) ? s.rescued : 0} stones={shown.map((id) => skills.find((x) => x.id === id)?.color)} onStone={(i) => setLanded((n) => Math.max(n, i + 1))} onPoured={() => setStage((x) => (x === "cart" ? "poured" : x))} onLeave={() => setStage("leaving")} onDone={() => (setLanded(shown.length), setStage("done"))} />
      )}
      {quick ? (
        <>
          {ring}
          <h2>{title}</h2>
          {held}
          {cluster}
        </>
      ) : (
        <>
          {/* D242: one emblem. The mole (D169) stands on the ring, and what the session won sits inside it. */}
          <div className="end-emblem">
            <span className="review-mole">{up && <Mole bare size={96} mood={mood} />}</span>
            {/* D243: the mole says what the session won, one line at a time, once he has come up. */}
            {mood === "cheer" && (
              <div className="end-says">
                <svg className="end-says-tail" width="9" height="15" viewBox="0 0 9 15" aria-hidden="true">
                  <path d="M9 0h-3v3h-3v3h-3v3h3v3h3v3h3z" />
                </svg>
                <EndLines run={stage === "done"} turn>
                  {said.map((l) => (l.hint ? <Hint key={l.text} text={l.hint}><p tabIndex={0}>{l.text}</p></Hint> : <p key={l.text}>{l.text}</p>))}
                </EndLines>
              </div>
            )}
            <div className="end-ring">
              {ring}
              {cluster || kept}
            </div>
          </div>
          {cluster && kept}
        </>
      )}
      {/* The quick quiz has no mole: it lists what the session won, one line at a time (D241). */}
      {quick && (
        <EndLines run={stage === "done"}>
          {kept}
          {said.slice(s.kept > 0 ? 1 : 0).map((l) => <p key={l.text} className={s.kept === 0 && l === said[0] ? "review-kept" : "review-rescued"}>{l.text}</p>)}
        </EndLines>
      )}
      {/* D165: how often he is right at each of his three taps, so he sees whether they mean anything, not only whether Sure is too sure. */}
      {s.calibration && (
        <div className="review-calibration" role="group" aria-label="When you say">
          <span className="review-calibration-label">When you say</span>
          {s.calibration.levels.filter((l) => l.right !== null).map((l) => (
            <Hint key={l.confidence} text={`Right ${Math.round(l.right! * l.n)} of ${l.n} Explain answers in the last 12 weeks`}>
              <span className="review-calibration-row" tabIndex={0} aria-label={`${SURE[l.confidence - 1]}: right ${Math.round(l.right! * 100)}%`}>
                <span className="review-calibration-name">{SURE[l.confidence - 1]}</span>
                <span className="review-calibration-bar" aria-hidden="true">
                  {Array.from({ length: 10 }, (_, i) => <i key={i} data-on={i < Math.round(l.right! * 10) || undefined} />)}
                </span>
                <span className="review-calibration-pct">{Math.round(l.right! * 100)}%</span>
              </span>
            </Hint>
          ))}
        </div>
      )}
      {/* D148: the one thing left to do away from the screen, now that the session is over. One line, no count: a click opens its passage. */}
      {end.next && (
        <Hint text="To try on your own work · opens the passage">
          <button className="review-try" onClick={() => onTry(end.next!)}>
            <PixelTry size={16} aria-hidden="true" />
            <span>
              <span className="review-try-plan">{end.next.note || `“${passageText(end.next.exact)}”`}</span>
              <span className="review-try-from">{end.next.item_title}</span>
            </span>
          </button>
        </Hint>
      )}
      <div className="review-foot center">
        {t.due > 0 && (
          <button className="quiz-ghost" onClick={onAgain}>
            Keep going
          </button>
        )}
        <Hint text={<>Done <kbd>↵</kbd></>}>
          <button className="pill-btn quiz-go" autoFocus onClick={onDone}>
            Done
          </button>
        </Hint>
      </div>
    </div>
  );
}

