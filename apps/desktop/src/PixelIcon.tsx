import type { SVGProps } from "react";
import { pixels } from "./icons";

// Highlight-type and section icons, drawn like the UI icons in icons.tsx: 16-grid sprites after MingCute's filled set,
// in the current colour, at 16px (32px at 24 and up) so every pixel lands on whole device pixels on a Retina screen.

type Props = Omit<SVGProps<SVGSVGElement>, "ref"> & { size?: number; weight?: string };

/** The sprite's edge only: each filled cell that touches an empty one or the border, for `weight="regular"` (an off state). */
export const outline = (rows: readonly string[]) =>
  rows.map((row, y) =>
    [...row].map((c, x) => (c === "#" && [rows[y - 1]?.[x], rows[y + 1]?.[x], row[x - 1], row[x + 1]].some((n) => n !== "#") ? "#" : ".")).join(""),
  );

const sprite = (rows: readonly string[]) => {
  const d = pixels(rows), line = pixels(outline(rows));
  return function PixelIcon({ size = 16, weight, ...rest }: Props) {
    const px = size >= 24 ? 32 : 16;
    return (
      <svg width={px} height={px} viewBox="0 0 16 16" shapeRendering="crispEdges" fill="currentColor" {...rest}>
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

/** Key point (D118): a star, so the highlight comes back in review. */
export const PixelStar = sprite([
  "................",
  "................",
  ".......##.......",
  "......####......",
  "......####......",
  ".....######.....",
  ".##############.",
  "..############..",
  "...##########...",
  "....########....",
  "....########....",
  "...##########...",
  "...####..####...",
  "..###......###..",
  "................",
  "................",
]);

/** Try it (D127): a flask, the experiment he runs on his own work. */
export const PixelTry = sprite([
  "................",
  ".....######.....",
  "......####......",
  "......####......",
  "......####......",
  "......####......",
  ".....######.....",
  "....########....",
  "...##########...",
  "...#####..###...",
  "..######..####..",
  "..############..",
  "..############..",
  "...##########...",
  "................",
  "................",
]);

/** Your note: a notepad with written lines. */
export const PixelNote = sprite([
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

/** Question: a question mark cut from a round coin (14 rows with short flat sides, so it doesn't read as clipped). */
export const PixelQuestion = sprite([
  "................",
  "......####......",
  "....########....",
  "...##########...",
  "..####....####..",
  "..###..##..###..",
  ".#######..#####.",
  ".######..######.",
  ".######..######.",
  ".##############.",
  "..#####..#####..",
  "..#####..#####..",
  "...##########...",
  "....########....",
  "......####......",
  "................",
]);
