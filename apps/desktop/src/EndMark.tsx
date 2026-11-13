/* The end screen's result marks (D259): small shaded objects in dots, after the "one object you earned"
   reward screens (Runna, Discord) and Duolingo's illustrated result icons. Each is a 16 by 16 sprite, a row per
   line: a digit is how lit that cell is (1 faint to 9 full), and a dot grows and brightens with it, so a face
   in shadow is small dim dots and a face in light is big bright ones. Edit a sprite here by hand. */
const MARKS = {
  // Memories kept: a cut gem lit from the top left; every face keeps enough light to hold the outline.
  gem: [
    "................",
    "................",
    "....1666666.....",
    "...168999984....",
    "...6689999744...",
    "..566799995443..",
    ".57777888844443.",
    ".28888655533331.",
    "..388865543331..",
    "...4887554332...",
    "....58855332....",
    ".....686532.....",
    "......6643......",
    "......163.......",
    ".......1........",
    "................",
  ],
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
  // A long gap recalled across: a comet, from far off and still bright, its tail in three streaks.
  comet: [
    "................",
    "................",
    "............22..",
    "...........33...",
    ".........343....",
    ".......2553.....",
    "......465332....",
    "....3676344.....",
    "...6886354......",
    "..3999652.......",
    "..8999941.......",
    "..999996........",
    "..799992........",
    "..17983.........",
    "................",
    "................",
  ],
} as const;
export type EndMarkKind = keyof typeof MARKS;

/** A result's mark, `size` px square. Decorative: the words beside it say what it counts. */
export function EndMark({ kind, size = 48 }: { kind: EndMarkKind; size?: number }) {
  return (
    <svg className="end-mark" data-kind={kind} width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      {MARKS[kind].flatMap((row, y) =>
        [...row].map((t, x) => {
          if (t === ".") return null;
          const a = Number(t) / 9;
          return <circle key={`${x}-${y}`} cx={x + 0.5} cy={y + 0.5} r={+(0.16 + 0.32 * a).toFixed(3)} opacity={a < 1 ? +(0.5 + 0.5 * a).toFixed(2) : undefined} />;
        }),
      )}
    </svg>
  );
}
