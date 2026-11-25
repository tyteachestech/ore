# Deep scan 5: phone fix drafts

Six findings fixed; PHONE-04 reproduced and skipped under the instruction not to change an existing test's required behavior. Changes are uncommitted in this worktree for Claude's review.

Baseline: `dff5645887082dbdf58cab3872dccbb7ac21a9a5` (the supplied worktree HEAD). Each finding's original red script ran before its owning fix, in report order. The report's archived scripts still use `../../` imports and assume `codex-out/phone/`, so copies were placed there and `build-core.ts` bundled the phone aliases locally. The archived originals are unchanged. Each original red command exited 1 on the reported assertion; this was not a build or harness failure.

No browser, app, simulator, development server, e2e, bench, AI request, or live library was used. Tests use scratch libraries and controlled bridge promises. The iOS and interaction skills were read; their visual/device checks were excluded by this task's explicit headless restriction. No UI elements were added or removed. `docs/reviews/findings.md`, `docs/DECISIONS.md`, and existing test assertions are unchanged. No intake output was intentionally changed, so no golden update was run.

Full local stdout/stderr is in `codex-out/phone/logs/` (ignored by Git); the important red/green tails are copied below so this handoff retains them.

## PHONE-01 — Failed initial read can erase review history

Fixed. `put()` refuses writes to paths recorded as failed reads, just as it already refuses writes to downloading files. A successful rescan clears the failure and permits the append; existing bytes are neither replaced nor rewritten to fit the fix.

Changed files: `apps/desktop/src/phone/fs.ts`, `apps/desktop/test/phone-icloud.test.ts`.

New test: **a failed read blocks append and replacement until the existing file can be read (PHONE-01)**, `apps/desktop/test/phone-icloud.test.ts`. It checks append, atomic replacement, unchanged folder bytes, and successful retry.

Baseline command: `ORE_NO_ENRICH=1 bun codex-out/phone/storage-read-failure.ts failed`.

```text
[DEEP] {"mode":"failed","reads":1,"reviewsOnDisk":["new-review"],"writeCalls":1}
```

New regression red output (last lines):

```text
Received function did not throw
Received value: undefined

      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/deep5-fix-phone/apps/desktop/test/phone-icloud.test.ts:295:66)
(fail) a failed read blocks append and replacement until the existing file can be read (PHONE-01) [1.63ms]

 11 pass
 1 fail
 53 expect() calls
Ran 12 tests across 1 file. [40.00ms]
```

Green output (last lines):

```text

 20 pass
 0 fail
 86 expect() calls
Ran 20 tests across 2 files. [43.00ms]
```

Red: the append did not throw, and the original probe wrote only `new-review`. Green command: `bun test apps/desktop/test/phone-icloud.test.ts apps/desktop/test/phone-fs.test.ts`.

Durability: every append, write, copy and atomic replacement reaches the same filesystem write guard. The new test verifies the allowed recovery path as well as the refusal. The original script does not catch the now-intended EBUSY refusal, so its unchanged exit code would not be a green regression test; the permanent test is the guard.

## PHONE-02 — Waiting-file Undo loses the attachment

Fixed. Core has an explicit reversible remove (`removeQueuedLink(..., true)` / CLI `inbox --remove <id> --keep`) and restore (`restoreQueuedLink` / `inbox --restore <id>`). Removal moves only the descriptor to `inbox/removed/`; the attachment stays in place. Restore moves that exact descriptor back, preserving the file, id, capture device, skills, time and any older metadata. Existing permanent remove/import cleanup remains unchanged. Restore refuses to replace a newer live entry.

Changed files: `packages/core/src/inbox.ts`, `packages/cli/src/cmd-items.ts`, `packages/cli/src/answers.ts`, `apps/desktop/src/phone/PhoneApp.tsx`, `apps/desktop/src/phone/AddLink.tsx`, `packages/core/test/inbox.test.ts`, `apps/desktop/test/phone-waiting-undo.test.ts`. `Waiting` now derives from core through `answers.ts`, so the screen can identify a file without another hand-maintained response type.

New core tests in `packages/core/test/inbox.test.ts`:
- **removing a waiting file with Undo keeps its bytes and descriptor through repeated restore (PHONE-02)**
- **Undo of a waiting link keeps its original metadata and refuses to replace a live entry (PHONE-02)**

Additional callback/CLI integration tests in `apps/desktop/test/phone-waiting-undo.test.ts`: **waiting file/link: the screen's Remove, Undo and Redo keep the original entry (PHONE-02)**. They use the real `change` queue and CLI inbox handler, with a deleted temporary input and non-UTF-8 attachment bytes.

Baseline command: `ORE_NO_ENRICH=1 bun codex-out/phone/waiting-file-undo.ts file`.

```text
[DEEP] before {"mode":"file","originalBytesExist":true}
[DEEP] {"originalFile":"01M88HJXVAGCA7JERQ2F3NE2MY/paper.pdf","afterUndo":[{"url":"https://paper.pdf","file":null}],"originalBytesExist":false}
```

New regression red output (last lines):

```text
Expected pattern: /already waiting/
Received message: "restoreQueuedLink is not a function. (In 'restoreQueuedLink(lib, q.id)', 'restoreQueuedLink' is undefined)"

      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/deep5-fix-phone/packages/core/test/inbox.test.ts:133:46)
(fail) Undo of a waiting link keeps its original metadata and refuses to replace a live entry (PHONE-02) [11.29ms]

 3 pass
 2 fail
 27 expect() calls
Ran 5 tests across 1 file. [106.00ms]
```

Green output (last lines):

```text

 5 pass
 0 fail
 37 expect() calls
Ran 5 tests across 1 file. [107.00ms]
```

Red: the retained attachment was missing, and restore was not implemented. Green command: `bun test packages/core/test/inbox.test.ts`; callback integration separately passed 2/2 with 11 assertions.

Durability: core owns removal/restoration for both devices; the UI uses show → queued write → inverse through `change()`, without carrying attachment bytes or reconstructing a URL. The callback's old probe hardcodes only `--remove`/`--add`; the permanent integration test exercises the new CLI path.

Storage caveat: entries removed with Undo are retained under `inbox/removed/`, with their attachment at its existing path. There is no automatic purge in this draft; adding a retention period would need a separate decision. Plain `--remove` still permanently cleans up as before.

## PHONE-03 — List-title Undo overwrites an external rename

Fixed in the shared list action. Undo/Redo reread the source through `show` and compare it with the title the step expects to replace. A newer external title stays on disk and on screen, with the same refusal message Reader already uses. `valueChange` still owns successful-predecessor rebasing.

Changed files: `apps/desktop/src/list-actions.ts`, `apps/desktop/test/list-actions.test.tsx`.

New test: **list title Undo and Redo preserve a newer external title (PHONE-03)** in `apps/desktop/test/list-actions.test.tsx`. It checks an ordinary Undo/Redo cycle and then an external rename before Undo.

Baseline command: `ORE_NO_ENRICH=1 bun codex-out/phone/title-undo.ts list`.

```text
[DEEP] {"mode":"list","actual":"Original title","expected":"Mac title","refused":null,"calls":[["edit","01M88HNKVPA1N77EF9MG94CQRY","--title","Phone title"],["edit","01M88HNKVPA1N77EF9MG94CQRY","--title","Original title"]]}
```

New regression red output (last lines):

```text
Expected: "Mac"
Received: "Original"

      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/deep5-fix-phone/apps/desktop/test/list-actions.test.tsx:388:16)
(fail) list title Undo and Redo preserve a newer external title (PHONE-03) [5.51ms]

 16 pass
 1 fail
 80 expect() calls
Ran 17 tests across 1 file. [185.00ms]
```

Green output (last lines):

```text

 29 pass
 0 fail
 131 expect() calls
Ran 29 tests across 2 files. [220.00ms]
```

Red: expected `Mac`, received `Original`. Green command: `bun test apps/desktop/test/list-actions.test.tsx apps/desktop/test/change.test.tsx`. The original list-title probe also passes: `actual: Mac title`, with a `show` call and refusal `Left as “Mac title”: it was renamed since`.

Durability: the single list-action implementation serves Mac and iPhone and checks both Undo and Redo. Reader's already-protected callback is unchanged. As in Reader, the read/compare protects an external rename already completed before Undo; this does not introduce a new rule for truly simultaneous iCloud writes.

## PHONE-04 — Shared Markdown and VTT import as empty

Skipped, real bug. The original Markdown probe reproduces with the phone bundle from unchanged master:

`ORE_NO_ENRICH=1 bun codex-out/phone/shared-text.ts md`

```text
[DEEP] before [ "01KE0000000000000000000000", "01KE0000000000000000000000.file.json" ] [
[DEEP] {"mode":"md","originalLength":57,"rawType":"string","added":0,"failed":["Found no text to read in that. Copy the text and paste it here instead."]}
```

The cause is the filesystem contract: `phone/fs.ts` deliberately returns a string for an unencoded text read, while core's importer expects bytes (`new Uint8Array(readFileSync(path))`). Existing `phone-fs.test.ts` and `phone-icloud.test.ts` assertions explicitly require that string result. The durable adapter fix is to return bytes for all unencoded reads and use explicit UTF-8 reads where text is required. That requires changing existing tests, which this task explicitly forbids: “If one must change, it is a behaviour change: stop and explain in your notes instead.”

No importer-only coercion or `loadShared` special case was added: it would leave the inconsistent filesystem contract for reimports and other core byte readers. No production change, new regression, intake fixture/grid change or green run is claimed for this finding. The original red script and stdout remain available. Follow-up needs approval to revise the adapter-contract assertions, then a phone-alias intake regression plus the required saved Markdown/VTT examples and intake-grid cells.

## PHONE-05 — An older failed goal save hides a newer saved goal

Fixed. Both Settings screens now use `valueChange` for goal fields, so the shared `change.ts` machinery owns pending-field display and rebases Undo to the last successful value. Phone Settings also updates its current-value reference synchronously when it shows a choice, so a second tap need not wait for React to render.

Changed files: `apps/desktop/src/Settings.tsx`, `apps/desktop/src/phone/Settings.tsx`, `apps/desktop/test/settings-saves.test.ts`.

New tests in `apps/desktop/test/settings-saves.test.ts`, each for phone and Mac:
- **an older failed goal save never hides the newer saved goal, and Undo returns to the saved predecessor (PHONE-05)**
- **two failed goal saves restore the last persisted goal (PHONE-05)**

These run the screens' actual transpiled callbacks headlessly with the real shared queue. They assert shown and saved values, failures, and the surviving Undo step.

Baseline command: `ORE_NO_ENRICH=1 bun codex-out/phone/settings-failed-save.ts overlap`.

```text
[DEEP] {"mode":"overlap","disk":30,"shown":10,"calls":2,"errors":["write refused"]}
```

New regression red output (last lines):

```text
- Expected  - 1
+ Received  + 1

      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/deep5-fix-phone/apps/desktop/test/settings-saves.test.ts:77:23)
(fail) mac: two failed goal saves restore the last persisted goal (PHONE-05) [0.11ms]

 0 pass
 4 fail
 8 expect() calls
Ran 4 tests across 1 file. [14.00ms]
```

Green output (last lines):

```text

 16 pass
 0 fail
 63 expect() calls
Ran 16 tests across 2 files. [156.00ms]
```

Red: the phone displays 10 while 30 saved (and two failures leave 20 shown). The original desktop callback also failed the new settlement/Undo checks. Green command: `bun test apps/desktop/test/settings-saves.test.ts apps/desktop/test/change.test.tsx`.

Durability: both devices delegate field ownership and inverse rebasing to existing shared code, rather than introducing another rollback mechanism. Device-specific reminder scheduling remains in each screen.

## PHONE-06 — Sync status omits writes awaiting folder delivery

Fixed. `syncState().unsent` includes operations handed to the flush chain, not just the map of writes waiting to enter it. The count is released in `finally`, after delivery or after the failed operations have been returned to the retry map.

Changed files: `apps/desktop/src/phone/fs.ts`, `apps/desktop/test/phone-icloud.test.ts`.

New test: **sync stays pending through in-flight and queued batches, including a failed batch (PHONE-06)** in `apps/desktop/test/phone-icloud.test.ts`. It holds a native write, queues a second batch, fails the first, and verifies the pending count through recovery. Every held promise is released in `finally`.

Baseline command: `ORE_NO_ENRICH=1 bun codex-out/phone/sync-inflight.ts inflight`.

```text
[DEEP] {"mode":"inflight","state":{"icloud":true,"at":1795521600000,"unsent":0,"downloading":0,"error":null},"status":"Up to date, checked just now.","disk":"Old note","saveStillHeld":true}
```

New regression red output (last lines):

```text
Expected: 2
Received: 0

      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/deep5-fix-phone/apps/desktop/test/phone-icloud.test.ts:318:32)
(fail) sync stays pending through in-flight and queued batches, including a failed batch (PHONE-06) [0.27ms]

 12 pass
 1 fail
 57 expect() calls
Ran 13 tests across 1 file. [44.00ms]
```

Green output (last lines):

```text

 21 pass
 0 fail
 91 expect() calls
Ran 21 tests across 2 files. [65.00ms]
```

Red: expected 2 pending operations, received 0. Green command: `bun test apps/desktop/test/phone-icloud.test.ts apps/desktop/test/phone-fs.test.ts`. The original probe also passes after rebuilding the bundle: `unsent: 1`, status `Sending 1 change to iCloud.`, while the native save is still held and the folder still has its old bytes.

Durability: accounting lives with the flush lifecycle, including queued batches and failures, so any status consumer sees delivery still outstanding. This reports delivery to the local iCloud folder, not remote server acknowledgment.

## PHONE-07 — Equal-length edits in one millisecond leave search stale

Fixed. Automatic local write times advance strictly, including byte writes, copies, atomic replacements and delete/recreate. Explicit `utimes` values remain exact. Native acknowledgments cannot move an entry's local time backwards, and a changed external entry read into an existing local file advances its exposed time too.

Changed files: `apps/desktop/src/phone/fs.ts`, `apps/desktop/test/phone-fs.test.ts`, `apps/desktop/test/phone-icloud.test.ts`.

New tests:
- **same-length writes get distinct modification times even within one millisecond (PHONE-07)** in `apps/desktop/test/phone-fs.test.ts`
- **a folder acknowledgment never reuses an indexed time for a newer local edit (PHONE-07)** in `apps/desktop/test/phone-icloud.test.ts`

Baseline command: `ORE_NO_ENRICH=1 bun codex-out/phone/stat-collision.ts same`.

```text
[DEEP] {"mode":"same","mtime":1795521600000,"report":{"changed":0,"removed":0,"errors":[]},"canonical":"bravo","oldHits":1,"newHits":0}
```

New regression red output (last lines):

```text
Expected: > 1795521600000
Received: 1795521600000

      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/deep5-fix-phone/apps/desktop/test/phone-fs.test.ts:107:36)
(fail) same-length writes get distinct modification times even within one millisecond (PHONE-07) [0.13ms]

 8 pass
 1 fail
 32 expect() calls
Ran 9 tests across 1 file. [9.00ms]
```

Green output (last lines):

```text

 33 pass
 0 fail
 113 expect() calls
Ran 33 tests across 4 files. [88.00ms]
```

Red: both writes have `mtimeMs: 1795521600000`; the real-index probe has `changed: 0`, `oldHits: 1`, `newHits: 0`. Green command: `bun test apps/desktop/test/phone-fs.test.ts apps/desktop/test/phone-icloud.test.ts apps/desktop/test/phone-search.test.ts apps/desktop/test/phone-shims.test.ts`. The additional acknowledgment/rescan guard passed in a later single-file run (14 pass, 0 fail, 65 assertions).

The rebuilt original real-core/sql.js probe passes with `changed: 1`, `oldHits: 0`, `newHits: 1`, and the canonical text remains `bravo`.

Durability: the filesystem adapter supplies a distinct modification time for each local edit instead of changing core's shared index logic or forcing an index rebuild. The native stamp map still tracks actual folder stamps for rescan decisions. A burst can put the logical local time slightly ahead of wall-clock time; native on-disk timestamps are not rewritten by this fix.

## Final validation

Additional existing app coverage: `phone-add`, `phone-waiting`, `undo-waits`, `ux-basics`, `mac-feel`, `waits`, `hints`, and `phone-reminder`: **34 pass, 0 fail, 78 assertions**. The final combined run also covers all existing core/app files, including the CLI handlers and inbox import callers. No existing test expectation was changed to fit these fixes.

`git diff --check`: passed.

`bun run typecheck` ran exactly once and passed (exit 0):

```text
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
```


`bun test packages/core/test apps/desktop/test` ran exactly once and finished with exit 1:

```text
1829 pass
3 fail
10059489 expect() calls
Ran 1832 tests across 244 files. [99.13s]
```

All new regression cases passed in this combined run; the targeted runs listed above also passed. The suite as a whole is **not green**. No retry, skip, or existing assertion change was made to hide the failures.

| Failing test | Evidence / boundary |
| --- | --- |
| `packages/core/test/intake.test.ts` — a very tall or very wide screenshot is read whole, each line once (F188) | The test calls the real macOS Vision OCR helper. `packages/core/src/ingest/ocr.ts:68` throws `Found no text in that image. Add a screenshot with text, or paste what you need.` OCR code and fixtures are untouched; the underlying native failure is unresolved, not proven to be a baseline failure or sandbox issue. |
| `packages/core/test/cli-contract.test.ts` — an inbox import where every link fails exits non-zero and keeps them | Fails at line 54, before invoking the inbox command: `Bun.serve({ port: 0, ... })`, `Failed to start server. Is port 0 in use?`, `syscall: listen`, `code: EADDRINUSE`. |
| `packages/core/test/cancel.test.ts` — SIGTERM after the source is written takes it back out | Fails at line 16 while creating its local fixture server, with the same `listen` / `EADDRINUSE` error. |

The requested combined suite attempted its own short-lived fixture servers; no development server was launched. The two failed listeners never started. Both command sessions (typecheck and tests) exited, and no tool execution session remains running. An independent `ps` process-list check was refused by the sandbox (`operation not permitted`), so no claim is made about unrelated processes on the Mac.

Final summary: **typecheck passed; combined tests 1,829 passed / 3 failed; six fixes drafted; PHONE-04 skipped for the existing-test contract conflict.**
