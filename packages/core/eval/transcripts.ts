// Transcript eval: how close each way of getting a transcript comes to one written by people, on the
// videos and podcast episodes in transcript-cases.json. Run by hand on the Mac (`bun run eval:transcripts`):
// it needs yt-dlp for videos and macOS 26 for speech recognition, downloads audio, and reads live sites.
//
// The key is the human transcript: a video's own captions written by people, a podcast's published
// transcript. The ways scored against it:
//   auto   YouTube's automatic captions, read with yt-dlp: what a video with no human captions imports as today
//   page   captions found from the video's own page with a plain fetch, no yt-dlp: what an iPhone could do
//   heard  Apple's on-device speech recognition on the sound: the Mac's `listen` today, the iPhone's later
// Flags: --only <id> (repeatable), --kind youtube|podcast, --method auto,page,heard, --keep <dir> (saves
// each transcript as words, one file per case and way, to read what differed).
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { z } from "zod";
import { transcribeFile } from "../src/ingest/audio.ts";
import { htmlToDoc } from "../src/ingest/web.ts";
import { captions, srtToVtt, vttWords, youtubeId, ytDlp } from "../src/ingest/youtube.ts";

const METHODS = ["auto", "page", "heard"] as const;
type Method = (typeof METHODS)[number];

const Case = z.strictObject({
  id: z.string(),
  kind: z.enum(["youtube", "podcast"]),
  /** What this one adds to the set: the speaker, the sound, the vocabulary, the length. */
  why: z.string().min(1),
  /** The speech's language, as YouTube names a caption track ("en", "es"). */
  lang: z.string().default("en"),
  /** youtube: the video's link. */
  url: z.string().optional(),
  /** podcast: its feed and the episode's guid there, so the audio link is read fresh (they change). */
  feed: z.string().optional(),
  guid: z.string().optional(),
  /** podcast: the published transcript (a page, .md, .txt, .vtt or .srt), and optionally the phrases it
   *  starts and ends with, to leave out the page around it, and the speakers' names where the page
   *  writes one before each turn with no colon to tell it from speech. */
  key: z.strictObject({ url: z.string(), from: z.string().optional(), to: z.string().optional(), speakers: z.array(z.string()).optional() }).optional(),
});
export type Case = z.infer<typeof Case>;

export function loadCases(path = join(import.meta.dir, "transcript-cases.json")): Case[] {
  const cases = z.object({ cases: z.array(Case) }).parse(JSON.parse(readFileSync(path, "utf8"))).cases;
  if (new Set(cases.map((c) => c.id)).size !== cases.length) throw new Error("case ids must be unique");
  for (const c of cases) {
    if (c.kind === "youtube" && !c.url) throw new Error(`${c.id}: a youtube case needs url`);
    if (c.kind === "podcast" && !(c.feed && c.guid && c.key)) throw new Error(`${c.id}: a podcast case needs feed, guid and key`);
  }
  return cases;
}

// ---- scoring

/** A transcript as the words to compare: lower case, no punctuation, and none of what isn't speech
 *  (a "[Music]" or "(LAUGHS)" note, a speaker's name before a colon, a time stamp). */
export function words(text: string): string[] {
  return text
    .normalize("NFKC")
    .replace(/!?\[([^\]\n]*)\]\([^)\n]*\)/g, "$1") // a Markdown link keeps its words
    .replace(/\[[^\]\n]{0,60}\]/g, " ")
    .replace(/(?:[A-Z][\w.'’-]*\s+){1,3}(?=\((\d{1,2}:)?\d{1,2}:\d{2}\))/g, " ") // a speaker's name before a time stamp
    .replace(/\(([^)\n]{0,60})\)/g, (m, inner: string) => (/^(\d{1,2}:)?\d{1,2}:\d{2}$/.test(inner) || (/\p{L}/u.test(inner) && inner === inner.toUpperCase()) || /^(music|applause|laughter|laughs|laughing|crosstalk|inaudible|silence)/i.test(inner) ? " " : m))
    .replace(/^[\s>]*(\*\*[^*\n]{1,60}:?\*\*:?|[A-Z][\w.'’ -]{0,40}:)(?=\s)/gm, " ")
    .replace(/\b(\d{1,2}:)?\d{1,2}:\d{2}\b/g, " ")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, " ")
    .split(" ")
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter(Boolean);
}

export interface Score { n: number; sub: number; del: number; ins: number; wer: number }

/** Word error rate of `got` against `key`: the fewest words to swap (sub), add back (del: the key has
 *  them, `got` lost them) or take out (ins: `got` has them, the key doesn't) to turn one into the other,
 *  over the key's length. Ties prefer a swap. */
export function wer(key: string[], got: string[]): Score {
  const m = got.length;
  let cost = new Int32Array(m + 1), del = new Int32Array(m + 1), ins = new Int32Array(m + 1);
  let cost2 = new Int32Array(m + 1), del2 = new Int32Array(m + 1), ins2 = new Int32Array(m + 1);
  for (let j = 0; j <= m; j++) (cost[j] = j), (ins[j] = j);
  for (let i = 1; i <= key.length; i++) {
    cost2[0] = i; del2[0] = i; ins2[0] = 0;
    const k = key[i - 1];
    for (let j = 1; j <= m; j++) {
      const diag = cost[j - 1]! + (k === got[j - 1] ? 0 : 1);
      const up = cost[j]! + 1; // the key's word is missing from `got`
      const left = cost2[j - 1]! + 1; // `got` has a word the key doesn't
      if (diag <= up && diag <= left) (cost2[j] = diag), (del2[j] = del[j - 1]!), (ins2[j] = ins[j - 1]!);
      else if (up <= left) (cost2[j] = up), (del2[j] = del[j]! + 1), (ins2[j] = ins[j]!);
      else (cost2[j] = left), (del2[j] = del2[j - 1]!), (ins2[j] = ins2[j - 1]! + 1);
    }
    [cost, cost2, del, del2, ins, ins2] = [cost2, cost, del2, del, ins2, ins];
  }
  const n = key.length, c = cost[m]!, d = del[m]!, s = ins[m]!;
  return { n, sub: c - d - s, del: d, ins: s, wer: n ? c / n : m ? 1 : 0 };
}

/** A published transcript as plain text, from whatever it is published as. */
export async function keyText(raw: string, url: string, from?: string, to?: string, speakers: string[] = []): Promise<string> {
  const path = new URL(url).pathname.toLowerCase();
  let text: string;
  if (raw.trimStart().startsWith("WEBVTT")) text = vttWords(raw).map((w) => w.w).join(" ");
  else if (path.endsWith(".srt")) text = vttWords(srtToVtt(raw)).map((w) => w.w).join(" ");
  else if (/<html|<!doctype/i.test(raw.slice(0, 2000))) text = (await htmlToDoc(raw, url)).markdown.replace(/^#+ .*$/gm, "").replace(/^(?:[A-Z][\w.'’-]*\s?){1,4}$/gm, ""); // headings, and a speaker's name on its own line
  else text = raw;
  const a = from ? text.indexOf(from) : 0;
  if (a < 0) throw new Error(`the transcript no longer has its opening phrase “${from}”: check ${url}`);
  const b = to ? text.indexOf(to, a) : -1;
  if (to && b < 0) throw new Error(`the transcript no longer has its closing phrase “${to}”: check ${url}`);
  const cut = text.slice(a, to ? b + to.length : undefined);
  return speakers.reduce((t, name) => t.replaceAll(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s`, "gm"), ""), cut);
}

// ---- getting the transcripts

type Track = { ext: string; url: string };
type Info = { title: string; duration?: number; webpage_url?: string; subtitles?: Record<string, Track[]>; automatic_captions?: Record<string, Track[]> };

async function ytdlp(args: string[]): Promise<string> {
  const bin = ytDlp();
  if (!bin) throw new Error("needs yt-dlp (`brew install yt-dlp`)");
  const proc = Bun.spawn([bin, "--no-warnings", "--no-playlist", ...args], { stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  if (code !== 0) throw new Error(err.trim().split("\n").pop() ?? "yt-dlp failed");
  return out;
}

const vttOf = (tracks: Track[] | undefined) => tracks?.find((t) => t.ext === "vtt");
/** The human captions in `lang` ("en", "en-GB", "es-419", "en-qlPKC2UN_YU"…), then the automatic ones. */
export function pickTracks(info: Pick<Info, "subtitles" | "automatic_captions">, lang: string): { human?: Track; auto?: Track } {
  const manual = info.subtitles ?? {}, auto = info.automatic_captions ?? {};
  const keys = Object.keys(manual);
  // Exact, then a region ("en-GB"), then a track named by its uploader's id ("en-qlPKC2UN_YU").
  const key = keys.find((k) => k === lang) ?? keys.find((k) => new RegExp(`^${lang}-[A-Za-z0-9]{2,4}$`).test(k)) ?? keys.find((k) => k.startsWith(lang + "-"));
  return { human: key ? vttOf(manual[key]) : undefined, auto: vttOf(auto[`${lang}-orig`]) ?? vttOf(auto[lang]) };
}

const text = async (url: string) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${new URL(url).host}`);
  return r.text();
};
const vttText = (vtt: string) => vttWords(vtt).map((w) => w.w).join(" ");
/** A caption track's words: a VTT file, or an HLS playlist of VTT pieces (some automatic tracks). */
const trackText = async (url: string) => vttText(await captions(await text(url), url));

/** The caption tracks a video's own page lists, read with one plain request and no yt-dlp. */
export function pageTracks(html: string): { url: string; lang: string; auto: boolean }[] {
  const at = html.indexOf('"captionTracks":');
  if (at < 0) return [];
  const start = html.indexOf("[", at);
  let depth = 0, inStr = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (ch === "\\") i++;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "[") depth++;
    else if (ch === "]" && --depth === 0) {
      const list = JSON.parse(html.slice(start, i + 1)) as { baseUrl: string; languageCode: string; kind?: string }[];
      return list.map((t) => ({ url: t.baseUrl, lang: t.languageCode, auto: t.kind === "asr" }));
    }
  }
  return [];
}

async function pageCaptions(url: string, lang: string): Promise<{ text: string; track: "human" | "auto" }> {
  const html = await text(`https://www.youtube.com/watch?v=${youtubeId(url)}`);
  const tracks = pageTracks(html);
  if (!tracks.length) throw new Error(/consent\.youtube|Sign in to confirm/.test(html) ? "the page asked to sign in or consent" : "the page lists no captions");
  const fits = (t: { lang: string }) => t.lang === lang || t.lang.startsWith(lang + "-");
  const t = tracks.find((t) => fits(t) && !t.auto) ?? tracks.find((t) => fits(t));
  if (!t) throw new Error(`no ${lang} captions on the page (it has ${tracks.map((t) => t.lang).join(", ")})`);
  const res = await fetch(t.url + (t.url.includes("fmt=") ? "" : "&fmt=vtt"), { signal: AbortSignal.timeout(60000) });
  const vtt = await res.text();
  if (!/-->/.test(vtt)) {
    // YouTube marks a link it won't serve without a proof-of-origin token (`pot`, made by its player's
    // script) with exp=xpe, and answers it with an empty page.
    const xpe = new URL(t.url).searchParams.get("exp") === "xpe";
    throw new Error(`the captions link answered HTTP ${res.status} with ${vtt.length ? `no captions (${vtt.length} bytes)` : "an empty body"}${xpe ? "; the link is marked exp=xpe: YouTube wants a proof-of-origin token from its player" : ""}`);
  }
  return { text: vttText(vtt), track: t.auto ? "auto" : "human" };
}

async function download(url: string, dir: string, name: string): Promise<string> {
  const r = await fetch(url, { signal: AbortSignal.timeout(600000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} downloading the audio`);
  const ext = extname(new URL(r.url || url).pathname).toLowerCase() || ".mp3";
  const file = join(dir, name + ext);
  writeFileSync(file, new Uint8Array(await r.arrayBuffer()));
  return file;
}

/** The episode's audio link in its feed, by guid. */
export function enclosure(feed: string, guid: string): string | undefined {
  for (const item of feed.split(/<item[\s>]/).slice(1)) {
    const g = item.match(/<guid[^>]*>\s*(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?\s*<\/guid>/)?.[1]?.trim();
    if (g === guid) return item.match(/<enclosure[^>]*\burl="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
  }
  return undefined;
}

// ---- the run

interface Row { id: string; kind: Case["kind"]; method: Method; n?: number; wer?: number; sub?: number; del?: number; ins?: number; seconds?: number; note?: string; error?: string }

async function runCase(c: Case, methods: Method[], keep: string | undefined, dir: string): Promise<Row[]> {
  const rows: Row[] = [];
  const save = (name: string, w: string[]) => keep && writeFileSync(join(keep, `${c.id}.${name}.txt`), w.join(" ") + "\n");
  const score = async (method: Method, key: string[], get: () => Promise<{ text: string; note?: string }>) => {
    const t0 = performance.now();
    try {
      const got = await get();
      const seconds = (performance.now() - t0) / 1000;
      const w = words(got.text);
      save(method, w);
      rows.push({ id: c.id, kind: c.kind, method, ...wer(key, w), seconds, note: got.note });
    } catch (e) {
      rows.push({ id: c.id, kind: c.kind, method, error: (e as Error).message });
    }
  };
  try {
    if (c.kind === "youtube") {
      const info = JSON.parse(await ytdlp(["-J", "--skip-download", c.url!])) as Info;
      const { human, auto } = pickTracks(info, c.lang);
      if (!human) throw new Error(`no human ${c.lang} captions, so nothing to score against: replace this case`);
      const key = words(await trackText(human.url));
      save("key", key);
      if (methods.includes("auto")) await score("auto", key, async () => {
        if (!auto) throw new Error("no automatic captions");
        return { text: await trackText(auto.url) };
      });
      if (methods.includes("page")) await score("page", key, async () => {
        const got = await pageCaptions(c.url!, c.lang);
        return { text: got.text, note: `${got.track} captions` };
      });
      if (methods.includes("heard")) await score("heard", key, async () => {
        await ytdlp(["-f", "ba[ext=m4a]/b[ext=mp4]/ba/b", "-o", join(dir, `${c.id}.%(ext)s`), c.url!]);
        const file = readdirSync(dir).find((f) => f.startsWith(c.id + ".") && !f.endsWith(".part"));
        if (!file) throw new Error("the sound didn't download");
        const t0 = performance.now();
        const vtt = await transcribeFile(join(dir, file), undefined, c.lang);
        return { text: vttText(vtt), note: `speech took ${Math.round((performance.now() - t0) / 1000)} s${info.duration ? ` for ${Math.round(info.duration / 60)} min` : ""}` };
      });
    } else {
      const key = words(await keyText(await text(c.key!.url), c.key!.url, c.key!.from, c.key!.to, c.key!.speakers));
      save("key", key);
      if (methods.includes("heard")) await score("heard", key, async () => {
        const audio = enclosure(await text(c.feed!), c.guid!);
        if (!audio) throw new Error("the episode is no longer in its feed: replace this case");
        const file = await download(audio, dir, c.id);
        const t0 = performance.now();
        const vtt = await transcribeFile(file, undefined, c.lang);
        return { text: vttText(vtt), note: `speech took ${Math.round((performance.now() - t0) / 1000)} s` };
      });
    }
  } catch (e) {
    // The whole case failed (no key to score against): one row for each way it would have run.
    for (const method of c.kind === "podcast" ? methods.filter((m) => m === "heard") : methods) rows.push({ id: c.id, kind: c.kind, method, error: (e as Error).message });
  }
  return rows;
}

const pct = (x: number | undefined) => (x === undefined ? "" : `${(x * 100).toFixed(1)}%`);

if (import.meta.main) {
  const args = process.argv.slice(2);
  const all = (flag: string) => args.flatMap((a, i) => (a === flag && args[i + 1] ? [args[i + 1]!] : []));
  const only = all("--only"), kind = all("--kind")[0], keep = all("--keep")[0];
  const methods = (all("--method")[0]?.split(",") ?? [...METHODS]).filter((m): m is Method => (METHODS as readonly string[]).includes(m));
  if (!methods.length) throw new Error(`--method takes ${METHODS.join(", ")}`);
  const cases = loadCases().filter((c) => (!only.length || only.includes(c.id)) && (!kind || c.kind === kind));
  if (keep) mkdirSync(keep, { recursive: true });
  const dir = mkdtempSync(join(tmpdir(), "ore-eval-transcripts-"));
  const rows: Row[] = [];
  try {
    for (const c of cases) {
      console.error(`${c.id}…`);
      const got = await runCase(c, methods, keep, dir);
      rows.push(...got);
      for (const r of got) console.log([r.id.padEnd(22), r.method.padEnd(6), r.error ? `FAILED: ${r.error}` : `WER ${pct(r.wer).padStart(6)}  wrong ${r.sub}  lost ${r.del}  extra ${r.ins}  of ${r.n}  ${r.seconds!.toFixed(0)} s  ${r.note ?? ""}`].join(" "));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  console.log("\nway     kind      scored  failed  median WER  worst");
  for (const k of ["youtube", "podcast"] as const)
    for (const m of methods) {
      const of = rows.filter((r) => r.kind === k && r.method === m);
      if (!of.length) continue;
      const ok = of.filter((r) => r.wer !== undefined).sort((a, b) => a.wer! - b.wer!);
      console.log([m.padEnd(7), k.padEnd(9), String(ok.length).padEnd(7), String(of.length - ok.length).padEnd(7), pct(ok[Math.floor(ok.length / 2)]?.wer).padEnd(11), ok.length ? `${pct(ok.at(-1)!.wer)} ${ok.at(-1)!.id}` : ""].join(" "));
    }
  const out = join(import.meta.dir, "results", `transcripts-${new Date().toISOString().slice(0, 10)}.json`);
  mkdirSync(join(import.meta.dir, "results"), { recursive: true });
  writeFileSync(out, JSON.stringify({ ran: new Date().toISOString(), methods, rows }, null, 2) + "\n");
  console.log(`\nsaved ${out}`);
}
