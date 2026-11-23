# Mac UX sweep — round 15

Tested checkout `5ce841d14f163aa7afeca281c7a95982b7cab331` on the supplied release build at `http://localhost:1761/`, bridge `1762`, using the supplied WebKit server, one context and one page at a time, 1280×800 with 2× screenshots. Read the working agreements, daily-session design, findings register, sweep history and rounds 11–14. Rechecked #513 twice, extended the check across selected source/skill notes and other panels, then completed two normal learner journeys from fresh pages: three source kinds each, reading, highlights and notes, tutor, new skill and filing, due review, Settings, ⌘K, Finish and returning to saved work. Added note-formatting and Forge plan/use paths beyond rounds 11–14. **Two findings: one S1 saved-note overwrite in right-click menus, and one S2 unusable formatting menu.** No delays or failures were injected. Skipped iPhone, real AI, native OS integration, visual taste, the named exclusions, pending-save Undo and detailed repeats of earlier passed edge cases. Fresh pages reused the assigned seeded library; these were first-hour task sequences, not empty-library onboarding or two literal hours of study. All tester-written files are in `codex-out/mac/`; library writes went through the app.

## Findings

### MAC-1 — Typing to choose a right-click menu item overwrites the selected note behind it

**S1 · Mac · saved data loss · remaining instance of F534’s input-leak class.** The exact Review case fixed by #513 passes; Mac context menus remain vulnerable.

1. Open a fresh page and choose **Learning** in the sidebar.
2. Write a sentence in **Your note**, such as `Saved learning note: retrieve, check, and space the next attempt.` Wait for it to save.
3. Click in that sentence and press **⌘A** to select it.
4. Right-click **Learning** in the sidebar.
5. Press **E**, as a learner choosing **Edit skill…** by the menu’s type-ahead would do. Do not press Enter.
6. Press Escape, leave the skill, then reopen it.

**Expected:** E selects a menu item without changing the note. The menu owns typing while it has focus.

**Actual:** **Edit skill…** is highlighted, and the selected note is replaced with `e`. It autosaves. Both dedicated confirmations read `e\n` from the real `skills/learning/notes.md`, and reopening still showed `e`. There is no warning that a note changed. With selected text in a source note, the same sidebar menu replaces that selected paragraph or list item too.

**Reproduction:** **2/2 dedicated fresh-page confirmations with E alone**, plus **2/2 skill-note and 2/2 source-note checks** using E then X in the panel matrix. In the source checks, the first run replaced the main paragraph with `ex`; the second replaced a selected list item with `ex`.

**Evidence:** [Run 1 before](menu-confirm-1-before.png), [menu open after E](menu-confirm-1-after.png), [reopened](menu-confirm-1-reopened.png); [run 2 before](menu-confirm-2-before.png), [after E](menu-confirm-2-after.png), [reopened](menu-confirm-2-reopened.png). [Before/after disk contents and event traces](menu-confirmations.json), [dedicated reproduction script](confirm-menu.cjs). The broader matrix is in [panel-results.json](panel-results.json), [its script](panels.cjs), [source-note run 1](panel-1-source-menu.png) and [run 2](panel-2-source-menu.png). [Saved source-note overwrite](menu-disk-evidence.json).

The event trace shows `keydown` for E targeting the menu, with the note’s sentence still selected. WebKit then sends an unprevented `beforeinput` carrying `e` to **Skill note**, while the active element is the menu, followed by `input` on the note. This is actual keyboard input, not a synthetic editing event.

**Production code:** `apps/desktop/src/Menu.tsx:137–142` renders the Mac `ContextMenu.Content` without Ore’s `Trap`. `apps/desktop/src/keys.ts:258–262` only stops key propagation; it does not stop default text input. The #513 protection is installed by `apps/desktop/src/Trap.tsx:9–18`, with the background-input check at **46–48**, so it does not cover this menu. The normal note autosave at `apps/desktop/src/Notes.tsx:177–182` saves the unintended change after 800 ms.

**Not the mock:** Menu focus, browser selection, input and autosave are production code. `tauri.js` transports the resulting note write to the real CLI; the saved file confirms it. No AI or failure/slow hook participates.

### MAC-2 — “Turn into” disappears before a note format can be chosen

**S2 · Mac · source and skill notes · 2/2 fresh-page confirmations in each editor**, plus the initial reading-journey observation and repeat.

1. Open a fresh page. Open a source with a written source note, or a skill with a written **Your note**.
2. Select a paragraph’s text. The tested route was clicking the paragraph and pressing **⌘A**.
3. In the floating formatting bar, click its left **Text ▾** control, whose hint/accessibility name is **Turn into**.
4. Try to choose a heading or list type.

**Expected:** The block-type menu remains open so a format can be selected and applied to the selected text.

**Actual:** Opening the menu dismisses both the menu and the entire formatting bar. No choice remains to click, and the paragraph is unchanged. Selecting the text and trying again repeats it. This makes the visible conversion control unusable during ordinary note-taking.

**Evidence:** Source note [run 1 before](format-1-source-before.png), [after](format-1-source-after.png), [run 2 before](format-2-source-before.png), [after](format-2-source-after.png); skill note [run 1 before](format-1-skill-before.png), [after](format-1-skill-after.png), [run 2 before](format-2-skill-before.png), [after](format-2-skill-after.png). [Focus traces, unchanged editor HTML and counts](format-confirmations.json), [bounded reproduction](confirm-format.cjs). All four confirmations had **zero menus and zero formatting bars** 500 ms after clicking. Bold worked on the same selection in all four checks; the Colour popover also applied blue to selected source-note text in both later checks ([evidence](highlight-colour-confirmations.json)). This is specific to Turn into, not a claim that all formatting is broken.

**Production code:** `apps/desktop/src/editor/SelectionBar.tsx:85–105` implements Turn into with `MoreButton`. Its menu is portaled as `.popover.menu-list` at `apps/desktop/src/Menu.tsx:238–243`. The editor’s blur handler at `apps/desktop/src/editor/NoteEditor.tsx:1131–1134` preserves the bar only when focus moves into `.sel-bar` or `.sel-pop`; it clears the bar when focus moves into this `.menu-list`. The bar owns the menu, so removing the bar removes the menu. The captured blur’s `relatedTarget` is exactly `popover menu-list fade-more` in all four checks.

**Not the mock:** The failure happens entirely in production editor/menu focus handling, before a format or CLI write is chosen. It uses no AI, native dialog, injected failure or delayed response. No matching known row was found; F295 concerned clipping the bar, not this menu closing itself.

## Known rows / #513 recheck

- **F534’s original Review reproduction passed 2/2 fresh-page checks:** with the skill note selected, ⌘R → Start review → E/X left the note unchanged. Screenshots: [first](panel-1-skill-review.png), [second](panel-2-skill-review.png).
- **Settings and What to review passed twice over each selected editor.** Their focus stayed in the panel and typing did not alter the underlying note.
- **Global ⌘K passed twice from each editor.** Escape first left editing, then ⌘K opened the command palette and E/X entered its search. Direct ⌘K while editing selected note text instead opened the note’s link field, as implemented; it did not overwrite the note.
- **The same input-loss class remains in right-click menus**, documented as MAC-1. This is an incomplete extension of the F534 fix, not a claim that Review itself regressed.
- No other known row was confirmed to have returned.

## What passed

- Journey 1 imported **A practical learning session fifteen** (Markdown/Text), **Teaching with examples fifteen** (HTML/Article), and **A Small Book of Remembering** (EPUB/Book), then filed all three under **Applied learning fifteen** without reloading ([skill page](j1-skill.png)).
- Journey 2 imported **Second learning session fifteen** (pasted Text), **How Plants Make Food** (PDF), and **pandas-notes** (Notebook), then filed all three under **Example design fifteen** ([skill page](j2-skill.png)).
- Both new skills appeared immediately and source filing updated their lists; the first journey’s existing Learning assignment was retained alongside the new skill.
- Both reading sources saved a highlight and a highlight note; the first became a Key point ([first reading](j1-note-highlight.png), [second](j2-reading.png)).
- Both source notes and Finish recalls survived leaving and reopening **2/2 fresh-page checks each** ([measurements](saved-confirmations.json), [first source](saved-2-j1-note.png), [second](saved-2-j2-note.png)).
- Collected opened each saved highlight and its note on one click **2/2 fresh-page checks each**, with the popup in view ([measurements](highlight-colour-confirmations.json), [Key point](highlight-2-j1.png), [ordinary highlight](highlight-2-j2.png)).
- Bold applied to selected text in both note editors, twice each; the Colour popover applied blue to selected source-note text twice, and Undo removed the formatting.
- Both tutor questions ended with a visible unavailable-answer explanation, **Try again**, and a usable composer ([first](j1-tutor.png), [second](j2-tutor.png)).
- Four due ratings saved: three Fact and one Explain, totaling **89,525 ms** in the real review log ([library evidence](library-evidence.json)). No clock manipulation was used.
- Unavailable Explain grading retained the written answer, explained the problem, and allowed manual key-point marking and a Good rating.
- Both review sessions could end with exercises still due and return through Done ([first ending](j1-review-end.png), [second](j2-review-end.png)).
- Settings opened with ⌘, and closed with Escape in both journeys ([first](j1-settings.png), [second](j2-settings.png)).
- ⌘K found ordinary sources and created skills; both Finish flows retained recall and allowed completion without AI feedback.
- Forge added **Explain retrieval practice without looking**, kept its When and I’ll lines, accepted **I did it**, and retained the edited If line after leaving and reopening, including a later fresh-page return ([first reopening](j1-forge-reopened.png), [final reopening](forge-final-reopened.png)).
- The final browser check recorded no page errors and zero pending bridge calls.

## Hesitations, verification limits and cleanup

The three strongest follow-ups were typing through a right-click menu, Turn into vanishing, and whether the new sources’ notes/highlights survived Finish and a fresh page. Each received two dedicated fresh-page checks. The first two failed; persistence passed. A source added while another was open used an Added/Show handoff rather than replacing the current reading page; it was present in search and the filed list. The Forge’s brief Again after I did it returned to I did it on reopening; that button records a use and leaves the try available for another use (`packages/core/src/tries.ts:110–132`), so this was not reported as lost progress. No other ordinary-use candidate was confirmed.

Review time runs from each exercise’s `shownAt` until its rating and is capped at three minutes per exercise (`apps/desktop/src/Review.tsx:187,661,753`). The four saved ratings above include the time spent answering and inspecting the UI, not an invented hour of study.

File picking used the provided `__ORE_PICK` hook; no native Finder dialog was tested. Highlights used real Playwright mouse drags between text coordinates; note selection and menu typing used real keyboard events. Native text context menus, OS-wide shortcuts, sound output and actual AI responses remain unverified. Prequestion waiting under the AI-disabled bridge was not treated as a new bug. Selector corrections, a terminal line-length limit and an early check that looked for Review before its picker had mounted were automation issues and are retained in the [action log](actions.log), not findings.

The demonstration skill-note overwrite was replaced through the app after the dedicated confirmations. The seeded source note’s overwritten passages remain as evidence in the scratch library; the new journey sources retained their intended notes. The driver’s page/context and browser connection were closed after checking no requests remained. No source-code or findings-register edit, commit, push, server/watcher start or stop, installed-app access, real-library access or change to another tester’s folder/port was made. The unrelated untracked `docs/reviews/2026-11-23-codex-ux-sweep-15/` folder was left untouched.
