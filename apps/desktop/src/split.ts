import { useState, type PointerEvent as ReactPointerEvent } from "react";
import { load, save } from "./util";

const clampSplit = (f: number) => Math.min(0.7, Math.max(0.3, f));

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
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const box = el.parentElement!.getBoundingClientRect();
    let f = side;
    setDragging(true);
    const move = (m: PointerEvent) => setSide((f = clampSplit((box.right - m.clientX) / box.width)));
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      setDragging(false);
      save(key, String(f));
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
  const onDoubleClick = () => {
    setSide(initial);
    save(key, String(initial));
  };
  return { side, dragging, divider: { onPointerDown, onDoubleClick } };
}
