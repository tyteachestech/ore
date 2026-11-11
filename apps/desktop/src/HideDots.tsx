import { useEffect, useRef, type RefObject } from "react";
import { still } from "./SideCursor";

/** One line of the source's text as it sits on screen (px, from the scroll box's top left), or a picture,
 *  diagram or code block as a box. */
export type Line = { x1: number; x2: number; y: number; size: number } | { box: true; x1: number; x2: number; y: number; y2: number };

const SWEEP = 160; // px over which a line's dots grow, so the change runs down the page
const ease = (t: number) => 1 - Math.pow(1 - t, 3.2); // --ease-out, near enough for a sweep

/** Where a line's dots sit at full size: a row the line's own length, spaced and sized by its font, so a
 *  heading reads as bigger dots than body text; a box is a sparse even field. [x, y, radius]. */
export function dotsFor(l: Line): [number, number, number][] {
  const out: [number, number, number][] = [];
  if ("box" in l) {
    for (let y = l.y + 6; y < l.y2; y += 12) for (let x = l.x1 + 6; x < l.x2; x += 12) out.push([x, y, 1.6]);
    return out;
  }
  const step = Math.max(6, Math.round(l.size * 0.42));
  for (let x = l.x1 + step / 2; x < l.x2; x += step) out.push([x, l.y, l.size * 0.13]);
  return out;
}

/** How grown a line at height y is when the sweep is at p (0 to 1) over a box h tall. */
export const grown = (y: number, p: number, h: number) => Math.min(1, Math.max(0, (p * (h + SWEEP) - y) / SWEEP));

const BLOCKS = "img, svg, pre, video, iframe, canvas, .katex-display";

/** The lines and blocks of `page` that show inside `box`, merged into one entry per line on screen. Subtrees
 *  wholly off screen are skipped, so a long book costs what is visible. */
function measure(box: HTMLElement, page: HTMLElement): Line[] {
  const r = box.getBoundingClientRect();
  const out: Line[] = [];
  const off = (q: DOMRect) => q.bottom < r.top || q.top > r.bottom;
  const walk = document.createTreeWalker(page, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      if (n.nodeType === Node.TEXT_NODE) return n.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      const e = n as HTMLElement;
      const q = e.getBoundingClientRect();
      if (off(q) || getComputedStyle(e).display === "none") return NodeFilter.FILTER_REJECT;
      if (e.matches(BLOCKS) && q.width >= 40 && q.height >= 24) {
        out.push({ box: true, x1: q.left - r.left, x2: q.right - r.left, y: Math.max(0, q.top - r.top), y2: Math.min(r.height, q.bottom - r.top) });
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_SKIP;
    },
  });
  const range = document.createRange();
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const size = parseFloat(getComputedStyle(n.parentElement!).fontSize) || 16;
    range.selectNodeContents(n);
    for (const q of range.getClientRects()) {
      if (off(q) || q.width < 2) continue;
      const y = q.top + q.height / 2 - r.top;
      const last = out[out.length - 1];
      if (last && !("box" in last) && Math.abs(last.y - y) < 3 && q.left - r.left - last.x2 < 12) {
        last.x2 = Math.max(last.x2, q.right - r.left);
        last.size = Math.max(last.size, size);
      } else out.push({ x1: q.left - r.left, x2: q.right - r.left, y, size });
    }
  }
  return out;
}

/** D205: when the source hides while he writes, each line of its text becomes a row of dots its own length,
 *  top to bottom (`--t-moment`), and the words fade under them; pictures become a sparse dot field. The words
 *  are gone but the page keeps its shape, so he still sees where he was. Showing it again runs back up in
 *  `--t-4`. Under Reduce Motion the dots are simply there. */
export function HideDots({ hidden, box, page }: { hidden: boolean; box: RefObject<HTMLElement | null>; page: RefObject<HTMLElement | null> }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const at = useRef(0); // how far the sweep is, 0 (no dots) to 1
  const lines = useRef<Line[]>([]);
  const frame = useRef(0);

  const draw = () => {
    const c = cv.current, b = box.current;
    if (!c || !b) return;
    const w = b.clientWidth, h = b.clientHeight, dpr = devicePixelRatio || 1;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    c.style.left = `${b.offsetLeft}px`;
    c.style.top = `${b.offsetTop}px`;
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    const g = c.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const p = at.current;
    if (!p) return;
    g.fillStyle = getComputedStyle(page.current ?? b).color;
    for (const l of lines.current) {
      const k = grown(l.y, p, h);
      if (!k) continue;
      g.globalAlpha = "box" in l ? 0.22 : 0.5;
      g.beginPath();
      for (const [x, y, rad] of dotsFor(l)) {
        g.moveTo(x + rad * k, y);
        g.arc(x, y, rad * k, 0, Math.PI * 2);
      }
      g.fill();
    }
  };

  useEffect(() => {
    const b = box.current, pg = page.current;
    if (!b || !pg) return;
    if (hidden && !at.current) lines.current = measure(b, pg);
    const to = hidden ? 1 : 0, from = at.current;
    if (from === to) return draw();
    const dur = still() ? 0 : parseFloat(getComputedStyle(b).getPropertyValue(hidden ? "--t-moment" : "--t-4")) || 0;
    const t0 = performance.now();
    cancelAnimationFrame(frame.current);
    const step = (now: number) => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1;
      at.current = from + (to - from) * ease(k);
      draw();
      if (k < 1) frame.current = requestAnimationFrame(step);
    };
    step(t0);
    return () => cancelAnimationFrame(frame.current);
  }, [hidden]);

  // The window or the note's divider moves, or a key scrolls the page, while hidden: measure again and redraw.
  useEffect(() => {
    const b = box.current;
    if (!b) return;
    const again = () => {
      if (!at.current || !page.current) return;
      lines.current = measure(b, page.current);
      draw();
    };
    const ro = new ResizeObserver(again);
    ro.observe(b);
    b.addEventListener("scroll", again, { passive: true });
    return () => {
      ro.disconnect();
      b.removeEventListener("scroll", again);
    };
  }, []);

  return <canvas ref={cv} className="hide-dots" aria-hidden="true" />;
}
