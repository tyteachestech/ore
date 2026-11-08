import { Archive, ArrowCounterClockwise, ArrowSquareOut, CaretLeft, CaretRight, ChatCircleDots, Check, Circle, PencilSimple, ThumbsDown, Trash, X } from "./icons";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { Grow } from "./Grow";
import { Ask, NO_ASK, type AskChat } from "./Ask";
import { Gem } from "./Gem";
import { SkillIcon } from "./IconPicker";
import { Hint } from "./Hint";
import { inTextField, is, label, useKeymap, type KeyId } from "./keys";
import { ore, opt, PHONE, type Annotation, type CardFull, type DueEntry, type Grade, type SessionEnd, type Skill, type Today } from "./ore";
import { minutes, minutesText, Ring } from "./Ring";
import { SkillChip } from "./Skills";
import { errorText, type Notify } from "./util";
import { Working } from "./Working";
import { waiting } from "./Home";
import { stampBefore } from "./transcript";

const SURE = ["Guess", "Think so", "Sure"] as const;
const KEY_POINTS_CHANGED = "The key points changed.";
const RATINGS = ["Again", "Hard", "Good", "Easy"] as const;
/** A missed card comes back this many cards later (D59). */
const AGAIN_GAP = 3;
/** One card adds at most this much active time (D60, as in core). */
const ACTIVE_CAP_MS = 3 * 60_000;
/** Cut gems drawn on the end screen; the rest show as "+N". */
const CUT_SHOWN = 8;

type Phase = "answer" | "checked" | "edit";
/** The session receipt, and today before and after it (for the ring and level-ups). */
type End = { session: SessionEnd; today: Today; before: Today | null };

/** The remixed version shown, for the CLI calls that act on it (D66). */
const variantOpt = (c: CardFull) => (c.variant ? [opt("variant", c.variant)] : []);

/** Answers typed but not checked, and how sure he said he was, by card: putting the quick quiz away
 *  (D76), Esc or Open in source keep them for when the card comes up again. */
const drafts = new Map<string, { text: string; conf?: number }>();

/** Review mode (D59), full window like Raycast's command view: one card at a time, typed answers for
 *  Explain cards (AI marks the rubric and suggests a rating; he decides), self-rated Fact cards. Every
 *  rating is logged at once, so leaving with Esc loses nothing. `quick` is the quick quiz window (D76):
 *  today's ring instead of the session bar, and leaving closes it with no end screen unless the goal
 *  just closed or nothing is left. */
export function Review({ pick, skills, onOpenSource, onClose, onLogged, notify, quick = false, paused = false }: {
  /** Skills to review, or null for all. */
  pick: string[] | null;
  /** Hidden while he reads the source a card opened; it waits on that card, its keys off. */
  paused?: boolean;
  skills: Skill[];
  onOpenSource: (item: string, at?: string) => void;
  onClose: (again?: boolean) => void;
  /** A rating taken back (⌘Z) or given again after Review closed: today's numbers changed. */
  onLogged?: () => void;
  notify: Notify;
  quick?: boolean;
}) {
  const [queue, setQueue] = useState<DueEntry[] | null>(null);
  const [done, setDone] = useState(0);
  const [card, setCard] = useState<CardFull | null>(null);
  const [phase, setPhase] = useState<Phase>("answer");
  const [answer, setAnswer] = useState("");
  const [conf, setConf] = useState<number | undefined>();
  const [askSure, setAskSure] = useState(false);
  const [grade, setGrade] = useState<Grade | null>(null);
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
  const [passage, setPassage] = useState<{ item: string; title: string; quotes: { text: string; at: string; time?: string }[] } | null>(null);
  const [quoteAt, setQuoteAt] = useState(0);
  /** Why the passage can't show (its source deleted since the card was made), in its place. */
  const [passageGone, setPassageGone] = useState<string | null>(null);
  /** The editor's text; `points` is an Explain card's key points, one a line. */
  const [draft, setDraft] = useState({ question: "", answer: "", points: "" });
  const [busy, showBusy] = useState(false);
  /** `busy` as of now, for the guards: two keys in one task would both see the state before either set it. */
  const busyNow = useRef(false);
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
  /** Each card's Ask chat, kept while he closes and reopens it. */
  const [asks, setAsks] = useState<Record<string, AskChat>>({});
  const [end, setEnd] = useState<End | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Bumped by Try again after a card failed to load: loads the same card again, the session as it was. */
  const [loadTry, setLoadTry] = useState(0);
  const retryLoad = () => setLoadTry((n) => n + 1);
  const shownAt = useRef(Date.now());
  /** When the answer showed: a rating key right after it is the confidence key pressed twice. */
  const shownAnswerAt = useRef(0);
  const field = useRef<HTMLTextAreaElement>(null);
  const sureRef = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
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
  const [undos, setUndos] = useState<{ card: string; ts: string; queue: DueEntry[]; done: number; activeMs: number; forget: () => void }[]>([]);
  const last = undos.at(-1);
  /** Cards retired in this session: taking back a rating before one brings the queue back without it. */
  const retired = useRef(new Set<string>());
  /** Ratings go on the app history (⌘Z) with every other step; while Review is open, taking back its
   *  newest rating also shows that card again. */
  const undoNow = useRef<(ts: string) => boolean>(() => false);
  const redoNow = useRef<(id: string, args: string[], rating: number, elapsed: number, again: { forget: () => void; setTs: (ts: string) => void }) => boolean>(() => false);
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

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const started = ore<{ id: string }>("session", "start");
        sessionReady.current = started.catch(() => {});
        const s = await started;
        // Closed before the session began: it ends at once, as leaving would have ended it.
        if (!live) return void ore("session", "end", s.id).catch(() => {});
        session.current = { id: s.id, open: true };
        const t = ore<Today>("today").then((t) => {
          before.current = t;
          setStart(t);
        }, () => {});
        const q = await ore<DueEntry[]>("due", ...(pick ?? []).map((s) => opt("skill", s)));
        // An empty queue ends the session at once, and why ("nothing due in the skills you picked",
        // new cards waiting) reads today: let it land first.
        if (!q.length) await t;
        setQueue(q);
      } catch (e) {
        setError(errorText(e));
      }
    })();
    mounted.current = true;
    return () => {
      live = false;
      mounted.current = false;
      // Gone any other way than Esc or Done (a click away from the quick quiz, Open in source from it):
      // this session ends, by its id, never another window's.
      const s = session.current;
      if (s?.open) void ore("session", "end", s.id).catch(() => {});
      session.current = null;
    };
  }, [pick]);

  // The quick quiz (D76) rated cards while this window waited: the ones no longer due drop out, so none
  // comes up twice. Past the day's new-card limits, so a draft it didn't rate stays; the card on screen
  // goes only if he hasn't started on it.
  useEffect(() => {
    if (quick || PHONE) return;
    const un = listen("quiz-closed", () => {
      ore<DueEntry[]>("due", "--all", ...(pick ?? []).map((s) => opt("skill", s))).then((fresh) => {
        const due = new Set(fresh.map((e) => e.id));
        const s = now.current;
        const started = s.phase !== "answer" || !!s.answer.trim();
        setQueue((q) => q && (q.every((e) => due.has(e.id)) ? q : q.filter((e, i) => due.has(e.id) || (i === 0 && started))));
      }, () => {});
    });
    return () => void un.then((f) => f());
  }, [quick, pick]);

  /** A fresh start on a card: no answer, no marks, its clock not yet started. */
  const reset = () => {
    showing.current++;
    setPhase("answer");
    setAnswer("");
    setConf(undefined);
    setAskSure(false);
    setGrade(null);
    setGradeError(null);
    setMarks(null);
    setRemark(false);
    setInHead(false);
    setPassage(null);
    setPassageGone(null);
    setAsking(false);
  };

  /** The next card, loaded while he answers this one, so a rating moves on without waiting for it. Only
   *  a rating arms it (`submit`); anything else that moves the queue or changes a card (an undo, an edit,
   *  a retire, a version dropped, Try again) drops it, and that card loads afresh. */
  const ahead = useRef<{ id: string; card: Promise<CardFull>; armed: boolean } | null>(null);
  const dropAhead = () => void (ahead.current = null);
  const loadCard = (id: string) => ore<CardFull>("card", "show", id, "--review");
  // Each card: load the version to review (a remix in its turn, D66), reset the answer, start its clock.
  useEffect(() => {
    if (!entry) return;
    let live = true;
    setCard(null);
    setError(null);
    reset();
    // The card loaded ahead, if a rating just moved on to it; one whose early load failed loads again.
    const early = ahead.current?.armed && ahead.current.id === entry.id ? ahead.current.card : undefined;
    dropAhead();
    (early ? early.catch(() => loadCard(entry.id)) : loadCard(entry.id)).then(
      (c) => {
        if (!live) return;
        setCard(c);
        const kept = c.kind === "prompt" ? drafts.get(c.id) : undefined;
        setAnswer(kept?.text ?? "");
        setConf(kept?.conf);
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
        notify(nothingDue(before.current, pick));
        return onClose();
      }
      setEnd({ session: receipt, today: await ore<Today>("today"), before: before.current });
    } catch (e) {
      notify(errorText(e), "error");
      onClose();
    } finally {
      setBusy(false);
    }
  }, [notify, onClose, queue, quick, pick]);

  useEffect(() => {
    // The quick quiz with nothing due says so and waits for Esc instead of closing under his hand.
    if (queue && !queue.length && !end && !(quick && !reviewed.current)) void finish();
  }, [queue, end, finish, quick]);

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
          return setPassage({ item: c.item, title: s.title, quotes: c.evidence.map((e) => ({ text: e.exact.replace(/\[[\d:.]+\]\s*/g, ""), at: `q:${e.start}:${e.end}`, time: stampBefore(s.body, e.start) })) });
        const a = c.annotation ? s.annotations.find((x) => x.id === c.annotation && x.status !== "deleted") : undefined;
        setPassage({ item: c.item, title: s.title, quotes: a ? [{ text: a.exact, at: a.id }] : [] });
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

  const advance = (again: boolean) => {
    setQueue((q) => {
      if (!q?.length) return q;
      const [head, ...rest] = q;
      // A miss comes back once (D59); a second miss waits for its next FSRS date.
      if (!again || head!.relearn) return rest;
      return [...rest.slice(0, AGAIN_GAP), { ...head!, relearn: true }, ...rest.slice(AGAIN_GAP)];
    });
  };

  const rate = async (rating: number) => {
    if (!card || phase !== "checked" || busyNow.current) return;
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
        ...(grade ? [opt("ai-rating", String(grade.rating))] : []),
        opt("elapsed-ms", String(elapsed)),
        ...variantOpt(card),
        ...(inHead ? ["--in-head"] : []),
        ...(session.current ? [opt("session", session.current.id)] : []),
      ];
      await submit(args, rating, elapsed);
      drafts.delete(card.id);
      // The session is today's slice (D65): it ends when the goal closes, and Keep going goes on.
      const b = before.current;
      goalClosed = !!b && b.counts && !b.met && b.active_ms + activeMs.current >= b.goal_ms;
    } catch (e) {
      notify(errorText(e), "error");
    } finally {
      setBusy(false);
    }
    if (goalClosed) void finish();
  };

  /** Records a rating and moves on. The first time (`forget` absent) it goes on the app history, so
   *  ⌘Z takes it back and ⇧⌘Z gives it again: the same rating, answer and time. Throws if the write fails. */
  const submit = async (args: string[], rating: number, elapsed: number, again?: { forget: () => void; setTs: (ts: string) => void }) => {
    const was = { queue: queue ?? [], done, activeMs: activeMs.current };
    const r = await ore<{ ts: string }>("review", ...args);
    reviewed.current++;
    const id = args[0]!;
    let ts = r.ts;
    again?.setTs(ts);
    const setTs = (t: string) => void (ts = t);
    const forget =
      again?.forget ??
      notify(
        "Rating",
        "quiet",
        // With Review closed, only the log changes (its session stays ended), and Home reads its numbers again.
        () => {
          if (!(mounted.current && undoNow.current(ts))) ore("review", id, opt("undo", ts)).then(() => onLogged?.(), (e) => notify(errorText(e), "error"));
        },
        () => {
          // Given again after Review closed: its session has ended, so the rating goes in with none.
          if (!(mounted.current && redoNow.current(id, args, rating, elapsed, { forget, setTs })))
            ore<{ ts: string }>("review", ...args.filter((a) => !a.startsWith("--session="))).then((x) => (setTs(x.ts), onLogged?.()), (e) => notify(errorText(e), "error"));
        },
      );
    setUndos((u) => [...u, { card: id, ts: r.ts, ...was, forget }]);
    if (rating > 1) setDone((n) => n + 1);
    if (ahead.current) ahead.current.armed = true;
    advance(rating === 1);
    activeMs.current += Math.min(elapsed, ACTIVE_CAP_MS);
  };

  /** ⌘Z: takes back the last rating and shows that card again, unanswered. On the end screen it
   *  opens the session again, back on that card (Anki's Undo after Congratulations). */
  const undoRating = async () => {
    if (!last || busyNow.current) return;
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
      setDone(last.done);
      setQueue(last.queue.filter((e) => !retired.current.has(e.id)));
      setUndos((u) => u.slice(0, -1));
    } catch (e) {
      notify(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  };

  undoNow.current = (ts) => {
    if (last?.ts !== ts) return false;
    void undoRating();
    return true;
  };
  // ⇧⌘Z right after ⌘Z: that card is showing again, so the rating goes in again and Review moves on.
  redoNow.current = (id, args, rating, elapsed, again) => {
    if (end || busyNow.current || queue?.[0]?.id !== id) return false;
    setBusy(true);
    submit(args, rating, elapsed, again)
      .catch((e) => notify(errorText(e), "error"))
      .finally(() => setBusy(false));
    return true;
  };

  const retire = async () => {
    if (!card || busyNow.current) return;
    dropAhead();
    setBusy(true);
    try {
      await ore("card", "retire", card.id);
      const { id, state } = card;
      retired.current.add(id);
      notify(
        entry?.state === "draft" ? "Card deleted" : "Card retired",
        "info",
        () => {
          if (state === "retired") return;
          dropAhead();
          ore("card", "restore", id, opt("state", state)).then(
            () => {
              retired.current.delete(id);
              notify("Card restored. It comes back in a later review.");
            },
            (e) => notify(errorText(e), "error"),
          );
        },
        () => (dropAhead(), void ore("card", "retire", id).then(() => void retired.current.add(id), (e) => notify(errorText(e), "error"))),
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
        () => (dropAhead(), void ore("variant", "restore", id, variant).catch((e) => notify(errorText(e), "error"))),
        () => (dropAhead(), void ore("variant", "reject", id, variant).catch((e) => notify(errorText(e), "error"))),
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
      const put = (w: typeof was) => () => void setText(c, w.question, w.answer, w.rubric, false).catch((e) => notify(errorText(e), "error"));
      notify("Card edit", "quiet", put(was), put({ question, answer, rubric }));
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
    if (card?.kind === "prompt") drafts.set(card.id, { text: answer, conf: n });
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

  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (paused) return;
    if (is(e, "undo") && busyNow.current && !(inTextField(e) && !(e.target as HTMLElement).hasAttribute("data-app-undo"))) {
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
      if (e.key === "Enter" && onSurface && error && entry) {
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
    } else if (is(e, "ask")) {
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
    <div className="review" ref={root} tabIndex={-1} role="dialog" aria-label="Review" hidden={paused}>
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
        ) : done + left <= 30 && !end ? (
          <div className="quiz-steps review-steps" role="progressbar" aria-label="Session" aria-valuemin={0} aria-valuemax={done + left} aria-valuenow={done}>
            {Array.from({ length: done + left }, (_, i) => (
              <span key={i} className={i < done ? "done" : i === done ? "now" : ""} />
            ))}
          </div>
        ) : (
          <div className="review-bar" role="progressbar" aria-label="Session" aria-valuemin={0} aria-valuemax={done + left} aria-valuenow={done}>
            <span style={{ transform: `scaleX(${end ? 1 : progress})` }} />
          </div>
        )}
        {last && (
          <Hint text="Undo last rating" keys="undo">
            <button className="quiz-close" aria-label="Undo last rating" disabled={busy} onClick={() => void undoRating()}>
              <ArrowCounterClockwise size={16} weight="bold" aria-hidden="true" />
            </button>
          </Hint>
        )}
        <Hint text={<>Leave review <kbd>Esc</kbd></>}>
          <button className="quiz-close" aria-label="Leave review" onClick={() => (end ? onClose() : void finish(!quick))}>
            <X size={16} weight="bold" aria-hidden="true" />
          </button>
        </Hint>
      </div>

      {/* VoiceOver hears each new card and when the AI's marks arrive, not only the end screen. */}
      <div className="sr-only" aria-live="polite">
        {card && !end && queue?.length ? `Card ${done + 1} of ${done + left}. ${card.question}${grade ? `. Marked ${grade.covered.filter(Boolean).length} of ${grade.covered.length} key points` : ""}` : ""}
      </div>
      <div className="review-body">
        {error && (
          <p className="err">
            {error}
            {entry && !card && (
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
        {!error && !end && (!queue || (entry && !card)) && <p className="loading"><Working label="Getting your cards…" /></p>}
        {!error && !end && queue && !queue.length && reviewed.current > 0 && <p className="loading"><Working label="Wrapping up…" /></p>}
        {quick && !error && queue && !queue.length && !reviewed.current && <p className="loading">{nothingDue(start, pick)}</p>}

        {end && <EndScreen end={end} skills={skills} quick={quick} onDone={() => onClose()} onAgain={() => onClose(true)} />}

        {!end && card && entry && (
          <div className="review-card" key={`${card.id}-${done}-${left}`}>
            <div className="review-meta">
              {entry.skills.map((s) => (
                <SkillChip key={s} skill={skillOf(s)} />
              ))}
              {entry.state === "draft" && (
                <Hint text="First time you see this card">
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
                    drafts.set(card.id, { text: e.target.value, conf });
                  }}
                />
                <div className={`quiz-label${askSure ? " ask" : ""}`} id="review-sure">
                  How sure are you?
                </div>
                <Sure refEl={sureRef} conf={conf} onPick={(n) => (conf === n ? (setConf(undefined), drafts.set(card.id, { text: answer })) : pickSure(n))} />
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
                    <p className="quiz-yours">{answer.trim() || <span className="quiz-faint">No idea</span>}</p>
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
                        return (
                          <li key={i} className={mark === false ? "missed" : mark ? "got" : ""}>
                            {marks ? (
                              <Hint text={mark ? "Mark as missed" : "Mark as got"}>
                                <button
                                  className="quiz-mark"
                                  aria-pressed={mark}
                                  aria-label={mark ? `Got: ${p}. Mark as missed` : mark === false ? `Missed: ${p}. Mark as got` : `${p}. Mark as got`}
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
                  <p className="loading review-grading"><Working label="Checking your answer…" slow="This can take about 20 seconds." /></p>
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

                <div className="review-rate" role="group" aria-label="How well did you remember it?">
                  {RATINGS.map((r, i) => (
                    <Hint key={r} text={<>{i + 1 === suggested ? `${r}, suggested` : r} <kbd>{i + 1}</kbd>{i + 1 === suggested && <kbd>↵</kbd>}</>} side="top">
                      <button className={`rate-${i + 1}${i + 1 === suggested ? " suggested" : ""}`} disabled={busy} onClick={() => void rate(i + 1)}>
                        {r}
                      </button>
                    </Hint>
                  ))}
                </div>
                <div className="review-tools">
                  <Hint text="Ask about this" keys="ask" side="top">
                    <button aria-label="Ask about this" aria-pressed={asking} onClick={() => setAsking((v) => !v)}>
                      <ChatCircleDots size={14} aria-hidden="true" />
                    </button>
                  </Hint>
                  <Hint text="Edit card" keys="edit-card" side="top">
                    <button aria-label="Edit card" onClick={edit}>
                      <PencilSimple size={14} aria-hidden="true" />
                    </button>
                  </Hint>
                  {card.variant && (
                    <Hint text="Bad version: show the original card" keys="bad-version" side="top">
                      <button aria-label="Bad version" disabled={busy} onClick={() => void badVersion()}>
                        <ThumbsDown size={14} aria-hidden="true" />
                      </button>
                    </Hint>
                  )}
                  {entry.state === "draft" ? (
                    <Hint text="Delete card" keys="retire-card" side="top">
                      <button aria-label="Delete card" onClick={() => void retire()}>
                        <Trash size={14} aria-hidden="true" />
                      </button>
                    </Hint>
                  ) : (
                    <Hint text="Retire card: it won’t come back" keys="retire-card" side="top">
                      <button aria-label="Retire card" onClick={() => void retire()}>
                        <Archive size={14} aria-hidden="true" />
                      </button>
                    </Hint>
                  )}
                </div>
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
      {!end && card && entry && <KeyFoot phase={phase} kind={card.kind} suggested={suggested !== undefined} variant={!!card.variant} inHead={!!card.in_head_ok} />}
    </div>
  );
}

/** Why a session has no cards, honestly: the pick leaves out skills with cards due, or the daily limits hold
 *  new cards back (D65), and only then "nothing is due". */
function nothingDue(t: Today | null, pick: string[] | null): string {
  if (pick && t && t.due > 0) return `Nothing is due in the skills you picked today. ${t.due} ${t.due === 1 ? "card waits" : "cards wait"} in the others.`;
  return t?.new_waiting ? `All caught up. ${waiting(t)}` : "All caught up. Nothing is due right now.";
}

/** The review footer: the keys for this step, Raycast's action bar (DESIGN.md). */
function KeyFoot({ phase, kind, suggested, variant, inHead }: { phase: Phase; kind: CardFull["kind"]; suggested: boolean; variant: boolean; inHead: boolean }) {
  const map = useKeymap();
  const k = (id: KeyId) => label(map[id]);
  const rows: [string, string][] =
    phase === "edit"
      ? [[k("finish"), "Save"], ["Esc", "Cancel"]]
      : phase === "answer"
        ? kind === "prompt"
          ? // No "1 2 3" here: digits type into the answer; ⌘↵ asks how sure, and then 1–3 work.
            [[k("finish"), "Check"], ...(inHead ? [[k("in-head"), "In my head"] as [string, string]] : []), [k("no-idea"), "No idea"], ["Esc", "Leave"]]
          : [["1 2 3", "How sure, then show"], ["Esc", "Leave"]]
        : [["1–4", "Rate"], ...(suggested ? [["↵", kind === "card" ? "Good" : "Suggested"] as [string, string]] : []), [k("ask"), "Ask"], [k("edit-card"), "Edit"], ...(variant ? [[k("bad-version"), "Bad version"] as [string, string]] : []), ["Esc", "Leave"]];
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
    <div className="quiz-sure" role="radiogroup" aria-labelledby="review-sure" ref={refEl}>
      {SURE.map((label, i) => (
        <Hint key={label} text={<>{label} <kbd>{i + 1}</kbd></>} side="top">
          {/* Keeps focus in the answer, so on iPhone the keyboard stays up and Check doesn't move under the finger. */}
          <button role="radio" aria-checked={conf === i + 1} onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(i + 1)}>
            {label}
          </button>
        </Hint>
      ))}
    </div>
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
        <button className="quiz-ghost" aria-disabled={busy || undefined} onClick={() => !busy && onCancel()}>
          Cancel
        </button>
        <Hint text="Save card" keys="finish" side="top">
          <button className="pill-btn quiz-go" disabled={busy || !ok} onClick={onSave}>
            Save
          </button>
        </Hint>
      </div>
    </div>
  );
}

/** The end of a session (D62): the ring fills by this session's minutes and bursts if it closed
 *  just now, a skill that went up a level says so, and the count is of memories kept, never a score. */
function EndScreen({ end, skills, quick, onDone, onAgain }: { end: End; skills: Skill[]; quick?: boolean; onDone: () => void; onAgain: () => void }) {
  const { session: s, today: t, before: b } = end;
  const part = (x: Today | null) => (!x ? 0 : x.met ? 1 : x.goal_ms ? x.active_ms / x.goal_ms : 0);
  const closed = t.met && !!b && !b.met;
  // Caught up short of the goal still counts (D60), but it isn't the goal being met.
  const short = t.counts && t.caught_up && t.active_ms < t.goal_ms;
  const title = short ? "All caught up · today counts" : closed ? "Goal met!" : "Nice work";
  const ups = t.skills.filter((k) => k.level > (b?.skills.find((x) => x.skill === k.skill)?.level ?? k.level));
  return (
    <div className="review-end" role="status">
      <Ring value={part(t)} from={part(b)} met={t.met} burst={closed} size={quick ? 72 : 120} label={`${minutes(t.active_ms)} of ${t.goal_minutes} minutes today`} />
      <h2>{title}</h2>
      {/* "Caught up" never hides the new cards the daily limits hold back (D65). */}
      {t.caught_up && t.new_waiting > 0 && <p className="quiz-faint">{waiting(t)}</p>}
      {/* D90: one cut gem per card that became solid this session, in its skill's colour. */}
      {(s.cut?.length ?? 0) > 0 && (
        <Hint text={`${s.cut!.length} new cut ${s.cut!.length === 1 ? "gem" : "gems"}: you'd still recall ${s.cut!.length === 1 ? "it" : "them"} three weeks from now`}>
          <p className="review-cut" aria-label={`${s.cut!.length} became solid`}>
            {s.cut!.slice(0, CUT_SHOWN).map((id, i) => (
              <span key={i} data-color={skills.find((x) => x.id === id)?.color} style={{ animationDelay: `${500 + i * 90}ms` }}>
                <Gem kind="cut" size={36} />
                {(() => {
                  const sk = skills.find((x) => x.id === id);
                  return sk ? <Hint text={sk.name}><span className="review-cut-skill"><SkillIcon icon={sk.icon} color={sk.color} dot /></span></Hint> : null;
                })()}
              </span>
            ))}
            {s.cut!.length > CUT_SHOWN && <b>+{s.cut!.length - CUT_SHOWN}</b>}
          </p>
        </Hint>
      )}
      {s.kept > 0 ? (
        <p className="review-kept">
          <b>{s.kept}</b> {s.kept === 1 ? "memory" : "memories"} kept
        </p>
      ) : (
        // A session of misses is still the work that makes them stick (D62: no guilt copy).
        <p className="review-kept">Every miss comes back sooner. That’s how they stick.</p>
      )}
      {s.rescued > 0 && (
        <p className="review-rescued">
          {s.rescued} rescued just before you’d have forgotten {s.rescued === 1 ? "it" : "them"}
        </p>
      )}
      {ups.map((k) => {
        const sk = skills.find((x) => x.id === k.skill) ?? { id: k.skill, name: k.skill };
        return (
          <p key={k.skill} className="review-levelup" data-color={sk.color}>
            <SkillChip skill={sk} /> reached level {k.level}
          </p>
        );
      })}
      {s.calibration && (
        <Hint text={`From ${s.calibration.sure_n} Explain answers marked Sure in the last 12 weeks`}>
          <p className="review-calibration">When you say Sure, you’re right {Math.round(s.calibration.sure_right * 100)}% of the time.</p>
        </Hint>
      )}
      {!t.met && t.counts && <p className="quiz-faint">{minutesText(Math.max(0, t.goal_ms - t.active_ms))} min to today’s goal</p>}
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
