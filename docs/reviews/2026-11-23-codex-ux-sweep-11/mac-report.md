# Mac UX sweep — round 11

Tested the supplied release build at `http://localhost:1761/`, bridge `1762`, in connected WebKit at 1280×800 with 2× screenshots; source checkout `1ff84280f018d7e6762906011b5150298be2377a`. Read the working agreements, daily-session design, findings register and earlier sweep reports. Completed two normal learner journeys starting from fresh pages: three source kinds each, reading, a highlight and note, a source note, a tutor question, a new skill and filing, due review, Settings, ⌘K navigation, leaving and reopening; both text sources also completed Finish with saved recall. Fresh pages reused the assigned scratch library rather than resetting it. Rechecked the Mac parts of #509 and then confirmed the two remaining transcript-navigation problems twice each from fresh pages. **Two S2 findings, both incomplete fixes related to known rows; no additional new finding, S1 or observed data loss.** Skipped iPhone (including its Clear them target-size fix, F528), native integration, actual YouTube playback, real AI, the named exclusions, pending-save Undo, visual taste and detailed repetition of earlier passed edge cases. No failures or delays were injected. Only `codex-out/mac/` contains tester-written artifacts; scratch-library changes went through the app.

## Findings

### MAC-1 — A collected transcript highlight still needs a second click to show its passage and note

**S2 · Mac · F526 incomplete fix · 2/2 explicit fresh-page confirmations**, plus two earlier confirmations and the initial observation.

1. Open a fresh app page. If needed, add `https://academy.claude.com/courses/ai-fluency-framework-foundations`; wait for its lessons to finish importing. This run added the introduction lesson's URL, which imported the 14-lesson course.
2. Use ⌘K to open **Introduction to AI Fluency**. With Transcript visible, highlight **I'm Joe Feller.** and save a short highlight note. This run used **The first instructor introduces himself.**
3. Close the highlight popup. Click **Transcript** to fold it away.
4. Scroll the lesson down to **Reflection / What’s next**.
5. Open **Collected**, expand **Highlights**, and click **I'm Joe Feller. 0:00** once.
6. Wait, then click that same row a second time.

**Expected:** The first click unfolds the transcript, brings the passage into view and opens its note there.

**Actual:** The first click unfolds the transcript but keeps the reader at the lesson's end. The popup opens entirely above the window, so the click appears to do nothing. In both confirmations, the reader moved from scrollTop **1922 to 2226**, preserving the lower passage as the transcript added height; the popup was at **y = −1450.64**. A second click moves to scrollTop **376**, shows the highlighted sentence and puts the popup at **y = 399.36**. This fails the one-click-opens rule and hides the saved note until the learner guesses to click again.

**Evidence:** [Run 1 before](confirm-1-before.png), [after one click](confirm-1-after.png), [after the second click](confirm-1-second-click.png); [run 2 before](confirm-2-before.png), [after one click](confirm-2-after.png), [after the second click](confirm-2-second-click.png). [Measurements and scroll events](visible-confirmations.json), [bounded confirmation script](confirm-visible.cjs). The earlier pair is in [collected-confirmations.json](collected-confirmations.json).

**Suspected code interaction:** `apps/desktop/src/Reader.tsx:1881–1891` opens the transcript and schedules the jump on the next animation frame. `showTranscriptFor` at **3542–3549** changes the fold state; `toThird` at **959–972** scrolls the transcript and its containing reader. The reader's resize observer at **1366–1382** also watches the document and restores its previous reading position on height changes (`back()` at **1375**, implemented by `apps/desktop/src/reading.ts:149–151`). The observed first click preserves the old lower paragraph as the transcript expands; the second click succeeds once that resize has settled. This is the likely conflict, not a claim that the exact callback ordering was proven with a debugger.

**Not the mock:** The saved transcript, highlight and note are real CLI records. The defect concerns production fold, scroll and popup placement. No AI, slow-write or failure hook is used. The missing native video player is visible in the harness but does not perform these navigation operations; the same saved passage opens correctly on the second click.

### MAC-2 — A library search finds a transcript match but leaves it off-screen, even after Enter

**S2 · Mac · F525 search landing remains incomplete · 2/2 dedicated fresh-page confirmations**, plus the initial observation.

1. From a fresh page, open **Introduction to AI Fluency** from the imported course.
2. Fold **Transcript**, then scroll the lesson down to **Reflection / What’s next**.
3. Go Home with ⌘0.
4. Open ⌘K, search **Cork University**, and click the **Introduction to AI Fluency** result quoting “I'm a professor at the Cork University Business School.”
5. Press Enter in the opened Find field to advance to the match.

**Expected:** Open the quoted passage in view. Enter should bring the current match into view too.

**Actual:** The transcript unfolds and Find correctly reports **1/1**, but the reader stays at the bottom. In both runs its scrollTop was **2226**, the matching paragraph started at **y = −1488.59**, and the transcript box at **y = −1557.34**. Enter leaves scrollTop at **2226**. The learner sees a match count over unrelated lesson text and must manually find the video/transcript above it.

**Evidence:** [Run 1 landing](search-1-landing.png), [after Enter](search-1-next.png); [run 2 landing](search-2-landing.png), [after Enter](search-2-next.png). [Measurements](search-confirmations.json), [bounded confirmation script](confirm-search.cjs).

**Code:** `apps/desktop/src/Reader.tsx:1266–1271` now opens the transcript and sets Find's query. However, `apps/desktop/src/Find.tsx:123–128` chooses only the nearest scrolling ancestor, the nested `.vc-transcript`; `reveal` at **139–145** checks the match against that box's bounds and scrolls only that box. It does not bring the box itself into the outer `.reader-scroll` viewport. A match can therefore count as in view inside a transcript that is wholly above the window. Query navigation calls this at **199–201**, and Enter/Next at **234–240**. This also explains why Enter cannot recover the landing, unlike MAC-1's second Collected click.

**Not the mock:** Search finds words saved in `doc.md`, and the real Find count is correct. The failure is production navigation between nested scroll areas; no missing AI answer or native-player operation is involved.

## Known rows seen come back / fix checks

- **F526:** Re-reported as MAC-1. #509 reveals the folded transcript, but its passage and note still fail to appear on the first click after reading farther down the lesson.
- **F525:** The stale **Not found** count is fixed: showing the transcript changes it to **1/1** without editing the query, in both confirmation runs. The library-search part still fails to show its quoted passage; MAC-2 documents the remaining navigation defect rather than claiming the old stale count returned.
- **F527:** Passed twice. **Open on YouTube** sends `https://www.youtube.com/watch?v=JpGtOfSgR-c`, not the Academy lesson URL. Opener arguments are in [visible-confirmations.json](visible-confirmations.json); actual external-browser playback was not tested.
- **F528:** Phone-only target sizing; not opened or tested on this Mac-only assignment.

## What passed

- Journey 1 imported **Field guide eleven A** as text, **How memory works** from PowerPoint, and **Retrieval practice notes** from Word; all were filed under **Practical learning eleven** ([skill list](j1-skill.png)).
- Journey 2 imported **Field guide eleven B** as text, **Chapter 1: Learning** from PDF, and **A Small Book of Remembering** from EPUB; all were filed under **Transfer practice eleven** ([To read](j2-skill.png), [finished text in Done](j2-skill-done.png)).
- File imports retained readable content and meaningful type labels: Slides, Document, PDF and Book.
- Both text sources retained their highlights, highlight notes and source notes after leaving and reopening; the second highlight retained its Key point intent ([first final reopen](j1-final-reopened.png), [second](j2-final-reopened.png)).
- An additional edit to the first source note survived reopening.
- Both Finish flows saved recall text into the source note and completed despite unavailable AI feedback.
- Both tutor questions showed a visible error and **Try again**, leaving a usable message composer ([first](j1-tutor.png), [second](j2-tutor.png)).
- Both new skills appeared immediately; filing and finishing updated their source lists without reloading the app.
- Five due ratings saved: one in journey 1 and four in journey 2, including an Explain and a New exercise; the saved review log contains all five, totaling **74,690 ms** ([library evidence](library-evidence.json)).
- When Explain grading was unavailable, manual key-point marking and a Good rating remained usable.
- Leaving the first review showed its ending; the second reached the no-more-due ending, and Done returned to Home ([first](j1-review-end.png), [second](j2-review-end.png)).
- Settings opened with ⌘, and closed with Escape in both journeys ([first](j1-settings.png), [second](j2-settings.png)).
- ⌘K created skills and found/opened ordinary sources; the confirmed failures are specifically transcript passage navigation.
- Reopening the final skill's Done tab showed **Field guide eleven B** in the correct place.
- The completed driver session recorded no page errors and ended with zero pending bridge calls ([errors](page-errors.json)); its context and page were closed.

## Hesitations, exclusions and harness limits

The three strongest observations were the Collected jump that appeared inert, the search count over unrelated text, and whether the player's recovery link reached the named destination. The first two are confirmed above; the third passed twice. A folded transcript still produces **Not found** during a direct Find, but showing it now refreshes the count; that intended scope behavior is not listed as a new defect. Imports made while reading another source offered **Show** rather than replacing the source on screen; the new files were present and readable. AI-disabled prequestion waiting and absent native video playback are harness limits, not findings.

[driver.cjs](driver.cjs) connects to the supplied WebKit server, initializes bridge 1762 before `tauri.js`, and owns one context with one page. [actions.log](actions.log) records the work; the `.cjs` snippets run through `runfile` within the driver's scope. File selection uses `__ORE_PICK` with existing intake fixtures; text selection uses a DOM Range and mouseup. Native Finder, selection gestures, OS-wide shortcuts and actual external opening were not verified. One early driver was restarted after a selector timeout; journey 1 resumed from its saved state. Further selector corrections included radio versus button roles, the remembered Collected tab, and Find's name changing with its scope; none are app findings. The PDF was selected again while locating its title; the app reused it and filed it under the current skill. Its filing was then verified explicitly. No source or findings-register edits, commits or pushes were made, and no server, watcher, installed app, real library or other tester's port/folder was changed.
