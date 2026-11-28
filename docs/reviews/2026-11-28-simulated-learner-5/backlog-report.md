# Backlog — a month with gaps

Played the supplied Mac release build in WebKit, 1280×800 at 2×, on checkout bc54898cb31499443087573de5778a6848b685cc. Opened Days 1–5, 13–15, 29–30 (November 28–December 27), with no app activity on the intervening days. Completed **53 ratings**, **106:20.229 credited review time**, four sources read to the end and finished, two draft interruptions, and daily file/queue/week/skill checks. **One new S2 finding; no confirmed data loss or fixed row returning.** Thinking and reading time were deliberately advanced; UI waits used real `performance.now()` timing. Skipped iPhone, imports, native shell/video playback, visual taste, artificial failures, and the tutor/Finish quiz flows already covered by other testers. Finished sources through **Finish → Just mark done → Done**. All tester-written files are in this folder; library mutations went through the app.

## Findings

### 1. Home says the ten-minute goal is complete while the week still marks it partial

**S2 · Mac · reproduced on two separate days, plus a fresh reload.** A learner can stop at the displayed goal and later discover that the day did not count. No review was lost: the contradiction is in the display.

1. Open a fresh Mac page on a library with a ten-minute goal and more exercises available.
2. Review until the saved, capped active time is between 9:30 and 9:59. Use ordinary ratings; for a repeatable simulation, advance thinking time with `page.clock.setSystemTime`, never `clock.install`.
3. Leave Review and choose Done. Read Home’s goal and the current day in the week.
4. Reload. The contradiction remains.

**Expected:** while the goal is unmet, the visible progress should distinguish time still remaining from a completed ten minutes.

**Actual:** Home says **“10 of 10 min”**, but has no goal-met message and marks the day as partly done. The end screen also shows **10 min**. Only the files reveal how much more review is needed.

| Occurrence | Saved time | Still needed | Home | Week |
|---|---:|---:|---|---|
| Day 14, Dec 11 | 573,084 ms (9:33.084) | 26.916 s | 10 of 10 min | 1 of 7 days met, 1 part done |
| Day 15, Dec 12 | 580,030 ms (9:40.030) | 19.970 s | 10 of 10 min | 2 of 7 days met, 1 part done |

Day 14 was first encountered during the ordinary journey. Day 15 deliberately repeated the boundary. Both days were then brought above the actual goal through the app, so the final month’s totals include that extra session.

Evidence: [first Home](day14-rounded-goal-home.png), [fresh reload](day14-rounded-goal-reload.png), [first ending](day14-short-ending.png), [first canonical snapshot](day14-short-after-files.json), [second Home](day15-rounded-goal-home.png), [second ending](day15-short-ending.png), [second canonical snapshot](day15-short-after-files.json). See the Day 14 and Day 15 entries in [log.md](log.md).

Suspected cause: `apps/desktop/src/Ring.tsx:72` rounds minutes to the nearest whole number; `Home.tsx:403` uses that rounded number in “N of 10 min” (the ring’s accessible label at `Home.tsx:400` does too). The actual goal test correctly compares milliseconds at `packages/core/src/today.ts:187`. The end ring uses rounded minutes through `Lap.tsx`. Keeping a below-goal display below the goal, or showing the remaining time near the boundary, would avoid the contradiction. No code was changed.

## Predictions beside observations

The seed had **67 sources, 23 unarchived, 38 exercises, 11 retired, 25 unseen, and two previously reviewed exercises due**. This was a modest owner-library backlog, not a synthetic hundreds-of-exercises stress test. “Due” below means previously reviewed and due at the morning opening; the displayed queue also includes up to ten eligible new exercises.

| Day | Date | Due predicted from files | Unseen eligible | App queue / predicted order | Ratings / first approvals | Saved time → displayed | Current week met |
|---:|---|---:|---:|---|---:|---|---:|
| 1 | 2026-11-28 | 2 | 25 | 12 / matches | 5 / 3 | 11:13.876 → 11 min | 1/7 |
| 2 | 2026-11-29 | 0 | 22 | 10 / matches | 5 / 5 | 10:23.745 → 10 min | 2/7 |
| 3 | 2026-11-30 | 2 | 17 | 12 / matches | 5 / 3 | 10:20.448 → 10 min | 1/7 |
| 4 | 2026-12-01 | 5 | 14 | 15 / matches | 5 / 0 | 11:15.838 → 11 min | 2/7 |
| 5 | 2026-12-02 | 3 | 14 | 13 / matches | 5 / 2 | 10:08.410 → 10 min | 3/7 |
| 13 | 2026-12-10 | 12 | 15 | 22 / matches | 5 / 1 | 10:01.983 → 10 min | 1/7 |
| 14 | 2026-12-11 | 8 | 17 | 18 / matches | 7 / 1 | 11:38.568 → 12 min | 2/7 |
| 15 | 2026-12-12 | 7 | 16 | 17 / matches | 6 / 1 | 10:17.274 → 10 min | 3/7 |
| 29 | 2026-12-26 | 15 | 18 | 25 / matches | 5 / 1 | 10:30.037 → 11 min | 1/7 |
| 30 | 2026-12-27 | 11 | 20 | 21 / matches | 5 / 1 | 10:30.050 → 11 min | 2/7 |

All first-session queues matched the independent reconstruction from source metadata and review logs. Due counts were predicted before opening Home. Full ordering predictions were also saved before opening on Days 13, 14, 15, 29 and 30; Days 1–5’s ordering was reconstructed afterward from their preserved before-snapshots. [Audit with all IDs and due dates](audit.json).

- Days **6–12 and 16–28** have no ratings, receipts or app requests. The page was blank while the clock crossed each skipped date, then reopened on the return date.
- Both returns requested the usual ten minutes. No catch-up quota, loss warning, streak reset or larger daily goal appeared.
- Day 13 opened on the prompt-consistency exercise due Dec 8, despite older due exercises from Dec 2. Day 29 opened on the recently learned caption-export brief due Dec 13, despite an API exercise due Dec 3. Priority, recall likelihood, topic blocks and the likely-success opener explain those orders; oldest-first is not the intended rule.
- On Days 13, 15 and 29 the fifth unique exercise was new. Day 14’s same-day retry came before the fifth unique exercise. Day 4’s goal crossed on a miss and the end-on-a-win rule moved a due exercise forward. These are not failures of the stored one-in-five queue.
- The daily goal stayed at ten minutes. Review continued after it was met; leaving preserved each rating. Reading did not add review minutes.
- Every saved review date and next-due date followed the page clock. F739 did not recur.

## Endings, weeks and skill numbers

Saved capped time and Home’s totals agreed on all ten active days. The two below-goal intermediate endings on Days 14 and 15 expose the rounding issue above; after extra review, both days genuinely met the goal. End receipts kept each burst separate while the ring counted the whole day. Settled ending screenshots exist for Days 2–5, 13–15, 29 and 30. **Day 1’s ending screenshot was taken during the animation and closed too early for a settled-number comparison**; its receipt and settled Home were verified. The Day 1 skill screenshot likewise preceded the stats landing; its returned stats and later stable gem were checked. These capture limits are not app findings.

Home’s week restarted on Monday, not at the start of this experiment. The final week shows **2 of 7 days met**, for Dec 26 and 27, with the earlier weeks’ ratings still in the files. Daily screenshots and the `today` responses in [events.jsonl](events.jsonl) preserve every week.

A gem is an exercise whose saved memory stability reached at least 21 days. Level is based on the highest solid-gem count the skill has held: five are needed for level 1. All nine final skill pages were inspected.

| Skill | Solid gems from files | Peak | Level from files / UI |
|---|---:|---:|---:|
| teaching | 1 | 1 | 0 / 0 |
| storytelling-writing | 0 | 0 | 0 / not shown (no exercises) |
| web-development | 0 | 0 | 0 / 0 |
| creativity | 0 | 0 | 0 / not shown (no exercises) |
| learning | 1 | 1 | 0 / 0 |
| habits | 1 | 1 | 0 / 0 |
| focus-attention | 0 | 0 | 0 / not shown (no exercises) |
| computer-science | 1 | 1 | 0 / 0 |
| ai | 3 | 3 | 0 / 0 |

The final strength responses matched the independently counted solid gems, peaks, levels and summed stability. The month did not reach level 1 in a skill, so this does not test preserving a previously earned nonzero level after a lapse. Existing gems did not disappear merely because days passed. These checks establish agreement with saved schedules, not an independent validation of FSRS’s memory predictions.

## Known rows and observations

- **No fixed row was confirmed to have returned.**
- **F796 / #562 held twice.** Day 2 retained 70 simulated seconds before leaving plus 40 after returning, recording 137,531 ms; the two minutes away were excluded. Day 14 retained the original answer text even when a newly due exercise moved ahead of it. When that original exercise was finally rated, it recorded 125,484 ms, including its earlier 70 seconds plus 20 added later, not the intervening reviews or break. [Restored text](day14-actual-restored-draft.json), [restored screen](day14-original-draft-restored.png).
- The first Day 14 resumption showed a newly due remix. My script initially answered the former question; Ore correctly graded it wrong and required another Good press. I instead chose Again. That scripting mistake and the resulting retry are disclosed in the log and excluded from findings.
- **F199 held for recently finished material:** the Opus guide finished on Day 13 supplied the first new slot on Days 14 and 15; the learning talk finished on Day 29 supplied Day 30’s first new slot. The MDN article finished on Day 5 had passed D279’s seven-day freshness window by the return: its new exercises sat at positions 21 and 22 on Day 13, with the third outside that day’s ten-new allocation. That delay after an absence is a consequence of the stated rule, not a recurrence of F199.
- **F198** remains relevant: the seed has both AIMA imports, including one filed under no skill; related rational-agent material appeared across them. No duplicate-source cleanup was performed.
- **F14** remains: long checked Explain answers require scrolling to rate. Ratings stayed reachable; no worsening was established.
- The new rounding finding differs from **F266**: here the day is still unmet with work available, rather than a caught-up short session being falsely reported as ten minutes.
- #582 and #587’s tutor/import fixes were not exercised by this Mac backlog journey; no verification claim is made for F807, F871, F872 or their import rows.
- No page exception was captured. The video-player failure is expected in this browser bridge; both video sources were read as transcripts.

## What passed

- All ten active dates reached the actual ten-minute goal through saved app ratings.
- Every rating, chosen confidence, typed answer and next-due state persisted.
- Daily new limits and queue ordering matched the saved-library prediction.
- Interrupted answers retained their text and earlier active time.
- Same-day misses returned, including the deliberately disclosed Day 14 wrong-answer case.
- Real Explain feedback arrived; the learner, not the AI, selected the recorded rating.
- Four Finish flows saved Done status and drafted exercises dated on the finishing day, eligible on later dates.
- Reading did not inflate review time.
- No missed-day catch-up demand or loss of earned gems appeared.
- Current-week counts and skill levels/gems matched the canonical review files.

## Where the minutes went

Review time includes simulated thinking and real foreground time, capped at three minutes per rating. Reading reports simulated minutes and separately measured open-to-Finish wall time. AI waits overlap review time; do not add them again. No sources were added. Inspection and automation overhead are not estimated as learner time.

| Day | Review credited | Reading / Finish | Adding | Measured feedback waits | Lost / extra work |
|---:|---|---|---:|---|---|
| 1 | 11:13.876 | None | 0 | 13.526 s | No confirmed lost work |
| 2 | 10:23.745 | None | 0 | 15.519 s | No confirmed lost work |
| 3 | 10:20.448 | None | 0 | 29.909 s | No confirmed lost work |
| 4 | 11:15.838 | None | 0 | 19.318 s | No confirmed lost work |
| 5 | 10:08.410 | 6 simulated min; 29.991 s wall | 0 | 24.330 s | No confirmed lost work |
| 13 | 10:01.983 | 7 simulated min; 11.276 s wall | 0 | 23.334 s | No confirmed lost work |
| 14 | 11:38.568 | None | 0 | 45.722 s | Extra restart after misleading 10/10; no saved text/time lost |
| 15 | 10:17.274 | 8 simulated min; 34.140 s wall | 0 | 22.864 s | Boundary recheck, then extra restart to meet actual goal |
| 29 | 10:30.037 | 8 simulated min; 18.390 s wall | 0 | 25.466 s | No confirmed lost work |
| 30 | 10:30.050 | None | 0 | 22.882 s | No confirmed lost work |
| 6–12, 16–28 | 0 | Away | 0 | 0 | No activity |

## Felt slow

Longest measured foreground feedback wait: **15.519 seconds**. The checking state was shown; no repeated blank wait over a second was established. Background exercise drafting continued while Home was usable; its full duration was not measured with the UI stopwatch, so it is not presented as a measured blocking wait.

Every completed action measurement follows, slowest first. Nested click rows overlap their enclosing transition/feedback rows. The initial 30,242 ms “Start picker to exercise” measurement waited for the wrong CSS selector after the exercise was already visible; it is preserved in the raw ledger but excluded here as a harness error. Fixed nine-second pauses used to photograph settled endings are not claims about actual animation duration.

| Day | Action | ms |
|---:|---|---:|
| 2 | 3 Check to feedback | 15519 |
| 3 | 3 Check to feedback | 15435 |
| 14 | 3 Check to feedback | 14941 |
| 29 | 3 Check to feedback | 14485 |
| 3 | 3 Check to feedback | 14434 |
| 1 | 3 confidence to Explain feedback | 13452 |
| 14 | 3 Check to feedback | 12435 |
| 5 | 3 Check to feedback | 12433 |
| 13 | 3 Check to feedback | 12433 |
| 30 | 3 Check to feedback | 11943 |
| 5 | 3 Check to feedback | 11897 |
| 15 | 3 Check to feedback | 11411 |
| 15 | 3 Check to feedback | 11411 |
| 29 | 3 Check to feedback | 10943 |
| 30 | 3 Check to feedback | 10939 |
| 13 | 3 Check to feedback | 10902 |
| 14 | 3 Check to feedback | 9910 |
| 4 | 3 Check to feedback | 9902 |
| 4 | 3 Check to feedback | 9374 |
| 14 | 3 Check to feedback | 8397 |
| 1 | 2 Open Home | 1443 |
| 13 | 3 Picker to usable exercise | 1255 |
| 14 | 3 Picker to usable exercise | 929 |
| 3 | 3 Picker to usable exercise | 849 |
| 4 | 3 Picker to usable exercise | 846 |
| 2 | 3 Picker to usable exercise | 845 |
| 1 | 3 Start picker to exercise | 845 |
| 14 | 3 Picker to usable exercise | 842 |
| 30 | 3 Picker to usable exercise | 837 |
| 29 | 3 Picker to usable exercise | 836 |
| 13 | 5 Leave to ending | 835 |
| 5 | 3 Picker to usable exercise | 833 |
| 15 | 3 Picker to usable exercise | 831 |
| 15 | 5 Leave to ending | 829 |
| 15 | 3 Picker to usable exercise | 828 |
| 14 | 3 Picker to usable exercise | 823 |
| 2 | 3 Picker to usable exercise | 820 |
| 15 | 5 Leave to ending | 819 |
| 13 | 2 Return Home | 368 |
| 2 | 2 Return Home | 360 |
| 14 | 5 Leave to ending | 322 |
| 15 | 3 Again to next exercise | 306 |
| 14 | 2 Return Home | 294 |
| 1 | 3 No idea to answer | 278 |
| 29 | 3 No idea to answer | 276 |
| 1 | 3 Again to next exercise | 273 |
| 30 | 3 No idea to answer | 272 |
| 29 | click No idea | 268 |
| 1 | click No idea | 267 |
| 15 | 3 No idea to answer | 267 |
| 30 | 3 No idea to answer | 263 |
| 3 | 2 Return Home | 262 |
| 15 | 3 No idea to answer | 261 |
| 15 | click No idea | 261 |
| 30 | click No idea | 259 |
| 30 | click No idea | 257 |
| 1 | 3 No idea to answer | 256 |
| 15 | click No idea | 256 |
| 1 | click No idea | 253 |
| 2 | click Start review | 252 |
| 4 | 3 No idea to answer | 251 |
| 14 | click Start review | 250 |
| 13 | 3 No idea to answer | 248 |
| 4 | click No idea | 247 |
| 5 | 3 No idea to answer | 247 |
| 3 | 3 No idea to answer | 244 |
| 13 | click No idea | 244 |
| 5 | click No idea | 244 |
| 14 | 3 No idea to answer | 244 |
| 29 | 3 No idea to answer | 242 |
| 3 | 3 No idea to answer | 241 |
| 5 | 3 No idea to answer | 241 |
| 3 | click No idea | 240 |
| 14 | 3 No idea to answer | 240 |
| 14 | click No idea | 240 |
| 2 | 3 No idea to answer | 239 |
| 2 | 3 No idea to answer | 239 |
| 13 | 3 No idea to answer | 238 |
| 2 | 3 No idea to answer | 238 |
| 3 | click No idea | 238 |
| 29 | click No idea | 238 |
| 5 | click No idea | 237 |
| 13 | 3 No idea to answer | 237 |
| 14 | click No idea | 236 |
| 2 | click No idea | 236 |
| 2 | click No idea | 235 |
| 5 | 3 No idea to answer | 235 |
| 2 | click No idea | 234 |
| 29 | 3 Again to next exercise | 234 |
| 13 | click No idea | 234 |
| 13 | click No idea | 234 |
| 5 | 3 Again to next exercise | 233 |
| 5 | click No idea | 232 |
| 5 | 3 Good to next exercise | 224 |
| 15 | 6 Open photography transcript | 221 |
| 30 | 2 Return Home | 216 |
| 2 | 3 Good to next exercise | 214 |
| 30 | 3 Again to next exercise | 211 |
| 4 | 2 Return Home | 211 |
| 5 | 6 Just mark done to closing card | 210 |
| 5 | 2 Return Home | 209 |
| 13 | 3 Good to next exercise | 207 |
| 29 | 6 Open learning transcript | 206 |
| 13 | 6 Open Opus guide | 205 |
| 15 | 2 Return Home | 203 |
| 13 | 3 Good to next exercise | 202 |
| 1 | 3 Again to next exercise | 198 |
| 29 | 3 Good to next exercise | 198 |
| 29 | 2 Return Home | 198 |
| 4 | 3 Good to next exercise | 197 |
| 2 | 3 Again to next exercise | 196 |
| 2 | 3 Again to next exercise | 195 |
| 13 | 3 Again to next exercise | 194 |
| 30 | 3 Good to next exercise | 192 |
| 5 | 3 Good to next exercise | 192 |
| 30 | 3 Good to next exercise | 191 |
| 1 | 3 Good to next exercise | 190 |
| 3 | 3 Good to next exercise | 190 |
| 14 | 3 Good to next exercise | 190 |
| 29 | 3 Good to next exercise | 190 |
| 1 | 3 Good to next exercise | 186 |
| 3 | 3 Good to next exercise | 186 |
| 14 | 3 Again to next exercise | 185 |
| 1 | 3 Good to next exercise | 185 |
| 30 | 3 Again to next exercise | 185 |
| 5 | 3 Again to next exercise | 183 |
| 15 | 3 Good to next exercise | 183 |
| 14 | 3 Again to next exercise | 182 |
| 4 | 3 Again to next exercise | 182 |
| 15 | 3 Good to next exercise | 180 |
| 2 | 3 Again to next exercise | 180 |
| 5 | 3 Again to next exercise | 180 |
| 4 | 3 Again to next exercise | 177 |
| 14 | 3 Good to next exercise | 176 |
| 15 | 3 Again to next exercise | 173 |
| 2 | 3 Again to next exercise | 172 |
| 13 | 3 Again to next exercise | 172 |
| 3 | 3 Again to next exercise | 170 |
| 29 | 3 Again to next exercise | 169 |
| 4 | 3 Good to next exercise | 167 |
| 14 | 3 Good to next exercise | 166 |
| 14 | 3 Again to next exercise | 166 |
| 3 | 3 Again to next exercise | 166 |
| 30 | 3 Again to next exercise | 165 |
| 13 | 3 Again to next exercise | 163 |
| 15 | 3 Again to next exercise | 162 |
| 5 | 6 Open source | 156 |
| 4 | 3 No idea to answer | 126 |
| 4 | click No idea | 123 |
| 29 | 3 Good to next exercise | 111 |
| 15 | click Home | 109 |
| 14 | 3 Good to next exercise | 107 |
| 15 | 3 Good to next exercise | 103 |
| 3 | 3 Good to next exercise | 102 |
| 4 | 3 Good to next exercise | 101 |
| 13 | click Home | 97 |
| 5 | click Home | 97 |
| 29 | click Home | 95 |
| 30 | click Home | 88 |
| 2 | click Check | 82 |
| 1 | 7 Open Computer Science skill | 77 |
| 2 | 7 Open Computer Science skill | 76 |
| 30 | 7 Open Focus & Attention skill | 73 |
| 30 | 7 Open Habits skill | 71 |
| 30 | 7 Open Computer Science skill | 71 |
| 15 | click Done | 71 |
| 30 | 7 Open Web Development skill | 71 |
| 30 | 7 Open Storytelling & Writing skill | 70 |
| 14 | 7 Open AI skill | 70 |
| 3 | 7 Open AI skill | 69 |
| 13 | click All sources | 69 |
| 14 | 7 Open AI skill | 67 |
| 4 | 7 Open AI skill | 67 |
| 1 | click Home | 66 |
| 30 | 7 Open Creativity skill | 65 |
| 29 | 7 Open AI skill | 65 |
| 5 | 7 Open Computer Science skill | 65 |
| 30 | click Home | 64 |
| 15 | click All sources | 64 |
| 13 | 7 Open Learning skill | 63 |
| 15 | 7 Open AI skill | 63 |
| 30 | 7 Open Learning skill | 62 |
| 3 | click Done | 62 |
| 15 | click Home | 62 |
| 30 | 7 Open AI skill | 61 |
| 2 | click Home | 60 |
| 2 | click Done | 59 |
| 30 | 7 Open Teaching skill | 58 |
| 30 | click Home | 56 |
| 14 | click Done | 56 |
| 30 | click Home | 56 |
| 1 | click Done | 55 |
| 2 | 5 Leave to ending | 55 |
| 15 | click Done | 54 |
| 5 | click Done | 54 |
| 3 | click Home | 54 |
| 4 | click Done | 53 |
| 29 | click Done | 52 |
| 5 | click Home | 52 |
| 5 | click All sources | 52 |
| 30 | click Done | 52 |
| 13 | click Done | 51 |
| 30 | click Home | 51 |
| 29 | click Done | 49 |
| 30 | click Start review | 49 |
| 2 | click Leave review | 49 |
| 30 | click Home | 48 |
| 13 | click Done | 48 |
| 30 | click Home | 48 |
| 29 | click Check | 48 |
| 5 | 6 Finish Done to reader | 48 |
| 14 | click Done | 47 |
| 13 | click Home | 47 |
| 3 | 5 Leave to ending | 47 |
| 4 | 5 Leave to ending | 47 |
| 5 | 6 Finish to recall | 47 |
| 14 | click Start review | 46 |
| 5 | click Start review | 46 |
| 1 | click Check | 45 |
| 13 | click Start review | 45 |
| 2 | click Start review | 44 |
| 3 | click Leave review | 44 |
| 15 | click Done | 44 |
| 1 | click Start review | 44 |
| 30 | click Home | 44 |
| 15 | click Start review | 44 |
| 5 | click Finish | 43 |
| 4 | click Leave review | 43 |
| 13 | click Finish | 43 |
| 29 | click Just mark done | 42 |
| 15 | click Start review | 42 |
| 15 | 3 Check to feedback | 42 |
| 5 | 5 Leave to ending | 41 |
| 29 | click Home | 41 |
| 4 | 3 Check to feedback | 41 |
| 14 | click Home | 41 |
| 2 | click Leave review | 41 |
| 13 | click Check | 41 |
| 3 | 3 Check to feedback | 40 |
| 5 | click Done | 40 |
| 4 | click Home | 40 |
| 13 | click Just mark done | 40 |
| 13 | click Leave review | 40 |
| 30 | click Home | 39 |
| 14 | 3 Check to feedback | 39 |
| 14 | click Start review | 39 |
| 15 | click Just mark done | 39 |
| 13 | click Check | 38 |
| 3 | click Start review | 38 |
| 29 | click Check | 38 |
| 14 | click Check | 38 |
| 1 | 3 Check to feedback | 38 |
| 14 | click Check | 38 |
| 29 | 3 Check to feedback | 38 |
| 5 | click Leave review | 38 |
| 30 | click Check | 38 |
| 15 | click Leave review | 38 |
| 14 | 5 Leave to ending | 37 |
| 3 | click Check | 37 |
| 14 | click Check | 37 |
| 29 | 5 Leave to ending | 37 |
| 4 | click Check | 37 |
| 3 | click Check | 37 |
| 14 | click Check | 37 |
| 14 | click Leave review | 37 |
| 29 | click All sources | 36 |
| 1 | 3 Check to feedback | 36 |
| 5 | click Check | 36 |
| 3 | click Check | 36 |
| 4 | click Check | 36 |
| 15 | click Check | 36 |
| 15 | click Check | 35 |
| 14 | click Home | 35 |
| 4 | click Check | 35 |
| 14 | click Check | 35 |
| 1 | 5 Leave to ending | 35 |
| 15 | click Finish | 35 |
| 14 | click Leave review | 35 |
| 15 | click Check | 35 |
| 14 | click Leave review | 34 |
| 29 | click Leave review | 34 |
| 1 | click Check | 34 |
| 30 | 5 Leave to ending | 34 |
| 4 | click Start review | 34 |
| 30 | click Check | 33 |
| 15 | 3 No idea to answer | 33 |
| 29 | click Check | 33 |
| 5 | click Check | 33 |
| 29 | click Start review | 32 |
| 1 | click Check | 32 |
| 1 | click Leave review | 31 |
| 30 | click Leave review | 31 |
| 29 | click Finish | 28 |
| 2 | 3 No idea to answer | 28 |
| 30 | 3 No idea to answer | 28 |
| 5 | click Just mark done | 27 |
| 15 | click No idea | 27 |
| 15 | click Leave review | 26 |
| 2 | click No idea | 24 |
| 1 | click Start review | 23 |
| 30 | click No idea | 23 |

Final verification: [verification.json](verification.json) records 53 matching review writes, 14 matching receipts, ten queue orders, 360 skill-stat comparisons, and no activity on skipped dates. The tester browser context is closed.

Evidence: [friction log](log.md) · [canonical and queue audit](audit.json) · [request/response ledger](events.jsonl) · [raw timings](timings.jsonl) · [driver](driver.cjs) · [journey helpers](helpers.js).
