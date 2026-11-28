import { join } from "node:path";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { type Page } from "playwright";
import { AGENTS, answered, askFieldIsPlain, BRIDGE, failNext, FIXTURES, highlightMenu, hold, isHeld, journey, loaded, longPassages, openSource, ore, pointAt, release, select, settled, TESTING, until } from "../harness";

journey("reader width: a recording's transcript keeps about the column an article gets in a narrow pane (D207)", async (page) => {
  await page.setViewportSize({ width: 1180, height: 800 });
  const width = () => page.locator(".doc").evaluate((el) => el.getBoundingClientRect().width);
  await openSource(page, TESTING);
  const article = await width();
  await openSource(page, "Lecture 4");
  await page.locator(".page.video").waitFor();
  const transcript = await width();
  if (transcript < article - 20) throw new Error(`transcript column ${transcript}px, article ${article}px at the same window`);
});

// F129
journey("highlight popup: on a recording, each type's name stays on one line, and Play from here is on the highlight's right-click menu", async (page) => {
  await openSource(page, "Lecture 4");
  await page.locator(".page.video").waitFor();
  await select(page, "testing yourself");
  // F130: a recording has no video, so its Play says only "Play from here".
  await highlightMenu(page, "testing yourself", "Play from here");
  const tall = await page.locator(".popup .intents .intent").evaluateAll((els) =>
    els
      .filter((el) => {
        // The button keeps its height, so a wrapped name shows only as a second line of text.
        const r = document.createRange();
        r.selectNodeContents(el.lastChild!);
        return new Set([...r.getClientRects()].map((c) => Math.round(c.top))).size > 1 || el.scrollWidth > el.clientWidth;
      })
      .map((el) => el.textContent),
  );
  // Leaves the recording with the highlights it came with: a later journey counts its ticks.
  await highlightMenu(page, "testing yourself", "Remove highlight");
  await page.locator(".popup").waitFor({ state: "detached" });
  if (tall.length) throw new Error(`wrapped or cut: ${tall.join(", ")}`);
});

journey("reader width: a line holds about 66 characters at any text size, in Charter or Geist (D207)", async (page) => {
  const para = "Spacing your practice over days instead of cramming it into one evening tends to produce memories that last longer, because each return to the material comes after some forgetting has begun, and the effort of pulling it back strengthens the trace more than an easy repeat would. ";
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill(`# Measure check\n\n${para.repeat(8)}`);
  await page.keyboard.press("Enter");
  const p = page.locator(".doc p").filter({ hasText: "Spacing your practice" }).first();
  await p.waitFor();
  // Mean characters per full line (the last line of the paragraph is left out).
  const perLine = () => p.evaluate((el) => {
    const n = el.firstChild!;
    const s = n.textContent ?? "";
    const r = document.createRange();
    const lines: number[] = [];
    let top: number | null = null, count = 0;
    for (let i = 0; i < s.length; i++) {
      r.setStart(n, i); r.setEnd(n, i + 1);
      const box = r.getClientRects()[0];
      if (!box) continue;
      const y = Math.round(box.top);
      if (top !== null && y !== top) { lines.push(count); count = 0; }
      top = y; count++;
    }
    return lines.reduce((a, b) => a + b, 0) / lines.length;
  });
  await page.setViewportSize({ width: 1600, height: 1000 });
  try {
    for (const font of ["charter", "geist"]) {
      for (const size of [14, 17, 22]) {
        await page.evaluate(([f, px]) => {
          document.documentElement.dataset.font = f as string;
          document.documentElement.style.setProperty("--read-size", `${px}px`);
        }, [font, size] as const);
        if (font === "geist") {
          // Geist ships with the app, so its count here is the count on the Mac.
          const chars = await perLine();
          if (chars < 60 || chars > 72) throw new Error(`${font} at ${size}px: ${chars.toFixed(1)} characters a line, want about 66`);
        } else {
          // Linux has no macOS Charter (its Bitstream twin sets narrower), so check the column is 31 of its em,
          // the width measured on the Mac to hold about 66.
          const em = await p.evaluate((el) => el.closest(".doc")!.getBoundingClientRect().width / parseFloat(getComputedStyle(el).fontSize));
          if (Math.abs(em - 31) > 0.2) throw new Error(`charter at ${size}px: column is ${em.toFixed(2)}em, want 31`);
        }
      }
    }
  } finally {
    await page.evaluate(() => {
      document.documentElement.dataset.font = "charter";
      document.documentElement.style.setProperty("--read-size", "17px");
    });
  }
});

journey("PDF footnote: its mark shows the note on hover, and bold stays bold", async (page) => {
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill(join(import.meta.dir, "../../../../packages/core/test/fixtures/intake/files/hazards.pdf"));
  await page.keyboard.press("Enter");
  const doc = page.locator(".doc");
  await doc.getByText("habits matter as much as reasons", { exact: false }).waitFor();
  await doc.locator("strong", { hasText: "remember" }).waitFor();
  await doc.locator("a.fn").first().hover();
  await page.locator(".tip.note").getByText("We are not suggesting that people are irrational").waitFor();
  await page.mouse.move(5, 5);
  await page.locator(".tip.note").waitFor({ state: "detached" });
});

journey("footnote: a long note's hover preview shows all of it (only a highlight note's is cut to six lines)", async (page) => {
  const note = "The note goes on at length, as a book's notes do, so the preview has to hold every line of it. ".repeat(9) + "The last words.";
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill(`# Notes at length\n\nA claim that needs a note.[^1] Then more text.\n\n[^1]: ${note}\n`);
  await page.keyboard.press("Enter");
  await page.locator(".doc a.fn").first().hover();
  const tip = page.locator(".tip.note");
  await tip.getByText("The last words.", { exact: false }).waitFor();
  const cut = await tip.evaluate((el) => el.scrollHeight > el.clientHeight + 1);
  if (cut) throw new Error("the footnote's preview is cut short");
});

journey("PDF tables: read in the background after adding, Undo puts the lines back, one click reads them again", async (page) => {
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill(join(FIXTURES, "tables.pdf"));
  await page.keyboard.press("Enter");
  const doc = page.locator(".doc");
  await doc.getByText("Each successful review raises S", { exact: false }).waitFor();
  // The reader is installed, so the PDF's table is read as soon as it is added; the line says so meanwhile.
  await doc.locator("table").getByText("Spaced").waitFor({ timeout: 15000 });
  await page.locator(".pdf-tables").waitFor({ state: "detached" });
  await page.locator(".toast").getByRole("button", { name: "Undo" }).click();
  await page.locator(".pdf-tables").getByText("Tables in this PDF read as plain text.").waitFor();
  if (await doc.locator("table").count()) throw new Error("Undo left the table in");
  await page.locator(".pdf-tables").getByRole("button", { name: "Read them properly" }).click();
  await doc.locator("table").getByText("Massed").waitFor({ timeout: 15000 });
});

journey("reimport twice, then ⌘Z twice: each Undo puts back the version its reimport replaced, with the removed highlight; a question whose passage went says so (F362, F364)", async (page) => {
  const KETTLE = "The copper kettle whistles before the water boils.";
  const ASKED = "Questions make learners examine the evidence carefully.";
  const nb = (md: string) => JSON.stringify({ cells: [{ cell_type: "markdown", metadata: {}, source: md }], metadata: {}, nbformat: 4, nbformat_minor: 5 });
  const V0 = `# Reimport undo study\n\n## First section\n\nA learner studies birds beside a quiet river.\n\n## Second section\n\n${KETTLE}\n\n${ASKED}\n\nThe last paragraph stays as it is.\n`;
  const file = join(mkdtempSync(join(tmpdir(), "ore-e2e-nb-")), "reimport-undo-study.ipynb");
  writeFileSync(file, nb(V0));
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill(file);
  await page.keyboard.press("Enter");
  const doc = page.locator(".doc");
  await doc.getByText(KETTLE).waitFor();
  const item = ((await ore("ls")) as { id: string; title: string; dir: string }[]).find((i) => i.title === "Reimport undo study")!;
  await ore("highlight", item.id, "--exact", KETTLE, "--intent", "keep", "--note", "Keep this kettle note.");
  await ore("highlight", item.id, "--exact", ASKED, "--intent", "question", "--note", "How strong is the evidence?");
  const kept = join(item.dir, "source.ipynb");
  const reimport = async (md: string, says?: string) => {
    writeFileSync(kept, nb(md));
    await page.getByRole("button", { name: "Source actions" }).first().click();
    await page.getByRole("menuitem", { name: "Reimport" }).click();
    if (says) await page.locator(".toast", { hasText: says }).waitFor();
    await settled(page);
  };
  await page.reload();
  await openSource(page, "Reimport undo study");
  const V1 = V0.replace(`${KETTLE}\n\n${ASKED}\n\n`, "");
  await reimport(V1, "1 highlight is no longer in it, so it was removed. A question’s passage is no longer in it; the question is kept");
  await reimport(V1.replace("## First section", "## Updated first section"));
  await doc.getByText("Updated first section").waitFor();

  // The question is kept, and the way to where it was asked says its passage is gone instead of doing nothing.
  await page.getByRole("tab", { name: "Collected" }).click();
  await page.locator(".qp-row", { hasText: "How strong is the evidence?" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Show where it was asked" }).click();
  await page.locator(".toast", { hasText: "The passage it was marked on is no longer in this source." }).waitFor();

  await doc.getByText("The last paragraph stays as it is.").click();
  await page.keyboard.press("Meta+z");
  await doc.getByText("First section", { exact: true }).waitFor();
  await settled(page);
  if (await doc.getByText(KETTLE).count()) throw new Error("the first ⌘Z went past the second reimport");
  await page.keyboard.press("Meta+z");
  await doc.getByText(KETTLE).waitFor();
  await settled(page);
  if (await doc.getByText("Updated first section").count()) throw new Error("the second ⌘Z brought back the newer version");
  const ann = ((await ore("show", item.id, "--annotations")) as { annotations: { exact: string; note?: string; status: string }[] }).annotations.find((a) => a.exact === KETTLE);
  if (ann?.status === "deleted" || ann?.note !== "Keep this kettle note.") throw new Error(`the removed highlight did not come back with its note: ${JSON.stringify(ann)}`);
  // Redo replays them in order.
  await page.keyboard.press("Meta+Shift+z");
  await until("⇧⌘Z takes the first reimport again", async () => !(await doc.getByText(KETTLE).count()) && (await doc.getByText("First section", { exact: true }).count()) === 1);
  await settled(page);
  await page.keyboard.press("Meta+Shift+z");
  await doc.getByText("Updated first section").waitFor();
  await settled(page);
});

journey("highlight: it shows, survives a reload, and ⌘Z takes it back", async (page) => {
  await openSource(page, TESTING);
  const keeps = page.locator(".collected-chip.keep");
  const before = Number(await keeps.innerText());
  await select(page, "Each successful retrieval changes the memory itself");
  await page.getByRole("dialog", { name: "Highlight" }).waitFor();
  await until("the Keep count goes up", async () => Number(await keeps.innerText()) === before + 1);
  await page.keyboard.press("Enter"); // keeps it (Esc would drop a fresh one)
  await page.keyboard.press("Meta+z");
  await until("⌘Z removes it", async () => Number(await keeps.innerText()) === before);
  // The count shows at once; reload only once the redo's write has reached the library (slow on CI).
  const saved = page.waitForResponse((r) => r.request().method() === "POST" && /"annotate".*"--status","open"/.test(r.request().postData() ?? ""));
  await page.keyboard.press("Meta+Shift+z");
  await until("⇧⌘Z puts it back", async () => Number(await keeps.innerText()) === before + 1);
  await saved;
  await page.reload();
  await openSource(page, TESTING);
  await until("it is still there after a relaunch", async () => Number(await keeps.innerText()) === before + 1);
});

journey("highlight popup: a click in the margin beside the text closes it and the highlight stays", async (page) => {
  await openSource(page, TESTING);
  const keeps = page.locator(".collected-chip.keep");
  const before = Number(await keeps.innerText());
  await select(page, "The advantage only appears after a delay"); // a passage no other journey highlights
  const popup = page.getByRole("dialog", { name: "Highlight" });
  await popup.waitFor();
  await until("the highlight is made", async () => Number(await keeps.innerText()) === before + 1);
  // Beside the column, level with the text: in the reader's scroll area but off the page.
  const box = (await page.locator(".reader-scroll").boundingBox())!;
  const col = (await page.locator(".page").boundingBox())!;
  if (col.x - box.x < 20) throw new Error("no margin beside the page to click in");
  await page.mouse.click(box.x + (col.x - box.x) / 2, col.y + 80);
  await popup.waitFor({ state: "detached" });
  await page.waitForTimeout(300);
  if (Number(await keeps.innerText()) !== before + 1) throw new Error("the click away dropped the highlight");
  await page.keyboard.press("Meta+z");
  await until("⌘Z takes it back", async () => Number(await keeps.innerText()) === before);
});

journey("highlight popup open: typing writes the note, and no letter runs a shortcut (L, O, C, Q, N)", async (page) => {
  await openSource(page, TESTING);
  await select(page, "Each successful retrieval changes the memory itself");
  const popup = page.getByRole("dialog", { name: "Highlight" });
  await popup.waitFor();
  await page.evaluate(() => {
    const t = (window as any).__TAURI_INTERNALS__;
    const invoke = t.invoke;
    (window as any).__calls = [];
    t.invoke = (cmd: string, args: unknown) => ((window as any).__calls.push(cmd), invoke(cmd, args));
  });
  const words = "Look: cue, quiz, notes";
  await page.keyboard.type(words);
  const note = popup.locator("textarea");
  const typed = await note.inputValue();
  if (typed !== words) throw new Error(`the note says “${typed}”`);
  if (await page.locator(".listen-bar").count()) throw new Error("L started Listen");
  const toast = (await page.locator(".toast").allInnerTexts()).join(" ");
  if (/read aloud|Reading aloud/i.test(toast)) throw new Error(`L started Listen: ${toast}`);
  const opened = ((await page.evaluate(() => (window as any).__calls)) as string[]).filter((c) => c.includes("opener"));
  if (opened.length) throw new Error(`O opened the original: ${opened}`);
  if (!(await popup.isVisible())) throw new Error("a letter closed the popup");
  // Once the note has words, a digit is text even if focus went back to the page (D133: 1–4 set the type only while it is empty).
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("2");
  const after = await note.inputValue();
  if (after !== words + "2") throw new Error(`a 2 typed after the note became “${after}”`);
});

journey("highlight note: ⇧↵ carries a list on, an empty item ends it, and a long note widens the popup", async (page) => {
  await openSource(page, TESTING);
  await select(page, "Each successful retrieval changes the memory itself");
  const popup = page.getByRole("dialog", { name: "Highlight" });
  await popup.waitFor();
  const note = popup.getByLabel("Note");
  const width = (await popup.boundingBox())!.width;
  await page.keyboard.type("1. cue");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("quiz");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("- a");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("b");
  const typed = await note.inputValue();
  if (typed !== "1. cue\n2. quiz\n• a\n• b") throw new Error(`the note shows ${JSON.stringify(typed)}`);
  if (!(await popup.isVisible())) throw new Error("⇧↵ closed the popup");
  await page.keyboard.type(" and a longer thought that runs on for a while about how the cue works".repeat(2));
  await until("a note past four lines widens the popup", async () => (await popup.boundingBox())!.width > width + 40);
  const box = (await popup.boundingBox())!;
  if (box.x < 0 || box.x + box.width > page.viewportSize()!.width) throw new Error("the wide popup runs off the window");
  await page.keyboard.press("Enter");
  await popup.waitFor({ state: "hidden" });
  // Saved as Markdown: the bullets are "- " in the file, and come back as bullets.
  await select(page, "Each successful retrieval changes the memory itself");
  await popup.waitFor();
  await until("the note comes back with its bullets", async () => (await note.inputValue()).startsWith("1. cue\n2. quiz\n• a\n• b"));
});

journey("highlight note: \"2.\" in an empty note starts a numbered list, and leaves the type as it was (D133's 2 is Key point)", async (page) => {
  await openSource(page, TESTING);
  await select(page, "Space the tests out");
  const popup = page.getByRole("dialog", { name: "Highlight" });
  await popup.waitFor();
  await page.keyboard.type("2. second");
  const typed = await popup.getByLabel("Note").inputValue();
  if (typed !== "2. second") throw new Error(`the note says ${JSON.stringify(typed)}`);
  await page.waitForTimeout(300);
  if ((await popup.locator(".intent.card").getAttribute("aria-pressed")) === "true") throw new Error("the 2 left it a Key point");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("x");
  if ((await popup.getByLabel("Note").inputValue()) !== "2. second\n3. x") throw new Error("⇧↵ didn't count on to 3.");
});

journey("Collected row menu: change a highlight's type and remove it without opening it, ⌘Z takes each back", async (page) => {
  await openSource(page, TESTING);
  // Its own highlight, so it never leans on what an earlier journey left (or took back).
  const keeps = page.locator(".collected-chip.keep");
  const count = async () => ((await keeps.count()) ? Number(await keeps.innerText()) : 0);
  const before = (await count()) + 1;
  await select(page, "the text feels familiar, and familiarity is easily mistaken for knowing");
  await page.getByRole("dialog", { name: "Highlight" }).waitFor();
  await page.keyboard.press("Enter");
  await until("the Keep count goes up", async () => (await count()) === before);
  await page.getByRole("tab", { name: "Collected" }).click();
  const toggle = page.locator(".cp-head.keep .cp-toggle");
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  const row = () => page.locator(".cp-head.keep ~ .cp-line").filter({ hasText: "familiarity is easily mistaken" }).first();
  await row().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Type" }).hover();
  await page.getByRole("menuitemcheckbox", { name: "Question" }).dispatchEvent("click");
  await until("it is a question now", async () => (await count()) === before - 1);
  await page.keyboard.press("Meta+z");
  await until("⌘Z makes it a highlight again", async () => (await count()) === before);
  await row().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Remove highlight" }).click();
  await until("it is gone", async () => (await count()) === before - 1);
  // At once: the remove is the newest step on the history as soon as the row goes.
  await page.keyboard.press("Meta+z");
  await until("⌘Z brings it back", async () => (await count()) === before);
  // Leave the library as it was for the journeys after this one.
  await page.waitForTimeout(300);
  await row().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Remove highlight" }).click();
  await until("it is gone again", async () => (await count()) === before - 1);
  await page.waitForTimeout(500); // the write lands before the next journey reads the library
});

journey("Collected: a new question is typed in place, with no line over it and no box (F578)", async (page) => {
  await openSource(page, TESTING);
  await page.getByRole("tab", { name: "Collected" }).click();
  await page.locator(".cp-head.question").hover();
  await page.getByRole("button", { name: "Ask a question" }).click();
  await askFieldIsPlain(page, page.locator(".cp"));
  await page.keyboard.press("Escape");
});

journey("Collected: a key point he is typing survives closing its group and switching to the note and back", async (page) => {
  await openSource(page, TESTING);
  await page.getByRole("tab", { name: "Collected" }).click();
  const toggle = page.locator(".cp-head.card .cp-toggle");
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  await page.getByRole("button", { name: "Add a key point" }).click();
  const field = page.getByRole("textbox", { name: "Key point", exact: true });
  await until("+ puts the caret in the field", () => field.evaluate((el) => el === document.activeElement));
  await field.fill("Retrieval beats rereading for the long run");
  await toggle.click();
  await toggle.click();
  if ((await field.inputValue()) !== "Retrieval beats rereading for the long run") throw new Error("closing Key points lost his words");
  await page.getByRole("tab", { name: "Source note" }).click();
  await page.getByRole("tab", { name: "Collected" }).click();
  if ((await field.inputValue()) !== "Retrieval beats rereading for the long run") throw new Error("switching to the note lost his words");
  if (await field.evaluate((el) => el === document.activeElement)) throw new Error("coming back to Collected took the caret into the kept field");
  await field.press("Escape");
});

journey("Collected: questions that fail to load say why, and Try again shows them", async (page) => {
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { questions: "The library is busy." }));
  await openSource(page, TESTING);
  await page.getByRole("tab", { name: "Collected" }).click();
  const toggle = page.locator(".cp-head.question .cp-toggle");
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  const alert = page.getByRole("alert").filter({ hasText: "The library is busy." });
  await alert.waitFor();
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
  await alert.getByRole("button", { name: "Try again" }).click();
  await page.locator(".qp-row").first().waitFor();
  if (await alert.count()) throw new Error("the error stayed after the list loaded");
});

journey("search while reading (D219): ⌘F names what it finds in; Collected has its own filter, which hides groups with no match", async (page) => {
  await openSource(page, TESTING);
  await page.getByRole("tab", { name: "Collected" }).click();
  await page.keyboard.press("Meta+f");
  const find = page.locator(".find-bar input");
  await until("with Collected open, ⌘F finds in the source alone", async () => (await find.getAttribute("placeholder")) === "Find in source");
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "Source note" }).click();
  await page.keyboard.press("Meta+f");
  await until("with the note open, it says so", async () => (await find.getAttribute("placeholder")) === "Find in source and note");
  await find.fill("just a measurement");
  const count = page.locator(".find-count");
  await until("words only in the note are found", async () => (await count.innerText()) === "1/1");
  await page.getByRole("tab", { name: "Collected" }).click();
  await until("switching to Collected, the bar counts again without the note", async () => /not found/i.test(await count.innerText()));
  if ((await find.getAttribute("placeholder")) !== "Find in source") throw new Error("the field still names the note");
  await find.fill("");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Filter collected" }).click();
  const field = page.getByRole("textbox", { name: "Filter collected" });
  await until("the glass opens a field with the caret", () => field.evaluate((el) => el === document.activeElement));
  await field.fill("tested group");
  await page.locator(".cp-row", { hasText: "the tested group remembered" }).waitFor();
  if (await page.locator(".cp-head.keep").isVisible()) throw new Error("Highlights, with no match, still shows");
  await field.press("ArrowDown");
  await until("↓ moves into the rows", () => page.evaluate(() => !!document.activeElement?.closest(".cp-row")));
  await field.fill("zzqxv");
  await page.getByText("Nothing collected here matches “zzqxv”.").waitFor();
  await field.press("Escape");
  await until("Esc clears it", async () => (await field.inputValue()) === "");
  await page.locator(".cp-head.keep").waitFor();
  await field.press("Escape");
  await until("a second Esc closes the row, focus back on the glass", async () => (await field.count()) === 0 && (await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))) === "Filter collected");
});

journey("highlight: a selection snaps to whole words and the full stop, ⌥ keeps it exact", async (page) => {
  await openSource(page, TESTING);
  const active = () => page.evaluate(() => [...(CSS.highlights.get("hl-active") ?? [])].map((r) => r.toString()).join("|"));
  const popup = page.getByRole("dialog", { name: "Highlight" });
  await select(page, "ach successful retrieval changes the memory its");
  await popup.waitFor();
  await until("it snaps out to whole words", async () => (await active()) === "Each successful retrieval changes the memory itself.");
  await page.keyboard.press("Escape"); // drops the fresh one
  await popup.waitFor({ state: "hidden" });
  // At once, before the reader has finished with the first drag: on a busy Mac its clearing of that selection came
  // after this press and took the new one with it (the Highlight popup never came, 16 runs in 20).
  await page.keyboard.down("Alt");
  await select(page, "trengthens the route bac");
  await page.keyboard.up("Alt");
  await popup.waitFor();
  await until("⌥ keeps exactly what he selected", async () => (await active()) === "trengthens the route bac");
  await page.keyboard.press("Escape");
});

journey("highlight: a double click keeps its sentence in one step, ⌥ double click just the word (D224)", async (page) => {
  await openSource(page, TESTING);
  const active = () => page.evaluate(() => [...(CSS.highlights.get("hl-active") ?? [])].map((r) => r.toString()).join("|"));
  const popup = page.getByRole("dialog", { name: "Highlight" });
  await page.waitForTimeout(300);
  const writes: string[] = [];
  page.on("request", (r) => void (/"(?:highlight|annotate)"/.test(r.postData() ?? "") && writes.push(r.postData()!)));
  const word = await pointAt(page, "strengthens");
  await page.mouse.dblclick(word.x, word.y);
  await popup.waitFor();
  await until("the sentence is the highlight", async () => (await active()) === "It strengthens the route back to the information and adds new cues, so the next retrieval is easier.");
  if (writes.length !== 1) throw new Error(`a double click wrote ${writes.length} times`);
  await page.keyboard.press("Escape"); // drops the fresh one
  await popup.waitFor({ state: "hidden" });
  const other = await pointAt(page, "Effortful");
  await page.keyboard.down("Alt");
  await page.mouse.dblclick(other.x, other.y);
  await page.keyboard.up("Alt");
  await popup.waitFor();
  await until("⌥ keeps just the word", async () => (await active()) === "Effortful");
  await page.keyboard.press("Escape");
});

journey("highlight: a triple click keeps the paragraph as one step, so one ⌘Z takes it all back", async (page) => {
  await openSource(page, TESTING);
  const kept = () => page.evaluate(() => [...(CSS.highlights.get("hl-keep") ?? [])].map((r) => r.toString()));
  const popup = page.getByRole("dialog", { name: "Highlight" });
  await page.waitForTimeout(300);
  const at = (await page.evaluate(() => {
    const walk = document.createTreeWalker(document.querySelector(".doc")!, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
      const i = n.data.indexOf("Rereading, by contrast");
      if (i < 0) continue;
      n.parentElement!.scrollIntoView({ block: "center" });
      const r = document.createRange();
      r.setStart(n, i + 2);
      r.setEnd(n, i + 3);
      const b = r.getBoundingClientRect();
      return { x: b.left + 1, y: b.top + b.height / 2 };
    }
  }))!;
  const writes: string[] = [];
  page.on("request", (r) => void (/"(?:highlight|annotate)"/.test(r.postData() ?? "") && writes.push(r.postData()!)));
  await page.mouse.click(at.x, at.y, { clickCount: 3 });
  await popup.waitFor();
  await until("the paragraph is highlighted", async () => (await kept()).some((t) => t.startsWith("Rereading, by contrast") && t.includes("weaker results.")));
  // Not the double click's word first, then grown to the paragraph: two steps for one act.
  if (writes.length !== 1) throw new Error(`a triple click wrote ${writes.length} times: ${writes.join(" | ")}`);
  await page.keyboard.press("Enter");
  await popup.waitFor({ state: "hidden" });
  await page.waitForTimeout(300);
  await page.keyboard.press("Meta+z");
  await until("one ⌘Z leaves nothing of it highlighted", async () => !(await kept()).some((t) => t.includes("Rereading")));
  await page.waitForTimeout(800); // the undo's writes are back
  const left = await kept();
  if (left.some((t) => t.includes("Rereading"))) throw new Error(`one ⌘Z left ${JSON.stringify(left)}`);
});

journey("reader: the outline opens after a short rest, and ⌘[ after an outline jump goes back to where he was, ⌘] to the jump again, before leaving the source", async (page) => {
  const part = (n: number) => `## Part ${n}\n\n` + `Part ${n} says one thing at length, so the source runs long enough to scroll. `.repeat(12);
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill(`# A long read in parts\n\n${Array.from({ length: 10 }, (_, i) => part(i + 1)).join("\n\n")}`);
  await page.keyboard.press("Enter");
  await page.locator(".doc").getByText("Part 1 says one thing").first().waitFor();
  await page.waitForTimeout(500);
  const top = () => page.evaluate(() => Math.round(document.querySelector(".reader-scroll")?.scrollTop ?? -1000));
  const from = await top();
  const shown = () => page.locator(".outline-panel").evaluate((el) => getComputedStyle(el).opacity === "1");
  await page.locator("nav.outline").hover();
  if (await shown()) throw new Error("a passing pointer opened the outline at once; it waits a moment first");
  await until("resting on the outline opens it", shown);
  await page.locator(".outline-panel button").filter({ hasText: "Part 9" }).click();
  await until("the outline jumps", async () => (await top()) > from + 400);
  const jumped = await top();
  await page.mouse.move(640, 400);
  await page.keyboard.press("Meta+BracketLeft");
  await until("⌘[ goes back to where he was", async () => Math.abs((await top()) - from) < 4);
  if (!(await page.locator(".doc").isVisible())) throw new Error("⌘[ left the source");
  await page.keyboard.press("Meta+BracketRight");
  await until("⌘] goes to the jump again", async () => Math.abs((await top()) - jumped) < 4);
  await page.keyboard.press("Meta+BracketLeft");
  await page.keyboard.press("Meta+BracketLeft");
  await until("then ⌘[ leaves the source, as before", async () => !(await page.locator(".doc").isVisible()));
});

journey("figure zoom: a click opens a figure to fill the window and keys don't reach the page behind; Esc, a click or a scroll puts it back (D144)", async (page) => {
  await openSource(page, AGENTS);
  const fig = page.locator(".doc img").first();
  await fig.scrollIntoViewIfNeeded();
  const small = (await fig.boundingBox())!;
  const zoom = page.locator(".figure-zoom");
  const big = page.locator(".figure-zoom.open img");
  const shut = () => until("it is put back", async () => !(await zoom.count()) && (await fig.evaluate((i) => getComputedStyle(i).visibility)) === "visible");
  await fig.click();
  await big.waitFor();
  await until("the figure grows to fill the window", async () => ((await big.boundingBox())?.width ?? 0) > small.width * 1.3);
  // Keys stay with the figure: the page behind doesn't scroll, and Esc puts it back at once.
  const top = await page.locator(".reader-scroll").evaluate((el) => el.scrollTop);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await page.keyboard.press("Escape");
  await shut();
  if ((await page.locator(".reader-scroll").evaluate((el) => el.scrollTop)) !== top) throw new Error("keys pressed over the figure scrolled the page behind");
  if (!(await page.locator(".doc").isVisible())) throw new Error("Esc left the source as well as the figure");
  // A click on it puts it back, and so does a scroll.
  await fig.click();
  await big.waitFor();
  await page.waitForTimeout(300);
  await zoom.click();
  await shut();
  await fig.click();
  await big.waitFor();
  await page.mouse.wheel(0, 200);
  await shut();
  if ((await page.locator(".reader-scroll").evaluate((el) => el.scrollTop)) !== top) throw new Error("the scroll that put the figure back moved the page too");
  // A scroll in the very frame it starts to grow (F103): it had not moved yet, so no transition
  // ran back and nothing ever closed it; it sat unseen over the page.
  await page.evaluate(() => {
    new MutationObserver((_, o) => {
      if (!document.querySelector(".figure-zoom.open")) return;
      o.disconnect();
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 200, cancelable: true }));
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
  });
  await fig.click();
  await shut();
});

journey("figure cards: a drag over a zoomed figure draws a box, what's under it makes a Fact card that hides it, Undo takes it back (D166)", async (page) => {
  await openSource(page, AGENTS);
  const fig = page.locator(".doc img").first();
  await fig.scrollIntoViewIfNeeded();
  await fig.click();
  const big = page.locator(".figure-zoom.open img");
  await big.waitFor();
  // Grown in: measured while it still grows, the drag lands off the figure's own points (F882).
  await until("the figure has grown in", () => big.evaluate((el) => !el.getAnimations().length && !el.parentElement!.getAnimations().length));
  const b = (await big.boundingBox())!;
  // A plain click still puts it back; a drag draws a box instead.
  await page.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.35, b.y + b.height * 0.4, { steps: 6 });
  await page.mouse.move(b.x + b.width * 0.4, b.y + b.height * 0.5, { steps: 6 });
  await page.mouse.up();
  const field = page.getByRole("textbox", { name: "What’s under the box" });
  await field.waitFor();
  if (!(await page.locator(".figure-zoom").count())) throw new Error("the drag put the figure back");
  // Keys typed there go to the field, not the page or the zoom.
  await field.pressSequentially("Router j");
  if ((await field.inputValue()) !== "Router j") throw new Error(`typed: ${await field.inputValue()}`);
  await field.press("Backspace");
  await field.press("Backspace");
  await field.press("Enter");
  await page.getByText("Exercise made").waitFor();
  const saved = page.locator(".figure-box.saved");
  await saved.first().waitFor();
  const id = ((await ore("cards", "--state", "draft")) as { id: string; answer: string; figure?: object }[]).find((c) => c.figure && c.answer === "Router")?.id;
  if (!id) throw new Error("no figure card was made");
  const card = (await ore("card", "show", id, "--review")) as { kind: string; figure: { src: string; box: number[] }; figure_file: string };
  if (card.kind !== "card" || card.figure.src !== "assets/patterns.svg" || !card.figure_file.endsWith("assets/patterns.svg")) throw new Error(JSON.stringify(card));
  const [x, y, w, h] = card.figure.box;
  if (Math.abs(x! - 0.2) > 0.02 || Math.abs(y! - 0.3) > 0.02 || Math.abs(w! - 0.2) > 0.02 || Math.abs(h! - 0.2) > 0.02) throw new Error(`box ${card.figure.box}`);
  // An edit in review hands back the card with its figure, so the figure stays on screen.
  if (!((await ore("card", "set", id, "--answer", "Routing")) as { figure_file?: string }).figure_file) throw new Error("editing a figure card lost its figure");
  // Esc with no box open puts the figure back; Undo takes the card back.
  await page.keyboard.press("Escape");
  await page.locator(".figure-zoom").waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Undo" }).click();
  await until("Undo retires the card", async () => ((await ore("card", "show", id)) as { state: string }).state === "retired");
});

journey("hidden source keeps Show the source in the accessibility tree (F118)", async (page) => {
  await openSource(page, TESTING);
  const reader = page.locator(".reader");
  await page.getByRole("button", { name: "Hide the source", exact: true }).click();
  const hidden = await reader.ariaSnapshot();
  if (!hidden.includes('button "Show the source"')) throw new Error("Show the source is missing from the accessibility tree");
  if (hidden.includes(TESTING)) throw new Error("the hidden source's title is still in the accessibility tree");
  const show = page.getByRole("button", { name: "Show the source", exact: true });
  await show.focus();
  await page.keyboard.press("Enter");
  await until("showing the source restores its accessible text", async () => (await reader.ariaSnapshot()).includes(TESTING));
  await page.getByRole("button", { name: "Hide the source", exact: true }).waitFor();
});

journey("hidden source: one blur spreads from the eye over the whole page, his highlights stay under it, and it draws back (D361)", async (page) => {
  await openSource(page, TESTING);
  const veil = () =>
    page.evaluate(() => {
      const v = document.querySelector<HTMLElement>(".hide-veil")!, cs = getComputedStyle(v);
      const eye = document.querySelector('button[aria-label="Hide the source"], button[aria-label="Show the source"]')!.getBoundingClientRect(), box = v.getBoundingClientRect();
      const scroll = document.querySelector(".reader-scroll")!.getBoundingClientRect();
      return {
        at: cs.getPropertyValue("--veil").trim(),
        blur: cs.backdropFilter || cs.getPropertyValue("-webkit-backdrop-filter"),
        fromEye: Math.abs(parseFloat(v.style.getPropertyValue("--veil-x")) - (eye.left + eye.width / 2 - box.left)) < 1,
        covers: box.left <= scroll.left && box.top <= scroll.top && box.right >= scroll.right && box.bottom >= scroll.bottom,
        marks: [...CSS.highlights.keys()].filter((k) => /^hl-(keep|card|question|apply)$/.test(k)).length,
      };
    });
  const before = await veil();
  if (before.at !== "0%" || !before.marks) throw new Error(`before hiding: ${JSON.stringify(before)}`);
  await page.getByRole("button", { name: "Hide the source", exact: true }).click();
  await until("the blur covers the page", async () => (await veil()).at === "118%");
  const hidden = await veil();
  if (!/blur\(/.test(hidden.blur) || !hidden.fromEye || !hidden.covers) throw new Error(`hidden: ${JSON.stringify(hidden)}`);
  if (hidden.marks !== before.marks) throw new Error(`his highlights should stay under the blur: ${hidden.marks} of ${before.marks}`);
  await page.getByRole("button", { name: "Show the source", exact: true }).click();
  await until("the blur draws back", async () => (await veil()).at === "0%");
});

journey("tables: a heading's button covers its column, a click or Enter shows a cell, right-click on a covered one makes an exercise of it and Undo takes it back (D200)", async (page) => {
  const made = (await (await fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich", "--json"], stdin: "# Sampling settings\n\nHow the draw is made.\n\n| Setting | What it changes | Range |\n|---|---|---|\n| Temperature | How flat the odds are | 0 to 1.5 |\n| Top-p | How much of the tail stays | 0.8 to 1 |\n| Top-k | How many words stay | 20 to 100 |\n\nChange one at a time." }) })).json()) as { id: string };
  try {
    await page.reload();
    await openSource(page, "Sampling settings");
    const table = page.locator(".doc table");
    const covered = table.locator("td.covered");
    const head = table.locator("th").nth(2);
    await head.hover();
    await head.getByRole("button", { name: "Cover this column" }).click();
    await until("the column's three cells are covered", async () => (await covered.count()) === 3);
    if ((await table.locator("tbody tr").first().locator("td").nth(2).evaluate((td) => getComputedStyle(td).color)) !== "rgba(0, 0, 0, 0)") throw new Error("a covered cell still shows its text");
    // A click shows one cell; Enter shows the one the keyboard is on.
    await covered.first().click();
    await until("a click shows that cell", async () => (await covered.count()) === 2);
    await covered.first().focus();
    await page.keyboard.press("Enter");
    await until("Enter shows the focused cell", async () => (await covered.count()) === 1);
    // The text under a cover is still there for a highlight after the table.
    await select(page, "Change one at a time");
    await page.locator(".popup").waitFor();
    await page.keyboard.press("Escape");
    // The heading's button shows what is left.
    await head.getByRole("button", { name: "Show this column" }).click();
    await until("the button shows the rest", async () => (await covered.count()) === 0);
    // Right-click a covered cell: an exercise that asks the cell by its row and column.
    await head.hover();
    await head.getByRole("button", { name: "Cover this column" }).click();
    await covered.nth(1).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Make an exercise of this cell" }).click();
    await page.locator(".toast", { hasText: "Exercise made" }).waitFor();
    const cards = async () => ((await ore("cards", `--item=${made.id}`)) as { question: string; answer: string; state: string }[]).filter((c) => c.state !== "retired");
    await until("the exercise asks the cell", async () => (await cards()).some((c) => c.question === "Top-p · Range?" && c.answer === "0.8 to 1"));
    await page.locator(".toast", { hasText: "Exercise made" }).getByRole("button", { name: "Undo" }).click();
    await until("Undo retires it", async () => (await cards()).length === 0);
    // The row's own name makes no exercise: it is the question's half.
    await table.locator("th").first().hover();
    await table.locator("th").first().getByRole("button", { name: "Cover this column" }).click();
    await table.locator("tbody td.covered").first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "Show", exact: true }).waitFor();
    if (await page.getByRole("menuitem", { name: "Make an exercise of this cell" }).count()) throw new Error("the row's own name offers an exercise");
    await page.keyboard.press("Escape");
  } finally {
    await ore("archive", made.id).catch(() => {});
  }
});

journey("tables: a narrow heading's cover button sits beside its text on hover, never over it (F119)", async (page) => {
  // "Term" is its column's widest content, so the column is no wider than the word.
  const made = (await (await fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich", "--json"], stdin: "# Narrow headings\n\nA short glossary.\n\n| Term | Meaning |\n|---|---|\n| a | The first letter of the alphabet |\n| b | The second letter of the alphabet |\n\nThat is all." }) })).json()) as { id: string };
  try {
    await page.reload();
    await openSource(page, "Narrow headings");
    const head = page.locator(".doc table th").first();
    await head.hover();
    const button = head.getByRole("button", { name: "Cover this column" });
    await until("the button shows on hover", async () => (await button.evaluate((b) => getComputedStyle(b).opacity)) === "1");
    const { text, btn } = await head.evaluate((th) => {
      const r = document.createRange();
      r.selectNodeContents(th.firstChild!);
      const t = r.getBoundingClientRect();
      const b = th.querySelector(".col-cover")!.getBoundingClientRect();
      return { text: { left: t.left, right: t.right }, btn: { left: b.left, right: b.right } };
    });
    if (text.right > btn.left) throw new Error(`the button (from ${btn.left.toFixed(1)}px) covers the heading's text (to ${text.right.toFixed(1)}px)`);
  } finally {
    await ore("archive", made.id).catch(() => {});
  }
});

journey("reader: a drag over a long book's first page while the rest is still loading is highlighted, not dropped (Codex sweep 4)", async (page) => {
  const dir = mkdtempSync(join(tmpdir(), "ore-long-"));
  const file = join(dir, "long.md");
  const para = (c: number, i: number) => `Paragraph ${i} of chapter ${c} says that spacing practice over days beats cramming it into one night, and that recall beats rereading. `.repeat(6);
  writeFileSync(file, `# A very long book to load\n\nRetrieval first is the opening line of this book.\n\n${Array.from({ length: 60 }, (_, c) => `## Chapter ${c + 1}\n\n${Array.from({ length: 40 }, (_, i) => para(c + 1, i)).join("\n\n")}`).join("\n\n")}\n`);
  const made = (await ore("add", file, "--no-enrich")) as { id: string };
  try {
    await page.reload();
    await openSource(page, "A very long book to load");
    await page.locator(".doc p", { hasText: "Retrieval first" }).waitFor();
    await select(page, "Retrieval first is the opening line");
    const chapters = await page.locator(".doc h2").count();
    if (chapters >= 60) throw new Error("the whole book had loaded before the drag: nothing was tested");
    await page.locator(".popup").waitFor({ timeout: 15000 });
    await page.keyboard.press("Escape");
  } finally {
    await ore("archive", made.id).catch(() => {});
    rmSync(dir, { recursive: true, force: true });
  }
});

journey("reader: Arabic and Hebrew read right to left, their list numbers on the right, beside English left to right (Codex sweep 4)", async (page) => {
  const dir = mkdtempSync(join(tmpdir(), "ore-rtl-"));
  const file = join(dir, "rtl.md");
  writeFileSync(file, "# دروس قصيرة\n\nالتكرار المتباعد يساعد على التذكر مع Ore 2026 كل يوم.\n\n1. الدرس الأول\n2. הלימוד השני\n\n> اقتباس قصير من الكتاب.\n\nA line in English stays left to right.\n");
  const made = (await ore("add", file, "--no-enrich")) as { id: string };
  try {
    await page.reload();
    await openSource(page, "دروس قصيرة");
    const dirOf = (sel: string, text: string) => page.locator(sel, { hasText: text }).first().evaluate((e) => getComputedStyle(e).direction);
    await page.locator(".doc p", { hasText: "التكرار" }).waitFor();
    if ((await dirOf(".doc p", "التكرار")) !== "rtl") throw new Error("an Arabic paragraph reads left to right");
    if ((await dirOf(".doc ol", "الدرس")) !== "rtl") throw new Error("an Arabic list keeps its numbers on the left");
    if ((await dirOf(".doc li", "הלימוד")) !== "rtl") throw new Error("a Hebrew list item reads left to right");
    if ((await dirOf(".doc blockquote", "اقتباس")) !== "rtl") throw new Error("an Arabic quote keeps its rule on the left");
    if ((await dirOf(".doc p", "English")) !== "ltr") throw new Error("English beside them turned right to left");
  } finally {
    await ore("archive", made.id).catch(() => {});
    rmSync(dir, { recursive: true, force: true });
  }
});

journey("original: a PDF's side panel has an Original tab that draws its page, follows the page being read, and ‹ › turn to another (D202)", async (page) => {
  const made = (await ore("add", join(FIXTURES, "textbook.pdf"), "--no-enrich")) as { id: string };
  const before = await page.evaluate(() => [localStorage.getItem("ore.sidetab"), localStorage.getItem("ore.mynotes")]);
  try {
  await page.reload();
  await openSource(page, "Chapter 1: Learning");
  const show = page.getByRole("button", { name: "Show side panel" });
  if (await show.count()) await show.click();
  await page.getByRole("tab", { name: "Original" }).click();
  const sheet = page.locator(".original canvas");
  const pager = page.locator(".original-pager span");
  const drawn = (n: number) => until(`page ${n} of the original is drawn`, async () => (await sheet.getAttribute("data-page")) === String(n) && (await pager.innerText()) === `${n} / 4`, 15000);
  await drawn(1);
  // Something is on the sheet: a drawn page is mostly white, an undrawn canvas is clear.
  const inked = await sheet.evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let white = 0, dark = 0;
    for (let i = 0; i < d.length; i += 4) d[i]! > 240 && d[i + 3] === 255 ? white++ : d[i]! < 100 && d[i + 3] === 255 && dark++;
    return white > dark && dark > 100;
  });
  if (!inked) throw new Error("the original's page is blank");
  // Reading on to page 3's heading brings its page up beside it.
  await page.locator(".doc h3", { hasText: "Spacing out sessions" }).evaluate((h) => h.scrollIntoView({ block: "start" }));
  await drawn(3);
  // The page marks hold no text: a highlight past them still lands where he dragged.
  await select(page, "Practice spread over days");
  await page.locator(".popup").waitFor();
  await page.keyboard.press("Escape");
  await page.locator(".doc h3", { hasText: "Spacing out sessions" }).evaluate((h) => h.scrollIntoView({ block: "start" }));
  await drawn(3);
  // He turns ahead by hand; reading on to another page takes the panel back.
  await page.getByRole("button", { name: "Next page" }).click();
  await drawn(4);
  if (!(await page.getByRole("button", { name: "Next page" }).isDisabled())) throw new Error("Next page is offered past the last page");
  await page.getByRole("button", { name: "Previous page" }).click();
  await page.getByRole("button", { name: "Previous page" }).click();
  await drawn(2);
  await page.locator(".doc h1, .doc h2").first().evaluate((h) => h.scrollIntoView({ block: "center" }));
  await drawn(1);
  // The tab is remembered, and a source that is no PDF has no such tab: its panel opens on the source note.
  await openSource(page, AGENTS);
  if (await page.getByRole("tab", { name: "Original" }).count()) throw new Error("an article got an Original tab");
  await page.locator(".mynotes[aria-label='Source note']").waitFor();
  } finally {
    await ore("archive", made.id).catch(() => {});
    await page.evaluate(([tab, open]) => {
      tab ? localStorage.setItem("ore.sidetab", tab) : localStorage.removeItem("ore.sidetab");
      open ? localStorage.setItem("ore.mynotes", open) : localStorage.removeItem("ore.mynotes");
    }, before);
  }
});

journey("a recording plays in place: its player over the transcript, his highlights as ticks, a stamp seeks it, Space plays and pauses (D167)", async (page) => {
  await openSource(page, "Lecture 4");
  const player = page.locator(".player.audio");
  await player.waitFor();
  if (await player.locator("iframe").count()) throw new Error("a recording drew a video frame");
  await until("its length is read from the file", async () => (await player.locator(".time").innerText()).includes("1:00"));
  await until("both highlights are ticks on the bar", async () => (await player.locator(".scrub-tick").count()) === 2);
  const lefts = await player.locator(".scrub-tick").evaluateAll((ts) => ts.map((t) => parseFloat((t as HTMLElement).style.left)));
  // "the memory gets stronger" is spoken at about 0:15 (word times spread over its cue), "The gap only shows" at 0:30.
  if (!(lefts[0]! > 15 && lefts[0]! < 32 && lefts[1]! > 45 && lefts[1]! < 55)) throw new Error(`ticks at ${lefts}`);
  await page.locator(".doc .ts").filter({ hasText: "00:30" }).click();
  await until("the stamp seeks the recording", async () => /^0:3\d/.test((await player.locator(".time").innerText()).trim()));
  await until("and plays it", async () => (await player.getByRole("button", { name: "Pause" }).count()) === 1);
  await page.mouse.click(5, 300);
  await page.keyboard.press("Space");
  await until("Space pauses it", async () => (await player.getByRole("button", { name: "Play", exact: true }).count()) === 1);
});

journey("a recording whose file is slow says it is loading, and one that never comes says so with Try again (Codex sweep 5)", async (page) => {
  // The recording's file is held: no bytes and no error, as a stalled disk or address gives.
  const held: (() => Promise<void>)[] = [];
  await page.route(/\/file\?p=.*\.wav/, (route) => void held.push(() => route.continue()));
  await openSource(page, "Lecture 4");
  const player = page.locator(".player.audio");
  await player.getByText("Loading the recording…").waitFor();
  await player.getByText("The recording hasn’t loaded. Its transcript is below.").waitFor({ timeout: 20_000 });
  if (await player.getByText("Loading the recording…").count()) throw new Error("the loading line stayed beside the message");
  // Try again asks for it once more, and waits again.
  const asked = held.length;
  await player.getByRole("button", { name: "Try again" }).click();
  await player.getByText("Loading the recording…").waitFor();
  await until("the file is asked for again", async () => held.length > asked);
  // It comes: the player is ready and says nothing more.
  await page.unroute(/\/file\?p=.*\.wav/);
  for (const go of held.splice(0)) await go().catch(() => {});
  await until("the recording loads and its length shows", async () => (await player.locator(".time").innerText()).includes("1:00"));
  if (await player.locator(".video-error").count()) throw new Error("a message stayed once the recording loaded");
});

journey("a recording: a finger's scroll away from the spoken line stops following it, as the wheel does, and Back to current shows (D49)", async (page) => {
  await page.setViewportSize({ width: 1000, height: 320 });
  await openSource(page, "Lecture 4");
  const size = await page.evaluate(() => localStorage.getItem("ore.size"));
  for (let i = 0; i < 5; i++) await page.keyboard.press("Meta+Equal"); // the short transcript runs past the window
  try {
  const player = page.locator(".player.audio");
  await player.waitFor();
  await page.locator(".doc .ts").filter({ hasText: "00:30" }).click();
  await until("it plays from the stamp", async () => (await player.getByRole("button", { name: "Pause" }).count()) === 1);
  const box = page.locator(".reader-scroll");
  await until("it follows the spoken line", async () => (await box.evaluate((el) => el.scrollTop)) > 40);
  // A finger drags the text back to the top, as on the iPhone: touch events, then the scroll they make.
  await box.evaluate((el) => {
    const t = (y: number) => new Touch({ identifier: 1, target: el, clientX: 300, clientY: y });
    el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, touches: [t(200)] }));
    el.scrollTop = 0; // the page moves under the finger, then the move is reported
    el.dispatchEvent(new TouchEvent("touchmove", { bubbles: true, touches: [t(400)] }));
    el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, touches: [] }));
  });
  await page.waitForTimeout(800);
  const top = await box.evaluate((el) => el.scrollTop);
  if (top > 5) throw new Error(`the playing recording pulled the text back to its line (scrollTop ${top})`);
  await page.locator(".back-current").waitFor();
  await page.keyboard.press("Space");
  } finally {
    // The text size is kept for every later journey: put it back as it was.
    await page.evaluate((size) => (size === null ? localStorage.removeItem("ore.size") : localStorage.setItem("ore.size", size)), size);
  }
});

journey("a playing source takes YouTube's K J L beside Space and the arrows: K plays and pauses, J back 15 s, L on 30 s, never from a field (D195)", async (page) => {
  await openSource(page, "Lecture 4");
  const player = page.locator(".player.audio");
  await player.waitFor();
  await until("its length is read from the file", async () => (await player.locator(".time").innerText()).includes("1:00"));
  const at = async () => (await player.locator(".time").innerText()).trim().split(/\s/)[0]!;
  const secs = async () => { const [m, s] = (await at()).split(":").map(Number); return m! * 60 + s!; };
  const paused = async () => (await player.getByRole("button", { name: "Play", exact: true }).count()) === 1;
  await page.locator(".doc .ts").filter({ hasText: "00:30" }).click();
  await until("the stamp plays it", async () => (await player.getByRole("button", { name: "Pause" }).count()) === 1);
  await page.mouse.click(5, 300);
  await page.keyboard.press("k");
  await until("K pauses it", paused);
  const t0 = await secs();
  await page.keyboard.press("j");
  await until("J goes back 15 seconds", async () => (await secs()) === Math.max(0, t0 - 15));
  await page.keyboard.press("j");
  await page.keyboard.press("j");
  await until("and stops at the start", async () => (await secs()) === 0);
  await page.keyboard.press("l");
  await until("L goes on 30 seconds", async () => (await secs()) === 30);
  await page.keyboard.press("l");
  await page.keyboard.press("l");
  await until("and stops at the end", async () => (await secs()) === 60);
  await page.keyboard.press("j");
  await until("J again", async () => (await secs()) === 45);
  if (!(await paused())) throw new Error("J or L started it playing");
  // Typed into find, they are letters.
  await page.keyboard.press("Meta+f");
  const find = page.locator(".find-bar input");
  await find.waitFor();
  await page.keyboard.type("kjl");
  await page.waitForTimeout(300);
  if ((await secs()) !== 45 || !(await paused())) throw new Error(`K J L typed into find drove the player (${await at()})`);
  if ((await find.inputValue()) !== "kjl") throw new Error(`find holds "${await find.inputValue()}"`);
  await page.keyboard.press("Escape");
  // Typed into the source note and the tutor's field, too.
  const still = async (where: string) => {
    await page.waitForTimeout(300);
    if ((await secs()) !== 45 || !(await paused())) throw new Error(`K J L typed into ${where} drove the player (${await at()})`);
  };
  await page.getByRole("tab", { name: "Source note" }).click();
  const note = page.locator(".note-editor [contenteditable=true]").first();
  await note.click();
  await page.keyboard.type("kjl");
  await still("the source note");
  await until("the note holds the letters", async () => (await note.innerText()).includes("kjl"));
  await page.keyboard.press("Meta+j");
  const ask = page.getByRole("textbox", { name: "Message the tutor" });
  await ask.waitFor();
  await ask.click();
  await page.keyboard.type("kjl");
  await still("the tutor");
  if ((await ask.inputValue()) !== "kjl") throw new Error(`the tutor's field holds "${await ask.inputValue()}"`);
  await ask.fill("");
  await page.keyboard.press("Escape");
  await page.mouse.click(5, 300);
  await page.keyboard.press("k");
  await until("K plays it again", async () => (await player.getByRole("button", { name: "Pause" }).count()) === 1);
  await page.keyboard.press("k");
  await until("and pauses", paused);
});

journey("highlight note: a long note's hover preview stays inside the window", async (page) => {
  await openSource(page, AGENTS);
  const popup = page.getByRole("dialog", { name: "Highlight" });
  await page.waitForTimeout(300);
  await select(page, "Evaluator-optimiser loops");
  await popup.waitFor();
  await popup.getByLabel("Note").fill("A long thought about this loop, written out at length. ".repeat(55));
  await page.keyboard.press("Escape");
  await popup.waitFor({ state: "hidden" });
  await page.waitForTimeout(400);
  // Hover near the right edge and low in the window, where an unclamped preview runs off both.
  const at = (await page.evaluate(() => {
    const walk = document.createTreeWalker(document.querySelector(".doc")!, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
      const i = n.data.indexOf("Evaluator-optimiser loops");
      if (i < 0) continue;
      const scroll = document.querySelector(".reader-scroll")!;
      const r0 = document.createRange();
      r0.setStart(n, i);
      r0.setEnd(n, i + 1);
      scroll.scrollTop += r0.getBoundingClientRect().top - (innerHeight - 120);
      const r = document.createRange();
      r.setStart(n, i + 10);
      r.setEnd(n, i + 11);
      const b = r.getBoundingClientRect();
      return { x: b.left + 1, y: b.top + b.height / 2 };
    }
  }))!;
  await page.mouse.move(at.x - 5, at.y);
  await page.mouse.move(at.x, at.y);
  const tip = page.locator(".tip");
  await tip.waitFor();
  const box = (await tip.boundingBox())!;
  const view = page.viewportSize()!;
  if (box.y < 0 || box.y + box.height > view.height || box.x + box.width > view.width) throw new Error(`the preview runs off the window: ${JSON.stringify(box)}`);
});

journey("highlight: one the core can't place says what to do, not “text not found in item <id>”", async (page) => {
  await openSource(page, TESTING);
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { highlight: 'ore: text not found in item 01M6Y59CWZB27HBM869RVJPBGR: "Tom & Jerry"' }));
  await page.waitForTimeout(300);
  await select(page, "Space the tests out, mix topics together"); // a passage no other journey highlights
  await until("an error toast", async () => (await page.locator(".toast").allInnerTexts()).some((t) => t.includes("Couldn’t highlight")));
  const toast = (await page.locator(".toast").allInnerTexts()).join(" ");
  if (/01M6Y|text not found/.test(toast)) throw new Error(`the toast shows the core's words: ${toast}`);
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
});

journey("highlight: a drag that starts right after a double click keeps both, the double click's sentence without a popup", async (page) => {
  await openSource(page, TESTING);
  const kept = () => page.evaluate(() => [...(CSS.highlights.get("hl-keep") ?? [])].map((r) => r.toString()));
  const active = () => page.evaluate(() => [...(CSS.highlights.get("hl-active") ?? [])].map((r) => r.toString()).join("|"));
  await page.waitForTimeout(300);
  const word = await pointAt(page, "laboratory");
  await page.mouse.dblclick(word.x, word.y);
  await select(page, "Free recall, short-answer questions"); // within the double-click time
  await page.getByRole("dialog", { name: "Highlight" }).waitFor();
  await until("the drag's passage is highlighted, its popup open", async () => (await active()).startsWith("Free recall, short-answer questions"));
  await until("the double click's sentence is kept too", async () => (await kept()).some((t) => t.startsWith("Decades of laboratory") && t.endsWith("no feedback is given.")));
  // The drag's highlight goes again: the vein journey below highlights these words as new.
  await highlightMenu(page, "Free recall, short-answer questions", "Remove highlight");
  await until("the drag's highlight is gone", async () => !(await kept()).some((t) => t.startsWith("Free recall, short-answer questions")));
});

journey("highlight: a triple click whose selection runs past the text keeps the double click's sentence", async (page) => {
  await openSource(page, TESTING);
  const kept = () => page.evaluate(() => [...(CSS.highlights.get("hl-keep") ?? [])].map((r) => r.toString()));
  await page.waitForTimeout(300);
  const word = await pointAt(page, "Decades");
  await page.mouse.dblclick(word.x, word.y);
  // WebKit's triple click on the last paragraph selects past the end of the text: the reader can't
  // highlight that, so the sentence he double-clicked stays his.
  await page.evaluate(({ x, y }) => {
    const p = document.elementFromPoint(x, y)!.closest("p")!;
    const r = document.createRange();
    r.setStart(p, 0);
    r.setEnd(document.body, document.body.childNodes.length);
    const sel = getSelection()!;
    sel.removeAllRanges();
    for (const type of ["mousedown", "mouseup"]) {
      if (type === "mouseup") sel.addRange(r);
      p.dispatchEvent(new MouseEvent(type, { bubbles: true, detail: 3, button: 0, clientX: x, clientY: y }));
    }
  }, word);
  await until("the sentence is highlighted", async () => (await kept()).some((t) => t.startsWith("Decades of laboratory") && t.endsWith("no feedback is given.")));
});

journey("highlight: an edge move that fails to save leaves it untouched, so Esc still drops it", async (page) => {
  await openSource(page, AGENTS);
  const kept = () => page.evaluate(() => [...(CSS.highlights.get("hl-keep") ?? [])].map((r) => r.toString()));
  const popup = page.getByRole("dialog", { name: "Highlight" });
  const fail = (on: boolean) => page.evaluate((on) => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = on ? { annotate: "The library is busy." } : {}), on);
  await page.waitForTimeout(300);
  await select(page, "Agents are systems where the model"); // a passage no other journey highlights
  await popup.waitFor();
  await until("the highlight is saved", async () => (await kept()).includes("Agents are systems where the model"));
  const knob = (await page.locator(".grab-edge.end").boundingBox())!;
  const to = await pointAt(page, "tool usage");
  await fail(true);
  await page.mouse.move(knob.x + knob.width / 2, knob.y + knob.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await until("the move fails and says so", async () => (await page.locator(".toast").allInnerTexts()).some((t) => t.includes("The library is busy.")));
  await fail(false);
  await until("the edge is back where it was", async () => (await kept()).includes("Agents are systems where the model"));
  await page.keyboard.press("Escape");
  await until("Esc drops the untouched highlight", async () => !(await kept()).some((t) => t.startsWith("Agents are systems")));
});

journey("highlight: an edge he dragged is his, so Esc keeps the highlight and ⌘Z moves the edge back", async (page) => {
  await openSource(page, AGENTS);
  const kept = () => page.evaluate(() => [...(CSS.highlights.get("hl-keep") ?? [])].map((r) => r.toString()));
  const popup = page.getByRole("dialog", { name: "Highlight" });
  await page.waitForTimeout(300);
  await select(page, "That might mean not building"); // a passage no other journey highlights
  await popup.waitFor();
  await until("the highlight is saved", async () => (await kept()).includes("That might mean not building"));
  const knob = (await page.locator(".grab-edge.end").boundingBox())!;
  const to = (await page.evaluate(() => {
    const walk = document.createTreeWalker(document.querySelector(".doc")!, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
      const i = n.data.indexOf("is often enough.");
      if (i < 0) continue;
      const r = document.createRange();
      r.setStart(n, i + "is often enough.".length - 1);
      r.setEnd(n, i + "is often enough.".length);
      const b = r.getBoundingClientRect();
      return { x: b.right - 1, y: b.top + b.height / 2 };
    }
  }))!;
  await page.mouse.move(knob.x + knob.width / 2, knob.y + knob.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  const long = "That might mean not building an agent at all: a single call with retrieval and good examples is often enough.";
  await until("the edge moved", async () => (await kept()).includes(long));
  await page.waitForTimeout(300); // the move is saved
  await page.keyboard.press("Escape");
  await popup.waitFor({ state: "hidden" });
  await page.waitForTimeout(300);
  if (!(await kept()).includes(long)) throw new Error(`Esc dropped the resized highlight: ${JSON.stringify(await kept())}`);
  await page.keyboard.press("Meta+z");
  await until("⌘Z puts the edge back", async () => (await kept()).includes("That might mean not building"));
});

/** Drags from a passage low on the screen to its bottom edge and holds there (Books, Kindle): after a moment the
 *  page turns and the highlight runs on into the next screen. */
async function selectPastTheEdge(page: Page, knob = false) {
  const dir = mkdtempSync(join(tmpdir(), "ore-edge-"));
  const file = join(dir, "edge.md");
  writeFileSync(file, longPassages("A passage across the page"));
  const made = (await ore("add", file, "--no-enrich")) as { id: string };
  try {
    await page.reload();
    await openSource(page, "A passage across the page");
    await page.locator(".doc p", { hasText: "Passage 40 " }).waitFor();
    await page.waitForTimeout(300);
    const pane = page.locator(".reader-scroll");
    const top = () => pane.evaluate((e) => e.scrollTop);
    const at = await page.evaluate(() => {
      const b = document.querySelector<HTMLElement>(".reader-scroll")!.getBoundingClientRect();
      const ps = [...document.querySelectorAll<HTMLElement>(".doc p")];
      const p = ps.find((p) => p.getBoundingClientRect().top > b.top + b.height / 2 && p.getBoundingClientRect().bottom < b.bottom - 80)!;
      const last = ps.findLast((p) => p.getBoundingClientRect().top < b.bottom)!;
      const r = p.getBoundingClientRect();
      const n = (e: HTMLElement) => Number(e.textContent!.match(/Passage (\d+)/)![1]);
      return { x: r.left + 1, y: r.top + 6, x2: r.left + r.width / 2, bottom: b.bottom, from: n(p), last: n(last) };
    });
    const kept = () => page.evaluate(() => [...(CSS.highlights.get("hl-keep") ?? [])].map((r) => r.toString()));
    if (knob) {
      // A highlight's end knob (D117) dragged there carries it on the same way.
      await select(page, `Passage ${at.from} goes on`); // scrolls it to the middle
      await until("the highlight is saved", async () => (await kept()).includes(`Passage ${at.from} goes on`));
      at.last = await page.evaluate(() => {
        const b = document.querySelector<HTMLElement>(".reader-scroll")!.getBoundingClientRect();
        const last = [...document.querySelectorAll<HTMLElement>(".doc p")].findLast((p) => p.getBoundingClientRect().top < b.bottom)!;
        return Number(last.textContent!.match(/Passage (\d+)/)![1]);
      });
      const k = (await page.locator(".grab-edge.end").boundingBox())!;
      await page.mouse.move(k.x + k.width / 2, k.y + k.height / 2);
    } else await page.mouse.move(at.x, at.y);
    const was = await top();
    await page.mouse.down();
    // Above the last 20px, where the browser scrolls a drag by itself at once.
    await page.mouse.move(at.x2, at.bottom - 28, { steps: 8 });
    await page.waitForTimeout(300);
    if ((await top()) !== was) throw new Error("the page turned the moment the drag reached the edge, before any pause");
    await until("held at the bottom, the page turns", async () => (await top()) > was + 300, 3000);
    await page.waitForTimeout(500); // the turn lands
    await page.mouse.up();
    const beyond = `Passage ${at.last + 2} `;
    await until("the highlight runs from where the drag began into the next screen", async () => (await kept()).some((t) => t.startsWith(`Passage ${at.from} `) && t.includes(beyond)));
    await page.keyboard.press("Escape");
  } finally {
    await ore("archive", made.id).catch(() => {});
    rmSync(dir, { recursive: true, force: true });
  }
}

// F331: a saved highlight over a code block crashed WebKit's page as it opened (a click, or a drag carried
// over it): the popup's underline lay between the code's colours and the highlight's tint, a priority WebKit can't paint.
// F339: with Find open on a word in the code, a highlight made over it came in between Find and the code.
journey("highlight: a saved highlight over a code block opens in WebKit without taking the page down, with Find open on it too", async (page) => {
  let crashed = false;
  page.on("crash", () => (crashed = true));
  const dir = mkdtempSync(join(tmpdir(), "ore-code-hl-"));
  const file = join(dir, "code.md");
  const prose = "Retrieval strengthens a memory when the learner reconstructs the idea before seeing the answer.";
  writeFileSync(file, `# Code under a highlight\n\nFirst words here. ${prose}\n\n\`\`\`javascript\n// A comment\nconst message = "remember the exact words";\nconsole.log(message);\n\`\`\`\n\nLast words there. ${prose}\n`);
  const made = (await ore("add", file, "--no-enrich")) as { id: string };
  try {
    await page.reload();
    await openSource(page, "Code under a highlight");
    await until("the code is coloured", async () => page.evaluate(() => CSS.highlights.has("code-keyword")));
    const ends = await page.evaluate(() => {
      const ps = [...document.querySelectorAll(".doc p")];
      const at = (p: Element, end: boolean) => {
        const t = p.firstChild as Text;
        const r = document.createRange();
        r.setStart(t, end ? t.length - 1 : 0);
        r.setEnd(t, end ? t.length : 1);
        const b = r.getBoundingClientRect();
        return { x: end ? b.right - 1 : b.left + 1, y: b.top + b.height / 2 };
      };
      return [at(ps.find((p) => p.textContent!.startsWith("First words"))!, false), at(ps.find((p) => p.textContent!.startsWith("Last words"))!, true)] as const;
    });
    // Find open on a word in the code: its matches over the code's colours, then a highlight made between them.
    await page.keyboard.press("Meta+f");
    await page.getByLabel(/^Find in /).fill("message");
    await until("Find marks the word in the code", async () => page.evaluate(() => [...(CSS.highlights.get("find") ?? []), ...(CSS.highlights.get("find-on") ?? [])].length > 0));
    await page.mouse.move(ends[0].x, ends[0].y);
    await page.mouse.down();
    await page.mouse.move(ends[1].x, ends[1].y, { steps: 8 });
    await page.mouse.up();
    const kept = () => page.evaluate(() => [...(CSS.highlights.get("hl-keep") ?? [])].map((r) => r.toString()));
    await until("the highlight over the code is saved", async () => (await kept()).some((t) => t.includes("const message") && t.startsWith("First words")));
    await page.mouse.click(5, 400); // away from it: the popup closes, the highlight stays
    await page.locator(".popup").waitFor({ state: "detached" });
    // Clicked again, it opens: its underline over the tint and the code's colours.
    await page.mouse.click(ends[0].x + 30, ends[0].y);
    await page.locator(".popup").waitFor();
    await page.waitForTimeout(500);
    if (crashed) throw new Error("the page crashed");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Close find" }).click();
  } finally {
    await ore("archive", made.id).catch(() => {});
    rmSync(dir, { recursive: true, force: true });
  }
}, "webkit");

journey("highlight: a drag held at the bottom of the screen turns the page after a moment and the highlight runs on (Books)", (page) => selectPastTheEdge(page));

journey("highlight: in WebKit too, a drag held at the bottom of the screen turns the page and the highlight runs on", (page) => selectPastTheEdge(page), "webkit");

journey("highlight: a highlight's end knob held at the bottom of the screen turns the page and the highlight runs on", (page) => selectPastTheEdge(page, true));

journey("highlight note: what he types is kept when he clicks away or presses Esc, and after a reload", async (page) => {
  await openSource(page, AGENTS);
  const note = page.getByRole("dialog", { name: "Highlight" }).getByLabel("Note");
  /** Clicks the middle of a phrase in the reader: a highlight there opens its popup. */
  const clickOn = async (phrase: string) => {
    const at = await page.evaluate((phrase) => {
      const walk = document.createTreeWalker(document.querySelector(".doc")!, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
        const i = n.data.indexOf(phrase);
        if (i < 0) continue;
        n.parentElement!.scrollIntoView({ block: "center" });
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + phrase.length);
        const b = r.getClientRects()[0]!;
        return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      }
      return null;
    }, phrase);
    if (!at) throw new Error(`“${phrase}” is not in the reader`);
    await page.mouse.click(at.x, at.y);
  };
  const reopen = async (phrase: string, typed: string) => {
    await clickOn(phrase);
    await until(`the note reads “${typed}”`, async () => (await note.isVisible()) && (await note.inputValue()) === typed);
  };

  await select(page, "Prompt chaining decomposes a task");
  await note.click();
  await page.keyboard.type("Each step feeds the next");
  await clickOn("Workflows are systems where language models"); // click away, as he does
  await until("the popup closes", async () => !(await note.isVisible()));
  await reopen("decomposes a task", "Each step feeds the next");
  await clickOn("Workflows are systems where language models");

  await select(page, "The orchestrator-workers pattern");
  await note.click();
  await page.keyboard.type("How is it unlike routing?");
  await page.keyboard.press("Escape");
  await until("Esc closes the popup", async () => !(await note.isVisible()));
  await reopen("orchestrator-workers", "How is it unlike routing?");
  await clickOn("Workflows are systems where language models");

  // The highlight's save lands while he is typing (1 run in 10 lost the note, 2026-11-06): hold the
  // save, then let it land and type in the same moment, before the reader has redrawn.
  await page.evaluate(() => {
    const real = window.fetch;
    window.fetch = (async (url: RequestInfo, init?: RequestInit) => {
      if (!String(init?.body ?? "").includes('"highlight"')) return real(url, init);
      window.fetch = real;
      // Read in full first, so once let go it reaches the reader in microtasks alone.
      const j = await (await real(url, init)).json();
      await new Promise((go) => ((window as unknown as { __land: () => void }).__land = () => go(null)));
      return { ok: true, json: async () => j } as Response;
    }) as typeof fetch;
  });
  await select(page, "Routing classifies an input");
  await note.click();
  await page.keyboard.type("Pick a path");
  await page.waitForFunction(() => "__land" in window);
  await page.evaluate(async () => {
    (window as unknown as { __land: () => void }).__land();
    for (let i = 0; i < 200; i++) await null; // the save's handlers run; the redraw waits for a task
    const field = document.querySelector<HTMLTextAreaElement>('[role=dialog][aria-label=Highlight] textarea')!;
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, field.value + " first");
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.keyboard.type(", then answer");
  await clickOn("Workflows are systems where language models");
  await until("the popup closes", async () => !(await note.isVisible()));
  await reopen("Routing classifies an input", "Pick a path first, then answer");

  await page.reload();
  await openSource(page, AGENTS);
  await reopen("decomposes a task", "Each step feeds the next");
});

journey("highlight note: a note whose save fails is kept, and saves when the highlight next closes", async (page) => {
  await openSource(page, AGENTS);
  const note = page.getByRole("dialog", { name: "Highlight" }).getByLabel("Note");
  const away = () => page.locator(".doc-head h1").click(); // a click off the popup, as he does
  const fail = (on: boolean) => page.evaluate((on) => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = on ? { annotate: "The library is busy." } : {}), on);
  const open = async () => {
    const at = await page.evaluate(() => {
      const walk = document.createTreeWalker(document.querySelector(".doc")!, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
        const i = n.data.indexOf("subtasks at once");
        if (i < 0) continue;
        n.parentElement!.scrollIntoView({ block: "center" });
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + 8);
        const b = r.getClientRects()[0]!;
        return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      }
      return null;
    });
    if (!at) throw new Error("the passage is not in the reader");
    await page.mouse.click(at.x, at.y);
    await note.waitFor();
  };
  await select(page, "Parallelisation runs subtasks at once");
  await note.click();
  await page.keyboard.type("first thought");
  await away();
  await until("the popup closes", async () => !(await note.isVisible()));
  await open();
  await until("the first note is saved", async () => (await note.inputValue()) === "first thought");
  await note.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" and two");
  await fail(true);
  await away();
  await until("the failed save says so", async () => (await page.locator(".toast").allInnerTexts()).some((t) => t.includes("The library is busy.")));
  await fail(false);
  // Leaving the source and coming back keeps them too.
  await page.getByRole("button", { name: /^Home/ }).click();
  await openSource(page, AGENTS);
  await open();
  await until("the words he typed are still there", async () => (await note.inputValue()) === "first thought and two");
  await away();
  await until("the popup closes", async () => !(await note.isVisible()));
  await page.reload();
  await openSource(page, AGENTS);
  await open();
  await until("the retried save landed", async () => (await note.inputValue()) === "first thought and two");
  // Its highlight goes again: the explain journeys below select words inside this passage as new.
  await highlightMenu(page, "subtasks at once", "Remove highlight");
  await note.waitFor({ state: "detached" });
});

// F350: Remove highlight put its step on the history only once its write was back, so a ⌘Z
// meanwhile took back the step before it, his note, and cleared it; and Undo of a removal wrote back only its status.
journey("highlight: ⌘Z while its removal is being written brings it back with its type and note (F350)", async (page) => {
  const title = `Pending removal ${Date.now()}`;
  const NOTE = "My explanation must remain.";
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill(`# ${title}\n\nThe essential passage should survive an immediate undo. Another sentence provides context.`);
  await page.keyboard.press("Enter");
  await page.locator(".doc").getByText("Another sentence provides context").waitFor();
  const popup = page.getByRole("dialog", { name: "Highlight" });
  await select(page, "essential passage");
  await popup.waitFor();
  await popup.locator(".intent.card").click();
  await popup.getByLabel("Note").fill(NOTE);
  await page.keyboard.press("Enter");
  await popup.waitFor({ state: "hidden" });
  await settled(page);
  const id = ((await ore("ls")) as { id: string; title: string }[]).find((i) => i.title === title)!.id;
  type Saved = { id: string; intent: string; note?: string };
  const saved = async () => ((await ore("show", id)) as { annotations: Saved[] }).annotations;
  const kept = async () => {
    const l = await saved();
    return l.length === 1 && l[0]!.intent === "card" && l[0]!.note === NOTE;
  };
  await until("the Key point and its note are saved", kept);
  const open = async () => {
    const at = await pointAt(page, "essential passage");
    await page.mouse.click(at.x, at.y);
    await popup.waitFor();
  };
  await open();
  const slow = (ms: number | null) => page.evaluate((ms) => ((window as unknown as { __ORE_SLOW?: object }).__ORE_SLOW = ms ? { annotate: ms } : undefined), ms);
  await slow(1500);
  await highlightMenu(page, "essential passage", "Remove highlight");
  await page.waitForTimeout(100);
  await page.keyboard.press("Meta+z");
  await settled(page);
  await slow(null);
  if (!(await kept())) throw new Error(`⌘Z during the removal left ${JSON.stringify(await saved())}`);
  // Brought back whole: a note changed while it was gone (here by another device) comes back as it went.
  const aid = (await saved())[0]!.id;
  await open();
  await highlightMenu(page, "essential passage", "Remove highlight");
  await settled(page);
  await until("it is removed", async () => (await saved()).length === 0);
  await ore("annotate", aid, "--note=");
  await page.keyboard.press("Meta+z");
  await settled(page);
  if (!(await kept())) throw new Error(`Undo of the removal brought back ${JSON.stringify(await saved())}`);
});

/** A new source with one Key point that has a note, for the races of a slow removal: its popup, its saved highlights
 *  and a click that opens it. */
async function keyPointWithNote(page: Page, note: string) {
  const title = `Pending removal ${Date.now()}`;
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill(`# ${title}\n\nThe essential passage should survive an immediate undo. Another sentence provides context.`);
  await page.keyboard.press("Enter");
  await page.locator(".doc").getByText("Another sentence provides context").waitFor();
  const popup = page.getByRole("dialog", { name: "Highlight" });
  await select(page, "essential passage");
  await popup.waitFor();
  await popup.locator(".intent.card").click();
  await popup.getByLabel("Note").fill(note);
  await page.keyboard.press("Enter");
  await popup.waitFor({ state: "hidden" });
  await settled(page);
  const id = ((await ore("ls")) as { id: string; title: string }[]).find((i) => i.title === title)!.id;
  const saved = async () => ((await ore("show", id)) as { annotations: { id: string; intent: string; note?: string }[] }).annotations;
  await until("the Key point and its note are saved", async () => (await saved())[0]?.note === note);
  const open = async () => {
    const at = await pointAt(page, "essential passage");
    await page.mouse.click(at.x, at.y);
  };
  const slow = (ms: number | null) => page.evaluate((ms) => ((window as unknown as { __ORE_SLOW?: object }).__ORE_SLOW = ms ? { annotate: ms } : undefined), ms);
  return { popup, saved, open, slow };
}

// Review of #442 (F356): the held Undo of a slow removal ran its write once the removal was back,
// but a Redo pressed meanwhile ran at once, so the Undo's write landed last and the highlight came back on the page
// and in the library, while the history said it was removed.
journey("highlight: ⌘Z then ⇧⌘Z while its removal is being written leaves it removed (F356)", async (page) => {
  const { popup, saved, open, slow } = await keyPointWithNote(page, "Keep me.");
  await open();
  await popup.waitFor();
  await slow(1200);
  await highlightMenu(page, "essential passage", "Remove highlight");
  await page.waitForTimeout(100);
  await page.keyboard.press("Meta+z");
  await page.keyboard.press("Meta+Shift+z");
  await settled(page);
  await slow(null);
  const left = await saved();
  if (left.length) throw new Error(`⌘Z then ⇧⌘Z during the removal left ${JSON.stringify(left)} in the library`);
  await open();
  await page.waitForTimeout(400);
  if (await popup.isVisible()) throw new Error("⌘Z then ⇧⌘Z during the removal left the highlight on the page");
});

// Review of #442 (F356): two quick ⌘Z during a slow removal took back the note change before it at
// once, then the removal's held Undo landed and wrote back the note it had captured over it.
journey("highlight: two quick ⌘Z while its removal is being written bring it back with the note before (F356)", async (page) => {
  const { popup, saved, open, slow } = await keyPointWithNote(page, "First note.");
  await open();
  await popup.waitFor();
  await popup.getByLabel("Note").fill("Second note.");
  await page.keyboard.press("Enter");
  await popup.waitFor({ state: "hidden" });
  await settled(page);
  await until("the second note is saved", async () => (await saved())[0]?.note === "Second note.");
  await open();
  await popup.waitFor();
  await slow(1200);
  await highlightMenu(page, "essential passage", "Remove highlight");
  await page.waitForTimeout(100);
  await page.keyboard.press("Meta+z");
  await page.keyboard.press("Meta+z");
  await settled(page);
  await slow(null);
  const l = await saved();
  if (l.length !== 1 || l[0]!.note !== "First note.") throw new Error(`two ⌘Z during the removal left ${JSON.stringify(l)}`);
});

journey("author: add one by hand from the title's menu or the empty byline field, it survives a reload, and ⌘Z takes it back", async (page) => {
  await openSource(page, TESTING);
  await page.locator(".doc-head h1").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Add author…" }).click();
  await page.getByLabel("Author").fill("Henry Roediger");
  await page.keyboard.press("Enter");
  const by = page.locator(".doc-head .by");
  await by.filter({ hasText: "Henry Roediger" }).waitFor();
  await page.keyboard.press("Meta+z");
  await until("⌘Z removes it", async () => (await by.count()) === 0);
  // With none, the byline holds a faint empty Author field (D210) that one click fills.
  const empty = page.locator(".doc-head .chips .by-add");
  await empty.waitFor();
  await empty.click();
  await page.getByLabel("Author").waitFor();
  await page.keyboard.press("Escape");
  await empty.waitFor();
  // The byline shows at once; reload only once the redo's write has reached the library (slow on CI).
  // Watched from the redo on, so the first add's write (still landing on CI) doesn't count.
  const posts: string[] = [];
  const watch = (r: import("playwright").Request) => r.method() === "POST" && posts.push(r.postData() ?? "");
  page.on("request", watch);
  const saved = page.waitForResponse((r) => r.request().method() === "POST" && (r.request().postData() ?? "").includes("Henry Roediger") && posts.includes(r.request().postData() ?? ""));
  await page.keyboard.press("Meta+Shift+z");
  await by.filter({ hasText: "Henry Roediger" }).waitFor();
  await saved;
  page.off("request", watch);
  await page.reload();
  await openSource(page, TESTING);
  await by.click(); // the byline edits in place
  await page.getByLabel("Author").fill("Roediger & Karpicke");
  await page.keyboard.press("Enter");
  await by.filter({ hasText: "Roediger & Karpicke" }).waitFor();
});

journey("source title: one click renames it in place, Enter saves, Esc keeps the old one, ⌘Z takes it back", async (page) => {
  await openSource(page, AGENTS);
  await page.locator(".doc-head h1").click();
  const field = page.getByLabel("Title");
  await field.waitFor();
  await field.fill("Agents, renamed");
  await page.keyboard.press("Escape");
  await until("Esc keeps the old title", async () => (await page.locator(".doc-head h1").innerText()) === AGENTS);
  await page.locator(".doc-head h1").click();
  await page.getByLabel("Title").fill("Agents, renamed");
  await page.keyboard.press("Enter");
  await until("Enter saves it", async () => (await page.locator(".doc-head h1").innerText()) === "Agents, renamed");
  await until("focus goes to the text (the title is no control)", () => page.evaluate(() => !!document.activeElement?.matches(".reader-scroll")));
  await page.waitForTimeout(300); // the rename's write lands, then its step is on the history
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Meta+z");
  await until("⌘Z puts the old title back", async () => (await page.locator(".doc-head h1").innerText()) === AGENTS);
});

journey("a highlight saved without a toast is still read out (Codex sweep 3, a11y)", async (page) => {
  await openSource(page, TESTING);
  // A passage no other journey highlights: on one already kept, the selection opens its note and "h" types there.
  await select(page, "check answers after each attempt");
  await page.keyboard.press("h");
  await until("the live region says it was highlighted", async () => (await page.locator(".toasts .sr-only").innerText()).trim() === "Highlighted");
  await page.keyboard.press("Meta+z");
});

journey("a huge source mounts in small steps, so no one batch freezes the page while the rest comes in (Codex sweep 3, hostile)", async (page) => {
  const title = "A very long source";
  const para = (i: number) => `Paragraph ${i}: spacing your practice over days beats cramming it into one evening, because each return comes after some forgetting.`;
  const made = (await fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich"], stdin: `# ${title}\n\n${Array.from({ length: 12000 }, (_, i) => para(i + 1)).join("\n\n")}\n\nTHE-LAST-LINE` }) }).then((r) => r.json())) as { id: string };
  try {
    await page.reload();
    // Counted, not timed: the paragraphs each render adds to the page. Doubling each batch made the last one mount half
    // the source at once, seconds frozen on a 20 MB one; a batch stays about 200 KB however long the source is.
    await page.evaluate(() => {
      const w = window as unknown as { __most: number };
      w.__most = 0;
      new MutationObserver((ms) => {
        const added = ms.reduce((n, m) => n + (m.target instanceof Element && m.target.matches(".doc, .doc *") ? m.addedNodes.length : 0), 0);
        w.__most = Math.max(w.__most, added);
      }).observe(document.body, { childList: true, subtree: true });
    });
    await openSource(page, title);
    await page.waitForFunction(() => document.querySelector(".doc")?.lastElementChild?.textContent?.includes("THE-LAST-LINE"), null, { timeout: 60000, polling: 250 });
    const most = await page.evaluate(() => (window as unknown as { __most: number }).__most);
    if (most > 4000) throw new Error(`one batch put ${most} paragraphs of the 12,000 on the page at once`);
  } finally {
    await ore("archive", made.id).catch(() => {});
  }
});

journey("Collected: ⌘Z while a new key point is being written takes back that one, never the point before (Codex UX sweep 3)", async (page) => {
  await openSource(page, TESTING);
  await page.getByRole("tab", { name: "Collected" }).click();
  const toggle = page.locator(".cp-head.card .cp-toggle");
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  const add = async (t: string) => {
    await page.getByRole("button", { name: "Add a key point" }).click();
    await page.getByRole("textbox", { name: "Key point", exact: true }).fill(t);
    await page.keyboard.press("Enter");
  };
  const row = (t: string) => page.locator(".cp-row").filter({ hasText: t });
  await add("A baseline point to keep");
  await row("A baseline point to keep").waitFor();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await hold(page, "highlight");
  await add("A second point to take back");
  await until("its write is out", () => isHeld(page, "highlight"));
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Meta+z");
  const landed = answered(page, "highlight");
  await release(page, "highlight");
  await landed;
  await until("⌘Z took back the second point", async () => (await row("A second point to take back").count()) === 0);
  await Bun.sleep(500);
  if (!(await row("A baseline point to keep").count())) throw new Error("⌘Z took back the point before it");
  await page.keyboard.press("Meta+z"); // the baseline too, leaving the source as it was
  await until("the baseline is taken back", async () => (await row("A baseline point to keep").count()) === 0);
});

journey("reader: a chapter's recall ends with Done and Back to the source as well as ⌘↵ and Esc, and ⌘Z takes it back (Codex UX sweep 7)", async (page) => {
  const dir = mkdtempSync(join(tmpdir(), "ore-chapters-"));
  const file = join(dir, "chapters.md");
  const para = (c: number, i: number) => `Paragraph ${i} of part ${c} says that spacing practice over days beats cramming it into one night, and that recall beats rereading. `.repeat(3);
  writeFileSync(file, `# A book in two chapters\n\n${[1, 2].map((c) => `<!-- chapter ${c} -->\n\n## Part ${c}\n\n${Array.from({ length: 14 }, (_, i) => para(c, i)).join("\n\n")}`).join("\n\n")}\n`);
  const made = (await ore("add", file, "--no-enrich")) as { id: string };
  const recalls = async () => ((await ore("show", made.id)) as { chapter_recalls?: { n: number }[] }).chapter_recalls ?? [];
  try {
    await page.reload();
    await openSource(page, "A book in two chapters");
    const sign = page.getByRole("button", { name: /Recall this chapter/ }).first();
    await sign.scrollIntoViewIfNeeded();
    // Back to the source: the source comes back, nothing is recorded.
    await sign.click();
    const back = page.getByRole("button", { name: "Back to the source" });
    await back.click();
    await sign.waitFor();
    if ((await recalls()).length) throw new Error("Back to the source recorded the recall");
    // Done: recorded, then ⌘Z offers the chapter again.
    await sign.click();
    await page.keyboard.type("Spacing beats cramming; recall beats rereading.");
    await page.getByRole("button", { name: "Done", exact: true }).click();
    await until("Done recorded the chapter's recall", async () => (await recalls()).some((r) => r.n === 1));
    await page.locator(".doc").click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Meta+z");
    await until("⌘Z took the recall back", async () => !(await recalls()).some((r) => r.n === 1));
    await sign.waitFor();
  } finally {
    await ore("archive", made.id).catch(() => {});
  }
});

journey("highlight note: a click on the highlight in the instant its save lands opens it with the note he wrote, and closing it keeps the note", async (page) => {
  await openSource(page, TESTING);
  await hold(page, "highlight");
  await select(page, "Confidence matters as much as accuracy");
  await page.getByRole("dialog", { name: "Highlight" }).waitFor();
  await page.keyboard.type("Ask how sure before checking"); // typing with the popup open writes its note
  await page.keyboard.press("Enter");
  await until("the popup closed", async () => !(await page.getByRole("dialog", { name: "Highlight" }).count()));
  // A click on the passage as the save's answer comes in, before the page has drawn it.
  const at = await page.evaluate(() => {
    const walk = document.createTreeWalker(document.querySelector(".doc")!, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
      const i = n.data.indexOf("Confidence matters");
      if (i < 0) continue;
      const r = document.createRange();
      r.setStart(n, i + 3);
      r.setEnd(n, i + 4);
      const b = r.getBoundingClientRect();
      return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }
    return null;
  });
  if (!at) throw new Error("the passage is not on the page");
  await page.evaluate((at) => {
    (window as unknown as { __ORE_AFTER: Record<string, () => void> }).__ORE_AFTER = {
      highlight: () => {
        getSelection()?.removeAllRanges();
        document.elementFromPoint(at.x, at.y)!.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: at.x, clientY: at.y, button: 0, detail: 1 }));
      },
    };
  }, at);
  await release(page, "highlight");
  const popup = page.getByRole("dialog", { name: "Highlight" });
  await popup.waitFor();
  await until("the popup opens with his note", async () => (await popup.getByLabel("Note").inputValue()) === "Ask how sure before checking");
  await page.keyboard.press("Escape");
  await loaded(page);
  const doc = (await ore("show", (await ore("ls") as { id: string; title: string }[]).find((i) => i.title === TESTING)!.id, "--annotations")) as { annotations: { exact: string; note?: string }[] };
  const mine = doc.annotations.find((a) => a.exact.startsWith("Confidence matters"));
  if (mine?.note !== "Ask how sure before checking") throw new Error(`the note was lost: ${JSON.stringify(mine)}`);
});

journey("click away saves what he typed: the author, a source's title, a skill's goal; Esc throws it away", async (page) => {
  await openSource(page, TESTING);
  const away = () => page.locator(".doc p").first().click(); // a click in the text, as he does
  // From no author, whatever a journey before it left there (the byline journey ends with one set).
  if (await page.locator(".doc-head .by").count()) {
    await page.locator(".doc-head .by").click();
    await page.getByLabel("Author").fill("");
    await page.keyboard.press("Enter");
  }
  await page.locator(".doc-head .by-add").click();
  await page.getByLabel("Author").fill("Jeffrey Karpicke");
  await away();
  await page.locator(".doc-head .by").filter({ hasText: "Jeffrey Karpicke" }).waitFor();
  await page.locator(".doc-head .by").click();
  await page.getByLabel("Author").fill("Not this one");
  await page.keyboard.press("Escape");
  await page.locator(".doc-head .by").filter({ hasText: "Jeffrey Karpicke" }).waitFor();
  await page.keyboard.press("Meta+z"); // the click-away save is one step, as Enter's is
  await page.locator(".doc-head .by-add").waitFor();
  await page.locator(".doc-head h1").click();
  await page.getByLabel("Title").fill(`${TESTING} (clicked away)`);
  await away();
  await page.locator(".doc-head h1").filter({ hasText: "(clicked away)" }).waitFor();
  await page.keyboard.press("Meta+z");
  await page.locator(".doc-head h1").filter({ hasText: TESTING }).filter({ hasNotText: "(clicked away)" }).waitFor();
  await page.locator(".sidebar .side-item:not(.side-main)").first().click();
  await page.locator("button.skill-goal").click();
  const goal = page.locator("textarea.skill-goal");
  await goal.fill("Explain it to a friend, from memory");
  await page.mouse.click(640, 10); // a click on nothing in particular: the title bar
  await page.locator("button.skill-goal").filter({ hasText: "Explain it to a friend, from memory" }).waitFor();
  // Esc in a list row, whose list takes focus back at once: that blur must not save it.
  await page.getByRole("button", { name: /^All sources/ }).click();
  const row = page.locator(".row").filter({ hasText: AGENTS }).first();
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  await page.locator(".row input[aria-label=Title]").fill("Esc throws this away");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  if (await page.locator(".row").filter({ hasText: "Esc throws this away" }).count()) throw new Error("Esc saved the row's rename");
});

journey("author: a save that fails keeps the name he typed, in the field", async (page) => {
  await openSource(page, AGENTS);
  await page.locator(".doc-head .chips .source").filter({ hasText: "anthropic.com" }).waitFor(); // where it's from ends the byline (D210)
  await page.locator(".doc-head button.by").click();
  const field = page.getByLabel("Author");
  await field.fill("A corrected author");
  await failNext(page, "edit", "The library is read-only.");
  await field.press("Enter");
  await page.locator(".toast[role=alert]").filter({ hasText: "The library is read-only." }).waitFor();
  await failNext(page, "edit", null);
  if (!(await field.count()) || (await field.inputValue()) !== "A corrected author") throw new Error("the failed save lost the author he typed");
  await page.keyboard.press("Escape");
});

journey("outline: Tab after the source's head opens it on the current heading, ↓ and Enter jump, Esc goes back to the text and keeps the source", async (page) => {
  const focused = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.innerText.trim() ?? "");
  await openSource(page, AGENTS);
  await page.locator(".preq-head").focus();
  await page.keyboard.press("Tab");
  await until("Tab lands on the outline's first heading", async () => (await focused()) === "Workflows and agents");
  await until("the outline shows", async () => (await page.locator(".outline-panel").evaluate((el) => getComputedStyle(el).opacity)) === "1");
  await page.keyboard.press("ArrowDown");
  await until("↓ moves to the next heading", async () => (await focused()) === "Patterns");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await until("⇧Tab back comes to the heading the arrows left it on", async () => (await focused()) === "Patterns");
  const before = await page.locator(".reader-scroll").evaluate((el) => el.scrollTop);
  await page.keyboard.press("Enter");
  await until("Enter jumps there and hands the text the focus", () => page.locator(".reader-scroll").evaluate((el, before) => el === document.activeElement && el.scrollTop > before, before));
  await page.locator(".outline-panel button").first().focus();
  await page.keyboard.press("Escape");
  await until("Esc goes back to the text", () => page.evaluate(() => document.activeElement?.classList.contains("reader-scroll") === true));
  if (!(await page.locator(".doc-head").filter({ hasText: AGENTS }).count())) throw new Error("Esc on the outline left the source");
});

// Before settle: it removes the highlight it makes.
journey("highlight: its colour arrives as dots that join (the vein), its ore flies to Collected, a Key point's gathers in the margin; none under reduced motion (D240)", async (page) => {
  await openSource(page, TESTING);
  const popup = page.getByRole("dialog", { name: "Highlight" });
  const moving = () => page.evaluate(() => document.querySelectorAll(".vein, .vein-ore, .collect-fly").length);
  const tinted = (name: string) => page.evaluate((name) => (CSS.highlights.get(name)?.size ?? 0), name);
  const before = await tinted("hl-keep");
  // Read in the page the moment the vein is drawn: a read from here a stalled runner made late found the vein
  // gone and its tint painted, and called that "painted under the vein" (F480).
  await page.evaluate((before) => {
    const w = window as unknown as { __vein?: { lines: number; tinted: boolean; ms: number } };
    delete w.__vein;
    const seen = new MutationObserver(() => {
      const lines = document.querySelectorAll(".vein.keep i");
      if (!lines.length) return;
      seen.disconnect();
      w.__vein = { lines: lines.length, tinted: (CSS.highlights.get("hl-keep")?.size ?? 0) !== before, ms: Number(lines[0]!.getAnimations()[0]?.effect?.getComputedTiming().duration ?? 0) };
    });
    seen.observe(document.body, { childList: true, subtree: true });
  }, before);
  await select(page, "Free recall, short-answer questions");
  // The dots are the tint while they sweep: the real one waits for them.
  await until("a vein over the new highlight", () => page.evaluate(() => "__vein" in window), 1000);
  const at = await page.evaluate(() => ({ ...(window as unknown as { __vein: { lines: number; tinted: boolean; ms: number } }).__vein, ore: document.querySelectorAll(".collect-fly.keep").length }));
  if (at.tinted) throw new Error("the tint was painted under the vein");
  // Unhurried (Tyler, 2026-11-25): the dots take a moment's time, not a panel's.
  if (at.ms < 500) throw new Error(`the vein swept in ${at.ms}ms: snappy again`);
  await popup.waitFor();
  await until("the ore lifts off toward Collected", async () => at.ore > 0 || (await page.locator(".collect-fly.keep").count()) > 0 || (await page.locator(".collected-chip.keep").count()) > 0, 400);
  await until("the vein has joined into the tint", async () => (await page.locator(".vein").count()) === 0 && (await tinted("hl-keep")) === before + 1, 2000);
  // A Key point: its ore gathers where the margin mark lands.
  await popup.locator(".intent.card").click();
  await until("the ore gathers in the margin", async () => (await page.locator(".vein-ore i").count()) > 0, 400);
  await page.locator(".mark-icon.card").first().waitFor();
  await until("nothing is left on the page", async () => (await moving()) === 0 && (await page.locator(".mark-icon.gather").count()) === 0, 4000);
  // Reduced motion: the highlight is simply there.
  const card = page.locator(".mark-icon.card").first();
  if (!(await popup.isVisible())) await card.click();
  await highlightMenu(page, "Free recall, short-answer questions", "Remove highlight");
  await page.waitForTimeout(500);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await select(page, "Free recall, short-answer questions");
  if (await moving()) throw new Error("the vein ran under reduced motion");
  await popup.waitFor();
  if ((await tinted("hl-keep")) !== before + 1) throw new Error("no tint under reduced motion");
  await page.emulateMedia({ reducedMotion: null });
  await highlightMenu(page, "Free recall, short-answer questions", "Remove highlight");
  await page.waitForTimeout(500); // the write lands before the next journey reads the library
});

/** Explain on a phrase, from its highlight's right-click menu. */
async function explain(page: Page, phrase: string) {
  await select(page, phrase);
  const popup = page.getByRole("dialog", { name: "Highlight" });
  await popup.waitFor();
  await highlightMenu(page, phrase, "Explain");
  await page.getByRole("dialog", { name: `Explain ${phrase}` }).waitFor();
}

// After the question journeys: Learn this makes its term a question. On words no other journey highlights.
journey("explain: ↵ on a focused Retry, Key point or Later does what clicking it does", async (page) => {
  await openSource(page, AGENTS);
  const learning = page.getByRole("dialog", { name: /^Learn / });
  await explain(page, "subtasks");
  const ex = page.getByRole("dialog", { name: "Explain subtasks" });
  // The mock has no AI to explain with: Retry asks again.
  await ex.getByRole("button", { name: "Retry" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  await until("focus stays in Explain", () => ex.evaluate((el) => el.contains(document.activeElement)));
  if (await learning.count()) throw new Error("↵ on Retry started Learn this");
  await ex.getByRole("button", { name: "Retry" }).waitFor();
  await ex.getByRole("button", { name: "Key point" }).focus();
  await page.keyboard.press("Enter");
  await ex.waitFor({ state: "detached" });
  if (await learning.count()) throw new Error("↵ on Key point started Learn this");
  await page.getByRole("dialog", { name: "Highlight" }).waitFor(); // the card's note, as clicking Key point opens it
  await page.keyboard.press("Escape");
  await explain(page, "Parallelisation");
  await page.getByRole("dialog", { name: "Explain Parallelisation" }).getByRole("button", { name: "Learn this" }).click();
  const learn = page.getByRole("dialog", { name: "Learn Parallelisation" });
  await learn.getByRole("button", { name: "Retry" }).waitFor(); // no AI to find sources: nothing to read now
  await learn.getByRole("button", { name: "Later" }).focus();
  await page.keyboard.press("Enter");
  await learn.waitFor({ state: "detached" });
});

journey("explain: a term he looked up stays a plain highlight marked looked up, from the popup and from the key", async (page) => {
  const ore = (args: string[]) => page.evaluate((args) => (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__.invoke("ore", { args }), args);
  const id = ((await ore(["ls"])) as { id: string; title: string }[]).find((i) => i.title === AGENTS)!.id;
  const looked = async (exact: string) => ((await ore(["show", id])) as { annotations: { exact: string; intent: string; looked_up?: boolean }[] }).annotations.find((a) => a.exact === exact);
  await openSource(page, AGENTS);
  await explain(page, "aggregates");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "Explain aggregates" }).waitFor({ state: "detached" });
  await until("the popup's fresh highlight stays, marked looked up", async () => (await looked("aggregates"))?.looked_up === true);
  if ((await looked("aggregates"))?.intent !== "keep") throw new Error("a looked-up term is a plain highlight");
  // ⌃⌘D on a word under the pointer, with no highlight there: it becomes one.
  const word = page.locator(".doc p", { hasText: "Evaluator-optimiser" }).first();
  const box = await word.evaluate((el) => {
    const t = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent!.includes("feedback"))!;
    const r = document.createRange();
    const at = t.textContent!.indexOf("feedback");
    r.setStart(t, at);
    r.setEnd(t, at + "feedback".length);
    const b = r.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  await page.mouse.move(box.x, box.y);
  await page.keyboard.press("Control+Meta+d");
  await page.getByRole("dialog", { name: /^Explain feedback/ }).waitFor();
  await page.keyboard.press("Escape");
  await until("the word under the pointer is highlighted, marked looked up", async () => (await looked("feedback"))?.looked_up === true);
});

journey("explain: a reworded question whose save fails is saved by the next ↵, unchanged", async (page) => {
  const ore = (args: string[]) => page.evaluate((args) => (window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown) => Promise<unknown> } }).__TAURI_INTERNALS__.invoke("ore", { args }), args);
  const id = ((await ore(["ls"])) as { id: string; title: string }[]).find((i) => i.title === AGENTS)!.id;
  const notes = async () => ((await ore(["show", id])) as { annotations: { note?: string; status?: string }[] }).annotations.map((a) => a.note);
  await openSource(page, AGENTS);
  await explain(page, "synthesise");
  await page.getByRole("dialog", { name: "Explain synthesise" }).getByRole("button", { name: "Learn this" }).click();
  const learn = page.getByRole("dialog", { name: "Learn synthesise" });
  await learn.getByRole("button", { name: "Retry" }).waitFor(); // the question is saved
  const field = learn.getByLabel("Your question");
  const reworded = "How does a model synthesise results from workers?";
  await field.fill(reworded);
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = { annotate: "The library is read-only." }));
  await field.press("Enter");
  await page.locator(".toast[role=alert]").filter({ hasText: "The library is read-only." }).waitFor();
  await page.evaluate(() => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = {}));
  if ((await field.inputValue()) !== reworded) throw new Error("the failed rename lost his words");
  await until("the caret stays in the field, so Esc can't close over his words", () => field.evaluate((el) => el === document.activeElement));
  await field.press("Enter");
  await until("the next ↵ saves the same words", async () => (await notes()).includes(reworded));
  await learn.getByRole("button", { name: "Later" }).click();
  await learn.waitFor({ state: "detached" });
});

journey("reader toolbar at a narrow window: it never covers the sidebar toggle or Back, and what it holds stays on screen", async (page) => {
  await openSource(page, TESTING);
  await page.locator(".reader-tools .collected").waitFor();
  for (const width of [700, 800, 1280]) {
    await page.setViewportSize({ width, height: 700 });
    await page.waitForTimeout(200);
    const clash = await page.evaluate(() => {
      const tools = document.querySelector(".reader-tools")!.getBoundingClientRect();
      for (const sel of [".side-toggle", ".nav-arrows button"]) {
        const r = document.querySelector(sel)!.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!hit?.closest(sel)) return `${sel} is covered by ${hit?.className}`;
      }
      return tools.left < 0 ? `the toolbar starts at x=${tools.left}` : null;
    });
    if (clash) throw new Error(`at ${width}px: ${clash}`);
  }
});

journey("reader toolbar: Collected goes back to a chip per type when a type goes and they fit again", async (page) => {
  const title = "Four kinds of highlight";
  const lines = ["Spacing beats massing for long-term retention.", "Retrieval changes the memory it retrieves.", "Why does a delay make recall stronger?", "Quiz yourself before rereading tomorrow."];
  const made = (await fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich"], stdin: `# ${title}\n\n${lines.join(" ")}` }) }).then((r) => r.json())) as { id: string };
  const kinds = ["keep", "card", "question"];
  for (const [i, k] of kinds.entries()) await ore("highlight", made.id, "--exact", lines[i]!, "--intent", k);
  const one = () => page.locator(".reader-tools .collected-chip.all").count().then((n) => n > 0);
  try {
    await page.reload();
    await page.getByRole("button", { name: /^All sources/ }).click();
    await page.locator(".list .row .title").filter({ hasText: title }).first().click();
    await page.locator(".reader-tools .collected-chip.question").waitFor();
    // The narrowest window where a chip per type still fits, three types in.
    let width = 1280;
    for (; width > 720; width -= 8) {
      await page.setViewportSize({ width: width - 8, height: 700 });
      await page.waitForTimeout(80);
      if (await one()) break;
    }
    await page.setViewportSize({ width, height: 700 });
    await until("three chips at that width", async () => !(await one()));
    await ore("highlight", made.id, "--exact", lines[3]!, "--intent", "apply");
    await page.reload();
    await page.getByRole("button", { name: /^All sources/ }).click();
    await page.locator(".list .row .title").filter({ hasText: title }).first().click();
    await until("four types don't fit: one chip", one);
    await page.getByRole("tab", { name: "Collected" }).click();
    const toggle = page.locator(".cp-head.apply .cp-toggle");
    if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
    await page.locator(".cp-head.apply ~ .cp-line").filter({ hasText: "Quiz yourself before rereading" }).first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "Type" }).hover();
    await page.getByRole("menuitemcheckbox", { name: "Highlight" }).dispatchEvent("click");
    await until("three types fit again: a chip per type", async () => !(await one()) && (await page.locator(".reader-tools .collected-chip.keep").count()) === 1);
  } finally {
    await ore("archive", made.id);
  }
});

journey("byline: a suggested skill stands where the faint Skill would, and editing the author moves nothing after it (F507, F508)", async (page) => {
  const made = (await fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich", "--json"], stdin: "# Values guide\n\nWhat you give up says what you value." }) }).then((r) => r.json())) as { id: string };
  await ore("suggested-skill", made.id, "undo", JSON.stringify({ suggestion: { name: "Personal Development" } }));
  try {
    await page.reload();
    await openSource(page, "Values guide");
    const head = page.locator(".doc-head");
    const chip = head.locator(".chip.suggested");
    await chip.waitFor();
    // One thing in the skill's place: the suggestion, not a blank "Skill" beside it.
    if (await head.locator(".chips-blank").count()) throw new Error("the faint Skill shows beside a suggested skill");
    await head.locator(".by-add").click();
    await page.getByLabel("Author").fill("Mark Manson");
    await page.keyboard.press("Enter");
    const by = head.locator("button.by");
    await by.waitFor();
    const at = async () => ({ chip: (await chip.boundingBox())!.x, row: (await head.locator(".chips").boundingBox())!.height });
    const rest = await at();
    await by.click();
    await page.getByLabel("Author").waitFor();
    const editing = await at();
    if (Math.abs(editing.chip - rest.chip) > 1 || editing.row !== rest.row) throw new Error(`editing the author moved what follows it: ${JSON.stringify(rest)} → ${JSON.stringify(editing)}`);
    // The field grows with the name as he types.
    await page.getByLabel("Author").fill("Mark Manson and a second author");
    if ((await at()).chip - rest.chip < 40) throw new Error("the author field did not grow with a longer name");
    await page.keyboard.press("Escape");
    // Dismissed, the blank Skill is back, so a skill can still be picked.
    await chip.getByRole("button", { name: "Dismiss suggested skill Personal Development" }).click();
    await head.locator(".chips-blank").waitFor();
  } finally {
    await ore("archive", made.id);
  }
});

journey("reader: ⌘Z of a rename made before leaving and coming back shows the old title", async (page) => {
  await openSource(page, AGENTS);
  const title = () => page.locator(".doc-head h1").innerText();
  await page.locator(".doc-head h1").click();
  await page.getByLabel("Title").fill("Agents, for now");
  await page.keyboard.press("Enter");
  await until("renamed", async () => (await title()) === "Agents, for now");
  await openSource(page, "Agents, for now");
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Meta+z");
  await until("the reader shows the old title", async () => (await title()) === AGENTS);
});

journey("source rename: a save that fails keeps the title he typed, in the field, to try again", async (page) => {
  await page.getByRole("button", { name: /^All sources/ }).click();
  const row = page.locator(".row", { hasText: AGENTS }).first();
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rename…" }).click();
  const field = page.locator(".row-rename");
  await field.fill("Agents, carefully retitled");
  await failNext(page, "edit", "The library is read-only.");
  await field.press("Enter");
  await page.locator(".toast[role=alert]").filter({ hasText: "The library is read-only." }).waitFor();
  await failNext(page, "edit", null);
  await until("the field is back with his words", async () => (await field.count()) === 1 && (await field.inputValue()) === "Agents, carefully retitled");
  await page.keyboard.press("Escape");
});

journey("source rename: pending Undo takes back the rename, not the source added before it (F190)", async (page) => {
  const title = `Source to rename ${Date.now()}`;
  await page.reload();
  await page.locator(".side-item").first().waitFor(); // ⌘N before the app is up after a reload goes nowhere (F499, F827)
  await page.keyboard.press("Meta+n");
  await page.getByRole("textbox", { name: "Link, file path or text" }).fill(`# ${title}\n\nThis source must survive undoing its own rename.`);
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: title, exact: true }).waitFor();
  await until("the import has settled", () => page.evaluate(() => !(window as unknown as { __ORE_PENDING: number }).__ORE_PENDING));
  const source = (await ore("ls") as { id: string; title: string }[]).find((i) => i.title === title)!;
  try {
    await page.locator(".doc-head h1.renamable").click();
    await page.locator(".doc-head .title-edit").fill(`${title} renamed`);
    await hold(page, "edit");
    await page.keyboard.press("Enter");
    await until("the rename is held", () => isHeld(page, "edit"));
    await page.keyboard.press("Meta+z");
    await release(page, "edit");
    await until("the rename and Undo have settled", () => page.evaluate(() => !(window as unknown as { __ORE_PENDING: number }).__ORE_PENDING));
    const archived = await ore("ls", "--archived") as { id: string }[];
    if (archived.some((i) => i.id === source.id)) throw new Error("Undo archived the source added before the pending rename");
    await until("Undo puts the old title back", async () => (await ore("show", source.id) as { title: string }).title === title);
    await page.keyboard.press("Meta+Shift+z");
    await until("Redo renames it again", async () => (await ore("show", source.id) as { title: string }).title === `${title} renamed`);
  } finally {
    await release(page, "edit");
    await ore("archive", source.id);
  }
});

journey("source rename: ⌘Z leaves a title set outside since, and says so (F175)", async (page) => {
  const title = `Source renamed twice ${Date.now()}`;
  await page.reload();
  await page.locator(".side-item").first().waitFor(); // ⌘N before the app is up after a reload goes nowhere (F499)
  await page.keyboard.press("Meta+n");
  await page.getByRole("textbox", { name: "Link, file path or text" }).fill(`# ${title}\n\nRenamed in the app, then outside it.`);
  await page.keyboard.press("Enter");
  await page.getByRole("heading", { name: title, exact: true }).waitFor();
  await until("the import has settled", () => page.evaluate(() => !(window as unknown as { __ORE_PENDING: number }).__ORE_PENDING));
  const source = (await ore("ls") as { id: string; title: string }[]).find((i) => i.title === title)!;
  const now = async () => (await ore("show", source.id) as { title: string }).title;
  try {
    await page.locator(".doc-head h1.renamable").click();
    await page.locator(".doc-head .title-edit").fill(`${title} in the app`);
    await page.keyboard.press("Enter");
    await until("the rename saved", async () => (await now()) === `${title} in the app`);
    await ore("edit", source.id, "--title", `${title} outside`);
    await page.locator(".doc-body, .doc").first().click();
    await page.keyboard.press("Meta+z");
    await page.locator(".toast").filter({ hasText: "renamed since" }).waitFor();
    if ((await now()) !== `${title} outside`) throw new Error(`Undo wrote over the outside title: ${await now()}`);
  } finally {
    await ore("archive", source.id);
  }
});

journey("highlight: a drag from the text let go in the margin beside it still makes the highlight (sweep 5, F309)", async (page) => {
  await openSource(page, TESTING);
  const keeps = page.locator(".collected-chip.keep");
  const before = Number(await keeps.innerText());
  const at = await page.evaluate(() => {
    const walk = document.createTreeWalker(document.querySelector(".doc")!, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
      const i = n.data.indexOf("Multiple-choice works too");
      if (i < 0) continue;
      n.parentElement!.scrollIntoView({ block: "center" });
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + 1);
      const a = r.getBoundingClientRect();
      return { x: a.left + 1, y: a.top + a.height / 2 };
    }
    return null;
  });
  if (!at) throw new Error("the phrase is not in the reader");
  const box = (await page.locator(".reader-scroll").boundingBox())!;
  const col = (await page.locator(".page").boundingBox())!;
  const right = box.x + box.width - (col.x + col.width);
  if (right < 20) throw new Error("no margin right of the page to let go in");
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(col.x + col.width + right / 2, at.y, { steps: 8 });
  await page.mouse.up();
  await page.getByRole("dialog", { name: "Highlight" }).waitFor();
  await until("the Keep count goes up", async () => Number(await keeps.innerText()) === before + 1);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Meta+z");
  await until("⌘Z takes it back", async () => Number(await keeps.innerText()) === before);
});

journey("a long source still being drawn leaves the keys in the source note he clicked into (F396)", async (page) => {
  // Drawn in slices, a long text is ready a second or more after it opens; that moment took the keys to the reader,
  // so what he typed in the note next (a ⇧Home on CI) went to the source instead.
  const title = "A long text drawn in slices";
  const body = Array.from({ length: 20000 }, (_, i) => `Paragraph ${i + 1} of a long text about spacing and retrieval, drawn a slice at a time.`).join("\n\n");
  const made = (await (await fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich", "--json"], stdin: `# ${title}\n\n${body}\n\nThe last paragraph.` }) })).json()) as { id: string };
  try {
    await page.reload();
    await openSource(page, title);
    const pm = page.locator(".mynotes .note-editor .ProseMirror").first();
    await pm.click();
    if (await page.locator(".reader .doc").getByText("The last paragraph.").count()) throw new Error("the text was drawn whole before the click: no slice was left to draw");
    await page.keyboard.type("Spacing");
    await page.locator(".reader .doc").getByText("The last paragraph.").waitFor({ state: "attached", timeout: 30_000 });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    if (!(await pm.evaluate((el) => el.contains(document.activeElement)))) throw new Error("the text being ready took the keys out of the note");
    await page.keyboard.type(" works");
    await until("the note has what he typed", async () => ((await ore("notes", made.id)) as { text: string }).text.includes("Spacing works"));
  } finally {
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /^All sources/ }).click();
    await loaded(page);
    await ore("archive", made.id).catch(() => {});
  }
});

journey("opening a source: its title stands at once where it will stay, the panel's place held, while the text is read; a relaunch shows the sidebar whole (D299, F300)", async (page) => {
  type Slow = { __ORE_SLOW?: Record<string, number> };
  await page.getByRole("button", { name: /^All sources/ }).click();
  const row = page.locator(".row").filter({ hasText: TESTING }).first();
  await row.waitFor();
  await page.evaluate(() => ((window as Slow).__ORE_SLOW = { show: 1500 }));
  await row.click();
  const early = page.locator(".reader .doc-opening h1");
  await early.waitFor({ timeout: 1000 });
  if ((await early.innerText()) !== TESTING) throw new Error("the title is not drawn while the source opens");
  const before = (await early.boundingBox())!;
  await page.locator(".reader .doc").waitFor();
  await page.evaluate(() => delete (window as Slow).__ORE_SLOW);
  const after = (await page.locator(".reader .doc-head h1").boundingBox())!;
  if (Math.abs(before.x - after.x) > 1 || Math.abs(before.y - after.y) > 1) throw new Error(`the title moved as the text arrived: ${before.x},${before.y} to ${after.x},${after.y}`);
  // A relaunch: the skills haven't answered, and the sidebar already shows them with their icons. The answer is held
  // until the check, not slowed by a time, so a slow runner's first draw can't outlast it.
  // Held before it reaches the bridge (F394): a hold on the answer only starts once the bridge has
  // answered, and on a slow runner the sidebar was drawn before that, so the check found nothing held.
  await page.addInitScript(() => ((window as unknown as { __ORE_HOLD?: Record<string, string[]> }).__ORE_HOLD = { skills: ["manual"] }));
  await page.reload();
  await page.locator(".sidebar .side-main .mark").first().waitFor();
  await page.locator(".sidebar .side-item").filter({ hasText: "Learning" }).first().waitFor();
  const held = await page.evaluate(() => (window as unknown as { __ORE_HELD: string[] }).__ORE_HELD);
  if (!held.includes("skills")) throw new Error("the skills answered before the sidebar was checked");
  await release(page, "skills");
});

journey("a source that fails to open says why and offers Try again, which opens it once the cause is gone (F299)", async (page) => {
  type Fail = { __ORE_FAIL?: Record<string, string> };
  await page.getByRole("button", { name: /^All sources/ }).click();
  const row = page.locator(".row").filter({ hasText: TESTING }).first();
  await row.waitFor();
  await page.evaluate(() => ((window as Fail).__ORE_FAIL = { show: "The library is busy." }));
  await row.click();
  await page.locator(".reader [role=alert]").filter({ hasText: "The library is busy." }).waitFor();
  await page.evaluate(() => ((window as Fail).__ORE_FAIL = {}));
  await page.locator(".reader").getByRole("button", { name: "Try again" }).click();
  await page.locator(".doc-head").filter({ hasText: TESTING }).waitFor();
});

journey("highlight: a drag that turns into a native text drag arms nothing for a later click (sweep 5 review)", async (page) => {
  await openSource(page, TESTING);
  const keeps = page.locator(".collected-chip.keep");
  const before = Number(await keeps.innerText());
  // A press on the text whose release never comes (a native drag took it over and ended in dragend).
  const at = (await page.locator(".page p").filter({ hasText: "Space the tests out" }).first().boundingBox())!;
  await page.locator(".page p").filter({ hasText: "Space the tests out" }).first().dispatchEvent("mousedown", { button: 0, clientX: at.x + 5, clientY: at.y + 5, bubbles: true });
  await page.evaluate(() => document.dispatchEvent(new DragEvent("dragend", { bubbles: true })));
  // Later: words selected some other way, and a click let go outside the page.
  await page.evaluate(() => {
    const p = [...document.querySelectorAll(".page p")].find((e) => e.textContent!.includes("Space the tests out"))!;
    const r = document.createRange();
    r.selectNodeContents(p.firstChild!);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(r);
    document.querySelector(".reader-scroll")!.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, button: 0, clientX: 5, clientY: 400 }));
  });
  await page.waitForTimeout(600);
  if (Number(await keeps.innerText()) !== before) throw new Error("an unrelated mouseup made a highlight");
  if (await page.getByRole("dialog", { name: "Highlight" }).isVisible()) throw new Error("a highlight popup opened");
});

journey("code in a source: its parts are coloured without rewrapping the text, Copy puts the code on the clipboard, and a highlight across it still lands (D300)", async (page) => {
  const dir = mkdtempSync(join(tmpdir(), "ore-code-"));
  const file = join(dir, "code.md");
  const code = 'def area(r):\n    # circle\n    return 3.14 * r, "ok"';
  writeFileSync(file, `# Code that is coloured\n\nA function follows this line.\n\n\`\`\`python\n${code}\n\`\`\`\n\nAnd text after it.\n`);
  const made = (await ore("add", file, "--no-enrich")) as { id: string };
  try {
    await page.reload();
    await openSource(page, "Code that is coloured");
    const block = page.locator(".doc pre.code-block");
    await block.waitFor();
    await until("each kind of part has its ranges", () => page.evaluate(() => ["keyword", "name", "comment", "number", "string"].every((k) => (CSS.highlights.get(`code-${k}`)?.size ?? 0) > 0)));
    if ((await block.locator("code").evaluate((el) => el.childNodes.length)) !== 1) throw new Error("the code's text was rewrapped: highlights and Find are Ranges on that one text node");
    if ((await block.getAttribute("data-lang")) !== "python") throw new Error("the block does not name its language");
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await block.hover();
    await block.getByRole("button", { name: "Copy code" }).click();
    await until("the code is on the clipboard", async () => (await page.evaluate(() => navigator.clipboard.readText())) === code);
    await select(page, "return 3.14");
    await page.locator(".popup").waitFor();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Meta+z");
  } finally {
    await ore("archive", made.id).catch(() => {});
    rmSync(dir, { recursive: true, force: true });
  }
});

journey("a long table keeps its header row in view down it and its first column across it, inside its own box (D305)", async (page) => {
  const dir = mkdtempSync(join(tmpdir(), "ore-table-"));
  const file = join(dir, "table.md");
  const cols = ["Element", "Symbol", "Number", "Mass", "Group", "Period", "Block", "Discovered", "Named for"];
  const rows = Array.from({ length: 60 }, (_, i) => `| Element ${i + 1} | E${i + 1} | ${i + 1} | ${(i * 2.1).toFixed(1)} | ${(i % 18) + 1} | ${(i % 7) + 1} | s | ${1700 + i} | a long reason for its name, number ${i + 1} |`);
  writeFileSync(file, `# A long table of elements\n\nSixty rows follow.\n\n| ${cols.join(" | ")} |\n|${cols.map(() => "---").join("|")}|\n${rows.join("\n")}\n\nAnd text after it.\n`);
  const made = (await ore("add", file, "--no-enrich")) as { id: string };
  try {
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.reload();
    await openSource(page, "A long table of elements");
    const table = page.locator(".doc table");
    await table.waitFor();
    const box = (await table.boundingBox())!;
    if (box.height > 700 * 0.7 + 2) throw new Error(`the table is ${box.height}px tall in a 700px window: it should scroll in its own box`);
    await table.evaluate((t) => { t.scrollTop = 900; t.scrollLeft = 300; });
    await until("the header row stays at the table's top", async () => {
      const head = (await table.locator("thead th").nth(3).boundingBox())!;
      return Math.abs(head.y - box.y) <= 1;
    });
    const first = (await table.locator("tbody tr").nth(30).locator("td").first().boundingBox())!;
    if (Math.abs(first.x - box.x) > 1) throw new Error(`the first column moved off the left edge: ${first.x} vs ${box.x}`);
    // What is drawn at the header's place is the header, not a row scrolled under it.
    const over = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest("th, td")?.tagName, [box.x + 260, box.y + 8]);
    if (over !== "TH") throw new Error(`under the header's place is a ${over}`);
  } finally {
    await ore("archive", made.id).catch(() => {});
    rmSync(dir, { recursive: true, force: true });
  }
});

journey("side panel tabs: a click glides the pill to the new tab, a key moves it at once (D306)", async (page) => {
  await openSource(page, AGENTS);
  const tabs = page.locator(".side-tabs");
  await tabs.waitFor();
  await page.getByRole("tab", { name: "Source note" }).click();
  await until("no ghost left from opening", async () => (await page.locator(".seg-ghost").count()) === 0);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Animation.enable");
  await cdp.send("Animation.setPlaybackRate", { playbackRate: 0.05 });
  try {
    await page.getByRole("tab", { name: "Collected" }).click();
    await until("a click glides a pill between the tabs", async () => (await page.locator(".side-tabs .seg-ghost").count()) === 1);
  } finally {
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 });
  }
  await until("the glide ends and leaves nothing", async () => (await page.locator(".seg-ghost").count()) === 0);
  await page.locator(".doc").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("n");
  await until("N moved the tab", async () => (await page.getByRole("tab", { name: "Source note" }).getAttribute("aria-selected")) === "true");
  if (await page.locator(".seg-ghost").count()) throw new Error("a key glided the pill: keys land at once");
});

journey("original: a PowerPoint deck's Original tab shows the slide itself, follows the slide being read, and ‹ › turn to another (D307)", async (page) => {
  const made = (await ore("add", join(FIXTURES, "deck.pptx"), "--no-enrich")) as { id: string };
  const before = await page.evaluate(() => [localStorage.getItem("ore.sidetab"), localStorage.getItem("ore.mynotes")]);
  try {
    await page.reload();
    await openSource(page, "How memory works");
    const show = page.getByRole("button", { name: "Show side panel" });
    if (await show.count()) await show.click();
    await page.getByRole("tab", { name: "Original" }).click();
    const slide = page.locator(".original-slide");
    const pager = page.locator(".original-pager span");
    const total = async () => Number((await pager.innerText()).split("/")[1]);
    const shown = (n: number) => until(`slide ${n} of the original is shown`, async () => (await slide.getAttribute("data-slide")) === String(n) && (await pager.innerText()).startsWith(`${n} /`), 15000);
    await shown(1);
    // The slide is drawn: its title's words are on it, laid out as PowerPoint does.
    await until("the slide shows its own text", async () => (await slide.innerText()).includes("Encoding"));
    const box = (await slide.boundingBox())!;
    const panel = (await page.locator(".mynotes").boundingBox())!;
    if (box.width > panel.width) throw new Error(`the slide is ${box.width}px in a ${panel.width}px panel`);
    // Reading on to Retrieval, the last slide, brings it up beside it: the page's end is as far as he can scroll.
    await page.locator(".doc h2", { hasText: "Retrieval" }).evaluate((h) => h.scrollIntoView({ block: "start" }));
    await shown(3);
    await until("its words are on the slide", async () => (await slide.innerText()).includes("Every recall changes the memory"));
    if ((await total()) !== 3) throw new Error(`the pager counts ${await total()} slides, not 3`);
    if (!(await page.getByRole("button", { name: "Next slide" }).isDisabled())) throw new Error("Next slide is offered past the last slide");
    await page.getByRole("button", { name: "Previous slide" }).click();
    await shown(2);
    await page.locator(".doc h2").first().evaluate((h) => h.scrollIntoView({ block: "center" }));
    await shown(1);
  } finally {
    await ore("archive", made.id).catch(() => {});
    await page.evaluate(([tab, open]) => {
      tab ? localStorage.setItem("ore.sidetab", tab) : localStorage.removeItem("ore.sidetab");
      open ? localStorage.setItem("ore.mynotes", open) : localStorage.removeItem("ore.mynotes");
    }, before);
  }
});

journey("original: a click on a passage of the text lights where it sits on the PDF's page, and words the page lacks light nothing (D315)", async (page) => {
  const made = (await ore("add", join(FIXTURES, "textbook.pdf"), "--no-enrich")) as { id: string };
  const before = await page.evaluate(() => [localStorage.getItem("ore.sidetab"), localStorage.getItem("ore.mynotes")]);
  try {
    await page.reload();
    await openSource(page, "Chapter 1: Learning");
    const show = page.getByRole("button", { name: "Show side panel" });
    if (await show.count()) await show.click();
    await page.getByRole("tab", { name: "Original" }).click();
    const sheet = page.locator(".original canvas");
    const lit = page.locator(".original-lit");
    await until("page 1 of the original is drawn", async () => (await sheet.getAttribute("data-page")) === "1", 15000);
    if (await lit.count()) throw new Error("something is lit before he clicked");
    // A paragraph on page 3, clicked while page 1 shows: the tab turns to its page and marks it there.
    const para = page.locator(".doc p", { hasText: "Practice spread over days" }).first();
    await para.scrollIntoViewIfNeeded();
    await para.click({ position: { x: 20, y: 8 } });
    await until("the passage is lit on page 3", async () => (await sheet.getAttribute("data-page")) === "3" && (await lit.count()) > 0, 15000);
    // The marks sit on the page, over ink: inside the sheet, each a line high, not a box over the whole page.
    const [paper, bars] = [await sheet.boundingBox(), await lit.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as { x: number; y: number; width: number; height: number }))];
    for (const b of bars) {
      if (b.x < paper!.x - 1 || b.y < paper!.y - 1 || b.x + b.width > paper!.x + paper!.width + 1 || b.y + b.height > paper!.y + paper!.height + 1) throw new Error("a mark falls off the page");
      if (b.height > paper!.height / 12 || b.width < 4) throw new Error(`a mark ${Math.round(b.width)}×${Math.round(b.height)} is no line of words`);
    }
    // A click is no highlight: nothing was saved, and no popup opened.
    if (await page.locator(".popup").count()) throw new Error("the click opened the highlight popup");
    // He turns the page by hand: the mark belongs to page 3 and does not follow.
    await page.getByRole("button", { name: "Next page" }).click();
    await until("page 4 shows no mark", async () => (await sheet.getAttribute("data-page")) === "4" && (await lit.count()) === 0, 15000);
    // Words the page's own text does not hold (the page can't tell where he is): nothing is lit, never a wrong place.
    await page.evaluate(() => {
      const p = document.querySelector(".doc p")!;
      p.textContent = "Zebra quartz vexes the jumping wizard nobody printed here.";
    });
    await page.locator(".doc p").first().click({ position: { x: 20, y: 8 } });
    await until("page 1 shows, with no mark", async () => (await sheet.getAttribute("data-page")) === "1", 15000);
    await page.waitForTimeout(400);
    if (await lit.count()) throw new Error("words the page lacks lit something");
  } finally {
    await ore("archive", made.id).catch(() => {});
    await page.evaluate(([tab, open]) => {
      tab ? localStorage.setItem("ore.sidetab", tab) : localStorage.removeItem("ore.sidetab");
      open ? localStorage.setItem("ore.mynotes", open) : localStorage.removeItem("ore.mynotes");
    }, before);
    await page.reload();
  }
});

journey("highlight menu: a right-click on a highlight has its tools (the popup keeps only its kinds and note), and Show on the page opens the Original tab with it lit on its PDF page", async (page) => {
  const made = (await ore("add", join(FIXTURES, "textbook.pdf"), "--no-enrich")) as { id: string };
  const before = await page.evaluate(() => [localStorage.getItem("ore.sidetab"), localStorage.getItem("ore.mynotes")]);
  try {
    // The side panel on the source note: the Original tab is out of sight, as Tyler had it.
    await page.evaluate(() => (localStorage.setItem("ore.sidetab", "note"), localStorage.removeItem("ore.mynotes")));
    await page.reload();
    await openSource(page, "Chapter 1: Learning");
    await select(page, "Practice spread over days");
    const popup = page.getByRole("dialog", { name: "Highlight" });
    await popup.waitFor();
    if (await popup.locator("button.icon, .popup-tools").count()) throw new Error("the popup still holds tools");
    await page.keyboard.press("Enter");
    await popup.waitFor({ state: "detached" });
    // A right-click on plain text is the Mac's own (Look Up): no menu of ours.
    const plain = await pointAt(page, "crammed into one night");
    await page.mouse.click(plain.x, plain.y, { button: "right" });
    await page.waitForTimeout(300);
    if (await page.getByRole("menu").count()) throw new Error("plain text opened our menu");
    // On the highlight: its tools, in the order he reaches for them.
    const at = await pointAt(page, "Practice spread");
    await page.mouse.click(at.x, at.y, { button: "right" });
    const items = await page.getByRole("menuitem").allInnerTexts();
    const names = items.map((t) => t.replace(/\s+\S*[⌘⌫⇧⌃]\S*$/, "").trim());
    for (const want of ["Show on the page", "Copy with source", "Remove this from the text", "Remove highlight"]) if (!names.some((n) => n.startsWith(want))) throw new Error(`the menu lacks ${want}: ${names.join(" | ")}`);
    await page.getByRole("menuitem", { name: "Show on the page" }).click();
    const sheet = page.locator(".original canvas");
    await until("the Original tab is open", async () => (await page.getByRole("tab", { name: "Original" }).getAttribute("aria-selected")) === "true", 5000);
    await until("the highlight is lit on page 3", async () => (await sheet.getAttribute("data-page")) === "3" && (await page.locator(".original-lit").count()) > 0, 15000);
    await highlightMenu(page, "Practice spread over days", "Remove highlight");
  } finally {
    await ore("archive", made.id).catch(() => {});
    await page.evaluate(([tab, open]) => {
      tab ? localStorage.setItem("ore.sidetab", tab) : localStorage.removeItem("ore.sidetab");
      open ? localStorage.setItem("ore.mynotes", open) : localStorage.removeItem("ore.mynotes");
    }, before);
    await page.reload();
  }
});

journey("original: a Korean PDF's page is drawn with its words, not blank (F379)", async (page) => {
  const made = (await ore("add", join(FIXTURES, "korean.pdf"), "--no-enrich")) as { id: string };
  const before = await page.evaluate(() => [localStorage.getItem("ore.sidetab"), localStorage.getItem("ore.mynotes")]);
  try {
    await page.reload();
    await openSource(page, "기억을 오래 남기는 방법");
    const show = page.getByRole("button", { name: "Show side panel" });
    if (await show.count()) await show.click();
    await page.getByRole("tab", { name: "Original" }).click();
    const sheet = page.locator(".original canvas");
    // A page of text has pixels that aren't white (small type draws grey); one whose font found no CMap is white all over.
    await until("the page has ink", () => sheet.evaluate((c: HTMLCanvasElement) => {
      if (!c.width) return false;
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      let inked = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3]! > 0 && d[i]! + d[i + 1]! + d[i + 2]! < 600) inked++;
      return inked > 300;
    }), 15000);
  } finally {
    await page.evaluate(([tab, notes]) => {
      for (const [k, v] of [["ore.sidetab", tab], ["ore.mynotes", notes]] as const) v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
    }, before);
    await ore("archive", made.id).catch(() => {});
    await page.reload();
  }
});

journey("original: a JPEG 2000 scan's page shows ink, in WebKit, which runs pdf.js's JavaScript decoder", async (page) => {
  const made = (await ore("add", join(FIXTURES, "laplace-scan-pages19-20.pdf"), "--no-enrich")) as { id: string; title: string };
  const before = await page.evaluate(() => [localStorage.getItem("ore.sidetab"), localStorage.getItem("ore.mynotes")]);
  try {
    await page.reload();
    await openSource(page, made.title);
    const show = page.getByRole("button", { name: "Show side panel" });
    if (await show.count()) await show.click();
    await page.getByRole("tab", { name: "Original" }).click();
    // One page: pdf.js's JavaScript decoder took over 30 s for the second on CI's WebKit (about 2 s on the Mac);
    // the core test decodes both pages' images.
    for (const n of [1]) {
      const sheet = page.locator(`.original canvas[data-page="${n}"]`);
      // A page that failed says so in place of the canvas instead.
      const failed = page.getByText("This page can’t be shown here");
      await sheet.or(failed).first().waitFor({ timeout: 30_000 });
      if (await failed.isVisible()) throw new Error(`page ${n} failed to draw`);
      const ink = await sheet.evaluate((c: HTMLCanvasElement) => {
        const pixels = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
        let inked = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3]! > 0 && pixels[i]! + pixels[i + 1]! + pixels[i + 2]! < 600) inked++;
        }
        return inked;
      });
      if (ink < 300) throw new Error(`page ${n} has ${ink} dark pixels`);
    }
  } finally {
    await page.evaluate(([tab, notes]) => {
      for (const [k, v] of [["ore.sidetab", tab], ["ore.mynotes", notes]] as const) v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v);
    }, before);
    // What the source view still reads answers before the page reloads: cut off, WebKit calls it a page error (CI on #587).
    await settled(page);
    await ore("archive", made.id);
    await page.reload();
  }
}, "webkit");

journey("reader: a source with pictures above his place reopens on the passage he left, though the pictures have not loaded again (F444)", async (page) => {
  // Six tall pictures, then a long text: far below them a picture is not loaded until he scrolls back near it.
  const picture = (n: number) => `![Figure ${n}](https://pictures.test/figure-${n}.svg)`;
  await page.route("https://pictures.test/**", (r) => r.fulfill({ contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="700"><rect width="600" height="700" fill="#345"/></svg>` }));
  const dir = mkdtempSync(join(tmpdir(), "ore-place-"));
  const file = join(dir, "pictures.md");
  writeFileSync(file, `# Pictures above the place\n\n${Array.from({ length: 6 }, (_, i) => picture(i + 1)).join("\n\n")}\n\n${Array.from({ length: 120 }, (_, i) => `Passage ${i + 1} goes on about recall and spacing, long enough to wrap across a couple of lines of the reading column.`).join("\n\n")}\n`);
  const made = (await ore("add", file, "--no-enrich")) as { id: string };
  try {
    await page.reload();
    await openSource(page, "Pictures above the place");
    await until("the pictures at the top have loaded", () => page.evaluate(() => [...document.querySelectorAll<HTMLImageElement>(".doc img")].filter((i) => i.naturalHeight > 0).length >= 2));
    const passage = page.locator(".doc p", { hasText: "Passage 100 " });
    const offset = () => passage.evaluate((p) => Math.round(p.getBoundingClientRect().top - document.querySelector(".reader-scroll")!.getBoundingClientRect().top));
    await passage.evaluate((p) => {
      const pane = document.querySelector<HTMLElement>(".reader-scroll")!;
      pane.scrollTop += p.getBoundingClientRect().top - pane.getBoundingClientRect().top - 20;
    });
    await page.waitForTimeout(600); // the place is saved a moment after the scroll ends
    const was = await offset();
    // The app opened again: no picture is in memory, so the text is drawn before any of them has a height.
    await page.reload();
    await openSource(page, "Pictures above the place");
    await until(`Passage 100 is back at the top (${was}px down)`, async () => Math.abs((await offset()) - was) <= 4);
    // And it stays there as he scrolls up into pictures that load late.
    await page.locator(".reader-scroll").evaluate((e) => e.scrollBy(0, -200));
    await page.waitForTimeout(400);
    if (Math.abs((await offset()) - (was + 200)) > 6) throw new Error(`after scrolling up 200px, Passage 100 is ${await offset()}px down, not ${was + 200}`);
  } finally {
    await ore("archive", made.id).catch(() => {});
    rmSync(dir, { recursive: true, force: true });
    await page.unroute("https://pictures.test/**");
  }
});

journey("reader: a book opens on its text, its publisher's pages under one shut row that opens in place, and a click on its cover shows it larger (D354)", async (page) => {
  const made = (await ore("add", join(FIXTURES, "front-matter.epub"), "--no-enrich")) as { id: string };
  try {
    await page.reload();
    await openSource(page, "The Slow Lamp");
    const row = page.locator(".front-head").first();
    const front = page.locator(".front-body").first();
    const back = page.locator(".front-body").last();
    await row.waitFor();
    // What he can read, top down: nothing of the publisher's before the prologue.
    const visible = () => page.locator(".doc").evaluate((doc) => [...doc.querySelectorAll<HTMLElement>("p, h1, h2")].filter((e) => e.checkVisibility()).map((e) => e.textContent ?? ""));
    const shut = await visible();
    if (shut.some((t) => /Thank you for buying|personal use only|night shift/.test(t))) throw new Error(`the publisher's pages show before he opens them: ${shut.slice(0, 4).join(" | ")}`);
    if (!/^Prologue/.test(shut[0] ?? "")) throw new Error(`the book's first line is "${shut[0]}", not its prologue`);
    if ((await row.getAttribute("aria-expanded")) !== "false") throw new Error("the row says it is open while shut");
    if (await front.locator("a img").first().isVisible()) throw new Error("the newsletter button shows in the reading flow");
    // The outline is the book's own chapters, not the folded pages' headings.
    const outline = await page.locator(".outline-panel button").allTextContents();
    if (!outline.some((t) => /Prologue/.test(t))) throw new Error(`the outline lacks the prologue: ${outline.join(" | ")}`);
    // Find reaches only what shows.
    await page.keyboard.press("Meta+f");
    await page.locator(".find-bar input").waitFor();
    await page.keyboard.type("night shift");
    await page.waitForTimeout(300);
    if ((await front.isVisible()) || (await back.isVisible())) throw new Error("Find opened the folded pages");
    await page.keyboard.press("Escape");
    await page.locator(".reader-scroll").evaluate((e) => (e.scrollTop = 0)); // Find went to "night" in the text as he typed
    // Open: the pages are all there, and the row he clicked has not moved under the pointer.
    const y = async () => Math.round((await row.boundingBox())!.y);
    const was = await y();
    await row.click();
    await front.filter({ hasText: "Thank you for buying this Lantern House ebook." }).waitFor();
    await front.filter({ hasText: "To the night shift" }).waitFor();
    if (await back.isVisible()) throw new Error("opening the front matter opened the back matter too");
    await page.waitForTimeout(300);
    if (Math.abs((await y()) - was) > 1) throw new Error(`the row moved ${(await y()) - was}px when it opened`);
    if ((await row.getAttribute("aria-expanded")) !== "true") throw new Error("the row says it is shut while open");
    // Keys: Enter on the row shuts it again.
    await row.focus();
    await page.keyboard.press("Enter");
    await until("Enter on the row shuts it", async () => !(await front.isVisible()));
    if (Math.abs((await y()) - was) > 1) throw new Error(`the row moved ${(await y()) - was}px when it shut`);
    // The book's end: its acknowledgments and notes show; the publisher's last pages sit under a second shut row.
    const end = page.locator(".front-head").last();
    if (((await end.textContent()) ?? "").trim() !== "Back matter") throw new Error(`the last row says "${await end.textContent()}"`);
    if (!shut.some((t) => t === "Acknowledgments") || !shut.some((t) => /harbour ledger of 1911/.test(t))) throw new Error("the acknowledgments or the notes are folded away");
    if (shut.some((t) => /ALSO BY|NOTE ABOUT THE AUTHOR/.test(t))) throw new Error("the publisher's last pages show before he opens them");
    await end.click();
    await back.filter({ hasText: "A NOTE ABOUT THE AUTHOR" }).waitFor();
    await end.click();
    await until("a second click shuts the back matter", async () => !(await back.isVisible()));
    await page.locator(".reader-scroll").evaluate((e) => (e.scrollTop = 0));
    // The cover: a click opens it at its own size, Esc closes it.
    const cover = page.locator("img.doc-thumb");
    await until("the cover has loaded", () => cover.evaluate((i: HTMLImageElement) => i.naturalWidth > 0));
    const small = (await cover.boundingBox())!;
    await cover.click();
    const zoom = page.locator(".figure-zoom.open");
    await zoom.waitFor();
    await page.waitForTimeout(500);
    const big = (await zoom.locator("img").boundingBox())!;
    if (big.height < small.height * 1.5) throw new Error(`the opened cover is ${Math.round(big.height)}px tall, the thumbnail ${Math.round(small.height)}px`);
    if (big.height > 602) throw new Error(`the cover is blown up past its own 600px: ${Math.round(big.height)}px`);
    await page.keyboard.press("Escape");
    await until("Esc closes the cover", async () => (await page.locator(".figure-zoom").count()) === 0);
    // A library search whose words are only in the folded pages opens them, so Find has the words to light.
    await page.locator(".sidebar .side-item", { hasText: "Home" }).first().click();
    await page.keyboard.press("Meta+k");
    await page.keyboard.type("night shift");
    await page.locator("[cmdk-item]").filter({ hasText: "The Slow Lamp" }).first().click();
    await front.filter({ hasText: "To the night shift" }).waitFor();
    await until("Find counts the match", async () => /^\d+\/\d+$/.test((await page.locator(".find-count").textContent().catch(() => "")) ?? ""));
    await page.keyboard.press("Escape");
  } finally {
    await ore("archive", made.id).catch(() => {});
  }
});
