# Keyboard learner — three-day Mac test

I used the release Mac page in shared WebKit for November 28–30, 2026, with the copied real library, keyboard input only, one owned context/page, 1280×800 and 2× screenshots. Each day included review, reading and annotation; across the days I exercised Later, Undo, interrupted answers, source notes, Finish/quiz, real AI grading, Ask about this, tutor citations/practice/kept exercises, Settings and Feed. Four repeatable findings emerged: passage selection lacks accessible state, and three transitions lose keyboard focus. No confirmed data loss or crash occurred. I read the prior two runs and known findings, and focused on keyboard continuity rather than repeating their import sweeps. I skipped iPhone, native VoiceOver speech, native menu-bar behavior, pointer-only endpoint editing, missed-day/bonus-lap behavior, exact 9:33 rounding, exhaustive Settings changes and full podcast consumption. Accessibility conclusions use role snapshots and DOM state, not a claim of an actual VoiceOver session. All output is in this folder; no product files were changed.

The [friction log](log.md) is the chronological account. [Felt slow](felt-slow.md) contains every recorded timing, sorted by duration. Screenshots have matching `.json` files with focus and role trees.

## Findings

### K1 — Selected passage is visible but has no accessible selection state

**S2 · Mac · Reproduced 2/2 sources.** This most directly obstructs learning: a learner using accessibility output cannot establish which words H will highlight or 2 will mark as a Key point. A sighted keyboard learner can use the visual box.

1. From a fresh Mac page, press Command-K, type `Spaced repetition`, select its source result and press Enter.
2. With focus in the reader, press ArrowDown, then Shift-ArrowDown.
3. Inspect the current accessible passage/selection, then press H to highlight the visually selected blocks.
4. Repeat on `How the web works` from Command-K.

**Expected:** moving/extending the passage exposes its current text and extent to assistive technology, with a named reading location. H acts on that discoverable passage.

**Actual:** the visible box moves and widens, but the role tree is unchanged. Focus remains an unnamed `.reader-scroll`; native text selection is empty; there is no active descendant or live announcement of the current passage. H still makes a highlight, so the hidden selection state has consequences. I had to read implementation code to confirm what would be marked.

**Evidence:** [single block](d3-reader-key-focus1.png), [extended box](d3-reader-key-focus2.png), [second source](d3-reader-key-repeat.png), [second-source state comparison](d3-reader-aria-repeat.json). The latter records `sameTree: true`, empty selection, no active descendant and no passage text in live regions.

**Suspected code:** `apps/desktop/src/Reader.tsx:2160` changes the internal block selection; `Reader.tsx:3677` renders the unnamed focused reader; `Reader.tsx:3850` renders `FocusBox`; `apps/desktop/src/Focus.tsx:66` makes that box `aria-hidden`. This is distinct from known F111, which concerns changing endpoints of an existing highlight.

### K2 — Following the first feed leaves the new post list without keyboard focus

**S2 · Mac · Reproduced 2/2 follows, with Undo between them.** This stopped ordinary arrow/Enter navigation immediately after a successful add.

1. Start from a fresh page against an empty Feed seed. Press Command-3.
2. Use Option-Tab to reach Follow, press Enter, and wait for its input to have focus.
3. Type `https://www.latent.space/feed` and press Enter.
4. After the posts appear, press ArrowDown and Enter.
5. Undo the follow and repeat the same path for the second reproduction. The final test library is already following it; use an equivalent empty-feed seed to reproduce from scratch.

**Expected:** when Follow closes and its empty-state opener disappears, focus moves to the populated Feed list, ready for arrows and Enter.

**Actual:** following succeeds, but `document.activeElement` is BODY. No row is current and those keys do not open a post. Navigating Home and then back to Feed restores list navigation. This is not the known “focused list has no visibly current row until Down” issue F547: the list itself does not hold focus here.

**Evidence:** [first occurrence](d1-followed.png), [repeat](d1-follow-focus-repeat.png); both paired JSON files record BODY after the populated list is present.

**Suspected code:** `apps/desktop/src/Add.tsx:118` calls `useFocusWhileMounted` without a fallback; `Add.tsx:146` closes after follow succeeds. `apps/desktop/src/util.ts:225` restores the opener only if it remains usable, otherwise needs a supplied fallback. `apps/desktop/src/Feed.tsx:132` focuses its list only on mount, not when empty Feed becomes populated.

### K3 — Saving a tutor exercise drops focus when its button becomes disabled

**S3 · Mac · Reproduced 2/2 distinct exercises on Days 1 and 2.** Saving succeeds, but the next keyboard action has no visible location in the conversation.

1. From a fresh page, open `How the web works` through Command-K, then open the tutor with Command-J.
2. Ask for DNS-versus-HTTP practice, and wait for a reply that offers an exercise. AI wording may vary; the reproduction requires the Add exercise button.
3. Use Option-Shift-Tab from the composer to reach the named Add exercise button.
4. Press Enter; wait for Exercise added.
5. Check focus, including after 500 ms. Repeat with a different proposed exercise.

**Expected:** the keep action retains a usable focus location, such as the composer or a focusable saved-exercise control.

**Actual:** the button becomes disabled and focus falls to BODY. There is no focus indicator in the tutor until navigation is re-established. This did not lose the exercise or its source evidence; both are present in files.

**Evidence:** [Day 1](d1-kept-exercise.png), [Day 2](d2-kept-focus-lost.png), matching focus JSON; `audit.json` lists both `from: tutor` exercise records and their evidence.

**Suspected code:** `apps/desktop/src/Tutor.tsx:304` marks the turn as kept; `Tutor.tsx:864` disables the focused button when that state changes, without handing focus elsewhere. This is separate from F892's repaired citation persistence.

### K4 — Home has no keyboard location on launch or after leaving a palette-opened reader

**S3 · Mac · Reproduced on all 3 daily loads, plus an isolated reader-return check.** Global shortcuts still work, so this adds orientation cost rather than blocking review.

1. Open a fresh Mac page and wait for Home's content.
2. Inspect focus: no control or named main region has it.
3. Press Command-K, open `How the web works`, then Escape to leave it. If a passage box is active, the first Escape clears it and the next leaves the source.
4. Wait at least 500 ms and inspect Home's focus again.

**Expected:** Home gives keyboard users a stable starting point, preferably Start review when available or another meaningful main control. Returning from a source restores a useful location even when no Home row was its opener.

**Actual:** focus is BODY and no control has a focus indicator. Enter happens to start review through a global handler, but accessible focus does not identify that next action. Tab traversal must establish a new location.

**Evidence:** [Day 1 Home](d1-home.png), [Day 2 Home](d2-home.png), [Day 3 Home](d3-home.png), [return from reader](d3-home-after-reader.png). All paired JSON snapshots record BODY.

**Suspected code:** `apps/desktop/src/Home.tsx:363` restores an `openedByKeys` Home row when one exists; the path has no initial/default fallback for launch or a source opened through Command-K. This is not F401's Review-Done path or F873's reopening-a-loading-reader path.

## Known rows seen again

No previously fixed row was confirmed to have regressed. Known open rows were not promoted into new findings. F111 endpoint editing was deliberately excluded; F547 was distinguished from K2's actual loss of list focus.

Checks of recent fixes:

- **#593 / F877:** at 9:13.484, both Home and Review's end showed 9 minutes and an unmet 10-minute goal. This checks the below-goal behavior, not the exact former 9:33 boundary.
- **#595 / F884:** an Again followed by ending/restarting Review returned after exactly three intervening ratings, before more new material.
- **#600 / F892:** both kept tutor exercises have anchored `evidence` in their Markdown frontmatter. Citation opening also reached a source through the keyboard. I did not wait until a later scheduled review of those kept exercises.
- **#600 / F893:** both case fields were keyboard reachable; filling them enabled Send, and Enter in Case B sent them with the general composer empty.
- Other phone/import fixes and F894's step-check persistence were outside these journeys.

## Day and file audit

The audit reads snapshots of this test library only. The initial library contained **67 canonical sources and 38 exercise files**, of which **27 exercises were not retired**. At the end it contained **69 sources and 50 exercise files**. The two retained new sources are the typed HTTP snippet and the highlighted Feed article. Three sources gained `finished_at`: How the web works, the HTTP snippet, and Spaced repetition. Twelve new exercise files include two explicitly kept from the tutor. Their AI metadata records vendor, model and prompt version.

| Day | Opening queue: previously rated + new | Effective ratings | First-time exercises completed | Review credit from files | End/Home check |
| --- | --- | --- | ---: | ---: | --- |
| Nov 28 | 2 + 10 = 12 | 1 Good | 0 | 33,631 ms | One kept; +11 days; below one minute |
| Nov 29 | 1 + 10 = 11 | 1 Again, 4 Good | 3 | 553,484 ms | First receipt 0 kept; next 4 kept/+7 days; daily 9 min |
| Nov 30 | 0 + 10 = 10 | 2 Good | 2 | 92,728 ms | Two receipts, each 1 kept/+2 days; daily 1 min |

Opening queue IDs exist in the corresponding file snapshots, and every previously rated opening entry's due date matches its latest effective saved review. At each day's opening, `active_ms` and `new_today` reset to zero. The ten-new limit was respected; this was not a saturation test of completing all ten. Day 1's undone API rating is absent from effective history. Its Day 2 Again due date was replaced by the successful retry's December 1 due date. The three newly reviewed DNS/HTTP exercises were due December 2; the Day 3 HTTP pair became due December 3; the initial Explain became due December 8. They were not prematurely returned on the next day.

The total is **8 effective ratings and 679,843 ms of credited review (11:19.843)**. `packages/core/src/study.ts:139` caps each review at three minutes; applying that rule to the saved elapsed times exactly matches the final `today` responses for all three days. Day 2 includes deliberately advanced thinking time, so this is counter validation, not wall-clock reading time. No missed day was simulated.

[Audit data](audit.json), [audit script](audit.cjs), the `*-files.json` snapshots, and [bridge responses](requests.jsonl) preserve the evidence. JSONL must be split on literal newline: some source text contains Unicode line separators inside JSON strings. Saved source notes contain the Day 1 text, the Day 2 retry sentence and the Day 3 spacing note. The interrupted Day 3 Explain answer also resumed verbatim in the app.

## Where the minutes went

Reading, adding and focus-recovery wall time were not continuously metered. Reporting the duration between tool calls as reading time would include screenshots, inspection and orchestration, so those cells remain explicitly unmeasured. Waiting below sums recorded foreground requests longer than one second; requests can overlap reading, review and one another, so these are service time totals, not additive learner minutes.

| Day | Review credited | Reading | Adding | Waiting measured | Lost/recovery |
| --- | --- | --- | --- | --- | --- |
| 1 | 0:33.631 | Unmetered; How the web works, partial then full Finish, 3 quiz answers | Unmetered; follow feed and keep 1 tutor exercise | 111.746 s foreground requests; 56.083 s background drafting | Two Follow focus losses; one tutor focus loss; Home unlocated; RSS Tab detour. Recovery seconds unmetered. |
| 2 | 9:13.484, including simulated thinking | Unmetered; reopened notes, tutor cases, Feed article, short-source Finish | Unmetered; typed source, retained Feed article, kept 1 tutor exercise | 56.396 s foreground; 31.119 s background drafting | Tutor/Home focus loss; one deliberate failed note save and recovery. No text loss. |
| 3 | 1:32.728 | Unmetered; Spaced repetition and Finish/quiz; second-source accessibility check | No new source; 1 background-drafted exercise | 88.378 s foreground; 36.782 s background drafting | Two sources with inaccessible passage state; Home focus loss. Recovery seconds unmetered. |

## Felt slow

The longest *foreground* wait was Finish's 55.565-second key-point request on Day 3. The longest request overall was 56.083 seconds of background exercise drafting on Day 1. These waits had working text; none was confirmed as a blank wait over one second. Page-measured tutor responses took 23.045 and 21.036 seconds on Day 2. Explain grading took 15.480 and 12.975 seconds on Day 3. Feed opening took 28.475 seconds on the bridge, with Opening visible.

The [full sorted ledger](felt-slow.md) includes **481 page measurements and 385 backend measurements**, including every measured long wait and the shorter transitions. Key-only timings establish handler return, not first-paint latency. No timed key-handler dispatch exceeded 100 ms. The first Explain grading wait was not measured to completion; the report does not substitute the much shorter time until rating controls appeared. Harness timeouts and incorrect readiness assumptions are excluded from learner waiting totals.

## What passed

- Home's Enter and Command-R opened review; answer and confidence fields, checking and numeric ratings worked by keyboard.
- Later/Undo restored the question; rating Undo removed the rating from effective history.
- Again survived a session restart and returned after three intervening reviews.
- Day changes reset counters, made new exercises eligible and respected saved due dates for the tested exercises.
- Command-K opened each tested source with focus in the reader, not the previous note editor (F158 held).
- Sighted keyboard passage selection, H, Key point and highlight notes saved correctly; save status was exposed.
- Source notes survived reopening and an injected save failure; the alert retained the draft until retry saved it.
- Finish, recall, quiz answer entry and Done worked by keyboard; all three finished sources are recorded.
- Ask about this opened, answered and closed one layer with Escape; the learner could still choose the recorded rating.
- Tutor citations opened sources; practice fields were named and reachable; saved chat and kept-exercise evidence persisted.
- Settings opened with Command-comma; tested Tab/Option-Tab traversal stayed inside it; Escape closed it (F253 held).
- Feed arrow selection, Enter opening, mark-read/Undo, and Control-Enter/Escape context-menu behavior worked once the list held focus.
- Only the owned test page/context were closed; shared servers and browser were left running. No repository fix, test-suite run or commit was appropriate for this findings-only assignment.
