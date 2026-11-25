# Edge fixes — draft handoff

Git staging is blocked by the sandbox: cannot create `/Users/tylerpoelking/Developer/ore/.git/worktrees/deep4-fix-edges/index.lock` (Operation not permitted). All changes are uncommitted. Apply commits in report order; the file lists and complete messages below are the per-finding handoff. No findings registry or decisions were edited. Several files contain fixes for multiple findings; stage their corresponding hunks, rather than entire shared files, when creating the separate commits. FIX-NOTES.md belongs in the final handoff commit.

## EDGES-01

Undo unlinked doc.md before writeAtomic replaced it. Keep that canonical file in place until rename; retry and Doctor recover missing documents from validated older stashes. This covers Undo/redo and existing interrupted swaps; normal reimport already uses atomic document replacement. Guards: Undo keeps an existing source readable at every document replacement boundary; Undo/Doctor recovers a source missing after an older interrupted reimport.

Changed files: `packages/core/src/ingest/index.ts`, `packages/core/src/doctor.ts`, `packages/core/test/reimport-interruption.test.ts`.

Full commit message:

```text
Keep sources readable during reimport Undo

Undo unlinked doc.md before writeAtomic replaced it. Keep that canonical file in place until rename; retry and Doctor recover missing documents from validated older stashes. This covers Undo/redo and existing interrupted swaps; normal reimport already uses atomic document replacement. Guards: Undo keeps an existing source readable at every document replacement boundary; Undo/Doctor recovers a source missing after an older interrupted reimport.

Red: ORE_NO_ENRICH=1 bun test packages/core/test/reimport-interruption.test.ts

 0 pass
 3 fail
 1 expect() calls
Ran 3 tests across 1 file. [218.00ms]

Green: ORE_NO_ENRICH=1 bun test packages/core/test/reimport-interruption.test.ts packages/core/test/reimport.test.ts

 20 pass
 0 fail
 104 expect() calls
Ran 20 tests across 2 files. [2.81s]

Typecheck: ORE_NO_ENRICH=1 bun run typecheck
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
```

## EDGES-02

A live PID fell through to the one-minute expiry. Locks now name the host and test local owner liveness before age; foreign owners never use a local PID test, and EPERM is treated as alive. Sync excludes .ore (apps/phone/src-tauri/src/lib.rs); the phone has an ephemeral filesystem and serial command queue. Atomic publication and the takeover guard follow in EDGES-11. Guards: a paused live writer keeps its lock past one minute; a foreign host lock never probes a local PID or expires by age.

Changed files: `packages/core/src/lock.ts`, `packages/core/test/lock.test.ts`.

Full commit message:

```text
Keep a live writer exclusive regardless of lock age

A live PID fell through to the one-minute expiry. Locks now name the host and test local owner liveness before age; foreign owners never use a local PID test, and EPERM is treated as alive. Sync excludes .ore (apps/phone/src-tauri/src/lib.rs); the phone has an ephemeral filesystem and serial command queue. Atomic publication and the takeover guard follow in EDGES-11. Guards: a paused live writer keeps its lock past one minute; a foreign host lock never probes a local PID or expires by age.

Red: ORE_NO_ENRICH=1 bun test packages/core/test/lock.test.ts

 0 pass
 2 fail
 2 expect() calls
Ran 2 tests across 1 file. [126.00ms]

Green: ORE_NO_ENRICH=1 bun test packages/core/test/lock.test.ts packages/core/test/foundation.test.ts

 27 pass
 0 fail
 112 expect() calls
Ran 27 tests across 2 files. [2.52s]

Typecheck: ORE_NO_ENRICH=1 bun run typecheck
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
```

## EDGES-03

SkillSchema accepted any string and note/dig/index paths joined it directly. Validate Unicode slugs when reading YAML and route every skill-directory path through skillDir, including deleted-folder collision checks. This protects all callers, not only setNotes. Guards: a handwritten skill ID cannot overwrite a source note; invalid skill IDs are refused at read and path boundaries; Unicode skill slugs keep their own note folder.

Changed files: `packages/core/src/skill-path.ts`, `packages/core/src/skills.ts`, `packages/core/src/notes.ts`, `packages/core/src/digs.ts`, `packages/core/src/db.ts`, `packages/core/test/skill-paths.test.ts`.

Full commit message:

```text
Refuse skill IDs that can overwrite another note

SkillSchema accepted any string and note/dig/index paths joined it directly. Validate Unicode slugs when reading YAML and route every skill-directory path through skillDir, including deleted-folder collision checks. This protects all callers, not only setNotes. Guards: a handwritten skill ID cannot overwrite a source note; invalid skill IDs are refused at read and path boundaries; Unicode skill slugs keep their own note folder.

Red: ORE_NO_ENRICH=1 bun test packages/core/test/skill-paths.test.ts

 1 pass
 8 fail
 12 expect() calls
Ran 9 tests across 1 file. [164.00ms]

Green: ORE_NO_ENRICH=1 bun test packages/core/test/skill-paths.test.ts packages/core/test/skills.test.ts packages/core/test/digs.test.ts packages/core/test/notes.test.ts

 26 pass
 0 fail
 102 expect() calls
Ran 26 tests across 3 files. [491.00ms]

Typecheck: ORE_NO_ENRICH=1 bun run typecheck
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
```

## EDGES-04

The source was written before its exercises, erasing the delta a retry needed. Write the source last, after idempotent exercise and topic updates. Preserve each exercise-specific skill and explicit Undo assignments. Guards kill a real child after the source write and after the first of two exercise writes, then retry and check all assignments; the original script also confirms the intended FSRS due date.

Changed files: `packages/core/src/skills.ts`, `packages/core/test/filing-interruption.test.ts`.

Full commit message:

```text
Finish interrupted source filing on retry

The source was written before its exercises, erasing the delta a retry needed. Write the source last, after idempotent exercise and topic updates. Preserve each exercise-specific skill and explicit Undo assignments. Guards kill a real child after the source write and after the first of two exercise writes, then retry and check all assignments; the original script also confirms the intended FSRS due date.

Red: ORE_NO_ENRICH=1 bun test packages/core/test/filing-interruption.test.ts

 0 pass
 2 fail
 7 expect() calls
Ran 2 tests across 1 file. [203.00ms]

Green: ORE_NO_ENRICH=1 bun test packages/core/test/filing-interruption.test.ts packages/core/test/edit-source.test.ts

 7 pass
 0 fail
 25 expect() calls
Ran 7 tests across 2 files. [239.00ms]

Typecheck: ORE_NO_ENRICH=1 bun run typecheck
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
```

## EDGES-05

Snapshots staged canonical files without the library lock. A synchronous tryWithLock now owns that same lock for the entire Git stage/commit or skips immediately while busy, covering automatic CLI and explicit snapshots. Only a successful commit updates the throttle marker. Guard: history skips a half-written change without delaying the next complete snapshot. The supplied history script was reproduced red before the filing-order fix; after these changes a busy snapshot intentionally retains the previous complete version.

Changed files: `packages/core/src/history.ts`, `packages/core/src/lock.ts`, `packages/core/test/history.test.ts`.

Full commit message:

```text
Keep half-written changes out of library history

Snapshots staged canonical files without the library lock. A synchronous tryWithLock now owns that same lock for the entire Git stage/commit or skips immediately while busy, covering automatic CLI and explicit snapshots. Only a successful commit updates the throttle marker. Guard: history skips a half-written change without delaying the next complete snapshot. The supplied history script was reproduced red before the filing-order fix; after these changes a busy snapshot intentionally retains the previous complete version.

Red: ORE_NO_ENRICH=1 bun test packages/core/test/history.test.ts

 5 pass
 1 fail
 14 expect() calls
Ran 6 tests across 1 file. [203.00ms]

Green: ORE_NO_ENRICH=1 bun test packages/core/test/history.test.ts packages/core/test/lock.test.ts

 8 pass
 0 fail
 23 expect() calls
Ran 8 tests across 2 files. [313.00ms]

Typecheck: ORE_NO_ENRICH=1 bun run typecheck
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
```

## EDGES-06

The locked save refreshed the source but trusted origin IDs captured before AI ran. Re-read live highlights under the lock and require every primary/grouped origin to remain present before saving a draft; deleted plain highlights also stay out of planned IDs. Existing exercises are untouched. Guards: enrich skips a draft whose primary/grouped highlight was deleted while AI replied; full AI test file and supplied fake-provider script pass.

Changed files: `packages/core/src/ai/enrich.ts`, `packages/core/test/ai.test.ts`.

Full commit message:

```text
Discard AI drafts whose highlights were deleted

The locked save refreshed the source but trusted origin IDs captured before AI ran. Re-read live highlights under the lock and require every primary/grouped origin to remain present before saving a draft; deleted plain highlights also stay out of planned IDs. Existing exercises are untouched. Guards: enrich skips a draft whose primary/grouped highlight was deleted while AI replied; full AI test file and supplied fake-provider script pass.

Red: ORE_NO_ENRICH=1 bun test packages/core/test/ai.test.ts -t "enrich skips a draft whose"
 0 pass
 54 filtered out
 2 fail
 4 expect() calls
Ran 2 tests across 1 file. [477.00ms]

Green: ORE_NO_ENRICH=1 bun test packages/core/test/ai.test.ts

 56 pass
 0 fail
 317 expect() calls
Ran 56 tests across 1 file. [11.01s]

Typecheck: ORE_NO_ENRICH=1 bun run typecheck
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
```

## EDGES-07

Historical peak was replayed through current membership. Add optional earned_peak to each skills.yaml record and save its maximum under the library lock before filing, filing Undo, suggestion Undo or skill removal drops membership. Home and skill stats take the maximum of this canonical floor and the replayed peak; current counts and review logs are unchanged. The floor survives index deletion and is carried in the canonical skills.yaml, including skill removal/restore. Real iCloud conflict merging was not exercised. No past assignments can be reconstructed for already-moved exercises, so this preserves levels prospectively. Low-level strength now takes an optional floor; the old script omits it, while the regression checks public skillStrength and today. Guard: moving solid exercises keeps the earned level after rebuilding and Undo.

Changed files: `packages/core/src/skills.ts`, `packages/core/src/today.ts`, `packages/core/test/level-filing.test.ts`, `docs/SPEC.md`.

Full commit message:

```text
Preserve earned skill levels when exercises move

Historical peak was replayed through current membership. Add optional earned_peak to each skills.yaml record and save its maximum under the library lock before filing, filing Undo, suggestion Undo or skill removal drops membership. Home and skill stats take the maximum of this canonical floor and the replayed peak; current counts and review logs are unchanged. The floor survives index deletion and is carried in the canonical skills.yaml, including skill removal/restore. Real iCloud conflict merging was not exercised. No past assignments can be reconstructed for already-moved exercises, so this preserves levels prospectively. Low-level strength now takes an optional floor; the old script omits it, while the regression checks public skillStrength and today. Guard: moving solid exercises keeps the earned level after rebuilding and Undo.

Red: ORE_NO_ENRICH=1 bun test packages/core/test/level-filing.test.ts

 0 pass
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [113.00ms]

Green: ORE_NO_ENRICH=1 bun test packages/core/test/level-filing.test.ts packages/core/test/today.test.ts packages/core/test/filing-interruption.test.ts

 52 pass
 0 fail
 176 expect() calls
Ran 52 tests across 3 files. [1.59s]

Typecheck: ORE_NO_ENRICH=1 bun run typecheck
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
```

## EDGES-08

Normal index opening propagated SQLite corruption while explicit reindex could repair it. syncIndex now closes failed connections, repairs only SQLITE_CORRUPT/NOTADB under a separate repair lock, rechecks before discarding, and rebuilds from canonical files. Busy, permission and I/O errors never trigger deletion. A concurrent repair gets an explicit retry/reindex instruction. Guards: search rebuilds a junk/truncated index without changing its source; both supplied corruption scripts pass.

Changed files: `packages/core/src/db.ts`, `packages/core/test/index-recovery.test.ts`.

Full commit message:

```text
Rebuild a damaged search index when opening it

Normal index opening propagated SQLite corruption while explicit reindex could repair it. syncIndex now closes failed connections, repairs only SQLITE_CORRUPT/NOTADB under a separate repair lock, rechecks before discarding, and rebuilds from canonical files. Busy, permission and I/O errors never trigger deletion. A concurrent repair gets an explicit retry/reindex instruction. Guards: search rebuilds a junk/truncated index without changing its source; both supplied corruption scripts pass.

Red: ORE_NO_ENRICH=1 bun test packages/core/test/index-recovery.test.ts
(fail) search rebuilds a truncated index without changing its source [17.24ms]

 0 pass
 2 fail
Ran 2 tests across 1 file. [109.00ms]

Green: ORE_NO_ENRICH=1 bun test packages/core/test/index-recovery.test.ts

 2 pass
 0 fail
 4 expect() calls
Ran 2 tests across 1 file. [118.00ms]

Typecheck: ORE_NO_ENRICH=1 bun run typecheck
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
```

## EDGES-09

The spine silently filtered manifest lookups that returned nothing. Require every spine reference to resolve to a manifest item with a chapter href, or refuse with download/export guidance. Added an original malformed EPUB fixture and its intake/grid guard. No partial source is saved and golden outputs are unchanged. Guard: EPUB: an unresolved spine chapter refuses the whole import with a next step. Focused test passes; full intake/grid/golden run: 180 pass, 1 fail in the unrelated native OCR tall/wide screenshot test (diagnosis below).

Changed files: `packages/core/src/ingest/epub.ts`, `packages/core/test/intake.test.ts`, `packages/core/test/intake-grid.test.ts`, `packages/core/test/fixtures/intake/files/unresolved-spine.epub`, `packages/core/test/fixtures/intake/files/edges-fixtures.md`.

Full commit message:

```text
Refuse EPUB imports with unresolved spine chapters

The spine silently filtered manifest lookups that returned nothing. Require every spine reference to resolve to a manifest item with a chapter href, or refuse with download/export guidance. Added an original malformed EPUB fixture and its intake/grid guard. No partial source is saved and golden outputs are unchanged. Guard: EPUB: an unresolved spine chapter refuses the whole import with a next step. Focused test passes; full intake/grid/golden run: 180 pass, 1 fail in the unrelated native OCR tall/wide screenshot test (diagnosis below).

Red: ORE_NO_ENRICH=1 bun test packages/core/test/intake.test.ts -t "EPUB: an unresolved spine"
 0 pass
 151 filtered out
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [164.00ms]

Green: ORE_NO_ENRICH=1 bun test packages/core/test/intake.test.ts -t "EPUB: an unresolved spine"
 1 pass
 153 filtered out
 0 fail
 3 expect() calls
Ran 1 test across 1 file. [143.00ms]

Typecheck: ORE_NO_ENRICH=1 bun run typecheck
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
```

## EDGES-10

Empty HTML now names the empty file and suggests saving or pasting readable content; Readability parser failures use the normal actionable no-text refusal. Mammoth conversion errors are translated at the Word parser boundary with fresh-copy/export guidance. Added original empty HTML and non-Word ZIP fixtures and intake/grid guards. Neither saves a source; existing golden imports remain unchanged. Guards: an empty HTML file explains how to save readable content; a ZIP named Word explains how to export a valid document. Full intake/grid/golden results are recorded separately; native OCR remains a validation caveat.

Changed files: `packages/core/src/ingest/web.ts`, `packages/core/src/ingest/office.ts`, `packages/core/test/intake.test.ts`, `packages/core/test/intake-grid.test.ts`, `packages/core/test/fixtures/intake/files/empty.html`, `packages/core/test/fixtures/intake/files/not-word.docx`, `packages/core/test/fixtures/intake/files/edges-fixtures.md`.

Full commit message:

```text
Give malformed HTML and Word imports a useful next step

Empty HTML now names the empty file and suggests saving or pasting readable content; Readability parser failures use the normal actionable no-text refusal. Mammoth conversion errors are translated at the Word parser boundary with fresh-copy/export guidance. Added original empty HTML and non-Word ZIP fixtures and intake/grid guards. Neither saves a source; existing golden imports remain unchanged. Guards: an empty HTML file explains how to save readable content; a ZIP named Word explains how to export a valid document. Full intake/grid/golden results are recorded separately; native OCR remains a validation caveat.

Red: ORE_NO_ENRICH=1 bun test packages/core/test/intake.test.ts -t "an empty HTML file|a ZIP named Word"
 0 pass
 152 filtered out
 2 fail
 4 expect() calls
Ran 2 tests across 1 file. [182.00ms]

Green: ORE_NO_ENRICH=1 bun test packages/core/test/intake.test.ts -t "an empty HTML file|a ZIP named Word|a damaged EPUB, Word or PowerPoint"
 3 pass
 151 filtered out
 0 fail
 11 expect() calls
Ran 3 tests across 1 file. [489.00ms]

Typecheck: ORE_NO_ENRICH=1 bun run typecheck
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
```

## EDGES-11

Exclusive creation exposed an empty lock before writing its PID. Write the complete host/PID/token to a unique sibling and hard-link it into place; exclusive publication makes the owner immediately recoverable after a crash. The takeover guard uses the same protocol and cannot expire while live. Release checks ownership; nonblocking snapshots and Doctor use the same guarded stale recovery. The phone has no hard links, so its existing serialized ephemeral filesystem uses synchronous check/rename; its production build passes. Guard: a crash while publishing a lock lets the next save proceed immediately; the updated SIGKILL probe completes the next save in 80 ms.

Changed files: `packages/core/src/lock.ts`, `packages/core/src/doctor.ts`, `packages/core/test/lock.test.ts`.

Full commit message:

```text
Publish populated locks so a crash cannot block the next save

Exclusive creation exposed an empty lock before writing its PID. Write the complete host/PID/token to a unique sibling and hard-link it into place; exclusive publication makes the owner immediately recoverable after a crash. The takeover guard uses the same protocol and cannot expire while live. Release checks ownership; nonblocking snapshots and Doctor use the same guarded stale recovery. The phone has no hard links, so its existing serialized ephemeral filesystem uses synchronous check/rename; its production build passes. Guard: a crash while publishing a lock lets the next save proceed immediately; the updated SIGKILL probe completes the next save in 80 ms.

Red: ORE_NO_ENRICH=1 bun test packages/core/test/lock.test.ts -t "a crash while publishing"
 0 pass
 2 filtered out
 1 fail
 1 expect() calls
Ran 1 test across 1 file. [201.00ms]

Green: ORE_NO_ENRICH=1 bun test packages/core/test/lock.test.ts packages/core/test/foundation.test.ts packages/core/test/history.test.ts

 34 pass
 0 fail
 132 expect() calls
Ran 34 tests across 3 files. [3.18s]

Typecheck: ORE_NO_ENRICH=1 bun run typecheck
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
```

## Reproduction-script adjustments

Every supplied red command ran against this worktree before its fix; none contained a hardcoded deep4 path. Four ignored scripts needed their post-fix checks aligned with the intended behavior: `live-lock.ts` reads the new host/PID record and requires preservation of every *successful* save (the second command now refuses while locked); `history-filing.ts` accepts the previous complete snapshot and confirms the next snapshot commits; `level-move.ts` uses the public `skillStrength` reader, which loads the canonical earned peak; `empty-lock.ts` kills immediately after the new populated hard-link publication rather than an empty exclusive-create that no longer exists. Their green logs are in `codex-out/edges/logs/fix-{02,05,07,11}-script-green.log`. The original red logs are retained separately. The other supplied scripts pass without changes.

## Additional validation finding (for Claude to register)

(a proposed row, not added: the F188 OCR test fails only inside the Codex sandbox and passes on the Mac) — The existing native-only F188 tall/wide screenshot test fails in this sandbox. The unmodified cached helper returns `{"pages":[{"lines":[]}]}`. A temporary copy of the same Swift source, compiled under `/tmp` with only error logging added to its swallowed Vision catch, reports `Error Domain=com.apple.Vision Code=8 "Failed to create CVPixelBuffer"` for each tile. Evidence: `codex-out/edges/logs/ocr-native-diagnostic.log`. This establishes a native Vision failure here, not a flaky assertion or an EPUB/Word regression; no claim that it reproduces outside the sandbox. No production OCR code or test was changed, skipped, retried or loosened. The registry was left untouched as instructed. The Word parser's existing damaged-ZIP message initially regressed during development; it was restored and its focused regression passes alongside both new refusal tests.

## Final checks and handoff commit

All 11 draft fixes and their guards are present. No product decision was deferred. No real AI, browser, server, e2e or benchmark ran. Every Ore invocation used ORE_NO_ENRICH=1. The phone production build validates the shared core and filesystem fallback; no native simulator or real-device/iCloud run was performed. Golden imports passed without snapshot updates. `git diff --check` passed. The full suite was run once; its sole failure is the diagnosed native Vision problem above. No commit or push was possible because the worktree Git metadata is outside the sandbox.

Changed files for the final handoff commit: `FIX-NOTES.md`.

Full commit message:

```text
Document edge fixes and validation for review

Record EDGES-01 through EDGES-11, exact per-finding file lists,
red/green evidence, reproduction adjustments and the native OCR limitation.

Full suite: ORE_NO_ENRICH=1 bun test

 1796 pass
 1 fail
 10059269 expect() calls
Ran 1797 tests across 241 files. [108.87s]

Typecheck: ORE_NO_ENRICH=1 bun run typecheck
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit

Phone build: ORE_NO_ENRICH=1 ORE_PHONE=1 bun run --cwd apps/desktop build
Exit 0; built in 883 ms. Existing chunk-size and dynamic-import warnings.

Whitespace: git diff --check
Exit 0; no output.
```
