# Media deep scan — findings only

Covered the two assigned open rows, PDF import/reimport and stubbed background rereading, preservation across failed/cancelled/archived rereads, diagram serialization, audio transcript parsing and timestamp alignment, Apple Podcasts feed fallback, and the iPhone's real browser core, IndexedDB filesystem, search adapter and native-rescan logic. Read the existing findings, sweeps and both first-scan reports; F577 below is explicitly a reconfirmation, not a new row. Skipped UX, real AI, real PaddleOCR/model downloads, live iCloud/native-device testing, full visual PDF page mapping (blank/added/removed pages and two columns), live diagram editing during external changes, simultaneous diagram writers, changed feed URLs and cross-feed episode identity. These gaps are not passes. All new files and scratch libraries are under `codex-out/media/`; the supplied libraries were read/copied, not modified. No application code or findings registry was changed.

**Result: six new findings, one confirmed existing finding (F577), and F575 unresolved.** All seven red loops failed on their intended assertion in **3/3 fresh runs**. The full outputs and timings are in [repeat-results.json](repeat-results.json) and `logs/repeat-<name>-<run>.log`. Each command below exits 1 deliberately. Run commands from `/Users/tylerpoelking/Developer/ore-wt/deep2`. Scripts create/reset only their own named scratch libraries. No wall-clock-sensitive assertion or real network service is needed; the phone-search loop additionally needs the supplied WebKit endpoint and phone server.

Snapshot: commit `1e55835e3db441eacc24a36ee4ff5d7bea6b08a2`, Bun 1.4.4, macOS arm64. Scan date: November 23, 2026 Pacific (November 24 UTC). Findings follow diagnosing-bugs phases 1–4; no fix phase.

## Findings

### MEDIA-01 — Changed PDF reuses old layout and corrupts its new text — S1

**Platform:** Mac import; corrupted canonical source is subsequently read on both devices.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep2/codex-out/media/pdf-changed.ts
```

Observed output (assertion stack omitted):

```text
[DEEP] {"newOriginalSaved":true,"cleanNewHasOldTable":false,"actualHasOldTable":true,"cleanNewHasProse":true,"actualHasProse":false}
AssertionError: Changed PDF must not retain old table measurements absent from its new bytes
```

**Repeatability:** 3/3 failures on this assertion; measured process times 681 ms, 262 ms, 259 ms.

**Minimized steps**

1. Import a PDF URL serving the repository's written-for-Ore `tables.pdf` fixture.
2. Run `readTables` using a stub that returns the fixture's `tables.paddle.json`. This creates saved layout regions.
3. Change the same URL's response to `paper.pdf`, then call ordinary `reimportSource`.

**Expected:** the new PDF's text, with no table from the previous file. **Actual:** the new original bytes are correctly saved, but `doc.md` includes the previous `Spaced | 412` table and formula. New prose, including “Space reviews out over days rather than cramming them into one sitting.”, disappears. This is saved content corruption, violating D93 and D122; D346's saved layout no longer describes these bytes. The fixtures represent a publisher replacing its PDF at an existing URL, not a reader/model accuracy test.

**Ranked hypotheses and measurements**

1. **Saved layout is applied to different original bytes — confirmed.** `pdf-changed-probes.ts` changes only the regions argument: `{regions: []}` gives exactly the standalone new PDF parser's body, with the missing prose restored and obsolete table absent.
2. **Fetch or the kept-original write retained the old PDF — ruled out.** The stored bytes equal the new fixture; the standalone parser does not find the old table in those same bytes.
3. **The new fixture's ordinary PDF extraction is defective — ruled out for this symptom.** Standalone extraction and reimport with empty regions agree. Reimporting the unchanged original converges, and Undo restores the previous document in both changed-original variants.

**Cause:** `packages/core/src/ingest/index.ts:887` loads `layoutOf(item.dir)` unconditionally, then `:890` passes it into parsing a newly fetched original without checking that it belongs to that original. `:970` saves the new PDF while `:973` saves the old regions again; `:982` commits the mixed body. `packages/core/src/ingest/pdf.ts:596–603` inserts the stale table/formula and removes current text inside those obsolete boxes. Evidence: [probe log](logs/pdf-changed-probes.log).


### F577 reconfirmed — Reimport persists a highlight with its final letter cut off — S1

**Platform:** Both, shared anchoring; canonical persistence reproduced through Mac core.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep2/codex-out/media/f577.ts
```

Observed output (assertion stack omitted):

```text
[DEEP] {"before":"Learning supports memory","expected":"Learning supports memories","actual":"Learning supports memorie","note":"Use this idea.","removed":0,"unplaced":0}
AssertionError: F577: reimport must not persist a clipped final word
```

**Repeatability:** 3/3 failures on this assertion; measured process times 81 ms, 62 ms, 62 ms.

**Minimized steps**

1. Import Markdown `# Notes\n\nLearning supports memory.\n` from a stubbed URL.
2. Highlight `Learning supports memory` and attach a note.
3. Change the fetched Markdown to `# Notes\n\nLearning supports memories\n`, then reimport.

**Expected:** the surviving passage's whole final word, `memories`, remains selected. **Actual:** the persisted annotation's exact quote becomes `Learning supports memorie`. It is neither removed nor reported as unplaced. The annotation note survives. This reconfirms the assigned open F577 and violates D93's reanchoring promise; it is not an additional new finding.

**Ranked hypotheses and measurements**

1. **Boundary refinement favors the wrong end in a context-score tie — confirmed.** The stored suffix is `.\n`. In the new body, both end 34 (`s\n` after it) and end 35 (`\n` after it) score 0.5. Refinement selects 34 because it is nearer the approximate match. Keeping the period instead produces score 1 at the correct end and preserves `memories`.
2. **Annotation persistence independently truncates the result — ruled out.** `f577-boundaries.ts` calls the pure anchor function and gets the same clipped span before persistence.
3. **An ambiguous paragraph or wrong occurrence wins — ruled out in the minimized case.** There is one passage with an unchanged prefix. Changing only the period with the original word retained takes the exact-match path and preserves the whole quote.

**Cause:** `packages/core/src/anchoring.ts:145–156`, specifically the distance tie-break at `:151` and suffix-only end score at `:156`. The unchanged prefix passes context acceptance at `:133–139`. `packages/core/src/annotations.ts:229–232` then saves the clipped range as the new selector. Evidence: [boundary probe](logs/f577-boundaries.log).


### MEDIA-02 — Repeated speech disappears from audio transcripts — S2

**Platform:** Mac audio import; both devices receive the shortened canonical text. The parser is also shared by video captions.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep2/codex-out/media/audio-repeat.ts
```

Observed output (assertion stack omitted):

```text
[DEEP] {"body":"[00:00] Practice retrieval.\n","words":[{"t":0,"w":"Practice"},{"t":0.9,"w":"retrieval."}],"repeatedPassages":1}
AssertionError: Separated spoken repetitions must both remain in the transcript
```

**Repeatability:** 3/3 failures on this assertion; measured process times 77 ms, 70 ms, 69 ms.

**Minimized steps**

1. Stub the audio transcriber to return two VTT cues: `Practice retrieval.` at 00:00–00:02 and the same sentence at 01:10–01:12.
2. Import the recording through `addSource`.
3. Read its body and timed words.

**Expected:** both spoken occurrences survive and the second can be highlighted/located at 70 seconds. **Actual:** the body contains one occurrence and there are no timed words for the second. The complete VTT remains beside the source; the learning text and word map omit it. This violates D122 and the timed-reading behavior of D49/D167. Audio input is synthetic and speech output is stubbed, as in an ingestion unit fixture; this does not evaluate recognition accuracy.

**Ranked hypotheses and measurements**

1. **Rolling-caption deduplication treats genuine repeated speech as a duplicate — confirmed.** Identical consecutive cue text is collapsed whether the next cue begins at 1, 2 or 70 seconds. Adding `now` only to the second sentence retains it at 70 seconds.
2. **The later timestamp is invalid or filtered — ruled out.** The changed-text control uses exactly the same later timestamps and survives.
3. **Persistence or the reader loses a valid parser result — ruled out.** Direct `vttLines`, `vttWords` and `vttToBody` already omit the second occurrence before writing any library file.

**Cause:** `packages/core/src/ingest/youtube.ts:71–80`, especially `:78`: a cleaned line equal to the previous emitted line is discarded without checking cue overlap or time. Audio reuses this caption parser. Evidence: [parser controls](logs/audio-repeat-probes.log).


### MEDIA-03 — Two episodes with the same title resolve to the wrong audio — S2

**Platform:** Both, shared episode resolver; exercised directly with deterministic response stubs.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep2/codex-out/media/feed-title.ts
```

Observed output (assertion stack omitted):

```text
[DEEP] {"mode":"same-title","audio":"https://example.test/jan-2.mp3","title":"Daily practice","show":"Example","published":"2024-01-01","language":"en"}
AssertionError: Requested January 1 episode must not play January 2 audio under the January 1 date
```

**Repeatability:** 3/3 failures on this assertion; measured process times 24 ms, 23 ms, 25 ms.

**Minimized steps**

1. Request an older Apple Podcasts episode absent from the lookup's newest episodes. Its page identifies `Daily practice`, published January 1, 2024.
2. Serve its feed with January 2 first and January 1 second; both are named `Daily practice`, with different audio URLs.
3. Resolve the requested episode.

**Expected:** January 1 audio and date. **Actual:** January 2 audio paired with January 1 metadata. A learner would import/hear a different lesson under the requested episode's identity (D122/D167). The red loop stops at the resolver; it does not claim a real episode was downloaded or transcribed. This is a new ambiguity in the older-episode fallback introduced for F62, not a claim that all of F62 regressed.

**Ranked hypotheses and measurements**

1. **First title match wins over the known publication date — confirmed.** Renaming only January 2's feed title makes January 1 resolve correctly.
2. **The January 1 date cannot be parsed — ruled out.** With no matching feed title, the same-date fallback correctly resolves January 1 (`feed-title.ts no-title`).
3. **Apple's lookup supplied the wrong episode/audio — ruled out.** The stub lookup supplies only the show/feed, no episode. The wrong URL is precisely the newer feed item's enclosure.

**Cause:** `packages/core/src/ingest/audio.ts:183–184` computes the correct date candidates but gives unconditional priority to the first normalized-title match. `:167` combines its audio with the requested page's date. Evidence: [unique-title control](logs/feed-title-control.log), [date control](logs/feed-date-control.log).


### MEDIA-04 — iPhone search misses Unicode words the Mac finds — S2

**Platform:** iPhone, reproduced in the supplied WebKit phone build against the CLI.

**Red command:**

```sh
ORE_NO_ENRICH=1 node /Users/tylerpoelking/Developer/ore-wt/deep2/codex-out/media/phone-search.cjs
```

Observed output (assertion stack omitted):

```text
[DEEP] [{"q":"μνημη","mac":true,"phone":false},{"q":"ΜΝΗΜΗ","mac":true,"phone":true}]
AssertionError [ERR_ASSERTION]: Phone must find the same Greek word in lowercase as the Mac
```

**Repeatability:** 3/3 failures on this assertion; measured process times 1069 ms, 970 ms, 961 ms.

**Minimized steps**

1. Add the same source body containing `ΜΝΗΜΗ` through the Mac CLI and the phone page's actual core command dispatcher.
2. Search for lowercase `μνημη` on both.
3. Search for uppercase `ΜΝΗΜΗ` as the control.

**Expected:** both searches locate the same source on both devices. **Actual:** the phone misses lowercase while the Mac finds it; uppercase succeeds on both. A second isolated probe shows the phone also misses `cafe` for `café`, which the Mac finds. This is an index/search parity defect, not an expected difference in result ranking. It is distinct from the earlier decomposed-accent normalization fix.

**Ranked hypotheses and measurements**

1. **The phone SQL adapter substitutes a tokenizer with different Unicode behavior — confirmed.** Identical fresh FTS tables containing `ΜΝΗΜΗ café` reproduce the difference outside the UI. A probe-only FTS4 table created explicitly with `tokenize=unicode61` matches both lowercase Greek and unaccented `cafe`.
2. **The phone saved different source bytes — ruled out for the isolated cause.** Both database probes insert the exact same literal. The full command loop also finds the newly added phone source with its uppercase query.
3. **A stale index or async search response missed the new source — ruled out.** Fresh table queries are synchronous and reproduce the failure without existing library state.

**Cause:** `apps/desktop/src/phone/sqlite.ts:14–21` rewrites FTS5 into FTS4 without preserving equivalent Unicode tokenization. Core text normalization cannot compensate for different token case/accent matching. No adapter was edited; the tokenizer control exists only in `phone-search-probes.ts`. Evidence: [database probes](logs/phone-search-probes.log).


### MEDIA-05 — A transient phone read failure makes synced text stay stale — S2

**Platform:** iPhone native-folder rescan path; real filesystem shim with a simulated native command backend, not live iCloud.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep2/codex-out/media/phone-read-retry.ts
```

Observed output (assertion stack omitted):

```text
[DEEP] {"first":true,"second":false,"reads":2,"actual":"Old source text.","expected":"New source text from the Mac."}
AssertionError: A synced source temporarily unreadable once must be retried on the next scan
```

**Repeatability:** 3/3 failures on this assertion; measured process times 23 ms, 23 ms, 23 ms.

**Minimized steps**

1. Mount a source containing `Old source text.` with stamp 1.
2. Simulate its Mac edit: new text, stamp 2. Return `null` for this one `library_read` call.
3. Restore successful reads and rescan again with the unchanged stamp 2.

**Expected:** the later scan retries the unread update and replaces the old text. **Actual:** it never reads again at stamp 2; the source remains stale. The first scan reports a change and the next says no change. This breaks D222's repeated ingestion of Mac edits. No canonical disk loss is claimed.

**Ranked hypotheses and measurements**

1. **The failed read's stamp is marked successfully seen — confirmed.** Three further scans at stamp 2 issue no additional read. Changing only the stamp to 3 retrieves the same new text immediately.
2. **A pending phone write deliberately protects its local text — ruled out.** The loop performs no phone-side write; the pending-write set is empty.
3. **The incoming text is invalid UTF-8 and should be ignored — ruled out.** The source is plain ASCII and returns correctly once the stamp changes. The injected `null` lasts exactly one read.

**Cause:** `apps/desktop/src/phone/fs.ts:308–311` updates `known` before checking for a null read; `:327` subsequently excludes that file. The comment assumes null means non-UTF-8. Native `apps/phone/src-tauri/src/lib.rs:110–119` returns null for **any** filesystem read failure as well, so a transient failure uses that same path. This report proves the behavior for that contract response, not the frequency of native failures. Evidence: [rescan probes](logs/phone-read-probes.log).


### MEDIA-06 — Valid single-quoted feed enclosure is rejected — S3

**Platform:** Both, shared older-episode resolver; deterministic response stubs.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun /Users/tylerpoelking/Developer/ore-wt/deep2/codex-out/media/feed-enclosure.ts
```

Observed output (assertion stack omitted):

```text
[DEEP] {"mode":"single","error":"Couldn’t find “Retrieval” in Example’s feed. Add the episode from the show’s own site instead.","calls":["https://itunes.apple.com/lookup?id=123&entity=podcastEpisode&limit=200","https://podcasts.apple.com/us/podcast/example/id123?i=456","https://example.test/feed.xml"]}
AssertionError: A valid single-quoted RSS enclosure must resolve the episode
```

**Repeatability:** 3/3 failures on this assertion; measured process times 24 ms, 24 ms, 23 ms.

**Minimized steps**

1. Resolve an older Apple Podcasts episode whose page provides its title/date and whose show has a feed.
2. Give the matching feed item a valid `<enclosure url='https://example.test/episode.mp3' ... />`.
3. Resolve the same episode with double quotes as the control.

**Expected:** both valid XML attribute quoting forms resolve the same audio. **Actual:** the single-quoted feed is refused and tells the learner to add from the show's site. This blocks a supported podcast import (D122). It is separate from MEDIA-03: one unique episode, exact matching title/date, no ambiguous candidate.

**Ranked hypotheses and measurements**

1. **Enclosure extraction accepts double quotes only — confirmed.** The quote-only control returns the expected MP3 URL.
2. **Title/date matching rejects the item — ruled out.** Those values remain identical in the successful control.
3. **A feed fetch, lookup or unsupported audio format caused rejection — ruled out.** The same three response routes and MP3 enclosure are used in both variants; only attribute quote style changes.

**Cause:** `packages/core/src/ingest/audio.ts:176` requires `url="..."` in its regular expression. Evidence: [double-quote control](logs/feed-enclosure-control.log).


## Leads and unresolved checks

- **F575 remains open:** no red timeout loop was obtained. Three isolated runs of the requested F181 test selection passed all four selected tests; a later instrumentation attempt also passed. This does not establish that the original failure was load alone, or rule out a race.
- **180° PDF rotation:** `pdf-rotate.ts` supplied rotated fixture boxes and observed duplicated old table/formula content because the aspect ratio is unchanged. No minimized red oracle tied to actual Paddle coordinate conventions was established; do not file this as a finding yet.
- **An open Original page may retain old file contents after reimport:** its file-loading dependency merits a live replacement probe; no red UI loop, so not a finding.

### F575 timing evidence

Exact requested test command, with temporary/model paths contained and the already-installed Apple OCR helper pinned to avoid an out-of-folder compilation:

```sh
TMPDIR="$PWD/codex-out/media/tmp" \
ORE_NO_ENRICH=1 \
ORE_PADDLE_HOME="$PWD/codex-out/media/no-model" \
ORE_OCR=/Users/tylerpoelking/Library/Caches/ore/helpers/ocr-5b7c292c4fb5 \
bun test packages/core/test/reimport.test.ts -t F181
```

| Selected test | Run 1 | Run 2 | Run 3 |
|---|---:|---:|---:|
| Reimport offered for kept-original types | 1648.88 ms | 1004.81 ms | 522.96 ms |
| Recording reread | 256.23 ms | 240.76 ms | 309.25 ms |
| Recording failure/silence | 481.87 ms | 972.10 ms | 495.28 ms |
| Word reread | 45.34 ms | 44.05 ms | 45.68 ms |
| Whole selected run | 2.47 s | 2.29 s | 1.408 s |

The own-script step loop is `ORE_NO_ENRICH=1 bun codex-out/media/f181-timing.ts` (the script pins its helper/environment). It times imports in three fresh libraries within one process:

| Step | First | Second | Third |
|---|---:|---:|---:|
| Audio | 29 ms | 4 ms | 4 ms |
| Word | 117 ms | 7 ms | 6 ms |
| Screenshot | 78 ms | 70 ms | 68 ms |
| PDF | 639 ms | 18 ms | 16 ms |
| Markdown | 2 ms | 1 ms | 1 ms |
| Text + snippet | 2 ms | 1 ms | 1 ms |

The screenshot fixture reports no text in this environment; that refusal is caught, as in the selected test. Largest observed first-use cost is PDF, followed by Word. These measurements support cold initialization/native-tool work as a contributor but do not identify which subprocess took the original run over 5 seconds. The import path awaits Quick Look thumbnail generation, whose own timeout is 20 seconds (`packages/core/src/ingest/thumbnail.ts:114`), longer than the test's 5-second limit; Apple OCR also introduces native work. A prototype `child_process` preload probe did not intercept Bun's imported calls, so it provides no subprocess attribution. Ranked remaining hypotheses: (1) cold PDF initialization/native thumbnail latency, supported by the first-use step measurements; (2) transient native OCR/transcriber or system-load delay, plausible but not attributed; (3) a coordination race, neither reproduced nor ruled out. Logs: `f181-1.log`, `f181-2.log`, `f181-3.log`, `f181-steps.log`, `f181-profile.log`. No retries/skips or test changes were made.

## What passed

- **PDF unchanged-byte reread convergence:** `pdf-lifecycle.ts`; two identical stubbed layout reads converge and preserve highlight/note state. A failed reread leaves document bytes unchanged. No real Paddle ran.
- **PDF archive during reread:** `pdf-interrupt.ts`; archive remains set while improved table text lands, annotation/note remain, and saved exercise bytes survive.
- **PDF cancellation:** the same script sends process-group SIGTERM to the actual CLI while its bounded stub waits; exit 143, source and exercise unchanged, no lingering reading state. This tests cancellation before commit, not every possible instruction boundary during a commit.
- **PDF Undo:** `pdf-changed-probes.ts`; both changed-file variants restore the previous body. Correct bytes plus the existing regions converge on an unchanged original.
- **Diagrams in source notes and skill notes:** `diagram-roundtrip.ts`; core read/write equality, two editor serialization passes converge, nested `customData`, unknown fields and `originalText` survive, and scene-level custom data survives. Basic link/rename succeeds and the outline exposes the text label. This is representative field coverage, not every possible element schema; no real AI exercise generation ran.
- **Transcript boundary cases:** `transcript-boundaries.ts`; gaps, overlapping cues, zero-duration words and a three-hour cue preserve words, finite nondecreasing times and selectable word offsets. The gap's next phrase maps to 70 seconds, and the long timestamp maps to 3:00:00. Malformed out-of-order cues are clamped in body order; no correctness claim for their original timing.
- **Phone binary filesystem:** `phone-checks.cjs`; 256-byte and 2 MiB payloads, Unicode/spaces in filenames, copy/rename and IndexedDB save/reload all round-trip byte-for-byte in the real phone page.
- **Seeded Mac/phone comparison:** six sources and the due queue agree. Source comparison differs only by device-specific `enrich_skipped` and paths; the raw diagnostic records that difference. English `practice` search has the same hit set; order/snippets differ because the phone adapter intentionally lacks BM25 ranking.
- **Changes while the phone stays open:** `phone-sync.cjs`; actual CLI writes a source, Unicode note and device review log to an owned scratch copy. A simulated native snapshot/rescan in the same live phone page exposes the source and exact note, finds the source in search, and yields the same due queue as the Mac. The next rescan is a no-op. This verifies the rescan/core seam, not live iCloud transport.
- **Existing targeted suite:** 43 passed, 0 failed, 166 assertions across seven files in 5.27 seconds: core `tables.test.ts`/`diagrams.test.ts`; desktop `original-match.test.ts`, `transcript.test.ts`, `phone-fs.test.ts`, `phone-streams.test.ts`, `phone-search.test.ts`. Full log: [targeted-tests.log](logs/targeted-tests.log). These passes coexist with the new red cases above.

## Handoff

The numbered MEDIA labels are local report identifiers, not reserved findings-registry numbers. Each red loop has its own independent setup and assertions, and each associated probe stays in this folder. `repeat-findings.ts` is the bounded three-run driver; do not run its children concurrently because some intentionally reuse a named scratch library. Browser scripts connect to the supplied browser, use one context/one page, and close their own context. The original application, services, source files and known findings remain unchanged.
