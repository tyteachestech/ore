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
