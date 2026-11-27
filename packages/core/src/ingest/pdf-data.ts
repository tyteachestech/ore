import jbig2 from "pdfjs-dist/wasm/jbig2.wasm" with { type: "file" };
import openjpeg from "pdfjs-dist/wasm/openjpeg.wasm" with { type: "file" };
import { CMAPS } from "./pdf-cmaps";

const hasBunFiles = typeof Bun !== "undefined" && typeof Bun.file === "function";
const DECODERS = new Map([
  ["jbig2.wasm", jbig2],
  ["openjpeg.wasm", openjpeg],
]);

/** The files pdf.js needs for CJK fonts and for JPEG 2000 images and JBIG2 masks.
 *  Both import and the Original tab use the copies carried in Ore. */
class CarriedData {
  constructor(_: unknown) {}
  async fetch({ kind, filename }: { kind: string; filename: string }): Promise<Uint8Array> {
    const path = kind === "cMapUrl" ? CMAPS[filename.replace(/\.bcmap$/, "")]
      : kind === "wasmUrl" ? DECODERS.get(filename)
      : undefined;
    if (!path) throw new Error(`Unable to load ${kind} data: ${filename}`);
    // In `ore` a carried file; in the app's page (the iPhone's import, the Mac's Original tab: no Bun.file) one of the
    // app's own files, or a small one the build inlined as a data URL, decoded here since the app's CSP lets it
    // fetch only its own files.
    if (path.startsWith("data:")) return Uint8Array.from(atob(path.slice(path.indexOf(",") + 1)), (c) => c.charCodeAt(0));
    if (hasBunFiles) return new Uint8Array(await Bun.file(path).arrayBuffer());
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Unable to load ${kind} data: ${filename}`);
    return new Uint8Array(await res.arrayBuffer());
  }
}

export const pdfData = {
  BinaryDataFactory: CarriedData,
  useWorkerFetch: false,
  // The factory supplies the Wasm bytes. pdf.js imports its own JavaScript fallbacks
  // from this URL in web views that can't run the decoder's Wasm instructions.
  wasmUrl: hasBunFiles || typeof document === "undefined" ? undefined : new URL("/pdf-decoders/", document.baseURI).href,
};
