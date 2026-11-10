/** Where the mouse let go, in the window, and whether he dragged upward (the selection runs backward). */
export type Aim = { x?: number; y?: number; up?: boolean };
type Box = { top: number; bottom: number; left: number; width: number };

/** Where the highlight popup opens, in window coordinates (D112), as Hypothesis's adder does: where the
 *  selection ended. Under the last line, centred on where the mouse let go, so the types are a short move
 *  away; above the first line after an upward drag. It never covers the passage: with no room on that
 *  side it goes to the other side, and a passage taller than the view gets it just under the pointer. */
// Clear of the passage by more than the knobs of its dragged edges (Grab.tsx), which stand 9px off it.
const GAP = 14;

export function popupPlace(first: Box, last: Box, view: { top: number; bottom: number }, height: number, aim: Aim = {}) {
  const room = height + 2 * GAP;
  const fitsBelow = last.bottom + room <= view.bottom;
  const fitsAbove = first.top - room >= view.top;
  const below = aim.up ? !fitsAbove && fitsBelow : fitsBelow || !fitsAbove;
  const pinned = !fitsBelow && !fitsAbove && aim.y !== undefined;
  const y = pinned ? aim.y! + 14 : below ? last.bottom + GAP : first.top - GAP;
  const near = below ? last : first;
  return { y, x: aim.x ?? near.left + near.width / 2, below: pinned || below };
}

export type Side = "below" | "above";

/** Where a menu opened at the caret goes (the note's / and [[ menus), in window coordinates, as Notion's
 *  does: under the line when it fits, above it when it doesn't, and with no room for the whole list on
 *  either side, on the roomier one with its height capped to that room (the list scrolls). It stays on
 *  the side it opened on (`was`) while it still fits there, so typing to narrow the list doesn't make
 *  it jump; it never runs past the window's edges. */
const MARGIN = 8;
const MENU_GAP = 4;

export function menuPlace(at: { left: number; top: number; bottom: number }, size: { width: number; height: number }, view: { width: number; height: number }, was?: Side) {
  // A caret scrolled out of the window (it shrank under him) counts as at its edge.
  const caret = { left: at.left, top: Math.min(Math.max(at.top, 0), view.height), bottom: Math.min(Math.max(at.bottom, 0), view.height) };
  const room = { below: view.height - MARGIN - (caret.bottom + MENU_GAP), above: caret.top - MENU_GAP - MARGIN };
  const fits = (s: Side) => size.height <= room[s];
  const side: Side = was && fits(was) ? was : fits("below") ? "below" : fits("above") ? "above" : room.above > room.below ? "above" : "below";
  const maxHeight = Math.max(0, room[side]);
  const top = side === "below" ? caret.bottom + MENU_GAP : caret.top - MENU_GAP - Math.min(size.height, maxHeight);
  return { left: clampX(caret.left, size.width, view.width), top, maxHeight, side };
}

/** A left edge that keeps something this wide inside the window, `MARGIN` from either side. */
export function clampX(left: number, width: number, viewWidth: number) {
  return Math.max(MARGIN, Math.min(left, viewWidth - MARGIN - width));
}
