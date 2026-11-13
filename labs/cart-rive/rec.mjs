// Records the stage page frame by frame at 25 fps: node rec.mjs <outdir> [query]
//   query "film=film/" (default) plays the headless captures; "runtime=vendor/lite/" plays the .riv in the web
//   runtime, with the browser's clock stepped 40 ms a frame.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)), out = path.resolve(process.argv[2] ?? "out/page"), query = process.argv[3] ?? "film=film/";
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".wasm": "application/wasm", ".riv": "application/octet-stream" };
const server = http.createServer((req, res) => { const f = path.join(HERE, decodeURIComponent(req.url.split("?")[0])); fs.readFile(f, (e, b) => (e ? res.writeHead(404).end() : res.writeHead(200, { "content-type": types[path.extname(f)] ?? "application/octet-stream" }).end(b))); }).listen(0);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const live = !query.includes("film=");
await page.goto(`http://localhost:${server.address().port}/stage/index.html?${query}&manual`);

await page.waitForFunction(() => window.cart && (window.cart.seek || window.cart.ready));
const end = await page.evaluate(() => cart.end);
for (let n = 0; n <= Math.round(end * 25); n++) {
  if (live) await page.evaluate(() => cart.step(40)); else await page.evaluate((t) => cart.seek(t), n / 25);
  await page.screenshot({ path: path.join(out, `f${String(n).padStart(3, "0")}.png`) });
}
console.log(Math.round(end * 25) + 1, "frames");
await browser.close(); server.close();
