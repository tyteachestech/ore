import { PixelNote, PixelPage, PixelStack } from "./PixelIcon";
import { resizeDrag } from "./drag";
import { clampSide } from "./split";
import * as Tabs from "@radix-ui/react-tabs";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { NoteEditor, type LinkTarget, type NoteEditorHandle } from "./editor/NoteEditor";
import { Hint } from "./Hint";
import { usePeek } from "./Peek";
import { ore, opt, oreWith, type Backlink, type Notes } from "./ore";
import { errorText, load, save, type Notify } from "./util";

/** Which note: a source note (D31) or a skill note (D41). */
type NoteRef = { item: string } | { skill: string };
const args = (ref: NoteRef) => ("item" in ref ? [ref.item] : [opt("skill", ref.skill)]);

type MyNotes = {
  /** notes.md as edited here; null until loaded (or when loading failed). */
  text: string | null;
  /** The note's folder (for images); null until loaded. */
  dir: string | null;
  /** Why the note didn't load; null while loading or once loaded. */
  error: string | null;
  /** Loads the note again after `error`. */
  retry: () => void;
  /** Bumps when text comes from outside the editor (load, recall, append), so it reloads. */
  version: number;
  edit: (text: string) => void;
  /** Writes a pending edit now; false when the save failed (already reported). Every other write
   *  to notes.md waits for it. */
  flush: () => Promise<boolean>;
  /** `ore notes --append` under `heading`; resolves false when it failed (already reported). */
  append: (text: string, heading: string) => Promise<boolean>;
  /** Takes the full text a CLI call returned (recall, chapter recall, append). */
  apply: (text: string) => void;
  /** Picks an image and copies it into images/ beside the note; its relative path, or null. */
  attach: (from?: string | { ext: string; data: string }) => Promise<string | null>;
  /** Reads the open editor's text now; NoteEditor sets it. */
  pull: { current: (() => string | null) | null };
  /** The CLI arguments that name this note (`<item>` or `--skill=<s>`), for `ore diagram`. */
  args: string[];
  notify: Notify;
};

/** Drafts whose save failed, by note, with the text they were edited from: leaving the note keeps
 *  them here, and opening it again shows the draft and saves it, instead of the older text on disk. */
const unsaved = new Map<string, { text: string; base: string }>();

/** One note: loaded with `ore notes`, autosaved with `--set` ~800ms after the last edit, on blur,
 *  and when the view closes. */
export function useNotes(ref: NoteRef, notify: Notify): MyNotes {
  const key = args(ref).join(" ");
  const [text, setText] = useState<string | null>(null);
  const [dir, setDir] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  /** Bumped by Try again: reruns the load below. */
  const [tries, setTries] = useState(0);
  const retry = useCallback(() => (setError(null), setTries((n) => n + 1)), []);
  const draft = useRef<string | null>(null);
  const saved = useRef<string | null>(null);
  /** The text on disk each note's draft was edited from, by note; sent as --base so the CLI merges
   *  outside changes. Kept per note: a save still in flight after he switched notes moves its own
   *  note's base on, so the save queued behind it is based on what it wrote. */
  const bases = useRef(new Map<string, string>());
  const timer = useRef(0);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  /** The note the refs above belong to: a write or load for another note never touches them. */
  const owner = useRef(key);
  /** Reads the open editor's text (NoteEditor sets it). */
  const pull = useRef<(() => string | null) | null>(null);

  /** Runs CLI writes one at a time, in order. */
  const queue = useCallback(<T,>(run: () => Promise<T>): Promise<T> => {
    const next = chain.current.then(run, run);
    chain.current = next.catch(() => {});
    return next;
  }, []);

  const apply = useCallback((t: string) => {
    pull.current = null; // the editor showing the old text is about to be replaced
    draft.current = t;
    saved.current = t;
    bases.current.set(owner.current, t);
    setText(t);
    setVersion((v) => v + 1);
  }, []);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    // The editor reports edits 200 ms after typing stops: read what it shows now, or a switch to
    // another source right after typing drops the last words (or a first line, all of it).
    const now = owner.current === key ? pull.current?.() : null;
    if (now != null && (draft.current !== null || now !== saved.current)) draft.current = now;
    const t = draft.current;
    if (t === null || t === saved.current) return chain.current.then(() => !unsaved.has(key));
    saved.current = t;
    // --base is read when the write runs, after the previous write's result has moved it on (else
    // two saves in flight merge his own first save back in as an outside change and duplicate
    // lines), also when he has switched to another note meanwhile.
    const at = () => bases.current.get(key) ?? "";
    return queue(() => ore<Notes & { merged: boolean }>("notes", ...key.split(" "), opt("set", t), opt("base", at()))).then(
      (r) => {
        unsaved.delete(key);
        // What the editor shows now, as above: a key pressed in its last 200 ms is not in the draft yet, and
        // showing the merged text over it would drop those words.
        const shown = owner.current === key ? pull.current?.() : null;
        if (shown != null && shown !== t) draft.current = shown;
        // An agent or a recall changed the file meanwhile and the CLI merged it in. With no newer
        // typing, show the merged text; otherwise keep his draft and merge again on the next save.
        if (owner.current === key && r.merged && draft.current === t) return apply(r.text), true;
        bases.current.set(key, r.merged ? t : r.text);
        if (owner.current === key && r.merged) saved.current = null;
        return true;
      },
      (e) => {
        if (owner.current === key && saved.current === t) saved.current = null; // retry with the next flush
        unsaved.set(key, { text: t, base: at() });
        notify(`Notes not saved: ${errorText(e)}`, "error");
        return false;
      },
    );
  }, [key, notify, queue]);

  const edit = useCallback(
    (t: string) => {
      draft.current = t;
      setText(t);
      clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), 800);
    },
    [flush],
  );

  const append = useCallback(
    async (t: string, heading: string) => {
      // An append returns the file's text; over a draft that isn't on disk it would replace his words.
      if (!(await flush())) return false;
      try {
        // The file as it is now (not what this editor last based a save on, which a merge can leave behind).
        const before = (await queue(() => ore<Notes>("notes", ...key.split(" "))).catch(() => undefined))?.text;
        const r = await queue(() => ore<Notes>("notes", ...key.split(" "), opt("append", t), opt("heading", heading)));
        if (owner.current === key) apply(r.text);
        // On the history, as every change is. The step writes the file itself (--base keeps what he has typed
        // since) and says so, so whichever copy of the note is open then reads it again.
        const put = (text: string, base: string) => () =>
          ore("notes", ...key.split(" "), opt("set", text), opt("base", base)).then(() => void window.dispatchEvent(new CustomEvent("ore:note-written", { detail: key })));
        // (Only when the text it was added to is known: an undo from a guess would take more than it added.)
        if (before !== undefined) notify(`Added “${heading}” to the note`, "quiet", put(before, r.text), put(r.text, before));
        return true;
      } catch (e) {
        notify(errorText(e), "error");
        return false;
      }
    },
    [apply, flush, key, notify, queue],
  );

  /** Copies an image beside the note: a file's path, a pasted one's bytes (base64), or one he picks. */
  const attach = useCallback(async (from?: string | { ext: string; data: string }) => {
    const picked = from ?? (await openDialog({ multiple: false, directory: false, filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] }] }));
    if (!picked || Array.isArray(picked)) return null;
    try {
      const args = ["notes", ...key.split(" ")];
      return (typeof picked === "string" ? await ore<{ attached: string }>(...args, opt("attach", picked)) : await oreWith<{ attached: string }>(picked.data, ...args, "--attach", "-", opt("ext", picked.ext))).attached;
    } catch (e) {
      notify(errorText(e), "error");
      return null;
    }
  }, [key, notify]);

  useEffect(() => {
    let live = true;
    // Another note: drop the last one's draft (its cleanup already saved it), or it would show
    // here, never load this one's text, and be written into this note on the next edit.
    if (owner.current !== key) {
      owner.current = key;
      draft.current = saved.current = null;
      setText(null);
      setDir(null);
      setError(null);
    }
    // Loaded behind the writes still queued (his last saves of this note, made before he switched
    // away and back), or it shows the text from before them and his next save drops them.
    queue(() => ore<Notes>("notes", ...key.split(" "))).then(
      (r) => {
        if (!live) return;
        setDir(r.dir);
        const kept = unsaved.get(key);
        if (draft.current !== null) return;
        if (!kept) return apply(r.text);
        // His last save of this note failed: show that draft and try it again.
        apply(kept.text);
        bases.current.set(key, kept.base);
        saved.current = null;
        void flush();
      },
      (e) => live && setError(`Couldn’t open this note: ${errorText(e)}`),
    );
    // A diagram linked into this note's file after its editor closed (Diagram.tsx): show the file as it
    // is now, unless he has typed since his last save (that save merges it in).
    const written = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== key) return;
      void flush().then((ok) => ok && queue(() => ore<Notes>("notes", ...key.split(" "))).then((r) => live && draft.current === saved.current && apply(r.text), () => {}));
    };
    window.addEventListener("ore:note-written", written);
    // Leaving (or quitting) writes what is pending; the CLI call outlives this view.
    const leave = () => void flush();
    window.addEventListener("beforeunload", leave);
    return () => {
      live = false;
      window.removeEventListener("ore:note-written", written);
      window.removeEventListener("beforeunload", leave);
      leave();
    };
  }, [key, tries, apply, flush, notify, queue]);

  return useMemo(
    () => ({ text, dir, error, retry, version, edit, flush, append, apply, attach, pull, args: key.split(" "), notify }),
    [text, dir, error, retry, version, edit, flush, append, apply, attach, key, notify],
  );
}

/** The source note (D31) for one source. */
export const useSourceNote = (id: string, notify: Notify) => useNotes(useMemo(() => ({ item: id }), [id]), notify);

type EditorProps = {
  notes: MyNotes;
  editorRef: RefObject<NoteEditorHandle | null>;
  targets: LinkTarget[];
  onOpen: (t: Omit<LinkTarget, "title">) => void;
  placeholder: string;
  /** What VoiceOver calls the note ("Source note", "Skill note"). */
  label: string;
  /** Keeps the caret for when this note opens again (NoteEditor's `place`). */
  place?: string;
};

/** The block editor over a loaded note; reloads when text arrives from outside it. */
export function NoteBody({ notes, editorRef, targets, onOpen, placeholder, label, place }: EditorProps) {
  if (notes.error)
    return (
      <div className="empty-state err" role="alert">
        <p>{notes.error}</p>
        <button className="pill-btn" onClick={notes.retry}>
          Try again
        </button>
      </div>
    );
  if (notes.text === null || notes.dir === null) return <div className="note-editor" />;
  return (
    <NoteEditor
      key={notes.version}
      ref={editorRef}
      text={notes.text}
      dir={notes.dir}
      onChange={notes.edit}
      onBlur={() => void notes.flush()}
      pull={notes.pull}
      targets={targets}
      onOpen={onOpen}
      onAttach={notes.attach}
      noteArgs={notes.args}
      notify={notes.notify}
      placeholder={placeholder}
      label={label}
      place={place}
    />
  );
}

/** "Linked from" (D39): lines in other notes that link to this source or skill. */
export function LinkedFrom({ target, onOpen }: { target: NoteRef; onOpen: (t: Omit<LinkTarget, "title">) => void }) {
  const [links, setLinks] = useState<Backlink[]>([]);
  const peek = usePeek(onOpen);
  const key = args(target).join(" ");
  useEffect(() => {
    let live = true;
    ore<Backlink[]>("backlinks", ...key.split(" ")).then(
      (r) => live && setLinks(r),
      () => live && setLinks([]),
    );
    return () => {
      live = false;
    };
  }, [key]);
  if (!links.length) return null;
  return (
    <section className="linked-from" aria-label="Linked from">
      <h3>Linked from</h3>
      {links.map((l, i) => (
        <button key={i} className="backlink" onClick={() => (peek.close(), onOpen(l.from))} onPointerEnter={(e) => peek.hover(e.currentTarget, l.from)} onPointerLeave={peek.leave}>
          <span className="from">
            {l.from.kind === "skill" ? `${l.from.title} notes` : l.from.title}
            {l.heading && <span className="sub"> › {l.heading}</span>}
          </span>
          <span className="line">{l.line}</span>
        </button>
      ))}
      {peek.view}
    </section>
  );
}

const NOTE_WIDTH = 380;

/** How much wider than its 216 px default the shown sidebar is (0 while hidden). A right-hand panel's max gives
 *  that much back, so the reader column never gets less than it had with the sidebar at 216 (D193). */
let sidebarExtra = 0;
const extraListeners = new Set<() => void>();
const onExtra = (f: () => void) => (extraListeners.add(f), () => void extraListeners.delete(f));
export function setSidebarShown(width: number) {
  const extra = Math.max(0, width - 216);
  if (extra === sidebarExtra) return;
  sidebarExtra = extra;
  for (const f of extraListeners) f();
}

/** A panel's width, dragged on its divider between `min` and `share` of the window (at most `cap`),
 *  remembered under `key`; double-click resets it (D44). A right-hand panel is measured from its right
 *  edge and gives back what a wider sidebar takes; the sidebar (`left`) from the window's left. The width
 *  he chose is kept: a narrow window only clamps what is shown, so it comes back when the window widens. */
export function useSideWidth(key: string, initial: number, min = 280, { left = false, share = 0.6, cap = Infinity } = {}) {
  const [vw, setVw] = useState(() => window.innerWidth);
  const extra = useSyncExternalStore(onExtra, () => (left ? 0 : sidebarExtra));
  const clamp = (w: number) => clampSide(w, vw, { min, share, cap, less: extra });
  const [width, setWidth] = useState(() => {
    const w = Number(load(key));
    return Number.isFinite(w) && w > 0 ? w : initial;
  });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const fit = () => setVw(window.innerWidth);
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const right = e.currentTarget.parentElement!.getBoundingClientRect().right;
    const before = width;
    let w = width;
    setDragging(true);
    resizeDrag(e, {
      move: (m) => setWidth((w = clamp(left ? m.clientX : right - m.clientX))),
      end: (ev) => {
        setDragging(false);
        if (ev) save(key, String(w));
        else setWidth(before);
      },
    });
  };
  const onDoubleClick = () => {
    setWidth(initial);
    save(key, String(initial));
  };
  return { width: clamp(width), dragging, divider: { onPointerDown, onDoubleClick } };
}

/** The source note (D31, D44) as the right half of a split screen: the divider drags to resize,
 *  double-click resets it, and the width is remembered. His writing only (D34.2). */
export type SideTab = "note" | "questions" | "original";

/** The reader's right panel: one panel, two tabs (D75), like Notion's side peek. N opens the source
 *  note, C what he collected (Q too, at his questions); the same key again closes the panel. The toggle at the
 *  window's top right (⌥⌘S) shows or hides it. Resizable, width remembered. */
export function SidePanel({ tab, onTab, original, bodyRef, onBodyMouseDown, children }: { tab: SideTab; onTab: (t: SideTab) => void; /** The source is a PDF: its own pages get a tab (D202). */ original?: boolean; bodyRef?: RefObject<HTMLDivElement | null>; onBodyMouseDown?: (e: ReactMouseEvent) => void; children: ReactNode }) {
  const { width, dragging, divider } = useSideWidth("ore.notewidth", NOTE_WIDTH);
  return (
    <aside className={`mynotes${dragging ? " dragging" : ""}`} aria-label={tab === "note" ? "Source note" : tab === "original" ? "Original" : "Collected"} style={{ width }}>
      <Hint text="Drag to resize · double-click to reset" side="left">
        <div
          className="divider"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize the side panel"
          {...divider}
        />
      </Hint>
      <Tabs.Root value={tab} onValueChange={(v) => onTab(v as SideTab)} className="side-tabs-root">
        <div className="mynotes-head">
          <Tabs.List className="side-tabs" aria-label="Side panel">
            <Hint text="Source note" keys="notes">
              <Tabs.Trigger value="note" data-tone="note"><PixelNote className="card-icon" size={12} aria-hidden="true" />Source note</Tabs.Trigger>
            </Hint>
            <Hint text="Your highlights, key points and questions from this source" keys="collected">
              <Tabs.Trigger value="questions" data-tone="read"><PixelStack className="card-icon" size={12} aria-hidden="true" />Collected</Tabs.Trigger>
            </Hint>
            {original && (
              <Hint text="The PDF’s own page, beside the text you are reading">
                <Tabs.Trigger value="original"><PixelPage className="card-icon" size={12} aria-hidden="true" />Original</Tabs.Trigger>
              </Hint>
            )}
          </Tabs.List>
        </div>
        <Tabs.Content ref={bodyRef} value={tab} className="mynotes-text" tabIndex={-1} onMouseDown={onBodyMouseDown}>
          {children}
        </Tabs.Content>
      </Tabs.Root>
    </aside>
  );
}

/** The source note tab: his note on this source, then what links to it. It keeps where it was scrolled and its
 *  caret, by source, for coming back from Collected, the docked tutor or another source (and a relaunch, for the scroll). */
export function SourceNoteBody({ id, notes, editorRef, targets, onOpen, tail, scroller }: Omit<EditorProps, "placeholder" | "label" | "place"> & { id: string; tail?: ReactNode; scroller: RefObject<HTMLDivElement | null> }) {
  const target = useMemo(() => ({ item: id }), [id]);
  const key = `ore.sourcenote.scroll.${id}`;
  const loaded = notes.text !== null;
  /** True until the saved place is put back: scrolls before then (the panel changing what it holds) aren't his. */
  const restoring = useRef(true);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    restoring.current = true;
    const keep = () => !restoring.current && save(key, String(Math.round(el.scrollTop)));
    el.addEventListener("scroll", keep);
    return () => el.removeEventListener("scroll", keep);
  }, [key, scroller]);
  useEffect(() => {
    const el = scroller.current;
    if (!loaded || !el) return;
    const want = Number(load(key) ?? 0) || 0;
    // The editor lays out over a few frames: set it until the panel is tall enough to hold it.
    let n = 0;
    let raf = 0;
    const stop = () => void (restoring.current = false);
    const put = () => {
      el.scrollTop = want;
      if (Math.abs(el.scrollTop - want) > 1 && ++n < 60) raf = requestAnimationFrame(put);
      else raf = requestAnimationFrame(stop);
    };
    // He scrolls first: his place wins.
    const mine = () => (cancelAnimationFrame(raf), stop());
    el.addEventListener("wheel", mine, { once: true });
    put();
    return () => (cancelAnimationFrame(raf), el.removeEventListener("wheel", mine));
  }, [loaded, key, scroller]);
  return (
    <>
      <NoteBody notes={notes} editorRef={editorRef} targets={targets} onOpen={onOpen} place={`item:${id}`} label="Source note" placeholder="The big idea, and what it connects to… / for blocks, [[ to link." />
      {tail}
      <LinkedFrom target={target} onOpen={onOpen} />
    </>
  );
}

/** A press on a note's empty space, below or beside the text, puts the caret at the note's end (Notion): the whole
 *  panel is the note, not just its first line. Presses on the text, a link or a control are left to them. */
export const clickBelow = (editorRef: RefObject<NoteEditorHandle | null>) => (e: ReactMouseEvent) => {
  const t = e.target as HTMLElement;
  if (e.button !== 0 || !(t === e.currentTarget || t.classList.contains("note-editor"))) return;
  e.preventDefault();
  e.stopPropagation(); // the skill note's card sits in its column, and both listen
  editorRef.current?.focusEnd();
};
