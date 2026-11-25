import { type Page } from "playwright";
import { AGENTS, answered, awayAndBack, BRIDGE, failNext, hold, isHeld, journey, loaded, openSource, ore, oreCalls, release, reveal, type Rigged, searchPick, select, settled, startReview, TESTING, type TryRec, until } from "../harness";

journey("skill page: To read's and Questions' heads line up, caret over caret and icon over icon", async (page) => {
  await page.getByRole("button", { name: /^Learning/ }).first().click();
  await page.locator(".skill-col.side .card-head .card-icon").nth(1).waitFor();
  const xs = await page.evaluate(() =>
    [...document.querySelectorAll(".skill-col.side .card-head")].map((h) => [".caret", ".card-icon"].map((s) => Math.round(h.querySelector(s)!.getBoundingClientRect().left))),
  );
  if (new Set(xs.map((x) => x.join())).size !== 1) throw new Error(`heads don't line up: ${JSON.stringify(xs)}`);
  // The fold caret is the head's last control, at the far right: beside the tabs it read as one more view (D226).
  const last = await page.evaluate(() => [...document.querySelectorAll(".skill-col.side .card-head")].every((h) => [...h.querySelectorAll("button")].at(-1)?.classList.contains("fold-head")));
  if (!last) throw new Error("the fold caret is not the last control of its section's head");
});

journey("skill page search: the magnifying glass in To read and Questions opens a field; a typo still finds the row, ↓ moves into it, Esc clears then closes (D203)", async (page) => {
  await page.getByRole("button", { name: /^Learning/ }).first().click();
  const side = page.locator(".skill-col.side");
  const titles = () => side.locator(".list .row").allInnerTexts();
  await until("the sources are listed", async () => (await titles()).length > 1);
  const all = (await titles()).length;
  await page.getByRole("button", { name: "Search sources" }).click();
  await page.keyboard.type("retreival");
  await until("a typo finds the source by its title", async () => {
    const t = await titles();
    return t.length > 0 && t.length < all && t[0]!.includes("Retrieval Beats Rereading");
  });
  await page.keyboard.press("Escape");
  await until("Esc clears the search and the list is whole again", async () => (await titles()).length === all);
  await page.keyboard.press("Escape");
  await until("a second Esc closes the field, focus back on its button", async () => (await page.evaluate(() => document.activeElement?.tagName + ":" + document.activeElement?.getAttribute("aria-label"))) === "BUTTON:Search sources");

  const asked = "Does interleaving beat blocking for motor skills?";
  await page.getByRole("button", { name: "Add a question" }).first().click();
  await page.getByLabel("New question").fill(asked);
  await page.keyboard.press("Enter");
  const rows = side.locator(".question-quote");
  await rows.filter({ hasText: asked }).waitFor();
  await page.getByRole("button", { name: "Search questions" }).click();
  await page.keyboard.type("interleving");
  await until("a typo finds the question alone", async () => (await rows.count()) === 1 && (await rows.first().innerText()).includes(asked));
  await page.keyboard.press("ArrowDown");
  if (!(await rows.first().evaluate((b) => b === document.activeElement))) throw new Error("↓ from the search didn't move to the question it found");
  await page.getByLabel("Search questions").fill("zzzz");
  await side.getByText("No questions match “zzzz”.").waitFor();
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

journey("the skill picker is named, and says which skills are ticked apart from the row the arrows are on (Codex sweep 3, a11y)", async (page) => {
  await openSource(page, TESTING);
  await page.getByRole("button", { name: `Skills for ${TESTING}` }).click();
  const picker = page.locator(".skill-picker");
  await picker.waitFor();
  if ((await picker.getAttribute("aria-label")) !== "Skills") throw new Error("the picker has no name");
  const filed = ((await ore("ls")) as { title: string; skills: string[] }[]).find((i) => i.title === TESTING)!.skills;
  const rows = await picker.locator("[cmdk-item]").evaluateAll((els) => els.map((e) => [e.getAttribute("data-value"), e.getAttribute("aria-checked")]));
  for (const [id, checked] of rows) if (id && !id.startsWith("create") && (checked === "true") !== filed.includes(id)) throw new Error(`${id} says checked=${checked}, filed: ${filed.join(", ")}`);
  await page.keyboard.press("Escape");
});

journey("archiving a skill's last source takes its questions off the open skill page at once (Codex sweep 3, lifecycle)", async (page) => {
  const k = (await ore("skills", "add", "Ropework")) as { id: string };
  const title = "Knots for a ridge line";
  const made = (await fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich", `--skill=${k.id}`], stdin: `# ${title}\n\nA taut-line hitch slides to tension and holds under load.` }) }).then((r) => r.json())) as { id: string };
  await ore("highlight", made.id, "--exact", "A taut-line hitch slides to tension", "--intent", "question");
  try {
    await page.reload();
    await page.getByRole("button", { name: /^Ropework/ }).first().click();
    const question = page.locator(".skill-col .question-quote", { hasText: "A taut-line hitch" });
    await question.waitFor();
    await page.locator(".skill-col .row", { hasText: title }).first().click({ button: "right" });
    await page.getByRole("menuitem", { name: /^Archive/ }).click();
    await until("the archived source's question leaves the page", async () => (await question.count()) === 0);
  } finally {
    await ore("archive", made.id).catch(() => {});
    await ore("skills", "rm", k.id).catch(() => {});
  }
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

journey("icon picker: it opens with the caret in Filter, so typing searches at once (Notion), from Edit skill and the skill page", async (page) => {
  const typed = async () => {
    await page.locator(".picker-search").first().waitFor();
    await page.keyboard.type("star");
    await until("Filter has what he typed", async () => (await page.locator(".picker-search").first().inputValue()) === "star");
    await page.keyboard.press("Escape");
    await page.locator(".picker").waitFor({ state: "detached" });
  };
  await page.locator(".sidebar .side-item", { hasText: "Habits" }).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit skill…" }).click();
  await page.getByRole("dialog", { name: "Edit skill Habits" }).getByRole("button", { name: "Change icon" }).click();
  await typed();
  await page.keyboard.press("Escape");
  await page.locator(".sidebar .side-item", { hasText: "Storytelling" }).first().click();
  await page.locator(".skill-badge").click();
  await typed();
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

journey("icon picker: ↓ past the visible rows scrolls and keeps the picked icon in view", async (page) => {
  await page.locator(".sidebar .side-item", { hasText: "Habits" }).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit skill…" }).click();
  await page.getByRole("dialog", { name: "Edit skill Habits" }).getByRole("button", { name: "Change icon" }).click();
  await page.locator(".picker-cell").nth(100).waitFor();
  for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowDown"); // past the rows the box shows
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

journey("skill page: Mark answered on a question, ⌘Z reopens it", async (page) => {
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  const open = () => page.getByText("Does this hold for kids?", { exact: true }).filter({ visible: true }).count();
  await until("the question is listed", async () => (await open()) > 0);
  await page.getByText("Does this hold for kids?", { exact: true }).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Mark answered" }).click();
  await until("it leaves the open questions", async () => (await open()) === 0);
  // The header's Answered tab (D226) shows it; the Questions tab goes back to the open ones.
  const tabs = page.getByRole("tablist", { name: "Questions shown" });
  await tabs.getByRole("tab", { name: "Answered" }).click();
  await until("the Answered tab lists it", async () => (await open()) > 0);
  if ((await tabs.getByRole("tab", { name: "Answered" }).getAttribute("aria-selected")) !== "true") throw new Error("the Answered tab is not the open one");
  await page.keyboard.press("ArrowLeft");
  await until("← moves back to the open questions", async () => (await tabs.getByRole("tab", { name: "Questions" }).getAttribute("aria-selected")) === "true" && (await open()) === 0);
  await page.waitForTimeout(300);
  await page.keyboard.press("Meta+z");
  await until("⌘Z reopens it", async () => (await open()) > 0);
});

journey("skill page: the sources' folder tabs show To read, Done and the row details menu", async (page) => {
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  const tabs = page.getByRole("tablist", { name: "Sources shown" });
  const on = (name: string) => tabs.getByRole("tab", { name }).getAttribute("aria-selected");
  await until("To read is the open tab", async () => (await on("To read")) === "true");
  // F36: the header's gems load after the page; the tabs under it stay where they were when they land.
  const tabY = async () => (await tabs.getByRole("tab", { name: "To read" }).boundingBox())!.y;
  const y0 = await tabY();
  await page.locator(".hero-strength").waitFor();
  if (await page.locator(".hero-strength .strength-line").isVisible()) throw new Error("the iPhone's rock line shows on the Mac's skill page");
  if ((await tabY()) !== y0) throw new Error(`the tabs moved from ${y0} to ${await tabY()} when the header's gems loaded`);
  await tabs.getByRole("tab", { name: "Done" }).hover();
  await page.getByRole("tooltip").filter({ hasText: "Done" }).waitFor();
  await tabs.getByRole("tab", { name: "Done" }).click();
  await until("a click opens Done", async () => (await on("Done")) === "true" && (await on("To read")) === "false");
  await page.getByRole("button", { name: "Row details" }).click();
  await page.getByRole("menuitemcheckbox").first().waitFor();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Meta+1");
  await until("⌘1 goes back to To read", async () => (await on("To read")) === "true");
  // Arrows walk the tabs as in any tab list: the open tab keeps focus, so a second arrow goes on (F44).
  await tabs.getByRole("tab", { name: "To read" }).click();
  await page.keyboard.press("ArrowRight");
  await until("→ opens Done", async () => (await on("Done")) === "true");
  // A frame later is when the list used to take focus from the tab.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.keyboard.press("ArrowLeft");
  await until("a second arrow goes back to To read", async () => (await on("To read")) === "true");
  // Also on a skill page opened from Home, whose tab used to remount the page under the focused tab (F55).
  await page.getByRole("button", { name: /^Home/ }).click();
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  await tabs.getByRole("tab", { name: "To read" }).click();
  await page.keyboard.press("ArrowRight");
  await until("→ from Home's skill page opens Done", async () => (await on("Done")) === "true");
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  if (!(await page.evaluate(() => !!document.activeElement?.closest("[role=tablist]")))) throw new Error("the tab lost focus on a skill page opened from Home");
  await page.keyboard.press("ArrowLeft");
  await until("a second arrow on Home's skill page goes back to To read", async () => (await on("To read")) === "true");
  // ⌘2, even from a focused tab, hands the keys to the list (Linear).
  await page.keyboard.press("Meta+2");
  await until("⌘2 focuses the list", () => page.evaluate(() => document.activeElement?.matches(".list") ?? false));
});

journey("try it: 4 marks a technique, the Forge makes it the one he is trying, each use is kept (through a failed save and a reload), and the third makes it his", async (page) => {
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
  await until("the plan is saved", async () => JSON.stringify(await ore("tries")).includes("Quiz myself before each edit session"));
  const PLAN = "Quiz myself before each edit session";
  /** Its page, from the skill page through the Forge. */
  const openTry = async () => {
    await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
    await page.getByRole("button", { name: "Forge" }).click();
    await page.locator(".forge-open").filter({ hasText: PLAN }).click();
    await page.locator(".try-title").filter({ hasText: PLAN }).waitFor();
  };
  await openTry();
  // Another journey's try may be the one in the works: he picks this one.
  const pick = page.locator(".try-go", { hasText: "Try this now" });
  if (await pick.count()) await pick.click();
  // The plan's cue, written in place: Enter saves it.
  await page.getByLabel("When").fill("I sit down to edit");
  await page.keyboard.press("Enter");
  await until("the cue is saved", async () => ((await ore("tries")) as { note?: string; when?: string }[]).some((t) => t.note === PLAN && t.when === "I sit down to edit"));
  await page.locator(".try-go", { hasText: "I did it" }).click();
  const field = page.getByLabel("How did it go?");
  await field.fill("Caught two gaps before recording");
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { tried: "The library is read-only." }));
  await page.keyboard.press("Enter");
  await page.locator(".toast[role=alert]").filter({ hasText: "The library is read-only." }).waitFor();
  if (!(await field.isVisible()) || (await field.inputValue()) !== "Caught two gaps before recording") throw new Error("the failed save lost what he wrote");
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
  await field.focus();
  await page.keyboard.press("Enter");
  const round = page.locator(".try-round", { hasText: "Caught two gaps before recording" });
  await round.waitFor();
  if (await page.getByRole("button", { name: "It’s mine" }).count()) throw new Error("It's mine was offered before the third use");
  await Bun.sleep(500);
  await page.reload();
  await openTry();
  await round.waitFor();
  // The skill page shows it in one line with its cue; its box asks how it went there too.
  await page.locator(".crumbs button").first().click();
  const now = page.locator(".try-now").filter({ hasText: PLAN });
  await now.waitFor();
  if (!(await now.innerText()).includes("I sit down to edit")) throw new Error("the line lost its cue");
  await now.getByRole("checkbox", { name: "I did it" }).click();
  await page.getByLabel("How did it go?").fill("Faster this time");
  await page.getByRole("button", { name: "Again" }).click();
  await page.getByLabel("How did it go?").waitFor({ state: "detached" });
  await until("the second use is kept", async () => ((await ore("tries")) as { note?: string; uses?: unknown[] }[]).find((t) => t.note === PLAN)?.uses?.length === 2);
  // The third use: it can be his, and then it is a tool beside the goal.
  await now.getByRole("checkbox", { name: "I did it" }).click();
  await page.getByLabel("How did it go?").fill("No notes needed");
  await page.getByRole("button", { name: "It’s mine" }).click();
  const tool = page.getByRole("button", { name: `Yours: ${PLAN}` });
  await tool.waitFor();
  if (await now.count()) throw new Error("a try that is his is still the one in the works");
  // ⌘Z takes it back: it is the one he is trying again, with its two uses.
  await page.locator(".skill-page, main").first().click({ position: { x: 2, y: 2 } }).catch(() => {});
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Meta+z");
  await until("⌘Z puts it back in the works", async () => (await tool.count()) === 0 && (await now.count()) === 1);
  const mine = ((await ore("tries")) as { note?: string; status: string; uses?: unknown[]; reflection?: string }[]).find((t) => t.note === PLAN);
  if (!mine || mine.status !== "open" || mine.uses?.length !== 2 || mine.reflection) throw new Error(`the library kept it as his: ${JSON.stringify(mine)}`);
});

journey("forge: a use written up keeps its moment, the mole says one line under it, and the keys land in When for a new one (D324)", async (page) => {
  await page.locator(".sidebar .side-item", { hasText: /^Focus & Attention$/ }).first().click();
  await page.getByRole("button", { name: "Forge" }).click();
  await page.getByRole("button", { name: "Add something to try" }).click();
  await page.getByLabel("I’ll…").fill("Phone in the other room");
  await page.getByLabel("When…").fill("I sit down to write");
  await page.keyboard.press("Enter");
  const row = page.locator(".forge-row").filter({ hasText: "Phone in the other room" });
  await row.locator(".forge-open").click();
  const id = (await page.locator(".try-page").getAttribute("data-try"))!;
  try {
    await page.getByRole("button", { name: "I did it" }).click();
    await page.getByLabel("How did it go?").fill("Wrote for an hour without checking it.");
    await page.keyboard.press("Enter");
    const use = page.locator(".try-use").filter({ hasText: "Wrote for an hour without checking it." });
    await use.locator("small").filter({ hasText: "I sit down to write" }).waitFor();
    await use.locator(".try-mole").filter({ hasText: "Cut the rewind to two beats" }).waitFor();
    // The next use somewhere new: When has the keys with its words selected, so typing replaces them...
    await until("the keys are in When, its words selected", () => page.evaluate(() => { const f = document.activeElement as HTMLTextAreaElement | null; return !!f?.closest(".plan-line") && f.selectionStart === 0 && f.selectionEnd === f.value.length && f.value === "I sit down to write"; }));
    await page.keyboard.type("I open my inbox");
    await page.keyboard.press("Enter");
    await until("the new cue is saved", async () => ((await ore("tries", "--skill", "focus-attention")) as { id: string; when?: string }[]).find((t) => t.id === id)?.when === "I open my inbox");
    // ...and the use keeps the moment it happened in.
    await use.locator("small").filter({ hasText: "I sit down to write" }).waitFor();
  } finally {
    await page.locator(".sidebar .side-item").first().click().catch(() => {}); // off the try's page before it goes
    await ore("annotate", id, "--status", "deleted");
  }
});

journey("forge: a try typed with no passage waits, Try this now swaps it in, and Remove takes it out with Undo", async (page) => {
  await page.locator(".sidebar .side-item", { hasText: /^Creativity$/ }).first().click();
  await page.getByRole("button", { name: "Forge" }).click();
  await page.getByRole("button", { name: "Add something to try" }).click();
  await page.getByLabel("I’ll…").fill("Lay out running shoes the night before");
  await page.getByLabel("When…").fill("I brush my teeth");
  await page.keyboard.press("Enter");
  const row = page.locator(".forge-row").filter({ hasText: "Lay out running shoes the night before" });
  await row.waitFor();
  await page.getByRole("button", { name: "Add something to try" }).click();
  await page.getByLabel("I’ll…").fill("Walk before the first coffee");
  await page.keyboard.press("Enter");
  const second = page.locator(".forge-row").filter({ hasText: "Walk before the first coffee" });
  await until("the first he added is the one in the works, the second waits", async () => (await row.getAttribute("data-state")) === "now" && (await second.getAttribute("data-state")) === "waiting");
  // Neither is a source: the skill's list and All sources don't show them.
  if (((await ore("ls")) as { title: string }[]).some((i) => /running shoes|first coffee/.test(i.title))) throw new Error("a typed try is listed as a source");
  await second.hover();
  await second.getByRole("button", { name: "Try this now" }).click();
  await until("the pick swaps them", async () => (await second.getAttribute("data-state")) === "now" && (await row.getAttribute("data-state")) === "waiting");
  // ↓ from a row moves to the next; Enter opens its page; the crumb goes back.
  await second.locator(".forge-open").focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.locator(".try-title").filter({ hasText: "Lay out running shoes the night before" }).waitFor();
  if (await page.locator(".try-from").count()) throw new Error("a typed try shows a passage it never had");
  await page.locator(".crumbs button", { hasText: "Forge" }).click();
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Remove" }).click();
  await until("the row is gone", async () => (await row.count()) === 0);
  await page.locator(".toast").filter({ hasText: "Removed" }).getByRole("button", { name: "Undo" }).click();
  await row.waitFor();
  // Back steps through the pages like any view: the try's page he came from, the Forge, then the skill.
  const back = page.getByRole("button", { name: "Back", exact: true }).first();
  await back.click();
  await page.locator(".try-title").waitFor();
  await back.click();
  await page.locator(".forge-row").first().waitFor();
  await back.click();
  await page.locator(".skill-hero").waitFor();
});

/** A try he types into the Forge of `skill`, opened on its own page; returns its id. */
async function newTry(page: Page, skill: string, plan: string) {
  await page.locator(".sidebar .side-item", { hasText: new RegExp(`^${skill}$`) }).first().click();
  await page.getByRole("button", { name: "Forge" }).click();
  await page.getByRole("button", { name: "Add something to try" }).click();
  await page.getByLabel("I’ll…").fill(plan);
  await page.keyboard.press("Enter");
  await page.locator(".forge-row").filter({ hasText: plan }).locator(".forge-open").click();
  return (await page.locator(".try-page").getAttribute("data-try"))!;
}

const tryById = async (id: string) => ((await ore("tries", "--skill", "creativity")) as TryRec[]).find((t) => t.id === id);

journey("forge: ⌘Z while a plan edit is still being written takes back that edit, never the try (Codex UX sweep)", async (page) => {
  const id = await newTry(page, "Creativity", "Sketch one idea before lunch");
  try {
    await hold(page, "try");
    const when = page.locator(".plan-line", { hasText: /^When/ }).locator("textarea");
    await when.click();
    await page.keyboard.type("After breakfast");
    await page.keyboard.press("Enter");
    await until("the plan's write is out", () => isHeld(page, "try"));
    await page.keyboard.press("Meta+z");
    await release(page, "try");
    await until("the When edit is taken back", async () => (await tryById(id))?.when === "" || (await tryById(id))?.when === undefined);
    if (!(await tryById(id))) throw new Error("⌘Z took the whole try away");
    await page.locator(".try-page").waitFor();
  } finally {
    await page.locator(".sidebar .side-item").first().click().catch(() => {});
    await ore("annotate", id, "--status", "deleted");
  }
});

journey("forge: Again pressed twice while its use is being saved keeps one use (Codex UX sweep)", async (page) => {
  const id = await newTry(page, "Creativity", "Write three bad first lines");
  try {
    const go = page.getByRole("button", { name: "Try this now" });
    if (await go.count()) await go.click();
    await page.getByRole("button", { name: "I did it" }).first().click();
    await page.getByLabel("How did it go?").fill("Two were usable.");
    await hold(page, "tried");
    const again = page.getByRole("button", { name: "Again" });
    await again.click();
    await until("the use's write is out", () => isHeld(page, "tried"));
    await again.click({ timeout: 1000 }).catch(() => {});
    await release(page, "tried");
    await until("the use is saved", async () => ((await tryById(id))?.uses?.length ?? 0) > 0);
    await Bun.sleep(500);
    const n = (await tryById(id))?.uses?.length;
    if (n !== 1) throw new Error(`one use was saved ${n} times`);
  } finally {
    await page.locator(".sidebar .side-item").first().click().catch(() => {});
    await ore("annotate", id, "--status", "deleted");
  }
});

journey("forge: a try typed with the pointer is added with its Add button (Codex UX sweep)", async (page) => {
  await page.locator(".sidebar .side-item", { hasText: /^Creativity$/ }).first().click();
  await page.getByRole("button", { name: "Forge" }).click();
  await page.getByRole("button", { name: "Add something to try" }).click();
  const add = page.locator(".forge-add").getByRole("button", { name: "Add", exact: true });
  if (!(await add.isDisabled())) throw new Error("Add is live with nothing typed");
  await page.getByLabel("I’ll…").fill("Hum the tune before writing it down");
  await hold(page, "try");
  await add.click();
  await until("the add's write is out", () => isHeld(page, "try"));
  await add.click({ timeout: 1000 }).catch(() => {}); // a double-click, or a second Enter
  await release(page, "try");
  const row = page.locator(".forge-row").filter({ hasText: "Hum the tune before writing it down" });
  await row.first().waitFor();
  await page.waitForLoadState("networkidle");
  const made = ((await ore("tries", "--skill", "creativity")) as { id: string; note?: string }[]).filter((x) => x.note === "Hum the tune before writing it down");
  for (const t of made) await ore("annotate", t.id, "--status", "deleted");
  if (made.length !== 1) throw new Error(`one Add made ${made.length} tries`);
});

journey("skill page: ⌘Z while a goal or colour change is still being written takes back that change (Codex UX sweep 2)", async (page) => {
  type S = { id: string; name: string; goal?: string; color?: string };
  const id = ((await ore("skills")) as S[]).find((k) => k.name === "Habits")!.id;
  const get = async () => ((await ore("skills")) as S[]).find((k) => k.id === id)!;
  const was = await get();
  const settle = async () => {
    const landed = answered(page, "skills");
    await release(page, "skills set");
    await landed;
    await Bun.sleep(600); // an Undo that waited for the write runs now
  };
  try {
    await page.locator(".sidebar .side-item", { hasText: /^Habits$/ }).first().click();
    await page.locator("button.skill-goal").click();
    await page.locator("textarea.skill-goal").fill("First goal");
    await page.keyboard.press("Enter");
    await until("the first goal is saved", async () => (await get()).goal === "First goal");
    await page.locator("button.skill-goal").click();
    await page.locator("textarea.skill-goal").fill("Second goal");
    await hold(page, "skills set");
    await page.keyboard.press("Enter");
    await until("the second goal's write is out", () => isHeld(page, "skills set"));
    await page.keyboard.press("Meta+z");
    await settle();
    await until("⌘Z took back the second goal, to the first", async () => (await get()).goal === "First goal");
    await page.locator(".skill-badge").click();
    await page.getByRole("radio", { name: "red" }).click();
    await until("red is saved", async () => (await get()).color === "red");
    await hold(page, "skills set");
    await page.getByRole("radio", { name: "blue" }).click();
    await until("blue's write is out", () => isHeld(page, "skills set"));
    await page.keyboard.press("Escape");
    await page.keyboard.press("Meta+z");
    await settle();
    await until("⌘Z took back blue, to red", async () => (await get()).color === "red");
  } finally {
    await ore("skills", "set", id, `--goal=${was.goal ?? ""}`, `--color=${was.color ?? ""}`);
  }
});

journey("skill picker: a skill picked while a new one is being made stays picked when it lands (Codex UX sweep 5)", async (page) => {
  const item = () => ore("ls").then((ls) => (ls as { id: string; title: string; skills: string[] }[]).find((i) => i.title === AGENTS)!);
  const start = (await item()).skills;
  const name = `Made meanwhile ${Date.now() % 100000}`;
  const learning = ((await ore("skills")) as { id: string; name: string }[]).find((k) => k.name === "Learning")!;
  await openSource(page, AGENTS);
  try {
    await page.locator(".doc-head").getByRole("button", { name: `Skills for ${AGENTS}` }).click();
    const picker = page.locator(".skill-picker");
    await picker.locator("input").fill(name);
    await hold(page, "skills add");
    await picker.getByRole("option", { name: new RegExp(`Create`) }).click();
    await until("the new skill's write is out", () => isHeld(page, "skills add"));
    await picker.locator("input").fill("Learning");
    await picker.getByRole("option").filter({ has: page.locator(".menu-label", { hasText: "Learning" }) }).click();
    await release(page, "skills add");
    await until("both are filed", async () => { const s = (await item()).skills; return s.includes(learning.id) && s.some((id) => !start.includes(id) && id !== learning.id); });
    await Bun.sleep(800);
    if (!(await item()).skills.includes(learning.id)) throw new Error("the skill made meanwhile took Learning off");
  } finally {
    await page.keyboard.press("Escape").catch(() => {});
    await ore("edit", (await item()).id, "--skills", start.join(","));
    const made = ((await ore("skills")) as { id: string; name: string }[]).find((k) => k.name === name);
    if (made) await ore("skills", "rm", made.id);
  }
});

/** The tries on the skill page whose text has `text`: the one in the works, or a waiting one's stone. */
const tryRows = (page: Page, text: string) => page.locator(`.try-now:has-text(${JSON.stringify(text)}), button.try-stone[aria-label*=${JSON.stringify(text)}]`);

journey("try it: a plan written just before the skill page opens shows there once it saves, though the page read its tries first", async (page) => {
  await openSource(page, TESTING);
  await select(page, "explaining an idea aloud all count"); // a passage no other journey highlights
  await page.getByRole("dialog", { name: "Highlight" }).waitFor();
  await page.keyboard.press("4");
  await until("the plan field has the caret", async () => page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Note"));
  await page.keyboard.type("Explain it aloud on the walk home");
  await loaded(page); // Try it has saved; only the plan's write is left
  // The plan's write waits until the skill page has read its tries, as on a busy Mac.
  await hold(page, "annotate");
  await page.keyboard.press("Enter");
  const read = answered(page, "tries");
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  await read;
  if (!(await isHeld(page, "annotate")) || (await tryRows(page, "Explain it aloud on the walk home").count())) throw new Error("the skill page did not read its tries before the plan saved");
  await release(page, "annotate");
  await until("the try shows its plan once it saves", async () => (await tryRows(page, "Explain it aloud on the walk home").count()) === 1);
});

journey("try it: a plan written while its highlight is still being made shows on a skill page opened meanwhile, once both save", async (page) => {
  await searchPick(page, "spaced repetition scheduling", "Notes on spaced repetition scheduling (FSRS)"); // in Done, so ⌘K finds it
  await page.locator(".doc-head").filter({ hasText: "Notes on spaced repetition scheduling (FSRS)" }).waitFor();
  await hold(page, "highlight"); // the highlight itself is still being made when he goes
  await select(page, "FSRS models stability and difficulty");
  await page.getByRole("dialog", { name: "Highlight" }).waitFor();
  await page.keyboard.press("4");
  await until("the plan field has the caret", async () => page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Note"));
  await page.keyboard.type("Check stability before each exam");
  await page.keyboard.press("Enter");
  const read = answered(page, "tries");
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  await read;
  if (!(await isHeld(page, "highlight")) || (await tryRows(page, "Check stability before each exam").count())) throw new Error("the skill page did not read its tries before the highlight was made");
  await release(page, "highlight");
  await until("the try shows with its plan once both save", async () => (await tryRows(page, "Check stability before each exam").count()) === 1);
});

journey("try it: a plan typed and left unsent (he clicks away) shows on the skill page he went to, once it saves", async (page) => {
  await searchPick(page, "Story Spine", "The Story Spine"); // in Done, so ⌘K finds it
  await page.locator(".doc-head").filter({ hasText: "The Story Spine" }).waitFor();
  await select(page, "The spine forces cause and effect");
  await page.getByRole("dialog", { name: "Highlight" }).waitFor();
  await page.keyboard.press("4");
  await until("the plan field has the caret", async () => page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Note"));
  await page.keyboard.type("Outline the next talk as a spine");
  await loaded(page); // the try is made; the plan is saved only as the source closes
  await hold(page, "annotate");
  const read = answered(page, "tries");
  await page.locator(".sidebar .side-item", { hasText: "Storytelling" }).first().click(); // no Enter
  await read;
  if (!(await isHeld(page, "annotate")) || (await tryRows(page, "Outline the next talk as a spine").count())) throw new Error("the plan saved before the skill page read its tries");
  await release(page, "annotate");
  await until("the try shows its plan once it saves", async () => (await tryRows(page, "Outline the next talk as a spine").count()) === 1);
});

journey("try it: 4 on the reading focus makes a try that shows on a skill page opened while it saves", async (page) => {
  await openSource(page, "A very long title about the neuroscience of habit formation");
  await page.locator(".doc").getByText("Habits form when a cue").waitFor();
  await loaded(page);
  await hold(page, "highlight");
  await page.keyboard.press("ArrowDown"); // the reading focus, on the source's first line
  await page.keyboard.press("4"); // a try of it, in one `ore highlight --intent apply`
  await until("the try is being made", () => isHeld(page, "highlight"));
  await page.keyboard.press("Escape");
  const read = answered(page, "tries");
  await page.locator(".sidebar .side-item", { hasText: /^Habits$/ }).first().click();
  const shown = (await (await read).json()) as unknown[];
  if (shown.length) throw new Error("the skill page read a try before the one being made");
  await release(page, "highlight");
  await until("the try shows once it is made", async () => (await page.locator(".try-now").count()) === 1);
});

journey("dig: a finished session offers one skill's dig; he explains the goal from memory, answers the mole's question, and its key points show as stones, with nothing graded (D325)", async (page) => {
  const GOAL = "Explain how to study to a new teacher, from memory";
  const calls = oreCalls(page);
  const src = ((await ore("ls", "--skill", "learning")) as { id: string; title: string }[]).find((i) => i.title.startsWith("The Testing Effect"))!;
  const note = ((await ore("notes", "--skill", "learning")) as { text: string }).text;
  const marks: { id: string }[] = [];
  for (const exact of ["Effortful retrieval, the kind that feels a little hard, produces larger gains than easy retrieval.", "The advantage only appears after a delay"]) marks.push((await ore("highlight", src.id, "--exact", exact, "--intent", "card")) as { id: string });
  await ore("skills", "set", "learning", "--goal", GOAL);
  try {
    await page.reload();
    await page.locator(".side-item").first().waitFor();
    // The end of a session: one line for the one skill ready to dig, and a click opens it on the skill's page.
    await startReview(page, null);
    await reveal(page);
    await page.getByRole("button", { name: "Good", exact: true }).click();
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");
    const line = page.locator(".review-dig");
    await line.waitFor();
    if (!(await line.innerText()).includes(GOAL)) throw new Error(`the end screen offers the wrong dig: ${await line.innerText()}`);
    await line.click();
    await page.locator(".review").waitFor({ state: "detached" });
    const dig = page.getByRole("dialog", { name: GOAL });
    await dig.waitFor();
    await calls.undoAll(); // the rating, for the journeys after this one

    // He writes it; the mole reads it and asks at an idea he left out.
    await dig.getByLabel("What you remember").fill("Quiz yourself instead of rereading.");
    await page.keyboard.press("Meta+Enter");
    await dig.getByText("Which quiz does more for you").waitFor();
    if (await dig.getByLabel("What you remember").count()) throw new Error("what he wrote stayed on screen while the mole asks");
    await until("the keys are in the answer", () => page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Your answer"));
    await page.keyboard.type("The hard one, the effort is what builds it.");
    await page.keyboard.press("Meta+Enter");
    await dig.getByText("all your quizzing in one evening").waitFor();
    await dig.getByRole("button", { name: "Skip" }).click();

    // The skill's ideas, a stone each, a row per source: no number, no grade.
    const stones = dig.locator(".dig-idea");
    await stones.first().waitFor();
    const states = await stones.evaluateAll((all) => all.map((b) => `${b.getAttribute("data-state")} ${b.getAttribute("aria-label")}`));
    const want = ["nudge Came with a nudge: Effortful retrieval", "own Came on its own: The advantage only appears", "missed Didn’t come: Space the sessions out."];
    if (states.length !== 3 || want.some((w, i) => !states[i]!.startsWith(w))) throw new Error(`the stones read ${JSON.stringify(states)}`);
    if ((await dig.locator(".dig-vein").count()) !== 2) throw new Error("the ideas are not a row per source");
    if (/\d\s*(of|\/|%)/.test(await dig.innerText())) throw new Error(`the dig shows a score: ${await dig.innerText()}`);
    await stones.nth(2).hover();
    await page.getByRole("tooltip").filter({ hasText: "Didn’t come" }).waitFor();
    await page.keyboard.press("Escape");
    await dig.waitFor({ state: "detached" });

    // Kept: the dig with the skill's ideas as they stood, and his words in the skill note under today's date.
    const kept = (await ore("dig", "learning")) as { last: { text: string; ideas: { id: string }[] } | null; ready: boolean };
    if (kept.last?.text !== "Quiz yourself instead of rereading." || kept.ready) throw new Error(`the dig was not kept, or the skill is still ready: ${JSON.stringify(kept)}`);
    if (marks.some((m) => !kept.last!.ideas.some((i) => i.id === m.id))) throw new Error("the dig was kept without the skill's key points");
    const now = ((await ore("notes", "--skill", "learning")) as { text: string }).text;
    if (!/^## Dig, \d{4}-\d{2}-\d{2}$/m.test(now) || !now.includes("Quiz yourself instead of rereading.")) throw new Error("his words are not in the skill note");
    // The button on the goal says when he last dug.
    await page.getByRole("button", { name: "Dig", exact: true }).hover();
    await page.getByRole("tooltip").filter({ hasText: "last dig" }).waitFor();
  } finally {
    const last = ((await ore("dig", "learning")) as { last: { id: string } | null }).last;
    if (last) await ore("dig", "learning", "--drop", last.id);
    await ore("skills", "set", "learning", "--goal", "");
    await ore("notes", "--skill", "learning", "--set", note);
    for (const m of marks) await ore("annotate", m.id, "--status", "deleted").catch(() => {});
  }
});

journey("bulk filing under an archived skill brings it back in the sidebar, and ⌘Z archives it again (D173)", async (page) => {
  const k = (await ore("skills", "add", "Lathe work")) as { id: string };
  await ore("skills", "archive", k.id);
  const archived = async () => !!((await ore("skills")) as { id: string; archived?: boolean }[]).find((s) => s.id === k.id)?.archived;
  try {
    await page.reload();
    await page.getByRole("button", { name: /^All sources/ }).click();
    const rows = page.locator(".row");
    await rows.nth(0).click({ modifiers: ["Meta"] });
    await rows.nth(1).click({ modifiers: ["Meta"] });
    await rows.nth(1).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Skills" }).focus();
    await page.keyboard.press("ArrowRight");
    await page.getByRole("menuitemcheckbox", { name: "Lathe work" }).or(page.getByRole("menuitem", { name: "Lathe work" })).first().click();
    await until("filing brings the skill back", async () => !(await archived()));
    await until("the sidebar lists it among the skills", async () => (await page.locator(".sidebar .side-item[data-drop-skill]", { hasText: "Lathe work" }).count()) === 1);
    await page.waitForTimeout(300);
    await page.keyboard.press("Meta+z");
    await until("⌘Z archives it again", archived);
  } finally {
    const all = (await ore("ls")) as { id: string; skills: string[] }[];
    for (const i of all.filter((x) => x.skills.includes(k.id))) await ore("edit", i.id, "--skills", i.skills.filter((s) => s !== k.id).join(","));
    await ore("skills", "rm", k.id).catch(() => {});
  }
});

journey("skill page Find: a question's words are found, though the question is a button", async (page) => {
  const q = (await ore("snippet", "--text=Does interleaving help with watercolour washes?", "--intent=question", "--skill=learning")) as { annotation: { id: string } };
  try {
    await page.reload();
    await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
    await page.getByText("Does interleaving help with watercolour washes?").first().waitFor();
    await page.keyboard.press("Meta+f");
    await page.locator(".find-bar input").fill("watercolour");
    await page.waitForTimeout(400);
    const said = (await page.locator(".find-bar").innerText()).trim();
    if (/not found/i.test(said)) throw new Error(`Find says “${said}” for a word on the page`);
    await page.keyboard.press("Escape");
    await until("Esc gives focus to the sources list", () => page.evaluate(() => !!document.activeElement?.matches(".skill-page .list")));
  } finally {
    await ore("annotate", q.annotation.id, "--status", "deleted").catch(() => {});
  }
});

journey("skill recall: a warm-up saved to the skill note is a step, so ⌘Z takes it out and ⇧⌘Z puts it back", async (page) => {
  const k = (await ore("skills", "add", "Whittling")) as { id: string };
  try {
    await page.reload();
    await page.locator(".sidebar .side-item", { hasText: "Whittling" }).first().click();
    await page.locator(".warm-up").getByRole("button").first().click();
    const dialog = page.getByRole("dialog").filter({ hasText: "Warm up from memory" });
    await dialog.getByRole("textbox").fill("Cut away from yourself, with the grain.");
    await dialog.getByRole("button", { name: /Save as first draft/ }).click();
    await dialog.waitFor({ state: "detached" });
    const note = async () => ((await ore("notes", `--skill=${k.id}`)) as { text: string }).text;
    await until("the recall is in the note", async () => (await note()).includes("with the grain"));
    // Out of the note, onto the page: a click on the name opens it for a rename, and Esc puts focus back on the name.
    await page.locator(".skill-page h1.skill-name button").click();
    await page.getByLabel("Rename Whittling").waitFor();
    await page.keyboard.press("Escape");
    await until("Esc gives the name its focus back", () => page.evaluate(() => !!document.activeElement?.matches(".skill-page h1.skill-name button")));
    await page.keyboard.press("Meta+z");
    await until("⌘Z takes the recall out of the note", async () => !(await note()).includes("with the grain"));
    await page.keyboard.press("Shift+Meta+z");
    await until("⇧⌘Z puts it back", async () => (await note()).includes("with the grain"));
  } finally {
    await ore("skills", "rm", k.id).catch(() => {});
  }
});

journey("skill picker: two skills added in a source, then ⌘Z twice takes both off, picker open or closed", async (page) => {
  const item = () => ore("ls").then((ls) => (ls as { id: string; title: string; skills: string[] }[]).find((i) => i.title === TESTING)!);
  const start = (await item()).skills;
  const others = ((await ore("skills")) as { id: string; name: string }[]).filter((k) => !start.includes(k.id)).slice(0, 2);
  await openSource(page, TESTING);
  for (const closeFirst of [true, false]) {
    await page.locator(".doc-head").getByRole("button", { name: `Skills for ${TESTING}` }).click();
    const picker = page.locator(".skill-picker");
    for (const k of others) {
      await picker.getByRole("option").filter({ has: page.locator(".menu-label", { hasText: k.name }) }).click();
      await until(`filed under ${k.name}`, async () => (await item()).skills.includes(k.id));
      await page.getByText(`Filed under ${k.name}`, { exact: true }).last().waitFor(); // the tick is on the history
    }
    if (closeFirst) {
      await page.keyboard.press("Escape");
      await picker.waitFor({ state: "detached" });
    }
    await page.keyboard.press("Meta+z");
    await until("the first ⌘Z takes the second skill off", async () => !(await item()).skills.includes(others[1]!.id));
    await page.keyboard.press("Meta+z");
    await until("the second ⌘Z takes the first off", async () => (await item()).skills.join() === start.join());
    if (!closeFirst) await page.keyboard.press("Escape");
  }
  // The source's own read after the last ⌘Z has landed: until then the header (and the picker it opens) can still
  // show a skill that read began with, and ↵ on it would untick it (F500).
  await until("the header shows only the skills he started with", async () => {
    const head = await page.locator(".doc-head").innerText();
    return others.every((k) => !head.includes(k.name));
  });
  // By keys: he types to filter and ticks with ↵, so focus stays in the filter field, which has
  // nothing typed since the tick: ⌘Z is the app's (macOS keeps one undo run per window).
  await page.locator(".doc-head").getByRole("button", { name: `Skills for ${TESTING}` }).click();
  // The keys go to the filter field, so it must have focus first: sent as the picker was still opening, "AI"
  // was typed at the page and nothing was filed (F479, CI twice on #497).
  await until("the picker's filter field has focus", () => page.evaluate(() => !!document.activeElement?.closest(".skill-picker") && document.activeElement.matches("input")));
  for (const k of others) {
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Backspace");
    await page.keyboard.type(k.name);
    await page.keyboard.press("Enter");
    // F631: when the tick never lands, say what the picker did with the keys instead (seen three times on CI).
    await until(`filed under ${k.name} by keys`, async () => (await item()).skills.includes(k.id)).catch(async (e: Error) => {
      const seen = await page.evaluate(() => ({ toasts: [...document.querySelectorAll(".toast")].map((t) => t.textContent), typed: (document.querySelector(".skill-picker .menu-input") as HTMLInputElement | null)?.value, focus: document.activeElement?.className, on: document.querySelector(".skill-picker [aria-selected=true]")?.textContent }));
      throw new Error(`${e.message}: ${JSON.stringify(seen)}`);
    });
    await page.getByText(`Filed under ${k.name}`, { exact: true }).last().waitFor();
  }
  // Typing after the tick is the field's to undo first; once it is undone, ⌘Z goes back to the app.
  await page.getByText(`Filed under ${others[1]!.name}`, { exact: true }).last().waitFor(); // the tick is on the history
  await page.keyboard.type("x");
  await page.keyboard.press("Meta+z"); // the field's: the app leaves it alone
  if (!(await item()).skills.includes(others[1]!.id)) throw new Error("⌘Z with fresh typing in the filter took a skill off");
  // Chromium on Linux undoes typing on ⌃Z only, so the x is still there: the Mac's ⌘Z runs this (menubar.ts).
  // On a Mac the ⌘Z above already took it back, and another undo would eat the typed skill name.
  if ((await page.locator(".skill-picker .menu-input").inputValue()).endsWith("x")) await page.evaluate(() => document.execCommand("undo"));
  await page.keyboard.press("Meta+z");
  await until("the typing undone, then the second skill off", async () => !(await item()).skills.includes(others[1]!.id));
  await page.keyboard.press("Meta+z");
  await until("⌘Z in the filter takes both off", async () => (await item()).skills.join() === start.join());
  await page.keyboard.press("Escape");
});

journey("skill picker: a read of the source that started before a skill came off never puts it back in the picker (F474)", async (page) => {
  const item = () => ore("ls").then((ls) => (ls as { id: string; title: string; skills: string[] }[]).find((i) => i.title === TESTING)!);
  const start = (await item()).skills;
  const other = ((await ore("skills")) as { id: string; name: string }[]).find((k) => !start.includes(k.id))!;
  await openSource(page, TESTING);
  const pills = page.locator(".doc-head").getByRole("button", { name: `Skills for ${TESTING}` });
  await pills.click();
  const row = page.locator(".skill-picker").getByRole("option").filter({ has: page.locator(".menu-label", { hasText: other.name }) });
  await row.click();
  await until("filed", async () => (await item()).skills.includes(other.id));
  await page.getByText(`Filed under ${other.name}`, { exact: true }).last().waitFor();
  // A read of the source is still out when he takes the skill off (back from time away here; on a slow
  // machine the read after one ⌘Z, landing during the next): it must not tick the skill again.
  await page.evaluate(() => ((window as unknown as { __ORE_SLOW?: object }).__ORE_SLOW = { show: 600, edit: 1500 }));
  await awayAndBack(page);
  await Bun.sleep(100); // the read has started, with the skill still on
  await row.click();
  await Bun.sleep(900); // the old read has landed; the save has not
  const ticked = await row.getAttribute("aria-checked");
  await page.evaluate(() => ((window as unknown as { __ORE_SLOW?: object }).__ORE_SLOW = undefined));
  if (ticked === "true") throw new Error("the picker ticks a skill he just took off, so the next pick would do the opposite");
  await until("taken off", async () => !(await item()).skills.includes(other.id));
  await page.keyboard.press("Escape");
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

journey("skill importance (D173): Importance ▸ Focus with ⌘Z, Archive folds it under Archived and out of review, Bring back puts it in its place", async (page) => {
  type S = { id: string; priority: string; archived?: boolean };
  const habits = async () => ((await ore("skills")) as S[]).find((s) => s.id === "habits")!;
  const row = page.locator("nav .side-main", { hasText: "Habits" });
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Importance" }).hover();
  await page.getByRole("menuitemcheckbox", { name: "Focus" }).click();
  await until("Habits is Focus", async () => (await habits()).priority === "P1");
  await page.keyboard.press("Meta+z");
  await until("⌘Z puts it back to Light", async () => (await habits()).priority === "P3");
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Archive skill" }).click();
  await until("Habits is archived", async () => !!(await habits()).archived);
  const fold = page.getByRole("group", { name: "Archived" });
  await fold.getByRole("button", { name: "Archived" }).click();
  await fold.locator(".side-main", { hasText: "Habits" }).click();
  // Its own cards wait: Start review on Home never offers it.
  const due = (await ore("due")) as { skills: string[] }[];
  if (due.some((e) => e.skills.length === 1 && e.skills[0] === "habits")) throw new Error("an archived skill's card is still due");
  await page.getByRole("button", { name: "Bring back" }).click();
  await until("Habits is back", async () => !(await habits()).archived);
  await page.locator(".skill-importance").waitFor();
  if (await fold.count()) throw new Error("the Archived group stayed with nothing in it");
});

journey("delete skill dialog: ⇧Tab stays in it, Esc closes it, nothing behind it is reachable", async (page) => {
  const k = (await ore("skills", "add", "Joinery")) as { id: string };
  const made = (await fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich", "--skill", k.id], stdin: "# Mortise and tenon\n\nCut the mortise first." }) }).then((r) => r.json())) as { id: string };
  try {
    await page.reload();
    await page.locator(".sidebar .side-item", { hasText: "Joinery" }).first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "Delete skill…" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Delete Joinery" });
    await dialog.waitFor();
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Shift+Tab");
      if (!(await dialog.evaluate((d) => d.contains(document.activeElement)))) throw new Error("⇧Tab left the dialog for the page behind it");
    }
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached", timeout: 1500 });
  } finally {
    await ore("skills", "rm", k.id);
    await ore("archive", made.id);
  }
});

journey("skill rename: a ⌘Z whose save fails stays on the history, so the next ⌘Z takes it back", async (page) => {
  await page.locator(".sidebar .side-item", { hasText: "Habits" }).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit skill…" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit skill Habits" });
  await dialog.getByLabel("Rename Habits").fill("Habit loops");
  await page.keyboard.press("Enter");
  await dialog.waitFor({ state: "detached" });
  const named = (n: string) => page.locator(".sidebar .side-item", { hasText: n }).count().then((c) => c > 0);
  await until("renamed", () => named("Habit loops"));
  await failNext(page, "skills", "The library is read-only.");
  await page.keyboard.press("Meta+z");
  await page.locator(".toast").filter({ hasText: "Couldn’t undo" }).waitFor();
  await failNext(page, "skills", null);
  await page.keyboard.press("Meta+z");
  await until("the next ⌘Z takes it back", () => named("Habits"));
});

journey("delete skill: on a slow save the skill goes at once with its Undo, never a menu pick that seems to do nothing (F455)", async (page) => {
  // His real Mac: the CLI took long enough that four picks of Delete skill… showed nothing at all.
  const k = (await ore("skills", "add", "Slow to go")) as { id: string };
  try {
    await page.reload();
    const row = page.locator(".sidebar .side-item", { hasText: "Slow to go" });
    await row.first().waitFor();
    await page.evaluate(() => void ((window as unknown as Rigged).__ORE_SLOW = { skills: 4000 }));
    await row.first().click({ button: "right" });
    await page.getByRole("menuitem", { name: /^Delete skill/ }).click();
    await page.locator(".toast-msg", { hasText: "Deleted Slow to go" }).waitFor({ timeout: 1500 });
    await until("the skill leaves the sidebar before the save lands", async () => (await row.count()) === 0, 1500);
    await page.evaluate(() => void ((window as unknown as Rigged).__ORE_SLOW = {}));
    await until("the save lands", async () => !((await ore("skills")) as { id: string }[]).some((s) => s.id === k.id), 8000);
    await page.keyboard.press("Meta+z");
    await row.first().waitFor({ timeout: 8000 });
  } finally {
    await page.evaluate(() => void ((window as unknown as Rigged).__ORE_SLOW = {}));
    await ore("skills", "rm", k.id).catch(() => {});
  }
});

journey("delete skill: a delete whose save fails can be tried again from the same menu", async (page) => {
  const k = (await ore("skills", "add", "Empty for now")) as { id: string };
  try {
    await page.reload();
    const item = page.locator(".sidebar .side-item", { hasText: "Empty for now" }).first();
    await failNext(page, "skills", "The library is read-only.");
    await item.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Delete skill…" }).click();
    await page.locator(".toast[role=alert]").filter({ hasText: "The library is read-only." }).waitFor();
    await failNext(page, "skills", null);
    await item.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Delete skill…" }).click();
    await until("the second try deletes it", async () => (await page.locator(".sidebar .side-item", { hasText: "Empty for now" }).count()) === 0);
  } finally {
    await ore("skills", "rm", k.id).catch(() => {});
  }
});

journey("skill rename: pending Undo preserves the preceding source (F146)", async (page) => {
  const name = `Rename trial ${Date.now()}`;
  const skill = await ore("skills", "add", name) as { id: string };
  const title = `Source before rename ${Date.now()}`;
  try {
    await page.reload();
    await page.keyboard.press("Meta+n");
    await page.getByRole("textbox", { name: "Link, file path or text" }).fill(`# ${title}\n\nThis source must survive undoing the next rename.`);
    await page.keyboard.press("Enter");
    await page.getByRole("heading", { name: title, exact: true }).waitFor();
    await until("the import has settled", () => page.evaluate(() => !(window as unknown as { __ORE_PENDING: number }).__ORE_PENDING));
    const source = (await ore("ls") as { id: string; title: string }[]).find((i) => i.title === title)!;
    await page.getByRole("navigation", { name: "Skills" }).getByRole("button", { name, exact: true }).click();
    await page.getByRole("heading", { name, exact: true }).getByRole("button").click();
    await page.getByRole("textbox", { name: `Rename ${name}` }).fill(`${name} renamed`);
    await hold(page, "skills set");
    await page.getByRole("heading", { name: "Your note", exact: true }).click();
    await until("the rename is held", () => isHeld(page, "skills set"));
    await page.keyboard.press("Meta+z");
    await release(page, "skills set");
    await until("the rename and Undo have settled", () => page.evaluate(() => !(window as unknown as { __ORE_PENDING: number }).__ORE_PENDING));
    const archived = await ore("ls", "--archived") as { id: string }[];
    if (archived.some((i) => i.id === source.id)) throw new Error("Undo archived the preceding source instead of the pending rename");
    await page.getByRole("heading", { name, exact: true }).waitFor();
    await page.keyboard.press("Meta+Shift+z");
    await page.getByRole("heading", { name: `${name} renamed`, exact: true }).waitFor();
    await page.keyboard.press("Meta+z");
    await page.getByRole("heading", { name, exact: true }).waitFor();
  } finally {
    await release(page, "skills set");
    await ore("skills", "rm", skill.id);
  }
});

journey("Edit skill: a click outside saves the typed name, as Enter does (D211, sweep 5, F307)", async (page) => {
  await page.locator(".sidebar .side-item", { hasText: "Creativity" }).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit skill…" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit skill Creativity" });
  await dialog.getByLabel("Rename Creativity").fill("Creative pointer"); // the name opens in edit
  await page.mouse.click(1200, 760); // the dimmed page around the editor
  await dialog.waitFor({ state: "detached" });
  await until("the sidebar shows the new name", async () => (await page.locator(".sidebar .side-item", { hasText: "Creative pointer" }).count()) === 1);
  await settled(page);
  await page.keyboard.press("Meta+z");
  await until("⌘Z puts the old name back", async () => (await page.locator(".sidebar .side-item", { hasText: "Creativity" }).count()) === 1);
});

journey("Edit skill: a click outside with a name already taken stays open and says why (sweep 5 review)", async (page) => {
  await page.locator(".sidebar .side-item", { hasText: "Creativity" }).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit skill…" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit skill Creativity" });
  const name = dialog.getByLabel("Rename Creativity");
  await name.fill("Habits");
  await page.mouse.click(1200, 760);
  await page.locator(".toast[data-kind=error]").filter({ hasText: "already exists" }).waitFor();
  await page.waitForTimeout(300);
  if (!(await dialog.isVisible())) throw new Error("the editor closed on a name that failed to save");
  if ((await name.inputValue()) !== "Habits") throw new Error("the draft was lost");
  await page.keyboard.press("Escape"); // drops the draft
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  await settled(page);
});

journey("no skill: a pasted source opens with no picker, the sidebar's No skill row lists it, and its Importance is set from its menu, undone, and handed back to its skills", async (page) => {
  const side = page.locator(".sidebar");
  const noSkill = side.getByRole("button", { name: "No skill", exact: true });
  for (const i of (await ore("ls")) as { id: string; skills: string[] }[]) if (!i.skills.length) await ore("archive", i.id);
  await page.reload();
  await side.getByRole("button", { name: /^All sources/ }).click();
  await page.locator(".list .row").first().waitFor();
  if (await noSkill.count()) throw new Error("the sidebar has a No skill row with every source under a skill");
  // Pasted outside a field, it is added under no skill and opens; nothing asks for a skill.
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData("text/plain", "# A values guide\n\nWrite down the five things you would defend when it costs you something.");
    document.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await page.locator(".doc").getByText("Write down the five things").waitFor();
  const made = ((await ore("ls")) as { id: string; title: string }[]).find((i) => i.title === "A values guide")!;
  try {
    await page.waitForTimeout(400);
    if (await page.getByRole("dialog", { name: "Skills" }).count()) throw new Error("the skill picker opened by itself on a source added with no skill");
    // Open, it sits under No skill in the sidebar, as a source sits under its skill.
    await until("the No skill row is lit while its source is open", async () => (await noSkill.getAttribute("aria-pressed")) === "true");
    // The row lists the sources with no skill, by the filter's own tag in the search.
    await side.getByRole("button", { name: /^All sources/ }).click();
    await noSkill.click();
    const rows = page.locator(".list .row");
    await until("only the source with no skill is listed", async () => (await rows.count()) === 1 && (await rows.first().innerText()).includes("A values guide"));
    await page.locator(".filter").getByText("No skill").waitFor();
    if ((await side.getByRole("button", { name: /^All sources/ }).getAttribute("aria-pressed")) !== "false") throw new Error("All sources is lit too");
    // Importance ▸ on its menu: Normal is ticked with no skill; Focus is written to the source.
    const level = async (name: string) => {
      await rows.first().click({ button: "right" });
      await page.getByRole("menuitem", { name: "Importance" }).hover();
      await page.getByRole("menuitemcheckbox", { name }).click();
    };
    const ticked = async () => {
      await rows.first().click({ button: "right" });
      await page.getByRole("menuitem", { name: "Importance" }).hover();
      await page.getByRole("menuitemcheckbox").first().waitFor();
      const names = await page.getByRole("menuitemcheckbox").evaluateAll((els) => els.map((e) => `${e.textContent}${e.getAttribute("aria-checked") === "true" ? "✓" : ""}`));
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      return names.join(" ");
    };
    const stored = async () => ((await ore("show", made.id)) as { priority?: string }).priority;
    if ((await ticked()) !== "Focus Normal✓ Light") throw new Error(`with no skill and nothing set: ${await ticked()}`);
    await level("Focus");
    await until("Focus is written to the source", async () => (await stored()) === "P1");
    if ((await ticked()) !== "Focus✓ Normal Light") throw new Error(`after Focus: ${await ticked()}`);
    await page.keyboard.press("Meta+z");
    await until("⌘Z takes it back", async () => (await stored()) === undefined);
    // Open, ⌘K names the levels as levels (never "File under Focus"), and the reader's own menu ticks what is stored.
    await rows.first().click();
    await page.locator(".doc").getByText("Write down the five things").waitFor();
    await page.keyboard.press("Meta+k");
    await page.keyboard.type("importance");
    await page.locator("[cmdk-item]").filter({ hasText: "Importance: Focus" }).waitFor();
    if (await page.locator("[cmdk-item]").filter({ hasText: /File under (Focus|Light)/ }).count()) throw new Error("⌘K offers to file the source under an importance level");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    // All sources from the No skill list lets its tag go: the whole list, and All sources lit.
    await noSkill.click();
    await until("the No skill list is back", async () => (await rows.count()) === 1);
    await side.getByRole("button", { name: /^All sources/ }).click();
    await until("All sources shows every source again", async () => (await rows.count()) > 1 && (await side.getByRole("button", { name: /^All sources/ }).getAttribute("aria-pressed")) === "true");
    // Filed under a Light skill it reads Light; set to Focus, a last row hands it back to its skills.
    await ore("edit", made.id, "--skills=habits");
    await page.reload();
    await side.getByRole("button", { name: /^All sources/ }).click();
    await page.getByPlaceholder("Search").fill("A values guide");
    await until("it is found in All sources", async () => (await rows.count()) === 1);
    if ((await ticked()) !== "Focus Normal Light✓") throw new Error(`under a Light skill: ${await ticked()}`);
    if (await noSkill.count()) throw new Error("the No skill row stayed after its last source was filed");
    await level("Focus");
    await until("Focus is written over its skill's", async () => (await stored()) === "P1");
    if ((await ticked()) !== "Focus✓ Normal Light Same as its skills") throw new Error(`set over its skill: ${await ticked()}`);
    await level("Same as its skills");
    await until("handed back to its skills", async () => (await stored()) === undefined);
  } finally {
    await ore("archive", made.id).catch(() => {});
    await page.reload();
  }
});

journey("skill goal: a long goal wraps in its field, the letters left show near 140, and Enter saves it on one line (F437)", async (page) => {
  await page.locator(".sidebar .side-main", { hasText: "Teaching" }).click();
  await page.locator("button.skill-goal").click();
  const goal = page.locator("textarea.skill-goal");
  const left = page.locator(".skill-goal-left");
  await goal.fill("Explain spacing");
  const one = (await goal.boundingBox())!.height;
  if (await left.count()) throw new Error("the letters left show on a short goal");
  const long = "Explain spacing, retrieval and interleaving to a new teacher from memory in five minutes, then answer their questions with one worked example each, without notes";
  await goal.fill("");
  await page.keyboard.type(long);
  await until("it stops at 140 and says none are left", async () => (await goal.inputValue()).length === 140 && (await left.textContent())?.trim() === "0");
  if (!((await goal.boundingBox())!.height > one + 10)) throw new Error("the long goal stayed on one line");
  if ((await goal.evaluate((e) => e.scrollWidth - e.clientWidth)) > 1) throw new Error("the long goal scrolls sideways");
  await page.keyboard.press("Enter");
  await page.locator("button.skill-goal").filter({ hasText: long.slice(0, 140).trim() }).waitFor();
  await page.keyboard.press("Meta+z");
});
