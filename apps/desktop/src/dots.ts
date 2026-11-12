// A 16-grid sprite as round dots, one per pixel, in one path: the UI icons (icons.tsx, PixelIcon.tsx) and the skill
// icons (vite.config.ts) draw through this, so all of them share one dot. Its radius is 0.38 of a cell (D170): at 20px the gaps between dots stay even.
// The drawing is centred on the grid by its ink, in whole cells, so icons line up beside their labels whatever space
// each drawing leaves around it. Whole cells keep every dot on the same sub-pixel phase pattern at 20px.
export const DOT = 0.38;
const d = DOT.toString().replace(/^0/, "");
/** The lit cells of a sprite, centred on the grid by its ink. */
export const cells = (rows: readonly string[]): (readonly [number, number])[] => {
  const on = rows.flatMap((row, y) => [...row].flatMap((t, x) => (t === "#" ? [[x, y] as const] : [])));
  if (!on.length) return [];
  const xs = on.map(([x]) => x), ys = on.map(([, y]) => y);
  const dx = Math.floor(7.5 - (Math.min(...xs) + Math.max(...xs)) / 2 + 0.5), dy = Math.floor(7.5 - (Math.min(...ys) + Math.max(...ys)) / 2 + 0.5);
  return on.map(([x, y]) => [x + dx, y + dy] as const);
};
export const dots = (rows: readonly string[]) =>
  cells(rows).map(([x, y]) => `M${x + 0.5} ${+(y + 0.5 - DOT).toFixed(2)}a${d} ${d} 0 1 0 0 ${2 * DOT}a${d} ${d} 0 1 0 0-${2 * DOT}z`).join("");
