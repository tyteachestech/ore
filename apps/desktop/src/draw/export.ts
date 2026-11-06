// A diagram as SVG markup (the note's preview, Copy as SVG) or a PNG on the clipboard (D103).
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import geist from "../fonts/Geist-Regular.woff2?url";
import geistMono from "../fonts/GeistMono-Regular.woff2?url";
import { boundsOf, type El, type Els } from "./model";
import { Defs, Elements } from "./render";

type Files = Record<string, { dataURL?: string }>;
const PAD = 16;

/** The scene drawn on the dark page, cropped to its content. `background` paints the page colour. */
export function svgMarkup(els: Els, files: Files = {}, opts: { background?: boolean; fonts?: string } = {}): string {
  const b = boundsOf(els) ?? { x: 0, y: 0, w: 0, h: 0 };
  const [x, y, w, h] = [b.x - PAD, b.y - PAD, b.w + PAD * 2, b.h + PAD * 2];
  const body = renderToStaticMarkup(
    createElement(
      "svg",
      { xmlns: "http://www.w3.org/2000/svg", viewBox: `${x} ${y} ${w} ${h}`, width: w, height: h, style: { "--draw-ground": "#141413" } as never },
      opts.fonts ? createElement("style", null, opts.fonts) : null,
      opts.background ? createElement("rect", { x, y, width: w, height: h, fill: "#141413" }) : null,
      createElement(Defs, { els }),
      createElement(Elements, { els: els as El[], files }),
    ),
  );
  return body;
}

async function inline(url: string): Promise<string> {
  const buf = await (await fetch(url)).arrayBuffer();
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:font/woff2;base64,${btoa(s)}`;
}

let fonts: Promise<string> | null = null;
const fontCss = () =>
  (fonts ??= Promise.all([inline(geist), inline(geistMono)]).then(([a, b]) => `@font-face{font-family:Geist;src:url(${a})}@font-face{font-family:"Geist Mono";src:url(${b})}`));

/** Copies the scene as a 2× PNG on the page colour (an image in an SVG cannot reach the app's fonts, so they go inside it). */
export async function copyPng(els: Els, files: Files): Promise<void> {
  if (!els.length) throw new Error("the diagram is empty");
  const blob = (async () => {
    const svg = svgMarkup(els, files, { background: true, fonts: await fontCss() });
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    try {
      await new Promise<void>((ok, fail) => {
        img.onload = () => ok();
        img.onerror = () => fail(new Error("the drawing could not be rendered"));
        img.src = url;
      });
      const c = document.createElement("canvas");
      c.width = img.width * 2;
      c.height = img.height * 2;
      const g = c.getContext("2d")!;
      g.scale(2, 2);
      g.drawImage(img, 0, 0);
      return await new Promise<Blob>((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error("no PNG"))), "image/png"));
    } finally {
      URL.revokeObjectURL(url);
    }
  })();
  // Safari wants the ClipboardItem made inside the key press, with the blob still on its way.
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}
