# Edge: everyday learner surfaces

Tested the supplied Mac release page on port 1652 with bridge 1653 and `/tmp/claude-501/adhoc/lib-edge`, then the phone page on port 1657, using the supplied WebKit connection. Checkout: `1ffe1feb28498fb80607b16f48c8a38fa6739afd`. Covered Home/Today, Add, reader, source notes, Review, the end screen, skill pages and All sources; empty states, failed and delayed Mac writes, bad links, interrupted connectivity, large/small text, Undo across navigation, rapid input, window sizes and Reduce Motion. Five findings below were each reproduced twice. No permanent data loss or crash was confirmed. This is a findings-only run: no application code, findings registry, real library or installed app was changed. Phone production code disables `__ORE_FAIL` and has no `__ORE_SLOW` hook, so artificial phone write failures/delays were not tested. Native iOS keyboard/selection handles, device storage/iCloud failures, every random animation beat, and an exhaustive combination of every action with every fault remain untested.

## Findings

### 1. Undo during a reader title save archives the source instead — S2, Mac

1. Open a fresh Mac page with the prescribed bridge init scripts.
2. From Home, add `# Edge undo first\n\nRetain this source while taking back its title.`
3. In the newly opened reader, set `window.__ORE_SLOW = { edit: 1800 }`.
4. Click the title, enter `Edge undo renamed first`, and press Enter.
5. Immediately click Home, then press ⌘Z before the title save resolves.
6. Wait two seconds and inspect the list and saved `doc.md`.

**Expected:** Undo waits for the pending title save and restores the old title; the source remains in the library's active lists.

**Actual:** The toast says `Undone: Added “Edge undo first”`. The source is archived. Its rename subsequently finishes, leaving an archived source with the new title. This is recoverable through Archive, but the user undid a different action from the one they just made.

**Reproduced:** 2/2, separate fresh pages and separately added sources. The bridge logs contain an `edit --title` followed by `archive`, with no inverse title edit. Read-only inspection confirmed both the new title and `archived_at` in each `doc.md`.

**Screenshots:** [first run](mac-pending-rename-undo-1.png), [second run](mac-pending-rename-undo-2.png).

**Suspected cause:** `apps/desktop/src/Reader.tsx:2900` awaits the write before `:2902` registers its Undo. The skill-name version of this race was fixed in F146; this reproduction is on the reader's source title, not the skill rename path.

### 2. Leaving a note drops its typing Undo; ⌘Z can archive its source — S2, Mac

1. Open a fresh Mac page.
2. From Home, add a new source titled `Edge note history 1`.
3. Write `An important note which should be undoable after leaving.` in Source note.
4. Wait 1.3 seconds for autosave, then click Home.
5. Press ⌘Z once.

**Expected:** The latest note edit can be undone after leaving the screen, without undoing an older, unrelated action.

**Actual:** The toast says `Undone: Added “Edge note history 1”`, and the source is archived. The note remains saved with the words just typed. Its edit is absent from the app history once its editor has closed.

**Reproduced:** 2/2 on separate sources in fresh pages. Logs show the successful `notes --set` completing before navigation, followed by `archive` on Undo. No artificial failure or delay was involved.

**Screenshots:** [first run](mac-note-history-1.png), [second run](mac-note-history-2.png).

**Suspected cause:** `apps/desktop/src/editor/NoteEditor.tsx:281` creates editor-local history and `:325` destroys the editor on unmount; `apps/desktop/src/Notes.tsx:142` saves typing without registering an app history step. D82 gives the editor its own typing history, but that history does not satisfy this audit's explicit requirement to undo after leaving the screen. F1 describes history lost on an external edit; these runs involved only ordinary navigation, with no external edit.

### 3. Today stays stale after undoing a rating outside Review — S2, iPhone

1. Open a fresh phone page from the supplied seed.
2. Tap Start review, then Start review in What to review.
3. Install the Playwright clock and advance 181,000 ms while the first exercise is shown. This exercises the app's three-minute cap per exercise.
4. Tap Sure, then Good. Tap Leave review, then Done.
5. On Today, confirm `3 of 10 min`, then press ⌘Z using the hardware-keyboard path.
6. Wait for the Undo toast, then reload the page.

**Expected:** Today immediately reflects the reversed rating: zero minutes, updated progress and updated review availability.

**Actual:** `Undone: Rating` appears, but Today still displays `3 of 10 min`. After reload it displays `0 of 10 min`, confirming that Undo changed the saved record and only the displayed state was stale. In the longer journey, after the queue had emptied, Today also kept Start review hidden after the reversed rating made an exercise due again; reload restored it.

**Reproduced:** 2/2 isolated fresh-page tests for stale minutes, plus the longer no-due journey for the hidden Start review consequence.

**Screenshots:** [stale first run](phone-rating-undo-stale-1.png), [same page after reload](phone-rating-undo-reloaded-1.png), [stale second run](phone-rating-undo-stale-2.png), [second reload](phone-rating-undo-reloaded-2.png).

**Suspected cause:** `apps/desktop/src/phone/PhoneApp.tsx:834` mounts Review without its `onLogged` callback. The Mac supplies it at `apps/desktop/src/App.tsx:2504`. Closed-review Undo calls that callback at `apps/desktop/src/Review.tsx:667`. The generic change notification only wakes screens mounted after the history step (`apps/desktop/src/util.ts:324`); Today stays mounted underneath Review.

### 4. New phone sources and skills have no creation Undo — S2, iPhone

**Source steps:**

1. Open a fresh phone page.
2. Tap +, then Choose a file or photo, and pick an authored Markdown file named `edge-undo-add.md`.
3. After the source appears, inspect the Added toast and press ⌘Z.

**Skill steps:**

1. Open a fresh phone page.
2. Open the menu, choose New skill, type `Edge created skill`, and press Return.
3. Return to Today, press ⌘Z, and reopen the menu.

**Expected:** Each creation is an Undo step. A source's Added toast provides Undo; a skill creation may remain quiet under the interaction checklist, but ⌘Z still reverses it.

**Actual:** The source toast says only `Added “edge-undo-add”`, with no Undo. ⌘Z leaves it in the list. The new skill also remains after ⌘Z; no creation step was registered. In a journey with earlier changes, Undo went past the skill creation and reversed an earlier link removal instead.

**Reproduced:** 2/2 fresh pages for each creation path, four isolated tests total.

**Screenshots:** [source first run](phone-add-no-undo-1.png), [source second run](phone-add-no-undo-2.png), [skill first run](phone-skill-no-undo-1.png), [skill second run](phone-skill-no-undo-2.png).

**Suspected cause:** `apps/desktop/src/phone/PhoneApp.tsx:556` reports imports without an inverse operation. NewSkill creates at `:369`, and its `onDone` handler at `:1007` updates the screen without registering a history step.

### 5. A delayed rating has no visible saving state — S3, Mac

1. Open Review and reveal a Fact answer by choosing Sure.
2. Set `window.__ORE_SLOW = { review: 1800 }`.
3. Click Good. Inspect the screen during the delay.

**Expected:** A visible saving indication explains the wait while rating controls are unavailable, as requested for slow writes.

**Actual:** The old question and answer remain. Rating controls are disabled, but there is no spinner, saving label or status announcement. After the delay, the next exercise appears. Repeated clicks/keys did not duplicate the rating, so this is a feedback gap, not duplicate scheduling.

**Reproduced:** 2/2, on two different Fact exercises with 1.8 s and 1.6 s delays. The second capture found no Review status message while the write waited.

**Screenshots:** [first delayed rating](mac-rating-slow.png), [second delayed rating](mac-rating-slow-2.png).

**Suspected cause:** `apps/desktop/src/Review.tsx:1346` only disables buttons for `busy`. `apps/desktop/test/waits.test.ts:40` excludes the local `review` command from its slow-call inventory. This is distinct from F11, which explicitly accepted artificially delayed local **reads**; these tests delay a learner's rating write.

## Known findings and bounds

- No exact previously fixed row was confirmed to have returned. Findings 1 and 2 are related to F146 and F1 respectively, with different triggering paths described above.
- F16's immediate iPhone Archive Undo worked twice. A late tap near toast expiry was not separately tested, so this does not resolve F16.
- Checked Explain answers can put ratings below the initial fold at 600×400, consistent with the family already recorded in F14. This run does not re-report it as new or claim its original 1180×800 case was reproduced.
- Mac 600×400 is below the installed shell's minimum 720×480 (`apps/desktop/src-tauri/tauri.conf.json:19`). The reader with its side panel exposed overflow/clipped prequestion copy at that stress size; I did not elevate that into a native-window defect.
- The iPhone shell is portrait-only (`apps/phone/src-tauri/Info.ios.plist:9`). Landscape screenshots are browser stress tests, not evidence of a supported native orientation. Its keyboard sizing code remembers the largest viewport height, so resizing one browser page through several device heights also introduces a simulated keyboard offset. Isolated finding reproductions used fresh pages at 390×844.
- Browser requests to external phone URLs met WebKit cross-origin restrictions. The phone showed its pending-import/Mac fallback; this does not establish how native `http_fetch` handles those sites. The Mac bridge exercised the actual unreachable, HTTP 404 and sign-in URLs.
- Mac `setOffline(true)` disconnects the test page from its local bridge. Its technical “mock bridge isn't answering” wording comes from the harness, so it is not a product-copy finding.
- AI returned no output as specified. The Explain check showed an actionable “unexpected reply” message, manual marking and retry. Missing AI output itself is not a finding.

## What passed

- Mac Add failure retains the exact input and reports the error; delayed Add shows “Adding…”; rapid Enter presses produce one add command.
- Mac unreachable URL: actionable connection error. HTTP 404: names the status and suggests checking the link/pasting text. GitHub sign-in page: refused for almost no readable text with the browser/text next step. No false readable source was created.
- Mac connectivity loss during held Add and rating calls preserves the input/current exercise and reports failure; retry remains possible after reconnecting.
- Phone unreachable/blocked links stay visible under Coming in with their reason and Mac fallback; Remove and its immediate Undo work.
- Phone review works with the browser context offline. Rapid rating keys did not save duplicate ratings; in-review Undo returned to the original exercise.
- Failed Mac note save retains emoji/Arabic text through navigation and retry. A delayed note save also preserves the last words when leaving immediately.
- Failed reader rename keeps the proposed name editable. A completed rename can be undone after navigation; the failure is specifically the pending-save window in finding 1.
- Failed Mac highlight adds no saved highlight and reports the error. A delayed full-source highlight succeeds. Undo after leaving removes that highlight without archiving its source.
- Archive failure leaves the source available with an error. Delayed archive followed by Undo restores it. Immediate iPhone Archive Undo restores the source twice.
- Empty skills, no collected highlights/questions, and no due exercises provide usable empty states. Both platforms distinguish “2 new exercises start tomorrow” from the due queue being finished.
- One-word source imports/readers work on both platforms. The Mac accepted an exact 200,000-character paste; the phone accepted an exact 200,000-character authored Markdown file, with the terminal marker present after all rendering chunks mounted.
- 300-character source titles, one-letter and 200-character skill names, and emoji/right-to-left text in titles and notes save and reopen. Long text wraps or clamps; Undo restores completed name edits.
- Mac stacked rating Undos return exercises in reverse order. Rating Undo from the Mac end screen reopens the exercise; Undo after leaving the Mac review updates Home.
- Typing `Build` into All sources while a delayed list refresh lands preserves the filter and displays matching rows.
- Each named surface was captured at Mac 600×400 and 2560×1440, and phone 320×568, 390×844, 440×956 plus their landscape counterparts. Source-note layouts are the reader with its note panel open. Size screenshots use the surface name and dimensions in the filename.
- Mac normal ending shows the day's minutes and bonus lap. Under Reduce Motion, Mac and phone show `12 minutes today` and `2 minutes past today’s goal`, without a cart or running CSS animations. Two Mac reduced-motion screenshot pairs and one phone pair, one second apart, are pixel-identical; the final minutes remain visible. The phone's note transition also reports no running animation under Reduce Motion.

## Artifacts

- `session.log`: interactive observations, bridge command records, counters and errors. Some early automation locator/time-limit failures are harness errors, not findings; the report includes only reproduced behavior.
- `driver.cjs`: CommonJS runner for the connected WebKit session. It never launches a browser.
- `reproduce-undo.cjs`: standalone replay of the four Undo findings, twice per path, using only edge's ports and scratch data. It creates additional scratch sources when run. Syntax check and a complete replay succeeded; `repro-results.json` and `replay-console.log` contain the results. These are two additional reproductions per path beyond the initial counts above.
- Screenshots named `mac-<surface>-<width>x<height>.png` and `phone-<surface>-<width>x<height>.png`: sizing evidence. Finding screenshots are linked individually above.

Native app changes, fixes, commits, merges, or installations were not part of this findings-only task.
