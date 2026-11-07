import { ArrowUp, Plus, Sparkle, X } from "./icons";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Grow } from "./Grow";
import { Hint } from "./Hint";
import { useSideWidth } from "./Notes";
import { ore, opt } from "./ore";
import { errorText } from "./util";
import { Working } from "./Working";

export type Citation = { n: number; item: string; title: string; heading: string; quote: string; text: string; start: number; end: number };
/** One exchange. `item`/`title` is the source it was asked about (the context chip at the time). */
export type TutorTurn = { message: string; item?: string; title?: string; reply?: string; citations?: Citation[]; general?: boolean; error?: string };
type Reply = { reply: string; citations: Citation[]; general: boolean };

/** Starters for an empty chat, so he sees what it does (NotebookLM's suggested questions). */
const STARTERS_READING = ["Explain this simply", "Give me an example", "Quiz me on this"];
const STARTERS = ["What have I been learning?", "Quiz me"];

/** The tutor (D128): a chat docked at the window's right, like Notion AI's and Linear's Ask panels,
 *  opened from the bubble at the bottom right or ⌘J. It sees the source he is reading (the chip over
 *  the field, removable), answers from his sources with numbered citations that open the passage
 *  (the panel stays), says when an answer is from general knowledge, and gives hints, not answers, on
 *  practice. The thread lives in App, so it survives navigation; + starts a new one. */
export function Tutor({ turns, setTurns, reading, onOpen, onClose }: {
  turns: TutorTurn[];
  setTurns: (f: (t: TutorTurn[]) => TutorTurn[]) => void;
  /** The source on screen, if any. */
  reading: { id: string; title: string } | null;
  onOpen: (item: string, at: string) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState("");
  // He can take the open source out of the context (the chip's ×); a new source puts it back.
  const [dropped, setDropped] = useState<string | null>(null);
  const context = reading && dropped !== reading.id ? reading : null;
  const field = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const busy = turns.some((t) => t.reply === undefined && !t.error);
  const started = useRef(false);
  const { width, dragging, divider } = useSideWidth("ore.tutorwidth", 380, 300);

  const run = async (i: number, all: TutorTurn[]) => {
    const t = all[i]!;
    const earlier = all.slice(0, i).flatMap((x) => (x.reply ? [{ message: x.message, reply: x.reply }] : []));
    try {
      const r = await ore<Reply>("tutor", t.message, ...(t.item ? [opt("item", t.item)] : []), ...(earlier.length ? [opt("earlier", JSON.stringify(earlier))] : []));
      setTurns((ts) => ts.map((x, j) => (j === i ? { ...x, reply: r.reply, citations: r.citations, general: r.general, error: undefined } : x)));
    } catch (e) {
      setTurns((ts) => ts.map((x, j) => (j === i ? { ...x, error: errorText(e, "answer that") } : x)));
    }
  };

  const send = (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    const next = [...turns, { message, ...(context ? { item: context.id, title: context.title } : {}) }];
    setTurns(() => next);
    setInput("");
    field.current?.focus();
    void run(next.length - 1, next);
  };
  const retry = (i: number) => {
    const next = turns.map((t, j) => (j === i ? { message: t.message, item: t.item, title: t.title } : t));
    setTurns(() => next);
    void run(i, next);
  };

  useEffect(() => {
    field.current?.focus();
    // Opened from ⌘K with a question already asked: answer it.
    const last = turns.length - 1;
    if (!started.current && last >= 0 && turns[last]!.reply === undefined && !turns[last]!.error) void run(last, turns);
    started.current = true;
  }, []);
  // Window-fixed controls at the top right (the reader's side panel toggle) move left of the panel.
  useEffect(() => {
    document.documentElement.style.setProperty("--tutor-w", `${width}px`);
    return () => void document.documentElement.style.removeProperty("--tutor-w");
  }, [width]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [turns]);

  return (
    <aside
      className={`tutor${dragging ? " dragging" : ""}`}
      aria-label="Tutor"
      style={{ width }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !e.defaultPrevented) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <Hint text="Drag to resize · double-click to reset" side="left">
        <div className="divider" role="separator" aria-orientation="vertical" aria-label="Resize the tutor" {...divider} />
      </Hint>
      <div className="tutor-head">
        <Hint text="New chat">
          <button className="icon-btn" aria-label="New chat" disabled={!turns.length || busy} onClick={() => { setTurns(() => []); field.current?.focus(); }}>
            <Plus size={14} aria-hidden="true" />
          </button>
        </Hint>
        <Hint text="Close" keys="tutor">
          <button className="icon-btn" aria-label="Close the tutor" onClick={onClose}>
            <X size={14} aria-hidden="true" />
          </button>
        </Hint>
      </div>
      <div className="tutor-turns" aria-live="polite">
        {turns.length === 0 && (
          <div className="ask-starters tutor-starters">
            {(context ? STARTERS_READING : STARTERS).map((s) => (
              <button key={s} onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className="library-turn">
            <p className="ask-me">{t.message}</p>
            <div className="ask-ai">
              <Sparkle className="ask-mark" size={14} aria-hidden="true" />
              <div className="ask-text">
                {t.error ? (
                  <p className="err">
                    {t.error}{" "}
                    <button className="link" onClick={() => retry(i)}>Try again</button>
                  </p>
                ) : t.reply === undefined ? (
                  <Working label="Thinking…" slow="A reply takes about 10 seconds." />
                ) : (
                  <Answer text={t.reply} citations={t.citations ?? []} onOpen={onOpen} general={t.general} />
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="tutor-foot">
        {context && (
          <span className="tutor-chip">
            <span className="tutor-chip-title">{context.title}</span>
            <Hint text="Leave this source out">
              <button aria-label={`Leave “${context.title}” out`} onClick={() => { setDropped(context.id); field.current?.focus(); }}>
                <X size={10} aria-hidden="true" />
              </button>
            </Hint>
          </span>
        )}
        <div className="ask-input">
          <Grow
            ref={field}
            rows={1}
            className="field"
            aria-label="Message the tutor"
            placeholder={turns.length ? "Reply…" : context ? "Ask about this, or say “quiz me”…" : "Ask anything you're learning…"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <button className="ask-send" aria-label="Send" disabled={!input.trim() || busy} onClick={() => send(input)}>
            <ArrowUp size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}

/** A reply in Markdown: each [n] a small button that opens the cited passage, and the sources under it
 *  (Perplexity's numbered sources). A reply from general knowledge says so. */
function Answer({ text, citations, general, onOpen }: { text: string; citations: Citation[]; general?: boolean; onOpen: (item: string, at: string) => void }) {
  const open = (c: Citation) => onOpen(c.item, `q:${c.start}:${c.end}`);
  return (
    <>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            const c = href?.startsWith("#cite-") ? citations.find((x) => x.n === Number(href.slice(6))) : undefined;
            return c ? (
              <button className="cite" aria-label={`Source ${c.n}: ${c.title}`} onClick={() => open(c)}>{c.n}</button>
            ) : (
              <span>{children}</span>
            );
          },
        }}
      >
        {text.replace(/\[(\d+)\](?!\()/g, "[$1](#cite-$1)")}
      </ReactMarkdown>
      {general && <p className="tutor-general">Not from your sources</p>}
      {!!citations.length && (
        <ol className="library-sources">
          {citations.map((c) => (
            <li key={c.n}>
              <button onClick={() => open(c)}>
                <span className="library-n">{c.n}</span>
                <span className="library-src">
                  <span className="library-title">
                    {c.title}
                    {c.heading && <span className="sub"> › {c.heading}</span>}
                  </span>
                  <span className="library-quote">“{c.text}”</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

/** The bubble at the window's bottom right that opens the tutor. */
export function TutorBubble({ onOpen }: { onOpen: () => void }) {
  return (
    <Hint text="Tutor" keys="tutor" side="left">
      <button className="tutor-bubble" aria-label="Open the tutor" onClick={onOpen}>
        <Sparkle size={18} aria-hidden="true" />
      </button>
    </Hint>
  );
}
