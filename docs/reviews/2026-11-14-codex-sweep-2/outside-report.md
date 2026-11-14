# Outside — library changes under the app

Tested the supplied Mac release page in WebKit against `codex-out/libs/outside`: source, note, exercise and skill edits; open-source deletion; source-folder renames and moves between year folders; skill removal and archiving; conflict copies, Finder junk, placeholder names, malformed/truncated/empty files, missing and duplicate source ids, orphan exercises, broken review-log lines, simultaneous device ratings, and CLI changes beside the app. Six findings below, each reproduced twice from a fresh browser context. Tests used real CLI writes, without injected write delays or AI. Bad-file cases were checked on fresh page loads; ordinary edits, deletion and review changes happened with the relevant screen open. Skipped native iCloud hydration, actual phone-to-Mac transport, iPhone IndexedDB synchronization, and arbitrary moves outside the documented library layout: the provided phone page uses an isolated seed and cannot validate those native behaviors. No application code or findings registry was changed. Only this report's folder and the explicitly assigned disposable Mac library were written; the library was restored afterward.

## Setup and evidence

- Source checkout: `5a44d32222012d39078a9807322e14480c6a2daa`. Suspected code locations below refer to that checkout; the UI tested was the supplied release build.
- Mac page `http://localhost:1670/`, bridge `1671`, supplied WebKit server `ws://[::1]:1683/`.
- Screenshots: 1280 × 800 viewport, device scale 2. Every PNG has a sibling TXT with page text.
- A “return to the app” below means browser blur, a real 10.2-second absence, browser focus, then 1.5 seconds for reads. This exercises the app's actual focus handler, rather than sending an internal refresh signal.
- Full runnable cases and JSON observations are listed in [README.md](README.md). Run scripts sequentially; each resets only the assigned scratch library from the saved baseline.
- Seed source: `01M7DG3FA0E8FK50S5EMHQ0KCG`, “The Testing Effect: Why Retrieval Beats Rereading.” Its folder is `items/2026/the-testing-effect-why-retrieval-beats-rereading-01M7DG3FA0E8FK50S5EMHQ0KCG`.
- Seed exercise: `01M7DG3FTXY5E6BWA9M5F4BJQS`, “What is the hypercorrection effect?” It is the first exercise returned by `ore due --start` in the restored seed.
- In commands, set `ORE_LIBRARY` to the assigned scratch library and `ORE_NO_ENRICH=1`. The harness runs `bun packages/cli/src/ore.ts` as `ore`.

## Findings

### OUTSIDE-1 — Saving a question overwrites an outside answer correction

**S1 · Mac · 2/2**

1. Open a fresh page. Start review, accept the selected skills, and reveal the first Fact with **Sure**.
2. Choose **Edit exercise**. Change only the Question field to `LOCAL REVISED QUESTION?`.
3. While that editor remains open, run `ore card set 01M7DG3FTXY5E6BWA9M5F4BJQS --answer "OUTSIDE CORRECTED ANSWER"`.
4. Verify `ore card show` returns the corrected answer. Click **Save** in the app.
5. Read the exercise file again.

**Expected:** Save preserves the outside answer because the user edited only the question, or presents a conflict before replacing it.

**Actual:** The question saves, but the answer returns to “High-confidence errors, once corrected, are remembered better than low-confidence ones.” The newer outside answer is gone from the canonical exercise file. No conflict is shown.

Evidence: [exercise-save-clobbers-1.png](exercise-save-clobbers-1.png), [exercise-save-clobbers-2.png](exercise-save-clobbers-2.png), [exercise-edit-results.json](exercise-edit-results.json) contains both before/after records. Reproducer: `exercise-edit.cjs`.

Suspect: `apps/desktop/src/Review.tsx:869` always sends both fields from the stale draft; `Review.tsx:903` supplies its old answer even when only the question changed. `packages/core/src/cards.ts:199–206` applies the supplied fields without a base-version check.

### OUTSIDE-2 — Undo of a settled rename destroys a newer CLI rename

**S1 · Mac · 2/2**

1. Open the seed source on a fresh page.
2. Click its title, rename it to `APP TITLE`, press Enter, and let the save finish.
3. Run `ore edit 01M7DG3FA0E8FK50S5EMHQ0KCG --title "OUTSIDE CLI TITLE"`. Verify it on disk.
4. Press **⌘Z** in the app.
5. Read `doc.md` again.

**Expected:** Undo detects that another writer has since changed the title and preserves that newer title, or asks how to resolve it.

**Actual:** Undo writes the original seed title over `OUTSIDE CLI TITLE`. The outside title disappears from `doc.md`; the app reports a successful Undo. This is after the first app save has settled, with no delayed-write injection.

Evidence: [undo-overwrites-cli-1.png](undo-overwrites-cli-1.png), [undo-overwrites-cli-2.png](undo-overwrites-cli-2.png), [undo-results.json](undo-results.json) records `APP TITLE → OUTSIDE CLI TITLE → original title`. Reproducer: `undo.cjs`.

Suspect: `apps/desktop/src/Reader.tsx:2896–2902`: the Undo closure calls `ore edit --title` with its old title and does not check the current title. This differs from the pending-save race in known F156.

### OUTSIDE-3 — Open readers, notes and skill pages miss outside changes

**S2 · Mac · 2/2 for each listed variant**

1. Open the seed source on a fresh page, with Source note visible.
2. From the shell, change “roughly 50% more” to “roughly 75% more” in its `doc.md`, append `OUTSIDE NOTE` to `notes.md`, and rename Learning to Outside learning in `skills.yaml`.
3. Return to the app after the absence described above.
4. In a separate fresh run, delete the source's folder while it is open and return to the app.
5. In another fresh run, open Learning, run `ore skills rm learning`, and return to the app.

**Expected:** The reader and skill page reconcile with the canonical files, preserving unsaved typing. A removed object should stop appearing as an ordinary editable object.

**Actual:** The reader still says 50%; its note has no outside append; the sidebar still says Learning. After source deletion the complete source and editable note remain visible, with no missing-source warning. After skill removal the sidebar and skill heading still show Learning, while its source list has become empty. The list refresh and the visible object's state disagree.

A subsequent note edit **does preserve and merge** the outside note text; this finding concerns the stale display, not loss during that note save.

Evidence: [stale-edits-1.png](stale-edits-1.png), [stale-edits-2.png](stale-edits-2.png), [deleted-source-1.png](deleted-source-1.png), [deleted-source-2.png](deleted-source-2.png), [deleted-skill-1.png](deleted-skill-1.png), [deleted-skill-2.png](deleted-skill-2.png), [edits-results.json](edits-results.json). Reproducer: `edits.cjs`.

Suspect: `apps/desktop/src/App.tsx:387–391` refreshes source lists on focus, but does not reload skills or invalidate the open reader/note. `Reader.tsx:1095–1122` reads on id/internal history changes; its refresh error handler also ignores a missing source once opened. `Notes.tsx:235–269` has initial/internal note-event reads, but no outside-file refresh. `util.ts:344`'s library-change hook tracks app history steps, not filesystem changes.

### OUTSIDE-4 — Review keeps changed, deleted and already-rated exercises

**S2 · Mac · 2/2 for each primary variant**

1. Open a fresh page, start review and leave the first Fact unanswered.
2. In the shell, change that exercise's question to `OUTSIDE REVISED QUESTION?` in `cards/<id>.md`.
3. Return to the app, reveal the answer and rate Good.
4. In a separate fresh run, leave the first Fact unanswered, then run `ore review <id> --rating 4 --confidence 3` in the shell.
5. Return to the app and rate its still-visible exercise Good.

**Expected:** Before an untouched exercise is answered, reconcile outside wording and scheduling changes. The user should answer the current question and should not unknowingly rate an exercise already completed elsewhere.

**Actual:** The old question remains on screen and its Good rating is recorded against the now-rewritten exercise. In the CLI-rating variant, the app keeps offering the completed exercise and adds another review immediately after the CLI's review. No outside-change warning appears.

A third fresh-page variant reproduced **2/2**: start review, delete the **next** exercise file (`01M7DG3FTXY5E6BWA9M5F4BJQT.md`) while answering the first, then rate the first Good. Review advances to the deleted exercise and offers it normally, using its prefetched copy. Evidence: [queued-deleted-card-1.png](queued-deleted-card-1.png), [queued-deleted-card-2.png](queued-deleted-card-2.png), [queued-results.json](queued-results.json); reproducer `queued.cjs`.

Also checked: deleting the current exercise leaves it visible, but the attempted rating is **rejected** with `no card matches`; it does not append a review. Source/skill archiving also leaves the current exercise on screen; these observations are recorded separately, without treating continued review of an archived source as a new rule violation. A source removed from disk is explicitly identified as missing when its answer's evidence is shown.

Evidence: [card-edit-revealed-1.png](card-edit-revealed-1.png), [card-edit-revealed-2.png](card-edit-revealed-2.png), [cli-rate-revealed-1.png](cli-rate-revealed-1.png), [cli-rate-revealed-2.png](cli-rate-revealed-2.png), [review-results.json](review-results.json) includes the appended log records. Reproducers: `review-cases.cjs`, `queued.cjs`.

Suspect: `apps/desktop/src/Review.tsx:246–308` loads the queue at session start and reconciles only on `quiz-closed`; `Review.tsx:358–387` loads the displayed exercise on queue-entry changes, without outside-change invalidation. `packages/core/src/study.ts:63` validates existence/retirement on write but has no displayed-version check.

### OUTSIDE-5 — Duplicate source ids produce an impossible recovery instruction

**S2 · Mac · 2/2 fresh-page opens; also 2/2 saves from an already-open source**

1. Restore the seed. Copy the source folder to `items/2026/duplicate-01M7DG3FA0E8FK50S5EMHQ0KCG`, preserving the id in `doc.md`.
2. Open a fresh app page. The source still has one listed row.
3. Open that row.
4. Alternatively, create the duplicate while the source is already open and try to save its note.

**Expected:** Preserve both files and show a useful duplicate-id explanation naming the conflicting folders, or consistently use the same canonical copy selected by the list.

**Actual:** Opening fails with `"01M7DG3FA0E8FK50S5EMHQ0KCG" matches 2 items; use more of the id`. The supplied id is already complete, so the stated recovery is impossible. Note saves from an already-open source fail for the same reason. `ore doctor` does name the duplicate, but the app does not direct the user there.

Evidence: [duplicate-id-open-1.png](duplicate-id-open-1.png), [duplicate-id-open-2.png](duplicate-id-open-2.png), [duplicate-results.json](duplicate-results.json), [moves-results.json](moves-results.json). Reproducers: `duplicates.cjs`, `moves.cjs`.

Suspect: `packages/core/src/items.ts:229–240` treats duplicate full ids as ambiguous prefixes, while `items.ts:249` deduplicates the list by id. This case uses two different folder names both ending in the same id; ordinary `… 2` conflict filenames were checked separately.

### OUTSIDE-6 — Different same-time device ratings silently collapse into one

**S2 · Mac/core · 2/2**

1. Start from the seed. Create two valid review records for the first exercise: rating 1 from one device and rating 4 from another, each with its own computed scheduling state.
2. Give both records the same exercise id and exact timestamp, and put them in `reviews/<yyyy>-<mm>.a-other.jsonl` and `reviews/<yyyy>-<mm>.z-other.jsonl`.
3. Open the app, read the effective reviews through core, inspect `ore due --all`, and run `ore doctor`.
4. Swap which filename holds each rating, keeping both records and their timestamp.

**Expected:** Distinguish conflicting device events from identical copied records, or expose the conflict and apply an explicit resolution rule. Renaming the device log should not silently choose a different rating.

**Actual:** Only rating 1 survives in the effective review history. Swapping the filenames makes only rating 4 survive instead. The queue changes accordingly. Both original lines remain on disk, but one is silently omitted from replay; `ore doctor` reports zero errors and zero warnings. This is lost effective history, **not deletion of the raw log file**.

Evidence: [simultaneous-device-logs-1.png](simultaneous-device-logs-1.png), [simultaneous-device-logs-2.png](simultaneous-device-logs-2.png) show the app remains usable. The decisive evidence is [logs-results.json](logs-results.json): `read1`, `read2`, the two queues, and doctor results. Reproducer: `logs.cjs` with `inspect-reviews.ts`.

Suspect: `packages/core/src/reviews.ts:91–93` deduplicates solely by `card|ts`, after reading sorted filenames. It does not compare record contents or retain a device/event identity.

## Known findings checked

No fixed row is claimed to have returned. F1 already covers a note editor's Undo history being reset by an outside merge; that history behavior was not re-reported. The current note merge itself preserved both writers' text. OUTSIDE-2 concerns a completed app rename followed by a later external rename, rather than F146/F156's Undo-before-save race. F157's navigation-only note history case was not retested.

## What passed

- Undo of an app archive preserved a newer CLI title while restoring the source: 2/2; `undo-preservation-results.json`.
- Undo of an app rating refused with an explicit error after a newer CLI rating, preserving the newer review: 2/2; `undo-preservation-results.json`.
- Source-note append made outside the app survived the next local note save, together with the local typing: 2/2.
- A same-line outside replacement arriving while local typing was still unsaved kept both versions in `notes.md`: 2/2.
- Renaming an open source folder to a name without its id still resolved the source and saved the note into its new folder: 2/2.
- Moving an open source between year folders still resolved the source and saved the note at its new location: 2/2.
- A source added by CLI appeared on Home after returning to the app: 2/2.
- Deleting the current exercise prevented its rating from being logged; the app showed the core error: 2/2.
- An exercise whose source was deleted still revealed its answer and explicitly said its source was no longer in the library: 2/2.
- `doc 2.md`, `note 2.md`, `notes 2.md`, `skills 2.yaml`, and `cards/<id> 2.md` did not replace canonical files or duplicate the fresh source/due lists; canonical exercise wording was retained.
- `.DS_Store` and `Icon\r` in source, year, item, exercise and review folders left lists and the due queue usable.
- A `.doc.md.icloud` filename stand-in made that source absent from the fresh list without crashing healthy sources; this does not validate native download/hydration.
- Truncated, malformed, zero-byte or missing-id source files were skipped while the other sources remained usable.
- Truncated and zero-byte exercise files were skipped while healthy exercises remained due.
- Non-JSON and truncated review-log lines were skipped without blocking lists or the due queue.
- Malformed and zero-byte `skills.yaml` showed explicit repair guidance and did not initialize over the damaged library.

## Limits of the run

No native iCloud conflict-resolution UI, File Provider download, real iPhone synchronization, AI enrichment, or macOS app installation was exercised. Conflicts and placeholders were constructed as files in the assigned scratch library. Source moves stayed within `items/<year>/<folder>`; skill changes used `skills.yaml` and CLI operations, not unsupported arbitrary relocation of a skill-note folder. A general malformed-file matrix was run once; findings above were independently reproduced at least twice. These are findings only, not fixes or passing regression tests.

Final restoration check: all **99 canonical baseline files** matched the assigned library by SHA-256, with no extra canonical files; [restore-check.json](restore-check.json).

Harness observations: an initial move-note check read at the exact 800 ms autosave boundary, before the save completed; allowing the save to finish established the move passes above. One early queued-deletion iteration timed out waiting for Home’s Start review after a scratch-library reset; no diagnostic screenshot was captured for that timeout, so it is not a new finding or a claimed recurrence of F142. The final queued-deletion runs awaited outstanding bridge calls before closing/resetting and reproduced the deleted-exercise display twice.
