import { ArrowUp, Sparkle, Stop } from "./icons";
import { Fragment, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Grow } from "./Grow";
import { Hint } from "./Hint";
import { listen } from "@tauri-apps/api/event";
import { cancelOre, oreJob, opt, type CardFull } from "./ore";
import { is } from "./keys";
import { errorText } from "./util";
import { wordDiff } from "./worddiff";

type Proposal = { question: string; answer: string };
/** `was`: the card as it stood when the proposal came, so the change it shows survives Use this card (D161). */
/** `stopped`: he stopped this reply part way; what was written by then is the reply. */
type Turn = { role: "me" | "ai"; text: string; proposal?: Proposal | null; was?: Proposal; stopped?: boolean };
type Reply = { reply: string; proposal: Proposal | null; session: string };

const STARTERS = ["Why is this the answer?", "Give me an example", "Make this exercise clearer"];

/** One card's chat: what he has typed, the thread, and the AI session. Review keeps it by card id,
 *  so closing Ask (or a reply landing while it is closed) loses nothing. */
/** `partial`: the reply so far while it is written (D296); `job`: the run writing it, which Stop ends. */
export type AskChat = { turns: Turn[]; input: string; busy: boolean; error: string | null; session?: string; failed?: string; partial?: string; job?: string };
export const NO_ASK: AskChat = { turns: [], input: "", busy: false, error: null };

/** Ask about this (D61): a chat about the card he just answered, like ChatGPT's thread under a
 *  message. It runs on his own plan through `ore ask` (claude -p or codex); a proposed card is
 *  applied only when he clicks Use this card. Never shown before the answer, never rates. */
export function Ask({ card, answer, chat, setChat, onApply, onClose }: { card: CardFull; answer: string; chat: AskChat; setChat: (f: (c: AskChat) => AskChat) => void; onApply: (p: Proposal) => Promise<void>; onClose: () => void }) {
  const { turns, input, busy, error } = chat;
  /** Read off the card itself, never remembered: an undo or a later edit makes a suggestion usable again. */
  const same = (a: string, b: string) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();
  const applied = (p: Proposal) => same(p.question, card.question) && same(p.answer, card.answer);
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
  const sending = useRef<string | null>(null);
  /** The session the reply on its way is written in: a run stopped part way never returns it. */
  const live = useRef<string | undefined>(undefined);
  const send = async (text: string, again = false) => {
    const message = text.trim();
    if (!message || busy || sending.current) return;
    // The reply lands on this run alone: Stop ends it, and whatever it still sends or returns is dropped.
    const job = `ask-${crypto.randomUUID()}`;
    sending.current = job;
    live.current = undefined;
    const mine = (c: AskChat) => c.job === job;
    setChat((c) => (again ? { ...c, error: null, busy: true, partial: undefined, job } : { ...c, turns: [...c.turns, { role: "me", text: message }], input: "", error: null, busy: true, partial: undefined, job }));
    // The reply as it is written (ChatGPT's streaming), as the tutor's comes: the first words in place of the dots.
    const off = await listen<{ stream?: string; reply?: string; session?: string }>("ore-progress", ({ payload: p }) => {
      if (p.stream === job && sending.current === job && p.session) live.current = p.session;
      if (p.stream === job && p.reply !== undefined) setChat((c) => (mine(c) ? { ...c, partial: p.reply } : c));
    }).catch(() => () => {});
    try {
      const r = await oreJob<Reply>(job, null, "ask", card.id, opt("message", message), opt("stream", job), ...(chat.session ? [opt("session", chat.session)] : [opt("answer", answer || "(no idea)"), ...(card.variant ? [opt("variant", card.variant)] : [])]));
      setChat((c) => (mine(c) ? { ...c, session: r.session, busy: false, failed: undefined, partial: undefined, job: undefined, turns: [...c.turns, { role: "ai", text: r.reply, proposal: r.proposal, was: { question: card.question, answer: card.answer } }] } : c));
    } catch (e) {
      setChat((c) => (mine(c) ? { ...c, busy: false, partial: undefined, job: undefined, error: errorText(e, "answer that"), failed: message } : c));
    } finally {
      off();
      // Stop already let go of it, and a message sent since then holds it now.
      if (sending.current === job) sending.current = null;
      field.current?.focus();
    }
  };
  /** Stops the reply being written (the tutor's Stop, ChatGPT's): the words so far stay as its reply; with none
   *  it says Stopped and offers Try again. The next message can go at once, in the same conversation. */
  const stop = () => {
    if (!chat.job) return;
    void cancelOre(chat.job);
    sending.current = null;
    const session = live.current;
    const asked = turns.findLast((t) => t.role === "me")?.text;
    setChat((c) => (c.job !== chat.job ? c : { ...c, busy: false, job: undefined, partial: undefined, ...(c.partial ? { session: c.session ?? session, turns: [...c.turns, { role: "ai", text: c.partial, stopped: true }] } : { error: "Stopped.", failed: asked }) }));
    field.current?.focus();
  };
  // ⌘. stops it, as it stops the tutor's reply (the Mac's own cancel key).
  useEffect(() => {
    if (!busy) return;
    const key = (e: KeyboardEvent) => { if (is(e, "tutor-stop")) { e.preventDefault(); stop(); } };
    document.addEventListener("keydown", key, true);
    return () => document.removeEventListener("keydown", key, true);
  });

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
                {t.stopped && <p className="tutor-general">Stopped</p>}
                {t.proposal && (
                  <div className="ask-card">
                    <div className="quiz-kicker">Suggested exercise</div>
                    <p className="ask-card-q"><Changes was={t.was?.question} now={t.proposal.question} /></p>
                    <p className="ask-card-a"><Changes was={t.was?.answer} now={t.proposal.answer} /></p>
                    <button className="ask-use" disabled={applied(t.proposal)} onClick={() => void onApply(t.proposal!).catch(() => {})}>
                      {applied(t.proposal) ? "Exercise updated" : "Use this exercise"}
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
            {chat.partial ? (
              <div className="ask-text">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{chat.partial}</ReactMarkdown>
              </div>
            ) : (
              <span className="ask-dots" aria-label="Thinking">
                <i />
                <i />
                <i />
              </span>
            )}
          </div>
        )}
        {error && (
          <p className={error === "Stopped." ? "tutor-stopped" : "err"}>
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
          aria-label="Ask about this exercise"
          placeholder={turns.length ? "Ask a follow-up…" : "Ask about this exercise…"}
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
        {busy ? (
          // While a reply is written the send button is Stop, as in the tutor (ChatGPT, Claude, Notion AI).
          <Hint text="Stop" keys="tutor-stop" side="top">
            <button className="ask-send stop" aria-label="Stop the reply" onClick={stop}>
              <Stop size={14} aria-hidden="true" />
            </button>
          </Hint>
        ) : (
          <Hint text={<>Send <kbd>↵</kbd></>} side="top">
            <button className="ask-send" aria-label="Send" disabled={!input.trim()} onClick={() => void send(input)}>
              <ArrowUp size={14} weight="bold" aria-hidden="true" />
            </button>
          </Hint>
        )}
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
