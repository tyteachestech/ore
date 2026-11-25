# Deep scan 5 — course fix drafts

Base: `60d85c5437677f1aaef68072f0b77ae5337e38fe` (the supplied clean master worktree). Five findings fixed; COURSES-05 skipped pending a collection-identity decision. No commits, findings-table edits, decision edits, existing assertion changes, e2e runs, browser, app, simulator, bench or development server. Tests use scratch libraries, never the live library. Existing tests that try local HTTP listeners fail in this sandbox; no listener started.

Read root and desktop CLAUDE.md, the relevant D79/D92/D36 decisions, SPEC, daily-session and WORKFLOW, plus the interaction-check and ios-check skills. Used headless behavior checks under the user's stricter no-browser/no-app instruction. No controls or decoration added; no purpose-rule removals needed. Visual, touch and native-window checks remain unrun.

## Reproduction setup

The archived scripts retain imports relative to their original `codex-out/courses/` location. Copied them there without changing their source to reproduce each finding in report order. For the JSX scripts, linked that scratch directory's `node_modules` to `apps/desktop/node_modules`. Bun needs `./` before the question script path because its name ends in `.red.tsx`, not `.test.tsx`. All six original assertions reproduced; initial path/dependency harness errors were corrected before counting a reproduction. The first run of each actual assertion is retained as `FIX-EVIDENCE-courses/0N-master.log`.

Logs are local files (the repository ignores `*.log`). Important tails are embedded below so the notes carry the red/green evidence. `FIX-EVIDENCE-courses/covering-summary.txt` lists the additional existing test-file runs. All test processes completed.

## COURSES-01 — fixed

A changing plan now matches a saved lesson's URL, with the old bare-video URL as the pre-D92 fallback, instead of matching its part number. Each saved lesson can match only once. Its ID, text, status, highlights and learning records survive. Matched lessons receive the current plan's order through the existing locked, atomic metadata writer. Sources removed from the remote plan are retained after that plan, in their previous relative order. A re-add does not delete them. The fill-page path rereads the saved item so filling it cannot overwrite its new part, filing or restoration with stale metadata.

Changed files:
- `packages/core/src/ingest/course.ts`
- `packages/core/test/courses.test.ts`
- `packages/core/test/page-video.test.ts`
- `packages/core/test/intake.test.ts`
- `packages/core/test/intake-grid.test.ts` (playlist text cell now points at the real playlist regression)
- `packages/core/test/fixtures/intake/video/playlist-changes.json` (original fixture written for Ore)

New tests:
- `a changed YouTube playlist keeps lesson identity, order and complete transcripts` — `intake.test.ts`. Checks titles, author/date, headings, transcript start/middle/end and timestamps, absence of fixture images/code, insertion and retry.
- `changed course plans match URLs, retain removed lessons and preserve saved progress` — `courses.test.ts`. Checks insertion/reordering/removal, stable IDs, retained text/status and repeat add.
- `a shifted pre-D92 lesson fills its own page and retains its new position, restoration and filing` — `page-video.test.ts`. Checks the actual old format, no repeat video fetch, its highlight and all saved metadata. Its red run temporarily used the untouched master implementation; the draft was restored before green.

Master command: `bun codex-out/courses/playlist.ts insert`; assertion failed with Alpha imported twice and New omitted. The same script now passes (`01-script-green.log`).

Red (last lines; full output: `FIX-EVIDENCE-courses/01-red.log`):

```text
      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/deep5-fix-courses/packages/core/test/intake.test.ts:940:48)
(fail) import coverage: video > a changed YouTube playlist keeps lesson identity, order and complete transcripts [27.53ms]

 0 pass
 175 filtered out
 1 fail
 4 expect() calls
Ran 1 test across 1 file. [136.00ms]
```

Green (last lines; full output: `FIX-EVIDENCE-courses/01-intake-green.log`):

```text

1 tests failed:
(fail) import coverage: text recognition > a very tall or very wide screenshot is read whole, each line once (F188) [97.20ms]

 175 pass
 1 fail
 1141 expect() calls
Ran 176 tests across 1 file. [8.14s]
```

The whole intake file's first green-attempt above includes the unrelated native OCR failure described in the final checks. The new playlist test passed; it is not claimed that this file was wholly green. Its exact result in that run was:

```text
(pass) import coverage: video > a changed YouTube playlist keeps lesson identity, order and complete transcripts [14.02ms]
```
 Core course and old-format guards:

Red (last lines; full output: `FIX-EVIDENCE-courses/01-core-red.log`):

```text
      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/deep5-fix-courses/packages/core/test/courses.test.ts:200:46)
(fail) changed course plans match URLs, retain removed lessons and preserve saved progress [89.37ms]

 0 pass
 10 filtered out
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [119.00ms]
```

Green (last lines; full output: `FIX-EVIDENCE-courses/01-core-green.log`):

```text
(pass) adding a link again > gives back the source already here, filed under the new skills too, instead of a second copy [23.05ms]
(pass) adding a link again > brings an archived source back, and says so [21.59ms]
(pass) changed course plans match URLs, retain removed lessons and preserve saved progress [28.12ms]

 11 pass
 0 fail
 58 expect() calls
Ran 11 tests across 1 file. [448.00ms]
```

Red (last lines; full output: `FIX-EVIDENCE-courses/01-legacy-red.log`):

```text
      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/deep5-fix-courses/packages/core/test/page-video.test.ts:164:47)
(fail) a shifted pre-D92 lesson fills its own page and retains its new position, restoration and filing [255.01ms]

 0 pass
 6 filtered out
 1 fail
 2 expect() calls
Ran 1 test across 1 file. [296.00ms]
```

Green (last lines; full output: `FIX-EVIDENCE-courses/01-page-video-green.log`):

```text
(pass) a course lesson with a video > added before as a bare video, it gets the page's text on a re-add, keeping its highlights and id [21.65ms]
(pass) reimporting a lesson added as a bare video > reads its page again from the course, by its place in it, and keeps the highlights [25.77ms]
(pass) a shifted pre-D92 lesson fills its own page and retains its new position, restoration and filing [27.90ms]

 7 pass
 0 fail
 42 expect() calls
Ran 7 tests across 1 file. [370.00ms]
```

Existing coverage: `courses.test.ts` 11 pass; `page-video.test.ts` 7 pass; `intake-grid.test.ts` 2 pass. `bun run golden:update`: 41 pass, 0 fail; **no golden files changed**. This changes course identity/order bookkeeping, not extracted lesson text. Existing saved sample doc.md output stays the same.

Durable fix: lesson identity owns retry/fill matching; a changing remote position can no longer select another saved lesson.

## COURSES-02 — fixed

The Mac Add handler now records restoration/filing inverses for every course receipt, before selecting its toast wording. New and filled lessons no longer bypass `again()`. Existing selective lesson IDs and the existing Add history/write flow are retained; no independent Undo implementation was added.

Changed files: `apps/desktop/src/App.tsx`, `apps/desktop/test/course-add-undo.test.ts`.

New tests: `course re-add Undo and Redo include restored and filed lessons on the added branch`, the `filled branch`, and the `kept branch` — `course-add-undo.test.ts`. They execute the actual full handler with IO replaced and check both Undo and Redo, including selective restoration and filing.

Master command: `bun codex-out/courses/add-undo.ts`; Undo left the old restored lesson active. The same script now archives both affected lessons and passes (`02-script-green.log`).

Red (last lines; full output: `FIX-EVIDENCE-courses/02-red.log`):

```text
      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/deep5-fix-courses/apps/desktop/test/course-add-undo.test.ts:44:18)
(fail) course re-add Undo and Redo include restored and filed lessons on the filled branch [0.05ms]
(pass) course re-add Undo and Redo include restored and filed lessons on the kept branch [0.13ms]

 1 pass
 2 fail
 12 expect() calls
Ran 3 tests across 1 file. [13.00ms]
```

Green (last lines; full output: `FIX-EVIDENCE-courses/02-green.log`):

```text
(pass) course re-add Undo and Redo include restored and filed lessons on the added branch [0.94ms]
(pass) course re-add Undo and Redo include restored and filed lessons on the filled branch [0.04ms]
(pass) course re-add Undo and Redo include restored and filed lessons on the kept branch [0.03ms]

 3 pass
 0 fail
 21 expect() calls
Ran 3 tests across 1 file. [8.00ms]
```

Durable fix: inverse registration no longer depends on the branch used to describe the receipt.

## COURSES-03 — fixed

Mac and iPhone now use `courseGroups()` in `lines.ts` for course completion/grouping. A real structured filter returns individual matching lessons, so each stays in its own status tab (D79.2). Unfiltered courses still group by their whole course. Mac inline expansion remains in App; the phone still opens its lessons screen. Text-search flattening and Archive are preserved.

Changed files: `apps/desktop/src/lines.ts`, `apps/desktop/src/App.tsx`, `apps/desktop/src/phone/PhoneApp.tsx`, `apps/desktop/test/course-filters.test.ts`.

New tests in `course-filters.test.ts`: `course kind filters show matching lessons in their own tabs on both devices`, the corresponding `author` test, and `unfiltered courses stay grouped until every lesson is done; Archive stays flat`. They execute each real screen adapter with the shared production helpers.

Master command: `bun codex-out/courses/filtered-course.ts`; Mac returned no matching row. After moving the grouping function, the original extraction script needs its injected environment updated; the permanent tests supply the actual shared module and verify both adapters.

Red (last lines; full output: `FIX-EVIDENCE-courses/03-red.log`):

```text
      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/deep5-fix-courses/apps/desktop/test/course-filters.test.ts:26:64)
(fail) course author filters show matching lessons in their own tabs on both devices [0.06ms]
(pass) unfiltered courses stay grouped until every lesson is done; Archive stays flat [0.04ms]

 1 pass
 2 fail
 9 expect() calls
Ran 3 tests across 1 file. [15.00ms]
```

Green (last lines; full output: `FIX-EVIDENCE-courses/03-green.log`):

```text
(pass) course kind filters show matching lessons in their own tabs on both devices [0.21ms]
(pass) course author filters show matching lessons in their own tabs on both devices [0.01ms]
(pass) unfiltered courses stay grouped until every lesson is done; Archive stays flat [0.08ms]

 3 pass
 0 fail
 13 expect() calls
Ran 3 tests across 1 file. [14.00ms]
```

Existing coverage: `courses.test.ts` 4 pass, `lines.test.ts` 2 pass, `source-filters.test.ts` 10 pass (`03-existing-filter-green.log`). The first refactor moved inline expansion out of App and failed the existing source-location assertion. Corrected the production boundary: the shared helper owns grouping and the Mac owns its expansion. The existing assertion is untouched. Additional screen/contract tests are listed in the coverage log.

Durable fix: both devices use one filtered-course rule rather than deriving completion from different lesson sets.

## COURSES-04 — fixed

The shared command wrapper recognizes course archive/restore and course title/skill edits as changes that wake open screens, matching the equivalent single-source commands. Read-only course commands stay quiet. Existing `change()` ordering and shared archive actions are untouched.

Changed files: `apps/desktop/src/ore.ts`, `apps/desktop/test/wakes.test.ts`.

New test: `course Archive, Restore, filing and rename wake dependent screens; course reads do not` — `wakes.test.ts`. Covers selected-lesson Undo as well as forward writes.

Master command: `bun test ./codex-out/courses/course-questions.red.tsx`; the mounted question loader held 1 question while core returned 0. The same integration script now shows 0 and makes a second questions read (`04-script-green.log`, 1 pass). `list-actions.test.tsx`: 17 pass, 0 fail.

Red (last lines; full output: `FIX-EVIDENCE-courses/04-red.log`):

```text

      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/deep5-fix-courses/apps/desktop/test/wakes.test.ts:31:33)
(fail) course Archive, Restore, filing and rename wake dependent screens; course reads do not [0.15ms]

 2 pass
 1 fail
 13 expect() calls
Ran 3 tests across 1 file. [14.00ms]
```

Green (last lines; full output: `FIX-EVIDENCE-courses/04-green.log`):

```text
(pass) a rename, delete or restore of a skill or source wakes open screens; other skill settings don't [0.12ms]
(pass) a source filed in or out of a skill wakes open screens [0.01ms]
(pass) course Archive, Restore, filing and rename wake dependent screens; course reads do not [0.02ms]

 3 pass
 0 fail
 18 expect() calls
Ran 3 tests across 1 file. [12.00ms]
```

Durable fix: refresh notification belongs to the command boundary, so every caller and both devices receive it.

## COURSES-05 — skipped: existing-data and Undo semantics need a decision

Confirmed real with `bun codex-out/courses/collection-collision.ts add`: supported writers save Work/work separately, then arrangement rejects them. This is not a taste finding.

No final changed files or new tests for this finding. A candidate reused existing names on new assignments and allowed already-saved case-distinct groups to rearrange without rewriting them. Its initial tests passed, but a further lifecycle test proved that moving the last skill out of the old lower-case group makes Undo fail: the original group is no longer present to qualify for the exception. That candidate and its tests were removed from the worktree diff; copies are in ignored scratch output for inspection only.

Decision needed: should case-distinct saved names remain separate collections (including when Undo restores them), or should collections have case-insensitive identity with an explicit way to resolve old collisions? The existing `arrange.test.ts` test `refuses a layout that drops, repeats or invents a skill` explicitly rejects A/a groups. Accepting all exact-distinct group names conflicts with that existing assertion; merging old names would rewrite valid existing data. I did neither. A prevention-only write fix would leave already-affected libraries broken, so it is not presented as a complete fix.

Red prototype test: `a legacy collection layout can be restored after moving its last skill out` in the discarded `arrange.test.ts` draft. It executes the same whole-layout inverse as `list-actions.ts`.

```text
                                                                                         ^
error: collection "work" is listed twice
      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/deep5-fix-courses/packages/core/src/skills.ts:352:84)
      at withLock (/Users/tylerpoelking/Developer/ore-wt/deep5-fix-courses/packages/core/src/lock.ts:107:22)
      at arrangeSkills (/Users/tylerpoelking/Developer/ore-wt/deep5-fix-courses/packages/core/src/skills.ts:339:10)
      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/deep5-fix-courses/packages/core/test/arrange.test.ts:107:9)
(fail) a legacy collection layout can be restored after moving its last skill out [42.66ms]

 0 pass
 8 filtered out
 1 fail
Ran 1 test across 1 file. [75.00ms]
```

Original reproduction: `AssertionError: a layout created by supported writes must remain rearrangeable`; actual error `collection "work" is listed twice` (`05-master.log`). Green: not applicable; finding intentionally remains unfixed. Durable fix: deferred until old-group identity and its Undo are settled, rather than silently normalizing the library or changing an existing test.

## COURSES-06 — fixed

The shared Reader uses the current lesson's index in the same active list used by Previous/Next for both the position and total. Stored original part numbers remain intact. When viewing an archived source absent from that active list, the course position/navigation line is omitted rather than showing position zero.

Changed files: `apps/desktop/src/Reader.tsx`, `apps/desktop/test/course-position.test.tsx`.

New tests: `reader course position and navigation use the same visible lessons: ...` for `[1,2,3]`, `[2,3]`, `[1,3]`, `[4,9]`, and `an archived source absent from the active lessons has no course position` — `course-position.test.tsx`. They inspect the actual shared component's returned React tree and exercise navigation without a browser.

Master command: `bun codex-out/courses/course-position.ts`; displayed Lesson 3 of 2. Same script now displays Lesson 2 of 2 and passes (`06-script-green.log`).

Red (last lines; full output: `FIX-EVIDENCE-courses/06-red.log`):

```text

      at <anonymous> (/Users/tylerpoelking/Developer/ore-wt/deep5-fix-courses/apps/desktop/test/course-position.test.tsx:39:100)
(fail) an archived source absent from the active lessons has no course position [0.13ms]

 1 pass
 4 fail
 7 expect() calls
Ran 5 tests across 1 file. [13.00ms]
```

Green (last lines; full output: `FIX-EVIDENCE-courses/06-green.log`):

```text
(pass) reader course position and navigation use the same visible lessons: 1,3 [0.12ms]
(pass) reader course position and navigation use the same visible lessons: 4,9 [0.07ms]
(pass) an archived source absent from the active lessons has no course position [0.02ms]

 5 pass
 0 fail
 13 expect() calls
Ran 5 tests across 1 file. [12.00ms]
```

Durable fix: numerator, denominator and navigation all refer to the same active lesson list.

## Final checks

Ran `bun run typecheck` **once** after the code changes: exit 0. Both workspace and desktop TypeScript checks passed (`FIX-EVIDENCE-courses/final-typecheck.log`).

Ran `bun test packages/core/test apps/desktop/test` **once** after typecheck: exit 1. All new regressions for the five retained fixes passed. Three existing tests failed:

| File | Test | Observed error |
| --- | --- | --- |
| `packages/core/test/intake.test.ts` | `a very tall or very wide screenshot is read whole, each line once (F188)` | Native macOS OCR returned no usable text: `Found no text in that image. Add a screenshot with text, or paste what you need.` |
| `packages/core/test/cli-contract.test.ts` | `an inbox import where every link fails exits non-zero and keeps them` | `Bun.serve({ port: 0 })` could not listen: `EADDRINUSE`, `Failed to start server. Is port 0 in use?` |
| `packages/core/test/cancel.test.ts` | `SIGTERM after the source is written takes it back out` | The same local-listener failure, before spawning the CLI add. |

These same failures occurred in the earlier single-file runs. They are outside the modified behavior; no claim of a fully green suite. No retry, skip, test edit or findings-table row was used to hide them. No browser, app, simulator, e2e or bench ran; test-owned listener attempts were refused before a server started. All launched test commands exited. The single-file coverage log includes the rejected collection prototype's coverage, and the initial source-filter refactor failure; the latter was resolved in production code with the original test unchanged, and passes in the final run.

`bun run golden:update`: 41 pass, 0 fail; no changed goldens. `git diff --check`: clean. `docs/reviews/findings.md` and `docs/DECISIONS.md` are unchanged. Changes remain uncommitted in this worktree. The reviewer can proceed with the five fixes; COURSES-05 remains a documented decision and fix to make separately.

Final typecheck: **PASS (exit 0)**. Final combined test output (last lines, `FIX-EVIDENCE-courses/final-tests.log`):

```text
 1949 pass
 3 fail
 10060131 expect() calls
Ran 1952 tests across 254 files. [111.66s]
```
