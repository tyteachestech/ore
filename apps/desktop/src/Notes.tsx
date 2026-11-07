import { PixelNote, PixelStack } from "./PixelIcon";
import * as Tabs from "@radix-ui/react-tabs";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { NoteEditor, type LinkTarget, type NoteEditorHandle } from "./editor/NoteEditor";
import { Hint } from "./Hint";
import { usePeek } from "./Peek";
import { ore, opt, type Backlink, type Notes } from "./ore";
import { errorText, load, save, type Notify } from "./util";

/** Which note: a source note (D31) or a skill note (D41). */
type NoteRef = { item: string } | { skill: string };
const args = (ref: NoteRef) => ("item" in ref ? [ref.item] : [opt("skill", ref.skill)]);

type MyNotes = {
  /** notes.md as edited here; null until loaded (or when loading failed). */
  text: string | null;
  /** The note's folder (for images); null until loaded. */
  dir: string | null;
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
  attach: () => Promise<string | null>;
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
        const r = await queue(() => ore<Notes>("notes", ...key.split(" "), opt("append", t), opt("heading", heading)));
        if (owner.current === key) apply(r.text);
        return true;
      } catch (e) {
        notify(errorText(e), "error");
        return false;
      }
    },
    [apply, flush, key, notify, queue],
  );

  const attach = useCallback(async () => {
    const picked = await openDialog({ multiple: false, directory: false, filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] }] });
    if (typeof picked !== "string") return null;
    try {
      return (await ore<{ attached: string }>("notes", ...key.split(" "), opt("attach", picked))).attached;
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
      (e) => live && notify(`Notes: ${errorText(e)}`, "error"),
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
  }, [key, apply, flush, notify, queue]);

  return useMemo(
    () => ({ text, dir, version, edit, flush, append, apply, attach, pull, args: key.split(" "), notify }),
    [text, dir, version, edit, flush, append, apply, attach, key, notify],
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
};

/** The block editor over a loaded note; reloads when text arrives from outside it. */
export function NoteBody({ notes, editorRef, targets, onOpen, placeholder }: EditorProps) {
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

/** A right-hand panel's width, dragged on its left-edge divider between `min` and 60% of the
 *  window, remembered under `key`; double-click resets it (D44). */
export function useSideWidth(key: string, initial: number, min = 280) {
  const clamp = useCallback((w: number) => Math.round(Math.max(min, Math.min(w, window.innerWidth * 0.6))), [min]);
  const [width, setWidth] = useState(() => {
    const w = Number(load(key));
    return Number.isFinite(w) && w > 0 ? w : initial;
  });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const fit = () => setWidth((w) => Math.min(w, clamp(w)));
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [clamp]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const right = el.parentElement!.getBoundingClientRect().right;
    let w = width;
    setDragging(true);
    const move = (m: PointerEvent) => setWidth((w = clamp(right - m.clientX)));
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      setDragging(false);
      save(key, String(w));
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
  const onDoubleClick = () => {
    setWidth(clamp(initial));
    save(key, String(initial));
  };
  return { width: Math.min(width, clamp(width)), dragging, divider: { onPointerDown, onDoubleClick } };
}

/** The source note (D31, D44) as the right half of a split screen: the divider drags to resize,
 *  double-click resets it, and the width is remembered. His writing only (D34.2). */
export type SideTab = "note" | "questions";

/** The reader's right panel: one panel, two tabs (D75), like Notion's side peek. N opens the source
 *  note, C what he collected (Q too, at his questions); the same key again closes the panel. The toggle at the
 *  window's top right (⌥⌘S) shows or hides it. Resizable, width remembered. */
export function SidePanel({ tab, onTab, children }: { tab: SideTab; onTab: (t: SideTab) => void; children: ReactNode }) {
  const { width, dragging, divider } = useSideWidth("ore.notewidth", NOTE_WIDTH);
  return (
    <aside className={`mynotes${dragging ? " dragging" : ""}`} aria-label={tab === "note" ? "Source note" : "Collected"} style={{ width }}>
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
            <Hint text="Your cards, questions and keeps from this source" keys="collected">
              <Tabs.Trigger value="questions" data-tone="read"><PixelStack className="card-icon" size={12} aria-hidden="true" />Collected</Tabs.Trigger>
            </Hint>
          </Tabs.List>
        </div>
        <Tabs.Content value={tab} className="mynotes-text" tabIndex={-1}>
          {children}
        </Tabs.Content>
      </Tabs.Root>
    </aside>
  );
}

/** The source note tab: his note on this source, then what links to it. */
export function SourceNoteBody({ id, notes, editorRef, targets, onOpen, tail }: Omit<EditorProps, "placeholder"> & { id: string; tail?: ReactNode }) {
  const target = useMemo(() => ({ item: id }), [id]);
  return (
    <>
      <NoteBody notes={notes} editorRef={editorRef} targets={targets} onOpen={onOpen} placeholder="The big idea, and what it connects to… / for blocks, [[ to link." />
      {tail}
      <LinkedFrom target={target} onOpen={onOpen} />
    </>
  );
}
