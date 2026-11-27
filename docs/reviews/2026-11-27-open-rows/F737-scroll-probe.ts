// F737 probe on the built app: first scroll of a 640 KB book while it mounts, worst frames.
// Run: bun run --cwd apps/desktop build, then bun <this file>. Before #(this PR): 4 to 9 frames over 50 ms (worst 250); after: 1 to 3 (worst ~110).
import { chromium, webkit } from "playwright";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";
const APP = "/home/user/ore/apps/desktop", MOCK = join(APP, "scripts/mock"), DIST = join(APP, "dist");
const BRIDGE = 1733;
const lib = mkdtempSync(join(tmpdir(), "ore-probe-"));
await $`bun ${join(MOCK, "seed.ts")} ${lib}`.quiet();
const bridge = Bun.spawn(["bun", join(MOCK, "bridge.ts")], { env: { ...process.env, ORE_LIBRARY: lib, PORT: String(BRIDGE), ORE_MOCK_DELAY: "0" }, stdout: "ignore", stderr: "inherit" });
const server = Bun.serve({ port: 0, async fetch(req) { const p = new URL(req.url).pathname; const f = Bun.file(join(DIST, p === "/" || p.includes("..") ? "index.html" : p)); return (await f.exists()) ? new Response(f) : new Response("nf", { status: 404 }); } });
for (let i = 0; i < 100 && !(await fetch(`http://localhost:${BRIDGE}/ore`, { method: "OPTIONS" }).then((r) => r.ok, () => false)); i++) await Bun.sleep(100);
const title = process.env.T ?? "Probe book";
const para = (i: number) => `Chapter text ${i}: the *testing effect* shows that **retrieval** strengthens memory, and a [link](https://example.com/${i}) sits here with \`code\` beside it; spacing the reviews over days works better than massing them in one sitting, as many studies found.`;
let md = `# ${title}\n\n`;
for (let c = 1; md.length < Number(process.env.SIZE ?? 640_000); c++) { md += `## Chapter ${c}\n\n`; for (let p = 0; p < 30; p++) md += para(c * 100 + p) + "\n\n"; }
md += "The very last line.\n"; const LAST = "The very last line.";
await fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich", "--json"], stdin: md }) });
for (const [name, type] of [["chromium", chromium], ["webkit", webkit]] as const) {
  const browser = await type.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(`window.__ORE_BRIDGE = ${BRIDGE}`);
  await page.addInitScript({ path: join(MOCK, "tauri.js") });
  for (let run = 0; run < 3; run++) {
    await page.goto(`http://localhost:${server.port}/`);
    await page.getByRole("button", { name: /^All sources/ }).click();
    await page.locator(".row").filter({ hasText: title }).first().click();
    await page.evaluate(() => { const w = window as any; w.__loaf = []; new PerformanceObserver((l) => { for (const e of l.getEntries() as any[]) w.__loaf.push({ t: Math.round(e.startTime), d: Math.round(e.duration), block: Math.round(e.blockingDuration), render: Math.round(e.renderStart ? e.startTime + e.duration - e.renderStart : 0), style: Math.round(e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0), scripts: e.scripts.map((s: any) => `${Math.round(s.duration)}ms ${s.invoker} ${s.sourceFunctionName}@${(s.sourceURL||'').split('/').pop()}:${s.sourceCharPosition} fl${Math.round(s.forcedStyleAndLayoutDuration)}`) }); }).observe({ type: "long-animation-frame", buffered: false }); });
    await page.locator(".reader .doc p").first().waitFor();
    await page.evaluate(() => { const w = window as any; w.__gaps = []; let last = performance.now(); const tick = (t: number) => { w.__gaps.push(t - last); last = t; if (w.__gaps.length < 300) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
    const doc = (await page.locator(".reader .doc").boundingBox())!;
    await page.mouse.move(doc.x + 100, doc.y + 200);
    for (let i = 0; i < 100; i++) { await page.mouse.wheel(0, 60); await page.waitForTimeout(16); }
    if (process.env.LOAF && run === 2) console.log(JSON.stringify(await page.evaluate(() => (window as any).__loaf.filter((e: any) => e.d > 90)), null, 1));
    const g = (await page.evaluate(() => (window as any).__gaps)) as number[];
    const t0 = Date.now(); await page.locator(".reader .doc").getByText(LAST).waitFor({ state: "attached", timeout: 120000 }); const tail = Date.now() - t0;
    const s = [...g].sort((a, b) => b - a);
    console.log(`${name} run ${run}: worst ${s.slice(0, 5).map((x) => x.toFixed(0)).join(",")}, over 50ms: ${g.filter((x) => x > 50).length}, whole ${tail}ms after the scroll`);
  }
  await browser.close();
}
bridge.kill(); server.stop(); process.exit(0);
