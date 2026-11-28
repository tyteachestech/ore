# CLI JSON fix notes

Base: `1eafca9a0b51cc76b197f627589d6588bf7808e1` (clean worktree at start). All ten findings reproduced before their respective fixes, in report order. None skipped. Each new regression test was run red before the corresponding fix. All ten supplied scripts exit 0 after the fixes.

The supplied scripts retain their original `../../packages` imports, so they were copied unchanged from `docs/reviews/2026-11-28-codex-cli-recheck/red/json/` into ignored `codex-out/json/`. Full reproduction and test logs are retained under `codex-out/json/fix-logs/`; excerpts below keep the review evidence in this notes file.

No existing tests, findings register, decisions, intake logic, canonical formats or goldens were edited. No doctor checks were added, so the conditional seeded-doctor check does not apply. No browser, app, e2e or bench was run, and no server was started manually. New AI-input tests use local fake vendors and verify rejected flags never call them. Changes remain uncommitted as requested.

## JSON-01 — fixed: Malformed exercise-skill map

- Changed files: packages/core/src/skills.ts; packages/core/test/filing-input.test.ts.
- New test: `a malformed exercise-skill map is rejected before any exercise is written (JSON-01)` in `packages/core/test/filing-input.test.ts`.
- Reproduction: `bun codex-out/json/cards-json.ts partial` failed on its original assertion before the fix; after fixes, exit 0.
- Full evidence: `codex-out/json/fix-logs/01-repro.log`, `01-red.log`, `01-green.log`, `01-repro-green.log`.

Red test output (last lines):

```text
error: expect(received).toThrow(expected)

Expected substring: "--cards must be an object mapping exercise IDs to arrays of skill IDs"
Received message: "skills.join is not a function. (In 'skills.join()', 'skills.join' is undefined)"

      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/cli-fix-json/packages/core/test/filing-input.test.ts:16:120)
(fail) a malformed exercise-skill map is rejected before any exercise is written (JSON-01) [40.06ms]

 0 pass
 1 fail
 1 expect() calls
Ran 1 test across 1 file. [73.00ms]
```

Green command: `bun test packages/core/test/filing-input.test.ts packages/core/test/edit-source.test.ts packages/core/test/filing-reads.test.ts packages/core/test/filing-interruption.test.ts packages/core/test/level-filing.test.ts`.

```text
(pass) filing collects exercises once for Undo and updates, including renamed files [72.72ms]

 11 pass
 0 fail
 57 expect() calls
Ran 11 tests across 5 files. [576.00ms]
```

Durable fix: The filing owner validates every explicit map value before its write loop; CLI preflight reuses this same check in JSON-06. No saved exercise is parsed more strictly.

## JSON-02 — fixed: Empty skill ID

- Changed files: packages/core/src/skills.ts; packages/core/test/filing-input.test.ts.
- New test: `an empty skill ID is unknown and cannot replace an exercise's skills (JSON-02)` in `packages/core/test/filing-input.test.ts`.
- Reproduction: `bun codex-out/json/cards-json.ts empty-skill` failed on its original assertion before the fix; after fixes, exit 0.
- Full evidence: `codex-out/json/fix-logs/02-repro.log`, `02-red.log`, `02-green.log`, `02-repro-green.log`.

Red test output (last lines):

```text

Expected promise that rejects
Received promise that resolved: Promise { <resolved> }

      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/cli-fix-json/packages/core/test/filing-input.test.ts:27:98)
(fail) an empty skill ID is unknown and cannot replace an exercise's skills (JSON-02) [27.90ms]

 0 pass
 1 filtered out
 1 fail
 1 expect() calls
Ran 1 test across 1 file. [57.00ms]
```

Green command: `bun test packages/core/test/filing-input.test.ts packages/core/test/edit-source.test.ts packages/core/test/filing-reads.test.ts packages/core/test/filing-interruption.test.ts packages/core/test/level-filing.test.ts`.

```text
(pass) filing collects exercises once for Undo and updates, including renamed files [74.03ms]

 12 pass
 0 fail
 61 expect() calls
Ran 12 tests across 5 files. [600.00ms]
```

Durable fix: The shared skill-existence check distinguishes an unknown empty string from no unknown value. This guards every caller, not only --cards.

## JSON-03 — fixed: Ambiguous variant ID

- Changed files: packages/core/src/remix.ts; packages/core/test/variant-ids.test.ts.
- New test: `variant references resolve unique prefixes and suffixes and refuse ambiguity before writes (JSON-03)` in `packages/core/test/variant-ids.test.ts`.
- Reproduction: `bun codex-out/json/variant-ids.ts` failed on its original assertion before the fix; after fixes, exit 0.
- Full evidence: `codex-out/json/fix-logs/03-repro.log`, `03-red.log`, `03-green.log`, `03-repro-green.log`.

Red test output (last lines):

```text
error: expect(received).rejects.toThrow(expected)

Expected promise that rejects
Received promise that resolved: Promise { <resolved> }

      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/cli-fix-json/packages/core/test/variant-ids.test.ts:23:67)
(fail) variant references resolve unique prefixes and suffixes and refuse ambiguity before writes (JSON-03) [26.98ms]

 0 pass
 1 fail
 1 expect() calls
Ran 1 test across 1 file. [55.00ms]
```

Green command: `bun test packages/core/test/variant-ids.test.ts packages/core/test/remix.test.ts`.

```text
(pass) variant references resolve unique prefixes and suffixes and refuse ambiguity before writes (JSON-03) [31.18ms]

 12 pass
 0 fail
 89 expect() calls
Ran 12 tests across 2 files. [3.24s]
```

Durable fix: All variant readers and mutations use findVariant: exact ID first, otherwise one unique prefix/suffix match. Reversing record order cannot change the selection.

## JSON-04 — fixed: Rejected highlight edit moves passage

- Changed files: packages/cli/src/cmd-items.ts; packages/core/test/cli-json.test.ts.
- New test: `annotate validates every flag before moving a passage (JSON-04)` in `packages/core/test/cli-json.test.ts`.
- Reproduction: `bun codex-out/json/atomic.ts annotate` failed on its original assertion before the fix; after fixes, exit 0.
- Full evidence: `codex-out/json/fix-logs/04-repro.log`, `04-red.log`, `04-green.log`, `04-repro-green.log`.

Red test output (last lines):

```text
  }

- Expected  - 1
+ Received  + 1

      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/cli-fix-json/packages/core/test/cli-json.test.ts:42:24)
(fail) annotate validates every flag before moving a passage (JSON-04) [83.14ms]

 0 pass
 1 fail
 3 expect() calls
Ran 1 test across 1 file. [119.00ms]
```

Green command: `bun test packages/core/test/cli-json.test.ts`.

```text
(pass) annotate validates every flag before moving a passage (JSON-04) [187.14ms]

 1 pass
 0 fail
 8 expect() calls
Ran 1 test across 1 file. [216.00ms]
```

Durable fix: The shared command builds and validates the annotation patch before moving the passage. Both invalid intent and invalid status leave the saved bytes unchanged.

Existing annotation and anchoring tests also passed in the JSON-05 run below.

## JSON-05 — fixed: Rejected course filing renames course

- Changed files: packages/cli/src/cmd-items.ts; packages/core/test/cli-json.test.ts.
- New test: `course set refuses invalid filing before renaming any lesson (JSON-05)` in `packages/core/test/cli-json.test.ts`.
- Reproduction: `bun codex-out/json/atomic.ts course` failed on its original assertion before the fix; after fixes, exit 0.
- Full evidence: `codex-out/json/fix-logs/05-repro.log`, `05-red.log`, `05-green.log`, `05-repro-green.log`.

Red test output (last lines):

```text

- Expected  - 2
+ Received  + 2

      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/cli-fix-json/packages/core/test/cli-json.test.ts:59:22)
(fail) course set refuses invalid filing before renaming any lesson (JSON-05) [108.38ms]

 0 pass
 1 filtered out
 1 fail
 3 expect() calls
Ran 1 test across 1 file. [146.00ms]
```

Green command: `bun test packages/core/test/cli-json.test.ts packages/core/test/courses.test.ts packages/core/test/annotations.test.ts packages/core/test/anchoring.test.ts`.

```text
(pass) anchoring > a highlight whose last word grew on reimport keeps the whole word, never its first letters (F577) [0.12ms]

 41 pass
 0 fail
 161 expect() calls
Ran 41 tests across 4 files. [1079.00ms]
```

Durable fix: The shared course command checks skill membership before the first lesson rename, using the existing core validator. The test covers two lessons and a valid combined edit.

## JSON-06 — fixed: Malformed --cards partially edits source

- Changed files: packages/cli/src/cmd-items.ts; packages/core/src/skills.ts (validator introduced for JSON-01); packages/core/test/cli-json.test.ts.
- New test: `edit validates card map syntax, shape and skills before saving metadata (JSON-06)` in `packages/core/test/cli-json.test.ts`.
- Reproduction: `bun codex-out/json/atomic.ts edit` failed on its original assertion before the fix; after fixes, exit 0.
- Full evidence: `codex-out/json/fix-logs/06-repro.log`, `06-red.log`, `06-green.log`, `06-repro-green.log`.

Red test output (last lines):

```text

- Expected  - 1
+ Received  + 1

      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/cli-fix-json/packages/core/test/cli-json.test.ts:72:24)
(fail) edit validates card map syntax, shape and skills before saving metadata (JSON-06) [92.95ms]

 0 pass
 2 filtered out
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [126.00ms]
```

Green command: `bun test packages/core/test/cli-json.test.ts packages/core/test/filing-input.test.ts packages/core/test/edit-source.test.ts`.

```text
(pass) editing a source > Undo of a filing puts each card back to its own skills (Codex sweep 3, lifecycle) [22.38ms]

 10 pass
 0 fail
 66 expect() calls
Ran 10 tests across 3 files. [843.00ms]
```

Durable fix: JSON parsing and the core filing validator run before title, author or priority writes. Syntax, map shape, missing skills and empty skill IDs are covered, alongside a valid Undo map.

## JSON-07 — fixed: Invalid model changes AI vendor

- Changed files: packages/cli/src/cmd-study.ts; packages/core/src/ai/models.ts; packages/core/test/cli-json.test.ts.
- New test: `settings validates a model before changing the library AI vendor (JSON-07)` in `packages/core/test/cli-json.test.ts`.
- Reproduction: `bun codex-out/json/atomic.ts settings` failed on its original assertion before the fix; after fixes, exit 0.
- Full evidence: `codex-out/json/fix-logs/07-repro.log`, `07-red.log`, `07-green.log`, `07-repro-green.log`.

Red test output (last lines):

```text

- Expected  - 1
+ Received  + 1

      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/cli-fix-json/packages/core/test/cli-json.test.ts:88:22)
(fail) settings validates a model before changing the library AI vendor (JSON-07) [102.81ms]

 0 pass
 3 filtered out
 1 fail
 3 expect() calls
Ran 1 test across 1 file. [148.00ms]
```

Green command: `bun test packages/core/test/cli-json.test.ts packages/core/test/ai.test.ts packages/core/test/ai-jobs.test.ts packages/core/test/damaged-library.test.ts`.

```text
(pass) an AI for each job > a hand edit that gets a job's AI wrong leaves that job on the default AI, and the rest of skills.yaml reads [12.26ms]

 92 pass
 0 fail
 457 expect() calls
Ran 92 tests across 4 files. [23.18s]
```

Durable fix: The model validator is shared by global preflight, model saving and per-job saving, so a rejected model cannot change the vendor. The existing model-name rule and environment override behavior stay intact.

## JSON-08 — fixed: cards --item ignores source prefix

- Changed files: packages/cli/src/cmd-study.ts; packages/core/test/cli-json.test.ts.
- New test: `cards --item resolves the same source references as show (JSON-08)` in `packages/core/test/cli-json.test.ts`.
- Reproduction: `bun codex-out/json/ids.ts` failed on its original assertion before the fix; after fixes, exit 0.
- Full evidence: `codex-out/json/fix-logs/08-repro.log`, `08-red.log`, `08-green.log`, `08-repro-green.log`.

Red test output (last lines):

```text

- Expected  - 3
+ Received  + 1

      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/cli-fix-json/packages/core/test/cli-json.test.ts:104:58)
(fail) cards --item resolves the same source references as show (JSON-08) [240.57ms]

 0 pass
 4 filtered out
 1 fail
 6 expect() calls
Ran 1 test across 1 file. [269.00ms]
```

Green command: `bun test packages/core/test/cli-json.test.ts packages/core/test/cards.test.ts`.

```text
(pass) cards --item resolves the same source references as show (JSON-08) [481.24ms]

 5 pass
 0 fail
 54 expect() calls
Ran 5 tests across 1 file. [1380.00ms]
```

Durable fix: The command resolves the source through findItem before filtering by the full ID. Missing and ambiguous references now use the established source lookup errors; a real source with no exercises still returns [].

The first focused command named `cards.test.ts`, which does not exist; Bun ran only `cli-json.test.ts` (shown above). The actual existing exercise coverage, `study.test.ts`, ran green with JSON-09. The final suite includes all existing files.

## JSON-09 — fixed: Try mutation answer lacks item_title

- Changed files: packages/core/src/tries.ts; packages/cli/src/cmd-items.ts; packages/core/test/cli-json.test.ts.
- New test: `try mutations return the same source title and section as tries (JSON-09)` in `packages/core/test/cli-json.test.ts`.
- Reproduction: `bun codex-out/json/shape.ts` failed on its original assertion before the fix; after fixes, exit 0.
- Full evidence: `codex-out/json/fix-logs/09-repro.log`, `09-red.log`, `09-green.log`, `09-repro-green.log`.

Red test output (last lines):

```text

Expected: "Recall one idea"
Received: undefined

      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/cli-fix-json/packages/core/test/cli-json.test.ts:128:33)
(fail) try mutations return the same source title and section as tries (JSON-09) [146.71ms]

 0 pass
 5 filtered out
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [180.00ms]
```

Green command: `bun test packages/core/test/cli-json.test.ts packages/core/test/tries.test.ts packages/core/test/study.test.ts`.

```text
(pass) the rest of the apply loop: each use keeps its moment, and what he is trying now across skills (D324) > trying now lists each skill's one active try, once, and none for a skill whose tries are all his [15.34ms]

 41 pass
 0 fail
 253 expect() calls
Ran 41 tests across 3 files. [2.50s]
```

Durable fix: One typed TryView builder supplies source context to listings and all ordinary Try mutations. answers.Try remains accurate; tried --line keeps its separate AI response. The test covers typed and passage-backed tries, edits, completion and Undo.

## JSON-10 — fixed: Structured flags expose internal method errors

- Changed files: packages/cli/src/cmd-ai.ts; packages/core/test/cli-ai-input.test.ts.
- New test: `21 parameterized flag/schema cases, plus structured flag errors also explain text mode; valid arrays and incomplete tutor turns still work (JSON-10)` in `packages/core/test/cli-ai-input.test.ts`.
- Reproduction: `bun codex-out/json/structured-errors.ts` failed on its original assertion before the fix; after fixes, exit 0.
- Full evidence: `codex-out/json/fix-logs/10-repro.log`, `10-red.log`, `10-green.log`, `10-repro-green.log`.

Red test output (last lines):

```text
error: expect(received).toContain(expected)

Expected to contain: "--files"
Received: "ore: fs.flatMap is not a function. (In 'fs.flatMap((f) => {\n"

      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/cli-fix-json/packages/core/test/cli-ai-input.test.ts:59:25)
(fail) structured flag errors also explain text mode; valid arrays and incomplete tutor turns still work (JSON-10) [51.65ms]

 0 pass
 22 fail
 42 expect() calls
Ran 22 tests across 1 file. [1.75s]
```

Green command: `bun test packages/core/test/cli-ai-input.test.ts packages/core/test/tutor.test.ts packages/core/test/ask-library.test.ts`.

```text
(pass) structured flag errors also explain text mode; valid arrays and incomplete tutor turns still work (JSON-10) [738.68ms]

 99 pass
 0 fail
 336 expect() calls
Ran 99 tests across 3 files. [17.91s]
```

Durable fix: One JSON-array parser validates command inputs before either AI path. Each error names the flag and gives a valid JSON example. Tutor missing/null messages or replies, unrecognized older exercise objects and unavailable older attachments retain their existing handling. Saved chat readers are unchanged.

## Final checks

`bun run typecheck` was run once and exited 1. It stopped on an existing duplicate method in `apps/desktop/src/review-session.ts`, which this draft does not edit. `git show HEAD:apps/desktop/src/review-session.ts` contains both definitions (`gone()` at line 253 and `private gone(id: string)` at line 501); its diff is empty. No type errors were reported in the changed files. The second `tsc` command after `&&` did not run.

```text
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
apps/desktop/src/review-session.ts(253,3): error TS2393: Duplicate function implementation.
apps/desktop/src/review-session.ts(501,11): error TS2393: Duplicate function implementation.
apps/desktop/src/review-session.ts(501,11): error TS6133: 'gone' is declared but its value is never read.
error: script "typecheck" exited with code 1
```

`bun test packages/core/test apps/desktop/test` was run once and exited 1: **2,212 passed, 3 failed**, across 276 files. All **31 new JSON regression cases passed** in this run. It includes every existing test file covering the changed code, beyond the focused runs above. Full output: `codex-out/json/fix-logs/final-tests.log`.

The three failures were left intact; there were no reruns, retries, skips or edits to existing tests:

- `packages/core/test/intake.test.ts:1659`: “a very tall or very wide screenshot is read whole, each line once (F188)” failed on `tall.png`: `Found no text in that image. Add a screenshot with text, or paste what you need.` This uses the real macOS Vision reader. Its intake and OCR code are unchanged; the cause was not diagnosed in this JSON fix pass.
- `packages/core/test/cli-contract.test.ts:54`: “an inbox import where every link fails exits non-zero and keeps them” could not start its test server: `Failed to start server. Is port 0 in use?`, `syscall: listen`, `code: EADDRINUSE`. It failed at setup before exercising the command.
- `packages/core/test/cancel.test.ts:16`: “SIGTERM after the source is written takes it back out” failed at the same server setup with `EADDRINUSE`.

The typecheck and full suite are **not green**. The review handoff must retain these blockers; passing focused JSON checks does not establish that the worktree is ready to merge. The two server setup failures do not establish a command regression, and the unchanged OCR failure is not claimed resolved or flaky.

`git diff --check` passed. All supplied reproductions now exit 0, and all directly launched commands finished. No app, browser, watcher or development server was started for this pass. The required full test command attempted its own two local test servers, which failed to bind.

Final test output (last lines):

```text

3 tests failed:
(fail) import coverage: text recognition > a very tall or very wide screenshot is read whole, each line once (F188) [98.92ms]
(fail) the CLI as an agent drives it > an inbox import where every link fails exits non-zero and keeps them [10.82ms]
(fail) cancelling an add > SIGTERM after the source is written takes it back out [10.94ms]

 2212 pass
 3 fail
 10061976 expect() calls
Ran 2215 tests across 276 files. [126.92s]
```
