// The iPhone shell (phase 0 feel test): the Mac's screens in a phone layout. A drawer for Today, Sources
// and the skills, as in Obsidian; a source and Review open full screen over it, with a way back.
// Everything inside the screens is the Mac app's own code.
import { openUrl } from "@tauri-apps/plugin-opener";
import { Archive, BookOpen, CaretLeft, CaretRight, House, MagnifyingGlass, SidebarSimple } from "../icons";
import { flushSync } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Boundary } from "../Boundary";
import { trackDrag, type Drag } from "./drag";
import { Home } from "../Home";
import { SkillIcon } from "../IconPicker";
import { NoteBody, useNotes, type SideTab } from "../Notes";
import { PixelNote } from "../PixelIcon";
import type { NoteEditorHandle } from "../editor/NoteEditor";
import { WithMenu, type MenuAction } from "../Menu";
import { Palette } from "../Palette";
import { skillGroups } from "../Skills";
import { lessonsOf, opt, ore, type Item, type Skill, touched } from "../ore";
import { Reader } from "../Reader";
import { Review } from "../Review";
import { Thumb } from "../Thumb";
import { useToast } from "../Toast";
import { errorText, type Notify } from "../util";

function useHorizontalDrag(ref: RefObject<HTMLElement | null>, drag: Drag) {
  const now = useRef(drag);
  now.current = drag;
  useEffect(() => (ref.current ? trackDrag(ref.current, () => now.current) : undefined), [ref]);
}

/** iOS's edge swipes. From the left edge the screen moves with the finger; let go past a third of
 *  the way (or with a flick) and it slides off and goes back, otherwise it springs back. A screen
 *  with a second page (a source and its note, `.reader`) pages instead: from the right edge to the
 *  note, and from the left edge back to the source, each keeping its scroll. */
function Screen({ onBack, onForward, className, children }: { onBack: () => void; onForward?: (open: boolean) => void; className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const edge = useRef<"left" | "right">("left");
  const strip = useRef<HTMLElement | null>(null);
  const clamp = (dx: number) => (edge.current === "left" ? Math.max(0, dx) : Math.min(0, dx));
  useHorizontalDrag(ref, {
    accept: (t) => {
      const pages = onForward ? ref.current?.querySelector<HTMLElement>(".reader") : null;
      const noting = !!pages?.classList.contains("noting");
      if (t.clientX <= 24) edge.current = "left";
      else if (pages && !noting && t.clientX >= innerWidth - 24) edge.current = "right";
      else return false;
      strip.current = noting || edge.current === "right" ? (pages ?? null) : null;
      return true;
    },
    begin: (dx) => {
      if (!clamp(dx)) return false;
      if (strip.current) strip.current.classList.add("dragging");
      else ref.current!.style.transition = "none";
      window.getSelection()?.removeAllRanges();
      // The keyboard goes as the swipe starts, as in iOS.
      (document.activeElement as HTMLElement | null)?.blur();
    },
    move: (raw) => {
      const dx = clamp(raw);
      if (strip.current) strip.current.style.setProperty("--drag", `${dx}px`);
      else ref.current!.style.transform = `translateX(${dx}px)`;
    },
    end: (raw, flick, cancelled) => {
      const el = ref.current!;
      const dx = clamp(raw);
      const go = !cancelled && (Math.abs(dx) > el.clientWidth / 3 || Math.abs(flick) > 0.5);
      if (strip.current) {
        // Set the page at once so it slides on from where the finger let go; React agrees after.
        if (go) strip.current.classList.toggle("noting", edge.current === "right");
        strip.current.classList.remove("dragging");
        strip.current.style.removeProperty("--drag");
        if (go) onForward?.(edge.current === "right");
        return;
      }
      el.style.transition = "transform 250ms cubic-bezier(.2, .9, .3, 1)";
      el.style.transform = go ? `translateX(${el.clientWidth}px)` : "";
      if (go) setTimeout(onBack, 200);
    },
  });
  return (
    <div className={className} ref={ref}>
      {children}
    </div>
  );
}

/** The drawer's swipes, at the level with nothing to go back to: from the left edge it follows the finger out,
 *  and when open a swipe left puts it away. Past a third of the way (or with a flick) it goes, otherwise it springs back. */
function useDrawerSwipe(shellRef: RefObject<HTMLDivElement | null>, panelRef: RefObject<HTMLElement | null>, open: boolean, setOpen: (on: boolean) => void) {
  const place = (dx: number) => Math.min(1, Math.max(0, (open ? 1 : 0) + dx / (panelRef.current?.offsetWidth || 1)));
  useHorizontalDrag(shellRef, {
    accept: (t) => open || t.clientX <= 24,
    begin: () => void shellRef.current!.classList.add("dragging"),
    move: (dx) => shellRef.current!.style.setProperty("--open", String(place(dx))),
    end: (dx, flick, cancelled) => {
      const next = cancelled ? open : open ? !(place(dx) < 2 / 3 || flick < -0.5) : place(dx) > 1 / 3 || flick > 0.5;
      shellRef.current!.classList.remove("dragging");
      // Set here so it slides on from where the finger let go; React agrees after.
      shellRef.current!.style.setProperty("--open", next ? "1" : "0");
      setOpen(next);
    },
  });
}

/** Pull down at the top of a list to search (Obsidian). The icon under the bar shows it is coming; let go past the mark to open. */
function usePullToSearch(mainRef: RefObject<HTMLElement | null>, cueRef: RefObject<HTMLElement | null>, onPull: () => void) {
  const pull = useRef(onPull);
  pull.current = onPull;
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const MARK = 72;
    let x0 = 0, y0 = 0, dy = 0, live = false;
    const cue = (v: number) => cueRef.current?.style.setProperty("--pull", String(v));
    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      live = e.touches.length === 1 && main.scrollTop <= 0;
      [x0, y0, dy] = [t?.clientX ?? 0, t?.clientY ?? 0, 0];
    };
    const move = (e: TouchEvent) => {
      if (!live) return;
      const t = e.touches[0];
      dy = (t?.clientY ?? y0) - y0;
      // A swipe sideways (a row, the drawer) or a scroll up is not a pull.
      if (dy < 0 || Math.abs((t?.clientX ?? x0) - x0) > Math.max(10, dy)) return void ((live = false), cue(0));
      cue(Math.min(1, dy / MARK));
    };
    const end = (e: TouchEvent) => {
      if (live && dy >= MARK && e.type === "touchend") pull.current();
      live = false;
      cue(0);
    };
    main.addEventListener("touchstart", start, { passive: true });
    main.addEventListener("touchmove", move, { passive: true });
    main.addEventListener("touchend", end);
    main.addEventListener("touchcancel", end);
    return () => {
      main.removeEventListener("touchstart", start);
      main.removeEventListener("touchmove", move);
      main.removeEventListener("touchend", end);
      main.removeEventListener("touchcancel", end);
    };
  }, [mainRef, cueRef]);
}

type TabId = "today" | "sources" | "archive";

/** Where he was, so a relaunch comes back to it, as Apple's apps do. */
type Place = { tab: TabId; skill: string | null; skillNote?: boolean; openId: string | null; noting?: boolean; side?: SideTab; finishing?: boolean; review: { pick: string[] | null } | null };
const PLACE = "ore-phone-place";
function loadPlace(): Place {
  try {
    return { tab: "today", skill: null, openId: null, review: null, ...JSON.parse(localStorage.getItem(PLACE) ?? "{}") };
  } catch {
    return { tab: "today", skill: null, openId: null, review: null };
  }
}

/** What a source row does, shared by its swipes and its long-press menu. */
type RowActions = { archive: (item: Item) => void; toggle: (item: Item) => void; menu: (item: Item) => MenuAction[] };

/** A list row with Mail's swipes: left archives, right moves it between To read and Done. It follows the
 *  finger, and past 40% of the row (or with a flick) the action runs; otherwise it springs back. The left
 *  edge stays the drawer's and the back swipe's. */
function SwipeRow({ item, row, onOpen }: { item: Item; row: RowActions; onOpen: (id: string) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const swiped = useRef(false);
  const [side, setSide] = useState<"left" | "right" | null>(null);
  /** An archived row only restores, to the left. */
  const only = (dx: number) => (item.archived_at ? Math.min(0, dx) : dx);
  useHorizontalDrag(ref, {
    accept: (t) => ((swiped.current = false), t.clientX > 24),
    // iOS's half second, not the menu library's 700 ms (D145.4): Radix's trigger opens on contextmenu, and clears its own timer.
    hold: (clientX, clientY) => {
      swiped.current = true; // Letting go after the menu opened is not a tap on the row.
      ref.current!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX, clientY }));
    },
    begin: (dx) => {
      if (item.archived_at && dx > 0) return false; // Archived: only Restore, to the left.
      swiped.current = true;
      ref.current!.style.transition = "none";
    },
    move: (raw) => {
      const dx = only(raw);
      setSide(dx < 0 ? "left" : "right");
      ref.current!.style.transform = `translateX(${dx}px)`;
    },
    end: (raw, flick, cancelled) => {
      const dx = only(raw);
      const el = ref.current!;
      const w = el.offsetWidth;
      const go = !cancelled && dx !== 0 && (Math.abs(dx) > w * 0.4 || Math.abs(flick) > 0.5);
      el.style.transition = "transform 200ms cubic-bezier(.2, .9, .3, 1)";
      el.style.transform = go ? `translateX(${dx < 0 ? -w : w}px)` : "";
      setTimeout(() => {
        el.style.transition = "";
        el.style.transform = "";
        setSide(null);
        if (go) (dx < 0 ? row.archive : row.toggle)(item);
      }, 200);
    },
  });
  return (
    <WithMenu actions={() => row.menu(item)}>
      <li>
        {side && <span className={`phone-swipe ${side}`}>{side === "left" ? (item.archived_at ? "Restore" : "Archive") : item.status === "done" ? "To read" : "Done"}</span>}
        <button ref={ref} onClick={() => swiped.current || onOpen(item.id)} onTouchEnd={() => setTimeout(() => (swiped.current = false), 350)}>
          <Thumb item={item} className="thumb phone-thumb" />
          <span className="phone-title">{item.title}</span>
        </button>
      </li>
    </WithMenu>
  );
}

/** Sources by To read and Done, as one list. */
function SourceList({ title, items, onOpen, row, head, empty = "Nothing here yet. Sources you add on the Mac come to the phone with its next install." }: { title: string; items: Item[] | null; onOpen: (id: string) => void; row: RowActions; head?: ReactNode; empty?: string }) {
  const toRead = (items ?? []).filter((i) => i.status !== "done").sort((a, b) => touched(b).localeCompare(touched(a)));
  const done = (items ?? []).filter((i) => i.status === "done");
  return (
    <div className="phone-sources">
      <h1>{title}</h1>
      {head}
      {items === null ? null : !items.length ? (
        <p className="phone-empty">{empty}</p>
      ) : (
        ([
          ["To read", toRead],
          ["Done", done],
        ] as const).map(([label, list]) =>
          list.length ? (
            <section key={label}>
              <h2>{label}</h2>
              <ul>
                {list.map((i) => (
                  <SwipeRow key={i.id} item={i} row={row} onOpen={onOpen} />
                ))}
              </ul>
            </section>
          ) : null,
        )
      )}
    </div>
  );
}

/** A skill's note on its own screen (Tyler 2026-11-06, B): the whole page to write in, as in Apple
 *  Notes, with the keyboard bar under it; Back or the edge swipe returns to the skill. */
function SkillNote({ skill, notify }: { skill: string; notify: Notify }) {
  const ref = useMemo(() => ({ skill }), [skill]);
  const notes = useNotes(ref, notify);
  const editor = useRef<NoteEditorHandle>(null);
  return (
    <div className="phone-page phone-note">
      <NoteBody notes={notes} editorRef={editor} targets={[]} onOpen={() => {}} label="Skill note" placeholder="What you know so far. Type / for blocks." />
    </div>
  );
}

const Back = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <header className="phone-bar">
    <button className="phone-back" onClick={onClick}>
      <CaretLeft size={16} aria-hidden="true" /> {label}
    </button>
  </header>
);

export function PhoneApp() {
  const [start] = useState(loadPlace);
  const [tab, setTab] = useState<TabId>(start.tab);
  const [items, setItems] = useState<Item[] | null>(null);
  const [archived, setArchived] = useState<Item[] | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skill, setSkill] = useState<string | null>(start.skill);
  const [skillNote, setSkillNote] = useState(!!start.skillNote);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(start.openId);
  const [noting, setNoting] = useState(!!start.noting);
  /** What the page beside the source shows: the note, or what he collected (a tap on the collected count). */
  const [side, setSide] = useState<SideTab>(start.side ?? "note");
  // Once that page has slid away it is the note again, so the edge swipe always brings the note.
  useEffect(() => {
    if (noting) return;
    const t = setTimeout(() => setSide("note"), 300);
    return () => clearTimeout(t);
  }, [noting]);
  const [jumpTo, setJumpTo] = useState<string | undefined>();
  const [finishing, setFinishing] = useState(!!start.finishing);
  const [reviewing, setReviewing] = useState<{ pick: string[] | null; run: number } | null>(start.review && { pick: start.review.pick, run: 0 });
  const [tick, setTick] = useState(0);
  const { notify, view: toast } = useToast();
  const actions = useRef([]);
  const [drawer, setDrawer] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  useDrawerSwipe(shell, panel, drawer, setDrawer);
  const [searching, setSearching] = useState(false);
  const main = useRef<HTMLElement>(null);
  const cue = useRef<HTMLDivElement>(null);
  // Rendered inside the touch's own handler, so iOS lets the field take focus and bring up the keyboard.
  usePullToSearch(main, cue, () => flushSync(() => setSearching(true)));
  const go = (t: TabId) => (setTab(t), setDrawer(false));

  useEffect(() => {
    try {
      localStorage.setItem(PLACE, JSON.stringify({ tab, skill, skillNote, openId, noting, side, finishing, review: reviewing && { pick: reviewing.pick } } satisfies Place));
    } catch {}
  }, [tab, skill, skillNote, openId, noting, side, finishing, reviewing]);
  const tabNow = useRef(tab);
  tabNow.current = tab;
  const refresh = useCallback(async () => {
    try {
      const [all, sk] = await Promise.all([ore<Item[]>("ls"), ore<Skill[]>("skills")]);
      setItems(all);
      setSkills(sk);
      setError(null);
      // The Archive list, only while it shows: listed twice on every change otherwise.
      if (tabNow.current === "archive") setArchived(await ore<Item[]>("ls", "--archived"));
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => void (tab === "archive" && refresh()), [tab, refresh]);
  useEffect(() => void refresh(), [refresh]);

  // The on-screen keyboard covers fixed screens (Review) instead of shrinking them: lift them by its
  // height, and keep the answer's buttons in sight when it opens.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let full = innerHeight;
    const fit = () => {
      // Against the full screen: with some fields iOS also shrinks innerHeight, while fixed screens still
      // lay out on the whole screen (portrait only, so its height doesn't change).
      full = Math.max(full, innerHeight);
      const kb = Math.max(0, Math.round(full - vv.height));
      document.documentElement.style.setProperty("--keyboard", `${kb}px`);
      if (!kb) return;
      document.querySelector(".phone-full .review-foot")?.scrollIntoView({ block: "end" });
      // A field in the reader (a prequestion, a highlight's note) stays in sight above the keyboard.
      const field = document.activeElement;
      if (!(field instanceof HTMLElement) || !field.closest(".phone-reader")) return;
      if (!field.isContentEditable) return field.scrollIntoView({ block: "nearest" });
      // The source note is one tall editor: bring the caret, not the editor, into view, once the screen has shrunk.
      requestAnimationFrame(() => {
        const sel = getSelection();
        const caret = sel?.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
        let box: HTMLElement | null = field;
        while (box && !(box.scrollHeight > box.clientHeight && getComputedStyle(box).overflowY !== "visible")) box = box.parentElement;
        if (!caret || !box) return;
        const below = caret.bottom + 24 - box.getBoundingClientRect().bottom;
        if (below > 0) box.scrollTop += below;
      });
    };
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    return () => {
      vv.removeEventListener("resize", fit);
      vv.removeEventListener("scroll", fit);
    };
  }, []);

  const open = (id: string, at?: string) => {
    setJumpTo(at);
    setFinishing(false);
    setNoting(false);
    setOpenId(id);
  };
  /** Archive from the source's menu: back to the list at once, with Undo, as on the Mac. */
  const archive = async (item: Item) => {
    setOpenId(null);
    setItems((all) => all?.filter((i) => i.id !== item.id) ?? all);
    // Undo and Redo return the write, so a failed one goes back on the history and says why.
    const apply = (on: boolean) => {
      if (on) setItems((all) => all?.filter((i) => i.id !== item.id) ?? all);
      return ore("archive", item.id, ...(on ? [] : ["--undo"])).finally(refresh);
    };
    notify(`Archived “${item.title}”`, "info", () => apply(false), () => apply(true));
    try {
      await ore("archive", item.id);
    } catch (e) {
      notify(errorText(e), "error");
    }
    void refresh();
  };
  const moveTo = async (item: Item, to: Item["status"], undoable = true) => {
    // At once, so a swiped row doesn't come back to its old section while the write runs.
    setItems((all) => all?.map((i) => (i.id === item.id ? { ...i, status: to } : i)) ?? all);
    try {
      // Back to Done (an Undo): it keeps the finish date it had.
      await ore("status", item.id, to, ...(to === "done" && item.status === "done" && item.finished_at ? [opt("at", item.finished_at)] : []));
      if (undoable) notify(to === "done" ? `Moved “${item.title}” to Done` : `Moved “${item.title}” to To read`, "info", () => moveTo(item, item.status, false), () => moveTo(item, to, false));
    } catch (e) {
      // From the history (Undo or Redo): it puts the step back and says why.
      if (!undoable) throw e;
      notify(errorText(e), "error");
    } finally {
      void refresh();
    }
  };
  const refile = async (item: Item, next: string[], before: string[], changed?: Skill) => {
    try {
      await ore("edit", item.id, "--skills", next.join(","));
      if (changed)
        notify(next.includes(changed.id) ? `Filed “${item.title}” under ${changed.name}` : `Removed “${item.title}” from ${changed.name}`, "info", () => refile(item, before, next), () => refile(item, next, before));
    } catch (e) {
      // From the history (Undo or Redo, with no `changed`): it puts the step back and says why.
      if (!changed) throw e;
      notify(errorText(e), "error");
    } finally {
      void refresh();
    }
  };
  const fileUnder = (item: Item, k: Skill) => refile(item, item.skills.includes(k.id) ? item.skills.filter((s) => s !== k.id) : [...item.skills, k.id], item.skills, k);
  /** From the Archive list, at once and with Undo, as archiving is. */
  const restore = (item: Item) => {
    setArchived((all) => all?.filter((i) => i.id !== item.id) ?? all);
    // Undo and Redo return the write, so a failed one goes back on the history and says why.
    const apply = (on: boolean) => ore("archive", item.id, ...(on ? [] : ["--undo"])).finally(refresh);
    notify(`Restored “${item.title}”`, "info", () => apply(true), () => apply(false));
    apply(false).catch((e) => notify(errorText(e), "error"));
  };
  const row: RowActions = {
    archive: (item) => (item.archived_at ? restore(item) : void archive(item)),
    toggle: (item) => void moveTo(item, item.status === "done" ? "reading" : "done"),
    // Long-press: the Mac row menu, less what needs a Finder or a keyboard.
    menu: (item) => item.archived_at ? [
      { id: "open", label: "Open", run: () => open(item.id) },
      { id: "restore", label: "Restore", run: () => restore(item) },
    ] : [
      { id: "open", label: "Open", run: () => open(item.id) },
      { id: "move", label: item.status === "done" ? "Move to To read" : "Move to Done", run: () => row.toggle(item) },
      ...(item.url ? [{ id: "original", label: "Open original", run: () => void openUrl(item.url!).catch((e) => notify(errorText(e), "error")) }] : []),
      ...(skills.length
        ? [{ id: "skills", label: "Skills", run: () => {}, sub: skills.map((k) => ({ id: k.id, label: k.name, icon: <SkillIcon icon={k.icon} color={k.color} dot className="palette-icon" />, checked: item.skills.includes(k.id), run: () => void fileUnder(item, k) })) }]
        : []),
      { id: "archive", label: "Archive", danger: true, divider: true, run: () => row.archive(item) },
    ],
  };
  const endReview = () => {
    setReviewing(null);
    setTick((t) => t + 1);
  };

  // A full screen opens over the tabs, which stay underneath for the swipe back to reveal.
  const over = reviewing ? (
      <Screen className="phone-full" onBack={endReview}>
        <Boundary onBack={endReview}>
          <Review
            key={reviewing.run}
            pick={reviewing.pick}
            skills={skills}
            onOpenSource={(item, at) => {
              endReview();
              open(item, at);
            }}
            onClose={(again) => (again ? setReviewing({ pick: reviewing.pick, run: reviewing.run + 1 }) : endReview())}
            notify={notify}
          />
        </Boundary>
      </Screen>
    ) : openId ? (
      <Screen className="phone-full phone-reader phone-source" onBack={() => setOpenId(null)} onForward={setNoting}>
        {/* From the note, Back returns to the source, as the left-edge swipe does. */}
        <Back label={noting ? "Source" : "Back"} onClick={() => (noting ? setNoting(false) : setOpenId(null))} />
        <Boundary onBack={() => setOpenId(null)}>
          <Reader
            key={openId}
            id={openId}
            skills={skills}
            finishing={finishing}
            setFinishing={setFinishing}
            notesOpen={noting}
            sideTab={side}
            onShowSide={(t) => (setSide(t), setNoting(true))}
            onCloseSide={() => setNoting(false)}
            onToggleSide={() => setNoting((v) => !v)}
            renameSource={0}
            actionsRef={actions}
            onArchive={(item) => (item.archived_at ? (setOpenId(null), restore(item)) : void archive(item))}
            lessons={(() => {
              const c = (items ?? []).find((i) => i.id === openId)?.course;
              return c ? lessonsOf(items ?? [], c.id) : undefined;
            })()}
            onOpenLesson={(id) => open(id)}
            onPin={() => {}}
            onMove={() => void refresh()}
            jumpTo={jumpTo}
            blocked={false}
            targets={[]}
            onOpenLink={() => {}}
            onBack={() => setOpenId(null)}
            onChanged={() => void refresh()}
            onSkillsChanged={() => void refresh()}
            onDone={() => {
              setOpenId(null);
              setFinishing(false);
              void refresh();
            }}
            notify={notify}
          />
        </Boundary>
      </Screen>
    ) : null;

  const skillName = skills.find((s) => s.id === skill)?.name;

  return (
    <div className="phone-app">
      <div className={`phone-shell${drawer ? " open" : ""}`} ref={shell} style={{ "--open": drawer ? 1 : 0 } as CSSProperties}>
        <div className="phone-root">
          <header className="phone-bar">
            <button className="phone-back phone-icon" aria-label="Open menu" aria-expanded={drawer} onClick={() => setDrawer(true)}>
              <SidebarSimple size={16} aria-hidden="true" />
            </button>
            <button className="phone-back phone-icon" aria-label="Search" onClick={() => setSearching(true)}>
              <MagnifyingGlass size={16} aria-hidden="true" />
            </button>
          </header>
          <div className="phone-pull" ref={cue} aria-hidden="true">
            <MagnifyingGlass size={16} />
          </div>
          <main className="phone-page" ref={main}>
            {error && <p className="phone-error">{error}</p>}
            {tab === "today" ? (
              <Home
                items={items ?? []}
                skills={skills}
                recent={[]}
                reload={tick}
                onReview={(pick) => setReviewing({ pick, run: 0 })}
                onOpenSource={(id) => open(id)}
                onOpenSkill={setSkill}
                notify={notify}
              />
            ) : (
              <SourceList
                title={tab === "archive" ? "Archive" : "Sources"}
                items={tab === "archive" ? archived : items}
                onOpen={open}
                row={row}
                empty={tab === "archive" ? "Nothing archived. Swipe a source left to archive it." : undefined}
              />
            )}
          </main>
        </div>
        <button className="phone-scrim" aria-label="Close menu" tabIndex={drawer ? 0 : -1} onClick={() => setDrawer(false)} />
        <nav className="phone-drawer" ref={panel} inert={!drawer}>
          <button className={tab === "today" ? "on" : ""} onClick={() => go("today")}>
            <House size={16} weight={tab === "today" ? "fill" : "regular"} aria-hidden="true" />
            <span className="phone-title">Today</span>
          </button>
          <button className={tab === "sources" ? "on" : ""} onClick={() => go("sources")}>
            <BookOpen size={16} weight={tab === "sources" ? "fill" : "regular"} aria-hidden="true" />
            <span className="phone-title">Sources</span>
          </button>
          <button className={tab === "archive" ? "on" : ""} onClick={() => go("archive")}>
            <Archive size={16} aria-hidden="true" />
            <span className="phone-title">Archive</span>
          </button>
          {skillGroups(skills.filter((s) => !s.archived)).map((g) => (
            <section key={g.collection}>
              <h2>{g.name}</h2>
              {g.skills.map((s) => (
                <button key={s.id} onClick={() => (setSkill(s.id), setDrawer(false))}>
                  <SkillIcon icon={s.icon} color={s.color} dot />
                  <span className="phone-title">{s.name}</span>
                </button>
              ))}
            </section>
          ))}
        </nav>
      </div>
      {/* A skill's sources, pushed from Today; a source opens over it. */}
      {skill && (
        <Screen className="phone-full" onBack={() => setSkill(null)}>
          <Back label={tab === "today" ? "Today" : "Sources"} onClick={() => setSkill(null)} />
          <div className="phone-page">
            <SourceList
              title={skillName ?? "Sources"}
              items={items && items.filter((i) => i.skills.includes(skill))}
              onOpen={open}
              row={row}
              head={
                <button className="phone-note-row" onClick={() => setSkillNote(true)}>
                  <PixelNote className="card-icon" size={16} aria-hidden="true" />
                  <span className="phone-title">Your note</span>
                  <CaretRight size={16} aria-hidden="true" />
                </button>
              }
            />
          </div>
        </Screen>
      )}
      {skill && skillNote && (
        <Screen className="phone-full phone-reader" onBack={() => setSkillNote(false)}>
          <Back label={skillName ?? "Back"} onClick={() => setSkillNote(false)} />
          <SkillNote skill={skill} notify={notify} />
        </Screen>
      )}
      {over}
      {searching && (
        <Palette
          actions={[
            { id: "review", label: "Start review", keywords: ["cards", "quiz"], run: () => setReviewing({ pick: null, run: 0 }) },
            { id: "today", label: "Today", keywords: ["home"], run: () => setTab("today") },
            { id: "sources", label: "Sources", keywords: ["library"], run: () => setTab("sources") },
          ]}
          recent={[...(items ?? [])].sort((a, b) => touched(b).localeCompare(touched(a))).slice(0, 8)}
          items={items ?? []}
          skills={skills}
          skill={null}
          onSkill={(id) => setSkill(id)}
          onSkillNote={(id) => (setSkill(id), setSkillNote(true))}
          onOpen={open}
          onCreated={(s) => (void refresh(), setSkill(s.id))}
          onClose={() => setSearching(false)}
        />
      )}
      {toast}
    </div>
  );
}
