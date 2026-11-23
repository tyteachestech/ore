# iPhone UX findings — round 8

Tested checkout `526311dd4ae5c5e0c67678b373275ee286f7806e` through the supplied iPhone app at `http://localhost:1766/` and connected WebKit. Completed two continuous learner journeys in separate fresh browser storage at 390×844: Today, two Fact ratings and a typed Explain, review end, reading/highlight/note, link capture, a skill and its Forge, Settings, and drawer organizing. These were task journeys, not timed twenty-minute endurance tests. New emphasis was exercise editing/history, the Dig, playlist capture, an audio transcript, and a long note with a table, equation and attached diagram. Confirmed the three findings twice at 390×844 and twice at 375×667, with touch and 2× screenshots. Read the working agreements, daily-session document, findings registry, sweep history, all seven earlier UX sweeps' passed sections, relevant decisions and iOS-check rules. Skipped excluded rows, F493/F494, pending-write Undo, visual taste, Mac pages, native keyboard/system gestures, simulator, real AI and iCloud. Feed and Ask your library are explicitly deferred on the phone (D107, D145); Explain needs Mac AI (D78, D97), and quick quiz is a Mac system shortcut/menu-bar window (D76), so their absence is not a new finding. Only `codex-out/phone/` was written. One context and one page were open at a time; all are closed.

## Findings

### 1. A playlist gets stuck behind a course action the phone never offers

**S2 · iPhone · New playlist path; related to F32/F78**

1. From a fresh page, tap **Add a link**.
2. Paste `https://www.youtube.com/playlist?list=PLAqhIrjkxbuWI23v9cThsA9GvCAUhRvKZ` and tap **Add**. This is the playlist URL already used by the repository's intake test.
3. Read the **Coming in** row on Today.
4. Reopen **Add a link** and look for the course action the message names.

**Expected:** Capture the playlist as a course, or give an accurate phone-specific next step. If importing it requires the Mac, make clear whether the existing queue will handle it or whether the learner must add it manually there.

**Actual:** The row says: “That link is a playlist. Add it as a course (in the app it’s offered as one; in Terminal, `ore add <link> --course`) to get each video as a lesson. Your Mac will try it.” The phone's sheet offers only Add and Choose a file or photo; the waiting row offers only Remove. No course or lessons arrive. The automatic Mac retry cannot resolve this particular refusal: the shared inbox command calls `addSource`, which refuses playlist URLs before downloading, rather than `addCourse`. The learner is told to look for an unavailable action and then wait for a retry that takes the same rejecting path. Manual addition as a course on the Mac is a different action; the message does not explain that distinction.

**Reproduced:** 4/4 final fresh-page confirmations, twice at each size, plus initial exploration. No network response, artificial delay, failure hook or AI is needed: playlist classification rejects the URL before any download. The Mac retry conclusion is verified from code, not by opening the Mac app or running its importer.

**Screenshots:** All under `codex-out/phone/`:

- `playlist-390-1.png`, `playlist-390-2.png`, `playlist-375-1.png`, `playlist-375-2.png` — refusal and waiting state.
- `playlist-add-390-1.png`, `playlist-add-390-2.png`, `playlist-add-375-1.png`, `playlist-add-375-2.png` — available Add actions.

**Code:** `packages/core/src/ingest/index.ts:121` supplies the desktop-only instruction. `packages/cli/src/cmd-items.ts:134` routes every queued link through `addSource`, including when the Mac processes it. `apps/desktop/src/phone/AddLink.tsx:112` does not translate this refusal; line 144 appends “Your Mac will try it.” D79 defines playlist-as-course capture, while D96 requires an actionable refusal. This finding does not require the phone to run yt-dlp; an honest manual-Mac handoff would address the misleading recovery path.

### 2. Returning to a long skill note loses the reading position

**S2 · iPhone · New**

1. From a fresh page, open **Learning → Your note**.
2. Paste the original Markdown in `codex-out/phone/long-note.md` into the note. Wait for its normal save.
3. Scroll down to **Final check** near the end. The table and opening paragraphs are now above the viewport.
4. Tap the top-left **Learning** Back button.
5. Tap **Your note** again.

**Expected:** Resume at the same place in the saved note, as the source note does. Briefly returning to the skill should not make a learner find their paragraph again.

**Actual:** The note opens at its beginning, **My learning plan**. In the final checks the scroll position went **476 → 0** at 390×844 and **694 → 0** at 375×667. The note's text and content height stayed unchanged. This is lost place, not lost writing; an edit at the end also saved and reopened correctly during the broad journey.

**Reproduced:** 4/4 final fresh-page confirmations, twice at each size, plus the second broad journey. A preliminary set at the standard text scale also reproduced it. No injected failures, layout changes or library edits outside the UI are required. `confirm-results.json` records the exact before/after text, scroll and heights.

**Screenshots:** `codex-out/phone/note-before-{390,375}-{1,2}.png` and `codex-out/phone/note-after-{390,375}-{1,2}.png`. Broad-journey evidence: `j2-skill-note-before.png`, `j2-skill-note-reopened.png`.

**Code:** `apps/desktop/src/phone/PhoneApp.tsx:405` renders `SkillNote` without a saved scroll or editor place; its scroller is at line 410. The conditional at line 1318 unmounts it on Back and creates it again on reopen. Compare `apps/desktop/src/Notes.tsx:503`, where source notes explicitly retain their scroll/caret. The iOS checklist requires returning to the previous place after interruptions; nothing in the skill-note decision exempts this screen.

### 3. The Dig's completion and exit controls are smaller than 44 points

**S3 · iPhone · New · Measured touch-target violation**

1. From a fresh page, open **Learning**.
2. Tap **What could you show you can do?**, enter `Explain retrieval practice to a beginner`, and tap the skill heading to save.
3. Tap **Dig**, then type a sentence into **What you remember**.
4. Inspect the actionable areas of **Close**, **Cancel**, and **Done**.

**Expected:** Each control has an actionable area at least 44×44 points, per the iOS-check Touch rule.

**Actual:** Close is **26×26 points**, Cancel is **30 points high**, and Done is **32 points high**. These measurements persist at both widths and at the standard iOS text scale. None has a pseudo-element extending its hit area or a larger actionable wrapper. These are the controls used to finish or leave a recall attempt on the move. Centre taps work; this finding is about the confirmed small targets, not a claim that the controls are dead or trap the learner.

**Reproduced:** 4/4 final fresh-page measurements, twice at each size, each checked at the supplied scale and at `--type: 1`. The Dig's typed draft survives Close/reopen, and Done saves the writing; those behaviors passed.

**Screenshots:** `codex-out/phone/dig-{390,375}-{1,2}.png` and `codex-out/phone/dig-standard-{390,375}-{1,2}.png`. Bounds, font sizes and pseudo-element checks are in `confirm-results.json`.

**Code:** `apps/desktop/src/Dig.tsx:147`, line 157 and line 160 render the three buttons. `apps/desktop/src/styles.css:1908` fixes Close at 26px, line 1914 fixes Cancel at 30px, and line 1622 gives the shared pill button its 32px height. There is no phone override or larger hit extension for these Dig controls.

## Known rows seen come back

- **F32/F78's unavailable-desktop-instruction behavior appears again for playlist URLs.** The previously fixed Browser-tab/paste messages were not retested and are not claimed to have regressed. Finding 1 identifies the different refusal string and the additional blocked inbox path.
- No other known fixed row was confirmed to recur. Excluded open rows and F493/F494 are not re-reported.

## What passed

- Both journeys completed two Fact ratings and one typed Explain, using manual key-point marking on the phone.
- Leaving review reached the end screen; Done returned to Today with recorded review time.
- Editing the first Fact's question preserved its eight-review timeline and next-review estimate, then allowed a rating.
- The seeded audio source played, advanced its displayed time, and paused; transcript reading remained available. Audible output was not assessed.
- The audio passage's Key point and note appeared in Collected; the source note survived leaving and reopening with its exact text.
- The second journey's article link imported through the real phone importer, appeared on Today and opened; its highlight appeared in Collected.
- A long source note retained its table, headings and edited display equation after leaving and reopening.
- An attached SVG learning diagram was saved byte-for-byte and rendered after its actual saved bytes were served through the harness; this was an image diagram, not an editable Excalidraw drawing.
- A long skill-note edit at its end survived Back/reopen even though its scroll position did not.
- A Dig draft survived Close/reopen, and Done appended the writing beneath a dated Dig heading in the skill note.
- Each journey recorded three Forge uses, made the try Yours, opened the resulting tool from the skill page and used Try it again.
- Daily-plan changes saved through Back; the second journey also toggled Sound effects.
- Moving Learning up/down in the drawer updated its order in the respective journeys.
- Reader bars could be recovered with a tap on plain text; their deliberate hiding was not treated as a bug.
- No page errors were recorded.

## Evidence, scope and replay

`driver.cjs`, `helpers.js`, `actions.log`, `journey2.js`, `journey2-more.js`, and `journey2-end.js` preserve the exploratory work. `confirm.js` is the bounded final reproduction; `confirm-results.json` contains all four final runs. Run from the repository root while the supplied services remain available:

```sh
node codex-out/phone/driver.cjs < codex-out/phone/confirm-input.txt
```

The first exploratory driver was restarted after an incorrect selector searched for a button where the confidence choice is a radio. Other locator errors in `actions.log` include hidden reader bars, an offscreen drawer scrim, and a portal dialog omitted from a screen-scoped snapshot. These were corrected and are not findings. A fresh page in the same context retained IndexedDB and navigation; independent journeys and confirmations therefore close the previous context and open one fresh context, never two concurrently.

Ordinary actions used taps. Text entry used Playwright fields/keyboard; Markdown paste used a clipboard event. Long presses used stationary touch events, selection used a DOM Range, and scroll-position checks used the actual scroller/scroll-into-view. Native keyboard, selection handles, gestures, haptics, notifications and iCloud behavior remain unverified. No artificial waits or refused writes were injected. The confirmations briefly set the standard text scale for target measurements, then restore the supplied scale before testing note position.

The article link returned original fixture HTML through a Playwright route (`articleRoute` in `helpers.js`), avoiding browser CORS while exercising the real importer. Newly attached files exist in IndexedDB, but the supplied `/library-file` mapping does not serve them. For the diagram, a read-only IndexedDB export (`j2-library-evidence.json`) supplied its exact saved bytes to that asset request. The earlier broken image is excluded as a harness limitation. The seed has no course or editable drawing; playlist capture failed before lessons could be tested, and existing-course navigation and native drawing-view gestures remain untested. Single-dollar inline notation remained literal by the editor's documented rule (`editor/math.ts`); the double-dollar display equation rendered and edited successfully.

The existing untracked `docs/reviews/2026-11-23-codex-ux-sweep-8/` directory was present before testing and left untouched. No application code, findings registry, installed app, real library, other tester folder, server or watcher was changed. No fix, commit, push or application test-suite run was performed because this was a findings-only audit.
