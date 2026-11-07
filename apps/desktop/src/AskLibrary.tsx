import { ArrowUp, Sparkle } from "./icons";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Grow } from "./Grow";
import { ore, opt } from "./ore";
import { errorText } from "./util";
import { Working } from "./Working";

export type Citation = { n: number; item: string; title: string; heading: string; quote: string; start: number; end: number };
export type LibraryTurn = { question: string; found?: boolean; answer?: string; citations?: Citation[]; error?: string };
type Reply = { found: boolean; answer: string; citations: Citation[] };

/** Ask your library: a question answered from across his sources (`ore ask-library`, FTS5 passages),
 *  like Notion's Q&A and Perplexity's numbered sources. Each [n] in the answer and each source row
 *  below it opens the source at the quoted passage. When nothing in the library answers it, it says so
 *  and cites nothing. The thread lives in App, so it is still there after he jumps to a source and back. */
export function AskLibrary({ turns, setTurns, onOpen, onClose }: {
  turns: LibraryTurn[];
  setTurns: (f: (t: LibraryTurn[]) => LibraryTurn[]) => void;
  onOpen: (item: string, at: string) => void;
  onClose: () => void;
}) {
  const [input, setInput] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const busy = turns.some((t) => t.answer === undefined && !t.error);
  const started = useRef(false);

  const run = async (i: number, all: LibraryTurn[]) => {
    const earlier = all.slice(0, i).flatMap((t) => (t.answer && t.found ? [{ question: t.question, answer: t.answer }] : []));
    try {
      const r = await ore<Reply>("ask-library", all[i]!.question, ...(earlier.length ? [opt("earlier", JSON.stringify(earlier))] : []));
      setTurns((ts) => ts.map((t, j) => (j === i ? { ...r, question: t.question } : t)));
    } catch (e) {
      setTurns((ts) => ts.map((t, j) => (j === i ? { question: t.question, error: errorText(e, "answer that") } : t)));
    }
    field.current?.focus();
  };

  const send = (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const next = [...turns, { question }];
    setTurns(() => next);
    setInput("");
    void run(next.length - 1, next);
  };
  const retry = (i: number) => {
    const next = turns.map((t, j) => (j === i ? { question: t.question } : t));
    setTurns(() => next);
    void run(i, next);
  };

  useEffect(() => {
    field.current?.focus();
    // Opened from ⌘K with a question already asked: answer it.
    const last = turns.length - 1;
    if (!started.current && last >= 0 && turns[last]!.answer === undefined && !turns[last]!.error) void run(last, turns);
    started.current = true;
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [turns]);

  const at = (c: Citation) => `q:${c.start}:${c.end}`;
  const open = (c: Citation) => {
    onClose();
    onOpen(c.item, at(c));
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Ask your library" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section
        className="panel library-ask"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }
        }}
      >
        {turns.length > 0 && (
          <div className="library-turns" aria-live="polite">
            {turns.map((t, i) => (
              <div key={i} className="library-turn">
                <p className="ask-me">{t.question}</p>
                <div className="ask-ai">
                  <Sparkle className="ask-mark" size={14} weight="fill" aria-hidden="true" />
                  <div className="ask-text">
                    {t.error ? (
                      <p className="err">
                        {t.error}{" "}
                        <button className="link" onClick={() => retry(i)}>
                          Try again
                        </button>
                      </p>
                    ) : t.answer === undefined ? (
                      <Working label="Searching your library…" slow="An answer takes about 10 seconds." />
                    ) : (
                      <>
                        <div className={t.found ? undefined : "library-none"}>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              a: ({ href, children }) => {
                                const c = href?.startsWith("#cite-") ? t.citations?.find((x) => x.n === Number(href.slice(6))) : undefined;
                                return c ? (
                                  <button className="cite" aria-label={`Source ${c.n}: ${c.title}`} onClick={() => open(c)}>
                                    {c.n}
                                  </button>
                                ) : (
                                  <span>{children}</span>
                                );
                              },
                            }}
                          >
                            {(t.answer ?? "").replace(/\[(\d+)\](?!\()/g, "[$1](#cite-$1)")}
                          </ReactMarkdown>
                        </div>
                        {!!t.citations?.length && (
                          <ol className="library-sources">
                            {t.citations.map((c) => (
                              <li key={c.n}>
                                <button onClick={() => open(c)}>
                                  <span className="library-n">{c.n}</span>
                                  <span className="library-src">
                                    <span className="library-title">
                                      {c.title}
                                      {c.heading && <span className="sub"> › {c.heading}</span>}
                                    </span>
                                    <span className="library-quote">“{c.quote}”</span>
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ol>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={end} />
          </div>
        )}
        <div className="ask-input">
          <Grow
            ref={field}
            rows={1}
            className="field"
            aria-label="Ask your library"
            placeholder={turns.length ? "Ask a follow-up…" : "Ask your library…"}
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
            <ArrowUp size={14} weight="bold" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}
