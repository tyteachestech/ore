# Deep scan 5 — phone reading scout

I read the phone filesystem and SQLite adapters against core’s file, review-log, import and index callers; traced native iCloud and share-extension handoffs; exercised waiting-file removal and list-title Undo, Settings save ordering, sync status, reminder date generation, and persisted reading preferences. I checked the findings register, sweep history and four earlier deep scans before choosing these paths. I avoided the active EPUB-front-matter and highlight-animation work, the excluded open rows, and previously tested retry-ordering, Unicode search, course Undo, stale list reads and batch-filing cases. All evidence is headless: no app, browser, simulator, server, watcher, whole test suite, real AI or live library. Native filesystem and command failures are controlled stand-ins; I distinguish those boundaries below. Only `codex-out/phone/` was written.

## Evidence and reproduction setup

- Checkout: `05c68297d33d46d6b17b404c101543bc9dfd9557`; Bun 1.4.4; reviewed on 2026-11-24 Pacific / 2026-11-25 UTC.
- Seven findings: three S1, three S2, one S3. PHONE-03 reobserves **F175** in the shared list action; its Reader fix still passes.
- Each principal red case ran **3/3 red**. Each paired control ran **3/3 green**. The [verification manifest](logs/verification.json) records 66 sequential runs, each at most 0.276 seconds wall time. Full stdout, assertion stacks and exit codes are in [logs](logs/). A separate storage-contract control also passed once.
- Commands below run from the repository root. Red cases intentionally exit 1. No fixes were made.
- The storage/import/index scripts use [core-entry.ts](core-entry.ts), bundled from unchanged source with the phone’s filesystem/SQLite/Node aliases. To rebuild that local probe bundle:

```sh
ORE_NO_ENRICH=1 bun codex-out/phone/build-core.ts
```

- To reproduce the recorded red/control matrix, one Bun child at a time, with a 20-second timeout per child:

```sh
python3 codex-out/phone/verify.py
```

The bundle only prepares these probes; it does not build or launch the app. Paths such as `/lib` and `/scratch` inside the adapter tests are virtual map keys. Actual scratch files live under `codex-out/phone/libs/`. Component callbacks are extracted from the current source and transpiled without mounting React; source-list Undo uses the real `change` and `sourceActions` functions with an in-memory DOM stand-in.

## Findings

### PHONE-01 — A failed initial read lets the next review erase the phone’s earlier review log

**S1 · iPhone · canonical review history lost.** Violates the append-only, per-device history promise in **D78 / D222**. This is a destructive write after a failed read, distinct from **F593**, whose retry-on-next-scan fix passes the control here.

**Red command** — [script](storage-read-failure.ts), [full output](logs/storage-read-failure-failed-1.txt):

```sh
ORE_NO_ENRICH=1 bun codex-out/phone/storage-read-failure.ts failed
```

```text
[DEEP] {"mode":"failed","reads":1,"reviewsOnDisk":["new-review"],"writeCalls":1}
AssertionError: A failed initial read must not let the next review erase the earlier phone review log
```

**Minimized steps:**

1. Mount a library whose scan lists `reviews/2026-11.iphone.jsonl`, containing an earlier valid review. The file is listed normally, not as an iCloud download placeholder.
2. Return `null` from the initial `library_read` for that file, as the native command does when a read fails.
3. Before another scan, call core’s actual `appendReview` with a second valid review and flush the phone adapter.

**Expected:** block the append until the earlier log can be read, or preserve it when appending. **Actual:** the one native write contains only the new review; the earlier canonical record is gone. The script uses schema-valid review records and the real core writer. It models native whole-file replacement at the bridge, rather than executing iCloud or FSRS replay.

**Ranked hypotheses and probes:**

1. **Failed reads are not write-protected — confirmed.** The scan knows the file exists, but the failed read installs no entry. An append therefore starts from empty text.
2. **The native bridge incorrectly implements an append — ruled out as the initiating error.** The adapter itself sends an already-truncated whole-file payload; the bridge merely applies it.
3. **An older failed flush overwrites a newer save — ruled out.** There is exactly one write and no rejected write/retry.

**Runs:** failed 3/3. `healthy` 3/3 preserves both records. `retry` 3/3 preserves both after a rescan, with two reads instead of one. These controls isolate the window before successful rereading.

**Cause:** `apps/desktop/src/phone/fs.ts:316–319` records `failed` but leaves the file absent; `:136` guards only `downloading`; `:383` appends to `files.get(p)?.text ?? ""`. Core reaches it through `packages/core/src/reviews.ts:121–122` and `fsutil.ts:25–27`. Native `apps/phone/src-tauri/src/lib.rs:110–118` returns `None` for a failed text read, and `:125–132` replaces the destination with the supplied bytes.

### PHONE-02 — Undo of removing a waiting file restores a website URL and loses the file

**S1 · iPhone · Undo cannot restore the deleted learning source.**

**Red command** — [script](waiting-file-undo.ts), [full output](logs/waiting-file-undo-file-1.txt):

```sh
ORE_NO_ENRICH=1 bun codex-out/phone/waiting-file-undo.ts file
```

```text
[DEEP] before {"mode":"file","originalBytesExist":true}
[DEEP] {"originalFile":"01M88GSDMJHPWR6AG9S641KCTV/paper.pdf","afterUndo":[{"url":"https://paper.pdf","file":null}],"originalBytesExist":false}
AssertionError: Undo of removing a waiting shared file must restore its file, not queue its filename as a website
```

The generated queue ID varies; the behavior does not.

**Minimized steps:**

1. Queue a file `paper.pdf` with core’s `queueFile`. Remove the temporary input, as can happen after the share extension finishes. Verify the inbox copy still exists.
2. Execute PhoneApp’s actual `removeWaiting` callback, routing its commands to core.
3. Execute that change’s Undo write and read the resulting inbox.

**Expected:** restore the same file bytes and file-type inbox entry. **Actual:** the file directory has been deleted; Undo queues `paper.pdf` through `--add`, which produces the URL `https://paper.pdf`. There is no file attachment. This can also cause an unintended website fetch later, but the probe performs no network request.

**Ranked hypotheses and probes:**

1. **The Undo branch treats every entry as a URL — confirmed.** It calls `inbox --add l.url` even for a file entry.
2. **Removal deletes the wrong file or ID — ruled out.** The original exists immediately before removal, and core deletes the directory named by the correct descriptor.
3. **The file was never retained when queued — ruled out.** The pre-removal existence assertion passes after deleting the temporary input.

**Runs:** file 3/3 red. `link` 3/3 green restores the exact original HTTPS URL. The probe invokes the actual callback’s write steps, without testing the native shake gesture or the UI history stack.

**Cause:** `apps/desktop/src/phone/PhoneApp.tsx:1144–1159`, especially `:1158`, restores only through `--add`; it retains no file bytes. `packages/core/src/inbox.ts:75–85` removes both the descriptor and its file directory. This is an incomplete Undo at the caller, not a new claim that core’s explicit removal should retain files.

### PHONE-03 — List-title Undo overwrites a newer external title: F175 reobserved outside Reader

**S1 · both Mac and iPhone · newer title overwritten.** This is **F175**’s documented failure observed in shared list rename, not a claim that the Reader fix regressed.

**Red command** — [script](title-undo.ts), [full output](logs/title-undo-list-1.txt):

```sh
ORE_NO_ENRICH=1 bun codex-out/phone/title-undo.ts list
```

```text
[DEEP] {"mode":"list","actual":"Original title","expected":"Mac title","refused":null,"calls":[["edit","01M88GSDQBJ6GTMKT013J9TJJH","--title","Phone title"],["edit","01M88GSDQBJ6GTMKT013J9TJJH","--title","Original title"]]}
AssertionError: F175 recurrence: list Rename Undo must preserve the newer title from another device
```

**Minimized steps:**

1. Rename a source from `Original title` to `Phone title` using the actual shared list action; await its completion.
2. Rename the same source to `Mac title` using core, modeling an external change that has already reached this library.
3. Invoke the Undo registered by the list action, then read the canonical source metadata.

**Expected:** preserve `Mac title` and explain why Undo cannot replace it, as Reader already does. **Actual:** writes `Original title` without reading or comparing the current title.

**Ranked hypotheses and probes:**

1. **The list action lacks Reader’s external-change check — confirmed.** The command trace has two `edit` commands and no `show` before Undo.
2. **Undo executes before the external rename completes — ruled out.** Both core writes are awaited in sequence.
3. **Only the displayed title is stale — ruled out.** `findItem` reads `Original title` from the scratch library after Undo.

**Runs:** list 3/3 red. `reader` 3/3 green runs Reader’s actual callback against the same core adapter: it preserves `Mac title`, issues `show`, and refuses with `Left as “Mac title”: it was renamed since`.

**Cause:** `apps/desktop/src/list-actions.ts:121–124` writes a `valueChange` title without checking the live value before Undo. The protection exists in `apps/desktop/src/Reader.tsx:3121–3125`. PhoneApp uses the shared list actions, so the same gap applies there. This does not challenge the separate D222 policy for genuinely simultaneous edits: the external write is completed before Undo begins.

### PHONE-04 — Shared Markdown and VTT files are read as empty during phone import

**S2 · iPhone · valid learning content cannot import.** Breaks the supported whole-content import promise in **D122**. The files remain queued; this probe does not show permanent loss.

**Red command** — [script](shared-text.ts), [full output](logs/shared-text-md-1.txt):

```sh
ORE_NO_ENRICH=1 bun codex-out/phone/shared-text.ts md
```

```text
[DEEP] {"mode":"md","originalLength":57,"rawType":"string","added":0,"failed":["Found no text to read in that. Copy the text and paste it here instead."]}
AssertionError: A shared text file must import the text the phone already loaded
```

**Minimized steps:**

1. Mount the native scan shape for an owned queued `note.md`, containing a heading and a sentence, plus its `.file.json` descriptor.
2. Call the adapter’s `load` on the queued file, matching `loadShared` before import.
3. Run real core `importQueued` → `addSource`.

**Expected:** add the nonempty Markdown source. **Actual:** zero additions and an empty-content error. A valid 75-character `.vtt` fails identically.

**Ranked hypotheses and probes:**

1. **The filesystem shim returns a string where core expects bytes — confirmed.** Native-listed text returns `typeof === "string"`; `new Uint8Array(string)` becomes empty for this content.
2. **The content parser rejects the sample — ruled out.** The identical Markdown content stored as bytes imports successfully.
3. **Device ownership or inbox selection skips the entry — ruled out.** The owned entry is attempted and appears in `failed`; a `.txt` going through the binary load route imports successfully.

**Runs:** `md` and `vtt` each 3/3 red; `bytes` and `txt` each 3/3 green. Fetch and process-spawn functions throw if reached, so these imports cannot access the network or run AI.

**Cause:** native `apps/phone/src-tauri/src/lib.rs:11–13` lists `.md` and `.vtt` as text; `phone/fs.ts:287–290` considers that text already loaded; `:374–380` returns a string for an unencoded read of a text-backed entry. `packages/core/src/ingest/index.ts:533` constructs a `Uint8Array` from that return value. `apps/desktop/src/phone/core.ts:224–231` invokes the insufficient `load` step. Immediate byte-backed picks pass; the finding is specifically the folder-loaded share/reload path.

### PHONE-05 — An older failed goal save hides the newer goal that saved

**S2 · iPhone · Settings displays a false persisted goal.** Related failure class to F636, but reproduced in the phone Settings callback, not the previously fixed highlight or importance actions.

**Red command** — [script](settings-failed-save.ts), [full output](logs/settings-failed-save-overlap-1.txt):

```sh
ORE_NO_ENRICH=1 bun codex-out/phone/settings-failed-save.ts overlap
```

```text
[DEEP] {"mode":"overlap","disk":30,"shown":10,"calls":2,"errors":["write refused"]}
AssertionError: A failed older settings save must not hide the newer goal that saved
```

**Minimized steps:**

1. Begin at a 10-minute daily goal. Use the actual Settings setter to choose 20; hold that command before rejecting it.
2. While it is pending, choose 30. This updates the displayed state and queues a second command.
3. Reject the older command, let the second command write through core’s `setReviewSettings`, and settle the callbacks.

**Expected:** display the saved 30-minute goal, alongside any error about the failed earlier action. **Actual:** core reads 30 from disk, while Settings state is reset to 10.

**Ranked hypotheses and probes:**

1. **The older failure rolls back a newer optimistic display — confirmed.** Its captured `was` is 10; its rollback runs after the second action has shown 30.
2. **The second save also failed — ruled out.** Actual core settings reread as 30.
3. **Command ordering reverses the two writes — ruled out.** The real `change` queue is used; the first is explicitly held/rejected before the second core write. The sequential control displays 30 correctly.

**Runs:** overlap 3/3 red; `serial` 3/3 green. The failure is injected at the `ore` command boundary. This establishes the caller’s error-handling bug; it does not claim that a later native iCloud flush failure necessarily rejects this command.

**Cause:** `apps/desktop/src/phone/Settings.tsx:79–88` uses a plain `change` with a captured previous value. It does not use the ownership protection available through `valueChange`. In `apps/desktop/src/change.ts:110–115`, the failed earlier action still calls its `show(false)` because it has no tracked field; successful settlement of the newer plain action does not restore its display.

### PHONE-06 — Settings says “Up to date” while a write has not reached the folder

**S2 · iPhone · false sync state.**

**Red command** — [script](sync-inflight.ts), [full output](logs/sync-inflight-inflight-1.txt):

```sh
ORE_NO_ENRICH=1 bun codex-out/phone/sync-inflight.ts inflight
```

```text
[DEEP] {"mode":"inflight","state":{"icloud":true,"at":1795521600000,"unsent":0,"downloading":0,"error":null},"status":"Up to date, checked just now.","disk":"Old note","saveStillHeld":true}
AssertionError: Settings must not say Up to date while its new note has not reached the folder
```

**Minimized steps:**

1. Mount a healthy folder and write `New note` over `Old note` in memory.
2. Start `flush`, but hold `library_apply` before the modeled native disk write completes.
3. Read `syncState` and evaluate the exact status expression from Settings.

**Expected:** report a save in progress until the folder accepts it. **Actual:** `unsent` is zero and Settings reports “Up to date”; the disk still contains `Old note`.

**Ranked hypotheses and probes:**

1. **In-flight operations vanish from the exposed pending count — confirmed.** `flush` empties the map before its asynchronous native call finishes.
2. **The native call acknowledged the save too early — ruled out.** The injected promise remains unresolved and the disk value is unchanged when status is captured.
3. **A stale React render causes the text — ruled out.** Fresh `syncState` itself produces the false status through the current Settings expression.

**Runs:** inflight 3/3 red; `complete` 3/3 green has identical “Up to date” text only after disk contains `New note`. Each script releases and awaits the held write before exiting. No process is left waiting.

**Cause:** `apps/desktop/src/phone/fs.ts:205–211` clears `unsent` before delivery; `:186` reports only `unsent.size`, omitting operations in the `sending` promise. `apps/desktop/src/phone/Settings.tsx:166–174` interprets that as fully up to date. The probe proves local-folder delivery is still outstanding; it makes no claim about remote iCloud server acknowledgment.

### PHONE-07 — Same-length writes in one millisecond leave the phone’s search index stale

**S3 · iPhone · rapid-write edge leaves old note text in search.** The canonical note is intact; the disposable index fails to follow it (**D5**).

**Red command** — [script](stat-collision.ts), [full output](logs/stat-collision-same-1.txt):

```sh
ORE_NO_ENRICH=1 bun codex-out/phone/stat-collision.ts same
```

```text
[DEEP] {"mode":"same","mtime":1795521600000,"report":{"changed":0,"removed":0,"errors":[]},"canonical":"bravo","oldHits":1,"newHits":0}
AssertionError: A changed phone note should be reindexed even when both writes share one millisecond
```

**Minimized steps:**

1. Pin the clock to one millisecond. Store a skill note containing `alpha` through the phone filesystem and index it using real core plus the phone SQLite adapter.
2. Replace it with `bravo`, keeping both timestamp and length unchanged.
3. Run `syncIndex` again and search both words.

**Expected:** `bravo` matches and `alpha` no longer does. **Actual:** core reports zero changed files; only `alpha` matches, while the canonical read returns `bravo`.

**Ranked hypotheses and probes:**

1. **Timestamp and size equality hides the changed content — confirmed.** Advancing the clock by one millisecond or changing length independently makes reindexing work.
2. **SQLite loses the update or serves an old connection — ruled out.** The controls use the same adapter and close/reopen index handles; both update correctly.
3. **Tokenization drops `bravo` — ruled out.** Both controls find it, and the trace shows the failing sync never selects the file as changed.

**Runs:** pinned `same` 3/3 red; `later` and `longer` each 3/3 green. An additional unpinned `natural-burst` run alternates 80 equal-length writes with index sync after each: three runs miss **32, 33 and 34** expected results, respectively. That is an in-process burst, not a claim that human typing routinely produces sub-millisecond edits. The pinned case is the deterministic red loop.

```sh
ORE_NO_ENRICH=1 bun codex-out/phone/stat-collision.ts natural-burst
```

**Cause:** `apps/desktop/src/phone/fs.ts:135–138` assigns `Date.now()` as mtime, with millisecond resolution; `:434–438` exposes it with the unchanged text length. `packages/core/src/db.ts:409–412` treats matching mtime and size as unchanged, without a content/version discriminator. Persistence stamps or a later edit can eventually force another sync; the demonstrated failure is before that happens.

## Leads — not findings

- **Multiple attachments in one share:** `ShareViewController.swift:191`, `:272`, `:285` chooses one link or one file provider although the activation predicate accepts multi-item shares. No headless red loop against actual `NSItemProvider` behavior, so no confirmed lost-items claim.
- **Plain shared text with no URL:** the Swift flow searches for a URL, then a file representation; whether a text-only provider can supply that file remains unproven without its native provider callback.
- **Timezone change after reminders are scheduled:** generation across DST passes; native handling of already-scheduled timestamps after a timezone change remains untested. D228’s documented future scheduling limitations are not re-reported as bugs.
- **NFD/NFC and case-only native filenames:** the memory map uses literal paths; native normalization/case behavior and its cross-boundary consequences were not reproduced. A case-only rename inside the map passes, which does not establish native correctness.
- **Partial native writes / share-group transfer failures:** Rust fallback writes and ignored transfer failures deserve fault injection, but no permitted native red loop was built. No data-loss finding is asserted from reading those branches alone.

## What passed / coverage limits

- Healthy initial review-log read preserves both records; a failed initial read followed by a successful rescan also preserves both, 3/3 each (F593 retry behavior intact).
- Waiting-link removal/Undo restores the original HTTPS URL, 3/3; only the file variant fails.
- Reader-title Undo preserves an externally changed title and explains the refusal, 3/3 (F175 Reader guard intact).
- Identical Markdown supplied as bytes imports successfully; shared `.txt` loaded as bytes also imports, 3/3 each.
- Goal edits made sequentially after an earlier failure finish with displayed and persisted values equal, 3/3.
- Sync status becomes truthful once the native write resolves and the modeled folder contains the new note, 3/3.
- Index refresh works when either mtime advances by 1 ms or the content length changes, 3/3 each.
- `reminder-controls.ts`, with `TZ=America/Los_Angeles`, preserves 09:30 across spring/fall DST with 23/25-hour gaps, and skips today when nothing is due, the goal is met, or today does not count; reminders off yields no dates, 3/3.
- `appearance-controls.ts` reads seeded width, size, page, font and spacing; saves changes; preserves stored `auto` while following system light/dark. Seeded and default starts each pass 3/3. Native appearance polling, actual Dynamic Type layout, and cross-device transfer of local preferences were not certified.
- `ORE_NO_ENRICH=1 bun codex-out/phone/storage-controls.ts` passes recursive mkdir, missing read/readdir `ENOENT`, rename over an existing text file, binary round-trip and case-only rename **within the memory adapter**, once.
- Read the phone’s external-skill/course disappearance guards and native Undo registration; no new proven defect there. Background/restore gesture delivery, live source disappearance while reading, and native reminder firing were not tested in a device/window.
- Source files and the findings register remain unchanged. No fixes, commits or pushes were made under this findings-only assignment.
