# Durability sweep

Tested the assigned Mac release page and iPhone browser build through the supplied WebKit server, plus real CLI/core writes in scratch copies. Covered 30 interruption timings/targets across a 34,300,038-byte import, filing 50 sources, repeated review writes, and importing 50 inbox files; read-only libraries/folders; concurrent CLI edits; main-window/quick-quiz ratings; app ratings racing CLI retirement; library/source movement; an older skills file; index removal; and clock rollback. Ran `ore doctor --json` and inspected canonical files after filesystem scenarios; inspected IndexedDB directly for phone saves. Four findings reproduced at least twice. **Limits:** the disk image could not be created (`Device not configured`), so actual ENOSPC was not exercised. A bounded browser-storage fill did not produce a quota error; the phone failure finding below uses a real IndexedDB transaction deliberately aborted by the harness, not a claimed naturally exhausted quota. No native iPhone/iCloud or power-loss durability test was performed. No application code or findings-registry files changed.

## Findings

### 1. A failed phone save looks successful, then disappears on reload

**S1 — iPhone browser build (IndexedDB path only). Reproduced 2/2.**

1. Open a fresh phone page at `http://localhost:1729/`, with the preamble's phone init script.
2. After boot, arrange for the next IndexedDB `put` for `/lib/skills.yaml` to have its transaction aborted. `phone-abort.cjs` wraps `IDBObjectStore.prototype.put`, calls the original, then calls `this.transaction.abort()` for that key. This produces an actual request `AbortError`; it does not stub Ore's success response.
3. Tap **Open menu → New skill**, enter `Durability rejected save 0`, and press Enter.
4. Inspect the persistent database, then reload the same page/context and open the menu.

**Expected:** saving fails visibly, the typed name remains available for retry, and the app does not present the skill as safely saved.

**Actual:** the new skill opens normally with its title and note/source controls. There is no error. IndexedDB has no `/lib/skills.yaml` value, and the skill disappears after reload. A subsequent save with the abort removed survives reload. Both runs captured an `AbortError` and no page error.

**Suspect:** `apps/desktop/src/phone/fs.ts:25–35`, especially line 33: `r.onsuccess = r.onerror = () => done()`. In-memory writes are accepted before background persistence finishes, request errors resolve successfully, and transaction completion is not awaited. The native iCloud path uses different error handling; this finding does not establish the same behavior there.

**Evidence:** [phone-abort.cjs](phone-abort.cjs), [phone-abort-results.json](phone-abort-results.json). Screenshots: [apparently saved, run 1](phone-abort-0-saved.png), [after reload, run 1](phone-abort-0-reloaded.png), [apparently saved, run 2](phone-abort-1-saved.png), [after reload, run 2](phone-abort-1-reloaded.png).

### 2. Moving an existing library silently creates a new empty one

**S1 — Mac. Reproduced 2/2 through starting Review, plus 2/2 through saving an open note.**

1. Open a fresh Mac page at `http://localhost:1727/`, bridge 1728, and wait for the seeded Home to load.
2. Rename the assigned library folder to a temporary name while the page stays open. Keep the original contents intact.
3. Click **Start review**, then **Start review** in the skill picker.
4. Reload the page and inspect the old library path.

**Expected:** explain that the previously opened library is missing/moved and provide a way to locate or restore it. Do not silently initialize another library during an established session.

**Actual:** the app sends `ore init` to the old path. That path becomes a new library with default skills, empty sources/cards, and a new Git history. Home says **“Nothing to read yet. Paste a link, a file or any text…”** and offers no explanation. `ore ls --json` returns `[]`; `doctor` reports zero errors/warnings. The real library is still intact at its moved path, but the daily loop now points at an empty replacement. New captures would go to that replacement. Saving an open note instead also initializes the replacement, then says only `Notes not saved: no item matches "<id>"`; the draft survives if the original folder is restored.

**Suspect:** `apps/desktop/src/ore.ts:51–66`: `firstRun` initializes on every `no library at` error, including after a library was already successfully opened. `packages/core/src/library.ts:15–27` distinguishes a missing skills file from an absent root, but the app does not distinguish first launch from a moved library.

**Evidence:** [folder-write.cjs](folder-write.cjs), [folder-write-results.json](folder-write-results.json) (captures the `init` requests and new directory entries), [mac-files-results.json](mac-files-results.json) (note-save variant). Screenshots: [empty replacement, run 1](moved-library-write-0.png), [empty replacement, run 2](moved-library-write-1.png), [note error](mac-moved-0.png). The original assigned library was restored after each run.

### 3. Clock rollback produces a different schedule when the review log is replayed

**S2 — Mac/core scheduling, shared by both apps. Reproduced 2/2.**

1. In a fresh seed copy, take an exercise with no reviews (`Which two variables does FSRS track per card?`).
2. Call the real `recordReview` with Good at `now + 365 days`, representing a device whose clock was wrong. The harness passes the supported `now` argument; it does not change the host clock.
3. Record Again at the correct current time.
4. Compare that call's `state_after` with the state rebuilt from the canonical reviews by `syncIndex`; inspect tomorrow's queue and run doctor.

**Expected:** a rating and its replay agree under unchanged scheduler settings. A corrected clock must not silently turn today's miss into an apparent year-long successful recall or postpone it for a year without a repair path.

**Actual, first run:** the Again at `2026-11-15T07:39:29.050Z` returned due **2027-11-16**, stability **0.77508398**, **1 lapse**. Replaying the same files immediately produced due **2027-11-19**, stability **6.11576474**, **0 lapses**, and **365 elapsed days**. Today's one relearn pass still appears, so the queue does not crash. The exercise is absent from the next day's queue; doctor gives zero warnings. Today's active time remains correct at 60,000 ms.

**Suspect:** `packages/core/src/study.ts:53–75` schedules at the latest future review time but stamps the new record with the actual earlier time. `packages/core/src/scheduler.ts:62–68` replays by timestamp, putting the new miss before the older-entered future Good and treating that Good as a success after 365 days. `packages/core/src/db.ts:288` uses that replay for the index.

**Evidence:** [future.ts](future.ts), [future-results.json](future-results.json) (full on-disk review records), [future-check.ts](future-check.ts), [future-check.json](future-check.json) (returned/rebuilt state and tomorrow's queue). Screenshots: not applicable; this is a core/log consistency reproduction. This differs from F183: the rating succeeds, but its reconstructed schedule is wrong.

### 4. A killed import leaves invisible source files that doctor never identifies

**S2 — Mac/CLI. Reproduced 4/4 targeted kills, plus one delay-loop hit; retry behavior confirmed 2/2.**

1. Make a fresh scratch library copy and a 34,300,038-byte Markdown file. `cli-probes.cjs` writes the specimen under this report's folder.
2. Start `ore add <big.md> --no-enrich --json`.
3. Send SIGKILL after the source temporary file appears, before `doc.md` is committed. `interrupt-target.cjs` watches the actual directory at 1 ms intervals and kills the real CLI process. The ordinary delay loop also hit this window at 125 ms.
4. Run doctor, make another normal write to clear/take over the dead-process lock, and run doctor again. Retry the same import.

**Expected:** doctor identifies an interrupted source folder and gives a safe cleanup/retry instruction, or the retry reuses/cleans it. Incomplete source data should not become permanently invisible to the recovery tool.

**Actual:** targeted kills left a **34,300,038-byte `.source.md.<pid>.<time>.tmp`** with no `doc.md`; the delay-loop hit left a committed `source.md` of that size with no `doc.md`. The source is absent from normal lists. Doctor initially reports only the stale lock; after a normal write it reports a completely healthy library. Retrying imports a new complete source under a new ID and leaves the old folder/file behind, still unreported. Existing completed sources remained intact. This is an orphan/recovery gap, not evidence that an acknowledged successful import lost its source.

**Suspect:** `packages/core/src/items.ts:187–191` writes the original before the document. `itemDirs` at lines 220–225 excludes every directory without `doc.md`, and `packages/core/src/doctor.ts:72` uses that filtered list. `packages/core/src/fsutil.ts:15–19` leaves its temporary file if the process is killed; the SIGTERM cancellation handler cannot run for SIGKILL.

**Evidence:** [interrupt-target.cjs](interrupt-target.cjs), [target-kill-results.json](target-kill-results.json), [cli-results.json](cli-results.json), [orphan-retry-results.json](orphan-retry-results.json). Representative disk specimens remain under `target-kill-2/` and `kill-125/`. Screenshots: not applicable; file manifests and doctor output demonstrate the invisible data.

## Known findings checked

- **F7**, batch writes lack rollback, is an accepted limit. Killing the 50-source filing run left 0, 7, or 31 completed changes before the final uninterrupted run completed all 50. No malformed document or source/exercise skill mismatch was found in those samples. Not re-reported.
- **F183**, negative elapsed time after a clock change, is not claimed as a recurrence. The new clock finding concerns ordering and replay of already-written future reviews.
- No confirmed recurrence of an existing fixed row was found. Simultaneous main/quick-quiz ratings were already in progress in both windows; both were preserved. This was not presented as a new F173 regression.

## What passed

- Read-only whole library and read-only `reviews/`: writes exited nonzero, named the permission problem and Finder's Sharing & Permissions controls; both worked after restoring write permission.
- Mac note in a read-only source folder, **2/2**: old disk text stayed intact; the UI kept the draft and showed `Notes not saved`; leaving/reopening after permission recovery saved that draft.
- Interrupted normal review writes at 30/60/100/180 ms: surviving logs parsed; 0/9/21/47 added reviews survived the sampled stops; no truncated review line was observed. Doctor and subsequent writes worked.
- Interrupted 50-file inbox imports at 30/60/100/180 ms: 0/5/15/30 sources had committed at the stop; retry ended with exactly **50 Inbox sources** in every copy, with doctor healthy.
- Interrupted filing of 50 sources: completed records remained parseable, with consistent source/exercise skills in the sampled copies. Partial batch completion is F7 above.
- Dead-process locks from interrupted imports were detected, and the next normal write took them over without manual deletion.
- Ten groups of four concurrent CLI edits preserved both source title/author and both skill hook/goal fields; all commands succeeded and doctor remained healthy.
- Five CLI rating-versus-retirement races preserved retirement. A rating either committed before retirement or failed because the exercise was already retired; no lost retirement or malformed log was observed.
- Main and quick-quiz windows rating the **same exercise**, **2/2**: both review records survived with distinct timestamps and session IDs; doctor remained healthy. Test ratings were undone through CLI afterward.
- App rating held until CLI retirement, tested on two exercises: the app displayed the retirement error and kept the answer/rating view; the failed rating did not overwrite retirement.
- Deleting a source folder while its note was open: saving failed visibly and kept the draft; doctor identified all three exercises whose source was missing and suggested restoration or retirement. Restoring the folder cleared doctor errors.
- Removing `.index` with the Mac app open: All sources loaded successfully and the index was rebuilt from files.
- Replacing `skills.yaml` with its older copy: doctor warned about a source referencing the now-missing skill. Restoring the source's original skills through CLI cleared the warning.
- Clock test: no exception/NaN was observed; today's active-time statistic stayed correct. The scheduling inconsistency is finding 3.

## Limits, evidence and cleanup

- **Disk full:** `hdiutil create -size 20m -fs HFS+ -volname OreDurability -o codex-out/durability/full-disk.dmg` failed with `Device not configured`. No image file was created or mounted. Before this report, `hdiutil info` showed no durability/full-disk image; there was nothing to detach or delete. Existing unrelated simulator images were untouched.
- **Actual phone quota:** `navigator.storage.estimate()` initially returned quota **1,048,576,000**, usage **2,800**. The bounded follow-up committed **1,107,296,256 bytes** through IndexedDB without a quota refusal; its final estimate reported usage **67,109,208**. It was stopped at that bound, the padding database was deleted, and the browser context was closed. These are measurements, not proof of quota coverage. See [quota-limit.json](quota-limit.json) and [quota-estimate.cjs](quota-estimate.cjs). Finding 1 explicitly uses transaction-abort fault injection instead.
- AI enrichment was disabled as instructed. A source without AI-generated exercises was not counted as a fault. No claim about power failure/fsync safety follows from these process-kill tests.
- UI screenshots use 2× device scale. The shared WebKit and app servers were not stopped. Test-created page contexts were closed.
- Restored the assigned Mac library's location, removed permission restrictions, restored the source note and skill assignment, and undid test ratings through CLI. The scratch library retains test session/undo history and ordinary read/open metadata. Final [doctor output](final-doctor.json): **ok, 0 errors, 0 warnings**. The phone seed directory was not edited.
- Large redundant successful-import copies were removed; scripts, JSON evidence, screenshots, and two representative interrupted-import folders remain. [cleanup.json](cleanup.json) records the removed copies.
- Additional evidence: [mac-files.cjs](mac-files.cjs), [mac-files-results.json](mac-files-results.json), [bulk-probes.cjs](bulk-probes.cjs), [bulk-results.json](bulk-results.json), [verified-samples.json](verified-samples.json), [review-same-writers-results.json](review-same-writers-results.json), [folder-followup-results.json](folder-followup-results.json).
