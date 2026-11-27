# Shell fix drafts — 2026-11-27

Two fixes remain in the worktree: F421 and F660. F662 and F729 are reproduced but skipped. No commits, pushes, browser/app/server launches, e2e, bench, or paid AI evals were requested by this draft. The required test commands include existing tests that attempt local server binds; two failed with EADDRINUSE on port 0 in this environment. No existing test assertions, findings rows, or decisions were changed. No ingestion or doc.md output changed; golden:update was not needed.

Evidence is in `codex-out/shell/` (ignored by Git; preserve it when handing this worktree to Claude). The new failing reproductions for skipped findings stay there, outside the regular test directories.

## F421 — fixed

The vendor task and review-chat adapters passed long Codex prompts as single arguments. Review's separate Claude chat adapter did too. The tutor sent its full earlier conversation as an argument before the vendor adapter could help.

Changed files:
- `packages/core/src/ai/adapter.ts`: use the existing 64,000-byte threshold for both Codex paths (new and resumed), sending `-` and piping the complete prompt; apply the existing Claude stdin behavior to review chats too. Count bytes after adding Codex's initial instructions. Short argument behavior is unchanged.
- `packages/cli/src/cmd-ai.ts`: `tutor --earlier -` reads JSON from existing `readStdin`; inline JSON is still accepted with the same parsing and error behavior.
- `apps/desktop/src/Tutor.tsx`: the shared tutor caller pipes the history through `oreJob`, passing `--earlier=-`. The named `history` variable also leaves the existing wait-call scanner able to identify the call.
- `packages/core/test/ai-stdin.test.ts`: four new tests, fake vendors only.

New test names in `packages/core/test/ai-stdin.test.ts`:
1. `F421: Codex tasks pipe long prompts intact on new and resumed sessions`
2. `F421: codex review chats pipe long prompts on new and resumed sessions`
3. `F421: claude review chats pipe long prompts on new and resumed sessions`
4. `F421: tutor reads a long earlier chat from stdin and still accepts inline JSON`

The fixtures use multibyte text: its byte count crosses the threshold while its character count does not. They check the prompt's full contents, bounded argv, new/resumed calls, and the actual CLI with stdin and legacy inline JSON.

Read installed `codex exec --help` and `codex exec resume --help`, without calling AI. Both document `-` as reading the prompt from stdin. The former also documents reading stdin when no prompt argument is given.

Red, `bun test packages/core/test/ai-stdin.test.ts` (`F421-red.txt`):
```text

 0 pass
 4 fail
 4 expect() calls
Ran 4 tests across 1 file. [817.00ms]
```
The first three cases found the long prompt still in argv / no stdin; the CLI case returned `--earlier must be JSON` for `-`.

Green, same command (`F421-green.txt`):
```text

 4 pass
 0 fail
 22 expect() calls
Ran 4 tests across 1 file. [1078.00ms]
```
Existing adapter/tutor/CLI coverage (`F421-existing.txt`): 179 pass, 1 fail across 7 files. The sole failure was `cli-contract.test.ts`'s inbox HTTP fixture: `Failed to start server. Is port 0 in use?` / `EADDRINUSE`, before the tested import. Other app coverage is in `app-existing.txt`; its first run exposed the source scanner's inability to recognize an expression in the stdin argument. Naming that value fixed it without editing the test; `F421-app-green.txt` has 3 pass, 0 fail for `waits.test.ts`.

Durable fix: transfer the unbounded conversation through the existing stdin transport at both process boundaries, without trimming or rewriting saved conversations.

## F660 — fixed

Changed files:
- `apps/desktop/src/review-session.ts`: track the rating write already in flight. Leaving still issues `session end <id>` immediately. Once that end and a successful rating save have both completed, end the same session again to recompute its stored receipt from core's real review log. A rejected rating does not trigger the refresh. The session is never reopened.
- `apps/desktop/test/review-session.test.ts`: append two integration cases using a scratch core library, real review writes and real receipts, with the review write held until after the first end completes.

New test names in that file:
- `F660: closing during a successful rating leaves an accurate stored receipt`
- `F660: closing during a failed rating leaves an accurate stored receipt`

Red, `bun test apps/desktop/test/review-session.test.ts` (`F660-red.txt`):
```text

 28 pass
 1 fail
 132 expect() calls
Ran 29 tests across 1 file. [310.00ms]
```
The successful save left a real review in the log and a receipt with 0 instead of 1. The failed-save control already passed.

Green, same command (`F660-green.txt`):
```text

 29 pass
 0 fail
 133 expect() calls
Ran 29 tests across 1 file. [416.00ms]
```
The pre-existing `closed mid-save (a click away from the quick quiz)…` assertion remains unchanged and passes. It still sees the end before releasing the held rating. Existing keyboard/Undo and sound coverage ran in `app-existing.txt` as well.

Durable fix: keep close ordering in the shared session owner and derive the final receipt from confirmed saved reviews, rather than inventing a count that could include a failed write.

Limits for review: the first receipt can temporarily contain zero while the save is pending; the second receipt corrects it after success. The quick quiz hides its window (`quiz_hide`), so its pending JavaScript continues. An application/process crash before the refresh, or a failed refresh write, is not made crash-safe by this draft; end failures retain the existing cleanup error handling. No new on-disk format or optimistic fake review is introduced.

## F662 — skipped: reproduced; no safe legacy-lock migration in this draft

Reproduction: `bun codex-out/shell/F662-red.ts`. This runs the real install hook in an isolated temporary directory with fake Git, Bun and app-inspection commands. It creates the lock with an owner record naming a confirmed nonexistent pid and verifies that no installation is attempted. It makes no Git commits and cannot build or install the app.

Red (`F662-red.txt`, excerpt):
```text
AssertionError: F662: a dead owner's lock still prevents the install hook from running
actual: false
expected: true
code: ERR_ASSERTION
```
Green: not applicable; skipped. Changed production/test-suite files: none. Added reproduction: `codex-out/shell/F662-red.ts`.

Cause and location: `apps/desktop/scripts/auto-update.ts` calls the install hook again when an install is behind. The actual serialization is `.githooks/post-commit`: `mkdir "$cache/app-install.lock" || exit 0`, with `rmdir` only on shell exit. `.githooks/post-merge` delegates to the same hook. A killed shell leaves the directory forever.

What a durable fix needs: run the whole installer under one owner-aware lock with a fully populated pid/start identity published atomically, dead-owner takeover serialized against other contenders, and cleanup that can only release its own lock. The owner must be the long-lived background installer, not the parent hook/updater that exits. `packages/core/src/lock.ts` already has atomic hard-link publication, dead-pid/boot checks and serialized takeover; a dedicated installer runner could reuse it, with process-start identity added to protect against pid reuse on the same boot.

Why skip: existing lock directories carry no owner at all, including ones held by a live older installer. Blindly deleting one, or treating an old timestamp as death, can start two installs. Adding a pid file after mkdir also leaves a crash window before the pid is written. A safe rollout must resolve that legacy case and preserve the hook tests' actual install/dependency order; this pass does not ship a partial lock fix that only works for newly created locks.

## F729 — skipped: reproduced; the simple draft regressed existing retrieval

Reproduction/new regression: `bun test codex-out/shell/F729-regression.test.ts`, test `F729: Ask and tutor retain evidence in a ninth-ranked source, within the passage budget`. Nine sources, eight short sources with matching titles and one long textbook with a short relevant passage. It first verifies that the textbook ranks ninth in the source search, then checks that Ask and tutor retain both parts of the question, valid source offsets and the existing passage budget. `F729-rank.ts` prints the ranking independently.

Red at master (`F729-red.txt`; the test initially lived in `packages/core/test/ask-retrieval-regressions.test.ts`):
```text

 0 pass
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [123.00ms]
```
Expected the textbook's evidence to be present; received false.

Attempted green (`F729-green.txt`, withdrawn draft only):
```text

 1 pass
 0 fail
 49 expect() calls
Ran 1 test across 1 file. [118.00ms]
```
The candidate removed the source cutoff in `packages/core/src/ai/ask.ts`, letting the existing passage scorer apply the 14-passage / five-per-source limits after considering all matching sources. This passes the new regression but **fails existing coverage**:
```text

 84 pass
 1 fail
 505 expect() calls
Ran 85 tests across 3 files. [19.64s]
```
`eval-ask.test.ts`'s scale case failed on `wiki-origin`: the passage naming Ebbinghaus and the 1880s no longer reached the tutor. The AI-free diagnostic `F729-evidence.ts` also found `two-spacing` lost the forgetting-video evidence. Full returned passages are in `F729-all-candidates.txt`; the withdrawn patch is `F729-rejected.patch`.

Changed production/test-suite files: none remain for this finding. Restored `ask.ts` exactly and moved the reproduction outside the suite. No existing tests or eval cases were edited to accept the regression.

Cause and next work: the hard eight-source shortlist lives in shared `retrieve()` in `packages/core/src/ai/ask.ts`, before paragraph scoring; `db.ts` supplies whole-source ranking, and both Ask and tutor consume the same retrieval. Simply expanding candidates changes passage statistics and lets repeated topic text displace needed evidence. A durable fix belongs here, retaining source relevance while reserving evidence for distinct parts of a question, and must pass the ninth-source guard plus all existing scale questions. That needs a retrieval change beyond removing the limit, with evidence on its quality and cost, not another arbitrary higher source cap.

**Claude should run `bun run eval:ask` after reviewing a replacement retrieval fix.** It spends AI; it was not run here. The existing `eval-ask.test.ts` and the diagnostic above use deterministic retrieval/fake vendors only.

## Interaction and scope checks

Used `.claude/skills/interaction-check/SKILL.md` for the touched flows. Headless coverage checks starting/closing sessions, a slow save, a failed save, duplicate presses, Undo/Redo, and wait labels; no controls or labels were added or removed. No browser checks, screenshots, simulator, server or app were deliberately launched, per this pass's explicit restriction. This is a logic/transport draft, not a claim of a visual audit. Intake and golden rules do not apply because no imported output changed.

## Final verification

Both required commands ran once, after the final code changes; neither was rerun.

`bun run typecheck` — **PASS**, exit 0 (`codex-out/shell/final-typecheck.txt`):
```text
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
```

`bun test packages/core/test apps/desktop/test` — **FAIL**, exit 1 (`codex-out/shell/final-tests.txt`):
```text

 2149 pass
 3 fail
 10061275 expect() calls
Ran 2152 tests across 273 files. [127.28s]
```

All six new F421/F660 regression cases pass in this full run. The unchanged scale retrieval test passes again after withdrawing the F729 draft. The three failures are outside the changed code:
- `packages/core/test/intake.test.ts:1514`: `a very tall or very wide screenshot is read whole, each line once (F188)` — `Found no text in that image`. OCR cause not diagnosed in this shell pass; not claimed to be a pre-existing or flaky failure without baseline evidence.
- `packages/core/test/cli-contract.test.ts:54`: `an inbox import where every link fails exits non-zero and keeps them` — fixture `Bun.serve({ port: 0 })` fails on `listen`, `EADDRINUSE`.
- `packages/core/test/cancel.test.ts:16`: `SIGTERM after the source is written takes it back out` — same fixture server bind failure, before reaching cancellation behavior.

No tests were retried, skipped, or relaxed to hide these final failures. The suite exited; no app, server, AI job or test runner was deliberately left running. `git diff --check` passes. Changes are uncommitted as instructed. This is a draft handoff, not merge-ready green CI.
