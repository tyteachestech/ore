// Diagrams in the source note (D40, D103): the in-house editor in an overlay, and the static preview the
// note shows. Loaded only when a note has a diagram or one is being drawn, so it stays out of the main bundle.
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createPortal } from "react-dom";
import Editor from "./draw/Editor";
import { svgMarkup } from "./draw/export";
import { fromScene, toScene, type El } from "./draw/model";
import { Hint } from "./Hint";
import { Trap } from "./Trap";
import { Collapse, CornersOut, Expand } from "./icons";
import { ore, oreWith, PHONE, type Diagram } from "./ore";
import { errorText, type Notify } from "./util";

/** Tells the open note (Notes.tsx) its file changed outside its editor; detail is the note's CLI args, joined. */
const NOTE_WRITTEN = "ore:note-written";

export type Scene = NonNullable<Diagram["scene"]>;
type Files = Record<string, { dataURL?: string }>;

/** SVG markup of a saved scene, for the note's preview. */
export function preview(scene: Scene): string {
  return svgMarkup(fromScene(scene as never), (scene.files ?? {}) as Files);
}

/** The note preview's "show the whole diagram" button, the editor's zoom-to-fit icon. */
export const FIT_ICON = renderToStaticMarkup(createElement(CornersOut, { size: 16, "aria-hidden": true }));

/** The editor in a sheet centred over the window (Notion's centre peek), the window's shape with 15% of it
 *  showing on every side so he keeps his place in the app; ⤢ (⇧⌘↵) takes it to the full window and back,
 *  and the phone has only the full window. A click outside, Esc or Done saves and closes. Autosaves through `ore diagram --set` (D30) 1 s after a change;
 *  Esc or Done saves and closes, and `onClose` gets the scene on disk (null when nothing was ever saved). */
export default function DiagramEditor({ args, name, loaded, notify, onClose, onFirstSave, onRenamed, onLink }: {
  args: string[];
  name: string;
  /** The file as the note's preview last read it; saves reading it again on open. */
  loaded?: Diagram;
  notify: Notify;
  onClose: (scene: Scene | null, name: string) => void;
  /** The first write of a new diagram, so the note links it even if the panel closes before Done; false
   *  when the note's editor has gone meanwhile, and the link is written into the note's file instead. */
  onFirstSave?: (name: string) => boolean;
  onRenamed?: (from: string, to: string) => void;
  onLink?: (href: string) => void;
}) {
  const [current, setCurrent] = useState(name);
  const nameRef = useRef(name);
  const [failed, setFailed] = useState<string | null>(null);
  const [initial, setInitial] = useState<{ els: El[]; files: Files } | null>(null);
  const onDisk = useRef<Scene | null>(null);
  /** Whether the note links the file: a new diagram's first save links it, by the open note or its file. */
  const linked = useRef(true);
  const latest = useRef<{ els: El[]; files: Files } | null>(null);
  const written = useRef<string>("");
  const timer = useRef(0);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  // The parent's callbacks change identity with its state; read them here so the effects below run once.
  const props = useRef({ notify, onClose, onFirstSave, onRenamed, close: async () => false as boolean });
  const key = args.join(" ");
  props.current = { ...props.current, notify, onClose, onFirstSave, onRenamed };
  // Each open starts in the sheet, as asked; the full window is a step for this drawing only.
  const [full, setFull] = useState(PHONE);
  const box = useRef<HTMLDivElement>(null);
  const toggle = useCallback(() => {
    setFull((f) => !f);
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>(".draw")?.focus());
  }, []);

  useEffect(() => {
    let live = true;
    (loaded ? Promise.resolve(loaded) : ore<Diagram>("diagram", ...args, name)).then(
      (d) => {
        if (!live) return;
        onDisk.current = d.scene;
        linked.current = !!d.scene;
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
      if (json !== written.current) {
        await oreWith<Diagram>(json, "diagram", ...args, nameRef.current, "--set");
        written.current = json;
        onDisk.current = scene as Scene;
      }
      // A link that failed after its file was written is tried again with the next save.
      if (!linked.current) {
        if (props.current.onFirstSave?.(nameRef.current) === false) {
          await ore("diagram", ...args, nameRef.current, "--link");
          window.dispatchEvent(new CustomEvent(NOTE_WRITTEN, { detail: key }));
        }
        linked.current = true;
      }
      setFailed(null);
      return onDisk.current;
    };
    const next = chain.current.then(run, run);
    chain.current = next.catch((e) => setFailed(errorText(e)));
    return next;
  }, [key, name]);

  /** Renames the file (once one is saved) and the note's link; the name is a slug, as files are. */
  /** Enter or Esc settled the name: the blur they end with saves nothing more. */
  const nameSettled = useRef(false);
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

  // Leaving some other way (quit, source closed, the panel's tab) still saves, and links a new one. If
  // that fails the drawing is kept here, and the toast's Try again saves it.
  useEffect(
    () => () => {
      // The toast stays: for a new diagram the note has no link yet, so it is the only way back to the drawing.
      const retry = (): void =>
        void save().catch((e) => props.current.notify(`Diagram “${nameRef.current}” not saved: ${errorText(e)}`, "error", undefined, undefined, retry, true));
      retry();
    },
    [save],
  );

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
  props.current.close = close;

  useEffect(() => {
    const prev = document.activeElement;
    // The editor handles its own keys; stopping them at document keeps the app's window-level keys
    // (palette, finish, Esc back to sources) out while it is open.
    // Esc on the head's buttons (after a click on ⤢) closes it too, as it does on the canvas.
    const contain = (e: KeyboardEvent) => {
      e.stopPropagation();
      const t = e.target instanceof Element ? e.target : null;
      if (e.key === "Escape" && t?.closest(".diagram-head button:not(.diagram-failed button)")) void props.current.close();
    };
    document.addEventListener("keydown", contain);
    return () => {
      document.removeEventListener("keydown", contain);
      if (prev instanceof HTMLElement && prev.isConnected) prev.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    // The app shows dimmed around the sheet, and a press there closes it, as Settings does.
    <div className={`diagram-scrim${full ? " full" : ""}`} onMouseDown={(e) => e.button === 0 && e.target === e.currentTarget && void close()}>
    <div className="titlebar" data-tauri-drag-region />
    <Trap>
    <div ref={box} className="diagram" role="dialog" aria-modal="true" aria-label="Diagram">
      <div className="diagram-head">
        {/* Rename in place (Linear's title): Enter or clicking away saves (D211), Esc keeps the old name. */}
        <input
          className="diagram-name"
          value={current}
          aria-label="Diagram name"
          onChange={(e) => setCurrent(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              nameSettled.current = true;
              void rename(current).then(() => (e.target as HTMLInputElement).blur());
            }
            if (e.key === "Escape") {
              e.preventDefault();
              nameSettled.current = true;
              setCurrent(nameRef.current);
              (e.target as HTMLInputElement).blur();
            }
          }}
          onFocus={() => (nameSettled.current = false)}
          onBlur={() => (!nameSettled.current && document.hasFocus() && current !== nameRef.current ? void rename(current) : setCurrent(nameRef.current))}
        />
        {failed && (
          <span className="diagram-failed" role="alert">
            Not saved: {failed}
            <button onClick={() => void save().catch(() => {})}>Retry</button>
          </span>
        )}
        {!PHONE && (
          <Hint text={full ? "Exit full window" : "Full window"} keys="d-expand">
            <button className="diagram-expand" aria-label={full ? "Exit full window" : "Full window"} onClick={toggle}>
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
            expand={PHONE ? undefined : { full, toggle }}
            onLink={(href) => (/^ore:/.test(href) ? void close().then((closed) => closed && onLink?.(href)) : onLink?.(href))}
          />
        )}
      </div>
    </div>
    </Trap>
    </div>,
    document.body,
  );
}

/** The phone's diagram (Tyler 2026-11-12: view on the phone, draw on the Mac): the whole drawing on its own
 *  screen, as Photos shows a picture. Pinch zooms, a finger pans once zoomed in, a double tap zooms in on
 *  that spot or back out to fit; Done closes it. Nothing on it edits the file. */
export function DiagramView({ args, name, loaded, onClose }: { args: string[]; name: string; loaded?: Diagram; onClose: () => void }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const art = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // The tap that opened it focused the note: the keyboard and its bar go away while it shows.
    (document.activeElement as HTMLElement | null)?.blur();
    let live = true;
    (loaded ? Promise.resolve(loaded) : ore<Diagram>("diagram", ...args, name)).then(
      (d) => live && setSvg(d.scene && d.scene.elements.length ? preview(d.scene) : ""),
      (e) => live && setFailed(errorText(e)),
    );
    return () => {
      live = false;
    };
  }, [args.join(" "), name]);

  useEffect(() => {
    const el = stage.current;
    const a = art.current;
    if (!el || !a || !svg) return;
    let k = 1, x = 0, y = 0;
    const show = () => (a.style.transform = `translate(${x}px, ${y}px) scale(${k})`);
    // Zoomed out it fits the screen; it never goes past 6 times or smaller than that fit.
    const clamp = () => {
      k = Math.min(6, Math.max(1, k));
      const r = el.getBoundingClientRect();
      const mx = (r.width * (k - 1)) / 2, my = (r.height * (k - 1)) / 2;
      x = Math.min(mx, Math.max(-mx, x));
      y = Math.min(my, Math.max(-my, y));
    };
    /** Zoom to `to` about a point on screen, keeping that point under the finger. */
    const zoomAt = (to: number, cx: number, cy: number) => {
      to = Math.min(6, Math.max(1, to)); // clamped first, so the point under the fingers stays under them at the limits
      const r = el.getBoundingClientRect();
      const px = cx - r.left - r.width / 2, py = cy - r.top - r.height / 2;
      x = px - ((px - x) * to) / k;
      y = py - ((py - y) * to) / k;
      k = to;
      clamp();
    };
    const pts = new Map<number, { x: number; y: number }>();
    let last: { d: number; cx: number; cy: number } | null = null;
    let tapAt = 0;
    /** This touch is still a tap: one finger, short, and hardly moved. A pan or a pinch never arms a double tap. */
    let tap: { x: number; y: number; t: number } | null = null;
    const down = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      tap = pts.size === 1 ? { x: e.clientX, y: e.clientY, t: e.timeStamp } : null;
      last = null;
      a.style.transition = "none";
    };
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const was = { ...p };
      p.x = e.clientX;
      p.y = e.clientY;
      if (tap && Math.hypot(p.x - tap.x, p.y - tap.y) > 10) tap = null;
      if (pts.size === 2) {
        const [m, n] = [...pts.values()] as [{ x: number; y: number }, { x: number; y: number }];
        const now = { d: Math.hypot(m.x - n.x, m.y - n.y), cx: (m.x + n.x) / 2, cy: (m.y + n.y) / 2 };
        if (last) {
          x += now.cx - last.cx;
          y += now.cy - last.cy;
          zoomAt((k * now.d) / last.d, now.cx, now.cy);
        }
        last = now;
      } else if (k > 1) {
        x += p.x - was.x;
        y += p.y - was.y;
        clamp();
      }
      show();
    };
    const up = (e: PointerEvent) => {
      const p = pts.get(e.pointerId);
      pts.delete(e.pointerId);
      last = null;
      if (!p || pts.size) return;
      const now = e.timeStamp;
      const tapped = tap && now - tap.t < 250;
      tap = null;
      if (!tapped) return void (tapAt = 0);
      // A double tap: in to 2.5 times on that spot, or back out to fit (Photos).
      if (now - tapAt < 300) {
        a.style.transition = "transform var(--t-3) var(--ease-out)";
        if (k > 1) [k, x, y] = [1, 0, 0];
        else zoomAt(2.5, e.clientX, e.clientY);
        show();
        tapAt = 0;
      } else tapAt = now;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [svg]);

  return createPortal(
    <Trap>
    <div className="diagram-view" role="dialog" aria-modal="true" aria-label="Diagram">
      <div className="diagram-head">
        <span className="diagram-name">{name}</span>
        <button className="diagram-done" onClick={onClose}>
          Done
        </button>
      </div>
      <div ref={stage} className="diagram-stage">
        {failed ? (
          <p className="diagram-empty">Diagram {name}: {failed}</p>
        ) : svg === "" ? (
          <p className="diagram-empty">Empty diagram. Draw in it on your Mac.</p>
        ) : (
          // Markup the editor drew from the file, text escaped by React (the note's preview does the same).
          svg && <div ref={art} className="diagram-art" dangerouslySetInnerHTML={{ __html: svg }} />
        )}
      </div>
    </div>
    </Trap>,
    document.body,
  );
}
