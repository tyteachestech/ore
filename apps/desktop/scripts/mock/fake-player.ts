// A stand-in for the app's YouTube relay page (src-tauri/src/player.html), so playback and the
// following transcript can be driven in a plain browser: it speaks the embed's postMessage protocol
// with a clock and no picture. Run `bun apps/desktop/scripts/mock/fake-player.ts` (:1422, PORT= for
// another) and set `window.__ORE_PLAYER_PORT = 1422` in an init script before tauri.js.
const page = `<!doctype html><body style="margin:0;background:#111;color:#888;font:13px sans-serif;display:grid;place-items:center;height:100vh">fake player
<script>
let t = 0, state = -1, rate = 1, last = performance.now();
const send = (m) => parent.postMessage(JSON.stringify(m), "*");
const info = () => send({ event: "infoDelivery", info: { currentTime: t, duration: 170, playerState: state, playbackRate: rate } });
setInterval(() => { const now = performance.now(); if (state === 1) t = Math.min(170, t + ((now - last) / 1000) * rate); last = now; if (state !== -1) info(); }, 250);
addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.event === "listening") { if (state === -1) { state = 5; send({ event: "onReady" }); info(); } return; }
  if (m.func === "playVideo") { state = 1; send({ event: "onStateChange", info: 1 }); }
  if (m.func === "pauseVideo") { state = 2; send({ event: "onStateChange", info: 2 }); }
  if (m.func === "seekTo") t = m.args[0];
  if (m.func === "setPlaybackRate") rate = m.args[0];
  info();
});
</script>`;
Bun.serve({ port: Number(process.env.PORT) || 1422, fetch: () => new Response(page, { headers: { "content-type": "text/html" } }) });
console.log(`fake player on :${Number(process.env.PORT) || 1422}`);
