# Deep scan 5 — perf fix notes (unreviewed draft)

Baseline: `db8d078` (`Codex draft fixes: keys (unreviewed)`), the clean worktree supplied for this task. Bun 1.4.4. The report tested an older commit; the reproductions below ran against this worktree before the affected production code changed.

| Finding | Disposition |
| --- | --- |
| PERF-01 | Fixed: readiness shares source reads; ineligible Dig checks read no source text. |
| PERF-02 | Fixed: filing's three explicit exercise collections become one. Skipped: the report's zero-unrelated-reads requirement for a cold exercise lookup; see compatibility limits below. This finding is **not fully resolved**. |
| PERF-03 | Fixed: filter folder names before document-existence probes. |
| F293 (known issue profile) | Fixed the reproduced directory-enumeration cause in the phone filesystem; no claim that every phone pause is resolved. |
| F294 (known issue profile) | Skipped: its red script requires a browser; removing rereads also changes the existing reconciliation contract. |

No existing tracked test, findings ledger, decision, intake fixture, or golden was edited. `doc.md` output is unchanged, so `golden:update` was not run. No commit or push was attempted. No browser, app, e2e, bench, or interactive server was started. The required test suite contains HTTP-server fixtures; the sandbox refuses their listening sockets.

The report's red scripts were moved after authoring and still import `../../packages` and `../../apps`. For reproduction only, copies of `red.ts`, `probe.ts`, `minimal-cases.ts`, and `phone-directory-red.ts` were placed in a temporary `codex-out/perf/` folder and those import prefixes were replaced with absolute paths to this worktree. No assertions were changed. `minimal-cases.ts` created private scratch libraries there; Tyler's library was not used. The `probe.ts` scratch-library guard remained intact.

## PERF-01 — fixed

Changed files:
- `packages/core/src/tries.ts`
- `packages/core/src/digs.ts`
- `packages/core/test/readiness-reads.test.ts`
- `packages/core/test/helpers/read-probe.ts` (isolated child-process filesystem instrumentation, also used below)

New tests in `packages/core/test/readiness-reads.test.ts`:
- `trying now reads each source and its highlights once across skills, keeping one shared active try`
- `dig readiness shares one source read across eligible skills`
- `dig readiness reads no source text when no skill has a goal`
- `trying now keeps the containing source's skill membership for hand-edited annotation references`

Master reproduction: `ORE_NO_ENRICH=1 bun <repro>/red.ts tries readiness-two` and `... dig readiness-two`, both exit 1:

```text
[DEEP] {"mode":"tries","size":"readiness-two","sources":1,"cards":0,"command":["tries","--now"],"ms":2.712333000000001,"reads":2,"cardReads":0,"unrelatedCardReads":0,"unrelatedDocChecks":0,"documentChecks":2,"io":{"existsSync":10,"readFileSync":3,"readdirSync":5},"subprocess":[]}
FAIL: one readiness lookup rereads every source once per skill
```

```text
[DEEP] {"mode":"dig","size":"readiness-two","sources":1,"cards":0,"command":["dig","--ready"],"ms":2.985416999999998,"reads":2,"cardReads":0,"unrelatedCardReads":0,"unrelatedDocChecks":0,"documentChecks":2,"io":{"existsSync":12,"readFileSync":5,"readdirSync":5},"subprocess":[]}
FAIL: one readiness lookup rereads every source once per skill
```

Test-first red: both single-read budgets received 9 reads (the default library has 9 skills); the no-goal budget expected 0 and received 9. Last lines:

```text

 0 pass
 3 fail
 12 expect() calls
Ran 3 tests across 1 file. [219.00ms]
```

The extra compatibility guard caught an initial draft relying on the annotation's `item` field instead of its containing source. It failed before that draft was corrected; no file data was rewritten:

```text
      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/deep5-fix-perf/packages/core/test/readiness-reads.test.ts:58:26)
(fail) trying now keeps the containing source's skill membership for hand-edited annotation references [25.16ms]

 3 pass
 1 fail
 15 expect() calls
Ran 4 tests across 1 file. [288.00ms]
```

Green:

```text
packages/core/test/readiness-reads.test.ts:
(pass) trying now reads each source and its highlights once across skills, keeping one shared active try [70.59ms]
(pass) dig readiness shares one source read across eligible skills [59.66ms]
(pass) dig readiness reads no source text when no skill has a goal [48.10ms]
(pass) trying now keeps the containing source's skill membership for hand-edited annotation references [24.86ms]

 4 pass
 0 fail
 15 expect() calls
Ran 4 tests across 1 file. [230.00ms]
```

```text
[DEEP] {"mode":"tries","size":"readiness-two","sources":1,"cards":0,"command":["tries","--now"],"ms":2.586083000000002,"reads":1,"cardReads":0,"unrelatedCardReads":0,"unrelatedDocChecks":0,"documentChecks":1,"io":{"existsSync":6,"readFileSync":2,"readdirSync":3},"subprocess":[]}
PASS / observation only
```

```text
[DEEP] {"mode":"dig","size":"readiness-two","sources":1,"cards":0,"command":["dig","--ready"],"ms":1.8900000000000006,"reads":0,"cardReads":0,"unrelatedCardReads":0,"unrelatedDocChecks":0,"documentChecks":0,"io":{"existsSync":3,"readFileSync":1},"subprocess":[]}
PASS / observation only
```

Existing coverage: `bun test packages/core/test/tries.test.ts` — 12 pass / 0 fail; `bun test packages/core/test/digs.test.ts` — 3 pass / 0 fail. AI/Dig/tutor callers also ran in the individual-file checks below. D322/D324/D325 selection, ordering, deduplication, readiness gaps and global rest period stay unchanged.

Durable fix: the owner modules collect source data once per lookup; goal/history readiness is separate from reading source text, with no cross-command cache to become stale.

## PERF-02 — filing repetition fixed; cold lookup requirement skipped

Changed files:
- `packages/core/src/skills.ts`
- `packages/cli/src/cmd-items.ts`
- `packages/core/test/filing-reads.test.ts`
- shared test helper listed above

New tests in `packages/core/test/filing-reads.test.ts`:
- `filing collects exercises once for Undo and updates, including normally named files`
- `filing collects exercises once for Undo and updates, including renamed files`

Both exercise normal/copy or renamed filenames, a hand-edited skill membership, the CLI's returned `cards_before`, restoring that snapshot, and an unchanged unrelated file. The selected file still gets a second targeted read by `writeCardMeta` to retain its raw body; the budget is one collection read plus that existing write read. No existing test expectation was changed.

Master reproduction: `ORE_NO_ENRICH=1 bun <repro>/red.ts cards two-two` and `... file two-two`, both exit 1:

```text
[DEEP] {"mode":"cards","size":"two-two","sources":2,"cards":2,"command":["cards","--item","01M88KRAKNH254Q35TCRXEKBCF"],"ms":1.5450830000000053,"reads":0,"cardReads":2,"unrelatedCardReads":1,"unrelatedDocChecks":0,"documentChecks":0,"io":{"existsSync":5,"readdirSync":2,"readFileSync":2},"subprocess":[]}
FAIL: one source exercise list reads unrelated exercise files
```

```text
[DEEP] {"mode":"file","size":"two-two","sources":2,"cards":2,"command":["edit","01M88KRAKNH254Q35TCRXEKBCF","--skills=learning"],"ms":26.381500000000003,"reads":5,"cardReads":9,"unrelatedCardReads":4,"unrelatedDocChecks":4,"documentChecks":8,"io":{"existsSync":44,"readdirSync":18,"readFileSync":22,"mkdirSync":4,"writeFileSync":3,"unlinkSync":2,"statSync":5,"renameSync":2},"subprocess":[]}
FAIL: one source exercise list reads unrelated exercise files
```

Test-first red: the unrelated exercise was read 3 times instead of once. Last lines:

```text

 0 pass
 2 fail
 8 expect() calls
Ran 2 tests across 1 file. [189.00ms]
```

Green for the redundant filing passes:

```text
packages/core/test/filing-reads.test.ts:
(pass) filing collects exercises once for Undo and updates, including normally named files [122.43ms]
(pass) filing collects exercises once for Undo and updates, including renamed files [89.58ms]

 2 pass
 0 fail
 14 expect() calls
Ran 2 tests across 1 file. [271.00ms]
```

The original report assertion still fails, intentionally disclosed:

```text
[DEEP] {"mode":"file","size":"two-two","sources":2,"cards":2,"command":["edit","01M88KRAKNH254Q35TCRXEKBCF","--skills=learning"],"ms":28.082042,"reads":4,"cardReads":4,"unrelatedCardReads":1,"unrelatedDocChecks":1,"documentChecks":5,"io":{"existsSync":37,"readdirSync":16,"readFileSync":16,"mkdirSync":4,"writeFileSync":3,"unlinkSync":2,"statSync":5,"renameSync":2},"subprocess":[]}
FAIL: one source exercise list reads unrelated exercise files
```

**Why the cold lookup portion is skipped:** a file's source membership exists inside its frontmatter, not in its filename. A fresh command without a current index cannot know that membership without reading it. Direct edits can change membership, and `listCards` accepts hand-renamed `.md` files and chooses among copies. Substituting the present SQLite card rows would lose valid existing entries: `db.ts` only scans canonical 26-character exercise filenames. Trusting an unsynchronized index would miss hand edits. The report's absolute zero-unrelated-read assertion therefore cannot be a cold-read contract for the current format without changing these behaviors or designing a compatible, freshness-checked lookup cache. Neither shortcut was taken. `cards --item` remains unchanged. Warm indexed selection remains follow-up work, not a claimed fix.

`fileItemSkills` now captures Undo membership and reuses the same exercises for peak preservation and writes, under one library lock. `setItemSkills` retains its existing return shape as a wrapper; the shared CLI uses the snapshot-returning operation. Peak preservation (D63), per-exercise skill differences, atomic file replacements and source-last retry ordering remain intact. Index work needed to preserve peaks is not suppressed.

Existing coverage: `edit-source` 5/0, `ai` 56/0, `importance` 11/0, `filing-interruption` 2/0, `level-filing` 1/0, and app `list-actions` 17/0 (pass/fail); additional skills callers are listed below.

Durable fix for the fixed portion: one core operation owns the filing and its inverse snapshot, so the CLI cannot independently collect a second Undo list or repeat the update collection. The first necessary discovery pass is retained.

## PERF-03 — fixed

Changed files:
- `packages/core/src/items.ts`
- `packages/core/test/item-lookup-reads.test.ts`
- shared test helper listed above

New tests in `packages/core/test/item-lookup-reads.test.ts`:
- `notes lookup checks only matching source documents`
- `directory lookup checks only matching source documents`
- `filtered lookup keeps copy selection, prefix ambiguity, empty folders and renamed fallbacks`

Master reproduction: `ORE_NO_ENRICH=1 bun <repro>/red.ts note lookup-two`, exit 1:

```text
[DEEP] {"mode":"note","size":"lookup-two","sources":2,"cards":0,"command":["notes","01M88KRAS2F1RHYGQR4FPMXEKA","--set=Bounded save"],"ms":3.154332999999994,"reads":2,"cardReads":0,"unrelatedCardReads":0,"unrelatedDocChecks":2,"documentChecks":4,"io":{"existsSync":12,"mkdirSync":2,"writeFileSync":2,"unlinkSync":2,"readdirSync":4,"readFileSync":3,"renameSync":1},"subprocess":[]}
FAIL: one source operation probes every source document
```

Test-first red: the note command probed the unrelated document twice; directory lookup probed it once. Last lines:

```text

 1 pass
 2 fail
 13 expect() calls
Ran 3 tests across 1 file. [186.00ms]
```

Green:

```text
packages/core/test/item-lookup-reads.test.ts:
(pass) notes lookup checks only matching source documents [82.44ms]
(pass) directory lookup checks only matching source documents [38.24ms]
(pass) filtered lookup keeps copy selection, prefix ambiguity, empty folders and renamed fallbacks [18.90ms]

 3 pass
 0 fail
 17 expect() calls
Ran 3 tests across 1 file. [174.00ms]
```

```text
[DEEP] {"mode":"note","size":"lookup-two","sources":2,"cards":0,"command":["notes","01M88KRAS2F1RHYGQR4FPMXEKA","--set=Bounded save"],"ms":3.5560000000000116,"reads":2,"cardReads":0,"unrelatedCardReads":0,"unrelatedDocChecks":0,"documentChecks":2,"io":{"existsSync":10,"mkdirSync":2,"writeFileSync":2,"unlinkSync":2,"readdirSync":4,"readFileSync":4,"renameSync":1},"subprocess":[]}
PASS / observation only
```

The optimization is deliberately narrower than an ID-to-path cache: folder names are still enumerated, preserving prefix/suffix ambiguity and copy selection. Only matching folders have their `doc.md` checked. When no named match exists, renamed folders are still read by their embedded IDs. `itemDirs` and whole-library listings keep their original behavior. No year is guessed from an ID and no valid folder is ignored.

Existing coverage includes notes, archive, source editing, CLI contract, Finder files, damaged libraries (25/0), annotations, review/study, import, reimport and other callers in the table below. The CLI-server and native-OCR failures are recorded rather than retried or modified.

Durable fix: both source-content and source-directory lookup share candidate enumeration and filter before filesystem probes, in core used by both devices.

## F293 — directory-enumeration cause fixed (known issue profile)

Changed files:
- `apps/desktop/src/phone/fs.ts`
- `apps/desktop/test/phone-directory-reads.test.ts`

New tests in `apps/desktop/test/phone-directory-reads.test.ts`:
- `listing one phone directory never inspects unrelated paths`
- `phone directory listings track atomic replacement, copies, removal and recreation`

Master reproduction: `bun <repro>/phone-directory-red.ts 1`, exit 1:

```text
[DEEP] {"unrelatedSources":1,"oneDirectoryMs":0.11650000000000205,"unrelatedChecks":2,"result":["note.md"]}
FAIL: listing one directory inspects every unrelated source file and folder
```

Test-first red: listing the target inspected 40 unrelated file/folder paths. Last lines:

```text
(fail) listing one phone directory never inspects unrelated paths [1.38ms]
(pass) phone directory listings track atomic replacement, copies, removal and recreation [0.22ms]

 1 pass
 1 fail
 7 expect() calls
Ran 2 tests across 1 file. [18.00ms]
```

Green:

```text
apps/desktop/test/phone-directory-reads.test.ts:
(pass) listing one phone directory never inspects unrelated paths [0.53ms]
(pass) phone directory listings track atomic replacement, copies, removal and recreation [0.16ms]

 2 pass
 0 fail
 7 expect() calls
Ran 2 tests across 1 file. [11.00ms]
```

```text
[DEEP] {"unrelatedSources":1,"oneDirectoryMs":0.08449999999999847,"unrelatedChecks":0,"result":["note.md"]}
PASS
```

The filesystem now maintains each directory's immediate children at the same points it changes file/folder membership. Snapshot hydration, IndexedDB overlays/tombstones, disk reads/rescans, unloaded originals, local writes, copy/rename, unlink, recursive remove and directory pruning all update that listing. File contents, persistence order and sync policy stay unchanged. This belongs in the phone's filesystem adapter, not in duplicate screen logic.

Existing coverage: `phone-fs.test.ts` 10/0, `phone-shims.test.ts` 6/0, `phone-icloud.test.ts` 14/0. These cover local filesystem operations and native-bridge sync with a fake folder, including remote deletion and unloaded originals.

The [iOS check](.claude/skills/ios-check/SKILL.md) says: “Check it at 390 pt with touch (Playwright `hasTouch`) and in the iOS simulator before calling it done.” The user's explicit no-browser/no-app restriction takes precedence: neither was run. This is an unreviewed filesystem draft with headless evidence, not a verified native release-phone performance claim.

Durable fix: directory enumeration is bounded by that directory's children; global path scans cannot recur through `readdirSync`, regardless of which core caller uses it.

## F294 — skipped (known issue profile)

No changed files or new test. The supplied `mac-profile.cjs ... --red` drives a browser and was not run, so this is **not newly reproduced dynamically at this master**. Static inspection confirms the reported chain remains: `App.tsx`'s `listChange` settles through `refresh`, which requests both `ls` and `ls --archived`.

The root agreement describes `change.ts` as showing the change, ordering writes, reverting on failure and reading again; `change.ts` explicitly calls for rereading after the newest write settles. Removing that reread or replacing it with a screen-local patch changes reconciliation after edits/Undo and external library changes. A shared incremental-refresh design would need its own behavioral agreement and tests. No refresh was simply removed to make a request-count assertion pass.

## Individual-file coverage

Each listed test file ran alone (`bun test <file>`), sequentially. Results below retain failures. The new regression files are included for completeness; the latest readiness run is shown in PERF-01 above.

| File | Pass | Fail |
| --- | ---: | ---: |
| `apps/desktop/test/seed-demo.test.ts` | 5 | 0 |
| `packages/core/test/ai-vendor-regressions.test.ts` | 22 | 0 |
| `packages/core/test/ai.test.ts` | 56 | 0 |
| `packages/core/test/annotations.test.ts` | 14 | 0 |
| `packages/core/test/archive.test.ts` | 16 | 0 |
| `packages/core/test/arrange.test.ts` | 5 | 0 |
| `packages/core/test/ask-library.test.ts` | 14 | 0 |
| `packages/core/test/catchup.test.ts` | 4 | 0 |
| `packages/core/test/cli-contract.test.ts` | 10 | 1 |
| `packages/core/test/courses.test.ts` | 10 | 0 |
| `packages/core/test/cut.test.ts` | 8 | 0 |
| `packages/core/test/damaged-library.test.ts` | 25 | 0 |
| `packages/core/test/digs.test.ts` | 3 | 0 |
| `packages/core/test/edit-source.test.ts` | 5 | 0 |
| `packages/core/test/eval-ask.test.ts` | 8 | 0 |
| `packages/core/test/eval-questions.test.ts` | 6 | 0 |
| `packages/core/test/feeds.test.ts` | 24 | 0 |
| `packages/core/test/figure.test.ts` | 3 | 0 |
| `packages/core/test/filing-interruption.test.ts` | 2 | 0 |
| `packages/core/test/filing-reads.test.ts` | 2 | 0 |
| `packages/core/test/finder-files.test.ts` | 1 | 0 |
| `packages/core/test/finish.test.ts` | 5 | 0 |
| `packages/core/test/foundation.test.ts` | 25 | 0 |
| `packages/core/test/history.test.ts` | 6 | 0 |
| `packages/core/test/importance.test.ts` | 11 | 0 |
| `packages/core/test/ingest.test.ts` | 16 | 0 |
| `packages/core/test/intake.test.ts` | 179 | 1 |
| `packages/core/test/item-lookup-reads.test.ts` | 3 | 0 |
| `packages/core/test/level-filing.test.ts` | 1 | 0 |
| `packages/core/test/links-spaces.test.ts` | 4 | 0 |
| `packages/core/test/links.test.ts` | 11 | 0 |
| `packages/core/test/notes.test.ts` | 14 | 0 |
| `packages/core/test/opened.test.ts` | 2 | 0 |
| `packages/core/test/original-doctor.test.ts` | 4 | 0 |
| `packages/core/test/owed.test.ts` | 3 | 0 |
| `packages/core/test/page-video.test.ts` | 6 | 0 |
| `packages/core/test/questions.test.ts` | 4 | 0 |
| `packages/core/test/readiness-reads.test.ts` | 3 | 0 |
| `packages/core/test/reimport-interruption.test.ts` | 4 | 0 |
| `packages/core/test/reimport.test.ts` | 18 | 0 |
| `packages/core/test/remix.test.ts` | 11 | 0 |
| `packages/core/test/skill-paths.test.ts` | 8 | 0 |
| `packages/core/test/status.test.ts` | 3 | 0 |
| `packages/core/test/study.test.ts` | 23 | 0 |
| `packages/core/test/tables.test.ts` | 15 | 0 |
| `packages/core/test/today.test.ts` | 49 | 0 |
| `packages/core/test/tries.test.ts` | 12 | 0 |
| `packages/core/test/tutor.test.ts` | 63 | 0 |

Additional app files: `list-actions.test.tsx` 17/0; `phone-directory-reads.test.ts` 2/0; `phone-fs.test.ts` 10/0; `phone-shims.test.ts` 6/0; `phone-icloud.test.ts` 14/0.

Failure evidence from individual runs:
- `cli-contract.test.ts` — `an inbox import where every link fails exits non-zero and keeps them`: `Bun.serve({ port: 0 })` fails with `EADDRINUSE` at line 54, before the tested import command runs. No test was changed and no retry was used.
- `intake.test.ts` — `a very tall or very wide screenshot is read whole, each line once (F188)`: native recognition yields no text, before source creation. A diagnostic calling the unchanged `recognize()` directly on the same tall fixture reports `{"pages":1,"lines":0}`. The cause of the native helper returning no text was not established; no intake code or fixture was changed.

No golden changed. All task-started commands are awaited; no watch process is needed for these drafts.

## Final typecheck and test summary

Both requested final commands ran **once**, after the production and test edits. No test rerun, retry, skip or expectation change followed a final-run failure.

`bun run typecheck` — exit 0:
```text
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
```

`bun test packages/core/test apps/desktop/test` — exit 1:
```text
4 tests failed:
(fail) import coverage: text recognition > a very tall or very wide screenshot is read whole, each line once (F188) [86.14ms]
(fail) the CLI as an agent drives it > an inbox import where every link fails exits non-zero and keeps them [10.50ms]
(fail) cancelling an add > SIGTERM after the source is written takes it back out [9.54ms]
(fail) ls and show say why a source's last enrich failed, from the logs read once [108.08ms]

 2002 pass
 4 fail
 10060316 expect() calls
Ran 2006 tests across 260 files. [111.38s]
```

All 11 new regression cases passed in the combined run. The four failures were:

1. `packages/core/test/intake.test.ts:1331` — native tall/wide OCR (F188): `Found no text in that image`. The unchanged native recognition helper independently returned one page with zero lines; its native failure remains unresolved.
2. `packages/core/test/cli-contract.test.ts:54` — inbox HTTP fixture: `Failed to start server. Is port 0 in use?`, `EADDRINUSE`, syscall `listen`, before the exercised command runs.
3. `packages/core/test/cancel.test.ts:16` — cancellation HTTP fixture: the same `Bun.serve({ port: 0 })` / `EADDRINUSE` failure before cancellation is exercised.
4. `packages/core/test/enrich-skipped.test.ts:10` — its `bun .../packages/cli/src/ore.ts add --stdin --no-enrich --json` child crashed at startup. Captured runtime output:
```text
Bun v1.4.4 (38afee6c8) macOS Silicon
Elapsed: 0ms | User: 1ms | Sys: 1ms
panic(main thread): Trap instruction at address 0x18B851C44
oh no: Bun has crashed. This indicates a bug in Bun, not your code.
```
The Bun crash was not retried or labelled flaky. Its root cause was not established, and the full suite is not green. The findings ledger was left untouched as requested; these failures are recorded here for the reviewer.

`git diff --check` passed. No existing tracked tests were edited. No process started for this task remains running. The uncommitted worktree is the review handoff; PERF-02's cold lookup and F294 remain open as described above.
