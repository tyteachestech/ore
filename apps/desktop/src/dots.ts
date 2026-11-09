// A 16-grid sprite as round dots, one per pixel, in one path: the UI icons (icons.tsx, PixelIcon.tsx) and the skill
// icons (vite.config.ts) draw through this, so all of them share one dot. Its radius is 0.38 of a cell (D170): at 24px
// that is the ink the old 0.44 dot had at 20px, with the gap between dots still showing.
export const DOT = 0.38;
const d = DOT.toString().replace(/^0/, "");
export const dots = (rows: readonly string[]) =>
  rows.map((row, y) => [...row].map((t, x) => (t === "#" ? `M${x + 0.5} ${y + 0.5 - DOT}a${d} ${d} 0 1 0 0 ${2 * DOT}a${d} ${d} 0 1 0 0-${2 * DOT}z` : "")).join("")).join("");
