// Lints the rendered app against DESIGN.md's style rules, which a regex over CSS can't see:
//   nested frames   a box (visible edge or its own fill) inside another box on the page; only floating layers may nest
//   off-ramp text   a computed UI font size outside the DESIGN.md ramp (reading text has its own scale)
// Run against the mock (scripts/mock/README.md): bun apps/desktop/scripts/mock/style-check.ts [http://localhost:1420/]
import { chromium, type Page } from "playwright";

const RAMP = [11, 12, 13, 14, 15, 16, 17, 20, 24, 28, 30];
const url = process.argv[2] ?? "http://localhost:1420/";

async function audit(page: Page, screen: string) {
  const found = await page.evaluate((ramp) => {
    const out: string[] = [];
    const name = (el: Element) => el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : "");
    const floats = (el: Element) => !!el.closest('[role="dialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], .popover, .panel, .toast, .popup');
    const isBox = (el: Element) => {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") return false;
      const r = el.getBoundingClientRect();
      if (r.width < 120 || r.height < 40) return false; // controls, chips and rows are not boxes
      const edges = ["Top", "Right", "Bottom", "Left"].filter((side) => parseFloat(s.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0 && s.getPropertyValue(`border-${side.toLowerCase()}-style`) !== "none").length;
      const inset = /inset/.test(s.boxShadow) && !/inset\s+\d+px\s+0/.test(s.boxShadow);
      return edges >= 3 || inset;
    };
    for (const el of document.querySelectorAll("main *, .app *")) {
      if (!isBox(el) || floats(el)) continue;
      let up = el.parentElement;
      while (up && up !== document.body) {
        if (isBox(up) && !floats(up)) { out.push(`nested frame: ${name(el)} inside ${name(up)}`); break; }
        up = up.parentElement;
      }
    }
    const sizes = new Map<string, number>();
    for (const el of document.querySelectorAll("body *")) {
      if (el.closest(".doc, .note-editor")) continue; // reading text has its own em-based scale
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) continue;
      const px = parseFloat(getComputedStyle(el).fontSize);
      if (!ramp.includes(Math.round(px * 2) / 2)) { const k = `${px}px ${name(el)}`; sizes.set(k, (sizes.get(k) ?? 0) + 1); }
    }
    for (const [k] of sizes) out.push(`off-ramp text: ${k}`);
    return [...new Set(out)];
  }, RAMP);
  for (const f of found) console.log(`${screen}  ${f}`);
  return found.length;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript({ path: new URL("./tauri.js", import.meta.url).pathname });
await page.goto(url);
await page.waitForTimeout(1500);
let n = await audit(page, "home");
await page.locator(".sidebar .side-item:not(.side-main)").first().click();
await page.waitForTimeout(1200);
n += await audit(page, "skill");
await page.locator(".skill-page .list .row").first().click();
await page.waitForTimeout(1500);
n += await audit(page, "reader");
await browser.close();
console.log(n ? `${n} findings` : "clean");
process.exit(n ? 1 : 0);
