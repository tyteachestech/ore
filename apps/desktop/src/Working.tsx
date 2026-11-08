import { useEffect, useState, type ReactNode } from "react";

/** What the AI is doing while he waits, each with its own pattern on the matrix (D146). */
export type Stage = "work" | "read" | "search" | "write" | "check";

/** A wait the app is doing for him (Claude's and ChatGPT's status line, RareUI's inline AI status): a
 *  5×5 dot matrix before the label whose pattern says what kind of work it is (D146), so it never
 *  looks frozen and he knows where the answer is coming from. `slow` is said once the wait passes
 *  5 s, so a long one says how long it takes instead of leaving him to guess. Reduced motion keeps
 *  the matrix still. */
export function Working({ label, children, slow, stage = "work" }: { label: string; children?: ReactNode; slow?: string; stage?: Stage }) {
  const late = useLate(!!slow);
  return (
    <>
      <span className="working" role="status">
        <Matrix stage={stage} />
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

const ring = [[1, 0], [2, 0], [3, 0], [4, 1], [4, 2], [4, 3], [3, 4], [2, 4], [1, 4], [0, 3], [0, 2], [0, 1]] as const;
const grid = (lit: (x: number, y: number) => "X" | "x" | "." | boolean) =>
  Array.from({ length: 5 }, (_, y) => Array.from({ length: 5 }, (_, x) => { const c = lit(x, y); return c === true ? "X" : c === false ? "." : c; }).join(""));
const same = (a: readonly [number, number], x: number, y: number) => a[0] === x && a[1] === y;

/** One frame list per stage, 5 rows of 5 cells: "X" lit, "x" dim, "." off. Hard frames, no easing (D113).
 *  work: two cells chase each other round the edge. read: a line passes down the rows, as eyes do.
 *  search: a radar arm sweeps from the centre. write: cells fill the three middle rows like typed
 *  text. check: a pixel check draws itself cell by cell, then holds. */
export const MATRIX: Record<Stage, string[][]> = {
  work: ring.map((_, i) => grid((x, y) => (same(ring[i]!, x, y) || same(ring[(i + 6) % 12]!, x, y) ? "X" : same(ring[(i + 11) % 12]!, x, y) || same(ring[(i + 5) % 12]!, x, y) ? "x" : "."))),
  read: [...Array.from({ length: 5 }, (_, r) => grid((_x, y) => (y === r ? "X" : y === r - 1 ? "x" : "."))), grid((_x, y) => (y === 4 ? "x" : "."))],
  search: [[4, 2], [4, 4], [2, 4], [0, 4], [0, 2], [0, 0], [2, 0], [4, 0]].map(([ex, ey], i, arms) => {
    const arm = (a: number[]) => [[2, 2], [(a[0]! + 2) / 2, (a[1]! + 2) / 2], a] as number[][];
    const was = arm(arms[(i + arms.length - 1) % arms.length]!);
    return grid((x, y) => (arm([ex!, ey!]).some(([ax, ay]) => ax === x && ay === y) ? "X" : was.some(([ax, ay]) => ax === x && ay === y) ? "x" : "."));
  }),
  write: [...Array.from({ length: 15 }, (_, n) => grid((x, y) => (y < 1 || y > 3 ? "." : (y - 1) * 5 + x < n ? "X" : (y - 1) * 5 + x === n ? "x" : "."))), grid((_x, y) => (y >= 1 && y <= 3 ? "X" : "."))],
  check: (() => {
    const cells = [[0, 2], [1, 3], [2, 4], [3, 3], [4, 2], [4, 1], [4, 0]];
    const upto = (n: number) => grid((x, y) => cells.slice(0, n).some(([cx, cy]) => cx === x && cy === y));
    return [...cells.map((_, i) => upto(i + 1)), upto(7), upto(7), upto(0)];
  })(),
};
/** The frame shown under reduced motion: the one that reads as the stage on its own. */
export const STILL: Record<Stage, number> = { work: 0, read: 2, search: 0, write: 7, check: 6 };
const PACE: Record<Stage, number> = { work: 100, read: 160, search: 110, write: 90, check: 120 };

/** The 5×5 dot matrix: 2 px cells a pixel apart, lit in the text's colour, trailing cells at 40% and the
 *  unlit grid at 12%, so the matrix reads as one mark and not a dash. Still
 *  under reduced motion and in tests (no timers), on the stage's telling frame. */
export function Matrix({ stage = "work", className }: { stage?: Stage; className?: string }) {
  const frames = MATRIX[stage];
  const still = typeof matchMedia !== "function" || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    if (still) return;
    const t = setInterval(() => setI((n) => (n + 1) % frames.length), PACE[stage]);
    return () => clearInterval(t);
  }, [stage, still, frames.length]);
  const rows = frames[still ? STILL[stage] : i]!;
  return (
    <svg className={`matrix${className ? ` ${className}` : ""}`} data-stage={stage} width={14} height={14} viewBox="0 0 14 14" aria-hidden="true" shapeRendering="crispEdges">
      {rows.flatMap((row, y) => [...row].map((c, x) => <rect key={`${x}.${y}`} className={c === "x" ? "dim" : c === "." ? "off" : undefined} x={x * 3} y={y * 3} width={2} height={2} />))}
    </svg>
  );
}
