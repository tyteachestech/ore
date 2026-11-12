import type { SVGProps } from "react";
import { dots, spriteSize } from "./icons";

// Highlight-type and section icons, drawn like the UI icons in icons.tsx: 16-grid sprites after MingCute's filled set,
// in the current colour, each pixel a round dot, a quarter bigger than asked (20px for 16, 40px at 24 and up, D171).

type Props = Omit<SVGProps<SVGSVGElement>, "ref"> & { size?: number; weight?: string };

/** The sprite's edge only: each filled cell that touches an empty one or the border, for `weight="regular"` (an off state). */
export const outline = (rows: readonly string[]) =>
  rows.map((row, y) =>
    [...row].map((c, x) => (c === "#" && [rows[y - 1]?.[x], rows[y + 1]?.[x], row[x - 1], row[x + 1]].some((n) => n !== "#") ? "#" : ".")).join(""),
  );

const sprite = (rows: readonly string[]) => {
  const d = dots(rows), line = dots(outline(rows));
  return function PixelIcon({ size = 16, weight, ...rest }: Props) {
    const px = spriteSize(size);
    return (
      <svg width={px} height={px} viewBox="0 0 16 16" fill="currentColor" data-sprite="" {...rest}>
        <path d={weight === "regular" ? line : d} />
      </svg>
    );
  };
};

/** Keep: a highlighter over the line it marks. */
export const PixelKeep = sprite([
  "................",
  "..........##....",
  ".........####...",
  "........######..",
  ".......######...",
  "......######....",
  ".....######.....",
  "....######......",
  "...######.......",
  "...#####........",
  "..#..###........",
  "..##..#.........",
  ".####...........",
  "................",
  ".###########....",
  "................",
]);

/** Key point (D118, D229): a cut gem, the ore worth keeping, which review cuts into one of his gems. A star read as jank in dots. */
export const PixelGem = sprite([
  "................",
  "................",
  "................",
  "....########....",
  "...##########...",
  "..############..",
  ".##############.",
  ".##############.",
  "..############..",
  "...##########...",
  "....########....",
  ".....######.....",
  "......####......",
  ".......##.......",
  "................",
  "................",
]);

/** Try it (D127): a flask with liquid in it, the experiment he runs on his own work. */
export const PixelTry = sprite([
  "................",
  "....########....",
  "......#..#......",
  "......#..#......",
  "......#..#......",
  ".....##..##.....",
  ".....#....#.....",
  "....##....##....",
  "...##########...",
  "...##########...",
  "..############..",
  "..############..",
  "..############..",
  "...##########...",
  "................",
  "................",
]);

/** Your note: a notepad with written lines. */
export const PixelNote = sprite([
  "................",
  "................",
  "................",
  "...##########...",
  "..############..",
  "..############..",
  "..###......###..",
  "..############..",
  "..###......###..",
  "..############..",
  "..###....#####..",
  "..############..",
  "..############..",
  "...##########...",
  "................",
  "................",
]);

/** To read: a closed book, its pages showing at the foot (MingCute's book_2; an open book read as a butterfly). */
export const PixelBook = sprite([
  "................",
  "....#########...",
  "...##########...",
  "...##########...",
  "...###.....##...",
  "...##########...",
  "...##########...",
  "...##########...",
  "...##########...",
  "...##########...",
  "...##########...",
  "...#............",
  "...#.#########..",
  "...#............",
  "....##########..",
  "................",
]);

/** Original: the source's own page, a sheet with a folded corner and its lines (MingCute's document). */
export const PixelPage = sprite([
  "................",
  "................",
  "...#######......",
  "...#######.#....",
  "...#######.##...",
  "...#######......",
  "...##########...",
  "...##......##...",
  "...##########...",
  "...##......##...",
  "...##########...",
  "...##....####...",
  "...##########...",
  "...##########...",
  "................",
  "................",
]);

/** Collected: what he has gathered from a source, a stack of sheets. */
export const PixelStack = sprite([
  "................",
  ".....#########..",
  ".....#########..",
  ".....##.....##..",
  "..#######...##..",
  "..#######...##..",
  "..#######...##..",
  "..#######...##..",
  "..#######...##..",
  "..#######...##..",
  "..#######.####..",
  "..#######.####..",
  "..#######.......",
  "..#######.......",
  "..#######.......",
  "................",
]);

/** Question (D229): a bare bold question mark, three dots thick. Cut from a coin it turned to mush at 20px. */
export const PixelQuestion = sprite([
  "................",
  ".....######.....",
  "....########....",
  "...###....###...",
  "...###....###...",
  "..........###...",
  ".........###....",
  "........###.....",
  ".......###......",
  ".......###......",
  "................",
  ".......###......",
  ".......###......",
  ".......###......",
  "................",
  "................",
]);
