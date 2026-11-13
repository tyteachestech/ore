import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import type { Region } from "./docling.ts";
import { doclingPath } from "./docling-path.ts";
import { homedir } from "node:os";
import { basename, extname, join, resolve, sep } from "node:path";
import { addHighlight, annotationRevs, readAnnotations, reanchorItem, reviseAnnotation, type Annotation, type Intent } from "../annotations.ts";
import { parseFrontmatter, stringifyFrontmatter } from "../frontmatter.ts";
import { deviceName, latestRevs, sha256, writeAtomic } from "../fsutil.ts";
import { nowIso } from "../ids.ts";
import { THEIRS_FIRST_MS } from "../inbox.ts";
import { allItems, createItem, findItem, keepPreview, ItemMetaSchema, readItemDir, setItemArchived, sourceFile, updateItemMeta, type Asset, type Item, type ItemMeta, type ItemType, type NewItem } from "../items.ts";
import { paths, type Library } from "../library.ts";
import { proseLines } from "../links.ts";
import { withLock } from "../lock.ts";
import { loadSkills, setItemSkills, unarchiveFiled } from "../skills.ts";
import { saveImages, withImages } from "./assets.ts";
import { recordEnd } from "../cut.ts";
import { BOT, cleanAuthor, cleanDate, FROM_TAB, refusal, wordCount } from "./check.ts";
import { isCourseUrl, lessonDraft, planCourse, type CourseLesson } from "./course.ts";
import { dropTitle, hasText, pageDraft } from "./page.ts";
import type { Tab } from "./tab.ts";
import { makeThumbnail } from "./thumbnail.ts";
import { fetchYoutube, isYoutubeUrl, owedVideo, ytDlp, srtToVtt, vttToBody, vttWords, youtubeId } from "./youtube.ts";
export { courseCoverFile, epubCover, makeCourseCover, makeThumbnail, pageImage, thumbnailFile } from "./thumbnail.ts";
export { transcriptOf, vttWords, youtubeId } from "./youtube.ts";
export { embeddedVideo, pageDraft, TRANSCRIPT_HEADING, VIDEO_END } from "./page.ts";

// The extractors pull in pdf.js, linkedom and defuddle (~200 ms to load), so they load only when a
// source is added, never on the reads every screen makes.
const pdfToDoc = async (bytes: Uint8Array, regions?: Region[]) => (await import("./pdf.ts")).pdfToDoc(bytes, regions);
const epubToDoc = async (bytes: Uint8Array) => (await import("./epub.ts")).epubToDoc(bytes);

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

export interface AddOptions {
  type?: ItemType;
  skills?: string[];
  /** Long steps (transcribing audio) report 0..1, and a line to show when there is one. */
  onProgress?: (done: number, label?: string) => void;
  /** A Feed post opened to read, not kept until he highlights or writes in it. */
  preview?: boolean;
  /** A PDF's tables and formulas as Docling read them (D125), swapped into pdf.js's text. */
  regions?: Region[];
  /** The speech's language when the episode names it (its feed's), so it is heard in it. */
  language?: string;
  /** A page that is an episode (D215): read as its episode (unset, a new add: when its audio comes),
   *  always (true: a Reimport of an episode, which must stay one), or never (false: of an article). */
  episode?: boolean;
  /** An episode comes in at once, by its title, show and date, with its transcript owed (D227): the
   *  download and the hearing are `fillOwed`'s, so he sees the source while they run. */
  owe?: boolean;
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
export const FILE_TYPES = ["pdf", "epub", "md", "markdown", "txt", "text", "html", "htm", "docx", "pptx", "rtf", "xlsx", "csv", "tsv", "ipynb", "srt", "vtt", "png", "jpg", "jpeg", "heic", "tiff", "webp", "gif", "mp3", "m4a", "wav", "aac", "aiff", "flac", "mp4", "mov", "m4v"];
/** Audio transcribed on the Mac (D96); as `audio.ts` AUDIO_TYPES, which loads only when used. */
const AUDIO_TYPES = ["mp3", "m4a", "wav", "aac", "aiff", "flac"];
/** Video files, heard from their sound on the Mac; as `audio.ts` VIDEO_TYPES. */
const VIDEO_TYPES = ["mp4", "mov", "m4v"];

/** A podcast or recording kept whole (D167): its audio file, to play in place, and the transcript's word
 *  times, as `transcriptOf` gives a video's. Audio added before D167 kept only its transcript: null. */
export function audioOf(item: Item, lib?: Library): { file: string; words: [number, string][] } | null {
  const file = sourceFile(item);
  const vtt = join(item.dir, "transcript.vtt");
  if (lib && !file && item.meta.owed?.length) {
    // An episode whose transcript is owed (D227) plays from its own address until its audio is kept.
    try {
      const at = (JSON.parse(readFileSync(owedNote(lib, item.meta.id), "utf8")) as { audio?: unknown }).audio;
      if (typeof at === "string" && /^https:\/\//.test(at)) return { file: at, words: [] };
    } catch {}
    return null;
  }
  if (!file || !AUDIO_TYPES.includes(extname(file).slice(1).toLowerCase()) || !existsSync(vtt)) return null;
  return { file, words: vttWords(readFileSync(vtt, "utf8")).map((w) => [Math.round(w.t * 100) / 100, w.w]) };
}

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

/** A zipped file (EPUB, Word, PowerPoint) that won't unzip or is missing its parts is damaged or
 *  only partly downloaded: say so, never "invalid zip data". Other errors pass through. */
const damaged = (what: string, app?: string) => (e: Error): never => {
  if (/invalid zip|zip data|unexpected EOF|is missing|no rootfile|Can't find end of central directory|Could not find file/i.test(e.message))
    throw new Error(`That ${what} file is damaged or only partly downloaded. Download it again${app ? `, or open it in ${app} and save a fresh copy` : ""}.`);
  throw e;
};

/** A source draft from a file's bytes, whatever it came from (a link or a file), by its kind. */
async function fromBytes(bytes: Uint8Array, kind: string, name: string, url?: string, base = url, opts: AddOptions = {}): Promise<NewItem> {
  if (AUDIO_TYPES.includes(kind)) {
    // Speech to a timed transcript, read like a subtitle file's (D96).
    const vtt = await (await import("./audio.ts")).transcribe(bytes, kind, opts.onProgress, opts.language);
    // A podcast host's file name ("17456166-summer-shorts-…") as words, its id dropped.
    const title = fileStem(name).replace(/^\d{5,}[-_ ]+/, "").replace(/[-_]+/g, " ").trim() || fileStem(name);
    // The audio itself is the original, kept to play in place (D122, D167); the timed transcript beside it.
    return { type: "article", title: title[0]!.toUpperCase() + title.slice(1), url, body: vttToBody(vtt), source: { ext: kind, data: bytes }, transcript: vtt };
  }
  if (kind === "pdf") {
    const p = await pdfToDoc(bytes, opts.regions).catch(async (e) => {
      // Scanned pages: read with the Mac's text recognition (D96).
      if (!(e instanceof (await import("./pdf.ts")).ScannedPdf)) throw e;
      return (await import("./ocr.ts")).scannedText(bytes, "pdf");
    });
    return { type: "pdf", title: p.title ?? fileStem(name), author: "author" in p ? p.author : undefined, url, body: p.body, source: { ext: "pdf", data: bytes }, assets: "assets" in p ? p.assets : undefined, structure: "structure" in p ? p.structure : undefined };
  }
  if (IMAGE_TYPES.includes(kind)) {
    // A screenshot or photo of text: its text to read, the image above it (D96).
    const o = await (await import("./ocr.ts")).scannedText(bytes, kind);
    const ext = kind === "jpeg" ? "jpg" : kind;
    const image = { name: (await import("./assets.ts")).assetName(bytes, ext), data: bytes };
    return { type: "article", title: o.title ?? fileStem(name), url, body: `![](assets/${image.name})\n\n${o.body}`, source: { ext, data: bytes }, assets: [image] };
  }
  if (kind === "epub") {
    const e = await Promise.resolve().then(() => epubToDoc(bytes)).catch(damaged("EPUB"));
    return { type: "epub", title: e.title ?? fileStem(name), author: e.author, published: e.published, url, body: e.body, source: { ext: "epub", data: bytes }, assets: e.assets };
  }
  if (kind === "xlsx") {
    const s = await Promise.resolve().then(async () => (await import("./sheets.ts")).xlsxToDoc(bytes)).catch(damaged("Excel", "Excel or Numbers"));
    return { type: "article", title: s.title ?? fileStem(name), author: s.author, url, body: s.body, source: { ext: "xlsx", data: bytes } };
  }
  if (kind === "docx" || kind === "pptx") {
    const office = await import("./office.ts");
    const o = await Promise.resolve().then(() => (kind === "docx" ? office.docxToDoc(bytes) : office.pptxToDoc(bytes))).catch(damaged(kind === "docx" ? "Word" : "PowerPoint", kind === "docx" ? "Word or Pages" : "PowerPoint or Keynote"));
    return { type: "article", title: o.title ?? fileStem(name), author: o.author, url, body: o.body, source: { ext: kind, data: bytes }, assets: o.assets };
  }
  if (kind === "rtf") {
    const r = (await import("./rtf.ts")).rtfToDoc(bytes);
    return { type: "article", title: r.title ?? fileStem(name), author: r.author, published: r.published, url, body: r.body, source: { ext: "rtf", data: bytes }, assets: r.assets };
  }
  const text = decodeText(bytes);
  if (kind === "csv" || kind === "tsv") {
    const s = (await import("./sheets.ts")).csvToDoc(text, kind === "tsv");
    return { type: "article", title: fileStem(name), url, body: s.body, source: { ext: kind, data: text } };
  }
  if (kind === "ipynb") {
    const n = (await import("./notebook.ts")).notebookToDoc(text);
    return { type: "article", title: n.title ?? fileStem(name), url, body: n.body, source: { ext: "ipynb", data: text }, assets: n.assets };
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
  // A page that is an episode comes in as its episode, the page kept beside it (D215).
  const heard = !page.video && opts.episode !== false && base && /^https?:/.test(base) ? await asEpisode(text, base, { ...page, url }, opts) : null;
  if (heard) return heard;
  // A page that is only a wall or a shell is refused, never saved as the content.
  const why = !page.video && refusal(page.title, page.body, url ? new URL(url).host : fileStem(name));
  if (why) throw new Error(why);
  return { ...page, url };
}

/** A page that is an episode (`pageAudio`) as its episode (D215): as an episode link gives it (the
 *  audio the original, to play in place, its heard transcript the text, D167), under the page's own
 *  title, author and date, with the page kept as `page.html` so its own text is one click away
 *  (`addPageText`). Audio that can't be fetched, isn't audio, or can't be heard (an older macOS,
 *  another language) leaves the article as it was; a page with no text of its own (a player's wrapper)
 *  has nothing else to keep, so it says why. Null: not an episode, or left as the article. */
async function asEpisode(html: string, base: string, page: NewItem, opts: AddOptions): Promise<NewItem | null> {
  const audio = (await import("./audio.ts")).pageAudio(html, base);
  if (!audio && opts.episode) throw new Error("Couldn’t find the episode’s audio on its page any more, so it was left as it was. Open the page to check.");
  if (!audio) return null;
  try {
    // An episode this machine can't hear (another computer, an older macOS) isn't downloaded for nothing.
    if (!(await import("./audio.ts")).canTranscribe()) throw new Error("Transcribing audio needs macOS 26 or later on a Mac. If it has a transcript, copy it and paste it here instead.");
    const res = await get(audio, new URL(audio).host);
    const kind = kindOf(new URL(res.url || audio).pathname, res.headers.get("content-type") ?? "");
    if (!kind || !AUDIO_TYPES.includes(kind)) {
      await res.body?.cancel();
      throw new Error(noPaste("The episode’s audio on that page isn’t a sound file Ore can hear."));
    }
    const ep = await fromBytes(await readCapped(res), kind, page.title, page.url, page.url, opts);
    return { ...ep, title: page.title, author: page.author, published: page.published, page: html };
  } catch (e) {
    if (!hasText(page.body) || opts.episode) throw e;
    return null;
  }
}

/** Where an episode's page text starts once he adds it (D215). */
export const PAGE_HEADING = "## From the page";
const pageFile = (item: Item) => join(item.dir, "page.html");

/** Whether a source is an episode whose page is kept and whose text he hasn't added (D215). */
export const hasPageText = (item: Item) => existsSync(pageFile(item)) && !item.meta.page_added;

/** A kept episode page's own text as the article reader makes it (headings, links, speaker names), its
 *  images saved, as the section added below the transcript. */
async function pageSection(html: string, url: string | undefined, title: string): Promise<{ text: string; assets: Asset[] }> {
  const w = await (await import("./web.ts")).htmlToDoc(html, url ?? "about:blank");
  const { body, assets } = await saveImages(dropTitle(w.markdown, title), { referer: url });
  if (!body.trim()) throw new Error("Found no text on the page to add.");
  return { text: `${PAGE_HEADING}\n\n${body.trim()}\n`, assets };
}
/** The section after a body, a blank line between them. */
const below = (body: string, section: string) => `${body.endsWith("\n") ? "" : "\n"}\n${section}`;
const marked = (meta: ItemMeta, id: string | undefined): ItemMeta => ({ ...meta, page_added: id });

/** Adds an episode's page text below its transcript (D215), under PAGE_HEADING at the end, so no
 *  highlight moves. The page is read and its images fetched first; the text goes in under the lock,
 *  checked again there, so two at once add it once. Undone with `undoPageText`, redone with `redoPageText`. */
export async function addPageText(lib: Library, ref: string): Promise<import("../cut.ts").Cut> {
  const item = findItem(lib, ref);
  const refuse = (i: Item) => {
    if (!existsSync(pageFile(i))) throw new Error("This source has no page kept to add text from.");
    if (!hasPageText(i)) throw new Error("The page’s text is already in this source.");
  };
  refuse(item);
  const { text, assets } = await pageSection(readFileSync(pageFile(item), "utf8"), item.meta.url, item.meta.title);
  for (const a of assets) writeAtomic(join(item.dir, "assets", a.name), a.data);
  return (await import("../cut.ts")).appendText(lib, ref, (now) => (refuse(now), below(now.body, text)), marked);
}
/** Takes the added page text out again; its highlights go with it until `redoPageText`. */
export const undoPageText = async (lib: Library, ref: string, id: string) => (await import("../cut.ts")).takeEnd(lib, ref, id, marked);
/** Puts the page text back below the transcript, its highlights with it. */
export const redoPageText = async (lib: Library, ref: string, id: string) => (await import("../cut.ts")).putEnd(lib, ref, id, marked);

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
  if (/\brtf\b/.test(ctype) || ext === "rtf") return "rtf";
  if (ctype.includes("spreadsheetml") || ext === "xlsx") return "xlsx";
  if (/text\/csv/.test(ctype) || ext === "csv") return "csv";
  if (/tab-separated/.test(ctype) || ext === "tsv") return "tsv";
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
    // No yt-dlp and no way to get it (the iPhone): the video now, its transcript owed (D227).
    if (process.env.ORE_NO_TOOLS && isYoutubeUrl(url) && youtubeId(url) && !ytDlp()) return { type: "youtube", ...(await owedVideo(url)), body: "", source: { ext: "vtt", data: "WEBVTT\n" }, owed: ["transcript"] };
    const y = await fetchYoutube(url, { listen: true, onProgress: opts.onProgress });
    return { type: "youtube", title: y.title, url: y.url, author: y.author, published: y.published, body: y.body, source: { ext: "vtt", data: y.vtt } };
  }
  const refused = refuseLink(url);
  if (refused) throw new Error(refused);
  if (PODCAST.test(url)) {
    // An episode link: its audio, transcribed, under the episode's title (D96).
    const ep = await (await import("./audio.ts")).episode(url);
    if (opts.owe) return { type: "article", title: ep.title ?? "Episode", url, author: ep.show, published: ep.published, body: "", owed: ["transcript"], picture: ep.artwork, listen: ep.audio };
    opts.onProgress?.(0, "Downloading");
    const res = await get(ep.audio, new URL(ep.audio).host);
    const ext = kindOf(new URL(res.url || ep.audio).pathname, res.headers.get("content-type") ?? "") ?? "mp3";
    const mb = (n: number) => Math.max(1, Math.round(n / 1e6));
    const bytes = await readCapped(res, (got, of) => opts.onProgress?.(got / of, `Downloading ${mb(got)} of ${mb(of)} MB`));
    const draft = await fromBytes(bytes, ext, ep.title ?? "Episode", url, url, { ...opts, language: ep.language ?? opts.language });
    return { ...draft, title: ep.title ?? draft.title, author: ep.show, published: ep.published, picture: ep.artwork };
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
  // A Google Doc or deck that isn't shared answers its export link with a sign-in page or an error.
  const google = rw?.url.startsWith("https://docs.google.com/") ? `That Google ${rw.url.includes("/presentation/") ? "Slides deck" : rw.url.includes("/spreadsheets/") ? "Sheet" : "Doc"} isn’t shared publicly, so Ore can’t download it. In Google, choose Share › Anyone with the link, then add it again; or open it in your browser and ${FROM_TAB}.` : null;
  const res = await get(rw?.url ?? url, host).catch((e) => {
    if (google) throw new Error(google);
    return rw?.url.startsWith("https://arxiv.org/html/") ? get(rw.url.replace("/html/", "/pdf/"), host) : Promise.reject(e);
  });
  const ctype = res.headers.get("content-type") ?? "";
  if (google && (/html/.test(ctype) || /accounts\.google\.com/.test(res.url))) {
    await res.body?.cancel();
    throw new Error(google);
  }
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

export async function readCapped(res: Response, onProgress?: (got: number, of: number) => void): Promise<Uint8Array> {
  const of = Number(res.headers.get("content-length") ?? 0);
  if (of > MAX_BYTES) {
    await res.body?.cancel();
    throw new Error(tooBig());
  }
  const parts: Uint8Array[] = [];
  let size = 0;
  // The stream's own reader, not `for await`: iOS 26's web view can't iterate a body, so every download failed there.
  const reader = res.body?.getReader();
  for (let r = await reader?.read(); r && !r.done; r = await reader!.read()) {
    size += r.value.length;
    if (size > MAX_BYTES) {
      await reader!.cancel();
      throw new Error(tooBig());
    }
    parts.push(r.value);
    if (of > 0) onProgress?.(Math.min(size, of), of);
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

/** Files only their own app reads, refused with how to save a copy Ore does read (D96). Pages and
 *  Keynote keep their text in Apple's private format; Word's pre-2007 .doc is a binary one. */
function exportFirst(ext: string): string | null {
  const apple = { pages: ["Pages", "Word"], key: ["Keynote", "PowerPoint"], numbers: ["Numbers", "Excel"] }[ext];
  if (apple) return `Ore can’t read ${apple[0]} files. Open it in ${apple[0]} and choose File › Export To › ${apple[1]}, then add that file.`;
  if (["mobi", "azw", "azw3", "kfx"].includes(ext)) return "That’s a Kindle book, which Ore can’t read. If it isn’t locked to Kindle, convert it to EPUB (Calibre does this for free) and add that.";
  if (ext === "doc") return "That’s an older Word file (.doc). Open it in Word or Pages and choose File › Save As, as a .docx, then add that file.";
  return null;
}

async function fromFile(path: string, opts: AddOptions, input = path): Promise<NewItem> {
  if (!existsSync(path)) {
    // "example.com/post" typed without its scheme reads as a path; say how to add it as the link it is.
    const site = /^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(\/|$)/i.test(input) && !kindOf(input.split("/")[0]!) ? ` For a web page, add its full link: https://${input}` : " Check the path, or drag the file in instead.";
    throw new Error(`There’s no file at ${path}.${site}`);
  }
  // Finder's own files (.DS_Store, AppleDouble ._ copies) ride along when a folder's files are dropped.
  if (/^(\.DS_Store|\._.*|Icon\r)$/.test(basename(path))) throw new Error(`“${basename(path)}” is a file Finder keeps for itself, not something to read. Add the file you meant instead.`);
  const exported = exportFirst(extname(path).slice(1).toLowerCase());
  if (exported) throw new Error(exported);
  const stat = statSync(path);
  if (stat.isDirectory()) throw new Error("That’s a folder. Open it and add the files inside instead.");
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

// Tags a share or an ad adds to a link (utm_source=chatgpt.com, fbclid…): not part of the page, so a link is
// kept without them, as Raindrop does, and the page added again with other tags is the source already here.
const TRACKING = /^(utm_\w+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|mc_cid|mc_eid|igshid|yclid|_hsenc|_hsmi|mkt_tok)$/i;
function untracked(url: string): string {
  const [, head, query, hash] = url.match(/^([^?#]*)(?:\?([^#]*))?(#.*)?$/)!;
  if (query === undefined) return url;
  // Only the tags go: the rest of the link is kept exactly as written.
  const kept = query.split("&").filter((p) => p && !TRACKING.test(p.split("=")[0]!));
  return `${head}${kept.length ? `?${kept.join("&")}` : ""}${hash ?? ""}`;
}
/** The same page's link, however it was written: with or without tags, the host in any case, a default port. */
const linkKey = (url: string) => (URL.canParse(url) ? new URL(untracked(url)).href : url);
/** The source already here from this link (a course's lessons aside); `preview` counts Feed posts being read. */
const byLink = (lib: Library, url: string, preview = false) => allItems(lib, { preview }).find((i) => i.meta.url !== undefined && linkKey(i.meta.url) === linkKey(url) && !i.meta.course);

// Ingest a URL or file into items/ with status inbox. Files dropped in
// inbox/ are removed after a successful ingest (they now live as source.*).
// A link already in the library isn't added twice: it comes back `kept`, filed under the new skills too.
export async function addSource(lib: Library, input: string, opts: AddOptions = {}): Promise<Item & Partial<Kept>> {
  input = input.replace(/^~(?=\/)/, homedir());
  const isUrl = /^https?:\/\//i.test(input);
  if (isUrl && !URL.canParse(input)) throw new Error("That link looks cut off. Copy it again from the address bar.");
  if (isUrl) input = untracked(input);
  if (!isUrl && /^[a-z][\w+.-]*:/i.test(input) && !existsSync(input)) throw new Error("Ore opens web links (http or https) and files. Open that one in your browser, then add the page from there.");
  const had = isUrl ? byLink(lib, input, true) : undefined;
  if (had && opts.preview) return had;
  if (had) return keep(lib, had, opts);
  const draft = isUrl ? await fromUrl(input, opts) : await fromFile(resolve(input), opts, input);
  if (!draft.body.trim() && !draft.owed?.length) throw new Error("Found no text to read in that. Copy the text and paste it here instead.");
  const ready = await withImages(draft);
  // The same file added again (dropped twice, or a copy) is the source already here.
  const same = !isUrl && sameText(lib, ready.body);
  const item = same ? await keep(lib, same, opts) : await createItem(lib, { ...ready, skills: opts.skills, preview: opts.preview });
  if (!isUrl && resolve(input).startsWith(paths.inbox(lib) + sep)) unlinkSync(resolve(input));
  if (!same && ready.owed?.length) {
    mkdirSync(paths.inbox(lib), { recursive: true });
    writeAtomic(owedNote(lib, item.meta.id), JSON.stringify({ id: item.meta.id, owed: ready.owed, device: deviceName(), added: nowIso(), ...((await canFill(item)) ? { self: true } : {}), ...(ready.listen ? { audio: ready.listen } : {}) }) + "\n");
  }
  if (!same) await makeThumbnail(item, { from: ready.picture });
  if (!opts.preview) await unarchive(lib, opts.skills); // a Feed post read as a preview isn't filed
  return item;
}

/** A new source filed under an archived skill brings the skill back (D173). */
export async function unarchive(lib: Library, skills: string[] | undefined): Promise<void> {
  if (skills?.length && loadSkills(lib).skills.some((s) => s.archived && skills.includes(s.id))) await withLock(paths.lock(lib), () => unarchiveFiled(lib, skills));
}

/** The source already here with this text (a file dropped twice, text pasted again), by the hash createItem
 *  stores: of the body with its line ends as every read sees them, so Windows line ends match too. */
function sameText(lib: Library, body: string): Item | undefined {
  const hash = sha256(body.replace(/\r\n?/g, "\n"));
  return allItems(lib, { preview: true }).find((i) => i.meta.text_sha256 === hash && !i.meta.course);
}

/** Kept sources: what adding one again did, so the app can say it ("Added to AI", "back from Archived"). */
export type Kept = { kept: true; filed: string[]; restored: boolean; fromFeed: boolean };

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
  isYoutubeUrl(url) || VIDEO_SITE.test(url) || !!(await import("./links.ts")).rewrite(url) || /\.(pdf|epub|docx|pptx|rtf|xlsx|csv|tsv|ipynb)(?:[?#]|$)/i.test(url);

/** The page open in his browser as a source (D96): signed-in, paywalled and browser-built pages come
 *  in as he sees them. A link Ore reads better by fetching (a video, a PDF) is added by its link. */
export async function addTab(lib: Library, opts: AddOptions & { tab?: Tab } = {}): Promise<Item & Partial<Kept>> {
  const front = opts.tab ?? (await (await import("./tab.ts")).frontTab());
  const tab = { ...front, url: untracked(front.url) };
  if (await readsByLink(tab.url)) return addSource(lib, tab.url, opts);
  const had = byLink(lib, tab.url);
  if (had) return addSource(lib, tab.url, opts);
  const host = new URL(tab.url).host;
  const draft = await tabDraft(tab, host);
  const item = await createItem(lib, { ...(await withImages(draft)), skills: opts.skills });
  await makeThumbnail(item);
  await unarchive(lib, opts.skills);
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
// Pasted HTML (a ChatGPT answer, a page's selection) keeps its headings, tables, math, code and images,
// which its plain text loses; the images it shows are saved beside it, as a page's are (D96, D122).
// The same text pasted again (a retry after an add that looked failed) is the source already here, as a file's is.
export async function addText(lib: Library, text: string, opts: AddOptions & { html?: boolean } = {}): Promise<Item & Partial<Kept>> {
  if (!text.trim()) throw new Error("text is empty");
  const draft = opts.html ? await pastedDraft(text) : null;
  const source = draft ? draft.source.data : text.trim() + "\n";
  const md = draft ?? markdownFile(source, "");
  if (!md.body.trim()) throw new Error(opts.html ? "the pasted text is empty" : "text is empty: only frontmatter, no text to read");
  // The same paste again is the source already here, whether or not its images were saved the first time.
  const before = sameText(lib, md.body.trim() + "\n");
  if (before) return keep(lib, before, opts);
  const { body, assets } = await saveImages(md.body.trim() + "\n");
  const same = sameText(lib, body);
  if (same) return keep(lib, same, opts);
  const first = body.split("\n")[0]!.replace(/^#+\s*/, "");
  const title = md.title || (first.length > 80 ? first.slice(0, 77).trimEnd() + "…" : first);
  const item = await createItem(lib, { type: "markdown", title, author: md.author, published: md.published, body, source: { ext: draft ? "html" : "md", data: source }, assets, skills: opts.skills });
  await unarchive(lib, opts.skills);
  return item;
}

/** Pasted HTML as a Markdown source, its paste kept whole as the original (source.html), which a
 *  reimport reads the same way. */
async function pastedDraft(html: string): Promise<{ title: string; author?: string; published?: string; body: string; source: { ext: "html"; data: string } }> {
  // The clipboard holds only the selection's tags (`<meta charset><h1>…`), which a page reader can't place.
  const page = /<body[\s>]/i.test(html) ? html : `<!doctype html><html><head><meta charset="utf-8"></head><body>${html.replace(/^\s*<meta[^>]*>/i, "")}</body></html>\n`;
  return { ...(await pastedMarkdown(page)), source: { ext: "html", data: page } };
}

/** The pasted page as Markdown: read as a page is (math, tables, code), or, when that drops much of
 *  its text, converted tag by tag. A code block's own header (ChatGPT's language label and Copy
 *  button) is left out, so the code reads as written. */
async function pastedMarkdown(html: string): Promise<{ title: string; body: string }> {
  const { parseHTML } = await import("linkedom");
  const { document } = parseHTML(html);
  for (const pre of document.querySelectorAll("pre")) {
    const code = pre.querySelector("code");
    if (code && code.parentElement !== pre) pre.replaceChildren(code);
  }
  // Buttons (Copy code, Copy table) and what is drawn only for the eye (KaTeX's glyphs beside its TeX).
  for (const b of document.querySelectorAll('button, [aria-hidden="true"]')) b.remove();
  // A citation pill's "+2" (two more sources behind it) is a count, not the link's name.
  for (const n of document.querySelectorAll("a span")) if (/^\+\d+$/.test(n.textContent?.trim() ?? "")) n.remove();
  // An image with no address of its own (a page's relative one) can't be fetched from a paste.
  for (const img of document.querySelectorAll("img")) if (!/^https?:\/\//i.test(img.getAttribute("src") ?? "")) img.remove();
  const page = document.toString();
  const all = wordCount(document.body?.textContent ?? "");
  // An image on its own line is its own block, never glued to the math or list beside it.
  const own = (md: string) => md.replace(/^[ \t]*(!\[[^\]\n]*\]\([^)\n]+\))[ \t]*$/gm, "\n$1\n").replace(/\n{3,}/g, "\n\n");
  const { htmlToDoc } = await import("./web.ts");
  const d = await htmlToDoc(page, "file:///pasted", 0).catch(() => null);
  if (d && wordCount(d.markdown) >= all / 2) return { title: d.title === "file:///pasted" ? "" : d.title, body: own(d.markdown) };
  const { td } = await import("./markdown.ts");
  return { title: "", body: own(td.turndown(document.body as unknown as HTMLElement)) };
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
  await unarchive(lib, s.skills);
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
// layout.json (D125) belongs to the version it was read into, so Undo takes its tables back out too.
const REPLACED = (name: string) => name === "doc.md" || name === "transcript.vtt" || name === "layout.json" || name.startsWith("source.") || name === "page.html";
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
  const meta = { ...item.meta, type: was.type, url: was.url, video: was.video, page_added: was.page_added, author: was.author, published: was.published, structure: was.structure, text_sha256: was.text_sha256 };
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
export async function reimportSource(lib: Library, ref: string, { local = false, regions: read, onProgress, turn = (f) => f() }: { local?: boolean; regions?: Region[]; onProgress?: AddOptions["onProgress"]; turn?: Turn } = {}): Promise<Reimported> {
  const item = findItem(lib, ref);
  const { url, course, type } = item.meta;
  // A file is read again from the copy kept beside it (source.*), so a better reader reaches it. Text
  // (a Markdown file, pasted text) reads the same every time, so there is nothing to read again.
  // `local` reads the kept copy of a link's file too (a PDF's tables, read from the copy they came from).
  const copy = readdirSync(item.dir).find((f) => f.startsWith("source.") && !/\.(md|markdown|txt|text)$/i.test(f) && kindOf(f));
  const kept = url && !(local && copy) ? undefined : copy;
  if (type === "snippet" || (!url && !kept)) throw new Error("Only a source added from a link or a file can be reimported.");
  const regions = read ?? layoutOf(item.dir);
  // A pasted page (source.html beside a Markdown source) is read as it was pasted.
  const pasted = type === "markdown" && !url && kept === "source.html";
  const draft = await withImages(pasted ? { type: "markdown" as const, ...(await pastedDraft(readFileSync(join(item.dir, kept), "utf8"))) } : course && !kept ? await lessonDraft(await lessonOf(item)) : !kept ? await fromUrl(url!, { regions, episode: existsSync(pageFile(item)), onProgress }) : await fromBytes(new Uint8Array(readFileSync(join(item.dir, kept))), kindOf(kept)!, kept, url, url, { regions }));
  if (draft.owed?.length) throw new Error("This video’s transcript comes in through your Mac.");
  return turn(() => rewrite(lib, item, draft, regions));
}

/** One library change at a time where commands share a process (the iPhone): the reading above can take
 *  minutes and holds nothing; the writing below takes its turn. */
export type Turn = <T>(f: () => Promise<T>) => Promise<T>;

/** `draft`, read again from where `item` came from, in its place: the old version stashed for Undo, its
 *  highlights moved to the new text. */
async function rewrite(lib: Library, was: Item, draft: NewItem, regions: Region[] | undefined): Promise<Reimported> {
  // As it is now: he may have renamed or filed it while it was read, and one he deleted is not brought back.
  const item = findItem(lib, was.meta.id);
  const { url, course } = item.meta;
  if (!draft.body.trim()) throw new Error("Found no text to read at the original now. It may have moved; open it to check.");
  // An episode he added its page text to keeps it, after the transcript, so its highlights re-anchor (D215).
  const section = item.meta.page_added && draft.page ? await pageSection(draft.page, url, item.meta.title) : undefined;
  const tail = section && below(draft.body, section.text);
  if (section && tail) {
    draft.body += tail;
    draft.assets = [...(draft.assets ?? []), ...section.assets];
  }
  if (draft.body === item.body) {
    // A better reader may learn something about the same text: a PDF's tables still to be read (D125).
    if (String(draft.structure ?? "") !== String(item.meta.structure ?? "")) item.meta = await updateItemMeta(lib, item.meta.id, (m) => ({ ...m, structure: draft.structure }));
    return { item, changed: false, moved: 0, removed: [] };
  }
  const dir = stash(lib, item.meta.id);
  await withLock(paths.lock(lib), () => {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    for (const f of readdirSync(item.dir).filter(REPLACED)) copyFileSync(join(item.dir, f), join(dir, f));
    writeAtomic(join(dir, "highlights.json"), JSON.stringify(latestRevs(annotationRevs(item.dir))));
    for (const f of readdirSync(item.dir).filter((f) => REPLACED(f) && f !== "doc.md")) unlinkSync(join(item.dir, f));
    if (draft.source) writeAtomic(join(item.dir, `source.${draft.source.ext}`), draft.source.data);
    if (draft.transcript) writeAtomic(join(item.dir, "transcript.vtt"), draft.transcript);
    if (draft.page) writeAtomic(join(item.dir, "page.html"), draft.page);
    if (regions?.length) writeAtomic(join(item.dir, "layout.json"), JSON.stringify(regions));
    // Images are named by their content, so the previous version's stay for Undo and shared ones are not copied twice.
    for (const a of draft.assets ?? []) writeAtomic(join(item.dir, "assets", a.name), a.data);
    // The old body's hash stays until the highlights are re-anchored to the new body (reanchorItem).
    // A lesson read from its course page again (lessonOf) gains its page's link.
    // Read again under the lock: a background enrich may have written its questions while this one read.
    const now = readItemDir(item.dir).meta;
    const added = tail ? recordEnd(lib, item.meta.id, draft.body.length - tail.length, tail) : undefined;
    const meta = { ...now, type: draft.type, url: course ? (draft.url ?? url) : url, video: draft.video, page_added: added, author: now.author ?? draft.author, published: draft.published ?? now.published, structure: draft.structure, owed: undefined, owed_error: undefined };
    writeAtomic(item.docPath, stringifyFrontmatter(meta, draft.body));
  });
  const next = readItemDir(item.dir);
  const report = await reanchorItem(lib, next);
  const gone = readAnnotations(next).filter((a) => report.orphaned.includes(a.id) && a.intent !== "question");
  for (const a of gone) reviseAnnotation(next, a, { status: "deleted" });
  return { item: readItemDir(item.dir), changed: true, moved: report.moved.length, removed: gone };
}

/** Where a source with a part owed is noted, beside the links waiting in inbox/: a pass that finds none
 *  reads one folder, not every source. */
const owedNote = (lib: Library, id: string) => join(paths.inbox(lib), `${id}.owed.json`);

/** Whether this device has what a source's owed part takes: yt-dlp for a video's transcript, speech for
 *  an episode's. */
const canFill = async (item: Item) => (item.meta.type === "youtube" ? !!ytDlp() : (await import("./audio.ts")).canTranscribe());

/** Fills what was added with a part owed (D227): a video a phone has no yt-dlp for, an episode that came
 *  in at once and is downloaded and heard after. Each is read again here, as a reimport, when this device
 *  can. The device that added one and can fill it goes first; another waits five minutes, as for the links
 *  in the inbox. One that fails keeps its reason and waits for a Reimport by hand, so a video that is gone
 *  isn't asked for on every pass. */
export async function fillOwed(lib: Library, opts: { onProgress?: (id: string, done: number, label?: string) => void; turn?: Turn; now?: number } = {}): Promise<Item[]> {
  if (!existsSync(paths.inbox(lib))) return [];
  const notes = readdirSync(paths.inbox(lib)).filter((n) => n.endsWith(".owed.json") && !n.startsWith("."));
  const turn: Turn = opts.turn ?? ((f) => f());
  const filled: Item[] = [];
  for (const name of notes) {
    const id = name.replace(/\.owed\.json$/, "");
    let item: Item;
    let note: { device?: string; added?: string; self?: boolean } = {};
    try {
      item = findItem(lib, id);
      note = JSON.parse(readFileSync(join(paths.inbox(lib), name), "utf8")) as typeof note;
    } catch {
      continue; // its source hasn't arrived yet (iCloud), or a synced copy of the note
    }
    if (!(await canFill(item))) continue;
    const theirs = note.self && note.device !== deviceName() && (opts.now ?? Date.now()) - Date.parse(note.added ?? "") < THEIRS_FIRST_MS;
    if (theirs) continue;
    if (item.meta.owed?.length && !item.meta.owed_error) {
      // Its own now: a long download here starts the other devices' five minutes again, so two never hear it at once.
      writeAtomic(owedNote(lib, id), JSON.stringify({ ...note, id, owed: item.meta.owed, device: deviceName(), added: nowIso(), self: true }) + "\n");
      try {
        filled.push((await reimportSource(lib, id, { onProgress: (done, label) => opts.onProgress?.(id, done, label), turn })).item);
      } catch (e) {
        // Archived or deleted while it downloaded: nothing left to mark.
        await turn(() => updateItemMeta(lib, id, (m) => ({ ...m, owed_error: e instanceof Error ? e.message : String(e) }))).catch(() => {});
      }
    }
    rmSync(owedNote(lib, id), { force: true });
  }
  return filled;
}

/** The tables and formulas Docling read in a source's PDF (D125), kept beside it as `layout.json` so a
 *  reimport keeps them without reading the PDF with Docling again. */
function layoutOf(dir: string): Region[] | undefined {
  try {
    return JSON.parse(readFileSync(join(dir, "layout.json"), "utf8")) as Region[];
  } catch {
    return undefined;
  }
}

const tablesFile = (lib: Library, id: string, ext: "reading" | "error") => join(paths.logs(lib), `tables-${id}.${ext}`);

/** Reads a PDF source's tables and formulas with Docling (D125) and puts them in its text in place of
 *  pdf.js's lines, through a reimport from the kept PDF: the prose is unchanged, so every highlight
 *  stays where it is. While it runs, and after it fails, `tablesState` says so. */
export async function readTables(lib: Library, ref: string): Promise<Reimported & { regions: number }> {
  const item = findItem(lib, ref);
  if (item.meta.type !== "pdf" || !existsSync(join(item.dir, "source.pdf"))) throw new Error("Only a PDF source has tables and formulas to read.");
  markTablesReading(lib, item.meta.id, process.pid);
  try {
    const regions = await (await import("./docling.ts")).runDocling(join(item.dir, "source.pdf"));
    const r = await reimportSource(lib, item.meta.id, { local: true, regions });
    // Nothing to swap in is still a reading: the PDF stops offering it.
    if (!r.changed) writeAtomic(join(item.dir, "layout.json"), JSON.stringify(regions));
    rmSync(tablesFile(lib, item.meta.id, "error"), { force: true });
    return { ...r, regions: regions.length };
  } catch (e) {
    writeFileSync(tablesFile(lib, item.meta.id, "error"), e instanceof Error ? e.message : String(e));
    throw e;
  } finally {
    rmSync(tablesFile(lib, item.meta.id, "reading"), { force: true });
  }
}

/** Marks a PDF's tables as being read by the run `pid`, until it ends. */
export function markTablesReading(lib: Library, id: string, pid: number): void {
  mkdirSync(paths.logs(lib), { recursive: true });
  writeFileSync(tablesFile(lib, id, "reading"), String(pid));
}

/** Where a PDF's tables stand: being read now, read (its layout.json), or why the last reading failed;
 *  for one with tables or formulas still read as lines, whether the reader is here to read them. */
export function tablesState(lib: Library, item: Item): { tables?: "reading" | "read"; tables_error?: string; tables_reader?: boolean } {
  if (item.meta.type !== "pdf") return {};
  const pid = Number(readOr(tablesFile(lib, item.meta.id, "reading")));
  if (pid && alive(pid)) return { tables: "reading" };
  if (existsSync(join(item.dir, "layout.json"))) return { tables: "read" };
  const error = readOr(tablesFile(lib, item.meta.id, "error"));
  const reader = item.meta.structure?.length ? { tables_reader: !!doclingPath() } : {};
  return error ? { tables_error: error, ...reader } : reader;
}

const readOr = (f: string) => {
  try {
    return readFileSync(f, "utf8").trim();
  } catch {
    return "";
  }
};
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

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
