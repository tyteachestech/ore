import { join } from "node:path";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { type Locator, type Page } from "playwright";
import { AGENTS, BRIDGE, FIXTURES, journey, LIB, openSource, ore, reveal, startReview, TESTING, unchip, until } from "../harness";

journey("tutor mole: it sits at the bottom right on every screen, pages keep room to scroll clear of it, and a quiz panel hides it (D160, D168)", async (page) => {
  const button = page.getByRole("button", { name: "Open the tutor" });
  const vp = page.viewportSize()!;
  const check = async (where: string, scroller: string) => {
    const b = (await button.boundingBox())!;
    if (Math.abs(vp.width - (b.x + b.width) - 16) > 1 || Math.abs(vp.height - (b.y + b.height) - 16) > 1) throw new Error(`${where}: the mole is not 16px in from the bottom right corner (${b.x}, ${b.y})`);
    // The last line of what scrolls under it can come up above it.
    const room = await page.locator(scroller).first().evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
    if (room < vp.height - b.y) throw new Error(`${where}: ${scroller} keeps ${room}px at its foot, less than the mole's ${vp.height - b.y}px`);
  };
  await check("Home", ".home");
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  await page.locator(".skill-page").waitFor();
  await check("skill page", ".skill-col");
  await openSource(page, TESTING);
  await check("reader", ".mynotes-text");
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.locator("section.quiz").waitFor();
  await until("the quiz panel's corner is its own", async () => !(await button.isVisible()));
  await page.keyboard.press("Escape");
  await button.waitFor();
});

journey("tutor mole: the mouse landing on him gets a friendly move that ends, the next one is another, and focus alone gets none (D320)", async (page) => {
  const button = page.getByRole("button", { name: "Open the tutor" }), mole = button.locator(".mole");
  const mood = () => mole.getAttribute("data-mood");
  const FRIENDLY = ["hello", "tip", "wink", "flash", "peekaboo", "chuckle", "dance", "happy", "proud", "shy", "curious", "nod"];
  await until("he is up and at rest", async () => (await mood()) === "idle", 8000);
  // Focus alone faces him, as before: no move.
  await button.focus();
  await page.waitForTimeout(200);
  if ((await mood()) !== "idle") throw new Error(`focus played ${await mood()}`);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const seen: string[] = [];
  for (let i = 0; i < 3; i++) {
    await button.hover();
    await until("a friendly move plays", async () => FRIENDLY.includes((await mood()) ?? ""));
    seen.push((await mood())!);
    // Leaving and landing again mid-move starts nothing new.
    await page.mouse.move(200, 200);
    await button.hover();
    if ((await mood()) !== seen[i]) throw new Error(`a second landing cut ${seen[i]} short with ${await mood()}`);
    await page.mouse.move(200, 200);
    await until("it ends at rest", async () => (await mood()) === "idle", 6000);
    await page.waitForTimeout(350);
  }
  if (seen[0] === seen[1] || seen[1] === seen[2]) throw new Error(`the same move twice running: ${seen.join(", ")}`);
  // The click still opens the tutor.
  await button.click();
  await page.getByLabel("Message the tutor").waitFor();
  await page.keyboard.press("Escape");
});

journey("tutor: a message from a source says which section is on his screen, so \"this part\" means that part (D294)", async (page) => {
  await openSource(page, AGENTS);
  const heading = await page.evaluate(() => {
    const hs = [...document.querySelectorAll<HTMLElement>(".doc h2, .doc h3")];
    const h = hs[Math.min(2, hs.length - 1)]!;
    const pane = document.querySelector<HTMLElement>(".reader-scroll")!;
    pane.scrollTop += h.getBoundingClientRect().top - pane.getBoundingClientRect().top - 40;
    return h.textContent!.trim();
  });
  await page.keyboard.press("Meta+j");
  const at = (r: { postData(): string | null }) => (r.postData() ?? "").includes(`"tutor","Explain this part","--item=`) && (r.postData() ?? "").includes(JSON.stringify(`--at=${heading}`).slice(1, -1));
  const sent = page.waitForRequest(at);
  await page.getByRole("textbox", { name: "Message the tutor" }).fill("Explain this part");
  await page.keyboard.press("Enter");
  await sent;
  // F319: Try another reply asks the same part again, not the source at large.
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  const again = page.waitForRequest((r) => (r.postData() ?? "").includes(`"tutor","Explain this part","--item=`));
  await tutor.getByRole("button", { name: "Try another reply" }).click();
  if (!at(await again)) throw new Error("Try another reply dropped the section on his screen");
  await tutor.locator(".ask-versions").last().getByText("2 / 2").waitFor();
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
  // Its sources wait behind "Sources" (ChatGPT): pills in the text, the list on a click.
  await tutor.locator(".cite").first().waitFor();
  await tutor.getByRole("button", { name: "Sources" }).click();
  await tutor.locator(".library-sources li").nth(1).waitFor();
  await page.keyboard.press("Escape");
  await until("Esc closes it", async () => (await tutor.count()) === 0);
  await page.getByRole("button", { name: "Open the tutor" }).click();
  await tutor.locator(".ask-me").getByText("Why does this work?").waitFor();
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

journey("tutor citation: a numbered source in a reply opens that source at the quoted passage, marked; another into the open source goes to its own", async (page) => {
  // The reply cites a real passage of the seeded source, placed in its doc.md as the tutor places it.
  const bridge = (args: string[]) => fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args }) }).then((r) => r.json());
  const item = ((await bridge(["ls"])) as { id: string; title: string }[]).find((i) => i.title === TESTING)!;
  const body = ((await bridge(["show", item.id])) as { body: string }).body;
  const quote = "Each successful retrieval changes the memory itself.";
  const start = body.indexOf(quote);
  const quote2 = "Confidence matters as much as accuracy.";
  const start2 = body.indexOf(quote2);
  if (start < 0 || start2 < 0) throw new Error("the seeded source no longer holds the quotes");
  await page.route(/\/ore$/, async (route) => {
    if (!(route.request().postData() ?? "").includes('"tutor",')) return route.fallback();
    const cite = { n: 1, item: item.id, title: TESTING, heading: "", quote, text: quote, start, end: start + quote.length };
    const cite2 = { n: 2, item: item.id, title: TESTING, heading: "Using it well", quote: quote2, text: quote2, start: start2, end: start2 + quote2.length };
    // Saved before the source was reimported (F589): one quote now sits elsewhere, one is gone.
    const moved = { ...cite, n: 3, start: start2, end: start2 + quote.length };
    const gone = { ...cite, n: 4, quote: "Words this source no longer holds.", text: "Words this source no longer holds." };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: "Retrieval changes the memory [1]. Confidence counts too [2]. Moved [3]. Gone [4].", citations: [cite, cite2, moved, gone], general: false, hint: false, exercise: null, card: null, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@4" } }) });
  });
  try {
    await page.keyboard.press("Meta+j");
    const tutor = page.getByRole("complementary", { name: "Tutor" });
    const fresh = tutor.getByRole("button", { name: "New chat" });
    if (await fresh.isEnabled()) await fresh.click();
    await page.getByRole("textbox", { name: "Message the tutor" }).fill("Why does testing work?");
    await page.keyboard.press("Enter");
    await tutor.getByRole("button", { name: `Source 1: ${TESTING}` }).click();
    await page.locator(".doc-head").filter({ hasText: TESTING }).waitFor();
    const active = () => page.evaluate(() => [...(CSS.highlights.get("hl-active") ?? [])].map((r) => r.toString()).join("|"));
    await until("the quoted passage is marked", async () => (await active()) === quote);
    // F317: another citation into the source already open goes to its own passage.
    const top = await page.locator(".reader-scroll").evaluate((e) => e.scrollTop);
    await tutor.getByRole("button", { name: `Source 2: ${TESTING}` }).click();
    await until("the second quoted passage is marked", async () => (await active()) === quote2);
    if ((await page.locator(".reader-scroll").evaluate((e) => e.scrollTop)) === top) throw new Error("the second citation left the page where the first put it");
    // The same citation again, after he scrolled away, goes again.
    await page.locator(".reader-scroll").evaluate((e) => (e.scrollTop = 0));
    await tutor.getByRole("button", { name: `Source 2: ${TESTING}` }).click();
    await until("the same citation clicked again goes back to its passage", async () => (await page.locator(".reader-scroll").evaluate((e) => e.scrollTop)) > 0);
    // A citation whose source changed since: its quote where it now is, and nothing for one that is gone.
    await tutor.getByRole("button", { name: `Source 3: ${TESTING}` }).click();
    await until("a quote that moved is marked where it now is", async () => (await active()) === quote);
    // Opened afresh, one that is gone opens at the place he left, as with no citation, not at the top.
    const scroll = page.locator(".reader-scroll");
    // Far enough down that the passage saved as his place (F444) is not the first: that one restores to the top.
    const left = await scroll.evaluate((e) => (e.scrollTop = Math.min(600, e.scrollHeight - e.clientHeight)));
    if (left < 300) throw new Error(`the source is too short to leave a place in (${left}px)`);
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Back", exact: true }).first().click();
    await page.locator(".doc-head").filter({ hasText: TESTING }).waitFor({ state: "detached" });
    await tutor.getByRole("button", { name: `Source 4: ${TESTING}` }).click();
    await page.locator(".doc-head").filter({ hasText: TESTING }).waitFor();
    await until("a quote that is gone marks nothing", async () => (await active()) === "");
    await until("a quote that is gone opens the source where he left it", async () => (await scroll.evaluate((e) => e.scrollTop)) > left / 2);
  } finally {
    await page.unroute(/\/ore$/); // a failure here mustn't answer later journeys' tutor calls
  }
  await page.keyboard.press("Escape");
});

journey("tutor web citation: a page the tutor found on the web is a pill named for its site, shows the words on hover and opens in the browser", async (page) => {
  const url = "https://www.britannica.com/biography/Hermann-Ebbinghaus";
  await page.route(/\/ore$/, async (route) => {
    if (!(route.request().postData() ?? "").includes('"tutor",')) return route.fallback();
    const cite = { n: 1, url, title: "Hermann Ebbinghaus", site: "britannica.com", quote: "born on January 24, 1850", text: "born on January 24, 1850" };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: "Your sources don't say; he was born in 1850 [1].", citations: [cite], general: false, searched: true, hint: false, exercise: null, card: null, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@5" } }) });
  });
  await page.evaluate(() => {
    const t = (window as any).__TAURI_INTERNALS__;
    const invoke = ((window as any).__invoke = t.invoke);
    (window as any).__opened = [];
    t.invoke = (cmd: string, args: any) => (cmd.includes("opener") ? ((window as any).__opened.push(args?.url), Promise.resolve()) : invoke(cmd, args));
  });
  try {
    await page.keyboard.press("Meta+j");
    const tutor = page.getByRole("complementary", { name: "Tutor" });
    const fresh = tutor.getByRole("button", { name: "New chat" });
    if (await fresh.isEnabled()) await fresh.click();
    await page.getByRole("textbox", { name: "Message the tutor" }).fill("When was Ebbinghaus born?");
    await page.keyboard.press("Enter");
    // The pill is named for the site, and its card on hover shows the page and the words it holds.
    const pill = tutor.getByRole("button", { name: "Source 1: Hermann Ebbinghaus (britannica.com)" });
    await pill.getByText("britannica", { exact: true }).waitFor();
    await pill.hover();
    await page.locator(".cite-card").getByText("born on January 24, 1850").waitFor();
    // Typing re-renders the chat; the open card must not be remounted away.
    await page.getByRole("textbox", { name: "Message the tutor" }).pressSequentially("and", { delay: 30 });
    if (!(await page.locator(".cite-card").isVisible())) throw new Error("typing closed the citation's card");
    await page.getByRole("textbox", { name: "Message the tutor" }).fill("");
    await pill.click();
    await until("the page opens in the browser", async () => ((await page.evaluate(() => (window as any).__opened)) as string[]).includes(url));
  } finally {
    await page.unroute(/\/ore$/);
    await page.evaluate(() => { (window as any).__TAURI_INTERNALS__.invoke = (window as any).__invoke; });
  }
  await page.keyboard.press("Escape");
});

journey("tutor streaming: the reply shows as it is written (markers wait for the citations), a search says so, and the rest is typed in at a steady pace", async (page) => {
  let release = () => {};
  const held = new Promise<void>((r) => (release = r));
  let id = "";
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (!body.includes('"tutor",')) return route.fallback();
    id = (JSON.parse(body).args as string[]).find((a) => a.startsWith("--stream="))!.slice(9);
    await held;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: "Spacing beats cramming over a week.", citations: [], general: true, searched: true, hint: false, exercise: null, card: null, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@5" } }) });
  });
  try {
    await page.keyboard.press("Meta+j");
    const tutor = page.getByRole("complementary", { name: "Tutor" });
    const fresh = tutor.getByRole("button", { name: "New chat" });
    if (await fresh.isEnabled()) await fresh.click();
    await page.getByRole("textbox", { name: "Message the tutor" }).fill("Does spacing beat cramming?");
    await page.keyboard.press("Enter");
    await until("the call carries its stream id", async () => !!id);
    const emit = (p: object) => page.evaluate(([p]) => (window as any).__emit("ore-progress", p), [p] as const);
    await emit({ stream: "someone-else", reply: "Not this turn's words" });
    await emit({ stream: id, searching: true });
    await tutor.getByText("Searching the web…").waitFor();
    await emit({ stream: id, reply: "Spacing beats [1" });
    await tutor.getByText("Spacing beats", { exact: true }).waitFor();
    if (await tutor.getByText("Not this turn's words").count()) throw new Error("another turn's words landed here");
    if (await tutor.getByText("Searching the web…").count()) throw new Error("the wait stayed up under the words");
    // The rest of the reply is typed in at a steady pace, not dropped in whole (D321).
    await page.evaluate(() => {
      const seen: number[] = ((window as any).__typed = []);
      const box = document.querySelector('[aria-label="Tutor"] .ask-ai.newest .ask-text')!;
      new MutationObserver(() => seen.push(box.textContent!.length)).observe(box, { subtree: true, childList: true, characterData: true });
    });
    release();
    await tutor.getByText("Spacing beats cramming over a week.").waitFor();
    const typed = new Set((await page.evaluate(() => (window as any).__typed as number[])).filter((n) => n > "Spacing beats".length && n < "Spacing beats cramming over a week.".length));
    if (typed.size < 5) throw new Error(`the rest of the reply landed in ${typed.size + 1} steps, not typed in`);
  } finally {
    release();
    await page.unroute(/\/ore$/);
  }
  await page.keyboard.press("Escape");
});

journey("tutor scroll: a reply streaming in while he reads higher up leaves his place and offers New reply, which takes him down; sending follows the end again", async (page) => {
  let release = () => {};
  let held = Promise.resolve();
  let id = "";
  const long = Array.from({ length: 30 }, (_, i) => `Line ${i + 1} of a long explanation about spacing and retrieval.`).join("\n\n");
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (!body.includes('"tutor",')) return route.fallback();
    id = (JSON.parse(body).args as string[]).find((a) => a.startsWith("--stream="))!.slice(9);
    await held;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: long, citations: [], general: true, searched: false, hint: false, exercise: null, card: null, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@8" } }) });
  });
  try {
    await page.keyboard.press("Meta+j");
    const tutor = page.getByRole("complementary", { name: "Tutor" });
    const fresh = tutor.getByRole("button", { name: "New chat" });
    if (await fresh.isEnabled()) await fresh.click();
    const log = tutor.locator(".tutor-turns");
    const field = page.getByRole("textbox", { name: "Message the tutor" });
    const gap = () => log.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight);
    await field.fill("Explain spacing at length");
    await page.keyboard.press("Enter");
    await tutor.getByText("Line 30 of a long explanation", { exact: false }).waitFor();
    await until("the first reply is followed to its end", async () => (await gap()) < 24);
    // The next reply streams while he scrolls up to reread the first.
    held = new Promise<void>((r) => (release = r));
    id = "";
    await field.fill("And again");
    await page.keyboard.press("Enter");
    await until("the call carries its stream id", async () => !!id);
    await log.evaluate((el) => (el.scrollTop = 0));
    const emit = (p: object) => page.evaluate(([p]) => (window as any).__emit("ore-progress", p), [p] as const);
    await emit({ stream: id, reply: long.slice(0, 400) });
    await emit({ stream: id, reply: long.slice(0, 1200) });
    const pill = tutor.getByRole("button", { name: "New reply" });
    await pill.waitFor();
    if ((await log.evaluate((el) => el.scrollTop)) !== 0) throw new Error("the streaming reply moved him off what he was reading");
    release();
    await until("the whole reply landed", async () => (await tutor.getByText("Line 30 of a long explanation", { exact: false }).count()) === 2);
    if ((await log.evaluate((el) => el.scrollTop)) !== 0) throw new Error("the finished reply moved him");
    await pill.click();
    await until("New reply takes him to the end", async () => (await gap()) < 24);
    await pill.waitFor({ state: "detached" });
    // The page under the tutor never scrolled.
    if ((await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0)) !== 0) throw new Error("the page scrolled");
  } finally {
    release();
    await page.unroute(/\/ore$/);
  }
  await page.keyboard.press("Escape");
});

journey("tutor @: typing @ lists skills and sources, Enter writes the name in, and the message goes out pointed at it", async (page) => {
  await page.keyboard.press("Meta+j");
  const field = page.getByRole("textbox", { name: "Message the tutor" });
  await field.pressSequentially("What does @agen");
  const list = page.getByRole("listbox", { name: "Point the tutor at" });
  await list.getByRole("option", { name: new RegExp(AGENTS) }).waitFor();
  // Every row leads with an icon: a skill's own (or its dot), a page for a source.
  if ((await list.locator(".skill-icon, .tutor-mention-icon").count()) !== (await list.getByRole("option").count())) throw new Error("an @ row has no icon");
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

journey("tutor @ carries: a follow-up with no @ keeps the last @s, a new @ replaces them, New chat clears them and reopening the chat restores them, × drops one", async (page) => {
  const asked: string[][] = [];
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"tutor",')) return route.fallback();
    asked.push(JSON.parse(body).args);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: `Reply ${asked.length}`, citations: [], general: false, hint: false, exercise: null, card: null, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@4" } }) });
  });
  await page.keyboard.press("Meta+j");
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  const field = page.getByRole("textbox", { name: "Message the tutor" });
  const fresh = tutor.getByRole("button", { name: "New chat" });
  if (await fresh.isEnabled()) await fresh.click(); // an earlier journey's thread
  const chip = (name: string) => tutor.locator(".tutor-chip").filter({ hasText: `@${name}` });
  const send = async (before: string, at?: string, after = "") => {
    const n = asked.length;
    await field.pressSequentially(before);
    if (at) {
      await field.pressSequentially(at);
      await page.getByRole("listbox", { name: "Point the tutor at" }).getByRole("option").first().waitFor();
      await page.keyboard.press("Enter");
      await field.pressSequentially(after);
    }
    await page.keyboard.press("Enter");
    await tutor.getByText(`Reply ${n + 1}`).waitFor();
    return asked[n]!.join(" ");
  };
  if (!(await send("Explain ", "@learn", "spacing")).includes("--skill=learning")) throw new Error("the @ skill was not sent");
  await chip("learning").waitFor();
  if (!(await send("Show me")).includes("--skill=learning")) throw new Error("the follow-up lost the @ skill");
  const replaced = await send("Now ", "@Building", "please");
  if (!replaced.includes("--source=") || replaced.includes("--skill=learning")) throw new Error(`a new @ did not replace the old: ${replaced}`);
  await chip(AGENTS).waitFor();
  if (await chip("learning").count()) throw new Error("the replaced skill still shows");
  await fresh.click();
  await until("New chat clears it", async () => (await chip(AGENTS).count()) === 0);
  // The chat is saved (D172): picking it from the list brings it back with its @ context.
  await tutor.getByRole("button", { name: /^Chats/ }).click();
  await page.locator(".tutor-chats [cmdk-item]", { hasText: "Explain @learning spacing" }).first().click();
  await chip(AGENTS).waitFor(); // back with its thread
  await unchip(tutor, `Leave “${AGENTS}” out`);
  await until("× drops it", async () => (await chip(AGENTS).count()) === 0);
  if ((await send("And this?")).includes("--source=")) throw new Error("a dropped @ was still sent");
  await page.unroute(/\/ore$/);
  await page.keyboard.press("Meta+j");
});

journey("tutor skill page: opened on a skill's page it is scoped to that skill, a chip with its icon (not for a skill with no sources); Quiz me and ⌘K's ask take it; × leaves it out for that page, another skill page brings its own, an @ of the same skill isn't doubled, Try again sends what it sent; a source open shows the source's chip", async (page) => {
  const asked: string[][] = [];
  let fail = false;
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"tutor",')) return route.fallback();
    asked.push(JSON.parse(body).args);
    if (fail) return (fail = false), route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify("The AI is offline.") });
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: `Reply ${asked.length}`, citations: [], general: false, hint: false, exercise: null, card: null, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@4" } }) });
  });
  try {
    const tutor = page.getByRole("complementary", { name: "Tutor" });
    const field = page.getByRole("textbox", { name: "Message the tutor" });
    const fresh = tutor.getByRole("button", { name: "New chat" });
    const chips = tutor.locator(".tutor-chips .tutor-chip");
    const skillChip = (name: string) => chips.filter({ has: page.locator(".skill-icon") }).filter({ hasText: new RegExp(`^${name}$`) });
    const skillPage = async (name: RegExp) => {
      await page.getByRole("button", { name }).first().click();
      await page.locator(".skill-page").waitFor();
    };
    const reply = async (n: number) => { await tutor.getByText(`Reply ${n}`).waitFor(); return asked[n - 1]!; };
    const send = async (text: string, at?: string) => {
      const n = asked.length;
      await field.pressSequentially(text);
      if (at) {
        await field.pressSequentially(at);
        await page.getByRole("listbox", { name: "Point the tutor at" }).getByRole("option").first().waitFor();
        await page.keyboard.press("Enter");
      }
      await page.keyboard.press("Enter");
      return reply(n + 1);
    };
    const skillsIn = (args: string[]) => args.filter((a) => a.startsWith("--skill="));
    // A skill with no sources has nothing to search: no chip, nothing scoped.
    await skillPage(/^Distributed/);
    await page.keyboard.press("Meta+j");
    if (await fresh.isEnabled()) await fresh.click(); // an earlier journey's thread
    if (skillsIn(await send("Hi")).length) throw new Error("a skill with no sources was sent");
    if (await chips.count()) throw new Error(`a skill with no sources shows a chip: ${await chips.allTextContents()}`);
    await skillPage(/^Learning/);
    await skillChip("Learning").waitFor();
    if ((await chips.count()) !== 1) throw new Error(`want one chip, the skill's: ${await chips.allTextContents()}`);
    // Quiz me with no @ in effect takes the page's skill.
    const quiz = page.waitForRequest((r) => /"due","--start","--skill=learning"\]/.test(r.postData() ?? ""));
    await tutor.getByRole("button", { name: "Quiz me" }).click();
    await quiz;
    await page.locator(".review").waitFor();
    await page.keyboard.press("Escape");
    await until("Esc leaves Review", async () => (await page.locator(".review").count()) === 0);
    await skillChip("Learning").waitFor(); // the tutor stays open under Review, its chip with it
    // ⌘K's ask, sent from the skill's page, goes scoped to it.
    const n = asked.length;
    await page.keyboard.press("Meta+k");
    await page.keyboard.type("What is spacing?");
    await page.locator("[cmdk-item]").filter({ hasText: "Ask your library" }).first().click();
    const palette = await reply(n + 1);
    if (skillsIn(palette).join() !== "--skill=learning" || palette.some((a) => a.startsWith("--item="))) throw new Error(`⌘K's ask was not scoped to the skill: ${palette.join(" ")}`);
    if (skillsIn(await send("What else?")).join() !== "--skill=learning") throw new Error("the skill page's skill was not sent");
    // × leaves it out for this page, through a trip Home and back.
    await unchip(tutor, "Leave “Learning” out");
    await until("× takes the chip away", async () => (await skillChip("Learning").count()) === 0);
    if (skillsIn(await send("And this?")).length) throw new Error("a skill left out was still sent");
    await page.getByRole("button", { name: /^Home/ }).first().click();
    await skillPage(/^Learning/);
    await field.waitFor();
    if (await skillChip("Learning").count()) throw new Error("a skill he left out came back after a trip Home");
    // Another skill's page brings its own chip. He @s the same skill: one chip, sent once, and Try again sends just that.
    await skillPage(/^Teaching/);
    await skillChip("Teaching").waitFor();
    fail = true;
    const m = asked.length;
    await field.pressSequentially("Explain ");
    await field.pressSequentially("@Teach");
    await page.getByRole("listbox", { name: "Point the tutor at" }).getByRole("option").first().waitFor();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await tutor.getByRole("button", { name: "Try again" }).click();
    const again = await reply(m + 2);
    for (const args of [asked[m]!, again]) if (skillsIn(args).join() !== "--skill=teaching") throw new Error(`the skill went twice, or not at all: ${args.join(" ")}`);
    if ((await chips.count()) !== 1) throw new Error(`the page's skill and its @ show as two chips: ${await chips.allTextContents()}`);
    // With a source open, the source is the context, as before.
    await openSource(page, TESTING);
    await fresh.click();
    await chips.filter({ hasText: TESTING }).waitFor();
    if (await chips.locator(".skill-icon").count()) throw new Error("a skill chip shows beside the open source");
    if (!(await send("Why?")).some((a) => a.startsWith("--item="))) throw new Error("the open source was not sent");
  } finally {
    await page.unroute(/\/ore$/);
  }
  await page.keyboard.press("Escape");
});

journey("tutor stop and copy: the send button stops a reply (⌘. too), words written by then stay, none says Stopped with Try again, a late answer is ignored; Copy copies a reply (D187)", async (page) => {
  let id = "";
  const held: (() => void)[] = [];
  let cancelled = 0, calls = 0;
  await page.route(/\/cancel$/, (route) => (cancelled++, route.fallback()));
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"tutor",')) return route.fallback();
    const args = JSON.parse(body).args as string[];
    id = (args.find((x) => x.startsWith("--stream=")) ?? "").slice(9);
    const n = ++calls;
    if (args[1] !== "Answer me") await new Promise<void>((ok) => held.push(ok));
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: args[1] === "Answer me" ? "A whole reply." : `Reply ${n}`, citations: [], general: false, hint: false, exercise: null, card: null, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@12" } }) });
  });
  try {
    await page.keyboard.press("Meta+j");
    const tutor = page.getByRole("complementary", { name: "Tutor" });
    const fresh = tutor.getByRole("button", { name: "New chat" });
    if (await fresh.isEnabled()) await fresh.click();
    const field = page.getByRole("textbox", { name: "Message the tutor" });
    const stop = tutor.getByRole("button", { name: "Stop the reply" });
    // Nothing written yet: Stopped, with Try again.
    await field.fill("Stop me early");
    await page.keyboard.press("Enter");
    await stop.click();
    await tutor.getByText("Stopped.").waitFor();
    await tutor.getByRole("button", { name: "Try again" }).waitFor();
    await tutor.getByRole("button", { name: "Send" }).waitFor();
    await until("the run was cancelled", async () => cancelled === 1);
    held.shift()!();
    await page.waitForTimeout(300);
    if (await tutor.getByText("Reply 1").count()) throw new Error("a stopped reply landed anyway");
    // Try again on the stopped turn runs it anew, and that answer lands.
    await tutor.getByRole("button", { name: "Try again" }).click();
    await until("it asks again", async () => held.length === 1);
    held.shift()!();
    await tutor.getByText("Reply 2").waitFor();
    // Words already written stay as the reply; ⌘. stops from the keyboard.
    id = "";
    await field.fill("Stop me late");
    await page.keyboard.press("Enter");
    await until("the call carries its stream id", async () => !!id);
    await page.evaluate(([p]) => (window as any).__emit("ore-progress", p), [{ stream: id, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@12" } }] as const);
    await page.evaluate(([p]) => (window as any).__emit("ore-progress", p), [{ stream: id, reply: "Half a thought [1" }] as const);
    await tutor.getByText("Half a thought", { exact: true }).waitFor();
    await page.keyboard.press("Meta+.");
    await tutor.getByText("Stopped", { exact: true }).waitFor();
    await tutor.getByText("Half a thought", { exact: true }).waitFor();
    // Saved with who wrote it, as a whole reply is (F186).
    await until("the stopped reply is saved with its AI stamp", async () => {
      const chats = (await ore("chat")) as { id: string }[];
      const chat = (await ore("chat", chats[0]!.id)) as { turns: { reply?: string; ai?: { model: string } }[] };
      return chat.turns.some((t) => t.reply === "Half a thought" && t.ai?.model === "mock");
    });
    held.shift()!();
    await page.waitForTimeout(300);
    if (await tutor.getByText("Reply 3").count()) throw new Error("a stopped reply was replaced by the late one");
    // Copy puts a reply on the clipboard.
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await field.fill("Answer me");
    await page.keyboard.press("Enter");
    await tutor.getByText("A whole reply.").waitFor();
    await tutor.getByRole("button", { name: "Copy the reply" }).last().click();
    await until("the reply is on the clipboard", async () => (await page.evaluate(() => navigator.clipboard.readText())) === "A whole reply.");
  } finally {
    held.forEach((ok) => ok());
    await page.unroute(/\/ore$/);
    await page.unroute(/\/cancel$/);
  }
});

journey("tutor attach: the paperclip attaches an image and a text file as chips, × removes one, the message carries them and shows the picture, a follow-up still sends them, and a file it can't read is refused with why (D189)", async (page) => {
  const notes = join(mkdtempSync(join(tmpdir(), "ore-attach-")), "notes.txt");
  writeFileSync(notes, "spacing notes\n");
  const sent: string[][] = [];
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"tutor",')) return route.fallback();
    sent.push(JSON.parse(body).args as string[]);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: `Reply ${sent.length}`, citations: [], general: false, hint: false, exercise: null, card: null, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@14" } }) });
  });
  const pick = (paths: string[]) => page.evaluate((paths) => ((window as unknown as { __ORE_PICK: string[] }).__ORE_PICK = paths), paths);
  try {
    await page.keyboard.press("Meta+j");
    const tutor = page.getByRole("complementary", { name: "Tutor" });
    const fresh = tutor.getByRole("button", { name: "New chat" });
    if (await fresh.isEnabled()) await fresh.click();
    // The starters are rows, each with its icon.
    if ((await tutor.locator(".tutor-starters .menu-item svg").count()) !== 3) throw new Error("each starter row should lead with an icon");
    const attach = tutor.getByRole("button", { name: "Attach a file" });
    await pick([join(FIXTURES, "book.epub")]);
    await attach.click();
    await page.locator(".toast").getByText("the tutor can't read a .epub file").waitFor();
    await pick([join(FIXTURES, "screenshot.png"), notes]);
    await attach.click();
    await tutor.locator(".tutor-chip", { hasText: "screenshot.png" }).waitFor();
    await tutor.locator(".tutor-chip", { hasText: "notes.txt" }).waitFor();
    await unchip(tutor, "Remove “notes.txt”");
    await until("the removed file's chip goes", async () => (await tutor.locator(".tutor-chip", { hasText: "notes.txt" }).count()) === 0);
    const field = page.getByRole("textbox", { name: "Message the tutor" });
    await field.fill("What is in this picture?");
    await page.keyboard.press("Enter");
    await tutor.getByText("Reply 1").waitFor();
    const files = (args: string[]) => JSON.parse((args.find((x) => x.startsWith("--files=")) ?? "--files=[]").slice(8)) as { name: string; path: string }[];
    if (files(sent[0]!).map((f) => f.name).join() !== "screenshot.png" || !/^chats\/files\/[0-9a-f]{16}\.png$/.test(files(sent[0]!)[0]!.path)) throw new Error(`the message went without its file: ${sent[0]!.join(" ")}`);
    await until("his message shows the picture", async () => await tutor.locator(".ask-files img").evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0).catch(() => false));
    if (await tutor.locator(".ask-input .tutor-chip", { hasText: "screenshot.png" }).count()) throw new Error("a sent file stayed attached to the next message");
    // A follow-up has no file of its own, and the earlier turn's goes along.
    await field.fill("And the colours?");
    await page.keyboard.press("Enter");
    await tutor.getByText("Reply 2").waitFor();
    if (sent[1]!.some((x) => x.startsWith("--files="))) throw new Error("the follow-up carried a file it wasn't given");
    const earlier = JSON.parse(sent[1]!.find((x) => x.startsWith("--earlier="))!.slice(10)) as { files?: { name: string }[] }[];
    if (earlier[0]?.files?.[0]?.name !== "screenshot.png") throw new Error("the earlier turn's file was not sent with the follow-up");
    // Both turns name the chat they belong to, so the second picks up the first's session (D338).
    const chatOf = (args: string[]) => args.find((x) => x.startsWith("--chat="));
    if (!chatOf(sent[0]!) || chatOf(sent[0]!) !== chatOf(sent[1]!)) throw new Error(`the follow-up didn't name the chat its first message did: ${chatOf(sent[0]!)} then ${chatOf(sent[1]!)}`);
  } finally {
    await page.unroute(/\/ore$/);
  }
});

journey("tutor pending: closing mid-reply asks once; a new chat keeps its own reply, the old one lands in the old chat, which the list of chats opens with it", async (page) => {
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
  await tutor.getByText("Reading your sources…").waitFor();
  // D186: one mole by the field, and the newest bubble is the one with the tail.
  await tutor.locator(".tutor-mole .mole").waitFor();
  if ((await tutor.locator(".ask-ai.newest").count()) !== 1) throw new Error("the chat should mark exactly one newest reply");
  await page.keyboard.press("Escape");
  await until("Esc closes it", async () => (await tutor.count()) === 0);
  await page.keyboard.press("Meta+j");
  await tutor.getByText("Reading your sources…").waitFor();
  await page.waitForTimeout(400);
  if (asked.length !== 1) throw new Error(`reopening asked again: ${asked.length} requests`);
  // A new chat while it thinks: its own question gets its own reply.
  await fresh.click();
  if (await page.locator(".toast", { hasText: "Chat cleared" }).count()) throw new Error("New chat still says it cleared something");
  await field.fill("Second question");
  await page.keyboard.press("Enter");
  await tutor.getByText("Second reply").waitFor();
  const old = page.waitForResponse((r) => (r.request().postData() ?? "").includes('"First question"'));
  release!();
  await old;
  await page.waitForTimeout(300);
  if (await tutor.getByText("First reply").count()) throw new Error("the old reply landed in the new chat");
  await tutor.getByText("Second reply").waitFor();
  // The old chat is in the list, with the reply that landed while it was away (D172); the new one is too.
  const chats = tutor.getByRole("button", { name: /^Chats/ });
  await chats.click();
  await page.locator(".tutor-chats [cmdk-item]", { hasText: "First question" }).click();
  await tutor.getByText("First reply").waitFor();
  if (await tutor.getByText("Second question").count()) throw new Error("the old chat opened with the new one's turns");
  await chats.click();
  await page.locator(".tutor-chats [cmdk-item]", { hasText: "Second question" }).click();
  await tutor.getByText("Second reply").waitFor();
  if (await tutor.getByText("First question").count()) throw new Error("the new chat opened with the old one's turns");
  await page.unroute(/\/ore$/);
  await page.keyboard.press("Meta+j");
});

journey("tutor chats: every chat is saved and listed by day under its name; Find narrows the list, a click opens one, a reload keeps them, and a deleted chat comes back with Undo (D172)", async (page) => {
  const reply = (text: string, title: string) => JSON.stringify({ reply: text, citations: [], general: false, hint: false, exercise: null, card: null, title, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@12" } });
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"tutor",')) return route.fallback();
    const message = JSON.parse(body).args[1] as string;
    await route.fulfill({ contentType: "application/json", body: message.startsWith("Boxes") ? reply("Leitner boxes space cards out.", "Leitner boxes") : reply("Mixing topics helps you choose.", "Interleaving") });
  });
  try {
    await page.keyboard.press("Meta+j");
    const tutor = page.getByRole("complementary", { name: "Tutor" });
    const field = page.getByRole("textbox", { name: "Message the tutor" });
    const fresh = tutor.getByRole("button", { name: "New chat" });
    if (await fresh.isEnabled()) await fresh.click();
    const chats = tutor.getByRole("button", { name: /^Chats/ });
    if ((await chats.textContent()) !== "New chat") throw new Error("an empty chat isn't called New chat");
    await field.fill("Boxes: how do Leitner boxes work?");
    await page.keyboard.press("Enter");
    await tutor.getByText("Leitner boxes space cards out.").waitFor();
    // The tutor's first reply names the chat.
    await until("the reply names the chat", async () => (await chats.getAttribute("aria-label")) === "Chats: Leitner boxes");
    await fresh.click();
    await field.fill("Why interleave topics?");
    await page.keyboard.press("Enter");
    await tutor.getByText("Mixing topics helps you choose.").waitFor();
    await chats.click();
    const list = page.locator(".tutor-chats");
    await list.getByText("Today").waitFor();
    const rows = () => list.locator("[cmdk-item] .menu-label").allTextContents();
    const top = (await rows()).slice(0, 2);
    if (top.join("|") !== "Interleaving|Leitner boxes") throw new Error(`the newest chat isn't first: ${top}`);
    await page.keyboard.type("leit");
    await until("Find narrows the list", async () => (await rows()).join("|") === "Leitner boxes");
    await page.keyboard.press("Enter");
    await tutor.getByText("Leitner boxes space cards out.").waitFor();
    // A reload (a quit and relaunch) starts a new chat, and the saved ones are still listed.
    await page.reload();
    await page.waitForTimeout(1500);
    await page.keyboard.press("Meta+j");
    if ((await chats.textContent()) !== "New chat") throw new Error("a relaunch didn't start a new chat");
    await chats.click();
    await list.locator("[cmdk-item]", { hasText: "Interleaving" }).hover();
    await list.getByRole("button", { name: "Delete “Interleaving”" }).click();
    await until("the deleted chat leaves the list", async () => !(await rows()).includes("Interleaving"));
    await page.keyboard.press("Escape");
    await page.locator(".toast", { hasText: "Chat deleted" }).getByRole("button", { name: "Undo" }).click();
    await until("Undo puts it back", async () => {
      const r = await fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["chat"] }) }).then((x) => x.json());
      return (r as { title: string }[]).some((c) => c.title === "Interleaving");
    });
    await chats.click();
    await list.locator("[cmdk-item]", { hasText: "Interleaving" }).click();
    await tutor.getByText("Mixing topics helps you choose.").waitFor();
  } finally {
    await page.unroute(/\/ore$/);
  }
  await page.keyboard.press("Meta+j");
});

journey("tutor chats menu: Esc gives focus back to the chat's title, a click outside goes where it lands, a picked chat puts it in the field (ChatGPT, Claude)", async (page) => {
  await page.keyboard.press("Meta+j");
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  const chats = tutor.getByRole("button", { name: /^Chats/ });
  const list = page.locator(".tutor-chats");
  const focused = () => page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.tagName);
  const title = async () => (await chats.getAttribute("aria-label"))!;
  // A chat to pick.
  await page.getByRole("textbox", { name: "Message the tutor" }).fill("What is spacing?");
  await page.keyboard.press("Enter");
  await tutor.getByRole("button", { name: "Copy the reply" }).waitFor();
  await chats.click();
  await list.getByPlaceholder("Find a chat…").waitFor();
  await page.keyboard.press("Escape");
  await until("Esc closes the list, focus on its title", async () => (await list.count()) === 0 && (await focused()) === (await title()));
  if ((await tutor.count()) === 0) throw new Error("Esc in the chats list closed the tutor too");
  await chats.click();
  await list.getByPlaceholder("Find a chat…").waitFor();
  // A click outside goes where it lands (Radix): one click into the field closes the list and types there.
  await page.getByRole("textbox", { name: "Message the tutor" }).click();
  await until("a click in the field closes the list, focus in the field", async () => (await list.count()) === 0 && (await focused()) === "Message the tutor");
  await chats.click();
  await list.locator("[cmdk-item]").first().waitFor();
  await page.keyboard.press("Enter");
  await until("a picked chat puts focus in the field", async () => (await list.count()) === 0 && (await focused()) === "Message the tutor");
  await page.keyboard.press("Meta+j");
});

/** Types a second draft in a field just emptied by a send, then undoes and redoes it: the undo must take the
 *  draft back (so the check can't pass by doing nothing) and neither may bring back the sent "First …".
 *  ControlOrMeta: ⌘ on the Mac, Ctrl on CI's Linux, where WebKit's undo is Ctrl+Z. The bug this guards
 *  (WebKit redoing a cleared field's typing into the new draft) was seen on the Mac's WebKit. */
async function undoRedo(page: Page, field: Locator) {
  await page.keyboard.type("Second draft");
  await page.keyboard.press("ControlOrMeta+z");
  const undone = await field.inputValue();
  if (undone === "Second draft") throw new Error("⌘Z did nothing to the draft, so this check can't tell");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  const redone = await field.inputValue();
  for (const [what, v] of [["⌘Z", undone], ["⇧⌘Z", redone]] as const) if (v.includes("First")) throw new Error(`${what} brought the sent text back: “${v}”`);
  if (redone !== "Second draft") throw new Error(`⇧⌘Z didn't redo the draft: “${redone}”`);
}

journey("tutor field in WebKit: a sent message is not in the next draft's undo history, so ⌘Z and ⇧⌘Z never bring it back (ChatGPT, Claude)", async (page) => {
  await page.keyboard.press("Meta+j");
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  const fresh = tutor.getByRole("button", { name: "New chat" });
  if (await fresh.isEnabled()) await fresh.click();
  const field = page.getByRole("textbox", { name: "Message the tutor" });
  await field.pressSequentially("First message");
  await page.keyboard.press("Enter");
  await tutor.locator(".ask-me").getByText("First message").waitFor();
  await until("the sent message leaves the field, which keeps focus", async () => (await field.inputValue()) === "" && (await field.evaluate((el) => el === document.activeElement)));
  await undoRedo(page, field);
  await page.keyboard.press("Meta+j");
}, "webkit");

journey("Ask about this exercise in WebKit: a sent question is not in the next draft's undo history (ChatGPT, Claude)", async (page) => {
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"ask",')) return route.fallback();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: "Because recalling it is the practice.", proposal: null, session: "s1" }) });
  });
  try {
    await startReview(page, null);
    await reveal(page);
    await page.getByRole("button", { name: "Ask about this" }).click();
    const field = page.getByRole("textbox", { name: "Ask about this exercise" });
    await field.pressSequentially("First question");
    await page.keyboard.press("Enter");
    await page.locator(".review-chat").getByText("Because recalling it is the practice.").waitFor();
    await until("the field is empty and has focus", async () => (await field.inputValue()) === "" && (await field.evaluate((el) => el === document.activeElement)));
    await undoRedo(page, field);
  } finally {
    await page.unroute(/\/ore$/);
  }
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
}, "webkit");

journey("tutor chats: deleting a chat while its reply is being written keeps it deleted, with no error, and the new chat goes on (D172)", async (page) => {
  let release: (() => void) | undefined;
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"tutor",')) return route.fallback();
    await new Promise<void>((ok) => (release = ok));
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: "Late reply", citations: [], general: false, hint: false, exercise: null, card: null, title: "Doomed chat", ai: { vendor: "claude", model: "mock", prompt_version: "tutor@12" } }) });
  });
  const listed = async () => ((await fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["chat"] }) }).then((x) => x.json())) as { title: string }[]).map((c) => c.title);
  try {
    await page.keyboard.press("Meta+j");
    const tutor = page.getByRole("complementary", { name: "Tutor" });
    const fresh = tutor.getByRole("button", { name: "New chat" });
    if (await fresh.isEnabled()) await fresh.click();
    await page.getByRole("textbox", { name: "Message the tutor" }).fill("Doomed question");
    await page.keyboard.press("Enter");
    await until("the call is on its way", async () => !!release);
    await tutor.getByRole("button", { name: /^Chats/ }).click();
    const row = page.locator(".tutor-chats [cmdk-item]", { hasText: "Doomed question" }).first();
    await row.hover();
    await row.getByRole("button", { name: /^Delete/ }).click();
    await page.keyboard.press("Escape");
    await until("it is deleted", async () => !(await listed()).includes("Doomed question"));
    release!();
    await page.waitForTimeout(800);
    const names = await listed();
    if (names.includes("Doomed question") || names.includes("Doomed chat")) throw new Error("the late reply saved the deleted chat back");
    if (await page.locator(".toast", { hasText: "save the chat" }).count()) throw new Error("the late reply showed a save error");
    if (await tutor.getByText("Late reply").count()) throw new Error("the late reply landed in the new chat");
  } finally {
    release?.();
    await page.unroute(/\/ore$/);
  }
  await page.keyboard.press("Meta+j");
});

journey("tutor hints and cards: a hint offers Show me, which asks for the answer; + Exercise keeps the reply's exercise, ⌘Z takes it back", async (page) => {
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
  await tutor.getByRole("button", { name: /^Add exercise:/ }).click();
  await tutor.getByRole("button", { name: "Exercise added" }).waitFor();
  await kept;
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()); // out of the field, so ⌘Z is the app's
  await page.keyboard.press("Meta+z");
  await tutor.getByRole("button", { name: /^Add exercise:/ }).waitFor();
  await page.unroute(/\/ore$/);
  await page.keyboard.press("Meta+j");
});

journey("tutor steps: Show me's worked answer shows one step at a time, Next step adds the next, the last hands the field the focus, and the steps stay and go with the next message (D142)", async (page) => {
  await openSource(page, TESTING);
  const steps = ["The tested group pulled the facts out of memory.", "Pulling them out made the memory stronger.", "So a week later they **remembered more**."];
  const replies = [
    { reply: "Think about what the tested group did.", citations: [], general: false, hint: true, steps: [], exercise: null, card: null },
    { reply: "Here's the working.", citations: [], general: false, hint: false, steps, exercise: null, card: null },
    { reply: "Step 2 is the testing effect.", citations: [], general: false, hint: false, steps: [], exercise: null, card: null },
  ].map((r) => ({ ...r, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@8" } }));
  const bodies: string[] = [];
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"tutor",')) return route.fallback();
    bodies.push(body);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(replies.shift()) });
  });
  try {
    await page.keyboard.press("Meta+j");
    const tutor = page.getByRole("complementary", { name: "Tutor" });
    const fresh = tutor.getByRole("button", { name: "New chat" });
    if (await fresh.isEnabled()) await fresh.click();
    const field = page.getByRole("textbox", { name: "Message the tutor" });
    await field.fill("Why did the tested group remember more?");
    await page.keyboard.press("Enter");
    await tutor.getByRole("button", { name: "Show me" }).click();
    const shown = tutor.locator(".tutor-steps li");
    await shown.first().waitFor();
    if ((await shown.count()) !== 1) throw new Error(`Show me opened with ${await shown.count()} steps, not one`);
    // The step track (D150): one mark per step, the current one marked, the hidden ones plain dots.
    const track = tutor.getByRole("group", { name: "Step 1 of 3" });
    await track.waitFor();
    if ((await track.locator("button").count()) !== 1 || (await track.locator("i").count()) !== 2) throw new Error("the track didn't show one step of three");
    const next = tutor.getByRole("button", { name: "Next step" });
    await next.click();
    await until("Next step shows the second", async () => (await shown.count()) === 2 && (await shown.nth(1).innerText()).includes("stronger"));
    await until("the track moved to step 2", async () => (await tutor.getByRole("group", { name: "Step 2 of 3" }).locator("[aria-current=step]").getAttribute("aria-label")) === "Step 2");
    await tutor.getByRole("button", { name: "Step 1", exact: true }).click(); // a shown mark is a way back to its step
    // Closed and opened again, the steps he showed stay shown.
    await page.keyboard.press("Escape");
    await page.keyboard.press("Meta+j");
    await until("the steps came back as he left them", async () => (await shown.count()) === 2);
    // The next message carries the steps he has seen as what the tutor said, not the one still hidden.
    await field.fill("Why step 2?");
    await page.keyboard.press("Enter");
    await tutor.getByText("Step 2 is the testing effect.").waitFor();
    if (!bodies[2]!.includes("2. Pulling them out made the memory stronger.")) throw new Error("the follow-up didn't carry the steps");
    if (bodies[2]!.includes("remembered more")) throw new Error("the follow-up carried a step he hadn't seen");
    await next.click();
    await until("the last step shows", async () => (await shown.count()) === 3);
    await shown.nth(2).locator("strong").waitFor();
    if (await next.count()) throw new Error("Next step stayed after the last step");
    await until("the field has the focus", () => field.evaluate((f) => f === document.activeElement));
  } finally {
    await page.unroute(/\/ore$/);
  }
  await page.keyboard.press("Escape");
});

journey("tutor Show me: a half-written reply and its @ mention stay in the box while the hint's answer comes", async (page) => {
  await openSource(page, TESTING);
  const replies = [
    { reply: "Think about what the tested group did.", citations: [], general: false, hint: true, card: null },
    { reply: "They pulled it out of memory.", citations: [], general: false, hint: false, card: null },
    { reply: "Yes, that is the idea.", citations: [], general: false, hint: false, card: null },
  ].map((r) => ({ ...r, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@3" } }));
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"tutor",')) return route.fallback();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(replies.shift()) });
  });
  await page.keyboard.press("Meta+j");
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  const field = page.getByRole("textbox", { name: "Message the tutor" });
  const list = page.getByRole("listbox", { name: "Point the tutor at" });
  // A starter sent with the @ list open closes the list.
  await field.pressSequentially("@agen");
  await list.waitFor();
  await tutor.locator(".tutor-starters button").first().click();
  await tutor.getByRole("button", { name: "Show me" }).waitFor();
  if (await list.count()) throw new Error("the @ list stayed open after a starter went");
  await field.fill("");
  await field.pressSequentially("Like @agen");
  await list.getByRole("option", { name: new RegExp(AGENTS) }).waitFor();
  await page.keyboard.press("Enter");
  await field.pressSequentially("says?");
  const draft = `Like @${AGENTS} says?`;
  await tutor.getByRole("button", { name: "Show me" }).click();
  await tutor.getByText("They pulled it out of memory.").waitFor();
  if ((await field.inputValue()) !== draft) throw new Error(`Show me cleared the draft: "${await field.inputValue()}"`);
  const sent = page.waitForRequest((r) => (r.postData() ?? "").includes('"--source='));
  await field.focus();
  await page.keyboard.press("Enter");
  await sent; // the @ mention went with it
  await page.unroute(/\/ore$/);
  await page.keyboard.press("Meta+j");
});

journey("tutor Quiz me: opens Review on the due cards of the source's skills, and Esc comes back", async (page) => {
  await openSource(page, TESTING);
  await page.keyboard.press("Meta+j");
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  const sent = page.waitForRequest((r) => /"due","--start","--skill=learning","--skill=teaching"/.test(r.postData() ?? ""));
  await tutor.getByRole("button", { name: "Quiz me" }).click();
  await sent;
  await page.locator(".review").waitFor();
  await page.keyboard.press("Escape");
  await until("Esc leaves Review", async () => (await page.locator(".review").count()) === 0);
  await page.locator(".doc-head").filter({ hasText: TESTING }).waitFor(); // back on the source
});

journey("tutor Practice: an exercise is written in the source note with the source hidden, and ⌘↵ sends it back for feedback", async (page) => {
  await openSource(page, AGENTS); // not TESTING: the note block journey counts that note's headings
  const exercise = { heading: "Why does an agent need a stopping condition?", prompts: ["What goes wrong without one"], card: { kind: "prompt", content_type: "concept", question: "Why does an agent loop need a stopping condition?", answer: "Without one it runs until something else stops it.", rubric: ["It would run on without end", "The result is never returned"] } };
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

journey("tutor Practice: a tell apart's two cases sit side by side with a line each; Enter in A goes to B, Enter in B sends both (D163); the feedback marks each point and underlines his words (D162)", async (page) => {
  await openSource(page, AGENTS);
  const card = { kind: "prompt", content_type: "concept", question: "Which fits each: a support bot that follows fixed steps, or one that picks its own tools?", answer: "The first is a workflow, the second an agent.", rubric: ["Fixed steps make a workflow", "Choosing its own tools makes an agent"] };
  const cases = ["A support bot answers refunds by running the same four steps every time.", "A research bot decides which tools to call and when it is done."];
  const exercise = { heading: "Which idea fits each case, and what decides it?", prompts: ["Case A", "Case B"], card, cases };
  const replies = [
    { reply: "Tell these two apart.", citations: [], general: false, hint: false, exercise, card: null, marks: [] },
    { reply: "A is right. B: who decides the steps?", citations: [], general: false, hint: false, exercise: null, card, marks: [{ point: card.rubric[0], covered: true, quote: "same steps each time" }, { point: card.rubric[1], covered: false, quote: "" }] },
  ].map((r) => ({ ...r, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@12" } }));
  const asked: string[] = [];
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"tutor",')) return route.fallback();
    asked.push((JSON.parse(body) as { args: string[] }).args[1]!);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(replies.shift()) });
  });
  await page.keyboard.press("Meta+j");
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  const fresh = tutor.getByRole("button", { name: "New chat" });
  if (await fresh.isEnabled()) await fresh.click();
  await tutor.getByRole("button", { name: "Practice", exact: true }).click();
  const a = tutor.getByRole("region", { name: "Case A" }), b = tutor.getByRole("region", { name: "Case B" });
  await a.getByText(cases[0]!).waitFor();
  await b.getByText(cases[1]!).waitFor();
  const [boxA, boxB] = [await a.boundingBox(), await b.boundingBox()];
  if (!boxA || !boxB || Math.abs(boxA.y - boxB.y) > 2) throw new Error("the cases aren't side by side");
  await a.getByRole("textbox").click();
  await page.keyboard.type("A workflow: same steps each time");
  await page.keyboard.press("Enter");
  await until("Enter in A goes to B", async () => await b.getByRole("textbox").evaluate((el) => el === document.activeElement));
  await page.keyboard.type("An agent");
  // Closing the tutor mid-answer keeps both lines, as it keeps the chat box's draft.
  await tutor.getByRole("button", { name: "Close the tutor" }).click();
  await page.keyboard.press("Meta+j");
  if ((await a.getByRole("textbox").inputValue()) !== "A workflow: same steps each time" || (await b.getByRole("textbox").inputValue()) !== "An agent") throw new Error("closing the tutor lost the answers he was writing");
  await b.getByRole("textbox").click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await tutor.getByText("A is right. B: who decides the steps?").waitFor();
  if (asked[1] !== "A: A workflow: same steps each time\nB: An agent") throw new Error(`sent: ${JSON.stringify(asked[1])}`);
  if (await a.getByRole("textbox").count()) throw new Error("the answer lines stay once he has answered");
  const got = tutor.getByRole("listitem", { name: /^Got: Fixed steps make a workflow/ });
  await got.hover();
  await tutor.locator(".ask-me .quiz-evidence", { hasText: "same steps each time" }).waitFor();
  await tutor.getByRole("listitem", { name: "Missed: Choosing its own tools makes an agent" }).focus();
  await until("a missed point marks nothing", async () => (await tutor.locator(".ask-me .quiz-evidence").count()) === 0);
  await tutor.getByRole("button", { name: /^Add exercise/ }).waitFor(); // the committed card, offered after the miss (D158)
  await page.unroute(/\/ore$/);
  await page.keyboard.press("Meta+j");
});

journey("tutor: words selected in a reply go into the source note as a quote, Undo takes them out; Exercise asks the tutor for one from them (D164)", async (page) => {
  await openSource(page, AGENTS);
  const said = "An agent decides its own next step, and a workflow follows steps written in advance.";
  const asked: string[] = [];
  let item = "";
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"tutor",')) return route.fallback();
    const args = (JSON.parse(body) as { args: string[] }).args;
    asked.push(args[1]!);
    item ||= args.find((a) => a.startsWith("--item="))!.slice(7);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: `${said} That is the whole difference.`, citations: [], general: false, hint: false, exercise: null, card: null, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@12" } }) });
  });
  await page.keyboard.press("Meta+j");
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  const fresh = tutor.getByRole("button", { name: "New chat" });
  if (await fresh.isEnabled()) await fresh.click();
  await tutor.getByRole("textbox", { name: "Message the tutor" }).fill("agent or workflow?");
  await page.keyboard.press("Enter");
  const reply = tutor.locator("[data-reply] p").filter({ hasText: said }).last();
  await reply.waitFor();
  const pick = () => reply.evaluate((p, words) => {
    const node = p.firstChild!;
    const at = node.textContent!.indexOf(words);
    const r = document.createRange();
    r.setStart(node, at);
    r.setEnd(node, at + words.length);
    const sel = document.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(r);
  }, said);
  await pick();
  const bar = tutor.getByRole("toolbar", { name: "Selected words" });
  await bar.getByRole("button", { name: "Into note" }).click();
  await page.locator(".toast", { hasText: "Added to your note" }).waitFor();
  if (await bar.count()) throw new Error("the toolbar stays after Into note");
  const note = async () => ((await ore("notes", item)) as { text: string }).text;
  await until("the note has the quote under From the tutor", async () => (await note()).includes(`## From the tutor\n\n> ${said}`));
  await page.locator(".toast", { hasText: "Added to your note" }).getByRole("button", { name: "Undo" }).click();
  await until("Undo takes it out", async () => !(await note()).includes(said));
  await pick();
  await bar.getByRole("button", { name: "Exercise" }).click();
  await until("Exercise asks the tutor for one from the words", async () => asked.at(-1) === `Make an exercise from this: “${said}”`);
  await page.unroute(/\/ore$/);
  await page.keyboard.press("Meta+j");
});

journey("tutor versions: Try another reply keeps the first under ‹ 1 / 2 ›, Edit and ↑ put his last message back in a field, and the versions are saved with the chat (D201)", async (page) => {
  await openSource(page, TESTING);
  await page.keyboard.press("Meta+j");
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  const field = page.getByRole("textbox", { name: "Message the tutor" });
  const asked = () => page.waitForRequest((r) => (r.postData() ?? "").includes('"tutor",'));
  await field.fill("Why does this work?");
  await page.keyboard.press("Enter");
  await tutor.locator(".cite").first().waitFor();
  const pager = tutor.locator(".ask-versions");
  if (await pager.count()) throw new Error("one reply shows a pager");
  // Another reply: the first is kept, the new one shows.
  let sent = asked();
  await tutor.getByRole("button", { name: "Try another reply" }).click();
  if (!(await sent).postData()!.includes('"Why does this work?"')) throw new Error("Try another reply sent another message");
  await pager.getByText("2 / 2").waitFor();
  await pager.getByRole("button", { name: "Previous version" }).click();
  await pager.getByText("1 / 2").waitFor();
  if (!(await pager.getByRole("button", { name: "Previous version" }).isDisabled())) throw new Error("Previous is live on the first version");
  // Edit: his message in a field, Esc leaves it, Enter sends the new words as a third version.
  await tutor.locator(".ask-me").hover();
  await tutor.getByRole("button", { name: "Edit your message" }).click();
  const edit = page.getByRole("textbox", { name: "Edit your message" });
  if ((await edit.inputValue()) !== "Why does this work?") throw new Error("the field doesn't hold his message");
  await page.keyboard.press("Escape");
  await tutor.locator(".ask-me", { hasText: "Why does this work?" }).waitFor();
  if (!(await tutor.isVisible())) throw new Error("Esc in the edit field closed the tutor");
  // ↑ in the empty field opens the same edit.
  await field.focus();
  await page.keyboard.press("ArrowUp");
  await edit.fill("Why does this work, simply?");
  sent = asked();
  await page.keyboard.press("Enter");
  if (!(await sent).postData()!.includes('"Why does this work, simply?"')) throw new Error("the edited message was not what was sent");
  await pager.getByText("3 / 3").waitFor();
  await tutor.locator(".ask-me", { hasText: "Why does this work, simply?" }).waitFor();
  await pager.getByRole("button", { name: "Previous version" }).click();
  await tutor.locator(".ask-me", { hasText: /^Why does this work\?$/ }).waitFor();
  // Saved with the chat: a restart shows the same version with the others behind it.
  const id = ((await ore("chat")) as { id: string }[])[0]!.id;
  await until("the chat holds all three versions", async () => {
    const c = (await ore("chat", id)) as { turns: { message: string; alt?: number; alts?: { message: string }[] }[] };
    return c.turns.length === 1 && c.turns[0]!.alt === 1 && c.turns[0]!.alts?.length === 2 && c.turns[0]!.alts[1]!.message === "Why does this work, simply?";
  });
  await ore("chat", id, "--delete");
});

journey("tutor: put away with ⌘J while he types in the note, the words stay in the note; Esc gives focus back to the mole that opened it, or opened from nothing", async (page) => {
  await openSource(page, TESTING);
  await page.keyboard.press("Meta+j");
  await page.getByLabel("Message the tutor").waitFor();
  const note = page.locator(".note-editor [contenteditable=true]").first();
  await until("the note takes the caret", async () => (await note.click(), await note.evaluate((e) => e.contains(document.activeElement))));
  await page.keyboard.press("Meta+ArrowDown");
  await page.keyboard.type("Typed before ");
  await page.keyboard.press("Meta+j");
  await page.locator("aside.tutor").waitFor({ state: "detached" });
  await page.keyboard.type("and after.");
  await until("every word lands in the note", async () => (await note.innerText()).includes("Typed before and after."));
  const mole = page.locator(".tutor-bubble");
  await mole.focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Message the tutor").waitFor();
  await page.keyboard.press("Escape");
  await until("Esc gives focus back to the mole", () => mole.evaluate((el) => el === document.activeElement));
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Meta+j");
  await page.getByLabel("Message the tutor").waitFor();
  await page.keyboard.press("Escape");
  await until("opened from nothing, Esc gives focus to the mole", () => mole.evaluate((el) => el === document.activeElement));
  // Leave the note as it was.
  await note.click();
  await page.keyboard.press("Meta+ArrowDown");
  await page.keyboard.press("Backspace", { delay: 0 });
  for (let n = 1; n < "Typed before and after.".length; n++) await page.keyboard.press("Backspace");
  await until("the note is as it was", async () => !(await note.innerText()).includes("Typed before"));
});

journey("tutor: New chat after a chat that could not be saved saves it first, and it is in Chats (Codex UX sweep 2)", async (page) => {
  await page.getByRole("button", { name: "Open the tutor" }).click();
  await page.evaluate(() => {
    const g = window as unknown as Record<string, unknown>;
    g.__ORE_FAIL = { chat: "Test: chat write refused" };
    g.__ORE_REPLY = { tutor: { reply: "Recall it first, without the source in front of you.", citations: [], general: true, steps: [], marks: [], title: "Unsaved learning chat", ai: { vendor: "codex", model: "mock", prompt: "tutor", version: 1 } } };
  });
  try {
    await page.getByRole("textbox", { name: "Message the tutor" }).fill("How do I start a study hour?");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.getByText("Recall it first, without the source in front of you.").waitFor();
    await page.locator("[role=alert], .toast").filter({ hasText: /chat write refused/ }).first().waitFor();
    await page.evaluate(() => ((window as unknown as Record<string, unknown>).__ORE_FAIL = {}));
    await page.getByRole("button", { name: "New chat", exact: true }).click();
    await page.getByRole("button", { name: "Chats", exact: true }).click();
    await page.getByText("Unsaved learning chat").first().waitFor({ timeout: 4000 });
    // And it opens again from there, with its reply.
    await page.getByText("Unsaved learning chat").first().click();
    await page.getByText("Recall it first, without the source in front of you.").waitFor();
  } finally {
    await page.evaluate(() => { const g = window as unknown as Record<string, unknown>; g.__ORE_FAIL = {}; delete g.__ORE_REPLY; });
    await page.keyboard.press("Escape").catch(() => {});
  }
});

journey("tutor: a chat whose save keeps failing stays at the first New chat, and a second New chat leaves it (code review of #493)", async (page) => {
  await page.getByRole("button", { name: "Open the tutor" }).click();
  await page.evaluate(() => {
    const g = window as unknown as Record<string, unknown>;
    g.__ORE_FAIL = { chat: "Test: chat write refused" };
    g.__ORE_REPLY = { tutor: { reply: "Space the practice out over days.", citations: [], general: true, steps: [], marks: [], title: "A stuck chat", ai: { vendor: "codex", model: "mock", prompt: "tutor", version: 1 } } };
  });
  try {
    await page.getByRole("textbox", { name: "Message the tutor" }).fill("How should I space practice?");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const reply = page.getByText("Space the practice out over days.");
    await reply.waitFor();
    await page.getByRole("button", { name: "New chat", exact: true }).click();
    await page.locator("[role=alert], .toast").filter({ hasText: "isn’t saved" }).first().waitFor();
    if (!(await reply.isVisible())) throw new Error("the first New chat dropped a chat it couldn't save");
    await page.getByRole("button", { name: "New chat", exact: true }).click();
    await until("a second New chat leaves it", async () => !(await reply.isVisible()));
  } finally {
    await page.evaluate(() => { const g = window as unknown as Record<string, unknown>; g.__ORE_FAIL = {}; delete g.__ORE_REPLY; });
    await page.keyboard.press("Escape").catch(() => {});
  }
});

journey("tutor: a chat list that can't be read says so with Try again, not No chats yet (Codex UX sweep 9)", async (page) => {
  await page.getByRole("button", { name: "Open the tutor" }).click();
  await page.evaluate(() => ((window as unknown as Record<string, unknown>).__ORE_FAIL = { chat: "The library is busy" }));
  try {
    await page.getByRole("button", { name: "Chats", exact: true }).click();
    await page.getByText("Couldn’t read your chats").waitFor({ timeout: 3000 });
    if (await page.getByText("No chats yet").count()) throw new Error("a failed read said No chats yet");
    await page.evaluate(() => ((window as unknown as Record<string, unknown>).__ORE_FAIL = {}));
    await page.getByRole("option", { name: "Try again" }).click();
    await until("the error goes once the read works", async () => !(await page.getByText("Couldn’t read your chats").count()));
  } finally {
    await page.evaluate(() => ((window as unknown as Record<string, unknown>).__ORE_FAIL = {}));
    await page.keyboard.press("Escape").catch(() => {});
    await page.keyboard.press("Escape").catch(() => {});
  }
});

// Last: they add headings and a diagram to AGENTS' note, which earlier journeys lay out.
/** Clicks just inside the end of an element's last line of text, where a click puts the caret after its last letter. */
async function clickAtEnd(page: Page, el: Locator) {
  const at = await el.evaluate((e) => {
    const walk = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
    let last: Text | null = null;
    for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) if (n.data.length) last = n;
    if (!last) return null;
    const r = document.createRange();
    r.setStart(last, last.data.length - 1);
    r.setEnd(last, last.data.length);
    const b = r.getBoundingClientRect();
    return { x: b.right - 1, y: b.top + b.height / 2 };
  });
  if (!at) throw new Error("no text to click the end of");
  await page.mouse.click(at.x, at.y);
}

/** Whether the caret sits after the last letter of `el`. */
const caretAtEndOf = (el: Locator) =>
  el.evaluate((e) => {
    const s = getSelection();
    if (!s?.isCollapsed || !s.anchorNode || !e.contains(s.anchorNode)) return false;
    const r = document.createRange();
    r.selectNodeContents(e);
    r.setStart(s.anchorNode, s.anchorOffset);
    return r.toString() === "";
  });

journey("tutor Practice: an answer under a renamed heading, and a diagram-only answer, both reach the tutor; an empty one is refused in place", async (page) => {
  await openSource(page, AGENTS);
  const exercise = (heading: string) => ({ heading, prompts: ["Your answer"] });
  const reply = (r: string, ex: ReturnType<typeof exercise> | null) => ({ reply: r, citations: [], general: false, hint: false, exercise: ex, card: null, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@4" } });
  const replies = [
    reply("Name the loop an agent runs.", exercise("What loop does an agent run?")),
    reply("Good. Now draw it.", exercise("Draw the agent loop")),
    reply("That diagram has the loop.", exercise("Draw the stopping condition")),
    reply("Fine.", null),
  ];
  const bodies: string[] = [];
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"tutor",')) return route.fallback();
    bodies.push(body);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(replies.shift()) });
  });
  await page.keyboard.press("Meta+j");
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  const fresh = tutor.getByRole("button", { name: "New chat" });
  if (await fresh.isEnabled()) await fresh.click();
  await tutor.getByRole("button", { name: "Practice", exact: true }).click();
  // A written answer under a heading he renamed.
  await tutor.getByRole("button", { name: "Write it in your note" }).click();
  const head = page.locator(".note-editor h2", { hasText: "What loop does an agent run?" });
  await head.waitFor();
  // The caret goes where he would click, checked each time: line-end keys differ by platform, and on CI's
  // Linux an End once left it at the heading's start, so the rename and the answer both went into the heading.
  await clickAtEnd(page, head);
  await until("the caret is at the heading's end", () => caretAtEndOf(head));
  await page.keyboard.type(" (my words)");
  const answer = page.locator(".note-editor .ghost").first();
  await answer.click();
  await until("the caret is in the answer line", () => answer.evaluate((el) => !!getSelection()?.anchorNode && el.contains(getSelection()!.anchorNode)));
  await page.keyboard.type("It acts, observes the result and decides again.");
  await page.keyboard.press("Meta+Enter");
  await tutor.getByText("Good. Now draw it.").waitFor();
  if (!bodies[1]?.includes("It acts, observes the result and decides again.")) throw new Error(`the renamed heading's answer wasn't sent: ${bodies[1]}`);
  // An answer that is only a diagram.
  await tutor.getByRole("button", { name: "Write it in your note" }).click();
  await page.locator(".note-editor h2", { hasText: "Draw the agent loop" }).waitFor();
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData("text/plain", "![Diagram](diagrams/agent-loop.excalidraw)");
    const at = getSelection()!.anchorNode!;
    (at instanceof Element ? at : at.parentElement!).dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await until("the diagram is in the note", async () => (await page.locator(".note-editor .note-diagram").count()) > 0);
  await page.keyboard.press("Meta+Enter");
  await tutor.getByText("That diagram has the loop.").waitFor();
  if (!bodies[2]?.includes("diagrams/agent-loop.excalidraw")) throw new Error(`the diagram answer wasn't sent: ${bodies[2]}`);
  // Nothing written: he is told, nothing is sent, and he stays in the exercise, source still hidden.
  await tutor.getByRole("button", { name: "Write it in your note" }).click();
  await page.locator(".note-editor h2", { hasText: "Draw the stopping condition" }).waitFor();
  await page.keyboard.press("Meta+Enter");
  await page.getByText("Nothing written, so nothing was sent.").waitFor();
  await page.waitForTimeout(300);
  if (bodies.length !== 3) throw new Error(`an empty answer was sent: ${bodies.length}`);
  if (await tutor.count()) throw new Error("an empty answer left the exercise");
  await page.locator(".reader-pane.hidden-src").waitFor();
  await page.locator(".note-editor h2", { hasText: "Draw the stopping condition" }).waitFor();
  await page.keyboard.type("When the goal is met or a limit is hit.");
  await page.keyboard.press("Meta+Enter");
  await tutor.getByText("Fine.").waitFor();
  if (!bodies[3]?.includes("When the goal is met or a limit is hit.")) throw new Error(`the answer after an empty try wasn't sent: ${bodies[3]}`);
  await page.unroute(/\/ore$/);
  await page.keyboard.press("Meta+j");
});

journey("tutor Practice: Write it in your note puts the exercise in the source it was asked about, not the one open now", async (page) => {
  await openSource(page, AGENTS);
  const exercise = { heading: "When should an agent stop?", prompts: ["Your answer"] };
  const replies = [
    { reply: "Say when an agent should stop.", citations: [], general: false, hint: false, exercise, card: null },
    { reply: "Yes: when the goal is met or a limit is hit.", citations: [], general: false, hint: false, exercise: null, card: null },
  ].map((r) => ({ ...r, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@4" } }));
  const bodies: string[] = [];
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"tutor",')) return route.fallback();
    bodies.push(body);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(replies.shift()) });
  });
  await page.keyboard.press("Meta+j");
  const tutor = page.getByRole("complementary", { name: "Tutor" });
  const fresh = tutor.getByRole("button", { name: "New chat" });
  if (await fresh.isEnabled()) await fresh.click();
  await tutor.getByRole("button", { name: "Practice", exact: true }).click();
  await tutor.getByRole("button", { name: "Write it in your note" }).waitFor();
  const item = /"--item=([^"]+)"/.exec(bodies[0] ?? "")?.[1];
  if (!item) throw new Error(`no source on the exercise: ${bodies[0]}`);
  await openSource(page, TESTING);
  await tutor.getByRole("button", { name: "Write it in your note" }).click();
  await page.locator(".doc-head").filter({ hasText: AGENTS }).waitFor(); // back on the exercise's source
  await page.locator(".note-editor h2", { hasText: exercise.heading }).waitFor();
  await page.keyboard.type("When the goal is met.");
  await page.keyboard.press("Meta+Enter");
  await tutor.getByText("Yes: when the goal is met or a limit is hit.").waitFor();
  if (!bodies[1]?.includes("When the goal is met.") || !bodies[1].includes(`"--item=${item}"`)) throw new Error(`the answer went with another source: ${bodies[1]}`);
  await page.unroute(/\/ore$/);
  await page.keyboard.press("Meta+j");
});

// F320: a reply's formula showed as its TeX, dollars, backslashes and braces.
journey("math in a reply: the tutor and Review's Ask draw an AI's formulas, on their own line and inline, and a price stays a price", async (page) => {
  const reply = "The logistic curve:\n\n$$\\frac{1}{1+e^{-x}}$$\n\nInline, $E=mc^2$ for $5 a copy.";
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !(body.includes('"tutor",') || body.includes('"ask",'))) return route.fallback();
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(body.includes('"ask",') ? { reply, proposal: null, session: "s1" } : { reply, citations: [], general: true, hint: false, exercise: null, card: null, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@16" } }) });
  });
  const drawn = async (where: string, root: ReturnType<typeof page.locator>) => {
    await root.locator(".katex-display .katex").first().waitFor();
    // The reply is typed out (D321): its last words come within half a second.
    await root.getByText("a copy", { exact: false }).waitFor({ timeout: 3000 }).catch(() => {});
    const text = (await root.innerText()).replace(/\s+/g, " ");
    if (/\$\$|\\frac|\^\{/.test(text)) throw new Error(`${where} shows the TeX: ${text}`);
    if (!(await root.locator(".katex").filter({ hasText: "mc" }).count())) throw new Error(`${where} left inline math as text`);
    if (!text.includes("for $5 a copy")) throw new Error(`${where} took a price for math`);
  };
  try {
    await page.keyboard.press("Meta+j");
    const tutor = page.getByRole("complementary", { name: "Tutor" });
    const fresh = tutor.getByRole("button", { name: "New chat" });
    if (await fresh.isEnabled()) await fresh.click();
    await page.getByRole("textbox", { name: "Message the tutor" }).fill("What is the logistic curve?");
    await page.keyboard.press("Enter");
    await drawn("the tutor", tutor.locator(".ask-ai").last());
    await page.keyboard.press("Escape");
    await startReview(page, null);
    await reveal(page);
    await page.getByRole("button", { name: "Ask about this" }).click();
    await page.getByRole("textbox", { name: "Ask about this exercise" }).fill("Show me the formula");
    await page.keyboard.press("Enter");
    await drawn("Review's Ask", page.locator(".review-chat"));
  } finally {
    await page.unroute(/\/ore$/);
  }
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.locator(".review").waitFor({ state: "detached" });
});

journey("a chat he had elsewhere: nothing is asked before it, and its first step is recalling it closed-book (D339)", async (page) => {
  const { createItem, updateItemMeta } = (await import(join(import.meta.dir, "../../../../packages/core/src/index.ts"))) as { createItem: (lib: { root: string }, d: object) => Promise<{ meta: { id: string } }>; updateItemMeta: (lib: { root: string }, id: string, f: (m: object) => object) => Promise<unknown> };
  const made = await createItem({ root: LIB }, { type: "article", title: "A chat about liens", url: "https://claude.ai/share/00000000-0000-4000-8000-000000000000", author: "Claude", chat: "claude", body: "## What is a lien?\n\nA claim on the settlement by someone who paid for the client's care.\n\n## Who is paid first?\n\nThe lien holders, before the client. Which of them would you call first, and why?" });
  await updateItemMeta({ root: LIB }, made.meta.id, (m) => ({ ...m, prequestions: [{ q: "Who holds a lien?" }] }));
  try {
    await page.reload();
    await openSource(page, "A chat about liens");
    const line = page.getByText("What do you remember from this chat?");
    await line.waitFor();
    if (await page.getByText("Who holds a lien?").count()) throw new Error("a chat he was in asked what he already knows before reading it");
    // Opened, it is a source he is reading: the toolbar's Reading for chip would list the question too.
    await page.waitForTimeout(600);
    if (await page.locator(".reading-for").count()) throw new Error("the Reading for chip shows on a chat, and leads to a block that isn't there");
    await page.getByRole("button", { name: "Recall" }).click();
    await page.getByText("What do you remember from “A chat about liens”?").waitFor();
    await until("the line steps aside while he recalls", async () => (await line.count()) === 0);
    await page.keyboard.press("Escape");
  } finally {
    await ore("archive", made.meta.id).catch(() => {});
  }
});

journey("tutor: a message sent while a reply is being written waits, goes when the reply lands, and comes back to the field if he edits it or stops the reply (D301)", async (page) => {
  const held: (() => void)[] = [];
  const asked: string[] = [];
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"tutor",')) return route.fallback();
    const args = JSON.parse(body).args as string[];
    asked.push(args[1]!);
    await new Promise<void>((ok) => held.push(ok));
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ reply: `Reply to ${args[1]}`, citations: [], general: false, hint: false, exercise: null, card: null, ai: { vendor: "claude", model: "mock", prompt_version: "tutor@12" } }) }).catch(() => {}); // a stopped reply's request is already gone
  });
  try {
    await page.keyboard.press("Meta+j");
    const tutor = page.getByRole("complementary", { name: "Tutor" });
    const fresh = tutor.getByRole("button", { name: "New chat" });
    if (await fresh.isEnabled()) await fresh.click();
    const field = page.getByRole("textbox", { name: "Message the tutor" });
    const waiting = tutor.locator(".ask-queued");
    await field.fill("First question");
    await page.keyboard.press("Enter");
    await tutor.getByRole("button", { name: "Stop the reply" }).waitFor();
    // Sent mid-reply: it waits in sight, the field is his again, and nothing has been asked yet.
    await field.fill("Second question");
    await page.keyboard.press("Enter");
    await waiting.filter({ hasText: "Second question" }).waitFor();
    if ((await field.inputValue()) !== "") throw new Error("the field kept the message that is waiting");
    if (asked.length !== 1) throw new Error(`the waiting message was asked early: ${asked.join(", ")}`);
    // The pencil puts it back in the field; sent again, it waits again.
    await waiting.getByRole("button", { name: "Edit the waiting message" }).click();
    await until("the waiting message is back in the field", async () => (await field.inputValue()) === "Second question" && (await waiting.count()) === 0);
    await page.keyboard.press("Enter");
    await waiting.waitFor();
    // The reply lands: the waiting message goes as his next turn.
    held.shift()!();
    await tutor.getByText("Reply to First question").waitFor();
    await until("the waiting message is asked once the reply lands", async () => asked.length === 2 && asked[1] === "Second question" && (await waiting.count()) === 0);
    // A message waiting on a reply he stops comes back to the field instead of going.
    await field.fill("Third question");
    await page.keyboard.press("Enter");
    await waiting.filter({ hasText: "Third question" }).waitFor();
    await tutor.getByRole("button", { name: "Stop the reply" }).click();
    await until("stopping gives the waiting message back", async () => (await field.inputValue()) === "Third question" && (await waiting.count()) === 0);
    if ((asked.length as number) !== 2) throw new Error("a message waiting on a stopped reply was sent");
    await field.fill("");
  } finally {
    held.forEach((ok) => ok());
    await page.unroute(/\/ore$/);
  }
  await page.keyboard.press("Escape");
});

// F329: a reply that came back empty left "Reading your sources…" up for good, the waiting message stuck
// under it, and Stop did nothing.
journey("tutor: a reply that comes back empty says so with Try again and gives the waiting message back", async (page) => {
  const held: (() => void)[] = [];
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"tutor",')) return route.fallback();
    await new Promise<void>((ok) => held.push(ok));
    await route.fulfill({ contentType: "application/json", body: "null" }).catch(() => {});
  });
  try {
    await page.keyboard.press("Meta+j");
    const tutor = page.getByRole("complementary", { name: "Tutor" });
    const fresh = tutor.getByRole("button", { name: "New chat" });
    if (await fresh.isEnabled()) await fresh.click();
    const field = page.getByRole("textbox", { name: "Message the tutor" });
    await field.fill("Explain this part");
    await page.keyboard.press("Enter");
    await tutor.getByRole("button", { name: "Stop the reply" }).waitFor();
    await field.fill("Keep my follow up");
    await page.keyboard.press("Enter");
    await tutor.locator(".ask-queued").filter({ hasText: "Keep my follow up" }).waitFor();
    await until("the request went", async () => held.length === 1);
    held.shift()!();
    await tutor.getByRole("button", { name: "Try again" }).waitFor();
    await until("the wait ends and the waiting message is back in the field", async () => (await field.inputValue()) === "Keep my follow up" && (await tutor.locator(".ask-queued").count()) === 0 && (await tutor.getByRole("button", { name: "Stop the reply" }).count()) === 0);
    await field.fill("");
  } finally {
    held.forEach((ok) => ok());
    await page.unroute(/\/ore$/);
  }
  await page.keyboard.press("Escape");
});

// F330: Ask about this with an empty answer replaced Review with "This view hit a snag".
journey("Ask about this: an answer that comes back empty says so with Try again, and Review stays", async (page) => {
  await page.evaluate(() => ((window as unknown as { __ORE_REPLY: unknown }).__ORE_REPLY = { ask: null }));
  try {
    await startReview(page, null);
    await reveal(page);
    const question = await page.locator(".review-q").textContent();
    await page.getByRole("button", { name: "Ask about this" }).click();
    const ask = page.getByRole("region", { name: "Ask about this" });
    // The exercise may hold an earlier chat (it comes back with the exercise), so the question is typed, not a starter.
    const field = ask.getByRole("textbox");
    await field.fill("Make this exercise clearer");
    await field.press("Enter");
    await ask.getByRole("button", { name: "Try again" }).waitFor();
    if (await page.getByText("This view hit a snag").count()) throw new Error("the view crashed");
    if ((await page.locator(".review-q").textContent()) !== question) throw new Error("the exercise left the screen");
  } finally {
    await page.evaluate(() => ((window as unknown as { __ORE_REPLY: unknown }).__ORE_REPLY = {}));
  }
});
