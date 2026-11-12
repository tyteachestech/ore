// The iPhone shell (phase 0 feel test): the Mac's screens in a phone layout. A drawer for Today, Sources
// and the skills, as in Obsidian; a source and Review open full screen over it, with a way back.
// Everything inside the screens is the Mac app's own code.
import { openUrl } from "@tauri-apps/plugin-opener";
import { Archive, BookOpen, CaretLeft, CaretRight, Check, GearSix, GraduationCap, House, MagnifyingGlass, Plus, SidebarSimple } from "../icons";
import { flushSync } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Boundary } from "../Boundary";
import { AddLink, WaitingLinks, macOnly, type Waiting } from "./AddLink";
import { trackDrag, type Drag } from "./drag";
import { Home } from "../Home";
import { HeadTabs, type HeadTab as HeadTabT } from "../HeadTabs";
import { ranked } from "../match";
import { SkillPage } from "../SkillPage";
import { PhoneSettings } from "./Settings";
import { planReminders } from "./reminder";
import { SkillIcon } from "../IconPicker";
import { NoteBody, useNotes, type SideTab } from "../Notes";
import { PixelBook, PixelNote } from "../PixelIcon";
import type { NoteEditorHandle } from "../editor/NoteEditor";
import { holdMenu, WithMenu, type MenuAction } from "../Menu";
import { Palette } from "../Palette";
import { SkillEditor, skillGroups } from "../Skills";
import { TitleField } from "../TitleField";
import { skillMenu } from "./skill-menu";
import { courseThumb, lessonsOf, nextLesson, opt, ore, pullFromMac, shareOpen, shareSkills, type Item, type Skill, touched } from "../ore";
import { Reader } from "../Reader";
import { Review } from "../Review";
import { Thumb } from "../Thumb";
import { useToast } from "../Toast";
import { errorText, useKeptScroll, type Notify } from "../util";

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
type Place = { tab: TabId; skill: string | null; skillNote?: boolean; course?: string | null; settings?: boolean; openId: string | null; noting?: boolean; side?: SideTab; finishing?: boolean; review: { pick: string[] | null; source?: string } | null };
const PLACE = "ore-phone-place";
function loadPlace(): Place {
  try {
    return { tab: "today", skill: null, openId: null, review: null, ...JSON.parse(localStorage.getItem(PLACE) ?? "{}") };
  } catch {
    return { tab: "today", skill: null, openId: null, review: null };
  }
}

/** What a source row does, shared by its swipes and its long-press menu. `retitle` is false when the write failed. */
type RowActions = {
  archive: (item: Item) => void;
  toggle: (item: Item) => void;
  menu: (item: Item) => MenuAction[];
  retitle: (item: Item, title: string) => Promise<boolean>;
  /** A course row: a tap opens its lessons; a long press its menu. */
  course: (id: string) => void;
  courseMenu: (line: Extract<Line, { kind: "course" }>) => MenuAction[];
};

/** A list row with Mail's swipes: left archives, right moves it between To read and Done. It follows the
 *  finger, and past 40% of the row (or with a flick) the action runs; otherwise it springs back. The left
 *  edge stays the drawer's and the back swipe's. */
function SwipeRow({ item, row, onOpen }: { item: Item; row: RowActions; onOpen: (id: string) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const swiped = useRef(false);
  const [side, setSide] = useState<"left" | "right" | null>(null);
  const [renaming, setRenaming] = useState(false);
  /** An archived row only restores, to the left. */
  const only = (dx: number) => (item.archived_at ? Math.min(0, dx) : dx);
  useHorizontalDrag(ref, {
    accept: (t) => ((swiped.current = false), !renaming && t.clientX > 24),
    // iOS's half second, not the menu library's 700 ms (D145.4): Radix's trigger opens on contextmenu, and clears its own timer.
    hold: (_, y) => {
      swiped.current = true; // Letting go after the menu opened is not a tap on the row.
      holdMenu(ref.current!, y);
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
    // Rename… goes after Open, and edits the title in place (Finder, the Mac's rows); not on an archived row.
    <WithMenu actions={() => row.menu(item).flatMap((a) => (a.id === "open" && !item.archived_at ? [a, { id: "rename", label: "Rename…", run: () => setRenaming(true) }] : [a]))}>
      <li>
        {side && <span className={`phone-swipe ${side}`}>{side === "left" ? (item.archived_at ? "Restore" : "Archive") : item.status === "done" ? "To read" : "Done"}</span>}
        {renaming && (
          <div className="phone-row-rename">
            <Thumb item={item} className="thumb phone-thumb" />
            <TitleField value={item.title} onSave={(t) => row.retitle(item, t)} onClose={() => (flushSync(() => setRenaming(false)), ref.current?.focus({ preventScroll: true }))} />
          </div>
        )}
        {/* Hidden, not gone, while renaming: its swipes and hold are on this element. */}
        <button ref={ref} hidden={renaming} onClick={() => swiped.current || onOpen(item.id)} onTouchEnd={() => setTimeout(() => (swiped.current = false), 350)}>
          <Thumb item={item} className="thumb phone-thumb" />
          <span className="phone-title">{item.title}</span>
        </button>
      </li>
    </WithMenu>
  );
}

/** A list's lines: a source, or a course as one row standing for its lessons (D79), placed where its first lesson sorts. */
type Line = { kind: "item"; item: Item } | { kind: "course"; id: string; title: string; url?: string; lessons: Item[]; next: Item | null };
const toReadOrder = (a: Item, b: Item) => Number(!a.pinned_at) - Number(!b.pinned_at) || (a.pinned_at ?? "").localeCompare(b.pinned_at ?? "") || touched(b).localeCompare(touched(a));

/** The tab's rows of `list` as lines, each course once where its first lesson in the tab sorts, in To read while
 *  any lesson is left and in Done once all are (App.tsx `groups`). */
function linesOf(list: Item[], status: "toread" | "done"): Line[] {
  const seen = new Set<string>();
  return list.flatMap((item): Line[] => {
    if ((item.status === "done") !== (status === "done")) return [];
    const c = item.course;
    if (!c) return [{ kind: "item", item }];
    if (seen.has(c.id)) return [];
    seen.add(c.id);
    const lessons = lessonsOf(list, c.id);
    const next = nextLesson(lessons);
    return (status === "done") === !next ? [{ kind: "course", id: c.id, title: c.title, url: c.url, lessons, next }] : [];
  });
}

/** A course as one row (Podcasts' show): its picture, its title and the lesson a tap goes on with; the tap opens its lessons. */
function CourseRow({ line, onCourse, menu }: { line: Extract<Line, { kind: "course" }>; onCourse: (id: string) => void; menu: (line: Extract<Line, { kind: "course" }>) => MenuAction[] }) {
  const cover = courseThumb(line.lessons);
  const started = line.lessons.some((l) => l.status !== "inbox");
  return (
    <WithMenu actions={() => menu(line)} hold>
      <li>
        <button className="phone-course" onClick={() => onCourse(line.id)}>
          {cover ? <Thumb item={cover} className="thumb phone-thumb" /> : <span className="thumb phone-thumb none" aria-hidden="true"><GraduationCap size={16} /></span>}
          <span className="phone-title phone-two">
            <span>{line.title}</span>
            <small>{line.next && started ? `${line.next.course!.part} · ${line.next.title}` : `${line.lessons.length} lessons`}</small>
          </span>
          <CaretRight size={16} aria-hidden="true" />
        </button>
      </li>
    </WithMenu>
  );
}

/** The rows of one list: sources with their swipes, courses as one row each. */
function Rows({ lines, row, onOpen }: { lines: Line[]; row: RowActions; onOpen: (id: string) => void }) {
  return (
    <ul>
      {lines.map((l) => (l.kind === "course" ? <CourseRow key={`course:${l.id}`} line={l} onCourse={row.course} menu={row.courseMenu} /> : <SwipeRow key={l.item.id} item={l.item} row={row} onOpen={onOpen} />))}
    </ul>
  );
}

/** Sources by To read and Done, as one list; `flat`: as given, no sections or courses (Archive, a course's lessons). */
function SourceList({ title, items, onOpen, row, head, flat, empty = "Nothing here yet. Add a link with +." }: { title: string; items: Item[] | null; onOpen: (id: string) => void; row: RowActions; head?: ReactNode; flat?: boolean; empty?: string }) {
  // Pinned first, in the order they were pinned, as on the Mac's lists; then the latest touched.
  const sorted = [...(items ?? [])].sort(toReadOrder);
  return (
    <div className="phone-sources">
      <h1>{title}</h1>
      {head}
      {items === null ? null : !items.length ? (
        <p className="phone-empty">{empty}</p>
      ) : flat ? (
        <Rows lines={(items ?? []).map((item) => ({ kind: "item", item }))} row={row} onOpen={onOpen} />
      ) : (
        ([
          ["To read", linesOf(sorted, "toread")],
          ["Done", linesOf(items ?? [], "done")],
        ] as const).map(([label, lines]) =>
          lines.length ? (
            <section key={label}>
              <h2>{label}</h2>
              <Rows lines={lines} row={row} onOpen={onOpen} />
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

const SKILL_TABS: HeadTabT<"toread" | "done">[] = [
  { id: "toread", label: "To read", icon: PixelBook, tone: "read" },
  { id: "done", label: "Done", icon: Check, tone: "done" },
];
/** Sources a skill page lists before "Show all", as on the Mac, so Questions below stays in reach. */
const SKILL_CAP = 8;

/** The drawer's New skill: a name typed in place, as the Mac's sidebar and Files' New Folder do. Return or a tap
 *  away makes it, and its page opens; empty, it goes away. A name he already has is refused in place. */
function NewSkill({ skills, onDone }: { skills: Skill[]; onDone: (made: Skill | null) => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = async () => {
    const n = name.trim().replace(/\s+/g, " ");
    if (!n) return onDone(null);
    if (busy) return;
    const taken = skills.find((s) => s.name.toLowerCase() === n.toLowerCase());
    if (taken) return setError(`“${taken.name}” is taken`);
    setBusy(true);
    try {
      onDone(await ore<Skill>("skills", "add", n, opt("collection", "")));
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <form className="phone-new-skill" onSubmit={(e) => (e.preventDefault(), void create())}>
      <SkillIcon dot />
      <input
        autoFocus
        aria-label="New skill name"
        placeholder="Skill name"
        enterKeyHint="done"
        autoComplete="off"
        value={name}
        readOnly={busy}
        onChange={(e) => (setName(e.target.value), setError(null))}
        onBlur={() => !busy && !error && void create()}
        onKeyDown={(e) => e.key === "Escape" && onDone(null)}
      />
      {error && <p className="phone-new-error" role="alert">{error}</p>}
    </form>
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
  /** Finish has recorded the source Done: a relaunch from here on never opens Finish again (its closing moment shows). */
  const [recorded, setRecorded] = useState(false);
  useEffect(() => void (finishing || setRecorded(false)), [finishing]);
  /** `source`: Review this source, only its exercises. */
  const [reviewing, setReviewing] = useState<{ pick: string[] | null; source?: string; run: number } | null>(start.review && { pick: start.review.pick, source: start.review.source, run: 0 });
  /** The skill whose editor (name, icon, colour, collection) is open. */
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  /** The course whose lessons are open, pushed over the list it was tapped in. */
  const [course, setCourse] = useState<string | null>(start.course ?? null);
  /** The skill page's sources: To read or Done (D226's tabs), and what its search narrows them to (D203). */
  const [skillTab, setSkillTab] = useState<"toread" | "done">("toread");
  const [skillQuery, setSkillQuery] = useState("");
  const [skillAll, setSkillAll] = useState(false);
  useEffect(() => (setSkillTab("toread"), setSkillQuery(""), setSkillAll(false)), [skill]);
  const [settings, setSettings] = useState(!!start.settings);
  /** The New skill field at the end of the drawer's skills. */
  const [naming, setNaming] = useState(false);
  const newSkillRef = useRef<HTMLButtonElement>(null);
  /** Add a link from a skill's page files it there. */
  const [addTo, setAddTo] = useState<string | undefined>();
  const [tick, setTick] = useState(0);
  const { notify, view: toast } = useToast();
  const actions = useRef([]);
  const [drawer, setDrawer] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  useDrawerSwipe(shell, panel, drawer, setDrawer);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [waiting, setWaiting] = useState<Waiting[]>([]);
  const main = useRef<HTMLElement>(null);
  const cue = useRef<HTMLDivElement>(null);
  // Rendered inside the touch's own handler, so iOS lets the field take focus and bring up the keyboard.
  usePullToSearch(main, cue, () => flushSync(() => setSearching(true)));
  // The lists share this one scroller: each keeps its own place, as Mail's tabs do (and across a relaunch).
  useKeptScroll(main, `phone:${tab}`);
  const go = (t: TabId) => (setTab(t), setSkill(null), setCourse(null), setDrawer(false));

  useEffect(() => {
    try {
      localStorage.setItem(PLACE, JSON.stringify({ tab, skill, skillNote, course, settings, openId, noting, side, finishing: finishing && !recorded, review: reviewing && { pick: reviewing.pick, source: reviewing.source } } satisfies Place));
    } catch {}
  }, [tab, skill, skillNote, course, settings, openId, noting, side, finishing, recorded, reviewing]);
  const tabNow = useRef(tab);
  tabNow.current = tab;
  /** The Mac's changes have come in: every screen reads again, and the reminders follow a goal met there. */
  const pulled = () => {
    setTick((t) => t + 1);
    void refresh();
    void planReminders();
  };
  const refresh = useCallback(async () => {
    try {
      const [all, sk, w] = await Promise.all([ore<Item[]>("ls"), ore<Skill[]>("skills"), ore<Waiting[]>("inbox")]);
      setItems(all);
      setSkills(sk);
      void shareSkills(sk.filter((k) => !k.archived));
      setWaiting(w);
      setError(null);
      // The Archive list, only while it shows: listed twice on every change otherwise.
      if (tabNow.current === "archive") setArchived(await ore<Item[]>("ls", "--archived"));
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => void (tab === "archive" && refresh()), [tab, refresh]);
  // A place saved for a source that has since left the library (deleted on the Mac, or a new build) opens on
  // where he was before it, not on an error with the source's id.
  const loaded = items !== null;
  // The same for a Review this source he left open: it goes back to Today, not to an error.
  useEffect(() => {
    if (loaded && reviewing?.source && !items!.some((i) => i.id === reviewing.source)) setReviewing(null);
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = start.openId;
    if (!loaded || !id || items!.some((i) => i.id === id)) return;
    void ore<Item[]>("ls", "--archived")
      .then((archived) => {
        if (archived.some((i) => i.id === id)) return;
        // Only if he is still on it: he may have opened another source (and its note) meanwhile.
        setOpenId((now) => {
          if (now !== id) return now;
          setNoting(false);
          return null;
        });
      })
      .catch(() => {});
    // Once, on the first list: later a missing source is one he just archived from inside it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);
  // Links waiting in the inbox (added with +, or shared from another app) are imported here, by the Mac's
  // own importer (D227). One this phone can't read keeps its reason, and the Mac tries it.
  const [reading, setReading] = useState(false);
  const readingNow = useRef(false);
  // The share card's Open (D227): the app comes forward and shows what that shared item became, once it is in.
  const came = useRef(new Map<string, string>());
  const [wanted, setWanted] = useState<string | null>(null);
  const jumping = useRef<() => Promise<void>>(async () => {});
  const jump = useCallback(async () => {
    // A relaunch can cut the module's load short (WebKit rejects the import): nothing was asked for then.
    const want = await shareOpen().catch(() => null);
    if (!want) return;
    setWanted(want);
    await pullFromMac();
    await jumping.current();
  }, []);
  // Asked for while one is running (a share that arrived after it listed the inbox): it runs once more after.
  const readAgain = useRef(false);
  const bringInRef = useRef<() => Promise<void>>(async () => {});
  const bringIn = useCallback(async () => {
    if (readingNow.current) return void (readAgain.current = true);
    readingNow.current = true;
    try {
      if (!(await ore<Waiting[]>("inbox")).length) return;
      setReading(true);
      const r = await ore<{ added: { id: string; inbox: string; title: string; kept: boolean }[]; failed: { url: string; error: string }[] }>("inbox", "--import");
      for (const a of r.added) came.current.set(a.inbox, a.id);
      for (const a of r.added) notify(a.kept ? `Already here: “${a.title}”` : `Added “${a.title}”`, "info");
      for (const f of r.failed) {
        const mac = macOnly(f.error);
        notify(mac ?? `Couldn’t read ${f.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]} here. Your Mac will try it.`, mac ? "info" : "error");
      }
    } catch {
      // The list says what is still waiting.
    } finally {
      readingNow.current = false;
      setReading(false);
      void refresh().then(() => {
        if (!readAgain.current) return;
        readAgain.current = false;
        void bringInRef.current();
      });
    }
  }, [refresh, notify]);
  bringInRef.current = bringIn;
  jumping.current = () => refresh().then(bringIn);
  useEffect(() => void (jump(), refresh().then(bringIn), planReminders()), [jump, refresh, bringIn]);
  // The Mac's changes arrive through iCloud: read them in when the app comes back, and every 30 s while it shows.
  useEffect(() => {
    const check = () => void (jump(), pullFromMac().then((changed) => changed && (pulled(), void bringIn())));
    const back = () => !document.hidden && check();
    // Leaving the screen plans the reminders again: today's goes once the goal is met (the Mac's changes, in `pulled`).
    const seen = () => (document.hidden ? void planReminders() : check());
    const every = setInterval(back, 30_000);
    const failed = (e: Event) => notify(`Couldn’t save to iCloud: ${(e as CustomEvent<string>).detail}`, "error");
    addEventListener("visibilitychange", seen);
    addEventListener("ore:save-failed", failed);
    return () => (clearInterval(every), removeEventListener("visibilitychange", seen), removeEventListener("ore:save-failed", failed));
  }, [refresh, notify, bringIn]); // eslint-disable-line react-hooks/exhaustive-deps

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
      requestAnimationFrame(keepCaret);
    };
    // iOS reveals the caret just above its own keyboard, which leaves it under the note's keyboard bar: as he
    // types past it, scroll the note so the line he is writing stays above the bar (Notes keeps it in sight).
    const keepCaret = () => {
      const field = document.activeElement;
      if (!(field instanceof HTMLElement) || !field.isContentEditable || !field.closest(".phone-reader")) return;
      const sel = getSelection();
      // A caret, not a selection he is dragging out: moving the page under his finger would fight the handle.
      if (!sel?.rangeCount || !sel.isCollapsed) return;
      let caret = sel.getRangeAt(0).getBoundingClientRect();
      // On a new empty line WebKit gives the caret no box: use its line's.
      if (!caret.height) {
        const node = sel.focusNode;
        const line = node instanceof Element ? node : node?.parentElement;
        if (!line) return;
        caret = line.getBoundingClientRect();
      }
      let box: HTMLElement | null = field;
      while (box && !(box.scrollHeight > box.clientHeight && getComputedStyle(box).overflowY !== "visible")) box = box.parentElement;
      if (!caret.height || !box) return;
      const bar = document.querySelector(".kb-bar")?.getBoundingClientRect().top ?? Infinity;
      const below = caret.bottom + 24 - Math.min(box.getBoundingClientRect().bottom, bar, vv.offsetTop + vv.height);
      if (below > 0) box.scrollTop += below;
    };
    const typed = () => requestAnimationFrame(keepCaret);
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    document.addEventListener("selectionchange", typed);
    return () => {
      vv.removeEventListener("resize", fit);
      vv.removeEventListener("scroll", fit);
      document.removeEventListener("selectionchange", typed);
    };
  }, []);

  const open = (id: string, at?: string) => {
    setJumpTo(at);
    setFinishing(false);
    setNoting(false);
    setOpenId(id);
  };
  // What the share card's Open asked for, as soon as it is in the list; given up after half a minute (it
  // couldn't be read here, or another device took it), so it never pulls him out of something later.
  useEffect(() => {
    if (!wanted) return;
    const id = came.current.get(wanted);
    if (id && items?.some((i) => i.id === id)) {
      setWanted(null);
      setReviewing(null);
      open(id);
      return;
    }
    const late = setTimeout(() => setWanted(null), 30_000);
    return () => clearTimeout(late);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, items, reading]);
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
  /** A title edited in place: at once, put back if the write fails, with Undo (the Mac's retitle). */
  const retitle = async (item: Item, before: string, t: string, undoable = true): Promise<boolean> => {
    t = t.trim();
    if (!t || t === before) return true;
    setItems((all) => all?.map((i) => (i.id === item.id ? { ...i, title: t } : i)) ?? all);
    try {
      await ore("edit", item.id, "--title", t);
      if (undoable) notify(`Renamed to “${t}”`, "quiet", () => retitle(item, t, before, false), () => retitle(item, before, t, false));
      return true;
    } catch (e) {
      setItems((all) => all?.map((i) => (i.id === item.id ? { ...i, title: before } : i)) ?? all);
      if (!undoable) throw e;
      notify(errorText(e), "error");
      return false;
    } finally {
      void refresh();
    }
  };
  /** Pins a source to the top of the Sources list, or unpins it, with Undo (the Mac's pinSource). */
  const pin = async (item: Item, undoable = true) => {
    const on = !item.pinned_at;
    const set = (pinned_at: string | undefined) => setItems((all) => all?.map((i) => (i.id === item.id ? { ...i, pinned_at } : i)) ?? all);
    set(on ? new Date().toISOString() : undefined);
    try {
      await ore("pin", item.id, ...(on ? [] : ["--undo"]));
      const flip = (now: boolean) => () => pin({ ...item, pinned_at: now ? "x" : undefined }, false);
      if (undoable) notify(on ? `Pinned “${item.title}”` : `Unpinned “${item.title}”`, "quiet", flip(on), flip(!on));
    } catch (e) {
      set(item.pinned_at);
      if (!undoable) throw e;
      notify(errorText(e), "error");
    } finally {
      void refresh();
    }
  };
  const menuOf = skillMenu({
    skills,
    refresh,
    notify,
    open: (s) => (setSkill(s.id), setDrawer(false)),
    review: (s) => (setDrawer(false), setReviewing({ pick: [s.id], run: 0 })),
    edit: (s) => (setDrawer(false), setEditingSkill(s.id)),
  });
  /** A course archived from its menu: every lesson, at once, with Undo (the Mac's course Archive). */
  const archiveCourse = (c: Extract<Line, { kind: "course" }>) => {
    const apply = (on: boolean) => ore("course", "archive", c.id, ...(on ? [] : ["--undo"])).finally(refresh);
    setItems((all) => all?.filter((i) => i.course?.id !== c.id) ?? all);
    setCourse((now) => (now === c.id ? null : now));
    notify(`Archived “${c.title}”`, "info", () => apply(false), () => apply(true));
    apply(true).catch((e) => notify(errorText(e), "error"));
  };
  const row: RowActions = {
    course: setCourse,
    courseMenu: (c) => [
      { id: "open", label: c.next && c.next !== c.lessons[0] ? "Continue" : "Open", run: () => open((c.next ?? c.lessons[0]!).id) },
      { id: "lessons", label: "Show lessons", run: () => setCourse(c.id) },
      ...(c.url ? [{ id: "original", label: "Open original", run: () => void openUrl(c.url!).catch((e) => notify(errorText(e), "error")) }] : []),
      { id: "archive", label: "Archive course", danger: true, divider: true, run: () => archiveCourse(c) },
    ],
    archive: (item) => (item.archived_at ? restore(item) : void archive(item)),
    toggle: (item) => void moveTo(item, item.status === "done" ? "reading" : "done"),
    // Long-press: the Mac row menu, less what needs a Finder or a keyboard.
    retitle: (item, t) => retitle(item, item.title, t),
    menu: (item) => item.archived_at ? [
      { id: "open", label: "Open", run: () => open(item.id) },
      { id: "restore", label: "Restore", run: () => restore(item) },
    ] : [
      { id: "open", label: "Open", run: () => open(item.id) },
      { id: "review-source", label: "Review this source", run: () => setReviewing({ pick: null, source: item.id, run: 0 }) },
      { id: "pin", label: item.pinned_at ? "Unpin" : "Pin to top", run: () => void pin(item) },
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
    void planReminders();
    setTick((t) => t + 1);
  };

  // A full screen opens over the tabs, which stay underneath for the swipe back to reveal.
  const over = reviewing && (!reviewing.source || loaded) ? (
      <Screen className="phone-full" onBack={endReview}>
        <Boundary onBack={endReview}>
          <Review
            key={reviewing.run}
            pick={reviewing.pick}
            source={reviewing.source}
            skills={skills}
            onOpenSource={(item, at) => {
              endReview();
              open(item, at);
            }}
            onClose={(again) => (again ? setReviewing({ ...reviewing, run: reviewing.run + 1 }) : endReview())}
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
            onFinishRecorded={setRecorded}
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
            onPin={(item) => void pin(item)}
            onReview={(item) => setReviewing({ pick: null, source: item.id, run: 0 })}
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

  const skillOf = skills.find((s) => s.id === skill);
  const skillName = skillOf?.name;
  const courseOf = course ? lessonsOf(items ?? [], course) : [];
  // A skill gone from the library (deleted on the Mac) closes its page and note, as a gone source does.
  const skillGone = loaded && !!skill && !skillOf;
  useEffect(() => void (skillGone && (setSkill(null), setSkillNote(false))), [skillGone]);
  // A course archived or gone (on the Mac) closes its screen.
  const courseGone = loaded && !!course && !courseOf.length;
  useEffect(() => void (courseGone && setCourse(null)), [courseGone]);
  const removeWaiting = async (l: Waiting) => {
    try {
      await ore("inbox", "--remove", l.id);
      void refresh();
      notify("Removed the link", "info", () => ore("inbox", "--add", l.url, ...l.skills.flatMap((s) => ["--skill", s])).then(refresh));
    } catch (e) {
      notify(errorText(e), "error");
    }
  };

  return (
    <div className="phone-app">
      <div className={`phone-shell${drawer ? " open" : ""}`} ref={shell} style={{ "--open": drawer ? 1 : 0 } as CSSProperties}>
        <div className="phone-root">
          <header className="phone-bar">
            <button className="phone-back phone-icon" aria-label="Open menu" aria-expanded={drawer} onClick={() => setDrawer(true)}>
              <SidebarSimple size={16} aria-hidden="true" />
            </button>
            <button className="phone-back phone-icon phone-add" aria-label="Add a link" onClick={() => setAdding(true)}>
              <Plus size={16} aria-hidden="true" />
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
                sourceMenu={row.menu}
                onRename={row.retitle}
                skillMenu={menuOf}
                notify={notify}
              />
            ) : (
              <SourceList
                title={tab === "archive" ? "Archive" : "Sources"}
                items={tab === "archive" ? archived : items}
                onOpen={open}
                row={row}
                flat={tab === "archive"}
                head={tab === "sources" && <WaitingLinks links={waiting} reading={reading} onRemove={removeWaiting} />}
                empty={tab === "archive" ? "Nothing archived. Swipe a source left to archive it." : waiting.length ? "" : undefined}
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
                <WithMenu key={s.id} actions={() => menuOf(s)} hold>
                  <button onClick={() => (setSkill(s.id), setDrawer(false))}>
                    <SkillIcon icon={s.icon} color={s.color} dot />
                    <span className="phone-title">{s.name}</span>
                  </button>
                </WithMenu>
              ))}
            </section>
          ))}
          {naming ? (
            <NewSkill skills={skills} onDone={(made) => {
              // Made, the keyboard goes as its page opens (Files' New Folder); let go, focus goes back to New skill.
              if (made) (document.activeElement as HTMLElement | null)?.blur();
              flushSync(() => {
                setNaming(false);
                if (!made) return;
                setSkills((all) => [...all, made]);
                setSkill(made.id);
                setDrawer(false);
              });
              if (!made) newSkillRef.current?.focus({ preventScroll: true });
              if (made) void refresh();
            }} />
          ) : (
            <button ref={newSkillRef} className="phone-drawer-quiet" onClick={() => setNaming(true)}>
              <Plus size={16} aria-hidden="true" />
              <span className="phone-title">New skill</span>
            </button>
          )}
          <button className="phone-drawer-foot" onClick={() => (setSettings(true), setDrawer(false))}>
            <GearSix size={16} aria-hidden="true" />
            <span className="phone-title">Settings</span>
          </button>
        </nav>
      </div>
      {/* A skill's page (D46 in one column), pushed from Today or the drawer; a source opens over it. */}
      {skill && skillOf && (
        <Screen className="phone-full" onBack={() => setSkill(null)}>
          <Back label={tab === "today" ? "Today" : tab === "archive" ? "Archive" : "Sources"} onClick={() => setSkill(null)} />
          <div className="phone-page phone-skill">
            <SkillPage
              key={skill}
              skill={skillOf}
              view={<HeadTabs label="Sources shown" tabs={SKILL_TABS} value={skillTab} onChange={(v) => (setSkillTab(v), setSkillAll(false))} />}
              search={{ value: skillQuery, set: setSkillQuery, keys: () => {} }}
              targets={[]}
              blocked={false}
              onOpen={() => {}}
              onQuestion={(q) => open(q.item, q.id)}
              onOpenSource={(id) => open(id)}
              onAdded={() => void refresh()}
              onAddSource={() => (setAddTo(skill), setAdding(true))}
              onSkillChanged={() => void refresh()}
              importance={menuOf(skillOf).find((a) => a.id === "importance")?.sub ?? []}
              onBringBack={() => menuOf(skillOf).find((a) => a.id === "unarchive")?.run()}
              notify={notify}
              onFound={() => {}}
              noteRow={
                <button className="phone-note-row" onClick={() => setSkillNote(true)}>
                  <PixelNote className="card-icon" size={16} aria-hidden="true" />
                  <span className="phone-title">Your note</span>
                  <CaretRight size={16} aria-hidden="true" />
                </button>
              }
            >
              {(() => {
                const mine = (items ?? []).filter((i) => i.skills.includes(skill));
                const q = skillQuery.trim();
                // Searched, the sources that match, best first, lessons on their own (the Mac's filter, D203).
                const lines: Line[] = q ? ranked(mine, q, (i) => [i.title, i.course?.title ?? ""]).map((item) => ({ kind: "item", item })) : linesOf(skillTab === "toread" ? [...mine].sort(toReadOrder) : mine, skillTab);
                const shown = q || skillAll ? lines : lines.slice(0, SKILL_CAP);
                return (
                  <div className="phone-sources">
                    {!lines.length ? (
                      <p className="quiet">{q ? `No sources match “${q}”.` : skillTab === "done" ? "Nothing done yet." : "Nothing to read. Add a link with +."}</p>
                    ) : (
                      <Rows lines={shown} row={row} onOpen={open} />
                    )}
                    {shown.length < lines.length && (
                      <button className="answered-toggle" onClick={() => setSkillAll(true)}>
                        Show all {lines.length}
                      </button>
                    )}
                  </div>
                );
              })()}
            </SkillPage>
          </div>
        </Screen>
      )}
      {skillOf && skillNote && (
        <Screen className="phone-full phone-reader" onBack={() => setSkillNote(false)}>
          <Back label={skillName ?? "Back"} onClick={() => setSkillNote(false)} />
          <SkillNote skill={skillOf.id} notify={notify} />
        </Screen>
      )}
      {/* A course's lessons in order, pushed over the list its row was in; a lesson opens over it. */}
      {courseOf.length > 0 && (
        <Screen className="phone-full" onBack={() => setCourse(null)}>
          <Back label={skillOf?.name ?? (tab === "today" ? "Today" : "Sources")} onClick={() => setCourse(null)} />
          <div className="phone-page">
            <SourceList title={courseOf[0]!.course!.title} items={courseOf} onOpen={open} row={row} flat />
          </div>
        </Screen>
      )}
      {settings && (
        <Screen className="phone-full" onBack={() => setSettings(false)}>
          <Back label={tab === "today" ? "Today" : tab === "archive" ? "Archive" : "Sources"} onClick={() => setSettings(false)} />
          <PhoneSettings reload={tick} onPulled={pulled} notify={notify} />
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
      {adding && <AddLink skill={addTo} onClose={() => (setAdding(false), setAddTo(undefined))} onAdded={() => void refresh().then(bringIn)} />}
      {editingSkill && skills.some((s) => s.id === editingSkill) && (
        <SkillEditor
          skill={skills.find((s) => s.id === editingSkill)!}
          collections={[...new Set(skills.flatMap((s) => (s.collection ? [s.collection] : [])))]}
          onSaved={() => void refresh()}
          onClose={() => setEditingSkill(null)}
          notify={notify}
        />
      )}
      {toast}
    </div>
  );
}
