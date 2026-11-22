# iPhone UX findings — 2026-11-22

Tested the supplied iPhone build at `http://localhost:1766/` in connected WebKit, using touch, 2× screenshots, and fresh 390×844 and 375×667 contexts (one context and one page at a time). Checkout: `c839b84fdf8b18666ffba4301d517a0be11181bd`. Covered source-note toolbar/to-do/library links, reader appearance/outline/pictures/Find, an audio source, questions and answer corrections, the Forge through three uses and “It’s mine,” skill settings and notes, Settings, source search, and archive/restore. Read the working agreements, iOS checklist, daily-session document, findings registry, sweep history and round-one report. Skipped round one's already-passed Finish/recall, highlight-note persistence, review endings, Add-link drafts, source filing and failure-injection paths; skipped listed known issues and visual taste. Native keyboard, selection handles, system undo gestures, haptics, notifications, iCloud and real AI are not verified by this browser run. Not answered here had no applicable matched-question entry in this seed. Sources exposes fixed To read/Done groups, with no sort/filter control; the drawer exposes navigation rather than its own search field. No repository source, real library, installed app or other tester's resources were changed. All artifacts are in this folder.

## Findings

### 1. Collapsing a question discards a correction to its saved answer

**S2 · iPhone · New**

1. Start a fresh page. Open **Learning** from Today.
2. Tap **Add a question**, type `Bus question`, and press Return.
3. Tap the question. Type `First answer` and tap **Save**.
4. Tap the saved answer to edit it. Replace it with `Unsaved correction`.
5. Tap **Bus question** to collapse it, then tap it again to reopen.
6. Leave for Today and reopen Learning and the question.

**Expected:** Save the in-place correction on leaving the field, or retain the draft when collapsing the question. D211 says a click/tap away saves an in-place edit. The app must not silently discard the correction.

**Actual:** `First answer` returns. The correction is also absent after leaving and reopening Learning, with no warning or recovery. This loses the pending correction, not the previously saved answer. The separate field for adding a new answer does retain drafts; editing an existing answer does not.

**Reproduced:** 2/2 dedicated fresh-page runs, once at each size; also observed in the exploratory journey. No delayed writes, failures, AI or storage changes were injected.

**Screenshots:**

- `codex-out/phone/loss-before-390.png`
- `codex-out/phone/loss-after-390.png`
- `codex-out/phone/loss-before-375.png`
- `codex-out/phone/loss-after-375.png`

**Code:** `apps/desktop/src/Questions.tsx:209` stores the piece's draft only in component state; its field at line 238 has key handling but no blur save. `SkillPage.tsx:801` collapses the question directly; line 848 unmounts its `AnswerBox`. `Questions.tsx:104` has a `commitPieces` function, but the parent's collapse does not call it. This is the app's ordinary edit/unmount path, independent of the test harness.

### 2. A saved answer correction reverts on screen until the skill is reopened

**S2 · iPhone · New**

1. Start a fresh page. Open **Learning**, add `Bus question`, open it, type `First answer`, and tap **Save**.
2. Tap the saved answer, change it to `Saved correction`, and press Return to save.
3. Wait for the edit to finish. The open answer shows `Saved correction`.
4. Tap **Bus question** to collapse it, then reopen it.
5. Return to Today and reopen Learning and the question.

**Expected:** The collapsed row and reopened answer show the saved correction immediately.

**Actual:** Both the collapsed row and the reopened answer show `First answer`. Only leaving and reopening the skill reveals `Saved correction`. The write succeeded; the question's parent retains the old answer. This makes a successful correction look lost and invites editing obsolete text.

**Reproduced:** 2/2 dedicated fresh-page runs, once at each size, with 700 ms after saving and after reopening; also observed during exploration. In each run the corrected text appeared immediately after Return, the old text appeared after collapse/reopen, and the corrected text returned after reopening Learning.

**Screenshots:**

- `codex-out/phone/saved-edit-390.png` — saved correction before collapse
- `codex-out/phone/saved-collapsed-390.png` — collapsed row shows old text
- `codex-out/phone/saved-stale-390.png` — reopened answer still shows old text
- `codex-out/phone/saved-reopened-390.png` — reopening the skill reads the correction
- Equivalent `saved-edit-375.png`, `saved-collapsed-375.png`, `saved-stale-375.png`, `saved-reopened-375.png` in the same folder.

**Code:** `apps/desktop/src/Questions.tsx:89` updates only `AnswerBox`'s local answer list after a rewrite; it does not notify its parent. `SkillPage.tsx:813` renders collapsed answers from the unchanged `q.answers`, and line 849 passes that same question into a newly mounted box. Its parent reload callback is on `onSaved` at lines 853–856, which the rewrite path does not call. `ore.ts:44–52` also does not broadcast `answer` writes. The fresh skill read proves this is stale UI, not a refused or missing harness write.

## Known rows seen again

None reported as regressions. The two findings are different from F351/F356/F357, which concern pending-write Undo/Redo; neither reproduction uses Undo, Redo or an injected delay. Small-looking reader controls were checked against their CSS hit-area extensions before considering touch-size findings; a 28 pt visible Sections pill is not by itself a violation.

## What passed

- Source-note toolbar inserted a to-do and a library link; both remained after closing and reopening the note at both sizes.
- A note's Learning link opened Learning; the keyboard toolbar offered an explicit Hide the keyboard action.
- Aa changed size, spacing, margins, font and page; its light sheet fit both sizes and dismissed by tapping outside.
- Sections jumped to Patterns; a source picture opened and dismissed without trapping navigation at both sizes.
- Find located repeated `call` matches, advanced to another match and closed at both sizes.
- Adding an answer and marking a question Answered moved it to the Answered tab and retained the answer.
- The Forge added a try, saved a plan, recorded three uses, reached Yours through It’s mine, and retained a reflection draft across Back/reopen.
- Skill goal, importance, icon and name changes applied; To read/Done tabs switched; the skill note survived Back/reopen.
- Settings switches and reminder time saved through Back/reopen; the iCloud row correctly identified the scratch library as outside iCloud.
- Audio controls became ready, switched Play/Pause, accepted a forward seek and offered playback speed choices; audible output and OS audio controls were not assessed.
- Source actions archived a source; Archive opened it; Restore returned it to Sources.
- Search found a source by a word in its text and exposed its matching question separately.

## Artifacts and repeat command

`reproduction-results.json` records both findings at both sizes. `reproduce.cjs` contains the bounded reproduction; `driver.cjs` connects to the supplied server and closes only its own context when given `QUIT`. `remaining.cjs`, `actions.log`, screenshots and `remaining-results.json` document other journeys. The interactive log includes exploratory locator mistakes; those are not findings.

Run `node codex-out/phone/driver.cjs < codex-out/phone/reproduce-input.txt` from the repo root while the supplied services are running. It opens one page at a time, runs both sizes, writes evidence, then closes the connection. It does not start a server or browser.
