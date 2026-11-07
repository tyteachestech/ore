import { MagnifyingGlass } from "./icons";
import { memo, useLayoutEffect, useRef, useState } from "react";
import { ICON, LABEL } from "./Collected";
import { Hint } from "./Hint";
import type { Intent } from "./ore";

// A small type icon in the left margin where each highlight starts, so its colour explains itself
// (Kindle and Apple Books put note markers beside the line). Outside <article className="doc">, like
// the section lines: highlights are painted over that DOM and its text index must stay untouched.

export type Mark = { key: string; kind: Intent | "evidence"; range: Range; open: () => void };

const STEP = 16; // icons that start on the same line sit side by side, leftwards

// Memo: the reader re-renders on every cursor step, and a source can carry hundreds of marks.
export const Marks = memo(function Marks({ marks }: { marks: Mark[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [spots, setSpots] = useState<{ m: Mark; top: number; left: number }[]>([]);

  useLayoutEffect(() => {
    const box = ref.current;
    const article = box?.parentElement?.querySelector<HTMLElement>("article.doc");
    if (!box || !article) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const b = box.getBoundingClientRect();
      const left = article.getBoundingClientRect().left - b.left;
      const rows: number[] = [];
      const out = [];
      for (const m of marks) {
        const r = m.range.getClientRects()[0];
        if (!r || !r.height) continue;
        const top = r.top - b.top + r.height / 2;
        const row = rows.filter((t) => Math.abs(t - top) < 4).length;
        rows.push(top);
        out.push({ m, top, left: left - row * STEP });
      }
      setSpots(out);
    };
    measure();
    const ro = new ResizeObserver(() => (frame ||= requestAnimationFrame(measure)));
    ro.observe(box);
    ro.observe(article);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [marks]);

  return (
    <div className="marks" ref={ref} onMouseUp={(e) => e.stopPropagation()}>
      {spots.map(({ m, top, left }) => {
        const Glyph = m.kind === "evidence" ? MagnifyingGlass : ICON[m.kind];
        const text = m.kind === "evidence" ? "In the source: backs up a key point" : LABEL[m.kind];
        return (
          <Hint key={m.key} text={text} side="left">
            <button tabIndex={-1} className={`mark-icon ${m.kind}`} data-key={m.key} aria-label={text} style={{ top, left }} onClick={m.open}>
              <Glyph size={13} weight="bold" aria-hidden="true" />
            </button>
          </Hint>
        );
      })}
    </div>
  );
});
