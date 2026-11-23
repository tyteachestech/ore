# iPhone UX findings — round 11

Tested checkout `1ff84280f018d7e6762906011b5150298be2377a` (#509) at the supplied `http://localhost:1766/`, using the supplied WebKit connection, touch, and 2× screenshots. Completed two continuous learner journeys, each in fresh browser storage at 390×844: Today, two Fact ratings and a typed Explain, review ending, a source with a new Key point and saved/reopened note, a link imported and opened, a skill and its Forge, Settings, and drawer organization. These were complete task journeys, not timed twenty-minute endurance tests. Then checked the three points below twice at 390×844 and twice at 375×667. Read the working agreements, daily-session document, findings register, iOS-check rules, sweep history, and relevant earlier reports. Skipped Mac pages, artificial slow/failed writes, pending-write Undo, visual taste, excluded known rows, and exhaustive repeats of earlier individual-control passes. **No new S1, S2, or S3 finding confirmed.** The supplied six-source seed has no video lesson: the three video-related round-10 fixes received code inspection only, not a runtime pass. All tester-written files are in `codex-out/phone/`.

## Findings

None confirmed. This is a bounded pass over the supplied phone seed, not certification of the whole app or Mac feature parity.

### Three points checked again, rather than reported as bugs

1. **“Clear them” still looks like a small inline link.** From a fresh page, open the drawer → Sources → Filter → Kind → Audio, dismiss the sheet, then Filter → Author → Erik Schluntz and Barry Zhang and dismiss again. The empty-state text itself measures 55.25×14.41 points, but #509 adds an actionable `::after` extension: its height is **44.41 points**, extending 15 points above and below. Hit tests 20 points above and below the text's centre resolve to the button. A touch 20 points below its centre clears the filters and restores the source list. At standard text scale, the extension is **48.84 points** high. **Passed 4/4**, two fresh runs at each size. This confirms **F528**, rather than reporting its old text-box measurement again. Code: `apps/desktop/src/phone/PhoneApp.tsx:1341`, `apps/desktop/src/styles.css:1918–1919`. Evidence: `confirm-clear-{390,375}-{1,2}.png`, corresponding `confirm-clear-standard-*` screenshots, and `confirm-results.json`.
2. **An Explain key-point label initially appeared untappable to automation.** Start review, rate the first two Facts, type an answer to the Explain question, choose Think so, and tap Check. Tap the middle of “Names fluency or familiarity.” The point becomes marked Got. Its whole row is **44 points high**; the button's invisible extension deliberately covers the adjacent text. The initial text-span locator refused because that button intercepted it; a real-coordinate tap works. **Passed 4/4** at the two sizes. Code: `apps/desktop/src/Review.tsx:1328–1341`, `apps/desktop/src/styles.css:3297–3298`. Evidence: `confirm-mark-{390,375}-{1,2}.png` and `confirm-results.json`. This was a locator mistake, not a dead learner tap.
3. **Leaving a note without a Save button needed a persistence check.** Open The Testing Effect → Note, replace the note, tap Source and Back, reopen the source and Note, then edit the text again and repeat. Both the first and second versions reopen exactly as typed. **Passed 4/4** at the two sizes, in addition to notes in both broad journeys. Code: `apps/desktop/src/Notes.tsx:121` flushes pending text; `:167–175` captures and flushes the editor when it closes. Evidence: `confirm-note-{390,375}-{1,2}.png` and exact `noteFirst`/`noteEdited` values in `confirm-results.json`.

An immediate screenshot during the marking transition made Hard's label look dark against its old background and caught the checkmark before it appeared. A settled screenshot shows the checkmark and a readable dark label on a light button: `rating-contrast-390-1.png`. Computed colours were `rgb(27,27,27)` on `rgb(228,228,226)`. The background transition is in `styles.css:2448`, and the settled suggested-rating treatment in `retro.css:193–194`. No persistent contrast defect was reproduced; this is not a finding.

## Known rows seen come back

None confirmed.

- **F528 passed live:** Clear them's extended hit area and recovery action work, 4/4 dedicated fresh runs, plus the exploratory check.
- **F525, F526, F527: runtime verification unavailable in this seed.** Its six sources have no `video` metadata or folded video-card transcript. I did not open the Mac page, alter library files, fabricate a video document, or claim native playback worked. Code inspection confirms Find observes the `hidden` attribute (`Find.tsx:220`); search opens the matching transcript (`Reader.tsx:1270`); Collected reveals it before locating the highlight popup (`Reader.tsx:1886`, helper at `:3542`); and Open on YouTube uses `playerLink(doc)` (`Reader.tsx:3594`), which prefers `item.video` (`original.ts:33`). These are inspection results, not runtime passes.

## What passed

- Both fresh journeys completed two Fact exercises and one typed Explain, with manual key-point marking and rating when grading was unavailable on the phone.
- Leave review reached the end screen and Done returned to Today; the first journey recorded one minute and the quicker second journey showed less than one minute.
- Review time is counted per rated exercise, capped at three active minutes per exercise (`Review.tsx:53,661,747,753`); reading is not counted. No clock manipulation was used.
- The Testing Effect and Building Effective Agents each accepted a new Key point; Collected increased, and the highlight actions showed the new type.
- Both source notes saved their exact replacement text and retained it after Source → Back → reopen.
- Both test article links imported through the phone importer, appeared on Today, and opened through the final sentence, with title and author present.
- Learning and Teaching each accepted a Forge try and immediately opened the saved plan and When cue.
- Settings retained `boarding the bus` and `sitting down for the ride home` after leaving and reopening.
- Learning and Teaching moved up in the drawer through their long-press menus, immediately showed the changed order, and showed an Undo toast.
- Empty filter results cleared with a tap within the newly extended hit area at both phone sizes.
- No page errors were recorded by the listener installed for the fresh second journey and confirmation pages.

## Evidence and limits

- Broad-journey screenshots: `j1-{review,explain,end,note-reopened,highlight,import,forge,settings,organized}.png` and `j2-{explain,end,note-reopened,highlight,import,forge,settings,organized}.png`. The first `j1-review` screenshot is the What to review picker; subsequent screenshots show the review itself.
- `actions.jsonl` records commands submitted to the driver. `observations.log` records output after helper initialization. `journey2.cjs`, `journey2-rest.cjs`, `import.cjs`, and `confirm.cjs` preserve bounded task sequences; the log also records corrected selectors. The two journeys each stayed in one page throughout. Each independent confirmation closed its predecessor's context before opening fresh storage. At most one owned context and one owned page were open.
- Ordinary controls used taps. Long presses used stationary synthetic touch events at the actual row's coordinates. Reading selection used a DOM Range and mouseup to reach the app's highlight actions; this does not certify native selection handles. The initial unsupported Touch constructor and a text-span/button interception were harness errors, not findings.
- `article-1.html` and `article-2.html` are original test articles served only for the two `https://example.org/ore-round11-*` requests through Playwright routes. They exercise the actual phone importer without native-fetch/CORS differences. No command outputs or saved library state were fabricated.
- Desktop-hosted WebKit reports a smaller system text scale (`--type: 0.765`). Broad journeys used it unchanged. The Clear them confirmations additionally measured `--type: 1`, then restored it. Native keyboard, selection handles, system Undo, edge gestures, haptics, Dynamic Type, background/relaunch, real AI, native network handoff, iCloud, and simulator behavior remain unverified. No simulator or service was started.
- The `sources: 0` field in `confirm-results.json` comes from an unused, incorrect `.phone-list` diagnostic selector; it is not a source count. Recovery was checked by Clear them disappearing and the restored Lecture row becoming visible. No claim relies on that diagnostic.
- Git status remained the same as at entry: the pre-existing untracked `docs/reviews/2026-11-23-codex-ux-sweep-11/` directory. No implementation, findings-register, real-library, installed-app, other tester folder, or service changes were made. No commits, pushes, fixes, or test-suite runs were performed under this findings-only scope.

Replay the four confirmations with `node codex-out/phone/driver.cjs`, enter `await eval(fs.readFileSync('codex-out/phone/helpers.cjs','utf8'));`, then `await runfile('confirm.cjs');`. End with EOF to close the owned page/context and disconnect. The shared WebKit server stays running.

All owned pages and contexts were closed at the end, and the driver exited after disconnecting from WebKit. The shared services were left running.
