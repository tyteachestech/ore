# Mac UX sweep — round 14

Tested the supplied release build at `http://localhost:1761/`, bridge `1762`, using the supplied WebKit server and only the assigned scratch library. Checkout: `091effb916bd0be2160b58cbc7a5627674803e4c`. Main-window journeys used 1280×800 and 2× screenshots; quick quiz also used its configured 640×460 size. Read the working agreements, daily-session design, known findings, sweep history, and rounds 11–13. Checked #512 on the main palette and a source's actions page, then covered Feed, All sources filters, skill notes and the learned-exercise list, exercise editing, quick quiz, and Settings. Completed two everyday journeys from fresh pages, adding three source kinds each, reading with highlights and notes, asking the tutor, creating a skill and filing sources, reviewing due exercises, opening Settings, using ⌘K, finishing sources and returning to saved work. **One new S1 finding: Review can silently overwrite the skill note behind it.** No other confirmed new finding or known regression. Skipped iPhone, native OS integration, real AI, injected delays/failures, pending-save Undo, visual taste and the named exclusions. Fresh pages reused the scratch library; these were task journeys, not empty-library onboarding or literal hour-long sessions. Tester-written artifacts are confined to `codex-out/mac/`; library writes went through the app.

## Findings

### MAC-1 — Typing in Review can overwrite the selected skill note behind it

**S1 · Mac · saved data loss.** Reproduced **2/2 fresh-page confirmations with the whole note selected**, and **2/2 earlier fresh-page confirmations with a caret**, besides the initial discovery. No injected failure or delay.

1. Open a fresh app page with a Fact exercise due. Open **Learning** from the sidebar.
2. Click **Your note** and write a sentence, such as `A complete note about retrieval, feedback, and spacing.` Let it save.
3. Leave the caret in the note, or press **⌘A** to select its text.
4. Press **⌘R**. If **What to review** opens, click **Start review**.
5. With the Fact question visible and **Guess / Think so / Sure** below it, press **E**, as someone trying the exercise-edit shortcut might do. Do not reveal the answer first.
6. Leave Review and inspect the skill note. Reopen it or read its saved file.

**Expected:** Review owns input. An unavailable Edit shortcut can do nothing before the answer is revealed; it must never edit a hidden note. Selected text in the underlying page must be protected from typing and deletion.

**Actual:** The Review screen appears unchanged, but the letter goes into the hidden note. With a caret it appends `e`. With the note selected, it replaces the entire sentence with `e`; the real saved `skills/learning/notes.md` becomes `e\n`. Both selected-note confirmations produced this exact result. This is a saved overwrite, not merely a stale display. Undo may offer recovery, but the learner has no reason to know Review changed their writing.

**Evidence:** [First selected-note review](selected-1-review.png), [its overwritten note](selected-1-note.png), [second selected-note review](selected-2-review.png), [its overwritten note](selected-2-note.png). [Before/after text, focus, selection and disk contents](selected-note-confirmations.json), [bounded two-run reproduction](confirm-selected-note.cjs). Earlier caret confirmations: [first review](confirm-1-review.png), [first changed note](confirm-1-note.png), [second review](confirm-2-review.png), [second changed note](confirm-2-note.png), [instrumented reproduction](confirm-background.cjs).

The [event trace](background-events.json) identifies the failure precisely: `keydown` for `e` targets **Review**, and `document.activeElement` is **Review**, while the DOM selection remains inside **Skill note**. WebKit then sends `beforeinput` with `data: "e"` to **Skill note**, followed by its `input` event. The selected-note runs used actual keyboard selection and typing, not a synthetic DOM Range.

**Suspected production code:**

- `apps/desktop/src/Review.tsx:448–452` focuses the Review container for a Fact exercise but does not clear the background editor's DOM selection.
- `Review.tsx:1074–1088` returns from the unrevealed-answer key handler without preventing an ordinary letter's default input; Edit is deliberately handled only after reveal. The problem is the resulting background input, not that Edit is unavailable yet.
- `apps/desktop/src/Trap.tsx:7–20` traps focus and Tab, but does not make background content inert or remove its editing selection.
- `apps/desktop/src/App.tsx:2625–2632` leaves the skill page mounted and passes `blocked={overlay}`. `apps/desktop/src/SkillPage.tsx:268` still renders its editable `NoteBody` without that blocking state. `apps/desktop/src/Notes.tsx:317–323` connects its changes to the real save path; `Notes.tsx:177–182` schedules the save.

These lines explain the observed interaction; this is not a proposed or implemented fix. **Not the mock:** `tauri.js` supplies CLI transport and native stubs; it does not implement Review focus, editor selection or keyboard input. The production WebKit UI emits the edit, and the real CLI saves it. AI does not participate. No existing finding was found for this hidden-editor input path; F64/F142 concern starting or focusing Review, not an editor receiving `beforeinput` while Review already has focus.

## Known rows and fix check

- **F533 / #512 passes:** main ⌘K search shows **Esc Clear**, then **Esc Close** after clearing. Searching a source, pressing Tab for its actions, and typing `pin` shows **Esc Clear**, then **Esc Back**, then the main page's **Esc Close**. Each Escape performs the action advertised. [Main search](palette-main-clear.png), [source actions](palette-source-clear.png).
- No known row was confirmed to have returned. The new finding above is not another pending-save Undo case.

## What passed

- Feed's empty state offered **Follow**; following Simon Willison's Atom feed loaded 30 posts and showed a following confirmation with Undo.
- A Feed post opened on one click; writing a note kept it, and its source immediately appeared in All sources. Opening it there restored the note ([post](feed-post.png); saved record in [library evidence](library-evidence.json)).
- Feed's Recent/By feed switch and subscription actions were reachable; leaving the read post removed it from Unread.
- All sources combined **Kind: Article** with **Skill: Learning** and showed an accurate empty state; **Clear them** restored the list ([empty filters](filters-empty.png)).
- Skill notes saved and reopened, and Widen/Narrow worked ([wide note](skill-note-wide.png)); the exception is typing behind Review, documented above.
- A skill's question row opened its linked source; the gem breakdown updated after review and listed the learned Explain exercise ([exercise list](skill-exercises.png)).
- Exercise editing saved a revised question, reopened it correctly, discarded a second unsaved edit with Escape, and restored the original saved question with ⌘Z ([restored exercise](exercise-edit-undo.png)).
- Quick quiz saved one rating, closed with Escape, and reopened an unfinished Explain answer with its text intact ([draft](quick-draft-reopened.png)).
- At native 640×460, quick quiz showed its question, answer and ratings; edit cancellation, Escape dismissal and reopening passed **2/2 fresh-page checks** ([measurements](quick-confirmations.json), [script](confirm-quick.cjs), [answer](quick-2-answer.png), [reopened](quick-2-reopened.png)).
- Settings' General, AI and Review sections opened; the model menu listed its choices, and the Sound effects switch remained off after closing and reopening Settings ([AI](settings-ai.png)). Native download removal, Finder launching, login and system-wide shortcut registration were not exercised.
- Journey 1 imported **Retrieval workshop fourteen** (Markdown/Text), **A Small Book of Remembering** (EPUB/Book), and **How memory works** (PowerPoint/Slides), then filed all three together under **Retrieval practice fourteen** ([skill](j1-skill-filed.png)).
- Journey 2 imported **Teaching workshop fourteen** (HTML/Article), **Retrieval practice notes** (Word/Document), and **verbs** (CSV/Spreadsheet), then filed all three together under **Teaching practice fourteen** ([skill](j2-skill-filed.png)).
- Both journeys saved a highlight, highlight note, source note and Finish recall. The first highlight became a Key point; a subsequent edit to the second source note also survived reopening.
- Both sources' notes and highlights reopened correctly **2/2 fresh-page checks each**, with each highlight popup visible after one Collected click ([measurements](saved-confirmations.json), [script](confirm-saved.cjs), [first note](saved-2-retrieval-note.png), [second note](saved-2-teaching-note.png), [Key point](saved-2-retrieval-highlight.png), [ordinary highlight](saved-2-teaching-highlight.png)).
- Both tutor questions displayed the unavailable-answer explanation, **Try again**, and a usable composer ([first](j1-tutor.png), [second](j2-tutor.png)). Both Finish flows retained recall and allowed Done without AI feedback.
- Three due ratings saved during the two broad journeys, plus one in quick quiz: **four real rating records, totaling 55,143 ms** ([library evidence](library-evidence.json)). Explain grading's unavailable result still allowed manual key-point marking and a rating.
- Both broad reviews could end with exercises remaining and return through Done ([first ending](j1-review-end-settled.png), [second](j2-review-end.png)). Review time is measured from each exercise's `shownAt` to its rating and capped at three minutes per exercise (`Review.tsx:53,187,661,753`); no clock manipulation was used.

## Hesitations, limits and cleanup

The three strongest follow-ups were the hidden-note edit, whether saved notes/highlights survived leaving and Finish, and whether quick quiz handled interruption and editing at its small native size. Each received two fresh-page checks; only the first failed. Hiding a Feed source initially made a later source open with its text hidden; **Show the source** recovered it. This is explicitly remembered by D115's eye-button rule and `Reader.tsx:753`, so it is not reported as a bug. ⌘1 while on a skill stays within that skill; selecting All sources provided the global list. Neither hesitation caused data loss.

File selection used the supplied `__ORE_PICK` hook. Reading highlights used a DOM Range and mouseup; actual native selection gestures were not tested. Quick quiz used its production component with mocked native window metadata and `quiz-open`; OS focus return and tray behavior remain unverified. AI-disabled prequestion waiting was not re-reported. No separate general exercise-management list appeared on the skill page; its actual Questions list and **You can now explain** list were inspected, and exercise editing was tested in Review.

The action log and bounded scripts are in this folder. Selector corrections and a terminal input-length correction are automation issues, not findings. The first non-interactive driver exited and closed its context before the interactive driver started. Only one context and one page were used at a time. The final check found zero pending bridge calls and no recorded page errors; the tester's page and context were closed. The demonstration overwrite in the scratch skill note was replaced through the app after its evidence was captured. No source-code or findings-register edits, commits, pushes, server starts/stops, installed-app changes, real-library access, or changes to another tester's files/ports were made. The pre-existing untracked `docs/reviews/2026-11-23-codex-ux-sweep-14/` folder was left untouched.
