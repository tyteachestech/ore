import { join } from "node:path";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { type Page } from "playwright";
import { AGENTS, awayAndBack, BRIDGE, FIXTURES, hold, isHeld, journey, LIB, loaded, openSource, ore, release, type Rigged, select, TESTING, until } from "../harness";

journey("notebook: a cell's output is folded until he opens it, a click or Enter shows it, and a highlight on the text around it still lands (D199)", async (page) => {
  const made = (await ore("add", join(FIXTURES, "numpy.ipynb"), "--no-enrich")) as { id: string };
  try {
  await page.reload();
  await openSource(page, "Introducing NumPy");
  const fold = page.locator(".doc .output-fold");
  const out = page.locator(".doc pre.output");
  await fold.waitFor();
  if (await out.isVisible()) throw new Error("the output shows before he has guessed it");
  if (!(await page.locator(".doc pre").first().innerText()).includes("np.arange(3) * 2")) throw new Error("the cell's code is not shown");
  // The hidden output is still the text the highlights are placed in: one after it lands where he dragged.
  await select(page, "Shapes stretch to match");
  await page.locator(".popup").waitFor();
  await page.keyboard.press("Escape");
  await fold.focus();
  await page.keyboard.press("Enter");
  await out.waitFor();
  if (!(await out.innerText()).includes("array([0, 2, 4])")) throw new Error(`the output reads “${await out.innerText()}”`);
  if (await fold.count()) throw new Error("the row stays after the output is shown");
  // The row he pressed Enter on is gone: focus goes to the output it showed, never to nothing.
  await until("focus is on the output it showed", () => page.evaluate(() => document.activeElement?.matches("pre.output") ?? false));
  // An article's plain text block is not an output.
  await openSource(page, AGENTS);
  if (await page.locator(".doc .output-fold").count()) throw new Error("an article got a folded output");
  } finally {
    await ore("archive", made.id).catch(() => {});
  }
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

journey("notes: the selection bar's Turn into opens its list and turns the paragraph into a heading (WebKit)", async (page) => {
  // Codex UX sweep 15: the list's focus counted as leaving the note, so the bar and its list closed at once.
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  const pm = page.locator(".skill-note .ProseMirror");
  await pm.waitFor();
  await pm.click();
  await page.keyboard.press("Meta+ArrowDown");
  await page.keyboard.press("Enter");
  const line = `Turned into a heading (${Date.now() % 100000})`;
  await page.keyboard.type(line);
  await pm.locator("p", { hasText: line }).click({ clickCount: 3 });
  const turn = page.locator(".sel-bar").getByRole("button", { name: "Turn into" });
  await turn.waitFor();
  await turn.click();
  const h2 = page.locator(".menu-list").getByRole("menuitem", { name: "Heading 2", exact: true });
  await until("Turn into's list stays open", async () => (await h2.count()) === 1 && (await h2.isVisible()));
  await h2.click();
  await until("the line is a heading", async () => (await pm.locator("h2", { hasText: line }).count()) === 1);
}, "webkit");

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

journey("note equations: /equation opens a TeX field that draws as he types; ↵ closes it and it is still drawn after a reload", async (page) => {
  const pm = page.locator(".note-editor .ProseMirror").first();
  await openSource(page, AGENTS);
  await pm.click();
  // A fresh note: after the toggle journey, ⌘End lands inside the toggle (its heading or the start of its body),
  // so the equation went into a heading, or before the body's words, and the line never ended in " here".
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("Area grows as /equation", { delay: 20 });
  await page.locator(".note-menu-row.on", { hasText: "Inline equation" }).waitFor();
  await page.keyboard.press("Enter");
  await page.getByLabel("Equation (TeX)").waitFor();
  await page.keyboard.type("\\pi r^2");
  await until("it draws as he types", async () => (await pm.locator(".note-math .katex annotation").last().textContent()) === "\\pi r^2");
  await page.keyboard.press("Enter");
  await page.keyboard.type(" here");
  // The line's text, not its last DOM node: under load the typed words can land as more than one text node.
  await until("the field closes and he types after it", async () => !(await page.getByLabel("Equation (TeX)").count()) && / here$/.test((await pm.locator("p", { has: page.locator(".note-math") }).last().textContent()) ?? ""));
  await page.waitForTimeout(600); // the note saves after a pause
  await page.reload();
  await openSource(page, AGENTS);
  await until("still drawn after a reload", async () => (await pm.locator(".note-math .katex annotation").last().textContent().catch(() => "")) === "\\pi r^2");
});

// F328: the / menu closed at the space in "/heading 2", and Enter left the words as prose.
journey("note: /heading 2 and Enter makes a Heading 2, and /etc folder stays prose", async (page) => {
  const pm = page.locator(".note-editor .ProseMirror").first();
  await openSource(page, AGENTS);
  await pm.click();
  // An empty note of its own: an earlier journey in the same run can leave the note ending in a formula or a heading.
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await until("the note is empty", async () => ((await pm.textContent()) ?? "").trim() === "");
  await page.keyboard.type("/heading 2", { delay: 20 });
  await page.locator(".note-menu-row.on", { hasText: "Heading 2" }).waitFor();
  await page.keyboard.press("Enter");
  await page.keyboard.type("Plans");
  await until("a Heading 2 with no slash left", async () => (await pm.locator("h2", { hasText: "Plans" }).count()) === 1 && !/\/heading/.test((await pm.textContent()) ?? ""));
  await page.keyboard.press("Enter");
  await page.keyboard.type("See /etc folder", { delay: 20 });
  await until("no menu once nothing answers", async () => (await page.locator(".note-menu").count()) === 0);
  await page.keyboard.press("Enter");
  await until("the words stay as he typed them", async () => (await pm.locator("p", { hasText: "See /etc folder" }).count()) === 1);
});

journey("note keys as in Notion: /h1 finds Heading 1, a / closed with Esc opens again, ⌘K links the selected words (Esc goes back to them, a press outside doesn't), ⌘↵ closes a toggle", async (page) => {
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
  // The words selected to the line's start and ⌘K in the same moment, as a quick hand does: ⌘K reads the
  // selection the note has when the key lands, never one a frame behind.
  await page.evaluate(() => {
    const t = document.querySelector(".note-editor .ProseMirror p")!.firstChild!;
    getSelection()!.setBaseAndExtent(t, t.textContent!.length, t, 0);
    document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "k", code: "KeyK", metaKey: true, bubbles: true, cancelable: true }));
  });
  await page.getByPlaceholder("Paste a link").waitFor();
  // Esc closes it with focus back on the words (Notion), so ⌘K asks again at once.
  await page.keyboard.press("Escape");
  await until("Esc puts focus back in the note, on the words", async () => (await page.getByPlaceholder("Paste a link").count()) === 0 && (await page.evaluate(() => !!document.activeElement?.closest(".note-editor") && document.getSelection()?.toString().trim() === "Read the guide")));
  // A press outside closes it and leaves focus where it landed: the note doesn't pull it back. The title bar takes
  // no focus, as a button doesn't in WebKit, so focus falls to the page and must stay there.
  await page.keyboard.press("Meta+k");
  await page.getByPlaceholder("Paste a link").waitFor();
  await page.locator(".titlebar").click({ position: { x: 400, y: 5 } });
  await until("a press outside closes the link field", async () => (await page.getByPlaceholder("Paste a link").count()) === 0);
  await page.waitForTimeout(200);
  if (await page.evaluate(() => !!document.activeElement?.closest(".note-editor"))) throw new Error("a press outside the link field put focus back in the note");
  await pm.getByText("Read the guide").click();
  // The line's end, then select to its start, by this Mac's keys or Linux's (on the Mac, Home and End scroll).
  const mac = process.platform === "darwin";
  await page.keyboard.press(mac ? "Meta+ArrowRight" : "End");
  await page.keyboard.press(mac ? "Meta+Shift+ArrowLeft" : "Shift+Home");
  if ((await page.evaluate(() => String(getSelection()))) !== "Read the guide") throw new Error("the words aren't selected");
  await page.keyboard.press("Meta+k"); // at once: ⌘K reads the selection the note has as the key lands
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

journey("note / menu at the bottom of a long note: it opens above the line, inside the window; in a short window its list scrolls (Notion)", async (page) => {
  const menu = page.locator(".note-menu");
  const frames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); // resize and scroll land on the next frame
  const inside = async (what: string, box = menu) => {
    const b = (await box.boundingBox())!;
    const v = page.viewportSize()!;
    if (b.y < 0 || b.x < 0 || b.y + b.height > v.height + 0.5 || b.x + b.width > v.width + 0.5) throw new Error(`${what}: it runs out of the ${v.width}×${v.height} window at ${JSON.stringify(b)}`);
  };
  const onInMenu = async (what: string) => {
    const on = page.locator(".note-menu-row.on");
    const [m, r] = [(await menu.boundingBox())!, (await on.boundingBox())!];
    if (r.y < m.y - 0.5 || r.y + r.height > m.y + m.height + 0.5) throw new Error(`${what}: the highlighted row (${await on.innerText()}) is scrolled out of the menu`);
  };
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSource(page, AGENTS);
  await page.locator(".note-editor [contenteditable=true]").first().click();
  // To the end of the note: ⌘↓ on the Mac (⌘End is not a Mac key), Ctrl+End elsewhere.
  await page.keyboard.press(process.platform === "darwin" ? "Meta+ArrowDown" : "Control+End");
  for (let i = 0; i < 40; i++) await page.keyboard.press("Enter");
  const atEnd = await page.evaluate(() => document.querySelector(".note-editor .ProseMirror")!.lastElementChild!.contains(getSelection()!.anchorNode));
  if (!atEnd) throw new Error("the caret is not on the note's last line");
  await page.keyboard.type("/");
  await menu.waitFor();
  await inside("at the bottom of the note");
  const caret = await page.evaluate(() => getSelection()!.getRangeAt(0).getBoundingClientRect().top);
  if ((await menu.boundingBox())!.y > caret) throw new Error("with no room under the line the menu should open above it");
  // Narrowing the list keeps it inside and by the line; a row is still a click away.
  await page.keyboard.type("quo");
  await inside("narrowed to Quote");
  await menu.locator(".note-menu-row", { hasText: "Quote" }).click();
  await page.locator(".note-editor blockquote").last().waitFor();
  // A short window, the line high in the note's panel: the full list is taller than the room under it,
  // so it is capped and scrolls; ↑ from the first row goes to the last, which scrolls into view.
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.setViewportSize({ width: 1280, height: 500 });
  await frames();
  for (let i = 0; i < 16; i++) await page.keyboard.press("ArrowUp"); // up the empty lines, with the note's end below
  await page.evaluate(() => {
    const r = getSelection()!.getRangeAt(0).getBoundingClientRect();
    let pane = document.querySelector(".note-editor")!.parentElement;
    while (pane && !/auto|scroll/.test(getComputedStyle(pane).overflowY)) pane = pane.parentElement;
    pane!.scrollTop += r.top - 140;
  });
  await page.keyboard.type("/");
  await menu.waitFor();
  await inside("in a 500px window");
  if (!(await menu.evaluate((el) => el.scrollHeight > el.clientHeight))) throw new Error("in a short window the list should scroll inside the menu");
  await page.keyboard.press("ArrowUp");
  await onInMenu("↑ to the last row");
  // The window shrinks while it is open: still inside, and the late row its smaller cap hides is scrolled back to.
  await page.setViewportSize({ width: 1280, height: 420 });
  await frames();
  await inside("after the window shrinks");
  await onInMenu("after the window shrinks");
  // Its line scrolled out of the note's panel: the menu goes with it rather than hang at the window's
  // edge; typing still filters it, and it is back by the line when the line is.
  const line = await page.evaluate(() => { const r = getSelection()!.getRangeAt(0).getBoundingClientRect(); return { x: r.left, y: r.top }; });
  await page.mouse.move(line.x + 40, line.y + 120);
  await page.mouse.wheel(0, 300);
  await frames();
  await frames();
  if (await menu.isVisible()) throw new Error("the menu still shows with its line scrolled out of view");
  await page.keyboard.type("div");
  await page.mouse.wheel(0, -300);
  await frames();
  await frames();
  await menu.waitFor();
  await inside("its line scrolled back");
  if ((await page.locator(".note-menu-row").allInnerTexts()).map((r) => r.split("\n")[0]).join() !== "Divider") throw new Error("typing while it was hidden did not filter it");
  const back = await page.evaluate(() => getSelection()!.getRangeAt(0).getBoundingClientRect());
  const mb = (await menu.boundingBox())!;
  if (Math.abs(mb.y - back.bottom) > 8 && Math.abs(mb.y + mb.height - back.top) > 8) throw new Error(`the menu came back away from its line (${mb.y}..${mb.y + mb.height}, line ${back.top}..${back.bottom})`);
  await page.keyboard.press("Escape");
  // The format bar on words at the right edge of the window stays inside it, and again when the window narrows.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.keyboard.press("Enter");
  await page.keyboard.type("Read the guide to building agents", { delay: 5 });
  await page.keyboard.press(process.platform === "darwin" ? "Meta+Shift+ArrowLeft" : "Shift+Home"); // to the line's start (⇧Home is to the note's start on the Mac)
  const bar = page.locator(".sel-bar");
  await bar.waitFor();
  await inside("the format bar", bar);
  await page.setViewportSize({ width: 1000, height: 900 });
  await frames();
  await inside("the format bar after the window narrows", bar);
  // And when the side panel is dragged narrower under it.
  const edge = (await page.getByRole("separator", { name: "Resize the side panel" }).boundingBox())!;
  await page.mouse.move(edge.x + edge.width / 2, edge.y + 200);
  await page.mouse.down();
  await page.mouse.move(edge.x + 120, edge.y + 200, { steps: 6 });
  await page.mouse.up();
  await frames();
  if (!(await bar.isVisible())) throw new Error("the format bar closed when the panel was resized");
  await inside("the format bar after the panel narrows", bar);
});

journey("note tables: / makes one, Tab adds a row, the column grip deletes a column and drags one first, + adds a row; kept after a reload; widen and back", async (page) => {
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
  // The grip drags too (drag.ts resizeDrag, F193): Cost before Tool, past the 4 px click slop.
  await page.locator(".note-editor .note-table th", { hasText: "Cost" }).hover();
  const grip = (await page.locator(".table-grip.cols").boundingBox())!;
  const tool = (await page.locator(".note-editor .note-table th", { hasText: "Tool" }).boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(tool.x + 4, tool.y + tool.height / 2, { steps: 6 });
  await page.mouse.up();
  await until("the column moved first", async () => (await cells())[0]!.join() === "Cost,Tool");
  await page.locator(".note-editor .note-table td", { hasText: "Memory" }).hover();
  await page.locator(".table-add.rows").click();
  await until("+ added a row", async () => (await cells()).length === 5);
  await page.waitForTimeout(600); // the note saves after a pause
  await page.reload();
  await openSource(page, AGENTS);
  await until("the table survives a reload", async () => (await cells()).length === 5 && (await cells())[3]!.join() === ",Memory");
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

journey("a note's mail link opens Mail, a heading link goes to its heading, and any other link says why it does nothing (Codex sweep 3, hostile)", async (page) => {
  const item = ((await ore("ls")) as { id: string; title: string }[]).find((i) => i.title === TESTING)!.id;
  const { text: was } = (await ore("notes", item)) as { text: string };
  const filler = Array.from({ length: 60 }, (_, i) => `Filler line ${i + 1}.`).join("\n\n");
  await ore("notes", item, `--set=[Mail link](mailto:tyler@example.com) [Heading link](#far-heading) [Relative link](beside.md)\n\n${filler}\n\n## Far heading\n\nThe end.\n`);
  try {
    await openSource(page, TESTING);
    await page.getByRole("tab", { name: "Source note" }).click();
    const note = page.locator(".mynotes .ProseMirror");
    await note.getByText("Mail link").click();
    await until("the mail link goes to Mail", async () => ((await page.evaluate(() => (window as { __ORE_OPENED?: string[] }).__ORE_OPENED)) ?? []).includes("mailto:tyler@example.com"));
    await note.getByText("Heading link").click();
    const far = note.getByRole("heading", { name: "Far heading" });
    await until("the heading link scrolls to its heading", async () => {
      const [h, box] = await Promise.all([far.boundingBox(), note.evaluate((el) => el.closest(".mynotes")!.getBoundingClientRect().toJSON() as DOMRect)]);
      return !!h && h.y >= box.y - 1 && h.y < box.y + box.height;
    });
    await note.getByText("Relative link").click();
    await page.locator(".toast", { hasText: "“beside.md” isn’t one of those" }).waitFor();
  } finally {
    await ore("notes", item, `--set=${was}`);
  }
});

journey("Linked from: a linking skill renamed from the sidebar shows its new name at once, and its ⌘Z the old one (Codex sweep 5)", async (page) => {
  const ore = (args: string[]) => page.evaluate((args) => (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown) => Promise<{ text: string }> } }).__TAURI_INTERNALS__.invoke("ore", { args }), args);
  const was = (await ore(["notes", "--skill=habits"])).text;
  await ore(["notes", "--skill=habits", `--set=${was}\n\nSee [Learning](ore:skill/learning) for the plan.`]);
  try {
    await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
    const from = page.locator(".linked-from .backlink .from");
    const named = async (name: string) => (await from.allInnerTexts()).some((t) => t.startsWith(`${name} notes`));
    await from.filter({ hasText: /^Habits notes/ }).waitFor();
    await page.locator(".sidebar .side-item", { hasText: /^Habits$/ }).first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "Edit skill…" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit skill Habits" });
    await dialog.getByLabel("Rename Habits").fill("Habit loops");
    await dialog.getByLabel("Rename Habits").press("Enter");
    await dialog.waitFor({ state: "detached" });
    await page.locator(".sidebar .side-item", { hasText: "Habit loops" }).first().waitFor();
    await until("Linked from names the skill by its new name", () => named("Habit loops"));
    await page.keyboard.press("Meta+z");
    await page.locator(".sidebar .side-item", { hasText: /^Habits$/ }).first().waitFor();
    await until("and by its old one after ⌘Z", () => named("Habits"));
  } finally {
    await ore(["notes", "--skill=habits", `--set=${was}`]);
  }
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

journey("note blocks: drag one by its ⋮⋮ handle, it stays moved after a reload; Turn into, then ⌘Z", async (page) => {
  const items = () => page.locator(".note-editor li").allInnerTexts();
  const grip = async (text: string) => {
    const box = (await page.locator(".note-editor li").filter({ hasText: text }).boundingBox())!;
    await page.mouse.move(box.x + 30, box.y + box.height / 2);
    const g = page.locator(".block-grip");
    await g.waitFor();
    const at = (await g.boundingBox())!;
    // On the way left to it, over the bullets and the gutter, the handle stays on this item (it jumped to the list's first).
    await page.mouse.move(at.x + 10, at.y + 12, { steps: 12 });
    if ((await g.boundingBox())?.y !== at.y) throw new Error(`the handle left “${text}” on the way to it`);
    return { g: at, box };
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
  // Each block type draws its icon, as Notion's Turn into does (Tyler 2026-11-13).
  const kinds = page.locator(".menu-sub [role=menuitemcheckbox]");
  await kinds.first().waitFor();
  const drawn = await page.locator(".menu-sub [role=menuitemcheckbox] > svg[data-sprite]").count();
  if (drawn !== (await kinds.count())) throw new Error(`Turn into: ${drawn} of ${await kinds.count()} block types have an icon`);
  if (process.env.ORE_E2E_SHOT) await page.screenshot({ path: process.env.ORE_E2E_SHOT });
  await page.getByRole("menuitemcheckbox", { name: "Heading 3", exact: true }).dispatchEvent("click");
  await until("it became a heading", () => page.locator(".note-editor h3", { hasText: "Effortful" }).isVisible());
  await page.keyboard.press("ControlOrMeta+z"); // the editor's own undo: ⌘ on the Mac, Ctrl where CI runs
  await until("⌘Z takes it back", async () => (await items()).some((t) => t.startsWith("Effortful")));
});

journey("note drag to select: a drag down the gutter boxes the blocks it passes, a drag through text into the next block selects both, a drag along one line stays text", async (page) => {
  const picked = () => page.locator(".note-editor .block-sel").allInnerTexts();
  await openSource(page, AGENTS);
  const note = page.locator(".note-editor [contenteditable=true]").first();
  await until("the note takes the caret", async () => (await note.click({ position: { x: 8, y: 8 } }), await note.evaluate((e) => e.contains(document.activeElement))));
  await page.keyboard.press("ControlOrMeta+End");
  for (const line of ["Drag one here", "Drag two here", "Drag three here"]) {
    await page.keyboard.press("Enter");
    await page.keyboard.type(line);
  }
  const box = async (text: string) => (await page.locator(".note-editor p", { hasText: text }).boundingBox())!;
  const [one, two, three] = [await box("Drag one"), await box("Drag two"), await box("Drag three")];
  // From the gutter left of the note, straight down (Tyler's clip, 2026-11-10: nothing happened).
  await page.mouse.move(one.x - 12, one.y + 4);
  await page.mouse.down();
  await page.mouse.move(one.x - 10, two.y + two.height / 2, { steps: 6 });
  await page.locator(".marquee").waitFor();
  await until("the box selects the two blocks it passes", async () => (await picked()).join() === "Drag one here,Drag two here");
  await page.mouse.move(one.x - 10, three.y + three.height / 2, { steps: 4 });
  await page.mouse.up();
  await until("and the third, once it reaches it; the box goes on release", async () => (await picked()).length === 3 && (await page.locator(".marquee").count()) === 0);
  await page.locator(".note-editor p", { hasText: "Drag three" }).click();
  await until("a click lets go", async () => (await picked()).length === 0);
  // Through text: words first, whole blocks from the next block on.
  await page.mouse.move(one.x + 30, one.y + one.height / 2);
  await page.mouse.down();
  await page.mouse.move(one.x + 70, one.y + one.height / 2 + 2, { steps: 4 });
  if ((await picked()).length) throw new Error("a drag along one line selected its block");
  await page.mouse.move(one.x + 70, two.y + two.height / 2, { steps: 6 });
  await until("into the next block, both are selected", async () => (await picked()).join() === "Drag one here,Drag two here");
  await page.mouse.up();
  await page.waitForTimeout(300); // the browser's own text selection must not take over after the release
  if ((await picked()).length !== 2 || (await page.locator(".sel-bar").count())) throw new Error("the blocks did not stay selected after the drag");
  await page.keyboard.press("Backspace");
  await until("Backspace takes both out", async () => (await page.locator(".note-editor p", { hasText: /Drag (one|two)/ }).count()) === 0);
  await page.keyboard.press("ControlOrMeta+z");
  await until("⌘Z brings them back", async () => (await page.locator(".note-editor p", { hasText: /Drag (one|two)/ }).count()) === 2);
  // Leave the note as it was.
  await page.locator(".note-editor p", { hasText: "Drag three" }).click();
  await page.waitForTimeout(100);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Shift+ArrowUp");
  await page.keyboard.press("Shift+ArrowUp");
  await until("the three lines are selected", async () => (await picked()).length === 3);
  await page.keyboard.press("Backspace");
  await until("and gone", async () => (await page.locator(".note-editor p", { hasText: "Drag" }).count()) === 0);
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

journey("diagram: opens in a sheet centred over the window, ⇧⌘↵ gives it the full window and back, a click outside closes it, and a new one stays linked when its note closes under it", async (page) => {
  await openSource(page, AGENTS);
  const note = page.locator(".note-editor [contenteditable=true]").first();
  // Typed into the reader instead, "/diagram" would run its keys (A archives the source).
  await until("the note takes the caret", async () => (await note.click(), await note.evaluate((e) => e.contains(document.activeElement))));
  await page.keyboard.press("Meta+ArrowDown");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/diagram");
  await page.locator(".note-menu-row.on").filter({ hasText: "Diagram" }).waitFor();
  await page.keyboard.press("Enter");
  const sheet = page.locator(".diagram-scrim:not(.full) .diagram");
  await sheet.waitFor().catch(async (e) => {
    // Say where it went instead: a toast's error, or the screen it landed on.
    const seen = await page.evaluate(() => [...document.querySelectorAll("[role=status], [role=alert], .toast")].map((n) => n.textContent).join(" | "));
    throw new Error(`no diagram sheet (full window: ${await page.locator(".diagram-scrim.full").count()}, reader: ${await page.locator(".doc").count()}, says: ${seen || "nothing"}): ${(e as Error).message}`);
  });
  // The window's shape, 15% of it showing on every side (Tyler 2026-11-09).
  const vw = page.viewportSize()!;
  const r = (await sheet.boundingBox())!;
  const near = (a: number, b: number) => Math.abs(a - b) <= 2;
  if (!(near(r.x, vw.width * 0.15) && near(r.y, vw.height * 0.15) && near(r.width, vw.width * 0.7) && near(r.height, vw.height * 0.7)))
    throw new Error(`the sheet is ${JSON.stringify(r)} in a ${vw.width}×${vw.height} window`);
  const canvas = await sheet.locator(".draw").boundingBox();
  await sheet.locator(".draw").focus();
  await page.keyboard.press("r");
  await page.mouse.move(canvas!.x + 160, canvas!.y + 200);
  await page.mouse.down();
  await page.mouse.move(canvas!.x + 320, canvas!.y + 280, { steps: 5 });
  await page.mouse.up();
  await until("the note links it once it is saved", () => page.locator(".note-editor .note-diagram").count().then((n) => n === 1), 6000);
  // The note closes under it (the source closes, a quit): it still saves, and the link stays.
  await page.getByRole("tab", { name: "Collected" }).dispatchEvent("mousedown");
  await until("the drawing goes with its note", async () => (await page.locator(".diagram").count()) === 0);
  await page.getByRole("tab", { name: "Source note" }).click();
  await until("the link is still in the note", async () => (await page.locator(".note-editor .note-diagram-view > svg").count()) === 1);
  await page.locator(".note-editor .note-diagram").click();
  await sheet.waitFor();
  await page.keyboard.press("Shift+Meta+Enter");
  const full = page.locator(".diagram-scrim.full .diagram");
  await full.waitFor();
  const f = (await full.boundingBox())!;
  if (!(near(f.x, 0) && near(f.width, vw.width) && near(f.y + f.height, vw.height))) throw new Error(`full window is ${JSON.stringify(f)}`);
  await page.keyboard.press("Shift+Meta+Enter");
  await sheet.waitFor();
  await page.getByRole("button", { name: "Full window" }).click();
  await full.waitFor();
  await page.keyboard.press("Escape");
  await until("Esc closes it", async () => (await page.locator(".diagram").count()) === 0);
  // The next open is the sheet again, and a press outside it closes it.
  await page.locator(".note-editor .note-diagram").click();
  await sheet.waitFor();
  // Tab stays in the sheet (the note behind it can't take keys), and a right-click outside leaves it open.
  await page.locator(".diagram-done").focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press("Tab");
  if (!(await page.evaluate(() => !!document.activeElement?.closest(".diagram")))) throw new Error("Tab left the sheet");
  await page.mouse.click(vw.width * 0.05, vw.height * 0.9, { button: "right" });
  await Bun.sleep(200);
  if (!(await sheet.count())) throw new Error("a right-click outside closed it");
  await page.keyboard.press("Escape").catch(() => {});
  if (!(await sheet.count())) await page.locator(".note-editor .note-diagram").click();
  await sheet.waitFor();
  await page.mouse.click(vw.width * 0.05, vw.height * 0.9);
  await until("a click outside closes it", async () => (await page.locator(".diagram").count()) === 0);
  if (!(await page.locator(".doc").count())) throw new Error("the click outside reached the reader");
  // Its preview's right-click menu opens it, and takes it out of the note; ⌘Z puts it back.
  await page.locator(".note-editor .note-diagram").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Open diagram" }).click();
  await sheet.waitFor();
  // The drawing loads, then takes the keys (a slow runner's Esc can land before it has them).
  await until("the opened drawing takes the keys", () => page.evaluate(() => !!document.activeElement?.closest(".diagram .draw")));
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
  await page.getByRole("tab", { name: "Done" }).click();
  await page.locator(".row").filter({ hasText: title }).first().click();
  await page.locator(".doc-head").filter({ hasText: title }).waitFor();
}

/** Opens a new diagram from the note's / menu, in its sheet over the source, and draws a box in it. */
async function drawNew(page: Page, before?: () => Promise<void>) {
  const note = page.locator(".note-editor [contenteditable=true]").first();
  // On its first line: lower down may be a diagram already, which a click opens.
  await until("the note takes the caret", async () => (await note.click({ position: { x: 8, y: 8 } }), await note.evaluate((e) => e.contains(document.activeElement))));
  await page.keyboard.press("Meta+ArrowDown");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/diagram");
  await page.locator(".note-menu-row.on").filter({ hasText: "Diagram" }).waitFor();
  await page.keyboard.press("Enter");
  const sheet = page.locator(".diagram");
  await sheet.waitFor();
  await before?.();
  const canvas = (await sheet.locator(".draw").boundingBox())!;
  await sheet.locator(".draw").focus();
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
  // The first save is slow, and the note closes under the drawing right after (the source closes, a
  // quit; the sheet covers the tabs, so the tab is pressed from code).
  await drawNew(page, () => page.evaluate(() => void ((window as unknown as W).__ORE_SLOW = { diagram: 1500 })));
  await page.getByRole("tab", { name: "Collected" }).dispatchEvent("mousedown");
  await page.getByRole("tab", { name: "Source note" }).click();
  await until("the note links the drawing once its save is back", async () => (await drawings.count()) === 1, 8000);
  await page.evaluate(() => void ((window as unknown as W).__ORE_SLOW = undefined));
  // The next one's save fails: it is kept, and Try again saves and links it.
  await drawNew(page, () => page.evaluate(() => void ((window as unknown as W).__ORE_FAIL = { diagram: "The disk is full." })));
  await page.getByRole("tab", { name: "Collected" }).dispatchEvent("mousedown");
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
  await page.getByRole("tab", { name: "Collected" }).dispatchEvent("mousedown");
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
  await page.locator(".diagram-name").fill("not-this-name");
  await page.keyboard.press("Escape"); // throws the edit away, never renames (D211)
  await until("Esc keeps the old name", async () => (await page.locator(".diagram-name").inputValue()) === name);
  await page.waitForTimeout(300);
  if ((await board.getAttribute("aria-label")) !== `Diagram ${name}, click to edit`) throw new Error("Esc renamed the diagram");
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
  // The note is put back as it was: the drawing it leaves fills the note's middle, where the journeys after it click
  // to type (F158, F295 opened the drawing instead once this file ran on its own library).
  const item = ((await ore("ls")) as { id: string; title: string }[]).find((i) => i.title === TESTING)!.id;
  const { text: was } = (await ore("notes", item)) as { text: string };
  try {
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
    await page.locator(".diagram-scrim.full").waitFor();
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
    // A drawn box goes back to Select, as in Excalidraw (Tyler 2026-11-11); each tool shows its key against its icon.
    const boxTool = page.locator(".draw-tools").getByRole("button", { name: "Box" });
    const selectTool = page.locator(".draw-tools").getByRole("button", { name: "Select" });
    await until("drawing a box goes back to Select", async () => (await selectTool.getAttribute("aria-pressed")) === "true");
    if ((await boxTool.locator(".draw-key").textContent()) !== "R") throw new Error("the Box tool doesn't show its key");
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
  } finally {
    // Off the note first, so no save of its own lands after this one; a journey that failed with the drawing open stays there.
    await page.getByRole("button", { name: /^All sources/ }).click({ timeout: 2000 }).then(() => loaded(page), () => {});
    await ore("notes", item, `--set=${was}`);
  }
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
  await page.locator(".diagram-scrim.full").waitFor();
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
  await until("the dropped arrow is gone", async () => (await page.locator(".diagram .draw-canvas > g path").count()) === 0);
  await until("the tool is Select again", async () => (await tool()) === "Select");
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

journey("diagram: a drawn box is selected under Select, Enter right after waits for its label, the right-click menu cuts, copies and pastes, and a line near level lands level", async (page) => {
  await openSource(page, TESTING);
  const note = page.locator(".note-editor [contenteditable=true]").first();
  // An earlier journey's drawing can still be open, or open as the source loads: Done closes it first.
  await until("the note takes the caret", async () => {
    if (await page.locator(".diagram").count()) await page.locator(".diagram-done").click();
    // On the first line's words, not the middle of the note, where a diagram's preview would take the click.
    await note.locator("p", { hasText: /\w/ }).first().click({ timeout: 1000 }).catch(() => {});
    return !(await page.locator(".diagram").count()) && (await note.evaluate((e) => e.contains(document.activeElement)));
  });
  // A new line after a paragraph of words: either end of the note may already be a diagram another journey drew.
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/diagram");
  await page.locator(".note-menu-row.on").filter({ hasText: "Diagram" }).waitFor();
  await page.keyboard.press("Enter");
  const draw = page.locator(".diagram .draw");
  await draw.focus();
  const c = (await page.locator(".diagram .draw-canvas").boundingBox())!;
  const rects = page.locator(".diagram .draw-canvas > g rect");
  const tool = () => page.locator(".draw-tool[aria-pressed=true]").first().getAttribute("aria-label");
  // Drag a box, then Enter as Excalidraw starts a label: the label already open waits for the words (Tyler 2026-11-11).
  await page.keyboard.press("r");
  await page.mouse.move(c.x + 200, c.y + 150);
  await page.mouse.down();
  await page.mouse.move(c.x + 260, c.y + 190, { steps: 4 });
  await page.mouse.move(c.x + 340, c.y + 230, { steps: 4 });
  await page.mouse.up();
  await page.locator(".draw-text").waitFor();
  await page.keyboard.press("Enter");
  if (!(await page.locator(".draw-text").count())) throw new Error("Enter on a box just drawn closed its label");
  await page.keyboard.type("Concept");
  await page.keyboard.press("Enter");
  await until("the box is labelled", async () => (await page.locator(".diagram .draw-canvas > g text").allTextContents()).join("").includes("Concept"));
  await until("the tool is Select", async () => (await tool()) === "Select");
  // A click on the box picks it; it never draws a second one over it.
  await page.keyboard.press("Escape");
  await page.mouse.click(c.x + 210, c.y + 160);
  await until("the click selects the box", async () => (await page.locator(".diagram .sr-only[aria-live]").textContent()) === "Selected: Concept");
  if ((await rects.count()) !== 1) throw new Error(`a click on the drawn box made ${await rects.count()} boxes`);
  // Right-click: Copy, then Paste on empty canvas makes a second box; Cut takes one away.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.mouse.click(c.x + 210, c.y + 160, { button: "right" });
  await page.getByRole("menuitem", { name: /^Copy\b(?! style| as)/ }).click();
  await until("Copy puts the box on the clipboard", async () => (await page.evaluate(() => navigator.clipboard.readText())).includes("excalidraw/clipboard"));
  await page.mouse.click(c.x + 700, c.y + 500, { button: "right" });
  await page.getByRole("menuitem", { name: /^Paste\b(?! style)/ }).click();
  await until("Paste makes a copy", async () => (await rects.count()) === 2);
  await page.mouse.click(c.x + 210, c.y + 160, { button: "right" });
  await page.getByRole("menuitem", { name: /^Cut\b/ }).click();
  await until("Cut takes the box away", async () => (await rects.count()) === 1);
  // A line drawn 2° off level lands level, with a guide through it while the drag lasts (Tyler 2026-11-11); ⌘ draws it as is.
  const lines = page.locator(".diagram .draw-canvas > g path");
  const lineAt = async (dy: number, mod?: string) => {
    const n = await lines.count();
    await page.keyboard.press("l");
    if (mod) await page.keyboard.down(mod);
    await page.mouse.move(c.x + 200, c.y + 400);
    await page.mouse.down();
    await page.mouse.move(c.x + 300, c.y + 400 + dy / 2, { steps: 4 });
    await page.mouse.move(c.x + 400, c.y + 400 + dy, { steps: 4 });
    const guide = await page.locator(".draw-angle-guide").count();
    await page.mouse.up();
    if (mod) await page.keyboard.up(mod);
    await until("the line is drawn", async () => (await lines.count()) > n);
    if (await page.locator(".draw-angle-guide").count()) throw new Error("the angle guide stayed after the drag");
    const ys = [...((await lines.last().getAttribute("d")) ?? "").matchAll(/[ML]\s*(-?[\d.]+)[ ,](-?[\d.]+)/g)].map((m) => Number(m[2]));
    return { guide, flat: ys.length >= 2 && Math.abs(ys[0]! - ys.at(-1)!) < 0.01 };
  };
  const snapped = await lineAt(7);
  if (!snapped.guide || !snapped.flat) throw new Error(`a line 2° off level: guide ${snapped.guide}, level ${snapped.flat}`);
  const free = await lineAt(7, "Meta");
  if (free.guide || free.flat) throw new Error("⌘ still snapped the line level");
  const steep = await lineAt(40);
  if (steep.guide || steep.flat) throw new Error("a line 11° off level was snapped");
  // A double-click on a selected arrow's middle opens its label, as in Excalidraw; it no longer adds a bend there.
  await page.keyboard.press("a");
  await page.mouse.move(c.x + 560, c.y + 100);
  await page.mouse.down();
  await page.mouse.move(c.x + 710, c.y + 100, { steps: 4 });
  await page.mouse.move(c.x + 860, c.y + 100, { steps: 4 });
  await page.mouse.up();
  await until("the arrow is drawn and selected", async () => (await tool()) === "Select");
  await page.mouse.dblclick(c.x + 710, c.y + 100);
  await page.locator(".draw-text").waitFor({ timeout: 2000 }).catch(() => { throw new Error("a double-click on the arrow's middle opened no label"); });
  await page.keyboard.type("strengthens");
  await page.keyboard.press("Enter");
  await until("the arrow is labelled", async () => (await page.locator(".diagram .draw-canvas > g text").allTextContents()).join("").includes("strengthens"));
});

journey("diagram: a selected box's + makes the next linked node, and an elbow's middle drags and stays", async (page) => {
  await openSource(page, TESTING);
  const note = page.locator(".note-editor [contenteditable=true]").first();
  await until("the note takes the caret", async () => {
    if (await page.locator(".diagram").count()) await page.locator(".diagram-done").click();
    await note.locator("p", { hasText: /\w/ }).first().click({ timeout: 1000 }).catch(() => {});
    return !(await page.locator(".diagram").count()) && (await note.evaluate((e) => e.contains(document.activeElement)));
  });
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/diagram");
  await page.locator(".note-menu-row.on").filter({ hasText: "Diagram" }).waitFor();
  await page.keyboard.press("Enter");
  await page.locator(".diagram .draw").focus();
  const c = (await page.locator(".diagram .draw-canvas").boundingBox())!;
  const summary = () => page.locator(".diagram .sr-only[aria-live]").textContent();
  await page.keyboard.press("r");
  await page.mouse.click(c.x + 200, c.y + 150);
  await page.keyboard.type("Memory");
  await page.keyboard.press("Enter");
  // The + on the right of the selected box makes a linked node there, its label open (FigJam's quick create, Tyler 2026-11-11).
  const plus = page.locator('.draw-plus[data-dir="right"]');
  await plus.waitFor();
  const pb = (await plus.boundingBox())!;
  await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await page.locator(".draw-text").waitFor();
  await page.keyboard.type("Sleep");
  await page.keyboard.press("Enter");
  await until("Sleep is linked from Memory", async () => (await page.locator(".diagram .draw-canvas > g text").allTextContents()).join(" ").includes("Sleep") && (await page.locator(".diagram .draw-canvas > g path").count()) >= 1);
  if (await page.locator('.draw-plus[data-dir="left"]').count()) throw new Error("a + sits on the side the link arrives on");
  // A box drawn just under Sleep: Sleep's lower + would sit on it and take its click, so it isn't shown (Codex sweep 3).
  const sleepBox = (await page.locator(".diagram .draw-canvas > g rect").nth(1).boundingBox())!;
  await page.keyboard.press("Escape");
  await page.keyboard.press("r");
  await page.mouse.click(sleepBox.x + sleepBox.width / 2, sleepBox.y + sleepBox.height + 50);
  await page.keyboard.press("Escape");
  await page.mouse.click(sleepBox.x + 10, sleepBox.y + 10);
  await until("Sleep is selected again", async () => (await summary()) === "Selected: Sleep");
  if (await page.locator('.draw-plus[data-dir="down"]').count()) throw new Error("a + sits on the box under it");
  await page.mouse.click(sleepBox.x + sleepBox.width / 2, sleepBox.y + sleepBox.height + 50);
  await page.keyboard.press("Backspace");
  await page.mouse.click(sleepBox.x + 10, sleepBox.y + 10);
  // Move Sleep down, make the link an elbow, and drag its middle segment: it stays where it was put.
  for (let i = 0; i < 6; i++) await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press("Escape");
  const link = page.locator(".diagram .draw-canvas > g path").first();
  const lb = (await link.boundingBox())!;
  await page.mouse.click(lb.x + lb.width / 2, lb.y + lb.height / 2);
  await page.locator(".draw-style-chip").click();
  await page.locator(".draw-quick-more").click();
  await page.getByRole("button", { name: "Elbow" }).first().click();
  await page.locator(".draw-style-chip").click();
  const handle = page.locator(".draw-elbow-handle");
  await handle.waitFor();
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 - 20, hb.y + hb.height / 2, { steps: 4 });
  await page.mouse.move(hb.x + hb.width / 2 - 40, hb.y + hb.height / 2, { steps: 4 });
  await page.mouse.up();
  const moved = (await handle.boundingBox())!;
  if (Math.abs(moved.x - (hb.x - 40)) > 3) throw new Error(`the elbow's middle went back: ${hb.x} → ${moved.x}`);
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
  if (!(await page.locator(".diagram-scrim.full").count())) await page.keyboard.press("Shift+Meta+Enter");
  await page.locator(".diagram-scrim.full").waitFor();
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

journey("source note: back from time away, the note shows text added outside (F173)", async (page) => {
  await openSource(page, AGENTS);
  await page.getByRole("tab", { name: "Source note" }).click();
  const editor = page.getByRole("textbox", { name: "Source note", exact: true });
  await editor.waitFor();
  const id = (await ore("ls") as { id: string; title: string }[]).find((i) => i.title === AGENTS)!.id;
  const before = ((await ore("notes", id)) as { text: string }).text;
  try {
    await ore("notes", id, "--set", `${before}\n\nWritten by the phone.`.trimStart());
    await awayAndBack(page);
    await until("the outside words show", async () => (await editor.innerText()).includes("Written by the phone."));
  } finally {
    await ore("notes", id, "--set", before);
  }
});

journey("note: words typed just before a save that merges an outside edit comes back are kept", async (page) => {
  const made = (await fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich", "--json"], stdin: "# A note two hands write\n\nA page for its note." }) }).then((r) => r.json())) as { id: string };
  await ore("notes", made.id, "--set=Original.");
  try {
    await page.reload();
    await openSource(page, "A note two hands write");
    await page.getByRole("tab", { name: "Source note", exact: true }).click();
    const ed = page.locator(".ProseMirror").filter({ hasText: "Original." });
    await ed.waitFor();
    const n = (await ore("notes", made.id)) as { path: string; text: string };
    writeFileSync(join(LIB, n.path), `${n.text}\n\nOutside line.\n`);
    await page.evaluate(() => void ((window as unknown as Rigged).__ORE_SLOW = { notes: 1500 }));
    await ed.click();
    await page.keyboard.press("Meta+ArrowRight");
    const saving = page.waitForRequest((r) => r.url().endsWith("/ore") && (r.postData() ?? "").includes("--set"));
    await page.keyboard.type(" First edit.");
    await saving;
    await page.waitForTimeout(1380); // inside the editor's 200 ms report delay when the save comes back
    await page.keyboard.type(" LATE WORDS.");
    await page.evaluate(() => void ((window as unknown as Rigged).__ORE_SLOW = undefined));
    await until("the outside line is merged in", async () => ((await ore("notes", made.id)) as { text: string }).text.includes("Outside line."));
    await until("the late words are saved too", async () => ((await ore("notes", made.id)) as { text: string }).text.includes("LATE WORDS."), 6000);
    if (!(await page.locator(".ProseMirror").first().innerText()).includes("LATE WORDS.")) throw new Error("the late words left the page");
  } finally {
    await page.evaluate(() => void ((window as unknown as Rigged).__ORE_SLOW = undefined));
    await ore("archive", made.id).catch(() => {});
  }
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

journey("source note: after leaving, ⌘Z takes back the note's edits, not the source added before (F157)", async (page) => {
  const title = `Source with a note ${Date.now()}`;
  await page.reload();
  await page.locator(".side-item").first().waitFor(); // ⌘N before the app is up after a reload goes nowhere (F499)
  await page.keyboard.press("Meta+n");
  await page.getByRole("textbox", { name: "Link, file path or text" }).fill(`# ${title}\n\nThis source must survive undoing its note.`);
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: title, exact: true }).waitFor();
  await until("the import has settled", () => page.evaluate(() => !(window as unknown as { __ORE_PENDING: number }).__ORE_PENDING));
  const source = (await ore("ls") as { id: string; title: string }[]).find((i) => i.title === title)!;
  const note = async () => ((await ore("notes", source.id)) as { text: string }).text.trim();
  try {
    await page.getByRole("tab", { name: "Source note" }).click();
    const editor = page.getByRole("textbox", { name: "Source note", exact: true });
    await editor.click();
    await page.keyboard.type("Words I typed and then left.");
    await until("the note autosaves", async () => (await note()) === "Words I typed and then left.", 5000);
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await page.locator(".home").waitFor();
    await until("leaving has settled", () => page.evaluate(() => !(window as unknown as { __ORE_PENDING: number }).__ORE_PENDING));
    await page.keyboard.press("Meta+z");
    await until("⌘Z takes back the note's edits", async () => (await note()) === "");
    const archived = await ore("ls", "--archived") as { id: string }[];
    if (archived.some((i) => i.id === source.id)) throw new Error("⌘Z archived the source instead of taking back its note");
    await page.keyboard.press("Meta+Shift+z");
    await until("⇧⌘Z puts them back", async () => (await note()) === "Words I typed and then left.");
  } finally {
    await ore("archive", source.id);
  }
});

journey("⌘K from a source's note: the next source opens with the keys in its reader, not its note (F158)", async (page) => {
  await page.keyboard.press("Meta+k");
  await page.keyboard.type(TESTING);
  await page.getByRole("option", { name: new RegExp(TESTING.slice(0, 20)) }).first().waitFor();
  await page.keyboard.press("Enter");
  await page.locator(".doc-head").filter({ hasText: TESTING }).waitFor();
  await page.getByRole("tab", { name: "Source note" }).click();
  const editor = page.getByRole("textbox", { name: "Source note", exact: true });
  await editor.click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Meta+k");
  await page.keyboard.type(AGENTS);
  await page.getByRole("option", { name: new RegExp(AGENTS) }).first().waitFor();
  // The Mac opens the next source's note within the editor's 500 ms handoff (a remount of the same note keeps
  // its caret); the mock is slower, so its clock stands still until the new note is there.
  await page.evaluate(() => {
    const real = performance.now.bind(performance);
    const at = real();
    const w = window as unknown as { __thaw: () => void };
    let still = true;
    performance.now = () => (still ? at : real());
    w.__thaw = () => void (still = false);
  });
  await page.keyboard.press("Enter");
  await page.locator(".doc-head").filter({ hasText: AGENTS }).waitFor();
  await page.locator(".note-editor .ProseMirror").waitFor();
  await page.waitForTimeout(300);
  await page.evaluate(() => (window as unknown as { __thaw: () => void }).__thaw());
  const item = (await ore("ls") as { id: string; title: string }[]).find((i) => i.title === AGENTS)!;
  const before = ((await ore("notes", item.id)) as { text: string }).text;
  const seen: string[] = [];
  for (let i = 0; i < 12; i++) {
    seen.push(String(await page.evaluate(() => { const a = document.activeElement as HTMLElement | null; return a?.getAttribute("aria-label") ?? a?.className ?? a?.tagName; })));
    await page.waitForTimeout(200);
  }
  if (seen.includes("Source note")) throw new Error(`the keys went to the new source's note: ${seen.join(", ")}`);
  await page.keyboard.press("]");
  await page.waitForTimeout(1200);
  const after = ((await ore("notes", item.id)) as { text: string }).text;
  if (after !== before) throw new Error(`a reader key was typed into the note: ${JSON.stringify(after)}`);
}, "webkit");

journey("notes: closing a pane and remounting a skill keep pending words (F143)", async (page) => {
  await openSource(page, AGENTS);
  const editor = page.getByRole("textbox", { name: "Source note", exact: true });
  await editor.fill("Words written just before closing the note pane.");
  await page.getByRole("tab", { name: "Collected", exact: true }).click();
  await page.getByRole("tab", { name: "Source note", exact: true }).click();
  await until("closing the pane keeps the last words", async () => (await editor.innerText()).includes("Words written just before closing"));
  const name = `Pending skill note ${Date.now()}`;
  const skill = await ore("skills", "add", name) as { id: string };
  try {
    await page.reload();
    const nav = page.getByRole("navigation", { name: "Skills" }).getByRole("button", { name, exact: true });
    await nav.click();
    const note = page.getByRole("textbox", { name: "Skill note", exact: true });
    await note.waitFor();
    await hold(page, "notes");
    await note.fill("The next editor must wait for this skill note.");
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await until("the skill note is held", () => isHeld(page, "notes"));
    await nav.click();
    await release(page, "notes");
    await until("the skill note loads after its pending save", async () => (await note.innerText()).includes("The next editor must wait"));
  } finally {
    await release(page, "notes");
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await ore("skills", "rm", skill.id);
  }
});

journey("source note: the format bar shows whole in the side panel, reaching over the page when the panel is narrower than it (F295)", async (page) => {
  // The note is put back as it was whatever happens here: a later journey searches its words (F336), and a ⌘Z
  // takes back only the last run of typing, which on a slow runner was not all of it (CI, F395).
  const item = ((await ore("ls")) as { id: string; title: string }[]).find((i) => i.title === TESTING)!.id;
  const { text: was } = (await ore("notes", item)) as { text: string };
  try {
    await openSource(page, TESTING);
    const pm = page.locator(".mynotes .note-editor .ProseMirror").first();
    await pm.click();
    await page.keyboard.press("Meta+a");
    await page.keyboard.type("## Recall beats rereading every time");
    // The line is a heading first: a Shift+Home pressed while "## " was still being turned into one selected
    // nothing on a slow runner, and the bar never came (master red after #508, F529).
    await pm.locator("h2", { hasText: "Recall beats rereading every time" }).waitFor();
    const bar = page.locator(".sel-bar");
    await until("the bar shows for the selected line", async () => {
      if (await bar.isVisible()) return true;
      await page.keyboard.press("End");
      await page.keyboard.press("Shift+Home");
      return bar.isVisible();
    });
    await until("every part of the bar is in sight", () => bar.evaluate((el) => {
      const b = el.getBoundingClientRect();
      if (b.left < 0 || b.right > innerWidth) return false;
      // What is drawn at the bar's two ends is the bar itself, not a panel over it.
      return [b.left + 3, b.right - 3].every((x) => el.contains(document.elementFromPoint(x, b.top + b.height / 2)));
    }));
  } finally {
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /^All sources/ }).click();
    await loaded(page);
    await ore("notes", item, `--set=${was}`);
  }
});

journey("note / menu: its blocks sit under Text, Toggles, Insert and Link with a picture each, it is never taller than ten rows, and a search lists matches flat (D303)", async (page) => {
  const pm = page.locator(".note-editor .ProseMirror").first();
  const menu = page.locator(".note-menu");
  await openSource(page, AGENTS);
  await pm.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await page.keyboard.type("/", { delay: 20 });
  await menu.waitFor();
  const heads = await menu.locator(".note-menu-head").allInnerTexts();
  if (heads.join() !== "Text,Toggles,Insert,Link") throw new Error(`the groups are ${heads.join()}`);
  const bare = await menu.locator(".note-menu-row").evaluateAll((rows) => rows.filter((r) => !r.querySelector("svg")).map((r) => r.textContent));
  if (bare.length) throw new Error(`no picture on ${bare.join(", ")}`);
  const size = await menu.evaluate((el) => ({ shown: el.getBoundingClientRect().height, all: el.scrollHeight }));
  if (size.shown > 345 || size.all <= size.shown) throw new Error(`the menu is ${size.shown}px tall over ${size.all}px of rows: it should stop at 344 and scroll`);
  // The arrows keep the highlighted block in sight as the list scrolls under it.
  for (let i = 0; i < 15; i++) await page.keyboard.press("ArrowDown");
  await until("the highlighted block is inside the menu", () => menu.evaluate((el) => {
    const on = el.querySelector(".note-menu-row.on")?.getBoundingClientRect(), box = el.getBoundingClientRect();
    return !!on && on.top >= box.top - 1 && on.bottom <= box.bottom + 1;
  }));
  await page.keyboard.type("div", { delay: 20 });
  await until("a search lists its matches with no group names", async () => (await menu.locator(".note-menu-head").count()) === 0 && (await menu.locator(".note-menu-row").count()) === 1);
  await page.keyboard.press("Escape");
  for (let i = 0; i < 4; i++) await page.keyboard.press("Backspace");
});

journey("note: /to-do keeps the block menu open on To-do list, and Enter makes one (F435)", async (page) => {
  const pm = page.locator(".note-editor .ProseMirror").first();
  await openSource(page, AGENTS);
  await pm.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await until("the note is empty", async () => ((await pm.textContent()) ?? "").trim() === "");
  await page.keyboard.type("/to-do", { delay: 20 });
  await page.locator(".note-menu-row.on", { hasText: "To-do list" }).waitFor();
  await page.keyboard.press("Enter");
  await page.keyboard.type("Buy chalk");
  await until("a to-do with no slash left", async () => (await pm.locator("li", { hasText: "Buy chalk" }).count()) === 1 && !/\/to/.test((await pm.textContent()) ?? ""));
  // A word with a mark that no block answers is prose again.
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("in /usr-local", { delay: 20 });
  await until("no menu once nothing answers", async () => (await page.locator(".note-menu").count()) === 0);
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
});

journey("note: ↓ at the end of a code block that ends the note makes a line under it (F434)", async (page) => {
  const pm = page.locator(".note-editor .ProseMirror").first();
  await openSource(page, AGENTS);
  await pm.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await until("the note is empty", async () => ((await pm.textContent()) ?? "").trim() === "");
  await page.keyboard.type("/code", { delay: 20 });
  await page.locator(".note-menu-row.on", { hasText: "Code" }).waitFor();
  await page.keyboard.press("Enter");
  await page.keyboard.type("x = 1");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.type("after");
  await until("the words land under the block", async () => (await pm.locator("pre").textContent())?.trim() === "x = 1" && (await pm.locator("p", { hasText: "after" }).count()) === 1);
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
});

journey("source note: a new table fits the side panel, its three columns whole (F440)", async (page) => {
  const pm = page.locator(".note-editor .ProseMirror").first();
  await openSource(page, AGENTS);
  await pm.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await until("the note is empty", async () => ((await pm.textContent()) ?? "").trim() === "");
  await page.keyboard.type("/table");
  await page.locator(".note-menu-row.on", { hasText: "Table" }).waitFor();
  await page.keyboard.press("Enter");
  const box = page.locator(".note-editor .note-table");
  await box.waitFor();
  const over = await box.evaluate((e) => e.scrollWidth - e.clientWidth);
  if (over > 1) throw new Error(`the new table is ${over}px wider than the panel`);
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
});

journey("note table: its controls let go when the table is deleted under them, and the / menu scrolling after throws nothing (F650)", async (page) => {
  const thrown: string[] = [];
  const onError = (e: Error) => void thrown.push(e.message);
  page.on("pageerror", onError);
  try {
  const pm = page.locator(".note-editor .ProseMirror").first();
  await openSource(page, AGENTS);
  await pm.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await until("the note is empty", async () => ((await pm.textContent()) ?? "").trim() === "");
  // Two lines, then a table, so the table sits well into the note.
  await page.keyboard.type("A first line of the note.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/table");
  await page.locator(".note-menu-row.on", { hasText: "Table" }).waitFor();
  await page.keyboard.press("Enter");
  const cell = page.locator(".note-editor .note-table td, .note-editor .note-table th").first();
  await cell.waitFor();
  // The pointer rests on a cell: the table's + and ⋮⋮ show, holding where the table is.
  await cell.hover();
  await page.locator(".table-ctl").first().waitFor();
  // The table goes from under them (the pointer has not moved), and the / menu's list scrolls inside the note.
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.press("Backspace");
  await until("the note is empty", async () => ((await pm.textContent()) ?? "").trim() === "");
  // A press on a control still drawn over the empty note lets go of them instead of asking for the table.
  const bar = page.locator(".table-ctl button").first();
  if (await bar.count()) await bar.click({ force: true }).catch(() => {});
  await page.keyboard.type("/", { delay: 20 });
  await page.locator(".note-menu").waitFor();
  for (let i = 0; i < 15; i++) await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(200);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Backspace");
  } finally {
    page.off("pageerror", onError);
  }
  if (thrown.length) throw new Error(`the page threw: ${thrown[0]}`);
  if (await page.locator(".table-ctl").count()) throw new Error("the table's controls still show with no table");
});
