import { type Locator } from "playwright";
import { join } from "node:path";
import { AGENTS, BRIDGE, failNext, foundOnScreen, hasCaret, inLibrary, isHeld, journey, LIB, openSource, ore, pickWithKeys, release, searchPick, select, settled, startReview, TESTING, textFile, until, typeFact } from "../harness";

journey("a sheet opened in the same moment as All sources keeps the keys: the list behind never takes them (F64)", async (page) => {
  // F64: the list takes the keys a frame after All sources is chosen. ⌘R inside that frame opened What to review, then
  // the list behind it took focus back, so ↵ never started the review (CI's release check met it now and then).
  // Settings stands for any sheet here: it opens whatever is due.
  await page.getByRole("button", { name: /^Home/ }).first().click();
  const all = page.getByRole("button", { name: /^All sources/ });
  await all.waitFor();
  await all.evaluate((b: HTMLElement) => {
    b.click();
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: ",", code: "Comma", metaKey: true, bubbles: true, cancelable: true }));
  });
  await page.locator(".settings-sheet").waitFor();
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  if (!(await page.evaluate(() => !!document.activeElement?.closest(".settings-sheet")))) throw new Error("the list behind Settings took the keys");
  await page.keyboard.press("Escape");
  await page.locator(".settings-sheet").waitFor({ state: "detached" });
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

journey("⌘K → All sources from Home puts focus on the list, so ↓ and ↵ work at once (as Feed and a skill page do)", async (page) => {
  await page.keyboard.press("Meta+k");
  await page.keyboard.type("All sources");
  await page.locator("[cmdk-item]").filter({ hasText: /^All sources/ }).first().waitFor();
  await page.keyboard.press("Enter");
  await page.locator("main [role=grid]").waitFor();
  await until("the list has focus", () => page.evaluate(() => !!document.activeElement?.closest("main .list")));
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.locator(".doc-head").waitFor();
});

// ChatGPT's menus (Tyler 2026-11-12): each item has its icon at the left, and its groups are split by thin lines.
journey("menus: every item of a source's right-click and ⋯ menu has an icon, its groups split by lines", async (page) => {
  const check = async (what: string) => {
    const menu = page.getByRole("menu").first();
    await menu.waitFor();
    const items = menu.locator(":scope > [role=menuitem], :scope > [role=menuitemcheckbox]");
    const n = await items.count();
    const drawn = await menu.locator(":scope > [role=menuitem] > .menu-icon > svg, :scope > [role=menuitemcheckbox] > .menu-icon > svg").count();
    if (!n || drawn !== n) throw new Error(`${what}: ${drawn} of ${n} items have an icon`);
    if ((await menu.locator(":scope > [role=separator]").count()) < 2) throw new Error(`${what}: its items are not grouped`);
    await page.keyboard.press("Escape");
  };
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.locator(".row").filter({ hasText: TESTING }).first().click({ button: "right" });
  await check("a row's right-click");
  await openSource(page, TESTING);
  await page.getByRole("button", { name: "Source actions" }).first().click();
  await check("the reader's ⋯");
  // A submenu of things with their own mark draws them: a highlight's Type shows each type's mark.
  await page.getByRole("tab", { name: "Collected" }).click();
  await page.locator(".cp-line[data-menu-row]").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Type" }).hover();
  await page.keyboard.press("ArrowRight");
  const sub = page.locator(".menu-sub");
  await sub.waitFor();
  const types = await sub.locator("[role=menuitemcheckbox]").count();
  const marked = await sub.locator("[role=menuitemcheckbox] > .menu-mark").count();
  if (!types || marked !== types) throw new Error(`a highlight's Type submenu: ${marked} of ${types} types have their mark`);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
});

journey("menus: a letter typed to pick a right-click menu item never types into the note selected behind it (WebKit)", async (page) => {
  // Codex UX sweep 15: Review was guarded (sweep 14), but a right-click menu was not: E, to reach Edit skill…, replaced
  // the selected skill note with "e" and saved it. Typing goes only where the focus is, app-wide.
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  const pm = page.locator(".skill-note .ProseMirror");
  await pm.waitFor();
  await pm.click();
  const line = `Kept through a menu (${Date.now() % 100000})`;
  await page.keyboard.press("Meta+ArrowDown");
  await page.keyboard.type(line);
  await until("the line is in the note", async () => ((await pm.textContent()) ?? "").includes(line));
  await page.keyboard.press("Meta+a");
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click({ button: "right" });
  await page.locator(".menu-list").first().waitFor();
  await page.keyboard.press("e");
  await page.keyboard.press("x");
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  const now = (await pm.textContent()) ?? "";
  if (!now.includes(line)) throw new Error(`the note behind the menu changed: ${JSON.stringify(now.slice(0, 80))}`);
}, "webkit");

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

// Tyler, 2026-11-20: ⌘K's New skill… filed the skill under the collection of the page he was on.
journey("⌘K: New skill… opens the sidebar's name field at the top, in no collection, with the caret in it", async (page) => {
  await page.keyboard.press("Meta+k");
  await page.keyboard.type("New skill");
  await page.keyboard.press("Enter");
  const name = '[aria-label="New skill name"]';
  await until("the new skill field has the caret", () => hasCaret(page, name));
  const first = page.locator(".sidebar .side-section").first();
  if ((await first.getAttribute("aria-label")) !== "Other") throw new Error("the skills in no collection are not at the top");
  await first.locator(name).waitFor();
  if (await page.getByRole("dialog", { name: "Command palette" }).count()) throw new Error("the palette stayed open");
  await page.keyboard.press("Escape");
});

journey("⌘K: New collection… clicked with the pointer puts the caret in its name field (Codex UX sweep)", async (page) => {
  await page.keyboard.press("Meta+k");
  await page.keyboard.type("New collection");
  await page.getByRole("option", { name: "New collection…" }).click();
  await until("the name field has the caret", () => page.getByRole("dialog", { name: "Command palette" }).locator("input").evaluate((e) => e === document.activeElement).catch(() => false));
  await page.keyboard.type("Research A");
  const v = await page.getByRole("dialog", { name: "Command palette" }).locator("input").inputValue();
  if (v !== "Research A") throw new Error(`typed into nothing: the field holds "${v}"`);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
});

// F334: at 150% in an 800×600 window (533×400 CSS px) ⌘K ran below the window: its last
// rows and its footer couldn't be reached, and End picked a row out of sight.
journey("a small window: ⌘K, the Add box and the shortcuts sheet fit in it, and End shows the palette's last row", async (page) => {
  // The skills are in before the palette opens: opened a moment after a reload it listed commands only, End took
  // the last of those, and the skills then arrived below it (F456).
  await page.locator(".sidebar div.side-item").first().waitFor({ state: "attached" });
  await page.setViewportSize({ width: 533, height: 400 });
  const inWindow = async (what: string, l: Locator) => {
    const b = (await l.boundingBox())!;
    if (b.y < 0 || b.y + b.height > 400 + 0.5) throw new Error(`${what} runs from y=${Math.round(b.y)} to ${Math.round(b.y + b.height)} in a 400px window`);
  };
  try {
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await page.keyboard.press("Meta+k");
    await palette.waitFor();
    await inWindow("the palette", palette.locator(".panel"));
    await inWindow("the palette's footer", palette.locator(".panel-foot"));
    await page.keyboard.press("End");
    const last = palette.locator("[cmdk-item]").last();
    await until("End selects the last row", async () => (await last.getAttribute("aria-selected")) === "true");
    await until("the last row is in the window", async () => inWindow("the palette's last row", last).then(() => true, () => false));
    // …at the list's end, so it isn't faded as if more waited below it.
    await until("the list is at its end", async () => (await palette.locator("[cmdk-list]").getAttribute("data-more")) === null);
    await page.keyboard.press("Escape");
    await palette.waitFor({ state: "detached" });
    await page.keyboard.press("Meta+Slash");
    const sheet = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await sheet.waitFor();
    await inWindow("the shortcuts sheet", sheet);
    await page.keyboard.press("Escape");
    await sheet.waitFor({ state: "detached" });
    await page.getByRole("button", { name: "+ Add" }).click();
    const add = page.getByRole("dialog", { name: "Add a source", exact: true });
    await add.getByLabel("Link, file path or text").fill(Array.from({ length: 40 }, (_, i) => `Line ${i + 1}`).join("\n"));
    await inWindow("the Add box", add);
    await inWindow("the Add box's footer", add.locator(".panel-foot"));
    await page.keyboard.press("Escape");
    await add.waitFor({ state: "detached" });
  } finally {
    await page.setViewportSize({ width: 1280, height: 800 });
  }
});

// F558: typing in ⌘K left its list scrolled down, so the top results (⌘1, ⌘2) were out of
// sight above it: for one paint cmdk still held the row picked before the keystroke and scrolled it into view.
journey("⌘K: typing keeps the list at its top, with the first result selected and in sight (F558)", async (page) => {
  await page.locator(".sidebar div.side-item").first().waitFor({ state: "attached" });
  // A short window, so the rows run past the list's foot and a wrong scroll shows.
  await page.setViewportSize({ width: 800, height: 400 });
  try {
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await page.keyboard.press("Meta+k");
    await palette.waitFor();
    const list = palette.locator("[cmdk-list]");
    for (const key of ["a", "i"]) {
      await page.keyboard.type(key);
      await page.waitForTimeout(400); // past the text search's wait, so its rows have come in too
      const at = await list.evaluate((l) => ({ top: l.scrollTop, first: l.querySelector("[cmdk-item]")?.getAttribute("aria-selected") }));
      if (at.first !== "true") throw new Error(`after typing "${key}" the first row is not selected`);
      if (at.top > 0) throw new Error(`after typing "${key}" the list is scrolled ${at.top}px down, hiding its top rows`);
    }
    await page.keyboard.press("Escape"); // clears what he typed
    await page.keyboard.press("Escape");
    await palette.waitFor({ state: "detached" });
  } finally {
    await page.setViewportSize({ width: 1280, height: 800 });
  }
});

journey("⌘K is the same whatever row is selected: it follows what is open, never the selection (D178)", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  const named = () => page.locator("[cmdk-item]").filter({ hasText: /^(Archive|Rename|Pin to top|Copy|File|Remove|Move) (“|\d+ sources)/ }).count();
  const look = async (query: string) => {
    await page.keyboard.press("Meta+k");
    await page.locator("[cmdk-input]").fill(query);
    await page.waitForTimeout(250);
    const n = await named();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    return n;
  };
  await page.locator(".list").focus();
  await page.keyboard.press("ArrowDown");
  if (await look("archive")) throw new Error("⌘K offers actions named for the row the arrow keys selected");
  const rows = page.locator(".row");
  await rows.nth(0).click({ modifiers: ["Meta"] });
  await rows.nth(1).click({ modifiers: ["Meta"] });
  if (await look("archive")) throw new Error("⌘K offers actions for the selected sources");
  await page.keyboard.press("Escape");
  // An open source still brings its own actions.
  await openSource(page, AGENTS);
  await page.keyboard.press("Meta+k");
  await page.locator("[cmdk-input]").fill("archive source");
  await page.locator("[cmdk-item]", { hasText: "Archive source" }).first().waitFor();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
});

journey("⌘K: Esc clears what was typed first, then closes", async (page) => {
  await page.keyboard.press("Meta+k");
  const input = page.locator("[cmdk-input]");
  await input.fill("review");
  // The footer says what the next Esc does (Codex UX sweep 13: it said Close while a query was there to clear).
  const esc = page.locator("[cmdk-root] .panel-foot span:has(> kbd:text-is('Esc'))");
  await until("the footer says Esc clears", async () => (await esc.innerText()).trim() === "Esc Clear");
  await page.keyboard.press("Escape");
  await until("the query is cleared and ⌘K stays open", async () => (await input.count()) === 1 && (await input.inputValue()) === "");
  await until("the footer says Esc closes", async () => (await esc.innerText()).trim() === "Esc Close");
  await page.keyboard.press("Escape");
  await until("a second Esc closes it", async () => (await input.count()) === 0);
});

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
  await page.locator(".find-bar input").waitFor();
  await page.keyboard.press("Escape");
  await until("Esc gives focus back to the note it searched", () => page.evaluate(() => !!document.activeElement?.closest(".skill-note")));
});

journey("focus comes back to what opened it: the tutor's ✦ after Esc, and a Continue reading row after Esc from its source", async (page) => {
  const on = (sel: string) => page.evaluate((sel) => !!document.activeElement?.matches(sel), sel);
  await page.locator(".tutor-bubble").focus();
  await page.keyboard.press("Enter");
  await page.locator(".tutor textarea, .tutor [contenteditable=true]").first().waitFor();
  await page.keyboard.press("Escape");
  await until("focus is back on the ✦", () => on(".tutor-bubble"));
  const row = page.locator(".home-read").first();
  await row.locator(".home-open").focus();
  const title = (await row.innerText()).split("\n")[0]!;
  await page.keyboard.press("Enter");
  await page.locator(".doc").waitFor();
  await page.keyboard.press("Escape");
  await page.locator(".home-read").first().waitFor();
  await until(`focus is back on “${title}”`, async () => (await on(".home-read .home-open")) && (await page.evaluate(() => (document.activeElement as HTMLElement).innerText.split("\n")[0])) === title);
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
  await page.locator("textarea.skill-goal").waitFor();
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
  await inLibrary(page, [AGENTS]);
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
  await until("nothing is left on the page", async () => (await left()) === 0, 2000);
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

// F136
journey("⌘K opens without the ambience channels; typing one's name finds it (D254)", async (page) => {
  await page.keyboard.press("Meta+KeyK");
  const rows = page.locator("[cmdk-item]");
  await rows.filter({ hasText: "Ambience…" }).waitFor();
  const plays = await rows.filter({ hasText: /^Play / }).allInnerTexts();
  if (plays.length) throw new Error(`⌘K opened on ${plays.join(", ")}`);
  await page.keyboard.type("rain");
  await rows.filter({ hasText: "Play Rain" }).waitFor();
  await page.keyboard.press("Escape"); // clears what he typed
  await page.keyboard.press("Escape");
  await rows.first().waitFor({ state: "detached" });
});

journey("a popover closes on any click outside it, even after a press inside it or on a control that stops the event", async (page) => {
  await page.waitForLoadState("networkidle"); // the source the last journey left open has reopened
  await page.getByRole("button", { name: /^All sources/ }).click();
  // As in WebKit: a click moves no focus, so the popover's close-on-focus-loss can't hide a missed click.
  await page.addScriptTag({ content: `document.addEventListener("mousedown", (e) => e.preventDefault(), true)` });
  // The picker opens on the last row, below the first, so the first row's controls stay uncovered.
  const skills = page.locator(".row").getByRole("button", { name: /^Skills for / });
  const picker = page.locator(".skill-picker");
  const open = async () => {
    await skills.last().click();
    await picker.waitFor();
  };
  const closed = async (where: string) => {
    await picker.waitFor({ state: "detached", timeout: 1500 }).catch(() => {
      throw new Error(`the skill picker stayed open after a click ${where}`);
    });
  };
  // A press inside first: it must not eat the next click outside.
  await open();
  await picker.getByPlaceholder("Find or create a skill…").click();
  await page.mouse.click(1100, 790);
  await closed("on empty space, after a press inside it");
  // A control that keeps its press from dragging the row.
  await open();
  await skills.first().click();
  await until("one skill picker open", async () => (await page.locator(".skill-picker[data-state=open]").count()) === 1);
  await page.keyboard.press("Escape");
  await closed("on another row's skills (it opens that row's)");
  await open();
  const row = page.locator(".row").first();
  await row.hover();
  await row.getByRole("button", { name: /^Actions for / }).click();
  await closed("on another row's ⋯ menu");
  await page.keyboard.press("Escape");
  // A control that stops its click.
  await open();
  await page.locator(".side-head-tools").getByRole("button", { name: /^Actions for / }).first().click({ force: true });
  await closed("on a sidebar ⋯ (it stops its click)");
  await page.keyboard.press("Escape");
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
    // After the ⌘Z's own write: archived alongside it, the two raced and the source could stay out for the next journeys.
    // A call that never answers is named by the check as the journey ends; the archive runs anyway.
    await settled(page).catch(() => {});
    await ore("archive", made.id);
  }
});

journey("resize drags: Esc mid-drag puts the size back and stays on the page; nothing is left stuck after", async (page) => {
  const { createItem } = (await import(join(import.meta.dir, "../../../../packages/core/src/index.ts"))) as { createItem: (lib: { root: string }, d: object) => Promise<{ meta: { id: string } }> };
  const made = await createItem({ root: LIB }, { type: "youtube", title: "A talk on spacing", url: "https://www.youtube.com/watch?v=spacingTalk1", body: "[00:00] Spacing works.\n\n[00:30] Test yourself after a pause.", source: { ext: "vtt", data: "WEBVTT\n\n00:00:00.000 --> 00:00:30.000\nSpacing works.\n\n00:00:30.000 --> 00:01:00.000\nTest yourself after a pause.\n" } });
  try {
    await page.reload();
    await openSource(page, "A talk on spacing");
    const edge = page.locator(".video-edge.right");
    await edge.waitFor();
    const frame = page.locator(".video-frame");
    const w0 = (await frame.boundingBox())!.width;
    const at = (await edge.boundingBox())!;
    await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
    await page.mouse.down();
    await page.mouse.move(at.x - 90, at.y + at.height / 2, { steps: 4 });
    await until("the drag resizes the video", async () => Math.abs((await frame.boundingBox())!.width - w0) > 40);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    if (!(await page.locator(".doc-head h1").count())) throw new Error("Esc during the drag left the source");
    await until("Esc puts the width back", async () => Math.abs((await frame.boundingBox())!.width - w0) < 2);
    if (await page.evaluate(() => document.body.classList.contains("resizing"))) throw new Error("the page is still in its resizing state (no text can be selected)");
    // The note's divider, the same way.
    await page.getByRole("tab", { name: "Source note" }).click().catch(() => {});
    const divider = page.getByRole("separator", { name: /Resize/ }).filter({ visible: true }).last();
    const d = (await divider.boundingBox())!;
    const col = () => page.evaluate(() => document.querySelector<HTMLElement>(".doc-head")!.getBoundingClientRect().width);
    const c0 = await col();
    await page.mouse.move(d.x + d.width / 2, d.y + 200);
    await page.mouse.down();
    await page.mouse.move(d.x - 120, d.y + 200, { steps: 4 });
    await page.keyboard.press("Escape");
    await page.mouse.up();
    if (!(await page.locator(".doc-head h1").count())) throw new Error("Esc during the divider drag left the source");
    await until("Esc puts the divider back", async () => Math.abs((await col()) - c0) < 2);
  } finally {
    await ore("archive", made.meta.id).catch(() => {});
  }
});

journey("undo that fails, quiet step: a rename's failed ⌘Z stays on the history, so the next ⌘Z takes it back", async (page) => {
  const fail = (why: string | null) => page.evaluate((why) => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = why ? { edit: why } : {}), why);
  await openSource(page, AGENTS);
  const title = () => page.locator(".doc-head h1").innerText();
  await page.locator(".doc-head h1").click();
  await page.getByLabel("Title").fill("Agents, retitled");
  await page.keyboard.press("Enter");
  await until("Enter saves it", async () => (await title()) === "Agents, retitled");
  await page.waitForTimeout(300);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await fail("The library is read-only.");
  await page.keyboard.press("Meta+z");
  await page.locator(".toast").filter({ hasText: "Couldn’t undo" }).filter({ hasText: "The library is read-only." }).waitFor();
  await until("the failed undo leaves the new title", async () => (await title()) === "Agents, retitled");
  await fail(null);
  await page.keyboard.press("Meta+z");
  await until("⌘Z again takes it back", async () => (await title()) === AGENTS);
});

journey("a11y: a row is one control with its actions beside it (axe nested-interactive), and the sidebar is one Tab stop", async (page) => {
  // axe-core (MPL-2.0) runs in the page on the rules a row's shape can break: a button inside a button or an
  // option, and a grid's rows and cells. The whole app under every rule is another pass (keyboard-a11y memo).
  const rules = ["nested-interactive", "aria-required-children", "aria-required-parent", "aria-allowed-attr", "aria-allowed-role"];
  await page.addScriptTag({ path: join(import.meta.dir, "../../../../node_modules/axe-core/axe.min.js") });
  const check = async (where: string) => {
    const bad = await page.evaluate(async (rules) => {
      const r = await (window as unknown as { axe: { run: (c: Element, o: unknown) => Promise<{ violations: { id: string; nodes: { target: string[]; failureSummary: string; any: { relatedNodes: { html: string }[] }[] }[] }[] }> } }).axe.run(document.body, { runOnly: rules });
      return r.violations.flatMap((v) => v.nodes.map((n) => `${v.id} ${n.target.join(" ")} (${n.failureSummary.replace(/\s+/g, " ")}: ${n.any.flatMap((a) => a.relatedNodes.map((r) => r.html.slice(0, 120))).join(" | ")})`));
    }, rules);
    if (bad.length) throw new Error(`${where}: ${bad.length} axe findings: ${bad.slice(0, 4).join("; ")}`);
  };
  await openSource(page, TESTING);
  await page.getByRole("button", { name: /^Home/ }).click();
  await page.locator(".home-read").first().waitFor();
  await page.locator(".home-skill").first().waitFor();
  await check("Home");
  // The whole row still opens on a click: on its picture, not only its title.
  const read = page.locator(".home-read").first();
  const r = (await read.boundingBox())!;
  await page.mouse.click(r.x + 40, r.y + r.height / 2);
  await page.locator(".reader-scroll").waitFor();
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.locator(".list .row").first().waitFor();
  await check("All sources");
  // An empty grid (nothing matches) is still a grid.
  await page.getByRole("searchbox").or(page.locator(".filter input")).first().fill("zzzz-nothing");
  await page.locator(".list .empty-state").waitFor();
  await check("All sources, empty");
  await page.getByRole("searchbox").or(page.locator(".filter input")).first().fill("");
  // One Tab stop: Tab from inside the sidebar leaves it, ⇧Tab comes back to the item he left, ↑↓ move
  // between its items, → reaches a row's own ⋯ and + tools, ← comes back (VS Code's tree, Finder's sidebar).
  const focused = () => page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return { inSide: !!el?.closest(".sidebar"), label: el?.getAttribute("aria-label") ?? el?.textContent?.trim() ?? "", skill: !!el?.matches(".side-item > .side-main") };
  });
  await page.locator(".sidebar .side-item").first().focus();
  await page.keyboard.press("Tab");
  if ((await focused()).inSide) throw new Error(`Tab inside the sidebar stopped on another of its items: ${(await focused()).label}`);
  await page.keyboard.press("Shift+Tab");
  await until("⇧Tab comes back to the item he left", async () => (await focused()).label === "Home");
  await page.keyboard.press("ArrowDown");
  await until("↓ moves to the next item", async () => (await focused()).label === "Feed");
  // Down to a skill's row, then → to its ⋯.
  for (let n = 0; n < 12 && !(await focused()).skill; n++) await page.keyboard.press("ArrowDown");
  const skill = (await focused()).label;
  await page.keyboard.press("ArrowRight");
  await until("→ reaches the skill's ⋯", async () => (await focused()).label === `Actions for ${skill}`);
  await page.keyboard.press("ArrowLeft");
  await until("← comes back to the skill", async () => (await focused()).label === skill);
  await page.keyboard.press("Tab");
  if ((await focused()).inSide) throw new Error("Tab after the arrows stayed in the sidebar");
});

journey("a11y: reader equations expose mathematical content (F110)", async (page) => {
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill("# Accessible equation\n\nThe relation is\n\n$$E = mc^2$$\n\nEnergy and mass.");
  await page.keyboard.press("Enter");
  await page.locator(".doc .katex").waitFor();
  const tree = await page.locator(".doc").ariaSnapshot();
  if (!tree.includes("math") || !(await page.locator(".doc math").count())) throw new Error(`Equation missing from accessibility tree: ${tree}`);
  if (!(await page.locator(".doc math").textContent())?.includes("E")) throw new Error("Equation lost its content");
});

journey("a11y: failed Add announces and describes the retained input (F112)", async (page) => {
  await page.getByRole("button", { name: "+ Add" }).click();
  const input = page.getByLabel("Link, file path or text");
  const text = "# Unsaved learning note\n\nKeep these words after a failed save.";
  await input.fill(text);
  await failNext(page, "add", "The disk is full. Free space and try again.");
  await page.keyboard.press("Enter");
  const error = page.locator(".add-box .err");
  await error.waitFor();
  if (!(await page.locator(".add-box").ariaSnapshot()).includes("alert:")) throw new Error("Add error is not announced as an alert");
  if ((await input.getAttribute("aria-describedby")) !== await error.getAttribute("id") || !(await error.getAttribute("id"))) throw new Error("Add error does not describe the input");
  if ((await input.inputValue()) !== text || !(await input.evaluate((e) => e === document.activeElement))) throw new Error("Failure lost input or focus");
  await input.fill(text + " More.");
  if (await input.getAttribute("aria-describedby")) throw new Error("Cleared error still describes the input");
  await failNext(page, "add", null);
  await page.keyboard.press("Escape");
});

journey("a11y: revealing a Fact announces its answer and rating phase (F113)", async (page) => {
  await startReview(page, /Learning/);
  await page.locator(".quiz-sure").waitFor();
  const live = page.locator(".review .sr-only[aria-live]");
  const before = await live.innerText();
  await typeFact(page, undefined, "Sure");
  const answer = page.locator(".review-answer");
  await answer.waitFor();
  const said = await live.innerText();
  if (said === before || !said.includes((await answer.innerText()).trim()) || !said.includes("Rate your recall")) throw new Error(`Answer not announced: ${said}`);
  await page.keyboard.press("Escape");
});

journey("a11y: gem counts say their meaning and reveal hints by keyboard (F114)", async (page) => {
  const home = page.locator('.home-skill[data-id="learning"] .home-level');
  await home.waitFor();
  const homeTree = await home.ariaSnapshot();
  if (!homeTree.includes("cut gems") || !homeTree.includes("recall")) throw new Error(`Home count has no meaning: ${homeTree}`);
  await page.locator('.home-skill[data-id="learning"] .home-open').focus();
  // More is between the name and count; walk the actual Tab order.
  for (let i = 0; i < 4 && !(await home.evaluate((e) => e === document.activeElement)); i++) await page.keyboard.press("Tab");
  if (!(await home.evaluate((e) => e === document.activeElement))) throw new Error("Home count cannot be reached by Tab");
  await page.getByRole("tooltip").filter({ hasText: "recall" }).waitFor();
  await page.getByRole("button", { name: "Learning", exact: true }).first().click();
  const trigger = page.locator(".hero-strength");
  await trigger.click();
  const pop = page.locator(".strength-pop");
  if (!(await pop.getAttribute("aria-label"))) throw new Error("Gem breakdown dialog is unnamed");
  const entries = pop.locator(".strength-legend > span");
  if (!(await entries.count())) throw new Error("No gem states to check");
  await pop.focus();
  for (const entry of await entries.all()) {
    const tree = await entry.ariaSnapshot();
    if (!/Polished|Won back|Cut:|Nearly cut|Missed:|Rough:|Not reviewed/.test(tree)) throw new Error(`Gem state has no meaning: ${tree}`);
    if ((await entry.getAttribute("tabindex")) !== "0") throw new Error("Gem meaning cannot be reached by keyboard");
    await page.keyboard.press("Tab");
    if (!(await entry.evaluate((e) => e === document.activeElement))) throw new Error(`Tab missed gem state: ${await entry.getAttribute("aria-label")}; focused ${await page.locator(":focus").evaluate((e) => e.outerHTML)}`);
    await page.locator('.hint[data-state$="open"]').filter({ hasText: (await entry.getAttribute("aria-label"))!.split(" · ").slice(1).join(" · ") }).first().waitFor();
  }
  await page.keyboard.press("Escape");
  await pop.waitFor({ state: "hidden" });
  // Focus goes back to the gem once the breakdown has finished leaving.
  await until("closing the breakdown puts focus back on its gem", async () => await trigger.evaluate((e) => e === document.activeElement));
});

journey("a11y: the suggested rating has a keyboard focus ring (F115)", async (page) => {
  await startReview(page, /Learning/);
  await page.locator(".quiz-sure").waitFor();
  await typeFact(page, undefined, "Sure");
  const good = page.locator(".review-rate .suggested");
  await good.waitFor();
  const before = await good.evaluate((e) => getComputedStyle(e).boxShadow);
  await page.locator(".review-rate .rate-2").focus();
  await page.keyboard.press("Tab");
  if (!(await good.evaluate((e) => e === document.activeElement && e.matches(":focus-visible")))) throw new Error("Tab did not focus suggested rating");
  const after = await good.evaluate((e) => ({ shadow: getComputedStyle(e).boxShadow, outline: getComputedStyle(e).outlineStyle }));
  if (after.shadow === before && after.outline === "none") throw new Error(`Suggested rating has no focus indicator: ${before}`);
  await page.keyboard.press("Escape");
});

journey("a11y: tutor citations and hovered secondary text meet AA contrast (F116)", async (page) => {
  const results: { text: string; ratio: number }[] = [];
  const measure = async (target: Locator) => {
    results.push(await target.evaluate((el) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d")!;
      const rgb = (color: string) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data];
      };
      const layers: number[][] = [];
      for (let e: Element | null = el; e; e = e.parentElement) layers.unshift(rgb(getComputedStyle(e).backgroundColor));
      let bg = [255, 255, 255];
      for (const layer of layers) bg = bg.map((v, i) => layer[i]! * layer[3]! / 255 + v * (1 - layer[3]! / 255));
      const lum = (color: number[]) => color.slice(0, 3).reduce((v, c, i) => {
        const s = c / 255;
        return v + (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i]!;
      }, 0);
      const a = lum(rgb(getComputedStyle(el).color)), b = lum(bg);
      return { text: el.textContent ?? "", ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
    }));
  };
  await page.getByRole("button", { name: "Learning", exact: true }).first().click();
  const row = page.locator(".row").filter({ hasText: TESTING }).first();
  await row.hover();
  await measure(row.locator(".kind-line"));
  await page.locator(".hero-strength").hover();
  const loose = page.locator(".hero-strength .near-goal > span:not(.near-glow)");
  await loose.waitFor();
  await measure(loose);
  await openSource(page, TESTING);
  await page.keyboard.press("Meta+j");
  await page.getByRole("textbox", { name: "Message the tutor" }).fill("Why does this work?");
  await page.keyboard.press("Enter");
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  await tutor.locator(".cite").first().waitFor();
  for (const cite of await tutor.locator(".cite-name").all()) await measure(cite);
  const sources = tutor.getByRole("button", { name: "Sources", exact: true });
  await measure(sources);
  await sources.focus();
  if (!(await sources.ariaSnapshot()).includes('button "Sources"')) throw new Error("Sources lost its accessible name");
  console.log("      contrast", JSON.stringify(results));
  if (results.some((r) => r.ratio < 4.5)) throw new Error(`Text contrast below 4.5:1: ${JSON.stringify(results)}`);
  await page.keyboard.press("Escape");
});

journey("a11y: reader toggle icons stay decorative in both states (F117)", async (page) => {
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill("# Accessible table\n\n| Term | Meaning |\n|---|---|\n| Recall | Retrieve from memory |\n\nTry remembering the meaning.");
  await page.keyboard.press("Enter");
  const cover = page.getByRole("button", { name: "Cover this column", exact: true }).first();
  await cover.waitFor();
  const check = async (control: Locator) => {
    const tree = await control.ariaSnapshot();
    if (!tree.includes("button") || tree.includes("img")) throw new Error(`Decorative icon exposed: ${tree}`);
  };
  await check(cover);
  await page.locator(".doc th").first().hover();
  await cover.focus();
  await page.keyboard.press("Enter");
  const show = page.getByRole("button", { name: "Show this column", exact: true });
  await check(show);
  await page.keyboard.press("Enter");
  await check(cover);
  const hide = page.getByRole("button", { name: "Hide the source", exact: true });
  await check(hide);
  await hide.click();
  const source = page.locator('.width-toggle[aria-label="Show the source"]');
  await until("source toggle says Show", async () => (await source.getAttribute("aria-label")) === "Show the source");
  // The hidden reader pane also hides its toolbar from the tree (tracked separately).
  if (await source.locator('svg:not([aria-hidden="true"])').count()) throw new Error("Show source icon is not decorative");
  await source.click();
  await check(hide);
});

journey("⌘K: Tab on a source steps into what can be done with it, typing narrows the actions, ↵ runs one, and Esc steps back out (D302)", async (page) => {
  await page.keyboard.press("Meta+k");
  const input = page.getByPlaceholder("Search sources or run a command…");
  await input.waitFor();
  await page.keyboard.type("Testing Effect");
  await page.locator("[cmdk-item][data-selected=true]").filter({ hasText: TESTING }).waitFor();
  await page.locator(".panel-foot").getByText("Actions").waitFor();
  await page.keyboard.press("Tab");
  await page.getByPlaceholder(`Do what with “${TESTING}”?`).waitFor();
  const rows = page.locator("[cmdk-item]");
  await rows.filter({ hasText: "Move to Done" }).waitFor();
  if (await rows.filter({ hasText: "Rename" }).count()) throw new Error("Rename is offered where there is no row to rename in place");
  // Esc steps back to the search, which is empty again; Esc once more closes.
  await page.keyboard.press("Escape");
  await input.waitFor();
  await page.keyboard.type("Testing Effect");
  await page.locator("[cmdk-item][data-selected=true]").filter({ hasText: TESTING }).waitFor();
  await page.keyboard.press("Tab");
  await page.keyboard.type("done");
  await until("typing narrows the actions to the one he means", async () => (await rows.count()) === 1 && (await rows.first().innerText()).includes("Move to Done"));
  // The move's answer held back: the library already has it done while the page waits, as on a slow runner, where a
  // ⌘Z in that moment met a history without the move (CI, F393).
  type Slow = { __ORE_SLOW?: Record<string, number> };
  await page.evaluate(() => ((window as Slow).__ORE_SLOW = { status: 60_000 }));
  await page.keyboard.press("Enter");
  await page.getByRole("dialog", { name: "Command palette" }).waitFor({ state: "detached" });
  await until("the source is marked done", async () => ((await ore("ls", "--status=done")) as { title: string }[]).some((i) => i.title === TESTING));
  await until("the move's answer is held", () => isHeld(page, "status"));
  await page.keyboard.press("Meta+z");
  await page.evaluate(() => delete (window as Slow).__ORE_SLOW);
  await release(page, "status");
  await until("⌘Z puts it back in To read", async () => !((await ore("ls", "--status=done")) as { title: string }[]).some((i) => i.title === TESTING));
});

journey("⌘K: a source is found by its author, as the list's search finds it (F337)", async (page) => {
  await page.keyboard.press("Meta+k");
  await page.locator("[cmdk-input]").fill("Barry Zhang");
  await page.locator("[cmdk-item]").filter({ hasText: AGENTS }).first().click();
  await page.locator(".doc-head").filter({ hasText: AGENTS }).waitFor();
});

journey("narrow window: Home's plan line is whole with Start review under it, and a source's prequestion head keeps its words together (F383, F382)", async (page) => {
  const made = (await ore("add", await textFile("narrow-head.md", "# Narrow head\n\nA source added with no enrich has no prequestions yet."), "--no-enrich")) as { id: string };
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: 720, height: 480 });
  try {
    await page.reload();
    await page.getByRole("button", { name: "Home", exact: true }).click();
    const plan = page.locator(".home-plan").first();
    await plan.waitFor();
    if (await plan.evaluate((p) => p.scrollWidth > p.clientWidth + 1)) throw new Error(`Home's plan line is cut off: "${await plan.innerText()}"`);
    await openSource(page, "Narrow head");
    const head = page.locator(".preq-head");
    await head.waitFor();
    // Its label is one line: before, each word of it had a line of its own.
    const lines = await head.evaluate((h) => {
      const r = document.createRange();
      r.selectNodeContents([...h.childNodes].find((n) => n.nodeType === 3)!);
      return new Set([...r.getClientRects()].map((b) => Math.round(b.top))).size;
    });
    if (lines > 1) throw new Error(`"What do you already know?" is on ${lines} lines`);
  } finally {
    await page.setViewportSize(size);
    await ore("archive", made.id).catch(() => {});
    await page.reload();
  }
});

// F445: a crash outside a screen's own boundary (a sheet, the sidebar, the phone outside Review) left
// the window blank for good, with nothing to press. Settings is made to crash by an answer missing its fields.
journey("a crash in a sheet shows what broke and Reload, never a blank window (F445)", async (page) => {
  await page.evaluate(() => ((window as unknown as { __ORE_REPLY: unknown }).__ORE_REPLY = { settings: {} }));
  await page.keyboard.press("Meta+,");
  await page.getByText("Ore hit a snag.").waitFor();
  await page.getByRole("button", { name: "Reload" }).click();
  await page.locator(".side-item").first().waitFor();
  if (await page.getByText("hit a snag").count()) throw new Error("the app did not come back after Reload");
});

// F447: a toast (and the pick bar) landed over the open tutor's field, on what he was typing.
journey("a toast stands left of the open tutor, never over its field (F447)", async (page) => {
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.keyboard.press("Meta+1");
  await page.locator(".list .title").filter({ hasText: TESTING }).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: /^Archive/ }).click();
  const toast = page.locator(".toast").last();
  await toast.waitFor();
  await page.keyboard.press("Meta+j");
  const tutor = page.locator("aside.tutor");
  await tutor.waitFor();
  const clear = async (how: string) => {
    const [t, u] = [await toast.boundingBox(), await tutor.boundingBox()];
    if (!t || !u) throw new Error(`no toast or no tutor to measure (${how})`);
    if (t.x + t.width > u.x) throw new Error(`the toast (to x ${Math.round(t.x + t.width)}) is over the ${how} tutor (from x ${Math.round(u.x)})`);
  };
  try {
    await clear("floating");
    await tutor.getByRole("button", { name: "Dock to the side" }).click();
    await tutor.getByRole("button", { name: "Float over the page" }).waitFor();
    await clear("docked");
  } finally {
    // The tutor floating again, as every other journey finds it, and the source back in To read.
    await tutor.getByRole("button", { name: "Float over the page" }).click().catch(() => {});
    await page.keyboard.press("Escape");
    await page.keyboard.press("Meta+z");
    await inLibrary(page, [TESTING]);
  }
});

journey("⌘K: a match in a source's text opens it at the passage the result showed, the words lit, never \"Not found\" (F443)", async (page) => {
  await page.keyboard.press("Meta+k");
  // Three words the source holds apart: under a heading, then in the paragraph after it.
  await page.keyboard.type("why retrieval works");
  await page.locator("[cmdk-item]").filter({ hasText: "Why it works" }).first().click();
  await page.locator(".doc-head").filter({ hasText: TESTING }).waitFor();
  const count = page.locator(".find-count");
  await until("Find counts a match", async () => /^\d+\/\d+$/.test((await count.textContent().catch(() => "")) ?? ""));
  if ((await page.getByLabel("Find in source").inputValue()) !== "Why it works") throw new Error(`Find holds "${await page.getByLabel("Find in source").inputValue()}"`);
  // The heading the result showed is on screen.
  await until("the passage is in view", () => page.evaluate(() => {
    const h = [...document.querySelectorAll(".doc h2")].find((e) => e.textContent === "Why it works")?.getBoundingClientRect();
    return !!h && h.top > 0 && h.bottom < innerHeight;
  }));
  await page.keyboard.press("Escape");
  // Two words far apart in one sentence, the first of them also earlier in the source: Find starts in the result's sentence.
  await page.keyboard.press("Meta+k");
  await page.keyboard.type("retrieval gains");
  await page.locator("[cmdk-item]").filter({ hasText: "produces larger" }).first().click();
  await until("Find starts past the first match", async () => {
    const m = ((await count.textContent().catch(() => "")) ?? "").match(/^(\d+)\/(\d+)$/);
    return !!m && +m[1]! > 1;
  });
  await page.keyboard.press("Escape");
});
