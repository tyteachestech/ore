# Feeds fixes — deep scan 5

Draft against worktree HEAD `06cba127611605f77279b483766f6eb57d45f681` (master snapshot), Bun 1.4.4. All ten findings reproduced and are fixed; none skipped. Changes remain uncommitted for Claude review.

## Scope and verification

- Read root CLAUDE.md, the named shared-module responsibilities, relevant spec/decisions (especially D107), daily-session.md, WORKFLOW.md and desktop rules. Used the diagnosing-bugs workflow and the existing report's probes/ranked causes.
- Processed findings in report order. Every permanent regression was red before its fix, with the original probe red and then green too. An additional mixed-state Undo guard was verified against the original HEAD action modules before restoring the draft.
- The checked-in red scripts still import from their former `codex-out/feeds` location. Copied them to `/tmp/ore-deep5-feeds`, changing only `../../packages/` and `../../apps/` imports to this worktree's absolute paths. Ran with `ORE_NO_ENRICH=1`; scratch libraries, fixtures and stubbed network/AI stayed in that temporary folder. No checked-in red script changed. Full command outputs remain in `/tmp/ore-deep5-feeds/logs`; durable excerpts follow here.
- Added 17 regression cases. No existing test assertion or expectation changed. Intake-grid additions are separate rows; the existing Feed row remains unchanged. Synthetic fixture provenance is in `packages/core/test/fixtures/intake/feeds/README.md`.
- No source `doc.md` output changes: these are inbox ownership, Feed metadata/cache and undo fixes. No goldens changed; `golden:update` was not needed.
- No findings/decision registry edits, commits, browser, app, server, e2e or benchmark runs. UI action checks are headless; no layout or controls changed. The explicit no-browser instruction supersedes screenshot/interactive checklist steps for this draft.

## feeds-01 — Queued sync-copy payload

**Fixed.** Keep capture directories while any live or undoable descriptor refers to them; delete only after the last reference. Unreadable descriptors conservatively retain bytes.

Changed files:

- `packages/core/src/inbox.ts`
- `packages/core/test/inbox.test.ts`

New tests in `packages/core/test/inbox.test.ts`:

- `removing a sync copy preserves a queued file's surviving descriptor (feeds-01)`
- `removing the original preserves a queued file's surviving descriptor (feeds-01)`
- `a removed sync copy keeps its payload for Undo when the live copy is consumed (feeds-01)`

Original probe: `state.ts inbox-copy` (each prefixed with `ORE_NO_ENRICH=1 bun /tmp/ore-deep5-feeds/`). All listed probes exited 1 before and 0 after. Red symptom:

```text
[DEEP] inbox-copy {"before":2,"after":0,"originalEntry":true,"payload":false}
AssertionError: removing a sync copy must preserve the still-queued original payload
```

Regression command: `bun test packages/core/test/inbox.test.ts`. Red last lines:

```text

 5 pass
 3 fail
 40 expect() calls
Ran 8 tests across 1 file. [121.00ms]
```

Green last lines:

```text

 8 pass
 0 fail
 45 expect() calls
Ran 8 tests across 1 file. [120.00ms]
```
## feeds-02 — Subscription reorder aliases

**Fixed.** Validate resolved feed identities under the existing lock before writing feeds.yaml; URL/title aliases cannot omit another subscription.

Changed files:

- `packages/core/src/feeds.ts`
- `packages/core/test/feeds.test.ts`

New tests in `packages/core/test/feeds.test.ts`:

- `a reorder rejects duplicate resolved subscriptions without changing feeds.yaml (feeds-02)`

Original probe: `state.ts arrange-alias` (each prefixed with `ORE_NO_ENRICH=1 bun /tmp/ore-deep5-feeds/`). All listed probes exited 1 before and 0 after. Red symptom:

```text
[DEEP] arrange-alias {"urls":["https://example.test/a.xml","https://example.test/a.xml"]}
AssertionError: invalid order must not silently delete followed feed B
```

Regression command: `bun test packages/core/test/feeds.test.ts`. Red last lines:

```text

 19 pass
 1 fail
 65 expect() calls
Ran 20 tests across 1 file. [840.00ms]
```

Green last lines:

```text

 20 pass
 0 fail
 69 expect() calls
Ran 20 tests across 1 file. [796.00ms]
```
## feeds-03 — Overlapping refresh commits

**Fixed.** Reserve generations in the disposable cache under the library lock, fetch outside the lock, then merge under the lock against current subscriptions and committed generations. Separate CLI processes share the ordering.

Changed files:

- `packages/core/src/feeds.ts`
- `packages/core/test/feeds.test.ts`

New tests in `packages/core/test/feeds.test.ts`:

- `an older refresh preserves current subscriptions and results after follow (feeds-03)`
- `an older refresh preserves current subscriptions and results after newer refresh (feeds-03)`
- `an older refresh preserves current subscriptions and results after unfollow (feeds-03)`

Original probe: `state.ts refresh-follow; state.ts refresh-order` (each prefixed with `ORE_NO_ENRICH=1 bun /tmp/ore-deep5-feeds/`). All listed probes exited 1 before and 0 after. Red symptom:

```text
[DEEP] refresh-follow {"before":["A","B"],"after":["A"],"followed":["A","B"],"cache":{"feeds":{"https://example.test/a.xml":{"checked_at":"2026-11-24T12:00:00.000Z","posts":[{"url":"https://example.test/A","title":"A","feed":"https://example.test/a.xml"}]}}}}
AssertionError: a refresh started before Follow must not erase the new feed cache
[DEEP] refresh-order {"before":["new","old"],"after":["old"]}
AssertionError: an older refresh must not replace the later successful refresh
```

Regression command: `bun test packages/core/test/feeds.test.ts`. Red last lines:

```text

 20 pass
 3 fail
 72 expect() calls
Ran 23 tests across 1 file. [834.00ms]
```

Green last lines:

```text

 23 pass
 0 fail
 72 expect() calls
Ran 23 tests across 1 file. [855.00ms]
```
## feeds-04 — Failed Mark read and Undo

**Fixed.** Extend change.ts's existing field ownership and saved-predecessor mechanism to batches. Each post rebases its inverse and only its latest owner repaints it; feed-actions groups mixed inverse writes with allOrNone.

Changed files:

- `apps/desktop/src/change.ts`
- `apps/desktop/src/feed-actions.ts`
- `apps/desktop/test/feed-actions.test.ts`

New tests in `apps/desktop/test/feed-actions.test.ts`:

- `failed Mark read preserves saved predecessors and newer fields: undo (feeds-04)`
- `failed Mark read preserves saved predecessors and newer fields: rollback (feeds-04)`
- `failed Mark read preserves saved predecessors and newer fields: overlapping selection (feeds-04)`
- `Undo restores mixed saved read states after a failed predecessor (feeds-04)`

Original probe: `actions.ts undo-failed; actions.ts rollback` (each prefixed with `ORE_NO_ENRICH=1 bun /tmp/ore-deep5-feeds/`). All listed probes exited 1 before and 0 after. Red symptom:

```text
[DEEP] rollback {"shown":false,"disk":true,"writes":["unread","read"],"expected":true}
AssertionError: after the last successful Mark read, the screen must match disk
[DEEP] undo-failed {"shown":true,"disk":true,"writes":["unread","read"],"expected":false}
AssertionError: Undo must restore the state that actually saved before the action
```

Regression command: `bun test apps/desktop/test/feed-actions.test.ts`. Red last lines:

```text

 5 pass
 2 fail
 22 expect() calls
Ran 7 tests across 1 file. [30.00ms]
```

Green last lines:

```text

 8 pass
 0 fail
 29 expect() calls
Ran 8 tests across 1 file. [27.00ms]
```

Additional mixed-state test, red against the original HEAD action modules:

```text
 0 pass
 7 filtered out
 1 fail
 1 expect() calls
Ran 1 test across 1 file. [12.00ms]
```
## feeds-05 — Inherited XML bases

**Fixed.** Resolve each address through its element and ancestors, so root, entry, link, enclosure and content bases apply consistently to posts, site and pictures.

Changed files:

- `packages/core/src/feeds.ts`
- `packages/core/test/intake.test.ts`
- `packages/core/test/intake-grid.test.ts`
- `packages/core/test/fixtures/intake/feeds/xml-base.xml`

New tests in `packages/core/test/intake.test.ts`:

- `feed intake resolves inherited and element xml:base for posts, site and pictures (feeds-05)`

Original probe: `parser.ts base` (each prefixed with `ORE_NO_ENRICH=1 bun /tmp/ore-deep5-feeds/`). All listed probes exited 1 before and 0 after. Red symptom:

```text
[DEEP] base {"actual":"https://feeds.example.test/rss/one","expected":"https://site.example.test/learn/one"}
AssertionError: Expected values to be strictly deep-equal:
```

Regression command: `bun test packages/core/test/intake.test.ts -t feeds-05`. Red last lines:

```text
 0 pass
 171 filtered out
 1 fail
 3 expect() calls
Ran 1 test across 1 file. [113.00ms]
```

Green last lines:

```text
 1 pass
 171 filtered out
 0 fail
 4 expect() calls
Ran 1 test across 1 file. [115.00ms]
```
## feeds-06 — Feed byte encodings

**Fixed.** Decode response bytes before XML parsing using BOM, HTTP charset, XML declaration, then UTF-8. Fixtures cover Latin-1 header/declaration combinations and UTF-8/UTF-16 controls.

Changed files:

- `packages/core/src/feeds.ts`
- `packages/core/test/intake.test.ts`
- `packages/core/test/intake-grid.test.ts`
- `packages/core/test/fixtures/intake/feeds/latin1.xml`

New tests in `packages/core/test/intake.test.ts`:

- `feed intake decodes declared XML and HTTP encodings before reading titles and URLs (feeds-06)`

Original probe: `parser.ts encoding` (each prefixed with `ORE_NO_ENRICH=1 bun /tmp/ore-deep5-feeds/`). All listed probes exited 1 before and 0 after. Red symptom:

```text
[DEEP] encoding {"actual":"Caf�","expected":"Café","actualUrl":"https://example.test/caf%EF%BF%BD","expectedUrl":"https://example.test/caf%C3%A9"}
AssertionError: Expected values to be strictly equal:
```

Regression command: `bun test packages/core/test/intake.test.ts -t feeds-06`. Red last lines:

```text
 0 pass
 172 filtered out
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [86.00ms]
```

Green last lines:

```text
 1 pass
 172 filtered out
 0 fail
 16 expect() calls
Ran 1 test across 1 file. [157.00ms]
```
## feeds-07 — Opaque GUIDs mistaken for URLs

**Fixed.** Read XML's correctly cased isPermaLink attribute while preserving the legacy lowercase spelling; actual links and default/explicit permalinks still work.

Changed files:

- `packages/core/src/feeds.ts`
- `packages/core/test/intake.test.ts`
- `packages/core/test/intake-grid.test.ts`
- `packages/core/test/fixtures/intake/feeds/guids.xml`

New tests in `packages/core/test/intake.test.ts`:

- `feed intake uses permalink GUIDs and real links but never opaque GUIDs (feeds-07)`

Original probe: `parser.ts guid` (each prefixed with `ORE_NO_ENRICH=1 bun /tmp/ore-deep5-feeds/`). All listed probes exited 1 before and 0 after. Red symptom:

```text
[DEEP] guid {"actual":true,"expected":false}
AssertionError: Expected values to be strictly deep-equal:
```

Regression command: `bun test packages/core/test/intake.test.ts -t feeds-07`. Red last lines:

```text
 0 pass
 173 filtered out
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [78.00ms]
```

Green last lines:

```text
 1 pass
 173 filtered out
 0 fail
 2 expect() calls
Ran 1 test across 1 file. [78.00ms]
```
## feeds-08 — Atom plain-text titles

**Fixed.** Interpret Atom text constructs by type for both feed and entry titles: literal default/text, decoded HTML, and XHTML text content. RSS retains its existing title handling.

Changed files:

- `packages/core/src/feeds.ts`
- `packages/core/test/intake.test.ts`
- `packages/core/test/intake-grid.test.ts`
- `packages/core/test/fixtures/intake/feeds/text-titles.xml`

New tests in `packages/core/test/intake.test.ts`:

- `feed intake preserves plain Atom titles and reads HTML and XHTML titles as text (feeds-08)`

Original probe: `parser.ts text-title` (each prefixed with `ORE_NO_ENRICH=1 bun /tmp/ore-deep5-feeds/`). All listed probes exited 1 before and 0 after. Red symptom:

```text
[DEEP] text-title {"actual":"Use in TypeScript","expected":"Use <T> in TypeScript"}
AssertionError: Expected values to be strictly deep-equal:
```

Regression command: `bun test packages/core/test/intake.test.ts -t feeds-08`. Red last lines:

```text
 0 pass
 174 filtered out
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [125.00ms]
```

Green last lines:

```text
 1 pass
 174 filtered out
 0 fail
 3 expect() calls
Ran 1 test across 1 file. [85.00ms]
```
## feeds-09 — Prefixed Atom

**Fixed.** Recognize qualified feed roots in discovery and truncation checks, and match Atom children by namespace as well as local name. Keep the incomplete-root refusal and ignore unrelated prefixed titles.

Changed files:

- `packages/core/src/feeds.ts`
- `packages/core/test/intake.test.ts`
- `packages/core/test/intake-grid.test.ts`
- `packages/core/test/fixtures/intake/feeds/prefixed-atom.xml`

New tests in `packages/core/test/intake.test.ts`:

- `feed intake discovers and refreshes prefixed Atom while rejecting a truncated root (feeds-09)`

Original probe: `parser.ts prefix` (each prefixed with `ORE_NO_ENRICH=1 bun /tmp/ore-deep5-feeds/`). All listed probes exited 1 before and 0 after. Red symptom:

```text
[DEEP] prefix {"actual":{"error":"feeds.example.test sent a feed that stops partway."},"expected":1}
AssertionError: Expected values to be strictly deep-equal:
```

Regression command: `bun test packages/core/test/intake.test.ts -t feeds-09`. Red last lines:

```text
 0 pass
 175 filtered out
 1 fail
 1 expect() calls
Ran 1 test across 1 file. [85.00ms]
```

Green last lines:

```text
 1 pass
 175 filtered out
 0 fail
 9 expect() calls
Ran 1 test across 1 file. [104.00ms]
```
## feeds-10 — Future entries consume the cache

**Fixed.** Apply one D107 date-window predicate before the per-feed cap and in the view. Undated posts remain eligible; reading an older cache filters the view without rewriting disk.

Changed files:

- `packages/core/src/feeds.ts`
- `packages/core/test/feeds.test.ts`

New tests in `packages/core/test/feeds.test.ts`:

- `future dates cannot consume the last-two-weeks cache or hide today's post (feeds-10)`

Original probe: `matrix.ts future` (each prefixed with `ORE_NO_ENRICH=1 bun /tmp/ore-deep5-feeds/`). All listed probes exited 1 before and 0 after. Red symptom:

```text
[DEEP] future {"count":30,"todayPresent":false,"firstPublished":"2100-01-01T00:00:00.000Z"}
AssertionError: future-dated items must not evict today from the last-two-weeks Feed
```

Regression command: `bun test packages/core/test/feeds.test.ts`. Red last lines:

```text

 23 pass
 1 fail
 73 expect() calls
Ran 24 tests across 1 file. [895.00ms]
```

Green last lines:

```text

 24 pass
 0 fail
 76 expect() calls
Ran 24 tests across 1 file. [901.00ms]
```

## Existing affected-file checks

Each file was run separately, with no parallel test processes:

- `packages/core/test/inbox.test.ts`: 8 pass; 0 fail; Ran 8 tests across 1 file. [120.00ms]
- `packages/core/test/feeds.test.ts`: 24 pass; 0 fail; Ran 24 tests across 1 file. [901.00ms]
- `apps/desktop/test/feed-actions.test.ts`: (pass) Undo restores mixed saved read states after a failed predecessor (feeds-04) [2.79ms]; 8 pass; 0 fail; Ran 8 tests across 1 file. [27.00ms]
- `apps/desktop/test/change.test.tsx`: 12 pass; 0 fail; Ran 12 tests across 1 file. [159.00ms]
- `apps/desktop/test/settings-saves.test.ts`: (pass) mac: two failed goal saves restore the last persisted goal (PHONE-05) [0.08ms]; 4 pass; 0 fail; Ran 4 tests across 1 file. [15.00ms]
- `apps/desktop/test/list-actions.test.tsx`: 17 pass; 0 fail; Ran 17 tests across 1 file. [227.00ms]
- `apps/desktop/test/phone-waiting-undo.test.ts`: 2 pass; 0 fail; Ran 2 tests across 1 file. [39.00ms]
- `apps/desktop/test/undo-waits.test.ts`: 1 pass; 0 fail; Ran 1 test across 1 file. [33.00ms]
- `packages/core/test/intake-grid.test.ts`: 2 pass; 0 fail; Ran 2 tests across 1 file. [27.00ms]
- `packages/core/test/intake.test.ts`: 175 pass; 1 fail; Ran 176 tests across 1 file. [7.09s]

The full intake file fails its existing macOS Vision test, `a very tall or very wide screenshot is read whole, each line once (F188)`, with `Found no text in that image`. The native OCR path returns insufficient text; it does not call the modified Feed parser. Control: copied HEAD's unmodified intake test beside its fixtures, ran only that test, then removed the temporary copy. It failed identically (0 pass, 1 fail). No retry, skip, changed expectation or OCR fix was made. Its platform/environment cause remains unproven. Per the task, Claude should record this validation issue if needed; findings.md was not edited.

## Final checks

Typecheck ran once and passed (exit 0):

```text
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
```

Combined command, run once: `bun test packages/core/test apps/desktop/test`. Exit 1:

```text
3 tests failed:
(fail) import coverage: text recognition > a very tall or very wide screenshot is read whole, each line once (F188) [89.34ms]
(fail) the CLI as an agent drives it > an inbox import where every link fails exits non-zero and keeps them [12.37ms]
(fail) cancelling an add > SIGTERM after the source is written takes it back out [12.16ms]

 1900 pass
 3 fail
 10059679 expect() calls
Ran 1903 tests across 247 files. [110.70s]
```

All 17 new regression cases pass in this combined run. The OCR failure is the same one confirmed with HEAD's unchanged test. The other two tests fail at `Bun.serve({ port: 0 })`, before their behavior is exercised:

```text
error: Failed to start server. Is port 0 in use?
 syscall: "listen",
   errno: 0,
    code: "EADDRINUSE"
```

Locations: `packages/core/test/cli-contract.test.ts:54` and `packages/core/test/cancel.test.ts:16`. These test setups are unchanged. No attempt was made to bypass the sandbox, start a separate server, retry those tests or modify them. The required full-suite command itself attempted those listeners and failed. Its process exited; no work process remains running.

`git diff --check` passed. Final status: ten fixes drafted, typecheck green, 1,900 combined tests green and three validation failures documented above. Nothing committed or merged.
