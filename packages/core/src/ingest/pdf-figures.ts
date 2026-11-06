import { zlibSync } from "fflate";
import { OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFPageProxy } from "pdfjs-dist/types/src/display/api";

// A PDF's figures (D122): the pictures its pages draw, saved as PNGs and shown after the page's text.
// Pictures that touch are one figure (a diagram built of tiles, a grid of photos), drawn together.
// Left out: icons and bullets (under 40 pt), a page's own scan behind its text (most of the page),
// and anything on three or more pages (a logo, a header band). Figures drawn as vector paths (most
// charts in papers) aren't pictures, so they aren't kept yet.

interface Picture {
  width: number;
  height: number;
  /** pdf.js ImageKind: 1 is 1-bit grey (rows padded to bytes), 2 RGB, 3 RGBA. */
  kind: number;
  data: Uint8Array | Uint8ClampedArray;
}
interface Placed {
  box: [number, number, number, number]; // x0, y0, x1, y1 in page points, y up
  pic: Picture;
}

const MIN_SIDE = 40;
/** Pixels across a figure at most: the reader's column at 2×. */
const MAX_WIDTH = 1400;

type M = [number, number, number, number, number, number];
const mul = (m: M, n: M): M => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];

/** The page's figures as RGBA, each with its size in pixels. */
export async function pageFigures(page: PDFPageProxy): Promise<{ width: number; height: number; rgba: Uint8Array }[]> {
  const ops = await page.getOperatorList();
  const [, , pw = 0, ph = 0] = page.view;
  const placed: Placed[] = [];
  let ctm: M = [1, 0, 0, 1, 0, 0];
  const stack: M[] = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = mul(ctm, args as M);
    else if (fn === OPS.paintFormXObjectBegin) {
      // A form (a figure placed as one object) carries its own matrix.
      stack.push(ctm);
      if (Array.isArray(args[0]) && args[0].length === 6) ctm = mul(ctm, args[0] as M);
    } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      const pic = (fn === OPS.paintInlineImageXObject ? args[0] : await resolve(page, args[0])) as Picture | null;
      if (!pic?.data || ![1, 2, 3].includes(pic.kind)) continue;
      const xs = [ctm[4], ctm[4] + ctm[0], ctm[4] + ctm[2], ctm[4] + ctm[0] + ctm[2]];
      const ys = [ctm[5], ctm[5] + ctm[1], ctm[5] + ctm[3], ctm[5] + ctm[1] + ctm[3]];
      const box: Placed["box"] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      if (box[2] - box[0] < MIN_SIDE || box[3] - box[1] < MIN_SIDE) continue;
      if ((box[2] - box[0]) * (box[3] - box[1]) > pw * ph * 0.8) continue; // the page's scan
      placed.push({ box, pic });
    }
  }
  return groups(placed).map(draw);
}

function resolve(page: PDFPageProxy, name: unknown): Promise<Picture | null> {
  if (typeof name !== "string") return Promise.resolve(null);
  const objs = name.startsWith("g_") ? page.commonObjs : page.objs;
  return new Promise((r) => {
    try {
      objs.get(name, (o: unknown) => r(o as Picture));
    } catch {
      r(null);
    }
  });
}

/** Pictures whose boxes touch (within 6 pt), joined into one figure each, in reading order. */
function groups(placed: Placed[]): Placed[][] {
  const near = (a: Placed, b: Placed) => a.box[0] <= b.box[2] + 6 && b.box[0] <= a.box[2] + 6 && a.box[1] <= b.box[3] + 6 && b.box[1] <= a.box[3] + 6;
  const out: Placed[][] = [];
  for (const p of placed) {
    const hit = out.filter((g) => g.some((q) => near(p, q)));
    const merged = [p, ...hit.flat()];
    for (const g of hit) out.splice(out.indexOf(g), 1);
    out.push(merged);
  }
  // Top of the page first (PDF y grows upward).
  return out.sort((a, b) => Math.max(...b.map((p) => p.box[3])) - Math.max(...a.map((p) => p.box[3])));
}

/** One figure's pictures drawn into one RGBA image at their places, nearest pixel. */
function draw(group: Placed[]) {
  const x0 = Math.min(...group.map((p) => p.box[0]));
  const y1 = Math.max(...group.map((p) => p.box[3]));
  const w = Math.max(...group.map((p) => p.box[2])) - x0;
  const h = y1 - Math.min(...group.map((p) => p.box[1]));
  // As sharp as its sharpest picture, within MAX_WIDTH.
  const scale = Math.min(Math.max(...group.map((p) => p.pic.width / (p.box[2] - p.box[0]))), MAX_WIDTH / w);
  const W = Math.max(1, Math.round(w * scale));
  const H = Math.max(1, Math.round(h * scale));
  const rgba = new Uint8Array(W * H * 4).fill(255);
  for (const { box, pic } of group) {
    const left = Math.round((box[0] - x0) * scale);
    const top = Math.round((y1 - box[3]) * scale);
    const bw = Math.max(1, Math.round((box[2] - box[0]) * scale));
    const bh = Math.max(1, Math.round((box[3] - box[1]) * scale));
    const row1 = Math.ceil(pic.width / 8);
    for (let y = 0; y < bh && top + y < H; y++) {
      const sy = Math.min(pic.height - 1, Math.floor((y * pic.height) / bh));
      for (let x = 0; x < bw && left + x < W; x++) {
        const sx = Math.min(pic.width - 1, Math.floor((x * pic.width) / bw));
        const o = ((top + y) * W + left + x) * 4;
        if (pic.kind === 1) {
          const v = (pic.data[sy * row1 + (sx >> 3)]! >> (7 - (sx & 7))) & 1 ? 255 : 0;
          rgba[o] = rgba[o + 1] = rgba[o + 2] = v;
        } else {
          const n = pic.kind === 2 ? 3 : 4;
          const s = (sy * pic.width + sx) * n;
          const a = n === 4 ? pic.data[s + 3]! / 255 : 1;
          // Transparent parts sit on white, as on the page.
          for (let c = 0; c < 3; c++) rgba[o + c] = Math.round(pic.data[s + c]! * a + 255 * (1 - a));
        }
      }
    }
  }
  return { width: W, height: H, rgba };
}

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(b: Uint8Array) {
  let c = 0xffffffff;
  for (const x of b) c = CRC[(c ^ x) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** RGBA pixels as a PNG file (RGB, as figures sit on white). */
export function png(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const raw = new Uint8Array(height * (width * 3 + 1));
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) raw.set(rgba.subarray((y * width + x) * 4, (y * width + x) * 4 + 3), y * (width * 3 + 1) + 1 + x * 3);
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const v = new DataView(out.buffer);
    v.setUint32(0, data.length);
    out.set(new TextEncoder().encode(type), 4);
    out.set(data, 8);
    v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, width);
  v.setUint32(4, height);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlibSync(raw, { level: 6 })), chunk("IEND", new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) (out.set(p, at), (at += p.length));
  return out;
}
