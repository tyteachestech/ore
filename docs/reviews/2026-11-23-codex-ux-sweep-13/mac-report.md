# Mac UX sweep — round 13

Tested the supplied release build at `http://localhost:1761/`, bridge `1762`, in the supplied WebKit server, at 1280×800 with 2× screenshots; checkout `6b3fce59e9c64b86dcc34db396c3777d9061eb78`. Read the working agreements, daily-session design, findings register, sweep history, and rounds 11 and 12. Rechecked round 12's MAC-1 twice, then completed two everyday journeys from fresh pages on the assigned seeded library: adding three distinct displayed source kinds per journey, reading, highlights and notes, asking the tutor, creating a skill and filing sources, due review, Settings, ⌘K, Finish, and reopening saved work. Also inspected subtitle import, an image, a PDF's original page, and the seeded audio player. **One new S3 finding: the command palette's Escape hint describes the wrong next action. No confirmed S1/S2 or app-caused data loss.** Skipped iPhone, installed-app/native integration, real AI, real YouTube playback, injected failures/delays, the named exclusions, pending-save Undo, visual taste, and repeated edge-case suites. These were task journeys, not literal hours or empty-library onboarding; fresh pages reused the assigned scratch library. Only `codex-out/mac/` contains tester-written files; library changes went through the app.

## Findings

### MAC-1 — Search says “Esc Close,” but Escape clears the search and leaves it open

**S3 · Mac · 2/2 dedicated fresh-page confirmations**, plus the initial observation during journey 2.

1. Open a fresh Mac app page.
2. Press ⌘K and type `glossary` (any nonempty search also takes this path).
3. Read the footer: **Esc Close**.
4. Press Escape once to leave the search.
5. Observe the still-open command palette. Press Escape again.

**Expected:** The footer describes what the next Escape will do. With a query present, it should identify clearing the search; after it is cleared, Close is accurate.

**Actual:** The first Escape clears the query and replaces the results with the default commands/recent sources. The overlay still blocks the underlying app. Only the second Escape closes it. The misleading hint caused an attempted return to the source list to require an extra step. This is a wording mismatch, not a request to remove the intentional clear-first behavior.

**Evidence:** [Run 1 before](escape-1-before.png), [after one Escape](escape-1-after.png); [run 2 before](escape-2-before.png), [after one Escape](escape-2-after.png). [Measurements](escape-confirmations.json) record an open palette with an empty query after the first Escape, and zero dialogs after the second, in both runs. [Bounded reproduction](confirm-escape.cjs).

**Code:** `apps/desktop/src/Palette.tsx:344–354` deliberately clears a nonempty query before closing. The footer at **436–438** unconditionally says **Esc Close** on the main page; it does not inspect `q`. The existing journey `⌘K: Esc clears what was typed first, then closes` confirms the behavior is intentional. The analogous subpage footer at **420–422** also hard-codes Back, although this run only reproduced the main-page wording.

**Not the mock:** Both the keyboard branch and the footer are production UI code. No AI answer, native action, failing command, or delay participates. No existing findings row was found for this hint mismatch.

## Known rows / #511 verification

**No known row was confirmed to have returned. F532 passed twice from fresh pages**, using round 12's exact setup:

1. Import the Academy course through Add.
2. Open **Introduction to AI Fluency**, fold **Transcript**, and scroll to **Reflection / What’s next**.
3. Go Home with ⌘0.
4. Search **Cork University** through ⌘K and click the introduction result quoting the professor's introduction.
5. Inspect the initial landing without pressing Enter.

Both initial landings showed **1/1** and the highlighted match on screen, at **y 740.625–761.359375** in the 800px window. The former jump back to the lesson's end did not recur. [Run 1 before](fix-1-before.png), [landing](fix-1-landing.png); [run 2 before](fix-2-before.png), [landing](fix-2-landing.png).

In the second exact check, narrowing the window to **1100×800** moved the match to **y 682.6875–703.421875**. Closing the side panel and reopening it kept the match visible, without Enter. [Resize](fix-2-resize.png), [panel hidden](fix-2-panel-hidden.png), [panel reopened](fix-2-panel-open.png), [measurements](fix-measurements.json), [script](confirm-fix.cjs). The first run also exercised resizing and side-panel changes. Reducing its height to 700px cropped the lower part of the page where the match had been; restoring height/bringing the passage into view recovered it. This was not the old restoration to Reflection and is not reported as a regression.

The production change is visible at `apps/desktop/src/Reader.tsx:1377–1382`: opening the transcript to a passage suppresses the competing resize restoration once. No fix was made in this run.

## What passed

- Journey 1 added **Memory workshop thirteen** (Markdown/Text), **Reading workshop thirteen** (HTML/Article), **The testing effect** (PNG/Image), and the additional **listening-workshop** subtitle file; all were filed under **Everyday learning thirteen** ([final To read list](j1-skill-final.png); the finished Markdown source is in Done).
- Journey 2 added **Practice design thirteen** (HTML/Article), **Session plan thirteen** (Markdown/Text), and **How Plants Make Food** (PDF); all were filed under **Practical work thirteen** ([skill page](j2-skill.png)).
- Local HTML and Markdown retained their headings and author; the subtitle file retained its timestamped words. An SRT alone displays as Article, consistent with F506's accepted classification.
- The image import showed Adding and Cancel during its longer OCR wait, then opened readable text ([image source](j1-image.png)).
- The PDF retained its author, two pages, headings, and margin definitions. Original rendered its page beside the extracted text ([original page](j2-pdf-original.png)); Collected remained readable and reachable ([hover](j2-pdf-tabs-hover.png)).
- The seeded audio source played, skipped forward, paused at **0:31**, and reopened at **0:31** ([paused](audio-paused.png), [returned](audio-returned.png)); this checks its browser playback state, not sound output or native media keys.
- Both main reading sources saved a highlight and a highlight note; the Markdown highlight was changed to a Key point ([first source](j1-reading-note.png), [second source](j2-reading-note.png)).
- Both tutor questions ended with a visible error, Try again, and an editable composer when the harness returned no AI answer ([first](j1-tutor.png), [second](j2-tutor.png)).
- Both new skills appeared immediately, and filing updated their lists without reloading.
- Four due ratings saved across the two sessions: three Fact and one Explain, totaling **49,717 ms** in the real review log ([library evidence](library-evidence.json)). No clock manipulation was used; Review measures each exercise from when it is shown to its rating (`Review.tsx`, `shownAt` / `elapsed`).
- The Explain review preserved the written answer, explained that checking was unavailable, and let both key points be marked manually before Good saved.
- Both reviews could be left with exercises still available, showed an end screen, and returned Home through Done ([first ending](j1-review-end.png), [second ending](j2-review-end.png)).
- Settings opened with ⌘,; Reading, Keyboard shortcuts, and General were inspected. Searching shortcuts found Collected, and Escape closed Settings ([first](j1-settings.png), [second](j2-settings.png)).
- ⌘K opened sources and New skill; the palette retained usable focus and results after clearing a query.
- Both Finish flows saved free recall and marked the source Done despite unavailable recall feedback. The first reopen showed the original note plus the appended recall; both notes were subsequently revised through the editor.
- Both final revised notes reopened intact in **2/2 fresh-page checks each**, with the recall text retained ([measurements](saved-confirmations.json), [first source](saved-2-memory-note.png), [second source](saved-2-practice-note.png)).

- Collected opened each saved highlight and its note with one click in **2/2 fresh-page checks each**; both popups were inside the viewport ([measurements](highlight-confirmations.json), [Key point](highlight-2-memory.png), [ordinary highlight](highlight-2-practice.png)).
- The completed driver recorded no page errors and zero pending bridge calls before closing ([errors](errors.json)).

## Hesitations, follow-ups, and limits

The three strongest follow-ups were the transcript search landing and reading place, the Escape hint, and retrieving saved notes/highlights after Finish. Each received two fresh-page checks. Only the Escape hint is reported as a finding. A PDF tab looked briefly clipped in an early screenshot while its selected pill moved; after settling and on hover its full label and explanation were visible, so this was not reported as persistent clipping.

Searching for `glossary` did not find the PDF by its old fixture filename; the source was correctly titled **How Plants Make Food** from its content and was found by that title. This was a hesitation, not a violation claimed here. Prequestion waiting in newly imported sources and the Academy player's unavailable native service are harness limitations, not new findings.

Text highlighting used a DOM Range and mouseup. Files were picked with the supplied `__ORE_PICK` hook. An initial note-append attempt used `Meta+End` without first placing the caret; on this WebKit/Mac setup it replaced the previously selected first paragraph. Those tester edits were corrected through the app, followed by saved-note checks. They are not counted as app data loss. A few scripts also needed selector corrections (the Original panel changes its accessible name, and a Key point row uses its note as its label). These automation errors are preserved in the action history and excluded from findings.

The bounded scripts and [action log](actions.log) connect to the supplied browser only. No server, watcher, extra browser, source-code edit, findings-register edit, commit, push, installed-app change, or real-library access was performed.

The final interactive page and context were closed. Cleanup limitation: the initial non-interactive driver lost stdin but kept its read-only Home page connection alive (node PID 87121, client port 64537). The sandbox refused a targeted termination; the supplied WebKit server was left running. This first connection performed no journey writes. An unrelated untracked `docs/reviews/2026-11-23-codex-ux-sweep-13/` folder was present in the final status check and was left untouched.
