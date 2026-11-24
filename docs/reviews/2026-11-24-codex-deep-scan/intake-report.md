# Intake deep scan

Tested commit `321631d54c340723e63e5ee8cd996698db2e4b5b` on 2026-11-23 local time (2026-11-24 UTC), using Bun 1.4.4. Covered core/CLI import and reimport, annotation ownership, chapter recalls, originals/assets, metadata, duplicate capture, archive/Undo, 28 file fixtures, 14 saved web fixtures, 1,000 deterministic anchoring cases, four Mac/phone import comparisons, six changed-file cases, replayed audio/video/OCR, malformed inputs, unusual filenames, and 16 interrupted CLI imports. Read the agreement, spec, findings, sweeps, glossary, D96/D122, and the supplied diagnosing-bugs workflow. No application/repository source, tests, findings registry, or decisions were edited; everything written is in this folder, apart from the expressly provided phone browser's own IndexedDB test state. No live sites or real AI were used. Skipped native OCR/speech accuracy, PDF page-content editing, actual iCloud transport, rendered-outline completeness, performance/UX, and the named open grid gaps/known findings. The seeded library is small: six sources. Source deletion has no public source-delete command; tested the supported archive/restore path instead. Archive intentionally keeps exercises reviewing under the SPEC, so that was not reported as a queue bug.

## Findings

Run every command below from `/Users/tylerpoelking/Developer/ore-wt/deep-scan`. Scripts reset only their own named scratch libraries. All eight commands failed on their intended assertion **3/3 runs**; see [verification.json](verification.json) and `evidence/<script>-1.log` through `-3.log`. These are findings, not fixes. “Both” means the shared core/library result affects both readers; only the phone checks explicitly identified below were executed in WebKit.

### 1. A deleted passage's question is silently rewritten onto another passage

**S1 — persisted annotation corruption. Both; full reimport reproduced through Mac core.** Violates the anchoring contract and D93's treatment of questions whose passages disappear. This differs from F363: that row fixes choosing among exact copies at the old position; this case accepts a different, merely similar sentence after the selected section is deleted.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun codex-out/intake/reimport-wrong-passage.ts
```

```text
[DEEP] reimport {"removed":0,"unplaced":0,"quote":"The grey heron nests beside the marsh each spring.","note":"Why does the blue heron pick the river?","anchor":{"start":53,"end":103,"method":"position"}}
[DEEP] undo {"quote":"The blue heron nests beside the river each spring."}
AssertionError: Reimport must report a deleted passage as unplaced, never rewrite it to another section
```

**Minimal steps:** Import two sections, one about blue herons by a river and one about grey herons by a marsh. Mark the river sentence as a question. Delete the river section in the served original. Reimport. Expected: the question retains its original quote and is reported unplaced. Actual: its stored quote becomes the marsh sentence, its river question remains attached, and `unplaced` is empty. Undo restores the quote.

**Ranked hypotheses and measurements:**

1. Fuzzy matching accepts a candidate without requiring sufficient surrounding-context agreement. Confirmed: [anchor-probes.ts](anchor-probes.ts) returns the marsh sentence despite both surrounding descriptions changing.
2. The old offset overrides the context. Rejected as the necessary cause: moving the surviving section 5,000 characters away still gives the same wrong match.
3. Reimport alone rewrites the wrong selector. Rejected as the initial cause: [anchor-deletion.ts](anchor-deletion.ts) reproduces with the pure anchoring function. Reimport then makes the false match permanent.
4. The selected quote actually survives elsewhere. Rejected: the surviving body contains no blue-heron sentence; a control containing no similar passage returns `null`. A legitimate small edit to the correct passage still anchors correctly.

**Cause:** `packages/core/src/anchoring.ts:115`–`:122` accepts the best approximate match within a 25% character error budget without a rejection threshold for context. `packages/core/src/annotations.ts:229`–`:232` saves that match as the annotation's new exact quote. The next read consequently reports it as a normal position match.

### 2. Reimporting unchanged saved HTML breaks its saved illustration

**S1 — an existing canonical document is rewritten with a broken asset reference. Mac.** D122, D96, and the kept-original/reimport promise.

**Red command:**

```sh
TMPDIR="$PWD/codex-out/intake/tmp" ORE_NO_ENRICH=1 bun codex-out/intake/reimport-local-image.ts
```

```text
[DEEP] local-image {"before":"assets/7f82852cfe75e6db.png","after":"file://source.html/figure.png","changed":true,"keptAssetExists":true,"originalFileStillExists":true}
AssertionError: Reimporting unchanged saved HTML must keep its already saved illustration
```

**Minimal steps:** Save an HTML article and a sibling `figure.png`. Import it: the picture correctly becomes a saved `assets/…png` reference. Reimport the unchanged kept `source.html`. Expected: identical document and working picture. Actual: the image becomes `file://source.html/figure.png`; the existing saved asset is still on disk but is no longer referenced. The original external picture also still exists, so deleting the input folder is not required.

**Ranked hypotheses and measurements:**

1. Reimport loses the original HTML's base location. Confirmed: only the relative-path case fails in [local-image-probes.ts](local-image-probes.ts); absolute `file://` and remote-image controls remain byte-identical.
2. The saved asset is deleted or overwritten. Rejected: it still exists under its original hash; Undo restores the correct body.
3. Image size/type filtering rejects the picture. Rejected: all three controls use the same PNG bytes; initial import and both absolute-path controls keep it.

**Cause:** `packages/core/src/ingest/index.ts:838` passes the bare name `source.html` and an undefined URL/base into `fromBytes`. Its HTML path at `ingest/index.ts:217` supplies `file://${name}`. The old relative-image-to-saved-asset mapping is not reused. The resulting broken reference is committed at `ingest/index.ts:902`.

### 3. Reordering book chapters assigns a saved recall to the wrong chapter

**S1 — saved learning data is associated with the wrong source text. Both; reproduced through Mac core.** D115's per-chapter recall and D93's preservation of what hangs off a source.

**Red command:**

```sh
TMPDIR="$PWD/codex-out/intake/tmp" ORE_NO_ENRICH=1 bun codex-out/intake/reimport-chapters.ts
```

```text
[DEEP] recall-moved {"chapter":1,"recall":"I remember that forgetting happens fast at first.","chapterHeading":"# Practice","sourceNote":"## Forgetting\n\nI remember that forgetting happens fast at first."}
[DEEP] undo-control {"firstChapterIsForgetting":true,"recall":"I remember that forgetting happens fast at first."}
AssertionError: Saved Forgetting recall must not become a recall of Practice after chapter reorder
```

**Minimal steps:** Import a two-chapter EPUB, Forgetting then Practice. Save a recall of Forgetting. Reorder the two chapters in the kept original and reimport. Expected: the saved recall follows Forgetting or is explicitly left unplaced. Actual: it remains `chapter_recalls[0].n = 1`, now Practice. Its text remains in the source note, but the chapter recall/feedback association is wrong.

**Ranked hypotheses and measurements:**

1. Reimport preserves numeric chapter references without remapping them. Confirmed: the body order changes correctly while the recall's `n` stays 1.
2. EPUB extraction ignores or scrambles spine order. Rejected: the new first chapter is exactly Practice, the requested new order; Undo restores Forgetting first.
3. The feedback reader selects the wrong range despite a correct record. Rejected: `chapterLines(file, record.n, type)` correctly returns chapter 1, which now contains Practice. This is the same range construction used by feedback; no AI was called.

**Cause:** chapter numbers are assigned afresh in `packages/core/src/ingest/epub.ts:116`; `packages/core/src/ingest/index.ts:901` carries `chapter_recalls` forward unchanged via `...now`. `packages/core/src/ai/recall.ts:77`–`:86` then pairs the old recall with the newly numbered text. Minimal EPUBs are generated by [epub-fixture.ts](epub-fixture.ts).

### 4. An EPUB illustration on its own page disappears

**S2 — part of an otherwise readable book is omitted. Both, shared EPUB reader.** D122. The grid's EPUB illustrations cell is covered, not a named gap.

**Red command:**

```sh
TMPDIR="$PWD/codex-out/intake/tmp" ORE_NO_ENRICH=1 bun codex-out/intake/epub-plate.ts
```

```text
[DEEP] plate {"baselineImages":1,"importedImages":0,"originalRetained":true}
[DEEP] caption-control {"images":1}
AssertionError: An illustration on its own spine page must not disappear
```

**Minimal steps:** Import a book with one prose page and a separate illustration page in its spine. Expected: the illustration remains in reading order, whether or not it gets a chapter-recall marker. Actual: the page and its asset disappear from `doc.md`; import succeeds. The kept original is byte-identical to the supplied EPUB. Moving the same image beside prose, or adding a caption paragraph on its own page, preserves it.

**Ranked hypotheses and measurements:**

1. All image-only pages are treated as covers/title plates and discarded. Confirmed by the one-caption control.
2. The illustration path or image encoding is invalid. Rejected: identical path and bytes work when prose is on the same page.
3. Asset deduplication drops a repeated image. Rejected: the minimized book contains exactly one illustration reference and no cover image.

**Cause:** `packages/core/src/ingest/epub.ts:113`–`:115` skips every image-only spine document before transferring its images to the book's assets. It does not distinguish a cover from a content illustration.

### 5. Two simultaneous CLI captures create two sources for the same link

**S2 — duplicate sources and independent future learning records. Mac CLI confirmed; no actual iCloud race claimed.** Violates D89: a link already in the library is not added twice. Different from F63's URL-normalization defect: these URLs are byte-identical.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun codex-out/intake/concurrent-cli.ts
```

```text
[DEEP] concurrent-cli {"exitCodes":[0,0],"sources":2,"distinctIds":2}
[DEEP] sequential-control {"sources":1}
AssertionError: Concurrent real CLI commands must deduplicate the same exact URL
```

**Minimal steps:** Start two `ore add <same-url> --no-enrich --json` processes against one scratch library. A preload serves fixed Markdown and releases both responses once both processes reach the fetch. Both commands exit 0, producing two different source IDs. Expected: one source, with the second capture reusing it. The file barrier is bounded to five seconds and involves no server/live fetch.

**Ranked hypotheses and measurements:**

1. The existing-source check happens before fetching, outside the write lock, without a second check before creation. Confirmed by the barrier reproduction.
2. URL normalization produces different keys. Rejected: the exact same URL is used, and sequential captures yield one source.
3. Only direct core callers bypass a CLI safeguard. Rejected: both real CLI processes reproduce it. [concurrent-import.ts](concurrent-import.ts) also reproduces with core alone.

**Cause:** `packages/core/src/ingest/index.ts:554` checks once, then awaits extraction at `:557` and creates at `:562`. `packages/core/src/items.ts:197` locks the writes, but does not repeat the duplicate check. [race-preload.ts](race-preload.ts) only controls the input timing and bytes.

### 6. Phone course Undo restores lessons that were already archived

**S2 — Undo changes prior organization. iPhone and the CLI course command; the Mac course-menu implementation avoids it.** The action does not restore its preceding state.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun codex-out/intake/course-archive-undo.ts
```

```text
[DEEP] course-undo {"before":[false,true],"archived":[true,true],"after":[false,false],"archivedByAction":1,"restoredByUndo":2}
AssertionError: Undo of Archive course must keep an already archived lesson archived
```

**Minimal steps:** Make a two-lesson course. Archive only lesson B. Archive the course, then Undo. Expected archive flags: `[false,true]`, as before the action. Actual: `[false,false]`, restoring B too.

**Phone confirmation:** `ORE_NO_ENRICH=1 node codex-out/intake/phone-course-undo.cjs` ran the exact command sequence used by the phone's menu through its existing WebKit in-page core. It also returned `before:[false,true]`, `after:[false,false]` and failed the intended assertion. This is a command-path confirmation, not a claim of tapping the Undo toast. Evidence: [phone-course-undo.log](phone-course-undo.log).

**Ranked hypotheses and measurements:**

1. The inverse operates on every currently archived lesson rather than remembering those changed. Confirmed: the archive reports one changed lesson, the inverse reports two restored lessons.
2. Only stale UI listing data makes B appear restored. Rejected: core `findItem` and phone `show` both read `archived_at` as absent.
3. A timing race between archive and Undo is required. Rejected: every operation is awaited, both in core and on the phone.

**Cause:** `packages/core/src/courses.ts:33` selects lessons by their present archive state. `apps/desktop/src/phone/PhoneApp.tsx:1074`–`:1077` uses the whole-course inverse for Undo. In contrast, `apps/desktop/src/App.tsx:1738` records the listed lessons and archives/restores only that set.

### 7. An EPUB missing a referenced figure is silently saved without it

**S3 — malformed-file edge that presents incomplete learning content as a successful import. Both, shared EPUB reader.** D96 requires refusal with a next step; EPUB junk and illustrations are covered grid cells.

**Red command:**

```sh
TMPDIR="$PWD/codex-out/intake/tmp" ORE_NO_ENRICH=1 bun codex-out/intake/epub-missing-image.ts
```

```text
[DEEP] missing-figure {"refused":false,"error":null,"saved":1,"body":"<!-- chapter 1 -->\n\n# Experiment\n\nThe diagram explains the result.\n"}
AssertionError: EPUB missing a referenced figure must be refused, not silently saved without the figure
```

**Minimal steps:** Build a one-chapter EPUB with prose and an image; remove just the image entry from the ZIP, retaining its HTML/manifest references. Import. Expected: a damaged/incomplete-file refusal and no saved source. Actual: the image and its alternative text vanish, leaving a successful source saying the absent diagram explains the result.

**Ranked hypotheses and measurements:**

1. Missing image lookup is intentionally converted to element removal. Confirmed by direct `epubToDoc` probes before any library write.
2. ZIP extraction or asset writes fail after a successful parse. Rejected: direct extraction returns successfully with no asset; no failing write occurs.
3. Duplicate-source detection reuses an earlier incomplete source. Rejected: each reproduction uses a newly initialized library.

**Cause:** `packages/core/src/ingest/epub.ts:99` returns undefined for a missing image; `:48` removes its element. Missing chapter *files*, by contrast, throw and are refused, as [epub-probes.ts](epub-probes.ts) verifies. This is separate from finding 4: there the source is complete and the whole image-only page is discarded.

### 8. Reimport ignores a new author/date if the text stays the same

**S3 — metadata-only update edge; stale byline/date and stale kept original. Both, shared reimport.** D122's source metadata and original preservation.

**Red command:**

```sh
ORE_NO_ENRICH=1 bun codex-out/intake/reimport-metadata.ts
```

```text
[DEEP] same-body {"changed":false,"author":null,"published":"2024-01-01","originalUpdated":false}
[DEEP] changed-body-control {"changed":true,"author":"Ada Learner","published":"2025-02-03"}
AssertionError: Reimport must pick up author added to otherwise unchanged original
```

**Minimal steps:** Import a linked Markdown document with a date and no author. Change only its frontmatter: add an author and update the date. Reimport. Expected: fill the previously absent author, update the date, and retain the newly fetched original. Actual: `changed:false`, author still absent, old date and original retained. Adding one body paragraph with the exact same metadata makes all of those fields update.

**Ranked hypotheses and measurements:**

1. Equal-body early return skips metadata/original updates. Confirmed by the one-paragraph control.
2. The Markdown parser or schema ignores the author/date. Rejected: identical metadata lands when the body changes.
3. Reimport reuses cached original bytes instead of fetching. Rejected: the local fetch stand-in serves the updated frontmatter; the next controlled response differs only in its body paragraph.

**Cause:** `packages/core/src/ingest/index.ts:873`–`:876` returns early on body equality, updating only `structure`. The metadata merge and original-file writes are below that return.

## Leads

- EPUB spine entries missing from the manifest appear to be filtered out silently, leaving chapter text out while importing the rest. `epub-probes.ts` observes this, but there is not yet a dedicated failing full-import assertion/minimized loop; do not count it as a ninth finding.
- A fuzzy-edited correct passage loses to a verbatim copy in another section because exact matches are searched first. `anchor-probes.ts` observes the selection, but the semantic-ownership assertion is not separated from finding 1 yet.
- Zero-byte HTML and a generic ZIP renamed `.docx` are refused with raw library errors rather than an actionable next step. Recorded in `refusals.json`; no dedicated message-contract red loop yet.
- Interruption during reimport/Undo's multi-file swap was not exercised; the kill trials cover initial imports only.

## What passed

- `matrix.ts`: 28 file fixtures imported under two clocks/time zones with identical body and source metadata after excluding expected capture time/ULID differences; asset names/references are part of the compared body. See `matrix.json`.
- `matrix.ts`: 27 reimportable file fixtures kept their body, sampled start/middle/end highlights, source notes, answered prequestions, and exercise bytes; the local Markdown fixture correctly offers no reimport.
- `web-matrix.ts`: 14 saved web pages, including Japanese, Arabic, Russian, code, tables and math, gave stable normalized imports and unchanged reimports with their sampled highlights. HTTP and images were served from fixtures; image responses use one local PNG stand-in, so this does not establish original-site pixel fidelity.
- `changed-files.ts`: Word paragraph insertion, PowerPoint heading change, Excel sheet rename, notebook-cell insertion, CSV-row insertion and RTF paragraph insertion preserved an unchanged selected passage, its question/note, source note, and Undo's original body.
- `anchor-fuzz.ts`: 1,000 cases, seed `0x514E`, passed exact passage ownership after inserted prefixes, renamed headings and section moves across prose, headings, tables, code, math and transcript lines. This is not a broad arbitrary-edit fuzz result.
- `media.ts`: audio and YouTube timestamp shifts kept selected spoken words and Undo; unchanged screenshot/scanned-PDF reimports kept highlights. Speech/OCR/yt-dlp outputs were replayed, never executed against real AI or live video.
- `phone-differential.cjs`: four Mac CLI versus phone in-page imports matched title, author, date, type, hash, body and tags; the phone listed all four. Cases: plain text, Unicode, Markdown metadata/table/code/math, and rich HTML.
- `refusals.ts`: ten malformed/empty cases left no source, including a truncated EPUB, missing EPUB chapter file, ZIP-as-Word, bad notebook/RTF, login wall, and zero-byte files. Some error wording remains a lead above.
- `filenames.ts`: colon, NFD accent, CJK, spaces, punctuation, and a 255-byte filename imported whole; CRLF bodies normalized correctly. A literal `/` is not a macOS filename character and was not fabricated as one.
- `killed-imports.ts`: 16 bounded trials on a roughly 2 MB Markdown input, ten terminated with SIGKILL and six completed first; no visible source had partial body/hash. At 42 ms, Doctor named an unfinished folder and stale lock. This confirms F283's existing recovery disclosure rather than re-reporting it. Timing is observational, not a deterministic kill-boundary guarantee.
- `lifecycle.ts`: single-source archive removed its list row, question, search hits and course membership; restore returned the observed state. Its exercise remained due by design. Backlinks stayed usable through the retained source; archive does not delete its note.
- `check-docs.ts codex-out/libs/intake`: all six seeded sources passed metadata schema/body hash/local image existence/line-leading timestamp order checks; 13 headings inventoried. This is not a rendered-outline or semantic completeness proof.
- `check-docs.ts`: the final run checked 192 sources across 146 libraries, 169 image references, 569 headings and 16 timestamp markers; its only integrity error was finding 2's broken `file://source.html/figure.png`. Missing content already omitted by a reader cannot be detected by an output-only checker.
- Native `punctuation.pdf` OCR was not counted as passing: it attempted to create `~/Library/Caches/ore/helpers` and the sandbox refused (`EPERM`). The scan did not bypass that restriction. Scanned-PDF and screenshot parser checks used the documented replay hook instead.
- All assertions and probes are bounded, browser contexts were closed, no server/watcher was started, and `git status --short` remained empty. No commit/push was made because this run explicitly requested findings only and no repository edits.
