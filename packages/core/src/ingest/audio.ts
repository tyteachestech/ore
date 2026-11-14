import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { release, tmpdir } from "node:os";
import { join } from "node:path";
import { madeThisRun } from "../cancel.ts";
import { cleanDate } from "./check.ts";
import { run, swiftHelper } from "./swift.ts";

// Audio and podcast episodes (D96 phase 3): transcribed on the Mac with Apple's on-device speech
// recognition, into the same timed transcript a video or subtitle file gives.

/** Audio file types the Mac transcribes. */
export const AUDIO_TYPES = ["mp3", "m4a", "wav", "aac", "aiff", "flac"];
/** Video files the Mac transcribes from their sound (lecture recordings, Zoom, downloaded courses). */
export const VIDEO_TYPES = ["mp4", "mov", "m4v"];

type Progress = (done: number, label?: string) => void;

type Hear = (data: Uint8Array, ext: string, onProgress?: Progress, language?: string) => Promise<string>;
let device: Hear | null = null;
/** A device that hears through its own shell instead of the Mac's helper: the iPhone app, whose shell
 *  runs Apple's on-device speech (apps/desktop/src/phone/core.ts). It gives WebVTT, or throws why not
 *  in its own words. */
export function setTranscriber(hear: Hear | null): void {
  device = hear;
}

/** The audio as WebVTT. `onProgress` gets 0..1 as it goes, and a line to show while the speech model
 *  downloads the first time. */
export async function transcribe(data: Uint8Array, ext: string, onProgress?: Progress, language?: string): Promise<string> {
  if (device) {
    const vtt = await device(data, ext, onProgress, language);
    if (!/-->/.test(vtt)) throw new Error("Heard no speech in that audio. If it has a transcript, copy it and paste it here instead.");
    return vtt;
  }
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

/** Whether this machine can hear speech at all, before anything downloads: the stand-in transcriber
 *  (ORE_TRANSCRIBE; set empty, none), a device's own shell (`setTranscriber`), else macOS 26 or later (Darwin 25), where Apple's SpeechAnalyzer
 *  is. Whether it has a model for the speech's language is only known by trying. */
export function canTranscribe(): boolean {
  if (device) return true;
  const stand = process.env.ORE_TRANSCRIBE;
  if (stand !== undefined) return stand !== "";
  return process.platform === "darwin" && Number(release().split(".")[0]) >= 25;
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
  /** The speech's language as its feed or episode names it ("es-419"), so it is heard in it. */
  language?: string;
  /** The episode's or show's own picture, where the directory or page names one. */
  artwork?: string;
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
    // The show's own feed names the language it speaks.
    const feed = results.find((r) => r.feedUrl)?.feedUrl;
    if (!hit) return older(url, results.find((r) => r.feedUrl), fetcher);
    return { audio: hit.episodeUrl!, title: hit.trackName, show: hit.collectionName, published: hit.releaseDate, artwork: hit.artworkUrl600 ?? hit.artworkUrl160, language: feed ? await showLanguage(feed, fetcher) : undefined };
  }
  const res = await fetcher(url, { headers: { "user-agent": "Mozilla/5.0 (Macintosh)" } }).catch(() => null);
  const html = res?.ok ? await res.text() : "";
  const meta = metaOf(html);
  const audio = pageAudio(html, url, true);
  if (!audio) throw new Error("Couldn’t find the episode’s audio on that page. Add the Apple Podcasts link to the episode, or its audio file, instead.");
  return { audio, title: meta("og:title"), show: meta("og:site_name"), published: cleanDate(meta("article:published_time")), artwork: meta("og:image"), language: pageAudioLanguage(html) };
}

/** An Apple Podcasts episode the lookup no longer lists (it gives a show's newest 200; a daily show
 *  passes that in a year): Apple's page names the episode and its day, and the show's public feed, which
 *  keeps every episode, has its audio (F62). */
async function older(url: string, show: Record<string, string> | undefined, fetcher: typeof fetch): Promise<Episode> {
  const gone = "Couldn’t find that episode’s audio on Apple Podcasts. Add the episode from the show’s own site instead.";
  if (!show?.feedUrl) throw new Error(gone);
  const res = await fetcher(url, { headers: { "user-agent": "Mozilla/5.0 (Macintosh)" } }).catch(() => null);
  const html = res?.ok ? await res.text() : "";
  // Only the episode's own page: a link Apple no longer knows answers with the show's.
  let ld: { "@type"?: string; name?: string; datePublished?: string } = {};
  try {
    ld = JSON.parse(html.match(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/i)?.[1] ?? "{}");
  } catch {}
  const title = ld["@type"] === "PodcastEpisode" ? ld.name : undefined;
  if (!title) throw new Error(gone);
  const found = await inFeed(show.feedUrl, title, ld.datePublished, fetcher);
  if (!found.audio) throw new Error(`Couldn’t find “${title}” in ${show.collectionName ?? "the show"}’s feed. Add the episode from the show’s own site instead.`);
  return { audio: found.audio, title, show: show.collectionName, published: ld.datePublished, artwork: show.artworkUrl600 ?? show.artworkUrl160, language: found.language };
}

/** An episode's audio in its show's public feed: the item with that title, or the only one of that day
 *  when the title was edited since. */
async function inFeed(feed: string, title: string, published: string | undefined, fetcher: typeof fetch): Promise<{ audio?: string; language?: string }> {
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
  return { audio: hit?.audio && decodeXml(hit.audio), language: feedLanguage(xml) };
}

/** A page's `<meta>` values by property or name, in either attribute order: pages write `content`
 *  before `property` as often as after it. */
function metaOf(html: string): (p: string) => string | undefined {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];
  return (p) => tags.map((t) => ((attr(t, "property") ?? attr(t, "name"))?.toLowerCase() === p ? attr(t, "content") : undefined)).find(Boolean);
}

/** An audio file by its address: the types the Mac hears (AUDIO_TYPES), never a video. A player's own
 *  page (Overcast, Pocket Casts) may name the type mid-path (`/ep13.mp3/stream`). */
const AUDIO_FILE = new RegExp(`\\.(?:${AUDIO_TYPES.join("|")})(?:[?#]|$)`, "i");
const AUDIO_ANYWHERE = new RegExp(`\\.(?:${AUDIO_TYPES.join("|")})(?:[/?#]|$)`, "i");
/** An address with a part after `/podcast/`, `/podcasts/`, `/episode/` or `/episodes/`: one episode's
 *  page, not the show's index (`/podcasts/`). */
const EPISODE_PATH = /\/(?:podcasts?|episodes?)\/[^/]+/i;
/** A Megaphone episode id (SAM9228418236): letters, then digits. A playlist or show path is not one. */
const MEGAPHONE_ID = /^[A-Z]{2,}\d{6,}$/;

/** The audio a web page is the episode of, or undefined when the page is only an article (D92,
 *  D122, D167). The page is an episode when its JSON-LD's page-level node (or one in its @graph) is a
 *  PodcastEpisode or RadioEpisode whose media is audio, or its `og:type` says episode and `og:audio`
 *  names the file; otherwise only when it plays exactly one audio (its `og:audio`, an `<audio>` file,
 *  or a Megaphone episode player, whose enclosure is its id's MP3) and its address names one episode.
 *  So a news story that plays a clip, or offers a read-aloud of itself (a bare `og:audio`, an
 *  AudioObject beside its Article), stays the article, as does a show's index with a featured player.
 *  One file counts once (see `add`). `player` is an episode link's own page (Overcast, Pocket Casts):
 *  any audio it plays is the episode, at any address, its first one if it plays several. */
export function pageAudio(html: string, url: string, player = false): string | undefined {
  const abs = (u: string | undefined) => {
    try {
      return u ? new URL(u.replace(/&amp;/g, "&"), url).href : undefined;
    } catch {
      return undefined;
    }
  };
  const meta = metaOf(html);
  const og = abs(meta("og:audio") ?? meta("og:audio:url") ?? meta("og:audio:secure_url"));
  const declared = ldEpisodeAudio(html)?.audio ?? (og && /episode/i.test(meta("og:type") ?? "") && AUDIO_FILE.test(og) ? og : undefined);
  if (declared) return abs(declared);
  // A player's own og:audio is its episode, whatever its address looks like (as before D215).
  if (player && og) return og;
  if (!player && !EPISODE_PATH.test(new URL(url).pathname)) return undefined;
  const isAudio = (u: string) => (player ? AUDIO_ANYWHERE : AUDIO_FILE).test(new URL(u).pathname);
  // One episode under two addresses counts once: the same file in another format or under another
  // query string, or behind a redirector (`…/redirect.mp3/traffic.megaphone.fm/ID.mp3`), is known by
  // its own name, the last part of its address without the type.
  const found = new Map<string, string>();
  const add = (u: string | undefined) => {
    if (!u || !isAudio(u)) return;
    const key = (new URL(u).pathname.split("/").filter(Boolean).pop() ?? u).replace(/\.\w+$/, "").toLowerCase();
    if (!found.has(key)) found.set(key, u);
  };
  add(og);
  const src = (tag: string) => tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1];
  for (const m of html.matchAll(/<audio\b([^>]*)>([\s\S]*?)<\/audio>/gi)) {
    // One player: its own file, else the first of its sources the Mac hears.
    const own = abs(src(m[1]!));
    add(own && isAudio(own) ? own : (m[2]!.match(/<source\b[^>]*>/gi) ?? []).map((t) => abs(src(t))).find((u) => u && isAudio(u)));
  }
  // A player's page may hold its file in a bare <source>, outside an <audio>.
  if (player) for (const m of html.matchAll(/<source\b[^>]*>/gi)) add(abs(src(m[0])));
  for (const m of html.matchAll(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    const u = abs(m[1]!);
    if (!u || !/^(?:playlist|player)\.megaphone\.fm$/.test(new URL(u).host)) continue;
    const id = new URL(u).searchParams.get("e") ?? new URL(u).pathname.split("/").filter(Boolean).join("/");
    if (MEGAPHONE_ID.test(id)) add(`https://traffic.megaphone.fm/${id}.mp3`);
  }
  if (player) return [...found.values()][0];
  return found.size === 1 ? [...found.values()][0] : undefined;
}

/** The spoken language of the episode whose audio pageAudio chooses. A site's UI language is not
 *  evidence of what its recording speaks; only the episode's own inLanguage is used. */
export function pageAudioLanguage(html: string): string | undefined {
  return ldEpisodeAudio(html)?.language;
}

/** The audio a page's JSON-LD names as the page's own: a page-level (or @graph) PodcastEpisode's or
 *  RadioEpisode's `associatedMedia` or `audio`, when it is audio by its address or `encodingFormat`,
 *  and the spoken language declared on that same episode. */
function ldEpisodeAudio(html: string): Pick<Episode, "audio" | "language"> | undefined {
  const media = (v: unknown): string | undefined =>
    [v].flat().flatMap((m) => {
      const o = m && typeof m === "object" ? (m as Record<string, unknown>) : {};
      const u = typeof o.contentUrl === "string" ? o.contentUrl : undefined;
      return u && (AUDIO_FILE.test(u) || /^audio\//i.test(String(o.encodingFormat ?? ""))) ? [u] : [];
    })[0];
  for (const m of html.matchAll(/<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1]!);
    } catch {
      continue;
    }
    const nodes = [data].flat().flatMap((n) => (n && typeof n === "object" ? [n, ...[(n as Record<string, unknown>)["@graph"] ?? []].flat()] : [])) as Record<string, unknown>[];
    for (const n of nodes) {
      if (!n || typeof n !== "object" || ![n["@type"]].flat().some((t) => /^(?:PodcastEpisode|RadioEpisode)$/.test(String(t)))) continue;
      const u = media(n.associatedMedia) ?? media(n.audio);
      if (u) return { audio: u, language: languageTag(typeof n.inLanguage === "string" ? n.inLanguage : undefined) };
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
  const found = await inFeed(feed, title, published, fetcher);
  if (!found.audio) throw new Error(`Couldn’t find “${title}” in ${show}’s public feed: it may be only on Spotify. Find the episode on Apple Podcasts or the show’s site and add that link instead.`);
  return { audio: found.audio, title, show, published, language: found.language };
}
