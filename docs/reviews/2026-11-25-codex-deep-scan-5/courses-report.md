# Courses reading scout — deep scan 5

Covered course creation and retry, stubbed YouTube playlist planning/transcripts, playlist changes, lesson identity/order, next-lesson selection, course and source Archive/Undo, the Mac Add handler, filtered Mac/iPhone course grouping, collection naming and shared list actions, and skill/exercise counts after filing and archiving. Compared against the earlier scan reports and relevant findings, especially F211, F249, F573, F576, F620–F622 and scan 4. All artifacts are under `codex-out/courses/`; no application, browser, server, watcher, real AI, full test suite or live library was used. Skipped EPUB front matter and highlight animation timing. Folder courses and moving sources into/out of courses are unsupported, not reported as bugs. Finish was traced to its core status write, not exercised as an interactive quiz. Collected's grouping/filtering was read, but not exercised in a real window. No fixes or findings-table edits were made.

Base: `05c68297d33d46d6b17b404c101543bc9dfd9557`. Bun `1.4.4`. Commands below run from the repository root. Six findings: four S2 and two S3; no S1 claim. Each principal red command failed **3/3 confirmation runs**, with its corresponding control passing. [All run results](confirmations.json), [sequential confirmation runner](confirm.py). Scripts use owned scratch libraries; IDs vary, but verdicts do not depend on randomness or wall-clock timing. Each Bun invocation completed in well under one second during this run.

## Findings

### COURSES-01 — A playlist gaining a first video skips that video and duplicates an old lesson

**S2 · Mac importer; the resulting library is wrong on both devices.** Violates D79.1's retry promise and D122's complete import promise. Existing sources are not erased; the new lesson is silently omitted and a duplicate is saved.

**Red command:**

```sh
bun codex-out/courses/playlist.ts insert
```

Output excerpt, [full run](logs/playlist-insert-1.log):

```text
[DEEP] {"mode":"insert","planned":["New","Alpha"],"added":["Alpha"],"kept":1,"failed":[],"actual":[{"part":1,"title":"Alpha","url":"https://www.youtube.com/watch?v=aaaaaaaaaaa"},{"part":2,"title":"Alpha","url":"https://www.youtube.com/watch?v=aaaaaaaaaaa"}],"calls":["https://www.youtube.com/playlist?list=PL_course_test","https://www.youtube.com/watch?v=aaaaaaaaaaa","https://www.youtube.com/playlist?list=PL_course_test","https://www.youtube.com/watch?v=aaaaaaaaaaa"]}
AssertionError: re-import must import the new video and retain each existing video once
exit=1
```

**Minimized steps:** Import playlist `[Alpha]`. Its next plan is `[New, Alpha]`, under the same playlist URL. Add it again. Only one old video and one inserted video are needed. The script runs actual `planCourse`, `addCourse`, YouTube metadata/caption parsing and filesystem writes; only yt-dlp's process boundary and HTTP responses are stubbed. No subprocess/network runs in this loop.

**Expected:** New is imported, Alpha retained once, with a correct course order. **Actual:** Alpha is saved a second time; New is never requested. The receipt reports one added, one kept, zero failures.

**Ranked hypotheses and probes:**

1. Existing lessons are matched by position instead of identity. Prediction: appending New works, inserting it first fails. Confirmed: `bun codex-out/courses/playlist.ts append` passes, using the same videos and stubs.
2. Import deduplication suppresses New. Prediction: New is fetched, then rejected/skipped. Rejected: the captured yt-dlp calls request Alpha twice and never request New; `failed` is empty.
3. The planner or fetched metadata names the wrong video. Prediction: the second plan itself is wrong, or standalone New fails. Rejected: the plan is `[New, Alpha]`, and the append control imports New correctly.

Additional probes: `bun codex-out/courses/reimport.ts remove` changes `[alpha,beta]` to `[beta,new]` and also skips the new lesson; `... reorder` leaves old ordering unchanged. No claim is made that removing a remote video should delete its saved source. Initial private/deleted-video filtering and the same video in two different courses pass separately.

**Cause:** `packages/core/src/ingest/course.ts:176` builds `have` from `course.part`. At `:190–191`, the new plan is joined against those positions, not lesson URL/video identity. At `:201`, the newly vacant final position creates another source even when it is a video already saved in the course.

### COURSES-02 — Undo of a re-added course ignores restored lessons when any new lesson was added

**S2 · Mac.** Related to F576, but a different branch: its no-new-lessons control passes. F576 fixed undoing too many restores; this branch records none of the restores to undo.

**Red command:**

```sh
bun codex-out/courses/add-undo.ts
```

Output, [full run](logs/add-undo-1.log):

```text
[DEEP] {"mode":"gained","restored":1,"added":1,"calls":["archive 01M88GHY7PEN4CBMJFW06MJ9PY"],"actual":[{"title":"old","archived":false},{"title":"new","archived":true}]}
AssertionError: Undo must rearchive the old lesson this re-add restored
exit=1
```

**Minimized steps:** Save a one-lesson course; archive its lesson. Re-add the same course with one new lesson appended. Invoke the Undo callback supplied by the Mac's Add handler. The script extracts that complete handler verbatim from `App.tsx`, replaces shell/UI services, returns an actual `addCourse` result in the CLI's documented shape, and executes its emitted Archive commands against core.

**Expected:** The new lesson is archived and the old restored lesson returns to Archive. **Actual:** Only the new lesson is archived. The old lesson remains active after Undo, despite `restored` naming it.

**Ranked hypotheses and probes:**

1. The Add handler skips restore bookkeeping on its “added lessons” branch. Prediction: removing only the new lesson makes Undo work. Confirmed by `bun codex-out/courses/add-undo.ts control`: zero added, one restored, and Undo emits `course archive … --lessons=…`; the old lesson is archived again.
2. Core fails to report which old lesson it restored. Rejected: the real receipt has exactly one restored ID, matching the old source.
3. The inverse command selects the wrong lessons. Rejected for this failure: the red run emits no course inverse command at all. The control sends the selected-lesson inverse and core applies it correctly.

**Cause:** `apps/desktop/src/App.tsx:509–513` calls `again()` only when both `r.lessons.length` and `filled` are empty. `again()` is also the operation that registers restored/filed inverses (`:467–475`). New lessons go into `fresh` at `:505`; consequently the final Undo (`:561–570`) can archive those new lessons but has no restore inverse. The same branch also skips filing bookkeeping; that consequence was read, not separately reproduced.

### COURSES-03 — A kind filter makes a matching finished course lesson disappear on the Mac

**S2 · Mac; iPhone comparison exposes divergent course state.** D79.2 says filtered lists list lessons individually. Related area to F211, but F211's expanded-row filter was not the failing operation here.

**Red command:**

```sh
bun codex-out/courses/filtered-course.ts
```

Output, [full run](logs/filter-1.log):

```text
[DEEP] {"filters":[{"field":"kind","values":["youtube"]}],"narrowed":["video"],"mac":[],"phone":[{"kind":"course","id":"c"}]}
AssertionError: Mac source filter must retain the matching completed lesson
exit=1
```

**Minimized steps:** One course has a finished video lesson and an unread article lesson. In All sources, set Kind to Video. Inspect both To read and Done. Two lessons with differing kind/status are necessary. The loop executes the Mac grouping callback and phone `linesOf()` extracted verbatim, with actual `passes`, `lessonsOf` and `nextLesson` helpers; no screen or browser is started.

**Expected:** The finished video remains reachable under Done as a matching lesson. **Actual:** The Mac produces no rows in either tab. The phone produces a course row in Done because its already-filtered input contains only the finished video, although the complete course still has an unread lesson.

**Ranked hypotheses and probes:**

1. The screens determine course completion from different lesson sets. Prediction: filtering triggers divergence, removing the filter does not. Confirmed by `bun codex-out/courses/filtered-course.ts control`: both retain the unfinished course.
2. The kind filter rejects the video. Rejected: actual `passes()` yields exactly `video`, printed before grouping.
3. The tab's status check is dropping all completed sources. Rejected by the phone result and source trace: the Mac's finished lesson reaches grouping, then is discarded by the full-course `next` check. No asynchronous reads participate.

**Cause:** `apps/desktop/src/App.tsx:1271–1273` calculates `next` from unfiltered `inSkill`, then excludes the finished-tab candidate because another lesson is unfinished. The To read tab has no matching candidate. `:1281` flattens lessons for text search `q`, but not for structured `filters`. The phone uses the already-filtered list at `phone/PhoneApp.tsx:372–374` (supplied at `:1134`, `:1213–1217`), so it reaches a different completion result.

### COURSES-04 — Archive course leaves its question on the open skill page (F249 recurrence)

**S2 · Both, shared list action, command wrapper and skill-page question loader.** This reproduces F249's user-visible stale-question failure through **Archive course**. Individual-source Archive still passes.

**Red command:**

```sh
bun test codex-out/courses/course-questions.test.tsx
```

Output, [full run](logs/questions-1.log):

```text
[DEEP] {"probe":"course","shownQuestions":1,"savedQuestions":0,"calls":["questions --skill=learn","course archive course"]}
Expected: 0
Received: 1
0 pass
1 fail
exit=1
```

**Minimized steps:** One skill, one course lesson, one Question highlight. Let the skill page's question loader complete. Archive the course through real `sourceActions().archiveCourse()` and `change()`. Core returns zero questions afterward, but the mounted question loader still holds one. The test mounts only the question-loading hooks, extracted verbatim from `SkillPage.tsx`, in happy-dom. The real `ore()` wrapper runs; its native invocation boundary is replaced with actual core operations. No Tauri window, app, browser, server or AI starts.

**Expected:** The archived lesson's question disappears immediately. **Actual:** It remains until something else causes a reload.

**Ranked hypotheses and probes:**

1. Course Archive does not notify dependent screens. Prediction: an explicit wake, or individual-source Archive, repairs the stale state. Both controls pass:
   - `COURSES_PROBE=source bun test codex-out/courses/course-questions.test.tsx`: shown 0, saved 0; a second `questions` call occurs.
   - `COURSES_PROBE=wake bun test codex-out/courses/course-questions.test.tsx`: same result after `wakeOpenScreens()`.
2. Core still returns questions from archived lessons. Rejected: `listQuestions()` returns zero after the same archive, without any repair.
3. A delayed read overwrites the fresh result. Rejected: the first read is awaited before Archive; nothing is held or failed; there is no second question read at all in the red trace.

**Cause:** `apps/desktop/src/list-actions.ts:231` emits `course archive`. `apps/desktop/src/ore.ts:56` recognizes `archive`, but not `course archive`, as a command that wakes open screens. The question effect depends on `useLibraryChanges` (`SkillPage.tsx:628`, `:641–651`); refreshing the source rows alone does not rerun it. The core archive/selection behavior itself is correct.

### COURSES-05 — Accepted collection names can make the saved sidebar layout impossible to rearrange

**S3 · Both; reachable through core/CLI and a traced picker normalization gap.** No file corruption or data deletion is claimed.

**Red command:**

```sh
bun codex-out/courses/collection-collision.ts add
```

Output, [full run](logs/collection-1.log):

```text
[DEEP] {"mode":"add","skills":[{"name":"Alpha","collection":"Work"},{"name":"Beta","collection":"work"}],"layout":[{"collection":"Work","skills":["alpha"]},{"collection":"work","skills":["beta"]}],"error":"collection \"work\" is listed twice"}
AssertionError: a layout created by supported writes must remain rearrangeable
exit=1
```

**Minimized steps:** Create two distinct skills, one in `Work`, the other in `work`, using supported `addSkill` calls. Build the layout using the app's actual `skillGroups` and `layoutOf`. Submit that layout through `arrangeSkills` (the operation shared list actions use). Two collection spellings are sufficient.

**Expected:** All writers agree on collection identity: reuse/refuse a colliding name when it is assigned, or accept the stored groups consistently later. **Actual:** Assignment succeeds and saves both groups; a subsequent arrangement is refused as a duplicate collection. Moves/reorders that retain both groups cannot save. Renaming or merging the conflicting group can repair it.

**Ranked hypotheses and probes:**

1. Assignment and arrangement use inconsistent case rules. Prediction: identical casing works, changing only case fails. Confirmed by `... collection-collision.ts control` (one `Work` group, success) and `... set` (the same failure through `setSkillLook`).
2. The UI grouping function duplicates a skill or collection entry. Rejected: the printed layout contains each skill exactly once and matches the two stored spellings; actual production grouping functions are used.
3. Whitespace alone creates the invalid state. Rejected as necessary: `Work`/`work` fails without extra spaces. Whitespace does expose the UI route: `... picker` supplies existing `Work Desk` and types `work   desk`; the picker's case-insensitive check compares uncollapsed spacing and offers creation, while core stores `work desk`, which conflicts at arrangement time. That guard path was reproduced headlessly, not clicked in a window.

**Cause:** `packages/core/src/skills.ts:264–272` and `:370–373` normalize whitespace but never resolve/refuse an existing collection with different casing. `:338–340` then refuses repeated case-folded names. The UI gap is `apps/desktop/src/Skills.tsx:443` (trim only) and `:468` (comparison before core whitespace normalization).

### COURSES-06 — An archived lesson makes the reader say “Lesson 3 of 2”

**S3 · Both, shared Reader.** A false course-position number under D79.3; not a styling judgment.

**Red command:**

```sh
bun codex-out/courses/course-position.ts
```

Output, [full run](logs/position-1.log):

```text
[DEEP] {"activeParts":[2,3],"readerLabel":"Lesson 3 of 2"}
AssertionError: Reader must not say Lesson 3 of 2 after archiving one lesson
exit=1
```

**Minimized steps:** Save three numbered lessons. Archive lesson 1. Open lesson 3 with the two active lessons passed to Reader. Three original lessons are needed because Reader hides its course line when only one lesson remains. The script calls the actual extracted `CourseLine` component and inspects its returned React text, with inert wrappers for menus/icons; no pixels or browser are needed.

**Expected:** The numerator and denominator use a consistent meaning, e.g. position among visible lessons or original numbering with a coherent course total. **Actual:** Original part 3 is displayed over the count of two visible lessons.

**Ranked hypotheses and probes:**

1. The label mixes original part and visible count. Confirmed: actual active metadata is `[2,3]`, and the component returns the quoted label.
2. Archive renumbers or corrupts the stored lesson metadata. Rejected: core preserves part 3 and the retained sources; the count is the changed value.
3. The Reader is given a duplicate/wrong lesson list. Rejected: actual `courseLessons()` gives two unique active sources. `bun codex-out/courses/course-position.ts control` retains all three and displays `Lesson 3 of 3` correctly.

**Cause:** `apps/desktop/src/Reader.tsx:4360` renders `course.part` against `lessons.length`. Its callers supply active lessons (`App.tsx:2274`; `phone/PhoneApp.tsx:1105` and the adjacent Reader props), whose count can shrink without changing their original part numbers.

## Leads and explicit limits

- The `filled` branch of the Mac Add handler also bypasses `again()`; restoring/refiling old pre-D92 lessons while filling their page text may lack Undo. No separate red loop; do not treat as an additional finding.
- Positional matching also selects which old bare-video lesson receives page text (`ingest/course.ts:190`). Mixing a changed course plan with pre-D92 lessons may attach the wrong page to an old video. No red loop for that data-corruption consequence.
- A course URL's exact-string identity may split equivalent Academy URLs into separate courses; not reproduced here. Ordinary-source URL deduplication was already covered by earlier scans.
- No native Finish interaction, device sync, actual YouTube response shape changes, course deletion, or lesson-to-course movement was exercised. D79.5 explicitly defers moving/reordering lessons by hand; core keeps archived sources rather than hard-deleting them.
- A folder of Markdown files with `ore add <folder> --course` is refused as unsupported, with a supported-course-link explanation ([CLI output](logs/cli-folder-course.log)). This is a coverage limit, not a bug finding.
- D353 concerns Collected headers. Its animation was deliberately untouched; reading its filters/groups found no additional red-proven issue.

## What passed

- `bun codex-out/courses/playlist.ts private`: private/deleted entries omitted; readable videos retain order.
- `bun codex-out/courses/playlist.ts two-courses`: one video can be retained as an independent lesson in each of two courses, without stealing the first course's membership.
- `bun codex-out/courses/playlist.ts append`: an appended video imports correctly.
- `bun codex-out/courses/lifecycle.ts`: a failed middle lesson retries into the same course, once, in order.
- The same lifecycle loop: next lesson changes correctly after Done, moving back to reading, Archive and Restore; no active unfinished lesson means no next lesson.
- The same loop: rename reaches every lesson; filing the course reaches archived lessons and their exercises.
- The same loop: a source's skill move and explicit inverse move each exercise correctly; skill draft/live counts track those files; archived-source exercises and learned strength remain present as historical memory.
- The same loop: No skill exercises are selectable; unfiled importance is Normal; an archived-only skill leaves the ordinary queue but remains explicitly reviewable.
- The same loop and CLI: selective Archive course Undo leaves the previously archived lesson archived (F573 control).
- `bun codex-out/courses/add-undo.ts control`: re-add with restoration and no new lessons undoes correctly (F576 control).
- `bun codex-out/courses/collection-lifecycle.ts`: rename/delete/Undo/Redo include archived skills; drawer grouping hides archived skills; moving the last skill out removes the empty collection, consistent with D36.
- `python3 codex-out/courses/cli-check.py`: real CLI JSON lesson order, rename, archive receipts, selective inverse and skill stats pass. All commands use the owned lifecycle library and `ORE_NO_ENRICH=1`; fake AI executables are first on PATH.
- All six principal red loops reproduced 3/3; all single-variable controls passed. Logs preserve commands, output and exit codes. `python3 codex-out/courses/confirm.py` runs them sequentially, never two Bun processes together.
