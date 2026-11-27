# Editor open rows — draft fixes

Worktree: `/Users/tylerpoelking/Developer/ore-wt/rows-editor`.

Result: **F6 and F547 fixed in this draft; F1 and F548 skipped**. Findings and decisions files were not edited. No existing test was edited. No commits, pushes, browser, app, development server, e2e, or bench were started. The required full suite itself attempted local test servers; two failed to bind, as recorded below. All checks were headless. Visual and native interaction checks remain for the reviewing Claude; this is a draft, not a shipped change.

Full command output and runnable reproductions are under `codex-out/editor/` (ignored by Git, present in this worktree). The reports below are in the requested order.

## F1 — skipped: confirmed, but no durable history-preserving update drafted

The actual `NoteBody`/Milkdown reproduction is `codex-out/editor/f1-red.ts`. Run `bun codex-out/editor/f1-red.ts`. It types in the live editor, passes outside text through a new notes version, and asks the new editor to undo. It captures the real ProseMirror view by instrumenting its `someProp` method; it does not substitute an editor implementation.

Red output (`codex-out/editor/f1-red.log`, exit 1):

```text
remounted: true,
undone: false,
text: "Typed My sentence.Outside paragraph."
AssertionError: F1: an outside update must preserve the note's typing undo history
false !== true
```

Cause and ownership:

- `useNotes.apply` in `apps/desktop/src/Notes.tsx` clears the pull reader and increments `version`; `NoteBody` uses that version as the editor's React key. React destroys the old editor and its history.
- Merely dropping the key cannot fix it. `apps/desktop/src/editor/NoteEditor.tsx` creates its editor once, captures `original` and `base` inside that effect, and never ingests later text props. Those snapshots also drive `keepUnedited` and the synchronous pull reader.
- A single replacement transaction with `addToHistory: false` also fails. `codex-out/editor/f1-transaction-probe.ts` applies outside edits before and after an unchanged, locally edited paragraph. Undo returns true, but the locally typed words remain: the replacement has mapped their history away. Its output is saved in `f1-transaction-probe.log`:

```text
undone: true,
text: "Outside before.Typed My sentence.Outside after."
```

What the durable fix would take: an editor-owned update path that produces separate, schema-valid ProseMirror edits around unchanged content, maps selection and undo/redo through them, and refreshes the original/serialized Markdown snapshots together. It also needs to account for typing during asynchronous saves and Milkdown's delayed update callback, rather than treating every text prop as a new outside version. Tests should cover separated changes, formatting/node changes, pending typing, redo, switching notes, and byte-identical untouched Markdown. The bundled `prosemirror-changeset` is not an automatic answer: its default comparison ignores marks/attributes, merges short unchanged spans, and collapses large changes into replacements.

Changed files: only the two reproduction scripts and their logs. No production note code changed. New permanent regression test: none; the deliberate red reproducer remains outside the test suite. Green output: not applicable to a skipped fix. Existing editor baseline: `bun test apps/desktop/test/editor.test.ts` → **21 pass, 0 fail**, 76 assertions (`editor-baseline.log`).

Durability: left open rather than retaining an Undo entry that silently fails to undo the user's text. No decision or data-format change is proposed.

## F6 — fixed: one Markdown map in core, shared with the reader

Confirmed mismatch: the reader maps shown `Tom & Jerry` to `Tom &amp; Jerry`; core `locate` returned null. A phrase spanning a Markdown link also failed in core. A separate reader regression selects `. Second` at offset 8 instead of `Second.` at offset 10 after an emoji.

Changed files:

- `packages/core/src/text-map.ts`: the existing pure Markdown/shown-text implementation moved out of the app, with its source offsets, entity lengths, code handling, math placeholders, and passage text helper. No DOM or platform imports. `plainSkeleton` also accepts code context, using the same character policy as the DOM index.
- `apps/desktop/src/text.ts`: imports/re-exports the core map and retains only DOM operations and reader chunk/footnote helpers. Selection offsets now measure the normalized string in UTF-16 units, just like DOM offsets and the map; the old code-point loop undercounted emoji.
- `packages/core/src/anchoring.ts`: uses the shared map for non-exact creation lookups, retaining the exact-source fast path. Entity/formula end positions consume their whole source spelling. Copied code without a fence retains literal punctuation; supplied TeX is checked against the actual formula, not just its placeholder.
- `packages/core/package.json`, `apps/desktop/package.json`, `bun.lock`: move the already-installed `decode-named-character-reference` **1.3.0** dependency from desktop to core. No version change or new package. Frozen-lockfile install passed using a temporary cache directory; initial attempts hit the sandbox cache restriction and a network resolution failure, before the successful frozen-lockfile install (`f6-install.log`).
- `packages/core/test/anchor-shown-text.test.ts` and `apps/desktop/test/anchor-reader.test.ts`: new guards.

New tests in `packages/core/test/anchor-shown-text.test.ts`:

1. `rendered text locates links and whole character references in Markdown (F6)`
2. `raw source quotes still locate old data, including image alt text and link destinations (F6)`
3. `a copied code passage keeps its punctuation when whitespace differs (F6)`
4. `a formula's placeholder cannot make a different formula match (F6)`

New tests in `apps/desktop/test/anchor-reader.test.ts`:

1. `core locates the same shown passage as the reader across links and entities (F6)`
2. `a selection after an emoji uses the same offsets as the shown-text map (F6)`

Red output before the fix:

```text
# f6-red.log — reader/core test
Expected: { "end": 15, "start": 0 }
Received: null
0 pass
1 fail
2 expect() calls

# f6-core-red.log — core tests
1 pass
1 fail
5 expect() calls

# f6-emoji-red.log — before replacing the original DOM offset loop
Expected: { "exact": "Second.", "start": 10 }
Received: { "exact": ". Second", "start": 8 }
1 pass
1 fail
16 expect() calls
```

The first shared-map draft exposed two additional compatibility issues. Their failing outputs are retained in `f6-code-red.log` (copied code returned null) and `f6-math-red.log` (a minus formula matched an earlier plus formula). These are draft regressions, not claims about new bugs at master; both were corrected before final verification.

Green output:

```text
# bun test packages/core/test/anchor-shown-text.test.ts — f6-core-green.log
4 pass
0 fail
12 expect() calls

# bun test apps/desktop/test/anchor-reader.test.ts — f6-green.log
2 pass
0 fail
17 expect() calls
```

Existing files covering the affected mapping/anchoring code, each run separately (full logs `codex-out/editor/f6-<filename>.log`):

| Test file | Passed | Failed |
| --- | ---: | ---: |
| `packages/core/test/anchoring.test.ts` | 13 | 0 |
| `packages/core/test/annotations.test.ts` | 14 | 0 |
| `packages/core/test/reimport.test.ts` | 18 | 0 |
| `apps/desktop/test/highlight-map.test.ts` | 75 | 0 |
| `apps/desktop/test/footnotes.test.ts` | 2 | 0 |
| `apps/desktop/test/math.test.ts` | 1 | 0 |
| `apps/desktop/test/text-pages.test.ts` | 4 | 0 |
| `apps/desktop/test/transcript.test.ts` | 4 | 0 |

Durability: core creation and both devices' reader now share the same Markdown interpretation and character normalization; existing raw quotes and stored-selector reanchoring retain their paths. No library files are rewritten. No intake or `doc.md` output changes, so no golden update was required or run.

## F547 — fixed: keyboard entry selects and reveals the current source row

The shared source-list element lives in `apps/desktop/src/App.tsx`, used for All sources and skill-page source lists; there is no separate SourceList component to fix. `currentLine` already resolves the last cursor, its surviving neighbour, or the first row. The missing part was activating it on focus entry. The phone does not have a duplicated desktop Tab-selection handler.

Changed files: `apps/desktop/src/App.tsx`, `apps/desktop/test/list-entry-focus.test.tsx`.

The new focus handler sets keyboard selection, records the current row, and scrolls it into view immediately. It checks the existing `data-keys` input mode and acts only when the list itself receives focus. Pointer focus, focus bubbling from row controls, and empty lists remain unchanged. No new screen element or style was added or removed.

New tests in `apps/desktop/test/list-entry-focus.test.tsx`:

1. `Tab entering a source list makes its first or last-current row visible and current (F547)`
2. `pointer entry, child controls and an empty source list do not select a row (F547)`

The headless harness extracts and renders the real list's opening JSX, including its handlers, rather than copying the proposed handler. It follows the existing `focus-reload.test.ts` approach to isolate App behavior without booting the app.

Red output (`f547-red.log`):

```text
Expected: "row-first"
Received: null
1 pass
1 fail
10 expect() calls
```

Green output (`f547-green.log`):

```text
2 pass
0 fail
15 expect() calls
Ran 2 tests across 1 file.
```

Existing tests each run separately, all green, with full logs in `codex-out/editor/f547-<filename>.log`: `lines` (2), `input-mode` (4), `focus-reload` (3), `focus-ring` (1), `course-filters` (3), `course-add-undo` (3), `glide` (4), `impeccable-round-9` (9), `hints` (10), `one-name` (2), `phone-waiting-undo` (2), `pick-bar` (4), `undo-waits` (1), `source-filters` (10), `shell-menu` (3), `waits` (3). All under `apps/desktop/test/`, with their existing `.test.ts` or `.test.tsx` extensions.

Durability: focus entry is handled once on the shared list, using its existing cursor resolution and input mode, rather than simulating an arrow key or fixing one list view.

## F548 — skipped: existing tests explicitly require these exceptions

Confirmed at master with `bun codex-out/editor/f548-red.ts`. The native title is on the icon cell button in `IconPicker.tsx` and the timestamp span in `Reader.tsx`.

Red output (`f548-red.log`, exit 1):

```text
actual: [
  { file: 'IconPicker.tsx', line: 130 },
  { file: 'Reader.tsx', line: 175 }
]
expected: []
AssertionError: F548: icon cells and transcript timestamps still use native title hints
```

There already is a native-title guard in `apps/desktop/test/hints.test.ts`: `no control explains itself with a native title=`. Its `TITLE_OK` list explicitly permits the icon grid and transcript timestamps because they can mount hundreds/thousands of controls. A second guard, `the list holds only icon-only buttons with no hint`, requires the icon grid's `ICON_ONLY_OK` exception to remain live. The tests reject stale exceptions, so replacing both controls with Hint necessarily requires changing existing tests.

This pass explicitly says: **“Never edit an existing test to fit your fix. If one must change, it is a behaviour change: stop and explain in your notes instead.”** I therefore left both controls and the existing tests unchanged. The reviewer needs to resolve those recorded performance exceptions before replacing the titles. A durable follow-up should establish acceptable Hint mounting cost (or a shared/delegated hint design), replace the native titles, and deliberately remove the obsolete exceptions. No browser or bench was run to infer performance here.

Changed files: only `codex-out/editor/f548-red.ts` and its log. New permanent test: none; the requested guard already exists. Green output for a fix: not applicable. The existing `hints.test.ts` run passed **10 tests, 0 failures**, 12 assertions, and is saved in `f547-hints.test.ts.log`.

Durability: kept the known exception explicit rather than weakening its tests or hiding a native title from the scan.

## Final checks

`bun run typecheck` — run once, **passed**, exit 0. Log: `codex-out/editor/final-typecheck.log`.

```text
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
```

`bun test packages/core/test apps/desktop/test` — run once, **failed**, exit 1. Log: `codex-out/editor/final-tests.log`.

```text
2151 pass
3 fail
10061287 expect() calls
Ran 2154 tests across 275 files. [125.03s]
```

All eight newly added tests passed in the full run. Three existing tests failed:

| Existing test | Evidence | Where to investigate |
| --- | --- | --- |
| `packages/core/test/intake.test.ts:1510` — `a very tall or very wide screenshot is read whole, each line once (F188)` | `tall.png` fails at line 1514 with `Found no text in that image. Add a screenshot with text, or paste what you need.` | The test removes its OCR stand-in and invokes native macOS Vision. `scannedText` in `packages/core/src/ingest/ocr.ts:73` received fewer than 20 non-whitespace characters. The underlying reason is **not established**; no claim that this is a flaky test or proven baseline failure. |
| `packages/core/test/cli-contract.test.ts:52` — `an inbox import where every link fails exits non-zero and keeps them` | `Bun.serve({ port: 0, ... })` throws `EADDRINUSE`, `Failed to start server. Is port 0 in use?`, at line 54, before the test's CLI operation. | Local listener availability in this execution environment. No test server successfully started for this case. |
| `packages/core/test/cancel.test.ts:11` — `SIGTERM after the source is written takes it back out` | The same `Bun.serve` bind failure at line 16, before the cancellation scenario. | Local listener availability in this execution environment. No test server successfully started for this case. |

These failures need reviewer triage; their causes were not established by retries, and no test was rerun, skipped, weakened or edited to obtain green. The intake/native-OCR and local-server code paths are outside the changed files. As requested, no findings row was added here; the reviewing Claude owns findings/decision edits. **The full suite is not green; this draft is not ready to merge on the strength of this run.**

`git diff --check` — passed. Verified the moved Markdown parser against the original: only its exports and shared plain-text normalization changed during the move. No `doc.md` or golden files changed. All commands have completed; no process from this pass was left running.
