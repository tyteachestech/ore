import { Plus, X } from "./icons";
import { useCallback, useEffect, useRef, useState, type Dispatch, type KeyboardEvent as ReactKeyboardEvent, type SetStateAction } from "react";
import { Grow } from "./Grow";
import { MoreButton, WithMenu, type MenuAction } from "./Menu";
import { Hint } from "./Hint";
import { is, label, useKeymap } from "./keys";
import { ore, opt, PHONE, type Annotation, type Question } from "./ore";
import { rankScore } from "./match";
import { errorText, focusQuietly, usable, useFocusBack, useFocusWhileMounted, useLibraryChanges, type Notify } from "./util";
import { passageText } from "./text";

// D75: answering a question where the answer turns up. One answer model on the skill page and in the
// reader: pieces of his answer ("contributions"), each naming the source it was written from, so
// writing from a source is what links it to the question. Answered closes it; Answered + card also
// has the next enrich draft a card from his answer (offer, never require).

/** His question in one line: a highlight's question is his note, or its passage as the page shows it;
 *  a question he typed is his own text, kept as typed ("__init__", "*args"). */
export const questionText = (q: Pick<Question, "exact" | "item_title" | "note">) => q.note?.trim() || (typedQuestion(q) ? q.exact.replace(/\s+/g, " ").trim() : passageText(q.exact));

/** A question he typed (not one highlighted in a source): its hidden source is titled from its first
 *  line, cut to 77 characters and "…" past 80, as `addSnippet` titles it. */
export function typedQuestion(q: Pick<Question, "exact" | "item_title">): boolean {
  const first = q.exact.trim().split("\n")[0]!;
  const title = first.length > 80 ? first.slice(0, 77).trimEnd() + "…" : first;
  return title === q.item_title;
}

/** `again` is the call that saved it, run again by ⇧⌘Z after an undo. */
type Saved = { question: Annotation & { answers?: Question["answers"] }; added?: string; again?: string[] };

/** Unsent answers, per question, kept when the box closes (as the finish quiz keeps its draft). */
const drafts = new Map<string, string>();

/** The answer box under a question. ↵ adds what he wrote to the answer and keeps the question open;
 *  Answered closes it; ⌘↵ closes it and asks for a card. Esc closes the box and keeps the draft. */
export function AnswerBox({ q, item, quote, onSaved, onClose, notify }: {
  q: Question;
  /** The source he is reading, credited with what he writes. */
  item?: string;
  /** The passage he had selected, kept with his words. */
  quote?: string | null;
  onSaved: (s: Saved, how: "contribution" | "done" | "card") => void;
  onClose: () => void;
  notify: Notify;
}) {
  const keys = useKeymap();
  const [text, setTextState] = useState(() => drafts.get(q.id) ?? "");
  const setText = (t: string) => {
    setTextState(t);
    drafts.set(q.id, t);
  };
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  useFocusWhileMounted(field);
  const t = text.trim();
  /** His answer as last saved here: a piece he rewrites shows at once, before the list reloads. */
  const [answers, setAnswers] = useState(q.answers);
  useEffect(() => setAnswers(q.answers), [q.answers]);
  const hasAnswer = answers.length > 0;
  /** Rewrites one piece of his answer (Notion: click the text, type); empty removes it. On the history.
   *  False when the save failed (his words are put back in the piece's field). */
  const rewrite = async (ts: string, to: string, from: string, record = true): Promise<boolean> => {
    const gone = !to;
    const before = answers;
    const was = before.find((c) => c.ts === ts)!;
    setAnswers((l) => (gone ? l.filter((c) => c.ts !== ts) : l.map((c) => (c.ts === ts ? { ...c, text: to } : c))));
    try {
      const r = await ore<Saved["question"]>("answer", q.id, ...(gone ? [opt("remove", ts)] : [opt("edit", ts), opt("text", to)]));
      setAnswers((l) => r.answers?.map((c) => ({ ...c, item_title: l.find((x) => x.ts === c.ts)?.item_title })) ?? []);
    } catch (e) {
      // Only this piece goes back: another piece saved meanwhile keeps its new words.
      const at = before.indexOf(was);
      setAnswers((l) => (gone ? (l.some((c) => c.ts === ts) ? l : [...l.slice(0, at), was, ...l.slice(at)]) : l.map((c) => (c.ts === ts ? was : c))));
      if (!record) throw e;
      notify(errorText(e), "error");
      return false;
    }
    if (!record) return true;
    // A removed piece comes back as it was written (its source and passage), at the end of his answer.
    const piece = before.find((c) => c.ts === ts)!;
    let back = ts;
    if (gone)
      notify("Removed from your answer", "info", async () => {
        const r = await ore<Saved["question"]>("answer", q.id, opt("text", from), ...(piece.item ? [opt("item", piece.item)] : []), ...(piece.quote ? [opt("quote", piece.quote)] : []));
        back = r.answers?.at(-1)?.ts ?? back;
        setAnswers((l) => [...l, { ...piece, ts: back }]);
      }, () => rewrite(back, "", from, false));
    else notify("Changed your answer", "quiet", () => rewrite(ts, from, to, false), () => rewrite(ts, to, from, false));
    return true;
  };

  /** Piece edits still open, by piece: saved before the answer is sent or the box closes, so a correction
   *  is never dropped. False when one failed (its field stays open with his words). */
  const editing = useRef(new Map<string, { to: string; from: string; close: () => void }>());
  const commitPieces = async () => {
    for (const [ts, e] of [...editing.current]) {
      const to = e.to.trim();
      if (to !== e.from && !(await rewrite(ts, to, e.from))) return false;
      e.close();
    }
    return true;
  };

  const send = async (how: "contribution" | "done" | "card") => {
    if (busy || (how === "contribution" && !t) || (how === "card" && !t && !hasAnswer)) return;
    setBusy(true);
    if (!(await commitPieces())) return setBusy(false);
    const args = ["answer", q.id];
    if (t) {
      args.push(opt("text", t));
      if (item) args.push(opt("item", item));
      if (quote) args.push(opt("quote", quote));
    }
    if (how === "done") args.push("--done");
    if (how === "card") args.push("--card");
    try {
      const question = await ore<Saved["question"]>(...args);
      drafts.delete(q.id);
      setTextState("");
      setBusy(false);
      onSaved({ question, added: t ? question.answers?.at(-1)?.ts : undefined, again: args }, how);
    } catch (e) {
      notify(errorText(e), "error");
      setBusy(false);
    }
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    // Keys typed here never reach the reader (finish, Esc back to sources) or the page.
    e.stopPropagation();
    // Enter that picks a word from an input method (Japanese, Chinese) is still typing; WKWebView
    // sends that Enter as keyCode 229 with isComposing false.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (is(e.nativeEvent, "finish")) {
      e.preventDefault();
      void send("card");
    } else if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      void send("contribution");
    } else if (e.key === "Escape") {
      e.preventDefault();
      void commitPieces().then((ok) => ok && onClose());
    }
  };

  return (
    <div className="qa-box">
      {hasAnswer && (
        <ul className="qa-answers">
          {answers.map((c) => (
            <Piece
              key={c.ts}
              text={c.text}
              from={c.item_title}
              onSave={(to) => rewrite(c.ts, to, c.text)}
              onEditing={(e) => (e ? editing.current.set(c.ts, e) : editing.current.delete(c.ts))}
            />
          ))}
        </ul>
      )}
      {quote && <blockquote className="qa-quote">{quote}</blockquote>}
      <Grow
        ref={field}
        className="field"
        aria-label={`Your answer to ${questionText(q)}`}
        placeholder={hasAnswer ? "Add to your answer…" : "Your answer, in your own words…"}
        value={text}
        readOnly={busy}
        rows={3}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="qa-actions">
        <button onClick={() => void send("contribution")} disabled={busy || !t}>
          {hasAnswer ? "Add" : "Save"} <kbd>↵</kbd>
        </button>
        <button onClick={() => void send("done")} disabled={busy}>
          Answered
        </button>
        <Hint text="Answered, and draft an exercise from your answer for review">
          <button className="primary" onClick={() => void send("card")} disabled={busy || (!t && !hasAnswer)}>
            Answered + exercise <kbd>{label(keys.finish)}</kbd>
          </button>
        </Hint>
      </div>
    </div>
  );
}

/** One piece of his answer: one click edits it in place, Enter saves, Esc puts it back, and saving it
 *  empty removes it (with Undo), as a Notion block does. A blur keeps the field and what he typed; a
 *  failed save opens it again with his words. */
function Piece({ text, from, onSave, onEditing }: {
  text: string;
  from?: string;
  onSave: (to: string) => Promise<boolean>;
  /** The edit open now (null: none), for the box to save before it sends or closes. */
  onEditing: (e: { to: string; from: string; close: () => void } | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => {
    onEditing(draft === null ? null : { to: draft, from: text, close: () => setDraft(null) });
    return () => onEditing(null);
  }, [draft, text]);
  // Closed by Enter or Esc, focus goes back to the piece; emptied (it goes), to the answer field it belongs to.
  const piece = useRef<HTMLButtonElement>(null);
  const answer = useRef<HTMLElement | null>(null);
  useFocusBack(draft !== null, piece, answer);
  const box = (li: HTMLLIElement | null) => void (li && (answer.current = li.closest(".qa-box")?.querySelector<HTMLElement>(".field:not(.qa-piece-edit)") ?? null));
  if (draft === null)
    return (
      <li ref={box}>
        <button ref={piece} className="qa-piece" aria-label={`Edit: ${text}`} onClick={() => setDraft(text)}>
          {text}
        </button>
        {from && <span className="qa-from"> · {from}</span>}
      </li>
    );
  const done = () => {
    const to = draft.trim();
    const typed = draft;
    // Emptied, the piece goes: focus goes on to the answer field now, not to a piece about to leave.
    if (!to && answer.current) focusQuietly(answer.current);
    setDraft(null);
    if (to !== text) void onSave(to).then((ok) => ok || setDraft(typed));
  };
  return (
    <li ref={box}>
      <Grow
        autoFocus
        className="field qa-piece-edit"
        aria-label="Edit this part of your answer"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            done();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(null);
          }
        }}
      />
    </li>
  );
}

/** The toast and its Undo after a save from AnswerBox. */
export function announce(q: Question, s: Saved, how: "contribution" | "done" | "card", notify: Notify, onUndone: () => void) {
  // The piece he added: a redo adds it again under a new time, which the next undo removes.
  let added = s.added;
  // Run only from the history, which puts the step back and says why if a write fails.
  const undo = async () => {
    if (how !== "contribution") await ore("annotate", q.id, "--status", q.status);
    if (added) await ore("answer", q.id, opt("remove", added));
    onUndone();
  };
  const redo = async () => {
    const r = await ore<Saved["question"]>(...s.again!);
    if (added) added = r.answers?.at(-1)?.ts;
    onUndone();
  };
  notify(how === "contribution" ? "Added to your answer" : how === "card" ? "Answered. An exercise is on its way" : "Answered", "info", undo, s.again ? redo : undefined);
}

/** Mark answered / Reopen and Delete on a list of questions, the same on the skill page and in the
 *  reader. Status goes on the history quietly (Things: completing a to-do is undoable); delete shows
 *  its toast with Undo, and Undo puts it back where it was. */
export function useQuestionEdits(setQs: Dispatch<SetStateAction<Question[] | null>>, notify: Notify) {
  const setStatus = useCallback(
    async (q: Question, status: "open" | "done", undoable = true) => {
      setQs((l) => l && l.map((x) => (x.id === q.id ? { ...x, status } : x)));
      const was = q.status === "done" ? "done" : "open";
      const forget = undoable
        ? notify(status === "done" ? "Marked answered" : "Reopened", "quiet", () => setStatus({ ...q, status }, was, false), () => setStatus(q, status, false))
        : null;
      try {
        await ore("annotate", q.id, "--status", status);
      } catch (e) {
        forget?.();
        setQs((l) => l && l.map((x) => (x.id === q.id ? q : x)));
        // From the history (undo or redo): it puts the step back and says why.
        if (!undoable) throw e;
        notify(errorText(e), "error");
      }
    },
    [notify, setQs],
  );
  const remove = useCallback(
    async (q: Question) => {
      let at = -1;
      const back = () => setQs((l) => l && (l.some((x) => x.id === q.id) ? l : [...l.slice(0, at < 0 ? l.length : at), q, ...l.slice(at < 0 ? l.length : at)]));
      setQs((l) => {
        at = l ? l.findIndex((x) => x.id === q.id) : -1;
        return l && l.filter((x) => x.id !== q.id);
      });
      // On the history at once, so a ⌘Z pressed before the write lands still takes it back, after it.
      const write = ore("annotate", q.id, "--status", "deleted");
      const forget = notify(
        "Question deleted",
        "info",
        // The list follows the write, so one that fails leaves no row that isn't in the library.
        () => write.catch(() => {}).then(() => ore("annotate", q.id, "--status", q.status)).then(back),
        () => ore("annotate", q.id, "--status", "deleted").then(() => setQs((l) => l && l.filter((x) => x.id !== q.id))),
      );
      try {
        await write;
      } catch (e) {
        forget?.();
        back();
        notify(errorText(e), "error");
      }
    },
    [notify, setQs],
  );
  return { setStatus, remove };
}

/** Types a question in place, like a new skill in the sidebar: Enter saves it as a question snippet
 *  filed under these skills (as Raycast's Capture Question does), Esc or clicking away drops it. */
/** `item`: the source he is asking from. A question lives under skills (D75), and is marked as one this source
 *  may answer: Collected lists only this source's questions (D219), so it would vanish as he asked it. */
export function AskQuestion({ skills, item, onDone, notify }: { skills: string[]; item?: string; onDone: (added: boolean) => void; notify: Notify }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Asked (Enter) or dropped (Esc), focus goes back to the + that opened it; opened with nothing focused (a
  // click in WebKit, a key), to the panel's own Ask a question. A click away leaves it where it landed.
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  const field = useRef<HTMLInputElement>(null);
  // Enter or Esc marks it; the give-back runs as the field goes (this unmounts), one tick later, and only if
  // focus is still on nothing then: a press or a focus elsewhere meanwhile wins. Nothing polls.
  const giving = useRef(false);
  const giveBack = () => void (giving.current = true);
  useEffect(() => {
    const f = field.current;
    const panel = f?.closest<HTMLElement>(".collected") ?? f?.closest<HTMLElement>(".skill-page") ?? f?.closest<HTMLElement>("section");
    return () => {
      if (!giving.current) return;
      const plus = panel?.querySelector<HTMLElement>("button[aria-label='Ask a question'], button[aria-label='Add a question']");
      setTimeout(() => {
        if (document.activeElement && document.activeElement !== document.body) return;
        const to = opener && opener !== document.body && usable(opener) ? opener : plus;
        if (usable(to)) focusQuietly(to);
      });
    };
  }, [opener]);
  const add = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const r = await ore<{ annotation: { id: string } }>("snippet", opt("text", text.trim()), "--intent=question", ...skills.map((s) => opt("skill", s)));
      // Two writes: if the second fails, the first is taken back, so a retry never leaves a question nobody can see.
      if (item)
        await ore("match", item, r.annotation.id).catch(async (e) => {
          await ore("annotate", r.annotation.id, "--status", "deleted").catch(() => {});
          throw e;
        });
      giveBack();
      onDone(true);
      // Asking goes on the history: ⌘Z takes the question back, ⇧⌘Z asks it again.
      const set = (status: string) => ore("annotate", r.annotation.id, "--status", status).then(() => onDone(true));
      notify("Question added", "quiet", () => set("deleted"), () => set("open"));
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <div className="ask">
      <input
        ref={field}
        autoFocus
        className="field"
        aria-label="New question"
        placeholder="What do you want to find out?"
        value={text}
        readOnly={busy}
        onChange={(e) => {
          setText(e.target.value);
          setError(null);
        }}
        onBlur={() => !busy && document.hasFocus() && (text.trim() ? void add() : onDone(false))}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          if (e.key === "Enter") {
            e.preventDefault();
            void add();
          } else if (e.key === "Escape") {
            e.preventDefault();
            giveBack();
            onDone(false);
          }
        }}
      />
      {error && <div className="ask-err">{error}</div>}
    </div>
  );
}

/** Open questions shown per group before "Show all". */
const CAP = 6;

/** The reader's Questions tab (D75): the open questions of this source's skills, the ones it may
 *  answer first. Click one (or ↑ ↓ ↵) to write toward its answer; a selection made before Q comes in
 *  as the quote. */
export function QuestionsPanel({ item, skills, quote, onClearQuote, onJumpQuote, onJumpHighlight, notify, ask, marked, filter }: {
  item: string;
  /** The source's skills: their names head the list, and a question typed here is filed under them. */
  skills: { id: string; name: string }[];
  quote: string | null;
  onClearQuote: () => void;
  onJumpQuote: (m: { quote: string; start?: number }) => void;
  onJumpHighlight: (id: string) => void;
  notify: Notify;
  /** Inside the Collected tab's Questions group, whose header holds the + and the arrows: bumped to ask one. */
  ask?: number;
  /** What decides which questions are this source's, as saved (D75): its question highlights and its skills.
   *  The list reads again when it changes. */
  marked?: string;
  /** Collected's filter (D219): only the questions whose words (or his answer's) match. */
  filter?: string;
}) {
  const grouped = ask !== undefined;
  const [qs, setQs] = useState<Question[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [asking, setAsking] = useState(false);
  const [version, setVersion] = useState(0);
  const changes = useLibraryChanges();
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  /** Why the list didn't load; Try again reloads it. */
  const [failed, setFailed] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const { setStatus, remove } = useQuestionEdits(setQs, notify);
  useEffect(() => void (ask && setAsking(true)), [ask]);

  useEffect(() => {
    let live = true;
    setFailed(null);
    ore<Question[]>("questions", opt("item", item)).then(
      // Answered ones stay out, except those answered just now (kept in place, struck through).
      (r) => live && (setFailed(null), setQs((cur) => r.filter((q) => q.status !== "done" || cur?.some((c) => c.id === q.id)))),
      (e) => live && setFailed(`Couldn’t load your questions: ${errorText(e)}`),
    );
    return () => {
      live = false;
    };
  }, [item, version, changes, marked]);

  const dismiss = async (q: Question) => {
    setQs((l) => l && l.map((x) => (x.id === q.id ? { ...x, here: "skill", matches: x.matches.filter((m) => m.item !== item) } : x)));
    try {
      await ore("match", item, q.id, "--drop");
      const set = (drop: boolean) => ore("match", item, q.id, ...(drop ? ["--drop"] : [])).then(reload);
      notify("Not answered here", "info", () => set(false), () => set(true));
    } catch (e) {
      notify(errorText(e), "error");
      reload();
    }
  };

  const find = filter?.trim();
  const listed = (qs ?? []).filter((q) => !find || rankScore([questionText(q), ...q.answers.map((a) => a.text)], find) > 0);
  const here = listed.filter((q) => q.here === "match");
  // In Collected only those asked in this source (D219): the skill's others are on its page, and here, under
  // "Key points" and "Highlights" from this source, they read as this source's.
  const rest = listed.filter((q) => q.here !== "match" && (!grouped || q.here === "from"));
  const shown = all || find ? rest : rest.slice(0, CAP);
  const order = [...here, ...shown];

  // ↑ ↓ move between questions, as in any list here; Enter or a click opens one.
  const onListKey = (e: ReactKeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const rows = [...(listRef.current?.querySelectorAll<HTMLButtonElement>(".qp-row") ?? [])];
    const at = rows.indexOf(document.activeElement as HTMLButtonElement);
    const next = rows[Math.max(0, Math.min(rows.length - 1, at + (e.key === "ArrowDown" ? 1 : -1)))];
    if (next) {
      e.preventDefault();
      e.stopPropagation();
      next.focus();
    }
  };

  const row = (q: Question) => {
    const match = q.matches.find((m) => m.item === item);
    const done = q.status === "done";
    // One line, as Collected's other rows (D134): what it can do is in the ⋯ and right-click menus (links under it on the phone); delete last.
    const actions: MenuAction[] = [
      ...(done ? [] : [{ id: "answer", label: "Answer…", run: () => setOpen(q.id) }]),
      ...(match?.quote ? [{ id: "jump", label: "Jump to the passage", run: () => onJumpQuote({ quote: match.quote!, start: match.start }) }] : []),
      ...(q.here === "from" ? [{ id: "asked", label: "Show where it was asked", run: () => onJumpHighlight(q.id) }] : []),
      ...(match && !done ? [{ id: "dismiss", label: "Not answered here", run: () => void dismiss(q) }] : []),
      { id: "status", label: done ? "Reopen" : "Mark answered", run: () => void setStatus(q, done ? "open" : "done") },
      { id: "delete", label: "Delete question", danger: true, divider: true, run: () => void remove(q) },
    ];
    return (
      <WithMenu key={q.id} actions={PHONE ? [] : actions}>
      <div className={`qp-q${open === q.id ? " open" : ""}${done ? " done" : ""}`}>
        <div className="qp-line">
          <button className="qp-row" data-q={q.id} aria-expanded={open === q.id} onClick={() => setOpen(open === q.id ? null : q.id)} disabled={done}>
            <span className="qp-icon" aria-hidden="true">?</span>
            <span className="qp-text">{questionText(q)}</span>
          </button>
          {!PHONE && <MoreButton label="Question actions" actions={actions} />}
        </div>
        {PHONE && (
          // The phone has no ⋯ or right-click menu here, so its actions stay as links under the question.
          <div className="qp-sub">
            {match?.quote && (
              <button className="qp-link" onClick={() => onJumpQuote({ quote: match.quote!, start: match.start })}>
                Jump to the passage
              </button>
            )}
            {q.here === "from" && (
              <button className="qp-link" onClick={() => onJumpHighlight(q.id)}>
                Asked here
              </button>
            )}
            {match && !done && (
              <button className="qp-link quiet" onClick={() => void dismiss(q)}>
                Not answered here
              </button>
            )}
          </div>
        )}
        {open === q.id && (
          <AnswerBox
            q={q}
            item={item}
            quote={quote}
            notify={notify}
            onClose={() => {
              setOpen(null);
              requestAnimationFrame(() => listRef.current?.querySelector<HTMLButtonElement>(`[data-q="${q.id}"]`)?.focus());
            }}
            onSaved={(s, how) => {
              onClearQuote();
              setQs((l) => l && l.map((x) => (x.id === q.id ? { ...x, status: s.question.status, answers: (s.question.answers ?? []).map((c) => ({ ...c, item_title: c.item === item ? "this source" : x.answers.find((a) => a.ts === c.ts)?.item_title })) } : x)));
              if (how !== "contribution") setOpen(null);
              announce(q, s, how, notify, reload);
            }}
          />
        )}
      </div>
      </WithMenu>
    );
  };

  return (
    <div className="qp" ref={listRef} onKeyDown={grouped ? undefined : onListKey}>
      {quote && !open && (
        <div className="qp-selection">
          <span>
            Your selection goes with your answer: <q>{quote}</q>
          </span>
          <Hint text="Don't use the selection">
            <button className="qp-x" aria-label="Don't use the selection" onClick={onClearQuote}>
              <X size={12} aria-hidden="true" />
            </button>
          </Hint>
        </div>
      )}
      {here.length > 0 && (
        <section>
          <h3 className="qp-group">May be answered here</h3>
          {here.map(row)}
        </section>
      )}
      <section>
        {!grouped && (
          <h3 className="qp-group">
            {skills.map((s) => s.name).join(" · ") || "Your questions"}
            <Hint text="Ask a question">
              <button className="icon-btn" aria-label="Ask a question" onClick={() => setAsking(true)}>
                <Plus size={12} weight="bold" aria-hidden="true" />
              </button>
            </Hint>
          </h3>
        )}
        {asking && (
          <AskQuestion
            skills={skills.map((s) => s.id)}
            item={item}
            notify={notify}
            onDone={(added) => {
              setAsking(false);
              if (added) reload();
            }}
          />
        )}
        {failed && (
          <div className="empty-state err" role="alert">
            <p>{failed}</p>
            <button className="pill-btn" onClick={reload}>
              Try again
            </button>
          </div>
        )}
        {qs && !order.length && !asking && !find && (
          <p className="quiet qp-empty">
            {grouped ? "No open questions from this source." : `No open questions${skills.length ? ` for ${skills.map((s) => s.name).join(" or ")}` : ""}.`}{" "}
            <button className="qp-link" onClick={() => setAsking(true)}>
              Ask one
            </button>
          </p>
        )}
        {shown.map(row)}
        {rest.length > CAP && !find && (
          <button className="answered-toggle" aria-expanded={all} onClick={() => setAll(!all)}>
            {all ? "Show fewer" : `Show all ${rest.length}`}
          </button>
        )}
      </section>
    </div>
  );
}
