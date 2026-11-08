// End-to-end journeys: the app in a real browser against a seeded scratch library, through the real
// `ore` CLI (scripts/mock), doing what Tyler does every day. Unit tests check the parts; these check
// that the parts still work together on screen (note saves across switches, undo, review).
//   bun run e2e                      seeds, starts the bridge and vite, runs every journey
//   bun run e2e -- highlight         only journeys whose name contains "highlight"
//   E2E_URL=http://localhost:1420/   use a mock already running (scripts/mock/README.md) instead
//   ORE_E2E_PORT=1490 ORE_E2E_MOCK_PORT=1491   vite's and the bridge's ports (1450, 1451), so runs side by side don't answer each other
import { chromium, type Page } from "playwright";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

const MOCK = join(import.meta.dir, "../scripts/mock");
const FIXTURES = join(import.meta.dir, "../../../packages/core/test/fixtures/intake/files");
const PORT = Number(process.env.ORE_E2E_PORT ?? 1450);
const BRIDGE = process.env.E2E_URL ? Number(process.env.E2E_BRIDGE ?? 1421) : Number(process.env.ORE_E2E_MOCK_PORT ?? 1451);
const only = process.argv[2];
/** The seeded library (or, against a mock already running, $ORE_LIBRARY): for state no `ore` command makes. */
let LIB = process.env.ORE_LIBRARY ?? "";

async function start(): Promise<{ url: string; stop: () => void }> {
  if (process.env.E2E_URL) return { url: process.env.E2E_URL, stop: () => {} };
  const lib = (LIB = mkdtempSync(join(tmpdir(), "ore-e2e-")));
  await $`bun ${join(MOCK, "seed.ts")} ${lib}`.quiet();
  // The table and formula reader (D125) stands in as a script that writes Docling's saved reading of tables.pdf.
  const docling = join(lib, ".ore", "docling");
  writeFileSync(docling, `#!/bin/sh\nsleep 1\nwhile [ "$1" != "--output" ]; do shift; done\ncp "${FIXTURES}/tables.docling.json" "$2/tables.json"\n`);
  chmodSync(docling, 0o755);
  // Ports of their own, so a mock left running for screenshots (1420, 1421) never answers instead.
  const bridge = Bun.spawn(["bun", join(MOCK, "bridge.ts")], { env: { ...process.env, ORE_LIBRARY: lib, ORE_DOCLING: docling, PORT: String(BRIDGE), ORE_MOCK_AI: join(import.meta.dir, "ai"), ORE_MOCK_DELAY: "50", ORE_MOCK_ENRICH: "1" }, stdout: "ignore", stderr: "inherit" });
  const vite = Bun.spawn(["bunx", "vite", "--port", String(PORT), "--strictPort"], { cwd: join(import.meta.dir, ".."), stdout: "ignore", stderr: "ignore" });
  const url = `http://localhost:${PORT}/`;
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

journey("Home: today's minutes are the big number, and the goal ring stands unframed", async (page) => {
  await page.locator(".home-goal h1 .roll").waitFor();
  const look = await page.evaluate(() => {
    const css = (sel: string) => getComputedStyle(document.querySelector(sel)!);
    return { minutes: css(".home-goal h1 .roll").fontSize, unit: css(".home-goal h1 > span:not(.roll)").fontSize, ring: css(".home-goal .ring").boxShadow };
  });
  if (look.minutes !== "24px" || look.unit !== "15px") throw new Error(`goal number ${look.minutes}, unit ${look.unit}`);
  if (look.ring !== "none") throw new Error(`goal ring framed: ${look.ring}`);
});

journey("Home: a source whose doc.md can't be read gets one quiet line that shows it in Finder; gone, the line goes (files-10)", async (page) => {
  const items = (await ore("ls")) as { dir: string }[];
  // A folder of its own, so no other journey's source is touched; cut-off frontmatter, as a crash mid-write leaves.
  const dir = join(items[0]!.dir, "..", "broken-01JZZZZZZZZZZZZZZZZZZZZZZZ");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "doc.md"), "---\nid: [cut off\n");
  try {
    await page.reload();
    const line = page.getByRole("button", { name: "1 source couldn’t be read" });
    await line.waitFor();
    await line.hover();
    await page.locator(".hint", { hasText: "Show it in Finder" }).waitFor();
    await line.click();
    await until("the folder shown in Finder", () => page.evaluate((d) => JSON.stringify((window as unknown as { __ORE_REVEALED?: string[] }).__ORE_REVEALED) === JSON.stringify([`${d}/doc.md`]), dir));
    rmSync(dir, { recursive: true, force: true });
    await page.reload();
    await page.locator(".home-goal h1").waitFor();
    await until("the line gone with the folder", async () => !(await line.isVisible()));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

journey("add pasted text: it opens in the reader", async (page) => {
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill("# Interleaving in practice\n\nMixing problem types forces you to choose a strategy each time, which is what a test asks of you. Blocked practice feels smoother but teaches less.");
  await page.keyboard.press("Enter");
  await page.locator(".doc").getByText("Mixing problem types forces you").waitFor();
});

journey("add: File keeps what he typed in the box; cancelling the picker keeps it too, and picked files join it", async (page) => {
  await page.getByRole("button", { name: "+ Add" }).click();
  const box = page.getByLabel("Link, file path or text");
  await box.fill("https://example.com/a-link");
  await page.getByRole("button", { name: "File", exact: true }).click();
  await page.waitForTimeout(200);
  if ((await box.inputValue()) !== "https://example.com/a-link") throw new Error("cancelling the picker lost the box"); // cancelled: the box and its text stay
  await page.evaluate(() => ((window as unknown as { __ORE_PICK: string[] }).__ORE_PICK = ["/tmp/paper.pdf"]));
  await box.focus();
  await page.keyboard.press("Meta+o");
  await until("the picked file joins the box", async () => (await box.inputValue()) === "https://example.com/a-link\n/tmp/paper.pdf");
  await page.keyboard.press("Escape");
});

journey("Add, Settings and What to review: Tab and ⇧Tab stay inside the panel, as a Mac sheet's do", async (page) => {
  const inside = (sel: string) => page.evaluate((sel) => !!document.activeElement?.closest(sel), sel);
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").waitFor();
  for (let n = 0; n < 8; n++) {
    await page.keyboard.press("Shift+Tab");
    if (!(await inside(".add-box"))) throw new Error(`⇧Tab ${n + 1} left the Add box`);
  }
  await page.keyboard.press("Escape");
  await page.keyboard.press("Meta+Comma");
  await page.locator(".settings-sheet").waitFor();
  for (let n = 0; n < 40; n++) {
    await page.keyboard.press("Tab");
    if (!(await inside(".settings-sheet"))) throw new Error(`Tab ${n + 1} left Settings`);
  }
  // One Esc closes the sheet, even with the hint Tab opened on a control showing.
  await page.keyboard.press("Escape");
  await page.locator(".settings-sheet").waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Start review" }).click();
  const pick = page.getByRole("dialog", { name: "What to review" });
  await pick.waitFor();
  await pick.getByRole("checkbox").first().focus();
  for (let n = 0; n < 12; n++) {
    await page.keyboard.press(n % 2 ? "Tab" : "Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    if (!(await inside(".review-pick"))) throw new Error(`Tab left What to review`);
  }
  await page.keyboard.press("Escape");
});

journey("review: Tab and ⇧Tab stay on the card, never in the sidebar or sources hidden behind it", async (page) => {
  const inside = () => page.evaluate(() => !!document.activeElement?.closest(".review"));
  await page.getByRole("button", { name: "Start review" }).click();
  await page.getByRole("dialog", { name: "What to review" }).waitFor();
  await page.keyboard.press("Enter");
  await page.locator(".review-q").waitFor();
  for (let n = 0; n < 12; n++) {
    await page.keyboard.press(n < 6 ? "Tab" : "Shift+Tab");
    if (!(await inside())) throw new Error(`${n < 6 ? "Tab" : "⇧Tab"} ${n + 1} left the review for ${await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80))}`);
  }
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("add a list where one fails: ⌘Z still takes back the ones that went in", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  const rows = page.locator(".row");
  await rows.first().waitFor();
  const before = await rows.count();
  await page.getByRole("button", { name: "+ Add" }).click();
  const box = page.getByLabel("Link, file path or text");
  await box.fill(`${FIXTURES}/obsidian-note.md\n/tmp/ore-e2e-no-such-file.pdf`);
  await page.keyboard.press("Enter");
  await page.locator(".add-box").getByText("Added 1 of 2", { exact: false }).waitFor({ timeout: 15000 });
  await page.keyboard.press("Escape");
  await until("the one that went in is listed", async () => (await rows.count()) === before + 1);
  await page.keyboard.press("Meta+z");
  await until("⌘Z takes it back", async () => (await rows.count()) === before);
});

journey("PDF footnote: its mark shows the note on hover, and bold stays bold", async (page) => {
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill(join(import.meta.dir, "../../../packages/core/test/fixtures/intake/files/hazards.pdf"));
  await page.keyboard.press("Enter");
  const doc = page.locator(".doc");
  await doc.getByText("habits matter as much as reasons", { exact: false }).waitFor();
  await doc.locator("strong", { hasText: "remember" }).waitFor();
  await doc.locator("a.fn").first().hover();
  await page.locator(".tip.note").getByText("We are not suggesting that people are irrational").waitFor();
  await page.mouse.move(5, 5);
  await page.locator(".tip.note").waitFor({ state: "detached" });
});

journey("footnote: a long note's hover preview shows all of it (only a highlight note's is cut to six lines)", async (page) => {
  const note = "The note goes on at length, as a book's notes do, so the preview has to hold every line of it. ".repeat(9) + "The last words.";
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill(`# Notes at length\n\nA claim that needs a note.[^1] Then more text.\n\n[^1]: ${note}\n`);
  await page.keyboard.press("Enter");
  await page.locator(".doc a.fn").first().hover();
  const tip = page.locator(".tip.note");
  await tip.getByText("The last words.", { exact: false }).waitFor();
  const cut = await tip.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
  if (cut) throw new Error("the footnote's preview is cut short");
});

journey("PDF tables: read in the background after adding, Undo puts the lines back, one click reads them again", async (page) => {
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill(join(FIXTURES, "tables.pdf"));
  await page.keyboard.press("Enter");
  const doc = page.locator(".doc");
  await doc.getByText("Each successful review raises S", { exact: false }).waitFor();
  // The reader is installed, so the PDF's table is read as soon as it is added; the line says so meanwhile.
  await doc.locator("table").getByText("Spaced").waitFor({ timeout: 15000 });
  await page.locator(".pdf-tables").waitFor({ state: "detached" });
  await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
  await page.locator(".pdf-tables").getByText("Tables in this PDF read as plain text.").waitFor();
  if (await doc.locator("table").count()) throw new Error("Undo left the table in");
  await page.locator(".pdf-tables").getByRole("button", { name: "Read them properly" }).click();
  await doc.locator("table").getByText("Massed").waitFor({ timeout: 15000 });
});

journey("cancel an add from its toast: nothing is added, and the link stays in the box", async (page) => {
  // A page that hangs on its picture, which is fetched after the source is written.
  const page$ = `<html><head><title>Slow page</title><meta property="og:image" content="/cover.jpg"></head><body><article><h1>Slow page</h1><p>${"Spacing beats cramming. ".repeat(40)}</p></article></body></html>`;
  const slow = Bun.serve({ port: 0, fetch: (req) => (new URL(req.url).pathname === "/cover.jpg" ? new Promise<Response>(() => {}) : new Response(page$, { headers: { "content-type": "text/html" } })) });
  try {
    const link = `http://localhost:${slow.port}/slow`;
    await page.getByRole("button", { name: "+ Add" }).click();
    await page.getByLabel("Link, file path or text").fill(link);
    await page.keyboard.press("Enter");
    await page.locator(".toast").getByRole("button", { name: "Cancel" }).click();
    await page.locator(".toast").waitFor({ state: "detached" });
    await until("the box keeps the link, ready again", async () => (await page.getByLabel("Link, file path or text").inputValue()) === link && !(await page.getByLabel("Link, file path or text").getAttribute("readonly").then((r) => r !== null)));
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /^All sources/ }).click();
    await Bun.sleep(300);
    if (await page.locator(".row").filter({ hasText: "Slow page" }).count()) throw new Error("the cancelled source was added");
  } finally {
    slow.stop(true);
  }
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
  // The count shows at once; reload only once the redo's write has reached the library (slow on CI).
  const saved = page.waitForResponse((r) => r.request().method() === "POST" && /"annotate".*"--status","open"/.test(r.request().postData() ?? ""));
  await page.keyboard.press("Meta+Shift+z");
  await until("⇧⌘Z puts it back", async () => Number(await keeps.innerText()) === before + 1);
  await saved;
  await page.reload();
  await openSource(page, TESTING);
  await until("it is still there after a relaunch", async () => Number(await keeps.innerText()) === before + 1);
});

journey("skill page: To read's and Questions' heads line up, caret over caret and icon over icon", async (page) => {
  await page.getByRole("button", { name: /^Learning/ }).first().click();
  await page.locator(".skill-col.side .card-head .card-icon").nth(1).waitFor();
  const xs = await page.evaluate(() =>
    [...document.querySelectorAll(".skill-col.side .card-head")].map((h) => [".caret", ".card-icon"].map((s) => Math.round(h.querySelector(s)!.getBoundingClientRect().left))),
  );
  if (new Set(xs.map((x) => x.join())).size !== 1) throw new Error(`heads don't line up: ${JSON.stringify(xs)}`);
});

journey("skill page Questions: each row is one Tab stop then its ⋯, and ↑ ↓ move between rows", async (page) => {
  await page.getByRole("button", { name: /^Learning/ }).first().click();
  for (const q of ["Does spacing help with skills, not just facts?", "How long should a quiz gap be?"]) {
    await page.getByRole("button", { name: "Add a question" }).first().click();
    await page.getByLabel("New question").fill(q);
    await page.keyboard.press("Enter");
    await page.locator(".question-quote", { hasText: q }).waitFor();
  }
  const rows = page.locator(".skill-col .question-quote");
  if ((await rows.count()) < 2) throw new Error("fewer than two questions");
  await rows.first().focus();
  await page.keyboard.press("Tab");
  const tabbed = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  if (tabbed !== "Question actions") throw new Error(`Tab from a question landed on ${tabbed}, not its ⋯`);
  await rows.first().focus();
  await page.keyboard.press("ArrowDown");
  if (!(await rows.nth(1).evaluate((b) => b === document.activeElement))) throw new Error("↓ didn't move to the next question");
  await page.keyboard.press("ArrowUp");
  if (!(await rows.first().evaluate((b) => b === document.activeElement))) throw new Error("↑ didn't move back");
});

journey("Tab shows a focus ring on a control whose hover is a fill (Home's gear)", async (page) => {
  await page.keyboard.press("Tab");
  const gear = page.locator(".home-gear").first();
  await gear.focus();
  const ring = await gear.evaluate((b) => b.matches(":focus-visible") && getComputedStyle(b).outlineStyle);
  if (ring !== "solid") throw new Error(`the focused gear shows outline ${ring}`);
});

journey("⌘K ↵ on Home starts review, never flips a display setting", async (page) => {
  await page.keyboard.press("Meta+k");
  await page.locator("[cmdk-item]").first().waitFor();
  await page.keyboard.press("Enter");
  // The picker, or straight into review when he picked "everything" before.
  await page.getByRole("dialog", { name: "What to review" }).or(page.locator(".review")).first().waitFor();
});

journey("highlight popup open: typing writes the note, and no letter runs a shortcut (L, O, C, Q, N)", async (page) => {
  await openSource(page, TESTING);
  await select(page, "Each successful retrieval changes the memory itself");
  const popup = page.getByRole("dialog", { name: "Highlight" });
  await popup.waitFor();
  await page.evaluate(() => {
    const t = (window as any).__TAURI_INTERNALS__;
    const invoke = t.invoke;
    (window as any).__calls = [];
    t.invoke = (cmd: string, args: unknown) => ((window as any).__calls.push(cmd), invoke(cmd, args));
  });
  const words = "Look: cue, quiz, notes";
  await page.keyboard.type(words);
  const note = popup.locator("textarea");
  const typed = await note.inputValue();
  if (typed !== words) throw new Error(`the note says “${typed}”`);
  if (await page.locator(".listen-bar").count()) throw new Error("L started Listen");
  const toast = (await page.locator(".toast").allInnerTexts()).join(" ");
  if (/read aloud|Reading aloud/i.test(toast)) throw new Error(`L started Listen: ${toast}`);
  const opened = ((await page.evaluate(() => (window as any).__calls)) as string[]).filter((c) => c.includes("opener"));
  if (opened.length) throw new Error(`O opened the original: ${opened}`);
  if (!(await popup.isVisible())) throw new Error("a letter closed the popup");
  // Once the note has words, a digit is text even if focus went back to the page (D133: 1–4 set the type only while it is empty).
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("2");
  const after = await note.inputValue();
  if (after !== words + "2") throw new Error(`a 2 typed after the note became “${after}”`);
});

journey("tutor button: it sits in the title bar on every screen, beside Add or the panel toggle, never over the page", async (page) => {
  const button = page.getByRole("button", { name: "Open the tutor" });
  const check = async (where: string, beside: string) => {
    const b = (await button.boundingBox())!;
    if (b.y + b.height > 38) throw new Error(`${where}: the tutor button sits at y ${b.y}, below the title bar`);
    const n = (await page.locator(beside).first().boundingBox())!;
    if (b.x + b.width > n.x || Math.abs(b.y + b.height / 2 - (n.y + n.height / 2)) > 1) throw new Error(`${where}: the tutor button is not just left of ${beside}`);
  };
  await check("Home", ".main-tools .note-toggle");
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  await page.locator(".skill-page").waitFor();
  const b = (await button.boundingBox())!;
  if (b.y + b.height > 38) throw new Error(`skill page: the tutor button sits at y ${b.y}, below the title bar`);
  await openSource(page, TESTING);
  await check("reader", ".panel-toggle");
});

journey("tutor: ⌘J opens it over the source it sees, a reply shows its sources, Esc closes it and the thread stays; docked it takes the side panel's place", async (page) => {
  await openSource(page, TESTING);
  await page.keyboard.press("Meta+j");
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  await tutor.locator(".tutor-chip").filter({ hasText: TESTING }).waitFor();
  await page.locator(".doc-head").filter({ hasText: TESTING }).waitFor(); // the page stays beside it
  const sent = page.waitForRequest((r) => /"tutor","Why does this work\?","--item=/.test(r.postData() ?? ""));
  await page.getByRole("textbox", { name: "Message the tutor" }).fill("Why does this work?");
  await page.keyboard.press("Enter");
  await sent;
  // Its sources wait behind "Sources" (ChatGPT): pills in the text, the list on a click.
  await tutor.locator(".cite").first().waitFor();
  await tutor.getByRole("button", { name: "Sources" }).click();
  await tutor.locator(".library-sources li").nth(1).waitFor();
  await page.keyboard.press("Escape");
  await until("Esc closes it", async () => (await tutor.count()) === 0);
  await page.getByRole("button", { name: "Open the tutor" }).click();
  await tutor.getByText("Why does this work?").waitFor();
  // It floats by default; docked, it takes the side panel's place, and the panel comes back when it closes.
  const side = page.locator(".mynotes");
  await side.waitFor();
  await tutor.getByRole("button", { name: "Dock to the side" }).click();
  await until("docked, the side panel steps aside", async () => (await side.count()) === 0);
  await page.keyboard.press("Meta+j");
  await side.waitFor();
  await page.keyboard.press("Meta+j");
  await tutor.getByRole("button", { name: "Float over the page" }).click();
  await side.waitFor();
  await page.keyboard.press("Escape");
});

journey("tutor citation: a numbered source in a reply opens that source at the quoted passage, marked", async (page) => {
  // The reply cites a real passage of the seeded source, placed in its doc.md as the tutor places it.
  const bridge = (args: string[]) => fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args }) }).then((r) => r.json());
  const item = ((await bridge(["ls"])) as { id: string; title: string }[]).find((i) => i.title === TESTING)!;
  const body = ((await bridge(["show", item.id])) as { body: string }).body;
  const quote = "Each successful retrieval changes the memory itself.";
  const start = body.indexOf(quote);
  if (start < 0) throw new Error("the seeded source no longer holds the quote");
  await page.route(/\/ore$/, async (route) => {
    if (!(route.request().postData() ?? "").includes('"tutor",')) return route.fallback();
    const cite = { n: 1, item: item.id, title: TESTING, heading: "", quote, text: quote, start, end: start + quote.length };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: "Retrieval changes the memory [1].", citations: [cite], general: false, hint: false, exercise: null, card: null, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@4" } }) });
  });
  try {
    await page.keyboard.press("Meta+j");
    const tutor = page.getByRole("complementary", { name: "Tutor" });
    const fresh = tutor.getByRole("button", { name: "New chat" });
    if (await fresh.isEnabled()) await fresh.click();
    await page.getByRole("textbox", { name: "Message the tutor" }).fill("Why does testing work?");
    await page.keyboard.press("Enter");
    await tutor.getByRole("button", { name: `Source 1: ${TESTING}` }).click();
    await page.locator(".doc-head").filter({ hasText: TESTING }).waitFor();
    const active = () => page.evaluate(() => [...(CSS.highlights.get("hl-active") ?? [])].map((r) => r.toString()).join("|"));
    await until("the quoted passage is marked", async () => (await active()) === quote);
  } finally {
    await page.unroute(/\/ore$/); // a failure here mustn't answer later journeys' tutor calls
  }
  await page.keyboard.press("Escape");
});

journey("tutor web citation: a page the tutor found on the web is a pill named for its site, shows the words on hover and opens in the browser", async (page) => {
  const url = "https://www.britannica.com/biography/Hermann-Ebbinghaus";
  await page.route(/\/ore$/, async (route) => {
    if (!(route.request().postData() ?? "").includes('"tutor",')) return route.fallback();
    const cite = { n: 1, url, title: "Hermann Ebbinghaus", site: "britannica.com", quote: "born on January 24, 1850", text: "born on January 24, 1850" };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: "Your sources don't say; he was born in 1850 [1].", citations: [cite], general: false, searched: true, hint: false, exercise: null, card: null, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@5" } }) });
  });
  await page.evaluate(() => {
    const t = (window as any).__TAURI_INTERNALS__;
    const invoke = ((window as any).__invoke = t.invoke);
    (window as any).__opened = [];
    t.invoke = (cmd: string, args: any) => (cmd.includes("opener") ? ((window as any).__opened.push(args?.url), Promise.resolve()) : invoke(cmd, args));
  });
  try {
    await page.keyboard.press("Meta+j");
    const tutor = page.getByRole("complementary", { name: "Tutor" });
    const fresh = tutor.getByRole("button", { name: "New chat" });
    if (await fresh.isEnabled()) await fresh.click();
    await page.getByRole("textbox", { name: "Message the tutor" }).fill("When was Ebbinghaus born?");
    await page.keyboard.press("Enter");
    // The pill is named for the site, and its card on hover shows the page and the words it holds.
    const pill = tutor.getByRole("button", { name: "Source 1: Hermann Ebbinghaus (britannica.com)" });
    await pill.getByText("britannica", { exact: true }).waitFor();
    await pill.hover();
    await page.locator(".cite-card").getByText("born on January 24, 1850").waitFor();
    // Typing re-renders the chat; the open card must not be remounted away.
    await page.getByRole("textbox", { name: "Message the tutor" }).pressSequentially("and", { delay: 30 });
    if (!(await page.locator(".cite-card").isVisible())) throw new Error("typing closed the citation's card");
    await page.getByRole("textbox", { name: "Message the tutor" }).fill("");
    await pill.click();
    await until("the page opens in the browser", async () => ((await page.evaluate(() => (window as any).__opened)) as string[]).includes(url));
  } finally {
    await page.unroute(/\/ore$/);
    await page.evaluate(() => { (window as any).__TAURI_INTERNALS__.invoke = (window as any).__invoke; });
  }
  await page.keyboard.press("Escape");
});

journey("tutor streaming: the reply shows as it is written (markers wait for the citations), a search says so, and the whole reply replaces it", async (page) => {
  let release = () => {};
  const held = new Promise<void>((r) => (release = r));
  let id = "";
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (!body.includes('"tutor",')) return route.fallback();
    id = (JSON.parse(body).args as string[]).find((a) => a.startsWith("--stream="))!.slice(9);
    await held;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: "Spacing beats cramming over a week.", citations: [], general: true, searched: true, hint: false, exercise: null, card: null, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@5" } }) });
  });
  try {
    await page.keyboard.press("Meta+j");
    const tutor = page.getByRole("complementary", { name: "Tutor" });
    const fresh = tutor.getByRole("button", { name: "New chat" });
    if (await fresh.isEnabled()) await fresh.click();
    await page.getByRole("textbox", { name: "Message the tutor" }).fill("Does spacing beat cramming?");
    await page.keyboard.press("Enter");
    await until("the call carries its stream id", async () => !!id);
    const emit = (p: object) => page.evaluate(([p]) => (window as any).__emit("ore-progress", p), [p] as const);
    await emit({ stream: "someone-else", reply: "Not this turn's words" });
    await emit({ stream: id, searching: true });
    await tutor.getByText("Searching the web…").waitFor();
    await emit({ stream: id, reply: "Spacing beats [1" });
    await tutor.getByText("Spacing beats", { exact: true }).waitFor();
    if (await tutor.getByText("Not this turn's words").count()) throw new Error("another turn's words landed here");
    if (await tutor.getByText("Searching the web…").count()) throw new Error("the wait stayed up under the words");
    release();
    await tutor.getByText("Spacing beats cramming over a week.").waitFor();
  } finally {
    release();
    await page.unroute(/\/ore$/);
  }
  await page.keyboard.press("Escape");
});

journey("tutor scroll: a reply streaming in while he reads higher up leaves his place and offers New reply, which takes him down; sending follows the end again", async (page) => {
  let release = () => {};
  let held = Promise.resolve();
  let id = "";
  const long = Array.from({ length: 30 }, (_, i) => `Line ${i + 1} of a long explanation about spacing and retrieval.`).join("\n\n");
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (!body.includes('"tutor",')) return route.fallback();
    id = (JSON.parse(body).args as string[]).find((a) => a.startsWith("--stream="))!.slice(9);
    await held;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: long, citations: [], general: true, searched: false, hint: false, exercise: null, card: null, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@8" } }) });
  });
  try {
    await page.keyboard.press("Meta+j");
    const tutor = page.getByRole("complementary", { name: "Tutor" });
    const fresh = tutor.getByRole("button", { name: "New chat" });
    if (await fresh.isEnabled()) await fresh.click();
    const log = tutor.locator(".tutor-turns");
    const field = page.getByRole("textbox", { name: "Message the tutor" });
    const gap = () => log.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
    await field.fill("Explain spacing at length");
    await page.keyboard.press("Enter");
    await tutor.getByText("Line 30 of a long explanation", { exact: false }).waitFor();
    await until("the first reply is followed to its end", async () => (await gap()) < 24);
    // The next reply streams while he scrolls up to reread the first.
    held = new Promise<void>((r) => (release = r));
    id = "";
    await field.fill("And again");
    await page.keyboard.press("Enter");
    await until("the call carries its stream id", async () => !!id);
    await log.evaluate((el) => (el.scrollTop = 0));
    const emit = (p: object) => page.evaluate(([p]) => (window as any).__emit("ore-progress", p), [p] as const);
    await emit({ stream: id, reply: long.slice(0, 400) });
    await emit({ stream: id, reply: long.slice(0, 1200) });
    const pill = tutor.getByRole("button", { name: "New reply" });
    await pill.waitFor();
    if ((await log.evaluate((el) => el.scrollTop)) !== 0) throw new Error("the streaming reply moved him off what he was reading");
    release();
    await until("the whole reply landed", async () => (await tutor.getByText("Line 30 of a long explanation", { exact: false }).count()) === 2);
    if ((await log.evaluate((el) => el.scrollTop)) !== 0) throw new Error("the finished reply moved him");
    await pill.click();
    await until("New reply takes him to the end", async () => (await gap()) < 24);
    await pill.waitFor({ state: "detached" });
    // The page under the tutor never scrolled.
    if ((await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0)) !== 0) throw new Error("the page scrolled");
  } finally {
    release();
    await page.unroute(/\/ore$/);
  }
  await page.keyboard.press("Escape");
});

journey("tutor @: typing @ lists skills and sources, Enter writes the name in, and the message goes out pointed at it", async (page) => {
  await page.keyboard.press("Meta+j");
  const field = page.getByRole("textbox", { name: "Message the tutor" });
  await field.pressSequentially("What does @agen");
  const list = page.getByRole("listbox", { name: "Point the tutor at" });
  await list.getByRole("option", { name: new RegExp(AGENTS) }).waitFor();
  await page.keyboard.press("Enter");
  await until("the list closes", async () => (await list.count()) === 0);
  await until("the name is in the text", async () => (await field.inputValue()) === `What does @${AGENTS} `);
  await field.pressSequentially("say?");
  const sent = page.waitForRequest((r) => new RegExp(`"tutor","What does @${AGENTS} say\\?","--source=`).test(r.postData() ?? ""));
  await page.keyboard.press("Enter");
  await sent;
  await page.locator(".ask-me .tutor-at").filter({ hasText: `@${AGENTS}` }).waitFor();
  await page.keyboard.press("Escape");
});

journey("tutor draft: a half-written message and its @ mention survive closing and reopening the tutor", async (page) => {
  await page.keyboard.press("Meta+j");
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  const field = page.getByRole("textbox", { name: "Message the tutor" });
  await field.pressSequentially("What does @agen");
  await page.getByRole("listbox", { name: "Point the tutor at" }).getByRole("option", { name: new RegExp(AGENTS) }).waitFor();
  await page.keyboard.press("Enter");
  await field.pressSequentially("say about tools?");
  await page.keyboard.press("Escape");
  await until("Esc closes it", async () => (await tutor.count()) === 0);
  await page.keyboard.press("Meta+j");
  await until("the draft is still there", async () => (await field.inputValue()) === `What does @${AGENTS} say about tools?`);
  const sent = page.waitForRequest((r) => new RegExp(`"tutor","What does @${AGENTS} say about tools\\?","--source=`).test(r.postData() ?? ""));
  await page.keyboard.press("Enter");
  await sent; // the mention came back with it
  await tutor.locator(".ask-me .tutor-at").filter({ hasText: `@${AGENTS}` }).waitFor();
  await page.keyboard.press("Escape");
});

journey("tutor @ carries: a follow-up with no @ keeps the last @s, a new @ replaces them, New chat clears them and Undo restores them, × drops one", async (page) => {
  const asked: string[][] = [];
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"tutor",')) return route.fallback();
    asked.push(JSON.parse(body).args);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: `Reply ${asked.length}`, citations: [], general: false, hint: false, exercise: null, card: null, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@4" } }) });
  });
  await page.keyboard.press("Meta+j");
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  const field = page.getByRole("textbox", { name: "Message the tutor" });
  const fresh = tutor.getByRole("button", { name: "New chat" });
  if (await fresh.isEnabled()) await fresh.click(); // an earlier journey's thread
  const chip = (name: string) => tutor.locator(".tutor-chip").filter({ hasText: `@${name}` });
  const send = async (before: string, at?: string, after = "") => {
    const n = asked.length;
    await field.pressSequentially(before);
    if (at) {
      await field.pressSequentially(at);
      await page.getByRole("listbox", { name: "Point the tutor at" }).getByRole("option").first().waitFor();
      await page.keyboard.press("Enter");
      await field.pressSequentially(after);
    }
    await page.keyboard.press("Enter");
    await tutor.getByText(`Reply ${n + 1}`).waitFor();
    return asked[n]!.join(" ");
  };
  if (!(await send("Explain ", "@learn", "spacing")).includes("--skill=learning")) throw new Error("the @ skill was not sent");
  await chip("learning").waitFor();
  if (!(await send("Show me")).includes("--skill=learning")) throw new Error("the follow-up lost the @ skill");
  const replaced = await send("Now ", "@Building", "please");
  if (!replaced.includes("--source=") || replaced.includes("--skill=learning")) throw new Error(`a new @ did not replace the old: ${replaced}`);
  await chip(AGENTS).waitFor();
  if (await chip("learning").count()) throw new Error("the replaced skill still shows");
  await fresh.click();
  await until("New chat clears it", async () => (await chip(AGENTS).count()) === 0);
  await page.locator(".toast", { hasText: "Chat cleared" }).getByRole("button", { name: "Undo" }).click();
  await chip(AGENTS).waitFor(); // back with its thread
  await tutor.getByRole("button", { name: `Leave “${AGENTS}” out` }).click();
  await until("× drops it", async () => (await chip(AGENTS).count()) === 0);
  if ((await send("And this?")).includes("--source=")) throw new Error("a dropped @ was still sent");
  await page.unroute(/\/ore$/);
  await page.keyboard.press("Meta+j");
});

journey("tutor pending: closing mid-reply asks once; a new chat keeps its own reply, the old one lands in the old chat, and Undo brings that chat back", async (page) => {
  const asked: string[] = [];
  let release: (() => void) | undefined;
  const reply = (text: string) => JSON.stringify({ reply: text, citations: [], general: false, hint: false, exercise: null, card: null, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@4" } });
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"tutor",')) return route.fallback();
    const message = JSON.parse(body).args[1] as string;
    asked.push(message);
    if (message === "First question") await new Promise<void>((ok) => (release = ok));
    await route.fulfill({ contentType: "application/json", body: reply(message === "First question" ? "First reply" : "Second reply") });
  });
  await page.keyboard.press("Meta+j");
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  const field = page.getByRole("textbox", { name: "Message the tutor" });
  const fresh = tutor.getByRole("button", { name: "New chat" });
  await field.fill("First question");
  await page.keyboard.press("Enter");
  await tutor.getByText("Thinking…").waitFor();
  await page.keyboard.press("Escape");
  await until("Esc closes it", async () => (await tutor.count()) === 0);
  await page.keyboard.press("Meta+j");
  await tutor.getByText("Thinking…").waitFor();
  await page.waitForTimeout(400);
  if (asked.length !== 1) throw new Error(`reopening asked again: ${asked.length} requests`);
  // A new chat while it thinks: its own question gets its own reply.
  await fresh.click();
  await page.locator(".toast", { hasText: "Chat cleared" }).getByRole("button", { name: "Undo" }).waitFor();
  await field.fill("Second question");
  await page.keyboard.press("Enter");
  await tutor.getByText("Second reply").waitFor();
  const old = page.waitForResponse((r) => (r.request().postData() ?? "").includes('"First question"'));
  release!();
  await old;
  await page.waitForTimeout(300);
  if (await tutor.getByText("First reply").count()) throw new Error("the old reply landed in the new chat");
  await tutor.getByText("Second reply").waitFor();
  // Undo puts the old chat back, with the reply that came while it was away; redo returns to the new one.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Meta+z");
  await tutor.getByText("First reply").waitFor();
  if (await tutor.getByText("Second question").count()) throw new Error("undo kept the new chat");
  await page.keyboard.press("Meta+Shift+z");
  await tutor.getByText("Second reply").waitFor();
  if (await tutor.getByText("First question").count()) throw new Error("redo kept the old chat");
  await page.unroute(/\/ore$/);
  await page.keyboard.press("Meta+j");
});

journey("tutor hints and cards: a hint offers Show me, which asks for the answer; + Card keeps the reply's card, ⌘Z takes it back", async (page) => {
  await openSource(page, TESTING);
  const replies = [
    { reply: "Think about what the tested group did that the rereaders didn't.", citations: [], general: false, hint: true, card: null },
    { reply: "They pulled it out of memory, and that effort is what made it last.", citations: [], general: false, hint: false, card: { kind: "card", content_type: "fact", question: "In Roediger and Karpicke (2006), which group remembered more after a week?", answer: "The group that took a recall test.", rubric: [] } },
  ].map((r) => ({ ...r, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@3" } }));
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"tutor",')) return route.fallback();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(replies.shift()) });
  });
  await page.keyboard.press("Meta+j");
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  await page.getByRole("textbox", { name: "Message the tutor" }).fill("Which group did better?");
  await page.keyboard.press("Enter");
  await tutor.getByRole("button", { name: "Show me" }).click();
  await tutor.getByText("Show me", { exact: true }).waitFor(); // sent as his message
  const kept = page.waitForResponse((r) => (r.request().postData() ?? "").includes('"tutor-card"'));
  await tutor.getByRole("button", { name: /^Add card:/ }).click();
  await tutor.getByRole("button", { name: "Card added" }).waitFor();
  await kept;
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()); // out of the field, so ⌘Z is the app's
  await page.keyboard.press("Meta+z");
  await tutor.getByRole("button", { name: /^Add card:/ }).waitFor();
  await page.unroute(/\/ore$/);
  await page.keyboard.press("Meta+j");
});

journey("tutor steps: Show me's worked answer shows one step at a time, Next step adds the next, the last hands the field the focus, and the steps stay and go with the next message (D142)", async (page) => {
  await openSource(page, TESTING);
  const steps = ["The tested group pulled the facts out of memory.", "Pulling them out made the memory stronger.", "So a week later they **remembered more**."];
  const replies = [
    { reply: "Think about what the tested group did.", citations: [], general: false, hint: true, steps: [], exercise: null, card: null },
    { reply: "Here's the working.", citations: [], general: false, hint: false, steps, exercise: null, card: null },
    { reply: "Step 2 is the testing effect.", citations: [], general: false, hint: false, steps: [], exercise: null, card: null },
  ].map((r) => ({ ...r, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@8" } }));
  const bodies: string[] = [];
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"tutor",')) return route.fallback();
    bodies.push(body);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(replies.shift()) });
  });
  try {
    await page.keyboard.press("Meta+j");
    const tutor = page.getByRole("complementary", { name: "Tutor" });
    const fresh = tutor.getByRole("button", { name: "New chat" });
    if (await fresh.isEnabled()) await fresh.click();
    const field = page.getByRole("textbox", { name: "Message the tutor" });
    await field.fill("Why did the tested group remember more?");
    await page.keyboard.press("Enter");
    await tutor.getByRole("button", { name: "Show me" }).click();
    const shown = tutor.locator(".tutor-steps li");
    await shown.first().waitFor();
    if ((await shown.count()) !== 1) throw new Error(`Show me opened with ${await shown.count()} steps, not one`);
    const next = tutor.getByRole("button", { name: "Next step" });
    await next.click();
    await until("Next step shows the second", async () => (await shown.count()) === 2 && (await shown.nth(1).innerText()).includes("stronger"));
    // Closed and opened again, the steps he showed stay shown.
    await page.keyboard.press("Escape");
    await page.keyboard.press("Meta+j");
    await until("the steps came back as he left them", async () => (await shown.count()) === 2);
    // The next message carries the steps he has seen as what the tutor said, not the one still hidden.
    await field.fill("Why step 2?");
    await page.keyboard.press("Enter");
    await tutor.getByText("Step 2 is the testing effect.").waitFor();
    if (!bodies[2]!.includes("2. Pulling them out made the memory stronger.")) throw new Error("the follow-up didn't carry the steps");
    if (bodies[2]!.includes("remembered more")) throw new Error("the follow-up carried a step he hadn't seen");
    await next.click();
    await until("the last step shows", async () => (await shown.count()) === 3);
    await shown.nth(2).locator("strong").waitFor();
    if (await next.count()) throw new Error("Next step stayed after the last step");
    await until("the field has the focus", () => field.evaluate((f) => f === document.activeElement));
  } finally {
    await page.unroute(/\/ore$/);
  }
  await page.keyboard.press("Escape");
});

journey("tutor Show me: a half-written reply and its @ mention stay in the box while the hint's answer comes", async (page) => {
  await openSource(page, TESTING);
  const replies = [
    { reply: "Think about what the tested group did.", citations: [], general: false, hint: true, card: null },
    { reply: "They pulled it out of memory.", citations: [], general: false, hint: false, card: null },
    { reply: "Yes, that is the idea.", citations: [], general: false, hint: false, card: null },
  ].map((r) => ({ ...r, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@3" } }));
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"tutor",')) return route.fallback();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(replies.shift()) });
  });
  await page.keyboard.press("Meta+j");
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  const field = page.getByRole("textbox", { name: "Message the tutor" });
  const list = page.getByRole("listbox", { name: "Point the tutor at" });
  // A starter sent with the @ list open closes the list.
  await field.pressSequentially("@agen");
  await list.waitFor();
  await tutor.locator(".tutor-starters button").first().click();
  await tutor.getByRole("button", { name: "Show me" }).waitFor();
  if (await list.count()) throw new Error("the @ list stayed open after a starter went");
  await field.fill("");
  await field.pressSequentially("Like @agen");
  await list.getByRole("option", { name: new RegExp(AGENTS) }).waitFor();
  await page.keyboard.press("Enter");
  await field.pressSequentially("says?");
  const draft = `Like @${AGENTS} says?`;
  await tutor.getByRole("button", { name: "Show me" }).click();
  await tutor.getByText("They pulled it out of memory.").waitFor();
  if ((await field.inputValue()) !== draft) throw new Error(`Show me cleared the draft: "${await field.inputValue()}"`);
  const sent = page.waitForRequest((r) => (r.postData() ?? "").includes('"--source='));
  await field.focus();
  await page.keyboard.press("Enter");
  await sent; // the @ mention went with it
  await page.unroute(/\/ore$/);
  await page.keyboard.press("Meta+j");
});

journey("tutor Quiz me: opens Review on the due cards of the source's skills, and Esc comes back", async (page) => {
  await openSource(page, TESTING);
  await page.keyboard.press("Meta+j");
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  const sent = page.waitForRequest((r) => /"due","--skill=learning","--skill=teaching"/.test(r.postData() ?? ""));
  await tutor.getByRole("button", { name: "Quiz me" }).click();
  await sent;
  await page.locator(".review").waitFor();
  await page.keyboard.press("Escape");
  await until("Esc leaves Review", async () => (await page.locator(".review").count()) === 0);
  await page.locator(".doc-head").filter({ hasText: TESTING }).waitFor(); // back on the source
});

journey("tutor Practice: an exercise is written in the source note with the source hidden, and ⌘↵ sends it back for feedback", async (page) => {
  await openSource(page, AGENTS); // not TESTING: the note block journey counts that note's headings
  const exercise = { heading: "Why does an agent need a stopping condition?", prompts: ["What goes wrong without one"] };
  const replies = [
    { reply: "Explain why the tested group remembered more, from memory.", citations: [], general: false, hint: false, exercise, card: null },
    { reply: "Right: recalling it is what made it last. What would change after a month?", citations: [], general: false, hint: false, exercise: null, card: null },
  ].map((r) => ({ ...r, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@4" } }));
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"tutor",')) return route.fallback();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(replies.shift()) });
  });
  await page.keyboard.press("Meta+j");
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  const fresh = tutor.getByRole("button", { name: "New chat" });
  if (await fresh.isEnabled()) await fresh.click(); // an earlier journey's thread
  await tutor.getByRole("button", { name: "Practice", exact: true }).click();
  await tutor.getByRole("button", { name: "Write it in your note" }).click();
  await until("the tutor makes room for the note", async () => (await tutor.count()) === 0);
  await page.locator(".reader-pane.hidden-src").waitFor(); // closed book while he writes
  await page.locator(".note-editor h2", { hasText: exercise.heading }).waitFor();
  await page.keyboard.type("They pulled it from memory, and the effort made it stick.");
  const sent = page.waitForRequest((r) => (r.postData() ?? "").includes("They pulled it from memory, and the effort made it stick."));
  await page.keyboard.press("Meta+Enter");
  await sent;
  await tutor.getByText("What would change after a month?").waitFor(); // the feedback, back in the chat
  await until("the source shows again", async () => (await page.locator(".reader-pane.hidden-src").count()) === 0);
  await page.locator(".note-editor").getByText("They pulled it from memory, and the effort made it stick.").waitFor(); // his answer stays in his note
  await page.unroute(/\/ore$/);
  await page.keyboard.press("Meta+j");
});

journey("Collected row menu: change a highlight's type and remove it without opening it, ⌘Z takes each back", async (page) => {
  await openSource(page, TESTING);
  // Its own highlight, so it never leans on what an earlier journey left (or took back).
  const keeps = page.locator(".collected-chip.keep");
  const count = async () => ((await keeps.count()) ? Number(await keeps.innerText()) : 0);
  const before = (await count()) + 1;
  await select(page, "the text feels familiar, and familiarity is easily mistaken for knowing");
  await page.getByRole("dialog", { name: "Highlight" }).waitFor();
  await page.keyboard.press("Enter");
  await until("the Keep count goes up", async () => (await count()) === before);
  await page.getByRole("tab", { name: "Collected" }).click();
  const toggle = page.locator(".cp-head.keep .cp-toggle");
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  const row = () => page.locator(".cp-head.keep ~ .cp-line").filter({ hasText: "familiarity is easily mistaken" }).first();
  await row().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Type" }).hover();
  await page.getByRole("menuitemcheckbox", { name: "Question" }).dispatchEvent("click");
  await until("it is a question now", async () => (await count()) === before - 1);
  await page.keyboard.press("Meta+z");
  await until("⌘Z makes it a highlight again", async () => (await count()) === before);
  await row().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Remove highlight" }).click();
  await until("it is gone", async () => (await count()) === before - 1);
  // At once: the remove is the newest step on the history as soon as the row goes.
  await page.keyboard.press("Meta+z");
  await until("⌘Z brings it back", async () => (await count()) === before);
  // Leave the library as it was for the journeys after this one.
  await page.waitForTimeout(300);
  await row().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Remove highlight" }).click();
  await until("it is gone again", async () => (await count()) === before - 1);
  await page.waitForTimeout(500); // the write lands before the next journey reads the library
});

journey("Collected: a key point he is typing survives closing its group and switching to the note and back", async (page) => {
  await openSource(page, TESTING);
  await page.getByRole("tab", { name: "Collected" }).click();
  const toggle = page.locator(".cp-head.card .cp-toggle");
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  await page.getByRole("button", { name: "Add a key point" }).click();
  const field = page.getByRole("textbox", { name: "Key point", exact: true });
  await until("+ puts the caret in the field", () => field.evaluate((el) => el === document.activeElement));
  await field.fill("Retrieval beats rereading for the long run");
  await toggle.click();
  await toggle.click();
  if ((await field.inputValue()) !== "Retrieval beats rereading for the long run") throw new Error("closing Key points lost his words");
  await page.getByRole("tab", { name: "Source note" }).click();
  await page.getByRole("tab", { name: "Collected" }).click();
  if ((await field.inputValue()) !== "Retrieval beats rereading for the long run") throw new Error("switching to the note lost his words");
  if (await field.evaluate((el) => el === document.activeElement)) throw new Error("coming back to Collected took the caret into the kept field");
  await field.press("Escape");
});

journey("Collected: questions that fail to load say why, and Try again shows them", async (page) => {
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { questions: "The library is busy." }));
  await openSource(page, TESTING);
  await page.getByRole("tab", { name: "Collected" }).click();
  const toggle = page.locator(".cp-head.question .cp-toggle");
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  const alert = page.getByRole("alert").filter({ hasText: "The library is busy." });
  await alert.waitFor();
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
  await alert.getByRole("button", { name: "Try again" }).click();
  await page.locator(".qp-row").first().waitFor();
  if (await alert.count()) throw new Error("the error stayed after the list loaded");
});

journey("highlight: a selection snaps to whole words and the full stop, ⌥ keeps it exact", async (page) => {
  await openSource(page, TESTING);
  const active = () => page.evaluate(() => [...(CSS.highlights.get("hl-active") ?? [])].map((r) => r.toString()).join("|"));
  const popup = page.getByRole("dialog", { name: "Highlight" });
  await page.waitForTimeout(300); // the reader puts back where he was reading: a drag before that lands elsewhere
  await select(page, "ach successful retrieval changes the memory its");
  await popup.waitFor();
  await until("it snaps out to whole words", async () => (await active()) === "Each successful retrieval changes the memory itself.");
  await page.keyboard.press("Escape"); // drops the fresh one
  await popup.waitFor({ state: "hidden" });
  await page.keyboard.down("Alt");
  await select(page, "trengthens the route bac");
  await page.keyboard.up("Alt");
  await popup.waitFor();
  await until("⌥ keeps exactly what he selected", async () => (await active()) === "trengthens the route bac");
  await page.keyboard.press("Escape");
});

journey("highlight: a triple click keeps the paragraph as one step, so one ⌘Z takes it all back", async (page) => {
  await openSource(page, TESTING);
  const kept = () => page.evaluate(() => [...(CSS.highlights.get("hl-keep") ?? [])].map((r) => r.toString()));
  const popup = page.getByRole("dialog", { name: "Highlight" });
  await page.waitForTimeout(300);
  const at = (await page.evaluate(() => {
    const walk = document.createTreeWalker(document.querySelector(".doc")!, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
      const i = n.data.indexOf("Rereading, by contrast");
      if (i < 0) continue;
      n.parentElement!.scrollIntoView({ block: "center" });
      const r = document.createRange();
      r.setStart(n, i + 2);
      r.setEnd(n, i + 3);
      const b = r.getBoundingClientRect();
      return { x: b.left + 1, y: b.top + b.height / 2 };
    }
  }))!;
  const writes: string[] = [];
  page.on("request", (r) => void (/"(?:highlight|annotate)"/.test(r.postData() ?? "") && writes.push(r.postData()!)));
  await page.mouse.click(at.x, at.y, { clickCount: 3 });
  await popup.waitFor();
  await until("the paragraph is highlighted", async () => (await kept()).some((t) => t.startsWith("Rereading, by contrast") && t.includes("weaker results.")));
  // Not the double click's word first, then grown to the paragraph: two steps for one act.
  if (writes.length !== 1) throw new Error(`a triple click wrote ${writes.length} times: ${writes.join(" | ")}`);
  await page.keyboard.press("Enter");
  await popup.waitFor({ state: "hidden" });
  await page.waitForTimeout(300);
  await page.keyboard.press("Meta+z");
  await until("one ⌘Z leaves nothing of it highlighted", async () => !(await kept()).some((t) => t.includes("Rereading")));
  await page.waitForTimeout(800); // the undo's writes are back
  const left = await kept();
  if (left.some((t) => t.includes("Rereading"))) throw new Error(`one ⌘Z left ${JSON.stringify(left)}`);
});

journey("reader: ⌘[ after an outline jump goes back to where he was, ⌘] to the jump again, before leaving the source", async (page) => {
  const part = (n: number) => `## Part ${n}\n\n` + `Part ${n} says one thing at length, so the source runs long enough to scroll. `.repeat(12);
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill(`# A long read in parts\n\n${Array.from({ length: 10 }, (_, i) => part(i + 1)).join("\n\n")}`);
  await page.keyboard.press("Enter");
  await page.locator(".doc").getByText("Part 1 says one thing").first().waitFor();
  await page.waitForTimeout(500);
  const top = () => page.evaluate(() => Math.round(document.querySelector(".reader-scroll")?.scrollTop ?? -1000));
  const from = await top();
  await page.locator("nav.outline").hover();
  await page.locator(".outline-panel button").filter({ hasText: "Part 9" }).click();
  await until("the outline jumps", async () => (await top()) > from + 400);
  const jumped = await top();
  await page.mouse.move(640, 400);
  await page.keyboard.press("Meta+BracketLeft");
  await until("⌘[ goes back to where he was", async () => Math.abs((await top()) - from) < 4);
  if (!(await page.locator(".doc").isVisible())) throw new Error("⌘[ left the source");
  await page.keyboard.press("Meta+BracketRight");
  await until("⌘] goes to the jump again", async () => Math.abs((await top()) - jumped) < 4);
  await page.keyboard.press("Meta+BracketLeft");
  await page.keyboard.press("Meta+BracketLeft");
  await until("then ⌘[ leaves the source, as before", async () => !(await page.locator(".doc").isVisible()));
});

journey("figure zoom: a click opens a figure to fill the window and keys don't reach the page behind; Esc, a click or a scroll puts it back (D144)", async (page) => {
  await openSource(page, AGENTS);
  const fig = page.locator(".doc img").first();
  await fig.scrollIntoViewIfNeeded();
  const small = (await fig.boundingBox())!;
  const zoom = page.locator(".figure-zoom");
  const big = page.locator(".figure-zoom.open img");
  const shut = () => until("it is put back", async () => !(await zoom.count()) && (await fig.evaluate((i) => getComputedStyle(i).visibility)) === "visible");
  await fig.click();
  await big.waitFor();
  await until("the figure grows to fill the window", async () => ((await big.boundingBox())?.width ?? 0) > small.width * 1.3);
  // Keys stay with the figure: the page behind doesn't scroll, and Esc puts it back at once.
  const top = await page.locator(".reader-scroll").evaluate((el) => el.scrollTop);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await page.keyboard.press("Escape");
  await shut();
  if ((await page.locator(".reader-scroll").evaluate((el) => el.scrollTop)) !== top) throw new Error("keys pressed over the figure scrolled the page behind");
  if (!(await page.locator(".doc").isVisible())) throw new Error("Esc left the source as well as the figure");
  // A click on it puts it back, and so does a scroll.
  await fig.click();
  await big.waitFor();
  await page.waitForTimeout(300);
  await zoom.click();
  await shut();
  await fig.click();
  await big.waitFor();
  await page.mouse.wheel(0, 200);
  await shut();
  if ((await page.locator(".reader-scroll").evaluate((el) => el.scrollTop)) !== top) throw new Error("the scroll that put the figure back moved the page too");
});

journey("highlight note: a long note's hover preview stays inside the window", async (page) => {
  await openSource(page, AGENTS);
  const popup = page.getByRole("dialog", { name: "Highlight" });
  await page.waitForTimeout(300);
  await select(page, "Evaluator-optimiser loops");
  await popup.waitFor();
  await popup.getByLabel("Note").fill("A long thought about this loop, written out at length. ".repeat(55));
  await page.keyboard.press("Escape");
  await popup.waitFor({ state: "hidden" });
  await page.waitForTimeout(400);
  // Hover near the right edge and low in the window, where an unclamped preview runs off both.
  const at = (await page.evaluate(() => {
    const walk = document.createTreeWalker(document.querySelector(".doc")!, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
      const i = n.data.indexOf("Evaluator-optimiser loops");
      if (i < 0) continue;
      const scroll = document.querySelector(".reader-scroll")!;
      const r0 = document.createRange();
      r0.setStart(n, i);
      r0.setEnd(n, i + 1);
      scroll.scrollTop += r0.getBoundingClientRect().top - (innerHeight - 120);
      const r = document.createRange();
      r.setStart(n, i + 10);
      r.setEnd(n, i + 11);
      const b = r.getBoundingClientRect();
      return { x: b.left + 1, y: b.top + b.height / 2 };
    }
  }))!;
  await page.mouse.move(at.x - 5, at.y);
  await page.mouse.move(at.x, at.y);
  const tip = page.locator(".tip");
  await tip.waitFor();
  const box = (await tip.boundingBox())!;
  const view = page.viewportSize()!;
  if (box.y < 0 || box.y + box.height > view.height || box.x + box.width > view.width) throw new Error(`the preview runs off the window: ${JSON.stringify(box)}`);
});

journey("highlight: one the core can't place says what to do, not “text not found in item <id>”", async (page) => {
  await openSource(page, TESTING);
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { highlight: 'ore: text not found in item 01M6Y59CWZB27HBM869RVJPBGR: "Tom & Jerry"' }));
  await page.waitForTimeout(300);
  await select(page, "Space the tests out, mix topics together"); // a passage no other journey highlights
  await until("an error toast", async () => (await page.locator(".toast").allInnerTexts()).some((t) => t.includes("Couldn’t highlight")));
  const toast = (await page.locator(".toast").allInnerTexts()).join(" ");
  if (/01M6Y|text not found/.test(toast)) throw new Error(`the toast shows the core's words: ${toast}`);
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
});

/** The middle of a phrase in the reader, scrolled into view. */
async function pointAt(page: Page, phrase: string) {
  return (await page.evaluate((phrase) => {
    const walk = document.createTreeWalker(document.querySelector(".doc")!, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
      const i = n.data.indexOf(phrase);
      if (i < 0) continue;
      n.parentElement!.scrollIntoView({ block: "center" });
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + phrase.length);
      const b = r.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }
  }, phrase))!;
}

journey("highlight: a drag that starts right after a double click keeps both, the word without a popup", async (page) => {
  await openSource(page, TESTING);
  const kept = () => page.evaluate(() => [...(CSS.highlights.get("hl-keep") ?? [])].map((r) => r.toString()));
  const active = () => page.evaluate(() => [...(CSS.highlights.get("hl-active") ?? [])].map((r) => r.toString()).join("|"));
  await page.waitForTimeout(300);
  const word = await pointAt(page, "laboratory");
  await page.mouse.dblclick(word.x, word.y);
  await select(page, "Free recall, short-answer questions"); // within the double-click time
  await page.getByRole("dialog", { name: "Highlight" }).waitFor();
  await until("the drag's passage is highlighted, its popup open", async () => (await active()).startsWith("Free recall, short-answer questions"));
  await until("the word is kept too", async () => (await kept()).includes("laboratory"));
});

journey("highlight: a triple click whose selection runs past the text keeps the double click's word", async (page) => {
  await openSource(page, TESTING);
  const kept = () => page.evaluate(() => [...(CSS.highlights.get("hl-keep") ?? [])].map((r) => r.toString()));
  await page.waitForTimeout(300);
  const word = await pointAt(page, "Decades");
  await page.mouse.dblclick(word.x, word.y);
  // WebKit's triple click on the last paragraph selects past the end of the text: the reader can't
  // highlight that, so the word he double-clicked stays his.
  await page.evaluate(({ x, y }) => {
    const p = document.elementFromPoint(x, y)!.closest("p")!;
    const r = document.createRange();
    r.setStart(p, 0);
    r.setEnd(document.body, document.body.childNodes.length);
    const sel = getSelection()!;
    sel.removeAllRanges();
    for (const type of ["mousedown", "mouseup"]) {
      if (type === "mouseup") sel.addRange(r);
      p.dispatchEvent(new MouseEvent(type, { bubbles: true, detail: 3, button: 0, clientX: x, clientY: y }));
    }
  }, word);
  await until("the word is highlighted", async () => (await kept()).includes("Decades"));
});

journey("highlight: an edge move that fails to save leaves it untouched, so Esc still drops it", async (page) => {
  await openSource(page, AGENTS);
  const kept = () => page.evaluate(() => [...(CSS.highlights.get("hl-keep") ?? [])].map((r) => r.toString()));
  const popup = page.getByRole("dialog", { name: "Highlight" });
  const fail = (on: boolean) => page.evaluate((on) => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = on ? { annotate: "The library is busy." } : {}), on);
  await page.waitForTimeout(300);
  await select(page, "Agents are systems where the model"); // a passage no other journey highlights
  await popup.waitFor();
  await until("the highlight is saved", async () => (await kept()).includes("Agents are systems where the model"));
  const knob = (await page.locator(".grab-edge.end").boundingBox())!;
  const to = await pointAt(page, "tool usage");
  await fail(true);
  await page.mouse.move(knob.x + knob.width / 2, knob.y + knob.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await until("the move fails and says so", async () => (await page.locator(".toast").allInnerTexts()).some((t) => t.includes("The library is busy.")));
  await fail(false);
  await until("the edge is back where it was", async () => (await kept()).includes("Agents are systems where the model"));
  await page.keyboard.press("Escape");
  await until("Esc drops the untouched highlight", async () => !(await kept()).some((t) => t.startsWith("Agents are systems")));
});

journey("highlight: an edge he dragged is his, so Esc keeps the highlight and ⌘Z moves the edge back", async (page) => {
  await openSource(page, AGENTS);
  const kept = () => page.evaluate(() => [...(CSS.highlights.get("hl-keep") ?? [])].map((r) => r.toString()));
  const popup = page.getByRole("dialog", { name: "Highlight" });
  await page.waitForTimeout(300);
  await select(page, "That might mean not building"); // a passage no other journey highlights
  await popup.waitFor();
  await until("the highlight is saved", async () => (await kept()).includes("That might mean not building"));
  const knob = (await page.locator(".grab-edge.end").boundingBox())!;
  const to = (await page.evaluate(() => {
    const walk = document.createTreeWalker(document.querySelector(".doc")!, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
      const i = n.data.indexOf("is often enough.");
      if (i < 0) continue;
      const r = document.createRange();
      r.setStart(n, i + "is often enough.".length - 1);
      r.setEnd(n, i + "is often enough.".length);
      const b = r.getBoundingClientRect();
      return { x: b.right - 1, y: b.top + b.height / 2 };
    }
  }))!;
  await page.mouse.move(knob.x + knob.width / 2, knob.y + knob.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  const long = "That might mean not building an agent at all: a single call with retrieval and good examples is often enough.";
  await until("the edge moved", async () => (await kept()).includes(long));
  await page.waitForTimeout(300); // the move is saved
  await page.keyboard.press("Escape");
  await popup.waitFor({ state: "hidden" });
  await page.waitForTimeout(300);
  if (!(await kept()).includes(long)) throw new Error(`Esc dropped the resized highlight: ${JSON.stringify(await kept())}`);
  await page.keyboard.press("Meta+z");
  await until("⌘Z puts the edge back", async () => (await kept()).includes("That might mean not building"));
});

journey("highlight note: what he types is kept when he clicks away or presses Esc, and after a reload", async (page) => {
  await openSource(page, AGENTS);
  const note = page.getByRole("dialog", { name: "Highlight" }).getByLabel("Note");
  /** Clicks the middle of a phrase in the reader: a highlight there opens its popup. */
  const clickOn = async (phrase: string) => {
    const at = await page.evaluate((phrase) => {
      const walk = document.createTreeWalker(document.querySelector(".doc")!, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
        const i = n.data.indexOf(phrase);
        if (i < 0) continue;
        n.parentElement!.scrollIntoView({ block: "center" });
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + phrase.length);
        const b = r.getClientRects()[0]!;
        return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      }
      return null;
    }, phrase);
    if (!at) throw new Error(`“${phrase}” is not in the reader`);
    await page.mouse.click(at.x, at.y);
  };
  const reopen = async (phrase: string, typed: string) => {
    await clickOn(phrase);
    await until(`the note reads “${typed}”`, async () => (await note.isVisible()) && (await note.inputValue()) === typed);
  };

  await select(page, "Prompt chaining decomposes a task");
  await note.click();
  await page.keyboard.type("Each step feeds the next");
  await clickOn("Workflows are systems where language models"); // click away, as he does
  await until("the popup closes", async () => !(await note.isVisible()));
  await reopen("decomposes a task", "Each step feeds the next");
  await clickOn("Workflows are systems where language models");

  await select(page, "The orchestrator-workers pattern");
  await note.click();
  await page.keyboard.type("How is it unlike routing?");
  await page.keyboard.press("Escape");
  await until("Esc closes the popup", async () => !(await note.isVisible()));
  await reopen("orchestrator-workers", "How is it unlike routing?");
  await clickOn("Workflows are systems where language models");

  // The highlight's save lands while he is typing (1 run in 10 lost the note, 2026-11-06): hold the
  // save, then let it land and type in the same moment, before the reader has redrawn.
  await page.evaluate(() => {
    const real = window.fetch;
    window.fetch = (async (url: RequestInfo, init?: RequestInit) => {
      if (!String(init?.body ?? "").includes('"highlight"')) return real(url, init);
      window.fetch = real;
      // Read in full first, so once let go it reaches the reader in microtasks alone.
      const j = await (await real(url, init)).json();
      await new Promise((go) => ((window as unknown as { __land: () => void }).__land = () => go(null)));
      return { ok: true, json: async () => j } as Response;
    }) as typeof fetch;
  });
  await select(page, "Routing classifies an input");
  await note.click();
  await page.keyboard.type("Pick a path");
  await page.waitForFunction(() => "__land" in window);
  await page.evaluate(async () => {
    (window as unknown as { __land: () => void }).__land();
    for (let i = 0; i < 200; i++) await null; // the save's handlers run; the redraw waits for a task
    const field = document.querySelector<HTMLTextAreaElement>('[role=dialog][aria-label=Highlight] textarea')!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, field.value + " first");
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.keyboard.type(", then answer");
  await clickOn("Workflows are systems where language models");
  await until("the popup closes", async () => !(await note.isVisible()));
  await reopen("Routing classifies an input", "Pick a path first, then answer");

  await page.reload();
  await openSource(page, AGENTS);
  await reopen("decomposes a task", "Each step feeds the next");
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
  // The byline shows at once; reload only once the redo's write has reached the library (slow on CI).
  // Watched from the redo on, so the first add's write (still landing on CI) doesn't count.
  const posts: string[] = [];
  const watch = (r: import("playwright").Request) => r.method() === "POST" && posts.push(r.postData() ?? "");
  page.on("request", watch);
  const saved = page.waitForResponse((r) => r.request().method() === "POST" && (r.request().postData() ?? "").includes("Henry Roediger") && posts.includes(r.request().postData() ?? ""));
  await page.keyboard.press("Meta+Shift+z");
  await by.filter({ hasText: "Henry Roediger" }).waitFor();
  await saved;
  page.off("request", watch);
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

journey("notes: a click on the empty space under a note puts the caret at its end (Notion), in the source note and the skill note", async (page) => {
  const typedAtEnd = async (scope: string, line: string) =>
    until(`${scope}: the line lands at the end of the note`, () =>
      page.locator(`${scope} .ProseMirror`).evaluate((pm, l) => (pm.textContent ?? "").trimEnd().endsWith(l), line));
  await openSource(page, AGENTS);
  if (!(await page.locator(".mynotes").count())) await page.keyboard.press("n");
  await page.locator(".mynotes .ProseMirror").waitFor();
  const panel = page.locator(".mynotes-text");
  const box = (await panel.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 30);
  const a = `Clicked below the source note (${Date.now() % 100000})`;
  await page.keyboard.type(a);
  await typedAtEnd(".mynotes", a);
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  await page.locator(".skill-note .ProseMirror").waitFor();
  const col = page.locator(".skill-col").first();
  const c = (await col.boundingBox())!;
  await page.mouse.click(c.x + c.width / 2, c.y + c.height - 20);
  const b = `Clicked below the skill note (${Date.now() % 100000})`;
  await page.keyboard.type(b);
  await typedAtEnd(".skill-note", b);
});

journey("prequestion: a guess typed but not stored is still there when he comes back to the source, and not marked answered", async (page) => {
  const q = "When is an agent the wrong choice?";
  const guess = `When a fixed workflow does the job (${Date.now() % 100000})`;
  await openSource(page, AGENTS);
  const line = page.getByRole("textbox", { name: q });
  if (!(await line.isVisible())) await page.locator(".preq-head").click();
  await page.locator(".preq-q").filter({ hasText: q }).click();
  await line.fill(guess);
  await openSource(page, TESTING);
  await openSource(page, AGENTS);
  await until("the guess is back in its line", async () => (await line.isVisible()) && (await line.inputValue()) === guess);
  if (await page.locator(".preq-row.done").filter({ hasText: q }).count()) throw new Error("the draft was marked answered");
});

journey("note: / makes a toggle heading and @ writes a date; both are still there after a reload", async (page) => {
  const d = new Date(Date.now() + 864e5);
  const tomorrow = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  await openSource(page, AGENTS);
  await page.locator(".note-editor [contenteditable=true]").first().click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/toggleheading2");
  await page.locator(".note-menu-row.on", { hasText: "Toggle heading 2" }).waitFor();
  await page.keyboard.press("Enter");
  await page.keyboard.type("Why agents");
  await page.keyboard.press("Enter"); // into the toggle's first line
  await page.keyboard.type("Plan first, @tom");
  await page.locator(".note-menu-row.on", { hasText: "Tomorrow" }).waitFor();
  await page.keyboard.press("Enter");
  const kept = async () =>
    (await page.locator('.note-editor .toggle[data-level="2"] .toggle-summary', { hasText: "Why agents" }).isVisible()) &&
    (await page.locator(".note-editor .toggle p", { hasText: `Plan first, ${tomorrow}` }).isVisible());
  await until("a toggle heading with the date under it", kept);
  await page.waitForTimeout(600); // the note saves after a pause
  await page.reload();
  await openSource(page, AGENTS);
  await until("both survive a reload", kept);
});

journey("note shortcuts as in Notion: # in a numbered item makes a heading; Markdown pasted into the note comes in as blocks and adds no source", async (page) => {
  const html = () => page.locator(".note-editor .ProseMirror").innerHTML();
  await openSource(page, AGENTS);
  await page.locator(".note-editor [contenteditable=true]").first().click();
  // From an empty note: ⌘A twice takes every block, Backspace clears them (other journeys write here).
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await until("the note is empty", async () => !(await page.locator(".note-editor .ProseMirror").innerText()).trim());
  await page.keyboard.type("1. What is AI?");
  await page.keyboard.press("Enter");
  await page.keyboard.type("The Foundations");
  // Line start and end as each platform's text fields take them: on a Mac, Home and End scroll and leave the caret.
  const mac = process.platform === "darwin";
  await page.keyboard.press(mac ? "Meta+ArrowLeft" : "Home");
  await page.keyboard.type("# ");
  await until("the item is a heading", async () => /<h1[^>]*>The Foundations/.test(await html()));
  // A key sent within a frame of the last can beat the editor's own redraw; a hand never does.
  await page.waitForTimeout(100);
  await page.keyboard.press(mac ? "Meta+ArrowRight" : "End");
  await page.waitForTimeout(100);
  await page.keyboard.press("Enter");
  // A paste as the Mac gives it, without the clipboard permission a real one needs here: its target is
  // the line the caret is on, which the paste replaces.
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData("text/plain", "## Pasted\n\n- one\n- two");
    const at = getSelection()!.anchorNode!;
    (at instanceof Element ? at : at.parentElement!).dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await until("the paste is blocks", async () => /<h2[^>]*>Pasted<\/h2>/.test(await html()) && /<li[^>]*><p>one<\/p>/.test(await html()));
  await page.waitForTimeout(400);
  if (await page.locator(".toast", { hasText: "Added" }).count()) throw new Error("the paste also added a source");
  await page.locator(".doc-head").filter({ hasText: AGENTS }).waitFor();
});

journey("note images: a pasted screenshot and an image dropped from Finder go into the note, not the library, and ⌘Z takes one out", async (page) => {
  const pm = page.locator(".note-editor .ProseMirror").first();
  await openSource(page, AGENTS);
  await pm.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  // A 1×1 PNG on the clipboard, as ⌃⇧⌘4 leaves a screenshot: no text with it.
  await pm.evaluate((el) => {
    const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([png], "image.png", { type: "image/png" }));
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await until("the screenshot is in the note", async () => (await pm.locator('img.note-image[src*="pasted"]').count()) === 1);
  // From Finder the app hears the drop (Tauri) and hands the note its paths.
  const file = join(mkdtempSync(join(tmpdir(), "ore-drop-")), "Whiteboard.png");
  writeFileSync(file, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
  const box = (await pm.locator("p").first().boundingBox())!;
  const at = { x: box.x + 20, y: box.y + 2 };
  await page.locator(".note-editor").first().evaluate((el, at) => el.dispatchEvent(new CustomEvent("ore-image-drag", { detail: at })), at);
  await page.locator(".note-editor .block-drop").waitFor();
  await page.locator(".note-editor").first().evaluate((el, d) => el.dispatchEvent(new CustomEvent("ore-image-drop", { detail: d })), { paths: [file], ...at });
  await until("the dropped image is in the note, above the first line", async () => (await pm.locator('img.note-image[src*="whiteboard"]').count()) === 1);
  if (await page.locator(".note-editor .block-drop").count()) throw new Error("the drop line stayed");
  await page.keyboard.press("ControlOrMeta+z");
  await until("⌘Z takes the dropped one out", async () => (await pm.locator('img.note-image[src*="whiteboard"]').count()) === 0);
  if (await page.locator(".toast", { hasText: "Added" }).count()) throw new Error("an image was added as a source");
});

journey("note keys as in Notion: /h1 finds Heading 1, a / closed with Esc opens again, ⌘K links the selected words, ⌘↵ closes a toggle", async (page) => {
  const pm = page.locator(".note-editor .ProseMirror").first();
  const rows = async () => (await page.locator(".note-menu-row").allInnerTexts()).map((r) => r.split("\n")[0]);
  await openSource(page, AGENTS);
  await pm.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("/h1", { delay: 20 });
  await until("/h1 offers Heading 1 alone", async () => (await rows()).join() === "Heading 1");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("/", { delay: 20 });
  await until("a new / opens the menu again", async () => (await rows()).length > 5);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("Read the guide", { delay: 10 });
  await page.keyboard.press("Shift+Home");
  await page.waitForTimeout(150); // the editor takes the selection a moment after the page shows it
  await page.keyboard.press("Meta+k"); // the palette's key, in the note with words selected
  await page.getByPlaceholder("Paste a link").waitFor();
  await page.keyboard.type("example.com/guide");
  await page.keyboard.press("Enter");
  await until("the words link to it", async () => (await pm.locator('a[href="https://example.com/guide"]').innerText().catch(() => "")) === "Read the guide");
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("> Why", { delay: 20 });
  await page.keyboard.press("Enter");
  await page.keyboard.type("Because", { delay: 10 });
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(150);
  await page.keyboard.press("ControlOrMeta+Enter");
  await until("the toggle closes", async () => (await page.locator(".note-editor .toggle.closed").count()) === 1);
  await page.keyboard.press("ControlOrMeta+Enter");
  await until("and opens", async () => (await page.locator(".note-editor .toggle.closed").count()) === 0);
});

journey("note tables: / makes one, Tab adds a row, the column grip deletes a column, + adds a row; kept after a reload; widen and back", async (page) => {
  const cells = () => page.locator(".note-editor .note-table tr").evaluateAll((rs) => rs.map((r) => [...r.children].map((c) => c.textContent ?? "")));
  await openSource(page, AGENTS);
  await page.locator(".note-editor [contenteditable=true]").first().click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/table");
  await page.locator(".note-menu-row.on", { hasText: "Table" }).waitFor();
  await page.keyboard.press("Enter");
  await until("a 3 by 3 table", async () => (await cells()).length === 3 && (await cells())[0]!.length === 3);
  // Header, then the two rows, cell by cell; Tab in the last cell makes a fourth row.
  for (const t of ["Tool", "Use", "Cost", "Search", "Find", "Low", "Code", "Run", "High"]) {
    await page.keyboard.type(t);
    await page.keyboard.press("Tab");
  }
  await page.keyboard.type("Memory");
  await until("Tab in the last cell added a row", async () => JSON.stringify(await cells()) === JSON.stringify([["Tool", "Use", "Cost"], ["Search", "Find", "Low"], ["Code", "Run", "High"], ["Memory", "", ""]]));
  await page.locator(".note-editor .note-table th", { hasText: "Use" }).hover();
  await page.locator(".table-grip.cols").click();
  await page.getByRole("menuitem", { name: "Delete column" }).click();
  await until("the column is gone", async () => (await cells())[0]!.join() === "Tool,Cost");
  await page.locator(".note-editor .note-table td", { hasText: "Memory" }).hover();
  await page.locator(".table-add.rows").click();
  await until("+ added a row", async () => (await cells()).length === 5);
  await page.waitForTimeout(600); // the note saves after a pause
  await page.reload();
  await openSource(page, AGENTS);
  await until("the table survives a reload", async () => (await cells()).length === 5 && (await cells())[3]!.join() === "Memory,");
  // The skill page's widen button gives the note the whole page, and back.
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  const side = page.locator(".skill-col.side");
  await side.waitFor();
  await page.getByRole("button", { name: "Widen your note" }).click();
  await until("the side column hides", async () => !(await side.isVisible()));
  await page.getByRole("button", { name: "Narrow your note" }).click();
  await until("and comes back", () => side.isVisible());
});

journey("skill note: Esc selects the block, a second Esc leaves the note so the page's keys work", async (page) => {
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  const pm = page.locator(".skill-note .note-editor .ProseMirror");
  await pm.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("A line to leave");
  await page.waitForTimeout(100);
  await page.keyboard.press("Escape");
  await until("Esc selects the block", async () => (await page.locator(".skill-note .block-sel").count()) === 1);
  await page.keyboard.press("Escape");
  await until("the second Esc leaves the note", async () => !(await pm.evaluate((e) => e.contains(document.activeElement))));
  await page.keyboard.press("ControlOrMeta+z");
});

journey("skill picker: a filing that fails takes its tick back, on Home and in the reader, and clicking the skill again files it", async (page) => {
  type W = { __ORE_FAIL?: Record<string, string> };
  const check = async (button: ReturnType<Page["locator"]>) => {
    await button.click();
    const picker = page.locator(".skill-picker");
    const name = (await picker.getByRole("option").filter({ hasNot: page.locator("svg") }).first().locator(".menu-label").innerText()).trim();
    const target = picker.getByRole("option").filter({ has: page.locator(".menu-label", { hasText: name }) });
    const ticked = async () => (await target.locator("svg").count()) > 0; // the check
    await page.evaluate(() => void ((window as unknown as W).__ORE_FAIL = { edit: "The disk is full." }));
    await target.click();
    await page.locator(".toast", { hasText: "The disk is full." }).waitFor();
    await until(`the failed tick on ${name} goes back`, async () => !(await ticked()));
    await page.evaluate(() => void ((window as unknown as W).__ORE_FAIL = {}));
    await target.click();
    await page.locator(".toast", { hasText: `under ${name}` }).waitFor();
    if (!(await ticked())) throw new Error("clicking again did not file it");
    await target.click(); // as it was, for the journeys after this one
    await page.locator(".toast", { hasText: `from ${name}` }).waitFor();
    await page.keyboard.press("Escape");
    await picker.waitFor({ state: "detached" });
  };
  await check(page.locator(".home").getByRole("button", { name: /^Skills for / }).first());
  await openSource(page, TESTING);
  await check(page.getByRole("button", { name: `Skills for ${TESTING}` }));
});

journey("source title: one click renames it in place, Enter saves, Esc keeps the old one, ⌘Z takes it back", async (page) => {
  await openSource(page, AGENTS);
  await page.locator(".doc-head h1").click();
  const field = page.getByLabel("Title");
  await field.waitFor();
  await field.fill("Agents, renamed");
  await page.keyboard.press("Escape");
  await until("Esc keeps the old title", async () => (await page.locator(".doc-head h1").innerText()) === AGENTS);
  await page.locator(".doc-head h1").click();
  await page.getByLabel("Title").fill("Agents, renamed");
  await page.keyboard.press("Enter");
  await until("Enter saves it", async () => (await page.locator(".doc-head h1").innerText()) === "Agents, renamed");
  await page.waitForTimeout(300); // the rename's write lands, then its step is on the history
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Meta+z");
  await until("⌘Z puts the old title back", async () => (await page.locator(".doc-head h1").innerText()) === AGENTS);
});

journey("Home: Continue reading rows rename from their menu, in place; Esc keeps the title, ⌘Z takes it back", async (page) => {
  // Opened last, so sources other journeys added and opened don't push it off the list.
  await openSource(page, TESTING);
  await page.getByRole("button", { name: /^Home/ }).click();
  const row = page.locator(".home-read").filter({ hasText: "The Testing Effect" }).first();
  await row.waitFor();
  const title = () => row.locator(".title").innerText();
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  await page.locator(".home-read").getByLabel("Title").fill("Testing, renamed");
  await page.keyboard.press("Escape");
  await until("Esc keeps the old title", async () => (await title()) === TESTING);
  await until("and gives the row its focus back", () => row.evaluate((el) => el === document.activeElement));
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  await page.locator(".home-read").getByLabel("Title").fill("Testing, renamed");
  await page.keyboard.press("Enter");
  const renamed = page.locator(".home-read").filter({ hasText: "Testing, renamed" });
  await until("Enter saves it", async () => (await renamed.count()) === 1);
  await page.waitForTimeout(300);
  await page.keyboard.press("Meta+z");
  await until("⌘Z puts the old title back", async () => (await row.locator(".title").count()) === 1 && (await title()) === TESTING);
});

journey("sidebar: renaming a collection to a name another one has is refused in place; Esc keeps the old name", async (page) => {
  const head = page.locator(".side-head").filter({ hasText: /^Craft$/i });
  await head.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  const field = page.getByLabel("Collection name");
  await field.fill("life");
  await page.keyboard.press("Enter");
  await page.getByRole("alert").filter({ hasText: "is taken" }).waitFor();
  await until("the field stays open", () => field.isVisible());
  // "Other" names the skills in no collection: a collection by that name would be a second, twin header.
  await field.fill("other");
  await page.keyboard.press("Enter");
  await page.getByRole("alert").filter({ hasText: "“other” is taken" }).waitFor();
  await field.fill("Making");
  await until("typing clears the refusal", async () => (await page.getByRole("alert").filter({ hasText: "is taken" }).count()) === 0);
  await page.keyboard.press("Escape");
  await until("Esc keeps the old name, and Life is still its own", async () => (await page.locator(".side-label-text").allInnerTexts()).filter((t) => /^(craft|life)$/i.test(t)).length === 2);
});

journey("skill editor: a rename whose save fails keeps the name he typed and the dialog open; Enter again saves it", async (page) => {
  const fail = (why: string | null) => page.evaluate((why) => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = why ? { skills: why } : {}), why);
  await page.locator(".sidebar .side-item", { hasText: "Habits" }).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit skill…" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit skill Habits" });
  const field = dialog.getByLabel("Rename Habits");
  await field.fill("Habit loops");
  await fail("The library is read-only.");
  await field.press("Enter");
  await page.locator(".toast[role=alert]").filter({ hasText: "The library is read-only." }).waitFor();
  await page.waitForTimeout(200);
  if (!(await dialog.isVisible())) throw new Error("the failed rename closed the dialog");
  if ((await field.inputValue()) !== "Habit loops") throw new Error("the failed rename lost the name he typed");
  await fail(null);
  await field.press("Enter");
  await dialog.waitFor({ state: "detached" });
  await page.locator(".sidebar .side-item", { hasText: "Habit loops" }).first().waitFor();
  // Put the name back for the journeys after this one.
  await page.keyboard.press("Meta+z");
  await page.locator(".sidebar .side-item", { hasText: /^Habits$/ }).first().waitFor();
});

journey("pinned sources: Move up and a drag put them in his order; ⌘Z takes a move back", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  const row = (t: string) => page.locator(".row").filter({ hasText: t }).first();
  const menu = async (t: string, item: string) => {
    await row(t).click({ button: "right" });
    await page.getByRole("menuitem", { name: item }).click();
  };
  const pinned = () => page.locator(".row.pinned .title").allInnerTexts();
  // A list read that answers after the move was read before it: it must not undo the move on screen.
  await page.evaluate(() => ((window as unknown as { __ORE_SLOW: object }).__ORE_SLOW = { ls: 1200 }));
  await menu(AGENTS, "Pin to top");
  await menu(TESTING, "Pin to top");
  await until("pinned in the order pinned", async () => (await pinned()).join("|") === [AGENTS, TESTING].join("|"));
  await menu(TESTING, "Move up");
  await page.waitForTimeout(2000);
  await page.evaluate(() => ((window as unknown as { __ORE_SLOW?: object }).__ORE_SLOW = undefined));
  await until("Move up puts it first", async () => (await pinned()).join("|") === [TESTING, AGENTS].join("|"));
  await page.waitForTimeout(300);
  await page.keyboard.press("Meta+z");
  await until("⌘Z puts it back", async () => (await pinned()).join("|") === [AGENTS, TESTING].join("|"));
  const from = (await row(TESTING).boundingBox())!;
  const to = (await row(AGENTS).boundingBox())!;
  await page.mouse.move(from.x + 60, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 60, to.y + 4, { steps: 8 });
  await page.locator(".row-drop").waitFor();
  await page.mouse.up();
  await until("the drag puts it first", async () => (await pinned()).join("|") === [TESTING, AGENTS].join("|"));
  await menu(TESTING, "Unpin");
  await menu(AGENTS, "Unpin");
  await until("unpinned again", async () => (await pinned()).length === 0);
});

journey("shortcuts: resetting one to a default another command took since asks before replacing it", async (page) => {
  await page.keyboard.press("Meta+Comma");
  await page.getByRole("tab", { name: "Keyboard shortcuts" }).or(page.getByRole("button", { name: "Keyboard shortcuts" })).first().click();
  const edit = (what: string) => page.getByRole("button", { name: new RegExp(`^${what}: .*Press to change$`) });
  const keysOf = async (what: string) => (await edit(what).getAttribute("aria-label")) ?? "";
  const rebindTo = async (what: string, key: string) => {
    await edit(what).click();
    await page.keyboard.press(key);
  };
  await rebindTo("Slower", "Control+Alt+j");
  await until("Slower has its new keys", async () => !(await keysOf("Slower")).includes("["));
  await rebindTo("Faster", "BracketLeft"); // Slower's default, free now
  await until("Faster has [", async () => (await keysOf("Faster")).includes("["));
  await page.getByRole("button", { name: "Reset Slower to [" }).click();
  await page.getByRole("alert").filter({ hasText: "Faster" }).waitFor();
  await until("nothing changed yet", async () => (await keysOf("Faster")).includes("["));
  await page.getByRole("button", { name: "Replace" }).click();
  await until("Slower has [ again and Faster has none", async () => (await keysOf("Slower")).includes("[") && (await keysOf("Faster")).includes("Not assigned"));
  // Put the keys back for the journeys after this one.
  await page.getByRole("button", { name: /^Reset Faster to / }).click();
  await until("Faster has ] again", async () => (await keysOf("Faster")).includes("]"));
  await page.keyboard.press("Escape");
});

/** Walks a menu with ↓ to the item named `label` and picks it with ↵, as he does without the mouse. */
async function pickWithKeys(page: Page, label: string) {
  const at = () => page.evaluate(() => (document.activeElement?.getAttribute("role") === "menuitem" ? document.activeElement.textContent ?? "" : ""));
  // Radix moves focus to the next item on a timer: each ↓ waits for its move, as a held key's repeat would.
  for (let i = 0, now = await at(); i < 16 && !now.startsWith(label); i++) {
    await page.keyboard.press("ArrowDown");
    const was = now;
    await until("↓ moves the focus", async () => (now = await at()) !== was, 1000).catch(() => {});
  }
  if (!(await at()).startsWith(label)) throw new Error(`no “${label}” in the menu (at “${await at()}”)`);
  await page.keyboard.press("Enter");
}

const hasCaret = (page: Page, sel: string) => page.locator(sel).evaluate((el) => el === document.activeElement).catch(() => false);

journey("row menu by keyboard: ↓ and ↵ stay in the menu, never move or open the list under it; Rename… opens the title in place", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  const rows = page.locator(".row");
  await rows.nth(2).waitFor();
  await rows.nth(1).click({ button: "right" });
  await page.getByRole("menu").waitFor();
  await pickWithKeys(page, "Rename…");
  await until("the title field has the caret", () => hasCaret(page, ".row-rename"));
  await page.waitForTimeout(300);
  if (!(await hasCaret(page, ".row-rename"))) throw new Error("the title field lost the caret");
  if (await page.locator(".doc-head").count()) throw new Error("↵ in the menu also opened a source");
  if (await page.locator(".row[aria-selected=true]").count()) throw new Error("↓ in the menu moved the list's selection");
  await page.keyboard.press("Escape");
});

journey("⋯ menus by keyboard: Edit author… and New skill open their field with the caret in it", async (page) => {
  await openSource(page, AGENTS);
  await page.getByRole("button", { name: "Source actions" }).click();
  await pickWithKeys(page, "Edit author…");
  await until("the author field has the caret", () => hasCaret(page, ".author-edit"));
  await page.waitForTimeout(300);
  if (!(await hasCaret(page, ".author-edit"))) throw new Error("the author field lost the caret");
  await page.keyboard.press("Escape");
  await page.locator(".side-head", { hasText: "Craft" }).hover();
  await page.getByRole("button", { name: "Actions for Craft" }).click();
  await pickWithKeys(page, "New skill");
  const name = '[aria-label="New skill name"]';
  await until("the new skill field has the caret", () => hasCaret(page, name));
  await page.waitForTimeout(300);
  if (!(await hasCaret(page, name))) throw new Error("the new skill field lost the caret");
  await page.keyboard.press("Escape");
});

journey("sidebar: New collection “Other” names a skill among the ungrouped ones, in the sidebar and in ⌘K", async (page) => {
  const box = (await page.locator(".sidebar").boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 20, { button: "right" });
  await page.getByRole("menuitem", { name: "New collection" }).click();
  await page.getByLabel("New collection name").fill("Other");
  await page.keyboard.press("Enter");
  await page.locator('.sidebar [role=group][aria-label="Other"]').getByLabel("New skill name").waitFor();
  await page.keyboard.press("Escape");
  // In ⌘K, naming it Other adds a skill to the skills in no collection, as an existing name joins that one.
  await page.keyboard.press("Meta+k");
  await page.keyboard.type("New collection");
  await page.keyboard.press("Enter");
  await page.keyboard.type("other");
  await page.getByRole("option", { name: "Add a skill to “Other”" }).waitFor();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await until("one Other heading", async () => (await page.locator(".side-label-text").allInnerTexts()).filter((t) => /^other$/i.test(t)).length === 1);
});

journey("a row's ⋯ menu in a short window stays inside it, scrolling, as its right-click twin does", async (page) => {
  await page.setViewportSize({ width: 900, height: 480 }); // Tauri's smallest window
  await page.getByRole("button", { name: /^All sources/ }).click();
  const rows = page.locator(".row");
  await rows.nth(2).waitFor();
  const last = rows.last();
  await last.scrollIntoViewIfNeeded();
  await last.hover();
  await last.getByRole("button", { name: /^Actions for/ }).click();
  const menu = page.locator(".menu-list").last();
  await menu.waitFor();
  await page.waitForTimeout(200);
  const box = (await menu.boundingBox())!;
  if (box.y < 0 || box.y + box.height > 480) throw new Error(`the menu runs out of the window: top ${box.y}, bottom ${box.y + box.height}`);
  await page.keyboard.press("Escape");
});

journey("icon picker: it opens with the caret in Filter, so typing searches at once (Notion), from Edit skill and the skill page", async (page) => {
  const typed = async () => {
    await page.locator(".picker-search").first().waitFor();
    await page.keyboard.type("star");
    await until("Filter has what he typed", async () => (await page.locator(".picker-search").first().inputValue()) === "star");
    await page.keyboard.press("Escape");
    await page.locator(".picker").waitFor({ state: "detached" });
  };
  // Habits has an icon, so its picker opens on Icons: ~1,700 pixel icons, drawn as they scroll into view.
  await page.locator(".sidebar .side-item", { hasText: "Habits" }).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit skill…" }).click();
  await page.getByRole("dialog", { name: "Edit skill Habits" }).getByRole("button", { name: "Change icon" }).click();
  await typed();
  await page.keyboard.press("Escape");
  await page.locator(".sidebar .side-item", { hasText: "Storytelling" }).first().click();
  await page.locator(".skill-badge").click();
  await typed();
});

journey("peeked sidebar: it stays while its own menu is open, and slides away once nothing holds it, after Esc from a new skill too", async (page) => {
  const shown = () => page.locator(".sidebar").evaluate((s) => !(s as HTMLElement).hidden);
  const peek = async () => {
    await page.mouse.move(600, 400);
    await page.mouse.move(1, 400, { steps: 5 });
    await until("it peeks out", shown);
  };
  await page.getByRole("button", { name: "Hide sidebar" }).click();
  await until("the sidebar hides", async () => !(await shown()));
  await peek();
  await page.locator(".sidebar .side-item", { hasText: "Habits" }).first().click({ button: "right" });
  const menu = page.getByRole("menu");
  const m = (await menu.boundingBox())!;
  await page.mouse.move(m.x + m.width - 10, m.y + m.height - 6, { steps: 5 }); // off the sidebar
  await page.waitForTimeout(900);
  if (!(await shown())) throw new Error("the sidebar slid away under its own menu");
  await page.keyboard.press("Escape");
  await page.mouse.move(900, 400, { steps: 5 });
  await until("it slides away once the menu is closed", async () => !(await shown()));
  await peek();
  await page.locator(".side-section", { hasText: "Life" }).hover();
  await page.getByRole("button", { name: "New skill in Life" }).click();
  await page.keyboard.type("Peek skill");
  await page.mouse.move(900, 400, { steps: 5 });
  await page.waitForTimeout(700);
  if (!(await shown())) throw new Error("the sidebar slid away from the field he is typing in");
  await page.keyboard.press("Escape");
  await until("it slides away after Esc, with the pointer gone", async () => !(await shown()));
  // A menu opened in the page doesn't hold it: only its own menus do.
  await peek();
  const row = page.locator(".home-read").first();
  const r = (await row.boundingBox())!;
  await page.mouse.move(r.x + 40, r.y + r.height / 2, { steps: 5 });
  await row.click({ button: "right" });
  await page.getByRole("menu").waitFor();
  await until("it slides away under a menu of the page", async () => !(await shown()));
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Show sidebar" }).click();
});

journey("Settings: ⌘K and ⌘/ still work over it, leaving it for the palette or the shortcuts sheet (Linear)", async (page) => {
  const settings = page.getByRole("dialog", { name: "Settings" });
  await page.keyboard.press("Meta+Comma");
  await settings.waitFor();
  await page.keyboard.press("Meta+k");
  await page.getByRole("dialog", { name: "Command palette" }).waitFor();
  await settings.waitFor({ state: "detached" });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Meta+Comma");
  await settings.waitFor();
  await page.keyboard.press("Meta+Slash");
  await page.getByRole("dialog", { name: "Keyboard shortcuts" }).waitFor();
  await settings.waitFor({ state: "detached" });
  await page.keyboard.press("Escape");
  // While a shortcut is being recorded, ⌘K is the keys he is giving it.
  await page.keyboard.press("Meta+Comma");
  await settings.getByRole("tab", { name: "Keyboard shortcuts" }).click();
  await settings.getByRole("button", { name: /^Rename source: .*Press to change$/ }).click();
  await page.keyboard.press("Meta+k");
  await settings.getByRole("alert").filter({ hasText: "Command palette" }).waitFor();
  if (await page.getByRole("dialog", { name: "Command palette" }).count()) throw new Error("⌘K while recording opened the palette");
  await page.keyboard.press("Escape");
});

journey("Review: ⌘K and ⌘/ open over it, Esc goes back to the card, and a palette action leaves Review as Esc does (controls-08)", async (page) => {
  await startReview(page, /Teaching/); // its one due card is an Explain card, answered by typing
  const question = await page.locator(".review-q").innerText();
  const field = page.getByLabel("Your answer");
  await field.fill("half an answ");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await page.keyboard.press("Meta+k");
  await palette.waitFor();
  await page.keyboard.press("Escape");
  await palette.waitFor({ state: "detached" });
  if ((await page.locator(".review-q").innerText()) !== question) throw new Error("Esc in the palette left the card");
  if (!(await field.evaluate((el) => el === document.activeElement))) throw new Error("focus didn't go back to the answer");
  await page.keyboard.press("Meta+Slash");
  const sheet = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await sheet.waitFor();
  await page.keyboard.press("Escape");
  await sheet.waitFor({ state: "detached" });
  if ((await page.locator(".review-q").innerText()) !== question) throw new Error("Esc in the shortcuts sheet left the card");
  await page.keyboard.press("Meta+k");
  await palette.waitFor();
  await page.keyboard.type("Go to Feed");
  await page.keyboard.press("Enter");
  await page.locator(".review").waitFor({ state: "detached" });
  await page.locator(".home-goal").waitFor({ state: "detached" });
});

journey("sidebar: a new skill named like one he has is refused in place, in words, as a taken collection name is", async (page) => {
  await page.locator(".side-section", { hasText: "Craft" }).hover();
  await page.getByRole("button", { name: "New skill in Craft" }).click();
  await page.keyboard.type("  learning  ");
  await page.keyboard.press("Enter");
  await until("it says the name is taken", async () => (await page.locator(".side-new-foot").innerText()) === "“Learning” is taken");
  if (!(await page.getByLabel("New skill name").isVisible())) throw new Error("the field closed");
  await page.keyboard.press("Escape");
});

journey("Edit skill: the colours are one Tab stop, and ← → move and pick, as a radio group's do", async (page) => {
  await page.locator(".sidebar .side-item", { hasText: "Creativity" }).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit skill…" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit skill Creativity" });
  const picked = () => dialog.locator(".swatch[aria-checked=true]").getAttribute("aria-label");
  await dialog.getByRole("radio", { name: "No color" }).focus();
  // Held as a finger holds it: Radix picks on the focus its roving focus moves a tick later, while the key is down.
  await page.keyboard.press("ArrowRight", { delay: 50 });
  await until("→ picks the next colour", async () => (await picked()) !== "No color");
  const second = await picked();
  if (!(await page.evaluate(() => document.activeElement?.getAttribute("aria-checked") === "true"))) throw new Error("focus did not move with the pick");
  await page.keyboard.press("ArrowLeft", { delay: 50 });
  await until("← goes back to No color", async () => (await picked()) === "No color");
  await page.keyboard.press("Tab");
  if (await page.evaluate(() => document.activeElement?.classList.contains("swatch"))) throw new Error(`Tab went to another swatch, not past the row (${second})`);
  await page.keyboard.press("Escape");
});

journey("Settings: Esc in the review plan field drops the draft and keeps focus in Settings; the next Esc closes it", async (page) => {
  await page.keyboard.press("Meta+Comma");
  const settings = page.getByRole("dialog", { name: "Settings" });
  await settings.getByRole("tab", { name: "Review" }).click();
  const plan = settings.getByLabel("After what do you review?");
  const was = await plan.inputValue();
  await plan.click();
  await plan.fill("my coffee, half typed");
  await page.keyboard.press("Escape");
  await until("the draft is dropped", async () => (await plan.inputValue()) === was);
  if (!(await settings.evaluate((s) => s.contains(document.activeElement)))) throw new Error("focus left Settings");
  await page.keyboard.press("Escape");
  await settings.waitFor({ state: "detached" });
});

journey("icon picker: ↓ past the rows drawn so far draws the next ones and keeps the picked icon in view", async (page) => {
  await page.locator(".sidebar .side-item", { hasText: "Habits" }).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit skill…" }).click();
  await page.getByRole("dialog", { name: "Edit skill Habits" }).getByRole("button", { name: "Change icon" }).click();
  await page.locator(".picker-cell").nth(100).waitFor();
  for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowDown"); // onto the first row not drawn yet
  await until("the picked icon is in view", () =>
    page.evaluate(() => {
      const cell = document.querySelector(".picker-cell[data-active]")?.getBoundingClientRect();
      const box = document.querySelector(".picker-scroll")!.getBoundingClientRect();
      return !!cell && cell.top >= box.top - 1 && cell.bottom <= box.bottom + 1;
    }),
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
});

journey("sidebar: a skill dragged into another collection, ⌘Z puts it back", async (page) => {
  const inGroup = (group: string, skill: string) => page.locator(`.sidebar [role=group][aria-label="${group}"] .side-item`, { hasText: skill }).count();
  await until("Habits is in Life", async () => (await inGroup("Life", "Habits")) === 1);
  const from = (await page.locator(".sidebar .side-item", { hasText: "Habits" }).first().boundingBox())!;
  const to = (await page.locator(".sidebar .side-item", { hasText: "Storytelling" }).first().boundingBox())!;
  await page.mouse.move(from.x + 40, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y - 10, { steps: 4 });
  await page.mouse.move(to.x + 40, to.y + to.height * 0.75, { steps: 10 });
  await page.mouse.up();
  await until("it moved to Craft", async () => (await inGroup("Craft", "Habits")) === 1);
  await page.waitForTimeout(300);
  await page.keyboard.press("Meta+z");
  await until("⌘Z puts it back in Life", async () => (await inGroup("Life", "Habits")) === 1);
});

journey("skill note: coming back to a long note puts it where he left it", async (page) => {
  const ore = (args: string[]) => page.evaluate((args) => (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown) => Promise<{ text: string }> } }).__TAURI_INTERNALS__.invoke("ore", { args }), args);
  const was = (await ore(["notes", "--skill=learning"])).text;
  await ore(["notes", "--skill=learning", `--set=${Array.from({ length: 80 }, (_, i) => `Line ${i + 1} of a long note.`).join("\n\n")}`]);
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  await page.locator(".skill-note .ProseMirror").waitFor();
  const col = page.locator(".skill-col").first();
  await page.getByText("Line 80 of a long note.").waitFor();
  await col.evaluate((el) => (el.scrollTop = 900));
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  await page.getByText("Line 80 of a long note.").waitFor();
  await until("the note is where he left it", async () => Math.abs((await col.evaluate((el) => el.scrollTop)) - 900) <= 1);
  await ore(["notes", "--skill=learning", `--set=${was}`]);
});

journey("source note: Collected, the docked tutor and another source each come back to the same scroll and caret", async (page) => {
  const STORY = "A very long title about the neuroscience of habit formation";
  const ore = (args: string[]) => page.evaluate((args) => (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__.invoke("ore", { args }), args);
  const id = ((await ore(["ls"])) as { id: string; title: string }[]).find((i) => i.title.startsWith(STORY))!.id;
  await ore(["notes", id, `--set=${Array.from({ length: 80 }, (_, i) => `Line ${i + 1} of a long note.`).join("\n\n")}`]);
  await openSource(page, STORY);
  const side = page.locator(".mynotes");
  if (!(await side.count())) await page.keyboard.press("n");
  const panel = page.locator(".mynotes-text");
  await page.getByText("Line 80 of a long note.").waitFor();
  await panel.evaluate((el) => (el.scrollTop = 900));
  await page.waitForTimeout(100);
  // The caret in the middle of line 40, as he left it mid-sentence.
  const line = page.locator(".note-editor p", { hasText: /^Line 40 of a long note\.$/ });
  const box = (await line.boundingBox())!;
  await page.mouse.click(box.x + 30, box.y + box.height / 2);
  await page.waitForTimeout(100);
  const top = await panel.evaluate((el) => el.scrollTop);
  // Where the caret is once the note has focus; focused as Tab would, if the page kept it.
  const caret = async () => {
    await page.evaluate(() => document.activeElement?.closest(".note-editor") || document.querySelector<HTMLElement>(".mynotes .ProseMirror")?.focus());
    await page.waitForTimeout(50);
    return page.evaluate(() => `${getSelection()!.anchorNode?.textContent}@${getSelection()!.anchorOffset}`);
  };
  const at = await caret();
  if (!at.startsWith("Line 40 of a long note.@")) throw new Error(`the caret didn't land in line 40: ${at}`);
  const back = async (when: string) => {
    await page.getByText("Line 80 of a long note.").waitFor();
    await until(`the note is scrolled where he left it ${when}`, async () => Math.abs((await panel.evaluate((el) => el.scrollTop)) - top) <= 1);
    await until(`the caret is where he left it ${when}`, async () => (await caret()) === at);
  };
  await page.getByRole("tab", { name: "Collected" }).click();
  await page.getByRole("tab", { name: "Source note" }).click();
  await back("after Collected");
  await page.keyboard.press("Meta+j");
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  await tutor.getByRole("button", { name: "Dock to the side" }).click();
  await until("docked, the side panel steps aside", async () => (await side.count()) === 0);
  await page.keyboard.press("Meta+j");
  await back("after the docked tutor");
  await page.keyboard.press("Meta+j");
  await tutor.getByRole("button", { name: "Float over the page" }).click();
  await page.getByRole("textbox", { name: "Message the tutor" }).focus();
  await page.keyboard.press("Escape");
  await until("the tutor closes", async () => (await tutor.count()) === 0);
  await openSource(page, TESTING);
  await openSource(page, STORY);
  await page.getByText("Line 80 of a long note.").waitFor();
  await until("the note is scrolled where he left it after another source", async () => Math.abs((await panel.evaluate((el) => el.scrollTop)) - top) <= 1);
  await back("after another source");
  await ore(["notes", id, "--set="]);
});

journey("answer pieces: one click rewrites a piece in place, ⌘Z puts the old words back; emptied, it goes with Undo", async (page) => {
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  await page.getByText("Does this hold for kids?", { exact: true }).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Answer…" }).click();
  const box = page.getByLabel("Your answer to Does this hold for kids?");
  await box.fill("Mostly yes.");
  await page.keyboard.press("Enter");
  const piece = page.getByRole("button", { name: "Edit: Mostly yes." });
  await piece.click();
  const edit = page.getByLabel("Edit this part of your answer");
  await edit.fill("Yes, from about age 8.");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Edit: Yes, from about age 8." }).waitFor();
  await page.locator(".skill-page, main").first().click({ position: { x: 2, y: 2 } }).catch(() => {});
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Meta+z");
  await piece.waitFor();
  await piece.click();
  await edit.fill("");
  await page.keyboard.press("Enter");
  await until("emptied, it goes", async () => (await piece.count()) === 0);
  await page.locator(".toast").filter({ hasText: "Removed from your answer" }).getByRole("button", { name: "Undo" }).click();
  await piece.waitFor();
  // Leave the question as the seed had it.
  await piece.click();
  await edit.fill("");
  await page.keyboard.press("Enter");
  await until("the piece is gone again", async () => (await piece.count()) === 0);
  await page.waitForTimeout(300);
});

journey("answer pieces: a correction he is writing stays through a blur and a failed save, and saves on the next try", async (page) => {
  const fail = (why: string | null) => page.evaluate((why) => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = why ? { answer: why } : {}), why);
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  await page.getByText("Does this hold for kids?", { exact: true }).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Answer…" }).click();
  const box = page.getByLabel("Your answer to Does this hold for kids?");
  await box.fill("Mostly yes.");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Edit: Mostly yes." }).click();
  const edit = page.getByLabel("Edit this part of your answer");
  await edit.fill("Yes, from about age 8.");
  await box.click(); // focus leaves the piece
  if ((await edit.inputValue().catch(() => null)) !== "Yes, from about age 8.") throw new Error("a blur lost the correction");
  await edit.click();
  await fail("The library is read-only.");
  await page.keyboard.press("Enter");
  await page.locator(".toast[role=alert]").filter({ hasText: "The library is read-only." }).waitFor();
  await until("the failed save gives his correction back", async () => (await edit.isVisible()) && (await edit.inputValue()) === "Yes, from about age 8.");
  await fail(null);
  await edit.focus();
  await page.keyboard.press("Enter");
  const fixed = page.getByRole("button", { name: "Edit: Yes, from about age 8." });
  await fixed.waitFor();
  // A correction still open when he clicks Answered is saved with it.
  await fixed.click();
  await edit.fill("Yes, from about age 9.");
  await page.getByRole("button", { name: "Answered", exact: true }).click();
  type Q = { id: string; note?: string; status: string; answers: { ts: string; text: string }[] };
  const kids = async () => ((await ore("questions", "--skill=learning")) as Q[]).find((x) => x.note === "Does this hold for kids?")!;
  await until("Answered saves the open correction", async () => (await kids()).answers.some((c) => c.text === "Yes, from about age 9."));
  // Leave the question as the seed had it: open, with no answer.
  await page.locator(".toast").filter({ hasText: "Answered" }).getByRole("button", { name: "Undo" }).click();
  await until("Undo reopens it", async () => (await kids()).status !== "done");
  const k = await kids();
  for (const c of k.answers) await ore("answer", k.id, `--remove=${c.ts}`);
});

journey("skill page: Mark answered on a question, ⌘Z reopens it", async (page) => {
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  const open = () => page.getByText("Does this hold for kids?", { exact: true }).filter({ visible: true }).count();
  await until("the question is listed", async () => (await open()) > 0);
  await page.getByText("Does this hold for kids?", { exact: true }).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Mark answered" }).click();
  await until("it leaves the open questions", async () => (await open()) === 0);
  await page.waitForTimeout(300);
  await page.keyboard.press("Meta+z");
  await until("⌘Z reopens it", async () => (await open()) > 0);
});

journey("reader questions: ask one, ⌘Z takes it back; its ⋯ menu marks it answered and deletes it, ⌘Z each", async (page) => {
  await openSource(page, TESTING);
  await page.getByRole("tab", { name: "Collected" }).click();
  const head = page.locator(".cp-head", { hasText: "Questions" });
  const toggle = head.locator(".cp-toggle");
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  const ask = "Does spacing help with motor skills too?";
  const rows = () => page.locator(".qp-line", { hasText: ask }).count();
  await head.getByRole("button", { name: "Ask a question" }).click();
  await page.getByLabel("New question").fill(ask);
  await page.keyboard.press("Enter");
  await until("the question is listed", async () => (await rows()) === 1);
  await page.waitForTimeout(300);
  await page.keyboard.press("Meta+z");
  await until("⌘Z takes it back", async () => (await rows()) === 0);
  await page.keyboard.press("Meta+Shift+z");
  await until("⇧⌘Z asks it again", async () => (await rows()) === 1);
  const line = page.locator(".qp-line", { hasText: ask });
  await line.hover();
  await line.getByRole("button", { name: "Question actions" }).click();
  await page.getByRole("menuitem", { name: "Mark answered" }).click();
  await until("it is struck through", async () => (await page.locator(".qp-q.done", { hasText: ask }).count()) === 1);
  await page.keyboard.press("Meta+z");
  await until("⌘Z reopens it", async () => (await page.locator(".qp-q.done", { hasText: ask }).count()) === 0);
  await line.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete question" }).click();
  await until("it is gone", async () => (await rows()) === 0);
  await page.keyboard.press("Meta+z");
  await until("⌘Z puts it back", async () => (await rows()) === 1);
  // Leave the library as it was.
  await line.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete question" }).click();
  await until("deleted again", async () => (await rows()) === 0);
});

journey("reader questions: a piece of the answer, ⌘Z takes it out and ⇧⌘Z puts it back", async (page) => {
  await openSource(page, TESTING);
  await page.getByRole("tab", { name: "Collected" }).click();
  const toggle = page.locator(".cp-head", { hasText: "Questions" }).locator(".cp-toggle");
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  const q = page.locator(".qp-q", { hasText: "Does this hold for kids?" });
  // The row is one line (D134): the pieces show in its answer box, so each look opens it and closes it again.
  const pieces = async () => {
    await q.locator(".qp-row").click();
    await q.locator(".qa-actions").waitFor();
    const n = await q.locator(".qa-piece").count();
    await page.keyboard.press("Escape");
    await q.locator(".qa-actions").waitFor({ state: "detached" });
    return n;
  };
  const before = await pieces();
  await q.locator(".qp-row").click();
  await page.keyboard.type("Spacing helped fourth graders in one study.");
  await page.keyboard.press("Enter");
  await until("the piece is added", async () => (await q.locator(".qa-piece").count()) === before + 1);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Meta+z");
  await until("⌘Z takes it out", async () => (await pieces()) === before);
  await page.keyboard.press("Meta+Shift+z");
  await until("⇧⌘Z puts it back", async () => (await pieces()) === before + 1);
  await page.keyboard.press("Meta+z");
  await until("and out again, as it was", async () => (await pieces()) === before);
});

journey("home: a reading row and a skill tile show ⋯ on hover; it opens their menu without opening them", async (page) => {
  await page.getByRole("button", { name: /^Home/ }).click();
  const row = page.locator(".home-read").first();
  await row.hover();
  await row.getByRole("button", { name: "Source actions" }).click();
  await page.getByRole("menuitem", { name: "Rename…" }).waitFor();
  await page.keyboard.press("Escape");
  await until("still on Home", async () => (await page.locator(".home-read").count()) > 0 && (await page.locator(".doc-head").count()) === 0);
  const tile = page.locator(".home-skill").first();
  await tile.hover();
  await tile.getByRole("button", { name: "Skill actions" }).click();
  await until("its menu is open", async () => (await page.getByRole("menuitem").count()) > 0);
  await page.keyboard.press("Escape");
  await until("still on Home", async () => (await page.locator(".home-skill").count()) > 0);
});

journey("feed: ⌘K offers the selected post's actions, named for it, once the keyboard picks it", async (page) => {
  // A feed of its own, served here, with posts from the last two days.
  const day = (n: number) => new Date(Date.now() - n * 864e5).toUTCString();
  const server = Bun.serve({ port: 0, fetch: () => new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>Spacing Notes</title><link>http://localhost/</link><item><title>Why spacing works</title><link>http://localhost/a.html</link><pubDate>${day(1)}</pubDate></item><item><title>Interleaving in practice</title><link>http://localhost/b.html</link><pubDate>${day(2)}</pubDate></item></channel></rss>`, { headers: { "content-type": "application/rss+xml" } }) });
  const feed = `http://localhost:${server.port}/feed.xml`;
  const ore = (...args: string[]) => fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: [...args, "--json"] }) }).then((r) => r.json());
  try {
    await ore("feed", "follow", feed);
    await page.getByRole("button", { name: /^Feed/ }).click();
    await page.locator(".row.post", { hasText: "Why spacing works" }).waitFor();
    const offered = () => page.locator("[cmdk-item]", { hasText: "Mark read “Why spacing works”" }).count();
    await page.keyboard.press("Meta+k");
    await page.locator("[cmdk-input]").fill("mark read");
    await until("nothing offered before a post is picked", async () => (await offered()) === 0);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Meta+k");
    await page.locator("[cmdk-input]").fill("mark read");
    await until("the picked post's Mark read is offered", async () => (await offered()) === 1);
    await page.keyboard.press("Enter");
    await until("it is marked read", async () => (await page.locator(".row.post.read", { hasText: "Why spacing works" }).count()) === 1 || (await page.locator(".row.post", { hasText: "Why spacing works" }).count()) === 0);
  } finally {
    await ore("feed", "unfollow", feed).catch(() => {});
    server.stop(true);
    await page.getByRole("button", { name: /^Home/ }).click();
  }
});

journey("⌘K: Esc clears what was typed first, then closes", async (page) => {
  await page.keyboard.press("Meta+k");
  const input = page.locator("[cmdk-input]");
  await input.fill("review");
  await page.keyboard.press("Escape");
  await until("the query is cleared and ⌘K stays open", async () => (await input.count()) === 1 && (await input.inputValue()) === "");
  await page.keyboard.press("Escape");
  await until("a second Esc closes it", async () => (await input.count()) === 0);
});

/** Types `query` in ⌘K and picks the row in the text that reads `row`. */
async function searchPick(page: Page, query: string, row: string) {
  await page.keyboard.press("Meta+k");
  await page.locator("[cmdk-input]").fill(query);
  await page.locator("[cmdk-item]").filter({ hasText: row }).first().click();
}

/** The find bar holds `words` and its current match is on screen, inside `within`. */
async function foundOnScreen(page: Page, words: string, within: string) {
  const bar = page.getByLabel("Find in source");
  await until("the find bar holds the words", async () => (await bar.count()) === 1 && (await bar.inputValue()) === words);
  await until(`the match is on screen, in ${within}`, () =>
    page.evaluate((within) => {
      const r = [...(CSS.highlights.get("find-on") ?? [])][0] as Range | undefined;
      const b = r?.getBoundingClientRect();
      return !!r && !!b && b.top >= 0 && b.bottom <= innerHeight && !!r.startContainer.parentElement?.closest(within);
    }, within),
  );
}

journey("⌘K: a match in the text opens the source at that place, the find bar on the words", async (page) => {
  await searchPick(page, "confidence matters", TESTING);
  await foundOnScreen(page, "confidence matters", ".doc");
  await page.keyboard.press("Escape");
});

journey("⌘K: a match in a highlight's note opens that highlight; one in the source note opens the note on it", async (page) => {
  await searchPick(page, "hold for kids", `${TESTING} · question`);
  const note = page.getByRole("dialog", { name: "Highlight" }).getByLabel("Note");
  await until("the highlight's popup is open on its note", async () => (await note.isVisible()) && (await note.inputValue()) === "Does this hold for kids?");
  await page.keyboard.press("Escape");
  await searchPick(page, "just a measurement", `${TESTING} · source note`);
  await foundOnScreen(page, "just a measurement", ".mynotes-text");
  await page.keyboard.press("Escape");
});

journey("⌘K: a match in a skill note opens the skill's note scrolled to the words", async (page) => {
  await searchPick(page, "first coffee", "Habits · skill note");
  await page.locator(".skill-page").waitFor();
  await foundOnScreen(page, "first coffee", ".skill-note");
  if (!(await page.locator(".skill-col").first().evaluate((el) => el.scrollTop > 0))) throw new Error("the note didn't scroll to its end");
  await page.keyboard.press("Escape");
});

journey("search: when searching the text fails, ⌘K and the sources filter say so instead of “no matches”", async (page) => {
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { search: "The index is busy." }));
  await page.keyboard.press("Meta+k");
  await page.locator("[cmdk-input]").fill("plausible");
  await page.locator(".panel-foot .err").filter({ hasText: "Couldn’t search the text: The index is busy." }).waitFor();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.keyboard.press("Meta+f");
  await page.getByLabel("Filter sources").fill("plausible");
  await page.getByRole("alert").filter({ hasText: "Couldn’t search the text: The index is busy." }).waitFor();
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
});

journey("note blocks: drag one by its ⋮⋮ handle, it stays moved after a reload; Turn into, then ⌘Z", async (page) => {
  const items = () => page.locator(".note-editor li").allInnerTexts();
  const grip = async (text: string) => {
    const box = (await page.locator(".note-editor li").filter({ hasText: text }).boundingBox())!;
    await page.mouse.move(box.x + 30, box.y + box.height / 2);
    const g = page.locator(".block-grip");
    await g.waitFor();
    return { g: (await g.boundingBox())!, box };
  };
  await openSource(page, TESTING);
  const { g } = await grip("Confidence + correction");
  const above = (await page.locator(".note-editor li").filter({ hasText: "Effortful" }).boundingBox())!;
  await page.mouse.move(g.x + 10, g.y + 12);
  await page.mouse.down();
  await page.mouse.move(above.x + 20, above.y + 2, { steps: 8 });
  await page.locator(".block-drop").waitFor();
  await page.mouse.up();
  await until("the dragged item is first", async () => (await items())[0]?.startsWith("Confidence") ?? false);
  await page.waitForTimeout(600); // the note saves after a pause
  await page.reload();
  await openSource(page, TESTING);
  await until("the order survives a reload", async () => (await items())[0]?.startsWith("Confidence") ?? false);
  await grip("Effortful");
  await page.locator(".block-grip").click();
  await page.locator(".menu-item", { hasText: "Turn into" }).hover();
  await page.getByRole("menuitemcheckbox", { name: "Heading 3", exact: true }).dispatchEvent("click");
  await until("it became a heading", () => page.locator(".note-editor h3", { hasText: "Effortful" }).isVisible());
  await page.keyboard.press("ControlOrMeta+z"); // the editor's own undo: ⌘ on the Mac, Ctrl where CI runs
  await until("⌘Z takes it back", async () => (await items()).some((t) => t.startsWith("Effortful")));
});

journey("note block selection: Esc selects a block, ⇧↓ takes in the list, the ⋮⋮ drags both, Backspace and ⌘Z", async (page) => {
  const tops = () => page.locator(".note-editor .ProseMirror > *").evaluateAll((els) => els.map((e) => e.tagName));
  const picked = () => page.locator(".note-editor .block-sel").count();
  await openSource(page, TESTING);
  await page.locator(".note-editor p", { hasText: "learning event" }).click();
  await until("the caret is on the line", () => page.evaluate(() => !!getSelection()?.anchorNode?.parentElement?.closest(".note-editor p")?.textContent?.includes("learning event")));
  await page.waitForTimeout(100); // the editor takes the click's caret a moment after the browser shows it
  await page.keyboard.press("Escape");
  await until("Esc selects the line's block", async () => (await picked()) === 1);
  await page.keyboard.press("Shift+ArrowDown");
  await until("⇧↓ takes in the list after it", async () => (await picked()) === 2);
  // Its handle drags both, above the heading.
  const p = (await page.locator(".note-editor p", { hasText: "learning event" }).boundingBox())!;
  await page.mouse.move(p.x + 30, p.y + 8);
  const g = (await page.locator(".block-grip").boundingBox())!;
  const top = (await page.locator(".note-editor h2").boundingBox())!;
  await page.mouse.move(g.x + 10, g.y + 12);
  await page.mouse.down();
  await page.mouse.move(top.x + 20, top.y + 2, { steps: 8 });
  await page.locator(".block-drop").waitFor();
  await page.mouse.up();
  await until("both moved above the heading, still selected", async () => (await tops()).join() === "P,UL,H2" && (await picked()) === 2);
  await page.waitForTimeout(600); // apart from the drag, so ⌘Z takes back only this
  await page.keyboard.press("Backspace");
  await until("Backspace takes both out", async () => (await tops()).join() === "H2");
  await page.keyboard.press("ControlOrMeta+z");
  await until("⌘Z brings them back, still selected", async () => (await tops()).join() === "P,UL,H2" && (await picked()) === 2);
  await page.locator(".note-editor h2").click();
  await until("the caret is on the heading", () => page.evaluate(() => !!getSelection()?.anchorNode?.parentElement?.closest(".note-editor h2")));
  await page.waitForTimeout(100);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await until("the second Esc lets go and leaves the note, not the source", async () => (await picked()) === 0 && !(await page.locator(".note-editor .ProseMirror").evaluate((e) => e.contains(document.activeElement))));
  await page.locator(".doc-head").filter({ hasText: TESTING }).waitFor();
});

journey("note format bar: select words, highlight them blue from the bar, and it is still there after a reload", async (page) => {
  await openSource(page, TESTING);
  await page.locator(".note-editor p", { hasText: "learning event" }).waitFor();
  const box = await page.evaluate(() => {
    const el = [...document.querySelectorAll(".note-editor p")].find((e) => e.textContent!.includes("learning event"))!;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode() as Text | null; n; n = w.nextNode() as Text | null) {
      const i = n.data.indexOf("learning event");
      if (i < 0) continue;
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + 14);
      const q = r.getBoundingClientRect();
      return { x1: q.left + 1, x2: q.right - 1, y: q.top + q.height / 2 };
    }
    return null;
  });
  await page.mouse.move(box!.x1, box!.y);
  await page.mouse.down();
  await page.mouse.move(box!.x2, box!.y, { steps: 5 });
  await page.mouse.up();
  await page.locator(".sel-bar").waitFor();
  await page.locator(".sel-bar button[aria-label=Colour]").click();
  await page.getByRole("button", { name: "Highlight: Blue" }).click();
  const marked = () => page.locator('.note-editor mark[data-color="blue"]', { hasText: "learning event" }).isVisible();
  await until("the words are highlighted", marked);
  await page.waitForTimeout(600); // the note saves after a pause
  await page.reload();
  await openSource(page, TESTING);
  await until("the highlight survives a reload", marked);
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
  await docked.waitFor().catch(async (e) => {
    // Say where it went instead: a toast's error, or the screen it landed on.
    const seen = await page.evaluate(() => [...document.querySelectorAll("[role=status], [role=alert], .toast")].map((n) => n.textContent).join(" | "));
    throw new Error(`no docked diagram (full window: ${await page.locator(".diagram").count()}, reader: ${await page.locator(".doc").count()}, says: ${seen || "nothing"}): ${(e as Error).message}`);
  });
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
  await until("the link is still in the note", async () => (await page.locator(".note-editor .note-diagram-view > svg").count()) === 1);
  await page.locator(".note-editor .note-diagram").click();
  await docked.waitFor();
  await page.keyboard.press("Shift+Meta+Enter");
  await page.locator(".diagram:not(.docked)").waitFor();
  await page.keyboard.press("Escape");
  await until("Esc closes it", async () => (await page.locator(".diagram").count()) === 0);
  // Its preview's right-click menu opens it, and takes it out of the note; ⌘Z puts it back.
  await page.locator(".note-editor .note-diagram").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Open diagram" }).click();
  await page.locator(".diagram").waitFor(); // full window still, as it was left
  await page.keyboard.press("Escape");
  await until("Esc closes it again", async () => (await page.locator(".diagram").count()) === 0);
  await page.locator(".note-editor .note-diagram").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Remove from note" }).click();
  await until("it leaves the note", async () => (await page.locator(".note-editor .note-diagram").count()) === 0);
  await page.keyboard.press("ControlOrMeta+z");
  await until("⌘Z puts it back", async () => (await page.locator(".note-editor .note-diagram").count()) === 1);
  // The preview is a small board: a drag pans it and doesn't open it, ⌘-scroll zooms, the fit button
  // brings it all back, and the edges resize it, kept in the note across a reload.
  const board = page.locator(".note-editor .note-diagram");
  await board.locator(".note-diagram-view > svg").waitFor();
  await board.scrollIntoViewIfNeeded();
  let b = (await board.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 + 60, b.y + b.height / 2 + 20, { steps: 6 });
  await page.mouse.up();
  const shown = () => board.locator(".note-diagram-view").evaluate((e) => (e as HTMLElement).style.transform);
  await until("a drag pans the board", async () => (await shown()).includes("translate(60px, 20px)"));
  await Bun.sleep(200);
  if (await page.locator(".diagram").count()) throw new Error("a drag on the preview opened the diagram");
  await page.keyboard.down("ControlOrMeta");
  await page.mouse.wheel(0, -120);
  await page.keyboard.up("ControlOrMeta");
  await until("⌘-scroll zooms it", async () => /scale\((?!1\))/.test(await shown()));
  await board.locator(".note-diagram-fit").click();
  await until("the fit button brings it all back", async () => (await shown()) === "");
  if (await page.locator(".diagram").count()) throw new Error("the fit button opened the diagram");
  b = (await board.boundingBox())!;
  await page.mouse.move(b.x + b.width - 3, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width - 103, b.y + b.height / 2, { steps: 5 });
  await page.mouse.up();
  await page.mouse.move(b.x + 40, b.y + b.height - 3);
  await page.mouse.down();
  await page.mouse.move(b.x + 40, b.y + b.height + 117, { steps: 5 });
  await page.mouse.up();
  const size = async () => ((r) => [Math.round(r!.width), Math.round(r!.height)])(await board.boundingBox());
  const want = [Math.round(b.width - 100), Math.round(b.height + 120)];
  await until(`the edges resize it to ${want}`, async () => (await size()).join() === want.join());
  if (await page.locator(".diagram").count()) throw new Error("resizing opened the diagram");
  await page.keyboard.press("ControlOrMeta+z");
  await until("⌘Z takes the height back", async () => (await size()).join() === [want[0], Math.round(b.height)].join());
  await page.keyboard.press("Shift+ControlOrMeta+z");
  await until("⇧⌘Z puts it again", async () => (await size()).join() === want.join());
  await Bun.sleep(1500); // the note saves
  await page.reload();
  await openSource(page, AGENTS);
  await page.locator(".note-editor .note-diagram-view > svg").waitFor();
  await until("the size is kept in the note", async () => (await size()).join() === want.join());
});

/** Opens a source he has finished, from All sources' Done view. */
async function openDone(page: Page, title: string) {
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.locator(".view-menu").click();
  await page.getByRole("menuitemradio", { name: /^Done/ }).click();
  await page.locator(".row").filter({ hasText: title }).first().click();
  await page.locator(".doc-head").filter({ hasText: title }).waitFor();
}

/** Opens a new diagram from the note's / menu, docked beside the source, and draws a box in it. */
async function drawNew(page: Page, before?: () => Promise<void>) {
  const note = page.locator(".note-editor [contenteditable=true]").first();
  // On its first line: lower down may be a diagram already, which a click opens.
  await until("the note takes the caret", async () => (await note.click({ position: { x: 8, y: 8 } }), await note.evaluate((e) => e.contains(document.activeElement))));
  await page.keyboard.press("Meta+ArrowDown");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/diagram");
  await page.locator(".note-menu-row.on").filter({ hasText: "Diagram" }).waitFor();
  await page.keyboard.press("Enter");
  const docked = page.locator(".diagram.docked");
  await docked.waitFor();
  await before?.();
  const canvas = (await docked.locator(".draw").boundingBox())!;
  await docked.locator(".draw").focus();
  await page.keyboard.press("r");
  await page.mouse.move(canvas.x + 60, canvas.y + 120);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 200, canvas.y + 200, { steps: 5 });
  await page.mouse.up();
}

journey("diagram: a new one left before its first save comes back is linked once, and one whose save fails is kept with Try again or let go with its ×", async (page) => {
  type W = { __ORE_SLOW?: object; __ORE_FAIL?: object };
  await openDone(page, "The Story Spine"); // no other journey draws here
  const drawings = page.locator(".note-editor .note-diagram-view > svg");
  // The first save is slow, and the panel switches tab right after drawing: its note closes first.
  await drawNew(page, () => page.evaluate(() => void ((window as unknown as W).__ORE_SLOW = { diagram: 1500 })));
  await page.getByRole("tab", { name: "Collected" }).click();
  await page.getByRole("tab", { name: "Source note" }).click();
  await until("the note links the drawing once its save is back", async () => (await drawings.count()) === 1, 8000);
  await page.evaluate(() => void ((window as unknown as W).__ORE_SLOW = undefined));
  // The next one's save fails: it is kept, and Try again saves and links it.
  await drawNew(page, () => page.evaluate(() => void ((window as unknown as W).__ORE_FAIL = { diagram: "The disk is full." })));
  await page.getByRole("tab", { name: "Collected" }).click();
  const alert = page.locator(".toast[role=alert]").filter({ hasText: "The disk is full." });
  await alert.waitFor();
  await Bun.sleep(9000); // past an error toast's 8 s: this one is the only way back to the drawing
  if (!(await alert.getByRole("button", { name: "Try again" }).count())) throw new Error("the toast holding the unsaved drawing went away");
  await page.evaluate(() => void ((window as unknown as W).__ORE_FAIL = {}));
  await alert.getByRole("button", { name: "Try again" }).click();
  await page.getByRole("tab", { name: "Source note" }).click();
  await until("Try again saves and links it", async () => (await drawings.count()) === 2, 8000);
  await Bun.sleep(1200); // the note saves
  // A third one's save fails too, and he lets it go: its × closes the toast, and the drawing is gone.
  await drawNew(page, () => page.evaluate(() => void ((window as unknown as W).__ORE_FAIL = { diagram: "The disk is still full." })));
  await page.getByRole("tab", { name: "Collected" }).click();
  const third = page.locator(".toast[role=alert]").filter({ hasText: "The disk is still full." });
  await third.waitFor();
  await third.getByRole("button", { name: "Dismiss" }).click();
  await until("its × closes the toast", async () => (await third.count()) === 0);
  await page.evaluate(() => void ((window as unknown as W).__ORE_FAIL = {}));
  await page.getByRole("tab", { name: "Source note" }).click();
  await page.reload();
  await openDone(page, "The Story Spine");
  await until("both are linked once each after a reload", async () => (await drawings.count()) === 2 && (await page.locator(".note-editor .note-diagram").count()) === 2);
});

journey("diagram: ⌘Z on a rename takes the file back with the link, ⇧⌘Z renames it again, and a reload keeps it", async (page) => {
  await openDone(page, "Notes on spaced repetition scheduling"); // no other journey draws here
  await drawNew(page);
  const board = page.locator(".note-editor .note-diagram");
  await until("the note links it once it is saved", async () => (await board.count()) === 1, 6000);
  const name = (await page.locator(".diagram-name").inputValue())!;
  await page.locator(".diagram-name").fill("spacing-map");
  await page.keyboard.press("Enter");
  const shows = (n: string) => async () => (await board.getAttribute("aria-label")) === `Diagram ${n}, click to edit` && (await board.locator(".note-diagram-view > svg").count()) === 1;
  await until("the link follows the rename", shows("spacing-map"));
  await page.locator(".diagram-done").click();
  await until("Done closes it", async () => (await page.locator(".diagram").count()) === 0);
  await page.keyboard.press("ControlOrMeta+z");
  await until("⌘Z puts the old name back, and the drawing with it", shows(name));
  await page.keyboard.press("Shift+ControlOrMeta+z");
  await until("⇧⌘Z renames it again, drawing and all", shows("spacing-map"));
  await Bun.sleep(1500); // the note saves
  await page.reload();
  await openDone(page, "Notes on spaced repetition scheduling");
  await until("a reload shows the same drawing under its new name", shows("spacing-map"));
});

journey("diagram: S styles at the pointer, keys stay on the canvas, Space never sticks, and Esc closes only the drawing", async (page) => {
  await openSource(page, TESTING); // no other journey draws here, so the diagram starts empty
  const note = page.locator(".note-editor [contenteditable=true]").first();
  await until("the note takes the caret", async () => (await note.click(), await note.evaluate((e) => e.contains(document.activeElement))));
  await page.keyboard.press("Meta+ArrowDown");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/diagram");
  await page.locator(".note-menu-row.on").filter({ hasText: "Diagram" }).waitFor();
  await page.keyboard.press("Enter");
  const draw = page.locator(".diagram .draw");
  await draw.focus();
  await page.keyboard.press("Shift+Meta+Enter");
  await page.locator(".diagram:not(.docked)").waitFor();
  await draw.focus();
  const c = (await page.locator(".diagram .draw-canvas").boundingBox())!;
  await page.keyboard.press("r");
  await page.mouse.click(c.x + 500, c.y + 300);
  await page.locator(".draw-text").waitFor();
  // An empty label shows only the caret, no prompt text (Tyler 2026-11-07).
  if (await page.locator(".draw-text").getAttribute("placeholder")) throw new Error("a new label shows placeholder text");
  await page.keyboard.type("Memory");
  await page.keyboard.press("Enter");
  const boxes = () => page.locator(".diagram .draw-canvas > g rect").count();
  await until("the box is drawn", async () => (await boxes()) === 1);
  // S opens the style picker by the pointer; its keys restyle the selection and Esc closes only it.
  const rect = page.locator(".diagram .draw-canvas > g rect").first();
  await page.mouse.move(c.x + 640, c.y + 420);
  await page.keyboard.press("s");
  const quick = page.locator(".draw-quick");
  await quick.waitFor();
  const qb = (await quick.boundingBox())!;
  if (Math.hypot(qb.x - (c.x + 640), qb.y + qb.height - (c.y + 420)) > 60) throw new Error(`the picker opened at ${qb.x},${qb.y}, not by the pointer`);
  await page.keyboard.press("2");
  await page.keyboard.press("Shift+4");
  await page.keyboard.press("e");
  await until("1–5, ⇧1–5 and Q W E restyle the box", async () => (await rect.getAttribute("stroke")) !== "#f2f1ec" && (await rect.getAttribute("fill")) !== "none" && (await rect.getAttribute("stroke-width")) === "4");
  await page.keyboard.press("Escape");
  await until("Esc closes the picker, the box stays picked", async () => (await quick.count()) === 0 && (await page.locator(".sr-only[aria-live]").textContent()) === "Selected: Memory");
  await page.keyboard.press("Meta+z");
  await until("⌘Z takes back the last change", async () => (await rect.getAttribute("stroke-width")) === "2");
  // Picking a colour by click must not take the keys away from the drawing (Excalidraw).
  await page.keyboard.press("s");
  await quick.locator(".draw-swatch").nth(1).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Backspace");
  await until("Backspace after a swatch click still deletes the box", async () => (await boxes()) === 0);
  await page.keyboard.press("Meta+z");
  await until("⌘Z brings it back", async () => (await boxes()) === 1);
  // Z X C set the line in the picker (dashed for a weak link); a custom colour is one undo step and hands the keys back.
  await page.keyboard.press("s");
  await page.keyboard.press("x");
  await until("X makes the line dashed", async () => !!(await rect.getAttribute("stroke-dasharray")));
  const before = await rect.getAttribute("stroke");
  await quick.locator(".draw-custom").first().click();
  const hex = page.locator(".draw-colour input");
  await until("the custom colour picker takes the caret", async () => hex.evaluate((e) => e === document.activeElement));
  await hex.fill("7048e8");
  await until("a typed hex restyles the box as the canvas shows it", async () => (await rect.getAttribute("stroke")) === "#af8dff");
  await page.keyboard.press("Escape");
  await until("Esc closes only the colour picker", async () => (await page.locator(".draw-colour").count()) === 0 && (await page.locator(".diagram").count()) === 1);
  await until("the custom swatch shows the colour in use", async () => (await quick.locator(".draw-custom").first().getAttribute("aria-pressed")) === "true");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Meta+z");
  await until("⌘Z takes the whole custom colour back in one step", async () => (await rect.getAttribute("stroke")) === before);
  // With several selected, a click on one of them picks just that one (Figma, Excalidraw).
  await page.mouse.click(c.x + 500, c.y + 300);
  await page.keyboard.press("Meta+d");
  await page.keyboard.press("Meta+a");
  const selected = () => page.locator(".sr-only[aria-live]").textContent();
  await until("⌘A picks both", async () => (await selected())?.includes("Memory, Memory") ?? false);
  await page.mouse.click(c.x + 500, c.y + 300);
  await until("a click on one of them picks it alone", async () => (await selected()) === "Selected: Memory");
  // Space held while focus leaves (the name field, another app) must not leave the canvas panning.
  await page.keyboard.down(" ");
  await page.locator(".diagram-name").focus();
  await page.keyboard.up(" ");
  await page.keyboard.press("Escape");
  await draw.focus();
  await until("the canvas is not stuck panning", async () => !(await draw.evaluate((e) => e.classList.contains("panning"))));
  await page.locator(".note-editor .note-diagram").waitFor({ timeout: 6000 }); // autosaved, so Esc has nothing to write
  await page.keyboard.press("Escape"); // clears the selection
  await page.keyboard.press("Escape"); // Done
  await until("Esc closes the drawing", async () => (await page.locator(".diagram").count()) === 0);
  await Bun.sleep(300);
  if (!(await page.locator(".doc").count())) throw new Error("Esc closed the source as well as the drawing");
});

journey("diagram: editing picks the whole label, a run of nudges is one undo step, undo re-selects, and a one-click arrow dropped with Esc leaves the Select tool", async (page) => {
  await openSource(page, "A very long title about the neuroscience"); // no other journey draws here, so the note's click lands on text, not a diagram
  const note = page.locator(".note-editor [contenteditable=true]").first();
  await until("the note takes the caret", async () => (await note.click(), await note.evaluate((e) => e.contains(document.activeElement))));
  await page.keyboard.press("Meta+ArrowDown");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/diagram");
  await page.locator(".note-menu-row.on").filter({ hasText: "Diagram" }).waitFor();
  await page.keyboard.press("Enter");
  const draw = page.locator(".diagram .draw");
  await draw.focus();
  await page.keyboard.press("Shift+Meta+Enter");
  await page.locator(".diagram:not(.docked)").waitFor();
  await draw.focus();
  const c = (await page.locator(".diagram .draw-canvas").boundingBox())!;
  await page.keyboard.press("r");
  await page.mouse.click(c.x + 500, c.y + 300);
  await page.locator(".draw-text").waitFor();
  await page.keyboard.type("Memory");
  await page.keyboard.press("Enter");
  const summary = () => page.locator("#draw-summary").textContent();
  const selected = () => page.locator(".sr-only[aria-live]").textContent();
  await until("the box is labelled", async () => (await summary()) === "Memory");
  // Enter on the box opens its label with all of it selected, so typing replaces it (Excalidraw, Figma).
  await page.keyboard.press("Enter");
  const range = await page.locator(".draw-text").evaluate((t: HTMLTextAreaElement) => [t.selectionStart, t.selectionEnd]);
  if (range[0] !== 0 || range[1] !== 6) throw new Error(`editing selected ${range[0]}–${range[1]} of "Memory", not all of it`);
  await page.keyboard.type("Sleep");
  await page.keyboard.press("Enter");
  await until("typing replaced the label", async () => (await summary()) === "Sleep");
  // Five nudges, one ⌘Z: back where it started (Figma).
  const rect = page.locator(".diagram .draw-canvas > g rect");
  const x0 = Number(await rect.getAttribute("x"));
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  await until("the box moved 5", async () => Number(await rect.getAttribute("x")) === x0 + 5);
  await page.keyboard.press("Meta+z");
  await until("one ⌘Z takes back the whole run", async () => Number(await rect.getAttribute("x")) === x0);
  // ⌘Z after a delete brings the box back selected, so the next key acts on it.
  await page.keyboard.press("Backspace");
  await until("Backspace deletes it", async () => (await rect.count()) === 0);
  await page.keyboard.press("Meta+z");
  await until("⌘Z brings it back selected", async () => (await rect.count()) === 1 && (await selected()) === "Selected: Sleep");
  // An arrow started with a click and dropped with Esc leaves no arrow and the Select tool, as a finished one does.
  await page.keyboard.press("Escape");
  await page.keyboard.press("a");
  await page.mouse.click(c.x + 900, c.y + 600);
  await page.keyboard.press("Escape");
  const tool = () => page.locator(".draw-tool[aria-pressed=true]").first().getAttribute("aria-label");
  await until("the tool is Select again", async () => (await tool()) === "Select");
  if (await page.locator(".diagram .draw-canvas > g path").count()) throw new Error("the dropped arrow stayed");
  // In the picker, A D F set which way a selected arrow points: one-way, both ways, no heads.
  await page.keyboard.press("a");
  await page.mouse.move(c.x + 900, c.y + 600);
  await page.mouse.down();
  await page.mouse.move(c.x + 1000, c.y + 600, { steps: 5 });
  await page.mouse.up();
  const paths = () => page.locator(".diagram .draw-canvas > g path").count();
  await until("the arrow is drawn", async () => (await paths()) > 0);
  const oneWay = await paths();
  await page.keyboard.press("s");
  await page.locator(".draw-quick").waitFor();
  await page.keyboard.press("d");
  await until("D gives it a head at both ends", async () => (await paths()) === oneWay + 1);
  await page.keyboard.press("f");
  await until("F takes both heads off", async () => (await paths()) === oneWay - 1);
  await page.keyboard.press("a");
  await until("A makes it one-way again", async () => (await paths()) === oneWay);
  await page.keyboard.press("Escape");
});

journey("diagram: align and space from keys and the picker, drags snap to edges and equal gaps (⌘ off), and a node goes with its links", async (page) => {
  await openSource(page, "A very long title about the neuroscience");
  // The editing journey leaves a diagram at the note's end: open it if the preview has rendered, else make one.
  await page.locator(".note-editor [contenteditable=true]").first().waitFor();
  const drawn = page.locator(".note-editor .note-diagram").first();
  if (await drawn.waitFor({ timeout: 1500 }).then(() => true, () => false)) await drawn.click();
  else {
    const note = page.locator(".note-editor [contenteditable=true]").first();
    await until("the note takes the caret", async () => (await note.click(), await note.evaluate((e) => e.contains(document.activeElement))));
    await page.keyboard.press("Meta+ArrowDown");
    await page.keyboard.press("Enter");
    await page.keyboard.type("/diagram");
    await page.locator(".note-menu-row.on").filter({ hasText: "Diagram" }).waitFor();
    await page.keyboard.press("Enter");
  }
  const draw = page.locator(".diagram .draw");
  await draw.focus();
  if (await page.locator(".diagram.docked").count()) await page.keyboard.press("Shift+Meta+Enter");
  await page.locator(".diagram:not(.docked)").waitFor();
  await draw.focus();
  await page.keyboard.press("Meta+a");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Meta+Digit0");
  const c = (await page.locator(".diagram .draw-canvas").boundingBox())!;
  const rects = page.locator(".diagram .draw-canvas > g rect");
  const box = async (x: number, y: number, label: string) => {
    await page.keyboard.press("r");
    await page.mouse.click(c.x + x, c.y + y);
    await page.locator(".draw-text").waitFor();
    await page.keyboard.type(label);
    await page.keyboard.press("Enter");
  };
  const drag = async (x1: number, y1: number, x2: number, y2: number, mod?: string) => {
    if (mod) await page.keyboard.down(mod);
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x1 + 4, y1 + 4);
    await page.mouse.move(x2, y2, { steps: 10 });
  };
  const drop = async (mod?: string) => {
    await page.mouse.up();
    if (mod) await page.keyboard.up(mod);
  };
  const attr = async (i: number, a: string) => Number(await rects.nth(i).getAttribute(a));
  await box(300, 300, "A");
  await box(600, 420, "B");
  await until("two boxes", async () => (await rects.count()) === 2);
  // ⌥V and ⌥H align centres (Excalidraw's keys); the Align row in the picker does the same by click.
  await page.keyboard.press("Meta+a");
  await page.keyboard.press("Alt+v");
  await until("⌥V aligns the centres vertically", async () => (await attr(0, "y")) === (await attr(1, "y")));
  await page.keyboard.press("Meta+z");
  await until("⌘Z takes it back", async () => (await attr(0, "y")) !== (await attr(1, "y")));
  await page.keyboard.press("s");
  const quick = page.locator(".draw-quick");
  await quick.waitFor();
  await quick.getByRole("button", { name: "Align top" }).click();
  await until("Align top in the picker lines up the tops", async () => (await attr(0, "y")) === (await attr(1, "y")));
  if (await quick.getByRole("button", { name: "Space evenly across" }).count()) throw new Error("Space evenly shows with only two picked");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  // Three in a row: ⌥⇧H spaces them evenly.
  await box(1000, 300, "C");
  await page.keyboard.press("Meta+a");
  await page.keyboard.press("Alt+Shift+h");
  const xs = async () => (await Promise.all([0, 1, 2].map((i) => attr(i, "x")))).sort((p, q) => p - q);
  await until("⌥⇧H spaces the gaps evenly", async () => { const v = await xs(); return Math.abs(v[1]! - v[0]! - (v[2]! - v[1]!)) < 1; });
  await page.keyboard.press("Escape");
  // A drag that stops a few pixels from another box's edge snaps to it, with a guide while it does; ⌘ holds it off.
  const b = (await rects.nth(1).boundingBox())!;
  const cBox = (await rects.nth(2).boundingBox())!;
  const dx = b.x + 4 - cBox.x; // C's left edge 4 px right of B's
  await drag(cBox.x + 40, cBox.y + 40, cBox.x + 40 + dx, cBox.y + 40 + 200);
  await until("a guide shows while snapped", async () => (await page.locator(".draw-overlay line[stroke='var(--accent)']").count()) > 0);
  await drop();
  await until("C snapped to B's left edge", async () => (await attr(2, "x")) === (await attr(1, "x")));
  await page.keyboard.press("Meta+z");
  await drag(cBox.x + 40, cBox.y + 40, cBox.x + 40 + dx, cBox.y + 40 + 200, "Meta");
  await drop("Meta");
  await until("⌘ keeps it where it was dropped", async () => Math.abs((await attr(2, "x")) - (await attr(1, "x")) - 4) < 1);
  await page.keyboard.press("Meta+z");
  // Dragged on past B at about the gap between A and B, C takes that gap exactly, with the two spans shown.
  const a = (await rects.nth(0).boundingBox())!;
  const gap = (await attr(1, "x")) - ((await attr(0, "x")) + 160); // in scene units (a bounding box adds the stroke)
  const want = b.x + b.width + gap;
  await drag(cBox.x + 40, cBox.y + 40, cBox.x + 40 + (want + 3 - cBox.x), cBox.y + 40);
  await until("two gap spans show", async () => (await page.locator(".draw-overlay path[stroke='var(--accent)']").count()) === 2);
  await drop();
  await until("C sits the same gap after B", async () => Math.abs((await attr(2, "x")) - ((await attr(1, "x")) + 160 + gap)) < 0.5);
  // Copy style carries the label's size (Tyler 4b): B's label made large, then pasted onto A.
  await page.mouse.click(b.x + 40, b.y + 40);
  await page.keyboard.press("s");
  await quick.getByRole("button", { name: "More" }).click();
  await quick.getByRole("button", { name: "Large", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Alt+Meta+c");
  await page.mouse.click(a.x + 40, a.y + 40);
  await page.keyboard.press("Alt+Meta+v");
  await until("A's label takes B's size", async () => (await page.locator(".diagram .draw-canvas > g text").first().getAttribute("font-size")) === "28");
  // A labelled box stops at its longest word (1a): C's label wraps after "Retrieval", never inside it.
  const cc = (await rects.nth(2).boundingBox())!;
  await page.mouse.click(cc.x + 40, cc.y + 40);
  await page.keyboard.press("Enter");
  await page.keyboard.type("Retrieval practice");
  await page.keyboard.press("Enter");
  await drag(cc.x + cc.width + 3, cc.y + cc.height / 2, cc.x + 20, cc.y + cc.height / 2);
  await drop();
  await until("the box stays as wide as its longest word", async () => { const w = await attr(2, "width"); return w > 90 && w < 150; });
  const bb = (await rects.nth(1).boundingBox())!;
  // A node made with Tab and left with nothing on it or its link goes with the link (3b); a deleted node takes its links (2b).
  const summary = () => page.locator("#draw-summary").textContent();
  const before = await summary();
  await page.keyboard.press("Tab");
  await page.locator(".draw-text").waitFor();
  await page.mouse.click(c.x + 1100, c.y + 700);
  await until("the empty node and its link are gone", async () => (await summary()) === before);
  await page.keyboard.press("a");
  await drag(a.x + 40, a.y + 40, (await rects.nth(1).boundingBox())!.x + 40, bb.y + 40);
  await drop();
  await until("an arrow joins A to B", async () => (await summary())?.includes("→") ?? false);
  await page.mouse.click(a.x + 40, a.y + 40);
  await page.keyboard.press("Backspace");
  await until("deleting A takes the arrow with it", async () => !(await summary())?.includes("→") && (await rects.count()) === 2);
});

journey("review: Esc keeps a half-typed answer and how sure he was, for when the card comes back", async (page) => {
  const pick = page.getByRole("dialog", { name: "What to review" });
  /** Starts a review of only the skills `only` names (null: every skill). */
  const start = async (only: RegExp | null) => {
    await page.getByRole("button", { name: "Start review" }).click();
    await pick.waitFor();
    for (const row of await pick.getByRole("checkbox").all()) {
      const want = !only || only.test(await row.innerText());
      if ((await row.getAttribute("aria-checked") === "true") !== want) await row.click();
    }
    await page.keyboard.press("Enter");
  };
  // Teaching's one card is a question he answers in his own words.
  await start(/Teaching/);
  const field = page.getByRole("textbox", { name: "Your answer" });
  await field.fill("half an answer");
  await page.getByRole("radio", { name: "Think so" }).click();
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
  await start(/Teaching/);
  await until("the answer is still there", async () => (await field.inputValue()) === "half an answer");
  await until("so is how sure he was", async () => (await page.getByRole("radio", { name: "Think so" }).getAttribute("aria-checked")) === "true");
  await field.fill("");
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
  // Every skill again, for the journeys after this one.
  await start(null);
  await page.locator(".review-q").waitFor();
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review: Start review clicked before the skills have loaded still asks what to review", async (page) => {
  // Home's numbers can land before the skill list (CI, 2026-11-07): the click must not start every skill unasked.
  await page.addInitScript("window.__ORE_SLOW = { skills: 1500 }");
  await page.reload();
  await page.getByRole("button", { name: "Start review" }).click();
  const pick = page.getByRole("dialog", { name: "What to review" });
  await pick.or(page.locator(".review")).first().waitFor();
  if (!(await pick.isVisible())) throw new Error("a review started without asking what to review");
  await until("every skill with cards due is listed", async () => (await pick.getByRole("checkbox").count()) > 1);
  await page.keyboard.press("Escape");
  await pick.waitFor({ state: "detached" });
});

journey("review: Open in source pauses on the card; Back to Review picks it up where he was", async (page) => {
  await page.getByRole("button", { name: "Start review" }).click();
  const pick = page.getByRole("dialog", { name: "What to review" });
  const q = page.locator(".review-q");
  await pick.or(q).first().waitFor();
  if (await pick.isVisible()) await page.keyboard.press("Enter");
  const open = page.getByRole("button", { name: /Open in source/ });
  // Show answers until a card offers its passage (a card he typed has none).
  for (let n = 0; n < 6 && !(await open.isVisible()); n++) {
    await q.waitFor();
    const noIdea = page.getByRole("button", { name: "No idea" });
    await (await noIdea.isVisible() ? noIdea : page.getByRole("radio", { name: "Think so" })).click();
    await page.getByRole("button", { name: "Good", exact: true }).waitFor();
    await page.waitForTimeout(300); // the passage loads after the answer
    if (await open.isVisible()) break;
    const was = await q.innerText();
    await page.getByRole("button", { name: "Good", exact: true }).click();
    await until("the next card", async () => (await q.innerText()) !== was);
  }
  const card = await q.innerText();
  await open.click();
  await page.locator(".doc-head").waitFor();
  await page.getByRole("button", { name: /Back to Review/ }).click();
  await until("the same card, answer still shown", async () => (await q.isVisible()) && (await q.innerText()) === card && (await page.getByRole("button", { name: "Good", exact: true }).isVisible()));
  // Esc in the reader goes back to Review too.
  await open.click();
  await page.locator(".doc-head").waitFor();
  await page.keyboard.press("Escape");
  await until("Esc returns to the card", async () => (await q.isVisible()) && (await q.innerText()) === card);
  // The session stayed open the whole time: rating this card and leaving ends it normally, on the end screen.
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await until("the card moves on", async () => !(await q.isVisible()) || (await q.innerText()) !== card);
  await page.keyboard.press("Escape");
  const doneButton = page.locator(".review-foot").getByRole("button", { name: "Done" });
  await doneButton.waitFor();
  if (await page.locator(".toast", { hasText: /session/i }).count()) throw new Error("ending the session failed");
  // Put back every rating made on the way, for the journeys after this one.
  await page.keyboard.press("Meta+z");
  await until("⌘Z leaves the end screen", async () => !(await doneButton.isVisible()));
  const undo = page.getByRole("button", { name: "Undo last rating" });
  for (let n = 0; n < 6 && (await undo.isVisible()); n++) await undo.click(), await page.waitForTimeout(250);
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review: Enter activates the focused button (Again, Edit card, Open in source); on the card it gives the suggested Good", async (page) => {
  const ratings: string[] = [];
  page.on("request", (r) => {
    const m = /"--rating=(\d)"/.exec(r.postData() ?? "");
    if (r.url().endsWith("/ore") && m) ratings.push(m[1]!);
  });
  await page.getByRole("button", { name: "Start review" }).click();
  const pick = page.getByRole("dialog", { name: "What to review" });
  const q = page.locator(".review-q");
  await pick.or(q).first().waitFor();
  if (await pick.isVisible()) await page.keyboard.press("Enter");
  const open = page.getByRole("button", { name: /Open in source/ });
  const good = page.getByRole("button", { name: "Good", exact: true });
  // A card with its passage (a Fact card, where ↵ suggests Good).
  for (let n = 0; n < 6; n++) {
    await q.waitFor();
    const noIdea = page.getByRole("button", { name: "No idea" });
    await (await noIdea.isVisible() ? noIdea : page.getByRole("radio", { name: "Think so" })).click();
    await good.waitFor();
    await page.waitForTimeout(300);
    if (await open.isVisible() && (await good.getAttribute("class"))?.includes("suggested")) break;
    const was = await q.innerText();
    await good.click();
    await until("the next card", async () => (await q.innerText()) !== was);
  }
  const card = await q.innerText();
  const before = ratings.length;
  /** Tabs from the Review surface until `name` has focus, then presses Enter. */
  const enterOn = async (name: string) => {
    await page.locator(".review").focus();
    for (let n = 0; n < 40; n++) {
      await page.keyboard.press("Tab");
      if (await page.evaluate((name) => (document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent ?? "").trim().startsWith(name), name)) break;
    }
    await page.keyboard.press("Enter");
  };
  await enterOn("Edit card");
  await until("Enter on Edit card opens the editor", async () => !(await q.isVisible()));
  await page.keyboard.press("Escape");
  await q.waitFor();
  await enterOn("Open in source");
  await page.locator(".doc-head").waitFor();
  await page.keyboard.press("Escape");
  await until("back on the card", async () => (await q.isVisible()) && (await q.innerText()) === card);
  if (ratings.length !== before) throw new Error(`Enter on a button recorded ${ratings.slice(before)}`);
  await page.waitForTimeout(300);
  await enterOn("Again");
  await until("Enter on Again records Again", async () => ratings.length === before + 1);
  if (ratings[before] !== "1") throw new Error(`Enter on Again recorded ${ratings[before]}`);
  // Enter on the Review surface itself still gives the suggestion.
  const undo = page.getByRole("button", { name: "Undo last rating" });
  await undo.click();
  await until("the card is back", async () => (await q.isVisible()) && (await q.innerText()) === card);
  await page.getByRole("radio", { name: "Think so" }).click();
  await good.waitFor();
  await page.waitForTimeout(350);
  await page.locator(".review").focus();
  await page.keyboard.press("Enter");
  await until("Enter on the card records Good", async () => ratings.length === before + 2);
  if (ratings[before + 1] !== "3") throw new Error(`Enter on the card recorded ${ratings[before + 1]}`);
  await undo.waitFor(); // the rating is sent; Undo shows once it is in
  for (let n = 0; n < 8 && (await undo.isVisible()); n++) await undo.click(), await page.waitForTimeout(250);
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review Ask: closing and reopening it keeps the reply so far and a half-typed follow-up", async (page) => {
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"ask",')) return route.fallback();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: "Because recalling it is the practice.", proposal: null, session: "s1" }) });
  });
  await page.getByRole("button", { name: "Start review" }).click();
  const pick = page.getByRole("dialog", { name: "What to review" });
  const q = page.locator(".review-q");
  await pick.or(q).first().waitFor();
  if (await pick.isVisible()) await page.keyboard.press("Enter");
  await q.waitFor();
  const noIdea = page.getByRole("button", { name: "No idea" });
  await (await noIdea.isVisible() ? noIdea : page.getByRole("radio", { name: "Think so" })).click();
  const toggle = page.getByRole("button", { name: "Ask about this" });
  await toggle.click();
  const field = page.getByRole("textbox", { name: "Ask about this card" });
  await field.fill("Why is this the answer?");
  await page.keyboard.press("Enter");
  const ask = page.getByRole("region", { name: "Ask about this" });
  await ask.getByText("Because recalling it is the practice.").waitFor();
  await field.fill("And after a week?");
  await toggle.click();
  await until("Ask closes", async () => (await ask.count()) === 0);
  await toggle.click();
  await ask.getByText("Because recalling it is the practice.").waitFor();
  await until("the follow-up is still there", async () => (await field.inputValue()) === "And after a week?");
  await field.fill("");
  await page.keyboard.press("Escape"); // closes Ask
  await until("Ask closes", async () => (await ask.count()) === 0);
  await page.unroute(/\/ore$/);
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
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
  // Leave Review as he would, so its session ends: one left open carries into the journeys after this one.
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review: the next card is loaded while he answers, so a rating moves straight on", async (page) => {
  // Each card takes 1.2 s to load here: only one loaded ahead shows within half a second of the rating.
  await page.addInitScript("window.__ORE_SLOW = { card: 1200 }");
  await page.reload();
  await page.getByRole("button", { name: "Start review" }).click();
  const pick = page.getByRole("dialog", { name: "What to review" });
  const q = page.locator(".review-q");
  await pick.or(q).first().waitFor();
  if (await pick.isVisible()) await page.keyboard.press("Enter");
  await q.waitFor({ timeout: 8000 });
  const first = await q.innerText();
  await page.waitForTimeout(1500);
  await reveal(page);
  await page.getByRole("button", { name: "Good", exact: true }).click();
  const t0 = Date.now();
  await page.waitForFunction((first) => { const el = document.querySelector(".review-q"); return !!el && el.textContent !== first; }, first, { timeout: 8000 });
  if (Date.now() - t0 > 900) throw new Error(`the next card took ${Date.now() - t0} ms after the rating: it wasn't loaded ahead`);
  await page.getByRole("button", { name: "Undo last rating" }).click();
  await until("Undo puts the first card back", async () => (await q.innerText()) === first);
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});
journey("review: ⌘Z on the end screen takes the last rating back and returns to that card; ⇧⌘Z gives it again", async (page) => {
  await page.getByRole("button", { name: "Start review" }).click();
  const pick = page.getByRole("dialog", { name: "What to review" });
  const q = page.locator(".review-q");
  await pick.or(q).first().waitFor();
  if (await pick.isVisible()) await page.keyboard.press("Enter");
  const doneButton = page.locator(".review-foot").getByRole("button", { name: "Done" });
  let last = "";
  for (let n = 0; n < 12 && !(await doneButton.isVisible()); n++) {
    await q.or(doneButton).first().waitFor();
    if (await doneButton.isVisible()) break;
    // The last card can go while the session wraps up, between that wait and this read: look again.
    const text = await q.first().textContent({ timeout: 1000 }).catch(() => null);
    if (!text) continue;
    last = text;
    const noIdea = page.getByRole("button", { name: "No idea" });
    await (await noIdea.isVisible() ? noIdea : page.getByRole("radio", { name: "Think so" })).click();
    await page.getByRole("button", { name: "Good", exact: true }).click();
    await until("the card moves on", async () => (await doneButton.isVisible()) || ((await q.count()) > 0 && ((await q.first().textContent({ timeout: 500 }).catch(() => last)) !== last)));
  }
  await doneButton.waitFor();
  await page.waitForTimeout(300);
  await page.keyboard.press("Meta+z");
  // The card can be swapped between the count and the read: read with a short wait, and look again.
  await until("⌘Z leaves the end screen for the last card", async () => !(await doneButton.isVisible()) && (await q.first().textContent({ timeout: 500 }).catch(() => null)) === last);
  await page.keyboard.press("Shift+Meta+z");
  await until("⇧⌘Z rates it again and the session ends again", () => doneButton.isVisible());
  // Put every rating back for the journeys after this one.
  const undo = page.getByRole("button", { name: "Undo last rating" });
  for (let n = 0; n < 12 && (await undo.isVisible()); n++) {
    await undo.click({ timeout: 1000 }).catch(() => {});
    await page.waitForTimeout(250);
  }
  await page.keyboard.press("Escape");
});

/** The `ore` CLI through the bridge, as the app calls it. */
const ore = (...args: string[]) =>
  fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: [...args, "--json"] }) }).then(async (r) => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });

/** Starts a review of the skills whose row in "What to review" matches `only` (null: every skill). */
async function startReview(page: Page, only: RegExp | null) {
  const pick = page.getByRole("dialog", { name: "What to review" });
  await page.getByRole("button", { name: "Start review" }).click();
  await pick.waitFor();
  for (const row of await pick.getByRole("checkbox").all()) {
    const want = !only || only.test(await row.innerText());
    if ((await row.getAttribute("aria-checked") === "true") !== want) await row.click();
  }
  await page.keyboard.press("Enter");
  await page.locator(".review-q").waitFor();
}

/** Shows the answer of the card on screen: No idea on a question, Think so on a card. */
async function reveal(page: Page) {
  const noIdea = page.getByRole("button", { name: "No idea" });
  await (await noIdea.isVisible() ? noIdea : page.getByRole("radio", { name: "Think so" })).click();
  await page.getByRole("button", { name: "Good", exact: true }).waitFor();
  await page.waitForTimeout(300); // the passage loads after the answer, and a rating key right after it is ignored
}

/** Every `ore` call a page makes, in order, and the ratings it logged (to take back after the journey). */
function oreCalls(page: Page) {
  const calls: string[][] = [];
  const rated: { card: string; ts: string }[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/ore")) calls.push((JSON.parse(r.postData() ?? "{}") as { args: string[] }).args);
  });
  page.on("response", async (r) => {
    if (r.request().method() !== "POST" || !r.url().endsWith("/ore") || !r.ok()) return;
    const args = (JSON.parse(r.request().postData() ?? "{}") as { args: string[] }).args;
    if (args[0] === "review" && !args.some((a) => a.startsWith("--undo"))) rated.push(await r.json());
  });
  return { calls, rated, undoAll: async () => { for (const r of rated.splice(0).reverse()) await ore("review", r.card, `--undo=${r.ts}`).catch(() => {}); } };
}

/** The quick quiz window (D76), as a second page on the same library; `quiz-open` shows it. */
async function openQuiz(): Promise<Page> {
  const quiz = await browser.newPage({ viewport: { width: 680, height: 520 } });
  quiz.setDefaultTimeout(8000);
  quiz.on("pageerror", (e) => errors.push(e.message));
  await quiz.addInitScript(`window.__ORE_BRIDGE = ${BRIDGE}; window.__ORE_LABEL = "quiz"`);
  await quiz.addInitScript({ path: join(MOCK, "tauri.js") });
  await quiz.goto(url);
  await quiz.locator(".quick").waitFor({ state: "attached" });
  await quiz.waitForTimeout(300); // its event listeners register
  return quiz;
}
const emit = (page: Page, event: string) => page.evaluate((e) => (window as unknown as { __emit: (e: string) => void }).__emit(e), event);

journey("review: the quick quiz during a review keeps its own session; the card it rated drops out, and the review still ends on its end screen", async (page) => {
  const main = oreCalls(page);
  await startReview(page, null);
  const q = page.locator(".review-q");
  await reveal(page);
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await until("the next card shows", async () => main.rated.length === 1 && (await q.count()) > 0);
  const quiz = await openQuiz();
  const inQuiz = oreCalls(quiz);
  try {
    await emit(quiz, "quiz-open");
    await quiz.locator(".review-q").waitFor();
    const asked = await quiz.locator(".review-q").innerText();
    if ((await q.innerText()) !== asked) throw new Error(`the quiz asked another card than the one on screen: ${asked}`);
    await reveal(quiz);
    await quiz.getByRole("button", { name: "Good", exact: true }).click();
    await until("the quiz logs it", async () => inQuiz.rated.length === 1);
    await quiz.keyboard.press("Escape");
    await quiz.locator(".review").waitFor({ state: "detached" });
    await emit(page, "quiz-closed");
    await until("the card the quiz rated leaves the main window", async () => (await q.count()) > 0 && (await q.innerText()) !== asked);
    await reveal(page);
    await page.getByRole("button", { name: "Again", exact: true }).click();
    await until("the miss is logged", async () => main.rated.length === 2);
    await page.keyboard.press("Escape");
    await page.locator(".review-foot").getByRole("button", { name: "Done" }).waitFor();
    const sessions = new Set(main.calls.filter((a) => a[0] === "review").map((a) => a.find((x) => x.startsWith("--session="))));
    if (sessions.size !== 1 || sessions.has(undefined)) throw new Error(`the main window's ratings went to sessions ${[...sessions].join(", ")}`);
  } finally {
    await quiz.close();
    await main.undoAll();
    await inQuiz.undoAll();
  }
  await page.keyboard.press("Enter");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review: when the quick quiz closes, a new card it didn't rate stays, even with the day's new cards used up", async (page) => {
  // Storytelling holds only the day's new draft, so it is the first card (over due cards a new one is every fifth, D144).
  await startReview(page, /Storytelling/);
  const q = page.locator(".review-q");
  await page.locator(".review-new").first().waitFor();
  const draft = await q.innerText();
  const goal = (await ore("today")) as { new_per_day: number };
  await ore("goal", "--new-per-day=0");
  try {
    await emit(page, "quiz-closed");
    await page.waitForTimeout(1200);
    if ((await q.innerText()) !== draft) throw new Error("the new card on screen went when the quiz closed");
  } finally {
    await ore("goal", `--new-per-day=${goal.new_per_day}`);
  }
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("quick quiz: put away and shown again in one go, it shows afresh with its own session; Esc closes quietly", async (page) => {
  const quiz = await openQuiz();
  const calls = oreCalls(quiz);
  try {
    await emit(quiz, "quiz-open");
    await quiz.locator(".review-q").waitFor();
    // The shortcut twice at once: put away and shown again in one task.
    await quiz.evaluate(() => {
      const w = window as unknown as { __emit: (e: string) => void };
      w.__emit("quiz-away");
      w.__emit("quiz-open");
    });
    await quiz.locator(".review-q").waitFor();
    await reveal(quiz);
    await quiz.getByRole("button", { name: "Again", exact: true }).click();
    await until("the miss is logged", async () => calls.rated.length === 1);
    await quiz.keyboard.press("Escape");
    await quiz.locator(".review").waitFor({ state: "detached" });
    await quiz.waitForTimeout(400);
    const shown = await quiz.locator(".quick").innerText();
    if (shown.trim()) throw new Error(`Esc left: ${shown}`);
  } finally {
    await calls.undoAll();
    await quiz.close();
  }
  await page.getByRole("button", { name: "Start review" }).waitFor();
});

journey("review: ⌘Z on Home after leaving takes the rating back, leaves the session ended, and Home reads its numbers again", async (page) => {
  const app = oreCalls(page);
  await startReview(page, null);
  for (let n = 0; n < 2; n++) {
    await reveal(page);
    await page.getByRole("button", { name: "Good", exact: true }).click();
    await until("the rating is logged", async () => app.rated.length === n + 1);
  }
  await page.keyboard.press("Escape");
  const done = page.locator(".review-foot").getByRole("button", { name: "Done" });
  await done.waitFor();
  await page.keyboard.press("Enter");
  await page.locator(".review").waitFor({ state: "detached" });
  await page.waitForTimeout(300);
  const from = app.calls.length;
  await page.keyboard.press("Meta+z");
  const after = () => app.calls.slice(from);
  await until("⌘Z takes the rating back", async () => after().some((a) => a[0] === "review" && a.some((x) => x.startsWith("--undo"))));
  await until("Home reads today again", async () => after().some((a) => a[0] === "today"));
  await page.waitForTimeout(300);
  if (after().some((a) => a[0] === "session")) throw new Error(`⌘Z on Home touched the ended session: ${JSON.stringify(after().filter((a) => a[0] === "session"))}`);
  app.rated.pop();
  // ⇧⌘Z gives it again, in no session: the one it was given in has ended.
  const redoFrom = app.calls.length;
  await page.keyboard.press("Shift+Meta+z");
  await until("⇧⌘Z rates it again", async () => app.rated.length === 2);
  const redo = app.calls.slice(redoFrom).find((a) => a[0] === "review")!;
  await app.undoAll();
  if (redo.some((x) => x.startsWith("--session="))) throw new Error(`the rating given again went into the ended session: ${redo.join(" ")}`);
});

journey("review: ⌘Z pressed twice while a rating saves takes back both newest ratings, and one pressed as the quick quiz closes still lands", async (page) => {
  const app = oreCalls(page);
  await page.addInitScript("window.__ORE_SLOW = { review: 700 }");
  await page.reload();
  await page.locator(".side-item").first().waitFor();
  await startReview(page, null);
  const q = page.locator(".review-q");
  const undone = () => app.calls.filter((a) => a[0] === "review" && a.some((x) => x.startsWith("--undo"))).map((a) => a.find((x) => x.startsWith("--undo"))!.slice(7));
  const first = await q.innerText();
  try {
    await reveal(page);
    await page.getByRole("button", { name: "Good", exact: true }).click();
    await until("the first rating is logged", async () => app.rated.length === 1);
    await until("the next card shows", async () => (await q.count()) > 0 && !(await page.getByRole("button", { name: "Good", exact: true }).isVisible()));
    await reveal(page);
    await page.getByRole("button", { name: "Good", exact: true }).click();
    await page.waitForTimeout(100);
    await page.keyboard.press("Meta+z");
    await page.keyboard.press("Meta+z");
    await until("both ratings are taken back, newest first", async () => undone().length === 2, 8000);
    if (undone().join() !== [app.rated[1]!.ts, app.rated[0]!.ts].join()) throw new Error(`took back ${undone().join()}, not ${app.rated.map((r) => r.ts).reverse().join()}`);
    await until("back on the first card", async () => (await q.count()) > 0 && (await q.innerText()) === first);
    app.rated.splice(0);
  } finally {
    await app.undoAll();
  }
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
  // The quick quiz put away while its rating saves, with ⌘Z pressed: the rating is still taken back.
  const quiz = await openQuiz();
  await quiz.addInitScript("window.__ORE_SLOW = { review: 700 }");
  await quiz.reload();
  await quiz.locator(".quick").waitFor({ state: "attached" });
  await quiz.waitForTimeout(300);
  const inQuiz = oreCalls(quiz);
  try {
    await emit(quiz, "quiz-open");
    await quiz.locator(".review-q").waitFor();
    await reveal(quiz);
    await quiz.getByRole("button", { name: "Good", exact: true }).click();
    await quiz.waitForTimeout(100);
    await quiz.keyboard.press("Meta+z");
    await emit(quiz, "quiz-away");
    await until("the quiz's rating is logged", async () => inQuiz.rated.length === 1);
    await until("and taken back", async () => inQuiz.calls.some((a) => a[0] === "review" && a.includes(`--undo=${inQuiz.rated[0]!.ts}`)), 6000);
    inQuiz.rated.splice(0);
  } finally {
    await inQuiz.undoAll();
    await quiz.close();
  }
});

journey("review: a held ↵ rates the last card once and the end screen stays", async (page) => {
  const app = oreCalls(page);
  await startReview(page, /^\s*AI\b/);
  await page.keyboard.press("2");
  await page.getByRole("button", { name: "Good", exact: true }).waitFor();
  await page.waitForTimeout(350);
  const from = app.calls.length;
  await page.keyboard.down("Enter");
  for (let n = 0; n < 30; n++) {
    await page.waitForTimeout(40);
    await page.keyboard.down("Enter"); // held: each repeat comes with repeat: true
  }
  await page.keyboard.up("Enter");
  const done = page.locator(".review-foot").getByRole("button", { name: "Done" });
  await done.waitFor();
  await page.waitForTimeout(300);
  const later = app.calls.slice(from);
  try {
    if (!(await done.isVisible())) throw new Error("the end screen closed under the held ↵");
    if (app.rated.length !== 1) throw new Error(`${app.rated.length} ratings`);
    if (later.filter((a) => a[0] === "session" && a[1] === "start").length) throw new Error("the held ↵ started another session");
  } finally {
    await app.undoAll();
  }
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review: ⌘Z while a rating saves, or while the session wraps up, takes back that rating, never an older one", async (page) => {
  const app = oreCalls(page);
  await page.addInitScript("window.__ORE_SLOW = { review: 600, session: 600 }");
  await page.reload();
  await page.locator(".side-item").first().waitFor();
  await startReview(page, null);
  const q = page.locator(".review-q");
  const undone = () => app.calls.filter((a) => a[0] === "review" && a.some((x) => x.startsWith("--undo"))).map((a) => a.find((x) => x.startsWith("--undo"))!.slice(7));
  try {
    // Mid-session: the second rating is still saving.
    await reveal(page);
    await page.getByRole("button", { name: "Good", exact: true }).click();
    await until("the first rating is logged", async () => app.rated.length === 1);
    await until("the next card shows", async () => (await q.count()) > 0 && !(await page.getByRole("button", { name: "Good", exact: true }).isVisible()));
    const second = await q.innerText();
    await reveal(page);
    await page.getByRole("button", { name: "Good", exact: true }).click();
    await page.waitForTimeout(100);
    await page.keyboard.press("Meta+z");
    await until("⌘Z takes back the rating that was saving", async () => app.rated.length === 2 && undone().length === 1);
    if (undone()[0] !== app.rated[1]!.ts) throw new Error(`⌘Z took back ${undone()[0]}, not the newest rating ${app.rated[1]!.ts}`);
    await until("that card is back", async () => (await q.count()) > 0 && (await q.innerText()) === second);
    app.rated.pop();
  } finally {
    await app.undoAll();
  }
  await page.keyboard.press("Escape"); // the first card's rating stood until now: the end screen, then away
  await page.locator(".review-foot").getByRole("button", { name: "Done" }).waitFor();
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
  // Wrapping up: the last card's rating is saved and the session is ending.
  await startReview(page, /^\s*AI\b/);
  try {
    await reveal(page);
    await page.getByRole("button", { name: "Good", exact: true }).click();
    await until("the rating is logged", async () => app.rated.length === 1);
    await page.keyboard.press("Meta+z");
    await until("⌘Z takes back that rating and returns to the card", async () => undone().includes(app.rated[0]!.ts) && (await q.count()) > 0);
    app.rated.pop();
  } finally {
    await app.undoAll();
  }
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review: two rating keys in one task log one rating", async (page) => {
  const app = oreCalls(page);
  await startReview(page, null);
  await reveal(page);
  await page.evaluate(() => {
    const at = document.querySelector(".review")!;
    for (const code of ["Digit3", "Digit4"]) at.dispatchEvent(new KeyboardEvent("keydown", { code, key: code.slice(5), bubbles: true }));
  });
  await page.waitForTimeout(600);
  try {
    if (app.calls.filter((a) => a[0] === "review").length !== 1) throw new Error(`${app.calls.filter((a) => a[0] === "review").length} ratings logged`);
  } finally {
    await app.undoAll();
  }
  await page.keyboard.press("Escape");
  await page.locator(".review-foot").getByRole("button", { name: "Done" }).waitFor();
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review: a card whose source was deleted says so where the passage would be", async (page) => {
  await startReview(page, null);
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: object }).__ORE_FAIL = { show: 'ore: no item matches "01M6Y78"' }));
  await reveal(page);
  await page.locator(".review-passage").getByText("Its source is no longer in the library.").waitFor();
  if (await page.getByRole("button", { name: /Open in source/ }).count()) throw new Error("Open in source shows for a source that is gone");
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review picker: fresh numbers that drop the only ticked skill leave nothing to start", async (page) => {
  await page.getByRole("button", { name: "Start review" }).waitFor(); // Home has read today's numbers
  let release!: () => void;
  const held = new Promise<void>((ok) => (release = ok));
  let drop = "";
  await page.route(/\/ore$/, async (route) => {
    if (!(route.request().postData() ?? "").includes('"today"')) return route.fallback();
    const res = await route.fetch();
    const t = (await res.json()) as { skills: { skill: string; due: number }[] };
    await held;
    await route.fulfill({ response: res, json: { ...t, skills: t.skills.filter((x) => x.skill !== drop) } });
  });
  await page.keyboard.press("Meta+r");
  const pick = page.getByRole("dialog", { name: "What to review" });
  const rows = pick.getByRole("checkbox");
  await until("two skills or more are due", async () => (await rows.count()) > 1);
  const first = await rows.first().locator(".name").innerText();
  drop = ((await ore("skills")) as { id: string; name: string }[]).find((k) => k.name === first)!.id;
  for (const row of (await rows.all()).slice(1)) if ((await row.getAttribute("aria-checked")) === "true") await row.click();
  release();
  await until("the fresh numbers land", async () => !(await pick.getByRole("checkbox", { name: new RegExp(first) }).count()));
  await pick.getByRole("button", { name: "Pick a skill" }).waitFor();
  if (await pick.getByRole("button", { name: "Pick a skill" }).isEnabled()) throw new Error("Start is on with no shown skill ticked");
  await page.unroute(/\/ore$/);
  await page.keyboard.press("Escape");
});

journey("review: a Tutor card with no passage still offers Open in source after the answer, and it opens that source", async (page) => {
  // The seed's Storytelling card: the tutor kept it, so it has its source but no passage in it.
  await startReview(page, /Storytelling/);
  const q = page.locator(".review-q");
  const question = "Which word links the Story Spine's middle beats?";
  if ((await q.innerText()) !== question) throw new Error(`the card is ${await q.innerText()}`);
  await reveal(page);
  await page.getByRole("button", { name: /Open in source/ }).click();
  await page.locator(".doc-head").filter({ hasText: "The Story Spine" }).waitFor();
  await page.keyboard.press("Escape");
  await until("back on the card", async () => (await q.isVisible()) && (await q.innerText()) === question);
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review: editing an Explain card corrects a key point too; it's there when the editor opens again, and ⌘Z puts it back", async (page) => {
  await startReview(page, /Teaching/);
  const was = "Names fluency or familiarity";
  const now = "Names fluency (it reads easily)";
  const id = ((await ore("due")) as { id: string; question: string }[]).find((e) => e.question.startsWith("Explain why rereading"))!.id;
  const rubric = async () => ((await ore("card", "show", id)) as { rubric: string[] }).rubric;
  await reveal(page);
  const points = page.locator(".quiz-points");
  await points.getByText(was).waitFor();
  await page.getByRole("button", { name: "Edit card" }).click();
  const field = page.getByRole("textbox", { name: "Key points" });
  await until("the editor lists the key points, one a line", async () => (await field.inputValue()).split("\n")[0] === was);
  await field.fill((await field.inputValue()).replace(was, now));
  await page.getByRole("button", { name: "Save" }).click();
  await points.getByText(now).waitFor();
  if ((await rubric())[0] !== now) throw new Error(`saved ${await rubric()}`);
  await page.getByRole("button", { name: "Edit card" }).click();
  await until("opened again, the editor has the new point", async () => (await field.inputValue()).split("\n")[0] === now);
  await page.keyboard.press("Escape");
  await page.locator(".review").focus();
  await page.keyboard.press("Meta+z");
  await points.getByText(was).waitFor();
  await until("⌘Z saved the old point back", async () => (await rubric())[0] === was);
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review: retiring a card keeps ⌘Z for the ratings before it, and so does a retire that fails", async (page) => {
  await startReview(page, null);
  const q = page.locator(".review-q");
  const good = page.getByRole("button", { name: "Good", exact: true });
  const rated: string[] = [];
  for (let n = 0; n < 2; n++) {
    rated.push(await q.innerText());
    await reveal(page);
    await good.click();
    await until("the next card", async () => (await q.innerText()) !== rated[n]);
  }
  const third = await q.innerText();
  await reveal(page);
  const retire = page.getByRole("button", { name: /^(Retire|Delete) card$/ });
  // The write fails: the card stays, and so does Undo for the two ratings.
  await page.route(/\/ore$/, async (route) => {
    if (!(route.request().postData() ?? "").includes('"retire"')) return route.fallback();
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify("Couldn’t write the card.") });
  });
  await retire.click();
  await page.locator(".toast", { hasText: "Couldn’t write the card." }).waitFor();
  await page.unroute(/\/ore$/);
  if (!(await page.getByRole("button", { name: "Undo last rating" }).isVisible())) throw new Error("a failed retire dropped Undo for the ratings before it");
  await retire.click();
  await until("the retired card goes", async () => !(await q.isVisible()) || (await q.innerText()) !== third);
  await page.locator(".review").focus();
  const restored = page.waitForResponse((r) => (r.request().postData() ?? "").includes('"restore"'));
  await page.keyboard.press("Meta+z");
  await restored;
  await page.keyboard.press("Meta+z");
  await until("⌘Z takes back the second rating", async () => (await q.isVisible()) && (await q.innerText()) === rated[1]);
  await page.keyboard.press("Meta+z");
  await until("⌘Z takes back the first rating", async () => (await q.isVisible()) && (await q.innerText()) === rated[0]);
  if (await page.getByRole("button", { name: "Undo last rating" }).isVisible()) throw new Error("a rating is left to undo");
  // The retire was taken back too: the card is in review again.
  if (!((await ore("due")) as { question: string }[]).some((e) => e.question === third)) throw new Error("the retired card didn't come back");
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("try it: 4 marks a technique to try, the skill page checks it off, and how it went is kept through a failed save and after a reload", async (page) => {
  await openSource(page, TESTING);
  await select(page, "Each successful retrieval changes the memory itself");
  await page.getByRole("dialog", { name: "Highlight" }).waitFor();
  await page.keyboard.press("4");
  const sw = page.getByRole("dialog", { name: "Highlight" }).getByRole("button", { name: "Try it" });
  await until("Try it is on", async () => (await sw.getAttribute("aria-pressed")) === "true");
  await until("the plan field has the caret", async () => page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Note"));
  await page.keyboard.type("Quiz myself before each edit session");
  await page.keyboard.press("Enter");
  await page.locator(".collected-chip.apply").waitFor();
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  const row = page.locator(".try").filter({ hasText: "Quiz myself before each edit session" });
  await row.getByRole("checkbox", { name: "Mark tried" }).click();
  const field = page.getByLabel("How did it go?");
  await field.fill("Caught two gaps before recording");
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { tried: "The library is read-only." }));
  await page.keyboard.press("Enter");
  await page.locator(".toast[role=alert]").filter({ hasText: "The library is read-only." }).waitFor();
  await until("the failed save opens the field again with every word", async () => (await field.isVisible()) && (await field.inputValue()) === "Caught two gaps before recording");
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
  await field.focus();
  await page.keyboard.press("Enter");
  const saved = page.locator(".try-reflection", { hasText: "Caught two gaps before recording" });
  await saved.waitFor();
  await Bun.sleep(500);
  await page.reload();
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  await page.locator(".answered-toggle", { hasText: "Tried" }).click();
  await saved.waitFor();
});

journey("archive a source from its row, then Undo from the toast; VoiceOver hears the toast", async (page) => {
  // The live region is there before the toast, so a screen reader reads the toast when it comes.
  const live = page.locator(".toasts[aria-live=polite]");
  await live.waitFor({ state: "attached" });
  await page.getByRole("button", { name: /^All sources/ }).click();
  const row = page.locator(".row").filter({ hasText: AGENTS }).first();
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: /Archive/ }).click();
  await until("the row leaves the list", async () => !(await row.isVisible()));
  await until("the toast lands in it", async () => (await live.locator(".toast").count()) > 0);
  await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
  await row.waitFor();
  // An Undo pressed while the archive still saves runs after it, so the file ends restored (the two
  // `ore` runs used to race, and the archive could land last).
  await until("the library has it back", async () => ((await ore("ls")) as { title: string }[]).some((i) => i.title === AGENTS));
  await page.waitForTimeout(1000);
  if (!((await ore("ls")) as { title: string }[]).some((i) => i.title === AGENTS)) throw new Error("the archive landed after its Undo");
  await row.waitFor();
});

journey("finish: when drafting the cards fails, a toast says why and Try again drafts them", async (page) => {
  await openSource(page, AGENTS);
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { enrich: "Claude is signed out." }));
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Just mark done" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  const toast = page.locator(".toast").filter({ hasText: "weren’t drafted: Claude is signed out." });
  await toast.waitFor();
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
  await toast.getByRole("button", { name: "Try again" }).click();
  await toast.waitFor({ state: "detached" });
  // Back to reading, for the journeys after this one.
  await page.evaluate(async (title) => {
    const ore = (args: string[]) => (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__.invoke("ore", { args });
    const items = (await ore(["ls"])) as { id: string; title: string }[];
    await ore(["status", items.find((i) => i.title === title)!.id, "reading"]);
  }, AGENTS);
});

journey("finish again: the recall box holds the last recall with the caret at its end, and the note holds it once", async (page) => {
  const title = "Recall twice";
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill(`# ${title}\n\nA page to finish twice, adding to the recall the second time.`);
  await page.keyboard.press("Enter");
  await page.locator(".doc").getByText("A page to finish twice").waitFor();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByLabel("Free recall").fill("FIRST recall text.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Keep reading" }).click();
  await page.reload();
  await page.locator(".side-item").first().waitFor();
  await openSource(page, title);
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  const box = page.getByLabel("Free recall");
  await until("the box holds the last recall", async () => (await box.inputValue()) === "FIRST recall text.");
  const caret = await box.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.value.length]);
  if (caret[0] !== caret[1]) throw new Error(`the caret is at ${caret[0]} of ${caret[1]}, not at the end`);
  await page.keyboard.type(" SECOND.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Keep reading" }).waitFor();
  const note = await page.evaluate(async (title) => {
    const ore = (args: string[]) => (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__.invoke("ore", { args });
    const items = (await ore(["ls"])) as { id: string; title: string }[];
    return ((await ore(["notes", items.find((i) => i.title === title)!.id])) as { text: string }).text;
  }, title);
  if (note.trim() !== "## Recall\n\nFIRST recall text. SECOND.") throw new Error(`the note is ${JSON.stringify(note)}`);
});

journey("focus comes back to what opened it: the tutor's ✦ after Esc, and a Continue reading row after Esc from its source", async (page) => {
  const on = (sel: string) => page.evaluate((sel) => !!document.activeElement?.matches(sel), sel);
  await page.locator(".tutor-bubble").focus();
  await page.keyboard.press("Enter");
  await page.locator(".tutor textarea, .tutor [contenteditable=true]").first().waitFor();
  await page.keyboard.press("Escape");
  await until("focus is back on the ✦", () => on(".tutor-bubble"));
  const row = page.locator(".home-read").first();
  await row.focus();
  const title = (await row.innerText()).split("\n")[0]!;
  await page.keyboard.press("Enter");
  await page.locator(".doc").waitFor();
  await page.keyboard.press("Escape");
  await page.locator(".home-read").first().waitFor();
  await until(`focus is back on “${title}”`, async () => (await on(".home-read")) && (await page.evaluate(() => (document.activeElement as HTMLElement).innerText.split("\n")[0])) === title);
  // Opened from Home but left another way (All sources, another source, ⌘0): no old row takes focus later.
  await page.keyboard.press("Enter");
  await page.locator(".doc").waitFor();
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.locator(".row").filter({ hasText: AGENTS }).first().click();
  await page.locator(".doc-head").filter({ hasText: AGENTS }).waitFor();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Meta+Digit0");
  await page.locator(".home-read").first().waitFor();
  await page.waitForTimeout(200);
  if (await on(".home-read")) throw new Error("a row opened long ago took focus on ⌘0");
});

journey("in-place editors give focus back on Esc: the author, a skill's goal, a new question; the notes have names", async (page) => {
  const on = (name: string) => page.evaluate((name) => document.activeElement?.getAttribute("aria-label") === name || (document.activeElement as HTMLElement | null)?.innerText.trim() === name, name);
  await openSource(page, AGENTS);
  const by = page.locator("button.by");
  const author = (await by.innerText()).trim();
  await by.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("textbox", { name: "Author" }).waitFor();
  await page.keyboard.press("Escape");
  await until("focus is back on the author", () => on(author));
  await page.getByRole("textbox", { name: "Source note" }).waitFor({ state: "attached" });
  await page.keyboard.press("Escape");
  await page.locator(".sidebar .side-item:not(.side-main)").first().click();
  const goal = page.locator("button.skill-goal");
  await goal.focus();
  const was = (await goal.innerText()).trim();
  await page.keyboard.press("Enter");
  await page.locator("input.skill-goal").waitFor();
  await page.keyboard.press("Escape");
  await until("focus is back on the goal", () => on(was));
  await page.getByRole("textbox", { name: "Skill note" }).waitFor({ state: "attached" });
  const add = page.getByRole("button", { name: "Add a question" });
  await add.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("textbox", { name: "New question" }).waitFor();
  await page.keyboard.press("Escape");
  await until("focus is back on Add a question", () => on("Add a question"));
});

journey("outline: Tab after the source's head opens it on the current heading, ↓ and Enter jump, Esc goes back to the text and keeps the source", async (page) => {
  const focused = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.innerText.trim() ?? "");
  await openSource(page, AGENTS);
  await page.locator(".preq-head").focus();
  await page.keyboard.press("Tab");
  await until("Tab lands on the outline's first heading", async () => (await focused()) === "Workflows and agents");
  await until("the outline shows", async () => (await page.locator(".outline-panel").evaluate((el) => getComputedStyle(el).opacity)) === "1");
  await page.keyboard.press("ArrowDown");
  await until("↓ moves to the next heading", async () => (await focused()) === "Patterns");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await until("⇧Tab back comes to the heading the arrows left it on", async () => (await focused()) === "Patterns");
  const before = await page.locator(".reader-scroll").evaluate((el) => el.scrollTop);
  await page.keyboard.press("Enter");
  await until("Enter jumps there and hands the text the focus", () => page.locator(".reader-scroll").evaluate((el, before) => el === document.activeElement && el.scrollTop > before, before));
  await page.locator(".outline-panel button").first().focus();
  await page.keyboard.press("Escape");
  await until("Esc goes back to the text", () => page.evaluate(() => document.activeElement?.classList.contains("reader-scroll") === true));
  if (!(await page.locator(".doc-head").filter({ hasText: AGENTS }).count())) throw new Error("Esc on the outline left the source");
});

journey("sidebar: closing a hover-only ⋯ or + gives focus to its row, and ⇧⌘S from the sidebar puts it on the list", async (page) => {
  const focused = () => page.evaluate(() => { const el = document.activeElement as HTMLElement | null; return el ? `${el.className} ${el.innerText.trim()}` : ""; });
  const row = page.locator(".sidebar .side-item").filter({ has: page.locator(".side-more") }).first();
  const name = (await row.locator(".side-main .label").innerText()).trim();
  await row.hover();
  await row.locator(".side-more").click();
  await page.getByRole("menu").waitFor();
  await page.keyboard.press("Escape");
  await until(`the ⋯'s menu gives focus to “${name}”`, async () => (await focused()).startsWith("side-main") && (await focused()).endsWith(name));
  const head = page.locator(".sidebar .side-head").filter({ has: page.locator(".side-tool[aria-label^='New skill in']") }).first();
  const group = (await head.locator(".side-label-text").innerText()).trim();
  await head.hover();
  await head.locator(".side-tool[aria-label^='New skill in']").click();
  await page.getByRole("textbox", { name: "New skill name" }).waitFor();
  await page.keyboard.press("Escape");
  await until(`the + gives focus to “${group}”`, async () => (await focused()).startsWith("side-label") && (await focused()).includes(group));
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.locator(".list").waitFor();
  await page.getByRole("button", { name: /^All sources/ }).focus();
  await page.keyboard.press("Shift+Meta+KeyS");
  await until("⇧⌘S puts focus on the list", () => page.evaluate(() => document.activeElement?.classList.contains("list") === true));
  await page.keyboard.press("Shift+Meta+KeyS");
  await page.locator(".sidebar .side-item").first().waitFor();
});

journey("sidebar: the Skills header's New skill and toggle are enabled buttons, not dimmed by the drag handle", async (page) => {
  const plus = page.getByRole("button", { name: "New skill", exact: true });
  await plus.hover();
  // A click's checks, without the click: an aria-disabled ancestor makes it "not enabled".
  await plus.click({ trial: true, timeout: 2000 });
  const dimmed = await page.evaluate(() => [...document.querySelectorAll(".side-head")].filter((h) => h.closest("[aria-disabled=true]")).length);
  if (dimmed) throw new Error(`${dimmed} section header(s) read as disabled`);
});

journey("finish: a question on a source with no skill is pointed to Collected, not a skill page", async (page) => {
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill("# No skill yet\n\nA first source, filed under no skill, with one passage worth asking about.");
  await page.keyboard.press("Enter");
  await page.locator(".doc").getByText("A first source, filed under no skill").waitFor();
  await select(page, "one passage worth asking about");
  await page.getByRole("dialog", { name: "Highlight" }).locator(".intent.question").click();
  await page.locator(".mark-icon.question").first().waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  const made = page.locator(".quiz-made-list").filter({ hasText: "1 question" });
  await made.waitFor();
  if ((await made.innerText()).includes("skill page")) throw new Error(`“${await made.innerText()}”: this source has no skill page`);
  await page.getByRole("button", { name: "Keep reading" }).click();
});

journey("ore down at launch: Home's Try again brings back the skills and the sources too", async (page) => {
  const skillRows = page.locator(".side-item:not(.side-main)");
  await skillRows.first().waitFor();
  const skills = await skillRows.count();
  await page.addInitScript(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { ls: "The `ore` command isn’t installed.", skills: "The `ore` command isn’t installed.", today: "The `ore` command isn’t installed." }));
  await page.reload();
  const retry = page.locator(".home-today").getByRole("button", { name: "Try again" });
  await retry.waitFor();
  // Still down: each Try again says so again in the same toast, not one more each press.
  for (let n = 0; n < 3; n++) await retry.click();
  await page.waitForTimeout(300);
  const said = await page.locator(".toast").filter({ hasText: "isn’t installed" }).count();
  if (said > 1) throw new Error(`${said} toasts say the same failure`);
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
  await retry.click();
  await page.locator(".home-goal").waitFor();
  await until("the sidebar lists the skills again", async () => (await skillRows.count()) === skills);
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.locator(".row").filter({ hasText: TESTING }).first().waitFor();
});

journey("finish: drafting the cards starts on Done, not after the moment, so closing the window then still drafts them", async (page) => {
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill("# Drafting at once\n\nA short page whose cards are drafted the moment he says Done.");
  await page.keyboard.press("Enter");
  await page.locator(".doc").getByText("A short page whose cards are drafted").waitFor();
  const enriched: number[] = [];
  page.on("request", (r) => r.method() === "POST" && (r.postData() ?? "").includes('"args":["enrich"') && enriched.push(Date.now()));
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.locator(".quiz-done.moment").waitFor();
  await until("drafting has started while the moment shows", async () => enriched.length > 0, 900);
  if (await page.locator(".toast").filter({ hasText: "Finished “Drafting at once”" }).count()) throw new Error("drafting started only after the moment");
});

journey("finish: drafting that fails after Done stays in front of “Finished” until he acts on it", async (page) => {
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill("# Drafting that fails\n\nA short page whose cards can't be drafted, because the AI is down.");
  await page.keyboard.press("Enter");
  await page.locator(".doc").getByText("A short page whose cards").waitFor();
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { enrich: "Codex isn’t installed." }));
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.locator(".toast").filter({ hasText: "Finished “Drafting that fails”" }).waitFor();
  const failure = page.locator(".toast").filter({ hasText: "weren’t drafted: Codex isn’t installed." });
  await failure.waitFor();
  await page.waitForTimeout(300);
  const front = await page.locator(".toasts > .toast").last().innerText();
  if (!front.includes("weren’t drafted")) throw new Error(`the toast in front is “${front}”, not the drafting failure`);
  // Try again is the only way back to the cards, so the failure stays until he acts on it.
  if (!(await failure.getByRole("button", { name: "Dismiss" }).count())) throw new Error("the drafting failure goes away by itself");
  // A second source that fails too: one toast says both, and its Try again drafts both.
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill("# Drafting that fails again\n\nAnother short page whose cards can't be drafted either.");
  await page.keyboard.press("Enter");
  await page.locator(".doc").getByText("Another short page whose cards").waitFor();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  const both = page.locator(".toast").filter({ hasText: "Cards for 2 sources weren’t drafted: Codex isn’t installed." });
  await both.waitFor();
  await page.waitForTimeout(300);
  const failures = await page.locator(".toast").filter({ hasText: "weren’t drafted" }).count();
  if (failures !== 1) throw new Error(`${failures} drafting failures stacked`);
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
  const drafted: string[] = [];
  page.on("request", (r) => r.method() === "POST" && (r.postData() ?? "").includes('"args":["enrich"') && drafted.push(r.postData()!));
  await both.getByRole("button", { name: "Try again" }).click();
  await until("Try again drafts both", async () => drafted.length === 2);
});

journey("undo that fails: the toast says why, and ⌘Z tries the same step again", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  const row = page.locator(".row").filter({ hasText: AGENTS }).first();
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: /Archive/ }).click();
  await until("the row leaves the list", async () => !(await row.isVisible()));
  const fail = (why: string | null) => page.evaluate((why) => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = why ? { archive: why } : {}), why);
  await fail("The library is read-only.");
  await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
  await page.locator(".toast").filter({ hasText: "Couldn’t undo “Archived" }).filter({ hasText: "The library is read-only." }).waitFor();
  await until("the row stays archived", async () => !(await row.isVisible()));
  await fail(null);
  await page.locator(".list").click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press("Meta+z");
  await row.waitFor();
});

journey("settings: a Review setting goes on the history; ⌘Z takes it back, ⇧⌘Z gives it again", async (page) => {
  await page.keyboard.press("Meta+Comma");
  await page.getByRole("tab", { name: "Review" }).click();
  const minutes = page.getByRole("group", { name: "Minutes a day" }).or(page.getByRole("radiogroup", { name: "Minutes a day" }));
  const on = async () => (await minutes.locator("[data-state=on]").innerText()).trim();
  const was = await on();
  const other = was === "30" ? "5" : "30";
  await minutes.getByText(other, { exact: true }).click();
  await until("the new goal shows", async () => (await on()) === other);
  await page.waitForTimeout(300);
  await page.keyboard.press("Meta+z");
  await until("⌘Z puts the old goal back", async () => (await on()) === was);
  await page.keyboard.press("Shift+Meta+z");
  await until("⇧⌘Z gives the new one again", async () => (await on()) === other);
  await page.keyboard.press("Meta+z");
  await until("and back, for the journeys after this one", async () => (await on()) === was);
  await page.keyboard.press("Escape");
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

journey("quiz check that fails says why, as Review does, with try again", async (page) => {
  await openSource(page, TESTING);
  const why = "Codex isn’t installed (no `codex` on PATH). Install it, or pick Claude in Settings → AI.";
  await page.evaluate((why) => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { "key-points": why, check: why }), why);
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Skip to questions" }).click();
  await page.getByLabel("Your answer").fill("It feels familiar");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  const verdict = page.locator(".quiz-verdict").filter({ hasText: "Couldn’t check this one" });
  await verdict.waitFor();
  if (!(await verdict.innerText()).includes(why)) throw new Error(`no reason: “${await verdict.innerText()}”`);
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
  await verdict.getByRole("button", { name: "try again" }).click();
  await page.locator(".quiz-verdict").filter({ hasNotText: "Couldn’t check this one" }).waitFor();
  await page.getByRole("button", { name: "Close quiz" }).click();
});

// Last: its question highlight would change the lists the question journeys read.
journey("settle: closing a typed highlight lifts the popup away, pops its mark and glows once, then leaves nothing behind", async (page) => {
  await openSource(page, TESTING);
  const popup = page.getByRole("dialog", { name: "Highlight" });
  const left = () => page.evaluate(() => document.querySelectorAll(".popup.leaving, .settle-glow, .mark-icon.settle").length);
  await select(page, "Multiple-choice works too");
  await popup.waitFor();
  await popup.locator(".intent.question").click();
  await page.locator(".mark-icon.question").first().waitFor();
  await page.keyboard.press("Escape");
  const at = await page.evaluate(() => ({
    gone: !document.querySelector('[role="dialog"][aria-label="Highlight"]'),
    ghost: document.querySelector(".popup.leaving")?.getAttribute("aria-hidden"),
    glow: document.querySelectorAll(".settle-glow.question i").length,
  }));
  if (!at.gone || at.ghost !== "true" || !at.glow) throw new Error(`no settle: ${JSON.stringify(at)}`);
  await until("the mark pops", async () => (await page.locator(".mark-icon.settle").count()) === 1, 300);
  await until("nothing is left on the page", async () => (await left()) === 0, 1000);
  // Reduced motion: the popup just goes.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator(".mark-icon.question").first().click();
  await popup.waitFor();
  await page.keyboard.press("Escape");
  if (await left()) throw new Error("settle ran under reduced motion");
  await page.emulateMedia({ reducedMotion: null });
  await page.locator(".mark-icon.question").first().click();
  await popup.getByRole("button", { name: "Remove highlight" }).click();
  await page.waitForTimeout(500); // the write lands before the next journey reads the library
});

// Last: they add headings and a diagram to AGENTS' note, which earlier journeys lay out.
journey("tutor Practice: an answer under a renamed heading, and a diagram-only answer, both reach the tutor; an empty one is refused in place", async (page) => {
  await openSource(page, AGENTS);
  const exercise = (heading: string) => ({ heading, prompts: ["Your answer"] });
  const reply = (r: string, ex: ReturnType<typeof exercise> | null) => ({ reply: r, citations: [], general: false, hint: false, exercise: ex, card: null, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@4" } });
  const replies = [
    reply("Name the loop an agent runs.", exercise("What loop does an agent run?")),
    reply("Good. Now draw it.", exercise("Draw the agent loop")),
    reply("That diagram has the loop.", exercise("Draw the stopping condition")),
    reply("Fine.", null),
  ];
  const bodies: string[] = [];
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"tutor",')) return route.fallback();
    bodies.push(body);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(replies.shift()) });
  });
  await page.keyboard.press("Meta+j");
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  const fresh = tutor.getByRole("button", { name: "New chat" });
  if (await fresh.isEnabled()) await fresh.click();
  await tutor.getByRole("button", { name: "Practice", exact: true }).click();
  // A written answer under a heading he renamed.
  await tutor.getByRole("button", { name: "Write it in your note" }).click();
  await page.locator(".note-editor h2", { hasText: "What loop does an agent run?" }).waitFor();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press(process.platform === "darwin" ? "Meta+ArrowRight" : "End");
  await page.keyboard.type(" (my words)");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.type("It acts, observes the result and decides again.");
  await page.keyboard.press("Meta+Enter");
  await tutor.getByText("Good. Now draw it.").waitFor();
  if (!bodies[1]?.includes("It acts, observes the result and decides again.")) throw new Error(`the renamed heading's answer wasn't sent: ${bodies[1]}`);
  // An answer that is only a diagram.
  await tutor.getByRole("button", { name: "Write it in your note" }).click();
  await page.locator(".note-editor h2", { hasText: "Draw the agent loop" }).waitFor();
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData("text/plain", "![Diagram](diagrams/agent-loop.excalidraw)");
    const at = getSelection()!.anchorNode!;
    (at instanceof Element ? at : at.parentElement!).dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await until("the diagram is in the note", async () => (await page.locator(".note-editor .note-diagram").count()) > 0);
  await page.keyboard.press("Meta+Enter");
  await tutor.getByText("That diagram has the loop.").waitFor();
  if (!bodies[2]?.includes("diagrams/agent-loop.excalidraw")) throw new Error(`the diagram answer wasn't sent: ${bodies[2]}`);
  // Nothing written: he is told, nothing is sent, and he stays in the exercise, source still hidden.
  await tutor.getByRole("button", { name: "Write it in your note" }).click();
  await page.locator(".note-editor h2", { hasText: "Draw the stopping condition" }).waitFor();
  await page.keyboard.press("Meta+Enter");
  await page.getByText("Nothing written, so nothing was sent.").waitFor();
  await page.waitForTimeout(300);
  if (bodies.length !== 3) throw new Error(`an empty answer was sent: ${bodies.length}`);
  if (await tutor.count()) throw new Error("an empty answer left the exercise");
  await page.locator(".reader-pane.hidden-src").waitFor();
  await page.locator(".note-editor h2", { hasText: "Draw the stopping condition" }).waitFor();
  await page.keyboard.type("When the goal is met or a limit is hit.");
  await page.keyboard.press("Meta+Enter");
  await tutor.getByText("Fine.").waitFor();
  if (!bodies[3]?.includes("When the goal is met or a limit is hit.")) throw new Error(`the answer after an empty try wasn't sent: ${bodies[3]}`);
  await page.unroute(/\/ore$/);
  await page.keyboard.press("Meta+j");
});

journey("tutor Practice: Write it in your note puts the exercise in the source it was asked about, not the one open now", async (page) => {
  await openSource(page, AGENTS);
  const exercise = { heading: "When should an agent stop?", prompts: ["Your answer"] };
  const replies = [
    { reply: "Say when an agent should stop.", citations: [], general: false, hint: false, exercise, card: null },
    { reply: "Yes: when the goal is met or a limit is hit.", citations: [], general: false, hint: false, exercise: null, card: null },
  ].map((r) => ({ ...r, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@4" } }));
  const bodies: string[] = [];
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"tutor",')) return route.fallback();
    bodies.push(body);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(replies.shift()) });
  });
  await page.keyboard.press("Meta+j");
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  const fresh = tutor.getByRole("button", { name: "New chat" });
  if (await fresh.isEnabled()) await fresh.click();
  await tutor.getByRole("button", { name: "Practice", exact: true }).click();
  await tutor.getByRole("button", { name: "Write it in your note" }).waitFor();
  const item = /"--item=([^"]+)"/.exec(bodies[0] ?? "")?.[1];
  if (!item) throw new Error(`no source on the exercise: ${bodies[0]}`);
  await openSource(page, TESTING);
  await tutor.getByRole("button", { name: "Write it in your note" }).click();
  await page.locator(".doc-head").filter({ hasText: AGENTS }).waitFor(); // back on the exercise's source
  await page.locator(".note-editor h2", { hasText: exercise.heading }).waitFor();
  await page.keyboard.type("When the goal is met.");
  await page.keyboard.press("Meta+Enter");
  await tutor.getByText("Yes: when the goal is met or a limit is hit.").waitFor();
  if (!bodies[1]?.includes("When the goal is met.") || !bodies[1].includes(`"--item=${item}"`)) throw new Error(`the answer went with another source: ${bodies[1]}`);
  await page.unroute(/\/ore$/);
  await page.keyboard.press("Meta+j");
});

/** Explain on a phrase, from the highlight popup's Explain button. */
async function explain(page: Page, phrase: string) {
  await select(page, phrase);
  const popup = page.getByRole("dialog", { name: "Highlight" });
  await popup.waitFor();
  await popup.getByRole("button", { name: "Explain", exact: true }).click();
  await page.getByRole("dialog", { name: `Explain ${phrase}` }).waitFor();
}

// After the question journeys: Learn this makes its term a question. On words no other journey highlights.
journey("explain: ↵ on a focused Retry, Make card or Later does what clicking it does", async (page) => {
  await openSource(page, AGENTS);
  const learning = page.getByRole("dialog", { name: /^Learn / });
  await explain(page, "subtasks");
  const ex = page.getByRole("dialog", { name: "Explain subtasks" });
  // The mock has no AI to explain with: Retry asks again.
  await ex.getByRole("button", { name: "Retry" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  if (await learning.count()) throw new Error("↵ on Retry started Learn this");
  await ex.getByRole("button", { name: "Retry" }).waitFor();
  await ex.getByRole("button", { name: "Make card" }).focus();
  await page.keyboard.press("Enter");
  await ex.waitFor({ state: "detached" });
  if (await learning.count()) throw new Error("↵ on Make card started Learn this");
  await page.getByRole("dialog", { name: "Highlight" }).waitFor(); // the card's note, as clicking Make card opens it
  await page.keyboard.press("Escape");
  await explain(page, "Parallelisation");
  await page.getByRole("dialog", { name: "Explain Parallelisation" }).getByRole("button", { name: "Learn this" }).click();
  const learn = page.getByRole("dialog", { name: "Learn Parallelisation" });
  await learn.getByRole("button", { name: "Retry" }).waitFor(); // no AI to find sources: nothing to read now
  await learn.getByRole("button", { name: "Later" }).focus();
  await page.keyboard.press("Enter");
  await learn.waitFor({ state: "detached" });
});

journey("explain: a reworded question whose save fails is saved by the next ↵, unchanged", async (page) => {
  const ore = (args: string[]) => page.evaluate((args) => (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__.invoke("ore", { args }), args);
  const id = ((await ore(["ls"])) as { id: string; title: string }[]).find((i) => i.title === AGENTS)!.id;
  const notes = async () => ((await ore(["show", id])) as { annotations: { note?: string; status?: string }[] }).annotations.map((a) => a.note);
  await openSource(page, AGENTS);
  await explain(page, "synthesise");
  await page.getByRole("dialog", { name: "Explain synthesise" }).getByRole("button", { name: "Learn this" }).click();
  const learn = page.getByRole("dialog", { name: "Learn synthesise" });
  await learn.getByRole("button", { name: "Retry" }).waitFor(); // the question is saved
  const field = learn.getByLabel("Your question");
  const reworded = "How does a model synthesise results from workers?";
  await field.fill(reworded);
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { annotate: "The library is read-only." }));
  await field.press("Enter");
  await page.locator(".toast[role=alert]").filter({ hasText: "The library is read-only." }).waitFor();
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
  if ((await field.inputValue()) !== reworded) throw new Error("the failed rename lost his words");
  await until("the caret stays in the field, so Esc can't close over his words", () => field.evaluate((el) => el === document.activeElement));
  await field.press("Enter");
  await until("the next ↵ saves the same words", async () => (await notes()).includes(reworded));
  await learn.getByRole("button", { name: "Later" }).click();
  await learn.waitFor({ state: "detached" });
});

journey("finish quiz: ⌘⌫ while Check saves leaves his answer alone; a mark whose save fails goes back", async (page) => {
  await openSource(page, TESTING);
  const writes: string[] = [];
  let release = () => {};
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"prequestion",')) return route.fallback();
    writes.push(body);
    if (writes.length === 1) await new Promise<void>((ok) => (release = ok));
    await route.fallback();
  });
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Skip to questions" }).click();
  await page.getByLabel("Your answer").fill("It feels familiar");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await until("Check is saving", async () => writes.length === 1);
  for (let n = 0; n < 3; n++) await page.keyboard.press("Meta+Backspace");
  await page.waitForTimeout(300);
  release();
  const mark = page.locator(".quiz-mark[aria-pressed]").first();
  await mark.waitFor();
  if (writes.length !== 1 || !writes[0]!.includes("It feels familiar")) throw new Error(`his answer wasn't the one write: ${writes.join(" | ")}`);
  await page.unroute(/\/ore$/);
  // While a correction saves, the marks wait, so a second click isn't lost without sign.
  await page.evaluate(() => ((window as unknown as { __ORE_SLOW?: object }).__ORE_SLOW = { check: 800 }));
  await mark.click();
  await until("the marks wait while it saves", () => page.locator(".quiz-mark[aria-pressed]").last().isDisabled());
  await until("and come back once it is saved", async () => !(await mark.isDisabled()), 3000);
  await page.evaluate(() => ((window as unknown as { __ORE_SLOW?: object }).__ORE_SLOW = undefined));
  const was = await mark.getAttribute("aria-pressed");
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { check: "The library is read-only." }));
  await mark.click();
  await page.locator(".toast[role=alert]").filter({ hasText: "The library is read-only." }).waitFor();
  await until("the mark is back as saved", async () => (await mark.getAttribute("aria-pressed")) === was);
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
  await page.getByRole("button", { name: "Close quiz" }).click();
});

journey("finish quiz: while Check saves, his answer and how sure he is stay as saved, so the checked answer is what he sees", async (page) => {
  await openSource(page, TESTING);
  const writes: string[] = [];
  let release = () => {};
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"prequestion",')) return route.fallback();
    writes.push(body);
    if (writes.length === 1) await new Promise<void>((ok) => (release = ok));
    await route.fallback();
  });
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Skip to questions" }).click();
  const field = page.getByLabel("Your answer");
  await field.fill("It feels familiar");
  await page.getByRole("radio", { name: "Think so" }).click();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await until("Check is saving", async () => writes.length === 1);
  await field.focus();
  await page.keyboard.type(" and fluent");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("3");
  await page.getByRole("radio", { name: "Guess" }).click({ force: true });
  await page.waitForTimeout(200);
  const typed = await field.inputValue();
  const sure = await page.getByRole("radio", { name: "Think so" }).getAttribute("aria-checked");
  release();
  await page.locator(".quiz-yours").waitFor();
  await page.unroute(/\/ore$/);
  if (typed !== "It feels familiar") throw new Error(`typing went in while it saved: “${typed}”`);
  if (sure !== "true") throw new Error("how sure he was changed while it saved");
  if ((await page.locator(".quiz-yours").innerText()) !== "It feels familiar" || !writes[0]!.includes("--confidence=2")) throw new Error(`saved: ${writes[0]}`);
  await page.getByRole("button", { name: "Close quiz" }).click();
});

journey("how sure: one Tab stop in Review and the finish quiz, ← → move between the three, Space picks", async (page) => {
  const focused = () => page.evaluate(() => ({ role: document.activeElement?.getAttribute("role"), name: (document.activeElement as HTMLElement | null)?.innerText.trim() }));
  const walk = async (field: ReturnType<Page["getByRole"]>) => {
    await field.fill("an answer");
    await field.focus();
    await page.keyboard.press("Tab");
    if ((await focused()).role !== "radio") throw new Error(`Tab from the answer went to ${JSON.stringify(await focused())}`);
    // Radix moves focus a tick after the key.
    await page.keyboard.press("ArrowRight");
    await until("→ moves to Think so", async () => (await focused()).name === "Think so", 2000);
    await page.keyboard.press("ArrowRight");
    await until("→ moves to Sure", async () => (await focused()).name === "Sure", 2000);
    await page.keyboard.press("Space");
    await until("Sure is picked", async () => (await page.getByRole("radio", { name: "Sure" }).getAttribute("aria-checked")) === "true");
    await page.keyboard.press("Tab");
    if ((await focused()).role === "radio") throw new Error("Tab stopped on another of the three");
    // Back into the row, focus lands on the one he picked, by key or by click.
    await page.keyboard.press("Shift+Tab");
    await until("⇧Tab lands on Sure", async () => (await focused()).name === "Sure", 2000);
    await page.getByRole("radio", { name: "Guess" }).click();
    await until("Guess is picked", async () => (await page.getByRole("radio", { name: "Guess" }).getAttribute("aria-checked")) === "true");
    await field.focus();
    await page.keyboard.press("Tab");
    await until("Tab lands on Guess", async () => (await focused()).name === "Guess", 2000);
    await page.getByRole("radio", { name: "Think so" }).click();
    await field.focus();
    await page.keyboard.press("Tab");
    await until("Tab lands on Think so, the one picked", async () => (await focused()).name === "Think so", 2000);
  };
  await startReview(page, /Teaching/);
  await walk(page.getByRole("textbox", { name: "Your answer" }));
  await page.getByRole("textbox", { name: "Your answer" }).fill("");
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
  await openSource(page, TESTING);
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Skip to questions" }).click();
  await walk(page.getByLabel("Your answer"));
  await page.getByRole("button", { name: "Close quiz" }).click();
});

journey("review that can't start because ore failed offers Try again, focused, which starts it", async (page) => {
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { due: "The `ore` command isn’t answering." }));
  await page.getByRole("button", { name: "Start review" }).click();
  await page.getByRole("dialog", { name: "What to review" }).waitFor();
  await page.keyboard.press("Enter");
  await page.locator(".review .err").filter({ hasText: "isn’t answering" }).waitFor();
  const retry = page.locator(".review").getByRole("button", { name: "Try again" });
  await until("Try again is focused", () => retry.evaluate((el) => el === document.activeElement));
  // Only `due` failed: the session that started stays the one, with no second one left open.
  const starts: string[] = [];
  page.on("request", (r) => r.method() === "POST" && (r.postData() ?? "").includes('"args":["session","start"]') && starts.push(r.url()));
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
  await page.keyboard.press("Enter");
  await page.locator(".review-q").waitFor();
  if (starts.length) throw new Error(`Try again started ${starts.length} more session(s)`);
  await page.keyboard.press("Escape");
});

journey("review: a card that fails to load offers Try again, focused, which loads it without losing the rating before it; Undo clears the error", async (page) => {
  const q = page.locator(".review-q");
  const session = page.locator(".review [role=progressbar]").first();
  // Every load of a card other than the first one shown fails: the next card loads while he answers
  // this one, and again when it is due if that failed (and twice under React's dev StrictMode).
  let firstId: string | undefined;
  const failNext = async () => {
    await page.route(/\/ore$/, async (route) => {
      const { args } = JSON.parse(route.request().postData() ?? "{}") as { args?: string[] };
      if (args?.[0] !== "card" || args[1] !== "show" || args[3] !== "--review" || (firstId ??= args[2]) === args[2]) return route.fallback();
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify("Couldn’t read the card.") });
    });
  };
  const error = page.getByText("Couldn’t read the card.");
  const retry = page.getByRole("button", { name: "Try again" });
  // Enter on Undo takes the rating back (it is Undo's Enter, not Try again's): its card loads, and the
  // error goes with the card it was about.
  await failNext();
  await startReview(page, null);
  const first = await q.innerText();
  await reveal(page);
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await error.waitFor();
  await page.unroute(/\/ore$/);
  // The first card loads again on Undo; the next one, loaded ahead, fails again.
  await failNext();
  await page.getByRole("button", { name: "Undo last rating" }).focus();
  await page.keyboard.press("Enter");
  await until("Undo puts the first card back", async () => (await q.isVisible()) && (await q.innerText()) === first);
  if (await error.count()) throw new Error("the load error stayed on the card Undo brought back");
  // Try again takes the focus, and Enter loads the card.
  await reveal(page);
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await error.waitFor();
  await page.unroute(/\/ore$/);
  await until("Try again has the focus", () => retry.evaluate((b) => b === document.activeElement));
  await page.keyboard.press("Enter");
  await until("the next card shows", async () => (await q.isVisible()) && (await q.innerText()) !== first);
  if ((await session.getAttribute("aria-valuenow")) !== "1") throw new Error("the rating before it was lost");
  // Undo still takes that rating back (and leaves the card due for the journeys after this one).
  await page.getByRole("button", { name: "Undo last rating" }).click();
  await until("Undo puts the first card back", async () => (await q.isVisible()) && (await q.innerText()) === first);
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review: changing an Explain card's key points after it was checked keeps the marks of points left as they were, but suggests nothing until he marks; an undo refreshes an untouched open editor only", async (page) => {
  await page.route(/\/ore$/, async (route) => {
    if (!(route.request().postData() ?? "").includes('"grade",')) return route.fallback();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ rating: 3, gaps: [], feedback: "", covered: [true, true] }) });
  });
  await startReview(page, /Teaching/);
  await page.getByRole("textbox", { name: "Your answer" }).fill("Fluency feels like knowing, so you overrate yourself");
  await page.getByRole("radio", { name: "Think so" }).click();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  const points = page.locator(".quiz-points");
  const suggested = page.locator(".review-rate .suggested");
  await until("the AI marked both points", async () => (await points.locator("li.got").count()) === 2);
  await suggested.waitFor();
  await page.getByRole("button", { name: "Edit card" }).click();
  const field = page.getByRole("textbox", { name: "Key points" });
  const was = await field.inputValue();
  const [kept, changed] = was.split("\n") as [string, string];
  const save = async (text: string, shows: string) => {
    if (!(await field.isVisible())) await page.getByRole("button", { name: "Edit card" }).click();
    await field.fill(text);
    await page.getByRole("button", { name: "Save" }).click();
    await points.locator("li").first().filter({ hasText: shows }).waitFor();
  };
  // Only reordered: both marks stay, but they were the AI's, so nothing is suggested until he marks.
  await save(`${changed}\n${kept}`, changed);
  await page.unroute(/\/ore$/);
  await page.getByText("The key points changed.").waitFor();
  if ((await points.locator("li.got").count()) !== 2) throw new Error("a reorder lost a mark");
  if (await suggested.count()) throw new Error("the AI's marks still suggest a rating after the points changed");
  // A changed point loses its mark; one left as it was keeps it.
  await save(`Says when rereading does help\n${kept}`, "Says when rereading does help");
  const got = await points.locator("li.got").allInnerTexts();
  if (got.length !== 1 || got[0] !== kept) throw new Error(`marked got: ${got.join(" | ")}`);
  if (await points.locator("li.missed").count()) throw new Error("a changed point kept a mark");
  if (await suggested.count()) throw new Error("a rating is suggested before he marks");
  // Marking the new point gives a suggestion again, from his marks.
  await points.locator("li", { hasText: "Says when rereading does help" }).locator(".quiz-mark").click();
  await suggested.waitFor();
  // ⌘Z lands while the editor is open and untouched: it shows the points as they are now.
  await page.getByRole("button", { name: "Edit card" }).click();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Meta+z");
  await until("the open editor has the points back", async () => (await field.inputValue()) === `${changed}\n${kept}`);
  // ⇧⌘Z lands after he typed in the editor: his typing stays.
  await field.fill("His own wording");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const id = ((await ore("due")) as { id: string; question: string }[]).find((e) => e.question.startsWith("Explain why rereading"))!.id;
  await page.keyboard.press("Shift+Meta+z");
  await until("⇧⌘Z saved the new points again", async () => ((await ore("card", "show", id)) as { rubric: string[] }).rubric[0] === "Says when rereading does help");
  await page.waitForTimeout(200);
  if ((await field.inputValue()) !== "His own wording") throw new Error("an undo threw away what he typed in the editor");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review: hovering or focusing a key point he got underlines the words of his answer that earned it; a missed one, or one he marks missed, underlines nothing (D141)", async (page) => {
  await page.route(/\/ore$/, async (route) => {
    if (!(route.request().postData() ?? "").includes('"grade",')) return route.fallback();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ rating: 2, gaps: [], feedback: "", covered: [true, false], evidence: ["feels like knowing", ""] }) });
  });
  await startReview(page, /Teaching/);
  await page.getByRole("textbox", { name: "Your answer" }).fill("Fluency feels like knowing, so you overrate yourself");
  await page.getByRole("radio", { name: "Think so" }).click();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  const points = page.locator(".quiz-points li");
  const mark = page.locator(".quiz-yours .quiz-evidence");
  await until("the AI marked the first point", async () => (await page.locator(".quiz-points li.got").count()) === 1);
  await page.unroute(/\/ore$/);
  if (await mark.count()) throw new Error("words are underlined before he points at a key point");
  await points.nth(0).hover();
  await until("the first point's words are underlined", async () => (await mark.count()) === 1 && (await mark.innerText()) === "feels like knowing");
  await points.nth(1).hover();
  await until("a missed point underlines nothing", async () => (await mark.count()) === 0);
  // The keyboard reaches it too: focus on the point's mark shows its words, and VoiceOver hears them.
  await page.mouse.move(0, 0);
  await points.nth(0).locator(".quiz-mark").focus();
  await until("focus underlines the words", async () => (await mark.count()) === 1);
  const label = await points.nth(0).locator(".quiz-mark").getAttribute("aria-label");
  if (!label?.includes("from “feels like knowing”")) throw new Error(`the mark's label doesn't say his words: ${label}`);
  // Marked missed, the point no longer claims his words.
  await page.keyboard.press("Enter");
  await until("a point he marks missed underlines nothing", async () => (await mark.count()) === 0);
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review: while a card edit saves, the editor is read-only and Esc waits, so the saved words are the ones shown", async (page) => {
  await startReview(page, /Teaching/);
  await reveal(page);
  let release = () => {};
  let held = false;
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (!body.includes('"set",') || held) return route.fallback();
    held = true;
    await new Promise<void>((ok) => (release = ok));
    await route.fallback();
  });
  await page.getByRole("button", { name: "Edit card" }).click();
  const question = page.locator("#edit-q");
  const was = await question.inputValue();
  await question.fill(`${was} (edited)`);
  await page.getByRole("button", { name: "Save" }).click();
  await until("the save is held", async () => held);
  await question.focus();
  await page.keyboard.press("End");
  await page.keyboard.type(" and more");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const typed = await question.inputValue();
  const open = await question.isVisible();
  release();
  await page.unroute(/\/ore$/);
  if (typed !== `${was} (edited)`) throw new Error(`typing went in while it saved: “${typed}”`);
  if (!open) throw new Error("Esc closed the editor while it saved");
  await until("the saved question shows", async () => (await page.locator(".review-q").isVisible()) && (await page.locator(".review-q").innerText()) === `${was} (edited)`);
  await page.locator(".review").focus();
  await page.keyboard.press("Meta+z");
  await until("⌘Z puts the question back", async () => (await page.locator(".review-q").innerText()) === was);
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review Ask: a failed question offers Try again, which asks it again and keeps a follow-up he has typed since", async (page) => {
  const asked: string[] = [];
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"ask",')) return route.fallback();
    asked.push((JSON.parse(body) as { args: string[] }).args.find((a) => a.startsWith("--message="))!);
    if (asked.length === 1) return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify("The AI is offline.") });
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: "Because recalling it is the practice.", proposal: null, session: "s1" }) });
  });
  await startReview(page, null);
  await reveal(page);
  await page.getByRole("button", { name: "Ask about this" }).click();
  const box = page.getByRole("textbox", { name: "Ask about this card" });
  await box.fill("Why does this work?");
  await page.keyboard.press("Enter");
  await page.locator(".ask").getByText("The AI is offline.", { exact: false }).waitFor();
  await box.fill("And for kids?");
  await page.locator(".ask").getByRole("button", { name: "Try again" }).dblclick();
  await page.locator(".ask").getByText("Because recalling it is the practice.").waitFor();
  await page.unroute(/\/ore$/);
  if (asked.join(" | ") !== "--message=Why does this work? | --message=Why does this work?") throw new Error(`asked: ${asked.join(" | ")}`);
  if ((await box.inputValue()) !== "And for kids?") throw new Error("Try again cleared the follow-up");
  if ((await page.locator(".ask-me").count()) !== 1) throw new Error("Try again put the question in the thread twice");
  await page.waitForTimeout(300);
  if (asked.length !== 2) throw new Error(`a double click on Try again asked ${asked.length - 1} times`);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("typing with an input method: Enter that picks a word neither sends an answer nor ends a diagram label", async (page) => {
  const composingEnter = (el: Element) => el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", isComposing: true, bubbles: true, cancelable: true }));
  // WKWebView's commit Enter: keyCode 229, isComposing false.
  const imeEnter = (el: Element) => {
    const e = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true });
    Object.defineProperty(e, "keyCode", { get: () => 229 });
    el.dispatchEvent(e);
  };
  // A question of its own, so nothing that ran before changes what it finds.
  await openSource(page, TESTING);
  await page.getByRole("tab", { name: "Collected" }).click();
  const head = page.locator(".cp-head", { hasText: "Questions" });
  const toggle = head.locator(".cp-toggle");
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  const ask = "Does this work in kana?";
  await head.getByRole("button", { name: "Ask a question" }).click();
  const fresh = page.getByLabel("New question");
  await fresh.fill(ask);
  await fresh.evaluate(composingEnter);
  await fresh.evaluate(imeEnter);
  await page.waitForTimeout(300);
  if ((await page.locator(".qp-line", { hasText: ask }).count()) || !(await fresh.isVisible())) throw new Error("a composing Enter added the question");
  await page.keyboard.press("Enter");
  const line = page.locator(".qp-line", { hasText: ask });
  await line.waitFor();
  await line.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Answer…" }).click();
  const box = page.getByLabel(`Your answer to ${ask}`);
  await box.fill("たぶん");
  await box.evaluate(composingEnter);
  await box.evaluate(imeEnter);
  await page.waitForTimeout(300);
  if ((await box.inputValue()) !== "たぶん" || (await page.getByRole("button", { name: "Edit: たぶん" }).count())) throw new Error("a composing Enter sent the answer");
  await box.fill("");
  await page.keyboard.press("Escape");
  // A source of its own to draw in, so its note is empty.
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill("# Words in other scripts\n\nA short page to draw beside.");
  await page.keyboard.press("Enter");
  await page.locator(".doc").getByText("A short page to draw beside.").waitFor();
  if (!(await page.locator(".mynotes").count())) await page.keyboard.press("n");
  await page.getByRole("tab", { name: "Source note" }).click();
  const note = page.locator(".note-editor [contenteditable=true]").first();
  await until("the note takes the caret", async () => (await note.click(), await note.evaluate((e) => e.contains(document.activeElement))));
  await page.keyboard.press("Meta+ArrowDown");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/diagram");
  await page.locator(".note-menu-row.on").filter({ hasText: "Diagram" }).waitFor();
  await page.keyboard.press("Enter");
  const draw = page.locator(".diagram .draw");
  await draw.focus();
  const c = (await page.locator(".diagram .draw-canvas").boundingBox())!;
  await page.keyboard.press("r");
  await page.mouse.click(c.x + 150, c.y + 150);
  const label = page.locator(".draw-text");
  await label.waitFor();
  await page.keyboard.type("記憶");
  await label.evaluate(composingEnter);
  await label.evaluate(imeEnter);
  await page.waitForTimeout(300);
  if (!(await label.isVisible())) throw new Error("a composing Enter ended the label");
  await page.keyboard.press("Enter");
  await label.waitFor({ state: "detached" });
});

journey("list archive: A selects the row after the archived one, so a second A archives that row; ⌘Z brings each back", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  const titles = () => page.locator(".list .row .title").allInnerTexts();
  const selected = () => page.locator(".list .row[aria-selected=true] .title").innerText();
  await until("To read lists three sources", async () => (await titles()).length >= 3);
  const before = await titles();
  await page.locator(".list").focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  if ((await selected()) !== before[1]) throw new Error(`↓↓ selected “${await selected()}”, not the second row`);
  // Finder, Mail and Linear: the row after the one that went takes the selection.
  await page.keyboard.press("a");
  await until(`“${before[2]}” is selected after the archive`, async () => (await selected()) === before[2]);
  await page.keyboard.press("a");
  await until("the second A archives the row after", async () => !(await titles()).includes(before[2]!));
  const after = await titles();
  if (!after.includes(before[0]!)) throw new Error(`the second A archived “${before[0]}”, which he never picked`);
  await page.waitForTimeout(500);
  await page.keyboard.press("Meta+z");
  await page.keyboard.press("Meta+z");
  await until("⌘Z ⌘Z bring both back", async () => (await titles()).length === before.length);
  for (const t of before) if (!(await titles()).includes(t)) throw new Error(`“${t}” did not come back`);
});

journey("list archive Undo selects the source it put back, as Finder does, though the row was never selected", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  const titles = () => page.locator(".list .row .title").allInnerTexts();
  const selected = () => page.locator(".list .row[aria-selected=true] .title").innerText();
  await until("All sources lists three sources", async () => (await titles()).length >= 3);
  const before = await titles();
  // Nothing picked: the first row stands for the selection. Archive the third from its menu.
  const row = page.locator(".list .row").filter({ has: page.locator(".title", { hasText: before[2]! }) }).first();
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: /Archive/ }).click();
  await until("the row leaves the list", async () => !(await titles()).includes(before[2]!));
  await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
  await until("Undo brings it back", async () => (await titles()).includes(before[2]!));
  // The first ↓ shows the selection where it is.
  await page.locator(".list").focus();
  await page.keyboard.press("ArrowDown");
  await until(`“${before[2]}” is selected, not “${before[0]}”`, async () => (await selected()) === before[2]);
  await until("the library has it back", async () => ((await ore("ls")) as { title: string }[]).some((i) => i.title === before[2]));
});

journey("Done: Move to To read and ⌘Z puts the source back in Done with the finish date it had", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.keyboard.press("Meta+2");
  const row = page.locator(".list .row").first();
  const title = await row.locator(".title").innerText();
  const finished = async () => ((await ore("ls")) as { title: string; status: string; finished_at?: string }[]).find((i) => i.title === title);
  const was = await finished();
  if (was?.status !== "done" || !was.finished_at) throw new Error(`“${title}” is not done with a finish date`);
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Move to To read" }).click();
  await until("it left Done", async () => (await finished())?.status === "reading");
  await page.keyboard.press("Meta+z");
  await until("⌘Z puts it back in Done", async () => (await finished())?.status === "done");
  const now = await finished();
  if (now?.finished_at !== was.finished_at) throw new Error(`finish date ${was.finished_at} became ${now?.finished_at}`);
});

journey("list: back from a source opened low in To read, its row is selected and in view, though opening moved it up", async (page) => {
  await page.setViewportSize({ width: 1280, height: 220 });
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.locator(".list .row").nth(2).waitFor();
  await page.locator(".list").focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowDown");
  const title = await page.locator(".list .row[aria-selected=true] .title").innerText();
  await page.keyboard.press("Enter");
  await page.locator(".doc-head").filter({ hasText: title }).waitFor();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  const row = page.locator(".list .row[aria-selected=true]");
  await until(`“${title}” is selected again`, async () => (await row.locator(".title").innerText()) === title);
  await page.waitForTimeout(300);
  const seen = await row.evaluate((r) => {
    const a = r.getBoundingClientRect(), b = r.closest(".list")!.getBoundingClientRect();
    return a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
  });
  if (!seen) throw new Error(`the selected row “${title}” is scrolled out of the list`);
});

journey("skill picker: a skill with a long name still shows its tick", async (page) => {
  const long = "Quantum error correction for people who never took physics and want to read the papers anyway, slowly";
  const k = (await ore("skills", "add", long)) as { id: string };
  const item = ((await ore("ls")) as { id: string; title: string; skills: string[] }[]).find((i) => i.title === TESTING)!;
  await ore("edit", item.id, "--skills", [...item.skills, k.id].join(","));
  try {
    await page.reload();
    await page.getByRole("button", { name: /^All sources/ }).click();
    await page.getByRole("button", { name: `Skills for ${TESTING}` }).click();
    const tick = page.locator(".skill-picker").getByRole("option").filter({ has: page.locator(".menu-label", { hasText: long }) }).locator("svg.check");
    const w = (await tick.boundingBox())?.width ?? 0;
    if (w < 10) throw new Error(`the long skill's tick is ${w}px wide`);
    await page.keyboard.press("Escape");
  } finally {
    await ore("skills", "rm", k.id);
  }
});

journey("reader toolbar at a narrow window: it never covers the sidebar toggle or Back, and what it holds stays on screen", async (page) => {
  await openSource(page, TESTING);
  await page.locator(".reader-tools .collected").waitFor();
  for (const width of [700, 800, 1280]) {
    await page.setViewportSize({ width, height: 700 });
    await page.waitForTimeout(200);
    const clash = await page.evaluate(() => {
      const tools = document.querySelector(".reader-tools")!.getBoundingClientRect();
      for (const sel of [".side-toggle", ".nav-arrows button"]) {
        const r = document.querySelector(sel)!.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!hit?.closest(sel)) return `${sel} is covered by ${hit?.className}`;
      }
      return tools.left < 0 ? `the toolbar starts at x=${tools.left}` : null;
    });
    if (clash) throw new Error(`at ${width}px: ${clash}`);
  }
});

journey("⌘K: the skill named what he typed is the top row, above a source that starts with it; accents and emoji find titles", async (page) => {
  const add = (text: string) =>
    fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich"], stdin: text }) }).then((r) => r.json()) as Promise<{ id: string }>;
  const made = [await add("# Teaching kids to read\n\nPhonics first, then whole words."), await add("# Résumé café 🔥\n\nA title with accents and an emoji.")];
  try {
    await page.reload();
    await page.locator(".side-item").first().waitFor();
    const top = async (query: string) => {
      await page.keyboard.press("Meta+k");
      await page.locator("[cmdk-input]").fill(query);
      await page.waitForTimeout(400);
      const row = (await page.locator("[cmdk-item][data-selected=true]").innerText()).trim();
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      return row;
    };
    if ((await top("teaching")) !== "Teaching") throw new Error(`“teaching” selects “${await top("teaching")}”, not the skill`);
    for (const q of ["cafe", "resume", "🔥"]) if (!(await top(q)).includes("Résumé café 🔥")) throw new Error(`“${q}” selects “${await top(q)}”`);
  } finally {
    for (const m of made) await ore("archive", m.id);
  }
});

journey("long skill names: a row's chips each end in an ellipsis inside the row, and the reader's wrap, so nothing scrolls sideways", async (page) => {
  const names = ["Quantum chromodynamics and the strong force, from first principles", "Storytelling for engineers who write design docs nobody reads"];
  const made = [] as { id: string }[];
  for (const n of names) made.push((await ore("skills", "add", n)) as { id: string });
  const item = ((await ore("ls")) as { id: string; title: string; skills: string[] }[]).find((i) => i.title === TESTING)!;
  await ore("edit", item.id, "--skills", [...made.map((k) => k.id), ...item.skills].join(","));
  try {
    await page.setViewportSize({ width: 720, height: 700 });
    await page.reload();
    await page.getByRole("button", { name: /^All sources/ }).click();
    const row = page.locator(".list .row").filter({ hasText: TESTING }).first();
    await row.locator(".chip").first().waitFor();
    const cut = await row.evaluate((r) => {
      const box = r.querySelector(".chips-button")!.getBoundingClientRect();
      return [...r.querySelectorAll(".chips-button .chip")].filter((c) => c.getBoundingClientRect().right > box.right + 0.5).length;
    });
    if (cut) throw new Error(`${cut} chip(s) sliced at the row's edge`);
    await row.locator(".title").click();
    await page.locator(".doc-head").filter({ hasText: TESTING }).waitFor();
    await page.waitForTimeout(300);
    const wide = await page.locator(".reader-scroll").evaluate((s) => s.scrollWidth - s.clientWidth);
    if (wide > 0) throw new Error(`the reader scrolls ${wide}px sideways`);
  } finally {
    for (const k of made) await ore("skills", "rm", k.id);
  }
});

journey("toast: a long title is clipped to two lines, not a wall of text over the list", async (page) => {
  const title = `The surprisingly long history ${"of a very long title that keeps going ".repeat(12).trim()}`;
  const made = (await fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich"], stdin: `# ${title}\n\nA body.` }) }).then((r) => r.json())) as { id: string };
  try {
    await page.reload();
    await page.getByRole("button", { name: /^All sources/ }).click();
    const row = page.locator(".list .row").filter({ hasText: "The surprisingly long history" }).first();
    await row.click({ button: "right" });
    await page.getByRole("menuitem", { name: /^Archive/ }).click();
    const toast = page.locator(".toast").filter({ hasText: "Archived" });
    await toast.waitFor();
    const lines = await toast.locator(".toast-msg").evaluate((m) => Math.round(m.getBoundingClientRect().height / parseFloat(getComputedStyle(m).lineHeight)));
    if (lines > 2) throw new Error(`the toast is ${lines} lines tall`);
    await page.keyboard.press("Meta+z");
    await until("⌘Z brings it back", async () => (await row.count()) === 1);
  } finally {
    await ore("archive", made.id);
  }
});

journey("sidebar: scrolled to the end, its rows stop under the title bar, never behind the toggle and Back", async (page) => {
  await page.setViewportSize({ width: 1280, height: 260 });
  const side = page.locator(".sidebar");
  await side.locator(".side-item", { hasText: "Habits" }).waitFor({ state: "attached" });
  // The strip left of the sidebar toggle, under the title bar: what it shows at the top of the list is
  // the plain sidebar, and scrolled to the end it must show the same, with no row showing through.
  const strip = { x: 8, y: 2, width: 64, height: 30 };
  await side.evaluate((s) => (s.scrollTop = 0));
  const clear = await page.screenshot({ clip: strip });
  if (!(await side.evaluate((s) => ((s.scrollTop = s.scrollHeight), s.scrollTop > 0)))) throw new Error("the sidebar didn't scroll at this height");
  await page.waitForTimeout(100);
  if (!clear.equals(await page.screenshot({ clip: strip }))) throw new Error("sidebar rows show under the title bar");
});

journey("prequestions: a source added with --no-enrich offers to write them, never a wait on nothing", async (page) => {
  const made = (await fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich"], stdin: "# Added by an agent\n\nNo enrich is on its way for this one." }) }).then((r) => r.json())) as { id: string };
  try {
    await page.reload();
    await openSource(page, "Added by an agent");
    await page.locator(".preq-head").filter({ hasText: "No prequestions yet" }).waitFor();
    await page.getByRole("button", { name: "Write them" }).waitFor();
    if (await page.getByText("Writing prequestions…").count()) throw new Error("it waits on an enrich nothing started");
  } finally {
    await ore("archive", made.id);
  }
});

journey("stacked Undo: each ⌘Z's toast comes to the front and names the source it put back", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  const titles = () => page.locator(".list .row .title").allInnerTexts();
  await until("All sources lists three sources", async () => (await titles()).length >= 3);
  const before = await titles();
  await page.locator(".list").focus();
  await page.keyboard.press("ArrowDown");
  for (const t of before.slice(0, 3)) {
    await page.keyboard.press("a");
    await until(`“${t}” is archived`, async () => !(await titles()).includes(t));
  }
  const front = () => page.locator(".toasts .toast").last().locator(".toast-msg").innerText();
  await page.keyboard.press("Meta+z");
  await until("the first ⌘Z names the last one archived", async () => (await front()) === `Undone: Archived “${before[2]}”`);
  await page.keyboard.press("Meta+z");
  await until("the second ⌘Z's toast is in front, naming the one it put back", async () => (await front()) === `Undone: Archived “${before[1]}”`);
  await page.keyboard.press("Meta+z");
  await until("all three are back", async () => (await titles()).length === before.length);
});

journey("delete skill: with nothing to decide it deletes at once, and ⌘Z puts it back (no Are you sure)", async (page) => {
  const k = (await ore("skills", "add", "Knot tying")) as { id: string };
  try {
    await page.reload();
    await page.locator(".sidebar .side-item", { hasText: "Knot tying" }).first().click({ button: "right" });
    await page.getByRole("menuitem", { name: /^Delete skill/ }).click();
    await page.locator(".toast-msg", { hasText: "Deleted Knot tying" }).waitFor();
    if (await page.getByRole("alertdialog").count()) throw new Error("a dialog asked first, though Undo can take it back");
    await until("the skill leaves the sidebar", async () => (await page.locator(".sidebar .side-item", { hasText: "Knot tying" }).count()) === 0);
    await page.keyboard.press("Meta+z");
    await page.locator(".sidebar .side-item", { hasText: "Knot tying" }).first().waitFor();
  } finally {
    await ore("skills", "rm", k.id).catch(() => {});
  }
});

journey("delete skill: the dialog counts its archived sources too, since the delete takes the skill off them", async (page) => {
  const k = (await ore("skills", "add", "Woodworking")) as { id: string };
  const add = (text: string) =>
    fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich", "--skill", k.id], stdin: text }) }).then((r) => r.json()) as Promise<{ id: string }>;
  const live = await add("# Dovetails by hand\n\nSaw to the line.");
  const gone = await add("# Old plane notes\n\nSharpen first.");
  await ore("archive", gone.id);
  try {
    await page.reload();
    await page.locator(".sidebar .side-item", { hasText: "Woodworking" }).first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "Delete skill…" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Delete Woodworking" });
    await dialog.getByText("Its 1 source (and 1 archived)").waitFor();
    await page.keyboard.press("Escape");
  } finally {
    await ore("skills", "rm", k.id);
    for (const s of [live, gone]) await ore("archive", s.id);
  }
});

journey("list: an archive whose save hangs never freezes the list; a read started after it still lands", async (page) => {
  type W = { __ORE_SLOW?: Record<string, number> };
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.evaluate(() => void ((window as unknown as W).__ORE_SLOW = { archive: 20000 }));
  const row = page.locator(".list .row").filter({ hasText: AGENTS }).first();
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: /^Archive/ }).click();
  await until("the row leaves at once", async () => !(await row.isVisible()));
  // Added outside the app while the archive's answer hangs: opening a source reads the list again.
  const made = (await fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich"], stdin: "# Added while a save hangs\n\nThe list still reads." }) }).then((r) => r.json())) as { id: string };
  try {
    await page.locator(".list .row .title").filter({ hasText: TESTING }).first().click();
    await page.locator(".doc-head").filter({ hasText: TESTING }).waitFor();
    await page.waitForTimeout(1200);
    await page.keyboard.press("Escape");
    await page.locator(".list .row").filter({ hasText: "Added while a save hangs" }).first().waitFor({ timeout: 4000 });
    if (await row.isVisible()) throw new Error("the archived row came back while its save hung");
  } finally {
    await page.evaluate(() => void ((window as unknown as W).__ORE_SLOW = {}));
    await ore("archive", made.id);
    await ore("archive", ((await ore("ls", "--archived")) as { id: string; title: string }[]).find((i) => i.title === AGENTS)!.id, "--undo");
  }
});

journey("reader toolbar: Collected goes back to a chip per type when a type goes and they fit again", async (page) => {
  const title = "Four kinds of highlight";
  const lines = ["Spacing beats massing for long-term retention.", "Retrieval changes the memory it retrieves.", "Why does a delay make recall stronger?", "Quiz yourself before rereading tomorrow."];
  const made = (await fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich"], stdin: `# ${title}\n\n${lines.join(" ")}` }) }).then((r) => r.json())) as { id: string };
  const kinds = ["keep", "card", "question"];
  for (const [i, k] of kinds.entries()) await ore("highlight", made.id, "--exact", lines[i]!, "--intent", k);
  const one = () => page.locator(".reader-tools .collected-chip.all").count().then((n) => n > 0);
  try {
    await page.reload();
    await page.getByRole("button", { name: /^All sources/ }).click();
    await page.locator(".list .row .title").filter({ hasText: title }).first().click();
    await page.locator(".reader-tools .collected-chip.question").waitFor();
    // The narrowest window where a chip per type still fits, three types in.
    let width = 1280;
    for (; width > 720; width -= 8) {
      await page.setViewportSize({ width: width - 8, height: 700 });
      await page.waitForTimeout(80);
      if (await one()) break;
    }
    await page.setViewportSize({ width, height: 700 });
    await until("three chips at that width", async () => !(await one()));
    await ore("highlight", made.id, "--exact", lines[3]!, "--intent", "apply");
    await page.reload();
    await page.getByRole("button", { name: /^All sources/ }).click();
    await page.locator(".list .row .title").filter({ hasText: title }).first().click();
    await until("four types don't fit: one chip", one);
    await page.getByRole("tab", { name: "Collected" }).click();
    const toggle = page.locator(".cp-head.apply .cp-toggle");
    if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
    await page.locator(".cp-head.apply ~ .cp-line").filter({ hasText: "Quiz yourself before rereading" }).first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "Type" }).hover();
    await page.getByRole("menuitemcheckbox", { name: "Highlight" }).dispatchEvent("click");
    await until("three types fit again: a chip per type", async () => !(await one()) && (await page.locator(".reader-tools .collected-chip.keep").count()) === 1);
  } finally {
    await ore("archive", made.id);
  }
});

journey("course: a rename from its menu goes on the history; ⌘Z puts the old name back, ⇧⌘Z renames it again", async (page) => {
  // A course needs a course site to add; two sources made its lessons stand in.
  if (!LIB) throw new Error("this journey edits the library: set ORE_LIBRARY to the running mock's");
  // Core by path, so the desktop's typecheck doesn't take in core's sources.
  const { updateItemMeta } = (await import(join(import.meta.dir, "../../../packages/core/src/items.ts"))) as { updateItemMeta: (lib: { root: string }, id: string, patch: (m: object) => object) => Promise<unknown> };
  const made = await Promise.all(["One", "Two"].map((n) => fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich", "--json"], stdin: `# Lesson ${n}\n\nA lesson.` }) }).then((r) => r.json() as Promise<{ id: string }>)));
  for (const [i, m] of made.entries()) await updateItemMeta({ root: LIB }, m.id, (x) => ({ ...x, course: { id: "spacing-course", title: "Spacing course", part: i + 1 } }));
  try {
    await page.reload();
    await page.getByRole("button", { name: /^All sources/ }).click();
    const row = page.locator(".list .row.course");
    await row.filter({ hasText: "Spacing course" }).waitFor();
    await row.filter({ hasText: "Spacing course" }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Rename…" }).click();
    await page.locator(".list .row.course").getByLabel("Title").fill("Spacing, renamed");
    await page.keyboard.press("Enter");
    await row.filter({ hasText: "Spacing, renamed" }).waitFor();
    await page.waitForTimeout(300); // the write lands, then its step is on the history
    await page.keyboard.press("Meta+z");
    await until("⌘Z puts the old name back", async () => (await row.filter({ hasText: "Spacing course" }).count()) === 1);
    await page.keyboard.press("Meta+Shift+z");
    await until("⇧⌘Z renames it again", async () => (await row.filter({ hasText: "Spacing, renamed" }).count()) === 1);
  } finally {
    for (const m of made) await ore("archive", m.id).catch(() => {});
  }
});

journey("suggested skill: ⌘Z takes back Accept (the new skill goes, the suggestion returns) and Dismiss", async (page) => {
  const made = (await fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich", "--json"], stdin: "# Why sleep consolidates memory\n\nSleep replays the day." }) }).then((r) => r.json())) as { id: string };
  // Undo of a dismiss puts a suggestion on it, as enrich would.
  await ore("suggested-skill", made.id, "undo", JSON.stringify({ suggestion: { name: "Sleep Science", hook: "Rest that helps you learn" } }));
  try {
    await page.reload();
    await openSource(page, "Why sleep consolidates memory");
    const chip = page.locator(".chip.suggested");
    const skill = page.locator(".sidebar .side-item", { hasText: "Sleep Science" });
    await chip.getByRole("button", { name: "+ Sleep Science" }).click();
    await skill.waitFor();
    await until("the chip goes", async () => (await chip.count()) === 0);
    await page.waitForTimeout(300);
    await page.keyboard.press("Meta+z");
    await until("⌘Z takes the new skill away and brings the suggestion back", async () => (await skill.count()) === 0 && (await chip.count()) === 1);
    await page.keyboard.press("Meta+Shift+z");
    await until("⇧⌘Z accepts it again", async () => (await skill.count()) === 1 && (await chip.count()) === 0);
    await page.keyboard.press("Meta+z");
    await until("back to the suggestion", async () => (await chip.count()) === 1);
    await chip.getByRole("button", { name: "Dismiss suggested skill Sleep Science" }).click();
    await until("Dismiss takes the chip away", async () => (await chip.count()) === 0);
    await page.waitForTimeout(300);
    await page.keyboard.press("Meta+z");
    await until("⌘Z brings the dismissed suggestion back", async () => (await chip.count()) === 1);
  } finally {
    await ore("skills", "rm", "sleep-science").catch(() => {});
    await ore("archive", made.id);
  }
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
// The style rules a regex can't see (nested frames, off-ramp font sizes), on the same mock.
if (!only) {
  const style = Bun.spawnSync(["bun", join(MOCK, "style-check.ts"), url], { env: { ...process.env, ORE_BRIDGE: String(BRIDGE) }, stdout: "inherit", stderr: "inherit" });
  if (style.exitCode !== 0) { failed++; console.log("FAIL  style-check"); } else console.log("ok    style-check");
}
stop();
if (errors.length) console.log(`page errors:\n  ${[...new Set(errors)].join("\n  ")}`);
process.exit(failed || errors.length ? 1 : 0);
