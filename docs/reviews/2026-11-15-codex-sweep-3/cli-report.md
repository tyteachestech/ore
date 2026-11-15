# CLI / `/ore` sweep — cli

Tested the CLI, `/ore` skill, generated library instructions, and SPEC CLI reference with 836 recorded invocations: all 62 top-level commands have a successful exercised branch, every command's help and unknown-flag path were captured, and named subcommands received help/missing-input checks. Ran two simulated agent days, 48 pairs of concurrent CLI processes, two Mac/CLI interaction runs, library-folder and reimport round-trips, and 12 independent doctor corruption cases twice each. Found **10 issues: eight S2 and two S3; no confirmed S1**. This is findings only. AI successes use deterministic vendor fixtures, not live AI; optional global tool installation, foreground browser capture, full external course import and iPhone testing were skipped. Exact coverage and seed limitations are in [coverage.md](coverage.md).

## Findings

All runtime findings below reproduced twice. Commands mean `ORE_LIBRARY=<the named scratch library> bun packages/cli/src/ore.ts … --json`, from the repository root. Use fresh copies of the assigned seed for destructive reproductions. IDs are in [ids.json](ids.json). CLI findings have no useful screenshot; their stdout, exit status and changed canonical paths are in [finding-evidence.json](finding-evidence.json) and [commands.jsonl](commands.jsonl). No findings were added to the repository's shared registry, per the preamble.

### CLI-01 — A rejected multi-field edit still changes the source — S2, Mac CLI

1. Read the title and author of source `01M7EPHHH0DDEFT8AE3EMWNRFP`.
2. Run `ore edit <id> --title "Changed despite failure" --author "Already changed" --skills missing --json`.
3. Read the source again.

**Expected:** Validate all fields before changing the source; an unknown skill should leave it unchanged.
**Actual:** Exit 1, `{"error":"unknown skill \"missing\""}`, but the title and author have already changed in `doc.md`. An agent obeying the skill's “stop on any non-zero exit” leaves that partial result behind. **2/2**, `atomic-0` and `atomic-1`.

Suspect: `packages/cli/src/cmd-items.ts:487`–489 invokes three separately committed writes, with skills last. Evidence tag: `repeat-candidate` / `edit`.

### CLI-02 — Adding for a missing question leaves a source behind after failure — S2, Mac CLI

1. Pipe a new Markdown source into `ore add --stdin --for missing --no-enrich --json`.
2. Observe its exit code and error.
3. List sources and inspect the new source directory.

**Expected:** Reject the nonexistent question before ingesting, or roll back the new source.
**Actual:** Exit 1 with `no annotation matches "missing"`, but both `doc.md` and `source.md` remain. The response does not return the new source ID, and normal post-add processing has not run. **2/2**, unique source text in each atomic library.

Suspect: `packages/cli/src/cmd-items.ts:91`–98 saves before `matchQuestion` validates `--for`. Evidence tag: `repeat-candidate` / `add`.

### CLI-03 — Import accepts a nonexistent skill and saves a dangling assignment — S2, Mac CLI

1. On a fresh copy with no skill named `missing`, pipe new text into `ore add --stdin --skill missing --no-enrich --json`.
2. Read the saved source's `skills`, then run `ore doctor --json`.
3. Compare with `ore edit <existing-id> --skills missing --json`.

**Expected:** The same unknown-skill validation for creation and later filing.
**Actual:** Add exits 0 and saves `skills: [missing]`; doctor warns about the unknown skill. Edit rejects that same ID. An agent's typo produces a source assigned to no real sidebar skill. `inbox --add … --skill missing` also accepts the invalid assignment. **2/2**, `probes-0` and `probes-1`.

Suspect: `packages/core/src/ingest/index.ts:650` and `packages/core/src/items.ts:179` pass through skill strings without checking the skill registry. Evidence tags: `probe`, `unknown-skill-followup`.

### CLI-04 — Importing an inbox where every item fails exits successfully — S2, Mac CLI

1. Queue a URL whose server returns HTTP 404 with `ore inbox --add <url>`.
2. Run `ore inbox --import --json` and inspect its exit status.
3. List the inbox again.

**Expected:** Non-zero exit when no requested import succeeded, with the failed entries retained for retry.
**Actual:** Exit 0 with `added: []`, nonempty `failed`, and `filled: []`. Entries and their helpful reasons are retained correctly, but a shell chain or an agent following the skill's exit-code rule treats the batch as success. **2/2** against a local HTTP fixture; also seen with example.com returning 404.

Suspect: `packages/cli/src/cmd-items.ts:134` returns no failure `exitCode`. Evidence tag: `inbox-all-failed`; fixture/server in `remaining.py`.

### CLI-05 — A failed editor reports success and breaks `--json` output — S2, Mac CLI

1. Set `VISUAL` and `EDITOR` to the supplied `failed-editor` script, which prints `Editor failed to open` and exits 7 without editing.
2. Run `ore card edit <id> --json`.
3. Parse stdout as JSON and inspect the process exit code.

**Expected:** A failed editor returns non-zero; the JSON interface remains parseable, or explicitly refuses an interactive edit in JSON mode.
**Actual:** Ore exits 0. Stdout is the editor's text followed by a JSON object, so JSON parsing fails. In text mode the handler's success message is `Saved <id>` even though it ignores the editor failure. **2/2**. The exercise file was not changed in this reproduction.

Suspect: `packages/cli/src/cmd-study.ts:79`–82 inherits stdout and discards the value of `proc.exited`. Evidence tag: `failed-editor`.

### CLI-06 — An AI-proposed rating can be logged without its provenance — S2, Mac CLI

1. Run `ore review <id> --rating 3 --confidence 2 --ai-rating 2 --json`, deliberately omitting `--ai-by`.
2. Inspect the appended review receipt.

**Expected:** Reject the incomplete AI proposal before logging, and request the vendor/model/prompt stamp. The project requires those fields for recorded AI output.
**Actual:** Exit 0, a real FSRS review is appended with `ai_rating: 2` and no `ai`. It becomes impossible to identify which grader proposed the differing rating. **2/2**, `probes-0` and `probes-1`.

This does **not** show the AI overriding Tyler's rating: the recorded rating remains the explicit `--rating 3`. It is a missing provenance guard.

Suspect: `packages/cli/src/cmd-study.ts:148`–157 treats `--ai-rating` and `--ai-by` independently; `packages/core/src/reviews.ts:29`–30 makes both optional. Evidence tag: `probe` / `review`.

### CLI-07 — Both agent guides explicitly instruct direct library writes — S2, Mac agent instructions

1. Read the `/ore` hard rules and “Fix a card” instructions.
2. Initialize a fresh library and read its generated `AGENTS.md`.
3. Compare their allowed writes with the current project rule, and try `ore card set …` for a wording fix.

**Expected:** Agent instructions route writes through core/CLI; unsupported edits are identified rather than silently exempted.
**Actual:** The skill explicitly exempts card Markdown and tells the agent to edit it directly. Generated `AGENTS.md` also permits direct card metadata, topic summaries, source `skills/topics/status`, prequestion wording, `skills.yaml` and source body edits. These bypass the CLI's validation, propagation and lock. `ore card set` successfully handles question/answer/rubric fixes already.

Verified against the source documents and independently generated instructions in `new-lib` and `clean-lib`; two exercise wording fixes through CLI passed in the simulated days. This is a **confirmed instruction conflict**, not a claim of observed data loss from following it.

Locations: `skills/ore/SKILL.md:24,83,135,154`; `skills/ore/reference/cards.md:38`; `packages/core/src/templates/library-agents.md:9`–15.

### CLI-08 — Doctor declares malformed session and variant objects healthy — S2, Mac CLI

1. Make two separate copies of the seed, one corruption per copy.
2. In one, add `sessions/2026-11.corruption.jsonl` containing `{"id":"bad","event":"start","ts":"yesterday"}`.
3. In the other, add a card's `.variants.jsonl` containing `{"id":"bad","card":"no-card","question":"","answer":""}`.
4. Run `ore doctor`, `ore doctor --fix`, then `ore doctor` again.

**Expected:** Identify the invalid record and its line without deleting content.
**Actual:** All return `ok: true`, zero warnings/errors, no fixes. The variant lacks required fields and is silently excluded by `readVariants`; the session is not a valid receipt. Doctor checks JSON syntax here but not the record schema. **2/2 per corruption**, four isolated cases total.

Suspect: `packages/core/src/doctor.ts:141`–143 versus `packages/core/src/remix.ts:20`–34,58 and `packages/core/src/sessions.ts:60`–68. Evidence: [doctor-results.json](doctor-results.json), cases `invalid-session-object` and `invalid-variant-object`. A separate `null` record was correctly reported, so this finding is specifically about invalid objects that parse as JSON.

### CLI-09 — Doctor's “retire the card” remedy leaves the same error and advice — S3, Mac CLI

1. In a disposable copy, replace one exercise's `item` with an absent source ID.
2. Run doctor; it recommends restoring the source **or** retiring the card.
3. Follow the exact `ore card retire <id>` instruction and run doctor again.

**Expected:** A completed alternative remedy resolves or downgrades the issue, or doctor explains why restoration is still required.
**Actual:** Retire succeeds, but doctor exits 1 with the identical “restore … or retire” instruction for that already-retired card. An agent following the advice cannot get past it. **2/2**, `doctor-0/missing-card-source` and `doctor-1/missing-card-source`.

Suspect: `packages/core/src/doctor.ts:120` never checks the retired state. Evidence tags: `doctor-suggested-remedy`, `doctor-after-remedy`.

### CLI-10 — Feed recovery points to a nonexistent flag; reference docs lag the CLI — S3, Mac CLI/docs

1. Run `ore feed set missing --name test --json`.
2. Follow its suggested `ore feed --feeds` command.
3. Compare the registered command options with SPEC's CLI section.

**Expected:** Recovery commands work and the reference describes the supported entry points.
**Actual:** The first error says `ore feed --feeds lists them`; the next fails `unknown option --feeds`. **2/2**. Listing is simply `ore feed --json`.

Suspect: `packages/core/src/feeds.ts:245`. The complete reference mismatch list is below. Every registered flag is represented somewhere in the top-level help text; no nonexistent command was found in the skill or generated guide.

## Documentation audit

| Location | Wrong or missing behavior |
| --- | --- |
| `/ore` hard rules, draft editing, Fix, and library guide | Direct-write exceptions conflict with the project rule; CLI-07. |
| `/ore` Review start and final “more” check | Always use the whole-library `due` queue. No instruction carries a requested skill into `due --skill <id>` or its final check. A literal “quiz me on Learning” implementation includes unrelated skills. The successful agent-day script had to add that filter. |
| `/ore` “no idea” path | Says to skip `grade`, then the common review command still requires the grade's `ai` for `--ai-by`. It needs an explicit branch for a proposal made without a grade call. It correctly still waits for a rating reply. |
| SPEC `ls --archived` | Says “archived ones only with --archived,” which can read as inclusion; the implementation and help mean **only archived sources**. |
| SPEC `inbox` | Missing `--add-file`, `--name`. |
| SPEC `annotate` | Missing `--exact`, `--start` for changing the passage. |
| SPEC `answer` | Missing `--edit <ts>`. |
| SPEC `notes` | Missing base64 stdin attachment form `--attach - --ext …`. |
| SPEC `diagram` | Missing `--link`, `--follow-link`. |
| SPEC CLI command list | Missing `ore opened <item>`. |
| SPEC `pin` | Missing `--at`. |
| SPEC `skills` | Missing `restore <removed-json>`. |
| SPEC `due` | Missing `--source`, `--all`; queue prose also predates D279's recently-finished-source allocation. |
| SPEC `session` | Missing explicit session ID on `end`, and `reopen <id>`. |
| SPEC `tutor` | Missing `--files`. |
| SPEC `chat` | Missing `--attach`, `--name` attachment forms. |
| SPEC `feed` | Missing `restore <json> --at N`. |
| SPEC `check --covered` | Says it stores own marks “instead”; it actually requires a prior AI check (`prequestion 1 has not been checked yet` otherwise). It works after the check. |
| Help / SPEC `status --at <iso>` | Unlike `pin --at`, status accepts `11/14/2026` and normalizes it instead of enforcing ISO format. Nonsense dates are rejected without writing. |
| Feed recovery error | Nonexistent `--feeds`; CLI-10. |

`ore export` and `ore import` do not exist and are not promised by the current CLI section. SPEC's `map` and `resolve` references are in a section explicitly marked **deferred**, so they are not reported as shipped commands missing. No direct-write workaround was used on the assigned app library.

## Doctor and round-trips

The following corruptions were applied **one at a time**, on independent copies, twice each. Canonical-file hashes were compared around every command; `.index`, `.ore` and Git internals were excluded from those comparisons.

| Corruption | Detection and repair result |
| --- | --- |
| Body changed without updating its hash | Warned; `--fix` updated hash and reanchored, retaining text. |
| Broken source frontmatter | Error plus dependent-card diagnostics; no automatic destructive repair. |
| Exercise points to missing source | Error; `--fix` preserves data; suggested retire issue in CLI-09. |
| Highlight quote no longer exists | Orphan warning; retained the annotation. |
| Truncated review JSONL line | Correct file and line reported; earlier reviews retained. |
| Source has unknown skill | Warning; no invented replacement skill. |
| Source note links to missing source | Warning names the missing target; note unchanged. |
| Dead/stale library lock | Warning; `--fix` removed it; next doctor clean. |
| Invalid `skills.yaml` | Error and text-editor next step; file unchanged. |
| Invalid SQLite index bytes | Error directs to `ore reindex`; reindex rebuilt it and next doctor passed. |
| Invalid session object, valid JSON | Missed; CLI-08. |
| Invalid variant object, valid JSON | Missed; CLI-08. |

Copying canonical files to a new library location without `.index`, rebuilding, listing sources/exercises and opening notes passed. These checks made no canonical changes. Reimporting deliberately changed kept HTML, then undoing and redoing, returned the expected old/new bodies and hashes twice. Cut and page-text undo/redo also passed. No claim is made about transferring Git history, which was excluded from the copy.

## Known findings checked

No known finding was observed to return. Read the 2026-11-14 outside-edit rows before testing. The open note and open review refresh parts of **F173** passed twice. The source rename/author test and concurrent per-field exercise edits were preserved; this does not claim a fresh full rerun of F174/F175's UI Undo journeys. F1's known note undo-history loss was not re-reported.

## What passed

- All 62 top-level commands have at least one successful tested branch; [coverage.md](coverage.md) lists each.
- Unknown flags are rejected across all 62 commands with valid JSON errors and non-zero exits.
- Missing IDs, actual two-match source/exercise prefixes, ratings 0/9/empty/noninteger, invalid confidence, bad dates and unsafe exercise delimiters were refused without canonical writes in the tested cases.
- All tested non-help JSON outputs parsed except the failed-editor case. Command-specific arrays/objects and doctor's structured failure report were treated as intentional shapes, not bugs.
- Two simulated agent days added a source, collected a key point, drafted an exercise, edited it through `card set`, graded a fixture answer, recorded an explicit simulated learner rating, and closed the session. Grading itself wrote no review. AI-created exercises and the fully specified review kept their stamp.
- Prequestion attempts, key points, AI checking followed by own coverage marks, recall, explanation, tutor, question research, saved-chat lifecycle and attachments passed with controlled fixtures.
- Skill add/set/archive/restore/delete/arrange and suggested-skill accept/dismiss/undo passed.
- Questions/answers/matches, Try it completion/undo, source archive/restore, pin/unpin, note append and diagram writes passed.
- Local fixture feed find/follow/refresh/open/close and feed configuration/read/unread passed.
- **48 concurrent pairs**: 12 note appends, 12 source title/author edits, 12 exercise question/answer edits, 12 feed-read appends. No lost fields; the feed log had all 24 receipts. [concurrency-results.json](concurrency-results.json).
- Two app/CLI note overlaps retained both sets of words; two app renames retained the CLI author; two open reviews refreshed the CLI wording. [app-results.json](app-results.json).

Screenshots for the successful shared-library checks: [note run 1](note-concurrent-0.png), [note run 2](note-concurrent-1.png), [review run 1](review-outside-0.png), [review run 2](review-outside-1.png). No implementation files were changed, and no fixes were attempted.
