# Ore CLI recheck — agent following the guides

I read the working agreement, SPEC, findings ledger, sweep history, the 2026-11-15 CLI report, the deep-scan-3 CLI/init coverage, the relevant decisions, both agent guides and their exercise-editing reference, and the changed CLI/core paths. I covered the guided review/add/read/fix/research/library-question paths, newer command families, and overlapping writes: 62 real CLI invocations, 41 additional command-handler invocations, and 66 help invocations. AI and network responses were fixtures. I skipped live AI, live websites, native capture/OCR/install operations, the app/browser/device, whole-suite tests, and snapshot restoration. To obey the one-Bun-process limit, concurrency probes overlapped actual handlers/core operations **inside one process**; they do not establish two-process CLI correctness. This is findings-only: all artifacts and scratch libraries are under `codex-out/agent/`; no tracked source file was changed.

- Checkout: `32c979544e3c72b5d1e35b0ade1b63b05fcc843b`.
- Environment: macOS arm64, Bun 1.4.4; 2026-11-27 local / 2026-11-28 UTC.
- Seven findings: **2 S1, 5 S2**. Eight red scripts, with two symptoms grouped under the review-guide finding.
- Repeat evidence: [confirmation.json](confirmation.json). Each final red script reached its intended assertion **3/3**; each took under one second wall time. Five causal-control scripts passed. `python3 codex-out/agent/confirm.py` repeats these sequentially and validates that they fail for the intended assertions, not setup errors.
- Reproduction commands below run from the repository root. Each red Bun script seeds/resets only its own named scratch library. Red means exit 1 at its assertion; no product fix was applied.

## Findings

### AGENT-01 — The guide's fixed heredoc delimiter lets answer text execute shell commands

**S1 · Mac · New finding.** This is a defect in the agent-facing shell recipe, not shell evaluation inside Ore's argument parser. It affects an agent mechanically inserting arbitrary learner text as the guide requires.

**Red command:**

```sh
bun codex-out/agent/red-heredoc.ts
```

Captured output:

```text
[DEEP] Exact guide heredoc; shell exit: 0 answer text executed: true
[DEEP] stdout: grade called safely
[DEEP] stderr: zsh:7: command not found: ORE_EOF
AssertionError: the quoted-heredoc guide must keep all learner text as data, including its fixed delimiter
```

Full output: [run 1](logs/red-heredoc-confirm-1.log). **3/3** confirmed.

**Minimized steps:** Extract the literal “Shell safety” recipe from SKILL.md. Substitute an answer containing a standalone `ORE_EOF` line followed by a harmless `printf` that writes `codex-out/agent/heredoc-executed.txt`. Run the recipe with `ore` replaced by an inert shell function. No real CLI, AI, or outside write is needed for this proof.

**Expected:** All answer text is data passed to `--answer`; no text from the answer executes. **Actual:** The answer closes the heredoc early. Its next line executes, and the overall shell command still exits zero because the final stubbed `ore` call succeeds. A quoted heredoc disables expansion *inside* the body; it does not make its fixed terminating line safe when that line appears in the body.

**Ranked hypotheses and probes:** (1) Fixed-delimiter collision; (2) command substitution expands inside the quoted body; (3) `read` treats answer contents as code; (4) the stub or a stale marker creates a false positive. `probe-heredoc.ts` removes the marker before each case: ordinary `$(...)` stays literal; adding a leading space to the answer's delimiter prevents execution; changing only the recipe's delimiter to one absent from the answer preserves the complete answer. The stub only prints. This isolates hypothesis 1.

**Cause:** `skills/ore/SKILL.md:26–33`, especially the fixed `ORE_EOF` at lines 28–30; the same recipe is repeated at lines 72–75 and 90–93. No instruction checks that the delimiter is absent from the supplied text. Control output: [heredoc controls](logs/probe-heredoc-confirmed.log).

### AGENT-02 — Two answer contributions can share their edit ID, so editing the second overwrites the first

**S1 · Both (shared core; proved headlessly on Mac) · New answer-path finding.** Related mechanism to F560/F595, but those rows fix review receipts and review Undo, not question-answer contributions.

**Red command:**

```sh
bun codex-out/agent/red-answer-id.ts
```

Captured output:

```text
[DEEP] before [{"ts":"2026-11-28T00:28:28.869Z","text":"First explanation"},{"ts":"2026-11-28T00:28:28.869Z","text":"Second explanation"}]
[DEEP] after [{"ts":"2026-11-28T00:28:28.869Z","text":"Second explanation corrected"},{"ts":"2026-11-28T00:28:28.869Z","text":"Second explanation"}]
AssertionError: editing the second answer must not overwrite the first
```

Full output: [run 1](logs/red-answer-id-confirm-1.log). **3/3** confirmed with the clock pinned only across the two appends. A separate unmodified-clock check observed **3 collisions in 30 sequential answer pairs**, recorded in [concurrency.log](logs/concurrency.log); the deterministic loop does not depend on that frequency.

**Minimized steps:** Create one question highlight. Append two distinct answer contributions during one millisecond. Read the second contribution's `ts`. Run `answer <question> --edit <second.ts> --text 'Second explanation corrected'` and reread the canonical annotation.

**Expected:** The first contribution remains unchanged and the second is edited. **Actual:** The first is replaced; the second remains unchanged. The second contribution is not individually addressable by the documented timestamp API. `--remove` uses the same first-match selection.

**Ranked hypotheses and probes:** (1) Nonunique timestamp used as identity; (2) stale `questions` output; (3) the lock loses the second append. Both distinct contributions exist on disk before the edit, excluding lost append. `probe-causes.ts` rereads through `findAnnotation`; contributions written with distinct timestamps edit the second correctly, excluding stale display and confirming identity collision.

**Cause:** `packages/core/src/questions.ts:89` appends `nowIso()` without uniqueness; lines 85–88 edit the first matching timestamp, and lines 79–83 remove the first matching timestamp. The lock at line 75 serializes writes but does not make millisecond timestamps unique. Control output: [answer/attribution controls](logs/probe-causes-confirmed.log).

### AGENT-03 — Following the exercise-fix guide keeps the previous AI author's stamp

**S2 · Mac · Remaining guide path of F709**, whose core `card set --ai` fix works. Also overlaps the guide-maintenance area of F238; this is not a claim that direct file-writing instructions returned.

**Red command:**

```sh
bun codex-out/agent/red-guide-stamp.ts
```

Captured output:

```text
[DEEP] guide fix stamp: {"vendor":"claude","model":"fixture-original","prompt_version":"enrich@fixture"}
[DEEP] actual author of the replacement wording: {"vendor":"claude","model":"fixture-scout","prompt_version":"chat@2"}
AssertionError: following the guide must attribute AI replacement wording to its author
```

Full output: [run 1](logs/red-guide-stamp-confirm-1.log). **3/3** confirmed.

**Minimized steps:** Seed an exercise with its original AI stamp. Ask for a rewrite through the actual `ask` handler and a fake `claude` executable; the adapter returns the rewrite and its new stamp. Apply the proposed question/answer using the exact `card set` shape in the guide, which omits `--ai`. Read the saved exercise.

**Expected:** AI-authored replacement wording carries the author/model/prompt that produced it, as required by CLAUDE.md's AI attribution rule. **Actual:** New wording is attributed to the old enrichment model/prompt. The exercise reference explicitly says to leave the `ai` field unchanged.

**Ranked hypotheses and probes:** (1) The guide omits the attribution argument; (2) the supported argument fails to persist; (3) returned metadata differs from disk. `probe-causes.ts` sets an explicit new `--ai` stamp and verifies it using canonical `findCard`; `--ai null` also clears it correctly. Thus the F709 API fix is intact and the remaining failure is the guided caller.

**Cause:** `skills/ore/reference/cards.md:18` says `# leave as is`; line 38 and `skills/ore/SKILL.md:135` prescribe a write without `--ai`. `packages/core/src/cards.ts:210–214` intentionally retains the stamp when omitted. `docs/SPEC.md`'s CLI `card set` entry also omits `--ai`. Control output: [answer/attribution controls](logs/probe-causes-confirmed.log).

### AGENT-04 — The quiz guide treats queue text as the complete exercise, skipping remixes and figures

**S2 · Mac · New guide finding · D66, D166.** Two red loops establish one caller error: using `due.question` as the complete probe instead of obtaining the current review presentation.

**Red commands:**

```sh
bun codex-out/agent/red-guide-review.ts
bun codex-out/agent/red-guide-figure.ts
```

Captured output:

```text
[DEEP] guide presents: Why space retrieval?
[DEEP] card show --review presents: An exam is a week away. How would you distribute three practice sessions? variant: variant-ready
AssertionError: the guide must ask the version due for review (D66)

[DEEP] guide probe: What’s under the box?
[DEEP] guide queue figure: undefined figure_file: undefined
[DEEP] available through card show: {"src":"assets/plant.svg","box":[0.05,0.05,0.4,0.2]}
AssertionError: the guide probe must include the covered figure, not only “What’s under the box?”
```

Full outputs: [remix run 1](logs/red-guide-review-confirm-1.log), [figure run 1](logs/red-guide-figure-confirm-1.log). **3/3 each** confirmed.

**Minimized steps:** For the remix, seed an overdue Explain exercise with two successful past reviews and a ready variant; start a session and fetch `due --start --skill learning --limit 12`, as the guide says. Compare its instructed probe with `card show <id> --review`. For the figure, create one image-occlusion exercise on a saved SVG. Fetch its queue row and compare it with `card show --review`. The figure loop uses `due --source` to include today's fixture immediately; this does not change the queue row's fields.

**Expected:** The learner receives the selected remix, or the picture with its target region covered. Subsequent grade/review calls retain the shown variant's ID. **Actual:** The guided session always asks the base question, grades/reviews without `--variant`, and offers a figure's generic question without its image or coordinates. The figure exercise cannot be answered from that probe.

**Ranked hypotheses and probes:** (1) Guide selects the wrong representation; (2) seeded variant is ineligible; (3) remix setting is off; (4) figure asset is absent. `card show --review` selects the variant while remix is enabled, and changing only `goal --remix false` returns the base question. The figure's `figure_file` from `card show` exists. The queue deliberately has neither variant selection nor figure data. Controls isolate the guide, not core remix selection or missing media.

**Cause:** `skills/ore/SKILL.md:67` says to use the queue's `question` field and “Never more”; lines 75–76 and 94 prescribe base grade/show/review calls. `packages/cli/src/cmd-study.ts:46–50` is the intentionally compact queue response. The needed figure representation is at lines 13–16 and 31–34; review selection is at lines 102–106. Controls: [review/inbox](logs/probe-review-inbox-confirmed.log), [finish/figure](logs/probe-finish-figure-confirmed.log). No visual renderer or real agent behavior was tested; the faulty input selection is headless and deterministic.

### AGENT-05 — Retrying an unchanged inbox import failure reports success

**S2 · Mac · F235 reproduced on its retry path.** The first failing import correctly returns failure; the retry is the uncovered case.

**Red command:**

```sh
bun codex-out/agent/red-inbox-retry.ts
```

Captured output (the full first response, including the retained HTTP error, is in the linked log):

```text
[DEEP] retry exit: 0 body: {"added":[],"failed":[],"filled":[]}
[DEEP] entries still waiting: 1
AssertionError: retry where every import failed must exit nonzero (F235, SPEC)
```

Full output: [run 1](logs/red-inbox-retry-confirm-1.log). **3/3** confirmed. The script executes the real inbox handler and checks its returned CLI exit code; `ore.ts` returns that code unchanged.

**Minimized steps:** Queue one link owned by the current fixture device. Stub its fetch to HTTP 404. Import twice. First import returns exit 1 with one failure. The second performs the fetch again and fails identically, but returns empty result arrays and exit 0.

**Expected:** Every attempted import failed, so the retry remains a failure with the reason available, as SPEC and F235 require. **Actual:** An agent using the guide's exit-code rule sees success despite no successful import and an item still waiting.

**Ranked hypotheses and probes:** (1) Unchanged errors are filtered out of the returned failure list; (2) ownership rules skip the retry; (3) a successful add/fill legitimately yields zero. `probe-review-inbox.ts` counts one fetch on retry, with no added or filled item. Changing only HTTP 404 to 503 produces exit 1. This isolates suppression of unchanged errors.

**Cause:** `packages/core/src/inbox.ts:177` appends to `failed` only if the error text changed; `packages/cli/src/cmd-items.ts:179–180` uses that filtered list to decide whether all imports failed. Control output: [review/inbox controls](logs/probe-review-inbox-confirmed.log).

### AGENT-06 — The “I read it” guide never marks the source finished

**S2 · Mac · New guided-workflow finding · D19.** This concerns a complete read, not the separate partway-finish workflow.

**Red command:**

```sh
bun codex-out/agent/red-guide-finish.ts
```

Captured output:

```text
[DEEP] after guide finish: status=inbox, finished_at=undefined, prequestion drafts pending=0
AssertionError: a source the learner finished through mode 3 should be Done, enabling its prequestion drafts
```

Full output: [run 1](logs/red-guide-finish-confirm-1.log). **3/3** confirmed.

**Minimized steps:** Seed a captured/enriched source with two prequestions. Follow every writing step in Mode 3: save both before attempts, save both after answers after the learner says it is read, save free recall, and append his use/connection line. Inspect the source and `pendingPrequestions`.

**Expected:** A finished source records Done/finished_at, making its prequestions eligible for the D19 exercise drafting that follows finishing. **Actual:** Its answers are stored, but the source remains in Inbox and neither prequestion is eligible. Starting from Reading has the same missing finish transition; the red fixture starts from the state produced by Add.

**Ranked hypotheses and probes:** (1) Guide lacks a status transition; (2) answer/recall persistence fails; (3) another draft eligibility requirement blocks these questions. `probe-finish-figure.ts` changes only `status <id> done` after the guided sequence: pending prequestions immediately become 2. The already-saved answers were not the problem. No AI is needed to prove this eligibility failure.

**Cause:** `skills/ore/SKILL.md:126–130` covers the after-reading workflow but never calls `ore status <id> done`; Mode 2 routes directly into it at line 118. `packages/core/src/ai/enrich.ts:100–104` correctly excludes unfinished sources. The existing status handler is `packages/cli/src/cmd-items.ts:561–569`. Control output: [finish/figure controls](logs/probe-finish-figure-confirmed.log).

### AGENT-07 — A CLI Dig leaves the learner's words out of the promised skill note

**S2 · Mac · New CLI/guide gap · D325.** The words are retained in `digs.json`; this is missing promised note content and history, not total loss of the Dig.

**Red command:**

```sh
bun codex-out/agent/red-dig-note.ts
```

Captured output:

```text
[DEEP] Saved Dig: I would spread retrieval over several days and check what I missed. done: true
[DEEP] Skill note exists: false contains learner words: false
AssertionError: D325 and generated library AGENTS.md promise Dig words in the skill note
```

Full output: [run 1](logs/red-dig-note-confirm-1.log). **3/3** confirmed.

**Minimized steps:** Set a skill goal. Save the learner's memory response using `dig learning --text '<his words>'`. Read `notes --skill learning`. This fixture has fewer than two key points, so the Dig is already finished without AI.

**Expected:** The Dig exists in its JSON record and the learner's skill note under `## Dig, <date>`, as D325 and the generated guide describe. **Actual:** Only the JSON record exists. An agent reading the skill note cannot find the response; note-derived Dig history does not see it either.

**Ranked hypotheses and probes:** (1) CLI misses a note append that the app handles; (2) note writing is deferred until `--done`; (3) probe checks the wrong path. `probe-dig.ts` reads through the canonical `ore notes --skill` command, calls `dig --done`, and finds the note still empty. An explicit `notes --append ... --heading 'Dig, ...'` makes the words appear. `Dig.tsx:82` performs exactly that append before calling `ore dig` at line 87. The CLI has no equivalent step.

**Cause:** `packages/core/src/templates/library-agents.md:17` promises both locations without explaining the extra write; `packages/cli/src/cmd-items.ts:444–447` calls only `startDig`; `packages/core/src/digs.ts:117–126` writes only the Dig record. The app's separate append is `apps/desktop/src/Dig.tsx:82`; note-derived history is `apps/desktop/src/SkillPage.tsx:490–496`. Control output: [Dig controls](logs/probe-dig-confirmed.log).

## Leads and documentation inventory

These are not additional counted findings without an independent red symptom. This keeps harmless omissions and already-known behavior separate from the seven findings above.

- `course set --title ... --skills <invalid>` appears to rename first and validate skills second (`cmd-items.ts:207–208`). No dedicated red loop; possible partial write, not confirmed here.
- SKILL.md:69 says to “log” a `no idea` answer, while line 20 requires a separate learner rating reply; line 89 accepts an “empty” rating reply. This is ambiguous guidance around D21. No live-agent evaluation demonstrated an invented rating, so it remains a lead. The explicit learner-rating path passed.
- True two-process `&` writes remain untested under the single-Bun-process constraint. Handler overlap passes cannot exclude process-specific locking or snapshot races.
- Native `add --tab`, OCR/table reading/install/remove, local media tools, and real vendor model enumeration remain untested. `models codex` was only the no-vendor/fallback path with the denying stub.

### SPEC CLI omissions found by comparison with command definitions

The older F238 documentation-drift area still needs maintenance. [inventory.json](inventory.json) records all 65 commands, flags, usages and per-command-line omissions; [help-output.json](help-output.json) captures top-level help plus every command's help. `tried --again` is a false positive in the mechanical per-line inventory: SPEC mentions it in the adjacent `try` entry, so it is **not** missing overall. All named top-level commands in the two guides exist. Help is generated from the live command registry, and all 66 help invocations exited zero. That is not a claim that every option's semantics was exercised.

| Missing from SPEC's relevant CLI entry | Why an agent may need it / disposition |
| --- | --- |
| `card --ai` | Needed when applying AI wording; confirmed AGENT-03, remaining F709 guide path. |
| `chat --set --merge` | Needed when saving stale chat copies concurrently; SPEC documents replacement only. F316 already names the distinction; merge path passed here. |
| `course archive --lessons` | Needed to undo only the lessons changed by that archive. F573 already documents the fix. Selective restore passed; not recounted as a new bug. |
| `inbox --remove --keep`, `inbox --restore` | Needed for reversible removal. F653 documents the file-retention fix; kept file removal/restore/import passed. |
| `recall --chapter N --undo` | Needed to take back a chapter recall; known F512 area, not a new runtime finding. |
| `edit --cards` | Selective exercise restoration support omitted; not independently exercised. |
| `search --sources`, `--within` | Source-oriented and list-restricted search omitted; basic search passed, these modes were read only. |
| `tutor --at` | Section context for a question while reading omitted; tutor with `--item` passed, section-specific effect not asserted. |
| `ask --stream` | Progress output omitted; no claim of wrong final answer. |
| `highlight --looked-up`, `annotate --looked-up` | Explain-use marker omitted; no independent wrong-state loop here. |
| Entire `usage` command | No CLI entry for inspecting AI job spending; actual command passed in the seeded agent day. |

The skill's missing `card show --review`/variant handling and finish transition are covered by AGENT-04 and AGENT-06. The generated guide's missing Dig note-write step is AGENT-07. I did not treat every advanced command absent from the short coaching skill as a defect: the generated guide explicitly directs agents to `ore --help`.

## What passed

- **62 sequential real CLI calls:** [cli-day.py](cli-day.py), [cli-day.json](cli-day.json), [extra-day.py](extra-day.py), [extra-day.json](extra-day.json). All reported exit zero where success was expected. These use separate bounded Bun subprocesses, never simultaneous ones.
- **D21 explicit rating path:** stubbed grade proposed 3 and wrote no review; a learner-supplied rating of 2 was retained as 2, with the AI proposal/stamp separately recorded.
- **Capture and drafting:** URL via an owned in-memory HTTP fixture and Markdown via stdin; file under a skill; key-point highlight; explicit stubbed enrich produced an attributed exercise. Background enrich was disabled as required, so autonomous completion was not tested.
- **Questions and research:** question highlight, learner-written answer linked to a source, done state, stubbed three-source research result, and selected source add with `--for`; basic library search/read/stat/skills/cards/notes/backlinks paths.
- **Source lifecycle:** archive/list archived/restore; prequestion and recall persistence; notes append. The missing guided finish transition is isolated above.
- **Diagrams and chat:** actual stdin diagram save/read/link/rename plus caller's note-link update; actual stdin chat save with merge/read/list/delete/restore with keep-time.
- **Newer commands:** [breadth.ts](breadth.ts) made 41 successful handler calls: passage-free try creation/pick/obstacle, `tried --again`/Undo, tries filters, table-cell exercise/retire/explicit-state restore, cut/Undo/Redo, suggested-skill accept/dismiss/Undo, course title/skills/list/selective archive Undo, inbox kept file restore/import, all feed subcommands on an owned RSS fixture, tables status, and page-text add/Undo/Redo. [Full log](logs/breadth.log).
- **AI controls and settings:** fake tutor reply, usage readout, Claude aliases/Codex fallback, grade-job vendor/model change and reset; real AI execution was blocked by the fake executables first on PATH.
- **Overlapping writes, single process:** three review pairs retained six distinct receipts; review plus exercise edit retained both; two note appends retained both; source title plus its skill name retained both; two stale chat copies using the merge core path retained all turns; two inbox additions and two answer appends retained both. [concurrency.ts](concurrency.ts), [output](logs/concurrency.log). The later answer edit fails AGENT-02.
- **Causal controls:** distinct answer timestamps; explicit replacement/cleared AI stamps; core remix selection with setting toggled; stored figure file; inbox retry fetch counted and error changed; explicit Done enabling prequestion drafts; explicit skill-note append; and collision-free heredoc delimiter. [confirmation.json](confirmation.json).
- **Workspace boundary:** final tracked `git status --short` was empty. No findings ledger, source, skill, decision, or SPEC edits were made; no commit/push was attempted for this findings-only task.
