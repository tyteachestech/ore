# Mac UX sweep — round 18

Tested the supplied Mac release build at `http://localhost:1761/`, bridge `1762`, in connected WebKit at 1280×800 with 2× screenshots; checkout `d64687c7d7aa0521a7debb681a774122725c30ab`. Read the working agreements, daily-session design, findings register, sweep history and rounds 11–17. Rechecked #516 twice, then completed two fresh-page learner journeys: three source kinds each, reading, highlights and notes, one tutor question, a new skill and filing, due reviews, Settings, ⌘K, Finish, leaving and returning. Additional paths included source-author editing, `[[` note links and backlinks, and a skill's first-draft warm-up. **No new confirmed finding, recurrence, crash or observed saved-data loss.** These were compressed task sequences on the assigned seeded library, not two literal hours or empty-library onboarding; fresh pages retained the scratch library's earlier changes. Skipped iPhone, native integration, real AI, pure taste, named exclusions, pending-save Undo, injected failures/delays and detailed repetition of earlier passed edge cases. All tester-authored output is in this folder; library changes used the app.

## Findings

None confirmed. No S1, S2 or S3 finding met the twice-reproduced, ordinary-use threshold.

## Known rows and fix checks

- **F538 / #516 passed 2/2 fresh-page checks.** During Source finished, opened AI → Building Effective Agents → Finish, then typed a recall before the old timer ended. The new recall opened at **213 ms** and **235 ms**. After another 1.4 seconds both the reader and recall remained, including the entered words. [First before](finish-1-open.png), [first after](finish-1-after.png), [second before](finish-2-open.png), [second after](finish-2-after.png). [Measurements](finish-recall-confirmations.json); [actions.log](actions.log) preserves the commands.
- **F537's reader-only case passed 2/2 additional fresh-page checks.** The next reader opened at **225 ms** and **210 ms**, then stayed open beyond the old timer. [Run 1](finish-source-1-after.png), [run 2](finish-source-2-after.png), [measurements](finish-source-confirmations.json), [bounded script](confirm-finish-source.cjs).
- Code agrees with these observations: `apps/desktop/src/Finish.tsx:317–322` schedules the 1,100 ms completion, and `apps/desktop/src/App.tsx:2615–2625` now guards both `setOpenId(null)` and `setFinishing(false)` by the finished source's identity. This tests production navigation state; no AI result or failure/delay hook supplies the outcome.
- No other known fixed row was confirmed to have returned. Named open/excluded rows are not re-reported.

## What passed

- Journey 1 added **Learning by contrasting eighteen A** (Text), **Mixing topics in practice** (RTF/Document), and **How memory works** (PowerPoint/Slides).
- Journey 2 added **Teaching transfer eighteen B** (HTML/Article), **How Plants Make Food** (PDF), and **pandas-notes** (Notebook).
- Both skills appeared immediately; explicit filing showed all three sources under the intended skill without reloading: [journey 2](j2-filed.png), [filing confirmations](links-filing-confirmations.json).
- After Finish, each main reading source appeared in its skill's Done tab and its two unfinished companions remained in To read, **2/2 fresh-page checks per skill**: [first skill](filing-2-a-done.png), [second skill](filing-2-b-done.png).
- The source author saved on clicking away; Escape discarded a subsequent author edit. The saved author remained **Taylor Example** after reopening.
- Both main sources saved highlights and highlight notes; the first became a Key point: [first reading](j1-reading.png), [second highlight](j2-highlight-reopened.png).
- Both source notes, Finish recalls and highlight notes survived **2/2 fresh-page checks each**; the second source retained its later edit: [results](saved-confirmations.json), [first note](saved-2-a-note.png), [second note](saved-2-b-note.png).
- Each Collected row opened its saved highlight note on one click, within the viewport, **2/2 checks each**: [Key point](saved-2-a-highlight.png), [ordinary highlight](saved-2-b-highlight.png).
- A `[[` link inserted from the picker opened the intended source; Back returned to the original note and Linked from opened the note it quoted, **2/2 fresh-page checks**: [Back](links-2-back.png), [backlink](links-2-backlink.png), [script](confirm-links-filing.cjs).
- Both tutor questions displayed the unavailable-answer explanation and **Try again**, with an editable composer: [first](j1-tutor.png), [second](j2-tutor.png).
- Four due ratings saved, three Fact and one Explain, totaling **83,381 ms** in the real review log; the pre-existing seed rating is excluded: [library evidence](library-evidence.json).
- Unavailable Explain grading retained the written answer, explained the problem and allowed manual key-point marking followed by Good: [answer and marks](j2-explain.png).
- Both review sessions could end with exercises remaining and return through Done: [first ending](j1-review-end.png), [second ending](j2-review-end.png).
- Settings opened with ⌘, and closed with Escape in both journeys: [first](j1-settings.png), [second](j2-settings.png).
- ⌘K opened ordinary sources and started New skill throughout both journeys.
- Both Finish flows saved recall and completed despite unavailable AI feedback: [first reopen](j1-reopened.png), [second reopen](j2-reopened.png).
- The new skill's Start → Warm up from memory → Save as first draft wrote the recall into its note; that note and its goal survived **2/2 fresh-page checks**: [first draft](skill-first-draft.png), [reopened](skill-2-reopened.png), [results](skill-confirmations.json).

## Hesitations and the three follow-ups

1. **Where did the third source go?** An import from the skill page inherited that skill; a later import while reading a source had no skill selected. The Add box exposes its current skill choice. Explicit filing worked, then both skills' To read/Done lists passed twice from fresh pages. `apps/desktop/src/Add.tsx:83–84,110–111` documents and implements the open-skill default. No silent filing loss was confirmed.
2. **Did Finish keep all the writing?** Both notes, recalls and highlight notes passed twice from fresh pages. An ordinary highlight initially sits under the folded Highlights section in Collected; opening that section exposed it. This repeats an already-described discovery hesitation, not a new defect.
3. **Will a note link take me back to my writing?** Link → Back and Linked from both passed twice from fresh pages. The behavior matches D39's stored-ID links and quoted backlinks.

The skill goal action is now **Dig**, not the older **Try it** name mentioned in D102; D325 explicitly changed it. A selector based on the old name was corrected as an automation assumption, not reported as a missing control. Prequestion waiting in this AI-disabled harness was not reported as an infinite wait: `Reader.tsx:1183–1204` has a bounded polling fallback, and the bridge intentionally suppresses enrichment.

## Limits and cleanup

File imports used local paths in Add; native Finder dialogs were not tested. Highlights used real mouse drags between measured text coordinates. Notes used the editor's input handling. Note-append shortcuts did not place the caret where the automation initially assumed, and one ⌘A selected a note block rather than the entire note: the resulting repeated text and adjacent link/recall text are tester edits, not claimed data corruption. Assertions checked the words actually entered and retained. Selector corrections and a terminal input-length correction are retained in [actions.log](actions.log), not findings. One attempted Finish recheck used an ambiguous source-title selector; another encountered the remembered Done tab. Neither is counted among the successful timing checks.

Review time comes from each exercise's `shownAt` until its rating, capped at three minutes (`apps/desktop/src/Review.tsx:187,430,661,753`); no clock manipulation was used. The very fast second Fact rating verifies saving and advancing, not the quality of a human recall attempt. No actual AI answer, native playback, OS-wide shortcut, or external-app opening was verified.

[driver.cjs](driver.cjs) connected to the supplied WebKit server and used one context with one page at a time. Fresh-page helpers closed the old page before opening the next. No server, watcher, extra browser, real library, installed app, other tester's port or folder was touched. No repository source or findings-register edits, commits or pushes were made. The pre-existing untracked `docs/reviews/2026-11-23-codex-ux-sweep-18/` folder was left untouched.

Final verification found **zero page errors and zero pending bridge calls**, with one owned page ([final state](final-state.json), [errors](errors.json)). The driver then printed **CONTEXT CLOSED** and **CLOSED** and exited successfully, confirming its page/context and browser connection were closed. All report artifact links were checked and exist.
