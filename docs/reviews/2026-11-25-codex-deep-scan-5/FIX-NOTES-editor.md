# Editor fixes — Deep scan 5

All seven findings are **fixed**. None were skipped. Base: `750f65de4ccc45cc9d709759b52c9d7142315a8f` (the supplied master worktree); Bun 1.4.4.

Each supplied red script failed on its intended assertion before its finding was fixed, in report order. The scripts use `../../apps` imports from their original `codex-out/editor/` location, so unchanged copies were run there. Original report/scripts were not edited. Reproduction libraries and full logs are under ignored `codex-out/editor/` and `codex-out/editor-fix-logs/`. Essential red/green evidence is embedded below so it stays in this handoff.

Only new tests were added; no existing test body or assertion was changed. No changes to `docs/reviews/findings.md` or `docs/DECISIONS.md`. No `doc.md` ingestion/output changes, so no intake fixture/grid or golden update was needed. Note clipboard HTML is normalized only when pasted, under D38’s existing plain GFM table contract. Existing saved data remains readable as before.

No browser, app, development server, e2e, bench, build, live library, commit, push or merge was run. The fixes live in the shared editor, drawing model and core links module; no device-specific copies were changed. No library write/lock/Undo ordering was changed.

## Interaction scope

Read the required interaction-check skill. Checked affected commands headlessly: matrix deletion/growth, whole and partial duplication, layout after label edits, JSON round-trips; table caret/selection paste, HTML paste and Markdown reopen; block conversion and Undo. Existing editor, table, keyboard-bar, color and Notion-parity tests also ran. Controls and visual elements were not added or removed. Live pointer, native clipboard, screenshots and iPhone/simulator checks were intentionally not run under the task’s no-browser/app restriction. No visual/device result is claimed.

## editor-01 — Matrix growth after deleting a corner

**Status:** fixed.

**Changed files:** apps/desktop/src/draw/model.ts; apps/desktop/test/draw-matrix.test.ts.

**New tests:** `apps/desktop/test/draw-matrix.test.ts`:

- growing a matrix ${direction} after deleting corner ${missing} keeps valid saved cells (all four corners, row and column)

**Master reproduction:** `ORE_NO_ENRICH=1 bun codex-out/editor/matrix-delete.ts` → exit 1.

```text
[DEEP] {"removeIndex":3,"afterDelete":3,"afterGrow":5,"invalidElements":5,"savedNullWidths":5,"afterReload":3,"lostNewCells":2}
AssertionError: Adding a row after deleting one matrix cell must not corrupt every cell or lose the added row on reload
```

**Test-first red output (exit 1; last lines):**

```text
 6 pass
 2 fail
 144 expect() calls
Ran 8 tests across 1 file. [12.00ms]
```

**Green command:** `bun test apps/desktop/test/draw-matrix.test.ts apps/desktop/test/draw.test.ts` → exit 0.

```text
 35 pass
 0 fail
 280 expect() calls
Ran 35 tests across 2 files. [24.00ms]
```

**Supplied reproduction after the fix:** exit 0.

```text
[DEEP] {"removeIndex":3,"afterDelete":3,"afterGrow":5,"invalidElements":0,"savedNullWidths":0,"afterReload":5,"lostNewCells":0}
```

**Why durable:** growMatrix uses a surviving cell when the bottom-right template has been deleted. Both growth directions retain complete elements and survive a JSON save/reopen; existing diagram readers are unchanged.

## editor-02 — Multiline plain paste at a table caret

**Status:** fixed.

**Changed files:** apps/desktop/src/editor/notion.ts; apps/desktop/test/editor-paste.test.ts.

**New tests:** `apps/desktop/test/editor-paste.test.ts`:

- plain multiline paste at a table caret preserves unselected text (${JSON.stringify(newline)}, selected=${selected}) (LF, CRLF and CR; caret and partial text selection)

**Master reproduction:** `ORE_NO_ENRICH=1 bun codex-out/editor/paste-event.ts table` → exit 1.

```text
[DEEP] {"mode":"table","before":"| Header 1 | Header 2 |\n| -------- | -------- |\n| KEEP     | NEIGHBOR |\n","selectionEmpty":true,"after":"| Header 1 | Header 2 |\n| -------- | -------- |\n| First    | Second   |\n","eventTaken":true,"blocks":["table"]}
AssertionError: Paste at a cell caret must not delete that cell or its unselected neighbor
```

**Test-first red output (exit 1; last lines):**

```text
 0 pass
 6 fail
 12 expect() calls
Ran 6 tests across 1 file. [154.00ms]
```

**Green command:** `bun test apps/desktop/test/editor-paste.test.ts apps/desktop/test/notion-parity.test.ts` → exit 0.

```text
 63 pass
 0 fail
 172 expect() calls
Ran 63 tests across 2 files. [375.00ms]
```

**Supplied reproduction after the fix:** exit 0.

```text
[DEEP] {"mode":"table","before":"| Header 1 | Header 2 |\n| -------- | -------- |\n| KEEP     | NEIGHBOR |\n","selectionEmpty":true,"after":"| Header 1         | Header 2 |\n| ---------------- | -------- |\n| First SecondKEEP | NEIGHBOR |\n","eventTaken":true,"blocks":["table"]}
```

**Why durable:** The existing shared plain-paste guard handles newlines as well as tabs before the dependency can mistake them for replacement table cells. The non-table paste paths retain their existing behavior.

## editor-03 — Equations lost when turning blocks into Toggle or Code

**Status:** fixed.

**Changed files:** apps/desktop/src/editor/blockops.ts; apps/desktop/test/blockops.test.ts.

**New tests:** `apps/desktop/test/blockops.test.ts`:

- turn into ${kind} retains inline equations through save, reopen and undo (toggle, th1, th2, th3, code); turn into ${kind} retains image and diagram references (toggle, code); turning an empty inline equation into code makes an empty code block

**Master reproduction:** `ORE_NO_ENRICH=1 bun codex-out/editor/turn-math.ts` → exit 1.

```text
[DEEP] {"kind":"toggle","before":"Equation $$x+1$$\n","after":"<details><summary>Equation</summary>\n\n\n\n</details>\n","mathNodesAfterCommand":0}
[DEEP] undoExact true
AssertionError: Turn into must retain the equation contents
```

**Test-first red output (exit 1; last lines):**

```text
 14 pass
 7 fail
 60 expect() calls
Ran 21 tests across 1 file. [283.00ms]
```

**Green command:** `bun test apps/desktop/test/blockops.test.ts apps/desktop/test/math.test.ts` → exit 0.

```text
 22 pass
 0 fail
 85 expect() calls
Ran 22 tests across 2 files. [270.00ms]
```

**Supplied reproduction after the fix:** exit 0.

```text
[DEEP] {"kind":"toggle","before":"Equation $$x+1$$\n","after":"<details><summary>Equation x+1</summary>\n\n\n\n</details>\n","mathNodesAfterCommand":0}
[DEEP] undoExact true
```

**Why durable:** The shared conversion command reads the content of inline atoms instead of replacing it with spaces: equation TeX and image/diagram references become text in the existing text-only destinations. No schema or saved-note reader changes. Empty equation content creates an empty code block, avoiding an empty-text-node error.

Additional review caught the empty-equation edge in the new conversion. Added its regression before adjusting the code:

```text
 21 pass
 1 fail
 83 expect() calls
Ran 22 tests across 1 file. [241.00ms]
```

After handling empty text explicitly:

```text
 22 pass
 0 fail
 84 expect() calls
Ran 22 tests across 1 file. [229.00ms]
```

## editor-04 — Merged pasted table cells shift values into the wrong columns

**Status:** fixed.

**Changed files:** apps/desktop/src/editor/tables.ts; apps/desktop/test/editor-paste.test.ts.

**New tests:** `apps/desktop/test/editor-paste.test.ts`:

- pasted row spans (${span}) keep values under their headings after reopening (2 and 0); pasted combined row and column spans expand to rectangular cells

**Master reproduction:** `ORE_NO_ENRICH=1 bun codex-out/editor/paste-table-shape.ts rowspan` → exit 1.

```text
[DEEP] {"variant":"rowspan","live":[[{"text":"Group","rowspan":1,"colspan":1},{"text":"Value","rowspan":1,"colspan":1}],[{"text":"Alpha","rowspan":2,"colspan":1},{"text":"Beta","rowspan":1,"colspan":1}],[{"text":"Gamma","rowspan":1,"colspan":1}]],"saved":"| Group | Value |\n| :---- | :---- |\n| Alpha | Beta  |\n| Gamma |       |\n","reopened":[[{"text":"Group","rowspan":1,"colspan":1},{"text":"Value","rowspan":1,"colspan":1}],[{"text":"Alpha","rowspan":1,"colspan":1},{"text":"Beta","rowspan":1,"colspan":1}],[{"text":"Gamma","rowspan":1,"colspan":1},{"text":"","rowspan":1,"colspan":1}]]}
AssertionError: A row-spanning HTML table must retain Gamma under Value after save/reopen
```

**Test-first red output (exit 1; last lines):**

```text
 6 pass
 3 fail
 21 expect() calls
Ran 9 tests across 1 file. [190.00ms]
```

**Green command:** `bun test apps/desktop/test/editor-paste.test.ts apps/desktop/test/tables.test.ts` → exit 0.

```text
 15 pass
 0 fail
 55 expect() calls
Ran 15 tests across 2 files. [211.00ms]
```

**Supplied reproduction after the fix:** exit 0.

```text
[DEEP] {"variant":"rowspan","live":[[{"text":"Group","rowspan":1,"colspan":1},{"text":"Value","rowspan":1,"colspan":1}],[{"text":"Alpha","rowspan":1,"colspan":1},{"text":"Beta","rowspan":1,"colspan":1}],[{"text":"Alpha","rowspan":1,"colspan":1},{"text":"Gamma","rowspan":1,"colspan":1}]],"saved":"| Group | Value |\n| :---- | :---- |\n| Alpha | Beta  |\n| Alpha | Gamma |\n","reopened":[[{"text":"Group","rowspan":1,"colspan":1},{"text":"Value","rowspan":1,"colspan":1}],[{"text":"Alpha","rowspan":1,"colspan":1},{"text":"Beta","rowspan":1,"colspan":1}],[{"text":"Alpha","rowspan":1,"colspan":1},{"text":"Gamma","rowspan":1,"colspan":1}]]}
```

**Why durable:** The shared table plugin expands clipboard spans into ordinary cells before schema parsing. The spanning value repeats in each covered cell, retaining heading relationships in GFM; rowspan=0 ends at its row group. This acts only on incoming clipboard HTML, not existing notes.

## editor-05 — Multiple pasted paragraphs split one table cell into columns

**Status:** fixed.

**Changed files:** apps/desktop/src/editor/tables.ts; apps/desktop/test/editor-paste.test.ts.

**New tests:** `apps/desktop/test/editor-paste.test.ts`:

- pasted block content stays in one table cell (${content.slice(0, 12)}) (paragraphs, nested divs, list items); pasted paragraphs and row spans are normalized together without moving neighbors

**Master reproduction:** `ORE_NO_ENRICH=1 bun codex-out/editor/paste-table-shape.ts paragraphs` → exit 1.

```text
[DEEP] {"variant":"paragraphs","live":[[{"text":"","rowspan":1,"colspan":1},{"text":"Title","rowspan":1,"colspan":1}],[{"text":"Alpha","rowspan":1,"colspan":1},{"text":"Beta","rowspan":1,"colspan":1}]],"saved":"|       | Title |\n| :---- | :---- |\n| Alpha | Beta  |\n","reopened":[[{"text":"","rowspan":1,"colspan":1},{"text":"Title","rowspan":1,"colspan":1}],[{"text":"Alpha","rowspan":1,"colspan":1},{"text":"Beta","rowspan":1,"colspan":1}]]}
AssertionError: Pasting two paragraphs in one HTML table cell must not create a second column
```

**Test-first red output (exit 1; last lines):**

```text
 9 pass
 4 fail
 28 expect() calls
Ran 13 tests across 1 file. [187.00ms]
```

**Green command:** `bun test apps/desktop/test/editor-paste.test.ts apps/desktop/test/tables.test.ts apps/desktop/test/notion-parity.test.ts` → exit 0.

```text
 76 pass
 0 fail
 223 expect() calls
Ran 76 tests across 3 files. [399.00ms]
```

**Supplied reproduction after the fix:** exit 0.

```text
[DEEP] {"variant":"paragraphs","live":[[{"text":"Title","rowspan":1,"colspan":1}],[{"text":"Alpha Beta","rowspan":1,"colspan":1}]],"saved":"| Title      |\n| :--------- |\n| Alpha Beta |\n","reopened":[[{"text":"Title","rowspan":1,"colspan":1}],[{"text":"Alpha Beta","rowspan":1,"colspan":1}]]}
```

**Why durable:** The same clipboard boundary flattens block boundaries to spaces inside one paragraph before the one-paragraph cell schema can split them. Inline formatting and links survive; tests combine paragraphs and row spans. This is note editing, not source ingestion.

## editor-06 — Editing a duplicated matrix collapses it onto the original

**Status:** fixed.

**Changed files:** apps/desktop/src/draw/model.ts; apps/desktop/test/draw-matrix.test.ts.

**New tests:** `apps/desktop/test/draw-matrix.test.ts`:

- a ${partial ? "partial" : "whole"} matrix copy has its own layout identity; cloning two ungrouped matrices keeps their identities separate and preserves custom data

**Master reproduction:** `ORE_NO_ENRICH=1 bun codex-out/editor/matrix-duplicate.ts` → exit 1.

```text
[DEEP] {"originalMatrix":"pfJnxbBh290EN1Kfi653","copyMatrix":"pfJnxbBh290EN1Kfi653","differentGroups":true,"copyBefore":{"x":20,"y":20},"copyAfter":{"x":0,"y":0},"overlapsOriginal":true}
AssertionError: Editing a duplicated matrix must not move its cells onto the original matrix
```

**Test-first red output (exit 1; last lines):**

```text
 8 pass
 3 fail
 188 expect() calls
Ran 11 tests across 1 file. [14.00ms]
```

**Green command:** `bun test apps/desktop/test/draw-matrix.test.ts apps/desktop/test/draw.test.ts` → exit 0.

```text
 38 pass
 0 fail
 319 expect() calls
Ran 38 tests across 2 files. [26.00ms]
```

**Supplied reproduction after the fix:** exit 0.

```text
[DEEP] {"originalMatrix":"pfJnxbBh290EN1Kfi653","copyMatrix":"rIA8PLwRr42IOUKrjogv","differentGroups":true,"copyBefore":{"x":20,"y":20},"copyAfter":{"x":20,"y":20},"overlapsOriginal":false}
```

**Why durable:** clone remaps matrix IDs alongside group IDs, once per source identity. Both Duplicate and copy/paste use it. Whole or partial copies no longer share layout identity with originals, including ungrouped matrices; unrelated custom data and the original cells remain intact.

## editor-07 — Backlinks omit supported skill IDs containing spaces

**Status:** fixed.

**Changed files:** packages/core/src/links.ts; packages/core/test/links-spaces.test.ts.

**New tests:** `packages/core/test/links-spaces.test.ts`:

- rendered links retain the supported spaced skill ID ${JSON.stringify(id)} (ASCII, Unicode, leading/trailing/repeated spaces); backlinks and broken links resolve hand-written spaced skill IDs without rewriting them

**Master reproduction:** `ORE_NO_ENRICH=1 bun codex-out/editor/link-space.ts` → exit 1.

```text
[DEEP] {"supportedId":"A B","markdown":"[Space skill](<ore:skill/A B>)\n","reopenedHref":"ore:skill/A B","coreLinks":[]}
AssertionError: Core backlinks must see the supported skill link written by the picker
```

**Test-first red output (exit 1; last lines):**

```text
 0 pass
 4 fail
 7 expect() calls
Ran 4 tests across 1 file. [92.00ms]
```

**Green command:** `bun test packages/core/test/links-spaces.test.ts packages/core/test/links.test.ts` → exit 0.

```text
 15 pass
 0 fail
 39 expect() calls
Ran 15 tests across 2 files. [261.00ms]
```

**Supplied reproduction after the fix:** exit 0.

```text
[DEEP] {"supportedId":"A B","markdown":"[Space skill](<ore:skill/A B>)\n","reopenedHref":"ore:skill/A B","coreLinks":[{"text":"Space skill","target":{"kind":"skill","id":"A B"},"line":0}]}
```

**Why durable:** renderedLinks accepts spaces in a destination that the Markdown parser has already recognized, preserving the exact ID. Both backlinks and broken-link checks use that function; no existing IDs are rejected, trimmed, rewritten or migrated.

## Existing coverage and final checks

All existing files importing the changed editor/drawing modules (directly or through `createEditor`) ran together:

```sh
bun test apps/desktop/test/editor.test.ts apps/desktop/test/blockops.test.ts apps/desktop/test/tables.test.ts apps/desktop/test/notion-parity.test.ts apps/desktop/test/colors.test.ts apps/desktop/test/kbbar.test.ts apps/desktop/test/dates.test.ts apps/desktop/test/draw.test.ts apps/desktop/test/draw-matrix.test.ts apps/desktop/test/editor-paste.test.ts
```

```text
 168 pass
 0 fail
 742 expect() calls
Ran 168 tests across 10 files. [521.00ms]
```

Core links coverage: `bun test packages/core/test/links-spaces.test.ts packages/core/test/links.test.ts` → 15 pass, 0 fail. The final combined run below also covers indirect core consumers.

`bun run typecheck` ran once at the end: **exit 0**.

```text
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
```

`bun test packages/core/test apps/desktop/test` ran once at the end: **exit 1**. No retries or skips were introduced.

Four failures outside the edited modules remain for review; this run alone does not establish that they also fail on untouched master:

| Test | File | Observed failure |
| --- | --- | --- |
| a very tall or very wide screenshot is read whole, each line once (F188) | `packages/core/test/intake.test.ts:1327` | The real macOS Vision OCR path returned too little text; `ingest/ocr.ts:68` threw “Found no text in that image. Add a screenshot with text, or paste what you need.” Cause not established. |
| a quote is checked against its own page's results, and a link inside a fetched page isn't a page it returned | `packages/core/test/tutor.test.ts:397` | Bun reported `error: undefined` / `undefined`, with no assertion details or stack. Cause not established. |
| an inbox import where every link fails exits non-zero and keeps them | `packages/core/test/cli-contract.test.ts:52` | Test fixture `Bun.serve({ port: 0, ... })` failed at line 54: `EADDRINUSE`, “Failed to start server. Is port 0 in use?” |
| SIGTERM after the source is written takes it back out | `packages/core/test/cancel.test.ts:11` | Test fixture `Bun.serve` failed at line 16 with the same port-0 `EADDRINUSE`. |

No changes were made to those tests or modules. The full command finished; all tool-launched test/check sessions exited. No background task was deliberately started. A read-only process inventory was blocked by the sandbox (`ps: operation not permitted`), so there is no claim of an independently verified system-wide process inventory.

`git diff --check`: clean. Changes remain uncommitted in this worktree.

**Final summary:** typecheck passed (exit 0); combined tests failed (exit 1):

```text
 1873 pass
 4 fail
 10059813 expect() calls
Ran 1877 tests across 250 files. [103.86s]
```
