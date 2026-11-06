import { useLayoutEffect, useRef, useState } from "react";

// Keyboard highlighting (Readwise Reader): a focus that steps through the text one block at a time.
// The blocks are the rendered Markdown's innermost text blocks; nothing here touches that DOM.

const BLOCKS = "p, li, h1, h2, h3, h4, h5, h6, pre, blockquote, td, th";

/** The text blocks of `doc` in reading order: innermost only (a list item's paragraph, not the item). */
export function blocksOf(doc: HTMLElement): HTMLElement[] {
  return [...doc.querySelectorAll<HTMLElement>(BLOCKS)].filter((el) => !el.querySelector(BLOCKS) && !!el.textContent?.trim());
}

/** The block where the focus starts: the first one reaching past a third of the way down the view. */
export function startBlock(blocks: HTMLElement[], top: number, height: number): HTMLElement | null {
  const line = top + height / 3;
  return blocks.find((b) => b.getBoundingClientRect().bottom > line) ?? blocks[blocks.length - 1] ?? null;
}

/** A range over the text of `first` through `last`, skipping a transcript's timestamps and the
 *  whitespace at either end, so it reads like a selection made with the mouse. */
export function textRange(first: HTMLElement, last: HTMLElement): Range | null {
  const texts = (el: HTMLElement) => {
    const out: Text[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null)
      if (n.data.trim() && !n.parentElement?.closest(".ts")) out.push(n);
    return out;
  };
  const a = texts(first)[0];
  const z = texts(last).at(-1);
  if (!a || !z) return null;
  const r = document.createRange();
  r.setStart(a, a.data.length - a.data.trimStart().length);
  r.setEnd(z, z.data.trimEnd().length);
  return r;
}

/** The focus box over blocks `from`…`to`, drawn beside the text like Marks and the section lines. */
export function FocusBox({ from, to }: { from: HTMLElement; to: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const page = ref.current?.parentElement;
    const article = page?.querySelector<HTMLElement>("article.doc");
    if (!page || !article) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const p = page.getBoundingClientRect();
      const d = article.getBoundingClientRect();
      const a = from.getBoundingClientRect();
      const z = to.getBoundingClientRect();
      const top = Math.min(a.top, z.top);
      // A little outside the text on every side, so the box frames it instead of touching it.
      setBox({ top: top - p.top - 4, left: d.left - p.left - 10, width: d.width + 20, height: Math.max(a.bottom, z.bottom) - top + 8 });
    };
    measure();
    const ro = new ResizeObserver(() => (frame ||= requestAnimationFrame(measure)));
    ro.observe(article);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [from, to]);
  return <div className="focus-box" ref={ref} aria-hidden="true" style={box ? { top: box.top, left: box.left, width: box.width, height: box.height } : { display: "none" }} />;
}
