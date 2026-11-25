import { type Page } from "playwright";
import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { answered, hold, isHeld, journey, LIB, loaded, ore, oreCalls, release, reveal, settled, startReview, until } from "../harness";

journey("Settings keeps focus inside as Tab and ⌥Tab run past its last control, as WebKit steps them (Codex sweep 3, a11y)", async (page) => {
  await page.keyboard.press("Meta+Comma");
  const sheet = page.locator(".settings-sheet");
  await sheet.waitFor();
  for (const key of ["Tab", "Alt+Tab", "Shift+Tab", "Shift+Alt+Tab"]) {
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press(key);
      await Bun.sleep(20);
      const where = await page.evaluate(() => (document.activeElement && document.activeElement !== document.body && !!document.activeElement.closest(".settings-sheet") ? "" : document.activeElement?.tagName ?? "nothing"));
      if (where) throw new Error(`${key} number ${i + 1} put focus on ${where}, outside Settings`);
    }
  }
  await page.keyboard.press("Escape");
}, "webkit");

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

// F541: Settings lists General first (D347) but a first open landed on Reading, one section down.
journey("Settings: a first open lands on General, the first section in its list", async (page) => {
  await page.evaluate(() => localStorage.removeItem("ore.settings"));
  await page.keyboard.press("Meta+Comma");
  const settings = page.getByRole("dialog", { name: "Settings" });
  await settings.waitFor();
  const on = await settings.getByRole("tab", { selected: true }).innerText();
  await page.keyboard.press("Escape");
  if (on.trim() !== "General") throw new Error(`a first open of Settings lands on ${on.trim()}, not General`);
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

journey("settings: ⌘Z while a new daily goal is being written takes back that goal, to the one before (Codex UX sweep 3)", async (page) => {
  const was = ((await ore("today")) as { goal_minutes: number }).goal_minutes;
  const goal = async () => ((await ore("today")) as { goal_minutes: number }).goal_minutes;
  try {
    await pickGoal(page, 15);
    await page.keyboard.press("Meta+Comma");
    await page.getByRole("tab", { name: "Review" }).click();
    await hold(page, "goal");
    await page.getByRole("radiogroup", { name: "Minutes a day" }).getByRole("radio", { name: "20", exact: true }).click();
    await until("its write is out", () => isHeld(page, "goal"));
    await page.keyboard.press("Meta+z");
    const landed = answered(page, "goal");
    await release(page, "goal");
    await landed;
    await Bun.sleep(600);
    await until("⌘Z took back 20, to 15", async () => (await goal()) === 15);
  } finally {
    await page.keyboard.press("Escape").catch(() => {});
    await ore("goal", "--minutes", String(was));
  }
});

/** Settings › Review › Minutes a day (or another of its choices), picked in Settings, which closes after. */
async function pickGoal(page: Page, min: number, row = "Minutes a day") {
  await page.keyboard.press("Meta+Comma");
  await page.getByRole("tab", { name: "Review" }).click();
  const seg = page.getByRole("radiogroup", { name: row });
  await seg.getByRole("radio", { name: String(min), exact: true }).click();
  await until(`${min} is picked`, async () => (await seg.getByRole("radio", { name: String(min), exact: true }).getAttribute("aria-checked")) === "true");
  await loaded(page);
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "Settings" }).waitFor({ state: "detached" });
}

journey("settings: a new daily goal reaches an open Review, and ⌘Z of it reaches Home (Codex sweep 4)", async (page) => {
  const log = oreCalls(page);
  const was = (await ore("today")) as { goal_minutes: number };
  await ore("goal", "--minutes", "30");
  try {
    await page.reload();
    await page.locator(".home-today .goal-of").waitFor();
    await startReview(page, null);
    // Paused on a card's source, as he would step out to Settings (⌘, is the app's, not Review's).
    const open = page.getByRole("button", { name: /Open in source/ });
    for (let n = 0; n < 6 && !(await open.isVisible()); n++) {
      const q = await page.locator(".review-q").innerText();
      await reveal(page);
      if (await open.isVisible()) break;
      await page.getByRole("button", { name: "Good", exact: true }).click();
      await until("the next card", async () => (await page.locator(".review-q").innerText()) !== q);
    }
    await open.click();
    await page.locator(".doc-head").waitFor();
    await pickGoal(page, 5);
    await page.getByRole("button", { name: /Back to Review/ }).click();
    await page.getByRole("button", { name: "Good", exact: true }).waitFor();
    // Six minutes of review, three a card (the cap per card): past the new goal of 5, short of the old 30.
    for (let n = 0; n < 2 && !(await page.locator(".review-goal").isVisible()); n++) {
      await page.evaluate(() => { const now = Date.now; Date.now = () => now() + 181_000; });
      const q = await page.locator(".review-q").innerText();
      if (!(await page.getByRole("button", { name: "Good", exact: true }).isVisible())) await reveal(page);
      await page.getByRole("button", { name: "Good", exact: true }).click();
      await until("the next card or the goal note", async () => (await page.locator(".review-goal").isVisible()) || (await page.locator(".review-q").innerText().catch(() => q)) !== q);
    }
    await page.locator(".review-goal").waitFor({ timeout: 10000 });
    await page.keyboard.press("Escape");
    await page.locator(".review-foot").getByRole("button", { name: "Done", exact: true }).click();
    await page.locator(".review").waitFor({ state: "detached" });
    const of = page.locator(".home-today .goal-of");
    await until("Home says of 5", async () => (await of.innerText()).includes("of 5 min"));
    await pickGoal(page, 15);
    await until("Home says of 15", async () => (await of.innerText()).includes("of 15 min"));
    await page.keyboard.press("Meta+z");
    await until("⌘Z puts Home back on 5", async () => (await of.innerText()).includes("of 5 min"));
  } finally {
    await log.undoAll();
    await ore("goal", "--minutes", String(was.goal_minutes));
  }
});

journey("settings: New exercises a day set to 0 mid-session holds back the new exercises still ahead (Codex sweep 4)", async (page) => {
  const log = oreCalls(page);
  const was = (await ore("today")) as { new_per_day: number };
  try {
    await startReview(page, null);
    const q = page.locator(".review-q");
    await q.waitFor();
    const open = page.getByRole("button", { name: /Open in source/ });
    await reveal(page);
    if (!(await open.isVisible())) throw new Error("the first exercise offers no Open in source");
    const ahead = (await page.evaluate(() => document.querySelector(".review-new") === null)) as boolean;
    if (!ahead) throw new Error("the first exercise is a new one: this journey wants a due one first");
    await open.click();
    await page.locator(".doc-head").waitFor();
    await pickGoal(page, 0, "New exercises a day");
    await page.getByRole("button", { name: /Back to Review/ }).click();
    await page.getByRole("button", { name: "Good", exact: true }).waitFor();
    // Rate through the rest: none is a new exercise any more (one in five was, D144).
    for (let n = 0; n < 8 && (await q.isVisible()); n++) {
      const was = await q.innerText();
      if (n > 0 && (await page.locator(".review-new").isVisible())) throw new Error(`“${was}” is new, past a limit of 0`);
      if (!(await page.getByRole("button", { name: "Good", exact: true }).isVisible())) await reveal(page);
      await page.getByRole("button", { name: "Good", exact: true }).click();
      await until("the next card or the end", async () => !(await q.isVisible()) || (await q.innerText()) !== was);
    }
  } finally {
    await page.keyboard.press("Escape");
    await log.undoAll();
    await ore("goal", `--new-per-day=${was.new_per_day}`);
  }
});

journey("settings: a When you review that fails to save keeps the words he typed (Codex sweep 4)", async (page) => {
  const was = (await ore("today")) as { plan: string };
  try {
    await page.keyboard.press("Meta+Comma");
    await page.getByRole("tab", { name: "Review" }).click();
    const field = page.getByLabel("After what do you review?");
    await field.fill("before my study block");
    await field.press("Enter");
    await until("the cue saved", async () => ((await ore("today")) as { plan: string }).plan === "before my study block");
    await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { goal: "The disk is unavailable." }));
    await field.fill("keep these unsaved words");
    await field.press("Enter");
    await page.locator(".toast").filter({ hasText: "The disk is unavailable." }).waitFor();
    await page.waitForTimeout(300);
    if ((await field.inputValue()) !== "keep these unsaved words") throw new Error(`the field went back to “${await field.inputValue()}”: his words are lost`);
  } finally {
    await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
    await page.keyboard.press("Escape");
    await ore("goal", "--plan", was.plan);
  }
});

journey("settings: a value in skills.yaml Ore can't use is named in Settings, not used silently (Codex sweep 4)", async (page) => {
  const file = join(LIB, "skills.yaml");
  const was = readFileSync(file, "utf8");
  // An earlier journey may have saved a review section: change its goal there, or add one.
  const bad = /^review:$/m.test(was) ? (/^  goal_minutes: .*$/m.test(was) ? was.replace(/^  goal_minutes: .*$/m, "  goal_minutes: -1") : was.replace(/^review:$/m, "review:\n  goal_minutes: -1")) : `${was.trimEnd()}\nreview:\n  goal_minutes: -1\n`;
  writeFileSync(file, bad);
  try {
    await page.keyboard.press("Meta+Comma");
    await page.getByRole("dialog", { name: "Settings" }).getByText("review.goal_minutes is -1").waitFor();
    await page.keyboard.press("Escape");
  } finally {
    writeFileSync(file, was);
  }
});

journey("settings: a goal set outside the list (ore goal --minutes 7) shows picked in Minutes a day (Codex sweep 4)", async (page) => {
  const was = (await ore("today")) as { goal_minutes: number };
  await ore("goal", "--minutes", "7");
  try {
    await page.reload();
    await page.keyboard.press("Meta+Comma");
    await page.getByRole("tab", { name: "Review" }).click();
    const seven = page.getByRole("radio", { name: "7", exact: true });
    await seven.waitFor();
    if ((await seven.getAttribute("aria-checked")) !== "true") throw new Error("7 is offered but not picked");
    await page.keyboard.press("Escape");
  } finally {
    await ore("goal", "--minutes", String(was.goal_minutes));
  }
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

journey("settings: ⌘Z after closing and reopening Settings shows the goal it put back", async (page) => {
  const open = async () => {
    await page.keyboard.press("Meta+Comma");
    await page.getByRole("tab", { name: "Review" }).click();
  };
  const minutes = page.getByRole("group", { name: "Minutes a day" }).or(page.getByRole("radiogroup", { name: "Minutes a day" }));
  const on = async () => (await minutes.locator("[data-state=on]").innerText()).trim();
  await open();
  const was = await on();
  const other = was === "30" ? "5" : "30";
  await minutes.getByText(other, { exact: true }).click();
  await until("the new goal shows", async () => (await on()) === other);
  await page.waitForTimeout(300); // the save lands and goes on the history
  await page.keyboard.press("Escape");
  await open();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Meta+z");
  await until("⌘Z shows the old goal in the Settings now open", async () => (await on()) === was);
  await page.keyboard.press("Escape");
});

journey("settings: rapid choices save in order across reopening (F145)", async (page) => {
  await ore("goal", "--minutes=10");
  await page.keyboard.press("Meta+,");
  const panel = page.getByRole("dialog", { name: "Settings" });
  await panel.getByRole("tab", { name: "Review", exact: true }).click();
  const goal = panel.getByRole("radiogroup", { name: "Minutes a day", exact: true });
  await goal.getByRole("radio", { name: "10", exact: true }).waitFor();
  await hold(page, "goal");
  await goal.getByRole("radio", { name: "5", exact: true }).click();
  await until("the first goal change is held", () => isHeld(page, "goal"));
  await goal.getByRole("radio", { name: "10", exact: true }).click();
  await page.waitForTimeout(200); // allow an incorrectly concurrent newer write to land first
  await release(page, "goal");
  await until("both changes have settled", () => page.evaluate(() => !(window as unknown as { __ORE_PENDING: number }).__ORE_PENDING));
  if ((await ore("settings") as { review: { goal_minutes: number } }).review.goal_minutes !== 10) throw new Error("the older goal overwrote the last choice of 10");
  await panel.getByRole("button", { name: "Close settings" }).click();
  await page.keyboard.press("Meta+,");
  await until("reopening shows the saved last choice", async () => (await goal.locator('[aria-checked="true"]').innerText()) === "10");
  // Closing Settings must not create a second independent write queue.
  await hold(page, "goal");
  await goal.getByRole("radio", { name: "5", exact: true }).click();
  await until("the old panel's write is held", () => isHeld(page, "goal"));
  await panel.getByRole("button", { name: "Close settings" }).click();
  await page.keyboard.press("Meta+,");
  await release(page, "goal");
  await until("the reopened panel waits for pending writes", async () => (await goal.locator('[aria-checked="true"]').innerText()) === "5");
  await goal.getByRole("radio", { name: "10", exact: true }).click();
  await until("the final choice is saved", async () => (await ore("settings") as { review: { goal_minutes: number } }).review.goal_minutes === 10);
});

journey("settings: a failed older choice does not roll back the latest choice (F145)", async (page) => {
  await ore("goal", "--minutes=10", "--new-per-day=10");
  await page.keyboard.press("Meta+,");
  const panel = page.getByRole("dialog", { name: "Settings" });
  await panel.getByRole("tab", { name: "Review", exact: true }).click();
  const goal = panel.getByRole("radiogroup", { name: "Minutes a day", exact: true });
  await goal.getByRole("radio", { name: "10", exact: true }).waitFor();
  await page.route("**/ore", async (route) => {
    const args = (route.request().postDataJSON() as { args: string[] }).args;
    if (args[0] === "goal" && args.includes("--minutes=5")) return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify("The disk refused this change. Try again.") });
    await route.continue();
  });
  await hold(page, "goal");
  await goal.getByRole("radio", { name: "5", exact: true }).click();
  await until("the older write is held", () => isHeld(page, "goal"));
  await goal.getByRole("radio", { name: "15", exact: true }).click();
  await release(page, "goal");
  await page.locator(".toast").filter({ hasText: "The disk refused" }).waitFor();
  await until("the later choice survives the failure", async () => (await ore("settings") as { review: { goal_minutes: number } }).review.goal_minutes === 15 && (await goal.locator('[aria-checked="true"]').innerText()) === "15");
  // A later change to another setting must not carry the failed field into displayed state.
  const fresh = panel.getByRole("radiogroup", { name: "New exercises a day", exact: true });
  await hold(page, "goal");
  await goal.getByRole("radio", { name: "5", exact: true }).click();
  await until("the failing choice waits before a different setting", () => isHeld(page, "goal"));
  await fresh.getByRole("radio", { name: "20", exact: true }).click();
  await release(page, "goal");
  await until("both displayed fields match what saved", async () => (await fresh.locator('[aria-checked="true"]').innerText()) === "20" && (await goal.locator('[aria-checked="true"]').innerText()) === "15");
  // A latest choice that fails rolls back to the actual saved value and can be tried again.
  await goal.getByRole("radio", { name: "5", exact: true }).click();
  await until("a failed latest choice returns to the saved value", async () => (await goal.locator('[aria-checked="true"]').innerText()) === "15");
  await page.unroute("**/ore");
  await fresh.getByRole("radio", { name: "10", exact: true }).click();
  await goal.getByRole("radio", { name: "10", exact: true }).click();
  await until("the queue still accepts changes after failure", async () => (await ore("settings") as { review: { goal_minutes: number } }).review.goal_minutes === 10);
});

journey("Settings: a click outside the sheet saves the review plan he typed (D211, sweep 5)", async (page) => {
  await page.keyboard.press("Meta+Comma");
  const settings = page.getByRole("dialog", { name: "Settings" });
  await settings.getByRole("tab", { name: "Review" }).click();
  const plan = settings.getByLabel("After what do you review?");
  const was = await plan.inputValue();
  await plan.click();
  await plan.fill("my pointer coffee");
  await page.mouse.click(8, 400); // the app's margin around the sheet
  await settings.waitFor({ state: "detached" });
  await page.keyboard.press("Meta+Comma");
  await settings.getByRole("tab", { name: "Review" }).click();
  await until("the plan was saved", async () => (await plan.inputValue()) === "my pointer coffee");
  await plan.fill(was);
  await page.keyboard.press("Enter");
  await settled(page);
  await page.keyboard.press("Escape");
});

journey("Settings: each section opens at its top, however far the last one was scrolled (F296)", async (page) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  const settings = page.getByRole("dialog", { name: "Settings" });
  await page.keyboard.press("Meta+Comma");
  await settings.waitFor();
  await settings.getByRole("tab", { name: "Review" }).click();
  const main = settings.locator(".settings-main");
  // Scrolled again on each look: the section's settings come in a moment after the tab opens, and a scroll made
  // before then had nowhere to go (F524).
  await until("Review scrolls", () => main.evaluate((el) => ((el.scrollTop = el.scrollHeight), el.scrollTop > 0)));
  await settings.getByRole("tab", { name: "Keyboard shortcuts" }).click();
  await until("Keyboard shortcuts opens at its top", () => main.evaluate((el) => el.scrollTop === 0));
  await settings.getByRole("tab", { name: "Review" }).click();
  await page.keyboard.press("Escape");
});

journey("Settings: enlarged to 200% the sections run across the top and no choice is cut off (F259)", async (page) => {
  // A 1280 px window at 200% is 640 px to the page.
  await page.setViewportSize({ width: 640, height: 400 });
  const settings = page.getByRole("dialog", { name: "Settings" });
  await page.keyboard.press("Meta+Comma");
  await settings.waitFor();
  const tabs = settings.getByRole("tab");
  const n = await tabs.count();
  // General first and shortcuts last, as a Mac app's settings run; between them the order he works in (D347).
  const names = (await tabs.allInnerTexts()).map((t) => t.trim()).join(", ");
  if (names !== "General, Reading, Review, AI, Keyboard shortcuts") throw new Error(`the sections read: ${names}`);
  const tops = await tabs.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
  if (new Set(tops).size !== 1) throw new Error(`the sections are not one row across the top: tops ${tops.join(", ")}`);
  for (let i = 0; i < n; i++) {
    await tabs.nth(i).click();
    const name = await tabs.nth(i).innerText();
    const cut = await settings.locator(".settings-main").evaluate((main) => {
      const edge = main.getBoundingClientRect().right;
      return [...main.querySelectorAll(".settings-row-control > *, .settings-row-text")].filter((el) => el.getBoundingClientRect().right > edge + 0.5).map((el) => (el.getAttribute("aria-label") ?? el.textContent ?? "").slice(0, 40));
    });
    if (cut.length) throw new Error(`${name}: cut off at the sheet's edge: ${cut.join(" | ")}`);
  }
  // In a row, the arrows that move along it change the section.
  await tabs.nth(0).click();
  await page.keyboard.press("ArrowRight");
  await until("→ opens the next section", async () => (await tabs.nth(1).getAttribute("aria-selected")) === "true");
  await tabs.nth(0).click();
  await page.keyboard.press("Escape");
});

journey("Settings: the reading sample follows each choice as it is made (D312)", async (page) => {
  const settings = page.getByRole("dialog", { name: "Settings" });
  await page.keyboard.press("Meta+Comma");
  await settings.waitFor();
  await settings.getByRole("tab", { name: "Reading" }).click();
  const sample = settings.locator(".settings-sample .doc");
  const look = () => sample.evaluate((el) => { const c = getComputedStyle(el); return { size: c.fontSize, face: c.fontFamily, lead: c.lineHeight, ink: c.color }; });
  const was = await look();
  await settings.getByRole("button", { name: "Bigger text" }).click();
  await until("the sample's text grows", async () => (await look()).size !== was.size);
  await settings.getByRole("radio", { name: "Geist" }).click();
  await until("the sample changes face", async () => (await look()).face !== was.face);
  await settings.getByRole("radio", { name: "Loose" }).click();
  await settings.getByRole("radio", { name: "Light" }).click();
  await until("the sample turns to the light page", async () => (await look()).ink !== was.ink);
  // Back as it was: the next journey reads on the defaults.
  await settings.getByRole("radio", { name: "Dark" }).click();
  await settings.getByRole("radio", { name: "Normal" }).click();
  await settings.getByRole("radio", { name: "Charter" }).click();
  await settings.getByRole("button", { name: "Default" }).click();
  await until("the sample is back", async () => JSON.stringify(await look()) === JSON.stringify(was));
  await page.keyboard.press("Escape");
});
