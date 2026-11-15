# Accessibility sweep — a11y

Tested release build at commit `bc0d275`, using only Mac page 1713 / bridge 1714, phone page 1715, and shared WebKit 1719. Covered adding a source, skill assignment, reading, highlights, Key points, highlight notes, source notes, deleting/undoing a highlight, Review through the daily goal, both the normal and reduced-motion end screen, and Settings. The first Mac journey used `page.keyboard` exclusively; subsequent Mac and phone passes saved `locator.ariaSnapshot()` output, focus coordinates, live regions, and screenshots at 2×. The Mac scratch library retains its reviews, so later Mac passes start with the goal already met; two independent phone journeys each reached 12 of 10 minutes from the seed. Skipped All sources filters, pure visual polish, F14, and F70 as requested. No application code or findings registry was changed.

## Evidence and limits

- `driver.cjs` provides the interactive harness. `repeat.cjs`, `mac-focus.cjs`, `phone-repeat.cjs`, and `phone-highlights.cjs` are executable repeat checks; `helpers.cjs` saves the evidence. Run from the repository root with the assigned servers already running. These scripts write only through the app, apart from their artifacts in this folder.
- Every `.png` has a matching `.aria.txt`; most also have `.json` with control attributes, focus, rectangles and live-region text. Read the named JSON beside a screenshot to see invisible focus and announcement defects.
- This is an accessibility-tree/DOM audit, **not a native VoiceOver audio recording**. The installed Playwright exposes `ariaSnapshot()` rather than `page.accessibility.snapshot()`. Its snapshot includes the phone drawer even when the drawer is `inert`; that alone is **not** reported as a bug. The inactive reader/note panes below are not inert.
- Phone text selection was established with a DOM Range, then the real Highlight / Key point controls were tapped. Native iOS VoiceOver text-selection gestures and the native file chooser were not validated. The file input received `phone-source.md` to exercise the real import. This is a limitation of the phone selection portion, not a claim that selection works with VoiceOver.
- Review time advanced with `page.clock.fastForward(180000)` per exercise. The app and core cap a single exercise at three active minutes (`Review.tsx:52`, `packages/core/src/study.ts:109`). No AI service ran. Phone manual grading fallback was tested; successful AI grading output was not.
- Zoom was tested with root CSS `zoom: 2` at 1280×800, then corroborated at a 640×400 CSS viewport with zoom reset. These test enlarged content and reflow; they do not exercise Safari's native zoom menu. `reducedMotion: "reduce"`, `contrast: "more"`, and `forcedColors: "active"` were accepted, and all three media queries returned true. WebKit's forced-colors emulation did not visibly substitute a Windows-style system palette; do not treat this as certification on Windows high contrast.
- Mac WebKit skips some ordinary buttons with plain Tab under its current navigation preference. Option-Tab reaches them. The modal wrapping failure below occurs with **Option-Tab too**, so it is not merely that preference.

## Findings — most severe first

### A1 — Phone notes put focus on the page that just moved off-screen

**S2 · iPhone · 2/2 independent journeys.** Closing Review also dropped focus to `body` in both journeys.

1. From a fresh phone page, add `phone-source.md`, then open “VoiceOver learning audit.”
2. Activate **+ Note**.
3. Inspect focus and the accessibility snapshot. Return to Source and press Tab once with a hardware keyboard.
4. Separately, complete a review and activate Done on its end screen.

**Expected:** opening the note focuses a visible note heading/container without requiring the keyboard to appear. The inactive source/note pane is excluded from navigation. Closing Review returns focus to Start review or the originating control.

**Actual:** + Note leaves `document.activeElement` on `.reader-scroll` at **x = −390**, wholly outside the viewport. Conversely, Tab from the source can focus the unopened Source note editor at **x = 410**. Its editor then consumes Tab while off-screen. Source content and note content remain in the snapshot together, along with the underlying Today page. Done removes Review and leaves focus on `body`.

**Selectors:** `.phone-source .reader.noting .reader-scroll`; `.phone-source .reader:not(.noting) [role="textbox"][aria-label="Source note"]`; `.phone-root`; `body` after `.review-end .quiz-go`.

**Evidence:** [first note](phone-source-note.png), [repeat note](phone-repeat-note-focus.png), `phone-focus-walk.json`, [end close](phone-repeat-end-close.png). The matching JSON shows the off-screen coordinates and `body`.

**Suspected source:** `apps/desktop/src/Reader.tsx:1496` explicitly focuses the source scroll area when opening a phone note; `apps/desktop/src/styles.css:2960` moves both pages with transforms without hiding the inactive one; `apps/desktop/src/phone/PhoneApp.tsx:46` and `:863` render pushed screens without a corresponding screen-focus lifecycle. `Review.tsx:191` skips its usual focus restoration on phone.

### A2 — Settings fails to wrap keyboard focus at the last control

**S2 · Mac · 2/2 fresh-page repeats, plus the original journey.**

1. Open a fresh Mac page; press ⌘, to open Settings → General.
2. Press Option-Tab through the controls until **Show in Finder**.
3. Press Option-Tab again. Repeat forward navigation; try plain Tab as well.

**Expected:** focus wraps to a visible control inside Settings. A modal never loses focus to the browser/page.

**Actual:** after Show in Finder, focus becomes `body`. Further forward traversal alternates between the last reachable control and `body`, instead of wrapping to the first control. Plain Tab similarly gets stuck earlier. In Review settings, plain Tab alternated between “After what do you review?” and `body`; Option-Tab reached the remaining controls but still lost focus at the end. Escape remains usable.

**Selectors:** `.settings-sheet[role="dialog"]`, `.settings-back`, `.settings-btn`, `body`.

**Evidence:** [repeat 1](mac-focus-wrap-1.png), [repeat 2](mac-focus-wrap-2.png), `mac-focus-log.json`, `settings-focus-walk.json`, `settings-option-tab.json`.

**Suspected source:** `apps/desktop/src/Trap.tsx:8` (Radix FocusScope integration) and `apps/desktop/src/Settings.tsx:224`. The cause within focus traversal was not established; the repeat script records the last controls and the lost focus.

### A3 — Invalid links on iPhone show a refusal that is never announced

**S2 · iPhone · 2/2 independent pages. Related to F112, whose Mac fix still passes.**

1. Open **Add a link**.
2. Enter `not a valid url` and activate Add.
3. Read the snapshot, live regions, and the Link field's description.

**Expected:** the refusal is announced and associated with the retained field so the learner knows why Add did not work.

**Actual:** “That isn’t a link: paste one that starts with https://” is an ordinary paragraph. It has no alert/status/live role; the input has no `aria-describedby` or `aria-invalid`. The live-region observer records **zero events**. Focus moves to the form container, rather than to the refused input or error.

**Selectors:** `.add-link .phone-error`; `.add-link input[aria-label="Link"]`.

**Evidence:** [first refusal](phone-add-error.png), [repeat refusal](phone-repeat-add-error.png), their JSON (`events: []`).

**Suspected source:** `apps/desktop/src/phone/AddLink.tsx:70` renders the error paragraph; `:58`–`:69` render the input without the error relationship. The equivalent Mac input and alert in `Add.tsx:176` / `:225` are correctly linked and announced.

### A4 — Explain's answer and unavailable-grading fallback arrive silently

**S2 · iPhone · 2/2 independent full review journeys.**

1. Start review from the fresh seed. Rate the first two Fact exercises Good.
2. On “Explain why rereading creates an illusion of competence,” type an answer, choose Sure, and activate Check.
3. Inspect the changed screen and all live regions before manually marking a point.

**Expected:** announce that the answer is available, grading is unavailable on phone, and the learner should mark what they got and rate it.

**Actual:** the answer, two marking controls, ratings, and “Checking answers runs on your Mac for now. Mark what you got.” appear. Focus is on the generic Review container. Its live text still says only **“Exercise 3. Explain why rereading creates an illusion of competence.”** Neither the answer nor the fallback/next step is in a live region. Marking a point subsequently announces the count, but that does not announce the initial transition.

**Selectors:** `.review-grade-failed`; `.review-answer`; `.review > .sr-only[aria-live="polite"]`.

**Evidence:** [first fallback](phone-grade-result.png), [repeat fallback](phone-repeat-grade.png), matching JSON/live-region events.

**Suspected source:** `apps/desktop/src/Review.tsx:1150` adds the answer/rating announcement only for `card.kind === "card"`; `:1309` renders the phone fallback as an ordinary paragraph. This is separate from F113's fixed Fact announcement.

### A5 — Saving a highlight, Key point, or its note gives no save announcement

**S2 · Mac and iPhone · Mac 3/3; iPhone 2/2.**

1. Add and open the supplied two-paragraph text source.
2. Mac: use the reader's arrow navigation and H, then 2 for Key point, Tab to write a note, and Escape to save/close. Phone: select text, activate Highlight, Key point, and write a note.
3. Observe live regions during each write, then delete the highlight and undo it for comparison.

**Expected:** a concise nonvisual confirmation identifies the saved highlight or Key point and reports note-save success without forcing a visual toast.

**Actual:** highlight creation, intent changes, and note saving generate no live-region update. On Mac, creating the highlight leaves focus on the reader; choosing Key point moves focus to the note field without announcing that the write succeeded. The Key point's pressed state is present if the user explicitly revisits that button. Deletion and Undo **do** announce correctly, showing that the live-region logging is working. Saved annotations and the source note were verified in the assigned Mac scratch library.

**Selectors:** `.popup[aria-label="Highlight"]`, `.popup .intent`, `.popup textarea[aria-label="Note"]`, `.toasts[aria-live="polite"]`.

**Evidence:** [Mac highlight](repeat1-highlight.png), [Mac Key point](repeat1-keypoint.png), [Mac repeat](repeat2-keypoint.png), [phone highlight](phone-highlight-saved.png), [phone repeat](phone-repeat-keypoint.png). Matching JSON records no save events; `repeat1-delete.json` and `repeat1-undo.json` record the contrasting announcements.

**Suspected source:** `apps/desktop/src/Reader.tsx:1861`, `:2016`, `:2140` send `quiet` notifications; `apps/desktop/src/Toast.tsx:100` omits those from the rendered live region.

### A6 — The Mac skill picker says “selected” for keyboard focus, not assigned skills

**S2 · Mac · 2/2 fresh-page repeats.**

1. Press ⌘N, enter text, then Tab to open the skill picker.
2. With no skill assigned, inspect the options. Move Down to Learning without pressing Enter.
3. Press Enter to assign Learning; inspect the option again. Move to a second option.

**Expected:** assigned skills expose a persistent checked/selected state distinct from the active keyboard suggestion; the popup has a name.

**Actual:** AI initially says `[selected]` even while the trigger says “Skill” (nothing assigned). Moving Down makes Learning `[selected]` before assignment. Enter adds the visual check and updates the trigger, but leaves the option's accessible text/state unchanged. There is no persistent accessible checked state for assigned items. The enclosing Radix popup is also an **unnamed dialog**.

**Selectors:** `.skill-picker[role="dialog"]`; `.skill-picker [cmdk-item][role="option"]`; specifically options named AI and Learning in these reproductions.

**Evidence:** `repeat1-skills-before.aria.txt`, `repeat1-skills-arrow.aria.txt`, `repeat1-skills-toggled.aria.txt`, and their repeat2 equivalents; [picker screenshot](repeat1-skills-toggled.png).

**Suspected source:** `apps/desktop/src/Skills.tsx:143` lacks a dialog label; `:153` uses cmdk's active option state and only a visual Check for membership. The phone Skills sheet uses actual checked checkboxes and passed this check.

### A7 — Enlarged Mac Settings clips choices instead of reflowing

**S2 · Mac · 2/2 at CSS zoom 200%; 2/2 corroborating 640×400 viewport checks.**

1. At 1280×800, enlarge the document to 200% using the test harness.
2. Open Settings → General.
3. Inspect Reading width and the following controls. Repeat with a 640×400 CSS viewport at normal zoom.

**Expected:** all settings and their selected states remain visible or reachable through a sensible single-direction layout.

**Actual:** the fixed section column consumes about half the sheet. Setting descriptions collapse into narrow stacks while the control groups extend beyond the clipped right edge. At 200%, **Wide** is outside the visible sheet; Medium is truncated. The corroborating small viewport also clips the group's right edge. The reader with both side panels open is severely squeezed as well; the reported defect is the concrete clipping of Settings choices.

**Selectors:** `.settings-tabs`; `.settings-main`; `.settings-row-control`; `[role="radiogroup"][aria-label="Reading width"]`.

**Evidence:** [200%](repeat1-zoom-settings.png), [200% repeat](repeat2-zoom-settings.png), [small-viewport corroboration](mac-reflow-settings-1.png), [repeat](mac-reflow-settings-2.png).

**Suspected source:** `apps/desktop/src/styles.css:2625`–`:2642` keep a 216px navigation column and substantial page padding; `:2654` constrains the control wrapper without wrapping its contents.

### A8 — Panel resizing has no keyboard equivalent

**S3 · Mac · both reader resizers verified 2/2; Home's divider also inspected.**

1. Open a source with the sidebar and source note visible.
2. Traverse controls with Tab / Option-Tab and look for a Resize action in the keymap and screen actions.
3. Inspect the separators; repeat on Home for its two columns.

**Expected:** a focusable separator with arrow-key adjustment, or an equivalent menu action.

**Actual:** Resize the sidebar and Resize the side panel have `tabIndex === -1`, no value, and pointer-only handlers. They never receive keyboard focus. Home's Resize columns uses the same pointer-only split approach. Hiding a pane is possible, but adjusting its width is not.

**Selectors:** `.side-divider[role="separator"]`; `.mynotes .divider[role="separator"]`; `.home .col-divider[role="separator"]`.

**Evidence:** [reader](repeat1-contrast.png), `repeat-log.json` (both runs' exact separator markup), [Home](mac-home.png).

**Suspected source:** `apps/desktop/src/split.ts:16`–`:39`; `apps/desktop/src/App.tsx:2316`; `apps/desktop/src/Notes.tsx:441`; `apps/desktop/src/Home.tsx:511`. This is separate from the already-known highlight endpoint problem F111.

### A9 — Two phone actions still have less than a 44-point touch area

**S3 · iPhone · both controls measured in 2/2 independent journeys; hit testing corroborated no expanded area.**

1. From the fresh seed, open Start review's skill picker.
2. Inspect **Deselect all** at its heading.
3. Complete a session, then inspect the end-screen “Outline Thursday's video…” action.

**Expected:** each action's touch area is at least 44×44 CSS points.

**Actual:** `.pick-all` is **65.3125×24**; `.review-try` is **342×32**. Neither has a pseudo-element expanding its area, and points 5px above or below do not hit the control. This makes exploring/activating them by touch less forgiving.

**Evidence:** [picker](phone-review-picker-actual.png), [repeat picker](phone-repeat-picker.png), [end](phone-end.png), [repeat end](phone-repeat-reduced-end.png), `phone-pick-target.json`, `phone-end-target.json`.

**Suspected source:** `apps/desktop/src/styles.css:2023` sets the pick-all height; `:2363` sizes the end action without a phone hit-area override.

**Excluded false positives:** Open in source has a 24px visible box but a 44px `::after` hit area (F101 remains fixed). Rubric marks use a whole-row pseudo-element with a minimum 44px row. Small Home title text sits in a larger clickable row. These are not counted as small targets merely from their button rectangles.

### A10 — Explain marking buttons expose unnamed decorative pictures

**S3 · iPhone confirmed · 2/2 Explain snapshots. Shared Review markup also applies on Mac.**

1. Reach the Explain exercise and activate Check as in A4.
2. Read the accessibility snapshot of its two marking buttons.

**Expected:** the named marking button communicates the point and its state; the circle/check decoration is hidden.

**Actual:** each named button contains an additional unnamed `img`. This adds noninformative image output during rubric navigation.

**Selectors:** `.quiz-points li:nth-child(1) .quiz-mark svg` and `.quiz-points li:nth-child(2) .quiz-mark svg` in the seeded Explain exercise. Both circle and check branches lack `aria-hidden`.

**Evidence:** [Explain](phone-grade-result.png), `phone-grade-result.aria.txt`, `phone-repeat-grade.aria.txt` (each has `button …` followed by an unnamed `img`).

**Suspected source:** `apps/desktop/src/Review.tsx:1288` renders Check/Circle without `aria-hidden`. This is a different component from F117's fixed reader-eye decorations.

## Known rows checked

- **F111:** the highlight endpoint handles still expose sliders without focus/numeric values or keyboard operation. Already awaiting Tyler's choice; no new finding or duplicate fix request.
- **F112:** Mac failed Add retains its input and exposes an alert linked by `aria-describedby` (two injected failures passed). A3 is the same unmet requirement on the separate phone Add implementation, not evidence that the Mac fix regressed.
- **F113:** Fact answer plus rating phase is announced on both pages. Passed.
- **F101:** Open in source retains its 44px expanded hit area. No recurrence.
- **F117:** the reader eye decoration remains hidden. A10 concerns the independent Review rubric SVGs.
- **F14 / F70:** intentionally skipped.
- No confirmed recurrence of a previously fixed row on its originally fixed surface.

## What passed

- Mac keyboard add: ⌘N, typed text, skills through Tab/arrows/Enter, Escape back to the field, Enter import; the source opens with reader focus.
- Mac reader keys can highlight a focused text block, make it a Key point, enter a highlight note, save with Escape, delete and undo; the resulting annotations persist in the scratch library.
- The source note accepts keyboard input and persists its text; the Mac note/reader toggle gives focus to the expected visible editor/reader.
- Key point / Question / Try it expose pressed state, side-panel tabs expose selection, settings choices expose radio state, and switches have names.
- Mac and phone Review pickers have a name, checkboxes with checked state, and a named Start review action.
- Each new exercise is announced. Fact answer and rating phase are announced. Manual rubric changes announce how many points were marked.
- Rating feedback and “Goal met. The rest is extra.” are status regions. The end screen is a status region, labels its minutes/progress graphics, and focuses Done.
- Both phone journeys reached 12 of 10 minutes and showed the end screen. The Mac keyboard journey reached the goal as well; no mouse was needed for rating or ending it.
- Phone grading has an actionable manual fallback; it does not strand the learner waiting for AI. A4 concerns announcing that fallback.
- Phone Highlight/Key point controls, source-note access, Source/Back navigation, and source Skills actions have names and can be activated without a swipe. Native text selection remains unverified as noted above.
- The inspected command and source-action menus/sheets have meaningful roles and names. The exception found is the unnamed Mac skill popup in A6; no unnamed action buttons were found in these loop screens.
- Sidebar collection menus and note-block menus have Move up / Move down actions in code; the note editor also defines ⌘⇧↑ / ⌘⇧↓. Reordering is not universally drag-only. These additional reorder paths were inspected in code, not exercised end-to-end in this sweep.
- The Mac reduced-motion end screen reported zero running animations; the phone repeat showed its settled end state after 1.5 seconds. Normal goal/end animations also completed. The inspected Settings controls reported zero running animations under reduced motion.
- Increased-contrast/forced-colors media emulation produced no disappearing controls in the inspected Home, reader, Settings, and phone end snapshots, within the WebKit limitation above.
- Prequestion waits expose a named status (“Writing prequestions…”). The null AI harness left that wait present; this run does not establish normal AI completion or native AI-service error handling.

## Follow-up coverage limits

Native VoiceOver reading order/utterances, iOS text-selection gestures, native browser zoom, real successful AI grading, every possible animation, and standard-control reorder behavior under native VoiceOver need a native follow-up. Phone Add and action sheets have Escape/outside-tap/swipe dismissal paths but no named Cancel/Close button in the inspected snapshots; native VoiceOver's escape gesture was not tested, so this is recorded as a navigation coverage gap rather than a proven swipe-only blocker.
