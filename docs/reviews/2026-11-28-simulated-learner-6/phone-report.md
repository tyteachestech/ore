# Phone — one week away from the Mac

Used the supplied phone build at **localhost:1769**, WebKit at **390 × 844 with touch and 2× screenshots**, through **November 28–December 4, 2026**. Checkout: `747b4674ffb2b80c74e29f676132006c40c06e29`. One context and one page at a time; the continuing page was reloaded each day with `setSystemTime`, then closed and reopened in the same context on Day 7. Covered Today, six review bursts (13 ratings), reading, a Key point, one new highlight, source and skill notes, two source links in a skill note, search, drawer, skill pages, Settings, an article capture attempt and a YouTube capture. Day 3 used the app's largest supported type scale, `28/17`; Day 5 used the Light reader; Day 6 was reading-only. **One S2 finding; no confirmed loss of saved writing or ratings.** Skipped Mac AI, native iOS keyboard/selection handles, real lock/background events, simulator, physical-device sync, unsupported failure hooks and pure taste. No source files changed. [Friction log](log.md) · [all timings](felt-slow.md) · [daily data](daily-audit.json).

## Finding

### 1. Large-text search hides which result is the note or Key point — S2 · iPhone

The same long-titled source appears as a source-text result, a Key point result, and a source-note result. At maximum text size all three show the same shortened title. The identifying suffix is at the far end of a single clipped line; the matching words can also disappear from the one-line excerpt. I had to choose a row whose destination I could not read. This is the repeated cost across the week, not a visual preference.

**Reproduce from a fresh page with this library:**

1. Open **(Chapter 1) Artificial Intelligence: A Modern Approach (4th edition)**. Promote its “We have claimed that AI…” paragraph to Key point and give it the note `Phone week: distinguish rational action from copying human behavior.`
2. In the source note, append `Phone week: A rational agent chooses actions for the best expected outcome.` Leave the reader so it saves.
3. Set the largest supported text size (the supplied browser equivalent is `document.documentElement.style.setProperty('--type', String(28/17))`).
4. Today → Search → enter `Phone week`.
5. Compare the three Chapter 1 matches. Cancel, reopen Search and repeat. Closing/reopening the page with the same persisted library also reproduces it.

**Expected:** the result type and enough of its matching excerpt remain visible so the learner can pick the intended passage or note. **Actual:** the title, `· key point` / `· source note` suffix and excerpt share single-line truncation. On the final measurement the title had **316 pt** available; the unsuffixed title needed **880 pt**, and the suffixes are farther to the right. No alternate visible result-type label was present.

**Reproduced 3/3 openings:** twice on Day 3, then after a complete page close/reopen on Day 7. Selecting the source-note result did open the correct saved note; this is a choice/legibility problem, not broken search or data loss.

**Screenshots:** [Day 3 first](day3-search-large.png), [Day 3 repeat](day3-search-repeat.png), [Day 7 fresh-page repeat](day7-search-fresh-repeat.png), [correct note after selection](day7-note-relaunch.png). [Measured clipping](search-clipping.json).

**Suspected code:** `apps/desktop/src/Palette.tsx:276` appends the result type to the title; `apps/desktop/src/styles.css:2922` applies `white-space: nowrap`, hidden overflow and ellipsis to both title and excerpt. The phone search rules at `styles.css:3105` do not change that. No fix made.

Apple recommends supporting enlarged text and keeping controls/content perceivable; Ore's own iOS checklist requires readable large text and no misleading clipping. [Apple accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility).

## Known rows and regression checks

- **No previously fixed row confirmed to have returned.** The search finding is distinct from F87/F99 (source-list title wrapping) and F336/F443 (where a selected search result lands).
- **F876 / #593 held twice:** skill-note source links inserted on touch, with their result above the keyboard toolbar. The second result was **x=13, y=742, width=364, height=44**, bottom 786. [First picker](day2-link-picker.png), [second picker](day7-link-picker-repeat.png), [inserted second link](day7-link-kept.png). This is the app's toolbar, not a native software-keyboard test.
- **F877 / #593 held:** Day 4 saved **573,050 ms (9:33.050)**. The end ring and settled Today showed **9**, not 10. [End](day4-end-before-goal.png), [settled Today](day4-home-settled.png). Three ratings accrued over 180 s each; the 180 s per-rating cap plus the fourth rating's 33,050 ms gives the displayed total.
- **F738 held:** Finish saved the HTTP article's recall, said **“3 quiz questions wait on your Mac”**, and left the article in To read. The screen explained the limitation. [Finish](day6-finish-after-recall.png).
- Long revealed answers still needed vertical scrolling, especially at largest text (known F14); controls remained reachable. No worsening is claimed.
- #587's repaired imports and AI suggestion/citation paths were not reached with this phone's no-AI/browser capture limitations. They are **not verified by this run**. The remaining #593 import/Tutor fixes were also outside scope.

## What passed

- All 13 ratings persisted with the selected rating, answer, time and next due date; all reviewed non-new exercises were due when rated.
- Day changes reset the day's minutes; none of the daily first-seen counts exceeded the default limit of ten.
- A reading-only day added no review minutes and the following day imposed no guilt or reset.
- The existing AIMA highlight became a Key point with its note retained; the HTTP paragraph created one new highlight with a retained note.
- The source note survived a next-day reopening, later editing and a full page close/reopen. The skill note and links also persisted.
- Search found source-note, Key point and skill-note text; selecting the source-note hit landed in the correct note.
- Explain review named the Mac-only checker and supplied the answer/key points for self-assessment, with manual ratings available.
- Daily plan `breakfast while away` survived both reload and fresh-page relaunch.
- Light reader text and annotations remained readable; Aa and source-action controls checked had no target below 44 pt after accounting for pseudo-element expansion.
- Source action sheet dismissed with a scripted downward touch swipe; scripted left-edge swipe returned to the list. These use the harness's synthetic touch-event approach, not native gesture recognition.
- Visible Sources controls measured at least 44 pt. Settings switches' visual track is 31 pt tall, but taps just outside it still toggled twice; no small-target defect is inferred from the rectangle alone.
- Failed article capture retained the URL and explained the next step. The YouTube capture retained its source title/author and explicitly deferred its transcript to the Mac.

## Library and daily checks

The effective library is the read-only seed plus IndexedDB file replacements. [audit.py](audit.py) reads saved copies only. The seed contained **67 sources and 38 exercise files**; the final library has **68 sources**, with the YouTube source added and the article still queued. [Final IndexedDB](final-db.json), [individual ratings](exercise-audit.json). “Due at 08:00” below counts active-source live/draft exercises with a saved prior schedule at or before that opening time. New material is listed separately in `daily-audit.json`; this audit checks membership and recorded dates, not an independent implementation of FSRS mathematics or priority ordering.

| Day | Date | Due at 08:00 | Ratings / first seen | Saved review time | End receipt: kept / memory days |
|---|---|---:|---:|---:|---:|
| 1 | 2026-11-28 | 2 | 1 / 0 | 0:35.083 | 1 / +7 |
| 2 | 2026-11-29 | 1 | 2 / 1 | 0:13.345 | 2 / +31 |
| 3 | 2026-11-30 | 0 | 2 / 2 | 1:47.920 | 2 / +5 |
| 4 | 2026-12-01 | 0 | 4 / 4 | 9:33.050 | 4 / +9 |
| 5 | 2026-12-02 | 0 | 2 / 2 | 1:50.664 | 2 / +5 |
| 6 | 2026-12-03 | 3 | 0 / 0 | 0:00.000 | No session |
| 7 | 2026-12-04 | 4 | 2 / 0 | 1:49.874 | 2 / +30 |

The end receipts contain the counts shown above. Captured end-ring minutes match saved time on Days 3, 4, 5 and 7 (1, 9, 1, 1). **Days 1 and 2 screenshots were taken before the ring number settled**, so their end-ring text was not independently verified. Some memory-day counters were also still animating in screenshots; the receipt numbers are not claimed as final screenshot readings. Total credited time is **15:49.936**. Review time includes deliberately advanced thinking time and foreground inspection overhead; the very short Day 1/2 reviews were automation-paced, not claims about realistic human answer speed.

The queued article failed browser cross-origin fetch checks on each day's reopen; the native importer was not tested. The YouTube source remains marked as owing a transcript, and its browser player could not start. These prevent completing those two learning tasks in this harness, but are not evidence that the native app's capture/player is broken. The saved source and pending URL survived relaunch. The only recorded page errors were cross-origin fetch failures; no render crash was observed.

## Where the minutes went

| Day | Review credited | Reading / notes | Adding | Measured waiting* | Lost / extra effort |
|---|---:|---|---|---:|---|
| 1 | 0:35.083 | AIMA definition, existing highlight promoted; duration unmetered | MDN article queued; end-to-end wait unmeasured | 2.886 s | Article not readable in browser harness |
| 2 | 0:13.345 | Source note, AI skill note and first link; unmetered | YouTube source saved; transcript deferred; end-to-end wait unmeasured | 3.669 s | Video transcript unavailable without Mac |
| 3 | 1:47.920 | Large-text note search and reopen; unmetered | None | 2.259 s | 2 ambiguous search openings; recovery time unmetered |
| 4 | 9:33.050 | Settings cue; reading time not measured | None | 2.203 s | None confirmed |
| 5 | 1:50.664 | Light reader, source-note revision; unmetered | None | 2.700 s | None confirmed |
| 6 | 0:00.000 | HTTP article, new highlight, recall; unmetered | None | 2.012 s | 3 quiz questions deferred, no content lost |
| 7 | 1:49.874 | Reopen notes, second skill link; unmetered | None | 2.745 s | 1 ambiguous search repeat; recovery time unmetered |

*Waiting is the sum of recorded, non-overlapping action completion bounds. It overlaps review/reading time and must not be added to those columns. Reading and writing were not continuously timed; no invented minutes are assigned. Deliberate typing delays, screenshot waits, automation timeouts and scripted swipe durations are excluded. No whole-week elapsed time is presented as learner time.*

## Felt slow

- Initial launch and daily reloads took **1.114–1.275 s** to the selected readiness check. Fresh-page relaunch is included in the complete ledger. Intermediate blank duration was not separately measured, so this is not a silent-loading finding.
- The slowest ordinary tap completion was **444 ms** on Done immediately after the first end screen. Several other taps took about **340–415 ms**, often while the preceding screen was moving. Playwright's actionability wait is included.
- Explicit Check-to-rating-control readiness took **46–78 ms** in the measured samples. Later instrumented rating-to-next-Check readiness took **59–107 ms**.
- [Every measured action, slowest first](felt-slow.md) distinguishes the tap-call bound from explicit readiness. No assertion of “no response within 100 ms” is made from a tap-call duration alone.

## Boundaries

Only `codex-out/phone/` was written directly. Library changes went through the phone UI; `~/Ore`, `/Applications/Ore.app`, other testers' folders and ports were untouched. No servers, watchers, browsers or simulator were launched or stopped. The owned context is closed and the supplied WebKit connection disconnected. No product tests, build, commit or push were run for this findings-only task.
