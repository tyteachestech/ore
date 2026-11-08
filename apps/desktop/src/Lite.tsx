import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** True inside a list row that hasn't been near the screen yet. Its menus, hover hints and skill picker
 *  then render only their button, without Radix: a few Radix roots per row cost ~0.5 ms each, so a
 *  950-source list took 0.8 s to open, most of it for menus nobody can reach off screen. */
export const Lite = createContext(false);
export const useLite = () => useContext(Lite);

// One observer per scrolling list, reaching a screen's height past its edges, so a row has its menus
// before it scrolls into reach.
const observers = new Map<Element | null, IntersectionObserver>();
const waiting = new Map<Element, Set<() => void>>();
const scroller = (el: Element): Element | null => {
  for (let p = el.parentElement; p; p = p.parentElement) if (/auto|scroll/.test(getComputedStyle(p).overflowY)) return p;
  return null;
};
const watch = (el: Element, on: () => void) => {
  const root = scroller(el);
  let io = observers.get(root);
  if (!io) {
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          for (const f of waiting.get(e.target) ?? []) f();
          waiting.delete(e.target);
          io!.unobserve(e.target);
        }
      },
      { root, rootMargin: "100% 0px" },
    );
    observers.set(root, io);
  }
  const set = waiting.get(el) ?? new Set();
  set.add(on);
  waiting.set(el, set);
  io.observe(el);
  return () => {
    set.delete(on);
    if (set.size) return;
    waiting.delete(el);
    io.unobserve(el);
  };
};

/** A row (`id` is its element's id) that renders Lite until it nears the screen, then in full for good.
 *  `full`: in full at once (the row under the cursor, being renamed or filed), so its state isn't lost to a late swap. */
export function OnScreen({ id, full = false, children }: { id: string; full?: boolean; children: ReactNode }) {
  const [shown, setShown] = useState(full || typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (shown) return;
    if (full) return setShown(true);
    const el = document.getElementById(id);
    if (!el) return setShown(true);
    return watch(el, () => setShown(true));
  }, [id, shown, full]);
  return <Lite.Provider value={!shown && !full}>{children}</Lite.Provider>;
}
