import { ArrowUp, Sparkle, Stop } from "./icons";
import { Fragment, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { mend } from "./mend";
import { useSteady } from "./steady";
import { aiMath, reply as math, wholeFormulas } from "./math-md";
import { Grow } from "./Grow";
import { Hint } from "./Hint";
import { listen } from "@tauri-apps/api/event";
import { cancelOre, ore, oreJob, oreWith, opt, type CardFull, type AskReply, type SavedExerciseChat } from "./ore";
import { is } from "./keys";
import { errorText, type Notify } from "./util";
import { wordDiff } from "./worddiff";
import { Working } from "./Working";

type Turn = SavedExerciseChat["turns"][number];
type Proposal = NonNullable<Turn["proposal"]> & { ai?: Turn["ai"] };

const STARTERS = ["Why is this the answer?", "Give me an example", "Make this exercise clearer"];

type Run = { id: string; turn: string; session?: string; ai?: AskReply["ai"]; stopped?: boolean };
type AskChat = SavedExerciseChat & { input: string; partial?: string; run?: Run };

/** Like Tutor's chat, a reply can land while its panel or Review is closed. */
export function useAskChats(notify: Notify) {
  const [chats, setChats] = useState<Record<string, AskChat>>({});
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  return {
    chats,
    async load(exercise: string) {
      await pending.current;
      const saved = await ore<SavedExerciseChat>("chat", exercise, "--exercise");
      // Read each time Ask opens, so the other window's turns (the quick quiz's) show, unless a reply is on its way here.
      setChats((all) => all[exercise]?.run ? all : {
        ...all,
        [exercise]: { ...saved, input: all[exercise]?.input ?? "", turns: saved.turns.map((t) => t.reply === undefined && !t.error ? { ...t, error: "No reply came: Ore closed before it did." } : t) },
      });
    },
    update(exercise: string, change: (c: AskChat) => AskChat) {
      setChats((all) => ({ ...all, [exercise]: change(all[exercise]!) }));
    },
    save(chat: SavedExerciseChat, title: string, turns: Turn[]) {
      const { id, exercise } = chat;
      const body = JSON.stringify({ id, exercise, title: title.trim().slice(0, 120) || "Exercise chat", turns });
      // As in Tutor, an older snapshot finishes writing before the one with its reply.
      pending.current = pending.current.then(() => oreWith(body, "chat", "--set", "--merge")).catch((e) => {
        notify(errorText(e, "save the exercise chat"), "error");
      });
    },
  };
}

type ChatProps = { card: CardFull; answer: string; onApply: (p: Proposal) => Promise<void>; onClose: () => void };

/** Ask about this (D61): a chat about the card he just answered, like ChatGPT's thread under a
 *  message. It runs on his own plan through `ore ask` (claude -p or codex); a proposed card is
 *  applied only when he clicks Use this card. Never shown before the answer, never rates. */
export function Ask({ store, ...props }: ChatProps & { store: ReturnType<typeof useAskChats> }) {
  const { card } = props;
  const chat = store.chats[card.id];
  const [error, setError] = useState<string | null>(null);
  const [attempt, retry] = useState(0);
  useEffect(() => {
    let open = true;
    store.load(card.id).catch((e) => { if (open) setError(errorText(e, "open the exercise chat")); });
    return () => { open = false; };
  }, [card.id, attempt]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!chat) {
    return <section className="ask" aria-label="Ask about this">
      {error
        ? <p className="err" role="alert">{error} <button className="link" onClick={() => { setError(null); retry((n) => n + 1); }}>Try again</button></p>
        : <Working label="Opening your chat…" />}
    </section>;
  }
  return <AskThread {...props} chat={chat} setChat={(f) => store.update(card.id, f)} save={(turns) => store.save(chat, card.question, turns)} />;
}

function AskThread({ card, answer, chat, setChat, save, onApply, onClose }: ChatProps & {
  chat: AskChat;
  setChat: (f: (c: AskChat) => AskChat) => void;
  save: (turns: Turn[]) => void;
}) {
  const { turns, input, run } = chat;
  const busy = !!run;
  const last = turns.at(-1);
  const error = busy ? undefined : last?.error;
  /** Read off the card itself, never remembered: an undo or a later edit makes a suggestion usable again. */
  const same = (a: string, b: string) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();
  const applied = (p: NonNullable<Turn["proposal"]>) => same(p.question, card.question) && same(p.answer, card.answer)
    && (!p.rubric || p.rubric.length === card.rubric.length && p.rubric.every((point, i) => same(point, card.rubric[i]!)));
  const field = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  // The reply so far typed out at a steady pace, as the tutor's is (D321).
  const { shown } = useSteady(run?.id, chat.partial ?? "", true);

  useEffect(() => {
    field.current?.focus();
  }, []);
  useEffect(() => {
    // Braces: newer engines return a promise from a smooth scrollIntoView, which an effect must not return.
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [turns, busy]);

  /** `again`: Try again on a message that failed; it is in the thread already, and what he has typed since stays. */
  /** One request at a time: a double click on Try again sends once (busy is a render behind). */
  const sending = useRef<Run | null>(null);
  const settle = (job: Run, before: Turn[], result: Partial<Turn>) => {
    const next = before.map((t) => t.id === job.turn ? { ...t, ...result } : t);
    save(next);
    setChat((c) => c.run === job ? { ...c, turns: next, run: undefined, partial: undefined } : c);
  };
  const send = async (text: string, again?: Turn) => {
    const message = text.trim();
    if (!message || busy || (sending.current && !sending.current.stopped)) return;
    // The reply lands on this run alone: Stop ends it, and whatever it still sends or returns is dropped.
    const id = `ask-${crypto.randomUUID()}`;
    const turn: Turn = { id: again?.id ?? id, message };
    const job: Run = { id, turn: turn.id };
    const next = again ? turns.map((t) => t.id === turn.id ? turn : t) : [...turns, turn];
    sending.current = job;
    setChat((c) => ({ ...c, turns: next, input: again ? c.input : "", run: job }));
    save(next);
    // The reply as it is written (ChatGPT's streaming), as the tutor's comes: the first words in place of the dots.
    const off = await listen<{ stream?: string; reply?: string; session?: string; ai?: AskReply["ai"] }>("ore-progress", ({ payload: p }) => {
      if (p.stream !== id || job.stopped) return;
      job.session = p.session ?? job.session;
      job.ai = p.ai ?? job.ai;
      if (p.reply !== undefined) setChat((c) => c.run === job ? { ...c, partial: p.reply } : c);
    }).catch(() => () => {});
    try {
      // Stop can run while listener registration is pending, before there is a native job to cancel.
      if (job.stopped) return;
      // His answer goes with every turn: a session from the AI he used before he switched starts a new one with it.
      const session = turns.findLast((t) => t.session)?.session;
      const r = await oreJob<AskReply>(id, null, "ask", card.id, opt("message", message), opt("stream", id), ...(session ? [opt("session", session)] : []), opt("answer", answer || "(no idea)"), ...(card.variant ? [opt("variant", card.variant)] : []));
      // Checked here, outside the updater: a throw inside one escapes this catch and takes Review down with it.
      if (typeof r?.reply !== "string" || !r.reply.trim()) throw new TypeError("ask gave no reply");
      if (!job.stopped) settle(job, next, { reply: r.reply, proposal: r.proposal, ai: r.ai, session: r.session, was: { question: card.question, answer: card.answer, rubric: card.rubric } });
    } catch (e) {
      if (!job.stopped) settle(job, next, { error: errorText(e, "answer that") });
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
    if (!run || run.stopped) return;
    run.stopped = true;
    void cancelOre(run.id);
    settle(run, turns, chat.partial
      ? { reply: chat.partial, session: run.session, ai: run.ai, stopped: true }
      : { error: "Stopped." });
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
        {turns.map((t) => (
          <Fragment key={t.id}>
            <p className="ask-me">{t.message}</p>
            {t.reply !== undefined && <div className="ask-ai">
              <Sparkle className="ask-mark" size={14} weight="fill" aria-hidden="true" />
              <div className="ask-text">
                <ReactMarkdown {...math}>{aiMath(t.reply)}</ReactMarkdown>
                {t.stopped && <p className="tutor-general">Stopped</p>}
                {t.proposal && (
                  <div className="ask-card">
                    <div className="quiz-kicker">Suggested exercise</div>
                    <p className="ask-card-q"><Changes was={t.was?.question} now={t.proposal.question} /></p>
                    <p className="ask-card-a"><Changes was={t.was?.answer} now={t.proposal.answer} /></p>
                    {!!t.proposal.rubric?.length && <KeyPointChanges was={t.was?.rubric} now={t.proposal.rubric} />}
                    {card.kind === "prompt" && !t.proposal.rubric?.length && !applied(t.proposal)
                      ? <p className="ask-card-a">Ask for a new suggestion with key points.</p>
                      : <button className="ask-use" disabled={applied(t.proposal)} onClick={() => void onApply({ ...t.proposal!, ai: t.ai }).catch(() => {})}>
                          {applied(t.proposal) ? "Exercise updated" : "Use this exercise"}
                        </button>}
                  </div>
                )}
              </div>
            </div>}
          </Fragment>
        ))}
        {busy && (
          <div className="ask-ai">
            <Sparkle className="ask-mark" size={14} weight="fill" aria-hidden="true" />
            {shown ? (
              <div className="ask-text">
                <ReactMarkdown {...math}>{aiMath(mend(wholeFormulas(shown, chat.partial ?? "")))}</ReactMarkdown>
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
            {last && (
              <>
                {" "}
                <button className="link" onClick={() => void send(last.message, last)}>
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

function KeyPointChanges({ was, now }: { was?: string[]; now: string[] }) {
  return (
    <div className="ask-card-points">
      <div className="quiz-kicker">Key points</div>
      <ul>
        {Array.from({ length: Math.max(was?.length ?? 0, now.length) }, (_, i) => (
          <li key={i}><Changes was={was && (was[i] ?? "")} now={now[i] ?? ""} /></li>
        ))}
      </ul>
    </div>
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
