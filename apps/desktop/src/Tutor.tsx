import { ArrowUp, Check, Plus, SidebarRight, Sparkle, Square, X } from "./icons";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Grow } from "./Grow";
import { escTaken, Hint } from "./Hint";
import { useSideWidth } from "./Notes";
import { ore, opt } from "./ore";
import { errorText, type Notify } from "./util";
import { Working } from "./Working";
import { mentionMatches, type Mention } from "./mentions";

export type Citation = { n: number; item: string; title: string; heading: string; quote: string; text: string; start: number; end: number };
/** One exchange. `item`/`title` is the source it was asked about (the context chip at the time). */
export type TutorCard = { kind: "card" | "prompt"; content_type: string; question: string; answer: string; rubric: string[] };
type Ai = { vendor: string; model: string; prompt_version: string };
/** An open exercise (D128.6): its heading in his note and the placeholder lines under it. */
export type Exercise = { heading: string; prompts: string[] };
export type TutorTurn = {
  /** Unique across chats: a reply lands only on the turn that asked for it. */
  id: string;
  message: string; item?: string; title?: string; mentions?: Mention[];
  reply?: string; citations?: Citation[]; general?: boolean; hint?: boolean; exercise?: Exercise | null; card?: TutorCard | null; ai?: Ai; error?: string;
  /** The card he kept from this reply: its id, or "adding" while it is written. */
  kept?: string;
};
type Reply = { reply: string; citations: Citation[]; general: boolean; hint: boolean; exercise: Exercise | null; card: TutorCard | null; ai: Ai };
/** What he has typed and not sent yet, with the @-mentions in it. */
export type TutorDraft = { input: string; mentions: Mention[] };
export type TutorChat = ReturnType<typeof useTutorChat>;

let turnSeq = 0;
const turnId = () => `${Date.now().toString(36)}-${++turnSeq}`;

/** The tutor's thread, his draft and its requests, held in App so closing the panel or moving around
 *  the app loses nothing and never asks twice. New chat sets the thread aside: Undo swaps it back. */
export function useTutorChat(notify: Notify) {
  const [turns, setTurns] = useState<TutorTurn[]>([]);
  const [draft, setDraft] = useState<TutorDraft>({ input: "", mentions: [] });
  const now = useRef(turns);
  const update = (f: (t: TutorTurn[]) => TutorTurn[]) => setTurns((now.current = f(now.current)));
  // Every change to a turn, by id, so a thread set aside by New chat comes back with what landed meanwhile.
  const landed = useRef(new Map<string, Partial<TutorTurn>>());
  const patch = (id: string, p: Partial<TutorTurn>) => {
    landed.current.set(id, { ...landed.current.get(id), ...p });
    update((ts) => ts.map((t) => (t.id === id ? { ...t, ...p } : t)));
  };
  const run = async (t: TutorTurn, before: TutorTurn[]) => {
    const earlier = before.flatMap((x) => (x.reply ? [{ message: x.message, reply: x.reply }] : []));
    try {
      const pointed = (t.mentions ?? []).map((m) => opt(m.kind, m.id));
      const r = await ore<Reply>("tutor", t.message, ...(t.item ? [opt("item", t.item)] : []), ...pointed, ...(earlier.length ? [opt("earlier", JSON.stringify(earlier))] : []));
      patch(t.id, { reply: r.reply, citations: r.citations, general: r.general, hint: r.hint, exercise: r.exercise, card: r.card, ai: r.ai, error: undefined });
    } catch (e) {
      patch(t.id, { error: errorText(e, "answer that") });
    }
  };
  /** Adds his message to the thread and asks. */
  const ask = (turn: Omit<TutorTurn, "id">) => {
    const t = { ...turn, id: turnId() };
    const before = now.current;
    update((ts) => [...ts, t]);
    void run(t, before);
  };
  const retry = (id: string) => {
    const i = now.current.findIndex((t) => t.id === id);
    if (i < 0) return;
    const { message, item, title, mentions } = now.current[i]!;
    const t = { id, message, item, title, mentions };
    landed.current.delete(id);
    update((ts) => ts.map((x) => (x.id === id ? t : x)));
    void run(t, now.current.slice(0, i));
  };
  /** Keeps the reply's card on the source it cites first (else the one he asked about); ⌘Z retires it. */
  const keep = async (id: string) => {
    const t = now.current.find((x) => x.id === id);
    const item = t?.citations?.[0]?.item ?? t?.item;
    if (!t?.card || !t.ai || !item || t.kept) return;
    const mark = (kept: string | undefined) => patch(id, { kept });
    mark("adding");
    try {
      const c = await ore<{ id: string }>("tutor-card", item, opt("card", JSON.stringify(t.card)), opt("ai", JSON.stringify(t.ai)));
      mark(c.id);
      notify(
        "Card added",
        "quiet",
        () => void ore("card", "retire", c.id).then(() => mark(undefined), (e) => notify(errorText(e), "error")),
        () => void ore("card", "restore", c.id, "--state=draft").then(() => mark(c.id), (e) => notify(errorText(e), "error")),
      );
    } catch (e) {
      mark(undefined);
      notify(errorText(e, "add that card"), "error");
    }
  };
  /** A new chat, even while one is thinking (its reply goes to its own thread); Undo brings that thread back. */
  const fresh = () => {
    let away = now.current;
    if (!away.length) return;
    update(() => []);
    const swap = () => {
      const back = away;
      away = now.current;
      update(() => back.map((t) => ({ ...t, ...landed.current.get(t.id) })));
    };
    notify("Chat cleared", "info", swap, swap);
  };
  return { turns, draft, setDraft, ask, retry, keep, fresh };
}

/** Starters for an empty chat, so he sees what it does (NotebookLM's suggested questions). */
const STARTERS_READING = ["Explain this simply", "Give me an example", "Practice"];
const STARTERS = ["What have I been learning?", "Explain something I saved", "Practice"];

/** The tutor (D128): a chat docked at the window's right, like Notion AI's and Linear's Ask panels,
 *  opened from the bubble at the bottom right or ⌘J. It sees the source he is reading (the chip over
 *  the field, removable) and what he @-mentions, answers from his sources with numbered citations that open the passage
 *  (the panel stays), says when an answer is from general knowledge, and gives hints, not answers, on
 *  practice. It floats over the bottom right corner (Notion AI's default) or docks at the right in the
 *  side panel's place; the header switches, and the choice is remembered. The thread lives in App, so
 *  it survives navigation; + starts a new one. */
export function Tutor({ docked, onFit, chat, reading, sources, skills, onOpen, onClose, onQuiz, onWrite }: {
  chat: TutorChat;
  /** Write an exercise's answer in the open source's note, the source hidden (D128.6); absent with no source open. */
  onWrite?: (exercise: Exercise) => void;
  /** Quiz me: Review on his due cards in these skills (none: all of them). */
  onQuiz: (skills: string[]) => void;
  /** Docked at the right, in the side panel's place; else floating over the bottom right corner. */
  docked: boolean;
  onFit: () => void;
  /** What @ can point at. */
  sources: { id: string; title: string }[];
  skills: { id: string; name: string }[];
  /** The source on screen, if any. */
  reading: { id: string; title: string; skills: string[] } | null;
  onOpen: (item: string, at: string) => void;
  onClose: () => void;
}) {
  const { turns, draft: { input, mentions }, setDraft } = chat;
  const setInput = (text: string) => setDraft((d) => ({ ...d, input: text }));
  // He can take the open source out of the context (the chip's ×); a new source puts it back.
  const [dropped, setDropped] = useState<string | null>(null);
  const context = reading && dropped !== reading.id ? reading : null;
  // @-mentions (Claude's and ChatGPT's @): the name goes into the text, and each one still written
  // there when he sends points the tutor at it.
  const [at, setAt] = useState<{ query: string; start: number } | null>(null);
  const [pick, setPick] = useState(0);
  // Where the caret goes once a picked @name is in the text: set before the next key lands, so typing
  // straight on never splits the name.
  const caretAt = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (caretAt.current === null) return;
    field.current?.setSelectionRange(caretAt.current, caretAt.current);
    caretAt.current = null;
  }, [input]);
  // Quiz me's scope: the skills he @-mentioned in what he is typing, else the open source's skills.
  const typedSkills = mentions.filter((m) => m.kind === "skill" && input.includes(`@${m.name}`)).map((m) => m.id);
  const quizSkills = typedSkills.length ? typedSkills : (context?.skills ?? []);
  const matches = at ? mentionMatches(at.query, sources, skills, mentions.filter((m) => input.includes(`@${m.name}`))) : [];
  const field = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const busy = turns.some((t) => t.reply === undefined && !t.error);
  const { width, dragging, divider } = useSideWidth("ore.tutorwidth", 380, 300);
  // Writing in the note is for the source in context: the note is that source's.
  const write = context && reading && onWrite ? onWrite : undefined;

  const send = (text: string) => {
    const message = text.trim();
    if (!message || busy) return;
    const pointed = mentions.filter((m, i) => message.includes(`@${m.name}`) && mentions.findIndex((x) => x.kind === m.kind && x.id === m.id) === i);
    chat.ask({ message, ...(context ? { item: context.id, title: context.title } : {}), ...(pointed.length ? { mentions: pointed } : {}) });
    setDraft(() => ({ input: "", mentions: [] }));
    setAt(null);
    field.current?.focus();
  };

  /** The @word the caret is in, if any. */
  const track = (text: string, caret: number) => {
    const m = /(?:^|\s)@([^\s@]*)$/.exec(text.slice(0, caret));
    setAt(m ? { query: m[1]!, start: caret - m[1]!.length - 1 } : null);
    setPick(0);
  };
  const choose = (m: Mention) => {
    if (!at) return;
    const word = `@${m.name} `;
    const text = input.slice(0, at.start) + word + input.slice(at.start + 1 + at.query.length).replace(/^ /, "");
    setDraft((d) => ({ input: text, mentions: [...d.mentions, m] }));
    setAt(null);
    caretAt.current = at.start + word.length;
  };

  useEffect(() => {
    field.current?.focus();
  }, []);
  // Window-fixed controls at the top right (the reader's side panel toggle) move left of the panel.
  useEffect(() => {
    if (!docked) return;
    document.documentElement.style.setProperty("--tutor-w", `${width}px`);
    return () => void document.documentElement.style.removeProperty("--tutor-w");
  }, [width, docked]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [turns]);

  return (
    <aside
      className={`tutor${docked ? "" : " float"}${dragging ? " dragging" : ""}`}
      aria-label="Tutor"
      style={docked ? { width } : undefined}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !escTaken(e.nativeEvent)) {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      {docked && (
        <Hint text="Drag to resize · double-click to reset" side="left">
          <div className="divider" role="separator" aria-orientation="vertical" aria-label="Resize the tutor" {...divider} />
        </Hint>
      )}
      <div className="tutor-quiz">
        <Hint text={quizSkills.length ? `Review your due cards in ${quizSkills.map((s) => skills.find((k) => k.id === s)?.name ?? s).join(", ")}` : "Review your due cards"}>
          <button onClick={() => onQuiz(quizSkills)}>Quiz me</button>
        </Hint>
      </div>
      <div className="tutor-head">
        <Hint text="New chat">
          <button className="icon-btn" aria-label="New chat" disabled={!turns.length} onClick={() => { chat.fresh(); field.current?.focus(); }}>
            <Plus size={14} aria-hidden="true" />
          </button>
        </Hint>
        <Hint text={docked ? "Float over the page" : "Dock to the side"}>
          <button className="icon-btn" aria-label={docked ? "Float over the page" : "Dock to the side"} onClick={() => { onFit(); field.current?.focus(); }}>
            {docked ? <Square size={14} aria-hidden="true" /> : <SidebarRight size={14} aria-hidden="true" />}
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
        {turns.map((t, i) => {
          const last = i === turns.length - 1 && !busy;
          return (
          <div key={t.id} className="library-turn">
            <p className="ask-me">{marked(t.message, t.mentions ?? [])}</p>
            <div className="ask-ai">
              <Sparkle className="ask-mark" size={14} aria-hidden="true" />
              <div className="ask-text">
                {t.error ? (
                  <p className="err">
                    {t.error}{" "}
                    <button className="link" onClick={() => chat.retry(t.id)}>Try again</button>
                  </p>
                ) : t.reply === undefined ? (
                  <Working label="Thinking…" slow="A reply takes about 10 seconds." />
                ) : (
                  <>
                    <Answer text={t.reply} citations={t.citations ?? []} onOpen={onOpen} general={t.general} />
                    {((last && (t.hint || (t.exercise && write))) || (t.card && (t.citations?.[0]?.item ?? t.item))) && (
                      <div className="tutor-acts">
                        {last && t.hint && <button onClick={() => send("Show me")}>Show me</button>}
                        {last && t.exercise && write && (
                          <Hint text="Source hidden · send it back" keys="finish">
                            <button onClick={() => write(t.exercise!)}>Write it in your note</button>
                          </Hint>
                        )}
                        {t.card && (t.citations?.[0]?.item ?? t.item) && (
                          <Hint text={t.kept && t.kept !== "adding" ? "In review from tomorrow" : t.card.question}>
                            <button className={t.kept ? "done" : undefined} aria-label={t.kept ? "Card added" : `Add card: ${t.card.question}`} disabled={!!t.kept} onClick={() => void chat.keep(t.id)}>
                              {t.kept ? <><Check size={12} aria-hidden="true" />Card added</> : <><Plus size={12} aria-hidden="true" />Card</>}
                            </button>
                          </Hint>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          );
        })}
        <div ref={end} />
      </div>
      <div className="tutor-foot">
        {at && (
          <div className="tutor-mention" role="listbox" aria-label="Point the tutor at">
            {matches.length ? (
              matches.map((m, i) => (
                <button
                  key={m.kind + m.id}
                  role="option"
                  aria-selected={i === pick}
                  className={`menu-item${i === pick ? " active" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseMove={() => setPick(i)}
                  onClick={() => choose(m)}
                >
                  <span className="tutor-mention-name">{m.name}</span>
                  <span className="tutor-mention-kind">{m.kind === "skill" ? "Skill" : "Source"}</span>
                </button>
              ))
            ) : (
              <p className="tutor-mention-none">No source or skill matches “{at.query}”</p>
            )}
          </div>
        )}
        {context && (
          <div className="tutor-chips">
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
          </div>
        )}
        <div className="ask-input">
          <Grow
            ref={field}
            rows={1}
            className="field"
            aria-label="Message the tutor"
            placeholder={turns.length ? "Reply…" : context ? "Ask about this, or @ a source or skill…" : "Ask anything, or @ a source or skill…"}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              track(e.target.value, e.target.selectionStart);
            }}
            onSelect={(e) => at && track(e.currentTarget.value, e.currentTarget.selectionStart)}
            onKeyDown={(e) => {
              if (at && !e.nativeEvent.isComposing) {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  if (matches.length) setPick((p) => (p + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length);
                  return;
                }
                if ((e.key === "Enter" || e.key === "Tab") && matches[pick]) {
                  e.preventDefault();
                  choose(matches[pick]!);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  setAt(null);
                  return;
                }
              }
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

/** His message with each @name it points at in the accent colour. */
function marked(text: string, mentions: Mention[]) {
  if (!mentions.length) return text;
  const names = mentions.map((m) => `@${m.name}`).sort((a, b) => b.length - a.length);
  const re = new RegExp(`(${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return text.split(re).map((part, i) => (names.includes(part) ? <span key={i} className="tutor-at">{part}</span> : part));
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

