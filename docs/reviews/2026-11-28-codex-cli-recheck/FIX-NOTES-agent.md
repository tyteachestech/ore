# Agent CLI recheck — draft fixes

Base checked: `1eafca9a0b51cc76b197f627589d6588bf7808e1`; Bun 1.4.4, macOS arm64.

All seven reported findings reproduced at this checkout. None was skipped. Five are fixed in guides/help (including the Dig workflow); two have shared-core fixes. No existing test assertion or behavior was changed. No commits or pushes were attempted. `docs/reviews/findings.md` and `docs/DECISIONS.md` are untouched.

## Reproduction setup and boundaries

The archived red scripts import from `../../packages/...`, so they were copied unchanged to their original `codex-out/agent/` location. Each was run in report order against its scratch library, before changing the code or guide rule relevant to that finding. For AGENT-03, the missing fixture Claude executable was recreated there: it reads the fixture reply file and emits the expected JSON/model metadata; Codex is a denying stub. No live AI was invoked. Its first setup attempt exited 77 because the adapter removes custom environment variables; the corrected fixture reads its adjacent file. The retained reproduction log is the subsequent intended assertion failure.

Full logs remain in `codex-out/agent-fix/` (ignored scratch output). The red and green tails are embedded below so this handoff preserves them. The archived red scripts are historical reproductions, not guide-aware regression tests: after a guide fix, several still hard-code the former command sequence or assert that the old prose exists. The new guide tests read the current text or run its recipe; only the two core red scripts were rerun as green checks.

No browser, app, dev server, e2e, bench, live-site checks or golden updates. No `doc.md` rendering/import behavior changed: AGENT-05 fixes result reporting after a failed attempt, not extraction or content acceptance, so no intake fixture or golden changes were needed. No doctor checks were added, so the seeded-library doctor before/after requirement does not apply.

## AGENT-01 — Fixed — shell recipe.

Changed files: skills/ore/SKILL.md; packages/core/test/agent-guide.test.ts.

New regression tests in `packages/core/test/agent-guide.test.ts`:

- `the shell recipe passes delimiter lines, quotes and shell syntax as literal answer text`

Original red-script evidence (exit 1):

```text
[DEEP] Exact guide heredoc; shell exit: 0 answer text executed: true
[DEEP] stdout: grade called safely
[DEEP] stderr: zsh:7: command not found: ORE_EOF
AssertionError: the quoted-heredoc guide must keep all learner text as data, including its fixed delimiter
```

Regression red output, last lines (`codex-out/agent-fix/01-red.log`):

```text
      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/cli-fix-agent/packages/core/test/agent-guide.test.ts:23:32)
(fail) the shell recipe passes delimiter lines, quotes and shell syntax as literal answer text [5.44ms]

 0 pass
 1 fail
 1 expect() calls
Ran 1 test across 1 file. [18.00ms]
```

Regression green output, last lines (`codex-out/agent-fix/01-green.log`):

```text
packages/core/test/agent-guide.test.ts:
(pass) the shell recipe passes delimiter lines, quotes and shell syntax as literal answer text [4.47ms]

 13 pass
 0 fail
 17 expect() calls
Ran 13 tests across 2 files. [48.00ms]
```

Why durable: Replacing each apostrophe before single-quoting the full value removes delimiter collisions and preserves literal shell syntax and trailing newlines. All three former heredocs use this rule.
## AGENT-02 — Fixed — shared answer writer.

Changed files: packages/core/src/questions.ts; packages/core/test/questions.test.ts.

New regression tests in `packages/core/test/questions.test.ts`:

- `answers written in one millisecond can each be edited and removed by their timestamp`
- `new answer timestamps avoid occupied slots without rewriting legacy contributions`

Original red-script evidence (exit 1):

```text
[DEEP] before [{"ts":"2026-11-28T00:42:57.754Z","text":"First explanation"},{"ts":"2026-11-28T00:42:57.754Z","text":"Second explanation"}]
[DEEP] after [{"ts":"2026-11-28T00:42:57.754Z","text":"Second explanation corrected"},{"ts":"2026-11-28T00:42:57.754Z","text":"Second explanation"}]
AssertionError: editing the second answer must not overwrite the first
```

Regression red output, last lines (`codex-out/agent-fix/02-red.log`):

```text
(pass) questions → answers and sources (D75) > Answered closes it; Answered + card also asks enrich for a card from his answer [16.07ms]
(pass) questions → answers and sources (D75) > a source lists questions of its skills, asked in it, or matched to it; Not answered here drops a match [20.97ms]

 4 pass
 2 fail
 21 expect() calls
Ran 6 tests across 1 file. [174.00ms]
```

Regression green output, last lines (`codex-out/agent-fix/02-green.log`):

```text
(pass) question-quality eval > a question that is the source's own sentence, turned around or with a word hidden, is lifted [0.16ms]
(pass) question-quality eval > the judge's false checks are the failures, counted most first [0.06ms]

 26 pass
 0 fail
 122 expect() calls
Ran 26 tests across 3 files. [510.00ms]
```

Why durable: The library lock now protects timestamp allocation against existing on-disk contributions, so new edit/remove handles are unique. Existing timestamps, including duplicates and hand-edited values, remain unchanged and readable; their first-match behavior is preserved.

The original answer-ID script now exits 0: the first explanation remains intact and the second is corrected (`02-repro-green.log`). Old duplicate contributions are not migrated or disambiguated; this fix prevents new collisions without rewriting valid older data.
## AGENT-03 — Fixed — all exercise-edit guides.

Changed files: skills/ore/SKILL.md; skills/ore/reference/cards.md; packages/core/src/templates/library-agents.md; docs/SPEC.md; packages/core/test/agent-guide.test.ts.

New regression tests in `packages/core/test/agent-guide.test.ts`:

- `every exercise-edit recipe supplies the replacement author's AI stamp`

Original red-script evidence (exit 1):

```text
[DEEP] guide fix stamp: {"vendor":"claude","model":"fixture-original","prompt_version":"enrich@fixture"}
[DEEP] actual author of the replacement wording: {"vendor":"claude","model":"fixture-scout","prompt_version":"chat@2"}
AssertionError: following the guide must attribute AI replacement wording to its author
```

Regression red output, last lines (`codex-out/agent-fix/03-red.log`):

```text
      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/cli-fix-agent/packages/core/test/agent-guide.test.ts:38:54)
(fail) every exercise-edit recipe supplies the replacement author's AI stamp [0.22ms]

 1 pass
 1 fail
 7 expect() calls
Ran 2 tests across 1 file. [17.00ms]
```

Regression green output, last lines (`codex-out/agent-fix/03-green.log`):

```text
(pass) the shell recipe passes delimiter lines, quotes and shell syntax as literal answer text [4.67ms]
(pass) every exercise-edit recipe supplies the replacement author's AI stamp [0.29ms]

 14 pass
 0 fail
 31 expect() calls
Ran 14 tests across 2 files. [52.00ms]
```

Why durable: Every concrete edit recipe supplies --ai with the actual replacement author, or null for Tyler's own wording. Unknown model/prompt metadata routes through ore ask, which returns a proposal with its stamp; nothing guesses or reuses the old author.

The same regression was extended to the generated library guide: its old recipe failed too (see `07-red.log`). The full three-guide check is green in `07-green.log`.
## AGENT-04 — Fixed — review guide.

Changed files: skills/ore/SKILL.md; packages/core/test/agent-guide.test.ts.

New regression tests in `packages/core/test/agent-guide.test.ts`:

- `the review guide presents card show --review and keeps that variant through grading and rating`

Original red-script evidence (exit 1):

```text
[DEEP] guide presents: Why space retrieval?
[DEEP] card show --review presents: An exam is a week away. How would you distribute three practice sessions? variant: variant-ready
AssertionError: the guide must ask the version due for review (D66)
```

Figure reproduction (also exit 1):

```text
[DEEP] guide probe: What’s under the box?
[DEEP] guide queue figure: undefined figure_file: undefined
[DEEP] available through card show: {"src":"assets/plant.svg","box":[0.05,0.05,0.4,0.2]}
AssertionError: the guide probe must include the covered figure, not only “What’s under the box?”
```

Regression red output, last lines (`codex-out/agent-fix/04-red.log`):

```text
      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/cli-fix-agent/packages/core/test/agent-guide.test.ts:51:17)
(fail) the review guide presents card show --review and keeps that variant through grading and rating [0.14ms]

 2 pass
 1 fail
 20 expect() calls
Ran 3 tests across 1 file. [13.00ms]
```

Regression green output, last lines (`codex-out/agent-fix/04-green.log`):

```text
(pass) every exercise-edit recipe supplies the replacement author's AI stamp [0.18ms]
(pass) the review guide presents card show --review and keeps that variant through grading and rating [0.06ms]

 15 pass
 0 fail
 41 expect() calls
Ran 15 tests across 2 files. [41.00ms]
```

Why durable: The guide gets the complete presentation once, keeps its answer and variant through grading and rating, and requires an opaque mask over figure.box. An agent unable to display that figure directs him to Ore without grading or recording a text-only substitute.
## AGENT-05 — Fixed — shared import result and CLI exit status.

Changed files: packages/core/src/inbox.ts; packages/cli/src/cmd-items.ts; docs/SPEC.md; packages/core/test/inbox-retry.test.ts.

New regression tests in `packages/core/test/inbox-retry.test.ts`:

- `inbox retries report every attempted error while announcing only changed errors`
- `the inbox command exits nonzero and includes the reason on an unchanged failed retry`

Original red-script evidence (exit 1):

```text
[DEEP] first exit: 1 body: {"added":[],"failed":[{"id":"01M8FSSZ14N37EB9537EJ8YH7C","url":"https://scout.invalid/missing","skills":[],"added":"2026-11-28T00:45:11.588Z","device":"agent-scout","error":"Couldn’t open that page (HTTP 404 from scout.invalid). Check the link, or copy the page’s text and paste it here instead."}],"filled":[]}
[DEEP] retry exit: 0 body: {"added":[],"failed":[],"filled":[]}
[DEEP] entries still waiting: 1
AssertionError: retry where every import failed must exit nonzero (F235, SPEC)
```

Regression red output, last lines (`codex-out/agent-fix/05-red.log`):

```text
      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/cli-fix-agent/packages/core/test/inbox-retry.test.ts:37:28)
(fail) the inbox command exits nonzero and includes the reason on an unchanged failed retry [14.30ms]

 0 pass
 2 fail
 3 expect() calls
Ran 2 tests across 1 file. [87.00ms]
```

Regression green output, last lines (`codex-out/agent-fix/05-green.log`):

```text
(pass) inbox retries report every attempted error while announcing only changed errors [11.53ms]
(pass) the inbox command exits nonzero and includes the reason on an unchanged failed retry [12.27ms]

 11 pass
 0 fail
 58 expect() calls
Ran 11 tests across 2 files. [183.00ms]
```

Why durable: Core now returns errors for every failed attempt; failed retains its established meaning of changed errors for app notifications. CLI exit status and human output use errors, preserving notification behavior without editing the existing test that requires deduplication.

The original retry script now exits 0: the first and second import both return exitCode 1, and the retry has its 404 reason in errors (`05-repro-green.log`). The separate existing CLI contract file had 12 passes and one fixture startup failure at `Bun.serve({ port: 0 })`: `EADDRINUSE`, before calling the import handler. It was not retried or edited.
## AGENT-06 — Fixed — complete-reading guide.

Changed files: skills/ore/SKILL.md; packages/core/test/agent-guide.test.ts.

New regression tests in `packages/core/test/agent-guide.test.ts`:

- `the after-reading guide marks a complete source Done after saving answers, enabling prequestion drafts`

Original red-script evidence (exit 1):

```text
[DEEP] after guide finish: status=inbox, finished_at=undefined, prequestion drafts pending=0
AssertionError: a source the learner finished through mode 3 should be Done, enabling its prequestion drafts
```

Regression red output, last lines (`codex-out/agent-fix/06-red.log`):

```text
      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/cli-fix-agent/packages/core/test/agent-guide.test.ts:73:22)
(fail) the after-reading guide marks a complete source Done after saving answers, enabling prequestion drafts [0.28ms]

 3 pass
 1 fail
 30 expect() calls
Ran 4 tests across 1 file. [45.00ms]
```

Regression green output, last lines (`codex-out/agent-fix/06-green.log`):

```text
(pass) the review guide presents card show --review and keeps that variant through grading and rating [0.06ms]
(pass) the after-reading guide marks a complete source Done after saving answers, enabling prequestion drafts [51.37ms]

 16 pass
 0 fail
 52 expect() calls
Ran 16 tests across 2 files. [100.00ms]
```

Why durable: The guide calls the existing status command after saving the learner's answers and recall, then verifies Done and finished_at. The executable guide test checks both Inbox and Reading and confirms prequestion eligibility. Partway reading does not mark the whole source Done.
## AGENT-07 — Fixed — guide/help workflow, not an automatic note append.

Changed files: skills/ore/SKILL.md; packages/core/src/templates/library-agents.md; packages/cli/src/cmd-items.ts (help only); docs/SPEC.md; packages/core/test/agent-guide.test.ts.

New regression tests in `packages/core/test/agent-guide.test.ts`:

- `both Dig guide recipes save his words once in the dated skill note and in the Dig record`

Original red-script evidence (exit 1):

```text
[DEEP] Saved Dig: I would spread retrieval over several days and check what I missed. done: true
[DEEP] Skill note exists: false contains learner words: false
AssertionError: D325 and generated library AGENTS.md promise Dig words in the skill note
```

Regression red output, last lines (`codex-out/agent-fix/07-red.log`):

```text
(pass) the review guide presents card show --review and keeps that variant through grading and rating [0.08ms]
(pass) the after-reading guide marks a complete source Done after saving answers, enabling prequestion drafts [58.97ms]

 3 pass
 2 fail
 42 expect() calls
Ran 5 tests across 1 file. [111.00ms]
```

Regression green output, last lines (`codex-out/agent-fix/07-green.log`):

```text
(pass) the review guide presents card show --review and keeps that variant through grading and rating [0.12ms]
(pass) the after-reading guide marks a complete source Done after saving answers, enabling prequestion drafts [29.03ms]

 17 pass
 0 fail
 78 expect() calls
Ran 17 tests across 2 files. [354.00ms]
```

Why durable: Both agent guides now give the same explicit note-then-Dig recipe the app uses. The test runs each actual recipe through the CLI and verifies one dated note and one Dig with the learner's exact words. Keeping the existing low-level command contract avoids duplicate app notes and changes to its Undo.

Scope: `dig --text` alone still writes only digs.json, and `--drop` still removes only that record. The guides and help now state both facts. The historical one-command red script therefore still describes that low-level behavior; the documented two-command path is the fixed workflow, as allowed for this pass. If its second write fails, the guide says the note is already safe and must not be appended again when resuming.

## Related existing test files

Commands for the related checks:

- `bun test packages/core/test/questions.test.ts packages/core/test/annotations.test.ts packages/core/test/eval-questions.test.ts`
- `bun test packages/core/test/inbox-retry.test.ts packages/core/test/inbox.test.ts`
- `bun test packages/core/test/cli-contract.test.ts`
- `bun test packages/core/test/agent-guide.test.ts packages/core/test/cli-docs.test.ts`
- Each of `packages/core/test/item-lookup-reads.test.ts`, `packages/core/test/filing-reads.test.ts`, `apps/desktop/test/phone-waiting-undo.test.ts`, `packages/core/test/foundation.test.ts`, `packages/core/test/card-edit.test.ts`, `packages/core/test/remix.test.ts`, `packages/core/test/figure.test.ts`, and `packages/core/test/digs.test.ts` was run separately with `bun test <file>`.

Files ran sequentially; complete logs are in `codex-out/agent-fix/`.

`02-green.log`:

```text

 26 pass
 0 fail
 122 expect() calls
Ran 26 tests across 3 files. [510.00ms]
```

`05-green.log`:

```text

 11 pass
 0 fail
 58 expect() calls
Ran 11 tests across 2 files. [183.00ms]
```

`05-cli-contract.log`:

```text

 12 pass
 1 fail
 38 expect() calls
Ran 13 tests across 1 file. [1170.00ms]
```

`item-lookup-reads.test.log`:

```text

 3 pass
 0 fail
 17 expect() calls
Ran 3 tests across 1 file. [153.00ms]
```

`filing-reads.test.log`:

```text

 2 pass
 0 fail
 14 expect() calls
Ran 2 tests across 1 file. [187.00ms]
```

`phone-waiting-undo.test.log`:

```text

 2 pass
 0 fail
 11 expect() calls
Ran 2 tests across 1 file. [47.00ms]
```

`foundation.test.log`:

```text

 25 pass
 0 fail
 107 expect() calls
Ran 25 tests across 1 file. [2.45s]
```

`card-edit.test.log`:

```text

 5 pass
 0 fail
 23 expect() calls
Ran 5 tests across 1 file. [283.00ms]
```

`remix.test.log`:

```text

 11 pass
 0 fail
 63 expect() calls
Ran 11 tests across 1 file. [2.88s]
```

`figure.test.log`:

```text

 3 pass
 0 fail
 17 expect() calls
Ran 3 tests across 1 file. [70.00ms]
```

`digs.test.log`:

```text

 3 pass
 0 fail
 26 expect() calls
Ran 3 tests across 1 file. [117.00ms]
```

`07-green.log`:

```text

 17 pass
 0 fail
 78 expect() calls
Ran 17 tests across 2 files. [354.00ms]
```

## Final validation

Ran `bun run typecheck` exactly once. **Exit 1.** Its complete output:

```text
$ tsc -p tsconfig.json --noEmit && tsc -p apps/desktop/tsconfig.json --noEmit
packages/core/test/inbox-retry.test.ts(29,24): error TS2352: Conversion of type '() => Promise<Response>' to type 'typeof fetch' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
  Property 'preconnect' is missing in type '() => Promise<Response>' but required in type 'typeof fetch'.
error: script "typecheck" exited with code 1
```

The error was in the new retry test's fetch stand-in: Bun's fetch type requires `preconnect`. Corrected the stand-in to preserve `savedFetch.preconnect` with `Object.assign`, eliminating the unsafe cast. The final combined test run below used that correction. **Typecheck was not rerun under the requested one-run limit; the corrected tree does not have a verified green typecheck, and the app typecheck was not reached.**

Ran `bun test packages/core/test apps/desktop/test` exactly once. **Exit 1. All nine new regression tests passed**, including the corrected retry stand-in. The four failures were in existing tests:

| File / test | Observed failure |
| --- | --- |
| `packages/core/test/intake.test.ts`: very tall or wide screenshot (F188) | The native macOS Vision path returned too little text for `tall.png`; `scannedText` threw "Found no text in that image." This test explicitly disables its OCR stand-in. Native cause not established; no retry. |
| `packages/core/test/today.test.ts`: AI stamp with a model name containing spaces (D176) | Its spawned Bun CLI crashed at startup after 1 ms with `panic(main thread): Trap instruction`. This was not a failed stamp assertion. No retry. |
| `packages/core/test/cli-contract.test.ts`: every inbox import fails | The existing local HTTP fixture could not listen on port 0: `EADDRINUSE`, before calling the import handler. The new handler test uses a fetch stand-in and passes. |
| `packages/core/test/cancel.test.ts`: SIGTERM after source write | The existing local HTTP fixture could not listen on port 0: `EADDRINUSE`, before the cancellation check. |

These failures are outside the changed behavior; no pristine-base comparison was run, so this is evidence of the observed failure sites, not a claim that all four are proven pre-existing. None was rerun, skipped, or changed to fit this patch. Claude can add ledger entries and complete validation outside this restricted run. No browser, app or server was started separately; the existing test fixtures attempted their own local listeners and failed to bind.

`git diff --check` passed. All tracked test command sessions exited; no persistent service was launched. A final process inventory was unavailable because the sandbox refused `ps` (Operation not permitted). No commits or pushes, and no changes to the original report/red scripts, decisions, findings ledger, intake samples or goldens.

Final combined test output (last lines):

```text

4 tests failed:
(fail) import coverage: text recognition > a very tall or very wide screenshot is read whole, each line once (F188) [89.02ms]
(fail) new-card limit and skill filter (D58, D60) > a review keeps the AI's stamp whatever the model is called: one with a space, or none (D176) [35.28ms]
(fail) the CLI as an agent drives it > an inbox import where every link fails exits non-zero and keeps them [12.13ms]
(fail) cancelling an add > SIGTERM after the source is written takes it back out [16.41ms]

 2189 pass
 4 fail
 10061838 expect() calls
Ran 2193 tests across 274 files. [121.15s]
```
