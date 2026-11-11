// Launches each named browser once, headless, and closes it: exit 1 if one won't start (a missing system
// package, a browser build the cache doesn't hold). `bun launch.ts chromium webkit`.
import { chromium, firefox, webkit } from "playwright";

const all = { chromium, firefox, webkit };
for (const name of process.argv.slice(2)) {
  const type = all[name as keyof typeof all];
  if (!type) throw new Error(`no such browser: ${name}`);
  const browser = await type.launch();
  const page = await browser.newPage();
  await page.setContent("<p>ok</p>");
  await browser.close();
  console.log(`${name} starts`);
}
