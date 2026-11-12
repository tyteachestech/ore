import { GearSix } from "./icons";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type CSSProperties, type HTMLAttributes, type MouseEvent as ReactMouseEvent, type ReactNode, type Ref } from "react";
import { gemHint, GemRing, NearGoal } from "./Gem";
import { Hint } from "./Hint";
import { inTextField, is, label, useKeymap } from "./keys";
import { MoreButton, WithMenu, type MenuAction } from "./Menu";
import { SkillIcon } from "./IconPicker";
import { lessonsOf, levelProgress, nextLesson, opt, ore, PHONE, touched, type DueEntry, type Item, type Skill, type Today } from "./ore";
import * as HoverCard from "@radix-ui/react-hover-card";
import { flushSync } from "react-dom";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { DotBar, minutes, minutesText, Ring } from "./Ring";
import { dueSkills, knowsDue, rememberToday, ReviewPick } from "./ReviewPick";
import { archivedOnly, SkillChips, skillGroups, SkillPicker } from "./Skills";
import { useSplit } from "./split";
import { Thumb } from "./Thumb";
import { Roll } from "./Roll";
import { errorText, load, typedLast, useKeptScroll, useLibraryChanges, type Notify } from "./util";
import { focusQuietly } from "./focus-near";
import { DndContext, useDraggable, useSensor, useSensors, type DragMoveEvent } from "@dnd-kit/core";
import { RowSensor } from "./drag";
import { TitleField } from "./TitleField";
import { pickRun, typeSelect } from "./typeahead";
import { keepFocusNear } from "./focus-near";

const day = () => new Date().toLocaleDateString("sv-SE");

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** Home (D58): today's goal and what is due, the sources he is reading, and each skill's
 *  strength. Apple Fitness for the ring; Start review asks what to review (D80). */
/** Continue reading: what he opened last first. This Mac's own list of what it opened (`recent`, the
 *  newest first) leads, then every source in reading by when the files say it was last opened (D110),
 *  so a fresh install or the other Mac doesn't fall back to title order. A lesson he opened stands for
 *  its course (D79): the lesson to read next, once, even when the one he opened is done. */
export function continueReading(items: Item[], recent: string[]): Item[] {
  const byTouch = items.filter((i) => i.status === "reading").sort((a, b) => (touched(b) > touched(a) ? 1 : touched(b) < touched(a) ? -1 : 0));
  return [
    ...new Set(
      [...recent, ...byTouch.map((i) => i.id)].flatMap((id) => {
        const i = items.find((x) => x.id === id);
        const up = i?.course ? nextLesson(lessonsOf(items, i.course.id)) : i?.status === "reading" ? i : null;
        return up ? [up] : [];
      }),
    ),
  ];
}

/** The row or tile he last opened from Home by the keyboard: Back puts focus on it again (Finder). Any other
 *  way back to Home forgets it. */
let openedByKeys: string | null = null;
let backHome = false;
/** Back (⌘[, the back arrow) is landing on Home. */
export const comingBackHome = () => void (backHome = true);

/** What a press on Home is not on, for it to be a click on empty space. */
const BLANK_NOT = ".home-read, .home-skill, button, a, input, [role=menu], [role=dialog]";

export function Home({ items, empty, skills, recent, reload, blocked = false, onReview, onOpenSource: openSource, onOpenSkill: openSkill, onRefile, onCreateSkill, onSettings, sourceMenu, onRename, onCopy, skillMenu, onRetry, notify, manyMenu, onDragSkill, onDropOnSkill}: {
  items: Item[];
  /** The library has no sources yet (loaded, not loading): Home says how to add the first. */
  empty?: boolean;
  skills: Skill[];
  recent: string[];
  /** Changes whenever Home should reload today's numbers (after a review). */
  reload: number;
  /** Review or a sheet is open over Home: its keys are theirs, even while focus is still on the page. */
  blocked?: boolean;
  onReview: (pick: string[] | null) => void;
  onOpenSource: (id: string) => void;
  onOpenSkill: (id: string) => void;
  /** Files a source under other skills from its chips (the same picker as the source lists). */
  onRefile?: (item: Item, next: string[], before: string[], changed: Skill) => void;
  onCreateSkill?: (name: string) => Promise<Skill | undefined>;
  /** Opens Settings; left out on the phone, which has none: its gear and plan button are not shown. */
  onSettings?: () => void;
  /** A source's and a skill's actions: the same right-click menus as in the source list and sidebar.
   *  Left out (the phone), a row has no menu at all: a long-press must not open an empty one. */
  sourceMenu?: (item: Item) => MenuAction[];
  /** Saves a source's title, typed in place on its row from Rename…. */
  onRename?: (item: Item, title: string) => Promise<boolean>;
  /** ⌘C on a focused Continue reading row: copies it as Markdown with its link, as the source lists do. */
  onCopy?: (item: Item) => void;
  skillMenu?: (skill: Skill) => MenuAction[];
  /** The picked rows' actions (⌘- or ⇧-click), as a source list's for its pick (F9). */
  manyMenu?: (items: Item[]) => MenuAction[];
  /** A row dragged from Home: the sidebar skill under the pointer, to light it, and the drop that files it (F10). */
  onDragSkill?: (skill: string | null) => void;
  onDropOnSkill?: (items: Item[], skill: string) => void;
  /** Try again also reloads what failed with today's numbers: the sources and the skills. */
  onRetry?: () => void;
  notify: Notify;
}) {
  const keys = useKeymap();
  const onOpenSource = (id: string) => ((openedByKeys = typedLast() ? `.home-read[data-id="${CSS.escape(id)}"]` : null), openSource(id));
  const onOpenSkill = (id: string) => ((openedByKeys = typedLast() ? `.home-skill[data-id="${CSS.escape(id)}"]` : null), openSkill(id));
  const [renaming, setRenaming] = useState<string | null>(null);
  /** Rename… where the source list has it, typed on the row itself. */
  const withRename = (acts: MenuAction[], i: Item): MenuAction[] =>
    acts.flatMap((a) => (a.id !== "rename" ? [a] : onRename ? [{ ...a, run: () => setRenaming(i.id) }] : []));
  const [today, setToday] = useState<Today | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    ore<Today>("today").then(
      (t) => {
        rememberToday(t);
        setToday(t);
        setError(null);
      },
      (e) => setError(errorText(e)),
    );
  }, []);
  const changes = useLibraryChanges();
  useEffect(refresh, [refresh, reload, changes]);

  const [picking, setPicking] = useState(false);
  /** Start review shows once the skill list has loaded too: a click before it would start every skill unasked. */
  const canStart = !!today && today.due > 0 && knowsDue(today, skills);
  /** Start review asks what to review (D80) when there is a choice; with one skill due, it just starts. */
  const ask = useCallback(() => (today && dueSkills(today, skills).length > 1 ? setPicking(true) : onReview(null)), [today, skills, onReview]);

  // ↵ starts review (D58, D80) unless focus is on something that takes Enter itself.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // A held ↵ starts once: its repeats never reach a Review or picker opening under it.
      if (e.key !== "Enter" || e.repeat || blocked || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if ((e.target as HTMLElement).closest?.("button, a, input, textarea, [contenteditable='true'], [role='dialog']")) return;
      if (!canStart) return;
      e.preventDefault();
      ask();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canStart, ask, blocked]);

  // Arrows move between skill tiles and Continue reading (Raycast's grid): ←→ in order, ↑↓ to the
  // nearest one in the row above or below. Nothing is selected until an arrow is pressed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.key.startsWith("Arrow") || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest?.("input, textarea, [contenteditable='true'], [role='dialog'], [role='menu']")) return;
      // A tile is placed by its box, and focused by its name: the one control in it Tab reaches (#193).
      const all = [...document.querySelectorAll<HTMLElement>(".home .home-skill, .home .home-read")];
      if (!all.length) return;
      const tile = t.closest<HTMLElement>(".home-skill, .home-read");
      if (e.shiftKey && tile?.classList.contains("home-read") && (e.key === "ArrowDown" || e.key === "ArrowUp")) return; // ⇧↑↓ grow the pick (below)
      if (!e.shiftKey) setPicked([]); // a plain arrow moves on alone, as in the lists
      const at = tile && t.classList.contains("home-open") ? all.indexOf(tile) : -1;
      if (at < 0 && t !== document.body) return;
      e.preventDefault();
      const go = (el: HTMLElement | undefined) => el?.querySelector<HTMLElement>(".home-open")?.focus();
      if (at < 0) return go(all[0]);
      const box = (el: HTMLElement) => el.getBoundingClientRect();
      const here = box(all[at]!);
      let next: HTMLElement | undefined;
      if (e.key === "ArrowRight") next = all[at + 1];
      else if (e.key === "ArrowLeft") next = all[at - 1];
      else {
        const down = e.key === "ArrowDown";
        const rows = all.filter((el) => (down ? box(el).top > here.bottom - 1 : box(el).bottom < here.top + 1));
        const rowTop = down ? Math.min(...rows.map((el) => box(el).top)) : Math.max(...rows.map((el) => box(el).top));
        const cx = here.left + here.width / 2;
        next = rows
          .filter((el) => Math.abs(box(el).top - rowTop) < 2)
          .sort((a, b) => Math.abs(box(a).left + box(a).width / 2 - cx) - Math.abs(box(b).left + box(b).width / 2 - cx))[0];
      }
      go(next);
      next?.scrollIntoView({ block: "nearest" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** Skills with sources or cards; empty ones stay in the sidebar only. */
  const shown = skills.filter((s) => !s.archived && (items.some((i) => i.skills.includes(s.id)) || today?.skills.some((x) => x.skill === s.id && (x.due || x.solid))));

  // An archived skill's sources wait off Home too (D173).
  const reading = continueReading(items, recent).filter((i) => !archivedOnly(i.skills, skills)).slice(0, 5);

  // Continue reading rows pick as a source list's do (F9, Finder): ⌘-click adds or drops one, ⇧-click
  // picks the run from the last one clicked, Esc clears; a plain click opens and clears.
  const [picked, setPicked] = useState<string[]>([]);
  const pressedBlank = useRef(false);
  const anchor = useRef<string | null>(null);
  const pick = reading.filter((i) => picked.includes(i.id));
  const clickRow = (e: ReactMouseEvent, i: Item) => {
    e.stopPropagation();
    if (e.metaKey || e.shiftKey) {
      e.preventDefault();
      if (e.metaKey) setPicked((p) => (p.includes(i.id) ? p.filter((x) => x !== i.id) : [...p, i.id]));
      else {
        // From the last row clicked, or this one when that has left the list.
        const ids = reading.map((r) => r.id);
        const b = ids.indexOf(i.id);
        const a = anchor.current && ids.includes(anchor.current) ? ids.indexOf(anchor.current) : b;
        setPicked(ids.slice(Math.min(a, b), Math.max(a, b) + 1));
      }
      if (e.metaKey || !anchor.current || !reading.some((r) => r.id === anchor.current)) anchor.current = i.id;
      // WebKit leaves a clicked button unfocused; ⇧↑↓ grow the pick from the focused row (F34, Finder).
      (e.currentTarget as HTMLElement).closest(".home-read")?.querySelector<HTMLElement>(".home-open")?.focus({ preventScroll: true });
      return;
    }
    setPicked([]);
    anchor.current = null;
    onOpenSource(i.id);
  };
  useEffect(() => {
    if (!picked.length) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || inTextField(e)) return;
      setPicked([]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked.length]);
  // The rows a menu acts on: the pick, when the row is in it.
  // An action on the pick clears it, as in the lists.
  const actionsFor = (i: Item) =>
    manyMenu && pick.length > 1 && picked.includes(i.id) ? manyMenu(pick).map((a) => ({ ...a, run: () => (setPicked([]), a.run()) })) : sourceMenu ? withRename(sourceMenu(i), i) : [];
  // A row drags onto a sidebar skill to file it there, the whole pick when it is in one (F10, as in the lists).
  const sensors = useSensors(useSensor(RowSensor, { activationConstraint: { distance: 6 } }));
  const [drag, setDrag] = useState<{ items: Item[]; at: { x: number; y: number } } | null>(null);
  // A skill lit by a drag goes dark if Home leaves mid-drag (dnd-kit then fires neither end nor cancel).
  useEffect(() => () => onDragSkill?.(null), [onDragSkill]);
  const under = (e: DragMoveEvent) => {
    const start = e.activatorEvent as PointerEvent;
    const at = { x: start.clientX + e.delta.x, y: start.clientY + e.delta.y };
    return { at, skill: document.elementFromPoint(at.x, at.y)?.closest<HTMLElement>("[data-drop-skill]")?.dataset.dropSkill || null };
  };

  // The source lists' keys on Continue reading (D232, D234): ⇧↑↓ grow the pick from where it started,
  // the first letters of a title select its tile or row (Finder), and Rename, Pin, Archive, Open original,
  // Reveal and Copy path act on the focused row, or on the pick it is in, as its menu does.
  const typed = useRef(typeSelect());
  const live = useRef({ reading, picked, actionsFor });
  live.current = { reading, picked, actionsFor };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (blocked || e.defaultPrevented || inTextField(e)) return;
      const t = e.target as HTMLElement;
      if (t.closest?.("[role='dialog'], [role='menu']")) return;
      const { reading, picked, actionsFor } = live.current;
      const rowEl = t.classList?.contains("home-open") ? t.closest<HTMLElement>(".home .home-read") : null;
      const row = reading.find((i) => i.id === rowEl?.dataset.id);
      const tiles = [...(root.current?.querySelectorAll<HTMLElement>(".home-skill, .home-read") ?? [])];
      const onTile = (!!rowEl || !!t.closest?.(".home .home-skill") || t === document.body) && tiles.length > 0;
      const from = tiles.findIndex((el) => el.contains(t) && t !== document.body);
      const jump = onTile ? typed.current(e, tiles.map((el) => el.querySelector(".home-open")?.textContent ?? ""), from) : null;
      if (row && e.shiftKey && !e.metaKey && !e.altKey && !e.ctrlKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        const ids = reading.map((i) => i.id);
        const at = ids.indexOf(row.id);
        const to = ids[Math.max(0, Math.min(ids.length - 1, at + (e.key === "ArrowDown" ? 1 : -1)))]!;
        if (!picked.length || !anchor.current || !ids.includes(anchor.current)) anchor.current = row.id;
        setPicked(pickRun(ids, anchor.current, to));
        root.current?.querySelector<HTMLElement>(`.home-read[data-id="${CSS.escape(to)}"] .home-open`)?.focus();
        return;
      }
      const key = (["rename", "pin", "archive", "original", "reveal", "path"] as const).find((k) => is(e, k));
      if (key) {
        const on = row ?? (picked.length > 1 ? reading.find((i) => picked.includes(i.id)) : undefined);
        const act = on && actionsFor(on).find((a) => a.id === key);
        if (!act) return;
        e.preventDefault();
        // Focus stays with the row, or goes to the next one when it leaves, as after the same pick from its menu.
        if (rowEl) keepFocusNear(rowEl);
        act.run();
        return;
      }
      if (jump !== null) {
        e.preventDefault();
        if (jump < 0) return;
        setPicked([]);
        tiles[jump]!.querySelector<HTMLElement>(".home-open")?.focus();
        tiles[jump]!.scrollIntoView({ block: "nearest" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blocked]);

  // ⌘C on the focused Continue reading row copies it, as on a list's selected row; never selected text or a field's.
  useEffect(() => {
    if (!onCopy) return;
    const onKey = (e: KeyboardEvent) => {
      if (blocked || e.defaultPrevented || !is(e, "copy") || inTextField(e) || getSelection()?.toString()) return;
      // A pick copies whole, as its menu's Copy N says.
      const all = pick.length > 1 && manyMenu?.(pick).find((a) => a.id === "copy");
      if (all) {
        e.preventDefault();
        return all.run();
      }
      // Only a row he can see is focused (its keyboard ring), never one focus was put on quietly after a click.
      const on = document.activeElement as HTMLElement | null;
      const id = on?.matches(":focus-visible") ? on.closest<HTMLElement>(".home .home-read")?.dataset.id : undefined;
      const item = id ? items.find((i) => i.id === id) : undefined;
      if (!item) return;
      e.preventDefault();
      onCopy(item);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, onCopy, blocked, pick, manyMenu]);

  // Back on Home he is where he was: scrolled there, and on the row or tile he opened by the keyboard, once it is drawn.
  const root = useRef<HTMLDivElement>(null);
  useKeptScroll(root, "home");
  // Read once as Home opens (kept through StrictMode's second run): where Back should put focus, if it was Back.
  const backTo = useRef<string | null>(null);
  useLayoutEffect(() => {
    const to = backHome ? openedByKeys : null;
    (backHome = false), (openedByKeys = null);
    if (to) backTo.current = to;
  }, []);
  useLayoutEffect(() => {
    const el = backTo.current && root.current?.querySelector<HTMLElement>(`${backTo.current} .home-open`);
    if (!el) return;
    backTo.current = null;
    if (!document.activeElement || document.activeElement === document.body) focusQuietly(el);
  });

  const split = useSplit("ore.home-split", 1 / 3);
  const two = reading.length > 0 && shown.length > 0 && !!today;
  return (
    // A click on empty space drops the pick (Finder); not the end of a drag that began on a row.
    <div
      className="home"
      ref={root}
      onPointerDown={(e) => (pressedBlank.current = !(e.target as Element).closest(BLANK_NOT))}
      onClick={(e) => picked.length && pressedBlank.current && !(e.target as Element).closest(BLANK_NOT) && setPicked([])}
    >
      <section className="home-today" aria-label="Today">
        {error && (
          <div role="alert">
            <p className="err">{error}</p>
            {/* The first screen: once he fixes what it names (the `ore` command, Bun), it comes back without a relaunch. */}
            <button className="pill-btn" onClick={() => (refresh(), onRetry?.())}>
              Try again
            </button>
          </div>
        )}
        {today && (
          <>
            <div className="home-goal">
              <Ring value={today.goal_ms ? today.active_ms / today.goal_ms : 0} met={today.met} size={92} label={`${minutes(today.active_ms)} of ${today.goal_minutes} minutes today`} />
              <div className="home-goal-text">
                <h1>
                  <Roll id="goal" value={minutesText(today.active_ms)} /> <span className="goal-of">of {today.goal_minutes} min</span>
                </h1>
                {/* Mid-goal with cards due, "N of 10 min" and Start review say it all (D65.4 as amended): no line. */}
                {subline(today) && <p>{subline(today)}</p>}
                {/* His plan (D67): the cue that starts review, set in Settings › Review. On the phone (no Settings)
                    the plan is read, not set: a button that does nothing is never shown. */}
                {onSettings ? (
                  <Hint text={today.plan ? "Change your plan" : "Pick when you review each day"}>
                    <button className={`home-plan${today.plan ? "" : " empty"}`} onClick={onSettings}>
                      {today.plan ? `After ${today.plan}, I review.` : "Plan when you review"}
                    </button>
                  </Hint>
                ) : (
                  today.plan && <p className="home-plan">After {today.plan}, I review.</p>
                )}
                <Week week={today.week} />
                <Unreadable list={today.unreadable} />
              </div>
              {/* Beside the ring, not on a row of its own: Today is only as tall as the ring. Nothing due: the
                  subline already says so, so no dead button. The full pile waits in its hint (D65.4). */}
              {canStart && (
                <Hint text={`Start review · ${today.due} due, about ${Math.max(1, minutes(today.estimate_ms))} min in all`} keys="review">
                  <button className="pill-btn home-go" onClick={ask}>
                    Start review
                  </button>
                </Hint>
              )}
              {/* It opens Review settings, not where ⌘, opens, so it shows no shortcut. */}
              {onSettings && (
                <Hint text="Review settings">
                  <button className="home-gear" aria-label="Review settings" onClick={onSettings}>
                    <GearSix size={16} aria-hidden="true" />
                  </button>
                </Hint>
              )}
            </div>

          </>
        )}
        {picking && today && (
          <ReviewPick
            today={today}
            skills={skills}
            onClose={() => setPicking(false)}
            onStart={(pick) => {
              setPicking(false);
              onReview(pick);
            }}
          />
        )}
      </section>

      {/* An empty library: the one thing to do next, as the empty source list says it. */}
      {empty && today && (
        <p className="empty-state">
          Nothing to read yet. Paste a link, a file or any text with <b>{label(keys.add)}</b>, or drop files here.
        </p>
      )}

      {/* Under Today: what to read on the left, skills on the right, split by a bar he can drag (as on the skill page). */}
      <div className={`home-cols${split.dragging ? " dragging" : ""}`} style={two ? { gridTemplateColumns: `minmax(0, ${1 - split.side}fr) 20px minmax(0, ${split.side}fr)` } : undefined}>
      {reading.length > 0 && (
        <section className="home-cont" aria-label="Continue reading">
          <h2 className="home-h">Continue reading</h2>
          <DndContext
            sensors={sensors}
            accessibility={{ container: document.body }}
            onDragStart={(e) => {
              const i = reading.find((r) => r.id === e.active.id);
              const p = e.activatorEvent as PointerEvent;
              if (i) setDrag({ items: pick.length > 1 && picked.includes(i.id) ? pick : [i], at: { x: p.clientX, y: p.clientY } });
            }}
            onDragMove={(e) => {
              const u = under(e);
              setDrag((d) => d && { ...d, at: u.at });
              onDragSkill?.(u.skill);
            }}
            onDragEnd={(e) => {
              const { skill } = under(e);
              if (drag && skill) (onDropOnSkill?.(drag.items, skill), setPicked([]));
              setDrag(null);
              onDragSkill?.(null);
            }}
            onDragCancel={() => (setDrag(null), onDragSkill?.(null))}
          >
          <div className="home-reading">
            {reading.map((i) => {
              const at = Number(load(`ore.pos.${i.id}`) ?? 0) || 0;
              return (
                // The title is the row's one control (a button inside a button reads as one to a screen reader);
                // the skill chips and ⋯ sit beside it. A click anywhere else on the row still opens it.
                <WithMenu key={i.id} actions={sourceMenu ? () => actionsFor(i) : []} hold>
                <HomeRow id={i.id} drags={!!onDropOnSkill && renaming !== i.id} className={`home-read${picked.includes(i.id) ? " sel" : ""}`} aria-selected={picked.length ? picked.includes(i.id) : undefined} onClick={(e) => !(e.target as Element).closest("button, a, input, .chips, .more") && clickRow(e, i)}>
                  <Thumb item={i} iconSize={16} />
                  {renaming === i.id ? (
                    // Focus goes back to the row once it closes, as after any pick from its menu (keepFocusNear).
                    <TitleField value={i.title} onSave={(t) => onRename!(i, t)} onClose={() => {
                      // Focus goes back to the row the field stood in, not to the page (Finder, the lists).
                      flushSync(() => setRenaming(null));
                      root.current?.querySelector<HTMLElement>(`.home-read[data-id="${CSS.escape(i.id)}"] .home-open`)?.focus({ preventScroll: true });
                    }} />
                  ) : (
                    <button className="title home-open" onClick={(e) => clickRow(e, i)}>{i.title}</button>
                  )}
                  {i.course && <span className="course-of">{i.course.title}</span>}
                  {onRefile && onCreateSkill && (
                    <SkillPicker skills={skills} value={i.skills} title={i.title} onChange={(next, before, k) => onRefile(i, next, before, k)} onCreate={onCreateSkill}>
                      {i.skills.length > 0 && <SkillChips ids={i.skills} skills={skills} />}
                    </SkillPicker>
                  )}
                  <Hint text={`${Math.round(at * 100)}% read`}>
                    {/* The hint needs an element to hold its ref, so the bar sits in a span. */}
                    <span className="home-meter small"><DotBar className="" share={at} n={10} /></span>
                  </Hint>
                  {/* On hover the ⋯ takes the meter's place, as on every other row (Linear). */}
                  {sourceMenu && <MoreButton label="Source actions" actions={() => actionsFor(i)} hoverOnly />}
                </HomeRow>
                </WithMenu>
              );
            })}
          </div>
          {drag && (
            // Follows the pointer, beside it, so the skill under it stays visible (as the lists' ghost does).
            <div className="row-ghost" style={{ left: drag.at.x + 14, top: drag.at.y + 10 }}>
              {drag.items.length > 1 ? `${drag.items.length} sources` : drag.items[0]!.title}
            </div>
          )}
          </DndContext>
        </section>
      )}

      {two && (
        <Hint text="Drag to resize · double-click to reset">
          <div className="col-divider" role="separator" aria-orientation="vertical" aria-label="Resize columns" {...split.divider} />
        </Hint>
      )}
      {shown.length > 0 && today && (
        <section className="home-skill-col" aria-label="Skills">
          {skillGroups(shown).map((g) => (
            <div key={g.collection}>
              <h2 className="home-h">{g.name}</h2>
              <div className="home-skills">
                {g.skills.map((s) => (
                  <WithMenu key={s.id} actions={skillMenu ? () => skillMenu(s) : []} hold>
                    <SkillTile skill={s} strength={today.skills.find((x) => x.skill === s.id)} onOpen={() => onOpenSkill(s.id)} onStart={() => onReview([s.id])} more={skillMenu && <MoreButton label="Skill actions" actions={() => skillMenu(s)} hoverOnly />} />
                  </WithMenu>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
      </div>
    </div>
  );
}

/** One skill's strength (D62, D63): its level, which never drops, and the way to the next one. */
// The rest (ref and handlers) comes from the right-click menu's trigger.
// The name is the tile's one control, its ⋯ beside it (as the reading rows); a click anywhere else on the tile opens it too.
function SkillTile({ skill: s, strength: k, onOpen, onStart, more, ...trigger }: { skill: Skill; strength?: Today["skills"][number]; onOpen: () => void; onStart: () => void; more?: ReactNode } & ComponentProps<"div">) {
  const lv = k?.level ?? 0;
  const p = levelProgress({ solid: k?.solid ?? 0, level: lv, next_level_at: k?.next_level_at ?? 5 });
  // Its next due questions fan out under the tile while he hovers or focuses it (D154), read once per visit.
  const [fan, setFan] = useState<DueEntry[] | null>(null);
  const due = k?.due ?? 0;
  const tile = (
    <div {...trigger} className="home-skill" data-id={s.id} data-color={s.color} onClick={(e) => !(e.target as Element).closest("button, a, input") && onOpen()}>
      <span className="home-skill-top">
        <span className={`mark${s.icon && s.color ? " tile" : ""}`} data-color={s.color} aria-hidden="true">
          <SkillIcon icon={s.icon} color={s.color} dot />
        </span>
        <button className="home-skill-name home-open" onClick={onOpen}>{s.name}</button>
        {more}
      </span>
      <Hint text={k ? gemHint(k, p.line) : p.line}>
        <span className="home-level">
          {k ? (
            <>
              <GemRing k={k} size={26} />
              <span className="home-solid"><Roll id={`solid:${s.id}`} value={k.solid} /></span>
              <NearGoal k={k} size={12} due />
            </>
          ) : (
            <>
              <span className="home-lv">Lv {lv}</span>
              <DotBar className="home-meter" share={0} n={10} />
            </>
          )}
        </span>
      </Hint>
    </div>
  );
  if (!due || PHONE) return tile;
  return (
    <HoverCard.Root openDelay={300} closeDelay={150} onOpenChange={(open) => open && fan === null && ore<DueEntry[]>("due", opt("skill", s.id), opt("limit", "3")).then(setFan, () => setFan([]))}>
      <HoverCard.Trigger asChild>{tile}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content className="skill-fan" side="bottom" align="start" sideOffset={6} collisionPadding={8} aria-label={`Next due in ${s.name}`}>
          {(fan ?? []).map((c, i) => (
            <button key={c.id} className="skill-fan-q" style={{ "--i": i } as CSSProperties} onClick={onStart}>
              {c.question}
            </button>
          ))}
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}

function subline(t: Today): string {
  if (!t.counts) return t.due ? "Today is off. Exercises are ready if you feel like it." : "Today is off.";
  // Caught up short of the goal still counts (D60); say why, or a full ring beside "<1 of 10" reads as a bug.
  if (t.met && t.active_ms < t.goal_ms) return t.new_waiting ? `All caught up, so today counts. ${waiting(t)}` : "All caught up, so today counts.";
  if (t.met) return t.caught_up ? (t.new_waiting ? `Goal met. ${waiting(t)}` : "Goal met and all caught up.") : "Goal met. Anything more is a bonus.";
  if (t.due) return "";
  return t.new_waiting ? `All caught up. ${waiting(t)}` : "All caught up. Read something new.";
}

/** New cards the daily limits held back (D65), so "caught up" never reads as "there's nothing left". */
export function waiting(t: Today): string {
  const n = t.new_waiting;
  const cards = `${n} new exercise${n === 1 ? "" : "s"}`;
  if (!t.new_per_day) return `${cards} wait. New exercises are off in Settings.`;
  // New cards only take the goal time due cards leave (D65), so past a day's worth say that, not "up to 10 a day".
  return n <= t.new_per_day ? `${cards} start${n === 1 ? "s" : ""} tomorrow.` : `${cards} wait. A few start each day, as your goal leaves room.`;
}

/** A source whose doc.md can't be read drops out of every list (files-10), so Home names it in one quiet
 *  line; the hint says why (what `ore doctor` says) and a click shows the file in Finder to mend it. */
function Unreadable({ list }: { list: Today["unreadable"] }) {
  if (!list.length) return null;
  const text = `${list.length} source${list.length === 1 ? "" : "s"} couldn’t be read`;
  const why = (
    <span className="hint-lines">
      {!PHONE && <span>Show it in Finder</span>}
      {list.slice(0, 3).map((u) => (
        <span key={u.dir} className="home-unreadable-why">{u.dir.split("/").pop()!.replace(/-[0-9A-Z]{26}$/, "")}: {u.error}</span>
      ))}
    </span>
  );
  if (PHONE) return <p className="home-plan home-unreadable">{text}</p>;
  return (
    <Hint text={why}>
      <button className="home-plan home-unreadable" onClick={() => void revealItemInDir(`${list[0]!.dir}/doc.md`)}>
        {text}
      </button>
    </Hint>
  );
}

function Week({ week }: { week: Today["week"] }) {
  const now = day();
  return (
    <div className="home-week" role="img" aria-label={`${week.filter((d) => d.status === "met").length} of ${week.filter((d) => d.status !== "off").length} days met this week`}>
      {week.map((d, i) => (
        <Hint key={d.date} text={`${new Date(`${d.date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long" })} · ${d.status === "off" ? "off" : `${minutes(d.active_ms)} min`}`}>
          <span className={`home-day ${d.status}${d.date === now ? " today" : ""}${d.date > now ? " later" : ""}`}>
            <i />
            {DAYS[i]}
          </span>
        </Hint>
      ))}
    </div>
  );
}

/** A Continue reading row that drags onto a sidebar skill (F10); a click still opens it, as the drag starts
 *  only after the pointer moves 6px. The menu's trigger passes its ref and pointer-down too; both run. */
function HomeRow({ id, drags, children, ref, ...props }: { id: string; drags: boolean; children: ReactNode; ref?: Ref<HTMLDivElement> } & Omit<HTMLAttributes<HTMLDivElement>, "id">) {
  const { setNodeRef, listeners } = useDraggable({ id, disabled: !drags });
  const setRef = (el: HTMLDivElement | null) => {
    setNodeRef(el);
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };
  return (
    <div
      ref={setRef}
      data-id={id}
      {...props}
      onPointerDown={(e) => {
        props.onPointerDown?.(e);
        listeners?.onPointerDown?.(e);
      }}
    >
      {children}
    </div>
  );
}
