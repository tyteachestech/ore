import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sourceFile, type Item } from "../items.ts";

export interface YoutubeDoc {
  title: string;
  author?: string;
  published?: string;
  url: string;
  vtt: string;
  body: string;
}

export const isYoutubeUrl = (url: string): boolean =>
  /^https?:\/\/(www\.|m\.|music\.)?(youtube\.com\/(watch|shorts|live)|youtu\.be\/)/.test(url);

function seconds(ts: string): number {
  const parts = ts.split(":").map(Number);
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export function stamp(sec: number): string {
  const s = Math.floor(sec);
  return `[${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}]`;
}

const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ");

/** The video ID in a YouTube URL (watch?v=, youtu.be/, shorts/, live/), or null. */
export function youtubeId(url: string): string | null {
  const m = url.match(/(?:[?&]v=|youtu\.be\/|\/(?:shorts|live|embed)\/)([\w-]{11})/);
  return m ? m[1]! : null;
}

type Cue = { start: number; end: number; lines: string[] };

function cues(vtt: string): Cue[] {
  const out: Cue[] = [];
  for (const block of vtt.replace(/\r\n/g, "\n").split(/\n\n+/)) {
    const lines = block.split("\n");
    const timing = lines.findIndex((l) => l.includes("-->"));
    if (timing === -1) continue;
    const [from, to] = lines[timing]!.split("-->");
    const start = seconds(from!.trim());
    out.push({ start, end: Math.max(start, seconds(to!.trim().split(/\s/)[0]!)), lines: lines.slice(timing + 1) });
  }
  return out;
}

const clean = (raw: string) => decode(raw.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

export type Word = { t: number; w: string };

// Auto-captions time each word inline: `hello<00:00:00.480><c> everyone</c>`.
function taggedWords(raw: string, start: number): Word[] | null {
  const parts = raw.split(/<(\d+:\d{2}(?::\d{2})?\.\d+)>/);
  if (parts.length < 3) return null;
  const words: Word[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const t = i === 0 ? start : seconds(parts[i - 1]!);
    for (const w of clean(parts[i]!).split(" ")) if (w) words.push({ t, w });
  }
  return words;
}

// YouTube auto-captions roll: each cue repeats the previous line, so a line equal to the last
// emitted one is dropped. Each kept line carries its words' start times: inline times when the
// captions have them, otherwise the cue's duration spread over its characters.
function captionLines(vtt: string): { t: number; text: string; words: Word[] }[] {
  const out: { t: number; text: string; words: Word[] }[] = [];
  let last = "";
  for (const cue of cues(vtt)) {
    const fresh: { raw: string; text: string }[] = [];
    for (const raw of cue.lines) {
      const text = clean(raw);
      if (!text || text === last) continue;
      fresh.push({ raw, text });
      last = text;
    }
    const total = fresh.reduce((n, l) => n + l.text.length + 1, 0);
    let done = 0;
    for (const { raw, text } of fresh) {
      let words = taggedWords(raw, cue.start);
      if (!words || words.map((w) => w.w).join(" ") !== text) {
        words = [];
        for (const w of text.split(" ")) {
          words.push({ t: cue.start + ((cue.end - cue.start) * done) / total, w });
          done += w.length + 1;
        }
      } else done += text.length + 1;
      out.push({ t: cue.start, text, words });
    }
  }
  return out;
}

// VTT → de-duplicated lines with start times.
export function vttLines(vtt: string): { t: number; text: string }[] {
  return captionLines(vtt).map(({ t, text }) => ({ t, text }));
}

/** Every word of the transcript in body order (D49), with its start time in seconds, never decreasing. */
export function vttWords(vtt: string): Word[] {
  let t = 0;
  return captionLines(vtt).flatMap((l) => l.words.map((w) => ({ t: (t = Math.max(t, w.t)), w: w.w })));
}

export type Chapter = { start_time: number; title: string };

// Paragraphs of roughly 30–60 s, each opening with [mm:ss]. A video's chapters become headings, so
// the reader's outline jumps through it; a paragraph never runs across one.
export function vttToBody(vtt: string, chapters: Chapter[] = []): string {
  const paras: string[] = [];
  const next = [...chapters].sort((a, b) => a.start_time - b.start_time);
  let start = -1;
  let text = "";
  for (const l of vttLines(vtt)) {
    const elapsed = l.t - start;
    const heading = next.length && next[0]!.start_time <= l.t + 0.5;
    if (heading) {
      if (text) paras.push(`${stamp(start)} ${text}`);
      while (next.length && next[0]!.start_time <= l.t + 0.5) paras.push(`### ${next.shift()!.title.trim()}`);
      start = l.t;
      text = l.text;
    } else if (start < 0 || elapsed >= 60 || (elapsed >= 30 && /[.!?♪]$/.test(text))) {
      if (text) paras.push(`${stamp(start)} ${text}`);
      start = l.t;
      text = l.text;
    } else text += " " + l.text;
  }
  if (text) paras.push(`${stamp(start)} ${text}`);
  return paras.join("\n\n") + "\n";
}

interface Track { ext: string; url: string }
interface Info {
  title: string;
  uploader?: string;
  channel?: string;
  upload_date?: string;
  webpage_url?: string;
  description?: string;
  language?: string | null;
  chapters?: Chapter[] | null;
  subtitles?: Record<string, Track[]>;
  automatic_captions?: Record<string, Track[]>;
}

/** The captions to read: English written by people first, then the video's own language (a Spanish
 *  lecture's Spanish), people's before YouTube's automatic ones, then English translated by YouTube. A human track may carry more than its language
 *  ("en-GB", or "en-qlPKC2UN_YU" as MIT OpenCourseWare names its own). When yt-dlp names no language, the
 *  video's own is the one its automatic captions were made in ("es-orig"), else its only human track's. */
export function pickTrack(info: Pick<Info, "language" | "subtitles" | "automatic_captions">): Track | undefined {
  const manual = info.subtitles ?? {};
  const auto = info.automatic_captions ?? {};
  const langs = Object.keys(manual).filter((k) => k !== "live_chat");
  const own = (info.language ?? Object.keys(auto).find((k) => k.endsWith("-orig"))?.slice(0, -5) ?? (langs.length === 1 ? langs[0] : undefined))?.split("-")[0];
  const of = (lang: string) => [...langs.filter((k) => k === lang), ...langs.filter((k) => k.startsWith(lang + "-"))].map((k) => manual[k]);
  // For a video in another language, YouTube's automatic "en" is a machine translation: last, after its own captions.
  const other = own && own !== "en" ? [...of(own), auto[`${own}-orig`], auto[own]] : [];
  const keys = [...of("en"), auto["en-orig"], ...other, auto["en"]];
  for (const tracks of keys) {
    const vtt = tracks?.find((t) => t.ext === "vtt");
    if (vtt) return vtt;
  }
  return undefined;
}

/** yt-dlp's path, looked up on the PATH as it is now (Bun.spawn alone sees the PATH the process began with). */
export const ytDlp = () => Bun.which("yt-dlp", { PATH: process.env.PATH });

/** The video's description under its own heading after the transcript: the links and resources its
 *  maker lists. Empty when there is none. */
const description = (d: string | undefined) => (d?.trim() ? `\n${DESCRIPTION_HEADING}\n\n${d.trim().replace(/\n{3,}/g, "\n\n").replace(/\n(?!\n)/g, "  \n")}\n` : "");
export const DESCRIPTION_HEADING = "## From the description";

/** A caption track's WebVTT. Some sites (TED) serve it as an HLS playlist of short VTT segments,
 *  fetched and joined in order; a cue a segment repeats is dropped as the rolling-caption repeat. */
export async function captions(text: string, url: string): Promise<string> {
  if (!text.startsWith("#EXTM3U")) return text;
  const parts = text.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const segs = await Promise.all(parts.map(async (p) => {
    const r = await fetch(new URL(p, url));
    if (!r.ok) throw new Error(`Couldn’t download the captions (HTTP ${r.status}). Try again in a minute.`);
    return (await r.text()).replace(/^WEBVTT[^\n]*\n(?:[^\n]+\n)*/, "");
  }));
  return "WEBVTT\n\n" + segs.join("\n\n");
}

export interface VideoOptions {
  /** Hear a video with no captions: download its sound and transcribe it on the Mac (D122). */
  listen?: boolean;
  onProgress?: (done: number, label?: string) => void;
}

/** A video from yt-dlp, YouTube or any site it reads (Vimeo, TED, Loom…), with its transcript: its
 *  captions, or with `listen`, what the Mac hears in its sound. */
export async function fetchYoutube(url: string, opts: VideoOptions = {}): Promise<YoutubeDoc> {
  const bin = ytDlp();
  if (!bin) throw new Error("Videos need yt-dlp, which isn’t installed. Run `brew install yt-dlp` in Terminal, then try again.");
  const info = JSON.parse(await ytdlpRun(bin, ["-J", "--skip-download", "--no-warnings", "--no-playlist", url])) as Info;
  const track = pickTrack(info);
  let vtt: string;
  if (track) {
    const res = await fetch(track.url);
    if (!res.ok) throw new Error(`Couldn’t download the captions (HTTP ${res.status}). Try again in a minute.`);
    vtt = await captions(await res.text(), track.url);
  } else if (opts.listen) vtt = await listen(bin, info.webpage_url ?? url, info.language ?? undefined, opts.onProgress);
  else throw new Error("This video has no captions, so there’s no transcript to read. If you have one, paste it here instead.");
  const d = info.upload_date;
  return {
    title: info.title,
    author: info.channel ?? info.uploader,
    published: d ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : undefined,
    url: info.webpage_url ?? url,
    vtt,
    body: vttToBody(vtt, info.chapters ?? []) + description(info.description),
  };
}

async function ytdlpRun(bin: string, args: string[]): Promise<string> {
  const proc = Bun.spawn([bin, ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) throw new Error(`Couldn’t get that video: ${stderr.trim().split("\n").pop()?.replace(/^ERROR:\s*/, "")}. Check the link; if it plays in the browser, run \`brew upgrade yt-dlp\` and try again.`);
  return stdout;
}

/** A video's sound, downloaded by yt-dlp (an m4a or mp4 the Mac can open) and transcribed. */
async function listen(bin: string, url: string, language: string | undefined, onProgress?: VideoOptions["onProgress"]): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "ore-video-"));
  try {
    onProgress?.(0, "No captions, so listening to the video…");
    await ytdlpRun(bin, ["-f", "ba[ext=m4a]/b[ext=mp4]/ba/b", "--no-playlist", "--no-warnings", "--max-filesize", "2G", "-o", join(dir, "sound.%(ext)s"), url]);
    const file = readdirSync(dir).find((f) => f.startsWith("sound.") && !f.endsWith(".part"));
    if (!file) throw new Error("Couldn’t download the video’s sound. Try again in a minute; if it has a transcript, paste it here instead.");
    return await (await import("./audio.ts")).transcribeFile(join(dir, file), onProgress, language);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** What the reader's player needs (D48, D49): the video ID and the transcript's word times, or
 *  null when the item plays no video with captions: a YouTube source, or a page with its video (D92).
 *  Words are `[seconds, word]`. */
export function transcriptOf(item: Item): { video: string; words: [number, string][] } | null {
  const link = item.meta.video ?? (item.meta.type === "youtube" ? item.meta.url : undefined);
  const video = link ? youtubeId(link) : null;
  const vtt = item.meta.video ? join(item.dir, "transcript.vtt") : sourceFile(item);
  if (!video || !vtt?.endsWith(".vtt") || !existsSync(vtt)) return null;
  return { video, words: vttWords(readFileSync(vtt, "utf8")).map((w) => [Math.round(w.t * 100) / 100, w.w]) };
}

/** SubRip (.srt) as WebVTT: the same cues with `,` as the decimal mark and numbered blocks. */
export const srtToVtt = (srt: string) =>
  "WEBVTT\n\n" + srt.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2").trim() + "\n";
