# Codex sweep 10: triage

Two testers on `32f3dc4`: months of review on the Mac and iPhone (`months-report.md`), and feeds and network failures (`offline-report.md`). Three findings, all real, all fixed.

| Finding | Verdict | Cause | Fix | Guard |
|---|---|---|---|---|
| MONTHS-1: a review left after midnight shows yesterday's minutes in the end ring | Real, S2, Mac and iPhone. Reproduced on the phone: "the end ring shows 6 min, but today has 0" | `Review.tsx` read the new day's start again only after a rating past midnight (F184). Leaving with no rating since handed the end screen the Today read before the session, and `lapPlan` never counts below it | One `newDay` in `Review.tsx` sets the day's start for the rating path, for leaving (the end screen reads the new day as its start, which this session added nothing to) and at midnight itself (`useDay`), so the quick quiz's ring also starts the new day without waiting for a rating. A session's level-ups still count from where it began. Home already reads Today again at midnight (F172) | `F365`: phone journey `a review left after midnight with no rating since shows the new day's minutes in its end ring` |
| OFF-1: a truncated feed removes its cached posts | Real, S2. Red: refresh reported no failure for the cut-off body | linkedom's forgiving XML parser read the cut-off body as a feed with no posts; refresh replaced the cache with anything that didn't throw | `parseFeed` refuses a feed whose root (`rss`, `feed`, `rdf:RDF`) never closes: "<host> sent a feed that stops partway." Refresh's existing error path keeps the last posts and the Feed shows the error with Try again, as for an HTML answer. A whole feed with no posts is still no error | `F366`: `a feed cut off partway keeps its last posts and says why` (fixture `packages/core/test/fixtures/feeds/truncated.xml`) |
| OFF-2: repeated items use up the 30-post limit | Real, S2. Red: `findFeed` counted 31 posts for 2 distinct ones | `refreshFeeds` took the first 30 entries, and only `feedView` dropped copies | `parseFeed` drops a post's copies (newest kept) as it reads the feed, before the limit; following it counts each post once | `F367`: `repeated items don't use up a feed's posts` (fixture `packages/core/test/fixtures/feeds/duplicates.xml`) |

## What the testers said passed: out of scope

- Months: saved reviews and FSRS schedules (408 Mac, 120 phone) match ts-fsrs; nothing to fix.
- Months: opening queues follow D22/D24 order and the three-exercise gap; nothing to fix.
- Months: Home's due count matches `ore due` on both platforms; nothing to fix.
- Months: the ten new exercises a day were never exceeded; nothing to fix.
- Months: the three-hour session and bonus laps (180 min, +170); nothing to fix.
- Months: skipped days show zero, a week away opens a normal session, levels never dropped; nothing to fix.
- Months: spring and fall DST add about two minutes, never negative; nothing to fix.
- Months: Today CLI timings stayed flat (72 ms to 77 ms median); nothing to fix.
- Offline: refresh replaces edited, added and removed posts; nothing to fix.
- Offline: a missing, empty or HTML answer keeps the posts with Try again; nothing to fix (OFF-1 now joins this path).
- Offline: the 14-day cutoff, 360 rows from 12 feeds and a 5,000-item feed's 30; nothing to fix.
- Offline: a late Feed answer, and posts kept by a note survive their feed dropping them; nothing to fix.
- Offline: a link added twice keeps one source and its note; failed adds keep the URL and create nothing; nothing to fix.
- Offline: tutor, grading, enrichment and Explain failures each offer Try again and recover; nothing to fix.
- Offline: the phone reads loaded content offline and queues links for the Mac; nothing to fix. No phone Feed (D107).

## Review of #443: Review and feeds

| Item | Verdict | Cause | Fix | Guard |
|---|---|---|---|---|
| 4: ratings after midnight whose Today read failed counted as none | Real. F373 | A failed read left the day unturned; `finish()` (and the midnight effect) then called `newDay(today, 0)` | `turnedMs` keeps what was rated since midnight that no new day's start counted; `newDay` gets it (capped by the day's minutes) and clears it, and undoing such a rating takes it off | phone journey `phone: a rating after midnight whose day could not be read still counts on the end ring` |
| 5: a whole feed with trailing junk was called cut off | Real. F374 | The check wanted the root's close at the very end, comments aside | A feed is cut off only when its root never closes; what follows the last close is sliced off before parsing | core `a whole feed with something after its end, a script or NULs, is read…` |
