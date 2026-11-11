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
export async function transcribe(data: Uint8Array, ext: string, onProgress?: Progress, language?: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "ore-audio-"));
  madeThisRun(dir);
  try {
    const file = join(dir, `audio.${ext}`);
    writeFileSync(file, data);
    return await transcribeFile(file, onProgress, language);
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
          ? `Your Mac can’t transcribe speech in this language${language ? ` (${language})` : ""} yet. If it has a transcript, copy it and paste it here instead.`
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
  /** The speech's language as the show's feed names it ("es-419"), so it is heard in it. */
  language?: string;
}

/** A feed's or page's language tag in its usual spelling ("en-us" → "en-US"); none when it isn't one. */
function languageTag(tag: string | undefined): string | undefined {
  try {
    return tag?.trim() ? Intl.getCanonicalLocales(tag.trim())[0] : undefined;
  } catch {
    return undefined;
  }
}
const feedLanguage = (xml: string) => {
  const tag = xml.match(/<(language|itunes:language)>([\s\S]*?)<\/\1>/i)?.[2];
  return languageTag(tag && decodeXml(tag.trim()));
};

/** The language a show's feed names, read only as far as its channel's own tags: a long-running
 *  show's feed can be many megabytes of episodes. */
async function showLanguage(feed: string, fetcher: typeof fetch): Promise<string | undefined> {
  const res = await fetcher(feed).catch(() => null);
  if (!res?.ok || !res.body) return undefined;
  const reader = res.body.getReader();
  const text = new TextDecoder();
  let head = "";
  while (!/<\/(?:itunes:)?language>|<item\b/i.test(head) && head.length < 1_000_000) {
    const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
    if (done || !value) break;
    head += text.decode(value, { stream: true });
  }
  void reader.cancel().catch(() => {});
  return feedLanguage(head);
}

const APPLE = /^https?:\/\/podcasts\.apple\.com\/.*\/id(\d+)\b.*[?&]i=(\d+)/;
const SPOTIFY = /^https?:\/\/open\.spotify\.com\/episode\//;

/** An episode link's audio file and what the page says about it: Apple Podcasts through Apple's
 *  lookup, other players (Overcast, Pocket Casts, a show's own page) through the audio the page links. */
export async function episode(url: string, fetcher: typeof fetch = fetch): Promise<Episode> {
  if (SPOTIFY.test(url)) return spotify(url, fetcher);
  const apple = url.match(APPLE);
  if (apple) {
    // Apple's lookup finds episodes by their show (the path's id), not by the episode's own id.
    const res = await fetcher(`https://itunes.apple.com/lookup?id=${apple[1]}&entity=podcastEpisode&limit=200`).catch(() => null);
    const results = res?.ok ? (((await res.json()) as { results?: Record<string, string>[] }).results ?? []) : [];
    const hit = results.find((r) => String(r.trackId) === apple[2] && r.episodeUrl);
    if (!hit) throw new Error("Couldn’t find that episode’s audio on Apple Podcasts (it may be older than the show’s last 200). Add the episode from the show’s own site instead.");
    // The show's own feed names the language it speaks.
    const feed = results.find((r) => r.feedUrl)?.feedUrl;
    return { audio: hit.episodeUrl!, title: hit.trackName, show: hit.collectionName, published: hit.releaseDate, language: feed ? await showLanguage(feed, fetcher) : undefined };
  }
  const res = await fetcher(url, { headers: { "user-agent": "Mozilla/5.0 (Macintosh)" } }).catch(() => null);
  const html = res?.ok ? await res.text() : "";
  // Either attribute order: pages write `content` before `property` as often as after it.
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];
  const meta = (p: string) => tags.map((t) => ((attr(t, "property") ?? attr(t, "name"))?.toLowerCase() === p ? attr(t, "content") : undefined)).find(Boolean);
  const audio = pageAudio(html, url, true);
  if (!audio) throw new Error("Couldn’t find the episode’s audio on that page. Add the Apple Podcasts link to the episode, or its audio file, instead.");
  return { audio, title: meta("og:title"), show: meta("og:site_name") };
}

/** An address that says it is an episode: a `/podcast/`, `/podcasts/`, `/episode/` or `/episodes/` part. */
const EPISODE_PATH = /\/(?:podcasts?|episodes?)(?:\/|$)/i;
const AUDIO_FILE = /\.(?:mp3|m4a|aac|wav|flac|aiff)(?:[?#]|$)/i;

/** The audio file a page is the episode of, or undefined when the page is an article (D122, D167).
 *  The rule: a page is an episode when it names one audio as its own, in the page's metadata
 *  (`og:audio`; JSON-LD whose page-level node is a PodcastEpisode or RadioEpisode with its
 *  `associatedMedia` or `audio`, or is itself an AudioObject), or when it plays exactly one audio (an
 *  `<audio>`/`<source>` file, or a Megaphone episode player, whose enclosure is its id's MP3) and its
 *  address says it is an episode. So a news story that plays a clip, or offers a read-aloud of itself
 *  (an Article's AudioObject), stays the article. `player` is an episode link's own page (Overcast,
 *  Pocket Casts): any audio it plays is the episode. */
export function pageAudio(html: string, url: string, player = false): string | undefined {
  const abs = (u: string) => {
    try {
      return new URL(u.replace(/&amp;/g, "&"), url).href;
    } catch {
      return undefined;
    }
  };
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];
  const og = tags.map((t) => (/^og:audio(?::url|:secure_url)?$/i.test(attr(t, "property") ?? attr(t, "name") ?? "") ? attr(t, "content") : undefined)).find(Boolean);
  const declared = og ?? ldAudio(html);
  if (declared) return abs(declared);
  const found = new Set<string>();
  for (const m of html.matchAll(/<(?:audio|source)\b[^>]*\bsrc=["']([^"']+)["']/gi)) if (AUDIO_FILE.test(m[1]!)) found.add(abs(m[1]!) ?? "");
  for (const m of html.matchAll(/<iframe\b[^>]*\bsrc=["'](?:https?:)?\/\/(?:playlist|player)\.megaphone\.fm\/(?:\?(?:[^"']*&(?:amp;)?)?e=)?([A-Z0-9]+)\b/gi)) found.add(`https://traffic.megaphone.fm/${m[1]}.mp3`);
  found.delete("");
  const one = [...found];
  if (player) return one[0];
  return one.length === 1 && EPISODE_PATH.test(new URL(url).pathname) ? one[0] : undefined;
}

/** The audio a page's JSON-LD names as the page: a page-level PodcastEpisode's (or RadioEpisode's)
 *  media, or a page-level AudioObject. Media nested in an Article is a read-aloud, not this. */
function ldAudio(html: string): string | undefined {
  const types = (n: Record<string, unknown>) => [n["@type"]].flat().map(String);
  const media = (v: unknown): string | undefined => [v].flat().map((m) => (m && typeof m === "object" ? (m as Record<string, unknown>).contentUrl : undefined)).find((u): u is string => typeof u === "string");
  for (const m of html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1]!);
    } catch {
      continue;
    }
    const nodes = [data].flat().flatMap((n) => (n && typeof n === "object" ? [n as Record<string, unknown>, ...[(n as Record<string, unknown>)["@graph"] ?? []].flat()] : [])) as Record<string, unknown>[];
    for (const n of nodes) {
      if (!n || typeof n !== "object") continue;
      const t = types(n);
      const u = t.some((x) => /^(?:PodcastEpisode|RadioEpisode)$/.test(x)) ? media(n.associatedMedia) ?? media(n.audio) : t.includes("AudioObject") && typeof n.contentUrl === "string" ? n.contentUrl : undefined;
      if (u) return u;
    }
  }
  return undefined;
}

/** Titles compared as words: case, punctuation and "&" vs "and" aside. */
const words = (s: string) => decodeXml(s).toLowerCase().replace(/&/g, " and ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const decodeXml = (s: string) =>
  s.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/** A Spotify episode, heard from the same episode in its show's public feed (D122): Spotify's page
 *  names the episode and the show, Apple's podcast search finds the show's feed, and the feed's item
 *  with that title (or that day, when the title was edited) links its audio. A show only on Spotify
 *  has no public feed, so it says so. */
async function spotify(url: string, fetcher: typeof fetch): Promise<Episode> {
  const res = await fetcher(url, { headers: { "user-agent": "Mozilla/5.0 (Macintosh)" } }).catch(() => null);
  const html = res?.ok ? await res.text() : "";
  const meta = (p: string) => html.match(new RegExp(`<meta[^>]+(?:property|name)="${p}"[^>]+content="([^"]*)"`, "i"))?.[1];
  const title = meta("og:title") && decodeXml(meta("og:title")!);
  const show = decodeXml(meta("og:description") ?? "").match(/^(.+?)\s+·\s+Episode$/)?.[1];
  const published = meta("music:release_date");
  if (!title || !show) throw new Error("Couldn’t read that Spotify episode’s page. Check the link, or find the episode on Apple Podcasts and add that link instead.");
  const onlySpotify = `“${show}” has no public feed Ore can find, so it may be only on Spotify, which keeps its audio locked. If it has a transcript, copy it and paste it here instead.`;
  const search = await fetcher(`https://itunes.apple.com/search?media=podcast&entity=podcast&limit=10&term=${encodeURIComponent(show)}`).catch(() => null);
  const shows = search?.ok ? (((await search.json()) as { results?: { collectionName?: string; feedUrl?: string }[] }).results ?? []) : [];
  const feed = shows.find((r) => r.feedUrl && words(r.collectionName ?? "") === words(show))?.feedUrl;
  if (!feed) throw new Error(onlySpotify);
  const xml = await (await fetcher(feed).catch(() => null))?.text().catch(() => "") ?? "";
  const items = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/g)].map((m) => ({
    title: decodeXml(m[0].match(/<title\b[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? ""),
    audio: m[0].match(/<enclosure\b[^>]*\burl="([^"]+)"/)?.[1],
    day: (() => {
      const t = Date.parse(m[0].match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] ?? "");
      return Number.isNaN(t) ? undefined : new Date(t).toISOString().slice(0, 10);
    })(),
  }));
  const want = words(title);
  const sameDay = published ? items.filter((i) => i.audio && i.day === published.slice(0, 10)) : [];
  const hit = items.find((i) => i.audio && words(i.title) === want) ?? (sameDay.length === 1 ? sameDay[0] : undefined);
  if (!hit?.audio) throw new Error(`Couldn’t find “${title}” in ${show}’s public feed: it may be only on Spotify. Find the episode on Apple Podcasts or the show’s site and add that link instead.`);
  return { audio: decodeXml(hit.audio), title, show, published, language: feedLanguage(xml) };
}
