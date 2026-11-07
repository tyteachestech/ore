// End-to-end journeys: the app in a real browser against a seeded scratch library, through the real
// `ore` CLI (scripts/mock), doing what Tyler does every day. Unit tests check the parts; these check
// that the parts still work together on screen (note saves across switches, undo, review).
//   bun run e2e                      seeds, starts the bridge and vite, runs every journey
//   bun run e2e -- highlight         only journeys whose name contains "highlight"
//   E2E_URL=http://localhost:1420/   use a mock already running (scripts/mock/README.md) instead
import { chromium, type Page } from "playwright";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

const MOCK = join(import.meta.dir, "../scripts/mock");
const FIXTURES = join(import.meta.dir, "../../../packages/core/test/fixtures/intake/files");
const BRIDGE = process.env.E2E_URL ? Number(process.env.E2E_BRIDGE ?? 1421) : 1451;
const only = process.argv[2];

async function start(): Promise<{ url: string; stop: () => void }> {
  if (process.env.E2E_URL) return { url: process.env.E2E_URL, stop: () => {} };
  const lib = mkdtempSync(join(tmpdir(), "ore-e2e-"));
  await $`bun ${join(MOCK, "seed.ts")} ${lib}`.quiet();
  // The table and formula reader (D125) stands in as a script that writes Docling's saved reading of tables.pdf.
  const docling = join(lib, ".ore", "docling");
  writeFileSync(docling, `#!/bin/sh\nsleep 1\nwhile [ "$1" != "--output" ]; do shift; done\ncp "${FIXTURES}/tables.docling.json" "$2/tables.json"\n`);
  chmodSync(docling, 0o755);
  // Ports of their own, so a mock left running for screenshots (1420, 1421) never answers instead.
  const bridge = Bun.spawn(["bun", join(MOCK, "bridge.ts")], { env: { ...process.env, ORE_LIBRARY: lib, ORE_DOCLING: docling, PORT: String(BRIDGE), ORE_MOCK_AI: join(import.meta.dir, "ai"), ORE_MOCK_DELAY: "50" }, stdout: "ignore", stderr: "inherit" });
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

journey("Collected row menu: change a highlight's type and remove it without opening it, ⌘Z takes each back", async (page) => {
  await openSource(page, TESTING);
  await page.getByRole("tab", { name: "Collected" }).click();
  const keeps = page.locator(".collected-chip.keep");
  const before = Number(await keeps.innerText());
  const toggle = page.locator(".cp-head.keep .cp-toggle");
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  const row = () => page.locator(".cp-head.keep ~ .cp-line").first();
  await row().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Type" }).hover();
  await page.getByRole("menuitemcheckbox", { name: "Question" }).dispatchEvent("click");
  await until("it is a question now", async () => (await keeps.count()) === 0 || Number(await keeps.innerText()) === before - 1);
  await page.keyboard.press("Meta+z");
  await until("⌘Z makes it a highlight again", async () => (await keeps.count()) > 0 && Number(await keeps.innerText()) === before);
  await row().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Remove highlight" }).click();
  await until("it is gone", async () => (await keeps.count()) === 0 || Number(await keeps.innerText()) === before - 1);
  await page.keyboard.press("Meta+z");
  await until("⌘Z brings it back", async () => (await keeps.count()) > 0 && Number(await keeps.innerText()) === before);
});

journey("highlight: a selection snaps to whole words and the full stop, ⌥ keeps it exact", async (page) => {
  await openSource(page, TESTING);
  const active = () => page.evaluate(() => [...(CSS.highlights.get("hl-active") ?? [])].map((r) => r.toString()).join("|"));
  const popup = page.getByRole("dialog", { name: "Highlight" });
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
  await page.keyboard.press("Home");
  await page.keyboard.type("# ");
  await until("the item is a heading", async () => /<h1[^>]*>The Foundations/.test(await html()));
  // A key sent within a frame of the last can beat the editor's own redraw; a hand never does.
  await page.waitForTimeout(100);
  await page.keyboard.press("End");
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
  const row = page.locator(".home-read").filter({ hasText: "The Testing Effect" }).first();
  await row.waitFor();
  const title = () => row.locator(".title").innerText();
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  await page.locator(".home-read").getByLabel("Title").fill("Testing, renamed");
  await page.keyboard.press("Escape");
  await until("Esc keeps the old title", async () => (await title()) === TESTING);
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
  await field.fill("Making");
  await until("typing clears the refusal", async () => (await page.getByRole("alert").filter({ hasText: "is taken" }).count()) === 0);
  await page.keyboard.press("Escape");
  await until("Esc keeps the old name, and Life is still its own", async () => (await page.locator(".side-label-text").allInnerTexts()).filter((t) => /^(craft|life)$/i.test(t)).length === 2);
});

journey("pinned sources: Move up and a drag put them in his order; ⌘Z takes a move back", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  const row = (t: string) => page.locator(".row").filter({ hasText: t }).first();
  const menu = async (t: string, item: string) => {
    await row(t).click({ button: "right" });
    await page.getByRole("menuitem", { name: item }).click();
  };
  const pinned = () => page.locator(".row.pinned .title").allInnerTexts();
  await menu(AGENTS, "Pin to top");
  await menu(TESTING, "Pin to top");
  await until("pinned in the order pinned", async () => (await pinned()).join("|") === [AGENTS, TESTING].join("|"));
  await menu(TESTING, "Move up");
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
  await until("the link is still in the note", async () => (await page.locator(".note-editor .note-diagram svg").count()) === 1);
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
    last = (await q.first().textContent()) ?? "";
    const noIdea = page.getByRole("button", { name: "No idea" });
    await (await noIdea.isVisible() ? noIdea : page.getByRole("radio", { name: "Think so" })).click();
    await page.getByRole("button", { name: "Good", exact: true }).click();
    await until("the card moves on", async () => (await doneButton.isVisible()) || ((await q.count()) > 0 && (await q.first().textContent()) !== last));
  }
  await doneButton.waitFor();
  await page.waitForTimeout(300);
  await page.keyboard.press("Meta+z");
  await until("⌘Z leaves the end screen for the last card", async () => !(await doneButton.isVisible()) && (await q.count()) > 0 && (await q.first().textContent()) === last);
  await page.keyboard.press("Shift+Meta+z");
  await until("⇧⌘Z rates it again and the session ends again", () => doneButton.isVisible());
  // Put every rating back for the journeys after this one.
  const undo = page.getByRole("button", { name: "Undo last rating" });
  for (let n = 0; n < 12 && (await undo.isVisible()); n++) {
    await undo.click();
    await page.waitForTimeout(250);
  }
  await page.keyboard.press("Escape");
});

journey("try it: 4 marks a technique to try, the skill page checks it off, and how it went is kept after a reload", async (page) => {
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
  await page.getByLabel("How did it go?").fill("Caught two gaps before recording");
  await page.keyboard.press("Enter");
  const saved = page.locator(".try-reflection", { hasText: "Caught two gaps before recording" });
  await saved.waitFor();
  await Bun.sleep(500);
  await page.reload();
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  await page.locator(".answered-toggle", { hasText: "Tried" }).click();
  await saved.waitFor();
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
