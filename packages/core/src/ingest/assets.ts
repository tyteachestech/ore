import { createHash } from "node:crypto";
import type { Asset, NewItem } from "../items.ts";

// The images a source shows are saved into its folder (D96): the library stays readable offline and
// after the site changes. Each remote `![…](https://…)` becomes `![…](assets/<hash>.<ext>)`; an image
// that won't download keeps its link, so a slow or broken host never fails the add.

/** An image past this size is left as a link: a source is for reading, not an image archive. */
const MAX_IMAGE = 5 * 1024 * 1024;
/** Images per source, and bytes in all, past which the rest stay links. */
const MAX_IMAGES = 80;
const MAX_TOTAL = 60 * 1024 * 1024;
/** Smaller than this is a tracking pixel or a spacer. */
const MIN_IMAGE = 100;

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp", "image/svg+xml": "svg", "image/avif": "avif" };

/** The file name an image is saved under: its content's hash, so the same image is stored once. */
export const assetName = (data: Uint8Array, ext: string) => `${createHash("sha256").update(data).digest("hex").slice(0, 16)}.${ext}`;

const IMAGE = /(!\[[^\]\n]*\]\()(https?:\/\/[^)\s]+)((?:\s+"[^"\n]*")?\))/g;

/** Downloads the body's remote images and points the body at the saved copies. */
export async function saveImages(body: string, opts: { referer?: string } = {}): Promise<{ body: string; assets: Asset[] }> {
  const urls = [...new Set([...body.matchAll(IMAGE)].map((m) => m[2]!))].slice(0, MAX_IMAGES);
  const saved = new Map<string, Asset>();
  let total = 0;
  const one = async (url: string) => {
    const res = await fetch(url, { headers: opts.referer ? { referer: opts.referer } : {}, signal: AbortSignal.timeout(15000) }).catch(() => null);
    const type = res?.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    const ext = EXT[type];
    if (!res?.ok || !ext || Number(res.headers.get("content-length") ?? 0) > MAX_IMAGE) return void res?.body?.cancel().catch(() => {});
    const data = new Uint8Array(await res.arrayBuffer().catch(() => new ArrayBuffer(0)));
    if (data.length < MIN_IMAGE || data.length > MAX_IMAGE || total + data.length > MAX_TOTAL) return;
    total += data.length;
    saved.set(url, { name: assetName(data, ext), data });
  };
  // A few at a time, so a page of 80 images doesn't open 80 connections at once.
  for (let i = 0; i < urls.length; i += 6) await Promise.all(urls.slice(i, i + 6).map(one));
  const out = body.replace(IMAGE, (all, pre, url, post) => (saved.has(url) ? `${pre}assets/${saved.get(url)!.name}${post}` : all));
  const assets = [...new Map([...saved.values()].map((a) => [a.name, a])).values()];
  return { body: out, assets };
}

/** A draft with the images its body shows saved beside it, for the kinds that show images. */
export async function withImages<T extends Omit<NewItem, "skills" | "course">>(draft: T): Promise<T> {
  if (draft.type !== "article" && draft.type !== "markdown") return draft;
  const { body, assets } = await saveImages(draft.body, { referer: draft.url });
  return { ...draft, body, assets: [...(draft.assets ?? []), ...assets] };
}
