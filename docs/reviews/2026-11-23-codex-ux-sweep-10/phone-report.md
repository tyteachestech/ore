# iPhone UX findings — round 10

Tested checkout `8cfe0cc0a9d6d1d96be854f116362add0eb5b4c7` at the supplied `http://localhost:1766/`, through the supplied WebKit connection, with touch and 2× screenshots. Started with the new Sources Filter and Select features (#500, D348), then completed two continuous learner journeys in fresh browser storage at 390×844: Today, two Fact ratings and a typed Explain, review ending, source reading/highlighting, a saved source note with a link, link capture, a skill and its Forge, Settings, and drawer organizing. These were complete task journeys, not timed twenty-minute endurance tests. Read the working agreements, daily-session document, findings register, prior phone sweep reports and iOS-check rules. Rechecked note-link Back, Linked from and review history from round 9. Checked three candidate trouble spots twice at 390×844 and twice at 375×667. Skipped Mac pages and Claude Academy import; the tutor is deliberately unavailable on the phone under D78.3/D145, so its failed-chat-list fix was not exercised. Also skipped excluded known rows, pending-write Undo, artificial save delays/failures, visual taste and exhaustive repetition of earlier passes. Wrote only in `codex-out/phone/`.

## Findings

### 1. Empty filter results offer a “Clear them” target under 44 points

**S3 · iPhone · New · Measured touch-target rule violation**

1. From a fresh page, open the drawer → **Sources**.
2. Tap **Filter → Kind → Audio**. Tap outside the sheet to close it.
3. Tap **Filter → Author → Erik Schluntz and Barry Zhang**. Tap outside again.
4. The list says **No sources match these filters. Clear them**.
5. Inspect the **Clear them** button's bounds and surrounding hit area.

**Expected:** The recovery action has at least a 44×44-point actionable area, per `.claude/skills/ios-check/SKILL.md` → Touch. This is the offered way to recover from an ordinary empty result while using the new filters.

**Actual:** The button is **55.25×14.41 points** in the supplied environment. With Ore's text scale set to the standard baseline (`--type: 1`), it is **72.22×18.84 points**. Neither pseudo-element provides a hit extension, and the surrounding paragraph is not actionable. A point 20 points below the button's centre hits the paragraph in `elementFromPoint`, not a button. The filter tags themselves have 44-point targets; this recovery control does not.

**Important limit:** WebKit's touch adjustment successfully activated Clear them when tapped 20 points below its centre in all four runs. Clearing restored all six sources. This is a confirmed size-rule violation and small recovery affordance, **not** a reproduced dead tap, inaccessible list or data loss.

**Reproduced:** **4/4** fresh-storage confirmations: twice at 390×844, twice at 375×667. Every run measured both the supplied and standard text scales. No AI, delayed command, failed write or storage alteration was involved.

**Screenshots:**

- [390-point phone](clear-target-390-1.png) and [second run](clear-target-390-2.png).
- [375-point phone](clear-target-375-1.png) and [second run](clear-target-375-2.png).
- Standard-text comparisons: [390-point phone](clear-standard-390-1.png), [375-point phone](clear-standard-375-1.png); matching `-2.png` files record the second runs.
- Exact bounds, pseudo-elements, hit results and successful recovery: [confirm-results.json](confirm-results.json).

**Suspected code:** `apps/desktop/src/phone/PhoneApp.tsx:1341` renders the inline `<button className="link">Clear them</button>` in the empty-state paragraph. `apps/desktop/src/styles.css:3052` styles `.phone-empty` but gives its button no target minimum or extension. By contrast, the new filter tags explicitly get a 44-point target at `styles.css:4116`. The control is rendered and sized by application code, independent of the native Tauri shim; the standard-scale measurement rules out the harness's smaller type as the cause.

No S1 or S2 finding was confirmed.

## Known rows seen come back

None confirmed.

- **F522 passed:** Back from a source opened through a note link returned to the originating note and retained its writing. The first journey also tapped a Linked from row and verified it opened the quoted note. Screenshots: [Back](journey1-note-back.png), [Linked from](journey1-backlink.png), [second journey's Back](journey2-note.png).
- **F523 passed:** A touch on the history line revealed all eight seeded ratings and dates in both journeys. [History screenshot](journey1-history.png); second journey's text is in `observations.log`.
- **F521 not exercised:** no tutor/chat-list UI is exposed on this phone build; the Mac page was explicitly out of scope.
- **F493/F494 passed for the covered new behavior:** filters and multi-source actions exist and work. The new small recovery target above is not a claim that either feature is missing again.

## What passed

- Kind values combined with OR: Audio plus Text showed all six seeded sources, and unticking Text left Audio active; ticks and sheet state stayed correct.
- Different fields combined with AND: Audio plus the Agents author's name correctly produced an empty list with both tags visible.
- Clearing filters restored all six sources, in all four confirmations.
- Skill filtering showed Learning's three sources, including both To read and Done sections.
- Selecting all three filtered Learning sources and removing Learning immediately emptied that filtered list; one touch Undo restored the exact three titles, 4/4 runs.
- Selecting two sources and filing them under Learning ended selection and showed a toast with Undo.
- Bulk Mark done followed by immediate touch Undo returned both selected sources to To read.
- Bulk Archive followed by immediate touch Undo restored both sources; archiving again, selecting both in Archive and tapping Restore returned both to Sources.
- The bulk-action bar stayed within both phone widths; its action buttons measured at least 44×48 points, in all four confirmations.
- Each continuous learner journey completed two Facts and a typed Explain, with manual key-point marking and rating when AI was unavailable.
- Leave review reached the end screen and Done returned to Today; the first journey showed one minute recorded. Review time is per exercise, capped at three active minutes per rating (`Review.tsx:53,661,747,753`); reading time is not counted.
- Both source-reading journeys created a Key point through the selection actions.
- Both source notes saved their exact text and an ID-backed `[[` link; following the link and returning retained the note.
- Both original test-article links imported through the real phone importer, appeared on Today and opened with their ending text.
- Learning and Teaching each accepted a Forge try, immediately listed it, and opened its saved plan and When cue.
- Settings saved `boarding the bus` and `sitting down for the ride home` through Back and reopening in the respective journeys.
- Learning and Teaching moved up through their drawer long-press menus and immediately appeared in the changed order.
- No page errors were recorded after the fresh-context error listener was installed.

## Other candidates checked and rejected

These are the other two trouble spots examined in the final four fresh runs, rather than additional findings:

1. **Filter choices might remain stale after a tick or lose the sheet when the list changes.** Audio's tick updated immediately; selecting Text widened the list to six, and unticking it kept the Audio filter. The same sheet allowed continued selection. Passed 4/4. Code inspected: `PhoneApp.tsx:1110–1118`, `Menu.tsx:354–374`, and `filters.ts:64–70`.
2. **Filing selected sources out of the currently filtered skill might leave stale rows or make Undo restore only part of the selection.** All three Learning rows disappeared after removal and returned together with one touch Undo, with identical titles before and after. Passed 4/4. Screenshots: `bulk-filtered-{390,375}-{1,2}.png` and `bulk-undo-{390,375}-{1,2}.png`. Code inspected: `PhoneApp.tsx:1038–1106` and `:1233`.

## Evidence and limits

- `drive.cjs` connects to the existing WebKit server; it never launches a browser or server. `helpers.cjs`, `journey2.cjs` and `confirm.cjs` preserve the reusable actions and bounded second journey/final confirmations. `observations.log` records output from the note checks onward; it is not a complete first-journey input transcript.
- Independent journeys and confirmations closed the previous context before making the next one. A new page alone can retain IndexedDB and navigation in this harness, so every independent run used fresh context storage. At most one owned context and one owned page were open.
- Ordinary controls used Playwright taps. Long presses dispatched stationary touches at the actual element's coordinates. Text selection used a DOM Range and mouseup to reach Ore's highlight actions; native selection handles were not tested.
- The two `https://example.org/ore-round10-*` requests returned the original fixture in `article.html` through Playwright routes. This exercises the real phone importer while avoiding native-fetch/CORS differences; no command result or saved library data was fabricated.
- The desktop-hosted WebKit detects a smaller system text scale (about 0.765). Broad journeys used it unchanged. Only target confirmation temporarily set `--type: 1`, then restored it. Native Dynamic Type, software keyboard, iOS edge gestures, haptics, notification delivery, background/relaunch, iCloud and real AI remain unverified. No simulator was started under this supplied-browser-only setup.
- Some exploratory selectors were corrected (the hidden drawer's Archive versus the bulk toolbar's Archive, a file input versus the Link field, and a changing key-point label). A first stationary hold used the wrong coordinates and was corrected before the drawer test. A repeated Back attempted to tap the screen while it was leaving. These are harness mistakes, not app findings.
- The report makes no claims about course bulk selection, real-device performance or scale beyond this seed.
- Git status remained the same as at the start: the pre-existing untracked `docs/reviews/2026-11-23-codex-ux-sweep-10/` directory. No implementation, findings-register row, real library, installed app, other tester folder or service was changed. No fixes, commits, pushes or app test-suite runs were performed, per findings-only scope.

All owned pages and contexts were closed, and the WebKit connection was disconnected. The shared server was left running. To replay while the supplied services are available, run `node codex-out/phone/drive.cjs` from the repository root, then enter `await runfile('helpers.cjs'); await runfile('confirm.cjs');` and finally `QUIT`. The helper/journey/confirmation files are async bodies loaded by that CommonJS driver, not standalone Node entrypoints.
