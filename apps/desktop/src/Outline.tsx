import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { Arrow, ARROW_H, playHop, still } from "./SideCursor";
import { PHONE } from "./ore";
import { Trap } from "./Trap";
import { sheetLayer, useSwipeDown } from "./phone/sheet";

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

/** The section he is in, for the pill. Above the first heading it is the source's own first line when
 *  that is its top heading, else nothing: never a top heading from further down (F-new-pill-late-heading). */
export const sectionName = (headings: { level: number; title: string }[], current: number) => headings[current]?.title ?? (headings[0]?.level === 1 ? headings[0].title : "");

type Place = { scroll: RefObject<HTMLDivElement | null>; doc: HTMLElement | null; ready: boolean; onJump?: () => void };

/** How far down the source he is and which heading he is in, kept up as he scrolls. */
function useReadingPlace({ scroll, doc, ready }: Place) {
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(-1);
  const headings = useMemo(() => (ready && doc ? outlineHeadings(doc) : []), [ready, doc]);
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
  return { progress, current, headings };
}

/** Scrolls the pane so `h` sits just under its top; `onJump` first, so ⌘[ can come back. */
function jumpTo(scroll: RefObject<HTMLDivElement | null>, h: Heading, onJump?: () => void) {
  const el = scroll.current;
  if (!el) return;
  onJump?.();
  el.scrollTop += h.el.getBoundingClientRect().top - el.getBoundingClientRect().top - 24;
  el.focus({ preventScroll: true });
}

/** Position bar and floating outline (D45): how far down the source he is, and a Notion-style
 *  table of contents at the right edge. No percent, no time left (D27). */
/** How long the pointer rests on the outline before it opens. */
const HOVER_OPEN_MS = 300;

/** `onJump`: called before a jump, so ⌘[ can come back to where he was. */
export function Position(place: Place) {
  const { scroll, onJump } = place;
  const { progress, current, headings } = useReadingPlace(place);
  const top = Math.min(...headings.map((h) => h.level));

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

  const jump = (h: Heading) => jumpTo(scroll, h, onJump);

  // Hover opens it after a short wait, so a mouse passing to the scrollbar doesn't flash it (Home's skill card waits the same);
  // Tab opens it at once (:focus-within).
  const [hovered, setHovered] = useState(false);
  const intent = useRef(0);
  useEffect(() => () => clearTimeout(intent.current), []);
  const enter = () => {
    clearTimeout(intent.current);
    intent.current = window.setTimeout(() => (setHovered(true), reveal()), HOVER_OPEN_MS);
  };
  const leave = () => (clearTimeout(intent.current), setHovered(false));

  // The Tab stop follows the arrows while he is in the outline; a jump or scroll hands it back to the heading he is in.
  const [stop, setStop] = useState<number | null>(null);
  useEffect(() => setStop(null), [current]);
  const onKey = (e: ReactKeyboardEvent) => {
    const all = [...(panel.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const at = all.indexOf(document.activeElement as HTMLButtonElement);
    const to = e.key === "ArrowDown" ? at + 1 : e.key === "ArrowUp" ? at - 1 : e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : null;
    if (to !== null && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault(); // the reader's ↑ ↓ reading focus leaves arrows a list has taken
      all[Math.max(0, Math.min(all.length - 1, to))]?.focus();
    } else if (e.key === "Escape") {
      e.stopPropagation(); // closes the outline, not the source
      scroll.current?.focus({ preventScroll: true });
    }
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
        <nav className={hovered ? "outline open" : "outline"} aria-label="Outline" onMouseEnter={enter} onMouseLeave={leave} onFocus={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && reveal()}>
          <div className="outline-lines" ref={lines} aria-hidden="true" style={{ "--n": headings.length } as CSSProperties}>
            {headings.map((h, i) => (
              <span key={i} className={i === current ? "on" : i < current ? "past" : undefined} style={{ width: 16 - (h.level - top) * 4 }} />
            ))}
          </div>
          <Arrow ref={arrow} className="outline-cursor" />
          {/* One Tab stop, on the heading he is in; ↑ ↓ move between headings, Enter jumps, Esc goes back to the text
              (a macOS sidebar's outline). Tab onto it opens it, as hovering does. */}
          <div className="outline-panel" ref={panel} onKeyDown={onKey}>
            {headings.map((h, i) => (
              <button key={i} className={i === current ? "on" : undefined} tabIndex={i === (stop ?? Math.max(0, current)) ? 0 : -1} onFocus={() => setStop(i)} style={{ paddingLeft: 10 + (h.level - top) * 12 }} onClick={() => jump(h)}>
                {h.title}
              </button>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}

/** The phone's reading pill (D152; Rare UI's scroll progress): where the rail doesn't fit, a small pill at
 *  the foot of the page with a ring that fills as he reads and the name of the section he is in. A tap
 *  opens the sections as a bottom sheet; one jumps there; swipe down, a tap outside or Esc closes it.
 *  The name crossfades when the section changes; nothing moves under reduced motion. */
export function ReadingPill(place: Place) {
  const { scroll, onJump } = place;
  const { progress, current, headings } = useReadingPlace(place);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  useSwipeDown(box, close, PHONE && open);
  useEffect(() => {
    if (open) requestAnimationFrame(() => (box.current?.querySelector<HTMLElement>("button.on") ?? box.current?.querySelector<HTMLElement>("button"))?.focus());
  }, [open]);
  const name = sectionName(headings, current);
  const r = 6, c = 2 * Math.PI * r;
  const top = Math.min(...headings.map((x) => x.level));
  return (
    <>
      <button className="read-pill" aria-label={`${name ? `In ${name}. ` : ""}Sections`} aria-haspopup={headings.length > 1 ? "dialog" : undefined} aria-expanded={headings.length > 1 ? open : undefined} disabled={headings.length < 2} onClick={() => setOpen(true)}>
        <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true">
          <circle cx={8} cy={8} r={r} fill="none" stroke="var(--border)" strokeWidth={2} />
          <circle cx={8} cy={8} r={r} fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray={c} strokeDashoffset={c * (1 - progress)} transform="rotate(-90 8 8)" />
        </svg>
        {name && <span key={current} className="read-pill-name">{name}</span>}
      </button>
      {open && sheetLayer(
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
          <Trap>
            <div ref={box} className="panel sheet sections-sheet" role="dialog" aria-modal="true" aria-label="Sections" tabIndex={-1} onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } }}>
              <h2>Sections</h2>
              <div className="pick-list">
                {headings.map((h, i) => (
                  <button key={i} className={`pick-row${i === current ? " on" : ""}`} aria-current={i === current ? "location" : undefined} style={{ paddingLeft: 12 + (h.level - top) * 14 }} onClick={() => { close(); jumpTo(scroll, h, onJump); }}>
                    <span className="name">{h.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </Trap>
        </div>
      )}
    </>
  );
}
