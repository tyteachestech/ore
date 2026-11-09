import { ArrowUp, Sparkle } from "./icons";
import { Fragment, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Grow } from "./Grow";
import { ore, opt, type CardFull } from "./ore";
import { errorText } from "./util";
import { wordDiff } from "./worddiff";

type Proposal = { question: string; answer: string };
/** `was`: the card as it stood when the proposal came, so the change it shows survives Use this card (D161). */
type Turn = { role: "me" | "ai"; text: string; proposal?: Proposal | null; was?: Proposal };
type Reply = { reply: string; proposal: Proposal | null; session: string };

const STARTERS = ["Why is this the answer?", "Give me an example", "Make this card clearer"];

/** One card's chat: what he has typed, the thread, and the AI session. Review keeps it by card id,
 *  so closing Ask (or a reply landing while it is closed) loses nothing. */
export type AskChat = { turns: Turn[]; input: string; busy: boolean; error: string | null; applied: Proposal | null; session?: string; failed?: string };
export const NO_ASK: AskChat = { turns: [], input: "", busy: false, error: null, applied: null };

/** Ask about this (D61): a chat about the card he just answered, like ChatGPT's thread under a
 *  message. It runs on his own plan through `ore ask` (claude -p or codex); a proposed card is
 *  applied only when he clicks Use this card. Never shown before the answer, never rates. */
export function Ask({ card, answer, chat, setChat, onApply, onClose }: { card: CardFull; answer: string; chat: AskChat; setChat: (f: (c: AskChat) => AskChat) => void; onApply: (p: Proposal) => Promise<void>; onClose: () => void }) {
  const { turns, input, busy, error, applied } = chat;
  const field = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    field.current?.focus();
  }, []);
  useEffect(() => {
    // Braces: newer engines return a promise from a smooth scrollIntoView, which an effect must not return.
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [turns, busy]);

  /** `again`: Try again on a message that failed; it is in the thread already, and what he has typed since stays. */
  /** One request at a time: a double click on Try again sends once (busy is a render behind). */
  const sending = useRef(false);
  const send = async (text: string, again = false) => {
    const message = text.trim();
    if (!message || busy || sending.current) return;
    sending.current = true;
    setChat((c) => (again ? { ...c, error: null, busy: true } : { ...c, turns: [...c.turns, { role: "me", text: message }], input: "", error: null, busy: true }));
    try {
      const r = await ore<Reply>(
        "ask",
        card.id,
        opt("message", message),
        ...(chat.session ? [opt("session", chat.session)] : [opt("answer", answer || "(no idea)"), ...(card.variant ? [opt("variant", card.variant)] : [])]),
      );
      setChat((c) => ({ ...c, session: r.session, busy: false, failed: undefined, turns: [...c.turns, { role: "ai", text: r.reply, proposal: r.proposal, was: { question: card.question, answer: card.answer } }] }));
    } catch (e) {
      setChat((c) => ({ ...c, busy: false, error: errorText(e, "answer that"), failed: message }));
    } finally {
      sending.current = false;
      field.current?.focus();
    }
  };

  return (
    <section className="ask" aria-label="Ask about this">
      {turns.length === 0 && (
        <div className="ask-starters">
          {STARTERS.map((s) => (
            <button key={s} onClick={() => void send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      <div className="ask-turns" aria-live="polite">
        {turns.map((t, i) =>
          t.role === "me" ? (
            <p key={i} className="ask-me">
              {t.text}
            </p>
          ) : (
            <div key={i} className="ask-ai">
              <Sparkle className="ask-mark" size={14} weight="fill" aria-hidden="true" />
              <div className="ask-text">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{t.text}</ReactMarkdown>
                {t.proposal && (
                  <div className="ask-card">
                    <div className="quiz-kicker">Suggested card</div>
                    <p className="ask-card-q"><Changes was={t.was?.question} now={t.proposal.question} /></p>
                    <p className="ask-card-a"><Changes was={t.was?.answer} now={t.proposal.answer} /></p>
                    <button className="ask-use" disabled={applied === t.proposal} onClick={() => void onApply(t.proposal!).then(() => setChat((c) => ({ ...c, applied: t.proposal! })), () => {})}>
                      {applied === t.proposal ? "Card updated" : "Use this card"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ),
        )}
        {busy && (
          <div className="ask-ai">
            <Sparkle className="ask-mark" size={14} weight="fill" aria-hidden="true" />
            <span className="ask-dots" aria-label="Thinking">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}
        {error && (
          <p className="err">
            {error}
            {chat.failed && (
              <>
                {" "}
                <button className="link" onClick={() => void send(chat.failed!, true)}>
                  Try again
                </button>
              </>
            )}
          </p>
        )}
        <div ref={end} />
      </div>
      <div className="ask-input">
        <Grow
          ref={field}
          rows={1}
          className="field"
          aria-label="Ask about this card"
          placeholder={turns.length ? "Ask a follow-up…" : "Ask about this card…"}
          value={input}
          onChange={(e) => { const v = e.target.value; setChat((c) => ({ ...c, input: v })); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send(input);
            } else if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
        />
        <button className="ask-send" aria-label="Send" disabled={!input.trim() || busy} onClick={() => void send(input)}>
          <ArrowUp size={14} weight="bold" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

/** A proposed card's text as a change to the card he has (D161, after drift-ui's diff viewer): words
 *  it drops struck through, words it adds underlined, the rest as it was. A rewrite should ask the same
 *  thing more clearly; seeing only what changed shows at a glance when it asks something else, which
 *  his review history wouldn't fit. */
function Changes({ was, now }: { was?: string; now: string }) {
  if (was === undefined) return <>{now}</>;
  return (
    <>
      {wordDiff(was, now).map((p, i) => {
        if (p.kind === "same") return p.text;
        // Spaces at a change's edges stay outside its mark, so a strike or underline never runs past a word.
        const [, lead, words, trail] = p.text.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
        const Mark = p.kind === "del" ? "del" : "ins";
        return (
          <Fragment key={i}>
            {lead}
            <Mark className={p.kind === "del" ? "diff-del" : "diff-add"}>
              <span className="sr-only">{p.kind === "del" ? "removed: " : "added: "}</span>
              {words}
            </Mark>
            {trail}
          </Fragment>
        );
      })}
    </>
  );
}
