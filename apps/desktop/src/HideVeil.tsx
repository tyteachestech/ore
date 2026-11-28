import { useLayoutEffect, useRef, type RefObject } from "react";

type Box = { left: number; top: number; width: number; height: number };

/** Where the blur starts, in px from the source's top left: the middle of the eye he pressed, or the top
 *  right corner where there is no eye (the iPhone). */
export function veilFrom(box: Box, eye: Box | null): { x: number; y: number } {
  if (!eye) return { x: box.width, y: 0 };
  return { x: eye.left + eye.width / 2 - box.left, y: eye.top + eye.height / 2 - box.top };
}

/** D360: the hidden source is blurred past reading. The blur spreads from the eye over the page and
 *  draws back into it (`.hide-veil` in styles.css); the page under it keeps its shape. */
export function HideVeil({ hidden, eye }: { hidden: boolean; eye: RefObject<HTMLElement | null> }) {
  const el = useRef<HTMLDivElement>(null);
  // Before paint, so the first frame of the spread already starts at the eye.
  useLayoutEffect(() => {
    const v = el.current;
    if (!v) return;
    const at = veilFrom(v.getBoundingClientRect(), eye.current?.getBoundingClientRect() ?? null);
    v.style.setProperty("--veil-x", `${at.x}px`);
    v.style.setProperty("--veil-y", `${at.y}px`);
  }, [hidden]);
  return <div ref={el} className={`hide-veil${hidden ? " on" : ""}`} aria-hidden="true" />;
}
