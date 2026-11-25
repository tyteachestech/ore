# Fix notes — keys, deep scan 5

Base commit: `03a70abae0834fdbf7519fe5b55e005af453f361`. All five findings are fixed; none skipped. No existing test was edited. Changes remain uncommitted for Claude’s review.

## Reproduction and scope

- Findings were handled in report order. Each supplied red script reproduced its stated failure before that finding’s fix; earlier fixes did not affect later reproduction paths.
- Archived scripts retain imports relative to their original `codex-out/keys/` location. Temporary copies in `/tmp/ore-keys-repro/` replaced only `../../` import prefixes with this worktree’s absolute path, including the Babel parser import. Red-run source selectors and expectations were unchanged. Every red script exited 1.
- New tests execute production callbacks with explicit component state and action spies, following existing headless callback tests. They do not mount React, run effects or prove native IME delivery. The retirement test uses the real ReviewSession with a fake command runner.
- No browser, app, development server, e2e or bench was launched. The explicitly requested full suite attempted two local HTTP test servers; both failed to listen. No real library or AI was used. No intake or doc.md output changes; goldens are unchanged, so no intake fixtures or golden update were needed.
- `docs/DECISIONS.md` and `docs/reviews/findings.md` are unchanged. D195’s sound/silent scopes and D211’s Enter/blur save versus Escape cancel remain intact.
- Harness corrections during authoring: the callback delimiter initially stopped at an inner brace, corrected before production edits; the modified passage-binding test needs Replace because Command+E also belongs to Inline code outside Review. Neither correction changed an existing test or production behavior.
- Full transient logs are in `/tmp/ore-keys-repro/`; durable excerpts are below.

## KEYS-01 — fixed: Composition confirmation/cancellation

Changed files: `apps/desktop/src/Add.tsx`, `apps/desktop/src/Tutor.tsx`, `apps/desktop/src/TitleField.tsx`, `apps/desktop/src/Review.tsx`; new `apps/desktop/test/key-dispatch.test.ts`.

New regression tests: Add, Tutor, Review and TitleField ignore composition commands (normal flag and WebKit false/229; two cases); Tutor’s mention picker leaves composing navigation and confirmation to the IME.

Reproduction: `ORE_NO_ENRICH=1 bun /tmp/ore-keys-repro/ime.ts` (import correction described above).

```text
[DEEP] handler apps/desktop/src/Add.tsx:233
[DEEP] Add: composing Enter must not import unfinished text: actual=1 expected=0
[DEEP] handler apps/desktop/src/Tutor.tsx:967
[DEEP] Tutor: WebKit composition-confirm Enter must not send: actual=["日本"] expected=[]
[DEEP] handler apps/desktop/src/Review.tsx:581
[DEEP] Review: IME cancel must not finish session: actual=1 expected=0
[DEEP] handler apps/desktop/src/TitleField.tsx:56
[DEEP] TitleField: WebKit composition-confirm must not save/close title: actual=1 expected=0
[DEEP] TitleField: IME cancel must not discard rename: actual=1 expected=0
```

Regression command: `bun test apps/desktop/test/key-dispatch.test.ts`.

Red, before the fix:

```text

 0 pass
 3 fail
 3 expect() calls
Ran 3 tests across 1 file. [13.00ms]
```

Green, after the fix:

```text

 3 pass
 0 fail
 24 expect() calls
Ran 3 tests across 1 file. [17.00ms]
```

Durable fix: Each affected handler stops composition before any command, including Escape, mention navigation and capture-phase Review dispatch. Ordinary Enter/Escape remain covered. The shared Review, Tutor and TitleField handlers serve both devices.

## KEYS-02 — fixed: Replace clears all live conflicts

Changed files: `apps/desktop/src/keys.ts`; new `apps/desktop/test/key-conflicts.test.ts`.

New regression tests: KEYS-02 Replace clears every live conflict and Undo restores the sound/silent defaults; KEYS-02 Replace leaves a binding in a disjoint scope assigned.

Reproduction: `ORE_NO_ENRICH=1 bun /tmp/ore-keys-repro/clash.ts` (import correction described above).

```text
[DEEP] first conflict: prev-post
[DEEP] replace result: null
[DEEP] active commands: [ "section", "play-alt" ]
[DEEP] handler apps/desktop/src/Reader.tsx:2393
[DEEP] K on a video after assigning Recall this chapter: play=1 recall=0; expected play=0 recall=1
```

Regression command: `bun test apps/desktop/test/key-conflicts.test.ts`.

Red, before the fix:

```text

 1 pass
 1 fail
 9 expect() calls
Ran 2 tests across 1 file. [18.00ms]
```

Green, after the fix:

```text

 2 pass
 0 fail
 12 expect() calls
Ran 2 tests across 1 file. [15.00ms]
```

Durable fix: Rebinding removes every overlapping command in one keymap commit using the existing scope rules. Disjoint sound/silent bindings and undo snapshots retain their meaning; Reader needs no precedence patch.

## KEYS-03 — fixed: Modified Review shortcuts

Changed files: `apps/desktop/src/Review.tsx`; new `apps/desktop/test/key-dispatch.test.ts`.

New regression tests: accepted Meta/Ctrl/Alt/Shift shortcuts reach every checked-answer action (four cases); modified shortcuts keep text focus, repeat and answer-delay protection; fixed ratings stay unmodified.

Reproduction: `ORE_NO_ENRICH=1 bun /tmp/ore-keys-repro/review-keys.ts` (import correction described above).

```text
[DEEP] Edit exercise rebind Meta+KeyE: null
[DEEP] handler apps/desktop/src/Review.tsx:581
[DEEP] accepted shortcut Edit exercise: edited=0; expected=1
```

Regression command: `bun test apps/desktop/test/key-dispatch.test.ts`.

Red, before the fix:

```text

 4 pass
 4 fail
 45 expect() calls
Ran 8 tests across 1 file. [19.00ms]
```

Green, after the fix:

```text

 8 pass
 0 fail
 70 expect() calls
Ran 8 tests across 1 file. [15.00ms]
```

Durable fix: Only the fixed rating keys require no Command/Control/Option modifier. Configurable commands match the accepted keymap after the same focus, repeat and 300 ms checks. Covers Edit, Ask, bad-version and both passage directions in shared Review.

## KEYS-04 — fixed: Held Retire

Changed files: `apps/desktop/src/Review.tsx`; new `apps/desktop/test/key-dispatch.test.ts`.

New regression tests: KEYS-04 one held Retire press removes only one exercise after its save completes.

Reproduction: `ORE_NO_ENRICH=1 bun /tmp/ore-keys-repro/held-retire.ts` (import correction described above).

```text
[DEEP] handler apps/desktop/src/Review.tsx:581
[DEEP] handler apps/desktop/src/Review.tsx:581
[DEEP] one press then its repeat, each after prior save: ["card retire A","card retire B"]
[DEEP] remaining due: ["C"]
[DEEP] expected: only card retire A; B and C remain due
```

Regression command: `bun test apps/desktop/test/key-dispatch.test.ts`.

Red, before the fix:

```text

 8 pass
 1 fail
 75 expect() calls
Ran 9 tests across 1 file. [96.00ms]
```

Green, after the fix:

```text

 9 pass
 0 fail
 79 expect() calls
Ran 9 tests across 1 file. [103.00ms]
```

Durable fix: The shared keyboard dispatch consumes repeats without issuing another retirement, just as Later already does. A real ReviewSession with a fake command runner proves A alone leaves the queue, then a fresh press can retire B. Session writes, undo and queue ownership stay unchanged.

## KEYS-05 — fixed: Keypad confidence and ratings

Changed files: `apps/desktop/src/keys.ts`, `apps/desktop/src/Review.tsx`; new `apps/desktop/test/key-dispatch.test.ts`.

New regression tests: KEYS-05 Review accepts keypad confidence and ratings: top-row and keypad digits choose confidence 1–3 and ratings 1–4; keypad navigation, modifiers, typing and held ratings do not rate; an existing custom keypad shortcut still runs instead of rating or choosing confidence.

Reproduction: `ORE_NO_ENRICH=1 bun /tmp/ore-keys-repro/numpad.ts` (import correction described above).

```text
[DEEP] handler apps/desktop/src/Review.tsx:581
[DEEP] handler apps/desktop/src/Review.tsx:581
[DEEP] Numpad3: confidence=[] ratings=[]; expected [3], [3]
```

Regression command: `bun test apps/desktop/test/key-dispatch.test.ts`.

Red, before the fix:

```text

 11 pass
 1 fail
 89 expect() calls
Ran 12 tests across 1 file. [128.00ms]
```

Green, after the fix:

```text

 12 pass
 0 fail
 90 expect() calls
Ran 12 tests across 1 file. [93.00ms]
```

Durable fix: One reviewDigit helper reads both numeric rows for both phases, checks keypad numeric mode, and defers to any existing Review binding. Previously valid keypad assignments remain usable; saved settings are not rewritten, rejected or migrated. New custom keypad assignments retain the existing behavior too.

## Existing coverage and interaction check

All files below ran individually after the final production edits. They cover the changed components and keymap, plus nearby dispatch and session guards. Review-session tests also passed after KEYS-03 and KEYS-04. The initial component coverage pass after KEYS-01 passed all 15 selected files.

Command for each row: `bun test apps/desktop/test/<file>`.

| File | Pass | Fail |
| --- | ---: | ---: |
| `ambience.test.ts` | 8 | 0 |
| `backdrops.test.ts` | 1 | 0 |
| `chat-versions.test.ts` | 7 | 0 |
| `end-screen.test.tsx` | 24 | 0 |
| `exercise-text.test.tsx` | 5 | 0 |
| `focus-near.test.ts` | 9 | 0 |
| `hints.test.ts` | 10 | 0 |
| `keys.test.ts` | 18 | 0 |
| `lap.test.tsx` | 13 | 0 |
| `media-keys.test.ts` | 2 | 0 |
| `menu-focus.test.ts` | 2 | 0 |
| `menubar.test.ts` | 8 | 0 |
| `mole-says.test.ts` | 6 | 0 |
| `names.test.ts` | 2 | 0 |
| `notion-parity.test.ts` | 57 | 0 |
| `one-name.test.ts` | 2 | 0 |
| `questions.test.ts` | 2 | 0 |
| `rehearsal-review.test.ts` | 3 | 0 |
| `review-end.test.ts` | 4 | 0 |
| `review-pick.test.ts` | 3 | 0 |
| `review-session.test.ts` | 25 | 0 |
| `sfx.test.ts` | 13 | 0 |
| `shell-menu.test.ts` | 3 | 0 |
| `tutor.test.ts` | 3 | 0 |
| `undo-waits.test.ts` | 1 | 0 |
| `waits.test.ts` | 3 | 0 |

Interaction checklist applied to changed keyboard behavior: composition keeps the draft and field; ordinary Enter/Escape retain save/cancel/close; Replace preserves disjoint scopes and undo snapshots; modified shortcuts retain field isolation and the answer delay; held Retire never advances again; keypad navigation and assigned shortcuts retain their meaning. No visible controls or copy were added or removed, and writes/history ordering were not changed.

The checklist’s rendered lifecycle matrix, native focus checks, screenshots and iPhone simulator checks were not run because this task explicitly prohibits browsers/apps/servers. This is a headless draft, not a device-verification claim.

## Final validation

`bun run typecheck` — run once, exit 0:

```text
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
```

`bun test packages/core/test apps/desktop/test` — run once, exit 1:

```text
 1912 pass
 3 fail
 10059839 expect() calls
Ran 1915 tests across 250 files. [113.57s]
```

The 14 new regression cases pass in this run. Three failures are outside the changed files:

| Existing test | Failure |
| --- | --- |
| `packages/core/test/intake.test.ts:1331` — a very tall or very wide screenshot is read whole, each line once (F188) | `Found no text in that image. Add a screenshot with text, or paste what you need.` from `packages/core/src/ingest/ocr.ts:73`. The OCR cause was not investigated in this keyboard-only draft. |
| `packages/core/test/cli-contract.test.ts:54` — an inbox import where every link fails exits non-zero and keeps them | `Bun.serve({ port: 0 })` failed: `Failed to start server. Is port 0 in use?`, `syscall: "listen"`, `code: "EADDRINUSE"`. |
| `packages/core/test/cancel.test.ts:16` — SIGTERM after the source is written takes it back out | The same local-server listen failure (`EADDRINUSE`, port 0). |

The listen failures occurred in this restricted sandbox; an actual occupied port was not established. No baseline rerun, retries or skips were used, so these are not claimed as independently proven baseline failures. The full suite is **not green**. No changes were made to those tests or their production code. Claude can add the required findings rows; this task forbids editing the register.

`git diff --check` passed. All launched test commands completed; no task process was left running. Final result: typecheck passes, all 14 new regression cases and 26 individually run existing files pass, full suite has the three failures listed above.
