# Edges deep scan — 2026-11-24 (America/Los_Angeles)

Scanned master `f73516fffdfe71a686fc2c089b41b7771a35f8de` with Bun 1.4.4. Covered the earlier reports’ leads, interrupted core/CLI writes, Git snapshots, disposable-index damage and concurrent rebuilding, iCloud-style conflict filenames, a 30-day learning lifecycle, retrieval at `ORE_SEED_SCALE=4`, and the Mac Original page after reimport. **11 findings: five S1, three S2, three S3.** Read the working agreement, spec, findings/sweeps, six prior reports and relevant decisions; existing findings are distinguished below. This was not a UX sweep. Skipped real AI, live websites, native iPhone execution, actual iCloud transport, and exhaustive mutation-command coverage; the random interruption survey covers 30 command paths, not every flag combination. All scripts, inputs, fake executables, logs and libraries are inside `codex-out/edges/`. No tracked files, supplied seed libraries, installed app, servers or watchers were changed. The browser check used the supplied WebKit, one context and one page, and closed them.

## Reproduction contract

Run from `/Users/tylerpoelking/Developer/ore-wt/deep4`. Script links below resolve inside this report’s folder. Every red command creates/resets only its own library under `codex-out/edges/libs/` and deliberately exits 1 on the named symptom. Do not run two copies of the same script together. AI scripts install verified fake `claude` and `codex` executables first on their process PATH; run these scripts sequentially because they share that fake-bin directory. No real vendor was invoked.

[confirm-results.json](confirm-results.json) records **36/36 expected red runs** across 12 cases and **14/14 passing controls**. The empty-lock finding adds **3/3 red runs and one passing control**, in [empty-confirm-results.json](empty-confirm-results.json) and `logs/empty-lock-1.log`. The live-lock finding also passed a separate real 61-second-pause confirmation. Each finding gives output excerpts; complete stdout/stderr is linked. Hypotheses are ranked by the evidence. Instrumentation is confined to scripts: wrappers pause at real filesystem boundaries, then call the unmodified core functions; interruption cases send actual SIGKILL to a child process. These deterministic boundary tests establish possibility, not the frequency of a real crash at that boundary.

## Findings

### EDGES-01 — Interrupted reimport Undo removes an existing source from the library — S1

**Mac demonstrated; both devices can consume the damaged library.** The source’s bytes remain in recovery stashes, but its canonical `doc.md` is missing, so ordinary reopening and retrying cannot recover it. This is not irreversible destruction of every copy.

**Red command — [undo-kill.ts](undo-kill.ts):**

```sh
ORE_NO_ENRICH=1 bun codex-out/edges/undo-kill.ts
```

[Output](logs/confirm-undo-kill-1.log), **3/3**:

```text
signal: SIGKILL; docExists: false; ore ls: []
retryExit: 1; retry: no item matches "<source id>"
doctor: an add that stopped before it finished (no doc.md), so it is not in the library; delete this folder, then add the source again
error: Interrupted Undo removes an existing source, and reopening or retrying cannot recover it
```

**Minimized steps:** Add one source, reimport changed text, start Undo of that reimport, kill immediately after Undo unlinks the current `doc.md`, run `ls`, retry Undo with its saved step, then run `doctor --fix`. **Expected:** an existing source remains readable in either complete version, or reopening completes/restores the interrupted swap. **Actual:** it disappears; retry fails before reaching the stash; Doctor mistakes it for an unfinished new import and leaves it missing. Removing the kill makes the complete Undo/redo control pass.

**Ranked hypotheses and probes:**

1. Undo removes the canonical document before installing its replacement. **Confirmed:** the wrapper kills immediately after the real unlink; the missing file is observable independently of the index.
2. Only a stale index hides an intact source. **Rejected:** `existsSync(docPath)` is false, core `listItems` and a fresh CLI `ls` agree, and Doctor sees the missing document.
3. The saved Undo step automatically repairs the interruption. **Rejected:** the explicit retry fails at item lookup; the stash exists but is never reached.

**Cause:** [ingest/index.ts:816](../../packages/core/src/ingest/index.ts#L816), especially unlink at **824** before replacement at **831**; [undoReimport:1135](../../packages/core/src/ingest/index.ts#L1135) requires the missing item before examining its stash. F283 covers an interrupted **new add**; this is the disappearance of a previously saved source during Undo, with the wrong recovery advice.

### EDGES-02 — A live writer’s one-minute lock expires and loses another saved note — S1

**Mac, concurrent CLI/core writers.** Not a claim about native iPhone lock implementation.

**Red command — [live-lock.ts](live-lock.ts):**

```sh
ORE_NO_ENRICH=1 bun codex-out/edges/live-lock.ts
```

[Output](logs/confirm-live-lock-1.log), **3/3**:

```text
ownerWasAlive: true
second command: exit 0, text "Base.\nSecond saved edit."
final note: "Base.\nFirst pending edit."
error: A live writer loses a successfully saved second edit when its lock passes 60 seconds
```

**Minimized steps:** Save `Base.`. Start a note save with that base and hold it immediately after reading the old note while it owns the lock. Age only its lock timestamp past 60 seconds. Execute a second real CLI note save with the same base; let it succeed. Resume the first save. **Expected:** serialization plus note merging preserves both edits. **Actual:** the first save overwrites the second successful save using its previously read contents.

**Ranked hypotheses and probes:**

1. Lock age permits takeover even when the owner PID is alive. **Confirmed:** the owner passes `process.kill(pid, 0)` while the second command succeeds. `bun codex-out/edges/live-lock.ts real-time` also reproduced after an actual **61,050 ms pause**, without timestamp changes: [log](logs/live-lock-real-time.log).
2. `mergeNotes` loses concurrent additions even when serialized. **Rejected:** `live-lock.ts serial` retains both additions using the same base and texts: [control](logs/control-live-lock-serial.log).
3. An index/cache or reporting artifact hides a saved addition. **Rejected:** the script reads the final canonical `notes.md`; the second CLI’s successful JSON explicitly contains the subsequently lost addition.

**Cause:** [lock.ts:17](../../packages/core/src/lock.ts#L17), particularly **21**: an alive PID still reaches the age-based stale return. [notes.ts:146](../../packages/core/src/notes.ts#L146) reads once before writing at **149**; it is safe only while the lock remains exclusive. This confirms the first scan’s live-lock lead with actual lost saved text.

### EDGES-03 — A path-like handwritten skill ID overwrites an existing source note — S1

**Mac demonstrated; shared core note-path logic also serves iPhone.** Requires malformed hand-edited `skills.yaml`; normal skill creation does not generate this ID.

**Red command — [skills-ids.ts](skills-ids.ts):**

```sh
ORE_NO_ENRICH=1 bun codex-out/edges/skills-ids.ts path
```

[Output](logs/confirm-skills-ids-path-1.log), **3/3**:

```text
id: ../items/2026/source-note-owner-<source id>
error: ""
saved: "New skill note."
error: Path-like skill ID overwrites an existing source note
```

**Minimized steps:** Create one source and save `My original source note.`. Put a skill whose ID is `../` followed by that source’s library-relative directory in `skills.yaml`. Save `New skill note.` through core’s ordinary skill-note setter. **Expected:** reject the invalid ID before writing, or confine the note to its own skill directory. **Actual:** the source’s canonical note is replaced with the skill note, with no error.

**Ranked hypotheses and probes:**

1. An unconstrained ID is joined into a filesystem path. **Confirmed:** the target resolves to the existing source’s `notes.md`, and its bytes change.
2. Duplicate skill resolution selects the wrong record. **Rejected for this case:** the YAML contains exactly one skill; duplication is unnecessary.
3. Ordinary source-note saving or merge logic is defective. **Rejected:** initial source-note saving succeeds; changing only the handwritten ID to `safe-subject` preserves the original source note: [control](logs/control-skills-ids-safe.log).

**Cause:** [skills.ts:23](../../packages/core/src/skills.ts#L23) accepts any string; [notes.ts:82](../../packages/core/src/notes.ts#L82) joins it directly into a path, and **100–101** checks membership only. The overwrite occurs at **149**. The reproducer stays entirely inside its scratch library; it does not probe outside the authorized folder.

### EDGES-04 — Retrying an interrupted skill move leaves exercises on the old schedule — S1

**Mac demonstrated; shared core filing and scheduling affect both devices.**

**Red command — [filing-kill.ts](filing-kill.ts):**

```sh
ORE_NO_ENRICH=1 bun codex-out/edges/filing-kill.ts
```

[Output](logs/confirm-filing-kill-1.log), **3/3**:

```text
signal: SIGKILL
interrupted: source [habits], exercise [learning]
retried: source [habits], exercise [learning]
actualDue:   2026-06-03T12:00:00.000Z
expectedDue: 2026-06-09T12:00:00.000Z
error: Retrying an interrupted filing leaves its exercises under the old skill
```

**Minimized steps:** One Learning source, one Learning exercise. Move the source to Habits; kill after its document is saved but before its exercise is updated. Retry exactly the same filing. Record Good at June 1, noon UTC. **Expected:** retry completes the move, including Habits’ P3 retention target; the new exercise is due June 9. **Actual:** retry succeeds but leaves the exercise under Learning/P1, due June 3.

**Ranked hypotheses and probes:**

1. Retry derives an empty change from the already-updated source, so it cannot finish its earlier exercise writes. **Confirmed:** source and exercise frontmatter disagree both before and after the successful retry.
2. The index temporarily retains the old assignment. **Rejected:** `findCard` reads the old skill from the canonical exercise file; a later real review uses that assignment.
3. FSRS itself calculates the wrong interval. **Rejected for this symptom:** comparing the same initial state, clock and Good rating under the intended `.8` target gives June 9; the uninterrupted `control` keeps source and exercise together and passes.

**Cause:** [skills.ts:475](../../packages/core/src/skills.ts#L475) derives added/removed skills from current source metadata, **478** saves that metadata first, and **480–482** updates exercises afterward without a resumable transaction. Distinct from F244/F620: this is process death and retry, not Undo restoring an exercise’s individual skills.

### EDGES-05 — Automatic history captures a half-completed skill move — S1

**Mac library history; either device can later read the restored files.** The live operation completes correctly. The corruption is in the recorded recovery snapshot.

**Red command — [history-filing.ts](history-filing.ts):**

```sh
ORE_NO_ENRICH=1 bun codex-out/edges/history-filing.ts
```

[Output](logs/confirm-history-filing-1.log), **3/3**:

```text
concurrentCliExit: 0
live: source [habits], exercise [habits]
fromHistory: source [habits], exercise [learning]
followupSnapshot: { committed: false }
error: Automatic CLI snapshot restores a source under its new skill but its exercise under the old skill
```

**Minimized steps:** Create one source and exercise under Learning and snapshot them. Make the normal ten-minute snapshot eligible. During filing to Habits, after the document write but before the exercise write, run real `ore ls --json` in another process. Let filing finish; clone the library’s Git history into another owned scratch library and compare. **Expected:** a recoverable snapshot contains either complete filing state. **Actual:** its source and exercise disagree; an immediate follow-up snapshot is throttled, so the inconsistent snapshot remains the latest recovery point.

**Ranked hypotheses and probes:**

1. CLI history staging ignores the library write lock. **Confirmed:** the second CLI completes and commits while filing still holds the lock.
2. The filing operation itself ends inconsistent. **Rejected:** live core reads show Habits on both files; only the restored Git tree disagrees.
3. Git clone or delayed file visibility changes the restore. **Rejected:** the same clone procedure passes when the snapshot is taken after filing completes: `history-filing.ts control`. The throttling marker explains why a follow-up does not replace the bad snapshot.

**Cause:** [history.ts:11](../../packages/core/src/history.ts#L11), **19–22**, stages and commits without the library lock. Every successful CLI command, including read-only `ls`, calls it at [ore.ts:43](../../packages/cli/src/ore.ts#L43). The observed intermediate writes are [skills.ts:478](../../packages/core/src/skills.ts#L478) and **482**. This confirms the first scan’s unlocked-history lead; it does not duplicate the interrupted-filing finding, since no process dies and the live library is correct.

### EDGES-06 — Enrichment creates an exercise from a highlight deleted before the reply — S2

**Mac generates; both devices consume the exercise.** SPEC line 98 says deleted highlights are omitted from drafting; already-drafted exercises stay. Here no exercise exists when the highlight is deleted.

**Red command — [enrich-race.ts](enrich-race.ts):**

```sh
ORE_NO_ENRICH=1 bun codex-out/edges/enrich-race.ts delete-highlight
```

[Output](logs/confirm-enrich-race-delete-highlight-1.log), **3/3**:

```text
annotations: 0
cards: [{ annotation: "<deleted highlight id>", answer: "Spaced retrieval." }]
ai: { vendor: claude, model: edges-fake, prompt_version: enrich@17 }
error: Enrichment saves a new exercise from a highlight deleted before the AI reply
```

**Minimized steps:** One source and one Key point. Start actual enrichment using a valid fake reply held at a barrier. Delete the highlight through core before releasing the reply. **Expected:** skip that now-deleted origin. **Actual:** a new exercise is written against it.

**Ranked hypotheses and probes:**

1. Pending origin IDs are captured before AI and not revalidated when saving. **Confirmed:** deletion completes and the final annotation list is empty before the draft appears.
2. The deletion silently failed or ran after the draft. **Rejected:** the fake executable cannot reply until the script releases it after `reviseAnnotation`; `readAnnotations` confirms deletion.
3. The fake output or exercise parser is invalid. **Rejected:** keeping the highlight produces exactly one correct exercise with the same schema and attribution; no vendor/parser error occurs. The note-edit control also keeps the changed note pending for a later run.

**Cause:** [enrich.ts:179](../../packages/core/src/ai/enrich.ts#L179) and **190** capture old pending highlights; the locked save refreshes the item at **273**, but **315–316** filters drafts only against existing exercise origins, not current live annotations. Distinct from F599’s overlapping-draft deduplication: this needs only one enrichment run.

### EDGES-07 — Moving exercises to another skill erases an earned level — S2

**Both, shared strength calculation; core demonstrated.** Violates D63: a skill’s level comes from the most solid memories it ever had and never drops.

**Red command — [level-move.ts](level-move.ts):**

```sh
ORE_NO_ENRICH=1 bun codex-out/edges/level-move.ts
```

[Output](logs/confirm-level-move-1.log), **3/3**:

```text
before:  solid 5, peak 5, level 1
 after:  solid 0, peak 0, level 0
rebuilt: solid 0, peak 0, level 0
unchangedReviews: true
error: Refiling five solid exercises erases the original skill's earned level (D63)
```

**Minimized steps:** One Learning source, five exercises, two pinned Good reviews per exercise (June 1 and June 12), enough to reach five solid memories and level 1. File that source exclusively under Habits. Read Learning’s strength and repeat after deleting the index. **Expected:** current solid count can fall to zero, but the earned peak/level remains 5/1. **Actual:** both become zero with all review records intact.

**Ranked hypotheses and probes:**

1. Historical peak is filtered through exercises’ current skills. **Confirmed:** keeping Learning while adding Habits (`level-move.ts add`) preserves level 1; removing Learning drops it.
2. The move deletes reviews or resets FSRS. **Rejected:** review records compare unchanged; the larger lifecycle transfers the five solid memories to Habits.
3. A stale index or different day changes the count. **Rejected:** pinned dates and a fresh rebuild produce the same loss.

**Cause:** [today.ts:83](../../packages/core/src/today.ts#L83) builds the historical ID set from **current** skill assignments; **91–101** discards every past review outside that set. F242 fixed retirement and F565 fixed offline replay; neither covers a source changing skills. The full 30-day lifecycle independently exposed the same drop: [lifecycle-results.json](lifecycle-results.json).

### EDGES-08 — A damaged disposable index blocks search without naming its repair — S2

**Mac CLI demonstrated; index-using Mac screens share the path.** Native phone storage was not damaged in this test. Violates the scan’s disposable-index contract: rebuild or refuse with the next step. Canonical source data remains intact.

**Red commands — [index-survey.ts](index-survey.ts):**

```sh
ORE_NO_ENRICH=1 bun codex-out/edges/index-survey.ts junk
ORE_NO_ENRICH=1 bun codex-out/edges/index-survey.ts truncated
```

[Non-database output](logs/confirm-index-survey-junk-1.log), [truncated output](logs/confirm-index-survey-truncated-1.log), **3/3 each**:

```text
search exit 1: {"error":"file is not a database"}
search exit 1: {"error":"database disk image is malformed"}
rebuildExit: 0; subsequent search finds the original source
error: Disposable index damage blocks search with no repair step
```

**Minimized steps:** Add one source and build its index. Replace only `.index/library.sqlite` with junk bytes, or truncate it to 100 bytes. Run actual CLI search. **Expected:** rebuild from canonical files or say to run `ore reindex`. **Actual:** raw SQLite failure, no next step. Explicit reindex successfully repairs both cases.

**Ranked hypotheses and probes:**

1. Ordinary index opening lacks the repair path used by explicit rebuilding. **Confirmed:** search fails and immediately following `reindex` succeeds without changing a source.
2. Canonical content is damaged or missing. **Rejected:** explicit rebuild finds the original ID and text.
3. Every absent, old or foreign cache fails. **Rejected:** deleted directory, zero-byte file, older schema and another library’s index all reopen with correct membership. Twelve pairs of concurrent rebuild processes also pass.

**Cause:** [db.ts:237](../../packages/core/src/db.ts#L237), especially **247–250**, propagates corruption before normal schema recovery. [db.ts:477](../../packages/core/src/db.ts#L477) handles it only in `rebuildIndex`; `openIndex` at **449** does not. D5/CLAUDE’s disposable-index rule is the relevant boundary, not a request to retain this cache as canonical data.

### EDGES-09 — An EPUB silently drops a spine chapter missing from its manifest — S3

**Mac import; both devices read the resulting document.** Malformed EPUB edge, original retained. D96/D122 require whole import or refusal; D351 relaxes missing figures only, not missing chapters.

**Red command — [epub-spine.ts](epub-spine.ts):**

```sh
ORE_NO_ENRICH=1 bun codex-out/edges/epub-spine.ts
```

[Output](logs/confirm-epub-spine-1.log), **3/3**:

```text
error: ""; sources: 1
body: "<!-- chapter 1 -->\n\n# First chapter\n\nRetrieval practice strengthens memory.\n"
error: EPUB import succeeded while silently dropping its second spine chapter
```

**Minimized steps:** Import the script-generated EPUB with two chapter files and two spine `idref`s, but only the first chapter’s manifest entry. **Expected:** refuse with a download/export-again step when the second spine entry cannot be resolved. **Actual:** successful import containing only chapter one, with no marked missing chapter.

**Ranked hypotheses and probes:**

1. Unknown manifest IDs are silently filtered from the spine. **Confirmed:** adding only the missing manifest entry makes both chapters import in the `control`.
2. Chapter two is absent from the ZIP or has no readable prose. **Rejected:** it is packaged in both cases, with the same heading and prose; the corrected manifest exposes it.
3. The final save truncates a correctly parsed document. **Rejected:** the omission follows spine resolution; unchanged full-import save succeeds with both chapters in the control.

**Cause:** [epub.ts:100](../../packages/core/src/ingest/epub.ts#L100), **101–103**, maps an unresolved ID to `undefined` and filters it out. This is the first scan’s manifest lead, distinct from F569’s image-only chapter and the missing-figure rule now governed by D351.

### EDGES-10 — Empty HTML and a ZIP named .docx expose parser errors without a next step — S3

**Mac file import; shared import code.** Both inputs are refused and neither saves a partial source. The defect is the D96 refusal contract, not acceptance of invalid content.

**Red commands — [refusals.ts](refusals.ts):**

```sh
ORE_NO_ENRICH=1 bun codex-out/edges/refusals.ts html
ORE_NO_ENRICH=1 bun codex-out/edges/refusals.ts docx
```

[HTML output](logs/confirm-refusals-html-1.log), [DOCX output](logs/confirm-refusals-docx-1.log), **3/3 each**:

```text
{"error":"First argument to Readability constructor should be a document object."}
{"error":"Could not find main document part. Are you sure this is a valid .docx file?"}
error: Invalid import is refused with a raw error and no useful next step (D96)
```

**Minimized steps:** Add a zero-byte `.html`; separately add a valid ZIP containing just `unrelated.txt`, named `.docx`. **Expected:** explain the unusable input and how to obtain a valid copy, export again, or supply its text. **Actual:** internal parser terminology or a rhetorical validity question, with no recovery action.

**Ranked hypotheses and probes:**

1. Parser exceptions bypass the intended friendly refusal. **Confirmed:** HTML throws inside Readability’s constructor before the no-text refusal; Mammoth throws before Ore’s post-conversion validation.
2. Missing dependencies or the local parser installation fail on all files. **Rejected:** a valid local HTML article and `notes.docx` import successfully through the same core pipeline: [control](logs/import-controls.log).
3. CLI JSON formatting hides a useful recovery message. **Rejected:** the actual command’s JSON contains the raw exception; the script asserts the returned error, not a reconstructed message.

**Cause:** [web.ts:412](../../packages/core/src/ingest/web.ts#L412), before its useful refusal at **413**; [office.ts:49](../../packages/core/src/ingest/office.ts#L49), before the body check at **54**. The CLI’s final error handler forwards those messages. These were explicit first-scan leads, not previously reported findings.

### EDGES-11 — A crash while creating the lock blocks the next save for 15 seconds — S3

**Mac CLI/core.** No previous note is lost. This is a temporary recovery failure, not permanent library corruption.

**Red command — [empty-lock.ts](empty-lock.ts):**

```sh
ORE_NO_ENRICH=1 bun codex-out/edges/empty-lock.ts
```

[Output](logs/empty-lock-1.log), **3/3**:

```text
signal: SIGKILL; nextExit: 1; waitMs: 15042
next: library is locked (.../.ore/lock); retry, or delete it if no ore process is running
saved: Previously saved note.
error: A dead writer leaves an empty lock that makes the next save wait 15 seconds and fail
```

**Minimized steps:** Save a note. Start its next save, kill the writer immediately after exclusive lock-file creation and before PID writing. Run a real CLI save. **Expected under the interruption contract:** reopening permits the next write, or a recovery wait spans the stale-lock grace period. **Actual:** the next save times out at 15 seconds while the dead writer’s empty lock remains protected for 60 seconds. The error does offer manual removal, so this is lower severity than EDGES-02. The one-minute grace for an empty PID is intentional in the code; the mismatch with the shorter write timeout is the observed cost.

**Ranked hypotheses and probes:**

1. Empty-PID locks use an age-only threshold longer than the normal wait. **Confirmed:** the captured file is zero bytes; all three deterministic runs fail after about 15 seconds. Aging that same lock past a minute makes the next CLI save succeed in **74 ms**: [control](logs/empty-lock-control.log).
2. A writer is still alive and legitimately owns the lock. **Rejected:** the child has exited from SIGKILL before the next command begins.
3. Interrupted note contents or an index failure prevent saving. **Rejected:** the previous note remains exact; the age-only control succeeds without modifying content or the index.

**Cause:** [lock.ts:56](../../packages/core/src/lock.ts#L56) creates the file before PID write at **57**; `lockStale` at **17–21** only reclaims an empty PID after 60 seconds, but `withLock` defaults to a **15,000 ms** timeout at **51**. The broad random survey first hit this naturally at trial **270**, a `notes` command killed after **32 ms**; [kill-survey.json](kill-survey.json) preserves that trial and `libs/kill-failure-270/` preserves its state.

## Leads and bounded gaps

- **Reimport interrupted between body replacement and highlight revisions:** `interruption.ts reimport-kill` leaves old stored offsets alongside the new body. Read-time anchoring may repair their displayed meaning; no minimized learner-visible corruption was established, so it is not another finding.
- **Snapshot during reimport:** `interruption.ts history` can capture new body plus old highlight revisions. The filing snapshot finding demonstrates a concrete bad restore; the highlight variant still needs a reading/anchoring consequence before counting it separately.
- **Variants after retirement:** `variants-lifecycle.ts retire` writes one valid variant after retirement, but `reviewVersion` returns null. Waste/stale records observed, no demonstrated learner harm. Removing the original instead returns `no card matches` and writes no variant. The unchanged control writes/selects a valid variant.
- **Changed source notes during enrichment:** the earlier reply can still produce an old-note draft, but the newer note remains pending. No new loss or permanently missed drafting was established; the deleted-highlight case above is narrower and red.
- **Handwritten duplicate skill IDs:** removing the first duplicate leaves the second and Doctor detects the duplicated IDs; no distinct corruption established. The path-like-ID case above is the confirmed failure.
- **Interruption coverage:** 30 mutation paths × 10 trials, plus targeted swap/filing/lock boundaries. Not every command/flag, every asset swap boundary, power loss/fsync behavior, or simultaneous iCloud download/eviction was exercised. The random loop’s checks protect pre-existing source/exercise/review data, complete note states, readable settings/index, and a following write; they do not prove every newly interrupted action finished.
- **Scale retrieval:** one uniquely answerable sentinel query in the large seed, with archive/reimport controls. This establishes source identity and offsets for that case, not semantic recall for every source, adversarial citation generation, or real-model answer quality.
- **Platform coverage:** shared-core implications are identified above; no claim of a native iPhone reproduction, real iCloud conflict resolution, full multi-window app state, or coverage of the separate refactor run’s F618/F631.

## What passed

- **Controls for findings:** all 14 controls in [confirm-results.json](confirm-results.json) passed; the extra aged-empty-lock control passed. Main confirmation runner: `ORE_NO_ENRICH=1 bun codex-out/edges/confirm.ts`.
- **Random interruption survey:** `kill-survey.ts`, final corrected run: **300 trials, 174 SIGKILL terminations, 126 completed commands, zero command-setup errors**. **299** passed all checked invariants; the one failure is the minimized empty-lock finding. No loss of a pre-existing source, exercise, or review was detected. [Log](logs/kill-survey.log), [all rows](kill-survey.json).
- **Deleted, empty, old-schema and foreign indexes:** `index-survey.ts deleted|zero|schema|foreign` all restored the expected source in actual CLI search; explicit reindex repairs both corrupt-index cases.
- **Concurrent index rebuilding:** `index-concurrent.ts`, **12 pairs / 24 real CLI processes** succeeded after deleting the index each pair. [Log](logs/index-concurrent.log).
- **iCloud-style duplicate names:** `conflicts.ts` adds `notes 2.md`, `doc 2.md`, `skills 2.yaml`, an exercise ` 2.md`, a copied review ` 2.jsonl`, and a source ` 2/` folder. Source, exercise, indexed membership, search hits and review count remain **one** before and after rebuilding; primary note remains exact; Doctor identifies the duplicate source ID and exercise filename mismatch. These are duplicate-copy controls, not live iCloud transport. [Log](logs/conflicts.log).
- **30-day lifecycle data:** `lifecycle.ts` imports a local HTML file, highlights, drafts five exercises with fake AI, simulates 30 daily sessions, rereads its kept original, moves skill, archives, restores from Git, and compares every collected view with a fresh index. Notes survive; **one source, five exercises, 15 reviews** remain. The script deliberately ends red on the independently minimized D63 level finding. [Artifact](lifecycle-results.json).
- **Lifecycle receipt/count cross-check:** `lifecycle-counts.ts` independently checks each of **30** end receipts against the review log: **15 reviews, 15 kept, five solid-memory crossings**, Home due **0** equals the due queue, source/exercise totals agree, cached and rebuilt views match. [Log](logs/lifecycle-counts.log).
- **Ask at scale:** seeded **953 sources and 4,447 reviews** with `ORE_SEED_SCALE=4`, then added one unique answer source; **878 active sources** at query time. `scale-retrieval.ts` retrieves that source, fake-AI citations resolve to its exact text, reimport moves the citation start from **22 to 84**, and archive removes the only answer (`found: false`). Observed initial retrieval was approximately **408 ms**, not a benchmark guarantee. [Log](logs/scale-retrieval.log), [seed log](logs/scale-seed.log).
- **Original page after reimport:** `original-setup.ts` and `original-page.cjs`, supplied Mac release UI with a bridge redirected only to an owned scratch library. Replacing the kept PDF and using the app’s Reimport action changes the rendered page hash, makes a new PDF fetch, and matches the hash after leaving/reopening Original. The earlier stale-file lead did **not** reproduce. [Log](logs/original-page.log), [after-reimport image](logs/original-after-reimport.png), [after-reopen image](logs/original-after-reopen.png).
- **Variant lifecycle boundaries:** retired original yields no selected variant; removed original yields no saved variant; unchanged original writes/selects a valid one. `variants-lifecycle.ts retire|remove|keep`, logs under `logs/variants-*.log`.
- **Normal import controls:** valid HTML and a valid Word fixture import through the same installed parsers that return raw errors on malformed inputs. [Log](logs/import-controls.log).

No fixes were attempted. No registry rows, commits or pushes were made, as requested for this findings-only run.
