import { createElement, useEffect, useState } from "react";

/** Whether a box's text is cut off: wider than the box (an ellipsis) or, line-clamped, taller. A pixel of slack. */
export const cutOff = (el: { scrollWidth: number; clientWidth: number; scrollHeight: number; clientHeight: number }) =>
  el.scrollWidth - el.clientWidth > 1 || el.scrollHeight - el.clientHeight > 1;

/** Where the full text goes: right over the cut one, as the Mac's expansion tooltip does, slid left to stay in the window. */
export const expandAt = (at: { left: number; top: number }, size: { width: number }, viewport: number) => ({
  left: Math.max(8, Math.min(at.left, viewport - size.width - 8)),
  top: at.top,
});

/** The box a pointer is on whose text is cut off, if any: the text itself or one of its two nearest parents. */
function cutBox(target: EventTarget | null): HTMLElement | null {
  let el = target instanceof HTMLElement ? target : null;
  for (let i = 0; el && i < 3; i++, el = el.parentElement) {
    if (el.closest("input, textarea, [contenteditable=true], .popover, .hint")) return null;
    const s = getComputedStyle(el);
    const clipped = s.textOverflow === "ellipsis" || s.webkitLineClamp !== "none";
    if (clipped && el.textContent?.trim() && cutOff(el)) return el;
  }
  return null;
}

type Shown = { text: string; left: number; top: number; font: string; color: string; pad: string; max: number; spacing: string; transform: string };

/** Hovering a title, a name or a byline cut off by an ellipsis shows the whole of it laid over the cut text, after the
 *  hint delay (D282; Finder's expansion tooltip). Nothing when the text fits, and never a `title=`. */
export function FullText() {
  const [shown, setShown] = useState<Shown | null>(null);
  useEffect(() => {
    let timer = 0;
    let on: HTMLElement | null = null;
    const hide = () => (clearTimeout(timer), (on = null), setShown(null));
    const over = (e: PointerEvent) => {
      const el = cutBox(e.target);
      if (el === on) return;
      hide();
      if (!el || e.buttons) return;
      on = el;
      timer = window.setTimeout(() => {
        if (!el.isConnected || document.querySelector(".hint")) return;
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        // 6px of room either side, the box moved left by as much, so its text lands on the cut text's.
        setShown({ text: el.textContent!.trim(), left: r.left - 6, top: r.top, font: s.font, color: s.color, pad: `${s.paddingTop} calc(${s.paddingRight} + 6px) ${s.paddingBottom} calc(${s.paddingLeft} + 6px)`, max: innerWidth - 16, spacing: s.letterSpacing, transform: s.textTransform });
      }, 400);
    };
    document.addEventListener("pointerover", over, true);
    for (const t of ["pointerdown", "keydown", "wheel", "blur"] as const) addEventListener(t, hide, true);
    return () => {
      hide();
      document.removeEventListener("pointerover", over, true);
      for (const t of ["pointerdown", "keydown", "wheel", "blur"] as const) removeEventListener(t, hide, true);
    };
  }, []);
  if (!shown) return null;
  return createElement("div", {
    className: "full-text",
    "aria-hidden": true,
    ref: (el: HTMLDivElement | null) => {
      if (!el) return;
      const at = expandAt(shown, el.getBoundingClientRect(), innerWidth);
      el.style.left = `${at.left}px`;
      el.style.top = `${at.top}px`;
    },
    style: { left: shown.left, top: shown.top, font: shown.font, color: shown.color, padding: shown.pad, maxWidth: shown.max, letterSpacing: shown.spacing, textTransform: shown.transform as "none" },
  }, shown.text);
}
