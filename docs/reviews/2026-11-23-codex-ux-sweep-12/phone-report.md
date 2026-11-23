# iPhone UX findings — round 12

Tested the supplied phone build at `http://localhost:1766/` through the existing WebKit server, with touch and 2× screenshots; checkout `1726dc8fc6264b8e62c045922063ef6ab285f579` (#510). Completed two continuous daily journeys, each starting in fresh browser storage at 390×844: Today, two Fact ratings and a typed Explain, review ending, reading with a new Key point and a saved/reopened note, adding and reading a link, a skill and its existing Forge try, Settings, and drawer organization. Used the audio lecture and the finished FSRS note instead of round 11's Testing Effect/Agents reading paths; recorded a use of an existing try instead of adding another. Then checked three uncertain interactions twice at 390×844 and twice at 375×667, in four fresh contexts. **No new S1, S2, or S3 finding confirmed.** The six-source seed includes prior reviews and active tries, but is not a large-backlog performance test. It contains no video lesson, so the two folded-transcript fixes received code inspection only. Skipped Mac pages, native simulator/device behavior, artificial failures/delays, pending-save Undo, excluded known rows, visual taste, and exhaustive repeats of previous control audits. These were task journeys, not timed twenty-minute endurance tests. All tester-written files are inside `codex-out/phone/`.

## Findings

None confirmed. This is a bounded result for the supplied seed and browser environment.

### Three hesitations checked again

Each sequence below passed **4/4**: two fresh runs at each size. Exact values are in [confirm-results.json](confirm-results.json); [confirm.cjs](confirm.cjs) preserves the bounded sequences.

1. **Does opening an audio highlight show the passage and retain its note?**
   1. From Today, open **Lecture 4 the testing effect → Collected → Highlights**.
   2. Tap **the memory gets stronger 0:15** once.
   3. Type a note, tap the source title to close the popup, and reopen the same Collected highlight.
   
   Expected and actual: the first tap opens the popup within the window; the exact note returns. The popup measured `x=12, y=269.36, width=366, height=152` at 390 points and `x=12, y=269.36, width=351, height=152` at 375 points. This source has a plain audio transcript, so this does **not** verify folded video transcripts. Code inspected: `apps/desktop/src/Reader.tsx:1881–1900`, including the phone's wait for the source screen to slide back before opening the passage. Screenshots: `confirm-audio-{390,375}-{1,2}.png`.

2. **Does Back discard an unfinished Forge reflection, or lose the try when its source opens?**
   1. Open the drawer → **Storytelling & Writing → Forge → Outline Thursday's video on the spine before writing**.
   2. Tap **I did it**, type in **How did it go?**, then use the top **Forge** back button before saving.
   3. Reopen the try and **I did it**. Save with **Again**.
   4. Open the passage under **From**, then tap **Back**.
   
   Expected and actual: the exact draft returns; saving records one use; Back from the source returns to the same try with its saved reflection. Code: `apps/desktop/src/Forge.tsx:188–218` keeps the reflection per try and clears it after successful saving; `:600–606` opens its passage. `apps/desktop/src/phone/PhoneApp.tsx:820–827,857–863` opens/closes the source without clearing the underlying skill page; `:1445–1466` retains its Forge subpage. Screenshots: `confirm-forge-{390,375}-{1,2}.png`.

3. **Does a collection rename save when the learner leaves without pressing Return?**
   1. Open the drawer, hold **Craft**, and choose **Rename…**.
   2. Type a name, then tap **Today** to leave the drawer.
   3. Reopen the drawer; rename the same collection a second time and leave the same way.
   4. Reopen the drawer again.
   
   Expected and actual: both names save, the second edit starts from the renamed collection, its skills remain grouped, and the rename offers Undo. Code: `apps/desktop/src/phone/PhoneApp.tsx:1373–1396`; the field's blur saves the typed name and the drawer renders the updated groups. Screenshots: `confirm-collection-{390,375}-{1,2}.png`.

## Known rows seen come back

None confirmed.

- **F530 / first tap on a folded transcript highlight:** runtime verification unavailable. The assigned library has six sources, no `video` metadata, and no video-card transcript. The change is present at `Reader.tsx:1888`: it opens the transcript and waits two animation frames before locating the passage and popup. The audio highlight pass above is adjacent coverage only.
- **F531 / library search landing in a folded transcript:** runtime verification unavailable for the same reason. `apps/desktop/src/Find.tsx:141–148` now brings the match into view through each scrolling ancestor, inner first. That is a code-inspection result, not a runtime pass.
- **F69 / Move to To read:** the finished FSRS note moved to the To read list immediately after the source action and Back, without reload (`j2-to-read.png`).
- **F273 / Settings reaching Today:** changing the goal to 15 and 20 respectively updated Today and remained selected on reopening Settings in the two journeys.

## What passed

- Both fresh journeys completed two Fact exercises and one typed Explain with manual key-point marking and ratings; the phone explained that AI checking runs on the Mac.
- Leave review reached the end screen, and Done returned to Today with the recorded review time: one minute in the first journey and less than one minute in the faster second.
- Review time is counted per rated exercise, capped at three active minutes each (`Review.tsx:53,661,747,753`); no clock manipulation was used.
- The audio lecture's Play and Pause responded; its saved highlight opened from Collected and its highlight note persisted. This does not certify audible output, native background audio, or remote controls.
- A new Key point saved in the audio lecture and in the finished FSRS source, and Collected reflected each addition.
- Both source notes reopened with the exact text written before Source → Back → reopen.
- The finished FSRS note moved into To read immediately, and only The Story Spine remained under Done.
- Both added article links appeared on Today with title and author and opened through their final sentence.
- Both journeys edited the existing storytelling try's When cue and recorded one use with its reflection, immediately visible on the try page.
- The first journey's source passage opened from Forge and returned to its saved plan; the four independent confirmations also preserved the use and unsaved reflection.
- Settings retained the two daily-plan cues and their selected 15/20-minute goals after leaving and reopening.
- Craft and Life renamed to Creative practice and Personal practice respectively, and remained renamed after reopening the drawer.
- No page errors were recorded by the listener attached to each owned page.

## Evidence and limits

- Broad journey screenshots are named `j1-*` and `j2-*`. `actions.jsonl` records driver inputs; `observations.log` records snapshots and results. `journey2.cjs` contains the beginning of the second journey; its remaining steps are in the action log.
- `driver.cjs` uses the supplied WebKit connection and phone URL only. A fresh context gives each independent run fresh IndexedDB/local storage. At most one owned context and one page were open. The driver was restarted once after the main confirmations for a screenshot follow-up; all owned contexts/pages were closed and the drivers exited. Shared services were left running.
- Ordinary controls used touch taps. Long presses used stationary synthetic touch events at the real element's coordinates. Source selection used a DOM Range plus mouseup to reach Ore's highlight actions; native selection handles were not tested.
- `article.html` is an original test article returned through Playwright routing only for the two `https://example.org/ore-round12-*` links. The app's actual phone importer performed both imports. No command results or stored library contents were fabricated; routing avoids native network/CORS differences.
- Early snapshots sometimes included a screen still sliding away. One confirmation screenshot appeared to omit the Forge back control; a fresh follow-up found it at `(12,0,44,44)`, visible in `check-forge-back-control.png`. A coordinate tap at its centre opened Forge (`back-coordinate-result.png`). No persistent missing Back control was confirmed. `check-back.cjs` preserves that follow-up.
- An early attempt treated confidence choices as buttons; their actual role is radio. Other corrected automation mistakes included an obsolete screen selector, an exact try label that changed after adding its When cue, a scrim-centre tap under the drawer, and an overlong terminal input. None is reported as an app bug.
- Native keyboard avoidance, iOS selection handles, edge gestures, system Undo, haptics, Dynamic Type, background/relaunch, real AI, native networking, and iCloud remain unverified. The desktop-hosted WebKit text scale was left unchanged. No simulator or service was started.
- Git status stayed as at entry: the pre-existing untracked `docs/reviews/2026-11-23-codex-ux-sweep-12/` directory. No implementation, findings-register, other tester folder, real library, or installed app was changed. No fixes, commits, pushes, or test-suite runs were performed under this findings-only scope.
