import { CaretDown, CaretUp, Check, Circle, CircleHalf, MagnifyingGlass, X } from "./icons";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Grow } from "./Grow";
import { PixelStar } from "./PixelIcon";
import { Hint } from "./Hint";
import { is } from "./keys";
import { ore, opt, type Annotation, type Doc, type Evidence, type Feedback, type Notes, type Prequestion } from "./ore";
import { stampBefore } from "./transcript";
import { errorText, type Notify } from "./util";
import { PixelSpin, useLate, Working } from "./Working";

/** What Finish and ChapterRecall need from the source note: wait for a pending edit before the CLI
 *  appends to notes.md, then take the text it returns. */
type NotesSync = { flushNotes: () => Promise<boolean>; onNotes: (text: string) => void };

/** The source behind the quiz panel: null keeps it blurred (D52); otherwise it shows, stepping
 *  through `quotes` with `at` the current one (D55). */
export type Reveal = { quotes: Evidence[]; at: number } | null;

type Props = NotesSync & {
  doc: Doc;
  /** How far he got (D100): the body offset of the furthest point read or played, if he has been in it. */
  reached?: number;
  blocked: boolean;
  setReveal: (r: Reveal) => void;
  /** The passage the stepper is on: whether it is a key point already, and the one click that marks it. */
  keyPoint?: { on: boolean; toggle: () => void };
  onCancel: () => void;
  onDone: () => void;
  /** In a course (D79): the lesson to read next, which the closing card can open instead of going back. */
  nextLesson?: { title: string; open: () => void };
  notify: Notify;
};

const SURE = ["Guess", "Think so", "Sure"] as const;

// Typed text survives closing the panel (Esc) and reopening it while the reader stays open (D52).
type Draft = { step: number; recall: string; answers: string[]; conf: (number | undefined)[]; use: string; leave: string; qs: Prequestion[] };
const drafts = new Map<string, Draft>();

/** The finish step as a quiz panel beside the blurred source (D52 to D56): free recall first, then
 *  each prequestion is answered, rated for confidence and checked against its key points, with the
 *  source shown only after the attempt. */
export function Finish({ doc, reached, blocked, setReveal, keyPoint, onCancel, onDone, nextLesson, notify, flushNotes, onNotes }: Props) {
  const draft = drafts.get(doc.id);
  const [qs, setQs] = useState<Prequestion[]>(draft?.qs ?? doc.prequestions ?? []);
  /** "Leave anything out?" (D100): his words, sent to the AI with the recall. */
  const [leave, setLeave] = useState(draft?.leave ?? doc.leave_out?.text ?? "");
  // Stopped before the last few lines: the finish covers what he reached, shown as where he stopped.
  const partway = reached !== undefined && doc.body.length - reached > 400;
  const upTo = partway ? (stampBefore(doc.body, reached) ?? headingBefore(doc.body, reached, doc.title)) : undefined;
  const [step, setStep] = useState(draft?.step ?? 0); // 0 recall, 1..n questions, n + 1 done
  const [recall, setRecall] = useState(draft?.recall ?? doc.recall?.text ?? "");
  const [answers, setAnswers] = useState(() => draft?.answers ?? qs.map((q) => q.after ?? ""));
  const [conf, setConf] = useState<(number | undefined)[]>(() => draft?.conf ?? qs.map((q) => q.confidence));
  const [use, setUse] = useState(draft?.use ?? "");
  const [checked, setChecked] = useState<boolean[]>(() => qs.map(() => false));
  const [busy, setBusy] = useState(false);
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [checking, setChecking] = useState<Set<number>>(new Set());
  const [checkError, setCheckError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | string | null>(null); // a string is an error
  const feedbackRun = useRef<Promise<unknown> | null>(null);
  const [at, setAt] = useState(0);
  const moved = useRef(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const panel = useRef<HTMLElement>(null);
  // The questions in this finish: the ones a partway finish left out are skipped (D100).
  const shown = qs.map((_, i) => i).filter((i) => !qs[i]!.skipped);
  const n = shown.length;
  const qi = step >= 1 && step <= n ? shown[step - 1]! : -1;
  const q = qi >= 0 ? qs[qi]! : null;
  const isChecked = qi >= 0 && checked[qi]!;

  useEffect(() => {
    drafts.set(doc.id, { step, recall, answers, conf, use, leave, qs });
  }, [doc.id, step, recall, answers, conf, use, leave, qs]);

  // D56: key points for every prequestion, written while he does the free recall.
  const pointsRun = useRef<Promise<unknown> | null>(null);
  const loadPoints = () => {
    if (!qs.length || qs.every((p) => p.points)) return;
    setPointsError(null);
    pointsRun.current = ore<{ prequestions: Prequestion[] }>("key-points", doc.id).then(
      (r) => {
        // An empty reply would leave "Finding the key points…" up forever; say it failed instead.
        if (!r?.prequestions?.some((p) => p.points?.length)) return setPointsError("No key points came back.");
        setQs((cur) => cur.map((p, i) => ({ ...p, points: p.points ?? r.prequestions[i]?.points })));
      },
      (e) => setPointsError(errorText(e)),
    );
  };
  useEffect(loadPoints, []);

  // Once a question is checked and its key points exist, the AI marks what the answer covered.
  const runCheck = (i: number) => {
    setCheckError(null);
    setChecking((s) => new Set(s).add(i));
    ore<Prequestion>("check", doc.id, String(i + 1)).then(
      (p) => setQs((cur) => cur.map((x, j) => (j === i ? { ...x, check: p.check } : x))),
      (e) => setCheckError(errorText(e)),
    ).finally(() => setChecking((s) => (s.delete(i), new Set(s))));
  };
  useEffect(() => {
    if (qi < 0 || !isChecked || !q?.points?.length || q.check || checking.has(qi)) return;
    runCheck(qi);
  }, [qi, isChecked, q?.points, q?.check]);

  /** After a failed AI step: ask again for what's missing (the key points, or the check). */
  const retry = () => {
    if (!q?.points) return loadPoints();
    runCheck(qi);
  };

  // Passages for the checked question: missed points first once the marks are in (D54, D55).
  const order = useMemo(() => {
    if (!q?.points) return [];
    const idx = q.points.map((_, i) => i);
    const cov = q.check?.covered;
    return cov ? [...idx.filter((i) => !cov[i]), ...idx.filter((i) => cov[i])] : idx;
  }, [q?.points, q?.check?.covered]);
  const passages = useMemo(() => {
    const out: { e: Evidence; point: number }[] = [];
    for (const i of order) for (const e of q!.points![i]!.evidence) if (!out.some((o) => o.e.start === e.start)) out.push({ e, point: i });
    return out;
  }, [order]);
  useEffect(() => {
    if (!moved.current) setAt(0);
  }, [passages]);
  useEffect(() => {
    setReveal(isChecked || step > n ? { quotes: passages.map((p) => p.e), at: Math.min(at, Math.max(0, passages.length - 1)) } : null);
  }, [isChecked, step, passages, at]);
  useEffect(() => () => setReveal(null), []);

  useEffect(() => {
    moved.current = false;
    setAt(0);
    if (isChecked || step > n) return panel.current?.focus();
    // A field holding what he wrote last time (finishing again) takes the caret at its end, as Notes does.
    const f = field.current;
    f?.focus();
    f?.setSelectionRange(f.value.length, f.value.length);
  }, [step, isChecked]);

  /** `back`: settles once he is back from the panel; a failure says so only then, in front of "Finished …". */
  function enrich(back: Promise<unknown>) {
    // Drafts review items from Card highlights and the prequestions (D19), after the recall
    // feedback so the prompts' rubrics include what he missed.
    // Run in the app, not detached, so a failure says why at once, wherever he has gone, with a retry.
    // Its Try again is the only way back to the cards, so the failure stays until he acts on it.
    const run = (): Promise<void> =>
      ore("enrich", doc.id).then(
        () => {},
        (e) => void back.then(() => notify(`Cards for “${doc.title}” weren’t drafted: ${errorText(e)}`, "error", undefined, undefined, () => void run(), true)),
      );
    if (feedbackRun.current) void feedbackRun.current.finally(run);
    else void run();
  }

  /** Saving the recall failed: offer a way out that doesn't need it. */
  const [recallFailed, setRecallFailed] = useState(false);

  /** Marked done by "Just mark done"; otherwise the closing card asks, Done or Keep reading (2026-10-31). */
  const [marked, setMarked] = useState(false);
  const [moment, setMoment] = useState(false);
  async function markDone() {
    await ore("status", doc.id, "done");
    setMarked(true);
  }

  /** D100: before the questions, leave out the ones past where he stopped or that his note rules out
   *  (that needs the key points, being found meanwhile). Returns how many questions are left. */
  async function applyScope(): Promise<number | null> {
    if (!qs.length || (!partway && !leave.trim() && !doc.leave_out && !qs.some((p) => p.skipped))) return n;
    await pointsRun.current?.catch(() => {});
    let r: { prequestions: Prequestion[] };
    try {
      r = await ore<{ prequestions: Prequestion[] }>("scope", doc.id, ...(partway ? [opt("reached", String(reached))] : []), ...(leave.trim() ? [opt("leave-out", leave.trim())] : []));
    } catch (e) {
      // His recall and note stay; Continue tries again.
      notify(`Couldn’t leave that out: ${errorText(e)} Try again, or clear “Leave anything out?”.`, "error");
      return null;
    }
    setQs((cur) => cur.map((p, i) => ({ ...p, points: p.points ?? r.prequestions[i]?.points, skipped: r.prequestions[i]?.skipped })));
    return r.prequestions.filter((p) => !p.skipped).length;
  }

  async function submitRecall() {
    setBusy(true);
    try {
      // The recall lands in the note and comes back as its text: not over a draft that failed to save.
      if (!(await flushNotes())) return;
      const left = await applyScope();
      if (left === null) return;
      if (recall.trim()) {
        onNotes((await ore<{ notes: string }>("recall", doc.id, opt("text", recall.trim()))).notes);
        feedbackRun.current = ore<Feedback>("recall", doc.id, "--feedback").then(setFeedback, (e) => setFeedback(errorText(e)));
      }
      setStep(1);
    } catch (e) {
      notify(errorText(e, "save your recall"), "error");
      setRecallFailed(true);
    } finally {
      setBusy(false);
    }
  }

  /** One answer write at a time: ⌘⌫ while Check saves would replace his answer with "no idea". */
  const answering = useRef(false);
  async function check(noIdea = false) {
    if (qi < 0 || answering.current) return;
    const text = noIdea ? "no idea" : answers[qi]!.trim();
    if (!text) return field.current?.focus();
    answering.current = true;
    setBusy(true);
    try {
      const args = ["prequestion", doc.id, String(qi + 1), opt("after", text)];
      if (conf[qi] && !noIdea) args.push(opt("confidence", String(conf[qi])));
      const p = await ore<Prequestion>(...args);
      setQs((cur) => cur.map((x, j) => (j === qi ? { ...x, after: p.after, confidence: p.confidence, check: p.check } : x)));
      if (noIdea) setAnswers((v) => v.map((x, j) => (j === qi ? "no idea" : x)));
      setChecked((v) => v.map((x, j) => (j === qi ? true : x)));
    } catch (e) {
      notify(errorText(e), "error");
    } finally {
      answering.current = false;
      setBusy(false);
    }
  }

  function next() {
    setCheckError(null);
    setStep(step + 1);
  }

  async function finish(then?: () => void) {
    setBusy(true);
    try {
      if (!marked) await markDone();
      if (use.trim()) onNotes((await ore<Notes>("notes", doc.id, opt("append", use.trim()), opt("heading", "Use and connections"))).text);
    } catch (e) {
      notify(errorText(e), "error");
      setBusy(false);
      return;
    }
    drafts.delete(doc.id);
    // Drafting starts at once, so a window closed during the moment still drafts the cards.
    let gone = () => {};
    enrich(new Promise<void>((ok) => (gone = ok)));
    // Done on "Done with this source?": a second of "Source finished" before going back (D106).
    if (!marked) {
      setMoment(true);
      await new Promise((go) => setTimeout(go, 1100));
    }
    (then ?? onDone)();
    gone();
  }

  /** Quizzed without finishing: the source stays in To read and nothing is drafted yet; the next
   *  Finish starts a fresh quiz over what he has read by then (D100). */
  async function keepReading() {
    setBusy(true);
    try {
      if (use.trim()) onNotes((await ore<Notes>("notes", doc.id, opt("append", use.trim()), opt("heading", "Use and connections"))).text);
    } catch (e) {
      notify(errorText(e), "error");
      setBusy(false);
      return;
    }
    drafts.delete(doc.id);
    onCancel();
  }

  /** "Just mark done": straight to the closing card; its Done drafts the cards. */
  async function skipQuiz() {
    setBusy(true);
    try {
      const left = await applyScope();
      if (left === null) return;
      await markDone();
      setStep(left + 1);
    } catch (e) {
      notify(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  }

  // The closing card counts what he made from this source, read fresh (highlights made while
  // reading live in the reader, not in `doc`). Cards are drafted after Done, so they aren't counted.
  const [made, setMade] = useState<{ highlights: number; questions: number } | null>(null);
  useEffect(() => {
    if (step <= n) return;
    ore<{ annotations: Annotation[] }>("show", doc.id).then(
      (d) => {
        const live = d.annotations.filter((a) => a.status !== "deleted");
        setMade({ highlights: live.length, questions: live.filter((a) => a.intent === "question").length });
      },
      () => {},
    );
  }, [step > n]);

  /** Leaving the closing card any way (Done, Esc, ×) finishes, so the cards always get drafted.
   *  Not while Done is saving or its moment shows: that would append his note and draft twice. */
  const close = () => (step <= n ? onCancel() : busy ? undefined : marked ? void finish() : void keepReading());

  /** One correction at a time (the marks wait while one saves); a failed one puts the saved marks back. */
  const flipping = useRef(false);
  const [marking, setMarking] = useState(false);
  async function flip(i: number) {
    if (qi < 0 || !q?.check || flipping.current) return;
    const was = q.check;
    const covered = was.covered.map((c, j) => (j === i ? !c : c));
    const k = qi;
    flipping.current = true;
    setMarking(true);
    setQs((cur) => cur.map((x, j) => (j === k ? { ...x, check: { ...x.check!, covered, edited: true } } : x)));
    try {
      await ore("check", doc.id, String(k + 1), opt("covered", covered.map((c) => (c ? "1" : "0")).join(",")));
    } catch (e) {
      setQs((cur) => cur.map((x, j) => (j === k ? { ...x, check: was } : x)));
      notify(errorText(e), "error");
    } finally {
      flipping.current = false;
      setMarking(false);
    }
  }

  const go = (to: number) => {
    if (!passages.length) return;
    moved.current = true;
    setAt((to + passages.length) % passages.length);
  };

  /** Picks how sure he is; picking the same one again clears it. */
  const pickSure = (n: number) => {
    // While Check saves, how sure he was is what it saves.
    if (busy) return;
    setConf((v) => v.map((x, j) => (j === qi ? (x === n ? undefined : n) : x)));
  };

  const primary = () => {
    if (busy) return;
    if (step === 0) void submitRecall();
    else if (qi >= 0 && !isChecked) void check();
    else if (qi >= 0) next();
    else void finish();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (blocked) return;
      const t = e.target as HTMLElement;
      const typing = t.tagName === "INPUT" || t.tagName === "TEXTAREA";
      if (is(e, "finish")) {
        e.preventDefault();
        primary();
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (q && !isChecked && is(e, "no-idea")) {
        // The same keys as Review (D59): ⌘⌫ No idea, 1 to 3 how sure.
        e.preventDefault();
        void check(true);
      } else if (q && !isChecked && !typing && !e.metaKey && !e.ctrlKey && !e.altKey && /^Digit[1-3]$/.test(e.code)) {
        e.preventDefault();
        pickSure(Number(e.code.slice(5)));
      } else if ((isChecked || step > n) && !typing && (is(e, "passage-next") || is(e, "passage-prev"))) {
        e.preventDefault();
        go(at + (is(e, "passage-next") ? 1 : -1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const segments = [0, ...shown.map((_, k) => k + 1)].map((s) => (s < step || (s === step && isChecked) ? "done" : s === step ? "now" : ""));
  const cov = q?.check?.covered;
  const got = cov?.filter(Boolean).length ?? 0;
  const verdict = !cov ? null : got === cov.length ? "yes" : got > 0 ? "part" : "no";
  // The AI step failed (its error shows below): stop saying it is still working.
  const why = q?.points ? checkError : pointsError;
  const failed = !verdict && !!why;
  // Still waiting on the AI: the badge spins, and past 5 s it says how long this takes.
  const waiting = isChecked && !verdict && !failed;
  const late = useLate(waiting);

  return (
    <QuizPanel segments={step <= n ? segments : segments.map(() => "done")} onClose={close} panelRef={panel}>
      {step === 0 && (
        <>
          <div className="quiz-kicker">Recall</div>
          <h2 className="quiz-q">What do you remember from “{doc.title}”?</h2>
          <p className="quiz-sub">{upTo ? `Everything up to ${upTo}, in your own words.` : "Everything, in your own words."}</p>
          <Grow ref={field} className="field quiz-answer tall" aria-label="Free recall" value={recall} onChange={(e) => setRecall(e.target.value)} placeholder="In your own words…" />
          {qs.length > 0 && (
            <input
              className="field quiz-leave"
              aria-label="Leave anything out?"
              placeholder="Leave anything out? Like “the coding part”"
              value={leave}
              onChange={(e) => setLeave(e.target.value)}
            />
          )}
          <div className="quiz-grow" />
          <div className="quiz-foot">
            {(!recall.trim() || recallFailed) && (
              <button className="quiz-ghost" onClick={() => void skipQuiz()} disabled={busy}>
                {recall.trim() ? "Mark done without saving" : "Just mark done"}
              </button>
            )}
            <Hint text={recall.trim() ? "Save to your source note and continue" : "Skip the recall"} keys="finish" side="top">
              <button className="pill-btn quiz-go" onClick={primary} disabled={busy}>
                {busy ? <Working label={leave.trim() ? "Leaving that out…" : "Saving…"} /> : recall.trim() ? "Continue" : n ? "Skip to questions" : "Skip"}
              </button>
            </Hint>
          </div>
        </>
      )}

      {q && !isChecked && (
        <>
          <div className="quiz-kicker">
            Question {step} of {n}
          </div>
          <h2 className="quiz-q">{q.q}</h2>
          {q.before && (
            <p className="quiz-sub">
              Before reading you wrote: <span className="quiz-before">{q.before}</span>
            </p>
          )}
          <Grow
            ref={field}
            className="field quiz-answer"
            aria-label="Your answer"
            // While Check saves, what's saved is what he typed: no edits that would be dropped.
            readOnly={busy}
            value={answers[qi]}
            onChange={(e) => setAnswers((v) => v.map((x, j) => (j === qi ? e.target.value : x)))}
            placeholder="From memory…"
          />
          <div className="quiz-label" id="quiz-sure">
            How sure are you?
          </div>
          {/* One Tab stop, ← → between the three, as Review's; picking the one picked clears it. */}
          <ToggleGroup.Root type="single" className="quiz-sure" aria-labelledby="quiz-sure" value={conf[qi] ? String(conf[qi]) : ""} onValueChange={(v) => pickSure(v ? Number(v) : conf[qi]!)}>
            {SURE.map((label, i) => (
              <Hint key={label} text={<>{label} <kbd>{i + 1}</kbd></>} side="top">
                <ToggleGroup.Item value={String(i + 1)} aria-disabled={busy || undefined}>
                  {label}
                </ToggleGroup.Item>
              </Hint>
            ))}
          </ToggleGroup.Root>
          <div className="quiz-grow" />
          <div className="quiz-foot">
            <Hint text="No idea" keys="no-idea" side="top">
              <button className="quiz-ghost" onClick={() => void check(true)} disabled={busy}>
                No idea
              </button>
            </Hint>
            <Hint text="Check your answer" keys="finish" side="top">
              <button className="pill-btn quiz-go" onClick={primary} disabled={busy || !answers[qi]!.trim()}>
                {busy ? "Saving…" : "Check"}
              </button>
            </Hint>
          </div>
        </>
      )}

      {q && isChecked && (
        <>
          <div className={`quiz-verdict ${verdict ?? "wait"}`} role="status">
            <span className="quiz-badge" aria-hidden="true">
              {verdict === "yes" ? <Check size={16} weight="bold" /> : verdict === "part" ? <CircleHalf size={16} weight="fill" /> : waiting ? <PixelSpin /> : <MagnifyingGlass size={15} weight="bold" />}
            </span>
            <div>
              <b>{verdict === "yes" ? "You got it" : verdict === "part" ? "Partly there" : verdict === "no" ? "Not yet. Here’s where it is" : failed ? "Couldn’t check this one" : q.points ? "Checking your answer…" : "Finding the key points…"}</b>
              <span>
                {verdict === "yes"
                  ? "Every key point is in your answer."
                  : verdict === "part"
                    ? `${cov!.length - got === 1 ? "One point is" : "A few points are"} worth a second look.`
                    : verdict === "no"
                      ? "Step through the passages below."
                      : failed
                        ? // Why (Codex missing, Claude signed out), so he knows whether a retry can work, as Review says it.
                          `${why}${/[.!?]$/.test(why!) ? "" : "."} The source is open; compare your answer with it, or `
                        : late
                          ? `${q.points ? "This can take about 20 seconds" : "This can take up to a minute"}. The source is open; have a look meanwhile.`
                          : "The source is open; have a look meanwhile."}
                {failed && (
                  <>
                    <button className="link" onClick={retry}>
                      try again
                    </button>
                    .
                  </>
                )}
              </span>
            </div>
          </div>
          {verdict && verdict !== "yes" && conf[qi] === 3 && <p className="quiz-sure-miss">You were sure about this one. Worth a careful look.</p>}
          <div className="quiz-mini">{q.q}</div>
          <p className="quiz-yours">{q.after}</p>
          {q.points && (
            <>
              <div className="quiz-kicker">Key points</div>
              <ul className="quiz-points">
                {order.map((i) => {
                  const p = q.points![i]!;
                  const mark = cov?.[i];
                  const first = passages.findIndex((x) => x.point === i);
                  const current = passages[at]?.point === i;
                  return (
                    <li key={i} className={`${mark === false ? "missed" : mark ? "got" : ""}${current ? " on" : ""}`}>
                      {cov ? (
                        <Hint text={mark ? "Mark as missed" : "Mark as got"}>
                          <button className="quiz-mark" aria-pressed={mark} aria-label={mark ? `Got: ${p.text}. Mark as missed` : `Missed: ${p.text}. Mark as got`} disabled={marking} onClick={() => void flip(i)}>
                            {mark ? <Check size={14} weight="bold" /> : <Circle size={14} weight="bold" />}
                          </button>
                        </Hint>
                      ) : (
                        <span className="quiz-mark wait" aria-hidden="true" />
                      )}
                      <button className="quiz-point" disabled={first < 0} onClick={() => go(first)}>
                        {p.text}
                        {first < 0 && <span className="quiz-none">No passage found</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {passages.length > 0 && <Stepper at={at} total={passages.length} go={go} keyPoint={keyPoint} />}
          <div className="quiz-grow" />
          <div className="quiz-foot">
            <Hint text={step < n ? "Next question · the source hides again" : "Last step"} keys="finish" side="top">
              <button className="pill-btn quiz-go wide" onClick={primary} disabled={busy}>
                {step < n ? "Next question" : "Next"}
              </button>
            </Hint>
          </div>
        </>
      )}

      {step > n && moment && (
        <div className="quiz-done moment" role="status">
          <span className="quiz-done-badge" aria-hidden="true">
            <Check size={24} weight="bold" />
          </span>
          <h2>Source finished</h2>
          <p>New cards start in tomorrow’s review.</p>
        </div>
      )}

      {step > n && !moment && (
        <>
          <div className="quiz-done">
            {marked && (
              <span className="quiz-done-badge" aria-hidden="true">
                <Check size={24} weight="bold" />
              </span>
            )}
            <h2>{marked ? "Source finished" : "Done with this source?"}</h2>
          </div>
          {marked && (
            <div className="quiz-verdict yes quiz-made">
              <div>
                <b>New cards tomorrow</b>
                <span>Drafted from what you marked and answered. They start in tomorrow’s review.</span>
              </div>
            </div>
          )}
          {(recall.trim() || !!(made && (made.highlights || made.questions))) && (
            <ul className="quiz-made-list">
              {recall.trim() && <li>Your recall, saved to the source note</li>}
              {!!made?.highlights && <li>{made.highlights} {made.highlights === 1 ? "highlight" : "highlights"}</li>}
              {!!made?.questions && <li>{made.questions} {made.questions === 1 ? "question" : "questions"}, {doc.skills.length ? "waiting on the skill page" : "in Collected"}</li>}
            </ul>
          )}
          {typeof feedback === "string" && <p className="err">Recall feedback failed: {feedback}</p>}
          {feedbackRun.current && !feedback && (
            <p className="loading">
              <Working label="Reading your recall against the source…" />
            </p>
          )}
          {feedback && typeof feedback !== "string" && (
            <div className="feedback quiz-feedback">
              <div className="quiz-kicker">On your recall</div>
              <p>{feedback.feedback}</p>
              {feedback.section_lines && <p className="sections">{feedback.section_lines}</p>}
              <Missed items={feedback.missed} />
            </div>
          )}
          <label className="quiz-label" htmlFor="quiz-use">
            Where would you use this, and what does it connect to? <span className="quiz-faint">Optional</span>
          </label>
          <Grow ref={field} id="quiz-use" className="field quiz-answer short" value={use} onChange={(e) => setUse(e.target.value)} />
          <div className="quiz-grow" />
          <div className="quiz-foot">
            {!marked && (
              <Hint text="Keep it in To read · cards are drafted when you finish" side="top">
                <button className="quiz-ghost" onClick={() => void keepReading()} disabled={busy}>
                  Keep reading
                </button>
              </Hint>
            )}
            {nextLesson && (
              <Hint text={`Draft this lesson’s cards and open “${nextLesson.title}”`} side="top">
                <button className="quiz-ghost" onClick={() => void finish(nextLesson.open)} disabled={busy}>
                  Next lesson
                </button>
              </Hint>
            )}
            <Hint text={marked ? "Draft its cards and go back" : "Mark it done · its cards start tomorrow"} keys="finish" side="top">
              <button className="pill-btn quiz-go wide" onClick={primary} disabled={busy}>
                Done
              </button>
            </Hint>
          </div>
        </>
      )}
    </QuizPanel>
  );
}

/** "In the source · 2 of 3" with previous and next, like find on a page (D55). */
function Stepper({ at, total, go, keyPoint }: { at: number; total: number; go: (to: number) => void; keyPoint?: Props["keyPoint"] }) {
  return (
    <div className="quiz-stepper">
      <MagnifyingGlass size={14} aria-hidden="true" />
      <span className="quiz-stepper-label">In the source</span>
      <span className="quiz-count">
        {at + 1} of {total}
      </span>
      {keyPoint && (
        <Hint text={keyPoint.on ? "Key point · click to unmark" : "Add as a key point"} side="top">
          <button className={`quiz-key${keyPoint.on ? " on" : ""}`} aria-pressed={keyPoint.on} aria-label="Key point" onClick={keyPoint.toggle}>
            <PixelStar size={12} weight={keyPoint.on ? undefined : "regular"} />
          </button>
        </Hint>
      )}
      <Hint text="Previous passage" keys="passage-prev" side="top">
        <button aria-label="Previous passage" onClick={() => go(at - 1)}>
          <CaretUp size={14} weight="bold" />
        </button>
      </Hint>
      <Hint text="Next passage" keys="passage-next" side="top">
        <button aria-label="Next passage" onClick={() => go(at + 1)}>
          <CaretDown size={14} weight="bold" />
        </button>
      </Hint>
    </div>
  );
}

/** The floating panel at the right of the reader (D52), with the step bar and a close button. */
function QuizPanel({ segments, onClose, panelRef, children }: { segments?: string[]; onClose: () => void; panelRef?: React.RefObject<HTMLElement | null>; children: ReactNode }) {
  return (
    <section className="quiz" aria-label="Quiz" ref={panelRef} tabIndex={-1}>
      <div className="quiz-head">
        {segments ? (
          <div className="quiz-steps" role="img" aria-label={`Step ${segments.filter((s) => s === "done").length + 1} of ${segments.length}`}>
            {segments.map((s, i) => (
              <span key={i} className={s} />
            ))}
          </div>
        ) : (
          <div className="quiz-grow" />
        )}
        <Hint text="Close; your answers are kept">
          <button className="quiz-close" aria-label="Close quiz" onClick={onClose}>
            <X size={14} weight="bold" />
          </button>
        </Hint>
      </div>
      {children}
    </section>
  );
}

function Missed({ items }: { items?: string[] }) {
  if (!items?.length) return null;
  return (
    <>
      <div className="quiz-kicker">Worth another look</div>
      <ul>
        {items.map((m, i) => (
          <li key={i}>{m}</li>
        ))}
      </ul>
    </>
  );
}

/** Where a text he stopped partway through got to: the last heading before that point (not the title). */
function headingBefore(body: string, at: number, title: string): string | undefined {
  const all = [...body.slice(0, at).matchAll(/^#{1,4}[ \t]+(.+)$/gm)].map((m) => m[1]!.trim()).filter((h) => h !== title.trim());
  const h = all[all.length - 1];
  return h ? `“${h}”` : undefined;
}
