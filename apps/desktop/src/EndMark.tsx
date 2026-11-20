import type { CSSProperties } from "react";

/* The end screen's result marks (D259): small shaded objects in dots, after the "one object you earned"
   reward screens (Runna, Discord) and Duolingo's illustrated result icons. Each is a 16 by 16 sprite, a row per
   line: a digit is how lit that cell is (1 faint to 9 full), and a dot grows and brightens with it, so a face
   in shadow is small dim dots and a face in light is big bright ones. Edit a sprite here by hand. */
const MARKS = {
  // Days or months of memory: a calendar page whose later days are lit, time gained (an hourglass read as a countdown; Tyler, 2026-11-13).
  calendar: [
    "................",
    ".....4.....4....",
    ".....9.....9....",
    "...99999999999..",
    "...99999999999..",
    "...99999999999..",
    "...22222222222..",
    "...24242424242..",
    "...22222222222..",
    "...24292929292..",
    "...22222222222..",
    "...29292929292..",
    "...22222222222..",
    "...12222222221..",
    "................",
    "................",
  ],
} as const;
/* The cells a sprite's dots stand in (x, y, wide, high): the mark's box ends where its dots do, so it sits beside its
   number and over its label by what is seen, not by the sprite's empty margin. */
const BOX: Record<keyof typeof MARKS, [number, number, number, number]> = { calendar: [3, 1, 11, 13] };
export type EndMarkKind = keyof typeof MARKS;

/* The loop (D260): which dots move, and how many ms into the loop each takes its turn: the calendar's added
   days light one by one. A dot that sits still gets null. The move itself is `end-day` in styles.css. */
const turn = (y: number, lit: number, day: number): number | null => (y >= 7 && lit >= 4 ? day * 140 : null);

/** A result's mark, drawn as a `size` px square sprite and boxed to its dots. Decorative: the words beside it say what it counts. */
export function EndMark({ kind, size = 36 }: { kind: EndMarkKind; size?: number }) {
  let day = 0;
  return (
    <svg className="end-mark" data-kind={kind} width={(size * BOX[kind][2]) / 16} height={(size * BOX[kind][3]) / 16} viewBox={BOX[kind].join(" ")} fill="currentColor" aria-hidden="true">
      {MARKS[kind].flatMap((row, y) =>
        [...row].map((t, x) => {
          if (t === ".") return null;
          const a = Number(t) / 9;
          const o = +(0.5 + 0.5 * a).toFixed(2);
          const at = turn(y, Number(t), day);
          if (at !== null) day++;
          return (
            <circle
              key={`${x}-${y}`}
              cx={x + 0.5}
              cy={y + 0.5}
              r={+(0.16 + 0.32 * a).toFixed(3)}
              opacity={o}
              data-turn={at ?? undefined}
              style={{ "--o": o, "--at": at === null ? undefined : `${at}ms` } as CSSProperties}
            />
          );
        }),
      )}
    </svg>
  );
}
