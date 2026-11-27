# Original rows — draft fixes

## F684 — fixed (draft, awaiting Claude review)

Confirmed on the starting checkout by writing and running the core regression test first. A saved HTML page's figure was present in its input folder and in Ore's normalized reading assets, but there was no offline viewing copy. The shared Open original action also opened only `source_file`. This implements Tyler's 2026-11-27 choice; no new product rule is proposed.

### What changed

- `packages/core/src/original-view.ts`: builds `original-view.html`, with copied dependencies under `original-files/` and a raw-file map in `original-view.json`. HTML attributes, responsive image candidates, inline styles, linked stylesheets and their CSS dependencies point at local copies. Filenames are generated, so input names cannot overwrite `source.*`, `thumbnail.*`, `assets/`, or other Ore records. Both lexical paths and resolved symlinks must stay inside the page folder; external and missing references remain as written. Remote base URLs retain their meaning. Reimport uses captured dependencies, not files at the former input location. Dependencies are written first and viewing HTML is published by atomic rename. Old dependency files remain available for Undo; unchanged reimports reuse the view.
- `packages/core/src/items.ts`: carries and writes the derived view when creating a source; `sourceFile()` continues to identify the untouched original.
- `packages/core/src/ingest/index.ts`: captures the viewing copy on file add, rebuilds it on local saved-HTML reimport (also when the reading text is unchanged), includes its HTML and manifest in the existing Undo stash, and restores these files atomically. Adding the same captured bytes again can supply a legacy source's missing viewing files. Deduplication never substitutes a view from a different original that merely produced the same reading text.
- `packages/core/src/index.ts`: exports the core lookup for the viewing file.
- `packages/cli/src/cmd-items.ts`: returns an optional `original_view` in both list and reader answers; the app's existing inferred answer types carry it to both devices.
- `apps/desktop/src/original.ts`: the shared Open original action prefers the viewing copy for local sources. Web URLs retain precedence. Copy as Path and Reveal continue to use the captured original.
- `packages/core/test/original-view.test.ts`: the saved-figure regression and boundary/lifecycle cases below.
- `apps/desktop/test/original-view.test.ts`: headless shared-opener regression, with the native opener mocked in an isolated subprocess.
- `packages/core/test/intake.test.ts`: one added intake case, using the new Ore-authored fixture `packages/core/test/fixtures/intake/files/saved-lesson/offline.html` and the existing figure. Checks title, author, date, start/end text, heading, image, code, original bytes, and the viewing figure.
- `packages/core/test/intake-grid.test.ts`: the saved-HTML images cell now names that intake case. The earlier reimport-picture test remains unchanged.

No existing test assertion or test body was changed. Findings and decisions were not edited. No `doc.md` output change is intended: all 42 golden tests passed, so no golden update was run and no goldens changed.

**Durable fix:** the core now owns the captured original and its derived viewing bundle separately, including dependency preservation and Undo, and both devices consume the same viewing path.

### New tests

In `packages/core/test/original-view.test.ts`:

1. `F684: the offline original resolves its figure and preserves the captured bytes through reimport`
2. `F684: local names cannot overwrite Ore files and references outside the page folder stay as written`
3. `F684: stylesheets, nested CSS images, srcset and inline styles keep their local files offline`
4. `F684: reimport and Undo keep the matching viewing copy without changing the original`
5. `F684: reimporting an older saved page creates a view without refusing its missing adjacent files`
6. `F684: list and reader answers offer the viewing copy separately from the kept original`
7. `F684: unchanged reimports reuse the view and re-adding a legacy original supplies its files`
8. `F684: data srcsets, a remote base, CSS cycles and hostile destination paths stay safe`

In `packages/core/test/intake.test.ts`:

- `F684: a saved HTML page keeps an offline viewing copy as well as its complete reading text`

In `apps/desktop/test/original-view.test.ts`:

- `F684: Open original uses the offline copy, with the original and web link as fallbacks`

### Red and green evidence

Core red, before implementation (`codex-out/original/F684-red.log`):

```text
expect(existsSync(path)).toBe(true);
Expected: true
Received: false
 0 pass
 5 fail
 8 expect() calls
Ran 5 tests across 1 file. [295.00ms]
```

Shared-opener red, before implementation (`codex-out/original/F684-app-red.log`):

```text
-     "/source/original-view.html",
+     "/source/source.html",
 0 pass
 1 fail
 3 expect() calls
Ran 1 test across 1 file. [18.00ms]
```

Core green, with the additional boundary cases (`codex-out/original/F684-core-green.log`):

```text
 8 pass
 0 fail
 71 expect() calls
Ran 8 tests across 1 file. [536.00ms]
```

Shared-opener green (`codex-out/original/F684-app-green.log`):

```text
 1 pass
 0 fail
 3 expect() calls
Ran 1 test across 1 file. [16.00ms]
```

Intake regression green (`codex-out/original/F684-intake-green.log`):

```text
 1 pass
 193 filtered out
 0 fail
 11 expect() calls
Ran 1 test across 1 file. [153.00ms]
```

### Existing coverage and limits

Single-file runs passed: ingest (16), reimport (18), reimport-interruption (4), foundation (25), original-doctor (4), page-video (7), tables (16), intake-grid (2), golden (42), original-label (4), and phone-shims (6). Complete outputs are in `codex-out/original/<file-name>.log`.

Two existing single-file checks were not green; neither failure was retried or hidden:

- `intake.test.ts`: 193 pass, 1 fail. `a very tall or very wide screenshot is read whole, each line once (F188)` failed with `Found no text in that image`. The native OCR path at `packages/core/src/ingest/ocr.ts:73` is unchanged; the new viewing-copy branch runs only for HTML. This run does not establish why the native recognizer returned no text.
- `cli-contract.test.ts`: 12 pass, 1 fail. `an inbox import where every link fails exits non-zero and keeps them` failed at the existing `Bun.serve({ port: 0, ... })` setup with `EADDRINUSE`, before it exercised import. The listener was unavailable in this environment.

The offline bundle follows static HTML and CSS file references; it does not execute JavaScript to discover dynamically requested resources. Older sources cannot recover files that were never retained: their original remains usable as before, and re-adding the original with its adjacent files supplies the bundle. Dependency files are retained like reading assets so Undo can still resolve them.

Interaction/security review: the existing list, Reader menu, and keyboard Open original paths all call the same helper. No visible controls were added or removed. The opener test verifies viewing-copy preference, original fallback, URL precedence, and unchanged Copy as Path. Path traversal, symlink escape, reserved-name collisions, and a hostile destination symlink have core guards. Per the task, no browser, app, simulator, development server, e2e, or benchmark was launched. Some existing required unit tests attempt local test listeners; the failed listener is recorded above. The design hook's responsive-image fixture warning was addressed by adding a real fallback `src`; no suppression or standing design finding remains.

Changes are left uncommitted in this worktree as requested. No background process is intentionally retained.

## Final checks

- `bun run typecheck` — run once, passed (exit 0). Log: `codex-out/original/final-typecheck.log`.
- `bun test packages/core/test apps/desktop/test` — run once, exit 1: **2,153 passed, 3 failed**, 2,156 tests across 274 files in 125.14 seconds. All **10 new F684 tests passed** in this combined run. Log: `codex-out/original/final-tests.log`.

```text
3 tests failed:
(fail) import coverage: text recognition > a very tall or very wide screenshot is read whole, each line once (F188) [98.70ms]
(fail) the CLI as an agent drives it > an inbox import where every link fails exits non-zero and keeps them [11.94ms]
(fail) cancelling an add > SIGTERM after the source is written takes it back out [11.48ms]

 2153 pass
 3 fail
 10061328 expect() calls
Ran 2156 tests across 274 files. [125.14s]
```

The OCR and CLI failures are the same ones described above. The third failure is also an existing test listener: `packages/core/test/cancel.test.ts:16` throws `EADDRINUSE` at `Bun.serve`, before add or cancellation runs. All three are also recorded in the earlier pass's `docs/reviews/2026-11-25-codex-deep-scan-5/FIX-NOTES-original.md`, under Final checks. None was rerun, skipped, or edited. The full suite is **not green** in this environment. `git diff --check` passed. All tool-managed commands finished; no persistent task process was started.
