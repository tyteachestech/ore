# Practicer — four days with Ore’s tutor

Used the supplied Mac release build in touch-free WebKit at 1280×800, 2×, on commit `747b4674ffb2b80c74e29f676132006c40c06e29`, with real Codex AI and the assigned library copy. The seed had **67 sources and 38 exercises**. November 27–30 covered explain-why coaching, a two-case distinction, right/partial/wrong answers and “I don’t know,” a four-step worked example, three kept tutor exercises, next-day Review, Finish’s three-question quiz, recovery from an injected save failure, and reopening/resuming saved chats. Consulted the known findings and both preceding runs. Skipped imports, iPhone, native shell behavior, visual taste, a full daily goal and missed calendar days. Product files were not edited. All artifacts are in this folder; library changes went through the app. Timing and harness limitations are stated below.

## Findings, ordered by cost to the learner

### 1. Keeping a tutor exercise drops its supporting passages

**S2 · Mac · Days 1–2.** The exercise survives, but the route back to its evidence does not. This interrupted both next-day checks and requires finding the passage manually or locating the original chat.

1. From a fresh page, open **How to write good prompts**, then Tutor.
2. Ask for explain-why practice about consistent retrieval. Answer partly incorrectly. When its corrective reply cites passages and offers **+ Exercise**, keep it.
3. Ask for a false-positive/false-negative tell-apart case, answer it, and keep the exercise offered with the cited feedback.
4. Advance one day before reload. Open the source, then Tutor → **Quiz me**. Review the existing exercise and the two new tutor exercises.
5. Answer each new exercise and inspect its source area. Press **Open in source**.

**Expected:** a kept exercise retains the supporting passages supplied with its tutor reply, so Review can show and open them. **Actual:** both Review source areas have **zero quotes**. Both links open the article at its beginning, rather than the relevant section. The first exercise’s chat had three citations; the second had two. Both exercise files retain the source ID but contain neither an annotation nor evidence. The original chat citations still work, so this is a loss of evidence association during keeping, not failed citation retrieval.

**Reproduced:** **2/2 distinct kept exercises**, each checked in Review and through its source link. Question, answer, rubric and AI stamp otherwise match the proposals exactly. A third kept exercise on Day 3 also lacks evidence on disk, but was not independently checked in Review.

**Evidence:** [first exercise](day2-kept-consistency.png), [first source destination](day2-source-no-passage.png), [second exercise](day2-kept-tell-apart.png), [second source destination](day2-tell-apart-source-top.png), [original citation still works](day4-saved-citation-settled.png), [file audit](verification.json), [Day 2 files](day2-review-files.json).

**Suspected cause:** `apps/desktop/src/Tutor.tsx:304` passes the proposed exercise and AI stamp to `tutor-card`, but not its citations. `packages/core/src/ai/tutor.ts:494` writes no evidence. `apps/desktop/src/Review.tsx:136` explicitly describes the resulting fallback to the source top. This is an existing implementation limitation with newly observed learner cost, not a claimed regression of F872 or F874.

### 2. Tell-apart answers have no visible way to submit

**S2 · Mac · Day 1.** I filled both answer fields, then had to read implementation code to learn how to send them.

1. From a fresh page, open **How to write good prompts** and Tutor.
2. Ask: “Give me a tell-apart practice case about false positives versus false negatives in prompt design. Do not reveal which it is yet.” Real AI wording may vary; the saved chat **Consistency in review prompts** preserves this run’s case.
3. Fill the two fields labelled **Case A: which idea fits, and what decides it** and **Case B: which idea fits, and what decides it**.
4. Look for a submit control. The normal message field is empty and its Send arrow remains disabled.
5. Press Enter inside Case B: both answers are finally sent. Enter in Case A only moves to Case B.

**Expected:** an enabled submit action for the populated case answers, or a visible instruction explaining their submission key. **Actual:** there is no case submit button or Enter hint. The working route is a keyboard handler invisible on the screen. The two fields look ready, while the only Send control says otherwise.

**Reproduced:** **2/2 filled-case states**, first in the new chat, then after reopening the same saved chat in a fresh context. Enter in B successfully sent both answers and returned useful corrective feedback. This establishes the UI problem twice, not two independent AI generations.

**Evidence:** [filled cases](day1-cases-filled.png), [fresh-context repeat](day1-cases-repeat.png), [feedback after Enter](day1-case-feedback.png).

**Suspected cause:** `apps/desktop/src/Tutor.tsx:1307` renders the case fields; lines 1325–1330 implement the only submission path. The main Send button is tied to the separate message draft. The screen should have told me how to submit, rather than requiring code inspection.

### 3. Reopening a worked example forgets which steps were revealed

**S3 · Mac · Days 2 and 4.** The working remains saved, but rereading it requires repeating its reveal sequence.

1. From a fresh page, open Tutor on **How to write good prompts**, press **Practice**, answer “I don’t know,” then **Show me**.
2. In the resulting worked example, reveal all four steps with three **Next step** presses.
3. Reload, open Tutor → Chats → **Writing better review prompts**.
4. It opens at **Step 1 of 4**. Reveal all steps, reload and reopen again.

**Expected:** a saved chat resumes at the revealed extent, with an explicit restart action if the learner wants to practise again. **Actual:** both reloads reset the display to step 1. **Three extra presses per reopening** are required to reread the saved example. No step text was deleted.

**Reproduced:** **2/2 reload/reopen cycles**. Ordinary Next step actions worked in 31–46 ms and the last step correctly focused the reply field.

**Evidence:** [all steps on Day 2](day2-worked-all-steps.png), [Day 4 reset](day4-worked-reopened.png), [second reset](day4-worked-repeat-reset.png).

**Suspected cause:** `apps/desktop/src/Tutor.tsx:1126` keeps `stepsShown` only in a module-local Map; line 1132 defaults to one when that map is empty. This is a persistence usability finding; D142’s within-page navigation behavior is not alleged to have regressed.

## Known rows and regression checks

No fixed row was confirmed to have returned. Specified open issues were not re-reported.

- **F871 / #587 held:** a Day 4 clearer-exercise proposal displayed revised key points and saved both revised criteria, question, answer and `codex / gpt-6.2-sol / chat@3`. [Proposal](day4-clearer-proposal.png), [applied](day4-clearer-applied.png), [saved file snapshot](day4-clearer-files.json). Undo restored the original exercise, including its stamp. No rating was submitted during this check.
- **F872 / #587:** source-based explanatory tutor replies in this run had citations. The audit found all **18 local citation quotes** in their stated sources. This exercises successful source answers; it does not force the zero-citation retry branch.
- **F874/F875 / #593 held for the tested scenario:** renamed an already archived lesson to **Model choice practice reference**, left its reader, and asked from Home using the new title. The answer supplied three clickable citations to that lesson, including the quoted Opus-polish example. [Answer](day4-renamed-archive-citation.png), [opened quote](day4-renamed-archive-quote.png). Restored the original title, **Choosing the right model**, afterward. This was one real generation; the forced second-failure sanitizer branch was not tested.
- **F877 / #593 held below the goal:** **161,680 ms = 2:41.680** showed **2 min** on the settled end screen and Home, rather than rounding to three. The specific 9:33 boundary and bonus lap were not exercised.
- **F739 held:** ratings, draft creation dates, daily reset and next-due dates followed the moved page dates.
- Import rows in #587/#593 and the phone link-picker fix were outside this Mac tutor journey. No claim is made that those were retested.

## Daily saved-data audit

| Day | Recorded ratings / new first reviews | Credited review time | File and screen checks |
| --- | --- | --- | --- |
| 1 · Nov 27 | 0 / 0 | 0 | Two tutor drafts created; chat practice recorded no ratings. |
| 2 · Nov 28 | 3 Good / 2 | 161,680 ms | Existing exercise plus both kept exercises; end says 3 memories kept, +16 days of memory, 2 min. Both new exercises next due Nov 30 at 08:02:10 and 08:02:51 local. Existing exercise due Dec 8. |
| 3 · Nov 29 | 0 / 0 | 0 | Source marked Done; recall and all three quiz answers saved. Five Finish-derived exercises created (three from prequestions, two from notes), plus one tutor exercise. Home stays 0 of 10 min. |
| 4 · Nov 30 | 0 / 0 | 0 | All three practice chats reopened; follow-up continued the stock example. Both Day 1 exercises were back in the captured due queue after their scheduled times. New-day count reset to zero. Unrated rewrite inspection added no review or credited time. |

Day 2’s elapsed values were **65,484 + 55,650 + 40,546 ms**. Each is below the three-minute cap. They include foreground inspection and test administration, so they are exact app credit, not a pure measure of human thinking. The saved session receipt has three reviews, three kept, one rescued and sixteen additional days of memory, agreeing with the visible ending. The AI suggested Easy, Easy and Hard; the three recorded ratings are the learner’s **Good, Good, Good**. I changed one missed key-point mark before the third rating.

All three kept tutor exercises match their proposals’ question, answer, rubric and AI stamp after the temporary rewrite was undone. Eight exercises were added in total: three tutor, three prequestion and two note-derived. Source body text was not rewritten. Evidence: [verification](verification.json), [captured queues and daily responses](day-queue-audit.json), [final files](final-files.json), [read-only audit script](audit.py).

## What passed

- Explain-why practice withheld the initial answer; incorrect quiz answers received specific corrections and supporting citations.
- Tell-apart feedback distinguished the correct A answer from the incorrect B answer, named the missing distinction and asked one follow-up.
- A correct rewrite was acknowledged without a score or FSRS rating.
- “I don’t know” received a scaffolded example and a follow-up; Show me provided four revealable steps.
- Last worked-example step handed focus back to the reply field.
- Three tutor exercises saved, with exact proposed text, key points and AI provenance; two appeared in next-day Review as New.
- Saved practice chats retained learner answers, corrective feedback, cases and Exercise added markers; a Day 4 follow-up continued the earlier stock example.
- A saved citation reopened and highlighted the exact retrieval-induced-forgetting passage after reload.
- Finish hid the source during attempts, identified missing points, saved all answers and recall, marked Done and drafted five exercises.
- Injected `tutor-card` failure displayed an error, retained the reply and offered the add control again; retry created exactly one exercise.
- AI did not set recorded ratings; the learner could change a key-point mark and choose a different rating.
- Below-goal minutes and daily resets matched saved review data.

## Where the minutes went

Only app review credit and instrumented operations support exact durations. Reading/composing was not continuously metered; tool orchestration is not presented as learner reading time. Waits overlap review and reading, and preparation can run in the background, so these columns are **not additive**. No sources were added.

| Day | Review credited | Reading / practice | Adding | Waiting | Lost / recovery |
| --- | --- | --- | --- | --- | --- |
| 1 | 0 | Five tutor turns; explain and tell-apart practice. Reading duration unmetered. | Two exercises; zero sources | 100.257 s captured operations | Two blocked-looking case submissions; code lookup required. Duration unmetered. |
| 2 | 2:41.680 | Three tutor turns; hint and worked example | Zero sources/exercises | 88.079 s captured operations | Two source-link detours with no passage; manual evidence-finding duration unmetered. |
| 3 | 0 | Recall, three-question Finish quiz and corrective tutor example | Five Finish drafts + one kept tutor exercise; zero sources | 105.126 s captured operations | Injected failure recovered without loss. Selector timeouts excluded. |
| 4 | 0 | Reopened all practice chats; resumed one; citation and rewrite regressions | Zero sources/exercises | 60.339 s captured operations | Revealed-step reset reproduced twice; three repeated presses per reopening. |

## Felt slow

The longest measured operation was **54.548 s** preparing the Finish quiz’s key points. Initial practice/coaching replies commonly took **15–30 s**. Pending states and Stop controls were visible. Validly instrumented tutor sends acknowledged in **23–50 ms**; no repeated blank wait over one second was established. These are supplied-bridge completion times, not native streaming first-token measurements.

Every instrumented action/completion measurement follows, slowest first. “Bridge” means a backend-only timer. The clearer-exercise upper bound includes the gap between tool calls. The first two Day 1 follow-ups end when Stop disappears; later tutor timings also wait for the typing animation. Keep-exercise timings measure visible acknowledgement, with disk persistence checked separately. Unmetered background recall feedback/drafting is excluded.

| Day | Seconds | Action |
| --- | ---: | --- |
| 3 | 54.548 | Finish key-points preparation (bridge) |
| 1 | 29.696 | day1-tell-apart |
| 3 | 29.445 | day3-missed-question-coaching |
| 1 | 26.137 | day1-half-right |
| 4 | 23.908 | day4-resumed-coaching |
| 4 | 22.445 | day4-renamed-archive-citation |
| 2 | 21.657 | day2-practice |
| 2 | 20.378 | day2-worked-example |
| 1 | 16.564 | day1-correct-rewrite |
| 2 | 15.754 | day2-dont-know |
| 1 | 14.981 | day1-case-feedback |
| 4 | 13.985 | Clearer exercise reply (upper bound) |
| 1 | 12.879 | Initial practice question (bridge only) |
| 2 | 11.966 | Tutor tell-apart Check to feedback |
| 2 | 9.933 | Tutor consistency Check to feedback |
| 2 | 8.390 | Old consistency Check to feedback |
| 3 | 7.498 | Finish Q2 feedback (bridge) |
| 3 | 7.400 | Finish Q3 Check to feedback |
| 3 | 6.235 | Finish Q1 feedback (bridge) |
| 4 | 0.430 | Reopen worked-example chat |
| 2 | 0.340 | Quiz me to Review |
| 4 | 0.290 | Saved citation to highlighted passage |
| 3 | 0.203 | Finish recall Continue to quiz |
| 4 | 0.169 | Reopened chat citation to source |
| 1 | 0.161 | Open prompts source |
| 2 | 0.158 | Kept exercise Open in source |
| 2 | 0.046 | Worked example next step 2 |
| 1 | 0.045 | Keep consistency exercise |
| 1 | 0.043 | Keep tell-apart exercise |
| 2 | 0.043 | Worked example next step 3 |
| 3 | 0.042 | Retry keeping tutor exercise |
| 2 | 0.031 | Worked example next step 4 |

## Run boundaries and cleanup

- The interactive journey used one page in one context and closed it at the end. **An initial non-TTY bootstrap left a second, idle context/connection alive.** This unintentionally exceeded the one-context limit; it made no learner writes. No additional browser was launched.
- Cleanup of that bootstrap is blocked by the sandbox. The remaining process was verified by its arguments as **PID 5584: `node codex-out/practicer/driver.cjs`**. `kill -TERM 5584` returned **operation not permitted**. It needs host-side cleanup; the shared WebKit server was not stopped. A broad process-name cleanup was not usable (`sysmond service not found`).
- The interactive driver restarted once on Day 1 after a selector mistake. Its read-only bootstrap briefly reset the same-day clock before advancing to 08:20. No ratings were made before that restart. Days 2–4 moved forward normally. This is a harness limitation, not an app finding.
- Automation selector timeouts and a terminal input-length problem are excluded from app latency. No product tests or builds ran. No commit or push was made because this was findings-only work.
- `git diff --stat` remained empty. An existing untracked `docs/reviews/2026-11-28-simulated-learner-6/` directory was not touched.

[Chronological friction log](log.md) · [raw timings](timings.jsonl) · [request/response ledger](requests.jsonl) · [method notes](method-notes.md) · [driver](driver.cjs) · [helpers](helpers.cjs).
