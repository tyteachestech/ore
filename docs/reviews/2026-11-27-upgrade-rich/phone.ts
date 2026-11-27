// bun phone.ts <lib> <tag>: master's iPhone build on an old library in WebKit at 390 pt: Today, Sources, every
// source, a review; page errors and failed requests.
import { chromium } from "playwright";
import { join } from "node:path";
const [lib, tag] = process.argv.slice(2) as [string, string];
const SHOTS = join(import.meta.dir, "shots", tag);
const vite = Bun.spawn(["bunx", "vite", "--port", "1470", "--strictPort"], { cwd: "/home/user/ore/apps/desktop", env: { ...process.env, ORE_PHONE: "1", ORE_PHONE_LIBRARY: lib }, stdout: "ignore", stderr: "pipe" });
const url = "http://localhost:1470/";
for (let i = 0; i < 300 && !(await fetch(url).then((r) => r.ok, () => false)); i++) await Bun.sleep(200);
const browser = await chromium.launch();
const errs: string[] = [];
let where = "start";
const open = async () => {
  const page = await browser.newPage({ hasTouch: true, isMobile: true, deviceScaleFactor: 1, viewport: { width: 390, height: 844 }, colorScheme: "dark" });
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e) => errs.push(`[${where}] pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errs.push(`[${where}] console: ${m.text().slice(0, 300)}`); });
  page.on("response", (r) => { if (r.status() >= 400) errs.push(`[${where}] ${r.status()} ${r.url().slice(0, 200)}`); });
  await page.addInitScript(`window.__TAURI_INTERNALS__ ??= { convertFileSrc: (p) => "/library-file" + p, transformCallback: () => 0, invoke: () => Promise.reject(new Error("no Tauri here")) }`);
  await page.goto(url);
  await page.locator(".phone-app").waitFor({ timeout: 60000 });
  await page.locator(".phone-opening").waitFor({ state: "detached", timeout: 60000 });
  return page;
};
await (await open()).close(); // vite bundles on the first load
const page = await open();
await Bun.sleep(1500);
await page.screenshot({ path: join(SHOTS, "phone-today.png") });
const step = async (name: string, f: () => Promise<unknown>) => { where = name; try { await f(); await Bun.sleep(600); } catch (e) { await page.screenshot({ path: join(SHOTS, `phone-fail-${name.replace(/\W/g, "_")}.png`) }).catch(() => {}); errs.push(`[${name}] step failed: ${(e as Error).message.split("\n")[0]}`); } };
const titles = ["Retrieval practice: notes", "Forgetting curve", "Watching a seed sprout", "Introducing NumPy", "Learning", "AI"];
for (const t of titles)
  await step(`phone ${t}`, async () => {
    const pg = await open();
    await pg.getByText(t, { exact: true }).first().tap();
    await Bun.sleep(1500);
    await pg.screenshot({ path: join(SHOTS, `phone-${t.replace(/\W/g, "_")}.png`) });
    await pg.close();
  });
const rows = titles.length;
await browser.close();
vite.kill();
console.log(`${rows} rows\n` + [...new Set(errs)].join("\n"));
