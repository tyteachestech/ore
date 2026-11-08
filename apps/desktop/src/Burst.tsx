import type { CSSProperties } from "react";

/** Where each pixel of a burst flies, deterministic so the burst looks the same every time: `n` squares
 *  round the circle, from just outside the badge's edge (`from`) out to two radii, the far ones a little
 *  later, all once the badge has popped (D153). */
export function burstOffsets(n = 14, from = 36): { x0: number; y0: number; dx: number; dy: number; delay: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2;
    const r = i % 2 ? 92 : 72;
    const at = (d: number) => [Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d)] as const;
    const [x0, y0] = at(from), [dx, dy] = at(r);
    return { x0, y0, dx, dy, delay: 220 + (i % 2 ? 60 : 0) };
  });
}

/** A one-time burst of square pixels in the skill's colour (`--skill`), out of whatever it sits in (D153).
 *  Hard frames (D113); nothing under reduced motion. Marks a source done, never a count or a streak (D23). */
export function PixelBurst() {
  return (
    <span className="pixel-burst" aria-hidden="true">
      {burstOffsets().map((o, i) => (
        <i key={i} style={{ "--x0": `${o.x0}px`, "--y0": `${o.y0}px`, "--dx": `${o.dx}px`, "--dy": `${o.dy}px`, "--d": `${o.delay}ms` } as CSSProperties} />
      ))}
    </span>
  );
}
