# Time — days, clocks, and time away

Tested the supplied Mac release page (1672, bridge 1673) and iPhone page (1679) in the supplied WebKit server (1683), with Retina screenshots, a 1280×800 Mac viewport and a 390×844 touch viewport. Covered 1/3/30/365-day returns, midnight sessions, an overnight-open Home, New York → Tokyo → New York, both 2026 US DST transitions, a clock corrected backward, a future-dated rating and Undo, the end ring, source/skill dates, Review's relative dates, and reminder settings. **Four confirmed findings**, each reproduced twice on each platform. The supplied library has **8 exercises**; this checks its complete queue, not performance or ordering in a hundreds/thousands-exercise backlog. Native notification delivery, physical sleep/resume, iCloud propagation, and the actual iOS time wheel were not available in this browser setup. AI was not run. No application source files or shared findings registry were changed.

## Findings

### TIME-1 — Correcting the clock backward prevents the current answer from saving

**S2 · Mac and iPhone · 2/2 on each.** The earlier saved rating remains intact; the next rating fails until the review state is reset or worked around.

1. Open a fresh page in `America/Los_Angeles` with the clock one day ahead (`2027-03-12T20:00:00Z` in the script).
2. Start Review. Spend about a minute on the first exercise, reveal its answer, and give Good.
3. With the next exercise open, correct the clock backward one day (`2027-03-11T20:01:00Z`).
4. Reveal that answer and choose Good.
5. To verify the boundary, Undo the earlier saved rating, then answer the restored exercise again.

**Expected:** Correcting the wall clock must not make elapsed review time negative or prevent a rating. Undo must still take back the earlier rating even though its timestamp is now in the future.

**Actual:** Step 4 stays on the answer and displays `elapsed_ms: Too small: expected number to be >=0`. A captured Mac request supplied approximately **−86,401,000 ms**. No rating is saved for that answer. Step 5 succeeds: Undo restores the first exercise, which can then be rated normally. This isolates the failure to the elapsed-time measurement, not the scheduler's handling of future timestamps.

**Suspected code:** `apps/desktop/src/Review.tsx:378` starts the timer with `Date.now()`; `Review.tsx:604` subtracts that from the new wall-clock value and sends it at line 612. `packages/core/src/reviews.ts:32` correctly rejects negative elapsed time. The UI needs an elapsed-time clock that does not jump with clock correction.

**Evidence:** [Mac error](mac-clock-back-1-error.png), [Mac repeat](mac-clock-back-2-error.png), [iPhone error](phone-clock-back-1-error.png), [iPhone repeat](phone-clock-back-2-error.png), [Mac request and failure](mac-clock-back-1-error-calls.json), [Undo/recovery results](skew-summary.json). Reproducer: `node codex-out/time/skew.cjs`.

### TIME-2 — Home keeps yesterday's minutes after midnight, including after returning to the app

**S2 · Mac and iPhone · 2/2 on each.** A new day's goal appears partly completed when no review has been done that day.

1. Open a fresh page in `America/Los_Angeles` at 23:55 on February 10, 2027 (`2027-02-11T07:55:00Z`).
2. Review one exercise for two minutes. Leave Review and press Done.
3. Confirm Home/Today says **2 of 10 min**.
4. Keep the page open and advance nine hours into the following morning.
5. Also simulate leaving the window, wait over ten seconds, return focus, and dispatch the visibility-return event.
6. Reload the page for comparison.

**Expected:** Home/Today resets to **0 of 10 min** when the local day changes, without requiring reload. Returning to the app should also refresh it.

**Actual:** Steps 4 and 5 still show **2 of 10 min**. Step 6 immediately shows **0 of 10 min**. The Mac's captured calls show no new `today` request during the overnight/wake checks. Both platforms use the shared Home component.

**Suspected code:** `apps/desktop/src/Home.tsx:124`–135 refreshes Today only for its effect dependencies, with no day boundary or wake dependency. The Mac focus handler (`apps/desktop/src/App.tsx:385`) refreshes source lists rather than Home's Today. The phone's periodic/visibility handler (`apps/desktop/src/phone/PhoneApp.tsx:588`) refreshes screens when files changed; the passing of midnight alone does not qualify.

**Evidence:** [Mac overnight](mac-overnight-1-after.png), [Mac after wake](mac-overnight-1-wake.png), [Mac after reload](mac-overnight-1-reload.png), [iPhone overnight](phone-overnight-1-after.png), [iPhone after reload](phone-overnight-1-reload.png), [both repeats and values](overnight-summary.json). Reproducer: `node codex-out/time/overnight.cjs`.

### TIME-3 — A session crossing midnight announces the goal using both days' minutes

**S2 · Mac and iPhone · 2/2 on each.** Review says the goal is met while the end screen and Home correctly say only six of ten minutes were earned today.

1. Open a fresh page in `America/Los_Angeles` at 23:55 on January 20, 2027 (`2027-01-21T07:55:00Z`), with today's minutes at zero and a ten-minute goal.
2. Start Review. Rate two exercises after two minutes each: approximately 23:57 and 23:59.
3. Rate two more exercises after three minutes each: approximately 00:02 and 00:05.
4. Allow the latest memory reward to finish, so the goal message gets its turn.
5. Leave Review; inspect its end ring, then press Done and inspect Home.

**Expected:** Four minutes belong to January 20 and six to January 21. The new day's ten-minute goal is not met.

**Actual:** Step 4 says **“Goal met. The rest is extra.”** Step 5 correctly shows a **6-minute** ring and **6 of 10 min** on Home. The Mac `today` response is `active_ms: 360000, met: false`. The saved records are correctly divided by the local dates of their rating timestamps; the in-session announcement disagrees with them.

**Suspected code:** `apps/desktop/src/Review.tsx:623`–624 compares the Today snapshot from session start with cumulative session time. Neither is reset or rebased when midnight passes. Core's local-day grouping at `packages/core/src/today.ts:158`–176 is consistent with the end screen.

**Evidence:** [Mac false goal](mac-midnight-1-goal.png), [Mac end ring](mac-midnight-1-end.png), [iPhone false goal](phone-midnight-1-goal.png), [iPhone end ring](phone-midnight-1-end.png), [Mac repeat](mac-midnight-2-goal.png), [iPhone repeat](phone-midnight-2-goal.png), [timestamps and Today response](mac-midnight-1-end-calls.json). Reproducer: `node codex-out/time/midnight.cjs`.

### TIME-4 — After a long break, Review calls tomorrow “later today”

**S2 · Mac and iPhone · 2/2 on each.** The date wording gives the learner the wrong day for the next review.

1. Open a fresh page in `America/Los_Angeles` at 09:55 on April 21, 2027 (`2027-04-21T16:55:00Z`).
2. Start Review; put off the first two Facts to reach **“Explain why rereading creates an illusion of competence.”** This exercise has previous review history.
3. Leave that question open for thirteen hours, returning at approximately 22:55 the same day.
4. Choose **No idea**. Inspect the memory line before rating.

**Expected:** The line must not call a date on April 22 “later today” on April 21. Its prediction should also be refreshed after the long interruption.

**Actual:** The visible line says **“next later today”**; the accessible label says **“1 review; next later today if Again”**. The Mac's loaded `history.next[1]` is approximately `2027-04-22T16:55:02Z`, which is **09:55 tomorrow** in the same time zone. The phone reproduces with a normal tap on No idea, without needing a hover.

**Suspected code:** `apps/desktop/src/Timeline.tsx:23` rounds the remaining hours divided by 24. Eleven hours until tomorrow becomes zero days and therefore “later today.” The history/prediction is loaded with the question in `apps/desktop/src/Review.tsx:358`–385 and is retained through the interruption. This is separate from F131's singular month/year fix.

**Evidence:** [Mac](mac-timeline-1.png), [Mac repeat](mac-timeline-2.png), [iPhone](phone-timeline-1.png), [iPhone repeat](phone-timeline-2.png), [loaded dates](mac-timeline-1-calls.json), [clock and accessible labels](timeline-summary.json). Reproducer: `node codex-out/time/timeline.cjs`.

## Known findings seen again

None confirmed. F131's singular month/year wording remains correct in the checked cases (`in 1 month`, `in 1 year`); TIME-4 is a different date-boundary issue. TIME-2 is not the review-Undo refresh path described by F159.

## What passed

- **Time away:** On Mac, past-dated ratings were appended through `recordReview`, then taken back through `undoReview`; no review file was hand-edited. At the recorded 1/3/30/365-day boundaries, Home reported **1/3/6/8 due**, respectively, with **0 of 10 min** and `met: false`. The counts reflect this eight-exercise fixture and its exact timestamps, not a claim about a larger library. See [away-summary.json](away-summary.json).
- **Forgiveness:** All four return intervals on both platforms kept the goal at ten minutes, retained skills, offered Start review, and showed no missed-day penalty, streak, guilt message, or backlog counter to work down on the main screen.
- **Queue:** Every return opened on the first exercise in the returned start queue on Mac. Its full queue, skill priorities, retrievabilities and question order are saved in the `mac-away-*-review-calls.json` files. The year-away run includes all eight exercises. A separate pass walked all eight on-screen questions with Later on both platforms; the Mac sequence exactly matched the returned queue, with no duplicate or skipped exercise. See [order-summary.json](order-summary.json).
- **Midnight storage and ring:** Ratings before midnight count toward the previous local date; ratings after midnight count toward the new one. Each rating's elapsed time is capped at three minutes. The settled end ring and Home after leaving Review both showed the correct six minutes in the crossing session.
- **Spring DST:** New York 01:59 EST → 03:01 EDT on **March 8, 2026** saved about two minutes and displayed a two-minute ring, on both platforms.
- **Fall DST:** New York 01:59 EDT → 01:01 EST on **November 1, 2026** likewise saved/displayed two minutes, with no negative elapsed-time error. DST changes local offset without moving the underlying timestamp backward. See [dst-summary.json](dst-summary.json).
- **Travel:** After a two-minute New York session, fresh New York/Tokyo/return-New York contexts showed the correct current-local-day totals (**2, 0, 0 minutes** in the tested flight timeline). iPhone retained its writes by transferring its IndexedDB storage state between contexts. See [travel-summary.json](travel-summary.json).
- **Clock correction and Undo:** The saved rating dated one day in the future could be undone after clock correction, and its exercise could be rated again; TIME-1 concerns the next exercise's elapsed timer.
- **Dates inspected:** Home's weekday strip, the Learning skill page, the Testing Effect reader, Review's memory line, and Settings were inspected in the relevant contexts. Source publication dates retain their publication day rather than shifting a date-only value across time zones. The tested year-only and month-only dates retain their precision.
- **Relative grammar:** Direct production-function probes give `later today`, `tomorrow`, `in 1 month`, and `in 1 year` for 0/1/30/365-day spans. No `in 0 days`, `1 days`, `1 months` or `1 years` appeared in the tested screens/probes.
- **Reminder setting:** Set 09:30 through each platform's Settings, reopen in Tokyo, then New York: Mac shows **9:30 AM**, iPhone **09:30**, preserving local clock time. The Mac reminder was restored to Off afterward. See [reminder-summary.json](reminder-summary.json).
- **Reminder dates across DST:** Direct calls to the production `reminderTimes` function keep 09:30 on the days before, during and after each US transition, with the proper offset. See [date-functions-ny.json](date-functions-ny.json). Actual OS notification scheduling/delivery remains untested.

## Harness and evidence notes

`harness.cjs` connects to the supplied WebKit server; it does not start or stop a browser/server. Both page clocks use Playwright `page.clock`, and time zones use context `timezoneId`. On Mac only, time-sensitive bridge requests (`today`, `due`, `card`, `review`, `session`, `stats`) are fulfilled by the **real CLI against the assigned scratch library**, run with the page's timestamp and matching `TZ` through `clock-preload.ts`. Other requests use the supplied bridge. This is necessary because changing a page clock alone does not change the CLI process's clock. No canned Today, due, review, or scheduling responses were used. The phone runs its normal core in the page, so its page clock controls both UI and core. `*-calls.json` files save the Mac request/response evidence; `.txt` files save screen text. `age.ts` appends valid backdated reviews through core and records their IDs for Undo. Test ratings were taken back after journeys; append-only review/undo and session logs remain in the assigned scratch library. Scripts and screenshots are contained in `codex-out/time/`. Reproducers should run **one at a time** against the shared scratch library.
