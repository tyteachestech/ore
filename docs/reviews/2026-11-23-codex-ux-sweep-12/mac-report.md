# Mac UX sweep — round 12

Tested the supplied release build at `http://localhost:1761/`, bridge `1762`, in connected WebKit at 1280×800 with 2× screenshots; checkout `1726dc8fc6264b8e62c045922063ef6ab285f579`. Read the working agreements, daily-session design, findings register and sweep history, including round 11 and the earlier broad pass. Rechecked #510, then completed two everyday journeys starting from fresh pages on the assigned seeded library: three source kinds per journey, reading, highlights and notes, a tutor question, a new skill and filing, existing due reviews, Settings, ⌘K, leaving and reopening, and Finish with saved recall. The first journey read an RTF document; the second read a notebook and practised with a CSV table. Fresh pages reused the scratch library; this was not an empty-library onboarding test or a literal hour of timed study. **One S2 finding: F531 remains partly unfixed. No additional new finding, S1, crash or observed data loss.** Skipped iPhone, native integration, real AI, real video playback, visual taste, the named exclusions, pending-save Undo and detailed repeats of earlier edge-case sweeps. No failures or delays were injected. Tester-written files are confined to `codex-out/mac/`; scratch-library writes went through the app.

## Findings

### MAC-1 — A transcript search result still opens below its matching passage

**S2 · Mac · F531 incomplete fix · 2/2 dedicated fresh-page confirmations**, plus the initial observation and a third instrumented confirmation without the preceding Collected check.

1. Open a fresh Mac app page. If needed, add `https://academy.claude.com/courses/ai-fluency-framework-foundations` and let its lessons import.
2. Use ⌘K to open **Introduction to AI Fluency**.
3. Click **Transcript** to fold it away, then scroll to **Reflection / What’s next** near the lesson’s end.
4. Go Home with ⌘0.
5. Open ⌘K, search **Cork University**, and click the **Introduction to AI Fluency** result quoting “I'm a professor at the Cork University Business School.”
6. Observe the initial landing. Then press Enter in Find.

**Expected:** Opening the search result unfolds the transcript and immediately shows the quoted passage.

**Actual:** The transcript unfolds and Find reports **1/1**, but the learner still sees Reflection / What’s next. In both dedicated runs the reader’s scrollTop was **2226**, the transcript began at **y = −1557.34**, and the highlighted search match was at **y = −1485.38**. The result is found but wholly outside the window. **Enter now recovers:** it moves scrollTop to **448** and the match to **y = 292.63**, in view. This is narrower than round 11’s failure: #510 fixed stepping to the match through nested scrollers, but the initial search-result landing still requires an extra, undisclosed action.

**Evidence:** [Run 1 initial landing](confirm-1-search-landing.png), [run 1 after Enter](confirm-1-search-enter.png), [run 2 initial landing](confirm-2-search-landing.png), [run 2 after Enter](confirm-2-search-enter.png). [Exact measurements](transcript-confirmations.json), [bounded reproduction script](confirm-transcript.cjs). A separate [90-frame trace](search-timeline.json), made by [this script](search-timeline.cjs), records the visible match at **y = 740.63 / scrollTop 0** in frame 7, then **y = −1485.38 / scrollTop 2226** in frame 8; it stays there. This confirms that a later scroll displaces the initial landing, rather than the search failing to find the words.

**Suspected code:** `apps/desktop/src/Reader.tsx:1264–1278` opens the folded transcript and sets the Find query together. `apps/desktop/src/Find.tsx:187–206` reveals the initial match only when the query or target passage changes; `Find.tsx:208–223` recounts after hidden/content changes without revealing again. The reader’s resize observer at `Reader.tsx:1366–1386` restores its captured reading position as the document changes height (`back()` at line **1375**, implemented by `apps/desktop/src/reading.ts:149–151`). That restoration is the likely source of the later displacement; the callback stack was not instrumented, so this is a suspected interaction, not a debugger-proven attribution. The Collected path at `Reader.tsx:1881–1894` now waits two animation frames before jumping; the search path has no equivalent settling step. `Find.tsx:139–148` now traverses all scrolling ancestors, which is consistent with Enter’s successful recovery.

**Not the mock:** The course and transcript are imported through the real CLI into the assigned library. Search returns the real saved text, its count and highlight are correct, and pressing Enter shows it. The failing operation is production fold/scroll/navigation code. No AI reply, native-player action, failure or delay hook participates.

## Known rows seen again / fix checks

- **F531:** Still incomplete, documented as MAC-1. Initial search landing fails; Enter’s recovery is fixed.
- **F530:** Passed **2/2 fresh-page confirmations**, plus the first quick check. From the folded transcript and the lesson’s end, one Collected click opens **I'm Joe Feller.** and its saved note in view. Both confirmations put the popup at **x 280.5, y 399.36, width 360, height 88**. [Run 1 before](confirm-1-collected-before.png), [after one click](confirm-1-collected-after.png), [run 2 before](confirm-2-collected-before.png), [after one click](confirm-2-collected-after.png).
- No other known row was confirmed to have returned.

## What passed

- Journey 1 added **Weekly practice twelve A** as text, **Mixing topics in practice** from RTF, and **Spanish vocabulary** from XLSX; all three appeared under **Mixed practice twelve** without a reload ([skill page](j1-skill.png)).
- Journey 2 added **pandas-notes** from IPYNB, **verbs** from CSV, and **Office Learning** from Word; all three appeared under **Data workshop twelve** ([skill page](j2-skill.png)).
- File sources showed meaningful kinds: Document, Spreadsheet and Notebook; RTF author/date and spreadsheet author appeared.
- The RTF source retained its Key point, highlight note, source note and Finish recall in the saved library ([evidence](library-evidence.json)).
- The notebook retained its highlight note, source note, subsequent note edit and Finish recall after reopening twice ([repeat measurements](saved-work-confirmations.json), [note](saved-2-notebook-note.png), [highlight](saved-2-notebook-highlight.png)).
- The RTF’s source note and appended recall also reopened intact twice ([second reopen](saved-2-rtf-note.png)).
- The notebook’s **Output** control revealed its saved output on one click in both repeat checks ([second check](saved-2-notebook-output.png)).
- The CSV table’s **Cover this column**, individual **Covered. Show it**, and **Show this column** worked ([table practice](j2-table-practice.png)).
- Each tutor question ended with a visible error, **Try again**, and a usable composer when the supplied harness returned no AI answer ([journey 1](j1-tutor.png), [journey 2](j2-tutor.png)).
- Four existing due exercises were rated across the journeys: three Fact and one Explain; the saved review log contains all four, totaling **50,654 ms** ([library evidence](library-evidence.json)).
- The Explain review offered manual key-point marking and rating when AI grading was unavailable; both points were marked and Good saved.
- Leaving review returned through its end screen and Done to Home in both journeys; the second session left a New exercise available rather than requiring the backlog to empty ([first ending](j1-review-end.png), [second ending](j2-review-end.png)).
- Settings opened with ⌘, and closed with Escape in both journeys; Reading/Review and General sections were inspected ([journey 1](j1-settings.png), [journey 2](j2-settings.png)).
- ⌘K opened ordinary sources and New skill; sidebar navigation showed the new skills and filed lists immediately.
- Both Finish flows saved recall and marked the source Done despite unavailable AI feedback ([first finish](j1-finished.png), [second finish](j2-finished.png)).
- The completed driver recorded no page errors and had zero pending bridge calls before closing ([errors](errors.json)).

## Hesitations and limits

The three strongest follow-ups were the initial transcript-search landing, the collected highlight’s first-click placement, and finding saved work again after Finish. Each received two fresh-page checks: only the search landing failed. The note check needed the **Source note** tab because **Collected** was selected; both notes and recall were present, so this is not reported as missing data. Notebook output being folded initially also prompted a check; its named control exposed it correctly twice. File imports made while another source was open offered **Show** and kept the current reading view; the added sources were present in the lists. The notebook initially inherited the previous skill context and then accepted the second skill; both saved assignments are shown in the evidence.

AI-disabled prequestion waiting and absent native video playback are harness limits, not findings. The Academy import displayed **Reading the course…** while it ran and produced its 14 lessons. The normal journeys used local intake fixtures for the other file kinds. Text selection used a DOM Range plus mouseup; file selection used the supplied `__ORE_PICK` hook. Native Finder, OS-wide shortcuts, actual video playback and the quality of AI-generated exercises were not tested. Review minutes were read from real saved ratings; no clock manipulation was used.

[driver.cjs](driver.cjs) connects to the supplied WebKit server with bridge initialization before `tauri.js`; it uses one page per journey and closes that page before opening the next. [actions.log](actions.log) and the `.cjs` snippets preserve the actions. Initial driver input handling needed a restart, and a few selector/animation-timing corrections were required; the first journey resumed from its saved state. Those automation errors are not app findings. The final context and page were closed. No source edits, findings-register edits, commits, pushes, server starts/stops, installed-app changes or real-library access were performed.
