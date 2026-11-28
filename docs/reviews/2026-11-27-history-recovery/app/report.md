# Ore history recovery — app scout

Read-only audit of commit `50f0ef10203bd04ea4029c60ad7616822de6c103`, on 2026-11-27. The checkout reports branch `claude/project-thread-gtg2ev`, rather than the prompt's `master`; I did not switch it. Covered the window's inverse-command history, Reader highlight merging and stand-in IDs, source-note refresh and save merging, Review's reconciliation after review logs shrink, the phone's disk cache, and agent-facing recovery guidance. Read the working agreement, D5/History, relevant decisions, findings, coverage queue, and the supplied diagnosing-bugs phases 1–4. Executed only short, serial Bun scripts against private scratch libraries, with real core/CLI command handlers and git snapshots/restores. No app, browser, server, watcher, AI, broad tests, or real library was started or touched. Skipped native gesture execution, rendered Reader remounts and selection, real iCloud transport, and a complete snapshot-content inventory; those are not proven by these headless checks. No production files or findings rows were changed.

All commands below run from `/Users/tylerpoelking/Developer/ore-wt/history-recovery`. Each script recreates only its own library under `codex-out/app/libs/`. `support.ts` pins time, disables enrichment, puts rejecting `claude`/`codex` stubs first on PATH, uses `snapshot(lib, {force: true, now})`, and dispatches the real CLI command handlers in-process. This avoids another Bun process; it does not test the CLI subprocess bridge or its automatic snapshot wrapper. Red commands intentionally exit 1 at the symptom assertion. Full output is saved beside each script.

## Findings

### app-01 — Undo overwrites a recovered highlight note with a pre-restore value

**S1 — canonical text overwritten. Both Mac and iPhone shared logic.** The native iPhone gesture itself was not executed: `phone/native-undo.ts:21–27` routes it into the same window history (D82, D275).

**Red command:**

```sh
(ulimit -t 25; bun codex-out/app/undo-highlight.ts checkout)
```

Output, omitting the assertion stack:

```text
restore mode: checkout
after restore: A: recovered note
core revision before Undo: 1
captured undo still present: true
after Undo: B: intermediate note
errors: []
AssertionError: app-01: old Undo must not replace the recovered note
```

The same command with argument `restore`, `whole`, `revert`, or `stash` fails on the same assertion. These execute, respectively, `git restore --source <A> -- <source-dir>`, `git checkout <A> -- .`, `git revert --no-edit HEAD`, and `git stash push -- <source-dir>`. Logs: `undo-checkout.log`, `undo-restore.log`, `undo-whole.log`, `undo-revert.log`, `undo-stash.log`.

**Minimised steps:**

1. Create a highlight whose note is A and force a snapshot.
2. Change that note to B, then change it through the app's `highlights.setNote` to C. Its Undo captures B. Wait for all writes to settle.
3. Restore the snapshot containing A. Feed a fresh annotation read into the app's real `highlights.read`; the screen's model now holds A.
4. Invoke the real window `History.undo`. Read the canonical annotation again: its note is B.

**Expected:** an inverse operation whose expected C is no longer current must preserve A and explain that the step no longer applies. **Actual:** the inverse writes B over the recovered A, without an error. Git still contains A, but the active library is wrong again immediately after recovery.

**Ranked hypotheses and probes:**

1. **Undo retains B and blindly applies it to the restored state — confirmed.** The closure retains `was`, and replay reaches the real `annotate` command with B. No external write remains in flight.
2. **Highlight refresh failed or incorrectly retained a newer local revision — rejected for this loop.** The completed read displays A; core also reports A at revision 1 before Undo. The standalone stand-in control passes.
3. **Core selected the wrong revision independently of Undo — rejected for this loop.** Both disk and app read A until the inverse command runs. `undo-highlight.ts control` performs no restore and correctly undoes C to B.
4. **A generic failure of all history conflict guards — narrowed.** The source-title guard works. Source importance does not: a second red loop restores P1, then its older priority Undo writes P2.

Companion red command:

```sh
(ulimit -t 25; bun codex-out/app/undo-list.ts)
```

```text
PASS: title Undo preserves restored title and explains why
priority after restore: P1; after its Undo: P2
AssertionError: app-01 companion: importance Undo must not overwrite restored priority
```

This companion invokes the priority step's own toast Undo (`History.take`) after the title step refuses; it does not pretend the normal Undo key skips a refused step.

**Cause:** `apps/desktop/src/highlights.ts:181` captures `was`; line 189 registers unguarded inverse/redo calls; lines 184–186 send the write without checking its expected current note. `apps/desktop/src/list-actions.ts:133–142` has the same issue for priority through `valueChange`. The title's contrasting guard is at `list-actions.ts:124`, implemented in `change.ts:48–64`. `History` retains these steps across the refresh. This is not a recurrence of the fixed title-specific F175/F654: that control passed. Nor does this require the pending-write races of F350/F632.

**Fix I would make:** give these inverse writes an expected current value, checked against the canonical field under the core write lock before applying Undo or Redo. If the expected value has changed, leave the restored value alone and identify the unavailable step. Follow the existing title protection's behavior while avoiding a new read/write race. Add guards for the two demonstrated fields and review other inverse writers separately; merely redrawing the screen or clearing highlight stand-in IDs does not address this loop. Keep D82's inverse-command history rather than using it to restore whole-library snapshots.

### app-02 — Open Review keeps a rating that recovery removed

**S2 — wrong open-session state and an unusable Undo. Both Mac and iPhone shared Review logic.** The canonical due calculation recovers correctly in this loop; this is not a claim that FSRS itself remains corrupted.

**Red command:**

```sh
(ulimit -t 25; bun codex-out/app/review-restore.ts normal)
```

Output excerpt (`review-normal.log` contains the complete output):

```text
restored core due contains rated exercise: true
open Review queue contains rated exercise: false
restored reviews since session started: 0
open Review reviewed: 1 activeMs: 20000 canUndo: true
Undo rejected: true history remains: true
same Undo rejects again: true
fresh session contains restored exercise: true
AssertionError: app-02: a restored due exercise must reenter the open review queue
```

The omitted error line names the removed timestamp and generated exercise ID: the requested review “is not …'s latest”. This is a core refusal, not a swallowed exception.

**Minimised steps:**

1. Create two fact exercises and review both seven days before the pinned current time, so both are due. Start the real `ReviewSession` on their source.
2. Snapshot the review logs, then rate the first exercise Good in the open session. Wait for the rating and snapshot again.
3. Run `git restore --source <before-rating> -- reviews`. Read `due --all --source <id>` through the real CLI handler.
4. Run the methods used by the screen's external-library refresh: `stillDue(freshIDs, true, false)` and `settingsChanged()`.
5. Inspect the queue, count and Undo; invoke Undo twice. Open a fresh session as a control.

Two exercises keep the original session open after the first rating. Earlier review lines keep the restored review month present and give the removed rating a distinct predecessor. No concurrent write or midnight change is needed.

**Expected:** reconcile the active session with the restored log, or explicitly invalidate/restart that session. A rating absent from the canonical log must not remain offered as a repeatedly failing Undo. The exercise made due by recovery must be reachable without silently depending on closing and reopening Review. **Actual:** the open queue still omits it, the model retains one reviewed exercise and 20 seconds, and the missing rating remains on both session and window histories. Each Undo fails on the same step. A fresh session immediately includes the exercise.

**Ranked hypotheses and probes:**

1. **Session reconciliation only removes queue entries and retains its old rating bookkeeping — confirmed.** Fresh due IDs include the restored exercise; the existing queue cannot add it. Session `reviewed`, `activeMs` and rating Undo remain unchanged.
2. **The index or FSRS replay did not notice the shortened log — rejected for this loop.** The real `due` handler and a newly opened `ReviewSession` both include the exercise without `ore reindex`.
3. **Ordering between the screen's due refresh and settings refresh causes it — rejected for the tested orders.** `review-restore.ts reverse` first completes `settingsChanged`, then reconciles due IDs; it produces the same red output (`review-reverse.log`).
4. **Undo fails only transiently while a write is busy — rejected.** All rating writes have landed before restore. Two subsequent attempts fail on the same missing timestamp and leave the history step available again.

**Cause:** `apps/desktop/src/Review.tsx:205–218` turns a fresh due result into IDs and asks `stillDue` to reconcile. `review-session.ts:322–325` only filters the existing queue. `settingsChanged` at lines 301–316 updates settings and applies another filter, but does not reconcile rating history or session time. `undoRating` calls the old timestamp at line 554 and adjusts the session only after success at lines 565–567. `history.ts:83–91` returns the refused operation to the Undo stack, making this permanent stale step retryable. F173 covered external ratings/deletions and edited exercises; this loop specifically reverses a recorded rating, making a previously consumed exercise due again. F632's held-write ordering is not involved.

**Fix I would make:** on external refresh, check whether the session's recorded rating IDs/timestamps still exist. If a recovery removed one, discard those obsolete rating inverses and rebuild the affected session queue and progress from canonical data, or stop the session with a clear explanation and a restart action. Preserve any answer currently being typed. Do not work around the missing timestamp by undoing whichever rating happens to be latest; that would delete a different review.

### app-03 — The agent instructions never explain snapshot recovery

**S3 — UX/documentation gap. Mac recovery workflow; restored files can serve both devices.** This is a reproducible documentation check, not a claim about what a particular model would choose to do.

**Red command:**

```sh
(ulimit -t 25; bun codex-out/app/recovery-guidance.ts)
```

Output excerpt (`recovery-guidance.log` includes the full rules):

```text
PASS: snapshot contains lost words; generated instructions match the template
recovery commands: []
guide names snapshots or git recovery: false
skill names snapshots or git recovery: false
AssertionError: app-03 UX: agent-facing instructions need a usable route to D5 recovery
```

**Minimised steps:** initialise a library; save a note and force a snapshot; replace the note and snapshot again; prove `git show <old>:<note-path>` still contains the lost words; inspect the generated library guide, `/ore` skill and command registry. The check fails even though the data needed to recover exists.

**Expected:** the instructions identify the D5 snapshots and a supported route for retrieving lost writing or recovering a wider set of files, including what to do with an open app and phone writes. **Actual:** neither guide names snapshot recovery, and there is no top-level `history`, `recover` or `restore` command. The library guide says to say so when no command handles the request; the skill says “If no command does what you need, say so and stop.” An agent must invent the recovery procedure or ask Tyler to resolve the gap.

**Ranked hypotheses and probes:**

1. **The source guides omit recovery — confirmed by reading them and the red check.** D5 history is described in the repository specification but not the library's operational instructions.
2. **A dedicated CLI command or referenced guide supplies it — not found.** Inspected the actual command registry and searched the skill and its reference files; card-state operations are not a snapshot recovery route.
3. **Only the generated library copy is stale — rejected.** A newly initialised library's AGENTS.md is byte-for-byte the current template.
4. **There is no snapshot of the lost text — rejected.** The control reads the original words from a real forced snapshot.

**Cause:** the omission in `packages/core/src/templates/library-agents.md`, alongside the writer restrictions at lines 7–11, and `skills/ore/SKILL.md:22–25` and its mode routing. `docs/SPEC.md:40` promises local snapshot history but provides no route through these agent-facing documents. This does not report F238's old manual-edit advice as recurring: the restrictions added to prevent that problem are present.

**Fix I would make:** document read-only discovery of snapshots and previewing the intended version, with lost note text restored through `ore notes` when that fits the request. For arbitrary source/log/whole-library recovery, document the supported recovery operation, preservation of the current state, quiescing pending writes, and reloading app state afterward. A broad raw-git write exception would change the existing writer rule and needs Tyler's explicit decision; do not silently remove that rule. The omission alone does not prove that individual notes cannot be recovered using existing commands.

## Leads — not findings

- **Focused Mac window or a return in under ten seconds may not discover a restore:** `App.tsx:402–415` refreshes after a ten-second absence; no library filesystem watcher was found in the Tauri shell. No red loop drove the actual App focus effect, so this remains a lead, not a recurrence claim for F173/F724.
- **Reader body changes remount its view:** `Reader.tsx:1228` reloads when `doc.md` body differs. Selection, scroll, editor cleanup, and pending anchor changes across that remount were read but not exercised; the highlight and note controls below do not prove those DOM paths.
- **Restore while a write/read is genuinely in flight:** the confirmed Undo loop deliberately waits for writes and then performs a completed fresh read. `busy`/`recent` merge protection during a simultaneous git restore needs a separate deterministic gated-write loop.
- **Real iCloud conflict/download order:** the phone control uses the existing mock shell's file commands without starting its server. It proves cache behavior after delivery, not when or in what order iCloud delivers a whole-day restore, a deletion, or a conflict copy.

## What passed

- `(ulimit -t 25; bun codex-out/app/undo-highlight.ts control)` — without an external restore, C undoes to B; `undo-control.log`.
- Title Undo in `undo-list.ts` preserves the restored title and reports the conflict; F654's guard remains effective (the script subsequently fails on priority).
- `(ulimit -t 25; bun codex-out/app/highlight-controls.ts)` — a completed highlight save swaps its stand-in ID; a fresh read after restore removes that saved highlight and retains the older one without a duplicate; `highlight-controls.log`.
- `(ulimit -t 25; bun codex-out/app/notes-controls.ts)` — the actual source-note hook accepts restored text on `LIBRARY_BACK`; flushing does not rewrite the newer text. Pending edits in a different paragraph preserve the recovered paragraph; overlapping edits keep both versions under current merge policy. Headless React hook plus `editor/preserve.ts`, not the mounted rich-text editor; `notes-controls.log`.
- `(ulimit -t 25; bun codex-out/app/phone-controls.ts)` — a clean mounted phone cache accepts a delivered restored note even with its disk mtime forced back to 2020; its in-memory mtime advances so change detection can see it; it sends no upload and has zero unsent files; `phone-controls.log`.
- The phone's genuinely unsent edit does overwrite the Mac restore when `rescan` first flushes it. This matches **D222**, rather than misclassifying a clean cache as dirty. Recovery guidance should account for it; changing that conflict policy requires a decision. Cause of the observed order: `phone/fs.ts:401–405`.
- The real due handler and a new Review session see the exercise made due by the restored review log without manual reindexing; only the existing session remains stale in app-02.
- The note snapshot contains the original words and a newly initialised library receives the current agent template; app-03 is an instruction gap, not missing note snapshot content.

Final scope check: `git status --short` is empty. All new artifacts are in the ignored `codex-out/app/` folder. No fixes, production tests, commits, pushes, or findings-row edits were made.
