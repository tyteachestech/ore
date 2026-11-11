// The release build under the release app's CSP, in WebKit (the Mac app's engine): the journeys run on the vite dev
// server in Chromium with no CSP, so what only the built app breaks (an asset inlined as data: that font-src
// refuses, 2026-11-11) passes them. Seeds a library, serves apps/desktop/dist with the exact CSP from
// src-tauri/tauri.conf.json (plus the mock bridge's origin, which the browser stand-in scripts/mock/tauri.js talks
// to over http), walks Home, a source, a skill, All sources and a review, loads every font the CSS declares, and
// fails on any CSP refusal or page error.
//   bun run --cwd apps/desktop build && bun run release:check
//   ORE_RELEASE_PORT=1632 ORE_RELEASE_MOCK_PORT=1633   the page's and the bridge's ports
import { chromium, webkit, type Browser } from "playwright";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

const APP = join(import.meta.dir, "..");
const MOCK = join(APP, "scripts/mock");
const DIST = join(APP, "dist");
const PORT = Number(process.env.ORE_RELEASE_PORT ?? 1632);
const BRIDGE = Number(process.env.ORE_RELEASE_MOCK_PORT ?? 1633);
if (!existsSync(join(DIST, "index.html"))) throw new Error(`no build at ${DIST}: run \`bun run --cwd apps/desktop build\` first`);

const bridgeOrigin = `http://localhost:${BRIDGE}`;
const conf = await Bun.file(join(APP, "src-tauri/tauri.conf.json")).json();
let csp: string = conf.app.security.csp;
for (const d of ["connect-src", "img-src", "media-src"]) {
  if (!csp.includes(`${d} 'self'`)) throw new Error(`the CSP has no "${d} 'self'" to add the bridge to: ${csp}`);
  csp = csp.replace(`${d} 'self'`, `${d} 'self' ${bridgeOrigin}`);
}

const lib = mkdtempSync(join(tmpdir(), "ore-release-"));
await $`bun ${join(MOCK, "seed.ts")} ${lib}`.quiet();
const bridge = Bun.spawn(["bun", join(MOCK, "bridge.ts")], { env: { ...process.env, ORE_LIBRARY: lib, PORT: String(BRIDGE), ORE_MOCK_AI: join(import.meta.dir, "ai"), ORE_MOCK_DELAY: "50" }, stdout: "ignore", stderr: "inherit" });
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const path = new URL(req.url).pathname;
    const file = Bun.file(join(DIST, path === "/" || path.includes("..") ? "index.html" : path));
    return (await file.exists()) ? new Response(file, { headers: { "content-security-policy": csp } }) : new Response("not found", { status: 404 });
  },
});

let browser: Browser;
let engine = "WebKit";
try {
  browser = await webkit.launch();
} catch (e) {
  // Only where WebKit can't start (a Linux box without its libraries); CI installs it for the journeys.
  console.warn(`WebKit won't start (${(e as Error).message.split("\n")[0]}); checking in Chromium instead`);
  browser = await chromium.launch();
  engine = "Chromium";
}

const problems: string[] = [];
try {
  for (let i = 0; i < 100 && !(await fetch(`${bridgeOrigin}/ore`, { method: "OPTIONS" }).then((r) => r.ok, () => false)); i++) await Bun.sleep(100);
  const page = await browser.newPage({ viewport: { width: 1180, height: 800 } });
  page.setDefaultTimeout(10000);
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy|Refused to/i.test(m.text())) problems.push(m.text().slice(0, 240));
  });
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  await page.addInitScript(`window.__ORE_BRIDGE = ${BRIDGE}`);
  await page.addInitScript({ path: join(MOCK, "tauri.js") });
  await page.goto(`http://localhost:${PORT}/`);

  await page.locator(".side-item").first().waitFor();
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.locator(".row").first().click();
  await page.locator(".doc-head").waitFor();
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.locator(".row").first().waitFor();
  await page.keyboard.press("Meta+r");
  const pick = page.getByRole("dialog", { name: "What to review" });
  const q = page.locator(".review-q");
  await pick.or(q).first().waitFor();
  if (await pick.isVisible()) await page.keyboard.press("Enter");
  await q.waitFor();
  // A font is fetched only when a glyph needs it (KaTeX's big delimiters, say), so load every one the CSS declares.
  await page.evaluate(() => Promise.allSettled([...document.fonts].map((f) => f.load())));
  await page.waitForTimeout(300);
} catch (e) {
  problems.push(`the walk broke: ${(e as Error).message.split("\n")[0]}`);
} finally {
  await browser.close();
  server.stop(true);
  bridge.kill();
  rmSync(lib, { recursive: true, force: true });
}

if (problems.length) {
  console.error(`release check (${engine}, release CSP): ${problems.length} problem(s)\n` + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log(`release check (${engine}, release CSP): Home, a source, a skill, All sources and a review load clean`);
