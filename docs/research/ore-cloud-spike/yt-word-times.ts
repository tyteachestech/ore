// Spike for #546: which client's auto-caption track carries per-word times (yt-dlp's does)?
// `bun yt-word-times.ts <videoId>`; run from a home connection.
const id = process.argv[2]!;
const C: Record<string, any> = {
  ios: { clientName: "IOS", clientVersion: "21.26.4", deviceMake: "Apple", deviceModel: "iPhone16,2", osName: "iPhone", osVersion: "18.3.2.22D82", userAgent: "com.google.ios.youtube/21.26.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)" },
  android: { clientName: "ANDROID", clientVersion: "21.26.364", androidSdkVersion: 30, osName: "Android", osVersion: "11", userAgent: "com.google.android.youtube/21.26.364 (Linux; U; Android 11) gzip" },
  visionos: { clientName: "VISIONOS", clientVersion: "1.02", deviceMake: "Apple", deviceModel: "RealityDevice17,1", osName: "visionOS", osVersion: "26.5.23O471", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15" },
  tv_samsung: { clientName: "TVHTML5", clientVersion: "5.20260707", deviceMake: "Samsung", deviceModel: "UKS9800", osName: "Tizen", osVersion: "2.4.0", userAgent: "Mozilla/5.0 (SMART-TV; Linux; Tizen 2.4.0) AppleWebKit/538.1 (KHTML, like Gecko) Version/2.4.0 TV Safari/538.1" },
};
for (const [name, client] of Object.entries(C)) {
  const r = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": client.userAgent }, body: JSON.stringify({ context: { client: { hl: "en", gl: "US", ...client } }, videoId: id, contentCheckOk: true, racyCheckOk: true }) });
  const p: any = await r.json().catch(() => ({}));
  const t = p.captions?.playerCaptionsTracklistRenderer?.captionTracks?.find((t: any) => t.kind === "asr");
  const out: any = { id, client: name, playability: p.playabilityStatus?.status, reason: p.playabilityStatus?.reason, asr: !!t };
  if (t) {
    const flags = [...new URL(t.baseUrl, "https://www.youtube.com").searchParams.keys()].filter((k) => k.startsWith("xo") || k === "exp" || k === "pot").join(",");
    out.flags = flags;
    for (const drop of [[], ["xosf"], ["xosf", "xowf", "xowatf"]]) {
      const u = new URL(t.baseUrl, "https://www.youtube.com");
      u.searchParams.set("fmt", "vtt");
      for (const k of drop) u.searchParams.delete(k);
      const b = await (await fetch(u, { headers: { "User-Agent": client.userAgent } })).text();
      out[`drop[${drop.join("+")}]`] = { bytes: b.length, wordTimes: (b.match(/<\d\d:\d\d:\d\d\.\d{3}><c>/g) ?? []).length };
    }
  }
  console.log(JSON.stringify(out));
}
