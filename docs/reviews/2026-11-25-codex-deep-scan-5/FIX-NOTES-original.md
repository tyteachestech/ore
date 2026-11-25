# Deep scan 5 — original fix notes

Base checkout: `64cb72e4e2efe7e81cd575a679234583e6dff6e9`. Bun 1.4.4. Seven fixes drafted; original-06 skipped for a storage decision. No commits or pushes. No findings or decisions registry edits. Existing test assertions were left unchanged; the intake-grid edits only point cells to new guards.

Read CLAUDE.md, the relevant decisions (D93, D96, D122, D315), SPEC, WORKFLOW, daily-session guidance, and desktop instructions. No browser, app, development server, e2e or benchmark was launched. Two existing unit tests attempted their own loopback servers and failed to bind. All tool-managed test sessions completed; no persistent process was launched. A final process-list check was denied by the sandbox (`ps: operation not permitted`), so an independent system-wide process audit was unavailable.

The supplied scripts expect `codex-out/original/` and relative imports from there. They were copied there unchanged from `docs/reviews/2026-11-25-codex-deep-scan-5/red/original/`. Each primary red script was run before its corresponding fix, in report order. Full red/green and coverage logs remain in the ignored `codex-out/original/logs/`; the evidence below is self-contained. All scripts use scratch libraries.

## original-01 — fixed: Recovery restores one version

Changed files: packages/core/src/ingest/index.ts; packages/core/test/reimport-interruption.test.ts. Fixture paths above are under `packages/core/test/`; provenance is in `packages/core/test/fixtures/intake/files/original-fixtures.md`.

New guard: **Doctor restores the saved original with its document after a partially copied Undo**, in `packages/core/test/reimport-interruption.test.ts`.

Reproduction: `ORE_NO_ENRICH=1 bun codex-out/original/recovery-version.ts` failed before the fix:

```text

AssertionError: Doctor recovery must restore doc.md and the original from the same version

```

New-test red output (last lines):

```text

 3 pass
 1 fail
 7 expect() calls
Ran 4 tests across 1 file. [220.00ms]

```

Green output (last lines):

```text

 4 pass
 0 fail
 7 expect() calls
Ran 4 tests across 1 file. [178.00ms]

```

After the fix the same reproduction script exited 0 (`original-01-script-green.log`).

Durable fix: Recovery atomically replaces the originals supplied by the selected recovery stash before restoring its document, even when another version of an original already exists.

## original-02 — fixed: Package-root PowerPoint relationships

Changed files: packages/core/src/ingest/office.ts; packages/core/test/intake.test.ts; packages/core/test/intake-grid.test.ts; fixtures/intake/files/deck-root-notes.pptx and deck-root-pictures.pptx. Fixture paths above are under `packages/core/test/`; provenance is in `packages/core/test/fixtures/intake/files/original-fixtures.md`.

New guard: **PowerPoint: package-root notes preserve content and highlights on reimport; PowerPoint: package-root picture targets keep the same figures**, in `packages/core/test/intake.test.ts`.

Reproduction: `ORE_NO_ENRICH=1 bun codex-out/original/slides-reimport.ts` failed before the fix:

```text

AssertionError: Reimport of equivalent PowerPoint relationships must preserve a highlight and its note on speaker notes

```

New-test red output (last lines):

```text

 0 pass
 154 filtered out
 1 fail
 7 expect() calls
Ran 1 test across 1 file. [116.00ms]

```

Green output (last lines):

```text

 4 pass
 154 filtered out
 0 fail
 82 expect() calls
Ran 4 tests across 1 file. [434.00ms]

```

After the fix the same reproduction script exited 0 (`original-02-script-green.log`).

Durable fix: One package-target resolver handles root-qualified and relative paths for both notes and pictures; no reimport-specific annotation workaround is needed.

The picture-target guard was also run with the resolver reverted to its old relative join, then restored:

```text

 0 pass
 157 filtered out
 1 fail
 3 expect() calls
Ran 1 test across 1 file. [222.00ms]

```

Both root-qualified variants import identically to their existing relative fixtures. This changes the previously broken variant’s doc.md on purpose, preserving speaker notes and figures.

## original-03 — fixed: Keep original bytes

Changed files: packages/core/src/ingest/index.ts; packages/core/test/intake.test.ts; packages/core/test/intake-grid.test.ts; fixtures/intake/files/shift-jis.html, utf16.csv, utf16.md and bom-notebook.ipynb. Fixture paths above are under `packages/core/test/`; provenance is in `packages/core/test/fixtures/intake/files/original-fixtures.md`.

New guard: **text originals retain their input bytes and declared encoding**, in `packages/core/test/intake.test.ts`.

Reproduction: `ORE_NO_ENRICH=1 bun codex-out/original/original-charset.ts` failed before the fix:

```text

AssertionError: The kept HTML original must remain readable in its own declared encoding

```

New-test red output (last lines):

```text

 0 pass
 155 filtered out
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [122.00ms]

```

Green output (last lines):

```text

 4 pass
 154 filtered out
 0 fail
 82 expect() calls
Ran 4 tests across 1 file. [434.00ms]

```

After the fix the same reproduction script exited 0 (`original-03-script-green.log`).

Durable fix: The byte-based importer decodes only for extraction and retains the supplied bytes for HTML, Markdown, CSV/TSV, notebooks and subtitles. SRT now keeps source.srt; previously saved source.vtt still reads as before. Local video retains its explicit transcript-only exception.

## original-04 — fixed: Decline unsafe PDF passage matches

Changed files: apps/desktop/src/original-match.ts; apps/desktop/test/original-match.test.ts. Fixture paths above are under `packages/core/test/`; provenance is in `packages/core/test/fixtures/intake/files/original-fixtures.md`.

New guard: **interleaved PDF columns never mark the neighboring column; a passage repeated twice cannot select three copies on the page**, in `apps/desktop/test/original-match.test.ts`.

Reproduction: `ORE_NO_ENRICH=1 bun codex-out/original/passage-columns.ts` failed before the fix:

```text

AssertionError: Clicking the left-column passage must never mark unrelated words in the right column (D315)

```

New-test red output (last lines):

```text

 4 pass
 2 fail
 14 expect() calls
Ran 6 tests across 1 file. [11.00ms]

```

Green output (last lines):

```text

 6 pass
 0 fail
 15 expect() calls
Ran 6 tests across 1 file. [8.00ms]

```

After the fix the same reproduction script exited 0 (`original-04-script-green.log`).

Durable fix: The matcher verifies the complete normalized interval between its probes before returning endpoints. Interleaved unrelated words or excess repeated copies cannot be accepted as that interval. It returns null under D315 rather than marking an unsafe span.

## original-05 — fixed: Re-adding repairs a missing original

Changed files: packages/core/src/ingest/index.ts; packages/core/test/intake.test.ts; packages/core/test/intake-grid.test.ts. Fixture paths above are under `packages/core/test/`; provenance is in `packages/core/test/fixtures/intake/files/original-fixtures.md`.

New guard: **adding a file again repairs a missing original without replacing learning records**, in `packages/core/test/intake.test.ts`.

Reproduction: `ORE_NO_ENRICH=1 bun codex-out/original/readd-original.ts` failed before the fix:

```text

AssertionError: Following Add the file again must restore a usable kept original

```

New-test red output (last lines):

```text

 0 pass
 156 filtered out
 1 fail
 8 expect() calls
Ran 1 test across 1 file. [242.00ms]

```

Green output (last lines):

```text

 4 pass
 154 filtered out
 0 fail
 82 expect() calls
Ran 4 tests across 1 file. [434.00ms]

```

After the fix the same reproduction script exited 0 (`original-05-script-green.log`).

Durable fix: The shared duplicate-keep path uses the already parsed draft, rereads the source under the library lock, and restores an original only when absent and the current body still matches. Existing originals and learning records are not replaced; active and archived cases are guarded.

## original-06 — skipped: saved HTML dependency storage needs a choice

**Confirmed real** with `ORE_NO_ENRICH=1 bun codex-out/original/original-assets.ts` (exit 1).

```text

[DEEP] original-assets {"htmlByteIdentical":true,"relativeImage":"figure.png","existsAtInput":true,"existsBesideOriginal":false,"normalizedAssetExists":true,"reimportPreservesDocImage":true}

AssertionError: Open original must resolve the saved HTML figure from the kept source folder (D122)

```

D122 and SPEC §2 require a retained, unmodified original. The supplied simple figure could be copied next to source.html, but that is not a durable rule for saved HTML: valid references can contain ../, use an absolute/base URL, or collide with Ore-owned source/thumbnail/asset names. Silently rewriting the original would undo original-03, while allowing arbitrary dependency paths would write outside the source or overwrite its files. A complete solution needs a chosen storage/opening contract: for example, an isolated saved-page bundle or a derived offline viewing copy alongside byte-exact source.html. I would use a derived offline viewing copy while keeping source.html untouched; Tyler should choose that behavior before the storage/open-original change is drafted.

Changed files: none for this finding. New regression: none, since skipped. Red evidence is retained; no green result is claimed. This intentionally avoids a figure.png-only patch that would leave the same class of bug for other valid dependency paths.

## original-07 — fixed: Doctor names missing originals

Changed files: packages/core/src/doctor.ts; packages/core/test/original-doctor.test.ts. Fixture paths above are under `packages/core/test/`; provenance is in `packages/core/test/fixtures/intake/files/original-fixtures.md`.

New guard: **doctor reports a missing original for notes.docx / paper.pdf / deck.pptx without inventing a repair; doctor does not require an original for plain text or a pending transcript**, in `packages/core/test/original-doctor.test.ts`.

Reproduction: `ORE_NO_ENRICH=1 bun codex-out/original/doctor-original.ts` failed before the fix:

```text

AssertionError: Doctor must name the missing kept original and its recovery step

```

New-test red output (last lines):

```text

 1 pass
 3 fail
 7 expect() calls
Ran 4 tests across 1 file. [437.00ms]

```

Green output (last lines):

```text

 4 pass
 0 fail
 28 expect() calls
Ran 4 tests across 1 file. [393.00ms]

```

After the fix the same reproduction script exited 0 (`original-07-script-green.log`).

Durable fix: Doctor checks the canonical folder independently of its index and emits an actionable warning, including with --fix. It does not invent missing bytes. Plain text, snippets and deferred transcripts remain exempt; no new metadata or migration is introduced.

## original-08 — fixed: Reanchor after unindexed hand edits

Changed files: packages/core/src/ingest/index.ts; packages/core/test/reimport.test.ts. Fixture paths above are under `packages/core/test/`; provenance is in `packages/core/test/fixtures/intake/files/original-fixtures.md`.

New guard: **reimport reanchors highlights added after a hand edit with a stale body hash**, in `packages/core/test/reimport.test.ts`.

Reproduction: `ORE_NO_ENRICH=1 bun codex-out/original/reimport-handedit.ts` failed before the fix:

```text

AssertionError: Reimport must report and remove an ordinary highlight whose hand-written passage it replaced (D93)

```

New-test red output (last lines):

```text

 0 pass
 17 filtered out
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [104.00ms]

```

Green output (last lines):

```text

 18 pass
 0 fail
 105 expect() calls
Ran 18 tests across 1 file. [1.62s]

```

After the fix the same reproduction script exited 0 (`original-08-script-green.log`).

Durable fix: Reimport hashes the actual old document read under the write lock before replacing its body. A stale capture hash cannot suppress reanchoring. The guard checks removed ordinary highlights, retained unplaced questions, surviving highlights and Undo restoring the note.

## Existing coverage and goldens

Each affected existing file below ran as a single-file command, `bun test packages/core/test/<name>.test.ts`. The matcher file also passed separately (6 pass, 0 fail).

| File | Result |

| --- | --- |

| annotations.test.ts | 14 pass, 0 fail |

| cli-contract.test.ts | 10 pass, 1 fail |

| courses.test.ts | 10 pass, 0 fail |

| damaged-library.test.ts | 25 pass, 0 fail |

| eval-questions.test.ts | 6 pass, 0 fail |

| feeds.test.ts | 19 pass, 0 fail |

| finder-files.test.ts | 1 pass, 0 fail |

| foundation.test.ts | 25 pass, 0 fail |

| importance.test.ts | 11 pass, 0 fail |

| ingest.test.ts | 16 pass, 0 fail |

| intake-grid.test.ts | 2 pass, 0 fail |

| intake.test.ts | 157 pass, 1 fail |

| links.test.ts | 11 pass, 0 fail |

| original-doctor.test.ts | 4 pass, 0 fail |

| owed.test.ts | 3 pass, 0 fail |

| page-video.test.ts | 6 pass, 0 fail |

| reimport-interruption.test.ts | 4 pass, 0 fail |

| reimport.test.ts | 18 pass, 0 fail |

| study.test.ts | 23 pass, 0 fail |

| tables.test.ts | 15 pass, 0 fail |

| thumbnail.test.ts | 4 pass, 0 fail |

All four new intake cases pass together: 4 pass, 0 fail, 82 assertions. The full intake file still fails its existing native tall/wide screenshot OCR case. The existing CLI-contract inbox failure test cannot bind its local server (`EADDRINUSE`, port 0); it fails before exercising the import. Neither test was changed, retried to seek a pass, or disabled. Subsequent mandatory suite coverage may encounter them again.

The native OCR helper can convert a Vision request error into an empty result; the observed symptom is no recognized text. Its output does not establish whether Vision failed or recognized no words, so a sandbox/native-service cause is not asserted as proven. This remains a validation limitation for the reviewer, not a claimed fixed bug.

`bun run golden:update` completed: 27 pass, 0 fail, 27 assertions. **No existing golden files changed.** The normal PowerPoint fixture is unchanged; new relationship variants are compared against that same content. Encoding fixes preserve normalized text and change only the stored original. `git diff --check` passed.

## Final checks

Ran each final command exactly once, after the code and test changes. No test retries, skips or changed existing assertions were used to hide failures.

1. `bun run typecheck` — **exit 0**.

```text
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
```

2. `bun test packages/core/test apps/desktop/test` — **exit 1**. All 12 newly added test cases passed in this combined run. The three existing failures are:

- `intake.test.ts`: `a very tall or very wide screenshot is read whole, each line once (F188)` — native OCR returned no text; underlying cause unconfirmed.
- `cli-contract.test.ts`: `an inbox import where every link fails exits non-zero and keeps them` — `Bun.serve` failed with `EADDRINUSE` on port 0, before the import.
- `cancel.test.ts`: `SIGTERM after the source is written takes it back out` — the same port-0 listener failure, before the tested child was spawned.

These are validation blockers for review, not a green-suite claim. Full output: `codex-out/original/logs/final-typecheck.log` and `final-tests.log`. No existing goldens, findings registry, or decisions registry changed. The changes remain uncommitted in this worktree.

Final test output (last lines):

```text
 1828 pass
 3 fail
 10059551 expect() calls
Ran 1831 tests across 243 files. [102.94s]
```
