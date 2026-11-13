// The release build under the release app's CSP, in WebKit (the Mac app's engine): the journeys run on the vite dev
// server in Chromium with no CSP, so what only the built app breaks (an asset inlined as data: that font-src
// refuses, 2026-11-11) passes them. Seeds a library, serves apps/desktop/dist with the exact CSP from
// src-tauri/tauri.conf.json (plus the mock bridge's origin, which the browser stand-in scripts/mock/tauri.js talks
// to over http), walks Home, a source, a skill, All sources and a review, loads every font the CSS declares, and
// fails on any CSP refusal, failed load (a request, a 4xx/5xx from the page's server, a font) or page error. On CI
// WebKit must start; elsewhere it falls back to Chromium with a warning.
//   bun run --cwd apps/desktop build && bun run release:check
//   ORE_RELEASE_PORT=1632 ORE_RELEASE_MOCK_PORT=1633   the page's and the bridge's ports (free ones by default)
import { chromium, webkit, type Browser } from "playwright";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

const APP = join(import.meta.dir, "..");
const MOCK = join(APP, "scripts/mock");
const DIST = join(APP, "dist");
if (!existsSync(join(DIST, "index.html"))) throw new Error(`no build at ${DIST}: run \`bun run --cwd apps/desktop build\` first`);

/** A port nothing listens on now (the OS picks it), unless one is given. */
const freePort = (given?: string) => {
  if (given) return Number(given);
  const probe = Bun.serve({ port: 0, fetch: () => new Response() });
  const port = probe.port!;
  probe.stop(true);
  return port;
};
const BRIDGE = freePort(process.env.ORE_RELEASE_MOCK_PORT);
const bridgeOrigin = `http://localhost:${BRIDGE}`;
const conf = await Bun.file(join(APP, "src-tauri/tauri.conf.json")).json();
let csp: string = conf.app.security.csp;
for (const d of ["connect-src", "img-src", "media-src"]) {
  if (!csp.includes(`${d} 'self'`)) throw new Error(`the CSP has no "${d} 'self'" to add the bridge to: ${csp}`);
  csp = csp.replace(`${d} 'self'`, `${d} 'self' ${bridgeOrigin}`);
}

const problems: string[] = [];
let engine = "WebKit";
let lib: string | undefined;
let bridge: ReturnType<typeof Bun.spawn> | undefined;
let server: ReturnType<typeof Bun.serve> | undefined;
let browser: Browser | undefined;
let at = "the start"; // the screen the walk is on, so a timeout says where
try {
  lib = mkdtempSync(join(tmpdir(), "ore-release-"));
  await $`bun ${join(MOCK, "seed.ts")} ${lib}`.quiet();
  bridge = Bun.spawn(["bun", join(MOCK, "bridge.ts")], { env: { ...process.env, ORE_LIBRARY: lib, PORT: String(BRIDGE), ORE_MOCK_AI: join(import.meta.dir, "ai"), ORE_MOCK_DELAY: "50" }, stdout: "ignore", stderr: "inherit" });
  server = Bun.serve({
    port: Number(process.env.ORE_RELEASE_PORT ?? 0),
    async fetch(req) {
      const path = new URL(req.url).pathname;
      const file = Bun.file(join(DIST, path === "/" || path.includes("..") ? "index.html" : path));
      return (await file.exists()) ? new Response(file, { headers: { "content-security-policy": csp } }) : new Response("not found", { status: 404 });
    },
  });
  const origin = `http://localhost:${server.port}`;

  try {
    browser = await webkit.launch();
  } catch (e) {
    const why = (e as Error).message.split("\n")[0];
    // On CI WebKit is installed for the journeys, so one that won't start is a broken check, not a reason to pass in another engine.
    if (process.env.CI) throw new Error(`WebKit won't start on CI (${why}): the release check needs the Mac app's engine`);
    console.warn(`WebKit won't start (${why}); checking in Chromium instead`);
    browser = await chromium.launch();
    engine = "Chromium";
  }

  let up = false;
  for (let i = 0; i < 100 && !(up = await fetch(`${bridgeOrigin}/ore`, { method: "OPTIONS" }).then((r) => r.ok, () => false)); i++) await Bun.sleep(100);
  if (!up) throw new Error(`the mock bridge never came up on ${bridgeOrigin}`);

  const page = await browser.newPage({ viewport: { width: 1180, height: 800 } });
  page.setDefaultTimeout(10000);
  const ours = (url: string) => url.startsWith(origin) || url.startsWith(bridgeOrigin);
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy|Refused to/i.test(m.text())) problems.push(m.text().slice(0, 240));
  });
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  page.on("requestfailed", (r) => {
    if (ours(r.url())) problems.push(`failed to load ${r.url()}: ${r.failure()?.errorText ?? "?"}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && r.url().startsWith(origin)) problems.push(`${r.status()} for ${r.url()}`);
  });
  await page.addInitScript(`window.__ORE_BRIDGE = ${BRIDGE}`);
  await page.addInitScript({ path: join(MOCK, "tauri.js") });
  await page.goto(`${origin}/`);

  at = "Home";
  await page.locator(".side-item").first().waitFor();
  at = "All sources";
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.locator(".row").first().click();
  at = "a source";
  await page.locator(".doc-head").waitFor();
  at = "a skill";
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  at = "All sources again";
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.locator(".row").first().waitFor();
  at = "a review";
  await page.keyboard.press("Meta+r");
  const pick = page.getByRole("dialog", { name: "What to review" });
  const q = page.locator(".review-q");
  await pick.or(q).first().waitFor();
  if (await pick.isVisible()) await page.keyboard.press("Enter");
  await q.waitFor();
  // A font is fetched only when a glyph needs it (KaTeX's big delimiters, say), so load every one the CSS declares;
  // one that fails to load fails the check.
  const fonts = await page.evaluate(() =>
    Promise.all([...document.fonts].map((f) => f.load().then(() => null, (e: Error) => `${f.family} ${f.weight} ${f.style}: ${e.message || e.name}`))),
  );
  for (const f of fonts) if (f) problems.push(`font failed to load: ${f}`);
  await page.waitForTimeout(300);
} catch (e) {
  problems.push(`the walk broke at ${at}: ${(e as Error).message.split("\n")[0]}`);
} finally {
  await browser?.close();
  server?.stop(true);
  bridge?.kill();
  if (lib) rmSync(lib, { recursive: true, force: true });
}

if (problems.length) {
  console.error(`release check (${engine}, release CSP): ${problems.length} problem(s)\n` + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log(`release check (${engine}, release CSP): Home, a source, a skill, All sources and a review load clean`);
