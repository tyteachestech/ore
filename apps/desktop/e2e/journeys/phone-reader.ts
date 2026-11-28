import { dirname, join } from "node:path";
import { type Page } from "playwright";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { $ } from "bun";
import { AGENTS, doubleTap, askFieldIsPlain, fits44, itemFile, journey, keyboardUp, longPassages, macChanges, pasteInto, PHONE_LIB, phoneReaderReady, phoneSource, phoneWith, pointAt, press, slid, tap, TESTING, until } from "../harness";

// iPhone sizes, not the Mac's (Tyler 2026-11-13, option A): list titles 17 pt, every tap 44 pt, the bar's buttons round.
journey("phone: Finish comes straight after a source's text, with the room for the bars under it (F88)", async (page) => {
  // The text's bottom room (for the player and the bar) sat above Finish, so a short recording's Finish hung 200 pt
  // below its last line, down by the player.
  await phoneSource(page, "Lecture 4 the testing effect");
  await page.locator(".phone-source .player.audio").waitFor();
  const gap = await page.locator(".phone-source").evaluate((root) => {
    const ps = [...root.querySelectorAll<HTMLElement>(".doc p")];
    return root.querySelector(".phone-finish button")!.getBoundingClientRect().top - ps[ps.length - 1]!.getBoundingClientRect().bottom;
  });
  if (gap > 80) throw new Error(`Finish sits ${Math.round(gap)} px below the last line`);
  await page.locator(".phone-source .reader-scroll").evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await Bun.sleep(300);
  const fin = (await page.locator(".phone-finish button").boundingBox())!;
  const player = (await page.locator(".phone-source .player.audio").boundingBox())!;
  if (fin.y + fin.height > player.y) throw new Error(`scrolled to the end, Finish (foot ${Math.round(fin.y + fin.height)}) runs under the player (top ${Math.round(player.y)})`);
}, "phone");

journey("phone: every tap on a skill page is at least 44 pt (F89)", async (page) => {
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Learning" }));
  await page.locator(".phone-skill .head-tab-btn").first().waitFor();
  // What a finger hits: the control, grown by an unseen ::before or ::after laid over it (the question circles' way).
  const small = () => page.locator(".phone-skill").evaluate((root) => [...root.querySelectorAll<HTMLElement>("button, [role=button], [role=tab]")].flatMap((e) => {
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) return [];
    let [w, h] = [r.width, r.height];
    for (const at of ["::before", "::after"]) {
      const cs = getComputedStyle(e, at);
      if (cs.content === "none" || cs.position !== "absolute") continue;
      const out = (v: string) => Math.max(0, -parseFloat(v) || 0);
      w = Math.max(w, r.width + out(cs.left) + out(cs.right));
      h = Math.max(h, r.height + out(cs.top) + out(cs.bottom));
    }
    return w < 44 || h < 44 ? [`${e.getAttribute("aria-label") ?? e.textContent?.trim().slice(0, 20)} ${Math.round(w)}×${Math.round(h)}`] : [];
  }));
  const check = async (where: string) => { const s = await small(); if (s.length) throw new Error(`taps under 44 pt on ${where}: ${s.join(", ")}`); };
  await check("the skill page");
  // The Forge and a try's own page are skill pages too (D322).
  await tap(page, page.locator(".phone-skill .forge-door"));
  await check("the Forge");
  await tap(page, page.getByRole("button", { name: "Add something to try" }));
  await check("the Forge, adding");
  await page.getByLabel("I’ll…").fill("Recall before rereading");
  await page.keyboard.press("Enter");
  await page.locator(".phone-skill .forge-row").first().waitFor();
  await check("the Forge with a try");
  await tap(page, page.locator(".phone-skill .forge-open").first());
  await page.locator(".phone-skill .try-path").waitFor();
  await check("a try's page");
  await tap(page, page.locator(".phone-skill .crumbs button").first());
  await page.locator(".phone-skill .try-now").waitFor();
  await check("the skill page with a try");
}, "phone");

journey("phone: a long question on a skill page takes two lines before it cuts (F139)", async (page) => {
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer section button").filter({ hasText: "Learning" }));
  const note = page.locator(".phone-skill .question-quote .note").first();
  await note.waitFor();
  const lines = (text: string) => note.evaluate((el, text) => ((el.textContent = text), Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight))), text);
  const two = await lines("Is a nap enough, or does it have to be a full night before it sticks?");
  if (two !== 2) throw new Error(`a question a line and a half long shows on ${two} line(s)`);
  const most = await lines("Is a nap enough, or does it have to be a full night before it sticks? ".repeat(4));
  if (most !== 2) throw new Error(`a very long question shows on ${most} lines`);
}, "phone");

// The phone's ⋯ is a sheet, not a menu: it draws the same icons as the Mac's menus (Tyler 2026-11-13).
journey("phone: every row of a source's ⋯ sheet has its icon", async (page) => {
  await phoneSource(page, "The Story Spine");
  await tap(page, page.getByRole("button", { name: "Source actions" }));
  const rows = page.locator(".action-sheet .pick-row:not(.sheet-back)");
  await rows.first().waitFor();
  const n = await rows.count();
  const drawn = await page.locator(".action-sheet .pick-row:not(.sheet-back) > .menu-icon > svg").count();
  if (!n || drawn !== n) throw new Error(`the phone's ⋯ sheet: ${drawn} of ${n} rows have an icon`);
}, "phone");

journey("phone: Move to To read from a done source's ⋯ moves it, and it stays moved after a relaunch (F69)", async (page) => {
  // The reader showed it unfinished, but the phone's reader handed the move to a refresh that wrote nothing.
  await phoneSource(page, "The Story Spine");
  await tap(page, page.getByRole("button", { name: "Source actions" }));
  await tap(page, page.locator(".action-sheet button").filter({ hasText: "Move to To read" }));
  await tap(page, page.getByRole("button", { name: "Back" }));
  const toRead = page.locator(".phone-sources section").filter({ has: page.locator("h2", { hasText: "To read" }) });
  await toRead.getByText("The Story Spine").waitFor();
  await page.reload();
  await page.locator(".phone-app").waitFor();
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Sources" }));
  await toRead.getByText("The Story Spine").waitFor();
}, "phone");

journey("phone: a highlight's note being typed is still there after the app is quit with it open (F76)", async (page) => {
  // The note saved only when the popup closed: iOS quitting the app with it open lost what he typed.
  await phoneSource(page, TESTING);
  await tap(page, page.locator(".phone-tools > :first-child"));
  await tap(page, page.locator("aside.mynotes button").filter({ hasText: "after one week" }));
  const field = page.locator(".popup .field");
  await field.waitFor();
  await field.fill("A note typed on the bus, then the app was quit.");
  await page.reload();
  await phoneReaderReady(page);
  const kept = page.locator("aside.mynotes button").filter({ hasText: /A note typed on the bus|after one week/ });
  // The reader comes back where he was, its bars maybe hidden: back to the top brings them, then Collected.
  await Bun.sleep(500);
  if (!(await kept.first().isVisible())) {
    await page.evaluate(() => document.querySelector(".phone-reader .reader-scroll")?.scrollTo({ top: 0 }));
    await tap(page, page.locator(".phone-tools > :first-child"));
  }
  await tap(page, kept);
  if ((await field.inputValue()) !== "A note typed on the bus, then the app was quit.") throw new Error(`the note came back as “${await field.inputValue()}”`);
}, "phone");

journey("phone: Aa sets the text size, line spacing, margins, font and page, each at once and still there after a relaunch (D311)", async (page) => {
  // The phone had no way to change how a source reads; the five every good reader offers sit behind Aa (Books, Kindle, Readwise).
  await phoneSource(page, "The Story Spine");
  const looks = () => page.locator(".phone-reader .doc").first().evaluate((d) => {
    const s = getComputedStyle(d);
    return { size: parseFloat(s.fontSize), leading: parseFloat(s.lineHeight) / parseFloat(s.fontSize), gutter: parseFloat(getComputedStyle(d.closest(".page")!).paddingLeft), face: s.fontFamily, page: document.documentElement.dataset.page };
  });
  const was = await looks();
  if (was.size !== 20 || Math.abs(was.leading - 1.5) > 0.01 || was.gutter !== 24) throw new Error(`a source opened at ${JSON.stringify(was)}, not 20px on 1.5 with 24px margins`);
  await tap(page, page.getByRole("button", { name: "Text and page" }));
  const sheet = page.getByRole("dialog", { name: "Text and page" });
  // The page starts on Auto, the iPhone's own mode (dark here, where no iPhone says otherwise).
  if ((await sheet.getByRole("radio", { name: "Auto" }).getAttribute("aria-checked")) !== "true" || was.page !== "dark") throw new Error(`the page started at ${was.page}, not Auto`);
  await tap(page, sheet.getByRole("button", { name: "Larger text" }));
  await tap(page, sheet.getByRole("radio", { name: "Loose" }));
  await tap(page, sheet.getByRole("radio", { name: "Narrow margins" }));
  await tap(page, sheet.getByRole("radio", { name: "Geist" }));
  await tap(page, sheet.getByRole("radio", { name: "Light" }));
  const want = (l: Awaited<ReturnType<typeof looks>>) => l.size === 22 && Math.abs(l.leading - 1.7) < 0.01 && l.gutter === 16 && !/^Charter/.test(l.face) && l.page === "light";
  await until("each tap shows in the text at once", async () => want(await looks()));
  // The sheet turns light with the page, as Books' does, not a dark panel over a white page (F326).
  const light = (sel: string) => page.locator(sel).first().evaluate((e) => { const [r, g, b] = getComputedStyle(e).backgroundColor.match(/\d+/g)!.map(Number); return r! + g! + b! > 600; });
  await until("the sheet turns light with the page", () => light(".looks-sheet"));
  // Every tap a target of 44pt or more, and the sheet as wide as the screen.
  for (const b of await sheet.locator("button").all()) {
    const r = (await b.boundingBox())!;
    if (r.height < 44 || r.width < 44) throw new Error(`a control in Aa is ${r.width}×${r.height}`);
  }
  await page.reload();
  // The phone reopens on the source it was reading.
  await phoneReaderReady(page);
  const after = await looks();
  if (!want(after)) throw new Error(`after a relaunch the source read at ${JSON.stringify(after)}`);
}, "phone");

journey("phone: a long title on Today and in Sources shows on two lines, with the reading line on the picture's foot, at every text size (F87)", async (page) => {
  // The picture and the reading dots left a Continue reading title about 25 letters, and the lists cut theirs at one line.
  const check = async (where: string, rows: string, title: string) => {
    const bad = await page.locator(rows).evaluateAll((els, title) => els.flatMap((row) => {
      const t = row.querySelector<HTMLElement>(title);
      if (!t || !t.textContent?.trim()) return [];
      const lines = Math.round(t.getBoundingClientRect().height / parseFloat(getComputedStyle(t).lineHeight));
      const cut = t.scrollHeight > t.clientHeight + 1 || t.scrollWidth > t.clientWidth + 1;
      // Beside the picture, the title has the rest of the row: nothing else takes its width.
      // (A list row's skills stand at its right: the title runs up to them.)
      const skills = row.querySelector(".phone-row-skills")?.getBoundingClientRect();
      const room = (skills ? skills.left - 12 : row.getBoundingClientRect().right) - t.getBoundingClientRect().right;
      // And never more than two: WebKit drew a clamped <button> title whole, four lines and more (F99).
      return (cut && lines < 2) || lines > 2 || room > 4 ? [`"${t.textContent.slice(0, 40)}": ${lines} line(s), ${Math.round(room)}px left of the row's edge`] : [];
    }), title);
    if (bad.length) throw new Error(`${where}: a title is cut short: ${bad.join("; ")}`);
  };
  await page.locator(".home-read .title").first().waitFor();
  for (const t of [1, 28 / 17]) {
    await page.evaluate((t) => document.documentElement.style.setProperty("--type", String(t)), t);
    // The text itself: the cut is on the button's span, since WebKit draws a clamped <button> whole.
    await check(`Today at ${t.toFixed(2)}`, ".home-read", ".title > span");
  }
  const meter = await page.locator(".home-read").first().evaluate((row) => {
    const pic = row.querySelector(".thumb")!.getBoundingClientRect();
    const line = row.querySelector(".thumb-line, .home-new")!;
    const at = line.getBoundingClientRect();
    // On the picture, at its foot: the line takes no room of its own, and the picture is as big as the row.
    // The line is shown and the dots are not (D326).
    const shown = getComputedStyle(line).display !== "none" && !(row.querySelector(".dot-bar") && getComputedStyle(row.querySelector(".dot-bar")!).display !== "none");
    return shown && pic.width >= 112 && at.top >= pic.top && Math.abs(at.bottom - pic.bottom) <= 6 && at.left >= pic.left - 1 && at.right <= pic.right + 1;
  });
  if (!meter) throw new Error("Today: the reading line (or New) is not on the foot of a 112 pt picture");
  await page.evaluate(() => document.documentElement.style.setProperty("--type", "1"));
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Sources" }));
  await page.locator(".phone-sources li button").first().waitFor();
  await check("Sources", ".phone-sources li button", ".phone-lined > span");
}, "phone");

journey("phone: reopening on a source that left the library lands on Today, not an error with its id", async (page) => {
  // Found in the Simulator: a place saved before the source was deleted (on the Mac, or by a new build) showed
  // `no item matches "01M4…"` and a lowercase "back to sources" instead of the app.
  await page.evaluate(() => localStorage.setItem("ore-phone-place", JSON.stringify({ tab: "today", skill: null, openId: "01M4J53NB45RYFGW1DQNGWYGWD", review: null })));
  await page.reload();
  // Today stays under an open source, so Start review being there says nothing about what is over it: the
  // reader must never open on the missing source, or its error shows until the lists have loaded (F120).
  await page.locator(".phone-root").waitFor();
  if (await page.locator(".phone-reader").count()) throw new Error("the reader opened on a source the library hasn't confirmed yet");
  await page.getByRole("button", { name: "Start review" }).waitFor();
  await Bun.sleep(300);
  if (await page.locator(".phone-reader").count() || await page.getByText(/no item matches/).count()) throw new Error("the missing source's error is on screen");
}, "phone");

journey("phone: reopening on a source while the library can't be listed still opens it", async (page) => {
  // Code review of #395 (F128): the saved source's reader waited for the first list, so a list that
  // failed left it shut for good, and a tap on that source did nothing.
  await phoneSource(page, TESTING);
  await page.addInitScript("if (sessionStorage.getItem('ore-e2e-fail-ls')) window.__ORE_FAIL = { ls: 'The library is offline.' }");
  await page.evaluate(() => sessionStorage.setItem("ore-e2e-fail-ls", "1"));
  try {
    await page.reload();
    await page.locator(".phone-reader").waitFor();
  } finally {
    await page.evaluate(() => (sessionStorage.removeItem("ore-e2e-fail-ls"), ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {})));
  }
}, "phone");

journey("phone: words pasted into Add are a text source at once, which opens, as in the Mac's Add box", async (page) => {
  // Impeccable eval round 10: the iPhone's Add took only links, so pasted notes went nowhere.
  const words = "Spacing beats cramming\n\nReviews spread over days keep what one long sitting loses within a week.";
  await tap(page, page.getByRole("button", { name: "Add a source", exact: true }));
  const field = page.locator(".add-link .field");
  await field.fill(words);
  // The keyboard's Go adds it, though the field takes lines now.
  await field.press("Enter");
  await page.locator(".add-link").waitFor({ state: "detached" });
  await page.getByText("Added “Spacing beats cramming”").waitFor();
  await page.locator(".phone-reader .doc").filter({ hasText: "keep what one long sitting loses" }).first().waitFor();
  if (await page.locator(".phone-waiting").count()) throw new Error("the text is listed as coming in, as a link would be");
}, "phone");

journey("phone: a text add finishing after its sheet was closed leaves the next sheet and its words alone, and says Adding… while it works (F551, F552)", async (page) => {
  // Codex test of #519 (UX-1, UX-4, E4): the first add's end closed the new sheet and emptied its draft; the wait showed no sign.
  let release = () => {};
  const held = new Promise<void>((r) => (release = r));
  await page.route("https://example.com/held.png", async (r) => (await held, r.fulfill({ status: 200, contentType: "image/png", headers: { "access-control-allow-origin": "*" }, body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64") })));
  await tap(page, page.getByRole("button", { name: "Add a source", exact: true }));
  const field = page.locator(".add-link .field");
  await pasteInto(field, "A held picture\nWords under it.", '<h2>A held picture</h2><img src="https://example.com/held.png"><p>Words under it.</p>');
  await field.press("Enter");
  await page.locator(".add-link [role=status]").filter({ hasText: "Adding" }).waitFor();
  await page.keyboard.press("Escape");
  await page.locator(".add-link").waitFor({ state: "detached" });
  await tap(page, page.getByRole("button", { name: "Add a source", exact: true }));
  await page.locator(".add-link .field").fill("My next note, half written");
  release();
  await page.getByText("Added “A held picture”").waitFor();
  await Bun.sleep(300);
  if (!(await page.locator(".add-link").count())) throw new Error("the first add's end closed the sheet he was writing in");
  const v = await page.locator(".add-link .field").inputValue();
  if (v !== "My next note, half written") throw new Error(`the next note's words are gone: "${v}"`);
}, "phone");

journey("phone: text added, undone and added again says it is back from Archived, with Undo, as on the Mac (F555)", async (page) => {
  // Codex test of #519 (E3): the phone said only "Already here", with no Undo for bringing it back.
  const add = async () => {
    await tap(page, page.getByRole("button", { name: "Add a source", exact: true }));
    await page.locator(".add-link .field").fill("Interleaving notes\n\nMix problem kinds in one sitting.");
    await page.locator(".add-link .field").press("Enter");
    await page.locator(".add-link").waitFor({ state: "detached" });
  };
  await add();
  await tap(page, page.locator(".toast button").filter({ hasText: "Undo" }));
  // Undo takes back the add, and the page it opened, as on the Mac.
  await page.locator(".phone-reader").waitFor({ state: "detached" });
  await add();
  const back = page.locator(".toast").filter({ hasText: "“Interleaving notes” is back from Archived" });
  await back.waitFor();
  await back.locator("button").filter({ hasText: "Undo" }).waitFor();
}, "phone");

journey("phone: a file picked with + is read on the phone; a picture waits for the Mac's text recognition", async (page) => {
  // D235: the file is saved to the inbox beside its item, then imported here like a link.
  const files = join(import.meta.dir, "../../../../packages/core/test/fixtures/intake/files");
  const pick = async (name: string) => {
    await tap(page, page.getByRole("button", { name: "Add a source", exact: true }));
    const chooser = page.waitForEvent("filechooser");
    await tap(page, page.getByRole("button", { name: "Choose a file or photo" }));
    await (await chooser).setFiles(join(files, name));
  };
  await pick("notes.docx");
  await page.locator(".add-link").waitFor({ state: "detached" });
  await page.getByText(/^Added “/).waitFor();
  await pick("screenshot.png");
  await page.locator(".add-link").waitFor({ state: "detached" });
  // F80: a PDF added here drew no first page (only the Mac's Quick Look did), so its row had a bare icon.
  await pick("outline.pdf");
  await page.locator(".add-link").waitFor({ state: "detached" });
  await page.getByText("Added “Remembering on purpose”").waitFor();
  // Codex sweep 4: a Korean PDF whose font names its encoding read as only its punctuation without the CMaps.
  await pick("korean.pdf");
  await page.locator(".add-link").waitFor({ state: "detached" });
  await page.getByText("Added “기억을 오래 남기는 방법”").waitFor();
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Sources" }));
  const drawn = page.locator("li", { hasText: "Remembering on purpose" }).locator("img.thumb");
  await drawn.waitFor();
  await until("the PDF's first page is its row's picture", () => drawn.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 100 && i.naturalHeight > i.naturalWidth));
  const row = page.locator(".phone-waiting").filter({ hasText: "screenshot.png" });
  await row.getByText("Your Mac reads the text in a picture or a scan.").waitFor();
  if (await page.locator(".phone-waiting").count() !== 1) throw new Error("the Word file it read is still listed as coming in");
  await tap(page, row.getByRole("button", { name: "Remove" }));
  await row.waitFor({ state: "detached" });
}, "phone");

journey("phone: a skill's page is the Mac's in one column, and a course is one row that opens its lessons (D228)", async (page) => {
  // Tyler 2026-11-12, iPhone parity phase 4: the phone's skill page listed only sources and a note row.
  const lesson = (part: number) => `topics: []\ncourse:\n  id: memory-101\n  title: Memory 101\n  part: ${part}\n`;
  await macChanges((lib) => itemFile(lib, "lecture-4-the-testing-effect", "doc.md"), "topics: []\n", lesson(1), () =>
    macChanges((lib) => itemFile(lib, "the-testing-effect", "doc.md"), "topics: []\n", lesson(2), async () => {
      await page.reload();
      await tap(page, page.getByRole("button", { name: "Open menu" }));
      await tap(page, page.locator(".phone-drawer section button").filter({ hasText: "Learning" }));
      const sk = page.locator(".phone-skill");
      await sk.locator(".skill-goal").waitFor();
      await sk.locator(".hero-strength").waitFor();
      await sk.getByText("Does this hold for kids?").waitFor();
      await slid(page);
      const wide = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".phone-skill *")].filter((e) => e.getBoundingClientRect().right > innerWidth + 1).map((e) => e.className).slice(0, 3));
      if (wide.length) throw new Error(`wider than the screen: ${wide.join(", ")}`);
      // A question's actions are its long press, as a row's are (its hover buttons never show on a phone).
      await press(page, sk.locator(".question").first());
      await page.getByRole("menuitem", { name: "Answer…" }).waitFor();
      await page.keyboard.press("Escape");
      const course = sk.locator(".phone-course").filter({ hasText: "Memory 101" });
      await course.waitFor();
      await press(page, course);
      await page.getByRole("menuitem", { name: "Archive course" }).waitFor();
      await page.keyboard.press("Escape");
      if (await sk.locator("li button:not(.phone-course)").filter({ hasText: "Lecture 4 the testing effect" }).count()) throw new Error("a lesson is listed on its own beside its course");
      await tap(page, course);
      const lessons = page.locator(".phone-sources").filter({ has: page.locator("h1", { hasText: "Memory 101" }) });
      await lessons.waitFor();
      const titles = await lessons.locator("li .phone-lined > span").allInnerTexts();
      if (!titles[0]?.startsWith("Lecture 4") || !titles[1]?.startsWith("The Testing Effect")) throw new Error(`the lessons aren't in course order: ${titles.join(" | ")}`);
      // A relaunch comes back to the course's lessons, as to any screen he was on.
      await page.reload();
      await lessons.waitFor();
      await tap(page, lessons.locator("li button").first());
      await phoneReaderReady(page);
    }),
  );
}, "phone");

journey("phone: New skill in the drawer names one in place and opens its page; a name he has is refused there", async (page) => {
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "New skill" }));
  const field = page.getByRole("textbox", { name: "New skill name" });
  await field.fill("learning");
  await field.press("Enter");
  await page.locator(".phone-new-error").filter({ hasText: "is taken" }).waitFor();
  await field.fill("Juggling");
  await field.press("Enter");
  await page.locator(".phone-skill h1").filter({ hasText: "Juggling" }).waitFor();
  await tap(page, page.locator(".phone-back").filter({ hasText: "Today" }));
  await page.locator(".phone-skill").waitFor({ state: "detached" });
  // Its Back held focus; closed, focus is on the menu button, not <body>. Checked here, not left to the focus watch,
  // which let it by whenever the next tap came within a quarter second (F399).
  await until("focus is on the menu button once the new skill's page closes", () => page.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Open menu"));
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await page.locator(".phone-drawer section button").filter({ hasText: "Juggling" }).waitFor();
}, "phone");

journey("phone: a double tap highlights the paragraph and opens it, a heading and a highlight keep their taps (D224)", async (page) => {
  await phoneSource(page, TESTING);
  await page.waitForTimeout(400);
  const kept = () => page.evaluate(() => ["hl-keep", "hl-active"].flatMap((k) => [...(CSS.highlights.get(k) ?? [])].map((r) => r.toString())));
  const at = (phrase: string) => pointAt(page, phrase, ".phone-reader .doc");
  const twice = (p: { x: number; y: number }) => doubleTap(page, p.x, p.y);
  const before = (await kept()).length;
  const heading = await at("Why it works");
  await page.waitForTimeout(300); // the scroll settles: a tap that stops one is no tap
  await twice(heading);
  await page.waitForTimeout(600);
  if ((await kept()).length !== before) throw new Error(`a double tap on a heading highlighted ${JSON.stringify(await kept())}`);
  const p = await at("familiarity is easily");
  await page.waitForTimeout(300);
  await twice(p);
  await page.getByRole("dialog", { name: "Highlight" }).waitFor();
  await until("the paragraph is highlighted", async () => (await kept()).some((t) => t.startsWith("Rereading, by contrast") && t.endsWith("weaker results.")));
  const count = (await kept()).length;
  await page.waitForTimeout(400);
  await twice(p);
  await page.waitForTimeout(600);
  if ((await kept()).length !== count) throw new Error("a double tap on a highlight stacked a second one");
}, "phone");

journey("phone: a tap on a source's cut-off title shows all of it", async (page) => {
  // Found in the Simulator: the title stopped at four lines and nothing showed the rest (the Sources row cuts it too).
  await phoneSource(page, "A very long title about the neuroscience");
  const h1 = page.locator(".phone-reader .doc-head h1");
  const cut = () => h1.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
  if (!(await cut())) throw new Error("the long title isn't cut at first: the journey checks nothing");
  await tap(page, h1);
  await until("the whole title shows", async () => !(await cut()));
}, "phone");

journey("phone: typing a long note keeps the line being typed above the keyboard bar", async (page) => {
  // Found in the Simulator: iOS reveals the caret just above its own keyboard, under the note's bar, so as a
  // note grew its last line and the caret went under the bar and he typed blind.
  await phoneSource(page, TESTING);
  await tap(page, page.locator(".phone-tools button").filter({ hasText: "Note" }));
  const note = page.locator(".phone-reader [contenteditable=true]").first();
  await tap(page, note);
  // A browser has no on-screen keyboard: stand one in, as the app's own measure of it sets.
  await page.evaluate(() => document.documentElement.style.setProperty("--keyboard", "300px"));
  await page.keyboard.press("Meta+ArrowDown");
  for (let i = 0; i < 14; i++) await page.keyboard.type(` line ${i} of a note that keeps growing past the bottom of the screen while he types it.`);
  // Where the caret is: its own box, or on a new empty line (which gives none) its line's.
  const CARET = `(() => { const sel = getSelection(); const r = sel.getRangeAt(0).getBoundingClientRect(); if (r.height) return r; const n = sel.focusNode; return (n instanceof Element ? n : n.parentElement).getBoundingClientRect(); })()`;
  // Leave the caret where iOS does, under the bar, and tell the page it moved, as a keystroke does (a
  // browser's own reveal would lift it: iOS's doesn't know the bar).
  const underBar = () =>
    page.evaluate((CARET) => {
      const caret = eval(CARET) as DOMRect;
      const bar = document.querySelector(".kb-bar")!.getBoundingClientRect();
      let box = document.activeElement as HTMLElement | null;
      while (box && !(box.scrollHeight > box.clientHeight && getComputedStyle(box).overflowY !== "visible")) box = box.parentElement;
      box!.scrollTop -= bar.bottom - 4 - caret.bottom;
      // The caret moving on, as each keystroke moves it on iOS (a collapse to where it already is fires nothing).
      document.dispatchEvent(new Event("selectionchange"));
    }, CARET);
  const above = () =>
    page.evaluate((CARET) => {
      const caret = eval(CARET) as DOMRect;
      const bar = document.querySelector(".kb-bar")!.getBoundingClientRect();
      return caret.bottom > 0 && caret.bottom <= bar.top;
    }, CARET);
  await underBar();
  await until("the caret sits above the keyboard bar", above);
  // Return at the end starts an empty line, whose caret has no box of its own.
  await page.keyboard.press("Enter");
  await underBar();
  await until("a new empty line sits above the keyboard bar", above);
}, "phone");

journey("phone: a tap opens Source actions and works the note's keyboard bar", async (page) => {
  // WebKit sends no click after a touch whose pointer-down was prevented: the ⋯ and the bar's buttons did nothing.
  await phoneSource(page, TESTING);
  const more = page.getByRole("button", { name: "Source actions" });
  await tap(page, more);
  await until("a tap on ⋯ opens Source actions", async () => (await more.getAttribute("aria-expanded")) === "true");
  await page.locator(".action-sheet").waitFor();
  await page.touchscreen.tap(195, 40); // outside the sheet, which closes it
  await page.locator(".action-sheet").waitFor({ state: "detached" });
  await tap(page, page.locator(".phone-tools button").filter({ hasText: "Note" }));
  const note = page.locator(".phone-reader [contenteditable=true]").first();
  await tap(page, note);
  await page.keyboard.type("a tapped line");
  const todo = page.locator(".kb-bar").getByRole("button", { name: "To-do" });
  await tap(page, todo);
  await until("a tap on the keyboard bar's To-do makes the line a to-do", async () => (await note.locator('li[data-item-type="task"]').filter({ hasText: "a tapped line" }).count()) === 1);
  const block = page.locator(".kb-bar").getByRole("button", { name: "Block actions" });
  await tap(page, block);
  await until("a tap on the bar's ⋯ opens Block actions", async () => (await block.getAttribute("aria-expanded")) === "true");
}, "phone");

journey("phone: a note's [[ link finds the library's sources", async (page) => {
  // The phone gave its notes no link targets: [[ and the keyboard bar's link button always said "No source or skill by that name".
  await phoneSource(page, TESTING);
  await tap(page, page.locator(".phone-tools button").filter({ hasText: "Note" }));
  const note = page.locator(".phone-reader [contenteditable=true]").first();
  await tap(page, note);
  await page.keyboard.type("[[Testing Eff");
  await page.locator(".note-menu-row").filter({ hasText: TESTING }).first().waitFor();
}, "phone");

journey("phone: a skill note's link results stay above the keyboard bar and insert on tap (F-new-phone-note-link-bar)", async (page) => {
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Learning" }));
  await tap(page, page.getByRole("button", { name: "Your note" }));
  const note = page.locator(".phone-note [contenteditable=true]");
  await tap(page, note);
  await page.keyboard.type("Sources for this skill");
  await page.keyboard.press("Enter");
  const bar = page.locator(".kb-bar");
  await tap(page, bar.getByRole("button", { name: "Link to a source or skill" }));

  const pick = async (query: string, title: string) => {
    await page.keyboard.type(query);
    const result = page.getByRole("option").filter({ hasText: title });
    await result.waitFor();
    const row = (await result.boundingBox())!;
    const toolbar = (await bar.boundingBox())!;
    if (row.width < 44 || row.height < 44 || row.y + row.height > toolbar.y) {
      throw new Error(`link target is ${row.width}×${row.height} pt, y ${row.y}–${row.y + row.height}, with the bar at y ${toolbar.y}`);
    }
    await page.touchscreen.tap(row.x + row.width / 2, row.y + row.height / 2);
    await note.getByRole("link", { name: title, exact: true }).waitFor();
  };
  await pick("Testing Eff", TESTING);
  await keyboardUp(page, 300);
  await page.keyboard.press("Enter");
  await page.keyboard.type("[[");
  await pick("Building Effective Agents", "Building Effective Agents");
}, "phone");

journey("phone: a source added on the phone and a new skill each take ⌘Z (F160)", async (page) => {
  const words = "Spacing out practice sessions makes what is learned last longer than cramming it into one sitting. ".repeat(12);
  const article = `<html><head><title>Spacing on the phone</title></head><body><article><h1>Spacing on the phone</h1>${`<p>${words}</p>`.repeat(3)}</article></body></html>`;
  await page.route("https://example.com/articles/spacing-phone", (r) => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", headers: { "access-control-allow-origin": "*" }, body: article }));
  await tap(page, page.getByRole("button", { name: "Add a source", exact: true }));
  await page.locator(".add-link .field").fill("https://example.com/articles/spacing-phone");
  await tap(page, page.locator(".add-link button"));
  const added = page.locator(".toast").filter({ hasText: "Added “Spacing on the phone”" });
  await added.waitFor();
  if (!(await added.locator(".toast-undo").count())) throw new Error("the Added toast has no Undo");
  await page.keyboard.press("Meta+z");
  await page.locator(".toast").filter({ hasText: "Undone: Added “Spacing on the phone”" }).waitFor();
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Sources" }));
  await page.locator(".phone-sources").waitFor();
  await until("Undo takes the source out of Sources", async () => !(await page.locator(".phone-sources").getByText("Spacing on the phone").count()));
  const name = `Phone skill ${Date.now()}`;
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "New skill" }));
  await page.getByRole("textbox", { name: "New skill name" }).fill(name);
  await page.keyboard.press("Enter");
  await page.locator(".phone-skill").getByText(name).first().waitFor();
  await page.keyboard.press("Meta+z");
  await page.locator(".toast").filter({ hasText: `Undone: Created skill ${name}` }).waitFor();
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await until("Undo takes the skill out of the drawer", async () => !(await page.locator(".phone-drawer").getByText(name).count()));
}, "phone");

/** What a tap at the middle of the element would land on, as its nearest button's accessible name. */
const tappedAt = (page: Page, sel: string) =>
  page.evaluate((sel) => {
    const r = document.querySelector(sel)!.getBoundingClientRect();
    const b = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest("button");
    return b?.getAttribute("aria-label") ?? b?.textContent?.trim() ?? "";
  }, sel);

journey("phone: the reading pill and the reader's bottom bar each keep their own taps", async (page) => {
  // Both sat at the bottom centre: the bar covered the pill, and a tap on it opened the note.
  await phoneSource(page, TESTING);
  const pill = page.locator(".read-pill");
  await page.locator(".phone-tools").waitFor();
  await until("the pill's middle is the pill, not the bar", async () => /Sections$/.test(await tappedAt(page, ".read-pill")));
  await tap(page, pill);
  await until("a tap on the pill opens the sections", async () => (await pill.getAttribute("aria-expanded")) === "true");
}, "phone");

journey("phone: a source he has started keeps its prequestions a tap away in the bottom bar, and a question goes back to the block (D179)", async (page) => {
  // The Mac's Reading for chip is a hover card in the toolbar; the phone had no way to them once a screen down.
  const q = "What makes a retrieval attempt more useful?";
  await phoneSource(page, TESTING);
  const chip = page.locator(".phone-tools").getByRole("button", { name: /^Reading for 3 questions$/ });
  await chip.waitFor();
  if ((await page.locator(".preq-head").getAttribute("aria-expanded")) === "true") await tap(page, page.locator(".preq-head"));
  await page.locator(".reader-scroll").first().evaluate((el) => el.scrollTo(0, el.scrollHeight / 2));
  await tap(page, chip);
  const sheet = page.getByRole("dialog", { name: "What you’re reading for" });
  await tap(page, sheet.getByRole("button").filter({ hasText: q }));
  await sheet.waitFor({ state: "detached" });
  await until("the block is open and the question in view", async () =>
    (await page.locator(".preq-head").getAttribute("aria-expanded")) === "true" &&
    (await page.locator(".preq-q").filter({ hasText: q }).evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })));
}, "phone");

journey("phone: an Undo toast in a source leaves the bottom bar and the pill their taps", async (page) => {
  // The toast sat on the bar for its six seconds: a tap on Collected, Note or Find hit the toast.
  await phoneSource(page, TESTING);
  await tap(page, page.getByRole("button", { name: "Source actions" }));
  await tap(page, page.locator(".action-sheet button").filter({ hasText: "Skills" }));
  await tap(page, page.locator('.action-sheet button[aria-checked="false"]'));
  await page.locator(".toasts").filter({ hasText: "Undo" }).waitFor();
  if (await page.locator(".action-sheet").count()) await page.touchscreen.tap(195, 40);
  await page.locator(".action-sheet").waitFor({ state: "detached" });
  for (const [sel, want] of [[".phone-tools > :first-child", /collected/i], [".phone-tools > :nth-child(2)", /Note/], [".phone-tools > :last-child", /^Find in source$/], [".read-pill", /Sections$/]] as const) {
    const got = await tappedAt(page, sel);
    if (!want.test(got)) throw new Error(`a tap on ${sel} lands on “${got}” while the toast shows`);
  }
  // On the note page the bar and the pill are gone: the toast comes back down instead of floating over the note.
  await tap(page, page.locator(".phone-tools > :nth-child(2)"));
  await page.locator(".reader.noting").waitFor();
  await until("the toast sits at the foot over the note page", async () => {
    const r = await page.locator(".toasts").boundingBox();
    return !!r && 844 - (r.y + r.height) <= 24;
  });
}, "phone");

journey("phone: a refused link is read out and focus stays on the field; + Note puts focus on the note, with the source page out of reach (Codex sweep 3, a11y)", async (page) => {
  await tap(page, page.getByRole("button", { name: "Add a source", exact: true }));
  const field = page.locator(".add-link .field");
  await field.fill("https://notalink");
  await tap(page, page.getByRole("button", { name: "Add", exact: true }));
  const error = page.locator(".add-link [role=alert]");
  await error.waitFor();
  const id = await error.getAttribute("id");
  if ((await field.getAttribute("aria-describedby")) !== id || (await field.getAttribute("aria-invalid")) !== "true") throw new Error("the field isn't tied to its error");
  if (!(await field.evaluate((e) => e === document.activeElement))) throw new Error("focus left the field he has to fix");
  await page.keyboard.press("Escape");
  await phoneSource(page, TESTING);
  await tap(page, page.locator(".phone-tools > :nth-child(2)"));
  await page.locator(".reader.noting").waitFor();
  await until("focus is on the note's page, on screen", async () => page.evaluate(() => {
    const a = document.activeElement;
    const r = a?.getBoundingClientRect();
    return !!a && !!a.closest(".mynotes") && !!r && r.right > 0 && r.left < innerWidth;
  }));
  if (!(await page.locator(".reader-pane").evaluate((e) => (e as HTMLElement).inert))) throw new Error("the source page slid away is still in reach");
}, "phone");

journey("phone: a relaunch with a source's Collected page open comes back to it", async (page) => {
  // The page beside the source wasn't kept: a relaunch showed the note page in its place.
  await phoneSource(page, TESTING);
  await tap(page, page.locator(".phone-tools > :first-child"));
  const collected = page.locator('aside.mynotes[aria-label="Collected"]');
  await collected.waitFor();
  await page.reload();
  await phoneReaderReady(page);
  await until("Collected is the page beside the source again", async () => (await collected.count()) === 1 && (await page.locator(".reader.noting").count()) === 1);
}, "phone");

journey("phone: the small controls of a source answer a 44pt touch", async (page) => {
  // Apple's minimum: a link under a question, the original-site link, the pill without a section, a highlight's
  // note field and the closing card's buttons were 17 to 42pt.
  const fits = (sel: string, what: string) => fits44(page, sel, what);
  await phoneSource(page, AGENTS);
  await fits(".doc-head .source", "the original-site link");
  // Its 44pt reach takes no room: the link sits on the byline's line beside the date (it sat 4pt low), or, when the
  // byline fills the line, starts the next one flush with it (it was indented 14pt).
  const byline = async (width: number) => {
    await page.locator(".doc-head .chips").evaluate((el, w) => ((el as HTMLElement).style.width = w), width ? `${width}px` : "");
    return page.evaluate(() => {
      const box = (sel: string) => document.querySelector(`.doc-head ${sel}`)!.getBoundingClientRect();
      const [when, source, name] = [box(".when"), box(".source"), box(".by")];
      return { off: source.y + source.height / 2 - (when.y + when.height / 2), indent: source.x + 4 - name.x };
    });
  };
  const wide = await byline(1000);
  if (Math.abs(wide.off) > 1) throw new Error(`the original-site link sits ${wide.off.toFixed(1)}pt off the byline's line`);
  const narrow = await byline(0);
  if (narrow.off < 10 || Math.abs(narrow.indent) > 1) throw new Error(`the wrapped original-site link sits ${narrow.indent.toFixed(1)}pt from the byline's start`);
  await fits(".read-pill", "the reading pill");
  await tap(page, page.getByRole("button", { name: "Back" }));
  await phoneSource(page, TESTING);
  await tap(page, page.locator(".phone-tools > :first-child"));
  await fits(".qp-sub .qp-link", "Asked here");
  await tap(page, page.locator("aside.mynotes button").filter({ hasText: "after one week" }));
  await page.locator(".popup .field").waitFor();
  await fits(".popup .field", "the highlight's note field");
  await page.touchscreen.tap(195, 120);
  await page.locator(".popup").waitFor({ state: "detached" });
  await tap(page, page.getByRole("button", { name: "Source actions" }));
  await tap(page, page.locator(".action-sheet button").filter({ hasText: "Finish" }));
  await tap(page, page.getByRole("button", { name: "Just mark done" }));
  // The closing card's foot, not the first step's (its "Just mark done" is a .quiz-foot button too, gone a moment later).
  await page.locator(".quiz-done").waitFor();
  await fits(".quiz-foot button", "the closing card's Done");
}, "phone");

/** Every row of the open bottom sheet that something else covers somewhere across its width (the reader's bar or
 *  pill, a toast): a touch there would not reach the row. */
const coveredRows = (page: Page) =>
  page.evaluate(() => {
    const sheet = document.querySelector('[role="dialog"].sheet, [role="dialog"].review-pick');
    if (!sheet) return ["no sheet is open"];
    return [...sheet.querySelectorAll<HTMLElement>(".pick-row")].flatMap((row) => {
      const r = row.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= innerHeight) return [];
      const y = r.top + r.height / 2;
      const off = [0.1, 0.3, 0.5, 0.7, 0.9].map((f) => r.left + r.width * f).filter((x) => !row.contains(document.elementFromPoint(x, y)));
      return off.length ? [`${row.textContent?.trim()} (at x ${off.map(Math.round).join(", ")}: ${document.elementFromPoint(off[0]!, y)?.className})`] : [];
    });
  });

journey("phone: a bottom sheet covers the reader's bar, the pill and a toast", async (page) => {
  // Source actions opened under the reader's floating bar, which hid part of its last rows (Archive).
  await phoneSource(page, TESTING);
  const check = async (what: string) => {
    // The sheet rises for 300ms (D331): a fixed wait of the same length can sample it still moving under load (it did on #475).
    await until("the sheet has risen", () => page.evaluate(() => ![...document.querySelectorAll('[role="dialog"].sheet, [role="dialog"].review-pick, .overlay')].some((el) => el.getAnimations().some((x) => x.playState === "running"))));
    const covered = await coveredRows(page);
    if (covered.length) throw new Error(`${what}: rows under something else: ${covered.join("; ")}`);
  };
  await tap(page, page.getByRole("button", { name: "Source actions" }));
  await page.locator(".action-sheet").waitFor();
  await Bun.sleep(300);
  await check("Source actions");
  await tap(page, page.locator(".action-sheet button").filter({ hasText: "Skills" }));
  await tap(page, page.locator('.action-sheet button[aria-checked="false"]'));
  await page.locator(".toasts").filter({ hasText: "Undo" }).waitFor();
  if (await page.locator(".action-sheet").count()) await page.touchscreen.tap(195, 40);
  await page.locator(".action-sheet").waitFor({ state: "detached" });
  // Again while that toast still shows (six seconds): the sheet is over it.
  await tap(page, page.getByRole("button", { name: "Source actions" }));
  await page.locator(".action-sheet").waitFor();
  await Bun.sleep(300);
  if (!(await page.locator(".toasts").filter({ hasText: "Undo" }).count())) throw new Error("the toast went before the sheet opened");
  await check("Source actions, with a toast showing");
  await page.touchscreen.tap(195, 40);
  await page.locator(".action-sheet").waitFor({ state: "detached" });
  await tap(page, page.locator(".read-pill"));
  await page.locator(".sections-sheet").waitFor();
  await Bun.sleep(300);
  await check("Sections");
  await page.touchscreen.tap(195, 40);
  await page.locator(".sections-sheet").waitFor({ state: "detached" });
  await tap(page, page.getByRole("button", { name: "Back" }));
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Today" }));
  await tap(page, page.getByRole("button", { name: "Start review" }).first());
  await page.locator(".review-pick").waitFor();
  await Bun.sleep(300);
  await check("What to review");
}, "phone");

journey("phone: the note's keyboard bar moves a block, edits a table and adds a picture; a diagram opens to view (D235)", async (page) => {
  const notes = (lib: string) => itemFile(lib, "the-testing-effect", "notes.md");
  const diagram = join(dirname(itemFile(PHONE_LIB, "the-testing-effect", "notes.md")), "diagrams", "loop.excalidraw");
  mkdirSync(dirname(diagram), { recursive: true });
  writeFileSync(diagram, JSON.stringify({ type: "excalidraw", version: 2, elements: [{ id: "a", type: "rectangle", x: 0, y: 0, width: 160, height: 70, angle: 0, strokeColor: "#1e1e1e", backgroundColor: "transparent", fillStyle: "solid", strokeWidth: 2, roughness: 0, opacity: 100, seed: 1, version: 1, isDeleted: false, boundElements: [], groupIds: [], roundness: null }], appState: {}, files: {} }));
  const extra = "\n\n![Diagram](diagrams/loop.excalidraw)\n\n| Term | Meaning |\n| --- | --- |\n| Spacing | Gaps between reviews |\n\nfirst line\n\nsecond line\n\nthird line";
  try {
    await macChanges(notes, "= hypercorrection", `= hypercorrection${extra}`, async () => {
      await page.reload();
      await page.locator(".phone-app").waitFor();
      await phoneSource(page, TESTING);
      await tap(page, page.locator(".phone-tools button").filter({ hasText: "Note" }));
      const note = page.locator(".phone-reader [contenteditable=true]").first();
      const bar = page.locator(".kb-bar");
      // Move: ⋮⋮ ▸ Move picks the block up, ↑ carries it, Done puts the caret back in it.
      await tap(page, note.locator("p").filter({ hasText: "third line" }));
      await tap(page, bar.getByRole("button", { name: "Block actions" }));
      await tap(page, page.locator(".action-sheet").getByRole("button", { name: "Move", exact: true }));
      await tap(page, bar.getByRole("button", { name: "Move up" }));
      await tap(page, bar.getByRole("button", { name: "Move up" }));
      await tap(page, bar.getByRole("button", { name: "Done moving" }));
      await until("third line moved above first line", async () => {
        const t = await note.innerText();
        return t.indexOf("third line") < t.indexOf("first line");
      });
      // A table cell swaps the block kinds for the table's edits.
      await tap(page, note.locator("td").filter({ hasText: "Gaps" }));
      await until("F52: the one table-cell tap places the native caret in that cell", () => page.evaluate(() => {
        const selection = getSelection(), node = selection?.anchorNode;
        const cell = (node?.nodeType === Node.ELEMENT_NODE ? node as Element : node?.parentElement)?.closest("td");
        return !!cell?.textContent?.includes("Gaps") && !!document.activeElement?.closest("[contenteditable=true]");
      }));
      await bar.getByRole("button", { name: "Table actions" }).waitFor();
      if (await bar.getByRole("button", { name: "To-do" }).count()) throw new Error("the bar offers To-do inside a table cell");
      const rows = await note.locator("tr").count();
      await tap(page, bar.getByRole("button", { name: "Table actions" }));
      await tap(page, page.locator(".action-sheet").getByRole("button", { name: "Insert row below", exact: true }));
      await until("a row was added", async () => (await note.locator("tr").count()) === rows + 1);
      // A picture: iOS's own sheet answers the file field.
      await tap(page, note.locator("p").filter({ hasText: "second line" }));
      const chooser = page.waitForEvent("filechooser");
      await tap(page, bar.getByRole("button", { name: "Add a picture" }));
      await (await chooser).setFiles({ name: "photo.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") });
      await until("the picture is in the note", async () => (await note.locator("img.note-image").count()) === 1);
      // A diagram opens to view, with no way to draw on it.
      await tap(page, note.locator(".note-diagram").first());
      const view = page.locator(".diagram-view");
      await view.locator(".diagram-art svg").waitFor();
      if (await page.locator(".kb-bar").count()) throw new Error("the keyboard bar stayed over the diagram");
      if (await view.locator(".draw, [role=toolbar]").count()) throw new Error("the phone's diagram has drawing tools");
      await tap(page, view.getByRole("button", { name: "Done" }));
      await view.waitFor({ state: "detached" });
    });
  } finally {
    rmSync(dirname(diagram), { recursive: true, force: true });
  }
}, "phone");

journey("phone: the note's keyboard bar fits the screen, and the + menu stays under the header with the keyboard up", async (page) => {
  // ten 44pt buttons on a 402pt screen put Hide the keyboard past the edge, with nothing to say the bar scrolls.
  await phoneSource(page, TESTING);
  await tap(page, page.locator(".phone-tools button").filter({ hasText: "Note" }));
  const note = page.locator(".phone-reader [contenteditable=true]").first();
  const bar = page.locator(".kb-bar");
  await tap(page, note.locator("p").first());
  const hide = bar.getByRole("button", { name: "Hide the keyboard" });
  const onScreen = async () => ((await hide.boundingBox())?.x ?? Infinity) + 44 <= (page.viewportSize()?.width ?? 0) + 0.5;
  await until("Hide the keyboard is on screen outside a list", onScreen);
  if (await bar.getByRole("button", { name: "Indent" }).count()) throw new Error("Indent shows outside a list, where it does nothing");
  await tap(page, bar.getByRole("button", { name: "Bulleted list" }));
  await bar.getByRole("button", { name: "Indent" }).waitFor();
  await until("Hide the keyboard is on screen in a list", onScreen);
  await until("the bar fades where more buttons are", async () => (await bar.locator(".kb-scroll[data-more]").count()) === 1);
  await tap(page, bar.getByRole("button", { name: "Bulleted list" }));
  // the + menu grew past the header when the keyboard left less than 40vh.
  await keyboardUp(page, 420); // with iOS's own bar and the notch, as on a 402pt iPhone
  await tap(page, bar.getByRole("button", { name: "Add a block" }));
  const menu = page.locator(".note-menu");
  await menu.waitFor();
  const head = await page.locator(".phone-source > .phone-bar").boundingBox();
  await until("the + menu starts below the header", async () => ((await menu.boundingBox())?.y ?? 0) >= head!.y + head!.height);
}, "phone");

journey("phone: a key point being typed survives a relaunch, and goes when the text under it changed", async (page) => {
  await phoneSource(page, TESTING);
  await tap(page, page.getByRole("button", { name: "Source actions" }));
  await tap(page, page.locator(".action-sheet button").filter({ hasText: "Add a key point here" }));
  const field = page.getByRole("textbox", { name: "Key point" });
  await field.waitFor();
  await page.keyboard.type("Retrieval beats rereading after a week");
  await Bun.sleep(500);
  await page.reload();
  await until("the line comes back after a relaunch", async () => (await field.inputValue().catch(() => "")) === "Retrieval beats rereading after a week");
  // Left on the source, it waits for its field: opening Collected later brings it back, and so does Add a key point here.
  await tap(page, page.locator(".phone-back").filter({ hasText: "Source" }));
  await page.locator(".reader:not(.noting)").waitFor();
  await page.reload();
  await phoneReaderReady(page);
  await Bun.sleep(300);
  await tap(page, page.locator(".phone-tools > :first-child"));
  await page.locator('aside.mynotes[aria-label="Collected"]').waitFor();
  await until("opening Collected brings it back", async () => (await field.inputValue().catch(() => "")) === "Retrieval beats rereading after a week");
  await tap(page, page.locator(".phone-back").filter({ hasText: "Source" }));
  await page.reload();
  await phoneReaderReady(page);
  await tap(page, page.getByRole("button", { name: "Source actions" }));
  await tap(page, page.locator(".action-sheet button").filter({ hasText: "Add a key point here" }));
  await until("Add a key point here brings it back", async () => (await field.inputValue().catch(() => "")) === "Retrieval beats rereading after a week");
  await macChanges((lib) => itemFile(lib, "the-testing-effect", "doc.md"), "# The Testing Effect: Why Retrieval Beats Rereading\n", "# The Testing Effect: Why Retrieval Beats Rereading\n\nA new opening paragraph the Mac added.\n", async () => {
    await page.reload();
    await phoneReaderReady(page);
    await Bun.sleep(800);
    if (await field.count()) throw new Error("the line came back over text that changed under its anchor");
    await tap(page, page.locator(".phone-back").filter({ hasText: "Source" }));
    await tap(page, page.getByRole("button", { name: "Source actions" }));
    await tap(page, page.locator(".action-sheet button").filter({ hasText: "Add a key point here" }));
    await field.waitFor();
    if (await field.inputValue()) throw new Error("the line came back over text that changed under its anchor");
  });
}, "phone");

journey("phone: a picture in a source opens over the whole screen, and a tap puts it back (Books)", async (page) => {
  await phoneSource(page, AGENTS);
  const img = page.locator(".phone-reader .doc img").first();
  await until("the saved picture loads from the library", () => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0));
  await tap(page, img);
  const big = page.locator(".figure-view img");
  await big.waitFor();
  await until("it opens edge to edge", async () => Math.round((await big.boundingBox())?.width ?? 0) === 390);
  await page.touchscreen.tap(195, 120);
  await page.locator(".figure-view").waitFor({ state: "detached" });
  if ((await img.evaluate((i: HTMLElement) => i.style.visibility)) === "hidden") throw new Error("the picture in the text stayed hidden after closing");
}, "phone");

journey("phone: a selection handle held at the bottom of the screen turns the page after a moment and the selection runs on (Books)", async (page) => {
  const { createItem } = (await import(join(import.meta.dir, "../../../../packages/core/src/index.ts"))) as { createItem: (lib: { root: string }, d: object) => Promise<{ dir: string }> };
  const md = longPassages("Passages on the phone");
  await phoneWith(page, async () => (await createItem({ root: PHONE_LIB }, { type: "article", title: "Passages on the phone", body: md.slice(md.indexOf("Passage 1 ")) })).dir, async () => {
    await phoneSource(page, "Passages on the phone");
    await page.locator(".phone-reader .doc p", { hasText: "Passage 40 " }).waitFor();
    await page.waitForTimeout(400);
    const pane = page.locator(".phone-reader .reader-scroll");
    const top = () => pane.evaluate((e) => e.scrollTop);
    const was = await top();
    // As iOS's handles move it: a word selected, then the selection's end dragged down to a word at the bottom of the screen.
    const start = await page.evaluate(() => {
      const b = document.querySelector<HTMLElement>(".phone-reader .reader-scroll")!.getBoundingClientRect();
      const ps = [...document.querySelectorAll<HTMLElement>(".phone-reader .doc p")];
      const p = ps.find((p) => p.getBoundingClientRect().top > b.top + b.height / 2)!;
      const t = p.firstChild as Text;
      getSelection()!.setBaseAndExtent(t, 0, t, 7);
      return Number(p.textContent!.match(/Passage (\d+)/)![1]);
    });
    await page.waitForTimeout(150); // a change of its own: a new selection alone never turns the page
    // The word the handle is dragged to must be there to drag to: as the first phone journey of a CI shard, on a
    // phone build just started, nothing answered at that point yet and the drag below threw on null (F475).
    let under = "";
    await until("there is text at the foot of the reader to drag the handle to", async () => {
      under = await page.evaluate(() => {
        const b = document.querySelector<HTMLElement>(".phone-reader .reader-scroll")!.getBoundingClientRect();
        const end = [...document.querySelectorAll<HTMLElement>(".phone-reader .doc p")].find((q) => q.getBoundingClientRect().bottom > b.bottom - 40);
        if (!end) return "no paragraph reaches the reader's foot";
        const [x, y] = [end.getBoundingClientRect().left + 20, Math.min(end.getBoundingClientRect().bottom, b.bottom) - 30];
        if (document.caretRangeFromPoint(x, y)) return "";
        const at = document.elementFromPoint(x, y);
        return `no text at ${Math.round(x)},${Math.round(y)} (window ${innerWidth}×${innerHeight}, reader ends at ${Math.round(b.bottom)}): ${at ? `${at.tagName}.${at.className}` : "nothing there"}`;
      });
      return !under;
    }, 5000).catch((e) => { throw new Error(`${(e as Error).message}: ${under}`); });
    const from = await page.evaluate((n) => {
      const b = document.querySelector<HTMLElement>(".phone-reader .reader-scroll")!.getBoundingClientRect();
      const ps = [...document.querySelectorAll<HTMLElement>(".phone-reader .doc p")];
      const t = ps.find((p) => p.textContent!.startsWith(`Passage ${n} `))!.firstChild as Text;
      const end = ps.find((q) => q.getBoundingClientRect().bottom > b.bottom - 40)!;
      const x = end.getBoundingClientRect().left + 20;
      const y = Math.min(end.getBoundingClientRect().bottom, b.bottom) - 30;
      const c = document.caretRangeFromPoint(x, y);
      // No text under the point (F475, once on CI): say where it was and what was there.
      if (!c) throw new Error(`no text at ${Math.round(x)},${Math.round(y)}: window ${innerWidth}×${innerHeight}, pane ${Math.round(b.top)} to ${Math.round(b.bottom)}, paragraph ${Math.round(end.getBoundingClientRect().top)} to ${Math.round(end.getBoundingClientRect().bottom)}, on top there: ${document.elementFromPoint(x, y)?.className ?? "nothing"}`);
      getSelection()!.setBaseAndExtent(t, 0, c.startContainer, c.startOffset);
      return { n, last: Number(end.textContent!.match(/Passage (\d+)/)![1]) };
    }, start);
    await page.waitForTimeout(300);
    if ((await top()) !== was) throw new Error("the page turned before any pause");
    await until("held at the bottom, the page turns", async () => (await top()) > was + 300, 3000);
    await page.waitForTimeout(500);
    const sel = await page.evaluate(() => getSelection()!.toString());
    if (!sel.startsWith(`Passage ${from.n} `) || !sel.includes(`Passage ${from.last + 2} `)) throw new Error(`the selection didn't run on with the page: “${sel.slice(0, 60)}…${sel.slice(-60)}”`);
    // Its handle held still sends nothing, so it can't be told from a lifted finger: one turn per move, never a run to the end.
    const turned = await top();
    await page.waitForTimeout(1500);
    if ((await top()) !== turned) throw new Error("the page kept turning by itself after one turn, with no move of the handle");
  });
}, "phone");

journey("phone: a video stays pinned under the top bar while its transcript scrolls", async (page) => {
  const { createItem } = (await import(join(import.meta.dir, "../../../../packages/core/src/index.ts"))) as { createItem: (lib: { root: string }, d: object) => Promise<{ dir: string }> };
  const lines = Array.from({ length: 30 }, (_, i) => `Line ${i + 1} of the talk, long enough to wrap onto a second line on a phone.`);
  const vtt = "WEBVTT\n\n" + lines.map((l, i) => `00:${String(i).padStart(2, "0")}:00.000 --> 00:${String(i).padStart(2, "0")}:30.000\n${l}\n`).join("\n");
  const body = lines.map((l, i) => `[${String(i).padStart(2, "0")}:00] ${l}`).join("\n\n");
  await phoneWith(page, async () => (await createItem({ root: PHONE_LIB }, { type: "youtube", title: "A pinned talk", url: "https://www.youtube.com/watch?v=pinnedTalk1", body, source: { ext: "vtt", data: vtt } })).dir, async () => {
    await phoneSource(page, "A pinned talk");
    const pin = page.locator(".player-pin");
    await pin.waitFor();
    await page.locator(".phone-reader .reader-scroll").evaluate((el) => (el.scrollTop = 900));
    await until("the player sits just under the top bar", async () => {
      const y = (await pin.boundingBox())?.y ?? -1;
      return y >= 43 && y <= 48;
    });
  });
}, "phone");

journey("phone: Source actions renames a source and edits its author in place", async (page) => {
  await phoneSource(page, TESTING);
  const action = async (name: RegExp) => {
    await tap(page, page.getByRole("button", { name: "Source actions" }));
    await tap(page, page.locator(".action-sheet button").filter({ hasText: name }));
  };
  await action(/^Rename/);
  const title = page.locator(".doc-head .title-edit");
  await title.waitFor();
  const size = await title.evaluate((e) => getComputedStyle(e).fontSize);
  if (size !== "26px") throw new Error(`the title field is ${size}, not the title's 26px`);
  await title.fill("Retrieval beats rereading");
  await page.keyboard.press("Enter");
  await page.locator(".doc-head h1").filter({ hasText: "Retrieval beats rereading" }).waitFor();
  await action(/author/);
  const author = page.locator(".doc-head .author-edit");
  await author.fill("A. Researcher");
  await page.keyboard.press("Enter");
  await page.locator(".doc-head .by").filter({ hasText: "A. Researcher" }).waitFor();
}, "phone");

journey("phone: a PDF's own page opens from Source actions, turns, and Back returns to the text", async (page) => {
  const pdf = join(import.meta.dir, "../../../../packages/core/test/fixtures/intake/files/textbook.pdf");
  await phoneWith(page, async () => {
    const r = JSON.parse(await $`bun ${join(import.meta.dir, "../../../../packages/cli/src/ore.ts")} add ${pdf} --no-enrich --json`.env({ ...process.env, ORE_LIBRARY: PHONE_LIB, ORE_NO_ENRICH: "1" }).text()) as { path: string };
    return join(PHONE_LIB, r.path, "..");
  }, async () => {
    await phoneSource(page, "Chapter 1");
    await tap(page, page.getByRole("button", { name: "Source actions" }));
    await tap(page, page.locator(".action-sheet button").filter({ hasText: "Original page" }));
    await page.locator(".original canvas[data-page]").waitFor({ timeout: 15000 });
    const pager = page.locator(".original-pager span");
    const at = await pager.textContent();
    await fits44(page, "[aria-label='Next page']", "Next page");
    await tap(page, page.getByRole("button", { name: "Next page" }));
    await until("Next page turns it", async () => (await pager.textContent()) !== at);
    await tap(page, page.locator(".phone-back").filter({ hasText: "Source" }));
    await until("Back returns to the text", async () => !(await page.locator(".phone-reader .reader").evaluate((e) => e.classList.contains("noting"))));
  });
}, "phone");

journey("phone: a source's edit fields and the note's keyboard bar answer a 44pt touch", async (page) => {
  await phoneSource(page, TESTING);
  const action = async (name: RegExp) => {
    await tap(page, page.getByRole("button", { name: "Source actions" }));
    await tap(page, page.locator(".action-sheet button").filter({ hasText: name }));
  };
  await action(/^Rename/);
  await fits44(page, ".doc-head .title-edit", "the title field");
  await page.keyboard.press("Escape");
  await action(/author/);
  await fits44(page, ".doc-head .author-edit", "the author field");
  await page.keyboard.press("Escape");
  await action(/^Add a key point here/);
  await fits44(page, ".cp-input", "the key point field");
  await page.keyboard.press("Escape");
  await tap(page, page.locator(".phone-back").filter({ hasText: "Source" }));
  if (!(await page.locator(".preq-input").count())) await tap(page, page.locator(".preq-head"));
  await fits44(page, ".preq-input", "the empty answer to What do you already know?");
  await action(/^Finish/);
  await fits44(page, '[aria-label="Skip a part of this source?"]', "Finish's Skip a part of this source?");
  await tap(page, page.getByRole("button", { name: "Close quiz" }));
  await tap(page, page.locator(".phone-tools button").filter({ hasText: "Note" }));
  await tap(page, page.locator(".phone-reader [contenteditable=true]").first());
  await page.locator(".kb-bar").waitFor();
  const n = await page.locator(".kb-bar > .kb-btn, .kb-bar > button").count();
  for (let i = 1; i <= n; i++) await fits44(page, `.kb-bar > :nth-child(${i})`, `the keyboard bar's button ${i}`);
}, "phone");

journey("phone: a note's to-do box answers a touch over 44pt around it, and a tap on its text still edits it", async (page) => {
  // The box is a 17pt ::before on a 27pt row: taps 12pt above, below or right of its centre landed on the text or
  // the next row and did nothing.
  await phoneSource(page, TESTING);
  await tap(page, page.locator(".phone-tools button").filter({ hasText: "Note" }));
  const note = page.locator(".phone-reader [contenteditable=true]").first();
  await tap(page, note);
  await page.keyboard.press("Meta+ArrowDown"); // the end of the note, then out of its list onto a line of its own
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("First task");
  await tap(page, page.locator(".kb-bar").getByRole("button", { name: "To-do" }));
  await page.keyboard.press("Enter");
  await page.keyboard.type("Second task");
  const first = note.locator('li[data-item-type="task"]').filter({ hasText: "First task" });
  const second = note.locator('li[data-item-type="task"]').filter({ hasText: "Second task" });
  await second.waitFor();
  const at = () =>
    first.evaluate((li) => {
      const r = li.getBoundingClientRect();
      const s = getComputedStyle(li, "::before");
      const w = parseFloat(s.width) + parseFloat(s.borderLeftWidth) * 2;
      const [x, y] = [r.left + parseFloat(s.left) + w / 2, r.top + parseFloat(s.top) + w / 2];
      const text = li.querySelector("p")!.getBoundingClientRect();
      return { x, y, textLeft: text.left, textMid: text.left + 30, textY: text.top + text.height / 2 };
    });
  const checked = async (li: typeof first) => (await li.getAttribute("data-checked")) === "true";
  const b = await at();
  for (const [what, dx, dy] of [
    ["12pt above", 0, -12],
    ["12pt below", 0, 12],
    ["12pt left of", -12, 0],
    ["just right, before the text,", Math.min(12, b.textLeft - 1 - b.x), 0],
    ["the centre of", 0, 0],
  ] as const) {
    const [was, next] = [await checked(first), await checked(second)];
    await page.touchscreen.tap(b.x + dx, b.y + dy);
    await until(`a tap ${what} the box toggles it`, async () => (await checked(first)) !== was, 1500).catch(() => {
      throw new Error(`a tap ${what} the first to-do's box (${Math.round(dx)}, ${dy}) did not toggle it`);
    });
    if ((await checked(second)) !== next) throw new Error(`a tap ${what} the first box toggled the second to-do`);
  }
  const was = await checked(first);
  await page.touchscreen.tap(b.textMid, b.textY);
  await Bun.sleep(300);
  if ((await checked(first)) !== was) throw new Error("a tap on the to-do's text toggled it");
  const caret = await first.evaluate((li) => {
    const s = getSelection();
    return s?.isCollapsed && li.querySelector("p")!.contains(s.anchorNode) ? "" : (s?.anchorNode?.parentElement?.closest("li, p")?.textContent ?? "nowhere");
  });
  if (caret) throw new Error(`a tap on the to-do's text put the caret in “${caret}”, not in its text`);
}, "phone");

journey("phone: a link to a part of the page that wasn't saved says the next step is on the Mac", async (page) => {
  // The toast said to Reimport from ⋯, which the phone doesn't offer.
  await macChanges((lib) => itemFile(lib, "building-effective-agents", "doc.md"), "\n# Building Effective Agents\n", "\n# Building Effective Agents\n\nSee [the missing part](#a-part-not-saved).\n", async () => {
    await page.reload(); // the phone reads the Mac's change on a relaunch, as every journey here does
    await page.locator(".phone-opening").waitFor({ state: "detached" });
    await phoneSource(page, AGENTS);
    await tap(page, page.locator(".phone-reader .doc a").filter({ hasText: "the missing part" }));
    const toast = page.locator(".toasts").filter({ hasText: "wasn’t saved" });
    await toast.waitFor();
    const said = await toast.innerText();
    if (said.includes("⋯") || !said.includes("Mac")) throw new Error(`the toast gives a step the phone can't take: “${said}”`);
  });
}, "phone");

journey("phone: Search finds a source by its author (F337)", async (page) => {
  await tap(page, page.getByRole("button", { name: "Search" }));
  await page.locator("[cmdk-input]").fill("Barry Zhang");
  await page.locator("[cmdk-item]").filter({ hasText: AGENTS }).first().waitFor();
}, "phone");

// —— the iPhone's native feel (D331, F402) ——

/** Every scroller on screen a finger could move: whether iOS would let it give at its ends (the rubber band), and
 *  whether it scrolls at all. iOS only bounces a scroller that has somewhere to go. */
const scrollers = (page: Page, within: string) =>
  page.evaluate((within) =>
    [...document.querySelectorAll<HTMLElement>(`${within}, ${within} *`)]
      .filter((el) => /auto|scroll/.test(getComputedStyle(el).overflowY) && el.clientHeight > 200 && el.checkVisibility())
      .map((el) => ({ name: el.className.toString().split(" ")[0]!, gives: getComputedStyle(el).overscrollBehaviorY !== "none", scrolls: el.scrollHeight > el.clientHeight })), within);

journey("phone: every page gives at its top and bottom as iOS's own do, a short one too (F402)", async (page) => {
  // The Mac's "no overscroll" rule reached the phone's reader and Review, and a list shorter than the screen had
  // nowhere to go, so iOS gave it no rubber band at all.
  const check = async (where: string, within: string) => {
    await until(`${where} has a page to scroll`, async () => (await scrollers(page, within)).length > 0);
    const stiff = (await scrollers(page, within)).filter((s) => !s.gives || (/^(phone-page|review-body)$/.test(s.name) && !s.scrolls));
    if (stiff.length) throw new Error(`${where}: no rubber band on ${stiff.map((s) => `${s.name}${s.gives ? " (nowhere to scroll)" : " (overscroll off)"}`).join(", ")}`);
  };
  await check("Today", ".phone-root");
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Archive" }));
  await check("Archive, a list shorter than the screen", ".phone-root");
  await phoneSource(page, TESTING);
  await check("A source", ".phone-source");
  await tap(page, page.locator(".phone-full .phone-back"));
  await page.locator(".phone-full").waitFor({ state: "detached" });
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Today" }));
  await tap(page, page.getByRole("button", { name: /^Start review/ }));
  const go = page.locator(".review-pick .home-go");
  if (await go.count()) await tap(page, go);
  await page.locator(".phone-full .review-body").waitFor();
  await check("Review", ".phone-full");
}, "phone");

journey("phone: a light page is light up behind the clock, not a dark strip over it (Codex native scout)", async (page) => {
  await page.evaluate(() => localStorage.setItem("ore.page", "light"));
  await page.reload();
  await page.locator(".phone-app").waitFor();
  await phoneSource(page, TESTING);
  // The web view's own page shows behind the clock and past the top in a rubber band; it was the app's dark.
  const [html, body, doc] = await page.evaluate(() => [document.documentElement, document.body, document.querySelector(".phone-source .reader-pane")!].map((e) => getComputedStyle(e).backgroundColor));
  if (html !== doc || body !== doc) throw new Error(`under a light page (${doc}) the web view's page is ${html} / ${body}`);
  // The strip the source paints over the safe area, under the clock, was the app's dark on top of all that (Codex verify 2026-11-20).
  const strip = await page.evaluate(() => getComputedStyle(document.querySelector(".phone-source")!, "::before").backgroundColor);
  if (strip !== doc) throw new Error(`under a light page (${doc}) the strip behind the clock is ${strip}`);
  await tap(page, page.getByRole("button", { name: "Back", exact: true }).first());
  await until("back on Today, the page under it is the app's dark again", async () => (await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)) !== doc);
}, "phone");

journey("phone: Bold Text in iOS makes Ore's text heavier, a row's words and a title alike (F409)", async (page) => {
  // Only the clock got bolder: the web view's text doesn't follow it, so the app sets --bold from what iOS says.
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Settings" }));
  const weights = () => page.evaluate(() => [".phone-settings h1", ".phone-settings .settings-row-text, .phone-settings p"].map((q) => Number(getComputedStyle(document.querySelector(q)!).fontWeight)));
  const [title, words] = await weights();
  await page.evaluate(() => document.documentElement.style.setProperty("--bold", "1"));
  const [boldTitle, boldWords] = await weights();
  if (!(boldWords! >= words! + 100 && boldTitle! > title!)) throw new Error(`under Bold Text the words weigh ${words} → ${boldWords}, the title ${title} → ${boldTitle}`);
  await page.evaluate(() => document.documentElement.style.setProperty("--bold", "0"));
  if ((await weights())[1] !== words) throw new Error("Bold Text turned off left the text heavy");
}, "phone");

// F451: the Collected page beside a source had Back and no title, where Sources and Settings name themselves.
journey("phone: a source's Collected page has its title, as Sources and Settings do (F451)", async (page) => {
  await phoneSource(page, TESTING);
  await tap(page, page.locator(".phone-tools > :first-child"));
  const collected = page.locator('aside.mynotes[aria-label="Collected"]');
  await collected.waitFor();
  await collected.getByRole("heading", { level: 1, name: "Collected" }).waitFor();
}, "phone");

journey("phone: a new question in Collected is typed in place, with no line over it and no box (F578)", async (page) => {
  await phoneSource(page, TESTING);
  await tap(page, page.locator(".phone-tools > :first-child"));
  const collected = page.locator('aside.mynotes[aria-label="Collected"]');
  await collected.waitFor();
  await tap(page, collected.getByRole("button", { name: "Ask a question" }));
  await askFieldIsPlain(page, collected);
  await page.keyboard.press("Escape");
}, "phone");

journey("phone: a correction to a saved answer shows when its question folds and opens, and one left typing is saved by the fold (Codex UX sweep 2)", async (page) => {
  const q = `Bus question ${Date.now() % 100000}`;
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Learning" }));
  await tap(page, page.getByRole("button", { name: "Add a question" }));
  await page.getByRole("textbox", { name: "New question" }).fill(q);
  await page.keyboard.press("Enter");
  const head = page.getByRole("button", { name: q, exact: true });
  await tap(page, head);
  await page.getByRole("textbox", { name: `Your answer to ${q}` }).fill("First answer");
  await tap(page, page.getByRole("button", { name: "Save", exact: true }));
  await page.getByRole("button", { name: "Edit: First answer" }).waitFor();
  // Saved with Return, then folded and opened: the correction shows, not the answer before it.
  await tap(page, page.getByRole("button", { name: "Edit: First answer" }));
  await page.getByRole("textbox", { name: "Edit this part of your answer" }).fill("Saved correction");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Edit: Saved correction" }).waitFor();
  await tap(page, head);
  await tap(page, head);
  await page.getByRole("button", { name: "Edit: Saved correction" }).waitFor({ timeout: 3000 });
  // Typed and left by folding the question: a tap away saves it (D211).
  await tap(page, page.getByRole("button", { name: "Edit: Saved correction" }));
  await page.getByRole("textbox", { name: "Edit this part of your answer" }).fill("Folded correction");
  await tap(page, head);
  await tap(page, head);
  await page.getByRole("button", { name: "Edit: Folded correction" }).waitFor({ timeout: 3000 });
}, "phone");

journey("phone: a long press on a Collected row opens its actions (Codex UX sweep 3)", async (page) => {
  await phoneSource(page, TESTING);
  await tap(page, page.locator(".phone-tools > :first-child"));
  const collected = page.locator('aside.mynotes[aria-label="Collected"]');
  await collected.waitFor();
  const row = collected.locator(".cp-row").first();
  await row.waitFor();
  await press(page, row);
  await page.getByRole("menuitem").first().waitFor({ timeout: 3000 });
  await page.keyboard.press("Escape");
}, "phone");

journey("phone: Back from a note's link returns to that note, and a Linked from row opens the note it quotes (Codex UX sweep 9)", async (page) => {
  await phoneSource(page, AGENTS);
  await tap(page, page.locator(".phone-tools > :nth-child(2)"));
  await page.locator(".reader.noting").waitFor();
  const editor = page.locator(".phone-reader [contenteditable=true]").first();
  await editor.click();
  await page.keyboard.press("End");
  await page.keyboard.type("Bus link: [[Testing");
  await tap(page, page.getByRole("option", { name: new RegExp(TESTING.slice(0, 20)) }).first());
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await Bun.sleep(600); // the note saves
  await page.locator(".phone-reader [contenteditable] a").filter({ hasText: "The Testing Effect" }).first().click();
  await page.locator(".phone-reader .doc h1, .phone-reader .doc-head h1").filter({ hasText: "Testing" }).first().waitFor();
  // Its note's Linked from opens the note it quotes, not the article.
  await tap(page, page.locator(".phone-tools > :nth-child(2)"));
  await tap(page, page.locator(".linked-from .backlink").filter({ hasText: AGENTS }).first());
  await page.locator(".reader.noting").waitFor({ timeout: 3000 });
  await page.locator(".mynotes").filter({ hasText: "Bus link:" }).waitFor();
  // From there, a link and Back: back on the note it left.
  await page.locator(".phone-reader [contenteditable] a").filter({ hasText: "The Testing Effect" }).first().click();
  await page.locator(".phone-reader .doc-head h1").filter({ hasText: "Testing" }).first().waitFor();
  await tap(page, page.locator(".phone-full .phone-back").first());
  await page.locator(".reader.noting").waitFor({ timeout: 3000 });
  await page.locator(".mynotes").filter({ hasText: "Bus link:" }).waitFor();
}, "phone");

journey("phone: a book's publisher pages sit under one shut row a finger can hit, and a tap on its cover opens it (D354)", async (page) => {
  const epub = join(import.meta.dir, "../../../../packages/core/test/fixtures/intake/files/front-matter.epub");
  await phoneWith(page, async () => {
    const r = JSON.parse(await $`bun ${join(import.meta.dir, "../../../../packages/cli/src/ore.ts")} add ${epub} --no-enrich --json`.env({ ...process.env, ORE_LIBRARY: PHONE_LIB, ORE_NO_ENRICH: "1" }).text()) as { path: string };
    return join(PHONE_LIB, r.path, "..");
  }, async () => {
    await phoneSource(page, "The Slow Lamp");
    const row = page.locator(".phone-reader .front-head").first();
    const body = page.locator(".phone-reader .front-body").first();
    await row.waitFor();
    await fits44(page, ".phone-reader .front-head", "Front matter");
    if (await body.isVisible()) throw new Error("the publisher's pages show before he opens them");
    await tap(page, row);
    await body.filter({ hasText: "Thank you for buying" }).waitFor();
    const wide = await page.locator(".phone-reader .reader-scroll").evaluate((e) => e.scrollWidth - e.clientWidth);
    if (wide > 1) throw new Error(`the open pages run ${wide}px past the screen's edge`);
    await tap(page, row);
    await until("a second tap shuts it", async () => !(await body.isVisible()));
    // The publisher's last pages, under the text: the same row.
    const end = page.locator(".phone-reader .front-head").last();
    await end.scrollIntoViewIfNeeded();
    const h = (await end.boundingBox())!.height;
    if (h < 44) throw new Error(`the Back matter row is ${h}pt tall`);
    await tap(page, end);
    await page.locator(".phone-reader .front-body").last().filter({ hasText: "A NOTE ABOUT THE AUTHOR" }).waitFor();
    await page.locator(".phone-reader .reader-scroll").evaluate((e) => (e.scrollTop = 0));
    const cover = page.locator(".phone-reader img.doc-thumb");
    await until("the cover has loaded", () => cover.evaluate((i: HTMLImageElement) => i.naturalWidth > 0));
    await tap(page, cover);
    await page.locator(".figure-view.open").waitFor();
  });
}, "phone");

journey("phone: while he types in the note beside a source, its highlights' tints are off the page; they are back when he leaves the field (F736)", async (page) => {
  // WebKit slows every key in the note while a highlight is painted in a long source a page away: 51 keys took 6.8 s
  // in his 638 KB book, 2 s with none painted. The lag itself only shows in WebKit on a long source; this holds its cause.
  await phoneSource(page, TESTING);
  const tints = () => page.evaluate(() => ["keep", "card", "question", "apply"].reduce((n, k) => n + (CSS.highlights.get(`hl-${k}`)?.size ?? 0), 0));
  await until("the source's highlights are tinted", async () => (await tints()) > 0);
  await tap(page, page.locator(".phone-tools > :nth-child(2)"));
  await page.locator(".reader.noting").waitFor();
  await until("focus is on the note", () => page.evaluate(() => !!document.activeElement?.closest(".mynotes")));
  await until("no tint is painted while the note has the keyboard", async () => (await tints()) === 0);
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await until("the tints are back once he leaves the field", async () => (await tints()) > 0);
}, "phone");

journey("phone: Finish holds the questions it has no key points for: the recall is saved, they wait for the Mac, and the source stays in To read (F738)", async (page) => {
  // The phone asked them anyway: after an answer or "No idea" it said "Not checked here", with no key point or passage
  // to learn from (AI runs on the Mac, D78.3).
  await phoneSource(page, TESTING);
  const finish = async () => {
    await tap(page, page.getByRole("button", { name: "Source actions" }));
    await tap(page, page.locator(".action-sheet button").filter({ hasText: /^Finish/ }));
  };
  await finish();
  await page.getByLabel("Free recall").fill("Testing yourself beats rereading, more so after a week.");
  await tap(page, page.locator(".quiz-go"));
  await page.locator(".quiz-done h2").filter({ hasText: /wait on your Mac/ }).waitFor({ timeout: 5000 });
  if (await page.getByText("Not checked here").count()) throw new Error("a question the phone can't check was asked");
  await tap(page, page.locator(".quiz-go"));
  await page.locator(".quiz-done").waitFor({ state: "detached" });
  // Still in To read: Finish is offered again (the Mac's asks the questions), and his recall is in the source note.
  await tap(page, page.getByRole("button", { name: "Source actions" }));
  await page.locator(".action-sheet button").filter({ hasText: /^Finish/ }).waitFor();
  // Esc goes to what holds the keys: pressed the frame before the sheet took them, it left the source (F747).
  await until("the sheet holds the keys", () => page.evaluate(() => !!document.activeElement?.closest(".action-sheet")));
  await page.keyboard.press("Escape");
  await page.locator(".action-sheet").waitFor({ state: "detached" });
  await tap(page, page.locator(".phone-tools button").filter({ hasText: "Note" }));
  await page.locator(".mynotes").filter({ hasText: "Testing yourself beats rereading" }).waitFor({ timeout: 5000 });
}, "phone");
