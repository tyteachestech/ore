# Deep scan 5 — shell fix notes

Drafts only, left uncommitted for Claude's review. Checked against this worktree's unchanged master code before each finding's fix, in report order. No existing test was edited. No findings or decisions file was edited. No library formats, import code, `doc.md` output or goldens changed.

Read `CLAUDE.md`, the desktop rules, workflow, spec, daily-session rules and the relevant D76/D82 decisions. No browser, app, development server, e2e, bench, Cargo build or live-library operation was run. The explicitly requested final suite attempted loopback servers inside two existing tests; both binds failed (details below). Headless DOMs are happy-dom, not browsers. Updater tests replace Git, installer and app-control processes with scratch fakes. The supplied scripts expect `codex-out/shell/` relative imports, so unmodified copies were run there; originals under `docs/reviews/` are untouched. Full outputs are retained in ignored `codex-out/shell/*.log`.

## SHELL-01 — Fixed: native menus follow the active window

Changed:
- `apps/desktop/src-tauri/src/main.rs`
- `apps/desktop/src/menubar.ts`
- `apps/desktop/src/App.tsx`
- `apps/desktop/src/QuickQuiz.tsx`
- New `apps/desktop/test/shell-menu.test.ts`

Native commands target the focused webview by label, without raising main first. The shared `useMenu` lifecycle installs each window's listener and republishes its menu on focus and state changes. The native setter rejects menu updates from an unfocused page. Quiz Review commands and Undo/Redo remain local; app navigation such as Settings is handed to main. Quick Quiz's native menu command uses the existing native toggle, rather than synthesizing a key with no main-page handler.

New tests in `apps/desktop/test/shell-menu.test.ts`:
- `native menu commands reach the focused webview without raising main first`
- `both webviews install the shared menu lifecycle, including focus refresh`
- `quiz menu Undo stays in its history and app navigation is handed to main`

Master reproduction: `ORE_NO_ENRICH=1 bun codex-out/shell/menu-window.ts`, exit 1 (`01-master.log`):
```text
[DEEP] active window=quiz; native route=main; main Home menu Later enabled=false
[DEEP] {"mainSourceArchived":false,"quizRatingSaved":true}
[DEEP] FAIL: native Edit > Undo changes the main window instead of the quick quiz
```
New test red: `bun test apps/desktop/test/shell-menu.test.ts`, exit 1 (`01-test-red.log`):
```text

 0 pass
 3 fail
 5 expect() calls
Ran 3 tests across 1 file. [60.00ms]
```
Green: `bun test apps/desktop/test/shell-menu.test.ts apps/desktop/test/menubar.test.ts`, exit 0 (`01-test-green.log`):
```text

 11 pass
 0 fail
 217 expect() calls
Ran 11 tests across 2 files. [75.00ms]
```
Durable fix: menu ownership and listener lifecycle are shared by both webviews; routing uses the actual native focus and an explicit target, not a main-window assumption.

Limit: Rust routing is source-guarded, while the receiving listener and history run headlessly. Native focus/menu-click ordering, accelerator delivery and AppKit enabled states still need a native check by the reviewer. The original red probe intentionally rejects focus-aware Rust and is not a post-fix test. Tauri's locally installed `Emitter` implementation was checked: `emit` broadcasts even when called on a window, so the fix specifically uses `emit_to(w.label(), ...)`. No claim of a compiled or driven native app.

## SHELL-02 — Skipped: confirmed defect conflicts with existing test assertions

Changed files: none. No new failing test is left in the suite.

Master reproduction: `ORE_NO_ENRICH=1 bun codex-out/shell/quiz-close-rating.ts`, exit 1 (`02-master.log`):
```text
[DEEP] mode=close-first; saved reviews=1; receipt reviews=0; receipt kept=0; post-close notifications=0
[DEEP] FAIL: closing during a rating permanently stores a zero-review session receipt
```
The durable fix belongs in `review-session.ts`: defer the end receipt until the outstanding rating settles, and notify after a successful late save. However, `apps/desktop/test/review-session.test.ts` already requires the opposite in `closed mid-save (a click away from the quick quiz): the session ends by its id, the rating still lands, and its ⌘Z then only changes the log`:
- Line 212 expects `session end S1` **before** releasing the held review.
- Line 222 expects one `onLogged` notification after the later Undo; adding the missing late-save notification would make that two.

Your instruction says an existing test must never be edited to fit the fix, and to stop and explain if one must change. Therefore the finding is skipped, without patching core to compensate for the wrong write order. The existing session tests passed unchanged in the related-tests run below; that is not a green regression test for this defect. Reviewer action: approve changing those two expectations before implementing the ordering fix. No new test red/green is claimed.

## SHELL-03 — Partially fixed: failed installs retry; ownerless-lock variant skipped

Changed:
- `.githooks/post-commit`
- `apps/desktop/scripts/auto-update.ts`
- New `apps/desktop/test/update-retry.test.ts`
- New `apps/desktop/test/fixtures/update-retry.ts`

The hook publishes `~/Library/Caches/ore/app-built` by rename only after a successful install. Failure exits the build loop and leaves that marker unchanged. A later healthy updater pass compares the successful build with HEAD, retries through the same hook when needed, and avoids a redundant retry during the pull that already launched the hook. Documentation-only changes advance the marker without building. Normal commit and merge hooks still install when invoked, preserving their existing contract. The current lock continues to serialize the hook.

New primary test in `apps/desktop/test/update-retry.test.ts`:
- `a failed Mac install is retried at unchanged HEAD, and only success marks it installed`

Controls in that file cover a successful pull, an already current build, documentation-only changes and a missing marker at an unchanged checkout. The fixture executes copies of the real updater and hook with fake subprocesses; it checks that the first failed attempt leaves no successful-install marker. Its temporary files are removed when the isolated process exits.

Master reproduction: `ORE_NO_ENRICH=1 bun codex-out/shell/update-retry.ts`, exit 1 (`03-master.log`):
```text
2026-11-25T05:10:30.071Z phone not reachable: it updates on a later pass
[DEEP] mode=transient-failure; passes=3; checkout=new; origin=new; pulls=1; install attempts=1; installed=old
[DEEP] hook log: installing new
transient build failure
FAILED
[DEEP] FAIL: later healthy update passes never retry the Mac install
```
New test red: `bun test apps/desktop/test/update-retry.test.ts`, exit 1 (`03-test-red.log`; four tests at the red stage):
```text

 1 pass
 3 fail
 8 expect() calls
Ran 4 tests across 1 file. [759.00ms]
```
Green: same test-file command, exit 0 (`03-test-green.log`; an additional missing-marker control was added):
```text

 5 pass
 0 fail
 10 expect() calls
Ran 5 tests across 1 file. [989.00ms]
```
Existing coverage: `bun test apps/desktop/test/auto-update.test.ts apps/desktop/test/githooks.test.ts`, exit 0 (`03-existing-green.log`):
```text

 6 pass
 0 fail
 12 expect() calls
Ran 6 tests across 2 files. [4.79s]
```
Durable fix for the failed-install case: installation follows a success marker, independently of whether Git has more commits to pull; an attempted build never becomes a successful build.

**Unresolved subcase:** the supplied `stale-lock` reproduction also failed at master (`03-stale-master.log`):
```text
[DEEP] mode=stale-lock; passes=3; checkout=new; origin=new; pulls=1; install attempts=0; installed=old
[DEEP] hook log: 
[DEEP] FAIL: later healthy update passes never retry the Mac install
```
The existing directory lock carries no owner or liveness record. An abandoned directory and one held by a valid older installer have the same format. Automatically deleting it would change the install-serialization rule and could allow two builds/installations at once. Per the skip rule, that policy is not changed here; neither the stale-lock variant nor the phone-wait lead is claimed fixed. Future work needs an ownership-aware lock and a decision for safely migrating existing ownerless locks, rather than assuming every existing directory is stale. The report's original updater probe is not reused after the change: its fake process table does not implement the new retry invocation; the maintained regression fixture does.

## SHELL-04 — Fixed: existing webviews refresh their shortcuts

Changed:
- `apps/desktop/src/keys.ts`
- New `apps/desktop/test/keymap-windows.test.ts`
- New `apps/desktop/test/fixtures/keymap-windows.tsx`

The shared keymap module reloads settings on relevant local-storage events, including removal and clear, and on focus to recover missed notifications. It applies the same existing read rules as module initialization, updates key matching and subscribers, and never writes the data back during refresh. Unrelated keys and session-storage events are ignored.

New test: `existing webviews and their shortcut labels follow settings changes, resets and focus` in `apps/desktop/test/keymap-windows.test.ts`. Its isolated fixture loads two real key modules and mounts a real `useKeymap` subscriber, covering both shortcut behavior and displayed labels.

Master reproduction: `ORE_NO_ENRICH=1 bun codex-out/shell/quiz-keymap.ts`, exit 1 (`04-master.log`):
```text
[DEEP] mode=already-open; after Settings rebind + storage event: {"mainNew":true,"quizNew":false,"quizOld":true}
[DEEP] FAIL: quick quiz keeps the launch-time keymap until relaunch
```
New test red: `bun test apps/desktop/test/keymap-windows.test.ts`, exit 1 (`04-test-red.log`); underlying assertion: `already-open quiz must match the new binding`, actual false, expected true:
```text

 0 pass
 1 fail
 1 expect() calls
Ran 1 test across 1 file. [99.00ms]
```
Green: same test-file command, exit 0 (`04-test-green.log`):
```text

 1 pass
 0 fail
 2 expect() calls
Ran 1 test across 1 file. [104.00ms]
```
Original probe green (`04-probe-green.log`):
```text
[DEEP] mode=already-open; after Settings rebind + storage event: {"mainNew":true,"quizNew":true,"quizOld":false}
[DEEP] PASS: new shortcut used, old shortcut inactive
```
Existing coverage: `bun test apps/desktop/test/keys.test.ts apps/desktop/test/menubar.test.ts apps/desktop/test/keys-contained.test.ts apps/desktop/test/media-keys.test.ts apps/desktop/test/list-keys.test.ts`, exit 0 (`04-existing-green.log`):
```text

 36 pass
 0 fail
 303 expect() calls
Ran 36 tests across 5 files. [164.00ms]
```
Durable fix: all consumers of the shared keymap observe external changes, rather than refreshing only the quiz's copy or remounting a screen.

## Related existing tests

Also ran these files together, unchanged, to cover shared screens and native-source contracts:
`ambience.test.ts`, `app-icons.test.ts`, `glide.test.ts`, `hints.test.ts`, `notion-parity.test.ts`, `one-name.test.ts`, `phone-icloud.test.ts`, `phone-install.test.ts`, `pick-bar.test.tsx`, `source-filters.test.ts`, `quick-style.test.ts`, `undo-waits.test.ts`, `waits.test.ts`, `sfx.test.ts`, `impeccable-round-9.test.ts`, `review-session.test.ts` (all under `apps/desktop/test/`). Exit 0 (`related-tests.log`):
```text

 166 pass
 0 fail
 665 expect() calls
Ran 166 tests across 16 files. [891.00ms]
```
`git diff --check` and `sh -n .githooks/post-commit` passed. No visible elements were added or removed.

## Final verification

Ran each required final command exactly once, after the edits and targeted checks:

1. `bun run typecheck` — **PASS**, exit 0 (`codex-out/shell/final-typecheck.log`).
```text
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
```
2. `bun test packages/core/test apps/desktop/test` — **FAIL**, exit 1 (`codex-out/shell/final-tests.log`). All nine newly added tests passed in this combined run. Final lines:
```text
3 tests failed:
(fail) import coverage: text recognition > a very tall or very wide screenshot is read whole, each line once (F188) [88.87ms]
(fail) the CLI as an agent drives it > an inbox import where every link fails exits non-zero and keeps them [9.27ms]
(fail) cancelling an add > SIGTERM after the source is written takes it back out [9.77ms]

 1825 pass
 3 fail
 10059453 expect() calls
Ran 1828 tests across 245 files. [102.41s]
```

Failures, all in unchanged test/code paths:
- `packages/core/test/intake.test.ts:1327`: `a very tall or very wide screenshot is read whole, each line once (F188)`. This case explicitly removes the OCR stand-in and calls Apple's native Vision helper. Importing `tall.png` raised `Found no text in that image. Add a screenshot with text, or paste what you need.` The output does not establish why Vision returned no usable text; it is not claimed to be a verified baseline failure.
- `packages/core/test/cli-contract.test.ts:54`: `an inbox import where every link fails exits non-zero and keeps them`. Its `Bun.serve({ port: 0, ... })` failed with `EADDRINUSE`, `Failed to start server. Is port 0 in use?`, before the behavior under test.
- `packages/core/test/cancel.test.ts:16`: `SIGTERM after the source is written takes it back out`. Its `Bun.serve` failed with the same port-0 error before the cancellation behavior under test.

No failing test was rerun, skipped, or changed. No fixtures or goldens were updated to mask these failures. All tool command sessions completed; no app or development server was started. A final `ps` inventory was denied by the sandbox, so no process-list verification is claimed.

**Final summary: typecheck passed; combined tests 1,825 passed / 3 failed (1,828 tests across 245 files). Draft outcome: SHELL-01 and SHELL-04 fixed; SHELL-02 skipped due to the existing-test conflict; SHELL-03 failed-install retry fixed, ownerless-lock subcase skipped. Not a green full-suite handoff.**
