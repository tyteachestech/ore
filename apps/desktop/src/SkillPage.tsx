import { Archive, CaretRight, Check, Collapse, Expand, Plus, Target, X } from "./icons";
import { ranked } from "./match";
import { HeadSearch } from "./HeadSearch";
import { ImportanceIcon, levelOf } from "./importance";
import { PixelBook, PixelNote, PixelQuestion, PixelTry } from "./PixelIcon";
import { HeadTab, HeadTabs } from "./HeadTabs";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { Grow } from "./Grow";
import { useSplit } from "./split";
import type { LinkTarget, NoteEditorHandle } from "./editor/NoteEditor";
import * as Popover from "@radix-ui/react-popover";
import { focusFilter, hasIcon, IconPicker, SkillIcon } from "./IconPicker";
import { is, isNotes, label, useKeymap, keepKeysIn } from "./keys";
import { clickBelow, LinkedFrom, NoteBody, useNotes } from "./Notes";
import { FindBar, onceFound } from "./Find";
import { escTaken, Hint } from "./Hint";
import { Working } from "./Working";
import { MoreButton, WithMenu, type MenuAction } from "./Menu";
import { Gem, GEM_WORD, gemHint, GemRing, NearGoal, type GemKind } from "./Gem";
import { depthText, levelProgress, ore, opt, PHONE, type Question, type Research, type Skill, type SkillStats } from "./ore";
import { AnswerBox, AskQuestion, announce, questionText, typedQuestion, useQuestionEdits } from "./Questions";
import { SkillChip, SkillName } from "./Skills";
import { Roll } from "./Roll";
import { errorText, focusQuietly, load, save, usable, useFocusBack, useFocusWhileMounted, useLibraryChanges, type Notify } from "./util";
import { Trap } from "./Trap";
import { Forge, Tools, TryingNow, TryPage, useTries, type Sub } from "./Forge";
import { passageText } from "./text";
import { ExerciseText } from "./ExerciseText";
import { askDig, DigPopup, useDigAsked } from "./Dig";

type Props = {
  skill: Skill;
  /** The list's title: which sources it shows (To read, Done, Archived). */
  view: ReactNode;
  /** The sources' search (D203): what is typed narrows the list below; `keys` moves from the field into the rows. */
  search: { value: string; set: (v: string) => void; keys: (e: ReactKeyboardEvent<HTMLInputElement>) => void };
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
  /** Its importance levels to pick (D173), and Bring back once it is archived. */
  importance: MenuAction[];
  onBringBack: () => void;
  notify: Notify;
  /** A ⌘K match in the skill note: the note opens scrolled to these words, the find bar on them; `onFound` once it has. */
  findInNote?: string;
  onFound: () => void;
  /** The skill's sources, in the view the title names. */
  children: ReactNode;
  /** Where the page is (D322): itself, its Forge, or one try's page. */
  sub: Sub;
  onSub: (s: Sub) => void;
  /** The iPhone: its note is a screen of its own (Tyler 2026-11-06, B), so the page is one column with this row in the note's place. */
  noteRow?: ReactNode;
};


/** A skill's page (D46): the D23 stats as chips in the header, then two equal columns that each
 *  scroll on their own, so a long note (D41) never buries his questions (D47) and sources. */
export function SkillPage({ skill, view, search, targets, blocked, onOpen, onQuestion, onOpenSource, onAdded, onAddSource, onSkillChanged, importance, onBringBack, notify, findInNote, onFound, children, noteRow, sub, onSub }: Props) {
  const tries = useTries(skill.id, notify);
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
  // The closed-book popup: the D41 warm-up, or the Dig at his goal (D325).
  const [recalling, setRecalling] = useState<"warm" | "goal" | null>(null);
  // A session that ended by offering this skill's dig opens it here.
  const digAsked = useDigAsked();
  useEffect(() => {
    if (!digAsked) return;
    askDig(null);
    if (digAsked === skill.id && skill.goal) setRecalling("goal");
  }, [digAsked, skill.id, skill.goal]);
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

  const [searching, setSearching] = useState(false);
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
  const side = (
    <div className="skill-col side" aria-label={`${skill.name} questions and sources`}>
      <TryingNow
        tries={tries}
        onSub={onSub}
        head={(action, actions, body) => (
          <Fold id="tries" title="Trying now" icon={PixelTry} tone="apply" action={action} actions={actions}>
            {body}
          </Fold>
        )}
      />
      <Fold
        id="sources"
        title="Sources"
        icon={PixelBook}
        tone="read"
        menu={view}
        actions={[{ id: "search", label: "Search sources", run: () => setSearching(true) }, { id: "add", label: "Add source", hint: label(keys.add), run: onAddSource }]}
        action={<>
          <HeadSearch label="Search sources" value={search.value} onChange={search.set} open={searching} setOpen={setSearching} onKeys={search.keys} />
          <Hint text={`Add a source to ${skill.name}`} keys="add">
            <button className="icon-btn" aria-label={`Add a source to ${skill.name}`} onClick={onAddSource}>
              <Plus size={14} weight="bold" aria-hidden="true" />
            </button>
          </Hint>
        </>}
      >
        {children}
      </Fold>
      <Questions skill={skill.id} onQuestion={onQuestion} onOpenSource={onOpenSource} onAdded={onAdded} notify={notify} />
    </div>
  );
  const shown = typeof sub === "string" && sub.startsWith("try:") ? tries.ts?.find((t) => t.id === sub.slice(4)) : undefined;
  // A try's page, or the Forge: also for a try that is gone (removed, or a link from before), once the tries are read.
  if (sub && (sub === "forge" || tries.ts))
    return (
      <div className="skill-page sub" data-color={skill.color}>
        {shown ? <TryPage skill={skill} t={shown} tries={tries} onSub={onSub} onPassage={onQuestion} /> : <Forge skill={skill} tries={tries} onSub={onSub} />}
      </div>
    );
  return (
    <div className="skill-page" data-color={skill.color} ref={pageRef}>
      {find.open && (
        <FindBar
          roots={() => [find.note ? noteCol.current?.querySelector<HTMLElement>(".skill-note") : pageRef.current]}
          scope={find.note ? "note" : "page"}
          within={pageRef.current}
          query={find.query}
          onQuery={(query) => setFind((f) => ({ ...f, query }))}
          focus={find.focus}
          // Closed, focus goes back to what it searched: the skill note (from a ⌘K match in it), else the page's
          // sources list, its keyboard home, as the reader's goes to its text; else the skill's name. The place stays.
          onClose={() => {
            const note = find.note;
            setFind((f) => ({ ...f, open: false }));
            const page = pageRef.current;
            const to = [note ? noteCol.current?.querySelector<HTMLElement>(".skill-note [contenteditable='true']") : null, page?.querySelector<HTMLElement>(".list"), page?.querySelector<HTMLElement>("h1.skill-name button")].find(usable);
            if (to) focusQuietly(to);
          }}
        />
      )}
      <header className="skill-hero">
        <BadgePicker skill={skill} onChanged={onSkillChanged} notify={notify} />
        <div className="skill-title">
          <div className="skill-name-row">
            <SkillName skill={skill} onRenamed={onSkillChanged} notify={notify} />
            {/* How much it matters (D173), Linear's priority bars; archived, the one thing to do is bring it back. */}
            {skill.archived ? (
              <button className="skill-unarchive" onClick={onBringBack}>
                <Archive size={16} aria-hidden="true" />
                Bring back
              </button>
            ) : (
              <MoreButton className="skill-importance" label={`Importance: ${levelOf(skill).label}`} hint={`Importance: ${levelOf(skill).label}`} icon={<ImportanceIcon skill={skill} />} actions={importance} align="start" />
            )}
          </div>
          <Goal skill={skill} lastTry={lastGoalTry(notes.text)} onTry={() => setRecalling("goal")} onChanged={onSkillChanged} notify={notify} tools={<Tools tries={tries} onSub={onSub} />} />
        </div>
        {stats && stats.strength.solid + stats.strength.growing + stats.strength.new > 0 && <Strength s={stats} color={skill.color} />}
      </header>

      {noteRow ? (
        <div className="skill-cols one">
          {noteRow}
          {side}
        </div>
      ) : (
      <div className={`skill-cols${split.dragging ? " dragging" : ""}${wide ? " wide" : ""}`} style={{ gridTemplateColumns: wide ? "minmax(0, 1fr)" : `minmax(0, ${1 - split.side}fr) 20px minmax(0, ${split.side}fr)` }}>
        <div className="skill-col" ref={noteCol} onMouseDown={clickBelow(editor)} onScroll={(e) => !restoring.current && save(noteScroll, String(Math.round(e.currentTarget.scrollTop)))}>
          <section className="skill-card skill-note" data-tone="note" onMouseDown={clickBelow(editor)}>
            <div className="card-head">
              <span className="card-title"><HeadTab icon={PixelNote} tone="note">Your note</HeadTab></span>
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
                <Hint text="Without looking. It becomes your note’s first draft, and recalling first makes it stick.">
                  <button className="warm-start" onClick={() => setRecalling("warm")}>Start</button>
                </Hint>
              </div>
            )}
            <NoteBody notes={notes} editorRef={editor} targets={targets} onOpen={onOpen} label="Skill note" placeholder={notes.text === "" ? "Or just start writing. Type / for blocks." : "Type / for blocks, [[ to link."} />
            <LinkedFrom target={ref} onOpen={onOpen} />
          </section>
        </div>

        <Hint text="Drag to resize · double-click to reset">
          <div className="col-divider" role="separator" aria-orientation="vertical" aria-label="Resize columns" {...split.divider} />
        </Hint>

        {side}
      </div>
      )}
      {recalling === "warm" && <SkillRecall skill={skill} blocked={blocked} append={append} notify={notify} onClose={() => setRecalling(null)} />}
      {recalling === "goal" && skill.goal && <DigPopup skill={skill} blocked={blocked} append={append} notify={notify} onPassage={onQuestion} onClose={() => setRecalling(null)} />}
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
      if (undoable && before !== value) notify(`Changed the ${key === "icon" ? "icon" : "colour"} of ${skill.name}`, "quiet", () => set(key, before, false), () => set(key, value, false));
    } catch (e) {
      // From the history (undo or redo): it puts the step back and says why.
      if (!undoable) throw e;
      notify(errorText(e), "error");
    }
  };
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Hint text={skill.icon ? "Change icon" : "Add icon"}>
        <Popover.Trigger asChild>
          <button className={`skill-badge${skill.color ? " tinted" : ""}`} aria-label={skill.icon ? "Change icon" : "Add icon"}>
            {hasIcon(skill.icon) ? <SkillIcon icon={skill.icon} color={skill.color} /> : <span className="initial">{initial(skill.name)}</span>}
          </button>
        </Popover.Trigger>
      </Hint>
      <Popover.Portal>
        <Popover.Content className="popover" side="bottom" align="start" sideOffset={6} collisionPadding={12} onOpenAutoFocus={focusFilter}>
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

/** A section that folds to its header (Notion's toggle heading); folds are remembered for every skill. Its
 *  title is a folder tab, or with `menu` the tabs of its views; the caret at the far right folds it. `summary`
 *  stays in the header so a folded section still says what is in it. `actions`: its right-click menu (its
 *  create action), which unfolds it first, as its + does. */
function Fold({ id, title, icon: I, tone, summary, summaryFolded = false, menu, action, actions = [], children }: { id: string; title: string; icon: typeof PixelBook; tone: string; summary?: ReactNode; summaryFolded?: boolean; menu?: ReactNode; action?: ReactNode; actions?: MenuAction[]; children: ReactNode }) {
  const [open, setOpen] = useState(() => !foldedIds().includes(id));
  const toggle = () => {
    const next = !open;
    setOpen(next);
    const rest = foldedIds().filter((x) => x !== id);
    save(FOLDS, JSON.stringify(next ? rest : [...rest, id]));
  };
  return (
    // A section's right-click menu is the Mac's. On the iPhone its actions are the buttons in its head, and the
    // menu library's own touch timer opened it over a held row's menu (F46).
    <WithMenu actions={PHONE ? [] : actions.map((a) => ({ ...a, run: () => (open || toggle(), a.run()) }))}>
    <section className="skill-card fold" data-tone={tone}>
      <div className="card-head">
        {/* Picking a view of a folded section opens it, or the pick would show nothing. */}
        <span className="card-title" onClickCapture={() => menu && !open && toggle()}>{menu ?? <HeadTab icon={I} tone={tone}>{title}</HeadTab>}</span>
        {summary && !(summaryFolded && open) ? <span className="fold-sum">{summary}</span> : <span className="fold-fill" />}
        {/* Its + adds into the body, so a folded card opens first, or the new row would be hidden. */}
        {action && <span className="fold-action" onClickCapture={() => !open && toggle()}>{action}</span>}
        {/* At the far right, past the section's actions (D226, Tyler 2026-11-12): beside the tabs it read as one more view. */}
        <Hint text={open ? "Fold" : "Unfold"}>
          <button className="fold-head caret-only" aria-expanded={open} aria-label={`${open ? "Fold" : "Unfold"} ${title}`} onClick={toggle}>
            <CaretRight className="caret" size={10} weight="bold" aria-hidden="true" />
          </button>
        </Hint>
      </div>
      {open && <div className="fold-body">{children}</div>}
    </section>
    </WithMenu>
  );
}



/** `ore stats --skill`: the D23 numbers, strength and its growth line, read again when the library changes under the
 *  open page (an exercise retired in Review over it). */
function useStats(skill: string): SkillStats | null {
  const [s, setS] = useState<SkillStats | null>(null);
  const changes = useLibraryChanges();
  useEffect(() => setS(null), [skill]);
  useEffect(() => {
    let live = true;
    ore<SkillStats[]>("stats", opt("skill", skill)).then(
      (r) => live && setS(r[0] ?? null),
      () => live && setS(null),
    );
    return () => {
      live = false;
    };
  }, [skill, changes]);
  return s;
}

/** His goal for the skill (D101), under its name in place of the why (D63): one thing he could show
 *  he can do. Click to write, Enter or clicking away saves (D211), Esc keeps what was there. Try it opens the
 *  closed-book recall with the goal as its prompt; each try is saved, dated, in the skill note. */
/** A goal's longest (D102; core checks it on write). */
const GOAL_MAX = 140;

function Goal({ skill, lastTry, onTry, onChanged, notify, tools }: { skill: Skill; lastTry: string | null; onTry: () => void; onChanged: () => void; notify: Notify; tools: ReactNode }) {
  const [draft, setDraft] = useState<string | null>(null);
  const goalRef = useRef<HTMLButtonElement>(null);
  useFocusBack(draft !== null, goalRef);
  const save = async () => {
    const v = (draft ?? "").trim();
    setDraft(null);
    const before = skill.goal ?? "";
    if (v === before) return;
    const to = (goal: string) => () => ore("skills", "set", skill.id, opt("goal", goal)).then(onChanged);
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
      // The field wraps and grows, so a long goal's start stays in view (Linear's issue title), and the letters
      // left show once the 140 (D102) are nearly used, since the field stops taking them there (F-new-goal-limit).
      <div className="skill-goal-edit">
        <Grow
          className="skill-goal editing"
          autoFocus
          onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
          value={draft}
          maxLength={GOAL_MAX}
          placeholder="Something you could show, like “Explain X to a beginner”"
          aria-label={`Your goal for ${skill.name}`}
          // One line of meaning: a pasted line break is a space.
          onChange={(e) => setDraft(e.target.value.replace(/\s*\n\s*/g, " ").slice(0, GOAL_MAX))}
          // Clicking away saves (D211); an emptied field keeps the goal, only Enter clears it.
          onBlur={() => document.hasFocus() && ((draft ?? "").trim() ? void save() : setDraft(null))}
          onKeyDown={(e) => {
            keepKeysIn(e); // ⌘Z still reaches the app history
            if (e.key === "Enter" && !e.nativeEvent.isComposing) (e.preventDefault(), void save());
            if (e.key === "Escape") setDraft(null);
          }}
        />
        {GOAL_MAX - draft.length <= 20 && (
          <span className={`skill-goal-left${draft.length >= GOAL_MAX ? " none" : ""}`} role="status" aria-label={`${GOAL_MAX - draft.length} letters left`}>
            {GOAL_MAX - draft.length}
          </span>
        )}
      </div>
    );
  return (
    <div className="skill-goal-row">
      <Hint text={skill.goal ? "Edit your goal" : "A goal you could show gives this skill a target"}>
        <button ref={goalRef} className={`skill-goal${skill.goal ? "" : " empty"}`} onClick={() => setDraft(skill.goal ?? "")}>
          <Target size={15} weight="bold" aria-hidden="true" />
          <span>{skill.goal || "What could you show you can do?"}</span>
        </button>
      </Hint>
      {skill.goal && (
        <Hint text={lastTry ? `Do it from memory · last dig ${shortDate(lastTry)}` : "Do it from memory; the mole checks it against your key points"}>
          <button className="pill-btn small" onClick={onTry}>
            Dig
          </button>
        </Hint>
      )}
      {tools}
    </div>
  );
}

const GOAL_TRY = /^## (?:Goal try|Dig), (\d{4}-\d{2}-\d{2})\s*$/gm;
/** The date of his latest dig at the goal, from the skill note's "Dig, <date>" headings ("Goal try" before D325). */
function lastGoalTry(text: string | null): string | null {
  const all = [...(text ?? "").matchAll(GOAL_TRY)].map((m) => m[1]!).sort();
  return all.at(-1) ?? null;
}
function shortDate(day: string): string {
  return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const EXPLAIN_SHOWN = 5;

/** Strength (D62, D63): solid memories and the level they reached, the split into solid, growing and
 *  new, what he forgot to win back, the 12-week growth line, and the ideas he can now explain. */
function Strength({ s, color }: { s: SkillStats; color?: string }) {
  const k = s.strength;
  const [all, setAll] = useState(false);
  const [open, setOpen] = useState(false);
  const p = levelProgress(k);
  // One vocabulary with the header: the gem states, then cards not reviewed yet as empty slots.
  const legend: [GemKind, number, string, string, { seam?: boolean; polished?: boolean }?][] = [
    ["cut", k.polished ?? 0, GEM_WORD.polished, "Polished: cut, and passed as a remix", { polished: true }],
    ["cut", k.mended ?? 0, GEM_WORD.mended, "Won back: cut, missed, and cut again", { seam: true }],
    ["cut", k.solid - (k.polished ?? 0) - (k.mended ?? 0), GEM_WORD.cut, "Cut: you'd still recall these three weeks from now"],
    ["ready", k.ready, GEM_WORD.ready, "Nearly cut: cut if you recall them at their next review"],
    ["dull", k.win_back, GEM_WORD.dull, "Missed: cut once, then missed. Review to win them back"],
    ["rough", k.growing - k.ready - k.win_back, GEM_WORD.rough, "Rough: reviewed, not near solid yet"],
    ["empty", k.new, GEM_WORD.empty, "Not reviewed yet"],
  ];
  const shown = all ? k.explain : k.explain.slice(0, EXPLAIN_SHOWN);
  return (
    // Strength is said once, in the header: the number, one line, the level meter. The split, growth and what
    // he can now explain open from it (D62: reward what he remembers, never volume).
    <Popover.Root open={open} onOpenChange={setOpen}>
      {/* D90: the gem being cut (a ring to the next level, the level on it), the count, and the near goal. Words only on hover. */}
      <Hint text={gemHint(k, p.line)}>
        <Popover.Trigger asChild>
          <button className="hero-strength" aria-label={gemHint(k, p.line)}>
            {/* The iPhone's header (D272): the rocks in the order they grow, walking into the level ring and the cut count. */}
            <span className="strength-line" aria-hidden="true">
              {([["rough", k.growing - k.ready - k.win_back], ["dull", k.win_back], ["ready", k.ready]] as const).map(([kind, n]) =>
                n > 0 ? <span key={kind} className="strength-step"><Gem kind={kind} size={18} />{n}</span> : null,
              )}
              <span className="strength-end"><GemRing k={k} size={28} />{k.solid}</span>
              <span className="strength-lv">Lv {k.level}</span>
            </span>
            <GemRing k={k} size={56} badge />
            <span className="strength-side">
              <span className="strength-big"><Roll id={`solid:${s.skill}`} value={k.solid} /></span>
              <NearGoal k={k} />
            </span>
          </button>
        </Popover.Trigger>
      </Hint>
      <Popover.Portal>
        <Popover.Content
          // The page's own keys take Esc before Radix sees it, so the breakdown closes itself (F114).
          onKeyDown={(e) => { if (e.key === "Escape" && !escTaken(e.nativeEvent)) { e.preventDefault(); setOpen(false); } }}
          aria-label="Gem breakdown" className="popover strength-pop" data-color={color} side="bottom" align="end" sideOffset={6} collisionPadding={12}>
          <div className="strength">
            <div className="strength-legend">
              {legend.map(([kind, n, word, why, look]) =>
                n > 0 ? (
                  <Hint key={why} text={why}>
                    <span role="img" aria-label={`${n} · ${why}`} tabIndex={0}>
                      <Gem kind={kind} size={18} {...look} />
                      {n.toLocaleString()} {word}
                    </span>
                  </Hint>
                ) : null,
              )}
            </div>
            {/* D197: the number that moves every session, while the cut count waits weeks. */}
            {k.depth > 0 && (
              <Hint text="How long these memories now last, added up">
                <p className="strength-depth"><b>{depthText(k.depth)}</b> deep</p>
              </Hint>
            )}
            <Growth points={s.growth} />
            {k.explain.length > 0 && (
              <div className="strength-explain">
                <h3>You can now explain</h3>
                <ul>
                  {shown.map((e) => (
                    <li key={e.id}><ExerciseText text={e.question} inline /></li>
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
  const askRef = useRef<HTMLButtonElement>(null);
  useFocusBack(asking, askRef);
  const [version, setVersion] = useState(0);
  const changes = useLibraryChanges();
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
  }, [skill, notify, version, changes]);

  const { setStatus, remove } = useQuestionEdits(setQs, notify);

  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const find = query.trim();
  /** Searched (D203): by the question first, then its source and what he has answered; answered ones show with the rest. */
  const found = useMemo(() => (find ? ranked(qs ?? [], find, (q) => [questionText(q), q.item_title, ...q.answers.map((a) => a.text)]) : (qs ?? [])), [qs, find]);
  const open = found.filter((q) => q.status !== "done");
  const answered = found.filter((q) => q.status === "done");
  /** The Answered tab is there once a question is answered; a search looks through both, so it shows one tab. */
  const byStatus = answered.length > 0 && !find;
  return (
    <Fold
      id="questions"
      title="Questions"
      icon={PixelQuestion}
      tone="question"
      summary={open.length && !find ? `${open.length} open` : null}
      summaryFolded
      menu={<HeadTabs label="Questions shown" tabs={byStatus ? QUESTION_TABS : QUESTION_TABS.slice(0, 1)} value={byStatus && showAnswered ? "answered" : "open"} onChange={(v) => setShowAnswered(v === "answered")} />}
      actions={[{ id: "search", label: "Search questions", run: () => setSearching(true) }, { id: "ask", label: "Add a question", run: () => setAsking(true) }]}
      action={<>
        <HeadSearch
          label="Search questions"
          value={query}
          onChange={setQuery}
          open={searching}
          setOpen={setSearching}
          onKeys={(e) => {
            if (e.key !== "ArrowDown" && e.key !== "Enter") return;
            e.preventDefault();
            e.currentTarget.closest(".skill-card")?.querySelector<HTMLElement>(".question-quote")?.focus();
          }}
        />
        <Hint text="Add a question">
          <button className="icon-btn" ref={askRef} aria-label="Add a question" onClick={() => setAsking(true)}>
            <Plus size={14} weight="bold" aria-hidden="true" />
          </button>
        </Hint>
      </>}
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
      {find && !found.length && <p className="quiet">No questions match “{find}”.</p>}
      {/* Open and Answered are the header's tabs (D226); a search looks through both. */}
      {!(byStatus && showAnswered) && (showAll || find ? open : open.slice(0, QUESTION_CAP)).map((q) => (
        <QuestionRow key={q.id} q={q} skill={skill} onQuestion={onQuestion} onOpenSource={onOpenSource} onAdded={onAdded} onStatus={setStatus} onRemove={remove} onChanged={reload} notify={notify} />
      ))}
      {!find && !(byStatus && showAnswered) && open.length > QUESTION_CAP && (
        <button className="answered-toggle" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer" : `Show all ${open.length}`}
        </button>
      )}
      {(find ? true : byStatus && showAnswered) &&
        answered.map((q) => <QuestionRow key={q.id} q={q} skill={skill} onQuestion={onQuestion} onOpenSource={onOpenSource} onAdded={onAdded} onStatus={setStatus} onRemove={remove} onChanged={reload} notify={notify} />)}
    </Fold>
  );
}

const QUESTION_TABS: HeadTab<"open" | "answered">[] = [
  { id: "open", label: "Questions", icon: PixelQuestion, tone: "question" },
  { id: "answered", label: "Answered", icon: Check, tone: "question" },
];

/** Open questions shown before "Show all", so Sources stays in view below them. */
const QUESTION_CAP = 5;

/** ↑ ↓ move between the questions in this section, as in any list here; Enter or a click opens one. */
function moveRow(e: ReactKeyboardEvent<HTMLButtonElement>) {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  const rows = [...(e.currentTarget.closest(".fold-body")?.querySelectorAll<HTMLButtonElement>(".question-quote") ?? [])];
  const next = rows[rows.indexOf(e.currentTarget) + (e.key === "ArrowDown" ? 1 : -1)];
  e.preventDefault();
  next?.focus();
}

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
  const own = typedQuestion(q);
  // A typed question is his own text, kept as typed; a highlight's passage reads as the page shows it.
  const exact = own ? q.exact.replace(/\s+/g, " ").trim() : passageText(q.exact);
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
        ore("archive", r.id, ...(on ? ["--undo"] : [])).then(() => (setAdded((a) => (on ? [...a, url] : a.filter((u) => u !== url))), onAdded(), onChanged()));
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
  // The row is one Tab stop and the ⋯ the next (Linear): the hover buttons are only for the pointer.
  const actions: MenuAction[] = [
    ...(own ? [] : [{ id: "open", label: "Open passage", run: () => onQuestion(q) }]),
    ...(maybe.length && !done ? [{ id: "lead", label: `Open “${maybe[0]!.title}”`, run: () => onOpenSource(maybe[0]!.item) }] : []),
    ...(done ? [] : [
      { id: "answer", label: "Answer…", run: () => setAnswering(true) },
      { id: "research", label: "Begin research", run: () => void research() },
    ]),
    { id: "status", label: done ? "Reopen" : "Mark answered", run: () => onStatus(q, done ? "open" : "done") },
    { id: "delete", label: "Delete question", danger: true, divider: true, run: () => onRemove(q) },
  ];

  return (
    <WithMenu actions={actions} hold>
    <div className={`question${done ? " done" : ""}`}>
      {/* D131: the question is the row; a circle at the left is Answered (Things), as a try's box is Tried. */}
      <Hint text={done ? "Reopen" : "Mark answered"}>
        <button className="q-check" tabIndex={-1} role="checkbox" aria-checked={done} aria-label={done ? "Reopen" : "Mark answered"} onClick={() => onStatus(q, done ? "open" : "done")}>
          {done && <Check size={12} aria-hidden="true" />}
        </button>
      </Hint>
      {own ? (
        <button className="question-quote" data-find="" onKeyDown={moveRow} onClick={() => !done && setAnswering(!answering)} aria-expanded={answering}>
          <span className="note">{exact}</span>
        </button>
      ) : (
        // The passage it came from is in the hint and one click away; the row keeps to the question and its source.
        <Hint text={q.note ? `“${exact}”` : "Open this passage"}>
          <button className="question-quote" data-find="" onKeyDown={moveRow} onClick={() => onQuestion(q)}>
            <span className={q.note ? "note" : "note passage"}>{q.note || exact}</span>
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
        // A purple dot at the right (F82: round, D184): a source that may answer it; the hint names them, a click opens the first.
        <Hint text={<span className="hint-lines">{maybe.map((m) => <span key={m.item}>{m.quote ? "May answer it" : "To read"} · {m.title}</span>)}</span>} side="left">
          <button className="q-lead" tabIndex={-1} aria-label={`Open ${maybe[0]!.title}, which may answer it`} onClick={() => onOpenSource(maybe[0]!.item)} />
        </Hint>
      )}
      <div className="question-actions">
        {!done && (
          <>
            <button tabIndex={-1} onClick={() => setAnswering(!answering)} aria-expanded={answering}>
              Answer
            </button>
            <button tabIndex={-1} onClick={() => void research()} disabled={busy}>
              {busy ? <Working stage="search" label="Finding sources…" /> : "Begin research"}
            </button>
          </>
        )}
        {done && <button tabIndex={-1} onClick={() => onStatus(q, "open")}>Reopen</button>}
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
function SkillRecall({ skill, blocked, append, onClose }: { skill: Skill; blocked: boolean; append: (t: string, heading: string) => Promise<boolean>; notify: Notify; onClose: () => void }) {
  const keys = useKeymap();
  const key = skill.id;
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
    if (await append(t, "Recall")) {
      recallDrafts.delete(key);
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
    <Trap>
    <div className="overlay recall" data-color={skill.color} onMouseDown={(e) => e.target === e.currentTarget && !text.trim() && onClose()}>
      <section className="panel skill-recall" role="dialog" aria-modal="true" aria-labelledby="skill-recall-title">
        <header className="skill-recall-head">
          <SkillChip skill={skill} />
          <span className="quiet">Warm up from memory</span>
          <Hint text={<>Close <kbd>Esc</kbd></>}>
            <button className="skill-recall-close" aria-label="Close" onClick={onClose}>
              <X size={14} weight="bold" aria-hidden="true" />
            </button>
          </Hint>
        </header>
        <h2 id="skill-recall-title">{`What do you know about ${skill.name}, across what you’ve read?`}</h2>
        <Grow ref={field} className="field" value={text} onChange={(e) => setText(e.target.value)} readOnly={saving} spellCheck />
        <div className="skill-recall-foot">
          <button onClick={onClose}>
            Cancel <kbd>Esc</kbd>
          </button>
          <button className="pill-btn" onClick={() => void save()} disabled={!text.trim() || saving}>
            {saving ? "Saving…" : "Save as first draft"} <kbd>{label(keys.finish)}</kbd>
          </button>
        </div>
      </section>
    </div>
    </Trap>
  );
}
