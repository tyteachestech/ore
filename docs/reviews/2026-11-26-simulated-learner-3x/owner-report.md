# Owner learner run — 2026-11-26

I played the requested five-day sequence as four sessions on the owner's copied library, skipping Day 4. Coverage included 20 saved ratings, correct/partial/wrong Explain answers, returning misses, an interrupted answer, four highlights and a Key point note, a code-heavy Fetch article, Finish and its quiz, passage tutoring, Ask your library, editing with write failures, deleting with Undo/Redo, and final skill/end-screen accounting. Two issues reproduced: ordinary quiz progress invalidates recall feedback with no in-app retry; Review's key points and grading feedback still expose Markdown. No data loss or crash was observed. The supplied backend cannot advance dates (known F739), so actual missed-day behavior, tomorrow's due queue, and the normal one-in-five new-exercise mix remain untested. I avoided redoing the previous run's long-book journey and did not test iPhone, native Mac integrations, or visual taste.

## Findings

### 1. Answering the Finish quiz invalidates the recall feedback that Finish just started

**S2 · Mac · 2/2 sources, no failure injection.** This interrupted both completed quiz flows. The learner gets a terminal command instead of feedback or a usable recovery action. The two rejected feedback requests consumed **15.332 s and 16.945 s**; they ran alongside quiz work, so these are not additive blocked wall time.

Reproduce from a fresh Mac page using the supplied bridge setup and a source with unanswered after-reading questions:

1. Open **How the web works** (`01M5KCZ4XJB5KVQ8FQ2YMSFRZ7`) from the original owner seed, or import **Fetch** (`https://javascript.info/fetch`) and let its prequestions finish.
2. Read, scroll to the end, choose **Finish**, and write a real free recall. For Fetch, recall the two-stage response, HTTP versus network errors, and JSON POST options.
3. Choose **Continue**. Promptly type and check the first quiz answer while recall feedback is still running. Continue through the remaining questions.
4. At **Done with this source?**, inspect the recall-feedback area.

**Expected:** Finishing the quiz produces feedback based on the saved recall and answers. If an input change requires a fresh run, the app handles it or offers a retry without leaving the learning flow.

**Actual:** The final panel says: `Recall feedback failed: prequestions changed while feedback was running; run ore recall --feedback again`. There is no retry control. **Keep reading** and **Done** are still available. Recall and quiz answers survived; Fetch could be marked done and its exercises drafted. Both saved source files contain recall text but no recall feedback.

Evidence:

- First occurrence, Fetch `01M8CMYAK3F262CK2HQ5AV9F6A`: [screenshot](day3-recall-error.png), [saved source](fetch-01M8CMYAK3F262CK2HQ5AV9F6A.md).
- Second occurrence, How the web works: [screenshot](day3-recall-error-second.png), [saved source](how-the-web-works-01M5KCZ4XJB5KVQ8FQ2YMSFRZ7.md).
- The second pass was a targeted confirmation: a real first answer, then two **No idea** answers; I chose **Keep reading**, leaving that source in `reading` state.

**Suspected cause:** `apps/desktop/src/Finish.tsx:271` starts feedback before advancing to the quiz at line 273. The quiz then writes `prequestions.after`. `packages/core/src/ai/recall.ts:25` includes those answers in the guarded input, and line 56 correctly refuses to save stale feedback. `Finish.tsx:672` only displays the resulting error. This is a sequencing/recovery gap exposed by the F712 stale-input protection, not a return of F712's incorrect-feedback save. I initially suspected concurrent key-point generation; source inspection identified the quiz answer change instead. The screen should offer an actionable recovery, rather than require reading code or running a command.

### 2. Review leaves code markup raw in the points used to judge an answer

**S3 · Mac · key-point issue seen on four distinct Fetch exercises; screenshots verify three.** The question and reference answer render code correctly, but the checklist immediately below them shows literal backticks. This repeatedly interrupts a programming learner comparing precise syntax against the grading criteria. Grading feedback also showed raw backticks on the two-await exercise.

Reproduce from a fresh page against this run's saved library:

1. Open **Fetch**, then **Source actions → Review this source**. With an original seed, first import, finish, and let the article's exercises draft.
2. Reach an Explain exercise about two awaits, HTTP status handling, JSON POST, or sending a Blob. Type an answer and choose **Check**; wait for feedback.
3. Compare the formatted question/reference answer with **Key points** and the feedback paragraph. Repeat on the next code-bearing exercise.

**Expected:** Code expressions are rendered consistently in the question, answer, key points, and AI feedback.

**Actual:** The checklist exposes strings such as `` `response.json()` `` and `` `Response` ``. In the two-await example, the feedback also prints `` `fetch()` `` and `` `response.json()` `` literally. This is display formatting; the saved learning content and marks remain intact.

Affected exercise IDs:

| Exercise | ID | Evidence |
|---|---|---|
| Sending a Blob | `01M8CNC3NSWKDMMC4ZTT0FW8V2` | Live observation recorded in [log](log.md) |
| Two awaits | `01M8CNC3NRKREBNK6RBCGT9GHZ` | [Key points and feedback](day5-review-rubric-markdown.png) |
| HTTP failure versus network failure | `01M8CNC3NRKREBNK6RBCGT9GJ0` | [Second screenshot](day5-review-rubric-second.png) |
| JSON POST | `01M8CNC3NSWKDMMC4ZTT0FW8V0` | [Third screenshot](day5-review-rubric-third.png) |

**Suspected cause:** `apps/desktop/src/Review.tsx:915` places rubric text directly inside a span, and line 925 places grading feedback directly inside a paragraph. The answer at line 889 uses `ExerciseText`, the shared Markdown renderer. This extends the same defect family as F333/F732 into Review's rubric and grading-feedback fields; the specific question/answer and Finish surfaces fixed by those rows worked in this run.

## Known rows and observations not promoted to findings

- **F198, duplicate AIMA imports:** Still present in the copied library. Maintenance reached a redundant scoring-rule exercise, `01M78B5FPC50C89GP1EGNQ1JE2`; I retired it through the app, confirmed Undo restored it, then Redo retired it. This remains an existing library issue, not a new finding. [Screenshot](day3-duplicate.png).
- **F731:** The corrected limit text held on Home and the end screen: **Up to 10 start each day.**
- **F732:** Fetch's Finish quiz rendered its questions and key points as code. Finding 2 concerns different fields in Review, not a confirmed recurrence on Finish.
- **F739:** All backend ratings were on November 26. The normal queue ran out after the Day 3 carried-over exercise; Day 5's five Fetch exercises were tested through source-only review. That cannot establish normal new/due mixing or a missed-day transition.
- No fixed row was confirmed to recur in its exact previously fixed scope.
- One rapid jump to **Response headers** followed immediately by Home reopened at the top. A normal pause before leaving saved 3,603 px and reopened at 3,602 px. I did not reproduce the rapid-leave case twice, so it is only an observation.
- No newly encountered exercise was demonstrably unanswerable from the shown prompt/reference material. Apart from known AIMA duplication, the five new Fetch exercises covered distinct concepts. No new broken passage was confirmed. Raw Markdown IDs are listed above.

## Journey and saved-file checks

The library began with 67 sources and 38 exercise files; it ended with 68 sources and 43 exercise files. Source text, annotations, review events and session receipts were read from the assigned copy. All writes to it went through the app. [Before snapshot](before.json), [final snapshot](final-files.json), [review audit](audit.json), and [library check](library-check.json) retain the evidence.

| Session | What happened | Saved outcome |
|---|---|---|
| Day 1 | Home review; correct, half-right and deliberately wrong Explain answers; a Fact miss returned after three intervening exercises; continued beyond the goal | 9 ratings; 5 kept; 2 rescued; +43 memory days; one Computer Science gem; 666,978 ms counted |
| Day 2 | Six encounters within the short-day budget; five rated, Esc in the sixth | 5 ratings; 3 kept; 53,300 ms counted; partial API-ID answer resumed exactly on Day 3; Home showed cumulative 12 of 10 minutes |
| Day 3 | Finished the interrupted answer, then normal queue exhausted; read Fetch, completed quiz and Done, tutor/library questions, edit/delete maintenance | 1 rating; 1 kept; 98,598 ms counted; Fetch marked done and five review exercises drafted; maintenance and diagnostic replay added no ratings |
| Day 4 | Skipped | No actions or ratings |
| Day 5 | Checked Home, then source-only review because normal daily allocation was exhausted | 5 Fetch exercises each labeled New and rated Good; 5 kept; +12 memory days; 713,810 ms counted |

**Reading and capture:** The four added Values Guide highlights persisted with stored anchor lengths 28, 36, 180 and 92 characters. One became a Key point with the note, “A useful teaching pattern: promise relief, then teach the values that make the relief possible.” Collected showed that Key point plus five plain highlights, including two originals. Selection used browser text ranges and the app's selection event; this verifies saving and reopening, not physical drag accuracy. [Collected screenshot](day1-collected.png).

**Fetch import and completion:** URL import became usable in 2.348 s. Its prequestions arrived about 19 s after capture, based on saved timestamps. It retained five headings and 14 fenced code blocks through the article's end. Import produced prequestions; review exercises were created after **Finish → Done**, taking 41.688 s in the background. All five saved drafts recorded Codex / `gpt-6.2-sol` / `enrich@17`. The article was chosen for its direct use in a creator dashboard. Its finished source and note are saved alongside this report.

**Ratings and dates:** The saved learner rating remained independent of the AI recommendation: the first correct Explain answer was AI Easy but user Good. The API partial answer was 2/4 and user Hard; the deliberately wrong ANI/AGI/ASI answer was 0/3 and user Again. Misses returned within the session and their later Good ratings were saved. All exact ratings and due dates appear in `audit.json`; they are actual backend dates, not simulated dates. For example, the original retrieval exercise became due December 6; the previously reviewed API Fact became due January 3; all five Fetch exercises became due November 29. These future dates explain why normal later sessions could not bring them back today.

**Maintenance:** Edited `01M78B5FP916SGKTVYW1TCT2BR` to ask what a rational AI agent maximizes when outcomes are uncertain, with an answer about expected value and the available information. Two injected `card set` failures displayed an error and retained both fields. Clearing the hook allowed Save in 217 ms; reopening matched. The redundant scoring-rule exercise ended retired after the verified delete/Undo/Redo sequence. No library files were edited directly.

### Every number on the final screen

[Final end screen](final-end.png), [screen text](final-ui.txt).

| Display | Saved-file check | Result |
|---|---|---|
| 26 minutes today, goal 10 | 666,978 + 53,300 + 98,598 + 713,810 = **1,532,686 ms**, or 25:32.686, rounded to 26; configured daily goal 10 | Matches |
| 5 memories kept | Final session has five successful first Good ratings and receipt `kept: 5` | Matches |
| +12 days of memory | Five initial stabilities of 2.3065 days: 11.5325 rounded to 12; receipt `depth_days: 12` | Matches |
| Web Development, five rough stones | Receipt `kept_skills: [{skill: web-development, n: 5}]`; no newly cut gem | Matches |
| 14 new exercises wait | 43 exercise files − 12 retired − 17 active exercises with review history = 14 waiting | Matches |
| Up to 10 start each day | Daily cap was reached before source-only review; normal queue offered no further new exercise | Matches observed behavior |

The Web Development skill showed **0 cut, level 0, five to level 1**. All five newly reviewed exercises remain below the 21-day solid threshold. Computer Science showed **1 cut, level 0, four to level 1**; the old API Fact reached stability 28.7756461. [Web Development](day5-skill-web.png), [Computer Science](day5-skill-computer-settled.png).

## Where the minutes went

The requested days are sessions on one backend date. To exercise the ten-minute end screen without tying up the shared Mac for repeated real ten-minute waits, I advanced the page's ticking system time within that date: 510 s in Day 1, 60 s in Day 3, and 600 s in Day 5. These increments flowed into the recorded review time; they did not advance scheduling dates. Review counts below are exact saved values, **not actual time spent thinking**. Real waits were measured separately with Node `performance.now()`.

Reading, navigation and maintenance wall time were not independently instrumented, so a complete time budget cannot be reconstructed honestly. Request totals include overlapping work and jobs that finished after moving on. They must not be added to action timings or described as minutes blocked.

| Day | Review, recorded | Reading | Adding | Measured request work ≥1 s, overlaps included | Lost / unsuccessful work |
|---|---:|---|---|---:|---|
| 1 | 11:06.978; includes 8:30 advanced | Values Guide + four highlights + note; Fetch preview; time not isolated | Fetch usable in 2.348 s; prequestions approximately 19 s after capture | 1:11.267 | No data loss observed; rapid-leave reading-position recovery time not isolated |
| 2 | 0:53.300 | Reopened Fetch; time not isolated | None | 0:43.649 | No answer loss on Esc |
| 3 | 1:38.598; includes 1:00 advanced | Fetch to end, three quiz questions, two tutor questions; maintenance and diagnostic second source; time not isolated | Five drafts: 41.688 s background work | 4:38.193, including diagnostic replay | Two discarded recall-feedback runs total 32.277 s of overlapping request work; recovery overhead not separately timed |
| 4 | 0 | None | None | 0 | None |
| 5 | 11:53.810; includes 10:00 advanced | Review answers and skill inspection; time not isolated | None | 0:47.044 | Repeated code-markup interpretation; time not isolated |

After subtracting the 19:30 of explicit page-clock advancement, recorded rating time contains **6:02.686** of ordinary elapsed time. This still is not a full task-duration measure: unrated reading, editing, screenshots and analysis are excluded.

## What passed

- Correct, partial and wrong typed answers received visible checking states and appropriate broad feedback; user ratings controlled the saved review.
- An Again miss returned after three intervening exercises, without pretending to be a new exercise.
- Esc preserved the unfinished answer across the next session.
- Four highlights, a Key point and its note survived reopening; earlier annotations remained.
- A settled reader position survived closing and reopening within one pixel.
- Fetch imported headings and code through its end and ultimately produced five real AI exercises after Finish.
- The Finish quiz's Markdown rendering held; a point could be manually marked as got.
- Both tutor questions returned source-grounded answers; full responses took 20.943 s and 22.015 s, with a visible working state.
- Exercise editing survived two injected write failures, then saved and reopened correctly.
- Delete, Undo and Redo produced the intended final retired state.
- All five Fetch exercises appeared as New in source-only review and saved their Good ratings.
- Final minutes, kept count, memory-day gain, waiting count and inspected skill numbers matched saved records.
- No browser page exception was captured and no saved learning data loss was observed.

## Felt slow

AI waits were the main repeated cost: roughly 8–14 s for reviewed Explain answers, 20–22 s for complete tutor replies, and 33–42 s for key points or drafting. Working states were visible. I found no twice-confirmed silent wait over one second. The strongest failure is the two recall-feedback waits that ended without a usable result.

The table below contains every recorded action duration and every CLI request taking at least one second, slowest first. Subsecond CLI traffic is retained in [requests-ore.jsonl](requests-ore.jsonl); raw action measurements are in [timings.jsonl](timings.jsonl). A rating-transition measurement ends when the old question disappears, which can precede the next question becoming usable. The 109 ms quiz-check action similarly detected a control change, not finished AI feedback. Durations over 100 ms do not prove that the press lacked immediate visual acknowledgement. Initial Home rows are repeated setup measurements; failed automation selectors and their timeouts are excluded.

| Day | Phase | Action / request | Seconds |
|---|---|---|---:|
| 3 | Read | CLI enrich 01M8CMYAK3F262CK2HQ5AV9F6A | 41.688 |
| 3 | Read | CLI key-points 01M8CMYAK3F262CK2HQ5AV9F6A | 40.549 |
| 3 | Verify recall failure | CLI key-points 01M5KCZ4XJB5KVQ8FQ2YMSFRZ7 | 38.374 |
| 3 | Read | CLI key-points 01M8CMYAK3F262CK2HQ5AV9F6A | 32.764 |
| 3 | Tutor | Ask library complete reply | 22.015 |
| 3 | Tutor | CLI tutor Why should I recall the same idea across spaced reviews instead of rereading different fragments? --earlier=[{"message":"The passage says HTTP 404 and 500 do not make fetch reject. In my creator dashboard, why can I not rely on catch alone, and what  | 21.517 |
| 3 | Tutor | Passage tutor complete reply | 20.943 |
| 3 | Tutor | CLI tutor The passage says HTTP 404 and 500 do not make fetch reject. In my creator dashboard, why can I not rely on catch alone, and what would I check before parsing the analytics JSON? --item=01M8CMYAK3F262CK2HQ5AV9F6A | 20.314 |
| 3 | Verify recall failure | CLI recall 01M5KCZ4XJB5KVQ8FQ2YMSFRZ7 --feedback | 16.945 |
| 3 | Read | CLI recall 01M8CMYAK3F262CK2HQ5AV9F6A --feedback | 15.332 |
| 1 | Review | CLI grade 01M6JBPBM5X7ZDRC0SNMRYC141 --answer=Copying the brain takes an existing intelligent design as a model; simulating evolution searches for a design by selection over generations; automated AI research asks a system to discover improvements to intellige | 13.791 |
| 1 | Review | CLI grade 01M73GRQKWNAN5DPHZ9FHXY67Q --answer=Human-sounding output does not prove a human reasoning process. We would need a testable model of how humans think and evidence from psychology or neuroscience comparing internal steps, not just a useful final answ | 13.777 |
| 1 | Review | CLI grade 01M6JBPBM5X7ZDRC0SNMRYC140 --answer=ANI is specialized, even if superhuman at chess. AGI matches human ability broadly, while ASI exceeds the best human minds across practically every field. Breadth and capability are both relevant. | 12.828 |
| 2 | Review | CLI grade 01M73GSRZSGD0EZDKD8D0DAN3Q --answer=JSON is a text data format. Many languages parse it; its JavaScript-inspired notation does not require the app to be implemented in JavaScript. | 12.380 |
| 2 | Review | CLI grade 01M73GRQKZYRGP028GZX14EHBW --answer=Treat the objective as uncertain: retention alone is not my true preference. Ask me about accuracy and trade-offs, learn from feedback, and avoid confidently optimizing a misleading cut before resolving that uncert | 11.938 |
| 1 | Review | Explain check You're building a creator-business app for web and mobile that ou | 11.875 |
| 1 | Review | CLI grade 01M64QC521VBJKTT5BVY7WSAJJ --answer=The API keeps credentials and database access on the backend, which is safer. Web and mobile can share endpoints. I am not sure what the other two benefits were. | 11.833 |
| 5 | Review | CLI grade 01M8CNC3NRKREBNK6RBCGT9GHZ --answer=The first await yields the Response with the headers. The body still needs to be downloaded and parsed, so response.json() returns a separate promise that I await for the usable JavaScript value. | 11.549 |
| 3 | Read | CLI check 01M8CMYAK3F262CK2HQ5AV9F6A 2 | 11.331 |
| 2 | Review | Explain check An AI production assistant must choose a filming schedule before  | 10.879 |
| 2 | Review | CLI grade 01M73GRQKZYRGP028GZX14EHBT --answer=Estimate weather probabilities, compare the expected usefulness of schedules against the goal, and choose the best feasible one given time and computing limits. It need not guarantee the outcome or search every sch | 10.725 |
| 5 | Review | CLI grade 01M8CNC3NRKREBNK6RBCGT9GJ0 --answer=A 404 gives a resolved Response: response.ok is false and response.status gives 404. Network failure instead rejects the promise and enters a catch around await fetch. | 10.173 |
| 3 | Review | Explain check Your content-planning app creates a video record through an API,  | 9.881 |
| 3 | Review | CLI grade 01M73GSRZTKA0CTCCAYKHF480J --answer=Return the assigned record ID, for example in a JSON response. The client can use that ID to fetch the specific new record through its endpoint. | 9.687 |
| 1 | Review | D1 correct Explain check | 9.381 |
| 5 | Review | Explain check Your creator dashboard needs the raw JSON reply for debugging and | 9.369 |
| 1 | Review | CLI grade 01M4J5754B2XBSV9Q3726M5GWV --answer=Retrieval strengthens what I actually recall. If I switch fragments each time, related unrecalled knowledge may be inhibited and reinforcement becomes unreliable. I should recover the same underlying idea, but can  | 9.159 |
| 5 | Review | CLI grade 01M8CNC3NSWKDMMC4ZTT0FW8V1 --answer=Read the response once as text, keep that string for debugging, then use JSON.parse on the saved text for the chart. Do not call text() and json() on the same body because the first consumes it. | 8.995 |
| 5 | Review | Explain check Your dashboard exports a report as a Blob whose type is applicati | 8.871 |
| 2 | Review | CLI grade 01M73GRQKY07RE98W9C27MZBAE --answer=It is AI because it computes useful actions, but not machine learning because it does not improve from experience. Machine learning is one approach within AI. | 8.607 |
| 5 | Review | CLI grade 01M8CNC3NSWKDMMC4ZTT0FW8V2 --answer=Use fetch with method POST and put the PDF Blob directly in body. Leave Content-Type unset so the browser takes application/pdf from the Blob type. | 8.478 |
| 1 | Review | Explain check Using Tim Urban's ANI–AGI–ASI framework, how would you explain th | 8.347 |
| 1 | Review | CLI grade 01M6JBPBM5X7ZDRC0SNMRYC140 --answer=ANI is smarter than humans at every task, AGI is a chatbot that can only answer one sort of question, and ASI is an ordinary calculator. | 7.997 |
| 5 | Review | CLI grade 01M8CNC3NSWKDMMC4ZTT0FW8V0 --answer=Use method POST, body JSON.stringify(filter), and headers with Content-Type application/json. The body must be serialized, not the object itself. | 7.849 |
| 3 | Read | Quiz Q3 complete check | 6.337 |
| 3 | Read | CLI check 01M8CMYAK3F262CK2HQ5AV9F6A 1 | 6.087 |
| 3 | Read | CLI check 01M8CMYAK3F262CK2HQ5AV9F6A 3 | 5.943 |
| 3 | Verify recall failure | CLI check 01M5KCZ4XJB5KVQ8FQ2YMSFRZ7 3 | 5.903 |
| 3 | Verify recall failure | CLI check 01M5KCZ4XJB5KVQ8FQ2YMSFRZ7 1 | 5.902 |
| 3 | Verify recall failure | CLI check 01M5KCZ4XJB5KVQ8FQ2YMSFRZ7 2 | 5.858 |
| 1 | Add | URL import Fetch | 2.348 |
| 1 | Add | CLI add https://javascript.info/fetch | 1.882 |
| 1 | Review | Leave review → end | 1.339 |
| 1 | Open | Initial Home | 0.461 |
| 1 | Review | Start selected review | 0.353 |
| 1 | Open | Initial Home | 0.266 |
| 1 | Open | Initial Home | 0.245 |
| 3 | Maintenance | Exercise retry save | 0.217 |
| 3 | Review | Rate Good → next | 0.116 |
| 3 | Read | Finish Continue → quiz question | 0.115 |
| 1 | Review | Rate Good → next | 0.114 |
| 1 | Review | Rate Hard → next | 0.113 |
| 3 | Read | Quiz Q1 check | 0.109 |
| 1 | Review | Rate Good → next | 0.108 |
| 1 | Review | Rate Good → next | 0.107 |
| 1 | Review | Rate Good → next | 0.105 |
| 5 | Review | Rate Good → next | 0.104 |
| 2 | Review | Rate Good → next | 0.104 |
| 2 | Review | Rate Good → next | 0.100 |
| 1 | Review | Rate Again → next | 0.097 |
| 1 | Review | Rate Good → next | 0.096 |
| 5 | Review | Rate Good → next | 0.095 |
| 5 | Review | Rate Good → next | 0.095 |
| 2 | Review | Rate Good → next | 0.092 |
| 1 | Review | Rate Good → next | 0.092 |
| 1 | Review | Rate Again → next | 0.091 |
| 5 | Review | Rate Good → next | 0.090 |
| 2 | Review | Rate Again → next | 0.090 |
| 2 | Review | Rate Good → next | 0.089 |
| 5 | Review | Rate Good → next | 0.089 |
| 1 | Read | Open Values Guide | 0.076 |

## Test environment and handoff

Tested the supplied release build under its release CSP in the existing WebKit service, at 1280 × 800 and 2× screenshot scale. Used one owned browser context, at most two pages, and closed that context after preserving the final end screen. No servers or browsers were launched or stopped. Scripts and evidence were written only under `codex-out/owner/`; app actions changed only the assigned scratch library. No code fix, build, test-suite run, commit or push was performed for this findings-only task.

Existing/shared worktree changes were left alone. At handoff Git listed `apps/desktop/e2e/journeys/phone-review.ts`, `apps/desktop/scripts/mac-load.ts`, and `docs/reviews/2026-11-26-simulated-learner-3x/`; this tester did not write them.
