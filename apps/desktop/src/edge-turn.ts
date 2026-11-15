/** A highlight carried past the screen's edge (Books, Kindle): a selection or a highlight's edge held at the
 *  bottom of the text for a moment turns to the next screen of it, and at the top to the one before, so a
 *  passage that runs on past the page is kept whole. It waits first, so one that only ends on the last line
 *  stays put; each further wait turns again. The turn glides over --t-4, at once under Reduce Motion, and
 *  `extend` follows it, so the selection reaches the words now under the pointer. */

/** How long the edge rests at the screen's edge before it turns. */
export const HOLD = 700;
/** How close to the edge it must be, in px. */
export const EDGE = 36;
/** What a turn leaves on screen of the last one, in px: two lines, as Page Down does. */
const KEEP = 56;

export type Band = { top: number; bottom: number };

/** Which way a point at height `y` turns: 1 at the bottom of the band, -1 at its top, 0 elsewhere (and off it,
 *  where the Mac's own drag scrolling takes over, as it does in the last 20px by the window's edge). */
export function edgeDir(y: number, band: Band, edge = EDGE): 1 | -1 | 0 {
  if (y > band.bottom || y < band.top) return 0;
  if (y >= band.bottom - edge) return 1;
  if (y <= band.top + edge) return -1;
  return 0;
}

/** How far a turn scrolls: a screen less what it keeps, no further than the text goes. */
export function turnBy(dir: 1 | -1, el: { scrollTop: number; scrollHeight: number; clientHeight: number }): number {
  const page = Math.max(el.clientHeight - KEEP, el.clientHeight / 2);
  const room = dir > 0 ? el.scrollHeight - el.clientHeight - el.scrollTop : el.scrollTop;
  return dir * Math.max(0, Math.min(page, room));
}

const still = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const token = () => (typeof getComputedStyle === "function" && parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--t-4"))) || 300;
/** --ease-in-out (DESIGN.md "Motion"): the page is already on screen, moving. */
const ease = (t: number) => {
  // cubic-bezier(0.77, 0, 0.175, 1), solved for x by bisection.
  const bez = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 20; i++) {
    const m = (lo + hi) / 2;
    if (bez(0.77, 0.175, m) < t) lo = m;
    else hi = m;
  }
  return bez(0, 1, (lo + hi) / 2);
};

export type EdgeTurn = {
  /** Where the moving edge is now, on screen; `only` keeps it to one way (a selection's end turns on, its start back). */
  aim: (x: number, y: number, only?: 1 | -1) => void;
  /** The drag ended: no turn waits or runs. */
  stop: () => void;
};

export function edgeTurn(o: {
  scroller: HTMLElement;
  /** The part of the scroller the text shows in, on screen (default: all of it). */
  band?: () => Band;
  /** The page moved under the held point: carry the selection to the words now there. */
  extend: (x: number, y: number) => void;
  /** How close to the band's edge a point turns it (a finger needs more room than the pointer). */
  edge?: number;
}): EdgeTurn {
  let at: { x: number; y: number } | null = null;
  let dir: 1 | -1 | 0 = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let frame = 0;
  const band = () => o.band?.() ?? o.scroller.getBoundingClientRect();
  /** Where the page stood as the wait began: one that scrolled meanwhile (the Mac's own drag scrolling, in the
   *  last 20px by the window's edge, or iOS's under a handle) is already going on, so it waits again instead. */
  let still0 = 0;
  const arm = () => {
    clearTimeout(timer);
    still0 = o.scroller.scrollTop;
    timer = dir ? setTimeout(turn, HOLD) : undefined;
  };
  const turn = () => {
    timer = undefined;
    const el = o.scroller;
    if (el.scrollTop !== still0) return arm();
    const d = dir ? turnBy(dir, el) : 0;
    if (!d || !at) return;
    const from = el.scrollTop;
    const done = () => {
      frame = 0;
      if (at) o.extend(at.x, at.y);
      arm(); // still held there: the next turn waits its moment
    };
    if (still()) {
      el.scrollTop = from + d;
      return done();
    }
    const t0 = performance.now();
    const ms = token();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      el.scrollTop = from + d * ease(t);
      if (at) o.extend(at.x, at.y);
      if (t < 1) frame = requestAnimationFrame(step);
      else done();
    };
    frame = requestAnimationFrame(step);
  };
  return {
    aim(x, y, only) {
      at = { x, y };
      const way = edgeDir(y, band(), o.edge);
      const next = only && way !== only ? 0 : way;
      if (next === dir) return; // resting at the edge keeps its wait; moving along it too
      dir = next;
      if (!frame) arm();
    },
    stop() {
      at = null;
      dir = 0;
      clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
      timer = undefined;
      frame = 0;
    },
  };
}
