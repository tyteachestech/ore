# Ore CLI recheck — json scout

Covered the changed CLI handlers, their shared core operations, JSON answers, failure exits, invalid structured arguments, and ID lookup at commit `32c979544e3c72b5d1e35b0ade1b63b05fcc843b` on 2026-11-27 (Mac, Bun 1.4.4). All **65 top-level commands** have at least one successful exercised branch: **281 actual CLI invocations** (278 JSON, three text) plus a **27-call handler matrix**; the separate red loops and diagnostic controls are additional. A required-field checker inspected 35 recorded typed answers. Prior CLI sweep 3 and deep scan 3 were used to avoid repeating their full help/unknown-option census, init races, and concurrency work. Skipped all windows, browsers, servers, whole-suite tests, benchmarks, live AI, external imports, optional tool installations, and library-history restoration. Everything written is inside `codex-out/json/`; no fixes or findings-register edits were made.

**10 findings: two S1, six S2, two S3.** JSON-06 is a reproduced F232 failure pattern through a different invalid argument. JSON-02 is related to F234's unknown-skill invariant, but does not claim its fixed add/inbox cases regressed. No open finding is re-reported.

## Reproduction and evidence conventions

- Run all commands below from the repository root. Every red script creates/resets only its own scratch library under `codex-out/json/libs/` and exits **1 on its assertion**. Where the CLI itself succeeds incorrectly, its exit is separately shown as `code: 0`.
- Each finding's focused Bun script reproduced **3/3 fresh runs**, recorded in [logs/repeats.json](logs/repeats.json), plus an independent actual-CLI confirmation. Repeat and CLI-matrix child commands had a 15-second deadline; they ran sequentially. Every observed Bun run finished well within 30 seconds. No timing-sensitive assertions or random fuzzing were used; generated IDs are discovered from the fresh fixture, and the colliding variant IDs are fixed.
- `python3 codex-out/json/cli-red.py <mode>` is an additional self-seeding red command for each finding. It runs a Bun fixture process, waits for it to exit, then runs the real `bun packages/cli/src/ore.ts … --json`. Exact argv, stdout, stderr, exit, and changed files are in `logs/cli-<mode>.json`.
- Output blocks below are projections of the scripts' actual `[DEEP]` output; complete output and assertions are linked. The focused loops compare canonical library files. The independent CLI confirmations also compare `.ore/` metadata, excluding only `.git/` and disposable `.index/`. For rejected writes, the listed canonical files really changed; this is not just an index or snapshot update.
- Platform **Both** means the fault is in the shared CLI/core implementation used by Mac and iPhone. All reproductions ran headlessly on Mac; no iPhone UI path is claimed tested.
- Fake `claude` and `codex` executables precede the real ones on PATH. The former only returns an explicitly supplied fixture; the latter refuses to run AI. `ORE_NO_ENRICH=1` disables background enrichment. `other.ts` replaces `fetch` with responses for exactly two synthetic URLs and refuses every other URL.

## Findings

### JSON-01 — A malformed exercise-skill map clears an earlier exercise before failing

**S1 · Both.** A rejected edit loses a saved skill assignment. This is the `--cards` map used to restore each exercise's own skills, not the already-fixed source-only unknown-skill case.

**Red command:** `bun codex-out/json/cards-json.ts partial`  
**Actual CLI confirmation:** `python3 codex-out/json/cli-red.py cards-partial`  
**Runs:** 3/3 red, plus CLI confirmation. [Full output](logs/cards-partial-repeat-1.log), [CLI result](logs/cli-cards-partial.json).

```json
{
  "code": 1,
  "data": {
    "error": "skills.join is not a function. (In 'skills.join()', 'skills.join' is undefined)"
  },
  "changed": [
    "cards/01M8FRZAYPSCX4JCYYF5N1WRZ7.md"
  ],
  "savedSkills": []
}
```

**Minimised steps:** Create a source and two exercises, both under `learning`. Run `ore edit <source> --skills learning --cards '{"<first>":[],"<second>":"learning"}' --json`. The first exercise sorts before the second. The first array deliberately requests a legitimate change; the second value deliberately violates the documented map shape.

**Expected:** Reject the map before saving anything, with a flag/shape explanation. **Actual:** Exit 1 with `skills.join is not a function`; the first exercise's skills have already changed from `["learning"]` to `[]`. The source's skills remain unchanged.

**Ranked hypotheses and probes:** (1) Map values are not validated before the per-exercise write loop; confirmed. (2) The first exercise's schema silently converts invalid values; rejected: its value is a valid empty array, and the failure is on the second scalar. (3) Index refresh only makes the assignment appear changed; rejected by a hash change and direct reread of the first Markdown file. `cards-probes.ts` shows a lone scalar fails without writes; placing a valid change before it is necessary for data loss.

**Cause:** `packages/core/src/skills.ts:529` flattens values and checks only the skill names, so the scalar `"learning"` passes. Lines 540–542 write each exercise before the next value's `.join()` is reached. `packages/cli/src/cmd-items.ts:596` casts parsed JSON to the map type without runtime shape validation.

### JSON-02 — An empty skill ID is accepted and saved on an exercise

**S1 · Both.** The command replaces a valid assignment with an ID that does not exist. Related invariant: **F234**, but its original add/inbox `--skill missing` cases still reject correctly; this is a different `--cards` bypass.

**Red command:** `bun codex-out/json/cards-json.ts empty-skill`  
**Actual CLI confirmation:** `python3 codex-out/json/cli-red.py cards-empty`  
**Runs:** 3/3 red, plus CLI confirmation. [Full output](logs/cards-empty-skill-repeat-1.log), [controls and doctor evidence](logs/cards-probes.log).

```json
{
  "code": 0,
  "changed": [
    "cards/01M8FRZB5FMDP1XBCKC18TM5K6.md"
  ],
  "savedSkills": [
    ""
  ]
}
```

**Minimised steps:** Create one source and one exercise assigned to `learning`. Run `ore edit <source> --skills learning --cards '{"<exercise>":[""]}' --json`.

**Expected:** Refuse the nonexistent skill and preserve `["learning"]`. **Actual:** Exit 0 and persist `[""]`. `doctor` then reports `unknown skill ""`; the exercise no longer belongs to Learning.

**Ranked hypotheses and probes:** (1) An empty unknown ID bypasses a truthiness check; confirmed by calling `checkSkills(lib,[""])`. (2) An empty skill is a registered special value; rejected by the registry and doctor's warning. (3) Serialization removes the empty string; rejected by rereading the exercise. Controls accept `["learning"]` and `[]`, reject `["missing"]` without writes, but accept `[""]` and write it.

**Cause:** `packages/core/src/skills.ts:491–492`: `.find()` returns the unknown ID, then `if (unknown)` treats `""` as no unknown ID. `fileItemSkills` at lines 529 and 542 relies on that check before saving.

### JSON-03 — An ambiguous variant ID rejects whichever version was stored first

**S2 · Both.** An agent's shortened ID changes the wrong version instead of asking for more of the ID.

**Red command:** `bun codex-out/json/variant-ids.ts`  
**Actual CLI confirmation:** `python3 codex-out/json/cli-red.py variant`  
**Runs:** 3/3 red, plus CLI confirmation and reversed-record probe. [Full output](logs/variant-ids-repeat-1.log), [reversed order](logs/variant-reverse.log).

```json
{
  "variants": [
    {
      "id": "01J00000000000000000000001",
      "status": "rejected",
      "rev": 2
    },
    {
      "id": "01K00000000000000000000001",
      "status": "ready",
      "rev": 1
    }
  ],
  "changed": [
    "cards/01M8FRZBSYA1994P9EZPXPXMPN.variants.jsonl"
  ]
}
```

**Minimised steps:** Give one Explain exercise two valid variant records, `01J00000000000000000000001` and `01K00000000000000000000001`. Run `ore variant reject <exercise> 00001 --json`.

**Expected:** Nonzero exit, ambiguous-ID explanation, no new revision. **Actual:** Exit 0, append a rejected revision for the first record. Reversing the two initial records rejects the other one. A full variant ID works; the unique prefix `01K` is also incorrectly refused as nonexistent.

**Ranked hypotheses and probes:** (1) Lookup selects the first suffix match; confirmed by reversing file order. (2) The two records collapse into one logical revision; rejected: `readVariants` returns both distinct IDs at revision 1 before the action. (3) A stale index supplies the wrong result; rejected: lookup reads the JSONL records directly and repeats in fresh libraries.

**Cause:** `packages/core/src/remix.ts:271–276`, particularly `.find(x => x.id === key || x.id.endsWith(key))` at 274. No ambiguity check or prefix match. `rejectVariant` at 282–285 trusts this selection. The same resolver is used by `card show/set --variant`, restore and grading.

### JSON-04 — A rejected highlight edit still moves its passage

**S2 · Both.** The annotation changes even though the command tells the caller the edit failed.

**Red command:** `bun codex-out/json/atomic.ts annotate`  
**Actual CLI confirmation:** `python3 codex-out/json/cli-red.py annotate`  
**Runs:** 3/3 red, plus CLI confirmation. [Full output](logs/atomic-annotate-repeat-1.log).

```json
{
  "code": 1,
  "data": {
    "error": "--status must be one of open|done|deleted"
  },
  "beforeState": "Recall improves memory.",
  "afterState": "Spacing practice helps retention.",
  "changed": [
    "items/2026/learning-01M8FS1EWDD9881QY8HPDHAGBJ/annotations.json-scout.jsonl"
  ]
}
```

**Minimised steps:** Add a highlight on `Recall improves memory.` in a source that also contains `Spacing practice helps retention.` Run `ore annotate <highlight> --exact 'Spacing practice helps retention.' --status invalid --json`.

**Expected:** Reject the status before appending any revision. **Actual:** Exit 1 with the correct allowed-status message, but the highlight now selects the second passage. The annotations JSONL gained a revision.

**Ranked hypotheses and probes:** (1) Passage move precedes validation of the other flags; confirmed. (2) Invalid status is silently accepted; rejected: the status error is real and the status stays unchanged. (3) The fixture had already moved the highlight; rejected by the before/after passage printed in the loop. `atomic-probes.ts` shows invalid status alone writes nothing; valid passage move alone changes exactly the same log.

**Cause:** `packages/cli/src/cmd-items.ts:325` calls `moveHighlight` before validating intent/status at 328–329. The same failure ordering applies to an invalid `--intent`.

### JSON-05 — A rejected course filing still renames the course

**S2 · Both.** The course title changes despite the unknown-skill failure.

**Red command:** `bun codex-out/json/atomic.ts course`  
**Actual CLI confirmation:** `python3 codex-out/json/cli-red.py course`  
**Runs:** 3/3 red, plus CLI confirmation. [Full output](logs/atomic-course-repeat-1.log).

```json
{
  "code": 1,
  "data": {
    "error": "unknown skill \"missing\""
  },
  "beforeState": "Original course",
  "afterState": "Changed despite failure",
  "changed": [
    "items/2026/learning-01M8FS1EDRYB8FP9JK196WDHXW/doc.md"
  ]
}
```

**Minimised steps:** Create one lesson with course ID `course-scout` and title `Original course`. Run `ore course set course-scout --title 'Changed despite failure' --skills missing --json`.

**Expected:** Refuse the skill without changing the course. **Actual:** Exit 1, but the saved lesson's `course.title` is already the new title.

**Ranked hypotheses and probes:** (1) Rename commits before skill validation; confirmed. (2) The missing skill is actually accepted and failure comes from output formatting; rejected by the error and invalid-only control. (3) Only a cached/display title changes; rejected by the changed `doc.md` and direct reread. `atomic-probes.ts`: bad skill alone makes no change; title alone changes the same file.

**Cause:** `packages/cli/src/cmd-items.ts:207–208` runs `renameCourse` before `setCourseSkills`. The skill validation is inside the second operation (`packages/core/src/courses.ts:26`).

### JSON-06 — Malformed `--cards` revives F232's partial source edit

**S2 · Both · F232 recurrence through an uncovered flag.** The original unknown-source-skill guard exists; malformed `--cards` is checked after earlier metadata writes.

**Red command:** `bun codex-out/json/atomic.ts edit`  
**Actual CLI confirmation:** `python3 codex-out/json/cli-red.py edit`  
**Runs:** 3/3 red, plus CLI confirmation. [Full output](logs/atomic-edit-repeat-1.log).

```json
{
  "code": 1,
  "data": {
    "error": "JSON Parse error: Expected '}'"
  },
  "beforeState": "Learning",
  "afterState": "Changed despite failure",
  "changed": [
    "items/2026/learning-01M8FS1EMRDVHZ0GTMZPTK8ENX/doc.md"
  ]
}
```

**Minimised steps:** Add a source titled `Learning`. Run `ore edit <source> --title 'Changed despite failure' --skills learning --cards '{' --json`.

**Expected:** Parse/validate all fields before saving the title. **Actual:** Exit 1 with a JSON parse error and a permanently changed title. No success answer supplies the changed metadata.

**Ranked hypotheses and probes:** (1) `--cards` is parsed after rename; confirmed. (2) The error is from skill lookup; rejected: `learning` exists and the error is the JSON parser's. (3) Failure rollback happens after the handler returns; rejected by the independent real CLI process and post-exit file comparison. Invalid `--cards` alone leaves the source unchanged; the combined title flag is necessary for this symptom.

**Cause:** `packages/cli/src/cmd-items.ts:593–596`: title, author and priority can be saved before `JSON.parse`. The comment at 589 promises every field is checked first, but the added map is outside that preflight. See existing **F232**, `docs/reviews/findings.md:260`.

### JSON-07 — Invalid model input changes the library's AI vendor

**S2 · Both.** A failed settings change can send later work to a different vendor.

**Red command:** `bun codex-out/json/atomic.ts settings`  
**Actual CLI confirmation:** `python3 codex-out/json/cli-red.py settings`  
**Runs:** 3/3 red, plus CLI confirmation. [Full output](logs/atomic-settings-repeat-1.log).

```json
{
  "code": 1,
  "data": {
    "error": "\"bad model name\" isn’t a model name"
  },
  "beforeState": "claude",
  "afterState": "codex",
  "changed": [
    "skills.yaml"
  ]
}
```

**Minimised steps:** Initialise a scratch library using the default Claude vendor. Run `ore settings --ai codex --model 'bad model name' --json`.

**Expected:** Reject the model and keep the existing vendor/model. **Actual:** Exit 1 with the model error, while `skills.yaml` now selects Codex. No AI is needed to trigger this.

**Ranked hypotheses and probes:** (1) Vendor is saved before model validation; confirmed. (2) An environment override only changes the reported vendor; rejected: overrides are removed and the YAML changed. (3) The invalid model alone rewrites settings; rejected by the no-write invalid-only control. The newer `settings --job grade --ai codex --model 'bad model'` path correctly validates before saving; the global path does not.

**Cause:** `packages/cli/src/cmd-study.ts:291–293` saves the vendor then calls `setAiModel`; model validation occurs later at `packages/core/src/ai/models.ts:70–73`.

### JSON-08 — `cards --item` falsely reports no exercises for a unique source prefix

**S2 · Both.** The same shortened source ID opens correctly with `show` but reports an empty exercise list.

**Red command:** `bun codex-out/json/ids.ts`  
**Actual CLI confirmation:** `python3 codex-out/json/cli-red.py prefix`  
**Runs:** 3/3 red, plus CLI confirmation. [Full output](logs/ids-repeat-1.log).

```json
{
  "unique": "01M8FRZBJ",
  "full": [
    "01M8FRZBK4AVRNAVM5QY20EDG6"
  ],
  "prefix": {
    "code": 0,
    "data": []
  },
  "show": "01M8FRZBJZS68R6ASM5C6ND9YD",
  "suffix": [
    "01M8FRZBK4AVRNAVM5QY20EDG6"
  ]
}
```

**Minimised steps:** Create a source with an exercise. Choose a unique prefix of its ID. Compare `ore show <prefix> --json`, `ore cards --item <full-id> --json`, and `ore cards --item <prefix> --json`.

**Expected:** The prefix and full ID identify the same source and exercises. **Actual:** Full ID and unique suffix return its exercise; unique prefix returns `[]` with exit 0. Missing and ambiguous prefixes also silently return `[]` instead of an ID error.

**Ranked hypotheses and probes:** (1) The filter handles suffixes but not prefixes; confirmed by full/prefix/suffix comparisons. (2) Exercise metadata points to another source; rejected by the full-ID result and saved `item`. (3) An index omits the exercise; rejected by the same-run full-ID result and the implementation's direct list filter.

**Cause:** `packages/cli/src/cmd-study.ts:74–77` compares exact IDs or `.endsWith(item)` instead of resolving the source with `findItem`. `findItem` at `packages/core/src/items.ts:267–284` supports unique prefixes and refuses ambiguity; `due --source` uses it correctly.

### JSON-09 — Try mutation answers omit a field their shared type requires

**S3 · Both.** A typed consumer can receive `undefined` where `answers.Try` guarantees a string. This report does not claim an observed UI crash: Forge currently reloads the list after its mutation.

**Red command:** `bun codex-out/json/shape.ts`  
**Actual CLI confirmation:** `python3 codex-out/json/cli-red.py try`  
**Runs:** 3/3 red, plus CLI confirmation; five recorded mutation answers also fail the broader checker. [Full output](logs/shape-repeat-1.log), [35-answer shape check](types.json).

```text
try-add   code=0  missing=["item_title"]
try-plan  code=0  missing=["item_title"]
tried     code=0  missing=["item_title"]
tries     code=0  missing=[]
AssertionError: answers.ts Try promises item_title for try and tried
```

**Minimised steps:** `ore try --skill learning --plan 'Recall one idea' --json`; use its ID with `ore try <id> --when 'After coffee' --json` and `ore tried <id> --json`; compare to `ore tries --skill learning --json`.

**Expected:** Each ordinary Try answer has `item_title: string`, or a separate mutation-answer type accurately documents its shape. **Actual:** All three mutations return the raw annotation without that key; listing adds it. `tried --line` is a different, intentionally separate AI response and is not included in this finding.

**Ranked hypotheses and probes:** (1) Mutations return `Annotation` while the type aliases `TryView`; confirmed by the three handler branches. (2) JSON removes an undefined field from every path; rejected: list results contain a real title. (3) A source-less Try intentionally has no title; rejected: the newly created snippet has a title and listing the same ID supplies it. The real CLI matches the handler output.

**Cause:** `packages/cli/src/answers.ts:30–31` names `TryView` for all three commands; `packages/core/src/tries.ts:15–16` requires `item_title`. `packages/cli/src/cmd-items.ts:411–415,429–431` returns the raw annotation, unlike the list builder at `packages/core/src/tries.ts:52`.

### JSON-10 — Valid JSON with the wrong structure produces internal errors without a next step

**S3 · Both.** Tutor/history flags accept syntactically valid JSON without checking its shape, so an agent gets JavaScript method errors instead of instructions to correct the flag.

**Red command:** `bun codex-out/json/structured-errors.ts`  
**Actual CLI confirmation:** `python3 codex-out/json/cli-red.py error`  
**Runs:** All five cases fail the actionable-error assertion in 3/3 runs; CLI confirmations are in the matrices and the separate red command. [Full output](logs/structured-errors-repeat-1.log), [exact CLI error](logs/cli-error.json).

```text
tutor --earlier '{}'       -> earlier.map is not a function
tutor --files '{}'         -> fs.flatMap is not a function
tutor --earlier '[null]'   -> null is not an object (evaluating 't.message')
ask-library --earlier '{}' -> earlier.slice is not a function
ask-library --earlier '[null]' -> null is not an object (evaluating 't.question')
```

**Minimised steps:** In a scratch library, run `ore tutor Recall --earlier '{}' --json` (or one of the other four inputs above). No AI call is necessary.

**Expected:** Exit nonzero with an error naming `--earlier`/`--files`, the required array/object structure, and how to correct it. **Actual:** Exit 1 with `{ "error": "earlier.map is not a function …" }`, including implementation expressions. Text mode repeats the internal error. This is **not** malformed stdout or an uncaught process crash: JSON remains one value, stderr is one plain `ore:` line, and no canonical data changes.

**Ranked hypotheses and probes:** (1) Only JSON syntax is checked, not array/member shape; confirmed. (2) The AI vendor emits the failure; rejected: these inputs fail before reaching the fixture vendor, and valid arrays work with it. (3) Top-level error handling loses an existing helpful message; rejected: the handler itself exposes the method error. Syntactically broken `--earlier '{'` does get a useful flag/schema message, so the missing check is specifically semantic shape validation.

**Cause:** `packages/cli/src/cmd-ai.ts:114–117,128–139` assigns `JSON.parse` results directly to typed arrays. They reach `.map()`/`.flatMap()` at `packages/core/src/ai/tutor.ts:216,227`, and `.slice()`/member access at `packages/core/src/ai/ask.ts:171–172`.

## Leads

- `card edit` can print “nothing was saved” if an external editor writes and then exits nonzero. No new red loop was built; this overlaps F236's already-tested editor failure path and was left alone.
- The batch `enrich`, `catch-up`, course-add and inbox-import branches have their own partial-success result shapes, not always a top-level `{error}`. No new finding: earlier sweeps cover parts of this, and live batch failures were outside this recheck's fixtures. Their intended exception to the blanket failure contract needs a focused review.
- Coverage is one successful branch per top-level command, **not every branch or every nested field**. Remaining work includes actual PDF table reading, external course preview/import, populated catch-up, eligible AI remix generation, real model discovery, streaming tutor sessions, and all attachment formats. No failure is inferred from untested ground.

## What passed

- **JSON transport:** Every JSON-mode CLI result in the recorded matrices and confirmations parsed as exactly one value; no error printed a second JSON object on stderr. Three text-mode errors exited nonzero; the tutor wording problem is JSON-10.
- **Required answer fields:** Of 35 checked responses across 12 typed families, 30 passed; the five failures were the Try mutation omission in JSON-09. Checked nonempty arrays, scalar types, required properties, and explicit `null` for due dates/unsaved diagram scenes. The checker is deliberately explicit rather than a full TypeScript type-to-schema generator.
- **ID controls:** 77 CLI checks in [id-matrix.json](id-matrix.json) passed their stated expectations: missing/ambiguous source, exercise and annotation references reject without canonical writes; normal unique prefixes resolve; archived sources remain readable/editable; retired exercises remain readable/editable; a deleted annotation can be restored by its unique prefix. JSON-03 and JSON-08 are the separate failing resolvers.
- **Input validation:** Ratings 0/9, confidence 4, negative/nonnumeric limits, missing flag values, invalid reminder/time input, unknown job/vendor/skill, malformed chat data and incompatible `tried --line` flags reject. Repeated scalar flags use the final value; repeated booleans are idempotent. Repetition alone is not called a bug.
- **Atomic controls:** Bad skill/model/status/map input by itself writes nothing. Valid individual edits work. Per-job AI/model settings reject an invalid model without changing settings. See [atomic-probes.log](logs/atomic-probes.log).
- **Feed:** Find/follow/refresh/set/arrange/read/unread/open/close/unfollow/restore with static RSS/HTML fetch fixtures; no real sites or server.
- **Inbox and imports:** Link/file queue lifecycle and remove/undo, a local HTML import/reimport, authored text/snippet capture, and a file import from the queue. Init only bootstrapped scratch data; its old race ground was not retested.
- **Learning mutations:** Course lesson listing/set/archive/undo, Try planning/completion, Dig start/ask/answer/end/drop, prequestion attempts, review/session lifecycle and undo, notes and diagrams, cut/page-text undo/redo, suggested-skill accept/dismiss/undo, figure and table-cell exercises.
- **AI-shaped answers:** Grade, ask-about-exercise, explain, checking/own marks, recall feedback, ask-library, tutor, tutor exercise, research, Try line and enrichment used deterministic fixture outputs and retained their expected structures. This tests serialization and handling, not AI quality.
- **Chats/settings/usage:** Chat attach/save/read/list/merge/delete/restore, job-specific AI settings, Claude model listing, and usage summaries after stubbed calls. No real credentials or live AI were used.
- **Known-row controls:** F232's ordinary unknown-skill preflight remains present; the malformed-map recurrence is separately identified. F234's missing-skill add/inbox paths reject. F332 card-show/card-set answer parity passed for the exercised original/variant branches. No claim of a full regression pass for every historic row.
- **Workspace boundary:** No tracked repository changes. Reports, scripts, fixture executables, local HTML and scratch libraries are all inside `codex-out/json/`; no app install, browser, service, watcher, full test suite, benchmark or history-restoration command was run.

## Evidence index

| Artifact | Purpose |
| --- | --- |
| [matrix.json](matrix.json), [matrix.py](matrix.py) | 140 actual CLI calls, including three text errors |
| [more.json](more.json), [more.py](more.py) | 54 additional actual CLI calls, including stubbed AI |
| [other.json](other.json), [other.ts](other.ts) | 27 direct shared-handler calls, static feed/local-file fixtures |
| [id-matrix.json](id-matrix.json), [id-matrix.py](id-matrix.py) | 77 ID/parser checks |
| [types.json](types.json), [typecheck-answers.ts](typecheck-answers.ts) | Required-field comparison of 35 answers |
| [logs/repeats.json](logs/repeats.json) | Three fresh reproductions for each of ten findings |
| [logs/cli-confirmations.json](logs/cli-confirmations.json), [cli-red.py](cli-red.py) | Ten independent self-seeding CLI red loops |
| [atomic-probes.ts](atomic-probes.ts), [cards-probes.ts](cards-probes.ts) | Hypothesis-splitting controls |

The broad matrices retain exploratory miscalls for transparency: the first figure fixture was not linked in the source, pasted Markdown cannot be reimported as an original file, and `suggested-skill --dismiss` was the wrong invocation. Correct figure, local-HTML reimport, and `suggested-skill <source> dismiss` paths subsequently passed. A combined `tried --again --next` call was initially tagged as an expected failure; its documented implementation accepts the next plan, so it is not a finding. These are harness assumptions, not Ore failures.
