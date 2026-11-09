import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Intent } from "./ore";
import { snapEdge, type Side } from "./snap";

// The open highlight's two edges, to drag (Kindle, Apple Books on iPhone): a stem the height of the line
// with a knob, above the start and below the end, in the highlight's colour. An edge snaps to whole words (snap.ts), ⌥ for part of one;
// Esc while dragging puts it back. Outside <article className="doc">, like the margin marks: highlights are
// painted over that DOM and its text index must stay untouched.

type Spot = { left: number; top: number; height: number };

/** The text node and offset under the pointer, inside `root` and its indexed text. */
function pointAt(root: HTMLElement, x: number, y: number): { node: Text; offset: number } | null {
  const c = document.caretRangeFromPoint?.(x, y);
  const node = c?.startContainer;
  if (!c || !node || node.nodeType !== Node.TEXT_NODE || !root.contains(node)) return null;
  if (node.parentElement?.closest(".katex, [data-noindex]")) return null;
  return { node: node as Text, offset: c.startOffset };
}

function spotsOf(range: Range, box: DOMRect): Record<Side, Spot> | null {
  const rects = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
  const a = rects[0];
  const b = rects.at(-1);
  if (!a || !b) return null;
  return {
    start: { left: a.left - box.left, top: a.top - box.top, height: a.height },
    end: { left: b.right - box.left, top: b.top - box.top, height: b.height },
  };
}

export function Grab(p: {
  range: Range;
  intent: Intent;
  root: HTMLElement;
  /** A drag began (true) or ended (false): the popup hides meanwhile, as Books hides its menu. */
  onDragging: (on: boolean) => void;
  /** The passage as dragged so far, to paint. */
  onChange: (r: Range) => void;
  /** Let go: the passage to keep (unchanged when he put it back). */
  onDrop: (r: Range, was: Range) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [spots, setSpots] = useState<Record<Side, Spot> | null>(null);
  const drag = useRef<{ side: Side; was: Range; now: Range; id: number } | null>(null);

  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const measure = () => setSpots(spotsOf(p.range, box.getBoundingClientRect()));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [p.range]);

  // Esc mid-drag puts the edge back and closes nothing else (the top layer only).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = drag.current;
      if (!d || e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      drag.current = null;
      p.onChange(d.was);
      p.onDragging(false);
      p.onDrop(d.was, d.was);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const down = (side: Side) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // No text selection starts under the knob (the page's own mouse handlers are kept out by .grab).
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { side, was: p.range.cloneRange(), now: p.range.cloneRange(), id: e.pointerId };
    p.onDragging(true);
  };

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    // The knob sits off the line: aim at the line it stands for.
    const at = pointAt(p.root, e.clientX, e.clientY + (d.side === "start" ? 6 : -6));
    if (!at) return;
    const [n, o] = e.altKey ? [at.node, at.offset] : snapEdge(at.node, at.offset, d.side);
    const r = d.now.cloneRange();
    // Past the other edge, the range collapses: the highlight stops at its last word instead.
    if (d.side === "start") r.setStart(n, o);
    else r.setEnd(n, o);
    if (r.collapsed || !r.toString().trim()) return;
    if (r.compareBoundaryPoints(Range.START_TO_START, d.now) === 0 && r.compareBoundaryPoints(Range.END_TO_END, d.now) === 0) return;
    d.now = r;
    p.onChange(r);
  };

  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    p.onDragging(false);
    p.onDrop(d.now, d.was);
  };

  return (
    <div className="grab" ref={ref} onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()}>
      {spots &&
        (["start", "end"] as const).map((side) => (
          <div
            key={side}
            className={`grab-edge ${side} ${p.intent}`}
            role="slider"
            aria-label={side === "start" ? "Drag to change where the highlight starts" : "Drag to change where the highlight ends"}
            aria-valuetext={p.range.toString().slice(0, 80)}
            style={{ left: spots[side].left, top: spots[side].top, height: spots[side].height }}
            onPointerDown={down(side)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          />
        ))}
    </div>
  );
}
