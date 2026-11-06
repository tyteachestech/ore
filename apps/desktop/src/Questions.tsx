import { Plus, X } from "./icons";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Grow } from "./Grow";
import { Hint } from "./Hint";
import { is, label, useKeymap } from "./keys";
import { ore, opt, type Annotation, type Question } from "./ore";
import { errorText, useFocusWhileMounted, type Notify } from "./util";

// D75: answering a question where the answer turns up. One answer model on the skill page and in the
// reader: pieces of his answer ("contributions"), each naming the source it was written from, so
// writing from a source is what links it to the question. Answered closes it; Answered + card also
// has the next enrich draft a card from his answer (offer, never require).

/** His question in one line: a typed question is its own text; a highlight's question is his note. */
export const questionText = (q: Question) => q.note?.trim() || q.exact.replace(/\s+/g, " ").trim();

/** A question he typed (not one highlighted in a source): its hidden source is titled from its first
 *  line, cut to 77 characters and "…" past 80, as `addSnippet` titles it. */
export function typedQuestion(q: Pick<Question, "exact" | "item_title">): boolean {
  const first = q.exact.trim().split("\n")[0]!;
  const title = first.length > 80 ? first.slice(0, 77).trimEnd() + "…" : first;
  return title === q.item_title;
}

type Saved = { question: Annotation & { answers?: Question["answers"] }; added?: string };

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
  const hasAnswer = q.answers.length > 0;

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
      onSaved({ question, added: t ? question.answers?.at(-1)?.ts : undefined }, how);
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
          {q.answers.map((c) => (
            <li key={c.ts}>
              {c.text}
              {c.item_title && <span className="qa-from"> · {c.item_title}</span>}
            </li>
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

/** The toast and its Undo after a save from AnswerBox. */
export function announce(q: Question, s: Saved, how: "contribution" | "done" | "card", notify: Notify, onUndone: () => void) {
  const undo = async () => {
    try {
      if (how !== "contribution") await ore("annotate", q.id, "--status", q.status);
      if (s.added) await ore("answer", q.id, opt("remove", s.added));
      onUndone();
    } catch (e) {
      notify(errorText(e), "error");
    }
  };
  notify(how === "contribution" ? "Added to your answer" : how === "card" ? "Answered. A card is on its way" : "Answered", "info", () => void undo());
}

/** Types a question in place, like a new skill in the sidebar: Enter saves it as a question snippet
 *  filed under these skills (as Raycast's Capture Question does), Esc or clicking away drops it. */
export function AskQuestion({ skills, onDone }: { skills: string[]; onDone: (added: boolean) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const add = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      await ore("snippet", opt("text", text.trim()), "--intent=question", ...skills.map((s) => opt("skill", s)));
      onDone(true);
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
    return (
      <div key={q.id} className={`qp-q${open === q.id ? " open" : ""}${done ? " done" : ""}`}>
        <button className="qp-row" data-q={q.id} aria-expanded={open === q.id} onClick={() => setOpen(open === q.id ? null : q.id)} disabled={done}>
          <span className="qp-icon" aria-hidden="true">?</span>
          <span className="qp-text">{questionText(q)}</span>
        </button>
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
