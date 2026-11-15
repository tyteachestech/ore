# Today — Ore sweep 6

Tested commit `81b21051e1778ac229658e8f80ac842113f04d7e` in the assigned release-CSP Mac app and touch-enabled WebKit phone build. Covered reading preferences across nine source examples; repeated page-edge highlighting; code copy and horizontal scrolling; all palette source-action types; note menu blocks and filtering; folding/reopening the sidebar; table headers; fast panel tabs; original PowerPoint slides; and several sweep 5 fixes with delayed writes and reopening. Only `codex-out/today/` contains tester-written files. Library changes went through the app. No repository code changes. Final coverage and limitations are listed below.

## Findings

### 1. Repeating a page-edge drag over a saved highlight containing code crashes WebKit

**S1 — Mac.**

1. From a fresh Mac page, import `codex-out/today/reader-laboratory.md` with the app's file picker. Close the skill picker if it opens.
2. Open **Today reader laboratory**, hide the side panel, and use a 1280 × 800 window. Start at the top.
3. Drag from the start of the first paragraph to approximately `(585, 770)`. Hold about 0.8 seconds until the page turns, then release. The saved highlight spans passages 1–3, the JavaScript block, and the Passage 4 heading. The first attempt works.
4. Reopen the source in a fresh page and return to the top. Repeat the same drag over that existing highlight, hold through a turn, and release.

**Expected:** The existing highlight opens or the selection is saved without interrupting the reader.

**Actual:** The WebKit page crashes. Playwright reports `Target page, context or browser has been closed`, followed by `Target crashed` on a body read. The connection and page object still exist; the content process no longer answers. The saved first highlight remains on disk. No later annotation was saved during the crashed repetitions.

**Reproduction:** Three crashes after the first successful save: twice releasing at `(1290, 770)` outside the window and once releasing inside it. The inside-release control rules out outside release as a requirement. Two matching carries over a prose-only variant passed. This narrows the case but does **not** establish that syntax colouring is the root cause.

**Evidence:** `edge-outside-1.png` (first successful save), `crash-control-before.png`, `crash-control-held.png` (immediately before the inside-release crash), `crashes.log`, `edge-outside.cjs`, `crash-control.cjs`. `plain-carry-evidence.json` records the prose-only control. The first crash preceded installation of the crash event listener; the subsequent two are timestamped in `crashes.log`.

**Suspect:** `apps/desktop/src/Reader.tsx:2736` (selection extension during edge turns), `apps/desktop/src/Reader.tsx:2853` (saving the selected range), and the interaction with the code ranges in `apps/desktop/src/Code.tsx:26`. No cause is claimed without a WebKit crash stack.

### 2. Typing a block's multiword name closes the / menu and inserts it as prose

**S2 — Mac.**

1. Open any source and its **Source note**.
2. On an empty paragraph type `/heading`. The menu offers Heading 1, Heading 2, Heading 3, and the toggle heading variants.
3. Continue typing ` 2`, matching the displayed **Heading 2** label.
4. Press Enter.

**Expected:** The menu narrows to Heading 2 and Enter creates that heading.

**Actual:** The menu closes at the space. Enter leaves the literal `/heading 2` in a normal paragraph and adds another paragraph. The trigger code has the same limitation for other labels with spaces, such as Toggle heading and Block equation; those labels were not independently typed in the two focused reproductions. Clicking those entries works.

**Reproduction:** 2/2 for `/heading 2`, resetting the note between attempts.

**Evidence:** `slash-space-1-before.png`, `slash-space-1-after.png`, `slash-space-2-before.png`, `slash-space-2-after.png`, `slash-space-evidence.json`, `slash-space.cjs`.

**Suspect:** `apps/desktop/src/editor/editor.ts:101` accepts only letters, digits and `#` after `/`. Its matching function at line 110 strips spaces, but the trigger closes before that matcher can use them.

### 3. A completed null tutor response leaves an endless wait and a dead Stop button

**S2 — Mac.** This tests handling of the supplied harness's null AI response, not AI answer quality.

1. From a fresh page, open a source and open the tutor with ⌘J. Start a new chat.
2. Use the supplied null-answer bridge, with `window.__ORE_SLOW = { tutor: 700 }` so a follow-up can be queued.
3. Send “Explain this part”. While it waits, send “Keep my follow up”.
4. Wait 12 seconds, then press **Stop the reply**.

**Expected:** A completed response with no answer shows an error or other next step and returns the queued message to the draft. Stop settles the waiting turn.

**Actual:** “Reading your sources… A reply takes about 10 seconds” stays visible with the queued message below. The bridge has no pending requests. Stop leaves the UI unchanged; the draft remains empty and the follow-up remains queued. Starting another chat is still possible.

**Reproduction:** 2/2 in separate new chats, after earlier exploratory reproductions.

**Evidence:** `tutor-null-stuck-1.png`, `tutor-null-stuck-2.png`, `tutor-null-repro-evidence.json`, `tutor-null-repro.cjs`.

**Suspect:** `apps/desktop/src/Tutor.tsx:197–213`: the job is removed before reading `r.reply`; a null `r` throws, but the catch's `mine()` check now fails and returns without settling the turn. Stop at line 235 also requires that removed job. This matches the observed completed request and inert Stop.

## Known rows seen again

None confirmed. The crash and slash filtering issue do not match existing findings. The null-answer finding concerns the stuck UI after the request completes, not the absence of an AI result.

## What passed

- Phone Aa choices changed immediately and carried across articles, an audio transcript, PDF, EPUB, PowerPoint, Word, notebook and a longer Markdown source. Light page also made the Aa sheet light.
- Phone Aa size, margins, leading, font and page persisted through reload. Repeated reflow kept the same paragraph; the final scroll position was identical after reload with the text scale unchanged (`phone-place-evidence.json`).
- Phone saved Key point text stayed identical through two rounds of font, margins, spacing, page-colour and size changes and two reloads; it also survived opening another source and returning (`phone-highlight-preserved-evidence.json`, `phone-highlight-returned.png`).
- Phone largest Aa size kept the tested code and tables inside the source width; the image-bearing EPUB and article remained readable (`phone-kinds-evidence.json`).
- Fresh Mac page-edge selections crossed multiple screens, code and a 50-row table; the saved canonical excerpts retain Markdown structure. First carries also worked in a 500px-high window. Esc ended a carry without saving it.
- Code Copy passed the exact code string to the browser clipboard and its promise resolved, twice, including after horizontal scrolling (`components-evidence.json`). Direct clipboard readback was refused by WebKit; this is not claimed as independently verified clipboard contents.
- Palette Pin, Move to Done, File under and Archive each undid, both normally and with delayed answers (`palette-evidence.json`).
- Each of the ten skill filing actions ran and undid; Open, Review this source, Open original, Reveal in Finder, Copy as Markdown and Copy path were exercised (`palette-all-evidence.json`). Native external-app launches are mocked by this harness.
- Sidebar fold cancels on Esc, survives reload when committed, and reopens at its previous 216px width.
- The 50-row table kept its header at the top of its own scroller after a 900px internal scroll.
- Source note and Collected switched rapidly across a window resize without leaving a ghost pill or multiple selected tabs.
- The three-slide deck rendered its original text, paged forward/back twice, and reopened on slide 1 (`components-evidence.json`).
- Note menu text, headings, lists, quote, callout, toggles, table, code, equations, divider, date and link entries ran. Image opened/cancelled its picker. The menu was 344px tall near the bottom, kept the last row reachable by arrows, closed on Esc, and `/div` filtered to Divider. A typed note survived reopening.
- F306 neighbour: footer Add created pointer notes, including a delayed add.
- F307 neighbour: two click-away skill renames completed with delayed writes, appeared in the sidebar and `skills.yaml`, and undid (`rename-proof-evidence.json`).
- F310/F311 neighbours: two Ore links and a three-column TSV table survived a delayed note save and reopening (`notes-links-tsv-reopen.png`).
- F314/F315 neighbours: recording position remained 0:30 after leaving/reopening twice; a held audio request showed loading, then a next step and Try again, and recovered when released (`media-evidence.json`).
- Queued tutor messages combined two follow-ups and preserved a third unsent draft when Stop was pressed, twice (`tutor-queue-evidence.json`).
- F317/F322 neighbours: five citation jumps alternated between passages 2 and 17, including repeating the same citation after scrolling away; all landed on the correct quote.
- F320/F323 neighbours: canned tutor output rendered two formulas, kept inline `xs[1]` and uncited `arr[9]` as text, and displayed exactly two real citation buttons (`tutor-citation-evidence.json`).

- Diagram in the note / menu opened its editor and Done closed it (`slash-diagram-open.png`).
- F304/F305 neighbours: rapid ratings stopped the previous sound; two delayed ratings produced no new audio start when the page was hidden (`review-sounds-evidence.json`, `hidden-rating-evidence.json`).
- F308 neighbour: two skill drags dropped on blank content preserved the sidebar order and `skills.yaml` (`skill-drag-proof-evidence.json`).
- F312/F313 neighbours: a linking skill's rename updated its backlink; deleting it with a delayed response removed the backlink, and Undo restored it, twice (`backlink-delete-evidence.json`).
- F316 neighbour: two pages saved different messages to the same chat; reopening showed both (`chat-two-pages-evidence.json`, `chat-two-windows-reopened.png`).
- F319/F324 neighbours: two reply retries retained Passage 12 in `--at`; editing out an @ mention removed its `--source` argument, including another subsequent edit (`tutor-context-evidence.json`).

## Coverage limits

This is browser WebKit, not the installed Mac app or iOS Simulator. Native iOS text-size settings, selection handles, keyboard, status-bar appearance, Finder and external-app launch were not verified. The browser reports a body scale of 0.765 by default; one diagnostic run set `--type=1`, and was excluded from the reload-place comparison when the browser reset it. AI-quality and citation-repair execution were not tested; canned replies were used only for tutor rendering/navigation. No real AI ran. No pure visual-polish findings are included.

Specific gaps: F303's long Feed return was not exercised (no populated feed in this seed); F318's backend citation repair was not run because AI is disabled; F321 is explicitly not a bug. Review-goal sound overlap was not separately forced. Folding a panel during a pending load and a selection starting beneath the sticky table header were not isolated. Phone maximum-size checks used the seeded/imported examples, not every possible source layout. The outside-release carry was simulated beyond the viewport; a native pointer leaving the operating-system window is not reproduced by this harness.

Tester pages, context and WebKit connection were closed after the run. The supplied servers were left running. Final `git status --porcelain` was empty.
