import { useEffect, useRef } from "react";

/* The lamp (D263): how a thing that is running right now says so. Its dots turn amber and breathe in place with a
   real signal; off, it is grey and still. The radio's button (Radio.tsx) follows the sound's level; a thing with no
   level to read (the Mac's voice, a reply being written) calls `pulse` each time something really happens (a word
   spoken, words arriving) and its dots follow `glow`, which fades between pulses. */

export const AMBER = "255,178,36";
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

const last = new Map<string, number>();
/** Something just happened in the running thing `id`. */
export const pulse = (id: string, now = performance.now()) => void last.set(id, now);
/** How lately `id` pulsed: 1 at a pulse, fading to 0 over `fade` ms. */
export const glow = (id: string, fade = 400, now = performance.now()) => {
  const t = last.get(id);
  return t === undefined ? 0 : Math.max(0, 1 - (now - t) / fade);
};

/** Redraws `draw` every frame while `on`, at the canvas's device scale. */
export function useCanvas(on: boolean, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, t: number) => void) {
  const ref = useRef<HTMLCanvasElement>(null);
  const fn = useRef(draw);
  fn.current = draw;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(3, devicePixelRatio || 1);
    c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Reduce Motion: a still picture, redrawn once a second so a clock on it still counts.
    let raf = 0, timer = 0;
    const tick = () => {
      fn.current(ctx, still() ? 0 : performance.now() / 1000);
      if (!on) return;
      if (still()) timer = window.setTimeout(tick, 1000);
      else raf = requestAnimationFrame(tick);
    };
    tick();
    return () => (cancelAnimationFrame(raf), clearTimeout(timer));
  }, [on, w, h]);
  return ref;
}

/** The ring of `n` dots `r` px out from (`c`, `c`): each swells and brightens with the level `lv`, a ripple running round them. */
export function ring(ctx: CanvasRenderingContext2D, c: number, r: number, n: number, lv: number, t: number, dot = 1.1) {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 - Math.PI / 2, w = 0.5 + 0.5 * Math.sin(k * 1.7 + t * 3);
    ctx.fillStyle = `rgba(${AMBER},${0.25 + 0.6 * lv * w})`;
    ctx.beginPath(); ctx.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, dot + lv * dot * w, 0, 7); ctx.fill();
  }
}

/** The lamp's ring round a small round control, `size` px across, following `level` (0 to 1). */
export function LampRing({ size, level }: { size: number; level: () => number }) {
  const lv = useRef(0);
  const ref = useCanvas(true, size, size, (ctx, t) => {
    lv.current += (level() - lv.current) * 0.2;
    ctx.clearRect(0, 0, size, size);
    ring(ctx, size / 2, size / 2 - 1.6, Math.round(size * 0.62), lv.current, t, 0.6);
  });
  return <canvas ref={ref} className="lamp-ring" style={{ width: size, height: size }} aria-hidden="true" />;
}
