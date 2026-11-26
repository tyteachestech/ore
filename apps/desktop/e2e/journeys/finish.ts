import { type Page } from "playwright";
import { AGENTS, BRIDGE, hold, isHeld, journey, loaded, openSource, ore, release, type Rigged, select, TESTING, until } from "../harness";

journey("prequestion: a guess typed but not stored is still there when he comes back to the source, and not marked answered", async (page) => {
  const q = "When is an agent the wrong choice?";
  const guess = `When a fixed workflow does the job (${Date.now() % 100000})`;
  await openSource(page, AGENTS);
  const line = page.getByRole("textbox", { name: q });
  if (!(await line.isVisible())) await page.locator(".preq-head").click();
  await page.locator(".preq-q").filter({ hasText: q }).click();
  await line.fill(guess);
  await openSource(page, TESTING);
  await openSource(page, AGENTS);
  await until("the guess is back in its line", async () => (await line.isVisible()) && (await line.inputValue()) === guess);
  if (await page.locator(".preq-row.done").filter({ hasText: q }).count()) throw new Error("the draft was marked answered");
});

journey("prequestions stay in reach: once he has started a source, Reading for lists them from anywhere in it and Enter goes back to the block (D179)", async (page) => {
  const q = "When is an agent the wrong choice?";
  await openSource(page, AGENTS);
  const item = ((await ore("ls")) as { id: string; title: string }[]).find((i) => i.title === AGENTS)!;
  const was = ((await ore("show", item.id)) as { status: string }).status;
  await ore("status", item.id, "reading");
  try {
    await openSource(page, TESTING);
    await openSource(page, AGENTS);
    const chip = page.getByRole("button", { name: /^Reading for \d+ questions?$/ });
    await chip.waitFor();
    if (await page.locator(".preq-head").getAttribute("aria-expanded") === "true") await page.locator(".preq-head").click();
    await page.locator(".reader-scroll, .reader").first().evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await chip.focus();
    await page.getByLabel("What you’re reading for").getByText(q).waitFor();
    await page.keyboard.press("Enter");
    await until("the block is open, in view, with focus on its head", async () =>
      (await page.locator(".preq-head").getAttribute("aria-expanded")) === "true" &&
      (await page.locator(".preq-q").filter({ hasText: q }).isVisible()) &&
      (await page.evaluate(() => document.activeElement?.classList.contains("preq-head") ?? false)));
  } finally {
    await ore("status", item.id, was);
  }
});

journey("finish: ⌘Z during the Source finished moment takes back the finish, not the step before it (Codex UX sweep 3)", async (page) => {
  // A source no other journey finishes: its saved recall and answers would change where their Finish opens.
  const LECTURE = "Lecture 4 the testing effect";
  const item = ((await ore("ls")) as { id: string; title: string; status: string }[]).find((i) => i.title === LECTURE)!;
  await openSource(page, LECTURE);
  await page.getByRole("tab", { name: "Collected" }).click();
  const toggle = page.locator(".cp-head.card .cp-toggle");
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  await page.getByRole("button", { name: "Add a key point", exact: true }).click();
  await page.getByRole("textbox", { name: "Key point", exact: true }).fill("Finish keeps this point");
  await page.keyboard.press("Enter");
  const point = page.locator(".cp-row").filter({ hasText: "Finish keeps this point" });
  await point.waitFor();
  try {
    await page.evaluate(() => ((window as unknown as { __ORE_REPLY: Record<string, unknown> }).__ORE_REPLY = { enrich: { item: "x", title: "x", prequestions: [], skills: [], topics: [], topics_created: [], cards: [] } }));
    await page.getByRole("button", { name: "Finish", exact: true }).click();
    await page.getByLabel("Free recall").fill("Agents loop on tools; workflows follow set paths.");
    // Past the recall's feedback (none comes here) and any questions, to "Done with this source?".
    const doneQ = page.getByRole("heading", { name: "Done with this source?" });
    for (let i = 0; i < 14 && !(await doneQ.isVisible()); i++) {
      const next = page.getByRole("button", { name: /^(Continue|Skip|Skip to questions|Next|No idea|Next question|Finish)$/ }).first();
      if (await next.isVisible().catch(() => false)) await next.click().catch(() => {});
      await Bun.sleep(400);
    }
    await doneQ.waitFor();
    await page.evaluate(() => ((window as unknown as { __ORE_SLOW: Record<string, number> }).__ORE_SLOW = { status: 1500 }));
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await Bun.sleep(200);
    await page.keyboard.press("Meta+z"); // while Done is written, before the second of "Source finished" ends
    await page.evaluate(() => delete (window as unknown as { __ORE_SLOW?: unknown }).__ORE_SLOW);
    await Bun.sleep(3500); // the write, the moment and the Undo that waited for them
    await until("⌘Z took the source back out of Done", async () => ((await ore("ls")) as { id: string; status: string }[]).find((i) => i.id === item.id)?.status !== "done").catch(async (e) => { throw new Error(`${e.message}: it is ${((await ore("ls")) as { id: string; status: string }[]).find((i) => i.id === item.id)?.status}, was ${item.status}`); });
    await Bun.sleep(500);
    const anns = ((await ore("show", item.id, "--annotations")) as { annotations: { note?: string; status?: string }[] }).annotations;
    if (!anns.some((a) => a.note === "Finish keeps this point" && a.status !== "deleted")) throw new Error("⌘Z took back the key point made before Finish");
  } finally {
    await page.evaluate(() => ((window as unknown as { __ORE_REPLY: Record<string, unknown> }).__ORE_REPLY = {}));
    await ore("status", item.id, item.status);
    for (const a of ((await ore("show", item.id, "--annotations")) as { annotations: { id: string; note?: string }[] }).annotations) if (a.note === "Finish keeps this point") await ore("annotate", a.id, "--status", "deleted");
  }
});

journey("finish: a source opened during the Source finished moment stays open, and so does its own Finish (Codex UX sweeps 16, 17)", async (page) => {
  // The moment's second ran out and closed whatever source was open then: the next one he had already opened, and
  // then (sweep 17) the Finish he had already started on it.
  const LECTURE = "Lecture 4 the testing effect";
  const item = ((await ore("ls")) as { id: string; title: string; status: string }[]).find((i) => i.title === LECTURE)!;
  await openSource(page, LECTURE);
  try {
    await page.evaluate(() => ((window as unknown as { __ORE_REPLY: Record<string, unknown> }).__ORE_REPLY = { enrich: { item: "x", title: "x", prequestions: [], skills: [], topics: [], topics_created: [], cards: [] } }));
    await page.getByRole("button", { name: "Finish", exact: true }).click();
    await page.getByLabel("Free recall").fill("Retrieval beats rereading.");
    const doneQ = page.getByRole("heading", { name: "Done with this source?" });
    for (let i = 0; i < 14 && !(await doneQ.isVisible()); i++) {
      const next = page.getByRole("button", { name: /^(Continue|Skip|Skip to questions|Next|No idea|Next question|Finish)$/ }).first();
      if (await next.isVisible().catch(() => false)) await next.click().catch(() => {});
      await Bun.sleep(400);
    }
    await doneQ.waitFor();
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await page.getByText("Source finished").first().waitFor();
    await openSource(page, AGENTS);
    await page.getByRole("button", { name: "Finish", exact: true }).click();
    await page.getByLabel("Free recall").waitFor();
    await Bun.sleep(1800); // past the moment's second
    if (!(await page.locator(".doc-head").filter({ hasText: AGENTS }).isVisible())) throw new Error("the source opened during the moment closed by itself");
    if (!(await page.getByLabel("Free recall").isVisible())) throw new Error("its Finish, started during the moment, closed by itself");
  } finally {
    await page.keyboard.press("Escape").catch(() => {});
    await page.evaluate(() => ((window as unknown as { __ORE_REPLY: Record<string, unknown> }).__ORE_REPLY = {}));
    await ore("status", item.id, item.status);
  }
});

journey("finish: a source that gave no exercises says so and what to mark, not that they start tomorrow (Codex sweep 4)", async (page) => {
  // Put back as it was after: the next journey finishes this source too.
  const item = ((await ore("ls")) as { id: string; title: string; status: string }[]).find((i) => i.title === AGENTS)!;
  try {
    await finishWithNothingDrafted(page);
  } finally {
    await ore("status", item.id, item.status);
  }
});

async function finishWithNothingDrafted(page: Page) {
  await openSource(page, AGENTS);
  await page.evaluate(() => ((window as unknown as { __ORE_REPLY: Record<string, unknown> }).__ORE_REPLY = { enrich: { item: "x", title: "x", prequestions: [], skills: [], topics: [], topics_created: [], cards: [] } }));
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Just mark done" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.locator(".toast").filter({ hasText: "No exercises came from" }).filter({ hasText: "Key point" }).waitFor();
  await page.evaluate(() => ((window as unknown as { __ORE_REPLY: Record<string, unknown> }).__ORE_REPLY = {}));
}

journey("finish: when drafting the cards fails, a toast says why and Try again drafts them", async (page) => {
  await openSource(page, AGENTS);
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { enrich: "Claude is signed out." }));
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Just mark done" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  const toast = page.locator(".toast").filter({ hasText: "weren’t drafted: Claude is signed out." });
  await toast.waitFor();
  await page.evaluate(() => {
    const w = window as unknown as { __ORE_FAIL: Record<string, string>; __ORE_SLOW?: Record<string, number> };
    w.__ORE_FAIL = {};
    w.__ORE_SLOW = { ...w.__ORE_SLOW, enrich: 1500 };
  });
  await toast.getByRole("button", { name: "Try again" }).click();
  await toast.waitFor({ state: "detached" });
  // He asked for it, so it shows while it runs and says when it's done (rehearsal 2026-11-15).
  await page.locator(".toast").filter({ hasText: "Drafting exercises for" }).waitFor();
  await page.locator(".toast").filter({ hasText: "drafted." }).waitFor({ timeout: 8000 });
  await page.evaluate(() => delete (window as unknown as { __ORE_SLOW: Record<string, number> }).__ORE_SLOW.enrich);
  // Back to reading, for the journeys after this one.
  await page.evaluate(async (title) => {
    const ore = (args: string[]) => (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__.invoke("ore", { args });
    const items = (await ore(["ls"])) as { id: string; title: string }[];
    await ore(["status", items.find((i) => i.title === title)!.id, "reading"]);
  }, AGENTS);
});

journey("finish: nothing can be typed into the recall while it saves, so no words are lost behind a save", async (page) => {
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill("# Recall while saving\n\nA page whose recall saves slowly.");
  await page.keyboard.press("Enter");
  await page.locator(".doc").getByText("A page whose recall saves slowly").waitFor();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  const box = page.getByLabel("Free recall");
  await box.fill("First saved recall.");
  await page.evaluate(() => void ((window as unknown as Rigged).__ORE_SLOW = { recall: 1200 }));
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await box.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Added while it saves.");
  const shown = await box.inputValue().catch(() => "First saved recall.");
  await page.evaluate(() => void ((window as unknown as Rigged).__ORE_SLOW = undefined));
  await page.getByRole("button", { name: "Keep reading" }).click();
  if (shown !== "First saved recall.") throw new Error(`the box took ${JSON.stringify(shown)} while saving, and saved only the first sentence`);
});

journey("finish again: the recall box holds the last recall with the caret at its end, and the note holds it once", async (page) => {
  const title = "Recall twice";
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill(`# ${title}\n\nA page to finish twice, adding to the recall the second time.`);
  await page.keyboard.press("Enter");
  await page.locator(".doc").getByText("A page to finish twice").waitFor();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByLabel("Free recall").fill("FIRST recall text.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Keep reading" }).click();
  await page.reload();
  await page.locator(".side-item").first().waitFor();
  await openSource(page, title);
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  const box = page.getByLabel("Free recall");
  await until("the box holds the last recall", async () => (await box.inputValue()) === "FIRST recall text.");
  const caret = await box.evaluate((el: HTMLTextAreaElement) => [el.selectionStart, el.value.length]);
  if (caret[0] !== caret[1]) throw new Error(`the caret is at ${caret[0]} of ${caret[1]}, not at the end`);
  await page.keyboard.type(" SECOND.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Keep reading" }).waitFor();
  const note = await page.evaluate(async (title) => {
    const ore = (args: string[]) => (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__.invoke("ore", { args });
    const items = (await ore(["ls"])) as { id: string; title: string }[];
    return ((await ore(["notes", items.find((i) => i.title === title)!.id])) as { text: string }).text;
  }, title);
  if (note.trim() !== "## Recall\n\nFIRST recall text. SECOND.") throw new Error(`the note is ${JSON.stringify(note)}`);
});

journey("finish: a question on a source with no skill is pointed to Collected, not a skill page", async (page) => {
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill("# No skill yet\n\nA first source, filed under no skill, with one passage worth asking about.");
  await page.keyboard.press("Enter");
  await page.locator(".doc").getByText("A first source, filed under no skill").waitFor();
  await select(page, "one passage worth asking about");
  await page.getByRole("dialog", { name: "Highlight" }).waitFor();
  await loaded(page); // the highlight is saved
  // Marking it a question saves after the closing card opens, as on a slow Mac (CI, 2026-11-11: "1 highlight").
  await hold(page, "annotate");
  await page.getByRole("dialog", { name: "Highlight" }).locator(".intent.question").click();
  await page.locator(".mark-icon.question").first().waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await until("the question is still saving", () => isHeld(page, "annotate"));
  await release(page, "annotate");
  const made = page.locator(".quiz-made-list").filter({ hasText: "1 question" });
  await made.waitFor();
  if ((await made.innerText()).includes("skill page")) throw new Error(`“${await made.innerText()}”: this source has no skill page`);
  await page.getByRole("button", { name: "Keep reading" }).click();
});

journey("finish: drafting the cards starts on Done, not after the moment, so closing the window then still drafts them", async (page) => {
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill("# Drafting at once\n\nA short page whose cards are drafted the moment he says Done.");
  await page.keyboard.press("Enter");
  await page.locator(".doc").getByText("A short page whose cards are drafted").waitFor();
  const enriched: number[] = [];
  page.on("request", (r) => r.method() === "POST" && (r.postData() ?? "").includes('"args":["enrich"') && enriched.push(Date.now()));
  // Esc out of the finish quiz puts focus back in the text (the hygiene guard checks it never falls to <body>).
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.locator("section.quiz").waitFor();
  await page.keyboard.press("Escape");
  await until("Esc puts focus in the text", () => page.evaluate(() => !!document.activeElement?.matches(".reader-scroll")));
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.locator(".quiz-done.moment").waitFor();
  await until("drafting has started while the moment shows", async () => enriched.length > 0, 900);
  if (await page.locator(".toast").filter({ hasText: "Finished “Drafting at once”" }).count()) throw new Error("drafting started only after the moment");
});

journey("finish: drafting that fails after Done stays in front of “Finished” until he acts on it", async (page) => {
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill("# Drafting that fails\n\nA short page whose cards can't be drafted, because the AI is down.");
  await page.keyboard.press("Enter");
  await page.locator(".doc").getByText("A short page whose cards").waitFor();
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { enrich: "Codex isn’t installed." }));
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.locator(".toast").filter({ hasText: "Finished “Drafting that fails”" }).waitFor();
  const failure = page.locator(".toast").filter({ hasText: "weren’t drafted: Codex isn’t installed." });
  await failure.waitFor();
  await page.waitForTimeout(300);
  const front = await page.locator(".toasts > .toast").last().innerText();
  if (!front.includes("weren’t drafted")) throw new Error(`the toast in front is “${front}”, not the drafting failure`);
  // Try again is the only way back to the cards, so the failure stays until he acts on it.
  if (!(await failure.getByRole("button", { name: "Dismiss" }).count())) throw new Error("the drafting failure goes away by itself");
  // A second source that fails too: one toast says both, and its Try again drafts both.
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill("# Drafting that fails again\n\nAnother short page whose cards can't be drafted either.");
  await page.keyboard.press("Enter");
  await page.locator(".doc").getByText("Another short page whose cards").waitFor();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  const both = page.locator(".toast").filter({ hasText: "Exercises for 2 sources weren’t drafted: Codex isn’t installed." });
  await both.waitFor();
  await page.waitForTimeout(300);
  const failures = await page.locator(".toast").filter({ hasText: "weren’t drafted" }).count();
  if (failures !== 1) throw new Error(`${failures} drafting failures stacked`);
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
  const drafted: string[] = [];
  page.on("request", (r) => r.method() === "POST" && (r.postData() ?? "").includes('"args":["enrich"') && drafted.push(r.postData()!));
  await both.getByRole("button", { name: "Try again" }).click();
  await until("Try again drafts both", async () => drafted.length === 2);
});

journey("prequestions: a Try again still running when he leaves and opens the source again shows its wait, and never starts a second run (F185)", async (page) => {
  const title = `Prequestions retried ${Date.now()}`;
  const fail = (on: Record<string, unknown>) => page.evaluate((on) => Object.assign(window as unknown as Record<string, unknown>, on), on);
  await fail({ __ORE_FAIL: { enrich: "Codex isn’t installed." } });
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill(`# ${title}\n\nA short page whose prequestions failed to be written the first time.`);
  await page.keyboard.press("Enter");
  await page.locator(".doc").getByText("whose prequestions failed").waitFor();
  await until("the import has settled", () => page.evaluate(() => !(window as unknown as { __ORE_PENDING: number }).__ORE_PENDING));
  // Past the 20 minutes enrichment gets: opened again, it says it couldn't.
  await page.evaluate(() => { const real = Date.now; Date.now = () => real() + 21 * 60_000; });
  await page.getByRole("button", { name: /^All sources/ }).click();
  await openSource(page, title);
  const retry = page.locator(".preq-retry");
  await retry.waitFor();
  const runs: string[] = [];
  page.on("request", (r) => r.method() === "POST" && (r.postData() ?? "").includes('"args":["enrich"') && runs.push(r.postData()!));
  await fail({ __ORE_FAIL: {}, __ORE_SLOW: { enrich: 4000 } });
  await retry.click();
  await until("the run started", async () => runs.length === 1);
  await page.getByRole("button", { name: /^All sources/ }).click();
  await openSource(page, title);
  await page.waitForTimeout(500);
  if (await page.getByText("Couldn’t write prequestions").count()) throw new Error("opened again mid-run, it says it couldn't write them");
  if (await retry.count()) await retry.click();
  await page.waitForTimeout(300);
  if (runs.length !== 1) throw new Error(`${runs.length} enrich runs`);
  await fail({ __ORE_SLOW: {} });
});

journey("quiz check: one click makes a passage a key point, and marks a highlight already there", async (page) => {
  await openSource(page, TESTING);
  // A chip shows only while its count is above 0.
  const count = async (kind: string) => Number((await page.locator(`.collected-chip.${kind}`).allInnerTexts())[0] ?? 0);
  const [card0, keep0] = [await count("card"), await count("keep")];
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Skip to questions" }).click();
  await page.getByLabel("Your answer").fill("It feels familiar");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  const key = page.locator(".quiz-stepper").getByRole("button", { name: "Key point" });
  // Passage 1 is plain text: it becomes a new key point.
  await until("the first passage is not a key point yet", async () => (await key.getAttribute("aria-pressed")) === "false");
  await key.click();
  await until("it shows as a key point", async () => (await key.getAttribute("aria-pressed")) === "true");
  // Passage 2 is a highlight he already made: it is marked, not doubled.
  await page.getByRole("button", { name: "Next passage" }).click();
  await until("the second passage is not a key point yet", async () => (await key.getAttribute("aria-pressed")) === "false");
  await key.click();
  await until("it shows as a key point", async () => (await key.getAttribute("aria-pressed")) === "true");
  await page.getByRole("button", { name: "Close quiz" }).click();
  // The highlight already there was marked, not doubled: one plain highlight fewer.
  await until("two more key points, one fewer plain highlight", async () => (await count("card")) === card0 + 2 && (await count("keep")) === keep0 - 1);
  await page.keyboard.press("Meta+z");
  await until("⌘Z takes the mark back", async () => (await count("card")) === card0 + 1 && (await count("keep")) === keep0);
});

journey("quiz check that fails says why, as Review does, with try again", async (page) => {
  await openSource(page, TESTING);
  const why = "Codex isn’t installed (no `codex` on PATH). Install it, or pick Claude in Settings → AI.";
  await page.evaluate((why) => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { "key-points": why, check: why }), why);
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Skip to questions" }).click();
  await page.getByLabel("Your answer").fill("It feels familiar");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  const verdict = page.locator(".quiz-verdict").filter({ hasText: "Couldn’t check this one" });
  await verdict.waitFor();
  if (!(await verdict.innerText()).includes(why)) throw new Error(`no reason: “${await verdict.innerText()}”`);
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
  await verdict.getByRole("button", { name: "try again" }).click();
  await page.locator(".quiz-verdict").filter({ hasNotText: "Couldn’t check this one" }).waitFor();
  await page.getByRole("button", { name: "Close quiz" }).click();
});

journey("finish quiz: ⌘⌫ while Check saves leaves his answer alone; a mark whose save fails goes back", async (page) => {
  await openSource(page, TESTING);
  const writes: string[] = [];
  let release = () => {};
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"prequestion",')) return route.fallback();
    writes.push(body);
    if (writes.length === 1) await new Promise<void>((ok) => (release = ok));
    await route.fallback();
  });
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Skip to questions" }).click();
  await page.getByLabel("Your answer").fill("It feels familiar");
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await until("Check is saving", async () => writes.length === 1);
  for (let n = 0; n < 3; n++) await page.keyboard.press("Meta+Backspace");
  await page.waitForTimeout(300);
  release();
  const mark = page.locator(".quiz-mark[aria-pressed]").first();
  await mark.waitFor();
  if (writes.length !== 1 || !writes[0]!.includes("It feels familiar")) throw new Error(`his answer wasn't the one write: ${writes.join(" | ")}`);
  await page.unroute(/\/ore$/);
  // While a correction saves, the marks wait, so a second click isn't lost without sign.
  await page.evaluate(() => ((window as unknown as { __ORE_SLOW?: object }).__ORE_SLOW = { check: 800 }));
  await mark.click();
  await until("the marks wait while it saves", () => page.locator(".quiz-mark[aria-pressed]").last().isDisabled());
  await until("and come back once it is saved", async () => !(await mark.isDisabled()), 3000);
  await page.evaluate(() => ((window as unknown as { __ORE_SLOW?: object }).__ORE_SLOW = undefined));
  const was = await mark.getAttribute("aria-pressed");
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { check: "The library is read-only." }));
  await mark.click();
  await page.locator(".toast[role=alert]").filter({ hasText: "The library is read-only." }).waitFor();
  await until("the mark is back as saved", async () => (await mark.getAttribute("aria-pressed")) === was);
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
  await page.getByRole("button", { name: "Close quiz" }).click();
});

journey("finish quiz: while Check saves, his answer and how sure he is stay as saved, so the checked answer is what he sees", async (page) => {
  await openSource(page, TESTING);
  const writes: string[] = [];
  let release = () => {};
  await page.route(/\/ore$/, async (route) => {
    const body = route.request().postData() ?? "";
    if (route.request().method() !== "POST" || !body.includes('"prequestion",')) return route.fallback();
    writes.push(body);
    if (writes.length === 1) await new Promise<void>((ok) => (release = ok));
    await route.fallback();
  });
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Skip to questions" }).click();
  const field = page.getByLabel("Your answer");
  await field.fill("It feels familiar");
  await page.getByRole("radio", { name: "Think so" }).click();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await until("Check is saving", async () => writes.length === 1);
  await field.focus();
  await page.keyboard.type(" and fluent");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("3");
  await page.getByRole("radio", { name: "Guess" }).click({ force: true });
  await page.waitForTimeout(200);
  const typed = await field.inputValue();
  const sure = await page.getByRole("radio", { name: "Think so" }).getAttribute("aria-checked");
  release();
  await page.locator(".quiz-yours").waitFor();
  await page.unroute(/\/ore$/);
  if (typed !== "It feels familiar") throw new Error(`typing went in while it saved: “${typed}”`);
  if (sure !== "true") throw new Error("how sure he was changed while it saved");
  if ((await page.locator(".quiz-yours").innerText()) !== "It feels familiar" || !writes[0]!.includes("--confidence=2")) throw new Error(`saved: ${writes[0]}`);
  await page.getByRole("button", { name: "Close quiz" }).click();
});

journey("Done: Move to To read and ⌘Z puts the source back in Done with the finish date it had", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  await page.keyboard.press("Meta+2");
  const row = page.locator(".list .row").first();
  const title = await row.locator(".title").innerText();
  const finished = async () => ((await ore("ls")) as { title: string; status: string; finished_at?: string }[]).find((i) => i.title === title);
  const was = await finished();
  if (was?.status !== "done" || !was.finished_at) throw new Error(`“${title}” is not done with a finish date`);
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Move to To read" }).click();
  await until("it left Done", async () => (await finished())?.status === "reading");
  await page.keyboard.press("Meta+z");
  await until("⌘Z puts it back in Done", async () => (await finished())?.status === "done");
  const now = await finished();
  if (now?.finished_at !== was.finished_at) throw new Error(`finish date ${was.finished_at} became ${now?.finished_at}`);
});

journey("prequestions: a source added with --no-enrich offers to write them, never a wait on nothing", async (page) => {
  const made = (await fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich"], stdin: "# Added by an agent\n\nNo enrich is on its way for this one." }) }).then((r) => r.json())) as { id: string };
  try {
    await page.reload();
    await openSource(page, "Added by an agent");
    await page.locator(".preq-head").filter({ hasText: "No prequestions yet" }).waitFor();
    await page.getByRole("button", { name: "Write them" }).waitFor();
    if (await page.getByText("Writing prequestions…").count()) throw new Error("it waits on an enrich nothing started");
  } finally {
    await ore("archive", made.id);
  }
});

journey("finish: feedback on the recall starts once the quiz's answers are saved, so they don't make it stale (simulated learner run 2026-11-26)", async (page) => {
  // Started before the quiz, the feedback read the answers as they were then; the core refused to save it once an
  // answer landed, and he saw "prequestions changed while feedback was running; run ore recall --feedback again".
  await openSource(page, TESTING);
  const calls: string[] = [];
  await page.route(/\/ore$/, async (route) => {
    if (route.request().method() === "POST") calls.push(route.request().postData() ?? "");
    await route.fallback();
  });
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByLabel("Free recall").fill("Retrieval makes memories last; rereading only feels fluent.");
  const doneQ = page.getByRole("heading", { name: "Done with this source?" });
  for (let i = 0; i < 14 && !(await doneQ.isVisible()); i++) {
    const next = page.getByRole("button", { name: /^(Continue|No idea|Next|Next question)$/ }).first();
    if (await next.isVisible().catch(() => false)) await next.click().catch(() => {});
    await Bun.sleep(400);
  }
  await doneQ.waitFor();
  await until("the feedback started", async () => calls.some((c) => c.includes('"--feedback"')));
  await page.unroute(/\/ore$/);
  const feedback = calls.findIndex((c) => c.includes('"--feedback"'));
  const answers = calls.flatMap((c, i) => (c.includes('"prequestion",') && c.includes("--after") ? [i] : []));
  if (!answers.length) throw new Error("no quiz answer was saved");
  if (feedback < answers.at(-1)!) throw new Error(`the recall's feedback started before the quiz's last answer was saved: ${calls.map((c) => JSON.parse(c).args.slice(0, 3).join(" ")).join(" | ")}`);
  await page.getByRole("button", { name: "Keep reading", exact: true }).click();
});
