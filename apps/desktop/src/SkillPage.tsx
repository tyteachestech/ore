import { CaretRight, Collapse, Expand, Info as InfoIcon, Plus, Target, X } from "./icons";
import { PixelBook, PixelNote, PixelQuestion, PixelTry } from "./PixelIcon";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Grow } from "./Grow";
import { useSplit } from "./split";
import type { LinkTarget, NoteEditorHandle } from "./editor/NoteEditor";
import * as Popover from "@radix-ui/react-popover";
import { IconPicker, SkillIcon } from "./IconPicker";
import { is, isNotes, label, useKeymap } from "./keys";
import { LinkedFrom, NoteBody, useNotes } from "./Notes";
import { FindBar, onceFound } from "./Find";
import { Hint } from "./Hint";
import { Working } from "./Working";
import { MoreButton, WithMenu, type MenuAction } from "./Menu";
import { Gem, gemHint, GemRing, NearGoal, type GemKind } from "./Gem";
import { levelProgress, ore, opt, type Question, type Research, type Skill, type SkillStats, type Try } from "./ore";
import { AnswerBox, AskQuestion, announce, typedQuestion, useQuestionEdits } from "./Questions";
import { SkillChip, SkillName } from "./Skills";
import { Roll } from "./Roll";
import { errorText, load, save, useFocusWhileMounted, type Notify } from "./util";

type Props = {
  skill: Skill;
  /** The list's title: which sources it shows (To read, Done, Archived). */
  view: ReactNode;
  targets: LinkTarget[];
  blocked: boolean;
  onOpen: (t: Omit<LinkTarget, "title">) => void;
  /** Opens a question's source at its passage. */
  onQuestion: (q: Pick<Question, "item" | "id">) => void;
  /** Opens a source that answers, or may answer, a question (D75). */
  onOpenSource: (id: string) => void;
  /** After a source was added from a question's research, or a question was added. */
  onAdded: () => void;
  /** Opens the add-source panel, filing into this skill. */
  onAddSource: () => void;
  /** After the icon or color changed from the badge. */
  onSkillChanged: () => void;
  notify: Notify;
  /** A ⌘K match in the skill note: the note opens scrolled to these words, the find bar on them; `onFound` once it has. */
  findInNote?: string;
  onFound: () => void;
  /** The skill's sources, in the view the title names. */
  children: ReactNode;
};


/** An ⓘ that explains on hover, so the page itself carries no instructions. */
function Info({ text }: { text: string }) {
  return (
    <Hint text={text}>
      <button className="info" aria-label={text}>
        <InfoIcon size={15} aria-hidden="true" />
      </button>
    </Hint>
  );
}

/** A skill's page (D46): the D23 stats as chips in the header, then two equal columns that each
 *  scroll on their own, so a long note (D41) never buries his questions (D47) and sources. */
export function SkillPage({ skill, view, targets, blocked, onOpen, onQuestion, onOpenSource, onAdded, onAddSource, onSkillChanged, notify, findInNote, onFound, children }: Props) {
  const ref = useMemo(() => ({ skill: skill.id }), [skill.id]);
  const notes = useNotes(ref, notify);
  const keys = useKeymap();
  // The note column keeps where it was scrolled, like the reader (back from a source, or a relaunch).
  const noteCol = useRef<HTMLDivElement>(null);
  const noteScroll = `ore.skillnote.scroll.${skill.id}`;
  const loaded = notes.text !== null;
  /** True while the saved place is being put back: those scrolls aren't his. */
  const restoring = useRef(false);
  useEffect(() => {
    const el = noteCol.current;
    const want = Number(load(noteScroll) ?? 0);
    // A ⌘K match decides where the note is instead.
    if (!loaded || !el || !(want > 0) || findInNote) return;
    // The editor lays out over a few frames: set it until the column is tall enough to hold it.
    let n = 0;
    let raf = 0;
    const stop = () => void (restoring.current = false);
    const put = () => {
      el.scrollTop = want;
      if (Math.abs(el.scrollTop - want) > 1 && ++n < 30) raf = requestAnimationFrame(put);
      else raf = requestAnimationFrame(stop);
    };
    restoring.current = true;
    // He scrolls first: his place wins.
    el.addEventListener("wheel", () => (cancelAnimationFrame(raf), stop()), { once: true });
    put();
    return () => (cancelAnimationFrame(raf), stop());
  }, [loaded, noteScroll]);
  const editor = useRef<NoteEditorHandle>(null);
  // The closed-book popup: the D41 warm-up, or a try at his goal (D101).
  const [recalling, setRecalling] = useState<"warm" | "goal" | null>(null);
  // The warm-up stays while he writes his first lines (it would vanish at the first keystroke, as if
  // typing had closed something); it goes once a recall is saved, or on the next visit.
  const [warmUp, setWarmUp] = useState<boolean | null>(null);
  useEffect(() => {
    if (warmUp === null && notes.text !== null) setWarmUp(notes.text === "");
  }, [warmUp, notes.text]);
  const append = useCallback(
    async (t: string, heading: string) => {
      const ok = await notes.append(t, heading);
      if (ok) setWarmUp(false);
      return ok;
    },
    [notes],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (blocked || recalling) return;
      if (isNotes(e)) {
        e.preventDefault();
        editor.current?.focus();
      } else if (is(e, "filter")) {
        // Find on the page, as in a source (D81): the note, the sources and the questions.
        e.preventDefault();
        setFind((f) => ({ ...f, open: true, focus: f.focus + 1, note: false }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const split = useSplit("ore.skill-split");
  const stats = useStats(skill.id);
  const pageRef = useRef<HTMLDivElement>(null);
  /** `note`: opened by ⌘K on a match in the skill note, so it searches only there. */
  const [find, setFind] = useState({ open: false, query: "", focus: 0, note: false });
  useEffect(() => {
    if (!loaded || !findInNote) return;
    const query = findInNote;
    return onceFound(() => noteCol.current?.querySelector<HTMLElement>(".skill-note"), query, () => {
      setFind((f) => ({ open: true, query, focus: f.focus + 1, note: true }));
      onFound();
    });
  }, [loaded, findInNote]);
  // The note across the whole page for a wide table, until he clicks again; not kept (Tyler, option C).
  const [wide, setWide] = useState(false);
  return (
    <div className="skill-page" data-color={skill.color} ref={pageRef}>
      {find.open && (
        <FindBar
          roots={() => [find.note ? noteCol.current?.querySelector<HTMLElement>(".skill-note") : pageRef.current]}
          within={pageRef.current}
          query={find.query}
          onQuery={(query) => setFind((f) => ({ ...f, query }))}
          focus={find.focus}
          onClose={() => setFind((f) => ({ ...f, open: false }))}
        />
      )}
      <header className="skill-hero">
        <BadgePicker skill={skill} onChanged={onSkillChanged} notify={notify} />
        <div className="skill-title">
          <SkillName skill={skill} onRenamed={onSkillChanged} notify={notify} />
          <Goal skill={skill} lastTry={lastGoalTry(notes.text)} onTry={() => setRecalling("goal")} onChanged={onSkillChanged} notify={notify} />
        </div>
        {stats && stats.strength.solid + stats.strength.growing + stats.strength.new > 0 && <Strength s={stats} color={skill.color} />}
      </header>

      <div className={`skill-cols${split.dragging ? " dragging" : ""}${wide ? " wide" : ""}`} style={{ gridTemplateColumns: wide ? "minmax(0, 1fr)" : `minmax(0, ${1 - split.side}fr) 20px minmax(0, ${split.side}fr)` }}>
        <div className="skill-col" ref={noteCol} onScroll={(e) => !restoring.current && save(noteScroll, String(Math.round(e.currentTarget.scrollTop)))}>
          <section className="skill-card skill-note" data-tone="note">
            <div className="card-head">
              <span className="card-title"><PixelNote className="card-icon" size={12} aria-hidden="true" /><h2>Your note</h2></span>
              <Hint text={wide ? "Back beside sources and questions" : "Widen the note, for wide tables"}>
                <button className="icon-btn note-widen" aria-label={wide ? "Narrow your note" : "Widen your note"} aria-pressed={wide} onClick={() => setWide((w) => !w)}>
                  {wide ? <Collapse size={14} aria-hidden="true" /> : <Expand size={14} aria-hidden="true" />}
                </button>
              </Hint>
              <Hint text="Add a block">
                <button className="icon-btn" aria-label="Add a block to your note" onClick={() => editor.current?.addBlock()}>
                  <Plus size={14} weight="bold" aria-hidden="true" />
                </button>
              </Hint>
            </div>
            {warmUp && (
              <div className="warm-up">
                <b>What do you already know about {skill.name}?</b>
                <Info text="Warm up from memory, without looking. It becomes your note’s first draft, and recalling first makes it stick." />
                <button className="pill-btn" onClick={() => setRecalling("warm")}>
                  Start
                </button>
              </div>
            )}
            <NoteBody notes={notes} editorRef={editor} targets={targets} onOpen={onOpen} placeholder={notes.text === "" ? "Or just start writing. Type / for blocks." : "Type / for blocks, [[ to link."} />
            <LinkedFrom target={ref} onOpen={onOpen} />
          </section>
        </div>

        <Hint text="Drag to resize · double-click to reset">
          <div className="col-divider" role="separator" aria-orientation="vertical" aria-label="Resize columns" {...split.divider} />
        </Hint>

        <div className="skill-col side" aria-label={`${skill.name} questions and sources`}>
          <Fold
            id="sources"
            title="Sources"
            icon={PixelBook}
            tone="read"
            menu={view}
            actions={[{ id: "add", label: "Add source", hint: label(keys.add), run: onAddSource }]}
            action={
              <Hint text={`Add a source to ${skill.name}`} keys="add">
                <button className="icon-btn" aria-label={`Add a source to ${skill.name}`} onClick={onAddSource}>
                  <Plus size={14} weight="bold" aria-hidden="true" />
                </button>
              </Hint>
            }
          >
            {children}
          </Fold>
          <Tries skill={skill.id} onPassage={onQuestion} notify={notify} />
          <Questions skill={skill.id} onQuestion={onQuestion} onOpenSource={onOpenSource} onAdded={onAdded} notify={notify} />
        </div>
      </div>
      {recalling && <SkillRecall skill={skill} goal={recalling === "goal" ? skill.goal : undefined} blocked={blocked} append={append} notify={notify} onClose={() => setRecalling(null)} />}
    </div>
  );
}

/** The skill's badge opens the icon picker in place, as a Notion page icon does; picks save at once. */
function BadgePicker({ skill, onChanged, notify }: { skill: Skill; onChanged: () => void; notify: Notify }) {
  const [open, setOpen] = useState(false);
  const set = async (key: "icon" | "color", value: string, undoable = true) => {
    const before = skill[key] ?? "";
    try {
      await ore("skills", "set", skill.id, opt(key, value));
      onChanged();
      if (undoable && before !== value) notify(`Changed the ${key === "icon" ? "icon" : "colour"} of ${skill.name}`, "quiet", () => void set(key, before, false), () => void set(key, value, false));
    } catch (e) {
      notify(errorText(e), "error");
    }
  };
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Hint text={skill.icon ? "Change icon" : "Add icon"}>
        <Popover.Trigger asChild>
          <button className={`skill-badge${skill.color ? " tinted" : ""}`} aria-label={skill.icon ? "Change icon" : "Add icon"}>
            {skill.icon ? <SkillIcon icon={skill.icon} color={skill.color} /> : <span className="initial">{initial(skill.name)}</span>}
          </button>
        </Popover.Trigger>
      </Hint>
      <Popover.Portal>
        <Popover.Content className="popover" side="bottom" align="start" sideOffset={6} collisionPadding={12}>
          <IconPicker
            value={skill.icon}
            color={skill.color ?? ""}
            onPick={(icon) => {
              void set("icon", icon);
              setOpen(false);
            }}
            onColor={(c) => void set("color", c)}
            onRemove={() => {
              void set("icon", "");
              setOpen(false);
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** The name's first character as he sees it: a whole emoji (👩‍👩‍👧, 🇪🇸), not its first code point. */
function initial(name: string): string {
  return [...new Intl.Segmenter().segment(name)][0]?.segment ?? "";
}

const FOLDS = "ore.skill-folds";
function foldedIds(): string[] {
  try {
    const v: unknown = JSON.parse(load(FOLDS) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** A card that folds to its header, Notion toggle-heading style; the summary stays
 *  in the header so a folded section still says what is in it. Folds are remembered for every skill. */
/** A card that folds. With `menu`, the menu is its title (the caret alone folds it), as a button
 *  can't hold another. */
/** `actions`: the card's right-click menu (its create action), which unfolds it first, as its + does. */
function Fold({ id, title, icon: I, tone, summary, summaryFolded = false, menu, action, actions = [], children }: { id: string; title: string; icon: typeof PixelBook; tone: string; summary?: ReactNode; summaryFolded?: boolean; menu?: ReactNode; action?: ReactNode; actions?: MenuAction[]; children: ReactNode }) {
  const [open, setOpen] = useState(() => !foldedIds().includes(id));
  const toggle = () => {
    const next = !open;
    setOpen(next);
    const rest = foldedIds().filter((x) => x !== id);
    save(FOLDS, JSON.stringify(next ? rest : [...rest, id]));
  };
  return (
    <WithMenu actions={actions.map((a) => ({ ...a, run: () => (open || toggle(), a.run()) }))}>
    <section className="skill-card fold" data-tone={tone}>
      <div className="card-head">
        <button className={`fold-head${menu ? " caret-only" : ""}`} aria-expanded={open} aria-label={menu ? `${open ? "Fold" : "Unfold"} ${title}` : undefined} onClick={toggle}>
          <CaretRight className="caret" size={10} weight="bold" aria-hidden="true" />
          {!menu && <span className="card-title"><I className="card-icon" size={12} aria-hidden="true" /><h2>{title}</h2></span>}
          {summary && !(summaryFolded && open) && <span className="fold-sum">{summary}</span>}
        </button>
        {menu && <span className="card-title"><I className="card-icon" size={12} aria-hidden="true" />{menu}</span>}
        {menu && <span className="fold-fill" />}
        {/* Its + adds into the body, so a folded card opens first, or the new row would be hidden. */}
        {action && <span className="fold-action" onClickCapture={() => !open && toggle()}>{action}</span>}
      </div>
      {open && <div className="fold-body">{children}</div>}
    </section>
    </WithMenu>
  );
}



/** `ore stats --skill`: the D23 numbers, strength and its growth line, loaded once for the page. */
function useStats(skill: string): SkillStats | null {
  const [s, setS] = useState<SkillStats | null>(null);
  useEffect(() => {
    let live = true;
    setS(null);
    ore<SkillStats[]>("stats", opt("skill", skill)).then(
      (r) => live && setS(r[0] ?? null),
      () => live && setS(null),
    );
    return () => {
      live = false;
    };
  }, [skill]);
  return s;
}

/** His goal for the skill (D101), under its name in place of the why (D63): one thing he could show
 *  he can do. Click to write, Enter saves, Esc or clicking away keeps what was there. Try it opens the
 *  closed-book recall with the goal as its prompt; each try is saved, dated, in the skill note. */
function Goal({ skill, lastTry, onTry, onChanged, notify }: { skill: Skill; lastTry: string | null; onTry: () => void; onChanged: () => void; notify: Notify }) {
  const [draft, setDraft] = useState<string | null>(null);
  const save = async () => {
    const v = (draft ?? "").trim();
    setDraft(null);
    const before = skill.goal ?? "";
    if (v === before) return;
    const to = (goal: string) => () => void ore("skills", "set", skill.id, opt("goal", goal)).then(onChanged, (e) => notify(errorText(e), "error"));
    try {
      await ore("skills", "set", skill.id, opt("goal", v));
      onChanged();
      // Emptying the field throws the goal away: say so, with Undo.
      if (!v) notify(`Cleared the goal for ${skill.name}`, "info", to(before), to(""));
      else notify(`Goal for ${skill.name}`, "quiet", to(before), to(v));
    } catch (e) {
      // The field opens again with what he typed, so a failed save loses nothing.
      setDraft(v);
      notify(errorText(e), "error");
    }
  };
  if (draft !== null)
    return (
      <input
        className="skill-goal editing"
        autoFocus
        value={draft}
        maxLength={140}
        placeholder="Something you could show, like “Explain X to a beginner”"
        aria-label={`Your goal for ${skill.name}`}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") void save();
          if (e.key === "Escape") setDraft(null);
        }}
      />
    );
  return (
    <div className="skill-goal-row">
      <Hint text={skill.goal ? "Edit your goal" : "A goal you could show gives this skill a target"}>
        <button className={`skill-goal${skill.goal ? "" : " empty"}`} onClick={() => setDraft(skill.goal ?? "")}>
          <Target size={15} weight="bold" aria-hidden="true" />
          <span>{skill.goal || "What could you show you can do?"}</span>
        </button>
      </Hint>
      {skill.goal && (
        <Hint text={lastTry ? `Do it from memory · last try ${shortDate(lastTry)}` : "Do it from memory; your try goes in your note"}>
          <button className="pill-btn small" onClick={onTry}>
            Try it
          </button>
        </Hint>
      )}
    </div>
  );
}

const GOAL_TRY = /^## Goal try, (\d{4}-\d{2}-\d{2})\s*$/gm;
/** The date of his latest try at the goal, from the skill note's "Goal try, <date>" headings. */
function lastGoalTry(text: string | null): string | null {
  const all = [...(text ?? "").matchAll(GOAL_TRY)].map((m) => m[1]!).sort();
  return all.at(-1) ?? null;
}
function shortDate(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EXPLAIN_SHOWN = 5;

/** Strength (D62, D63): solid memories and the level they reached, the split into solid, growing and
 *  new, what he forgot to win back, the 12-week growth line, and the ideas he can now explain. */
function Strength({ s, color }: { s: SkillStats; color?: string }) {
  const k = s.strength;
  const [all, setAll] = useState(false);
  const p = levelProgress(k);
  // One vocabulary with the header: the gem states, then cards not reviewed yet as empty slots.
  const legend: [GemKind, number, string][] = [
    ["cut", k.solid, "Cut: you'd still recall these three weeks from now"],
    ["ready", k.ready, "Glowing: cut if you recall them at their next review"],
    ["dull", k.win_back, "Cracked: cut once, then missed. Review to polish them again"],
    ["rough", k.growing - k.ready - k.win_back, "Rough: reviewed, not near solid yet"],
    ["empty", k.new, "Not reviewed yet"],
  ];
  const shown = all ? k.explain : k.explain.slice(0, EXPLAIN_SHOWN);
  return (
    // Strength is said once, in the header: the number, one line, the level meter. The split, growth and what
    // he can now explain open from it (D62: reward what he remembers, never volume).
    <Popover.Root>
      {/* D90: the gem being cut (a ring to the next level, the level on it), the count, and the near goal. Words only on hover. */}
      <Hint text={gemHint(k, p.line)}>
        <Popover.Trigger asChild>
          <button className="hero-strength" aria-label={gemHint(k, p.line)}>
            <GemRing k={k} size={56} badge />
            <span className="strength-side">
              <span className="strength-big"><Roll id={`solid:${s.skill}`} value={k.solid} /></span>
              <NearGoal k={k} />
            </span>
          </button>
        </Popover.Trigger>
      </Hint>
      <Popover.Portal>
        <Popover.Content className="popover strength-pop" data-color={color} side="bottom" align="end" sideOffset={6} collisionPadding={12}>
          <div className="strength">
            <div className="strength-legend">
              {legend.map(([kind, n, why]) =>
                n > 0 ? (
                  <Hint key={kind} text={why}>
                    <span>
                      <Gem kind={kind} size={16} />
                      {n}
                    </span>
                  </Hint>
                ) : null,
              )}
            </div>
            <Growth points={s.growth} />
            {k.explain.length > 0 && (
              <div className="strength-explain">
                <h3>You can now explain</h3>
                <ul>
                  {shown.map((e) => (
                    <li key={e.id}>{e.question}</li>
                  ))}
                </ul>
                {k.explain.length > EXPLAIN_SHOWN && (
                  <button className="answered-toggle" aria-expanded={all} onClick={() => setAll(!all)}>
                    {all ? "Show fewer" : `Show all ${k.explain.length}`}
                  </button>
                )}
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Solid memories over the last 12 weeks: an area line with the latest point marked; nothing at
 *  all until two weeks differ, so a new skill shows no flat line (D23: no trend at small n). */
function Growth({ points }: { points: SkillStats["growth"] }) {
  if (points.length < 2 || new Set(points.map((p) => p.solid)).size < 2) return null;
  const w = 300;
  const h = 56;
  const max = Math.max(...points.map((p) => p.solid), 1);
  const xy = points.map((p, i) => [(i / (points.length - 1)) * (w - 4) + 2, h - 3 - (p.solid / max) * (h - 8)] as const);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = xy.at(-1)!;
  const first = points[0]!;
  return (
    <figure className="strength-growth">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`Solid memories over 12 weeks: ${first.solid} to ${points.at(-1)!.solid}`}>
        <polygon points={`2,${h - 3} ${line} ${w - 2},${h - 3}`} className="area" />
        <polyline points={line} className="stroke" vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="dot" style={{ left: `${(lx / w) * 100}%`, top: ly }} aria-hidden="true" />
      <figcaption>
        <span>12 weeks ago</span>
        <span>Now</span>
      </figcaption>
    </figure>
  );
}

/** Questions (D47, D75): his questions under this skill. Answer writes toward the answer in place;
 *  Begin research runs D17 research, and a source added from it is linked to the question. Nothing
 *  counts or badges them (D23). */
function Questions({ skill, onQuestion, onOpenSource, onAdded, notify }: { skill: string; onQuestion: (q: Question) => void; onOpenSource: (id: string) => void; onAdded: () => void; notify: Notify }) {
  const [qs, setQs] = useState<Question[] | null>(null);
  const [showAnswered, setShowAnswered] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [asking, setAsking] = useState(false);
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    let live = true;
    ore<Question[]>("questions", opt("skill", skill)).then(
      (r) => live && setQs(r),
      (e) => live && notify(errorText(e), "error"),
    );
    return () => {
      live = false;
    };
  }, [skill, notify, version]);

  const { setStatus, remove } = useQuestionEdits(setQs, notify);

  const open = (qs ?? []).filter((q) => q.status !== "done");
  const answered = (qs ?? []).filter((q) => q.status === "done");
  return (
    <Fold
      id="questions"
      title="Questions"
      icon={PixelQuestion}
      tone="question"
      summary={open.length ? `${open.length} open` : null}
      summaryFolded
      actions={[{ id: "ask", label: "Add a question", run: () => setAsking(true) }]}
      action={
        <Hint text="Add a question">
          <button className="icon-btn" aria-label="Add a question" onClick={() => setAsking(true)}>
            <Plus size={14} weight="bold" aria-hidden="true" />
          </button>
        </Hint>
      }
    >
      {asking && (
        <AskQuestion
          skills={[skill]}
          notify={notify}
          onDone={(added) => {
            setAsking(false);
            if (added) {
              reload();
              onAdded();
            }
          }}
        />
      )}
      {qs && !qs.length && !asking && <p className="quiet">No questions yet. Add one with +, or highlight a passage as a question while you read.</p>}
      {(showAll ? open : open.slice(0, QUESTION_CAP)).map((q) => (
        <QuestionRow key={q.id} q={q} skill={skill} onQuestion={onQuestion} onOpenSource={onOpenSource} onAdded={onAdded} onStatus={setStatus} onRemove={remove} onChanged={reload} notify={notify} />
      ))}
      {open.length > QUESTION_CAP && (
        <button className="answered-toggle" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer" : `Show all ${open.length}`}
        </button>
      )}
      {answered.length > 0 && (
        <>
          <button className="answered-toggle" aria-expanded={showAnswered} onClick={() => setShowAnswered(!showAnswered)}>
            {showAnswered ? "Hide answered" : `Answered (${answered.length})`}
          </button>
          {showAnswered &&
            answered.map((q) => <QuestionRow key={q.id} q={q} skill={skill} onQuestion={onQuestion} onOpenSource={onOpenSource} onAdded={onAdded} onStatus={setStatus} onRemove={remove} onChanged={reload} notify={notify} />)}
        </>
      )}
    </Fold>
  );
}

/** To try (D127): techniques from his reading he planned to try on his own work. Checking one off asks
 *  how it went, in one line; that reflection becomes one Explain card at the next enrich. Hidden until
 *  he marks the first one (the reader's popup is where they start), and nothing counts them (D23). */
function Tries({ skill, onPassage, notify }: { skill: string; onPassage: (t: Pick<Question, "item" | "id">) => void; notify: Notify }) {
  const [ts, setTs] = useState<Try[] | null>(null);
  const [showTried, setShowTried] = useState(false);
  const [reflecting, setReflecting] = useState<string | null>(null);
  // Tries he checked off while here stay in view under Tried, so what he wrote doesn't vanish (Things, Todoist).
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    ore<Try[]>("tries", opt("skill", skill)).then(
      (r) => live && setTs(r),
      (e) => live && notify(errorText(e), "error"),
    );
    return () => {
      live = false;
    };
  }, [skill, notify]);

  const put = (id: string, patch: Partial<Try>) => setTs((l) => l && l.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  type State = { status: "open" | "done"; reflection?: string };
  /** One write: checked off (with how it went, or none) or back to try; rolled back with an error toast. */
  const write = async (t: Try, from: State, to: State) => {
    put(t.id, to);
    try {
      // Back to try clears the reflection, so a state with an older one is two writes.
      if (to.status === "open" || (from.reflection && !to.reflection)) await ore("tried", t.id, "--undo");
      if (to.status === "done") await ore("tried", t.id, ...(to.reflection ? [opt("text", to.reflection)] : []));
      return true;
    } catch (e) {
      put(t.id, from);
      notify(errorText(e), "error");
      return false;
    }
  };
  const state = (t: Try): State => ({ status: t.status === "done" ? "done" : "open", reflection: t.reflection });
  const change = async (t: Try, to: State, msg: string) => {
    const was = state(t);
    if (!(await write(t, was, to))) return false;
    notify(msg, "quiet", () => void write(t, to, was), () => void write(t, was, to));
    return true;
  };
  const check = async (t: Try) => {
    const done = t.status !== "done";
    if (!(await change(t, done ? { status: "done" } : { status: "open" }, done ? "Tried" : "Back to try"))) return;
    setReflecting(done ? t.id : null);
    if (done) setRecent((r) => [...r, t.id]);
  };
  const reflect = (t: Try, text: string) => {
    setReflecting(null);
    if (text && text !== t.reflection) void change(t, { status: "done", reflection: text }, "Saved how it went · a card comes from it");
  };
  const remove = async (t: Try) => {
    let at = -1;
    const back = () => setTs((l) => l && [...l.slice(0, at < 0 ? l.length : at), t, ...l.slice(at < 0 ? l.length : at)]);
    setTs((l) => {
      at = l ? l.findIndex((x) => x.id === t.id) : -1;
      return l && l.filter((x) => x.id !== t.id);
    });
    try {
      await ore("annotate", t.id, "--status", "deleted");
    } catch (e) {
      back();
      return notify(errorText(e), "error");
    }
    notify(
      "Removed",
      "info",
      () => (back(), void ore("annotate", t.id, "--status", t.status).catch((e) => notify(errorText(e), "error"))),
      () => (setTs((l) => l && l.filter((x) => x.id !== t.id)), void ore("annotate", t.id, "--status", "deleted").catch((e) => notify(errorText(e), "error"))),
    );
  };

  if (!ts?.length) return null;
  const open = ts.filter((t) => t.status !== "done");
  const tried = ts.filter((t) => t.status === "done");
  const row = (t: Try) => (
    <TryRow key={t.id} t={t} reflecting={reflecting === t.id} onCheck={() => void check(t)} onReflect={(on) => setReflecting(on ? t.id : null)} onSave={(text) => reflect(t, text)} onPassage={() => onPassage(t)} onRemove={() => void remove(t)} />
  );
  return (
    <Fold id="tries" title="To try" icon={PixelTry} tone="apply" summary={open.length ? `${open.length} to try` : null} summaryFolded>
      {open.map(row)}
      {!open.length && <p className="quiet">All tried. Mark a technique with Try it (4) while you read to plan the next one.</p>}
      {tried.length > 0 && (
        <>
          <button className="answered-toggle" aria-expanded={showTried} onClick={() => setShowTried(!showTried)}>
            {showTried ? "Hide tried" : `Tried (${tried.length})`}
          </button>
          {tried.filter((t) => showTried || recent.includes(t.id)).map(row)}
        </>
      )}
    </Fold>
  );
}

/** Unsent reflections, per try, kept when the field closes. */
const reflections = new Map<string, string>();

function TryRow({ t, reflecting, onCheck, onReflect, onSave, onPassage, onRemove }: {
  t: Try;
  reflecting: boolean;
  onCheck: () => void;
  onReflect: (on: boolean) => void;
  onSave: (text: string) => void;
  onPassage: () => void;
  onRemove: () => void;
}) {
  const done = t.status === "done";
  const actions: MenuAction[] = [
    { id: "open", label: "Open passage", run: onPassage },
    { id: "check", label: done ? "Not tried yet" : "Mark tried", run: onCheck },
    ...(done ? [{ id: "reflect", label: t.reflection ? "Edit how it went…" : "How did it go…", run: () => onReflect(true) }] : []),
    { id: "delete", label: "Remove", danger: true, divider: true, run: onRemove },
  ];
  return (
    <WithMenu actions={actions}>
      <div className={`try${done ? " done" : ""}`}>
        <Hint text={done ? "Not tried yet" : "Mark tried"}>
          <button className="try-check" role="checkbox" aria-checked={done} aria-label={done ? "Not tried yet" : "Mark tried"} onClick={onCheck}>
            {done && <PixelTry size={12} aria-hidden="true" />}
          </button>
        </Hint>
        <Hint text="Open this passage">
          <button className="question-quote try-quote" onClick={onPassage}>
            {t.note && <span className="note">{t.note}</span>}
            <span className="exact">“{t.exact.replace(/\s+/g, " ").trim()}”</span>
            <span className="from">{t.item_title}</span>
          </button>
        </Hint>
        {done && t.reflection && !reflecting && (
          <Hint text="Edit how it went">
            <button className="try-reflection" onClick={() => onReflect(true)}>{t.reflection}</button>
          </Hint>
        )}
        <div className="question-actions">
          <MoreButton label="Try actions" actions={actions} />
        </div>
        {reflecting && <Reflect id={t.id} initial={t.reflection ?? ""} onSave={onSave} onClose={() => onReflect(false)} />}
      </div>
    </WithMenu>
  );
}

/** "How did it go?" in one field (Linear's inline edit): Enter saves, Esc closes and keeps the draft;
 *  a blur keeps the field and what he typed. */
function Reflect({ id, initial, onSave, onClose }: { id: string; initial: string; onSave: (text: string) => void; onClose: () => void }) {
  const [v, setV] = useState(() => reflections.get(id) ?? initial);
  const field = useRef<HTMLTextAreaElement>(null);
  useFocusWhileMounted(field);
  return (
    <div className="try-reflect">
      <Grow
        ref={field}
        className="field"
        aria-label="How did it go?"
        placeholder="How did it go? What would you change next time?"
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          reflections.set(id, e.target.value);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            reflections.delete(id);
            onSave(v.trim());
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
      />
    </div>
  );
}

/** Open questions shown before "Show all", so Sources stays in view below them. */
const QUESTION_CAP = 5;

function QuestionRow({ q, skill, onQuestion, onOpenSource, onAdded, onStatus, onRemove, onChanged, notify }: {
  q: Question;
  skill: string;
  onQuestion: (q: Question) => void;
  onOpenSource: (id: string) => void;
  onAdded: () => void;
  onStatus: (q: Question, status: "open" | "done") => void;
  onRemove: (q: Question) => void;
  /** After his answer changed: the list reloads. */
  onChanged: () => void;
  notify: Notify;
}) {
  const [found, setFound] = useState<Research["sources"] | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  /** Suggested sources being added now: each shows it is working, and a second click does nothing. */
  const [adding, setAdding] = useState<string[]>([]);
  const [answering, setAnswering] = useState(false);
  const done = q.status === "done";
  const exact = q.exact.replace(/\s+/g, " ").trim();
  const own = typedQuestion(q);
  // Sources that may answer it and that he hasn't written from yet (D75).
  const credited = new Set(q.answers.map((c) => c.item));
  const maybe = q.matches.filter((m) => !credited.has(m.item));

  const research = async () => {
    setBusy(true);
    try {
      setFound((await ore<Research>("research", q.id)).sources);
    } catch (e) {
      notify(errorText(e, "find sources"), "error");
    }
    setBusy(false);
  };

  // D17: one click adds one source, filed under this skill and linked to the question; never auto-added.
  const add = async (url: string) => {
    if (adding.includes(url)) return;
    setAdding((a) => [...a, url]);
    try {
      const r = await ore<{ id: string; title: string; kept?: boolean }>("add", url, opt("skill", skill), opt("for", q.id));
      setAdded((a) => [...a, url]);
      // As adding from the bar: Undo archives what was just added, ⇧⌘Z brings it back.
      const keep = (on: boolean) =>
        void ore("archive", r.id, ...(on ? ["--undo"] : [])).then(
          () => (setAdded((a) => (on ? [...a, url] : a.filter((u) => u !== url))), onAdded(), onChanged()),
          (e) => notify(errorText(e), "error"),
        );
      // One already in the library stays: only what this added can be taken back.
      if (r.kept) notify(`“${r.title}” is already in your library`);
      else notify(`Added “${r.title}”`, "info", () => keep(false), () => keep(true));
      onAdded();
      onChanged();
    } catch (e) {
      notify(errorText(e), "error");
    }
    setAdding((a) => a.filter((u) => u !== url));
  };

  // The same actions as the hover buttons, in the ⋯ and right-click menus; delete last (AGENTS.md).
  const actions: MenuAction[] = [
    ...(own ? [] : [{ id: "open", label: "Open passage", run: () => onQuestion(q) }]),
    ...(done ? [] : [
      { id: "answer", label: "Answer…", run: () => setAnswering(true) },
      { id: "research", label: "Begin research", run: () => void research() },
    ]),
    { id: "status", label: done ? "Reopen" : "Mark answered", run: () => onStatus(q, done ? "open" : "done") },
    { id: "delete", label: "Delete question", danger: true, divider: true, run: () => onRemove(q) },
  ];

  return (
    <WithMenu actions={actions}>
    <div className={`question${done ? " done" : ""}`}>
      {own ? (
        <button className="question-quote" onClick={() => !done && setAnswering(!answering)} aria-expanded={answering}>
          <PixelQuestion className="question-mark" aria-hidden="true" />
          <span className="exact">{exact}</span>
        </button>
      ) : (
        <Hint text="Open this passage">
          <button className="question-quote" onClick={() => onQuestion(q)}>
            <PixelQuestion className="question-mark" aria-hidden="true" />
            <span className="exact">“{exact}”</span>
            {q.note && <span className="note">{q.note}</span>}
            <span className="from">{q.item_title}</span>
          </button>
        </Hint>
      )}
      {!answering && q.answers.length > 0 && (
        <ul className="question-answers">
          {q.answers.map((c) => (
            <li key={c.ts}>
              {c.text}
              {c.item && c.item_title && (
                <>
                  {" · "}
                  <button className="question-src" onClick={() => onOpenSource(c.item!)}>{c.item_title}</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {maybe.length > 0 && !done && (
        <div className="question-maybe">
          {maybe.map((m) => (
            <Hint key={m.item} text={m.quote ? `May answer it: “${m.quote}”` : "Added for this question"}>
              <button className="question-src chip" onClick={() => onOpenSource(m.item)}>
                {m.quote ? "May answer it" : "To read"} · {m.title}
              </button>
            </Hint>
          ))}
        </div>
      )}
      <div className="question-actions">
        {!done && (
          <>
            <button onClick={() => setAnswering(!answering)} aria-expanded={answering}>
              Answer
            </button>
            <button onClick={() => void research()} disabled={busy}>
              {busy ? <Working label="Finding sources…" /> : "Begin research"}
            </button>
          </>
        )}
        {done && <button onClick={() => onStatus(q, "open")}>Reopen</button>}
        <MoreButton label="Question actions" actions={actions} />
      </div>
      {answering && (
        <AnswerBox
          q={q}
          notify={notify}
          onClose={() => setAnswering(false)}
          onSaved={(saved, how) => {
            if (how !== "contribution") setAnswering(false);
            announce(q, saved, how, notify, onChanged);
            onChanged();
          }}
        />
      )}
      {found && !found.length && <p className="quiet">No sources found for this question. Begin research again to try once more.</p>}
      {found && found.length > 0 && (
        <ul className="found">
          {found.map((s) => (
            <li key={s.url}>
              <div>
                <span className="title">{s.title}</span> <span className="sub">{s.site} · {s.type}</span>
                <div className="why">{s.why}</div>
              </div>
              {adding.includes(s.url) ? (
                <Working label="Adding…" slow="A long page or video takes a minute." />
              ) : (
                <button onClick={() => void add(s.url)} disabled={added.includes(s.url)}>
                  {added.includes(s.url) ? "Added" : "Add"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
    </WithMenu>
  );
}

const recallDrafts = new Map<string, string>();

/** D41: a closed-book recall across what he has read, saved as the skill note's first draft. A popup
 *  over the page, which is blurred out of reading range while he writes (D34.4); Close, Esc or a click
 *  outside goes back (D34.5), and a click outside never drops text he has written. */
function SkillRecall({ skill, goal, blocked, append, notify, onClose }: { skill: Skill; goal?: string; blocked: boolean; append: (t: string, heading: string) => Promise<boolean>; notify: Notify; onClose: () => void }) {
  const keys = useKeymap();
  const key = goal ? `${skill.id} goal` : skill.id;
  // Esc or Close keeps what he wrote as a draft for this skill until it is saved (as the finish quiz does).
  const [text, setTextState] = useState(() => recallDrafts.get(key) ?? "");
  const setText = (t: string) => {
    setTextState(t);
    recallDrafts.set(key, t);
  };
  const [saving, setSaving] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  useFocusWhileMounted(field);

  const save = async () => {
    const t = text.trim();
    if (!t || saving) return;
    setSaving(true);
    if (await append(t, goal ? `Goal try, ${localDay()}` : "Recall")) {
      recallDrafts.delete(key);
      if (goal) notify("Try saved in your note, under today’s date");
      onClose();
    }
    else setSaving(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (blocked) return;
      if (is(e, "finish")) {
        e.preventDefault();
        void save();
      } else if (e.key === "Escape" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="overlay recall" data-color={skill.color} onMouseDown={(e) => e.target === e.currentTarget && !text.trim() && onClose()}>
      <section className="panel skill-recall" role="dialog" aria-modal="true" aria-labelledby="skill-recall-title">
        <header className="skill-recall-head">
          <SkillChip skill={skill} />
          <span className="quiet">{goal ? "Your goal, from memory" : "Warm up from memory"}</span>
          <button className="skill-recall-close" aria-label="Close" onClick={onClose}>
            <X size={14} weight="bold" aria-hidden="true" />
          </button>
        </header>
        <h2 id="skill-recall-title">{goal ?? `What do you know about ${skill.name}, across what you’ve read?`}</h2>
        <Grow ref={field} className="field" value={text} onChange={(e) => setText(e.target.value)} readOnly={saving} spellCheck />
        <div className="skill-recall-foot">
          <button onClick={onClose}>
            Cancel <kbd>Esc</kbd>
          </button>
          <button className="pill-btn" onClick={() => void save()} disabled={!text.trim() || saving}>
            {saving ? "Saving…" : goal ? "Save try" : "Save as first draft"} <kbd>{label(keys.finish)}</kbd>
          </button>
        </div>
      </section>
    </div>
  );
}
