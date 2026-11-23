# iPhone UX findings — round 7

Tested checkout `36342bd9fe29bf74647754f75e2ac94fc62b2b9b` through the supplied phone build at `http://localhost:1766/`, connected to the supplied WebKit server. Completed two continuous fresh-page learning journeys at 390×844: Today, two Fact exercises and a typed Explain, session end, reading/highlight/note, a link added, a skill and its Forge, Settings, and drawer organization. These were task journeys, not timed twenty-minute endurance tests. Different content included an original 24-chapter EPUB, a Japanese source, the repository’s illustrated PDF fixture, and a YouTube link. Confirmed the three candidates twice at 390×844 and twice at 375×667, with touch and 2× screenshots. Read the working agreements, daily-session description, findings registry, sweep history, round 5/6 reports and iOS-check rules. Skipped excluded findings, F493/F494, pending-write Undo, visual taste, Mac pages, native keyboard/system gestures, simulator, real AI and iCloud sync. Only `codex-out/phone/` was written; no app code, registry, installed app or real library was changed.

## Findings

### 1. Chapter recall has no touch completion or cancellation; Source returns to unreadable dots

**S2 · iPhone · New**

1. From a fresh page, tap **Add a link → Choose a file or photo** and import `codex-out/phone/bus-book.epub`.
2. Open **A Field Guide to Learning on the Bus**. Open **Sections → Chapter 2: The route and the map**.
3. Tap **Recall this chapter**, just before chapter 2. This recalls chapter 1.
4. Under the chapter heading in the note, type a sentence about the chapter.
5. Look for a touch action to finish or cancel this recall. Tap the top-left **Source** button.
6. Open **Source actions** to look for a way to end the chapter recall.

**Expected:** A touch control records the chapter recall or cancels it while keeping the writing. Returning to the source ends the hidden-text mode, or clearly offers the action needed to do so.

**Actual:** The note offers only Source as its navigation action; the note-editing toolbar has formatting actions, not recall completion. Source returns to the book with its text replaced by dots. The menu’s Finish starts the whole-source finish flow; it is not a chapter-completion action. There is no Show source or cancel-chapter action. Back to Today and reopening makes the book readable again and preserves the note, but the chapter is still offered for recall. A diagnostic **⌘Enter** ends and records the chapter recall, proving the command exists but is missing a touch route. The resulting unavailable-AI message is not the finding.

**Reproduced:** 4/4 focused fresh-page confirmations, twice at each size, plus both broad journeys. No injected failure, delay, AI response or library mutation is required. A preliminary four-run confirmation also reproduced the missing actions; `chapter-results.json` is the final confirmation with text entered specifically beneath the chapter heading.

**Screenshots:** `chapter-note-390-1.png`, `chapter-hidden-390-1.png`, `chapter-note-375-1.png`, `chapter-hidden-375-1.png`, plus the matching `-390-2` and `-375-2` files, all in `codex-out/phone/`. `chapter-keyboard-diagnostic-*.png` shows the keyboard-only path. Broad-session evidence: `j1-chapter-source-hidden.png`, `j2-chapter-hidden.png`.

**Code:** `apps/desktop/src/Reader.tsx:1501` enters the chapter block and sets `hideSource` true. The only callers of `endBlock` are the keyboard handlers at `Reader.tsx:2507` and `Reader.tsx:2512`. `Reader.tsx:3601` explicitly excludes Show source from the phone. `apps/desktop/src/phone/PhoneApp.tsx:1031` makes Source change only the note’s visibility, leaving the chapter block active. This conflicts with the iOS checklist’s touch exit requirement; D115 defines chapter recall but does not justify a keyboard-only phone flow.

### 2. A PDF error sends the learner to an action the phone does not have

**S2 · iPhone · New · Error-path finding**

1. From a fresh page, import `packages/core/test/fixtures/intake/files/figures.pdf` through **Add a link → Choose a file or photo**.
2. Make the original PDF’s asset read fail. The confirmation uses a Playwright route abort for `**/library-file/**/source.pdf`; it does not alter the source’s text or the command response.
3. Open **Figures in a paper → Source actions → Original page**.
4. Read the error: **“This file’s pages can’t be shown here. Open the original from ⋯ to see them.”**
5. Tap **Source**, then **Source actions**.

**Expected:** The error names an available phone recovery action, such as retrying or opening the file through a supported route.

**Actual:** The menu has **Original page**, which repeats the failing view, but no **Open original**. The error view itself has no retry/open control. Following the stated next step is impossible. The readable imported text remains available.

**Reproduced:** 4/4 fresh-page fault-injection checks, twice at each size. Initially noticed when the browser harness could not serve a newly imported binary. **Missing PDF bytes are not reported as an app defect.** The finding is the misleading recovery instruction: the same application error branch runs after any original-file read failure, while the phone menu deliberately removes the named action for files without a URL. No claim is made about how often native file reads fail.

**Screenshots:** `codex-out/phone/original-error-{390,375}-{1,2}.png` and `codex-out/phone/original-menu-{390,375}-{1,2}.png`. Exact menu snapshots and absence checks are in `confirm-results.json`.

**Code:** `apps/desktop/src/OriginalPage.tsx:131` supplies the unconditional instruction. `apps/desktop/src/Reader.tsx:3417` filters out the `original` action on the phone unless the source has a URL. These are app branches, independent of the browser shim. The fix need not add a new feature: the error must at least offer an honest next step.

### 3. “Recall this chapter” is only a 32-point touch target

**S3 · iPhone · New · Measured rule violation**

1. From a fresh page, import and open the EPUB in finding 1.
2. Use **Sections → Chapter 2** and inspect **Recall this chapter** immediately above that heading.
3. Measure the button and check the elements just outside its top and bottom edges.

**Expected:** An actionable area at least 44×44 points, per `.claude/skills/ios-check/SKILL.md`.

**Actual:** The button is **32 points high**, with neither a larger actionable wrapper nor a `::before`/`::after` hit extension. It remains 32 points high with Ore’s text scale set to the standard `--type: 1`. The area below it belongs to the chapter heading. This leaves a short touch target for a recurring reading action. Centre taps worked; this is a verified target-size violation, not a claim that the button never responds.

**Reproduced:** 4/4 final fresh-page measurements, twice at each size, each measured at the supplied and standard text scales. Preliminary measurements agreed.

**Screenshots:** `codex-out/phone/chapter-target-{390,375}-{1,2}.png` and `codex-out/phone/chapter-target-standard-{390,375}-{1,2}.png`. Geometry, pseudo-elements and neighbouring hit elements are in `chapter-results.json`.

**Code:** `apps/desktop/src/Margin.tsx:126` renders the button directly in the non-actionable margin. `apps/desktop/src/styles.css:1171` styles `.chap-sign` without a 44-point minimum or hit extension, and there is no phone override for it.

## Known rows seen come back

None confirmed. No excluded open row is re-reported. The chapter findings are separate from F505’s new-try fields and F73’s heading positioning. The PDF finding concerns its recovery instruction, not F379’s previously blank CJK rendering.

## What passed

- Both sessions completed two Fact ratings and one typed Explain; manual key-point marking worked without AI.
- Leaving review reached the end screen; Done returned to Today with recorded review time.
- The 24-chapter EPUB imported, listed its chapters, jumped to chapter 18, and reopened at that chapter after leaving.
- A book highlight and a Japanese highlight saved through the normal selection actions.
- The book note and Japanese note retained their exact words after leaving and reopening.
- Japanese Find matched a word inside sentences and moved to the next match.
- The illustrated PDF imported its text and two figures; after supplying its actual saved binary bytes through the harness route, both pictures loaded.
- A PDF figure opened full-screen on one tap and dismissed on one tap; Original page rendered a page after the same harness correction.
- A video link added and opened in both sessions; the source explained that its transcript would come through the Mac.
- A Teaching try recorded a use and showed it on the skill page; a Creativity try retained its If correction after leaving and reopening.
- Settings retained changed review preferences; Weekdays only updated Today, and the second session retained its 15-minute goal and disabled mole voice.
- Moving Craft and Life through their collection menus immediately changed the drawer’s order in the respective sessions.
- Chapter-recall writing survived leaving and reopening, even though the recall could not be completed by touch.

## Evidence and limitations

All paths above are relative to the repository. `driver.cjs` and `actions.log` preserve the exploratory actions; `observations.log` records snapshots and measured results from the reading exploration onward. `journey2.js` preserves the second broad journey. `confirm.js` tests all three candidates; `confirm-chapter.js` refines the chapter checks by typing beneath the scaffolded heading and scrolling the standard-scale button into view. To replay the bounded confirmations while the supplied services run:

```sh
node codex-out/phone/run-confirm.cjs
node codex-out/phone/run-confirm.cjs chapter
```

One context and one page were open at a time. All test contexts/pages were closed. No server, watcher, extra browser or native application was started or stopped. The unrelated untracked `docs/reviews/2026-11-23-codex-ux-sweep-7/` directory was present before testing and was left alone.

The seed lacks books, videos and PDFs. Test material entered only through the app: an original 24-chapter EPUB (`bus-book.epub`), an original Japanese Markdown file (`japanese.md`), and the repository’s illustrated PDF. File selection uses Playwright’s file-input API; the native picker itself was not tested. Selection uses a DOM Range to reach the app’s highlight actions; native selection handles were not tested. Drawer long presses use stationary touch events. Ordinary button actions use taps.

The browser shim maps original files to `/library-file`, but newly imported binaries exist only in IndexedDB. For the first journey’s successful PDF viewing, a route returned the exact imported binary bytes read from IndexedDB; no content or app state was changed. The missing pictures before that correction are excluded. The PDF error confirmations explicitly abort the original-file request and test the error instruction only.

The YouTube oEmbed responses were controlled fixture metadata so the real importer could run without native-fetch/CORS differences. Playback could not be certified: the supplied shim rejects native `player_port`, and `apps/desktop/src/Video.tsx:95` consequently reports that the player could not start. That error is a harness limitation, not a finding. Transcript import/sync and playback remain unverified.

Desktop-hosted WebKit reports a 13px system body font, so Ore sets `--type` to about 0.765. Broad journeys used that environment unchanged; target confirmations also measured `--type: 1`. Native Dynamic Type, keyboard positioning, real-device gestures and iCloud behavior are outside this result. No AI output or missing AI result is counted as a defect.
