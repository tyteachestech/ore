import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { madeThisRun } from "../cancel.ts";
import { run, swiftHelper } from "./swift.ts";

// Audio and podcast episodes (D96 phase 3): transcribed on the Mac with Apple's on-device speech
// recognition, into the same timed transcript a video or subtitle file gives.

/** Audio file types the Mac transcribes. */
export const AUDIO_TYPES = ["mp3", "m4a", "wav", "aac", "aiff", "flac"];
/** Video files the Mac transcribes from their sound (lecture recordings, Zoom, downloaded courses). */
export const VIDEO_TYPES = ["mp4", "mov", "m4v"];

type Progress = (done: number, label?: string) => void;

/** The audio as WebVTT. `onProgress` gets 0..1 as it goes, and a line to show while the speech model
 *  downloads the first time. */
export async function transcribe(data: Uint8Array, ext: string, onProgress?: Progress): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "ore-audio-"));
  madeThisRun(dir);
  try {
    const file = join(dir, `audio.${ext}`);
    writeFileSync(file, data);
    return await transcribeFile(file, onProgress);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A sound or video file on disk as WebVTT, without reading it into memory (a lecture video can be
 *  gigabytes). `language` is the speech's language when known (a video's, "es"); else the Mac's. */
export async function transcribeFile(file: string, onProgress?: Progress, language?: string): Promise<string> {
  const bin = process.env.ORE_TRANSCRIBE ?? (process.platform === "darwin" ? await swiftHelper("transcribe") : null);
  if (!bin) throw new Error("Transcribing audio works on a Mac only. If it has a transcript, copy it and paste it here instead.");
  const vtt = await run(bin, language ? [file, language] : [file], (line) => {
    const p = line.match(/^progress ([\d.]+)/);
    if (p) onProgress?.(Number(p[1]));
    else if (line.startsWith("status ")) onProgress?.(0, line.slice(7));
  }).catch((e: Error & { code?: number }) => {
    throw new Error(
      e.code === 3
        ? "Transcribing audio needs macOS 26 or later. If it has a transcript, copy it and paste it here instead."
        : e.code === 4
          ? `Your Mac can’t transcribe speech in this language (${language}) yet. If it has a transcript, copy it and paste it here instead.`
          : `Couldn’t transcribe the audio (${e.message.split("\n").pop()}). If it has a transcript, copy it and paste it here instead.`,
    );
  });
  if (!/-->/.test(vtt)) throw new Error("Heard no speech in that audio. If it has a transcript, copy it and paste it here instead.");
  return vtt;
}

export interface Episode {
  audio: string;
  title?: string;
  show?: string;
  published?: string;
}

const APPLE = /^https?:\/\/podcasts\.apple\.com\/.*\/id(\d+)\b.*[?&]i=(\d+)/;
const SPOTIFY = /^https?:\/\/open\.spotify\.com\/episode\//;

/** An episode link's audio file and what the page says about it: Apple Podcasts through Apple's
 *  lookup, other players (Overcast, Pocket Casts, a show's own page) through the audio the page links. */
export async function episode(url: string, fetcher: typeof fetch = fetch): Promise<Episode> {
  if (SPOTIFY.test(url)) throw new Error("Spotify keeps its episodes locked, so Ore can’t hear this one. Find the episode on Apple Podcasts or the show’s site and add that link instead.");
  const apple = url.match(APPLE);
  if (apple) {
    // Apple's lookup finds episodes by their show (the path's id), not by the episode's own id.
    const res = await fetcher(`https://itunes.apple.com/lookup?id=${apple[1]}&entity=podcastEpisode&limit=200`).catch(() => null);
    const hit = res?.ok ? ((await res.json()) as { results?: Record<string, string>[] }).results?.find((r) => String(r.trackId) === apple[2] && r.episodeUrl) : undefined;
    if (!hit) throw new Error("Couldn’t find that episode’s audio on Apple Podcasts (it may be older than the show’s last 200). Add the episode from the show’s own site instead.");
    return { audio: hit.episodeUrl!, title: hit.trackName, show: hit.collectionName, published: hit.releaseDate };
  }
  const res = await fetcher(url, { headers: { "user-agent": "Mozilla/5.0 (Macintosh)" } }).catch(() => null);
  const html = res?.ok ? await res.text() : "";
  // Either attribute order: pages write `content` before `property` as often as after it.
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];
  const meta = (p: string) => tags.map((t) => ((attr(t, "property") ?? attr(t, "name"))?.toLowerCase() === p ? attr(t, "content") : undefined)).find(Boolean);
  const audio = meta("og:audio") ?? meta("og:audio:url") ?? html.match(/<(?:audio|source)[^>]+src=["']([^"']+\.(?:mp3|m4a)[^"']*)["']/i)?.[1];
  if (!audio) throw new Error("Couldn’t find the episode’s audio on that page. Add the Apple Podcasts link to the episode, or its audio file, instead.");
  return { audio: new URL(audio.replace(/&amp;/g, "&"), url).href, title: meta("og:title"), show: meta("og:site_name") };
}
