# Pointer-only sweep — pointer

Tested the supplied Mac release build in WebKit at 1280×800 and its configured minimum, 720×480, plus the phone build at 390×844 with touch. Screenshots use 2× scale. Covered source capture, row menus, renaming, filing, pinning/reordering, archive/Undo, sidebar skills, source and skill notes, highlight selection and endpoints, a diagram, feed posts, and Review. Used only clicks, right-clicks, pointer drags, taps, text entry, wheel deltas, and dispatched touch gestures; no key presses or keyboard shortcuts. All changes went through the app into the assigned scratch libraries; no application code or shared findings ledger was changed. Native file drops used the supplied Tauri event shim; phone file import used its file input. **Not fully covered:** courses (none seeded; D79.5 explicitly defers moving sources into courses and lesson reordering), native Finder/window-manager behavior, iOS selection handles/Copy bar, physical trackpad inertia, iOS native Undo gestures, and simulator-only behavior. Synthetic long presses and horizontal swipes test the app handlers, not UIKit. Four confirmed new findings follow.

Source checkout inspected: `cc6e604c7cdd512db27094ba33770c0dcb32288b`. Findings were observed on the supplied running builds; those builds were not rebuilt.

## Findings

### P1 — Typed/pasted content and direct feed URLs cannot be submitted by pointer

**S2 · Mac · reproduced with text and a direct RSS/Atom URL; text repeated in `repro.cjs`.**

1. Open a fresh Mac page, click Home, then **+ Add**.
2. Type or paste ordinary text into “Link, file path or text.”
3. Click the footer’s **↵ Add**.
4. Alternatively open Feed → Follow and enter `https://simonwillison.net/atom/everything/`. Wait for the feed preview, then click **↵ Follow**.

Expected: a clickable Add/Follow action submits the content. Actual: the footer label does nothing. The dialog stays open with the input intact. Its actual buttons are the skill picker, Browser tab, and File; the primary action is only wired to Enter. This blocks the common capture path for a pointer-only user.

A website URL such as `https://simonwillison.net/` exposes a **separate actual Follow button** after feed discovery, and that path works. File picking/drop also works. The finding is specifically the primary text/link/direct-feed submission, not every import path.

Evidence: `text-add-click-noop.png`, `follow-click-noop.png`, `repro-add-1.png`, `repro-add-2.png`.

Suspected source: `apps/desktop/src/Add.tsx:202` handles Enter; `:272` renders the primary action as a plain `<span>`, with no click handler.

### P2 — Clicking outside Edit skill discards the typed name

**S2 · Mac and iPhone · 2/2 Mac and 2/2 phone in the exploratory journey, plus Mac repeats in `repro.cjs`.**

Mac:

1. Open a fresh page. Right-click **Creativity** in the sidebar → **Edit skill…**.
2. Replace its name with “Creative pointer.”
3. Click the dimmed page outside the editor.
4. Look at the sidebar, then reopen Edit skill.

Phone:

1. Open the drawer, long-press **Creativity**, tap **Edit skill…**.
2. Tap the name and type “Phone creative.”
3. Tap outside the editor, then reopen the drawer/editor.

Expected: clicking/tapping away saves the valid name, per D211 and the name field’s own behavior contract. Actual: the editor closes and the old name remains; the draft is lost without an error. On Mac the tested outside point was `(900,750)`; on phone `(380,670)`. Ordinary source-row rename did save on click-away on both platforms.

Evidence: `skill-name-before-1.png`, `skill-name-after-1.png`, `skill-name-before-2.png`, `skill-name-after-2.png`; `phone-skill-before-1.png`, `phone-skill-after-1.png`, `phone-skill-before-2.png`, `phone-skill-after-2.png`; `repro-rename-*.png`.

Suspected source: `apps/desktop/src/Skills.tsx:370` closes/unmounts the overlay on outside mouse-down; `:293` relies on the input’s later blur to save. The outside dismissal bypasses that save. Related to the skill-name surface of F146, but this is loss before any rename write, not Undo racing a pending write.

### P3 — Dropping a sidebar skill on blank page space still reorders it

**S2 · Mac · 2/2 on different skills, plus two fresh-page repeats in `repro.cjs`.**

1. Open Home at 1280×800 with the sidebar visible.
2. Drag a non-last skill in **Other** from its name into blank main-page space near `(900,720)`.
3. Release without crossing a visible destination in the sidebar.
4. Inspect the order in Other.

Expected: a release outside any sidebar drop target cancels the move. Actual: the skill moves to a different sidebar position despite release over the main page. In the original seed, Creativity moved from between Creator Business and Focus & Attention to the end; then Creator Business moved to the end. The new order persisted through navigation and a new page. No ghost remained; the bug is the unintended committed destination.

Evidence: `sidebar-outside-creativity.png`, `sidebar-outside-creator-business.png`, `repro-outside-drop-1.png`, `repro-outside-drop-2.png`; before/after orders in `repro-results.json`.

Suspected source: `apps/desktop/src/Sidebar.tsx:128` falls back to `closestCenter` when the pointer is over no target. `:148–165` then commits that nearest row/draft at drag end instead of cancelling the out-of-sidebar drop.

### P4 — Releasing a text selection in the blank margin does not create a highlight

**S2 · Mac · 2/2 on an unmarked paragraph; inside-text control succeeded; repeated on another paragraph in `repro.cjs`.**

1. Open a fresh page and use File/drop to add `codex-out/pointer/selection.md` if it is not already in the assigned scratch library.
2. Open **Pointer selection laboratory** and hide the side panel. Scroll about 650 px to the paragraph “Paragraph after the picture remains selectable.”
3. Start a text drag at the paragraph’s first word and release in the blank right margin, around x=1150, keeping the pointer on the same line.
4. Wait, then click elsewhere and reopen the source.

Expected: a selection wholly within the source is saved as a highlight when the drag ends, even when mouse-up lands outside the text column. Actual: the full paragraph remains only a native browser selection; no highlight popup appears and no highlight is saved. Clicking away loses the selection. Repeating the same selection while releasing **inside** the paragraph immediately saves it and opens the popup.

Evidence: `outside-selection-1.png`, `outside-selection-2.png`, `inside-selection-control.png`, `repro-outside-selection-1.png`, `repro-outside-selection-2.png`. In the two initial outside runs, `getSelection().toString()` was the complete paragraph and the Remove highlight control count was zero; the inside control count was one. The annotation log contains the inside control’s shorter passage, not the outside runs’ full paragraph.

Suspected source: `apps/desktop/src/Reader.tsx:3393` attaches `onMouseUp` only to `.page`; the selection-to-highlight handler at `:2766` never sees release in the surrounding margin. Distinct from F292: the source was fully loaded, and release position alone changes the result.

## Known rows checked

No confirmed return of a fixed finding. In particular:

- F10/F22: Home source → sidebar skill worked, and immediate toast Undo during a delayed filing write eventually restored the original skills.
- F23/F76: highlight note words survived closing/reopening in the tested journeys.
- F144: a feed post retained by a note changed from Not saved to saved and appeared in All sources after the write settled.
- F193: exercised a note-block drag beyond the viewport and the page remained usable. The timing of the move relative to the following click was not instrumented, so this is not a conclusive regression check.
- F16: immediate phone archive Undo worked from both long-press and swipe actions. Expired toasts were not counted as failed Undo.
- F103: wheel scrolling closed the opened source figure without leaving an invisible blocker.

The preamble’s excluded open issues were not re-reported. AI-null behavior was not counted as a failure.

## What passed

- Mac and phone: one click/tap opens a source; source rename saves on click/tap away.
- Mac: source right-click includes Open, Rename, Pin, status, Skills, original/reveal/copy, and Archive.
- Mac: source archive → toast Undo restores the row; feed-source archive/Undo also restores it.
- Mac: Home source → sidebar skill files it; a 1600 ms delayed edit followed by Undo returns the previous skills after both writes settle.
- Mac: an injected filing failure reports the error and leaves the source unfiled; a subsequent pointer action remains usable.
- Mac: pin two sources, drag the second before the first, and observe the new order.
- Mac: source-row drops at the scrollbar/right edge and beyond the viewport leave no `.dragged` or `.row-drop` ghost.
- Mac: a skill dragged to Craft moves into that collection; archive skill → toast Undo restores it.
- Mac: creating a skill by typing and clicking away works; deleting that empty skill works. **Mac deletion Undo was not verified** because its toast expired between exploratory calls.
- Mac: dispatching a file drop imports the Markdown fixture; drag-enter followed by drag-leave removes the drop overlay.
- Mac: an SVG dropped on the measured note editor bounds inserts the image into the skill note. A preliminary drop outside the note correctly followed the unsupported-source path; that was not an app failure.
- Mac: forward cross-paragraph selection, reverse selection, table/header-to-cell selection, code selection, and selection across a real source image open highlight actions.
- Mac: double-click heading and triple-click paragraph produce saved selections after the double-click delay; a highlight endpoint drag changes its range; Remove highlight → Undo restores it.
- Mac: a source note persists after save, navigation, and reopen; block-menu Move down changes its order.
- Mac: reader scroll was 603 px before navigation and restored to 603 px after reopening following the note write.
- Mac: small, large, and horizontal wheel deltas did not scroll the whole document; diagram wheel/pan stayed in the diagram while the underlying reader position stayed fixed.
- Mac: create a diagram through the note’s slash menu, choose Box, draw, right-click its commands, and close through Done. No keys needed beyond typing the slash command.
- Mac: follow a website’s discovered feed, open a post once, mark read/Undo, write a note to retain it, find it in All sources, and archive/Undo.
- Mac: Review start, confidence, reveal, Edit exercise/Save, Retire/Undo, rate, leave, and Done are pointer-reachable. Retire Undo explicitly says the restored exercise returns in a later review.
- Phone: long-press source menu opens; rename, archive/Undo, and source reopening work.
- Phone: synthetic left swipe archives; right swipe toggles Done; toast Undo restores both. Touch-cancel leaves the source in place; Archive’s left swipe restores a source.
- Phone: left-edge swipe returns from source and note; a cancelled back swipe stays on the source.
- Phone: note content and highlight-note content survive leaving/reopening; tapping a saved highlight exposes its actions, and Remove highlight/Undo restores the collected count.
- Phone: Review confidence, reveal, Edit exercise/Save, rating, Leave, and Done work by taps.
- Phone: create a skill by typing then tapping away; archive it through its hold menu and tap Undo to restore it.
- Phone: importing the Markdown fixture through File or photo works and shows Added with Undo.

## Additional coverage observations and limits

- **Source rows into notes:** twice dragged a Learning source row onto the empty skill note (Building Effective Agents, then Lecture 4). No link or text was inserted and no error appeared. Recorded in `source-row-to-note-noop.png`. The implemented row drop handler (`App.tsx:2208`) handles pinned order and sidebar skills only. This is a capability gap to assess against the intended interaction; not counted among the four confirmed bugs because the specific source-row-to-note behavior is not defined in a settled decision. Image-file-to-note drop did work.
- **Targets:** sidebar skill action buttons measure 22×22 px at both 1280×800 and 720×480, with no pseudo-element hit expansion (`styles.css:219`). Phone skill colour swatches measure 20×20 pt with 8 pt gaps (`styles.css:455`), below the interaction checklist’s 44 pt target. Evidence: `small-sidebar-target.png`, `small-sidebar-target-min.png`, `phone-swatches-targets.png`. WebKit redirected a near-edge phone tap to the swatch successfully, so these are measured sizing concerns, not claimed failed taps.
- The minimum Mac reader layout remained usable with source and note side-by-side; it automatically collapsed the sidebar. This was a sampled minimum-size check, not every screen/control at minimum size.
- Popup entry/exit, source/skill row menus, and hover controls did not strand a ghost in tested paths. Every possible drag-over-popup combination was not exhausted.
- Course lifecycle was not fabricated through direct library edits. No course was in the seed. D79.5 already excludes lesson reordering and dropping sources into courses; course open/rename/archive/Undo still needs a seeded course run.
- Phone Feed parity and native note-block dragging were not assumed. D38 explicitly leaves touch block dragging out in favor of the keyboard bar’s Move action.
- Browser WebKit does not verify native Mac Edit-menu Undo or UIKit’s shake/three-finger Undo. Quiet changes that have no toast were not labeled un-undoable just because those native surfaces are absent here.
- The file fixture’s inline data-URI image text is deliberately not used as an image-import finding; image selection used the seeded Building Effective Agents figure instead.
- Saved screenshot paths above are relative to `codex-out/pointer/`. `driver.cjs` and `actions.log` preserve the exploratory driver and commands. `repro.cjs` is a bounded standalone repeat of the four Mac findings; `repro-results.json` records its results.
- All owned browser contexts/pages were closed. The supplied browser/server processes were left running.
