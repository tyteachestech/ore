import type { NewItem } from "../items.ts";
import { fetchYoutube, youtubeId } from "./youtube.ts";

// A page with written text and a video (D92): a course lesson, an article with an embedded talk. One
// source holds both: the video's transcript under its own heading, then the page's text, so the reader
// shows the video and its following transcript in a card and the text reads as an article below it. A plain YouTube link stays
// a transcript-only video source.

/** Below this many words a page is a wrapper around its video (a title, a blurb), not text to read. */
const REAL_TEXT = 100;

export const TRANSCRIPT_HEADING = "## Video transcript";

/** The one YouTube video a page embeds, as a watch link, or undefined: none, or several (the reader
 *  plays one video, and a page of many is a list, not a lesson). */
export function embeddedVideo(html: string): string | undefined {
  const ids = new Set<string>();
  for (const m of html.matchAll(/<iframe\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    if (!/^(?:https?:)?\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\//.test(m[1]!)) continue;
    const id = youtubeId(m[1]!);
    if (id) ids.add(id);
  }
  return ids.size === 1 ? `https://www.youtube.com/watch?v=${[...ids][0]}` : undefined;
}

/** The page's text without a first line that only repeats its title (a lesson page's heading). */
export const dropTitle = (md: string, title: string) => {
  const [first, ...rest] = md.trimStart().split("\n");
  return first!.replace(/^#+\s*/, "").trim().toLowerCase() === title.trim().toLowerCase() ? rest.join("\n") : md;
};

/** Whether a page's Markdown has text to read beside its video, not just a title and a blurb. */
export const hasText = (md: string) => md.replace(/!\[[^\]]*\]\([^)]*\)/g, " ").split(/\s+/).filter((w) => /\w/.test(w)).length >= REAL_TEXT;

/** Where the transcript of a page with its video ends and the page's text starts; never rendered. */
export const VIDEO_END = "<!-- end of video transcript -->";

/** The body of a page with its video: the transcript under its heading, where the video sits on the
 *  page, then the page's text. The reader shows the part up to VIDEO_END in a card with the player. */
export const withTranscript = (md: string, transcript: string) => `${TRANSCRIPT_HEADING}\n\n${transcript.trim()}\n\n${VIDEO_END}\n\n${md.trim()}\n`;

/** A web page as a source draft, with its video when it has one. `video` is a video the caller knows
 *  the page plays (a course lesson's): it must load, as the lesson is the video, and it is kept alone
 *  when the page has no text to read. A video found in the page is extra, so the page is kept alone
 *  when that video can't be read (no captions, yt-dlp missing). */
export async function pageDraft(html: string, url: string, opts: { title?: string; video?: string } = {}): Promise<Omit<NewItem, "skills" | "course">> {
  // No page (a lesson whose page wouldn't open) is no text: never parse the link itself, which for a
  // YouTube link makes Defuddle write its own copy of the transcript.
  const w = !html.trim() && opts.video ? null : await (await import("./web.ts")).htmlToDoc(html, url).catch((e) => {
    if (!opts.video) throw e;
    return null;
  });
  const link = opts.video ?? embeddedVideo(html);
  const y = link ? await fetchYoutube(link).catch((e) => (opts.video ? Promise.reject(e) : null)) : null;
  const title = opts.title ?? w?.title ?? url;
  if (y && (!w || !hasText(w.markdown))) return { type: "youtube", title, url: y.url, author: y.author, published: y.published, body: y.body, source: { ext: "vtt", data: y.vtt } };
  const article = { type: "article" as const, title, url, author: w!.author, published: w!.published, body: w!.markdown, source: { ext: "html", data: html } };
  if (!y) return article;
  return { ...article, video: y.url, transcript: y.vtt, body: withTranscript(dropTitle(w!.markdown, title), y.body) };
}
