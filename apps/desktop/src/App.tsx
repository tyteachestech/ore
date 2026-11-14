import { ranked } from "./match";
import { Archive, ArrowLeft, ArrowRight, CaretDown, CaretRight, Check, Folder, GraduationCap, Tick, MagnifyingGlass, QuestionMark, SidebarSimple, X } from "./icons";
import { DotBar } from "./Ring";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { HeadTabs, type HeadTab } from "./HeadTabs";
import { PixelBook } from "./PixelIcon";
import { DndContext, useDraggable, useSensor, useSensors, type DragMoveEvent } from "@dnd-kit/core";
import { RowSensor } from "./drag";
import { blankStart, dragRows, type RowPick } from "./marquee";
import { TitleField } from "./TitleField";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type HTMLAttributes, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type Ref } from "react";
import { flushSync } from "react-dom";
import { inTextField, is, isNotes, label, useKeymap, type KeyId } from "./keys";
import { AddBox, DropOverlay, type Dropping } from "./Add";
import { copiedFiles, pastesFiles, watchCopies } from "./copied";
import { cancelOre, courseThumb, lessonsOf, loadSkills, nextLesson, ore, searchFields, pinBetween, oreJob, opt, PHONE, type Item, type Question as QuestionView, type Priority, type SearchHit, type Skill, type Tab, type Today, inTab, touched } from "./ore";
import { openOriginal, pathOf, revealInFinder } from "./original";
import { Palette, snippet, type Action } from "./Palette";
import { Tutor, TutorBubble, useTutorChat, useUnheard } from "./Tutor";
import { Radio } from "./Radio";
import { CHANNELS } from "./ambience-art";
import { stop as stopAmbience, toggle as playAmbience, ambienceState } from "./ambience";
import { Reader, type PracticeRef } from "./Reader";
import { settleNote, setSidebarShown, useSideWidth, type SideTab } from "./Notes";
import type { LinkTarget } from "./editor/NoteEditor";
import { Settings, useReminderAgent, type SettingsSection } from "./Settings";
import { Shortcuts } from "./Shortcuts";
import { SkillIcon } from "./IconPicker";
import { Hint } from "./Hint";
import { OnScreen } from "./Lite";
import { citeSources, copyCited } from "./cite";
import { MoreButton, WithMenu, type MenuAction } from "./Menu";
import { Boundary } from "./Boundary";
import { comingBackHome, Home } from "./Home";
import { Feed, feedProof, type FeedPost, type FoundFeed } from "./Feed";
import { dueSkills, lastToday, rememberToday, ReviewPick } from "./ReviewPick";
import { Review } from "./Review";
import { useToast } from "./Toast";
import { lineAfter, lineKey, type Line } from "./lines";
import { TYPE_GAP, typeJump, typesTitle } from "./typeahead";
import { readGuard } from "./reads";
import { listenMenu, setMenu } from "./menubar";
import { setQuizShortcut, setTray, trayOn } from "./quick";
import { SkillPage } from "./SkillPage";
import { Sidebar } from "./Sidebar";
import { Thumb } from "./Thumb";
import { importanceActions, LEVELS } from "./importance";
import { CHIP_LOOKS, chipLook, DeleteSkill, setChipLook, layoutOf, SkillChips, SkillEditor, skillGroups, skillMade, SkillPicker, type SkillLayout } from "./Skills";
import { addArgs, dropPoint, entries, entryName, FILE_TYPES, fileKind, manyAdded, noteImage, pastedHtml, withHtml, type Entry, type FileKind } from "./paste";
import { errorText, focusQuietly, keepScroll, keptScrolls, load, save, usable } from "./util";
import { questionText } from "./Questions";
import { byline, DETAILS, loadDetails, saveDetails, siteOf, type Detail } from "./details";
import { bigger, DEFAULT_SIZE, FONTS, PAGES, setFont, setPage, setSize, setWidth, smaller, useReading, WIDTHS } from "./reading";

/** wry on macOS reports file-drop positions in CSS points (see dropPoint). */
const MAC = navigator.userAgent.includes("Mac");

const TABS: { id: Tab; label: string; key: KeyId }[] = [
  { id: "toread", label: "To read", key: "go-toread" },
  { id: "done", label: "Done", key: "go-done" },
];

/** Source kinds as he would say them. */
const KIND: Record<string, string> = { article: "article", youtube: "video", pdf: "pdf", epub: "book", markdown: "text", snippet: "snippet" };

/** Sources a skill page lists before "Show all". */
const SKILL_CAP = 8;

/** `ore add <course link> --course` (D79). */
type CourseAdd = {
  course: { id: string; title: string };
  lessons: { id: string; title: string; part: number }[];
  filled?: { id: string }[];
  failed: { part: number; title: string; error: string }[];
  /** Adding it again: skills it was newly filed under, archived lessons brought back, its skills now, its first lesson. */
  filed: string[];
  restored: number;
  skills: string[];
  first?: { id: string; title: string; status: Item["status"] };
};
/** A source that was in the library already: what adding it again did. */
type Kept = { kept: true; filed: string[]; restored: boolean };

/** `ore status` args to `to`: back to Done (an Undo), a source keeps the finish date it had. */
const back = (i: Item, to: Item["status"]) => (to === "done" && i.status === "done" && i.finished_at ? [to, opt("at", i.finished_at)] : [to]);
const lessonFirst = (l: Extract<Line, { kind: "course" }>) => l.next ?? l.lessons[0]!;

const added = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(d.getFullYear() !== new Date().getFullYear() && { year: "numeric" }) });
};

/** Which sources the list shows, as folder tabs on the list's rule (D226): To read, Done, and Archived once
 *  there is any. The open tab's ▾ picks which details each row shows (Linear's Display properties). */
function ViewMenu({ status, archived, go, details, toggle }: { status: Tab; archived: boolean; go: (s: Tab, focusList?: boolean) => void; details: Detail[]; toggle: (d: Detail) => void }) {
  const views: HeadTab<Tab>[] = [
    { id: "toread", label: "To read", icon: PixelBook, tone: "read", keys: "go-toread" },
    { id: "done", label: "Done", icon: Check, tone: "done", keys: "go-done" },
    ...(archived || status === "archived" ? [{ id: "archived" as Tab, label: "Archived", icon: Archive, tone: "archived" }] : []),
  ];
  return (
    <HeadTabs label="Sources shown" tabs={views} value={status} onChange={(s) => go(s, false)} after={
    <DropdownMenu.Root modal={false}>
      <Hint text="Which details each row shows">
        <DropdownMenu.Trigger asChild>
          <button className="view-menu" aria-label="Row details">
            <CaretDown size={11} weight="bold" aria-hidden="true" />
          </button>
        </DropdownMenu.Trigger>
      </Hint>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="popover menu-list" align="start" sideOffset={4} collisionPadding={8}>
          {/* Linear's Display properties: toggling keeps the menu open so he sees the rows change. */}
          {DETAILS.map((c) => (
            <DropdownMenu.CheckboxItem
              key={c.id}
              className="menu-item check"
              checked={details.includes(c.id)}
              onSelect={(e) => e.preventDefault()}
              onCheckedChange={() => toggle(c.id)}
            >
              <span className="menu-tick">
                <DropdownMenu.ItemIndicator>
                  <Tick />
                </DropdownMenu.ItemIndicator>
              </span>
              <span className="menu-label">{c.label}</span>
            </DropdownMenu.CheckboxItem>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
    } />
  );
}

function empty(status: Tab, keys: Record<KeyId, string>): ReactNode {
  if (status === "toread")
    return (
      <>
        Nothing to read. Paste a link, a file or any text with <b>{label(keys.add)}</b>, or drop files here.
      </>
    );
  if (status === "archived") return <>Nothing archived. Sources you archive land here, ready to restore.</>;
  return (
    <>
      No finished sources yet. Press <b>{label(keys["finish-source"])}</b> in the reader to finish one.
    </>
  );
}

/** The tab and skill filter the app reopens on (To read on first run). */
function lastView(): { status: Tab; skill: string | null } {
  try {
    const v = JSON.parse(load("ore.view") ?? "{}");
    return { status: v.status === "done" ? "done" : "toread", skill: typeof v.skill === "string" ? v.skill : null };
  } catch {
    return { status: "toread", skill: null };
  }
}


export function App() {
  useReminderAgent();
  const [items, setItems] = useState<Item[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [status, setStatus] = useState<Tab>(() => lastView().status);
  /** Archived sources, for the Archived tab. */
  const [archived, setArchived] = useState<Item[]>([]);
  const [skill, setSkill] = useState<string | null>(() => lastView().skill);
  /** What this list's rows show besides the title (D108), remembered per list: each skill's To read,
   *  Done and Archived, and All sources', keep their own. */
  const detailView = `${skill ?? "all"}/${status}`;
  const [detailsTick, bumpDetails] = useReducer((n: number) => n + 1, 0);
  const details = useMemo(() => loadDetails(detailView), [detailView, detailsTick]);
  const toggleDetail = (d: Detail) => {
    saveDetails(detailView, details.includes(d) ? details.filter((x) => x !== d) : [...details, d]);
    bumpDetails();
  };
  /** The row menus' "Show" submenu: toggling keeps it open, so he sees the rows change (Linear's Display properties). */
  const showMenu: MenuAction = { id: "show", label: "Show", divider: true, run: () => {}, sub: DETAILS.map((d) => ({ id: d.id, label: d.label, checked: details.includes(d.id), keep: true, run: () => toggleDetail(d.id) })) };
  const [cursor, setCursor] = useState<string | null>(null);
  /** Sources picked with ⇧ or ⌘ (Linear, Finder), by id; the row actions then act on all of them.
   *  `anchor` is where a ⇧ range starts. */
  const [picked, setPicked] = useState<string[]>([]);
  const anchor = useRef<string | null>(null);
  /** Courses whose lessons are listed under their row (D79): closed by default, remembered. */
  const [openCourses, setOpenCourses] = useState<string[]>(() => {
    try {
      const ids = JSON.parse(load("ore.courses-open") ?? "[]");
      return Array.isArray(ids) ? ids : [];
    } catch {
      return [];
    }
  });
  const toggleCourse = useCallback((id: string, open?: boolean) => {
    setOpenCourses((cur) => {
      const on = open ?? !cur.includes(id);
      const next = on ? [...new Set([...cur, id])] : cur.filter((x) => x !== id);
      save("ore.courses-open", JSON.stringify(next));
      return next;
    });
  }, []);
  /** The selected row shows only once the arrow keys are used, as in Linear; the pointer hides it again. */
  const [keyed, setKeyed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  /** With no source or skill page open: Home (D58, where the app opens) or the sources list. */
  const [place, setPlace] = useState<Place>("home");
  /** Review mode (D59) over the window, for these skills (null: all). */
  /** `run` counts sessions, so "Keep going" mounts a fresh Review. */
  /** `paused`: the source he opened from a card (Open in source); Review waits, hidden, on the same card. */
  const [reviewing, setReviewing] = useState<{ pick: string[] | null; source?: string; run: number; paused?: string } | null>(null);
  /** What to review (D80), asked by ⌘R and the palette; Home asks from its own button. */
  const [asking, setAsking] = useState<Today | null>(null);
  const [homeTick, setHomeTick] = useState(0);
  /** A source just pasted or dropped in with no skill: its row opens the skill picker. */
  const [pickFor, setPickFor] = useState<string | null>(null);
  /** A highlight the reader scrolls to when it opens (a question on the skill page, D47). */
  const [jumpTo, setJumpTo] = useState<string | undefined>(undefined);
  /** A ⌘K match in a skill note: the words to find there, until the skill page has. */
  const [skillFind, setSkillFind] = useState<string | undefined>(undefined);
  const [finishing, setFinishing] = useState(false);
  const [renameSource, setRenameSource] = useState(0);
  const readerActions = useRef<MenuAction[]>([]);
  const [readerPractice] = useState<PracticeRef>(() => ({ current: null, pending: null }));
  const [palette, setPalette] = useState(false);
  /** Leaves Review as Esc does, without its end screen: a palette action run over Review goes there instead. */
  const leaveReview = useRef<(() => Promise<void>) | null>(null);
  // The tutor (D128): open, and the thread so far (kept while he moves around the app).
  const [tutorOpen, setTutorOpen] = useState(false);
  const [radioOpen, setRadioOpen] = useState(false);
  // Floating over the corner (Notion AI's default) or docked at the right, as he last chose (D128).
  const [tutorDock, setTutorDock] = useState(() => load("ore.tutor.fit") === "dock");
  const tutorDocked = tutorOpen && tutorDock;
  const openItemRef = useRef<{ id: string; title: string } | undefined>(undefined);
  const pageSkillRef = useRef<{ id: string; name: string } | undefined>(undefined);
  const tutorFrom = useRef<HTMLElement | null>(null);
  const openTutor = (message?: string) => {
    const scope = pageSkillRef.current;
    if (message) tutor.ask({ message, ...(openItemRef.current ? { item: openItemRef.current.id, title: openItemRef.current.title } : {}) }, scope ? [{ kind: "skill", id: scope.id, name: scope.name }] : []);
    if (!tutorOpen) tutorFrom.current = document.activeElement as HTMLElement | null;
    setTutorOpen(true);
  };
  const closeTutor = () => {
    const from = tutorFrom.current;
    // Focus moves only if the tutor had it (or nothing did): put away with ⌘J while he types in his note, it stays there.
    const now = document.activeElement;
    const had = !now || now === document.body || !!now.closest("aside.tutor");
    // The ✦ that opened it is hidden while the tutor is open: focus goes to the one that comes back.
    flushSync(() => setTutorOpen(false));
    if (!had) return;
    // So is the bubble it said a reply from (D159): focus goes to the mole beside it. Opened with nothing focused
    // (its shortcut, ⌘K) or from something gone since, focus goes to the mole too: the tutor's own button.
    const back = from && from !== document.body && from.isConnected ? from : document.querySelector<HTMLElement>(".tutor-bubble");
    if (back) focusQuietly(back);
  };
  const [adding, setAdding] = useState(false);
  const [help, setHelp] = useState(false);
  /** Settings (⌘,) and the section it opens on (undefined: the last one he looked at). */
  const [settings, setSettings] = useState<false | { section?: SettingsSection }>(false);
  const [editing, setEditing] = useState<string | null>(null);
  /** The skill editor opened from Rename…, with its name in edit. */
  const [renaming, setRenaming] = useState(false);
  /** The skill whose delete dialog is open. */
  const [deleting, setDeleting] = useState<string | null>(null);
  const editSkill = useCallback((id: string, rename = false) => {
    setRenaming(rename);
    setEditing(id);
  }, []);
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const ids = JSON.parse(load("ore.recent") ?? "[]");
      return Array.isArray(ids) ? ids : [];
    } catch {
      return [];
    }
  });
  const [hideSidebar, setHideSidebar] = useState(() => load("ore.sidebar") === "collapsed");
  // Its edge drags it from 180 (the title bar's buttons and a short skill name still fit) to 360, or 40% of a
  // narrow window so the content keeps its room (D44, D193). Everything sized off the sidebar reads --sidebar.
  const sideWidth = useSideWidth("ore.sidebarwidth", 216, 180, { left: true, share: 0.4, cap: 360 });
  useLayoutEffect(() => document.documentElement.style.setProperty("--sidebar", `${sideWidth.width}px`), [sideWidth.width]);
  const [notesOpen, setNotesOpen] = useState(() => load("ore.mynotes") !== "closed");
  const [sideTab, setSideTab] = useState<SideTab>(() => {
    const t = load("ore.sidetab");
    return t === "questions" || t === "original" ? t : "note";
  });
  const { width, size, page, font } = useReading();
  const keys = useKeymap();
  /** Files dragged over the window: their kinds, and the skill they would go to (null: no skill). */
  const [dropping, setDropping] = useState<{ kinds: (FileKind | null)[]; skill: string | null } | null>(null);
  /** A source row dragged toward the sidebar: the row, and the skill under the pointer. */
  const [rowDrag, setRowDrag] = useState<{ item: Item; course?: Extract<Line, { kind: "course" }>; many?: Item[]; skill: string | null; at: { x: number; y: number } } | null>(null);
  /** Where a dragged pinned row would land among the pinned (Raycast's pinned reorder). */
  const [pinDrop, setPinDrop] = useState<PinGap | null>(null);
  /** The sidebar skill under a Continue reading row dragged from Home (F10), lit as the lists light theirs. */
  const [homeDrop, setHomeDrop] = useState<string | null>(null);
  const rowSensors = useSensors(useSensor(RowSensor, { activationConstraint: { distance: 6 } }));
  const { notify, progress, clear: clearToast, view: toast } = useToast();
  const tutor = useTutorChat(notify);
  const unheard = useUnheard(tutor.turns, tutorOpen);
  const listRef = useRef<HTMLDivElement>(null);

  // Which list reads land, against the writes around them (reads.ts).
  const guard = useRef(readGuard()).current;
  const writing = guard.writing;
  /** One action's writes, one after another: an Undo pressed while its archive still saves waits for it,
   *  or the two `ore` runs race and the archive can land last, leaving it archived. Once the action's
   *  latest write settles, the list is read again; an earlier one's read would begin before a later one
   *  (an Undo) reached the library, could come back first with the row still archived, and move the
   *  selection off the row the Undo put back. */
  const inOrder = () => {
    let last: Promise<unknown> = Promise.resolve();
    let queued = 0;
    return <T,>(write: () => Promise<T>): Promise<T> => {
      const n = ++queued;
      const p = last.then(write);
      last = p.catch(() => {});
      // After `writing`'s own count of the settle, or the read would begin before it and never land.
      writing(p);
      const read = () => void (n === queued && refresh());
      p.then(read, read);
      return p;
    };
  };
  const refresh = useCallback(async () => {
    const read = guard.begin();
    try {
      const [all, gone] = await Promise.all([ore<Item[]>("ls"), ore<Item[]>("ls", "--archived")]);
      if (!read.lands()) return;
      setItems(all);
      setArchived(gone);
      setListError(null);
    } catch (e) {
      if (read.newest()) setListError(errorText(e));
    }
  }, []);

  /** Loads skills and drops a saved skill filter whose skill no longer exists. */
  const reloadSkills = useCallback(() => {
    loadSkills().then(
      (all) => {
        setSkills(all);
        setSkill((k) => (k && !all.some((s) => s.id === k) ? null : k));
      },
      // Try again while `ore` is still down says so again in the same toast.
      (e) => notify(errorText(e), "error", undefined, undefined, undefined, undefined, "skills"),
    );
  }, [notify]);

  /** Loads the sources and the skills, at launch and on a Try again after `ore` failed. */
  const reload = useCallback(() => {
    void refresh();
    reloadSkills();
  }, [refresh, reloadSkills]);
  useEffect(reload, [reload]);
  // Links added on the iPhone wait in the library's inbox (D223): the Mac imports them when it opens or comes
  // back to the front, and the lists read in whatever else the phone changed meanwhile.
  useEffect(() => {
    let busy = false;
    const fromPhone = async () => {
      if (busy) return;
      busy = true;
      try {
        const r = await ore<{ added: { title: string; kept: boolean }[]; failed: { url: string; error: string }[]; filled?: unknown[] }>("inbox", "--import");
        const fresh = r.added.filter((a) => !a.kept);
        if (fresh.length) notify(fresh.length === 1 ? `Added “${fresh[0]!.title}” from your iPhone` : `Added ${fresh.length} sources from your iPhone`, "info");
        for (const a of r.added.filter((a) => a.kept)) notify(`Already here: “${a.title}”, from your iPhone`, "info");
        for (const f of r.failed) notify(`Couldn’t add ${f.url} from your iPhone: ${f.error}`, "error");
        if (r.added.length || r.filled?.length) reload();
      } catch (e) {
        notify(`Couldn’t bring in links from your iPhone: ${errorText(e)}`, "error");
      } finally {
        busy = false;
      }
    };
    // A moment after launch: the calls that draw Home go first (each `ore` call is a process of its own).
    const first = setTimeout(() => void fromPhone(), 1500);
    // Only after a real absence (10 s away): a click on a menu or a dialog closing doesn't reload the lists.
    let left = 0;
    // Focus moving into the video player (an iframe) blurs the window too: that isn't away.
    const away = () => setTimeout(() => document.activeElement?.tagName !== "IFRAME" && (left = Date.now()));
    const back = () => {
      if (!left || Date.now() - left < 10_000) return;
      left = 0;
      void refresh();
      void fromPhone();
    };
    addEventListener("blur", away);
    addEventListener("focus", back);
    return () => (clearTimeout(first), removeEventListener("blur", away), removeEventListener("focus", back));
  }, [notify, refresh, reload]);

  useEffect(() => save("ore.view", JSON.stringify({ status, skill })), [status, skill]);

  const openSource = useCallback((id: string, at?: string) => {
    setJumpTo(at);
    setCursor(id);
    setFinishing(false);
    setOpenId(id);
    setRecent((r) => {
      const next = [id, ...r.filter((x) => x !== id)].slice(0, 7);
      save("ore.recent", JSON.stringify(next));
      return next;
    });
  }, []);

  /** Where he is; a new object each time he moves, so an add can tell whether he moved on while it ran. */
  const where = useMemo(() => ({ openId, skill, status, place }), [openId, skill, status, place]);
  const viewRef = useRef(where);
  viewRef.current = where;

  /** `ore add` each entry in turn, filed under the skills in `to`. One source added by hand opens in the
   *  reader (D109), with the skill picker open if it landed with no skill; Undo archives it and goes back.
   *  Otherwise (a list, a course, Learn this, or he moved on or was reading while it was added) he stays
   *  where he is: the toast says what went in, with Show (the last one selected in To read, on the open
   *  skill's page if it's one of them, else the first one's) and Undo (archives what was new). A paste or
   *  drop of a list that landed with no skill goes to its row with the skill picker open. Returns the first error (shown as a toast unless the caller shows it)
   *  and the entries that failed, so the add box can keep only those and a retry never adds the rest twice. */
  const addSources = useCallback(
    async (list: Entry[], to: string[], toastError = true, pickAfter = false, forQuestion?: string): Promise<{ failure: string | null; failed: Entry[]; first: string | null; cancelled: boolean }> => {
      let last: Item | null = null;
      // Cancel on the toast stops the entry being added (`ore` takes out what it wrote) and skips the
      // rest; the entries already in stay, as Finder keeps the files a cancelled copy finished.
      const job = `add-${Date.now()}-${Math.random()}`;
      let cancelled = false;
      const stopped: Entry[] = [];
      const cancel = PHONE ? undefined : () => ((cancelled = true), void cancelOre(job));
      let first: string | null = null;
      /** Where he was when the add began: an add that finishes after he moved on never takes him away. */
      const from = viewRef.current;
      let failure: string | null = null;
      const failed: Entry[] = [];
      const fresh: string[] = [];
      let added = "";
      /** Entries of a list that were in the library already (the same file dropped twice, a link added before). */
      let here = 0;
      /** Steps that take back what adding something already here did (a skill filed, a restore). */
      const revert: (() => Promise<unknown>)[] = [];
      const redo: (() => Promise<unknown>)[] = [];
      const names = (ids: string[]) => ids.map((k) => skills.find((s) => s.id === k)?.name ?? k).join(", ");
      /** Says what adding something already here did, and how to take it back. */
      const again = (title: string, done: boolean, filed: string[], restored: boolean, setSkills: (ids: string[]) => Promise<unknown>, setArchived: (on: boolean) => Promise<unknown>, now: string[]) => {
        if (filed.length) {
          revert.push(() => setSkills(now.filter((k) => !filed.includes(k))));
          redo.push(() => setSkills(now));
        }
        if (restored) {
          revert.push(() => setArchived(true));
          redo.push(() => setArchived(false));
        }
        // A finished source sits under Done, not To read: say so, or he looks for it in the wrong list.
        const where = done ? ", under Done" : "";
        return filed.length
          ? `Added “${title}” to ${names(filed)}${restored ? ", back from Archived" : where}`
          : restored
            ? `“${title}” is back from Archived`
            : `“${title}” is already ${to.length ? `in ${names(to)}` : "here"}${where}`;
      };
      for (const [i, e] of list.entries()) {
        if (cancelled) {
          stopped.push(e);
          continue;
        }
        const { args, stdin } = addArgs(e);
        const course = args.includes("--course");
        // A list fills its bar entry by entry; a course by lesson, as `ore add --course` reports each one;
        // audio as it is transcribed (D96).
        progress(course ? "Reading the course…" : list.length > 1 ? `Adding ${i + 1} of ${list.length}…` : "Adding…", list.length > 1 && !course ? i / list.length : undefined, cancel);
        // A tutor reply streams on the same channel (its payload has no count).
        const stop = await listen<{ done: number; of: number; label: string }>("ore-progress", ({ payload: p }) =>
          cancelled || typeof p.done !== "number" || progress(course ? `Adding “${p.label}” · lesson ${p.done + 1} of ${p.of}` : `${p.label}…`, p.done / p.of, cancel),
        ).catch(() => () => {});
        try {
          const r = await oreJob<Item | CourseAdd>(job, stdin, ...args, ...to.map((k) => opt("skill", k)), ...(forQuestion ? [opt("for", forQuestion)] : [])).finally(stop);
          if ("course" in r && "lessons" in r) {
            // A course (D79): every lesson it could add, in order; a lesson that failed says why, and adding
            // the link again adds only the lessons still missing.
            const lesson = r.lessons[0];
            if (lesson) last = { id: lesson.id, title: lesson.title } as Item;
            fresh.push(...r.lessons.map((l) => l.id));
            // Lessons added before D92 as bare videos get their page's text when the link is added again.
            const filled = r.filled?.length ? `added the page text to ${r.filled.length} lesson${r.filled.length > 1 ? "s" : ""}` : "";
            const id = r.course.id;
            added = r.lessons.length
              ? `Added ${r.lessons.length} lessons of “${r.course.title}”${filled ? `; ${filled}` : ""}`
              : filled
                ? `“${r.course.title}”: ${filled}`
                : again(r.course.title, r.first?.status === "done", r.filed, r.restored > 0, (ids) => ore("course", "set", id, opt("skills", ids.join(","))), (on) => ore("course", "archive", id, ...(on ? [] : ["--undo"])), r.skills);
            if (!r.lessons.length && !filled) here++;
            if (!r.lessons.length && r.first) last = { ...r.first } as Item;
            if (r.failed.length) {
              failure ??= `${added}. Lesson ${r.failed[0]!.part}${r.failed.length > 1 ? ` and ${r.failed.length - 1} more` : ""} failed: ${r.failed[0]!.error} Add the link again to retry just those.`;
              failed.push(e);
            } else if (!r.lessons.length && !r.first) last = null;
          } else {
            last = r;
            first ??= r.id;
            // Here already (core keeps one copy): say what adding it again did.
            const k = r as Item & Partial<Kept>;
            if (k.kept) here++;
            if (k.kept) added = again(r.title, r.status === "done", k.filed ?? [], !!k.restored, (ids) => ore("edit", r.id, "--skills", ids.join(",")), (on) => ore("archive", r.id, ...(on ? [] : ["--undo"])), r.skills);
            else fresh.push(r.id);
          }
        } catch (err) {
          if (cancelled) {
            stopped.push(e);
            continue;
          }
          failure ??= list.length > 1 ? `${entryName(e)}: ${errorText(err)}` : errorText(err);
          failed.push(e);
        }
      }
      await refresh();
      // Filed under an archived skill, it brought the skill back (D173).
      if (to.some((id) => skills.some((s) => s.id === id && s.archived))) reloadSkills();
      const at = last?.id;
      // Show opens the tab it is in: a source he finished is under Done.
      const done = (last as Item | null)?.status === "done";
      const show = () => {
        if (!at) return;
        setStatus(done ? "done" : "toread");
        setPlace("sources");
        setSkill((k) => (k && to.includes(k) ? k : (to[0] ?? null)));
        setCursor(at);
        setOpenId(null);
        setFinishing(false);
      };
      // One source added by hand, while not reading and still where he was: it opens (D109).
      const opens = !!at && !failure && !forQuestion && list.length === 1 && !!first && first === at && !from.openId && viewRef.current === from;
      if (opens) {
        openSource(at);
        if (pickAfter && !to.length) setPickFor(at);
      }
      // Pasted or dropped where no skill was in play, with no box to pick one in: its row, picker open.
      else if (at && (failure || (pickAfter && !to.length && list.length === 1))) {
        show();
        if (!failure) setPickFor(at);
      }
      // Undo archives only what this add made (files and cards kept), never a source that was here already.
      // Run only from the history, which puts a failed step back and says why.
      const archive = (on: boolean) => Promise.all(fresh.map((id) => ore("archive", id, ...(on ? [] : ["--undo"])))).finally(refresh);
      const message = added && list.length === 1 ? added : last ? (list.length > 1 ? manyAdded(list.length - stopped.length - failed.length, here) : `Added “${last.title}”`) : "";
      const run = (steps: (() => Promise<unknown>)[]) => Promise.all(steps.map((f) => f())).finally(refresh);
      // A list can hold both new sources and ones here already: Undo takes back both.
      const undo = fresh.length || revert.length
        ? () => {
            if (opens && fresh.length) setOpenId((id) => (id === at ? null : id));
            return Promise.all([fresh.length && archive(true), revert.length && run(revert)]);
          }
        : undefined;
      const redoAll = fresh.length || redo.length ? () => Promise.all([fresh.length && archive(false), redo.length && run(redo)]) : undefined;
      if (failure) {
        if (toastError) notify(failure, "error");
        else clearToast();
        // What did go in before one failed is still his to take back with ⌘Z.
        if (message && undo) notify(message, "quiet", undo, redoAll);
      } else if (message) notify(message, "info", undo, redoAll, opens ? undefined : show);
      return { failure, failed: [...failed, ...stopped], first, cancelled };
    },
    [notify, progress, refresh, skills, openSource, reloadSkills],
  );

  /** New sources go to the skill whose page is open, else no skill. */
  const addTo = !openId && skill && skills.some((s) => s.id === skill) ? skill : null;

  const files = (paths: string[]): Entry[] => paths.map((path) => ({ kind: "file", path }));
  /** The files he picks in the system's Open panel; none when he cancels. */
  const chooseFiles = useCallback(async () => {
    const picked = await openDialog({ multiple: true, directory: false, filters: [{ name: "Sources", extensions: FILE_TYPES }] });
    return picked === null ? [] : Array.isArray(picked) ? picked : [picked];
  }, []);
  const pickFiles = useCallback(async () => {
    setAdding(false);
    const paths = await chooseFiles();
    if (paths.length) await addSources(files(paths), addTo ? [addTo] : [], true, true);
  }, [addSources, addTo, chooseFiles]);

  // Dropping files: onto a skill in the sidebar files them there; anywhere else, under the open skill
  // page or in All sources. The webview gets no DOM drag events for files, so the target is found from the
  // pointer position Tauri reports (see dropPoint).
  const dropRef = useRef({ addSources, addTo });
  dropRef.current = { addSources, addTo };
  // Images dropped on a note go into the note, as in Notion (NoteEditor shows where and puts them in).
  useEffect(() => {
    let kinds: (FileKind | null)[] = [];
    let paths: string[] = [];
    let note: HTMLElement | null = null;
    const target = (p: { x: number; y: number }) => {
      const { x, y } = dropPoint(p, MAC, devicePixelRatio);
      const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop-skill]");
      return el ? el.dataset.dropSkill || null : dropRef.current.addTo;
    };
    /** The note under the pointer, when every file dragged is an image a note can hold. */
    const noteAt = (p: { x: number; y: number }) => {
      if (!paths.length || !paths.every(noteImage)) return null;
      const { x, y } = dropPoint(p, MAC, devicePixelRatio);
      const el = document.elementFromPoint(x, y)?.closest<HTMLElement>(".note-editor");
      return el ? { el, x, y } : null;
    };
    const tell = (el: HTMLElement, type: string, detail: unknown) => el.dispatchEvent(new CustomEvent(type, { detail }));
    /** Moves the note's drop line to `to`, taking it off a note the pointer left. */
    const over = (to: ReturnType<typeof noteAt>) => {
      if (note && note !== to?.el) tell(note, "ore-image-drag", null);
      note = to?.el ?? null;
      if (to) tell(to.el, "ore-image-drag", { x: to.x, y: to.y });
    };
    const off = getCurrentWebview().onDragDropEvent((e) => {
      const p = e.payload;
      if (p.type === "enter") {
        kinds = p.paths.map(fileKind);
        paths = p.paths;
      }
      if (p.type === "enter" || p.type === "over") {
        const n = noteAt(p.position);
        over(n);
        setDropping(kinds.length && !n ? { kinds, skill: target(p.position) } : null);
      } else if (p.type === "leave") {
        over(null);
        setDropping(null);
      }
      else if (p.type === "drop") {
        setDropping(null);
        paths = p.paths;
        const n = noteAt(p.position);
        over(null);
        if (n) tell(n.el, "ore-image-drop", { paths: p.paths, x: n.x, y: n.y });
        else if (p.paths.length) {
          const to = target(p.position);
          void dropRef.current.addSources(files(p.paths), to ? [to] : [], true, true);
        }
      }
    });
    return () => {
      void off.then((f) => f());
    };
  }, []);

  // A link copied in another app is offered when the add box opens (copied.ts).
  useEffect(watchCopies, []);

  // Pasting anywhere outside a text field adds what was pasted, as Raindrop does with a link.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement;
      // A paste a text field took (the note editor replaces the very line it landed on, so its target is gone by now).
      if (e.defaultPrevented || t.isContentEditable || t.closest("input, textarea, [contenteditable]") || overlayRef.current) return;
      const d = e.clipboardData;
      const add = (list: Entry[]) => {
        const to = dropRef.current.addTo;
        void dropRef.current.addSources(list, to ? [to] : [], true, true);
      };
      // A file copied in Finder pastes only its name: its path comes from the pasteboard.
      if (pastesFiles(d)) {
        e.preventDefault();
        void copiedFiles().then((list) => (list.length ? add(list) : notify("Couldn't read the copied file. Drag it in, or pick it with ⌘O.", "error")));
        return;
      }
      const text = d?.getData("text/uri-list") || d?.getData("text/plain") || "";
      const list = withHtml(entries(text), { text, html: pastedHtml(d) });
      if (!list.length) return;
      e.preventDefault();
      add(list);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [notify]);

  /** The list takes the keys on the next frame, once it is on screen; never from a sheet opened in that
   *  frame (⌘R right after All sources: What to review was left without the keys, F64). */
  const listTakesKeys = () => requestAnimationFrame(() => document.querySelector('[aria-modal="true"]') || listRef.current?.focus({ preventScroll: true }));
  /** `focusList`: off for a folder tab chosen by click or arrow, which keeps focus so the next arrow moves on (F44). */
  const go = useCallback((s: Tab, focusList = true) => {
    setStatus(s);
    setPlace("sources");
    setOpenId(null);
    setFinishing(false);
    // The list takes the keys at once (Linear's ⌘1), also when it was not on screen (Home, a source).
    if (focusList) listTakesKeys();
  }, []);


  // The quick quiz (D76): its shortcut and menu bar item live here, since this window is always loaded.
  // "Open in source" there opens it here; putting it away refreshes Home's ring.
  const quizKey = keys["quick-quiz"];
  useEffect(() => {
    setQuizShortcut(quizKey).catch((e) => notify(errorText(e), "error"));
    void setTray(trayOn(), quizKey).catch(() => {});
  }, [quizKey, notify]);
  useEffect(() => {
    const opened = listen<{ item: string; at: string | null }>("open-source", ({ payload }) => {
      setReviewing(null);
      openSource(payload.item, payload.at ?? undefined);
    });
    const closed = listen("quiz-closed", () => setHomeTick((n) => n + 1));
    const changed = listen("ratings-changed", () => setHomeTick((n) => n + 1));
    return () => {
      for (const p of [opened, closed, changed]) void p.then((un) => un());
    };
  }, [openSource]);

  // The Mac menu bar: rebuilt when a shortcut or the screen changes, so Source and Review items
  // are greyed out where they do nothing.
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const [sound, setSound] = useState(false);
  useEffect(() => setMenu(keys, { reader: !!openId, review: !!reviewing, sound: !!openId && sound }), [keys, openId, reviewing, sound]);
  useEffect(() => {
    const un = listenMenu(() => keysRef.current);
    return () => void un.then((f) => f());
  }, []);

  /** A skill's page (D46): its stats, skill note, questions and sources. */
  const openSkill = useCallback((id: string | null) => {
    setSkillFind(undefined);
    setOpenId(null);
    setFinishing(false);
    setSkill(id);
    if (!id) {
      setPlace("sources");
      // From Home the list was not on screen: it takes the keys at once, as `go` does (⌘K → All sources, then ↓ ↵).
      listTakesKeys();
    }
  }, []);

  const goHome = useCallback(() => {
    setOpenId(null);
    setFinishing(false);
    setSkill(null);
    setPlace("home");
  }, []);

  /** The Feed: posts from what he follows, none saved until he keeps something from one. */
  const goFeed = useCallback(() => {
    setOpenId(null);
    setFinishing(false);
    setSkill(null);
    setPlace("feed");
  }, []);
  /** ⌘N's Follow: the feed behind a link; Undo unfollows, Show opens the Feed. */
  const followFeed = useCallback(async (url: string, to: string[]): Promise<string | null> => {
    try {
      const r = await ore<{ feed: { url: string; title: string }; already: boolean; found: FoundFeed }>("feed", "follow", url, ...to.map((k) => opt("skill", k)));
      setFeedTick((n) => n + 1);
      if (r.already) notify(`Already following ${r.feed.title}`, "info", undefined, undefined, goFeed);
      else notify(`Following ${r.feed.title} · ${feedProof(r.found)}`, "info", () => ore("feed", "unfollow", r.feed.url).then(() => setFeedTick((n) => n + 1)), () => ore("feed", "follow", url, ...to.map((k) => opt("skill", k))).then(() => setFeedTick((n) => n + 1)), goFeed);
      return null;
    } catch (e) {
      return errorText(e);
    }
  }, [notify, goFeed]);
  /** Feed posts open as previews; leaving one keeps it if he highlighted or wrote in it, else drops it. */
  const previews = useRef(new Map<string, string>());
  const [feedTick, setFeedTick] = useState(0);
  const opening = useRef<{ url: string; from: unknown } | null>(null);
  const openPost = useCallback(async (post: FeedPost) => {
    const from = viewRef.current;
    // A second click or Enter on the post already loading waits for the first. (Asked again after going
    // away and coming back, it is a new ask: the first one is let go.)
    if (opening.current?.url === post.url && opening.current.from === from) return;
    const ask = (opening.current = { url: post.url, from });
    try {
      const r = await ore<{ id: string; title: string; preview: boolean }>("feed", "open", post.url);
      // He went elsewhere, or opened another post, while it loaded: it never opens over that, and its preview goes.
      const mine = opening.current === ask;
      if (mine) opening.current = null;
      // (Unless he has asked for this same post again: that ask opens this preview.)
      if (viewRef.current !== from || !mine) return void (r.preview && opening.current?.url !== post.url && ore("feed", "close", r.id).catch(() => {}));
      if (r.preview) previews.current.set(r.id, r.title);
      openSource(r.id);
    } catch (e) {
      if (opening.current === ask) opening.current = null;
      notify(errorText(e), "error");
    }
  }, [openSource, notify]);
  const lastOpen = useRef<string | null>(null);
  useEffect(() => {
    const left = lastOpen.current;
    lastOpen.current = openId;
    if (!left || left === openId || !previews.current.has(left)) return;
    const title = previews.current.get(left)!;
    previews.current.delete(left);
    settleNote(left).then((saved) => saved ? ore<{ result: string }>("feed", "close", left) : null).then(
      (r) => {
        if (!r) { previews.current.set(left, title); return; } // A failed note keeps its preview and draft, and leaving again retries.
        if (r.result === "kept") {
          notify(`Kept “${title}” in your library`);
          void refresh();
        }
        setFeedTick((n) => n + 1);
      },
      (e) => notify(errorText(e), "error"),
    );
  }, [openId, notify, refresh]);
  // New posts are checked every few hours while the app runs, as well as when the Feed opens.
  useEffect(() => {
    const t = setInterval(() => void ore("feed", "--refresh").then(() => setFeedTick((n) => n + 1), () => {}), 3 * 3600_000);
    return () => clearInterval(t);
  }, []);

  /** ⌘R from anywhere: the reader closes, so none of its keys fire under the review. */
  /** The source open when review started: leaving review puts him back in it, where he was. */
  const beforeReview = useRef<string | null>(null);
  /** `source`: Review this source, only its exercises. */
  const startReview = useCallback((pick: string[] | null, source?: string) => {
    setOpenId((id) => {
      beforeReview.current = id;
      return null;
    });
    setFinishing(false);
    setReviewing((r) => ({ pick, source, run: (r?.run ?? 0) + 1 }));
  }, []);

  /** ⌘R: ask what to review when more than one skill has cards due, else start. Home's last numbers
   *  open the picker at once; fresh ones replace them when they land. */
  const askReview = useCallback(() => {
    const show = (t: Today) => (dueSkills(t, skills).length > 1 ? setAsking(t) : startReview(null));
    const seen = lastToday();
    if (seen) show(seen);
    ore<Today>("today").then(
      (t) => {
        rememberToday(t);
        if (seen) setAsking((cur) => (cur ? t : cur));
        else show(t);
      },
      () => !seen && startReview(null),
    );
  }, [skills, startReview]);

  const endReview = useCallback(
    (again?: boolean) => {
      // Keep going after Review this source stays on that source.
      setReviewing((r) => (again ? { pick: null, source: r?.source, run: (r?.run ?? 0) + 1 } : null));
      if (!again && beforeReview.current) setOpenId(beforeReview.current);
      setHomeTick((n) => n + 1);
      void refresh();
    },
    [refresh],
  );

  // Leaving the source he opened from a card (Esc, the Back pill, a link) goes back to Review, on that card.
  useEffect(() => {
    if (reviewing?.paused && openId !== reviewing.paused) {
      setReviewing((r) => r && { pick: r.pick, source: r.source, run: r.run });
      setOpenId(null);
    }
  }, [openId, reviewing?.paused]);

  /** A link in a note (D39): a source opens in the reader, a skill opens its page. */
  const openLink = useCallback(
    (t: Omit<LinkTarget, "title">) => {
      // A link outlives what it points at (a skill deleted, a source folder removed in Finder).
      const there = t.kind === "skill" ? skills.some((s) => s.id === t.id) : !items || [...items, ...archived].some((i) => i.id === t.id);
      if (!there) return notify(`That ${t.kind === "skill" ? "skill" : "source"} is no longer in your library. Edit the link to point somewhere else, or remove it.`, "error");
      if (t.kind === "item") openSource(t.id);
      else openSkill(t.id);
    },
    [openSource, openSkill, skills, items, archived, notify],
  );

  const targets: LinkTarget[] = useMemo(
    () => [
      ...skills.map((s) => ({ kind: "skill" as const, id: s.id, title: s.name })),
      ...[...(items ?? [])].sort((a, b) => b.captured_at.localeCompare(a.captured_at)).map((i) => ({ kind: "item" as const, id: i.id, title: i.title })),
    ],
    [skills, items],
  );

  // With the sidebar hidden, resting on the left edge or the toggle floats it out after a short delay,
  // as Notion and Arc do; it slides away once the pointer leaves, unless a field in it has focus.
  const [peek, setPeek] = useState(false);
  const peekTimer = useRef(0);
  const peekIn = useCallback(() => {
    clearTimeout(peekTimer.current);
    peekTimer.current = window.setTimeout(() => setPeek(true), 200);
  }, []);
  const peekOut = useCallback(() => clearTimeout(peekTimer.current), []);
  /** The sidebar is going away with focus in it: focus goes to the view's list where it has one (Tyler,
   *  2026-11-08), else the text or the page's first control, never to <body> with it. */
  const leaveSidebar = useCallback(() => {
    if (!document.activeElement?.closest(".sidebar")) return;
    setTimeout(() => (listRef.current ?? document.querySelector<HTMLElement>(".reader-scroll") ?? document.querySelector<HTMLElement>("main :is(button, a[href], [tabindex='0'])"))?.focus({ preventScroll: true }));
  }, []);
  // Out, it goes 300 ms after anything that can let it go, unless something still holds it: the pointer
  // on it, the edge or the toggle, a field in it, or one of its menus (portaled outside it, so its
  // trigger in the sidebar, open, stands for it). Not on the sidebar's mouseleave alone: the pointer on
  // one of its menus has left it, and Esc from its field or a menu, or a pick, moves no pointer.
  useEffect(() => {
    if (!peek) return;
    let t = 0;
    const held = () =>
      !!(document.querySelector(".sidebar:hover, .side-edge:hover, .side-toggle:hover, .sidebar[data-state=open], .sidebar [data-state=open]") || document.activeElement?.closest(".sidebar input"));
    const look = () => {
      clearTimeout(t);
      t = window.setTimeout(() => !held() && (leaveSidebar(), setPeek(false)), 300);
    };
    const events = ["pointerout", "pointerup", "keyup", "focusout"] as const;
    for (const e of events) document.addEventListener(e, look);
    return () => {
      clearTimeout(t);
      for (const e of events) document.removeEventListener(e, look);
    };
  }, [peek, leaveSidebar]);

  // In a narrow window, a source with its note open hides the sidebar so the column keeps its measure
  // (D27), as Notion does; it comes back when the window widens or the note closes. ⌘\ still shows it.
  const narrow = useNarrow(1100);
  // One panel at the right: the docked tutor takes the side panel's place, which comes back when it closes.
  const sideShown = notesOpen && !tutorDocked;
  const autoHide = !!openId && (sideShown || tutorDocked) && narrow;
  const [showAnyway, setShowAnyway] = useState(false);
  useEffect(() => setShowAnyway(false), [autoHide]);
  const collapsed = hideSidebar || (autoHide && !showAnyway);
  // A right-hand panel gives back what the shown sidebar takes past 216 (D193).
  useLayoutEffect(() => setSidebarShown(collapsed ? 0 : sideWidth.width), [collapsed, sideWidth.width]);

  const toggleSidebar = useCallback(() => {
    clearTimeout(peekTimer.current);
    setPeek(false);
    if (!collapsed) leaveSidebar();
    if (autoHide && !hideSidebar) return setShowAnyway((v) => !v);
    setHideSidebar((v) => {
      save("ore.sidebar", v ? "open" : "collapsed");
      return !v;
    });
  }, [autoHide, hideSidebar, collapsed, leaveSidebar]);

  /** Back from Settings; Home re-reads the goal it may have changed. */
  const closeSettings = useCallback(() => {
    setSettings(false);
    setHomeTick((n) => n + 1);
  }, []);

  const setSideOpen = useCallback((open: boolean) => {
    save("ore.mynotes", open ? "open" : "closed");
    setNotesOpen(open);
  }, []);
  /** The reader's side panel (D75): opens on `tab`, or closes when it already shows it. `stay` keeps it open. */
  const showSide = useCallback(
    (tab: SideTab, stay = false) => {
      save("ore.sidetab", tab);
      setSideTab(tab);
      if (tutorDocked) setTutorOpen(false);
      setSideOpen(stay || !(sideShown && sideTab === tab));
    },
    [sideShown, tutorDocked, sideTab, setSideOpen],
  );
  /** The side panel toggle: with the tutor docked in its place, the panel comes back and the tutor closes. */
  const toggleSide = useCallback(() => {
    if (tutorDocked) setTutorOpen(false);
    setSideOpen(!sideShown);
  }, [tutorDocked, sideShown, setSideOpen]);
  const toggleNotes = useCallback(() => showSide("note"), [showSide]);

  /** Learn this's Read now (D97): the source he went to and the passage he left, for the Back pill. */
  const [sideQuest, setSideQuest] = useState<{ to: string; from: { id: string; title: string }; question: string } | null>(null);
  useEffect(() => {
    if (sideQuest && openId !== sideQuest.to && openId !== sideQuest.from.id) setSideQuest(null);
  }, [openId, sideQuest]);
  const learnAdd = useCallback(
    async (urls: string[], to: string[], question: string, now: boolean, from: { id: string; title: string }) => {
      const here = viewRef.current;
      const r = await addSources(urls.map((url) => ({ kind: "link" as const, url })), to, true, false, question);
      // Read now, unless he went elsewhere while it was added.
      if (!now || !r.first || viewRef.current !== here) return;
      setSideQuest({ to: r.first, from, question });
      openSource(r.first);
      // His question waits in the panel, at the top as "May be answered here": what he writes there answers it (D75).
      showSide("questions", true);
    },
    [addSources, openSource, showSide],
  );

  const history = useHistory({ openId, skill, status, place }, (v, by) => {
    if (v.openId && !(items ?? []).some((i) => i.id === v.openId)) return false;
    if (v.skill && !skills.some((s) => s.id === v.skill)) return false;
    if (by < 0 && v.place === "home" && !v.openId && !v.skill) comingBackHome();
    setJumpTo(undefined);
    setFinishing(false);
    setStatus(v.status);
    setPlace(v.place);
    setSkill(v.skill);
    setOpenId(v.openId);
    if (v.openId) setCursor(v.openId);
    return true;
  });

  const onSkillPage = !openId && !!skill && skills.some((s) => s.id === skill);
  /** The sidebar row a source sits under (Finder, Linear): the skill he came from when it holds the
   *  source, else the source's first skill, else All sources. */
  const openItem = openId ? (items ?? []).find((i) => i.id === openId) : undefined;
  openItemRef.current = openItem;
  /** The skill whose page is the tutor's context (D191): none when it has no sources, which would leave it nothing to search. */
  const pageSkill = onSkillPage && (items ?? []).some((i) => i.skills.includes(skill!)) ? skill : null;
  pageSkillRef.current = pageSkill ? skills.find((s) => s.id === pageSkill) : undefined;
  const sideSkill = !openItem ? skill : skill && openItem.skills.includes(skill) ? skill : (openItem.skills.find((k) => skills.some((s) => s.id === k)) ?? null);
  /** The course the open source is a lesson of (D79). */
  const openCourse = openId ? (items ?? []).find((i) => i.id === openId)?.course?.id : undefined;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Review and its picker handle their own keys; ⌘K and ⌘/ still open over Review (controls-08).
      if (asking || (reviewing && !reviewing.paused && !is(e, "palette") && !is(e, "shortcuts") && !is(e, "ambience"))) return;
      if (is(e, "settings")) {
        e.preventDefault();
        setPalette(false);
        setAdding(false);
        setHelp(false);
        setEditing(null);
        setDeleting(null);
        return settings ? closeSettings() : setSettings({});
      }
      if (settings) {
        // Settings handles its own keys; ⌘K and ⌘/ still work over it, leaving it (Linear).
        if (!is(e, "palette") && !is(e, "shortcuts")) return;
        closeSettings();
      }
      const close = () => {
        e.preventDefault();
        setPalette(false);
        setAdding(false);
        setHelp(false);
        setEditing(null);
        setDeleting(null);
      };
      if (is(e, "palette")) {
        close();
        setPalette(!palette);
      } else if (is(e, "tutor")) {
        close();
        if (tutorOpen) closeTutor();
        else openTutor();
      } else if (is(e, "ambience") && !PHONE) {
        close();
        setRadioOpen((o) => !o);
      } else if (is(e, "add")) {
        close();
        setAdding(true);
      } else if (is(e, "file")) {
        close();
        void pickFiles();
      } else if (is(e, "shortcuts")) {
        close();
        setHelp(!help);
      } else if (is(e, "nav-back") || is(e, "nav-forward")) {
        // ⌘[ and ⌘] also indent lists in the note editor, so a text field keeps them.
        if (inTextField(e)) return;
        close();
        if (is(e, "nav-back")) history.back();
        else history.forward();
      } else if (is(e, "home")) {
        close();
        goHome();
      } else if (is(e, "go-feed")) {
        close();
        goFeed();
      } else if (is(e, "review")) {
        close();
        askReview();
      } else if (is(e, "sidebar")) {
        e.preventDefault();
        toggleSidebar();
      } else if (is(e, "side-panel")) {
        e.preventDefault();
        if (openId && !finishing) toggleSide();
      } else if (is(e, "filter")) {
        // On Home it opens All sources; in a source or on a skill page it finds on the page (Reader, SkillPage).
        if (openId || onSkillPage) return;
        close();
        setPlace("sources");
        requestAnimationFrame(() => filterRef.current?.focus());
      } else if (isNotes(e)) {
        if (openId && !finishing) {
          close();
          toggleNotes();
        } else close(); // on a skill page it focuses the skill note (SkillPage)
      } else {
        const s = TABS.find((x) => is(e, x.key));
        if (s) {
          close();
          go(s.id);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, goHome, askReview, reviewing, asking, pickFiles, toggleSidebar, setSideOpen, toggleSide, notesOpen, toggleNotes, palette, help, openId, onSkillPage, finishing, history, settings, closeSettings, tutorOpen]);

  const inSkill = useMemo(() => (items ?? []).filter((i) => !skill || i.skills.includes(skill)), [items, skill]);
  const archivedInSkill = useMemo(() => archived.filter((i) => !skill || i.skills.includes(skill)), [archived, skill]);
  const tabRows = useMemo(
    // Last touched (added or opened) first, D110. Archived: last archived first.
    () =>
      status === "archived"
        ? [...archivedInSkill].sort((a, b) => (b.archived_at ?? "").localeCompare(a.archived_at ?? ""))
        : inSkill
            .filter((i) => inTab(i.status, status))
            // Pinned first, in the order he pinned them (Raycast).
            .sort((a, b) => Number(!a.pinned_at) - Number(!b.pinned_at) || (a.pinned_at ?? "").localeCompare(b.pinned_at ?? "") || touched(b).localeCompare(touched(a))),
    [inSkill, archivedInSkill, status],
  );
  /** A list's search (⌘F on All sources, the magnifying glass on a skill page, D203): sources known by
   *  the words first, best match first (title, then course, author, site, skill, type; a typo still
   *  finds it), then sources whose text, highlights or note match (`ore search`), each with its line. */
  const [query, setQuery] = useState("");
  const filterRef = useRef<HTMLInputElement>(null);
  const q = query.trim();
  useEffect(() => setQuery(""), [skill]);
  /** `error`: why searching the text failed, so it never reads as "nothing matches". */
  const [hits, setHits] = useState<{ q: string; snip: Map<string, string>; error?: string }>({ q: "", snip: new Map() });
  useEffect(() => {
    if (!q) return;
    let live = true;
    const t = setTimeout(() => {
      ore<SearchHit[]>("search", q, "--limit", "60").then(
        (r) => {
          const snip = new Map<string, string>();
          for (const h of r) if (h.item && h.snippet && !snip.has(h.item)) snip.set(h.item, h.snippet);
          if (live) setHits({ q, snip });
        },
        (e) => live && setHits({ q, snip: new Map(), error: errorText(e) }),
      );
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);
  /** What each row is searched by, worked out once per list and not on every key: a site is a parsed URL
   *  and a skill a lookup, which on a big library was most of a key's time (bench "filter sources"). */
  const fieldsOf = useMemo(() => {
    const names = new Map(skills.map((s) => [s.id, s.name]));
    return new Map(tabRows.map((r) => [r, searchFields(r, siteOf(r.url), r.skills.map((id) => names.get(id) ?? id))]));
  }, [tabRows, skills]);
  const byTitle = useMemo(() => (q ? ranked(tabRows, q, (r) => fieldsOf.get(r)!) : tabRows), [tabRows, q, fieldsOf]);
  const byText = useMemo(
    () => (q && hits.q === q ? tabRows.filter((r) => hits.snip.has(r.id) && !byTitle.includes(r)) : []),
    [tabRows, byTitle, hits, q],
  );
  /** On a skill page, the open questions each source may answer (D75's matches), so picking what to read
   *  next and chasing a question are one act (D130): a question mark on the row, the questions in its hint. */
  const [mayAnswer, setMayAnswer] = useState<Map<string, string[]>>(new Map());
  useEffect(() => {
    if (!onSkillPage) return;
    let live = true;
    ore<QuestionView[]>("questions", opt("skill", skill!)).then((qs) => {
      if (!live) return;
      const m = new Map<string, string[]>();
      for (const q of qs) if (q.status === "open") for (const x of q.matches) m.set(x.item, [...(m.get(x.item) ?? []), questionText(q)]);
      setMayAnswer(m);
    }, () => live && setMayAnswer(new Map()));
    return () => {
      live = false;
    };
  }, [onSkillPage, skill, items]);
  /** On a skill page the first few, so Questions below stays in sight; "Show all" lists the rest. */
  const [showAll, setShowAll] = useState(false);
  useEffect(() => setShowAll(false), [skill, status]);
  const rows = useMemo(
    () => (q ? [...byTitle, ...byText] : onSkillPage && !showAll ? tabRows.slice(0, SKILL_CAP) : tabRows),
    [q, byTitle, byText, onSkillPage, showAll, tabRows],
  );
  /** The list with each course as one row (D79), placed where its first lesson sorts: in To read while
   *  any lesson is left, in Done once all are done; its lessons follow it when open. A filter lists lessons. */
  const groups = useMemo((): Line[][] => {
    if (status === "archived") return tabRows.map((item) => [{ kind: "item", item }]);
    const out: Line[][] = [];
    const seen = new Set<string>();
    for (const item of tabRows) {
      const c = item.course;
      if (!c) {
        out.push([{ kind: "item", item }]);
        continue;
      }
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      const lessons = lessonsOf(inSkill, c.id);
      const next = nextLesson(lessons);
      if ((status === "done") !== !next) continue;
      const open = openCourses.includes(c.id);
      const head: Line = { kind: "course", id: c.id, title: c.title, url: c.url, lessons, next, open };
      out.push(open ? [head, ...lessons.map((l): Line => ({ kind: "item", item: l, lesson: true }))] : [head]);
    }
    return out;
  }, [tabRows, inSkill, status, openCourses]);
  const lines = useMemo(
    (): Line[] => (q ? rows.map((item) => ({ kind: "item", item })) : (onSkillPage && !showAll ? groups.slice(0, SKILL_CAP) : groups).flat()),
    [q, rows, groups, onSkillPage, showAll],
  );
  // When the selected row leaves the list in place (archived, moved to Done), the row after it takes the
  // selection, else the one before (Finder, Mail, Linear), never the first row: a second A then archives
  // the row he sees selected.
  const listView = `${place}|${skill}|${status}|${q}`;
  const drawn = useRef<{ view: string; lines: Line[] }>({ view: listView, lines: [] });
  const found = lines.find((l) => lineKey(l) === cursor);
  const neighbour = !found && cursor && drawn.current.view === listView ? lineAfter(drawn.current.lines, lines, cursor) : undefined;
  const currentLine = found ?? neighbour ?? lines[0];
  useEffect(() => {
    drawn.current = { view: listView, lines };
    // For good, so a list read that still has the gone row doesn't hand the selection back to it.
    if (neighbour) setCursor(lineKey(neighbour));
  }, [listView, lines, neighbour]);
  const itemIds = useMemo(() => lines.flatMap((l) => (l.kind === "item" ? [l.item.id] : [])), [lines]);
  /** The picked sources still in view, in list order. */
  const many = useMemo(() => {
    const on = new Set(picked);
    return lines.flatMap((l) => (l.kind === "item" && on.has(l.item.id) ? [l.item] : []));
  }, [lines, picked]);
  const keyedItem = keyed && currentLine?.kind === "item" ? currentLine.item.id : null;
  /** ⇧-click or ⇧↑↓: picks every source from the anchor (or the selected row) to `to`. */
  const pickRange = (to: string) => {
    const from = anchor.current ?? keyedItem ?? to;
    const [a, b] = [itemIds.indexOf(from), itemIds.indexOf(to)];
    anchor.current = a < 0 ? to : from;
    setPicked(a < 0 ? [to] : itemIds.slice(Math.min(a, b), Math.max(a, b) + 1));
    setCursor(to);
  };
  /** ⌘-click: adds a source to the picked ones, or takes it out. */
  const pickToggle = (id: string) => {
    const base = picked.length ? picked : keyedItem ? [keyedItem] : [];
    setPicked(base.includes(id) ? base.filter((x) => x !== id) : [...base, id]);
    anchor.current = id;
    setCursor(id);
  };
  const unpick = () => {
    setPicked([]);
    anchor.current = null;
  };
  /** Ends a drag box (D194) where it is, with no more picks: a view that changes takes the list it was over. */
  const boxDrag = useRef<(() => void) | null>(null);
  // A pick belongs to the list it was made in, and so does a box still being dragged.
  useEffect(() => {
    boxDrag.current?.();
    unpick();
  }, [status, skill, q, openId, place]);
  /** A drag from blank space beside the rows boxes the ones it crosses (D194, Finder; the note's D188):
   *  a pick like ⇧-click's, from the row it began by to the one it reached; ⇧ adds, ⌘ toggles. */
  const boxPick = (): RowPick => {
    const was = { picked, anchor: anchor.current, cursor };
    return {
      ids: itemIds,
      held: picked.length ? picked : keyedItem ? [keyedItem] : [],
      pick: (ids, from, to) => {
        setPicked(ids);
        anchor.current = from;
        if (to) setCursor(to);
      },
      cancel: () => {
        setPicked(was.picked);
        anchor.current = was.anchor;
        setCursor(was.cursor);
      },
      click: () => {
        unpick();
        setKeyed(false);
      },
    };
  };
  /** The selected source; a course row stands for the lesson it opens. */
  const current = currentLine && (currentLine.kind === "item" ? currentLine.item : lessonFirst(currentLine));
  const currentCourse = currentLine?.kind === "course" ? currentLine : null;
  const onHome = !openId && !onSkillPage && place === "home";
  const onFeed = !openId && !onSkillPage && place === "feed";
  const overlay = palette || adding || help || !!settings || editing !== null || deleting !== null || (reviewing !== null && !reviewing.paused) || asking !== null;
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;

  /** Open original / Reveal in Finder for a source. The reader handles its own keys (it knows when recall is closed-book). */
  const original = useCallback(
    (item: Item, how: "open" | "reveal") => void (how === "open" ? openOriginal(item) : revealInFinder(item)).catch((e) => notify(errorText(e), "error")),
    [notify],
  );
  useEffect(() => {
    if (openId || overlay || onHome || !current) return;
    const onKey = (e: KeyboardEvent) => {
      // In a field (the filter, the skill note, a new question) these act on the text, not a row.
      if ((is(e, "original") || is(e, "archive")) && inTextField(e)) return;
      if (is(e, "copy") && !window.getSelection()?.toString() && (many.length > 1 || keyed)) {
        // ⌘C on the picked rows, or the selected one, copies them as linked titles; a course as its page.
        e.preventDefault();
        copySources(many.length > 1 ? many : [currentCourse ? { ...current, title: currentCourse.title, url: currentCourse.url } : current]);
      } else if (is(e, "path")) {
        e.preventDefault();
        copyPaths(many.length > 1 ? many : [current]);
      } else if (is(e, "archive") && many.length > 1) {
        e.preventDefault();
        archiveMany();
      } else if (is(e, "archive") && keyed) {
        e.preventDefault();
        if (currentCourse) void archiveCourse(currentCourse);
        else void archiveSource(current);
      } else if (is(e, "original") || is(e, "reveal")) {
        e.preventDefault();
        // A course's original is its page (the course link), not one lesson's.
        if (currentCourse && is(e, "original") && currentCourse.url) original({ ...current, url: currentCourse.url }, "open");
        else original(current, is(e, "original") ? "open" : "reveal");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, overlay, onHome, current, currentCourse, original, keyed, many]);

  // Keep keyboard focus on the list whenever it is the whole view (a skill page also has its note),
  // but not out of an open popover (a row's skill picker refiles it and stays open) or a row's rename
  // field (Rename from ⌘K opens it as the palette closes).
  useEffect(() => {
    if (!openId && !overlay && !onSkillPage && !document.activeElement?.closest(".popover, .row-rename")) listRef.current?.focus({ preventScroll: true });
  }, [openId, overlay, onSkillPage, items]);
  const skillPageShown = useRef<string | null>(null);
  useEffect(() => {
    // Opening a skill page puts focus on its sources list, once; edits in its note keep their focus.
    if (onSkillPage && skillPageShown.current !== skill && !overlay) listRef.current?.focus({ preventScroll: true });
    skillPageShown.current = onSkillPage ? skill : null;
  }, [onSkillPage, skill, overlay]);

  useEffect(() => {
    if (currentLine) document.getElementById(`row-${lineKey(currentLine)}`)?.scrollIntoView({ block: "nearest" });
  }, [currentLine]);

  // Each list keeps where it was scrolled (Finder, Linear): back from a source, by Esc or ⌘[, or after
  // a relaunch, he is where he left it. On a skill page the sources column scrolls, not the list.
  const scrollAt = `${onSkillPage ? `skill:${skill}` : onHome ? "" : status}`;
  const listShown = !openId && !onHome && items !== null;
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!listShown || !scrollAt || !list) return;
    const el = list.closest<HTMLElement>(".skill-col") ?? list;
    // The same element serves every tab: a list never scrolled (or left at the top) starts at the top.
    const want = keptScrolls()[scrollAt] ?? 0;
    el.scrollTop = want;
    // The row he has selected stays in view (Finder, Raindrop), though opening it moved it up (D110).
    const sel = keyed && found ? document.getElementById(`row-${lineKey(found)}`) : null;
    sel?.scrollIntoView({ block: "nearest" });
    // What sits below the list (a skill page's questions) loads after it, so the place may not exist
    // yet: keep putting it back as the content grows, until it fits or he scrolls himself. Until then
    // a scroll is ours, clamped short, and saving it would lose his place.
    let pending = !sel && el.scrollTop < want - 1;
    const settle = () => {
      if (!pending) return;
      el.scrollTop = want;
      if (el.scrollTop >= want - 1) stop();
    };
    const grows = new MutationObserver(settle);
    const stop = () => {
      pending = false;
      grows.disconnect();
    };
    if (pending) grows.observe(el, { childList: true, subtree: true });
    const giveUp = window.setTimeout(stop, 3000);
    const on = () => {
      if (!pending) keepScroll(scrollAt, el.scrollTop);
    };
    const mine = { passive: true } as const;
    el.addEventListener("scroll", on, mine);
    for (const t of ["wheel", "pointerdown", "keydown", "touchstart"]) el.addEventListener(t, stop, mine);
    return () => {
      stop();
      clearTimeout(giveUp);
      el.removeEventListener("scroll", on);
      for (const t of ["wheel", "pointerdown", "keydown", "touchstart"]) el.removeEventListener(t, stop);
    };
  }, [listShown, scrollAt]);

  const onListKey = (e: ReactKeyboardEvent) => {
    if (!lines.length || !currentLine) return;
    const now = Date.now();
    const begun = now - typed.current.at < TYPE_GAP && typed.current.text !== "";
    // Any key but a letter of a title ends the title being typed (an arrow, Esc, a shortcut).
    if (!typesTitle(e, begun)) typed.current.text = "";
    const at = lines.indexOf(currentLine);
    if (e.key === "Escape" && picked.length) {
      e.preventDefault();
      e.stopPropagation();
      unpick();
    } else if (e.code === "KeyA" && e.metaKey && !e.shiftKey && !e.altKey && !e.ctrlKey) {
      e.preventDefault();
      setPicked(itemIds);
    } else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && e.shiftKey && currentLine.kind === "item") {
      // Finder: ⇧↑↓ grow or shrink the pick from where it started.
      e.preventDefault();
      if (!picked.length || !anchor.current) anchor.current = currentLine.item.id;
      const i = itemIds.indexOf(currentLine.item.id);
      setKeyed(true);
      pickRange(itemIds[Math.max(0, Math.min(itemIds.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))]!);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      unpick();
      if (!keyed) {
        setKeyed(true);
        setCursor(lineKey(currentLine));
        return;
      }
      const next = lines[Math.max(0, Math.min(lines.length - 1, at + (e.key === "ArrowDown" ? 1 : -1)))];
      if (next) setCursor(lineKey(next));
    } else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && keyed && !e.metaKey && !e.altKey) {
      // Finder's outline: → opens a course's lessons, ← closes them, and from a lesson goes to its course.
      if (currentLine.kind === "course") {
        e.preventDefault();
        toggleCourse(currentLine.id, e.key === "ArrowRight");
      } else if (currentLine.lesson && e.key === "ArrowLeft") {
        e.preventDefault();
        setCursor(`course:${currentLine.item.course!.id}`);
      }
    } else if (e.key === "Enter" && keyed) {
      e.preventDefault();
      openSource(currentLine.kind === "course" ? lessonFirst(currentLine).id : currentLine.item.id);
    } else if (is(e.nativeEvent, "rename") && keyed) {
      e.preventDefault();
      setRenamingRow(lineKey(currentLine));
    } else if (is(e.nativeEvent, "pin") && keyed && many.length < 2 && currentLine.kind === "item" && !currentLine.item.archived_at) {
      e.preventDefault();
      void pinSource(currentLine.item);
    } else if (!inTextField(e.nativeEvent) && typesTitle(e, begun)) {
      // Finder's type-select (F8): the first letters of a title select its row. Stopped here, so a plain
      // letter bound elsewhere (N opens a skill's note) never also acts while he types a title.
      e.preventDefault();
      e.stopPropagation();
      const text = (begun ? typed.current.text : "") + e.key;
      typed.current = { text, at: now };
      const i = typeJump(lines.map((l) => (l.kind === "item" ? l.item.title : l.title)), text, keyed ? at : -1);
      if (i < 0) return;
      unpick();
      setKeyed(true);
      setCursor(lineKey(lines[i]!));
    }
  };
  /** What he has typed of a title, and when the last letter came (Finder's type-select). */
  const typed = useRef({ text: "", at: 0 });

  /** A source row's title edited in place (Finder's Rename): optimistic, put back if the write fails. */
  const [renamingRow, setRenamingRow] = useState<string | null>(null);
  /** A rename field closed: the list takes the keys again. */
  const doneRenaming = (byKey: boolean) => {
    setRenamingRow(null);
    if (byKey) listRef.current?.focus({ preventScroll: true });
  };
  /** False when the write failed (and a toast said why), so the field keeps what he typed. */
  const retitle = async (id: string, before: string, t: string, undoable = true) => {
    if (!t || t === before) return true;
    setItems((all) => all?.map((i) => (i.id === id ? { ...i, title: t } : i)) ?? all);
    try {
      await ore("edit", id, "--title", t);
      if (undoable) notify(`Renamed to “${t}”`, "quiet", () => retitle(id, t, before, false), () => retitle(id, before, t, false));
      return true;
    } catch (e) {
      setItems((all) => all?.map((i) => (i.id === id ? { ...i, title: before } : i)) ?? all);
      // From the history (undo or redo): it puts the step back and says why.
      if (!undoable) throw e;
      notify(errorText(e), "error");
      return false;
    } finally {
      void refresh();
    }
  };

  const skillOf = (id: string): Skill => skills.find((k) => k.id === id) ?? { id, name: id };

  /** Archives a source (hidden from lists and search, files and cards kept), with Undo. The row
   *  goes at once (optimistic); a failure brings it back with the error. */
  const archiveSource = (item: Item) => fileAway(item, true);
  /** Brings an archived source back to its tab, with Undo. */
  const restoreSource = (item: Item) => fileAway(item, false);
  const fileAway = async (item: Item, archived: boolean) => {
    const mark = (on: boolean) => {
      const moved = { ...item, archived_at: on ? new Date().toISOString() : undefined };
      setItems((all) => (on ? all?.filter((i) => i.id !== item.id) : all && [moved, ...all.filter((i) => i.id !== item.id)]) ?? all);
      setArchived((all) => (on ? [moved, ...all.filter((i) => i.id !== item.id)] : all.filter((i) => i.id !== item.id)));
    };
    const queue = inOrder();
    const save = (on: boolean) => queue(() => ore("archive", item.id, ...(on ? [] : ["--undo"])));
    mark(archived);
    if (archived && openId === item.id) setOpenId(null);
    // Returns the write, so an undo that fails says so and stays undoable (history.ts).
    const apply = (on: boolean) => {
      mark(on);
      // Undo selects the source it put back, as Finder selects what it puts back.
      if (on !== archived) setCursor(item.id);
      return save(on);
    };
    notify(`${archived ? "Archived" : "Restored"} “${item.title}”`, "info", () => apply(!archived), () => apply(archived));
    try {
      await save(archived);
    } catch (e) {
      notify(errorText(e), "error");
    }
  };

  /** Lays out the sidebar at once (optimistic), then saves through `ore skills arrange`; a failure
   *  puts the old layout back. */
  /** The sidebar's layout writes, one after another, as a source's are (inOrder): a ⌘Z pressed while a rename
   *  still saves waits for it, or the two `ore skills arrange` runs race and the rename can land last. The
   *  skills are read again once the latest settles, so an earlier read never shows a step already taken back. */
  const layoutWrites = useRef<{ last: Promise<unknown>; queued: number }>({ last: Promise.resolve(), queued: 0 });
  const arrange = async (layout: SkillLayout, fromHistory = false) => {
    const byId = new Map(skills.map((s) => [s.id, s]));
    setSkills(layout.flatMap((g) => g.skills.flatMap((id) => {
      const s = byId.get(id);
      return s ? [{ ...s, collection: g.collection || undefined }] : [];
    })));
    const q = layoutWrites.current;
    const n = ++q.queued;
    const write = q.last.then(() => ore("skills", "arrange", JSON.stringify(layout)));
    q.last = write.catch(() => {});
    try {
      await write;
    } catch (e) {
      // From the history (undo or redo): it puts the step back and says why.
      if (fromHistory) throw e;
      notify(errorText(e), "error");
    } finally {
      if (n === q.queued) reloadSkills();
    }
  };
  /** Removes a collection: its skills join the ones in none, with Undo. */
  const deleteCollection = (collection: string) => {
    const before = layoutOf(skillGroups(skills));
    const kept = before.filter((g) => g.collection !== collection);
    const freed = before.find((g) => g.collection === collection)?.skills ?? [];
    const rest = kept.find((g) => !g.collection);
    const next = rest ? kept.map((g) => (g === rest ? { ...g, skills: [...freed, ...g.skills] } : g)) : [...kept, { collection: "", skills: freed }];
    void arrange(next);
    notify(`Deleted collection “${collection}”`, "info", () => arrange(before, true), () => arrange(next, true));
  };
  /** Files a skill under another collection (or none), at the end of it, with Undo. */
  const moveSkill = (s: Skill, collection: string) => {
    const before = layoutOf(skillGroups(skills));
    const out = before.map((g) => ({ ...g, skills: g.skills.filter((id) => id !== s.id) }));
    const into = out.find((g) => g.collection === collection);
    const next = into ? out.map((g) => (g === into ? { ...g, skills: [...g.skills, s.id] } : g)) : [...out, { collection, skills: [s.id] }];
    const after = next.filter((g) => g.skills.length);
    void arrange(after);
    notify(collection ? `Moved “${s.name}” to ${collection}` : `Moved “${s.name}” out of ${s.collection}`, "info", () => arrange(before, true), () => arrange(after, true));
  };
  const collections = [...new Set(skills.flatMap((s) => (s.collection ? [s.collection] : [])))];

  /** Writes a skill's importance or archived flag (D173) at once, then saves through `ore`; a failure
   *  puts it back. On the history, with a toast for Archive and Bring back (they move it in the sidebar). */
  const changeSkill = async (id: string, patch: Pick<Skill, "priority" | "archived">, fromHistory = false) => {
    setSkills((all) => all.map((k) => (k.id === id ? { ...k, ...patch } : k)));
    try {
      if (patch.priority) await ore("skills", "set", id, opt("priority", patch.priority));
      if (patch.archived !== undefined) await ore("skills", "archive", id, ...(patch.archived ? [] : ["--undo"]));
    } catch (e) {
      if (fromHistory) throw e;
      notify(errorText(e), "error");
    } finally {
      reloadSkills();
    }
  };
  /** Picks a level; picking one on an archived skill brings it back too. */
  const setImportance = (s: Skill, p: Priority) => {
    // Archived only when it changes: a live skill's level is one write.
    const before = { priority: s.priority ?? "P2", ...(s.archived && { archived: true }) };
    const after = { priority: p, ...(s.archived && { archived: false }) };
    if (before.priority === p && !s.archived) return;
    void changeSkill(s.id, after);
    notify(`${s.name}: ${LEVELS.find((l) => l.p === p)!.label}`, before.archived ? "info" : "quiet", () => changeSkill(s.id, before, true), () => changeSkill(s.id, after, true));
  };
  const archiveSkill = (s: Skill, on: boolean) => {
    void changeSkill(s.id, { archived: on });
    notify(on ? `Archived “${s.name}”` : `Brought back “${s.name}”`, "info", () => changeSkill(s.id, { archived: !on }, true), () => changeSkill(s.id, { archived: on }, true));
  };

  /** A skill's actions: the sidebar's right-click and ⋯. */
  const skillMenu = (s: Skill): MenuAction[] => [
    { id: "open", label: "Open", run: () => openSkill(s.id) },
    // One dialog holds the name, icon, color and collection, so one item opens it, name ready to type.
    { id: "edit", label: "Edit skill…", divider: true, run: () => editSkill(s.id, true) },
    ...(collections.some((c) => c !== s.collection) || s.collection
      ? [{
          id: "move",
          label: "Move to",
          run: () => {},
          sub: [
            ...collections.filter((c) => c !== s.collection).map((c) => ({ id: `to:${c}`, label: c, icon: <Folder />, run: () => moveSkill(s, c) })),
            ...(s.collection ? [{ id: "to:", label: "No collection", icon: <X />, run: () => moveSkill(s, "") }] : []),
          ],
        }]
      : []),
    { id: "importance", label: "Importance", run: () => {}, sub: importanceActions(s, setImportance) },
    s.archived ? { id: "unarchive", label: "Bring back", divider: true, run: () => archiveSkill(s, false) } : { id: "archive", label: "Archive skill", divider: true, run: () => archiveSkill(s, true) },
    { id: "delete", label: "Delete skill…", danger: true, run: () => setDeleting(s.id) },
  ];

  type CourseLine = Extract<Line, { kind: "course" }>;
  /** Renames a course on every lesson: optimistic, put back if the write fails. On the history, as a source's rename is. */
  const recourse = async (id: string, before: string, t: string, undoable = true) => {
    if (!t || t === before) return true;
    setItems((all) => all?.map((i) => (i.course?.id === id ? { ...i, course: { ...i.course, title: t } } : i)) ?? all);
    try {
      await ore("course", "set", id, opt("title", t));
      if (undoable) notify(`Renamed to “${t}”`, "quiet", () => recourse(id, t, before, false), () => recourse(id, before, t, false));
      return true;
    } catch (e) {
      setItems((all) => all?.map((i) => (i.course?.id === id ? { ...i, course: { ...i.course, title: before } } : i)) ?? all);
      // From the history (undo or redo): it puts the step back and says why.
      if (!undoable) throw e;
      notify(errorText(e), "error");
      return false;
    } finally {
      void refresh();
    }
  };
  const courseSkills = (c: CourseLine) => [...new Set(c.lessons.flatMap((l) => l.skills))];
  /** Files every lesson of a course under a skill, or takes them all off it. Lesson by lesson, as for a
   *  selection: each keeps its other skills, and Undo gives each back exactly what it had. */
  const fileCourse = (c: CourseLine, k: Skill, on = !c.lessons.every((l) => l.skills.includes(k.id))) => fileItems(wholeCourse(c), `“${c.title}”`, k, on);
  /** Every listed lesson of the course, whatever the page shows: a skill's page rows hold only that skill's. */
  const wholeCourse = (c: CourseLine) => (items ?? []).filter((i) => i.course?.id === c.id);
  /** Archives the lessons of a course that are listed (files and cards kept); Undo brings back those, not
   *  one he archived before. */
  const archiveCourse = (c: CourseLine) => {
    const lessons = wholeCourse(c);
    if (openId && lessons.some((l) => l.id === openId)) setOpenId(null);
    batch(`Archived “${c.title}”`, (i, f) => ore("archive", i.id, ...(f ? [] : ["--undo"])), () => null, undefined, lessons);
  };
  const courseActions = (c: CourseLine): MenuAction[] => [
    { id: "open", label: c.next && c.next.status !== "inbox" ? "Continue" : "Open", hint: "↵", run: () => openSource(lessonFirst(c).id) },
    { id: "lessons", label: c.open ? "Hide lessons" : "Show lessons", hint: c.open ? "←" : "→", run: () => toggleCourse(c.id) },
    { id: "rename", label: "Rename…", hint: label(keys.rename), divider: true, run: () => setRenamingRow(`course:${c.id}`) },
    ...(c.url ? [{ id: "original", label: "Open course page", hint: label(keys.original), run: () => original({ ...lessonFirst(c), url: c.url }, "open") }] : []),
    ...(skills.length
      ? [{
          id: "skills",
          label: "Skills",
          run: () => {},
          sub: skills.map((k) => ({ id: k.id, label: k.name, icon: <SkillIcon icon={k.icon} color={k.color} dot className="palette-icon" />, checked: c.lessons.every((l) => l.skills.includes(k.id)), run: () => fileCourse(c, k) })),
        }]
      : []),
    showMenu,
    { id: "archive", label: "Archive course", hint: label(keys.archive), danger: true, divider: true, run: () => void archiveCourse(c) },
  ];

  /** Writes each picked source in turn (the CLI owns the library), as one step with one Undo and
   *  Redo. `patch` shows the result at once: the source as it will be, or null when it leaves the list. */
  /** Filing under an archived skill brings it back (D173, the CLI does that); taking the filing back archives
   *  it again. Either way the sidebar reads the skills again. */
  const rearchive = (ids: string[]) => Promise.all(ids.map((id) => ore("skills", "archive", id))).finally(reloadSkills);
  /** `after`: what follows the writes each way (a skill a filing brought back). */
  const batch = (message: string, write: (i: Item, forward: boolean) => Promise<unknown>, patch?: (i: Item) => Item | null, after?: (forward: boolean) => unknown, sel = many) => {
    const ids = new Set(sel.map((i) => i.id));
    const was = cursor;
    const queue = inOrder();
    const go = async (forward: boolean, fromHistory = false) => {
      if (patch) setItems((all) => all && (forward ? all.flatMap((i) => (ids.has(i.id) ? (patch(i) ?? []) : [i])) : [...all.filter((i) => !ids.has(i.id)), ...sel]));
      if (!forward) setCursor(was);
      try {
        await queue(async () => {
          for (const i of sel) await write(i, forward);
          await after?.(forward);
        });
      } catch (e) {
        if (fromHistory) throw e;
        notify(errorText(e), "error");
      }
    };
    if (sel === many) unpick();
    void go(true);
    notify(message, "info", () => go(false, true), () => go(true, true));
  };
  const copySources = (list: Item[]) =>
    void copyCited(citeSources(list)).then(() => notify(list.length > 1 ? `Copied ${sourcesN(list.length)} as Markdown` : "Copied as Markdown"), (e) => notify(errorText(e), "error"));
  /** One path per line, as Finder's Copy as Pathname does for several files. */
  const copyPaths = (list: Item[]) =>
    void navigator.clipboard.writeText(list.map(pathOf).join("\n")).then(() => notify(list.length > 1 ? `Copied ${list.length} paths` : "Path copied"), (e) => notify(errorText(e), "error"));
  const sourcesN = (n: number) => `${n} source${n === 1 ? "" : "s"}`;
  const archiveMany = (sel = many) => batch(`Archived ${sourcesN(sel.length)}`, (i, f) => ore("archive", i.id, ...(f ? [] : ["--undo"])), () => null, undefined, sel);
  const restoreMany = (sel = many) => batch(`Restored ${sourcesN(sel.length)}`, (i, f) => ore("archive", i.id, ...(f ? ["--undo"] : [])), undefined, undefined, sel);
  const moveMany = (to: Item["status"], sel = many) =>
    batch(`Moved ${sourcesN(sel.length)} to ${to === "done" ? "Done" : "To read"}`, (i, f) => ore("status", i.id, ...back(i, f ? to : i.status)), (i) => ({ ...i, status: to }), undefined, sel);
  const fileMany = (k: Skill, on: boolean, sel = many) => fileItems(sel, sourcesN(sel.length), k, on);
  /** Puts `k` on each of these sources, or takes it off, each keeping its other skills. */
  const fileItems = (sel: Item[], what: string, k: Skill, on: boolean) => {
    const next = (i: Item) => (on ? [...new Set([...i.skills, k.id])] : i.skills.filter((s) => s !== k.id));
    batch(
      on ? `Filed ${what} under ${k.name}` : `Removed ${what} from ${k.name}`,
      (i, f) => ore("edit", i.id, "--skills", (f ? next(i) : i.skills).join(",")),
      (i) => ({ ...i, skills: next(i) }),
      on && k.archived ? (forward) => (forward ? reloadSkills() : rearchive([k.id])) : undefined,
      sel,
    );
  };
  /** The picked sources' actions: the same as one row's that make sense for many, named for the count. */
  const manyActions = (sel = many): MenuAction[] => {
    const what = sourcesN(sel.length);
    if (sel.every((i) => i.archived_at)) return [{ id: "restore", label: `Restore ${what}`, run: () => restoreMany(sel) }];
    return [
      sel.every((i) => i.status === "done")
        ? { id: "toread", label: `Move ${what} to To read`, run: () => moveMany("reading", sel) }
        : { id: "done", label: `Move ${what} to Done`, run: () => moveMany("done", sel) },
      ...(skills.length
        ? [{
            id: "skills",
            label: "Skills",
            run: () => {},
            sub: skills.map((k) => {
              const all = sel.every((i) => i.skills.includes(k.id));
              return { id: k.id, label: k.name, icon: <SkillIcon icon={k.icon} color={k.color} dot className="palette-icon" />, checked: all, run: () => fileMany(k, !all, sel) };
            }),
          }]
        : []),
      { id: "copy", label: `Copy ${what} as Markdown`, hint: label(keys.copy), divider: true, run: () => copySources(sel) },
      { id: "path", label: "Copy paths", hint: label(keys.path), run: () => copyPaths(sel) },
      showMenu,
      { id: "archive", label: `Archive ${what}`, hint: label(keys.archive), danger: true, divider: true, run: () => archiveMany(sel) },
    ];
  };


  /** Moves a source between To read and Done, with Undo (the finish step stays the way to finish one). */
  const moveSource = useCallback(
    async (item: Item, to: Item["status"], undoable = true) => {
      try {
        await ore("status", item.id, ...back(item, to));
        // The step goes on the history before the lists are read again: a ⌘Z pressed during that read
        // (slow on a big library, or CI under load) must take this move back, not the one before it.
        if (undoable) notify(to === "done" ? `Moved “${item.title}” to Done` : `Moved “${item.title}” to To read`, "info", () => moveSource(item, item.status, false), () => moveSource(item, to, false));
        await refresh();
      } catch (e) {
        // From the history (undo or redo): it puts the step back and says why.
        if (!undoable) throw e;
        notify(errorText(e), "error");
      }
    },
    [refresh, notify],
  );

  /** Pins a source to the top of its lists, or unpins it: optimistic, put back if the write fails. */
  const pinSource = async (item: Item, undoable = true) => {
    const pinned_at = item.pinned_at ? undefined : new Date().toISOString();
    setItems((all) => all?.map((i) => (i.id === item.id ? { ...i, pinned_at } : i)) ?? all);
    const write = ore("pin", item.id, ...(pinned_at ? [] : ["--undo"]));
    // On the history at once, so ⌘Z before the write lands still takes it back (F20).
    const flip = (on: boolean) => () => write.then(() => pinSource({ ...item, pinned_at: on ? undefined : "x" }, false));
    const forget = undoable ? notify(pinned_at ? `Pinned “${item.title}”` : `Unpinned “${item.title}”`, "quiet", flip(!pinned_at), flip(!!pinned_at)) : undefined;
    try {
      await write;
    } catch (e) {
      forget?.();
      // From the history (undo or redo): it puts the step back and says why.
      if (!undoable) throw e;
      notify(errorText(e), "error");
    } finally {
      void refresh();
    }
  };
  /** A pinned source moved among the pinned of this list (drag, or Move up/down), to `to` among them. */
  const movePinned = async (item: Item, to: number) => {
    const pinned = tabRows.filter((i) => i.pinned_at);
    const from = pinned.findIndex((i) => i.id === item.id);
    if (from < 0 || to === from) return;
    const rest = pinned.filter((i) => i.id !== item.id);
    const at = pinBetween(rest[to - 1]?.pinned_at, rest[to]?.pinned_at);
    const repin = async (t: string, fromHistory = false) => {
      setItems((all) => all?.map((i) => (i.id === item.id ? { ...i, pinned_at: t } : i)) ?? all);
      try {
        await ore("pin", item.id, "--at", t);
      } catch (e) {
        if (fromHistory) throw e;
        notify(errorText(e), "error");
      } finally {
        void refresh();
      }
    };
    await repin(at);
    notify(`Moved “${item.title}”`, "quiet", () => repin(item.pinned_at!, true), () => repin(at, true));
  };


  /** Files a source, or every lesson of a course, under exactly `next` skills (their cards follow):
   *  optimistic, with Undo back to `before`. */
  const refile = async (what: { title: string; ids: Set<string>; write: (skills: string[]) => Promise<unknown> }, next: string[], before: string[], changed?: Skill, fromHistory = false) => {
    setItems((all) => all?.map((i) => (what.ids.has(i.id) ? { ...i, skills: next } : i)) ?? all);
    // Filing under an archived skill brings it back (D173); Undo archives it again.
    const revived = next.filter((id) => !before.includes(id) && skills.some((s) => s.id === id && s.archived));
    const write = what.write(next);
    const slot = `refile:${[...what.ids].join(",")}`;
    // The step goes on the history at once, so ⌘Z pressed before the write lands still takes it back
    // (F20); its undo waits for the write first.
    const forget = changed
      ? notify(
          next.includes(changed.id) ? `Filed “${what.title}” under ${changed.name}` : `Removed “${what.title}” from ${changed.name}`,
          "info",
          () => write.then(() => refile(what, before, next, undefined, true)).then(() => rearchive(revived)),
          () => refile(what, next, before, undefined, true),
          undefined,
          undefined,
          slot,
        )
      : undefined;
    try {
      await write;
    } catch (e) {
      forget?.();
      // From the history (undo or redo): it puts the step back and says why.
      if (fromHistory) throw e;
      // In place of the toast that said it was filed.
      notify(errorText(e), "error", undefined, undefined, undefined, undefined, slot);
    } finally {
      void refresh();
      // Filing under an archived skill brings it back (D173): the sidebar shows it in its place again.
      if (next.some((id) => skills.some((s) => s.id === id && s.archived))) reloadSkills();
    }
  };
  const sourceFiling = (item: Item) => ({ title: item.title, ids: new Set([item.id]), write: (ids: string[]) => ore("edit", item.id, "--skills", ids.join(",")) });
  /** Files a source under a skill, or takes it off one, from its ⋯ menu. */
  const fileSource = (item: Item, k: Skill) => {
    const on = item.skills.includes(k.id);
    void refile(sourceFiling(item), on ? item.skills.filter((s) => s !== k.id) : [...item.skills, k.id], item.skills, k);
  };
  const skillNow = useRef(skill);
  skillNow.current = skill;
  const madeSkill = (s: Skill) =>
    skillMade(s, notify, () => (reloadSkills(), void refresh()), (id) => skillNow.current === id && goHome());
  /** A skill typed into a source's skill picker: made at once, so the picker can tick it. */
  const createSkill = async (name: string) => {
    try {
      const made = await ore<Skill>("skills", "add", name, opt("collection", ""));
      setSkills((all) => [...all, made]);
      reloadSkills();
      madeSkill(made);
      return made;
    } catch (e) {
      notify(errorText(e), "error");
    }
  };

  /** Move up / down among the pinned, the keyboard's way to the drag. */
  const pinMoves = (r: Item): MenuAction[] => {
    if (!r.pinned_at || r.archived_at) return [];
    const pinned = tabRows.filter((i) => i.pinned_at);
    const at = pinned.findIndex((i) => i.id === r.id);
    if (at < 0) return [];
    return [
      ...(at > 0 ? [{ id: "pin-up", label: "Move up", run: () => void movePinned(r, at - 1) }] : []),
      ...(at < pinned.length - 1 ? [{ id: "pin-down", label: "Move down", run: () => void movePinned(r, at + 1) }] : []),
    ];
  };
  const rowActions = (r: Item): MenuAction[] => [
    { id: "open", label: "Open", hint: "↵", run: () => openSource(r.id) },
    { id: "review-source", label: "Review this source", run: () => startReview(null, r.id) },
    { id: "rename", divider: true, label: "Rename…", hint: label(keys.rename), run: () => setRenamingRow(r.id) },
    ...(r.archived_at ? [] : [{ id: "pin", label: r.pinned_at ? "Unpin" : "Pin to top", hint: label(keys.pin), run: () => void pinSource(r) }]),
    ...pinMoves(r),
    ...(r.archived_at
      ? [{ id: "restore", label: "Restore", run: () => void restoreSource(r) }]
      : [
          r.status === "done"
            ? { id: "toread", label: "Move to To read", run: () => void moveSource(r, "reading") }
            : { id: "done", label: "Move to Done", run: () => void moveSource(r, "done") },
        ]),
    ...(skills.length
      ? [{
          id: "skills",
          label: "Skills",
          run: () => {},
          sub: skills.map((k) => ({ id: k.id, label: k.name, icon: <SkillIcon icon={k.icon} color={k.color} dot className="palette-icon" />, checked: r.skills.includes(k.id), run: () => fileSource(r, k) })),
        }]
      : []),
    ...(r.url || r.source_file ? [{ id: "original", divider: true, label: "Open original", hint: label(keys.original), run: () => original(r, "open") }] : []),
    { id: "reveal", label: "Reveal in Finder", hint: label(keys.reveal), divider: !(r.url || r.source_file), run: () => original(r, "reveal") },
    { id: "copy", label: "Copy as Markdown", hint: label(keys.copy), run: () => copySources([r]) },
    { id: "path", label: "Copy path", hint: label(keys.path), run: () => copyPaths([r]) },
    showMenu,
    ...(r.archived_at ? [] : [{ id: "archive", label: "Archive", hint: label(keys.archive), danger: true, divider: true, run: () => void archiveSource(r) }]),
  ];

  /** ⌘K follows what is open (a source, a skill page), never what is selected in a list (D178): a row's
   *  actions are on its ⋯ and its right-click. */
  const actions: Action[] = [
    // An open source: the same actions as its ⋯ menu; "Rename…" edits the title in place.
    ...(openId
      ? readerActions.current.flatMap((a): Action[] =>
          a.sub
            ? a.sub.map((b) => ({ id: `${a.id}:${b.id}`, label: b.checked ? `Remove from ${b.label}` : `File under ${b.label}`, keywords: ["skill", "move"], run: b.run }))
            : [{ id: a.id, label: a.id === "rename" ? "Rename source…" : a.id === "archive" ? "Archive source" : a.label, hint: a.hint, run: a.id === "rename" ? () => setRenameSource((n) => n + 1) : a.run }],
        )
      : []),
    // The day's main job comes first among the app-wide actions, as Raycast puts the likely one on top.
    { id: "review", label: "Start review", hint: label(keys.review), run: askReview },
    ...(openId ? [{ id: "back", label: skill ? `Back to ${skillOf(skill).name}` : "Back to sources", hint: "Esc", run: () => setOpenId(null) }] : []),
    ...(skill || onHome ? [{ id: "all", label: "All sources", run: () => openSkill(null) }] : []),
    ...(!openId && !onSkillPage ? [{ id: "filter", label: "Filter sources", hint: label(keys.filter), keywords: ["search", "find"], run: () => {
      setPlace("sources");
      requestAnimationFrame(() => filterRef.current?.focus());
    } }] : []),
    { id: "tutor", label: tutorOpen ? "Close the tutor" : "Tutor chat…", hint: label(keys.tutor), keywords: ["ask", "library", "question", "chat", "answer", "ai", "quiz"], run: () => (tutorOpen ? closeTutor() : openTutor()) },
    ...(PHONE ? [] : [
      { id: "ambience", label: "Ambience…", hint: label(keys.ambience), keywords: ["sound", "music", "focus", "noise", "radio"], run: () => requestAnimationFrame(() => requestAnimationFrame(() => setRadioOpen(true))) },
      ...CHANNELS.filter((c) => ambienceState().playing !== c.id).map((c) => ({ id: `ambience-${c.id}`, label: `Play ${c.name}`, keywords: ["sound", "music", "radio"], run: () => void playAmbience(c.id) })),
      ...(ambienceState().playing ? [{ id: "ambience-stop", label: "Stop ambience", keywords: ["sound", "music", "silence", "mute"], run: stopAmbience }] : []),
    ]),
    ...(tutor.turns.length ? [{ id: "tutor-new", label: "New tutor chat", keywords: ["ask", "chat", "clear"], run: () => { tutor.fresh(); openTutor(); } }] : []),
    ...(onHome ? [] : [{ id: "home", label: "Go to Home", hint: label(keys.home), run: goHome }]),
    ...(onFeed ? [] : [{ id: "go-feed", label: "Go to Feed", hint: label(keys["go-feed"]), keywords: ["rss", "newsletter", "blog", "follow"], run: goFeed }]),
    { id: "add", label: "Add source", hint: label(keys.add), run: () => setAdding(true) },
    { id: "file", label: "Open file", hint: label(keys.file), run: () => void pickFiles() },
    { id: "add-tab", label: "Add page from browser tab", keywords: ["safari", "chrome", "signed in", "medium", "x"], run: () => void addSources([{ kind: "tab" }], addTo ? [addTo] : [], true, true) },
    ...TABS.map((s) => ({ id: s.key, label: `Go to ${s.label}`, hint: label(keys[s.key]), run: () => go(s.id) })),
    ...(archived.length ? [{ id: "go-archived", label: "Go to Archived", run: () => go("archived") }] : []),
    ...(skill
      ? [
          { id: "edit-skill", label: `Edit skill ${skillOf(skill).name}…`, keywords: ["rename", "icon", "color", "collection"], run: () => editSkill(skill, true) },
          // "Move to" from the sidebar's ⋯, one entry per collection.
          ...(skillMenu(skillOf(skill)).find((a) => a.id === "move")?.sub ?? []).map((b) => ({
            id: `skill-move:${b.id}`,
            label: b.id === "to:" ? `Move ${skillOf(skill).name} out of ${skillOf(skill).collection}` : `Move ${skillOf(skill).name} to ${b.label}`,
            keywords: ["collection", "group"],
            run: b.run,
          })),
          ...LEVELS.filter((l) => skillOf(skill).archived || l.p !== (skillOf(skill).priority ?? "P2")).map((l) => ({ id: `skill-level:${l.p}`, label: `Importance of ${skillOf(skill).name}: ${l.label}`, keywords: ["priority", "focus", "normal", "light", "level"], run: () => setImportance(skillOf(skill), l.p) })),
          skillOf(skill).archived
            ? { id: "skill-unarchive", label: `Bring back ${skillOf(skill).name}`, keywords: ["archive", "restore", "unarchive"], run: () => archiveSkill(skillOf(skill), false) }
            : { id: "skill-archive", label: `Archive skill ${skillOf(skill).name}`, keywords: ["hide", "shelve", "pause"], run: () => archiveSkill(skillOf(skill), true) },
          { id: "delete-skill", label: `Delete skill ${skillOf(skill).name}…`, run: () => setDeleting(skill) },
        ]
      : []),
    // Display settings last: ⌘K ↵ on an empty query does the likely thing, never flips a setting (2026-11-08).
    ...CHIP_LOOKS.filter((l) => l.id !== chipLook()).map((l) => ({ id: `chips:${l.id}`, label: `Skill tags: ${l.label}`, keywords: ["chips", "pills", "compact"], run: () => setChipLook(l.id) })),
    ...(openId && !finishing ? WIDTHS.filter((w) => w.id !== width).map((w) => ({ id: `width:${w.id}`, label: `Reading width: ${w.label}`, keywords: ["column", "measure"], run: () => setWidth(w.id) })) : []),
    ...(openId && !finishing
      ? [
          { id: "bigger", label: "Bigger text", hint: label(keys.bigger), keywords: ["font", "size", "zoom"], run: bigger },
          { id: "smaller", label: "Smaller text", hint: label(keys.smaller), keywords: ["font", "size", "zoom"], run: smaller },
          ...(size !== DEFAULT_SIZE ? [{ id: "size-default", label: "Default text size", keywords: ["font", "zoom", "reset"], run: () => setSize(DEFAULT_SIZE) }] : []),
          ...PAGES.filter((t) => t.id !== page).map((t) => ({ id: `page:${t.id}`, label: `Reading page: ${t.label}`, keywords: ["theme", "light", "dark", "white"], run: () => setPage(t.id) })),
          ...FONTS.filter((t) => t.id !== font).map((t) => ({ id: `font:${t.id}`, label: `Reading font: ${t.label}`, keywords: ["font", "serif", "sans", "typeface"], run: () => setFont(t.id) })),
        ]
      : []),
    // The list's details, as the row menus' Show submenu (D108).
    ...(!openId && !onHome && !onFeed
      ? DETAILS.map((d) => ({ id: `detail:${d.id}`, label: `${details.includes(d.id) ? "Hide" : "Show"} ${d.label.toLowerCase()} on rows`, keywords: ["column", "details", "metadata", "row"], run: () => toggleDetail(d.id) }))
      : []),
    { id: "sidebar", label: collapsed ? "Show sidebar" : "Hide sidebar", hint: label(keys.sidebar), run: toggleSidebar },
    { id: "settings", label: "Settings", hint: label(keys.settings), keywords: ["preferences", "goal", "width", "ai"], run: () => setSettings({}) },
    { id: "shortcuts", label: "Keyboard shortcuts", hint: label(keys.shortcuts), run: () => setHelp(true) },
  ];

  /** The other skills a row is under, under its title (D114): its skill pills, as everywhere else. */
  const skillsOf = (ids: string[]) => <SkillChips ids={ids} skills={skills} />;
  const view = <ViewMenu status={status} archived={archivedInSkill.length > 0} go={go} details={details} toggle={toggleDetail} />;
  // What a row's handlers and menus call, read when they run: a row re-renders only when what it
  // shows changes (below), so ↑↓ through a long list repaints two rows, not all of them.
  const live = useRef({ openSource, pickRange, pickToggle, retitle, doneRenaming, refile, sourceFiling, createSkill, manyActions, rowActions, many, picked, boxPick });
  live.current = { openSource, pickRange, pickToggle, retitle, doneRenaming, refile, sourceFiling, createSkill, manyActions, rowActions, many, picked, boxPick };
  useEffect(() => {
    if (!listShown) return;
    const down = (e: MouseEvent) => {
      const list = listRef.current;
      if (list && !overlayRef.current && blankStart(e, list)) boxDrag.current = dragRows(e, list, live.current.boxPick());
    };
    window.addEventListener("mousedown", down);
    return () => {
      window.removeEventListener("mousedown", down);
      boxDrag.current?.();
    };
  }, [listShown]);
  /** A row's optional details last, at fixed widths, so they line up down the list whatever the chips.
   *  A course takes its lessons' author and its first added date. */
  const detailCols = (r: { url?: string }, captured: string[]) => {
    const site = details.includes("site") ? siteOf(r.url) : undefined;
    const first = captured.reduce((a, b) => (b < a ? b : a), captured[0] ?? "");
    return (
      <>
        {details.includes("site") && <span className="col site">{site}</span>}
        {details.includes("added") && <span className="col added">{first && added(first)}</span>}
      </>
    );
  };
  /** Who made it, under the title before its skills (D114), when Author is shown. */
  const authorOf = (r: { author?: string; url?: string }) => {
    const by = details.includes("author") ? byline(r, details.includes("site")) : null;
    if (!by) return null;
    return by.site ? (
      <Hint text="No author named: the site it came from">
        <span className="by from-site">{by.text}</span>
      </Hint>
    ) : (
      <span className="by">{by.text}</span>
    );
  };
  const row = (r: Item, lesson = false) => {
    const snip = q && !byTitle.includes(r) ? hits.snip.get(r.id) : undefined;
    const on = keyed && currentLine?.kind === "item" && currentLine.item === r;
    const sel = picked.includes(r.id);
    const dragged = rowDrag?.many ? rowDrag.many.some((i) => i.id === r.id) : rowDrag?.item.id === r.id && !rowDrag.course;
    const pickN = sel ? many.length : 0;
    // Off screen, a row's menus and hints wait until it scrolls in (Lite.tsx): a long list opens at once.
    return (
      <OnScreen key={r.id} id={`row-${r.id}`} full={on || renamingRow === r.id || pickFor === r.id}>
        <Same
          deps={[r, lesson, snip, q, on, sel, pickN, dragged, renamingRow === r.id, pickFor === r.id, skills, skill, onSkillPage, details, mayAnswer.get(r.id)]}
          render={() => rowView(r, lesson, snip, on, sel, pickN, dragged)}
        />
      </OnScreen>
    );
  };
  const rowView = (r: Item, lesson: boolean, snip: string | undefined, on: boolean, sel: boolean, pickN: number, dragged: boolean) => {
    const others = r.skills.filter((s) => !onSkillPage || s !== skill);
    // A row in a pick of several acts for the whole pick.
    const acts = () => (live.current.picked.includes(r.id) && live.current.many.length > 1 ? live.current.manyActions() : live.current.rowActions(r));
    return (
      <WithMenu actions={acts}>
      <DragRow
        id={r.id}
        dragged={dragged}
        role="row"
        aria-selected={on || sel}
        className={`row${lesson ? " lesson" : ""}${on ? " on" : ""}${sel ? " sel" : ""}${lesson && r.status === "done" ? " finished" : ""}${r.pinned_at ? " pinned" : ""}${snip ? " hit" : ""}`}
        onClick={(e) => (e.shiftKey ? live.current.pickRange(r.id) : e.metaKey ? live.current.pickToggle(r.id) : live.current.openSource(r.id))}
      >
        {/* A lesson (D79): its number in the course, and a check once done, where a source has its picture. */}
        {lesson && <span className="part">{r.course!.part}</span>}
        {lesson && (r.status === "done" ? (
          <Hint text="Done">
            <Check className="done-mark" size={11} weight="bold" aria-label="Done" />
          </Hint>
        ) : (
          <span className="done-mark" aria-hidden="true" />
        ))}
        {!lesson && (() => {
          // How far he got, as YouTube shows under a thumbnail (Home's Continue reading has the same).
          const at = r.status === "done" ? 0 : Number(load(`ore.pos.${r.id}`)) || 0;
          return (
            <span className="thumb-at">
              <Thumb item={r} iconSize={16} />
              {at >= 0.02 && <DotBar className="thumb-bar" share={at} n={12} />}
            </span>
          );
        })()}
        {renamingRow === r.id ? (
          <TitleField value={r.title} onSave={(t) => live.current.retitle(r.id, r.title, t.trim())} onClose={(byKey) => live.current.doneRenaming(byKey)} />
        ) : (
          // Two lines (D114): the title at full width, then the other skills it is under as icons (the
          // page's own is left out), or, matched in its text, highlights or note, the line that says why.
          // A lesson's skills are its course's, so it shows none.
          <span className="row-main">
            <span className="row-line">
              <span className="title">{r.title}</span>
            </span>
            {snip ? (
              <span className="snip">{snippet(snip, q)}</span>
            ) : !lesson && (
              <span className="row-line">
                {authorOf(r)}
                <SkillPicker skills={skills} value={r.skills} title={r.title} onChange={(next, before, k) => void live.current.refile(live.current.sourceFiling(r), next, before, k)} onCreate={(name) => live.current.createSkill(name)} startOpen={pickFor === r.id} onClosed={() => setPickFor(null)}>
                  {others.length > 0 && skillsOf(others)}
                </SkillPicker>
              </span>
            )}
            {/* A skill page's rows are Reader's (D130): a third line says what kind it is (its length joins once import records one). */}
            {!lesson && !snip && <span className="kind-line">{KIND[r.type] ?? r.type}</span>}
          </span>
        )}
        {onSkillPage && mayAnswer.has(r.id) && (
          <Hint text={<span className="hint-q">{mayAnswer.get(r.id)!.map((t, i) => <span key={i}>{t}</span>)}</span>} side="top">
            <span className="row-q" role="img" aria-label={`May answer: ${mayAnswer.get(r.id)!.join("; ")}`}>
              <QuestionMark size={16} aria-hidden="true" />
            </span>
          </Hint>
        )}
        {details.includes("type") && <span className="col kind">{KIND[r.type] ?? r.type}</span>}
        {detailCols(r, [r.captured_at])}
        <MoreButton label={pickN > 1 ? `Actions for ${sourcesN(pickN)}` : `Actions for ${r.title}`} actions={acts} hoverOnly />
      </DragRow>
      </WithMenu>
    );
  };
  /** A course's row (D79): one click opens the lesson to read next; the caret lists its lessons under it. */
  const courseRow = (c: CourseLine) => {
    const key = `course:${c.id}`;
    const on = keyed && currentLine === c;
    const others = [...new Set(c.lessons.flatMap((l) => l.skills))].filter((s) => !onSkillPage || s !== skill);
    const started = c.lessons.some((l) => l.status !== "inbox");
    const cover = courseThumb(c.lessons);
    return (
      <WithMenu key={key} actions={courseActions(c)}>
      <DragRow
        id={key}
        dragged={rowDrag?.course?.id === c.id}
        role="row"
        aria-selected={on}
        aria-expanded={c.open}
        className={`row course${on ? " on" : ""}`}
        onClick={() => openSource(lessonFirst(c).id)}
      >
        <Hint text={c.open ? "Hide lessons" : "Show lessons"}>
          <button
            className="course-caret"
            aria-label={c.open ? `Hide lessons of ${c.title}` : `Show lessons of ${c.title}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleCourse(c.id);
            }}
            data-no-drag
          >
            <CaretRight size={11} weight="bold" aria-hidden="true" />
          </button>
        </Hint>
        {/* The course's own picture, else its first lesson's that has one, like any source; else a cap. */}
        {cover ? (
          <Thumb item={cover} iconSize={16} />
        ) : (
          <span className="thumb none" aria-hidden="true">
            <GraduationCap size={16} />
          </span>
        )}
        {renamingRow === key ? (
          <TitleField value={c.title} label="Course title" onSave={(t) => recourse(c.id, c.title, t.trim())} onClose={doneRenaming} />
        ) : (
          <span className="row-main">
            <span className="row-line">
              <span className="title">{c.title}</span>
            </span>
            <span className="row-line">
              {authorOf({ author: c.lessons.find((l) => l.author)?.author, url: c.url ?? c.lessons[0]?.url })}
              <SkillPicker skills={skills} value={courseSkills(c)} title={c.title} onChange={(next, _, k) => fileCourse(c, k, next.includes(k.id))} onCreate={createSkill} startOpen={!!pickFor && c.lessons.some((l) => l.id === pickFor)} onClosed={() => setPickFor(null)}>
                {others.length > 0 && skillsOf(others)}
              </SkillPicker>
              {/* Closed, it says which lesson a click opens; open, the lessons below say it. */}
              {!c.open && c.next && started && <span className="course-next">{c.next.course!.part} · {c.next.title}</span>}
            </span>
          </span>
        )}
        {details.includes("type") && <span className="col kind">course</span>}
        {detailCols({ url: c.url ?? c.lessons[0]?.url }, c.lessons.map((l) => l.captured_at))}
        <MoreButton label={`Actions for ${c.title}`} actions={courseActions(c)} hoverOnly />
      </DragRow>
      </WithMenu>
    );
  };
  const line = (l: Line) => (l.kind === "course" ? courseRow(l) : row(l.item, l.lesson));
  const list = (
    // Right-click between or below the rows offers the list's create action (Finder's New Folder).
    <WithMenu actions={[{ id: "add", label: "Add source", hint: label(keys.add), run: () => setAdding(true) }]}>
    <div
      className="list"
      ref={listRef}
      tabIndex={0}
      // The focused, scrolling group; its rows are in a grid of their own below, so its empty states,
      // errors and Show all stand outside the grid, whose children are rows only.
      role="group"
      aria-label={TABS.find((s) => s.id === status)?.label ?? "Archived"}
      aria-activedescendant={keyed && currentLine ? `row-${lineKey(currentLine)}` : undefined}
      onKeyDown={onListKey}
      onPointerMove={() => keyed && setKeyed(false)}
    >
      {listError && (
        <div className="empty-state err" role="alert">
          <p>{listError}</p>
          {/* After he fixes it in Terminal, the list comes back without a relaunch. */}
          <button className="pill-btn" onClick={reload}>
            Try again
          </button>
        </div>
      )}
      {!listError && items && !q && rows.length === 0 && <div className="empty-state">{empty(status, keys)}</div>}
      {q && hits.q === q && hits.error && <div className="empty-state err" role="alert">Couldn’t search the text: {hits.error} Titles still filter.</div>}
      {q && hits.q === q && !hits.error && rows.length === 0 && <div className="empty-state">Nothing in {TABS.find((s) => s.id === status)?.label ?? "Archived"} matches “{q}”.</div>}
      {/* A grid, not a listbox: a row holds its own controls (chips, ⋯), which an option may not (ARIA's layout grid). */}
      {rows.length > 0 && <div role="grid" aria-multiselectable="true" aria-label="Sources">
      <DndContext
        sensors={rowSensors}
        // dnd-kit's live region goes to <body>: a grid's children are rows only.
        accessibility={{ container: document.body }}
        onDragStart={(e) => {
          const l = lines.find((x) => lineKey(x) === e.active.id);
          const p = e.activatorEvent as PointerEvent;
          // Dragging a picked source carries the whole pick (Finder).
          const carry = l?.kind === "item" && many.length > 1 && picked.includes(l.item.id) ? many : undefined;
          if (l) setRowDrag({ item: l.kind === "course" ? lessonFirst(l) : l.item, course: l.kind === "course" ? l : undefined, many: carry, skill: null, at: { x: p.clientX, y: p.clientY } });
        }}
        onDragMove={(e) => {
          setRowDrag((d) => d && { ...d, skill: skillUnder(e), at: pointerOf(e) });
          setPinDrop(rowDrag && !rowDrag.many && !rowDrag.course && rowDrag.item.pinned_at && !skillUnder(e) ? pinGap(pointerOf(e), listRef.current) : null);
        }}
        onDragEnd={(e) => {
          const skill = skillUnder(e);
          const gap = pinDrop;
          setPinDrop(null);
          if (gap && !skill && rowDrag && !rowDrag.many && !rowDrag.course) {
            // The gap counts the pinned rows with the dragged one still in place.
            const pinned = tabRows.filter((i) => i.pinned_at);
            const from = pinned.findIndex((i) => i.id === rowDrag.item.id);
            void movePinned(rowDrag.item, gap.index > from ? gap.index - 1 : gap.index);
            return setRowDrag(null);
          }
          const k = skill && skills.find((x) => x.id === skill);
          // A course dropped on a skill files every lesson there.
          if (rowDrag?.many && k) {
            if (!rowDrag.many.every((i) => i.skills.includes(k.id))) fileMany(k, true);
          } else if (rowDrag?.course && k && !rowDrag.course.lessons.every((l) => l.skills.includes(k.id))) void fileCourse(rowDrag.course, k);
          else if (rowDrag && !rowDrag.course && k && !rowDrag.item.skills.includes(k.id)) void fileSource(rowDrag.item, k);
          setRowDrag(null);
        }}
        onDragCancel={() => (setRowDrag(null), setPinDrop(null))}
      >
        {q && byTitle.length > 0 && byText.length > 0 && <div className="list-group">Title</div>}
        {q ? byTitle.map((r) => row(r)) : lines.map(line)}
        {byText.length > 0 && <div className="list-group">In the text, highlights or notes</div>}
        {byText.map((r) => row(r))}
        {pinDrop && <div className="row-drop" style={{ left: pinDrop.left, top: pinDrop.y - 1, width: pinDrop.width }} />}
        {rowDrag && (
          // Follows the pointer, beside it, so the skill under it stays visible.
          <div className="row-ghost" style={{ left: rowDrag.at.x + 14, top: rowDrag.at.y + 10 }}>
            {rowDrag.many ? sourcesN(rowDrag.many.length) : (rowDrag.course?.title ?? rowDrag.item.title)}
          </div>
        )}
      </DndContext>
      </div>}
      {onSkillPage && !q && groups.length > SKILL_CAP && (
        <button className="show-all" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer" : `Show all ${groups.length}`}
        </button>
      )}
    </div>
    </WithMenu>
  );
  /** From a search field: ↓ moves into the rows it found, ↵ opens the first (Linear, Raindrop). */
  const searchKeys = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && rows.length) {
      e.preventDefault();
      setKeyed(true);
      setCursor(rows[0]!.id);
      listRef.current?.focus({ preventScroll: true });
    } else if (e.key === "Enter" && rows[0]) openSource(rows[0].id);
  };
  const sources = (
    <>
      <div className="list-bar">
        {view}
        <Hint text="Filter by title, then text, highlights and notes" keys="filter">
          <label className="filter">
            <MagnifyingGlass size={13} aria-hidden="true" />
            <input
              ref={filterRef}
              value={query}
              placeholder="Filter by title or text"
              spellCheck={false}
              aria-label="Filter sources"
              onChange={(e) => {
                setQuery(e.target.value);
                setCursor(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  if (query) setQuery("");
                  else listRef.current?.focus({ preventScroll: true });
                } else searchKeys(e);
              }}
            />
            {!query && <kbd>{label(keys.filter)}</kbd>}
          </label>
        </Hint>
      </div>
      {list}
    </>
  );

  const tutorButton = !tutorOpen && !overlay && <TutorBubble onOpen={() => openTutor()} said={unheard.said} failed={unheard.failed} thinking={unheard.thinking} onHush={unheard.hush} />;
  return (
    <div className={`app${collapsed ? " collapsed" : ""}${tutorDocked ? " tutoring" : ""}${sideWidth.dragging ? " sizing" : ""}`}>
      <div className="titlebar" data-tauri-drag-region />
      <Hint text={collapsed ? "Show sidebar" : "Hide sidebar"} keys="sidebar">
      <button
        className="side-toggle"
        aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
        aria-expanded={!collapsed}
        onClick={toggleSidebar}
        onMouseEnter={collapsed ? peekIn : undefined}
        onMouseLeave={collapsed ? peekOut : undefined}
      >
        <SidebarSimple size={16} aria-hidden="true" />
      </button>
      </Hint>
      <div className="nav-arrows">
        <Hint text="Back" keys="nav-back">
          <button aria-label="Back" disabled={!history.canBack} onClick={history.back}>
            <ArrowLeft size={15} aria-hidden="true" />
          </button>
        </Hint>
        <Hint text="Forward" keys="nav-forward">
          <button aria-label="Forward" disabled={!history.canForward} onClick={history.forward}>
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </Hint>
      </div>
      {collapsed && <div className="side-edge" aria-hidden="true" onMouseEnter={peekIn} onMouseLeave={() => !peek && clearTimeout(peekTimer.current)} />}
      {!collapsed && (
        <Hint text="Drag to resize · double-click to reset" side="right">
          <div className={`divider side-divider${sideWidth.dragging ? " dragging" : ""}`} role="separator" aria-orientation="vertical" aria-label="Resize the sidebar" {...sideWidth.divider} />
        </Hint>
      )}
      <Sidebar
        skills={skills}
        skill={sideSkill}
        within={!!openItem}
        home={onHome}
        onHome={goHome}
        // A post read from the Feed sits under Feed, as a source sits under its skill.
        feed={place === "feed" && !onSkillPage && (!openId || previews.current.has(openId))}
        onFeed={goFeed}
        hidden={collapsed && !peek}
        peek={collapsed && peek}
        onPointer={(over) => (over ? clearTimeout(peekTimer.current) : peekOut())}
        drop={dropping ? (dropping.skill ?? "") : (rowDrag?.skill ?? homeDrop ?? undefined)}
        onOpen={openSkill}
        menu={skillMenu}
        onCreated={(s) => {
          reloadSkills();
          madeSkill(s);
          openSkill(s.id);
        }}
        onArrange={(layout, step) => {
          const before = layoutOf(skillGroups(skills));
          void arrange(layout);
          // A drag is a step too, quietly (Finder): ⌘Z puts the skill or collection back where it was.
          notify(step ?? "Moved in the sidebar", step ? "info" : "quiet", () => arrange(before, true), () => arrange(layout, true));
        }}
        onDeleteCollection={deleteCollection}
      />

      <main className="main">
        {/* Add stays in sight on Home and All sources (Raindrop's + Add); a skill page has its own in Sources. */}
        {!openId && !onSkillPage && (
          <div className="main-tools">
            <Hint text="Add a link, file or text" keys="add">
              <button className="note-toggle" onClick={() => setAdding(true)}>
                + Add
              </button>
            </Hint>
          </div>
        )}
        {/* The tutor's mole floats at the bottom right (D160). Its live line stays when the mole hides (an overlay),
            so VoiceOver hears a reply that lands then (D159). */}
        {tutorButton}
        {/* The ambience radio, the mole's twin at the bottom left (D254). */}
        {!PHONE && <Radio open={radioOpen} onOpenChange={setRadioOpen} />}
        <span className="sr-only" role="status">{unheard.said ? `The tutor answered: ${unheard.said}` : ""}</span>
        {/* A skill page is the same page wherever it was opened from: a place change under it (its folder tab,
            ⌘1, from Home) must not remount it and drop the tab that has focus (F55). */}
        <Boundary key={`${openId}-${skill}-${skill ? "" : place}`} onBack={goHome}>
        {openId ? (
          <Reader
            key={openId}
            id={openId}
            pickSkill={pickFor === openId}
            onPicked={() => setPickFor(null)}
            skills={skills}
            finishing={finishing}
            setFinishing={setFinishing}
            renameSource={renameSource}
            actionsRef={readerActions}
            practiceRef={readerPractice}
            onArchive={(item) => void (item.archived_at ? restoreSource(item) : archiveSource(item))}
            lessons={openCourse ? lessonsOf(items ?? [], openCourse) : undefined}
            onOpenLesson={(id) => openSource(id)}
            onSound={setSound}
            onPin={(item) => void pinSource(item)}
            onReview={(item) => startReview(null, item.id)}
            onMove={(item, to) => void moveSource(item, to)}
            notesOpen={sideShown}
            sideTab={sideTab}
            onShowSide={showSide}
            onCloseSide={() => setSideOpen(false)}
            onToggleSide={toggleSide}
            jumpTo={jumpTo}
            onLearnAdd={(urls, to, question, now, from) => void learnAdd(urls, to, question, now, from)}
            back={
              reviewing?.paused === openId
                ? { title: "Review", go: () => setOpenId(null) }
                : sideQuest && sideQuest.to === openId
                ? {
                    title: sideQuest.from.title,
                    go: () => {
                      setSideQuest(null);
                      openSource(sideQuest.from.id, sideQuest.question);
                    },
                  }
                : undefined
            }
            blocked={overlay}
            targets={targets}
            onOpenLink={openLink}
            onBack={() => {
              // Back on Home, focus goes to the source's Continue reading row, as the list's row keeps it.
              const id = openId;
              flushSync(() => setOpenId(null));
              if (!onSkillPage && place === "home") document.querySelector<HTMLElement>(`.home-read[data-id="${id}"] .home-open`)?.focus();
            }}
            onChanged={() => void refresh()}
            onSkillsChanged={reloadSkills}
            rearchive={rearchive}
            onDone={() => {
              // The panel showed the moment (D71); the toast takes a mistaken Done back (D106).
              const item = openItem;
              setOpenId(null);
              setFinishing(false);
              void refresh();
              if (item) notify(`Finished “${item.title}” · exercises start tomorrow`, "info", () => moveSource(item, "reading", false), () => moveSource(item, "done", false));
            }}
            notify={notify}
          />
        ) : onSkillPage && skill ? (
          <SkillPage
            key={skill}
            skill={skillOf(skill)}
            view={view}
            search={{ value: query, set: (v) => (setQuery(v), setCursor(null)), keys: searchKeys }}
            targets={targets}
            blocked={overlay}
            onOpen={openLink}
            onQuestion={(q) => openSource(q.item, q.id)}
            onOpenSource={(id) => openSource(id)}
            onAdded={() => void refresh()}
            onAddSource={() => setAdding(true)}
            onSkillChanged={reloadSkills}
            importance={importanceActions(skillOf(skill), setImportance)}
            onBringBack={() => archiveSkill(skillOf(skill), false)}
            notify={notify}
            findInNote={skillFind}
            onFound={() => setSkillFind(undefined)}
          >
            {list}
          </SkillPage>
        ) : onHome ? (
          <Home
            items={items ?? []}
            empty={items?.length === 0}
            skills={skills}
            recent={recent}
            reload={homeTick}
            blocked={overlay}
            onReview={startReview}
            onOpenSource={openSource}
            onOpenSkill={openSkill}
            onRefile={(i, next, before, k) => void refile(sourceFiling(i), next, before, k)}
            onCreateSkill={createSkill}
            onSettings={() => setSettings({ section: "review" })}
            // Home renames its own rows (onRename) and takes the lists' row keys on its focused row or pick
            // (D232, D234), so its menus show them as the lists' do.
            sourceMenu={rowActions}
            onCopy={(i) => copySources([i])}
            manyMenu={(sel) => manyActions(sel).filter((a) => a.id !== "show")}
            onDragSkill={setHomeDrop}
            onDropOnSkill={(sel, id) => {
              const k = skills.find((x) => x.id === id);
              if (!k || sel.every((i) => i.skills.includes(k.id))) return;
              if (sel.length > 1) fileMany(k, true, sel);
              else void fileSource(sel[0]!, k);
            }}
            onRename={(i, t) => retitle(i.id, i.title, t.trim())}
            skillMenu={skillMenu}
            onRetry={reload}
            notify={notify}
          />
        ) : onFeed ? (
          <Feed skills={skills} tick={feedTick} blocked={overlay} onOpen={openPost} onFollow={() => setAdding(true)} onCreateSkill={createSkill} notify={notify} />
        ) : (
          sources
        )}
        </Boundary>
        <DropOverlay drop={dropping && ({ kinds: dropping.kinds, skill: dropping.skill ? skillOf(dropping.skill) : null } satisfies Dropping)} />
      </main>
      {tutorOpen && <Tutor chat={tutor} docked={tutorDock} onFit={() => setTutorDock((d) => (save("ore.tutor.fit", d ? "float" : "dock"), !d))} sources={(items ?? []).map((i) => ({ id: i.id, title: i.title }))} skills={skills.map((k) => ({ id: k.id, name: k.name, icon: k.icon, color: k.color }))} reading={openItem ? { id: openItem.id, title: openItem.title, skills: openItem.skills ?? [] } : null} skillPage={pageSkill} onQuiz={(pick) => startReview(pick.length ? pick : null)} onWrite={(ex, source) => {
        // The note takes the room while he writes; the tutor comes back with what he sent (D128.6).
        // The exercise belongs to the source it was asked about: that one opens first if he has moved on.
        const done = (text: string | null) => {
          if (text) tutor.ask({ message: text, item: source.id, title: source.title });
          openTutor();
        };
        if (openId === source.id) {
          if (!readerPractice.current) return;
          setTutorOpen(false);
          return readerPractice.current(ex, done);
        }
        readerPractice.pending = { item: source.id, exercise: ex, done };
        setTutorOpen(false);
        openSource(source.id);
      }} onOpen={openSource} onClose={closeTutor} />}

      {reviewing && (
        <Boundary key={reviewing.run} onBack={() => endReview()}>
        <Review
          pick={reviewing.pick}
          source={reviewing.source}
          skills={skills}
          paused={!!reviewing.paused}
          under={palette || help}
          leave={leaveReview}
          onOpenSource={(item, at) => {
            setReviewing((r) => r && { ...r, paused: item });
            openSource(item, at);
          }}
          onClose={endReview}
          // Started from a sheet (What to review) that is gone now, or with nothing focused: Home's Start review,
          // else the list, the reader's text, Home's first row or tile, the page's first control (the first that
          // can take focus; picked again if Home's refresh takes it away).
          giveBack={() => [".home .home-go", null, ".reader-scroll", ".home .home-open", "main :is(button, a[href], [tabindex='0'])"].map((q) => (q ? document.querySelector<HTMLElement>(q) : listRef.current)).find(usable)}
          onLogged={() => setHomeTick((n) => n + 1)}
          notify={notify}
        />
        </Boundary>
      )}

      {asking && (
        <ReviewPick
          today={asking}
          skills={skills}
          onClose={() => setAsking(null)}
          onStart={(pick) => {
            setAsking(null);
            startReview(pick);
          }}
        />
      )}

      {palette && (
        <Palette
          leave={reviewing && !reviewing.paused ? () => leaveReview.current?.() : undefined}
          actions={actions}
          recent={recent.flatMap((id) => (id === openId ? [] : (items ?? []).filter((i) => i.id === id)))}
          items={items ?? []}
          skills={skills}
          skill={skill}
          onSkill={openSkill}
          onSkillNote={(id, words) => {
            openSkill(id);
            setSkillFind(words);
          }}
          onOpen={openSource}
          onAsk={(q) => openTutor(q)}
          onCreated={(s) => {
            reloadSkills();
            madeSkill(s);
            openSkill(s.id);
          }}
          onClose={() => setPalette(false)}
        />
      )}
      {adding && (
        <AddBox
          skill={addTo ? skillOf(addTo) : null}
          skills={skills}
          have={(items ?? []).flatMap((i) => (i.url ? [i.url] : []))}
          onCreate={createSkill}
          onAdd={(list, to, toastError) => addSources(list, to, toastError)}
          onFollow={followFeed}
          onPickFiles={chooseFiles}
          onClose={() => setAdding(false)}
          notify={notify}
        />
      )}
      {help && <Shortcuts onClose={() => setHelp(false)} notify={notify} />}
      {settings && <Settings section={settings.section} onClose={closeSettings} notify={notify} />}
      {editing && skills.some((s) => s.id === editing) && (
        <SkillEditor
          skill={skillOf(editing)}
          rename={renaming}
          collections={collections}
          onSaved={reloadSkills}
          onClose={() => setEditing(null)}
          onDelete={() => {
            setDeleting(editing);
            setEditing(null);
          }}
          notify={notify}
        />
      )}
      {deleting && skills.some((s) => s.id === deleting) && (
        <DeleteSkill
          skill={skillOf(deleting)}
          sources={{
            all: (items ?? []).filter((i) => i.skills.includes(deleting)).length,
            only: (items ?? []).filter((i) => i.skills.length === 1 && i.skills[0] === deleting).length,
            archived: archived.filter((i) => i.skills.includes(deleting)).length,
          }}
          onDone={(deleted) => {
            setDeleting(null);
            if (deleted) {
              reloadSkills();
              void refresh();
            }
          }}
          onChanged={() => {
            reloadSkills();
            void refresh();
          }}
          notify={notify}
        />
      )}
      {/* Hidden under a drop, but kept mounted: the toasts are a live region, read only if it was there first. */}
      <div style={{ display: "contents", visibility: dropping ? "hidden" : undefined }}>{toast}</div>
    </div>
  );
}

type Place = "home" | "sources" | "feed";
type View = { openId: string | null; skill: string | null; status: Tab; place: Place };
const sameView = (a: View, b: View) => a.openId === b.openId && a.skill === b.skill && a.status === b.status && a.place === b.place;

/** Back and forward through the views he opened (a source, a skill page, a sources tab), like a
 *  browser. `restore` shows a view, or returns false for one that no longer exists, which is skipped. */
function useHistory(view: View, restore: (v: View, by: -1 | 1) => boolean) {
  const h = useRef<{ stack: View[]; at: number }>({ stack: [], at: -1 });
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const restoreRef = useRef(restore);
  restoreRef.current = restore;

  useEffect(() => {
    const { stack, at } = h.current;
    if (stack[at] && sameView(stack[at], view)) return;
    const next = [...stack.slice(0, at + 1), view].slice(-100);
    h.current = { stack: next, at: next.length - 1 };
    rerender();
  }, [view.openId, view.skill, view.status, view.place]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = useCallback((by: -1 | 1) => {
    const { stack } = h.current;
    let from = h.current.at;
    for (let at = from + by; at >= 0 && at < stack.length; ) {
      h.current.at = at; // set first, so the view change it causes is not recorded as a new step
      if (restoreRef.current(stack[at]!, by)) break;
      // Gone since (a source deleted, a feed preview dropped): it leaves the history, so an arrow with
      // nowhere left to go goes dim instead of doing nothing.
      stack.splice(at, 1);
      if (by < 0) (from--, at--);
      h.current.at = from;
    }
    rerender();
  }, []);

  const back = useCallback(() => step(-1), [step]);
  const forward = useCallback(() => step(1), [step]);
  const { stack, at } = h.current;
  return useMemo(() => ({ back, forward, canBack: at > 0, canForward: at < stack.length - 1 }), [back, forward, at, stack.length]);
}

/** True while the window is narrower than `px`. */
function useNarrow(px: number): boolean {
  const query = `(max-width: ${px - 1}px)`;
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const on = () => setNarrow(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [query]);
  return narrow;
}

type PinGap = { index: number; y: number; left: number; width: number };
/** The gap among the list's pinned rows nearest the pointer, while it is over them (half a row past
 *  the first and last counts too); null elsewhere, so a drag to the sidebar shows no line. */
function pinGap(at: { x: number; y: number }, list: HTMLElement | null): PinGap | null {
  const rows = [...(list?.querySelectorAll<HTMLElement>(".row.pinned") ?? [])].map((el) => el.getBoundingClientRect());
  if (!rows.length) return null;
  const first = rows[0]!;
  const last = rows[rows.length - 1]!;
  if (at.x < first.left || at.x > first.right || at.y < first.top - first.height / 2 || at.y > last.bottom + last.height / 2) return null;
  let index = rows.findIndex((r) => at.y < r.top + r.height / 2);
  if (index < 0) index = rows.length;
  const y = index === 0 ? first.top : index === rows.length ? last.bottom : (rows[index - 1]!.bottom + rows[index]!.top) / 2;
  return { index, y, left: first.left, width: first.width };
}

/** The sidebar skill under the pointer while a source row is dragged (its position is where the drag began plus how far it moved). */
function pointerOf(e: DragMoveEvent): { x: number; y: number } {
  const start = e.activatorEvent as PointerEvent;
  return { x: start.clientX + e.delta.x, y: start.clientY + e.delta.y };
}
function skillUnder(e: DragMoveEvent): string | null {
  const { x, y } = pointerOf(e);
  return document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-drop-skill]")?.dataset.dropSkill || null;
}

/** A source row that drags onto a sidebar skill to file it there (Raindrop: drag a bookmark onto a
 *  collection). A click still opens it: the drag starts only after the pointer moves 6px. */
/** Renders `render()` again only when one of `deps` changes (by identity). What it renders must
 *  read anything else it needs when it runs (App's `live` ref), never from the render it was made in. */
const Same = memo(
  ({ render }: { deps: unknown[]; render: () => ReactNode }) => <>{render()}</>,
  (a, b) => a.deps.length === b.deps.length && a.deps.every((d, i) => Object.is(d, b.deps[i])),
);

function DragRow({ id, dragged, children, ref, ...props }: { id: string; dragged: boolean; children: ReactNode; ref?: Ref<HTMLDivElement> } & Omit<HTMLAttributes<HTMLDivElement>, "id">) {
  const { setNodeRef, listeners, attributes } = useDraggable({ id });
  // The row is a grid row (`role="row"`), not dnd-kit's button: its pressed state and tab stop go too.
  const { role: _role, tabIndex: _tab, "aria-pressed": _pressed, ...a11y } = attributes;
  // The context menu's trigger passes its ref too; both need the node.
  const setRef = (el: HTMLDivElement | null) => {
    setNodeRef(el);
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };
  return (
    <div
      ref={setRef}
      id={`row-${id}`}
      {...a11y}
      {...props}
      // The context menu's trigger brings its own pointer-down handler; run both.
      onPointerDown={(e) => {
        props.onPointerDown?.(e);
        listeners?.onPointerDown?.(e);
      }}
      onKeyDown={(e) => {
        props.onKeyDown?.(e);
        listeners?.onKeyDown?.(e);
      }}
      className={`${props.className ?? ""}${dragged ? " dragged" : ""}`}
    >
      {/* One cell, laid out as the row (display: contents): a grid row needs a cell, the look needs none. */}
      <span role="gridcell" className="cell">{children}</span>
    </div>
  );
}
