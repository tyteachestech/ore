// What every file of journeys in e2e/journeys/ shares: the mock the app runs on, how a page is opened, the rules
// every journey is held to, the helpers more than one file uses, and the run itself. How to run: e2e/journeys.ts.
import { chromium, devices, webkit, type Browser, type Locator, type Page } from "playwright";
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
import { phoneShell, serveShell } from "../scripts/mock/phone-shell";

export const MOCK = join(import.meta.dir, "../scripts/mock");

export const FIXTURES = join(import.meta.dir, "../../../packages/core/test/fixtures/intake/files");

const PORT = Number(process.env.ORE_E2E_PORT ?? 1450);

export const BRIDGE = process.env.E2E_URL ? Number(process.env.E2E_BRIDGE ?? 1421) : Number(process.env.ORE_E2E_MOCK_PORT ?? 1451);

const only = process.argv[2];

const onlyFile = process.env.ORE_E2E_FILE;

const [shard, shards] = (process.env.ORE_E2E_SHARD ?? "1/1").split("/").map(Number) as [number, number];

if (!(Number.isInteger(shard) && Number.isInteger(shards) && shard >= 1 && shard <= shards)) throw new Error(`ORE_E2E_SHARD=${process.env.ORE_E2E_SHARD}: want i/n, as 2/4`);

/** The seeded library the journeys running now change (or, against a mock already running, $ORE_LIBRARY): for
 *  state no `ore` command makes. Each file of journeys gets a fresh one. */
export let LIB = process.env.ORE_LIBRARY ?? "";

/** Where the app answers, once the run has started it. */
export let url = "";

/** A dev server that bundles a dependency late reloads every page it serves, cutting the open journey's `ore`
 *  calls (WebKit: a fetch refused "due to access control checks", F749). It does that when its scan of the
 *  imports fails, so a scan that fails or a reload fails the run, naming what vite said. */
function watchVite(vite: { stdout: ReadableStream<Uint8Array>; stderr: ReadableStream<Uint8Array> }, echo = false) {
  const late = /Failed to run dependency scan|new dependencies optimized|optimized dependencies changed|reloading/i;
  for (const [stream, err] of [[vite.stdout, false], [vite.stderr, true]] as const)
    void (async () => {
      const text = new TextDecoder();
      let rest = "";
      for await (const chunk of stream) {
        const lines = (rest + text.decode(chunk, { stream: true })).split("\n");
        rest = lines.pop() ?? "";
        for (const l of lines) {
          if (late.test(l)) errors.push(`vite: ${l.trim()}`);
          // The phone's server showed its errors (a build that breaks) in the run's log before: it still does.
          else if (echo && err) console.error(l);
        }
      }
    })();
}

/** The app itself (vite), started once for the whole run: it holds no library, the bridge does. */
async function app(): Promise<() => void> {
  if (process.env.E2E_URL) return (url = process.env.E2E_URL), () => {};
  // The ambience radio plays plain tones of its own (e2e/sounds), never the sounds on the Mac (D254).
  const vite = Bun.spawn(["bunx", "vite", "--port", String(PORT), "--strictPort"], { cwd: join(import.meta.dir, ".."), env: { ...process.env, ORE_SOUNDS: join(import.meta.dir, "sounds") }, stdout: "pipe", stderr: "pipe" });
  watchVite(vite);
  url = `http://localhost:${PORT}/`;
  // A cold vite bundles its dependencies before it answers (pdf.js among them, D202), which took over 20 s on a
  // slow runner: the journeys then started against nothing and the first six failed on a refused connection.
  // So wait as long as it takes within reason, and say so when it never comes up.
  let up = false;
  for (const end = Date.now() + 120_000; !up && Date.now() < end; up || (await Bun.sleep(200))) up = await fetch(url).then((r) => r.ok, () => false);
  if (!up) {
    vite.kill();
    throw new Error(`vite did not answer at ${url} within 2 minutes`);
  }
  return () => vite.kill();
}

/** A fresh seeded library and the bridge that answers `ore` for it, for one file of journeys: what a journey leaves
 *  behind reaches only the journeys after it in its own file, so a journey added to one file changes nothing for
 *  another's (F388, F416: with one library per CI part, a new journey moved which journeys ran before which).
 *  Returns what ends it. Against a mock already running (E2E_URL) there is one library and nothing to start. */
async function library(): Promise<() => Promise<void>> {
  if (process.env.E2E_URL) return async () => {};
  const lib = (LIB = mkdtempSync(join(tmpdir(), "ore-e2e-")));
  await $`bun ${join(MOCK, "seed.ts")} ${lib}`.quiet();
  // The PDF page reader (D125, D346) stands in as a script that writes its saved reading of tables.pdf.
  const paddle = join(lib, ".ore", "paddle");
  // Every PDF added is read: any other one gets an empty reading, which changes nothing.
  writeFileSync(paddle, `#!/bin/sh\nsleep 1\nif cmp -s "$2" "${FIXTURES}/tables.pdf"; then cp "${FIXTURES}/tables.paddle.json" "$3"; else echo "[]" > "$3"; fi\n`);
  chmodSync(paddle, 0o755);
  // Ports of their own, so a mock left running for screenshots (1420, 1421) never answers instead.
  const bridge = Bun.spawn(["bun", join(MOCK, "bridge.ts")], { env: { ...process.env, ORE_LIBRARY: lib, ORE_PADDLE: paddle, PORT: String(BRIDGE), ORE_MOCK_AI: join(import.meta.dir, "ai"), ORE_MOCK_DELAY: "50", ORE_MOCK_ENRICH: "1" }, stdout: "ignore", stderr: "inherit" });
  // The last file's bridge has gone by now (its end waits for that), so an answer on the port is this one's.
  let up = false;
  for (const end = Date.now() + 30_000; !up && Date.now() < end; up || (await Bun.sleep(50))) up = await fetch(`http://localhost:${BRIDGE}/`, { method: "OPTIONS" }).then((r) => r.ok, () => false);
  if (!up) {
    bridge.kill();
    throw new Error(`the bridge did not answer on port ${BRIDGE} within 30 s: is the port taken? ORE_E2E_MOCK_PORT picks another`);
  }
  return async () => {
    bridge.kill();
    await bridge.exited;
    // As far as it goes: a background `ore enrich` an add started may still be writing its log there.
    try { rmSync(lib, { recursive: true, force: true }); } catch {}
  };
}

/** WebKit, launched the first time a journey needs it; not installed, that journey fails saying how to get it. */
async function safariBrowser(): Promise<Browser> {
  try {
    return (safari ??= await webkit.launch());
  } catch (e) {
    throw new Error(`WebKit won't start (${(e as Error).message.split("\n")[0]}): install it with \`bunx playwright install webkit\``);
  }
}

/** The iPhone build (ORE_PHONE=1, src/phone), started the first time a phone journey needs it (on ORE_E2E_PHONE_PORT,
 *  vite's port + 2; E2E_PHONE_URL uses one already running). It runs the core inside the page, so it takes no bridge.
 *  Its library is a seed of its own (PHONE_LIB), never the one the desktop journeys change: the phone only reads the
 *  files (its writes stay in each page's IndexedDB, and every journey's page is a fresh one), so each phone journey
 *  starts from the same seed, made afresh for each file of phone journeys. A journey that changes a file there (a sync
 *  from the Mac) puts it back. */
let phoneVite: { url: string; stop: () => void } | undefined;

export let PHONE_LIB = process.env.ORE_PHONE_LIBRARY ?? "";

/** The phone's library seeded afresh, in the folder its vite already reads: once for each file of phone journeys. */
let phoneOwn = "";
async function phoneLibrary() {
  if (process.env.E2E_PHONE_URL) return;
  if (!phoneOwn) phoneOwn = PHONE_LIB = mkdtempSync(join(tmpdir(), "ore-e2e-phone-"));
  else for (const f of readdirSync(phoneOwn)) rmSync(join(phoneOwn, f), { recursive: true, force: true });
  await $`bun ${join(MOCK, "seed.ts")} ${phoneOwn}`.quiet();
}

async function phoneApp(): Promise<string> {
  if (process.env.E2E_PHONE_URL) return process.env.E2E_PHONE_URL;
  if (phoneVite) return phoneVite.url;
  if (!phoneOwn) await phoneLibrary();
  const port = Number(process.env.ORE_E2E_PHONE_PORT ?? PORT + 2);
  const vite = Bun.spawn(["bunx", "vite", "--port", String(port), "--strictPort"], { cwd: join(import.meta.dir, ".."), env: { ...process.env, ORE_PHONE: "1", ORE_PHONE_LIBRARY: PHONE_LIB }, stdout: "pipe", stderr: "pipe" });
  watchVite(vite, true);
  const url = `http://localhost:${port}/`;
  let up = false;
  for (let i = 0; i < 150 && !up; i++) {
    up = await fetch(url).then((r) => r.ok, () => false);
    if (!up) await Bun.sleep(200);
  }
  if (!up) {
    vite.kill();
    throw new Error(`the phone build's vite never answered on ${url} (30 s): is the port taken? ORE_E2E_PHONE_PORT picks another`);
  }
  phoneVite = { url, stop: () => vite.kill() };
  // Loaded once first: what vite bundles on a first load (and the reload that follows) lands before any journey.
  const warm = await (await safariBrowser()).newPage();
  await warm.goto(url);
  await warm.locator(".phone-app").waitFor({ timeout: 30000 }).catch(() => {});
  await Bun.sleep(1000);
  await warm.close();
  return url;
}

/** The iPhone on this file's library, as D222 has it: the phone build mounts LIB as its iCloud folder through the
 *  shell's library commands (scripts/mock/phone-shell.ts), so it and the journey's Mac page write one folder, as
 *  both apps do on his iCloud library. iCloud's own delay isn't stood in for: the phone reads the Mac's changes when
 *  it scans, as it does when it comes back and every 30 s. */
let shell: ReturnType<typeof serveShell> | undefined;
export const phoneOnMacLibrary = () => openPhone((shell ??= serveShell(() => LIB)).port!);

/** The phone app as he holds it: WebKit at 390×844 with touch, dark (D78). Journeys tap with `tap()`, a real touch.
 *  `shellPort`: a stand-in for the shell's library commands, so the phone mounts a folder instead of the snapshot. */
async function openPhone(shellPort?: number): Promise<Page> {
  const url = await phoneApp();
  const page = await (await safariBrowser()).newPage({ ...devices["iPhone 14"], viewport: { width: 390, height: 844 }, colorScheme: "dark" });
  page.setDefaultTimeout(8000);
  // Named for the journey, as `open` does: a page error on a phone page once came with no name (F86).
  const of = running;
  page.on("pageerror", (e) => errors.push(`${of}: ${e.message}`));
  // What the app's Tauri shell gives the page and a browser lacks: an image saved with a source loads through it.
  // A source's own files come from the phone build's dev server (vite.config.ts `/library-file`), as the shell's
  // asset protocol serves them from the folder.
  if (shellPort) await page.addInitScript(phoneShell(shellPort));
  await page.addInitScript(`window.__TAURI_INTERNALS__ ??= { convertFileSrc: (p) => "/library-file" + p, transformCallback: () => 0, invoke: () => Promise.reject(new Error("no Tauri here")) }`);
  await page.addInitScript(HYGIENE);
  // The check-in before a session (D324) asks once a day about a try last touched before today: marked asked on every
  // load, so a journey that moves the clock meets the session it means to; the check-in's own journeys turn this off.
  await page.addInitScript(`try { if (!localStorage.getItem("e2e.check-in")) localStorage.setItem("ore.try-checkin", new Date().toLocaleDateString("sv")); } catch {}`);
  await page.goto(url);
  await page.locator(".phone-app").waitFor();
  // Opened means the library is read: a journey that relaunches at once (page.reload) cut the read of
  // /library.json in half, and WebKit reported it as a page error after every journey passed (F86).
  await page.locator(".phone-opening").waitFor({ state: "detached" });
  return page;
}

async function open(url: string, engine: Engine): Promise<Page> {
  if (engine === "phone") return openPhone();
  const page = await (engine === "webkit" ? await safariBrowser() : browser).newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(8000);
  // Named for the journey that opened the page, also when it comes as the page closes (a request still in flight).
  // A fetch WebKit refused "due to access control checks" also names the ore calls in flight then (F749).
  const of = running;
  page.on("pageerror", async (e) => {
    const calls = /access control/.test(e.message) ? await page.evaluate(() => JSON.stringify((window as unknown as { __ORE_INFLIGHT?: string[] }).__ORE_INFLIGHT)).catch(() => "page closed") : "";
    errors.push(`${of}: ${e.message}${calls ? ` (in flight: ${calls})` : ""}`);
  });
  await page.addInitScript(`window.__ORE_BRIDGE = ${BRIDGE}`);
  await page.addInitScript({ path: join(MOCK, "tauri.js") });
  await page.addInitScript(HYGIENE);
  // The check-in before a session (D324) asks once a day about a try last touched before today: marked asked on every
  // load, so a journey that moves the clock meets the session it means to; the check-in's own journeys turn this off.
  await page.addInitScript(`try { if (!localStorage.getItem("e2e.check-in")) localStorage.setItem("ore.try-checkin", new Date().toLocaleDateString("sv")); } catch {}`);
  if (process.env.ORE_E2E_SLOW) await page.addInitScript(`window.__ORE_SLOW = ${process.env.ORE_E2E_SLOW}`);
  if (process.env.ORE_E2E_CPU && engine === "chromium") await (await page.context().newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.ORE_E2E_CPU) });
  await page.goto(url);
  await page.locator(".side-item").first().waitFor();
  return page;
}

// Four rules every journey checks as it runs, whatever it is about:
// - A press stopped on its way to the document leaves an open popover deaf to it (Radix listens there), and one
//   stopped inside a popover makes the next press outside count as inside.
// - A modal dialog keeps Tab inside it (<Trap>, which marks its panel data-trap): without one, ⇧Tab reaches the
//   page behind, where Esc no longer closes the dialog and Enter runs what is under it.
// - A menu, popover or popup that floats (fixed, or a Radix popper) lies inside the window: one placed at the caret
//   or pointer with no room for it ran off the bottom (the note's / menu, 2026-11-10). Checked two frames after the
//   page changes or resizes, and as the journey ends; one still being placed (Radix's first frame) or animating (or on a screen that is) is
//   looked at again. An absolute one counts only where he can see it cut by the window, not when it has scrolled
//   out of its panel with its text.
// - Focus never falls to <body> when the control holding it leaves the page (a row archived, a field, dialog or menu
//   closed): what replaced it, or the control that opened it, takes it (Finder, macOS sheets). Details at the rule.
const HYGIENE = `(() => {
  const found = (window.__hygiene = new Set());
  for (const m of ["stopPropagation", "stopImmediatePropagation"]) {
    const was = Event.prototype[m];
    Event.prototype[m] = function () {
      if (this.type === "pointerdown") found.add("a press was stopped before it reached the document, on: " + (this.target?.className?.baseVal ?? this.target?.className ?? this.target?.nodeName));
      return was.call(this);
    };
  }
  const modals = () => {
    for (const el of document.querySelectorAll('[aria-modal="true"]'))
      if (!el.closest("[data-trap]") && !el.querySelector("[data-trap]")) found.add("a modal dialog with no focus trap: " + (el.getAttribute("aria-label") ?? el.className));
  };
  const POPUPS = '[role="menu"], [role="listbox"], [role="dialog"], [role="toolbar"], .popover, .note-menu, .sel-bar, .tutor-sel, .tutor-mention';
  // The floating ones on screen, each with whether it is still being placed (Radix's first frame) or animating.
  // Animating: itself, or the screen it is on (a phone screen sliding in carries its dialog with it).
  // An animation that finished a moment ago counts too: WebKit on CI reported a screen's slide "finished" (327 ms into
  // 300) while its box still stood 12 px in, a frame or two before the end state lands (F468).
  const settling = (x) => x.playState === "running" || (x.playState === "finished" && (x.currentTime ?? 0) - (x.effect?.getComputedTiming().endTime ?? 0) < 1000);
  const moving = (el) => { for (let a = el; a; a = a.parentElement) if (a.getAnimations().some(settling)) return true; return false; };
  const floating = () => [...document.querySelectorAll(POPUPS)].flatMap((el) => {
    const css = getComputedStyle(el);
    const wrap = el.parentElement?.hasAttribute("data-radix-popper-content-wrapper") ? el.parentElement : null;
    if (!(css.position === "fixed" || wrap || (css.position === "absolute" && el.matches(".popover, .sel-bar, .tutor-sel, .tutor-mention")))) return [];
    if (css.visibility === "hidden" || css.display === "none" || el.closest('[aria-hidden="true"], [inert], [data-state="closed"]')) return [];
    return [{ el, css, busy: !!(wrap && /-200%/.test(wrap.style.transform)) || moving(el) }];
  });
  // The part of its box he sees: cut by each ancestor that clips, up to the fixed layer it is in. A popup
  // scrolled out of its panel with the text it belongs to is not cut by the window; one cut at the window's
  // edge (or at a panel's edge lying on the window's) is.
  const seen = (el, css) => {
    const b = el.getBoundingClientRect();
    const v = { top: b.top, left: b.left, bottom: b.bottom, right: b.right };
    if (css.position !== "fixed")
      for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
        const c = getComputedStyle(a);
        if (c.overflowX !== "visible" || c.overflowY !== "visible") {
          const q = a.getBoundingClientRect();
          v.top = Math.max(v.top, q.top); v.left = Math.max(v.left, q.left); v.bottom = Math.min(v.bottom, q.bottom); v.right = Math.min(v.right, q.right);
        }
        if (c.position === "fixed") break;
      }
    return { b, v };
  };
  // Found out twice running, a frame apart, and not while a press is held: a popup a ResizeObserver puts back
  // a frame behind a drag is out only between the drag's step and the next paint, which no one sees.
  let out = new Set();
  let pressed = false;
  addEventListener("pointerdown", () => (pressed = true), true);
  for (const t of ["pointerup", "pointercancel"]) addEventListener(t, () => ((pressed = false), queue()), true);
  const check = (final) => {
    let again = false;
    const now = new Set();
    for (const { el, css, busy } of floating()) {
      if ((busy || pressed) && !final) { again = true; continue; }
      const { b, v } = seen(el, css);
      if (!b.width || !b.height || v.bottom - v.top < 1 || v.right - v.left < 1) continue;
      const W = innerWidth, H = innerHeight;
      const cut = (b.top < -1 && v.top <= 1) || (b.left < -1 && v.left <= 1) || (b.bottom > H + 1 && v.bottom >= H - 1) || (b.right > W + 1 && v.right >= W - 1);
      if (!cut) continue;
      now.add(el);
      // What moved it, if anything still is: each ancestor with an animation, and the animation's state (F468).
      const why = () => { const l = []; for (let a = el; a; a = a.parentElement) for (const x of a.getAnimations()) l.push((a.className || a.nodeName) + ":" + (x.animationName ?? x.transitionProperty ?? "waapi") + ":" + x.playState + ":" + Math.round(x.currentTime ?? -1)); return l.length ? " (animations: " + l.join(", ") + "; transform " + getComputedStyle(el.closest(".phone-full") ?? el).transform + ")" : " (no animations; transform " + getComputedStyle(el.closest(".phone-full") ?? el).transform + ")"; };
      if (out.has(el)) found.add("a " + (el.getAttribute("role") ?? "popup") + " runs out of the " + W + "×" + H + " window: " + el.className + " at " + [b.left, b.top, b.width, b.height].map(Math.round).join(",") + why());
      else again = true;
    }
    out = now;
    return again;
  };
  // Each change gets its own budget of frames to wait out a popup being placed or animating. Each look is
  // after a frame is painted (a task after its rAF), so what a ResizeObserver places before paint counts.
  let queued = false, budget = 0;
  const painted = (f) => requestAnimationFrame(() => setTimeout(f, 0));
  const run = () => {
    queued = false;
    if (check(false) && budget-- > 0) { queued = true; painted(run); }
  };
  const queue = () => {
    budget = 30;
    if (!queued) { queued = true; painted(run); }
  };
  addEventListener("resize", queue);

  // Focus that falls to <body>: the focused control left the page (its row archived, the field or dialog or menu
  // it sat in closed) and nothing took focus after it, so ↑↓, Enter and ⌘Z have nothing to act on. Not after a
  // press away from it (a click on blank space puts focus there on purpose), not for a button that had focus only
  // because it was clicked (Chromium's way; WebKit, the app's engine, focuses no button on a click), not when the
  // screen itself changed (he went somewhere: the new screen owns focus), not from a layer (dialog, menu, popover)
  // that focus entered from <body> (⌘K pressed with nothing focused: there is nothing to give it back to), not as
  // the page unloads. Looked at two painted frames after the loss and again 250 ms on, so a handler that moves focus on
  // a timer has done it; only a loss both looks agree on counts.
  const LAYERS = '[role="dialog"], [role="menu"], [role="listbox"], .popover';
  // Where focus may still fall to <body>, known and left for a fix of its own: [the control that held it, matched
  // exactly and scoped by its screen, why]. Empty since the follow-up to the lists fix (2026-11-11).
  const ALLOW = [];
  const screen = () => document.querySelector(".main")?.lastElementChild ?? null;
  let held = null, heldScreen = null, away = false, leaving = false, losing = false, clicked = false, pressedOn = null, fromNothing = false, allowed = false, rightAt = -Infinity, heldLayer = null;
  const entered = new WeakMap();
  addEventListener("focusin", (e) => {
    const layer = e.target.closest?.(LAYERS);
    // A menu a right-click opened came from the row under the pointer, though Chromium's press on a row that takes
    // no focus had already put focus on <body>: a pick that loses focus there counts.
    if (layer && !entered.has(layer)) entered.set(layer, (!e.relatedTarget || e.relatedTarget === document.body) && performance.now() - rightAt > 1000);
    held = e.target; heldScreen = screen(); away = false; clicked = !!pressedOn && e.target.contains(pressedOn); fromNothing = !!layer && entered.get(layer); heldLayer = layer;
    allowed = ALLOW.some(([sel]) => e.target.matches?.(sel));
  }, true);
  for (const t of ["pointerup", "pointercancel"]) addEventListener(t, () => setTimeout(() => (pressedOn = null), 0), true);
  addEventListener("pointerdown", (e) => {
    pressedOn = e.target;
    if (e.button === 2) rightAt = performance.now();
    const a = document.activeElement;
    const zone = a && a !== document.body ? (a.closest(LAYERS) ?? a) : null;
    if (!zone || !zone.contains(e.target)) away = true;
  }, true);
  addEventListener("pagehide", () => (leaving = true));
  addEventListener("beforeunload", () => (leaving = true));
  // A layer that declares where focus goes when nothing opened it (data-gives-back: useFocusWhileMounted's fallback) is held to it.
  const exempt = () => fromNothing && !heldLayer?.hasAttribute("data-gives-back");
  const lost = () => !leaving && !away && !clicked && !exempt() && !allowed && !!held && document.activeElement === document.body && !(held.isConnected && held.getClientRects().length) && screen() === heldScreen;
  const name = (el) => (el.tagName.toLowerCase() + (typeof el.className === "string" && el.className.trim() ? "." + el.className.trim().split(/\\s+/).join(".") : "") + " “" + (el.getAttribute("aria-label") ?? el.value ?? el.textContent ?? "").trim().slice(0, 40) + "”");
  const watchLoss = () => {
    if (losing || !lost()) return;
    losing = true;
    const was = held;
    painted(() => painted(() => {
      if (!lost() || held !== was) return void (losing = false);
      setTimeout(() => {
        losing = false;
        if (lost() && held === was) found.add("focus fell to <body> when the focused " + name(was) + " left the page");
      }, 250);
    }));
  };
  addEventListener("focusout", () => setTimeout(watchLoss, 0), true);

  // Once more as the journey ends: waits out (a second at most) any popup still animating, then checks every one.
  window.__hygieneCheck = async () => {
    for (let i = 0; i < 60 && floating().some((f) => f.busy); i++) await new Promise((r) => requestAnimationFrame(r));
    check(true);
    await new Promise((r) => painted(r));
    check(true);
    watchLoss();
    for (let i = 0; i < 40 && losing; i++) await new Promise((r) => setTimeout(r, 25));
  };
  addEventListener("DOMContentLoaded", () => new MutationObserver(() => (modals(), queue(), watchLoss())).observe(document.body, { childList: true, subtree: true }));
})()`;

export const errors: string[] = [];

/** The journey running now, which names the page errors of the pages it opens. */
export let running = "";

export const browser = await chromium.launch();

/** The Mac app runs in WebKit (WKWebView), not Chromium: a journey about what only WebKit does (its native
 *  undo in a text field) runs there, in a browser launched the first time one needs it. "phone" is the iPhone
 *  build in WebKit with touch (openPhone). */
type Engine = "chromium" | "webkit" | "phone";

let safari: Browser | undefined;

// A chip's × shows only under the pointer or keyboard focus (D328), so it is pressed as he would: over the chip first.
export async function unchip(tutor: Locator, name: string) {
  const x = tutor.getByRole("button", { name });
  await tutor.locator(".tutor-chip", { has: tutor.page().getByRole("button", { name }) }).hover();
  await x.click();
}

const journeys: [name: string, run: (page: Page) => Promise<void>, engine: Engine, file: string][] = [];

/** The file of journeys being read (e2e/journeys.ts names each before it imports it): its journeys share a library. */
let file = "";
export const from = (name: string) => void (file = name);

export const journey = (name: string, run: (page: Page) => Promise<void>, engine: Engine = "chromium") => void journeys.push([name, run, engine, file]);

export const TESTING = "The Testing Effect: Why Retrieval Beats Rereading";

export const AGENTS = "Building Effective Agents";

/** Opens a source from All sources, by its title. */
export async function openSource(page: Page, title: string) {
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.locator(".row").filter({ hasText: title }).first().click();
  await page.locator(".doc-head").filter({ hasText: title }).waitFor();
}

/** Drags across a phrase in the reader, as he selects with the mouse. */
export async function select(page: Page, phrase: string) {
  const find = () => page.evaluate((phrase) => {
    const walk = document.createTreeWalker(document.querySelector(".doc")!, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
      const i = n.data.indexOf(phrase);
      if (i < 0) continue;
      n.parentElement!.scrollIntoView({ block: "center" });
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + phrase.length);
      const rects = r.getClientRects();
      const a = rects[0]!, z = rects[rects.length - 1]!;
      // A picture on screen still loading has no height yet: it lands a moment later and pushes the words down.
      const loading = [...document.querySelectorAll<HTMLImageElement>(".doc img")].some((img) => {
        const b = img.getBoundingClientRect();
        return !img.complete && b.bottom > -innerHeight && b.top < 2 * innerHeight;
      });
      return { x1: a.left + 1, y1: a.top + a.height / 2, x2: z.right - 1, y2: z.top + z.height / 2, loading };
    }
    return null;
  }, phrase);
  // Found where it rests (F884): read while a picture above it was still loading, the press
  // landed on the picture that took the words' place and opened it instead of selecting.
  let box = await find();
  for (let last = ""; box; box = await find()) {
    const now = `${Math.round(box.y1)},${Math.round(box.x1)}`;
    if (!box.loading && now === last) break;
    last = box.loading ? "" : now;
    await page.waitForTimeout(50);
  }
  if (!box) throw new Error(`“${phrase}” is not in the reader`);
  await page.mouse.move(box.x1, box.y1);
  await page.mouse.down();
  await page.mouse.move(box.x2, box.y2, { steps: 5 });
  await page.mouse.up();
}

/** Waits until every title is back in the library, not only on screen: rows come back the moment ⌘Z is
 *  pressed, while its write may still wait behind the archive's. A journey that ended there closed its
 *  page first, the queued Undo was never sent, and the next journeys lost those sources (“The Testing
 *  Effect” from To read, failing the hang and a11y journeys on CI). The app's own writes answer first
 *  (`settled`): a fixed wait for the library timed out on CI while a runner stalled (F190). */
export async function inLibrary(page: Page, titles: string[]) {
  await settled(page);
  await until("the library has them all back", async () => {
    const live = new Set(((await ore("ls")) as { title: string }[]).map((i) => i.title));
    return titles.every((t) => live.has(t));
  });
}

/** Until no `ore` call has been in flight for 300 ms, up to three seconds; never fails. */
async function calm(page: Page) {
  let quietSince = Date.now();
  for (const end = Date.now() + 3000; Date.now() < end && Date.now() - quietSince < 300; await Bun.sleep(50)) {
    const busy = await page.evaluate(() => !!(window as unknown as { __ORE_PENDING?: number }).__ORE_PENDING).catch(() => false);
    if (busy) quietSince = Date.now();
  }
}

/** Waits for every `ore` call the page has made to answer, however long a slow machine takes (past the library
 *  lock's 15 s, so a write stuck there answers with its error first); a call that never answers is named. */
export async function settled(page: Page, ms = 20_000) {
  await until("its ore calls have answered", () => page.evaluate(() => !(window as unknown as { __ORE_PENDING?: number }).__ORE_PENDING), ms).catch(async () => {
    throw new Error(`ore calls still in flight: ${JSON.stringify(await page.evaluate(() => (window as unknown as { __ORE_INFLIGHT?: string[] }).__ORE_INFLIGHT))}`);
  });
}

/** Waits until a check holds, for a step that saves in the background. */
export async function until(what: string, ok: () => Promise<boolean>, ms = 5000) {
  for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(100)) if (await ok()) return;
  throw new Error(`timed out: ${what}`);
}

// —— what several files of journeys share ——

/** The middle of a phrase in the reader, scrolled into view. */
export async function pointAt(page: Page, phrase: string, root = ".doc") {
  return (await page.evaluate(({ phrase, root }) => {
    const walk = document.createTreeWalker(document.querySelector(root)!, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
      const i = n.data.indexOf(phrase);
      if (i < 0) continue;
      n.parentElement!.scrollIntoView({ block: "center" });
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + phrase.length);
      const b = r.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }
  }, { phrase, root }))!;
}

/** A long source of numbered passages, for the journeys that select past the screen's edge. */
export const longPassages = (title: string) =>
  `# ${title}\n\n${Array.from({ length: 40 }, (_, i) => `Passage ${i + 1} goes on about recall and spacing, long enough to wrap across a couple of lines of the reading column.`).join("\n\n")}\n`;

/** Walks a menu with ↓ to the item named `label` and picks it with ↵, as he does without the mouse. */
export async function pickWithKeys(page: Page, label: string) {
  const at = () => page.evaluate(() => (document.activeElement?.getAttribute("role") === "menuitem" ? document.activeElement.textContent ?? "" : ""));
  // Radix moves focus to the next item on a timer: each ↓ waits for its move, as a held key's repeat would.
  for (let i = 0, now = await at(); i < 16 && !now.startsWith(label); i++) {
    await page.keyboard.press("ArrowDown");
    const was = now;
    await until("↓ moves the focus", async () => (now = await at()) !== was, 1000).catch(() => {});
  }
  if (!(await at()).startsWith(label)) throw new Error(`no “${label}” in the menu (at “${await at()}”)`);
  await page.keyboard.press("Enter");
}

export const hasCaret = (page: Page, sel: string) => page.locator(sel).evaluate((el) => el === document.activeElement).catch(() => false);

/** Types `query` in ⌘K and picks the row in the text that reads `row`. */
export async function searchPick(page: Page, query: string, row: string) {
  await page.keyboard.press("Meta+k");
  await page.locator("[cmdk-input]").fill(query);
  await page.locator("[cmdk-item]").filter({ hasText: row }).first().click();
}

/** The find bar holds `words` and its current match is on screen, inside `within`. */
export async function foundOnScreen(page: Page, words: string, within: string) {
  const bar = page.locator(".find-bar input");
  await until("the find bar holds the words", async () => (await bar.count()) === 1 && (await bar.inputValue()) === words);
  await until(`the match is on screen, in ${within}`, () =>
    page.evaluate((within) => {
      const r = [...(CSS.highlights.get("find-on") ?? [])][0] as Range | undefined;
      const b = r?.getBoundingClientRect();
      return !!r && !!b && b.top >= 0 && b.bottom <= innerHeight && !!r.startContainer.parentElement?.closest(within);
    }, within),
  );
}

/** Waits until every `ore` call the page made has answered and what came back is drawn, three frames running
 *  with none outstanding (the mock counts them in `window.__ORE_PENDING`). A skill page draws its sources before
 *  its stats and note arrive, which then push them down: a press measured before that lands above the list. */
export async function loaded(page: Page) {
  await until("the page has loaded what it asked for", () => page.evaluate(() => new Promise<boolean>((done) => {
    let frames = 0;
    const look = () => {
      if ((window as unknown as { __ORE_PENDING?: number }).__ORE_PENDING) return done(false);
      if (++frames === 3) return done(true);
      requestAnimationFrame(() => setTimeout(look));
    };
    look();
  })));
}

/** The `ore` CLI through the bridge, as the app calls it. */
export const ore = (...args: string[]) =>
  fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: [...args, "--json"] }) }).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

/** Starts a review of the skills whose row in "What to review" matches `only` (null: every skill). */
export async function startReview(page: Page, only: RegExp | null, keys = false, first: "question" | "check-in" = "question") {
  const pick = page.getByRole("dialog", { name: "What to review" });
  // Home has the button; `keys` starts it with ⌘R from any other screen.
  if (keys) await page.keyboard.press("Meta+KeyR");
  else await page.getByRole("button", { name: "Start review" }).click();
  await pick.waitFor();
  await pick.getByRole("checkbox").first().waitFor(); // the rows can land after the sheet
  for (const row of await pick.getByRole("checkbox").all()) {
    const want = !only || only.test(await row.innerText());
    if ((await row.getAttribute("aria-checked") === "true") !== want) await row.click();
  }
  await page.keyboard.press("Enter");
  if (first === "check-in") return void (await page.locator(".checkin").waitFor());
  // No question within the wait says what was on screen instead (F142: cause not found).
  await page.locator(".review-q").waitFor().catch(async (e) => {
    const seen = await page.evaluate(() => ({
      sheet: [...document.querySelectorAll(".review-pick [role=checkbox]")].map((r) => `${r.querySelector(".name")?.textContent}:${r.getAttribute("aria-checked")}`),
      focus: `${document.activeElement?.tagName}.${document.activeElement?.className}`,
      review: document.querySelector(".review")?.textContent?.slice(0, 200) ?? null,
    }));
    throw new Error(`${(e as Error).message}\n      on screen: ${JSON.stringify(seen)}`);
  });
}

/** Whether the exercise on screen is a Fact one (`kind: card`). */
export const isFact = async (page: Page) => (await page.locator(".review-card").first().getAttribute("data-kind")) === "card";

/** Answers the Fact exercise on screen as he does (D359): types `text` (its own answer by default, so
 *  ↵ suggests Good), says how sure, and checks it. */
export async function typeFact(page: Page, text?: string, sure = "Think so") {
  const id = await page.locator(".review-card").first().getAttribute("data-id");
  const said = text ?? ((await ore("card", "show", id!)) as { answer: string }).answer;
  await page.getByLabel("Your answer").fill(said);
  const pick = page.getByRole("radio", { name: sure, exact: true });
  // A kept draft brings back how sure he was; a second press would clear it.
  if ((await pick.getAttribute("aria-checked")) !== "true") await pick.click();
  await page.locator("#review-check").click();
}

/** Checks the exercise on screen as fast as he can: No idea on an Explain one, its own answer typed on a Fact one. */
export const showAnswer = async (page: Page) => ((await isFact(page)) ? typeFact(page) : page.getByRole("button", { name: "No idea" }).click());

/** Shows the answer of the exercise on screen: No idea on an Explain one, its own answer typed on a Fact one. */
export async function reveal(page: Page) {
  if (await isFact(page)) {
    await typeFact(page);
    await page.getByRole("button", { name: "Good", exact: true }).waitFor();
    await page.waitForTimeout(300);
    return;
  }
  const noIdea = page.getByRole("button", { name: "No idea" });
  const none = await noIdea.isVisible();
  await (none ? noIdea : page.getByRole("radio", { name: "Think so" })).click();
  await page.getByRole("button", { name: "Good", exact: true }).waitFor();
  await page.waitForTimeout(300); // the passage loads after the answer, and a rating key right after it is ignored
  await armGood(page, none);
}

/** Good over No idea takes two presses (D237: a rating two steps over a miss waits for a second one). After
 *  No idea this gives the first, so a journey about something else rates Good with one. */
export async function armGood(page: Page, noIdea: boolean) {
  if (!noIdea) return;
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await page.locator(".review-guard").waitFor();
  await page.waitForTimeout(550); // a second press inside a double click doesn't count
}

/** Waits until the passage is under the answer. It lands a moment after the answer and moves what is under it
 *  in the page; the Mac's ratings are in the bottom bar and stay put (F865). */
export const passageIn = (page: Page) => page.locator(".review-passage").first().waitFor();

/** Every `ore` call a page makes, in order, and the ratings it logged (to take back after the journey). */
export function oreCalls(page: Page) {
  const calls: string[][] = [];
  const rated: { card: string; ts: string }[] = [];
  const argsOf = (r: { postData(): string | null }) => (JSON.parse(r.postData() ?? "{}") as { args: string[] }).args;
  const isRating = (r: { method(): string; url(): string; postData(): string | null }) =>
    r.method() === "POST" && r.url().endsWith("/ore") && argsOf(r)[0] === "review" && !argsOf(r).some((a) => a.startsWith("--undo"));
  // Ratings sent whose answer isn't read yet. A rating is known here only then, so `undoAll` waits for them:
  // run in a journey's `finally` right after the press, it found none and left a real review in the library (F866).
  let out = 0;
  page.on("request", (r) => {
    if (r.method() !== "POST" || !r.url().endsWith("/ore")) return;
    calls.push(argsOf(r));
    if (isRating(r)) out++;
  });
  page.on("requestfailed", (r) => void (isRating(r) && out--));
  page.on("response", async (r) => {
    if (!isRating(r.request())) return;
    try {
      if (r.ok()) rated.push(await r.json());
    } finally {
      out--;
    }
  });
  const undoAll = async () => {
    for (const end = Date.now() + 5000; out > 0 && Date.now() < end; ) await Bun.sleep(50);
    for (const r of rated.splice(0).reverse()) await ore("review", r.card, `--undo=${r.ts}`).catch(() => {});
  };
  return { calls, rated, undoAll };
}

/** Leaves the window for over 10 s and comes back, as he does after using the CLI, `/ore` or the phone. */
export async function awayAndBack(page: Page) {
  await page.evaluate(async () => {
    dispatchEvent(new Event("blur"));
    await new Promise((r) => setTimeout(r, 50));
    const real = Date.now;
    Date.now = () => real() + 11_000;
    dispatchEvent(new Event("focus"));
    Date.now = real;
  });
}

export type TryRec = { id: string; when?: string; uses?: unknown[] };

/** Holds the next `ore <key>` until `release(key)` (the mock's manual hold), so a test decides when it lands. */
export const hold = (page: Page, key: string, calls = 1) => page.evaluate(([k, n]) => {
  const w = window as unknown as { __ORE_HOLD?: Record<string, unknown[]> };
  (w.__ORE_HOLD ??= {})[k] = Array(n).fill("manual");
}, [key, calls] as const);

export const release = (page: Page, key: string) => page.evaluate((k) => (window as unknown as { __ORE_RELEASE: (k: string) => void }).__ORE_RELEASE(k), key);

/** Whether an `ore <key>` is waiting on its hold right now. */
export const isHeld = (page: Page, key: string) => page.evaluate((k) => (window as unknown as { __ORE_HELD: string[] }).__ORE_HELD.includes(k), key);

/** Resolves once the page's next `ore <cmd>` has answered. */
export const answered = (page: Page, cmd: string) => page.waitForResponse((r) => r.url().endsWith("/ore") && (JSON.parse(r.request().postData() ?? "{}") as { args?: string[] }).args?.[0] === cmd);

export type Rigged = { __ORE_FAIL?: Record<string, string>; __ORE_SLOW?: Record<string, number> };

export const failNext = (page: Page, command: string, why: string | null) => page.evaluate(([c, why]) => void ((window as unknown as Rigged).__ORE_FAIL = why ? { [c!]: why } : {}), [command, why] as const);

// —— the iPhone build (D78): WebKit at 390×844, every press a real touch ——

/** A real touch on the middle of what the locator finds, once it has stopped moving (a drawer or sheet sliding in). */
export async function tap(page: Page, target: Locator) {
  const el = target.first();
  await el.scrollIntoViewIfNeeded();
  let b = await el.boundingBox();
  for (let i = 0; i < 20; i++) {
    await Bun.sleep(50);
    const now = await el.boundingBox();
    if (now && b && now.x === b.x && now.y === b.y) break;
    b = now;
  }
  if (!b) throw new Error(`nothing on screen to tap: ${target}`);
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
}

/** On the phone: answers the Fact exercise on screen with touches (D359). The phone's library lives in
 *  the page, out of the bridge's reach, so it types `text`, not the answer: Good is tapped, not suggested. */
export async function tapFact(page: Page, text = "An answer from memory", sure = "Think so") {
  const said = text;
  const box = page.locator(".phone-full .quiz-answer-line");
  await tap(page, box);
  await box.fill(said);
  const pick = page.getByRole("radio", { name: sure, exact: true });
  if ((await pick.getAttribute("aria-checked")) !== "true") await tap(page, pick);
  await tap(page, page.locator(".phone-full #review-check"));
}

/** Opens a source from the drawer's Sources, by its title. */
export async function phoneSource(page: Page, title: string) {
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Sources" }));
  await tap(page, page.locator(".phone-sources button").filter({ hasText: title }));
  await phoneReaderReady(page);
}

/** The iPhone's reader has its text on screen and read in (its marks layer is there only then). Until that it takes
 *  no tap on the text and has not yet gone to the place he left, so a journey that taps or measures as soon as the
 *  text shows loses to a slow runner: a double tap made nothing, a point measured was scrolled away (F856). */
export async function phoneReaderReady(page: Page) {
  await page.locator(".phone-reader .doc").first().waitFor();
  await page.locator(".phone-reader .marks").first().waitFor({ state: "attached" });
}

/** A finger held still on the middle of the target for `ms`, then lifted, with the few points of drift a real
 *  finger makes (Playwright's touchscreen only taps). Touch events built in the page, then the click a browser may
 *  send on the lift, at that point: on whatever opened under the finger. */
export async function press(page: Page, target: Locator, ms = 650) {
  let b = (await target.first().boundingBox())!;
  for (let i = 0; i < 20; i++) {
    await Bun.sleep(50); // Once a sliding drawer or sheet has stopped.
    const now = (await target.first().boundingBox())!;
    if (now.x === b.x && now.y === b.y) break;
    b = now;
  }
  const [x, y] = [b.x + b.width / 2, b.y + b.height / 2];
  const send = (type: string, dx: number) =>
    page.evaluate(([type, x, y]) => {
      const el = document.elementFromPoint(x as number, y as number)!;
      const t = { clientX: x, clientY: y, target: el, identifier: 1 };
      const e = new Event(type as string, { bubbles: true, cancelable: true });
      Object.assign(e, { touches: type === "touchend" ? [] : [t], changedTouches: [t] });
      el.dispatchEvent(e);
      if (type === "touchend") document.elementFromPoint(x as number, y as number)!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: x as number, clientY: y as number }));
    }, [type, x + dx, y] as const);
  await send("touchstart", 0);
  for (let i = 0; i < ms / 100; i++) (await Bun.sleep(100), await send("touchmove", i % 2 ? 2 : 0));
  await send("touchend", 0);
}

/** A paste into a field as Safari sends one: the clipboard's plain text and HTML on the event, then the words in the field. */
export async function pasteInto(field: Locator, text: string, html?: string) {
  await field.focus();
  await field.evaluate((el, [text, html]) => {
    const data = new DataTransfer();
    data.setData("text/plain", text!);
    if (html) data.setData("text/html", html);
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, [text, html ?? ""]);
  await field.fill(text);
}

/** How far around its middle a touch still lands on the element, [wide, high] in CSS px (60 at most each way; in
 *  0.5px steps, so up to 1px short). */
const touchArea = (page: Page, sel: string) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const [cx, cy] = [r.x + r.width / 2, r.y + r.height / 2];
    const on = (x: number, y: number) => document.elementFromPoint(x, y)?.closest(sel) === el;
    const reach = (dx: number, dy: number) => {
      let d = 0;
      while (d < 60 && on(cx + dx * (d + 0.5), cy + dy * (d + 0.5))) d += 0.5;
      return d;
    };
    return [reach(-1, 0) + reach(1, 0), reach(0, -1) + reach(0, 1)] as [number, number];
  }, sel);

/** Throws unless a touch lands on the element over at least 44×44 around its middle. */
export async function fits44(page: Page, sel: string, what: string) {
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  const a = await touchArea(page, sel);
  if (!a || a[0] < 43 || a[1] < 43) throw new Error(`${what} answers a touch over ${a?.join("×") ?? "nothing"}, under 44×44`);
}

/** Changes a file in the phone's library as a sync from the Mac would (the next load brings it in), and puts it back
 *  when `run` is done. */
export async function macChanges(path: (lib: string) => string, from: string, to: string, run: () => Promise<void>) {
  const file = path(PHONE_LIB);
  const was = readFileSync(file, "utf8");
  if (!was.includes(from)) throw new Error(`“${from}” is not in ${file}`);
  writeFileSync(file, was.replace(from, to));
  try {
    await run();
  } finally {
    writeFileSync(file, was);
  }
}

export const itemFile = (lib: string, slug: string, name: string) => {
  const year = readdirSync(join(lib, "items")).find((d) => /^\d{4}$/.test(d))!; // the seed carries Finder junk too
  return join(lib, "items", year, readdirSync(join(lib, "items", year)).find((d) => d.startsWith(slug))!, name);
};

/** iOS's keyboard, as the page sees it: the visual viewport shrinks by its height while the layout viewport stays. */
export const keyboardUp = (page: Page, h: number) =>
  page.evaluate((h) => {
    const vv = window.visualViewport!;
    const full = innerHeight;
    Object.defineProperty(vv, "height", { configurable: true, get: () => full - h });
    vv.dispatchEvent(new Event("resize"));
  }, h);

/** A source only some phone journeys need (a video, a PDF), put in the phone's library for the journey and taken
 *  out after; the page reloads to read it. */
export async function phoneWith(page: Page, add: () => Promise<string>, run: () => Promise<void>) {
  const dir = await add();
  try {
    await page.reload();
    await page.locator(".phone-app").waitFor();
    await run();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A Markdown file to add as a source, written beside the run's library. */
export async function textFile(name: string, text: string) {
  const path = join(tmpdir(), `ore-e2e-${process.pid}-${name}`);
  await Bun.write(path, text);
  return path;
}

/** A double tap on the iPhone reader's text. The Reader takes no tap within 150 ms of a scroll (a tap that stops a
 *  scroll is no tap), and a journey has just scrolled its paragraph into view, so this first waits, by the page's
 *  own clock, until the page has drawn and no scroll has come for 250 ms: a fixed wait counted here said nothing
 *  of when a busy page sent its scroll, and the first tap was thrown away (F856). Then both taps are sent at once,
 *  so the second never waits for the first's answer and the two stay inside the Reader's 350 ms. */
export async function doubleTap(page: Page, x: number, y: number) {
  await page.evaluate(() => new Promise<void>((done) => {
    // What the page saw of this double tap, for the failure's message: each scroll and touch, in ms from its start.
    const w = window as unknown as { __TAPS: string[]; __tapsOff?: () => void };
    w.__tapsOff?.();
    const t0 = performance.now();
    const seen: string[] = (w.__TAPS = []);
    let last = t0;
    const note = (e: Event) => {
      if (e.type === "scroll") last = performance.now();
      if (seen.length < 40) seen.push(`${e.type}@${Math.round(performance.now() - t0)}`);
    };
    const kinds = ["scroll", "touchstart", "touchend"];
    kinds.forEach((k) => addEventListener(k, note, true));
    w.__tapsOff = () => kinds.forEach((k) => removeEventListener(k, note, true));
    const frame = () => (performance.now() - last > 250 ? (seen.push(`still@${Math.round(performance.now() - t0)}`), done()) : requestAnimationFrame(frame));
    requestAnimationFrame(frame);
  }));
  await Promise.all([page.touchscreen.tap(x, y), page.touchscreen.tap(x, y)]);
}

/** A finger dragged from one point to another in `ms` and lifted (Playwright's touchscreen only taps): touch events
 *  built in the page, on what was under the finger when it came down, as a browser sends them. */
export async function swipe(page: Page, from: [number, number], to: [number, number], ms = 200, scrolls = false) {
  await page.evaluate(async ([x0, y0, x1, y1, ms, scrolls]) => {
    const el = document.elementFromPoint(x0!, y0!)!;
    const send = (type: string, x: number, y: number) => {
      const t = { clientX: x, clientY: y, target: el, identifier: 1 };
      const e = new Event(type, { bubbles: true, cancelable: true });
      Object.assign(e, { touches: type === "touchend" ? [] : [t], changedTouches: [t] });
      el.dispatchEvent(e);
      taken ||= type === "touchmove" && e.defaultPrevented;
    };
    // A drag the page did not take for itself ends in the click a browser sends on the lift, unless it scrolled a list (`scrolls`).
    let taken = !!scrolls;
    send("touchstart", x0!, y0!);
    const steps = Math.max(4, Math.round(ms! / 16));
    for (let i = 1; i <= steps; i++) {
      await new Promise((r) => setTimeout(r, ms! / steps));
      send("touchmove", x0! + ((x1! - x0!) * i) / steps, y0! + ((y1! - y0!) * i) / steps);
    }
    send("touchend", x1!, y1!);
    if (!taken) document.elementFromPoint(x1!, y1!)?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, clientX: x1!, clientY: y1! }));
  }, [...from, ...to, ms, scrolls ? 1 : 0]);
}

/** A pushed screen has finished sliding in (D331): measure where things are only after this. */
export function slid(page: Page) {
  return until("the screen has slid in", () => page.evaluate(() => ![...document.querySelectorAll(".phone-full, .phone-shell")].some((el) => el.getAnimations().length)));
}

/** A new question typed in Collected sits where its row will: no line above it, no box around it, and the Questions
 *  label as tall as its neighbours (F578: Review's `.ask` and the skill page's `.question` styled them). */
export async function askFieldIsPlain(page: Page, panel: Locator) {
  const field = panel.getByRole("textbox", { name: "New question" });
  await field.waitFor();
  const drawn = await field.evaluate((el) => {
    const box = (e: Element) => { const s = getComputedStyle(e); return { line: s.borderTopWidth, edge: s.boxShadow, gap: s.marginTop }; };
    const row = document.querySelector(".cp-row .cp-text")!.getBoundingClientRect();
    return { wrap: box(el.parentElement!), field: box(el), left: el.getBoundingClientRect().left + parseFloat(getComputedStyle(el).paddingLeft) - row.left, heads: [...document.querySelectorAll(".cp-head")].map((h) => h.getBoundingClientRect().height) };
  });
  if (drawn.wrap.line !== "0px" || drawn.wrap.gap !== "0px") throw new Error(`a line or a gap sits over the new question: ${JSON.stringify(drawn.wrap)}`);
  if (drawn.field.line !== "0px" || drawn.field.edge !== "none") throw new Error(`the new question is typed in a box: ${JSON.stringify(drawn.field)}`);
  if (Math.abs(drawn.left) > 0.5) throw new Error(`the new question's words start ${drawn.left}px off the rows' words`);
  if (new Set(drawn.heads).size > 1) throw new Error(`Collected's labels are not one height: ${drawn.heads}`);
}

// —— the run ——

/** Runs the journeys picked (a name given on the command line, ORE_E2E_FILE), file by file, each file on a fresh
 *  library. ORE_E2E_SHARD=i/n takes whole files: the largest first, each to the part with the fewest journeys so far,
 *  so the parts stay even and a file never splits across two. */
export async function run() {
  const stop = await app();
  let failed = 0;
  const picked = journeys.filter(([name, , , file]) => (!only || name.includes(only)) && (!onlyFile || file === onlyFile));
  const count = (f: string) => picked.filter((j) => j[3] === f).length;
  const files = [...new Set(picked.map((j) => j[3]))].sort();
  const load: number[] = Array(shards).fill(0);
  const mine = new Set<string>();
  for (const f of [...files].sort((a, b) => count(b) - count(a) || a.localeCompare(b))) {
    const least = load.indexOf(Math.min(...load));
    load[least]! += count(f);
    if (least === shard - 1) mine.add(f);
  }
  if (!picked.length) throw new Error(`no journey picked${only ? ` by “${only}”` : ""}${onlyFile ? ` in ORE_E2E_FILE=${onlyFile} (the files: ${[...new Set(journeys.map((j) => j[3]))].join(", ")})` : ""}`);
  for (const f of files.filter((f) => mine.has(f))) {
    // A file of phone journeys takes no bridge: its fresh library is the phone's own.
    const done = picked.some((j) => j[3] === f && j[2] !== "phone") ? await library() : (await phoneLibrary(), async () => {});
    console.log(`\n${f}`);
    for (const [name, journey, engine] of picked.filter((j) => j[3] === f).flatMap((j) => Array(Number(process.env.ORE_E2E_REPEAT ?? 1)).fill(j) as typeof journeys)) {
      let page: Page | undefined;
      running = name;
      const t0 = Date.now();
      try {
        page = await open(url, engine);
        await journey(page);
        // Nothing of the journey's still in flight as its page closes: a save cut off there is lost to the next
        // journey's library, and WebKit reports the cut request as a page error. A call held and never let go fails here.
        await settled(page).catch((e: Error) => {
          throw new Error(`the journey ended with ${e.message}`);
        });
        const broke = await page.evaluate(async () => {
          const w = window as unknown as { __hygiene?: Set<string>; __hygieneCheck?: () => Promise<void> };
          await w.__hygieneCheck?.();
          return [...(w.__hygiene ?? [])];
        }).catch(() => []);
        if (broke.length) throw new Error(broke.join("; "));
        console.log(`ok    ${name} (${Date.now() - t0} ms)`);
      } catch (e) {
        failed++;
        const shot = join(tmpdir(), `ore-e2e-${name.replace(/\W+/g, "-")}.png`);
        await page?.screenshot({ path: shot }).catch(() => {});
        // The `ore` calls still out and the last ones answered: a step that timed out behind a slow or failed call
        // says so, where a screenshot alone left the cause open (F142, F651).
        const calls = await page?.evaluate(() => {
          const w = window as unknown as { __ORE_INFLIGHT?: string[]; __ORE_LOG?: string[]; __TAPS?: string[] };
          // A double tap's touches and the scrolls around them, in ms of the page's clock (`doubleTap`, F856).
          return `ore in flight: ${JSON.stringify(w.__ORE_INFLIGHT ?? [])}; last answered: ${JSON.stringify(w.__ORE_LOG ?? [])}${w.__TAPS ? `; last double tap: ${w.__TAPS.join(" ")}` : ""}`;
        }).catch(() => "");
        // The error's first two lines, then the end of Playwright's call log: what was in the way of a click that timed out.
        const lines = (e as Error).message.split("\n").filter((l) => l.trim());
        const log = lines.findIndex((l) => /^\s*Call log/.test(l));
        const why = [...(log < 0 ? lines : lines.slice(0, log)).slice(0, 2), ...(log < 0 ? [] : lines.slice(log + 1).slice(-4))].join("\n      ");
        console.log(`FAIL  ${name}\n      ${why}${calls ? `\n      ${calls}` : ""}${page ? `\n      screenshot: ${shot}` : ""}`);
      }
      // A call the app makes as a journey ends (Settings closing, the window taking focus back) was cut off by the
      // close, which WebKit reports as a page error "due to access control checks" (F749): the page closes once no
      // ore call has been in flight for 300 ms, or after three seconds whatever is left.
      if (page) await calm(page);
      await page?.close();
    }
    await done();
  }
  await browser.close();
  await safari?.close();
  phoneVite?.stop();
  shell?.stop(true);
  if (PHONE_LIB && !process.env.ORE_PHONE_LIBRARY) rmSync(PHONE_LIB, { recursive: true, force: true });
  // The style rules a regex can't see (nested frames, off-ramp font sizes), on a fresh library of its own.
  if (!only && !onlyFile && shard === shards) {
    const done = await library();
    const style = Bun.spawnSync(["bun", join(MOCK, "style-check.ts"), url], { env: { ...process.env, ORE_BRIDGE: String(BRIDGE) }, stdout: "inherit", stderr: "inherit" });
    if (style.exitCode !== 0) { failed++; console.log("FAIL  style-check"); } else console.log("ok    style-check");
    await done();
  }
  stop();
  if (errors.length) console.log(`page errors:\n  ${[...new Set(errors)].join("\n  ")}`);
  process.exit(failed || errors.length ? 1 : 0);
}
