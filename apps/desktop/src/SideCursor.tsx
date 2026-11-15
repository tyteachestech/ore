import { useLayoutEffect, useRef, type RefObject } from "react";

/** One sprite frame (ms). Six frames make a hop: four eased steps, one past the row, then the row. */
const FRAME = 28;
/** A selection that follows a press in the sidebar within this long came from that click. */
const CLICKED = 600;
/** 3×5 round dots, 2 px apart: a menu arrow in the house dots (D183). */
const ARROW = ["X..", "XX.", "XXX", "XX.", "X.."];
const H = ARROW.length * 2;

/** The frames from one row to another, snapped to the 2 px grid, overshooting by 4 px before it lands. */
export function hopFrames(from: number, to: number, steps = 4): number[] {
  if (from === to) return [to];
  const dir = Math.sign(to - from);
  const seq: number[] = [];
  for (let i = 1; i < steps; i++) seq.push(from + Math.round(((to - from) * (1 - (1 - i / steps) ** 3)) / 2) * 2);
  seq.push(to + dir * 4, to);
  return seq;
}

export const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Plays a hop through `place`, one frame per FRAME ms; a new hop on the same timer cuts the last one short. */
export function playHop(place: (v: number) => void, from: number, to: number, timer: { current: number }) {
  clearTimeout(timer.current);
  const seq = hopFrames(from, to);
  const tick = (i: number) => {
    place(seq[i]!);
    if (i + 1 < seq.length) timer.current = window.setTimeout(() => tick(i + 1), FRAME);
  };
  tick(0);
}

/** The arrow sprite, shared by the sidebar and the reader's outline. */
export function Arrow({ ref, className }: { ref: RefObject<SVGSVGElement | null>; className: string }) {
  return (
    <svg ref={ref} className={className} width={6} height={H} viewBox={`0 0 6 ${H}`} aria-hidden="true">
      {ARROW.flatMap((row, y) => [...row].map((c, x) => (c === "X" ? <circle key={`${x}.${y}`} cx={x * 2 + 1} cy={y * 2 + 1} r={0.84} /> : null)))}
    </svg>
  );
}
export const ARROW_H = H;

/** The arrow in the sidebar's left gutter that points at the open row (RareUI's Bounce sidebar, as an
 *  8-bit menu cursor, Tyler 2026-11-03). A click makes it hop there in hard frames; a shortcut, the
 *  palette or a link elsewhere moves it at once, as does reduced motion. Hidden while rows drag or when
 *  the open row is in a collapsed group. `at` names the open row; any re-render re-measures. */
export function useSideCursor(nav: RefObject<HTMLElement | null>, at: string) {
  const cursor = useRef<SVGSVGElement>(null);
  const pressed = useRef(-Infinity);
  const last = useRef<{ at: string; y: number } | null>(null);
  const timer = useRef(0);

  useLayoutEffect(() => {
    const el = nav.current;
    const arrow = cursor.current;
    if (!el || !arrow) return;
    const row = el.querySelector('[aria-pressed="true"]')?.closest<HTMLElement>(".side-item");
    if (!row) {
      arrow.style.visibility = "hidden";
      last.current = null;
      return;
    }
    const r = row.getBoundingClientRect();
    const y = Math.round(r.top - el.getBoundingClientRect().top + el.scrollTop + (r.height - H) / 2);
    arrow.style.visibility = "";
    const prev = last.current;
    last.current = { at, y };
    const place = (v: number) => (arrow.style.transform = `translateY(${v}px)`);
    if (prev?.y === y) return;
    const hop = prev && prev.at !== at && performance.now() - pressed.current < CLICKED && !still();
    if (!hop) {
      clearTimeout(timer.current);
      return void place(y);
    }
    playHop(place, prev.y, y, timer);
  });

  const onPointerDown = () => (pressed.current = performance.now());
  const arrow = <Arrow ref={cursor} className="side-cursor" />;
  return { arrow, onPointerDown };
}
