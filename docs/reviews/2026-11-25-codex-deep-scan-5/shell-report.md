# Shell reading scout — deep scan 5

Read the native command runner, window/quit/menu/shortcut/tray code, capabilities and release CSP; traced the page-side command, note-save, menu, quick-quiz, media-key and now-playing seams; read the updater, install hooks, CLI bundling and phone-install coordination. Compared against `findings.md`, `sweeps.md`, the four earlier deep scans, the supplied diagnosing loop, and the relevant decisions. Focused on native boundaries the browser journeys do not exercise. Skipped EPUB front matter, highlight animations, previously covered core scheduling cases, and the explicitly excluded open findings. No native app, browser, server, Cargo build, full test suite, real AI, or live library was run. All artifacts and scratch libraries are inside `codex-out/shell/`; production files are unchanged. **Four new findings.** The existing F15 quit boundary also received a headless note-save probe; it is excluded from the findings below to avoid re-reporting that row. Its red runs are retained in [01](logs/01-quit-note-red.log) and [02](logs/02-quit-note-red.log), with passing beforeunload/autosave controls in [03](logs/03-quit-note-beforeunload.log) and [04](logs/04-quit-note-autosave.log).

Snapshot: `05c68297d33d46d6b17b404c101543bc9dfd9557`, Bun 1.4.4, 2026-11-25 UTC. Commands below run from the repository root. Red means the script asserts the required behavior and exits **1** on the observed defect. The [recorded run manifest](logs/runs.json) contains 17 serial runs: 11 expected failures and six passing controls, each under 0.5 seconds wall time. Native delivery is modeled from the checked-in Rust; no claim here that an actual Tauri window was driven.

## Findings

### SHELL-01 — Native Undo operates on the main window while the quick quiz is active

**S2 · Mac · New.** Edit → Undo can restore an unrelated archived source in the main window instead of undoing the rating just given in the quick quiz. Native menu enabled states also describe the main window, so Review → Later is disabled when the main window is on Home even while the quiz is reviewing. This conflicts with D76's same-review behavior and D82's window-specific history.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun codex-out/shell/menu-window.ts
```

```text
[DEEP] active window=quiz; native route=main; main Home menu Later enabled=false
[DEEP] {"mainSourceArchived":false,"quizRatingSaved":true}
[DEEP] FAIL: native Edit > Undo changes the main window instead of the quick quiz
```

**Minimised steps:** Put an archive action on the main window's real `useToast` history; put a rating on a separate real quiz `History`; route the native `ore:undo` event as the Rust handler specifies; run the actual main-page `listenMenu` and shortcut handler. The persistence effects are small booleans, not a real library. The route is extracted/asserted from Rust rather than reimplemented as a guessed focus policy.

**Expected / actual:** Undo affects the quiz rating and leaves the main-window archive untouched. Actual: the archive is undone, the rating remains. The shell explicitly raises the main window before delivering the command there.

**Runs:** Recorded red 2/2 ([05](logs/05-menu-window-red.log), [06](logs/06-menu-window-red.log)). `... menu-window.ts active-control` passes: `{"mainSourceArchived":true,"quizRatingSaved":false}` ([07](logs/07-menu-window-active-control.log)).

**Ranked hypotheses and probes:**

1. Native commands always target the main webview — confirmed by the Rust route and the real recipient's observed mutation.
2. Menu state is built from the wrong window — confirmed independently by `menuSpec` with main Home state: Later is disabled. `QuickQuiz` does not install its own menu/listener.
3. A physical shortcut arrives twice — unnecessary here: the failure occurs with one menu event and no physical key event.
4. The quiz cannot undo its rating — rejected by the active-history control.

**Cause:** [`main.rs:718–726`](../../apps/desktop/src-tauri/src/main.rs) calls `show_main` and unconditionally emits to `main`; [`App.tsx:719–728`](../../apps/desktop/src/App.tsx) builds menu state and registers its sole listener. [`main.tsx:49`](../../apps/desktop/src/main.tsx) mounts `QuickQuiz` instead of `App` in the quiz webview. [`menubar.ts:123–148`](../../apps/desktop/src/menubar.ts) consequently dispatches the synthetic shortcut in the main document. Actual native focus/menu-click ordering has not been driven.

### SHELL-02 — Closing the quick quiz during a rating stores an incomplete session receipt

**S2 · Mac · New.** A rating that lands after the quiz is dismissed is saved, but its session permanently reports zero reviews and zero kept memories. The late save sends no `onLogged` notification either. The durable receipt inconsistency is proven; a visibly stale Home/Review is a related lead rather than a separately claimed reproduction. D76 says each showing is its own counted session; D62 describes session receipts.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun codex-out/shell/quiz-close-rating.ts
```

```text
[DEEP] mode=close-first; saved reviews=1; receipt reviews=0; receipt kept=0; post-close notifications=0
[DEEP] FAIL: closing during a rating permanently stores a zero-review session receipt
```

**Minimised steps:** Create one source and exercise in the script's scratch library through core; begin the real `ReviewSession`; hold the `review` call before it acquires core's library lock; run the same cleanup used when the quick quiz closes; let `session end` complete; release the review. The script uses real `startSession`, `endSession`, `recordReview`, `readReviews` and `readSessions`. It controls the subprocess boundary's completion order and supplies explicit core timestamps; no scheduling sleeps or AI are involved.

**Expected / actual:** The saved session receipt includes the rating associated with its ID. Actual: one review with that ID is in the canonical review log, while the canonical end receipt remains `reviews: 0, kept: 0`. The rating and its FSRS update are not lost. The test isolates the permissible ordering in which the later session-end subprocess reaches the library before the slower review subprocess.

**Runs:** Recorded red 2/2 ([15](logs/15-quiz-close-rating-red.log), [16](logs/16-quiz-close-rating-red.log)). `... quiz-close-rating.ts write-first-control` passes with `saved reviews=1; receipt reviews=1; receipt kept=1` ([17](logs/17-quiz-close-rating-write-first-control.log)).

**Ranked hypotheses and probes:**

1. Cleanup ends the session without waiting for the pending write — confirmed: the receipt completes while the review boundary is held.
2. Core refuses a late review or repairs the receipt — rejected: it accepts the same session ID, saves the rating, and leaves the end receipt unchanged.
3. The normal post-save path notifies the main window to repair the displayed state — rejected at the notification seam: `onLogged` is called zero times.
4. Receipt calculation is wrong even with ordered writes — rejected: the write-first control yields the correct receipt.

**Cause:** [`QuickQuiz.tsx:27–32`](../../apps/desktop/src/QuickQuiz.tsx) unmounts immediately; [`Review.tsx:197–198`](../../apps/desktop/src/Review.tsx) calls session cleanup; [`review-session.ts:238–241`](../../apps/desktop/src/review-session.ts) issues `session end` despite `busy`. Normal submit at lines 489–515 does not repair the ended receipt or call `onLogged` (only the Undo/Redo closures do). [`sessions.ts:139–160,231–232`](../../packages/core/src/sessions.ts) snapshots the reviews available when ending; [`study.ts:64–104`](../../packages/core/src/study.ts) later appends the review without rewriting that receipt. This extends the existing close-mid-save session test's coverage: that test checks the rating/history, not the persisted receipt.

### SHELL-03 — A failed Mac update is never retried on later healthy updater passes

**S2 · Mac · New.** After a pull succeeds but installation fails, the checkout is current and the installed app remains old indefinitely until another relevant change or a manual install. The phone has an installed-head retry mechanism; the Mac has no equivalent.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun codex-out/shell/update-retry.ts
```

Relevant output (full timestamped output in the logs):

```text
[DEEP] mode=transient-failure; passes=3; checkout=new; origin=new; pulls=1; install attempts=1; installed=old
[DEEP] hook log: installing new
transient build failure
FAILED
[DEEP] FAIL: later healthy update passes never retry the Mac install
```

**Minimised steps:** Run the real updater `pass()` against fake Git/process responses; the fake first pull executes a copy of the real install hook against scratch executables. Make the first `app:install` fail; remove that failure; run two more updater passes with unchanged upstream. Both later passes are healthy and idle. The hook copy changes only its cache destination and background execution so the harness can await it; the updater copy exposes `pass()` and redirects its cache/import path. No actual fetch, pull, install, app quit, or phone command occurs.

**Expected / actual:** A later healthy pass retries installation until the installed app reaches the checkout. Actual: only one install attempt across three passes, and the installed-version fixture remains old. A stale lock also prevents the first attempt entirely; the same pass logic does not recover it.

**Runs:** Recorded transient-failure red 2/2 ([11](logs/11-update-retry-red.log), [12](logs/12-update-retry-red.log)). `... update-retry.ts healthy` passes with installed `new` ([13](logs/13-update-retry-healthy.log)). `... update-retry.ts stale-lock` is a separately recorded red variant: three passes, one pull, **zero** install attempts, installed `old` ([14](logs/14-update-retry-stale-lock.log)).

**Ranked hypotheses and probes:**

1. Mac installation is triggered only by a new pull — confirmed: later passes perform no new pull or install after HEAD already matches origin.
2. The hook marks an attempted HEAD as built before the build succeeds — confirmed: `built` is assigned before the failing install and the loop exits at unchanged HEAD.
3. A leftover lock is necessary for the retry failure — rejected for the main case: the ordinary failed hook exits and removes its lock; failure still persists. The separate stale-lock variant also fails earlier.
4. The harness cannot perform a successful install — rejected by the healthy control, which runs the same copied hook and records installed `new`.

**Cause:** [`auto-update.ts:49–54`](../../apps/desktop/scripts/auto-update.ts) relies on the pull's hook for the Mac; lines 56–70 retry only the phone. [`.githooks/post-commit:39–44`](../../.githooks/post-commit) advances `built` before success. Its lines 35–37 use a persistent directory lock without owner/liveness recovery. The stale-lock effect on the phone is listed below as a lead, not a tested native hang.

### SHELL-04 — Quick quiz ignores shortcut changes until relaunch

**S3 · Mac · New.** Changing a Review shortcut in Settings updates the main window but leaves the already-created quick-quiz webview using the old binding. Closing and reopening a quiz showing does not reload its module. D76 promises the same Review controls.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun codex-out/shell/quiz-keymap.ts
```

```text
[DEEP] mode=already-open; after Settings rebind + storage event: {"mainNew":true,"quizNew":false,"quizOld":true}
[DEEP] FAIL: quick quiz keeps the launch-time keymap until relaunch
```

**Minimised steps:** Load two independent instances of the real key module, representing the two webviews; rebind Later from ⌘L to ⌃⌥L in the main instance; deliver a real DOM storage event over the shared stored value; ask both modules which binding matches. No actual physical key or window is needed.

**Expected / actual:** Both windows use the saved new binding and stop using the replaced binding. Actual: the main module uses the new one, while the quiz module still accepts the old one and rejects the new one. Even granting correct cross-webview storage/event delivery does not fix the cached state.

**Runs:** Recorded red 2/2 ([08](logs/08-quiz-keymap-red.log), [09](logs/09-quiz-keymap-red.log)). `... quiz-keymap.ts fresh-control` passes after importing a fresh instance: `{"mainNew":true,"quizNew":true,"quizOld":false}` ([10](logs/10-quiz-keymap-fresh-control.log)).

**Ranked hypotheses and probes:**

1. The quiz keeps a module-local cached keymap — confirmed by the two real module instances disagreeing after the write.
2. Storage itself failed or the new combo was rejected — rejected: rebind returns success, main matches it, and a freshly imported instance reads it correctly.
3. A storage event refreshes the existing module — rejected: explicitly delivering it changes neither match result; there is no listener for it.
4. Reopening the quiz reimports the key module — rejected by the lifecycle trace: the webview survives; only its Review child remounts.

**Cause:** [`keys.ts:200–236,381–382`](../../apps/desktop/src/keys.ts) reads storage at module evaluation and notifies only its own listeners on commit. [`main.tsx:7–16,49`](../../apps/desktop/src/main.tsx) eagerly imports the page modules in each webview; [`QuickQuiz.tsx:17–18,38–42,54`](../../apps/desktop/src/QuickQuiz.tsx) remounts only Review per showing. The hidden quiz window is created in `tauri.conf.json`, not recreated each time.

## Leads — no additional finding claimed

- Review → Quick Quiz appears to emit only a synthetic `quick-quiz` key in the main page, which has no corresponding page handler; OS shortcut registration does not respond to synthetic DOM keys. No full receiving-App red loop was built, so the native menu item's no-op is a lead.
- A late quiz rating can land after `quiz-closed` refreshed main Home/Review; the missing post-save notification is measured above, but stale pixels and a second rating from that stale queue were not reproduced.
- An abandoned `app-install.lock` also makes `apps/phone/scripts/install.ts:69–71` wait without an owner check or deadline. Mac skipped-install behavior is red above; no phone worker was started to prove the resulting wait.
- The Rust runner writes all stdin before draining stderr, has no general timeout, and can wait on child-owned pipes. No actual supported CLI command was shown to deadlock; do not report a generic hypothetical hang.
- Replacing the installed bundle while a frontmost old process is running could mix page/CLI builds depending on macOS executable-path behavior. No native process/bundle swap was allowed or performed.
- Diagram PNG export embeds font data inside a blob SVG. Nested-image font/CSP behavior needs a WebKit-specific check; no refusal was established headlessly.

## What passed / coverage limits

- Pending-note control: the same note is submitted correctly on `beforeunload` and on its 800 ms autosave; the explicit quit event successfully stores the kept review-draft control.
- Window-history control: directing Undo to the quiz's actual `History` removes only the rating, leaving the other window's archive untouched.
- Session ordering control: completing the rating before cleanup writes a consistent real receipt with one review and one kept memory.
- Update control: a successful first build reaches the new installed-head fixture through the same actual hook logic.
- Shortcut persistence control: a newly initialized key module reads the new binding and drops the old one.
- Static command trace: `Command::new(...).args(...)` passes arguments directly, not through shell interpolation; no quoting defect found for spaces, Unicode or literal shell characters. This is source reasoning, not a native process test; the known oversized-argv row was not repeated.
- Static scope trace: asset serving is explicitly allowed for the library directory; opener URL schemes and path scopes are restricted in capabilities; no demonstrated scope escape. This is not a security clearance of every core command exposed by the bridge.
- Static window trace: main close hides the main window; quiz close emits `quiz-away` instead of destroying the quiz; global shortcut and tray paths have a direct native toggle route. Their real AppKit behavior remains untested.
- Static install trace: compilation/build failure occurs before the old app is trashed; the install hook serializes ordinary concurrent builds and loops when HEAD advances. No actual installer or mid-copy failure was run.
- Static CSP trace: emitted fonts stay files; source assets use the allowed asset protocol; original PDF loads its bundled worker and carried binary data; the YouTube parent iframe uses the allowed loopback relay, whose separate document hosts YouTube. No definite new CSP refusal was found. Release-check, renderer behavior and device media controls were not run.
