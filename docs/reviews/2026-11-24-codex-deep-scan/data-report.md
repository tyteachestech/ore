# Ore deep scan — data

Scanned commit `321631d54c340723e63e5ee8cd996698db2e4b5b` with Bun 1.4.4 on macOS, 2026-11-24 UTC. Covered core/CLI review replay (1,000 seeded ratings), backward clocks, local midnight/DST, queue properties, concurrent CLI writers, offline device-log merges, undo and duplicate logs, truncated log tails, disposable-index rebuilds, outside file edits and Finder renames, note merging, frontmatter round-trips, Git restoration of a note and a source, and stubbed AI attribution. Also exercised actual core note saves bundled against the actual iPhone filesystem module, with a local stand-in for the native file commands. Skipped UX, browsers, live iCloud transport, the native iOS simulator, real AI, exhaustive AI-path coverage, and OS process termination during an actual multi-file snapshot. All artifacts and scratch libraries are under `codex-out/data/`; no tracked repository file was changed. **Eight findings** follow; each listed red command failed in **3/3 fresh-library confirmation runs**. Known open rows were not re-reported.

Run commands below from `/Users/tylerpoelking/Developer/ore-wt/deep-scan`. Each failing assertion exits **1**; the quoted output is the relevant `[DEEP]` line and error, with stack traces omitted. `repeat-results.json` and `logs/repeat-*.txt` preserve the full confirmation evidence. The phone probes use `built/phone-core-entry.js`, generated from unchanged repo modules by `bun codex-out/data/build-phone-probe.ts`. The native `library_apply` stand-in writes real files only in the probe's scratch library and implements the replacement behavior at `apps/phone/src-tauri/src/lib.rs:170–180`; these are not claims of a live iCloud or simulator reproduction.

## Findings

### DATA-01 — An older failed phone save overwrites a newer successful save

**S1 — data loss. iPhone.**

**Red command:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep-scan/codex-out/data/phone-retry-order.ts queued-newer
```

```text
[DEEP] {"mode":"queued-newer","sent":["First draft.","Second complete draft.","First draft."],"afterSecond":"Second complete draft.","afterRetry":"First draft.","inMemory":"Second complete draft."}
error: Retry of an older failed save overwrote a newer successful note
```

**Minimized steps:**

1. Mount a source note containing `Base.` in the phone's file layer.
2. Save `First draft.` through core `setNotes`; hold its native write pending.
3. Save `Second complete draft.` through core and call `flush` while the first write is pending.
4. Reject the first native write. Let the second write succeed.
5. Flush the retained retry.

**Expected:** the latest successful draft remains on disk. **Actual:** the old failed draft is sent a third time and replaces it. Memory still contains the newer words, so the saved file and what the learner sees disagree. This is not D222's accepted latest-write-wins between devices: the queued retry resurrects an older operation after a newer successful operation on the same phone.

**Reproduction:** 3/3 confirmation runs. No wall-clock sleep, network, second device, or rescan is needed; promises place the failure at the exact boundary.

**Ranked hypotheses and probes:**

1. **The failed batch is requeued after the newer batch has left `unsent`.** Prediction: leaving the second edit in `unsent` until the first fails prevents the overwrite. Confirmed: `phone-retry-order.ts newer-unsent` sends only first, second, and keeps the second.
2. **The new batch's contents mutate into the old text.** Prediction: the second native call already contains the old draft. Ruled out: captured calls contain first, second, first; the second write lands correctly before a distinct third call replaces it.
3. **A rescan reads an obsolete disk copy into memory.** Prediction: removing rescans prevents the problem. Ruled out: the minimal loop uses only `flush`; memory remains newer than disk.

**Cause:** `apps/desktop/src/phone/fs.ts:197–202` captures a batch and clears `unsent` before its turn in `sending`; `:230–232` retries an old batch whenever `unsent` lacks the path. It does not account for a newer batch already waiting in `sending`, and the newer successful batch does not remove that obsolete retry.

### DATA-02 — Same-timestamp ratings acknowledge a schedule that is not saved

**S1 — wrong scheduling; an accepted answer can disappear from active history. Both, shared core.**

**Red command:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep-scan/codex-out/data/schedule.ts collision
```

```text
[DEEP] {"mode":"collision","acknowledged":2,"active":1,"ratings":[1],"returned":{"due":"2026-06-03T12:00:00.000Z","stability":0.24668919,"difficulty":6.40211507,"elapsed_days":0,"scheduled_days":2,"reps":2,"lapses":0,"learning_steps":0,"state":2,"last_review":"2026-06-01T12:00:00.000Z"},"index":{"due":"2026-06-02T12:00:00.000Z","stability":0.212,"difficulty":6.4133,"elapsed_days":0,"scheduled_days":1,"reps":1,"lapses":0,"learning_steps":0,"state":2,"last_review":"2026-06-01T12:00:00.000Z"}}
error: Acknowledged review vanished from replay
```

**Minimized steps:** rate one exercise Again on device A, then Good on device B, both at `2026-06-01T12:00:00.000Z`; read the active logs and indexed state.

**Expected:** a successful rating's returned schedule agrees with the authoritative log replay. The documented `(card, ts)` identity can instead require a collision to be refused or treated consistently as the same event. **Actual:** the second call reports success and two repetitions, while replay retains one rating and a different due date. The bytes of both reviews remain in their files; the loss is in active history and scheduling. This requires equal **milliseconds**, not merely the same minute; the loop deliberately pins that rare collision.

**Reproduction:** 3/3 for the collision; 3/3 for `schedule.ts undo-same-time`. The latter rates, undoes, then rates again at the same timestamp: the new rating reports success but **zero** reviews remain active and the index state is `null`.

**Ranked hypotheses and probes:**

1. **Timestamp-only identity collapses distinct accepted writes.** Prediction: move only the second timestamp by 1 ms. Confirmed: `collision-probes.ts` retains both ratings and returned/indexed repetitions agree at two.
2. **Device-file order selects the survivor.** Prediction: swap device names with timestamps/ratings unchanged. Confirmed: the retained rating changes from Again to Good. This explains which event survives, not the existence of the collision.
3. **The index is stale.** Prediction: rebuilding repairs the mismatch. Ruled out: deletion and rebuild leave the one-review schedule unchanged; `readReviews` already contains one review.

Identical conflicted copies still correctly count once in the control. F282's backward-clock case also passed the separate replay fuzz; this is a timestamp collision, not a re-report of F282.

**Cause:** `packages/core/src/study.ts:66–96` computes a new state and returns it without a unique event identity or collision check. `packages/core/src/reviews.ts:86–94` identifies reviews and undo targets only by card and timestamp, independent of device or contents.

### DATA-03 — A Finder folder rename silently changes an exercise's due date

**S1 — wrong scheduling, plus source/search inconsistency. Mac; shared core also applies to a renamed folder received by the phone.**

**Red command:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep-scan/codex-out/data/renamed-folder.ts
```

```text
[DEEP] {"before":{"items":1,"hits":1,"retention":0.8,"due":"2026-06-09T12:00:00.000Z"},"cached":{"items":0,"hits":0,"retention":0.92,"due":"2026-06-03T12:00:00.000Z"},"rebuilt":{"items":0,"hits":0,"retention":0.92,"due":"2026-06-03T12:00:00.000Z"},"listed":1,"findItemWorks":true}
error: Finder rename loses source and changes the exercise schedule
```

**Minimized steps:**

1. Give a Learning exercise's source P3 importance, overriding Learning's P1.
2. Rate it Good on June 1. Its due date is June 9.
3. Rename the source's folder to `My renamed source`, removing the ID suffix without changing any file contents.
4. Open/rebuild the index.

**Expected:** the files still identify the same source and its explicit importance; a folder rename does not change review timing. **Actual:** `listItems` and `findItem` still find the source, but the index omits it and its notes. The exercise falls back to its skill's retention and is due six days earlier. D5's files-canonical/index-disposable contract and D345.3's explicit source-importance override are affected.

**Reproduction:** 3/3 confirmation runs.

**Ranked hypotheses and probes:**

1. **The index filters by folder name instead of resolving the file's identity.** Prediction: retain the ID suffix in the new folder name. Confirmed: `renamed-folder.ts keep-id` keeps one source, one hit, retention 0.8, and June 9 due.
2. **The rename damaged the ID or exercise reference.** Prediction: core lookup/listing also fail. Ruled out: both work, with unchanged IDs and source metadata.
3. **An old SQLite path is retained.** Prediction: a rebuild recovers. Ruled out: a fresh index omits the same valid source and reproduces the changed date.

**Cause:** `packages/core/src/db.ts:39–43` ignores folders not matching `ID_END`. `packages/core/src/items.ts:240–259` can still resolve a renamed folder from its frontmatter. `db.ts:338–343` then joins the exercise to no source row and computes retention without the source override. This is not F176's duplicate-folder ambiguity: only one source folder exists.

### DATA-04 — Mixed line endings alter saved recall text

**S1 under the requested data-corruption rubric, narrowly scoped to text formatting. Both, shared writer.**

**Red command:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep-scan/codex-out/data/recall-roundtrip.ts
```

```text
[DEEP] {"input":"Retrieval practice strengthens long-term memory.\n \nSpacing helps.\rOne more idea.","acknowledged":"Retrieval practice strengthens long-term memory.\n \nSpacing helps.\rOne more idea.","saved":"Retrieval practice strengthens long-term memory.\n\\\nSpacing helps.\rOne more idea.","note":"## Recall\n\nRetrieval practice strengthens long-term memory.\n \nSpacing helps.\rOne more idea."}
error: Saved recall text differs from accepted learner text
```

**Minimized steps:** call `setRecall` with the quoted text, containing a space-only LF line and a carriage return elsewhere; reopen the source. A CRLF elsewhere instead of the lone carriage return also reproduces.

**Expected:** the accepted recall is read back as entered. **Actual:** the space-only line becomes a literal backslash line in `doc.md`'s recall field. The return value and plain `notes.md` keep the original. The words are not erased; this finding is the specific altered line and divergent copies, not wholesale loss of a recall.

**Reproduction:** 3/3 confirmation runs. Found by seeded frontmatter fuzz, minimized in `minimise-frontmatter.ts`, then reproduced through a real learner-write API. The complete 2,000-value survey found four changed values of this shape; 1,996 passed.

**Ranked hypotheses and probes:**

1. **Bun's YAML reader misreads a valid scalar.** Prediction: the JavaScript YAML reader preserves it. Ruled out: both readers return the same altered value.
2. **The YAML writer emits the wrong multiline quoted scalar.** Prediction: changing only its scalar rendering preserves the input. Confirmed: a probe with `doubleQuotedMinMultiLineLength: Infinity` round-trips; the repository's existing options do not. Removing the carriage return or the space-only line also passes.
3. **Ore's CRLF normalization alters the value.** Prediction: bypassing `parseFrontmatter` avoids it. Ruled out: direct `yaml.stringify` followed by `yaml.parse` reproduces, without Ore's normalization.

**Cause:** `packages/core/src/frontmatter.ts:34–37` delegates to installed `yaml@2.9.1`. Its multiline double-quote whitespace handling is in `node_modules/.bun/yaml@2.9.1/node_modules/yaml/dist/stringify/stringifyString.js` (the newline/trailing-space paths around lines 32–46 and 90–110). `packages/core/src/notes.ts:192–200` accepts this recall and writes it both as frontmatter and as a plain note, exposing the divergence. No dependency or repo file was changed.

### DATA-05 — Offline log merging can erase an earned level and memories to win back

**S2 — false learner state. Both, shared core.**

**Red command:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep-scan/codex-out/data/offline-level.ts
```

```text
[DEEP] {"before":{"level":1,"peak":5,"solid":5},"after":{"level":0,"peak":0,"solid":0,"win_back":0},"replayedProbe":{"level":1,"peak":5,"win_back":5}}
error: Earned level fell after ordinary misses following offline log merge (D63)
```

**Minimized steps:**

1. Copy a library containing five unseen exercises to an offline second device.
2. On the Mac, rate each Good on June 1; on the offline device, rate each Good on June 12, without the Mac's logs.
3. Merge the two device logs. Replay makes all five solid and the skill reaches level 1.
4. Rate all five Again on June 13.

Five exercises are needed to demonstrate the actual level drop; `offline-reviews.ts` reduces the underlying history disagreement to **one exercise and two reviews**: current stability `26.13257878`, solid count 1, but growth and `gemPast` report zero/not-solid.

**Expected:** D63's earned level stays 1 and the five previously solid memories count as needing to be won back. **Actual:** level and peak fall to zero; `win_back` is zero. The underlying FSRS replay itself is correct.

**Reproduction:** 3/3 confirmation runs.

**Ranked hypotheses and probes:**

1. **Historical metrics trust device-local `state_after` rather than merged replay.** Prediction: reconstruct those historical states from the unchanged ratings/timestamps, only in the probe. Confirmed: the same `strength` function then returns level 1, peak 5 and win_back 5.
2. **The index dropped exercises or assigned them to a different skill.** Prediction: current card counts/solid states disagree even before the misses. Ruled out: all five remain present under Learning; the initial merged solid count is five.
3. **The merged logs lose or collide on timestamps.** Prediction: fixing identity or missing records repairs the history. Ruled out: both devices' reviews are present, on distinct dates, and only substituting replayed historical states changes the verdict.

**Cause:** `packages/core/src/today.ts:84–99` builds historical peak/fall information from saved `r.state_after`, while current solidity uses replayed `c.fsrs`. Its `Math.max(peak, solid.length)` temporarily hides the missing historical peak until the next misses. `today.ts:245–256` and `:36–47` use the same unreconciled historical states for growth and gem history. Related F242 covered retirement lowering a level; this reproduction retires or deletes nothing.

### DATA-06 — One offline-reviewed draft consumes two new-exercise slots

**S2 — false daily count and incorrectly withheld new exercise. Both, shared core.**

**Red command:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep-scan/codex-out/data/offline-cap.ts
```

```text
[DEEP] {"uniqueNewExercises":1,"new_today":2,"newLimit":2,"remainingDraftOffered":false,"caught_up":true}
error: Offline double finish consumes two new-exercise slots for one exercise
```

**Minimized steps:** set `new_per_day` to 2; put two eligible drafts in a shared starting library; before either device receives the other's logs, review the **same** draft on each device at 12:00 and 12:01 on June 12; merge the logs and request Today/due.

**Expected:** one distinct exercise has been introduced today, leaving one new slot for the other draft. **Actual:** Today says two new exercises, the remaining draft is omitted, and the library reports caught up. D65's cap is consumed by the duplicate first-encounter flags, not two different exercises. This is unrelated to F12's per-skill row counts.

**Reproduction:** 3/3 confirmation runs.

**Ranked hypotheses and probes:**

1. **Each offline device records `finishing`, and readers count both flags.** Prediction: clear only the second flag in the scratch incoming log. Confirmed: `offline-cap.ts flag-control` reports one new exercise, offers the remaining draft, and no longer reports caught up.
2. **The second draft is too young or otherwise ineligible.** Prediction: changing only the first-encounter flag would not expose it. Ruled out by that control; both drafts were created January 1.
3. **Duplicate timestamp identity or FSRS changed which events count.** Prediction: two distinct review times eliminate the fault. Ruled out: the times are already a minute apart and both reviews remain in the log.

**Cause:** `packages/core/src/study.ts:71` derives `finishing` from each device's local prior log; `:167` subtracts the number of flagged reviews. `packages/core/src/today.ts:212` likewise reports flagged review count as `new_today`, without reconciling the earliest encounter per exercise.

### DATA-07 — Search labels stay stale after source and skill renames

**S2 — false search state; disposable rebuild changes results. Both, shared core.**

**Red commands:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep-scan/codex-out/data/index-dependencies.ts skill-rename
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep-scan/codex-out/data/index-dependencies.ts source-rename
```

The skill case outputs:

```text
[DEEP] {"mode":"skill-rename","cached":[{"kind":"skill-notes","ref":"learning","item":null,"title":"Notes: Learning","snippet":"[uniqueneedle]"}],"rebuilt":[{"kind":"skill-notes","ref":"learning","item":null,"title":"Notes: Renamed Skill","snippet":"[uniqueneedle]"}]}
error: Rebuilding disposable index changes search results
```

The source case changes `My notes: Data probe` to `My notes: Renamed Source` only after rebuilding, with the same source ID and note text.

**Minimized steps:** write a note containing `uniqueneedle`; search once to populate the index; rename its source or skill through core; search again, rebuild, then repeat the same search.

**Expected:** the first post-rename search uses the saved current name and matches a rebuild. **Actual:** the label remains old until the note itself changes or the index is rebuilt. Violates the index-disposable contract (D5).

**Reproduction:** 3/3 confirmation runs **for each rename kind**.

**Ranked hypotheses and probes:**

1. **Dependent search rows are not invalidated when only owner metadata changes.** Prediction: touch/write the note itself after the rename. Confirmed: `index-probes.ts` changes the result to `Notes: Changed Skill` at once.
2. **The rename was never saved.** Prediction: a rebuild also shows the old name. Ruled out: a rebuild alone reads the new name.
3. **A frontend keeps the old label.** Prediction: direct fresh core index queries are correct. Ruled out: the failing commands use core search directly and reopen the index on every read.

**Cause:** `packages/core/src/db.ts:280–291` embeds source/skill names in annotation/note search rows; `:358–395` indexes only files whose own timestamp/size changed. A changed `doc.md` or `skills.yaml` does not refresh unchanged dependent notes. F312 was the open page's **Linked from** label; this is the independent stored search result, with no UI mounted.

### DATA-08 — Deleted skill notes remain searchable but cannot be opened

**S2 — dead search results. Both, shared core.**

**Red command:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep-scan/codex-out/data/index-dependencies.ts skill-delete
```

```text
[DEEP] {"mode":"skill-delete","cached":[{"kind":"skill-notes","ref":"learning","item":null,"title":"Notes: Learning","snippet":"[uniqueneedle]"}],"rebuilt":[{"kind":"skill-notes","ref":"learning","item":null,"title":"Notes: learning","snippet":"[uniqueneedle]"}]}
error: Search returns a deleted skill note
```

**Minimized steps:** save a Learning skill note; index/search it; remove Learning through core; search the note's unique text, then rebuild and search again.

**Expected:** keeping the removed skill's note on disk for recovery does not offer a normal search destination that core refuses to open. **Actual:** search still returns the removed skill. Rebuilding changes its title to the raw ID but retains the dead result. `getNotes(lib, {skill: 'learning'})` refuses it with `unknown skill "learning"`.

**Reproduction:** 3/3 confirmation runs.

**Ranked hypotheses and probes:**

1. **The index includes every retained skill-note directory even if the skill no longer exists.** Prediction: a full rebuild still returns it, with a fallback name. Confirmed.
2. **The deletion silently failed.** Prediction: Learning remains in `loadSkills` and its note can still be opened. Ruled out by the successful removal and the note lookup's unknown-skill check.
3. **This is only the stale-title invalidation in DATA-07.** Prediction: rebuilding removes the dead result. Ruled out: rebuilding updates the label but does not remove it.

**Cause:** `packages/core/src/db.ts:50` scans notes for every on-disk skill directory, `:288–291` uses the removed ID as a fallback title, and search has no active-skill filter for `item: null` skill-note hits. `packages/core/src/notes.ts:100` correctly rejects that deleted skill. Related F313 was fixed for **Linked from**; this is a newly reproduced search-index route, not a claim that its backlink guard regressed.

## Leads — not findings

- **Snapshot consistency during multi-file writes:** `history.ts` stages the tree without the library lock. Ordinary note/source restoration passed, but no deterministic actual half-write/snapshot loop was completed; no claim of corrupt history.
- **Live lock expiration:** `lock.ts` treats an old lock as stale even when its PID is alive. No production write lasting through that threshold, or data loss caused by takeover, was reproduced.
- **Conflicted `notes 2.md` and skill configuration copies:** no live iCloud conflict-generation/recovery journey was run. D222 explicitly accepts latest-write-wins for simultaneous note edits; do not turn the observed stale-note overwrite into a new bug without changing that decision.
- **Remaining AI outputs:** tutor, Dig, remix generation/checking, research, and all cancellation/race paths were not exhaustively exercised for stamps. The tested enrichment/recall paths passed; no unstamped output was demonstrated here.

## What passed / what not to repeat

- `schedule.ts fuzz`: 1,000 seeded ratings, arbitrary day/month gaps and clock rollback; every returned state and indexed state equals replay of the active review logs. Periodic `.index` deletion preserves the queue.
- `calendar-pass.ts`, run under `TZ=America/Los_Angeles` and `TZ=America/New_York`: pinned spring/fall DST dates and local midnight count active review time on the correct local day.
- `queue-merge-pass.ts`: 1,000 seeded 30-entry queues retain all entries exactly once, order identically after input reversal, and put relearn entries last.
- `queue-merge-pass.ts`: 1,000 independent conflicting note edits preserve both sides through the merge function.
- `concurrent.ts`: 12 pairs of actually concurrent CLI review processes, different `ORE_DEVICE` values, retain all 24 ratings in two logs; concurrent note saves with a shared base preserve both additions; simultaneous skill-name/goal edits preserve both fields.
- `durability-pass.ts`: intact reviews survive a truncated JSONL tail; a subsequent append remains readable; identical conflicted log copies count once.
- `durability-pass.ts`: deleting and restoring an exercise file removes/restores index membership and reconnects its existing review history; a variant uses the original exercise's schedule; editing exercise text retains its schedule.
- `durability-pass.ts`: archived-only skill exercises leave the normal queue and remain explicitly reviewable by skill; retired exercises leave the queue.
- `durability-pass.ts`: a Finder slug rename that **keeps the ID suffix** preserves lookup/index membership. Removing the suffix is DATA-03.
- `durability-pass.ts`: Today is byte-for-byte identical before/after index removal at a pinned time; Git snapshots and single-file restores of a note and source metadata are reflected by core and the index.
- `roundtrip.ts`: 24 targeted frontmatter values (YAML keywords, dates, colons, quotes, separators, emoji, RTL, long strings, CRLF, BOM and NUL) preserve values and second-write bytes. `frontmatter-survey.ts`: 1,996/2,000 seeded combinations pass; four expose DATA-04, so the fuzz suite as a whole is **red**, not green.
- `ai-stamps.ts`: three vendor/model cycles (Claude A → Codex B → Claude C), with checked local fake executables, preserve vendor/model/prompt version in source enrichment, drafted exercise, topic summary and recall feedback. No real model program was run.
- `phone-core-stale.ts pull-first`: actual core note saves over the phone filesystem merge both edits when the newer disk contents are pulled first. Its `stale` mode intentionally demonstrates D222's accepted latest-write-wins; **excluded from findings**.
- `phone-retry-order.ts newer-unsent`: a newer edit still in `unsent` protects against retrying the old failed write. DATA-01 requires that newer edit to have already moved to a queued batch.

## Artifact notes

`repeat-findings.ts` runs each retained red command three times and records exit codes, first diagnostic lines and assertion messages in `repeat-results.json`. Every run creates only its own fresh scratch library under `libs/`. The raw scripts, the phone bundle/build script, local fake AI binaries and diagnostic/control logs are kept beside this report. No app was installed, no server/browser/watcher was started or stopped, no fix or repository finding row was written, and no commit/push was made for this findings-only assignment.
