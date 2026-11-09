import * as Tooltip from "@radix-ui/react-tooltip";
import { ArrowDown, ArrowUp, Check, Circle, Plus, SidebarRight, Sparkle, Square, X } from "./icons";
import { citeRuns, siteName } from "./cite-pills";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Evidence } from "./Evidence";
import { Grow } from "./Grow";
import { escTaken, Hint, onlyTabbed } from "./Hint";
import { useSideWidth } from "./Notes";
import { ore, opt } from "./ore";
import { errorText, type Notify } from "./util";
import { Working } from "./Working";
import { mentionMatches, type Mention } from "./mentions";
import { Mole, type Mood } from "./Mole";
import { firstWords, landedClosed } from "./mole-says";

export type Citation = { n: number; item: string; title: string; heading: string; quote: string; text: string; start: number; end: number };
/** A web page the tutor's search found (D128, Tyler 2026-11-08): cited like a passage, opened in the browser. */
type WebCitation = { n: number; url: string; title: string; site: string; quote: string; text: string };
type AnyCitation = Citation | WebCitation;
/** The first of his own sources a reply cites: where a card from it belongs. */
const firstSource = (cs: AnyCitation[] | undefined) => cs?.find((c): c is Citation => !("url" in c))?.item;
/** One exchange. `item`/`title` is the source it was asked about (the context chip at the time). */
type TutorCard = { kind: "card" | "prompt"; content_type: string; question: string; answer: string; rubric: string[] };
type Ai = { vendor: string; model: string; prompt_version: string };
/** An open exercise (D128.6): its heading in his note, the placeholder lines under it, and the card it
 *  becomes if he misses (D158), committed before he answers and never shown until then. */
type Exercise = { heading: string; prompts: string[]; card: TutorCard; cases?: string[] | null };
/** Feedback on an exercise (D162): each point of its committed card, whether his answer covered it, and his words that did. */
type Mark = { point: string; covered: boolean; quote: string };
export type TutorTurn = {
  /** Unique across chats: a reply lands only on the turn that asked for it. */
  id: string;
  message: string; item?: string; title?: string; mentions?: Mention[];
  /** The @ context the request carried: his own @s, else the ones still in effect from before (D128.3). */
  pointed?: Mention[];
  /** While the reply is written: its text so far, and whether it is searching the web (claude streams both). */
  partial?: string; searching?: boolean;
  /** A web search has run on this turn, so the reply is being written from what it found (D146). */
  searched?: boolean;
  reply?: string; citations?: AnyCitation[]; general?: boolean; hint?: boolean; exercise?: Exercise | null; card?: TutorCard | null; ai?: Ai; error?: string;
  /** A worked answer's steps, shown one at a time (D142); empty for any other reply. */
  steps?: string[];
  /** Feedback on his answer to an exercise: its card's points, marked (D162); empty for any other reply. */
  marks?: Mark[];
  /** The card he kept from this reply: its id, or "adding" while it is written. */
  kept?: string;
};
type Reply = { reply: string; citations: AnyCitation[]; general: boolean; hint: boolean; exercise: Exercise | null; card: TutorCard | null; steps?: string[]; marks?: Mark[]; ai: Ai };
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
  // The @ context in effect (D128.3): the last message's own @s carry to later ones until he @s
  // something else, drops one (its chip's ×) or starts a new chat.
  const [carry, setCarryState] = useState<Mention[]>([]);
  const carryNow = useRef(carry);
  const setCarry = (m: Mention[]) => setCarryState((carryNow.current = m));
  const drop = (m: Mention) => setCarry(carryNow.current.filter((x) => x.kind !== m.kind || x.id !== m.id));
  const run = async (t: TutorTurn, before: TutorTurn[]) => {
    // The steps of a worked answer he has shown are part of what the tutor said, so a follow-up ("why step
    // 2?") can lean on them; the ones still hidden aren't, so his own try at the next step is his (D142).
    const said = (x: TutorTurn) => [x.reply, ...(x.steps ?? []).slice(0, stepsShown.get(x.id) ?? 1).map((s, i) => `${i + 1}. ${s}`)].join("\n\n");
    // A turn that set an exercise carries it, so the feedback judges against the card committed then (D158).
    const earlier = before.flatMap((x) => (x.reply ? [{ message: x.message, reply: said(x), ...(x.exercise ? { exercise: x.exercise } : {}) }] : []));
    // The reply as it is written lands on this turn (ChatGPT's streaming), so the first words show in a
    // second or two instead of the whole reply after five.
    const stop = await listen<{ stream?: string; reply?: string; searching?: boolean }>("ore-progress", ({ payload: p }) => {
      if (p.stream === t.id) patch(t.id, p.reply !== undefined ? { partial: p.reply } : p.searching ? { searching: true } : { searching: false, searched: true });
    }).catch(() => () => {});
    try {
      const pointed = (t.pointed ?? []).map((m) => opt(m.kind, m.id));
      const r = await ore<Reply>("tutor", t.message, ...(t.item ? [opt("item", t.item)] : []), ...pointed, ...(earlier.length ? [opt("earlier", JSON.stringify(earlier))] : []), opt("stream", t.id));
      patch(t.id, { reply: r.reply, citations: r.citations, general: r.general, hint: r.hint, exercise: r.exercise, card: r.card, steps: r.steps ?? [], marks: r.marks ?? [], ai: r.ai, error: undefined, partial: undefined, searching: undefined });
    } catch (e) {
      patch(t.id, { error: errorText(e, "answer that"), partial: undefined, searching: undefined });
    } finally {
      stop();
    }
  };
  /** Adds his message to the thread and asks. */
  const ask = (turn: Omit<TutorTurn, "id">) => {
    if (turn.mentions?.length) setCarry(turn.mentions);
    const t = { ...turn, ...(carryNow.current.length ? { pointed: carryNow.current } : {}), id: turnId() };
    const before = now.current;
    update((ts) => [...ts, t]);
    void run(t, before);
  };
  const retry = (id: string) => {
    const i = now.current.findIndex((t) => t.id === id);
    if (i < 0) return;
    const { message, item, title, mentions, pointed } = now.current[i]!;
    stepsShown.delete(id); // a new reply starts its steps from the first
    const t = { id, message, item, title, mentions, pointed };
    landed.current.delete(id);
    update((ts) => ts.map((x) => (x.id === id ? t : x)));
    void run(t, now.current.slice(0, i));
  };
  /** Keeps the reply's card on the source it cites first (else the one he asked about); ⌘Z retires it. */
  const keep = async (id: string) => {
    const t = now.current.find((x) => x.id === id);
    const item = firstSource(t?.citations) ?? t?.item;
    if (!t?.card || !t.ai || !item || t.kept) return;
    const mark = (kept: string | undefined) => patch(id, { kept });
    mark("adding");
    try {
      const c = await ore<{ id: string }>("tutor-card", item, opt("card", JSON.stringify(t.card)), opt("ai", JSON.stringify(t.ai)));
      mark(c.id);
      notify(
        "Card added",
        "quiet",
        () => ore("card", "retire", c.id).then(() => mark(undefined)),
        () => ore("card", "restore", c.id, "--state=draft").then(() => mark(c.id)),
      );
    } catch (e) {
      mark(undefined);
      notify(errorText(e, "add that card"), "error");
    }
  };
  /** Puts words he selected in a reply into the note of the source it is about, as a quote under "From the
   *  tutor" (D164); ⌘Z puts the note back as it was, keeping anything he has written since. The open
   *  note's editor saves its draft first, then shows the file (ore:note-written, as Diagram.tsx does). */
  const quote = async (item: string, text: string) => {
    const lines = text.trim().split(/\n+/).map((l) => `> ${l.trim()}`).join("\n>\n");
    const written = () => window.dispatchEvent(new CustomEvent("ore:note-written", { detail: item }));
    try {
      const before = (await ore<{ text: string }>("notes", item)).text;
      const after = (await ore<{ text: string }>("notes", item, opt("append", lines), opt("heading", "From the tutor"))).text;
      written();
      if (after === before) return notify("Already in your note", "info");
      notify(
        "Added to your note",
        "info",
        // A failed write puts the step back and says why (history.ts).
        () => ore("notes", item, opt("set", before), opt("base", after)).then(written),
        () => ore("notes", item, opt("append", lines), opt("heading", "From the tutor")).then(written),
      );
    } catch (e) {
      notify(errorText(e, "add that to your note"), "error");
    }
  };
  /** A new chat, even while one is thinking (its reply goes to its own thread); Undo brings that thread
   *  back, with its @ context. */
  const fresh = () => {
    let away = now.current;
    let awayCarry = carryNow.current;
    if (!away.length) return;
    update(() => []);
    setCarry([]);
    const swap = () => {
      const [back, backCarry] = [away, awayCarry];
      [away, awayCarry] = [now.current, carryNow.current];
      update(() => back.map((t) => ({ ...t, ...landed.current.get(t.id) })));
      setCarry(backCarry);
    };
    notify("Chat cleared", "info", async () => swap(), async () => swap());
  };
  /** A web page a reply cites, in his browser. */
  const openLink = (url: string) => void openUrl(url).catch((e) => notify(`Couldn’t open the link: ${errorText(e)}`, "error"));
  return { turns, draft, setDraft, carry, drop, ask, retry, keep, quote, fresh, openLink };
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
  /** Write an exercise's answer in the note of the source it was asked about, the source hidden (D128.6). */
  onWrite: (exercise: { heading: string; prompts: string[] }, source: { id: string; title: string }) => void;
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
  const { turns, draft: { input, mentions }, setDraft, carry } = chat;
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
  // Quiz me's scope: the skills he @-mentioned in what he is typing, else those still in effect, else the open source's.
  const typedSkills = mentions.filter((m) => m.kind === "skill" && input.includes(`@${m.name}`)).map((m) => m.id);
  const carriedSkills = carry.filter((m) => m.kind === "skill").map((m) => m.id);
  const quizSkills = typedSkills.length ? typedSkills : carriedSkills.length ? carriedSkills : (context?.skills ?? []);
  const matches = at ? mentionMatches(at.query, sources, skills, mentions.filter((m) => input.includes(`@${m.name}`))) : [];
  const field = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  /** The log follows the end only while he is at it (ChatGPT, Claude): scrolled up to reread, a reply grows
   *  below without moving what he is reading. `end` is the log's height when he was last at its end, so a
   *  reply that just grew it still finds him there; `force` follows the next change whatever (he sent). */
  const end = useRef(0);
  const force = useRef(true);
  /** Something new landed below while he was scrolled up: the pill that takes him there. */
  const [below, setBelow] = useState(false);
  const toEnd = () => {
    const el = log.current;
    if (el) end.current = el.scrollTop = el.scrollHeight;
    setBelow(false);
  };
  const busy = turns.some((t) => t.reply === undefined && !t.error);
  /** Words he selected in one reply, and where to show what he can do with them (D164, Linear's and assistant-ui's quote toolbar). */
  const [picked, setPicked] = useState<{ turn: string; text: string; x: number; y: number; below: boolean } | null>(null);
  useEffect(() => {
    const read = () => {
      const sel = document.getSelection();
      const el = log.current;
      const range = sel && !sel.isCollapsed && sel.rangeCount ? sel.getRangeAt(0) : null;
      const reply = range && (range.commonAncestorContainer instanceof Element ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement)?.closest<HTMLElement>("[data-reply]");
      const text = sel?.toString().trim() ?? "";
      if (!el || !range || !reply || !el.contains(reply) || !text) return setPicked(null);
      const r = range.getBoundingClientRect(), box = el.getBoundingClientRect();
      // Above the words, as the reader's popup sits; below them when the log's top would clip it.
      const below = r.top - box.top < 40;
      setPicked({ turn: reply.dataset.reply!, text, below, x: Math.max(70, Math.min(r.left + r.width / 2 - box.left, box.width - 70)), y: (below ? r.bottom : r.top) - box.top + el.scrollTop });
    };
    document.addEventListener("selectionchange", read);
    return () => document.removeEventListener("selectionchange", read);
  }, []);
  /** The point of an exercise's feedback under the pointer or focus: its words are underlined in his answer (D162). */
  const [lit, setLit] = useState<{ turn: string; quote: string } | null>(null);
  const { width, dragging, divider } = useSideWidth("ore.tutorwidth", 380, 300);

  /** `typed`: the message is what is in the box, so the box empties; a starter or Show me leaves his draft. */
  const send = (text: string, typed = false) => {
    const message = text.trim();
    if (!message || busy) return;
    const pointed = mentions.filter((m, i) => message.includes(`@${m.name}`) && mentions.findIndex((x) => x.kind === m.kind && x.id === m.id) === i);
    force.current = true; // what he sends, and its reply, he wants to see
    chat.ask({ message, ...(context ? { item: context.id, title: context.title } : {}), ...(pointed.length ? { mentions: pointed } : {}) });
    if (typed) setDraft(() => ({ input: "", mentions: [] }));
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
  // Only the log scrolls, never the page under a floating tutor.
  useLayoutEffect(() => {
    const el = log.current;
    if (!el) return;
    const atEnd = force.current || !turns.length || el.scrollTop + el.clientHeight >= end.current - 24;
    force.current = false;
    if (atEnd) toEnd();
    else if (el.scrollHeight > end.current + 1) setBelow(true); // grew below him, not a change higher up (+ Card)
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
      <div
        className="tutor-turns"
        aria-live="polite"
        ref={log}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) toEnd();
        }}
      >
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
            <p className="ask-me">{lit?.turn === t.id ? <Evidence answer={t.message} quote={lit.quote} /> : marked(t.message, t.mentions ?? [])}</p>
            <div className="ask-ai">
              <Sparkle className="ask-mark" size={14} aria-hidden="true" />
              <div className="ask-text">
                {t.error ? (
                  <p className="err">
                    {t.error}{" "}
                    <button className="link" onClick={() => chat.retry(t.id)}>Try again</button>
                  </p>
                ) : t.reply === undefined && t.partial ? (
                  // Its [n] markers wait for the citations, which come with the whole reply.
                  <Answer text={t.partial.replace(/\s?\[\d*$|\s?\[\d+\](?!\()/g, "")} citations={[]} onOpen={onOpen} onLink={chat.openLink} />
                ) : t.reply === undefined ? (
                  // What it is doing, as far as the stream says (D146): his sources come first (D137), a web search
                  // is reported as it starts and ends, and after one the reply is written from what it found.
                  <Working stage={t.searching ? "search" : t.searched ? "write" : "read"} label={t.searching ? "Searching the web…" : t.searched ? "Writing…" : "Reading your sources…"} slow={t.searching ? "A search takes about 10 seconds." : "A reply takes about 10 seconds."} />
                ) : (
                  <>
                    <div data-reply={t.id}>
                      <Answer text={t.reply} citations={t.citations ?? []} onOpen={onOpen} onLink={chat.openLink} general={t.general} steps={t.steps} id={t.id} onSteps={() => field.current?.focus()} />
                    </div>
                    {t.exercise?.cases?.length === 2 && (
                      <Cases cases={t.exercise.cases} open={last} onSend={(text) => send(text)} />
                    )}
                    {!!t.marks?.length && (
                      <ul className="quiz-points tutor-points" aria-label="Key points">
                        {t.marks.map((m, j) => {
                          const show = () => setLit(m.quote ? { turn: t.id, quote: m.quote } : null);
                          const hide = () => setLit((l) => (l?.turn === t.id ? null : l));
                          return (
                            <li
                              key={j}
                              className={m.covered ? "got" : "missed"}
                              tabIndex={0}
                              aria-label={m.covered ? `Got: ${m.point}${m.quote ? `, from “${m.quote}”` : ""}` : `Missed: ${m.point}`}
                              onMouseEnter={show}
                              onMouseLeave={hide}
                              onFocus={show}
                              onBlur={hide}
                            >
                              <span className="quiz-mark" aria-hidden="true">{m.covered ? <Check size={14} weight="bold" /> : <Circle size={14} weight="bold" />}</span>
                              <span className="quiz-point">{m.point}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {((last && (t.hint || (t.exercise && t.item))) || (t.card && (firstSource(t.citations) ?? t.item))) && (
                      <div className="tutor-acts">
                        {last && t.hint && <button onClick={() => send("Show me")}>Show me</button>}
                        {last && t.exercise && t.item && (
                          <Hint text="Source hidden · send it back" keys="finish">
                            <button onClick={() => onWrite({ heading: t.exercise!.heading, prompts: t.exercise!.prompts }, { id: t.item!, title: t.title ?? "" })}>Write it in your note</button>
                          </Hint>
                        )}
                        {t.card && (firstSource(t.citations) ?? t.item) && (
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
        {picked && (() => {
          const t = turns.find((x) => x.id === picked.turn);
          const item = firstSource(t?.citations) ?? t?.item;
          const done = () => (document.getSelection()?.removeAllRanges(), setPicked(null));
          return (
            <div className={`tutor-sel${picked.below ? " below" : ""}`} role="toolbar" aria-label="Selected words" style={{ left: picked.x, top: picked.y }} onMouseDown={(e) => e.preventDefault()}>
              <Hint text="The tutor writes it as a card to keep">
                <button onClick={() => { send(`Make a card from this: “${picked.text}”`); done(); }}>
                  <Plus size={12} aria-hidden="true" />Card
                </button>
              </Hint>
              {item && (
                <Hint text={`Quote it in the note on ${t?.title || "its source"}`}>
                  <button onClick={() => { void chat.quote(item, picked.text); done(); }}>Into note</button>
                </Hint>
              )}
            </div>
          );
        })()}
        {/* The log's foot: keeps the last turn (or the starters) a gap above the @ list. */}
        <div />
        {below && (
          <button className="tutor-down" onClick={toEnd}>
            <ArrowDown size={12} aria-hidden="true" />
            New reply
          </button>
        )}
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
        {(context || !!carry.length) && (
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
            {carry.map((m) => (
              <span key={m.kind + m.id} className="tutor-chip">
                <span className="tutor-chip-title">@{m.name}</span>
                <Hint text={m.kind === "skill" ? "Leave this skill out" : "Leave this source out"}>
                  <button aria-label={`Leave “${m.name}” out`} onClick={() => { chat.drop(m); field.current?.focus(); }}>
                    <X size={10} aria-hidden="true" />
                  </button>
                </Hint>
              </span>
            ))}
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
                send(input, true);
              }
            }}
          />
          <button className="ask-send" aria-label="Send" disabled={!input.trim() || busy} onClick={() => send(input, true)}>
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

const citeName = (c: AnyCitation) => ("url" in c ? siteName(c.site) : c.title);

/** One run of citations as a pill named for its first source, "+1" for each more; its card on hover
 *  says where each is and quotes it, and a click opens it. Every source is also under Sources. */
function Pill({ run, open }: { run: AnyCitation[]; open: (c: AnyCitation) => void }) {
  return (
    <Tooltip.Root delayDuration={150}>
      <Tooltip.Trigger asChild onFocus={onlyTabbed}>
        <button className="cite" aria-label={run.map((c) => `Source ${c.n}: ${"url" in c ? (c.title ? `${c.title} (${c.site})` : c.site) : c.title}`).join("; ")} onClick={() => open(run[0]!)}>
          <span className="cite-name">{citeName(run[0]!)}</span>
          {run.length > 1 && <span className="cite-more">+{run.length - 1}</span>}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="cite-card" side="top" align="start" sideOffset={6} collisionPadding={8}>
          {run.map((c) => (
            <button key={c.n} tabIndex={-1} onClick={() => open(c)}>
              <span className="cite-where">{"url" in c ? c.site : c.heading ? `Your source › ${c.heading}` : "Your source"}</span>
              {c.title && <span className="cite-title">{c.title}</span>}
              <span className="cite-quote">{c.text}</span>
            </button>
          ))}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/** A reply in Markdown, cited as ChatGPT's desktop app cites: each run of [n] markers one small pill
 *  named for its source ("britannica", "How spaced repetition works", "+1" for a second), its passage or
 *  page on hover, opened on click (his source at the quote, a page in the browser). The full list waits
 *  behind "Sources" under the reply. A reply from general knowledge says so. */
function Answer({ text, citations, general, onOpen, onLink, steps, id, onSteps }: { text: string; citations: AnyCitation[]; general?: boolean; onOpen: (item: string, at: string) => void; onLink: (url: string) => void; steps?: string[]; id?: string; onSteps?: () => void }) {
  const [listed, setListed] = useState(false);
  const opener = useRef({ onOpen, onLink });
  opener.current = { onOpen, onLink };
  const open = (c: AnyCitation) => ("url" in c ? opener.current.onLink(c.url) : opener.current.onOpen(c.item, `q:${c.start}:${c.end}`));
  // Made once per set of citations, so a re-render (a keystroke, a streaming reply) doesn't remount the pills and close an open card.
  const components = useMemo(() => ({
    a: ({ href, children }: { href?: string; children?: ReactNode }) => {
      if (!href?.startsWith("#cite-")) return <span>{children}</span>;
      const nums = href.slice(6).split(",");
      const run = nums.map((n) => citations.find((x) => x.n === Number(n))).filter((c): c is AnyCitation => !!c);
      return run.length ? <Pill run={run} open={open} /> : <span>{nums.map((n) => `[${n}]`).join("")}</span>;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [citations]);
  return (
    <>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {citeRuns(text)}
      </ReactMarkdown>
      {!!steps?.length && id && (
        <Steps id={id} steps={steps} onDone={onSteps}>
          {(s) => (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
              {citeRuns(s)}
            </ReactMarkdown>
          )}
        </Steps>
      )}
      {general && <p className="tutor-general">Not from your sources</p>}
      {!!citations.length && (
        <button className="tutor-sources" aria-expanded={listed} onClick={() => setListed(!listed)}>
          Sources
        </button>
      )}
      {listed && (
        <ol className="library-sources">
          {citations.map((c) => (
            <li key={c.n}>
              <button onClick={() => open(c)}>
                <span className="library-src">
                  <span className="library-title">
                    {/* A page leads with its site, so a long title can't hide that it is from the web (Perplexity). */}
                    {"url" in c && <span className="sub">{c.site}{c.title && " · "}</span>}
                    {c.title}
                    {!("url" in c) && c.heading && <span className="sub"> › {c.heading}</span>}
                  </span>
                  <span className="library-quote">{c.text}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

/** How many steps of each worked answer he has shown, so closing the tutor or moving around keeps his place. */
const stepsShown = new Map<string, number>();

/** A worked answer one step at a time (D142, after assistant-ui's math block): the first shows, Next step
 *  shows the one after, and the hover asks him to work it out first, so he explains each move to himself
 *  before he reads it (faded worked examples; self-explanation). */
function Steps({ id, steps, onDone, children }: { id: string; steps: string[]; onDone?: () => void; children: (step: string) => ReactNode }) {
  const [n, setN] = useState(() => Math.min(stepsShown.get(id) ?? 1, steps.length));
  const list = useRef<HTMLOListElement>(null);
  const shown = useRef(false);
  const next = () => {
    const k = n + 1;
    stepsShown.set(id, k);
    shown.current = true;
    setN(k);
    // The button goes with the last step: the field takes the focus, for what he wants to ask next.
    if (k === steps.length) onDone?.();
  };
  // The step he just showed scrolls into view inside the log only, never the page under a floating tutor,
  // and only when he asked for it (not when the tutor reopens on a worked answer).
  useLayoutEffect(() => {
    if (!shown.current) return;
    shown.current = false;
    const step = list.current?.lastElementChild;
    if (step) reveal(step);
  }, [n]);
  return (
    <>
      {/* Where he is in the working (D150): the steps shown are short marks, the current one a bar, the rest
          dots, so he knows how many moves are left; a shown mark scrolls back to its step. */}
      <div className="step-track" role="group" aria-label={`Step ${n} of ${steps.length}`}>
        {steps.map((_, i) =>
          i < n ? (
            <button key={i} className={i === n - 1 ? "now" : undefined} aria-label={`Step ${i + 1}`} aria-current={i === n - 1 ? "step" : undefined} onClick={() => { const li = list.current?.children[i]; if (li) reveal(li); }} />
          ) : (
            <i key={i} />
          ),
        )}
      </div>
      <ol className="tutor-steps" ref={list}>
        {steps.slice(0, n).map((s, i) => (
          <li key={i}>{children(s)}</li>
        ))}
      </ol>
      {n < steps.length && (
        <div className="tutor-acts">
          <Hint text="Work out the next step yourself first">
            <button onClick={next}>Next step</button>
          </Hint>
        </div>
      )}
    </>
  );
}

/** Scrolls a step into view inside the log only, never the page under a floating tutor. */
function reveal(step: Element) {
  const box = step.closest(".tutor-turns");
  if (!box) return;
  const s = step.getBoundingClientRect(), b = box.getBoundingClientRect();
  if (s.top < b.top) box.scrollTop -= b.top - s.top;
  else if (s.bottom > b.bottom) box.scrollTop += s.bottom - b.bottom;
}

/** The reply the mole says until he opens the tutor or waves it off (D159). */
export function useUnheard(turns: TutorTurn[], open: boolean) {
  const asked = useRef(new Set<string>());
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const t = landedClosed(turns, asked.current, open);
    if (open) setId(null);
    else if (t) setId(t.id);
  }, [turns, open]);
  // Gone with its thread (New chat), or sent again (Try again) and waiting: nothing to say.
  const said = useMemo(() => {
    const t = id ? turns.find((x) => x.id === id) : undefined;
    return (t && (t.reply !== undefined || t.error) && firstWords(t)) || null;
  }, [id, turns]);
  // The mole thinks while a reply is being written with the tutor closed, and is pleased when one lands (D169).
  const thinking = !open && turns.some((t) => t.reply === undefined && t.error === undefined);
  const failed = !!(id && turns.find((x) => x.id === id)?.error);
  return { said, failed, thinking, hush: () => setId(null) };
}


/** A tell apart's two cases side by side (D163, after assistant-ui's comparison card): comparing two cases
 *  teaches the difference when they are seen together, so each sits in its own column, A and B, with a line
 *  under it for which idea fits and what decides it. Enter in A goes to B; Enter in B sends both as one
 *  answer ("A: … B: …"); ⇧Enter is a new line. The chat field still takes an answer written any other way.
 *  Once he has answered (`open` false) the cases stay, without their lines. */
function Cases({ cases, open, onSend }: { cases: string[]; open: boolean; onSend: (text: string) => void }) {
  const [said, setSaid] = useState(["", ""]);
  const second = useRef<HTMLTextAreaElement>(null);
  const answer = said.map((x, i) => (x.trim() ? `${"AB"[i]}: ${x.trim()}` : "")).filter(Boolean).join("\n");
  return (
    <div className="tutor-cases">
      {cases.map((c, i) => (
        <section key={i} className="tutor-case" aria-label={`Case ${"AB"[i]}`}>
          <span className="tutor-case-tag" aria-hidden="true">{"AB"[i]}</span>
          <p>{c}</p>
          {open && (
            <Grow
              ref={i ? second : undefined}
              rows={1}
              className="field"
              aria-label={`Case ${"AB"[i]}: which idea fits, and what decides it`}
              placeholder="Which idea fits, and why…"
              value={said[i]}
              onChange={(e) => { const v = e.target.value; setSaid((s) => s.map((x, j) => (j === i ? v : x))); }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
                e.preventDefault();
                if (!i) return second.current?.focus();
                if (answer) onSend(answer);
              }}
            />
          )}
        </section>
      ))}
    </div>
  );
}

/** The tutor's button (D160, after Notion AI's bubble at the bottom right): the mole, where the floating tutor
 *  opens. A reply that landed while it was closed comes out of it as a speech bubble (D159, after Cult UI's
 *  speech bubble): a click opens the tutor at it. */
/** The mole comes out of its hole once a launch, not each time the tutor closes (⌘J is a 100-times-a-day key). */
let peeked = false;

export function TutorBubble({ onOpen, said = null, failed = false, thinking = false, onHush }: { onOpen: () => void; said?: string | null; failed?: boolean; thinking?: boolean; onHush?: () => void }) {
  const [look, setLook] = useState(false);
  // Out of its hole once a launch; thinking while a reply is written; a hop when one lands, a jolt for an error.
  const [first] = useState<Mood>(() => (peeked ? "idle" : ((peeked = true), "peek")));
  const mood: Mood = thinking ? "thinking" : said ? (failed ? "surprised" : "happy") : first;
  const mole = useRef<HTMLButtonElement>(null);
  return (
    <>
      {said && (
        <div className="mole-says">
          <Hint text="Open the tutor" keys="tutor" side="top">
            <button className="mole-says-text" onClick={onOpen}>{said}</button>
          </Hint>
          <Hint text="Dismiss" side="top">
            <button className="icon-btn mole-says-x" aria-label="Dismiss the reply" onClick={(e) => (onHush?.(), e.detail === 0 && mole.current?.focus())}>
              <X size={10} aria-hidden="true" />
            </button>
          </Hint>
          {/* The tail, a stair of 3px steps pointing at the mole: the one pixel part, since it says who is speaking. */}
          <svg className="mole-says-tail" width="9" height="15" viewBox="0 0 9 15" aria-hidden="true">
            <path d="M0 0h3v3h3v3h3v3h-3v3h-3v3h-3z" />
          </svg>
        </div>
      )}
      <Hint text="Tutor" keys="tutor" side={said ? "top" : "left"}>
        <button
          ref={mole}
          className="tutor-bubble"
          aria-label="Open the tutor"
          onClick={onOpen}
          onPointerEnter={() => setLook(true)}
          onPointerLeave={() => setLook(false)}
          onFocus={() => setLook(true)}
          onBlur={() => setLook(false)}
        >
          <Mole mood={mood} cue={said} look={look || !!said} />
        </button>
      </Hint>
    </>
  );
}
