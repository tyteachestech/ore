// Redraws every MingCute fill icon the skill icon picker offers on the UI icons' 16-pixel grid (D105, D129), so a skill's
// icon reads as 8-bit like the rest of the app. Each SVG is drawn at 16x16 in Chromium and a pixel is on where the
// shape covers it enough. Writes src/skill-icons.json ({ name: 16 rows of 4 hex digits }); vite.config.ts turns each
// into /mingcute-px/<name>.svg. Hand fixes go in src/skill-icon-fixes.ts and win over this file.
// Run after a MingCute update: bun apps/desktop/scripts/pixel-skill-icons.ts
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const ROOT = new URL("../", import.meta.url).pathname;
const SVG = `${ROOT}node_modules/mingcute_icon/svg`;
const icons = readdirSync(SVG).flatMap((c) =>
  readdirSync(`${SVG}/${c}`).flatMap((f) => (f.endsWith("_fill.svg") ? [[f.slice(0, -9), readFileSync(`${SVG}/${c}/${f}`, "utf8")] as const] : [])),
);

const browser = await chromium.launch();
const page = await browser.newPage();
const out: Record<string, string[]> = await page.evaluate(async (list) => {
  const res: Record<string, string[]> = {};
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  for (const [name, svg] of list) {
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.replace(/currentColor/g, "#000"));
    await img.decode();
    x.clearRect(0, 0, 16, 16);
    x.drawImage(img, 0, 0, 16, 16);
    const d = x.getImageData(0, 0, 16, 16).data;
    res[name] = Array.from({ length: 16 }, (_, y) => {
      let row = 0;
      for (let i = 0; i < 16; i++) if (d[(y * 16 + i) * 4 + 3]! > 110) row |= 1 << (15 - i);
      return row.toString(16).padStart(4, "0");
    });
  }
  return res;
}, icons);
await browser.close();
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(`${ROOT}src/skill-icons.json`, JSON.stringify(sorted) + "\n");
console.log(`${Object.keys(sorted).length} icons`);
