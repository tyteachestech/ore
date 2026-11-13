import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { closestCenter, DndContext, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { RowSensor } from "./drag";
import { TitleField } from "./TitleField";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { pickRun, typeSelect } from "./typeahead";
import { Article, CaretDown, Plus, Tick, YoutubeLogo } from "./icons";
import { Hint } from "./Hint";
import { inTextField, is, label, useKeymap } from "./keys";
import { MoreButton, WithMenu, type MenuAction } from "./Menu";
import { ore, opt, type Skill } from "./ore";
import { SkillChips, SkillPicker, unfile } from "./Skills";
import { errorText, load, save, singleFlight, typedLast, useLibraryChanges, type Notify } from "./util";
import { Working } from "./Working";
import { citeSources, copyCited } from "./cite";
import { focusQuietly } from "./focus-near";

export type FeedPost = { feed: string; url: string; title: string; author?: string; published?: string; image?: string; read: boolean; feed_title: string; preview?: string };
type FeedInfo = { url: string; title: string; site?: string; skills: string[]; followed_at: string; checked_at?: string; error?: string };
type FeedData = { feeds: FeedInfo[]; posts: FeedPost[] };

type View = "recent" | "byfeed";
type Show = "unread" | "all";
/** The By feed view lists each feed's newest posts, so one busy feed never buries the rest. */
const PER_GROUP = 5;
/** Feeds are checked when the Feed opens, at most this often (and every few hours from App). */
const STALE_MS = 30 * 60_000;

const when = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400_000);
  if (days < 1) return "Today";
  if (days < 2) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

/** What a feed has, so he can tell a link really is a feed before and after following it. */
export type FoundFeed = { url: string; title: string; posts: number; newest?: string };
export const feedProof = (f: FoundFeed) =>
  !f.posts ? "no posts yet" : `${f.posts} post${f.posts === 1 ? "" : "s"}${f.newest ? `, newest ${when(f.newest).replace(/^(Today|Yesterday)$/, (d) => d.toLowerCase())}` : ""}`;

/** A post's picture: the feed's image, else the icon of what it links to, as source rows have. */
function PostThumb({ post }: { post: FeedPost }) {
  const [failed, setFailed] = useState(false);
  if (post.image && !failed) return <img className="thumb" src={post.image} alt="" draggable={false} loading="lazy" onError={() => setFailed(true)} />;
  const K = /youtube\.com|youtu\.be/.test(post.url) ? YoutubeLogo : Article;
  return (
    <span className="thumb none" aria-hidden="true">
      <K size={12} />
    </span>
  );
}

/** The Feed (Readwise Reader's Feed, Feedly): posts from the blogs, newsletters and channels he
 *  follows. Nothing here is in the library: opening a post reads it, and a highlight or a note line
 *  keeps it as a source. Two views (Recent, By feed) and one Unread / All switch for both, in the
 *  list title's view menu, as the sources list has. */
export function Feed({ skills, tick, blocked, onOpen, onFollow, onCreateSkill, notify }: {
  skills: Skill[];
  /** Bumped when a post he read was closed, so read marks and kept posts show. */
  tick: number;
  blocked: boolean;
  onOpen: (post: FeedPost) => Promise<void> | void;
  /** Opens ⌘N, where a link is followed. */
  onFollow: () => void;
  onCreateSkill: (name: string) => Promise<Skill | undefined>;
  notify: Notify;
}) {
  const keys = useKeymap();
  // A post is fetched before it opens: its row says so until the reader shows it.
  const [opening, setOpening] = useState<string | null>(null);
  const open = (p: FeedPost) => {
    setOpening(p.url);
    void Promise.resolve(onOpen(p)).finally(() => setOpening(null));
  };
  const [data, setData] = useState<FeedData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [view, setViewState] = useState<View>(() => (load("ore.feed.view") === "byfeed" ? "byfeed" : "recent"));
  const [show, setShowState] = useState<Show>(() => (load("ore.feed.show") === "all" ? "all" : "unread"));
  const setView = (v: View) => (setViewState(v), save("ore.feed.view", v));
  const setShow = (v: Show) => (setShowState(v), save("ore.feed.show", v));
  const [cursor, setCursor] = useState<string | null>(null);
  const [keyed, setKeyed] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const read = useCallback(async () => {
    try {
      const d = await ore<FeedData>("feed");
      setData(d);
      setLoadError(null);
      return d;
    } catch (e) {
      setLoadError(errorText(e));
      return null;
    }
  }, []);
  // One refresh at a time: a read again while one runs (a wake, Check now) gets that one, never a second. Made
  // once for the screen, so a new `notify` never brings a second, idle guard with it.
  const notifyNow = useRef(notify);
  notifyNow.current = notify;
  const check = useRef(
    singleFlight(async () => {
      setChecking(true);
      try {
        setData(await ore<FeedData>("feed", "--refresh"));
      } catch (e) {
        notifyNow.current(errorText(e), "error");
      } finally {
        setChecking(false);
      }
    }),
  ).current;
  const changes = useLibraryChanges();
  useEffect(() => {
    void read().then((d) => {
      if (d?.feeds.some((f) => !f.checked_at || Date.now() - Date.parse(f.checked_at) > STALE_MS)) void check();
    });
  }, [read, check, tick, changes]);
  useEffect(() => listRef.current?.focus({ preventScroll: true }), []);

  const feeds = data?.feeds ?? [];
  const shown = useMemo(() => (data?.posts ?? []).filter((p) => show === "all" || !p.read), [data, show]);
  const groups = useMemo(() => feeds.map((f) => ({ feed: f, posts: shown.filter((p) => p.feed === f.url).slice(0, PER_GROUP) })), [feeds, shown]);
  /** The posts in screen order, for the arrow keys. */
  const order = view === "recent" ? shown : groups.flatMap((g) => g.posts);
  const current = keyed ? order.find((p) => p.url === cursor) : undefined;

  /** Marks one post, or a pick of them at once with one Undo (F9). */
  const setRead = (post: FeedPost | FeedPost[], on: boolean, toast = true): Promise<void> => {
    const urls = new Set((Array.isArray(post) ? post : [post]).map((p) => p.url));
    const put = (v: boolean) => setData((d) => d && { ...d, posts: d.posts.map((p) => (urls.has(p.url) ? { ...p, read: v } : p)) });
    put(on);
    const what = urls.size > 1 ? ` ${urls.size} posts` : "";
    // From the history (toast false), a failure goes back to it, which says why. One write for the whole pick.
    return ore("feed", on ? "read" : "unread", ...urls).then(
      () => void (toast && notify(on ? `Marked${what} read` : `Marked${what} unread`, "info", () => setRead(post, !on, false), () => setRead(post, on, false))),
      (e) => {
        put(!on);
        if (!toast) throw e;
        notify(errorText(e), "error");
      },
    );
  };

  const unfollow = (f: FeedInfo) => {
    const before = data;
    setData((d) => d && { feeds: d.feeds.filter((x) => x.url !== f.url), posts: d.posts.filter((p) => p.feed !== f.url) });
    ore<{ feed: FeedInfo; at: number }>("feed", "unfollow", f.url).then(
      (r) => {
        const back = () => ore("feed", "restore", JSON.stringify(r.feed), "--at", String(r.at)).then(() => read());
        notify(`Unfollowed ${f.title}`, "info", back, () => ore("feed", "unfollow", f.url).then(() => read()));
      },
      (e) => (setData(before), notify(errorText(e), "error")),
    );
  };

  const arrange = (next: FeedInfo[], undoable = true) => {
    const before = data;
    setData((d) => d && { ...d, feeds: next });
    // From the history (undoable false), a failure goes back to it, which says why.
    return ore("feed", "arrange", JSON.stringify(next.map((f) => f.url))).then(
      () => void (undoable && before && notify("Reordered feeds", "quiet", () => arrange(before.feeds, false), () => arrange(next, false))),
      (e) => {
        setData(before);
        if (!undoable) throw e;
        notify(errorText(e), "error");
      },
    );
  };
  const move = (f: FeedInfo, by: -1 | 1) => {
    const i = feeds.indexOf(f);
    if (i + by >= 0 && i + by < feeds.length) arrange(arrayMove(feeds, i, i + by));
  };

  /** False when the write failed (and a toast said why), so the field keeps what he typed. */
  const retitle = async (f: FeedInfo, before: string, t: string, undoable = true): Promise<boolean> => {
    if (!t || t === before) return true;
    const put = (name: string) => setData((d) => d && { feeds: d.feeds.map((x) => (x.url === f.url ? { ...x, title: name } : x)), posts: d.posts.map((p) => (p.feed === f.url ? { ...p, feed_title: name } : p)) });
    put(t);
    return ore("feed", "set", f.url, opt("name", t)).then(
      () => (undoable && notify(`Renamed to “${t}”`, "quiet", () => retitle(f, t, before, false), () => retitle(f, before, t, false)), true),
      (e) => {
        put(before);
        if (!undoable) throw e;
        notify(errorText(e), "error");
        return false;
      },
    );
  };

  const refile = (f: FeedInfo, next: string[], before = f.skills, undoable = true) => {
    const put = (s: (now: string[]) => string[]) => setData((d) => d && { ...d, feeds: d.feeds.map((x) => (x.url === f.url ? { ...x, skills: s(x.skills) } : x)) });
    put(() => next);
    return ore("feed", "set", f.url, ...(next.length ? next.map((k) => opt("skill", k)) : [opt("skill", "")])).then(
      () => void (undoable && notify(`Changed the skills for ${f.title}`, "quiet", () => refile(f, before, next, false), () => refile(f, next, before, false))),
      (e) => {
        put((now) => unfile(now, next, before));
        if (!undoable) throw e;
        notify(errorText(e), "error");
      },
    );
  };

  /** A post as its linked title, as a source row copies (⌘C). */
  const copyPost = (p: FeedPost | FeedPost[]) => void copyCited(citeSources(Array.isArray(p) ? p : [p])).then(() => notify("Copied as Markdown"), (e) => notify(errorText(e), "error"));
  /** A post its menu takes out of view (Mark read in Unread, Unfollow): the cursor goes on to the next post that
   *  stays, else the one before, as the mark-read key moves it (Mail), and the list keeps focus, not <body>. */
  const moveOn = (from: FeedPost, gone: (x: FeedPost) => boolean) => {
    const at = order.indexOf(from);
    const next = [...order.slice(at + 1), ...order.slice(0, Math.max(0, at)).reverse()].find((x) => !gone(x));
    if (next) setCursor(next.url);
    if (typedLast()) setKeyed(true);
    if (listRef.current) focusQuietly(listRef.current);
  };
  // ⌘-click and ⇧-click pick posts (F9, as in the source lists): the menu then marks or copies them all.
  const [picked, setPicked] = useState<string[]>([]);
  const anchor = useRef<string | null>(null);
  const pick = order.filter((p) => picked.includes(p.url));
  const pressedBlank = useRef(false);
  useEffect(() => {
    if (!picked.length) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && !blocked && !inTextField(e) && setPicked([]);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked.length, blocked]);
  const clickRow = (e: React.MouseEvent, p: FeedPost) => {
    if (e.metaKey) {
      setPicked((now) => (now.includes(p.url) ? now.filter((u) => u !== p.url) : [...(now.length ? now : current && current !== p ? [current.url] : []), p.url]));
      anchor.current = p.url;
    } else if (e.shiftKey) {
      // From the last post clicked, or this one when that has left the list.
      setPicked(pickRun(order.map((x) => x.url), anchor.current ?? current?.url ?? null, p.url));
    } else {
      setPicked([]);
      anchor.current = p.url;
      return open(p);
    }
    setCursor(p.url);
  };
  const manyActions = (ps: FeedPost[]): MenuAction[] => {
    const unread = ps.some((p) => !p.read);
    return [
      { id: "read", label: unread ? `Mark ${ps.length} read` : `Mark ${ps.length} unread`, hint: label(keys["mark-read"]), run: () => (setPicked([]), unread && show === "unread" && moveOn(ps[0]!, (x) => ps.includes(x)), setRead(ps, unread)) },
      { id: "copy", label: `Copy ${ps.length} as Markdown`, hint: label(keys.copy), run: () => copyPost(ps) },
    ];
  };
  const postActions = (p: FeedPost): MenuAction[] => {
    if (pick.length > 1 && picked.includes(p.url)) return manyActions(pick);
    const f = feeds.find((x) => x.url === p.feed);
    return [
      { id: "open", label: "Open", hint: "↵", run: () => open(p) },
      { id: "read", label: p.read ? "Mark unread" : "Mark read", hint: label(keys["mark-read"]), run: () => (!p.read && show === "unread" && moveOn(p, (x) => x === p), setRead(p, !p.read)) },
      { id: "original", label: "Open original", divider: true, run: () => void openUrl(p.url).catch((e) => notify(errorText(e), "error")) },
      { id: "copy", label: "Copy as Markdown", hint: label(keys.copy), run: () => copyPost(p) },
      ...(f ? [{ id: "unfollow", label: `Unfollow ${f.title}`, danger: true, divider: true, run: () => (moveOn(p, (x) => x.feed === f.url), unfollow(f)) }] : []),
    ];
  };
  const feedActions = (f: FeedInfo): MenuAction[] => {
    const i = feeds.indexOf(f);
    return [
      { id: "rename", label: "Rename…", run: () => setRenaming(f.url) },
      ...(f.site ? [{ id: "site", label: "Open site", run: () => void openUrl(f.site!).catch((e) => notify(errorText(e), "error")) }] : []),
      ...(i > 0 ? [{ id: "up", label: "Move up", run: () => move(f, -1) }] : []),
      ...(i < feeds.length - 1 ? [{ id: "down", label: "Move down", run: () => move(f, 1) }] : []),
      { id: "unfollow", label: "Unfollow", danger: true, divider: true, run: () => unfollow(f) },
    ];
  };

  /** Finder's type-select on the posts' titles (D232). */
  const typed = useMemo(typeSelect, []);
  const onKey = (e: React.KeyboardEvent) => {
    if (blocked || renaming) return;
    const at = order.findIndex((p) => p.url === cursor);
    const jump = inTextField(e.nativeEvent) ? null : typed(e, order.map((x) => x.title), keyed ? at : -1);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!order.length) return;
      const next = !keyed || at < 0 ? (e.key === "ArrowDown" ? 0 : order.length - 1) : Math.max(0, Math.min(order.length - 1, at + (e.key === "ArrowDown" ? 1 : -1)));
      if (e.shiftKey && at >= 0) {
        // Finder: ⇧↑↓ grow or shrink the pick from where it started, after a ⌘-click too.
        const ids = order.map((x) => x.url);
        if (!picked.length || !anchor.current || !ids.includes(anchor.current)) anchor.current = order[at]!.url;
        // From the post the cursor is on, after a ⌘-click too (the mouse leaves the cursor un-keyed).
        const to = Math.max(0, Math.min(order.length - 1, at + (e.key === "ArrowDown" ? 1 : -1)));
        setPicked(pickRun(ids, anchor.current, ids[to]!));
        setKeyed(true);
        setCursor(ids[to]!);
        document.getElementById(`post-${ids[to]!}`)?.scrollIntoView({ block: "nearest" });
        return;
      } else {
        setPicked([]);
        anchor.current = order[next]!.url;
      }
      setKeyed(true);
      setCursor(order[next]!.url);
      document.getElementById(`post-${order[next]!.url}`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && current) {
      e.preventDefault();
      open(current);
    } else if (pick.length > 1 && is(e.nativeEvent, "copy") && !getSelection()?.toString()) {
      e.preventDefault();
      manyActions(pick).find((a) => a.id === "copy")!.run();
    } else if (current && is(e.nativeEvent, "copy") && !getSelection()?.toString()) {
      e.preventDefault();
      copyPost(current);
    } else if (pick.length > 1 && is(e.nativeEvent, "mark-read")) {
      // The key acts on the pick, as its menu's Mark N read does (D234).
      e.preventDefault();
      manyActions(pick).find((a) => a.id === "read")!.run();
    } else if (current && is(e.nativeEvent, "mark-read")) {
      e.preventDefault();
      // The selection moves on, as Mail's does, so a run of posts is marked one key at a time.
      const next = show === "unread" && !current.read ? (order[at + 1] ?? order[at - 1]) : undefined;
      setRead(current, !current.read);
      if (next) setCursor(next.url);
    } else if (jump !== null) {
      // The first letters of a title select its post (D232), never a plain-letter action.
      e.preventDefault();
      e.stopPropagation();
      const i = jump;
      if (i < 0) return;
      setPicked([]);
      anchor.current = order[i]!.url;
      setKeyed(true);
      setCursor(order[i]!.url);
      document.getElementById(`post-${order[i]!.url}`)?.scrollIntoView({ block: "nearest" });
    }
  };

  const row = (p: FeedPost, withFeed: boolean) => (
    <WithMenu key={p.url} actions={() => postActions(p)}>
      <div
        id={`post-${p.url}`}
        role="row"
        aria-selected={picked.length ? picked.includes(p.url) : current === p}
        className={`row post${current === p ? " on" : ""}${picked.includes(p.url) ? " sel" : ""}${p.read ? " read" : ""}`}
        onClick={(e) => !(e.target as Element).closest("button") && clickRow(e, p)}
      >
        <span role="gridcell" className="cell">
          <PostThumb post={p} />
          <span className="title">{p.title}</span>
          {withFeed && <span className="kind">{p.feed_title}</span>}
          {opening === p.url ? <span className="when"><Working label="Opening…" /></span> : <span className="when">{when(p.published)}</span>}
          <MoreButton label={`Actions for ${p.title}`} actions={() => postActions(p)} />
        </span>
      </div>
    </WithMenu>
  );

  const failing = feeds.filter((f) => f.error);
  const retryLine = (f: FeedInfo) => (
    <div key={f.url} className="feed-error" role="alert">
      <span className="err">
        {f.title}: {f.error}
      </span>
      <button className="pill-btn" onClick={() => void check()} disabled={checking}>
        Try again
      </button>
      <button className="pill-btn" onClick={() => unfollow(f)}>
        Unfollow
      </button>
    </div>
  );

  const sensors = useSensors(useSensor(RowSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const onDragEnd = (e: DragEndEvent) => {
    const from = feeds.findIndex((f) => f.url === e.active.id);
    const to = feeds.findIndex((f) => f.url === e.over?.id);
    if (from >= 0 && to >= 0 && from !== to) arrange(arrayMove(feeds, from, to));
  };

  /** The posts: a grid, not a listbox, since a row holds its own ⋯ (ARIA's layout grid). The list around it
   *  keeps the focus and the keys, so an empty Feed takes focus too. */
  const grid = (rows: ReactNode) => (
    <div role="grid" aria-label="Posts">
      {rows}
    </div>
  );
  let body: ReactNode;
  if (loadError)
    body = (
      <div className="empty-state err" role="alert">
        <p>{loadError}</p>
        <button className="pill-btn" onClick={() => void read()}>
          Try again
        </button>
      </div>
    );
  else if (!data) body = null;
  else if (!feeds.length)
    body = (
      <div className="empty-state">
        <p>
          Follow a blog, newsletter or YouTube channel: paste its link with <b>{label(keys.add)}</b>. Posts land here; only what you highlight is saved.
        </p>
        <button className="pill-btn" onClick={onFollow}>
          <Plus size={12} weight="bold" aria-hidden="true" /> Follow
        </button>
      </div>
    );
  else if (view === "recent")
    body = (
      <>
        {failing.map(retryLine)}
        {shown.length ? grid(shown.map((p) => row(p, true))) : checking ? <div className="empty-state"><Working label="Checking your feeds…" /></div> : (
          <div className="empty-state">{show === "unread" && data.posts.length ? <>All read. <button className="link" onClick={() => setShow("all")}>Show all</button> to see them again.</> : "No posts in the last two weeks."}</div>
        )}
      </>
    );
  else
    body = grid(
      // dnd-kit's live region goes to <body>: a grid's children are rows and row groups only.
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={{ container: document.body }}>
        <SortableContext items={feeds.map((f) => f.url)} strategy={verticalListSortingStrategy}>
          {groups.map((g) => (
            <FeedGroup
              key={g.feed.url}
              feed={g.feed}
              menu={() => feedActions(g.feed)}
              renaming={renaming === g.feed.url}
              onRename={(t) => retitle(g.feed, g.feed.title, t.replace(/\s+/g, " ").trim())}
              onCancelRename={(byKey = true) => (setRenaming(null), byKey && listRef.current?.focus({ preventScroll: true }))}
              skillsPicker={
                <SkillPicker skills={skills} value={g.feed.skills} title={g.feed.title} onChange={(next) => refile(g.feed, next)} onCreate={onCreateSkill}>
                  {g.feed.skills.length ? <SkillChips ids={g.feed.skills} skills={skills} /> : (
                    // Where the posts he keeps from this feed are filed; shown on hover until one is set.
                    <span className="add-dest feed-skill">
                      <Plus size={12} weight="bold" aria-hidden="true" />
                      Skill
                    </span>
                  )}
                </SkillPicker>
              }
              error={g.feed.error && (
                <span className="feed-error">
                  <span className="err">{g.feed.error}</span>
                  <button className="pill-btn" onClick={() => void check()} disabled={checking}>Try again</button>
                </span>
              )}
            >
              {g.posts.length ? g.posts.map((p) => row(p, false)) : <div className="group-empty" role="row"><span role="gridcell">{checking && !g.feed.checked_at ? "Checking…" : show === "unread" ? "Nothing unread" : "No posts in the last two weeks"}</span></div>}
            </FeedGroup>
          ))}
        </SortableContext>
      </DndContext>,
    );

  return (
    <>
      <div className="list-bar">
        <FeedViewMenu view={view} show={show} setView={setView} setShow={setShow} />
        {checking && !!shown.length && <Working label="Checking…" />}
      </div>
      {/* Right-click on the list offers its create action (Finder's New Folder), as the sources list does. */}
      <WithMenu actions={[{ id: "follow", label: "Follow a blog or newsletter…", hint: label(keys.add), run: onFollow }]}>
        <div
          className="list feed-list"
          ref={listRef}
          tabIndex={0}
          role="group"
          aria-label="Feed"
          aria-activedescendant={current ? `post-${current.url}` : undefined}
          onKeyDown={onKey}
          onPointerMove={() => keyed && setKeyed(false)}
          // A click on empty space drops the pick (Finder); not the end of a drag that began on a row.
          onPointerDown={(e) => (pressedBlank.current = !(e.target as Element).closest(".row, button, [role=menu]"))}
          onClick={(e) => picked.length && pressedBlank.current && !(e.target as Element).closest(".row, button, [role=menu]") && setPicked([])}
        >
          {body}
        </div>
      </WithMenu>
    </>
  );
}

/** A feed's header in the By feed view: drag it to reorder (Feedly's sidebar, Linear's groups). */
function FeedGroup({ feed, menu, renaming, onRename, onCancelRename, skillsPicker, error, children }: {
  feed: FeedInfo;
  menu: () => MenuAction[];
  renaming: boolean;
  onRename: (title: string) => Promise<boolean>;
  onCancelRename: (byKey?: boolean) => void;
  skillsPicker: ReactNode;
  error: ReactNode;
  children: ReactNode;
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: feed.url });
  const { role: _role, tabIndex: _tab, "aria-pressed": _pressed, ...a11y } = attributes;
  return (
    <div ref={setNodeRef} role="rowgroup" aria-label={feed.title} className={`feed-group${isDragging ? " slot" : ""}`} style={{ transform: CSS.Translate.toString(transform), transition }}>
      <WithMenu actions={menu}>
        <div className="list-group feed-head" role="row" ref={setActivatorNodeRef} {...a11y} {...listeners}>
          <span role="gridcell" className="cell">
          {renaming ? (
            <TitleField value={feed.title} label="Feed name" onSave={onRename} onClose={onCancelRename} />
          ) : (
            <span className="feed-name">
              {feed.title}
            </span>
          )}
          {error}
          <span className="feed-tools" data-no-drag>
            {skillsPicker}
            <MoreButton label={`Actions for ${feed.title}`} actions={menu} />
          </span>
          </span>
        </div>
      </WithMenu>
      {children}
    </div>
  );
}

/** Recent or By feed, and Unread or All for both: the list title's menu, as Linear's view menu. */
function FeedViewMenu({ view, show, setView, setShow }: { view: View; show: Show; setView: (v: View) => void; setShow: (s: Show) => void }) {
  const item = (value: string, text: string) => (
    <DropdownMenu.RadioItem value={value} className="menu-item check">
      <span className="menu-tick">
        <DropdownMenu.ItemIndicator>
          <Tick />
        </DropdownMenu.ItemIndicator>
      </span>
      <span className="menu-label">{text}</span>
    </DropdownMenu.RadioItem>
  );
  return (
    <DropdownMenu.Root modal={false}>
      <Hint text="Show recent posts or posts by feed, unread or all">
        <DropdownMenu.Trigger asChild>
          <button className="view-menu">
            <h2>{view === "recent" ? "Recent" : "By feed"}</h2>
            {show === "all" && <span className="view-sub">All</span>}
            <CaretDown size={11} weight="bold" aria-hidden="true" />
          </button>
        </DropdownMenu.Trigger>
      </Hint>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="popover menu-list" align="start" sideOffset={4} collisionPadding={8}>
          <DropdownMenu.RadioGroup value={view} onValueChange={(v) => setView(v as View)}>
            {item("recent", "Recent")}
            {item("byfeed", "By feed")}
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator className="menu-sep" />
          {/* Toggling keeps the menu open so he sees the list change (Linear's display options). */}
          <DropdownMenu.RadioGroup value={show} onValueChange={(v) => setShow(v as Show)}>
            {(["unread", "all"] as const).map((v) => (
              <DropdownMenu.RadioItem key={v} value={v} className="menu-item check" onSelect={(e) => e.preventDefault()}>
                <span className="menu-tick">
                  <DropdownMenu.ItemIndicator>
                    <Tick />
                  </DropdownMenu.ItemIndicator>
                </span>
                <span className="menu-label">{v === "unread" ? "Unread" : "All"}</span>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
