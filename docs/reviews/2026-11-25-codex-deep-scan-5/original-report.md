# Deep scan 5 — original

Read-only scout at `05c68297d33d46d6b17b404c101543bc9dfd9557`, using Bun 1.4.4. Covered original-file retention and byte identity, rename/duplicate/archive behavior, saved HTML dependencies and encoding, PDF passage matching, PowerPoint speaker notes, reimport with annotations/exercises/reviews/manual edits, damaged or missing originals, and doctor recovery. Read the shared instructions, decisions, findings, sweep coverage, diagnosing loop, and earlier deep-scan reports; the findings below distinguish remaining defects from F38, F568 and F639. Skipped EPUB, highlight animation timing, live sites, native rendering/conversion accuracy, app/browser/device work, and already-covered web reanchoring. All writes are inside `codex-out/original/`; no production code or registry rows were changed.

## Reproduction and results

Eight primary cases reproduced **3/3 each: 24 expected assertion failures in 24 runs**. Commands below run from the repository root. Full output is in `logs/confirm-<script-name>-1.log` through `-3.log`; timing and exit results are in [confirmation.json](confirmation.json). The longest confirmation used 477 ms CPU. [confirm.py](confirm.py) runs the cases sequentially with a 20-second CPU limit and 25-second wall limit. Each script recreates only its own scratch library. `harness.ts` disables enrichment, blocks unexpected network access, stubs thumbnails, and supplies fail-closed fake AI executables. Explicit fetch replacements serve deterministic in-memory fixtures. No real AI was called.

Output excerpts below omit assertion stack traces and, where noted, long text. Initial exploratory logs are retained; the confirmation logs are the final reproducible cases.

## Findings

### original-01 — Doctor can combine two versions while repairing an interrupted Undo

**S1 — inconsistent source data. Mac; shared core data would also affect synced readers. Remaining defect in F639 / #538.**

**Red command:**

```sh
ORE_NO_ENRICH=1 bun codex-out/original/recovery-version.ts
```

Output excerpt (generated stash and item identifiers abbreviated):

```text
[DEEP] before {"recovery":"<step>.swap","currentOriginal":"Topic,Answer\nSpacing,Wait one day\n"}
[DEEP] after {"fixed":["<item>: restored doc.md from an interrupted reimport"],"issues":[],"body":"| Topic | Answer |\n| --- | --- |\n| Spacing | Wait seven days |\n","original":"Topic,Answer\nSpacing,Wait one day\n","consistent":false}
AssertionError: Doctor recovery must restore doc.md and the original from the same version
```

**Minimal steps:** Import CSV version 1; reimport version 2. Construct the durable state left by the old Undo after it copied version 1's original but before it restored `doc.md`: canonical original is v1, canonical document is missing, and `.swap` contains v2's document and original. Run `doctor({fix:true})`.

**Expected / actual:** Repair selects one complete version and restores its matching document/original pair. Instead it restores the v2 document, leaves the v1 original, reports success, and reports no issues. The next reimport can revert the displayed material to v1. Both versions remain in stashes, so this is inconsistent canonical data, not proof of irreversible destruction. Violates D122's retained-original purpose.

**Ranked hypotheses and probes:** (1) Existing-file guard leaves a different original in place; (2) recovery chooses the wrong stash; (3) CSV parsing changes the content. The probe logs the selected v2 `.swap` and both versions. Running the same script with `--missing-original` passes: removing only the preexisting v1 original makes recovery restore the consistent v2 pair. Parsing and stash selection are therefore not the cause.

**Cause:** `packages/core/src/ingest/index.ts:861` copies recovered non-document files only if absent; line 862 restores the document regardless. `packages/core/src/doctor.ts:77–82` then records the repair. This is the recovery path added for F639. The script models the real pre-#538 `swapFiles` ordering, inspected at commit `0f24ee6`, lines 819–825. It does **not** claim that current Undo still removes the canonical document, or that a current process was killed to obtain this state.

**Runs:** 3/3 red; `logs/recovery-control.log` is the passing missing-original control.

### original-02 — A valid PowerPoint notes relationship loses notes and their highlights

**S1 — content and annotation loss on reimport. Mac import/reimport; shared content affects both clients.**

**Red command:**

```sh
ORE_NO_ENRICH=1 bun codex-out/original/slides-reimport.ts
```

```text
[DEEP] slides-reimport {"targetBefore":"../notesSlides/notesSlide1.xml","targetAfter":"/ppt/notesSlides/notesSlide1.xml","targetEntryPresent":true,"notesPartBytes":1263,"changed":true,"removed":[{"exact":"Start with the cocktail party example.","note":"My reminder about selective attention."}],"notesRemain":false,"highlightRemains":false}
[DEEP] undo {"highlightRestored":true,"notesRestored":true}
AssertionError: Reimport of equivalent PowerPoint relationships must preserve a highlight and its note on speaker notes
```

**Minimal steps:** Import the real `files/deck.pptx` intake fixture. Highlight a speaker-note sentence and attach a learner note. In the scratch kept original, change just one relationship target from a relative path to the equivalent package-root path; retain the actual notes XML unchanged. Reimport.

**Expected / actual:** Equivalent relationship addressing should yield the same notes and preserve the highlight. Instead the notes disappear and reimport deletes the ordinary highlight, including its attached note. Undo restores them. The script deliberately changes relationship syntax in the scratch original to isolate the parser; it does not simulate a shipped reader upgrade. `slides-notes.ts` separately demonstrates the same omission on first import of that equivalent file. This breaks D122's requirement to bring documents in whole.

**Ranked hypotheses and probes:** (1) Package-root target is joined as a relative path; (2) notes-body filtering rejects the text; (3) repacking changes the actual notes. `relationship-probes.ts` shows the importer looks for nonexistent `ppt/slides/ppt/notesSlides/notesSlide1.xml`; the unchanged notes are at `ppt/notesSlides/notesSlide1.xml`. The installed OOXML URI resolver (`packages/core/node_modules/mammoth/lib/docx/uris.js:5–6`) handles a leading slash as package-root addressing. Repacking with `--relative` preserves the notes and highlight and reports no content change. Notes bytes are unchanged in both variants.

**Cause:** `packages/core/src/ingest/office.ts:93–97`, especially line 96, joins the slide directory to the root-qualified target. Its missing-entry reader returns empty text. `packages/core/src/ingest/index.ts:1033–1036` subsequently treats the lost notes as orphaned ordinary highlights and deletes them.

**Runs:** 3/3 red; `logs/slides-reimport-control.log` passes with `--relative`.

### original-03 — The kept HTML original changes encoding without changing its declaration

**S1 — corrupt retained original; normalized reading text remains correct. Mac import, shared stored file.**

**Red command:**

```sh
ORE_NO_ENRICH=1 bun codex-out/original/original-charset.ts
```

```text
[DEEP] original-charset {"originalTitle":"日本の文学","importedTitle":"日本の文学","keptDeclaration":"Shift_JIS","keptTitleWhenDecodedAsDeclared":"譌･譛ｬ縺ｮ譁�ｭｦ","identicalBytes":false,"reimportChanged":false}
AssertionError: The kept HTML original must remain readable in its own declared encoding
```

**Minimal steps:** Import local Shift_JIS HTML declaring that encoding. Read the kept `source.html` using the encoding it still declares.

**Expected / actual:** D122 and the source-file contract require a usable preserved original. The saved file contains UTF-8 bytes but still declares Shift_JIS; its title and body decode incorrectly under that declaration. The normalized document is correct, and an Ore reimport reports unchanged. This is distinct from the fixed F38 import-decoding bug: the damage is to the retained original. The probe checks the byte/declaration mismatch headlessly; it did not launch an external browser.

**Ranked hypotheses and probes:** (1) The importer stores decoded text instead of original bytes; (2) the general file writer corrupts all files; (3) duplicate handling selects another original. Each case uses a fresh library. `bytes-probes.ts` finds exact UTF-8 CSV and binary DOCX copies but altered UTF-16 CSV/Markdown and BOM-bearing notebook bytes. The declared-encoding test isolates a user-visible consequence rather than relying only on byte inequality. The correct initial document rules out failure to decode the input.

**Cause:** `packages/core/src/ingest/index.ts:210` decodes the bytes and line 233 passes that text into `pageDraft`; `packages/core/src/ingest/page.ts:58` retains the HTML string as the original. `packages/core/src/items.ts:210` writes that string as UTF-8 without updating the original charset declaration. Other text branches at `ingest/index.ts:213–227` also retain decoded or transformed text, not input bytes.

**Runs:** 3/3 red. Supporting byte probes: UTF-16 CSV 56→28 bytes; UTF-16 Markdown 74→37; BOM notebook 742→739; DOCX 37,067→37,067 exact. Subtitle conversion also changes the kept bytes/extension; no separate subtitle-content defect is claimed.

### original-04 — Clicking a PDF paragraph marks text from the neighboring column

**S2 — false passage marking in everyday multicolumn PDFs. Mac OriginalPage.**

**Red command:**

```sh
ORE_NO_ENRICH=1 bun codex-out/original/passage-columns.ts
```

Output excerpt:

```text
[DEEP] column-match ... "result":[0,6],"marked":"Spread your retrieval practice across several different days.   Unrelated weather station records. Retrieve the important idea before reading the explanation.   Storms arrived on Tuesday evening. Wait a little longer after giving a completely correct answer."
AssertionError: Clicking the left-column passage must never mark unrelated words in the right column (D315)
```

**Minimal steps:** Open the real, generated one-page two-column PDF in `libs/passage-columns/columns.pdf` with Ore's PDF helper. Its content stream alternates left and right lines. Import with fixed layout regions: the left column becomes one actual document paragraph. Pass that paragraph and the page's actual pdfjs text runs to `passage`, then apply OriginalPage's inclusive slice.

**Expected / actual:** Clicking the left paragraph should mark its words only, or decline an unsafe match. The returned range includes two unrelated right-column sentences. This violates D315's passage matching behavior. The PDF uses ordinary text operators and real coordinates; this is not a fabricated text-run array. Layout regions are supplied deterministically without AI. The exact headless function and slice used by the screen establish the faulty selection; no rendered screenshot is claimed.

**Ranked hypotheses and probes:** (1) Matching assumes text runs between the endpoints belong to the passage; (2) coordinates are wrong; (3) import merges columns. The script asserts the actual imported left paragraph is a separate block. `--grouped` changes only content-stream ordering, retaining the same words, positions and regions; it returns `[0,2]`, marks only the left words, and passes. The cause is the contiguous-run assumption, not geometry or document extraction.

**Cause:** `apps/desktop/src/original-match.ts:24–43` finds endpoint matches and returns a contiguous range; `apps/desktop/src/OriginalPage.tsx:109` marks every run in that range. Endpoint matching cannot exclude intervening text in another column.

**Runs:** 3/3 red; `logs/passage-columns-control.log` passes with `--grouped`. Existing matcher tests also pass (4 tests, 12 assertions), showing this case is not guarded. Supplementary `passage-ambiguity.ts` finds that querying two copies of a sentence against three identical runs can mark all three; kept as evidence of the same matcher weakness, not a separate finding.

### original-05 — “Add the file again” does not repair a missing original

**S2 — the offered recovery action cannot restore reimport. Mac import/reimport.**

**Red command:**

```sh
ORE_NO_ENRICH=1 bun codex-out/original/readd-original.ts
```

```text
[DEEP] readd {"refusal":"The file it came from is no longer kept beside this source, so there is nothing to read again. Add the file again to read it fresh.","kept":true,"restored":false,"sameId":true,"originalKept":false,"canReimport":false,"archived":false}
AssertionError: Following Add the file again must restore a usable kept original
```

**Minimal steps:** Import `files/notes.docx`. Remove only its kept original in the scratch library. Attempt reimport, then follow the error's instruction by adding the intact input file again.

**Expected / actual:** Adding the intact original should restore a usable original or produce a working fresh source. Deduplication instead returns the old item without replacing its missing original. Reimport remains unavailable. The error text fixed by F5 exists, but its prescribed recovery fails. D96 requires refusal with a usable next step; D122 requires the retained original.

**Ranked hypotheses and probes:** (1) Duplicate keep discards newly parsed original bytes; (2) the input cannot be parsed; (3) only archive restoration is faulty. Initial import succeeds. The same failure occurs with `--archived`, which reports the item restored while still lacking an original. `--archived --intact` passes, confirming normal archive restoration and isolating missing-file repair.

**Cause:** `packages/core/src/ingest/index.ts:577–582` takes the same-text duplicate path; `keep` at lines 610–625 updates the existing item without keeping `ready.source`. The recovery instruction is at line 931.

**Runs:** 3/3 red; archived variant also red (`logs/readd-archived.log`); intact archived control green (`logs/readd-intact.log`). No inbox-file deletion consequence is claimed.

### original-06 — A saved HTML original cannot resolve its retained figure

**S2 — opening the original loses a figure that Ore has retained. Mac Open original.**

**Red command:**

```sh
ORE_NO_ENRICH=1 bun codex-out/original/original-assets.ts
```

```text
[DEEP] original-assets {"htmlByteIdentical":true,"relativeImage":"figure.png","existsAtInput":true,"existsBesideOriginal":false,"normalizedAssetExists":true,"reimportPreservesDocImage":true}
AssertionError: Open original must resolve the saved HTML figure from the kept source folder (D122)
```

**Minimal steps:** Import the real `saved-lesson/lesson.html` fixture and its local `figure.png`. Resolve the kept HTML's unchanged relative image reference from the kept original's folder.

**Expected / actual:** The retained original should remain usable with its retained dependencies. Ore stores the figure under a hashed `assets/` name, but keeps HTML referencing `figure.png`, which does not exist beside `source.html`. The normal document's image and its reimport both work. This is distinct from fixed F568: it concerns opening the original, not loss of the normalized document's image.

**Ranked hypotheses and probes:** (1) Only document image references are rewritten; (2) the image is rejected or never downloaded; (3) HTML contents changed unexpectedly. The saved image exists, and the HTML is byte-identical to the input. `--copy-relative` copies the already-retained figure to the relative path required by that HTML and the assertion passes. File resolution establishes the broken dependency without launching a browser.

**Cause:** `packages/core/src/ingest/assets.ts:61–70` rewrites image links in `body` only. `packages/core/src/items.ts:210–213` writes the unmodified HTML original and hashed assets without maintaining its relative dependency paths. `apps/desktop/src/original.ts:38` opens that saved file directly. D122's original is incomplete as a usable saved page.

**Runs:** 3/3 red; `logs/original-assets-control.log` green with `--copy-relative`.

### original-07 — Doctor declares a library healthy when kept originals are missing

**S3 — missing diagnostic hides a broken reimport capability. Mac doctor/CLI.**

**Red command:**

```sh
ORE_NO_ENRICH=1 bun codex-out/original/doctor-original.ts
```

```text
[DEEP] missing-original {"before":[],"after":[],"fix":{"ok":true,"errors":0,"warnings":0,"issues":[],"fixed":[]},"reimportError":"The file it came from is no longer kept beside this source, so there is nothing to read again. Add the file again to read it fresh."}
AssertionError: Doctor must name the missing kept original and its recovery step
```

**Minimal steps:** Import a DOCX, run doctor, delete its kept original, run doctor again and with repair enabled, then attempt reimport.

**Expected / actual:** Doctor should name the missing original and recovery step; it cannot recreate unknown bytes. Instead it returns healthy with no warnings although reimport is broken. This is a detection defect separate from original-05's failed recovery action and D122's underlying missing-file state.

**Ranked hypotheses and probes:** (1) Doctor never checks originals; (2) a cached index conceals the deletion; (3) article type cannot distinguish imported documents from pasted text. `doctor-probes.ts` reproduces the omission with DOCX, PDF and PPTX after deleting `.index`; PDF has a distinct type. Missing `doc.md` is diagnosed, and a pasted-text item correctly passes without an original. The omission is in the filesystem scan, not an index artifact.

**Cause:** `packages/core/src/doctor.ts:71–112` checks for `doc.md`, validates metadata and annotations, but never checks that a required kept original exists.

**Runs:** 3/3 red; three additional document types/index-reset probes agree. Missing-document and pasted-text controls behave correctly.

### original-08 — Reimport misses orphaned highlights after an unindexed hand edit

**S3 — stale highlight and false reimport result. Mac reimport; shared annotations affect both clients.**

**Red command:**

```sh
ORE_NO_ENRICH=1 bun codex-out/original/reimport-handedit.ts
```

```text
[DEEP] handedit {"changed":true,"removed":0,"unplaced":0,"quoteInBody":false,"highlightStillListed":true,"anchor":null}
AssertionError: Reimport must report and remove an ordinary highlight whose hand-written passage it replaced (D93)
```

**Minimal steps:** Import CSV. Append a sentence directly to canonical `doc.md` without updating its stored body hash, then use core to highlight that sentence and attach a note. Reimport from the unchanged kept CSV before doctor refreshes the hash.

**Expected / actual:** Reimport intentionally replaces hand edits, but D93's ordinary-orphan handling should report and remove the now-unplaceable highlight. It instead reports zero removed/unplaced highlights and leaves a live annotation whose quote no longer exists. This finding concerns stale annotation handling, not the deliberate replacement of hand-edited text itself.

**Ranked hypotheses and probes:** (1) Reanchoring skips work because the new body matches the old stored hash; (2) the quote exists elsewhere; (3) the highlight was not captured correctly. The script confirms the quote is absent and direct anchoring returns null. With `--doctor`, repairing the body hash before reimport changes the result to one removed highlight and no live orphan. That isolates the stale-hash early return.

**Cause:** `packages/core/src/ingest/index.ts:1024–1033` preserves the stored pre-edit body hash while replacing the body; `packages/core/src/annotations.ts:222–224` immediately returns when the replacement body matches that old hash. It never evaluates annotations added against the actual edited body.

**Runs:** 3/3 red; `logs/reimport-handedit-control.log` passes with `--doctor`.

## Leads — not findings

- PowerPoint picture relationships use a similar relative join (`ingest/office.ts:129`); package-root image targets may also fail. No dedicated picture fixture/red loop was built, so the notes result is not generalized to images.
- Recovery selection orders candidate stashes and accepts a readable document; selection among multiple conflicting or partially complete candidates deserves a separate version-consistency test. Only the mixed-original/document case above is proven.

## What passed

- `original-matrix.ts`: PDF, DOCX, PPTX, RTF, XLSX, CSV, notebook, Markdown and subtitles kept a stable original name and stored bytes through rename, duplicate add, and archived re-add. Duplicates resolved to the same item; archived items were restored. This checks stability after import, not input byte identity for transformed textual formats.
- The same matrix preserved input bytes for seven of its nine fixtures; CSV and SRT changed. Encoding-specific probes above cover additional byte changes and the concrete HTML corruption consequence.
- A sparse 201 MB PDF was refused at the 200 MB intake limit, without creating a source or changing its input file.
- `media-originals.ts`: PNG, WAV, MP3 and M4A retained original bytes and reimported unchanged with deterministic OCR/transcription stubs. Native extraction accuracy was not tested.
- `reimport-records.ts`: ordinary CSV reimport moved a retained highlight, removed one genuinely lost highlight, preserved the retained learner note, preserved exercise-file bytes and review JSON, and preserved original bytes. Review time was pinned. Undo restored the prior document, manual introduction and annotations.
- `reimport-frontmatter.ts`: unknown frontmatter value and renamed title survived reimport and Undo. Semantic field preservation is checked; comment/formatting preservation is not claimed.
- `reimport-records.ts`: damaged PDF, DOCX and PPTX originals were refused with actionable messages, and the attempted reimport left all already-present source files unchanged.
- Missing originals produce an explicit reimport refusal before rewriting the document; original-05 covers why its next step fails.
- Local saved-HTML reimport kept its normalized image reference, confirming the F568 repair for the normal document.
- Shift_JIS HTML imports with correct Japanese title/body, confirming F38's decoding repair; original-03 concerns the saved file instead.
- Doctor detects a missing document as a stopped import; pasted text without a retained original remains healthy.
- F639 recovery restores a consistent pair when both canonical document and original are absent; it is the existing-original case in original-01 that fails.
- `bun test apps/desktop/test/original-match.test.ts`: 4 pass, 0 fail, 12 assertions. Matcher probes return no match for an absent passage or an empty scanned-page text layer.
- Plain local Markdown/text reimport exclusion and transcript-only retention for local video were read as explicit decisions/exceptions, not reported as missing-original defects.

No full suite, app, browser, server, watcher, benchmark, native simulator, live AI, or e2e journey was run. Native slide page-count and rendered highlight geometry remain outside this headless scout's verified coverage.
