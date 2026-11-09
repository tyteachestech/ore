// A diagram's preview in the note (D40) as a small board, the way Figma and Miro embeds behave in
// Notion: drag to pan, pinch or ⌘-scroll to zoom at the pointer, a plain scroll still scrolls the note,
// a click without a drag opens the editor. The right and bottom edges resize it (Notion's image
// handles), and the size is kept in the link's alt text, Obsidian's `![Diagram|640x320](…)`.

export type Size = { w: number; h: number };
export type View = { x: number; y: number; z: number };

export const HOME: View = { x: 0, y: 0, z: 1 };
const Z = [0.25, 8] as const;
export const MIN: Size = { w: 160, h: 64 };
const MAX_H = 1600;
/** A press that moves less than this is a click, and opens the diagram. */
const SLOP = 4;

/** The size a diagram link's alt text keeps (`Diagram|640x320`), or null for the preview's own size. */
export function sizeOf(alt: string): Size | null {
  const m = alt.match(/\|(\d+)x(\d+)$/);
  return m ? { w: +m[1]!, h: +m[2]! } : null;
}

/** The alt text with `size` in it, or without one (back to the preview's own size). */
export function withSize(alt: string, size: Size | null): string {
  const base = alt.replace(/\|\d+x\d+$/, "") || "Diagram";
  return size ? `${base}|${Math.round(size.w)}x${Math.round(size.h)}` : base;
}

/** A size held to what the note's column can show. */
export const clampSize = (s: Size, maxW: number): Size => ({
  w: Math.round(Math.min(Math.max(s.w, MIN.w), Math.max(maxW, MIN.w))),
  h: Math.round(Math.min(Math.max(s.h, MIN.h), MAX_H)),
});

/** Zooms to `z` keeping the point `d` (from the drawing's current top-left, in screen pixels) under the pointer. */
export function zoomAt(v: View, z: number, dx: number, dy: number): View {
  const to = Math.min(Math.max(z, Z[0]), Z[1]);
  const k = 1 - to / v.z;
  return { x: v.x + dx * k, y: v.y + dy * k, z: to };
}

const moved = (v: View) => v.x !== 0 || v.y !== 0 || v.z !== 1;

/** Wires the board onto the preview `dom`, whose drawing sits in `inner`. `resize` previews a size as the
 *  edge is dragged (null: its own size); `commit` saves it, once, when the drag ends. */
export function board(
  dom: HTMLElement,
  inner: HTMLElement,
  opts: { size: () => Size | null; resize: (s: Size | null) => void; commit: (s: Size | null) => void; fitIcon: string },
) {
  let view = HOME;
  const fit = document.createElement("button");
  fit.className = "note-diagram-fit";
  fit.setAttribute("aria-label", "Show the whole diagram");
  fit.tabIndex = -1;
  fit.innerHTML = opts.fitIcon;
  const set = (v: View) => {
    view = v;
    inner.style.transform = moved(v) ? `translate(${v.x}px, ${v.y}px) scale(${v.z})` : "";
    dom.classList.toggle("moved", moved(v));
  };
  fit.addEventListener("pointerdown", (e) => (e.preventDefault(), e.stopPropagation()));
  fit.addEventListener("click", (e) => {
    e.stopPropagation();
    set(HOME);
  });

  const grips = (["w", "h", "wh"] as const).map((axis) => {
    const g = document.createElement("span");
    g.className = `note-diagram-grip ${axis}`;
    g.setAttribute("aria-hidden", "true");
    g.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const r = dom.getBoundingClientRect();
      const col = (dom.parentElement?.getBoundingClientRect().right ?? r.right) - r.left;
      const start = { x: e.clientX, y: e.clientY, w: r.width, h: r.height };
      let size: Size | null = null;
      g.setPointerCapture(e.pointerId);
      dom.classList.add("resizing");
      const move = (m: PointerEvent) => {
        size = clampSize({ w: axis === "h" ? start.w : start.w + m.clientX - start.x, h: axis === "w" ? start.h : start.h + m.clientY - start.y }, col);
        opts.resize(size);
      };
      const up = () => {
        g.removeEventListener("pointermove", move);
        g.removeEventListener("pointerup", up);
        g.removeEventListener("pointercancel", up);
        dom.classList.remove("resizing");
        if (size) opts.commit(size);
      };
      g.addEventListener("pointermove", move);
      g.addEventListener("pointerup", up);
      g.addEventListener("pointercancel", up);
    });
    // Double-click an edge: back to the preview's own size (Figma's double-click on a handle).
    g.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      if (opts.size()) opts.commit(null);
    });
    g.addEventListener("click", (e) => e.stopPropagation());
    return g;
  });
  dom.append(fit, ...grips);

  // Drag pans (left or middle button); a left press that never moves is a click, which opens it.
  let dragged = false;
  dom.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" || (e.button !== 0 && e.button !== 1)) return;
    // Taken here, the press never reaches the note as a node drag or a text selection.
    e.preventDefault();
    dragged = false;
    const start = { x: e.clientX, y: e.clientY, v: view };
    const move = (m: PointerEvent) => {
      const dx = m.clientX - start.x, dy = m.clientY - start.y;
      if (!dragged && Math.hypot(dx, dy) < SLOP && e.button === 0) return;
      if (!dragged) {
        dragged = true;
        dom.setPointerCapture(e.pointerId);
        dom.classList.add("panning");
      }
      set({ ...start.v, x: start.v.x + dx, y: start.v.y + dy });
    };
    const up = () => {
      dom.removeEventListener("pointermove", move);
      dom.removeEventListener("pointerup", up);
      dom.removeEventListener("pointercancel", up);
      dom.classList.remove("panning");
    };
    dom.addEventListener("pointermove", move);
    dom.addEventListener("pointerup", up);
    dom.addEventListener("pointercancel", up);
  });
  // The click after a pan is the end of the drag, not a request to open it.
  dom.addEventListener("click", (e) => dragged && (e.stopImmediatePropagation(), (dragged = false)), true);
  dom.addEventListener("auxclick", (e) => e.button === 1 && e.preventDefault());

  const at = (cx: number, cy: number) => {
    const r = inner.getBoundingClientRect();
    return [cx - r.left, cy - r.top] as const;
  };
  dom.addEventListener(
    "wheel",
    (e) => {
      if (!e.ctrlKey && !e.metaKey) return; // a plain scroll is the note's
      e.preventDefault();
      set(zoomAt(view, view.z * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), ...at(e.clientX, e.clientY)));
    },
    { passive: false },
  );
  // WebKit sends trackpad pinches as gesture events, not ctrl+wheel.
  let z0 = 1;
  dom.addEventListener("gesturestart", (e) => (e.preventDefault(), (z0 = view.z)));
  dom.addEventListener("gesturechange", (e) => {
    e.preventDefault();
    const g = e as Event & { scale: number; clientX: number; clientY: number };
    set(zoomAt(view, z0 * g.scale, ...at(g.clientX, g.clientY)));
  });
}
