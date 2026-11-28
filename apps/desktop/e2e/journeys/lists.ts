import { join } from "node:path";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { type Locator, type Page } from "playwright";
import { AGENTS, answered, BRIDGE, foundOnScreen, hasCaret, hold, inLibrary, isHeld, journey, LIB, loaded, openSource, ore, oreCalls, pickWithKeys, release, reveal, settled, startReview, TESTING, textFile, until } from "../harness";

// —— journeys ——

journey("Home: today's minutes are the big number, and the goal ring stands unframed", async (page) => {
  await page.locator(".home-goal h1 .roll").waitFor();
  const look = await page.evaluate(() => {
    const css = (sel: string) => getComputedStyle(document.querySelector(sel)!);
    return { minutes: css(".home-goal h1 .roll").fontSize, unit: css(".home-goal h1 > span:not(.roll)").fontSize, ring: css(".home-goal .ring").boxShadow };
  });
  if (look.minutes !== "40px" || look.unit !== "15px") throw new Error(`goal number ${look.minutes}, unit ${look.unit}`);
  if (look.ring !== "none") throw new Error(`goal ring framed: ${look.ring}`);
});

journey("Home: 9 minutes 33 seconds shows 9 of 10 min (F-new-goal-minutes-rounding)", async (page) => {
  await page.route(/\/ore$/, async (route) => {
    if (route.request().postDataJSON().args[0] !== "today") return route.fallback();
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), active_ms: 573_084, goal_minutes: 10, goal_ms: 600_000, counts: true, met: false, caught_up: false },
    });
  });
  await page.reload();
  const goal = page.locator(".home-goal");
  const heading = goal.locator("h1");
  await heading.waitFor();
  const text = (await heading.innerText()).replace(/\s+/g, " ").trim();
  if (text !== "9 of 10 min") throw new Error(`Home says "${text}", expected "9 of 10 min"`);
  await goal.getByRole("img", { name: "9 of 10 minutes today", exact: true }).waitFor();
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

journey("Home: every Continue reading picture sits in one wide box, a page from its top and a cover whole, with how long is left and where it is from under the title (F429, F432)", async (page) => {
  const dirOf = (slug: string) => (readdirSync(join(LIB, "items"), { recursive: true }) as string[]).find((d) => d.split("/").pop()!.startsWith(slug) && !d.endsWith(".md"))!;
  const sheet = (w: number, h: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fff"/><rect x="${w / 8}" y="${h / 8}" width="${w / 2}" height="${h / 16}" fill="#222"/></svg>`;
  // As an import leaves them: a cover (upright), a video's frame (16:9) and a capture far taller than either.
  const shapes: [string, string, number, number, string][] = [[TESTING, "the-testing-effect-why", 371, 480, "whole"], ["Building Effective Agents", "building-effective", 480, 270, "fill"], ["A very long title about", "a-very-long", 200, 900, "top"]];
  const files = shapes.map(([, slug, w, h]) => {
    const file = join(LIB, "items", dirOf(slug), "thumbnail.svg");
    writeFileSync(file, sheet(w, h));
    return file;
  });
  try {
    // Opened last, so sources other journeys added and opened don't push them off the list.
    for (const [title] of shapes) await openSource(page, title);
    await page.reload();
    await page.getByRole("button", { name: /^Home/ }).click();
    const row = (title: string) => page.locator(".home-read").filter({ hasText: title }).first();
    const box = async (title: string, part: string) => (await row(title).locator(part).boundingBox())!;
    const near = (a: number, b: number) => Math.abs(a - b) <= 1;
    for (const [title, , , , fit] of shapes) {
      await until(`${title}'s picture is drawn and placed`, async () => (await row(title).locator("img.thumb").getAttribute("data-fit")) === fit);
      const pic = await box(title, ".thumb-at");
      if (!(near(pic.width, 96) && near(pic.height, 54))) throw new Error(`${title}'s picture box is ${pic.width}×${pic.height}, want the one 96×54 box every row has`);
    }
    const cover = await row(TESTING).locator("img.thumb").evaluate((el) => ({ fit: getComputedStyle(el).objectFit, behind: getComputedStyle(el.parentElement!, "::before").backgroundImage }));
    if (cover.fit !== "contain" || !cover.behind.startsWith("url(")) throw new Error(`a cover is ${cover.fit} on ${cover.behind}: want it whole, on a blurred copy of itself`);
    const tall = await row("A very long title about").locator("img.thumb").evaluate((el) => getComputedStyle(el).objectPosition);
    if (!tall.endsWith(" 0%")) throw new Error(`a tall capture is placed at ${tall}: want its top, where its title is`);
    for (const part of [".thumb-at", ".title", ".home-meta"]) {
      const lefts = await Promise.all(shapes.map(async ([title]) => (await box(title, part)).x));
      if (!lefts.every((x) => near(x, lefts[0]!))) throw new Error(`${part} starts at ${lefts.join(", ")}: every row's must line up`);
    }
    const meta = await row("Building Effective Agents").locator(".home-meta").innerText();
    if (!/\d+ min left/.test(meta) || !meta.includes("anthropic.com")) throw new Error(`under the title: "${meta}", want how long is left and the site`);
    // The title sits over the line, not beside it, and a long one still ends inside the row.
    const [t, m, r] = [await box("A very long title about", ".title"), await box("A very long title about", ".home-meta"), (await row("A very long title about").boundingBox())!];
    if (!(m.y >= t.y + t.height - 1 && t.x + t.width <= r.x + r.width - 24)) throw new Error("the detail line is not under the title, or a long title runs under the row's ⋯");
    // In a narrow column what doesn't fit drops whole: nothing on the line is cut to a stub.
    await page.addStyleTag({ content: ".home-cont { max-width: 300px !important; flex: none !important; }" });
    const stub = await row("Building Effective Agents").locator(".home-meta").evaluate((el) => {
      const line = el.getBoundingClientRect();
      return [...el.children].filter((c) => { const b = c.getBoundingClientRect(); return b.top < line.bottom - 2 && b.right > line.right + 1; }).map((c) => c.textContent);
    });
    if (stub.length) throw new Error(`in a narrow column these run off the line instead of dropping: ${stub.join(", ")}`);
  } finally {
    for (const f of files) rmSync(f, { force: true });
  }
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
  await page.locator(".home-read").getByRole("textbox", { name: "Title" }).fill("Testing, renamed");
  await page.keyboard.press("Escape");
  await until("Esc keeps the old title", async () => (await title()) === TESTING);
  await until("and gives the row its focus back", () => row.locator(".home-open").evaluate((el) => el === document.activeElement));
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  await page.locator(".home-read").getByRole("textbox", { name: "Title" }).fill("Testing, renamed");
  await page.keyboard.press("Enter");
  const renamed = page.locator(".home-read").filter({ hasText: "Testing, renamed" });
  await until("Enter saves it", async () => (await renamed.count()) === 1);
  await page.waitForTimeout(300);
  await page.keyboard.press("Meta+z");
  await until("⌘Z puts the old title back", async () => (await row.locator(".title").count()) === 1 && (await title()) === TESTING);
});

/** The text of the focused control, or null with focus on <body>. */
const focusedOn = (page: Page) => page.evaluate(() => (document.activeElement === document.body ? null : (document.activeElement?.textContent ?? "").trim()));

// In WebKit, where a click focuses no button: after Edit skill… only the row's own memory of it can bring focus back.
journey("Home: after Rename… or Edit skill… from a row's menu, focus is on the renamed row or tile (Finder)", async (page) => {
  await openSource(page, TESTING);
  await page.getByRole("button", { name: /^Home/ }).click();
  const row = page.locator(".home-read").filter({ hasText: TESTING }).first();
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  await page.locator(".home-read").getByRole("textbox", { name: "Title" }).fill("Testing, renamed");
  await page.keyboard.press("Enter");
  await until("focus is on the renamed row", async () => (await focusedOn(page)) === "Testing, renamed");
  await page.keyboard.press("Meta+z");
  await until("⌘Z puts the old title back", async () => (await page.locator(".home-read .title").allInnerTexts()).includes(TESTING));
  const tile = page.locator(".home-skill").first();
  const name = (await tile.locator(".home-open").innerText()).trim();
  await tile.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Edit skill…" }).click();
  const field = page.getByRole("dialog").getByRole("textbox").first();
  await field.fill(`${name} too`);
  await page.keyboard.press("Enter");
  await until("focus is on the renamed tile", async () => (await focusedOn(page)) === `${name} too`);
  await page.keyboard.press("Meta+z");
  await until("⌘Z puts the old name back", async () => (await page.locator(".home-skill .home-open").allInnerTexts()).includes(name));
}, "webkit");

journey("Home: archiving a Continue reading row or a skill tile from its menu puts focus on the one after it; ⌘Z brings it back", async (page) => {
  await openSource(page, AGENTS);
  await openSource(page, TESTING);
  await page.getByRole("button", { name: /^Home/ }).click();
  await page.locator(".home-read").nth(1).waitFor();
  const titles = await page.locator(".home-read .title").allInnerTexts();
  await page.locator(".home-read").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: /^Archive/ }).click();
  await until(`focus moves to “${titles[1]}”`, async () => (await focusedOn(page)) === titles[1]);
  await page.keyboard.press("Meta+z");
  await inLibrary(page, [titles[0]!]);
  await page.locator(".home-skill").nth(1).waitFor();
  const names = (await page.locator(".home-skill .home-open").allInnerTexts()).map((n) => n.trim());
  await page.locator(".home-skill").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Archive skill" }).click();
  await until(`focus moves to “${names[1]}”`, async () => (await focusedOn(page)) === names[1]);
  await page.keyboard.press("Meta+z");
  await until("⌘Z brings the skill back", async () => (await page.locator(".home-skill .home-open").allInnerTexts()).map((n) => n.trim()).includes(names[0]!));
});

journey("sidebar: a collection renamed from its menu keeps focus on its name; deleting it, or archiving a skill, puts focus on the next one", async (page) => {
  const label = (t: RegExp) => page.locator(".side-head").filter({ hasText: t });
  await label(/^Craft$/i).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  await page.getByLabel("Collection name").fill("Craft works");
  await page.keyboard.press("Enter");
  await until("focus is on the renamed collection", async () => /^craft works$/i.test((await focusedOn(page)) ?? ""));
  await page.keyboard.press("Meta+z");
  await label(/^Craft$/i).waitFor();
  const heads = (await page.locator(".side-head .side-label-text").allInnerTexts()).map((t) => t.trim());
  const next = heads[heads.findIndex((t) => /^craft$/i.test(t)) + 1]!;
  const rows = async () => (await page.locator(".sidebar div.side-item .label").allInnerTexts()).map((t) => t.trim());
  const before = await rows();
  await label(/^Craft$/i).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete collection" }).click();
  try {
    await until(`focus moves to “${next}” (of ${heads.join(", ")})`, async () => (await focusedOn(page)) === next).catch(async (e) => {
      throw new Error(`${(e as Error).message}, not “${await focusedOn(page)}”`);
    });
  } finally {
    // Back as it was, so the journeys after this one find Craft.
    await page.keyboard.press("Meta+z");
    await label(/^Craft$/i).waitFor();
  }
  // The Undo's write has landed and the sidebar read it back: Craft's skills, which sat at the top with no
  // collection while it was gone, are in it again. A menu opened on a row still on its way back closes under the click.
  await until("the skills are back in their order", async () => (await rows()).join("|") === before.join("|"));
  const skills = await rows();
  await page.locator(".sidebar div.side-item").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Archive skill" }).click();
  try {
    await until(`focus moves to “${skills[1]}”`, async () => (await focusedOn(page)) === skills[1]).catch(async (e) => {
      throw new Error(`${(e as Error).message}, not “${await focusedOn(page)}”`);
    });
  } finally {
    await page.keyboard.press("Meta+z");
    await until("⌘Z brings the skill back", async () => (await page.locator(".sidebar div.side-item .label").allInnerTexts()).map((t) => t.trim()).includes(skills[0]!));
  }
});

journey("Home: Back puts Home where it was scrolled, and focus on the row or tile he opened by the keyboard", async (page) => {
  await page.setViewportSize({ width: 1280, height: 480 });
  await openSource(page, TESTING);
  await page.getByRole("button", { name: /^Home/ }).click();
  const home = page.locator(".home");
  await page.locator(".home-skill").last().waitFor();
  await page.locator(".home-skill").last().scrollIntoViewIfNeeded();
  const want = await home.evaluate((el) => el.scrollTop);
  if (want < 40) throw new Error(`Home doesn't scroll at 480 high (${want})`);
  await page.locator(".home-skill .home-open").last().click();
  await page.locator(".skill-page").waitFor();
  await page.keyboard.press("Meta+BracketLeft");
  await page.locator(".home-skill").last().waitFor();
  await until(`Home is back at ${want}`, async () => Math.abs((await home.evaluate((el) => el.scrollTop)) - want) < 2);
  const row = page.locator(".home-read .home-open").first();
  const title = (await row.innerText()).trim();
  await row.focus();
  await page.keyboard.press("Enter");
  await page.locator(".doc-head").filter({ hasText: title }).waitFor();
  await page.keyboard.press("Meta+BracketLeft");
  await until(`focus is back on “${title}”`, async () => (await focusedOn(page)) === title);
});

journey("Home: ⌘-click and ⇧-click pick Continue reading rows, ⋯ acts on them all, Esc clears; a row dragged onto a sidebar skill is filed there, as in the source lists (F9, F10)", async (page) => {
  await openSource(page, AGENTS);
  await openSource(page, TESTING);
  await page.getByRole("button", { name: /^Home/ }).click();
  const rows = page.locator(".home-read");
  await rows.nth(1).waitFor();
  const picked = () => page.locator(".home-read.sel").count();
  await rows.nth(0).click({ modifiers: ["Meta"] });
  await rows.nth(1).click({ modifiers: ["Shift"] });
  await until("⌘-click then ⇧-click pick two rows", async () => (await picked()) === 2);
  if (await page.locator(".doc-head").count()) throw new Error("a ⌘-click opened the source");
  await rows.nth(1).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Archive 2 sources" }).waitFor();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await until("Esc clears the pick", async () => (await picked()) === 0);
  // Dragged onto a skill it isn't under, a row is filed there.
  const title = (await rows.nth(0).locator(".title").innerText()).trim();
  const under = ((await ore("ls")) as { title: string; skills: string[] }[]).find((i) => i.title === title)!.skills;
  const targets = page.locator(".sidebar .side-item[data-drop-skill]:not([data-drop-skill=''])");
  const names = (await targets.allInnerTexts()).map((t) => t.trim());
  const ids = await targets.evaluateAll((els) => els.map((el) => el.getAttribute("data-drop-skill")!));
  const k = ids.findIndex((id) => !under.includes(id));
  if (k < 0) throw new Error(`no skill “${title}” isn't under`);
  const from = (await rows.nth(0).locator(".thumb, .title").first().boundingBox())!;
  const to = (await targets.nth(k).boundingBox())!;
  await page.mouse.move(from.x + 4, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + from.height / 2, { steps: 4 });
  await page.locator(".row-ghost").waitFor();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await until("the skill under the pointer is lit", async () => (await targets.nth(k).getAttribute("class"))?.includes("drop-on") ?? false);
  await page.mouse.up();
  await page.getByText(`Filed “${title}” under ${names[k]}`).first().waitFor();
  if (await page.locator(".doc-head").count()) throw new Error("the drop opened the source");
  // ⌘Z takes it back off the skill.
  const id = ((await ore("ls")) as { id: string; title: string }[]).find((i) => i.title === title)!.id;
  await page.keyboard.press("Meta+KeyZ");
  await until("⌘Z takes the drop back", async () => !((await ore("show", id)) as { skills: string[] }).skills.includes(ids[k]!));
});

journey("All sources: a row dragged onto a sidebar skill is filed there, and ⌘Z takes it back off (F22)", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  const row = page.locator(".row", { hasText: TESTING }).first();
  await row.waitFor();
  const under = ((await ore("ls")) as { id: string; title: string; skills: string[] }[]).find((i) => i.title === TESTING)!;
  const targets = page.locator(".sidebar .side-item[data-drop-skill]:not([data-drop-skill=''])");
  const ids = await targets.evaluateAll((els) => els.map((el) => el.getAttribute("data-drop-skill")!));
  const k = ids.findIndex((id) => !under.skills.includes(id));
  const name = (await targets.nth(k).innerText()).trim();
  // Sources earlier journeys left can push the row below the window, where the pointer can't press it.
  await row.scrollIntoViewIfNeeded();
  const from = (await row.boundingBox())!;
  const to = (await targets.nth(k).boundingBox())!;
  await page.mouse.move(from.x + 60, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 100, from.y + from.height / 2, { steps: 4 });
  await page.locator(".row-ghost").waitFor();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  // A real write takes a moment: ⌘Z pressed at once, before it lands, still takes the drop back.
  await page.evaluate(() => ((window as { __ORE_SLOW?: Record<string, number> }).__ORE_SLOW = { edit: 600 }));
  await page.mouse.up();
  await page.keyboard.press("Meta+KeyZ");
  await page.evaluate(() => delete (window as { __ORE_SLOW?: unknown }).__ORE_SLOW);
  const on = async () => ((await ore("show", under.id)) as { skills: string[] }).skills.includes(ids[k]!);
  await page.getByText(`Undone: Filed “${TESTING}” under ${name}`).first().waitFor();
  await until("⌘Z takes the drop back", async () => !(await on()));
  await page.waitForTimeout(800);
  if (await on()) throw new Error("the drop's write landed after its undo");
});

journey("Undo of taking a source off a skill puts each exercise's own skills back, not the skill on all of them (Codex sweep 3, lifecycle)", async (page) => {
  const item = ((await ore("ls")) as { id: string; title: string; skills: string[] }[]).find((i) => i.title === TESTING)!;
  type C = { id: string; skills: string[] };
  const cards = async () => Object.fromEntries(((await ore("cards", "--item", item.id)) as C[]).map((c) => [c.id, [...c.skills].sort().join(",")]));
  const before = await cards();
  // The seed files it under two skills, with an exercise under only one of them: that one mustn't gain the other.
  const skill = item.skills.find((k) => Object.values(before).some((s) => !s.split(",").includes(k)));
  if (!skill) throw new Error("the seed needs an exercise filed under fewer skills than its source");
  const name = ((await ore("skills")) as { id: string; name: string }[]).find((k) => k.id === skill)!.name;
  await openSource(page, TESTING);
  await page.getByRole("button", { name: `Skills for ${TESTING}` }).click();
  await page.locator(".skill-picker [cmdk-item]", { hasText: name }).click();
  await page.keyboard.press("Escape");
  await until("it is off the skill", async () => !((await ore("show", item.id)) as { skills: string[] }).skills.includes(skill));
  // The file changes before the app hears back and puts the step in its history: ⌘Z waits for the toast, as he would.
  await page.locator(".toast", { hasText: `Removed from ${name}` }).waitFor();
  await page.keyboard.press("Meta+KeyZ");
  await until("Undo files it back", async () => ((await ore("show", item.id)) as { skills: string[] }).skills.includes(skill));
  await until("each exercise has its own skills again", async () => JSON.stringify(await cards()) === JSON.stringify(before));
});

journey("Home: ⇧↓ grows the pick on Continue reading, a click on empty space drops it, a title's first letters select its row, and ⌥⌘R renames the focused row (D232, D234)", async (page) => {
  await openSource(page, AGENTS);
  await openSource(page, TESTING);
  await page.getByRole("button", { name: /^Home/ }).click();
  const rows = page.locator(".home-read");
  await rows.nth(1).waitFor();
  const picked = () => page.locator(".home-read.sel").count();
  const focused = () => page.evaluate(() => document.activeElement?.closest<HTMLElement>(".home-read")?.querySelector(".title")?.textContent ?? "");
  await rows.nth(0).locator(".home-open").focus();
  await page.keyboard.type(AGENTS.slice(0, 5));
  await until("typing a title's first letters selects its row", async () => (await focused()) === AGENTS);
  await page.waitForTimeout(1100);
  await page.keyboard.type(TESTING.slice(0, 6));
  await until("another title's letters move to its row", async () => (await focused()) === TESTING);
  const first = (await rows.nth(0).locator(".title").innerText()).trim();
  await rows.nth(0).locator(".home-open").focus();
  await page.keyboard.press("Shift+ArrowDown");
  await until("⇧↓ picks two rows", async () => (await picked()) === 2);
  const home = (await page.locator(".home").boundingBox())!;
  await page.mouse.click(home.x + home.width - 12, home.y + home.height - 12);
  await until("a click on empty space drops the pick", async () => (await picked()) === 0);
  if (await page.locator(".doc-head").count()) throw new Error("the click opened a source");
  await rows.nth(0).locator(".home-open").focus();
  await page.keyboard.press("Alt+Meta+KeyR");
  const field = rows.nth(0).locator("input");
  await field.waitFor();
  if ((await field.inputValue()) !== first) throw new Error(`⌥⌘R opened “${await field.inputValue()}”`);
  await page.keyboard.press("Escape");
  await rows.nth(0).locator(".home-open").focus();
  await page.keyboard.press("Shift+Meta+KeyA");
  await until("⇧⌘A archives the row and focus goes to the next", async () => (await page.locator(".home-read .title", { hasText: first }).count()) === 0 && (await page.evaluate(() => !!document.activeElement?.closest(".home-read, .home-skill"))));
  await page.keyboard.press("Meta+z");
  await page.locator(".home-read .title", { hasText: first }).waitFor();
  await rows.nth(0).locator(".home-open").click({ button: "right" });
  const shown = (await page.getByRole("menuitem", { name: /Rename/ }).innerText()).replace(/\s+/g, "");
  await page.keyboard.press("Escape");
  if (!shown.includes("⌘R")) throw new Error(`Home's menu shows no Rename key: “${shown}”`);
});

// WebKit leaves a clicked button unfocused, so the first ⇧↓ after a ⌘-click found no row to grow from (F45).
journey("Home: after a ⌘-click picks a row, the first ⇧↓ grows the pick (Finder)", async (page) => {
  await openSource(page, AGENTS);
  await openSource(page, TESTING);
  // Today's numbers slow to come, as on a busy Mac: the rows wait for them, or Today grows over the rows' place
  // as they come and a click aimed at a row lands beside it (the ⌘-click picked nothing, CI 2026-11-13).
  await page.evaluate(() => ((window as any).__ORE_SLOW = { today: 800 }));
  await page.getByRole("button", { name: /^Home/ }).click();
  const rows = page.locator(".home-read");
  await rows.nth(1).waitFor();
  if (!(await page.locator(".home-goal").count())) throw new Error("Continue reading showed before Today, which then pushed it down");
  await page.evaluate(() => delete (window as any).__ORE_SLOW);
  await rows.nth(0).locator(".home-open").click({ modifiers: ["Meta"] });
  await until("⌘-click picks the row", async () => (await page.locator(".home-read.sel").count()) === 1);
  await page.keyboard.press("Shift+ArrowDown");
  await until("the first ⇧↓ picks two rows", async () => (await page.locator(".home-read.sel").count()) === 2);
}, "webkit");

journey("Home: focus put on a row after an archive never comes back later: a review he starts and leaves ends with it left alone", async (page) => {
  await openSource(page, AGENTS);
  await openSource(page, TESTING);
  await page.getByRole("button", { name: /^Home/ }).click();
  await page.locator(".home-read").nth(1).waitFor();
  const titles = await page.locator(".home-read .title").allInnerTexts();
  await page.locator(".home-read").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: /^Archive/ }).click();
  await until(`focus moves to “${titles[1]}”`, async () => (await focusedOn(page)) === titles[1]);
  try {
    // Later, something else: a review started with ⌘R where focus is, clicked through and left.
    await page.waitForTimeout(400);
    await page.keyboard.press("Meta+r");
    const pick = page.getByRole("dialog", { name: "What to review" });
    await pick.waitFor();
    await pick.locator(".home-go").click();
    await page.locator(".review-q").waitFor();
    await page.keyboard.press("Escape");
    await page.locator(".review").waitFor({ state: "detached" });
    await page.waitForTimeout(600);
    if ((await focusedOn(page)) === titles[1]) throw new Error("focus jumped back to the row the archive left it on, long after");
  } finally {
    await page.keyboard.press("Meta+z");
    await inLibrary(page, [titles[0]!]);
  }
});

journey("Home: archiving the only Continue reading row puts focus on what is left of Home, a skill tile, not <body>", async (page) => {
  await openSource(page, AGENTS);
  await openSource(page, TESTING);
  await page.getByRole("button", { name: /^Home/ }).click();
  const rows = page.locator(".home-read");
  await rows.nth(1).waitFor();
  const titles = await page.locator(".home-read .title").allInnerTexts();
  try {
    for (let n = titles.length; n > 0; n--) {
      await rows.first().click({ button: "right" });
      await page.getByRole("menuitem", { name: /^Archive/ }).click();
      await until(`${n - 1} rows left`, async () => (await rows.count()) === n - 1);
    }
    const tiles = (await page.locator(".home-skill .home-open").allInnerTexts()).map((t) => t.trim());
    await until("focus is on a skill tile", async () => tiles.includes((await focusedOn(page)) ?? ""));
  } finally {
    for (let n = 0; n < titles.length; n++) await page.keyboard.press("Meta+z");
    await inLibrary(page, titles);
  }
});

journey("Home: a row opened by the keyboard gets focus back on Back only, not when Home is reached another way", async (page) => {
  await openSource(page, TESTING);
  await page.getByRole("button", { name: /^Home/ }).click();
  const row = page.locator(".home-read .home-open").first();
  const title = (await row.innerText()).trim();
  await row.focus();
  await page.keyboard.press("Enter");
  await page.locator(".doc-head").filter({ hasText: title }).waitFor();
  await page.keyboard.press("Meta+0"); // Go to Home, not Back
  await page.locator(".home-read").first().waitFor();
  await page.waitForTimeout(500);
  if ((await focusedOn(page)) === title) throw new Error("Home put focus on the row though he came by Go to Home, not Back");
});

// CI's Linux runner (2026-11-11): ⌘Z right after a collection's rename, while the rename still saved, ran its
// `ore skills arrange` beside the rename's, and the rename's could land last.
journey("sidebar: ⌘Z while a collection's rename still saves puts the old name back, in the sidebar and the library, and it stays", async (page) => {
  const label = (t: RegExp) => page.locator(".side-head").filter({ hasText: t });
  await page.evaluate(() => ((window as unknown as { __ORE_HOLD: Record<string, number[]> }).__ORE_HOLD = { "skills arrange": [900] }));
  await label(/^Craft$/i).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  await page.getByLabel("Collection name").fill("Craft slowly");
  await page.keyboard.press("Enter");
  await label(/^Craft slowly$/i).waitFor();
  // As in Finder, the renamed folder keeps focus: the header drawn in the field's place takes it, even when the
  // next key comes before it is placed (⌘Z pressed at once once left focus on <body>, 3 runs in 4).
  const focusOn = (name: string) => page.evaluate((n) => !!document.activeElement?.matches("button.side-label") && document.activeElement.textContent?.trim().toLowerCase() === n, name.toLowerCase());
  await page.keyboard.press("Meta+z");
  await label(/^Craft$/i).waitFor();
  await until("focus is on the collection again, under its old name", () => focusOn("Craft"));
  const shown: string[] = [];
  for (const end = Date.now() + 2000; Date.now() < end; await page.waitForTimeout(25)) {
    const names = (await page.locator(".side-head .side-label-text").allInnerTexts()).map((t) => t.trim()).join(", ");
    if (shown.at(-1) !== names) shown.push(names);
  }
  if (shown.some((n) => /craft slowly/i.test(n))) throw new Error(`the old name came back and went: ${shown.join(" → ")}`);
  const kept = ((await ore("skills")) as { collection?: string }[]).map((s) => s.collection);
  if (!kept.includes("Craft") || kept.includes("Craft slowly")) throw new Error(`the library kept the rename: ${[...new Set(kept)].join(", ")}`);
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
  // The skills in no collection are one group with no heading (Tyler, 2026-11-20), so no collection is headed Other.
  await until("one Other group, with no heading", async () => (await page.locator('.sidebar [role=group][aria-label="Other"]').count()) === 1 && !(await page.locator(".side-label-text").allInnerTexts()).some((t) => /^other$/i.test(t)));
});

journey("a row's ⋯ menu in a short window stays inside it, scrolling, as its right-click twin does", async (page) => {
  await page.setViewportSize({ width: 900, height: 480 }); // Tauri's smallest window
  await page.getByRole("button", { name: /^All sources/ }).click();
  const rows = page.locator(".row");
  await rows.nth(2).waitFor();
  const last = rows.last();
  const menu = page.locator(".menu-list").last();
  // A row first renders lite and is redrawn in full once it is on screen (Lite.tsx's OnScreen), so the row
  // found a moment ago can be gone by the time it is scrolled to: try again on the row that replaced it.
  await until("the last row's ⋯ opens its menu", async () => {
    try {
      await last.scrollIntoViewIfNeeded({ timeout: 1000 });
      await last.hover({ timeout: 1000 });
      await last.getByRole("button", { name: /^Actions for/ }).click({ timeout: 1000 });
      await menu.waitFor({ timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  });
  await page.waitForTimeout(200);
  const box = (await menu.boundingBox())!;
  if (box.y < 0 || box.y + box.height > 480) throw new Error(`the menu runs out of the window: top ${box.y}, bottom ${box.y + box.height}`);
  await page.keyboard.press("Escape");
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

journey("sidebar: a new skill named like one he has is refused in place, in words, as a taken collection name is", async (page) => {
  await page.locator(".side-section", { hasText: "Craft" }).hover();
  await page.getByRole("button", { name: "New skill in Craft" }).click();
  await page.keyboard.type("  learning  ");
  await page.keyboard.press("Enter");
  await until("it says the name is taken", async () => (await page.locator(".side-new-foot").innerText()) === "“Learning” is taken");
  if (!(await page.getByLabel("New skill name").isVisible())) throw new Error("the field closed");
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

journey("Find narrowing a 10,000-line note answers each key in well under a second (Codex sweep 3, hostile)", async (page) => {
  const item = ((await ore("ls")) as { id: string; title: string }[]).find((i) => i.title === TESTING)!.id;
  const { text: was, dir } = (await ore("notes", item)) as { text: string; dir: string };
  // Too long for a command line: written as a text editor would.
  writeFileSync(join(dir, "notes.md"), Array.from({ length: 10000 }, (_, i) => `Line ${i + 1}: a note about learning.`).join("\n\n") + "\n");
  try {
    await openSource(page, TESTING);
    await page.getByRole("tab", { name: "Source note" }).click();
    await page.getByText("Line 10000: a note about learning.").waitFor({ timeout: 20000 });
    await page.keyboard.press("Meta+f");
    const count = page.locator(".find-count");
    // Toggling a repaint class on every paragraph Find let go made ProseMirror redraw the whole note:
    // seconds per key in Chromium, a freeze in WebKit.
    let before = "";
    for (const ch of "2999") {
      const t = Date.now();
      await page.keyboard.type(ch);
      await until(`"${ch}" counts its matches again`, async () => /\/\d+$/.test(await count.innerText()) && (await count.innerText()) !== before);
      before = await count.innerText();
      if (Date.now() - t > 1500) throw new Error(`typing "${ch}" took ${Date.now() - t} ms`);
    }
    await page.keyboard.press("Escape");
  } finally {
    await ore("notes", item, `--set=${was}`);
  }
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

// #193 made a tile's name its one focusable control, and the arrows went on looking for focus on the tile.
journey("home: arrows move between skill tiles and Continue reading, from the focused name", async (page) => {
  await page.getByRole("button", { name: /^Home/ }).click();
  await page.locator(".home-skill").nth(1).waitFor();
  const focused = () => page.evaluate(() => document.activeElement?.closest(".home-skill, .home-read")?.querySelector(".home-open")?.textContent ?? null);
  const names = await page.locator(".home .home-skill .home-open").allTextContents();
  await page.locator(".home-skill .home-open").first().focus();
  await page.keyboard.press("ArrowRight");
  await until("→ moves to the next tile", async () => (await focused()) === names[1]);
  if (!(await page.evaluate(() => document.activeElement?.classList.contains("home-open")))) throw new Error("focus is not on the tile's name");
  await page.keyboard.press("ArrowLeft");
  await until("← moves back", async () => (await focused()) === names[0]);
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await page.keyboard.press("ArrowDown");
  await until("an arrow with nothing focused picks the first", async () => (await focused()) !== null);
});

journey("All sources' Filter by keys alone: Enter picks the field, Enter picks its first value, and a search that matches no field says so (F218)", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.getByRole("button", { name: "Filter by kind, skill or author" }).click();
  const menu = page.locator(".filter-menu");
  await page.keyboard.type("zzz");
  await menu.getByText("No filters match").waitFor();
  for (let i = 0; i < 3; i++) await page.keyboard.press("Backspace");
  await page.keyboard.press("Enter");
  await menu.getByPlaceholder("Find kinds…").waitFor();
  await until("the first kind is highlighted, as Linear's is", async () => (await menu.locator("[cmdk-item][data-selected=true]").count()) === 1);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Kind: Text" }).waitFor();
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
  await page.getByLabel("Search sources").fill("plausible");
  await page.getByRole("alert").filter({ hasText: "Couldn’t search the text: The index is busy." }).waitFor();
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
});

/** The titles of the rows picked in the list (⇧-click, ⌘-click or the box), in list order. */
const pickedRows = (page: Page) => page.locator(".list .row.sel .title").allInnerTexts();

/** The titles of the list's rows at these places. */
const rowTitles = (page: Page, ...at: number[]) => Promise.all(at.map((i) => page.locator(".list .row").nth(i).locator(".title").innerText()));

/** Presses at (x, y), drags to (x2, y2) and, unless told not to, lets go. */
async function boxDrag(page: Page, x: number, y: number, x2: number, y2: number, release = true) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x2, y2, { steps: 8 });
  if (release) await page.mouse.up();
}

journey("list drag to select: a drag from beside the rows boxes the ones it crosses, back up lets them go, ⇧ adds, Esc mid-drag puts the selection back, ⋯ acts on them all, a click on blank space clears; a drag from a row still carries the row (D194)", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  const rows = page.locator(".list .row");
  await rows.nth(3).waitFor();
  const list = (await page.locator(".list").boundingBox())!;
  /** Row i's box, once it is drawn (the list redraws as a filter's text search comes back). */
  const at = async (i: number) => {
    let b: Awaited<ReturnType<Locator["boundingBox"]>> = null;
    await until(`row ${i} is drawn`, async () => !!(b = await rows.nth(i).boundingBox()));
    return b!;
  };
  const mid = async (i: number) => (await at(i)).y + (await at(i)).height / 2;
  // The list's own space left of its rows, past the sidebar's resize strip (D193), where Finder starts one too.
  const edge = (await page.locator(".side-divider").boundingBox())!;
  const x = (edge.x + edge.width + (await at(0)).x) / 2;
  // A press on that strip resizes the sidebar and never draws the box.
  await boxDrag(page, edge.x + edge.width / 2, (await at(0)).y + 10, edge.x + 60, await mid(2), false);
  if ((await page.locator(".marquee").count()) || (await pickedRows(page)).length) throw new Error("a drag from the sidebar's edge drew the box");
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await boxDrag(page, x, (await at(0)).y + 10, x + 240, await mid(2), false);
  await page.locator(".marquee").waitFor();
  await until("the rows it crosses are selected as it goes", async () => (await pickedRows(page)).join() === (await rowTitles(page, 0, 1, 2)).join());
  await page.mouse.move(x + 240, await mid(0), { steps: 4 });
  await until("back up, the rows it left are let go", async () => (await pickedRows(page)).join() === (await rowTitles(page, 0)).join());
  await page.keyboard.press("Escape");
  await until("Esc mid-drag puts back the selection there was (none) and takes the box away", async () => !(await pickedRows(page)).length && !(await page.locator(".marquee").count()));
  await page.mouse.move(x + 240, await mid(2), { steps: 4 });
  if ((await pickedRows(page)).length) throw new Error("the drag went on after Esc");
  await page.mouse.up();
  await boxDrag(page, x, (await at(0)).y + 10, x + 240, await mid(1));
  await until("released, the selection stays and the box goes", async () => (await pickedRows(page)).length === 2 && !(await page.locator(".marquee").count()));
  // ⇧ held at the start adds to what was there.
  await page.keyboard.down("Shift");
  await boxDrag(page, x, (await at(3)).y + 10, x + 240, await mid(3));
  await page.keyboard.up("Shift");
  await until("⇧ adds the row it crosses", async () => (await pickedRows(page)).join() === (await rowTitles(page, 0, 1, 3)).join());
  await page.keyboard.down("Shift");
  await boxDrag(page, x, (await at(2)).y + 10, x + 240, await mid(2), false);
  await until("a ⇧ drag takes the row in as it goes", async () => (await pickedRows(page)).length === 4);
  await page.keyboard.press("Escape");
  await page.keyboard.up("Shift");
  await page.mouse.up();
  await until("Esc puts back the three", async () => (await pickedRows(page)).join() === (await rowTitles(page, 0, 1, 3)).join());
  // The selection is one made with ⇧-click: the ⋯ of any row in it acts on all three.
  await rows.nth(1).hover();
  await rows.nth(1).getByRole("button", { name: "Actions for 3 sources" }).click();
  await page.getByRole("menuitem", { name: /^Move 3 sources to/ }).waitFor();
  await page.keyboard.press("Escape");
  await until("the menu closed", async () => !(await page.getByRole("menu").count()));
  // A press on blank space with no drag clears it, as in Finder.
  await page.mouse.click(x, (await at(1)).y + 10);
  await until("a click on blank space clears the selection", async () => !(await pickedRows(page)).length);
  // Below the last row: up over it. A filter leaves one row, so there is room below it whatever the library holds.
  await page.getByLabel("Search sources").fill("Retrieval Beats Rereading");
  await until("the filter leaves one row", async () => (await rows.count()) === 1);
  const only = await at(0);
  const room = list.y + list.height - (only.y + only.height);
  if (room < 60) throw new Error(`no room below the last row (${Math.round(room)}px)`);
  await boxDrag(page, x + 300, only.y + only.height + 30, x + 320, await mid(0));
  await until("a drag from below the last row selects it", async () => (await pickedRows(page)).join() === (await rowTitles(page, 0)).join());
  await page.getByLabel("Search sources").fill("");
  await rows.nth(3).waitFor();
  // A key that leaves the view mid-drag ends it: no box over the next view, and nothing picked carried back.
  await boxDrag(page, x, (await at(0)).y + 10, x + 240, await mid(1), false);
  await until("two picked", async () => (await pickedRows(page)).length === 2);
  await page.keyboard.press("Meta+0");
  await page.locator(".home-goal").waitFor();
  await page.mouse.move(x + 260, 400, { steps: 4 });
  if (await page.locator(".marquee").count()) throw new Error("the box followed the pointer over Home");
  await page.mouse.up();
  await page.getByRole("button", { name: /^All sources/ }).click();
  await rows.nth(3).waitFor();
  await page.mouse.move(x + 200, await mid(2), { steps: 4 });
  if ((await pickedRows(page)).length || (await page.locator(".marquee").count())) throw new Error("the drag left over from before Home picked rows on coming back");
  // One click on a row still opens it, and back, the list is as it was.
  await rows.nth(1).click();
  await page.locator(".doc-head").waitFor();
  await page.keyboard.press("Escape");
  await rows.nth(3).waitFor();
  // A drag that starts on a row carries the row (to file it on a skill), and boxes nothing.
  await boxDrag(page, (await at(0)).x + 60, await mid(0), (await at(0)).x + 60, await mid(3), false); // on its picture
  await page.locator(".row-ghost").waitFor();
  if ((await page.locator(".marquee").count()) || (await pickedRows(page)).length) throw new Error("a drag from a row drew the box");
  await page.mouse.up();
  await until("dropped on no skill, nothing is picked", async () => !(await page.locator(".row-ghost").count()) && !(await pickedRows(page)).length);
});

journey("list drag to select survives a refresh of the same list landing mid-drag: the box goes on and picks the rows it reaches (D194)", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  const rows = page.locator(".list .row");
  await rows.nth(2).waitFor();
  await loaded(page);
  const at = async (i: number) => (await rows.nth(i).boundingBox())!;
  const mid = async (i: number) => (await at(i)).y + (await at(i)).height / 2;
  const edge = (await page.locator(".side-divider").boundingBox())!;
  const x = (edge.x + edge.width + (await at(0)).x) / 2;
  // Pinning a row reads the list again after it writes (`ls` and `ls --archived`); those reads are held until the
  // box is being dragged, then let go, so they land mid-drag.
  await hold(page, "ls", 2);
  const pinned = (await rowTitles(page, 2))[0]!;
  try {
    await rows.nth(2).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Pin to top" }).click();
    await until("pinned on screen at once", async () => (await rowTitles(page, 0))[0] === pinned);
    await boxDrag(page, x, (await at(0)).y + 10, x + 240, await mid(1), false);
    await until("two picked", async () => (await pickedRows(page)).length === 2);
    await until("the list's read again is waiting", () => isHeld(page, "ls"));
    const landed = answered(page, "ls");
    await release(page, "ls");
    await landed;
    await loaded(page); // and drawn
    await page.mouse.move(x + 240, await mid(2), { steps: 4 });
    await until("the box goes on to the third row", async () => (await pickedRows(page)).join() === (await rowTitles(page, 0, 1, 2)).join());
    if ((await page.locator(".marquee").count()) !== 1) throw new Error("the box went with the refresh");
    await page.mouse.up();
    await until("released, the three stay", async () => (await pickedRows(page)).length === 3 && !(await page.locator(".marquee").count()));
  } finally {
    // Unpinned for the journeys after this one, whatever happened above.
    await page.mouse.up().catch(() => {});
    await release(page, "ls").catch(() => {});
    const row = ((await ore("ls")) as { id: string; title: string; pinned_at?: string }[]).find((i) => i.title === pinned);
    if (row?.pinned_at) await ore("pin", row.id, "--undo");
  }
});

journey("list drag to select on a skill page: a drag from the column beside its sources selects the ones it crosses; a click there clears (D194)", async (page) => {
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  const rows = page.locator(".skill-page .list .row");
  await rows.nth(1).waitFor();
  await loaded(page);
  const list = (await page.locator(".skill-page .list").boundingBox())!;
  const r0 = (await rows.nth(0).boundingBox())!;
  const r1 = (await rows.nth(1).boundingBox())!;
  const x = list.x + list.width + 6; // right of the rows, in the column
  await boxDrag(page, x, r0.y + 8, x - 200, r1.y + r1.height / 2);
  await until("both rows are selected", async () => (await pickedRows(page)).join() === (await rowTitles(page, 0, 1)).join());
  // Read again: the page above the list settles as it loads.
  await page.mouse.click(x, (await rows.nth(0).boundingBox())!.y + 8);
  await until("a click beside them clears", async () => !(await pickedRows(page)).length);
});

journey("list drag to select in WebKit: the box selects the rows it crosses without their text, and the list has the keys after it: ⇧↓ goes on, Esc clears (D194)", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  const rows = page.locator(".list .row");
  await rows.nth(2).waitFor();
  await loaded(page); // the list as read, not mid-redraw (a row once had no box here)
  const list = (await page.locator(".list").boundingBox())!;
  const r0 = (await rows.nth(0).boundingBox())!;
  const r1 = (await rows.nth(1).boundingBox())!;
  const edge = (await page.locator(".side-divider").boundingBox())!;
  const x = (edge.x + edge.width + r0.x) / 2; // left of the rows, past the sidebar's resize strip
  await boxDrag(page, x, r0.y + 10, list.x + 200, r1.y + r1.height / 2);
  await until("both rows are selected", async () => (await pickedRows(page)).join() === (await rowTitles(page, 0, 1)).join());
  if (await page.evaluate(() => !!window.getSelection()?.toString())) throw new Error("the drag selected the rows' text");
  await page.keyboard.press("Shift+ArrowDown");
  await until("⇧↓ goes on from the row the box reached, as after a ⇧-click", async () => (await pickedRows(page)).join() === (await rowTitles(page, 0, 1, 2)).join());
  await page.keyboard.press("Escape");
  await until("Esc clears it", async () => !(await pickedRows(page)).length);
  // Words selected in a skill's note let go on a press on blank space beside its sources, as any click lets them go.
  await page.locator(".sidebar .side-item", { hasText: "Teaching" }).first().click();
  const srow = page.locator(".skill-page .list .row").first();
  await srow.waitFor();
  await loaded(page);
  const note = page.locator(".skill-page .note-editor [contenteditable=true]").first();
  await until("the note takes the caret", async () => (await note.click(), await note.evaluate((e) => e.contains(document.activeElement))));
  await page.keyboard.press("Meta+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Words to let go");
  await page.keyboard.press(process.platform === "darwin" ? "Meta+Shift+ArrowLeft" : "Shift+Home"); // to the line's start
  await until("words selected in the note", async () => (await page.evaluate(() => getSelection()!.toString())) === "Words to let go");
  const sl = (await page.locator(".skill-page .list").boundingBox())!;
  await page.mouse.click(sl.x + sl.width + 6, (await srow.boundingBox())!.y + 8);
  await until("the press on blank space let the words go", async () => !(await page.evaluate(() => getSelection()!.toString())));
  // That press blurred the note, which saves it: the page closes only once the save has answered (WebKit reports
  // a request cut off by a closing page as a page error, which fails the run).
  await loaded(page);
}, "webkit");

journey("list drag to select on a narrow skill page (one column, the sources under the note): one box, the list's, and the list keeps the keys (D194)", async (page) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  const rows = page.locator(".skill-page .list .row");
  await rows.nth(1).waitFor();
  // The note and stats above load after the rows and push them down: measure once they have.
  await loaded(page);
  await rows.nth(1).scrollIntoViewIfNeeded();
  const list = (await page.locator(".skill-page .list").boundingBox())!;
  const r0 = (await rows.nth(0).boundingBox())!;
  const r1 = (await rows.nth(1).boundingBox())!;
  const x = list.x - 4; // left of the rows, in the column's padding, under the note's gutter
  await boxDrag(page, x, r0.y + 8, x + 200, r1.y + r1.height / 2, false);
  await until("both rows are selected", async () => (await pickedRows(page)).join() === (await rowTitles(page, 0, 1)).join());
  const boxes = await page.locator(".marquee").count();
  await page.mouse.up();
  if (boxes !== 1) throw new Error(`${boxes} boxes drawn`);
  if (!(await page.evaluate(() => document.activeElement?.classList.contains("list")))) throw new Error("focus is not on the list after the drag");
  await page.keyboard.press("Escape");
  await until("Esc clears the rows", async () => !(await pickedRows(page)).length);
});

journey("Home: Done after meeting the goal keeps Continue reading still from its first paint (F125)", async (page) => {
  const log = oreCalls(page);
  const was = (await ore("today")) as { goal_minutes: number };
  try {
    await ore("goal", "--minutes", "1");
    await page.reload();
    await page.locator(".home-read").first().waitFor();
    await startReview(page, null);
    // Advance only the review's elapsed clock; the real CLI records the rating and computes Today.
    await page.evaluate(() => { const now = Date.now; Date.now = () => now() + 61_000; });
    await reveal(page);
    await page.getByRole("button", { name: "Good", exact: true }).click();
    await page.locator(".review-goal").waitFor();
    await page.keyboard.press("Escape");
    await page.locator(".review-end").waitFor();
    // Widen the real refresh window, without changing Today's reply.
    await page.evaluate(() => {
      const w = window as unknown as { __ORE_SLOW: Record<string, number>; homeFrames: number[]; stopHomeFrames: boolean };
      w.__ORE_SLOW = { today: 500 };
      w.homeFrames = [];
      w.stopHomeFrames = false;
      const frame = () => {
        const row = document.querySelector(".home-read");
        if (!document.querySelector(".review") && row) w.homeFrames.push(row.getBoundingClientRect().y);
        if (!w.stopHomeFrames) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    await page.locator(".review-foot").getByRole("button", { name: "Done", exact: true }).click();
    await page.locator(".home-goal-text p").filter({ hasText: "Goal met" }).waitFor();
    await page.waitForTimeout(250);
    const frames = await page.evaluate(() => {
      const w = window as unknown as { homeFrames: number[]; stopHomeFrames: boolean };
      w.stopHomeFrames = true;
      return w.homeFrames;
    });
    if (frames.length < 2) throw new Error("no first and settled Home paints measured");
    console.log(`      Continue reading first=${frames[0]}, settled=${frames.at(-1)}, range=${Math.max(...frames) - Math.min(...frames)}px (${frames.length} frames)`);
    if (Math.max(...frames) - Math.min(...frames) > 0.5) throw new Error(`Continue reading moved after Done: ${JSON.stringify(frames)}`);
    if (process.env.ORE_E2E_SHOT) await page.screenshot({ path: process.env.ORE_E2E_SHOT });
  } finally {
    await log.undoAll();
    await ore("goal", "--minutes", String(was.goal_minutes));
  }
});

journey("Home: two Continue reading rows picked with ⌘ show the pick's bar, as All sources does (Codex UX sweep 4, D283)", async (page) => {
  const rows = page.locator(".home-read .home-open");
  await rows.nth(1).waitFor();
  await rows.nth(0).click({ modifiers: ["Meta"] });
  await rows.nth(1).click({ modifiers: ["Meta"] });
  const bar = page.getByRole("toolbar", { name: "Actions for 2 picked sources" });
  await bar.waitFor({ timeout: 3000 });
  await bar.getByRole("button", { name: "Mark done" }).waitFor();
  await page.keyboard.press("Escape");
  await bar.waitFor({ state: "detached" });
});

journey("sidebar: New skill says Saving… while it is made, and Esc meanwhile leaves its page unopened (Codex UX sweep 5)", async (page) => {
  const name = `Left while saving ${Date.now() % 100000}`;
  await page.keyboard.press("Meta+k");
  await page.keyboard.type("New skill");
  await page.keyboard.press("Enter");
  const field = page.locator('[aria-label="New skill name"]');
  await field.fill(name);
  await hold(page, "skills add");
  await page.keyboard.press("Enter");
  await until("its write is out", () => isHeld(page, "skills add"));
  await page.locator(".side-new-foot").filter({ hasText: "Saving…" }).waitFor({ timeout: 2000 });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await release(page, "skills add");
  await page.locator(".sidebar .side-item", { hasText: name }).waitFor();
  await Bun.sleep(500);
  try {
    if (await page.locator(".skill-hero").count()) throw new Error("the skill's page opened over Home after he left its field");
  } finally {
    const made = ((await ore("skills")) as { id: string; name: string }[]).find((k) => k.name === name);
    if (made) await ore("skills", "rm", made.id);
  }
});

journey("sidebar: a collection rename that is refused opens its field again with the name he typed (Codex UX sweep 5)", async (page) => {
  const head = page.locator(".sidebar .side-label", { hasText: "Craft" }).first();
  await head.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  const field = page.getByLabel("Collection name");
  await field.fill("Workshop shelf");
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { "skills arrange": "Test: collection write refused" }));
  try {
    await field.press("Enter");
    await until("the field is back with his words", async () => (await field.count()) > 0 && (await field.inputValue()) === "Workshop shelf");
  } finally {
    await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
  }
  // The name it had, saved as it was: nothing changes.
  await field.fill("Craft");
  await field.press("Enter");
  await head.waitFor();
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
  // In a source there is no list: the text takes it.
  await openSource(page, AGENTS);
  await page.getByRole("button", { name: /^All sources/ }).focus();
  await page.keyboard.press("Shift+Meta+KeyS");
  await until("⇧⌘S in a source puts focus on the text", () => page.evaluate(() => document.activeElement?.classList.contains("reader-scroll") === true));
  await page.keyboard.press("Shift+Meta+KeyS");
  await page.locator(".sidebar .side-item").first().waitFor();
  // Every hover-only ⋯ does the same, not only the sidebar's: Home's skill tiles.
  await page.getByRole("button", { name: /^Home/ }).click();
  const tile = page.locator(".home-skill").first();
  await tile.hover();
  await tile.locator(".more").click();
  await page.getByRole("menu").waitFor();
  await page.mouse.move(0, 0);
  await page.keyboard.press("Escape");
  await until("Home's tile ⋯ gives focus to its tile's name", () => tile.locator(".home-open").evaluate((el) => el === document.activeElement));
});

journey("sidebar: a header's New skill and toggle are enabled buttons, not dimmed by the drag handle", async (page) => {
  const plus = page.getByRole("button", { name: /^New skill in / }).first();
  await plus.hover();
  // A click's checks, without the click: an aria-disabled ancestor makes it "not enabled".
  await plus.click({ trial: true, timeout: 2000 });
  const dimmed = await page.evaluate(() => [...document.querySelectorAll(".side-head")].filter((h) => h.closest("[aria-disabled=true]")).length);
  if (dimmed) throw new Error(`${dimmed} section header(s) read as disabled`);
});

journey("list type-select: typing a title's first letters selects its row, as Finder does; the same letter again steps to the next; after a pause it starts over; ↵ opens it", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  const titles = () => page.locator(".list .row .title").allInnerTexts();
  const selected = () => page.locator(".list .row[aria-selected=true] .title").innerText();
  await until("All sources lists three sources", async () => (await titles()).length >= 3);
  const all = await titles();
  await page.locator(".list").focus();
  // The last row, by the first letters of its title that no row above it shares.
  const low = all.map((t) => t.toLowerCase());
  const at = low.findLastIndex((t) => /^[a-z]/.test(t));
  if (at < 1) throw new Error(`no row past the first to type to: ${all.join(" / ")}`);
  let n = 1;
  while (n < low[at]!.length && low.findIndex((t) => t.startsWith(low[at]!.slice(0, n))) !== at) n++;
  if (low.findIndex((t) => t.startsWith(low[at]!.slice(0, n))) !== at) throw new Error(`“${all[at]}” has no prefix of its own (a row above starts with it)`);
  await page.keyboard.type(low[at]!.slice(0, n), { delay: 60 });
  await until(`typing “${low[at]!.slice(0, n)}” selects “${all[at]}”`, async () => (await selected()) === all[at]);
  // A letter starting a row higher up, typed after a pause, starts over.
  const first = low.findIndex((t) => /^[a-z]/.test(t));
  await page.waitForTimeout(1200);
  await page.keyboard.type(low[first]![0]!);
  await until(`after a pause “${low[first]![0]}” selects “${all[first]}”`, async () => (await selected()) === all[first]);
  const twin = low.findIndex((t, i) => i > first && t[0] === low[first]![0]);
  if (twin > 0) {
    await page.keyboard.type(low[first]![0]!);
    await until(`the same letter again steps to “${all[twin]}”`, async () => (await selected()) === all[twin]);
  }
  const want = await selected();
  await page.keyboard.press("Enter");
  await until(`↵ opens “${want}”`, async () => (await page.locator(".doc-head").innerText()).includes(want));
});

journey("list archive: ⇧⌘A selects the row after the archived one, so a second ⇧⌘A archives that row; ⌘Z brings each back", async (page) => {
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
  await page.keyboard.press("Shift+Meta+KeyA");
  await until(`“${before[2]}” is selected after the archive`, async () => (await selected()) === before[2]);
  await page.keyboard.press("Shift+Meta+KeyA");
  await until("the second A archives the row after", async () => !(await titles()).includes(before[2]!));
  const after = await titles();
  if (!after.includes(before[0]!)) throw new Error(`the second A archived “${before[0]}”, which he never picked`);
  await page.waitForTimeout(500);
  await page.keyboard.press("Meta+z");
  await page.keyboard.press("Meta+z");
  await until("⌘Z ⌘Z bring both back", async () => (await titles()).length === before.length);
  for (const t of before) if (!(await titles()).includes(t)) throw new Error(`“${t}” did not come back`);
  await inLibrary(page, before);
});

journey("list archive Undo selects the source it put back, as Finder does, though the row was never selected", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  const titles = () => page.locator(".list .row .title").allInnerTexts();
  const selected = () => page.locator(".list .row[aria-selected=true] .title").innerText();
  await until("All sources lists three sources", async () => (await titles()).length >= 3);
  const before = await titles();
  // Nothing picked: the first row stands for the selection. Archive the third from its menu.
  const row = page.locator(".list .row").filter({ has: page.locator(".title", { hasText: before[2]! }) }).first();
  // Undo while the archive still saves, and the undo slower than a list read: a read begun after
  // the archive saved, before the undo reached the library, used to land and move the selection on.
  let release = () => {};
  let undone = () => {};
  const undoSaved = new Promise<void>((ok) => (undone = ok));
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"archive",')) return route.fallback();
    if (body.includes('"--undo"')) {
      await new Promise((ok) => setTimeout(ok, 1500));
      await route.fallback();
      return undone();
    }
    await new Promise<void>((ok) => (release = ok));
    await route.fallback();
  });
  try {
    await row.click({ button: "right" });
    await page.getByRole("menuitem", { name: /Archive/ }).click();
    await until("the row leaves the list", async () => !(await titles()).includes(before[2]!));
    await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
    await until("Undo brings it back", async () => (await titles()).includes(before[2]!));
    release();
    await undoSaved;
  } finally {
    release();
    await page.unroute(/\/ore$/);
  }
  await until("the library has it back", async () => ((await ore("ls")) as { title: string }[]).some((i) => i.title === before[2]));
  await page.waitForTimeout(300);
  // The first ↓ shows the selection where it is.
  await page.locator(".list").focus();
  await page.keyboard.press("ArrowDown");
  await until(`“${before[2]}” is selected`, async () => (await selected()) === before[2]);
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

journey("stacked Undo: each ⌘Z's toast comes to the front and names the source it put back", async (page) => {
  // A ⌘Z whose write runs late, as one did on a stalled CI runner (F190): the library has
  // all three back only once the app's writes have answered, past any fixed wait.
  await page.getByRole("button", { name: /^All sources/ }).click();
  const titles = () => page.locator(".list .row .title").allInnerTexts();
  await until("All sources lists three sources", async () => (await titles()).length >= 3);
  const before = await titles();
  // The first one archived is the last one put back: its archive saves at once, its ⌘Z's write runs 6 s late.
  const first = ((await ore("ls")) as { id: string; title: string }[]).find((i) => i.title === before[0])!;
  await page.evaluate((key) => void ((window as unknown as { __ORE_HOLD?: Record<string, number[]> }).__ORE_HOLD = { [key]: [0, 6000] }), `archive ${first.id}`);
  await page.locator(".list").focus();
  await page.keyboard.press("ArrowDown");
  for (const t of before.slice(0, 3)) {
    await page.keyboard.press("Shift+Meta+KeyA");
    await until(`“${t}” is archived`, async () => !(await titles()).includes(t));
  }
  const front = () => page.locator(".toasts .toast").last().locator(".toast-msg").innerText();
  await page.keyboard.press("Meta+z");
  await until("the first ⌘Z names the last one archived", async () => (await front()) === `Undone: Archived “${before[2]}”`);
  await page.keyboard.press("Meta+z");
  await until("the second ⌘Z's toast is in front, naming the one it put back", async () => (await front()) === `Undone: Archived “${before[1]}”`);
  await page.keyboard.press("Meta+z");
  // The held write lands 6 s after this ⌘Z. Its row is back at once, but a list read still on its way from the ⌘Z
  // before can take it off again until then (F392), so the wait outlasts the hold.
  await until("all three are back", async () => (await titles()).length === before.length, 15_000);
  await inLibrary(page, before);
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
    await release(page, "archive"); // its answer comes in now, and the list reads it before the page closes
    await loaded(page);
    await ore("archive", made.id);
    await ore("archive", ((await ore("ls", "--archived")) as { id: string; title: string }[]).find((i) => i.title === AGENTS)!.id, "--undo");
  }
});

journey("course: a rename from its menu goes on the history; ⌘Z puts the old name back, ⇧⌘Z renames it again", async (page) => {
  // A course needs a course site to add; two sources made its lessons stand in.
  if (!LIB) throw new Error("this journey edits the library: set ORE_LIBRARY to the running mock's");
  // Core by path, so the desktop's typecheck doesn't take in core's sources.
  const { updateItemMeta } = (await import(join(import.meta.dir, "../../../../packages/core/src/items.ts"))) as { updateItemMeta: (lib: { root: string }, id: string, patch: (m: object) => object) => Promise<unknown> };
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

journey("course: ⌘Z of a skill filed on it gives each lesson back its own skills; ⌘Z of Archive course brings back only what it archived", async (page) => {
  if (!LIB) throw new Error("this journey edits the library: set ORE_LIBRARY to the running mock's");
  const { updateItemMeta } = (await import(join(import.meta.dir, "../../../../packages/core/src/items.ts"))) as { updateItemMeta: (lib: { root: string }, id: string, patch: (m: object) => object) => Promise<unknown> };
  const made = (await Promise.all(["A", "B"].map((n) => fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich", "--json"], stdin: `# Part ${n}\n\nA lesson.` }) }).then((r) => r.json())))) as { id: string }[];
  for (const [i, m] of made.entries()) await updateItemMeta({ root: LIB }, m.id, (x) => ({ ...x, course: { id: "mixed-course", title: "Mixed course", part: i + 1 } }));
  await ore("edit", made[0]!.id, "--skills", "learning");
  await ore("edit", made[1]!.id, "--skills", "teaching");
  const skillsOf = async () => {
    const all = (await ore("ls")) as { id: string; skills: string[] }[];
    return made.map((m) => [...(all.find((i) => i.id === m.id)?.skills ?? [])].sort().join("+")).join(" / ");
  };
  const archivedOf = async () => {
    const gone = (await ore("ls", "--archived")) as { id: string }[];
    return made.map((m) => gone.some((i) => i.id === m.id)).join("/");
  };
  try {
    await page.reload();
    await page.getByRole("button", { name: /^All sources/ }).click();
    const row = page.locator(".list .row.course").filter({ hasText: "Mixed course" });
    await row.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Skills" }).hover();
    await page.getByRole("menuitemcheckbox", { name: "Habits" }).or(page.getByRole("menuitem", { name: "Habits" })).first().click();
    await until("both lessons are under Habits, keeping their own", async () => (await skillsOf()) === "habits+learning / habits+teaching");
    await page.waitForTimeout(300);
    await page.keyboard.press("Meta+z");
    await until("⌘Z gives each lesson back its own skills", async () => (await skillsOf()) === "learning / teaching");
    // From a skill's page, where the row lists only that skill's lessons, the course is still the whole course.
    await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
    await page.locator(".row.course").filter({ hasText: "Mixed course" }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Skills" }).focus();
    await page.keyboard.press("ArrowRight");
    await page.getByRole("menuitemcheckbox", { name: "Habits" }).or(page.getByRole("menuitem", { name: "Habits" })).first().click();
    await until("filed from a skill page, every lesson is under Habits", async () => (await skillsOf()) === "habits+learning / habits+teaching");
    await page.waitForTimeout(300);
    await page.keyboard.press("Meta+z");
    await until("and ⌘Z takes it off both", async () => (await skillsOf()) === "learning / teaching");
    // One lesson archived first, then the course: ⌘Z of the course brings back only the other.
    await ore("archive", made[1]!.id);
    await page.reload();
    await page.getByRole("button", { name: /^All sources/ }).click();
    await page.locator(".list .row").filter({ hasText: /Mixed course|Part A/ }).first().click({ button: "right" });
    await page.getByRole("menuitem", { name: /^Archive/ }).click();
    await until("the course is archived", async () => (await archivedOf()) === "true/true");
    await page.waitForTimeout(300);
    await page.keyboard.press("Meta+z");
    await until("⌘Z brings back only the lesson it archived", async () => (await archivedOf()) === "false/true");
    await page.waitForTimeout(400);
    if ((await archivedOf()) !== "false/true") throw new Error("⌘Z of Archive course also restored a lesson archived before it");
  } finally {
    for (const m of made) await ore("archive", m.id).catch(() => {});
  }
});

journey("sidebar: its edge drags to resize between a min and a max, Esc puts it back, double-click resets, and the width is remembered", async (page) => {
  const side = page.locator("nav.sidebar");
  const edge = page.getByRole("separator", { name: "Resize the sidebar" });
  const width = async () => Math.round((await side.boundingBox())!.width);
  const content = async () => Math.round((await page.locator("main.main").boundingBox())!.x);
  const near = (a: number, b: number) => Math.abs(a - b) <= 2;
  /** Presses the edge, drags it to `x`, then lets go (or presses Esc first). */
  const drag = async (x: number, esc = false) => {
    const d = (await edge.boundingBox())!;
    await page.mouse.move(d.x + d.width / 2, d.y + 300);
    await page.mouse.down();
    await page.mouse.move(x, d.y + 300, { steps: 5 });
    if (esc) await page.keyboard.press("Escape");
    await page.mouse.up();
  };
  const settle = (what: string, w: number) => until(what, async () => near(await width(), w) && near(await content(), w));
  await settle("the sidebar starts at 216", 216);
  await drag(300);
  await settle("dragged wider, the sidebar and the content follow", 300);
  await drag(1000);
  await settle("it stops at its max (360 in a 1280 window)", 360);
  await drag(120);
  await settle("it stops at its min (180), short of where it folds (D304)", 180);
  const sideways = await side.evaluate((n) => n.scrollWidth - n.clientWidth);
  if (sideways > 0) throw new Error(`at its min the sidebar scrolls ${sideways}px sideways`);
  await drag(300);
  await settle("dragged back out", 300);
  await drag(340, true);
  await settle("Esc mid-drag puts it back", 300);
  if (!(await side.isVisible())) throw new Error("Esc during the drag hid the sidebar");
  await page.reload();
  await side.waitFor();
  await settle("the width survives a reload", 300);
  await page.getByRole("button", { name: "Hide sidebar" }).click();
  await side.waitFor({ state: "hidden" });
  if (await edge.count()) throw new Error("the edge stays with the sidebar hidden");
  await page.getByRole("button", { name: "Show sidebar" }).click();
  await settle("hidden and shown again, it keeps its width", 300);
  await edge.dblclick();
  await settle("double-click resets it", 216);
  await page.reload();
  await side.waitFor();
  await settle("the reset is remembered", 216);
  await drag(1000);
  await settle("back at its max", 360);
  await page.setViewportSize({ width: 720, height: 700 });
  await settle("a narrow window clamps it (40% of 720)", 288);
  await page.setViewportSize({ width: 1280, height: 800 });
  await settle("widened again, it comes back to the width he chose", 360);
  // The strip leaves the title bar (the window drags there) and the sidebar's scrollbar to them.
  const hit = (x: number, y: number) => page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest(".side-divider, .titlebar, .sidebar")?.className ?? "", [x, y]);
  if (!(await hit(360, 10)).includes("titlebar")) throw new Error(`the title bar over the sidebar's edge is covered by: ${await hit(360, 10)}`);
  if (!(await hit(358, 300)).includes("sidebar")) throw new Error(`the sidebar's scrollbar is covered by: ${await hit(358, 300)}`);
  // Dragged past its max, the pointer keeps the resize cursor over the content, and no text gets selected.
  const d = (await edge.boundingBox())!;
  await page.mouse.move(d.x + d.width / 2, d.y + 300);
  await page.mouse.down();
  await page.mouse.move(900, d.y + 300, { steps: 5 });
  const under = await page.evaluate(([x, y]) => getComputedStyle(document.elementFromPoint(x!, y!)!).cursor, [900, d.y + 300]);
  await page.mouse.up();
  if (under !== "col-resize") throw new Error(`past the max the cursor over the content is ${under}`);
  // A wide sidebar and the note panel dragged to its max: the reader keeps what it had with the sidebar at 216.
  await page.setViewportSize({ width: 1100, height: 800 });
  await openSource(page, AGENTS);
  await page.getByRole("tab", { name: "Source note" }).click().catch(() => {});
  const note = page.getByRole("separator", { name: "Resize the side panel" });
  const n = (await note.boundingBox())!;
  await page.mouse.move(n.x + n.width / 2, n.y + 300);
  await page.mouse.down();
  await page.mouse.move(20, n.y + 300, { steps: 6 });
  await page.mouse.up();
  const reader = async () => Math.round((await page.locator(".mynotes").boundingBox())!.x - (await side.boundingBox())!.width);
  await until("the reader column keeps at least 224px at 1100", async () => (await reader()) >= 222);
  await page.waitForTimeout(200);
  if ((await reader()) < 222) throw new Error(`the reader column is ${await reader()}px`);
});

journey("all sources: a filter is a tag in the search; closing its list leaves the keys there, and ⌫ takes it off", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.getByRole("button", { name: "Filter by kind, skill or author" }).click();
  await page.getByRole("option", { name: "Kind" }).click();
  await page.locator(".filter-menu [cmdk-item]").first().click();
  await page.keyboard.press("Escape");
  const tag = page.locator(".filter .filter-tag");
  await tag.waitFor();
  const search = page.getByRole("textbox", { name: "Search sources" });
  await until("the search has the keys after the list closes", () => search.evaluate((el) => el === document.activeElement));
  await page.keyboard.press("Backspace");
  await until("⌫ in the empty search takes the tag off", async () => (await tag.count()) === 0);
  // × takes a tag off and leaves the keys in the search, so ⌫ and typing still work.
  await page.getByRole("button", { name: "Filter by kind, skill or author" }).click();
  await page.getByRole("option", { name: "Kind" }).click();
  await page.locator(".filter-menu [cmdk-item]").first().click();
  await page.keyboard.press("Escape");
  await page.locator(".filter-tag-x").click();
  await until("× takes the tag off", async () => (await tag.count()) === 0);
  await until("the search keeps the keys after ×", () => search.evaluate((el) => el === document.activeElement));
});

// F544, F543, F542 (Impeccable round 10): the filter tag's × drew 2px wider than its
// button and past the tag's edge; a highlighted filter row's count stayed faint on the highlight (3.97:1); and in a
// 720px window with a tag in the search the open tab's name was cut mid-letter ("To re").
journey("all sources: a filter tag's × fits its button, a highlighted filter row's count is readable, and a narrow window never cuts the open tab's name", async (page) => {
  // One source archived, so the Archived tab stands beside To read and Done: the three tabs are what ran out of room.
  const put = ((await ore("ls")) as { id: string }[])[0]!.id;
  await ore("archive", put);
  try {
  await page.reload();
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.getByRole("button", { name: "Filter by kind, skill or author" }).click();
  await page.getByRole("option", { name: "Kind" }).click();
  const row = page.locator(".filter-menu [cmdk-item][data-selected=true]").first();
  await row.locator(".filter-n").waitFor();
  const ratio = await row.locator(".filter-n").evaluate((n) => {
    const rgb = (c: string) => c.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const lum = (c: number[]) => c.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i]!, 0);
    const a = lum(rgb(getComputedStyle(n).color)), b = lum(rgb(getComputedStyle(n.closest("[cmdk-item]")!).backgroundColor));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  });
  await row.click();
  await page.keyboard.press("Escape");
  const x = page.locator(".filter-tag-x");
  await x.waitFor();
  const over = await x.evaluate((b) => b.querySelector("svg")!.getBoundingClientRect().right - b.getBoundingClientRect().right);
  await page.setViewportSize({ width: 720, height: 800 });
  await page.waitForTimeout(400);
  const cut = await page.locator(".head-tab.on .head-tab-name > *").evaluate((h) => h.scrollWidth - h.clientWidth);
  if (process.env.ORE_E2E_SHOT) await page.screenshot({ path: process.env.ORE_E2E_SHOT });
  await x.click();
  const wrong = [ratio < 4.5 && `the highlighted row's count is ${ratio.toFixed(2)}:1`, over > 0.5 && `the × overhangs its button by ${over}px`, cut > 0 && `the open tab's name is cut by ${cut}px at 720`].filter(Boolean);
  if (wrong.length) throw new Error(wrong.join("; "));
  } finally {
    await ore("archive", put, "--undo");
  }
});

journey("sidebar: a skill dropped on the page outside the sidebar stays where it was (sweep 5, F308)", async (page) => {
  const order = () => page.locator(".sidebar [role=group] .side-item").allInnerTexts();
  await until("the skills are in the sidebar", async () => (await order()).includes("Creativity"));
  const before = await order();
  const from = (await page.locator(".sidebar .side-item", { hasText: "Creativity" }).first().boundingBox())!;
  await page.mouse.move(from.x + 40, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + from.height / 2 + 10, { steps: 4 });
  await page.mouse.move(900, 720, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await settled(page);
  const after = await order();
  if (JSON.stringify(after) !== JSON.stringify(before)) throw new Error(`the skills moved: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
});

journey("all sources: a search that matches nothing offers Clear the search, and the rows stop at 1120px on a wide window (F297, F298)", async (page) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.getByRole("button", { name: /^All sources/ }).click();
  const row = page.locator("main .list .row").first();
  await row.waitFor();
  // The list's reads (ls, ls --archived) land after the first rows show and draw them anew: measured in between,
  // the row was gone (null box, CI on #562).
  await settled(page);
  const box = (await row.boundingBox())!;
  if (box.width > 1144) throw new Error(`a row is ${box.width}px wide on a 1920px window`);
  const bar = (await page.locator("main .list-bar").boundingBox())!;
  if (Math.abs(bar.x - (box.x + 12)) > 1) throw new Error(`the head starts at ${bar.x}, the rows' text column at ${box.x + 12}`);
  await page.keyboard.press("Meta+f");
  const search = page.getByRole("textbox", { name: "Search sources" });
  await until("⌘F puts the keys in the search", () => search.evaluate((el) => el === document.activeElement));
  await page.keyboard.type("zzqqzz");
  await page.getByRole("button", { name: "Clear the search" }).click();
  await row.waitFor();
});

journey("sidebar and side panel: an edge dragged past half its narrowest dims what it will hide, and letting go hides it; it comes back at the width it had (D304)", async (page) => {
  const side = page.locator("nav.sidebar");
  /** Presses `edge`, drags it to `x`, checks the dimmed look there, then lets go (or presses Esc first). */
  const drag = async (edge: Locator, x: number, dim: string, esc = false) => {
    const d = (await edge.boundingBox())!;
    await page.mouse.move(d.x + d.width / 2, d.y + 300);
    await page.mouse.down();
    await page.mouse.move(x, d.y + 300, { steps: 6 });
    await until("what will hide shows dimmed", () => page.evaluate((sel) => !!document.querySelector(sel), dim));
    if (esc) await page.keyboard.press("Escape");
    await page.mouse.up();
  };
  const sideEdge = page.getByRole("separator", { name: "Resize the sidebar" });
  const before = Math.round((await side.boundingBox())!.width);
  await drag(sideEdge, 60, ".app.folding", true);
  if (!(await side.isVisible())) throw new Error("Esc mid-fold hid the sidebar");
  if (await page.locator(".app.folding").count()) throw new Error("Esc left the sidebar dimmed");
  await drag(sideEdge, 60, ".app.folding");
  await side.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Show sidebar" }).click();
  await until("shown again, the sidebar has its old width", async () => Math.abs((await side.boundingBox())!.width - before) <= 2);
  // The side panel folds from its own edge, toward the right.
  await openSource(page, AGENTS);
  await page.getByRole("tab", { name: "Source note" }).click().catch(() => {});
  const panel = page.locator(".mynotes");
  await panel.waitFor();
  const wide = Math.round((await panel.boundingBox())!.width);
  const right = page.viewportSize()!.width;
  await drag(page.getByRole("separator", { name: "Resize the side panel" }), right - 100, ".mynotes.folding");
  await panel.waitFor({ state: "hidden" });
  await page.keyboard.press("n");
  await until("opened again, the panel has its old width", async () => (await panel.count()) > 0 && Math.abs((await panel.boundingBox())!.width - wide) <= 2);
});

// —— Codex sweep 6, round C: finding things (docs/reviews/2026-11-15-codex-sweep-6/organize-report.md) ——

journey("list search: every source in the tab and its filters that holds the words is found, however many others hold them too (F335)", async (page) => {
  const word = `zircon${Date.now()}`;
  // 36 sources and their highlights hold the word, 72 matches; the one under Habits holds it once, deep in a longer text, so it ranks last.
  const made: string[] = [];
  try {
    for (let i = 0; i < 36; i += 9) {
      const batch = await Promise.all(Array.from({ length: 9 }, (_, j) => ore("snippet", `--text=${word} note ${i + j} on durable practice.`, "--no-enrich") as Promise<{ id: string }>));
      made.push(...batch.map((b) => b.id));
    }
    const habit = (await ore("snippet", `--text=Habits form slowly when a cue predicts a reward, and the routine runs on its own long after. ${"A loop like this takes weeks to build. ".repeat(8)}Then ${word}.`, "--skill=habits", "--no-enrich")) as { id: string; title: string };
    made.push(habit.id);
    await page.reload();
    await page.getByRole("button", { name: /^All sources/ }).click();
    await page.getByRole("button", { name: "Filter by kind, skill or author" }).click();
    await page.getByRole("option", { name: "Skill" }).click();
    await page.locator(".filter-menu [cmdk-item]").filter({ hasText: "Habits" }).first().click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Skill: Habits" }).waitFor();
    await page.getByLabel("Search sources").fill(word);
    await until("the Habits source that holds the word is listed", async () => (await page.locator(".row.hit").count()) === 1, 8000);
    if (await page.locator(".empty-state").count()) throw new Error(`the list says ${await page.locator(".empty-state").innerText()}`);
  } finally {
    for (const id of made) await ore("archive", id).catch(() => {});
  }
});

// F344 (review of #440): only the library's best 60 matches got their line, so a row past
// them (here the oldest source, whose match ranks last) showed none.
journey("list search: every row found in its text shows its line, past the first 60 too, as it scrolls into view", async (page) => {
  const word = `quillwort${Date.now()}`;
  const made: string[] = [];
  try {
    const last = (await ore("snippet", `--text=Practice note zero on durable recall, kept for the list. ${"A loop like this takes weeks to build. ".repeat(8)}Then ${word}.`, "--no-enrich")) as { id: string; title: string };
    made.push(last.id);
    for (let i = 0; i < 66; i += 11) {
      const batch = await Promise.all(Array.from({ length: 11 }, (_, j) => ore("snippet", `--text=Practice note ${i + j + 1} on durable recall, kept for the list. Then ${word}.`, "--no-enrich") as Promise<{ id: string }>));
      made.push(...batch.map((b) => b.id));
    }
    await page.reload();
    await page.getByRole("button", { name: /^All sources/ }).click();
    await page.getByLabel("Search sources").fill(word);
    const rows = page.locator(".row").filter({ hasText: "Practice note" });
    await until("all 67 are listed by their text", async () => (await rows.count()) === 67, 8000);
    await until("the first screen's rows show their lines", async () => (await rows.evaluateAll((rs) => rs.slice(0, 8).every((r) => r.querySelector(".snip")))), 5000);
    const row = page.locator(`#row-${last.id}`);
    await row.scrollIntoViewIfNeeded();
    await until("the last row found in its text shows its line", async () => (await row.locator(".snip").count()) === 1 && (await row.locator(".snip").innerText()).includes(word), 5000);
  } finally {
    for (const id of made) await ore("archive", id).catch(() => {});
  }
});

journey("list search: a match in a highlight's note opens that highlight; ↵ on one in the source note opens the note on it, as ⌘K does (F336)", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  const search = page.getByLabel("Search sources");
  await search.fill("hold for kids");
  await page.locator(".row.hit").filter({ hasText: TESTING }).click();
  const note = page.getByRole("dialog", { name: "Highlight" }).getByLabel("Note");
  await until("the highlight's popup is open on its note", async () => (await note.isVisible()) && (await note.inputValue()) === "Does this hold for kids?");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /^All sources/ }).click();
  await search.fill("just a measurement");
  await page.locator(".row.hit").filter({ hasText: TESTING }).waitFor();
  await search.press("Enter");
  await foundOnScreen(page, "just a measurement", ".mynotes-text");
  await page.keyboard.press("Escape");
});

journey("list search: Back to the list brings its search and filters back (F338)", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.getByRole("button", { name: "Filter by kind, skill or author" }).click();
  await page.getByRole("option", { name: "Skill" }).click();
  await page.locator(".filter-menu [cmdk-item]").filter({ hasText: "AI" }).first().click();
  await page.keyboard.press("Escape");
  const search = page.getByRole("textbox", { name: "Search sources" });
  await search.fill("Effective Agents");
  await page.locator(".row").filter({ hasText: AGENTS }).first().click();
  await page.locator(".doc-head").filter({ hasText: AGENTS }).waitFor();
  await page.locator(".side-item").filter({ hasText: "Learning" }).first().click();
  await page.locator(".skill-page").waitFor();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.locator(".doc-head").filter({ hasText: AGENTS }).waitFor();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await until("the search is back", async () => (await search.count()) === 1 && (await search.inputValue()) === "Effective Agents");
  await page.getByRole("button", { name: "Skill: AI" }).waitFor();
  await page.getByRole("button", { name: "Forward", exact: true }).click();
  await page.locator(".doc-head").filter({ hasText: AGENTS }).waitFor();
  await page.getByRole("button", { name: "Forward", exact: true }).click();
  await page.locator(".skill-page").waitFor();
  const field = page.getByRole("textbox", { name: "Search sources" });
  await until("the skill page's search is its own, empty", async () => (await field.count()) === 0 || (await field.inputValue()) === "");
});

journey("All sources: the list is one Tab stop, and ⌃↵ opens the row's actions, Skills among them (F381)", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  const list = page.locator(".list");
  await list.locator(".row").first().waitFor();
  await list.focus();
  await page.keyboard.press("Tab");
  const inRow = await page.evaluate(() => document.activeElement?.closest(".list .row")?.textContent?.slice(0, 40) ?? null);
  if (inRow !== null) throw new Error(`Tab from the list stopped inside a row: ${inRow}`);
  await list.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Control+Enter");
  const menu = page.getByRole("menu");
  await menu.waitFor();
  await menu.getByRole("menuitem", { name: "Skills" }).waitFor();
  await page.keyboard.press("Escape");
  await menu.waitFor({ state: "detached" });
  await until("focus is back on the list, so the arrows go on", () => page.evaluate(() => document.activeElement?.classList.contains("list") ?? false));
});

journey("All sources: a source with no author and no skill has no empty line between its title and its kind (F384)", async (page) => {
  const made = (await ore("add", await textFile("bare-row.md", "# A bare row\n\nNo author, no skill."), "--no-enrich")) as { id: string };
  try {
    await page.reload();
    await page.getByRole("button", { name: /^All sources/ }).click();
    const row = page.locator(".list .row").filter({ hasText: "A bare row" }).first();
    await row.waitFor();
    const gap = await row.evaluate((r) => r.querySelector(".kind-line")!.getBoundingClientRect().top - r.querySelector(".title")!.getBoundingClientRect().bottom);
    if (gap > 8) throw new Error(`${Math.round(gap)}px of nothing between the title and the kind`);
    // The + that files it is still there on hover, now on the kind's line.
    await row.hover();
    await row.getByRole("button", { name: "Skills for A bare row" }).click();
    await page.getByRole("dialog", { name: "Skills" }).waitFor();
    await page.keyboard.press("Escape");
  } finally {
    await ore("archive", made.id).catch(() => {});
    await page.reload();
  }
});

journey("sidebar: a long skill name ends before the ⋯ that shows on its row, by pointer or keyboard (F438)", async (page) => {
  const row = page.locator(".sidebar .side-item", { hasText: "Distributed Systems and Consensus" });
  const gap = () => row.evaluate((e) => e.querySelector(".side-more")!.getBoundingClientRect().left - e.querySelector(".label")!.getBoundingClientRect().right);
  await row.locator(".side-main").hover();
  await until("the name ends before the ⋯ under the pointer", async () => (await gap()) >= 0);
  await page.mouse.move(700, 300);
  await row.locator(".side-main").focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowDown");
  await until("and with the keyboard on the row", async () => (await gap()) >= 0);
});

// CI (F457): a read of the skills that began before an Undo answered after it, and put the
// deleted collection's skills back out of it until the next read.
journey("sidebar: a collection brought back with ⌘Z stays back when an earlier read of the skills answers late (F457)", async (page) => {
  const slow = (ms: number | null) => page.evaluate((ms) => ((window as unknown as { __ORE_SLOW?: object }).__ORE_SLOW = ms ? { skills: ms } : undefined), ms);
  const craft = page.locator(".side-head").filter({ hasText: /^Craft$/i });
  await craft.waitFor();
  await settled(page);
  await slow(60_000);
  await craft.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete collection" }).click();
  try {
    // The delete's write answers; the read after it has the library without Craft, and is kept waiting.
    await until("the delete's write is out", () => isHeld(page, "skills"));
    await release(page, "skills");
    await until("the read after it is out", () => isHeld(page, "skills"));
    await slow(null);
    await page.keyboard.press("Meta+z");
    await craft.waitFor();
    await until("the Undo's write and its read have answered", () => page.evaluate(() => (window as unknown as { __ORE_INFLIGHT: string[] }).__ORE_INFLIGHT.filter((c) => c.startsWith("skills")).length === 1));
    await release(page, "skills");
    await settled(page);
    await Bun.sleep(200);
    if (!(await craft.count())) throw new Error("the late read took Craft away again");
  } finally {
    await slow(null);
    await release(page, "skills");
    await settled(page);
    if (!(await craft.count())) await page.reload();
  }
});
