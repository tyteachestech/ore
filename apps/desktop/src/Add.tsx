import { Rss, BookOpenText, FilePdf, FileText, FileX, Globe, GraduationCap, Headphones, Image as ImageIcon, LinkSimple, NotePencil, Paperclip, PlayCircle, Plus, TextAlignLeft, Stack, YoutubeLogo, type Icon } from "./icons";
import { useEffect, useRef, useState } from "react";
import { Grow } from "./Grow";
import { feedProof, type FoundFeed } from "./Feed";
import { Hint } from "./Hint";
import { Trap } from "./Trap";
import { is } from "./keys";
import { SkillIcon } from "./IconPicker";
import { ore, type Skill } from "./ore";
import { copiedFiles, pastesFiles, takeCopied } from "./copied";
import { copiedWhat, entries, entryName, entryText, fileKind, isCourseLink, pastedHtml, withHtml, words, type Entry, type FileKind, type Pasted } from "./paste";
import { SkillChip, SkillPicker } from "./Skills";
import { useFocusWhileMounted, type Notify } from "./util";
import { Working } from "./Working";

/** A course link says what ↵ will add (D79): the course and how many lessons, read from the link. */
function useCourse(url: string | null): { title: string; lessons: unknown[] } | "reading" | "unreadable" | null {
  const [plan, setPlan] = useState<{ url: string; got: { title: string; lessons: unknown[] } | "unreadable" } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    const t = setTimeout(() => {
      ore<{ title: string; lessons: unknown[] }>("course", "preview", url).then(
        (got) => live && setPlan({ url, got }),
        () => live && setPlan({ url, got: "unreadable" }),
      );
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [url]);
  if (!url) return null;
  return plan?.url === url ? plan.got : "reading";
}

/** The feed behind a link he pasted (a blog, a Substack, a YouTube channel), so the box can offer Follow. */
function useFeedOf(url: string | null): FoundFeed | null {
  const [found, setFound] = useState<{ from: string; feed: FoundFeed | null } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    const t = setTimeout(() => {
      ore<FoundFeed>("feed", "find", url).then(
        (feed) => live && setFound({ from: url, feed }),
        () => live && setFound({ from: url, feed: null }),
      );
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [url]);
  return url && found?.from === url ? found.feed : null;
}

function Detected({ list }: { list: Entry[] }) {
  const one = list.length === 1 && list[0]!.kind === "link" && isCourseLink(list[0]!.url) ? list[0]!.url : null;
  const course = useCourse(one);
  if (!list.length) return null;
  if (course)
    return (
      <span className="add-kind">
        <GraduationCap size={14} aria-hidden="true" />
        {course === "reading" ? "Course · reading its lessons…" : course === "unreadable" ? "Course · couldn’t read its lessons; ↵ tries again" : `Course · ${course.lessons.length} lessons · ${course.title}`}
      </span>
    );
  const e = list[0]!;
  const Icon = e.kind === "link" ? LinkSimple : e.kind === "file" ? FileText : TextAlignLeft;
  const what =
    list.length > 1 ? `${list.length} ${e.kind === "file" || list.some((x) => x.kind === "file") ? "sources" : "links"}`
    : e.kind === "text" ? `Text · ${words(e.text).toLocaleString()} words`
    : `${e.kind === "link" ? "Link" : "File"} · ${entryName(e)}`;
  return (
    <span className="add-kind">
      <Icon size={14} aria-hidden="true" />
      {what}
    </span>
  );
}

/** ⌘N and the add buttons: paste anything, like Raindrop's "Add link" box. A link or file path is
 *  fetched or read, any other text becomes a source as written. Its skills are picked in the box, as
 *  labels are in Linear's new-issue box: the open skill is ticked already, Tab reaches the pills, and a
 *  course is filed whole. ↵ adds, ⇧↵ is a new line; files can also be picked (⌘O) or dropped anywhere. */
export function AddBox({ skill, skills, have, onCreate, onAdd, onFollow, onPickFiles, onClose, notify }: {
  skill: Skill | null;
  skills: Skill[];
  /** Links already in the library, never offered from the clipboard. */
  have: string[];
  onCreate: (name: string) => Promise<Skill | undefined>;
  onAdd: (list: Entry[], skills: string[], toastError: boolean) => Promise<{ failure: string | null; failed: Entry[]; cancelled: boolean }>;
  /** Follows the feed behind a link (Feed); why it failed, or null. */
  onFollow: (url: string, skills: string[]) => Promise<string | null>;
  /** Opens the system's file panel: the files picked, none on Cancel. */
  onPickFiles: () => Promise<string[]>;
  onClose: () => void;
  /** Says why an add failed after the box was closed while it ran (Esc mid-add). */
  notify: Notify;
}) {
  const [value, setValue] = useState("");
  const [picked, setPicked] = useState<string[]>(skill ? [skill.id] : []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const skillsRef = useRef<HTMLSpanElement>(null);
  useFocusWhileMounted(ref);
  const open = useRef(true);
  useEffect(() => {
    open.current = true;
    return () => void (open.current = false);
  }, []);
  // A link or file he just copied in another app: the first row while the field is empty; ↵ adds it.
  const [copied, setCopied] = useState<Entry | null>(null);
  useEffect(() => void takeCopied(have).then(setCopied), []); // eslint-disable-line react-hooks/exhaustive-deps
  const offer = !value.trim() && !busy && !error ? copied : null;
  // A page's text pasted into the empty box (a ChatGPT answer) goes in as its HTML, images and tables kept.
  const [pasted, setPasted] = useState<Pasted | null>(null);
  const list = withHtml(entries(value), pasted);
  const one = list.length === 1 && list[0]!.kind === "link" && !isCourseLink(list[0]!.url) ? list[0]!.url : null;
  const feed = useFeedOf(busy ? null : one);
  /** The link is the feed itself: adding it would be refused, so ↵ follows it. */
  const isFeed = !!feed && feed.url === one;
  const follow = async () => {
    if (!one || busy) return;
    setBusy(true);
    setError(null);
    const why = await onFollow(one, picked);
    if (!open.current) return why ? notify(why, "error") : undefined;
    setBusy(false);
    if (!why) return onClose();
    setError(why);
  };

  /** Picked files join the box as pasted ones do, so his text and skills stay and ↵ adds them all. */
  const pickFiles = async () => {
    const paths = await onPickFiles();
    if (!open.current) return;
    if (paths.length) {
      setValue((v) => [v.trim(), ...paths.map((path) => entryText({ kind: "file", path }))].filter(Boolean).join("\n"));
      setError(null);
    }
    ref.current?.focus();
  };

  const submit = async (what = list) => {
    if (!what.length || busy) return;
    setBusy(true);
    setError(null);
    const { failure, failed, cancelled } = await onAdd(what, picked, false);
    if (!open.current) return failure ? notify(failure, "error") : undefined;
    setBusy(false);
    // Cancelled from the toast: the box stays with what didn't go in, to fix or add again.
    if (cancelled && !failure) return failed.length ? (setValue(failed.map(entryText).join("\n")), ref.current?.focus()) : onClose();
    if (!failure) return onClose();
    // Keep only what didn't go in: the rest is already added, and a retry mustn't add it twice.
    if (failed.length < what.length || what !== list) setValue(failed.map(entryText).join("\n"));
    setError(failed.length < what.length ? `Added ${what.length - failed.length} of ${what.length}. ${failure}` : failure);
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Trap>
      <div className="panel add-box" role="dialog" aria-modal="true" aria-label="Add a source">
        <Grow
          ref={ref}
          className="panel-input add-input"
          aria-label="Link, file path or text"
          value={value}
          readOnly={busy}
          rows={1}
          placeholder="Paste a link, a file, or any text…"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onPaste={(e) => {
            const box = e.currentTarget;
            if (!box.value.trim() || box.selectionEnd - box.selectionStart === box.value.length) setPasted({ text: e.clipboardData.getData("text/plain"), html: pastedHtml(e.clipboardData) });
            // A file copied in Finder pastes only its name: put its path in, as a drop would add it.
            if (!pastesFiles(e.clipboardData)) return;
            e.preventDefault();
            void copiedFiles().then((files) => {
              if (!files.length) return setError("Couldn't read the copied file. Drag it in, or choose it with File.");
              setValue((v) => [v.trim(), ...files.map(entryText)].filter(Boolean).join("\n"));
              setError(null);
            });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (isFeed && !offer) void follow();
              else void submit(offer ? [offer] : list);
            } else if (e.key === "Tab" && !e.shiftKey) {
              // Tab goes to the skills and opens them (the field and its skills are the box's two choices).
              e.preventDefault();
              skillsRef.current?.querySelector("button")?.click();
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            } else if (is(e.nativeEvent, "file")) {
              // ⌘O here picks into the box, not past it (the app's ⌘O would close it).
              e.preventDefault();
              e.stopPropagation();
              void pickFiles();
            }
          }}
        />
        {offer && <Copied entry={offer} onAdd={() => void submit([offer])} />}
        <div className="panel-foot">
          {busy ? <span><Working label="Adding…" /></span> : error ? <span className="err">{error}</span> : isFeed ? (
            <span className="add-kind">
              <Rss size={14} aria-hidden="true" />
              Feed · {feed!.title} · {feedProof(feed!)}
            </span>
          ) : feed ? (
            // The page has a feed: what it holds, so he can tell Follow will bring real posts.
            <span className="add-kind">
              <Rss size={14} aria-hidden="true" />
              {feed.title} · {feedProof(feed)}
            </span>
          ) : <Detected list={list} />}
          <span className="right">
            <span className="add-skills" ref={skillsRef}>
              <SkillPicker skills={skills} value={picked} title="the new source" onChange={(next) => setPicked(next)} onCreate={onCreate} returnFocus={ref}>
                {picked.length ? (
                  picked.map((id) => <SkillChip key={id} skill={skills.find((k) => k.id === id) ?? { id, name: id }} />)
                ) : (
                  <span className="add-dest">
                    <Plus size={12} weight="bold" aria-hidden="true" />
                    Skill
                  </span>
                )}
              </SkillPicker>
            </span>
            {/* A blog, newsletter or channel: its new posts land in the Feed, nothing saved until he keeps one. */}
            {feed && !isFeed && (
              <Hint text={`Follow ${feed.title} (${feedProof(feed)}): new posts show in the Feed`}>
                <button className="add-file" onClick={() => void follow()} disabled={busy}>
                  <Rss size={13} aria-hidden="true" />
                  Follow
                </button>
              </Hint>
            )}
            {/* A page that needs his sign-in (Medium, X, Notion) comes in as his browser shows it (D96). */}
            <Hint text="Add the page open in Safari or Chrome">
              <button className="add-file" onClick={() => void submit([{ kind: "tab" }])} disabled={busy}>
                <Globe size={13} aria-hidden="true" />
                Browser tab
              </button>
            </Hint>
            <Hint text="Choose a file" keys="file">
              <button className="add-file" onClick={() => void pickFiles()}>
                <Paperclip size={13} aria-hidden="true" />
                File
              </button>
            </Hint>
            <span>
              <kbd>↵</kbd> {isFeed ? "Follow" : "Add"}
            </span>
          </span>
        </div>
      </div>
      </Trap>
    </div>
  );
}

/** The copied link or file, as Chrome's address bar offers "Link you copied": what it is and where from. */
function Copied({ entry, onAdd }: { entry: Entry; onAdd: () => void }) {
  const what = copiedWhat(entry);
  const Icon = entry.kind === "file" ? TILES[fileKind(entry.path)!] : what === "video" ? YoutubeLogo : what === "course" ? GraduationCap : what === "episode" ? Headphones : what === "PDF" ? FilePdf : LinkSimple;
  return (
    <button className="add-copied" onClick={onAdd}>
      <Icon size={16} aria-hidden="true" />
      <span className="text">
        <span className="what">{entry.kind === "link" ? entry.url.replace(/^https?:\/\/(www\.)?/, "") : entryName(entry)}</span>
        <span className="from">The {what} you copied</span>
      </span>
    </button>
  );
}

const TILES = { pdf: FilePdf, book: BookOpenText, note: NotePencil, page: Globe, image: ImageIcon, audio: Headphones, video: PlayCircle } satisfies Record<FileKind, Icon>;
const NAMES: Record<FileKind, string> = { pdf: "PDF", book: "book", note: "note", page: "web page", image: "image", audio: "audio", video: "video" };

export type Dropping = { kinds: (FileKind | null)[]; skill: Skill | null };

/** While files are dragged over the window (ChatGPT's "Add anything"): the main pane dims and a stack of
 *  source tiles fans out, the front one the kind being dragged, over where letting go files it. The
 *  sidebar stays lit, so a skill there is still a target. It fades out on drop or leave. */
export function DropOverlay({ drop }: { drop: Dropping | null }) {
  const [shown, setShown] = useState<{ drop: Dropping; leaving: boolean } | null>(null);
  useEffect(() => {
    if (drop) return setShown({ drop, leaving: false });
    setShown((s) => s && { ...s, leaving: true });
    const t = setTimeout(() => setShown(null), 140);
    return () => clearTimeout(t);
  }, [drop]);
  if (!shown) return null;
  const { kinds, skill } = shown.drop;
  const known = kinds.filter((k): k is FileKind => k !== null);
  const front = known[0] ?? null;
  const back = (["pdf", "book", "note"] as const).filter((k) => k !== front).slice(0, 2);
  const FrontIcon = front ? TILES[front] : FileX;
  return (
    <div className={`drop-veil${shown.leaving ? " leaving" : ""}${front ? "" : " refused"}`} role="status">
      <div className="drop-tiles" aria-hidden="true">
        {back.map((k, i) => {
          const Tile = TILES[k];
          return (
            <span key={k} className={`drop-tile back b${i}`}>
              <Tile size={26} weight="fill" />
            </span>
          );
        })}
        <span className="drop-tile front">
          <FrontIcon size={30} weight="fill" />
        </span>
      </div>
      {front ? (
        <>
          <h2>
            Add to
            {skill?.icon ? <SkillIcon icon={skill.icon} color={skill.color} /> : !skill && <Stack size={22} weight="bold" aria-hidden="true" />}
            <span className="name">{skill ? skill.name : "All sources"}</span>
          </h2>
          <p>{kinds.length > 1 ? `Drop ${kinds.length} files to read and highlight them` : front === "audio" ? "Drop the audio to transcribe it" : `Drop the ${NAMES[front]} to read and highlight it`}</p>
        </>
      ) : (
        <>
          <h2>Can’t add {kinds.length > 1 ? "these files" : "this file"}</h2>
          <p>Ore reads PDF, EPUB, Word, PowerPoint, Markdown, text, HTML, notebook, subtitle, image and audio files</p>
        </>
      )}
    </div>
  );
}
