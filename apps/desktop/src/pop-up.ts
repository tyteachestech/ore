/** How far a pop-up's list moves so its ticked row sits over the button, as a Mac pop-up button opens
 *  (D282); kept 8px inside the window at both ends. */
export function popUpShift(m: { triggerTop: number; triggerHeight: number; listTop: number; rowTop: number; rowHeight: number; listHeight?: number; viewport?: number }) {
  const shift = m.triggerTop + m.triggerHeight / 2 - (m.rowTop + m.rowHeight / 2);
  const down = m.listHeight !== undefined && m.viewport !== undefined ? m.viewport - 8 - (m.listTop + m.listHeight) : Infinity;
  return Math.round(Math.max(Math.min(shift, down), 8 - m.listTop));
}
