import { Archive, ArrowCounterClockwise, ArrowSquareOut, CaretLeft, CaretRight, ChatCircleDots, Check, Circle, Clock, PencilSimple, ThumbsDown, Trash, X } from "./icons";
import { listen } from "@tauri-apps/api/event";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { Children, useEffect, useReducer, useRef, useState, type MutableRefObject } from "react";
import { Grow } from "./Grow";
import { Ask, NO_ASK, type AskChat } from "./Ask";
import { Cutting, Gem } from "./Gem";
import { EndMark } from "./EndMark";
import { Mole, Mound } from "./Mole";
import { CartTip, oreFor } from "./CartTip";
import { layer, sfx, type Sound } from "./sfx";
import { still } from "./SideCursor";
import { Hint } from "./Hint";
import { MoreButton } from "./Menu";
import { inTextField, is, label, reviewDigit, useKeymap, type KeyId } from "./keys";
import { keydownFor } from "./menubar";
import { ownsUndo } from "./history";
import { change } from "./change";
import { nothingDue, pickArgs, ReviewSession, variantOpt, type End } from "./review-session";
import { cardQuotes, ore, opt, PHONE, rescuedWorthSaying, type Annotation, type CardFull, type CardGem, type DueEntry, type Grade, type Skill, type Today, type Try } from "./ore";
import { tick } from "./phone/haptics";
import { askMole, Did, Stone, tryLabel, useOf, usesOf } from "./Forge";
import { endMood, endSays, endTiles, endVoice, weeksAgo, type Tile } from "./end-says";
import { HOLD_MS, MoleSays } from "./MoleSays";
import { DotNumber, minutes, minutesText, Ring, ringDots } from "./Ring";
import { endPlan, type EndProg, LapCentre, lapPlan, lapTickUp, levelAt, SkillRows, SkillStage, overDots, Sparkles, useLap } from "./Lap";
import { SkillChip } from "./Skills";
import { beforeFlushKept, errorText, focusPicked, missedOf, kept, LIBRARY_BACK, useDay, useFocusWhileMounted, useLibraryChanges, type Notify } from "./util";
import { Working } from "./Working";
import { Timeline } from "./Timeline";
import { ExerciseText } from "./ExerciseText";
import { MOMENT_MOOD, momentFor, type Moment } from "./moment";
import { Trap } from "./Trap";
import { waiting } from "./Home";
import { stampBefore } from "./transcript";
import { passageText } from "./text";
import { Evidence } from "./Evidence";
import { Occluded } from "./Occluded";
import { cue, cueSource, CUE_LEVELS } from "./cue";

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
/** Cut gems drawn on the end screen; the rest show as "+N". */
const CUT_SHOWN = 8;
/** The end screen's ring, in px (the quick quiz's is smaller and has no cart). */
// D242: wide enough to hold the session's gems, which land inside it.
const END_RING = 236;

type Phase = "answer" | "checked" | "edit";
/** The passage a card came from, shown after the answer (see `passage` in Review). */
type Passage = { item: string; title: string; quotes: { text: string; at: string; time?: string }[] };
/** An exercise as he had it on screen when he put it off: ⌘Z brings it back so (D192). */
type Shown = {
  card: CardFull; phase: "answer" | "checked"; answer: string; conf?: number; inHead: boolean; cued: number; grade: Grade | null; marks: (boolean | undefined)[] | null;
  remark: boolean; gradeError: string | null; passage: Passage | null; quoteAt: number; passageGone: string | null; asking: boolean;
};
type Rating = 1 | 2 | 3 | 4;
/** Unfinished answers, confidence and active time, by card: putting the quick quiz away
 *  (D76), Esc, Open in source or quitting the app keep them for when the card comes up again (for a day, `kept`). */
const drafts = kept<{ text: string; conf?: number; asked: string; elapsedMs?: number }>("ore.review-drafts");
/** What a draft was typed for: the question, or the remixed version shown (D66). One for another is dropped. */
const askedOf = (c: CardFull) => `${c.variant ?? ""}\n${c.question}`;
const draftFor = (c: CardFull) => {
  const d = drafts.get(c.id);
  if (d && d.asked !== askedOf(c)) return void drafts.delete(c.id);
  return d;
};
// The time he spent on it before (kept as he left) stays with the words as he types more.
const keepDraft = (c: CardFull, text: string, conf?: number) => drafts.set(c.id, { text, conf, asked: askedOf(c), elapsedMs: draftFor(c)?.elapsedMs });

/** Review mode (D59), full window like Raycast's command view: one card at a time, typed answers for
 *  Explain cards (AI marks the rubric and suggests a rating; he decides), self-rated Fact cards. Every
 *  rating is logged at once, so leaving with Esc loses nothing. `quick` is the quick quiz window (D76):
 *  today's ring instead of the session bar, and leaving closes it with no end screen unless the goal
 *  just closed or nothing is left. */
function Session({ pick, source, skills, onOpenSource, onDig, onClose, onLogged, notify, quick = false, paused = false, under = false, leave, giveBack }: {
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
  /** Ends the session and opens that skill's Dig. */
  onDig?: (skill: string) => void;
  onClose: (again?: boolean) => void;
  /** A rating taken back (⌘Z) or given again after Review closed: today's numbers changed. */
  onLogged?: () => void;
  notify: Notify;
  quick?: boolean;
  /** Where focus goes as it closes when what started it is gone (the What to review sheet): the screen's own place. */
  giveBack?: () => HTMLElement | null | undefined;
}) {
  /** The session: what is next, the time and the goal, every step he can take back. This screen draws it. */
  const [s] = useState(() => new ReviewSession<Shown>(quick));
  const [, draw] = useReducer((n: number) => n + 1, 0);
  useEffect(() => s.watch(draw), [s]);
  const { queue, done, busy, end, start } = s;
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
  /** Hints he took before answering (D-new-hint-before-no-idea), 0 to CUE_LEVELS. */
  const [cued, setCued] = useState(0);
  /** What answers the card in its source, shown after the answer: the passage it came from, or for a line
   *  he typed (D99) the quotes the AI found, one at a time. `at` opens the source there. A card with no
   *  passage (one the tutor kept, or whose highlight is gone) has no quotes and opens the source at the top. */
  const [passage, setPassage] = useState<Passage | null>(null);
  const [quoteAt, setQuoteAt] = useState(0);
  /** Why the passage can't show (its source deleted since the card was made), in its place. */
  const [passageGone, setPassageGone] = useState<string | null>(null);
  /** The editor's text; `points` is an Explain card's key points, one a line. */
  const [draft, setDraft] = useState({ question: "", answer: "", points: "" });
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
  /** Why the exercise could not load; why the session could not start is the session's. */
  const [cardError, setError] = useState<string | null>(null);
  const error = cardError ?? s.error;
  /** Bumped by Try again after a card failed to load: loads the same card again, the session as it was. */
  const [loadTry, setLoadTry] = useState(0);
  /** Bumped by Try again after the session failed to start (`ore` down): starts it again. */
  const [startTry, setStartTry] = useState(0);
  const retryLoad = () => (queue ? setLoadTry : setStartTry)((n) => n + 1);
  /** When the answer showed: a rating key right after it is the confidence key pressed twice. */
  const shownAnswerAt = useRef(0);
  const field = useRef<HTMLTextAreaElement>(null);
  const sureRef = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  // Closed (Esc, Done, Later on the last one), focus goes back to what started it, else to `giveBack`.
  // The phone's screens move focus their own way as it opens; closed, it still gives focus back, never to the page
  // itself (Codex sweep 3, a11y).
  useFocusWhileMounted(root, giveBack, true, !PHONE);
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

  // What a Later keeps for ⌘Z, and where a waiting ⌘Z or the history's own keys are sent on.
  const shownNowRef = useRef<() => { id: string; shown: Shown } | null>(() => null);
  s.screen = {
    notify,
    onClose,
    onLogged,
    shown: () => shownNowRef.current(),
    keepDraftTime: (elapsedMs) => {
      if (!card || !answer.trim()) return;
      const draft = draftFor(card);
      // The clock moving does not renew the draft's day.
      if (draft?.text === answer) drafts.set(card.id, { ...draft, elapsedMs }, drafts.at(card.id));
    },
    unrated: () => setMoment(null),
    press: (key) => document.body.dispatchEvent(typeof key === "string" ? keydownFor(keymap[key]) : new KeyboardEvent("keydown", { ...key, bubbles: true, cancelable: true })),
  };
  s.pick = pick;
  s.source = source;
  useEffect(() => s.begin(), [pick, source, startTry]); // eslint-disable-line react-hooks/exhaustive-deps
  // Try again keeps the session it started.
  useEffect(() => () => s.leave(), [pick, source]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => s.gone(), [s]);
  useEffect(() => beforeFlushKept(s.keepDraftTime), [s]);

  // The quick quiz (D76) rated cards while this window waited: the ones no longer due drop out, so none
  // comes up twice. Past the day's new-card limits, so a draft it didn't rate stays; the card on screen
  // goes only if he hasn't started on it.
  // Back after time away does the same, since the CLI, `/ore` or the phone may have rated, changed or deleted one
  // (F173); the next card loads again, and the one on screen too if he hasn't started on it.
  useEffect(() => {
    const reconcile = (outside: boolean) =>
      ore<DueEntry[]>("due", "--all", ...pickArgs(pick, source)).then((fresh) => {
        const due = new Set(fresh.map((e) => e.id));
        const on = now.current;
        const started = on.phase !== "answer" || !!on.answer.trim();
        s.stillDue(due, outside, started);
        if (outside && !started && on.card && due.has(on.card.id)) {
          const id = on.card.id;
          s.load(id).then((c) => now.current.card?.id === id && now.current.phase === "answer" && !now.current.answer.trim() && setCard(c), () => {});
        }
      }, () => {});
    const back = () => void reconcile(true);
    addEventListener(LIBRARY_BACK, back);
    const un = quick || PHONE ? null : listen("quiz-closed", () => void reconcile(false));
    return () => (removeEventListener(LIBRARY_BACK, back), void un?.then((f) => f()));
  }, [quick, pick, source]);

  // Midnight with an exercise open: the quick quiz's ring starts the new day at once, not at the next rating.
  const day = useDay();
  useEffect(() => s.dayChanged(), [day]); // eslint-disable-line react-hooks/exhaustive-deps

  // A setting changed while the session is open: its goal and the day's new-exercise limit follow the saved ones.
  const changes = useLibraryChanges();
  useEffect(() => {
    if (changes) s.settingsChanged();
  }, [changes]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setCued(0);
    setPassage(null);
    setPassageGone(null);
    setAsking(false);
    setPreview(undefined);
    setGuard(undefined);
  };

  /** Shows an exercise as Later found it (`Shown`); the session has set its clock where it was. */
  const showAgain = (s: Shown) => {
    setCard(s.card);
    setPhase(s.phase);
    setAnswer(s.answer);
    setConf(s.conf);
    setInHead(s.inHead);
    setCued(s.cued);
    setGrade(s.grade);
    setMarks(s.marks);
    setRemark(s.remark);
    setGradeError(s.gradeError);
    setPassage(s.passage);
    setQuoteAt(s.quoteAt);
    setPassageGone(s.passageGone);
    setAsking(s.asking);
    shownAnswerAt.current = 0;
    // Put off before its passage landed: that reply was dropped as it moved on, so it loads now.
    if (s.phase === "checked" && !s.passage && !s.passageGone) loadPassage(s.card);
  };
  const { dropAhead, load: loadCard } = s;
  // Each card: load the version to review (a remix in its turn, D66), reset the answer, start its clock.
  useEffect(() => {
    if (!entry) return;
    let live = true;
    setCard(null);
    setError(null);
    reset();
    // Each exercise opens at the top of its question, not where the last one's long answer was scrolled to.
    const body = root.current?.querySelector(".review-body");
    if (body) body.scrollTop = 0;
    const back = s.takeRestored(entry.id);
    if (back) return void showAgain(back);
    // The card loaded ahead, if a rating or Later just moved on to it; one whose early load failed loads again.
    const early = s.takeAhead(entry.id);
    (early ? early.catch(() => loadCard(entry.id)) : loadCard(entry.id)).then(
      (c) => {
        if (!live) return;
        setCard(c);
        const draft = c.kind === "prompt" ? draftFor(c) : undefined;
        setAnswer(draft?.text ?? "");
        setConf(draft?.conf);
        s.clock(draft?.elapsedMs);
      },
      (e) => live && setError(errorText(e)),
    );
    return () => {
      live = false;
    };
  }, [entry, loadTry, s.turn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Once this card is on screen, the one after it loads.
  const nextUp = queue?.[1]?.id;
  useEffect(() => {
    if (card && card.id === entry?.id && nextUp) s.loadAhead(nextUp);
  }, [card, entry, nextUp]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (paused) return;
    if (card && phase === "answer") (card.kind === "prompt" && !PHONE ? field.current : root.current)?.focus({ preventScroll: true });
    if (phase === "checked") root.current?.focus({ preventScroll: true });
  }, [card, phase, paused]);

  /** The passage the card came from, shown only after the answer (D59). */
  const loadPassage = (c: CardFull) => {
    setQuoteAt(0);
    const at = showing.current;
    ore<{ title: string; body: string; annotations: Annotation[] }>("show", c.item).then(
      (s) => {
        if (at !== showing.current) return;
        if (c.evidence?.length)
          return setPassage({ item: c.item, title: s.title, quotes: c.evidence.map((e) => ({ text: passageText(e.exact.replace(/\[[\d:.]+\]\s*/g, "")), at: `q:${e.start}:${e.end}`, time: stampBefore(s.body, e.start) })) });
        setPassage({ item: c.item, title: s.title, quotes: cardQuotes(c, s.annotations) });
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
    sfx("tap");
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
    sfx("tap");
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
  const uncapped = ((): number | undefined => {
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
  // Recalled with a hint is a weaker recall: the suggestion goes no higher than Hard; his pick stands (D21).
  const suggested = cued && uncapped ? Math.min(uncapped, 2) : uncapped;

  // A rating waits only for what the marks say now: when they change, it stops waiting.
  useEffect(() => setGuard(undefined), [suggested]);

  const rate = (rating: number) => {
    if (!card || phase !== "checked" || s.busy) return;
    // D237: his rating is the one recorded (D21), but Good or Easy over a miss, by his own marks, takes a second
    // press, so a slip of the finger can't turn a gem that should come loose into a cut one.
    // The second press is a decision, so one that lands within the first's double click doesn't count. With nothing
    // to go by yet (the check still running, or no mark of his own), there is no guard: that rating is his alone.
    if (card.kind !== "card" && suggested !== undefined && rating >= suggested + 2 && (guard !== rating || Date.now() - guardAt.current < GUARD_MS)) {
      if (guard !== rating) guardAt.current = Date.now();
      return void setGuard(rating);
    }
    tick.rate();
    const after = momentFor(card.history, rating as 1 | 2 | 3 | 4, { sure: conf === 3, remix: !!card.variant });
    const color = entry ? skillOf(entry.skills[0] ?? "").color : undefined;
    void s.rate({
      card, rating, conf, answer, grade, inHead, cued,
      noteSeen: !moment,
      saved: () => {
        // An everyday rating leaves a moment still showing to run its time.
        if (after) setMoment({ ...after, n: Date.now(), color });
        drafts.delete(card.id);
      },
    });
  };

  /** What he has on screen, for ⌘Z after a Later. An Explain answer still being checked comes back to check
   *  again (that grade is dropped as it moves on), with what he typed and how sure he was. */
  const shownNow = (c: CardFull): Shown => {
    const base = { card: c, answer, conf, cued };
    if (phase !== "checked" || (c.kind === "prompt" && !inHead && !marks && !gradeError))
      return { ...base, phase: "answer", inHead: false, grade: null, marks: null, remark: false, gradeError: null, passage: null, quoteAt: 0, passageGone: null, asking: false };
    // Ask open (D192): it comes back open, its chat kept as closing and opening it keeps it.
    return { ...base, phase: "checked", inHead, grade, marks, remark, gradeError, passage, quoteAt, passageGone, asking };
  };

  // Later (D192): the session puts it off; this is the exercise as he has it, kept for ⌘Z. None while it loads or its editor is open.
  shownNowRef.current = () => (card && card.id === entry?.id && phase !== "edit" ? { id: card.id, shown: shownNow(card) } : null);
  const later = () => s.later();

  const retire = async () => {
    if (!card) return;
    // What he typed goes with it.
    if (await s.retire(card, entry?.state === "draft")) drafts.delete(card.id);
  };

  /** B, Bad version (D66): drops the remix without logging a review and shows the original. */
  const badVersion = async () => {
    if (!card?.variant) return;
    const { id, variant } = card;
    await s.hold(async () => {
      dropAhead();
      try {
        await ore("variant", "reject", id, variant);
        const original = await ore<CardFull>("card", "show", id);
        reset();
        setCard(original);
        s.clock();
        notify(
          "Dropped that version. Here’s the original.",
          "info",
          () => (dropAhead(), ore("variant", "restore", id, variant)),
          () => (dropAhead(), ore("variant", "reject", id, variant)),
        );
      } catch (e) {
        notify(errorText(e), "error");
      }
    });
  };

  const edit = () => {
    if (!card) return;
    loaded.current = { question: card.question, answer: card.answer, points: card.rubric.join("\n") };
    setDraft(loaded.current);
    setPhase("edit");
  };

  /** A card's new wording, and an Explain card's key points when given, on the history: undo puts the old
   *  ones back (and on screen, if it still is). */
  /** Only what changed from `from` is written, so a field edited outside meanwhile keeps its edit (F174). */
  const setText = async (c: CardFull, question: string, answer: string, rubric?: string[], undoable = true, from: { question: string; answer: string; rubric?: string[] } = c, ai?: CardFull["ai"] | null) => {
    const was = { question: c.question, answer: c.answer, rubric: rubric && c.rubric, ai: c.ai ?? null };
    const changed = [
      ...(question !== from.question ? [opt("question", question)] : []),
      ...(answer !== from.answer ? [opt("answer", answer)] : []),
      ...(rubric && rubric.join("\n") !== (from.rubric ?? c.rubric).join("\n") ? rubric.map((p) => opt("point", p)) : []),
    ];
    if (!changed.length) return;
    dropAhead();
    const saved = await ore<CardFull>("card", "set", c.id, ...changed, ...(ai !== undefined ? [opt("ai", JSON.stringify(ai))] : []), ...variantOpt(c));
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
      const put = (w: typeof was, f: typeof was) => () => setText(c, w.question, w.answer, w.rubric, false, f, ai === undefined ? undefined : w.ai);
      notify("Exercise edit", "quiet", put(was, { question, answer, rubric, ai: saved.ai ?? null }), put({ question, answer, rubric, ai: saved.ai ?? null }, was));
    }
  };

  const draftPoints = draft.points.split("\n").map((p) => p.trim()).filter(Boolean);
  const draftOk = !!draft.question.trim() && !!draft.answer.trim() && (card?.kind !== "prompt" || draftPoints.length > 0);

  const saveEdit = async () => {
    if (!card || !draftOk) return;
    await s.hold(async () => {
      try {
        await setText(card, draft.question, draft.answer, card.kind === "prompt" ? draftPoints : undefined);
        setPhase("checked");
      } catch (e) {
        notify(errorText(e), "error");
      }
    });
  };

  const pickSure = (n: number) => {
    setConf(n);
    if (card?.kind === "prompt") keepDraft(card, answer, n);
    if (card?.kind === "card") {
      setPhase("checked");
      sfx("tap");
      shownAnswerAt.current = Date.now();
      loadPassage(card);
    } else if (askSure) {
      setAskSure(false);
      // Check (or reveal for an in-head answer) with the confidence just picked.
      setTimeout(() => document.getElementById(pending.current === "head" ? "review-head" : "review-check")?.click());
    }
  };

  if (leave) leave.current = () => s.finish(false);
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    // WebKit can clear isComposing on the confirmation key; 229 still belongs to the IME.
    if (paused || under || e.isComposing || e.keyCode === 229) return;
    // A sheet over Review (its ⋯ on the phone) or a panel with its own keys (the ambience radio) is portaled out of it
    // and takes its keys: Esc closes it only, a number picks a channel instead of rating (F93).
    // Whatever has focus: in the frame before the sheet takes it, the key's target is the page (F61).
    const here = root.current;
    if ([...document.querySelectorAll('[aria-modal="true"], [data-own-keys]')].some((m) => !here?.contains(m) && !m.contains(here))) return;
    if (is(e, "undo") && s.busy && !((e.target as HTMLElement).isContentEditable || ownsUndo(e.target))) {
      // The step it should take back isn't on the history yet (or is being taken back): it waits.
      e.preventDefault();
      e.stopPropagation();
      s.holdUndo({ code: e.code, key: e.key, metaKey: e.metaKey, ctrlKey: e.ctrlKey, altKey: e.altKey, shiftKey: e.shiftKey });
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
      else void s.finish(!quick);
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
      if (!e.repeat) void retire();
      return;
    }
    if (is(e, "later")) {
      e.preventDefault();
      // A held ⌘L puts off the one on screen, never the ones after it.
      if (!e.repeat) later();
      return;
    }
    const digit = reviewDigit(e);
    if (phase === "answer") {
      if (is(e, "hint") && card.kind === "prompt") {
        e.preventDefault();
        if (cued < CUE_LEVELS) setCued(cued + 1);
      } else if (is(e, "no-idea") && card.kind === "prompt") {
        e.preventDefault();
        void check(true);
      } else if (is(e, "in-head") && card.in_head_ok) {
        e.preventDefault();
        answerInHead();
      } else if (is(e, "finish") && card.kind === "prompt") {
        e.preventDefault();
        void check();
      } else if (!inTextField(e) && digit !== null && digit <= 3) {
        e.preventDefault();
        pickSure(digit);
      }
      return;
    }
    if (inTextField(e)) return;
    if (e.repeat || Date.now() - shownAnswerAt.current < 300) return;
    const plain = !e.metaKey && !e.ctrlKey && !e.altKey;
    if (digit !== null) {
      e.preventDefault();
      void rate(digit);
    } else if (plain && e.key === "Enter" && suggested && onSurface) {
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
  const skillOf = (id: string): Skill => skills.find((k) => k.id === id) ?? { id, name: id, priority: "P2" };
  // D246: the gem he sees before he rates never shows what a Good would win. A Fact exercise, rated by him
  // alone, shows none; a nearly cut one reads as growing. People just short of a goal overstate (Schweitzer 2004),
  // and a generous Good here costs the memory the gem stands for.
  const gemNow = card?.kind === "card" ? undefined : card?.history?.gem?.kind;
  const gemShown = gemNow === "ready" ? "rough" : gemNow;
  const sureMiss = phase === "checked" && conf === 3 && suggested !== undefined && suggested <= 2;

  return (
    // A full-window sheet: Tab and ⇧Tab stay on the card, never in the hidden app behind it. Let go while a
    // layer sits over it (⌘K, ⌘/) or it is paused on a source, so that layer owns focus and Esc.
    <Trap off={paused || under}>
    <div className="review" ref={root} tabIndex={-1} role="dialog" aria-modal={!paused} aria-label="Review" hidden={paused} data-gives-back="" data-done={done} data-steps={done + left}>
      <div className="review-head" data-tauri-drag-region>
        {moment && !end && (
          // D271: a chip in the head bar, clear of the question and of every button he presses.
          <div className="review-moment" key={moment.n} data-tone={moment.tone} data-color={moment.color} data-days={moment.days > 0 || undefined} role="status">
            {!quick && <span className="moment-mole"><Mole bare size={48} mood={MOMENT_MOOD[moment.kind]} /></span>}
            <span className="moment-gem" aria-hidden="true">
              <Gem kind={moment.from.kind} size={24} seam={moment.from.seam} polished={moment.from.polished} />
              <Gem kind={moment.to.kind} size={24} seam={moment.to.seam} polished={moment.to.polished} />
            </span>
            {moment.days > 0 && (
              <b className="moment-days">
                <DotNumber value={`+${moment.days}`} height={18} />
                <span className="sr-only">+{moment.days}</span> {moment.days === 1 ? "day" : "days"}
              </b>
            )}
            <span className="moment-why">{moment.line}</span>
          </div>
        )}
        {quick ? (
          // The quick quiz has no fixed length; what matters is that it counts toward today's goal (D60).
          start && !end && start.counts && (
            <Hint text={`${minutes(start.active_ms + s.activeMs)} of ${start.goal_minutes} minutes today`}>
              <div className="quick-ring">
                <Ring value={start.goal_ms ? (start.active_ms + s.activeMs) / start.goal_ms : 0} met={start.met} size={22} label={`${minutes(start.active_ms + s.activeMs)} of ${start.goal_minutes} minutes today`} />
              </div>
            </Hint>
          )
        ) : (
          // D246: nothing counts the session up here. Exercises done over everything due drew the backlog as a bar
          // that a miss set back, and the session never ended on it. The spacer keeps the buttons to the right.
          <span className="review-head-gap" />
        )}
        {s.canUndo && (
          <Hint text="Undo last rating" keys="undo">
            <button className="quiz-close" aria-label="Undo last rating" disabled={busy} onClick={() => s.undoLast()}>
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
          <button className="quiz-close" aria-label="Leave review" onClick={() => (end ? onClose() : void s.finish(!quick))}>
            <X size={16} weight="bold" aria-hidden="true" />
          </button>
        </Hint>
      </div>

      {/* VoiceOver hears each new card and the key points as marked (by the AI, or by him), not only the end screen. */}
      <div className="sr-only" aria-live="polite">
        {card && !end && queue?.length ? `Exercise ${done + 1}. ${card.question.replace(/_{4,}/g, "blank")}${phase === "checked" ? (card.kind === "card" ? `. Answer: ${card.answer}. Rate your recall.` : `. Answer: ${card.answer}.${gradeError ? ` ${PHONE && gradeError !== KEY_POINTS_CHANGED ? "Checking answers runs on your Mac for now." : gradeError} Mark what you got, then rate your recall.` : ""}`) : ""}${marks?.some((m) => m !== undefined) ? `. Marked ${marks.filter(Boolean).length} of ${marks.length} key points` : ""}` : ""}
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
        {!error && !end && queue && !queue.length && s.reviewed > 0 && <p className="loading"><Working label="Wrapping up…" /></p>}
        {quick && !error && queue && !queue.length && !s.reviewed && <p className="loading">{nothingDue(s.start, pick, source)}</p>}

        {s.goalSaid && !moment && !end && (
          <div className="review-goal" role="status">
            <Mole bare size={48} mood="wave" />
            <MoleSays lines={GOAL_SAID}>
              <Hint text={<>End the session <kbd>Esc</kbd></>}>
                <button className="moment-done" onClick={() => void s.finish()}>Done</button>
              </Hint>
            </MoleSays>
          </div>
        )}
        {end && <EndScreen end={end} skills={skills} quick={quick} onDone={() => onClose()} onAgain={() => onClose(true)} onDig={onDig} />}

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
              <div className="review-q" role="heading" aria-level={1}><ExerciseText text={card.question} dir={card.source_dir} /></div>
            )}
            {card.figure && card.figure_file && phase !== "edit" && <Occluded file={card.figure_file} box={card.figure.box} shown={phase === "checked"} />}

            {phase === "answer" && card.kind === "prompt" && (
              <>
                {cued > 0 && (
                  <p className="review-cue" aria-label="Hint" aria-live="polite">
                    {cue(cueSource(card), cued)}
                  </p>
                )}
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
                  {cued < CUE_LEVELS && (
                    <Hint text={cued ? "Another hint" : "A hint: the first letters"} keys="hint" side="top">
                      <button className="quiz-ghost" onClick={() => setCued(cued + 1)}>
                        {cued ? "More" : "Hint"}
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
                <div className="review-answer"><ExerciseText text={card.answer} dir={card.source_dir} /></div>
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
                            <span className="quiz-point"><ExerciseText text={p} inline /></span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
                {card.kind === "prompt" && !marks && !gradeError && (
                  <p className="loading review-grading"><Working stage="check" label="Checking your answer…" slow="This can take about 20 seconds." /></p>
                )}
                {grade?.feedback && <div className="review-feedback"><ExerciseText text={grade.feedback} /></div>}
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
                    <summary>Same idea as: <ExerciseText text={card.original.question} dir={card.source_dir} inline /></summary>
                    <div className="review-answer"><ExerciseText text={card.original.answer} dir={card.source_dir} /></div>
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
                    {gemShown && (
                      <Hint text={GEM_SAYS[gemShown]} side="top">
                        <span className="review-gem" tabIndex={0} aria-label={GEM_SAYS[gemShown]}><Gem kind={gemShown} size={18} seam={card.history.gem!.seam} polished={card.history.gem!.polished} /></span>
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
                    {marks?.some((m) => m === false) ? missedOf(marks) : "This one is down as a miss."} Press {RATINGS[guard - 1]} again to keep it.
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
                        await setText(card, p.question, p.answer, undefined, true, card, p.ai);
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
      {!end && card && entry && <KeyFoot phase={phase} kind={card.kind} hint={card.kind === "prompt" && cued < CUE_LEVELS} suggested={suggested} variant={!!card.variant} inHead={!!card.in_head_ok} draft={entry.state === "draft"} />}
    </div>
    </Trap>
  );
}

/** The review footer: the keys for this step, Raycast's action bar (DESIGN.md). `suggested`: the rating ↵ gives,
 *  named in the bar as its button is (Again, Hard, Good or Easy); none, no ↵. */
function KeyFoot({ phase, kind, hint, suggested, variant, inHead, draft }: { phase: Phase; kind: CardFull["kind"]; hint: boolean; suggested?: number; variant: boolean; inHead: boolean; draft: boolean }) {
  const map = useKeymap();
  const k = (id: KeyId) => label(map[id]);
  const rows: [string, string][] =
    phase === "edit"
      ? [[k("finish"), "Save"], ["Esc", "Cancel"]]
      : phase === "answer"
        ? kind === "prompt"
          ? // No "1 2 3" here: digits type into the answer; ⌘↵ asks how sure, and then 1–3 work.
            [[k("finish"), "Check"], ...(inHead ? [[k("in-head"), "In my head"] as [string, string]] : []), ...(hint ? [[k("hint"), "Hint"] as [string, string]] : []), [k("no-idea"), "No idea"], [k("later"), "Later"], ["Esc", "Leave"]]
          : [["1 2 3", "How sure, then show"], [k("later"), "Later"], ["Esc", "Leave"]]
        : [["1–4", "Rate"], ...(suggested ? [["↵", RATINGS[suggested - 1]!] as [string, string]] : []), [k("ask"), "Ask"], [k("edit-card"), "Edit"], ...(variant ? [[k("bad-version"), "Bad version"] as [string, string]] : []), [k("later"), "Later"], [k("retire-card"), draft ? "Delete" : "Retire"], ["Esc", "Leave"]];
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


/** What the mole says when the day's goal closes mid-session (D246). */
const GOAL_SAID = [{ text: "Goal met. The rest is extra." }];

/** The end screen's lines (D241): one place, one line at a time. Each rolls up into it, holds, and rolls on up
 *  as the next arrives, round and round; the pointer or the keyboard on a line holds it. Every line is in the
 *  page throughout, so a single line just sits there, and under Reduce Motion they are a plain list. */
function EndLines({ run, children }: { run: boolean; children: React.ReactNode }) {
  const lines = Children.toArray(children);
  const [at, setAt] = useState(0);
  // The pointer and the keyboard each hold it on their own: leaving with one never lets go for the other.
  const [over, setOver] = useState(false);
  const [within, setWithin] = useState(false);
  const held = over || within;
  const flat = still();
  useEffect(() => {
    if (flat || !run || held || lines.length < 2) return;
    const id = setInterval(() => setAt((i) => i + 1), HOLD_MS);
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

/** A result's number in the ring's dots, running up from nothing once `go` (D252); whole at once under Reduce Motion. */
/** A result's number `k` of the way up (0 to 1): its sign and unit stay, the digits run. */
export function countText(value: string, k: number) {
  const m = /^(\D*)(\d+(?:\.(\d+))?)$/.exec(value);
  // A frame's clock can read just before the count began (F413): never below nothing, a "-0" a dot wider.
  return m ? `${m[1]}${(Number(m[2]) * Math.min(1, Math.max(0, k))).toFixed(m[3]?.length ?? 0)}` : value;
}
function CountUp({ value, go }: { value: string; go: boolean }) {
  const [k, setK] = useState(still() ? 1 : 0);
  useEffect(() => {
    if (!go || still()) return;
    const ms = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--t-moment")) || 600, t0 = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      const x = Math.min(1, (now - t0) / ms);
      setK(1 - (1 - x) ** 3);
      if (x < 1) frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [go]);
  return (
    // The final number holds the room from the start, so a count that gains a digit never shifts the row.
    <span className="count-up">
      <span className="count-size"><DotNumber value={value} height={28} trim /></span>
      <DotNumber value={countText(value, k)} height={28} glint={go && k >= 1} trim />
    </span>
  );
}

/** The end screen's run of notes, in semitones above the recall's shine: a skill's row each (three at most), then a
 *  result each, climbing a major scale so the screen ends higher than it began. */
const END_NOTES = [0, 2, 4, 7, 9];
/** How long after one result the next lands. */
const TALLY_GAP_MS = 320;
/** How often, when the cart comes, the mole is asleep on it. */
const NAP_SHARE = 2 / 3;

/** The end screen's row of results (D252, after Duolingo's lesson-complete row): two at most, each a
 *  mark beside a number in dots (D259) over what it counts, landing one after another once `go`, then still. The number's text
 *  is in the page throughout for a reader. */
function Tally({ tiles, go, onDone }: { tiles: Tile[]; go: boolean; onDone: () => void }) {
  const [n, setN] = useState(still() ? tiles.length : 0);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!go) return;
    if (n >= tiles.length) return done.current();
    const id = setTimeout(() => {
      // A result lands with a tick, and its count ends on a shine, each a step above the one before (END_NOTES).
      if (!still()) (layer("tap", { up: 7, level: 0.5 }), layer("right", { up: END_NOTES[3 + n] ?? 12, after: 0.6, level: 0.4 }));
      setN((x) => x + 1);
    }, n ? TALLY_GAP_MS : 0);
    return () => clearTimeout(id);
  }, [go, n, tiles.length]);
  if (!tiles.length) return null;
  return (
    <ul className="end-tally">
      {tiles.map((t, i) => {
        const mark = t.key === "kept" ? null : <EndMark kind="calendar" />;
        const li = (
          <li key={t.key} data-key={t.key} data-wait={i >= n || undefined} tabIndex={t.hint ? 0 : undefined}>
            <span className="end-tally-pair">
              {mark && <span className="end-tally-mark" aria-hidden="true">{mark}</span>}
              <b><CountUp value={t.value} go={go && i < n} /><span className="sr-only">{t.value}</span></b>
            </span>
            <span className="end-tally-label">{t.label}</span>
          </li>
        );
        return t.hint ? <Hint key={t.key} text={t.hint}>{li}</Hint> : li;
      })}
    </ul>
  );
}

/** The end of a session (D62): the ring fills by this session's minutes and bursts if it closed
 *  just now, a skill that went up a level says so, and the count is of memories kept, never a score. */
export function EndScreen({ end, skills, quick, onDone, onAgain, onDig }: { end: End; skills: Skill[]; quick?: boolean; onDone: () => void; onAgain: () => void; onDig?: (skill: string) => void }) {
  // The screen opens at its top, with Done holding the keys: on a short phone it is taller than the window, and the
  // scroll the last exercise left (its rating buttons at the foot) and a plain autoFocus on Done opened it past the
  // goal line and the mole (Codex UX sweep).
  const done = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const body = done.current?.closest(".review-body");
    if (body) body.scrollTop = 0;
    done.current?.focus({ preventScroll: true });
  }, []);
  const { session: s, today: t, before: b } = end;
  const part = (x: Today | null) => (!x ? 0 : x.met ? 1 : x.goal_ms ? x.active_ms / x.goal_ms : 0);
  const closed = t.met && !!b && !b.met;
  // Caught up short of the goal still counts (D60), but it isn't the goal being met.
  const short = t.counts && t.caught_up && t.active_ms < t.goal_ms;
  // The quick quiz's title says what happened, never a cheer (Tyler 2026-11-14).
  const title = short ? "All caught up · today counts" : closed ? "Goal met" : `${s.reviews} answered`;
  const ups = t.skills.filter((k) => k.level > (b?.skills.find((x) => x.skill === k.skill)?.level ?? k.level));
  // D190: the cart tips this session's ore into the ring, once, when there is something to tip: ring dots this
  // session lit, or gems it cut. Not in the quick quiz, on the phone, or under Reduce Motion.
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const shown = (s.cut ?? []).slice(0, CUT_SHOWN);
  const [pour] = useState(() => {
    const dots = oreFor(part(b), part(t), ringDots(END_RING));
    return !quick && !PHONE && !document.hidden && !still() && (dots.length > 0 || shown.length > 0) ? dots : null;
  });
  // D255: two endings in three with a cart, the mole rides it in asleep and falls out onto the ring; else he comes up out of the ground.
  const [nap] = useState(() => !!pour && Math.random() < NAP_SHARE);
  // cart: rolling and pouring · poured: the ring is full · leaving: the cart starts off, and the mole comes up unless he is riding it (then when he has fallen) · done: the cart has gone.
  const [stage, setStage] = useState<"cart" | "poured" | "leaving" | "done">(pour ? "cart" : "done");
  const [landed, setLanded] = useState(pour ? 0 : shown.length);
  // He comes up out of the ground first, with or without a cart before it, and after falling off the cart into his hole too (D255: `hole` while he is on it, `pop` once he has gone down) (under Reduce Motion he is just there, at rest: pleased, or plain after a session of misses).
  const [settled, setSettled] = useState(still);
  const [fell, setFell] = useState(false);
  // The mole reacts to the day 560ms after it comes up (its rise), whatever the cart does after that; after a fall, once he has popped back up.
  const up = stage === "leaving" || stage === "done";
  // After a fall the wait starts when he has gone down his hole: an empty beat, then up he pops, and only then does he speak.
  const risen = nap ? fell : up;
  useEffect(() => {
    if (!risen) return;
    const id = setTimeout(() => setSettled(true), nap ? 1000 : 560);
    return () => clearTimeout(id);
  }, [risen]);
  const full = stage !== "cart";
  // The end screen's sounds: the cart rolling in, the jingle as the ring fills, and the mole's pop as he comes up (260ms into his rise).
  // Over them, a layer for each thing that lands (D336): a minute counted, a skill's row, a result, his letters.
  // Each once: an effect can run again for the same moment (React's strict mode runs a mount's twice).
  const played = useRef(new Set<Sound>());
  const once = (id: Sound, after = 0) => void (!played.current.has(id) && (played.current.add(id), sfx(id, { after })));
  useEffect(() => void (pour && once("cart")), []);
  useEffect(() => void (full && once("done")), [full]);
  useEffect(() => void (risen && !quick && !still() && once("pop", 0.26)), [risen]);
  // D197: a cut gem that was won back has a gold rim; a gem passed on a new case this session shows polished.
  const cutN = s.cut?.length ?? 0;
  const mendedN = (s.grades ?? []).filter((g) => g === "mended").length;
  const polishedN = (s.polished?.length ?? 0) + (s.grades ?? []).filter((g) => g === "polished").length;
  // `old`: a gem that was cut before this session and polished in it; it shows once the cart has poured.
  const gems = [...shown.map((skill, i) => ({ skill, seam: s.grades?.[i] === "mended", polished: s.grades?.[i] === "polished", old: false })), ...(s.polished ?? []).slice(0, CUT_SHOWN - shown.length).map((skill) => ({ skill, seam: false, polished: true, old: true }))];
  const more = cutN + (s.polished?.length ?? 0) - gems.length;
  // What leaves the ring for the skills' rows: every memory kept, as a stone or as the gem it became.
  const [rowPlan] = useState(() => (quick ? endPlan([], [], [], []) : endPlan(s.cut ?? [], s.kept_skills ?? [], b?.skills ?? t.skills, t.skills)));
  const fliers = rowPlan.fliers;
  // The end's own order (`SkillStage`, `SkillRows`): null before it starts, a row of the plan while that skill has
  // the big ring, -3 between turns (the ring stays put away), -2 while the stones fly, -1 when it is over.
  const [onStage, setOnStage] = useState<number | null>(still() || quick ? -1 : null);
  const [leaving, setLeaving] = useState<{ dx: number; dy: number } | null>(null);
  // The gems that have left the ring, by their place in it: kept here too, so one drawn again stays gone.
  const [goneGems, setGoneGems] = useState<number[]>([]);
  const [prog, setProg] = useState<EndProg>(() => {
    const over = still() || !!quick;
    return { cut: rowPlan.rows.map((r) => (over ? r.cut : 0)), stone: rowPlan.rows.map(() => 0), shown: rowPlan.rows.map(() => over), done: over };
  });
  const staged = onStage !== null && onStage >= 0 ? rowPlan.rows[onStage] : undefined;
  const t0 = t;
  // D242: the gems land inside the ring, sized to fit it.
  const gemSize = quick ? 36 : gems.length <= 3 ? 56 : gems.length <= 6 ? 48 : 32;
  const cluster = gems.length > 0 && (
        <p className="review-cut" aria-label={[cutN && `${cutN} became solid`, mendedN && `${mendedN} won back`, polishedN && `${polishedN} polished`].filter(Boolean).join(", ")}>
          {gems.map((g, i) => {
            const sk = skills.find((x) => x.id === g.skill);
            return (
              // With the cart, a gem is cut the moment its rough stone lands; its place is kept until then. A gem cut before today and polished now shows once the cart has poured.
              <Hint key={i} text={`${sk ? `${sk.name} · ` : ""}${g.polished ? "Polished: you passed it as a remix" : g.seam ? "Won back: you missed it once and cut it again" : "Cut: you'd still recall it three weeks from now"}`}>
                <span data-color={sk?.color} data-fly={!g.old || undefined} data-i={i} data-gone={goneGems.includes(i) ? "" : undefined} data-skill={g.skill} data-off={(staged && staged.skill !== g.skill) || undefined} data-stone={(pour && !g.old) || undefined} data-wait={(g.old ? stage === "cart" : i >= landed) || undefined} style={{ animationDelay: pour ? "0ms" : `${500 + i * 90}ms` }}>
                  {/* With the cart, the stone that lands is cut where it stands: its dots fuse into pixels (D239). */}
                  {pour && !g.old ? <Cutting go={i < landed} size={gemSize} seam={g.seam} polished={g.polished} /> : <Gem kind="cut" size={gemSize} seam={g.seam} polished={g.polished} />}
                </span>
              </Hint>
            );
          })}
          {more > 0 && landed >= shown.length && <b data-gone={(shown.length > 0 && (onStage !== null)) || undefined}>+{more}</b>}
        </p>
  );
  // The quick quiz says the count in a line of its own; the full end screen has it in the row of results.
  const kept = s.kept > 0 && (
    <p className="review-kept">
      <b>{s.kept}</b> {s.kept === 1 ? "memory" : "memories"} kept
    </p>
  );
  // The results land, then the mole says his line.
  const [tallied, setTallied] = useState(false);
  const [roll] = useState(Math.random);
  const skill = (id: string) => skills.find((x) => x.id === id);
  const named = ups.map((k) => ({ skill: k.skill, name: skill(k.skill)?.name ?? k.skill, level: k.level }));
  const said = endSays({
    session: s, today: t, closed, short, roll, ups: named, plain: quick, napped: nap, row: !quick,
    minutesLeft: !t.met && t.counts ? minutesText(Math.max(0, t.goal_ms - t.active_ms)) : null,
  });
  const tiles = endTiles({ session: s });
  // The skills' rows land first, one at a time, and the row of results after them.
  const [rowsIn, setRowsIn] = useState(false);
  // His pose is for the line he says (D258).
  // He says a word aloud as he takes it, on the few days that earn one (D330); the quick quiz has no mole.
  const aloud = quick ? null : endVoice(said[0], { session: s, closed, napped: nap });
  // His box comes up as he starts to speak, never before (Tyler, 2026-11-20: "the text box pops up for a long
  // time before he speaks"): once he has settled and the results are in. His voice goes with it.
  const speaks = settled && stage === "done" && (tallied || tiles.length === 0);
  useEffect(() => void (speaks && aloud && once(aloud, 0.1)), [speaks]);
  const cheering = !!staged && prog.cut[onStage!]! > 0 && levelAt(staged, prog.cut[onStage!]!, false, b?.skills ?? t.skills, t.skills).up;
  const mood = nap && !fell ? "hole" : !settled ? (nap ? "pop" : "peek") : cheering ? "cheer" : endMood(said[0], { session: s, closed, napped: nap, still: still() });
  // D274: the full end screen's ring holds the day's minutes, and minutes past the goal go round again.
  // Gems the session cut are cut in the ring first (D239), then make way for the minutes; they wait for the
  // last stone, and a beat more so each cut is seen. Then the count has no room to run up to the goal, so it
  // starts there.
  const calm = still();
  const [away, setAway] = useState(calm || !!quick || gems.length === 0 && fliers.length === 0);
  // The gems cut in the ring leave it one at a time, each for the row of the skill it belongs to, where it is one
  // step to that skill's next level. The rows come in first, as the skills stood before the session.
  useEffect(() => {
    if (calm || quick || !fliers.length || !full || landed < shown.length) return;
    const id = setTimeout(() => setRowsIn(true), pour ? 500 : 1100 + gems.length * 90);
    return () => clearTimeout(id);
  }, [full, landed]);
  useEffect(() => {
    if (!rowsIn || onStage === -1 || !host) return;
    const ids: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, f: () => void) => void ids.push(setTimeout(f, ms));
    const bump = (key: "cut" | "stone", row: number) => setProg((p) => ({ ...p, [key]: p[key].map((n, i) => (i === row ? n + 1 : n)) }));
    // A copy of flier `i` goes from `from` to the point `to`, over an arc, and is taken in there.
    const fly = (i: number, row: number, from: DOMRect, to: { x: number; y: number }, opts: { big: number; seen: boolean; ms: number; end?: number }, land: () => void) => {
      const slot = host.querySelector<HTMLElement>(`[data-slot="${i}"]`), medal = host.querySelector<HTMLElement>(`.end-medal-ring[data-row="${row}"]`);
      if (!slot || !medal) return land();
      // A medal the row is not showing now takes its stone unseen.
      const view = host.querySelector(".end-skills")!.getBoundingClientRect(), mr = medal.getBoundingClientRect();
      // A line the list is not showing now takes its stone unseen; a gem bound for one leaves the ring all the
      // same, down to the foot of the list where its line will roll in.
      if (mr.bottom < view.top + 8 || mr.bottom > view.bottom) {
        if (!opts.seen) return land();
        to = { x: view.right - 40, y: view.bottom - 6 };
        opts = { ...opts, end: undefined };
      }
      const w = slot.querySelector("svg")!.getBoundingClientRect().width || 24;
      const dx = from.left + from.width / 2 - to.x, dy = from.top + from.height / 2 - to.y;
      const ghost = slot.cloneNode(true) as HTMLElement;
      ghost.removeAttribute("data-slot");
      Object.assign(ghost.style, { position: "fixed", left: `${to.x - w / 2}px`, top: `${to.y - w / 2}px`, width: `${w}px`, height: `${w}px`, zIndex: "5", pointerEvents: "none", visibility: "visible", display: "grid", placeItems: "center" });
      // The gem's colours come from its skill's colour, which the copy has to carry out of the medal.
      ghost.dataset.color = medal.closest<HTMLElement>("[data-color]")?.dataset.color ?? "";
      // Beside the end screen, not in it: the screen's own entrance leaves a transform on it, which would
      // move a fixed box off its mark; and under the page's body it would sit beneath the review.
      (host.parentElement ?? host).append(ghost);
      ghost.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${opts.seen ? opts.big : 0.3})`, opacity: opts.seen ? 1 : 0 },
        { transform: `translate(${dx * 0.6}px, ${dy * 0.75 - 26}px) scale(${opts.big * 1.15})`, opacity: 1, offset: 0.35 },
        { transform: "translate(0, 0) scale(1)", opacity: 1, offset: 0.88 },
        // One that lands on its own place in a line ends at that place's size and is swapped for it; one that
        // lands on a ring is taken in.
        opts.end ? { transform: `translate(0, 0) scale(${opts.end})`, opacity: 1 } : { transform: "translate(0, 0) scale(0.3)", opacity: 0 },
      ], { duration: opts.ms, easing: "cubic-bezier(0.5, 0, 0.25, 1)" }).onfinish = () => (ghost.remove(), land());
    };
    // A gem of this skill still in the ring.
    const gemOf = (skill: string) => [...host.querySelectorAll<HTMLElement>(".review-cut > span[data-fly]:not([data-gone])")].find((x) => x.dataset.skill === skill) ?? null;
    const take = (src: HTMLElement) => (src.setAttribute("data-gone", ""), setGoneGems((g) => [...g, Number(src.dataset.i)]));
    const was = b?.skills ?? t0.skills;
    let t = 150;
    // A skill that won a gem has its turn in the big ring: it comes up, its gems go to the rim one on another's
    // heels, it is held a beat (longer for a new level) and goes down to its medal. So the wait grows with the
    // skills that won, not with the gems.
    rowPlan.rows.forEach((r, row) => {
      const cuts = r.slots.filter((k) => k === "cut").length, levelUp = ups.some((k) => k.skill === r.skill);
      if (!cuts || !r.solo) return;
      at(t, () => (setLeaving(null), setOnStage(row)));
      t += 200;
      for (let d = 0; d < cuts; d++) {
        at(t + d * 90, () => {
          const src = gemOf(r.skill), ring = host.querySelector(".end-stage-ring");
          if (!src || !ring) return bump("cut", row);
          // It lands where the ring will be lit next: the end of the skill's share with this gem in.
          const z = ring.getBoundingClientRect(), a = Math.min(1, levelAt(r, d + 1, false, was, t0.skills).share) * 2 * Math.PI - Math.PI / 2;
          const from = src.getBoundingClientRect();
          take(src);
          const to = { x: z.left + z.width / 2 + 0.43 * z.width * Math.cos(a), y: z.top + z.height / 2 + 0.43 * z.height * Math.sin(a) };
          fly(r.first + d, row, from, to, { big: from.width / 28, seen: true, ms: 420 }, () => {
            // Where it lands, the rim answers: a dot of the skill's colour opens and fades.
            const pop = document.createElement("i");
            pop.className = "end-stage-pop";
            pop.dataset.color = skills.find((x) => x.id === r.skill)?.color ?? "";
            Object.assign(pop.style, { left: `${to.x}px`, top: `${to.y}px` });
            (host.parentElement ?? host).append(pop);
            pop.animate([{ transform: "scale(0.6)", opacity: 1 }, { transform: "scale(3.2)", opacity: 0 }], { duration: 420, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)" }).onfinish = () => pop.remove();
            layer("right", { up: END_NOTES[Math.min(d, END_NOTES.length - 1)] ?? 0, level: 0.6 });
            // Its last gem stands for every gem the skill cut, also the ones past the five a line draws.
            if (d === cuts - 1) setProg((p) => ({ ...p, cut: p.cut.map((n, i) => (i === row ? r.cut : n)) }));
            else bump("cut", row);
            if (d === cuts - 1 && levelUp) layer("goal", { after: 0.05, level: 0.6 });
          });
        });
      }
      t += (cuts - 1) * 90 + 420 + (levelUp ? (t < 1000 ? 650 : 380) : 200);
      // It goes down to its own medal's place, in one move.
      at(t, () => {
        const m = host.querySelector(`.end-medal-ring[data-row="${row}"]`)?.getBoundingClientRect(), z = host.querySelector(".end-stage")?.getBoundingClientRect();
        setLeaving(m && z ? { dx: m.left + m.width / 2 - (z.left + z.width / 2), dy: m.top + m.height / 2 - (z.top + z.height / 2) } : { dx: 0, dy: 150 });
        // Its line is there to meet it: the name and today's gems come in as it leaves, the medal as it lands.
        setProg((p) => ({ ...p, shown: p.shown.map((x, i) => x || i === row), landing: row }));
      });
      t += 300;
      at(t, () => (setProg((p) => ({ ...p, landing: undefined })), setOnStage(-3)));
    });
    // Then every medal is out, and the rough stones go to them in one volley from the ring's middle.
    at(t, () => (setOnStage(-2), setProg((p) => ({ ...p, shown: p.shown.map(() => true) }))));
    t += 120;
    // The volley is over in the same time however many stones it has.
    const gap = Math.min(40, 520 / Math.max(1, rowPlan.rows.reduce((n, r) => n + r.slots.filter((k) => !(k === "cut" && r.solo)).length, 0)));
    let stones = 0;
    // The gems still in the ring leave first, then the stones from its middle, so the ring is soon free.
    const volley = rowPlan.rows.flatMap((r, row) => r.slots.map((kind, d) => ({ r, row, kind, d }))).filter((x) => !(x.kind === "cut" && x.r.solo)).sort((x, y) => Number(y.kind === "cut") - Number(x.kind === "cut"));
    const gemsOut = volley.filter((x) => x.kind === "cut").length;
    volley.forEach(({ r, row, kind, d }) => {
      at(t + stones++ * gap, () => {
        // A gem of a skill that had no turn of its own goes from where it was cut straight to its medal.
        const src = kind === "cut" ? gemOf(r.skill) : null;
        if (kind === "cut") {
          const pip = host.querySelector(`[data-pip="${row}-${d}"]`), m = pip?.getBoundingClientRect();
          if (!m) return bump("cut", row);
          // A gem the ring had no room to show comes from its middle, as the stones do.
          const c = host.querySelector(".end-ring")?.getBoundingClientRect();
          const from = src ? src.getBoundingClientRect() : c ? new DOMRect(c.left + c.width / 2 - 14, c.top + c.height / 2 - 14, 28, 28) : null;
          if (!from) return bump("cut", row);
          if (src) take(src);
          return fly(r.first + d, row, from, { x: m.left + m.width / 2, y: m.top + m.height / 2 }, { big: from.width / 28, seen: !!src, ms: 480, end: 20 / 28 }, () => (pip?.removeAttribute("data-wait"), layer("right", { up: END_NOTES[Math.min(row, END_NOTES.length - 1)] ?? 0, level: 0.5 }), bump("cut", row)));
        }
        const medal = host.querySelector(`[data-pip="${row}-${d}"]`), ring = host.querySelector(".end-ring");
        if (!medal || !ring) return bump("stone", row);
        const z = medal.getBoundingClientRect(), c = ring.getBoundingClientRect();
        fly(r.first + d, row, new DOMRect(c.left + c.width / 2 - 10 + (d % 3 - 1) * 14, c.top + c.height / 2 - 10, 20, 20), { x: z.left + z.width / 2, y: z.top + z.height / 2 }, { big: 1.6, seen: false, ms: 420, end: 17 / 24 }, () => {
          // Its place is lit here and now, not when the screen next draws: a busy screen left a gap between the
          // flying stone going and its place showing.
          medal.removeAttribute("data-wait");
          bump("stone", row);
          layer("tap", { up: END_NOTES[Math.min(row, END_NOTES.length - 1)] ?? 0, level: 0.3 });
        });
      });
    });
    // The ring is free for the minutes as soon as the last gem has left it, while the stones are still in the air.
    const cleared = t + gemsOut * gap + (stones ? 160 : 0);
    t += stones ? (stones - 1) * gap + 480 : 0;
    // A gem still in the ring (one the ring had no room to show until others left) goes down to the list too,
    // so none is left behind to vanish.
    at(cleared - 140, () => host.querySelectorAll<HTMLElement>(".review-cut > span[data-fly]:not([data-gone]):not([data-swept])").forEach((src, n) => {
      const view = host.querySelector(".end-skills")?.getBoundingClientRect();
      if (!view) return;
      const a = src.getBoundingClientRect();
      src.setAttribute("data-swept", "");
      src.animate([{ transform: "none", opacity: 1 }, { transform: `translate(${view.right - 40 - (a.left + a.width / 2)}px, ${view.bottom - 6 - (a.top + a.height / 2)}px) scale(0.4)`, opacity: 0 }], { duration: 320, delay: n * 40, easing: "cubic-bezier(0.5, 0, 0.25, 1)", fill: "forwards" });
    }));
    t += stones ? 60 : 0;
    at(cleared + 100, () => setOnStage(-1));
    at(t, () => setProg((p) => ({ ...p, done: true })));
    return () => ids.forEach(clearTimeout);
  }, [rowsIn, host]);
  useEffect(() => {
    if (away || !full || landed < shown.length || (fliers.length > 0 && onStage !== -1)) return;
    const id = setTimeout(() => setAway(true), fliers.length ? 0 : pour ? 1100 : 1400 + gems.length * 90);
    return () => clearTimeout(id);
  }, [away, full, landed, onStage]);
  const [plan] = useState(() => {
    const p = lapPlan(b, t);
    // With no gem held in the ring the count has its whole run.
    return away || gems.length === 0 ? p : { ...p, from: Math.max(p.from, Math.min(p.to, p.goal || p.to)) };
  });
  const lap = useLap(plan, !quick && full && away);
  const counted = lap.min === plan.to;
  // The count crosses the goal on screen: then the dots it throws are the moment, and the burst stays out of it.
  const crossing = !calm && plan.goal > 0 && plan.from < plan.goal && plan.to >= plan.goal;
  const over = quick ? 0 : overDots(plan.goal ? lap.min - plan.goal : 0, plan.goal, ringDots(END_RING));
  const ring = quick
    ? <Ring value={part(full ? t : b)} from={part(b)} met={full ? t.met : !!b?.met} burst={closed && full} size={72} label={`${minutes(t.active_ms)} of ${t.goal_minutes} minutes today`} />
    : (
      // The ring follows the count, minute by minute; crossing the goal in the count is the moment (the dots it throws), so the burst is for a goal the count never crossed.
      <Ring step={away && plan.goal > 0} value={!full ? part(b) : !away || !plan.goal ? part(t) : lap.min / plan.goal} from={part(b)} met={!full ? !!b?.met : !away || counted ? t.met : false} burst={closed && full && !crossing} over={over} hit={lap.hit} size={END_RING} label={`${minutes(t.active_ms)} of ${t.goal_minutes} minutes today`}>
        {counted && <Sparkles over={over} n={ringDots(END_RING)} />}
      </Ring>
    );
  const rowed = counted && full && away;
  // Each minute the count takes ticks, a little higher each time, up to an octave.
  useEffect(() => void (!quick && !calm && full && away && lap.min > plan.from && layer("tap", { up: lapTickUp(plan, lap.min), level: 0.35 })), [lap.min]);
  // "Caught up" never hides the new cards the daily limits hold back (D65).
  const held = t.caught_up && t.new_waiting > 0 && <p className="quiz-faint">{waiting(t)}</p>;
  return (
    <div className={`review-end${pour ? " carted" : ""}`} role="status" ref={setHost}>
      {pour && stage !== "done" && host && (
        <CartTip host={host} mole={nap} onFell={() => setFell(true)} lit={pour} rich={rescuedWorthSaying(s) ? s.rescued : 0} stones={shown.map((id) => skills.find((x) => x.id === id)?.color)} onStone={(i) => setLanded((n) => Math.max(n, i + 1))} onPoured={() => setStage((x) => (x === "cart" ? "poured" : x))} onLeave={() => setStage("leaving")} onDone={() => (setLanded(shown.length), setStage("done"))} />
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
          <div className="end-emblem" data-glint={(closed && full) || undefined}>
            <span className="review-mole">{up && <Mole bare size={96} mood={mood} />}{up && <Mound />}</span>
            {/* D243, D252: the mole says one line, the rarest true thing or his verdict; the numbers are the row's. */}
            {speaks && <MoleSays className="end-says" lines={said.slice(0, 1)} blip={!aloud} />}
            <div className="end-ring" data-staged={!!staged || onStage === -3 || undefined}>
              {ring}
              {away ? <LapCentre min={lap.min} /> : cluster}
              {staged && <SkillStage key={staged.skill} row={staged} here={prog.cut[onStage!]!} leaving={leaving} size={END_RING} was={b?.skills ?? t.skills} now={t.skills} skills={skills} />}
            </div>
          </div>
          <SkillRows plan={rowPlan} prog={prog} was={b?.skills ?? t.skills} now={t.skills} skills={skills} run={calm || rowsIn} />
          <Tally tiles={tiles} go={rowed} onDone={() => setTallied(true)} />
          {held}
        </>
      )}
      {/* The quick quiz has no mole: it lists what the session won, one line at a time (D241). */}
      {quick && (
        <EndLines run={stage === "done"}>
          {kept}
          {said.filter((l) => !l.verdict || s.kept === 0).map((l) => <p key={l.text} className={l.verdict ? "review-kept" : "review-rescued"}>{l.text}</p>)}
        </EndLines>
      )}
      {/* D248: once in four weeks, an exercise that beat him weeks ago and that he passed today, his answer
          then over his answer now. His own words are the evidence; nothing is counted. */}
      {s.then_now && (
        <section className="then-now" aria-label="Then and now">
          <p className="then-now-q">{s.then_now.question.replace(/_{4,}/g, "____")}</p>
          <dl>
            <dt>{weeksAgo(s.then_now.then_ts)} ago</dt>
            <dd data-then>{s.then_now.then}</dd>
            <dt>Today</dt>
            <dd>{s.then_now.now}</dd>
          </dl>
        </section>
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
      {/* D325: a skill ready to be explained whole, from memory. One line, never owed: a click opens its Dig. */}
      {end.dig && onDig && (
        <Hint text="Explain the whole skill from memory · about 4 minutes">
          <button className="review-try review-dig" onClick={() => onDig(end.dig!.skill)}>
            <Stone size={16} uses={2} />
            <span>
              <span className="review-try-plan">{end.dig.goal}</span>
              <span className="review-try-from">Dig · {skills.find((x) => x.id === end.dig!.skill)?.name}</span>
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
          <button ref={done} className="pill-btn quiz-go" onClick={onDone}>
            Done
          </button>
        </Hint>
      </div>
    </div>
  );
}


const CHECKED_IN = "ore.try-checkin";
const dayOf = (ts: string | number | Date) => new Date(ts).toLocaleDateString("sv");
const asked = () => {
  try {
    return localStorage.getItem(CHECKED_IN) === dayOf(Date.now());
  } catch {
    return false;
  }
};

/** The try to ask about as a session starts (D324): of the ones he is trying now in the skills under review,
 *  the one he has left alone longest, and only one he last touched before today. Once a day, never in the quick
 *  quiz or a review of one source. */
function useCheckIn(pick: string[] | null, source: string | undefined, quick: boolean): [Try | null | undefined, () => void] {
  const [t, setT] = useState<Try | null | undefined>(() => (quick || source || asked() ? null : undefined));
  useEffect(() => {
    if (t !== undefined) return;
    let live = true;
    const all = pick ? Promise.all(pick.map((s) => ore<Try[]>("tries", opt("skill", s)))).then((l) => l.flat().filter((x) => x.active)) : ore<Try[]>("tries", "--now");
    all.then(
      (ts) => {
        if (!live) return;
        const today = dayOf(Date.now());
        const one = ts.filter((x) => dayOf(x.ts) < today).sort((a, b) => a.ts.localeCompare(b.ts))[0] ?? null;
        if (one) {
          try {
            localStorage.setItem(CHECKED_IN, today);
          } catch {
            // Asked again next session: no harm.
          }
        }
        setT(one);
      },
      () => live && setT(null), // The session says what is wrong with the library, not this.
    );
    return () => {
      live = false;
    };
  }, [t, pick]);
  return [t, () => setT(null)];
}

/** Review, with one question first on the days it applies: did he use the thing he is trying? It is asked where he
 *  reliably is, takes how it went, and one key ("Not yet", Esc) goes past it. */
export function Review(props: Parameters<typeof Session>[0]) {
  const [t, pass] = useCheckIn(props.pick, props.source, !!props.quick);
  if (t === undefined) return <div className="review" aria-label="Review" />;
  if (!t) return <Session {...props} />;
  const save = async (text: string, mine: boolean) => {
    const use = useOf(t, text, mine);
    if (!(await change(props.notify, { message: use.msg, kind: "quiet", write: (on) => (on ? use.run() : use.undo()) }))) return false;
    if (text) askMole(t.id);
    return true;
  };
  return (
    <Trap>
    <div className="review" role="dialog" aria-modal="true" aria-label="Did you try it?" data-gives-back="">
      <div className="review-head" data-tauri-drag-region>
        <span className="review-head-gap" />
        <Hint text="Leave review">
          <button className="quiz-close" aria-label="Leave review" onClick={() => props.onClose()}>
            <X size={16} weight="bold" aria-hidden="true" />
          </button>
        </Hint>
      </div>
      <div className="review-body">
        <div className="checkin" data-try={t.id}>
          <p className="checkin-ask">Did you try it?</p>
          <h1 className="checkin-plan">
            <Stone uses={usesOf(t)} size={18} />
            <span>{tryLabel(t)}</span>
          </h1>
          {t.when && <p className="checkin-when">when {t.when}</p>}
          <Did t={t} skip="Not yet" onSave={save} onClose={pass} />
        </div>
      </div>
    </div>
    </Trap>
  );
}
