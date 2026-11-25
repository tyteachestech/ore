# Draft fixes — aivendor

All eight findings are **fixed**; none skipped. Changes are uncommitted for Claude review.

Baseline: `2fb9448` (the worktree starting commit), Bun 1.4.4. All eight supplied red scripts were run against the unchanged starting source and exited 1 on the named assertion. Original scripts were copied unchanged into ignored `codex-out/aivendor/`, their expected relative location; a temporary local `node_modules` symlink pointed to the already-installed desktop dependencies. That scratch copy and its libraries were removed after validation; the supplied scripts in `docs/reviews/` are untouched. No dependencies were installed. `fix-evidence-aivendor/NN-master.txt` records each exact command, output and exit status.

No existing tests, `docs/reviews/findings.md`, or `docs/DECISIONS.md` were edited. No intake behavior or `doc.md` output changed, so no intake fixture or golden update was needed. No browser, app, development server, e2e, bench or real AI call was launched. The existing CLI test attempted a test listener and failed; details below.

## AIVENDOR-01 — fixed: AI exercise rewrites keep their new author

**Changed files:** `apps/desktop/src/Ask.tsx`, `apps/desktop/src/Review.tsx`, `packages/cli/src/answers.ts`, `packages/cli/src/cmd-study.ts`, `packages/core/src/cards.ts`, `packages/core/src/remix.ts`, `apps/desktop/test/ask.test.ts`, `apps/desktop/test/fixtures/ask-provenance.tsx`, `packages/core/test/ai-rewrite.test.ts`.

**New tests:** `applying an Ask rewrite passes its author to the shared card command` in `apps/desktop/test/ask.test.ts`; `card set saves AI wording and attribution together, and restores an unstamped original` and `rewriting a variant saves and returns its own author without changing the original` in `packages/core/test/ai-rewrite.test.ts`.

**Durable fix:** Ask keeps the returned stamp, Review sends it with the wording and its Undo/Redo, and the shared core writers save text and stamp in the same atomic write or variant revision. An omitted stamp keeps existing metadata; explicit null restores an originally unstamped base exercise. Variant answers return the variant author rather than the base author.

The CLI response type now comes from `answers.ts`. Existing reads are unchanged. The headless test mounts the real Ask and invokes the real card command; Review itself is not mounted, and its small callback/Undo wiring is checked in the diff. The supplied red script has a frozen callback that forwards only question/answer, so the new regression forwards the current payload instead.

**Red evidence:** [baseline script](fix-evidence-aivendor/01-master.txt), [regression run](fix-evidence-aivendor/01-red.txt). Last lines:

```text
(fail) rewriting a variant saves and returns its own author without changing the original [16.05ms]

 0 pass
 2 fail
 2 expect() calls
Ran 2 tests across 1 file. [80.00ms]
```

**Green evidence:** [regression run](fix-evidence-aivendor/01-green.txt). Last lines:

```text
(pass) rewriting a variant saves and returns its own author without changing the original [15.75ms]

 3 pass
 0 fail
 10 expect() calls
Ran 3 tests across 2 files. [311.00ms]
```

## AIVENDOR-02 — fixed: Both Dig stages remain attributable

**Changed files:** `packages/core/src/ai/dig.ts`, `packages/core/src/digs.ts`, `packages/core/test/ai-vendor-regressions.test.ts`.

**New tests:** `a Dig retains both stages' authors after a vendor switch (legacy: %s)` (two cases) in `packages/core/test/ai-vendor-regressions.test.ts`.

**Durable fix:** An optional `ask_ai` records the first-stage author; `ai` retains its existing latest-stage meaning. Finishing an older still-open Dig copies its first-stage `ai` before replacing the latest stamp.

No migration or tightened read validation. Older completed Digs with only one stamp still read as before; an already-lost first-stage stamp cannot be reconstructed.

**Red evidence:** [baseline script](fix-evidence-aivendor/02-master.txt), [regression run](fix-evidence-aivendor/02-red.txt). Last lines:

```text
(fail) a Dig retains both stages' authors after a vendor switch (legacy: %s) [228.15ms]

 0 pass
 2 fail
 2 expect() calls
Ran 2 tests across 1 file. [516.00ms]
```

**Green evidence:** [regression run](fix-evidence-aivendor/02-green.txt). Last lines:

```text
(pass) a Dig retains both stages' authors after a vendor switch (legacy: %s) [278.01ms]

 2 pass
 0 fail
 4 expect() calls
Ran 2 tests across 1 file. [616.00ms]
```

## AIVENDOR-03 — fixed: Stop prevents a job starting after cancellation

**Changed files:** `apps/desktop/src/Ask.tsx`, `apps/desktop/test/ask.test.ts`, `apps/desktop/test/fixtures/ask-stop.tsx`.

**New tests:** `Ask owns the request after listener registration (stop)` and `(normal)` in `apps/desktop/test/ask.test.ts`.

**Durable fix:** The send continuation rechecks request ownership after asynchronous listener registration, before crossing the vendor-job boundary; its existing finally block removes the listener.

Both stopped and normal paths are covered without a browser. The original red script also requires two native calls (including the unwanted start), so that diagnostic assertion is not a green oracle. The permanent test instead requires only Stop, no start, and listener cleanup. The unconfirmed Tutor lead is outside these eight findings.

**Red evidence:** [baseline script](fix-evidence-aivendor/03-master.txt), [regression run](fix-evidence-aivendor/03-red.txt). Last lines:

```text
(pass) Ask owns the request after listener registration (normal) [154.23ms]

 2 pass
 1 fail
 3 expect() calls
Ran 3 tests across 1 file. [523.00ms]
```

**Green evidence:** [regression run](fix-evidence-aivendor/03-green.txt). Last lines:

```text
(pass) Ask owns the request after listener registration (normal) [152.94ms]

 3 pass
 0 fail
 3 expect() calls
Ran 3 tests across 1 file. [525.00ms]
```

## AIVENDOR-04 — fixed: Recall feedback cannot attach to revised prequestion input

**Changed files:** `packages/core/src/ai/recall.ts`, `packages/core/test/ai-vendor-regressions.test.ts`.

**New tests:** `recall feedback checks its prequestion input at save (%s)` in `packages/core/test/ai-vendor-regressions.test.ts` (after, before, question, skipped, removed, reordered, unchanged, marks).

**Durable fix:** The same projection builds the AI input and compares it under the existing metadata write lock, covering question text, both answers, numbering and skipped questions. Unrelated check marks do not invalidate the response.

The initial new skipped-case fixture used boolean true; the schema requires `past` or `left_out`. Corrected to `past`, reran the regression without the new guard to capture six real failures, then restored the guard and captured green. No existing test was edited.

**Red evidence:** [baseline script](fix-evidence-aivendor/04-master.txt), [regression run](fix-evidence-aivendor/04-red.txt). Last lines:

```text

 2 pass
 2 filtered out
 6 fail
 10 expect() calls
Ran 8 tests across 1 file. [1.55s]
```

**Green evidence:** [regression run](fix-evidence-aivendor/04-green.txt). Last lines:

```text
(pass) recall feedback checks its prequestion input at save (marks) [177.54ms]

 10 pass
 0 fail
 20 expect() calls
Ran 10 tests across 1 file. [1.98s]
```

## AIVENDOR-05 — fixed: Prequestion marks match the current question and ordered key points

**Changed files:** `packages/core/src/ai/check.ts`, `packages/core/test/ai-vendor-regressions.test.ts`.

**New tests:** `a late prequestion check matches the current question and ordered points (%s)` in `packages/core/test/ai-vendor-regressions.test.ts` (more, text, order, question, unchanged, evidence).

**Durable fix:** The locked save compares question text and ordered point text with the captured vendor input, alongside the existing answer guard. This catches equal-length rewrites and reorders as well as added points.

Evidence-only edits remain allowed because evidence is not sent to this check; the existing human-mark precedence remains intact.

**Red evidence:** [baseline script](fix-evidence-aivendor/05-master.txt), [regression run](fix-evidence-aivendor/05-red.txt). Last lines:

```text
(pass) a late prequestion check matches the current question and ordered points (evidence) [169.60ms]

 12 pass
 4 fail
 28 expect() calls
Ran 16 tests across 1 file. [2.90s]
```

**Green evidence:** [regression run](fix-evidence-aivendor/05-green.txt). Last lines:

```text
(pass) a late prequestion check matches the current question and ordered points (evidence) [171.80ms]

 16 pass
 0 fail
 32 expect() calls
Ran 16 tests across 1 file. [2.96s]
```

## AIVENDOR-06 — fixed: Closing a Dig protects its completed record

**Changed files:** `packages/core/src/ai/dig.ts`, `packages/core/test/ai-vendor-regressions.test.ts`.

**New tests:** `ending a Dig prevents the late first-stage reply from changing its saved record` in `packages/core/test/ai-vendor-regressions.test.ts`.

**Durable fix:** The first-stage locked save checks `done_at`, as the second stage already does. The regression proves the entire saved file remains byte-for-byte unchanged after the late reply.

No new completion rule: the existing finished-state contract now applies to both AI stages.

**Red evidence:** [baseline script](fix-evidence-aivendor/06-master.txt), [regression run](fix-evidence-aivendor/06-red.txt). Last lines:

```text
(fail) ending a Dig prevents the late first-stage reply from changing its saved record [202.65ms]

 16 pass
 1 fail
 33 expect() calls
Ran 17 tests across 1 file. [3.64s]
```

**Green evidence:** [regression run](fix-evidence-aivendor/06-green.txt). Last lines:

```text
(pass) ending a Dig prevents the late first-stage reply from changing its saved record [181.45ms]

 17 pass
 0 fail
 34 expect() calls
Ran 17 tests across 1 file. [3.30s]
```

## AIVENDOR-07 — fixed: Failed Claude processes cannot return successful candidates

**Changed files:** `packages/core/src/ai/adapter.ts`, `packages/core/test/ai-vendor-regressions.test.ts`.

**New tests:** `a failed Claude process cannot save its otherwise valid Try feedback` and `Claude chat rejects a failed process with a valid result (stream: %s)` (plain and streaming) in `packages/core/test/ai-vendor-regressions.test.ts`.

**Durable fix:** The single Claude result parser rejects a nonzero process exit before returning its candidate, covering tasks and both chat output formats. Existing timeout and explicit vendor-error handling retain their messages.

The persistence test also checks no line is saved and no schema retry consumes another call after a process failure. Real vendor usage was not invoked.

**Red evidence:** [baseline script](fix-evidence-aivendor/07-master.txt), [regression run](fix-evidence-aivendor/07-red.txt). Last lines:

```text
(fail) Claude chat rejects a failed process with a valid result (stream: %s) [152.90ms]

 17 pass
 3 fail
 37 expect() calls
Ran 20 tests across 1 file. [3.61s]
```

**Green evidence:** [regression run](fix-evidence-aivendor/07-green.txt). Last lines:

```text
(pass) Claude chat rejects a failed process with a valid result (stream: %s) [184.44ms]

 20 pass
 0 fail
 39 expect() calls
Ran 20 tests across 1 file. [3.57s]
```

## AIVENDOR-08 — fixed: Blank Try feedback cannot become an empty saved line

**Changed files:** `packages/core/src/ai/tries.ts`, `packages/core/test/ai-vendor-regressions.test.ts`.

**New tests:** `blank Try feedback is rejected after retry and never saved` and `Try feedback retries a blank reply and trims the readable replacement` in `packages/core/test/ai-vendor-regressions.test.ts`.

**Durable fix:** The AI-output schema trims before checking minimum length, so the existing adapter retry handles blank output before any write. Valid padded text still saves trimmed.

This only validates newly generated output; saved legacy lines and other library data are not rewritten or refused.

**Red evidence:** [baseline script](fix-evidence-aivendor/08-master.txt), [regression run](fix-evidence-aivendor/08-red.txt). Last lines:

```text
(fail) Try feedback retries a blank reply and trims the readable replacement [192.75ms]

 20 pass
 2 fail
 41 expect() calls
Ran 22 tests across 1 file. [3.99s]
```

**Green evidence:** [regression run](fix-evidence-aivendor/08-green.txt). Last lines:

```text
(pass) Try feedback retries a blank reply and trims the readable replacement [195.90ms]

 22 pass
 0 fail
 44 expect() calls
Ran 22 tests across 1 file. [4.24s]
```

## Existing coverage and interaction checks

Each file listed in [covering-files.txt](fix-evidence-aivendor/covering-files.txt) ran individually. [covering-summary.txt](fix-evidence-aivendor/covering-summary.txt) records all 19 files and their result. The related AI, card editing, remix, Dig, Try, tutor, schema and app guards pass. `cli-contract.test.ts` has 10 passing cases and one failure: its unrelated inbox-import test calls `Bun.serve({port: 0})`, which receives `EADDRINUSE` in this sandbox. Its exercise-edit case passes. No rerun, retry, skip or existing-test change was used to hide that failure.

The project interaction-check skill was read and applied within the requested headless scope. Existing controls and their purpose are unchanged: Apply replaces proposed wording; Stop cancels the pending reply. No visible elements were added or removed. The tests exercise Apply, normal completion, cancellation before startup, and listener cleanup. Existing Undo wait, review-session, exercise rendering, hint and wait-state tests pass. Native process termination, rendered pixels, full Review mounting and native Undo key presses remain for the reviewing thread; no browser was run.

New subprocess fixtures use their own Happy DOM and native-boundary mocks, clean up on completion, and cannot leak mocked modules into the full suite. Vendor-race tests use a file barrier, not an assumed delay. Only scratch libraries were written.

## Final required checks

Both commands ran exactly once after the final source changes. No test retries or skips were added.

- `bun run typecheck`: **passed**, exit 0. Both workspace and desktop TypeScript checks completed. [Full output](fix-evidence-aivendor/final-typecheck.txt).
- `bun test packages/core/test apps/desktop/test`: **1,856 pass, 3 fail**, 1,859 tests across 247 files, 10,059,545 assertions, 105.12 seconds, exit 1. All **27 new regression cases passed**. [Full output](fix-evidence-aivendor/final-tests.txt).

Failures retained for review (all outside the changed code; no baseline rerun of these suite failures was performed):

1. `packages/core/test/intake.test.ts:1327` — `a very tall or very wide screenshot is read whole, each line once (F188)`: native macOS Vision returned no readable text; `scannedText` reported `Found no text in that image`. The cause is not established by this run.
2. `packages/core/test/cli-contract.test.ts:52` — `an inbox import where every link fails exits non-zero and keeps them`: `Bun.serve({ port: 0 })` failed with `EADDRINUSE` at line 54 in the restricted environment.
3. `packages/core/test/cancel.test.ts:11` — `SIGTERM after the source is written takes it back out`: the test's `Bun.serve` failed with the same `EADDRINUSE` at line 16, before reaching cancellation.

`git diff --check` passed. No original tests or goldens changed. No commit or push was attempted. All tool-started test/reproduction sessions completed, and the new fixtures await their vendor/child processes and remove their listeners. A system-wide process listing is unavailable (`ps: operation not permitted`); no managed task session remains running.

Final test tail:

```text
 1856 pass
 3 fail
 10059545 expect() calls
Ran 1859 tests across 247 files. [105.12s]
Exit: 1
```

The draft fixes are ready for line review; the full suite is not green in this environment.
