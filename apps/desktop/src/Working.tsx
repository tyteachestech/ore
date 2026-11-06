import { useEffect, useState, type ReactNode } from "react";

/** A wait the app is doing for him (Claude's and ChatGPT's status line, RareUI's inline AI status): a
 *  4-frame pixel spinner before the label so it never looks frozen (D113). `slow` is said once the
 *  wait passes 5 s, so a long one says how long it takes instead of leaving him to guess. Reduced
 *  motion keeps the spinner still. */
export function Working({ label, children, slow }: { label: string; children?: ReactNode; slow?: string }) {
  const late = useLate(!!slow);
  return (
    <>
      <span className="working" role="status">
        <PixelSpin />
        {label}
      </span>
      {children && <> {children}</>}
      {late && <span className="working-slow"> {slow}</span>}
    </>
  );
}

/** True once a wait passes 5 s, for a wait drawn its own way that still says how long it takes. */
export function useLate(on = true) {
  const [late, setLate] = useState(false);
  useEffect(() => {
    setLate(false);
    if (!on) return;
    const t = setTimeout(() => setLate(true), 5000);
    return () => clearTimeout(t);
  }, [on]);
  return late;
}

/** 8-bit sprites drawn on a grid of 2 px cells ("X" is ink), crisp at any zoom (D113). */
export const CHECK = ["......X", ".....XX", "X...XX.", "XX.XX..", ".XXX...", "..X...."];
export const CROSS = ["X....X", ".X..X.", "..XX..", "..XX..", ".X..X.", "X....X"];
export function Sprite({ rows, className }: { rows: string[]; className?: string }) {
  const w = rows[0]!.length * 2;
  const h = rows.length * 2;
  return (
    <svg className={`sprite${className ? ` ${className}` : ""}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" shapeRendering="crispEdges">
      {rows.flatMap((row, y) => [...row].map((c, x) => (c === "X" ? <rect key={`${x}.${y}`} x={x * 2} y={y * 2} width={2} height={2} /> : null)))}
    </svg>
  );
}

/** A 4-frame spinner: one lit cell of four walks clockwise. Still under reduced motion. */
export function PixelSpin() {
  return (
    <span className="pixel-spin" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
