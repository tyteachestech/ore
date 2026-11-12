// The app icon (D221): a pickaxe in halftone dots, white at the head fading to gray down the handle, centred on the
// dark tile. Draws it and writes every icon file for the Mac app (the tile is 824 of 1024, with its shadow) and the
// iPhone app (the full square, no transparency).
//   bun apps/desktop/scripts/app-icon.ts [--preview <dir>]   (--preview writes mac.png and phone.png there only)
// The iPhone app's own icon set lives in the Xcode project `tauri ios init` writes (apps/phone/src-tauri/gen/apple,
// not in git): where that exists (the Mac) its files are rewritten too, so run this again after an `ios:init`.
import { chromium } from "playwright";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Dots across the drawing's unit square, and how much of the tile the pick's ink spans on its longer side. */
const GRID = 26, FILL = 0.6;
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const mix = (a: string, b: string, t: number) => {
  const h = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const A = h(a), B = h(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i]! - v) * t).toString(16).padStart(2, "0")).join("");
};

// The pick in a unit square: a handle from the grip G up to H, and a head that is an arc of a circle centred down the
// handle, thick at the middle and pointed at both ends, with a collar where they meet.
const G = [0.27, 0.84] as const, H = [0.66, 0.33] as const, R = 0.5, SWEEP = 0.74, THICK = 0.125, HALF = 0.05;
const LEN = Math.hypot(H[0] - G[0], H[1] - G[1]), U = [(H[0] - G[0]) / LEN, (H[1] - G[1]) / LEN] as const;
const C = [H[0] - U[0] * R, H[1] - U[1] * R] as const;
/** What is at (x, y): the dot's size (0 to 1) and colour, or null for the tile. */
function shade(x: number, y: number): { r: number; color: string } | null {
  const px = x - G[0], py = y - G[1], along = px * U[0] + py * U[1], side = px * -U[1] + py * U[0];
  const t = clamp(along / (LEN + 0.035));
  const cx = x - C[0], cy = y - C[1], rad = Math.hypot(cx, cy), phi = Math.abs(Math.atan2(cx * -U[1] + cy * U[0], cx * U[0] + cy * U[1])) / SWEEP;
  const inArc = phi < 1 && Math.abs(rad - R) < THICK * (1 - phi ** 1.6) * 0.5 + 0.004;
  const inCollar = Math.abs(side) < HALF * 1.5 && Math.abs(along - LEN) < THICK * 0.62;
  if (inArc || inCollar) {
    // Lit from outside the curve: the outer edge is the brightest.
    const lit = clamp(0.5 + (rad - R) / THICK);
    return { r: 0.74 + 0.26 * lit, color: lit > 0.6 ? "#ffffff" : "#ececea" };
  }
  const hx = px - U[0] * t * (LEN + 0.035), hy = py - U[1] * t * (LEN + 0.035);
  if (Math.hypot(hx, hy) < HALF * (0.9 + 0.2 * (1 - t))) return { r: 0.92 - 0.22 * (1 - t), color: mix("#dcdcda", "#6f6f6d", 1 - t) };
  return null;
}

type Dot = { x: number; y: number; r: number; color: string };
/** One dot per cell of the grid: its size says how much of the cell the pick covers (16 samples) and how lit it is.
 *  A cell the pick barely touches draws nothing, so no specks float off its edge. */
export function pickDots(): Dot[] {
  const out: Dot[] = [], K = 4;
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
    let cov = 0, last: ReturnType<typeof shade> = null;
    for (let b = 0; b < K; b++) for (let a = 0; a < K; a++) {
      const s = shade((i + (a + 0.5) / K) / GRID, (j + (b + 0.5) / K) / GRID);
      if (s) { cov++; last = s; }
    }
    const s = shade((i + 0.5) / GRID, (j + 0.5) / GRID) ?? last;
    if (!s) continue;
    const r = 0.5 * s.r * Math.min(1, (cov / (K * K)) * 1.5) ** 0.6;
    if (r >= 0.14) out.push({ x: i + 0.5, y: j + 0.5, r, color: s.color });
  }
  return out;
}

/** The dots as SVG circles, their ink centred on (cx, cy) and `span` px on its longer side. */
function drawn(cx: number, cy: number, span: number) {
  const dots = pickDots();
  const x0 = Math.min(...dots.map((d) => d.x - d.r)), x1 = Math.max(...dots.map((d) => d.x + d.r));
  const y0 = Math.min(...dots.map((d) => d.y - d.r)), y1 = Math.max(...dots.map((d) => d.y + d.r));
  const k = span / Math.max(x1 - x0, y1 - y0), ox = cx - ((x0 + x1) / 2) * k, oy = cy - ((y0 + y1) / 2) * k;
  return dots.map((d) => `<circle cx="${(ox + d.x * k).toFixed(2)}" cy="${(oy + d.y * k).toFixed(2)}" r="${(d.r * k).toFixed(2)}" fill="${d.color}"/>`).join("");
}

const GRADIENT = `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#292929"/><stop offset="1" stop-color="#1b1b1b"/></linearGradient>`;
/** macOS: the tile is 824 of the 1024 canvas with a 185 corner, a hairline edge and its own shadow. */
export const macSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs>${GRADIENT}
<filter id="s" color-interpolation-filters="sRGB" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-opacity=".45"/><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity=".3"/></filter></defs>
<rect x="100" y="100" width="824" height="824" rx="185" fill="url(#g)" filter="url(#s)"/><rect x="102" y="102" width="820" height="820" rx="183" fill="none" stroke="#333" stroke-width="4"/>${drawn(512, 512, 824 * FILL)}</svg>`;
/** iPhone: the full square, which iOS rounds itself. */
export const phoneSvg = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs>${GRADIENT}</defs><rect width="1024" height="1024" fill="url(#g)"/>${drawn(512, 512, 1024 * FILL)}</svg>`;

/** An .icns file from PNGs by pixel size. */
function icns(png: Map<number, Buffer>) {
  const types: [string, number][] = [["icp4", 16], ["icp5", 32], ["ic11", 32], ["ic12", 64], ["ic07", 128], ["ic13", 256], ["ic08", 256], ["ic14", 512], ["ic09", 512], ["ic10", 1024]];
  const parts = types.map(([type, size]) => {
    const data = png.get(size)!, head = Buffer.alloc(8);
    head.write(type, 0, "ascii");
    head.writeUInt32BE(data.length + 8, 4);
    return Buffer.concat([head, data]);
  });
  const head = Buffer.alloc(8);
  head.write("icns", 0, "ascii");
  head.writeUInt32BE(8 + parts.reduce((n, p) => n + p.length, 0), 4);
  return Buffer.concat([head, ...parts]);
}

/** The Xcode icon set's files and their pixel sizes. */
const IOS: [string, number][] = [["20x20@1x", 20], ["20x20@2x", 40], ["20x20@2x-1", 40], ["20x20@3x", 60], ["29x29@1x", 29], ["29x29@2x", 58], ["29x29@2x-1", 58], ["29x29@3x", 87],
  ["40x40@1x", 40], ["40x40@2x", 80], ["40x40@2x-1", 80], ["40x40@3x", 120], ["60x60@2x", 120], ["60x60@3x", 180], ["76x76@1x", 76], ["76x76@2x", 152], ["83.5x83.5@2x", 167], ["512@2x", 1024]];

if (import.meta.main) {
  const at = process.argv.indexOf("--preview"), preview = at >= 0 ? process.argv[at + 1] : undefined;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // Each size is drawn from the vectors at that size, never scaled down from a bigger picture.
  const shoot = async (svg: string, size: number, clear: boolean) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<body style="margin:0;background:${clear ? "transparent" : "#1b1b1b"}">${svg.replace("<svg ", `<svg width="${size}" height="${size}" style="display:block" `)}</body>`);
    return page.screenshot({ omitBackground: clear });
  };
  // Tauri refuses an icon PNG with no alpha channel, and a screenshot of an opaque page has none (it stopped every
  // iPhone build once). A canvas always writes RGBA, so Tauri's files come from one.
  const rgba = async (svg: string, size: number) => {
    const url = await page.evaluate(async ([svg, size]) => {
      const img = new Image();
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      await img.decode();
      const c = document.createElement("canvas");
      c.width = c.height = size;
      c.getContext("2d")!.drawImage(img, 0, 0, size, size);
      return c.toDataURL("image/png");
    }, [svg, size] as const);
    const png = Buffer.from(url.split(",")[1]!, "base64");
    if (png[25] !== 6) throw new Error(`icon at ${size}px is not RGBA`);
    return png;
  };
  if (preview) {
    mkdirSync(preview, { recursive: true });
    writeFileSync(join(preview, "mac.png"), await shoot(macSvg(), 1024, true));
    writeFileSync(join(preview, "phone.png"), await shoot(phoneSvg(), 1024, false));
  } else {
    for (const [app, svg] of [["desktop", macSvg()], ["phone", phoneSvg()]] as const) {
      const dir = join(import.meta.dir, "../..", app, "src-tauri/icons"), png = new Map<number, Buffer>();
      for (const size of [16, 32, 64, 128, 256, 512, 1024]) png.set(size, await rgba(svg, size));
      for (const [name, size] of [["32x32", 32], ["128x128", 128], ["128x128@2x", 256], ["icon", 512]] as const) writeFileSync(join(dir, `${name}.png`), png.get(size)!);
      writeFileSync(join(dir, "icon.icns"), icns(png));
    }
    const set = join(import.meta.dir, "../../phone/src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset");
    if (existsSync(set)) for (const [name, size] of IOS) writeFileSync(join(set, `AppIcon-${name}.png`), await shoot(phoneSvg(), size, false));
  }
  await browser.close();
}
