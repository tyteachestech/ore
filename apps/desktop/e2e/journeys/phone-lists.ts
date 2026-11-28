import { type Locator, type Page, type Route } from "playwright";
import { join } from "node:path";
import { readdirSync, readFileSync } from "node:fs";
import { addHighlight, createItem, openLibrary, setNotes } from "../../../../packages/core/src/index";
import { AGENTS, fits44, itemFile, journey, keyboardUp, macChanges, pasteInto, PHONE_LIB, phoneReaderReady, phoneSource, phoneWith, press, swipe, tap, TESTING, until, tapFact } from "../harness";

journey("phone: Today's list titles are 17 pt and the bar's buttons are 44 pt rounds (iPhone sizing A)", async (page) => {
  await page.locator(".home-read").first().waitFor();
  const size = await page.locator(".home-read .title").first().evaluate((e) => getComputedStyle(e).fontSize);
  if (size !== "17px") throw new Error(`Continue reading titles are ${size}, the Mac's size; iOS lists are 17 pt`);
  const bar = await page.locator(".phone-bar .phone-back").first().evaluate((e) => { const r = e.getBoundingClientRect(); return [r.width, r.height, getComputedStyle(e).borderRadius]; });
  if (bar[0] !== 44 || bar[1] !== 44 || !String(bar[2]).startsWith("999")) throw new Error(`the bar's menu button is ${bar[0]}×${bar[1]}, radius ${bar[2]}: want a 44 pt round`);
}, "phone");

journey("phone: renaming a low Continue reading row on Today keeps the field above the keyboard (F71)", async (page) => {
  // Today's lower rows sat where the keyboard comes up, and only the reader and the drawer lifted their fields.
  const rows = page.locator(".home-read");
  await rows.nth(2).waitFor();
  await press(page, rows.last());
  await tap(page, page.getByRole("menuitem", { name: "Rename…" }));
  const field = page.locator(".home-read input");
  await field.waitFor();
  await keyboardUp(page, 500);
  await until("the rename field is above the keyboard", async () => {
    const b = await field.boundingBox();
    return !!b && b.y + b.height <= 844 - 500 + 0.5;
  });
}, "phone");

journey("phone: Remove on a link still being read takes it off at once (F79)", async (page) => {
  // The remove waited its turn behind the read of a link that hung, so the tap showed nothing for 15 s.
  const held: Route[] = [];
  await page.route("https://example.com/articles/slow", (r) => void held.push(r)); // never answers
  await tap(page, page.getByRole("button", { name: "Add a source", exact: true }));
  await page.locator(".add-link .field").fill("https://example.com/articles/slow");
  await tap(page, page.getByRole("button", { name: "Add", exact: true }));
  await page.locator(".add-link").waitFor({ state: "detached" });
  const row = page.locator(".phone-waiting").filter({ hasText: "example.com/articles/slow" });
  await tap(page, row.getByRole("button", { name: "Remove" }));
  await row.waitFor({ state: "detached", timeout: 1000 });
  // The hung read is let go, so the journey leaves no call in flight (the phone build counts its calls too, F477).
  for (const r of held) await r.abort();
}, "phone");

journey("phone: a jump from Sections puts the heading below the Back bar, not under it (F73)", async (page) => {
  // The jump put the heading 24pt under the scroller's top, which on the phone is under the floating Back bar.
  await phoneSource(page, TESTING);
  await tap(page, page.locator(".read-pill"));
  await tap(page, page.locator(".sections-sheet .pick-row").last());
  await page.locator(".sections-sheet").waitFor({ state: "detached" });
  await until("the heading is in sight below the bar", () =>
    page.evaluate(() => {
      const bar = document.querySelector(".phone-source > .phone-bar")!.getBoundingClientRect();
      const hs = [...document.querySelectorAll(".phone-reader .doc :is(h1, h2, h3)")];
      const h = hs[hs.length - 1]!.getBoundingClientRect();
      (window as unknown as { __jump: unknown }).__jump = { top: h.top, bar: bar.bottom, hs: hs.map((x) => x.textContent) };
      return h.top >= bar.bottom && h.top < innerHeight / 2;
    }),
  ).catch(async (e) => { throw new Error(`${e.message}: ${JSON.stringify(await page.evaluate(() => (window as unknown as { __jump: unknown }).__jump))}`); });
}, "phone");

journey("phone: Today in a library with nothing to read says to add a first source with + (F74)", async (page) => {
  // A first launch showed a zero ring and "All caught up. Read something new." with nothing to say how.
  await page.evaluate(async () => {
    const core = (await import("/src/phone/core.ts" as string)) as { run: <T>(args: string[], input: string | null) => Promise<T> };
    const all = await core.run<{ id: string }[]>(["ls", "--json"], null);
    for (const i of all) await core.run(["archive", i.id, "--json"], null);
  });
  await Bun.sleep(1000); // the page's writes reach IndexedDB in the background
  await page.reload();
  await page.locator(".phone-app").waitFor();
  await page.locator(".empty-state").filter({ hasText: "Nothing to read yet. Add a link, any text, a file or a photo with +." }).waitFor();
  if (await page.getByText("Read something new").count()) throw new Error("Today says to read something new in a library with nothing to read");
}, "phone");

journey("phone: a Sources row is a small picture, the title, a line of how long it is and who made it, and its skills at the right (Matter)", async (page) => {
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Sources" }));
  await page.locator(".phone-sources li button .phone-lined").first().waitFor();
  for (const t of [1, 28 / 17]) {
    await page.evaluate((t) => document.documentElement.style.setProperty("--type", String(t)), t);
    const bad = await page.locator(".phone-sources li button:not(.phone-course)").evaluateAll((rows) => rows.flatMap((row) => {
      const r = row.getBoundingClientRect(), pic = row.querySelector(".phone-thumb")!.getBoundingClientRect();
      const title = row.querySelector(".phone-lined > span")!, line = row.querySelector<HTMLElement>(".phone-lined > small");
      const skills = row.querySelector(".phone-row-skills")?.getBoundingClientRect();
      const name = title.textContent!.slice(0, 30), out: string[] = [];
      if (Math.round(pic.width) !== 44 || Math.round(pic.height) !== 44) out.push(`${name}: the picture is ${Math.round(pic.width)}×${Math.round(pic.height)}`);
      if (r.height < 44) out.push(`${name}: the row is ${Math.round(r.height)} pt tall`);
      if (line && (line.getBoundingClientRect().top < title.getBoundingClientRect().bottom - 1 || line.scrollHeight > line.clientHeight + 2)) out.push(`${name}: the line under the title is not one line under it`);
      if (skills && (skills.right > r.right + 1 || skills.left < title.getBoundingClientRect().right)) out.push(`${name}: its skills are not at the row's right, clear of the title`);
      return out;
    }));
    if (bad.length) throw new Error(`at text size ${t.toFixed(2)}: ${bad.join("; ")}`);
  }
  const lines = await page.locator(".phone-sources section").first().locator(".phone-lined > small").allInnerTexts();
  if (!lines.some((l) => /^\d+ min( left)?( · .+)?$/.test(l))) throw new Error(`no To read row says how long it is: ${lines.slice(0, 5).join(" | ")}`);
  if (!(await page.locator(".phone-sources .phone-row-skills .skill-icon").count())) throw new Error("no row shows a skill's icon");
}, "phone");

journey("phone: under a Today title one line says how long is left and where the source is from, as the Mac's rows do (D341)", async (page) => {
  await page.locator(".home-read .title").first().waitFor();
  for (const t of [1, 28 / 17]) {
    await page.evaluate((t) => document.documentElement.style.setProperty("--type", String(t)), t);
    const rows = await page.locator(".home-read").evaluateAll((els) => els.map((row) => {
      const [title, meta, r] = [row.querySelector(".title")!.getBoundingClientRect(), row.querySelector(".home-meta")!.getBoundingClientRect(), row.getBoundingClientRect()];
      const parts = [...row.querySelectorAll<HTMLElement>(".home-meta > :is(.home-left, .home-site, .home-by, .course-of)")].map((c) => ({ text: c.textContent ?? "", box: c.getBoundingClientRect() }));
      const onLine = parts.filter((c) => c.box.top < meta.bottom - 2);
      return {
        name: row.querySelector(".title")!.textContent!.slice(0, 30),
        line: onLine.map((c) => c.text).join(" | "),
        // Under the title, in the row, and nothing on the line cut to a stub: what doesn't fit drops whole.
        under: meta.top >= title.bottom - 1 && Math.abs(meta.left - title.left) <= 1 && meta.bottom <= r.bottom + 1,
        stubs: onLine.filter((c) => c.box.right > meta.right + 1).map((c) => c.text),
        // No chip to mis-tap: a skill chip here would be a tap under 44 pt.
        chips: [...row.querySelectorAll<HTMLElement>(".chips-button, .chips-add")].filter((c) => c.getBoundingClientRect().width > 0).length,
      };
    }));
    const bad = rows.filter((r) => !r.under || r.stubs.length || r.chips);
    if (bad.length) throw new Error(`Today at ${t.toFixed(2)}: the detail line is off: ${JSON.stringify(bad)}`);
    if (!rows.some((r) => /\d+ (min|h)/.test(r.line))) throw new Error(`Today at ${t.toFixed(2)}: no row says how long is left: ${rows.map((r) => `"${r.line}"`).join(", ")}`);
    if (!rows.some((r) => r.line.includes("anthropic.com"))) throw new Error(`Today at ${t.toFixed(2)}: no row says where its source is from: ${rows.map((r) => `"${r.line}"`).join(", ")}`);
  }
  await page.evaluate(() => document.documentElement.style.setProperty("--type", "1"));
}, "phone");

journey("phone: an episode on a phone that can't hear speech says the Mac fills its transcript, not that it is on its way (F77)", async (page) => {
  // With no speech model (the Simulator, an older phone) the episode said “on its way” for good: the Mac fills it.
  const cors = { "access-control-allow-origin": "*" };
  const audio = "https://media.example.com/quiet-rooms.mp3";
  await page.route("https://itunes.apple.com/lookup?**", (r) => r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ results: [{ trackId: 1000670069360, episodeUrl: audio, trackName: "Quiet rooms", collectionName: "Ride Home", releaseDate: "2024-09-19T08:00:00Z" }] }) }));
  await page.route(audio, (r) => r.fulfill({ status: 200, contentType: "audio/mpeg", headers: cors, body: Buffer.alloc(200_000) }));
  await tap(page, page.getByRole("button", { name: "Add a source", exact: true }));
  await page.locator(".add-link .field").fill("https://podcasts.apple.com/us/podcast/quiet-rooms/id1355212895?i=1000670069360");
  await tap(page, page.getByRole("button", { name: "Add", exact: true }));
  await page.getByText("Added “Quiet rooms”").waitFor();
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Sources" }));
  await tap(page, page.locator(".phone-sources button").filter({ hasText: "Quiet rooms" }));
  await page.locator(".doc-empty").filter({ hasText: "The transcript comes in when Ore is open on your Mac." }).waitFor();
}, "phone");

journey("phone: a long press on a Today source opens its menu", async (page) => {
  // Tyler 2026-11-12: holding a source on Today did nothing. Only the Sources list had the hold; Today's rows
  // left it to Radix, whose touch timer gives up at a finger's first few points of drift.
  await press(page, page.locator(".home-read").first());
  await page.getByRole("menuitem", { name: /Move to (Done|To read)/ }).waitFor();
  // The lift's click landed on the menu that opened under the finger and picked Open.
  await Bun.sleep(300);
  if (await page.locator(".phone-reader").count()) throw new Error("lifting the finger after the hold opened the source");
  if (!(await page.getByRole("menuitem", { name: "Review this source" }).isVisible())) throw new Error("the menu closed as the finger lifted");
  await page.keyboard.press("Escape");
  // The Sources list's rows hold too, and their menu stays on screen (it ran off at the finger's x).
  await page.evaluate(() => localStorage.setItem("ore-phone-place", JSON.stringify({ tab: "sources", skill: null, openId: null, review: null })));
  await page.reload();
  await press(page, page.locator(".phone-sources li button").first());
  await page.getByRole("menuitem", { name: "Archive" }).waitFor();
  // Renamed in place, the row still holds: its touch listeners stay on the row through the field.
  await tap(page, page.getByRole("menuitem", { name: "Rename…" }));
  const field = page.locator(".phone-row-rename input");
  await field.fill("A renamed source");
  await field.press("Enter");
  const renamed = page.locator(".phone-sources li button").filter({ hasText: "A renamed source" });
  await renamed.waitFor();
  await press(page, renamed);
  await page.getByRole("menuitem", { name: "Pin to top" }).waitFor();
}, "phone");

journey("phone: the drawer's No skill lists the sources with no skill, only while there are some, and a held source sets its Importance (D345)", async (page) => {
  const drawer = page.locator(".phone-drawer");
  const noSkill = drawer.locator("button").filter({ hasText: /^No skill$/ });
  const menu = () => tap(page, page.getByRole("button", { name: "Open menu" }));
  await menu();
  await drawer.locator("button").filter({ hasText: "Sources" }).waitFor();
  if (await noSkill.count()) throw new Error("the drawer has a No skill row with every source under a skill");
  const { createItem } = (await import(join(import.meta.dir, "../../../../packages/core/src/index.ts"))) as { createItem: (lib: { root: string }, d: object) => Promise<{ dir: string }> };
  await phoneWith(page, async () => (await createItem({ root: PHONE_LIB }, { type: "article", title: "A values guide", body: "Write down the five things you would defend." })).dir, async () => {
    await menu();
    await tap(page, noSkill);
    const rows = page.locator(".phone-sources li button");
    await until("only the source with no skill is listed", async () => (await rows.count()) === 1 && (await rows.first().innerText()).includes("A values guide"));
    // Held, Importance ▸ ticks Normal with no skill; Focus is set and ticked the next time.
    const levels = async () => {
      await press(page, rows.first());
      await tap(page, page.getByRole("menuitem", { name: "Importance" }));
      await page.getByRole("menuitemcheckbox", { name: "Focus" }).waitFor();
      return page.getByRole("menuitemcheckbox").evaluateAll((els) => els.map((e) => `${e.textContent}${e.getAttribute("aria-checked") === "true" ? "✓" : ""}`).join(" "));
    };
    if ((await levels()) !== "Focus Normal✓ Light") throw new Error(`with no skill and nothing set: ${await levels()}`);
    await tap(page, page.getByRole("menuitemcheckbox", { name: "Focus" }));
    await page.getByText("A values guide: Focus").waitFor();
    await until("Focus is ticked", async () => {
      const now = await levels();
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      return now === "Focus✓ Normal Light";
    });
  });
  // Gone, the row stays only while its list is open; from Today it is gone.
  await page.reload();
  await menu();
  await tap(page, drawer.locator("button").filter({ hasText: "Today" }));
  await menu();
  await drawer.locator("button").filter({ hasText: "Sources" }).waitFor();
  if (await noSkill.count()) throw new Error("the No skill row stayed after its last source went");
}, "phone");

journey("phone: a held row in a skill's list opens its own menu only; Return in Rename opens nothing; Rename… is on Today's rows too (F46–F48)", async (page) => {
  // On a skill's page a held row is under the section's own menu: a finger's pointer opens only the row's (F46).
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer section button").filter({ hasText: "Learning" }));
  const row = page.locator(".phone-skill .phone-sources li button").first();
  await row.waitFor();
  const b = (await row.boundingBox())!;
  await row.evaluate((el, [x, y]) => el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "touch", isPrimary: true, clientX: x, clientY: y })), [b.x + b.width / 2, b.y + b.height / 2]);
  await press(page, row, 900);
  await page.getByRole("menuitem", { name: "Review this source" }).waitFor();
  await Bun.sleep(200);
  if (await page.getByRole("menuitem", { name: "Search sources" }).count()) throw new Error("the section's menu opened over the row's");
  // The Sources list's Return saves and stays on the list (F47).
  const place = (tab: string) => page.evaluate((tab) => localStorage.setItem("ore-phone-place", JSON.stringify({ tab, skill: null, openId: null, review: null })), tab);
  await place("sources");
  await page.reload();
  await press(page, page.locator(".phone-sources li button").first());
  await tap(page, page.getByRole("menuitem", { name: "Rename…" }));
  const field = page.locator(".phone-row-rename input");
  await field.fill("Renamed in Sources");
  await field.press("Enter");
  await page.locator(".phone-sources li button", { hasText: "Renamed in Sources" }).waitFor();
  await Bun.sleep(400);
  if (await page.locator(".phone-reader").count()) throw new Error("Return in the rename field opened the source");
  // Today's rows rename in place, as the Sources list's do (F48, D225).
  await place("today");
  await page.reload();
  await press(page, page.locator(".home-read").first());
  await tap(page, page.getByRole("menuitem", { name: "Rename…" }));
  const today = page.locator(".home-read input");
  await today.fill("Renamed on Today");
  await today.press("Enter");
  await page.locator(".home-read", { hasText: "Renamed on Today" }).waitFor();
  await Bun.sleep(400);
  if (await page.locator(".phone-reader").count()) throw new Error("Return in Today's rename field opened the source");
}, "phone");

journey("phone: a link added is read on the phone itself; one it can't read waits for the Mac, and Remove takes it off", async (page) => {
  // D235: the link is saved to the inbox, then the phone imports it with the Mac's own importer.
  const para = "Mixing kinds of problems in one sitting makes each one harder to start and easier to keep. ";
  const article = `<html><head><title>Interleaving in practice</title></head><body><article><h1>Interleaving in practice</h1>${`<p>${para.repeat(5)}</p>`.repeat(4)}</article></body></html>`;
  await page.route("https://example.com/articles/interleaving", (r) => r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", headers: { "access-control-allow-origin": "*" }, body: article }));
  await page.route("https://example.com/articles/offline", (r) => r.abort());
  await tap(page, page.getByRole("button", { name: "Add a source", exact: true }));
  await page.locator(".add-link .field").fill("https://notalink");
  await tap(page, page.locator(".add-link button"));
  await page.locator(".add-link .phone-error").filter({ hasText: "isn’t a link" }).waitFor();
  await page.locator(".add-link .field").fill("https://example.com/articles/interleaving");
  await tap(page, page.locator(".add-link button"));
  await page.locator(".add-link").waitFor({ state: "detached" });
  await page.getByText("Added “Interleaving in practice”").waitFor();
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Sources" }));
  await page.locator(".phone-sources").getByText("Interleaving in practice").first().waitFor();
  if (await page.locator(".phone-waiting").count()) throw new Error("the link it read is still listed as coming in");
  // One the phone can't reach keeps its reason, and the Mac tries it.
  await tap(page, page.getByRole("button", { name: "Add a source", exact: true }));
  await page.locator(".add-link .field").fill("https://example.com/articles/offline");
  await tap(page, page.locator(".add-link button"));
  await page.locator(".add-link").waitFor({ state: "detached" });
  const row = page.locator(".phone-waiting").filter({ hasText: "example.com/articles/offline" });
  await row.getByText("Your Mac will try it.").waitFor();
  // F59: it shows on Today too, where a share's Open lands: an episode still downloading was nowhere he looked.
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Today" }));
  await row.getByText("Your Mac will try it.").waitFor();
  await tap(page, row.getByRole("button", { name: "Remove" }));
  await row.waitFor({ state: "detached" });
}, "phone");

journey("phone: a YouTube link is in the library at once and says its transcript comes from the Mac", async (page) => {
  // D235: no yt-dlp on a phone, so the video comes in with its title and plays; the Mac fills the transcript.
  await page.route("https://www.youtube.com/oembed?**", (r) => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ title: "How spacing works", author_name: "Learning Lab" }) }));
  await page.route(/ytimg\.com|youtube(-nocookie)?\.com\/(embed|iframe_api)/, (r) => r.abort());
  await tap(page, page.getByRole("button", { name: "Add a source", exact: true }));
  await page.locator(".add-link .field").fill("https://youtu.be/abcdefghijk");
  await tap(page, page.locator(".add-link button"));
  await page.locator(".add-link").waitFor({ state: "detached" });
  await page.getByText("Added “How spacing works”").waitFor();
  // Not phoneSource: it waits for the text, and this source has none yet.
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Sources" }));
  await tap(page, page.locator(".phone-sources button").filter({ hasText: "How spacing works" }));
  await page.locator(".doc-empty").filter({ hasText: "The transcript comes in when Ore is open on your Mac." }).waitFor();
}, "phone");

journey("phone: an episode is in at once, says how far its transcript is, and fills in while he has it open", async (page) => {
  // F60: an hour's episode took minutes to download and hear before anything showed. It is a source at once
  // (title, show), the wait says what it is doing, and the transcript lands in the open reader.
  const cors = { "access-control-allow-origin": "*" };
  const audio = "https://media.example.com/master-your-sleep.mp3";
  await page.route("https://itunes.apple.com/lookup?**", (r) => r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ results: [{ trackId: 1000560143046, episodeUrl: audio, trackName: "Master your sleep", collectionName: "Huberman Lab", releaseDate: "2021-01-11T08:00:00Z" }] }) }));
  // A second of silence that a browser plays (a WAV), padded so the download has a size to report.
  const wav = Buffer.alloc(2_000_000);
  wav.write("RIFF", 0), wav.writeUInt32LE(36 + 16000, 4), wav.write("WAVEfmt ", 8), wav.writeUInt32LE(16, 16), wav.writeUInt16LE(1, 20), wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24), wav.writeUInt32LE(16000, 28), wav.writeUInt16LE(2, 32), wav.writeUInt16LE(16, 34), wav.write("data", 36), wav.writeUInt32LE(16000, 40);
  await page.route(audio, (r) => r.fulfill({ status: 200, contentType: "audio/wav", headers: cors, body: wav }));
  // The iPhone's speech, standing in: it hears nothing until the journey lets it.
  await page.evaluate(() => void ((window as unknown as { __ORE_HEAR: { vtt: string; hold: boolean } }).__ORE_HEAR = { vtt: "WEBVTT\n\n00:00:00.000 --> 00:00:04.000\nWelcome back to the show.\n\n00:01:00.000 --> 00:01:05.000\nThanks for listening.\n\n", hold: true }));
  await tap(page, page.getByRole("button", { name: "Add a source", exact: true }));
  await page.locator(".add-link .field").fill("https://podcasts.apple.com/us/podcast/master-your-sleep/id1545953110?i=1000560143046");
  await tap(page, page.locator(".add-link button"));
  await page.locator(".add-link").waitFor({ state: "detached" });
  await page.getByText("Added “Master your sleep”").waitFor();
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Sources" }));
  const row = page.locator(".phone-sources button").filter({ hasText: "Master your sleep" });
  await row.locator(".filling").filter({ hasText: "Transcribing" }).waitFor();
  await tap(page, row);
  const wait = page.locator(".doc-empty .filling");
  await wait.filter({ hasText: "Transcribing" }).waitFor();
  await wait.getByText("Keep Ore open to finish.").waitFor();
  // It plays meanwhile, from the episode's own address: he needn't wait for the words to listen.
  await page.locator(".player-pin:has(.player.audio)").waitFor();
  await fits44(page, ".player.audio .ctl.play", "Play");
  await until("the episode's audio is ready to play", async () => !(await page.locator(".player.audio .ctl.play").isDisabled()));
  if (await page.locator(".video-error").count()) throw new Error("the episode won't play from its address");
  if (process.env.ORE_SHOT) await page.screenshot({ path: process.env.ORE_SHOT });
  await page.evaluate(() => void ((window as unknown as { __ORE_HEAR: { hold: boolean } }).__ORE_HEAR.hold = false));
  await page.getByText("Thanks for listening.").waitFor();
  if (await page.locator(".doc-empty").count()) throw new Error("the transcript is in, and the reader still says it is waiting");
  // It plays on from where it was: the transcript landing doesn't swap the audio under him.
  if (await page.locator(".video-error").count() || (await page.locator(".player.audio .ctl.play").isDisabled())) throw new Error("the transcript landing stopped the episode's audio");
  if (process.env.ORE_SHOT) await page.screenshot({ path: process.env.ORE_SHOT.replace(".png", "-after.png") });
}, "phone");

const RICH_TEXT = "Spacing in practice\nSpread reviews out\nMix the kinds\nconst gap = days(3);";

const RICH_HTML = "<h2>Spacing in practice</h2><ul><li>Spread reviews out</li><li>Mix the kinds</li></ul><pre><code>const gap = days(3);</code></pre>";

journey("phone: a rich paste left in Add keeps its headings, list and code when it is added later (F553)", async (page) => {
  // Codex test of #519 (UX-2, E1): a sheet closed and opened again kept the words but not the paste's HTML.
  await tap(page, page.getByRole("button", { name: "Add a source", exact: true }));
  await pasteInto(page.locator(".add-link .field"), RICH_TEXT, RICH_HTML);
  await page.keyboard.press("Escape");
  await page.locator(".add-link").waitFor({ state: "detached" });
  await tap(page, page.getByRole("button", { name: "Add a source", exact: true }));
  await page.locator(".add-link .field").press("Enter");
  const doc = page.locator(".phone-reader .doc").first();
  await doc.locator("li").filter({ hasText: "Mix the kinds" }).waitFor();
  await doc.locator("pre").filter({ hasText: "const gap" }).waitFor();
}, "phone");

journey("phone: dragging down in a long paste scrolls it back up instead of closing Add (F554)", async (page) => {
  // Codex test of #519 (UX-3): the sheet's swipe down took a drag meant for the text, and closed the sheet.
  await tap(page, page.getByRole("button", { name: "Add a source", exact: true }));
  const field = page.locator(".add-link .field");
  await field.fill(Array.from({ length: 80 }, (_, i) => `Line ${i + 1} of a long pasted article.`).join("\n"));
  await field.evaluate((el) => (el.scrollTop = el.scrollHeight));
  const box = (await field.boundingBox())!;
  await swipe(page, [box.x + box.width / 2, box.y + 30], [box.x + box.width / 2, box.y + box.height - 10], 300, true);
  await Bun.sleep(400);
  if (!(await page.locator(".add-link").count())) throw new Error("a drag inside the scrolled text closed Add");
}, "phone");

journey("phone: New skill's field and its refusal stay above the keyboard", async (page) => {
  await page.evaluate(() => document.documentElement.style.setProperty("--keyboard", "336px")); // iOS's keyboard, as the shell measures it
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "New skill" }));
  const field = page.getByRole("textbox", { name: "New skill name" });
  await field.fill("learning");
  await field.press("Enter");
  const error = page.locator(".phone-new-error");
  await error.waitFor();
  await until("the field and the refusal sit above the keyboard", async () => {
    const f = (await field.boundingBox())!, e = (await error.boundingBox())!;
    return f.y + f.height <= 844 - 336 && e.y + e.height <= 844 - 336;
  });
  await field.press("Escape");
  await page.evaluate(() => document.documentElement.style.removeProperty("--keyboard"));
}, "phone");

journey("phone: a double tap on an open picture zooms it, and keeps it open (Photos)", async (page) => {
  await phoneSource(page, AGENTS);
  const img = page.locator(".phone-reader .doc img").first();
  await until("the saved picture loads from the library", () => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0));
  await tap(page, img);
  const view = page.locator(".figure-view");
  await view.locator("img").waitFor();
  await page.waitForTimeout(400); // grown in
  const scale = () => view.evaluate((v) => Math.max(...[...v.querySelectorAll<HTMLElement>("*")].map((el) => new DOMMatrix(getComputedStyle(el).transform === "none" ? undefined : getComputedStyle(el).transform).a)));
  await page.touchscreen.tap(195, 422);
  await page.waitForTimeout(80);
  await page.touchscreen.tap(195, 422);
  await page.waitForTimeout(700);
  if (!(await view.count())) throw new Error("a double tap closed the picture");
  await until("a double tap zooms in", async () => (await scale()) > 1.5);
  await page.touchscreen.tap(195, 422);
  await page.waitForTimeout(80);
  await page.touchscreen.tap(195, 422);
  await until("a second double tap zooms back out", async () => (await scale()) < 1.05);
  await page.touchscreen.tap(195, 422);
  await view.waitFor({ state: "detached" });
}, "phone");

journey("phone: in Settings each picked choice sits inside its frame, in the Mac's order (F377)", async (page) => {
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Settings" }));
  await page.locator(".phone-settings .seg").first().waitFor();
  const out = await page.locator(".phone-settings .seg").evaluateAll((segs) => segs.filter((seg) => {
    const f = seg.getBoundingClientRect();
    return [...seg.querySelectorAll(".seg-item")].some((el) => { const r = el.getBoundingClientRect(); return r.top < f.top || r.bottom > f.bottom; });
  }).map((seg) => seg.getAttribute("aria-label")));
  if (out.length) throw new Error(`choices stand out of their frame in: ${out.join(", ")}`);
  const rows = await page.locator(".phone-settings .settings-group").first().locator(".settings-row-text > :first-child").allInnerTexts();
  if (rows.join(", ") !== "Minutes a day, Weekdays only, New exercises a day") throw new Error(`Daily goal reads ${rows.join(", ")}`);
  await tap(page, page.locator(".phone-back"));
}, "phone");

journey("phone: Today starts the new day at midnight without a reload (F172)", async (page) => {
  // Left open overnight, Home kept yesterday's minutes (and "All caught up" with no Start review) until a reload.
  const late = new Date();
  late.setHours(23, 50, 0, 0);
  await page.clock.install({ time: late });
  await page.reload();
  await page.locator(".phone-opening").waitFor({ state: "detached" });
  const ring = page.locator(".home-goal [aria-label$='minutes today']").first();
  await ring.waitFor();
  const before = await ring.getAttribute("aria-label");
  await tap(page, page.getByRole("button", { name: "Start review" }).first());
  await tap(page, page.getByRole("button", { name: /^Start review/ }).last());
  const sure = page.locator(".phone-full button:visible").filter({ hasText: /^Think so/ });
  await sure.waitFor();
  await page.clock.fastForward("03:00");
  const field = page.locator(".phone-full .quiz-answer:visible");
  if (await field.count()) (await tap(page, field), await page.keyboard.type("Retrieval makes the memory stronger."));
  await tap(page, sure);
  const check = page.locator(".phone-full button:visible").filter({ hasText: /^Check/ });
  if (await check.count()) await tap(page, check);
  await tap(page, page.locator(".phone-full button:visible").filter({ hasText: /^Good/ }));
  for (let i = 0; i < 3 && (await page.locator(".phone-full .review").count()); i++) {
    await tap(page, page.getByRole("button", { name: "Leave review" }));
    await page.waitForTimeout(400);
  }
  await until("Review is closed", async () => !(await page.locator(".phone-full .review").count()));
  await until("Today counts the rating", async () => (await ring.getAttribute("aria-label")) !== before);
  // Past midnight, with the app still open: the new day's minutes start from none.
  await page.clock.fastForward("09:00:00");
  await until("Today shows the new day", async () => (await ring.getAttribute("aria-label")) === before, 5000);
}, "phone");

journey("phone: VoiceOver hears Explain's answer and that marking is his, its marks show no extra pictures, a picker's Select all is a 44 pt tap, and Done gives focus back (Codex sweep 3, a11y)", async (page) => {
  await tap(page, page.getByRole("button", { name: "Start review" }).first());
  const all = page.locator(".pick-all");
  await all.waitFor();
  const h = await all.evaluate((e) => Math.max(e.getBoundingClientRect().height, parseFloat(getComputedStyle(e, "::after").height) || 0));
  if (h < 44) throw new Error(`Select all is a ${Math.round(h)} pt tap`);
  await tap(page, page.getByRole("button", { name: /^Start review/ }).last());
  const field = page.locator(".phone-full textarea:visible");
  for (let i = 0; ; i++) {
    await page.locator(".phone-full button:visible").filter({ hasText: /^Think so/ }).waitFor();
    if (await field.count()) break;
    if (i > 10) throw new Error("no Explain exercise came up");
    await tapFact(page);
    await tap(page, page.locator(".phone-full button:visible").filter({ hasText: /^Good/ }));
    await Bun.sleep(300);
  }
  await tap(page, field);
  await page.keyboard.type("Rereading feels fluent.");
  await tap(page, page.locator(".phone-full button:visible").filter({ hasText: /^Think so/ }));
  await tap(page, page.locator(".phone-full button:visible").filter({ hasText: /^Check/ }));
  const live = page.locator(".review > .sr-only[aria-live]");
  await until("the live region says the answer is there and the marking is his", async () => /Answer: .*Mark what you got/.test(await live.innerText()));
  const pictures = await page.locator(".quiz-mark svg:not([aria-hidden=true])").count();
  if (pictures) throw new Error(`${pictures} mark pictures are read as unnamed images`);
  await tap(page, page.getByRole("button", { name: "Leave review" }));
  await tap(page, page.locator(".review-end button").filter({ hasText: /^Done/ }));
  await page.locator(".phone-full").waitFor({ state: "detached" });
  await until("focus is back on a control, not the page", async () => page.evaluate(() => !!document.activeElement && document.activeElement !== document.body));
}, "phone");

journey("phone: a half-typed Explain answer and a Finish recall survive a relaunch", async (page) => {
  // iOS kills a web view in the background; what he typed lived only in the page's memory.
  await tap(page, page.getByRole("button", { name: "Start review" }).first());
  await tap(page, page.getByRole("button", { name: /^Start review/ }).last());
  const field = page.locator(".phone-full textarea:visible");
  /** Rates Fact exercises Good until an Explain one comes up. */
  const toExplain = async () => {
    for (let i = 0; ; i++) {
      await page.locator(".phone-full button:visible").filter({ hasText: /^Think so/ }).waitFor();
      if (await field.count()) return;
      if (i > 10) throw new Error("no Explain exercise came up");
      await tapFact(page);
      await tap(page, page.locator(".phone-full button:visible").filter({ hasText: /^Good/ }));
      await Bun.sleep(300);
    }
  };
  await toExplain();
  await tap(page, field);
  await page.keyboard.type("Rereading feels fluent, so it seems learned");
  await tap(page, page.locator(".phone-full button:visible").filter({ hasText: /^Think so/ }));
  await page.reload();
  // The session starts again with what is left, in its own order: the answer waits with its exercise.
  await toExplain();
  await until("the answer comes back after a relaunch", async () => (await field.inputValue().catch(() => "")) === "Rereading feels fluent, so it seems learned");
  await until("and how sure he said he was", async () => (await page.locator(".phone-full button:visible").filter({ hasText: /^Think so/ }).getAttribute("aria-checked").catch(() => null)) === "true");
  await tap(page, page.getByRole("button", { name: "Leave review" }));
  await tap(page, page.locator(".review-end button").filter({ hasText: /^Done/ }));
  await page.locator(".phone-full").waitFor({ state: "detached" });

  await phoneSource(page, TESTING);
  await tap(page, page.getByRole("button", { name: "Source actions" }));
  await tap(page, page.locator(".action-sheet button").filter({ hasText: "Finish" }));
  const recall = page.getByPlaceholder("In your own words…");
  await tap(page, recall);
  await page.keyboard.type("Testing beats rereading after a delay");
  await page.reload();
  await until("the recall comes back after a relaunch", async () => (await recall.inputValue().catch(() => "")) === "Testing beats rereading after a delay");
}, "phone");

journey("phone: each list keeps its scroll when he goes to another and back", async (page) => {
  // The lists share one scroller, so a list came back where Today had left it. A short screen stands in for a long library.
  await page.setViewportSize({ width: 390, height: 360 });
  const main = page.locator("main.phone-page");
  const go = async (to: string) => {
    await tap(page, page.getByRole("button", { name: "Open menu" }));
    await tap(page, page.locator(".phone-drawer button").filter({ hasText: to }));
    await page.locator(".phone-shell.open").waitFor({ state: "detached" });
  };
  await go("Sources");
  await page.locator(".phone-sources li").first().waitFor();
  const end = await main.evaluate((m) => ((m.scrollTop = m.scrollHeight), m.scrollTop));
  if (end < 50) throw new Error(`Sources is too short to scroll (${end}px)`);
  await Bun.sleep(400); // kept a moment after he stops
  // Today has no place kept yet: it opens at its top, not where Sources was.
  await go("Today");
  await until("Today opens at its top", async () => (await main.evaluate((m) => m.scrollTop)) === 0);
  await Bun.sleep(400);
  await go("Sources");
  await until(`Sources comes back at ${end}px`, async () => Math.abs((await main.evaluate((m) => m.scrollTop)) - end) <= 1);
}, "phone");

const cardFile = (lib: string, text: string) => join(lib, "cards", readdirSync(join(lib, "cards")).find((f) => f.endsWith(".md") && readFileSync(join(lib, "cards", f), "utf8").includes(text))!);

// iOS takes a first tap as a hover when the hover shows or hides something, and clicks only on the second (F54).
journey("phone: a hover on a Today row or skill shows or hides nothing, so one tap opens it", async (page) => {
  const row = page.locator(".home-read").first();
  await row.waitFor();
  await row.hover();
  const read = await row.evaluate((el) => ({ more: getComputedStyle(el.querySelector(".more")!).display, meter: el.querySelector(".thumb-line, .home-new") ? getComputedStyle(el.querySelector(".thumb-line, .home-new")!).visibility : "visible" }));
  if (read.more !== "none" || read.meter !== "visible") throw new Error(`a hover on a Today row changes it: ⋯ ${read.more}, the reading line ${read.meter}`);
  const skill = page.locator(".home-skill").first();
  await skill.hover();
  const more = await skill.evaluate((el) => (el.querySelector(".more") ? getComputedStyle(el.querySelector(".more")!).visibility : "hidden"));
  if (more !== "hidden") throw new Error("a hover on a Today skill shows its ⋯");
  await tap(page, row.locator(".home-open"));
  await page.locator(".phone-reader").waitFor();
}, "phone");

journey("phone: a kept draft goes when the Mac changes what it answered, and nothing is kept before he types", async (page) => {
  // Kept drafts outlived their questions: Finish kept one (with a copy of the questions) the moment it opened, and
  // after the Mac changed the questions the phone showed and sent answers against the old ones.
  await phoneSource(page, TESTING);
  await tap(page, page.getByRole("button", { name: "Source actions" }));
  await tap(page, page.locator(".action-sheet button").filter({ hasText: "Finish" }));
  const recall = page.getByPlaceholder("In your own words…");
  await recall.waitFor();
  await Bun.sleep(800);
  const kept = () => page.evaluate(() => localStorage.getItem("ore.finish-drafts") ?? "");
  if ((await kept()).length > 4) throw new Error(`Finish kept a draft before he typed: ${(await kept()).slice(0, 80)}`);
  await tap(page, recall);
  await page.keyboard.type("Testing beats rereading");
  await Bun.sleep(800);
  await macChanges((lib) => itemFile(lib, "the-testing-effect", "doc.md"), "Why does rereading feel effective even when it isn't?", "Why does rereading feel so convincing?", async () => {
    await page.reload();
    await recall.waitFor();
    await until("the old recall is gone with the old questions", async () => (await recall.inputValue()) === "");
  });
  await until("the kept draft for the old questions is gone", async () => !(await kept()).includes("rereading feel effective"));

  // Review: an Explain answer typed for a question the Mac has since changed.
  await page.evaluate(() => localStorage.clear());
  await page.goto(page.url().split("#")[0]!);
  await tap(page, page.getByRole("button", { name: "Start review" }).first());
  await tap(page, page.getByRole("button", { name: /^Start review/ }).last());
  const field = page.locator(".phone-full textarea:visible");
  const toExplain = async () => {
    for (let i = 0; ; i++) {
      await page.locator(".phone-full button:visible").filter({ hasText: /^Think so/ }).waitFor();
      if (await field.count()) return;
      if (i > 10) throw new Error("no Explain exercise came up");
      await tapFact(page);
      await tap(page, page.locator(".phone-full button:visible").filter({ hasText: /^Good/ }));
      await Bun.sleep(300);
    }
  };
  await toExplain();
  await tap(page, field);
  await page.keyboard.type("Rereading feels fluent");
  await Bun.sleep(800);
  await macChanges((lib) => cardFile(lib, "illusion of competence"), "Explain why rereading creates an illusion of competence.", "Explain why rereading misleads learners.", async () => {
    await page.reload();
    await toExplain();
    await page.getByText("Explain why rereading misleads learners.").first().waitFor();
    if ((await field.inputValue()) !== "") throw new Error("the answer typed for the old question came back under the new one");
  });
}, "phone");

journey("phone: a relaunch once Finish has marked the source Done never opens Finish again", async (page) => {
  // The phone kept "Finish open" through the closing moment: a relaunch then opened Recall for a source already Done.
  await phoneSource(page, TESTING);
  await tap(page, page.getByRole("button", { name: "Source actions" }));
  await tap(page, page.locator(".action-sheet button").filter({ hasText: "Finish" }));
  await tap(page, page.getByRole("button", { name: "Just mark done" }));
  await page.locator(".quiz-foot button").filter({ hasText: /^Done/ }).waitFor();
  await page.reload();
  await phoneReaderReady(page);
  await Bun.sleep(500);
  if (await page.getByPlaceholder("In your own words…").count()) throw new Error("the relaunch opened Finish's Recall for a source already Done");
}, "phone");

journey("phone: Source actions offers no Reimport, which needs the Mac", async (page) => {
  // The phone can't fetch a page or reread an original (its CSP and its library leave both to the Mac, D78):
  // offered, Reimport failed blaming the connection. Like Listen, it isn't offered.
  await phoneSource(page, AGENTS);
  await tap(page, page.getByRole("button", { name: "Source actions" }));
  await page.locator(".action-sheet").waitFor();
  if (await page.locator(".action-sheet button").filter({ hasText: "Reimport" }).count()) throw new Error("Reimport is offered on the phone");
}, "phone");

journey("phone: a recording plays from a bar above the bottom bar, its timestamps on screen", async (page) => {
  await phoneSource(page, "Lecture 4");
  const bar = page.locator(".player-pin:has(.player.audio)");
  await bar.waitFor();
  const b = (await bar.boundingBox())!;
  const tools = (await page.locator(".phone-tools").boundingBox())!;
  if (b.y + b.height > tools.y || b.y < 844 / 2) throw new Error(`the recording's bar is at ${Math.round(b.y)}–${Math.round(b.y + b.height)}, not just above the bottom bar at ${Math.round(tools.y)}`);
  await fits44(page, ".player.audio .ctl.play", "Play");
  const left = await page.locator(".doc .ts").first().evaluate((e) => e.getBoundingClientRect().left);
  if (left < 0) throw new Error(`a timestamp starts at x ${Math.round(left)}, off the screen`);
}, "phone");

journey("phone: Finish's closing card keeps its unsaved line through a failed save and a relaunch; Done recorded drops the recall", async (page) => {
  await phoneSource(page, TESTING);
  await tap(page, page.getByRole("button", { name: "Source actions" }));
  await tap(page, page.locator(".action-sheet button").filter({ hasText: "Finish" }));
  // A recall whose save fails, and he marks the source done without it.
  await tap(page, page.getByPlaceholder("In your own words…"));
  await page.keyboard.type("A recall he chose not to save");
  await until("what he typed is kept", async () => (await page.evaluate(() => localStorage.getItem("ore.finish-drafts") ?? "")).includes("chose not to save"));
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { recall: "The disk is full." }));
  await tap(page, page.getByRole("button", { name: "Continue" }));
  await tap(page, page.getByRole("button", { name: "Mark done without saving" }));
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
  // Done is recorded: the recall he left unsaved is not kept to come back next time.
  await page.locator("#quiz-use").waitFor();
  await until("the dropped recall is no longer kept", async () => !(await page.evaluate(() => localStorage.getItem("ore.finish-drafts") ?? "")).includes("chose not to save"));
  // The closing card's own line, whose save fails: Finish stays open with it, and so does a relaunch.
  await tap(page, page.locator("#quiz-use"));
  await page.keyboard.type("Use it before every exam");
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { notes: "The disk is full." }));
  await tap(page, page.locator(".quiz-foot button").filter({ hasText: /^Done/ }));
  await page.getByText("The disk is full.").first().waitFor();
  await Bun.sleep(500);
  await page.reload();
  await until("the relaunch comes back to the closing card with its line", async () => (await page.locator("#quiz-use").inputValue().catch(() => "")) === "Use it before every exam");
}, "phone");

journey("phone: a half-typed answer to What do you already know? survives a relaunch", async (page) => {
  await phoneSource(page, TESTING);
  const field = page.locator(".preq-input");
  if (!(await field.count())) await tap(page, page.locator(".preq-head"));
  await tap(page, field);
  await page.keyboard.type("Retrieval changes what I can remember");
  await Bun.sleep(500);
  await page.reload();
  await phoneReaderReady(page);
  await until("the answer comes back after a relaunch", async () => (await field.inputValue().catch(() => "")) === "Retrieval changes what I can remember");
}, "phone");

journey("phone: a toast is swiped away, down or to a side; and a small drag leaves it where it was (D317)", async (page) => {
  await phoneSource(page, TESTING);
  const toast = page.locator(".toast").filter({ hasText: "Undo" });
  const raise = async () => {
    await tap(page, page.getByRole("button", { name: "Source actions" }));
    await tap(page, page.locator(".action-sheet button").filter({ hasText: "Skills" }));
    await tap(page, page.locator(".action-sheet button[aria-checked]").first());
    await toast.waitFor();
    if (await page.locator(".action-sheet").count()) await page.touchscreen.tap(195, 40);
    await page.locator(".action-sheet").waitFor({ state: "detached" });
    const b = (await toast.boundingBox())!;
    return [b.x + 30, b.y + b.height / 2] as [number, number];
  };
  // A small drag is no swipe: it comes back.
  let at = await raise();
  await swipe(page, at, [at[0] + 20, at[1]], 300);
  await Bun.sleep(300);
  if (!(await toast.count())) throw new Error("a 20pt drag closed the toast");
  if (Math.abs((await toast.boundingBox())!.x + 30 - at[0]) > 1) throw new Error("the toast did not come back to its place");
  // To the side.
  await swipe(page, at, [at[0] + 120, at[1]]);
  await toast.waitFor({ state: "detached", timeout: 1500 });
  // Down.
  at = await raise();
  await swipe(page, at, [at[0], at[1] + 70]);
  await toast.waitFor({ state: "detached", timeout: 1500 });
}, "phone");

journey("iPhone menu: every skill's name starts on one line, with an icon or without one (F386)", async (page) => {
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  const rows = page.locator(".phone-drawer section button");
  await rows.first().waitFor();
  // The menu slides in, and WebKit reads each row's place at the moment it is asked: measured mid-slide, rows asked
  // later sit further in (F391). So measure once it has stopped at the screen's edge.
  await until("the menu has slid all the way in", () => page.locator(".phone-drawer").evaluate((d) => d.getBoundingClientRect().left === 0));
  const at = await rows.evaluateAll((all) => all.map((b) => ({ name: b.textContent, x: Math.round(b.querySelector(".phone-title")!.getBoundingClientRect().left), dot: !!b.querySelector(".skill-icon.dot") })));
  if (!at.some((r) => r.dot) || !at.some((r) => !r.dot)) throw new Error(`the menu needs a skill with an icon and one without: ${JSON.stringify(at)}`);
  const off = at.filter((r) => r.x !== at[0]!.x);
  if (off.length) throw new Error(`names start at ${at[0]!.x}px, but: ${JSON.stringify(off)}`);
  await tap(page, page.locator(".phone-scrim"));
}, "phone");

/** Notes each full screen as it is added: whether it was sliding in the moment it appeared. */
const WATCH_PUSHES = `window.__pushes = []; new MutationObserver((all) => { for (const m of all) for (const n of m.addedNodes) if (n.nodeType === 1 && n.classList.contains("phone-full")) window.__pushes.push(n.getAnimations().length > 0); }).observe(document, { childList: true, subtree: true });`;

const pushes = (page: Page) => page.evaluate(() => (window as unknown as { __pushes: boolean[] }).__pushes);

journey("phone: a screen he opens slides in from the right and Back slides it away; the one he left open is just there at launch (D331)", async (page) => {
  await page.addInitScript(WATCH_PUSHES);
  await page.reload();
  await page.locator(".phone-opening").waitFor({ state: "detached" });
  await tap(page, page.locator(".home-read .home-open").first());
  await page.locator(".phone-source .doc").first().waitFor();
  if (String(await pushes(page)) !== "true") throw new Error(`a source opened with a tap did not slide in: ${await pushes(page)}`);
  await until("the slide has ended", () => page.evaluate(() => !document.querySelector(".phone-full")!.getAnimations().length && !document.querySelector(".phone-shell")!.getAnimations().length));
  // Back: the screen is still there, on its way out, then gone, and Today is back where it was.
  await tap(page, page.locator(".phone-full .phone-back"));
  const leaving = await page.evaluate(() => document.querySelector(".phone-full")?.getAnimations().length ?? 0);
  if (!leaving) throw new Error("Back took the source away at once, with no slide out");
  await page.locator(".phone-full").waitFor({ state: "detached" });
  await until("Today is back in place", () => page.evaluate(() => { const s = document.querySelector<HTMLElement>(".phone-shell")!; return !s.getAnimations().length && s.getBoundingClientRect().x === 0; }));
  // Relaunched on a source: no slide, it is where he left it.
  await tap(page, page.locator(".home-read .home-open").first());
  await page.locator(".phone-source .doc").first().waitFor();
  await Bun.sleep(600); // The place is saved.
  await page.reload();
  await page.locator(".phone-source .doc").first().waitFor();
  if (String(await pushes(page)) !== "false") throw new Error(`the source he left open slid in at launch: ${await pushes(page)}`);
  if (await page.evaluate(() => document.querySelector(".phone-full")!.getBoundingClientRect().x) !== 0) throw new Error("the restored source is not in place");
}, "phone");

journey("phone: a sheet rises from the foot of the screen and a tap outside lets it down (D331)", async (page) => {
  await phoneSource(page, TESTING);
  await page.evaluate(() => new MutationObserver((all) => { for (const m of all) for (const n of m.addedNodes) if (n instanceof HTMLElement && n.querySelector(".sheet")) (window as unknown as { __rose: string }).__rose = n.querySelector(".sheet")!.getAnimations().map((a) => (a as CSSAnimation).animationName).join(); }).observe(document.body, { childList: true }));
  await tap(page, page.getByRole("button", { name: "Source actions" }));
  const sheet = page.locator(".action-sheet");
  await sheet.waitFor();
  const rose = await page.evaluate(() => (window as unknown as { __rose: string }).__rose);
  if (rose !== "sheet-up") throw new Error(`the ⋯ sheet did not rise (animations: "${rose}")`);
  await until("the sheet is up", async () => { const b = (await sheet.boundingBox())!; return Math.abs(b.y + b.height - 844) < 1; });
  await page.touchscreen.tap(195, 120);
  await Bun.sleep(60);
  const going = await page.evaluate(() => { const s = document.querySelector<HTMLElement>(".action-sheet"); return !!s && s.style.transform.startsWith("translateY"); });
  if (!going) throw new Error("a tap outside took the sheet away at once, with no slide down");
  await sheet.waitFor({ state: "detached" });
}, "phone");

journey("phone: the long-press menu grows from its row, which stays lit while the menu is open (D331)", async (page) => {
  const row = page.locator(".home-read").first();
  await row.waitFor();
  // The animations that start on the menu are written down as they start: asking the menu what is running once
  // the press has ended found nothing on a slow runner, where the 520 ms press outlasts the growing (F453).
  await page.evaluate(() => {
    const seen: string[] = ((window as unknown as { __menuGrew: string[] }).__menuGrew = []);
    document.addEventListener("animationstart", (e) => { if ((e.target as Element).matches?.(".menu-list")) seen.push(e.animationName); }, true);
  });
  await press(page, row, 520);
  await page.getByRole("menu").waitFor();
  const grew = await page.evaluate(() => (window as unknown as { __menuGrew: string[] }).__menuGrew.join());
  if (grew !== "menu-grow") throw new Error(`the long-press menu did not grow from its row (animations: "${grew}")`);
  const lit = await row.evaluate((el) => { const at = el.closest("[data-menu-row]") ?? el; return getComputedStyle(at).backgroundColor !== getComputedStyle(document.body).backgroundColor && getComputedStyle(at).backgroundColor !== "rgba(0, 0, 0, 0)"; });
  if (!lit) throw new Error("the row he pressed is not lit while its menu is open");
}, "phone");

/** Fields a person types in, on whatever is open (not file pickers, switches or choices). */
const FIELDS = "input:not([type=file],[type=hidden],[type=checkbox],[type=radio],[type=range]):visible, textarea:visible, [contenteditable=true]:visible";

/** iOS's keyboard going away again. */
const keyboardDown = (page: Page) =>
  page.evaluate(() => {
    const vv = window.visualViewport!;
    delete (vv as unknown as Record<string, unknown>).height;
    vv.dispatchEvent(new Event("resize"));
  });

/** Why a focused field is out of sight with a keyboard `kb` tall: under it, above the screen or under a header; "" when in sight. */
const outOfSight = (f: Locator, kb: number) =>
  f.evaluate((el, kb) => {
    const r = el.getBoundingClientRect();
    const line = Math.min(r.height, 24); // a tall field shows at least its first line
    if (r.top + line > innerHeight - kb + 0.5) return `under the keyboard (top ${Math.round(r.top)}, keyboard from ${innerHeight - kb})`;
    if (r.top < 0) return "above the screen";
    const hit = document.elementFromPoint(r.left + Math.min(20, r.width / 2), r.top + line / 2);
    return hit && (el.contains(hit) || hit.contains(el)) ? "" : `covered by ${hit?.className || hit?.tagName}`;
  }, kb);

/** Every field on screen, scrolled to where it sits lowest, tapped, then iOS's keyboard (336 pt, with its bar):
 *  the ones it covers, or a header covers, as "where › label: why". Then, with the keyboard up, focus moved from
 *  field to field as iOS's ‹ › does, with no resize to say so. */
async function coveredFields(page: Page, where: string, kb = 336): Promise<string[]> {
  const out: string[] = [];
  const fields = page.locator(FIELDS);
  const seen: Locator[] = [];
  const label = (f: Locator) => f.evaluate((el) => el.getAttribute("aria-label") || el.getAttribute("placeholder") || (el as HTMLInputElement).name || el.className);
  for (let i = 0; i < (await fields.count()); i++) {
    const f = fields.nth(i);
    // Off to the side (the note page waiting beside a source) isn't on screen to tap.
    if (await f.evaluate((el) => { const r = el.getBoundingClientRect(); return r.right <= 0 || r.left >= innerWidth; })) continue;
    seen.push(f);
    await f.evaluate((el) => el.scrollIntoView({ block: "end" }));
    await tap(page, f);
    await keyboardUp(page, kb);
    await Bun.sleep(400);
    const why = await outOfSight(f, kb);
    if (why) out.push(`${where} › ${await label(f)}: ${why}`);
    await keyboardDown(page);
    await f.evaluate((el) => (el as HTMLElement).blur());
  }
  if (seen.length > 1) {
    await tap(page, seen[0]!);
    await keyboardUp(page, kb);
    for (const f of seen.slice(1)) {
      await f.evaluate((el) => (el as HTMLElement).focus());
      await Bun.sleep(400);
      const why = await outOfSight(f, kb);
      if (why) out.push(`${where} › ${await label(f)}, focus moved to it with the keyboard up: ${why}`);
    }
    await keyboardDown(page);
    await seen.at(-1)!.evaluate((el) => (el as HTMLElement).blur());
  }
  return out;
}

journey("phone: every field on every screen stays in sight when the keyboard comes up, also when focus moves with it up (Codex native scout)", async (page) => {
  const bad: string[] = [];
  const note = (...l: string[]) => bad.push(...l);
  const esc = async () => { await page.keyboard.press("Escape"); await Bun.sleep(300); };
  const back = () => tap(page, page.locator(".phone-back").first());
  // Settings, with the reminder on so its time shows.
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  note(...(await coveredFields(page, "drawer")));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "New skill" }));
  note(...(await coveredFields(page, "drawer, New skill")));
  await esc();
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Settings" }));
  await page.locator(".phone-settings h1").waitFor();
  const reminder = page.getByRole("switch", { name: "Reminder" });
  if ((await reminder.getAttribute("aria-checked")) !== "true") await tap(page, reminder);
  await page.locator(".phone-time").waitFor();
  note(...(await coveredFields(page, "Settings")));
  await back();
  // Search and Add.
  await tap(page, page.getByRole("button", { name: "Search" }));
  note(...(await coveredFields(page, "Search")));
  await tap(page, page.locator(".palette-close"));
  await tap(page, page.getByRole("button", { name: "Add a source", exact: true }));
  note(...(await coveredFields(page, "Add")));
  await esc();
  await page.goto(page.url());
  await page.locator(".phone-app").waitFor();
  await page.locator(".phone-opening").waitFor({ state: "detached" });
  // A source: its page, Find, the note, a highlight's note, Finish.
  await phoneSource(page, TESTING);
  note(...(await coveredFields(page, "source")));
  await tap(page, page.locator(".phone-tools > :last-child"));
  note(...(await coveredFields(page, "source, Find")));
  await esc();
  await tap(page, page.getByRole("button", { name: "Source actions" }));
  await tap(page, page.locator(".action-sheet button").filter({ hasText: "Finish" }));
  note(...(await coveredFields(page, "source, Finish")));
  await esc();
  // A highlight's note, from Collected.
  await tap(page, page.locator(".phone-tools > :first-child"));
  await tap(page, page.locator("aside.mynotes button").filter({ hasText: "after one week" }));
  await page.locator(".popup .field").waitFor();
  note(...(await coveredFields(page, "highlight's note")));
  await esc();
  await tap(page, page.getByRole("button", { name: "Back" }));
  await page.locator(".phone-full").waitFor({ state: "detached" });
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Today" }));
  // Review: Edit exercise, then an Explain answer.
  await tap(page, page.getByRole("button", { name: "Start review" }).first());
  await tap(page, page.getByRole("button", { name: /^Start review/ }).last());
  await page.locator(".review-q").waitFor();
  await tapFact(page);
  await page.getByRole("button", { name: "Good", exact: true }).waitFor();
  await tap(page, page.getByRole("button", { name: "Exercise actions" }));
  await tap(page, page.locator(".action-sheet").getByRole("button", { name: "Edit exercise", exact: true }));
  // The form opens once the sheet has let go (F412): looked at before that, it had no fields to check, and the
  // Esc meant to cancel the edit left the session instead.
  await page.locator(".review-edit textarea").first().waitFor();
  note(...(await coveredFields(page, "Review, Edit exercise")));
  await esc();
  await page.locator(".review-edit").waitFor({ state: "detached" });
  // Each step waits for the exercise it acts on, not a fixed pause.
  const answer = page.locator(".phone-full textarea:visible");
  const good = page.locator(".phone-full button:visible").filter({ hasText: /^Good/ });
  const sure = page.locator(".phone-full button:visible").filter({ hasText: /^Think so/ });
  const asked = page.locator(".phone-full .review-q");
  for (let i = 0; i < 12; i++) {
    await answer.or(good).or(sure).first().waitFor();
    if (await answer.count()) break;
    if (!(await good.count())) await tapFact(page);
    await good.waitFor();
    const was = await asked.innerText();
    await tap(page, good);
    await until("the next exercise", async () => (await answer.count()) > 0 || ((await asked.count()) > 0 && (await asked.innerText()) !== was && !(await good.count())));
  }
  note(...(await coveredFields(page, "Review, Explain")));
  await tap(page, page.getByRole("button", { name: "Leave review" }));
  await tap(page, page.locator(".review-end button").filter({ hasText: /^Done/ }));
  await page.locator(".phone-full").waitFor({ state: "detached" });
  // A skill and its note.
  await tap(page, page.locator(".home-skill").first());
  await Bun.sleep(600);
  note(...(await coveredFields(page, "skill")));
  await tap(page, page.locator(".phone-skill .phone-note-row"));
  await Bun.sleep(600);
  note(...(await coveredFields(page, "skill note")));
  if (bad.length) throw new Error(`fields out of sight with the keyboard up:\n${bad.join("\n")}`);
}, "phone");

journey("phone: Search's ⓧ clears what he typed and keeps Search open with the keyboard up, Cancel leaves, and the keyboard's key says Search (Codex native scout)", async (page) => {
  // The only × beside the field closed Search, and the keyboard showed Return (Settings, Files: a clear button in the field, a Search key).
  await tap(page, page.getByRole("button", { name: "Search" }));
  const field = page.locator("[cmdk-input]");
  // The sheet is announced by the name on the button that opened it, not as the Mac's "Command palette" (F546).
  await page.getByRole("dialog", { name: "Search" }).waitFor();
  if ((await field.getAttribute("enterkeyhint")) !== "search") throw new Error("the keyboard's key doesn't say Search");
  if (await page.getByRole("button", { name: "Clear" }).count()) throw new Error("Clear shows with nothing typed");
  await field.fill("agents");
  await tap(page, page.getByRole("button", { name: "Clear" }));
  await until("the field is cleared", async () => (await field.inputValue()) === "");
  if (!(await field.evaluate((el) => el === document.activeElement))) throw new Error("clearing took the keyboard away");
  // One ✕ only, the field's own: leaving is the word Cancel beside it, as iOS's search fields have (Tyler 2026-11-23).
  await field.fill("agents");
  const xs = await page.getByRole("dialog", { name: "Search" }).locator(".panel-input ~ button svg").count();
  if (xs !== 1) throw new Error(`${xs} ✕ beside the field with text typed`);
  await tap(page, page.getByRole("button", { name: "Cancel", exact: true }));
  await field.waitFor({ state: "detached" });
}, "phone");

journey("phone: Search shows Key point and Source note on long titles at the largest text size", async (page) => {
  const title = "A field guide to recognizing and describing the patterns that repeat across different scales in nature";
  const body = "River branches resemble the veins in a leaf.";
  await phoneWith(page, async () => {
    const lib = openLibrary(PHONE_LIB);
    const source = await createItem(lib, { type: "article", title, body });
    addHighlight(source, { intent: "card", exact: body, note: "Nested patterns appear at many scales." });
    await setNotes(lib, source.meta.id, "Nested patterns are easier to spot in a diagram.");
    return source.dir;
  }, async () => {
    await page.evaluate(() => document.documentElement.style.setProperty("--type", String(28 / 17)));
    await tap(page, page.getByRole("button", { name: "Search" }));
    await page.locator("[cmdk-input]").fill("Nested patterns");
    for (const [kind, label] of [["annotation", "Key point"], ["notes", "Source note"]] as const) {
      const row = page.locator(`[cmdk-item][data-value^="text ${kind} "]`).filter({ hasText: title });
      await row.waitFor();
      const kindLabel = row.getByText(label, { exact: true });
      if (!(await kindLabel.isVisible())) throw new Error(`${label} has no visible label apart from the long title`);
      await kindLabel.scrollIntoViewIfNeeded();
      const fits = await kindLabel.evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const text = range.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        return text.left >= box.left && text.right <= Math.min(box.right, window.innerWidth);
      });
      if (!fits) throw new Error(`${label} is clipped at the largest text size`);
    }
    await tap(page, page.getByRole("button", { name: "Cancel", exact: true }));
  });
}, "phone");

journey("phone: a switch's knob slid off its track flips it, and a slide that ends on it doesn't flip it back (Codex native scout)", async (page) => {
  // Radix's switch took only a click: a slide that ended past the track's end left it as it was (iOS's flips).
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Settings" }));
  const sw = page.getByRole("switch", { name: "Weekdays only" });
  const state = () => sw.getAttribute("aria-checked");
  const slide = (from: number, to: number, click: boolean) =>
    sw.evaluate((el, [from, to, click]) => {
      const r = el.getBoundingClientRect();
      const y = r.top + r.height / 2;
      const at = (type: string, x: number) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: "touch", isPrimary: true, clientX: x, clientY: y }));
      at("pointerdown", r.left + r.width * (from as number));
      for (let i = 1; i <= 6; i++) at("pointermove", r.left + r.width * ((from as number) + (((to as number) - (from as number)) * i) / 6));
      // Back and forth once on the way, as a finger may: one save, at the lift, not one per pass.
      if (Math.abs((to as number) - (from as number)) > 1) for (const f of [from, to]) at("pointermove", r.left + r.width * (f as number));
      at("pointerup", r.left + r.width * (to as number));
      // A lift on the track also sends a click; off it, none.
      if (click) el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    }, [from, to, click] as const);
  const was = await state();
  if (was === "true") await tap(page, sw);
  await until("starts off", async () => (await state()) === "false");
  await slide(0.25, 0.9, true); // across the track, lifted on it
  await until("a slide right turns it on, and the lift's click doesn't turn it off again", async () => (await state()) === "true");
  await Bun.sleep(500);
  if ((await state()) !== "true") throw new Error("the lift's click flipped it back off");
  await slide(0.75, -1.5, false); // left and off the track's end, as a thumb does
  await until("a slide left past the track turns it off", async () => (await state()) === "false");
  await Bun.sleep(500);
  await tap(page, sw);
  await until("a tap still flips it", async () => (await state()) === "true");
}, "phone");

journey("phone: Settings' big title scrolls up into a small one in the bar, and comes back down (Codex native scout)", async (page) => {
  // Scrolled, only Back was left in the bar (iOS's Settings keeps a small centred title).
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Settings" }));
  const small = page.locator(".phone-full .phone-bar-title");
  await small.waitFor({ state: "attached" });
  const shown = async () => (await small.evaluate((el) => getComputedStyle(el).opacity)) === "1" && (await small.textContent()) === "Settings";
  await Bun.sleep(400);
  if (await shown()) throw new Error("the small title shows with the big one still in sight");
  await page.locator(".phone-settings").evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  await until("scrolled, the small title shows in the bar", shown);
  await page.locator(".phone-settings").evaluate((el) => el.scrollTo({ top: 0 }));
  await until("back at the top, it goes", async () => !(await shown()));
}, "phone");

journey("phone drawer: the skills in no collection come first with no heading, as in the Mac's sidebar (F442)", async (page) => {
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  const sections = await page.locator(".phone-drawer section").evaluateAll((all) => all.map((s) => s.querySelector("h2")?.textContent ?? ""));
  if (sections.length < 2 || sections[0] !== "" || sections.slice(1).some((h) => !h || h === "Other")) throw new Error(`the drawer's groups are headed ${JSON.stringify(sections)}`);
}, "phone");

journey("phone: a link typed into Add a link and left with a tap outside is there when it opens again (Codex UX sweep, D342)", async (page) => {
  await tap(page, page.getByRole("button", { name: "Add a source", exact: true }));
  await page.locator(".add-link .field").fill("https://example.com/learning-on-the-bus");
  await page.mouse.click(195, 40); // the dimmed page above the sheet
  await page.locator(".add-link").waitFor({ state: "detached" });
  await tap(page, page.getByRole("button", { name: "Add a source", exact: true }));
  const v = await page.locator(".add-link .field").inputValue();
  if (v !== "https://example.com/learning-on-the-bus") throw new Error(`the link he typed is gone: "${v}"`);
  await page.keyboard.press("Escape");
  // Kept for where it was typed: a skill's own Add a link (which files it there) opens empty.
  await page.locator(".add-link").waitFor({ state: "detached" });
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Learning" }));
  await tap(page, page.getByRole("button", { name: "Add a source to Learning" }));
  const there = await page.locator(".add-link .field").inputValue();
  if (there) throw new Error(`a link typed on Today came back on a skill's page, to be filed there: "${there}"`);
  await page.keyboard.press("Escape");
}, "phone");

journey("phone: on a small phone the end screen opens at its top, its first lines in sight (Codex UX sweep)", async (page) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.reload(); // a phone this size from the start: a window shrunk after load reads as the keyboard coming up
  await tap(page, page.getByRole("button", { name: "Start review" }).first());
  await tap(page, page.getByRole("button", { name: /^Start review/ }).last());
  for (let i = 0; ; i++) {
    if (i > 20) throw new Error("the review never ended");
    const sure = page.locator(".phone-full button:visible").filter({ hasText: /^Think so/ });
    await sure.or(page.locator(".phone-full .review-end")).first().waitFor();
    if (!(await sure.count())) break;
    const field = page.locator(".phone-full .quiz-answer:visible");
    if (await field.count()) (await tap(page, field), await page.keyboard.type("Retrieval makes the memory stronger."));
    await tap(page, sure);
    const check = page.locator(".phone-full button:visible").filter({ hasText: /^Check/ });
    if (await check.count()) await tap(page, check);
    const rating = page.locator(".phone-full button:visible").filter({ hasText: /^Good/ });
    await rating.waitFor();
    await tap(page, rating);
    await rating.waitFor({ state: "detached" }).catch(() => {});
  }
  const end = page.locator(".phone-full .review-end");
  await end.waitFor();
  await Bun.sleep(1500); // its rise and the count settle
  const top = await end.evaluate((e) => {
    let s: HTMLElement | null = e as HTMLElement;
    while (s && s.scrollHeight <= s.clientHeight + 1) s = s.parentElement;
    return { scrolled: s?.scrollTop ?? 0, first: (e.firstElementChild as HTMLElement | null)?.getBoundingClientRect().top ?? 0 };
  });
  if (top.scrolled > 1 || top.first < 0) throw new Error(`the end screen opened scrolled ${top.scrolled} pt down, its first line at y ${top.first}`);
}, "phone");

journey("phone: the drawer's skill editor has 44 pt colours, name and collection (Codex UX sweep 3)", async (page) => {
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await press(page, page.locator(".phone-drawer section button").filter({ hasText: "Learning" }).first());
  await tap(page, page.getByRole("menuitem", { name: "Edit skill…" }));
  const edit = page.locator(".skill-edit");
  await edit.waitFor();
  const small = await edit.evaluate((root) => [...root.querySelectorAll<HTMLElement>(".swatch, .skill-name button, .select-button")].flatMap((e) => {
    const r = e.getBoundingClientRect();
    let [w, h] = [r.width, r.height];
    const cs = getComputedStyle(e, "::after");
    if (cs.content !== "none" && cs.position === "absolute") { const o = (v: string) => Math.max(0, -parseFloat(v) || 0); w += o(cs.left) + o(cs.right); h += o(cs.top) + o(cs.bottom); }
    return w < 44 || h < 44 ? [`${e.getAttribute("aria-label") ?? e.textContent?.trim()} ${Math.round(w)}×${Math.round(h)}`] : [];
  }));
  if (small.length) throw new Error(`taps under 44 pt in the skill editor: ${small.join(", ")}`);
  await page.keyboard.press("Escape");
}, "phone");

journey("phone: a collection in the drawer renames, moves and deletes from a long press on its heading, each with Undo (parity, Codex UX sweep 4)", async (page) => {
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  const heads = () => page.locator(".phone-drawer h2").allInnerTexts();
  const first = (await heads())[0]!;
  const head = page.locator(".phone-drawer h2", { hasText: first }).first();
  // A 44 pt target round its 12 pt line.
  const h = await head.evaluate((e) => { const r = e.getBoundingClientRect(); const a = getComputedStyle(e, "::after"); return r.height + Math.max(0, -parseFloat(a.top) || 0) + Math.max(0, -parseFloat(a.bottom) || 0); });
  if (h < 44) throw new Error(`a collection heading is a ${h} pt tap`);
  await press(page, head);
  await tap(page, page.getByRole("menuitem", { name: "Rename…" }));
  const field = page.getByRole("textbox", { name: "Collection name" });
  await field.fill("Renamed on the bus");
  // A save that fails keeps what he typed in the field.
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { skills: "disk full" }));
  await field.press("Enter");
  await until("the field is back with his words", async () => (await field.count()) > 0 && (await field.inputValue()) === "Renamed on the bus");
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
  await field.press("Enter");
  await page.locator(".phone-drawer h2", { hasText: "Renamed on the bus" }).waitFor();
  await page.keyboard.press("Meta+z");
  await page.locator(".phone-drawer h2", { hasText: first }).waitFor();
  // Move down, then Delete (its skills stay), each undone.
  const all = await heads();
  if (all.length > 1) {
    await press(page, page.locator(".phone-drawer h2", { hasText: first }).first());
    await tap(page, page.getByRole("menuitem", { name: "Move down" }));
    await until("it moved down", async () => (await heads())[1] === first);
    await page.keyboard.press("Meta+z");
    await until("Undo put it back", async () => (await heads())[0] === first);
  }
  await press(page, page.locator(".phone-drawer h2", { hasText: first }).first());
  await tap(page, page.getByRole("menuitem", { name: "Delete collection" }));
  await until("it is gone", async () => !(await heads()).includes(first));
  await page.keyboard.press("Meta+z");
  await until("Undo brought it back", async () => (await heads()).includes(first));
}, "phone");

journey("phone: a skill's long-press menu lists each action once, with Move up and Move down (Codex UX sweep 4)", async (page) => {
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await press(page, page.locator(".phone-drawer section button").nth(1));
  const names = await page.getByRole("menuitem").allInnerTexts();
  const twice = names.filter((n, i) => names.indexOf(n) !== i);
  if (twice.length) throw new Error(`the menu lists ${twice.join(", ")} twice`);
  if (!names.some((n) => /Move up|Move down/.test(n))) throw new Error("no Move up or Move down");
  await page.keyboard.press("Escape");
}, "phone");

journey("phone: a pinned source moves up among the pinned from its long press, with Undo (parity, Codex UX sweep 4)", async (page) => {
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Sources" }));
  const row = (t: string) => page.locator(".phone-sources li").filter({ hasText: t }).first();
  const pinIt = async (t: string) => { await press(page, row(t)); await tap(page, page.getByRole("menuitem", { name: "Pin to top" })); };
  await pinIt(AGENTS);
  await pinIt(TESTING);
  const order = async () => (await page.locator(".phone-sources li").allInnerTexts()).map((x) => (x.includes(AGENTS) ? "A" : x.includes(TESTING) ? "T" : "")).filter(Boolean).slice(0, 2).join("");
  await until("pinned in the order pinned", async () => (await order()) === "AT");
  await press(page, row(TESTING));
  await tap(page, page.getByRole("menuitem", { name: "Move up" }));
  await until("it moved up", async () => (await order()) === "TA");
  await page.keyboard.press("Meta+z");
  await until("Undo put it back", async () => (await order()) === "AT");
}, "phone");

journey("phone: Undo of a filing under an archived skill archives the skill again, as on the Mac (F620)", async (page) => {
  // Architecture review 2026-11-24 (2): the phone's own copy of the Mac's refile left the skill it had brought back.
  type Core = { run: <T>(args: string[], input: string | null) => Promise<T> };
  const run = <T,>(...args: string[]) => page.evaluate(async (args) => ((await import("/src/phone/core.ts" as string)) as Core).run<unknown>([...args, "--json"], null), args) as Promise<T>;
  const shelved = await run<{ id: string }>("skills", "add", "Shelved skill");
  try {
    await run("skills", "archive", shelved.id);
    const archived = async () => !!(await run<{ id: string; archived?: boolean }[]>("skills")).find((k) => k.id === shelved.id)?.archived;
    await Bun.sleep(1000); // the page's writes reach IndexedDB in the background
    await page.reload();
    await tap(page, page.getByRole("button", { name: "Open menu" }));
    await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Sources" }));
    const row = page.locator(".phone-sources li").filter({ hasText: AGENTS }).first();
    await press(page, row);
    await tap(page, page.getByRole("menuitem", { name: "Skills" }));
    await tap(page, page.getByRole("menuitemcheckbox", { name: "Shelved skill" }));
    await until("filing under it brought the skill back", async () => !(await archived()));
    await tap(page, page.locator(".toast").filter({ hasText: "under Shelved skill" }).getByRole("button", { name: "Undo" }));
    await until("Undo archived the skill again", archived);
    await Bun.sleep(400);
    if (!(await archived())) throw new Error("the skill came back after Undo archived it");
  } finally {
    await run("skills", "rm", shelved.id);
  }
}, "phone");
journey("phone: Sources narrows by kind and skill from Filter, each a tag under the title that a tap lets go (F493, D286)", async (page) => {
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Sources" }));
  const rows = () => page.locator(".phone-sources li").count();
  const all = await rows();
  const value = async (field: string, name: RegExp) => {
    await tap(page, page.getByRole("button", { name: /^Filter by/ }));
    await tap(page, page.locator(".action-sheet .pick-row").filter({ hasText: field }));
    // The row that steps back is a 44 pt tap, as the rows under it are (F545: it was 36).
    const back = (await page.locator(".action-sheet .sheet-back").boundingBox())!.height;
    if (back < 44) throw new Error(`the sheet's back row is a ${back} pt tap`);
    const row = page.locator(".action-sheet").getByRole("checkbox", { name });
    await tap(page, row);
    // The sheet stays, ticked, so several can be picked.
    await until(`the ${field} value is ticked and the sheet stays`, async () => (await row.getAttribute("aria-checked")) === "true");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.locator(".action-sheet").waitFor({ state: "detached" });
  };
  await value("Kind", /^Audio/);
  await until("only the audio lecture is listed", async () => (await rows()) === 1 && (await page.locator(".phone-sources li").innerText()).includes("Lecture 4"));
  await value("Skill", /^AI/);
  // Fields narrow together: the one audio lecture isn't filed under AI.
  await page.getByText("No sources match these filters.").waitFor();
  // Its Clear them is a 44 pt tap round its line (Codex UX sweep 10).
  const clear = await page.getByRole("button", { name: "Clear them" }).evaluate((e) => { const r = e.getBoundingClientRect(); const a = getComputedStyle(e, "::after"); return a.content !== "none" && a.position === "absolute" ? r.height + Math.max(0, -parseFloat(a.top) || 0) + Math.max(0, -parseFloat(a.bottom) || 0) : r.height; });
  if (clear < 44) throw new Error(`Clear them is a ${clear} pt tap`);
  const tags = page.locator(".phone-filter-tag");
  if ((await tags.count()) !== 2) throw new Error(`${await tags.count()} filter tags, not 2`);
  const box = (await tags.first().boundingBox())!;
  if (box.height < 44) throw new Error(`a filter tag is a ${box.height} pt tap`);
  await tap(page, tags.filter({ hasText: "Audio" }));
  await until("AI's source alone", async () => (await rows()) === 1 && (await page.locator(".phone-sources li").innerText()).includes(AGENTS));
  await tap(page, tags.first());
  await until("every source is back", async () => (await rows()) === all);
}, "phone");

journey("phone: Select picks several sources and the bar at the foot archives them as one step, with one Undo (F494, D283)", async (page) => {
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Sources" }));
  const row = (t: string) => page.locator(".phone-sources li").filter({ hasText: t }).first();
  const bar = page.locator(".pick-bar");
  // From the title's Select: none picked yet, and the bar says what a tap does.
  await tap(page, page.getByRole("button", { name: "Select", exact: true }));
  await bar.getByText("Tap sources to pick them").waitFor();
  await tap(page, row(AGENTS));
  await bar.getByText("1 picked").waitFor();
  if (await page.locator(".phone-reader").count()) throw new Error("a tap while picking opened the source");
  await tap(page, bar.getByRole("button", { name: "Clear the pick" }));
  await bar.waitFor({ state: "detached" });
  // From a row's long press: that row is picked.
  await press(page, row(AGENTS));
  await tap(page, page.getByRole("menuitem", { name: "Select" }));
  await bar.getByText("1 picked").waitFor();
  await tap(page, row(TESTING));
  await bar.getByText("2 picked").waitFor();
  const b = (await bar.boundingBox())!;
  if (b.x < 0 || b.x + b.width > 390) throw new Error(`the bar runs off the screen: ${Math.round(b.x)} to ${Math.round(b.x + b.width)}`);
  for (const btn of await bar.locator("button").all()) {
    const k = (await btn.boundingBox())!;
    if (k.width < 44 || k.height < 44) throw new Error(`a bar button is a ${Math.round(k.width)}×${Math.round(k.height)} pt tap`);
  }
  await tap(page, bar.getByRole("button", { name: "Archive" }));
  await until("both left the list and the pick ended", async () => !(await row(AGENTS).count()) && !(await row(TESTING).count()) && !(await bar.count()));
  await page.keyboard.press("Meta+z");
  await until("one Undo brought both back", async () => (await row(AGENTS).count()) === 1 && (await row(TESTING).count()) === 1);
}, "phone");

journey("phone: a plan line whose save fails as he goes Back opens on his words again (Codex UX sweep 5)", async (page) => {
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Learning" }));
  await tap(page, page.locator(".phone-skill .forge-door"));
  await tap(page, page.getByRole("button", { name: "Add something to try" }));
  await page.getByLabel("I’ll…").fill("Explain one idea");
  await page.getByLabel("When…").fill("On the bus");
  await tap(page, page.locator(".forge-add").getByRole("button", { name: "Add", exact: true }));
  await tap(page, page.locator(".phone-skill .forge-open").filter({ hasText: "Explain one idea" }).first());
  const when = page.locator(".plan-line", { hasText: /^When/ }).locator("textarea");
  await when.fill("After I board the train");
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { try: "disk full" }));
  try {
    await tap(page, page.locator(".phone-full .phone-back").first());
    await page.locator(".phone-skill .forge-open").first().waitFor();
    await Bun.sleep(400);
  } finally {
    await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
  }
  await tap(page, page.locator(".phone-skill .forge-open").filter({ hasText: "Explain one idea" }).first());
  const v = await page.locator(".plan-line", { hasText: /^When/ }).locator("textarea").inputValue();
  if (v !== "After I board the train") throw new Error(`the correction is gone: When reads "${v}"`);
}, "phone");
