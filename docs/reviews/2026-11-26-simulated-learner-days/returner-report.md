# Returner — seven calendar days in the owner’s library

Used the supplied Mac release page in WebKit at 1280×800 and 2×, on checkout `d07f87b6ea260e82673138c6e324ffa01a6d7249`. Played November 26–December 2 in order, reviewed on Days 1–4 and 7, and stayed out of Ore on Days 5 and 6. Completed **27 ratings**, correct/partial/wrong Explain answers, same-day retries, two interruptions, two plain highlights and one Key point, a source’s recall/quiz/Done flow, and file checks of queues, dates, minutes, receipts and a skill page. **One new S2 finding; no observed loss of answers or ratings, crash, or blocked daily loop.** Skipped iPhone, native shell integrations, imports, maintenance sweeps and visual taste. The native video player is unavailable in this browser bridge, so I read the saved transcript. Only `codex-out/returner/` contains tester-written files; library changes went through the app. The one owned browser context is closed, and the driver has exited.

## Findings

### 1. Resuming an unfinished answer keeps the words but loses its earlier review time

**S2 · Mac · reproduced on two different exercises, Days 2 and 7.** This undercounts the daily goal after an ordinary interruption and asks the learner to spend extra time to reach it. It is separate from F730: time away was correctly excluded here; foreground time **before leaving** was lost.

From a fresh Mac page connected to an owner-library copy with an eligible Explain exercise:

1. Open Home → Start review → Start review.
2. Begin a real answer. Spend about 70 seconds thinking/typing, keeping the combined before-and-after time below three minutes. In this run, `page.clock.setSystemTime` advanced this interval without freezing timers.
3. Press Esc. If a session ending appears, choose Done. Spend some time outside Review.
4. Start review again. The same exercise and exact draft return.
5. Complete the answer, Check, and rate it. Compare the rating’s `elapsed_ms` in the review log with the two periods spent answering. Finish the session and inspect Home.

**Expected:** when that answer is finally rated, count both active periods, exclude the time away, and apply the existing three-minute cap to their combined total.

**Actual:** only the time after reopening is recorded. The draft’s text and confidence survive, but its earlier clock does not.

| Reproduction | Exercise | Before Esc | Saved after reopening |
|---|---|---:|---:|
| Day 2 | `01M73GRQKZYRGP028GZX14EHBT` — filming schedule | At least 20,000 ms, deliberately advanced while answering | 96,848 ms, including an 80,000 ms advance after reopening |
| Day 7 | `01M6JBPBM5X7ZDRC0SNMRYC13Y` — recursive improvement, shown as a captioning-checklist remix | **70,016 ms measured between the pre-interruption markers**, plus earlier uncounted foreground time | **50,805 ms** |

Day 7’s two measured parts alone total **120,821 ms**, comfortably below the 180,000 ms cap. The final day records **632,613 ms** and displays **11 minutes**. Preserving even the measured 70,016 ms would make it at least **702,629 ms**, which would display **12 minutes** using the same rounding. The ending and Home agree with the file; the file already undercounts the work.

**Evidence:** [Day 2 restored draft](day2-resumed.png), [Day 7 before leaving](day7-interrupt-before.png), [Home after leaving](day7-interrupt-home.png), [restored draft](day7-interrupt-resumed.png), [final ending](day7-end.png), [final Home/week](day7-week-final.png), [timing and saved rating](interruption-audit.json), [all saved ratings](review-audit.md).

**Suspected cause:** `apps/desktop/src/Review.tsx:70` and `:78` persist only text, confidence and question identity. Restoring those fields at `:292` is followed by `s.clock()` at `:295`, which resets elapsed time to zero. `apps/desktop/src/review-session.ts:355` accepts elapsed time but defaults to zero. No repository file was changed.

## Calendar and queue checks

The seed contained **67 sources (23 unarchived), 38 exercise files, 11 retired exercises, 25 unseen exercises, and only two previously reviewed exercises due**. This is not a permanent large due backlog. A high new-exercise share on Days 1–3 is therefore not evidence that mixing is broken.

| Day | Date | Due at 08:00 from files | Unseen at prediction | Ratings / newly approved | Saved review time | Settled ending / Home |
|---|---|---:|---:|---:|---|---|
| 1 | Nov 26 | 2 | 25 | 10 / 5 | 10:29.745 | 10 min; goal met |
| 2 | Nov 27 | 0 | 20 | 6 / 6 | 10:24.294 | 10 min; goal met |
| 3 | Nov 28 | 0 | 14 | 1 / 1 | 2:56.037 | 3 min; goal not met |
| 4 | Nov 29 | 4 | 13* | 5 / 1 | 10:12.246 | 10 min; goal met |
| 5 | Nov 30 | Not opened | — | 0 / 0 | 0 | Missed |
| 6 | Dec 1 | Not opened | — | 0 / 0 | 0 | Missed |
| 7 | Dec 2 | 12 | 17 | 5 / 1 | 10:32.613 | 11 min; bonus dots visible |

`*` The Day 4 prediction was captured before two background highlight drafts landed. They are dated Day 3. They did not displace the older drafts selected by that morning’s ten-new limit. Final library count is **43 exercise files**. Due means due at the actual morning time, not any time later on that calendar date.

- **Day 2 prediction matched:** none of the previously reviewed exercises was due at 08:00. Its six presented new exercises matched the predicted order in [day2-new-order.json](day2-new-order.json). Esc returned to the filming question with the exact unfinished answer.
- **Day 3 stayed partial:** Home said 3 of 10. On Day 4, Saturday’s hover still said **Saturday · 3 min**, and the week had only the two earlier met days. [Yesterday evidence](day4-yesterday-verified.png).
- **Day 4 mixing matched:** the four due IDs were API architecture, recursive improvement, ANI/AGI/ASI and the three AGI routes; the fifth exercise was new. The actual queue and ratings agree.
- **Day 7 return matched:** 12 due plus 10 eligible new exercises gave **22 queued**, with another seven unseen waiting beyond today’s allocation. Home asked for the normal ten minutes, with no catch-up quota, loss warning, guilt copy or streak reset. After five ratings, 17 remained available.
- **Source completion dates are distinct:** two exercises came from the Day 1 highlights, dated **Nov 28**; the three Finish exercises were created **Nov 29 at 16:18:24 UTC**, after the source became Done at **16:17:25 UTC**. Those three are excluded on their creation day and eligible from **Nov 30**. Days 5–6 were deliberately not opened, so their eligibility date is a file/code check, not a claim to have viewed those days’ queues.
- **Recently finished material got its places:** Day 7’s queue put the talk’s two highlight exercises at **5 and 10**, and its three Finish exercises at **15, 16 and 17**. Twelve due exercises fill positions 1–14 around the first two new ones; once due work runs out, remaining new exercises follow. I actually answered position 5; positions 10–17 are confirmed by the queue response, not rated in this ten-minute session.
- **Real dates worked:** ratings, session starts/ends and next-due states followed the page’s dates. F739 did not recur. All 27 IDs, timestamps, ratings and next-due dates are in [review-audit.md](review-audit.md); the presented queue orders are in [queue-audit.md](queue-audit.md).

## Ending, week and skill agreement

The end screen’s rounded minutes matched the capped sum of saved ratings on every review day. It did not force Review closed at ten minutes. Day 7’s **11-minute** ring included the white bonus dots; the undercount described above originates in the interrupted exercise, not in the ring calculation.

| Day / session | Ending results | File check |
|---|---|---|
| Day 1 | 4 memories kept, +41 days | Matches its session receipt; first answers rated Hard or better account for four kept memories; later retries are not additional first-answer wins |
| Day 2, first burst | 1 kept, +2 days | Saved separately when Esc ended that burst |
| Day 2, resumed burst | 5 kept, +12 days | Matches second receipt; ending’s minutes include both bursts |
| Day 3 | 1 kept, +2 days | Matches receipt; 176,037 ms stays below the goal |
| Day 4 | 5 kept, +17 days | Matches receipt |
| Day 7 | 5 kept, +54 days | Matches receipt; total minutes include only recorded review time |

Home’s week rolls over on Monday. The final week, **Nov 30–Dec 6**, correctly shows **1 of 7 days met**: the two missed days have zero recorded minutes and unfilled day dots; Wednesday is 11 min. The previous week’s Nov 26, 27 and 29 met days and Nov 28 partial day remain in the files. This is not a claim that only one of the whole seven-day journey’s days was met. [Monday’s 0-minute hover](day7-missed-monday.png), [current week](day7-week-final.png). The attempted Tuesday hover screenshot retained Monday’s tooltip, so Tuesday’s zero is verified from the files and unfilled day dot, not that tooltip.

Computer Science shows **Lv 0 and one cut gem**. Its API-interface exercise has stability **28.7756461 days**, the only one in that skill above the **21-day** solid threshold. Its JSON exercise is **18.1678499**, API architecture **8.04317602**, and record-ID exercise **2.3065**. One peak gem gives level `floor(sqrt(1/5)) = 0`. Nothing reset because of the missed days. [Skill page](day7-skill.png). Receipt checks establish agreement with saved scheduling results, not independent validation of FSRS’s scientific predictions.

## Known rows and scope limits

- **No fixed row was confirmed to have returned.**
- **F198:** the owner copy still contains both AIMA imports. Overlapping rational-agent material was encountered across them. This is the existing library duplication, not a new finding; I did not retire or archive anything.
- **F14:** long revealed answers can require scrolling to the ratings. They remained reachable; no worse behavior was established.
- **F730:** time outside Review was excluded. The new finding concerns dropping earlier foreground time after a complete Esc/restart, not continuing to count background time.
- **F731/F732/F741/F742:** no stale “as your goal leaves room” explanation or raw Markdown was seen in the encountered exercise/quiz fields. Recall feedback succeeded after the quiz. [Finish feedback](day4-finish-ready.png).
- **F194:** the three-routes exercise initially shows the introductory passage “Here are the three most common strategies I came across.” Its additional-passage controls were not fully exercised, so this is not evidence that the fixed multi-passage bug returned.
- The first Finish quiz answer was saved without a saved check: I chose Next while key points were still being found. The two questions whose results I waited for have checks. This was not reproduced twice and is an observation in the log, not a finding.
- No newly encountered exercise was demonstrably unanswerable. The Day 7 captioning remix was self-contained and clearly named its original idea. Minor strictness in AI marking was not classified as a defect; the learner could choose the recorded rating.
- Pure visual taste, the preamble’s excluded known issues, native playback and iPhone were outside this run. No artificial write failures were injected.

## What passed

- Every rating saved immediately with the learner’s chosen rating, calendar date, elapsed value and next-due state.
- Correct, half-right and wrong Explain answers received usable feedback; the learner selected the recorded rating.
- All three Day 1 misses returned in the same session; the return was labeled Again without New.
- Esc preserved the question and exact unfinished text on both interruptions.
- The two highlights and one Key point survived reopening; Day 4’s reader showed 2 Highlights and 1 Key point.
- Recall and all three quiz answers saved; the source became Done and five total new exercises were retained across highlight drafting and Finish.
- Reading and Finish did not inflate review minutes.
- The four-due/one-new mix held on Days 4 and 7; fresh source exercises occupied the expected queue places.
- Goals, partial days and missed days followed the new dates; the goal stayed ten minutes.
- End receipts, Home’s current week and the Computer Science gem/level agreed with canonical files.
- No captured page exception, lost rating or lost answer text occurred.

## Where the minutes went

Review totals are saved active time, including **deliberately advanced thinking intervals** and real foreground inspection time, capped at three minutes per rated exercise. They are not human-speed measurements. AI wait totals below are wall time and overlap review/reading; do not add them to those columns. No sources were added. Unmetered inspection time is not estimated.

| Day | Review credited | Reading / Finish | Adding | Measured AI feedback waits | Lost |
|---|---|---|---|---|---|
| 1 | 10:29.745 | Transcript visit; the highlight burst alone was timed at 15.9 s. Whole reading visit was not isolated | 0 | Six Explain checks: 62.4 s total | No confirmed loss |
| 2 | 10:24.294 | None | 0 | Five Explain checks: 60.0 s | At least 20 s of pre-Esc answering omitted; four minutes away correctly excluded |
| 3 | 2:56.037 | None | 0 | One Explain check: 14.9 s | No confirmed loss |
| 4 | 10:12.246 | 2:04.9 wall time from reopening to Done, plus 5:00 simulated reading; includes quiz waits | 0 | Review checks 42.1 s; measured quiz feedback waits 37.3 s. Key points 51.1 s, recall feedback 17.3 s and drafting 58.4 s ran partly/entirely in the background | No confirmed lost text; first quiz check was not awaited |
| 5 | 0 | Missed | 0 | 0 | 0 |
| 6 | 0 | Missed | 0 | 0 | 0 |
| 7 | 10:32.613 | Skill/week audit only | 0 | Four Explain checks: 44.1 s | At least 70.016 s of pre-Esc answering omitted; two minutes away correctly excluded |

## Felt slow

The longest process was the **58.4-second background exercise drafting** after Finish; it did not block return to the reader. Key-point preparation took **51.1 seconds**, partly overlapping recall/answers. The longest measured foreground answer wait was **31.4 seconds** in the Finish quiz. Review feedback ranged from **8.4 to 14.9 seconds**. Checking/finding labels appeared; I did not confirm a repeated blank wait over one second. Rating-to-next-question transitions ranged from **93 to 245 ms**. Picker-to-question transitions after the initial session were around **0.84–0.86 seconds**.

The table below includes every measured UI action, slowest first, plus the important background AI processes. Click-only rows overlap the enclosing Check/transition measurement. “Recall feedback already ready” measures a readiness check, not the 17.3-second AI request. The first quiz’s short Check measurement ended at a **pending** result, not completed feedback. Raw request timings and responses are in [events.jsonl](events.jsonl); [timings.md](timings.md) is the standalone UI timing ledger.

| Day | Action | ms |
|---:|---|---:|
| 4 | Background enrich request (overlaps UI) | 58435 |
| 4 | Background key-points request (overlaps UI) | 51072 |
| 4 | Finish question 2 to checked feedback | 31442 |
| 4 | Background recall request (overlaps UI) | 17265 |
| 3 | Explain feedback | 14901 |
| 7 | Explain feedback | 12413 |
| 2 | Explain feedback | 12400 |
| 2 | Explain feedback | 12396 |
| 2 | Explain feedback | 12391 |
| 1 | Explain feedback | 11886 |
| 4 | Explain feedback | 11875 |
| 7 | Explain feedback | 11433 |
| 2 | Explain feedback | 11428 |
| 4 | Explain feedback | 11413 |
| 1 | Explain feedback | 11395 |
| 2 | Explain feedback | 11387 |
| 7 | Explain feedback | 10909 |
| 4 | Explain feedback | 10396 |
| 1 | Explain feedback | 10393 |
| 1 | Day1 correct Explain check | 9923 |
| 1 | Day1 partial Explain check | 9408 |
| 1 | Day1 wrong Explain check | 9395 |
| 7 | Explain feedback | 9372 |
| 4 | Explain feedback | 8386 |
| 4 | Finish question 3 checked feedback | 5852 |
| 4 | Finish Done to reader | 1324 |
| 2 | picker to usable question | 863 |
| 4 | picker to usable question | 855 |
| 3 | picker to usable question | 852 |
| 2 | picker to usable question | 850 |
| 7 | picker to usable question | 840 |
| 7 | picker to usable question | 836 |
| 1 | initial Home usable | 657 |
| 3 | day 3 reload Home usable | 353 |
| 1 | Day1 picker to question usable | 342 |
| 4 | day 4 reload Home usable | 335 |
| 2 | click Done | 304 |
| 4 | Day4 resume transcript | 289 |
| 4 | Finish Q1: Check to pending result (not feedback) | 246 |
| 1 | click No idea | 245 |
| 2 | rate Good to next exercise | 245 |
| 2 | day 2 reload Home usable | 240 |
| 7 | Day7 return Home usable | 239 |
| 2 | rate Good to next exercise | 224 |
| 7 | rate Good to next exercise | 222 |
| 4 | Finish Continue to first question | 217 |
| 2 | rate Good to next exercise | 211 |
| 4 | rate Good to next exercise | 195 |
| 2 | rate Good to next exercise | 193 |
| 4 | rate Good to next exercise | 192 |
| 3 | rate Good to next exercise | 190 |
| 4 | rate Good to next exercise | 189 |
| 2 | rate Good to next exercise | 186 |
| 4 | rate Good to next exercise | 181 |
| 2 | rate Good to next exercise | 179 |
| 4 | rate Good to next exercise | 176 |
| 7 | rate Good to next exercise | 175 |
| 7 | rate Good to next exercise | 162 |
| 7 | rate Good to next exercise | 161 |
| 1 | open TED transcript usable | 155 |
| 7 | rate Good to next exercise | 153 |
| 1 | rate Good to next exercise | 116 |
| 1 | rate Good to next exercise | 107 |
| 1 | rate Hard to next exercise | 106 |
| 1 | rate Again to next exercise | 105 |
| 1 | rate Good to next exercise | 104 |
| 1 | rate Again to next exercise | 102 |
| 1 | rate Good to next exercise | 101 |
| 1 | rate Again to next exercise | 95 |
| 1 | rate Good to next exercise | 95 |
| 1 | rate Good to next exercise | 93 |
| 1 | click Start review | 74 |
| 4 | click Done | 71 |
| 1 | click Home | 66 |
| 4 | click Check | 64 |
| 7 | click Check | 62 |
| 7 | click Home | 62 |
| 4 | click Check | 59 |
| 2 | click Done | 58 |
| 7 | open Computer Science skill | 58 |
| 3 | click Done | 57 |
| 1 | click Check | 55 |
| 7 | click Done | 54 |
| 1 | click Done | 54 |
| 4 | click Finish | 54 |
| 2 | click Start review | 53 |
| 1 | click All sources | 53 |
| 4 | click Check | 51 |
| 4 | click Check | 51 |
| 1 | click Check | 51 |
| 3 | click Start review | 51 |
| 2 | click Check | 50 |
| 4 | click Start review | 48 |
| 2 | click Check | 47 |
| 3 | click Leave review | 46 |
| 2 | click Start review | 45 |
| 4 | click Leave review | 45 |
| 2 | click Leave review | 44 |
| 1 | click Leave review | 43 |
| 7 | click Check | 42 |
| 7 | click Start review | 41 |
| 2 | click Check | 40 |
| 2 | click Check | 40 |
| 3 | click Check | 40 |
| 4 | click Next question | 39 |
| 1 | confidence Sure | 39 |
| 1 | click Check | 39 |
| 4 | click Done | 39 |
| 4 | click Check | 38 |
| 4 | click Continue | 38 |
| 2 | click Check | 38 |
| 7 | click Leave review | 38 |
| 1 | click Check | 37 |
| 4 | click Next | 37 |
| 7 | click Check | 37 |
| 1 | click Check | 36 |
| 7 | click Start review | 35 |
| 4 | click Next question | 35 |
| 1 | click Check | 35 |
| 7 | click Check | 35 |
| 4 | click Check | 33 |
| 4 | click Check | 31 |
| 4 | click Home | 23 |
| 2 | Escape to ending | 8 |
| 4 | Recall feedback already ready: readiness check | 3 |

Evidence index: [friction log](log.md) · [review audit](review-audit.md) · [queue audit](queue-audit.md) · [final file-derived audit](final-audit.json) · [final canonical-file snapshot](final-files.json).
