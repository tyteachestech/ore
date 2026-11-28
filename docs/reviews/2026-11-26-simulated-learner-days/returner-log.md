# Returner friction log

Mac release WebKit, 1280×800 at 2×. Day 1 = November 26; Day 7 = December 2. One context and one page. All library writes use the app. Wall timings use Node performance.now; deliberate clock advances are recorded separately. Automation selector failures are excluded from learner friction. Review clocks also include real foreground time spent inspecting answers.

Baseline: 67 sources, 23 unarchived; 38 exercise files, 11 retired, 25 unseen, two previously reviewed and due. This is a real copy, not an artificially large due backlog. FSRS state is reconstructed from review logs, not written into exercise Markdown.

- Day 1 · Open · Home became usable in 657 ms; initial opening was visible, no repeated silent wait established.
- Day 1 · Review · Start review opens a picker; picker confirmation to first usable question took 342 ms (two presses total from Home).
- Day 1 · Review · Correct Explain feedback took 9,923 ms; Checking your answer was visible. The three points were marked correctly; I choose Good independently.
- Day 1 · Review · Partial API answer took 9,408 ms to check; 2/4 key points and Hard fit the answer.
- Day 1 · Review · Wrong ANI/AGI/ASI answer took 9,395 ms; all 3 points were correctly missed.
- Day 1 · Read · Video player unavailable in this supplied browser bridge; transcript remained readable. Two highlights and one Key point saved. Playback excluded as setup limitation.
- Day 2 · Open · Day 2 prediction from saved files: no reviewed exercise is due at 08:00; 20 unseen remain, with up to 10 available. Home resets to 0/10. Thus today cannot test one-in-five mixing against due work.
- Day 2 · Review · Esc ended the first burst, Done returned Home, and a four-minute interruption did not count toward review. Restart restored the same filming question and exact partial answer; picker-to-question took 850 ms.
- Day 2 · Close · Day 2 completed six new exercises in predicted order; goal met and review continued. All reviewed exercises had future due dates, so no due/new ratio was applicable.
- Day 3 · Close · Short Day 3: one answer, about three minutes, then left. Home should retain the partial day, not call it met.
- Day 4 · Review · Day 4 served the four predicted due IDs, then one New exercise at position 5. Three routes passage begins with a short introductory line; navigation to additional saved highlights remains to check.
- Day 4 · Read · Finish key-point preparation took 51.1 s in the background. Question 2 then needed 31,442 ms from Check to usable feedback; Finding the key points and Checking your answer told me why. First-question 246 ms timing was only transition to a pending result, not completed feedback.
- Day 4 · Read · Finish succeeded: recall feedback arrived after the quiz, source moved to Done, and three finish exercises drafted in 58.4 s. Two additional exercises had already been drafted from Day 1 highlights on Day 3. These are different creation dates, not five drafts from Finish.
- Day 5 · Cue · Missed: did not open Ore or review.
- Day 6 · Cue · Missed: did not open Ore or review.
- Day 7 · Review · Confirmed interruption timing loss a second time: the draft survived, but at least 70,016 ms spent before Esc disappeared. Rating saved only 50,805 ms after reopening; both parts together were below the 180,000 ms cap. Day 2 showed the same reset after at least 20 s before Esc.

## Recorded wait moments

All actions below exceeded 100 ms to their measured endpoint. An entry is friction evidence, not automatically a bug or a claim of absent feedback. Timing includes Playwright actionability. Check buttons usually reacted in 31–64 ms before the longer visible AI wait. Nested click measurements remain in timings.md.

- Day 1 · Open · initial Home usable: 657 ms to the named endpoint; wall measurement 2026-11-27T01:38:39.045Z.
- Day 1 · Open · Day1 picker to question usable: 342 ms to the named endpoint; wall measurement 2026-11-27T01:39:59.266Z.
- Day 1 · Review · Day1 correct Explain check: 9923 ms to the named endpoint; wall measurement 2026-11-27T01:40:37.565Z.
- Day 1 · Review · rate Good to next exercise: 107 ms to the named endpoint; wall measurement 2026-11-27T01:40:46.692Z.
- Day 1 · Review · rate Good to next exercise: 101 ms to the named endpoint; wall measurement 2026-11-27T01:41:00.166Z.
- Day 1 · Review · Day1 partial Explain check: 9408 ms to the named endpoint; wall measurement 2026-11-27T01:41:09.848Z.
- Day 1 · Review · rate Hard to next exercise: 106 ms to the named endpoint; wall measurement 2026-11-27T01:41:19.665Z.
- Day 1 · Review · rate Again to next exercise: 102 ms to the named endpoint; wall measurement 2026-11-27T01:41:19.998Z.
- Day 1 · Review · Day1 wrong Explain check: 9395 ms to the named endpoint; wall measurement 2026-11-27T01:41:29.639Z.
- Day 1 · Review · rate Again to next exercise: 105 ms to the named endpoint; wall measurement 2026-11-27T01:41:48.547Z.
- Day 1 · Review · Explain feedback: 10393 ms to the named endpoint; wall measurement 2026-11-27T01:42:09.300Z.
- Day 1 · Review · rate Good to next exercise: 104 ms to the named endpoint; wall measurement 2026-11-27T01:42:09.407Z.
- Day 1 · Review · Explain feedback: 11395 ms to the named endpoint; wall measurement 2026-11-27T01:42:39.425Z.
- Day 1 · Review · rate Good to next exercise: 116 ms to the named endpoint; wall measurement 2026-11-27T01:42:39.549Z.
- Day 1 · Review · Explain feedback: 11886 ms to the named endpoint; wall measurement 2026-11-27T01:42:59.569Z.
- Day 1 · Read · open TED transcript usable: 155 ms to the named endpoint; wall measurement 2026-11-27T01:43:19.527Z.
- Day 2 · Open · day 2 reload Home usable: 240 ms to the named endpoint; wall measurement 2026-11-27T01:44:28.199Z.
- Day 2 · Open · picker to usable question: 863 ms to the named endpoint; wall measurement 2026-11-27T01:44:40.742Z.
- Day 2 · Review · Explain feedback: 12396 ms to the named endpoint; wall measurement 2026-11-27T01:44:59.420Z.
- Day 2 · Review · rate Good to next exercise: 186 ms to the named endpoint; wall measurement 2026-11-27T01:44:59.611Z.
- Day 2 · Open · picker to usable question: 850 ms to the named endpoint; wall measurement 2026-11-27T01:45:08.480Z.
- Day 2 · Review · Explain feedback: 11428 ms to the named endpoint; wall measurement 2026-11-27T01:45:24.950Z.
- Day 2 · Review · rate Good to next exercise: 179 ms to the named endpoint; wall measurement 2026-11-27T01:45:25.133Z.
- Day 2 · Review · Explain feedback: 12400 ms to the named endpoint; wall measurement 2026-11-27T01:45:48.016Z.
- Day 2 · Review · rate Good to next exercise: 211 ms to the named endpoint; wall measurement 2026-11-27T01:45:48.232Z.
- Day 2 · Review · Explain feedback: 12391 ms to the named endpoint; wall measurement 2026-11-27T01:46:01.247Z.
- Day 2 · Review · rate Good to next exercise: 224 ms to the named endpoint; wall measurement 2026-11-27T01:46:01.478Z.
- Day 2 · Review · Explain feedback: 11387 ms to the named endpoint; wall measurement 2026-11-27T01:46:19.382Z.
- Day 2 · Review · rate Good to next exercise: 193 ms to the named endpoint; wall measurement 2026-11-27T01:46:19.580Z.
- Day 2 · Review · rate Good to next exercise: 245 ms to the named endpoint; wall measurement 2026-11-27T01:46:34.295Z.
- Day 3 · Open · day 3 reload Home usable: 353 ms to the named endpoint; wall measurement 2026-11-27T01:46:45.897Z.
- Day 3 · Open · picker to usable question: 852 ms to the named endpoint; wall measurement 2026-11-27T01:46:46.990Z.
- Day 3 · Review · Explain feedback: 14901 ms to the named endpoint; wall measurement 2026-11-27T01:47:07.670Z.
- Day 3 · Review · rate Good to next exercise: 190 ms to the named endpoint; wall measurement 2026-11-27T01:47:07.864Z.
- Day 4 · Open · day 4 reload Home usable: 335 ms to the named endpoint; wall measurement 2026-11-27T01:47:16.063Z.
- Day 4 · Open · picker to usable question: 855 ms to the named endpoint; wall measurement 2026-11-27T01:47:17.332Z.
- Day 4 · Review · Explain feedback: 11413 ms to the named endpoint; wall measurement 2026-11-27T01:47:40.987Z.
- Day 4 · Review · rate Good to next exercise: 192 ms to the named endpoint; wall measurement 2026-11-27T01:47:41.185Z.
- Day 4 · Review · rate Good to next exercise: 189 ms to the named endpoint; wall measurement 2026-11-27T01:47:57.456Z.
- Day 4 · Review · Explain feedback: 8386 ms to the named endpoint; wall measurement 2026-11-27T01:48:06.102Z.
- Day 4 · Review · rate Good to next exercise: 181 ms to the named endpoint; wall measurement 2026-11-27T01:48:06.287Z.
- Day 4 · Review · Explain feedback: 10396 ms to the named endpoint; wall measurement 2026-11-27T01:48:46.937Z.
- Day 4 · Review · rate Good to next exercise: 176 ms to the named endpoint; wall measurement 2026-11-27T01:48:47.119Z.
- Day 4 · Review · Explain feedback: 11875 ms to the named endpoint; wall measurement 2026-11-27T01:49:09.862Z.
- Day 4 · Review · rate Good to next exercise: 195 ms to the named endpoint; wall measurement 2026-11-27T01:49:10.063Z.
- Day 4 · Read · Day4 resume transcript: 289 ms to the named endpoint; wall measurement 2026-11-27T01:49:18.182Z.
- Day 4 · Read · Finish Continue to first question: 217 ms to the named endpoint; wall measurement 2026-11-27T01:49:32.789Z.
- Day 4 · Read · Finish Q1: Check to pending result (not feedback): 246 ms to the named endpoint; wall measurement 2026-11-27T01:49:40.431Z.
- Day 4 · Read · Finish question 2 to checked feedback: 31442 ms to the named endpoint; wall measurement 2026-11-27T01:50:29.133Z.
- Day 4 · Read · Finish question 3 checked feedback: 5852 ms to the named endpoint; wall measurement 2026-11-27T01:50:55.871Z.
- Day 4 · Read · Finish Done to reader: 1324 ms to the named endpoint; wall measurement 2026-11-27T01:51:22.795Z.
- Day 7 · Open · Day7 return Home usable: 239 ms to the named endpoint; wall measurement 2026-11-27T01:53:02.886Z.
- Day 7 · Open · picker to usable question: 840 ms to the named endpoint; wall measurement 2026-11-27T01:53:03.925Z.
- Day 7 · Open · picker to usable question: 836 ms to the named endpoint; wall measurement 2026-11-27T01:53:31.202Z.
- Day 7 · Review · Explain feedback: 11433 ms to the named endpoint; wall measurement 2026-11-27T01:53:51.589Z.
- Day 7 · Review · rate Good to next exercise: 162 ms to the named endpoint; wall measurement 2026-11-27T01:53:51.755Z.
- Day 7 · Review · rate Good to next exercise: 222 ms to the named endpoint; wall measurement 2026-11-27T01:54:21.830Z.
- Day 7 · Review · Explain feedback: 10909 ms to the named endpoint; wall measurement 2026-11-27T01:54:32.993Z.
- Day 7 · Review · rate Good to next exercise: 161 ms to the named endpoint; wall measurement 2026-11-27T01:54:33.157Z.
- Day 7 · Review · Explain feedback: 12413 ms to the named endpoint; wall measurement 2026-11-27T01:55:02.147Z.
- Day 7 · Review · rate Good to next exercise: 175 ms to the named endpoint; wall measurement 2026-11-27T01:55:02.325Z.
- Day 7 · Review · Explain feedback: 9372 ms to the named endpoint; wall measurement 2026-11-27T01:55:33.968Z.
- Day 7 · Review · rate Good to next exercise: 153 ms to the named endpoint; wall measurement 2026-11-27T01:55:34.123Z.

## Final observations

- Day 4 · Read · I moved on from question 1 while it still said Finding the key points. Its answer was saved, but no check was saved for that question; the two questions whose feedback I waited for have checks. This was not reproduced twice and is not promoted to a finding.
- Day 7 · Close · Ring and Home show 11 minutes; saved ratings total 632,613 ms. The bonus dots are visible. Both faithfully reflect the stored total, which is at least 70,016 ms short because of the interrupted answer.
- Day 7 · Open · Week says 1 of 7 days met this week; Monday’s hover shows 0 min; both missed-day dots are unfilled and both saved day totals are zero. The Tuesday hover capture retained Monday’s tooltip and is not evidence for Tuesday’s tooltip. The three met days from last week remain in the files.
- Day 7 · Skill · Computer Science shows Lv 0 and 1 cut gem. Only its API-interface exercise exceeds the 21-day stability threshold (28.7756461 days). No level or gem was reset by the missed days.
- Day 7 · Review · No newly unanswerable question, raw Markdown, or broken passage was confirmed. The old duplicate AIMA imports remain (F198); no new regression filed.
