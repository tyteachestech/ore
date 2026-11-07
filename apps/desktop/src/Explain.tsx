import { Article, Book, BookOpenText, Check, Compass, GraduationCap, Headphones, PlayCircle, Scroll, Sparkle } from "./icons";
import { forwardRef, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { ICON } from "./Collected";
import { Hint } from "./Hint";
import { is } from "./keys";
import { againText, askAbout, entry } from "./lookup";
import { ore, opt, type Research, type Skill } from "./ore";
import { SkillChip, SkillPicker } from "./Skills";
import { errorText } from "./util";
import { Working } from "./Working";

// Side quests (D97): a term he doesn't know. Explain gives the gist in place so he can keep reading
// (glosses), and says whether the rest of the source leans on it (then learning it now pays). Learn
// this makes it his question and offers sources to learn it from: Later files the picked ones under
// To read, Read now also opens the first, with a way back to this spot. AI suggests, he picks (D17).

type Source = Research["sources"][number];
type Gloss = { here: string; general: string };

const KIND = { video: PlayCircle, docs: BookOpenText, paper: Scroll, book: Book, course: GraduationCap, podcast: Headphones } as const;
const kindIcon = (type: string) => KIND[type as keyof typeof KIND] ?? Article;
/** The AI's `code` marks as code; the rest as plain text. */
const inline = (t: string) => t.split(/`([^`]+)`/).map((x, i) => (i % 2 ? <code key={i}>{x}</code> : x));
/** The site a URL points at, or the URL as written when it can't be read (it comes from the AI). */
const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};
const sub = (s: Source) => [s.site, s.type === "article" ? null : s.type, s.minutes ? `${Math.round(s.minutes)} min` : null].filter(Boolean).join(" · ");

type ExplainProps = {
  word: string;
  /** The source and where the term sits in it, for the AI's paragraph. */
  item: string;
  start?: number;
  /** The macOS dictionary's entry: undefined while it loads, null when it has none (D83). */
  dict?: string | null;
  again: { sections: string[]; later: boolean };
  top: number;
  left: number;
  below: boolean;
  skills: Skill[];
  /** The open source's skills: what the picked sources are filed under unless he changes it. */
  sourceSkills: string[];
  onCreateSkill: (name: string) => Promise<Skill | undefined>;
  onMakeCard: () => void;
  /** Makes the term a question with this text (or retitles it); its id, or null when that failed. */
  onAsk: (question: string, id: string | null) => Promise<string | null>;
  /** Learn this opened: the popover is taller now, so the reader may place it again. */
  onLearning: () => void;
  onAdd: (urls: string[], skills: string[], question: string, now: boolean) => void;
  onClose: () => void;
};

export const Explain = forwardRef<HTMLDivElement, ExplainProps>(function Explain(p, ref) {
  const [gloss, setGloss] = useState<Gloss | { error: string } | undefined>(undefined);
  const [learn, setLearn] = useState<{ id: string | null; question: string; saved: string } | null>(null);
  const [found, setFound] = useState<Source[] | { error: string } | undefined>(undefined);
  const [picked, setPicked] = useState<string[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [into, setInto] = useState(p.sourceSkills);
  const [tries, setTries] = useState({ gloss: 0, found: 0 });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const looked = p.dict ? entry(p.dict) : null;
  const again = againText(p.again);

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, [!!learn]);

  useEffect(() => {
    let live = true;
    setGloss(undefined);
    ore<(Gloss & { ai: unknown }) | null>("explain", p.item, opt("exact", p.word), ...(p.start === undefined ? [] : [opt("start", String(p.start))])).then(
      (r) => live && setGloss(r ? { here: r.here, general: r.general } : { error: "Explaining needs AI." }),
      (e) => live && setGloss({ error: errorText(e) }),
    );
    return () => {
      live = false;
    };
  }, [p.item, p.word, p.start, tries.gloss]);

  // Sources for the question, once it exists; a retry asks again and never adds anything.
  useEffect(() => {
    if (!learn?.id) return;
    let live = true;
    setFound(undefined);
    ore<Research | null>("research", learn.id).then(
      (r) => {
        if (!live) return;
        if (!r) return setFound({ error: "Finding sources needs AI." });
        setFound(r.sources);
        setPicked(r.sources.slice(0, 1).map((s) => s.url));
      },
      (e) => live && setFound({ error: errorText(e, "find sources") }),
    );
    return () => {
      live = false;
    };
  }, [learn?.id, tries.found]);

  const startLearning = async () => {
    const question = askAbout(p.word);
    setLearn({ id: null, question, saved: question });
    p.onLearning();
    const id = await p.onAsk(question, null);
    if (id) setLearn((l) => l && { ...l, id });
    else setFound({ error: "Couldn’t save the question." });
  };

  /** His edit to the question is saved when he leaves the field with ↵ or goes on, never half-typed on blur.
   *  Null when that save failed: his words stay in the field, unsaved, for another try. */
  const commitQuestion = async () => {
    if (!learn) return learn;
    const q = learn.question.replace(/\s+/g, " ").trim();
    if (!q || q === learn.saved || !learn.id) return { ...learn, question: learn.saved };
    if (!(await p.onAsk(q, learn.id))) return null;
    const next = { ...learn, question: q, saved: q };
    setLearn(next);
    return next;
  };

  const go = async (now: boolean) => {
    const l = await commitQuestion();
    if (!l) return;
    const sources = Array.isArray(found) ? found.filter((s) => picked.includes(s.url)) : [];
    if (now && !sources.length) return;
    p.onClose();
    if (l?.id && sources.length) p.onAdd(sources.map((s) => s.url), into, l.id, now);
  };

  const toggle = (url: string) => setPicked((x) => (x.includes(url) ? x.filter((u) => u !== url) : [...x, url]));

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const inField = (e.target as HTMLElement).tagName === "INPUT";
    // ↵ on a focused button is that button's (Make card, Retry, Later…), not the panel's shortcut.
    const onButton = (e.target as HTMLElement).tagName === "BUTTON";
    const plain = !e.metaKey && !e.ctrlKey && !e.altKey;
    const take = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (e.key === "Escape") {
      take();
      if (inField && learn) {
        setLearn({ ...learn, question: learn.saved });
        rootRef.current?.focus();
      } else p.onClose();
      return;
    }
    if (!learn) {
      if (inField) return;
      if (plain && e.key === "Enter") {
        if (onButton) return void e.stopPropagation();
        take();
        void startLearning();
      } else if (is(e.nativeEvent, "card")) {
        take();
        p.onMakeCard();
      }
      return;
    }
    if (inField) {
      if (e.key === "Enter" && plain) {
        take();
        void commitQuestion();
        rootRef.current?.focus();
      } else e.stopPropagation();
      return;
    }
    const list = Array.isArray(found) ? found : [];
    if (e.key === "Enter" && e.metaKey) {
      take();
      void go(false);
    } else if (e.key === "Enter" && plain && onButton) {
      e.stopPropagation();
    } else if (e.key === "Enter" && plain) {
      take();
      void go(true);
    } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && plain && list.length) {
      take();
      setActive((a) => (a === null ? (e.key === "ArrowDown" ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, a + (e.key === "ArrowDown" ? 1 : -1)))));
    } else if (e.key === " " && plain && active !== null && list[active]) {
      take();
      toggle(list[active]!.url);
    } else if (plain && e.key !== "Tab") e.stopPropagation(); // the reader's keys wait until the list closes
  };

  const CardIcon = ICON.card;
  const list = Array.isArray(found) ? found : null;
  const peek = list && active !== null ? list[active] : null;
  const row = listRef.current?.children[active ?? -1] as HTMLElement | undefined;
  // The peek sits beside the list (Raycast's detail pane), on the side with room in the window. In a
  // portal, so the reader's edge and the side panel don't cut it off.
  const box = rootRef.current?.getBoundingClientRect();
  const at = row?.getBoundingClientRect();
  const peekAt = box && at ? { top: at.top - 4, left: box.right + 316 <= innerWidth ? box.right + 8 : Math.max(8, box.left - 308) } : null;

  return (
    <div
      ref={(el) => {
        rootRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
      }}
      tabIndex={-1}
      className={`popup lookup explain${learn ? " learning" : ""}`}
      role="dialog"
      aria-label={learn ? `Learn ${p.word}` : `Explain ${p.word}`}
      style={{ top: p.top, left: p.left, transform: p.below ? "translateX(-50%)" : "translate(-50%, -100%)" }}
      onKeyDown={onKeyDown}
    >
      {!learn ? (
        <>
          <div className="lookup-head">
            <span className="lookup-word">{looked?.head || p.word}</span>
            {looked?.pron && <span className="lookup-pron">{looked.pron}</span>}
          </div>
          <div className="ex-sec">
            <Sparkle size={11} aria-hidden="true" /> Here
          </div>
          {gloss === undefined ? (
            <p className="loading lookup-body"><Working label="Explaining…" slow="This can take about 20 seconds." /></p>
          ) : "error" in gloss ? (
            <p className="lookup-body none">
              {gloss.error}{" "}
              <button className="qp-link" onClick={() => setTries((t) => ({ ...t, gloss: t.gloss + 1 }))}>
                Retry
              </button>
            </p>
          ) : (
            <p className="lookup-body">{inline(gloss.here)}</p>
          )}
          {/* The Mac's dictionary when it has the word (instant, offline), else the AI's general sense. */}
          {(looked || (gloss && "general" in gloss)) && (
            <>
              <div className="ex-sec">In general</div>
              <p className={`lookup-body${looked ? " ex-dict" : ""}`}>{looked ? looked.body : inline((gloss as Gloss).general)}</p>
            </>
          )}
          {again && <p className="ex-again">{again}</p>}
          <div className="ex-actions">
            <Hint text="Card this word, with its sentence" keys="card" side="bottom">
              <button className="ex-btn" onClick={p.onMakeCard}>
                <CardIcon size={14} className="card" aria-hidden="true" />
                Make card
              </button>
            </Hint>
            <Hint text={<>Make it a question, with sources to learn it <kbd>↵</kbd></>} side="bottom">
              <button className="ex-btn" onClick={() => void startLearning()}>
                <Compass size={14} className="question" aria-hidden="true" />
                Learn this
              </button>
            </Hint>
          </div>
        </>
      ) : (
        <>
          <label className="ex-q">
            <span className="qp-icon" aria-hidden="true">?</span>
            <input aria-label="Your question" value={learn.question} onChange={(e) => setLearn({ ...learn, question: e.target.value })} />
          </label>
          <div className="ex-sec ex-into">
            <span>
              <Sparkle size={11} aria-hidden="true" /> Sources to learn it
            </span>
            <span className="ex-dest">
              into
              <SkillPicker skills={p.skills} value={into} title="the sources" onChange={(next) => setInto(next)} onCreate={p.onCreateSkill}>
                {into.length ? into.map((id) => <SkillChip key={id} skill={p.skills.find((k) => k.id === id) ?? { id, name: id }} />) : <span className="chip">No skill</span>}
              </SkillPicker>
            </span>
          </div>
          {found === undefined ? (
            <p className="loading lookup-body"><Working label="Finding sources…">It takes up to a minute. Your question is saved, so you can keep reading.</Working></p>
          ) : "error" in found ? (
            <p className="lookup-body none">
              {found.error} Your question is saved under Questions.{" "}
              {learn.id && (
                <button className="qp-link" onClick={() => setTries((t) => ({ ...t, found: t.found + 1 }))}>
                  Retry
                </button>
              )}
            </p>
          ) : (
            <ul className="ex-list" ref={listRef} role="listbox" aria-multiselectable="true" aria-label="Sources to learn it" onMouseLeave={() => setActive(null)}>
              {found.map((s, i) => {
                const Kind = kindIcon(s.type);
                const on = picked.includes(s.url);
                return (
                  <li key={s.url} role="option" aria-selected={on} className={active === i ? "active" : undefined} onMouseEnter={() => setActive(i)} onClick={() => toggle(s.url)}>
                    <span className={`ex-box${on ? " on" : ""}`} aria-hidden="true">
                      {on && <Check size={11} weight="bold" />}
                    </span>
                    <Kind size={15} className="ex-kind" aria-hidden="true" />
                    <span className="ex-text">
                      <span className="ex-title">{s.title}</span>
                      <span className="ex-sub">{sub(s)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="ex-actions end">
            <Hint text={<>Add the picked sources to To read and keep reading <kbd>⌘↵</kbd></>} side="bottom">
              <button className="ex-btn ghost" onClick={() => void go(false)}>
                Later
              </button>
            </Hint>
            <Hint text={<>Add them and open the first, with a way back here <kbd>↵</kbd></>} side="bottom">
              <button className="ex-btn primary" disabled={!list || !picked.length} onClick={() => void go(true)}>
                Read now
              </button>
            </Hint>
          </div>
          {peek &&
            peekAt &&
            createPortal(
              <div className="popover ex-peek" style={peekAt} aria-hidden="true">
                <div className="peek-title">{peek.title}</div>
                <div className="ex-sub">{[sub(peek), host(peek.url)].join(" · ")}</div>
                <p className="ex-why">{peek.why}</p>
              </div>,
              document.body,
            )}
        </>
      )}
    </div>
  );
});
