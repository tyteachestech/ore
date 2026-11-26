import { join } from "node:path";
import { journey, keyboardUp, PHONE_LIB, phoneSource, phoneWith, pointAt, press, settled, slid, swipe, tap, TESTING, until } from "../harness";

journey("phone: the check-in before a session asks about what he is trying, its buttons are 44 pt taps, and Not yet goes on to the first exercise (D324)", async (page) => {
  // The seed's library has something he is trying, last touched before today.
  await page.evaluate(() => localStorage.setItem("e2e.check-in", "1"));
  // A day on for Date only: an installed clock also fakes requestAnimationFrame and timers, so the window checks
  // (HYGIENE) ran two "frames" a moment apart while a screen still slid in, and saw it cut (F468).
  await page.clock.setFixedTime(new Date(Date.now() + 26 * 3600e3));
  await page.reload();
  await page.locator(".phone-app").waitFor();
  await tap(page, page.getByRole("button", { name: "Start review" }).first());
  await tap(page, page.locator(".review-pick").getByRole("button", { name: "Start review" }));
  const ask = page.locator(".checkin");
  await ask.waitFor();
  const small = await page.locator(".review").evaluate((root) => [...root.querySelectorAll<HTMLElement>("button")].map((b) => ({ r: b.getBoundingClientRect(), name: b.getAttribute("aria-label") ?? b.textContent })).filter(({ r }) => r.width < 44 || r.height < 44).map(({ r, name }) => `${name} ${Math.round(r.width)}×${Math.round(r.height)}`));
  if (small.length) throw new Error(`taps under 44 pt at the check-in: ${small.join(", ")}`);
  await tap(page, page.getByRole("button", { name: "Not yet" }));
  await ask.waitFor({ state: "detached" });
  await page.getByRole("radio", { name: "Think so" }).or(page.locator(".review-q")).first().waitFor();
  // The first exercise's screen settles where it belongs (F468: on CI it was once seen 17 px in).
  await until("no slide is still running", () => page.evaluate(() => document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getComputedTiming().iterations === Infinity)));
  const x = await page.locator(".review").first().evaluate((e) => Math.round(e.getBoundingClientRect().left));
  if (x !== 0) throw new Error(`the first exercise's screen settled ${x} px in from the left`);
}, "phone");

journey("phone: in Review the buttons he taps on every exercise sit at the foot of the screen, and what the last answer won stands above them (F137)", async (page) => {
  // How sure he is, then the ratings, sat mid-screen with the bottom 40% empty: a reach for one thumb.
  await tap(page, page.getByRole("button", { name: "Start review" }).first());
  await tap(page, page.locator(".review-pick").getByRole("button", { name: "Start review" }));
  const foot = (sel: string) => page.locator(sel).evaluate((el) => Math.round(innerHeight - el.getBoundingClientRect().bottom));
  let seen = 0;
  for (let i = 0; i < 12 && seen < 2; i++) {
    const sure = page.getByRole("radio", { name: "Think so" });
    await sure.or(page.locator(".phone-full .review-end")).first().waitFor();
    if (!(await sure.count())) break;
    const typed = (await page.locator(".phone-full textarea:visible").count()) > 0;
    if (!typed) {
      // An exercise answered in his head: nothing under the question but the three buttons, at the foot.
      const gap = await foot(".quiz-sure");
      if (gap > 60) throw new Error(`How sure are you? ends ${gap}px above the foot of the screen`);
      const moment = page.locator(".review-moment");
      if (await moment.count()) {
        const over = await moment.evaluate((m) => Math.round(m.getBoundingClientRect().bottom - document.querySelector("#review-sure")!.getBoundingClientRect().top));
        if (over > 0) throw new Error(`what the last answer won covers the confidence buttons by ${over}px`);
      }
    }
    if (typed) await tap(page, page.getByRole("button", { name: "No idea" }));
    else await tap(page, sure);
    const good = page.getByRole("button", { name: "Good", exact: true });
    await good.waitFor();
    const gap = await foot(".review-rate");
    const tall = await page.locator(".review-body").evaluate((b) => b.scrollHeight > b.clientHeight + 1);
    // A long answer scrolls and the ratings follow it; a short one leaves them at the foot.
    if (!tall && gap > 60) throw new Error(`the ratings end ${gap}px above the foot of the screen`);
    if (!typed) seen++;
    await tap(page, good);
  }
  if (!seen) throw new Error("no exercise answered in his head came up");
}, "phone");

journey("phone: a skill's header is one line of its rocks in the order they grow, ending in the level ring and the cut count (F141)", async (page) => {
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer section button").filter({ hasText: "Learning" }));
  const line = page.locator(".phone-skill .strength-line");
  await line.waitFor();
  const got = await line.evaluate((el) => {
    const x = (q: string) => [...el.querySelectorAll(q)].map((e) => Math.round(e.getBoundingClientRect().left));
    const kinds = [...el.querySelectorAll(".strength-step svg.gem")].map((g) => (g as HTMLElement).dataset.kind);
    const shown = (q: string) => !!el.closest(".hero-strength")!.querySelector<HTMLElement>(q)?.offsetWidth;
    return { kinds, xs: [...x(".strength-step"), ...x(".strength-end .gem-ring"), ...x(".strength-lv")], rows: new Set([...el.children].map((c) => Math.round(c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2))).size, big: shown(":scope > .gem-ring") || shown(".strength-side"), end: el.querySelector(".strength-end")!.textContent, wide: document.documentElement.scrollWidth };
  });
  const order = ["rough", "dull", "ready"];
  if (!got.kinds.length || got.kinds.some((k, i) => order.indexOf(k!) < 0 || (i > 0 && order.indexOf(k!) <= order.indexOf(got.kinds[i - 1]!)))) throw new Error(`the rocks read ${got.kinds.join()}, not in the order rough, missed, nearly cut`);
  if (got.xs.join() !== [...got.xs].sort((a, b) => a - b).join()) throw new Error(`the line is out of order: ${got.xs.join()}`);
  if (got.rows !== 1) throw new Error("the rock line wraps or its parts sit off one midline");
  if (got.big) throw new Error("the Mac's big ring or count still shows under the line");
  if (!/^\d+$/.test(got.end ?? "")) throw new Error(`the line ends in "${got.end}", not the cut count`);
  if (got.wide > 390) throw new Error(`the page scrolls sideways: ${got.wide}`);
  const note = (await page.locator(".phone-skill .phone-note-row").boundingBox())!.y;
  if (note > 190) throw new Error(`Your note starts at ${Math.round(note)} pt: the header takes too much room`);
}, "phone");

journey("phone: Review's confidence labels stay in their buttons at the largest text, and Open in source is a 44 pt tap (F100, F101)", async (page) => {
  // At iOS's largest text "Think so" wrapped and its "so" hung below the button, which kept the Mac's 40px height;
  // Open in source stayed the Mac's 24px link, and a tap just off it did nothing.
  await page.evaluate(() => document.documentElement.style.setProperty("--type", String(28 / 17)));
  await tap(page, page.getByRole("button", { name: "Start review" }).first());
  await tap(page, page.locator(".review-pick").getByRole("button", { name: "Start review" }));
  const reach = (e: HTMLElement): [number, number] => {
    const r = e.getBoundingClientRect();
    let [w, h] = [r.width, r.height];
    for (const at of ["::before", "::after"]) {
      const cs = getComputedStyle(e, at);
      if (cs.content === "none" || cs.position !== "absolute") continue;
      const out = (v: string) => Math.max(0, -parseFloat(v) || 0);
      w = Math.max(w, r.width + out(cs.left) + out(cs.right));
      h = Math.max(h, r.height + out(cs.top) + out(cs.bottom));
    }
    return [w, h];
  };
  for (let i = 0; ; i++) {
    if (i > 12) throw new Error("no exercise in the review showed its source");
    const sure = page.getByRole("radio", { name: "Think so" });
    await sure.or(page.locator(".phone-full .review-end")).first().waitFor();
    if (!(await sure.count())) throw new Error("the review ended before any exercise showed its source");
    const spill = await page.locator(".quiz-sure button").evaluateAll((els) => els.flatMap((b) => {
      const box = b.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(b);
      const text = range.getBoundingClientRect();
      return text.bottom > box.bottom + 1 || text.top < box.top - 1 ? [`${b.textContent}: text ${Math.round(text.top)}–${Math.round(text.bottom)}, button ${Math.round(box.top)}–${Math.round(box.bottom)}`] : [];
    }));
    if (spill.length) throw new Error(`a confidence label spills out of its button: ${spill.join("; ")}`);
    const field = page.locator(".phone-full textarea:visible");
    if (await field.count()) (await tap(page, field), await page.keyboard.type("Retrieval makes the memory stronger."));
    await tap(page, sure);
    const check = page.locator(".phone-full button:visible").filter({ hasText: /^Check/ });
    if (await check.count()) await tap(page, check);
    const good = page.getByRole("button", { name: "Good", exact: true });
    await good.waitFor();
    const open = page.getByRole("button", { name: /Open in source/ });
    if (await open.count()) {
      const [w, h] = await open.evaluate(reach);
      if (w < 44 || h < 44) throw new Error(`Open in source is ${Math.round(w)}×${Math.round(h)} pt to a finger: want 44`);
      // And a finger 20 pt above or below its middle lands on it: nothing clips or covers the margin.
      const off = await open.evaluate((b) => {
        const r = b.getBoundingClientRect();
        const x = r.left + r.width / 2, y = r.top + r.height / 2;
        return [y - 20, y + 20].filter((at) => !b.contains(document.elementFromPoint(x, at))).map((at) => Math.round(at - y));
      });
      if (off.length) throw new Error(`a tap ${off.join(" and ")} pt off Open in source's middle misses it`);
      break;
    }
    const q = await page.locator(".review-q").innerText();
    await tap(page, good);
    await until("the next exercise comes up", async () => (await page.locator(".phone-full .review-end").count()) > 0 || (await page.locator(".review-q").innerText().catch(() => "")) !== q);
  }
}, "phone");

journey("phone: every screen's text follows the iPhone's text size, and Start review still holds its label at the largest (F70)", async (page) => {
  // Ore drew every size in fixed pixels, so a phone set to larger text read Ore at the default size.
  const size = (sel: string) => page.locator(sel).first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  const type = (t: number) => page.evaluate((t) => document.documentElement.style.setProperty("--type", String(t)), t);
  await type(1);
  const start = page.getByRole("button", { name: "Start review" });
  const before = await start.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  await type(28 / 17); // the largest Ore follows: the first accessibility size
  const after = await start.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  if (Math.abs(after / before - 28 / 17) > 0.02) throw new Error(`Start review's text went from ${before}px to ${after}px at 28/17`);
  const clipped = await start.evaluate((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1);
  if (clipped) throw new Error("Start review clips its label at the largest text size");
  await type(1);
  await phoneSource(page, "The Story Spine");
  const body = await size(".phone-reader .doc p");
  await type(1.353);
  const larger = await size(".phone-reader .doc p");
  // A source reads at 20px and takes three quarters of the change (F325): 25.3px, above iOS's 23pt body.
  if (Math.abs(body - 20) > 0.1 || Math.abs(larger - 20 * (1 + 0.353 * 0.75)) > 0.2) throw new Error(`the reader's text went from ${body}px to ${larger}px at 1.353`);
}, "phone");

journey("phone: a long press on a skill, on Today or in the drawer, opens the skill's menu, and Review this skill reviews it", async (page) => {
  // Tyler 2026-11-12: skills had no menu on the phone at all. The Mac's right-click, less Delete.
  await press(page, page.locator(".home-skill").first());
  for (const name of ["Open", "Review this skill", "Edit skill…", "Importance", "Archive skill"]) await page.getByRole("menuitem", { name }).waitFor();
  if (await page.getByRole("menuitem", { name: /Delete/ }).count()) throw new Error("Delete skill is on the phone's menu");
  await page.keyboard.press("Escape");
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await press(page, page.locator(".phone-drawer section button").first());
  await tap(page, page.getByRole("menuitem", { name: "Review this skill" }));
  await page.locator(".phone-full .review, .phone-full .empty-state, .phone-full .loading").first().waitFor();
}, "phone");

journey("phone: Undo of Archive course brings back the lessons it archived, not one archived before (F573)", async (page) => {
  // Codex deep scan 2026-11-24 (intake 6): Undo ran the whole course's restore, so a lesson archived before came back too.
  type Core = { run: <T>(args: string[], input: string | null) => Promise<T> };
  const ids = await page.evaluate(async (root) => {
    const core = (await import("/src/phone/core.ts" as string)) as Core;
    await core.run(["ls", "--json"], null);
    const items = (await import(`/@fs${root}/packages/core/src/items.ts`)) as { createItem: (lib: { root: string }, input: object) => Promise<{ meta: { id: string } }> };
    const made = [];
    for (const part of [1, 2]) made.push((await items.createItem({ root: "/lib" }, { type: "markdown", title: `Undo course lesson ${part}`, body: `Lesson ${part} of the undo course.`, course: { id: "undo-course", title: "Undo course", part } })).meta.id);
    await core.run(["archive", made[1]!, "--json"], null);
    return made;
  }, join(import.meta.dir, "../../../.."));
  const archivedOf = () => page.evaluate(async (ids) => {
    const core = (await import("/src/phone/core.ts" as string)) as Core;
    return (await Promise.all(ids.map(async (id) => !!(await core.run<{ archived_at?: string }>(["show", id, "--json"], null)).archived_at))).join("/");
  }, ids);
  await Bun.sleep(1000); // the page's writes reach IndexedDB in the background
  await page.reload();
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Sources" }));
  const course = page.locator(".phone-course").filter({ hasText: "Undo course" });
  await press(page, course);
  await tap(page, page.getByRole("menuitem", { name: "Archive course" }));
  await until("the course is archived", async () => (await archivedOf()) === "true/true");
  await tap(page, page.locator(".toast").filter({ hasText: "Archived “Undo course”" }).getByRole("button", { name: "Undo" }));
  await until("Undo brings back only the lesson it archived", async () => (await archivedOf()) === "false/true");
  await Bun.sleep(400);
  if ((await archivedOf()) !== "false/true") throw new Error("Undo of Archive course also brought back a lesson archived before it");
  // Undo tapped before the Archive's answer is back: it waits for it, and still brings back the lesson it put away.
  await page.evaluate(() => ((window as unknown as { __ORE_SLOW?: object }).__ORE_SLOW = { course: 1500 }));
  await press(page, course);
  await tap(page, page.getByRole("menuitem", { name: "Archive course" }));
  await tap(page, page.locator(".toast").filter({ hasText: "Archived “Undo course”" }).getByRole("button", { name: "Undo" }));
  await page.evaluate(() => delete (window as unknown as { __ORE_SLOW?: object }).__ORE_SLOW);
  await until("a quick Undo brings back the lesson it archived", async () => (await archivedOf()) === "false/true");
}, "phone");

journey("phone: Settings in the drawer changes the daily goal and the reminder, and they stay (D228)", async (page) => {
  const settings = async () => {
    await tap(page, page.getByRole("button", { name: "Open menu" }));
    await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Settings" }));
    await page.locator(".phone-settings h1").waitFor();
  };
  await settings();
  await tap(page, page.getByRole("radiogroup", { name: "Minutes a day" }).getByRole("radio", { name: "20" }));
  await tap(page, page.getByRole("switch", { name: "Reminder" }));
  await page.locator(".phone-time").waitFor();
  await page.locator(".phone-settings").getByText("isn’t in iCloud").waitFor();
  await settled(page); // the reload drops a save still on its way to the mock, which a real relaunch does not (F477)
  await page.reload();
  await page.locator(".phone-settings h1").waitFor();
  await until("the goal stayed 20", async () => (await page.getByRole("radiogroup", { name: "Minutes a day" }).getByRole("radio", { name: "20" }).getAttribute("aria-checked")) === "true");
  if ((await page.locator(".phone-time").inputValue()) !== "09:00") throw new Error("the reminder didn't stay on at 9:00");
  await tap(page, page.locator(".phone-back"));
  await page.locator(".phone-settings").waitFor({ state: "detached" });
}, "phone");

journey("phone: a goal changed in Settings shows on Today on the way back, without a relaunch (Codex sweep 4)", async (page) => {
  const of = page.locator(".home-today .goal-of");
  await of.waitFor();
  const was = await of.innerText();
  const want = was.includes("of 5 min") ? "15" : "5";
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Settings" }));
  await page.locator(".phone-settings h1").waitFor();
  const radio = page.getByRole("radiogroup", { name: "Minutes a day" }).getByRole("radio", { name: want, exact: true });
  await tap(page, radio);
  await until(`${want} is picked`, async () => (await radio.getAttribute("aria-checked")) === "true");
  await tap(page, page.locator(".phone-back"));
  await page.locator(".phone-settings").waitFor({ state: "detached" });
  await until(`Today says of ${want} min`, async () => (await of.innerText()).includes(`of ${want} min`));
}, "phone");

journey("phone: ⌘Z on a rating after leaving Review puts Today's minutes back (F159)", async (page) => {
  const ring = page.locator(".home-goal [aria-label$='minutes today']").first();
  await ring.waitFor();
  const before = await ring.getAttribute("aria-label");
  await tap(page, page.getByRole("button", { name: "Start review" }).first());
  await tap(page, page.getByRole("button", { name: /^Start review/ }).last());
  const sure = page.locator(".phone-full button:visible").filter({ hasText: /^Think so/ });
  await sure.waitFor();
  // Three minutes on this exercise, so the rating shows in Today's minutes.
  await page.evaluate(() => { const real = Date.now; Date.now = () => real() + 180_000; });
  const field = page.locator(".phone-full textarea:visible");
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
  await page.keyboard.press("Meta+z");
  await page.locator(".toast").filter({ hasText: /^Undone/ }).first().waitFor();
  await until("Today takes the undone rating back", async () => (await ring.getAttribute("aria-label")) === before, 5000);
}, "phone");

// F411
journey("phone: the mole's note that the goal is met never covers the buttons he answers with", async (page) => {
  // A goal of five minutes, so it is met with exercises still to come (the seed has few due).
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Settings" }));
  await tap(page, page.getByRole("radiogroup", { name: "Minutes a day" }).getByRole("radio", { name: "5", exact: true }));
  await tap(page, page.locator(".phone-back"));
  await page.locator(".phone-settings").waitFor({ state: "detached" });
  await tap(page, page.getByRole("button", { name: "Start review" }).first());
  await tap(page, page.getByRole("button", { name: /^Start review/ }).last());
  const note = page.locator(".phone-full .review-goal");
  const sure = page.locator(".phone-full button:visible").filter({ hasText: /^Think so/ });
  const good = page.locator(".phone-full button:visible").filter({ hasText: /^Good/ });
  /** How far the note reaches into the row of buttons, in px; 0 or less is clear of it. */
  const over = (row: string) => page.evaluate((sel) => {
    const n = document.querySelector(".phone-full .review-goal")?.getBoundingClientRect(), r = document.querySelector(`.phone-full ${sel}`)?.getBoundingClientRect();
    return n && r ? Math.round(Math.min(n.bottom, r.bottom) - Math.max(n.top, r.top)) : 0;
  }, row);
  const end = page.locator(".phone-full .review-end");
  let checked = 0;
  for (let n = 0; n < 24 && checked < 2; n++) {
    await sure.or(good).or(end).first().waitFor();
    if (await end.count()) break;
    if (await note.isVisible()) {
      for (const row of ["#review-sure", ".review-rate"]) if ((await over(row)) > 0) throw new Error(`the goal note covers ${row} by ${await over(row)}px`);
      checked++;
    }
    if (await good.count()) {
      // After No idea a Good wants a second press (D237), so a miss is rated as one.
      const again = page.locator(".phone-full button:visible").filter({ hasText: /^Again/ });
      await tap(page, (await page.getByText("No idea", { exact: true }).count()) ? again : good);
    } else {
      // Three minutes an exercise (the cap), so the day's five are met in two.
      await page.evaluate(() => { const real = Date.now; Date.now = () => real() + 181_000; });
      await tap(page, (await page.locator(".phone-full textarea:visible").count()) ? page.getByRole("button", { name: "No idea" }) : sure);
    }
    await page.waitForTimeout(700);
  }
  if (!checked) throw new Error("the goal was never met mid-session, so the note never showed");
}, "phone");

journey("phone: a rating still saves after the clock is set back (F183)", async (page) => {
  // The time on an exercise came out negative, core refused it ("elapsed_ms: Too small"), and nothing saved.
  await page.clock.install({ time: new Date("2027-03-12T20:00:00Z") });
  await page.reload();
  await page.locator(".phone-opening").waitFor({ state: "detached" });
  await tap(page, page.getByRole("button", { name: "Start review" }).first());
  await tap(page, page.getByRole("button", { name: /^Start review/ }).last());
  const rate = async () => {
    const sure = page.locator(".phone-full button:visible").filter({ hasText: /^Think so/ });
    await sure.waitFor();
    const field = page.locator(".phone-full textarea:visible");
    if (await field.count()) (await tap(page, field), await page.keyboard.type("Retrieval makes the memory stronger."));
    await tap(page, sure);
    const check = page.locator(".phone-full button:visible").filter({ hasText: /^Check/ });
    if (await check.count()) await tap(page, check);
    await tap(page, page.locator(".phone-full button:visible").filter({ hasText: /^Good/ }));
  };
  await rate();
  await page.locator(".phone-full button:visible").filter({ hasText: /^Think so/ }).waitFor();
  await page.clock.setSystemTime(new Date("2027-03-11T20:01:00Z"));
  await rate();
  await page.waitForTimeout(800);
  const failed = await page.locator(".toast").filter({ hasText: /elapsed|Couldn/ }).count();
  if (failed) throw new Error(`the rating after the clock went back failed: ${await page.locator(".toast").first().innerText()}`);
}, "phone");

journey("phone: a session across midnight counts only the new day's minutes toward its goal (F184)", async (page) => {
  // 4 minutes before midnight and 6 after said "Goal met" on a 10-minute goal: yesterday's were added in.
  const late = new Date();
  late.setHours(23, 55, 0, 0);
  await page.clock.install({ time: late });
  await page.reload();
  await page.locator(".phone-opening").waitFor({ state: "detached" });
  await tap(page, page.getByRole("button", { name: "Start review" }).first());
  await tap(page, page.getByRole("button", { name: /^Start review/ }).last());
  for (const wait of ["02:00", "02:00", "03:00", "03:00"]) {
    const sure = page.locator(".phone-full button:visible").filter({ hasText: /^Think so/ });
    await sure.waitFor();
    await page.clock.fastForward(wait);
    const field = page.locator(".phone-full textarea:visible");
    if (await field.count()) (await tap(page, field), await page.keyboard.type("Retrieval makes the memory stronger."));
    await tap(page, sure);
    const check = page.locator(".phone-full button:visible").filter({ hasText: /^Check/ });
    if (await check.count()) await tap(page, check);
    await tap(page, page.locator(".phone-full button:visible").filter({ hasText: /^Good/ }));
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(1500);
  if (await page.getByText("Goal met").count()) throw new Error("the goal was said met with 6 of today's 10 minutes");
}, "phone");

journey("phone: a review left after midnight with no rating since shows the new day's minutes in its end ring (F365)", async (page) => {
  // A session before midnight, then a second rated before it and left after it: the ring's centre kept the minutes
  // from before the second session, yesterday's, though the new day had none (Codex sweep 10, MONTHS-1).
  const late = new Date();
  late.setHours(23, 40, 0, 0);
  await page.clock.install({ time: late });
  await page.reload();
  await page.locator(".phone-opening").waitFor({ state: "detached" });
  const sure = page.locator(".phone-full button:visible").filter({ hasText: /^Think so/ });
  const rate = async (wait: string) => {
    await sure.waitFor();
    await page.clock.fastForward(wait);
    const field = page.locator(".phone-full textarea:visible");
    if (await field.count()) (await tap(page, field), await page.keyboard.type("Retrieval makes the memory stronger."));
    await tap(page, sure);
    const check = page.locator(".phone-full button:visible").filter({ hasText: /^Check/ });
    if (await check.count()) await tap(page, check);
    await tap(page, page.locator(".phone-full button:visible").filter({ hasText: /^Good/ }));
  };
  const start = async () => {
    await tap(page, page.getByRole("button", { name: "Start review" }).first());
    await tap(page, page.getByRole("button", { name: /^Start review/ }).last());
  };
  await start();
  await rate("03:00");
  await rate("03:00");
  await sure.waitFor();
  await tap(page, page.getByRole("button", { name: "Leave review" }));
  await page.locator(".review-end").waitFor();
  await tap(page, page.locator(".review-foot").getByRole("button", { name: "Done" }));
  await until("Review is closed", async () => !(await page.locator(".phone-full .review").count()));
  await start();
  await rate("02:00");
  await sure.waitFor();
  // The next exercise stays open past midnight, and nothing is rated on the new day.
  await page.clock.fastForward("12:00");
  await tap(page, page.getByRole("button", { name: "Leave review" }));
  const centre = page.locator(".review-end .end-lap-n");
  await centre.waitFor({ timeout: 8000 });
  const ring = await page.locator(".review-end [aria-label$='minutes today']").first().getAttribute("aria-label");
  const today = Number(/^(\d+) of/.exec(ring ?? "")?.[1]);
  await page.waitForTimeout(2500);
  const shown = Number(/^(\d+)/.exec((await centre.getAttribute("aria-label")) ?? "")?.[1]);
  if (shown !== today) throw new Error(`the end ring shows ${shown} min, but today has ${today} (the ring's own label: “${ring}”)`);
}, "phone");

journey("phone: a rating after midnight whose day could not be read still counts on the end ring (review of #443)", async (page) => {
  // Ratings just after midnight whose read of the new day failed, then leaving: finish took the new day as one
  // this session added nothing to, so the ring started at the day's whole count and never ran up. (Past the goal,
  // so the count runs up from the goal however many gems the session cut.)
  const late = new Date();
  late.setHours(23, 58, 0, 0);
  await page.clock.install({ time: late });
  await page.reload();
  await page.locator(".phone-opening").waitFor({ state: "detached" });
  const sure = page.locator(".phone-full button:visible").filter({ hasText: /^Think so/ });
  const rate = async (wait: string) => {
    await sure.waitFor();
    await page.clock.fastForward(wait);
    const field = page.locator(".phone-full textarea:visible");
    if (await field.count()) (await tap(page, field), await page.keyboard.type("Retrieval makes the memory stronger."));
    await tap(page, sure);
    const check = page.locator(".phone-full button:visible").filter({ hasText: /^Check/ });
    if (await check.count()) await tap(page, check);
    await tap(page, page.locator(".phone-full button:visible").filter({ hasText: /^Good/ }));
  };
  const fail = (on: boolean) => page.evaluate((on) => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = on ? { today: "The library is busy." } : {}), on);
  await tap(page, page.getByRole("button", { name: "Start review" }).first());
  await tap(page, page.getByRole("button", { name: /^Start review/ }).last());
  await sure.waitFor();
  // The new day can't be read at midnight, nor after the ratings that follow it.
  await fail(true);
  for (let i = 0; i < 4; i++) await rate("03:00");
  await sure.waitFor();
  await fail(false);
  // Every number the centre shows on its way up, from its first.
  await page.evaluate(() => {
    const seen: string[] = ((window as unknown as { __centre: string[] }).__centre = []);
    new MutationObserver(() => {
      const n = document.querySelector(".review-end .end-lap-n")?.getAttribute("aria-label");
      if (n && seen.at(-1) !== n) seen.push(n);
    }).observe(document.body, { subtree: true, childList: true, attributes: true });
  });
  await tap(page, page.getByRole("button", { name: "Leave review" }));
  const centre = page.locator(".review-end .end-lap-n");
  await centre.waitFor({ timeout: 8000 });
  const ring = await page.locator(".review-end [aria-label$='minutes today']").first().getAttribute("aria-label");
  const today = Number(/^(\d+) of/.exec(ring ?? "")?.[1]);
  await page.waitForTimeout(2500);
  const seen = (await page.evaluate(() => (window as unknown as { __centre: string[] }).__centre)).map((l) => Number(/^(\d+)/.exec(l)?.[1]));
  if (!(today >= 10)) throw new Error(`today has ${today} min, short of the goal the ratings after midnight met (“${ring}”)`);
  if (!(seen[0]! < today) || seen.at(-1) !== today) throw new Error(`the end ring counted ${seen.join(" → ")}, never up to today's ${today}: the ratings after midnight were taken as none of this session's`);
}, "phone");

journey("phone: the last rating of a review shows the end screen, not Wrapping up", async (page) => {
  // The phone's `ore` runs in the page, so a rating saves inside the tap's own event: the queue emptied while
  // Review was still busy, and the end screen waited for a tap on Close.
  await tap(page, page.getByRole("button", { name: "Start review" }).first());
  await tap(page, page.getByRole("button", { name: /^Start review/ }).last()); // the picker's, every skill ticked
  const rates = ["Again", "Hard"];
  for (let i = 0; ; i++) {
    if (i > 20) throw new Error("the review never ended");
    const sure = page.locator(".phone-full button:visible").filter({ hasText: /^Think so/ });
    await sure.or(page.locator(".phone-full .review-end")).or(page.getByText("Wrapping up")).first().waitFor();
    if (!(await sure.count())) break;
    const field = page.locator(".phone-full textarea:visible");
    if (await field.count()) (await tap(page, field), await page.keyboard.type("Retrieval makes the memory stronger."));
    await tap(page, sure);
    const check = page.locator(".phone-full button:visible").filter({ hasText: /^Check/ });
    if (await check.count()) await tap(page, check);
    const rating = page.locator(".phone-full button:visible").filter({ hasText: new RegExp(`^${rates[i] ?? "Good"}`) });
    await rating.waitFor();
    await tap(page, rating);
    await rating.waitFor({ state: "detached" }).catch(() => {});
  }
  await until("the end screen comes up by itself", async () => !(await page.getByText("Wrapping up").count()) && (await page.locator(".phone-full .review-end").count()) > 0);
  if (await page.locator(".phone-full .cart-tip, .phone-full .cart-mole").count()) throw new Error("D255: a cart ride appeared on the phone");
}, "phone");

journey("phone: finishing a source says its exercises are drafted on the Mac, not that they start tomorrow (Codex sweep 4)", async (page) => {
  await phoneSource(page, TESTING);
  await tap(page, page.getByRole("button", { name: "Source actions" }));
  await tap(page, page.locator(".action-sheet button").filter({ hasText: "Finish" }));
  await tap(page, page.getByRole("button", { name: "Just mark done" }));
  const card = page.locator(".quiz-made");
  await card.waitFor();
  const said = await card.innerText();
  if (!said.includes("Mac") || said.includes("tomorrow")) throw new Error(`the closing card says “${said}” on a phone that drafts nothing`);
}, "phone");

journey("phone: Review's ⋯ on an Explain being typed opens over the keyboard's place, and the draft stays (F53)", async (page) => {
  // Its sheet opened behind the keyboard: the field kept focus, so the keyboard stayed up over it (Mail and Notes put it away).
  await tap(page, page.getByRole("button", { name: "Start review" }).first());
  await page.locator(".review-pick").waitFor();
  await tap(page, page.locator(".review-pick").getByRole("button", { name: "Start review" }));
  await page.locator(".review-q").waitFor();
  const more = page.getByRole("button", { name: "Exercise actions" });
  const field = page.getByLabel("Your answer");
  for (let i = 0; i < 10 && !(await field.count()); i++) {
    const was = await page.locator(".review-q").innerText();
    await tap(page, more);
    await tap(page, page.locator(".action-sheet").getByRole("button", { name: "Later", exact: true }));
    await until("Later moves on", async () => (await page.locator(".review-q").innerText()) !== was);
  }
  if (!(await field.count())) throw new Error("no Explain exercise came up in 10 Laters");
  await field.focus();
  await field.fill("Fluency feels like knowing");
  const focused = () => field.evaluate((el) => el === document.activeElement);
  await tap(page, more);
  await page.locator(".action-sheet").getByRole("button", { name: "Later", exact: true }).waitFor();
  if (await focused()) throw new Error("the answer field kept focus, so the keyboard stays up over the sheet");
  // Dismissed, the sheet gives the field its focus (and keyboard) back, with the draft. Esc lands with focus
  // nowhere, as it does in the frame before the sheet has taken it: it is still the sheet's key (F61).
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Escape");
  await page.locator(".action-sheet").waitFor({ state: "detached" });
  await page.waitForTimeout(100);
  if (!(await field.count())) throw new Error("Esc on the sheet also left Review");
  if ((await field.inputValue()) !== "Fluency feels like knowing") throw new Error("closing the sheet lost the draft");
  await until("dismissing the sheet gives the answer field its focus back", focused);
  // An action picked moves on: the keyboard doesn't come back up over the next exercise.
  const was = await page.locator(".review-q").innerText();
  await tap(page, more);
  await tap(page, page.locator(".action-sheet").getByRole("button", { name: "Later", exact: true }));
  await until("Later moves on", async () => (await page.locator(".review-q").innerText()) !== was);
  await page.waitForTimeout(100);
  if (await field.count() && (await focused())) throw new Error("picking Later gave the answer field its focus back, so the keyboard comes up again");
}, "phone");

journey("phone: Review's ⋯ puts an exercise off with Later before its answer, and edits it after (D235)", async (page) => {
  // The phone's Review had no Later (D192 kept it on the Mac) and Edit only in a toolbar beside Ask, which needs the Mac.
  await tap(page, page.getByRole("button", { name: "Start review" }).first());
  await page.locator(".review-pick").waitFor();
  await tap(page, page.locator(".review-pick").getByRole("button", { name: "Start review" }));
  const q = page.locator(".review-q");
  await q.waitFor();
  const first = await q.innerText();
  const more = page.getByRole("button", { name: "Exercise actions" });
  await tap(page, more);
  if (await page.locator(".action-sheet").getByRole("button", { name: "Edit exercise", exact: true }).count()) throw new Error("Edit shows before the answer, which would give it away");
  await tap(page, page.locator(".action-sheet").getByRole("button", { name: "Later", exact: true }));
  await until("Later moves on", async () => (await q.innerText()) !== first);
  if (await page.getByRole("button", { name: "Ask about this" }).count()) throw new Error("Ask is on the phone, which can't run the AI");
  await tap(page, page.getByRole("radio", { name: "Think so" }));
  await page.getByRole("button", { name: "Good", exact: true }).waitFor();
  await tap(page, more);
  await tap(page, page.locator(".action-sheet").getByRole("button", { name: "Edit exercise", exact: true }));
  await page.getByRole("button", { name: "Save" }).waitFor();
}, "phone");

journey("phone: Review's ⋯ is as strong as ×, and Edit exercise's question stays under the head with the keyboard up", async (page) => {
  // the ⋯ beside × was three specks; its ink now weighs what ×'s does.
  await tap(page, page.getByRole("button", { name: "Start review" }).first());
  await page.locator(".review-pick").waitFor();
  await tap(page, page.locator(".review-pick").getByRole("button", { name: "Start review" }));
  await page.locator(".review-q").waitFor();
  const ink = (name: string) =>
    page.getByRole("button", { name, exact: true }).evaluate((b) => {
      const d = b.querySelector("svg path")?.getAttribute("d") ?? "";
      return (d.match(/[aA]/g) ?? []).length; // one arc per dot
    });
  const [dots, x] = [await ink("Exercise actions"), await ink("Leave review")];
  if (dots < x * 0.6) throw new Error(`⋯ has ${dots} dots of ink to ×'s ${x}`);
  // Edit exercise's question went up under the head when the keyboard came up (the answer's buttons were pulled into sight).
  await tap(page, page.getByRole("radio", { name: "Think so" }));
  await page.getByRole("button", { name: "Good", exact: true }).waitFor();
  await tap(page, page.getByRole("button", { name: "Exercise actions" }));
  await tap(page, page.locator(".action-sheet").getByRole("button", { name: "Edit exercise", exact: true }));
  const question = page.locator(".review-body textarea").first();
  await tap(page, question);
  await keyboardUp(page, 420); // with iOS's own bar and the notch, as on a 402pt iPhone
  const reviewHead = await page.locator(".review-head").boundingBox();
  await until("the question stays below the head", async () => ((await question.boundingBox())?.y ?? -1) >= reviewHead!.y + reviewHead!.height - 1);
}, "phone");

journey("phone: a Finish recall typed a day ago starts empty, as Review's answers do", async (page) => {
  await page.clock.install();
  await page.reload();
  await page.locator(".phone-app").waitFor();
  await phoneSource(page, TESTING);
  await tap(page, page.getByRole("button", { name: "Source actions" }));
  await tap(page, page.locator(".action-sheet button").filter({ hasText: "Finish" }));
  const recall = page.getByPlaceholder("In your own words…");
  await tap(page, recall);
  await page.keyboard.type("Typed yesterday");
  await Bun.sleep(500);
  await page.reload();
  await until("the same day it comes back", async () => (await recall.inputValue().catch(() => "")) === "Typed yesterday");
  await page.clock.fastForward("25:00:00");
  await page.reload();
  await recall.waitFor();
  await until("a day on it is gone", async () => (await recall.inputValue()) === "");
}, "phone");

journey("phone: the reader's bars go as he scrolls down, stay away as he scrolls back up, and a single tap on the text brings them back and sends them away (D156)", async (page) => {
  // Tyler 2026-11-18: the bars came back on every scroll up, over the text he was rereading. Books shows them on a tap.
  const { createItem } = (await import(join(import.meta.dir, "../../../../packages/core/src/index.ts"))) as { createItem: (lib: { root: string }, d: object) => Promise<{ dir: string }> };
  const body = Array.from({ length: 30 }, (_, i) => `## Part ${i + 1} of the tapped book\n\nRetrieval practice ${i + 1} is the act of pulling information out of memory. It works.\n`).join("\n");
  await phoneWith(page, async () => (await createItem({ root: PHONE_LIB }, { type: "article", title: "A book of tapped parts", body })).dir, async () => {
    await phoneSource(page, "A book of tapped parts");
    const hidden = () => page.locator(".phone-reader .reader").first().evaluate((r) => r.classList.contains("bars-hidden"));
    // His finger's scroll: a touchmove on the text, then the text moves (Playwright's touchscreen only taps).
    const scroll = (by: number) => page.evaluate(async (by) => {
      const el = document.querySelector(".phone-reader .reader-scroll")!;
      for (let i = 0; i < 4; i++) {
        el.dispatchEvent(Object.assign(new Event("touchmove", { bubbles: true }), { touches: [], changedTouches: [] }));
        el.scrollTop += by / 4;
        await new Promise((r) => setTimeout(r, 40));
      }
    }, by);
    await Bun.sleep(400);
    await scroll(600);
    await until("a scroll down hides the bars", hidden);
    await scroll(-200);
    await Bun.sleep(400);
    if (!(await hidden())) throw new Error("a scroll back up brought the bars over the text");
    await Bun.sleep(300); // a tap that stops a scroll is no tap
    const p = await pointAt(page, "practice 12 is", ".phone-reader .doc");
    await page.touchscreen.tap(p.x, p.y);
    await until("a single tap brings the bars back", async () => !(await hidden()));
    await Bun.sleep(400);
    await page.touchscreen.tap(p.x, p.y);
    await until("a second single tap sends them away", hidden);
    await Bun.sleep(400);
    // A double tap highlights its paragraph and leaves the bars as they were.
    await page.touchscreen.tap(p.x, p.y);
    await page.touchscreen.tap(p.x, p.y);
    await page.getByRole("dialog", { name: "Highlight" }).waitFor();
    await Bun.sleep(500);
    if (!(await hidden())) throw new Error("a double tap toggled the bars");
  });
}, "phone");

journey("phone: Sections opens low with the text above it, pulls up to the top of the screen when the outline is long, and a pull down brings it back, then closes (D316)", async (page) => {
  const { createItem } = (await import(join(import.meta.dir, "../../../../packages/core/src/index.ts"))) as { createItem: (lib: { root: string }, d: object) => Promise<{ dir: string }> };
  const body = Array.from({ length: 30 }, (_, i) => `## Part ${i + 1} of the long book\n\nRetrieval practice is the act of pulling information out of memory. `.repeat(1) + "It works.\n").join("\n");
  await phoneWith(page, async () => (await createItem({ root: PHONE_LIB }, { type: "article", title: "A book of thirty parts", body })).dir, async () => {
    await phoneSource(page, "A book of thirty parts");
    await tap(page, page.locator(".read-pill"));
    const sheet = page.locator(".sections-sheet");
    await sheet.waitFor();
    await Bun.sleep(300);
    const box = async () => (await sheet.boundingBox())!;
    const low = await box();
    // Low: at least half the screen's text still shows above it.
    if (low.y < 844 * 0.45) throw new Error(`Sections opens ${Math.round(844 - low.y)}pt tall: the text above it is covered`);
    // A pull up on the list: the sheet grows to the top of the screen, and all thirty parts can be reached.
    const mid = low.y + low.height / 2;
    await swipe(page, [195, mid], [195, mid - 200]);
    await until("the sheet is pulled up under the status bar", async () => { const b = await box(); return b.y < 120 && b.y >= 40; });
    await Bun.sleep(300);
    if (Math.abs((await box()).y + (await box()).height - 844) > 1) throw new Error("the pulled-up sheet left the foot of the screen");
    await sheet.locator(".pick-list").evaluate((l) => l.scrollTo(0, l.scrollHeight));
    const last = (await sheet.locator(".pick-row").last().boundingBox())!;
    if (last.y + last.height > 844) throw new Error("the last section is below the screen");
    // Scrolled down, a pull down scrolls the list back first: the sheet stays.
    await sheet.locator(".pick-list").evaluate((l) => l.scrollTo(0, 200));
    await swipe(page, [195, 400], [195, 520], 200, true);
    if ((await box()).y > 120) throw new Error("a pull on a scrolled list moved the sheet");
    // At its top, a short pull down brings it back to where it opened; another, long, closes it.
    await sheet.locator(".pick-list").evaluate((l) => l.scrollTo(0, 0));
    await swipe(page, [195, 300], [195, 380], 400);
    await until("the sheet is back at its low height", async () => Math.abs((await box()).y - low.y) < 2);
    await swipe(page, [195, low.y + 40], [195, low.y + 300]);
    await sheet.waitFor({ state: "detached" });
    // A short outline has nothing to pull up to: the sheet keeps its height.
    await tap(page, page.getByRole("button", { name: "Back" }));
  });
  await phoneSource(page, TESTING);
  await tap(page, page.locator(".read-pill"));
  const sheet = page.locator(".sections-sheet");
  await sheet.waitFor();
  await Bun.sleep(300);
  const was = (await sheet.boundingBox())!;
  await swipe(page, [195, was.y + was.height / 2], [195, was.y + was.height / 2 - 200]);
  await Bun.sleep(300);
  if (Math.abs((await sheet.boundingBox())!.y - was.y) > 1) throw new Error("a short outline's sheet grew with nothing more to show");
}, "phone");

journey("phone: the phone ticks under his finger on four moments and no others: a long-press menu opening, a row's swipe passing its mark, a rating, a highlight made (D332)", async (page) => {
  // The page asks the shell (Tauri's haptics plugin) for each tick; here the asks are written down instead.
  await page.addInitScript(`window.__ticks = []; window.__TAURI_INTERNALS__ = { ...window.__TAURI_INTERNALS__, invoke: (cmd, args) => (String(cmd).startsWith("plugin:haptics|") ? (window.__ticks.push(String(cmd).split("|")[1] + (args?.style ? ":" + args.style : "")), Promise.resolve(null)) : Promise.reject(new Error("no Tauri here"))) };`);
  await page.reload();
  await page.locator(".phone-opening").waitFor({ state: "detached" });
  const ticks = () => page.evaluate(() => (window as unknown as { __ticks: string[] }).__ticks.join(" "));
  const expectTicks = (when: string, want: string) => until(`${when}: the ticks are "${want}"`, async () => (await ticks()) === want).catch(async (e) => { throw new Error(`${(e as Error).message}, not "${await ticks()}"`); });
  // Opening a screen, the drawer and a sheet are silent, as they are in Apple's apps.
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Sources" }));
  await page.locator(".phone-sources li button").first().waitFor();
  await expectTicks("after the drawer and a tab", "");
  // A long press: one firm tick as the menu opens.
  await press(page, page.locator(".phone-sources li button").first());
  await page.getByRole("menu").waitFor();
  await expectTicks("a long press", "impact_feedback:medium");
  await page.keyboard.press("Escape");
  await page.getByRole("menu").waitFor({ state: "detached" });
  // A rating: one selection tick when it is recorded.
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Today" }));
  await tap(page, page.getByRole("button", { name: "Start review" }).first());
  await tap(page, page.locator(".review-pick").getByRole("button", { name: "Start review" }));
  const sure = page.getByRole("radio", { name: "Think so" });
  await sure.waitFor();
  await slid(page);
  await tap(page, (await page.locator(".phone-full textarea:visible").count()) ? page.getByRole("button", { name: "No idea" }) : sure);
  const hard = page.getByRole("button", { name: "Hard", exact: true });
  await hard.waitFor();
  await tap(page, hard);
  await expectTicks("a rating", "impact_feedback:medium selection_feedback");
  // Out of Review and back to the list.
  // Leave review ends the session (its end screen), and again closes it.
  for (let i = 0; i < 2 && (await page.locator(".phone-full").count()); i++) (await tap(page, page.locator(".phone-full").getByRole("button", { name: "Leave review" })), await page.waitForTimeout(800));
  await page.locator(".phone-full").waitFor({ state: "detached" });
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Sources" }));
  await page.locator(".phone-sources li button").nth(1).waitFor();
  // A highlight: one light tick as it is made (a double tap on a paragraph, D224).
  await tap(page, page.locator(".phone-sources button").filter({ hasText: TESTING }));
  await page.locator(".phone-reader .doc").first().waitFor();
  await slid(page);
  const para = await pointAt(page, "familiarity is easily", ".phone-reader .doc");
  await page.waitForTimeout(300);
  await page.touchscreen.tap(para.x, para.y);
  await page.touchscreen.tap(para.x, para.y);
  await page.getByRole("dialog", { name: "Highlight" }).waitFor();
  await expectTicks("a highlight", "impact_feedback:medium selection_feedback impact_feedback:light");
  await page.keyboard.press("Escape");
  await tap(page, page.locator(".phone-full .phone-back"));
  await page.locator(".phone-full").waitFor({ state: "detached" });
  // A row's swipe: one light tick as it passes the point where letting go acts, none for a short one.
  const row = (await page.locator(".phone-sources li button").nth(1).boundingBox())!;
  const y = row.y + row.height / 2;
  await swipe(page, [300, y], [240, y], 200);
  await page.waitForTimeout(300);
  await expectTicks("a short swipe that springs back", "impact_feedback:medium selection_feedback impact_feedback:light");
  await swipe(page, [330, y], [100, y], 300);
  await expectTicks("a swipe past its mark", "impact_feedback:medium selection_feedback impact_feedback:light impact_feedback:light");
}, "phone");

journey("phone: a try typed and left with Back is there when the Forge's + opens again, in 44 pt fields (Codex UX sweep 5)", async (page) => {
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Learning" }));
  await tap(page, page.locator(".phone-skill .forge-door"));
  await tap(page, page.getByRole("button", { name: "Add something to try" }));
  const plan = page.getByLabel("I’ll…");
  const h = await plan.evaluate((e) => e.getBoundingClientRect().height);
  if (h < 44) throw new Error(`the new try's field is ${h} pt tall`);
  await plan.fill("Explain one idea before opening my notes");
  await page.getByLabel("When…").fill("On the bus home");
  await tap(page, page.locator(".phone-full .phone-back").first());
  await page.locator(".phone-skill .forge-door").waitFor();
  await tap(page, page.locator(".phone-skill .forge-door"));
  await tap(page, page.getByRole("button", { name: "Add something to try" }));
  if ((await page.getByLabel("I’ll…").inputValue()) !== "Explain one idea before opening my notes") throw new Error("the try he typed is gone");
  if ((await page.getByLabel("When…").inputValue()) !== "On the bus home") throw new Error("its When is gone");
}, "phone");

journey("phone: a skill's note opens again where he was in it, and the Dig's buttons are 44 pt taps (Codex UX sweep 8)", async (page) => {
  await tap(page, page.getByRole("button", { name: "Open menu" }));
  await tap(page, page.locator(".phone-drawer button").filter({ hasText: "Learning" }));
  await tap(page, page.getByRole("button", { name: "Your note" }));
  const editor = page.getByRole("textbox", { name: "Skill note" });
  await editor.click();
  await page.keyboard.insertText(Array.from({ length: 40 }, (_, i) => `Line ${i + 1} of a long note about spacing and recall.`).join("\n"));
  const note = page.locator(".phone-note").first();
  await until("the note is long enough to scroll", () => note.evaluate((e) => e.scrollHeight > e.clientHeight + 300));
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await note.evaluate((e) => { e.scrollTop = 400; e.dispatchEvent(new Event("scroll")); });
  await tap(page, page.locator(".phone-full .phone-back").first());
  await tap(page, page.getByRole("button", { name: "Your note" }));
  await until("it opens where he was", () => page.locator(".phone-note").first().evaluate((e) => e.scrollTop > 300));
  await tap(page, page.locator(".phone-full .phone-back").first());
  // The Dig, from the skill's goal (the seed sets none: he writes one first).
  await tap(page, page.getByRole("button", { name: /What could you show you can do\?/ }).first());
  await page.keyboard.insertText("Explain retrieval practice to a beginner");
  await page.keyboard.press("Enter");
  const dig = page.getByRole("button", { name: "Dig" }).first();
  await tap(page, dig);
  await page.getByLabel("What you remember").fill("Testing beats rereading.");
  const small = await page.locator(".skill-recall").evaluate((root) => [...root.querySelectorAll<HTMLElement>(".skill-recall-close, .skill-recall-foot button")].map((b) => b.getBoundingClientRect()).filter((r) => r.width && r.height < 44).length);
  if (small) throw new Error(`${small} of the Dig's buttons are under 44 pt`);
}, "phone");

journey("phone: a tap on an exercise's history line lists each review's rating and date (Codex UX sweep 9)", async (page) => {
  await tap(page, page.getByRole("button", { name: "Start review" }).first());
  await tap(page, page.locator(".review-pick").getByRole("button", { name: "Start review" }));
  const sure = page.getByRole("radio", { name: "Sure" });
  await sure.or(page.locator(".phone-full .review-end")).first().waitFor();
  for (let i = 0; i < 8 && !(await page.locator(".timeline-tap").count()); i++) {
    if (!(await sure.count())) break;
    const field = page.locator(".phone-full textarea:visible");
    if (await field.count()) (await tap(page, field), await page.keyboard.type("Spacing beats cramming."));
    await tap(page, sure);
    const check = page.locator(".phone-full button:visible").filter({ hasText: /^Check/ });
    if (await check.count()) await tap(page, check);
    if (await page.locator(".timeline-tap").count()) break;
    const good = page.locator(".phone-full button:visible").filter({ hasText: /^Good/ });
    await good.waitFor();
    await tap(page, good);
  }
  const line = page.locator(".timeline-tap").first();
  await line.waitFor({ timeout: 3000 });
  await tap(page, line);
  await page.locator(".timeline-list").filter({ hasText: /(Again|Hard|Good|Easy) · / }).waitFor();
}, "phone");

journey("phone: after a rating scrolled down a long answer, the next exercise opens at the top of its question (F740)", async (page) => {
  // A long answer scrolls (the largest text); the scroller kept its place for the next exercise, which opened
  // mid-question. Every exercise here is made tall enough to scroll, so a kept place can't hide in a short one.
  await page.addStyleTag({ content: ".phone-full .review-body::after { content: ''; display: block; height: 2000px; }" });
  await tap(page, page.getByRole("button", { name: "Start review" }).first());
  await tap(page, page.locator(".review-pick").getByRole("button", { name: "Start review" }));
  const body = page.locator(".phone-full .review-body");
  const question = () => page.locator(".phone-full .review-q").first().textContent();
  const sure = page.getByRole("radio", { name: "Think so" });
  for (let i = 0; i < 2; i++) {
    await sure.waitFor();
    const was = await question();
    // No idea, then Again: Good after No idea asks him to confirm.
    const typed = (await page.locator(".phone-full textarea:visible").count()) > 0;
    await tap(page, typed ? page.getByRole("button", { name: "No idea" }) : sure);
    const rate = page.getByRole("button", { name: typed ? "Again" : "Good", exact: true });
    await rate.waitFor();
    await body.evaluate((b) => (b.scrollTop = 600));
    await tap(page, rate);
    await until("the next exercise is up", async () => (await sure.count()) > 0 && (await question()) !== was);
    const top = await body.evaluate((b) => b.scrollTop);
    if (top > 1) throw new Error(`the next exercise opened ${top}px down its screen, below the start of its question`);
  }
}, "phone");
