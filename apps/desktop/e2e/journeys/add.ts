import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Locator } from "playwright";
import { BRIDGE, FIXTURES, journey, LIB, openSource, ore, type Rigged, TESTING, until } from "../harness";

journey("add pasted text: it opens in the reader", async (page) => {
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill("# Interleaving in practice\n\nMixing problem types forces you to choose a strategy each time, which is what a test asks of you. Blocked practice feels smoother but teaches less.");
  await page.keyboard.press("Enter");
  await page.locator(".doc").getByText("Mixing problem types forces you").waitFor();
});

journey("add a pasted ChatGPT answer: its headings and table come in, which its plain text loses", async (page) => {
  await page.getByRole("button", { name: "+ Add" }).click();
  const box = page.getByLabel("Link, file path or text");
  const text = "Gaps that work\nReview a little each day, and let the gaps grow as the answers come easily.\nTest in\tBest gap\nOne year\tThree to four weeks";
  const html = "<meta charset='utf-8'><h2>Gaps that work</h2><p>Review a little each day, and let the gaps grow as the answers come easily.</p><table><thead><tr><th>Test in</th><th>Best gap</th></tr></thead><tbody><tr><td>One year</td><td>Three to four weeks</td></tr></tbody></table>";
  await box.evaluate((el, [text, html]) => {
    const dt = new DataTransfer();
    dt.setData("text/plain", text!);
    dt.setData("text/html", html!);
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, [text, html]);
  await box.fill(text); // a synthetic paste inserts nothing: the text the paste would have put in
  await page.keyboard.press("Enter");
  await page.locator(".doc table").getByText("Three to four weeks").waitFor();
  await page.locator(".doc h2").getByText("Gaps that work").waitFor();
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

journey("a recording added from a file offers Reimport, and one that can't be heard again here keeps its transcript and highlights (F181)", async (page) => {
  await openSource(page, "Lecture 4");
  await page.locator(".player.audio").waitFor();
  const text = await page.locator(".doc").innerText();
  await page.locator(".doc-head h1").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Reimport" }).click();
  // The cloud can't hear speech, and the Mac hears no words in the lecture's tone: either way it says so.
  const said = page.locator(".toast").filter({ hasText: "Its transcript is as it was" });
  await said.waitFor({ timeout: 30_000 });
  if ((await said.innerText()).includes("paste")) throw new Error("a failed Reimport told him to paste a transcript");
  if ((await page.locator(".doc").innerText()) !== text) throw new Error("a failed Reimport changed the transcript");
  await until("both highlights stay", async () => (await page.locator(".player.audio .scrub-tick").count()) === 2);
});

journey("an episode with its page kept: one click adds the page's text below the transcript, the button goes, ⌘Z takes the text out and the button comes back (D219)", async (page) => {
  const lecture = ((await ore("ls")) as { id: string; title: string }[]).find((i) => i.title.startsWith("Lecture 4"))!;
  const dir = ((await ore("show", lecture.id)) as { dir: string }).dir;
  const button = page.getByRole("button", { name: "Add the page’s text" });
  const doc = page.locator(".doc");
  // A recording with no page kept has nothing to add.
  await openSource(page, "Lecture 4");
  await page.locator(".player.audio").waitFor();
  if (await button.count()) throw new Error("a recording with no page offered its text");
  const article = "<p>" + "Spacing your practice tests across days makes what you recall last for months. ".repeat(10) + "</p>";
  writeFileSync(join(dir, "page.html"), `<html><head><title>Lecture 4</title></head><body><article><h1>Lecture 4</h1><h2>Show notes</h2>${article}</article></body></html>`);
  try {
    await openSource(page, TESTING);
    await openSource(page, "Lecture 4");
    await button.click();
    // From the click until the text shows, the button never comes back to be clicked twice.
    for (const end = Date.now() + 5000; !(await doc.getByRole("heading", { name: "From the page" }).count()); await Bun.sleep(20)) {
      if (await button.count()) throw new Error("the button came back before the page's text showed");
      if (Date.now() > end) throw new Error("timed out: the page's text shows");
    }
    await doc.getByRole("heading", { name: "Show notes" }).waitFor();
    await until("the button goes once the text is in", async () => (await button.count()) === 0);
    await page.mouse.click(5, 300);
    await page.keyboard.press("Meta+z");
    await until("⌘Z takes the page's text out", async () => (await doc.getByRole("heading", { name: "From the page" }).count()) === 0);
    await button.waitFor();
  } finally {
    // Later journeys read the lecture as seeded: its text without the page's, whatever failed here.
    const now = (await ore("show", lecture.id)) as { page_added?: string };
    if (now.page_added) await ore("page-text", lecture.id, "--undo", now.page_added);
    rmSync(join(dir, "page.html"), { force: true });
  }
});

journey("Add: Esc puts focus back on the + Add or Add a source that opened it, on Home, the Feed and a skill page", async (page) => {
  const roundTrip = async (where: string, button: Locator) => {
    await button.focus();
    await page.keyboard.press("Enter");
    await page.getByLabel("Link, file path or text").waitFor();
    await page.keyboard.press("Escape");
    await until(`${where}: focus is back on what opened Add`, () => button.evaluate((el) => el === document.activeElement));
  };
  await page.locator(".home-goal").waitFor();
  await roundTrip("Home", page.getByRole("button", { name: "+ Add" }));
  await page.getByRole("button", { name: /^Feed/ }).click();
  await roundTrip("Feed", page.getByRole("button", { name: "+ Add" }));
  await page.locator(".sidebar div.side-item .side-main").first().click();
  await page.locator(".skill-page").waitFor();
  await roundTrip("a skill page", page.getByRole("button", { name: /Add a source/ }).first());
});

journey("a source's link to a file on the computer says Ore doesn't open it, not an empty name (Codex sweep 3, hostile)", async (page) => {
  const title = "A page with a local link";
  const made = (await fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich"], stdin: `# ${title}\n\nSee [the local file](file:///Users/tyler/notes.txt) for more.` }) }).then((r) => r.json())) as { id: string };
  try {
    await page.reload();
    await openSource(page, title);
    await page.locator(".doc a", { hasText: "the local file" }).click();
    await page.locator(".toast", { hasText: "Ore doesn’t open this kind of link" }).waitFor();
    if (await page.locator(".toast", { hasText: "“”" }).count()) throw new Error("the toast names an empty file");
  } finally {
    await ore("archive", made.id).catch(() => {});
  }
});

journey("add: a draft left with Esc comes back with the skills he picked for it (Codex UX sweep 4)", async (page) => {
  const box = page.getByRole("dialog", { name: "Add a source", exact: true });
  const field = box.getByLabel("Link, file path or text");
  await page.keyboard.press("Meta+KeyN");
  await field.fill("a thought to file under Learning");
  await box.locator(".add-skills button").first().click();
  await page.getByRole("option", { name: /Learning/ }).first().click();
  await page.keyboard.press("Escape"); // the picker
  await box.locator(".add-skills").filter({ hasText: "Learning" }).waitFor();
  await page.keyboard.press("Escape"); // the box
  await box.waitFor({ state: "detached" });
  await page.keyboard.press("Meta+KeyN");
  await field.waitFor();
  try {
    await box.locator(".add-skills").filter({ hasText: "Learning" }).waitFor({ timeout: 3000 });
  } finally {
    await field.fill("");
    await page.keyboard.press("Escape");
  }
});

journey("add box: a feed's own link followed by ↵ at once follows it, without waiting for the preview", async (page) => {
  const day = new Date(Date.now() - 864e5).toUTCString();
  const server = Bun.serve({ port: 0, fetch: () => new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>Quick Notes</title><link>http://localhost/</link><item><title>One post</title><link>http://localhost/a.html</link><pubDate>${day}</pubDate></item></channel></rss>`, { headers: { "content-type": "application/rss+xml" } }) });
  const feed = `http://localhost:${server.port}/feed.xml`;
  try {
    await page.getByRole("button", { name: "+ Add" }).click();
    await page.getByLabel("Link, file path or text").fill(feed);
    await page.keyboard.press("Enter");
    await until("the feed is followed", async () => ((await ore("feed")) as { feeds: { url: string }[] }).feeds.some((f) => f.url === feed), 6000);
    if (await page.getByText("not one episode or post").count()) throw new Error("the box refused a feed link it can follow");
    // The same link, offered as the one he copied: ↵ follows it too.
    await ore("feed", "unfollow", feed);
    await page.keyboard.press("Escape");
    await page.evaluate((u) => (window as unknown as { __copy: (t: string) => Promise<void> }).__copy(u), feed);
    await page.getByRole("button", { name: "+ Add" }).click();
    await page.getByText("The link you copied").waitFor();
    await page.keyboard.press("Enter");
    await until("the copied feed link is followed", async () => ((await ore("feed")) as { feeds: { url: string }[] }).feeds.some((f) => f.url === feed), 6000);
  } finally {
    await ore("feed", "unfollow", feed).catch(() => {});
    server.stop(true);
  }
});

journey("add box: File waits while an add is going in, so nothing picked meanwhile is dropped", async (page) => {
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill("# A slow add\n\nIt takes its time going in.");
  await page.evaluate(() => void ((window as unknown as Rigged).__ORE_SLOW = { add: 1200 }));
  await page.keyboard.press("Enter");
  const file = page.getByRole("button", { name: "File", exact: true });
  const usable = await file.isEnabled();
  await page.evaluate(() => void ((window as unknown as Rigged).__ORE_SLOW = undefined));
  await page.locator(".doc").getByText("It takes its time going in").waitFor();
  if (usable) throw new Error("File can be picked while an add is going in, and what is picked is dropped");
});

journey("course added again: the toast's Undo archives only the lessons the add brought back, Redo brings back only those (F576)", async (page) => {
  if (!LIB) throw new Error("this journey edits the library: set ORE_LIBRARY to the running mock's");
  const { updateItemMeta } = (await import(join(import.meta.dir, "../../../../packages/core/src/items.ts"))) as { updateItemMeta: (lib: { root: string }, id: string, patch: (m: object) => object) => Promise<unknown> };
  const made = (await Promise.all(["A", "B"].map((n) => fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich", "--json"], stdin: `# Re-add part ${n}\n\nA lesson.` }) }).then((r) => r.json())))) as { id: string }[];
  const link = "https://www.youtube.com/playlist?list=PLreaddcourse";
  for (const [i, m] of made.entries()) await updateItemMeta({ root: LIB }, m.id, (x) => ({ ...x, course: { id: "readd-course", title: "Re-add course", part: i + 1, url: link } }));
  await ore("archive", made[1]!.id);
  const archivedOf = async () => {
    const gone = (await ore("ls", "--archived")) as { id: string }[];
    return made.map((m) => gone.some((i) => i.id === m.id)).join("/");
  };
  // The course page is on the web: the add answers as `ore add --course` does when the course is here, having
  // brought back its archived lesson B.
  await page.route(/\/ore$/, async (route) => {
    if (!(route.request().postData() ?? "").includes('"--course"')) return route.fallback();
    await ore("archive", made[1]!.id, "--undo");
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ course: { id: "readd-course", title: "Re-add course", url: link }, lessons: [], kept: 2, filled: [], failed: [], filed: [], restored: [made[1]!.id], enrich: "skipped", skills: [], first: { id: made[0]!.id, title: "Re-add part A", status: "inbox" } }) });
  });
  try {
    await page.getByRole("button", { name: "+ Add" }).click();
    await page.getByLabel("Link, file path or text").fill(link);
    await page.keyboard.press("Enter");
    const toast = page.locator(".toast").filter({ hasText: "“Re-add course” is back from Archived" });
    await toast.waitFor();
    if ((await archivedOf()) !== "false/false") throw new Error("the add did not bring lesson B back");
    await toast.getByRole("button", { name: "Undo" }).click();
    await until("Undo archives only the lesson the add brought back", async () => (await archivedOf()) === "false/true");
    await page.waitForTimeout(400);
    if ((await archivedOf()) !== "false/true") throw new Error("Undo of the course added again archived a lesson it did not bring back");
    await ore("archive", made[0]!.id);
    await page.locator(".toast").getByRole("button", { name: "Redo" }).first().click();
    await until("Redo brings back only that lesson", async () => (await archivedOf()) === "true/false");
  } finally {
    await page.unroute(/\/ore$/);
    if (await page.getByLabel("Link, file path or text").count()) await page.keyboard.press("Escape");
    for (const m of made) await ore("archive", m.id).catch(() => {});
  }
});

journey("add: the footer's ↵ Add is a button, so a pointer adds typed text; ↵ Follow follows a feed's own link (sweep 5, F306)", async (page) => {
  await page.getByRole("button", { name: "+ Add" }).click();
  const box = page.getByRole("dialog", { name: "Add a source", exact: true });
  await box.getByLabel("Link, file path or text").fill("# Added by pointer\n\nA pointer user adds what he typed with one click on the footer's Add.");
  await box.getByRole("button", { name: /^↵\s*Add$/ }).click();
  await page.locator(".doc").getByText("A pointer user adds what he typed").waitFor();
  const stamp = Date.now();
  const server = Bun.serve({ port: 0, fetch: () => new Response(`<?xml version="1.0"?><rss version="2.0"><channel><title>Pointer ${stamp}</title><link>http://localhost/</link><item><title>Pointer post ${stamp}</title><link>http://localhost/p</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`, { headers: { "content-type": "application/rss+xml" } }) });
  const url = `http://localhost:${server.port}/feed.xml`;
  try {
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await page.getByRole("button", { name: "+ Add" }).click();
    await box.getByLabel("Link, file path or text").fill(url);
    await box.getByRole("button", { name: /^↵\s*Follow$/ }).click();
    await box.waitFor({ state: "detached" });
    await until("the feed is followed", async () => ((await ore("feed")) as { feeds: { url: string }[] }).feeds.some((f) => f.url === url));
  } finally {
    await ore("feed", "unfollow", url).catch(() => {});
    server.stop();
  }
});

journey("add: after a click on ↵ Add that fails, the caret is back in the box (sweep 5 review)", async (page) => {
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL?: Record<string, string> }).__ORE_FAIL = { add: "The disk is full" }));
  await page.getByRole("button", { name: "+ Add" }).click();
  const box = page.getByRole("dialog", { name: "Add a source", exact: true });
  const field = box.getByLabel("Link, file path or text");
  await field.fill("# Will fail\n\nThis text fails to add.");
  await box.getByRole("button", { name: /^↵\s*Add$/ }).click();
  await box.getByRole("alert").waitFor();
  await until("focus is back in the box", () => field.evaluate((f) => document.activeElement === f));
  await page.evaluate(() => delete (window as unknown as { __ORE_FAIL?: unknown }).__ORE_FAIL);
  await page.keyboard.press("Escape");
});

journey("add: a refused link says why on a line of its own, as wide as the box (F387)", async (page) => {
  const gone = Bun.serve({ port: 0, fetch: () => new Response("gone", { status: 404 }) });
  try {
    await page.getByRole("button", { name: "+ Add" }).click();
    const box = page.getByRole("dialog", { name: "Add a source", exact: true });
    await box.getByLabel("Link, file path or text").fill(`http://localhost:${gone.port}/a/long/path/to/an-article-about-spacing-and-memory?utm_source=newsletter`);
    await page.keyboard.press("Enter");
    const why = box.getByRole("alert");
    await why.waitFor();
    const [err, foot, add] = await Promise.all([why.boundingBox(), box.locator(".panel-foot").boundingBox(), box.getByRole("button", { name: /^↵\s*Add$/ }).boundingBox()]);
    if (err!.width < foot!.width * 0.85) throw new Error(`the reason is ${Math.round(err!.width)}px wide in a ${Math.round(foot!.width)}px box`);
    if (add!.y < err!.y + err!.height) throw new Error("the buttons sit beside the reason, not under it");
    await page.keyboard.press("Escape");
    await box.waitFor({ state: "detached" });
  } finally {
    gone.stop(true);
  }
});

// F449: Esc or a click outside threw away what was typed in the Add box, where the tutor's field, a Finish
// recall and a Review answer keep theirs.
journey("add: what he typed and left with Esc is there, selected, at the next ⌘N; it goes once added or cleared (F449)", async (page) => {
  const box = page.getByRole("dialog", { name: "Add a source", exact: true });
  const field = box.getByLabel("Link, file path or text");
  const openBox = async () => { await page.keyboard.press("Meta+KeyN"); await field.waitFor(); };
  const title = `Kept words ${Date.now()}`;
  try {
    await openBox();
    await field.fill("half a thought about spacing");
    await page.keyboard.press("Escape");
    await box.waitFor({ state: "detached" });
    await openBox();
    if ((await field.inputValue()) !== "half a thought about spacing") throw new Error(`the box came back with "${await field.inputValue()}", not what he typed`);
    await until("what he left is selected whole", () => field.evaluate((f: HTMLTextAreaElement) => document.activeElement === f && f.selectionStart === 0 && f.selectionEnd === f.value.length));
    await page.keyboard.type(`# ${title}`);
    if ((await field.inputValue()) !== `# ${title}`) throw new Error("typing did not replace what he left");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("Spacing beats cramming.");
    await page.locator(".overlay").click({ position: { x: 5, y: 5 } });
    await box.waitFor({ state: "detached" });
    await openBox();
    if (!(await field.inputValue()).startsWith(`# ${title}`)) throw new Error("a click outside dropped what he typed");
    await page.keyboard.press("Enter");
    await box.waitFor({ state: "detached" });
    await openBox();
    if ((await field.inputValue()) !== "") throw new Error(`what was added came back in the box: "${await field.inputValue()}"`);
    await field.fill("soon gone");
    await field.fill("");
    await page.keyboard.press("Escape");
    await box.waitFor({ state: "detached" });
    await openBox();
    if ((await field.inputValue()) !== "") throw new Error("a box he emptied came back with words");
    await page.keyboard.press("Escape");
  } finally {
    const made = ((await ore("ls")) as { id: string; title: string }[]).find((i) => i.title === title);
    if (made) await ore("archive", made.id).catch(() => {});
  }
});

// F478: a source he just added is still opening when he presses ⌘N again; once its text was ready the
// reader took the keys from the Add box, so what he typed next went nowhere and Esc did not close the box.
journey("add: a source that finishes opening under the Add box leaves the keys in the box (F478)", async (page) => {
  const box = page.getByRole("dialog", { name: "Add a source", exact: true });
  const field = box.getByLabel("Link, file path or text");
  const title = `Opens under the box ${Date.now()}`;
  const slow = (ms?: number) => page.evaluate((ms) => ((window as unknown as { __ORE_SLOW?: object }).__ORE_SLOW = ms ? { show: ms } : undefined), ms);
  try {
    await page.keyboard.press("Meta+KeyN");
    await field.fill(`# ${title}\n\nThe keys stay where he is typing.`);
    await slow(700);
    await page.keyboard.press("Enter");
    await box.waitFor({ state: "detached" });
    await page.keyboard.press("Meta+KeyN");
    await field.waitFor();
    await page.locator(".reader-scroll .doc").getByText("The keys stay where he is typing.").waitFor();
    await Bun.sleep(300); // a long text is ready a little after it shows
    await slow();
    if (!(await field.evaluate((f) => document.activeElement === f))) throw new Error(`the keys left the Add box for ${await page.evaluate(() => document.activeElement?.className)}`);
    await page.keyboard.type("still here");
    if ((await field.inputValue()) !== "still here") throw new Error("typing did not reach the Add box");
    await field.fill("");
    await page.keyboard.press("Escape");
    await box.waitFor({ state: "detached" });
    await until("with the box gone the keys are the source's", () => page.evaluate(() => !!document.activeElement?.closest(".reader-scroll")));
  } finally {
    await slow();
    const made = ((await ore("ls")) as { id: string; title: string }[]).find((i) => i.title === title);
    if (made) await ore("archive", made.id).catch(() => {});
  }
});
