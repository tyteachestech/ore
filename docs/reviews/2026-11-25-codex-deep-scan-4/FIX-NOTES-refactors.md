# Deep scan 4 refactor fixes

All changes are uncommitted. `git add` failed before a commit could be made: `fatal: Unable to create /Users/tylerpoelking/Developer/ore/.git/worktrees/deep4-fix-refactors/index.lock: Operation not permitted`. No push or merge was attempted. Apply findings in R01–R09 order; overlapping files contain changes for several findings. Each section gives the exact source/test files and complete proposed commit message. Keep this handoff file for the final documentation commit. Logs and original-script evidence are in the gitignored `codex-out/fix-refactors/` folder. All test and CLI commands used `ORE_NO_ENRICH=1`. No browser, e2e or benchmark run was started.

## R01

The review session forgot its own step while History was already moving it to Redo; queued Undo exposed the timing error. Remove that redundant forget instead of weakening identity-based History.forget (failed writes still need it). Covers main Review, quick quiz and the shared phone session. Guard: two Undos held during review saving can both be redone in the same session. Original CLI script also passes. Full-file tests and `bun run typecheck` passed. Exact changed files: `apps/desktop/src/review-session.ts`, `apps/desktop/test/review-session.test.ts`.

Full commit message:

```text
Keep both ratings available for Redo after held Undo

The review session forgot its own step while History was already moving it to Redo; queued Undo exposed the timing error. Remove that redundant forget instead of weakening identity-based History.forget (failed writes still need it). Covers main Review, quick quiz and the shared phone session. Guard: two Undos held during review saving can both be redone in the same session. Original CLI script also passes.

Red: ORE_NO_ENRICH=1 bun test apps/desktop/test/review-session.test.ts -t 'two Undos held'
 0 pass
 22 filtered out
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [237.00ms]

Green: ORE_NO_ENRICH=1 bun test apps/desktop/test/review-session.test.ts -t 'two Undos held'
 1 pass
 22 filtered out
 0 fail
 5 expect() calls
Ran 1 test across 1 file. [139.00ms]
```

## R02

Once review removal commits, clear the end receipt and update the queue, counts and history even if reopening fails. Report that failure without restoring a nonexistent rating step. Before a later rating or Redo, retry reopening the closed session, preserving its session ID. Guard: end-screen Undo stays removed when reopening fails and can be redone after recovery. Original CLI script also passes. Full-file tests and `bun run typecheck` passed. Exact changed files: `apps/desktop/src/review-session.ts`, `apps/desktop/test/review-session.test.ts`.

Full commit message:

```text
Keep review Undo consistent when session reopening fails

Once review removal commits, clear the end receipt and update the queue, counts and history even if reopening fails. Report that failure without restoring a nonexistent rating step. Before a later rating or Redo, retry reopening the closed session, preserving its session ID. Guard: end-screen Undo stays removed when reopening fails and can be redone after recovery. Original CLI script also passes.

Red: ORE_NO_ENRICH=1 bun test apps/desktop/test/review-session.test.ts -t 'end-screen Undo stays'
 0 pass
 23 filtered out
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [135.00ms]

Green: ORE_NO_ENRICH=1 bun test apps/desktop/test/review-session.test.ts -t 'end-screen Undo stays'
 1 pass
 23 filtered out
 0 fail
 8 expect() calls
Ran 1 test across 1 file. [172.00ms]
```

## R03

Put note edits on history when typed and hold the step for its write, including stand-in highlight creation. Failed writes forget that exact step. This preserves action order instead of relying on write completion order. Guard: Undo after removing a highlight restores it with the note that was still saving. Updated the prior retry test to assert the new immediate held-step contract and failed-step removal; kept its recovery assertions. Original CLI script also passes. Full-file tests and `bun run typecheck` passed. Exact changed files: `apps/desktop/src/highlights.ts`, `apps/desktop/test/highlights.test.ts`.

Full commit message:

```text
Register a highlight note before a later removal

Put note edits on history when typed and hold the step for its write, including stand-in highlight creation. Failed writes forget that exact step. This preserves action order instead of relying on write completion order. Guard: Undo after removing a highlight restores it with the note that was still saving. Updated the prior retry test to assert the new immediate held-step contract and failed-step removal; kept its recovery assertions. Original CLI script also passes.

Red: ORE_NO_ENRICH=1 bun test apps/desktop/test/highlights.test.ts -t 'Undo after removing'
 0 pass
 29 filtered out
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [65.00ms]

Green: ORE_NO_ENRICH=1 bun test apps/desktop/test/highlights.test.ts -t 'Undo after removing'
 1 pass
 29 filtered out
 0 fail
 4 expect() calls
Ran 1 test across 1 file. [58.00ms]
```

## R04

Extend the shared inOrder queue to reserve all touched keys atomically. Batches and course archives now use every source ID, so single changes wait both ahead of and behind overlapping batches; unrelated keys remain independent. Guard: a later move of one source waits for an older batch touching that source. Original CLI script passes after releasing its first-write gate independently of the later write (the old harness waited on that later write before release, which deadlocks when ordering is correct). Full-file tests and `bun run typecheck` passed. Exact changed files: `apps/desktop/src/util.ts`, `apps/desktop/src/change.ts`, `apps/desktop/src/list-actions.ts`, `apps/desktop/test/list-actions.test.tsx`.

Full commit message:

```text
Order batch source writes with edits to every member

Extend the shared inOrder queue to reserve all touched keys atomically. Batches and course archives now use every source ID, so single changes wait both ahead of and behind overlapping batches; unrelated keys remain independent. Guard: a later move of one source waits for an older batch touching that source. Original CLI script passes after releasing its first-write gate independently of the later write (the old harness waited on that later write before release, which deadlocks when ordering is correct).

Red: ORE_NO_ENRICH=1 bun test apps/desktop/test/list-actions.test.tsx -t 'a later move'
 0 pass
 12 filtered out
 1 fail
 1 expect() calls
Ran 1 test across 1 file. [168.00ms]

Green: ORE_NO_ENRICH=1 bun test apps/desktop/test/list-actions.test.tsx -t 'a later move'
 1 pass
 12 filtered out
 0 fail
 3 expect() calls
Ran 1 test across 1 file. [171.00ms]
```

## R05

Add valueChange in change.ts: overlapping edits share their last successful field value until the writes settle; each inverse is rebased when its queued write starts. Only the latest edit may roll back its display. State is scoped to the window history and discarded when idle, so it cannot override a later external refresh. Migrated source title and importance, skill priority/archive, sidebar layout and collections, skill name/editor icon/colour/collection, badge and skill goal. Guards cover the reported importance failure, overlapping controls/fields, a held Undo with two failed saves, successful predecessors and external idle updates. Original importance CLI script passes. Partial skill-setting patches also rebase untouched fields onto the saved predecessor, so archiving after a failed importance edit does not save that failed choice; its regression passed red then green. Full-file tests and `bun run typecheck` passed. Exact changed files: `apps/desktop/src/change.ts`, `apps/desktop/src/list-actions.ts`, `apps/desktop/src/Skills.tsx`, `apps/desktop/src/SkillPage.tsx`, `apps/desktop/test/change.test.tsx`, `apps/desktop/test/list-actions.test.tsx`.

Full commit message:

```text
Undo field edits to the last value that actually saved

Add valueChange in change.ts: overlapping edits share their last successful field value until the writes settle; each inverse is rebased when its queued write starts. Only the latest edit may roll back its display. State is scoped to the window history and discarded when idle, so it cannot override a later external refresh. Migrated source title and importance, skill priority/archive, sidebar layout and collections, skill name/editor icon/colour/collection, badge and skill goal. Guards cover the reported importance failure, overlapping controls/fields, a held Undo with two failed saves, successful predecessors and external idle updates. Original importance CLI script passes. Partial skill-setting patches also rebase untouched fields onto the saved predecessor, so archiving after a failed importance edit does not save that failed choice; its regression passed red then green.

Red: ORE_NO_ENRICH=1 bun test apps/desktop/test/list-actions.test.tsx -t 'Undo of importance'
 0 pass
 13 filtered out
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [148.00ms]

Green: ORE_NO_ENRICH=1 bun test apps/desktop/test/list-actions.test.tsx -t 'Undo of importance'
 1 pass
 13 filtered out
 0 fail
 6 expect() calls
Ran 1 test across 1 file. [144.00ms]

Additional guard: archiving a skill after its failed importance edit does not save that failed importance

Red: ORE_NO_ENRICH=1 bun test apps/desktop/test/list-actions.test.tsx -t 'archiving a skill after'
 0 pass
 15 filtered out
 1 fail
 1 expect() calls
Ran 1 test across 1 file. [223.00ms]

Green: ORE_NO_ENRICH=1 bun test apps/desktop/test/list-actions.test.tsx -t 'archiving a skill after'
 1 pass
 15 filtered out
 0 fail
 5 expect() calls
Ran 1 test across 1 file. [208.00ms]

```

## R06

Track ownership separately for highlight type and note edits, including Undo/Redo. A failure restores only the field version it still owns; a superseded note failure neither stores an obsolete draft nor claims it did. Transfer edit versions from stand-in IDs to saved IDs. Guards: a failed earlier highlight intent/note edit leaves the newer successful edit visible; repeated same-value choices and a pending-to-saved-ID overlap. Both original CLI scripts pass. Full-file tests and `bun run typecheck` passed. Exact changed files: `apps/desktop/src/highlights.ts`, `apps/desktop/test/highlights.test.ts`.

Full commit message:

```text
Keep newer highlight edits visible after an older write fails

Track ownership separately for highlight type and note edits, including Undo/Redo. A failure restores only the field version it still owns; a superseded note failure neither stores an obsolete draft nor claims it did. Transfer edit versions from stand-in IDs to saved IDs. Guards: a failed earlier highlight intent/note edit leaves the newer successful edit visible; repeated same-value choices and a pending-to-saved-ID overlap. Both original CLI scripts pass.

Red: ORE_NO_ENRICH=1 bun test apps/desktop/test/highlights.test.ts -t 'a failed earlier highlight'
 0 pass
 30 filtered out
 2 fail
 2 expect() calls
Ran 2 tests across 1 file. [61.00ms]

Green: ORE_NO_ENRICH=1 bun test apps/desktop/test/highlights.test.ts -t 'a failed earlier highlight'
 2 pass
 30 filtered out
 0 fail
 4 expect() calls
Ran 2 tests across 1 file. [64.00ms]
```

## R07

Each successful source filing now registers its share of the skill revival. Its inverse removes that share; the last completed filing undone rearchives the skill. This runs during partial-batch compensation as well as normal Undo, instead of depending on an unreachable final callback. The source inverse and rearchive also run through allOrNone so a refused rearchive compensates that source edit. Guard: a failed batch filing puts its revived skill back in Archive with no Undo left. Original CLI script and successful batch Undo tests pass. Full-file tests and `bun run typecheck` passed. Exact changed files: `apps/desktop/src/list-actions.ts`, `apps/desktop/test/list-actions.test.tsx`.

Full commit message:

```text
Rearchive skills revived by a failed batch filing

Each successful source filing now registers its share of the skill revival. Its inverse removes that share; the last completed filing undone rearchives the skill. This runs during partial-batch compensation as well as normal Undo, instead of depending on an unreachable final callback. The source inverse and rearchive also run through allOrNone so a refused rearchive compensates that source edit. Guard: a failed batch filing puts its revived skill back in Archive with no Undo left. Original CLI script and successful batch Undo tests pass.

Red: ORE_NO_ENRICH=1 bun test apps/desktop/test/list-actions.test.tsx -t 'a failed batch filing'
 0 pass
 14 filtered out
 1 fail
 3 expect() calls
Ran 1 test across 1 file. [173.00ms]

Green: ORE_NO_ENRICH=1 bun test apps/desktop/test/list-actions.test.tsx -t 'a failed batch filing'
 1 pass
 14 filtered out
 0 fail
 5 expect() calls
Ran 1 test across 1 file. [164.00ms]
```

## R08

The shared read guard now snapshots outstanding writes at read start as well as write generations. Reader uses its field guard for source reads and enrichment polling, and registers filing writes at request time through change.out, including queued Undo. List reads use the same stronger rule. Updated tests that intentionally allowed reads inside pending writes to require preservation instead. Guard: a source read begun during a queued skill Undo cannot put the removed skill back. The original picker script requires a browser, so it was not run under fix-common.md; the timing is reproduced headlessly at the shared production guard. Full-file tests and `bun run typecheck` passed. Exact changed files: `apps/desktop/src/reads.ts`, `apps/desktop/src/Reader.tsx`, `apps/desktop/test/reads.test.ts`.

Full commit message:

```text
Preserve optimistic skills in reads begun during filing

The shared read guard now snapshots outstanding writes at read start as well as write generations. Reader uses its field guard for source reads and enrichment polling, and registers filing writes at request time through change.out, including queued Undo. List reads use the same stronger rule. Updated tests that intentionally allowed reads inside pending writes to require preservation instead. Guard: a source read begun during a queued skill Undo cannot put the removed skill back. The original picker script requires a browser, so it was not run under fix-common.md; the timing is reproduced headlessly at the shared production guard.

Red: ORE_NO_ENRICH=1 bun test apps/desktop/test/reads.test.ts -t 'a source read begun'
 0 pass
 4 filtered out
 1 fail
 1 expect() calls
Ran 1 test across 1 file. [49.00ms]

Green: ORE_NO_ENRICH=1 bun test apps/desktop/test/reads.test.ts -t 'a source read begun'
 1 pass
 5 filtered out
 0 fail
 3 expect() calls
Ran 1 test across 1 file. [46.00ms]
```

## R09

Extract Feed read actions into a headless module and limit each change to posts whose state differs from the requested state. The inverse therefore restores each affected post to its own prior state, leaving already-read or already-unread posts alone. Overlapping selections share post keys; a no-op adds no write or history step. Guards: Undo of Mark read/unread restores each selected post’s own state, no-op selections and homogeneous selections. Original mixed-selection CLI script passes (its extracted callback imports the new production helper). Full-file tests and `bun run typecheck` passed. Exact changed files: `apps/desktop/src/Feed.tsx`, `apps/desktop/src/feed-actions.ts`, `apps/desktop/test/feed-actions.test.ts`.

Full commit message:

```text
Undo Feed read changes without changing already-read posts

Extract Feed read actions into a headless module and limit each change to posts whose state differs from the requested state. The inverse therefore restores each affected post to its own prior state, leaving already-read or already-unread posts alone. Overlapping selections share post keys; a no-op adds no write or history step. Guards: Undo of Mark read/unread restores each selected post’s own state, no-op selections and homogeneous selections. Original mixed-selection CLI script passes (its extracted callback imports the new production helper).

Red: ORE_NO_ENRICH=1 bun test apps/desktop/test/feed-actions.test.ts -t 'restores each selected'

 0 pass
 2 fail
 4 expect() calls
Ran 2 tests across 1 file. [50.00ms]

Green: ORE_NO_ENRICH=1 bun test apps/desktop/test/feed-actions.test.ts -t 'restores each selected'
 2 pass
 2 filtered out
 0 fail
 8 expect() calls
Ran 2 tests across 1 file. [58.00ms]
```

## Final validation and handoff

Ran the required whole-repository suite once. It exited 1: 1,789 passed and two failed. The naming scanner mistook the CLI `cards` argument inside the new batch inverse block for JSX text; moving that existing argument construction to a named local variable fixed it without changing the command or loosening the test. The subsequent complete naming/source-action files passed (18 tests), and typecheck passed. The remaining failure is the native macOS Vision test at `packages/core/test/intake.test.ts:1327`, F188: “a very tall or very wide screenshot is read whole, each line once”; `packages/core/src/ingest/ocr.ts:68` refused its result with “Found no text in that image.” Those core files and their fixtures are unchanged. Its cause is unconfirmed; it was neither retried nor skipped. No findings or decisions file was edited, per fix-common.md. The draft is not a green-suite or merge-ready claim; Claude should review the fixes and resolve/verify that native OCR failure before merge.

Whole-suite command and last lines:

```text
ORE_NO_ENRICH=1 bun test

2 tests failed:
(fail) nothing the app shows says card: it is an exercise (D181) [21.48ms]
(fail) import coverage: text recognition > a very tall or very wide screenshot is read whole, each line once (F188) [96.69ms]

 1789 pass
 2 fail
 10059276 expect() calls
Ran 1791 tests across 236 files. [100.30s]
```

Post-correction checks:

```text
ORE_NO_ENRICH=1 bun test apps/desktop/test/names.test.ts apps/desktop/test/list-actions.test.tsx

 18 pass
 0 fail
 85 expect() calls
Ran 18 tests across 2 files. [295.00ms]

bun run typecheck
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
```

`git diff --check` passed. The final documentation commit changes only `FIX-NOTES.md`; proposed full message:

```text
Document deep scan 4 refactor fixes and sandbox handoff

Record R01–R09 causes, regression guards, exact files and per-finding commit messages with red/green output. Git staging was denied by the sandbox, so all changes remain uncommitted. The whole suite ran once: 1,789 passed, two failed. The naming failure was corrected and both affected test files passed (18 tests); native macOS OCR F188 remains unresolved in untouched code. Typecheck and diff checks pass. No browser, e2e, benchmark, push or merge was run.

Whole run: ORE_NO_ENRICH=1 bun test

2 tests failed:
(fail) nothing the app shows says card: it is an exercise (D181) [21.48ms]
(fail) import coverage: text recognition > a very tall or very wide screenshot is read whole, each line once (F188) [96.69ms]

 1789 pass
 2 fail
 10059276 expect() calls
Ran 1791 tests across 236 files. [100.30s]

After naming correction: ORE_NO_ENRICH=1 bun test apps/desktop/test/names.test.ts apps/desktop/test/list-actions.test.tsx

 18 pass
 0 fail
 85 expect() calls
Ran 18 tests across 2 files. [295.00ms]
```
