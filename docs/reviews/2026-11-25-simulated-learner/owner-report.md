# Owner — five-day Mac learner run

Tested commit `63c9b83` through the supplied release-CSP WebKit page, 1280×800 at 2×, on the owner copy (67 sources, 38 exercise files initially). Played Days 1, 2, 3 and 5 in order and skipped Day 4: 20 saved ratings, four book highlights and a note, URL import, reading-position recovery, Finish/quiz, five AI exercise drafts, passage tutor, library-wide question, exercise editing/deletion/Undo, skill page and end-screen receipts. **Two usability findings; no observed data loss or crash. This is not a valid five-calendar-day scheduling test:** `page.clock` moved the browser through Nov 25–29, but the CLI kept Nov 25 for due dates, caps and receipts. Day 3's normal queue ended early; Day 5 used the ordinary “Review this source” action to inspect the new drafts. Missed-day scheduling and the one-in-five mix remain unverified. Skipped iPhone, visual taste, native shell behavior, deliberate failure injection and unrelated known issues. Repository files were not changed; scratch-library changes were made through the app only.

## Findings

### 1. Home and the end screen give the wrong reason new exercises wait — S2 · Mac

1. On a fresh page using the resulting owner copy, open Home. The copy has more waiting drafts than its configured ten-new-exercise daily limit.
2. Read the sentence below the minutes: “A few start each day, as your goal leaves room.”
3. End a review after exhausting eligible exercises; the same explanation appears on the end screen.

**Expected:** Explain the daily new-exercise limit, or say that new material joins due reviews each day. A learner with a due backlog should not infer that new material requires spare goal time.

**Actual:** Both screens describe the superseded “only if the goal has room” behavior. The comment beside the displayed string repeats that old rule, while the queue reserves every fifth position for new exercises while due ones last. This matters after finishing an article: it suggests that doing more due review can crowd out the new material indefinitely.

**Reproduced:** On Day 3 Home/end, Day 5 Home/end, and a fresh page set to real time; at least two independent openings. This is a wording finding, not a claim that the clock-mismatched queue scheduled incorrectly.

**Evidence:** [Day 3 end](day3-review-end.png), [Day 5 Home](day5-home.png), [fresh-page Home](waiting-copy-fresh-real-date.png), [final end](day5-final-end.png).

**Suspected code:** `apps/desktop/src/Home.tsx:641–642`; compare `packages/core/src/study.ts:157–165` and `:186`. No matching existing finding found.

### 2. Prequestions and quiz feedback display Markdown syntax literally — S3 · Mac

1. Open the imported **Async/await** article (`01M89HVDXCRGZXNX25XQV20EH6`), before finishing it, and expand “What do you already know?”
2. Read prequestion 2: “How does waiting for a network response with `await` affect the rest of a web page’s JavaScript?”
3. Finish the source, answer the quiz, and inspect question 2 and the final “On your recall” feedback.

**Expected:** Render code terms as inline code, as the source body and review exercise renderer already do.

**Actual:** Backticks remain visible in the prequestion, quiz question, and AI feedback. The feedback also exposes backticks around `try/catch`, `.then()` and `Promise.all`. For programming study this makes prose and actual syntax less clear. It is a small recurring reading interruption, not a failed answer or lost data.

**Reproduced:** Reader on Days 1 and 2, quiz and feedback on Day 3. Existing generated content reproduces deterministically; a new import's AI wording may differ. The affected object is prequestion 2, not an FSRS exercise ID.

**Evidence:** [Reader prequestions](day2-prequestions.png), [quiz question](day3-quiz-raw-markdown.png), [recall feedback](day3-quiz-done.png).

**Suspected code:** `apps/desktop/src/Reader.tsx:4357`; `apps/desktop/src/Finish.tsx:497`, `:578`, `:668` insert plain strings. No matching existing finding found.

## Known rows encountered

- **F198, duplicate AIMA imports:** The owner still has both chapter imports. Their rational-agent/limited-computation material repeats. I retired `01M78B5FPC50C89GP1EGNQ1JE2` as redundant with the filming-schedule exercise already reviewed (`01M73GRQKZYRGP028GZX14EHBT`). This is the known owner-data issue, not a new regression. The deleted file is retained with `state: retired`; Undo restored it and Redo retired it again.
- **F649, publisher pages:** The existing Melanie Mitchell EPUB still opens on newsletter/copyright pages, shown in [the book screenshot](day1-book-loaded.png). **Not re-reported:** D354 explicitly requires Reimport for older books; this copy lacks the new front-matter marker. I did not reimport it.
- No confirmed recurrence of another fixed row. Known F14 was not elevated into a new finding.

## What passed

- Correct Explain answer received 3/3, wrong answer 0/3; the learner selected the recorded rating. A half-right API answer was self-rated Hard while grading continued.
- Missed Fact `01M6JBPBM5X7ZDRC0SNMRYC13Y` returned after three intervening exercises as **Again**, without **New**; the missed ANI/AGI Explain also returned.
- Esc preserved all five Day 2 ratings and the unfinished sixth answer; the exact text returned on Day 3.
- Four book highlights (17, 55, 141 and 198 characters in the saved records), one Key point and its note persisted.
- Async/await imported with four section headings and code fences; the saved reading place reopened at **Await** on Day 2.
- Recall, all four quiz answers, confidence and use/connection note saved; Finish put the source in Done.
- Day 1 import produced prequestions, not exercises; five drafts completed after Day 3 Finish with `codex`, `gpt-6.2-sol`, `enrich@17`, and all appeared as New in the later source-only session.
- Passage tutor explained await correctly and explicitly separated its CPU-loop explanation from the source. Library-wide answer used the saved Learning Science and prompt-writing sources.
- Edited `01M78B5FP916SGKTVYW1TCT2BR` reopened with the new question; delete/Undo/Redo changed the redundant exercise's saved state correctly.
- No page exceptions; no material unanswerable or broken passage found among the exercises actually presented. The old duplicate topic is listed above; the raw-Markdown issue affects reader/quiz text.

## File and number audit

All new review records have **real date Nov 25**. Dates below are harness days, not saved calendar dates. [audit.json](audit.json) contains every rated ID, rating, elapsed time, next due date and session receipt; [day5-final-files.json](day5-final-files.json) preserves the final exercise/review files read for this check.

| Harness day | Saved ratings | Counted review time | First-answer memories kept | Receipt memory gain |
|---|---:|---:|---:|---:|
| 1 | 9 | 657,799 ms / 10:58 | 5 | +42 days |
| 2 | 5; sixth interrupted | 140,328 ms / 2:20 | 4 | +9 days |
| 3 | 1; queue exhausted | 85,172 ms / 1:25 | 1 | +0 rounded days |
| 4 | 0 | 0 | — | — |
| 5, source-only | 5 | 621,409 ms / 10:21 | 5 | +12 days |

The final **25 minutes** is `round(1,504,708 / 60,000)`, the shared real-day total. The final **5 memories kept** matches five unique first answers rated Good. Each new article exercise gained stability 2.3065 days: `round(5 × 2.3065) = 12`, matching **+12 days of memory**. Its row has five rough stones and no new cut gem. The Web Development page shows **0 cut gems, Lv 0, 5 to level 1**, consistent with all five stabilities below the 21-day solid threshold ([skill screenshot](day5-skill-after.png)). The **14 waiting exercises** matches 43 retained exercise files minus 12 retired minus 17 reviewed live exercises. No streak, penalty or lost level appeared, but a real missed-day rollover was not tested.

Read `review-session.ts` and `Lap.tsx`: time is added on rating, capped at three minutes per exercise; the ring counts the day's minutes and continues through bonus laps. The primary page remained on the final end screen through the audit; the second page used to inspect the skill was then closed.

## Where the minutes went

Counted review time includes deliberately advanced clock time. Actual request timings below use Node `performance.now()` and stay independent of that clock. Reading and maintenance time were not separately metered; reporting precise reading/lost minutes would invent measurements. Tool-selector timeouts are automation overhead, not app delays.

| Day | Review | Reading / adding | Measured waits | Lost |
|---|---|---|---|---|
| 1 | 10:58 | Book reading + 4 highlights/note; article added. Reading duration not isolated. | Import 1.46 s; import-to-prequestions 21.39 s from file timestamps; correct/wrong grading about 11.5/9.4 s. | No data lost. Old book's publisher pages required navigation; duration not isolated. |
| 2 | 2:20 rated, interrupted sixth within the short visit | Reopened article at saved place. | Wrong-answer check 8.38 s; two other grading jobs 10.62/7.35 s continued after moving on. | No work lost; raw syntax repeated. |
| 3 | 1:25; full ten-minute daily queue unavailable | Read remaining sections; recall + 4-question quiz; two tutor questions; edit/delete. | Key-point preparation 32.25 s, recall feedback 15.54 s, four checks 25.86 s total, tutors 37.97 s total, drafting 45.92 s. Several overlapped reading. | No data lost. Code read needed to resolve the waiting explanation and old-book behavior; time not isolated. |
| 4 | 0 | Missed | 0 | 0 |
| 5 | 10:21 in source-only review | Skill and receipt audit | First two completed checks 10.91/13.42 s; remaining jobs listed below. | No data lost. Normal queue/calendar claims blocked by setup. |

## Felt slow

Every recorded wait of at least one second is below, slowest first. **CLI rows measure the request, not necessarily time blocked:** grading can finish after a learner rates; drafting runs in the background; key-point preparation overlaps recall entry. The corresponding `D… Check` row can measure the same request plus UI work and must not be added to it. Day 1's half-right row ends when I moved on, not when its feedback arrived. The first correct-grade observation is an upper bound of 11.55 s (bridge reply arrived about 0.62 s earlier). Full subsecond and request timings are in [timings.md](timings.md); raw timing and bridge evidence is in [events.jsonl](events.jsonl). No confirmed wait over one second with a completely absent wait indication was found.

| Day | Action / request | Duration |
|---|---|---:|
| 3 | CLI enrich 01M89HVDXCRGZXNX25XQV20EH6 | 45.92 s |
| 3 | CLI key-points 01M89HVDXCRGZXNX25XQV20EH6 | 32.25 s |
| 3 | CLI tutor The passage says await suspends the function without costing CPU resources. Why can the page still respond to clicks, and would await make a slow CPU-heavy loop stop blocking the page too? | 19.85 s |
| 3 | CLI tutor Across my saved learning sources, why is trying to recall an idea before rereading useful, and why should spaced practice revisit the same underlying knowledge? | 18.12 s |
| 3 | CLI recall 01M89HVDXCRGZXNX25XQV20EH6 | 15.54 s |
| 5 | D5 Check How can JavaScript code get a plain valu | 13.42 s |
| 5 | CLI grade 01M89J6V37P96RARM7W23D4S6B | 13.37 s |
| 1 | D1 grade completion | 11.55 s |
| 5 | D5 Check Your creator dashboard loads analytics a | 10.91 s |
| 2 | CLI grade 01M73GSRZSGD0EZDKD8D0DAN3Q | 10.62 s |
| 5 | CLI grade 01M89J6V38TA6KQXG769VQA793 | 10.59 s |
| 1 | D1 wrong grading complete | 9.39 s |
| 1 | D1 half-right grading | 9.38 s |
| 5 | CLI grade 01M89J6V38TA6KQXG769VQA792 | 8.53 s |
| 2 | D2 Check Your AI editor is told to maximize audie | 8.38 s |
| 3 | D3 Check Your AI editor is told to maximize audie | 8.38 s |
| 3 | CLI grade 01M73GRQKZYRGP028GZX14EHBW | 8.18 s |
| 2 | CLI grade 01M73GSRZTKA0CTCCAYKHF480J | 7.35 s |
| 5 | CLI grade 01M89J6V38TA6KQXG769VQA791 | 7.12 s |
| 3 | CLI check 01M89HVDXCRGZXNX25XQV20EH6 | 6.84 s |
| 5 | CLI grade 01M89J6V37P96RARM7W23D4S6C | 6.79 s |
| 3 | CLI check 01M89HVDXCRGZXNX25XQV20EH6 | 6.54 s |
| 3 | CLI check 01M89HVDXCRGZXNX25XQV20EH6 | 6.35 s |
| 3 | CLI check 01M89HVDXCRGZXNX25XQV20EH6 | 6.13 s |
| 1 | D1 URL import | 1.46 s |
| 3 | D3 Done finish | 1.33 s |

The main synchronous controls were quick: first exercise ready in 350 ms; the measured rating transitions were approximately 74–116 ms. The 46 ms reader measurement stops at the reader container, before the full book painted, so it is not a full-content-ready claim.
