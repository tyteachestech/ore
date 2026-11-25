# Ore deep scan 4 — refactors

Covered HEAD `f73516f` on Bun 1.4.4: the shared change/history, source and skill actions, Review session, highlight store, CLI answer types and their callers. Read the working agreement, specification, findings/sweeps, earlier six reports and refactor history; compared relevant old implementations at `48a6c63` (saved in `old-excerpts/`). Used production modules plus the real CLI/core against owned scratch libraries; the skill-picker investigation and a Review confirmation used the supplied Mac WebKit page. Skipped UX, real AI, native iPhone/iCloud, actual simultaneous native windows, exhaustive import/media branches and every AI/mutating command's JSON branch. No full old checkout was executed: old/new claims below distinguish static comparison from runtime controls. All artifacts are under this folder; no tracked repository file or supplied seed library was changed. No browser/server/watcher was launched. The browser harness routes CLI traffic to an owned copy under `libs/`, disables enrichment and blocks AI requests.

**Nine findings: six additional failure modes, one related recurrence of fixed highlight Undo failures, and confirmed reproductions of open F618 and F631.** These are not nine newly introduced regressions. R01 has strong evidence of a timing regression in the Review extraction; several others were already latent before the moves.

All commands below run from `/Users/tylerpoelking/Developer/ore-wt/deep4`. Expected assertion failures exit 1. Each script recreates only its own library. Full confirmation results: [verification.json](logs/verification.json), [picker-verification.json](logs/picker-verification.json), [feed-verification.json](logs/feed-verification.json). “Both” identifies shared Mac/iPhone production code exercised headlessly with the Mac CLI; it does **not** claim observation on a native iPhone.

## Findings

### R01 — A second Undo held during a review save destroys its Redo entry

**S1 · Mac observed; shared main/quick-quiz/iPhone Review session.** Wrong saved review/schedule after Redo. **3/3 headless red confirmation runs, plus the same failure in the actual Mac screen.**

```sh
ORE_NO_ENRICH=1 bun codex-out/refactors/review-history.ts held-undo
```

```text
[DEEP] {"mode":"held-undo","trace":[{"message":"Rating","pending":false,"future":[],"past":["Rating"]},{"message":"Rating","pending":true,"future":["Rating","Rating"],"past":[]}],"ids":["01M88BAS5DWBMEX93SSWZG4E3P","01M88BAS5RDY9S7VEED5SSP6DE"],"before":2,"undo":{"done":0,"canRedo":true,"queue":["01M88BAS5DWBMEX93SSWZG4E3P","01M88BAS5RDY9S7VEED5SSP6DE"],"errors":[]},"after":1,"done":0,"canRedo":false,"errors":[],"calls":["review 01M88BAS5DWBMEX93SSWZG4E3P --rating=3 --confidence=2 --elapsed-ms=124 --session=01M88BAS6TQADNXETAWXQJG14A","review 01M88BAS5RDY9S7VEED5SSP6DE --rating=3 --confidence=2 --elapsed-ms=201 --session=01M88BAS6TQADNXETAWXQJG14A","review 01M88BAS5RDY9S7VEED5SSP6DE --undo=2026-11-25T03:17:33.220Z","review 01M88BAS5DWBMEX93SSWZG4E3P --undo=2026-11-25T03:17:33.144Z","review 01M88BAS5RDY9S7VEED5SSP6DE --rating=3 --confidence=2 --elapsed-ms=201"]}
AssertionError: Two ratings undone while saving cannot both be redone
```

**Mac confirmation:** `ORE_NO_ENRICH=1 node codex-out/refactors/review-browser.cjs` runs the same sequence with actual buttons/keys on the supplied release page, with `__ORE_SLOW.review=500`, against its owned fresh library. Its [log](logs/review-browser.log) and [command trace](logs/review-browser.json) show `done="0"`, `question="Question 1?"` and only one Redo review command, without `--session`. This independently reproduces the headless result.

**Minimised sequence:** Start a session with three due exercises (the third keeps it off the end screen). Rate the first two. Hold the first Undo's review-log write. Press Undo again while the session is busy, then release the write. Let both Undos finish. Redo twice, waiting for each write.

**Expected:** Both ratings return to the log, the session reports two completed, and both exercises leave the pending front of its queue. **Actual:** Only the second rating returns, without a session ID; `done` stays zero, both exercises remain at the front, and there is no further Redo. This changes the persisted review history that drives scheduling; it is not merely a stale toast. No injected operation fails in this case.

**Ranked hypotheses and probes:**
1. The held Undo runs before the history finishes its previous turn, then removes its own already-installed Redo entry. **Confirmed:** instrumented `History.forget` sees the second callback run with a pending history tail and two entries already in `future`; it removes one. A harness-only probe that preserves entries already in `future` restores both reviews and `done=2` (`preserve-future`).
2. A failed CLI review silently consumes Redo. **Rejected:** no errors, and the trace has only one Redo write. Both Undo writes reached the real log.
3. Only the queue display is stale. **Rejected:** `readReviews` reports one rating, not two. Deferring the held key to the next task (`defer-press`) and ordinary serial Undo (`serial`) both restore two reviews and advance the session correctly.

**Cause:** `apps/desktop/src/review-session.ts:152–168` changed held-key dispatch to a microtask via `settle`; `:260–266` dispatches it synchronously. `:520` calls `last.forget()`. `apps/desktop/src/history.ts:60–74` defers a callback behind its pending tail, while `:105–109` already places that step in Redo; `:147–149` removes it from both stacks. The surviving wrong-order Redo takes the fallback at `review-session.ts:495–496`, writing without its session and without advancing this session. Before extraction, `Review.tsx:507–509` dispatched held keys in a React effect; the next-task control models that ordering, but is not a full execution of old React.

### R02 — End-screen Undo changes the log, then becomes permanently unrepeatable if reopening fails (F618)

**S2 · Both. Existing open F618, now reproduced. 3/3 red runs.**

```sh
ORE_NO_ENRICH=1 bun codex-out/refactors/review-loop.ts reopen-fails
```

```text
[DEEP] {"mode":"reopen-fails","initial":1,"first":{"end":true,"done":1,"reviewed":1,"receiptReviews":1,"canUndo":true,"history":"Rating","activeReviews":0,"errors":["undo: Error: reopen refused"]},"second":{"end":true,"done":1,"reviewed":1,"canUndo":true,"errors":["undo: Error: reopen refused","undo: Error: {\"error\":\"the review at 2026-11-25T03:17:31.046Z is not 01M88BAQ3F1NZQV12A2W795XGS's latest\"}"]},"calls":["session start","review 01M88BAQ3F1NZQV12A2W795XGS --rating=3 --confidence=2 --elapsed-ms=1000 --session=01M88BAQ4XFMXHCV1QB6XT0VE6","session end 01M88BAQ4XFMXHCV1QB6XT0VE6","review 01M88BAQ3F1NZQV12A2W795XGS --undo=2026-11-25T03:17:31.046Z","session reopen 01M88BAQ4XFMXHCV1QB6XT0VE6","review 01M88BAQ3F1NZQV12A2W795XGS --undo=2026-11-25T03:17:31.046Z"]}
AssertionError: Undo removed the rating but leaves the end receipt and counters unchanged
```

**Minimised sequence:** One due exercise; rate it to reach the end screen. Fail only `session reopen` once. Invoke the end screen's Undo. Restore the command and invoke Undo again.

**Expected:** The end screen and Undo history agree with the committed review removal, or the operation restores its earlier state and can retry. **Actual after the first attempt:** the active review log has zero ratings, but `end=true`, `done=1`, `reviewed=1`, receipt reviews=1 and `canUndo=true`. The history still offers “Rating”. **Second attempt:** it asks to remove the same review timestamp again and core refuses it as “not … latest”; the end state and counts remain unchanged. The raw append-only log retains its original review and Undo event; “zero” means the active replayed reviews, not erased bytes.

**Ranked hypotheses and probes:**
1. The first command commits before the second fails. **Confirmed:** the real review replay is empty before retry; the injected failure is only on reopen.
2. The review removal itself failed. **Rejected:** zero active reviews and the subsequent missing/latest error prove it succeeded.
3. A rendering delay will reconcile the receipt. **Rejected:** settled model state and a second attempt retain it. `reopen-ok` returns to the exercise normally.

**Cause:** `review-session.ts:523–531` removes the review, then reopens the session, then clears the receipt/decrements state. Failure skips the state update; `history.ts:88–99` restores the step as though nothing committed. This is explicitly pre-existing F618, not a new regression.

### R03 — Removing a highlight while its note saves puts the earlier note above Remove in Undo

**S2 · Both. Related recurrence of F350/F481 under a different overlap. 3/3 red runs.**

```sh
ORE_NO_ENRICH=1 bun codex-out/refactors/highlight-order.ts overlap
```

```text
[DEEP] {"mode":"overlap","undoName":"Highlight note saved","visible":0,"disk":[],"calls":["annotate 01M88BAWRVDHZ2BX0M5V3QPN8B --note=A valuable note.","annotate 01M88BAWRVDHZ2BX0M5V3QPN8B --status deleted","annotate 01M88BAWRVDHZ2BX0M5V3QPN8B --note="],"errors":[]}
AssertionError: Undo after removing a highlight takes back its earlier note instead
```

**Minimised sequence:** A saved highlight with no note. Start saving “A valuable note.” and hold that write. Remove the highlight before the note write returns. Release it; wait for *all* writes. Press Undo once.

**Expected:** The last user action was Remove: Undo brings back the highlight and the note. **Actual:** the top step is “Highlight note saved”; Undo clears the saved note on the deleted annotation and leaves the highlight absent. The command trace is note → delete → empty note. The removal's older history entry still contains a copy, so another Undo can recover it; no permanent unrecoverable loss is claimed.

**Ranked hypotheses and probes:**
1. History entries are installed in different phases. **Confirmed:** the removal records its step immediately; the earlier note records its step only when its write returns, overtaking Remove.
2. Core writes landed out of order. **Rejected:** the recorded CLI order is note then delete, exactly as requested.
3. `whileOut` fails to wait for the final write. **Rejected:** the script explicitly waits for both promises and `allSaved` before Undo. The `serial` control (note fully saved before Remove) restores the highlight with its note.

**Cause:** `highlights.ts:169–176` installs the note step after `whileOut`; `:293–296` installs Remove before its write. Waiting for outstanding writes cannot reorder those entries. This revisits the **same user-visible wrong-step/note-clearing class** as fixed F350 and F481; their guards cover Undo *during* a removal or save, not a later action overtaking a pending note. The earlier Reader also used post-save note registration; introduction at this refactor is not established.

### R04 — An older batch move overwrites a later move of one of its sources

**S2 · Both. 3/3 red runs.**

```sh
ORE_NO_ENRICH=1 bun codex-out/refactors/list-loop.ts batch-order
```

```text
[DEEP] {"mode":"batch-order","calls":["status 01M88BAJGC5G7JYGBWQETBNC3J done","status 01M88BAJGC5G7JYGBWQETBNC3J reading","status 01M88BAJEYPRAPAQSH6DCD99V4 done"],"expected":"reading","disk":"done","screen":"done","undo":"Moved “Original” to To read"}
AssertionError: The earlier batch overwrites the later source move
```

**Minimised UI-valid sequence:** Select two sources and move them to Done. Hold the first source's batch write before it reaches core. Move that source back to To read as a single-source action; let it save. Release the older batch. (One source passed to the batch API is enough headlessly, but the saved loop uses two.)

**Expected:** The more recent move leaves that source To read. **Actual:** the batch's older Done write lands last, so disk and the reread screen say Done while the newest history entry still says “Moved … to To read”.

**Ranked hypotheses and probes:**
1. Batch and single-source writes use different serialization keys. **Confirmed:** the batch has no key; the single action uses the source ID. A harness-only `batch-key` control gives both the same key and ends at `reading`.
2. Core misinterprets the requested status. **Rejected:** the command list is correct and the `batch-serial` control preserves the final `reading` state.
3. Only an old list read overwrote the screen. **Rejected:** a fresh CLI `show` also returns `done`.

**Cause:** `list-actions.ts:166–177` constructs an unkeyed batch; `:75–83` keys `moveTo` by item ID; `change.ts:50–61` gives an unkeyed change an independent queue. A batch cannot coordinate with individual writes to its members. The old App's batch also had its own private queue (`old-excerpts/App.tsx:1766–1791`): this is an inherited hole, not proven new behavior.

### R05 — Undo restores an importance value whose save failed and was removed from history

**S2 · Both. 3/3 red runs.**

```sh
ORE_NO_ENRICH=1 bun codex-out/refactors/list-loop.ts importance-fail
```

```text
[DEEP] {"mode":"importance-fail","calls":["edit 01M88BAKZYPFP633HN2B3FM2FG --priority=P1","edit 01M88BAKZYPFP633HN2B3FM2FG --priority=P3","edit 01M88BAKZYPFP633HN2B3FM2FG --priority=P1"],"expected":null,"disk":"P1","screen":"P1","errors":["first edit refused"],"canUndo":false}
AssertionError: Undo restores an importance change that failed and is absent from history
```

**Minimised sequence:** Start with no explicit source importance. Choose P1; hold and eventually fail that write. Before it returns, choose P3 using the optimistically updated source. Let P3 save. Undo P3.

**Expected:** Return to the last actual saved value (no explicit source importance), with failed P1 absent from history. **Actual:** Undo writes P1, and no earlier Undo remains to remove it. Disk and screen agree on a value that never successfully saved as a user action. Importance affects review prioritization/retention mapping under D22; this is not a claim that FSRS's formulas changed.

**Ranked hypotheses and probes:**
1. The second action captured a failed optimistic value as its inverse. **Confirmed:** commands are P1 (injected failure), P3 (success), P1 (Undo); the first action is forgotten and no earlier Undo remains.
2. The first P1 actually committed despite its error. **Rejected:** the injection fails before executing its CLI command.
3. The operations were reordered. **Rejected:** the common source key serializes them correctly. `importance-serial`, waiting for the failure before choosing P3, undoes to the original unset value.

**Cause:** `list-actions.ts:128–136` captures `item.priority` immediately; `change.ts:80–85` forgets the failed first action without updating the inverse captured by the dependent second one. The original source-importance handler also captured the optimistic value: inherited. A matching rename loop also goes red, but its field is read-only during saving, so it is not counted separately as an ordinary UI-reachable finding.

### R06 — A failed earlier highlight edit rolls the screen back over a later successful edit

**S2 · Both. Two symptoms, one failure-order class; 3/3 runs of each.**

```sh
ORE_NO_ENRICH=1 bun codex-out/refactors/highlight-loop.ts intent-fail
ORE_NO_ENRICH=1 bun codex-out/refactors/highlight-loop.ts note-fail
```

```text
[DEEP] {"mode":"intent-fail","screen":"keep","disk":"question","calls":["annotate 01M88BAV4WHKXS192ZE4TWXGMF --intent card","annotate 01M88BAV4WHKXS192ZE4TWXGMF --intent question"],"errors":["first annotation refused"],"landed":2}
AssertionError: Failed earlier type change overwrites the later successful type on screen
```

```text
[DEEP] {"mode":"note-fail","screen":"","disk":"final note","calls":["annotate 01M88BAVZF3SH4JQDSWNYM9QYD --note=first note","annotate 01M88BAVZF3SH4JQDSWNYM9QYD --note=final note"],"errors":["first annotation refused Your note is kept: open the highlight to save it again."],"unsaved":[]}
AssertionError: Failed earlier note save hides the later successful note on screen
```

**Minimised sequence:** A saved plain highlight. Start a type change to Key point; while its write is held, change it to Question. Fail the earlier write; let the later one save. The note variant saves “first note”, then “final note”, failing only the first.

**Expected:** The settled screen reflects the successfully saved latest change. **Actual:** disk says Question but the store says plain highlight (`keep`). In the note variant disk contains “final note”, the store shows an empty note, and the unsaved-note map is empty. These results persist after `allSaved`; the newer successful write does not repair the rollback.

**Ranked hypotheses and probes:**
1. The earlier catch unconditionally restores its captured old field after the newer optimistic field was shown. **Confirmed:** both handlers do precisely that; the second write does not reapply its successful value.
2. Core saved the wrong value. **Rejected:** fresh `show` returns the final requested type/note.
3. A normal landing callback immediately rereads and fixes it. **Rejected at the caller boundary:** Reader's `landed` callback only increments `annWrites` (`Reader.tsx:697–704`), used to refresh Collected questions (`:4052`), not to replace the highlight store. The `intent-ok` and `note-ok` controls finish with screen=disk. Reopening can repair the view; that is a recovery, not a passing outcome.

**Cause:** `highlights.ts:152–154` and `:177–182` restore `was` without checking whether a newer edit owns the field. The type/note writes are properly serialized at `:83–94`; the bug is failure rollback of the optimistic state. The old Reader has the same unconditional rollback (`old-excerpts/Reader.tsx:2190`, `:2313`), so this survived extraction.

### R07 — A rolled-back batch filing leaves an archived skill revived with no Undo

**S2 · Both. 3/3 red runs.**

```sh
ORE_NO_ENRICH=1 bun codex-out/refactors/batch-failure.ts fail
```

```text
[DEEP] {"mode":"fail","ok":false,"archivedBefore":true,"archivedAfter":false,"sourceSkills":[[],[]],"canUndo":false,"errors":["second source refused"],"calls":["edit 01M88BANANQV9W9130VPB219DG --skills archived-target","edit 01M88BANC5SG4WE30DJ7FJSJQJ --skills archived-target","edit 01M88BANANQV9W9130VPB219DG --skills  --cards={}"]}
AssertionError: A failed batch revives its archived skill permanently, with no Undo step
```

**Minimised sequence:** Two unfiled sources and one archived skill. File both under that skill. Allow the first edit to complete (core revives the archived skill under D173); fail the second before its CLI command. Let rollback finish.

**Expected:** A failed all-or-none batch restores both assignments and the skill's archived state. **Actual:** both sources return to empty skill lists, but the skill is live and the batch history entry is gone. No remaining Undo can take back that revival.

**Ranked hypotheses and probes:**
1. Revival compensation is registered too late in the step list. **Confirmed:** restoring source skills does not rearchive a skill; rearchive belongs to the final `after` step, which the failed forward batch never reaches.
2. The first edit's inverse failed. **Rejected:** its CLI command succeeds and fresh source reads have their original empty assignments.
3. The skill was already live or another device revived it. **Rejected:** an initial core read asserts archived=true; the library is owned and isolated. The successful-batch-then-Undo control (`undo`) restores archived=true.

**Cause:** `list-actions.ts:185–197` makes rearchive the final batch callback; `:175` passes it after source writes to `allOrNone`; `change.ts:31–40` compensates only steps that completed, so this callback is absent from rollback. `change.ts:80–81` then forgets the batch. **Relation to known F7/F620:** this is not just the accepted “batch has no rollback” limit. Rollback now succeeds for every source but misses the implicit skill side effect, and removal of the failed step removes the old recovery path. F620's successful Undo is covered and passes; its partial-failure counterpart is not.

### R08 — A source read during the second skill Undo puts AI back, so Enter removes it (F631 / F474)

**S2 · Mac observed in supplied WebKit; Reader is shared with iPhone. Open F631 confirmed; fixed F474 guard is incomplete for this ordering. 3/3 timed red runs, 3/3 idle controls pass.**

```sh
ORE_NO_ENRICH=1 node codex-out/refactors/picker-min.cjs 1 gated
```

```text
[DEEP] {"n":0,"control":"gated","beforeOpen":{"head":"The Testing Effect: Why Retrieval Beats Rereading\nAuthor\nLearning\nTeaching\nsource.md ↗","focus":"chips-button","pending":["skills","edit 01M88A1DAFXRC2Z04VKPX90AHX","show 01M88A1DAFXRC2Z04VKPX90AHX"],"toasts":["Undone: Filed under Storytelling & WritingRedo","Undone: Filed under AIRedo"],"at":1795576317082},"beforeEnter":{"head":"The Testing Effect: Why Retrieval Beats Rereading\nAuthor\nLearning\nTeaching\nAI\nsource.md ↗","typed":"AI","on":"AI","checked":"true","focus":"menu-input","pending":["edit 01M88A1DAFXRC2Z04VKPX90AHX"],"toasts":["Undone: Filed under Storytelling & WritingRedo","Undone: Filed under AIRedo"],"at":1795576317342,"diskSkills":["learning","teaching"]},"after":{"head":"The Testing Effect: Why Retrieval Beats Rereading\nAuthor\nLearning\nTeaching\nsource.md ↗","typed":"AI","on":"AI","checked":"false","focus":"menu-input","pending":[],"toasts":["Removed from AIUndo"]},"pass":false}
AssertionError [ERR_ASSERTION]: Typing AI and Enter does not file it after both Undo writes
```

**Minimised sequence:** Open the seeded Testing Effect source. Add AI and Storytelling & Writing in its skill picker, then close it. Undo both additions. Delay edit replies by 1,000 ms, source-read replies by 400 ms, and hold the second Undo's edit before execution for 150 ms. Wait until disk has both additions removed and the header has only Learning/Teaching. Reopen the picker. The outstanding stale source read puts AI back into the header and checks its row while disk still lacks it. Type AI in the focused filter and press Enter.

**Expected:** AI is filed again, as the preceding completed Undo and header state led the learner to expect. **Actual:** “Removed from AI”, AI remains absent on disk, and no “Filed under AI” arrives within five seconds. Both Undo *writes* have committed before typing; the second command's reply is still in flight. The script waits for the stale header before Enter to deterministically target the race instead of retrying until green. The earlier ungated journey also showed this symptom, but only the controlled repetitions are used for the rate above.

**Ranked hypotheses and probes:**
1. A stale `show` begins after the second optimistic Undo but before its queued edit reaches disk; the read guard accepts it while that edit still awaits its reply. **Confirmed:** the recorded `show` answer includes AI; the subsequent second edit answer excludes it; at Enter the fresh disk read is `[learning,teaching]` while header and checked picker row include AI. The existing guard checks changes to a counter, not whether a filing was already in flight when the read started. `idle` waits for outstanding commands after Undo and passes 3/3.
2. Enter reaches an unfocused filter or the wrong highlighted option (earlier F479/F500 class). **Rejected:** `focus=menu-input`, `typed=AI`, selected row `AI`, and `checked=true` are captured immediately before Enter.
3. Core loses the successful refile. **Rejected:** the actual Enter command requests the *old* `learning,teaching` set; its toast accurately says Removed. No request to add AI is lost.

**Cause:** `Reader.tsx:1157–1167` preserves optimistic skills only if `filings` changes *during* the read; `:3204–3221` bumps it when the optimistic action is shown and when the command settles. A read wholly inside that interval is wrongly accepted. The serialized second edit has not necessarily reached disk when the first edit's wake triggers the read (`ore.ts:42–57`). See command/answer timestamps in [picker-gated-1.json](logs/picker-gated-1.json). This is the F474 symptom with a different read-start window, not a new independent picker-filter failure. No evidence links it to F623's note-selection restoration or F480's highlight tint; neither was reproduced or assigned this cause.

### R09 — Undo of Mark read on mixed Feed posts changes a post that was already read

**S2 · Mac Feed. 3/3 red runs.**

```sh
ORE_NO_ENRICH=1 bun codex-out/refactors/feed-inverse.ts mixed
```

```text
[DEEP] {"mode":"mixed","before":[true,false],"after":[false,false],"screen":[false,false],"calls":["feed read https://example.test/read https://example.test/unread","feed unread https://example.test/read https://example.test/unread"],"errors":[]}
AssertionError: Undo of Mark read on mixed posts marks the already-read post unread
```

**Minimised sequence:** Two cached Feed posts, one read and one unread. In All, select both and Mark read; Undo once. No network requests are used. The script extracts the exact `setRead` callback from current `Feed.tsx` into its own folder, binds production `change`/History and real CLI writes, and reads the resulting per-device Feed log through core.

**Expected:** `[read, unread]`, the original individual states. **Actual:** `[unread, unread]` on both disk and screen. The selected already-read post is falsely returned to the unread backlog.

**Ranked hypotheses and probes:**
1. The inverse uses the opposite batch-wide flag rather than each post's original flag. **Confirmed:** the command pair is `feed read <both>` then `feed unread <both>`; no per-post state is captured.
2. The UI cannot create a mixed selection. **Rejected by caller trace:** `Feed.tsx:273–276` uses `ps.some(p => !p.read)` and passes *all* selected posts to this callback.
3. Feed log replay or timestamps are wrong. **Rejected:** screen state already shows the same wrong pair, and the homogeneous `unread` control restores both posts correctly.

**Cause:** `Feed.tsx:163–169` collects only URLs and applies `v === on` to every post on Undo. The earlier handler likewise used `setRead(post, !on, false)` (`old-excerpts/Feed.tsx:162–176`): inherited, not a new refactor regression. Distinct from F24 (operating on the selection) and F481 (Undo during a pending save).

## Leads and limits

- **CLI type overclaim, no screen failure:** `answers.ts` describes `Try` as `TryView`, but `try --skill ... --plan ...` returns an annotation without `item_title`. `Forge.tsx:171` consumes only `id`, then reloads `tries`, which does provide the title. Full-shape type rejection is saved in `logs/answer-full-types.log`; this does not satisfy the requested user-visible finding threshold. The consumed `id` passes.
- **Other pending-read guards:** `reads.ts` also compares write counters rather than outstanding count. R08 proves the Reader case only; list recovery/navigation under that same start-window has no separate red loop here.
- **Other overlapping dependent inverses:** R05's captured optimistic-value pattern also appears in badge/goal/collection edits. Only source importance is counted; the rename script's red is retained as supporting module evidence because a single rename field prevents simultaneous saves.
- **Remaining scope:** actual two-device/native-window interaction, course navigation after external archive, collection-name collision, and app-session midnight rollover were not comprehensively exercised here. Earlier core scheduling/import/sync coverage was not repeated. These omissions are not passes.
- **F623 and F480:** no reproduction or causal link found in this run. Their timing alone is insufficient to merge them with F631.

## What passed

- `TMPDIR=$PWD/codex-out/refactors/tmp ORE_NO_ENRICH=1 bun test apps/desktop/test/change.test.tsx apps/desktop/test/history.test.ts apps/desktop/test/list-actions.test.tsx apps/desktop/test/review-session.test.ts apps/desktop/test/highlights.test.ts`: **87 pass, 0 fail**, 385 assertions ([log](logs/existing-tests.log)). These include first-save and inverse failures, held Undo/Redo, initial review/save/close/goal behavior, Later, stand-in IDs, pending creation/type/note/removal and old-read merges; they did not catch the cross-module sequences above.
- `change-fuzz.ts` and `change-fuzz.ts fail`: **2,000 seeded sequences**, seed `0x12345678`; one slow change plus random Undo/Redo presses, with an injected inverse failure in one third of the second set. Settled display equals the in-memory persistence boundary in all. This is a virtual transport property check, not 2,000 real disk writes.
- `list-matrix.ts`: **13 real CLI round trips**: source archive, move, pin, title, importance and filing; batch archive, move and filing; skill move and importance; collection rename/delete. Undo restores source fields, skill fields and displayed collection layout. Raw skill-array order can normalize during arrange; comparing the actual grouped layout avoids falsely reporting that normalization.
- Source batch moves with a shared key, and serial batch/single moves, preserve the latest requested state; choosing importance only after the failed earlier save restores its actual saved predecessor on Undo.
- Successful filing of two sources under an archived skill followed by Undo rearchives the skill and restores both assignments (F620 control).
- Review's successful reopen returns from its end screen; serial Undo/Redo restores two ratings; both targeted R01 controls restore two ratings and `done=2`.
- Successful overlapping highlight type/note writes agree with disk; serial note-save then Remove then Undo restores the highlight and note. Existing store tests also pass saved/stand-in lookup, stale-read preservation and removal while creation saves.
- Picker idle control: **3/3 passes** with the same two added skills and two Undos; typed AI/Enter files it once outstanding reads/writes settle.
- Feed Mark read/Undo on two originally unread posts restores both correctly.
- `answer-shapes.ts`: **90 successful command samples, 78 typed samples**, across empty and seeded libraries plus mutations, and **30 invalid-option rejection checks**. Lists, source/annotation shapes, due/today, questions/tries, search found/empty, notes, backlinks, diagram-empty, card show/set, skills, session receipts and the consumed Try creation ID pass their actual JSON checks. Settings/inbox/feed/chat/global stats and plain edit were exercised without exported-answer shape assertions. Extra JSON fields are allowed; optional `undefined` fields may be omitted. Validation uses `answer-literals.ts` and the command below; no user-visible type mismatch established. AI outputs, media-specific variants and all possible command branches were not sampled.

```sh
ORE_NO_ENRICH=1 bun codex-out/refactors/answer-shapes.ts
bun node_modules/typescript/bin/tsc --ignoreConfig --noEmit --strict --skipLibCheck --types bun --target ESNext --module ESNext --moduleResolution bundler --allowImportingTsExtensions codex-out/refactors/answer-literals.ts packages/core/src/text-imports.d.ts
```

The initial broader type probe also incorrectly treated plain `edit` as a complete list `Item` (`path`/`dir` are absent). No app consumer was found reading those missing fields from that return, so it is not reported as an app bug. The final type check matches consumed return shapes. All spawned probe processes and browser contexts were closed; `git status --short` remained empty. Findings only: no implementation changes, no findings-registry edits, no commit/push.
