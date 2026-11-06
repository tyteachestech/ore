// A/B lab: shoots one screen of the mock app as it is and with each option's CSS laid over it, so a look can be
// picked from screenshots before anything is built (DESIGN.md "Style rules").
//   bun apps/desktop/scripts/mock/ab.ts <out-dir> <screen> [--crop <selector>] [<name>=<file.css> ...]
// <screen>: home, skill:<Skill name>, or reader (the skill page's first source). Writes <name>.png at 2× (his
// Retina screen) and, with --crop, <name>-crop.png at 4× of the first matching element. "now" is always shot.
import { chromium, type Page } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const [out, screen, ...rest] = process.argv.slice(2);
if (!out || !screen) throw new Error("usage: ab.ts <out-dir> <screen> [--crop <selector>] [<name>=<file.css> ...]");
const at = rest.indexOf("--crop");
const crop = at >= 0 ? rest.splice(at, 2)[1] : undefined;
const options: [string, string][] = [["now", ""], ...rest.map((a) => a.split("=") as [string, string]).map(([n, f]): [string, string] => [n, readFileSync(f, "utf8")])];
mkdirSync(out, { recursive: true });

// The lab stylesheet stays last in <head>, or Vite's dev styles injected later would win.
const layer = (css: string) => `document.addEventListener("DOMContentLoaded", () => {
  const s = document.createElement("style"); s.id = "ab-lab"; s.textContent = ${JSON.stringify(css)};
  const add = () => document.head.lastElementChild !== s && document.head.appendChild(s);
  add(); new MutationObserver(add).observe(document.head, { childList: true });
});`;

async function open(page: Page, css: string) {
  await page.addInitScript({ path: new URL("./tauri.js", import.meta.url).pathname });
  if (css) await page.addInitScript(layer(css));
  await page.goto(process.env.URL ?? "http://localhost:1420/");
  await page.waitForTimeout(1500);
  if (screen.startsWith("skill:") || screen === "reader") {
    const name = screen.slice(6);
    await (name ? page.locator(".sidebar .side-item", { hasText: name }) : page.locator(".sidebar .side-item:not(.side-main)")).first().click();
    await page.waitForTimeout(1200);
  }
  if (screen === "reader") {
    await page.locator(".skill-page .list .row").first().click();
    await page.waitForTimeout(1500);
  }
}

const browser = await chromium.launch();
for (const [name, css] of options) {
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1280, height: 800 } });
  await open(page, css);
  await page.screenshot({ path: `${out}/${name}.png` });
  if (crop) {
    const zoom = await browser.newPage({ deviceScaleFactor: 4, viewport: { width: 1280, height: 800 } });
    await open(zoom, css);
    await zoom.locator(crop).first().screenshot({ path: `${out}/${name}-crop.png` });
    await zoom.close();
  }
  await page.close();
  console.log(`${out}/${name}.png`);
}
await browser.close();
