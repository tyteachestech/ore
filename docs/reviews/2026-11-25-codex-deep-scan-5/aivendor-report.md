# Ore deep scan 5 — aivendor

Scanned `05c68297d33d46d6b17b404c101543bc9dfd9557` with Bun 1.4.4 on macOS, November 24 local / November 25 UTC. Covered Claude and Codex argument/output handling, model precedence and switches, the smaller AI paths, saved attribution, late writes, forgotten tutor sessions, and the actual Ask component headlessly. Read the working agreement/spec, findings and sweeps, and skimmed the four earlier scans; this report does not reclaim their findings. Skipped real AI, native windows, browsers, servers, full suites, EPUB front matter, highlight animations, and known F421 long-argument failures. All authored files and scratch libraries are inside `codex-out/aivendor/`. No application code, finding row, installed app, or real library was changed. **Eight findings: four S2 and four S3.** No scheduling change, recorded AI rating, or security exploit was demonstrated.

## Reproduction and evidence

Run commands from the repository root. Each red command deliberately exits **1** on the named symptom. `python3 codex-out/aivendor/confirm.py` runs one Bun process at a time: **8 findings × 3 runs = 24 expected assertion failures**, plus **9 passing control runs**. All 33 results matched expectations; the slowest confirmation process took **0.437 seconds**. See [confirm-results.json](confirm-results.json), [confirmation output](logs/confirmation.txt), and individual `logs/<case>-<run>.txt` files.

Both vendor executable names resolve to Python fakes inside this folder. They emit Claude JSON / stream-JSON or Codex event lines and its last-message file, capture argv/stdin, and exit before the parent finishes. Held replies use a file barrier with a five-second deadline, not a scheduling guess. IDs and incidental write timestamps vary, but the verdict does not depend on them. The scripts recreate only their own scratch libraries. The Ask tests use Happy DOM and React as the repository's headless tests do; they do not start a browser or app. Native calls are replaced at the boundary. Report output excerpts omit irrelevant IDs and fields; complete output is linked.

## Findings

### AIVENDOR-01 — Applying an AI exercise rewrite keeps the previous author's stamp

**S2 · Mac.** Violates `CLAUDE.md`: every AI output records vendor, model and prompt version. The rewritten exercise is readable and its schedule is unchanged, but its saved attribution is false. Distinct from F186's stopped tutor reply and F587's merging of tutor versions.

**Red command:**

```sh
bun codex-out/aivendor/ask-provenance.tsx
```

[Output](logs/ask-stamp-1.txt), excerpt:

```text
[DEEP] {"replyAI":{"vendor":"codex","model":"rewrite-author","prompt_version":"chat@2"},
"proposal":{"question":"What strengthens memory?","answer":"Retrieval practice."},
"savedQuestion":"What strengthens memory?",
"savedAI":{"vendor":"claude","model":"first-author","prompt_version":"enrich@25"}}
[DEEP] FAIL applying an AI rewrite must retain who wrote the new text
```

**Minimised steps:** Create one exercise bearing a Claude stamp. Get a real core `askAboutCard` result through fake Codex, proposing different wording. Deliver that result to the actual `Ask` component. Click “Use this exercise”; its callback invokes the actual `card set` command handler with the same question/answer arguments Review supplies. Read the exercise from disk. **Expected:** preserve attribution for the new AI wording. **Actual:** the new text is credited only to the original Claude author. **3/3.** The harness mounts Ask, not all of Review; Review's callback was checked directly at the lines below.

**Ranked hypotheses and probes:**

1. Ask discards the new stamp before applying. Prediction: the core result has it, but the retained turn and `onApply` payload do not. **Confirmed by capturing all three.**
2. The adapter reports the wrong vendor. Prediction: the core result already says Claude. **Rejected:** it says Codex / rewrite-author / chat@2.
3. The file writer alone strips a stamp supplied by the screen. Prediction: `onApply` contains the correct stamp. **Rejected:** it contains only question and answer; the old metadata survives the save unchanged.

**Cause:** `apps/desktop/src/Ask.tsx:15–19` omits attribution from its reply/proposal/turn types, and `:74` drops `r.ai`. `apps/desktop/src/Review.tsx:1052–1054` passes only the proposed text to `setText`; `:513–523` sends only text fields. `packages/cli/src/cmd-study.ts:118–125` writes those fields while retaining the existing metadata.

### AIVENDOR-02 — A Dig's second AI stage deletes attribution for its first stage

**S2 · Mac.** D325's saved Dig still contains the first stage's questions and “came on its own” judgments, but no record of who produced them after a vendor/model switch. Violates the same AI-stamp rule.

**Red command:**

```sh
bun codex-out/aivendor/small-paths.ts dig-stamps
```

[Output](logs/dig-stamp-1.txt), excerpt:

```text
[DEEP] {"firstStamp":{"vendor":"claude","model":"claude-first","prompt_version":"dig@1"},
"saved":{..."ideas":[{..."state":"own"},{..."state":"nudge"}],
"asks":[{..."q":"What about spacing?","answer":"I should space practice."}],
"ai":{"vendor":"codex","model":"codex-second","prompt_version":"dig@1"}}}
[DEEP] FAIL the saved dig must retain the author of the question and own marks from stage one
```

**Minimised steps:** Start a Dig with two key points. Let Claude perform `digAsk`. Switch to Codex with a different model. Answer the one question with `digAnswer`. Read `skills/learning/digs.json`. **Expected:** both AI stages remain attributable. **Actual:** only the second stamp survives, although output from both stages remains. **3/3.** No rating is recorded.

**Ranked hypotheses and probes:**

1. A single shared `ai` field is replaced at stage two. Prediction: the first stamp is correct until the answer is saved. **Confirmed.**
2. Model/vendor selection changes the first stage retroactively. Prediction: the captured first result is already mislabeled. **Rejected:** its stamp is correct.
3. Serialization strips nested attribution. Prediction: separate stage stamps exist in the returned object but disappear on disk. **Rejected:** there is only one `ai` field before serialization. The same-model control passes because the replacement stamp happens to be identical.

**Cause:** `packages/core/src/ai/dig.ts:46` saves stage one's stamp; `:59–72` replaces that variable with stage two's stamp; `:76` writes it over the Dig while retaining the earlier questions/states. `packages/core/src/digs.ts:30–41` gives the whole multi-stage record just one stamp.

### AIVENDOR-03 — Stop can run before the vendor job, then the stopped job starts anyway

**S2 · Mac.** The screen says “Stopped” while a later continuation starts work that can consume AI usage. This is a headless proof of the actual send/Stop logic; native process termination itself was not tested.

**Red command:**

```sh
bun codex-out/aivendor/stop-before-start.tsx
```

[Output](logs/stop-1.txt):

```text
[DEEP] PASS run is pending while progress listener registers
[DEEP] PASS Stop marks the request stopped before the vendor starts
[DEEP] {"events":["STOP vendor job","START vendor job"],"error":"Stopped.",...}
[DEEP] PASS the start and Stop use the same job ID, or the no-Stop control starts once
[DEEP] FAIL a stopped request must not start after its progress listener resolves
```

**Minimised steps:** Mount Ask. Hold the asynchronous `listen("ore-progress")` registration. Send one question, then click Stop. Release the registration. **Expected:** the canceled request never invokes `oreJob`. **Actual:** it invokes `oreJob` after `cancelOre`, with the same job ID; its result is hidden by the reply guard. **3/3.** The no-Stop control starts once and displays the reply.

**Ranked hypotheses and probes:**

1. The send continuation does not recheck cancellation after awaiting listener registration. Prediction: releasing that await starts the canceled job. **Confirmed.**
2. Stop cancels a different ID. Prediction: captured IDs differ. **Rejected:** they are equal.
3. Only a stale UI update occurs, with no new work. Prediction: no call crosses the `oreJob` boundary. **Rejected:** the boundary is invoked after Stop, while the screen still says Stopped.

**Cause:** `apps/desktop/src/Ask.tsx:63–71` exposes Stop, awaits listener registration, then starts `oreJob` unconditionally. `:86–92` clears ownership and calls cancellation, but cannot cancel a job not started yet. The native cancellation at `apps/desktop/src-tauri/src/main.rs:213–216` acts only on an already-registered job. The analogous tutor continuation is a lead, not a second confirmed finding here.

### AIVENDOR-04 — Recall feedback for an old answer is saved beside the corrected answer

**S2 · Mac; the saved result can also sync to iPhone.** D18 feedback no longer describes the learner's recorded answer.

**Red command:**

```sh
bun codex-out/aivendor/small-paths.ts recall-race
```

[Output](logs/recall-race-1.txt), excerpt:

```text
[DEEP] {"error":"","answer":"Recall strengthens memory.",
"feedback":{"feedback":"Rereading alone is not sufficient.",
"questions":[{"n":1,"feedback":"Your answer missed retrieval."}],"missed":["Retrieval"],...}}
[DEEP] FAIL feedback for the old answer must not be saved on the corrected answer
```

**Minimised steps:** Save one prequestion answer, “Rereading only.” Start recall feedback and hold the vendor. Correct the answer to “Recall strengthens memory.” through `setPrequestionAttempt`. Release feedback about the original answer. **Expected:** reject stale feedback or recompute from the new answer. **Actual:** it saves successfully with the corrected answer still present. No free-recall text is needed. **3/3.** This does not repeat F596: that row protects learner-edited check marks, not recall feedback's input answers.

**Ranked hypotheses and probes:**

1. The save guards only free-recall text. Prediction: changing that text rejects, but changing a prequestion answer does not. **Confirmed** by [guard probes](logs/guards-and-persistence.txt).
2. The answer setter loses the correction. Prediction: disk still holds “Rereading only.” **Rejected:** the correction is present.
3. The fake receives the updated answer or returns feedback for another call. Prediction: captured input differs from the original. **Rejected:** the barrier/captured input proves it received the original; the unchanged-answer control saves normally.

**Cause:** `packages/core/src/ai/recall.ts:28–43` captures prequestions/answers as task input, but `:49–51` checks only `m.recall?.text` before saving. Neither prequestion text nor its before/after answers are checked there.

### AIVENDOR-05 — A late prequestion check can save marks for obsolete key points

**S3 · Mac; shared saved data.** Requires key points to change outside this in-flight check, such as an edit to the canonical library or a sync update. No ordinary in-app point editor is claimed. Violates D56's one mark per current key point.

**Red command:**

```sh
bun codex-out/aivendor/small-paths.ts check-race
```

[Output](logs/check-race-1.txt):

```text
[DEEP] {"error":"","inputPoints":["Retrieval","Spacing"],
"points":[{"text":"New point A","evidence":[]},{"text":"New point B","evidence":[]},{"text":"New point C","evidence":[]}],
"check":{"covered":[true,false],"ai":{"vendor":"claude","model":"claude-fake","prompt_version":"check@1"}}}
[DEEP] FAIL late check must not put two marks on three changed key points
```

**Minimised steps:** Give one answered prequestion two key points. Start `checkPrequestion`, hold the vendor, and replace its points with three different points through core `updateItemMeta`, keeping the answer unchanged. Release the two-mark reply. **Expected:** reject the obsolete check. **Actual:** three current points get two old marks. **3/3.** F596's user-mark override is a different input change.

**Ranked hypotheses and probes:**

1. Validation uses captured points, but save checks only answer text. Prediction: changed points pass while a changed answer rejects. **Confirmed** by the red loop and guard probes.
2. The vendor is asked about one point and returns too few marks. Prediction: captured input has three points. **Rejected:** it has Retrieval and Spacing.
3. The write loses the point edit. Prediction: two old points remain. **Rejected:** the three new points remain; only the marks are stale. The unchanged-points control preserves matching lengths.

**Cause:** `packages/core/src/ai/check.ts:80–81` validates against the pre-run array; `:84–88` never compares the question/points again. The human-mark guard does not cover changed key-point definitions.

### AIVENDOR-06 — Closing a Dig does not prevent its late first-stage AI write

**S3 · Mac.** A completed D325 record is changed after closing, gaining unanswered questions and different idea states. The normal UI reaches this: closing during “read” calls `--done` while `--ask` continues.

**Red command:**

```sh
bun codex-out/aivendor/small-paths.ts dig-close
```

[Output](logs/dig-close-1.txt), excerpt:

```text
[DEEP] {"error":"","before":{..."ideas":[{..."state":"missed"},{..."state":"missed"}],"done_at":"2026-11-24T12:01:00.000Z"},
"after":{..."ideas":[{..."state":"own"},{..."state":"missed"}],
"asks":[{..."q":"What about spacing?"}],"done_at":"2026-11-24T12:01:00.000Z",...}}
[DEEP] FAIL a late ask must leave the finished dig unchanged
```

**Minimised steps:** Start a two-idea Dig, begin `digAsk`, hold the vendor, call `endDig` as closing the popup does, then release the response. **Expected:** the completed record stays as it was when ended. **Actual:** the same completed record acquires the late questions and judgment. **3/3.** It is not reopened, and the learner's own written words are preserved.

**Ranked hypotheses and probes:**

1. The first-stage save lacks a finished-state guard. Prediction: a `done_at` set during the call survives but does not block new output. **Confirmed.**
2. Close fails to persist. Prediction: the pre-release read lacks `done_at`. **Rejected:** it is present before release.
3. The reply is written to another/new Dig. Prediction: IDs differ or another record appears. **Rejected:** before/after are the same ID; the open-Dig control receives its normal questions without a completion timestamp.

**Cause:** `packages/core/src/ai/dig.ts:37–46` checks text and existing asks, not `cur.done_at`, unlike `digAnswer` at `:75`. `apps/desktop/src/Dig.tsx:111–119` ends the kept Dig when closing; that does not cancel the first AI call.

### AIVENDOR-07 — Claude's nonzero exit is ignored when it emitted a valid candidate

**S3 · Mac.** An injected process failure can be reported as successful feedback and written to the library. This establishes a handling defect, not how often a real Claude release emits a result before exiting unsuccessfully.

**Red command:**

```sh
bun codex-out/aivendor/adapter-faults.ts
```

[Output](logs/exit-1.txt):

```text
[DEEP] {"vendor":"claude","error":"","accepted":{"line":"A partial candidate"},"calls":1}
[DEEP] FAIL claude rejects exit 1 even with a parseable candidate
[DEEP] {"vendor":"codex","error":"codex failed (exit 1): fatal: transport failed after output","calls":1}
[DEEP] PASS codex rejects exit 1 even with a parseable candidate
```

**Minimised steps:** Fake Claude emits a correctly shaped result with `is_error:false`, writes a fatal reason to stderr, and exits 1. Call `runAgent`. **Expected:** surface the failed process and do not save its output. **Actual:** success. **3/3.** The [persistence probe](logs/guards-and-persistence.txt), `bun codex-out/aivendor/probes.ts controls`, also shows `tryLine` saving `Keep recalling.` from an exit-1 process.

**Ranked hypotheses and probes:**

1. Claude's result parser ignores the process exit code. Prediction: valid payload + exit 1 is accepted. **Confirmed.**
2. The fake actually exits successfully. Prediction: the same fixture is accepted by Codex too. **Rejected:** Codex captures exit 1 and rejects it.
3. Schema validation bypass alone explains it. Prediction: a wrong-shaped reply would also save. **Rejected:** the fault matrix rejects malformed and wrong-shaped Claude output, and explicit `is_error:true` rejects; the missing condition is the process exit status.

**Cause:** `packages/core/src/ai/adapter.ts:228–242` checks parseability, timeout and `out.is_error`, but never `r.code`. Both `runClaude` and the Claude `runChatTurn` branch use this helper. Codex explicitly checks its exit code.

### AIVENDOR-08 — Whitespace-only Try feedback is accepted, then saved as an empty line

**S3 · Mac.** A bad AI reply produces no readable D324 feedback but counts as a successful result with a saved line object. Distinct from F598's exercise draft parser and F329/F330's empty command responses.

**Red command:**

```sh
bun codex-out/aivendor/reply-edges.ts blank
```

[Output](logs/blank-1.txt):

```text
[DEEP] {"error":"","saved":{"text":"","ai":{"vendor":"claude","model":"claude-fake","prompt_version":"try-line@1"}},"calls":1}
[DEEP] FAIL a whitespace-only feedback reply must be rejected or retried, not saved empty
```

**Minimised steps:** Create an Apply highlight, record a reflection, return `{"line":" \n\t "}` from the vendor, then call/read `tryLine`. **Expected:** reject or retry a reply with no feedback text. **Actual:** one call succeeds and stores an empty `line.text`. **3/3.** A valid reply with surrounding spaces is trimmed and saved correctly in the control.

**Ranked hypotheses and probes:**

1. Length validation precedes trimming. Prediction: whitespace passes but stored text becomes empty. **Confirmed.**
2. The adapter gives no payload or uses its fallback result string. Prediction: no structured line reaches the schema. **Rejected:** the fake emits a structured `line`, and only one call occurs.
3. Serialization loses nonempty text. Prediction: the ordinary-text control also loses its line. **Rejected:** it saves `Keep recalling.` after trimming. The defect is specifically accepting whitespace as feedback.

**Cause:** `packages/core/src/ai/tries.ts:9` uses string `min(1)` without checking trimmed content; `:36` trims only after validation; `:42` persists it without a second content check.

## Leads — not retained as findings

- **Codex default-model attribution:** `adapter.ts` rereads `config.toml` when a run ends. `probes.ts default-model` exposes that timing, but the fake does not establish which model a real Codex process actually chose; no exact live-model red loop was run. See [probe](logs/default-model-lead.txt).
- **Non-UTF-8 output:** both vendor paths turn invalid bytes inside a JSON string into `�` and accept it (`reply-edges.ts encoding`, [output](logs/encoding-observation.txt)); no demonstrated learner-level failure beyond the replacement character, so no separate finding.
- **Tutor's early Stop:** its send path also awaits listener registration before starting `oreJob`; the analogous live component loop was not built. Only Ask is confirmed above.
- **Forgotten Review Ask sessions:** `askAboutCard` has no tutor-style reseed fallback; no retained exact recovery-contract reproduction for this older D61 path.
- **Phone “Skip a part”:** `scope --leave-out` is absent from `callsAi`, while Finish exposes the field and the core path calls a vendor. No actual phone-command harness was built for this scout; do not count it from the static read alone.
- **Codex tool isolation and fabricated research links:** the fake proves argv/data flow, not the actual vendor's enforcement or a model's handling of hostile instructions. No real-agent exploit or fabricated-link acceptance criterion was established.

## What passed / coverage limits

- [Fault matrix](matrix-bad.log): **80 cases** = 10 paths × 2 vendors × 4 faults (empty, cut off, explicit error exit, wrong shape); every case reached its fake executable and rejected. Paths: whole-source recall, video chapter recall, prequestion check, Dig ask, Try feedback, Explain, research, Ask-library, Review Ask, tutor. Codex empty/cut-off cases truncate its actual last-message file. Dig answer was exercised for the successful two-vendor stages, not through this full fault matrix.
- That matrix left the review directory empty: none of these AI paths recorded a learner rating (D21).
- Saved vendor/per-vendor models, `ORE_AI`, and `ORE_AI_MODEL` precedence passed. An explicit model/vendor changed during a held call did not relabel the started call; both vendor argv/model flags were captured.
- Unknown-model error fixtures stayed errors with the model reason; no silent model fallback was observed.
- Claude input above 64 KB went over stdin; embedded instruction delimiters, JSON-looking source text, backticks and `---` round-tripped as input data. This checks transport, not an actual model's resistance to prompt injection.
- Correct prompt versions reached the returned and saved results in these cases; no missing-header reproduction was needed. Arbitrary prompt overrides/evals were not exercised.
- Forgotten tutor sessions recovered for both vendors: one resumed error, one fresh session seeded with the saved turns. The tests used real-shaped vendor errors and the actual core fallback.
- Unchanged recall answers and unchanged check points saved correctly. Changed free-recall text and changed prequestion answer text were rejected by their existing guards.
- A Dig kept open received questions normally. Keeping one model across both stages preserved that identical attribution. Ordinary Try feedback trimmed surrounding whitespace correctly.
- Ask without the early Stop started once and displayed its answer. Ask's late reply after Stop did not enter its turns; the bug is the unwanted start, not a late visible answer.
- Read Explain's `live` cleanup, Tutor's turn/job ownership, `ai-commands.ts`, Hint and Working; no additional confirmed failure. No real native process-group cancellation, 15-minute timeout, security sandbox, load test, or exhaustive cross-screen race claim is made.

No fixes or commits were made: this is the requested findings-only handoff, through diagnosing-bugs phases 1–4.
