// Spike for #546: can a video's captions be read with plain fetch (no yt-dlp), and do they match
// what yt-dlp gives the Mac? Run from a home connection: `bun yt-captions.ts [videoId…]`.
// Prints one JSON line per video and method. No dependencies.
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ["kCc8FmEb1nY", "dQw4w9WgXcQ", "Nc4pT10nSaA", "W4Ua6XFfX9w", "ErfnhcEV1O8"];

type T = { baseUrl: string; languageCode: string; kind?: string; vssId?: string };
const CLIENTS: Record<string, { ua: string; ctx: Record<string, unknown>; id: number }> = {
  ios: { id: 5, ua: "com.google.ios.youtube/21.26.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)", ctx: { clientName: "IOS", clientVersion: "21.26.4", deviceMake: "Apple", deviceModel: "iPhone16,2", osName: "iPhone", osVersion: "18.3.2.22D82" } },
  android: { id: 3, ua: "com.google.android.youtube/21.26.364 (Linux; U; Android 11) gzip", ctx: { clientName: "ANDROID", clientVersion: "21.26.364", androidSdkVersion: 30, osName: "Android", osVersion: "11" } },
  android_vr: { id: 28, ua: "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip", ctx: { clientName: "ANDROID_VR", clientVersion: "1.65.10", deviceMake: "Oculus", deviceModel: "Quest 3", androidSdkVersion: 32, osName: "Android", osVersion: "12L" } },
  web: { id: 1, ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15", ctx: { clientName: "WEB", clientVersion: "2.20260708.00.00" } },
  mweb: { id: 2, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", ctx: { clientName: "MWEB", clientVersion: "2.20260708.05.00" } },
};
const SAFARI = CLIENTS.mweb!.ua;

// Same order as packages/core/src/ingest/youtube.ts pickTrack: English by people, English auto, else the first.
const pick = (ts: T[]) => ts.find((t) => t.kind !== "asr" && t.languageCode.startsWith("en")) ?? ts.find((t) => t.kind === "asr" && t.languageCode === "en") ?? ts[0];
// Ore's own reading of a VTT (its rolling auto captions collapsed), when run inside a checkout.
const ore = await import(`${process.env.ORE ?? process.env.HOME + "/Developer/ore"}/packages/core/src/ingest/youtube.ts`).catch(() => undefined);
const rawWords = (vtt: string) => vtt.split("\n").filter((l) => l && !l.includes("-->") && !/^(WEBVTT|Kind:|Language:|\d+$)/.test(l)).join(" ").replace(/<[^>]+>/g, "").split(/\s+/).filter(Boolean);
const words = (vtt: string): string[] => (ore ? ore.vttWords(vtt).map((w: { w: string }) => w.w) : rawWords(vtt));
function same(a: string[], b: string[]) {
  const n = Math.max(a.length, b.length);
  if (!n) return 1;
  let m = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] === b[i]) m++;
  return Math.round((m / n) * 1000) / 10;
}

async function vttOf(t: T | undefined, ua: string) {
  if (!t) return { status: "no-track" as const };
  const u = new URL(t.baseUrl, "https://www.youtube.com");
  u.searchParams.set("fmt", "vtt");
  const r = await fetch(u, { headers: { "User-Agent": ua } });
  const body = await r.text();
  return { status: r.status, bytes: body.length, lang: t.languageCode, kind: t.kind ?? "manual", pot: u.searchParams.has("pot") || /[?&]exp=xpe/.test(t.baseUrl), vtt: body };
}

async function watchPage(id: string) {
  const r = await fetch(`https://www.youtube.com/watch?v=${id}&hl=en`, { headers: { "User-Agent": SAFARI, "Accept-Language": "en-US,en;q=0.9" } });
  const html = await r.text();
  const m = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var|<\/script)/s);
  if (!m) return { http: r.status, error: /consent|captcha|unusual traffic/i.test(html) ? "blocked-or-consent" : "no-player-json" };
  const p = JSON.parse(m[1]!);
  return { http: r.status, playability: p.playabilityStatus?.status, tracks: (p.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []) as T[], ua: SAFARI };
}

async function innertube(id: string, name: string) {
  const c = CLIENTS[name]!;
  const r = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": c.ua, "X-YouTube-Client-Name": String(c.id), "X-YouTube-Client-Version": String(c.ctx.clientVersion) },
    body: JSON.stringify({ context: { client: { hl: "en", gl: "US", ...c.ctx } }, videoId: id, contentCheckOk: true, racyCheckOk: true }),
  });
  const p = (await r.json().catch(() => ({}))) as any;
  return { http: r.status, playability: p.playabilityStatus?.status, reason: p.playabilityStatus?.reason, tracks: (p.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []) as T[], ua: c.ua };
}

async function ytdlp(id: string) {
  const bin = Bun.which("yt-dlp");
  if (!bin) return undefined;
  const p = Bun.spawn([bin, "-J", "--skip-download", "--no-warnings", "--no-playlist", `https://www.youtube.com/watch?v=${id}`], { stdout: "pipe", stderr: "pipe" });
  const out = await new Response(p.stdout).text();
  if ((await p.exited) !== 0) return undefined;
  const info = JSON.parse(out);
  const manual = info.subtitles ?? {}, auto = info.automatic_captions ?? {};
  const key = Object.keys(manual).find((k) => k.startsWith("en")) ;
  const tracks = (key ? manual[key] : auto["en-orig"] ?? auto["en"] ?? (Object.values(manual)[0] as any)) ?? [];
  const t = tracks.find((x: any) => x.ext === "vtt");
  if (!t) return { vtt: "" };
  const r = await fetch(t.url);
  return { vtt: await r.text(), status: r.status };
}

const ver = Bun.which("yt-dlp") ? (await new Response(Bun.spawn(["yt-dlp", "--version"], { stdout: "pipe" }).stdout).text()).trim() : "none";
console.log(JSON.stringify({ ytdlp: ver, when: new Date().toISOString() }));
for (const id of ids) {
  const ref = await ytdlp(id);
  const refWords = ref ? words(ref.vtt) : [];
  const methods: [string, () => Promise<any>][] = [["watch-page", () => watchPage(id)], ...Object.keys(CLIENTS).map((n) => [`innertube-${n}`, () => innertube(id, n)] as [string, () => Promise<any>])];
  for (const [name, run] of methods) {
    const t0 = performance.now();
    try {
      const got = await run();
      const v = got.tracks ? await vttOf(pick(got.tracks), got.ua) : { status: "none" };
      const w = "vtt" in v && v.vtt ? words(v.vtt) : [];
      console.log(JSON.stringify({ id, method: name, http: got.http, playability: got.playability, reason: got.reason, error: got.error, tracks: got.tracks?.length, capStatus: v.status, bytes: (v as any).bytes, lang: (v as any).lang, kind: (v as any).kind, words: w.length, ytdlpWords: refWords.length, sameAsYtdlp: ref ? same(w, refWords) : null, identical: ref ? (v as any).vtt === ref.vtt : null, sameBody: ref && ore && (v as any).vtt ? ore.vttToBody((v as any).vtt) === ore.vttToBody(ref.vtt) : null, head: process.env.HEAD && (v as any).vtt ? (v as any).vtt.slice(0, 400) : undefined, refHead: process.env.HEAD && ref ? ref.vtt.slice(0, 400) : undefined, ms: Math.round(performance.now() - t0) }));
    } catch (e) {
      console.log(JSON.stringify({ id, method: name, error: String(e) }));
    }
  }
}
