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
  const pieces = async () => Number(/(\d+) in your answer/.exec(await q.innerText())?.[1] ?? 0);
  const before = await pieces();
  await q.locator(".qp-row").click();
  await page.keyboard.type("Spacing helped fourth graders in one study.");
  await page.keyboard.press("Enter");
  await until("the piece is added", async () => (await pieces()) === before + 1);
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

journey("⌘K: a match in the text opens the source at that place, the find bar on the words", async (page) => {
  await page.keyboard.press("Meta+k");
  await page.locator("[cmdk-input]").fill("plausible");
  await page.locator("[cmdk-item]").filter({ hasText: TESTING }).first().waitFor();
  await page.keyboard.press("Enter");
  const bar = page.getByLabel("Find in source");
  await until("the find bar holds the words", async () => (await bar.count()) === 1 && (await bar.inputValue()) === "plausible");
  await until("the match is on screen", () =>
    page.evaluate(() => {
      const r = [...(CSS.highlights.get("find-on") ?? [])][0] as Range | undefined;
      const b = r?.getBoundingClientRect();
      return !!b && b.top >= 0 && b.bottom <= innerHeight;
    }),
  );
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

journey("diagram: a new one left before its first save comes back is linked once, and one whose save fails is kept with Try again", async (page) => {
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
