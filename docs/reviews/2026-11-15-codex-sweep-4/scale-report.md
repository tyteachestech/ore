# Scale sweep — 2026-11-15

Tested the supplied release builds in shared WebKit at Mac 1280×800 and phone 390×844, with 2× screenshots: Home/Today, all 14 Mac skills, All sources through its last row, the empty Feed, Settings, title filtering, full-text command search, Review, source filing/archive, skill rename, note autosave/reopen, long-book highlighting, and 100 consecutive reviews without reloading. All requested routine steps have three measurements; the early-highlight defect was independently reproduced twice. No application code was changed. The checkout was fa4e22d347648d79ca1d8d8899fb26752336af69; the supplied builds were used without rebuilding. Browser pages created by these scripts were closed in finally blocks. The supplied seed is **1,191 sources and 5,486 original reviews**, not 4,750 sources: five times the base seed, about 1.25× the existing 950-source bench. Its timestamps still span roughly a year, not five calendar years. Feed subscriptions/posts are absent, so a large Feed was not tested. Native iPhone hardware, native Mac shell behavior, real AI, and per-process memory were not tested.

## 1. Slowest steps first

Milliseconds; medians followed by the three runs. “Ready” is the first measured frame after the requested content appears, including observed DOM updates during outstanding reads. It excludes the harness's 150 ms quiet check. It can include Playwright dispatch, actionability and condition-polling overhead; it is an upper bound, not an isolated CPU profile. Input-event-to-frame numbers below are captured inside the page and exclude that overhead. All browser clocks use performance.now() and requestAnimationFrame.

| Step | Ready / complete ms (three runs) | First frame ms, median | Interpretation |
|---|---:|---:|---|
| Phone, fresh Today | 1932 (1969, 1903, 1932) | 247 | 9.39 MB snapshot; full source set loaded |
| Mac, long book fully mounted | 1524 (1615, 1475, 1524) | 44 | 1,556,902 rendered characters; early text is not yet interactive |
| Mac, note typing through autosave | 1123 (1119, 1125, 1123) | 39 | Intentional 800 ms debounce; typing itself stays responsive |
| Phone, large skill first open | 560 (565, 559, 560) | 539 | Tap-to-next-frame 496, 496, 501 ms |
| Phone, large skill second open | 514 (518, 503, 514) | 490 | Tap-to-next-frame 467, 462, 463 ms |
| Phone, Review first open | 459 (458, 469, 459) | 445 | Start tap alone blocks its next frame for 334–344 ms |
| Phone, Review second open | 444 (432, 445, 444) | 416 | Start tap alone blocks its next frame for 308–315 ms |
| Phone, search “the”, second open | 401 (401, 397, 413) | 80 | 508 rows: eight title matches plus 500 text matches |
| Phone, search “the”, first open | 398 (398, 399, 397) | 84 | Includes 150 ms search debounce |
| Mac, start Review, first open | 398 (895, 381, 398) | 98 | Whole two-action path: picker, then Start |
| Mac, start Review, second open | 381 (382, 381, 380) | 86 | Whole two-action path, not one blocked frame |
| Mac, fresh Home | 350 (366, 335, 350) | 118 | No second cold startup in the same page |
| Mac, full-text ⌘K “the” | 339 (344, 333, 339) | 46 | Waits for In the text, not just immediate title hits |

Filing one source finished all bridge reads **396, 383, 387 ms after the click** (median 387); archive finished in **411, 383, 389 ms** (median 389). Their immediate input frames were only 13–15 and 21–26 ms. The apparent ~500 ms archive times in the raw action-level measurements include ~240 ms of Playwright waiting for a newly opened menu to become stable; those are not reported as a half-second UI freeze. No final timed routine step exceeded 2 seconds.

## 2. Findings

### S2 — A long source silently ignores highlighting while its visible text is still loading (Mac)

1. Open a fresh Mac page on port 1724 with bridge 1725 and the supplied tauri.js init script.
2. Open All sources, filter “Complete Book”, and open “The Complete Book of Learning: Memory, Practice and Mastery”.
3. As soon as the first text appears, drag across “Prequestions is easier to understand once” in the first chapter's Common mistakes paragraph. Do this before all 40 chapters have mounted.
4. Wait for loading to finish. Then drag over exactly the same words again.

Expected: the visible text accepts the usual drag-to-highlight action, or clearly indicates that highlighting is not ready. Actual: the first gesture leaves an ordinary browser selection; no highlight command runs and nothing is saved, even after loading finishes. The second gesture creates the highlight immediately (47 ms bridge write in both repeats). Reproduced **2/2** fresh pages. The failed gestures ended at 763 and 597 ms after navigation, with only five and three chapters mounted. Full-book mounting takes 1,475–1,615 ms from opening the source in the three timing runs. This can lose a learner's capture unless they notice and repeat it.

Evidence: [raw before/after states](early-highlight.json), [first ignored selection](early-highlight-1.png), [second ignored selection](early-highlight-2.png), [same selection after loading](late-highlight-1.png). Suspect apps/desktop/src/Reader.tsx:2750 returns immediately when ready is false; ready is set only at :1213–1216 after Body has mounted all its slices (:532–540). This is not the previously fixed four-second mounting freeze in F251.

### S2 — Opening a skill or starting Review blocks the phone's next frame, even on repeat opens (iPhone browser build)

1. Open a fresh 390×844 touch page on port 1726 with the preamble's phone init script.
2. Wait for Today, then tap Learning.
3. Tap Today to return, then open Learning again.
4. Return to Today, tap Start review, then Start review in the picker.

Expected: a screen responds within 300 ms, and core reads do not hold the next frame for half a second. Actual: Learning's first tap-to-frame takes **496, 496, 501 ms**, and its second takes **467, 462, 463 ms**. Review's Start tap takes **340, 344, 334 ms** first time and **308, 315, 312 ms** second time. Reproduced **3/3 first opens and 3/3 repeat opens** for each. The screens eventually work; this is a recurring pause, not a crash or refusal.

Evidence: [skill](phone-skill.png), [review](phone-review.png), [timings/event frames](measurements-v2.jsonl), [phone log](phone.log). Suspect apps/desktop/src/phone/core.ts:234–257 runs commands in-process on the page's thread; SkillPage.tsx:356–369 asks for stats on every mount, and packages/cli/src/cmd-study.ts:179 computes whole-library stats before filtering to the requested skill at :180. Attribution to any one function remains a hypothesis; the blocked input frames themselves are directly measured.

### S3 — Filing and archiving one source refresh both whole source lists (Mac)

1. Open Learning on a fresh Mac page.
2. On “The complete guide to prequestions (with examples, pitfalls, and a worked case study from a real project) (part 173)”, open its Skills picker and add Piano.
3. Close the picker and undo the filing.
4. Open the row's context menu, Archive it, then Undo.

Expected: a one-source write refreshes the data it changes and finishes within the requested 300 ms screen budget. Actual: both operations run unfiltered ls and ls --archived; filing ran five or six bridge calls, and archiving eight or nine, including repeated questions reads and skill stats. The last response arrives in **383–396 ms for filing** and **383–411 ms for archive**, after the actual click. Reproduced **3/3** each. Visible feedback remains quick (13–26 ms), and Undo restored the source. This is avoidable background work and a scaling risk, not evidence that every write reloads everything. Renaming, highlighting, rating and note autosave did not do the same whole-library reload.

Evidence: [restored skill page](writes-finished.png), [write timings](write-check.log), command traces under write-final in [raw measurements](measurements-v2.jsonl). Suspect apps/desktop/src/App.tsx:332–344 refresh fetches both lists; filing calls refresh at :1827 and archive uses inOrder at :1483–1491, whose completion triggers refresh at :327. ore.ts:35 also wakes stats/questions/tries after archive.

## 3. Screen coverage and first/second opens

Every cell is median ready milliseconds; three runs are in parentheses. “First” means first visit to that view within a fresh page; “second” is a repeat visit in that same page.

| Mac screen | First open | Second open |
|---|---:|---:|
| Home | 111 (109, 111, 112) | 112 (112, 110, 112) |
| skill AI | 273 (270, 273, 273) | 280 (280, 281, 265) |
| skill Learning | 261 (261, 264, 259) | 263 (260, 266, 263) |
| skill Teaching | 261 (260, 263, 261) | 262 (264, 262, 262) |
| skill Creator Business | 262 (260, 262, 262) | 262 (262, 261, 262) |
| skill Storytelling & Writing | 261 (261, 259, 261) | 262 (262, 263, 262) |
| skill Creativity | 262 (263, 262, 262) | 261 (261, 260, 280) |
| skill Distributed Systems | 261 (261, 248, 263) | 261 (279, 261, 261) |
| skill Habits | 261 (260, 262, 261) | 262 (264, 262, 262) |
| skill Focus & Attention | 260 (251, 260, 263) | 248 (261, 247, 248) |
| skill Self-Regulation & Motivation | 262 (262, 261, 262) | 262 (259, 262, 263) |
| skill Spanish | 262 (262, 262, 260) | 262 (261, 262, 262) |
| skill Piano | 261 (261, 261, 262) | 262 (248, 262, 262) |
| skill Personal Finance | 261 (259, 261, 261) | 262 (261, 262, 263) |
| skill Stoicism | 249 (249, 248, 250) | 263 (262, 263, 263) |
| All sources | 211 (211, 210, 229) | 282 (282, 293, 282) |
| Feed | 215 (213, 215, 217) | 230 (248, 230, 216) |
| Settings | 112 (98, 112, 112) | 112 (107, 112, 113) |
| Review | 398 (895, 381, 398) | 381 (382, 381, 380) |

Learning was largest by active source membership: **182 sources**; AI had 180. Creativity and Self-Regulation & Motivation had 49 each. All 14 were visited, including both small skills. Skill sections intentionally show a short list with Show all; the phone's Learning page offered Show all 100 for To read.

All sources' default To read tab contained **565 rows**, all mounted, in **11,754 DOM elements**. Scrolling to the last row was verified three times at scrollTop 40,167/40,168/40,168 against a maximum 40,168 px; the final row was “What I learned about ai code review”. End-scroll frames: 19, 10, 23 ms. [End state](scroll-end.json), [screenshot](all-sources-end.png). There were 1,098 non-archived sources total in ore ls; the smaller To read count is a status filter, not truncation.

Individual t, h, e presses in All sources' filter stayed at **12–30 ms from key event to frame**. The immediate title filter completes before the debounced full-text response; the full-text ⌘K figures above wait explicitly for In the text. The Mac palette displayed 29 rows for “the”: eight title matches, twenty text matches and Ask. The phone displayed 508: eight title matches and 500 text matches. These are explicit search limits (Palette.tsx:81 and TITLES at :55), with no paging affordance observed; they are not evidence that sources were dropped during import.

The supplied Feed is empty. Opening it passed, but performance with years of actual feed posts remains untested.

## 4. Writes and the uninterrupted review session

| Action | Three measured completion values (ms) | Immediate input frame / behavior |
|---|---:|---|
| Rate an exercise | 135, 182, 164 | 7–15 ms in the action trials; current/next exercise reads only |
| Undo rating | 130, 129, 113 | Returns to the question, intentionally hides the answer |
| Retire exercise | 183, 167, 184 | Next exercise appears; Undo restores it |
| Undo retire | 81, 82, 81 | Restores the exercise |
| Highlight in fully loaded book | 87, 74, 72 | One highlight write, no whole-library reread |

Rename write + skill-list reload finished 106, 92, 95 ms after Enter. Rename input frames were 10–15 ms. Note typing stayed at 15–17 ms per event, and all three distinct note markers survived navigation away and reopening. The 800 ms debounce lives at Notes.tsx:182; the actual notes write took about 47 ms in the first full autosave trace. [Reopened note](note-reopened.png), [save/reopen log](note.log).

**100 ratings, one page, no reload:** first ten median transition **148 ms**, last ten **148 ms**; rating 1 **165 ms**, rating 100 **148 ms**, slowest **299 ms**. The maximum over all 100 rating input-event frames was 14 ms. DOM count was 2,222 after rating 1 and 2,470 after rating 100. It stepped up around rating 8 (the exact cause was not isolated), then varied around 2,450–2,500 rather than rising with every rating. Last ten counts: 2,467, 2,499, 2,485, 2,481, 2,462, 2,480, 2,499, 2,484, 2,481, 2,470. This finds no progressive DOM growth or latency deterioration; DOM count does **not** rule out a JavaScript heap leak. [All 100 samples](session.json), [100th review](review-100.png).

WebKit returned undefined for performance.memory. The sandbox refused ps with “operation not permitted”, so page RSS and the requested 3 GB threshold could not be monitored or verified. No claim of staying below 3 GB is made. No browser page was intentionally left open.

## 5. CLI

Commands ran serially against the supplied library with --json, before the review/write journeys. Timing includes Bun process startup and JSON serialization.

| Command | Three runs ms | Median ms | Result |
|---|---:|---:|---|
| ore doctor --json | 234, 222, 227 | 227 | 0 errors, 0 warnings |
| ore stats --json | 149, 144, 146 | 146 | Succeeded |
| ore ls --json | 113, 107, 107 | 107 | Succeeded |
| ore due --json | 98, 90, 93 | 93 | Succeeded |
| ore search practice --json | 78, 76, 77 | 77 | Succeeded |
| ore list --json | 32, 31, 31 | 31 | Unsupported command; ore ls is the correct spelling |

**Growth faster than library size was not empirically established.** Only one library size was supplied, and no other tester's library was used or changed. Comparing these numbers to CI's 950-source baseline would mix machines/engines and cannot produce a valid growth factor. Code inspection identifies these candidates, not measured regressions:

- stats scans sources, exercises and reviews for each skill and the total (packages/core/src/study.ts:247–282); retentionMetric sorts reviews (:25 in stats.ts). A skill-specific request still calculates every skill first. Cost can grow with both skill count and review count, with sorting above linear time.
- due scans all reviews/exercises, then orders candidate groups (study.ts:142–192; queue.ts:47,70). Growing history and candidate sorting both matter.
- ls traverses all sources and reads note/thumbnail metadata, even before returning one skill's filtered results (cmd-items.ts:200–211).
- doctor checks all files, annotations/anchors and review logs (doctor.ts:72–162). Large individual source bodies and their highlight counts can cost more than a source count alone suggests.
- search uses the derived SQLite full-text index with a result limit, but opening it still synchronizes the file index (cmd-study.ts:337; db.ts:133–153).

The post-journey doctor also returned **0 errors and 0 warnings**: [post-check](doctor-after.json). [CLI timing records](cli-timings.json).

## 6. Phone loading, limits, and known rows

The phone snapshot contains **1,191 source documents, 3,466 files, and 5,486 review lines**, serialized in **9,386,477 bytes**. It mounted successfully into the browser filesystem/IndexedDB overlay on every run. All 14 skills appeared; Today, Learning, Review and search worked in three fresh contexts and on repeat opens. No quota refusal or boot error was observed. First-load medians are in section 1; Today revisits took 70–79 ms. This tests the browser snapshot path, not an actual iPhone's native iCloud file path. [Snapshot counts](phone-snapshot-counts.json).

No fixed finding is claimed to have regressed. F84 concerned quadratic deletion during a fresh index build; this run observes a ~1.9 s larger phone startup, but does not establish that its fixed deletion behavior returned. F251 concerned a four-second freeze while mounting a 20 MB source; this 1.56 MB book renders incrementally, but the separate early-highlight gap above remains. F67/F142's stalled Review did not appear during the completed 100-review journey. F14, F259 and F260 were excluded as requested.

## 7. Passed and remaining boundaries

- All 14 Mac skill pages opened twice in three runs; no refusal, empty replacement, or multi-second screen stall.
- All sources reached its actual last To read row; no apparent pagination loss.
- Review rating, Undo and retire/restore worked; 100 reviews stayed responsive.
- Skill rename, filing and archive restored through the app's Undo.
- Highlighting after the book finished loading saved; the early gesture defect is reported separately.
- Note edits survived three save/reopen cycles.
- CLI doctor was clean before and after the journeys.
- No S1 crash, data corruption or blocked daily loop was found.
- This is **not a 4,750-source validation**, a full Feed benchmark, a real-device memory measurement, or a measured asymptotic scaling comparison.

Reproduction scripts, raw JSONL, logs and screenshots are all in this folder. measurements.jsonl and the initial screens/phone/long pilot logs include harness discovery runs (wrong Escape/selector/ready-state assumptions); they are not product failures. The final screen timings come from screens2.cjs, phone-final records, long-full records, write-final records and the named final action/session scripts. Reported product findings were checked again with corrected flows.
