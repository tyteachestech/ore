// Redraws each MingCute fill icon of the skill icon set (src/skill-icon-set.ts, D157) on the UI icons' 16-pixel grid
// (D129), so a skill's icon reads as 8-bit like the rest of the app. Each SVG is drawn at 16x16 in Chromium and a pixel is on where the
// shape covers it enough. Writes src/skill-icons.json ({ name: 16 rows of 4 hex digits }); vite.config.ts turns each
// into /mingcute-px/<name>.svg. Hand fixes go in src/skill-icon-fixes.ts and win over this file.
// Run after a MingCute update or a change to the set: bun apps/desktop/scripts/pixel-skill-icons.ts
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { SKILL_ICON_SET } from "../src/skill-icon-set";

const ROOT = new URL("../", import.meta.url).pathname;
const SVG = `${ROOT}node_modules/mingcute_icon/svg`;
const files = new Map(readdirSync(SVG).flatMap((c) => readdirSync(`${SVG}/${c}`).map((f) => [f, `${SVG}/${c}/${f}`] as const)));
const icons = SKILL_ICON_SET.map(([name]) => {
  const file = files.get(`${name}_fill.svg`);
  if (!file) throw new Error(`no MingCute fill icon named ${name}`);
  return [name, readFileSync(file, "utf8")] as const;
});

const browser = await chromium.launch();
const page = await browser.newPage();
// Each icon is drawn at 128×128, eroded by 2 samples so the gaps a 16 grid would swallow (a coin's digit, a
// target's rings) stay open, then a cell is on when 40% of its 8×8 samples are: cleaner than a 16×16 draw with
// an alpha threshold, which filled every hole (2026-11-09).
const R = 8, E = 2;
// Drawn without the erosion: thin shapes (legs, rays, a line) that it would break, and read fine plain.
const PLAIN = new Set(
  "sun_2 umbrella bridge screwdriver chopsticks run walk git_branch sitemap list_check wave wind pickax cactus ruler balance eyeglass thermometer flower tree hand".split(" "),
);
const out: Record<string, string[]> = await page.evaluate(
  async ({ list, R, E }) => {
    const res: Record<string, string[]> = {};
    const N = 16 * R;
    const c = document.createElement("canvas");
    c.width = c.height = N;
    const x = c.getContext("2d", { willReadFrequently: true })!;
    for (const [name, svg, plain] of list) {
      const img = new Image();
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.replace(/currentColor/g, "#000"));
      await img.decode();
      x.clearRect(0, 0, N, N);
      x.drawImage(img, 0, 0, N, N);
      const d = x.getImageData(0, 0, N, N).data;
      const on = (i: number, j: number) => i >= 0 && j >= 0 && i < N && j < N && d[(j * N + i) * 4 + 3]! > 127;
      const eroded = (i: number, j: number) => {
        for (let a = -E; a <= E; a++) for (let b = -E; b <= E; b++) if (!on(i + a, j + b)) return false;
        return true;
      };
      // Thin strokes can vanish under the erosion: when it loses over 45% of the plain drawing's pixels, or the icon
      // is in PLAIN, the plain drawing (no erosion, half coverage) is kept instead.
      const draw = (erode: boolean, min: number) =>
        Array.from({ length: 16 }, (_, cy) =>
          Array.from({ length: 16 }, (_, cx) => {
            let k = 0;
            for (let a = 0; a < R; a++) for (let b = 0; b < R; b++) if (erode ? eroded(cx * R + a, cy * R + b) : on(cx * R + a, cy * R + b)) k++;
            return k > R * R * min;
          }),
        );
      const count = (g: boolean[][]) => g.flat().filter(Boolean).length;
      const fine = draw(true, 0.4), flat = draw(false, 0.5);
      const grid = !plain && count(fine) >= count(flat) * 0.55 ? fine : flat;
      res[name] = grid.map((row) => parseInt(row.map((v) => (v ? "1" : "0")).join(""), 2).toString(16).padStart(4, "0"));
    }
    return res;
  },
  { list: icons.map(([n, s]) => [n, s, PLAIN.has(n)] as const), R, E },
);
await browser.close();
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(`${ROOT}src/skill-icons.json`, JSON.stringify(sorted) + "\n");
console.log(`${Object.keys(sorted).length} icons`);
