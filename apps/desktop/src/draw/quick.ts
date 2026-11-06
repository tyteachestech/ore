// Where the diagram's style controls live (Settings › Diagrams): the picker at the pointer (S, the
// default) or the panel at the canvas's left edge, always shown while something is picked.
import { useSyncExternalStore } from "react";
import { load, save } from "../util";

export type StyleControls = "pointer" | "panel";
export const STYLE_CONTROLS: { id: StyleControls; label: string }[] = [
  { id: "pointer", label: "At the pointer" },
  { id: "panel", label: "Always shown" },
];
const KEY = "ore.diagram.style";
const subs = new Set<() => void>();

export const styleControls = (): StyleControls => (load(KEY) === "panel" ? "panel" : "pointer");
export function setStyleControls(v: StyleControls) {
  save(KEY, v);
  subs.forEach((f) => f());
}
export const useStyleControls = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    styleControls,
    styleControls,
  );

type Rect = { x: number; y: number; w: number; h: number };
const GAP = 16;
const EDGE = 8;

/** Where the picker goes: up and to the right of the pointer, as a hand holds a palette, flipped where
 *  the canvas ends, and never over what it styles (the highlight popup's rule, D112). Pixels in the
 *  editor's own box; `origin` is the corner it grows from. */
export function placeQuick(at: { x: number; y: number }, avoid: Rect | null, size: { w: number; h: number }, area: { w: number; h: number }): { left: number; top: number; origin: string } {
  const fitsX = (x: number) => x >= EDGE && x + size.w <= area.w - EDGE;
  const clampY = (y: number) => Math.max(EDGE, Math.min(area.h - size.h - EDGE, y));
  const clampX = (x: number) => Math.max(EDGE, Math.min(area.w - size.w - EDGE, x));
  const above = at.y - GAP - size.h >= EDGE;
  let top = clampY(above ? at.y - GAP - size.h : at.y + GAP);
  let left = fitsX(at.x + GAP) ? at.x + GAP : at.x - GAP - size.w;
  let right = left > at.x;
  const covers = (l: number, t: number) => !!avoid && l < avoid.x + avoid.w && avoid.x < l + size.w && t < avoid.y + avoid.h && avoid.y < t + size.h;
  if (avoid && covers(clampX(left), top)) {
    // Beside the selection, on the pointer's side first, at the pointer's height; else under or over it.
    const besideR = Math.max(at.x, avoid.x + avoid.w) + GAP;
    const besideL = Math.min(at.x, avoid.x) - GAP - size.w;
    const ty = clampY(at.y - size.h / 2);
    if (fitsX(besideR) && !covers(besideR, ty)) [left, top, right] = [besideR, ty, true];
    else if (fitsX(besideL) && !covers(besideL, ty)) [left, top, right] = [besideL, ty, false];
    else {
      const below = avoid.y + avoid.h + GAP;
      top = below + size.h <= area.h - EDGE ? below : clampY(avoid.y - GAP - size.h);
    }
  }
  left = clampX(left);
  return { left, top, origin: `${right ? "left" : "right"} ${top + size.h / 2 < at.y ? "bottom" : "top"}` };
}
