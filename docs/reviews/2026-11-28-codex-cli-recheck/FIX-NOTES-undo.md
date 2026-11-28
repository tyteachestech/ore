# Undo CLI recheck — fix notes

Starting checkout: `1eafca9a0b51cc76b197f627589d6588bf7808e1`. All seven reported findings reproduced, in report order, before their relevant fixes. No taste or contract decisions were needed for those seven. Changes are uncommitted in this worktree for Claude’s review.

Original red scripts were copied unchanged from `docs/reviews/2026-11-28-codex-cli-recheck/red/undo/` into ignored `codex-out/undo/`, their original relative-import location. Rejecting fake Claude/Codex executables were created there. Scratch libraries and full red/green logs remain there; no live library was used. Each original red assertion failed; all ten corresponding final script runs exited 0.

Existing assertions were not changed. Existing test files only gained imports and new tests. No browser, app, e2e or bench was run. No findings/decision registry was edited. No intake parsing or intended imported `doc.md` output changed, so no new intake fixture or golden update was needed. The reanchoring extraction preserves its existing algorithm and lets reimport use it within the library lock.

## UNDO-01 — Fixed

Changed files: packages/core/src/cut.ts; packages/core/test/cut.test.ts.

New tests in `packages/core/test/cut.test.ts`: Undo restores a cut question’s passage through Redo (moved: false/true); an older cut receipt without retained questions restores their quote.

Original reproduction output (each exited 1):
```text
01-master.log: AssertionError: Undo of a cut must restore the question passage without rewriting it to different words
```

Test-first red: `codex-out/undo/logs/01-red.log`
```text

 8 pass
 2 fail
 30 expect() calls
Ran 10 tests across 1 file. [234.00ms]
```

Green run: `codex-out/undo/logs/01-green.log`
```text

 10 pass
 0 fail
 60 expect() calls
Ran 10 tests across 1 file. [227.00ms]
```

Durable fix: The cut records retained questions separately and restores their original passage instead of shifting them as surviving text. Questions orphaned by another cut are not shifted from stale coordinates.

## UNDO-02 — Fixed

Changed files: packages/core/src/ingest/index.ts; packages/core/src/annotations.ts; packages/core/test/reimport-undo.test.ts.

New tests in `packages/core/test/reimport-undo.test.ts`: reimport Undo and Redo preserve an independent author correction (original: Original author/absent); reimport Undo and Redo still reverse the author it added.

Original reproduction output (each exited 1):
```text
02-master.log: AssertionError: Undo overwrote the independent author correction
```

Test-first red: `codex-out/undo/logs/02-red.log`
```text

 1 pass
 2 fail
 7 expect() calls
Ran 3 tests across 1 file. [105.00ms]
```

Green run: `codex-out/undo/logs/02-green.log`
```text

 25 pass
 0 fail
 123 expect() calls
Ran 25 tests across 3 files. [2.90s]
```

Durable fix: A new reimport receipt records its written metadata. Its inverse reverses only changed fields still matching that written state; later edits survive Undo and Redo.

Compatibility: receipts without `after.json` still use the original swap behavior; the added compatibility test removes that file and exercises Undo/Redo. New receipts protect independent edits. The recorded states swap with each Undo/Redo, and the supplied three-deep reimport/redo/undo control also passed. The final lock/refactor run passed 42 tests across four files (`02-03-lock-green.log`).

## UNDO-03 — Fixed

Changed files: packages/core/src/ingest/index.ts; packages/core/src/annotations.ts; packages/core/test/reimport-undo.test.ts.

New tests in `packages/core/test/reimport-undo.test.ts`: reimport Undo keeps a separately deleted highlight deleted (anchor moved: false/true); reimport Undo restores its removed highlight while keeping a later note.

Original reproduction output (each exited 1):
```text
03-master.log: AssertionError: Undo resurrected an independently deleted highlight that reimport never removed
```

Test-first red: `codex-out/undo/logs/03-red.log`
```text

 4 pass
 2 fail
 19 expect() calls
Ran 6 tests across 1 file. [194.00ms]
```

Green run: `codex-out/undo/logs/03-green.log`
```text

 55 pass
 0 fail
 287 expect() calls
Ran 55 tests across 6 files. [5.98s]
```

Durable fix: The inverse compares status and passage separately against the recorded after-state. Reimport, reanchoring, deletion and receipt capture share the library lock; Undo’s source, annotation and receipt writes share it too.

Compatibility: receipts without `after.json` still use the original swap behavior; the added compatibility test removes that file and exercises Undo/Redo. New receipts protect independent edits. The recorded states swap with each Undo/Redo, and the supplied three-deep reimport/redo/undo control also passed. The final lock/refactor run passed 42 tests across four files (`02-03-lock-green.log`).

## UNDO-04 — Fixed

Changed files: packages/core/src/skills.ts; packages/core/test/importance.test.ts.

New tests in `packages/core/test/importance.test.ts`: Undo of an accepted suggestion rearchives its existing skill and excludes its old exercises.

Original reproduction output (each exited 1):
```text
04-master.log: AssertionError: Undo must restore the archived skill and leave its old exercises out of review (D173.4)
```

Test-first red: `codex-out/undo/logs/04-red.log`
```text

 11 pass
 1 fail
 42 expect() calls
Ran 12 tests across 1 file. [380.00ms]
```

Green run: `codex-out/undo/logs/04-green.log`
```text

 70 pass
 0 fail
 373 expect() calls
Ran 70 tests across 2 files. [14.88s]
```

Durable fix: Accept records whether it unarchived the skill, and the core inverse restores that flag under the same lock as filing changes, as D173.4 requires.

Older suggestion Undo payloads without `archived` retain their prior behavior through the schema’s false default.

## UNDO-05 — Fixed

Changed files: packages/core/src/doctor.ts; packages/core/test/doctor-saved-material.test.ts.

New tests in `packages/core/test/doctor-saved-material.test.ts`: doctor reports damaged chat/inbox/variant/image material without rewriting it; doctor accepts older chats and inbox descriptors and checks only rendered local images.

Original reproduction output (each exited 1):
```text
05-chat-master.log: AssertionError: Doctor must identify the broken chat file and a next step
05-image-master.log: AssertionError: Doctor must identify the broken image file and a next step
05-inbox-master.log: AssertionError: Doctor must identify the broken inbox file and a next step
05-variant-master.log: AssertionError: Doctor must identify the broken variant file and a next step
```

Test-first red: `codex-out/undo/logs/05-red.log`
```text

 1 pass
 4 fail
 5 expect() calls
Ran 5 tests across 1 file. [171.00ms]
```

Green run: `codex-out/undo/logs/05-green.log`
```text

 5 pass
 0 fail
 33 expect() calls
Ran 5 tests across 1 file. [216.00ms]
```

Durable fix: Doctor validates saved material and its references without repairing or deleting canonical data. It uses the existing chat validator, the queue reader’s permissive older shape, and the shared Markdown image parser (references included; code examples excluded).

Seed compatibility: ran `ORE_NO_ENRICH=1 bun apps/desktop/scripts/mock/seed.ts "$PWD/codex-out/undo/doctor-seed"`, then the CLI doctor before any diagnostics edits. The unmodified seed intentionally adds `items/2026/untitled folder`; its existing missing-doc warning is saved in `05-seed-before.log`. Removed only that empty scratch folder, as doctor recommends. `05-seed-clean-before.log`, `05-seed-after.log` and `07-seed-after.log` each show `ok: true`, zero errors, zero warnings and no issues. The new old-format compatibility test also passes. No seed source was modified.

## UNDO-06 — Fixed

Changed files: packages/core/src/sessions.ts; packages/core/src/doctor.ts; packages/core/test/session-reopen.test.ts.

New tests in `packages/core/test/session-reopen.test.ts`: reopening a caught-up session removes its historical goal credit even without the local pointer.

Original reproduction output (each exited 1):
```text
06-master.log: AssertionError: An undone caught-up ending must not count yesterday as goal met
```

Test-first red: `codex-out/undo/logs/06-red.log`
```text

 0 pass
 1 fail
 1 expect() calls
Ran 1 test across 1 file. [100.00ms]
```

Green run: `codex-out/undo/logs/06-green.log`
```text

 98 pass
 0 fail
 386 expect() calls
Ran 98 tests across 4 files. [4.68s]
```

Durable fix: Reopening appends a shared log receipt that supersedes the ending. Every consumer of readSessions sees the same effective history, including Today after midnight or without this Mac’s local pointer.

Format note for review: new log lines use `{type:"reopen", id, ts}`. Old start/end receipts are read unchanged. Ending/reopening timestamps advance by at least 1 ms beyond the session’s previous transition, so a fast repeated Undo/Redo or a corrected clock cannot leave the prior ending effective. Doctor recognizes the new receipt.

## UNDO-07 — Fixed

Changed files: packages/core/src/cards.ts; packages/core/src/doctor.ts; packages/core/test/card-copies.test.ts.

New tests in `packages/core/test/card-copies.test.ts`: canonical exercise wins over 000-copy-/zzz-copy- copy in lists, direct reads and index.

Original reproduction output (each exited 1):
```text
07-master.log: AssertionError: Doctor must name the duplicate exercise file
```

Test-first red: `codex-out/undo/logs/07-red.log`
```text

 0 pass
 2 fail
 2 expect() calls
Ran 2 tests across 1 file. [112.00ms]
```

Green run: `codex-out/undo/logs/07-green.log`
```text

 39 pass
 1 fail
 108 expect() calls
Ran 40 tests across 3 files. [7.33s]
```

Durable fix: Canonical preference compares the complete basename with <id>.md, as direct reads and indexing do. Doctor names each mismatched filename. A lone older hand-renamed file still lists; no copies are deleted.

Both new duplicate tests and the damaged-library tests passed. The combined existing CLI-contract run above is not fully green: its unrelated inbox-import test attempts `Bun.serve({ port: 0 })`, which this sandbox denied with `EADDRINUSE`. It was not retried or changed. The consolidated regression run below is green.

## Leads left unchanged

- Shared-topic association after filing Undo: skipped. The report explicitly leaves whether shared topic membership should be retracted to a contract decision. No new rule was introduced.
- Append-only history, JSON key order and an empty digs file: skipped; no lost learner state was established.
- Incomplete doctor wording on other recognized faults: skipped as a lead without a demonstrated failing learner flow in this report. New diagnostics here include a recovery next step.

## Verification

All ten original reproductions now exit 0 (`01-final-script.log` through `07-final-script.log`, including four `05-*` cases). Consolidated new/affected regression files:
```text

 38 pass
 0 fail
 198 expect() calls
Ran 38 tests across 6 files. [855.00ms]
```

Existing covering files run: `ai-rewrite`, `card-edit`, `archive`, `cell`, `filing-reads`, `figure`, `edit-source`, `links`, `filing-interruption`, `finder-files`, `original-doctor`, `intake`, `remix`, `tutor`, `tries`, `ai`, `importance`, `annotations`, `cut`, `reimport`, `reimport-interruption`, `page-video`, `owed`, `tables`, `study`, `today`, `foundation`, `damaged-library`, `cli-contract`, plus the new regression files. Full logs are `coverage-*.log` and the numbered green logs. The intake run had 218 pass / 1 fail: the existing Mac Vision test for tall/wide screenshots returned “Found no text in that image” at `intake.test.ts:1659`. Its OCR code and fixture are unchanged; no retry, skip, or assertion change was made. The underlying native failure remains unresolved.

Final typecheck was run exactly once. It found one test-only typing error in the new fetch stub (Bun fetch also has a `preconnect` member). Corrected its cast to `as unknown as typeof fetch`, matching the existing reimport tests. Per the one-run limit, typecheck was not rerun; the app typecheck was not reached after this first compiler error. Original output:
```text
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
packages/core/test/reimport-undo.test.ts(15,22): error TS2352: Conversion of type '() => Promise<Response>' to type 'typeof fetch' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Property 'preconnect' is missing in type '() => Promise<Response>' but required in type 'typeof fetch'.
error: script "typecheck" exited with code 1
```

Final core/app test command (run exactly once): `bun test packages/core/test apps/desktop/test`, exit 1. Full output: `codex-out/undo/logs/final-tests.log`.

Failures, with no retries or test changes:

- `packages/core/test/intake.test.ts:1659`: Mac Vision returned no text for the tall screenshot; its cause remains unresolved, and its native code/fixture are unchanged.
- `packages/core/test/cli-contract.test.ts:54`: the existing inbox-import test could not bind its temporary server (`EADDRINUSE` at `Bun.serve({ port: 0 })`).
- `packages/core/test/cancel.test.ts:16`: the existing SIGTERM/cancellation test could not bind its temporary server for the same reason.

Every new regression passed in this full run. No background process was intentionally launched; the test process completed. `git diff --check` passed. No commit or push was attempted.

Final typecheck summary: exit 1 on one new test-stub cast; cast corrected, not rerun under the once-only limit, and app typecheck not reached. Final tests:
```text

 2200 pass
 3 fail
 10061890 expect() calls
Ran 2203 tests across 276 files. [124.17s]
```
