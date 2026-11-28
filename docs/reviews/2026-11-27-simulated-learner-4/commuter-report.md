# Commuter — a week of short phone bursts

I used the supplied WebKit phone app at 390 × 844, touch enabled and screenshots at 2×, through **November 27–December 3** on one continuing page: two bursts on Days 1–3, Day 4 missed, one burst plus five simulated reading minutes on Day 5, and three bursts on Days 6–7. Day 7 used Ore’s maximum supported text scale, `--type: 1.647`. **27 ratings saved; one new S2 finding; no confirmed lost answer, lost rating, or crash.** I checked the phone’s IndexedDB overlay against its read-only seed, including schedules, daily minutes, new-exercise limits and session receipts. I skipped Mac AI, imports, native keyboard/selection handles, real OS suspension, iCloud sync, write-failure injection and pure visual taste. Reading used touch double taps and scripted scrolling; the annotations comprised one new highlight, two existing passages reselected/expanded, and an existing highlight promoted to Key point with a note—not two newly created highlights. [Friction log](log.md) · [Daily data](daily-summary.json) · [Every rating](exercise-audit.json).

## Finding

### 1. Ending a burst on a miss pushes its retry behind new material — S2 · iPhone

The retry is retained, but short subsequent bursts do not reach it. On two separate days I left after a miss, returned twice, and spent the rest of the day reviewing other material without getting another attempt at the missed exercise. This undermines the daily-session promise that a miss comes back today while it is fresh.

**Reproduce from a fresh seeded phone page:**

1. Today → Start review → Start review, with all skills selected and the default ten new exercises per day.
2. Answer an exercise, reveal its answer, and rate **Again**.
3. Immediately tap **Leave review**, then **Done**. This is the train stop interrupting the session before its planned retry.
4. Start another review with the same skills. Answer three or more other exercises, then leave again.
5. Start another short burst. With enough new exercises remaining, new material continues ahead of the retry. Stop when the available few minutes or daily goal is used.

**Expected:** preserve a near-term retry across interruptions, consistent with a miss coming back after about three intervening exercises and with sessions that are routinely cut short. **Actual:** each fresh session rebuilds the queue with all remaining new exercises before the pending retry. Its earlier place in the interrupted session is lost. There is no indication that the retry now waits behind that material. I read the queue code to understand why it had not returned; the learner should not need that investigation to get another timely attempt.

**Reproduced 2/2 interrupted misses:**

| Day | Missed exercise | What happened afterward |
|---|---|---|
| 6 | AGI routes, `01M6JBPBM5X7ZDRC0SNMRYC141` | Five other ratings across two more bursts; no retry that day. A reconstructed fresh queue put it 15th at burst 2 and 13th at burst 3. It returned the following day as ordinarily due, then received Good. |
| 7 | Rational agent, `01M78B5FP916SGKTVYW1TCT2BR` | Six other ratings across two more bursts, plus one Later; no retry before leaving at **13 of 10 minutes**. Fresh-session positions were 10th and 7th. The next question on leaving was a new chart exercise, not the missed fact. |

Queue positions are a **code-and-files reconstruction**, not a displayed position. The observed evidence is the sequence of questions and saved ratings. The rating and its next-day schedule were not lost; this is a retry-order problem, not data loss.

**Screenshots:** [Day 6 first burst ending](day6-burst1-end.png), [Day 7 missed answer](day7-miss-before-leave.png), [Day 7 resumed on other material](day7-resume-after-miss.png), [still on new material after six further ratings](day7-unreturned-miss.png), [13-minute ending](day7-burst3-end.png).

**Saved evidence:** [final IndexedDB](final-db.json), [queue comparison](queue-audit.json), [rating audit](exercise-audit.json), [Day 6/7 friction entries](log.md).

**Suspected cause:** `packages/core/src/study.ts:245` returns ordinary due exercises, then every remaining new exercise, then relearn entries. `apps/desktop/src/review-session.ts:226` asks for this fresh queue on each start. `docs/design/daily-session.md` says a miss comes back today; D59.3 specifies about three intervening exercises. No fix was made.

## Known rows and limits

- **No previously fixed row was confirmed to have returned.**
- **F730 held twice:** 20- and 30-minute simulated hidden intervals kept the drafts and saved **74,235 ms** and **78,606 ms**, respectively. Hidden time did not inflate either rating. This used visibility-state overrides and bubbling events, not real iOS suspension.
- **F796 / #562 held twice:** an unfinished answer kept its text and prior active time after Leave/restart and after Leave/reload/restart. The two completed exercises saved **140,905 ms** and **120,566 ms**, including the deliberately accrued 70 seconds before leaving and excluding eight/ten minutes away.
- **F740 held:** two inspected large-text transitions reset the next question to the top; one measured `scrollTop: 0`, heading top **140.86 px**. [First arrival](day7-large-arrival1.png), [second arrival](day7-large-arrival2.png).
- **F14 remains:** long answers at maximum text size require vertical scrolling to their marks and ratings. Those controls remained reachable. No worse defect is claimed.
- No raw backticks were observed in the reviewed API question/answer fields; this is limited coverage of F741.
- The phone’s calendar advanced correctly. This does **not** independently verify #559’s Mac-bridge clock fix. #559’s import/tooling fixes and #582’s import/AI-chat fixes were outside this phone journey; I do not mark them verified.
- **One unconfirmed count mismatch:** on Day 6 burst 2, picker accessibility text said two No skill exercises were ready; four were eligible when the session started. The two extra became due during the simulated hour while Home stayed visible. Review itself included them. This happened once, without a visibility event during that clock jump; it is logged, not promoted to a finding.
- The first Day 1 screenshots caught the end animation before its numeric result settled. Its Home total was checked, but a settled Day 1 end-ring number was not independently captured.

## Saved-data checks

The effective library is the seed plus IndexedDB file replacements. [audit.py](audit.py) reads both without writing to the seed. [queue-audit.py](queue-audit.py) compares candidate membership and skill counts with captured picker text; it does not independently validate FSRS mathematics or priority ranking. Skill counts overlap when an exercise belongs to two skills, so their sum is not the number of unique exercises.

| Day | First-session scheduled due + eligible new | Saved ratings / first-seen | Saved review time | Display check |
|---|---|---|---|---|
| 1 · Nov 27 | 2 + 10 | 4 / 2 | 4:08.308 | Home 4 of 10; settled ending not captured |
| 2 · Nov 28 | 0 + 10 | 3 / 3 | 4:48.116 | End rings 2 → 5; Home 5 |
| 3 · Nov 29 | 0 + 10 | 3 / 3 | 4:36.638 | End rings 1 → 5; Home 5 |
| 4 · Nov 30 | 2 scheduled due; no session opened | 0 / 0 | 0 | Missed; no on-screen check intentionally |
| 5 · Dec 1 | 4 + 10 | 2 / 0 | 2:42.038 | End 3; still 3 after reading |
| 6 · Dec 2 | 3 + 10 | 7 / 1 | 7:56.688 | End rings 2 → 5 → 8; Home 8 |
| 7 · Dec 3 | 0 + 10 | 8 / 7 | 12:31.046 | End rings 3 → 8 → 13; Home 13 |

The goal stayed **10 minutes** and weekdays-only stayed off. Each encountered previously reviewed exercise was due at its rating time; new exercises were explicitly eligible. None of the daily first-seen counts exceeded ten. Day 7’s prior-day miss became due at 08:02:44, after the 08:00 opening, and appeared in the later burst. This is why “zero scheduled due at opening” does not imply none was due later that day.

The settled end-screen memory/day counts matched their saved session receipts: Day 2 bursts **1/+2**, **2/+5**; Day 3 **1/+2**, **2/+5**; Day 5 **2/+22**; Day 6 **1/+14**, **2/+25**, **3/+25**; Day 7 **1/+2**, **3/+6**, **3/+7**. These check display/persistence agreement, not independent scientific predictions.

## What passed

- All 27 ratings persisted with the selected rating, date, elapsed time and next-due state.
- Same-page background interruptions retained the exact unfinished answer twice.
- Leaving and reopening, including a page reload, retained the unfinished exercise and its active time twice.
- Later worked through two thumb taps at normal and maximum supported text sizes; no rating was created by the action.
- Phone Explain feedback showed the model answer and manual key-point marks, with the Mac-only checking limitation stated clearly.
- Touch annotation changes, the Key point and its note survived reopening and the next two calendar dates. [Collected on Day 7](day7-kept-highlights.png).
- Reading restored its area and did not add to the review goal.
- The missed day caused no guilt copy, streak loss or reset of saved reviews.
- Maximum text stayed within 390 px horizontally; review controls were reachable by vertical scrolling.
- New questions started at the top after long answers.
- Review continued past the daily goal; the final ring and Home both showed 13 of 10.
- No page exception was recorded.

## Where the minutes went

Review is saved time, including injected thinking intervals and foreground inspection overhead. These are simulated bursts, not human reading-speed measurements. Day 1’s first burst was about 1:44, slightly below the requested two-minute minimum; later bursts were roughly 2–5 minutes. Day 2 also included a brief interruption/restart within the first burst. Waiting sums nonoverlapping measured actions; it is already inside some review/reading time and must not be added to those columns. Unmeasured costs are not estimated.

| Day | Review credited | Reading | Adding | Measured waiting | Lost / extra effort |
|---|---:|---|---:|---:|---|
| 1 | 4:08 | None | 0 | 2.25 s | Manual comparison/marking; no confirmed time loss |
| 2 | 4:48 | None | 0 | 2.16 s | Two taps for Later; no confirmed time loss |
| 3 | 4:37 | None | 0 | 1.94 s | Interrupted work retained; no confirmed time loss |
| 4 | 0 | Missed | 0 | 0 | None |
| 5 | 2:42 | 5:00 injected, plus unisolated annotation/reopen work | 0 | 1.06 s | Existing highlights were reselected; only one new ID created |
| 6 | 7:57 | Brief restored-reader check | 0 | 2.57 s | One timely retry not reached after five other ratings; recovery minutes not measured |
| 7 | 12:31 | Brief saved-annotation check | 0 | 3.14 s | One timely retry not reached after six other ratings; repeated vertical scrolls, duration not isolated |

## Felt slow

[Every measured wait, slowest first](felt-slow.md), with [raw timings](timings.jsonl).

- Initial library opening: **1,364 ms**. Its intermediate loading feedback was not captured; no repeated blank wait over one second was established.
- Picker → usable question: **422–452 ms** across the measured successful starts, including touch actionability and screen transition.
- Later at maximum text size: **389 ms** tap-call duration; normal-size Later was **23 ms**. One slow sample does not establish a recurring stall.
- AIMA source opening: **189 ms** tap-call duration.
- Rating → next usable question: **53–174 ms** in the captured successful transitions.

The recurring learner cost was retry placement across bursts, not a repeated unlabelled wait. The large-text scroll cost is the already-known F14.

## Run boundaries

Used only port 1763 and the supplied WebKit endpoint. No Mac page, server, watcher, extra browser, simulator, installed app or owner library was started, stopped or modified. The continuing journey used one context and one page; a discarded setup context preceded it and saved no ratings. All contexts were closed when testing finished. Retained output is inside `codex-out/commuter`; a setup search listing was briefly written under `/tmp` and moved here. Repository source and the findings registry were untouched; no commit, tests or build were run for this findings-only task. Checkout HEAD was `f0d9a8717dcb20d7e4b29880b51f25470eac1885`; the served bundle’s compile revision was not separately attested. Native iOS keyboard, text-selection handles, OS suspension and physical-device Dynamic Type remain unverified.
