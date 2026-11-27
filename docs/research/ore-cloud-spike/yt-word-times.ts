const id = process.argv[2]!;
const r = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": "com.google.ios.youtube/21.26.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)" }, body: JSON.stringify({ context: { client: { hl: "en", gl: "US", clientName: "IOS", clientVersion: "21.26.4", deviceMake: "Apple", deviceModel: "iPhone16,2", osName: "iPhone", osVersion: "18.3.2.22D82" } }, videoId: id }) });
const p: any = await r.json();
console.log(p.playabilityStatus?.status, p.playabilityStatus?.reason);
const t = p.captions?.playerCaptionsTracklistRenderer?.captionTracks?.find((t: any) => t.kind === "asr");
if (!t) process.exit();
console.log(t.baseUrl.replace(/signature=[^&]+/, "signature=…"));
for (const fmt of ["json3", "srv3"]) { const u = new URL(t.baseUrl); u.searchParams.set("fmt", fmt); const b = await (await fetch(u)).text(); console.log(fmt, b.length, b.slice(0, 300).replace(/\s+/g, " ")); }
