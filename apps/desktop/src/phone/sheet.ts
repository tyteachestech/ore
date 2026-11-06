// A bottom sheet on the iPhone closes with a swipe down, as iOS sheets do: it follows the finger, and let go
// past a quarter of its height (or with a flick) it slides away, otherwise it springs back.
import { useEffect, useRef, type RefObject } from "react";

export function useSwipeDown(ref: RefObject<HTMLElement | null>, onClose: () => void, on: boolean) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const el = ref.current;
    if (!on || !el) return;
    let y0 = 0, t0 = 0, dy = 0, live = false;
    const start = (e: TouchEvent) => {
      // A list scrolled down scrolls back up first, as in iOS.
      const list = (e.target as HTMLElement).closest<HTMLElement>(".pick-list");
      live = e.touches.length === 1 && !(list && list.scrollTop > 0);
      [y0, t0, dy] = [e.touches[0]!.clientY, e.timeStamp, 0];
    };
    const move = (e: TouchEvent) => {
      if (!live) return;
      dy = Math.max(0, e.touches[0]!.clientY - y0);
      if (dy < 6) return;
      e.preventDefault();
      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
    };
    const end = (e: TouchEvent) => {
      if (!live || dy < 6) return;
      live = false;
      const go = dy > el.offsetHeight / 4 || dy / Math.max(1, e.timeStamp - t0) > 0.5;
      el.style.transition = "transform 220ms cubic-bezier(.2, .9, .3, 1)";
      el.style.transform = go ? `translateY(${el.offsetHeight}px)` : "";
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
  }, [ref, on]);
}
