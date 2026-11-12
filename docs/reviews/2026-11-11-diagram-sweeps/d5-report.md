# Diagram sweep 5

**Not clean. Sweep 4's three fixes pass twice, with clipboard permission supplied as in sweep 4. One first-hour finding remains: editing a saved label opens an empty field; Tab through a reopened matrix erases the visited labels.**

Tested HEAD: `3231c893c6e481b0342d689e173b438f1aa30225`. The endpoint answered before testing: WebKit **26.6**, `webkit.connect("ws://[::1]:1661/")`. Vite **1530**, scratch bridge **1532**, viewport **1440×900**, deviceScaleFactor **2**; original screenshots **2880×1800**. Read d4's prompt/report, inherited d3/d2 instructions, earlier reports, D213/D216 and Canvas Conventions. All interactions used real pointer/key input. DOM/SVG reads supplied observations; no diagram state was injected.

## Sweep 4 confirmations

Each row used two independent constructions at 100% in the full-window editor. Done → wait for the note preview → reopen that same diagram → expand was used throughout.

| Check | Result | Evidence |
|---|---|---|
| Top placement survives close/reopen | **Fixed twice.** Box from (400,330) to (1000,530), `Practice section`, Style → More → Top; Left in run 1, Right in run 2. Label SVG coordinates and anchors were identical before/after. | [Before 1](shots/top-before-1.png), [after 1](shots/top-after-1.png); [before 2](shots/top-before-2.png), [after 2](shots/top-after-2.png). |
| Dragged elbow middle survives reopening and moving an end node | **Fixed twice.** Recall at (350,300), 160×64 → right + → Memory → ten Shift-Down presses → select connector → Elbow → drag middle 55 px right → Undo/Redo → Memory Shift-Down and Shift-Right → close/reopen → select Memory's visible rectangle → Right once. Middle x stayed **312** in run 1 and **795** in run 2 through both endpoint movements and reopen. The final endpoint moved exactly 1 unit. | [Before 1](shots/elbow-before-1.png), [reopened 1](shots/elbow-reopened-1.png), [after nudge 1](shots/elbow-after-move-1.png); [before 2](shots/elbow-before-2.png), [reopened 2](shots/elbow-reopened-2.png), [after nudge 2](shots/elbow-after-move-2.png). |
| Right-click Copy → blank-canvas right-click Paste | **Fixed twice with clipboard-read permission.** `Clipboard concept` at (400,350), 160×64 → right-click box → Copy → right-click (900,550) → Paste. Each run changed one box/label into two boxes/labels without Command-V. | [Run 1](shots/fix-menu-paste-permission-1.png), [run 2](shots/fix-menu-paste-permission-2.png). |
| ⇧M matrix still walks with Tab after reopening | **Navigation works, text preservation fails twice.** Built the full two-method/four-property matrix with Tab, closed/reopened, double-clicked Retrieval, then Tab six times and Esc. Focus walked the cells, but their editors were empty and seven visited labels disappeared. Finding 1. | [Reopened 1](shots/matrix-reopened-1.png), [after Tab 1](shots/matrix-tab-after-1.png); [reopened 2](shots/matrix-reopened-2.png), [after Tab 2](shots/matrix-tab-after-2.png). |

**Clipboard qualification:** two attempts in a fresh context without an explicit permission grant still showed “Couldn't reach the clipboard. Try ⌘V.” and added nothing. After `context.grantPermissions(['clipboard-read'])`, both fresh Copy → menu Paste constructions worked. Sweep 4 failed even with that permission; its usable-text handling defect is fixed in the equivalent permitted setup. No claim about native Tauri clipboard permissions is made. The fresh-context permission refusal is not ranked as a separate product defect.

## Quick first-hour study pass

One pass of all seven study tasks followed the confirmations. These are walkthroughs, not timed novice-participant measurements.

| Task | Result | Evidence |
|---|---|---|
| Six concepts, five named links, move Memory | Completed; connections and labels followed the moved node. | [Map](shots/01-map-after-mouse-study.png). |
| Tidy the messy map | Completed with ⇧T; six concepts and relation labels remained readable. | [Tidy](shots/02-tidy-keyboard-study.png). |
| Five-node flow, decision, branches, retry | Completed with all five named relationships. No new first-hour failure. | [Flow](shots/03-flow-mouse-study.png). |
| Compare two methods on four properties | Completed with ⇧M and Tab, including row growth. Reopen/edit loss is covered by finding 1. | [Matrix](shots/04-complete-keyboard-study.png). |
| Heading, free note, three concepts, titled enclosure | Completed; Top clears the concepts without a separate title workaround. | [Section](shots/task5-title-top-study.png). |
| Rename, convert, recolour, delete link, undo | Retrieve became Recall, rectangle became ellipse, two concepts became green, and Undo restored the labelled link. | [Corrections](shots/06-fixed-keyboard-study.png). |
| Close/reopen, fit and zoom to read | Objects and labels returned, including the section title at the top. Fit and zoom worked. Editing saved labels remains finding 1. | [Reopened](shots/07-reopen-keyboard-study.png), [zoomed reading view](shots/07-read-keyboard-study.png). |

No additional finding met the first-hour threshold. Contact sheets used for visual inspection: [tasks 1–4](shots/study-contact-0.png), [tasks 5–7 and Paste](shots/study-contact-1.png).

## Ranked finding

### 1. Reopened labels edit as blank; Tab through a saved matrix erases its text — C

**First-hour impact:** a learner returns to correct a concept name or continue a comparison. The saved words are visible until editing starts. The field then opens empty. Moving on without typing deletes the existing words. This affects both the requested matrix check and an ordinary concept box; it is one shared saved-text defect.

**Matrix reproduction, twice:**

1. On blank canvas press ⇧M. Fill the headings `Retrieval`, `Rereading`, then Tab through four property rows: `Action / Recall answer / Read again`; `Feeling / Effortful / Fluent`; `After a delay / Memory stronger / Little lasts`; `Practice / Space tests / Check by recall`.
2. Finish editing. Done, reopen the same diagram, expand.
3. Double-click the visible `Retrieval` heading. Its editor is empty rather than containing `Retrieval`.
4. Press Tab six times, then Esc without entering replacement text.

**Ore:** Tab traverses the saved matrix, but each editor opens empty. `Retrieval`, `Rereading`, `Action`, `Recall answer`, `Read again`, `Feeling`, and `Effortful` disappear. The other seven labels remain. Both runs produced the same loss; the six recorded textarea values in each run are all empty.

**Ordinary box reproduction, twice:** draw a 160×64 box at (400,350), type `Recall`, finish; Done, reopen, select the visible box, Enter. The field is empty. Esc finishes that empty edit and removes `Recall`. Command-Z restores it. This verifies the issue beyond matrix navigation; it does not request changing the settled Enter/Esc policy.

**Expected/reference behavior:** editing an existing label should expose its saved words for revision. Sweep 1's item 49 established that existing-label editing worked in the original comparison, and sweep 4's live Excalidraw persistence check retained saved labels. No new live Excalidraw/tldraw/FigJam reopen-and-edit comparison was run in this quick sweep; the finding rests on twice-reproduced loss of Ore's own saved text, not a claimed new reference feature.

**Evidence:** matrix [before 1](shots/matrix-reopened-1.png), [after 1](shots/matrix-tab-after-1.png), [before 2](shots/matrix-reopened-2.png), [after 2](shots/matrix-tab-after-2.png); ordinary box [empty editor 1](shots/label-empty-editor-1.png), [erased 1](shots/label-erased-1.png), [Undo 1](shots/label-undo-1.png), [empty editor 2](shots/label-empty-editor-2.png), [erased 2](shots/label-erased-2.png), [Undo 2](shots/label-undo-2.png). `matrix-tab-after-1/2` and `label-erased-1/2` in [observations](observations.jsonl) contain the values and geometry.

**Likely source:** [Editor.tsx:327](../../apps/desktop/src/draw/Editor.tsx#L327) initializes a bound-label edit from `labelOf(els, id)?.originalText ?? ""`, with no fallback to its saved `text`. [model.ts:371](../../apps/desktop/src/draw/model.ts#L371) intentionally omits `originalText` when equal to `text`; `fromScene` at line 316 does not reconstruct it. Free-text editing already falls back to `e.text` in the other branch of the same Editor expression. This is another omitted-field/load-default mismatch, hence class C.

**Smallest fix:** initialize bound-label editing from `originalText ?? text ?? ""` (or normalize the missing field on load). Add a save/reopen/edit regression that verifies the current text, plus a saved-matrix Tab regression that verifies traversal leaves untouched cell text intact. A render-only reopen check cannot catch this.

## Boundaries

- Only `codex-out/d5/` received filesystem writes. No implementation edits, commits, stashes, server lifecycle changes, installed-app access or real-library access. Supplied scratch-library changes used the app only.
- HEAD remained `3231c893c6e481b0342d689e173b438f1aa30225`; tracked diff stayed empty; Git status remained the pre-existing untracked `codex-out/` tree.
- No JavaScript page errors were observed. Native relaunch, physical trackpad behavior, exports and exhaustive graph/control stress were not tested in this quick pass.
- D103 exclusions, Terminal style, D157, D175, D40, taste and settled Conventions remain excluded.
- The driver reuses earlier input helpers read-only. The first non-TTY harness ended at stdin EOF before task input; the working TTY run performed all recorded tests. No server was restarted. Inherited helper completion notes are not verdicts; the tables above reflect this run's observations.
- [Driver](driver.cjs), [confirmation helpers](confirm.js), [ordinary-label confirmation](label-confirm.js), [commands](commands.jsonl), [input log](input-log.json), [observations](observations.jsonl), [task records](tasks.jsonl), [verification summary](verification.json).

## Ranked findings, one line each

1. **C — Reopened labels edit as blank; Tab through a saved matrix erases its text.**
