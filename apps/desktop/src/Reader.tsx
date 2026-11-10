import { openUrl } from "@tauri-apps/plugin-opener";
import { ArrowLeft, BookOpenText, CaretDown, CaretLeft, CaretRight, CaretUp, Check, Copy, Eraser, Eye, EyeSlash, MagnifyingGlass, Pause, Play, SidebarRight, Subtitles, Trash, X } from "./icons";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Children, memo, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from "react";
import { createPortal, flushSync } from "react-dom";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { convertFileSrc } from "@tauri-apps/api/core";
import { Collected, CollectedPanel, ICON, LABEL, MEANS, type Fit } from "./Collected";
import { PixelQuestion } from "./PixelIcon";
import { FindBar, onceFound } from "./Find";
import { blocksOf, FocusBox, startBlock, textRange } from "./Focus";
import { snapRange } from "./snap";
import { Grab } from "./Grab";
import { Marks, type Mark } from "./Marks";
import { Finish, type Reveal } from "./Finish";
import { Grow } from "./Grow";
import { Hint } from "./Hint";
import { Thumb } from "./Thumb";
import { SkillIcon } from "./IconPicker";
import { inTextField, is, isLoose, label, useKeymap } from "./keys";
import { bigger, keepPlace, placeOf, smaller } from "./reading";
import { againIn, define, lookable, wordAt } from "./lookup";
import { Explain } from "./Explain";
import { citeQuote, citeSources, copyCited, type Cited } from "./cite";
import { MoreButton, WithMenu, type MenuAction } from "./Menu";
import { findChapterEnds, Margin, type ChapterEnd, type MarginHandle } from "./Margin";
import type { LinkTarget, NoteEditorHandle } from "./editor/NoteEditor";
import { clickBelow, SidePanel, SourceNoteBody, useSourceNote, type SideTab } from "./Notes";
import { QuestionsPanel } from "./Questions";
import { Position, ReadingPill } from "./Outline";
import { openOriginal, originalLabel, pathOf, pubDate, revealInFinder } from "./original";
import { INTENTS, ore, opt, PHONE, visible, type Annotation, type CardFull, type ChapterFeedback, type Doc, type Intent, type Item, type Skill } from "./ore";
import { SkillChip, skillMade, SkillPicker, unfile } from "./Skills";
import { chunks, footnotes, hitTest, indexText, rangeFor, skeletonOffset, sourceHint, sourceQuote, sourceSkeleton, type TextIndex } from "./text";
import { alignWords, skeletonRange, wordAtOffset, wordAtTime } from "./transcript";
import { firstFrom, sentences, Speaker, speechAvailable, speechTrouble } from "./listen";
import { clock, MAX_RATE, MIN_RATE, Speed, useAudio, useYouTube, VideoPlayer } from "./Video";
import { ownsMediaKey } from "./media-keys";
import { errorText, inOrder, load, save, useFocusBack, useLibraryChanges, type Notify } from "./util";
import { TitleField } from "./TitleField";
import { popupPlace, type Aim } from "./popup-place";
import { TablesLine } from "./Tables";
import { Working } from "./Working";

/** Background enrich gets this long after capture before the reader stops waiting for it. */
const ENRICH_GIVE_UP_MS = 20 * 60_000;
/** Listening speed, kept apart from a video's (D50): a voice and a speaker don't match at 1x. */
const LISTEN_RATE = "ore.listen.rate";
/** The chapter block's prompts (D115): shown on empty lines, never saved. */
type Practice = { practice: true; heading: string; prompts: string[]; done: (text: string | null) => void };
/** `pending`: an exercise for a source being opened, started once it has loaded. */
export type PracticeRef = {
  current: ((exercise: { heading: string; prompts: string[] }, done: (text: string | null) => void) => void) | null;
  pending: { item: string; exercise: { heading: string; prompts: string[] }; done: (text: string | null) => void } | null;
};
const CHAPTER_PROMPTS = ["The claim this chapter makes", "One example or piece of evidence", "What it changes for you"];

// The highlight note's placeholder (D94, D126); never prefilled. A plain highlight's note is open: any
// thought he has while reading. A key point asks why it holds (self-explanation), a question asks for
// a guess first (prediction): those two are tested later, so their prompts pay off.
const PLACEHOLDER: Record<Intent, string> = {
  keep: "Note…",
  card: "This works because…",
  question: "My question / my guess…",
  apply: "I'll try this on…",
};

// Raw HTML never renders (skipHtml): documents come from the web and this webview can run `ore`.
// That also drops the `<!-- page N -->` / `<!-- chapter N -->` markers. Links open in the browser.
// Math is `$$…$$` only (intake writes inline TeX that way), so a price's `$` never reads as math.
const remarkPlugins = [remarkGfm, [remarkMath, { singleDollarTextMath: false }]] as NonNullable<Parameters<typeof ReactMarkdown>[0]["remarkPlugins"]>;
const rehypePlugins = [[rehypeKatex, { output: "html", throwOnError: false }]] as NonNullable<Parameters<typeof ReactMarkdown>[0]["rehypePlugins"]>;
// A click on a link is handled by the reader (`followLink`). Footnotes (`footnotes` in text.ts) keep
// their "^" in the text for the index, drawn as a small raised number.
const caret = (children: ReactNode) => (typeof children === "string" && children.startsWith("^") ? <><span className="fn-caret">^</span>{children.slice(1)}</> : children);
/** A footnote mark's note: the next one with its number after it (a book's chapters number theirs
 *  from 1 again), else the first. */
function noteFor(mark: Element): Element | undefined {
  const id = mark.getAttribute("href")?.match(/^#(fn-.+)$/)?.[1];
  if (!id) return undefined;
  const all = Array.from(mark.ownerDocument.querySelectorAll(`[id="${CSS.escape(id)}"]`));
  return all.find((n) => mark.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING) ?? all[0];
}

/** The note's text without its number, for the preview a mark shows. */
function noteText(mark: Element): string {
  const back = noteFor(mark);
  const block = back?.closest("p, li");
  if (!back || !block) return "";
  return (block.textContent ?? "").slice((back.textContent ?? "").length).replace(/^[:\s]+/, "").trim();
}

/** The tallest a hover preview gets (`.tip`, six lines), to keep it in the window. */
const TIP_HEIGHT = 140;

/** A highlight the core couldn't place: its "text not found in item <id>" gives him nothing to do. */
const placeError = (e: unknown) => {
  const why = errorText(e);
  return /text not found in item/.test(why) ? "Couldn’t highlight across that part. Try starting or ending it on a nearby word." : why;
};

const components: Components = {
  a: ({ href, children }) => {
    const fn = href?.match(/^#fn(ref)?-(.+)$/);
    if (fn) return (
      <a href={href} id={fn[1] ? `fn-${fn[2]}` : `fnref-${fn[2]}`} className={fn[1] ? "fn-back" : "fn"} draggable={false}>
        {caret(children)}
      </a>
    );
    return <a href={href} draggable={false}>{children}</a>;
  },
};

// A transcript paragraph opens with "[mm:ss]" (D49): shown in a gutter left of the text, never
// inside it, and seeks on click. It stays in the DOM, so the text index still matches the body.
const STAMP = /^\[(\d+:\d{2})\]\s*/;
const seconds = (ts: string) => ts.split(":").reduce((a, n) => a * 60 + Number(n), 0);
const stamped: Components = {
  ...components,
  p: ({ children }) => {
    const kids = Children.toArray(children);
    const head = kids[0];
    const m = typeof head === "string" ? head.match(STAMP) : null;
    if (!m) return <p>{children}</p>;
    return (
      <p className="tp">
        <span className="ts" data-t={seconds(m[1]!)} title="Play from here">
          {m[1]}
        </span>
        {(head as string).slice(m[0].length)}
        {kids.slice(1)}
      </p>
    );
  },
};

/** Images saved with the source (`assets/…`, D96) load from its folder; web images as they are. */
const withImages = (base: Components, dir: string): Components => ({
  ...base,
  img: ({ src, alt }) => {
    const s = typeof src === "string" ? src : "";
    return <img src={/^(https?:|data:)/i.test(s) ? s : convertFileSrc(`${dir}/${decodeURI(s)}`)} data-src={s} alt={alt ?? ""} loading="lazy" draggable={false} />;
  },
});

/** A figure open to fill the window (D143): its image in the text, and where it sat. */
type Zoomed = { img: HTMLImageElement; from: DOMRect };

/** The figure a click opens (D143): a loaded picture in the text, not a link (the link wins), and not already
 *  about as big as the window. */
function zoomable(t: EventTarget | null, doc: HTMLElement | null): Zoomed | null {
  const img = (t as Element | null)?.closest?.("img");
  if (!(img instanceof HTMLImageElement) || !doc?.contains(img) || img.closest("a[href]") || !img.naturalWidth) return null;
  const from = img.getBoundingClientRect();
  return Math.min((innerWidth - 48) / from.width, (innerHeight - 48) / from.height) > 1.1 ? { img, from } : null;
}

type Box = [number, number, number, number];
type FigureCard = { id: string; answer: string; box: Box };
const plainSrc = (s: string) => {
  try {
    return decodeURI(s);
  } catch {
    return s;
  }
};

/** A figure, slide or chart drawn at the column's width opens to fill the window, so labels too small to
 *  read there can be read (Medium, Readwise Reader). It grows from where it sits; a click or a scroll puts it
 *  back the same way, Esc at once (keys don't animate). While it is open no key reaches the page behind.
 *  D166: a drag over part of it draws a box, and the box with what's under it becomes a Fact card that hides
 *  that part in review (image occlusion, after Mischief's redaction, MIT); the figure's cards show as boxes. */
function FigureZoom({ fig, item, notify, onClose }: { fig: Zoomed; item: string; notify: Notify; onClose: () => void }) {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [open, setOpen] = useState(still);
  const leaving = useRef(false);
  const close = useRef(onClose);
  close.current = onClose;
  const src = fig.img.dataset.src ?? "";
  const [cards, setCards] = useState<FigureCard[]>([]);
  const [draft, setDraft] = useState<Box | null>(null);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; drew: boolean } | null>(null);
  const drew = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const back = () => {
    if (leaving.current) return;
    leaving.current = true;
    setDraft(null);
    if (still || !open) close.current(); // not grown yet: nothing to animate back
    else setOpen(false);
  };
  const backRef = useRef(back);
  backRef.current = back;
  useEffect(() => {
    if (!src || !item) return;
    let live = true;
    ore<CardFull[]>("cards", opt("item", item))
      .then((all) => live && setCards(all.filter((c) => c.figure && c.state !== "retired" && plainSrc(c.figure.src) === plainSrc(src)).map((c) => ({ id: c.id, answer: c.answer, box: c.figure!.box }))))
      .catch(() => {});
    return () => void (live = false);
  }, [src, item]);
  const save = async () => {
    const box = draftRef.current;
    if (!box || !label.trim() || busy) return;
    setBusy(true);
    try {
      const c = await ore<CardFull>("card", "figure", item, opt("src", src), opt("box", box.map((n) => n.toFixed(4)).join(",")), opt("answer", label.trim()));
      const made = { id: c.id, answer: c.answer, box: c.figure!.box };
      setCards((cs) => [...cs, made]);
      setDraft(null);
      setLabel("");
      notify(
        "Card made",
        "info",
        () => ore("card", "retire", c.id).then(() => setCards((cs) => cs.filter((x) => x.id !== c.id))),
        () => ore("card", "restore", c.id, "--state=draft").then(() => setCards((cs) => [...cs.filter((x) => x.id !== c.id), made])),
      );
    } catch (e) {
      notify(`Couldn’t make the card: ${errorText(e)}`, "error");
    } finally {
      setBusy(false);
    }
  };
  const saveRef = useRef(save);
  saveRef.current = save;
  useLayoutEffect(() => {
    fig.img.style.visibility = "hidden";
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    return () => {
      cancelAnimationFrame(id);
      fig.img.style.visibility = "";
    };
  }, [fig]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      e.stopImmediatePropagation();
      // Typing what's under a box: the field takes the keys; Enter makes the card, Esc drops the box.
      if (draftRef.current && e.target instanceof HTMLInputElement && e.target.closest(".figure-zoom")) {
        if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) e.preventDefault(), void saveRef.current();
        else if (e.key === "Escape") e.preventDefault(), setDraft(null), setLabel("");
        return;
      }
      e.preventDefault();
      if (e.key === "Escape") draftRef.current ? (setDraft(null), setLabel("")) : close.current();
    };
    const onWheel = (e: WheelEvent) => (e.preventDefault(), backRef.current());
    const onResize = () => close.current();
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
    };
  }, []);
  // Drawn at its open size, so a picture larger than the column comes in sharp, and shrunk back onto its place.
  const { from } = fig;
  const scale = Math.min((innerWidth - 48) / from.width, (innerHeight - 48) / from.height);
  const w = from.width * scale;
  const h = from.height * scale;
  const left = (innerWidth - w) / 2;
  const top = (innerHeight - h) / 2;
  const stop = (e: MouseEvent) => e.stopPropagation();
  const at = (e: { clientX: number; clientY: number }) => ({ x: Math.min(1, Math.max(0, (e.clientX - left) / w)), y: Math.min(1, Math.max(0, (e.clientY - top) / h)) });
  const place = (b: Box) => ({ left: left + b[0] * w, top: top + b[1] * h, width: b[2] * w, height: b[3] * h });
  const shown = open && !leaving.current && !!src && !!item;
  const below = draft && top + (draft[1] + draft[3]) * h + 44 < innerHeight;
  return createPortal(
    <div
      className={`figure-zoom${open ? " open" : ""}`}
      onClick={(e) => {
        stop(e);
        if (drew.current) return void (drew.current = false);
        if (draftRef.current) return setDraft(null), setLabel("");
        back();
      }}
      onMouseDown={stop}
      onMouseUp={stop}
      onMouseMove={stop}
    >
      <img
        src={fig.img.currentSrc || fig.img.src}
        alt={fig.img.alt}
        draggable={false}
        className={shown ? "drawable" : undefined}
        style={{ left, top, width: w, height: h, transform: open ? "none" : `translate(${from.left - left}px, ${from.top - top}px) scale(${1 / scale})` }}
        onTransitionEnd={(e) => e.propertyName === "transform" && leaving.current && close.current()}
        onPointerDown={(e) => {
          if (!shown || e.button !== 0 || draftRef.current) return;
          const p = at(e);
          drag.current = { ...p, drew: false };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const p = at(e);
          if (!d.drew && Math.hypot((p.x - d.x) * w, (p.y - d.y) * h) < 5) return;
          if (!d.drew) setDragging(true);
          d.drew = true;
          setDraft([Math.min(d.x, p.x), Math.min(d.y, p.y), Math.abs(p.x - d.x), Math.abs(p.y - d.y)]);
        }}
        onPointerUp={() => {
          const d = drag.current;
          drag.current = null;
          if (!d?.drew) return;
          drew.current = true;
          setDragging(false);
          const b = draftRef.current;
          if (b && (b[2] * w < 6 || b[3] * h < 6)) setDraft(null); // a slip, not a box
        }}
      />
      {shown && cards.map((c) => <div key={c.id} className="figure-box saved" style={place(c.box)} aria-label={`Card: ${c.answer}`} role="img" />)}
      {shown && draft && <div className="figure-box draft" style={place(draft)} />}
      {shown && draft && !dragging && (
        <div className="popover figure-label" style={{ left: left + (draft[0] + draft[2] / 2) * w, top: below ? top + (draft[1] + draft[3]) * h + 8 : top + draft[1] * h - 8, translate: below ? "-50% 0" : "-50% -100%" }} onClick={stop}>
          <input className="field" autoFocus aria-label="What’s under the box" placeholder="What’s under it?" value={label} disabled={busy} onChange={(e) => setLabel(e.target.value)} />
        </div>
      )}
      {shown && !draft && <div className="figure-tip">Drag over a part to make a card of it</div>}
    </div>,
    document.body,
  );
}

const Chunk = memo(function Chunk({ md, video, dir }: { md: string; video: boolean; dir: string }) {
  const parts = useMemo(() => withImages(video ? stamped : components, dir), [video, dir]);
  return (
    <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={parts} skipHtml>
      {footnotes(md)}
    </ReactMarkdown>
  );
});

/** Where a page-with-video's transcript ends and the page's text starts (D92, `VIDEO_END` in core). */
const VIDEO_END = "<!-- end of video transcript -->";

/** A page with its video (D92): the player and its following transcript in one card where the video
 *  sits on the page. `head` is the card's bar and player, outside the text index; `box` holds the
 *  transcript, folded away when `transcript` is off; `open` off folds the whole card to its bar. */
type VideoCard = { head: ReactNode; foot?: ReactNode; box: RefObject<HTMLDivElement | null>; open: boolean; transcript: boolean };

/** The document body, rendered in slices so a 100k-word book stays responsive while it mounts. With a
 *  video card, the transcript before VIDEO_END goes in the card and the page's text follows it. */
const Body = memo(function Body({ markdown, video, dir, onReady, card }: { markdown: string; video: boolean; dir: string; onReady: (el: HTMLElement) => void; card?: VideoCard }) {
  const split = card ? markdown.indexOf(VIDEO_END) : -1;
  const top = useMemo(() => (split > 0 ? chunks(markdown.slice(0, split)) : []), [markdown, split]);
  const rest = useMemo(() => chunks(split > 0 ? markdown.slice(split) : markdown), [markdown, split]);
  const total = top.length + rest.length;
  const [shown, setShown] = useState(() => Math.min(total, 2));
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (shown < total) {
      const t = setTimeout(() => startTransition(() => setShown((n) => Math.min(total, n * 2))), 0);
      return () => clearTimeout(t);
    }
    if (ref.current) onReady(ref.current);
  }, [shown, total, onReady]);
  return (
    <article className="doc" ref={ref}>
      {card && split > 0 && (
        <section className={`video-card${card.open ? "" : " closed"}`}>
          {card.head}
          <div className="vc-transcript" ref={card.box} hidden={!card.open || !card.transcript}>
            {top.slice(0, shown).map((md, i) => (
              <Chunk key={i} md={md} video={video} dir={dir} />
            ))}
          </div>
          {card.foot}
        </section>
      )}
      {rest.slice(0, Math.max(0, shown - top.length)).map((md, i) => (
        <Chunk key={`r${i}`} md={md} video={video} dir={dir} />
      ))}
    </article>
  );
});

type Popup = { id: string; top: number; left: number; below: boolean; note: string };
/** Where a highlight's passage sits: in the body (to save) and on the page (to paint). */
type Span = { exact: string; start: number; range: Range };

/** One range from the first start to the last end of two. */
function union(a: Range, b: Range): Range {
  const r = a.cloneRange();
  if (b.compareBoundaryPoints(Range.START_TO_START, a) < 0) r.setStart(b.startContainer, b.startOffset);
  if (b.compareBoundaryPoints(Range.END_TO_END, a) > 0) r.setEnd(b.endContainer, b.endOffset);
  return r;
}
/** Look Up (D83): the word, the highlight it came from if he keeps that one, and the dictionary's
 *  entry (undefined while it loads, null when there is none). */
type LookUp = { word: string; range: Range; ann: string | null; top: number; left: number; below: boolean; text?: string | null; start?: number; again: { sections: string[]; later: boolean } };

type Props = {
  id: string;
  /** Just added with no skill (D109): the skill picker opens with the source. */
  pickSkill?: boolean;
  onPicked?: () => void;
  skills: Skill[];
  finishing: boolean;
  setFinishing: (on: boolean) => void;
  /** The side panel is open (D44), on `sideTab` (D75). */
  notesOpen: boolean;
  sideTab: SideTab;
  /** Opens the side panel on a tab, or closes it when it already shows that tab (`stay` keeps it open). */
  onShowSide: (tab: SideTab, stay?: boolean) => void;
  onCloseSide: () => void;
  /** Shows or hides the side panel on the tab it last showed. */
  onToggleSide: () => void;
  /** Bumped by the ⌘K "Rename source" command to edit the title in place. */
  renameSource: number;
  /** The open source's actions, read by ⌘K so it lists the same ones as the ⋯ menu. */
  actionsRef: { current: MenuAction[] };
  /** Set by the reader: opens the tutor's exercise in the source note (D128.6); `done` gets what he
   *  wrote under its heading when he sends it (⌘↵), or null when he leaves with Esc. */
  practiceRef?: PracticeRef;
  onArchive: (item: Item) => void;
  /** The course this source is a lesson of, its lessons in order (D79), and opening one of them. */
  lessons?: Item[];
  onOpenLesson: (id: string) => void;
  onPin: (item: Item) => void;
  onMove: (item: Item, to: Item["status"]) => void;
  /** A highlight to scroll to once the text is ready (a question on the skill page, D47), or
   *  `q:start:end`, a quote a card points to (D99), or a ⌘K match: `find:<words>` in the text (the find
   *  bar opens on those words at their first place), `note:<words>` in the source note (the note opens,
   *  the find bar on its words), `ann:<id>` a highlight (scrolled to, its popup open). */
  jumpTo?: string;
  /** Learn this (D97): add the picked sources for his question; `now` opens the first, with a way back here. */
  onLearnAdd?: (urls: string[], skills: string[], question: string, now: boolean, from: { id: string; title: string }) => void;
  /** Opened from Learn this's Read now: the pill back to the passage he left. */
  back?: { title: string; go: () => void };
  blocked: boolean;
  /** For `[[` links in the source note, and opening one (D39). */
  targets: LinkTarget[];
  onOpenLink: (t: Omit<LinkTarget, "title">) => void;
  onBack: () => void;
  onChanged: () => void;
  onSkillsChanged: () => void;
  /** Archives again the skills a filing brought back (D173), when that filing is undone. */
  rearchive?: (skills: string[]) => Promise<unknown>;
  onDone: () => void;
  notify: Notify;
};

/** A reimport (or its undo) replaces the text under every highlight range and mark, so the reader
 *  starts over on the new text rather than patching what it drew. */
export function Reader(p: Props) {
  const [version, setVersion] = useState(0);
  return <ReaderView key={version} {...p} reload={() => setVersion((v) => v + 1)} />;
}

function ReaderView(p: Props & { reload: () => void }) {
  const [doc, setDoc] = useState<Doc | null>(null);
  /** In a course (D79), the first lesson after this one not done yet: the closing card offers it. */
  const nextUp = p.lessons?.slice(p.lessons.findIndex((l) => l.id === p.id) + 1).find((l) => l.status !== "done");
  const [error, setError] = useState<string | null>(null);
  const [anns, setAnns] = useState<Annotation[]>([]);
  const [ready, setReady] = useState(false);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [zoom, setZoom] = useState<Zoomed | null>(null);
  const zoomed = useRef(false);
  zoomed.current = !!zoom;
  // The popup as it is now, for its note to be written when he leaves the source with it open.
  const popupNow = useRef(popup);
  popupNow.current = popup;
  /** An edge of the open highlight being dragged: the popup hides meanwhile. */
  const [dragging, setDragging] = useState(false);
  /** Bumped when a highlight's range changes in place (an edge dragged), so the paint below reruns. */
  const [repaint, setRepaint] = useState(0);
  /** "Card here" open in the Collected tab: a line he is typing, anchored where he is. */
  const [adding, setAdding] = useState<string | null>(null);
  /** Where Card here was opened: the source offset his line is anchored at. */
  const hereAt = useRef<number | null>(null);
  /** He asked for the key point field (+, Card here, a failed save): it takes focus once, not on every remount. */
  const focusAdd = useRef(false);
  const [addAsk, setAddAsk] = useState(0);
  const [ask, setAsk] = useState(0);
  const [renaming, setRenaming] = useState(false);
  const [authoring, setAuthoring] = useState(false);
  const authorRef = useRef<HTMLButtonElement>(null);
  const askedRename = useRef(p.renameSource);
  useEffect(() => {
    if (p.renameSource !== askedRename.current) setRenaming(true);
    askedRename.current = p.renameSource;
  }, [p.renameSource]);
  const keys = useKeymap();
  const [tip, setTip] = useState<{ id: string; x: number; y: number; text: string } | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [retrying, setRetrying] = useState(false);
  /** The block live in the source note: a chapter's recall (D115) or the tutor's exercise (D128.6). */
  const [block, setBlock] = useState<ChapterEnd | Practice | null>(null);
  const scaffolded = useRef<ChapterEnd | Practice | null>(null);
  /** The eye (⌥H): the source hidden while he writes, remembered. A chapter block turns it on and puts it back after. */
  const [hideSource, setHideSource] = useState(() => load("ore.hidesource") === "1");
  const hideBefore = useRef<boolean | null>(null);
  const [chapterFb, setChapterFb] = useState<{ n: number; title: string; feedback?: ChapterFeedback; error?: string } | null>(null);
  const margin = useRef<MarginHandle | null>(null);
  const notesField = useRef<NoteEditorHandle>(null);
  const sideBody = useRef<HTMLDivElement>(null);
  const notes = useSourceNote(p.id, p.notify);
  // D34.4: the finish step hides the text, highlights, notes and the source note.
  const closedBook = p.finishing;
  // The quiz panel blurs the source until an attempt is checked, then steps through passages (D52, D55).
  const [reveal, setReveal] = useState<Reveal>(null);
  const hidden = (closedBook && !reveal) || hideSource;
  const scrollRef = useRef<HTMLDivElement>(null);
  useFocusBack(authoring, authorRef, scrollRef);
  const readerRef = useRef<HTMLDivElement>(null);
  /** ⌘F: open with the bump that refocuses it; the query stays for the next ⌘F, as in Safari. `note`:
   *  opened by ⌘K on a match in the source note, so it searches only there. */
  const [find, setFind] = useState<{ open: boolean; focus: number; query: string; note?: boolean }>({ open: false, focus: 0, query: "" });
  const [barsHidden, setBarsHidden] = useState(false);
  const lastTop = useRef(0);
  const lastTouch = useRef(0);
  // The Finish step has its own screen: the bars are back for it.
  useEffect(() => void (closedBook && setBarsHidden(false)), [closedBook]);
  // The toolbar sits at the reader's top right. With the sidebar hidden a narrow reader would push it over
  // the sidebar toggle and Back, which are fixed at the window's left: Collected gives way instead, a
  // chip per type, then one chip for all, then none (the side panel's Collected tab lists them all).
  const [tools, setTools] = useState<HTMLDivElement | null>(null);
  const [fit, setFit] = useState<Fit>("all");
  // Which types have chips, and how wide each count is: a change measures the chips again from the top.
  const chipSet = INTENTS.map((i) => {
    const n = anns.filter((a) => a.intent === i && visible(a)).length;
    return n ? String(n).length : 0;
  }).join();
  useLayoutEffect(() => {
    const pane = tools?.offsetParent;
    if (PHONE || !tools || !pane) return;
    let now: Fit = "all";
    setFit(now);
    const widths = { all: 0, one: 0 };
    const measure = () => {
      const box = tools.getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(tools).columnGap) || 0;
      const chips = tools.querySelector(".collected")?.getBoundingClientRect().width;
      if (chips !== undefined && now !== "none") widths[now] = chips + gap;
      const rest = box.width - (chips === undefined ? 0 : chips + gap);
      const left = Math.max(pane.getBoundingClientRect().left, document.querySelector(".nav-arrows")?.getBoundingClientRect().right ?? 0) + 8;
      const room = box.right - left - rest;
      // A width not measured yet (0) is tried, then measured.
      now = widths.all <= room ? "all" : widths.one <= room ? "one" : "none";
      // Before the frame paints, so a toolbar too wide for its room never shows for a frame.
      flushSync(() => setFit(now));
    };
    const ro = new ResizeObserver(measure);
    ro.observe(tools);
    ro.observe(pane);
    return () => ro.disconnect();
  }, [tools, chipSet]);
  // The reading focus (Readwise Reader): blocks from `anchor` to `head`, moved with ↑ ↓ and widened with ⇧.
  const [focus, setFocus] = useState<{ anchor: HTMLElement; head: HTMLElement } | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [painted, setPainted] = useState<{ a: Annotation; r: Range }[]>([]);
  const [evidence, setEvidence] = useState<(Range | null)[]>([]);
  const popupRef = useRef<HTMLDivElement>(null);
  const [lookup, setLookup] = useState<LookUp | null>(null);
  const lookupRef = useRef<HTMLDivElement>(null);
  /** Where the pointer last was over the text: ⌃⌘D with nothing selected looks up the word there. */
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const idx = useRef<TextIndex | null>(null);
  const docEl = useRef<HTMLElement | null>(null);
  const ranges = useRef(new Map<string, Range>());
  const pending = useRef(new Map<string, Promise<Annotation>>());
  const annsRef = useRef(anns);
  annsRef.current = anns;
  const frame = useRef(0);
  const jumped = useRef(false);
  const scrollTimer = useRef(0);
  const body = doc?.body;
  const src = useMemo(() => (body === undefined ? null : sourceSkeleton(body)), [body]);
  // The header already shows the title; drop a leading "# <title>" line from the rendered body. The
  // title it loaded with, so a rename does not re-render the text and strand its highlights.
  const loadedTitle = useRef("");
  if (doc && !loadedTitle.current) loadedTitle.current = doc.title;
  const shownBody = useMemo(() => {
    const m = body?.match(/^\s*#[ \t]+(.+)\n/);
    return body !== undefined && m && m[1]!.trim() === loadedTitle.current.trim() ? body.slice(m[0].length) : body;
  }, [body]);
  const scrollKey = `ore.scroll.${p.id}`;

  // Video sources (D48 to D50): the player, transcript words located in the rendered text, and
  // following. `following` is a ref so scroll handlers see it at once; `away` drives the pill.
  // A kept recording (D167) plays as a video does, on its own audio: the same following, stamps and keys.
  const audio = doc?.transcript ? null : (doc?.audio ?? null);
  const video = useMemo(() => doc?.transcript ?? (audio ? { video: "", words: audio.words } : null), [doc?.transcript, audio]);
  const youtube = useYouTube(doc?.transcript?.video, p.id);
  const recording = useAudio(audio?.file, p.id);
  const player = audio ? recording : youtube;
  // A page with its video (D92): the player and its transcript sit in a card at the top of the text,
  // not pinned, and the transcript follows the speaker inside the card. Folding is kept per source.
  const cardMode = !!video && !!doc?.video && !!shownBody?.includes(VIDEO_END);
  const boxRef = useRef<HTMLDivElement>(null);
  const [vc, setVc] = useState({ open: true, transcript: true });
  useEffect(() => {
    let saved: { open?: unknown; transcript?: unknown } | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(`ore.videoCard.${p.id}`) ?? "null");
    } catch {}
    setVc({ open: saved?.open !== false, transcript: saved?.transcript !== false });
  }, [p.id]);
  /** The transcript box while it shows: the part of the card that follows the speaker. */
  const followBox = () => (cardMode && boxRef.current && !boxRef.current.hidden ? boxRef.current : null);
  const playerRef = useRef<HTMLDivElement>(null);
  const following = useRef(true);
  const [away, setAway] = useState<"up" | "down" | null>(null);
  const spoken = useRef<Range | null>(null);
  const currentWord = useRef(-2);
  const fresh = useRef<string | null>(null);
  const words = useMemo(() => (ready && idx.current && video?.words.length ? alignWords(idx.current, video.words) : null), [ready, video]);
  /** In a video, when a highlight is spoken: the right edge of its row in the Collected tab. */
  const timeOf = words
    ? (a: Annotation) => {
        const r = ranges.current.get(a.id);
        const i = r && idx.current ? wordAtOffset(words, skeletonOffset(idx.current, r.startContainer, r.startOffset)) : -1;
        return i >= 0 ? clock(words.time[i]!) : null;
      }
    : undefined;

  /** Where each highlight is spoken, in seconds: ticks on the scrubber (D167). */
  const ticks = useMemo(() => {
    const index = idx.current;
    if (!words || !index) return [];
    return painted.flatMap(({ r }) => {
      const i = wordAtOffset(words, skeletonOffset(index, r.startContainer, r.startOffset));
      return i >= 0 ? [words.time[i]!] : [];
    });
  }, [words, painted]);

  /** The part of the scroll pane not covered by the pinned player. */
  const band = () => {
    const box = scrollRef.current!.getBoundingClientRect();
    return { top: Math.max(box.top, playerRef.current?.getBoundingClientRect().bottom ?? box.top), bottom: box.bottom };
  };
  /** Where the spoken word is kept: the card's transcript box, else the pane below the pinned player. */
  const followBand = () => {
    const r = followBox()?.getBoundingClientRect();
    return r ? { top: r.top, bottom: r.bottom } : band();
  };
  /** Scrolls a passage a third of the way down the text he can see, below a pinned player (D55).
   *  In a video it stops following the speaker, or the next frame would scroll back to the spoken word. */
  const toThird = (r: Range, behavior: ScrollBehavior = "auto") => {
    const el = scrollRef.current;
    if (!el) return;
    if (words) following.current = false;
    const b = band();
    // A passage in the card's transcript: the box scrolls to it, and the page to the box.
    const fb = followBox();
    let at = r.getBoundingClientRect().top;
    if (fb?.contains(r.startContainer)) {
      const box = fb.getBoundingClientRect();
      fb.scrollTo({ top: fb.scrollTop + at - box.top - fb.clientHeight / 3, behavior });
      at = box.top;
    }
    el.scrollTo({ top: el.scrollTop + at - (b.top + (b.bottom - b.top) / 3), behavior });
    if (words) requestAnimationFrame(updateAway);
  };
  const wordRect = (i: number) => (words && idx.current ? skeletonRange(idx.current, words.pos[i]!, words.end[i]!).getBoundingClientRect() : null);
  // Listen (D85): the source read aloud a sentence at a time, the page following like a video's.
  const [listen, setListen] = useState<{ playing: boolean; rate: number } | null>(null);
  const speaker = useRef<Speaker | null>(null);
  const sentence = useRef<Range | null>(null);
  const currentRect = () => (words ? wordRect(Math.max(0, currentWord.current)) : (sentence.current?.getBoundingClientRect() ?? null));
  const updateAway = () => {
    const r = currentRect();
    if (!r || following.current) return setAway(null);
    const b = followBand();
    setAway(r.bottom < b.top ? "up" : r.top > b.bottom ? "down" : null);
  };
  /** Paints the spoken text and, while following, keeps the current line a third of the way down. */
  const sync = (force = false) => {
    const index = idx.current;
    if (!words || !index || !words.pos.length) return;
    const i = wordAtTime(words, player.time());
    const first = currentWord.current === -2;
    const changed = i !== currentWord.current;
    if (changed) {
      currentWord.current = i;
      if (i < 0) CSS.highlights.delete("hl-spoken");
      else {
        // A new range each time: WebKit repaints only the new extent when one is moved in place,
        // so text behind a rewind stayed lit until something else repainted it.
        spoken.current = skeletonRange(index, words.pos[0]!, words.end[i]!);
        CSS.highlights.set("hl-spoken", new Highlight(spoken.current));
      }
    }
    // A folded transcript keeps its place; the card's box scrolls, not the page.
    const el = cardMode ? followBox() : scrollRef.current;
    if (!el) return;
    if (!following.current) return updateAway();
    if (!changed && !force) return;
    const r = wordRect(Math.max(0, i))!;
    const b = followBand();
    const target = b.top + (b.bottom - b.top) / 3;
    if (force || Math.abs(r.top - target) > r.height / 2) el.scrollTo({ top: el.scrollTop + r.top - target, behavior: first ? "auto" : "smooth" });
    setAway(null);
  };
  /** While following, keeps the spoken sentence in view, a third of the way down when it moves. */
  const showSentence = (force = false) => {
    const el = scrollRef.current;
    const r = sentence.current?.getBoundingClientRect();
    if (!el || !r) return;
    if (!following.current) return updateAway();
    const b = band();
    if (force || r.top < b.top || r.bottom > b.bottom - 40) el.scrollTo({ top: el.scrollTop + r.top - (b.top + (b.bottom - b.top) / 3), behavior: "smooth" });
    setAway(null);
  };
  const follow = () => {
    following.current = true;
    setAway(null);
    requestAnimationFrame(() => (words ? sync(true) : showSentence(true)));
  };
  const seekTo = (t: number, play = false) => {
    player.seek(t);
    if (play) player.play();
    follow();
  };

  // Every frame while playing; once per change (a seek, a resume) while paused.
  useEffect(() => {
    if (!words || !player.started) return;
    if (!player.playing) return void sync();
    let raf = 0;
    const tick = () => {
      sync();
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [words, player.started, player.playing, player.elapsed]);

  // Any scroll he makes turns following off (D49); scrolls made by sync() never pass through here.
  useEffect(() => {
    // With a video card only scrolling its transcript stops following: the page below is his to read.
    const el = cardMode && !listen ? boxRef.current : scrollRef.current;
    if (!el || (!words && !listen)) return;
    const off = () => {
      following.current = false;
    };
    const onWheel = (e: WheelEvent) => e.deltaY && off();
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName !== "INPUT" && t.tagName !== "TEXTAREA" && ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(e.key)) off();
    };
    const onDown = (e: globalThis.MouseEvent) => e.target === el && e.offsetX >= el.clientWidth && off();
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("keydown", onKey);
    el.addEventListener("mousedown", onDown);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("mousedown", onDown);
    };
  }, [words, !!listen, cardMode, vc.open, vc.transcript]);

  // The finish step and the eye hide the video too (D34.4); stop the sound with it.
  useEffect(() => {
    if (hidden && player.playing) player.toggle();
    if (hidden) stopListening();
  }, [hidden]);

  function startListening() {
    const el = docEl.current;
    if (!speechAvailable()) return p.notify("This Mac can’t read aloud here. Check Spoken Content in System Settings › Accessibility, then try again.", "error");
    const list = el ? sentences(el) : [];
    if (!list.length) return p.notify("There’s no text in this source to read aloud.", "error");
    const rate = Math.min(MAX_RATE, Math.max(MIN_RATE, Number(load(LISTEN_RATE)) || 1));
    speaker.current?.pause();
    speaker.current = new Speaker(list, rate, {
      sentence: (i) => {
        sentence.current = list[i]!;
        CSS.highlights.set("hl-listen", new Highlight(list[i]!));
        showSentence();
      },
      end: stopListening,
      error: (why) => {
        stopListening();
        p.notify(`Reading aloud stopped: ${speechTrouble(why)}. Press ${label(keys.listen)} to start again from here.`, "error");
      },
    });
    following.current = true;
    setListen({ playing: true, rate });
    // From the first sentence in view: scrolling while it was stopped is how he picks the place.
    speaker.current.play(firstFrom(list, band().top));
  }
  /** Stops and keeps the place: the page is where the voice was, and that is saved as he left it. */
  function stopListening() {
    speaker.current?.pause();
    speaker.current = null;
    sentence.current = null;
    CSS.highlights.delete("hl-listen");
    setListen(null);
    setAway(null);
  }
  const togglePause = () => {
    if (!listen || !speaker.current) return;
    if (listen.playing) speaker.current.pause();
    else speaker.current.play();
    setListen({ ...listen, playing: !listen.playing });
  };
  const setListenRate = (r: number) => {
    if (!listen || !speaker.current) return;
    const rate = Math.min(MAX_RATE, Math.max(MIN_RATE, Math.round(r * 20) / 20));
    save(LISTEN_RATE, String(rate));
    speaker.current.setRate(rate, listen.playing);
    setListen({ ...listen, rate });
  };
  // Leaving the source, or opening another, stops the voice.
  useEffect(() => () => stopListening(), [p.id]);

  // Read again when a ⌘Z lands. `opened` keeps that from counting as opening it again, and a text that
  // changed (a cut or a reimport undone) starts the reader over, since every highlight is placed on the text.
  const changes = useLibraryChanges();
  const opened = useRef<string | null>(null);
  const shownBodyOf = useRef<string | null>(null);
  useEffect(() => {
    let live = true;
    ore<Doc>("show", p.id, "--annotations").then(
      (d) => {
        if (!live) return;
        if (opened.current === p.id && shownBodyOf.current !== null && shownBodyOf.current !== d.body) return p.reload();
        shownBodyOf.current = d.body;
        setDoc(d);
        // Enrich runs once, right after `ore add`: long after that with nothing to show, it failed.
        if (!d.enriched_at && !d.prequestions?.length && (d.enrich_error || d.enrich_skipped || Date.now() - Date.parse(d.captured_at) > ENRICH_GIVE_UP_MS)) setGaveUp(true);
        setAnns((d.annotations ?? []).filter(visible));
        // Opening starts it and moves it up To read (D110); a preview isn't listed, so it's left alone.
        if (!d.preview && opened.current !== p.id) ore("opened", p.id).then(p.onChanged, (e) => p.notify(errorText(e), "error"));
        opened.current = p.id;
      },
      (e) => live && setError(errorText(e)),
    );
    return () => {
      live = false;
    };
  }, [p.id, changes]);

  // Enrichment runs in the background after `ore add`; poll for prequestions for up to ~3 minutes
  // (`ore ls` carries the frontmatter without the body, which can be megabytes for a book).
  // A Feed post being read is not enriched until he keeps it.
  const waiting = !!doc && !doc.preview && !doc.enriched_at && !doc.prequestions?.length && !gaveUp;
  /** His first highlight kept a Feed post: it is a source now, and its prequestions are on the way. */
  const keptFromFeed = (ann: Annotation) => {
    if (!ann.kept_from_feed) return;
    setDoc((cur) => cur && { ...cur, preview: undefined, captured_at: new Date().toISOString() });
    p.onChanged();
  };
  useEffect(() => {
    if (!waiting) return;
    let n = 0;
    const t = setInterval(() => {
      if (++n > 45) return setGaveUp(true);
      ore<Item[]>("ls").then(
        (all) => {
          const d = all.find((i) => i.id === p.id);
          if (d && (d.enriched_at || d.prequestions?.length))
            setDoc((cur) => cur && { ...cur, prequestions: d.prequestions, skills: d.skills, suggested_skill: d.suggested_skill, enriched_at: d.enriched_at });
          else if (d?.enrich_error) {
            // The background run died: say why now, not after the wait runs out.
            setDoc((cur) => cur && { ...cur, enrich_error: d.enrich_error });
            setGaveUp(true);
          }
        },
        () => {},
      );
    }, 4000);
    return () => clearInterval(t);
  }, [waiting, p.id]);

  /** Runs enrich again in the foreground, so a failure shows its reason. */
  /** The PDF's tables and formulas were read into its text: show it, with the way back. */
  const tablesRead = (r: { changed: boolean; regions: number }) => {
    const id = p.id;
    p.reload();
    p.onChanged();
    if (!r.changed) return p.notify("Found no tables or formulas to read in this PDF");
    const step = () => ore("reimport", id, "--undo").then(() => (p.reload(), p.onChanged()));
    p.notify("Read the tables and formulas into the text", "info", step, step);
  };

  const retryEnrich = async () => {
    setRetrying(true);
    try {
      await ore("enrich", p.id);
      const d = (await ore<Item[]>("ls")).find((i) => i.id === p.id);
      if (d) setDoc((cur) => cur && { ...cur, prequestions: d.prequestions, skills: d.skills, suggested_skill: d.suggested_skill, enriched_at: d.enriched_at, enrich_error: undefined, enrich_skipped: undefined });
      p.onChanged();
    } catch (e) {
      setDoc((cur) => cur && { ...cur, enrich_error: errorText(e) });
    } finally {
      setRetrying(false);
    }
  };

  const onReady = useCallback((el: HTMLElement) => {
    docEl.current = el;
    idx.current = indexText(el);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (p.jumpTo?.startsWith("find:")) setFind((f) => ({ open: true, focus: f.focus + 1, query: p.jumpTo!.slice(5) }));
    else if (p.jumpTo?.startsWith("note:")) {
      const query = p.jumpTo.slice(5);
      p.onShowSide("note", true);
      return onceFound(() => readerRef.current?.querySelector<HTMLElement>(".mynotes-text"), query, () => setFind((f) => ({ open: true, focus: f.focus + 1, query, note: true })));
    }
  }, [ready, p.jumpTo]);

  useLayoutEffect(() => {
    if (!ready || !scrollRef.current) return;
    const y = Number(load(scrollKey) ?? 0);
    if (y > 0 && !p.jumpTo) scrollRef.current.scrollTop = y;
    scrollRef.current.focus({ preventScroll: true });
  }, [ready, scrollKey]);

  // Paint highlights with the CSS Custom Highlight API; the Markdown DOM is never mutated.
  useEffect(() => {
    const index = idx.current;
    if (!ready || !index || body === undefined || !src) return;
    const map = ranges.current;
    for (const a of anns) {
      if (map.has(a.id)) continue;
      const r = rangeFor(index, src, body, { ...a, start: a.anchor?.start ?? a.start });
      if (r) map.set(a.id, r);
    }
    const by: Record<Intent, Range[]> = { keep: [], card: [], question: [], apply: [] };
    const painted: { a: Annotation; r: Range }[] = [];
    for (const a of anns) {
      const r = map.get(a.id);
      if (r) {
        // A card typed with nothing selected only marks where he was: a margin icon, no tint.
        if (!a.point) by[a.intent].push(r);
        painted.push({ a, r });
      }
    }
    // The same list kept as is (a popup opening reruns this): the margin marks then don't redraw.
    const next = hidden ? [] : painted;
    setPainted((cur) => (cur.length === next.length && cur.every((x, i) => x.a === next[i]!.a && x.r === next[i]!.r) ? cur : next));
    // Hidden behind the quiz, highlight colors would show where the answers are (D52).
    for (const i of INTENTS) {
      const h = new Highlight(...(hidden ? [] : by[i]));
      h.priority = 1; // above hl-spoken, so a highlight in a playing transcript keeps its own text colour
      CSS.highlights.set(`hl-${i}`, h);
    }
    const active = popup && map.get(popup.id);
    if (active) CSS.highlights.set("hl-active", new Highlight(active));
    else CSS.highlights.delete("hl-active");
    // `q:start:end` is a quote a card points to (D99), not a highlight.
    const q = p.jumpTo?.match(/^q:(\d+):(\d+)$/);
    const jump = jumped.current ? undefined : q ? rangeFor(index, src, body, { exact: body.slice(+q[1]!, +q[2]!), prefix: "", suffix: "", start: +q[1]! }) : p.jumpTo && map.get(p.jumpTo);
    const el = scrollRef.current;
    if (jump && el) {
      jumped.current = true;
      toThird(jump);
      CSS.highlights.set("hl-active", new Highlight(jump));
    }
  }, [ready, anns, body, popup?.id, hidden, repaint]);
  useEffect(() => () => CSS.highlights.clear(), []);
  // A ⌘K match in a highlight or its note: land on it with its popup open, once its range is painted.
  const landed = useRef<string | undefined>(undefined);
  useEffect(() => {
    const at = p.jumpTo;
    if (!at?.startsWith("ann:") || landed.current === at || !ranges.current.has(at.slice(4))) return;
    landed.current = at;
    jumpToHighlight(at.slice(4));
  }, [painted, p.jumpTo]);

  // A new text size or width reflows the page: keep the passage at the top where it was (Books).
  useEffect(() => keepPlace(() => (scrollRef.current && docEl.current ? placeOf(scrollRef.current, docEl.current) : () => {})), []);
  // So does a narrower pane (window resize, side panel opened or dragged): the place is taken on
  // each scroll and put back after each resize.
  useEffect(() => {
    const scroll = scrollRef.current;
    if (!ready || !scroll) return;
    let back = () => {};
    const take = () => {
      if (docEl.current) back = placeOf(scroll, docEl.current);
    };
    take();
    const ro = new ResizeObserver(() => {
      back();
      take();
    });
    ro.observe(scroll);
    scroll.addEventListener("scroll", take, { passive: true });
    return () => {
      ro.disconnect();
      scroll.removeEventListener("scroll", take);
    };
  }, [ready]);

  // Supporting passages after a quiz answer: all lightly tinted, the current one strong and
  // scrolled a third of the way down, like find on a page (D55).
  useEffect(() => {
    const index = idx.current;
    const el = scrollRef.current;
    CSS.highlights.delete("hl-evidence");
    CSS.highlights.delete("hl-evidence-on");
    setEvidence([]);
    if (!reveal || !ready || !index || !el || body === undefined || !src) return;
    const rs = reveal.quotes.map((q) => rangeFor(index, src, body, q));
    setEvidence(rs);
    const cur = rs[reveal.at];
    CSS.highlights.set("hl-evidence", new Highlight(...rs.filter((r, i): r is Range => !!r && i !== reveal.at)));
    if (cur) {
      CSS.highlights.set("hl-evidence-on", new Highlight(cur));
      toThird(cur, "smooth");
    }
  }, [reveal, ready, body]);

  // Icons in the left margin (Marks): a star on each key point and a ? on each question (a plain highlight's
  // tint says enough, D118), and one per "In the source" passage while a quiz answer is open, so the
  // passing orange tint is not mistaken for a highlight.
  const marks = useMemo<Mark[]>(() => {
    const hl = painted.filter(({ a }) => a.intent !== "keep").map(({ a, r }) => ({
      key: a.id,
      kind: a.intent,
      range: r,
      open: () => {
        fresh.current = null;
        openPopup(a.id, r, annsRef.current.find((x) => x.id === a.id)?.note ?? "");
      },
    }));
    const ev = evidence.flatMap((r, i) => (r ? [{ key: `ev${i}`, kind: "evidence" as const, range: r, open: () => setReveal((v) => v && { ...v, at: i }) }] : []));
    return [...hl, ...ev];
  }, [painted, evidence]);

  const spots = useMemo(() => {
    const el = docEl.current;
    const index = idx.current;
    if (!ready || !el || !index || !src || body === undefined) return null;
    return findChapterEnds(body, src, index, el, doc?.type);
  }, [ready, src, body, doc?.type]);
  const recalled = useMemo(() => new Set((doc?.chapter_recalls ?? []).map((c) => c.n)), [doc?.chapter_recalls]);

  // Opening the source note puts the caret in it; closing writes what is pending.
  const notesShown = p.notesOpen && !closedBook && p.sideTab === "note";
  const questionsShown = p.notesOpen && !closedBook && p.sideTab === "questions";
  const panelShown = notesShown || questionsShown;

  /** The chapter block (D115): the sign opens the source note with the chapter's title and three
   *  prompts, the source hidden (D34.4) until he ends it with ⌘↵ (recorded, then feedback) or Esc
   *  (what he typed stays, nothing is recorded). */
  const openChapter = (c: ChapterEnd) => {
    keepNote();
    setPopup(null);
    setChapterFb(null);
    if (hideBefore.current === null) hideBefore.current = hideSource;
    setHideSource(true);
    setBlock(c);
    p.onShowSide("note", true);
  };
  /** The tutor's exercise (D128.6) opens the same way, under its own heading and prompts. */
  const openPractice = (exercise: { heading: string; prompts: string[] }, done: (text: string | null) => void) => {
    keepNote();
    setPopup(null);
    setChapterFb(null);
    if (hideBefore.current === null) hideBefore.current = hideSource;
    setHideSource(true);
    setBlock({ practice: true, ...exercise, done });
    p.onShowSide("note", true);
  };
  if (p.practiceRef) p.practiceRef.current = closedBook || doc?.preview ? null : openPractice;
  useEffect(() => () => void (p.practiceRef && (p.practiceRef.current = null)), []);
  useEffect(() => {
    const w = p.practiceRef?.pending;
    if (!w || w.item !== p.id || !doc) return;
    p.practiceRef!.pending = null;
    if (p.practiceRef!.current) openPractice(w.exercise, w.done);
    else w.done(null);
  }, [doc]);
  useEffect(() => {
    if (!block || !notesShown || notes.text === null || scaffolded.current === block) return;
    scaffolded.current = block;
    if ("practice" in block) notesField.current?.scaffold(block.heading, block.prompts);
    else notesField.current?.scaffold(block.title ?? `Chapter ${block.n}`, CHAPTER_PROMPTS);
  }, [block, notesShown, notes.text === null]);
  const toggleHide = () => {
    setHideSource((v) => {
      if (!block) save("ore.hidesource", v ? "0" : "1");
      return !v;
    });
  };
  async function endBlock(record: boolean) {
    const c = block;
    if (!c || !doc) return;
    // An empty answer is refused where he is, as a form refuses an empty submit: the block stays open.
    if (record && "practice" in c && notesField.current && !notesField.current.written()) return p.notify("Nothing written, so nothing was sent.", "info");
    const text = notesField.current?.settle() ?? null;
    setBlock(null);
    scaffolded.current = null;
    setHideSource(hideBefore.current ?? false);
    hideBefore.current = null;
    // The exercise's answer stays in his note as he wrote it; the tutor gets it for feedback.
    if ("practice" in c) {
      void notes.flush();
      return c.done(record ? text : null);
    }
    const title = c.title ?? `Chapter ${c.n}`;
    if (!record || !text) return void scrollRef.current?.focus({ preventScroll: true });
    setChapterFb({ n: c.n, title });
    try {
      // The recall comes back inside the note's text: never over a draft that failed to save.
      if (!(await notes.flush())) throw new Error("your note’s last edit isn’t saved yet.");
      const r = await ore<{ recall: { text: string; at: string }; notes: string }>("recall", doc.id, opt("chapter", String(c.n)), opt("text", text), opt("heading", title));
      notes.apply(r.notes);
      setDoc((cur) => cur && { ...cur, chapter_recalls: [...(cur.chapter_recalls ?? []).filter((x) => x.n !== c.n), { n: c.n, ...r.recall }] });
    } catch (e) {
      p.notify(`Recall not saved: ${errorText(e)}`, "error");
      setChapterFb(null);
      return;
    }
    await feedbackFor(c.n, title);
  }
  async function feedbackFor(n: number, title: string) {
    if (!doc) return;
    setChapterFb({ n, title });
    try {
      const f = await ore<ChapterFeedback>("recall", doc.id, opt("chapter", String(n)), "--feedback");
      setChapterFb({ n, title, feedback: f });
      setDoc((cur) => cur && { ...cur, chapter_recalls: (cur.chapter_recalls ?? []).map((x) => (x.n === n ? { ...x, feedback: f } : x)) });
    } catch (e) {
      setChapterFb({ n, title, error: errorText(e) });
    }
  }
  /** The passage selected when he pressed Q: it goes with what he writes toward an answer (D75). */
  const [sideQuote, setSideQuote] = useState<string | null>(null);
  const firstNotes = useRef(true);
  useEffect(() => {
    if (firstNotes.current) return void (firstNotes.current = false);
    if (!notesShown) void notes.flush();
  }, [notesShown, notes.flush]);
  const lastOpen = useRef(notesShown);
  const lastClosed = useRef(closedBook);
  useEffect(() => {
    // The panel coming back after the quiz or a chapter recall isn't him opening the note: focus goes to the source.
    const back = lastClosed.current && !closedBook;
    lastClosed.current = closedBook;
    if (lastOpen.current === notesShown) return;
    lastOpen.current = notesShown;
    // On the phone the note opens to read; the keyboard waits for a tap, as in Notes.
    if (notesShown && !PHONE && !back) notesField.current?.focus();
    else if (!questionsShown) scrollRef.current?.focus({ preventScroll: true });
  }, [notesShown, questionsShown, closedBook]);

  /** Each new highlight's `forget`, for a fresh one he drops before it counts. */
  const made = useRef(new Map<string, () => void>());
  const realId = async (id: string) => {
    const wait = pending.current.get(id);
    return wait ? (await wait).id : id;
  };

  /** Writes what he typed in the popup's note, however it closes: a click away, Esc, another
   *  highlight, leaving the source. Only Remove (and a selection dropped untouched) throws it away. */
  function keepNote(pop = popupNow.current) {
    const ann = pop && annsRef.current.find((a) => a.id === pop.id);
    if (!pop || !ann) return;
    const note = pop.note.trim();
    if (note !== (ann.note ?? "")) void setNoteOf(pop.id, note);
  }

  useEffect(() => () => keepNote(), [p.id]);

  function closePopup(keep = true) {
    if (keep) {
      keepNote();
      if (popupNow.current) settle(popupNow.current.id, popupNow.current.note);
    }
    setPopup(null);
    scrollRef.current?.focus({ preventScroll: true });
  }

  /** Settle (D129, Tyler's pick A, 2026-11-07): when the popup closes on a highlight he gave a type or a note,
   *  the popup lifts away, its margin mark pops in three pixel steps and the passage glows once. Only transform
   *  and opacity animate, on inert copies, so the next selection or key never waits; skipped under reduced motion. */
  function settle(id: string, note: string) {
    const ann = annsRef.current.find((a) => a.id === id);
    const page = pageRef.current;
    if (!ann || !page || (ann.intent === "keep" && !note.trim())) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const pop = popupRef.current;
    if (pop) {
      const ghost = pop.cloneNode(true) as HTMLElement;
      const from = pop.querySelectorAll("textarea"), to = ghost.querySelectorAll("textarea");
      to.forEach((t, i) => (t.value = from[i]?.value ?? ""));
      ghost.removeAttribute("role");
      ghost.setAttribute("aria-hidden", "true");
      ghost.inert = true;
      ghost.classList.add("leaving");
      page.appendChild(ghost);
      requestAnimationFrame(() => ghost.classList.add("gone"));
      setTimeout(() => ghost.remove(), 200);
    }
    // After the close renders: the margin may redraw its marks as the popup goes.
    requestAnimationFrame(() => {
      const mark = page.querySelector<HTMLElement>(`.mark-icon[data-key="${CSS.escape(id)}"]`);
      if (!mark) return;
      mark.classList.add("settle");
      setTimeout(() => mark.classList.remove("settle"), 240);
    });
    const range = ranges.current.get(id);
    if (range) {
      const box = page.getBoundingClientRect();
      const glow = document.createElement("div");
      glow.className = `settle-glow ${ann.intent}`;
      for (const r of range.getClientRects()) {
        if (!r.width) continue;
        const bit = document.createElement("i");
        Object.assign(bit.style, { top: `${r.top - box.top}px`, left: `${r.left - box.left}px`, width: `${r.width}px`, height: `${r.height}px` });
        glow.appendChild(bit);
      }
      page.appendChild(glow);
      setTimeout(() => glow.remove(), 460);
    }
  }

  /** Where the popup sits for a highlight, in the page's coordinates, kept inside the page. */
  function placeFor(range: Range, room = 160) {
    const page = pageRef.current;
    if (!page) return null;
    const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
    const box = page.getBoundingClientRect();
    // Below the passage when there is no room above it, in the text he can see under a pinned player
    // or, on the iPhone, under the bar at the top.
    const below = rect.top - ((video || PHONE) && scrollRef.current ? band().top : 0) < room;
    const top = (below ? rect.bottom + 8 : rect.top - 8) - box.top;
    return { top, left: leftFor(rect.left + rect.width / 2, box), below };
  }

  /** The popup's centre across the page, kept inside it. */
  function leftFor(x: number, box: DOMRect) {
    const half = video ? 230 : 190; // half the popup's width, plus room
    // iPhone: the popup spans the screen less 12pt each side (styles.css), centred like an iOS sheet.
    return PHONE ? innerWidth / 2 - box.left : Math.min(Math.max(x - box.left, half), box.width - half);
  }

  /** The highlight popup's place in the page (D112, `popupPlace`). */
  function popupAt(range: Range, aim: Aim = {}) {
    const page = pageRef.current;
    if (!page) return null;
    const rects = [...range.getClientRects()].filter((r) => r.width > 0);
    const first = rects[0] ?? range.getBoundingClientRect();
    const box = page.getBoundingClientRect();
    const view = scrollRef.current ? band() : { top: 0, bottom: innerHeight };
    const at = popupPlace(first, rects.at(-1) ?? first, view, popupRef.current?.offsetHeight ?? 80, aim);
    return { top: at.y - box.top, left: leftFor(at.x, box), below: at.below };
  }

  /** Where the pointer was when the popup opened, kept so a reflow moves it the same way. */
  const aimRef = useRef<Aim>({});

  function openPopup(id: string, range: Range, note: string, aim: Aim = {}) {
    if (popup && popup.id !== id) keepNote();
    aimRef.current = aim;
    const at = popupAt(range, aim);
    if (!at) return;
    setPopup({ id, ...at, note });
    setTip(null);
  }

  // The page narrows when the source note or sidebar opens and the text reflows: follow the highlight.
  useEffect(() => {
    const page = pageRef.current;
    if (!popup?.id || !page) return;
    const obs = new ResizeObserver(() => {
      const range = ranges.current.get(popup.id);
      // The text moved under the pointer: keep the side, centre on the passage again.
      const at = range && popupAt(range, { up: aimRef.current.up });
      if (at) setPopup((cur) => (cur && cur.id === popup.id ? { ...cur, ...at } : cur));
    });
    obs.observe(page);
    return () => obs.disconnect();
  }, [popup?.id]);

  /** A passage a question may be answered by (D75): scrolled a third of the way down and tinted for a moment. */
  function jumpToQuote(m: { quote: string; start?: number }) {
    const el = scrollRef.current;
    const index = idx.current;
    if (!el || !index || body === undefined || !src) return;
    const r = rangeFor(index, src, body, { exact: m.quote, prefix: "", suffix: "", start: m.start ?? 0 });
    if (!r) return p.notify("Couldn’t find that passage in the text any more.", "error");
    toThird(r, "smooth");
    CSS.highlights.set("hl-evidence-on", new Highlight(r));
    window.setTimeout(() => CSS.highlights.delete("hl-evidence-on"), 2400);
  }

  /** From the Collected tab (D64): scroll the passage a third of the way down the text in view (below a
   *  video's player) and open its popup, whose ▶ plays from there. */
  function jumpToHighlight(id: string) {
    const el = scrollRef.current;
    const range = ranges.current.get(id);
    if (!el || !range) return;
    toThird(range);
    fresh.current = null;
    openPopup(id, range, anns.find((a) => a.id === id)?.note ?? "");
  }

  /** A jump from Collected to the passage; on the phone, on the source's page once it has slid back in. */
  function onSource(run: () => void) {
    if (!PHONE) return run();
    p.onCloseSide();
    setTimeout(run, 320);
  }

  /** Where he is, as a source offset: the word being spoken, or the block a third of the way down. */
  function here(): number | null {
    const index = idx.current;
    const el = scrollRef.current;
    if (!index || !src || !doc || !docEl.current || !el) return null;
    let range: Range | null;
    // A video he has played: the word being spoken. Before it plays, the text he is looking at.
    if (words && player.started && currentWord.current >= 0) {
      const i = currentWord.current;
      range = skeletonRange(index, words.pos[i]!, words.end[i]!);
    } else {
      // Below a video's player, which covers the top of the text.
      const view = band();
      const b = startBlock(blocksOf(docEl.current), view.top, view.bottom - view.top);
      range = b && textRange(b, b);
    }
    return range ? (sourceQuote(src, doc.body, index, range)?.start ?? null) : null;
  }

  /** How far he got (D100), for a finish partway: the furthest word spoken in a video he has played, or
   *  in text the last block in view, kept as a body offset. */
  function noteReached() {
    const index = idx.current;
    if (!index || !src || !doc || !docEl.current || !scrollRef.current) return;
    let range: Range | null = null;
    if (words) {
      if (!player.started || currentWord.current < 0) return;
      range = skeletonRange(index, words.pos[currentWord.current]!, words.end[currentWord.current]!);
    } else {
      const view = band();
      const last = blocksOf(docEl.current).findLast((b) => b.getBoundingClientRect().top < view.bottom - 24);
      range = last ? textRange(last, last) : null;
    }
    const q = range && sourceQuote(src, doc.body, index, range);
    if (!q) return;
    const key = `ore.reached.${p.id}`;
    if (q.start + q.exact.length > (Number(load(key)) || 0)) save(key, String(q.start + q.exact.length));
  }
  useEffect(() => {
    if (!player.playing) return;
    const t = window.setInterval(noteReached, 5000);
    return () => window.clearInterval(t);
  }, [player.playing, words]);

  /** A key point of his own ("Card here", Tyler, 2026-10-29; D118): a line he types, anchored where he is now, drafted from the whole source. */
  function cardHere() {
    if (popup) closePopup();
    // A draft he kept stays anchored where he started it.
    if (adding === null) hereAt.current = here();
    focusAdd.current = true;
    setAdding((cur) => cur ?? "");
    setAddAsk((n) => n + 1);
    p.onShowSide("questions", true);
  }

  async function addPoint(line: string) {
    const at = hereAt.current ?? here();
    if (at === null || !doc) {
      setAdding(line);
      return p.notify("Couldn’t tell where you are in the text. Scroll to the part it’s about, then press Enter again.", "error");
    }
    const tmp = `pending-${Date.now()}`;
    setAnns((l) => [...l, { id: tmp, rev: 0, intent: "card", exact: "", prefix: "", suffix: "", start: at, end: at, note: line, status: "open", point: true }]);
    try {
      const ann = await ore<Annotation>("highlight", p.id, "--at", String(at), opt("note", line));
      keptFromFeed(ann);
      setAnns((l) => l.map((a) => (a.id === tmp ? ann : a)));
      const s = annStep(ann.id);
      p.notify("Key point added", "quiet", s.remove, s.bring);
    } catch (e) {
      setAnns((l) => l.filter((a) => a.id !== tmp));
      focusAdd.current = true;
      setAdding(line);
      p.notify(errorText(e), "error");
    }
  }

  // D15: a selection becomes a Keep highlight at once; the popup only refines it.
  function createHighlight(range: Range, intent: Intent = "keep", aim?: Aim, popupToo = true) {
    const index = idx.current;
    if (!doc || !src || !index) return;
    const text = range.toString();
    if (!text.trim()) return;
    const q = sourceQuote(src, doc.body, index, range);
    const args = ["highlight", p.id, opt("exact", q?.exact ?? text.trim()), "--intent", intent];
    // Never without a place: the core saves the match nearest it, not the first one in the source.
    args.push("--start", String(q ? q.start : sourceHint(src, index, range)));
    const tmp = `pending-${Date.now()}`;
    const promise = ore<Annotation>(...args);
    pending.current.set(tmp, promise);
    ranges.current.set(tmp, range);
    setAnns((l) => [...l, { id: tmp, rev: 0, intent, exact: text, prefix: "", suffix: "", start: 0, end: 0, status: "open" }]);
    if (popupToo) {
      openPopup(tmp, range, "", aim);
      fresh.current = tmp;
    }
    // On the history at once, so a ⌘Z right after the drag takes this highlight back, not the step
    // before it; the step acts on the saved highlight once the write is back.
    let step: ReturnType<typeof annStep> | undefined;
    const act = (f: "remove" | "bring") => () => promise.then((ann) => (step ??= annStep(ann.id, ann))[f](), () => {});
    const forget = p.notify("Highlight", "quiet", act("remove"), act("bring"));
    promise.then(
      (ann) => {
        keptFromFeed(ann);
        if (fresh.current === tmp) fresh.current = ann.id;
        const r = ranges.current.get(tmp);
        const old = ranges.current.get(ann.id);
        ranges.current.delete(tmp);
        if (r) ranges.current.set(ann.id, r);
        // The passage was already highlighted: the core gave that highlight back, so the popup edits it.
        const was = annsRef.current.find((a) => a.id === ann.id);
        const existing = !!was;
        // Selected past its edge, the highlight grew to cover both (core): its range becomes both ranges.
        if (was && r && old && (was.start !== ann.start || was.end !== ann.end)) {
          const both = union(old, r);
          ranges.current.set(ann.id, both);
          const s = spanStep(ann.id, { exact: was.exact, start: was.start, range: old }, { exact: ann.exact, start: ann.start, range: both });
          p.notify("Highlight", "quiet", s.back, s.again);
        } else if (was && old) ranges.current.set(ann.id, old);
        if (existing) forget(); // no new highlight: nothing of this one to take back
        setAnns((l) => (existing ? l.filter((a) => a.id !== tmp).map((a) => (a.id === ann.id ? { ...a, exact: ann.exact, prefix: ann.prefix, suffix: ann.suffix, start: ann.start, end: ann.end, rev: ann.rev } : a)) : l.map((a) => (a.id === tmp ? { ...ann, intent: a.intent, note: a.note } : a))));
        setPopup((cur) => (cur?.id === tmp ? { ...cur, id: ann.id, ...(existing && { note: ann.note ?? "" }) } : cur));
        if (existing && intent !== "keep" && intent !== ann.intent) void setIntentOf(ann.id, intent);
        else if (!existing) made.current.set(ann.id, forget);
      },
      (e) => {
        forget();
        ranges.current.delete(tmp);
        setAnns((l) => l.filter((a) => a.id !== tmp));
        setPopup((cur) => (cur?.id === tmp ? null : cur));
        p.notify(placeError(e), "error");
      },
    );
  }

  /** A passage chosen with the mouse or the keyboard: inside a highlight he already made, that one opens
   *  (with the type he keyed) instead of stacking a second; otherwise it becomes a new highlight. */
  const holderOf = (r: Range) =>
    [...ranges.current].find(([, h]) => h.compareBoundaryPoints(Range.START_TO_START, r) <= 0 && h.compareBoundaryPoints(Range.END_TO_END, r) >= 0);
  function highlightRange(r: Range, intent?: Intent, aim?: Aim, snap = false) {
    const inside = holderOf(r);
    if (inside) {
      fresh.current = null;
      openPopup(inside[0], inside[1], annsRef.current.find((a) => a.id === inside[0])?.note ?? "", aim);
      if (intent && annsRef.current.find((a) => a.id === inside[0])?.intent !== intent) void setIntentOf(inside[0], intent);
    } else createHighlight(snap ? snapRange(r) : r, intent, aim);
  }

  // The quiz's "In the source" passage as a key point, in one click: inside a highlight he made, that
  // one is marked (or unmarked); otherwise the passage becomes a new key point highlight.
  const passage = reveal ? evidence[reveal.at] : null;
  const holder = passage ? [...ranges.current].find(([, h]) => h.compareBoundaryPoints(Range.START_TO_START, passage) <= 0 && h.compareBoundaryPoints(Range.END_TO_END, passage) >= 0) : undefined;
  const passageKey = !!holder && anns.find((a) => a.id === holder[0])?.intent === "card";
  function keyPassage() {
    if (holder) void setIntentOf(holder[0], passageKey ? "keep" : "card");
    else if (passage) createHighlight(passage.cloneRange(), "card", undefined, false);
  }

  /** The focus's first and last block, in reading order. */
  const focusSpan = (f: { anchor: HTMLElement; head: HTMLElement }) =>
    f.anchor.compareDocumentPosition(f.head) & Node.DOCUMENT_POSITION_PRECEDING ? ([f.head, f.anchor] as const) : ([f.anchor, f.head] as const);

  /** ↑ ↓ step the focus a block at a time and ⇧ widens it, the head kept a third of the way down. The
   *  first press, or one after he scrolled it out of view, starts at the block a third of the way down. */
  function moveFocus(by: 1 | -1, widen: boolean) {
    const el = scrollRef.current;
    const d = docEl.current;
    if (!el || !d) return;
    const blocks = blocksOf(d);
    const view = el.getBoundingClientRect();
    const r = focus?.head.getBoundingClientRect();
    const at = focus && r && r.bottom > view.top && r.top < view.bottom ? blocks.indexOf(focus.head) : -1;
    if (at < 0) {
      const start = startBlock(blocks, view.top, view.height);
      if (start) setFocus({ anchor: start, head: start });
      return;
    }
    const head = blocks[Math.max(0, Math.min(blocks.length - 1, at + by))]!;
    setFocus({ anchor: widen ? focus!.anchor : head, head });
    if (words) following.current = false;
    // Keyboard-driven, so no animation (AGENTS.md, motion).
    el.scrollTop += head.getBoundingClientRect().top - (view.top + view.height / 3);
  }

  /** H or 1–3 on the focus: highlights its text as that type, as a mouse selection would (D15). */
  function highlightFocus(intent: Intent) {
    if (!focus) return;
    const [first, last] = focusSpan(focus);
    const r = textRange(first, last);
    if (!r) return;
    highlightRange(r, intent);
    // He asked for it by key: Esc closes the popup and keeps the highlight.
    fresh.current = null;
    setFocus({ anchor: focus.head, head: focus.head });
  }

  /** `ore annotate`, one write at a time per highlight: quick changes and their ⌘Z land in the order
   *  he made them, never an older one last. */
  const annotate = <T = unknown,>(id: string, ...args: string[]) => inOrder(`annotate ${id}`, () => ore<T>("annotate", id, ...args));

  /** The popup's marks are switches on one highlight (D118): Key point or Question, again for neither. */
  async function setIntent(want: Intent) {
    if (!popup) return;
    const now = annsRef.current.find((a) => a.id === popup.id)?.intent;
    const intent = want !== "keep" && want === now ? "keep" : want;
    if (intent === "card" || intent === "apply") noteRef.current?.focus();
    await setIntentOf(popup.id, intent);
  }

  async function setIntentOf(id: string, intent: Intent, undoable = true) {
    const was = annsRef.current.find((a) => a.id === id)?.intent;
    setAnns((l) => l.map((a) => (a.id === id ? { ...a, intent } : a)));
    const saved = realId(id);
    // On the history at once, so a ⌘Z right after the click takes this change back, not the step before it.
    const to = (i: Intent) => () => saved.then((rid) => setIntentOf(rid, i, false));
    const forget = undoable && was && was !== intent ? p.notify(`Changed to ${LABEL[intent]}`, "quiet", to(was), to(intent)) : undefined;
    try {
      await annotate(await saved, "--intent", intent);
    } catch (e) {
      forget?.();
      setAnns((l) => l.map((a) => (a.id === id && was ? { ...a, intent: was } : a)));
      // From the history (undo or redo): it puts the step back and says why.
      if (!undoable) throw e;
      p.notify(errorText(e), "error");
    }
  }

  /** Takes a highlight away and brings it back, as one step of the history (⌘Z, ⇧⌘Z); what comes
   *  back is the highlight as it was when it went, its type and note included. */
  function annStep(rid: string, seed?: Annotation) {
    let ann: Annotation | undefined = seed;
    let range: Range | undefined;
    const drop = () => {
      ann = annsRef.current.find((a) => a.id === rid) ?? ann;
      range = ranges.current.get(rid) ?? range;
      ranges.current.delete(rid);
      setAnns((l) => l.filter((a) => a.id !== rid));
      setPopup((cur) => (cur?.id === rid ? null : cur));
    };
    const restore = () => {
      if (range) ranges.current.set(rid, range);
      if (ann) setAnns((l) => (l.some((a) => a.id === rid) ? l : [...l, ann!]));
    };
    return {
      drop,
      restore,
      // Both return the write: one that fails rolls back here, and the history says why (history.ts).
      remove: () => {
        drop();
        return annotate(rid, "--status", "deleted").catch((e) => {
          restore();
          throw e;
        });
      },
      bring: () => {
        restore();
        return annotate(rid, "--status", ann?.status ?? "open").catch((e) => {
          drop();
          throw e;
        });
      },
    };
  }

  /** Moves a highlight's passage to `to` and back to `from`, as one step of the history (⌘Z, ⇧⌘Z). */
  function spanStep(rid: string, from: Span, to: Span) {
    const go = (s: Span, other: Span) => {
      ranges.current.set(rid, s.range);
      setAnns((l) => l.map((a) => (a.id === rid ? { ...a, exact: s.exact, start: s.start, end: s.start + s.exact.length } : a)));
      setRepaint((n) => n + 1);
      setPopup((cur) => (cur?.id === rid ? null : cur));
      // Run only from the history, which says why if the write fails.
      return annotate(rid, opt("exact", s.exact), "--start", String(s.start)).catch((e) => {
        ranges.current.set(rid, other.range);
        setAnns((l) => l.map((a) => (a.id === rid ? { ...a, exact: other.exact, start: other.start, end: other.start + other.exact.length } : a)));
        setRepaint((n) => n + 1);
        throw e;
      });
    };
    return { back: () => go(from, to), again: () => go(to, from) };
  }

  /** An edge let go: the passage is saved where it now ends, and the popup comes back beside it. */
  async function dropEdge(id: string, range: Range, was: Range) {
    const index = idx.current;
    const a = annsRef.current.find((x) => x.id === id);
    const note = popup?.id === id ? popup.note : (a?.note ?? "");
    const same = range.compareBoundaryPoints(Range.START_TO_START, was) === 0 && range.compareBoundaryPoints(Range.END_TO_END, was) === 0;
    if (same || !a || !doc || !src || !index) return openPopup(id, was, note);
    const q = sourceQuote(src, doc.body, index, range);
    if (!q) {
      ranges.current.set(id, was);
      setRepaint((n) => n + 1);
      openPopup(id, was, note);
      return p.notify("Couldn’t place the highlight there. Try ending it on a nearby word.", "error");
    }
    const from: Span = { exact: a.exact, start: a.start, range: was };
    const to: Span = { exact: q.exact, start: q.start, range };
    // Resized, it is a highlight he worked on: Esc now keeps it, as Enter does. A move that fails puts
    // the edge back, and the highlight is untouched again.
    const wasFresh = fresh.current === id;
    if (wasFresh) fresh.current = null;
    let rid: string | undefined;
    ranges.current.set(id, range);
    setAnns((l) => l.map((x) => (x.id === id ? { ...x, exact: q.exact, start: q.start, end: q.start + q.exact.length } : x)));
    setRepaint((n) => n + 1);
    openPopup(id, range, note);
    try {
      rid = await realId(id);
      await annotate(rid, opt("exact", q.exact), "--start", String(q.start));
      const s = spanStep(rid, from, to);
      p.notify("Moved the highlight’s edge", "quiet", s.back, s.again);
    } catch (e) {
      ranges.current.set(id, was);
      setAnns((l) => l.map((x) => (x.id === id ? { ...x, exact: from.exact, start: from.start, end: from.start + from.exact.length } : x)));
      setRepaint((n) => n + 1);
      setPopup((cur) => (cur?.id === id ? { ...cur, ...popupAt(was) } : cur));
      if (wasFresh && fresh.current === null) fresh.current = rid ?? id;
      p.notify(placeError(e), "error");
    }
  }

  async function setNoteOf(id: string, note: string, undoable = true) {
    const was = annsRef.current.find((a) => a.id === id)?.note ?? "";
    setAnns((l) => l.map((a) => (a.id === id ? { ...a, note } : a)));
    try {
      const rid = await realId(id);
      await annotate(rid, opt("note", note));
      if (undoable) p.notify(note ? "Highlight note" : "Removed the highlight note", "quiet", () => setNoteOf(rid, was, false), () => setNoteOf(rid, note, false));
    } catch (e) {
      setAnns((l) => l.map((a) => (a.id === id ? { ...a, note: was } : a)));
      // From the history (undo or redo): it puts the step back and says why.
      if (!undoable) throw e;
      p.notify(errorText(e), "error");
    }
  }

  /** `undoable` false: a selection made only to point (Start from here) goes quietly. */
  async function remove(undoable = true) {
    if (!popup) return;
    const id = popup.id;
    closePopup(false);
    let rid: string;
    try {
      rid = await realId(id);
    } catch {
      return; // creating it failed; already cleaned up
    }
    // A selection he dropped (Esc, or one made only to point) leaves no step behind.
    if (!undoable) made.current.get(rid)?.();
    const s = annStep(rid);
    s.drop();
    try {
      await annotate(rid, "--status", "deleted");
    } catch (e) {
      p.notify(errorText(e), "error");
      s.restore();
      return;
    }
    if (undoable) p.notify("Highlight removed", "info", s.bring, s.remove);
  }

  /** Removes a saved highlight from outside its popup (the Collected tab's menu); Undo brings it back. */
  async function removeSaved(id: string) {
    if (popup?.id === id) closePopup(false);
    const s = annStep(id);
    s.drop();
    // On the history at once, as the row goes: a ⌘Z right after must take back this step, not the one before.
    const forget = p.notify("Highlight removed", "info", s.bring, s.remove);
    try {
      await annotate(id, "--status", "deleted");
    } catch (e) {
      forget();
      p.notify(errorText(e), "error");
      s.restore();
    }
  }

  /** A highlight's menu in the Collected tab: its type, copy, remove, as in its popup. */
  const highlightActions = (a: Annotation): MenuAction[] => [
    { id: "open", label: "Open", run: () => onSource(() => jumpToHighlight(a.id)) },
    {
      id: "type",
      label: "Type",
      run: () => {},
      sub: INTENTS.map((i) => ({ id: i, label: LABEL[i], checked: a.intent === i, run: () => void (a.intent !== i && setIntentOf(a.id, i)) })),
    },
    { id: "copy", label: "Copy with source", run: () => copyHighlight(a.id) },
    { id: "remove", label: "Remove highlight", danger: true, divider: true, run: () => void removeSaved(a.id) },
  ];

  /** Removes junk from the text (D111): every block the highlight touches, or from a heading, its whole
   *  section. A fresh, untouched Keep was only a way to point, so it goes quietly first; a highlight he had
   *  goes with the text (its cards stay). Undo puts the text and its highlights back. */
  async function cutOut() {
    if (!popup || !doc) return;
    const range = ranges.current.get(popup.id);
    const section = !!(range && (range.startContainer.nodeType === 1 ? (range.startContainer as Element) : range.startContainer.parentElement)?.closest("h1, h2, h3, h4, h5, h6"));
    const id = popup.id;
    const ann = annsRef.current.find((a) => a.id === id);
    const untouched = fresh.current === id && ann?.intent === "keep" && !ann.note && !popup.note.trim();
    closePopup(false);
    const d = doc;
    try {
      const rid = await realId(id);
      const a = annsRef.current.find((x) => x.id === rid) ?? ann;
      if (!a) return;
      if (untouched) {
        made.current.get(rid)?.();
        await annotate(rid, "--status", "deleted");
      }
      const c = await ore<{ id: string; words: number; section: boolean; removed: unknown[] }>("cut", d.id, "--from", String(a.start), "--to", String(a.end), ...(section ? ["--section"] : []));
      p.reload();
      p.onChanged();
      const n = c.removed.length;
      const what = `Removed ${c.section ? "the section, " : ""}${c.words} ${c.words === 1 ? "word" : "words"}${n ? ` and ${n} ${n === 1 ? "highlight" : "highlights"}` : ""}`;
      const step = (flag: string) => () => ore("cut", d.id, flag, c.id).then(() => (p.reload(), p.onChanged()));
      p.notify(what, "info", step("--undo"), step("--redo"));
    } catch (e) {
      p.notify(errorText(e), "error");
    }
  }

  /** "Start from here" (D49): plays from the highlight's first word. A fresh, untouched selection
   *  was only a way to point, so its Keep highlight goes; an existing highlight stays. */
  function startHere() {
    const range = popup && ranges.current.get(popup.id);
    if (!popup || !range || !words || !idx.current) return;
    const i = wordAtOffset(words, skeletonOffset(idx.current, range.startContainer, range.startOffset));
    const ann = annsRef.current.find((a) => a.id === popup.id);
    const drop = fresh.current === popup.id && ann?.intent === "keep" && !ann.note && !popup.note.trim();
    if (i >= 0) seekTo(words.time[i]!, true);
    if (drop) void remove(false);
    else closePopup();
  }

  /** Look Up (D83) on a word: from the popup, a fresh, untouched Keep was only a way to point, so it
   *  goes, as with Start here; a highlight he already had stays. */
  function lookUp(range: Range, from: Popup | null) {
    let ann: string | null = null;
    if (from) {
      const a = annsRef.current.find((x) => x.id === from.id);
      const drop = fresh.current === from.id && a?.intent === "keep" && !a.note && !from.note.trim();
      if (drop) void remove(false);
      else {
        ann = from.id;
        closePopup();
      }
    }
    // Explain is taller than the highlight popup: below the term unless there's room above.
    const at = placeFor(range, 380);
    if (!at) return;
    const word = range.toString().replace(/\s+/g, " ").trim();
    // Where it sits in the body: the AI reads its paragraph, and the rest of the source is searched for it.
    const q = src && doc && idx.current ? sourceQuote(src, doc.body, idx.current, range) : null;
    const again = q && doc ? againIn(doc.body, q.start + q.exact.length, word) : { sections: [], later: false };
    CSS.highlights.set("hl-lookup", new Highlight(range));
    setLookup({ word, range, ann, ...at, start: q?.start, again });
    void define(word).then((text) => setLookup((cur) => (cur?.range === range ? { ...cur, text } : cur)));
  }

  function closeLookUp() {
    CSS.highlights.delete("hl-lookup");
    setLookup(null);
    scrollRef.current?.focus({ preventScroll: true });
  }

  /** The word becomes a Card highlight, so its sentence goes to the draft as context (D20) and the
   *  popup opens on it with the note field ready, as choosing Card does. */
  async function makeCard() {
    if (!lookup) return;
    const { range, ann } = lookup;
    closeLookUp();
    if (!ann) {
      createHighlight(range, "card");
      requestAnimationFrame(() => noteRef.current?.focus());
      return;
    }
    const id = await realId(ann);
    openPopup(id, ranges.current.get(id) ?? range, annsRef.current.find((a) => a.id === id)?.note ?? "");
    requestAnimationFrame(() => noteRef.current?.focus());
    if (annsRef.current.find((a) => a.id === id)?.intent !== "card") await setIntentOf(id, "card");
  }

  /** Learn this (D97): the term becomes his question, worded `question` (a Keep he had there turns into
   *  it); with `id`, rewords that question. Quietly: the Explain popover stays open on it. */
  async function askOn(question: string, id: string | null): Promise<string | null> {
    const range = lookup?.range;
    try {
      if (!id && lookup?.ann) id = await realId(lookup.ann);
      if (id) {
        const was = annsRef.current.find((a) => a.id === id);
        setAnns((l) => l.map((a) => (a.id === id ? { ...a, intent: "question", note: question } : a)));
        try {
          await annotate(id, "--intent", "question", opt("note", question));
        } catch (e) {
          // Not saved: the highlight keeps what it was.
          if (was) setAnns((l) => l.map((a) => (a.id === id ? was : a)));
          throw e;
        }
        return id;
      }
      const index = idx.current;
      if (!range || !doc || !src || !index) return null;
      const q = sourceQuote(src, doc.body, index, range);
      const args = ["highlight", p.id, opt("exact", q?.exact ?? range.toString().trim()), "--intent", "question", opt("note", question)];
      if (q) args.push("--start", String(q.start));
      let ann = await ore<Annotation>(...args);
      keptFromFeed(ann);
      // The passage was already highlighted: the core gave that one back, so it becomes the question.
      if (ann.intent !== "question" || ann.note !== question) ann = await annotate<Annotation>(ann.id, "--intent", "question", opt("note", question));
      ranges.current.set(ann.id, range);
      setAnns((l) => [...l.filter((a) => a.id !== ann.id), ann]);
      setLookup((cur) => cur && cur.range === range ? { ...cur, ann: ann.id } : cur);
      const s = annStep(ann.id);
      p.notify("Question", "quiet", s.remove, s.bring);
      return ann.id;
    } catch (e) {
      p.notify(errorText(e), "error");
      return null;
    }
  }

  // Typing with the highlight popup open writes its note, as Notion's comment box does (Tyler, 2026-11-08): the
  // first letter moves focus into the note and lands there. Caught first, so no single-letter shortcut (C, Q, N…)
  // sees it. 1–4 still set the type, and Tab, Backspace, Enter and Esc keep their meaning.
  useEffect(() => {
    if (!popup || PHONE) return;
    const onKey = (e: KeyboardEvent) => {
      const note = noteRef.current;
      const t = e.target as HTMLElement;
      if (p.blocked || !note || t === note || t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing || e.key.length !== 1 || e.key === " ") return;
      if (!note.value && INTENTS.some((i) => is(e, i))) return;
      e.stopImmediatePropagation();
      note.focus();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [popup, p.blocked]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (p.blocked || closedBook) return;
      const t = e.target as HTMLElement;
      if (t.closest?.(".popover")) return; // the speed popover handles its own keys and Esc
      const inNote = t === noteRef.current;
      const inField = !inNote && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      const inSide = !!t.closest?.(".margin, .mynotes");
      if (is(e, "hide-source")) {
        e.preventDefault();
        toggleHide();
        return;
      }
      if (block && is(e, "finish")) {
        e.preventDefault();
        void endBlock(true);
        return;
      }
      if (block && e.key === "Escape" && !t.closest?.(".note-menu")) {
        e.preventDefault();
        void endBlock(false);
        return;
      }
      // Not while typing: ⌘↵ out of habit in a note must never open the quiz (2026-10-31).
      if (is(e, "finish-source") && !inField && !inNote && !doc?.preview) {
        e.preventDefault();
        keepNote();
        setPopup(null);
        p.setFinishing(true);
        return;
      }
      if (is(e, "filter") && !PHONE) {
        e.preventDefault();
        openFind();
        return;
      }
      if (isLoose(e, "bigger") || isLoose(e, "smaller")) {
        e.preventDefault();
        (isLoose(e, "bigger") ? bigger : smaller)();
        return;
      }
      const plain = !e.metaKey && !e.ctrlKey && !e.altKey;
      if (video && player.ready && !inField && !inNote && !ownsMediaKey(t, e.key)) {
        const act = is(e, "play")
          ? player.toggle
          : is(e, "back")
            ? () => seekTo(player.time() - 15)
            : is(e, "forward")
              ? () => seekTo(player.time() + 30)
              : is(e, "slower")
                ? () => player.setRate(player.rate - 0.25)
                : is(e, "faster")
                  ? () => player.setRate(player.rate + 0.25)
                  : null;
        if (act) {
          e.preventDefault();
          act();
          return;
        }
      }
      // Not while the highlight popup is open: a letter typed there is the start of a thought, not a command.
      if (!video && !PHONE && !popup && !inField && !inNote && doc && is(e, "listen")) {
        e.preventDefault();
        if (listen) stopListening();
        else startListening();
        return;
      }
      if (listen && !inField && !inNote && !t.closest?.("button, [role=slider]")) {
        const act = is(e, "play") ? togglePause : is(e, "slower") ? () => setListenRate(listen.rate - 0.25) : is(e, "faster") ? () => setListenRate(listen.rate + 0.25) : null;
        if (act) {
          e.preventDefault();
          act();
          return;
        }
      }
      if (doc && !inField && !inNote && !p.finishing && (is(e, "lesson-prev") || is(e, "lesson-next"))) {
        const at = (p.lessons ?? []).findIndex((l) => l.id === doc.id);
        const to = p.lessons?.[at + (is(e, "lesson-next") ? 1 : -1)];
        if (at >= 0 && to) {
          e.preventDefault();
          p.onOpenLesson(to.id);
          return;
        }
      }
      if ((!popup && !inField && !inNote && is(e, "original")) || is(e, "reveal")) {
        e.preventDefault();
        if (doc) void (is(e, "original") ? openOriginal(doc) : revealInFinder(doc)).catch((err) => p.notify(errorText(err), "error"));
        return;
      }
      if (doc && is(e, "link") && doc.url) {
        e.preventDefault();
        copyLink(doc);
        return;
      }
      if (doc && is(e, "path")) {
        e.preventDefault();
        copyPath(doc);
        return;
      }
      // ⌘C with nothing selected: the open highlight, or else the source, with where it came from.
      if (doc && !inField && !inNote && is(e, "copy") && !window.getSelection()?.toString()) {
        e.preventDefault();
        if (popup) copyHighlight(popup.id, popup.note);
        else copy(citeSources([doc]), "Copied as Markdown");
        return;
      }
      if (doc && !popup && !inField && !inNote && (is(e, "rename") || is(e, "archive"))) {
        e.preventDefault();
        if (is(e, "rename")) setRenaming(true);
        else p.onArchive(doc);
        return;
      }
      if (!inField && !inNote && is(e, "collected")) {
        e.preventDefault();
        if (popup) closePopup();
        p.onShowSide("questions");
        return;
      }
      if (!inField && !inNote && is(e, "questions")) {
        // A highlight just made, or one open in the popup, is the passage his answer is about.
        e.preventDefault();
        const quote = popup ? annsRef.current.find((a) => a.id === popup.id)?.exact : null;
        if (popup) closePopup();
        if (quote) setSideQuote(quote.replace(/\s+/g, " ").trim());
        p.onShowSide("questions", !!quote);
        return;
      }
      if (!popup && !inField && is(e, "section")) {
        e.preventDefault();
        margin.current?.focusNearest();
        return;
      }
      if (!PHONE && !inField && !inNote && is(e, "look-up")) {
        e.preventDefault();
        if (lookup) return closeLookUp();
        const range = popup ? ranges.current.get(popup.id) : pointer.current && docEl.current && wordAt(pointer.current.x, pointer.current.y, docEl.current);
        // The key follows the popup's Explain button: a term, not a passage (a 2000-character highlight isn't one).
        if (range && !lookable(range.toString())) p.notify("Explain works on a word or a short phrase. Select up to three words, then try again.");
        else if (range) lookUp(range, popup);
        return;
      }
      if (lookup) {
        if (inField) return;
        if (is(e, "card")) {
          e.preventDefault();
          void makeCard();
        } else if (plain && e.key === "Escape") {
          e.preventDefault();
          closeLookUp();
        }
        return;
      }
      // Arrows inside a menu, list or slider are theirs.
      const ownsArrows = e.defaultPrevented || !!t.closest?.("[role=menu], [role=listbox], [role=slider], [role=tablist], [cmdk-root]");
      if (!PHONE && !inField && !inNote && !inSide && !ownsArrows && !e.metaKey && !e.ctrlKey && !e.altKey && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        if (popup) closePopup();
        moveFocus(e.key === "ArrowDown" ? 1 : -1, e.shiftKey);
        return;
      }
      // 2 with nothing selected: Card here, a line of his own from this spot.
      if (!focus && !popup && !inField && !inNote && is(e, "card") && !window.getSelection()?.toString()) {
        e.preventDefault();
        cardHere();
        return;
      }
      if (focus && !popup && !inField && !inNote && !inSide) {
        const intent = is(e, "highlight") ? "keep" : INTENTS.find((i) => is(e, i));
        if (intent) {
          e.preventDefault();
          highlightFocus(intent);
          return;
        }
        if (plain && e.key === "Escape") {
          e.preventDefault();
          setFocus(null);
          return;
        }
      }
      if (popup) {
        if (inField) return;
        if (inNote) {
          // While the note is empty its type keys still switch type (Card focuses it, then 3 makes it a Question);
          // once he has typed, digits are text.
          const typed = INTENTS.find((i) => is(e, i));
          if (typed && !noteRef.current?.value) {
            e.preventDefault();
            void setIntent(typed);
          } else if (plain && !e.shiftKey && e.key === "Enter" && !e.isComposing) {
            e.preventDefault();
            closePopup();
          } else if (plain && e.key === "Escape") {
            e.preventDefault();
            closePopup();
          } else if (e.key === "Tab") {
            // The popup's buttons are keyed, not tabbed; Tab would drop his typing somewhere else.
            e.preventDefault();
          }
          return;
        }
        const intent = INTENTS.find((i) => is(e, i));
        if (intent) {
          e.preventDefault();
          void setIntent(intent);
        } else if (is(e, "note")) {
          e.preventDefault();
          noteRef.current?.focus();
        } else if (is(e, "remove")) {
          e.preventDefault();
          void remove();
        } else if (is(e, "cut-text") && canCut) {
          e.preventDefault();
          void cutOut();
        } else if (plain && e.key === "Escape" && popup && fresh.current === popup.id && !popup.note.trim() && annsRef.current.find((a) => a.id === popup.id)?.intent === "keep") {
          // Esc cancels: a selection he just made and didn't touch goes away; Enter or a click keeps it (D15).
          e.preventDefault();
          void remove(false);
        } else if (plain && (e.key === "Escape" || e.key === "Enter")) {
          e.preventDefault();
          closePopup();
        }
        return;
      }
      if (plain && e.key === "Escape") {
        e.preventDefault();
        if (inField || inSide) scrollRef.current?.focus({ preventScroll: true });
        // The find bar is the top layer even when focus has left its field: Esc closes it, not the source.
        else if (find.open) closeFind();
        else p.onBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onScroll = () => {
    if (tip) setTip(null);
    if (PHONE && scrollRef.current && performance.now() - lastTouch.current < 2000) {
      // The bars go as he scrolls down to read and come back as he scrolls up, and at either end (Books, Obsidian).
      // Only his finger's scroll: coming back to a saved place or a jump to a passage keeps them.
      const el = scrollRef.current;
      const moved = el.scrollTop - lastTop.current;
      if (Math.abs(moved) > 8) {
        setBarsHidden(moved > 0 && el.scrollTop > 40 && el.scrollTop + el.clientHeight < el.scrollHeight - 40);
        lastTop.current = el.scrollTop;
      }
    }
    if ((words || listen) && !following.current) updateAway();
    if (!ready) return;
    clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      save(scrollKey, String(Math.round(el.scrollTop)));
      // How far down he is, for Continue reading on Home (D58).
      save(`ore.pos.${p.id}`, (el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight)).toFixed(3));
      noteReached();
    }, 150);
  };

  const onMouseDown = (e: MouseEvent) => {
    // A click that is not the third of a triple: the double-clicked word is kept now, quietly (no popup,
    // and the selection this click starts is left alone).
    const word = wordWait.current;
    if (word && e.detail !== 3) {
      dropWord();
      word.quiet();
    }
    setFocus(null); // the mouse takes over from the keyboard focus
    if (popup && !popupRef.current?.contains(e.target as Node)) {
      keepNote();
      setPopup(null);
    }
    // The skill picker in Learn this opens in a portal: a click there is still inside the popover.
    if (lookup && !lookupRef.current?.contains(e.target as Node) && !(e.target as Element).closest?.("[data-radix-popper-content-wrapper]")) closeLookUp();
    setTip(null);
  };

  // One click opens a link (Safari, Readwise Reader): the web in his browser, a footnote or heading
  // in this page. A drag across one selects text instead: no link opens while text is selected.
  const followLink = (href: string, from?: Element) => {
    const dec = (t: string) => {
      try {
        return decodeURIComponent(t);
      } catch {
        return t;
      }
    };
    if (href.startsWith("#")) {
      const id = href.slice(1);
      const el = docEl.current;
      const slug = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
      const ids = el ? Array.from(el.querySelectorAll("[id]")).filter((n) => n.id === id || n.id === dec(id)) : [];
      // A book's chapters number their footnotes from 1 again: a mark goes to the next note with its
      // number, a note back to the last mark before it.
      const byId = (from && (id.startsWith("fnref-") ? ids.findLast((n) => n.compareDocumentPosition(from) & Node.DOCUMENT_POSITION_FOLLOWING) : noteFor(from))) || ids[0];
      const heading = !byId && el ? Array.from(el.querySelectorAll("h1, h2, h3, h4, h5, h6")).find((h) => slug(h.textContent ?? "") === slug(dec(id))) : undefined;
      if (byId || heading) {
        markPlace();
        return (byId ?? heading)!.scrollIntoView({ block: heading ? "start" : "center" });
      }
      return p.notify(`That part of the page wasn’t saved with it.${doc?.url && doc.type !== "snippet" ? " Reimport the source from its ⋯ menu to fetch it again." : ""}`, "error");
    }
    if (/^(?:https?|mailto):/i.test(href)) return void openUrl(href).catch((e) => p.notify(`Couldn’t open the link: ${errorText(e)}`, "error"));
    p.notify(`This links to “${dec(href)}”, a file beside the original that isn’t in Ore. Add it with ${label(keys.file)} to read it here.`, "error");
  };
  const onClick = (e: MouseEvent) => {
    const fig = zoomable(e.target, docEl.current);
    if (fig) return setZoom(fig);
    const a = (e.target as Element).closest?.("a[href]");
    if (!a || !docEl.current?.contains(a)) return;
    e.preventDefault();
    if (window.getSelection()?.isCollapsed === false) return;
    // On a touch screen a footnote's mark shows its note where it is, as Books does.
    if (a.matches("a.fn") && matchMedia("(hover: none)").matches) return showNote(a);
    followLink(a.getAttribute("href")!, a);
  };

  // A jump inside the source (the outline, a footnote, a heading link) keeps where he was: ⌘[ goes back
  // there and ⌘] to the jump again before they leave the source, as Safari's anchor history and Books'
  // Back to page do. Caught first, so the app's view history only takes over once these run out.
  const places = useRef<{ back: number[]; fwd: number[] }>({ back: [], fwd: [] });
  const markPlace = () => {
    const el = scrollRef.current;
    if (el) places.current = { back: [...places.current.back, el.scrollTop], fwd: [] };
  };
  useEffect(() => {
    places.current = { back: [], fwd: [] };
    const onKey = (e: KeyboardEvent) => {
      const by = is(e, "nav-back") ? "back" : is(e, "nav-forward") ? "fwd" : null;
      const el = scrollRef.current;
      // Only from the text: in a diagram beside it ⌘[ is Send backward.
      const t = e.target as Node;
      if (!by || !el || zoomed.current || inTextField(e) || (t !== document.body && !el.contains(t)) || !places.current[by].length) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const other = by === "back" ? "fwd" : "back";
      places.current[other].push(el.scrollTop);
      el.scrollTop = places.current[by].pop()!;
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [p.id]);

  // A double click's word waits out the Mac's double-click time (0.5 s by default): a third click
  // makes it the paragraph, one highlight and one step, as Books acts on the final selection.
  const wordWait = useRef<{ timer: number; quiet: () => void } | null>(null);
  const dropWord = () => {
    if (wordWait.current) clearTimeout(wordWait.current.timer);
    wordWait.current = null;
  };
  useEffect(() => dropWord, []);
  const onMouseUp = (e: MouseEvent) => {
    const el = docEl.current;
    if (!ready || !el || closedBook || popupRef.current?.contains(e.target as Node) || lookupRef.current?.contains(e.target as Node)) return;
    // Right-click (or ⌃-click) opens the Mac's own menu, whose Look Up needs the word selected: no Keep.
    if (e.button !== 0 || e.ctrlKey) return;
    const stamp = video && (e.target as HTMLElement).closest?.<HTMLElement>(".ts");
    if (stamp) return seekTo(Number(stamp.dataset.t), true);
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.rangeCount) {
      const r = sel.getRangeAt(0);
      if (el.contains(r.startContainer) && el.contains(r.endContainer)) {
        // The paragraph replaces a double click's word only now that it will be highlighted: a triple
        // click whose selection runs past the text (the last paragraph, in WebKit) keeps the word.
        dropWord();
        const up = sel.focusNode === r.startContainer && sel.focusOffset === r.startOffset;
        const range = r.cloneRange();
        const aim = { x: e.clientX, y: e.clientY, up };
        const exact = e.altKey;
        const keep = () => {
          // Whole words, unless he held ⌥ for part of one.
          highlightRange(range, undefined, aim, !exact);
          setTimeout(() => sel.removeAllRanges(), 0); // after the click, so a link under the mouse does not open
        };
        if (e.detail === 2) {
          const timer = window.setTimeout(() => (dropWord(), keep()), 500);
          const quiet = () => void (holderOf(range) || createHighlight(exact ? range : snapRange(range), "keep", undefined, false));
          wordWait.current = { timer, quiet };
        } else keep();
      }
      return;
    }
    if (words && idx.current && e.altKey) {
      const c = document.caretRangeFromPoint(e.clientX, e.clientY);
      const i = c ? wordAtOffset(words, skeletonOffset(idx.current, c.startContainer, c.startOffset)) : -1;
      if (i >= 0) seekTo(words.time[i]!, true);
      return;
    }
    // A link or a figure inside a highlight opens the link or the figure; the rest of the highlight opens its popup.
    if ((e.target as Element).closest?.("a[href]") || zoomable(e.target, el)) return;
    const id = hitTest(ranges.current, e.clientX, e.clientY);
    const range = id && ranges.current.get(id);
    if (id && range) {
      fresh.current = null;
      openPopup(id, range, annsRef.current.find((a) => a.id === id)?.note ?? "", { x: e.clientX, y: e.clientY });
    }
  };

  // iPhone: a selection made with the touch handles fires no mouseup, so once it settles the four
  // highlight types show at the bottom of the screen (under the selection, iOS's Copy bar covers
  // them), as Apple Books shows its colours after a selection. One tap makes that type of highlight
  // and opens its popup. They act on pointerdown: a tap clears the selection before any click.
  const [touchSel, setTouchSel] = useState(false);
  // The settled selection: iOS clears it when the button is touched, before any click arrives.
  const touchRange = useRef<Range | null>(null);
  useEffect(() => {
    if (!PHONE) return;
    let timer = 0;
    const settle = () => {
      clearTimeout(timer);
      setTouchSel(false);
      timer = window.setTimeout(() => {
        const sel = window.getSelection();
        const el = docEl.current;
        if (!sel || sel.isCollapsed || !sel.rangeCount || !el) return;
        const r = sel.getRangeAt(0);
        if (!el.contains(r.startContainer) || !el.contains(r.endContainer)) return;
        touchRange.current = r.cloneRange();
        setTouchSel(true);
      }, 300);
    };
    document.addEventListener("selectionchange", settle);
    document.addEventListener("scroll", settle, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", settle);
      document.removeEventListener("scroll", settle, true);
    };
  }, []);
  const highlightSelection = (intent: Intent) => {
    const r = touchRange.current;
    touchRange.current = null;
    setTouchSel(false);
    if (!r || r.collapsed) return;
    createHighlight(snapRange(r), intent);
    window.getSelection()?.removeAllRanges();
  };

  const onMouseMove = (e: MouseEvent) => {
    pointer.current = { x: e.clientX, y: e.clientY };
    if (popup || e.buttons) return;
    // A footnote's mark shows its note on hover (Wikipedia's previews); a click still goes to it.
    const mark = (e.target as Element).closest?.("a.fn");
    if (mark) return showNote(mark);
    if (frame.current) return;
    const { clientX: x, clientY: y } = e;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const id = hitTest(ranges.current, x, y);
      const note = id ? annsRef.current.find((a) => a.id === id)?.note : undefined;
      setTip((cur) => (id && note ? (cur?.id === id ? cur : { id, x, y, text: note }) : null));
    });
  };

  const showNote = (mark: Element) => {
    const text = noteText(mark);
    if (!text) return;
    const r = mark.getBoundingClientRect();
    setTip((cur) => (cur?.id === `fn:${mark.id}` ? cur : { id: `fn:${mark.id}`, x: r.left - 12, y: r.bottom - 18 + 6, text }));
  };

  const openFind = () => {
    if (popup) closePopup();
    setFind((f) => ({ ...f, open: true, focus: f.focus + 1, note: false }));
  };
  const closeFind = () => {
    setFind((f) => ({ ...f, open: false }));
    scrollRef.current?.focus({ preventScroll: true });
  };

  const copyLink = (item: Item) =>
    navigator.clipboard.writeText(item.url!).then(() => p.notify("Link copied"), (e) => p.notify(errorText(e), "error"));
  const copyPath = (item: Item) =>
    navigator.clipboard.writeText(pathOf(item)).then(() => p.notify("Path copied"), (e) => p.notify(errorText(e), "error"));
  const copy = (c: Cited, done: string) => copyCited(c).then(() => p.notify(done), (e) => p.notify(errorText(e), "error"));
  /** A highlight as a quote with its source (Readwise), and his note under it. */
  const copyHighlight = (id: string, note?: string) => {
    const a = annsRef.current.find((x) => x.id === id);
    if (doc && a) void copy(citeQuote(a.exact, doc, note ?? a.note), "Copied with source");
  };

  /** Saves a new title in place (Notion's page title): optimistic, put back if the write fails. */
  async function retitle(id: string, before: string, t: string, undoable = true) {
    if (!t || t === before) return true;
    setDoc((cur) => cur && cur.id === id ? { ...cur, title: t } : cur);
    try {
      await inOrder(id, () => ore("edit", id, "--title", t));
      p.onChanged();
      if (undoable) p.notify(`Renamed to “${t}”`, "quiet", () => retitle(id, t, before, false), () => retitle(id, before, t, false));
      return true;
    } catch (e) {
      setDoc((cur) => cur && cur.id === id ? { ...cur, title: before } : cur);
      // From the history (undo or redo): it puts the step back and says why.
      if (!undoable) throw e;
      p.notify(errorText(e), "error");
      return false;
    }
  }

  /** Sets the author by hand, in place where the byline sits (Readwise Reader's "Edit metadata"): one
   *  that ingest and its PDF metadata missed. Empty clears it. Optimistic, on the history. */
  async function reauthor(id: string, before: string | undefined, a: string | undefined, undoable = true) {
    if ((a ?? "") === (before ?? "")) return true;
    setDoc((cur) => cur && cur.id === id ? { ...cur, author: a } : cur);
    // On the history at once, so a quick ⌘Z takes it back; taken off again if the write fails.
    const forget = undoable ? p.notify(a ? `Author set to “${a}”` : "Author removed", "quiet", () => reauthor(id, a, before, false), () => reauthor(id, before, a, false)) : () => {};
    try {
      await inOrder(id, () => ore("edit", id, "--author", a ?? ""));
      p.onChanged();
      return true;
    } catch (e) {
      forget();
      setDoc((cur) => cur && cur.id === id ? { ...cur, author: before } : cur);
      // From the history (undo or redo): it puts the step back and says why.
      if (!undoable) throw e;
      p.notify(errorText(e), "error");
      return false;
    }
  }

  /** Fetches the original again (a file: reads its kept copy again) and puts its new text in this source (Readwise's "Re-import"): highlights
   *  follow their passage, the ones whose passage is gone are removed (their cards stay), with Undo. */
  const reimport = async () => {
    if (!doc) return;
    const d = doc;
    // Run only from the history, which says so if it fails.
    const swap = () => ore("reimport", d.id, "--undo").then(() => (p.reload(), p.onChanged()));
    p.notify(`Reimporting “${d.title}”…`, "progress");
    try {
      const r = await ore<{ changed: boolean; removed: unknown[] }>("reimport", d.id);
      if (!r.changed) return p.notify(`“${d.title}” is already up to date`);
      p.reload();
      p.onChanged();
      const n = r.removed.length;
      const what = n ? `Reimported. ${n} ${n === 1 ? "highlight is" : "highlights are"} no longer in it, so ${n === 1 ? "it was" : "they were"} removed` : "Reimported with the latest text";
      p.notify(what, "info", swap, swap);
    } catch (e) {
      p.notify(errorText(e, "reimport"), "error");
    }
  };

  /** Files the source under exactly `skills` (its cards follow), with Undo naming the one that changed. */
  /** The skills as last saved from here: the Questions list reads again once a filing has landed. */
  const [filed, setFiled] = useState("");
  const fileUnder = async (skills: string[], changed?: Skill, fromHistory = false) => {
    if (!doc) return;
    const before = doc.skills;
    // Filing under an archived skill brings it back (D173, as App's refile); Undo archives it again.
    const revived = skills.filter((id) => !before.includes(id) && p.skills.some((s) => s.id === id && s.archived));
    setDoc((cur) => cur && { ...cur, skills });
    try {
      await ore("edit", doc.id, "--skills", skills.join(","));
      setFiled(skills.join());
      p.onChanged();
      if (revived.length) p.onSkillsChanged();
      if (changed) p.notify(skills.includes(changed.id) ? `Filed under ${changed.name}` : `Removed from ${changed.name}`, "info", () => fileUnder(before, undefined, true).then(() => p.rearchive?.(revived)), () => fileUnder(skills, undefined, true));
    } catch (e) {
      setDoc((cur) => cur && { ...cur, skills: unfile(cur.skills, skills, before) });
      // From the history (undo or redo): it puts the step back and says why.
      if (fromHistory) throw e;
      p.notify(errorText(e), "error");
    }
  };
  /** A skill typed into the skill picker: made at once, so the picker can tick it. */
  const createSkill = async (name: string) => {
    try {
      const made = await ore<Skill>("skills", "add", name, opt("collection", ""));
      p.onSkillsChanged();
      skillMade(made, p.notify, () => (p.onSkillsChanged(), p.onChanged()));
      return made;
    } catch (e) {
      p.notify(errorText(e), "error");
    }
  };

  const intent = (popup && anns.find((a) => a.id === popup.id)?.intent) || "keep";
  const popupRange = popup && ranges.current.get(popup.id);
  const canLookUp = !PHONE && !!popupRange && lookable(popupRange.toString());
  // Junk can be cut from the text, but not from a transcript: its words are timed to the video (D111).
  const popupEl = popupRange && (popupRange.startContainer.nodeType === 1 ? (popupRange.startContainer as Element) : popupRange.startContainer.parentElement);
  const canCut = !!popupEl && (!video || cardMode) && !popupEl.closest(".video-card") && !annsRef.current.find((a) => a.id === popup?.id)?.point;
  const inHeading = !!popupEl?.closest("h1, h2, h3, h4, h5, h6");
  /** The open source's actions, Readwise Reader's document menu: ⋯ at the top right, right-click on
   *  the title, and ⌘K, each with its shortcut. */
  const actions: MenuAction[] = !doc
    ? []
    : [
        ...(doc.url || doc.source_file ? [{ id: "original", label: "Open original", hint: label(keys.original), run: () => void openOriginal(doc).catch((e) => p.notify(errorText(e), "error")) }] : []),
        ...(doc.url ? [{ id: "link", label: "Copy link", hint: label(keys.link), run: () => copyLink(doc) }] : []),
        { id: "copy", label: "Copy as Markdown", hint: label(keys.copy), paletteOnly: !PHONE, run: () => void copy(citeSources([doc]), "Copied as Markdown") },
        { id: "path", label: "Copy path", hint: label(keys.path), run: () => copyPath(doc) },
        { id: "reveal", label: "Reveal in Finder", hint: label(keys.reveal), run: () => void revealInFinder(doc).catch((e) => p.notify(errorText(e), "error")) },
        { id: "rename", label: "Rename…", hint: label(keys.rename), divider: true, run: () => setRenaming(true) },
        { id: "author", label: doc.author ? "Edit author…" : "Add author…", run: () => setAuthoring(true) },
        // A PDF or EPUB file is read again from the copy kept with it, so a better reader reaches it.
        ...((doc.url && doc.type !== "snippet") || doc.type === "pdf" || doc.type === "epub" ? [{ id: "reimport", label: "Reimport", run: () => void reimport() }] : []),
        ...(PHONE ? [] : [{ id: "find", label: "Find in source…", hint: label(keys.filter), paletteOnly: true, run: openFind }]),
        ...(p.skills.length
          ? [{
              id: "skills",
              label: "Skills",
              // The skill picker in the header does this on the Mac; the phone has no picker there.
              paletteOnly: !PHONE,
              run: () => {},
              sub: p.skills.map((k) => ({
                id: k.id,
                label: k.name,
                icon: <SkillIcon icon={k.icon} color={k.color} dot className="palette-icon" />,
                checked: doc.skills.includes(k.id),
                run: () => void fileUnder(doc.skills.includes(k.id) ? doc.skills.filter((s) => s !== k.id) : [...doc.skills, k.id], k),
              })),
            }]
          : []),
        ...(doc.status === "done"
          ? [{ id: "toread", label: "Move to To read", divider: true, run: () => {
              setDoc((cur) => cur && { ...cur, status: "reading" });
              p.onMove(doc, "reading");
            } }]
          : doc.preview ? []
          : [{ id: "finish", label: "Finish source", hint: label(keys["finish-source"]), divider: true, run: () => p.setFinishing(true) }]),
        ...(video || PHONE ? [] : [{ id: "listen", label: listen ? "Stop listening" : "Listen", hint: label(keys.listen), run: () => (listen ? stopListening() : startListening()) }]),
        ...(focus ? [{ id: "highlight", label: "Highlight focused text", hint: label(keys.highlight), paletteOnly: true, run: () => highlightFocus("keep") }] : []),
        { id: "card-here", label: "Add a key point here…", hint: label(keys.card), run: cardHere },
        // The open highlight's own tools, also in ⌘K (three ways to every action); its popup has the buttons.
        ...(popup && !PHONE
          ? [
              { id: "copy-highlight", label: "Copy highlight with source", paletteOnly: true, run: () => copyHighlight(popup.id, popup.note) },
              ...(canCut ? [{ id: "cut-text", label: inHeading ? "Remove this section from the text" : "Remove this from the text", hint: label(keys["cut-text"]), paletteOnly: true, run: () => void cutOut() }] : []),
              { id: "remove-highlight", label: "Remove highlight", hint: label(keys.remove), paletteOnly: true, run: () => void remove() },
            ]
          : []),
        { id: "side-panel", label: panelShown ? "Hide side panel" : "Show side panel", hint: label(keys["side-panel"]), paletteOnly: true, run: p.onToggleSide },
        { id: "notes", label: notesShown ? "Close source note" : "Open source note", hint: label(keys.notes), paletteOnly: true, run: () => p.onShowSide("note") },
        { id: "collected", label: questionsShown ? "Close collected" : "Collected", hint: label(keys.collected), run: () => p.onShowSide("questions") },
        ...(doc.archived_at ? [] : [{ id: "pin", label: doc.pinned_at ? "Unpin" : "Pin to top", run: () => {
          setDoc((cur) => cur && { ...cur, pinned_at: cur.pinned_at ? undefined : new Date().toISOString() });
          p.onPin(doc);
        } }]),
        { id: "archive", label: doc.archived_at ? "Restore" : "Archive", hint: label(keys.archive), danger: !doc.archived_at, divider: true, run: () => p.onArchive(doc) },
      ];
  p.actionsRef.current = closedBook ? [] : actions;
  // The phone has no Finder, no side panel and no sidebar to pin to yet.
  const menuActions = actions.filter((a) => !a.paletteOnly);
  const canFinish = !!doc && doc.status !== "done" && !doc.preview;
  // On the phone Finish lives here and at the end of the source; the top bar stays Back and ⋯ (D156).
  const phoneActions = menuActions.filter((a) => !["reveal", "questions", "pin"].includes(a.id) && (a.id !== "original" || !!doc?.url));
  const shownActions = PHONE
    ? [...phoneActions.filter((a) => a.id === "finish").map((a) => ({ ...a, label: "Finish", hint: undefined })), ...phoneActions.filter((a) => a.id !== "finish")].map((a, i) => (i ? a : { ...a, divider: false }))
    : menuActions;

  if (error)
    return (
      <div className="reader">
        <div className="empty-state">
          {error}
          <br />
          <kbd>Esc</kbd> back to sources
        </div>
      </div>
    );
  if (!doc)
    return (
      <div className="reader">
        {/* Shows only if opening takes a beat, so a quick open doesn't flash it. */}
        <p className="loading reader-loading"><Working label="Opening…" /></p>
      </div>
    );

  // A file on the Mac can't open on the phone; a web page opens in Safari.
  const source = PHONE && !doc.url ? null : originalLabel(doc);
  const published = pubDate(doc.published);
  const collected = (
    <Collected
      anns={anns}
      ready={ready}
      rectOf={(id) => ranges.current.get(id)?.getBoundingClientRect()}
      onOpen={() => {
        if (popup) closePopup();
        p.onShowSide("questions", true);
      }}
      fit={fit}
    />
  );
  const suggested = doc.suggested_skill;
  /** Accept or dismiss the skill enrich suggested, with Undo: `ore suggested-skill undo` takes back just
   *  what the accept filed (and a skill it made), and the suggestion returns either way. */
  const suggestion = async (action: "accept" | "dismiss", undoable = true) => {
    const id = doc.id;
    const was = doc.suggested_skill;
    if (!was) return;
    const takeBack = (record: object) => async () => {
      const m = await ore<Item>("suggested-skill", id, "undo", JSON.stringify(record));
      setDoc((cur) => cur && cur.id === id ? { ...cur, skills: m.skills, suggested_skill: m.suggested_skill } : cur);
      p.onSkillsChanged();
      p.onChanged();
    };
    try {
      if (action === "accept") {
        const r = await ore<{ skill: Skill; created: boolean; item: Item; undo: object }>("suggested-skill", id, "accept");
        setDoc((cur) => cur && cur.id === id ? { ...cur, skills: r.item.skills, suggested_skill: undefined } : cur);
        p.onSkillsChanged();
        if (undoable) p.notify(r.created ? `Created skill ${r.skill.name}` : `Filed under ${r.skill.name}`, "info", takeBack(r.undo), () => suggestion("accept", false));
      } else {
        await ore("suggested-skill", id, "dismiss");
        setDoc((cur) => cur && cur.id === id ? { ...cur, suggested_skill: undefined } : cur);
        if (undoable) p.notify(`Dismissed suggested skill ${was.name}`, "info", takeBack({ suggestion: was }), () => suggestion("dismiss", false));
      }
      p.onChanged();
    } catch (e) {
      // A redo's failure goes back to the history, which says so; a first try says it here.
      if (!undoable) throw e;
      p.notify(errorText(e), "error");
    }
  };
  /** Folds the whole card or its transcript, kept for this source. Folding the card pauses the video;
   *  opening the transcript brings the spoken word back into it. */
  const foldCard = (next: typeof vc) => {
    setVc(next);
    try {
      localStorage.setItem(`ore.videoCard.${p.id}`, JSON.stringify(next));
    } catch {}
    if (!next.open && player.playing) player.toggle();
    if (next.open && next.transcript && words) requestAnimationFrame(follow);
  };
  const videoCard: VideoCard | undefined = cardMode
    ? {
        box: boxRef,
        open: vc.open,
        transcript: vc.transcript,
        head: (
          <div className="vc-head" data-noindex>
            <div className="vc-bar">
              <Hint text={vc.open ? "Fold the video away" : "Show the video"}>
                <button className="vc-fold" aria-expanded={vc.open} onClick={() => foldCard({ ...vc, open: !vc.open })}>
                  {vc.open ? <CaretDown size={13} weight="bold" aria-hidden="true" /> : <CaretRight size={13} weight="bold" aria-hidden="true" />}
                  Video
                </button>
              </Hint>
              {vc.open && (
                <Hint text={vc.transcript ? "Hide the transcript" : "Show the transcript as it plays"}>
                  <button className="vc-toggle" aria-pressed={vc.transcript} onClick={() => foldCard({ ...vc, transcript: !vc.transcript })}>
                    <Subtitles size={15} aria-hidden="true" />
                    Transcript
                  </button>
                </Hint>
              )}
            </div>
            {/* Folded by CSS, not unmounted, so the player keeps its place in the video. */}
            <VideoPlayer
              player={player}
              ticks={ticks}
              title={doc.title}
              onFinish={() => p.setFinishing(true)}
              onOpen={() => void openOriginal(doc).catch((e) => p.notify(errorText(e), "error"))}
            />
          </div>
        ),
        foot: away && vc.open && vc.transcript ? (
          <div className="vc-foot" data-noindex>
            <BackToCurrent dir={away} onClick={follow} />
          </div>
        ) : undefined,
      }
    : undefined;

  return (
    <div className={`reader${closedBook ? " quizzing" : ""}${PHONE && (notesShown || questionsShown) ? " noting" : ""}${barsHidden && !find.open ? " bars-hidden" : ""}`} ref={readerRef}>
      <div className={`reader-pane${hidden ? " hidden-src" : ""}`} aria-hidden={hidden || undefined}>
      {/* Learn this's Read now (D97): back to the passage he left, as Books offers after following a link. ⌘[ too. */}
      {p.back && !closedBook && (
        <Hint text="Back to the passage you left" keys="nav-back" side="top">
          <button className="back-current side-quest-back" onClick={p.back.go}>
            <ArrowLeft size={13} aria-hidden="true" />
            Back to <b>{p.back.title}</b>
          </button>
        </Hint>
      )}
      {!closedBook && (
        <div className={`reader-tools${PHONE || panelShown ? "" : " by-toggle"}`} ref={setTools}>
          {listen && (
            <div className="listen-bar" role="group" aria-label="Listening">
              <Hint text={listen.playing ? "Pause" : "Play"} keys="play">
                <button className="ctl" aria-label={listen.playing ? "Pause" : "Play"} onClick={togglePause}>
                  {listen.playing ? <Pause size={15} weight="fill" /> : <Play size={15} weight="fill" />}
                </button>
              </Hint>
              <Speed rate={listen.rate} onRate={setListenRate} />
              <Hint text="Stop listening" keys="listen">
                <button className="ctl" aria-label="Stop listening" onClick={stopListening}>
                  <X size={14} />
                </button>
              </Hint>
            </div>
          )}
          {/* A Feed post isn't saved until he keeps something from it; this says so, where Finish sits. */}
          {doc?.preview && (
            <Hint text="Not in your library yet. A highlight or a note keeps it; leave with neither and it’s gone.">
              <span className="unsaved">Not saved</span>
            </Hint>
          )}
          {/* What he has collected sits in the toolbar (Reeder's article tools), never over the text he reads. */}
          {!PHONE && collected}
          {/* Not on the phone: its note is a page of its own, the source already out of sight. */}
          {!PHONE && (
            <Hint text={hideSource ? "Show the source" : "Hide the source while you write"} keys="hide-source">
              <button className={`width-toggle${hideSource ? " on" : ""}`} aria-label={hideSource ? "Show the source" : "Hide the source"} aria-pressed={hideSource} onClick={toggleHide}>
                {hideSource ? <EyeSlash size={16} /> : <Eye size={16} />}
              </button>
            </Hint>
          )}
          {!PHONE && canFinish && (
            <Hint text="Quiz yourself, then finish" keys="finish-source">
              <button className="note-toggle" onClick={() => p.setFinishing(true)}>
                Finish
              </button>
            </Hint>
          )}
          <MoreButton className="width-toggle" label="Source actions" actions={shownActions} />
        </div>
      )}
      {/* The right side panel's toggle, mirroring the sidebar's at the window's top right (Notion, Arc).
          Its dot says a source note waits behind it. */}
      {!PHONE && !closedBook && (
        <Hint text={panelShown ? "Hide side panel" : "Show side panel"} keys="side-panel">
          <button
            className={`panel-toggle${!panelShown && notes.text?.trim() ? " has" : ""}`}
            aria-label={panelShown ? "Hide side panel" : "Show side panel"}
            aria-expanded={panelShown}
            onClick={p.onToggleSide}
          >
            <SidebarRight size={16} aria-hidden="true" />
          </button>
        </Hint>
      )}
      {find.open && !closedBook && (
        <FindBar
          roots={() => [...(find.note ? [] : [pageRef.current]), readerRef.current?.querySelector<HTMLElement>(".mynotes-text")]}
          within={readerRef.current}
          query={find.query}
          onQuery={(query) => setFind((f) => ({ ...f, query }))}
          focus={find.focus}
          onClose={closeFind}
          onJump={() => {
            if (words) following.current = false;
          }}
        />
      )}
      {touchSel && !popup && !closedBook && (
        <div className="touch-highlight" role="group" aria-label="Highlight as">
          {INTENTS.map((i) => {
            const Glyph = ICON[i];
            return (
              <button key={i} className={i} onPointerDown={(e) => {
                  e.preventDefault();
                  highlightSelection(i);
                }}>
                <Glyph size={18} weight="fill" aria-hidden="true" /> {LABEL[i]}
              </button>
            );
          })}
        </div>
      )}
      <div className="reader-scroll" ref={scrollRef} tabIndex={-1} onScroll={onScroll} onTouchMove={PHONE ? () => (lastTouch.current = performance.now()) : undefined}>
        <div className={`page${video ? " video" : ""}${cardMode ? " vcard" : ""}${video && player.started ? " listening" : ""}`} ref={pageRef} onMouseDown={onMouseDown} onMouseUp={onMouseUp} onClick={onClick} onMouseMove={onMouseMove} onMouseLeave={() => !matchMedia("(hover: none)").matches && setTip(null)}>
          <header className="doc-head">
            {/* A book's cover or a PDF's first page at the top (D77): the picture is the source. A page's
                og:image or site logo only repeats what the title says, and a video's picture is its player. */}
            {doc.thumbnail && (doc.type === "pdf" || doc.type === "epub") && <Thumb item={doc} className="doc-thumb" />}
            {doc.course && p.lessons && p.lessons.length > 1 && <CourseLine id={doc.id} course={doc.course} lessons={p.lessons} onOpen={p.onOpenLesson} />}
            {/* Where it's from, above the title (Reeder, Matter): one click opens the original. */}
            {source && (
              <Hint text={doc.url ? "Open the original page" : "Open the original file"} keys="original">
                <button className={`source${doc.url ? " site" : ""}`} onClick={() => void openOriginal(doc).catch((e) => p.notify(errorText(e), "error"))}>
                  {source} ↗
                </button>
              </Hint>
            )}
            {renaming ? (
              <TitleField className="title-edit" value={doc.title} onSave={(t) => retitle(doc.id, doc.title, t.trim())} onClose={() => setRenaming(false)} />
            ) : (
              <WithMenu actions={PHONE ? [] : shownActions}>
                {/* One click renames it in place, as the skill page's name does (Notion's page title);
                    a drag across it still selects the words to copy. */}
                <h1 className={PHONE ? undefined : "renamable"} onClick={() => !PHONE && getSelection()?.isCollapsed !== false && setRenaming(true)}>
                  {doc.title}
                </h1>
              </WithMenu>
            )}
            {(doc.author || authoring || published || doc.skills.length > 0 || suggested || !PHONE) && (
              <div className="chips">
                {authoring ? (
                  <TitleField className="author-edit" label="Author" placeholder="Author" value={doc.author ?? ""} size={Math.max(12, (doc.author ?? "").length + 2)} onSave={(a) => reauthor(doc.id, doc.author, a.replace(/\s+/g, " ").trim() || undefined)} onClose={() => setAuthoring(false)} />
                ) : (
                  doc.author &&
                  (PHONE ? (
                    <span className="by">{doc.author}</span>
                  ) : (
                    <Hint text="Edit author">
                      <button className="by" ref={authorRef} onClick={() => setAuthoring(true)}>
                        {doc.author}
                      </button>
                    </Hint>
                  ))
                )}
                {published && <span className="when">{published}</span>}
                {PHONE ? (
                  doc.skills.map((s) => <SkillChip key={s} skill={p.skills.find((k) => k.id === s) ?? { id: s, name: s }} />)
                ) : (
                  <SkillPicker skills={p.skills} value={doc.skills} title={doc.title} onChange={(next, _, k) => void fileUnder(next, k)} onCreate={createSkill} startOpen={p.pickSkill} onClosed={p.onPicked}>
                    {doc.skills.length > 0 &&
                      doc.skills.map((s) => <SkillChip key={s} skill={p.skills.find((k) => k.id === s) ?? { id: s, name: s }} />)}
                  </SkillPicker>
                )}
                {suggested && (
                  <span className="chip suggested">
                    <Hint text={`Suggested skill${suggested.hook ? `: ${suggested.hook}` : ""}. Click to file this source under it.`}>
                      <button onClick={() => void suggestion("accept")}>+ {suggested.name}</button>
                    </Hint>
                    <Hint text="Dismiss">
                      <button className="x" aria-label={`Dismiss suggested skill ${suggested.name}`} onClick={() => void suggestion("dismiss")}>
                        ×
                      </button>
                    </Hint>
                  </span>
                )}
              </div>
            )}
          </header>
          {video && !cardMode && (
            <div className="player-pin" ref={playerRef}>
              <VideoPlayer
                player={player}
                audio={!!audio}
                ticks={ticks}
                title={doc.title}
                onFinish={() => p.setFinishing(true)}
                onOpen={() => void openOriginal(doc).catch((e) => p.notify(errorText(e), "error"))}
              />
              {away === "up" && <BackToCurrent dir="up" onClick={follow} />}
            </div>
          )}
          {/* The phone can't write prequestions (AI runs on the Mac): it shows the ones the Mac wrote. */}
          {/* No text, nothing to ask before reading it. */}
          {!doc.preview && <TablesLine key={doc.id} doc={doc} onRead={tablesRead} />}
          {!doc.preview && (!PHONE || !!doc.prequestions?.length) && (!!doc.body.trim() || !!doc.prequestions?.length) && <Prequestions key={doc.prequestions?.length ?? 0} doc={doc} waiting={waiting || retrying} onRetry={gaveUp && !retrying ? () => void retryEnrich() : undefined} notify={p.notify} />}
          {away === "up" && !video && (
            <div className="follow-up">
              <BackToCurrent dir="up" onClick={follow} />
            </div>
          )}
          <Body markdown={shownBody ?? ""} video={!!video} dir={doc.dir} onReady={onReady} card={cardMode ? videoCard : undefined} />
          {!doc.body.trim() && (
            <p className="doc-empty">
              {video ? "This video has no transcript, so there’s no text to highlight. Watch it above and write what you took from it in the source note." : `No text was saved for this source.${doc.url ? " Open the original from ⋯ to read it." : " Archive it from ⋯ and add the text again."}`}
            </p>
          )}
          {PHONE && ready && canFinish && !closedBook && (
            <div className="phone-finish">
              <button onClick={() => p.setFinishing(true)}>Finish</button>
            </div>
          )}
          {away === "down" && !cardMode && (
            <div className="follow-down">
              <BackToCurrent dir="down" onClick={follow} />
            </div>
          )}
          {ready && <Marks marks={marks} />}
          {ready && popup && !hidden && docEl.current && ranges.current.has(popup.id) && (() => {
            const a = anns.find((x) => x.id === popup.id);
            if (!a || a.point || popup.id.startsWith("pending-")) return null;
            const id = popup.id;
            return (
              <Grab
                range={ranges.current.get(id)!}
                intent={a.intent}
                root={docEl.current}
                onDragging={setDragging}
                onChange={(r) => {
                  ranges.current.set(id, r);
                  setRepaint((n) => n + 1);
                }}
                onDrop={(r, was) => void dropEdge(id, r, was)}
              />
            );
          })()}
          {focus && !closedBook && <FocusBox from={focusSpan(focus)[0]} to={focusSpan(focus)[1]} />}
          {spots && !closedBook && (
            <Margin
              chapters={spots}
              recalled={recalled}
              handle={margin}
              onChapter={openChapter}
            />
          )}
          {popup && (
            <div
              className="popup"
              ref={popupRef}
              role="dialog"
              aria-label="Highlight"
              style={{ top: popup.top, left: popup.left, transform: popup.below ? "translateX(-50%)" : "translate(-50%, -100%)", visibility: dragging ? "hidden" : undefined }}
            >
              <div className="intents">
                {INTENTS.filter((i) => i !== "keep").map((i) => {
                  const Glyph = ICON[i];
                  return (
                    <Hint key={i} text={MEANS[i]} keys={i} side="top">
                      <button
                        tabIndex={-1}
                        aria-pressed={intent === i}
                        className={`intent ${i}${intent === i ? " on" : ""}`}
                        onClick={() => void setIntent(i)}
                      >
                        <Glyph size={14} weight={intent === i ? "fill" : "regular"} aria-hidden="true" />
                        {LABEL[i]}
                      </button>
                    </Hint>
                  );
                })}
              </div>
              {/* The tools stand in a thin column at the right, so the note keeps the width (D112). */}
              <Grow
                ref={noteRef}
                className="field"
                aria-label="Note"
                value={popup.note}
                // From the popup as it is now: a keystroke as the highlight's save lands must not put back its draft id.
                onChange={(e) => {
                  const note = e.target.value;
                  setPopup((cur) => cur && { ...cur, note });
                }}
                placeholder={PLACEHOLDER[intent]}
              />
              <div className="popup-tools">
                <Hint text="Copy with source" keys="copy" side="right">
                  <button tabIndex={-1} className="intent icon" aria-label="Copy with source" onClick={() => copyHighlight(popup.id, popup.note)}>
                    <Copy size={14} aria-hidden="true" />
                  </button>
                </Hint>
                {canCut && (
                  <Hint text={inHeading ? "Remove this section from the text" : "Remove this from the text"} keys="cut-text" side="right">
                    <button tabIndex={-1} className="intent icon" aria-label={inHeading ? "Remove section" : "Remove text"} onClick={() => void cutOut()}>
                      <Eraser size={14} aria-hidden="true" />
                    </button>
                  </Hint>
                )}
                <Hint text="Remove highlight" keys="remove" side="right">
                  <button tabIndex={-1} className="intent remove" aria-label="Remove highlight" onClick={() => void remove()}>
                    <Trash size={13} aria-hidden="true" />
                  </button>
                </Hint>
                {video && words && (
                  <Hint text="Play the video from here" side="right">
                    <button tabIndex={-1} className="intent icon extra" aria-label="Play the video from here" onClick={startHere}>
                      <Play size={14} aria-hidden="true" />
                    </button>
                  </Hint>
                )}
                {canLookUp && (
                  <Hint text="Explain" keys="look-up" side="right">
                    <button tabIndex={-1} className="intent icon extra" aria-label="Explain" onClick={() => lookUp(popupRange!, popup)}>
                      <BookOpenText size={14} aria-hidden="true" />
                    </button>
                  </Hint>
                )}
              </div>
            </div>
          )}
          {lookup && doc && (
            <Explain
              key={lookup.word + (lookup.start ?? "")}
              ref={lookupRef}
              word={lookup.word}
              item={p.id}
              start={lookup.start}
              dict={lookup.text}
              again={lookup.again}
              top={lookup.top}
              left={lookup.left}
              below={lookup.below}
              skills={p.skills}
              sourceSkills={doc.skills}
              onCreateSkill={createSkill}
              onMakeCard={() => void makeCard()}
              onAsk={askOn}
              onLearning={() => {
                // The source list is taller than the explanation: below the term unless there's room above.
                const at = placeFor(lookup.range, 460);
                if (at) setLookup((cur) => cur && { ...cur, ...at });
              }}
              onAdd={(urls, skills, question, now) => p.onLearnAdd?.(urls, skills, question, now, { id: p.id, title: doc.title })}
              onClose={closeLookUp}
            />
          )}
        </div>
      </div>
      {/* After the text, so Tab reaches the outline once the source's own head is behind him. */}
      {!closedBook && !video && !PHONE && <Position scroll={scrollRef} doc={docEl.current} ready={ready} onJump={markPlace} />}
      {/* The phone has no room for the rail: the pill at the top says where he is and opens the sections (D152). */}
      {!closedBook && !video && PHONE && <ReadingPill scroll={scrollRef} doc={docEl.current} ready={ready} onJump={markPlace} />}
      {tip && !popup && (
        // A preview stays on screen at a phone's width too. A highlight note's is at most six lines
        // (styles.css), above the pointer when there is no room below; a footnote's is whole, below its
        // mark. Never over an open popup.
        <div
          className={tip.id.startsWith("fn:") ? "tip note" : "tip"}
          style={{
            left: Math.max(12, Math.min(tip.x + 12, innerWidth - Math.min(tip.id.startsWith("fn:") ? 360 : 320, innerWidth - 24) - 12)),
            ...(tip.id.startsWith("fn:") || tip.y + 18 + TIP_HEIGHT <= innerHeight ? { top: tip.y + 18 } : { bottom: innerHeight - tip.y + 10 }),
          }}
        >
          {tip.text}
        </div>
      )}
      {PHONE && !closedBook && !find.open && (
        <div className="phone-tools">
          {away !== "down" && collected}
          <button className={notes.text?.trim() ? "has" : ""} onClick={() => p.onShowSide("note")}>
            {notes.text?.trim() ? "Note" : "+ Note"}
          </button>
          <button aria-label="Find in source" onClick={openFind}>
            <MagnifyingGlass size={16} aria-hidden="true" />
          </button>
        </div>
      )}
      </div>
      {closedBook && hidden && (
        <div className="hidden-chip">
          <EyeSlash size={15} aria-hidden="true" />
          Source hidden while you answer
        </div>
      )}
      {/* On the phone the note stays beside the source, a swipe away, so each keeps its place. */}
      {(notesShown || questionsShown || (PHONE && !closedBook)) && (
        <SidePanel tab={p.sideTab} onTab={(t) => p.onShowSide(t, true)} bodyRef={sideBody} onBodyMouseDown={p.sideTab === "note" ? clickBelow(notesField) : undefined}>
          {notesShown || (PHONE && !questionsShown) ? (
            <SourceNoteBody
              id={p.id}
              notes={notes}
              editorRef={notesField}
              scroller={sideBody}
              targets={p.targets}
              onOpen={p.onOpenLink}
              tail={
                chapterFb && (
                  <div className="chapter-fb" role="status">
                    <div className="quiz-kicker">
                      {chapterFb.title}
                      <button aria-label="Dismiss the feedback" onClick={() => setChapterFb(null)}>
                        <X size={12} />
                      </button>
                    </div>
                    {!chapterFb.feedback && !chapterFb.error && (
                      <p className="loading">
                        <Working stage="read" label="Reading your recall against the chapter…" />
                      </p>
                    )}
                    {chapterFb.error && (
                      <p className="err">
                        Feedback failed: {chapterFb.error}
                        <button className="retry" onClick={() => void feedbackFor(chapterFb.n, chapterFb.title)}>
                          Retry
                        </button>
                      </p>
                    )}
                    {chapterFb.feedback && (
                      <>
                        <p>{chapterFb.feedback.feedback}</p>
                        {chapterFb.feedback.missed.length > 0 && (
                          <ul>
                            {chapterFb.feedback.missed.map((m, i) => (
                              <li key={i}>{m}</li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                )
              }
            />
          ) : (
            <CollectedPanel
              anns={anns}
              timeOf={timeOf}
              adding={adding}
              onAdding={(on) => (on ? cardHere() : setAdding(null))}
              onEdit={setAdding}
              addAsk={addAsk}
              takeAddFocus={() => {
                const want = focusAdd.current;
                focusAdd.current = false;
                return want;
              }}
              onAdd={(line) => void addPoint(line)}
              onJump={(id) => onSource(() => jumpToHighlight(id))}
              onAsk={() => setAsk((n) => n + 1)}
              actions={highlightActions}
              questions={
                <QuestionsPanel
                  item={doc.id}
                  skills={doc.skills.map((s) => ({ id: s, name: p.skills.find((k) => k.id === s)?.name ?? s }))}
                  quote={sideQuote}
                  onClearQuote={() => setSideQuote(null)}
                  onJumpQuote={(m) => onSource(() => jumpToQuote(m))}
                  onJumpHighlight={(id) => onSource(() => jumpToHighlight(id))}
                  notify={p.notify}
                  ask={ask}
                  marked={`${filed}|${anns.filter((a) => a.intent === "question").map((a) => a.id).join()}`}
                />
              }
            />
          )}
        </SidePanel>
      )}
      {p.finishing ? (
        <Finish
          doc={doc}
          skills={p.skills}
          reached={Number(load(`ore.reached.${p.id}`)) || undefined}
          blocked={p.blocked}
          setReveal={setReveal}
          keyPoint={passage ? { on: passageKey, toggle: keyPassage } : undefined}
          onCancel={() => {
            p.setFinishing(false);
            scrollRef.current?.focus({ preventScroll: true });
          }}
          onDone={p.onDone}
          nextLesson={nextUp && { title: nextUp.title, open: () => (p.onChanged(), p.onOpenLesson(nextUp.id)) }}
          notify={p.notify}
          flushNotes={notes.flush}
          onNotes={notes.apply}
        />
      ) : null}
      {zoom && <FigureZoom fig={zoom} item={doc?.id ?? ""} notify={p.notify} onClose={() => setZoom(null)} />}
    </div>
  );
}

/** Eleven Reader's pill: shown while he has scrolled away from the spoken text, pointing to it. */
function BackToCurrent({ dir, onClick }: { dir: "up" | "down"; onClick: () => void }) {
  return (
    <button className={`back-current ${dir}`} onClick={onClick}>
      {dir === "up" ? <CaretUp size={12} aria-hidden="true" /> : <CaretDown size={12} aria-hidden="true" />}
      Back to current
    </button>
  );
}

/** Prequestion guesses typed but not yet stored, by source and question: leaving the source keeps them for when
 *  he comes back (Enter still stores one). */
const preqDrafts = new Map<string, string>();

/** "What do you already know?" — short attempts before reading, stored and never scored (D18). Question rows; the one
 *  you are on opens an answer line, Enter stores it and opens the next unanswered one. */
function Prequestions({ doc, waiting, onRetry, notify }: { doc: Doc; waiting: boolean; onRetry?: () => void; notify: Notify }) {
  const qs = doc.prequestions ?? [];
  const draftKey = (i: number) => `${doc.id}\n${qs[i]?.q}`;
  const [vals, setVals] = useState(() => qs.map((q, i) => preqDrafts.get(draftKey(i)) ?? q.before ?? ""));
  const [saved, setSaved] = useState(() => qs.map((q) => q.before ?? ""));
  // One answer line open at a time (Perplexity "Related"): the rest stay visible as things to read for.
  // Coming back with a guess he hadn't stored opens its line again.
  const [at, setAt] = useState(() => {
    const kept = qs.findIndex((_, i) => preqDrafts.has(draftKey(i)));
    return kept >= 0 ? kept : qs.findIndex((q) => !q.before);
  });
  const edit = (i: number, text: string) => {
    setVals((v) => v.map((x, j) => (j === i ? text : x)));
    if (text === (saved[i] ?? "")) preqDrafts.delete(draftKey(i));
    else preqDrafts.set(draftKey(i), text);
  };
  const rows = useRef<(HTMLButtonElement | null)[]>([]);
  // The answer line takes focus only when he opened it (click, or Enter on the one before), never on page load,
  // so the reader's single-key shortcuts keep working.
  const focusLine = useRef(false);
  // Open while they can still do their work: before he starts reading. Once he has highlighted or is reading,
  // the block folds to its one line so the text comes first; one click opens it again.
  const [open, setOpen] = useState(() => qs.some((_, i) => preqDrafts.has(draftKey(i))) || (qs.some((q) => !q.before) && doc.status !== "reading" && !doc.annotations?.length));
  // The row he just answered plays a short check-in, so the move from typing to answered reads as done.
  const [just, setJust] = useState(-1);
  if (!qs.length && !waiting && !onRetry) return null;
  // Once read, unanswered prequestions are moot (they work before reading); answered ones stay to compare.
  if (doc.status === "done" && !qs.some((q) => q.before)) return null;
  if (!qs.length && onRetry)
    return (
      <section className="preq">
        <div className="preq-head failed">
          What do you already know?
          {/* Added with no enrich on its way: nothing failed, they just aren't written yet. */}
          <span className="quiet">{doc.enrich_skipped ? "No prequestions yet" : "Couldn’t write prequestions"}</span>
          <button className="preq-retry" onClick={onRetry}>
            {doc.enrich_skipped ? "Write them" : "Try again"}
          </button>
        </div>
        {doc.enrich_error && <p className="preq-why">{doc.enrich_error}</p>}
      </section>
    );

  // Saved at once so the row turns answered (check + his guess) the moment he moves on; rolled back if it fails.
  const keep = (i: number, text: string) => {
    const t = text.trim();
    if (t) preqDrafts.delete(draftKey(i));
    if (!t || t === saved[i]) return !!t;
    const was = saved[i] ?? "";
    setVals((v) => v.map((x, j) => (j === i ? t : x)));
    setSaved((v) => v.map((x, j) => (j === i ? t : x)));
    setJust(i);
    ore("prequestion", doc.id, String(i + 1), "--before", t).catch((e) => {
      setSaved((v) => v.map((x, j) => (j === i ? was : x)));
      preqDrafts.set(draftKey(i), t);
      notify(errorText(e), "error");
    });
    return true;
  };
  const store = (i: number, text: string) => {
    if (!keep(i, text)) return;
    const next = qs.findIndex((_, j) => j > i && !vals[j]);
    focusLine.current = next >= 0;
    setAt(next);
    if (next < 0) rows.current[i]?.focus();
  };
  const close = (i: number) => {
    edit(i, saved[i] ?? "");
    setAt(-1);
    rows.current[i]?.focus();
  };

  return (
    <section className="preq">
      <button className="preq-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <CaretRight className={`caret${open ? " open" : ""}`} size={12} aria-hidden="true" />
        What do you already know?
        {waiting && <span className="quiet"><Working stage="write" label="Writing prequestions…" slow="Usually under a minute." /></span>}
      </button>
      {open && qs.length > 0 && (
        <ol className="preq-body">
          {qs.map((q, i) => {
            const done = !!saved[i];
            return (
              <li key={i} className={`preq-row${at === i ? " open" : ""}${done ? " done" : ""}${just === i ? " just" : ""}`}>
                <button
                  ref={(el) => {
                    rows.current[i] = el;
                  }}
                  className="preq-q"
                  aria-expanded={at === i}
                  onClick={(e) => {
                    if (at === i) return (e.currentTarget.nextElementSibling as HTMLElement | null)?.focus();
                    // Moving to another question keeps the guess he typed here, like Enter does.
                    if (at >= 0) keep(at, vals[at] ?? "");
                    focusLine.current = true;
                    setAt(i);
                  }}
                >
                  {done ? <Check className="preq-icon" size={16} weight="bold" aria-label="Answered" /> : <PixelQuestion className="preq-icon" size={12} aria-hidden="true" />}
                  <span className="preq-text">{q.q}</span>
                  {done && at !== i && <span className="preq-said">{saved[i]}</span>}
                </button>
                {at === i && (
                  <Grow
                    ref={(el) => {
                      if (el && focusLine.current) {
                        focusLine.current = false;
                        el.focus();
                      }
                    }}
                    className="field preq-input"
                    value={vals[i] ?? ""}
                    placeholder="Your best guess, or ? for no idea"
                    aria-label={q.q}
                    onChange={(e) => edit(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "?" && !vals[i]) {
                        e.preventDefault();
                        store(i, "no idea");
                      } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        store(i, vals[i] ?? "");
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        close(i);
                      }
                    }}
                  />
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** Where a lesson sits in its course (D79), above its title: the course's name opens its lessons to
 *  jump to one, and ‹ › go to the previous and next lesson. */
function CourseLine({ id, course, lessons, onOpen }: { id: string; course: NonNullable<Item["course"]>; lessons: Item[]; onOpen: (id: string) => void }) {
  const at = lessons.findIndex((l) => l.id === id);
  const prev = lessons[at - 1];
  const next = lessons[at + 1];
  return (
    <div className="course-line">
      <DropdownMenu.Root modal={false}>
        <Hint text="Lessons in this course">
          <DropdownMenu.Trigger asChild>
            <button className="course-name">
              <span>{course.title}</span>
              <CaretDown size={10} weight="bold" aria-hidden="true" />
            </button>
          </DropdownMenu.Trigger>
        </Hint>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="popover menu-list course-lessons" align="start" sideOffset={4} collisionPadding={8}>
            {lessons.map((l) => (
              <DropdownMenu.Item key={l.id} className={`menu-item${l.id === id ? " here" : ""}`} onSelect={() => l.id !== id && onOpen(l.id)}>
                <span className="part">{l.course!.part}</span>
                <span className="menu-label">{l.title}</span>
                {l.status === "done" && <Check size={11} weight="bold" aria-label="Done" />}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <span className="course-at">
        Lesson {course.part} of {lessons.length}
      </span>
      <span className="course-step">
        <Hint text={prev ? `Previous: ${prev.title}` : "First lesson"} keys="lesson-prev">
          <button aria-label="Previous lesson" disabled={!prev} onClick={() => prev && onOpen(prev.id)}>
            <CaretLeft size={13} weight="bold" aria-hidden="true" />
          </button>
        </Hint>
        <Hint text={next ? `Next: ${next.title}` : "Last lesson"} keys="lesson-next">
          <button aria-label="Next lesson" disabled={!next} onClick={() => next && onOpen(next.id)}>
            <CaretRight size={13} weight="bold" aria-hidden="true" />
          </button>
        </Hint>
      </span>
    </div>
  );
}
