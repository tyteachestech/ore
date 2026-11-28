# Restore scout — history recovery

Read-only pass against `50f0ef10203bd04ea4029c60ad7616822de6c103`, on macOS with Bun 1.4.4. Covered an archived, cut, and deleted source restored with its original, metadata, highlights and exercise; same-sized source/skill notes, a diagram and a chat restored from Git; whole-library checkout overlays and hard resets; shortened/deleted review, session and annotation logs; removed skills and orphaned source/exercise pairs; and snapshots after checkout, restore, revert, stash, detached HEAD and an index lock. Read `CLAUDE.md`, the relevant spec/decisions, findings/coverage, the supplied diagnosis guide, library agent instructions and Ore skill. Used only small scratch libraries under this folder, core APIs, command handlers and 44 separate CLI reads; all AI executables were stubbed and enrichment disabled. No app, browser, server, watcher, whole test suite, benchmark, real library or other scout's output was used. Skipped actual iPhone/iCloud propagation, open-window behavior and concurrent Git/library writers. All writes are under `codex-out/restore/`; no production code or findings registry was changed. Review and snapshot event times are explicit fixed dates; file mtimes and generated IDs remain real. The final diagnostic runs used 0.073–0.923 seconds of child CPU each (`evidence-runs.json`).

## Findings

### restore-01 — Reading a note can commit an unresolved recovery conflict

**S1 — Mac.** The conflict-marked note is canonical data and can subsequently sync to the phone, but live sync was not tested. D5's history is supposed to preserve recoverable versions; it must not resolve an agent's pending recovery by staging the conflict markers as finished text.

**Red command**, from the repository root:

```sh
python3 codex-out/restore/conflict-cli.py
```

Output (`conflict-cli.log`, exit 1):

```text
PASS precondition: recovery has an unresolved conflict
working note before snapshot: "<<<<<<< HEAD\nCurrent note.\n=======\nOther branch note.\n>>>>>>> other\n"
CLI: bun packages/cli/src/ore.ts notes <source-id> --json
CLI exit: 0
CLI returned conflict markers: True
HEAD advanced: True
Unmerged index entries: 0
Conflict markers committed: True
FAIL reading a note must not resolve and commit a pending recovery conflict
```

The wrapper runs `git-state.ts merge --prepare`, then runs exactly `bun packages/cli/src/ore.ts notes <generated-source-id> --json` with the scratch library in `ORE_LIBRARY`, `ORE_NO_ENRICH=1`, and this folder's fake vendors first on PATH. The manifest saves the concrete ID and path. No Bun processes overlap.

**Minimized steps:**

1. Save a source note and snapshot it. On two branches, replace the same line with different text and snapshot each version.
2. Merge one branch into the other, producing a real unresolved note conflict. Leave it unresolved.
3. Make the snapshot interval due by setting the scratch `.ore/last-snapshot` mtime to the epoch; read the note through the CLI.

**Expected:** reading remains possible, but the snapshot skips the unresolved operation without touching its index entries or completing it. **Actual:** the CLI succeeds, `HEAD` advances to a snapshot containing the literal conflict markers, `git ls-files -u` becomes empty and `MERGE_HEAD` disappears. The agent loses the pending merge state and its conflict stages without choosing either version. This does not erase the earlier Git commits; it corrupts the current saved note and completes recovery incorrectly.

**Ranked hypotheses and probes:**

1. **Snapshot's unconditional staging resolves the conflict.** Prediction: calling `snapshot` directly on the conflicted tree also commits it, while a normal read with no due snapshot would not need to touch Git. Confirmed by `git-state.ts merge`; the real CLI reproduction proves the automatic caller reaches the same path.
2. **Git's conflict type already resolved itself.** Prediction: there would be no unmerged index entries immediately before the snapshot, or only merges would fail. Ruled out: each repro first verifies unmerged entries. `bun codex-out/restore/git-state.ts stash` and `… revert` both exit 1 with `committed:true` and the conflict markers committed. Revert's pending state is also consumed.
3. **A custom commit hook or ordinary recovery commit caused the mutation.** Prediction: a scratch repo with no installed custom hook would not reproduce, or clean recoveries would be equally broken. Ruled out: the repro uses a fresh `initLibrary` repo, and `snapshot` explicitly uses `--no-verify`. `snapshot-after.ts` passes clean checkout, restore, revert and stash controls.

**Cause:** `packages/core/src/history.ts:22` runs `git add -A` before checking any Git recovery state; line 25 stages again; line 32 commits. Staging replaces the unmerged index stages with the file containing the markers. `packages/cli/src/ore.ts:41–44` calls this after successful read commands too. Related F643 concerns snapshots of half-finished **Ore writes**, which the library lock now guards; this is a different unguarded Git-operation state, not a re-report of that fixed case.

**Fix proposed, not applied:** check for unmerged entries and active merge/revert/cherry-pick/rebase state before the first staging operation, using Git's own path resolution so worktree `.git` files work too. Skip without changing the agent's index or operation state, and make the reason discoverable through doctor/history status. Recheck before staging under the library lock. Guard all three conflict types above, including stash conflicts, which need not have `MERGE_HEAD`.

### restore-02 — Cut Undo duplicates text that Git already restored

**S1 — Both through shared core; reproduced on Mac.** Violates D111's removal/Undo contract by changing the restored author's text into two copies of a paragraph.

**Red command:**

```sh
bun codex-out/restore/cut.ts
```

Output (`cut.log`, exit 1):

```text
{
  "before": "# Restore source\n\nAlpha paragraph.\n\nBeta paragraph.\n\nGamma paragraph.\n",
  "after": "# Restore source\n\nAlpha paragraph.\n\nBeta paragraph.\n\nBeta paragraph.\n\nGamma paragraph.\n",
  "error": ""
}
FAIL Undo after git restore never duplicates already-restored text
```

**Minimized steps:**

1. Snapshot the source above.
2. Cut Alpha, then cut Beta. Keep Beta's cut ID.
3. `git checkout <snapshot> -- <source>/doc.md` restores the original text. The gitignored cut records remain.
4. Call `restoreCut` for Beta, the same operation as `ore cut <source> --undo <beta-cut-id>`.

**Expected:** refuse with the existing “already back, or the source changed” message, or otherwise leave the restored text unchanged. **Actual:** Undo succeeds and inserts Beta before Gamma a second time, updating `text_sha256` to legitimize the duplicated body.

**Ranked hypotheses and probes:**

1. **The already-back check is stricter than the fallback placement check.** Prediction: if only one side of the original context changed, the cut's text can already be present but the full-context check can fail. Confirmed by `bun codex-out/restore/probes-cut.ts`: after two cuts and restore, `fullContextPresent:false`, `textAndAfterPresent:true`; Undo accepts it and `betaCopies:2`.
2. **An obsolete index or cached source supplies the wrong body.** Prediction: removing index reads/rebuilding changes the result. Ruled out more directly: neither the minimized red script nor the probes ever opens an index; `restoreCut` reads the current file under the library lock.
3. **Checkout failed or a single stale cut record is sufficient.** Prediction: saved bytes differ, or one cut also duplicates. Ruled out: the probe compares the restored document to `git show` byte-for-byte. Its one-cut control has `fullContextPresent:true`, refuses Undo, and leaves `betaCopies:1`. The earlier Alpha cut is the load-bearing step that makes Beta's recorded left context different from the restored source.

**Cause:** `packages/core/src/cut.ts:266` only recognizes already-restored text when `before + text + after` matches together. `placeBack`, lines 249–252, then accepts the unique `after` context alone and returns the insertion point before Gamma. The restored Beta immediately before that point is never checked. Lines 269 and 277 insert and persist the duplicate. The trigger is related to F606's stale placement guard, but its recorded symptom—pasting into a word after another cut above—was not reproduced. This is a separate hole in that guard when the cut text itself has already returned.

**Fix proposed, not applied:** make already-present checks use the same candidate contexts as placement. Before inserting at a one-sided match, reject if the removed text is already adjacent on the corresponding side, and refuse ambiguous cases rather than guessing. Preserve the working F606 behavior for text that is actually absent. Add the two-cut → Git-restore → Undo case beside the existing cut tests, including a whole-folder restore with annotation logs.

### restore-03 — A whole-day rollback leaves a nonexistent session active

**S2 — Both through shared core; reproduced on Mac.** The review log and FSRS state roll back correctly, but new reviews can be attributed to a session that no longer exists; ending that session fails and doctor says the library is healthy. This violates the intended relationship between canonical session receipts and disposable `.ore` state in D5/SPEC §2.

**Minimal red command:**

```sh
bun codex-out/restore/session-minimal.ts
```

Output (`session-minimal.log`, exit 1):

```text
canonical session receipts: 0
FAIL restored library has no open nonexistent session
```

**Minimized steps:** initialize an empty scratch library and snapshot it; start a session and snapshot again; `git reset --hard <first-snapshot>`; read `openSessionId`. The second snapshot is necessary so reset removes the newly tracked session log. No source, exercise, review or index is needed to reproduce the invalid marker.

**Expected:** ignore/prune an open-session marker whose start receipt was rolled back, and never append a new review against that nonexistent session. **Actual:** `.ore/session` survives because it is gitignored. With an exercise present, `recordReview` takes that ID, and `endSession` throws `no session <id>`.

**Ranked hypotheses and probes:**

1. **The ignored marker is trusted without checking canonical receipts.** Prediction: removing only the marker fixes attribution. Confirmed by `bun codex-out/restore/session-minimal.ts --probe` (`session-probes.log`, exit 1):

   ```text
   canonical session receipts: 0
   FAIL restored library has no open nonexistent session
   after rebuilding index: stale marker remains true
   doctor: {"ok":true,"errors":0,"warnings":0,"issues":[],"fixed":[]}
   new review attached to missing session: true
   end error: Error: no session <id>
   after removing only the marker: review session null
   ```

2. **Review/index caches retain the later day.** Prediction: reindex fixes the marker or schedules differ from a fresh rebuild. Ruled out: reindex leaves the marker; both `day.ts reset` and `day.ts checkout` pass comparisons for cards, reviews, queue, stats, skill strength, Today, session receipts and exercise history before failing only the marker/new-attribution assertions.
3. **Git failed to roll back the session log.** Prediction: the session start still exists in the canonical reader. Ruled out by zero receipts in the minimal loop. The richer checkout loop restores an existing monthly receipt file to its shorter prior version and reproduces the same marker failure.

**Cause:** `packages/core/src/init.ts:38` ignores `.ore`; `packages/core/src/sessions.ts:99–109` reads IDs without validating their receipt; `packages/core/src/study.ts:77` puts that ID into the next review. `sessions.ts:145` rejects it only at the end. `packages/core/src/doctor.ts:202–205` checks the marker's age, not whether its session exists, so even doctor cannot diagnose the fresh invalid pointer. This is distinct from F597 (stacked sessions dropping an existing session) and F660 (a close racing an in-flight rating); neither of those scenarios was rerun or claimed as recurrent.

**Fix proposed, not applied:** validate marker-backed IDs against current start receipts before using them, and reconcile invalid markers under the library lock. Reject or recover an invalid explicitly supplied session before appending a review as well. Doctor should identify and optionally remove nonexistent marker entries, with a useful next step to start a new session. Preserve valid stacked sessions; do not reconstruct every historical unended session as active.

### restore-04 — Agents are never told how to discover historical versions

**S3 — Mac, UX/documentation.** Recovery currently depends on an agent, but neither the generated library instructions nor the Ore skill says that the library is a Git repository with snapshots. Both tell the agent to stop when there is no applicable CLI write. This costs investigation or an extra exchange precisely when Tyler asks for lost writing back. This is a missing documented workflow, not a claim that `git show` followed by `ore notes --set` is technically impossible.

**Red documentation check:**

```sh
bun codex-out/restore/agent-guidance.ts
```

Output tail (`agent-guidance.log`, exit 1; the log also prints the exact two rules):

```text
History/recovery commands: []
FAIL library agent is told how to discover historical versions
FAIL Ore skill is told how to discover historical versions
```

**Minimized steps:** read the generated `agentsTemplate()` and `skills/ore/SKILL.md` as an agent working in the library would, then inspect the actual CLI command registry for a history/snapshot/rollback entry point. There is no history discovery instruction or command. This is a static documentation loop; no model's compliance behavior is claimed to have been tested.

**Expected:** discover and inspect older versions, then use a documented restoration route that respects the writer rule. **Actual:** only current-file reads/writes and “say so and stop” are described. Archive restore, exercise restore and cut Undo are unrelated to historical file versions.

**Ranked hypotheses and probes:**

1. **Recovery documentation was never added to the agent entry points.** Confirmed: neither contains a `git` or `snapshot` instruction or a history-restoration route.
2. **A differently named CLI command covers historical restore.** Ruled out by checking the actual command registry and usage strings; the available `restore` operations concern archive/skill/exercise state, not arbitrary older files.
3. **The generated template or the skill's referenced card instructions supply the missing route.** Ruled out: `agentsTemplate()` returns the checked template, and `skills/ore/reference/cards.md` only describes present-day card edits. The developer spec's History paragraph describes snapshots but is not part of those library-facing instructions.

**Cause:** `packages/core/src/templates/library-agents.md:7–11` and `skills/ore/SKILL.md:22–25`, with no recovery section elsewhere in either entry point. SPEC §2's D5 history promise never reaches the agent-facing workflow.

**Fix proposed, not applied:** document read-only snapshot discovery and inspection first. For a note, route the recovered exact text through `ore notes --set`; for multi-file recovery, document an explicitly sanctioned procedure or add a narrow core recovery command. Explain that source exercises live outside the source folder, that checkout overlays keep later-added files, and that `.ore` session/cut state must be reconciled. Include the post-restore checks and avoid presenting hard reset as a harmless equivalent of path restoration. Any exception to the existing writer rule needs Tyler's decision; this pass does not change it.

## Leads — no additional finding claimed

- A detached-HEAD snapshot succeeds and remains detached (`snapshot-after.ts`). Returning to a branch could hide later snapshots from its ordinary log; no unreachable-data/loss assertion was established here. This overlaps the snapshot scout's assigned scope.
- Real iCloud may reintroduce newer per-device log files after a Mac rollback. Only local files and fresh-process readers were tested; no physical sync loop.
- An external Git checkout racing an Ore write can expose mixed file versions because Git does not take Ore's lock. No concurrency repro was run in this reading-only pass.
- Saved chat content/list restoration passed. Resuming a restored chat's vendor conversation was read but not executed; `tutor.ts` compares a hash of the supplied prior turns before reusing a session, so no stale-conversation finding is established.

## What passed

- `bun codex-out/restore/roundtrip.ts archive`: whole restored source, metadata, kept RTF bytes, position-anchored highlight, exercise, list/search/due/history, doctor and local reimport.
- `bun codex-out/restore/roundtrip.ts cut`: the same; a single cut whose text was restored refuses Undo without changing the body.
- `bun codex-out/restore/roundtrip.ts delete`: deleted source folder and exercise restored together, all the same readers and reimport correct.
- `bun codex-out/restore/roundtrip.ts notes`: same-sized source/skill note changes restored through checkout; search drops the newer words and finds the older ones; incoming/outgoing backlinks, diagram and chat content/list correct. Diagrams and chats are read directly, not indexed by the source/note FTS table.
- `python3 codex-out/restore/cli-smoke.py`: 44 separate real CLI invocations passed, covering `ls`, `show`, `search`, `due --all`, `card show --review`, `stats`, `doctor`, `notes`, `backlinks`, `diagram` and `chat` across those four libraries. JSON results are saved as `cli-<scenario>-<command>.json`. The command is `ore ls`; this checkout has no `ore list` alias.
- `bun codex-out/restore/membership.ts reset`: shortened reviews/sessions/annotations, removed later source/exercise/skill and removed later monthly logs; incremental index, FSRS state, queue, history, stats, Today, skill growth and receipts equal both the baseline and a fresh rebuild.
- `bun codex-out/restore/membership.ts checkout`: the same readers agree with a fresh rebuild of the actual resulting files. Later-added source/exercise/monthly log files remain, as Git overlay checkout specifies; doctor names their removed skill. This is not a complete-day rollback and not an index bug.
- `bun codex-out/restore/orphans.ts`: missing source retains its reviewable exercise and doctor gives the restore/retire step; missing exercise leaves the source readable and leaves the queue; restoring the pair clears the issues and matches a rebuilt index.
- `bun codex-out/restore/snapshot-after.ts`: path checkout, unstaged path restore and clean stash recovery snapshot correctly; a clean revert needs no redundant commit; an index lock causes a nonthrowing failed snapshot, and removing it permits the next forced snapshot. Detached snapshot content matches its working file, with the branch-reachability caveat above.
- `bun codex-out/restore/day.ts reset` and `… checkout`: every checked canonical/index-derived view returned to baseline before the deliberately failing open-session assertions; no retained later FSRS reviews found.

`python3 codex-out/restore/capture-evidence.py` reruns the final diagnostic/control set serially, captures the logs, and asserts the expected exit status for each. A red repro is intentionally exit 1. Production fixes, registry entries and UI validation belong to the fixing pass.
