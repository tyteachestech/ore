import { execFile } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, posix } from "node:path";
import { promisify } from "node:util";
import { strFromU8, unzipSync } from "fflate";
import { writeAtomic } from "../fsutil.ts";
import { sourceFile, type Item } from "../items.ts";
import { youtubeId } from "./youtube.ts";

// A picture that stands for a source (D77): `thumbnail.<ext>` beside doc.md, like source.*. Made from
// what the source already carries: a page's og:image, a video's poster, an EPUB's cover, a PDF's first
// page. None for pasted text and snippets; the app shows the source's kind instead.

const run = promisify(execFile);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const SIZE = 480; // px, longest side: sharp at 2x in the reader, small enough for long lists
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };

export function thumbnailFile(item: Item): string | undefined {
  const name = readdirSync(item.dir).find((f) => f.startsWith("thumbnail."));
  return name && join(item.dir, name);
}

/** A course's own picture (D79): `course-cover.<ext>` beside one lesson's doc.md, as the course has no
 *  folder of its own. A lesson's video frame (often a dark screen recording) doesn't stand for the course. */
export function courseCoverFile(item: Item): string | undefined {
  const name = readdirSync(item.dir).find((f) => f.startsWith("course-cover."));
  return name && join(item.dir, name);
}

type Picture = { ext: string; data: Uint8Array };

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"))?.slice(2).find((v) => v !== undefined);
const unescape = (s: string) => s.replace(/&amp;/g, "&").replace(/&#38;/g, "&").replace(/&quot;/g, '"').replace(/&#x2F;/gi, "/");

/** The page's own picture for links: og:image, then twitter:image, then image_src, then the
 *  apple-touch-icon (a sharp site logo). Favicons are too small to stand for a page. */
export function pageImage(html: string, base: string): string | undefined {
  const body = html.search(/<body\b/i);
  const head = body > 0 ? html.slice(0, body) : html.slice(0, 200_000);
  const metas = head.match(/<meta\b[^>]*>/gi) ?? [];
  const links = head.match(/<link\b[^>]*>/gi) ?? [];
  const meta = (key: string) => metas.find((m) => (attr(m, "property") ?? attr(m, "name"))?.toLowerCase() === key);
  const link = (rel: string) => links.find((l) => attr(l, "rel")?.toLowerCase().split(/\s+/).includes(rel));
  const raw =
    attr(meta("og:image:secure_url") ?? meta("og:image") ?? meta("twitter:image") ?? meta("twitter:image:src") ?? "", "content") ??
    attr(link("image_src") ?? link("apple-touch-icon") ?? "", "href");
  if (!raw?.trim()) return undefined;
  try {
    const url = new URL(unescape(raw.trim()), base);
    return /^https?:$/.test(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

async function download(url: string): Promise<Picture | undefined> {
  const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(10_000) });
  const type = (res.headers.get("content-type") ?? "").split(";")[0]!.trim().toLowerCase();
  const ext = EXT[type] ?? (type ? undefined : url.match(/\.(jpe?g|png|webp|gif)(?:[?#]|$)/i)?.[1]?.toLowerCase().replace("jpeg", "jpg"));
  if (!res.ok || !ext) return undefined;
  const data = new Uint8Array(await res.arrayBuffer());
  return data.length > 64 && data.length < 15_000_000 ? { ext, data } : undefined;
}

/** EPUB cover: the manifest item marked cover-image (EPUB 3), else the one `<meta name="cover">`
 *  names (EPUB 2), else an image whose id or file name says cover. */
export function epubCover(epub: Uint8Array): Picture | undefined {
  const files = unzipSync(epub, { filter: (f) => !/\.(x?html?|css|ttf|otf|woff2?)$/i.test(f.name) });
  const opfPath = files["META-INF/container.xml"] && strFromU8(files["META-INF/container.xml"]).match(/full-path="([^"]+)"/)?.[1];
  if (!opfPath || !files[opfPath]) return undefined;
  const opf = strFromU8(files[opfPath]);
  const items = (opf.match(/<item\b[^>]*>/gi) ?? []).map((t) => ({ id: attr(t, "id") ?? "", href: attr(t, "href") ?? "", type: attr(t, "media-type") ?? "", props: attr(t, "properties") ?? "" }));
  const images = items.filter((i) => EXT[i.type]);
  const named = (opf.match(/<meta\b[^>]*>/gi) ?? []).find((m) => attr(m, "name") === "cover");
  const pick =
    images.find((i) => i.props.split(/\s+/).includes("cover-image")) ??
    images.find((i) => named && i.id === attr(named, "content")) ??
    images.find((i) => /cover/i.test(i.id) || /cover/i.test(i.href));
  const data = pick && files[posix.join(posix.dirname(opfPath), decodeURIComponent(pick.href))];
  return pick && data ? { ext: EXT[pick.type]!, data } : undefined;
}

/** First page of a PDF through Quick Look (macOS only; elsewhere none). */
async function pdfPage(path: string): Promise<Picture | undefined> {
  if (process.platform !== "darwin") return undefined;
  const out = mkdtempSync(join(tmpdir(), "ore-thumb-"));
  try {
    await run("qlmanage", ["-t", "-s", String(SIZE), "-o", out, path], { timeout: 20_000 });
    return { ext: "png", data: new Uint8Array(readFileSync(join(out, `${basename(path)}.png`))) };
  } catch {
    return undefined;
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

async function picture(item: Item): Promise<Picture | undefined> {
  const { type, url, video } = item.meta;
  const source = sourceFile(item);
  // A page with its video (D92) shows the video's frame, as the lesson or talk it holds.
  if (type === "youtube" || video) {
    const id = (video ?? url) && youtubeId((video ?? url)!);
    return id ? download(`https://i.ytimg.com/vi/${id}/mqdefault.jpg`) : undefined;
  }
  if (type === "epub" && source) return epubCover(new Uint8Array(readFileSync(source)));
  if (type === "pdf" && source) return pdfPage(source);
  if (type === "article" && source?.endsWith(".html")) {
    const img = pageImage(readFileSync(source, "utf8"), url ?? "file:///");
    return img ? download(img) : undefined;
  }
  return undefined;
}

/** Shrinks to SIZE on its longest side with sips (macOS); elsewhere the picture is kept as it came. */
async function shrink(path: string): Promise<void> {
  if (process.platform !== "darwin" || path.endsWith(".gif")) return;
  await run("sips", ["-Z", String(SIZE), path], { timeout: 20_000 }).catch(() => {});
}

/** Saves the course page's own picture (og:image) as the course's cover, beside `lesson`'s doc.md;
 *  never throws (a missing picture never fails an add). Returns its path, or undefined. */
export async function makeCourseCover(lesson: Item, courseUrl: string): Promise<string | undefined> {
  try {
    const res = await fetch(courseUrl, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(10_000) });
    const img = res.ok ? pageImage(await res.text(), courseUrl) : undefined;
    const pic = img && (await download(img));
    if (!pic) return undefined;
    const path = join(lesson.dir, `course-cover.${pic.ext}`);
    writeAtomic(path, pic.data);
    await shrink(path);
    return path;
  } catch {
    return undefined;
  }
}

/** True when the file starts like a picture we save (JPEG, PNG, GIF, WebP, AVIF): a cut-off download or
 *  junk under a picture's name is remade by backfill instead of kept forever. */
function isPicture(path: string): boolean {
  const b = readFileSync(path).subarray(0, 12);
  const at = (i: number, s: string) => [...s].every((c, j) => b[i + j] === c.charCodeAt(0));
  return (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) || at(1, "PNG") || at(0, "GIF8") || (at(0, "RIFF") && at(8, "WEBP")) || at(4, "ftyp");
}

/** Makes the source's thumbnail if it has none (or a broken one) and one can be found; never throws (a missing picture
 *  never fails an add). Returns its path, or undefined. */
export async function makeThumbnail(item: Item, opts: { replace?: boolean } = {}): Promise<string | undefined> {
  const had = thumbnailFile(item);
  if (had && !opts.replace && isPicture(had)) return had;
  try {
    const pic = await picture(item);
    if (!pic) return had;
    if (had) unlinkSync(had);
    const path = join(item.dir, `thumbnail.${pic.ext}`);
    writeAtomic(path, pic.data);
    if (item.meta.type !== "pdf") await shrink(path); // Quick Look already made it SIZE
    return path;
  } catch {
    return had;
  }
}
