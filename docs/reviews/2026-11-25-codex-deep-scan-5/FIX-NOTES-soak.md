# Deep scan 5 — soak fix drafts

Base: `766886b088846d53b31dee6c716b30858cede35e` (the supplied clean master worktree).

Both findings are fixed in report order. No findings or decisions registry edits, existing-test edits, commits or pushes. No library formats, writes, intake behavior or `doc.md` output changed; no goldens changed or regenerated.

## Reproduction limits

The supplied `red/soak/driver.cjs` connects to WebKit, opens a browser context and needs a running page/CLI bridge. Running either original script would violate this task's explicit no-browser/no-server instruction. I read `driver.cjs`, `home-race.cjs` and `focus-sidebar.cjs` and reproduced their causal sequences headlessly against this checkout's production callbacks instead. **The original browser scripts were not run.** Both headless regression files failed on their respective unchanged production code before its fix.

The tests use the existing `settings-saves.test.ts` approach: extract and transpile the actual callbacks from the screen, supply state sinks and controlled command responses, and execute them. The source markers fail loudly if the block moves. They exercise response acceptance, cache writes and event handlers; they do not mount React, paint pixels, invoke the real CLI, or prove native focus/sync behavior. All timers in the focus fixture are local fake timers; all held promises are settled.

## SOAK-01 — fixed

**Finding:** An older Home response replaces a newer saved daily goal.

**Changed files:**
- `apps/desktop/src/Home.tsx`
- `apps/desktop/test/home-reads.test.ts` (new)

**Fix:** Use the existing `readGuard` in shared Home. Only the latest request can set Today, update the shared cache or set/clear the error. Effect cleanup invalidates outstanding requests so a closed Home cannot write its old snapshot to the cache. Mac and iPhone both render this Home component. No new module or duplicated device logic.

**New tests**, all in `apps/desktop/test/home-reads.test.ts`:
- `SOAK-01: an older Today reply cannot replace the newer goal on Home or in its cache`
- `SOAK-01: serial Today replies still update Home and its cache`
- `SOAK-01: a late failed read cannot hide a newer successful Today`
- `SOAK-01: an old success cannot clear the latest error, and retry can recover`
- `SOAK-01: a Today reply after Home unmounts cannot update the shared cache`

The primary case holds the initial ten-minute snapshot, completes the second fifteen-minute response, then delivers the first. The serial case is the report's successful control.

**Red:** `bun test apps/desktop/test/home-reads.test.ts` before the Home edit (exit 1).

```text
error: expect(received).toEqual(expected)
  {
-   "goal_minutes": 15,
+   "goal_minutes": 10,
  }
(fail) SOAK-01: an older Today reply cannot replace the newer goal on Home or in its cache
```

Last lines:
```text
 1 pass
 4 fail
 8 expect() calls
Ran 5 tests across 1 file. [11.00ms]
```

**Green:** same command after the fix (exit 0).

```text
 5 pass
 0 fail
 13 expect() calls
Ran 5 tests across 1 file. [10.00ms]
```

**Existing coverage:** `continue-reading.test.ts`, `review-pick.test.ts`, `reads.test.ts`: 15 pass, 0 fail, 43 assertions. Additional screen contracts are listed below.

**Why durable:** Request identity gates every result sink, including stale errors and cache writes after disposal, in the single Home shared by both devices.

## SOAK-02 — fixed (remaining F173 case)

**Finding:** Returning from another app does not refresh renamed sidebar skills.

**Changed files:**
- `apps/desktop/src/App.tsx`
- `apps/desktop/test/focus-reload.test.ts` (new)

**Fix:** The Mac's return-after-ten-seconds handler calls the existing combined `reload()` instead of the sources-only `refresh()`. It uses the same guarded skill loader as launch and retry, including updating the saved skills cache and clearing a filter whose skill was deleted. Inbox import and screen wake still run. The effect dependency list now names the combined reload it uses.

This is Mac lifecycle wiring, not a duplicated list action. `phone/PhoneApp.tsx` already reads `ls`, `skills` and `inbox` together in its refresh called after sync; it needs no separate fix. No changes to `list-actions.ts`, `change.ts`, `review-session.ts`, `highlights.ts` or `answers.ts` are needed for either finding.

**New tests**, all in `apps/desktop/test/focus-reload.test.ts`:
- `SOAK-02: returning after an outside rename refreshes sidebar skills, their cache and source lists`
- `SOAK-02: returning after an outside skill deletion clears its stale filter`
- `SOAK-02: a short absence or focus entering a video iframe does not reload`

The rename case flushes the actual deferred blur callback before advancing twelve seconds, as the saved script requires. It checks the loaded skill name, saved cache, source list, inbox call, screen wake, and that repeated focus does not reload again. Controls retain the existing short-absence and iframe exclusions.

**Red:** `bun test apps/desktop/test/focus-reload.test.ts` before the App edit (exit 1).

```text
Expected: "Soak external skill"
Received: "Creativity"
(fail) SOAK-02: returning after an outside rename refreshes sidebar skills, their cache and source lists
```

Last lines:
```text
 1 pass
 2 fail
 9 expect() calls
Ran 3 tests across 1 file. [12.00ms]
```

**Green:** same command after the fix (exit 0).

```text
 3 pass
 0 fail
 19 expect() calls
Ran 3 tests across 1 file. [9.00ms]
```

**Why durable:** Returning now uses the existing complete reload, so every supported outside skill edit passes through the same read guard, cache and selected-filter handling as launch.

## Interaction and review scope

Applied `.claude/skills/interaction-check/SKILL.md` to the affected read/failure paths. The goal shows the saved daily target (D60); sidebar skill names identify the saved skills (D5/D78). No visual elements, copy, controls, shortcuts, write/Undo order or user decisions changed; nothing was added or removed from the interface. Late success/failure, retry, disposal, outside rename/deletion, brief absence, iframe focus and duplicate focus have headless guards. Visual, browser and native-device interaction checks were not run, as explicitly instructed. No taste or behavior-policy findings needed skipping.

## Final verification

Related app checks ran one file at a time, all passing:

| File (`apps/desktop/test/`) | Pass | Fail |
| --- | ---: | ---: |
| `sidebar-new-skill.test.tsx` | 4 | 0 |
| `sidebar-groups.test.ts` | 1 | 0 |
| `source-filters.test.ts` | 10 | 0 |
| `list-actions.test.tsx` | 17 | 0 |
| `wakes.test.ts` | 2 | 0 |
| `undo-waits.test.ts` | 1 | 0 |
| `waits.test.ts` | 3 | 0 |
| `hints.test.ts` | 10 | 0 |
| `names.test.ts` | 2 | 0 |
| `dot-ring.test.tsx` | 12 | 0 |
| `pick-bar.test.tsx` | 4 | 0 |
| `glide.test.ts` | 4 | 0 |
| `impeccable-round-9.test.ts` | 9 | 0 |
| `keys.test.ts` | 18 | 0 |
| `one-name.test.ts` | 2 | 0 |
| `round-8-picks.test.ts` | 5 | 0 |
| `row-line.test.ts` | 1 | 0 |
| `shell-menu.test.ts` | 3 | 0 |
| `tailwind.test.ts` | 1 | 0 |

Total: 109 tests, 0 failures, 415 assertions across 19 files.

`bun run typecheck` — **passed**, exit 0, run once.

```text
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
```

`bun test packages/core/test apps/desktop/test` — **failed**, exit 1, run once. All eight new regression tests passed in this run too. Three failures in untouched tests remain for review; none was retried, skipped, or edited:

1. `packages/core/test/intake.test.ts:1327` — `import coverage: text recognition > a very tall or very wide screenshot is read whole, each line once (F188)`.
   The real macOS Vision path failed on `tall.png`, before reaching the wide-image assertions. `scannedText` refused the output because it contained fewer than 20 non-whitespace characters. Error at `packages/core/src/ingest/ocr.ts:73`: `Found no text in that image. Add a screenshot with text, or paste what you need.` The native helper's underlying reason is unverified; this is not declared flaky or a confirmed baseline failure.
2. `packages/core/test/cli-contract.test.ts:52` — `the CLI as an agent drives it > an inbox import where every link fails exits non-zero and keeps them`.
   Failed while setting up `Bun.serve({ port: 0, ... })` at line 54, before the import assertion. Error: `Failed to start server. Is port 0 in use?`, syscall `listen`, code `EADDRINUSE`.
3. `packages/core/test/cancel.test.ts:11` — `cancelling an add > SIGTERM after the source is written takes it back out`.
   Failed while setting up `Bun.serve` at line 16, before starting the add/cancel scenario. Same `listen` / `EADDRINUSE` error. The sandbox may prevent local binding, but that cause was not independently verified.

These are outside the two soak findings and the changed production modules. No core/CLI code or intake fixtures were changed to hide them. Claude should retain these failures in the review/triage handoff; `docs/reviews/findings.md` remains untouched as requested. The full run is **not green**.

`git diff --check` passed. All tool-owned test/typecheck processes returned final exit codes; no background command was launched or left in an active tool session. A process-table check was denied by the sandbox (`operation not permitted: ps`), so unrelated system processes were not inspected. No browser, native app, development server, e2e or benchmark was launched by this task. The requested full test command itself attempted the two temporary fixture listeners noted above.

Final summary: typecheck **passed**; requested core/app tests **1,969 passed, 3 failed**. Last test-output lines:

```text
 1969 pass
 3 fail
 10060126 expect() calls
Ran 1972 tests across 256 files. [118.96s]
```
