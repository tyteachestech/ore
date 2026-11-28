# Snapshot scout — history recovery

Read-only scout of commit `50f0ef10203bd04ea4029c60ad7616822de6c103`, 2026-11-27, Bun 1.4.4 on Tyler's Mac. Covered `history.ts`, both callers, initialization and ignore rules, locks, session receipts, cut/reimport storage, inbox storage, agent instructions, the Mac CLI bridge, and the phone command/filesystem path. Exercised real Git against isolated libraries, including recovery operations and a deterministic overlapping-snapshot schedule. Six findings below: two S1, three S2, one S3; SNAPSHOT-01 is a recurrence of **F643**, and SNAPSHOT-06 is a UX/documentation miss. No application code, findings registry, live library, installed app, or other scout's output was changed. No app, browser, server, watcher, AI, e2e, bench, or full test suite ran. Phone/iCloud conclusions are code traces, not a device test; reader/index/UI behavior after recovery remains outside this scout's assignment. All writes, scripts, Git repos, and evidence are under `codex-out/snapshot/`; Bun runs were serial and the longest measured script took 1.43 seconds wall time.

## Findings

Commands below run from the repository root. Each red command exits **1**. `harness.ts` supplies isolated libraries, fixed Git author/committer dates, fake failing `claude`/`codex` executables first on PATH, and `ORE_NO_ENRICH=1` / `ORE_NO_TOOLS=1`. Clock-dependent cases use explicit logical times or relative offsets without sleeping. Source IDs are generated; they do not affect verdicts.

### SNAPSHOT-01 — A rejected overlapping snapshot contaminates a successful snapshot (F643 returns)

**S1 · Mac; either device can later read the damaged restored history.** D5 and the library-lock rule. Existing row **F643**, fixed #538, claims snapshots cannot capture a half-written change. This interleaving reproduces that symptom again; it is not a duplicate report of the already-fixed single-snapshot scenario.

**Red command:** `bun codex-out/snapshot/interleave.ts`

```text
nested: { committed: false }
stageAfterRejected: { a: "next", b: "complete", lockHeld: true }
outer: { committed: true }
savedA: "next"
savedB: "complete"
FAIL: snapshot contains one complete write, never half of the next write (F643)
```

Full output: `codex-out/snapshot/output/interleave.txt`.

**Minimised steps:** (1) Commit two files together. (2) Change both to `complete`; snapshot A stages them under the library lock, then releases it. (3) Before A's diff/commit, another logical writer holds the library lock and changes only A's first file to `next`. (4) Snapshot B, forced as session-end can be, runs its outside-lock `git add -A`, then declines to commit because the writer holds the lock. (5) The writer finishes its second file and releases the lock. (6) Snapshot A commits. Git holds first file `next`, second file `complete`, although the worktree now holds both `next`.

**Expected vs actual:** A must commit one complete state. Instead, B's rejected attempt replaces A's staged state with a partial transaction. Restoring that commit restores a mixed state.

**Ranked hypotheses and probes:**

1. **Shared Git index contamination after A releases the lock.** Predict B changes the staged bytes despite returning `committed:false`. Confirmed: `git show :a.txt` / `:b.txt` report the mixed pair while the library lock is still held.
2. **The writer failed to finish the second file.** Predict the worktree would also remain mixed. Rejected: the script writes both `next` before A commits; only the staged/committed state is mixed.
3. **The library lock is not excluding B.** Predict B would commit or acquire the held lock. Rejected: B returns false and the lock is present. The earlier, outside-lock staging bypasses it.

`PROBE_NO_NESTED=1 bun codex-out/snapshot/interleave.ts` passes with both committed files `complete` (`output/interleave-control.txt`). The script uses one Bun process and an explicit scheduler seam around `Bun.spawnSync`, running the actual nested `snapshot` and real Git commands; it does not fabricate Git replies. Two files are the minimal representation of a multi-file library transaction. This is a deterministic interleaving proof, not an observed native multi-process race or a test of FSRS itself.

**Cause:** `packages/core/src/history.ts:22` changes the shared Git index before locking; `:25` releases the library lock before `:31–32` consume that index. Git's own short-lived index lock does not cover the whole snapshot transaction.

**Fix proposed:** Isolate each snapshot's staging state or serialize the complete snapshot operation with its own lock, while keeping large-file preparation outside the library write lock. Ensure the validated staged tree cannot change before commit. Extend F643's guard with two overlapping snapshot attempts and one multi-file writer; retaining only the existing single-snapshot guard misses this schedule.

### SNAPSHOT-02 — Snapshot silently resolves and commits an unfinished Git conflict

**S1 · Mac; resulting files sync to iPhone.** D5 recovery integrity.

**Red command:** `bun codex-out/snapshot/conflict.ts`

```text
unmergedBefore: true
unmergedAfter: false
committed: true
headChanged: true
stored: "<<<<<<< HEAD\nToday note.\n=======\nRecovered branch note.\n>>>>>>> …"
rebaseContinue: success
FAIL: snapshot leaves unresolved recovery conflicts unmerged and uncommitted
```

Full output, including the exact generated commit ID: `output/conflict.txt`.

**Minimised steps:** Create a source note and snapshot it. Make conflicting note edits on two branches. Rebase the recovery branch onto the normal branch, stopping at that conflict. Run one eligible snapshot (a normal successful `ore` command reaches it, or session end forces it). Run `git rebase --continue`.

**Expected vs actual:** History should leave an unfinished recovery operation untouched and report why it cannot snapshot. Instead, automatic `git add -A` marks the unresolved file resolved, a new snapshot commits literal conflict markers, and Git accepts `rebase --continue` without a human resolving them. The conflicted worktree existed before the snapshot; the newly introduced damage is clearing its unresolved state and publishing it as a completed recovery commit.

**Ranked hypotheses and probes:**

1. **Automatic staging clears Git's unmerged entries.** Predict staging alone removes those entries without moving HEAD. Confirmed by `PROBE_ADD_ONLY=1 bun codex-out/snapshot/conflict.ts`: `unmergedAfter:false`, `headChanged:false`.
2. **`git commit` alone overrides unresolved entries.** Predict a commit-only attempt would clear them. Rejected by `PROBE_COMMIT_ONLY=1 ...`: `unmergedAfter:true`, no commit, assertion passes.
3. **Ore note saving created the conflict marker text.** Predict it exists before the Git recovery operation. Rejected: both branches contain normal notes created through core; Git creates the conflict, verified by the unmerged entries immediately before snapshotting.

Controls are saved as `output/conflict-add-probe.txt` and `output/conflict-commit-probe.txt`.

**Cause:** `packages/core/src/history.ts:13–22` checks only that `.git` exists before staging; `:32` commits without guarding an unfinished merge/rebase/cherry-pick/revert or unmerged index entries.

**Fix proposed:** Before touching the index, resolve Git's actual metadata directory and detect unfinished recovery operations or unmerged entries. Skip automatic snapshots with an actionable history-status message until the agent resolves or aborts the operation. Do not auto-stage conflict resolution. The guard must also work when `.git` is a worktree pointer file.

### SNAPSHOT-03 — Ending Review reports failure after saving when Git is absent

**S2 · Mac.** Direct violation of SPEC History/D5: snapshotting must never fail a command. No actual GUI crash is claimed.

**Red command:** `sh codex-out/snapshot/session-no-git.sh`

```text
ore: Executable not found in $PATH: "git"
{"error":"Executable not found in $PATH: \"git\""}
end receipt saved: True
FAIL: session end exited 1 although its end receipt was saved; history must never fail a command (D5)
```

Output: `output/session-no-git.txt`. The shell script creates a fresh session with core, then launches the real `packages/cli/src/ore.ts session end --json` using the absolute Bun executable and a PATH containing only the AI stubs. It checks the saved session receipt after the CLI exits. Every Bun process finishes before the next begins.

**Minimised steps:** Initialize a scratch library with Git available; start a review session; run `ore session end --json` in a fresh process with Git unavailable.

**Expected vs actual:** Return the successful session result even if history cannot save. Instead, the CLI returns exit 1 and error JSON after closing the session. The app receives a failure for a write already done; retrying cannot simply finish the same open session again.

**Ranked hypotheses and probes:**

1. **Forced snapshot bypasses the general exception handler.** Predict normal commands work without Git but session end fails. Confirmed: `sh codex-out/snapshot/ordinary-no-git.sh` returns `[]` and passes (`output/ordinary-no-git.txt`).
2. **Session persistence itself needs Git.** Predict no end receipt after failure. Rejected: a valid end receipt was saved.
3. **Session-end statistics or the index need Git.** Predict removing the history repo would still fail. Rejected: `PROBE_NO_REPO=1 sh codex-out/snapshot/session-no-git.sh` succeeds with the same missing-Git PATH (`output/session-no-repo-control.txt`).

An initial in-process PATH mutation was discarded: this Bun process could still resolve an executable used earlier. The final reproducer starts a fresh process with the restricted PATH and reaches the genuine missing-executable throw.

**Cause:** `packages/cli/src/cmd-study.ts:325–327` saves the receipt and calls `snapshot` without a catch; `packages/core/src/history.ts:18` can throw on spawn. The catch in `packages/cli/src/ore.ts:43–46` is too late, after `cmd.run` returns.

**Fix proposed:** Make best-effort snapshot behavior apply to the forced session-end call too, preferably at the snapshot boundary so every caller gets consistent behavior. Preserve the successful session result and surface history unavailability separately. The Mac bridge already appends `/usr/bin:/bin:/usr/sbin:/sbin` to PATH (`apps/desktop/src-tauri/src/main.rs:93–100`), so a normal Finder launch's short PATH alone does not reproduce this; missing/broken Git remains a supported failure case under D5.

### SNAPSHOT-04 — A clean read consumes the next ten-minute snapshot window

**S2 · Mac; phone changes arriving on Mac are subject to the same gate.** SPEC History/D5 says the interval is from the last snapshot.

**Red command:** `bun codex-out/snapshot/clean-check.ts`

```text
clean: { committed: false }
result: { committed: false }
minutesSinceLastCommit: 21
dirty: true
savedNote: "Old note."
FAIL: first write after a 20-minute-old snapshot is captured even after a clean read
```

Output: `output/clean-check.txt`.

**Minimised steps:** Make a snapshot and age its marker by 20 minutes. Run an eligible snapshot on an unchanged library, as an ordinary read command does. Save a new note one logical minute later and run the ordinary snapshot path.

**Expected vs actual:** The new note is eligible because the last committed snapshot is 21 minutes old. Instead, the clean check refreshed the marker despite committing nothing, and the new note is skipped. If Tyler stops there, it remains absent from history until a later eligible command; no timer saves it during idle time.

**Ranked hypotheses and probes:**

1. **The marker records the last attempt, including a clean check.** Predict removing the clean check makes the note snapshot. Confirmed: `PROBE_NO_CLEAN=1 bun codex-out/snapshot/clean-check.ts` passes.
2. **The note write was lost or Git sees no change.** Predict a forced snapshot also finds no change. Rejected: the worktree is dirty and `PROBE_FORCE=1 ...` commits `New note.`.
3. **Git, branch state, or the library lock rejects the commit.** Predict bypassing only the interval would still fail. Rejected by the same forced control on the fresh attached branch.

Control outputs: `output/clean-check-no-read.txt`, `output/clean-check-force.txt`. The script sets only a scratch marker's mtime and uses relative logical times; there is no clock sleep or race.

**Cause:** `packages/core/src/history.ts:20` refreshes `last-snapshot` before checking for changes; `:31` returns clean without restoring the previous marker. The code explicitly wants a backoff on Git failure, but also applies it to a successful no-change check.

**Fix proposed:** Distinguish the last successful snapshot time from retry/scan throttling. A clean check must not delay the first subsequent dirty command beyond the documented last-snapshot interval. Keep the intended failure backoff and lock-busy immediate retry separate; retain the existing ten-minute behavior for successful commits.

### SNAPSHOT-05 — Detached recovery leaves later snapshots outside the normal history branch

**S3 · Mac · recovery UX.** Recoverable through Git's reflog; this is not a claim of immediate permanent data loss.

**Red command:** `bun codex-out/snapshot/detached.ts`

```text
result: { committed: true }
namedBranchContainsSnapshot: false
visibleAfterReturning: "Today's note."
reflogContainsSnapshot: true
FAIL: new snapshot remains reachable from the normal history branch
```

Output: `output/detached.txt`.

**Minimised steps:** Snapshot an earlier note and today's note. An agent checks out the earlier commit, leaving detached HEAD. Save a new note through core and snapshot it. Return to the normal branch.

**Expected vs actual:** Ore should preserve a discoverable named recovery history, or clearly say new work is accumulating on a detached history before it gets abandoned. It instead reports `committed:true`, but no named branch contains that commit; returning to the normal branch removes the new note from view and from its ordinary `git log`. The reflog still contains it, so recovering requires extra Git knowledge.

**Ranked hypotheses and probes:**

1. **Snapshot commits onto whatever HEAD currently names, including detached HEAD.** Predict a path-only restore on the normal branch keeps the new commit reachable there. Confirmed: `PROBE_PATH_RESTORE=1 bun codex-out/snapshot/detached.ts` passes, with the new note still visible (`output/detached-path-control.txt`).
2. **Snapshot failed to save the note.** Predict there is no resulting commit. Rejected: it returns true and its commit contains the new work.
3. **The work is permanently deleted.** Predict reflog cannot locate the commit. Rejected: `reflogContainsSnapshot:true`; the issue is silent abandonment of the named history.

**Cause:** `packages/core/src/history.ts:13–32` neither checks symbolic HEAD nor keeps a named snapshot ref independent of the agent's checkout.

**Fix proposed:** Protect detached snapshots with an explicit named recovery ref and report their state, without silently switching the agent's branch. Document path-level restoration for normal recovery and the step needed to preserve work made while detached. Avoid treating this as a generic Git error: the commit itself succeeds.

### SNAPSHOT-06 — Agent instructions provide no way to use the recovery history

**S2 · Both devices' recovery, performed on Mac · UX/documentation miss.** The requested recovery workflow depends on an agent. The supplied guides explicitly require stopping where a command is missing, and provide no history workflow.

**Red command:** `bun codex-out/snapshot/guide-gap.ts`

```text
packages/core/src/templates/library-agents.md:
  tellsAgentToStop: true; gitRecoveryCommands: false
FAIL: agent has a documented way to recover an overwritten file: packages/core/src/templates/library-agents.md
skills/ore/SKILL.md:
  tellsAgentToStop: true; gitRecoveryCommands: false
FAIL: agent has a documented way to recover an overwritten file: skills/ore/SKILL.md
Recovery commands: []
```

Full output: `output/guide-gap.txt`. This is a static executable documentation/command-table check, not an agent conversation or a GUI test.

**Minimised steps:** Ask an agent following either shipped guide to restore an overwritten file. Its only supported writer is `ore`; the command table has no history/recover/snapshot route, and the guides tell it to stop when no command can do the task. Neither explains how to inspect Git history, recover prior user wording through an existing setter, or perform a coherent larger recovery.

**Expected vs actual:** The agent should have a supported, bounded recovery procedure. Instead Tyler must supply undocumented Git instructions or separately relax the rule, then know to protect current work, avoid detached/unmerged pitfalls, and verify restored data.

**Ranked hypotheses and probes:**

1. **The guides omit the intended recovery path.** Confirmed by both independently read guides and the red check.
2. **A recovery command is already present but undocumented.** Rejected by inspecting the actual `commands` table and CLI usage; there is no general snapshot restoration route.
3. **Only the source template is stale; initialized libraries contain recovery guidance.** Rejected by the generated `libs/inventory/AGENTS.md`, which comes from that template. SPEC describes automatic history, but is not the library's shipped agent procedure.

**Cause:** `packages/core/src/templates/library-agents.md:9–11`, `skills/ore/SKILL.md:24–25`; absent recovery instructions in both, with no corresponding CLI command.

**Fix proposed:** Add a supported recovery procedure and an explicit boundary for writes. It should inspect versions and available backups first, preserve current work, restore user wording through core where that suffices, and define how larger coherent restores are performed and checked. Include snapshot exclusions, the phone/Mac dependency, and what to do when history is unavailable. Do not merely tell agents to run arbitrary Git writes around Ore's invariants; either provide a safe core command or settle a narrow recovery exception with Tyler.

## Leads — not findings

- **Remote iCloud writes during a Mac snapshot:** the Mac's `.ore/lock` cannot lock incoming iCloud replacement files, so a multi-file phone change might be captured midway. Code trace only; no real iCloud schedule or red loop was run.
- **Excluded intermediate versions:** `.ore/cuts` and `.ore/reimport` can contain useful recovery data absent from Git; cut receipts were confirmed excluded, but this pass did not demonstrate permanently unique lost text beyond the documented snapshot interval. The kept original preserved the cut paragraph in the inventory test. Reimport stashes are pruned after one day by a later reimport.
- **Long Git subprocesses:** no timeout is set on snapshot Git calls. Signing, filters, iCloud downloads, or a very large recording could substantially delay a command. The small timing run establishes synchronous waiting, not an everyday long-stall finding.
- **Doctor with a worktree's locked index:** doctor checks `<root>/.git/index.lock`, while a worktree's actual index is elsewhere. The normal worktree snapshot passed; no locked-worktree red loop was built, so this remains a lead.

## What passed

- `bun codex-out/snapshot/git-states.ts`: first snapshot in an unborn repo succeeds.
- Same script: `git checkout <sha> -- <path>`, `git restore --source <sha> -- <path>`, and `git checkout <sha> -- .` are snapshotted on the current branch in the tested one-file history.
- Same script: a clean `git revert` remains committed; a clean stash survives a snapshot, and its later clean pop is captured.
- Same script: a busy library prevents that attempt from committing, and the next **non-forced** snapshot succeeds immediately. This single-attempt case of F643 remains fixed; the overlapping case above does not.
- Same script: a stale `.git/index.lock` returns false without throwing; `doctor` warns and `doctor --fix` removes it, after which a forced snapshot succeeds.
- Same script: a `.git` pointer file created by `git worktree add` works and commits on that worktree's branch.
- Same script: missing `.git` returns false without accidentally staging or committing into the parent code repository. It does not initialize history automatically.
- `sh codex-out/snapshot/ordinary-no-git.sh`: ordinary CLI reads succeed with Git unavailable; session end is the exception above.
- `bun codex-out/snapshot/timing.ts`: a five-minute edit is not yet in Git; exactly ten minutes is eligible; a forced snapshot bypasses the interval. This script characterizes current behavior, including the clean-check delay isolated as SNAPSHOT-04.
- `bun codex-out/snapshot/inventory.ts`: all tested visible layout families are committed; `.index/` and `.ore/` are excluded; queued/removed inbox files and their attachments are committed; the original text retains the cut passage.
- `bun codex-out/snapshot/perf.ts`: 25- and 100-source runs finish quickly, old binary blobs remain readable after replacement, and both stages' lock states are observed. No 950-source run occurred.

### What a snapshot contains

The Git rule is `git add -A` with the library's `.gitignore`, not an extension allowlist. Initial ignore rules come from `packages/core/src/init.ts:38`: `.index/`, `.ore/`, `.DS_Store`. Already tracked files remain tracked despite later ignore rules; custom Git configuration can also change exclusions. The test uses isolated Git config.

| Library content | In a normal snapshot? | Recovery implications |
|---|---|---|
| `AGENTS.md`, `CLAUDE.md` symlink, `.gitignore`, `skills.yaml`, `fsrs-params.json` | Yes | Config and agent rules have versions too. |
| `topics/*.md`; source `doc.md`, metadata, recalls/prequestion attempts | Yes | The source's saved learning state is in Git. |
| Source notes; skill notes; `skills/<id>/digs.json` | Yes | Saved words and Dig records are recoverable at commit boundaries. |
| `annotations[.<device>].jsonl`, exercises, variants | Yes | All visible per-device histories, including the phone's, are included once present on Mac. |
| `reviews/*`, `sessions/*`, `chats/*` | Yes | Saved reviews/answers, session receipts, and saved chats are included. |
| `source.*`, audio/video/PDF/EPUB originals, VTT transcripts, thumbnails, assets, note images, drawings, course images and item-local sidecars | Yes | No size/type exclusion. A changed binary gets another Git blob; unchanged content is reused. |
| `feeds.yaml`, `feeds/read.<device>.jsonl` | Yes | Subscriptions and read marks are retained. |
| `inbox/*.link.json`, `*.file.json`, `inbox/<id>/<file>` | Yes | A queued link or file is **not** hidden under `.ore`. |
| `inbox/removed/*` and retained attachments | Yes | Undo descriptors remain in Git if captured before pruning; inbox code keeps them one day. |
| `.index/library.sqlite`, `.index/feeds.json`, related cache/repair files | No | Search/schedule cache is rebuilt; fetched Feed cache can be fetched again. The review queue is derived, not an independently canonical hidden queue file. |
| `.ore/cuts/<item>/<cut>.json` | No | Removed text, placement context, and removed-highlight details needed by `restoreCut` stay only in this stash unless preserved elsewhere. Git restoration alone does not recreate a missing cut receipt. |
| `.ore/reimport/*` including old originals/documents and swap recovery | No | A useful old version can be only here between snapshots; later reimports prune stashes older than one day (`ingest/index.ts:853–881`). |
| `.ore/session` | No | Open-session IDs/stack are not restored by Git. The start/end receipts themselves are committed. |
| `.ore/lock`, `last-snapshot`, catch-up marker, tutor transport/session cache, background/AI usage logs | No | Per-device operational state and troubleshooting/usage evidence are not recovered from the library's Git tree. |
| Unsubmitted review/recall/Add drafts, scroll positions and app preferences | Outside library Git | `Review.tsx:70` and `util.ts:33–50,68–105` keep drafts in localStorage, with 24-hour freshness. They are not review-log entries until submitted and are not recovered or synced by a Git restore. No native quit/reinstall survival claim was tested. |

`inventory.ts` uses real core source/note/cut/inbox/session operations, plus clearly marked **shape-only** placeholder files for other layout families. It verifies Git inclusion, not validity/decoding of every media format. The performance media files are similarly synthetic incompressible bytes, not actual recordings or PDFs.

### When it snapshots, including phone-only use

- There are **two production call sites**: `packages/cli/src/ore.ts:44`, after a successful command returns, and forced session end at `packages/cli/src/cmd-study.ts:326`. Help/argument errors and commands that throw before returning do not reach the general call.
- Mac app writes run the CLI (`apps/desktop/src-tauri/src/main.rs:64–104,156–159`), including its bundled compiled copy under D30. Using only the Mac app still takes snapshots: approximately at most six ordinary dirty snapshots per hour of commands, plus forced session ends. There is no fixed daily count: activity, clean checks, failures, locks, and session ends determine it. Session end's later general call is normally throttled, so it does not create two commits.
- There is **no ten-minute timer**. A note written five minutes after a snapshot can remain unsnapshotted indefinitely while idle. A later eligible command or successful forced session end captures it. Intervening overwritten versions inside that window cannot be assumed recoverable.
- The marker actually tracks **attempts**, including clean checks and most Git failures, not just commits (SNAPSHOT-04). Library-lock rejection resets it to epoch, enabling the next command; first-stage Git failure leaves the ten-minute backoff.
- The phone directly calls `commands[name].run` in `apps/desktop/src/phone/core.ts:262–280`; it does not run `ore.ts`'s post-command wrapper. Its filesystem scan skips dot folders (`apps/phone/src-tauri/src/lib.rs:91–94`), and its `Bun.spawnSync` stub always fails (`phone/core.ts:66–69`). Session end shares the forced call, but with no `.git` it immediately returns false. **The phone does not produce Git snapshots.**
- D222 keeps `.git`, `.ore`, and `.index` per device. Phone edits enter Mac history only once iCloud has delivered those files and a Mac CLI/app/background command reaches an eligible snapshot. A phone-only day with no Mac command can yield **zero new Git snapshots**; multiple intermediate edits to the same note may collapse before the Mac ever sees them. Append-only phone annotation/review logs preserve their own lines, but that is different from a Git snapshot of each state. This is established by call-path reading, not a real device sync experiment.

### Git-state outcomes

| State left by an agent | Observed/verified outcome |
|---|---|
| Attached HEAD, normal file/whole-tree restore | Commit on the current branch; tested. A Git path restore's overlay/delete semantics are still Git's, not an Ore whole-library transaction. |
| Detached HEAD | Commit succeeds off the normal branch, no named recovery ref/warning; SNAPSHOT-05. |
| Clean stash / clean stash pop | Stash preserved; popped work committed; tested. Conflicted stash-pop was not separately exercised. |
| Stopped conflicting rebase | Unresolved state is erased and conflict markers committed; rebase continue succeeds; SNAPSHOT-02. |
| Stale `.git/index.lock` | Snapshot returns false and retries after the interval, potentially forever until repaired. Doctor warns after 60 seconds and offers `--fix`; tested. |
| No commits yet | First snapshot commits the initial library; tested. |
| `.git` is a worktree pointer file | Normal snapshots work; tested. Locked-worktree doctor handling remains a lead. |
| `.git` missing | Snapshot returns false forever until Git is initialized/restored by another action; normal commands keep working. |
| Git absent from process-start PATH | General command catches it; forced session end throws after saving; SNAPSHOT-03. |

### Size, response time, and lock time

The seed uses core to create text sources, one annotation log and source note per source, and two exercises per source: **129 tracked files at 25 sources; 504 at 100**. This follows the bench seed's broad source/highlight/exercise shape without invoking it; it does not recreate the full 950-source mix, months of reviews, or its large book. Exact output: `output/perf.txt`.

| Case | Total snapshot time | First `git add -A`, outside library lock | Second `git add -A`, inside library lock |
|---|---:|---:|---:|
| 25 sources, first commit | 91.30 ms | 52.41 ms | 11.88 ms |
| 25 sources, clean check | 30.68 ms | 11.06 ms | 11.78 ms |
| 25 sources, one changed note | 43.73 ms | 12.07 ms | 11.55 ms |
| 100 sources, first commit | 274.01 ms | 175.50 ms | 37.59 ms |
| 100 sources, clean check | 77.73 ms | 32.07 ms | 35.59 ms |
| 100 sources, one changed note | 105.33 ms | 35.65 ms | 34.74 ms |
| Add three 1 MiB media-shaped files | 169.44 ms | 88.62 ms | 39.84 ms |
| Replace one 1 MiB media-shaped file | 65.85 ms | 29.50 ms | 12.41 ms |
| An 8 MiB file arrives just before second add | 217.07 ms | 12.30 ms | **158.11 ms** |

**Requested extrapolation, not measurement:** a straight line through the 25/100-source samples gives roughly **2.34 s** for a 950-source first snapshot, **0.61 s** for a clean check, and **0.80 s** for a one-note snapshot, assuming the same five tracked files per source and similar text sizes. That calculation is `T25 + (950−25) × (T100−T25) / 75`. Cache effects are visible even in this small run, so these are illustrative estimates, not a latency guarantee or real-library bench result. Larger originals and different file counts can dominate.

The initiating command waits for **all** these synchronous Git calls before printing its result (`ore.ts:41–48`). Other library writers can wait on the second staging pass; the comment that big files are hashed outside the lock does not cover a new/changed large file arriving between stages. No user-visible latency threshold was asserted, so this is a measured coverage result rather than a performance finding.

Recordings, PDFs and videos are not copied anew into every commit when unchanged: Git reuses their existing blob. A changed version is added again and old committed blobs remain recoverable; the probe confirms all three old media blobs still read after replacement. At that point the isolated repository had 629 loose objects, `size: 6616` KiB, with no packs. Git may later compress similar revisions together during maintenance; this run disabled automatic GC only in its scratch performance repos to make the storage observation explicit. It does not measure long-term packed size.
