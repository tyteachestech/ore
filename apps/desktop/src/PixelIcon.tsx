import type { SVGProps } from "react";

// Pixel icons (D101): 12×12 sprites in the current colour, drawn like the gems: the highlight types and
// the skill page's section icons. `#` is the colour, `+` the colour at 40% (a second tone), `o` white.
// They render at a multiple of 6px so every sprite pixel lands on whole device pixels on a Retina screen.

type Props = Omit<SVGProps<SVGSVGElement>, "ref"> & { size?: number; weight?: string };

/** A sprite's pixels as one path per tone (`#`, `+`, `o`): three elements instead of up to 144 rects,
 *  so a source with hundreds of margin marks re-renders cheaply. One path has no seams between its squares. */
function paths(rows: readonly string[], outline: boolean): Record<string, string> {
  const out: Record<string, string> = { "#": "", "+": "", o: "" };
  rows.forEach((row, y) =>
    [...row].forEach((t, x) => {
      if (t === "." || !(t in out)) return;
      // "regular" draws the outline only, so an unselected type reads lighter than the chosen one.
      if (outline && (t !== "#" || [rows[y - 1]?.[x], rows[y + 1]?.[x], row[x - 1], row[x + 1]].every((n) => n && n !== "."))) return;
      out[t] += `M${x} ${y}h1v1h-1z`;
    }),
  );
  return out;
}

const sprite = (rows: readonly string[]) => {
  const solid = paths(rows, false);
  const outlined = paths(rows, true);
  return function PixelIcon({ size = 12, weight, ...rest }: Props) {
    const px = Math.max(12, Math.floor(size / 6) * 6);
    const d = weight === "regular" ? outlined : solid;
    return (
      <svg width={px} height={px} viewBox="0 0 12 12" shapeRendering="crispEdges" fill="currentColor" {...rest}>
        {d["#"] && <path d={d["#"]} />}
        {d["+"] && <path d={d["+"]} fillOpacity={0.4} />}
        {d.o && <path d={d.o} fill="#fff" />}
      </svg>
    );
  };
};

/** Keep: a highlighter's chisel tip over the line it marks. */
export const PixelKeep = sprite([
  "........##..",
  ".......####.",
  "......####..",
  ".....####...",
  "....####....",
  "...####.....",
  "..#.##......",
  "..##........",
  ".##.........",
  "............",
  "############",
  "############",
]);

/** Key point (D118): a star, so the highlight comes back in review. */
export const PixelStar = sprite([
  ".....##.....",
  ".....##.....",
  "....####....",
  "....####....",
  "############",
  ".##########.",
  "..########..",
  "...######...",
  "...######...",
  "..###..###..",
  "..##....##..",
  ".#........#.",
]);

/** Your note: a spiral notepad with written lines. */
export const PixelNote = sprite([
  "..#.#.#.#...",
  ".#########..",
  ".#+++++++#..",
  ".#+#####+#..",
  ".#+++++++#..",
  ".#+#####+#..",
  ".#+++++++#..",
  ".#+###+++#..",
  ".#+++++++#..",
  ".#########..",
  "............",
  "............",
]);

/** To read: an open book. */
export const PixelBook = sprite([
  "............",
  ".####..####.",
  "#++++##++++#",
  "#+##+##+##+#",
  "#++++##++++#",
  "#+##+##+##+#",
  "#++++##++++#",
  "#+##+##+##+#",
  "#++++##++++#",
  "#####..#####",
  ".....##.....",
  "............",
]);

/** Collected: what he has gathered from a source, a stack of cards. */
export const PixelStack = sprite([
  "............",
  "....########",
  "....#++++++#",
  "..########+#",
  "..#++++++#+#",
  "########+###",
  "#++++++#+#..",
  "#++++++###..",
  "#++++++#....",
  "#++++++#....",
  "########....",
  "............",
]);

/** Question: a question mark. */
export const PixelQuestion = sprite([
  "...######...",
  "..########..",
  "..##....##..",
  "..##....##..",
  "........##..",
  ".......###..",
  ".....####...",
  ".....##.....",
  ".....##.....",
  "............",
  ".....##.....",
  ".....##.....",
]);
