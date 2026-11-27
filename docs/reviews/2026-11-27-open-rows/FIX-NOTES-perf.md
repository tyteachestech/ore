# Perf fix drafts — 2026-11-27

Base: `89e8c8964503ea7685f597b7bb94e104801a9c4a`. Changes are uncommitted in this worktree for Claude's review. No existing test was edited. `findings.md` and `DECISIONS.md` are untouched. No import or `doc.md` output changed, so no intake fixtures or goldens changed.

No browser, native app, development server, e2e or benchmark was launched. The prescribed tests include existing HTTP-fixture tests; one such fixture failed to bind during the focused checks. No live library was used. The iOS and interaction-check skills were read; their browser/simulator, visual and gesture checks were not run, as this pass explicitly forbids them. No screen elements were added or removed: the video fix reuses the existing error overlay and Open on YouTube action.

## F294 — fixed (draft)

**Confirmed on master:** the regression executed the real Mac loader and shared archive action headlessly. One archive issued `ls` and `ls --archived`, instead of a single bounded read.

**Changed files:**
- `apps/desktop/src/change.ts`: optional source IDs carried with the change; show/write/inverse ordering is untouched.
- `apps/desktop/src/list-actions.ts`: shared source actions identify their rows, including batches and course lessons.
- `packages/cli/src/cmd-items.ts`: `ls --ids id,id` reads named rows, including archived ones, with the existing row serializer. Normal `ls` behavior stays intact.
- `apps/desktop/src/source-rows.ts`: shared merge replaces affected rows in both lists and handles unloaded lists.
- `apps/desktop/src/App.tsx`, `apps/desktop/src/phone/PhoneApp.tsx`: targeted reads after settled changes; overlapping, rejected or failed reads retain a full-refresh fallback. A stale read cannot change the newest read's fallback state. The phone finishes its Archive read within the same guarded read.
- `apps/desktop/test/source-refresh.test.ts`, `packages/core/test/source-list-reads.test.ts`: new guards.

**New tests:** `F294 Mac/iPhone: one archive reads one changed row; Undo and filing do the same`; `F294 Mac/iPhone: an overlapping full read still refreshes unrelated rows and cannot land late`; `F294 Mac/iPhone: a failed first write rolls back without a needless read` in `apps/desktop/test/source-refresh.test.ts`. `F294: targeted listing reads a changed archived row without reading unrelated sources` in `packages/core/test/source-list-reads.test.ts` counts actual file reads in an isolated CLI process.

**Red:** `codex-out/perf/F294-red.log` (initial single-archive test, subsequently expanded to both devices and the above scenarios):
```text
Expected: [["ls", "--ids", "a"]]
Received: [["ls"], ["ls", "--archived"]]
0 pass
1 fail
1 expect() calls
Ran 1 test across 1 file. [61.00ms]
```
**Green:** `codex-out/perf/F294-green.log`, covering the new app tests and existing `change.test.tsx`, `list-actions.test.tsx`, `focus-reload.test.ts`, `reads.test.ts`:
```text
45 pass
0 fail
203 expect() calls
Ran 45 tests across 5 files. [315.00ms]
```
The CLI file-read test also passed (`read-guards-green.log`, 5 pass / 0 fail across three files).

**Durable fix:** the shared action identifies the changed sources, the shared CLI reads those canonical rows, and both devices merge through one function; overlapping reads keep the original full-refresh safety.

## F727 — fixed (draft)

**Confirmed on master:** after reading a source's exercises once, filing that source still read an unrelated exercise file once. The isolated read probe failed expecting zero.

**Changed files:** `packages/core/src/cards.ts`, `packages/core/src/skills.ts`, `packages/core/src/cell.ts`, and new `packages/core/test/source-card-reads.test.ts`.

`listCards(lib, itemId)` now maintains `.index/cards-by-source.json`. It checks each card file's modification time, change time (where available) and size, parses only changed memberships, then reads the selected source's exercises. First use after a missing/invalid cache rebuilds it from the canonical files. Cache writes are atomic; a cache-write failure falls back to the parsed canonical data. No canonical file format changes. Duplicate selection and renamed-file support share the existing `listCards` rules. Scoped filing, its Undo snapshot, skill acceptance and table-cell duplicate checks use this path. Whole-library reads needed for other behavior (for example enrichment's cross-source skill context) remain whole-library reads.

The hint suggested the existing search index, but it intentionally scans only normally named ULID exercise files. Using it would omit valid hand-renamed files. This small separate disposable membership cache preserves the old reader's coverage. It still scans file metadata and reads the membership JSON on each lookup; it does not claim constant-time lookup or benchmark gains. Cold rebuilds must read all exercise files once.

**New tests:** `F727: a warm source filing does not read unrelated exercise files`; `source membership rebuilds and follows additions, hand edits, renamed files and duplicate winners`, both in `packages/core/test/source-card-reads.test.ts`. Checks include a same-length hand edit with restored mtime, a copy naming another source, a removed winner, corrupt JSON and deleted `.index`.

**Red:** `codex-out/perf/F727-red.log`:
```text
Expected length: 0
Received length: 1
0 pass
1 fail
4 expect() calls
Ran 1 test across 1 file. [109.00ms]
```
**Green:** `codex-out/perf/F727-green.log`, including existing filing, source-edit, interruption/retry and cell tests:
```text
13 pass
0 fail
56 expect() calls
Ran 13 tests across 5 files. [594.00ms]
```
Additional cache guards (`F727-cache-green.log`):
```text
2 pass
0 fail
14 expect() calls
Ran 2 tests across 1 file. [118.00ms]
```
Broader affected-file checks are in `core-covered-green.log` (despite the filename, this run was **not fully green**): 82 pass, 1 fail, 244 assertions across 13 files. The failure was `cli-contract.test.ts:54`, its unchanged `Bun.serve({ port: 0 })` HTTP fixture failing with `EADDRINUSE`, before its assertions. It was not retried as a focused test.

**Durable fix:** membership is derived from every file the canonical reader accepts and invalidated by file metadata, so a source-specific change no longer deserializes every unrelated exercise on a warm cache.

## F13 — skipped: reported missing pieces are already present

**Check script:** `codex-out/perf/F13-check.ts`. No production files changed for this finding and no failing regression was invented.

The script executes the current snapshot function against a disposable library containing YouTube `source.vtt` and audio `transcript.vtt`; both arrive intact. The core returns timed words for both. The phone imports the shared `Reader`, which imports `transcript.ts`. Current native code accepts `.vtt`, lists audio for the asset protocol, and implements `player_port` using the same relay page as the Mac. Relevant locations: `apps/desktop/vite.config.ts` (`snapshot`); `apps/phone/src-tauri/src/lib.rs` (`wanted`, asset scope and `player_port`); `apps/desktop/src/phone/PhoneApp.tsx`; `apps/desktop/src/Reader.tsx`; `packages/core/src/ingest/youtube.ts` (`transcriptOf`); `packages/core/src/ingest/index.ts` (`audioOf`).

**Output** (`codex-out/perf/F13-check.log`):
```text
F13 NOT REPRODUCED: snapshot keeps both VTTs; core returns timed video/audio words; phone uses shared Reader/transcript and has native player relay. Actual playback remains untested.
```
The browser snapshot keeps binary media as listed placeholders; the installed phone reads media through its native asset protocol. This check establishes the reported omissions are stale, not that playback or iCloud delivery works on a real phone today. Native playback needs a separate authorized device check. No new dependency or licensing change.

## F2 — fixed (draft), sustained buffering

**Confirmed on master:** a headless test sends real postMessage-shaped player-state events through the existing handshake effect. Playing followed by six seconds of buffering left `error` null.

**Changed files:** `apps/desktop/src/video-stall.ts`, `apps/desktop/src/Video.tsx`, `apps/desktop/test/video-stall.test.ts`.

A pure function detects five seconds continuously in YouTube's buffering state (3). Repeated state reports preserve the start; seeking restarts the wait; pause/end/play/cued states reset it. The handshake effect samples the state and cleans up its timer. Error -4 uses the existing video error overlay and existing YouTube action, says to check the connection, and clears on recovery. Real YouTube errors are never overwritten. This detects sustained buffering as requested; it does not infer a stall from a clock frozen while YouTube still reports playing.

**New tests:** `F2: sustained buffering after playback reports a stall and recovery clears it`; `buffering detection resets on seek, pause, end and a new buffering period`, in `apps/desktop/test/video-stall.test.ts`. The integration guard also checks timer cleanup and preservation of a real error.

**Red:** `codex-out/perf/F2-red.log`:
```text
Expected: -4
Received: null
0 pass
1 fail
3 expect() calls
Ran 1 test across 1 file. [12.00ms]
```
**Green:** `codex-out/perf/F2-green.log`, covering the new test and existing `video-resume`, `audio-seek`, `media-keys`, `scrub-sections`, `transcript` tests:
```text
23 pass
0 fail
67 expect() calls
Ran 23 tests across 6 files. [182.00ms]
```
**Durable fix:** the shared player detects YouTube's actual buffering state instead of trusting the app's extrapolated clock; both devices use the same detection and existing failure presentation.

## Final validation

Both prescribed commands ran exactly once, serially. All tracked command processes have exited. No retries, skips, existing-test edits or changes to unrelated code were made to make the checks pass.

**Typecheck:** `bun run typecheck`, exit **1**. Full output: `codex-out/perf/final-typecheck.log`.
```text
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
apps/desktop/src/App.tsx(356,46): error TS2345: Argument of type 'Item[] | null' is not assignable to parameter of type 'Item[]'.
apps/desktop/src/App.tsx(360,21): error TS2345: Argument of type 'Item[] | readonly []' is not assignable to parameter of type 'SetStateAction<Item[]>'.
apps/desktop/src/phone/PhoneApp.tsx(679,46): error TS2345: Argument of type 'Item[] | null' is not assignable to parameter of type 'Item[]'.
apps/desktop/src/phone/PhoneApp.tsx(680,49): error TS2345: Argument of type 'Item[] | null' is not assignable to parameter of type 'Item[]'.
error: script "typecheck" exited with code 1
```
These were introduced by this draft. Before the full test run, `mergeSourceRows` was corrected to accept unloaded (`null`) lists, and the Mac read tuple was explicitly typed `[Item[], Item[]]` instead of readonly. **Typecheck was not rerun**, honoring the one-run limit; those corrections still need compiler verification during review. The full tests below exercised the corrected code.

**Tests:** `bun test packages/core/test apps/desktop/test`, exit **1**. Full output: `codex-out/perf/final-tests.log`.
```text
3 tests failed:
(fail) import coverage: text recognition > a very tall or very wide screenshot is read whole, each line once (F188) [98.91ms]
(fail) the CLI as an agent drives it > an inbox import where every link fails exits non-zero and keeps them [12.72ms]
(fail) cancelling an add > SIGTERM after the source is written takes it back out [12.87ms]

2154 pass
3 fail
10061312 expect() calls
Ran 2157 tests across 276 files. [124.32s]
```
- `packages/core/test/intake.test.ts:1514`: `scannedText` threw “Found no text in that image.” This pass did not diagnose the OCR failure or change intake code. It is not claimed to be pre-existing or harmless.
- `packages/core/test/cli-contract.test.ts:54`: its existing HTTP fixture failed at `Bun.serve({ port: 0 })`, `EADDRINUSE`, before the test exercised the CLI.
- `packages/core/test/cancel.test.ts:16`: its HTTP fixture likewise failed at `Bun.serve`, `EADDRINUSE`, before the cancellation scenario. See the full log for the stack and line.

All **11 new regression tests passed in the full run**, as did the existing change, list-action, read-guard, source-filing, card, player and transcript tests. `git diff --check` passed. This is a reviewable draft, **not a fully green validation or shipping claim**: compiler re-verification, the three suite failures and the intentionally omitted native/visual checks remain for review.
