# Note editor UX parity sweep

Audit date: 2026-11-10. Repository inspected at `f796816eec6985bb7e29213c0c8e4f6af7a7d7f6`. This is a read-only audit; no repository edits, commits, stashes, server changes, or installed-app changes were made. Only the supplied scratch library was edited, through the running app. All audit artifacts are in this folder.

## Method and scope

The 56-item [checklist](checklist.md) was written before opening Ore or reading its UI implementation. The exclusions and earlier audit were read first. Each resolved result below has two real-input runs in Chromium and two in WebKit. Screenshots use `deviceScaleFactor: 2`: 1280×900 CSS pixels produce 2560×1800 PNGs; narrow checks use 760×800 CSS pixels.

The app was opened at `http://localhost:1520/` with the supplied Tauri mock and bridge 1522 installed before navigation. Input used Playwright keyboard and mouse, including real clipboard shortcuts, right-clicks, and mouse down/move/up drags. No synthetic DOM input events or editor model mutations were used. Mock delay/failure and file-picker flags were used only to expose controlled states. Runtime scripts and per-attempt observations are in [run.cjs](run.cjs), [followup.cjs](followup.cjs), [last.cjs](last.cjs), [results.jsonl](results.jsonl), [verified.jsonl](verified.jsonl), and [final-results.jsonl](final-results.jsonl). Later runs supersede provisional harness failures; the original logs remain for traceability.

Reference: Notion. Its [keyboard documentation](https://www.notion.com/help/keyboard-shortcuts) supports the editing/menu baseline; its [math documentation](https://www.notion.com/help/math-equations) confirms live equation editing. Local copies are saved beside this report. Notion itself was not driven in this session; viewport placement expectations use established reference behavior, not a claimed live Notion observation. The uncertain equation-cancellation expectation is explicitly untested.

Existing and declined decisions were not reopened. Routine block selection, shortcuts, and Markdown paste were exercised as prerequisites or in combinations; this report does not re-report the earlier audit's items. No native macOS-webview claim is made: WebKit here is Playwright's browser build. Spell-check, OS native context-menu contents, and AI writing were outside the numbered checks.

## Checklist results

`works` means the stated bounded behavior passed in both repeats in both engines. `untested` means a full defensible conclusion was not established, even if part of the behavior was exercised.

| # | Behavior | Result | Engines | Evidence / qualification |
|---|---|---|---|---|
| 1 | Notion: typing into a fresh empty note immediately displays the typed text. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 2 | Notion: Backspace at the very start of an empty note is harmless and keeps typing possible. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 3 | Notion: Enter in the middle of a paragraph splits at the caret without losing either half. | **works** | Chromium ×2; WebKit ×2 | Exact split Alpha / Beta verified after adding human-scale pauses between keys. |
| 4 | Notion: Shift+Enter in a paragraph creates a line break in the same block. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 5 | Notion: Delete at the end of a paragraph joins the next paragraph without losing text. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 6 | Notion: left arrow at the beginning of the first block keeps the caret in the note. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 7 | Notion: right arrow at the end of the final block keeps the caret in the note. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 8 | Notion: double-click selects a word without changing the text. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 9 | Notion: triple-click selects the paragraph's text without changing it. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 10 | Notion: pointer drag within a paragraph selects only the intended text. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 11 | Notion: Shift+arrows can select text across a paragraph boundary, without becoming block selection. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 12 | Notion: replacing a text selection by typing replaces only that selection. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 13 | Notion: undo then redo of selection replacement restores the two exact text versions. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 14 | Notion: cutting selected words and pasting them elsewhere moves only those words. | **works** | Chromium ×2; WebKit ×2 | Cut/paste moved Beta to the beginning; both exact text versions recorded. |
| 15 | Notion: copying formatted words and pasting preserves their formatting. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 16 | Notion: paste without formatting inserts the clipboard words without their rich formatting. | **untested** | Chromium ×2; WebKit ×2 | Untested: both plain-paste key combinations also failed in a standalone contenteditable control; normal ⌘V pasted rich text there. Browser limitation not attributed to Ore. |
| 17 | Notion: pasting multiple lines into the middle of existing text preserves the text on both sides. | **works** | Chromium ×2; WebKit ×2 | Both surrounding text fragments survived. |
| 18 | Notion: pasting a URL over a selected phrase preserves the phrase as the link label after reload. | **works** | Chromium ×2; WebKit ×2 | Label guide and URL both survived reload. |
| 19 | Notion: undoing a multiline paste restores the exact original paragraph. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 20 | Notion: a slash search with no matches leaves the typed query editable. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 21 | Notion: Enter on a slash search with no matches does not silently discard the query. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 22 | Notion: arrow navigation at the first and last slash-menu results always leaves a visible active result. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 23 | Notion: Esc from a filtered slash menu keeps typed text and returns to editing it. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 24 | Notion: Backspace from a filtered slash query updates the visible results. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 25 | Notion: selecting a slash command with the pointer leaves the caret in its new block. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 26 | Notion: a slash menu near the bottom of the viewport stays reachable within the viewport. | **differs** | Chromium ×2; WebKit ×2 | F1: menu starts below the bottom edge. |
| 27 | Notion: an inline formatting tool can be toggled on and off while typing at a collapsed caret. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 28 | Notion: the selection formatting toolbar reflects the selection's existing bold state. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 29 | Notion: changing formatting through the selection toolbar preserves the selected words. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 30 | Notion: right-click on selected words preserves that selection for native Copy/Cut. | **works** | Chromium ×2; WebKit ×2 | Selection preservation tested with a real right-click; native OS menu contents were not inspected. |
| 31 | Notion: a nested block-menu submenu opens by keyboard and Left closes only that submenu. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 32 | Notion: choosing Turn into keeps the block's words and returns editing focus to that block. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 33 | Notion: moving the first block upward or the last downward is harmless. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 34 | Notion: duplicating a selected block then undoing and redoing leaves the expected copy count. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 35 | Notion: selecting blocks backward with Shift+Up and then shrinking with Shift+Down follows the anchor. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 36 | Notion: Shift+click across several blocks includes the intermediate blocks. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 37 | Notion: gutter drag can select a mixed set of text and non-text blocks. | **works** | Chromium ×2; WebKit ×2 | Text–image–text selection; real gutter mouse drag. |
| 38 | Notion: dragging a selected pair by the block handle moves the pair together and preserves order. | **works** | Chromium ×2; WebKit ×2 | First/Middle moved after Last as one ordered pair. |
| 39 | Notion: dragging a block then pressing Esc cancels the move. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 40 | Notion: an open toggle's child text survives collapse, reopening, and reload. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 41 | Notion: a callout can contain multiple editable paragraphs without losing them on reload. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 42 | Notion: code blocks preserve indentation and literal Markdown punctuation after reload. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 43 | Notion: Shift+Tab at a table's first cell does not delete text or leave an invalid caret. | **works** | Chromium ×2; WebKit ×2 | First-cell Shift+Tab kept Header and allowed X to be typed. |
| 44 | Notion: a wide table scrolls within a narrow note without forcing the whole page sideways. | **works** | Chromium ×2; WebKit ×2 | 760px window; table scrollWidth 975px inside 504px container; page width stayed 760px. |
| 45 | Notion: an image load failure leaves the rest of the note editable. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 46 | Notion: editing a displayed equation and cancelling retains the original expression. | **untested** | Chromium ×2; WebKit ×2 | Ore changes x^2 to y^3 immediately and keeps y^3 on Esc, twice per engine. Notion documents live updates, but Esc rollback could not be verified. No finding. |
| 47 | Notion: inserting an internal note link and then typing continues after the link. | **works** | Chromium ×2; WebKit ×2 | Two repeated passes per engine; raw observations and screenshots saved. |
| 48 | Notion: a diagram can open and close back to its place in a long note without losing surrounding text. | **works** | Chromium ×2; WebKit ×2 | Mouse-drawn diagram created through app, reopened and closed from long note. |
| 49 | Notion: a long mixed-block note survives save and reload with its block types and text intact. | **works** | Chromium ×2; WebKit ×2 | Long fixture, every required block kind, attached SVG and mouse-drawn diagram; compared after reload. |
| 50 | Notion: text remains editable at a narrow desktop width without inaccessible offscreen formatting controls. | **works** | Chromium ×2; WebKit ×2 | 760px desktop width; toolbar bounds and subsequent typing checked. |
| 51 | Notion: opening a note during a delayed load shows progress until the editable note is ready. | **missing** | Chromium ×2; WebKit ×2 | F2: controlled 2.5s note-read delay; empty editor area until completion. |
| 52 | Notion: a failed save retains the unsaved text and exposes an actionable error. | **works** | Chromium ×2; WebKit ×2 | Mock rejected save with an actionable test error. Draft stayed editable; after clearing failure, a later edit saved. |
| 53 | Notion: an interrupted operation leaves a usable note and preserves text already written (streaming AI is outside Ore's note-editor scope, D38). | **works** | Chromium ×2; WebKit ×2 | Cancelled mock image picker; surrounding writing remained usable. Streaming AI is excluded by D38. |
| 54 | Notion: note-editor toolbar controls disclose their function and available shortcut on hover; Ore uses Hint, never bare title. | **works** | Chromium ×2; WebKit ×2 | Fresh selection per hover removes overlapping-tooltip interference from the preliminary run. |
| 55 | Notion: peer actions in a block menu use consistent icon treatment; Ore uses its dot icons, with no emoji or smooth replacement glyphs. | **works** | Chromium ×2; WebKit ×2 | Root actions consistently omit leading icons. The submenu arrow is a navigation indicator, not a peer action icon; it uses the dot set. |
| 56 | Notion: editing the same supported block type in a source note and a skill note has the same keyboard behavior. | **works** | Chromium ×2; WebKit ×2 | Same heading-to-paragraph sequence in source and skill notes. |

## New findings

### F1 — Slash menu opens below the visible window (item 26)

**Class A — plain miss. Result: differs.** Reproduced twice in Chromium and twice in WebKit.

1. Open Learning from the sidebar. Focus the skill note and clear it with ⌘A twice, Backspace.
2. Type 35 separate paragraphs, `Long paragraph 0` through `Long paragraph 34`, pressing Enter between them.
3. Press Enter once more at the end and type `/` with the last line near the bottom of the 1280×900 viewport.
4. Inspect the menu without scrolling the page or changing the query.

**Ore:** the full 670px-high slash menu begins at y=898.73 in Chromium and y=899.95 in WebKit. Its choices are below the viewport; the visible caret and slash give no usable pointer menu. **Notion:** a command menu remains visible and selectable at the viewport edge, repositioning or constraining its scrollable list.

**Likely source:** [NoteEditor.tsx:826](apps/desktop/src/editor/NoteEditor.tsx:826) always places the menu at the trigger's bottom +4; [NoteEditor.tsx:699](apps/desktop/src/editor/NoteEditor.tsx:699) applies those coordinates directly. [styles.css:1321](apps/desktop/src/styles.css:1321) uses fixed positioning without a desktop height limit, overflow scrolling, or viewport collision handling. This is an implementation diagnosis, not a patched or tested fix.

**2× screenshots:** [WebKit run 1](shots/webkit-1-26.png), [WebKit run 2](shots/webkit-2-26.png), [Chromium run 1](shots/chromium-1-26.png), [Chromium run 2](shots/chromium-2-26.png). The absence of a visible menu is the captured failure; the recorded bounding box distinguishes it from a menu that failed to open.

### F2 — Delayed note opening leaves an unexplained blank area (item 51)

**Class C — shared screen implementation. Result: missing.** Reproduced twice in Chromium and twice in WebKit.

1. Open Teaching to leave the Learning note.
2. Set the provided mock's `window.__ORE_SLOW = { notes: 2500 }` (a controlled read delay; no server change).
3. Click Learning and inspect the note after 400ms, before the delayed response completes.
4. Wait for the editor to appear, then clear the delay flag.

**Ore:** the note area contains only `Your note`; there is no editable document, loading text, or activity indicator. The editor appears once the response returns. **Notion:** pending page content has visible loading feedback, so blank content is distinguishable from a load still in progress. This finding is about opening the note, not a request for a permanent save badge or AI feature.

**Likely source:** [Notes.tsx:249](apps/desktop/src/Notes.tsx:249) explicitly returns an empty `div.note-editor` while either text or directory is null.

**Other screens likely affected:** the source-note pane and other skill-note pages use the same `NoteBody` loading branch. The delay was reproduced on the Learning skill page; propagation to the source-note pane is a source-based inference, not a separate runtime finding.

**2× screenshots:** [WebKit run 1](shots/webkit-1-51-loading.png), [WebKit run 2](shots/webkit-2-51-loading.png), [Chromium run 1](shots/chromium-1-51-loading.png), [Chromium run 2](shots/chromium-2-51-loading.png).

## Uncertainty and excluded hypotheses

Item 16 is **untested**: neither ⇧⌘V nor ⌥⇧⌘V inserted text in a standalone browser editable control, while ⌘V did. This control experiment was repeated twice per engine. The audit cannot distinguish an Ore limitation from unavailable native plain-paste behavior, so it reports no bug.

Item 46 is **untested as a parity claim**. Ore's live equation edits survive Esc on all four attempts, but the reference source does not establish rollback on Esc. It would be misleading to call this a gap. No change is recommended on that evidence.

Preliminary clipboard, focus, and tooltip probes had harness problems. They are retained in the raw logs, but only the corrected repeated observations determine the final table. No slow simulated key sequences, screenshot timing, or missing selector is presented as a product defect.

The known external-edit undo-history loss, selected-block ⌘K, emoji, and deferred drag-box autoscroll are not findings. No new behavior decision is requested from Tyler on the confirmed findings.

## Totals

- Checklist items: **56**.
- Resolved items checked twice per engine: **54**.
- Works: **52**.
- Missing: **1**.
- Differs: **1**.
- Untested: **2**.
- Confirmed findings by class: **A: 1; B: 0; C: 1**.
- A: 0 missing, 1 differs. C: 1 missing, 0 differs.
