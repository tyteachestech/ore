# Office fixes — deep scan 5

Draft only; no commit, push or merge. Base checkout: `64cb72e4e2efe7e81cd575a679234583e6dff6e9`.

All 15 report findings reproduced. Fourteen have draft fixes; office-05 is skipped for Tyler’s decision. No existing test assertions were edited. `findings.md` and `DECISIONS.md` were not touched. All production changes are in shared core import modules; no UI/device-specific copies changed. No browser, app, server, e2e or benchmark was launched by this task.

## Evidence and common files

The archived red scripts still import `../../packages/core`, so they were copied unchanged into their original `codex-out/office/` location. Inputs and helper executables were copied alongside them. Each report command ran in report order before its finding was fixed; master’s faulty behavior remained present for each probe. All use scratch libraries, blocked network fetch and fake AI executables. The archived scripts are unchanged.

Full logs are in `codex-out/office/logs/` (ignored scratch evidence); relevant last lines are retained below so this note is reviewable without those logs. Each new failure was observed before its production fix. The new intake tests are appended to `packages/core/test/intake.test.ts`. Fixtures live in `packages/core/test/fixtures/intake/office/`, with provenance in its `README.md`. Coverage cells changed in `packages/core/test/intake-grid.test.ts`. Successful examples have new cases in `packages/core/test/golden.test.ts` and new `packages/core/test/golden/office-*.md` snapshots.

Run a particular new guard with `bun test packages/core/test/intake.test.ts -t '<full test name>'`.

## office-01 — fixed (draft)

Original probe: `bun codex-out/office/word.ts merged`

```text
[DEEP] saved: {"title":"Retrieval practice notes","author":"Ada Learner","body":"| Treatment | Outcome |\n| --- | --- |\n| Training | Improved |\n| Retained |  |\n","assets":[],"original":"source.docx","originalExact":true}
[DEEP] FAIL: ASSERT: second outcome must stay under Outcome, not Treatment
```

Changed production files: `packages/core/src/ingest/markdown.ts`.

New fixtures: `word-merged.docx`. Common test/grid files above apply; success fixtures also add golden cases/snapshots (refusals 03, 13, 14 and 15 save no golden source).

New tests in `packages/core/test/intake.test.ts`:

- `office-01: Word merged cells keep outcomes in their columns`

Test-first red output (last lines; exit 1):

```text
(fail) office-01: Word merged cells keep outcomes in their columns [89.15ms]

 0 pass
 154 filtered out
 1 fail
 6 expect() calls
Ran 1 test across 1 file. [189.00ms]
```

Green output (`02-green.log`, new guard plus relevant existing guards; exit 0):

```text
 6 pass
 150 filtered out
 0 fail
 44 expect() calls
Ran 6 tests across 1 file. [215.00ms]
```

Durable fix: Reserve columns occupied by row spans and column spans in the shared HTML table conversion, before placing subsequent cells.

## office-02 — fixed (draft)

Original probe: `bun codex-out/office/rtf.ts`

```text
[DEEP] saved: {"title":"rtf-cp1251","body":"Ïðèâåò\n","assets":[],"original":"source.rtf","originalExact":true}
[DEEP] FAIL: ASSERT: literal RTF bytes must use declared windows-1251 code page
```

Changed production files: `packages/core/src/ingest/rtf.ts`.

New fixtures: `rtf-cp1251.rtf`. Common test/grid files above apply; success fixtures also add golden cases/snapshots (refusals 03, 13, 14 and 15 save no golden source).

New tests in `packages/core/test/intake.test.ts`:

- `office-02: RTF literal bytes use the declared code page`

Test-first red output (last lines; exit 1):

```text
(fail) office-02: RTF literal bytes use the declared code page [23.10ms]

 0 pass
 155 filtered out
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [98.00ms]
```

Green output (`02-green.log`, new guard plus relevant existing guards; exit 0):

```text
 6 pass
 150 filtered out
 0 fail
 44 expect() calls
Ran 6 tests across 1 file. [215.00ms]
```

Durable fix: Keep raw bytes intact until both literal runs and hex escapes reach the same active document/font code-page decoder.

## office-03 — fixed (draft)

Original probe: `bun codex-out/office/word.ts equation`

```text
[DEEP] saved: {"title":"Retrieval practice notes","author":"Ada Learner","body":"Energy equation follows.\n","assets":[],"original":"source.docx","originalExact":true}
[DEEP] FAIL: ASSERT: Word equation must not vanish
```

Changed production files: `packages/core/src/ingest/office.ts`.

New fixtures: `word-equation.docx`. Common test/grid files above apply; success fixtures also add golden cases/snapshots (refusals 03, 13, 14 and 15 save no golden source).

New tests in `packages/core/test/intake.test.ts`:

- `office-03: Word equations refuse partial import with an export step`

Test-first red output (last lines; exit 1):

```text
(fail) office-03: Word equations refuse partial import with an export step [81.41ms]

 0 pass
 156 filtered out
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [160.00ms]
```

Green output (`03-green.log`, new guard plus relevant existing guards; exit 0):

```text
 10 pass
 147 filtered out
 0 fail
 77 expect() calls
Ran 10 tests across 1 file. [379.00ms]
```

Durable fix: Act on Mammoth’s ignored OMML warning before saving; refuse this new import with a PDF-export step rather than silently dropping equations. Existing saved sources are not changed.

## office-04 — fixed (draft)

Original probe: `bun codex-out/office/slides.ts table`

```text
[DEEP] saved: {"title":"How memory works","body":"<!-- slide 1 -->\n\n## Slide 1\n","assets":[],"original":"source.pptx","originalExact":true}
[DEEP] FAIL: ASSERT: slide table content must survive import
```

Changed production files: `packages/core/src/ingest/office.ts`, `packages/core/src/ingest/markdown.ts`.

New fixtures: `slides-table.pptx`. Common test/grid files above apply; success fixtures also add golden cases/snapshots (refusals 03, 13, 14 and 15 save no golden source).

New tests in `packages/core/test/intake.test.ts`:

- `office-04: PowerPoint native tables keep their rows and columns`

Test-first red output (last lines; exit 1):

```text
(fail) office-04: PowerPoint native tables keep their rows and columns [24.71ms]

 0 pass
 157 filtered out
 1 fail
 4 expect() calls
Ran 1 test across 1 file. [97.00ms]
```

Green output (`04-green.log`, new guard plus relevant existing guards; exit 0):

```text
 4 pass
 154 filtered out
 0 fail
 21 expect() calls
Ran 4 tests across 1 file. [197.00ms]
```

Durable fix: Read native table frames alongside text shapes, retaining their row/column spans through the shared table converter.

## office-05 — skipped

Original probe: `bun codex-out/office/slide-repeated.ts`

```text
[DEEP] saved: {"title":"The forgetting curve","body":"<!-- slide 1 -->\n\n## The forgetting curve\n\n<!-- slide 2 -->\n\n## Spacing flattens it\n\n<!-- slide 3 -->\n\n## Takeaways\n\n- Review just before you forget\n","assets":[],"original":"source.pptx","originalExact":true}
[DEEP] FAIL: ASSERT: a teaching figure reused on three slides must stay on those slides
```

Confirmed real, not a taste report: a large teaching figure is removed when reused on three slides. Skipped because the existing test `PowerPoint: each slide's pictures after its text, a logo on every slide left out` requires repeated-logo removal. Removing the heuristic outright changes that asserted behavior; replacing it with size/position/alt-text thresholds invents a classification rule. Tyler should decide whether all repeated pictures stay, or what evidence permits removing a logo. No production/test/fixture changes for this finding; no new red/green test claimed.

## office-06 — fixed (draft)

Original probe: `bun codex-out/office/sheets.ts formula`

```text
[DEEP] saved: {"title":"Spanish vocabulary","author":"Ada Learner","body":"## Lesson\n\n| Result |\n| --- |\n","assets":[],"original":"source.xlsx","originalExact":true}
[DEEP] FAIL: ASSERT: uncached formula must be represented or refused, not silently erased
```

Changed production files: `packages/core/src/ingest/sheets.ts`.

New fixtures: `sheets-formula.xlsx`. Common test/grid files above apply; success fixtures also add golden cases/snapshots (refusals 03, 13, 14 and 15 save no golden source).

New tests in `packages/core/test/intake.test.ts`:

- `office-06: Excel uncached formulas remain visible`

Test-first red output (last lines; exit 1):

```text
(fail) office-06: Excel uncached formulas remain visible [24.71ms]

 0 pass
 158 filtered out
 1 fail
 6 expect() calls
Ran 1 test across 1 file. [102.00ms]
```

Green output (`06-green.log`, new guard plus relevant existing guards; exit 0):

```text
 4 pass
 155 filtered out
 0 fail
 22 expect() calls
Ran 4 tests across 1 file. [172.00ms]
```

Durable fix: Represent an uncached formula as its expression instead of an empty value. If a shared formula has neither an expression nor a cache, ask for recalculation and a saved copy; do not invent its result.

## office-07 — fixed (draft)

Original probe: `bun codex-out/office/sheets.ts time`

```text
[DEEP] saved: {"title":"Spanish vocabulary","author":"Ada Learner","body":"## Lesson\n\n| Clock | Duration |\n| --- | --- |\n| 36:00 | 36:00 |\n","assets":[],"original":"source.xlsx","originalExact":true}
[DEEP] FAIL: ASSERT: Excel h:mm must wrap at 24h; only [h]:mm is elapsed duration
```

Changed production files: `packages/core/src/ingest/sheets.ts`.

New fixtures: `sheets-time.xlsx`. Common test/grid files above apply; success fixtures also add golden cases/snapshots (refusals 03, 13, 14 and 15 save no golden source).

New tests in `packages/core/test/intake.test.ts`:

- `office-07: Excel clock time wraps at midnight while duration keeps days`

Test-first red output (last lines; exit 1):

```text
(fail) office-07: Excel clock time wraps at midnight while duration keeps days [25.36ms]

 0 pass
 159 filtered out
 1 fail
 3 expect() calls
Ran 1 test across 1 file. [103.00ms]
```

Green output (`07-green.log`, new guard plus relevant existing guards; exit 0):

```text
 5 pass
 155 filtered out
 0 fail
 25 expect() calls
Ran 5 tests across 1 file. [204.00ms]
```

Durable fix: Keep elapsed-duration formats distinct from clock formats (both built-in and custom); only clock values wrap at midnight.

## office-08 — fixed (draft)

Original probe: `bun codex-out/office/notebooks.ts attachment`

```text
[DEEP] saved: {"title":"notebook-attachment","body":"![Diagram](attachment:heart.svg)\n","assets":[],"original":"source.ipynb","originalExact":true}
[DEEP] FAIL: ASSERT: notebook attachment must be saved as a usable image
```

Changed production files: `packages/core/src/ingest/notebook.ts`, `packages/core/src/ingest/markdown.ts`.

New fixtures: `notebook-attachment.ipynb`, `notebook-cell-attachments.ipynb`. Common test/grid files above apply; success fixtures also add golden cases/snapshots (refusals 03, 13, 14 and 15 save no golden source).

New tests in `packages/core/test/intake.test.ts`:

- `office-08: notebook Markdown attachments are saved as usable images`
- `office-08: notebook attachment references are cell-local and code examples stay literal`

Test-first red output (last lines; exit 1):

```text
(fail) office-08: notebook Markdown attachments are saved as usable images [24.62ms]

 0 pass
 160 filtered out
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [107.00ms]
```

Green output (`08-green.log`, new guard plus relevant existing guards; exit 0):

```text
 4 pass
 157 filtered out
 0 fail
 19 expect() calls
Ran 4 tests across 1 file. [215.00ms]
```

Durable fix: Resolve rendered image references against each cell’s own attachment bundle, save image bytes, and leave code examples untouched.

## office-09 — fixed (draft)

Original probe: `bun codex-out/office/notebooks.ts error; bun codex-out/office/notebooks.ts html`

```text
[DEEP] saved: {"title":"notebook-error","body":"```python\n1 / 0\n```\n","assets":[],"original":"source.ipynb","originalExact":true}
[DEEP] FAIL: ASSERT: the error output that teaches the failed operation must survive
[DEEP] saved: {"title":"notebook-html","body":"```python\nshow_results()\n```\n","assets":[],"original":"source.ipynb","originalExact":true}
[DEEP] FAIL: ASSERT: HTML-only output must survive
```

Changed production files: `packages/core/src/ingest/notebook.ts`.

New fixtures: `notebook-error.ipynb`, `notebook-html.ipynb`. Common test/grid files above apply; success fixtures also add golden cases/snapshots (refusals 03, 13, 14 and 15 save no golden source).

New tests in `packages/core/test/intake.test.ts`:

- `office-09: notebook errors and HTML-only results survive import`

Test-first red output (last lines; exit 1):

```text
(fail) office-09: notebook errors and HTML-only results survive import [30.74ms]

 0 pass
 161 filtered out
 1 fail
 3 expect() calls
Ran 1 test across 1 file. [144.00ms]
```

Green output (`09-green.log`, new guard plus relevant existing guards; exit 0):

```text
 5 pass
 157 filtered out
 0 fail
 25 expect() calls
Ran 5 tests across 1 file. [178.00ms]
```

Durable fix: Decode standard error fields and HTML-only output instead of restricting output to plain text and plots. Error tracebacks lose terminal colour escapes; existing text-output limits remain.

## office-10 — fixed (draft)

Original probe: `bun codex-out/office/notebooks.ts ordered`

```text
[DEEP] saved: {"title":"notebook-order","body":"```python\nplot_then_explain()\n```\n\n```text\nAFTER FIGURE\n```\n\n![](assets/d88a094afb712355.png)\n","assets":["d88a094afb712355.png"],"original":"source.ipynb","originalExact":true}
[DEEP] FAIL: ASSERT: outputs must stay in execution order
```

Changed production files: `packages/core/src/ingest/notebook.ts`.

New fixtures: `notebook-order.ipynb`. Common test/grid files above apply; success fixtures also add golden cases/snapshots (refusals 03, 13, 14 and 15 save no golden source).

New tests in `packages/core/test/intake.test.ts`:

- `office-10: notebook output figures and explanations keep execution order`

Test-first red output (last lines; exit 1):

```text
(fail) office-10: notebook output figures and explanations keep execution order [24.88ms]

 0 pass
 162 filtered out
 1 fail
 4 expect() calls
Ran 1 test across 1 file. [109.00ms]
```

Green output (`10-green.log`, new guard plus relevant existing guards; exit 0):

```text
 6 pass
 157 filtered out
 0 fail
 29 expect() calls
Ran 6 tests across 1 file. [178.00ms]
```

Durable fix: Traverse outputs once in their stored order, flushing adjacent text before each plot, error or HTML result.

## office-11 — fixed (draft)

Original probe: `bun codex-out/office/text.ts relative`

```text
[DEEP] saved: {"title":"text-relative","body":"![Diagram](diagram.svg)\n","assets":[],"original":"source.md","originalExact":true}
[DEEP] FAIL: ASSERT: relative Markdown picture must be copied and linked to the saved asset
```

Changed production files: `packages/core/src/ingest/index.ts`, `packages/core/src/ingest/markdown.ts`.

New fixtures: `text-relative.md`, `text-reference.md`, `diagram.svg`. Common test/grid files above apply; success fixtures also add golden cases/snapshots (refusals 03, 13, 14 and 15 save no golden source).

New tests in `packages/core/test/intake.test.ts`:

- `office-11: a Markdown file saves its adjacent image inside the library`
- `office-11: Markdown reference images keep titles and leave code examples alone`

Test-first red output (last lines; exit 1):

```text
(fail) office-11: a Markdown file saves its adjacent image inside the library [29.07ms]

 0 pass
 163 filtered out
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [154.00ms]
```

Green output (`11-green.log`, new guard plus relevant existing guards; exit 0):

```text
 11 pass
 153 filtered out
 0 fail
 86 expect() calls
Ran 11 tests across 1 file. [513.00ms]
```

Durable fix: Resolve rendered Markdown image URLs against the input file before the existing asset-saving stage; preserve the original source bytes, reference titles and literal code examples.

## office-12 — fixed (draft)

Original probe: `bun codex-out/office/word.ts outline`

```text
[DEEP] saved: {"title":"Retrieval practice notes","author":"Ada Learner","body":"Chapter one\n","assets":[],"original":"source.docx","originalExact":true}
[DEEP] FAIL: ASSERT: outline level zero must remain a heading
```

Changed production files: `packages/core/src/ingest/office.ts`.

New fixtures: `word-outline.docx`, `word-outline-after-plain.docx`. Common test/grid files above apply; success fixtures also add golden cases/snapshots (refusals 03, 13, 14 and 15 save no golden source).

New tests in `packages/core/test/intake.test.ts`:

- `office-12: Word outline levels become reader headings`
- `office-12: an empty paragraph-properties element does not borrow the next heading`

Test-first red output (last lines; exit 1):

```text
(fail) office-12: Word outline levels become reader headings [121.11ms]

 0 pass
 164 filtered out
 1 fail
 4 expect() calls
Ran 1 test across 1 file. [244.00ms]
```

Green output (`12-green.log`, new guard plus relevant existing guards; exit 0):

```text
 11 pass
 154 filtered out
 0 fail
 81 expect() calls
Ran 11 tests across 1 file. [454.00ms]
```

The added self-closing-properties variant also failed before its correction (`extra-red.log`: 2 pass, 1 fail; expected `# Chapter one`, received plain `Chapter one`). It passes in the final standalone intake run.

Durable fix: Map explicit outline levels to Mammoth heading styles in an in-memory conversion copy only; do not let a self-closing properties element consume the next paragraph. The original stays unchanged.

## office-13 — fixed (draft)

Original probe: `bun codex-out/office/slides.ts missing`

```text
[DEEP] saved: {"title":"How memory works","body":"<!-- slide 1 -->\n\n## Slide 1\n","assets":[],"original":"source.pptx","originalExact":true}
[DEEP] FAIL: ASSERT: deck with referenced missing slide must be refused, not saved with an empty slide
```

Changed production files: `packages/core/src/ingest/office.ts`.

New fixtures: `slides-missing.pptx`. Common test/grid files above apply; success fixtures also add golden cases/snapshots (refusals 03, 13, 14 and 15 save no golden source).

New tests in `packages/core/test/intake.test.ts`:

- `office-13: PowerPoint refuses a missing listed slide without saving a source`

Test-first red output (last lines; exit 1):

```text
(fail) office-13: PowerPoint refuses a missing listed slide without saving a source [36.86ms]

 0 pass
 165 filtered out
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [162.00ms]
```

Green output (`13-green.log`, new guard plus relevant existing guards; exit 0):

```text
 5 pass
 161 filtered out
 0 fail
 24 expect() calls
Ran 5 tests across 1 file. [235.00ms]
```

Durable fix: Validate every listed slide’s relationship and required ZIP part before generating any placeholder heading.

## office-14 — fixed (draft)

Original probe: `bun codex-out/office/sheets.ts missing`

```text
[DEEP] saved: {"title":"Spanish vocabulary","author":"Ada Learner","body":"## Lesson\n\n| Visible first sheet |\n| --- |\n","assets":[],"original":"source.xlsx","originalExact":true}
[DEEP] FAIL: ASSERT: workbook with a referenced missing sheet must be refused
```

Changed production files: `packages/core/src/ingest/sheets.ts`.

New fixtures: `sheets-missing.xlsx`. Common test/grid files above apply; success fixtures also add golden cases/snapshots (refusals 03, 13, 14 and 15 save no golden source).

New tests in `packages/core/test/intake.test.ts`:

- `office-14: Excel refuses a missing listed worksheet without saving a partial workbook`

Test-first red output (last lines; exit 1):

```text
(fail) office-14: Excel refuses a missing listed worksheet without saving a partial workbook [24.01ms]

 0 pass
 166 filtered out
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [102.00ms]
```

Green output (`14-green.log`, new guard plus relevant existing guards; exit 0):

```text
 6 pass
 161 filtered out
 0 fail
 28 expect() calls
Ran 6 tests across 1 file. [193.00ms]
```

Durable fix: Validate the relationship and required ZIP part for each visible worksheet before treating it as an empty sheet; retain existing hidden-sheet handling.

## office-15 — fixed (draft)

Original probe: `bun codex-out/office/ocr-failure.ts`

```text
[DEEP] refusal: {"message":"can't open the image","items":0}
[DEEP] FAIL: ASSERT: OCR failure must give a next step, not just native helper stderr
```

Changed production files: `packages/core/src/ingest/ocr.ts`.

New fixtures: `ocr-failure.png`, `ocr-failure.sh`. Common test/grid files above apply; success fixtures also add golden cases/snapshots (refusals 03, 13, 14 and 15 save no golden source).

New tests in `packages/core/test/intake.test.ts`:

- `office-15: OCR helper failure gives a recovery step and saves no source`

Test-first red output (last lines; exit 1):

```text
(fail) office-15: OCR helper failure gives a recovery step and saves no source [72.45ms]

 0 pass
 167 filtered out
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [192.00ms]
```

Green output (`15-green.log`, new guard plus relevant existing guards; exit 0):

```text
 4 pass
 164 filtered out
 0 fail
 14 expect() calls
Ran 4 tests across 1 file. [1156.00ms]
```

Durable fix: Wrap the shared OCR helper boundary with the same recovery instruction for real and injected helpers, retaining the original error as the cause.

## Golden files

Ran `bun run golden:update` (41 pass, 0 fail), inspected the new snapshots, then ran `bun test packages/core/test/golden.test.ts` (41 pass, 0 fail). No pre-existing golden changed. The following 14 new golden files record the intentionally corrected output:

- `office-notebook-attachment.md`
- `office-notebook-cell-attachments.md`
- `office-notebook-error.md`
- `office-notebook-html.md`
- `office-notebook-order.md`
- `office-rtf-cp1251.md`
- `office-sheets-formula.md`
- `office-sheets-time.md`
- `office-slides-table.md`
- `office-text-reference.md`
- `office-text-relative.md`
- `office-word-merged.md`
- `office-word-outline-after-plain.md`
- `office-word-outline.md`

These cover aligned Word tables; intact Cyrillic; slide tables; visible formulas and correct clock values; notebook attachments, errors, HTML and execution order; local Markdown images; and Word outline headings. The extra fixtures protect reference-image syntax/cell scope and ordinary paragraphs preceding outline headings.

## Existing checks and limitations

- `bun test packages/core/test/ingest.test.ts`: 16 pass, 0 fail.
- `bun test packages/core/test/reimport.test.ts`: 17 pass, 0 fail.
- `bun test packages/core/test/tables.test.ts`: 15 pass, 0 fail.
- `bun test packages/core/test/intake-grid.test.ts`: 2 pass, 0 fail.
- New regression subset: 17 pass, 0 fail.
- Final standalone `bun test packages/core/test/intake.test.ts`: 170 pass, 1 fail, 1,036 expectations. All 17 added guards pass.
- The failed existing test is `a very tall or very wide screenshot is read whole, each line once (F188)`. It reaches native Vision and returns `Found no text in that image. Add a screenshot with text, or paste what you need.` It already failed in the first full intake run, before any OCR code was changed (154 pass, 1 fail). This remains unresolved; no test was weakened, skipped or retried to hide it. These calls came from the existing test file requested for regression coverage, not a separately launched app.
- `git diff --check`: clean.
- Office equations are explicitly refused on new import/reimport rather than converted to math. Reimport failure leaves the existing source intact. Converting OMML itself is still unsupported.
- Word outline mapping covers explicit paragraph outline properties; inherited custom-style outline semantics remain outside this report’s reproduced case.
- Frequency-only picture removal remains unchanged pending the office-05 decision.

## Final required checks

Ran each required final command exactly once, with no source changes afterward.

`bun run typecheck` — exit 0:

```text
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
```

`bun test packages/core/test apps/desktop/test` — exit 1:

```text
3 tests failed:
(fail) import coverage: text recognition > a very tall or very wide screenshot is read whole, each line once (F188) [90.16ms]
(fail) the CLI as an agent drives it > an inbox import where every link fails exits non-zero and keeps them [11.25ms]
(fail) cancelling an add > SIGTERM after the source is written takes it back out [9.03ms]

 1861 pass
 3 fail
 10059526 expect() calls
Ran 1864 tests across 242 files. [104.94s]
```

The two additional failures occur at `Bun.serve({ port: 0, ... })`, before their import/cancellation assertions execute:

```text
error: Failed to start server. Is port 0 in use?
 syscall: "listen",
   errno: 0,
    code: "EADDRINUSE"
```

Locations: `packages/core/test/cli-contract.test.ts:54` and `packages/core/test/cancel.test.ts:16`. No test server started successfully. These environment-bound checks remain unverified; the suite is **not green**. No rerun, retry, skip or test weakening was used. All 17 new office regression tests passed in this combined run.

All command sessions started by this task have exited. A final process inventory was attempted but `ps` is denied by the sandbox; no claim is made about unrelated processes. Changes remain uncommitted for Claude’s review. Typecheck passed; final tests: **1,861 pass, 3 fail**.
