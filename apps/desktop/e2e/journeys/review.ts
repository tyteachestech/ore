import { join } from "node:path";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { type Page } from "playwright";
import { AGENTS, answered, armGood, awayAndBack, BRIDGE, browser, errors, hold, isHeld, journey, LIB, MOCK, openSource, ore, oreCalls, release, reveal, running, settled, startReview, TESTING, type TryRec, until, url } from "../harness";

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

journey("What to review by keyboard: it opens on its first row, Space unticks it, ↵ starts with the rest", async (page) => {
  await page.getByRole("button", { name: "Start review" }).focus();
  await page.keyboard.press("Enter");
  const pick = page.getByRole("dialog", { name: "What to review" });
  await pick.waitFor();
  await until("the first row has focus", () => page.evaluate(() => !!document.activeElement?.classList.contains("pick-row") && document.activeElement === document.querySelector(".pick-row")));
  await page.keyboard.press("Space");
  await until("Space unticked it", async () => (await pick.locator(".pick-row").first().getAttribute("aria-checked")) === "false");
  await page.keyboard.press("Enter");
  await page.locator(".review-card").waitFor();
});

journey("What to review: Deselect all and Select all flip every row in one click, ⌥-click solos one", async (page) => {
  await page.getByRole("button", { name: "Start review" }).click();
  const pick = page.getByRole("dialog", { name: "What to review" });
  await pick.waitFor();
  const ticks = () => pick.locator(".pick-row").evaluateAll((rows) => rows.map((r) => r.getAttribute("aria-checked")));
  await pick.getByRole("button", { name: "Deselect all" }).click();
  await until("every row unticked", async () => (await ticks()).every((t) => t === "false"));
  await pick.getByRole("button", { name: "Select all" }).click();
  await until("every row ticked", async () => (await ticks()).every((t) => t === "true"));
  await pick.locator(".pick-row").nth(1).click({ modifiers: ["Alt"] });
  await until("only the second row ticked", async () => (await ticks()).every((t, i) => t === String(i === 1)));
  await pick.locator(".pick-row").nth(1).click({ modifiers: ["Alt"] });
  await until("⌥-click again ticks every row", async () => (await ticks()).every((t) => t === "true"));
  await page.keyboard.press("Escape");
});

journey("D254: palette plays and stops ambience; closing the panel keeps the sound, reopening keeps the channel", async (page) => {
  const command = async (name: string) => {
    await page.keyboard.press("Meta+KeyK");
    await page.keyboard.type(name);
    await page.getByRole("option", { name, exact: true }).click();
  };
  await command("Play Rain");
  const orb = page.getByRole("button", { name: "Ambience: Rain playing", exact: true });
  await orb.waitFor();
  await orb.click();
  const pop = page.locator(".popover.radio");
  await pop.waitFor();
  if ((await pop.getByRole("button", { name: "Rain", exact: true }).getAttribute("aria-pressed")) !== "true") throw new Error("the palette's playing channel is not selected");
  await page.keyboard.press("Escape");
  await pop.waitFor({ state: "detached" });
  await orb.waitFor();
  await orb.click();
  await pop.waitFor();
  if (!(await pop.getByRole("button", { name: "Rain", exact: true }).evaluate(el => el === document.activeElement))) throw new Error("reopening lost the selected channel's focus");
  await page.keyboard.press("Escape");
  await pop.waitFor({ state: "detached" });
  await command("Stop ambience");
  await page.getByRole("button", { name: "Ambience", exact: true }).waitFor();
});

journey("ambience radio: the mole's twin at the bottom left; its pads play a channel and stop it, Esc closes, ⌥⌘A opens, a missing file says so (D254)", async (page) => {
  const orb = page.getByRole("button", { name: /^Ambience/ });
  const vp = page.viewportSize()!;
  const b = (await orb.boundingBox())!;
  if (Math.abs(b.x - 16) > 1 || Math.abs(vp.height - (b.y + b.height) - 16) > 1) throw new Error(`the radio is not 16px in from the bottom left corner (${b.x}, ${b.y})`);
  const room = await page.locator(".sidebar").evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
  if (room < vp.height - b.y) throw new Error(`the sidebar keeps ${room}px at its foot, less than the radio's ${vp.height - b.y}px`);
  await orb.click();
  const pop = page.locator(".popover.radio");
  await pop.waitFor();
  const pads = pop.locator(".radio-pad");
  if ((await pads.count()) !== 5) throw new Error(`the radio has ${await pads.count()} pads, not 5`);
  if (!(await pads.first().evaluate((el) => el === document.activeElement))) throw new Error("opening the radio did not put focus on its first pad");
  const rain = pop.getByRole("button", { name: "Rain", exact: true });
  await rain.click();
  await until("Rain plays", async () => (await rain.getAttribute("aria-pressed")) === "true" && (await page.getByRole("button", { name: "Ambience: Rain playing" }).count()) === 1);
  await rain.click();
  await until("Rain stops", async () => (await rain.getAttribute("aria-pressed")) === "false");
  // A number key picks a channel while the radio is open.
  await page.keyboard.press("5");
  await until("5 plays Focus", async () => (await pop.getByRole("button", { name: "Focus", exact: true }).getAttribute("aria-pressed")) === "true");
  await page.keyboard.press("Escape");
  await pop.waitFor({ state: "detached" });
  if (!(await orb.evaluate((el) => el === document.activeElement))) throw new Error("Esc did not give focus back to the radio");
  await page.keyboard.press("Meta+Alt+KeyA");
  await pop.waitFor();
  // A channel whose file is not on this Mac stays off and says so.
  await page.route("**/sounds/lamp.mp3", (r) => r.fulfill({ status: 404, body: "" }));
  const lamp = pop.getByRole("button", { name: "Lamp", exact: true });
  await lamp.click();
  await until("Lamp says it has no file", async () => (await lamp.getAttribute("class"))!.includes("missing") && (await pop.getByRole("img", { name: "Lamp has no sound file" }).count()) === 1);
  if ((await lamp.getAttribute("aria-pressed")) !== "false") throw new Error("a channel with no file shows as playing");
  await page.unroute("**/sounds/lamp.mp3");
  await page.keyboard.press("Escape");
  await pop.waitFor({ state: "detached" });
  // ⌘K's "Ambience…" opens it and it stays open (the palette handing focus back must not close it).
  await page.keyboard.press("Meta+KeyK");
  await page.keyboard.type("Ambience");
  await page.keyboard.press("Enter");
  await pop.waitFor();
  await page.waitForTimeout(300);
  if (!(await pop.isVisible())) throw new Error("⌘K's Ambience opened the radio and it closed again");
  await page.keyboard.press("5");
  await page.keyboard.press("Escape");
});

journey("ambience radio over Review: Esc closes the radio only, and its number keys pick channels, never rate (F93)", async (page) => {
  await startReview(page, null);
  const q = page.locator(".review-q");
  const first = await q.innerText();
  await page.keyboard.press("Meta+Alt+KeyA");
  const pop = page.locator(".popover.radio");
  await pop.waitFor();
  await page.keyboard.press("2");
  await until("2 plays Rain", async () => (await pop.getByRole("button", { name: "Rain", exact: true }).getAttribute("aria-pressed")) === "true");
  await page.keyboard.press("2");
  await page.keyboard.press("Escape");
  await pop.waitFor({ state: "detached" });
  await page.waitForTimeout(300);
  if (!(await page.locator(".review").isVisible())) throw new Error("Esc in the radio ended the review");
  if ((await q.innerText()) !== first) throw new Error("a number key in the radio rated the exercise");
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("ambience radio over Review: its button stays at the bottom left and one click opens it (F95)", async (page) => {
  await startReview(page, null);
  const orb = page.getByRole("button", { name: /^Ambience/ });
  const b = (await orb.boundingBox())!;
  const top = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest(".radio-orb") != null, [b.x + b.width / 2, b.y + b.height / 2]);
  if (!top) throw new Error("Review covers the radio's button");
  await orb.click();
  const pop = page.locator(".popover.radio");
  await pop.waitFor();
  await page.keyboard.press("Escape");
  await pop.waitFor({ state: "detached" });
  if (!(await page.locator(".review").isVisible())) throw new Error("opening the radio from its button ended the review");
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("mole says: a reply that lands while the tutor is closed comes out of the mole; a click opens the tutor at it, × waves it off, and one that lands while it is open says nothing (D159)", async (page) => {
  const release: (() => void)[] = [];
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"tutor",')) return route.fallback();
    const message = JSON.parse(body).args[1] as string;
    await new Promise<void>((ok) => release.push(ok));
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: `**${message}** comes back [1].`, citations: [], general: false, hint: false, exercise: null, card: null, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@4" } }) });
  });
  try {
    const tutor = page.getByRole("complementary", { name: "Tutor" });
    const field = page.getByRole("textbox", { name: "Message the tutor" });
    const says = page.locator(".mole-says");
    const ask = async (message: string) => {
      if (!(await tutor.count())) await page.keyboard.press("Meta+j");
      await field.fill(message);
      await page.keyboard.press("Enter");
      await tutor.getByText("Reading your sources…").waitFor();
    };
    // Asked, then closed while it thinks: the reply comes out of the mole, as plain text.
    await ask("Spacing");
    await page.keyboard.press("Escape");
    await until("Esc closes it", async () => (await tutor.count()) === 0);
    if (await says.count()) throw new Error("the mole spoke before the reply came");
    release.shift()!();
    await says.getByRole("button", { name: "Spacing comes back." }).waitFor();
    await page.getByRole("status").filter({ hasText: "The tutor answered: Spacing comes back." }).waitFor({ state: "attached" });
    // A click opens the tutor at it, and the bubble goes.
    await says.getByRole("button", { name: "Spacing comes back." }).focus();
    await page.keyboard.press("Enter");
    await tutor.getByText("Spacing comes back").waitFor();
    if (await says.count()) throw new Error("the bubble stayed with the tutor open");
    const moleFocused = async () => page.evaluate(() => document.activeElement?.matches(".tutor-bubble") ?? false);
    // × waves it off, from the keys too, and focus goes to the mole; the reply is still in the tutor.
    await ask("Interleaving");
    await page.keyboard.press("Escape");
    await until("closing the tutor opened from the bubble puts focus on the mole", moleFocused);
    release.shift()!();
    await says.getByRole("button", { name: "Interleaving comes back." }).waitFor();
    await says.getByRole("button", { name: "Dismiss the reply" }).focus();
    await page.keyboard.press("Enter");
    await until("× waves it off", async () => (await says.count()) === 0);
    await until("focus goes to the mole beside it", moleFocused);
    // One that lands while the tutor is open was heard there, even after closing and reopening it while it
    // thought: closing it again says nothing.
    await ask("Retrieval");
    await page.keyboard.press("Escape");
    await until("Esc closes it", async () => (await tutor.count()) === 0);
    await page.keyboard.press("Meta+j");
    await tutor.getByText("Reading your sources…").waitFor();
    release.shift()!();
    await tutor.getByText("Retrieval comes back").waitFor();
    await page.keyboard.press("Escape");
    await until("Esc closes it", async () => (await tutor.count()) === 0);
    await page.waitForTimeout(200);
    if (await says.count()) throw new Error("the mole repeated a reply he saw land");
  } finally {
    release.forEach((ok) => ok());
    await page.unroute(/\/ore$/);
  }
});

journey("review: a key pressed in Review never types into the skill note selected behind it (WebKit)", async (page) => {
  // Codex UX sweep 13: with the skill note's text selected, ⌘R and then E (Edit, not yet offered) replaced the whole
  // note with "e" and saved it. Review had the focus; WebKit typed into the selection the page behind still held.
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  const pm = page.locator(".skill-note .ProseMirror");
  await pm.waitFor();
  await pm.click();
  const line = `Kept through review (${Date.now() % 100000})`;
  await page.keyboard.press("Meta+ArrowDown");
  await page.keyboard.type(line);
  await until("the line is in the note", async () => ((await pm.textContent()) ?? "").includes(line));
  await page.keyboard.press("Meta+a");
  await page.keyboard.press("Meta+r");
  const pick = page.getByRole("dialog", { name: "What to review" });
  const review = page.getByRole("dialog", { name: "Review" });
  await until("Review or What to review opens", async () => (await pick.count()) > 0 || (await review.count()) > 0);
  if (await pick.count()) await pick.getByRole("button", { name: "Start review" }).click();
  await review.waitFor();
  await page.waitForTimeout(300);
  await page.keyboard.press("e");
  await page.keyboard.press("x");
  await page.waitForTimeout(300);
  const now = (await pm.textContent()) ?? "";
  if (!now.includes(line) || /^[ex]+$/.test(now.trim())) throw new Error(`the note behind Review changed: ${JSON.stringify(now.slice(0, 80))}`);
}, "webkit");

journey("retiring an exercise in Review updates the strength of the skill page left open under it (Codex sweep 3, numbers)", async (page) => {
  await page.getByRole("button", { name: /^Learning/ }).first().click();
  const gems = page.locator(".hero-strength");
  await gems.waitFor();
  const before = await gems.getAttribute("aria-label");
  await startReview(page, /Learning/, true);
  await page.keyboard.press("Shift+Meta+Backspace");
  await page.locator(".toast", { hasText: "Exercise retired" }).waitFor();
  await until("the open skill page counts the retired exercise out", async () => (await gems.getAttribute("aria-label")) !== before);
  await page.keyboard.press("Meta+z");
  await page.locator(".toast", { hasText: "Exercise restored" }).waitFor();
  await until("Undo counts it back in", async () => (await gems.getAttribute("aria-label")) === before);
  await page.keyboard.press("Escape");
});

journey("Review: Esc gives focus back to Start review when it started there, and from ⌘R with nothing focused to Home's own place", async (page) => {
  const go = page.getByRole("button", { name: "Start review" });
  const pick = page.getByRole("dialog", { name: "What to review" });
  const leave = async () => {
    await pick.waitFor({ timeout: 2000 }).then(() => page.keyboard.press("Enter"), () => {});
    await page.locator(".review-q").waitFor();
    await page.keyboard.press("Escape");
    await page.locator(".review").waitFor({ state: "detached" });
  };
  await go.focus();
  await page.keyboard.press("Enter");
  await leave();
  await until("focus is back on Start review", () => go.evaluate((el) => el === document.activeElement));
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Meta+r");
  await leave();
  await page.waitForTimeout(400);
  await until("focus is on one of Home's controls", () => page.evaluate(() => !!document.activeElement?.closest(".home, .main-tools")));
});

journey("Review: Done after the last due exercise leaves focus on a control Home still has, and ↓ moves on from it", async (page) => {
  const app = oreCalls(page);
  try {
    await startReview(page, null);
    for (let n = 0; n < 40 && (await page.locator(".review-q").count()); n++) {
      await reveal(page);
      await page.getByRole("button", { name: "Good", exact: true }).click();
      await until("the next exercise or the end", async () => app.rated.length === n + 1);
      await page.waitForTimeout(150);
      // On a slow run neither is drawn yet 150 ms after a rating, and the loop took that gap for the end (F401).
      await until("the next exercise or the end screen is drawn", async () => (await page.locator(".review-q, .review-end").count()) > 0);
    }
    const done = page.locator(".review-foot").getByRole("button", { name: "Done" });
    await done.waitFor();
    await done.focus();
    await page.keyboard.press("Enter");
    await page.locator(".review").waitFor({ state: "detached" });
    await page.waitForTimeout(1200); // Home reads today again: nothing is due, so Start review goes
    const on = () => page.evaluate(() => { const a = document.activeElement as HTMLElement | null; return a && a !== document.body ? (a.textContent ?? "").trim() : null; });
    const first = await on();
    if (!first) throw new Error("focus fell to <body> after the session cleared what was due");
    await page.keyboard.press("ArrowDown");
    await until("↓ moves on from it", async () => !!(await on()) && (await on()) !== first);
  } finally {
    await app.undoAll();
  }
});

// F539: with three skills kept the end screen ran past a 1280×800 window and Done sat under its foot.
// A shorter window shows the same with one skill row.
journey("review: the end screen's Done stays in sight when the screen runs longer than the window", async (page) => {
  const app = oreCalls(page);
  await page.setViewportSize({ width: 1280, height: 640 });
  await startReview(page, null);
  try {
    await reveal(page);
    await page.getByRole("button", { name: "Good", exact: true }).click();
    await page.waitForTimeout(400);
    await page.keyboard.press("Escape");
    const done = page.locator(".review-foot").getByRole("button", { name: "Done" });
    await done.waitFor();
    await page.waitForTimeout(3000); // the end screen's moment settles
    const box = (await done.boundingBox())!;
    if (process.env.ORE_E2E_SHOT) await page.screenshot({ path: process.env.ORE_E2E_SHOT });
    if (box.y + box.height > 640) throw new Error(`Done's foot is at ${Math.round(box.y + box.height)}px in a 640px window`);
  } finally {
    await app.undoAll();
  }
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

journey("review: a half-typed answer survives quitting the app, for a day", async (page) => {
  // On the Mac it lived in memory only: quitting Ore lost it (daily-session.md: nothing is lost when a session is cut short).
  await page.clock.install();
  await page.reload();
  await page.locator(".side-item").first().waitFor();
  const field = page.getByRole("textbox", { name: "Your answer" });
  await startReview(page, /Teaching/);
  await field.fill("an answer cut short");
  await page.getByRole("radio", { name: "Think so" }).click();
  // ⌘Q: the shell says "quitting" (the page gets no pagehide), and what was typed a moment ago is written at once.
  const written = await page.evaluate(() => {
    (window as unknown as { __emit: (e: string) => void }).__emit("quitting");
    return localStorage.getItem("ore.review-drafts") ?? "";
  });
  if (!written.includes("an answer cut short")) throw new Error("the answer wasn't written when the app said it was quitting");
  await page.reload();
  await startReview(page, /Teaching/);
  await until("the answer is back after the relaunch", async () => (await field.inputValue()) === "an answer cut short");
  await until("so is how sure he was", async () => (await page.getByRole("radio", { name: "Think so" }).getAttribute("aria-checked")) === "true");
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
  // A day on, it is asked anew.
  await page.clock.fastForward("25:00:00");
  await page.reload();
  await startReview(page, /Teaching/);
  await until("a day on the answer starts empty", async () => (await field.inputValue()) === "");
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review: a resumed answer keeps its active time through Esc and quitting", async (page) => {
  const app = oreCalls(page);
  const field = page.getByRole("textbox", { name: "Your answer" });
  const draft = "fluency feels like knowing, so they overrate it";
  await page.clock.install();
  await page.reload();
  try {
    await startReview(page, /Teaching/);
    await field.fill(draft);
    await page.getByRole("radio", { name: "Think so" }).click();
    await page.clock.fastForward(70_000);
    await page.keyboard.press("Escape");
    await page.locator(".review").waitFor({ state: "detached" });

    await page.clock.fastForward("01:00:00");
    await startReview(page, /Teaching/);
    await until("the answer is back after Esc", async () => (await field.inputValue()) === draft);
    await page.clock.fastForward(20_000);
    await page.evaluate(() => (window as unknown as { __emit: (e: string) => void }).__emit("quitting"));
    await page.reload();
    await page.clock.fastForward("01:00:00");

    await startReview(page, /Teaching/);
    await until("the answer is back after the relaunch", async () => (await field.inputValue()) === draft);
    await page.clock.fastForward(31_000);
    await page.evaluate(() => ((window as unknown as { __ORE_REPLY: unknown }).__ORE_REPLY = { grade: { rating: 3, gaps: [], feedback: "", covered: [true, true] } }));
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await page.getByRole("button", { name: "Good", exact: true }).click();
    await until("the rating was saved", async () => app.rated.length === 1);
    const rating = app.calls.find((args) => args[0] === "review");
    const ms = Number(rating?.find((arg) => arg.startsWith("--elapsed-ms="))?.split("=")[1]);
    // 121 seconds of answering plus the real time taken by the interactions above.
    if (!(ms >= 121_000 && ms < 126_000)) throw new Error(`expected 121000–125999 ms of active time, recorded ${ms} ms`);
    await page.locator(".review-foot").getByRole("button", { name: "Done" }).click();
    await page.locator(".review").waitFor({ state: "detached" });
  } finally {
    await app.undoAll();
  }
});

journey("review: the screen reader's summary counts the key points as he has marked them, not as the AI did", async (page) => {
  await page.evaluate(() => ((window as unknown as { __ORE_REPLY: unknown }).__ORE_REPLY = { grade: { rating: 3, gaps: [], feedback: "", covered: [true, true] } }));
  await startReview(page, /Teaching/);
  await page.getByRole("textbox", { name: "Your answer" }).fill("fluency feels like knowing, so they overrate it");
  await page.getByRole("radio", { name: "Think so" }).click();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  const live = page.locator(".review .sr-only[aria-live]");
  await until("the AI's marks are read out", async () => (await live.innerText()).includes("Marked 2 of 2 key points"));
  await page.getByRole("button", { name: /^Got: .*Mark as missed$/ }).first().click();
  await until("his correction is read out", async () => (await live.innerText()).includes("Marked 1 of 2 key points"));
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review: Good over a miss takes a second press, and a cut gem he misses comes loose with the mole's line; ⌘Z takes both back (D237)", async (page) => {
  // The exercise's gem is cut, whatever the seed's schedule says: its history comes back with that gem.
  await page.route(/\/ore$/, async (route) => {
    const args = (JSON.parse(route.request().postData() ?? "{}") as { args?: string[] }).args ?? [];
    if (args[0] !== "card" || !args.includes("--review")) return route.continue();
    const r = await route.fetch();
    const j = JSON.parse(await r.text()) as { history?: Record<string, unknown>; data?: { history?: Record<string, unknown> } };
    const h = (j.data ?? j).history;
    if (h) {
      h.reviews = [{ ts: new Date(Date.now() - 38 * 86_400_000).toISOString(), rating: 3 }];
      h.gem = { kind: "cut", after: { 1: { kind: "dull", days: 0 }, 2: { kind: "cut", days: 2 }, 3: { kind: "cut", days: 9 }, 4: { kind: "cut", days: 14 } } };
    }
    await route.fulfill({ response: r, body: JSON.stringify(j) });
  });
  await page.evaluate(() => ((window as unknown as { __ORE_REPLY: unknown }).__ORE_REPLY = { grade: { rating: 1, gaps: [], feedback: "", covered: [false, false] } }));
  await startReview(page, /Teaching/);
  const q = page.locator(".review-q");
  await page.getByRole("textbox", { name: "Your answer" }).fill("because it is boring");
  await page.getByRole("radio", { name: "Sure", exact: true }).click();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.locator(".review-rate .rate-1.suggested").waitFor();
  await page.locator('.review-gem .gem[data-kind="cut"]').waitFor();
  const was = await q.innerText();
  await page.waitForTimeout(400); // a rating key right after the answer shows is ignored
  // Good, two steps over the marks: it waits, says why, and nothing is recorded.
  await page.keyboard.press("3");
  const guard = page.locator(".review-guard");
  await guard.waitFor();
  if (!(await guard.innerText()).includes("2 of 2 key points are marked missed. Press Good again to keep it.")) throw new Error(`the guard says: ${await guard.innerText()}`);
  if ((await q.innerText()) !== was) throw new Error("one press of Good over a miss moved on");
  if (await page.locator(".review-moment").count()) throw new Error("a rating that only waits showed a moment");
  // A double click is one decision, not two: Good pressed again at once still waits.
  await page.getByRole("button", { name: "Easy", exact: true }).dblclick();
  await page.waitForTimeout(300);
  if ((await q.innerText()) !== was || !(await guard.innerText()).includes("Press Easy again")) throw new Error("a double click on Easy over a miss recorded it");
  // Marking both points as got means Good no longer goes over the marks: the wait and its reason go.
  const got = page.getByRole("button", { name: /Mark as got$/ });
  const missed = page.getByRole("button", { name: /Mark as missed$/ });
  while (await got.count()) await got.first().click();
  await guard.waitFor({ state: "detached" });
  while (await missed.count()) await missed.first().click();
  await page.locator(".review-rate .rate-1.suggested").waitFor();
  // Again, what the marks say, goes in at one press: the gem comes loose and the line is true to his Sure.
  await page.keyboard.press("1");
  const moment = page.locator('.review-moment[data-tone="miss"]');
  await moment.waitFor();
  await moment.locator('.gem[data-kind="dull"]').waitFor();
  if (!(await moment.innerText()).includes("Came loose")) throw new Error(`the moment says: ${await moment.innerText()}`);
  if ((await moment.innerText()).includes("days")) throw new Error("a miss showed days added");
  const mole = moment.locator(".mole");
  if ((await mole.getAttribute("width")) !== "48") throw new Error("a rating's mole is not 48px");
  if ((await mole.getAttribute("data-mood")) !== "nod") throw new Error("a missed cut gem did not get the gentle nod (D278)");
  // ⌘Z: the rating and its moment are both taken back.
  await page.keyboard.press("Meta+z");
  await moment.waitFor({ state: "detached" });
  // A miss comes back in the session, so the same exercise shows either way: the rating is gone once Undo is.
  await page.getByRole("button", { name: "Undo last rating" }).waitFor({ state: "detached" });
  if ((await q.innerText()) !== was) throw new Error("⌘Z did not leave the exercise showing");
  await until("Esc leaves", async () => (await page.keyboard.press("Escape"), (await page.locator(".review").count()) === 0));
});

journey("what a rating won shows as a chip in the head bar, its days in dots (F140)", async (page) => {
  // A cut gem last seen 38 days ago, and a Good worth 61 more days: the biggest reward a rating has.
  await page.route(/\/ore$/, async (route) => {
    const args = (JSON.parse(route.request().postData() ?? "{}") as { args?: string[] }).args ?? [];
    if (args[0] !== "card" || !args.includes("--review")) return route.fallback();
    const r = await route.fetch();
    const j = JSON.parse(await r.text()) as { history?: Record<string, unknown>; data?: { history?: Record<string, unknown> } };
    const h = (j.data ?? j).history;
    if (h) {
      h.reviews = [{ ts: new Date(Date.now() - 38 * 86_400_000).toISOString(), rating: 3 }];
      h.gem = { kind: "cut", after: { 1: { kind: "dull", days: 0 }, 2: { kind: "cut", days: 2 }, 3: { kind: "cut", days: 61 }, 4: { kind: "cut", days: 80 } } };
    }
    await route.fulfill({ response: r, body: JSON.stringify(j) });
  });
  try {
    await page.evaluate(() => ((window as unknown as { __ORE_REPLY: unknown }).__ORE_REPLY = { grade: { rating: 3, gaps: [], feedback: "", covered: [true, true] } }));
    await startReview(page, /Teaching/);
    await page.getByRole("textbox", { name: "Your answer" }).fill("Fluency feels like knowing, so you overrate yourself");
    await page.getByRole("radio", { name: "Think so" }).click();
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await page.locator(".review-rate .suggested").waitFor();
    await page.waitForTimeout(400); // a rating key right after the answer shows is ignored
    await page.keyboard.press("3");
    const moment = page.locator(".review-moment");
    await moment.waitFor();
    if ((await moment.innerText()).replace(/\s+/g, " ").trim() !== "+61 days Last seen 38 days ago") throw new Error(`the chip says: ${await moment.innerText()}`);
    // The days are a dot number, and the chip sits in the head bar: over no part of the exercise, on one line.
    const m = await moment.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const dots = el.querySelector(".moment-days .dot-number")!;
      return { dots: Math.round(dots.getBoundingClientRect().height), circles: dots.querySelectorAll("circle").length, over: Math.round(r.bottom - document.querySelector(".review-body")!.getBoundingClientRect().top), height: Math.round(r.height) };
    });
    if (m.dots < 18 || !m.circles) throw new Error(`the days are not a dot number: ${JSON.stringify(m)}`);
    if (m.over > 0 || m.height > 44) throw new Error(`the chip is not in the head bar: ${JSON.stringify(m)}`);
    await page.keyboard.press("Meta+z");
    await moment.waitFor({ state: "detached" });
  } finally {
    await page.unroute(/\/ore$/);
    await until("Esc leaves", async () => (await page.keyboard.press("Escape"), (await page.locator(".review").count()) === 0));
  }
});

journey("review: with no AI marks (the check failed), the screen reader counts the ones he sets", async (page) => {
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { grade: "AI is signed out." }));
  await startReview(page, /Teaching/);
  await page.getByRole("textbox", { name: "Your answer" }).fill("fluency feels like knowing");
  await page.getByRole("radio", { name: "Think so" }).click();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  const live = page.locator(".review .sr-only[aria-live]");
  await page.getByRole("button", { name: /Mark as got$/ }).first().click();
  await until("his mark is read out", async () => (await live.innerText()).includes("Marked 1 of 2 key points"));
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
  // The rows that came in late are ticked like any others, so ↵ starts so ↵ starts.
  const unticked = await pick.locator('[role=checkbox][aria-checked="false"]').count();
  if (unticked) throw new Error(`${unticked} rows that loaded after the sheet opened came in unticked`);
  await page.keyboard.press("Enter");
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
    await armGood(page, await page.getByText("No idea", { exact: true }).isVisible());
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

journey("review: Enter activates the focused button (Again, Edit exercise, Open in source); on the card it gives the suggested Good", async (page) => {
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
    await armGood(page, await page.getByText("No idea", { exact: true }).isVisible());
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
  await enterOn("Edit exercise");
  await until("Enter on Edit exercise opens the editor", async () => !(await q.isVisible()));
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

/** Each journey leaves the seeded exercise available to the next journey with a fresh Ask chat. */
function reviewAskCalls(page: Page) {
  const { calls } = oreCalls(page);
  return {
    calls,
    async clearChat() {
      await settled(page);
      const exercise = calls.find((args) => args[0] === "ask")?.[1];
      if (!exercise) return;
      const chat = await ore("chat", exercise, "--exercise") as { id: string; turns: unknown[] };
      if (chat.turns.length) await ore("chat", chat.id, "--delete");
    },
  };
}

// F265: Review's chat showed three dots until the whole reply was there, and nothing stopped it.
journey("review Ask: the reply shows as it is written, Stop keeps the words so far, and with none it says Stopped with Try again (D296)", async (page) => {
  const { clearChat } = reviewAskCalls(page);
  let release = () => {};
  let streams: string[] = [];
  const bodies: string[] = [];
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"ask",')) return route.fallback();
    streams.push(/--stream=(ask-[\w-]+)/.exec(body)![1]!);
    bodies.push(body);
    await new Promise<void>((done) => (release = done)); // the reply is still being written
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: "Because recalling it is the practice.", proposal: null, session: "s1" }) }).catch(() => {});
  });
  await page.getByRole("button", { name: "Start review" }).click();
  const pick = page.getByRole("dialog", { name: "What to review" });
  const q = page.locator(".review-q");
  await pick.or(q).first().waitFor();
  if (await pick.isVisible()) await page.keyboard.press("Enter");
  await q.waitFor();
  const noIdea = page.getByRole("button", { name: "No idea" });
  await (await noIdea.isVisible() ? noIdea : page.getByRole("radio", { name: "Think so" })).click();
  await page.getByRole("button", { name: "Ask about this" }).click();
  const ask = page.getByRole("region", { name: "Ask about this" });
  const field = page.getByRole("textbox", { name: "Ask about this exercise" });
  const emit = (p: object) => page.evaluate(([p]) => (window as any).__emit("ore-progress", p), [p] as const);
  // Stopped before a word: it says so and offers the message again.
  await field.fill("Why is this the answer?");
  await page.keyboard.press("Enter");
  await ask.getByLabel("Thinking").waitFor();
  await until("the request went", async () => streams.length === 1);
  await ask.getByRole("button", { name: "Stop the reply" }).click();
  await ask.getByText("Stopped.").waitFor();
  await ask.getByRole("button", { name: "Send" }).waitFor();
  // Asked again at once, while the stopped run is still winding down: the words come in place of the dots,
  // another run's words don't, and ⌘. keeps what was written.
  const first = release;
  await ask.getByRole("button", { name: "Try again" }).click();
  await until("the second request went", async () => streams.length === 2);
  first();
  await emit({ stream: streams[0], reply: "Words of the run he stopped", session: "s-old" });
  await emit({ stream: streams[1], reply: "Because recalling", session: "s-live" });
  await ask.getByText("Because recalling").waitFor();
  if (await ask.getByText("Words of the run he stopped").count()) throw new Error("a stopped run's words landed on the next one");
  if (await ask.getByLabel("Thinking").count()) throw new Error("the dots stayed beside the words");
  await page.keyboard.press("Meta+.");
  await ask.getByText("Stopped", { exact: true }).waitFor();
  await ask.getByText("Because recalling").waitFor();
  release();
  await page.waitForTimeout(150);
  if (await ask.getByText("Because recalling it is the practice.").count()) throw new Error("the stopped run's reply landed after Stop");
  // A reply left to finish lands whole.
  await field.fill("And after a week?");
  await page.keyboard.press("Enter");
  await until("the third request went", async () => streams.length === 3);
  // It follows the reply he stopped, in that reply's conversation, not a new one that never saw it.
  if (!bodies[2]!.includes("--session=s-live")) throw new Error(`the message after a stopped reply started a new conversation: ${bodies[2]}`);
  release();
  await ask.getByText("Because recalling it is the practice.").waitFor();
  await page.keyboard.press("Escape");
  await until("Ask closes", async () => (await ask.count()) === 0);
  await page.unroute(/\/ore$/);
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
  await clearChat();
});

journey("review Ask: closing and reopening it keeps the reply so far and a half-typed follow-up", async (page) => {
  const { clearChat } = reviewAskCalls(page);
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
  const field = page.getByRole("textbox", { name: "Ask about this exercise" });
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
  await clearChat();
});

// F-new-review-ask-history
journey("review Ask: reopening the same exercise restores its chat and resumes its session", async (page) => {
  const message = "Why does the client call an endpoint?";
  const reply = "The endpoint controls what the client can do.";
  const followUp = "Can you give me an example?";
  const example = "An endpoint can require permission before it updates an order.";
  const session = "ask-reopen-session";
  const { calls, clearChat } = reviewAskCalls(page);
  await page.route(/\/ore$/, async (route) => {
    const args = route.request().postDataJSON()?.args as string[] | undefined;
    if (args?.[0] !== "ask") return route.fallback();
    await route.fulfill({
      contentType: "application/json",
      json: { reply: args.includes(`--message=${followUp}`) ? example : reply, proposal: null, session },
    });
  });

  const question = page.locator(".review-q");
  const toggle = page.getByRole("button", { name: "Ask about this" });
  const ask = page.getByRole("region", { name: "Ask about this" });
  const field = ask.getByRole("textbox", { name: "Ask about this exercise" });
  const answerAndOpen = async () => {
    if (await toggle.count()) throw new Error("Ask opened before the answer");
    const noIdea = page.getByRole("button", { name: "No idea" });
    await (await noIdea.isVisible() ? noIdea : page.getByRole("radio", { name: "Think so" })).click();
    await toggle.click();
  };
  const leave = async () => {
    await toggle.click();
    await ask.waitFor({ state: "detached" });
    await page.keyboard.press("Escape");
    await page.locator(".review").waitFor({ state: "detached" });
  };

  await startReview(page, null);
  const exercise = await question.innerText();
  await answerAndOpen();
  await field.fill(message);
  await field.press("Enter");
  await ask.getByText(reply, { exact: true }).waitFor();
  await leave();
  await settled(page);
  await page.reload(); // a new app instance has to read the chat from the library
  await startReview(page, null);
  if (await question.innerText() !== exercise) throw new Error("Review opened a different exercise");
  await answerAndOpen();
  await ask.getByText(message, { exact: true }).waitFor();
  await ask.getByText(reply, { exact: true }).waitFor();
  await field.fill(followUp);
  await field.press("Enter");
  await ask.getByText(example, { exact: true }).waitFor();
  const askCalls = calls.filter((args) => args[0] === "ask");
  if (askCalls.length !== 2 || !askCalls[1]!.includes(`--session=${session}`)) throw new Error("The follow-up did not resume the saved session");
  if (calls.some((args) => args[0] === "review")) throw new Error("Ask recorded a rating");
  await leave();
  await page.unroute(/\/ore$/);
  await clearChat();
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
  const session = page.locator(".review");
  const done = async () => Number(await session.getAttribute("data-done"));
  const before = await done();
  // A card asks how sure he is, then shows the answer; a question asks for his answer first.
  await reveal(page);
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await until("the session counts the rating", async () => (await done()) === before + 1);
  await page.getByRole("button", { name: "Undo last rating" }).click();
  await until("Undo puts the first card back", async () => (await done()) === before && (await q.innerText()) === first);
  // The button is the same step as ⌘Z: ⇧⌘Z gives the rating again, and ⌘Z takes it back once more.
  await page.keyboard.press("Shift+Meta+z");
  await until("⇧⌘Z after the button's Undo rates it again", async () => (await done()) === before + 1);
  await page.keyboard.press("Meta+z");
  await until("⌘Z takes it back", async () => (await done()) === before);
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

/** The library's review log as it is on disk, every device's file: what Later must leave as it was. */
const reviewLog = () => {
  const dir = join(LIB, "reviews");
  return readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort().map((f) => readFileSync(join(dir, f), "utf8")).join("");
};

type TodayNow = { active_ms: number; due: number };

/** Presses ⌘L until the session ends, at most `total` + 1 times, each time waiting for the exercise on screen to be
 *  replaced (not for its wording to change: two can read alike). Returns how many he put off. */
async function laterAll(page: Page, total: number): Promise<number> {
  const review = page.locator(".review");
  let n = 0;
  for (; n <= total && (await review.count()); n++) {
    const shown = await page.locator(".review-card").elementHandle({ timeout: 4000 }).catch(() => null);
    if (!shown) break;
    await page.keyboard.press("Meta+l");
    await page.waitForFunction((el) => !el.isConnected, shown, { timeout: 5000 });
    await page.locator(".review-q").or(page.locator(".review-end")).first().waitFor({ timeout: 5000 }).catch(() => {});
  }
  await review.waitFor({ state: "detached" });
  return n;
}

journey("review: Later puts the exercise off to the end of the session with nothing logged; ⌘Z brings it back as it was, ⇧⌘Z puts it off again (D192)", async (page) => {
  const calls = oreCalls(page);
  const logged = () => calls.calls.filter((a) => a[0] === "review").length;
  const log = reviewLog();
  const today = (await ore("today")) as TodayNow;
  const q = page.locator(".review-q");
  const bar = page.locator(".review");
  const step = async () => `${await bar.getAttribute("data-done")} of ${await bar.getAttribute("data-steps")}`;
  const good = page.getByRole("button", { name: "Good", exact: true });
  const doneButton = page.locator(".review-foot").getByRole("button", { name: "Done" });
  try {
    await startReview(page, /Learning/);
    const first = await q.innerText();
    const total = Number(await bar.getAttribute("data-steps"));
    await reveal(page);
    // With Ask open: ⌘L from its field puts the exercise off too, and ⌘Z brings Ask back open.
    const askToggle = page.getByRole("button", { name: "Ask about this" });
    await askToggle.click();
    await page.getByRole("textbox", { name: "Ask about this exercise" }).focus();
    await page.keyboard.press("Meta+l");
    await until("Later moves on", async () => (await q.innerText()) !== first);
    if (logged()) throw new Error("Later logged a review");
    if ((await step()) !== `0 of ${total}`) throw new Error(`Later moved the session bar: ${await step()}`);
    await page.keyboard.press("Meta+z");
    await until("⌘Z brings it back, its answer still shown", async () => (await q.innerText()) === first && (await good.isVisible()));
    await until("and Ask open as he left it", async () => (await askToggle.getAttribute("aria-pressed")) === "true");
    await page.keyboard.press("Escape"); // closes Ask
    await page.keyboard.press("Shift+Meta+z");
    await until("⇧⌘Z puts it off again", async () => (await q.innerText()) !== first);
    // The rest first, with a trip to a source and back on the way; then it comes back, last and asked afresh.
    const open = page.getByRole("button", { name: /Open in source/ });
    let opened = false;
    for (let n = 1; n < total; n++) {
      const was = await q.innerText();
      if (was === first) throw new Error(`the exercise put off came back before the end (${n} of ${total})`);
      await reveal(page);
      if (!opened && (await open.isVisible())) {
        opened = true;
        await open.click();
        await page.locator(".doc-head").waitFor();
        await page.getByRole("button", { name: /Back to Review/ }).click();
        await until("back on the same exercise", async () => (await q.isVisible()) && (await q.innerText()) === was && (await good.isVisible()));
      }
      await good.click();
      await until("the next one", async () => (await q.innerText()) !== was);
    }
    if (!opened) throw new Error("no exercise offered Open in source");
    await until("it comes back last, asked afresh", async () => (await q.innerText()) === first && !(await good.isVisible()));
    if ((await step()) !== `${total - 1} of ${total}`) throw new Error(`the session bar reads ${await step()}`);
    // Nothing left he hasn't put off: Later on it, here by its button, ends the session. It stays due and counts nowhere.
    await reveal(page);
    await page.getByRole("button", { name: "Later", exact: true }).click();
    await doneButton.waitFor();
    // The memories kept stand under the ring, skill by skill: a reader's line names them all.
    const kept = [...((await page.locator(".end-skills .sr-only").textContent()) ?? "").matchAll(/(\d+) kept/g)].reduce((n, m) => n + Number(m[1]), 0);
    if (kept !== total - 1) throw new Error(`the end screen counts ${kept} kept for ${total - 1} rated`);
    if (logged() !== total - 1) throw new Error(`${logged()} reviews logged for ${total - 1} rated`);
    const lines = reviewLog().slice(log.length).trim().split("\n").length;
    if (lines !== total - 1) throw new Error(`the review log gained ${lines} lines for ${total - 1} rated`);
    const after = (await ore("today")) as TodayNow;
    if (after.due !== today.due - (total - 1)) throw new Error(`due went from ${today.due} to ${after.due}: the one put off should still be due`);
    // ⌘Z on the end screen takes the Later back: the session opens again on that exercise, as it was.
    await page.keyboard.press("Meta+z");
    await until("⌘Z leaves the end screen for the exercise put off", async () => !(await doneButton.isVisible()) && (await q.isVisible()) && (await q.innerText()) === first && (await good.isVisible()));
    await page.keyboard.press("Escape");
    await doneButton.waitFor();
    await page.keyboard.press("Enter");
    await page.locator(".review").waitFor({ state: "detached" });
  } finally {
    await calls.undoAll();
  }
});

journey("review: Later on the only exercise left ends the session and leaves it due; what he typed and how sure he was come back with it (D192)", async (page) => {
  const calls = oreCalls(page);
  const log = reviewLog();
  const before = (await ore("today")) as TodayNow;
  const minutes = page.locator(".home-goal h1 .roll");
  const shown = await minutes.innerText();
  // Teaching's one exercise is a question he answers in his own words; ⌘L works from inside the answer, as ⌘⌫ does.
  await startReview(page, /Teaching/);
  const field = page.getByRole("textbox", { name: "Your answer" });
  const sure = page.getByRole("radio", { name: "Think so" });
  await field.fill("half an answer");
  await sure.click();
  await field.focus();
  await page.keyboard.press("Meta+l");
  await page.locator(".review").waitFor({ state: "detached" });
  if (calls.calls.some((a) => a[0] === "review")) throw new Error("Later logged a review");
  if (reviewLog() !== log) throw new Error("Later changed the review log");
  const after = (await ore("today")) as TodayNow;
  if (after.active_ms !== before.active_ms || after.due !== before.due) throw new Error(`today changed: ${JSON.stringify({ before, after })}`);
  if ((await minutes.innerText()) !== shown) throw new Error(`Home's minutes went from ${shown} to ${await minutes.innerText()}`);
  await startReview(page, /Teaching/);
  await until("the answer is still there", async () => (await field.inputValue()) === "half an answer");
  await until("so is how sure he was", async () => (await sure.getAttribute("aria-checked")) === "true");
  await field.fill("");
  await sure.click(); // unpicked again, for the journeys after this one
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
  // Every skill again, for the journeys after this one.
  await startReview(page, null);
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review: putting off every exercise left, one after another, ends the session with nothing logged (D192)", async (page) => {
  const calls = oreCalls(page);
  const log = reviewLog();
  await startReview(page, null);
  const total = Number(await page.locator(".review").getAttribute("data-steps"));
  const n = await laterAll(page, total);
  if (n !== total) throw new Error(`put off ${n} of ${total} before it ended`);
  if (calls.calls.some((a) => a[0] === "review") || reviewLog() !== log) throw new Error("Later logged a review");
});

journey("review: Later moves straight on to the exercise loaded ahead, and the one loaded after it is the right one (D192)", async (page) => {
  // Each exercise takes 1.2 s to load here: only one loaded ahead shows within a moment.
  await page.addInitScript("window.__ORE_SLOW = { card: 1200 }");
  await page.reload();
  const calls = oreCalls(page);
  const q = page.locator(".review-q");
  const good = page.getByRole("button", { name: "Good", exact: true });
  const moved = async (from: string, what: string, ahead = true) => {
    const t0 = Date.now();
    await page.waitForFunction((from) => { const el = document.querySelector(".review-q"); return !!el && el.textContent !== from; }, from, { timeout: 8000 });
    if (ahead && Date.now() - t0 > 900) throw new Error(`${what} took ${Date.now() - t0} ms: it wasn't loaded ahead`);
    return q.innerText();
  };
  try {
    await startReview(page, /Learning/);
    const first = await q.innerText();
    await page.waitForTimeout(1500);
    await page.keyboard.press("Meta+l");
    const second = await moved(first, "the next exercise after Later");
    await page.waitForTimeout(1500);
    await reveal(page);
    await good.click();
    const third = await moved(second, "the exercise after that");
    if (third === first) throw new Error("the exercise put off came next, not last");
    await page.waitForTimeout(1500);
    await reveal(page);
    await good.click();
    // F619: it comes back once every other exercise has had its turn, however many there
    // are. A shard that began before midnight has one more here after it: the exercise drafted on the day the
    // library was seeded is held back that day only (D65).
    let last = third;
    for (let n = 0; n < 4 && (last = await moved(last, "the exercise after that one", false)) !== first; n++) {
      await reveal(page);
      await good.click();
    }
    if (last !== first) throw new Error("the exercise put off never came back");
    await page.keyboard.press("Escape");
    await page.locator(".review-foot").getByRole("button", { name: "Done" }).waitFor();
    await page.keyboard.press("Enter");
    await page.locator(".review").waitFor({ state: "detached" });
  } finally {
    await calls.undoAll();
  }
});

journey("review: a held ⌘L puts off one exercise, not the ones after it (D192)", async (page) => {
  await startReview(page, /Learning/);
  const q = page.locator(".review-q");
  const first = await q.innerText();
  await page.keyboard.down("Meta");
  await page.keyboard.down("l");
  for (let n = 0; n < 30; n++) {
    await page.waitForTimeout(40);
    await page.keyboard.down("l"); // held: each repeat comes with repeat: true
  }
  await page.keyboard.up("l");
  await page.keyboard.up("Meta");
  await page.waitForTimeout(400);
  // Three exercises: repeats putting off the next two would have ended the session.
  if (!(await page.locator(".review").count())) throw new Error("the held ⌘L put off every exercise and ended the session");
  await until("one put off", async () => (await q.innerText()) !== first);
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review: ⌘Z after a quick Later brings the exercise back with its passage, even one that hadn't loaded yet (D192)", async (page) => {
  await page.addInitScript("window.__ORE_SLOW = { show: 1500 }");
  await page.reload();
  await startReview(page, /Learning/);
  const q = page.locator(".review-q");
  const first = await q.innerText();
  const noIdea = page.getByRole("button", { name: "No idea" });
  await (await noIdea.isVisible() ? noIdea : page.getByRole("radio", { name: "Think so" })).click();
  await page.getByRole("button", { name: "Good", exact: true }).waitFor();
  await page.keyboard.press("Meta+l"); // before its passage lands
  await until("Later moves on", async () => (await q.innerText()) !== first);
  await page.keyboard.press("Meta+z");
  await until("it is back", async () => (await q.innerText()) === first);
  await page.getByRole("button", { name: /Open in source/ }).waitFor({ timeout: 5000 });
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review: Later, then Retire on the next exercise: ⌘Z twice puts that one back and then the one put off (D192)", async (page) => {
  await startReview(page, /Learning/);
  const q = page.locator(".review-q");
  const first = await q.innerText();
  await page.keyboard.press("Meta+l");
  await until("Later moves on", async () => (await q.innerText()) !== first);
  const second = await q.innerText();
  await page.keyboard.press("Shift+Meta+Backspace");
  await until("Retire moves on", async () => (await q.innerText()) !== second);
  await page.keyboard.press("Meta+z");
  await page.locator(".toast", { hasText: "Exercise restored" }).waitFor();
  await page.keyboard.press("Meta+z");
  await until("the second ⌘Z brings back the one put off", async () => (await q.innerText()) === first, 4000);
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review: ⌘Z from the end screen after a Later doesn't count the time spent there (D192)", async (page) => {
  const calls = oreCalls(page);
  const q = page.locator(".review-q");
  const good = page.getByRole("button", { name: "Good", exact: true });
  const doneButton = page.locator(".review-foot").getByRole("button", { name: "Done" });
  try {
    await startReview(page, /Learning/);
    const total = Number(await page.locator(".review").getAttribute("data-steps"));
    for (let n = 1; n < total; n++) {
      const was = await q.innerText();
      await reveal(page);
      await good.click();
      await until("the next one", async () => (await q.innerText()) !== was);
    }
    await reveal(page);
    await page.keyboard.press("Meta+l");
    await doneButton.waitFor();
    await page.waitForTimeout(3000); // on the end screen
    await page.keyboard.press("Meta+z");
    await until("back on it", async () => !(await doneButton.isVisible()) && (await good.isVisible()));
    await good.click();
    await doneButton.waitFor();
    const last = calls.calls.filter((a) => a[0] === "review" && !a.some((x) => x.startsWith("--undo"))).at(-1)!;
    const ms = Number(last.find((x) => x.startsWith("--elapsed-ms="))!.split("=")[1]);
    if (ms >= 2500) throw new Error(`the rating counted ${ms} ms: the time on the end screen went in`);
    await page.keyboard.press("Enter");
    await page.locator(".review").waitFor({ state: "detached" });
  } finally {
    await calls.undoAll();
  }
});

journey("review: a Later on the one more exercise served after a miss closed the goal passes that turn on, so the mole's goal note still doesn't follow a miss (D177, D192, D246)", async (page) => {
  const calls = oreCalls(page);
  // A one-millisecond goal, so the first rating closes it.
  await page.route(/\/ore$/, async (route) => {
    const args = ((JSON.parse(route.request().postData() ?? "{}") as { args?: string[] }).args ?? []);
    if (args[0] !== "today") return route.fallback();
    // One still on its way as the journey unroutes is already handled: nothing to do.
    const r = await route.fetch().catch(() => null);
    if (r) await route.fulfill({ response: r, json: { ...(await r.json()), counts: true, met: false, goal_ms: 1 } }).catch(() => {});
  });
  const q = page.locator(".review-q");
  const again = page.getByRole("button", { name: "Again", exact: true });
  const told = page.locator('.review-goal');
  try {
    await startReview(page, /Learning/);
    const first = await q.innerText();
    await reveal(page);
    await again.click();
    await until("one more exercise after the miss", async () => (await q.count()) > 0 && (await q.innerText()) !== first);
    const win = await q.innerText();
    await page.keyboard.press("Meta+l");
    await until("Later moves on from it", async () => (await q.innerText()) !== win);
    const next = await q.innerText();
    await reveal(page);
    await again.click();
    await until("the miss is logged", async () => calls.rated.length === 2);
    await page.waitForTimeout(800); // a note told on that miss would be up by now
    if (await told.count()) throw new Error("the goal was told on a miss after a Later");
    await until("that miss gets its own one more", async () => (await q.count()) > 0 && (await q.innerText()) !== next);
    // ⌘Z takes that miss back: the turn it earned goes with it, so missing it again still earns one more.
    await page.keyboard.press("Meta+z");
    await until("⌘Z brings the missed one back", async () => (await q.innerText()) === next && !(await again.isVisible()));
    await reveal(page);
    await again.click();
    await until("the miss is logged again", async () => calls.rated.length === 3);
    await page.waitForTimeout(800);
    if (await told.count()) throw new Error("the goal was told on a miss after ⌘Z");
    await until("one more after it", async () => (await q.count()) > 0 && (await q.innerText()) !== next);
    await reveal(page);
    await page.getByRole("button", { name: "Good", exact: true }).click();
    await told.waitFor();
    await page.keyboard.press("Escape");
    await page.locator(".review-end").waitFor();
    await page.keyboard.press("Enter");
    await page.locator(".review").waitFor({ state: "detached" });
  } finally {
    await page.unroute(/\/ore$/);
    await calls.undoAll();
  }
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
    await reveal(page);
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

journey("review sounds: showing the answer ticks and a rating shines, ⌘Z is silent, and Settings turns them off (D277)", async (page) => {
  const heard = () => page.evaluate(() => (window as { __ORE_SFX?: string[] }).__ORE_SFX!.join(" "));
  const q = page.locator(".review-q");
  const sounds = async (on: boolean) => {
    await page.keyboard.press("Meta+Comma");
    await page.getByRole("tab", { name: "General" }).click();
    const sw = page.getByRole("switch", { name: "Sound effects" });
    if (((await sw.getAttribute("aria-checked")) === "true") !== on) await sw.click();
    await until(`Sound effects is ${on ? "on" : "off"}`, async () => ((await sw.getAttribute("aria-checked")) === "true") === on);
    await page.keyboard.press("Escape");
    await page.getByRole("dialog", { name: "Settings" }).waitFor({ state: "detached" });
  };
  await page.evaluate(() => ((window as { __ORE_SFX?: string[] }).__ORE_SFX = []));
  await startReview(page, null);
  const first = await q.first().innerText();
  await reveal(page);
  if ((await heard()) !== "tap") throw new Error(`showing the answer played “${await heard()}”, not the tick`);
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await until("the rating plays the shine", async () => (await heard()) === "tap right");
  await until("the card moves on", async () => (await q.count()) === 0 || (await q.first().innerText().catch(() => first)) !== first);
  await page.keyboard.press("Meta+z");
  await until("⌘Z brings the card back", async () => (await q.first().innerText().catch(() => "")) === first);
  await page.waitForTimeout(300);
  if ((await heard()) !== "tap right") throw new Error(`⌘Z played a sound: “${await heard()}”`);
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
  // Off in Settings: the same moments are silent.
  await sounds(false);
  try {
    await startReview(page, null);
    await reveal(page);
    await page.waitForTimeout(200);
    if ((await heard()) !== "tap right") throw new Error(`with Sound effects off, showing the answer played: “${await heard()}”`);
    await page.keyboard.press("Escape");
    await page.locator(".review").waitFor({ state: "detached" });
  } finally {
    await sounds(true);
  }
  // The mole has a switch of his own (D330): off, his pop is silent and the sound effects still play.
  const play = (id: string) => page.evaluate(async (id) => ((await import("/src/sfx.ts" as string)) as { sfx: (id: string) => void }).sfx(id), id);
  const voice = async (on: boolean) => {
    await page.keyboard.press("Meta+Comma");
    const sw = page.getByRole("switch", { name: "Mole’s voice" });
    if (((await sw.getAttribute("aria-checked")) === "true") !== on) await sw.click();
    await until(`Mole’s voice is ${on ? "on" : "off"}`, async () => ((await sw.getAttribute("aria-checked")) === "true") === on);
    await page.keyboard.press("Escape");
    await page.getByRole("dialog", { name: "Settings" }).waitFor({ state: "detached" });
  };
  await voice(false);
  try {
    await play("pop");
    await play("cheer");
    await play("done");
    if ((await heard()) !== "tap right done") throw new Error(`with Mole’s voice off: “${await heard()}”`);
  } finally {
    await voice(true);
  }
  await play("cheer");
  if ((await heard()) !== "tap right done cheer") throw new Error(`with Mole’s voice on: “${await heard()}”`);
});

journey("review: at a session's end the cart tips its ore into the ring and leaves, the mole comes up after, and Reduce Motion skips it (D190)", async (page) => {
  const doneButton = page.locator(".review-foot").getByRole("button", { name: "Done" });
  const q = page.locator(".review-q");
  const finish = async () => {
    await page.getByRole("button", { name: "Start review" }).click();
    const pick = page.getByRole("dialog", { name: "What to review" });
    await pick.or(q).first().waitFor();
    if (await pick.isVisible()) await page.keyboard.press("Enter");
    for (let n = 0; n < 12 && !(await doneButton.isVisible()); n++) {
      await q.or(doneButton).first().waitFor();
      if (await doneButton.isVisible()) break;
      const noIdea = page.getByRole("button", { name: "No idea" });
      await (await noIdea.isVisible() ? noIdea : page.getByRole("radio", { name: "Think so" })).click().catch(() => {});
      await page.getByRole("button", { name: "Good", exact: true }).click({ timeout: 2000 }).catch(() => {});
      // Good over No idea waits for a second press (D237).
      if (await page.locator(".review-guard").isVisible()) {
        await page.waitForTimeout(550);
        await page.getByRole("button", { name: "Good", exact: true }).click({ timeout: 2000 }).catch(() => {});
      }
      await page.waitForTimeout(300);
    }
    await doneButton.waitFor();
  };
  const back = async () => {
    const undo = page.getByRole("button", { name: "Undo last rating" });
    for (let n = 0; n < 12 && (await undo.isVisible()); n++) {
      await undo.click({ timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(250);
    }
    await page.keyboard.press("Escape");
    await page.locator(".review").waitFor({ state: "detached" });
  };
  await page.evaluate(() => ((window as { __ORE_SFX?: string[] }).__ORE_SFX = []));
  const endSounds = () => page.evaluate(() => (window as { __ORE_SFX?: string[] }).__ORE_SFX!.filter((x) => ["cart", "done", "pop"].includes(x)).join(" "));
  await finish();
  // The cart plays only with something to tip (a ring dot this session lit, or a gem it cut).
  // Whether this library has that depends on the journeys before it, so that the cart mounts at all is
  // checked in test/end-screen.test.tsx; here it is checked in a real browser when it does play.
  const first = await page.evaluate(() => ({ cart: !!document.querySelector(".cart-tip .cart"), mole: !!document.querySelector(".review-mole .mole"), on: document.querySelectorAll(".review-end .end-ring > .ring .dot-ring .on").length }));
  if (first.cart) {
    if (first.mole) throw new Error("the mole is up while the cart is still on the rail");
    // Its layer never widens the page or takes a click: Done is still his.
    const layer = await page.evaluate(() => ({ events: getComputedStyle(document.querySelector(".cart-tip")!).pointerEvents, scroll: document.querySelector(".review-body")!.scrollWidth - document.querySelector(".review-body")!.clientWidth }));
    if (layer.events !== "none" || layer.scroll > 0) throw new Error(`the cart's layer is in the way: ${JSON.stringify(layer)}`);
    await until("the cart has gone", async () => (await page.locator(".cart-tip").count()) === 0, 8000);
  }
  const after = await page.evaluate(() => ({ mole: !!document.querySelector(".review-mole .mole"), on: document.querySelectorAll(".review-end .end-ring > .ring .dot-ring .on").length, waiting: document.querySelectorAll(".review-cut > span[data-wait]").length, ore: document.querySelectorAll(".cart-ore").length }));
  if (!after.mole || after.waiting || after.ore || after.on < first.on) throw new Error(`the end screen didn't settle: ${JSON.stringify({ first, after })}`);
  // Its sounds (D277): the cart's roll if it came, the jingle as the ring fills, the mole's pop as he comes up.
  await until("the end screen's sounds played in order", async () => (await endSounds()) === (first.cart ? "cart done pop" : "done pop"));
  await back();
  // Reduce Motion: the same screen, at once, with no cart.
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Set back whatever happens, or every journey after a failure here would run with Reduce Motion on.
  const still = await (async () => {
    await finish();
    return page.evaluate(() => ({ cart: !!document.querySelector(".cart-tip"), mole: !!document.querySelector(".review-mole .mole"), on: document.querySelectorAll(".review-end .end-ring > .ring .dot-ring .on").length }));
  })().finally(() => page.emulateMedia({ reducedMotion: null }));
  // A second session only adds minutes, so the ring is at least as full.
  if (still.cart || !still.mole || still.on < after.on) throw new Error(`Reduce Motion: ${JSON.stringify({ still, after })}`);
  // He is just there, so nothing pops: only the jingle.
  if (!(await endSounds()).endsWith("pop done")) throw new Error(`Reduce Motion's end screen played: ${await endSounds()}`);
  await back();
});

journey("review: a rating always moves the session one step on, and a miss adds its retry as one more step (D59)", async (page) => {
  const log = oreCalls(page);
  try {
    await startReview(page, null);
    const root = page.locator(".review");
    const at = async () => `${Number(await root.getAttribute("data-done")) + 1} of ${await root.getAttribute("data-steps")}`;
    const n = Number((await at()).split(" of ")[1]);
    const rate = async (name: "Again" | "Good", want: string) => {
      await reveal(page);
      await page.getByRole("button", { name, exact: true }).click();
      await until(`the label reads ${want}`, async () => (await at().catch(() => "")) === want).catch(async () => {
        throw new Error(`after ${name} the label reads "${await at()}", not "${want}"`);
      });
    };
    if ((await at()) !== `1 of ${n}`) throw new Error(`the first exercise reads ${await at()}`);
    // The miss comes back a few exercises later (D59): one more step, so the next exercise is 2 of n + 1.
    await rate("Again", `2 of ${n + 1}`);
    for (let i = 3; i <= n + 1; i++) await rate("Good", `${i} of ${n + 1}`);
    // The last step ends the session; among the steps was the retry, the missed exercise under a number of its own.
    await reveal(page);
    await page.getByRole("button", { name: "Good", exact: true }).click();
    await until("every step is rated", async () => log.rated.length === n + 1);
    if (log.rated.filter((r) => r.card === log.rated[0]!.card).length !== 2) throw new Error(`the miss never came back: ${JSON.stringify(log.rated.map((r) => r.card))}`);
  } finally {
    await page.keyboard.press("Escape");
    await page.locator(".review").waitFor({ state: "detached" }).catch(() => {});
    await log.undoAll();
  }
});

journey("review: when the day's goal closes the mole says so and the session goes on; Esc ends it on the end screen (D246)", async (page) => {
  const log = oreCalls(page);
  const was = (await ore("today")) as { goal_minutes: number; met: boolean; due: number };
  if (was.met || was.due < 3) throw new Error(`needs an unmet goal and three exercises due: ${JSON.stringify({ met: was.met, due: was.due })}`);
  const q = page.locator(".review-q");
  const note = page.locator('.review-goal');
  await page.addInitScript(() => {
    const moods: string[] = [];
    (window as unknown as { __goalMoods: string[] }).__goalMoods = moods;
    new MutationObserver(() => {
      const mood = document.querySelector(".review-goal .mole")?.getAttribute("data-mood");
      if (mood && moods.at(-1) !== mood) moods.push(mood);
    }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-mood"] });
  });
  const good = page.getByRole("button", { name: "Good", exact: true });
  try {
    await ore("goal", "--minutes", "1");
    await page.reload();
    await startReview(page, null);
    // A minute and a bit on the first exercise: the one-minute goal closes on its rating.
    await page.evaluate(() => {
      const now = Date.now;
      Date.now = () => now() + 61_000;
    });
    const first = await q.innerText();
    await reveal(page);
    await good.click();
    await note.waitFor();
    // The line is typed out; its letters to come are in the page, unseen (D245).
    if (!/Goal met\. The rest is extra\./.test((await note.textContent()) ?? "")) throw new Error(`the note says ${JSON.stringify(await note.textContent())}`);
    await until("the next exercise", async () => (await q.innerText()) !== first);
    if (await page.locator(".review-end").count()) throw new Error("the session ended at the goal");
    const moods = await page.evaluate(() => (window as unknown as { __goalMoods: string[] }).__goalMoods);
    if (moods[0] !== "wave") throw new Error(`the goal note starts with ${JSON.stringify(moods)}, not its wave`);
    if ((await note.locator(".mole").getAttribute("width")) !== "48") throw new Error("the goal note's mole is not 48px");
    // ⌘Z takes back the rating that closed the goal: the note goes with it, and closing it again tells it again.
    await page.keyboard.press("Meta+z");
    await until("⌘Z brings the first exercise back", async () => (await q.innerText()) === first);
    if (await note.count()) throw new Error("the goal's note outlived the undo of the rating that closed it");
    await page.evaluate(() => {
      const now = Date.now;
      Date.now = () => now() + 61_000;
    });
    await reveal(page);
    await good.click();
    await note.waitFor();
    await until("the next exercise again", async () => (await q.innerText()) !== first);
    // The note leaves with the next rating, and the session is still going.
    const second = await q.innerText();
    await reveal(page);
    await good.click();
    await until("the exercise after", async () => (await q.innerText()) !== second);
    if (await note.count()) throw new Error("the goal's note outlived the next rating");
    if (await page.locator(".review-end").count()) throw new Error("the session ended after the goal");
    await page.keyboard.press("Escape");
    await page.locator(".review-end").waitFor();
    await page.locator(".review-end .ring.glint").waitFor();
    const moving = await page.locator(".review-end .ring.glint circle").first().evaluate(el => {
      const s = getComputedStyle(el); return { name: s.animationName, repeats: s.animationIterationCount };
    });
    if (moving.name !== "glint" || moving.repeats !== "1") throw new Error(`D257: the earned ring must glint once: ${JSON.stringify(moving)}`);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const movingStill = await page.locator(".review-end .glint circle").evaluateAll(els => els.filter(el => getComputedStyle(el).animationName !== "none").length);
    if (movingStill) throw new Error(`D257: ${movingStill} dots animate under Reduce Motion`);
    if ((await page.locator(".end-emblem").evaluate(el => getComputedStyle(el, "::after").animationName)) !== "none") throw new Error("D257: the field glints under Reduce Motion");
  } finally {
    await page.keyboard.press("Enter").catch(() => {});
    await page.locator(".review").waitFor({ state: "detached" }).catch(() => {});
    await log.undoAll();
    await ore("goal", "--minutes", String(was.goal_minutes));
    await page.emulateMedia({ reducedMotion: "no-preference" });
  }
  const home = page.locator(".home-goal .ring");
  await home.waitFor();
  if ((await home.getAttribute("class"))?.includes("glint")) throw new Error("D257: Home replayed the earned glint");
  if ((await home.locator("circle").first().evaluate(el => getComputedStyle(el).animationName)) === "glint") throw new Error("D257: Home's dots replay the glint");
});

journey("review: a session whose receipt carries then and now shows the question with his answer then over his answer today (D248)", async (page) => {
  const log = oreCalls(page);
  // The receipt's then and now needs a typed miss three weeks old, which no journey can make: the rule is
  // core's (today.test.ts). Here the receipt is given one, to see it on the end screen.
  const then_now = { card: "x", question: "Why does retrieval practice beat rereading?", then_ts: new Date(Date.now() - 29 * 864e5).toISOString(), then: "not sure", now: "Pulling it out of memory strengthens it" };
  await page.route(/\/ore$/, async (route) => {
    const args = ((JSON.parse(route.request().postData() ?? "{}") as { args?: string[] }).args ?? []);
    if (!(args[0] === "session" && args[1] === "end")) return route.fallback();
    const r = await route.fetch().catch(() => null);
    if (r) await route.fulfill({ response: r, json: { ...(await r.json()), then_now } }).catch(() => {});
  });
  try {
    await startReview(page, null);
    await reveal(page);
    await page.getByRole("button", { name: "Good", exact: true }).click();
    await until("the rating is logged", async () => log.rated.length === 1);
    await page.keyboard.press("Escape");
    const box = page.locator(".review-end .then-now");
    await box.waitFor();
    const text = await box.innerText();
    for (const want of [then_now.question, "4 weeks ago", then_now.then, "Today", then_now.now]) if (!text.includes(want)) throw new Error(`then and now lacks ${JSON.stringify(want)}: ${JSON.stringify(text)}`);
    await page.keyboard.press("Enter");
    await page.locator(".review").waitFor({ state: "detached" });
  } finally {
    await page.unroute(/\/ore$/);
    await log.undoAll();
  }
});

journey("review: nothing counts the session up top (D246), and a miss still adds its retry to the session", async (page) => {
  const log = oreCalls(page);
  const { new_per_day } = (await ore("today")) as { new_per_day: number };
  const made: string[] = [];
  try {
    await ore("goal", "--new-per-day", "100");
    const due = ((await ore("today")) as { due: number }).due;
    // Drafts written as files (no `ore` command makes a plain one), so the session is exactly 30 steps.
    const cards = join(LIB, "cards");
    const model = readdirSync(cards).find((f) => /^\w{26}\.md$/.test(f) && /^state: draft$/m.test(readFileSync(join(cards, f), "utf8")))!;
    const text = readFileSync(join(cards, model), "utf8");
    for (let i = 0; i < 30 - due; i++) {
      const id = `01M7HEAD000000000000${String(i).padStart(6, "0")}`;
      writeFileSync(join(cards, `${id}.md`), text.replace(/^id: .*$/m, `id: ${id}`).replace(/^created: .*$/m, "created: 2026-01-01T00:00:00.000Z").replace(/\n---\n(.)/, `\n---\n(${i}) $1`));
      made.push(join(cards, `${id}.md`));
    }
    await startReview(page, null);
    const dots = page.locator(".review");
    if ((await dots.getAttribute("data-steps")) !== "30") throw new Error(`the session has ${await page.locator(".review").getAttribute("data-steps")} steps, not 30`);
    await reveal(page);
    await page.getByRole("button", { name: "Again", exact: true }).click();
    await until("the miss adds its retry", async () => (await page.locator(".review").getAttribute("data-steps")) === "31");
    if (await page.locator(".review-head [role=progressbar], .review-head .dot-bar, .review-head .quiz-steps").count()) throw new Error("Review's header still counts the session");
  } finally {
    await page.keyboard.press("Escape");
    await page.locator(".review").waitFor({ state: "detached" }).catch(() => {});
    await log.undoAll();
    for (const f of made) rmSync(f, { force: true });
    await ore("goal", "--new-per-day", String(new_per_day));
  }
});

journey("review: What to review has a No skill row for exercises filed under no skill, and every row ticked is the whole session (D204)", async (page) => {
  const items = (await ore("ls")) as { id: string; title: string; skills: string[] }[];
  const agents = items.find((i) => i.title === AGENTS)!;
  await ore("edit", agents.id, "--skills", "");
  try {
    await page.reload();
    await page.locator(".side-item").first().waitFor();
    const { due } = (await ore("today")) as { due: number };
    const pick = page.getByRole("dialog", { name: "What to review" });
    await page.getByRole("button", { name: "Start review" }).click();
    await pick.waitFor();
    const rows = await pick.getByRole("checkbox").allInnerTexts();
    if (!rows.some((r) => /No skill/.test(r) && /1 exercise ready/.test(r))) throw new Error(`no "No skill · 1 exercise ready" row: ${JSON.stringify(rows)}`);
    await page.keyboard.press("Escape");
    const total = () => page.locator(".review").getAttribute("data-steps").then(Number);
    await startReview(page, null);
    if ((await total()) !== due) throw new Error(`every row ticked gave a session of ${await total()}, Home said ${due}`);
    await page.keyboard.press("Escape");
    await page.locator(".review").waitFor({ state: "detached" });
    // Only the No skill row: just that exercise, so unticking his skills never strands it either.
    await startReview(page, /No skill/);
    if ((await total()) !== 1) throw new Error(`the No skill row alone gave a session of ${await total()}`);
    await page.keyboard.press("Escape");
    await page.locator(".review").waitFor({ state: "detached" });
    // Rows that share no exercise add up to their session (the seed's Teaching exercise is also under Learning).
    const ready = (row = "") => Number(/(\d+) exercises? ready/.exec(row)?.[1] ?? NaN);
    const count = (name: RegExp) => ready(rows.find((r) => name.test(r)));
    const apart = /^(Learning|Storytelling & Writing|No skill)\n/;
    const sum = rows.filter((r) => apart.test(r)).reduce((n, r) => n + ready(r), 0);
    await startReview(page, apart);
    if ((await total()) !== sum) throw new Error(`Learning, Storytelling & Writing and No skill read ${sum} together, their session has ${await total()}`);
    await page.keyboard.press("Escape");
    await page.locator(".review").waitFor({ state: "detached" });
    // No skill unticked: its exercise stays out of the session and still due, for a later one.
    await startReview(page, /^(?!No skill)/);
    if ((await total()) !== due - count(/^No skill\n/)) throw new Error(`without No skill the session has ${await total()}, not ${due - count(/^No skill\n/)}`);
    await page.keyboard.press("Escape");
    await page.locator(".review").waitFor({ state: "detached" });
    if (((await ore("due", "--skill", "-")) as unknown[]).length !== 1) throw new Error("unticking No skill took its exercise out of what is due");
  } finally {
    await ore("edit", agents.id, "--skills", agents.skills.join(","));
  }
});

/** The quick quiz window (D76), as a second page on the same library; `quiz-open` shows it. */
async function openQuiz(): Promise<Page> {
  const quiz = await browser.newPage({ viewport: { width: 680, height: 520 } });
  quiz.setDefaultTimeout(8000);
  const of = running;
  quiz.on("pageerror", (e) => errors.push(`${of}: ${e.message}`));
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

journey("review: in the quick quiz Later puts the exercise off with nothing logged, ⌘Z brings it back, and putting off every one closes it (D192)", async () => {
  const quiz = await openQuiz();
  const calls = oreCalls(quiz);
  const log = reviewLog();
  // The quick quiz asks everything due (no skill picked here).
  const total = ((await ore("due")) as unknown[]).length;
  try {
    await emit(quiz, "quiz-open");
    const q = quiz.locator(".review-q");
    await q.waitFor();
    const first = await q.innerText();
    await quiz.keyboard.press("Meta+l");
    await until("Later moves on", async () => (await q.innerText()) !== first);
    await quiz.keyboard.press("Meta+z");
    await until("⌘Z brings it back", async () => (await q.innerText()) === first);
    await quiz.keyboard.press("Shift+Meta+z");
    await until("⇧⌘Z puts it off again", async () => (await q.innerText()) !== first);
    // Every one left: one was put off already, so the rest go and the quiz closes.
    const n = await laterAll(quiz, total);
    if (n !== total - 1) throw new Error(`put off ${n} more of ${total} before the quiz closed`);
    if (calls.calls.some((a) => a[0] === "review") || reviewLog() !== log) throw new Error("Later logged a review in the quick quiz");
  } finally {
    await quiz.close();
    await calls.undoAll();
  }
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
    // What shows: a quiet step's words for VoiceOver (.sr-only) are not on screen.
    const shown = await quiz.locator(".quick").evaluate((el) => {
      const copy = el.cloneNode(true) as HTMLElement;
      copy.querySelectorAll(".sr-only").forEach((s) => s.remove());
      return copy.textContent ?? "";
    });
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
  // The picker's fresh read waits, in the page, until the test lets it go with one skill taken out. (A Playwright
  // route once missed this read, sent the instant after ⌘R, and the numbers came back unchanged: 1 run in 30.)
  await hold(page, "today");
  await page.keyboard.press("Meta+r");
  const pick = page.getByRole("dialog", { name: "What to review" });
  const rows = pick.getByRole("checkbox");
  await until("two skills or more are due", async () => (await rows.count()) > 1);
  await until("the fresh numbers are being read", () => isHeld(page, "today"));
  const first = await rows.first().locator(".name").innerText();
  const drop = ((await ore("skills")) as { id: string; name: string }[]).find((k) => k.name === first)!.id;
  await page.evaluate((id) => {
    type T = { skills: { skill: string }[] };
    (window as unknown as { __ORE_EDIT: Record<string, (t: T) => T> }).__ORE_EDIT = { today: (t) => ({ ...t, skills: t.skills.filter((x) => x.skill !== id) }) };
  }, drop);
  for (const row of (await rows.all()).slice(1)) if ((await row.getAttribute("aria-checked")) === "true") await row.click();
  await release(page, "today");
  await until("the fresh numbers land", async () => !(await pick.getByRole("checkbox", { name: new RegExp(first) }).count()));
  await pick.getByRole("button", { name: "Pick a skill" }).waitFor();
  if (await pick.getByRole("button", { name: "Pick a skill" }).isEnabled()) throw new Error("Start is on with no shown skill ticked");
  await page.keyboard.press("Escape");
});

journey("review: a rating undone and given again leaves no Redo to press", async (page) => {
  // Undo offers Redo; a new rating ends what can be redone, so the toast that is still up stops offering it.
  await startReview(page, null);
  const q = page.locator(".review-q");
  const first = await q.innerText();
  const good = page.getByRole("button", { name: "Good", exact: true });
  const undo = page.getByRole("button", { name: "Undo last rating" });
  const redo = page.locator(".toast").getByRole("button", { name: "Redo" });
  await reveal(page);
  await good.click();
  await undo.click();
  await until("Undo puts the card back", async () => (await q.isVisible()) && (await q.innerText()) === first);
  await redo.waitFor();
  await reveal(page);
  await good.click();
  await until("the rating given again moves on", async () => !(await q.isVisible()) || (await q.innerText()) !== first);
  if (await redo.count()) throw new Error("the toast still offers Redo, which no longer does anything");
  // Leaves the card due for the journeys after this one.
  await undo.click();
  await until("Undo puts the card back", async () => (await q.isVisible()) && (await q.innerText()) === first);
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review: a card's passage reads as the page shows it, without its Markdown", async (page) => {
  // A highlight keeps the source's Markdown (bold, a link, emphasis); the passage under the answer shows the words.
  // The first card is given such a highlight in what `ore` answers, so the journey leans on no other's state.
  const exact = "Retrieval prompts should produce **consistent** answers, as [Matuschak](https://example.test/prompts) puts it,\nlighting the *same bulbs* each time.";
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    const card = body.includes('"args":["card","show",');
    if (!card && !body.includes('"args":["show",')) return route.fallback();
    const res = await route.fetch();
    const json = await res.json();
    if (card) Object.assign(json, { annotation: "md-passage", evidence: [] });
    else json.annotations = [...(json.annotations ?? []), { id: "md-passage", exact, intent: "card", status: "open" }];
    await route.fulfill({ response: res, json });
  });
  await startReview(page, null);
  await reveal(page);
  const quote = page.locator(".review-passage blockquote");
  await quote.waitFor();
  const shown = (await quote.innerText()).replace(/\s+/g, " ").trim();
  const want = "Retrieval prompts should produce consistent answers, as Matuschak puts it, lighting the same bulbs each time.";
  if (shown !== want) throw new Error(`the passage shows “${shown}”, not “${want}”`);
  await page.unroute(/\/ore$/);
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

for (const ratedBefore of [false, true]) journey(`review: a Tutor card with no passage still offers Open in source after the answer, and it opens that source; ${ratedBefore ? "earned end screen" : "no ratings"} (F107)`, async (page) => {
  const log = oreCalls(page);
  const donor = ((await ore("due")) as { id: string; kind: string; question: string }[]).find(x => x.kind === "card" && !x.question.includes("Story Spine"));
  if (ratedBefore && !donor) throw new Error("needs a due Fact exercise before the Tutor exercise");
  // Force both exits on every run, independent of earlier journeys' ratings and queue order.
  await page.route(/\/ore$/, async route => {
    const args = (route.request().postDataJSON() as { args?: string[] }).args ?? [];
    if (args[0] !== "due" || !args.includes("--skill=storytelling-writing")) return route.fallback();
    const response = await route.fetch();
    const items = (await response.json()) as { id: string; question: string }[];
    const target = items.find(x => x.question === "Which word links the Story Spine's middle beats?");
    if (!target) throw new Error("the seeded Tutor exercise is missing");
    await route.fulfill({ response, json: ratedBefore ? [donor, target] : [target] });
  });
  try {
    // The seed's Storytelling card: the tutor kept it, so it has its source but no passage in it.
    await startReview(page, /Storytelling/);
    const q = page.locator(".review-q");
    const question = "Which word links the Story Spine's middle beats?";
    // Reach the target through the same rating path that made the original journey depend on queue order.
    let rated = 0;
    for (let n = 0; (await q.innerText()) !== question; n++) {
      if (n === 8) throw new Error(`the card is ${await q.innerText()}`);
      await reveal(page);
      await page.waitForTimeout(350);
      await page.getByRole("button", { name: "Good" }).click();
      rated++;
      await until("the next card", async () => (await q.innerText()) !== "" && (await page.locator(".review-rate").count()) === 0);
    }
    if (rated !== Number(ratedBefore)) throw new Error(`expected ${Number(ratedBefore)} earlier ratings, got ${rated}`);
    await reveal(page);
    await page.getByRole("button", { name: /Open in source/ }).click();
    await page.locator(".doc-head").filter({ hasText: "The Story Spine" }).waitFor();
    await page.keyboard.press("Escape");
    await until("back on the card", async () => (await q.isVisible()) && (await q.innerText()) === question);
    await page.keyboard.press("Escape");
    if (rated) {
      // These ratings earn the ordinary end screen; its Done leaves Review. No ratings closes directly.
      await page.locator(".review-end").waitFor();
      await page.locator(".review-end").getByRole("button", { name: "Done", exact: true }).click();
    }
    await page.locator(".review").waitFor({ state: "detached" });
  } finally {
    await page.unroute(/\/ore$/);
    await log.undoAll();
  }
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
  await page.getByRole("button", { name: "Edit exercise" }).click();
  const field = page.getByRole("textbox", { name: "Key points" });
  await until("the editor lists the key points, one a line", async () => (await field.inputValue()).split("\n")[0] === was);
  await field.fill((await field.inputValue()).replace(was, now));
  await page.getByRole("button", { name: "Save" }).click();
  await points.getByText(now).waitFor();
  if ((await rubric())[0] !== now) throw new Error(`saved ${await rubric()}`);
  await page.getByRole("button", { name: "Edit exercise" }).click();
  await until("opened again, the editor has the new point", async () => (await field.inputValue()).split("\n")[0] === now);
  await page.keyboard.press("Escape");
  await page.locator(".review").focus();
  await page.keyboard.press("Meta+z");
  await points.getByText(was).waitFor();
  await until("⌘Z saved the old point back", async () => (await rubric())[0] === was);
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review: saving an edit to the question keeps an answer changed outside meanwhile (F174)", async (page) => {
  await startReview(page, /Teaching/);
  const entry = ((await ore("due")) as { id: string; question: string }[]).find((e) => e.question.startsWith("Explain why rereading"))!;
  const show = async () => (await ore("card", "show", entry.id)) as { question: string; answer: string };
  const original = await show();
  await reveal(page);
  await page.getByRole("button", { name: "Edit exercise" }).click();
  const field = page.locator(".review textarea").first();
  await until("the editor has the question", async () => (await field.inputValue()) === original.question);
  await field.fill(`${original.question} (edited)`);
  // The /ore skill (or the phone) rewrites the answer while the editor is open.
  await ore("card", "set", entry.id, "--answer", "An answer written outside");
  try {
    await page.getByRole("button", { name: "Save" }).click();
    await until("the question saved", async () => (await show()).question === `${original.question} (edited)`);
    const now = await show();
    if (now.answer !== "An answer written outside") throw new Error(`the outside answer was written over: ${now.answer}`);
  } finally {
    await ore("card", "set", entry.id, "--question", original.question, "--answer", original.answer);
    await page.keyboard.press("Escape");
    await page.locator(".review").waitFor({ state: "detached" });
  }
});

journey("review: back from time away, the exercise on screen shows a question changed outside (F173)", async (page) => {
  await startReview(page, /Teaching/);
  const q = page.locator(".review-q");
  const shown = await q.innerText();
  const entry = ((await ore("due", "--all")) as { id: string; question: string }[]).find((e) => shown.includes(e.question.slice(0, 30)))!;
  const original = ((await ore("card", "show", entry.id)) as { question: string }).question;
  try {
    await ore("card", "set", entry.id, "--question", `${original} (rewritten outside)`);
    await awayAndBack(page);
    await until("the new question shows", async () => (await q.innerText()).includes("(rewritten outside)"));
  } finally {
    await ore("card", "set", entry.id, "--question", original);
    await page.keyboard.press("Escape");
    await page.locator(".review").waitFor({ state: "detached" });
  }
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
  const retire = page.getByRole("button", { name: /^(Retire|Delete) exercise$/ });
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

journey("review: a day after he last touched what he is trying, a session starts by asking if he did it; Not yet goes on, it asks once a day, and what he writes is a use (D324)", async (page) => {
  // His own try, the one left alone longest: every other one in the works is touched now.
  const mine = (await ore("try", "--skill", "habits", "--plan", "Shoes by the door", "--when", "I lock up at night")) as { id: string };
  try {
    await page.evaluate(() => localStorage.setItem("e2e.check-in", "1"));
    await Bun.sleep(1100);
    for (const t of (await ore("tries", "--now")) as { id: string }[]) if (t.id !== mine.id) await ore("try", t.id, "--pick");
    await page.reload();
    await page.locator(".side-item").first().waitFor();
    await startReview(page, null);
    if (await page.locator(".checkin").count()) throw new Error("asked on the day he made the try");
    await page.keyboard.press("Escape");
    await page.locator(".review").waitFor({ state: "detached" });
    await page.clock.install({ time: new Date(Date.now() + 26 * 3600e3) });
    await page.reload();
    await page.locator(".side-item").first().waitFor();
    await startReview(page, null, false, "check-in");
    const ask = page.locator(".checkin");
    await ask.filter({ hasText: "Shoes by the door" }).waitFor();
    await ask.getByText("when I lock up at night").waitFor();
    await page.keyboard.press("Escape"); // Not yet
    await ask.waitFor({ state: "detached" });
    await page.locator(".review-q").waitFor();
    await page.keyboard.press("Escape");
    await page.locator(".review").waitFor({ state: "detached" });
    // Asked once today.
    await startReview(page, null);
    if (await page.locator(".checkin").count()) throw new Error("asked a second time the same day");
    await page.keyboard.press("Escape");
    await page.locator(".review").waitFor({ state: "detached" });
    // A new day: he writes how it went, and it is a use of that try.
    await page.evaluate(() => localStorage.removeItem("ore.try-checkin"));
    await startReview(page, null, false, "check-in");
    await page.getByLabel("How did it go?").fill("Ran before breakfast twice.");
    await page.keyboard.press("Enter");
    await ask.waitFor({ state: "detached" });
    await until("the use is kept on the try", async () => ((await ore("tries", "--skill", "habits")) as { id: string; uses?: { reflection?: string; when?: string }[] }[]).find((t) => t.id === mine.id)?.uses?.[0]?.reflection === "Ran before breakfast twice.");
    await page.keyboard.press("Escape");
  } finally {
    await ore("annotate", mine.id, "--status", "deleted");
  }
});

journey("review: ⌘Z while the check-in's use is being saved takes back that use (code review of the Codex UX sweep)", async (page) => {
  const mine = (await ore("try", "--skill", "habits", "--plan", "Stretch at the kettle", "--when", "the kettle boils")) as { id: string };
  try {
    await page.evaluate(() => localStorage.setItem("e2e.check-in", "1"));
    for (const t of (await ore("tries", "--now")) as { id: string }[]) if (t.id !== mine.id) await ore("try", t.id, "--pick");
    await page.clock.install({ time: new Date(Date.now() + 26 * 3600e3) });
    await page.reload();
    await page.locator(".side-item").first().waitFor();
    await startReview(page, null, false, "check-in");
    await page.locator(".checkin").filter({ hasText: "Stretch at the kettle" }).waitFor();
    await page.getByLabel("How did it go?").fill("Did it twice.");
    await hold(page, "tried");
    await page.keyboard.press("Enter");
    await until("the use's write is out", () => isHeld(page, "tried"));
    await page.keyboard.press("Meta+z");
    const landed = answered(page, "tried");
    await release(page, "tried");
    await landed;
    await Bun.sleep(300); // an Undo that waited for it runs now
    await until("⌘Z took back the use", async () => !((await ore("tries", "--skill", "habits")) as TryRec[]).find((t) => t.id === mine.id)?.uses?.length);
    await page.keyboard.press("Escape");
  } finally {
    await ore("annotate", mine.id, "--status", "deleted");
  }
});

journey("the end of a review closes the session: no try line even with a try open, and under the ring a line for the skill it fed", async (page) => {
  const calls = oreCalls(page);
  await startReview(page, null);
  await reveal(page);
  await page.getByRole("button", { name: "Good", exact: true }).click();
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await page.locator(".review-end .end-medal").first().waitFor();
  // F580: a skill's name stands whole on its line, never cut short.
  const cutNames = await page.locator(".end-medal-name").evaluateAll((els) => els.filter((n) => n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1).map((n) => n.textContent));
  if (cutNames.length) throw new Error(`the end screen cut a skill's name short: ${cutNames.join(", ")}`);
  if (!/\d+ kept/.test((await page.locator(".end-skills .sr-only").textContent()) ?? "")) throw new Error(`the skills' rows read ${await page.locator(".end-skills .sr-only").textContent()}`);
  const open = ((await ore("tries")) as { status: string }[]).filter((t) => t.status === "open").length;
  if (!open) throw new Error("the seed has no open try, so this journey proves nothing");
  if (await page.locator(".review-try:not(.review-dig)").count()) throw new Error("the end screen shows a try line");
  await page.keyboard.press("Enter");
  await page.locator(".review").waitFor({ state: "detached" });
  await calls.undoAll(); // the rating, for the journeys after this one
});

journey("review: a first day with no exercises yet says how to get one, not that he is caught up (Codex sweep 4)", async (page) => {
  await page.reload();
  await page.locator(".home-goal h1").waitFor();
  await page.evaluate(() => {
    const w = window as unknown as { __ORE_REPLY: Record<string, unknown>; __ORE_EDIT: Record<string, (j: unknown) => unknown> };
    w.__ORE_REPLY = { due: [] };
    w.__ORE_EDIT = { today: (t) => ({ ...(t as object), due: 0, new_waiting: 0, exercises: 0 }) };
  });
  await page.keyboard.press("Meta+KeyR");
  const pick = page.getByRole("dialog", { name: "What to review" });
  if (await pick.waitFor({ timeout: 3000 }).then(() => true, () => false)) await pick.getByRole("button", { name: "Start review" }).click();
  await page.locator(".toast").filter({ hasText: "No exercises yet" }).waitFor();
  await page.evaluate(() => {
    const w = window as unknown as { __ORE_REPLY: Record<string, unknown>; __ORE_EDIT: Record<string, unknown> };
    w.__ORE_REPLY = {};
    w.__ORE_EDIT = {};
  });
});

journey("how sure: one Tab stop in Review and the finish quiz, ← → move between the three, Space picks", async (page) => {
  const focused = () => page.evaluate(() => ({ role: document.activeElement?.getAttribute("role"), name: (document.activeElement as HTMLElement | null)?.innerText.trim() }));
  const walk = async (field: ReturnType<Page["getByRole"]>) => {
    // The library is shared: the finish quiz journey before this one saved Think so on this question,
    // and the quiz opens with it picked. Start from Guess, so Tab lands on a known one.
    await page.getByRole("radio", { name: "Guess" }).click();
    await until("Guess is picked first", async () => (await page.getByRole("radio", { name: "Guess" }).getAttribute("aria-checked")) === "true");
    await field.fill("an answer");
    await field.focus();
    await page.keyboard.press("Tab");
    // Checked before → so the wait below sees focus move, not the Tab's own landing on Think so
    // (which passed only when it looked before Radix moved it on).
    const first = await focused();
    if (first.role !== "radio" || first.name !== "Guess") throw new Error(`Tab from the answer went to ${JSON.stringify(first)}`);
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
    // A click on the one picked clears it; Tab back in still lands on one of the three, so ← → work.
    await page.getByRole("radio", { name: "Think so" }).click();
    await until("Think so is cleared", async () => (await page.getByRole("radio", { name: "Think so" }).getAttribute("aria-checked")) === "false");
    await field.focus();
    await page.keyboard.press("Tab");
    await until("Tab after clearing lands on one of the three", async () => (await focused()).role === "radio", 2000);
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
  const session = page.locator(".review");
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
  if ((await session.getAttribute("data-done")) !== "1") throw new Error("the rating before it was lost");
  // Undo still takes that rating back (and leaves the card due for the journeys after this one).
  await page.getByRole("button", { name: "Undo last rating" }).click();
  await until("Undo puts the first card back", async () => (await q.isVisible()) && (await q.innerText()) === first);
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("review: once an Explain exercise is checked, the key bar names the suggested rating (↵ Hard), as its button does", async (page) => {
  await page.route(/\/ore$/, async (route) => {
    if (!(route.request().postData() ?? "").includes('"grade",')) return route.fallback();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ rating: 2, gaps: [], feedback: "", covered: [true, false] }) });
  });
  try {
    await startReview(page, /Teaching/);
    const keys = page.locator(".review-keys");
    await page.getByRole("textbox", { name: "Your answer" }).fill("Fluency feels like knowing");
    await page.getByRole("radio", { name: "Think so" }).click();
    await page.getByRole("button", { name: "Check", exact: true }).click();
    const suggested = page.locator(".review-rate .suggested");
    await suggested.waitFor();
    const name = (await suggested.innerText()).trim();
    if (name !== "Hard") throw new Error(`the suggested button reads ${name}, not Hard`);
    await until("the key bar says ↵ Hard", async () => /↵\s*Hard/.test(await keys.innerText())).catch(async () => {
      throw new Error(`the key bar reads: ${await keys.innerText()}`);
    });
    // F134: Retire is a tool under the ratings like Ask, Edit and Later, so the bar names its key too.
    if (!/⇧⌘⌫\s*Retire/.test(await keys.innerText())) throw new Error(`the key bar doesn't name Retire: ${await keys.innerText()}`);
  } finally {
    await page.unroute(/\/ore$/);
    await page.keyboard.press("Escape");
    await page.locator(".review").waitFor({ state: "detached" }).catch(() => {});
  }
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
  await page.getByRole("button", { name: "Edit exercise" }).click();
  const field = page.getByRole("textbox", { name: "Key points" });
  const was = await field.inputValue();
  const [kept, changed] = was.split("\n") as [string, string];
  const save = async (text: string, shows: string) => {
    if (!(await field.isVisible())) await page.getByRole("button", { name: "Edit exercise" }).click();
    await field.fill(text);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await points.locator("li").first().filter({ hasText: shows }).waitFor();
  };
  // Only reordered: both marks stay, but they were the AI's, so nothing is suggested until he marks.
  await save(`${changed}\n${kept}`, changed);
  await page.unroute(/\/ore$/);
  await page.locator(".review-grade-failed", { hasText: "The key points changed." }).waitFor();
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
  await page.getByRole("button", { name: "Edit exercise" }).click();
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
  await page.getByRole("button", { name: "Edit exercise" }).click();
  const question = page.locator("#edit-q");
  const was = await question.inputValue();
  // Cancel shows Esc on hover, as Save shows its key; while it saves, Esc waits, so the hint goes too.
  const cancel = page.locator(".review-edit").getByRole("button", { name: "Cancel", exact: true });
  const cancelHint = page.locator(".hint", { hasText: /^Cancel\s*Esc$/ });
  await cancel.hover();
  await cancelHint.waitFor();
  await question.fill(`${was} (edited)`);
  await page.locator(".review-edit").getByRole("button", { name: "Save", exact: true }).click();
  await until("the save is held", async () => held);
  const box = (await cancel.boundingBox())!;
  await page.mouse.move(box.x - 200, box.y - 200, { steps: 8 });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
  await page.waitForTimeout(800);
  if (await cancelHint.isVisible()) throw new Error("Cancel's hint says Esc while the save holds Esc back");
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
  const { clearChat } = reviewAskCalls(page);
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
  const box = page.getByRole("textbox", { name: "Ask about this exercise" });
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
  await clearChat();
});

journey("review Ask: a suggested card shows only what it changes, struck and underlined, and keeps showing it once used (D161)", async (page) => {
  const { clearChat } = reviewAskCalls(page);
  let id = "";
  let was = { question: "", answer: "" };
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"ask",')) return route.fallback();
    id = (JSON.parse(body) as { args: string[] }).args[1]!;
    const question = was.question.replace(/\?$/, "") + ", in one line?";
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: "Tighter, and it asks for one line.", proposal: { question, answer: "Short answer." }, session: "s1" }) });
  });
  await startReview(page, null);
  was = { question: (await page.locator(".review-q").innerText()).trim(), answer: "" };
  await reveal(page);
  was.answer = (await page.locator(".review-answer").first().innerText()).trim();
  await page.getByRole("button", { name: "Ask about this" }).click();
  await page.locator(".ask-starters").getByRole("button", { name: "Make this exercise clearer" }).click();
  const card = page.locator(".ask-card");
  await card.waitFor();
  const q = card.locator(".ask-card-q");
  if ((await q.locator(".diff-del").count()) !== 0) throw new Error("the question's kept words were struck");
  if (!(await q.locator(".diff-add").innerText()).includes("in one line")) throw new Error("the added words aren't marked");
  if (!(await card.locator(".ask-card-a .diff-add").allInnerTexts()).join("").includes("Short")) throw new Error("the new answer isn't marked as added");
  await page.unroute(/\/ore$/);
  await card.getByRole("button", { name: "Use this exercise" }).click();
  await card.getByRole("button", { name: "Exercise updated" }).waitFor();
  if (!(await q.locator(".diff-add").innerText()).includes("in one line")) throw new Error("using the card dropped the change it shows");
  // ⌘Z puts the old card back, so the suggestion can be used again.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Meta+z");
  await card.getByRole("button", { name: "Use this exercise" }).waitFor({ timeout: 3000 }).catch(() => {
    throw new Error("after ⌘Z the suggestion still says Exercise updated");
  });
  await ore("card", "set", id, `--question=${was.question}`, `--answer=${was.answer}`);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
  await clearChat();
});

journey("review end: calibration shows a bar for each tap with enough answers, the counts on hover (D165)", async (page) => {
  const levels = [{ confidence: 1, n: 12, right: 0.5 }, { confidence: 2, n: 4, right: null }, { confidence: 3, n: 30, right: 0.9 }];
  await page.route(/\/ore$/, async (route) => {
    if (!(route.request().postData() ?? "").includes('"args":["session","end"')) return route.fallback();
    const res = await route.fetch();
    await route.fulfill({ response: res, json: { ...(await res.json()), calibration: { sure_n: 30, sure_right: 0.9, levels } } });
  });
  const app = oreCalls(page);
  try {
    await startReview(page, /^\s*AI\b/);
    await page.keyboard.press("2");
    await page.getByRole("button", { name: "Good", exact: true }).click();
    const cal = page.getByRole("group", { name: "When you say" });
    await cal.waitFor();
    const rows = await cal.locator(".review-calibration-row").evaluateAll((es) => es.map((e) => e.getAttribute("aria-label")));
    if (rows.join("|") !== "Guess: right 50%|Sure: right 90%") throw new Error(`rows: ${rows.join("|")}`);
    if ((await cal.locator(".review-calibration-row").last().locator("i[data-on]").count()) !== 9) throw new Error("Sure's bar isn't 9 of 10");
    await cal.locator(".review-calibration-row").first().hover();
    await page.getByText("Right 6 of 12 Explain answers in the last 12 weeks").waitFor();
  } finally {
    await page.unroute(/\/ore$/);
    await app.undoAll();
  }
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("quick quiz: clicking the recorder takes keyboard focus in WebKit (F147)", async (page) => {
  await page.keyboard.press("Meta+,");
  const panel = page.getByRole("dialog", { name: "Settings" });
  await panel.getByRole("tab", { name: "Review", exact: true }).click();
  const recorder = panel.getByRole("button", { name: /Quick quiz shortcut:|Record quick quiz shortcut/ });
  await recorder.click();
  await until("the recorder takes focus", () => recorder.evaluate((el) => el === document.activeElement));
  await page.keyboard.press("Control+Alt+w");
  await until("the typed shortcut is displayed", async () => (await recorder.innerText()) === "⌃⌥W");
  await recorder.click();
  await page.keyboard.press("Escape");
  if ((await recorder.innerText()) !== "⌃⌥W" || !(await panel.count())) throw new Error("Esc should cancel recording and keep Settings open");
  await panel.getByRole("button", { name: "Close settings" }).click();
  await page.keyboard.press("Meta+,");
  await until("the shortcut survives reopening", async () => (await recorder.innerText()) === "⌃⌥W");
}, "webkit");

/** What the mole and the ambience radio cover once every scroller on screen is at its end: text, a control or a picture
 * a person would need, drawn where the pointer would land on the round button instead (Notion's ? and Intercom's bubble
 * keep their corner clear the same way). */
async function underTheCorners(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>("*")) {
      const o = getComputedStyle(el).overflowY;
      if ((o === "auto" || o === "scroll") && el.scrollHeight > el.clientHeight) el.scrollTop = el.scrollHeight;
    }
    const corners = [...document.querySelectorAll<HTMLElement>(".tutor-bubble, .radio-orb")].filter((c) => c.getClientRects().length);
    const hit: string[] = [];
    for (const c of corners) {
      const r = c.getBoundingClientRect();
      for (let x = r.left + 4; x < r.right - 4; x += 6)
        for (let y = r.top + 4; y < r.bottom - 4; y += 6) {
          if (Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2)) > r.width / 2) continue;
          for (const el of document.elementsFromPoint(x, y)) {
            if (el === document.documentElement || el === document.body || c.contains(el) || el.closest(".radio-tag")) continue;
            const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
            const thing = own || el.matches("button, a, input, textarea, img, svg, [role=button], [role=checkbox]");
            if (!thing || getComputedStyle(el).visibility === "hidden") continue;
            const name = `${el.tagName.toLowerCase()}.${[...el.classList].join(".")} "${(el.textContent ?? "").trim().slice(0, 30)}"`;
            if (!hit.includes(name)) hit.push(name);
          }
        }
    }
    return hit;
  });
}

journey("the mole and the ambience radio never cover the last of a screen: every scroller ends clear of the bottom corners (round 6 pick 11)", async (page) => {
  // At the usual size and at the smallest window the app allows (720 × 480).
  const check = async (where: string) => {
    const size = page.viewportSize()!;
    for (const [width, height] of [[size.width, size.height], [720, 480]] as const) {
      await page.setViewportSize({ width, height });
      // The app answers a new size when it has drawn again (a narrow window folds the sidebar and moves the radio into
      // the top bar, F450), which on a busy runner came after 300 ms and after two frames: read until the screen at this
      // size is clear, so what fails is a screen that stays covered, never one still moving.
      let hit: string[] = [];
      await until(`${where} at ${width} × ${height} ends clear of the corners`, async () => !(hit = await underTheCorners(page)).length).catch(() => {});
      if (hit.length) throw new Error(`${where} at ${width} × ${height}: under the corners at the end: ${hit.join("; ")}`);
    }
    await page.setViewportSize(size);
  };
  await page.getByRole("button", { name: /^Home/ }).click();
  await page.locator(".home").waitFor();
  await check("Home");
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.locator(".row").first().waitFor();
  await check("All sources");
  await page.locator(".sidebar .side-item").filter({ hasText: "Learning" }).first().click();
  await page.locator(".skill-col").first().waitFor();
  await check("a skill page");
  await openSource(page, TESTING);
  await check("a source");
  // Twenty posts, enough to scroll the Feed's list, with a post open beside it.
  const server = Bun.serve({ port: 0, fetch: (r: Request): Response => new URL(r.url).pathname === "/feed.xml"
    ? new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>Corners</title><link>http://localhost/</link>${Array.from({ length: 20 }, (_, i) => `<item><title>Post number ${i + 1} on learning</title><link>http://localhost:${server.port}/p${i}.html</link><pubDate>${new Date(Date.now() - i * 864e5).toUTCString()}</pubDate></item>`).join("")}</channel></rss>`, { headers: { "content-type": "application/rss+xml" } })
    : new Response(`<html><head><title>Post</title></head><body><article><h1>Post on learning</h1>${"<p>Retrieval practice is the act of pulling information out of memory rather than putting it back in.</p>".repeat(12)}</article></body></html>`, { headers: { "content-type": "text/html" } }) });
  try {
    await ore("feed", "follow", `http://localhost:${server.port}/feed.xml`, "--skill=teaching");
    await page.getByRole("button", { name: "Feed", exact: true }).click();
    await page.locator(".row.post").first().waitFor();
    await check("the Feed");
    await page.locator(".row.post").nth(1).click();
    await page.locator(".reader .doc").waitFor();
    await check("a post beside the Feed");
  } finally {
    server.stop(true);
  }
  await startReview(page, null, true);
  await check("Review");
  await page.keyboard.press("Space");
  await check("Review, its answer shown");
  await page.keyboard.press("Escape");
});

journey("review: under a long answer in a short window the four ratings stay in view, clear of the radio (D314)", async (page) => {
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: 720, height: 480 });
  try {
    await startReview(page, null);
    await reveal(page);
    // A long answer, as an Explain exercise's can be: the mock's are a line each.
    await page.locator(".review-answer").evaluate((a) => {
      const p = document.createElement("p");
      p.textContent = "Rereading builds fluency, and fluency is easy to mistake for knowing. ".repeat(24);
      a.append(p);
    });
    const body = page.locator(".review-body");
    if (!(await body.evaluate((b) => b.scrollHeight > b.clientHeight + 100))) throw new Error("the answer is not long enough to scroll");
    const seen = () => page.evaluate(() => {
      const keys = document.querySelector(".review-keys")!.getBoundingClientRect();
      const orb = document.querySelector(".radio-orb")!.getBoundingClientRect();
      return [...document.querySelectorAll(".review-rate button")].map((b) => {
        const r = b.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { name: b.textContent, shown: r.top >= 0 && r.bottom <= keys.top && b.contains(top), underOrb: r.left < orb.right && r.bottom > orb.top };
      });
    });
    for (const at of ["top", "end"] as const) {
      await body.evaluate((b, at) => (b.scrollTop = at === "top" ? 0 : b.scrollHeight), at);
      const bad = (await seen()).filter((b) => !b.shown || b.underOrb);
      if (bad.length) throw new Error(`scrolled to the ${at}, a rating is out of view or under the radio: ${JSON.stringify(bad)}`);
    }
    await page.keyboard.press("Escape");
    await page.locator(".review").waitFor({ state: "detached" });
  } finally {
    await page.setViewportSize(size);
  }
});

journey("What to review: a list longer than its box fades its last row, and not once scrolled to the end (F436)", async (page) => {
  // The box is half the window's height: a short window stands in for a long list of skills.
  await page.setViewportSize({ width: 1280, height: 280 });
  await page.getByRole("button", { name: "Start review" }).click();
  const list = page.getByRole("dialog", { name: "What to review" }).locator(".pick-list");
  await list.waitFor();
  if (!(await list.evaluate((e) => e.scrollHeight > e.clientHeight + 1))) throw new Error("the seed's skills fit the box: nothing to fade");
  const faded = () => list.evaluate((e) => e.hasAttribute("data-more") && getComputedStyle(e, "::after").height === "32px");
  await until("the last row in view fades", faded);
  await list.evaluate((e) => e.scrollTo(0, e.scrollHeight));
  await until("no fade at the end", async () => !(await list.evaluate((e) => e.hasAttribute("data-more"))));
  await page.keyboard.press("Escape");
});

journey("Home and What to review: each skill's ring, numbers and gems keep their columns down the list (F439)", async (page) => {
  const lefts = (rows: string, parts: string) =>
    page.evaluate(([rows, parts]) => [...document.querySelectorAll(rows!)].map((r) => [...r.querySelectorAll(parts!)].map((c) => `${c.className.split(" ")[0]}@${Math.round(c.getBoundingClientRect().left)}`)).flat(), [rows, parts]);
  const oneColumnEach = (found: string[]) => {
    const at = new Map<string, Set<string>>();
    for (const f of found) at.set(f.split("@")[0]!, (at.get(f.split("@")[0]!) ?? new Set()).add(f.split("@")[1]!));
    return [...at].filter(([, xs]) => xs.size > 1).map(([name, xs]) => `${name} at ${[...xs].join(", ")}`);
  };
  await page.locator(".home-level .home-solid").first().waitFor();
  const home = await lefts(".home-level:has(.home-solid)", ".gem-ring, .near-goal");
  if (home.length < 2) throw new Error("the seed has fewer than two skills with a ring on Home");
  const off = oneColumnEach(home);
  if (off.length) throw new Error(`Home's columns drift: ${off.join("; ")}`);
  await page.getByRole("button", { name: "Start review" }).click();
  await page.getByRole("dialog", { name: "What to review" }).waitFor();
  const offPick = oneColumnEach(await lefts(".pick-gems", ".near, .loose"));
  if (offPick.length) throw new Error(`What to review's columns drift: ${offPick.join("; ")}`);
  await page.keyboard.press("Escape");
});

// F450: with the sidebar folded in a narrow window the reading column starts at the window's edge, and the
// ambience radio's corner sat over the first letters of its lines.
journey("ambience: in a narrow window with the sidebar folded the radio sits in the top bar, clear of the source's text, and still opens (F450)", async (page) => {
  const size = page.viewportSize()!;
  await openSource(page, TESTING);
  await page.setViewportSize({ width: 760, height: 600 });
  // A window this narrow folds the sidebar by itself when the source has its side panel open (App.tsx autoHide),
  // a moment after the resize: he folds it only when it will not.
  const folded = (await page.locator(".app.collapsed").count()) > 0 || (await page.getByRole("tab", { name: "Source note" }).count()) > 0;
  if (!folded) await page.getByRole("button", { name: "Hide sidebar" }).click();
  try {
    await page.locator(".app.collapsed").waitFor();
    const orb = page.getByRole("button", { name: /^Ambience/ });
    const over = () => page.evaluate(() => {
      const o = document.querySelector(".radio-orb")!.getBoundingClientRect(), d = document.querySelector(".reader-scroll")!.getBoundingClientRect();
      const text = document.querySelector(".reader-scroll .doc")!.getBoundingClientRect();
      return o.bottom > d.top && o.right > text.left && o.left < text.right;
    });
    await until("the radio is clear of the reading column", async () => !(await over()));
    await orb.click();
    const screen = page.locator(".popover.radio");
    await screen.waitFor();
    const box = (await screen.boundingBox())!;
    if (box.x < 0 || box.y < 0 || box.x + box.width > 760 || box.y + box.height > 600) throw new Error(`the radio's screen opens off the window: ${JSON.stringify(box)}`);
    await page.keyboard.press("Escape");
    await screen.waitFor({ state: "detached" });
  } finally {
    if (!folded) await page.getByRole("button", { name: "Show sidebar" }).click();
    await page.setViewportSize(size);
  }
});

// The guidebook's rule for "nothing comes back" (L246: add cues) and the brief's "a hint before a blank attempt":
// Hint shows the first key point's first letters, More gives half its words, then only No idea or Check is left.
journey("review: Hint before No idea shows first letters, then half the words; the rating records the hints taken and its suggestion is no higher than Hard", async (page) => {
  const calls = oreCalls(page);
  const q = page.locator(".review-q");
  try {
    await startReview(page, null);
    const hint = page.getByRole("button", { name: "Hint", exact: true });
    // Pass Fact exercises until an Explain one, which has the hint.
    for (let n = 0; n < 8 && !(await hint.isVisible()); n++) {
      await q.waitFor();
      if (await hint.isVisible()) break;
      await page.keyboard.press("Meta+l");
      await page.waitForTimeout(250);
    }
    await hint.click();
    const shown = page.getByLabel("Hint", { exact: true });
    const first = await shown.innerText();
    if (!/^\p{L}_*/u.test(first) || !first.includes("_")) throw new Error(`the first hint should be first letters and blanks: ${first}`);
    // ⌘' from the answer field gives the second, which shows whole words; then the hint button is gone.
    await page.getByRole("textbox", { name: "Your answer" }).focus();
    await page.keyboard.press("Meta+Quote");
    await until("the second hint shows whole words", async () => (await shown.innerText()) !== first && /\p{L}{2}/u.test(await shown.innerText()));
    if (await page.getByRole("button", { name: /^(Hint|More)$/ }).count()) throw new Error("a third hint was offered");
    await page.getByRole("textbox", { name: "Your answer" }).fill("Something I recalled with the hint");
    if (await page.getByText("⌘'").count()) throw new Error("the key bar still offers a hint once both are taken");
    await page.getByRole("radio", { name: "Think so" }).click();
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await page.getByRole("button", { name: "Good", exact: true }).waitFor();
    // Marking every key point got would suggest Good; with hints taken the suggestion stops at Hard.
    for (const box of await page.locator(".quiz-points .quiz-mark").all()) if ((await box.getAttribute("aria-pressed")) !== "true") await box.click();
    await until("Hard is suggested", async () => (await page.locator(".rate-2.suggested").count()) === 1);
    await page.getByRole("button", { name: "Hard", exact: true }).click();
    await until("the rating is sent with its hints", async () => calls.calls.some((a) => a[0] === "review" && a.includes("--cued=2") && a.includes("--rating=2")));
  } finally {
    await calls.undoAll();
    if (await page.locator(".review").count()) await page.keyboard.press("Escape");
    await page.locator(".review").waitFor({ state: "detached" }).catch(() => {});
  }
});
