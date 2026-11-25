# Commuter: five days on the phone

I used one connected WebKit context and one page for the complete five-day journey: 30 saved ratings, a repeated miss, three Day 2 interruptions, two touch highlights (one Key point), a saved note, finishing and quizzing on *Attention Is All You Need*, search, one queued article link, one successfully imported pasted source, large-text review at 375×667, and a return after a missed day. The seed contains 67 sources (44 archived), 38 exercise files, and a 10-minute goal. I found one reproducible timing defect and one phone capability gap that interrupted learning. No S1 issue or confirmed data loss. I skipped pure visual taste, known open rows that were not worse, native keyboard/selection handles, real iCloud sync, and relaunch. **The article could not be fetched in this browser and remains queued for the Mac; it was not successfully imported.**

## Findings

### 1. Time in the background fills the review goal — S2, iPhone

The most consequential issue across these bursts: the ring credits time when the learner is away. Day 2's two hour-long absences turned about **3 minutes 30 seconds** of foreground exercise time into **9 minutes 3 seconds** credited to the goal.

1. Open a fresh phone page with the supplied library and start review through Today → Start review → Start review.
2. Leave an exercise open. Optionally type an answer.
3. Send a hidden visibilitychange, advance the page clock by one hour, then send a visible visibilitychange. For a browser reproduction, override document.hidden / visibilityState during the hidden interval and dispatch the event with bubbles:true.
4. Reveal/check and rate immediately. Leave review and inspect its minute ring and the saved review line.
5. Repeat on another exercise.

**Expected:** keep the exercise and draft, and count only foreground review time toward the daily goal. **Actual:** the place and draft stay, but elapsed_ms includes the hour and the goal credits its three-minute per-exercise cap.

**Reproduction:** 2/2 Day 2 absences, plus 2/2 post-journey confirmations with the event explicitly bubbling to the window listeners. The two confirmation ratings were undone through the app. Day 2 logged **3,616,355 ms** for exercise `01M78B5FPC50C89GP1EGNQ1JE2` and **3,610,482 ms** for `01M78B5FPC50C89GP1EGNQ1JE3`; each contributes 180,000 ms. The correctly bubbling confirmations logged 3,600,653 and 3,638,654 ms. This is a simulated background test, not a claim about native OS suspension.

**Evidence:** [Day 2 ring](day2-end-settled.png), [before absence](day2-before-background-db.json), [after first absence](day2-after-background-db.json), [day-end data](day2-end-db.json), [confirmation 1](verify-background-bubbling-1-db.json), [confirmation 2](verify-background-bubbling-2-db.json).

**Suspected code:** `apps/desktop/src/review-session.ts:347` starts a Date.now clock and line 351 subtracts it without pausing for hidden time; line 514 caps the result. `packages/core/src/study.ts:136` uses that same capped elapsed value for daily active time. D60 defines the three-minute cap; this finding questions treating known hidden time as active, rather than the cap itself.

### 2. The phone's finish quiz cannot help resolve a wrong answer — S2, iPhone capability gap

On this real source, the phone asked four questions without a usable feedback path. Review at least reveals an answer and lets me mark key points; the finish quiz showed only my answer, “Not checked here,” and Next question. After “No idea,” I still had no answer to learn from. This is an observed Mac/phone parity gap under the requested no-AI condition, **not a claim that the promised Mac-only AI service malfunctioned**.

1. From a fresh seeded page, open *Attention Is All You Need* from Today.
2. Read/scroll to Finish, enter a recall, and Continue to the questions.
3. Answer question 1, choose confidence, and tap Check.
4. Tap Next question, then No idea on question 2.

**Expected:** an actionable way to compare the attempt with the relevant source material after answering, even when AI checking is unavailable—for example already-kept key points or access to the relevant passage. **Actual:** no answer, key points, or passage is available in the quiz on this seed. It says to compare with the source “when you’re back in it.” I had to finish or leave the quiz and find the explanation again. The Mac finish flow can supply checking and relevant passages; the phone's daily reading loop loses that step.

**Reproduction:** 4/4 questions, including the typed first answer and the explicit No idea on the second. The seed's prequestions contain questions but no precomputed points. Saved answers and the recall were retained; nothing was falsely marked correct.

**Evidence:** [typed answer](day3-quiz-check.png), [No idea](day3-quiz-noidea.png), [completion choices](day3-finish-summary.png), [saved source and note](day3-added-db.json).

**Suspected code:** `apps/desktop/src/Finish.tsx:121` requests key points on opening; lines 549–559 handle the unavailable phone check. The key-point/passage UI begins only when q.points exists (line 579). Mac-only AI is D78.3; an offline comparison path would require revisiting how that accepted limitation is presented, not pretending AI ran locally.

## Known rows and limits

- **No previously fixed row was confirmed to have returned.**
- F14 remains visible: long Explain answers put ratings below the viewport. All five Day 4 Explain answers required scrolling at 375×667 with large text. The same content remains reachable, so I did not file this again as new or worse. Every exercised id and captured viewport condition is in [exercise-audit.md](exercise-audit.md).
- F293 covers slow phone review startup at scale. Actual touchstart-to-question checks here were **224 ms and 181 ms**. This is below the existing ~330 ms report and is not a new finding.
- The two API exercises `01M64QC51YWQGPMVHP92ZNG6Q6` and `01M64QC521VBJKTT5BVY7WSAJJ` show no supporting passage. Their saved files say `from: notes` and hold no evidence anchors; this is recorded in the exercise audit, not asserted as a lost-source regression. The second was encountered again on Day 5.
- *Attention Is All You Need* visibly warns that its formulas/tables need the Mac. The saved source already contains flattened math and tables; [formula screenshot](day3-formula.png). I did not claim the phone corrupted it or rerun an import.
- A failed article fetch was kept with a useful error and “Your Mac will try it.” Browser cross-origin/native-fetch limitations prevent attributing that failure to the native phone app. [Link status](day3-link-status.png).

## What passed

- Ratings saved immediately; all 30 main-journey ratings have card ids, timestamps, and next-due states.
- The first missed exercise returned after three intervening exercises; the second attempt was recorded separately.
- Leaving after three exercises, visiting a source, and restarting resumed the same next exercise.
- Both hour-long interruptions kept the exercise and the typed draft.
- Both touch highlights survived; the abstract has Key point intent and the second highlight retains its exact note text.
- Reading reopened at the saved area after its initial restoration; transient opening frames were not reported as position loss.
- The finish recall is in notes.md; all four quiz answers are in doc.md, and the source became Done.
- Search for “parallelization” found both source text and the newly saved highlight; opening a result opened Find with the word.
- Pasted Markdown became *Attention on the commute*, with both paragraphs and the original source.md retained.
- At 375×667 the settled review width stayed 375 px with no horizontal overflow; confidence labels stayed within their buttons and ratings remained usable by scrolling.
- The missed day produced no guilt copy, overdue backlog count, or broken streak. The new day's review started from zero.
- The goal did not force the session closed; Leave review showed the end screen and Done returned to Today.
- No raw Markdown was observed in the exercise questions or answers inspected.

## Saved data and end-screen checks

The main journey's final snapshot is [final-db.json](final-db.json). This is the phone's IndexedDB file overlay; the original scratch-library files were read only. The actual library on this page is the seed plus that overlay. Calendar dates below are simulated page dates. Unlike the Mac bridge setup, phone writes use the page clock, so these are not real-time bridge date discrepancies.

| Day | Page date | Saved ratings | Goal time from review log | End ring | Session results matched to saved summary |
|---|---|---:|---|---:|---|
| 1 | Nov 25 | 10 | 11m 08.313s | 11 min | 8 memories kept, +46 days; one skill cut |
| 2 | Nov 26 | 3 + 5 | 9m 03.109s, including hidden time | 9 min | Second burst: 5 kept, +11 days; first burst separately saved 3 kept, +6 days |
| 3 | Nov 27 | 0 | 0 | No review ending | Reading/finish quiz does not fill the review goal |
| 4 | Nov 28 | 5 | 5m 24.391s | Above captured viewport; 5 expected from log | 5 kept, +23 days |
| 5 | Nov 30 | 7 | 10m 51.421s | 11 min | 7 kept, +59 days |

The Day 4 end screen was scrolled to its results/buttons, so its ring number was not visually verified. The ring rounds minutes; Day 5's accessible label was “11 of 10 minutes today.” Memory-result checks compare the visible values with the persisted session summary, not an independent validation of FSRS's scientific model. Next due for each rated exercise is listed in [exercise-audit.md](exercise-audit.md); this verifies the exercises encountered, not a complete independent reconstruction of the whole priority queue. The unreviewed miss-day backlog remains available.

[Day 1 ending](day1-end-settled.png) · [Day 2 ending](day2-end-settled.png) · [Day 4 ending](day4-end-settled.png) · [Day 5 ending](day5-end-settled.png)

## Where the minutes went

These are test-clock spans, not measurements of a human's reading speed. Exercise time includes injected 30–90 second thinking intervals and the real time spent inspecting the app. Reading used programmatic scrolling to visit sections and eight injected minutes on Day 3. “Waiting” totals measured tap/navigation calls; overlapping rating-to-next timings are excluded. It includes Playwright's actionability checks, so it must not be read as pure app latency.

| Day | Review | Reading / finish | Adding | Measured interaction waiting | Lost / misleading time |
|---|---|---|---|---|---|
| 1 | 11m 08s credited | 1m 07s reader-open to Back, two highlights and a note | — | 4.18s | Manual marking required on Explain answers; correction/scroll cost not independently timed |
| 2 | 3m 30s excluding two simulated hours; 9m 03s credited | Brief source detour; no substantive reading | — | 5.35s | **5m 33s extra goal credit**; four taps to leave/restart review, excluding the source visit |
| 3 | — | About 10m 02s from reader-open through Finish Done, including 8 simulated minutes | 24s from opening Add through returning from pasted text; one queued link, one saved text | 1.88s | Four unchecked quiz questions; source-comparison cost not timed. Fetch completion delay only bounded by snapshots, not precisely measured |
| 4 | 5m 24s | Aa/settings setup; no substantive reading | — | 4.56s | Scrolling long answers; no text size in phone Settings. Native text setting unavailable in browser |
| 5 | 10m 51s | — | — | 2.94s | No additional blocked task observed |

## Felt slow

Initial opening took **1,371 ms** to Start review. Subsequent review-start tap calls ranged up to **598 ms** during the main journey; pasted text took **483 ms** for the Add tap and **551 ms** through its result screenshot. These measurements include browser automation's settling checks. Two explicit touchstart measurements, taken after the journey, narrowed review start to **224 ms and 181 ms** to a present question plus two animation frames. The initial loading screen says “Opening your library”; I did not establish a repeated blank wait over one second. The first two raw event entries labelled initial usable were premature harness reads and are excluded, along with their self-induced IndexedDB errors.

All successful measured waits are below, slowest first. UTC wall timestamps identify the real run; Day is the simulated day. Nested measurements are deliberately retained here but are not summed twice in the budget. Post-journey startup/background verification entries are included after the main journey ended at 14:36:41 UTC.

| Day | UTC time | Action | ms | Measurement |
|---|---|---|---:|---|
| 1 | 14:25:41.800 | initial usable | 1371 | navigation to Start review |
| 5 | 14:39:18.256 | [role="dialog"] button:has-text("Start review") | 601 | Playwright tap call, includes actionability |
| 4 | 14:35:13.253 | [role="dialog"] button:has-text("Start review") | 598 | Playwright tap call, includes actionability |
| 2 | 14:30:45.718 | [role="dialog"] button:has-text("Start review") | 552 | Playwright tap call, includes actionability |
| 3 | 14:34:32.050 | pasted text result | 551 | Add call through result screenshot |
| 5 | 14:37:52.794 | [role="dialog"] button:has-text("Start review") | 541 | Playwright tap call, includes actionability |
| 5 | 14:38:00.410 | [role="dialog"] button:has-text("Start review") | 535 | Playwright tap call, includes actionability |
| 2 | 14:31:05.857 | [role="dialog"] button:has-text("Start review") | 531 | Playwright tap call, includes actionability |
| 5 | 14:35:46.964 | [role="dialog"] button:has-text("Start review") | 524 | Playwright tap call, includes actionability |
| 3 | 14:34:31.982 | Add | 483 | Playwright tap call, includes actionability |
| 4 | 14:34:57.318 | Attention on the commute | 428 | Playwright tap call, includes actionability |
| 2 | 14:31:04.455 | Done | 404 | Playwright tap call, includes actionability |
| 5 | 14:38:00.819 | Leave review | 391 | Playwright tap call, includes actionability |
| 2 | 14:30:45.166 | Start review | 386 | Playwright tap call, includes actionability |
| 4 | 14:34:42.502 | Open menu | 384 | Playwright tap call, includes actionability |
| 4 | 14:35:12.654 | Start review | 380 | Playwright tap call, includes actionability |
| 5 | 14:35:47.371 | .review :text-is("Sure") | 379 | Playwright tap call, includes actionability |
| 2 | 14:31:05.325 | Start review | 374 | Playwright tap call, includes actionability |
| 3 | 14:34:17.794 | Add a source | 374 | Playwright tap call, includes actionability |
| 4 | 14:34:42.875 | Settings | 373 | Playwright tap call, includes actionability |
| 4 | 14:34:57.692 | Text and page | 373 | Playwright tap call, includes actionability |
| 2 | 14:30:46.138 | .review :text-is("Sure") | 372 | Playwright tap call, includes actionability |
| 2 | 14:31:06.244 | .review :text-is("Sure") | 368 | Playwright tap call, includes actionability |
| 2 | 14:31:04.950 | Back | 365 | Playwright tap call, includes actionability |
| 5 | 14:39:18.650 | .review :text-is("Sure") | 363 | Playwright tap call, includes actionability |
| 3 | 14:34:17.283 | search hit open | 299 | Playwright tap call, includes actionability |
| 5 | 14:37:53.194 | Leave review | 278 | Playwright tap call, includes actionability |
| 1 | 14:29:27.370 | .review :text-is("Sure") | 259 | Playwright tap call, includes actionability |
| 4 | 14:35:37.467 | .review :text-is("Sure") | 257 | Playwright tap call, includes actionability |
| 5 | 14:36:08.379 | .review :text-is("Sure") | 255 | Playwright tap call, includes actionability |
| 4 | 14:35:13.575 | .review :text-is("Sure") | 251 | Playwright tap call, includes actionability |
| 4 | 14:35:14.642 | .review :text-is("Sure") | 250 | Playwright tap call, includes actionability |
| 4 | 14:35:14.094 | .review :text-is("Sure") | 248 | Playwright tap call, includes actionability |
| 1 | 14:26:19.176 | [role="dialog"] button:has-text("Start review") | 244 | Playwright tap call, includes actionability |
| 2 | 14:30:46.653 | .review :text-is("Sure") | 241 | Playwright tap call, includes actionability |
| 2 | 14:31:07.086 | .review :text-is("Sure") | 237 | Playwright tap call, includes actionability |
| 2 | 14:31:06.586 | .review :text-is("Sure") | 234 | Playwright tap call, includes actionability |
| 5 | 14:36:07.852 | .review :text-is("Sure") | 233 | Playwright tap call, includes actionability |
| 1 | 14:27:51.348 | No idea | 232 | Playwright tap call, includes actionability |
| 1 | 14:28:15.994 | .review :text-is("Sure") | 232 | Playwright tap call, includes actionability |
| 5 | 14:35:47.883 | .review :text-is("Sure") | 230 | Playwright tap call, includes actionability |
| 3 | 14:33:28.935 | Next question | 229 | Playwright tap call, includes actionability |
| 2 | 14:30:47.169 | .review :text-is("Sure") | 229 | Playwright tap call, includes actionability |
| 5 | 14:35:48.399 | .review :text-is("Sure") | 228 | Playwright tap call, includes actionability |
| 5 | 14:36:07.349 | .review :text-is("Sure") | 227 | Playwright tap call, includes actionability |
| 1 | 14:29:22.219 | .review :text-is("Sure") | 226 | Playwright tap call, includes actionability |
| 5 | 14:37:52.836 | actual touchstart to question ready | 224 | touchstart to question + two frames |
| 4 | 14:35:12.274 | Back | 218 | Playwright tap call, includes actionability |
| 3 | 14:34:10.376 | search usable | 192 | Playwright tap call, includes actionability |
| 5 | 14:38:00.429 | actual touchstart to question ready repeat | 181 | touchstart to question + two frames |
| 1 | 14:29:37.728 | Attention Is All You Need | 142 | Playwright tap call, includes actionability |
| 2 | 14:31:04.576 | Attention Is All You Need | 121 | Playwright tap call, includes actionability |
| 3 | 14:31:46.502 | Attention Is All You Need | 113 | Playwright tap call, includes actionability |
| 1 | 14:29:27.472 | Check | 101 | Playwright tap call, includes actionability |
| 3 | 14:34:23.327 | Add | 96 | Playwright tap call, includes actionability |
| 3 | 14:32:37.736 | Finish | 88 | Playwright tap call, includes actionability |
| 2 | 14:31:34.227 | rating-to-next | 83 | rating call to changed exercise |
| 1 | 14:29:27.771 | Leave review | 80 | Playwright tap call, includes actionability |
| 2 | 14:31:34.222 | Good | 78 | Playwright tap call, includes actionability |
| 1 | 14:27:08.845 | Good | 77 | Playwright tap call, includes actionability |
| 2 | 14:31:34.302 | Leave review | 74 | Playwright tap call, includes actionability |
| 1 | 14:29:22.547 | rating-to-next | 72 | rating call to changed exercise |
| 3 | 14:34:02.923 | Search | 71 | Playwright tap call, includes actionability |
| 1 | 14:29:22.545 | Hard | 70 | Playwright tap call, includes actionability |
| 4 | 14:35:46.293 | Done | 69 | Playwright tap call, includes actionability |
| 1 | 14:28:36.011 | Good | 67 | Playwright tap call, includes actionability |
| 4 | 14:35:37.194 | rating-to-next | 66 | rating call to changed exercise |
| 5 | 14:36:08.552 | Leave review | 66 | Playwright tap call, includes actionability |
| 4 | 14:35:37.192 | Good | 65 | Playwright tap call, includes actionability |
| 5 | 14:35:48.677 | rating-to-next | 64 | rating call to changed exercise |
| 4 | 14:35:37.784 | Leave review | 64 | Playwright tap call, includes actionability |
| 5 | 14:35:48.675 | Good | 63 | Playwright tap call, includes actionability |
| 2 | 14:31:07.354 | rating-to-next | 61 | rating call to changed exercise |
| 5 | 14:36:07.107 | rating-to-next | 61 | rating call to changed exercise |
| 4 | 14:35:14.895 | rating-to-next | 60 | rating call to changed exercise |
| 2 | 14:31:07.353 | Good | 60 | Playwright tap call, includes actionability |
| 4 | 14:35:14.380 | rating-to-next | 60 | rating call to changed exercise |
| 1 | 14:29:27.690 | rating-to-next | 59 | rating call to changed exercise |
| 1 | 14:26:28.091 | No idea | 59 | Playwright tap call, includes actionability |
| 5 | 14:36:07.105 | Good | 59 | Playwright tap call, includes actionability |
| 4 | 14:35:14.894 | Good | 59 | Playwright tap call, includes actionability |
| 1 | 14:26:44.791 | Again | 59 | Playwright tap call, includes actionability |
| 2 | 14:30:46.925 | rating-to-next | 59 | rating call to changed exercise |
| 4 | 14:35:37.719 | rating-to-next | 58 | rating call to changed exercise |
| 4 | 14:35:14.379 | Hard | 58 | Playwright tap call, includes actionability |
| 5 | 14:36:40.361 | Done | 58 | Playwright tap call, includes actionability |
| 4 | 14:35:13.832 | rating-to-next | 57 | rating call to changed exercise |
| 5 | 14:39:18.922 | rating-to-next | 57 | rating call to changed exercise |
| 1 | 14:27:40.861 | Hard | 57 | Playwright tap call, includes actionability |
| 1 | 14:29:27.688 | Good | 57 | Playwright tap call, includes actionability |
| 5 | 14:36:08.118 | rating-to-next | 57 | rating call to changed exercise |
| 2 | 14:30:46.923 | Hard | 57 | Playwright tap call, includes actionability |
| 1 | 14:27:51.108 | Easy | 57 | Playwright tap call, includes actionability |
| 1 | 14:28:15.754 | Good | 57 | Playwright tap call, includes actionability |
| 4 | 14:35:37.717 | Good | 57 | Playwright tap call, includes actionability |
| 2 | 14:30:47.400 | rating-to-next | 56 | rating call to changed exercise |
| 1 | 14:30:27.552 | Key point | 56 | Playwright tap call, includes actionability |
| 4 | 14:35:13.830 | Good | 56 | Playwright tap call, includes actionability |
| 5 | 14:35:48.155 | rating-to-next | 56 | rating call to changed exercise |
| 1 | 14:27:18.227 | Check | 55 | Playwright tap call, includes actionability |
| 5 | 14:36:08.116 | Good | 55 | Playwright tap call, includes actionability |
| 5 | 14:39:18.919 | Good | 55 | Playwright tap call, includes actionability |
| 2 | 14:31:03.970 | Leave review | 54 | Playwright tap call, includes actionability |
| 2 | 14:30:47.398 | Good | 54 | Playwright tap call, includes actionability |
| 5 | 14:36:06.859 | Check | 54 | Playwright tap call, includes actionability |
| 5 | 14:35:48.153 | Hard | 54 | Playwright tap call, includes actionability |
| 5 | 14:39:57.769 | Leave review | 53 | Playwright tap call, includes actionability |
| 5 | 14:36:07.602 | rating-to-next | 53 | rating call to changed exercise |
| 5 | 14:39:57.715 | Undo last rating | 52 | Playwright tap call, includes actionability |
| 2 | 14:30:46.706 | Check | 52 | Playwright tap call, includes actionability |
| 2 | 14:31:23.724 | rating-to-next | 52 | rating call to changed exercise |
| 5 | 14:36:08.485 | rating-to-next | 52 | rating call to changed exercise |
| 5 | 14:39:18.982 | Undo last rating | 51 | Playwright tap call, includes actionability |
| 5 | 14:35:47.639 | rating-to-next | 51 | rating call to changed exercise |
| 5 | 14:36:07.600 | Hard | 50 | Playwright tap call, includes actionability |
| 2 | 14:31:23.722 | Good | 50 | Playwright tap call, includes actionability |
| 5 | 14:36:07.903 | Check | 50 | Playwright tap call, includes actionability |
| 3 | 14:33:20.544 | No idea | 50 | Playwright tap call, includes actionability |
| 5 | 14:36:08.483 | Good | 50 | Playwright tap call, includes actionability |
| 2 | 14:31:46.379 | Done | 50 | Playwright tap call, includes actionability |
| 2 | 14:30:47.219 | Check | 50 | Playwright tap call, includes actionability |
| 5 | 14:35:47.638 | Good | 49 | Playwright tap call, includes actionability |
| 4 | 14:35:13.625 | Check | 48 | Playwright tap call, includes actionability |
| 5 | 14:39:57.400 | .review :text-is("Sure") | 48 | Playwright tap call, includes actionability |
| 5 | 14:39:17.654 | Start review | 48 | Playwright tap call, includes actionability |
| 1 | 14:29:22.268 | Check | 48 | Playwright tap call, includes actionability |
| 1 | 14:27:51.557 | Good | 47 | Playwright tap call, includes actionability |
| 1 | 14:27:08.711 | .review :text-is("Sure") | 47 | Playwright tap call, includes actionability |
| 4 | 14:35:36.981 | Check | 47 | Playwright tap call, includes actionability |
| 1 | 14:29:37.586 | Done | 47 | Playwright tap call, includes actionability |
| 1 | 14:29:27.095 | rating-to-next | 47 | rating call to changed exercise |
| 5 | 14:35:48.447 | Check | 47 | Playwright tap call, includes actionability |
| 4 | 14:35:12.050 | Larger text | 47 | Playwright tap call, includes actionability |
| 1 | 14:29:21.977 | rating-to-next | 47 | rating call to changed exercise |
| 5 | 14:35:47.931 | Check | 47 | Playwright tap call, includes actionability |
| 2 | 14:31:06.836 | rating-to-next | 46 | rating call to changed exercise |
| 1 | 14:29:21.767 | Check | 46 | Playwright tap call, includes actionability |
| 1 | 14:28:35.834 | Check | 46 | Playwright tap call, includes actionability |
| 1 | 14:29:27.093 | Good | 45 | Playwright tap call, includes actionability |
| 5 | 14:39:18.696 | Check | 45 | Playwright tap call, includes actionability |
| 2 | 14:31:06.834 | Hard | 45 | Playwright tap call, includes actionability |
| 1 | 14:29:21.975 | Good | 44 | Playwright tap call, includes actionability |
| 5 | 14:39:57.655 | rating-to-next | 44 | rating call to changed exercise |
| 2 | 14:31:23.498 | Check | 44 | Playwright tap call, includes actionability |
| 2 | 14:31:06.632 | Check | 44 | Playwright tap call, includes actionability |
| 1 | 14:26:13.223 | Start review | 44 | Playwright tap call, includes actionability |
| 4 | 14:35:14.686 | Check | 44 | Playwright tap call, includes actionability |
| 2 | 14:30:46.395 | rating-to-next | 43 | rating call to changed exercise |
| 5 | 14:35:47.415 | Check | 43 | Playwright tap call, includes actionability |
| 2 | 14:30:46.182 | Check | 43 | Playwright tap call, includes actionability |
| 5 | 14:39:57.443 | Check | 43 | Playwright tap call, includes actionability |
| 1 | 14:29:21.720 | .review :text-is("Sure") | 43 | Playwright tap call, includes actionability |
| 3 | 14:33:29.040 | Check | 43 | Playwright tap call, includes actionability |
| 1 | 14:29:26.880 | Check | 43 | Playwright tap call, includes actionability |
| 2 | 14:31:23.453 | .review :text-is("Sure") | 42 | Playwright tap call, includes actionability |
| 4 | 14:35:14.137 | Check | 42 | Playwright tap call, includes actionability |
| 3 | 14:34:17.420 | Back | 42 | Playwright tap call, includes actionability |
| 5 | 14:39:57.653 | Good | 42 | Playwright tap call, includes actionability |
| 3 | 14:33:28.705 | Check | 42 | Playwright tap call, includes actionability |
| 3 | 14:33:12.403 | Check | 42 | Playwright tap call, includes actionability |
| 2 | 14:31:06.340 | rating-to-next | 41 | rating call to changed exercise |
| 4 | 14:35:37.509 | Check | 41 | Playwright tap call, includes actionability |
| 5 | 14:36:06.803 | .review :text-is("Sure") | 41 | Playwright tap call, includes actionability |
| 5 | 14:36:07.391 | Check | 41 | Playwright tap call, includes actionability |
| 2 | 14:31:07.128 | Check | 41 | Playwright tap call, includes actionability |
| 5 | 14:35:46.440 | Start review | 40 | Playwright tap call, includes actionability |
| 2 | 14:30:46.392 | Good | 40 | Playwright tap call, includes actionability |
| 4 | 14:35:12.000 | Larger text | 40 | Playwright tap call, includes actionability |
| 2 | 14:31:06.338 | Good | 39 | Playwright tap call, includes actionability |
| 3 | 14:33:48.161 | Done | 38 | Playwright tap call, includes actionability |
| 1 | 14:29:26.837 | .review :text-is("Sure") | 36 | Playwright tap call, includes actionability |
| 1 | 14:27:18.170 | .review :text-is("Sure") | 36 | Playwright tap call, includes actionability |
| 4 | 14:35:11.956 | Larger text | 34 | Playwright tap call, includes actionability |
| 3 | 14:33:40.650 | Next | 34 | Playwright tap call, includes actionability |
| 3 | 14:33:05.604 | Continue | 33 | Playwright tap call, includes actionability |
| 5 | 14:37:52.230 | Start review | 33 | Playwright tap call, includes actionability |
| 3 | 14:33:20.491 | Next question | 30 | Playwright tap call, includes actionability |
| 4 | 14:35:36.933 | .review :text-is("Sure") | 29 | Playwright tap call, includes actionability |
| 3 | 14:33:28.616 | Next question | 28 | Playwright tap call, includes actionability |
| 1 | 14:27:50.999 | .review :text-is("Sure") | 28 | Playwright tap call, includes actionability |
| 5 | 14:37:59.873 | Start review | 24 | Playwright tap call, includes actionability |
| 3 | 14:34:42.084 | Back | 24 | Playwright tap call, includes actionability |
| 3 | 14:34:31.491 | Add a source | 21 | Playwright tap call, includes actionability |
| 2 | 14:31:34.075 | .review :text-is("Sure") | 21 | Playwright tap call, includes actionability |
| 1 | 14:30:44.635 | Back | 20 | Playwright tap call, includes actionability |

## Reproduction and scope notes

- Checkout read: `63c9b83b14cd9cbdcee3f5acd80b699f601d0d54`. I changed no repository files, committed nothing, and used only `codex-out/commuter/` for artifacts.
- Supplied phone URL: localhost:1766; connected to existing WebKit on port 1760. No server/browser was launched or stopped. The served phone page included Vite's development client; I do not call it a verified release build.
- After early harness setup attempts, all five days ran in one fresh context/page. That page stayed open through all five days and the extra verification, then was closed.
- Day 4: 375×667, touch, dark. Settings has no font-size row. Reader Aa was increased until disabled. Global Larger Text used the repo's existing browser-test convention, `--type: 28/17` (`apps/desktop/e2e/journeys/phone-review.ts:88`); this is not a native iOS Settings test.
- Two taps directly after a programmatic scroll initially selected nothing. The repeated taps after settling worked. This matches the intentional scroll-stop guard; I do not report it as a touch failure.
- Finish said “Everything up to 3 Model Architecture” after rapidly visiting later sections. Because the run used section jumps and clock changes rather than continuous human reading, I did not classify the reading-reach estimate as a verified defect.
- The scripts use stored answer text for several simulated Explain responses to exercise save/rating paths. This is not an evaluation of the learner's knowledge or of AI quality.
- `drive.cjs` is the interactive driver; `helpers.cjs` contains bounded review actions; `events.jsonl` stores measurements and exercise snapshots; `*-db.json` stores read-only exports. `analyze.cjs` produces the per-exercise audit and saved-data summary. `post-verification-db.json` additionally contains the two undone probe ratings; the main totals use `final-db.json`.
