import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join, resolve, sep } from "node:path";
import { addHighlight, annotationRevs, readAnnotations, reanchorItem, reviseAnnotation, type Annotation, type Intent } from "../annotations.ts";
import { parseFrontmatter, stringifyFrontmatter } from "../frontmatter.ts";
import { latestRevs, sha256, writeAtomic } from "../fsutil.ts";
import { createItem, findItem, keepPreview, ItemMetaSchema, listItems, readItemDir, setItemArchived, sourceFile, updateItemMeta, type Item, type ItemType, type NewItem } from "../items.ts";
import { paths, type Library } from "../library.ts";
import { proseLines } from "../links.ts";
import { withLock } from "../lock.ts";
import { setItemSkills } from "../skills.ts";
import { withImages } from "./assets.ts";
import { BOT, cleanAuthor, cleanDate, FROM_TAB, refusal, wordCount } from "./check.ts";
import { isCourseUrl, lessonDraft, planCourse, type CourseLesson } from "./course.ts";
import { pageDraft } from "./page.ts";
import type { Tab } from "./tab.ts";
import { makeThumbnail } from "./thumbnail.ts";
import { fetchYoutube, isYoutubeUrl, srtToVtt, vttToBody, youtubeId } from "./youtube.ts";
export { courseCoverFile, epubCover, makeCourseCover, makeThumbnail, pageImage, thumbnailFile } from "./thumbnail.ts";
export { transcriptOf, vttWords, youtubeId } from "./youtube.ts";
export { embeddedVideo, pageDraft, TRANSCRIPT_HEADING, VIDEO_END } from "./page.ts";

// The extractors pull in pdf.js, linkedom and defuddle (~200 ms to load), so they load only when a
// source is added, never on the reads every screen makes.
const pdfToDoc = async (bytes: Uint8Array) => (await import("./pdf.ts")).pdfToDoc(bytes);
const epubToDoc = async (bytes: Uint8Array) => (await import("./epub.ts")).epubToDoc(bytes);

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

export interface AddOptions {
  type?: ItemType;
  skills?: string[];
  /** Long steps (transcribing audio) report 0..1, and a line to show when there is one. */
  onProgress?: (done: number, label?: string) => void;
  /** A Feed post opened to read, not kept until he highlights or writes in it. */
  preview?: boolean;
}

// The first `# ` heading outside fenced code (a `# comment` in a code block is no title).
const titleFromMarkdown = (text: string, fallback: string) =>
  proseLines(text).join("\n").match(/^#\s+(.+)$/m)?.[1]?.trim() || fallback;

/** A Markdown file's own YAML frontmatter (Obsidian, Jekyll, Hugo notes) isn't text to read: it comes
 *  off the body, and its title, author and date fill the source's. One that won't parse stays as text. */
function markdownFile(text: string, fallback: string): { title: string; author?: string; published?: string; body: string } {
  let data: Record<string, unknown> = {};
  let body = text;
  if (/^﻿?---\r?\n/.test(text)) {
    try {
      ({ data, body } = parseFrontmatter(text));
    } catch { /* not frontmatter after all */ }
  }
  const one = (v: unknown) => (typeof v === "string" ? v : v instanceof Date ? v.toISOString() : Array.isArray(v) && v.every((x) => typeof x === "string") ? v.join(", ") : undefined);
  body = body.replace(/^\n+/, "");
  return {
    title: one(data.title)?.trim() || titleFromMarkdown(body, fallback),
    author: cleanAuthor(one(data.author) ?? one(data.authors)),
    published: cleanDate(one(data.date) ?? one(data.published) ?? one(data.created)),
    body,
  };
}

const fileStem = (p: string) => basename(p, extname(p));

/** Video sites yt-dlp reads besides YouTube: a transcript source like a YouTube video, played on the site. */
const VIDEO_SITE = /^https?:\/\/(?:www\.|player\.)?(?:vimeo\.com\/(?:video\/)?\d+|ted\.com\/talks\/|loom\.com\/share\/|dailymotion\.com\/video\/)/;
const PLAYLIST = /^https?:\/\/(?:www\.|m\.)?youtube\.com\/playlist\?/;
const PODCAST = /^https?:\/\/(?:podcasts\.apple\.com\/.+[?&]i=|open\.spotify\.com\/episode\/|overcast\.fm\/|pca\.st\/)/;
const X_POST = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/\w+\/status\//;
/** File types Ore reads, by extension. */
export const FILE_TYPES = ["pdf", "epub", "md", "markdown", "txt", "text", "html", "htm", "docx", "pptx", "ipynb", "srt", "vtt", "png", "jpg", "jpeg", "heic", "tiff", "webp", "gif", "mp3", "m4a", "wav", "aac", "aiff", "flac", "mp4", "mov", "m4v"];
/** Audio transcribed on the Mac (D96); as `audio.ts` AUDIO_TYPES, which loads only when used. */
const AUDIO_TYPES = ["mp3", "m4a", "wav", "aac", "aiff", "flac"];
/** Video files, heard from their sound on the Mac; as `audio.ts` VIDEO_TYPES. */
const VIDEO_TYPES = ["mp4", "mov", "m4v"];
/** Images read with text recognition (D96). */
const IMAGE_TYPES = ["png", "jpg", "jpeg", "heic", "tiff", "webp", "gif"];
/** A page larger than this is not an article: a video, a dump, a disk image. */
const MAX_BYTES = 200 * 1024 * 1024;

const noPaste = (what: string) => `${what} If it has a transcript or text, copy it and paste it here instead.`;

/** Links Ore can't read yet, refused before anything downloads, with the next step. */
function refuseLink(url: string): string | null {
  if (PLAYLIST.test(url)) return "That link is a playlist. Add it as a course (in the app it’s offered as one; in Terminal, `ore add <link> --course`) to get each video as a lesson.";
  if (X_POST.test(url)) return `X only shows posts to signed-in browsers. Open the post in Safari or Chrome and ${FROM_TAB}, or copy it and paste it here instead.`;
  return null;
}

/** A source draft from a file's bytes, whatever it came from (a link or a file), by its kind. */
async function fromBytes(bytes: Uint8Array, kind: string, name: string, url?: string, base = url, opts: AddOptions = {}): Promise<NewItem> {
  if (AUDIO_TYPES.includes(kind)) {
    // Speech to a timed transcript, read like a subtitle file's (D96).
    const vtt = await (await import("./audio.ts")).transcribe(bytes, kind, opts.onProgress);
    // A podcast host's file name ("17456166-summer-shorts-…") as words, its id dropped.
    const title = fileStem(name).replace(/^\d{5,}[-_ ]+/, "").replace(/[-_]+/g, " ").trim() || fileStem(name);
    return { type: "article", title: title[0]!.toUpperCase() + title.slice(1), url, body: vttToBody(vtt), source: { ext: "vtt", data: vtt } };
  }
  if (kind === "pdf") {
    const p = await pdfToDoc(bytes).catch(async (e) => {
      // Scanned pages: read with the Mac's text recognition (D96).
      if (!(e instanceof (await import("./pdf.ts")).ScannedPdf)) throw e;
      return (await import("./ocr.ts")).scannedText(bytes, "pdf");
    });
    return { type: "pdf", title: p.title ?? fileStem(name), author: "author" in p ? p.author : undefined, url, body: p.body, source: { ext: "pdf", data: bytes } };
  }
  if (IMAGE_TYPES.includes(kind)) {
    // A screenshot or photo of text: its text to read, the image above it (D96).
    const o = await (await import("./ocr.ts")).scannedText(bytes, kind);
    const ext = kind === "jpeg" ? "jpg" : kind;
    const image = { name: (await import("./assets.ts")).assetName(bytes, ext), data: bytes };
    return { type: "article", title: o.title ?? fileStem(name), url, body: `![](assets/${image.name})\n\n${o.body}`, source: { ext, data: bytes }, assets: [image] };
  }
  if (kind === "epub") {
    const e = await epubToDoc(bytes);
    return { type: "epub", title: e.title ?? fileStem(name), author: e.author, url, body: e.body, source: { ext: "epub", data: bytes }, assets: e.assets };
  }
  if (kind === "docx" || kind === "pptx") {
    const office = await import("./office.ts");
    const o = kind === "docx" ? await office.docxToDoc(bytes) : office.pptxToDoc(bytes);
    return { type: "article", title: o.title ?? fileStem(name), author: o.author, url, body: o.body, source: { ext: kind, data: bytes }, assets: o.assets };
  }
  const text = decodeText(bytes);
  if (kind === "ipynb") {
    const n = (await import("./notebook.ts")).notebookToDoc(text);
    return { type: "article", title: n.title ?? fileStem(name), url, body: n.body, source: { ext: "ipynb", data: text } };
  }
  if (kind === "srt" || kind === "vtt") {
    const vtt = kind === "srt" ? srtToVtt(text) : text;
    return { type: "article", title: fileStem(name), url, body: vttToBody(vtt), source: { ext: "vtt", data: vtt } };
  }
  if (kind === "markdown") {
    const ext = /\.(md|markdown|txt|text)$/i.exec(name)?.[1]?.toLowerCase() ?? "md";
    return { type: "markdown", ...markdownFile(text, fileStem(name)), url, source: { ext, data: text } };
  }
  if (/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<(?:rss|feed)\b/.test(text.slice(0, 2000)))
    throw new Error("That’s a podcast or blog feed, not one episode or post. Add the link of the episode or post you want instead.");
  // An article that embeds a video keeps both: its text, then the video's transcript (D92).
  const page = await pageDraft(text, base ?? `file://${name}`);
  if (page.type !== "article") return page;
  // A page that is only a wall or a shell is refused, never saved as the content.
  const why = !page.video && refusal(page.title, page.body, url ? new URL(url).host : fileStem(name));
  if (why) throw new Error(why);
  return { ...page, url };
}

/** A text file's bytes as text, whatever wrote it: a byte-order mark names UTF-8 or UTF-16 (Windows
 *  Notepad), and bytes that aren't UTF-8 are an old editor's Windows-1252 (Latin-1), never "Caf�". */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** What a file is from its name and, for a link, the server's content type; null when Ore can't read it. */
function kindOf(name: string, ctype = ""): string | null {
  const ext = extname(name).slice(1).toLowerCase();
  if (ctype.includes("pdf") || ext === "pdf") return "pdf";
  if (ctype.includes("epub") || ext === "epub") return "epub";
  if (ctype.includes("wordprocessingml") || ext === "docx") return "docx";
  if (ctype.includes("presentationml") || ext === "pptx") return "pptx";
  if (["ipynb", "srt", "vtt"].includes(ext)) return ext;
  if (IMAGE_TYPES.includes(ext) || AUDIO_TYPES.includes(ext)) return ext;
  const audio = ctype.match(/^audio\/(mpeg|mp3|mp4|x-m4a|aac|wav|x-wav|flac|aiff)/)?.[1];
  if (audio) return ({ mpeg: "mp3", mp4: "m4a", "x-m4a": "m4a", "x-wav": "wav" } as Record<string, string>)[audio] ?? audio;
  const image = ctype.match(/^image\/(png|jpeg|heic|tiff|webp|gif)/)?.[1];
  if (image) return image;
  if (/text\/(plain|markdown)/.test(ctype) || ["md", "markdown", "txt", "text"].includes(ext)) return "markdown";
  if (/html|xhtml/.test(ctype) || ["html", "htm"].includes(ext)) return "html";
  return null;
}

async function fromUrl(url: string, opts: AddOptions): Promise<NewItem> {
  if (opts.type === "youtube" || (!opts.type && isYoutubeUrl(url))) {
    const y = await fetchYoutube(url, { listen: true, onProgress: opts.onProgress });
    return { type: "youtube", title: y.title, url: y.url, author: y.author, published: y.published, body: y.body, source: { ext: "vtt", data: y.vtt } };
  }
  const refused = refuseLink(url);
  if (refused) throw new Error(refused);
  if (PODCAST.test(url)) {
    // An episode link: its audio, transcribed, under the episode's title (D96).
    const ep = await (await import("./audio.ts")).episode(url);
    const res = await get(ep.audio, new URL(ep.audio).host);
    const ext = kindOf(new URL(res.url || ep.audio).pathname, res.headers.get("content-type") ?? "") ?? "mp3";
    const draft = await fromBytes(await readCapped(res), ext, ep.title ?? "Episode", url, url, opts);
    return { ...draft, title: ep.title ?? draft.title, author: ep.show, published: ep.published };
  }
  if (VIDEO_SITE.test(url)) {
    // Played on its own site (the reader's player is YouTube's); the transcript reads like an article.
    const y = await fetchYoutube(url, { listen: true, onProgress: opts.onProgress });
    return { type: "article", title: y.title, url, author: y.author, published: y.published, body: y.body, source: { ext: "vtt", data: y.vtt } };
  }
  const rw = (await import("./links.ts")).rewrite(url);
  if (rw?.kind === "readme") return readme(url, rw.owner, rw.repo);
  // Every failure says what to do next: a page that won't open or parse can still be pasted as text.
  const host = new URL(url).host;
  // An arXiv paper with no HTML version (older ones) is read from its PDF.
  const res = await get(rw?.url ?? url, host).catch((e) => (rw?.url.startsWith("https://arxiv.org/html/") ? get(rw.url.replace("/html/", "/pdf/"), host) : Promise.reject(e)));
  const ctype = res.headers.get("content-type") ?? "";
  const urlName = decodeURIComponent(new URL(res.url || url).pathname.split("/").pop() || url);
  // Video is never read as a page: the whole file would download and parse as HTML. Audio is transcribed.
  if ((/^(audio|video)\//.test(ctype) || /\.(ogg|opus|mp4|mov|m4v|webm)$/i.test(urlName)) && !kindOf(urlName, ctype)) {
    await res.body?.cancel();
    throw new Error(noPaste("That’s a video file, which Ore can’t read. Add the page it plays on instead."));
  }
  if (/(rss|atom)\+xml/.test(ctype) || (/xml/.test(ctype) && /\b(feed|rss|podcast)\b/i.test(url))) {
    await res.body?.cancel();
    throw new Error("That’s a podcast or blog feed, not one episode or post. Add the link of the episode or post you want instead.");
  }
  const bytes = await readCapped(res);
  const kind = opts.type ? ({ article: "html", youtube: "html", snippet: "markdown" } as Record<string, string>)[opts.type] ?? opts.type : (kindOf(urlName, ctype) ?? "html");
  // Audio is titled by the link he added: a redirect lands on a CDN's opaque file name.
  const name = AUDIO_TYPES.includes(kind) ? decodeURIComponent(new URL(url).pathname.split("/").pop() || urlName) : urlName;
  const draft = await fromBytes(bytes, kind, name, url, res.url || rw?.url || url, opts);
  if (rw?.kind !== "fetch") return draft;
  const body = rw.base && draft.type === "markdown" ? (await import("./links.ts")).absolutize(draft.body, rw.base) : draft.body;
  return { ...draft, body, author: draft.author ?? rw.author, source: draft.source && rw.base && draft.type === "markdown" ? { ...draft.source, data: body } : draft.source };
}

/** The response's body, refused once it passes MAX_BYTES (a server need not say how big it is). */
const tooBig = () => `That file is over ${MAX_BYTES / 1024 / 1024} MB, too big to read as a source. Add the part you want instead.`;

async function readCapped(res: Response): Promise<Uint8Array> {
  if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) {
    await res.body?.cancel();
    throw new Error(tooBig());
  }
  const parts: Uint8Array[] = [];
  let size = 0;
  for await (const part of res.body ?? []) {
    size += part.length;
    if (size > MAX_BYTES) throw new Error(tooBig());
    parts.push(part);
  }
  const out = new Uint8Array(size);
  let at = 0;
  for (const p of parts) out.set(p, (at += p.length) - p.length);
  return out;
}

async function get(url: string, host: string): Promise<Response> {
  const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow" }).catch(() => {
    throw new Error(`Couldn’t reach ${host}. Check your connection and try again.`);
  });
  if (!res.ok) {
    // A refusal page says why: archive.today answers every app with a CAPTCHA under HTTP 429, which
    // waiting won't fix; a real 429 is a rate limit that will.
    const page = await res.text().catch(() => "");
    const text = page.slice(0, 100_000).replace(/<(script|style)[^]*?<\/\1>|<[^>]+>/gi, " ");
    throw new Error(
      BOT.test(text) || /captcha/i.test(page.slice(0, 100_000))
        ? `${host} showed a bot check instead of the page, so Ore couldn’t read it. Open it in your browser, pass the check, and ${FROM_TAB}, or paste its text here instead.`
        : res.status === 401 || res.status === 403
          ? `${host} wouldn’t let Ore in (HTTP ${res.status}); it may need a sign-in. Open it in your browser and ${FROM_TAB}, or paste its text here instead.`
          : res.status === 429
            ? `${host} is getting too many requests right now (HTTP 429). Try again in a few minutes, or open it in your browser and ${FROM_TAB}.`
            : `Couldn’t open that page (HTTP ${res.status} from ${host}). Check the link, or copy the page’s text and paste it here instead.`,
    );
  }
  return res;
}

/** A GitHub repo's README as Markdown, its relative links and images pointed back at the repo. The
 *  API names the README whatever its spelling; when the API is refused, the usual names are tried. */
async function readme(url: string, owner: string, repo: string): Promise<NewItem> {
  const { absolutize } = await import("./links.ts");
  const api = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers: { "user-agent": UA, accept: "application/vnd.github+json" } }).catch(() => null);
  const found = api?.ok ? ((await api.json()) as { download_url?: string }).download_url : undefined;
  const tries = found ? [found] : ["README.md", "readme.md", "README.markdown", "README"].map((f) => `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${f}`);
  for (const raw of tries) {
    const res = await fetch(raw, { headers: { "user-agent": UA } }).catch(() => null);
    if (!res?.ok) continue;
    const text = absolutize(await res.text(), raw);
    return { type: "markdown", title: titleFromMarkdown(text, `${owner}/${repo}`), author: owner, url, body: text, source: { ext: "md", data: text } };
  }
  throw new Error(`Couldn’t find a README in ${owner}/${repo}. Check the link, or open the file you want on GitHub and add that link instead.`);
}

async function fromFile(path: string, opts: AddOptions, input = path): Promise<NewItem> {
  if (!existsSync(path)) {
    // "example.com/post" typed without its scheme reads as a path; say how to add it as the link it is.
    const site = /^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(\/|$)/i.test(input) && !kindOf(input.split("/")[0]!) ? ` For a web page, add its full link: https://${input}` : " Check the path, or drag the file in instead.";
    throw new Error(`There’s no file at ${path}.${site}`);
  }
  const stat = statSync(path);
  if (stat.isDirectory()) throw new Error("That’s a folder. Open it and add the files inside instead.");
  // Finder's own files (.DS_Store, AppleDouble ._ copies) ride along when a folder's files are dropped.
  if (/^(\.DS_Store|\._.*|Icon\r)$/.test(basename(path))) throw new Error(`“${basename(path)}” is a file Finder keeps for itself, not something to read. Add the file you meant instead.`);
  const ext = extname(path).slice(1).toLowerCase();
  if (VIDEO_TYPES.includes(ext) && !opts.type) {
    // A lecture recording or a downloaded course video: heard from its sound where it lies, never
    // read into memory, so no size limit (D122). Only its transcript is kept.
    const vtt = await (await import("./audio.ts")).transcribeFile(path, opts.onProgress);
    return { type: "article", title: fileStem(path), body: vttToBody(vtt), source: { ext: "vtt", data: vtt } };
  }
  if (stat.size > MAX_BYTES) throw new Error(tooBig());
  const bytes = new Uint8Array(readFileSync(path));
  // A file with no extension ("README", "notes") is read as text when it is text.
  const text = !extname(path) && !/[\0-\x08\x0e-\x1a]/.test(decodeText(bytes.subarray(0, 4096)));
  const kind = opts.type ? ({ article: "html", youtube: "html", snippet: "markdown" } as Record<string, string>)[opts.type] ?? opts.type : (kindOf(path) ?? (text ? "markdown" : null));
  if (!kind) throw new Error(`${extname(path) ? `Ore can’t read “${extname(path)}” files yet.` : "Ore can’t read that file: it has no extension and isn’t text."} It reads ${FILE_TYPES.filter((t) => !["markdown", "text", "htm"].includes(t)).join(", ")}; for anything else, copy its text and paste it here.`);
  return fromBytes(bytes, kind, path, undefined, undefined, opts);
}

// Ingest a URL or file into items/ with status inbox. Files dropped in
// inbox/ are removed after a successful ingest (they now live as source.*).
// A link already in the library isn't added twice: it comes back `kept`, filed under the new skills too.
export async function addSource(lib: Library, input: string, opts: AddOptions = {}): Promise<Item & Partial<Kept>> {
  input = input.replace(/^~(?=\/)/, homedir());
  const isUrl = /^https?:\/\//i.test(input);
  if (isUrl && !URL.canParse(input)) throw new Error("That link looks cut off. Copy it again from the address bar.");
  if (!isUrl && /^[a-z][\w+.-]*:/i.test(input) && !existsSync(input)) throw new Error("Ore opens web links (http or https) and files. Open that one in your browser, then add the page from there.");
  const had = isUrl ? everyItem(lib).find((i) => i.meta.url === input && !i.meta.course) : undefined;
  if (had && opts.preview) return had;
  if (had) return keep(lib, had, opts);
  const draft = isUrl ? await fromUrl(input, opts) : await fromFile(resolve(input), opts, input);
  if (!draft.body.trim()) throw new Error("Found no text to read in that. Copy the text and paste it here instead.");
  const ready = await withImages(draft);
  // The same file added again (dropped twice, or a copy) is the source already here.
  const same = !isUrl && everyItem(lib).find((i) => i.meta.text_sha256 === sha256(ready.body) && !i.meta.course);
  const item = same ? await keep(lib, same, opts) : await createItem(lib, { ...ready, skills: opts.skills, preview: opts.preview });
  if (!isUrl && resolve(input).startsWith(paths.inbox(lib) + sep)) unlinkSync(resolve(input));
  if (!same) await makeThumbnail(item);
  return item;
}

/** Kept sources: what adding one again did, so the app can say it ("Added to AI", "back from Archived"). */
export type Kept = { kept: true; filed: string[]; restored: boolean; fromFeed: boolean };

const everyItem = (lib: Library) => listItems(lib).concat(listItems(lib, { archived: true }), listItems(lib, { preview: true }));

/** A source already in the library, added again: filed under the new skills too, and back from the
 *  archive if it was there, since adding it again means he wants it. */
async function keep(lib: Library, had: Item, opts: AddOptions): Promise<Item & Kept> {
  // A post he was previewing from the Feed, added on purpose: it is a source now.
  const fromFeed = await keepPreview(lib, had.meta.id);
  const filed = (opts.skills ?? []).filter((k) => !had.meta.skills.includes(k));
  if (filed.length) await setItemSkills(lib, had.meta.id, [...had.meta.skills, ...filed]);
  const restored = !!had.meta.archived_at;
  if (restored) await setItemArchived(lib, had.meta.id, false);
  return { ...findItem(lib, had.meta.id), kept: true, filed, restored, fromFeed };
}

/** Whether a link reads best by fetching it (a video's transcript, a GitHub file, a PDF), not from the
 *  page a browser shows. */
const readsByLink = async (url: string) =>
  isYoutubeUrl(url) || VIDEO_SITE.test(url) || !!(await import("./links.ts")).rewrite(url) || /\.(pdf|epub|docx|pptx|ipynb)(?:[?#]|$)/i.test(url);

/** The page open in his browser as a source (D96): signed-in, paywalled and browser-built pages come
 *  in as he sees them. A link Ore reads better by fetching (a video, a PDF) is added by its link. */
export async function addTab(lib: Library, opts: AddOptions & { tab?: Tab } = {}): Promise<Item & Partial<Kept>> {
  const tab = opts.tab ?? (await (await import("./tab.ts")).frontTab());
  if (await readsByLink(tab.url)) return addSource(lib, tab.url, opts);
  const had = listItems(lib).find((i) => i.meta.url === tab.url && !i.meta.course);
  if (had) return addSource(lib, tab.url, opts);
  const host = new URL(tab.url).host;
  const draft = await tabDraft(tab, host);
  const item = await createItem(lib, { ...(await withImages(draft)), skills: opts.skills });
  await makeThumbnail(item);
  return item;
}

async function tabDraft(tab: Tab, host: string): Promise<NewItem> {
  const { tabText } = await import("./tab.ts");
  let why = "";
  if (tab.html) {
    try {
      const d = await fromBytes(new TextEncoder().encode(tab.html), "html", host, tab.url);
      if (d.type !== "article" || d.video || !tab.text || wordCount(d.body) >= wordCount(tab.text) / 3) return d;
    } catch (e) {
      why = (e as Error).message;
    }
  }
  // The page's HTML holds no article (an app built in the browser): its visible text is the content.
  const body = tabText(tab.text);
  if (body) return { type: "article", title: tab.title || host, url: tab.url, body, source: tab.html ? { ext: "html", data: tab.html } : { ext: "md", data: body } };
  if (/feed/.test(why)) throw new Error(why);
  throw new Error(`${tab.browser} is showing almost no text on ${host}: it may still be loading, or need a sign-in. Sign in there, wait for the page to load, then add it again.`);
}

// Pasted text as a source: a Markdown item titled by its first heading, else its first line.
// Pasted frontmatter (a copied Obsidian note) fills the title, author and date, as a .md file's does.
export async function addText(lib: Library, text: string, opts: AddOptions = {}): Promise<Item> {
  const source = text.trim() + "\n";
  if (!source.trim()) throw new Error("text is empty");
  const md = markdownFile(source, "");
  const body = md.body.trim() + "\n";
  if (!body.trim()) throw new Error("text is empty: only frontmatter, no text to read");
  const first = body.split("\n")[0]!.replace(/^#+\s*/, "");
  const title = md.title || (first.length > 80 ? first.slice(0, 77).trimEnd() + "…" : first);
  return createItem(lib, { type: "markdown", title, author: md.author, published: md.published, body, source: { ext: "md", data: source }, skills: opts.skills });
}

export interface SnippetInput {
  text: string;
  url?: string;
  app?: string;
  intent?: Intent;
  note?: string;
  skills?: string[];
}

// A captured selection: the body is the selection; one annotation covers it.
export async function addSnippet(lib: Library, s: SnippetInput): Promise<{ item: Item; annotation: Annotation }> {
  const body = s.text.trim() + "\n";
  if (!body.trim()) throw new Error("snippet text is empty");
  const firstLine = body.split("\n")[0]!;
  const title = firstLine.length > 80 ? firstLine.slice(0, 77).trimEnd() + "…" : firstLine;
  const item = await createItem(lib, { type: "snippet", title, body, url: s.url, source_app: s.app, skills: s.skills });
  const annotation = addHighlight(item, { exact: item.body.trim(), intent: s.intent ?? "keep", note: s.note });
  return { item, annotation };
}

/** Fills in what a source added before D77 lacks: its thumbnail and, for a PDF, the author its XMP
 *  metadata names. Returns what it found; leaves alone what is already there. */
export async function backfillSource(lib: Library, item: Item): Promise<{ thumbnail?: string; author?: string }> {
  const thumbnail = await makeThumbnail(item);
  const source = sourceFile(item);
  let author = item.meta.author;
  if (!author && item.meta.type === "pdf" && source) {
    author = await (await import("./pdf.ts")).pdfAuthor(new Uint8Array(readFileSync(source))).catch(() => undefined);
    if (author) await updateItemMeta(lib, item.meta.id, (m) => ({ ...m, author }));
  }
  return { thumbnail, author };
}
export interface Reimported {
  item: Item;
  /** False when the original reads the same as the source: nothing was written. */
  changed: boolean;
  /** Highlights whose passage moved and were re-anchored to it. */
  moved: number;
  /** Highlights whose passage is no longer in the original, removed (their cards stay). */
  removed: Annotation[];
}

// Files a reimport replaces; the previous ones wait in `.ore/reimport/<id>/` for Undo.
const REPLACED = (name: string) => name === "doc.md" || name === "transcript.vtt" || name.startsWith("source.");
const stash = (lib: Library, id: string) => join(lib.root, ".ore", "reimport", id);

/** Swaps a source's text files (doc.md body and kind, source.*, transcript.vtt) with the ones in `from`,
 *  keeping the rest of its frontmatter (status, skills, progress) as it is now. */
function swapFiles(item: Item, from: string) {
  const tmp = `${from}.swap`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  for (const f of readdirSync(item.dir).filter(REPLACED)) copyFileSync(join(item.dir, f), join(tmp, f));
  writeAtomic(join(tmp, "highlights.json"), JSON.stringify(latestRevs(annotationRevs(item.dir))));
  const old = parseFrontmatter(readFileSync(join(from, "doc.md"), "utf8"));
  const was = ItemMetaSchema.parse(old.data);
  for (const f of readdirSync(item.dir).filter(REPLACED)) unlinkSync(join(item.dir, f));
  for (const f of readdirSync(from).filter((f) => REPLACED(f) && f !== "doc.md")) copyFileSync(join(from, f), join(item.dir, f));
  const meta = { ...item.meta, type: was.type, url: was.url, video: was.video, author: was.author, published: was.published, text_sha256: was.text_sha256 };
  writeAtomic(item.docPath, stringifyFrontmatter(meta, old.body));
  rmSync(from, { recursive: true, force: true });
  return tmp;
}

/** A course lesson as it is read again. A lesson added as a bare video (before D92) keeps only its
 *  video's link, so its page comes from the course page again, by its place in the course. */
async function lessonOf(item: Item): Promise<CourseLesson> {
  const { url, course, type, video, title } = item.meta;
  if (url && isYoutubeUrl(url) && course?.url && isCourseUrl(course.url) && !isYoutubeUrl(course.url)) {
    const l = (await planCourse(course.url)).lessons[course.part - 1];
    if (l?.video && youtubeId(l.video) === youtubeId(url!)) return { ...l, title };
  }
  return { title, url: url!, video: video ?? (type === "youtube" ? url : undefined) };
}

/** Fetches a source's original again and puts its new text in place: the same source (id, cards,
 *  notes, progress, title he gave it), its highlights re-anchored where their passage still is, and
 *  the ones whose passage is gone removed, except questions (his own words, listed on the skill page).
 *  The previous version is kept for `undoReimport`. */
export async function reimportSource(lib: Library, ref: string): Promise<Reimported> {
  const item = findItem(lib, ref);
  const { url, course, type, video, title } = item.meta;
  // A file is read again from the copy kept beside it (source.*), so a better reader reaches it. Text
  // (a Markdown file, pasted text) reads the same every time, so there is nothing to read again.
  const kept = url ? undefined : readdirSync(item.dir).find((f) => f.startsWith("source.") && !/\.(md|markdown|txt|text)$/i.test(f) && kindOf(f));
  if (type === "snippet" || (!url && !kept)) throw new Error("Only a source added from a link or a file can be reimported.");
  const draft = await withImages(course ? await lessonDraft(await lessonOf(item)) : url ? await fromUrl(url, {}) : await fromBytes(new Uint8Array(readFileSync(join(item.dir, kept!))), kindOf(kept!)!, kept!));
  if (!draft.body.trim()) throw new Error("Found no text to read at the original now. It may have moved; open it to check.");
  if (draft.body === item.body) return { item, changed: false, moved: 0, removed: [] };
  const dir = stash(lib, item.meta.id);
  await withLock(paths.lock(lib), () => {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (const f of readdirSync(item.dir).filter(REPLACED)) copyFileSync(join(item.dir, f), join(dir, f));
    writeAtomic(join(dir, "highlights.json"), JSON.stringify(latestRevs(annotationRevs(item.dir))));
    for (const f of readdirSync(item.dir).filter((f) => REPLACED(f) && f !== "doc.md")) unlinkSync(join(item.dir, f));
    if (draft.source) writeAtomic(join(item.dir, `source.${draft.source.ext}`), draft.source.data);
    if (draft.transcript) writeAtomic(join(item.dir, "transcript.vtt"), draft.transcript);
    // Images are named by their content, so the previous version's stay for Undo and shared ones are not copied twice.
    for (const a of draft.assets ?? []) writeAtomic(join(item.dir, "assets", a.name), a.data);
    // The old body's hash stays until the highlights are re-anchored to the new body (reanchorItem).
    // A lesson read from its course page again (lessonOf) gains its page's link.
    const meta = { ...item.meta, type: draft.type, url: course ? (draft.url ?? url) : url, video: draft.video, author: item.meta.author ?? draft.author, published: draft.published ?? item.meta.published };
    writeAtomic(item.docPath, stringifyFrontmatter(meta, draft.body));
  });
  const next = readItemDir(item.dir);
  const report = await reanchorItem(lib, next);
  const gone = readAnnotations(next).filter((a) => report.orphaned.includes(a.id) && a.intent !== "question");
  for (const a of gone) reviseAnnotation(next, a, { status: "deleted" });
  return { item: readItemDir(item.dir), changed: true, moved: report.moved.length, removed: gone };
}

/** Puts back the version a reimport replaced, highlights included; run again, it redoes the reimport. */
export async function undoReimport(lib: Library, ref: string): Promise<Item> {
  const item = findItem(lib, ref);
  const dir = stash(lib, item.meta.id);
  if (!existsSync(join(dir, "doc.md"))) throw new Error("There is no reimport of this source to undo.");
  const saved = JSON.parse(readFileSync(join(dir, "highlights.json"), "utf8")) as Annotation[];
  await withLock(paths.lock(lib), () => {
    const tmp = swapFiles(item, dir);
    // The swap's other side becomes the stash, so the next call redoes.
    mkdirSync(dir, { recursive: true });
    for (const f of readdirSync(tmp)) copyFileSync(join(tmp, f), join(dir, f));
    rmSync(tmp, { recursive: true, force: true });
  });
  const now = readItemDir(item.dir);
  const current = new Map(latestRevs(annotationRevs(now.dir)).map((a) => [a.id, a]));
  const keep = new Set(saved.map((a) => a.id));
  for (const s of saved) {
    const c = current.get(s.id);
    if (c && (c.status !== s.status || c.start !== s.start || c.end !== s.end || c.exact !== s.exact))
      reviseAnnotation(now, c, { status: s.status, exact: s.exact, prefix: s.prefix, suffix: s.suffix, start: s.start, end: s.end });
  }
  // A highlight made on the other version, not on this one, re-anchors here or stays orphaned (kept).
  if ([...current.values()].some((a) => !keep.has(a.id) && a.status !== "deleted")) await reanchorItem(lib, readItemDir(now.dir));
  return readItemDir(now.dir);
}

export { academyLessons, addCourse, isCourseUrl, planCourse, type CourseAdded, type CourseLesson, type CoursePlan } from "./course.ts";
