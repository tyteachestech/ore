// End-to-end journeys: the app in a real browser against a seeded scratch library, through the real
// `ore` CLI (scripts/mock), doing what Tyler does every day. Unit tests check the parts; these check
// that the parts still work together on screen (note saves across switches, undo, review).
//   bun run e2e                      seeds, starts the bridge and vite, runs every journey
//   bun run e2e -- highlight         only journeys whose name contains "highlight"
//   E2E_URL=http://localhost:1420/   use a mock already running (scripts/mock/README.md) instead
import { chromium, type Page } from "playwright";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

const MOCK = join(import.meta.dir, "../scripts/mock");
const BRIDGE = process.env.E2E_URL ? Number(process.env.E2E_BRIDGE ?? 1421) : 1451;
const only = process.argv[2];

async function start(): Promise<{ url: string; stop: () => void }> {
  if (process.env.E2E_URL) return { url: process.env.E2E_URL, stop: () => {} };
  const lib = mkdtempSync(join(tmpdir(), "ore-e2e-"));
  await $`bun ${join(MOCK, "seed.ts")} ${lib}`.quiet();
  // Ports of their own, so a mock left running for screenshots (1420, 1421) never answers instead.
  const bridge = Bun.spawn(["bun", join(MOCK, "bridge.ts")], { env: { ...process.env, ORE_LIBRARY: lib, PORT: String(BRIDGE), ORE_MOCK_AI: join(import.meta.dir, "ai"), ORE_MOCK_DELAY: "50" }, stdout: "ignore", stderr: "inherit" });
  const vite = Bun.spawn(["bunx", "vite", "--port", "1450", "--strictPort"], { cwd: join(import.meta.dir, ".."), stdout: "ignore", stderr: "ignore" });
  const url = "http://localhost:1450/";
  for (let i = 0; i < 100; i++) {
    if (await fetch(url).then((r) => r.ok, () => false)) break;
    await Bun.sleep(200);
  }
  return { url, stop: () => (bridge.kill(), vite.kill()) };
}

async function open(url: string): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(8000);
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(`window.__ORE_BRIDGE = ${BRIDGE}`);
  await page.addInitScript({ path: join(MOCK, "tauri.js") });
  await page.goto(url);
  await page.locator(".side-item").first().waitFor();
  return page;
}

const errors: string[] = [];
const { url, stop } = await start();
const browser = await chromium.launch();
const journeys: [string, (page: Page) => Promise<void>][] = [];
const journey = (name: string, run: (page: Page) => Promise<void>) => journeys.push([name, run]);

const TESTING = "The Testing Effect: Why Retrieval Beats Rereading";
const AGENTS = "Building Effective Agents";

/** Opens a source from All sources, by its title. */
async function openSource(page: Page, title: string) {
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.locator(".row").filter({ hasText: title }).first().click();
  await page.locator(".doc-head").filter({ hasText: title }).waitFor();
}

/** Drags across a phrase in the reader, as he selects with the mouse. */
async function select(page: Page, phrase: string) {
  const box = await page.evaluate((phrase) => {
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
      return { x1: a.left + 1, y1: a.top + a.height / 2, x2: z.right - 1, y2: z.top + z.height / 2 };
    }
    return null;
  }, phrase);
  if (!box) throw new Error(`“${phrase}” is not in the reader`);
  await page.mouse.move(box.x1, box.y1);
  await page.mouse.down();
  await page.mouse.move(box.x2, box.y2, { steps: 5 });
  await page.mouse.up();
}

/** Waits until a check holds, for a step that saves in the background. */
async function until(what: string, ok: () => Promise<boolean>, ms = 5000) {
  for (const end = Date.now() + ms; Date.now() < end; await Bun.sleep(100)) if (await ok()) return;
  throw new Error(`timed out: ${what}`);
}

// —— journeys ——

journey("add pasted text: it opens in the reader", async (page) => {
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill("# Interleaving in practice\n\nMixing problem types forces you to choose a strategy each time, which is what a test asks of you. Blocked practice feels smoother but teaches less.");
  await page.keyboard.press("Enter");
  await page.locator(".doc").getByText("Mixing problem types forces you").waitFor();
});

journey("highlight: it shows, survives a reload, and ⌘Z takes it back", async (page) => {
  await openSource(page, TESTING);
  const keeps = page.locator(".collected-chip.keep");
  const before = Number(await keeps.innerText());
  await select(page, "Each successful retrieval changes the memory itself");
  await page.getByRole("dialog", { name: "Highlight" }).waitFor();
  await until("the Keep count goes up", async () => Number(await keeps.innerText()) === before + 1);
  await page.keyboard.press("Enter"); // keeps it (Esc would drop a fresh one)
  await page.keyboard.press("Meta+z");
  await until("⌘Z removes it", async () => Number(await keeps.innerText()) === before);
  await page.keyboard.press("Meta+Shift+z");
  await until("⇧⌘Z puts it back", async () => Number(await keeps.innerText()) === before + 1);
  await page.reload();
  await openSource(page, TESTING);
  await until("it is still there after a relaunch", async () => Number(await keeps.innerText()) === before + 1);
});

journey("author: add one by hand from the title's menu, it survives a reload, and ⌘Z takes it back", async (page) => {
  await openSource(page, TESTING);
  await page.locator(".doc-head h1").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Add author…" }).click();
  await page.getByLabel("Author").fill("Henry Roediger");
  await page.keyboard.press("Enter");
  const by = page.locator(".doc-head .by");
  await by.filter({ hasText: "Henry Roediger" }).waitFor();
  await page.keyboard.press("Meta+z");
  await until("⌘Z removes it", async () => (await by.count()) === 0);
  await page.keyboard.press("Meta+Shift+z");
  await by.filter({ hasText: "Henry Roediger" }).waitFor();
  await page.reload();
  await openSource(page, TESTING);
  await by.click(); // the byline edits in place
  await page.getByLabel("Author").fill("Roediger & Karpicke");
  await page.keyboard.press("Enter");
  await by.filter({ hasText: "Roediger & Karpicke" }).waitFor();
});

journey("source note: what he types is kept when he switches sources and comes back", async (page) => {
  const line = `Start simple, add steps only when they pay (${Date.now() % 100000}).`;
  const shows = (when: string) => until(`the note keeps the line ${when}`, () => page.locator(".note-editor").getByText(line).isVisible());
  await openSource(page, AGENTS);
  await page.locator(".note-editor [contenteditable=true]").first().click();
  await page.keyboard.type(line);
  await shows("as he types");
  await openSource(page, TESTING); // switch away at once, before any save delay
  await openSource(page, AGENTS);
  await shows("after switching away and back");
  await page.reload();
  await openSource(page, AGENTS);
  await shows("after a relaunch");
});

journey("diagram: draws beside the source, and a new one stays linked when the panel switches tab", async (page) => {
  await openSource(page, AGENTS);
  const note = page.locator(".note-editor [contenteditable=true]").first();
  // Typed into the reader instead, "/diagram" would run its keys (A archives the source).
  await until("the note takes the caret", async () => (await note.click(), await note.evaluate((e) => e.contains(document.activeElement))));
  await page.keyboard.press("Meta+ArrowDown");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/diagram");
  await page.locator(".note-menu-row.on").filter({ hasText: "Diagram" }).waitFor();
  await page.keyboard.press("Enter");
  const docked = page.locator(".diagram.docked");
  await docked.waitFor();
  await until("the source stays in view beside it", () => page.locator(".doc").isVisible());
  const canvas = await docked.locator(".draw").boundingBox();
  await docked.locator(".draw").focus();
  await page.keyboard.press("r");
  await page.mouse.move(canvas!.x + 260, canvas!.y + 520);
  await page.mouse.down();
  await page.mouse.move(canvas!.x + 420, canvas!.y + 600, { steps: 5 });
  await page.mouse.up();
  await until("the note links it once it is saved", () => page.locator(".note-editor .note-diagram").count().then((n) => n === 1), 6000);
  await page.getByRole("tab", { name: "Collected" }).click(); // closes the drawing without Done
  await page.getByRole("tab", { name: "Source note" }).click();
  await until("the link is still in the note", async () => (await page.locator(".note-editor .note-diagram svg").count()) === 1);
  await page.locator(".note-editor .note-diagram").click();
  await docked.waitFor();
  await page.keyboard.press("Shift+Meta+Enter");
  await page.locator(".diagram:not(.docked)").waitFor();
  await page.keyboard.press("Escape");
  await until("Esc closes it", async () => (await page.locator(".diagram").count()) === 0);
});

journey("review: rate a card, the session moves on, and Undo brings the card back", async (page) => {
  await page.getByRole("button", { name: "Start review" }).click();
  // The "What to review" sheet comes first once Home knows his skills; Enter takes them all.
  const pick = page.getByRole("dialog", { name: "What to review" });
  const q = page.locator(".review-q");
  await pick.or(q).first().waitFor();
  if (await pick.isVisible()) await page.keyboard.press("Enter");
  await q.waitFor();
  const first = await q.innerText();
  const session = page.locator(".review [role=progressbar]").first();
  const done = async () => Number(await session.getAttribute("aria-valuenow"));
  const before = await done();
  // A card asks how sure he is, then shows the answer; a question asks for his answer first.
  await page.getByRole("radio", { name: "Think so" }).or(page.getByRole("button", { name: "No idea" })).first().click();
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await until("the session counts the rating", async () => (await done()) === before + 1);
  await page.getByRole("button", { name: "Undo last rating" }).click();
  await until("Undo puts the first card back", async () => (await done()) === before && (await q.innerText()) === first);
});

journey("archive a source from its row, then Undo from the toast", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  const row = page.locator(".row").filter({ hasText: AGENTS }).first();
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: /Archive/ }).click();
  await until("the row leaves the list", async () => !(await row.isVisible()));
  await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
  await row.waitFor();
});

journey("quiz check: one click makes a passage a key point, and marks a highlight already there", async (page) => {
  await openSource(page, TESTING);
  // A chip shows only while its count is above 0.
  const count = async (kind: string) => Number((await page.locator(`.collected-chip.${kind}`).allInnerTexts())[0] ?? 0);
  const [card0, keep0] = [await count("card"), await count("keep")];
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Skip to questions" }).click();
  await page.getByLabel("Your answer").fill("It feels familiar");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  const key = page.locator(".quiz-stepper").getByRole("button", { name: "Key point" });
  // Passage 1 is plain text: it becomes a new key point.
  await until("the first passage is not a key point yet", async () => (await key.getAttribute("aria-pressed")) === "false");
  await key.click();
  await until("it shows as a key point", async () => (await key.getAttribute("aria-pressed")) === "true");
  // Passage 2 is a highlight he already made: it is marked, not doubled.
  await page.getByRole("button", { name: "Next passage" }).click();
  await until("the second passage is not a key point yet", async () => (await key.getAttribute("aria-pressed")) === "false");
  await key.click();
  await until("it shows as a key point", async () => (await key.getAttribute("aria-pressed")) === "true");
  await page.getByRole("button", { name: "Close quiz" }).click();
  // The highlight already there was marked, not doubled: one plain highlight fewer.
  await until("two more key points, one fewer plain highlight", async () => (await count("card")) === card0 + 2 && (await count("keep")) === keep0 - 1);
  await page.keyboard.press("Meta+z");
  await until("⌘Z takes the mark back", async () => (await count("card")) === card0 + 1 && (await count("keep")) === keep0);
});

// —— run ——

let failed = 0;
for (const [name, run] of journeys) {
  if (only && !name.includes(only)) continue;
  const page = await open(url);
  const t0 = Date.now();
  try {
    await run(page);
    console.log(`ok    ${name} (${Date.now() - t0} ms)`);
  } catch (e) {
    failed++;
    const shot = join(tmpdir(), `ore-e2e-${name.replace(/\W+/g, "-")}.png`);
    await page.screenshot({ path: shot }).catch(() => {});
    const why = (e as Error).message.split("\n").filter((l) => l.trim() && !/^\s*Call log/.test(l)).slice(0, 2).join("\n      ");
    console.log(`FAIL  ${name}\n      ${why}\n      screenshot: ${shot}`);
  }
  await page.close();
}
await browser.close();
stop();
if (errors.length) console.log(`page errors:\n  ${[...new Set(errors)].join("\n  ")}`);
process.exit(failed || errors.length ? 1 : 0);
