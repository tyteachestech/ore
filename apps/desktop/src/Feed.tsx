import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Article, CaretDown, Check, Plus, YoutubeLogo } from "./icons";
import { Hint } from "./Hint";
import { is, label, useKeymap } from "./keys";
import { MoreButton, WithMenu, type MenuAction } from "./Menu";
import { ore, opt, type Skill } from "./ore";
import { SkillChip, SkillPicker } from "./Skills";
import { errorText, load, save, type Notify } from "./util";
import { Working } from "./Working";

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
export function Feed({ skills, tick, blocked, onOpen, onFollow, onCreateSkill, notify, pickRef }: {
  skills: Skill[];
  /** Bumped when a post he read was closed, so read marks and kept posts show. */
  tick: number;
  blocked: boolean;
  onOpen: (post: FeedPost) => Promise<void> | void;
  /** Opens ⌘N, where a link is followed. */
  onFollow: () => void;
  onCreateSkill: (name: string) => Promise<Skill | undefined>;
  notify: Notify;
  /** The post the keyboard has selected, with its ⋯ actions, for ⌘K (as the reader fills its own). */
  pickRef?: { current: { title: string; actions: MenuAction[] } | null };
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
  const check = useCallback(async () => {
    setChecking(true);
    try {
      setData(await ore<FeedData>("feed", "--refresh"));
    } catch (e) {
      notify(errorText(e), "error");
    } finally {
      setChecking(false);
    }
  }, [notify]);
  useEffect(() => {
    void read().then((d) => {
      if (d?.feeds.some((f) => !f.checked_at || Date.now() - Date.parse(f.checked_at) > STALE_MS)) void check();
    });
  }, [read, check, tick]);
  useEffect(() => listRef.current?.focus({ preventScroll: true }), []);

  const feeds = data?.feeds ?? [];
  const shown = useMemo(() => (data?.posts ?? []).filter((p) => show === "all" || !p.read), [data, show]);
  const groups = useMemo(() => feeds.map((f) => ({ feed: f, posts: shown.filter((p) => p.feed === f.url).slice(0, PER_GROUP) })), [feeds, shown]);
  /** The posts in screen order, for the arrow keys. */
  const order = view === "recent" ? shown : groups.flatMap((g) => g.posts);
  const current = keyed ? order.find((p) => p.url === cursor) : undefined;

  const setRead = (post: FeedPost, on: boolean, toast = true) => {
    const put = (v: boolean) => setData((d) => d && { ...d, posts: d.posts.map((p) => (p.url === post.url ? { ...p, read: v } : p)) });
    put(on);
    ore("feed", on ? "read" : "unread", post.url).then(
      () => toast && notify(on ? "Marked read" : "Marked unread", "info", () => setRead(post, !on, false), () => setRead(post, on, false)),
      (e) => (put(!on), notify(errorText(e), "error")),
    );
  };

  const unfollow = (f: FeedInfo) => {
    const before = data;
    setData((d) => d && { feeds: d.feeds.filter((x) => x.url !== f.url), posts: d.posts.filter((p) => p.feed !== f.url) });
    ore<{ feed: FeedInfo; at: number }>("feed", "unfollow", f.url).then(
      (r) => {
        const back = () => void ore("feed", "restore", JSON.stringify(r.feed), "--at", String(r.at)).then(() => read(), (e) => notify(errorText(e), "error"));
        notify(`Unfollowed ${f.title}`, "info", back, () => void ore("feed", "unfollow", f.url).then(() => read(), (e) => notify(errorText(e), "error")));
      },
      (e) => (setData(before), notify(errorText(e), "error")),
    );
  };

  const arrange = (next: FeedInfo[], undoable = true) => {
    const before = data;
    setData((d) => d && { ...d, feeds: next });
    ore("feed", "arrange", JSON.stringify(next.map((f) => f.url))).then(
      () => undoable && before && notify("Reordered feeds", "quiet", () => arrange(before.feeds, false), () => arrange(next, false)),
      (e) => (setData(before), notify(errorText(e), "error")),
    );
  };
  const move = (f: FeedInfo, by: -1 | 1) => {
    const i = feeds.indexOf(f);
    if (i + by >= 0 && i + by < feeds.length) arrange(arrayMove(feeds, i, i + by));
  };

  const rename = (f: FeedInfo, title: string) => {
    setRenaming(null);
    retitle(f, f.title, title.replace(/\s+/g, " ").trim());
    listRef.current?.focus({ preventScroll: true });
  };
  const retitle = (f: FeedInfo, before: string, t: string, undoable = true) => {
    if (!t || t === before) return;
    const put = (name: string) => setData((d) => d && { feeds: d.feeds.map((x) => (x.url === f.url ? { ...x, title: name } : x)), posts: d.posts.map((p) => (p.feed === f.url ? { ...p, feed_title: name } : p)) });
    put(t);
    ore("feed", "set", f.url, opt("name", t)).then(
      () => undoable && notify(`Renamed to “${t}”`, "quiet", () => retitle(f, t, before, false), () => retitle(f, before, t, false)),
      (e) => (put(before), notify(errorText(e), "error")),
    );
  };

  const refile = (f: FeedInfo, next: string[], before = f.skills, undoable = true) => {
    const put = (s: string[]) => setData((d) => d && { ...d, feeds: d.feeds.map((x) => (x.url === f.url ? { ...x, skills: s } : x)) });
    put(next);
    ore("feed", "set", f.url, ...(next.length ? next.map((k) => opt("skill", k)) : [opt("skill", "")])).then(
      () => undoable && notify(`Changed the skills for ${f.title}`, "quiet", () => refile(f, before, next, false), () => refile(f, next, before, false)),
      (e) => (put(before), notify(errorText(e), "error")),
    );
  };

  const postActions = (p: FeedPost): MenuAction[] => {
    const f = feeds.find((x) => x.url === p.feed);
    return [
      { id: "open", label: "Open", hint: "↵", run: () => open(p) },
      { id: "read", label: p.read ? "Mark unread" : "Mark read", hint: label(keys["mark-read"]), run: () => setRead(p, !p.read) },
      { id: "original", label: "Open original", run: () => void openUrl(p.url).catch((e) => notify(errorText(e), "error")) },
      ...(f ? [{ id: "unfollow", label: `Unfollow ${f.title}`, danger: true, divider: true, run: () => unfollow(f) }] : []),
    ];
  };
  if (pickRef) pickRef.current = current ? { title: current.title, actions: postActions(current) } : null;
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

  const onKey = (e: React.KeyboardEvent) => {
    if (blocked || renaming) return;
    const at = order.findIndex((p) => p.url === cursor);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!order.length) return;
      const next = !keyed || at < 0 ? (e.key === "ArrowDown" ? 0 : order.length - 1) : Math.max(0, Math.min(order.length - 1, at + (e.key === "ArrowDown" ? 1 : -1)));
      setKeyed(true);
      setCursor(order[next]!.url);
      document.getElementById(`post-${order[next]!.url}`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && current) {
      e.preventDefault();
      open(current);
    } else if (current && is(e.nativeEvent, "mark-read")) {
      e.preventDefault();
      // The selection moves on, as Mail's does, so a run of posts is marked one key at a time.
      const next = show === "unread" && !current.read ? (order[at + 1] ?? order[at - 1]) : undefined;
      setRead(current, !current.read);
      if (next) setCursor(next.url);
    }
  };

  const row = (p: FeedPost, withFeed: boolean) => (
    <WithMenu key={p.url} actions={() => postActions(p)}>
      <div
        id={`post-${p.url}`}
        role="option"
        aria-selected={current === p}
        className={`row post${current === p ? " on" : ""}${p.read ? " read" : ""}`}
        onClick={() => open(p)}
      >
        <PostThumb post={p} />
        <span className="title">{p.title}</span>
        {withFeed && <span className="kind">{p.feed_title}</span>}
        {opening === p.url ? <span className="when"><Working label="Opening…" /></span> : <span className="when">{when(p.published)}</span>}
        <MoreButton label={`Actions for ${p.title}`} actions={() => postActions(p)} />
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const onDragEnd = (e: DragEndEvent) => {
    const from = feeds.findIndex((f) => f.url === e.active.id);
    const to = feeds.findIndex((f) => f.url === e.over?.id);
    if (from >= 0 && to >= 0 && from !== to) arrange(arrayMove(feeds, from, to));
  };

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
        {shown.length ? shown.map((p) => row(p, true)) : checking ? <div className="empty-state"><Working label="Checking your feeds…" /></div> : (
          <div className="empty-state">{show === "unread" && data.posts.length ? <>All read. <button className="link" onClick={() => setShow("all")}>Show all</button> to see them again.</> : "No posts in the last two weeks."}</div>
        )}
      </>
    );
  else
    body = (
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={feeds.map((f) => f.url)} strategy={verticalListSortingStrategy}>
          {groups.map((g) => (
            <FeedGroup
              key={g.feed.url}
              feed={g.feed}
              menu={() => feedActions(g.feed)}
              renaming={renaming === g.feed.url}
              onRename={(t) => rename(g.feed, t)}
              onCancelRename={() => (setRenaming(null), listRef.current?.focus({ preventScroll: true }))}
              skillsPicker={
                <SkillPicker skills={skills} value={g.feed.skills} title={g.feed.title} onChange={(next) => refile(g.feed, next)} onCreate={onCreateSkill}>
                  {g.feed.skills.length ? g.feed.skills.map((id) => <SkillChip key={id} skill={skills.find((k) => k.id === id) ?? { id, name: id }} />) : (
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
              {g.posts.length ? g.posts.map((p) => row(p, false)) : <div className="group-empty">{checking && !g.feed.checked_at ? "Checking…" : show === "unread" ? "Nothing unread" : "No posts in the last two weeks"}</div>}
            </FeedGroup>
          ))}
        </SortableContext>
      </DndContext>
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
          role="listbox"
          aria-label="Feed"
          aria-activedescendant={current ? `post-${current.url}` : undefined}
          onKeyDown={onKey}
          onPointerMove={() => keyed && setKeyed(false)}
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
  onRename: (title: string) => void;
  onCancelRename: () => void;
  skillsPicker: ReactNode;
  error: ReactNode;
  children: ReactNode;
}) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: feed.url });
  const { role: _role, tabIndex: _tab, ...a11y } = attributes;
  return (
    <div ref={setNodeRef} role="group" aria-label={feed.title} className={`feed-group${isDragging ? " slot" : ""}`} style={{ transform: CSS.Translate.toString(transform), transition }}>
      <WithMenu actions={menu}>
        <div className="list-group feed-head" ref={setActivatorNodeRef} {...a11y} {...listeners}>
          {renaming ? (
            <input
              className="row-rename"
              aria-label="Feed name"
              autoFocus
              defaultValue={feed.title}
              onFocus={(e) => e.currentTarget.select()}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") onRename(e.currentTarget.value);
                else if (e.key === "Escape") onCancelRename();
              }}
              onBlur={onCancelRename}
            />
          ) : (
            <span className="feed-name">
              {feed.title}
            </span>
          )}
          {error}
          <span className="feed-tools" onPointerDown={(e) => e.stopPropagation()}>
            {skillsPicker}
            <MoreButton label={`Actions for ${feed.title}`} actions={menu} />
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
          <Check size={12} weight="bold" />
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
                    <Check size={12} weight="bold" />
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
