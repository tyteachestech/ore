// Diagrams in the source note (D40, D103): the in-house editor in an overlay, and the static preview the
// note shows. Loaded only when a note has a diagram or one is being drawn, so it stays out of the main bundle.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Editor from "./draw/Editor";
import { svgMarkup } from "./draw/export";
import { fromScene, toScene, type El } from "./draw/model";
import { Hint } from "./Hint";
import { Collapse, Expand } from "./icons";
import { ore, oreWith, type Diagram } from "./ore";
import { errorText, load, save as remember, type Notify } from "./util";

const FULL = "ore.diagram.full";

export type Scene = NonNullable<Diagram["scene"]>;
type Files = Record<string, { dataURL?: string }>;

/** SVG markup of a saved scene, for the note's preview. */
export function preview(scene: Scene): string {
  return svgMarkup(fromScene(scene as never), (scene.files ?? {}) as Files);
}

/** The editor, over the window or, given `dock` (the reader's side panel), over the panel's sheet so the
 *  source stays readable beside it; ⤢ (⇧⌘↵) swaps the two, remembered. Autosaves through `ore diagram --set` (D30) 1 s after a change;
 *  Esc or Done saves and closes, and `onClose` gets the scene on disk (null when nothing was ever saved). */
export default function DiagramEditor({ args, name, loaded, dock, notify, onClose, onFirstSave, onRenamed, onLink }: {
  args: string[];
  name: string;
  /** The file as the note's preview last read it; saves reading it again on open. */
  loaded?: Diagram;
  /** The side panel to draw in, beside the source. */
  dock?: HTMLElement | null;
  notify: Notify;
  onClose: (scene: Scene | null, name: string) => void;
  /** The first write of a new diagram, so the note links it even if the panel closes before Done. */
  onFirstSave?: (name: string) => void;
  onRenamed?: (from: string, to: string) => void;
  onLink?: (href: string) => void;
}) {
  const [current, setCurrent] = useState(name);
  const nameRef = useRef(name);
  const [failed, setFailed] = useState<string | null>(null);
  const [initial, setInitial] = useState<{ els: El[]; files: Files } | null>(null);
  const onDisk = useRef<Scene | null>(null);
  const latest = useRef<{ els: El[]; files: Files } | null>(null);
  const written = useRef<string>("");
  const timer = useRef(0);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  // The parent's callbacks change identity with its state; read them here so the effects below run once.
  const props = useRef({ notify, onClose, onFirstSave, onRenamed });
  const key = args.join(" ");
  props.current = { notify, onClose, onFirstSave, onRenamed };
  const [full, setFull] = useState(() => !dock || load(FULL) === "1");
  const box = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const docked = !!dock && !full;
  const toggle = useCallback(() => {
    setFull((f) => (remember(FULL, f ? "0" : "1"), !f));
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>(".draw")?.focus());
  }, []);

  // Docked, it sits over the panel's sheet and follows it as the panel is resized; the panel widens
  // to fit the tools while it does. One portal for both places, so the drawing and its undo survive the swap.
  useEffect(() => {
    if (!docked || !dock) return;
    const sheet = (dock.querySelector(".mynotes-text") as HTMLElement | null) ?? dock;
    const measure = () => setRect(sheet.getBoundingClientRect());
    dock.classList.add("drawing");
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(sheet);
    window.addEventListener("resize", measure);
    return () => {
      dock.classList.remove("drawing");
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [docked, dock]);

  useEffect(() => {
    let live = true;
    (loaded ? Promise.resolve(loaded) : ore<Diagram>("diagram", ...args, name)).then(
      (d) => {
        if (!live) return;
        onDisk.current = d.scene;
        const els = fromScene(d.scene as never);
        written.current = d.scene ? JSON.stringify(toScene(els, d.scene as never)) : "";
        setInitial({ els, files: ((d.scene?.files ?? {}) as Files) });
      },
      (e) => {
        props.current.notify(`Diagram: ${errorText(e)}`, "error");
        props.current.onClose(null, nameRef.current);
      },
    );
    return () => void (live = false);
  }, [key, name]);

  /** Writes the drawing if it changed since the last write; one write at a time. A drawing never
   *  saved and still empty is not written, so an abandoned new diagram leaves no file. */
  const save = useCallback((): Promise<Scene | null> => {
    clearTimeout(timer.current);
    const run = async () => {
      const l = latest.current;
      if (!l) return onDisk.current;
      if (!onDisk.current && !l.els.length) return onDisk.current;
      const scene = toScene(l.els, { ...(onDisk.current ?? { type: "excalidraw", elements: [] }), files: { ...((onDisk.current?.files as Files) ?? {}), ...l.files } } as never);
      const json = JSON.stringify(scene);
      if (json === written.current) return onDisk.current;
      await oreWith<Diagram>(json, "diagram", ...args, nameRef.current, "--set");
      if (!onDisk.current) props.current.onFirstSave?.(nameRef.current);
      written.current = json;
      setFailed(null);
      onDisk.current = scene as Scene;
      return onDisk.current;
    };
    const next = chain.current.then(run, run);
    chain.current = next.catch((e) => setFailed(errorText(e)));
    return next;
  }, [key, name]);

  /** Renames the file (once one is saved) and the note's link; the name is a slug, as files are. */
  const rename = useCallback(
    async (raw: string) => {
      const to = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
      const from = nameRef.current;
      if (!to || to === from) return setCurrent(from);
      try {
        await save();
        if (onDisk.current) await ore<Diagram>("diagram", ...args, from, "--rename", to);
        // Nothing saved yet, so only the name changes: never onto a diagram that exists, which the
        // first autosave would overwrite.
        else if ((await ore<Diagram>("diagram", ...args, to)).scene) throw new Error(`a diagram named ${to} already exists`);
        nameRef.current = to;
        setCurrent(to);
        props.current.onRenamed?.(from, to);
      } catch (e) {
        setCurrent(from);
        props.current.notify(`Couldn't rename: ${errorText(e)}`, "error");
      }
    },
    [key, save],
  );

  useEffect(() => () => void save().catch(() => {}), [save]); // leaving some other way (quit, source closed) still saves

  // A second Esc or Done while the save is in flight waits for the same close, so the note gets
  // one link to a new diagram, not two.
  const closing = useRef<Promise<boolean> | null>(null);
  const close = useCallback(
    () =>
      (closing.current ??= save().then(
        (s) => (props.current.onClose(s, nameRef.current), true),
        (e) => {
          closing.current = null;
          props.current.notify(`Diagram not saved: ${errorText(e)}. Press Esc to try again.`, "error");
          return false;
        },
      )),
    [save],
  );

  useEffect(() => {
    const prev = document.activeElement;
    // The editor handles its own keys; stopping them at document keeps the app's window-level keys
    // (palette, finish, Esc back to sources) out while it is open.
    // Docked, keys outside it (reading the source) are the reader's.
    const contain = (e: KeyboardEvent) => {
      if (box.current?.classList.contains("docked") && !box.current.contains(e.target as Node)) return;
      e.stopPropagation();
    };
    document.addEventListener("keydown", contain);
    return () => {
      document.removeEventListener("keydown", contain);
      if (prev instanceof HTMLElement && prev.isConnected) prev.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div
      ref={box}
      className={`diagram${docked ? " docked" : ""}`}
      role="dialog"
      aria-label="Diagram"
      style={docked && rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : undefined}
    >
      <div className="diagram-head">
        {/* Rename in place (Linear's title): Enter saves, Esc or clicking away keeps the old name. */}
        <input
          className="diagram-name"
          value={current}
          aria-label="Diagram name"
          onChange={(e) => setCurrent(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              void rename(current).then(() => (e.target as HTMLInputElement).blur());
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setCurrent(nameRef.current);
              (e.target as HTMLInputElement).blur();
            }
          }}
          onBlur={() => setCurrent(nameRef.current)}
        />
        {failed && (
          <span className="diagram-failed" role="alert">
            Not saved: {failed}
            <button onClick={() => void save().catch(() => {})}>Retry</button>
          </span>
        )}
        {dock && (
          <Hint text={full ? "Back beside the source" : "Full window"} keys="d-expand">
            <button className="diagram-expand" aria-label={full ? "Back beside the source" : "Full window"} onClick={toggle}>
              {full ? <Collapse size={16} aria-hidden="true" /> : <Expand size={16} aria-hidden="true" />}
            </button>
          </Hint>
        )}
        <button className="diagram-done" onClick={() => void close()}>
          Done <kbd>Esc</kbd>
        </button>
      </div>
      <div className="diagram-canvas">
        {initial && (
          <Editor
            initial={initial.els}
            files={initial.files}
            name={name}
            notify={notify}
            onChange={(els, files) => {
              latest.current = { els, files };
              clearTimeout(timer.current);
              timer.current = window.setTimeout(() => void save().catch((e) => props.current.notify(`Diagram not saved: ${errorText(e)}`, "error")), 1000);
            }}
            onDone={() => void close()}
            expand={dock ? { full, toggle } : undefined}
            onLink={(href) => (/^ore:/.test(href) ? void close().then((closed) => closed && onLink?.(href)) : onLink?.(href))}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
