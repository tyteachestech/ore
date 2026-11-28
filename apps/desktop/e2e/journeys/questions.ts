import { BRIDGE, failNext, journey, openSource, ore, select, settled, TESTING, until } from "../harness";

journey("skill page Questions: each row is one Tab stop then its ⋯, and ↑ ↓ move between rows", async (page) => {
  await page.getByRole("button", { name: /^Learning/ }).first().click();
  for (const q of ["Does spacing help with skills, not just facts?", "How long should a quiz gap be?"]) {
    await page.getByRole("button", { name: "Add a question" }).first().click();
    await page.getByLabel("New question").fill(q);
    await page.keyboard.press("Enter");
    await page.locator(".question-quote", { hasText: q }).waitFor();
  }
  const rows = page.locator(".skill-col .question-quote");
  if ((await rows.count()) < 2) throw new Error("fewer than two questions");
  await rows.first().focus();
  await page.keyboard.press("Tab");
  const tabbed = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  if (tabbed !== "Question actions") throw new Error(`Tab from a question landed on ${tabbed}, not its ⋯`);
  await rows.first().focus();
  await page.keyboard.press("ArrowDown");
  if (!(await rows.nth(1).evaluate((b) => b === document.activeElement))) throw new Error("↓ didn't move to the next question");
  await page.keyboard.press("ArrowUp");
  if (!(await rows.first().evaluate((b) => b === document.activeElement))) throw new Error("↑ didn't move back");
});

journey("answer pieces: one click rewrites a piece in place, ⌘Z puts the old words back; emptied, it goes with Undo", async (page) => {
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  await page.getByText("Does this hold for kids?", { exact: true }).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Answer…" }).click();
  const box = page.getByLabel("Your answer to Does this hold for kids?");
  await box.fill("Mostly yes.");
  await page.keyboard.press("Enter");
  const piece = page.getByRole("button", { name: "Edit: Mostly yes." });
  await piece.click();
  const edit = page.getByLabel("Edit this part of your answer");
  await edit.fill("Yes, from about age 8.");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Edit: Yes, from about age 8." }).waitFor();
  await until("focus is back on the piece", () => page.getByRole("button", { name: "Edit: Yes, from about age 8." }).evaluate((el) => el === document.activeElement));
  await page.locator(".skill-page, main").first().click({ position: { x: 2, y: 2 } }).catch(() => {});
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Meta+z");
  await piece.waitFor();
  await piece.click();
  await edit.fill("");
  await page.keyboard.press("Enter");
  await until("emptied, it goes", async () => (await piece.count()) === 0);
  await until("focus goes on to the answer field", () => page.evaluate(() => !!document.activeElement?.matches(".qa-box .field:not(.qa-piece-edit)")));
  await page.locator(".toast").filter({ hasText: "Removed from your answer" }).getByRole("button", { name: "Undo" }).click();
  await piece.waitFor();
  // Leave the question as the seed had it.
  await piece.click();
  await edit.fill("");
  await page.keyboard.press("Enter");
  await until("the piece is gone again", async () => (await piece.count()) === 0);
  await page.waitForTimeout(300);
});

// Review of #442 (F357): a piece's Redo ran `rewrite` from the render that removed it, whose answer
// list had only the piece's old ts; after Undo gave it a new one, a Redo that failed put `undefined` in the list.
journey("answer pieces: Undo of a removed piece, then a Redo that fails, keeps the piece (F357)", async (page) => {
  type Q = { id: string; note?: string; answers: { ts: string; text: string }[] };
  const kids = async () => ((await ore("questions", "--skill=learning")) as Q[]).find((x) => x.note === "Does this hold for kids?")!;
  const fail = (why: string | null) => page.evaluate((why) => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = why ? { answer: why } : {}), why);
  try {
    await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
    await page.getByText("Does this hold for kids?", { exact: true }).first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "Answer…" }).click();
    await page.getByLabel("Your answer to Does this hold for kids?").fill("Mostly yes.");
    await page.keyboard.press("Enter");
    const piece = page.getByRole("button", { name: "Edit: Mostly yes." });
    await piece.click();
    await page.getByLabel("Edit this part of your answer").fill("");
    await page.keyboard.press("Enter");
    await until("emptied, it goes", async () => (await piece.count()) === 0);
    await page.locator(".toast").filter({ hasText: "Removed from your answer" }).getByRole("button", { name: "Undo" }).click();
    await piece.waitFor();
    await settled(page);
    await fail("offline");
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Meta+Shift+z");
    await settled(page);
    await page.locator(".toast").filter({ hasText: "offline" }).first().waitFor();
    if (!(await piece.isVisible())) throw new Error("a failed Redo of the piece's removal lost the piece or the answer box");
  } finally {
    await fail(null);
    const k = await kids();
    for (const c of k.answers) await ore("answer", k.id, `--remove=${c.ts}`); // leave it as the seed had it
  }
});

// CI met this on master (F357's journey, shard 2/5): the questions read again after the removal landed
// answered after the Undo had put the piece back, and showed the answer without it.
journey("answer pieces: Undo of a removed piece keeps it when the read after the removal answers late (F476)", async (page) => {
  type Q = { id: string; note?: string; answers: { ts: string; text: string }[] };
  const kids = async () => ((await ore("questions", "--skill=learning")) as Q[]).find((x) => x.note === "Does this hold for kids?")!;
  const slow = (ms: number | null) => page.evaluate((ms) => ((window as unknown as { __ORE_SLOW?: object }).__ORE_SLOW = ms ? { questions: ms } : undefined), ms);
  try {
    await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
    await page.getByText("Does this hold for kids?", { exact: true }).first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "Answer…" }).click();
    await page.getByLabel("Your answer to Does this hold for kids?").fill("Mostly yes.");
    await page.keyboard.press("Enter");
    const piece = page.getByRole("button", { name: "Edit: Mostly yes." });
    await piece.click();
    await settled(page);
    await slow(1200);
    await page.getByLabel("Edit this part of your answer").fill("");
    await page.keyboard.press("Enter");
    await until("removed in the library", async () => (await kids()).answers.length === 0);
    await page.locator(".toast").filter({ hasText: "Removed from your answer" }).getByRole("button", { name: "Undo" }).click();
    await piece.waitFor();
    await until("back in the library", async () => (await kids()).answers.length === 1);
    await slow(null);
    await settled(page);
    await page.waitForTimeout(300);
    if (!(await piece.isVisible())) throw new Error("the piece Undo put back went again when an older read of the questions answered");
    // And an edit made straight after an Undo, while that older read is still out, is not lost to the read made again.
    await piece.click();
    await page.getByLabel("Edit this part of your answer").fill("");
    await slow(1200);
    await page.keyboard.press("Enter");
    await until("emptied, it goes", async () => (await piece.count()) === 0);
    await page.locator(".toast").filter({ hasText: "Removed from your answer" }).getByRole("button", { name: "Undo" }).click();
    await piece.waitFor();
    await piece.click();
    await page.getByLabel("Edit this part of your answer").fill("");
    await page.keyboard.press("Enter");
    await until("emptied straight after the Undo, it goes", async () => (await piece.count()) === 0);
    await slow(null);
    await settled(page);
    await page.waitForTimeout(1500);
    if ((await piece.count()) !== 0) throw new Error("a piece removed straight after its Undo came back when the questions were read again");
  } finally {
    await slow(null);
    const k = await kids();
    for (const c of k.answers) await ore("answer", k.id, `--remove=${c.ts}`); // leave it as the seed had it
  }
});

// F351: removes that take the row away at once put their step on the history only once the write
// was back, so a ⌘Z meanwhile took back the step before (here the piece's edit) instead.
journey("answer pieces: ⌘Z while an emptied piece is being removed brings that piece back, not the edit before it (F351)", async (page) => {
  type Q = { id: string; note?: string; answers: { ts: string; text: string }[] };
  const kids = async () => ((await ore("questions", "--skill=learning")) as Q[]).find((x) => x.note === "Does this hold for kids?")!;
  const slow = (ms: number | null) => page.evaluate((ms) => ((window as unknown as { __ORE_SLOW?: object }).__ORE_SLOW = ms ? { answer: ms } : undefined), ms);
  try {
    await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
    await page.getByText("Does this hold for kids?", { exact: true }).first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "Answer…" }).click();
    await page.getByLabel("Your answer to Does this hold for kids?").fill("Mostly yes.");
    await page.keyboard.press("Enter");
    const edit = page.getByLabel("Edit this part of your answer");
    await page.getByRole("button", { name: "Edit: Mostly yes." }).click();
    await edit.fill("Yes, from about age 8.");
    await page.keyboard.press("Enter");
    const fixed = page.getByRole("button", { name: "Edit: Yes, from about age 8." });
    await fixed.waitFor();
    await settled(page);
    await fixed.click();
    await edit.fill("");
    await slow(1500);
    await page.keyboard.press("Enter");
    await until("emptied, it goes", async () => (await fixed.count()) === 0);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press("Meta+z");
    await settled(page);
    await slow(null);
    const left = (await kids()).answers.map((c) => c.text).join(" | ");
    if (left !== "Yes, from about age 8.") throw new Error(`⌘Z during the removal left the answer as “${left}”`);
  } finally {
    await slow(null);
    const k = await kids();
    for (const c of k.answers) await ore("answer", k.id, `--remove=${c.ts}`); // leave it as the seed had it
  }
});

journey("question panel: ⌘Z while Not answered here is being written puts the match back (F351)", async (page) => {
  const item = ((await ore("ls")) as { id: string; title: string }[]).find((i) => i.title === TESTING)!.id;
  const q = ((await ore("questions", "--skill=learning")) as { id: string; note?: string }[]).find((x) => x.note === "Does this hold for kids?")!;
  await ore("match", item, q.id);
  const matched = async () => !!((await ore("show", item)) as { question_matches?: { question: string }[] }).question_matches?.some((m) => m.question === q.id);
  try {
    await openSource(page, TESTING);
    await page.getByRole("tab", { name: "Collected" }).click();
    const toggle = page.locator(".cp-head.question .cp-toggle");
    if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
    const row = page.locator(".qp-q").filter({ hasText: "Does this hold for kids?" }).first();
    await row.getByRole("button", { name: "Question actions" }).click();
    await page.evaluate(() => ((window as unknown as { __ORE_SLOW?: object }).__ORE_SLOW = { match: 1500 }));
    await page.getByRole("menuitem", { name: "Not answered here" }).click();
    // A click on the page first: the panel's "Ask one", focused once its list is empty, goes as ⌘Z fills it (F355).
    await page.locator(".doc-head h1").click();
    await page.keyboard.press("Meta+z");
    await settled(page);
    await page.evaluate(() => ((window as unknown as { __ORE_SLOW?: object }).__ORE_SLOW = undefined));
    if (!(await matched())) throw new Error("⌘Z during Not answered here left the match dropped");
  } finally {
    await ore("match", item, q.id, "--drop");
  }
});

journey("answer pieces: a correction he is writing stays through a blur and a failed save, and saves on the next try", async (page) => {
  const fail = (why: string | null) => page.evaluate((why) => ((window as unknown as { __ORE_FAIL: Record<string, string> }).__ORE_FAIL = why ? { answer: why } : {}), why);
  await page.locator(".sidebar .side-item", { hasText: "Learning" }).first().click();
  await page.getByText("Does this hold for kids?", { exact: true }).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Answer…" }).click();
  const box = page.getByLabel("Your answer to Does this hold for kids?");
  await box.fill("Mostly yes.");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Edit: Mostly yes." }).click();
  const edit = page.getByLabel("Edit this part of your answer");
  await edit.fill("Yes, from about age 8.");
  await box.click(); // focus leaves the piece
  if ((await edit.inputValue().catch(() => null)) !== "Yes, from about age 8.") throw new Error("a blur lost the correction");
  await edit.click();
  await fail("The library is read-only.");
  await page.keyboard.press("Enter");
  await page.locator(".toast[role=alert]").filter({ hasText: "The library is read-only." }).waitFor();
  await until("the failed save gives his correction back", async () => (await edit.isVisible()) && (await edit.inputValue()) === "Yes, from about age 8.");
  await fail(null);
  await edit.focus();
  await page.keyboard.press("Enter");
  const fixed = page.getByRole("button", { name: "Edit: Yes, from about age 8." });
  await fixed.waitFor();
  // A correction still open when he clicks Answered is saved with it.
  await fixed.click();
  await edit.fill("Yes, from about age 9.");
  await page.getByRole("button", { name: "Answered", exact: true }).click();
  type Q = { id: string; note?: string; status: string; answers: { ts: string; text: string }[] };
  const kids = async () => ((await ore("questions", "--skill=learning")) as Q[]).find((x) => x.note === "Does this hold for kids?")!;
  await until("Answered saves the open correction", async () => (await kids()).answers.some((c) => c.text === "Yes, from about age 9."));
  // Leave the question as the seed had it: open, with no answer.
  await page.locator(".toast").filter({ hasText: "Answered" }).getByRole("button", { name: "Undo" }).click();
  await until("Undo reopens it", async () => (await kids()).status !== "done");
  const k = await kids();
  for (const c of k.answers) await ore("answer", k.id, `--remove=${c.ts}`);
});

journey("reader questions: ask one, ⌘Z takes it back; its ⋯ menu marks it answered and deletes it, ⌘Z each", async (page) => {
  await openSource(page, TESTING);
  await page.getByRole("tab", { name: "Collected" }).click();
  const head = page.locator(".cp-head", { hasText: "Questions" });
  const toggle = head.locator(".cp-toggle");
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  const ask = "Does spacing help with motor skills too?";
  const rows = () => page.locator(".qp-line", { hasText: ask }).count();
  await head.getByRole("button", { name: "Ask a question" }).click();
  await page.getByLabel("New question").fill(ask);
  await page.keyboard.press("Enter");
  await until("the question is listed", async () => (await rows()) === 1);
  await until("focus is back on Ask a question", () => head.getByRole("button", { name: "Ask a question" }).evaluate((el) => el === document.activeElement));
  await page.waitForTimeout(300);
  await page.keyboard.press("Meta+z");
  await until("⌘Z takes it back", async () => (await rows()) === 0);
  await page.keyboard.press("Meta+Shift+z");
  await until("⇧⌘Z asks it again", async () => (await rows()) === 1);
  const line = page.locator(".qp-line", { hasText: ask });
  await line.hover();
  await line.getByRole("button", { name: "Question actions" }).click();
  await page.getByRole("menuitem", { name: "Mark answered" }).click();
  await until("it is struck through", async () => (await page.locator(".qp-q.done", { hasText: ask }).count()) === 1);
  await page.keyboard.press("Meta+z");
  await until("⌘Z reopens it", async () => (await page.locator(".qp-q.done", { hasText: ask }).count()) === 0);
  await line.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete question" }).click();
  await until("it is gone", async () => (await rows()) === 0);
  // A ⌘Z whose save fails shows no row that isn't there, and the next ⌘Z brings back one, not two.
  await page.locator(".toast", { hasText: "Question deleted" }).waitFor();
  await page.evaluate(() => void ((window as unknown as { __ORE_FAIL?: object }).__ORE_FAIL = { annotate: "The library is read-only." }));
  await page.keyboard.press("Meta+z");
  await page.locator(".toast").filter({ hasText: "Couldn’t undo" }).waitFor();
  if ((await rows()) !== 0) throw new Error("a failed ⌘Z shows the question it couldn't bring back");
  await page.evaluate(() => void ((window as unknown as { __ORE_FAIL?: object }).__ORE_FAIL = {}));
  await page.keyboard.press("Meta+z");
  await until("⌘Z puts it back", async () => (await rows()) === 1);
  await page.waitForTimeout(300);
  if ((await rows()) !== 1) throw new Error(`⌘Z after a failed one shows ${await rows()} copies of the question`);
  // Leave the library as it was.
  await line.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Delete question" }).click();
  await until("deleted again", async () => (await rows()) === 0);
});

journey("reader questions: a piece of the answer, ⌘Z takes it out and ⇧⌘Z puts it back", async (page) => {
  await openSource(page, TESTING);
  await page.getByRole("tab", { name: "Collected" }).click();
  const toggle = page.locator(".cp-head", { hasText: "Questions" }).locator(".cp-toggle");
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  const q = page.locator(".qp-q", { hasText: "Does this hold for kids?" });
  // The row is one line (D134): the pieces show in its answer box, so each look opens it and closes it again.
  const pieces = async () => {
    await q.locator(".qp-row").click();
    await q.locator(".qa-actions").waitFor();
    const n = await q.locator(".qa-piece").count();
    await page.keyboard.press("Escape");
    await q.locator(".qa-actions").waitFor({ state: "detached" });
    return n;
  };
  const before = await pieces();
  await q.locator(".qp-row").click();
  await page.keyboard.type("Spacing helped fourth graders in one study.");
  await page.keyboard.press("Enter");
  await until("the piece is added", async () => (await q.locator(".qa-piece").count()) === before + 1);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Meta+z");
  await until("⌘Z takes it out", async () => (await pieces()) === before);
  await page.keyboard.press("Meta+Shift+z");
  await until("⇧⌘Z puts it back", async () => (await pieces()) === before + 1);
  await page.keyboard.press("Meta+z");
  await until("and out again, as it was", async () => (await pieces()) === before);
});

journey("questions: one asked on a source in no skill is listed there; a highlight retyped as a question joins the list at once", async (page) => {
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill("# In no skill yet\n\nOne passage about useful deliberate practice, to ask about.");
  await page.keyboard.press("Enter");
  await page.locator(".doc").getByText("One passage about useful").waitFor();
  await page.getByRole("tab", { name: "Collected" }).click();
  const head = page.locator(".cp-head", { hasText: "Questions" });
  if ((await head.locator(".cp-toggle").getAttribute("aria-expanded")) === "false") await head.locator(".cp-toggle").click();
  await head.getByRole("button", { name: "Ask a question" }).click();
  await page.getByLabel("New question").fill("Does this hold without a coach?");
  await page.keyboard.press("Enter");
  await page.locator(".qp-line", { hasText: "Does this hold without a coach?" }).waitFor({ timeout: 3000 }).catch(() => {
    throw new Error("the question he asked on a source in no skill is not listed on it");
  });
  await select(page, "useful deliberate practice");
  await page.keyboard.press("3"); // a question highlight
  await page.locator(".qp-line", { hasText: "useful deliberate practice" }).waitFor({ timeout: 3000 }).catch(() => {
    throw new Error("a passage marked as a question is missing from Questions until the tab is reopened");
  });
});

journey("questions: a highlight marked as a question joins the list even when its save lands after the list was read", async (page) => {
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.getByLabel("Link, file path or text").fill("# A slow save\n\nSpacing reviews apart strengthens memory more than cramming them together does.");
  await page.keyboard.press("Enter");
  await page.locator(".doc").getByText("Spacing reviews apart").waitFor();
  await page.getByRole("tab", { name: "Collected" }).click();
  const head = page.locator(".cp-head", { hasText: "Questions" });
  if ((await head.locator(".cp-toggle").getAttribute("aria-expanded")) === "false") await head.locator(".cp-toggle").click();
  // The mark's write reaches the library late: the list, read the moment the highlight shows as a question, comes back without it.
  await page.route(/\/ore$/, async (route) => {
    if ((route.request().postData() ?? "").includes('"args":["annotate",')) await new Promise((r) => setTimeout(r, 700));
    await route.fallback();
  });
  await select(page, "strengthens memory more than cramming");
  await page.locator(".popup").waitFor();
  await page.keyboard.press("3"); // a question highlight
  await page.locator(".qp-line", { hasText: "strengthens memory more than cramming" }).waitFor({ timeout: 4000 }).catch(() => {
    throw new Error("a passage marked as a question never joins Questions when its save lands after the list was read");
  });
  await page.unroute(/\/ore$/);
});

journey("questions on a source: Collected lists only this source's questions, not its skill's others (D219); one whose link to the source fails to save is taken back", async (page) => {
  const k = (await ore("skills", "add", "Glassblowing")) as { id: string };
  const q = (await ore("snippet", "--text=How hot is the glory hole?", "--intent=question", `--skill=${k.id}`)) as { annotation: { id: string } };
  const made = (await fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich", "--json"], stdin: "# A page in no skill\n\nGather, blow, shape, anneal." }) }).then((r) => r.json())) as { id: string };
  try {
    await page.reload();
    await openSource(page, "A page in no skill");
    await page.getByRole("tab", { name: "Collected" }).click();
    const head = page.locator(".cp-head", { hasText: "Questions" });
    if ((await head.locator(".cp-toggle").getAttribute("aria-expanded")) === "false") await head.locator(".cp-toggle").click();
    // A question whose link to this source fails to save leaves nothing behind.
    const count = async () => ((await ore("questions")) as unknown[]).length;
    const before = await count();
    await head.getByRole("button", { name: "Ask a question" }).click();
    await page.getByLabel("New question").fill("Which gather comes first?");
    await failNext(page, "match", "The library is read-only.");
    await page.keyboard.press("Enter");
    await page.getByText("The library is read-only.").first().waitFor();
    await failNext(page, "match", null);
    await until("the half-saved question is taken back", async () => (await count()) === before);
    await page.keyboard.press("Escape");
    // Filed under a skill, it still lists only its own: the skill's question asked elsewhere stays on the skill's page.
    // In no skill, the byline holds a faint "Skill" where its skills go, as a blank Author does (F454): no lone + on hover.
    const blank = page.getByRole("button", { name: "Skills for A page in no skill" });
    await page.mouse.move(0, 0);
    const look = await blank.evaluate((el) => `${el.textContent} ${getComputedStyle(el).opacity}`);
    if (look !== "Skill 1") throw new Error(`a source in no skill shows "${look}" for its skills, not a faint Skill`);
    await blank.click();
    await page.locator(".skill-picker [cmdk-item]", { hasText: "Glassblowing" }).click();
    await page.keyboard.press("Escape");
    await page.getByText("No open questions from this source.").waitFor();
    if (await page.locator(".qp-line", { hasText: "How hot is the glory hole?" }).count()) throw new Error("a question asked in another source shows in this one's Collected");
    // One he asks here stays, though the source is under a skill now.
    await head.getByRole("button", { name: "Ask a question" }).click();
    await page.getByLabel("New question").fill("Which gather comes first?");
    await page.keyboard.press("Enter");
    await page.locator(".qp-line", { hasText: "Which gather comes first?" }).waitFor();
  } finally {
    await ore("annotate", q.annotation.id, "--status", "deleted").catch(() => {});
    await ore("archive", made.id).catch(() => {});
    await ore("skills", "rm", k.id).catch(() => {});
  }
});

journey("skill page: an answer still names and opens its archived source (F-new-archived-answer-source)", async (page) => {
  const question = "How should I space practice?";
  const title = "A guide to practice gaps";
  const passage = "Leave a short gap before the next practice session.";
  const q = (await ore("snippet", `--text=${question}`, "--intent=question", "--skill=learning")) as { annotation: { id: string } };
  const source = (await fetch(`http://localhost:${BRIDGE}/ore`, { method: "POST", body: JSON.stringify({ args: ["add", "--stdin", "--no-enrich", "--skill=learning"], stdin: `# ${title}\n\n${passage}` }) }).then((r) => r.json())) as { id: string };
  try {
    await ore("answer", q.annotation.id, "--text=Space out the sessions.", `--item=${source.id}`, "--done");
    await page.reload();
    const skill = page.locator(".sidebar .side-item", { hasText: "Learning" }).first();
    const answered = page.getByRole("tab", { name: "Answered", exact: true });
    const sourceLink = page.locator(".question", { hasText: question }).getByRole("button", { name: title, exact: true });
    await skill.click();
    await answered.click();
    await sourceLink.click();
    await page.getByRole("button", { name: "Source actions" }).click();
    await page.getByRole("menuitem", { name: /^Archive/ }).click();
    await until("the source is archived on disk", async () => !!(await ore("show", source.id)).archived_at);

    await page.reload();
    await skill.click();
    await answered.click();
    await page.getByText("Space out the sessions.", { exact: false }).filter({ visible: true }).first().waitFor();
    if (!(await sourceLink.isVisible())) throw new Error("the saved answer lost its source link after Archive");
    await sourceLink.click();
    await page.locator(".doc").getByText(passage, { exact: true }).waitFor();
  } finally {
    await ore("annotate", q.annotation.id, "--status", "deleted");
  }
});
