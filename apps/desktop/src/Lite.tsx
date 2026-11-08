import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/** True inside a list row that hasn't been on screen yet. Its menus, hover hints and skill picker
 *  then render only their button, without Radix: a few Radix roots per row cost ~0.5 ms each, so a
 *  950-source list took 0.7 s to open, most of it for menus nobody can reach off screen. */
export const Lite = createContext(false);
export const useLite = () => useContext(Lite);

let io: IntersectionObserver | null = null;
const seen = new Map<Element, () => void>();
const watch = (el: Element, on: () => void) => {
  io ??= new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      seen.get(e.target)?.();
      seen.delete(e.target);
      io!.unobserve(e.target);
    }
  });
  seen.set(el, on);
  io.observe(el);
  return () => {
    seen.delete(el);
    io?.unobserve(el);
  };
};

/** A row (`id` is its element's id) that renders Lite until any of it is on screen, then in full for good. */
export function OnScreen({ id, children }: { id: string; children: ReactNode }) {
  const [shown, setShown] = useState(typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (shown) return;
    const el = document.getElementById(id);
    if (!el) return setShown(true);
    return watch(el, () => setShown(true));
  }, [id, shown]);
  return <Lite.Provider value={!shown}>{children}</Lite.Provider>;
}
