# Ore CLI recheck — undo scout

2026-11-27, macOS arm64, Bun 1.4.4; commit `32c979544e3c72b5d1e35b0ade1b63b05fcc843b`. Covered every requested inverse family, including three-deep reimport Undo/Redo, intervening writes, fresh indexing, existing review histories, and twelve isolated doctor corruptions. The inverse matrix contains 97 cases: 89 restore the compared learner state, 4 expose the archived-suggestion finding, and 4 leave a topic association behind (lead below); all 97 agree with freshly rebuilt `ls`, `search`, and `due` results. Seven findings below have minimized red scripts and three consecutive confirming runs per red case. Read the working agreement, spec, decisions, findings/sweeps, November 15 CLI sweep, November 24 deep-scan-3 reports, changed CLI history, and supplied diagnosing-bugs phases 1–4. Earlier findings are controls, not new reports. Skipped library Git-history restore, real AI, native windows/devices, browser/server work, whole-suite tests, live library access, and fixes. All artifacts and scratch libraries are inside `codex-out/undo/`; application code and the findings registry are unchanged.

All commands below run from the repository root. Scripts pin the clock, set `ORE_NO_ENRICH=1`, put rejecting fake Claude/Codex executables first on PATH, and recreate only their own scratch library. Reimport fetches are stubbed. Assertions intentionally exit **1** for a reproduced bug. [confirmation.json](confirmation.json) records 30 expected red exits and 7 passing controls, run sequentially; each Bun run took less than one second. Full outputs are in [logs/](logs/). Output excerpts below omit unrelated fields, not failed checks.

## Findings

### UNDO-01 — Undo of a cut rewrites a question's passage to different words

**S1 — persisted annotation corruption. Mac CLI/core; the corrupted library is shared with iPhone.** Native UI execution was not needed: this calls the same `cutText`/`restoreCut` functions as the CLI.

**Red command:**

```sh
bun codex-out/undo/cut-question.ts inside none
```

Output excerpt:

```json
{"before":{"exact":"Beta spacing helps learning.","start":10,"end":38},"afterCut":{"exact":"Beta spacing helps learning.","start":10,"end":38,"status":"open"},"afterUndo":{"exact":"Gamma sleep consolidates mem","start":40,"end":68},"bodyRestored":true}
```

```text
AssertionError: Undo of a cut must restore the question passage without rewriting it to different words
```

**Minimum steps:** add a source with two paragraphs; mark the first paragraph as a question; cut that paragraph; undo the cut. The script selects one character, which the normal cut operation expands to its paragraph. No second cut, external edit, index rebuild, or approximate matching is necessary.

**Expected / actual:** the source and question should return to their prior text and offsets. The source does; the question's saved quote and offsets instead move into the next paragraph. Its own question text stays attached to the wrong passage. This violates the inverse contract in D82 and preserves the question's words without preserving what it was about.

**Runs:** 3/3 confirmation runs; also reproduced after an independent title change and after reindex. Controls with a question wholly after the cut, and with an ordinary highlight inside the cut, both pass. [Evidence](cut-question-inside-none.json), [first confirmation](logs/confirm-cut-1.log).

**Ranked hypotheses and probes:** (1) a retained question is shifted a second time on restore — confirmed: it remains at 10–38 after the cut, then gains the cut's 30 characters on restore; (2) fuzzy anchoring chooses similar words — ruled out by this direct restore path and dissimilar paragraphs; (3) cut expansion restores the wrong text — ruled out by exact body equality and the passing ordinary-highlight control.

**Cause:** `packages/core/src/cut.ts:139–145` retains overlapping questions without shifting/removing them. `:271` then shifts every live annotation starting at or after the insertion, rewriting its quote with `quoteSelector`; the correction at `:273–275` only applies to `cut.removed`, which excludes questions. Different from F606 (insertion after another cut) and F567 (fuzzy reimport anchoring).

### UNDO-02 — Undo of reimport overwrites a separately corrected author

**S1 — loss of user-authored metadata. Mac CLI/core; changed source syncs to iPhone.**

**Red command:**

```sh
bun codex-out/undo/reimport-overwrite.ts author none
```

Output excerpt:

```json
{"reimportRemoved":0,"before":{"author":"Manual correction"},"after":{"author":"Original author"},"fetchesDuringUndo":0,"bodyRestored":true}
```

```text
AssertionError: Undo overwrote the independent author correction
```

**Minimum steps:** import a linked Markdown source naming its author; reimport it with an unrelated paragraph appended and the same author; correct the author; undo the reimport by step ID.

**Expected / actual:** undo should restore the old source text and retain the independent correction. It restores the text but replaces the correction with the stash's author, although this reimport never changed the author. This is the requested intervening-write case, not an attempt to undo the author edit itself.

**Runs:** 3/3 confirming runs, plus the reindex variant. `title` is a passing control; separate broader probes also preserve an intervening source note, highlight note, and reading status. [Evidence](overwrite-author-none.json), [log](logs/confirm-author-1.log).

**Ranked hypotheses and probes:** (1) the version swap unconditionally restores the byline — confirmed by the raw frontmatter; (2) only an old index displays the author — ruled out by raw metadata and the same failure with `author reindex`; (3) undo fetches a new upstream author — ruled out by zero fetches during undo and identical upstream authors in both versions.

**Cause:** `packages/core/src/ingest/index.ts:909–910` spreads current metadata, then unconditionally replaces `author` and other source fields from the stash. It does not check whether reimport changed that field or a later write replaced it. F175 concerned a title rename's external-write guard; this is a separate reimport inverse. F574's byline-only reimport is not being re-reported.

### UNDO-03 — Undo of reimport resurrects an independently deleted highlight

**S2 — wrong saved annotation state. Mac CLI/core; persisted state also affects iPhone.**

**Red command:**

```sh
bun codex-out/undo/reimport-overwrite.ts highlight none
```

Output excerpt:

```json
{"reimportRemoved":0,"before":{"liveHighlights":0},"after":{"liveHighlights":1},"fetchesDuringUndo":0,"bodyRestored":true}
```

```text
AssertionError: Undo resurrected an independently deleted highlight that reimport never removed
```

**Minimum steps:** highlight the original paragraph; reimport with only an extra paragraph at the end; delete the unchanged highlight; undo reimport. The reimport's `removed` list is empty and the original paragraph/anchor never moved.

**Expected / actual:** undo should leave the independently deleted highlight deleted. It appends a new open revision, bringing it back. This is an unrelated write being reversed along with the requested inverse (D82).

**Runs:** 3/3 confirming runs; also red after reindex. An independently edited highlight **note** survives, isolating the status/anchor restoration. [Evidence](overwrite-highlight-none.json), [log](logs/confirm-highlight-1.log).

**Ranked hypotheses and probes:** (1) undo restores every saved status, including statuses reimport never changed — confirmed; (2) reimport legitimately removed the highlight and undo restores that removal — ruled out by `reimportRemoved: 0` and unchanged passage/offsets; (3) reanchoring creates or recovers a different highlight — ruled out by the same ID, no new annotations, and the zero-new-annotation reanchor branch remaining unused.

**Cause:** `packages/core/src/ingest/index.ts:1261,1272–1277` compares all stashed annotations to current revisions and writes the stashed status whenever it differs. It does not check which annotation revisions reimport itself changed or whether another operation changed status afterward.

### UNDO-04 — Undo of accepting a suggested skill leaves an archived skill active

**S2 — archived exercises return to ordinary review after Undo. Mac CLI/core; shared library state.**

**Red command:**

```sh
bun codex-out/undo/suggested-archive.ts archived
```

Output excerpt (`due` contains the existing exercise's ID):

```text
before: archived=true, due=[]
after:  archived=false, due=[existing exercise]
freshQueue: [the same existing exercise]
AssertionError: Undo must restore the archived skill and leave its old exercises out of review (D173.4)
```

**Minimum steps:** archive a skill with an overdue exercise; accept that skill's suggestion on another source; pass the returned undo payload to `suggested-skill undo`.

**Expected / actual:** source filing is undone, but the skill remains active and its old exercise remains due. D173.4 explicitly includes “a suggestion accepted” among filings whose Undo archives the skill again. No FSRS state changes are needed for the wrong queue eligibility.

**Runs:** 3/3 confirmations; independently renamed source and reindex variants also fail. An already active skill and a newly created suggested skill restore correctly. [Evidence](suggested-archived.json), [log](logs/confirm-suggested-1.log).

**Ranked hypotheses and probes:** (1) undo payload loses previous archive state — confirmed: payload has `created:false`, filing/cards/topics, but no previous archive bit; (2) a stale due index admits the exercise — ruled out by fresh reindex producing the same queue; (3) the new source remains filed and keeps the skill active — ruled out by the restored source's empty skill list.

**Cause:** `packages/core/src/skills.ts:425–428` unarchives without recording that change; `SuggestionUndoSchema` at `:445–452` has no prior archive state; `undoSuggestedSkill` at `:458–480` removes a newly created unused skill but never rearchives a pre-existing one. Related to F620's previously fixed picker/list filing behavior; this is the separate suggested-skill accept/undo path, not evidence that its existing guard regressed.

### UNDO-05 — Doctor reports healthy libraries while chats, inbox files, variants, or images are broken

**S2 — false health report with silent disappearance of saved/queued learning material. Mac CLI diagnostic; files may originate on either device.** Four separately isolated cases, grouped because doctor omits these checks.

**Red commands:**

```sh
bun codex-out/undo/doctor-blindspots.ts chat
bun codex-out/undo/doctor-blindspots.ts inbox
bun codex-out/undo/doctor-blindspots.ts variant
bun codex-out/undo/doctor-blindspots.ts image
```

For **each**, doctor, doctor with fix, and doctor after rebuilding the index return:

```json
{"ok":true,"errors":0,"warnings":0,"issues":[],"fixed":[]}
```

Each exits 1 with `AssertionError: Doctor must identify the broken <case> file and a next step`.

**Minimum damage / observable result:**

| Case | Single corruption | What reads it |
| --- | --- | --- |
| chat | Save a chat, remove its last 8 JSON bytes | `readChat` says `chat chat-one is not JSON`; listing silently returns `[]` |
| inbox | Queue a file, remove only the copied attachment | Descriptor still exists; attachment does not; inbox listing silently returns `[]` |
| variant | Save a schema-valid variant referencing a nonexistent exercise | `VariantSchema` accepts it and `readVariants` reads it, but its parent is absent |
| image | Source contains `![Learning loop](assets/missing.png)` with a matching body hash, but no image | Source opens normally; referenced learning diagram is absent |

**Expected / actual:** name the damaged file/reference and a safe next step (repair/recover, or wait for incomplete sync where appropriate). Actual report has no warning or next step. Automatic recovery of missing words/bytes is not expected. `--fix` makes no canonical change, so this finding is false reassurance and concealed damage, not destructive repair.

**Runs:** 3/3 per case, 12 confirming red runs. Each script also repeats doctor after `--fix` and after reindex. Direct process invocation additionally confirmed chat doctor and inbox doctor `--fix` exit 0, while direct chat open exits 1. See [cli-confirmation.json](cli-confirmation.json), [chat evidence](blindspot-chat.json), [inbox evidence](blindspot-inbox.json), [variant evidence](blindspot-variant.json), [image evidence](blindspot-image.json).

Direct CLI confirmation, after the scripts create the libraries:

```sh
ORE_LIBRARY="$PWD/codex-out/undo/libs/blindspot-chat" ORE_NO_ENRICH=1 bun packages/cli/src/ore.ts doctor --json
ORE_LIBRARY="$PWD/codex-out/undo/libs/blindspot-inbox" ORE_NO_ENRICH=1 bun packages/cli/src/ore.ts doctor --fix --json
```

**Ranked hypotheses and probes:** (1) doctor never visits these files/references — confirmed; (2) corrupt input passes every normal validator — ruled out for chat by the direct read error, and for variant by separating schema validity from missing-parent validity; (3) cached index state hides the corruption — ruled out by identical clean reports after rebuild. Truncated review JSON, bad exercise frontmatter, and missing source folders are positive diagnostic controls that do produce issues.

**Cause:** `packages/core/src/doctor.ts:38–220` has no chat or inbox validation, and the source loop at `:83–129` does not validate local image targets. Its variant loop at `:170–177` checks schema only, unlike review references at `:155`. `chats.ts:56–57` and `inbox.ts:65–70` silently omit broken entries from normal listings. Not F239: these variants are valid records with missing parents, not malformed variant objects.

### UNDO-06 — Reopening an undone finished session can count yesterday as goal met

**S2 — false daily-goal history. Mac core/CLI; shared Today calculation, no native UI claim.**

**Red command:**

```sh
bun codex-out/undo/session-reopen.ts reopen
```

Output excerpt:

```json
{"sameDayMet":false,"sameDayDue":1,"reviews":1,"priorDay":{"date":"2026-11-27","status":"met","active_ms":1000}}
```

```text
AssertionError: An undone caught-up ending must not count yesterday as goal met
```

**Minimum steps:** start with two due exercises created yesterday; review both for one second each; end caught up; undo the second rating and reopen that session; leave it unfinished; ask Today on the following day. Two reviews are needed because the historical formula requires at least one surviving review. Created-yesterday exercises avoid the new-exercise day cap confounding this check.

**Expected / actual:** yesterday has one second of review and an unanswered exercise, and should remain open. Same-day Today correctly says `met:false` with one due; next-day Today instead calls yesterday `met`. D60's caught-up exception should not survive undoing the rating that made the session caught up; D82 returns that exercise to the same session.

**Runs:** 3/3 confirmations; reindex also reproduces. Controls with no caught-up ending, and with the reopened session ended again as not caught up, both report yesterday open. [Evidence](session-reopen.json), [log](logs/confirm-session-1.log).

**Ranked hypotheses and probes:** (1) the old caught-up end receipt remains effective until another end — confirmed by both controls; (2) rating Undo failed — ruled out by one remaining review, one due exercise, and same-day `met:false`; (3) clock/index/new-draft state causes a false boundary — ruled out by fixed dates, yesterday-created exercises, and reindex.

**Cause:** `packages/core/src/sessions.ts:84–90` reopens only the local open-session pointer. `readSessions` at `:73–79` still returns the old end receipt. `today.ts:176–178` uses that receipt for historical met days; `:183–186` uses the live queue for today. Hence the undone goal reappears when the day becomes historical. Different from F618's failure while reopening and deep-scan-3's simultaneous-session pointer problem.

### UNDO-07 — A prefixed duplicate exercise changes `cards`, but doctor reports no issue

**S3 — edge case with conflicting exercise content. Mac CLI/core; persisted duplicate may sync.**

**Red command:**

```sh
bun codex-out/undo/doctor-duplicate.ts prefix
```

Output excerpt:

```json
{"doctor":{"ok":true,"errors":0,"warnings":0,"issues":[],"fixed":[]},"showQuestion":"What helps learning?","listQuestion":"Which question is this?","indexQuestion":"What helps learning?"}
```

```text
AssertionError: Doctor must name the duplicate exercise file
```

**Minimum steps:** copy `cards/<id>.md` to `cards/000-copy-<id>.md` without changing its frontmatter ID, and change the copied question's wording. Run `doctor`, `cards`, and `card show <id>`.

**Expected / actual:** the canonical exact-name file should win consistently and doctor should identify the duplicate. Instead, `cards` selects the prefixed copy while direct open and the index select the original. `doctor --fix` also says healthy and changes nothing. The differing wordings demonstrate material ambiguity rather than duplicate bytes alone.

**Runs:** 3/3 confirmations, plus a reindex variant and actual CLI `cards`/`doctor` processes. The conventional suffix copy `<id> copy.md` is correctly diagnosed and excluded. [Evidence](duplicate-prefix.json), [log](logs/confirm-duplicate-1.log).

**Ranked hypotheses and probes:** (1) suffix matching mistakes a prefixed filename for canonical — confirmed; (2) an old index selects the wrong exercise — ruled out by direct open/index agreeing and reindex retaining the contradiction; (3) arbitrary duplicate order alone explains it — the suffix control is excluded regardless of its extra content, while the prefixed copy qualifies as canonical and sorts first.

**Cause:** `packages/core/src/doctor.ts:132–137` collects IDs in a Set without checking duplicates, and uses `endsWith(id + '.md')` for filename validity. `cards.ts:121–125` uses the same suffix test for canonical preference, then takes the first sorted file. `findCard` at `:130–133` prefers the exact path; `db.ts:79` only indexes exact 26-character ID filenames. Existing source-folder duplicate findings are a different path.

## Leads and byte-level deviations

- **Skill-filing Undo leaves a topic association.** `bun codex-out/undo/inverse-matrix.ts edit-skills` exits 1: source/exercise skills restore, but `topics/memory.md` remains associated with both `learning` and `gardening`. Seen in plain, unrelated-rename, reindex, and mature-history variants. `skills.ts:544–545` only unions additions; the undo payload contains exercise snapshots, not topic snapshots. The persisted difference is proven; whether that shared topic association should be retracted needs a contract decision and a demonstrated learner-facing consequence. Kept as a lead rather than silently called a full restore. See [inverse matrix](inverse-matrix.json).
- **Byte equality is stricter than the repository's append-only Undo design.** All file-byte diffs except `.index` were retained, including `.ore` and log files. Cut/page-text leave redo receipts; review, annotation, try, variant, and session inverses append history rather than erase it (D78/D82). These raw differences are recorded in [coverage.md](coverage.md), not hidden by the semantic checks. They are not additional claims of data loss.
- **Two smaller byte-only differences:** chat delete/set keeps all parsed fields and `updated` but changes JSON key order; adding/dropping the first dig leaves `skills/learning/digs.json` containing `[]` instead of no file. Both differ from a literal byte-for-byte inverse. No learner-state failure was established; exact before/after bytes are in the matrix's `deltas`.
- **Doctor next-step wording is incomplete on some recognized faults:** malformed exercise frontmatter is reported as a YAML parse error, and an unknown skill is named without a repair command. No separate new failing learner flow was established; diagnostic details are retained in the twelve-case table.

## What passed

- `archive`/undo and `pin`/undo restore source state, including after an independent rename or index rebuild.
- Ordinary `cut` and `page-text` undo/redo restore bodies and annotations in the sampled cases; the overlapping-question exception is UNDO-01.
- Reimport restores three successive text/original versions, unnamed and named; redo and a second complete undo pass. Reindex between inverses also passes. Independent title, source note, highlight note, and reading status survive.
- `skills rm`/restore passes both with and without archiving newly unfiled sources, including source/exercise filing in the seeded case.
- `skills archive`/undo restores prior state.
- Course archive/undo passes for an all-active course without `--lessons`, and a mixed course with `--lessons` preserving the already archived lesson (F573 control).
- Review/undo restores recorded history and computed schedule, including the mature-history matrix with three pre-existing ratings.
- Chat delete/set with keep-time semantics restores parsed content and timestamp; raw JSON key ordering differs as disclosed above.
- Variant reject/restore and exercise retire/restore restore their live state; variant revision history remains appended.
- `tried`/undo restores the try; `--next` and `--again` require their documented two Undo steps (D148), which pass.
- Dig/drop restores the live dig list; the initial empty-file difference is disclosed above.
- Source skill filing restores each exercise's own saved skills using `--cards`; the separate topic association remains a lead.
- Accept/undo restores a newly created or already active suggested skill correctly; pre-existing archived skills fail UNDO-04.
- Inbox remove/keep/restore passes for both file attachments and links, including attachment bytes.
- Session end/reopen restores the open-session identity; historical caught-up accounting fails UNDO-06.
- Annotation deleted/back restores its live data, and status done with `--at` restores the prior completion timestamp.
- Every matrix `ls`/`search`/`due` result after an inverse equals the result after a fresh rebuild: **97/97**. This does not excuse canonically wrong data, such as UNDO-04, that both indexes consistently read.
- Doctor identifies truncated review lines, malformed exercise frontmatter, orphaned passages, missing `doc.md`, unknown skills, conventional suffixed duplicate exercises, and malformed `jobs.grade`. Its supported orphan/hash repair preserves annotation words, leaves the orphan warning visible, and changes only the source hash in this case. No destructive `--fix` action was observed in the twelve isolated cases.
- An older `.index` schema is rebuilt transparently and normal commands continue. The other broken-library cases also let `ls`, `due`, `search`, chat listing, and inbox listing run; direct corrupt-chat open refuses. Full diagnostic outcomes and missing next steps are in [coverage.md](coverage.md) and [doctor-matrix.json](doctor-matrix.json).

No fixes, registry edits, commits, or app installation were performed. The red scripts are the handoff for the fixing thread.
