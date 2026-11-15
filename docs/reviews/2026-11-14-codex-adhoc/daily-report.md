# Daily learner rehearsal — daily

## Coverage

Rehearsed capture → reading and annotation → review beyond the daily goal → return the next day on the supplied Mac page (1650, bridge 1651, `/tmp/claude-501/adhoc/lib-daily`) and iPhone page (1656). Used WebKit at 1280×800 and 390×844 with touch, screenshots at 2×. Imported the live [GPT in 60 Lines of NumPy](https://jaykmody.com/blog/gpt-from-scratch/) article and plain text on Mac; attempted both on iPhone. Checked the article against the live page, saved files, notes, highlights, undo/redo, both review endings, minutes, bonus laps, and schedules. **Two new S2 findings; no observed S1 blocker.** The phone cannot paste plain text into Add, an existing capability limit. Native iOS selection handles, keyboard, three-finger/shake gestures, notifications, device sync, and actual AI generation were not tested. Review used seeded exercises because AI is disabled. Review durations and tomorrow were accelerated, not 14 minutes of uninterrupted human study. All changes and evidence are confined to this tester's output folder and app actions on its assigned test libraries. No application code or shared findings table was changed.

Repository source inspected: `1ffe1feb28498fb80607b16f48c8a38fa6739afd`. The supplied running builds were not rebuilt; their exact build commit was not independently established.

## New findings

### 1. A newly made highlight has no touch Undo

**S2 · iPhone · Daily-session step 6, Read; also “Any time: nothing is lost.”**

A learner can make a highlight or change its meaning, but cannot reach the app's undo history from the reader using its touch controls. Removing a highlight manually is possible; recovering the preceding state of a changed highlight or its note requires remembering and recreating it. The history itself works with a hardware keyboard.

1. Start a fresh phone page and open a readable source. For the exact reproduction, add the article above and open it.
2. Scroll to “Generating Text,” allow scrolling to stop, and double-tap the paragraph beginning “This process of predicting a future value.”
3. Tap the margin to keep the new highlight and close its popup.
4. Look for Undo in the visible controls, highlight popup, and Source actions. There is no Undo control and no Undo toast from creation.
5. Repeat on the paragraph beginning “Generating a single word is cool.” Again there is no touch Undo.
6. With a hardware keyboard, press ⌘Z. The app can undo a new highlight; it then exposes Redo in a toast. ⇧⌘Z or tapping that Redo restores it.

**Expected:** A reachable touch route to the same history used on Mac, including plain highlight creation, Key point changes, and highlight notes.

**Actual:** Those operations enter history silently. The only initial route found is a keyboard shortcut; an Undo/Redo toast becomes reachable only after a keyboard undo or a separate destructive action. Source actions does not expose history.

**Reproduced:** 2/2 distinct plain-highlight creations with zero Undo buttons after closing. Separately exercised Key point and highlight-note undo/redo with ⌘Z/⇧⌘Z, and tapped a resulting Redo toast successfully. Native iOS undo gestures were outside this browser run; no bridge from those gestures to this JavaScript history was found in the phone code. This finding is specifically the missing app touch route, not a claim that a physical shake was tested.

**Evidence:**

- `codex-out/daily/phone-highlight-no-touch-undo-1.png`
- `codex-out/daily/phone-highlight-no-touch-undo-2.png`
- `codex-out/daily/phone-note-undo-hardware.png`
- `codex-out/daily/phone-keypoint-undo-hardware.png`
- `codex-out/daily/phone-files-after-review.json` — persisted annotations and notes.

**Suspected cause:** `apps/desktop/src/Reader.tsx:1835` records new highlights with `"quiet"`; `:2114` does the same for highlight notes. `apps/desktop/src/Toast.tsx:99` suppresses their toast, while `:149–162` exposes the history through keydown. The phone has no replacement history control.

### 2. Import drops an explicitly identified article author

**S2 · Mac and iPhone · Daily-session step 6, Read, and its capture prerequisite.**

The learner must leave the material and repair its provenance manually, despite the source identifying its author.

1. On a fresh Mac page, open **+ Add** and paste `https://jaykmody.com/blog/gpt-from-scratch/`.
2. Add it and inspect the byline: title and January 30, 2023 are present, but the author is the empty **Author** control.
3. Compare the live page's header/title and its HTML: `<link rel="author" content="Jay Mody" href="https://jaykmody.com/">`.
4. Import the same URL on the independent phone library and open it. The date appears without Jay Mody; Source actions offers **Add author…**.

**Expected:** Preserve Jay Mody as author when importing this article, alongside its title and publication date.

**Actual:** Neither saved `doc.md` has an author. Reopening the Mac source still shows the blank author field. The phone separately reproduces the omission.

**Reproduced:** 2/2 independent imports, one per platform; also persisted after reopening. The phone live-network adaptation below changes transport headers only, not the HTML.

**Evidence:**

- `codex-out/daily/mac-import-result.png`
- `codex-out/daily/mac-author-reopened.png`
- `codex-out/daily/phone-article-top.png`
- `codex-out/daily/phone-files-before-review.json` — phone `doc.md` and original HTML.
- Mac saved original: `/tmp/claude-501/adhoc/lib-daily/items/2026/gpt-in-60-lines-of-numpy-01M7CE7RWC45XDHDRS9RW3X1BK/source.html:12`.

**Suspected cause:** `packages/core/src/ingest/web.ts:369–376` takes paper/forum overrides or Defuddle's author. It has no fallback for this explicit `link[rel=author]` metadata when Defuddle returns none.

## Known rows and limitations observed

- **No fixed findings row was confirmed to recur.** In particular, the no-AI grading paths remained usable; the tested review-start and rating paths did not reproduce F67/F142.
- **Phone pasted text is still unsupported** — the limitation explicitly recognized in F32/F78, not a recurrence of their incorrect-error-wording bug. Two different plain-text submissions to Add both retained the input and said “That isn’t a link: paste one that starts with https://”. This blocks the requested pasted-text part of capture on the phone and requires another device or a file. See `phone-pasted-text-refused-1.png` and `phone-pasted-text-refused-2.png`. `apps/desktop/src/phone/AddLink.tsx:32` sends the input to the URL inbox. It was not counted as a new finding.
- **Fresh plain-highlight Escape behavior follows D15.** Escape cancels an untouched selection; Enter or clicking away keeps it. Initial runs using Escape therefore cancelled two selections rather than saving them. The completed checks used Enter and verified `open → deleted → open` in the saved annotation log. See `mac-highlight-history-confirmed.json`. This is not an undo failure.
- The first Mac resume measurement returned to zero; after repeating with a fully rendered source and settled scroll, it returned exactly to 6960 px. The phone returned from 6243 to 6234 px with the same passage visible. No repeatable resume failure is reported.

## Review and next-day results

| Check | Mac | iPhone |
| --- | --- | --- |
| Ratings | Again, Hard, Good, Easy, Good, Good | Same |
| Missed exercise returns | Hypercorrection returned as exercise 5 after three intervening exercises | Same |
| First ending | Cart forced with `Math.random = () => 0.1`; 12 minutes, +2 bonus | Same |
| Second ending | Non-nap branch with `Math.random = () => 0.9`; 14 minutes, +4 bonus | Same |
| Logged active time, first session | 720,000 ms | 720,000 ms |
| Logged active time, day total | 850,444 ms | 850,201 ms |
| Display rule | Rounded minutes; per-rating time capped at 180,000 ms | Same |
| Home after first ending | 12/10; goal met; hint says 2 due | 12/10; picker has the remaining two |
| Home after second ending | 14/10; no Start review; two new exercises start tomorrow | Same |
| Independent FSRS recomputation | All 6 recorded due dates and stabilities match | All 6 match |
| Tomorrow Home | 0/10; yesterday's met day retained; Start review returns | Same |
| Tomorrow queue | Exactly the two previously waiting new exercises | Same |

The second session answered the new Story Spine exercise and the missed hypercorrection exercise. After that successful relearn, hypercorrection's recorded due date moved to November 16 UTC; its earlier Again date was superseded. Consequently **none of the six ratings should be due during the tested November 15 UTC return**, and none appeared. The two new questions were “What does the Story Spine force a writer to show?” and “Which two variables does FSRS track per card?”. Both were labeled New. Later walked this queue without adding ratings. The system's local day was Pacific time, so these timestamps are late evening on the preceding local calendar date.

Evidence: `mac-fsrs-audit.json`, `phone-fsrs-audit.json`, `mac-review-trace.json`, `phone-review-trace.json`, `mac-review-responses.json`, `mac-tomorrow-calls.json`, `mac-tomorrow-queue.json`, `phone-tomorrow-queue.json`, and `phone-day-rollover.json`. Screenshot names include `*-cart-early`, `*-cart-middle`, `*-cart-end`, `*-other-ending`, `*-home-final`, and `*-tomorrow-home`.

## What passed

- Article title and January 30, 2023 date survived both imports.
- All 49 headings including the title, 69 code blocks, and eight images survived on both platforms; all eight image dimensions matched the Mac import once the phone asset stand-in could read newly imported bytes.
- Article beginning, middle, final section, and all seven footnotes survived. The full block comparison found 387/417 blocks verbatim after whitespace normalization; inspected differences were the title/date moved to the header, nested table-of-contents/list representation, footnote markers, and rendered math text. No missing prose or code body was found. Code blank lines and tabs are normalized, so this is not byte-identical preservation.
- The article's original HTML was kept. Its embedded table illustrations survived as images; the live page has no HTML table, so editable table-cell parity was not exercised.
- Mac plain pasted text imported with its first line as title and the final line intact.
- Mac settled scroll position survived Home → reopen at 6960 px; phone reopened on the same passage, within 9 px.
- Mac word, phrase, and sentence highlights worked. Final confirmed plain-highlight undo/redo restored the saved annotations, not just the paint.
- Phone paragraph highlights of different lengths worked by double tap; Key point marking and its note persisted across reload.
- Highlight-note and Key point undo/redo worked through keyboard history on both platforms. Source-note typing undo/redo worked in both editors; notes survived closing and reopening.
- Review offered a useful manual grading path when AI was absent: explicit failure/reason, key-point marking, and working ratings.
- Review continued beyond the goal, a missed exercise returned, and both endings left the correct minutes and bonus numbers.
- The new exercise was labeled New, and successful ratings updated schedules exactly as FSRS predicts.
- Both tomorrow checks reset today's minutes without resetting learned progress or dropping ratings.

## Harness adaptations and remaining scope

1. **Live phone fetch:** the initial browser attempt failed CORS and visibly retained the link with “Your Mac will try it.” Real iOS uses native `http_fetch` (`phone/core.ts:69`), absent from this page. Removed that failed inbox entry through the UI, then used Playwright `route.fetch()` to fetch the real upstream response and fulfill it with `Access-Control-Allow-Origin: *`. No article text was substituted. This failure is not reported as an app bug.
2. **New phone images:** the supplied `convertFileSrc` maps to `/library-file`, whose server cannot see images created in the page's IndexedDB. All eight image byte arrays were present. A test route read those existing bytes, read-only, from IndexedDB and served them to the reader. All eight rendered. No missing-image product finding is claimed.
3. **Time:** Mac review advanced `Date.now()` in the page by three minutes per first-session rating, then one minute per second-session rating. The real CLI recorded elapsed time and applied its cap. Phone used `page.clock.fastForward()` with the same advances; its core shares the page clock. Actual automation dwell time was also counted, explaining the roughly ten seconds above 14 minutes.
4. **Mac tomorrow:** moving only the browser clock initially left the CLI on today; that is a harness limitation, not a Home bug. `tomorrow-route.cjs` then dispatched that Mac page's ordinary `/ore` commands to the same CLI and assigned library, with `clock-next-day.cjs` preloaded to move only that process's Date. It did not start/stop a bridge or change the machine clock. The UI then showed the real CLI's next-day `today`/`due` results. All library mutations remained app-dispatched commands.
5. **Touch scope:** taps and paragraph double taps used touch. Programmatic scrolling was used to cover a long article; native momentum, selection handles, edge swipe, software keyboard, and native undo gestures need a Simulator/device pass. One synthetic scroll probe emitted a missing-`touches` error; it came from the test's incomplete event, not a learner action, and is excluded. The only other captured page error was the initial CORS refusal.
6. **AI scope:** no AI results were expected. No new AI exercise generation or Finish quiz quality claim is made. Prequestions did not prevent reading. Cart screenshots sample its early/middle/settled states; they are not an exhaustive frame-by-frame animation collision audit.

`audit-fsrs.cjs` and `compare-article.py` are read-only checks. `driver.cjs` is the persistent CommonJS WebKit driver; `helpers.cjs` holds the interaction helpers. Screenshots and text snapshots are beside this report. No fixes, commits, merges, installs, or changes to another tester's resources were made.
