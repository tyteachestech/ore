# Mac UX sweep — round 17

Tested the supplied release build at `http://localhost:1761/`, bridge `1762`, in connected WebKit at 1280×800 with 2× screenshots; checkout `54df4929452972f87ba7d9750e6f972dd0fc0c54`. Read the working agreements, daily-session design, findings register and previous sweep coverage. Rechecked #515 twice, tested related delayed actions, and completed two fresh-page learner journeys: three source kinds each, reading, highlighting and notes, a tutor question, a new skill and filing, due review, Settings, ⌘K, Finish, leaving and returning. These were compressed task sequences on the assigned seeded library, not two literal hours or empty-library onboarding; fresh pages retained earlier library changes. **One S2 finding: the previous Finish timer can cancel the next source's Finish.** No observed saved-data loss or crash. Skipped iPhone, native OS integration, real AI quality, pure visual taste, the named exclusions, pending-save Undo, injected delays/failures and detailed repetition of earlier passed edge paths. Tester-written files are confined to this folder; library changes used the app. The cleanup limitation below left an initial idle context connected in addition to the main test context.

## Findings

### MAC-1 — Finishing one source cancels Finish on the next source

**S2 · Mac · same delayed-action class as F537; the original source-closing reproduction is fixed.**

1. From a fresh page, add a short text source through ⌘N. The reproduction uses `# Paced finish seventeen 1` followed by a short paragraph.
2. Click **Finish**, enter a recall, and press **⌘Enter**. On **Done with this source?**, click **Done**.
3. During **Source finished**, click **AI** in the sidebar, then **Building Effective Agents** in its source list, then **Finish** on that source. Do this at a brisk pace, within the closing message's roughly one second.
4. Observe the new source's recall form, then wait another second.

**Expected:** Once Finish has opened on the new source, it stays open until the learner submits or leaves it. The previous source's completion can update its status and show its toast without changing the current Finish.

**Actual:** The new recall form opens, then disappears by itself. **Building Effective Agents** remains open as a reader, with its **Finish** button back. The learner must click Finish again. The old source's completion toast appears at the same time.

**Reproduction:** **2/2 fresh-page paced confirmations**, plus **2/2 earlier faster confirmations**. The paced runs paused 250 ms before clicking AI, another 250 ms before opening the source, and 100 ms before clicking Finish. Its recall form was visible at **773 ms** and **753 ms** after the previous closing message appeared, then absent after the old timer completed. The earlier pair opened the next recall at 505 ms and 503 ms. No time manipulation, injected delay, failure or AI response was used. This is a short timing window; it requires moving on promptly. No typed-answer loss is claimed: these confirmations checked the form's unexpected dismissal.

**Screenshots:** [Paced run 1: next recall open](finish-paced-1-opened.png), [then cancelled](finish-paced-1-after.png); [paced run 2: open](finish-paced-2-opened.png), [then cancelled](finish-paced-2-after.png). Earlier pair: [run 1 open](finish-next-1-opened.png), [after](finish-next-1-after.png), [run 2 open](finish-next-2-opened.png), [after](finish-next-2-after.png).

**Reproduction and measurements:** [Paced script](finish-paced.cjs), [paced results](finish-paced-results.json), [earlier script](finish-next-recall.cjs), [earlier results](finish-next-results.json). These snippets run inside [driver.cjs](driver.cjs), through `await eval(fs.readFileSync(out + '/finish-paced.cjs', 'utf8'))`.

**Code:** `apps/desktop/src/Finish.tsx:317–322` waits 1,100 ms, then invokes its captured completion callback. `apps/desktop/src/App.tsx:2619` now checks the source ID before closing the reader, fixing F537's original case. But **`App.tsx:2620` still calls `setFinishing(false)` unconditionally**. The new source receives that same shared Finish state (`App.tsx:2569–2570`), so the old callback closes its newly opened recall form. The code and observed timing agree; this is production navigation state, not a mock command changing the screen. AI enrichment starts separately at `Finish.tsx:314–316` and is not what schedules this dismissal.

## Known rows and fix checks

- **F537 / #515 original reproduction passed 2/2:** a different source opened during Source finished remains open after the timer. [First opening](finish-1-opened.png), [first after the timer](finish-1-stayed.png), [second opening](finish-2-opened.png), [second after](finish-2-stayed.png). The second source opened at 494 ms in the recorded second run ([results](finish-check.json)).
- Clicking the old Finish toast's **Undo** while reading the different source also left that source open ([screenshot](finish-2-undo-elsewhere.png)). This was one additional toast check, not an injected pending-save Undo test.
- MAC-1 is the remaining shared-state variant of that delayed callback. The original source-closing bug did not recur.
- No other known fixed row was confirmed to have returned. Named open/excluded rows are not re-reported.

## What passed

- Journey 1 added **Practical learning seventeen A** (Text), **Teaching with contrasts seventeen** (HTML/Article), and **A Small Book of Remembering** (EPUB/Book).
- Journey 2 added **Comparing examples seventeen B** (Text), **How Plants Make Food** (PDF), and **Spanish vocabulary** (XLSX/Spreadsheet).
- Each new skill appeared immediately; all three sources appeared under it without a reload: [Practical learning seventeen](j1-filed.png), [Example design seventeen](j2-filed.png).
- Both main reading sources saved highlights and highlight notes; the first highlight became a Key point: [journey 1](j1-reading.png), [journey 2](j2-reading.png).
- Both source notes and Finish recalls survived **2/2 fresh-page confirmations each**; the second note retained its later edit too: [measurements](saved-confirmations.json), [first note](saved-2-a-note.png), [second note](saved-2-b-note.png).
- Both saved highlights opened from Collected in one click with their notes visible, **2/2 fresh-page confirmations each**: [Key point](saved-2-a-highlight.png), [ordinary highlight](saved-2-b-highlight.png). Each note field was within the window at x 321.5, y 290.55, width 306, height 30.
- Both tutor questions showed an unavailable-answer explanation and **Try again**, leaving an editable composer: [first](j1-tutor.png), [second](j2-tutor.png).
- Four due ratings saved, three Fact and one Explain, totaling **64,214 ms** in the real review log; the earlier same-day seed rating is excluded ([library evidence](library-evidence.json)). Review measures elapsed time per exercise from `shownAt` (`Review.tsx:187,430,661`); no clock manipulation was used.
- The unavailable Explain grade preserved the written answer and allowed manual key-point marking and a Good rating ([screenshot](j2-explain.png)).
- Both reviews could end with exercises still available and return through Done; the second ending was left promptly, and its later animation did not replace the subsequently opened source: [first ending](j1-review-end-settled.png), [second ending](j2-review-end.png), [second source afterward](j2-after-review.png).
- Settings opened and closed with Escape in both journeys; Reading, Review and General sections were inspected: [first](j1-settings.png), [second](j2-settings.png).
- ⌘K found and opened sources and started New skill; sidebar navigation and return retained saved work.
- Both normal Finish flows completed with their recall text retained despite unavailable AI feedback: [first reopen](j1-reopened.png), [second reopen](j2-reopened.png).
- Adding files while already reading kept the reader open and offered **Show** for the added source.
- Two further file imports, followed immediately by Escape and navigation to another source, left that chosen source open and showed the completed import's Show/Undo toast: [DOCX](import-1-stayed.png), [RTF](import-2-stayed.png), [results](import-navigation.json). These checks used natural completion speed; they did not measure whether the import response preceded or followed the final navigation click.
- The main driver ended with zero page errors and zero pending bridge calls ([final state](final-state.json), [errors](page-errors.json)); its context then closed and the process exited successfully with `CLOSED`.

## Hesitations, follow-ups and limits

The three strongest follow-ups were the new recall form disappearing, where an import goes while another source is open, and whether notes/highlights remain accessible after Finish and a fresh page. Each received two confirmation runs. Only the recall dismissal failed. **Show** explains where the background import went, and the saved-work checks recovered both sources' notes, recalls and highlight notes. The ordinary highlight is under a folded **Highlights** section in Collected; expanding it exposed the saved passage. This was a discoverability hesitation, not a new confirmed defect; previous rounds documented that behavior too.

The prequestion line showed **Writing prequestions…** under this AI-disabled setup. Code inspection found a bounded polling fallback (`Reader.tsx:1183–1205`), and the bridge intentionally suppresses background enrichment. No infinite-wait finding is claimed. Real AI output, native Finder, OS-wide shortcuts and external-app opening were not tested. File imports used paths through the Add UI. Highlights used mouse drags; note text used the editor's actual input handling. No slow/fail/reply hooks were used.

Automation corrections were not app findings: Add's accessible button name includes its Return symbol; the review key-point marks are buttons rather than checkboxes; a long terminal input exceeded the terminal's line limit and was replaced by a saved snippet. The action log retains these attempts.

**Cleanup limitation:** The first `node codex-out/mac/driver.cjs` invocation used a non-interactive terminal. Its input pipe closed after opening an idle Home page, leaving the connection alive and inaccessible to subsequent input. A replacement interactive driver performed the tests with one context and one page at a time, then closed cleanly. This unintentionally exceeded the one-context limit: the initial idle context remained alongside it. The sandbox denied terminating that initial helper; the final socket check still showed client PID **53825** connected to the supplied WebKit server. No server or other tester's process was stopped. The helper has no test loop running, but its idle page/connection still needs cleanup by the sweep owner. The driver file now also closes its context on input EOF to prevent this setup mistake on a later invocation.

No repository source or findings-register edits, commits or pushes were made. The pre-existing untracked `docs/reviews/2026-11-23-codex-ux-sweep-17/` folder was left untouched. All authored scripts, screenshots, evidence and this report are under `codex-out/mac/`; no installed app or real library was touched.
