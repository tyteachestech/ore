// A bottom sheet on the iPhone closes with a swipe down, as iOS sheets do: it follows the finger, and let go
// past a quarter of its height (or with a flick) it slides away, otherwise it springs back. One with a long
// list pulls up to the top of the screen too.
import { useEffect, useRef, type ReactElement, type RefObject } from "react";
import { createPortal } from "react-dom";
import { PHONE } from "../ore";

/** A bottom sheet's layer on the phone: on the body, so it covers the whole screen it opened from, the reader's
 *  floating bar and pill included (inside that screen it sat in the layer of its ⋯ or pill, under the bar), and
 *  above toasts (styles.css). On the Mac it stays where it is. */
export const sheetLayer = (sheet: ReactElement) => (PHONE ? createPortal(sheet, document.body) : sheet);

const EASE = "220ms cubic-bezier(.2, .9, .3, 1)";

/** With `pull`, a sheet whose list is longer than it shows also pulls up (D-new-sheet-pull-up), as an iOS sheet goes from its
 *  medium height to its large one: the list grows under the finger to the top of the screen, and from there a
 *  short pull down brings it back, a long one or a flick closes. A list scrolled down hands the pull to the
 *  sheet once it is back at its top. */
export function useSwipeDown(ref: RefObject<HTMLElement | null>, onClose: () => void, on: boolean, pull = false) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = ref.current;
    if (!on || !el) return;
    let y0 = 0, t0 = 0, dy = 0, live = false, one = false, low = 0, full = 0;
    let list: HTMLElement | null = null;
    /** Pulling the list taller, not moving the sheet. */
    let growing = false;
    const tall = () => el.dataset.tall === "true";
    const start = (e: TouchEvent) => {
      list = (e.target as HTMLElement).closest<HTMLElement>(".pick-list, [cmdk-list]") ?? el.querySelector<HTMLElement>(".pick-list");
      one = e.touches.length === 1;
      // A list scrolled down scrolls back up first, as in iOS.
      live = one && !(list && list.scrollTop > 0 && list.contains(e.target as Node));
      growing = false;
      [y0, t0, dy] = [e.touches[0]!.clientY, e.timeStamp, 0];
      if (list && !tall()) {
        low = list.offsetHeight;
        // Up to the status bar: the screen less the sheet's own head and foot.
        full = window.innerHeight - (el.offsetHeight - low) - 56;
      }
    };
    const move = (e: TouchEvent) => {
      if (!one) return;
      const y = e.touches[0]!.clientY;
      // The list reached its top mid-pull: the rest of the pull is the sheet's.
      if (!live && list && list.scrollTop <= 0 && y > y0) [live, y0, t0] = [true, y, e.timeStamp];
      // Up, on a list that holds more than it shows: it grows first, and scrolls once it is full height.
      if (pull && !growing && list && !tall() && y0 - y >= 6 && list.scrollHeight > list.clientHeight + 1 && full > low + 40) {
        growing = true;
        list.style.overflowY = "hidden";
      }
      if (growing && list) {
        dy = y - y0;
        if (e.cancelable) e.preventDefault();
        list.style.transition = "none";
        list.style.maxHeight = `${Math.max(low, Math.min(full, low - dy))}px`;
        return;
      }
      if (!live) return;
      dy = Math.max(0, y - y0);
      if (dy < 6) return;
      if (e.cancelable) e.preventDefault();
      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
    };
    const end = (e: TouchEvent) => {
      const fast = Math.abs(dy) / Math.max(1, e.timeStamp - t0) > 0.5;
      if (growing && list) {
        growing = false;
        const up = -dy > 40 || (dy < 0 && fast);
        list.style.transition = `max-height ${EASE}`;
        list.style.maxHeight = up ? `${full}px` : "";
        list.style.overflowY = "";
        if (up) el.dataset.tall = "true";
        return;
      }
      if (!live || dy < 6) return;
      live = false;
      // From full height a short pull is back to where it opened; a long one or a flick closes, as from there.
      const go = dy > el.offsetHeight / 4 || fast;
      const shrink = tall() && !go && dy > 40;
      el.style.transition = `transform ${EASE}`;
      el.style.transform = go ? `translateY(${el.offsetHeight}px)` : "";
      if (shrink && list) {
        list.style.transition = `max-height ${EASE}`;
        list.style.maxHeight = "";
        delete el.dataset.tall;
      }
      if (go) setTimeout(() => close.current(), 180);
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    return () => {
      el.removeEventListener("touchstart", start);
      el.removeEventListener("touchmove", move);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
    };
  }, [ref, on, pull]);
}
