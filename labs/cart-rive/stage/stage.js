// A stand-in for Ore's end screen, to play the Rive cart ending on: the page owns the ring, the gem places, the
// results, Done and the mole's line; the Rive file owns the cart, the ore in flight and the mole. Rive tells the
// page when a piece lands (land, stoneLand), when the mole hits and leaves his hole (knock) and when he speaks.
//
//   index.html                 plays cart-ending.riv with Rive's web runtime (needs the published .riv beside it)
//   index.html?film=film/      plays captures from Rive's headless renderer instead (film.sh makes them)
//   &ore=12&stones=1           how much the session earned
//   &manual                    nothing plays; a recorder calls cart.seek(seconds)
const q = new URLSearchParams(location.search);
const ORE = +(q.get("ore") ?? 12), STONES = +(q.get("stones") ?? 1);
const T = await (await fetch("../rive/timing.json")).json();
const { RING } = T;
const ringDot = (i) => { const a = (i / RING.n) * 2 * Math.PI - Math.PI / 2; return [RING.cx + RING.R * Math.cos(a), RING.cy + RING.R * Math.sin(a)]; };
const gemPlace = (j) => [RING.cx + (j - (STONES - 1) / 2) * 60, RING.cy];

// What has happened so far, by the time it happened. The page is drawn from this alone, so a live run and a
// frame-by-frame recording look the same.
const seen = { land: [], stoneLand: [], knock: [], speak: [] };
// The file keeps a timeline for every piece it could carry, so it reports 30 landings: the page counts only its own.
const CAP = { land: ORE, stoneLand: STONES };
const fire = (name, t) => { if (seen[name] && seen[name].length < (CAP[name] ?? 9)) seen[name].push(t); };

const ctx = document.getElementById("page").getContext("2d");
function draw(t) {
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ctx.clearRect(0, 0, T.W, T.H);
  // The ring takes the knock: pushed down, then it rings out.
  let dy = 0;
  for (const k of seen.knock) { const s = t - k; if (s >= 0) dy += 5 * Math.exp(-9 * s) * Math.sin(26 * s); }
  for (let i = 0; i < RING.n; i++) {
    const [x, y] = ringDot(i), at = seen.land[i], lit = at !== undefined && t >= at;
    // The knock travels round from the top: dots further from the hole move later and less.
    const far = Math.min(i, RING.n - i) / (RING.n / 2);
    let d = 0;
    for (const k of seen.knock) { const s = t - k - far * 0.09; if (s >= 0) d += (1 - 0.6 * far) * 5 * Math.exp(-9 * s) * Math.sin(26 * s); }
    ctx.fillStyle = lit ? "#5fcf8a" : "#3a3b3e";
    ctx.beginPath(); ctx.arc(x, y + d, RING.r * (lit ? 1 : 0.7), 0, 7); ctx.fill();
  }
  seen.stoneLand.forEach((at, j) => {
    if (t < at) return;
    const [x, y] = gemPlace(j), pop = 1 + 0.5 * Math.exp(-14 * (t - at));
    ctx.fillStyle = "#7aa2f7";
    for (const [gx, gy] of [[0, -2], [-1, -1], [0, -1], [1, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]]) ctx.fillRect(x + (gx - 0.5) * 3.2 * pop, y + dy * 0.4 + (gy - 0.5) * 3.2 * pop, 3.2 * pop, 3.2 * pop);
  });
  document.getElementById("say").classList.toggle("on", seen.speak.some((at) => t >= at));
}

const film = document.getElementById("film"), canvas = document.getElementById("rive");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

if (q.has("film") || reduced) {
  // The same cues Rive's events give, worked out from the timeline.
  const pour = T.pourSeconds[Object.keys(T.pourSeconds).find((b) => ORE <= +b) ?? 30];
  const wake = T.rollIn + pour + T.hang;
  for (let i = 0; i < ORE; i++) fire("land", T.rollIn + i * T.ore.step + T.ore.flight);
  for (let j = 0; j < STONES; j++) fire("stoneLand", T.rollIn + pour + T.stone.first + j * T.stone.step + T.stone.flight);
  fire("knock", wake + T.wake.knock); fire("knock", wake + T.wake.pop);
  fire("speak", wake + T.wake.speak);
  const END = wake + T.wake.total, dir = q.get("film") ?? "film/";
  canvas.remove();
  const seek = (t) => new Promise((done) => {
    const src = `${dir}f${String(Math.min(Math.round(t * 25), Math.round((END + 1) * 25))).padStart(3, "0")}.png`;
    draw(t);
    if (film.getAttribute("src") === src) return done();
    film.onload = film.onerror = () => done(); film.src = src;
  });
  window.cart = { seek, end: END + 1 };
  // Reduce Motion: nothing plays; the screen is simply in its resting state.
  if (reduced) seek(END + 1);
  else if (!q.has("manual")) { const t0 = performance.now(); const tick = () => { const t = (performance.now() - t0) / 1000; seek(Math.min(t, END + 1)); if (t < END + 1) requestAnimationFrame(tick); }; tick(); }
} else {
  film.remove();
  // Rive's web runtime (MIT). canvas-lite is the small build; if it cannot run this file, use @rive-app/canvas.
  await new Promise((ok, no) => { const s = document.createElement("script"); s.src = "https://unpkg.com/@rive-app/canvas-lite@2.40.1"; s.onload = ok; s.onerror = no; document.head.append(s); });
  const { Rive, EventType, Layout, Fit } = window.rive;
  let t0 = 0;
  const now = () => (performance.now() - t0) / 1000;
  const r = new Rive({
    src: "cart-ending.riv", canvas, artboard: "CartEnding", stateMachines: "Cart ending", autoplay: false, autoBind: true,
    layout: new Layout({ fit: Fit.Contain }),
    onLoad() {
      // The page hands every piece its place: how much ore, how many stones, and where each one goes.
      const vm = r.viewModelInstance;
      vm.number("ore").value = ORE; vm.number("stones").value = STONES;
      for (let i = 0; i < Math.min(ORE, 30); i++) { const [x, y] = ringDot(i); vm.number(`ore${i}x`).value = x; vm.number(`ore${i}y`).value = y; }
      for (let j = 0; j < Math.min(STONES, 3); j++) { const [x, y] = gemPlace(j); vm.number(`stone${j}x`).value = x; vm.number(`stone${j}y`).value = y; }
      t0 = performance.now(); r.play();
      const tick = () => { draw(now()); requestAnimationFrame(tick); }; tick();
    },
  });
  r.on(EventType.RiveEvent, (e) => fire(e.data.name, now()));
}
document.getElementById("done").onclick = () => (document.getElementById("done").textContent = "Done ✓");
