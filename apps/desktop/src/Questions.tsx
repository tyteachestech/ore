import { Plus, X } from "./icons";
import { useCallback, useEffect, useRef, useState, type Dispatch, type KeyboardEvent as ReactKeyboardEvent, type SetStateAction } from "react";
import { Grow } from "./Grow";
import { MoreButton, WithMenu, type MenuAction } from "./Menu";
import { Hint } from "./Hint";
import { is, label, useKeymap } from "./keys";
import { ore, opt, PHONE, type Annotation, type Question } from "./ore";
import { errorText, useFocusWhileMounted, type Notify } from "./util";

// D75: answering a question where the answer turns up. One answer model on the skill page and in the
// reader: pieces of his answer ("contributions"), each naming the source it was written from, so
// writing from a source is what links it to the question. Answered closes it; Answered + card also
// has the next enrich draft a card from his answer (offer, never require).

/** His question in one line: a typed question is its own text; a highlight's question is his note. */
const questionText = (q: Question) => q.note?.trim() || q.exact.replace(/\s+/g, " ").trim();

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
  /** Rewrites one piece of his answer (Notion: click the text, type); empty removes it. On the history. */
  const rewrite = async (ts: string, to: string, from: string, record = true): Promise<void> => {
    const gone = !to;
    const before = answers;
    setAnswers((l) => (gone ? l.filter((c) => c.ts !== ts) : l.map((c) => (c.ts === ts ? { ...c, text: to } : c))));
    try {
      const r = await ore<Saved["question"]>("answer", q.id, ...(gone ? [opt("remove", ts)] : [opt("edit", ts), opt("text", to)]));
      setAnswers((l) => r.answers?.map((c) => ({ ...c, item_title: l.find((x) => x.ts === c.ts)?.item_title })) ?? []);
    } catch (e) {
      setAnswers(before);
      if (!record) throw e;
      return void notify(errorText(e), "error");
    }
    if (!record) return;
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
  };

  const send = async (how: "contribution" | "done" | "card") => {
    if (busy || (how === "contribution" && !t) || (how === "card" && !t && !hasAnswer)) return;
    setBusy(true);
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
    if (is(e.nativeEvent, "finish")) {
      e.preventDefault();
      void send("card");
    } else if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      void send("contribution");
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="qa-box">
      {hasAnswer && (
        <ul className="qa-answers">
          {answers.map((c) => (
            <Piece key={c.ts} text={c.text} from={c.item_title} onSave={(to) => void rewrite(c.ts, to, c.text)} />
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
        <Hint text="Answered, and draft a card from your answer for review">
          <button className="primary" onClick={() => void send("card")} disabled={busy || (!t && !hasAnswer)}>
            Answered + card <kbd>{label(keys.finish)}</kbd>
          </button>
        </Hint>
      </div>
    </div>
  );
}

/** One piece of his answer: one click edits it in place, Enter saves, Esc puts it back, and saving it
 *  empty removes it (with Undo), as a Notion block does. */
function Piece({ text, from, onSave }: { text: string; from?: string; onSave: (to: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  if (draft === null)
    return (
      <li>
        <button className="qa-piece" aria-label={`Edit: ${text}`} onClick={() => setDraft(text)}>
          {text}
        </button>
        {from && <span className="qa-from"> · {from}</span>}
      </li>
    );
  const done = () => {
    const to = draft.trim();
    setDraft(null);
    if (to !== text) onSave(to);
  };
  return (
    <li>
      <Grow
        autoFocus
        className="field qa-piece-edit"
        aria-label="Edit this part of your answer"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          e.stopPropagation();
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
  const undo = async () => {
    try {
      if (how !== "contribution") await ore("annotate", q.id, "--status", q.status);
      if (added) await ore("answer", q.id, opt("remove", added));
      onUndone();
    } catch (e) {
      notify(errorText(e), "error");
    }
  };
  const redo = async () => {
    try {
      const r = await ore<Saved["question"]>(...s.again!);
      if (added) added = r.answers?.at(-1)?.ts;
      onUndone();
    } catch (e) {
      notify(errorText(e), "error");
    }
  };
  notify(how === "contribution" ? "Added to your answer" : how === "card" ? "Answered. A card is on its way" : "Answered", "info", () => void undo(), s.again ? () => void redo() : undefined);
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
        ? notify(status === "done" ? "Marked answered" : "Reopened", "quiet", () => void setStatus({ ...q, status }, was, false), () => void setStatus(q, status, false))
        : null;
      try {
        await ore("annotate", q.id, "--status", status);
      } catch (e) {
        forget?.();
        setQs((l) => l && l.map((x) => (x.id === q.id ? q : x)));
        notify(errorText(e), "error");
      }
    },
    [notify, setQs],
  );
  const remove = useCallback(
    async (q: Question) => {
      let at = -1;
      const back = () => setQs((l) => l && [...l.slice(0, at < 0 ? l.length : at), q, ...l.slice(at < 0 ? l.length : at)]);
      setQs((l) => {
        at = l ? l.findIndex((x) => x.id === q.id) : -1;
        return l && l.filter((x) => x.id !== q.id);
      });
      // On the history at once, so a ⌘Z pressed before the write lands still takes it back, after it.
      const write = ore("annotate", q.id, "--status", "deleted");
      const forget = notify(
        "Question deleted",
        "info",
        () => {
          back();
          write.catch(() => {}).then(() => ore("annotate", q.id, "--status", q.status)).catch((e) => notify(errorText(e), "error"));
        },
        () => {
          setQs((l) => l && l.filter((x) => x.id !== q.id));
          ore("annotate", q.id, "--status", "deleted").catch((e) => notify(errorText(e), "error"));
        },
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
export function AskQuestion({ skills, onDone, notify }: { skills: string[]; onDone: (added: boolean) => void; notify: Notify }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const add = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const r = await ore<{ annotation: { id: string } }>("snippet", opt("text", text.trim()), "--intent=question", ...skills.map((s) => opt("skill", s)));
      onDone(true);
      // Asking goes on the history: ⌘Z takes the question back, ⇧⌘Z asks it again.
      const set = (status: string) => void ore("annotate", r.annotation.id, "--status", status).then(() => onDone(true), (e) => notify(errorText(e), "error"));
      notify("Question added", "quiet", () => set("deleted"), () => set("open"));
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <div className="ask">
      <input
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
        onBlur={() => !busy && onDone(false)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            void add();
          } else if (e.key === "Escape") {
            e.preventDefault();
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
export function QuestionsPanel({ item, skills, quote, onClearQuote, onJumpQuote, onJumpHighlight, notify, ask }: {
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
}) {
  const grouped = ask !== undefined;
  const [qs, setQs] = useState<Question[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const [asking, setAsking] = useState(false);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const listRef = useRef<HTMLDivElement>(null);
  const { setStatus, remove } = useQuestionEdits(setQs, notify);
  useEffect(() => void (ask && setAsking(true)), [ask]);

  useEffect(() => {
    let live = true;
    ore<Question[]>("questions", opt("item", item)).then(
      // Answered ones stay out, except those answered just now (kept in place, struck through).
      (r) => live && setQs((cur) => r.filter((q) => q.status !== "done" || cur?.some((c) => c.id === q.id))),
      (e) => live && notify(errorText(e), "error"),
    );
    return () => {
      live = false;
    };
  }, [item, version, notify]);

  const dismiss = async (q: Question) => {
    setQs((l) => l && l.map((x) => (x.id === q.id ? { ...x, here: "skill", matches: x.matches.filter((m) => m.item !== item) } : x)));
    try {
      await ore("match", item, q.id, "--drop");
      const set = (drop: boolean) => void ore("match", item, q.id, ...(drop ? ["--drop"] : [])).then(reload, (e) => notify(errorText(e), "error"));
      notify("Not answered here", "info", () => set(false), () => set(true));
    } catch (e) {
      notify(errorText(e), "error");
      reload();
    }
  };

  const here = (qs ?? []).filter((q) => q.here === "match");
  const rest = (qs ?? []).filter((q) => q.here !== "match");
  const shown = all ? rest : rest.slice(0, CAP);
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
    const fromHere = q.answers.filter((c) => c.item === item).length;
    // The same actions as the links under it, in the ⋯ and right-click menus; delete last (as on the skill page).
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
          {q.answers.length > 0 && <span>{fromHere ? `${q.answers.length} in your answer, ${fromHere} from here` : `${q.answers.length} in your answer`}</span>}
          {match && !done && (
            <button className="qp-link quiet" onClick={() => void dismiss(q)}>
              Not answered here
            </button>
          )}
        </div>
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
          <button className="qp-x" aria-label="Don't use the selection" onClick={onClearQuote}>
            <X size={12} aria-hidden="true" />
          </button>
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
            notify={notify}
            onDone={(added) => {
              setAsking(false);
              if (added) reload();
            }}
          />
        )}
        {qs && !order.length && !asking && (
          <p className="quiet qp-empty">
            No open questions{skills.length ? ` for ${skills.map((s) => s.name).join(" or ")}` : ""}.{" "}
            <button className="qp-link" onClick={() => setAsking(true)}>
              Ask one
            </button>
          </p>
        )}
        {shown.map(row)}
        {rest.length > CAP && (
          <button className="answered-toggle" aria-expanded={all} onClick={() => setAll(!all)}>
            {all ? "Show fewer" : `Show all ${rest.length}`}
          </button>
        )}
      </section>
    </div>
  );
}
