import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { resizeDrag } from "./drag";
import { load, save } from "./util";

/** A dragged panel's width in a window `vw` wide: at least `min`, at most `share` of the window and
 *  never past `cap` (D44); in a window too small for both, `min` wins. */
export function clampSide(w: number, vw: number, { min, share = 0.6, cap = Infinity }: { min: number; share?: number; cap?: number }) {
  return Math.round(Math.max(min, Math.min(w, vw * share, cap)));
}

const clampSplit =(f: number) => Math.min(0.7, Math.max(0.3, f));

/** The share of the width the right column takes: `initial` by default, dragged between 30% and 70% by
 *  the bar between the columns, remembered under `key`; double-click puts it back. */
export function useSplit(key: string, initial = 0.5) {
  const [side, setSide] = useState(() => {
    const f = Number(load(key));
    return Number.isFinite(f) && f > 0 ? clampSplit(f) : initial;
  });
  const [dragging, setDragging] = useState(false);
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const box = e.currentTarget.parentElement!.getBoundingClientRect();
    const before = side;
    let f = side;
    setDragging(true);
    resizeDrag(e, {
      move: (m) => setSide((f = clampSplit((box.right - m.clientX) / box.width))),
      end: (ev) => {
        setDragging(false);
        if (ev) save(key, String(f));
        else setSide(before);
      },
    });
  };
  const onDoubleClick = () => {
    setSide(initial);
    save(key, String(initial));
  };
  return { side, dragging, divider: { onPointerDown, onDoubleClick } };
}
