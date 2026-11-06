import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Arrow, ARROW_H, playHop, still } from "./SideCursor";

/** Most lines the collapsed outline shows; deeper levels drop out until it fits. */
const MAX_LINES = 40;
/** A heading counts as current once its top passes this far below the top of the pane. */
const READ_LINE = 96;

type Heading = { el: HTMLElement; level: number; title: string };

/** H1 to H3 of the rendered source, shallow levels only when a book has too many to show. */
function outlineHeadings(doc: HTMLElement): Heading[] {
  const all = [...doc.querySelectorAll<HTMLElement>("h1, h2, h3")].map((el) => ({ el, level: Number(el.tagName[1]), title: el.textContent?.trim() ?? "" }));
  let levels = [...new Set(all.map((h) => h.level))].sort();
  let shown = all.filter((h) => h.title);
  while (shown.length > MAX_LINES && levels.length > 1) {
    levels = levels.slice(0, -1);
    shown = shown.filter((h) => levels.includes(h.level));
  }
  return shown;
}

/** Position bar and floating outline (D45): how far down the source he is, and a Notion-style
 *  table of contents at the right edge. No percent, no time left (D27). */
export function Position({ scroll, doc, ready }: { scroll: RefObject<HTMLDivElement | null>; doc: HTMLElement | null; ready: boolean }) {
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(-1);
  const headings = useMemo(() => (ready && doc ? outlineHeadings(doc) : []), [ready, doc]);
  const top = Math.min(...headings.map((h) => h.level));

  useEffect(() => {
    const el = scroll.current;
    if (!el || !ready) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 1);
      const edge = el.getBoundingClientRect().top + READ_LINE;
      let at = -1;
      for (const [i, h] of headings.entries()) {
        if (h.el.getBoundingClientRect().top > edge) break;
        at = i;
      }
      setCurrent(at);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [scroll, ready, headings]);

  /** A long outline opens scrolled to where he is, as Notion's does. Not scrollIntoView: that would move the reader too. */
  const panel = useRef<HTMLDivElement>(null);
  const reveal = () =>
    requestAnimationFrame(() => {
      const p = panel.current;
      const on = p?.querySelector<HTMLElement>("button.on");
      if (p && on && (on.offsetTop < p.scrollTop || on.offsetTop + on.offsetHeight > p.scrollTop + p.clientHeight)) p.scrollTop = on.offsetTop - (p.clientHeight - on.offsetHeight) / 2;
    });

  // The sidebar's 8-bit arrow marks the current heading and hops when it changes (D113).
  const lines = useRef<HTMLDivElement>(null);
  const arrow = useRef<SVGSVGElement>(null);
  const arrowY = useRef<number | null>(null);
  const hop = useRef(0);
  useLayoutEffect(() => {
    const a = arrow.current;
    const line = lines.current?.children[current] as HTMLElement | undefined;
    if (!a) return;
    a.style.visibility = line ? "" : "hidden";
    if (!line) return void (arrowY.current = null);
    const y = Math.round(line.offsetTop + line.offsetHeight / 2 - ARROW_H / 2);
    const place = (v: number) => (a.style.transform = `translateY(${v}px)`);
    if (arrowY.current === null || still()) {
      clearTimeout(hop.current);
      place(y);
    } else if (arrowY.current !== y) playHop(place, arrowY.current, y, hop);
    arrowY.current = y;
  }, [current, headings]);

  const jump = (h: Heading) => {
    const el = scroll.current;
    if (!el) return;
    el.scrollTop += h.el.getBoundingClientRect().top - el.getBoundingClientRect().top - 24;
    el.focus({ preventScroll: true });
  };

  return (
    <>
      {/* With an outline, its lines already say where he is (Tyler, 2026-11-03): the bar is for a source without headings. */}
      {headings.length < 2 && (
        <div className="position" aria-hidden="true">
          <div style={{ transform: `scaleX(${progress})` }} />
        </div>
      )}
      {headings.length > 1 && (
        <nav className="outline" aria-label="Outline" onMouseEnter={reveal} onFocus={reveal}>
          <div className="outline-lines" ref={lines} aria-hidden="true" style={{ "--n": headings.length } as CSSProperties}>
            {headings.map((h, i) => (
              <span key={i} className={i === current ? "on" : i < current ? "past" : undefined} style={{ width: 16 - (h.level - top) * 4 }} />
            ))}
          </div>
          <Arrow ref={arrow} className="outline-cursor" />
          <div className="outline-panel" ref={panel}>
            {headings.map((h, i) => (
              <button key={i} className={i === current ? "on" : undefined} style={{ paddingLeft: 10 + (h.level - top) * 12 }} onClick={() => jump(h)}>
                {h.title}
              </button>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}
