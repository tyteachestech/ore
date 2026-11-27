// bun crawl.ts <lib> <tag>: master's Mac app (vite + bridge) on an old library: Home, every skill, every source
// (reader, Collected, note), Review; collects page errors, console errors and ore calls that failed.
import { chromium } from "playwright";
import { join } from "node:path";
const [lib, tag] = process.argv.slice(2) as [string, string];
const APP = "/home/user/ore/apps/desktop";
const SHOTS = join(import.meta.dir, "shots", tag);
const bridge = Bun.spawn(["bun", join(APP, "scripts/mock/bridge.ts")], { env: { ...process.env, ORE_LIBRARY: lib, PORT: "1461", ORE_NO_ENRICH: "1", ORE_AI: "none" }, stdout: "ignore", stderr: "pipe" });
const bridgeErr: string[] = [];
void (async () => { for await (const c of bridge.stderr as ReadableStream<Uint8Array>) bridgeErr.push(new TextDecoder().decode(c)); })();
await Bun.sleep(1500);
const url = "http://localhost:1460/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(8000);
const errs: string[] = [];
let where = "start";
page.on("pageerror", (e) => errs.push(`[${where}] pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errs.push(`[${where}] console: ${m.text().slice(0, 300)}`); });
page.on("response", async (r) => { if (r.url().includes(":1461") && r.status() >= 400) errs.push(`[${where}] ore ${r.status()}: ${(await r.text().catch(() => "")).slice(0, 300)} ← ${(r.request().postData() ?? "").slice(0, 160)}`); });
await page.addInitScript(`window.__ORE_BRIDGE = 1461`);
await page.addInitScript({ path: join(APP, "scripts/mock/tauri.js") });
await page.goto(url);
await page.locator(".side-item").first().waitFor({ timeout: 30000 });
await Bun.sleep(1500);
await page.screenshot({ path: join(SHOTS, "home.png") });
const step = async (name: string, f: () => Promise<unknown>) => { where = name; try { await f(); await Bun.sleep(700); } catch (e) { await page.screenshot({ path: join(SHOTS, `fail-${name.replace(/\W/g, "_")}.png`) }).catch(() => {}); errs.push(`[${name}] step failed: ${(e as Error).message.split("\n")[0]}`); } };
const skills = await page.locator(".side-item").allInnerTexts();
for (const [i, s] of skills.entries()) await step(`skill ${s.trim().slice(0, 30)}`, async () => { await page.locator(".side-item").nth(i).click(); await page.screenshot({ path: join(SHOTS, `skill-${i}.png`) }); });
await step("all sources", () => page.getByRole("button", { name: /^All sources/ }).click());
const rows = await page.locator(".row").count();
for (let i = 0; i < rows; i++) {
  await step(`source row ${i}`, async () => {
    await page.getByRole("button", { name: /^All sources/ }).click();
    const row = page.locator(".row").nth(i);
    where = `source ${(await row.innerText()).split("\n")[0]!.slice(0, 40)}`;
    await row.click();
    await page.locator(".doc-head").waitFor();
    await Bun.sleep(800);
    await page.screenshot({ path: join(SHOTS, `source-${i}.png`) });
    for (const tab of ["Collected", "Note", "Notes"]) { const t = page.getByRole("tab", { name: tab }); if (await t.count()) { await t.first().click(); await Bun.sleep(400); } }
  });
}
await step("review", async () => {
  await page.keyboard.press("Escape");
  await page.locator(".side-item").first().click();
  await Bun.sleep(1000); const sr = page.getByRole("button", { name: "Start review" }); if (await sr.count()) await sr.first().click(); else await page.keyboard.press("Meta+KeyR");
  const pick = page.getByRole("dialog", { name: "What to review" });
  await Bun.sleep(1500);
  if (await pick.isVisible()) await page.keyboard.press("Enter");
  await Bun.sleep(1500);
  await page.screenshot({ path: join(SHOTS, "review.png") });
  for (let k = 0; k < 8; k++) {
    where = `review ${k}`;
    const noIdea = page.getByRole("button", { name: "No idea" });
    const think = page.getByRole("radio", { name: "Think so" });
    if (await noIdea.isVisible()) await noIdea.click(); else if (await think.isVisible()) await think.click(); else break;
    const good = page.getByRole("button", { name: "Good", exact: true });
    await good.waitFor();
    await Bun.sleep(400);
    await good.click();
    await Bun.sleep(700);
    if (await page.locator(".review-guard").count()) { await good.click(); await Bun.sleep(700); }
  }
  await page.screenshot({ path: join(SHOTS, "review-after.png") });
  errs.push(`[review] rated through ${where}`);
});
await browser.close();
bridge.kill();
console.log(`${skills.length} skills, ${rows} sources\n` + [...new Set(errs)].join("\n") + "\n" + bridgeErr.join("").slice(0, 3000));
