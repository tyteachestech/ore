/* The ambience radio's screen (D254): an amber dot-matrix LCD, drawn as round dots like the rest of Ore (D183).
   Pure drawing on a grid of brightness values, so tests can read it without a canvas. */

export type ChannelId = "cave" | "rain" | "lamp" | "deep" | "focus";
export const CHANNELS: { id: ChannelId; name: string; screen: string }[] = [
  { id: "cave", name: "Cave", screen: "CAVE" },
  { id: "rain", name: "Rain", screen: "RAIN" },
  { id: "lamp", name: "Lamp", screen: "LAMP" },
  { id: "deep", name: "Deep mine", screen: "DEEP" },
  { id: "focus", name: "Focus", screen: "FOCUS" },
];

/** A grid of dot brightness: 0 off, 1 lit, over 1 a hot peak. */
export type Grid = { cols: number; rows: number; lit: Float32Array; set(x: number, y: number, v?: number): void; clear(): void };
export function grid(cols: number, rows: number): Grid {
  const lit = new Float32Array(cols * rows);
  return {
    cols, rows, lit,
    set(x, y, v = 1) {
      x = Math.round(x); y = Math.round(y);
      if (x < 0 || x >= cols || y < 0 || y >= rows) return;
      const k = y * cols + x;
      lit[k] = Math.max(lit[k]!, v);
    },
    clear: () => lit.fill(0),
  };
}

/** 5 by 7 letters for what the screen says: the channel names, the clock and OFF. */
const FONT: Record<string, string> = {
  A: "01110100011000111111100011000110001", C: "01110100011000010000100001000101110", D: "11110100011000110001100011000111110",
  E: "11111100001000011110100001000011111", F: "11111100001000011110100001000010000", I: "01110001000010000100001000010001110",
  L: "10000100001000010000100001000011111", M: "10001110111010110101100011000110001", N: "10001110011010110011100011000110001",
  O: "01110100011000110001100011000101110", P: "11110100011000111110100001000010000", R: "11110100011000111110101001001010001",
  S: "01111100001000001110000010000111110", U: "10001100011000110001100011000101110", V: "10001100011000110001100010101000100",
  0: "01110100111010110101110011000101110", 1: "00100011000010000100001000010001110", 2: "01110100010000100010001000100011111",
  3: "11110000010000101110000010000111110", 4: "00010001100101010010111110001000010", 5: "11111100001111000001000011000101110",
  6: "00110010001000011110100011000101110", 7: "11111000010001000100010000100001000", 8: "01110100011000101110100011000101110",
  9: "01110100011000101111000010001001100", ":": "00000001000010000000001000010000000", " ": "00000000000000000000000000000000000",
};
export const hasGlyph = (ch: string) => ch in FONT;
/** Writes `s` at (x, y); returns the column after it. */
export function text(g: Grid, s: string, x: number, y: number, v = 1) {
  for (const ch of s) {
    const f = FONT[ch] ?? FONT[" "]!;
    for (let k = 0; k < 35; k++) if (f[k] === "1") g.set(x + (k % 5), y + Math.floor(k / 5), v);
    x += 6;
  }
  return x;
}
export const textWidth = (s: string) => s.length * 6 - 1;

/** mm:ss since `start` (seconds). */
export function clock(seconds: number) {
  const e = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(e / 60) % 100).padStart(2, "0")}:${String(e % 60).padStart(2, "0")}`;
}

/** Each channel's icon on an 11 grid: a stalactite and its drop, a rain cloud, a flame, an ore cart, headphones.
 *  The speaker is the radio while nothing plays. */
export const ICONS: Record<ChannelId | "speaker", string[]> = {
  cave: ["###########", ".#########.", "...#####...", "....###....", ".....#.....", "...........", ".....#.....", "....###....", "...#####...", "...#####...", "....###...."],
  rain: ["....###....", "..#######..", ".#########.", "###########", ".#########.", "...........", "..#...#...#", ".#...#...#.", "...........", "#...#...#..", "...#...#..."],
  lamp: [".....#.....", "....##.....", "....###....", "...####....", "...#####...", "..#######..", "..###.###..", ".###...###.", ".##.....##.", "..##...##..", "...#####..."],
  deep: ["...........", "...#..##...", "..#######..", "###########", ".#########.", ".#########.", "..#######..", "...........", "..##...##..", "..##...##..", "..........."],
  focus: ["...#####...", "..#.....#..", ".#.......#.", "#.........#", "#.........#", "#.........#", "##.......##", "###.....###", "###.....###", "###.....###", ".#.......#."],
  speaker: ["....#......", "...##......", "..###..#...", "#####...#..", "#####.#..#.", "#####.#..#.", "#####...#..", "..###..#...", "...##......", "....#......", "..........."],
};
/** The icon at (x0, y0); `wave` > 0 sweeps a light down it, as if the channel were humming. */
export function icon(g: Grid, id: keyof typeof ICONS, x0: number, y0: number, v = 1, wave = -1) {
  ICONS[id].forEach((row, y) => [...row].forEach((c, x) => {
    if (c === "#") g.set(x0 + x, y0 + y, wave < 0 ? v : v * (0.55 + 0.45 * Math.max(0, Math.sin((y - wave * 9) * 0.55))));
  }));
}

/** A little dot scene per channel, 22 by 22 from (x0, 0): drips in a cave, rain, a lamp's flame, a cart on its rails,
 *  notes rising. `t` in seconds; a still (Reduce Motion) passes a fixed t. Slow on purpose: it sits by his reading. */
export function scene(g: Grid, id: ChannelId, t: number, x0 = 0) {
  const set = (x: number, y: number, v = 1) => { if (x >= -0.5 && x < 21.5) g.set(x0 + x, y, v); };
  const floor = (v: number) => { for (let x = 0; x < 22; x++) set(x, 21, v); };
  if (id === "cave") {
    const rock = [3, 2, 1, 2, 4, 2, 1, 1, 3, 5, 3, 1, 2, 1, 2, 4, 2, 1, 3, 2, 1, 2];
    rock.forEach((d, x) => { for (let y = 0; y < d; y++) set(x, y, 0.45); });
    floor(0.3);
    for (const [x, o] of [[9, 0], [14, 1.1]] as const) {
      const p = ((t + o) % 2.4) / 2.4;
      if (p < 0.7) { const y = 5 + 16 * (p / 0.7) ** 2; set(x, y); set(x, y - 1, 0.5); }
      else { const k = (p - 0.7) / 0.3, r = k * 5; for (const d of [-1, 1]) set(x + d * r, 20, 1 - k); if (r < 1.5) set(x, 19, 1 - k); }
    }
  } else if (id === "rain") {
    for (let k = 0; k < 14; k++) {
      const speed = 12 + ((k * 7) % 7), y = ((k * 13 + t * speed) % 26) - 3, x = (k * 5.3 + y * 0.35) % 22;
      set(x, y); set(x - 0.35, y - 1, 0.5); set(x - 0.7, y - 2, 0.2);
    }
    floor(0.3);
  } else if (id === "lamp") {
    for (let x = 6; x < 16; x++) { set(x, 20, 0.5); set(x, 21, 0.5); }
    for (let x = 8; x < 14; x++) set(x, 2, 0.35);
    const f = 1 + 0.12 * Math.sin(t * 6) + 0.08 * Math.sin(t * 15);
    for (let y = 5; y < 20; y++) {
      const u = (19 - y) / (14 * f);
      if (u > 1) continue;
      const hw = 4.2 * Math.sin(Math.PI * Math.min(1, u * 1.05 + 0.05)) ** 0.8 * (u < 0.25 ? 1 : 1 - 0.3 * u), sway = Math.sin(t * 4 + y * 0.5) * u * 1.2;
      for (let x = -Math.round(hw); x <= Math.round(hw); x++) { const core = 1 - Math.abs(x) / (hw + 1); set(11 + x + sway, y, core > 0.6 && u < 0.6 ? 1.2 : 0.4 + 0.6 * core); }
    }
  } else if (id === "deep") {
    for (let x = 0; x < 22; x++) { set(x, 21, 0.5); if (x % 3 === 0) set(x, 20, 0.25); }
    const cx = ((t * 3) % 32) - 8;
    for (let x = 0; x < 7; x++) for (let y = 14; y < 18; y++) if (!(y === 17 && (x === 0 || x === 6))) set(cx + x, y, y === 14 ? 0.9 : 0.6);
    for (const [x, y] of [[1, 12], [3, 12], [2, 13], [4, 13], [5, 13]] as const) set(cx + x, y, 0.8);
    set(cx + 1, 19); set(cx + 5, 19);
    const p = (t % 1.8) / 1.8;
    if (p < 0.3) { const sx = 4 + ((Math.floor(t / 1.8) * 7) % 14), r = 1 + p * 4; for (const [dx, dy] of [[0, 0], [1, -1], [-1, -1], [2, 0], [-2, 0]] as const) set(sx + dx * r, 6 + dy * r, 1 - p / 0.3); }
  } else {
    const note = ["..##", "..#.", "..#.", "###.", "###."];
    for (let k = 0; k < 3; k++) {
      const p = (t * 0.25 + k / 3) % 1, y = 19 - p * 17, x = 4 + k * 6 + Math.sin(t * 1.2 + k) * 2, v = p < 0.15 ? p / 0.15 : p > 0.8 ? (1 - p) / 0.2 : 1;
      note.forEach((r, ry) => [...r].forEach((c, rx) => c === "#" && set(x + rx, y + ry - 4, v)));
    }
  }
}

const ease = (x: number) => 1 - (1 - Math.max(0, Math.min(1, x))) ** 3;
/** The power-down, an old screen switching off: what was lit squeezes to the middle row, then to one dot that fades.
 *  `s` is seconds since it stopped; false once it is over. */
export function powerDown(g: Grid, from: Float32Array, s: number) {
  if (s >= 1) return false;
  const my = Math.floor(g.rows / 2), mx = Math.floor(g.cols / 2);
  if (s < 0.5) {
    const k1 = ease(s / 0.26), k2 = ease((s - 0.2) / 0.24);
    for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
      const v = from[y * g.cols + x]!;
      if (v > 0) g.set(x + (mx - x) * k2, y + (my - y) * k1, v * (1 - 0.5 * k2));
    }
  } else g.set(mx, my, 1 - ease((s - 0.5) / 0.5));
  return true;
}

/** The big screen: the scene on the left, the name and the clock on the right, a level line under them. */
export function bigScreen(g: Grid, id: ChannelId, t: number, seconds: number, level: number) {
  const ch = CHANNELS.find((c) => c.id === id)!;
  scene(g, id, t);
  text(g, ch.screen, 25, 4);
  text(g, clock(seconds), 25, 13, 0.4);
  const n = Math.round(Math.min(1, level) * (g.cols - 27));
  for (let x = 0; x < g.cols - 27; x++) if (x < n) g.set(25 + x, 20, 0.9);
}

/** Paints `g` as round dots `s` px apart. Unlit dots show faintly, like an LCD's glass. */
export function paint(ctx: CanvasRenderingContext2D, g: Grid, s: number, rgb: string, glass = 0.06) {
  ctx.clearRect(0, 0, g.cols * s, g.rows * s);
  for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
    const v = g.lit[y * g.cols + x]!;
    const cx = x * s + s / 2, cy = y * s + s / 2;
    if (v <= 0) { if (glass) { ctx.fillStyle = `rgba(${rgb},${glass})`; ctx.beginPath(); ctx.arc(cx, cy, s * 0.3, 0, 7); ctx.fill(); } continue; }
    ctx.fillStyle = v > 1.05 ? `rgba(255,240,210,${Math.min(1, 0.12 + 0.88 * v)})` : `rgba(${rgb},${Math.min(1, 0.12 + 0.88 * v)})`;
    ctx.beginPath(); ctx.arc(cx, cy, s * (0.3 + 0.1 * Math.min(1, v)), 0, 7); ctx.fill();
  }
}
