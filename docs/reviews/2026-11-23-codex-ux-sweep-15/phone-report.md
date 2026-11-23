# iPhone UX findings — round 15

Tested checkout `5ce841d` (#513) at the supplied `http://localhost:1766/`, through the existing WebKit server, with touch and 2× screenshots. Completed two continuous daily journeys in separate fresh contexts at 390×844: Today, two Fact ratings and a typed Explain, review ending, reading with a new Key point and source note, importing and opening a link, a skill and its Forge, Settings, and drawer organization. Used the habit source, The Story Spine, Habits, and Creator Business to extend rounds 11–12. Checked the shared typing change first, then repeated the three highest-consequence uncertainties twice at 390×844 and twice at 375×667. **No new S1, S2, or S3 finding confirmed; no known fixed row was seen to recur.** Skipped Mac pages, artificial failures/delays, pending-save Undo, excluded known rows, visual taste, and native-device behavior. These were task journeys, not timed twenty-minute endurance sessions. All tester-written artifacts are in `codex-out/phone/`.

## Findings

None confirmed. This result covers the supplied six-source seed and browser environment, not every phone feature.

### Three uncertainties checked again

Each sequence passed **4/4**, twice at each viewport, with a fresh page and storage for each run. Exact text and measurements are in [confirm-results.jsonl](confirm-results.jsonl); [confirm.cjs](confirm.cjs) contains the assertions.

1. **Does dismissing Add link lose a typed link, or prevent replacing it?**
   1. From Today, tap **Add a link**, tap Link, and type a URL.
   2. Tap outside the sheet, then reopen Add a link.
   3. Type a replacement URL over its selected draft.
   
   Expected and actual: the original URL returns exactly, selected; typing replaces it exactly. The Link field is 44 points high and fits both widths. No blocked keystrokes. Code: `apps/desktop/src/phone/AddLink.tsx:20–32,79` keeps the draft, restores focus, and selects it. Screenshots: `confirm-add-{390,375}-{1,2}.png`.

2. **Does typing with Review’s actions sheet open alter the Explain answer behind it?**
   1. Start review and rate the first two Facts to reach Explain.
   2. Type an answer with Return between two sentences.
   3. Open **Exercise actions**, then type a sentinel string while the sheet is open.
   4. Dismiss the sheet, tap the answer, and append another sentence.
   5. Check, mark both key points, rate Good, leave review, and tap Done.
   
   Expected and actual: Return inserts a newline; the sentinel never reaches the answer; the answer remains editable afterward; checking and rating complete. Code: `apps/desktop/src/Trap.tsx:46–48` rejects input outside the focused panel; `apps/desktop/src/Review.tsx:1174–1187,1256–1270` supplies the phone sheet and saves the answer draft. Screenshots: `confirm-answer-{390,375}-{1,2}.png`; broad journey sheet example: `j1-answer-sheet.png`.

3. **Does changing reading appearance overwrite a selected source note, or break subsequent note edits?**
   1. Open the long habit-title source from Today, tap **+ Note**, and type a note.
   2. Select its text, tap **Source**, then **Text and page**.
   3. Tab into the sheet and type a sentinel string; tap Larger text and Geist.
   4. Dismiss the sheet and return to Note. Append text, return through Source and Back, then reopen the source and Note.
   
   Expected and actual: appearance changes apply; neither the selected note nor its saved text receives the sentinel; the appended text survives reopening exactly. Every control in Text and page measures at least 44×44 points. The sheet is 390×324 or 375×324 and fits both viewports. Code: `apps/desktop/src/phone/ReadingLooks.tsx:58–74`, `apps/desktop/src/Trap.tsx:46–48`, and `apps/desktop/src/Notes.tsx:121–175`. Screenshots: `confirm-looks-{390,375}-{1,2}.png` and `confirm-note-{390,375}-{1,2}.png`.

These are passed checks, not severity-ranked findings. The sentinel tests supplement the ordinary journeys; no artificial delays or failed saves were introduced.

## Known rows seen come back

None confirmed.

- **F534 / #513:** the phone typing checks above passed. This is adjacent phone regression coverage, not a claim to have reproduced the original Mac shortcut route.
- **F533 / #512:** phone Search accepts a query, shows matching skills and sources, clears through its visible Clear button, and closes through Close. The desktop footer is hidden at both widths (`styles.css:3020–3021`). Evidence: `search-375.png`, `search-390.png`, and the visibility measurements in `observations.log`.
- **F532 / #511:** runtime verification unavailable. The assigned six-source library has no `video` metadata or folded video-card transcript. Code inspection only: `Reader.tsx:3550–3560` marks the transcript unfolding and opens it without restoring the old location. No video import or playback pass is claimed.

## What passed

- Both fresh journeys completed two Fact ratings and one typed Explain, including manual key-point marking when phone AI checking is unavailable.
- Leaving review reached the end screen; Done returned to the previous screen with recorded review time.
- Review time uses each rated exercise’s elapsed time, capped at three active minutes (`Review.tsx:53,661,747,753`); no clock manipulation was used.
- The habit source and The Story Spine accepted new Key points and highlight-note text; their source notes reopened with the exact text typed.
- Both added links appeared in the current source list and opened with author, headings, and the final sentence intact.
- Habits and Creator Business accepted new Forge plans and When cues; a try opened on one tap, and Creator Business’s try remained after leaving and reopening its Forge.
- Settings retained `boarding the bus` / Weekdays only and `the bus leaves` / Sound effects off after leaving and reopening.
- Renaming Habits to Daily Habits through the drawer’s Edit skill sheet saved on an outside tap and appeared immediately in the drawer.
- Moving Creator Business into Ty Teaches Tech updated the drawer immediately and displayed Undo (`j2-organized.png`).
- The initial appearance check changed text size, font, and page colour; the note remained intact and accepted another edit.
- No page errors were recorded by the listeners attached to owned pages.

## Evidence and limits

- Broad journey screenshots use `j1-*` and `j2-*`. `actions.jsonl` preserves driver commands; `observations.log` preserves snapshots, exact saved-text comparisons, and corrected automation errors. `j1-read-rest.cjs`, `journey2.cjs`, and `journey2-read.cjs` preserve substantial journey segments. `driver.cjs` and `confirm.cjs` are bounded and use the supplied connection only.
- `article.html` is an original test article returned only for the two `https://example.org/ore-round15-*` requests through Playwright routing. Ore’s actual phone importer performed the imports. This avoids desktop-WebKit/native-network differences; it does not certify native networking. No command results or saved-library state were fabricated.
- Ordinary controls used taps. Long presses used stationary synthetic touch events on the actual element. Reading selection used a DOM Range and mouseup to reach Ore’s highlight actions. Native selection handles were not tested.
- Hardware-style keyboard events checked typing, Return, selection, and the input guard. Desktop WebKit does not show the native iOS keyboard: keyboard occlusion, accessory controls, native gestures, system Undo, haptics, Dynamic Type, background/relaunch, iCloud, and native simulator behavior remain unverified. No simulator, server, watcher, extra browser, or Mac app page was started.
- Corrected harness mistakes included an incorrect Add label, treating Sources’ Done heading as a tab, targeting Text and page while the source had slid off-screen behind Note, a long terminal input, and resolving a long-press release through an accessibility locator after the menu hid the background. None is reported as an app defect.
- Only one owned browser context and one owned page were open at a time. Shared services and other testers’ resources were left alone. No implementation files, findings-register rows, real-library files, installed app, commits, or pushes were changed. Git status matched entry: the pre-existing untracked `docs/reviews/2026-11-23-codex-ux-sweep-15/` directory.

Cleanup verified: the owned page/context were closed, the WebKit connection disconnected, and the driver exited with status 0. The shared services remain running.
