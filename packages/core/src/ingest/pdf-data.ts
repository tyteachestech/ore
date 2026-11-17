import { CMAPS } from "./pdf-cmaps";

/** What pdf.js asks for beyond the file: the CMaps a CJK font names instead of carrying (Codex sweep 4:
 *  a Korean PDF read as only its punctuation without them), from the ones carried in `ore`.
 *  One loader for import and for the app's Original tab, which draws the same file. */
export class CarriedData {
  constructor(_: unknown) {}
  async fetch({ kind, filename }: { kind: string; filename: string }): Promise<Uint8Array> {
    const path = kind === "cMapUrl" ? CMAPS[filename.replace(/\.bcmap$/, "")] : undefined;
    if (!path) throw new Error(`Unable to load ${kind} data: ${filename}`);
    // In `ore` a carried file; in the app's page (the iPhone's import, the Mac's Original tab: no Bun.file) one of the
    // app's own files, or a small one the build inlined as a data URL, decoded here since the app's CSP lets it
    // fetch only its own files.
    if (path.startsWith("data:")) return Uint8Array.from(atob(path.slice(path.indexOf(",") + 1)), (c) => c.charCodeAt(0));
    if (typeof Bun !== "undefined" && typeof Bun.file === "function") return new Uint8Array(await Bun.file(path).arrayBuffer());
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Unable to load ${kind} data: ${filename}`);
    return new Uint8Array(await res.arrayBuffer());
  }
}
