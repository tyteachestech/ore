# Deep scan 5 — editor

Covered the real headless Milkdown editor's block conversions, move/duplicate/delete, list and toggle indentation, table commands and undo; synthetic Safari, Chrome, Notes, Word, Google Docs and Notion clipboard HTML; real DOM paste events in table cells and code; a 100 KB paste; text colors and picker-produced links; diagram model edits, matrix duplication/deletion, JSON round-trips, and SVG export. Read the working agreement, spec, glossary, findings, sweeps, relevant decisions and prior deep-scan reports; stayed off EPUB front matter, highlight animation timing, and scan 3's preservation audit. No app, browser, server, watcher, e2e, benchmark, full test suite, native clipboard or real AI was started. All writes are under `codex-out/editor/`; scratch libraries are under its `libs/`. Native clipboard files, native PNG copying, pointer geometry, real iPhone behavior, and diagram save races remain untested. “Both” below means shared Mac/iPhone code, exercised headlessly on the Mac, not a device observation.

Snapshot: `05c68297d33d46d6b17b404c101543bc9dfd9557`, Bun 1.4.4, macOS arm64. **Seven findings. Each red command failed on its intended assertion in 3/3 fresh processes.** Additional confirmations and timings are in [confirmations.json](confirmations.json); every confirmation exited 1 and took 15–173 ms wall time. Commands below run from `/Users/tylerpoelking/Developer/ore-wt/deep5`. Diagnostic output and assertion messages are reproduced below; stacks and the headless KaTeX quirks-mode warning are omitted. Nothing was fixed or added to the findings registry, per the findings-only instruction.

## Findings

### editor-01 — Adding a matrix row after deleting its last corner corrupts the saved matrix

**S1 · Mac editing; both devices receive the corrupted diagram.** D103's compare matrix, saved through D40's core diagram writer.

**Red command**

```sh
ORE_NO_ENRICH=1 bun codex-out/editor/matrix-delete.ts
```

```text
[DEEP] {"removeIndex":3,"afterDelete":3,"afterGrow":5,"invalidElements":5,"savedNullWidths":5,"afterReload":3,"lostNewCells":2}
AssertionError: Adding a row after deleting one matrix cell must not corrupt every cell or lose the added row on reload
5 !== 0
```

**Minimized steps:** Create a 2×2 compare matrix. Select its bottom-right cell alone, delete it, then select a remaining cell and choose Add a row. Save and reopen. Individual cell selection is reachable by editing a cell (`startEdit` keeps that cell selected) or Tab between cells; Delete calls the same `remove` as this script. The script uses `growMatrix`, `toScene`, real `setDiagram`/`getDiagram` in its own library, and `fromScene`.

**Expected:** remaining cells retain valid geometry and the added row survives. **Actual:** row creation produces two elements with no `type`, `width` or `height`; layout propagates invalid widths into all five cells. JSON saves those widths as `null`, and reopening discards both new elements because they have no type. This is on-disk data corruption, not an SVG-only display issue.

**Runs:** [1](logs/matrix-delete-1.log), [2](logs/matrix-delete-2.log), [3](logs/matrix-delete-3.log), all red.

**Ranked hypotheses and probes**

1. Row creation assumes the bottom-right template still exists. Prediction: deleting another corner passes. **Confirmed:** `matrix-delete.ts 0` has zero invalid elements and retains all five on reload; the default bottom-right deletion fails.
2. Layout cannot handle any gap in a matrix. Prediction: laying out the three remaining cells, without growing, is already invalid. **Ruled out:** `matrix-delete-diagnose.ts` reports `layoutOnlyFinite:true`.
3. JSON/core persistence corrupts valid geometry. Prediction: elements before serialization remain valid. **Ruled out:** the same probe sees two missing types and five non-finite widths before core is called. [Probe log](logs/matrix-delete-diagnose.log), [control](logs/matrix-delete-control.log).

**Cause:** `apps/desktop/src/draw/model.ts:1349` assumes the maximum-row/maximum-column cell exists. At `:1357`, spreading the absent template creates incomplete elements; `:1331–1338` propagates their missing dimensions through matrix layout. `:319` drops the typeless saved elements on reload. The actual action is `apps/desktop/src/draw/Editor.tsx:600`; core's minimal scene check (`packages/core/src/diagrams.ts:29–40`) accepts the resulting JSON.

### editor-02 — Pasting two plain lines at a table caret deletes that cell and its neighbor

**S1 · Both.** D38: note content is lost through an ordinary paste.

**Red command**

```sh
ORE_NO_ENRICH=1 bun codex-out/editor/paste-event.ts table
```

```text
[DEEP] {"mode":"table","before":"| Header 1 | Header 2 |\n| -------- | -------- |\n| KEEP     | NEIGHBOR |\n","selectionEmpty":true,"after":"| Header 1 | Header 2 |\n| -------- | -------- |\n| First    | Second   |\n","eventTaken":true,"blocks":["table"]}
AssertionError: Paste at a cell caret must not delete that cell or its unselected neighbor
```

**Minimized steps:** Open a two-column table containing `KEEP` and `NEIGHBOR`. Put an empty text caret before `KEEP`; select no cells or text. Dispatch a DOM paste event with only `text/plain = "First\nSecond"`.

**Expected:** insert the pasted text at the caret, retaining the existing cell text and unselected neighbor. **Actual:** both cells are replaced wholesale by `First` and `Second`. `save-boundary.ts` also runs the result through `keepUnedited` and real `setNotes`; `NEIGHBOR` is absent from disk afterward.

**Runs:** [1](logs/paste-table-1.log), [2](logs/paste-table-2.log), [3](logs/paste-table-3.log), all red. [Disk-boundary check](logs/save-boundary.log).

**Ranked hypotheses and probes**

1. Contextual clipboard parsing creates table cells and the table paste handler replaces existing cells. Prediction: the consumed clipboard slice contains two cells. **Confirmed:** the `selectingCells$` handler receives two `table_cell` nodes and returns true.
2. The harness accidentally selects cells. Prediction: selection is already nonempty before the handler. **Ruled out:** the preceding handler logs `emptySelection:true`; the table handler changes it to a cell selection afterward.
3. Serialization alone loses text still present in the editor. Prediction: the document retains `KEEP` before serialization. **Ruled out:** the replacement is already in the transaction. Changing only the newline to a space gives `First SecondKEEP` and preserves `NEIGHBOR`; a tab goes through Ore's earlier handler and also preserves both. [Probes](logs/diagnostic-probes.log).

**Cause:** `apps/desktop/src/editor/notion.ts:396` returns early for every plain paste without a tab, before the in-table protection at `:398–400`. The setup explicitly places this guard before GFM (`apps/desktop/src/editor/editor.ts:51–55`) but the newline-only case falls through. The consuming dependency is `node_modules/.bun/prosemirror-tables@1.8.5/node_modules/prosemirror-tables/dist/index.js:2180–2200`: even a text caret takes the `cells` branch and calls `insertCells`. This is not F311's tab-separated-text case, which passes its guard here.

### editor-03 — Turn into Toggle or Code deletes an inline equation

**S1 · Both, shared editor commands.** D38 explicitly supports inline equations.

**Red command**

```sh
ORE_NO_ENRICH=1 bun codex-out/editor/turn-math.ts
```

```text
[DEEP] {"kind":"toggle","before":"Equation $$x+1$$\n","after":"<details><summary>Equation</summary>\n\n\n\n</details>\n","mathNodesAfterCommand":0}
[DEEP] undoExact true
AssertionError: Turn into must retain the equation contents
```

**Minimized steps:** Open `Equation $$x+1$$`, put the caret in that paragraph, and run Turn into → Toggle. The script invokes the same `turnInto` command as the block menu. `turn-math.ts code` and the three toggle-heading kinds exhibit the same loss.

**Expected:** retain the equation content, either in a supported title representation or in the toggle body; code conversion must retain its textual TeX. **Actual:** `x+1` disappears entirely. Undo within the open editor restores it, but ordinary saving persists the shortened note. `save-boundary.ts` confirms that neither note preservation nor core saving recovers the equation.

**Runs:** [1](logs/turn-math-1.log), [2](logs/turn-math-2.log), [3](logs/turn-math-3.log), all red.

**Ranked hypotheses and probes**

1. Conversion flattens inline atoms using a space instead of their value. Prediction: the equation is absent immediately after the command, before serialization. **Confirmed:** the document contains only the title `Equation` and an empty body.
2. Markdown serialization loses a surviving equation node. **Ruled out:** zero math nodes remain before serialization.
3. The equation parser failed on the original input. **Ruled out:** the initial serialized Markdown retains it; changing only the destination kind to `h2` retains the math node and TeX. Replacing the math atom with plain `x+1` survives both Toggle and Code. [Controls](logs/diagnostic-probes.log).

**Cause:** `apps/desktop/src/editor/blockops.ts:250` and `:254–256` call `lead.textBetween(..., " ")`, replacing leaf nodes with a space. The equation's content is an attribute, not a text child (`apps/desktop/src/editor/math.ts:18–28`). The block menu exposes these conversions at `apps/desktop/src/editor/BlockHandle.tsx:107`. The exploratory command matrix also loses image/diagram references through these same conversions; that extension is not counted as another finding.

### editor-04 — Pasted merged table cells put values under the wrong heading after reopening

**S1 · Both.** Saved table relationships change; this is content corruption, not loss of visual styling.

**Red command**

```sh
ORE_NO_ENRICH=1 bun codex-out/editor/paste-table-shape.ts rowspan
```

Diagnostic excerpt:

```text
live: Group | Value; Alpha(rowspan=2) | Beta; Gamma
saved: "| Group | Value |\n| :---- | :---- |\n| Alpha | Beta  |\n| Gamma |       |\n"
reopened: Group | Value; Alpha | Beta; Gamma | (empty)
AssertionError: A row-spanning HTML table must retain Gamma under Value after save/reopen
'' !== 'Gamma'
```

**Minimized steps:** Paste an HTML table with headers `Group`, `Value`; `Alpha` spans two rows in Group, and Value contains `Beta` then `Gamma`. Serialize and reopen. The script dispatches a DOM paste event with both clipboard formats, rather than directly calling a paste helper.

**Expected:** in the plain GFM representation required by D38, `Gamma` stays under Value, with the spanned Group cell expanded or otherwise represented without moving values. **Actual:** the live editor retains `rowspan:2`, but the saved Markdown moves `Gamma` into Group and empties its Value cell.

**Runs:** [1](logs/paste-rowspan-1.log), [2](logs/paste-rowspan-2.log), [3](logs/paste-rowspan-3.log), all red; the complete JSON diagnostics are in those logs.

**Ranked hypotheses and probes**

1. Serialization ignores the cell span. Prediction: DOM parsing retains the span but Markdown omits the occupied column. **Confirmed.**
2. HTML clipboard parsing already puts Gamma in the wrong logical column. **Ruled out:** the parsed tree preserves Alpha's `rowspan:2` and the second row's single Gamma cell, the correct spanning structure.
3. The Markdown parser alone shifts a correct serialized row. **Ruled out:** the saved Markdown already explicitly puts Gamma in column one. Expanding only the spanning HTML cell into two Alpha cells passes. [Stage probes](logs/table-shape-probes.log).

**Cause:** Ore installs GFM directly at `apps/desktop/src/editor/editor.ts:55`, without expanding HTML spans at the paste/save boundary. The active dependency `node_modules/.bun/@milkdown+preset-gfm@7.22.3/node_modules/@milkdown/preset-gfm/src/node/table/schema.ts:172–183` serializes each physical child as the next Markdown cell; its cell serializer at `:213–218` writes content without rowspan/colspan. HTML attributes are accepted by `tableNodes` at `:34–46`, so a structure the writer cannot preserve reaches the note.

### editor-05 — Two paragraphs in one pasted table cell become two columns

**S1 · Both.** A copied table's values and heading associations change on paste.

**Red command**

```sh
ORE_NO_ENRICH=1 bun codex-out/editor/paste-table-shape.ts paragraphs
```

Diagnostic excerpt:

```text
live: (empty) | Title; Alpha | Beta
saved: "|       | Title |\n| :---- | :---- |\n| Alpha | Beta  |\n"
reopened: (empty) | Title; Alpha | Beta
AssertionError: Pasting two paragraphs in one HTML table cell must not create a second column
2 !== 1
```

**Minimized steps:** Paste `<table><tr><th>Title</th></tr><tr><td><p>Alpha</p><p>Beta</p></td></tr></table>`. This is a one-column table with two paragraphs in its only body cell, a normal rich-document structure.

**Expected:** one column, with Alpha and Beta retained in the same cell under Title; flattening the paragraph boundary is acceptable for D38's plain cells. **Actual:** the second paragraph becomes a second cell. Table repair then inserts an empty header before Title, so Alpha no longer sits under its original heading. The incorrect table is already in editor state and survives saving/reopening.

**Runs:** [1](logs/paste-paragraphs-1.log), [2](logs/paste-paragraphs-2.log), [3](logs/paste-paragraphs-3.log), all red. These counts use two paragraphs; no merged cells are involved.

**Ranked hypotheses and probes**

1. The cell schema admits only one paragraph, causing the DOM parser to create a sibling cell for the second. Prediction: direct schema DOM parsing already yields two body cells. **Confirmed.**
2. The paste table-repair rule alone splits an intact cell. **Ruled out as the splitter:** there are already two body cells before paste rules; repair explains the later empty header.
3. Markdown serialization creates the second column. **Ruled out:** the split is present before any serialization. Replacing only `<p>Alpha</p><p>Beta</p>` with `Alpha Beta` passes with one header and one body cell. [Stage probes](logs/table-shape-probes.log).

**Cause:** Ore's unnormalized HTML paste reaches the GFM schema installed by `apps/desktop/src/editor/editor.ts:55,65`. In `node_modules/.bun/@milkdown+preset-gfm@7.22.3/node_modules/@milkdown/preset-gfm/src/node/table/schema.ts:34–36`, `cellContent: 'paragraph'` accepts exactly one paragraph. Unlike editor-04, this failure happens while parsing HTML, not while writing Markdown; normalizing spans alone does not fix it.

### editor-06 — Editing a duplicated matrix collapses it onto the original

**S1 · Mac editing; both devices read the changed layout.** D103; saved geometry of the whole copy changes during a one-cell text edit.

**Red command**

```sh
ORE_NO_ENRICH=1 bun codex-out/editor/matrix-duplicate.ts
```

```text
[DEEP] {"originalMatrix":"pfJnxbBh290EN1Kfi653","copyMatrix":"pfJnxbBh290EN1Kfi653","differentGroups":true,"copyBefore":{"x":20,"y":20},"copyAfter":{"x":0,"y":0},"overlapsOriginal":true}
AssertionError: Editing a duplicated matrix must not move its cells onto the original matrix
0 !== 20
```

**Minimized steps:** Create a 2×2 compare matrix, select all four cells, Duplicate, and edit a copied cell's label. The harness runs `setLabel` then `layoutMatrix`, exactly as the actual label commit does. Save/load preserves the erroneous location.

**Expected:** changing the copy's label keeps it separate from the original. **Actual:** duplication gives the copy new element and group IDs but leaves its matrix identity equal to the original. Committing text re-lays both sets as one matrix, putting copied cells exactly on original cells. The error also occurs if the copy is moved farther away before editing; the control probes use a 500-unit offset to make that separation explicit.

**Runs:** [1](logs/matrix-duplicate-1.log), [2](logs/matrix-duplicate-2.log), [3](logs/matrix-duplicate-3.log), all red.

**Ranked hypotheses and probes**

1. Duplication copies the matrix identity unchanged. Prediction: changing only the copied cells' matrix identity prevents the collapse. **Confirmed:** assigning the copy its already-new group ID as its matrix ID retains x=500.
2. Text measurement/`setLabel` itself moves the copy. **Ruled out:** x is still 500 after `setLabel`; it becomes zero at `layoutMatrix`.
3. Compaction or reload changes valid coordinates. **Ruled out:** x is zero before serialization and remains zero in the saved scene. [Probes](logs/diagnostic-probes.log).

**Cause:** `apps/desktop/src/draw/model.ts:589–601` remaps element IDs, group IDs and bindings but shallow-copies `customData.oreCell.matrix`. `:1327` gathers both matrices by that ID and `:1333–1338` repositions them relative to the original's origin. Reachable from Duplicate at `apps/desktop/src/draw/Editor.tsx:612` and label commit at `:343–346`. This is distinct from F18's lost serialized metadata; here metadata is retained but aliases a separate drawing.

### editor-07 — The link picker writes a valid spaced skill ID that backlinks silently omit

**S3 · Both.** D39; requires a supported hand-written skill ID containing a space.

**Red command**

```sh
ORE_NO_ENRICH=1 bun codex-out/editor/link-space.ts
```

```text
[DEEP] {"supportedId":"A B","markdown":"[Space skill](<ore:skill/A B>)\n","reopenedHref":"ore:skill/A B","coreLinks":[]}
AssertionError: Core backlinks must see the supported skill link written by the picker
undefined !== 'A B'
```

**Minimized steps:** Have a skill whose ID is `A B` (the script validates it through `parseSkillsFile`), insert its link with the same mark/transaction as the `[[` picker, save to Markdown, reopen, and pass that Markdown to core's `renderedLinks`.

**Expected:** core finds the same skill target the editor wrote and reopened, so Linked from can include the note. **Actual:** editor serialization correctly uses an angle-bracket destination for the space, and reopening preserves the full href, but core returns no link.

**Runs:** [1](logs/link-space-1.log), [2](logs/link-space-2.log), [3](logs/link-space-3.log), all red.

**Ranked hypotheses and probes**

1. Core's URL filter excludes a space even though skill validation permits it. Prediction: the Markdown AST has the correct URL but it fails the filter. **Confirmed:** `link-space-probes.ts` reports `parsedUrl:"ore:skill/A B"`, `currentFilter:false`.
2. Markdown parsing does not recognize the angle-bracket destination. **Ruled out:** the actual parser produces a `link` node with that full URL.
3. The picker or writer encodes the ID incorrectly. **Ruled out:** the reopened mark matches the original href exactly. Changing only the ID to `A-B` passes; parentheses, Unicode and underscores pass too. [Probe](logs/link-space-probes.log), [control](logs/link-space-control.log).

**Cause:** `packages/core/src/links.ts:24,43` requires `\S+` for the ID. `apps/desktop/src/editor/NoteEditor.tsx:400–401` writes the supported ID unchanged, and the Markdown writer correctly encloses it in `<…>`. This is a new allowed-ID edge, not a recurrence of F609's code/reference-link cases. F641 explicitly preserves support for IDs containing spaces.

## Leads and limits

- Rich HTML carrying a local `file:` image retains that URI in the exploratory paste output; `NoteEditor.tsx:884` bypasses attachment handling when accompanying words exist. No native copied-image payload plus real image-resolution red loop was built, so this is not a finding about missing attachments or sync.
- Word's `mso-list` paragraph sample becomes escaped `1.` prose rather than a real list. Its words survived; no minimized asserted structure test or richer Word clipboard fixture was completed.
- Relative image paths containing a bare `%` reach unguarded `decodeURI` in `NoteEditor.tsx:1167` and `md-images.tsx:9`. No actual note-image-view red loop was built; left as a lead, not a crash finding.
- Diagram undo/redo was checked at the immutable model-snapshot boundary, not through React keyboard events. Async clipboard image insertion, native PNG clipboard copying, autosave/close/rename races and external diagram edits were not exercised.
- One apparent rich-paste/code-block escape was a helper artifact: `view.pasteHTML` supplies no plain-text string to ProseMirror. A real DOM paste event with both formats passes. It is explicitly excluded from findings.

## What passed

- `commands-pass.ts`: 72 block move/duplicate/delete, list/toggle indent-outdent and table-edit cases; stable serialize/reopen and Undo restoring the exact pre-command editor serialization. Includes toggles containing lists, callouts, nested lists, tables and block math.
- `commands-probe.ts`: the non-lossy Turn into cases preserve their text through serialization/reopening and restore pre-command serialization with Undo; inline-atom conversions are isolated in editor-03.
- `draw-random.ts`: 180 deterministic model edits with seed 20261125; no mutation of undo snapshots, duplicate IDs, orphan arrow/label targets or unstable save/load; snapshot undo/redo restores its recorded states. No matrices are included in this passing random set.
- `colors-links.ts`: 45 title/color combinations preserve words, link targets and core backlink visibility; brackets, backslashes, Markdown punctuation, accents and Japanese text included. Ordinary IDs, parentheses, Unicode and underscores pass; the spaced ID is editor-07.
- `paste-pass.ts`: 11 checks covering the six synthetic app HTML samples, script/event-attribute stripping, plain/rich/URL DOM pastes in code blocks and a 100,009-character plain paste. All sample words survive save/reopen. This does not claim full Word/Google Docs structural fidelity or native clipboard capture.
- `export-pass.ts`: actual `svgMarkup` escapes script-shaped text and retains Japanese/emoji, with finite SVG dimensions; font URL imports are stubbed as Vite would resolve them. No PNG or native clipboard claim.
- `save-boundary.ts`: the real preservation/core note-save boundary faithfully writes the faulty math/table results; it does not repair either data-loss symptom.
- All tracked repository files remain unchanged. Scripts, logs, saved scratch diagrams/notes and this report are confined to `codex-out/editor/`; no process is left running.
