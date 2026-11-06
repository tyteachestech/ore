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
  await page.keyboard.press("Meta+Shift+z");
  await until("⇧⌘Z puts it back", async () => Number(await keeps.innerText()) === before + 1);
  await page.reload();
  await openSource(page, TESTING);
  await until("it is still there after a relaunch", async () => Number(await keeps.innerText()) === before + 1);
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
