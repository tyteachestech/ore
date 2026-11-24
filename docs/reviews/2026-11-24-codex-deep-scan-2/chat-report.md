# Ore deep scan — chat

Scanned master `1e55835e3db441eacc24a36ee4ff5d7bea6b08a2`: saved tutor JSON and version helpers, stubbed tutor/Ask vendor sessions, saved citations after reimport, synthetic Claude share-page variants, search/index lifecycle and query handling, skill lifecycle/importance, session receipts across midnight/Undo/repeated reviews/No skill, and the actual iPhone SQL adapter against the same indexed rows. Read the working agreement, relevant decisions/spec, findings, sweep history, and both first deep-scan reports; did not repeat their note-save, sync replay, EPUB, and source/skill-rename search findings. Eight reproducible failures follow, including a narrower recurrence of F319; one PR 523 concern is separate and explicitly unexecuted. This was not a UX sweep. Coverage is bounded: no real AI, live websites, native iPhone, full two-device sync transport, exhaustive manual-YAML variants, full skill merge journey, or independent exercise-importance queue matrix. Claude images/formulas remain existing intake-grid coverage gaps, not new findings here. Only `codex-out/chat/` was written; no repository fixes, findings-table changes, commits, installations, servers, or watchers. The supplied WebKit was used with one context and one page at a time, and each was closed.

All commands below run from `/Users/tylerpoelking/Developer/ore-wt/deep2`. Each script recreates only its own scratch library under `codex-out/chat/libs/`. Failed assertions deliberately exit 1. Counts are the final repeated confirmation runs, not exploratory attempts. Full outputs, including stacks, are in `logs/`; `confirm.ts` repeats the seven core/helper failures three times, and `confirm-browser.ts` checks the citation failure three times per changed-source case plus an unchanged-source control. The AI loop puts fake `claude` and `codex` executables first on PATH, uses scratch-local temporary files, and forbids fetch; it does not call real vendors.

## Findings

### CHAT-01 — Merging equal-word replies deletes one reply's AI provenance

**S1 — saved version metadata loss. Mac/core/CLI.** D172, D201 and the working agreement's vendor/model/prompt-version recording rule. Related to F316, but its distinct-turn race stays fixed; this is a same-turn, equal-text version collision. The observed loss is the earlier AI stamp/version, not the reply's words.

**Red command — [chat-loop.ts](chat-loop.ts):**

```sh
ORE_NO_ENRICH=1 bun codex-out/chat/chat-loop.ts same-reply
```

```text
[DEEP] {"vendors":["codex"],"turn":{"id":"t","message":"What is 2+2?","reply":"4.","ai":{"vendor":"codex","model":"codex-model","prompt_version":"tutor@16"}}}
AssertionError: One AI reply version and its stamp vanished during merge
```

**Minimised steps:** Save one turn with message `What is 2+2?`, reply `4.`, and a Claude stamp using `merge:true`; save a stale copy of that same turn with the same words and a Codex stamp using `merge:true`; read it back. Expected both independently generated versions/provenances. Actual: only the Codex version exists, with no alternate. **3/3 reproduced.**

**Ranked hypotheses and probes:** (1) Merge identifies versions by words alone; (2) serialization strips old metadata; (3) the reader hides an alternate still on disk. [chat-probes.ts](chat-probes.ts), output [chat-probes.txt](logs/chat-probes.txt), shows a single save retains the full stamp, the second identical-text save already lacks the first stamp in raw JSON, and changing the reply text preserves both stamps. This isolates (1), rejects (2)/(3). Eight stale saves adding different turns retain all nine turns.

**Cause:** `packages/core/src/chats.ts:73` keys a version by `[message, reply]`; lines 85–86 drop another version with that key without considering its AI stamp. Lines 87–90 recover a kept-exercise link, but not provenance.

### CHAT-02 — Saved citations highlight unrelated text after reimport

**S2 — false source evidence. Mac.** Saved chat citation navigation, distinct from F567's annotation reanchoring and F317/F322's repeat-click navigation. Those paths are not being re-reported.

**Red commands — [citation-browser.cjs](citation-browser.cjs), with self-contained core setup in [citation-loop.ts](citation-loop.ts):**

```sh
ORE_NO_ENRICH=1 node codex-out/chat/citation-browser.cjs moved
ORE_NO_ENRICH=1 node codex-out/chat/citation-browser.cjs gone
```

```text
[DEEP] {"mode":"moved","target":"A new introductory paragraph was i","expected":"Retrieval improves durable memory."}
AssertionError: Saved citation highlights unrelated text after reimport
[DEEP] {"mode":"gone","target":"Writing things repeatedly consumes","expected":""}
AssertionError: Saved citation highlights unrelated text after reimport
```

**Minimised steps:** Create a source containing `# Memory` and `Retrieval improves durable memory.`; generate a citation with real `splitPassages`/`passageCitation` and save it with `saveChat`. Reimport either (a) an inserted paragraph before the still-present quote or (b) a replacement paragraph with the quote removed. Open the saved Memory chat in the supplied Mac release build and click its citation. The browser script routes CLI calls to its own scratch library; no shared seeded library is changed. Expected: follow the original quote if it moved, or decline to mark unrelated words if the quote is gone. Actual: CSS `hl-active` marks unrelated text at the old offsets. **Moved 3/3, gone 3/3; unchanged control 1/1 passed.** Screenshots: [moved](logs/citation-moved.png), [gone](logs/citation-gone.png), [unchanged](logs/citation-unchanged.png).

**Ranked hypotheses and probes:** (1) Navigation trusts stale offsets; (2) reimport corrupts the quotation itself; (3) source id resolves to a different document; (4) Reader fails to paint an otherwise correct range. The saved citation retains its original quote and item id. The moved source still contains that quote later in its body. Both core boundary logging and the actual clicked/highlighted browser range equal the current body's slice at the old start/end; unchanged source paints the correct quote. This supports (1), rejects (2)/(3)/(4).

**Cause:** `apps/desktop/src/Tutor.tsx:1069` sends only `q:start:end:sequence` when opening a saved citation. `apps/desktop/src/Reader.tsx:1346–1347` uses those numbers to construct `exact` from the **current** body's slice. The original citation quote is never used to validate or relocate the jump.

### CHAT-03 — iPhone search misses accents and non-ASCII case variants that the Mac finds

**S2 — everyday search disagreement. iPhone.** Not F289: canonical composed/decomposed accents are a different case; these queries omit an accent or change letter case.

**Red command — [phone-search.ts](phone-search.ts):**

```sh
ORE_NO_ENRICH=1 bun codex-out/chat/phone-search.ts
```

```text
[DEEP] {"query":"café","mac":1,"phone":1}
[DEEP] {"query":"cafe","mac":1,"phone":0}
[DEEP] {"query":"Ελληνικά","mac":1,"phone":1}
[DEEP] {"query":"ελληνικά","mac":1,"phone":0}
[DEEP] {"query":"ΑΘΗΝΑ","mac":1,"phone":1}
[DEEP] {"query":"αθηνα","mac":1,"phone":0}
[DEEP] {"query":"Привет","mac":1,"phone":1}
[DEEP] {"query":"привет","mac":1,"phone":0}
[DEEP] {"query":"中文","mac":1,"phone":1}
AssertionError: Phone search loses accent-insensitive and non-ASCII case-insensitive matches
```

**Minimised steps:** Index a source whose body is `We met at a café. Ελληνικά. ΑΘΗΝΑ. Привет. 中文学习。`; load identical canonical index rows/schema into the actual phone `Database` adapter using its shipped sql.js WASM; call the same `LibraryIndex.search` on each. Expected the same membership for these queries. Actual: four queries miss only on the phone. **3/3 reproduced.** This tests the real phone SQL adapter, not an emulated replacement; it does not claim an IndexedDB sync failure.

**Ranked hypotheses and probes:** (1) Phone tokenizer differs; (2) query rewrite drops accents/case; (3) copied index content is incomplete. [phone-search-probes.ts](phone-search-probes.ts) runs raw MATCH on the same text in scratch tables: default FTS4 reproduces the misses; specifying `tokenize=unicode61` alone fixes each. Exact spellings work on both. This isolates (1), rejects (2)/(3). [Probe output](logs/phone-search-probes.txt).

**Cause:** `apps/desktop/src/phone/sqlite.ts:14–21` rewrites FTS5 into FTS4 without specifying the Unicode tokenizer. The resulting default FTS4 behavior differs from the Mac's FTS5 tokenizer.

### CHAT-04 — A successful accent-insensitive search opens Find with no match

**S2 — successful search cannot locate its own result. Mac.** Distinct from CHAT-03: the Mac finds the right source, then loses the match at the reader handoff.

**Red command — [search-loop.ts](search-loop.ts):**

```sh
ORE_NO_ENRICH=1 bun codex-out/chat/search-loop.ts accent-landing
```

Relevant output (source ids vary):

```text
snippet: "Learn at a [café] every day."
landing: {"words":"cafe"}
matches: []
AssertionError: A successful library search opens Find with zero matches
```

**Minimised steps:** Create body `Learn at a café every day.`; search `cafe`; pass the real hit through `foundIn`, then the actual reader `findRanges`. Expected one range covering `café`. Actual: `foundIn` discards the accented marked word and hands Find `cafe`, which matches nothing. **3/3 reproduced.**

**Ranked hypotheses and probes:** (1) Search-to-reader matching uses incompatible accent rules; (2) FTS returns a bad snippet; (3) Find has broken offsets. [search-probes.ts](search-probes.ts) shows the snippet contains the correct `[café]`; the exact-accent query produces `{words:"café",near:"Learn at a café every day."}` and range `[11,15]`; directly finding `café` also yields `[11,15]`. This supports (1), rejects (2)/(3). [Probe output](logs/search-probes.txt).

**Cause:** `apps/desktop/src/search-landing.ts:2,23–30` folds only case/whitespace and rejects `[café]` as a mark for `cafe`, then falls back to the raw query. `apps/desktop/src/Find.tsx:30–42` preserves accents while normalizing Unicode, so that fallback cannot match the text.

### CHAT-05 — Switching AI vendors breaks an existing “Ask about this” conversation

**S2 — follow-up fails. Mac/core/CLI.** D61's exercise conversation. Tutor's newer D338 vendor switching passes; the older exercise-chat path is different.

**Red command — [ai-loop.ts](ai-loop.ts):**

```sh
ORE_NO_ENRICH=1 bun codex-out/chat/ai-loop.ts ask-switch
```

```text
[DEEP] {"first":{"vendor":"claude","model":"claude-stub","prompt_version":"chat@2"},"error":"Error: codex failed (exit 1): No codex session found: 78b28488-cbea-43c5-8b93-f7eb31269af2"}
AssertionError: Switching AI vendor sends the previous vendor session to the new vendor and loses the follow-up
```

The UUID changes each run; the stub's error wording is its own, not a claim about a real Codex error message. The observable defect is the real adapter invoking Codex with a Claude session id. The failed user message remains retryable; no persisted message erasure was demonstrated.

**Minimised steps:** Create one exercise, set `ORE_AI=claude`, obtain the first `askAboutCard` reply/session; switch `ORE_AI=codex` and `ORE_AI_MODEL`; send a follow-up with that returned session. Both fake CLIs implement real-shaped responses and keep separate vendor session stores. Expected a usable vendor-specific continuation or a newly seeded session. Actual: `codex exec ... resume <Claude session id>`, with only the follow-up message, fails. **3/3 reproduced.**

**Ranked hypotheses and probes:** (1) An unqualified session crosses vendor boundaries; (2) the fake Codex result shape is invalid; (3) the exercise/context is invalid. `ask-same` passes through Claude with a changed model; `ask-fresh` passes through Codex without the old session on the same exercise. The stub argv log proves the foreign id is supplied as `resume`. This supports (1), rejects (2)/(3). Logs and fake executables remain under `libs/ai-ask-switch/`.

**Cause:** `packages/core/src/ai/chat.ts:25,41` treats any session string as a valid continuation, omits initial context and forwards it. `packages/core/src/ai/adapter.ts:494,529–533` chooses the current vendor and resumes that string unchanged. `apps/desktop/src/Ask.tsx:26,70–73` stores/returns only the session string, not its vendor, so the caller supplies no guard.

### CHAT-06 — Switching reply versions loses the section used by “Try another reply”

**S2 — wrong tutor context. Mac. F319 recurrence through version selection**, not a duplicate report of direct retry. D201 and D294.

**Red command — [chat-loop.ts](chat-loop.ts):**

```sh
ORE_NO_ENRICH=1 bun codex-out/chat/chat-loop.ts section
```

```text
[DEEP] {"before":"The second chapter","flipped":{"id":"t","message":"Explain this part","item":"source","reply":"First explanation.","alts":[{"message":"Explain this part","item":"source","reply":"Second explanation."}],"alt":0}}
AssertionError: Flipping to an earlier reply lost its source section for Try another reply
```

**Minimised steps:** Start a replied turn with `at:"The second chapter"`; call actual `askAgain` and supply its second reply; select the previous version with actual `flip`; call `askAgain` again. Expected the section to remain attached. Actual: `at` is undefined, so the next request has no section. **3/3 reproduced.** No model-quality inference is needed: the requested context itself is missing.

**Ranked hypotheses and probes:** (1) Version shelving omits the section; (2) flip separately strips it; (3) askAgain ignores a section still present. `chat-probes.ts` shows direct askAgain retains it; the first shelved version already lacks it; flip reconstructs the turn from that version. This locates the loss at (1), with flip exposing it, and rejects (3). [Probe output](logs/chat-probes.txt).

**Cause:** `apps/desktop/src/chat-versions.ts:7,11` excludes `at` from `PARTS`; `flip` at line 35 rebuilds the turn from those incomplete parts. `askAgain` at lines 44–49 does preserve `at` if it still exists, which is why F319's direct-retry guard passes.

### CHAT-07 — A session crossing midnight omits memory earned after the new day's goal

**S3 — wrong end receipt/reward explanation on a midnight session. Both, shared core.** D246/D247. This is **not** F184/F365/F373's daily-minute-ring bug; the failed field is `depth_extra_days`.

**Red command — [session-loop.ts](session-loop.ts):**

```sh
TZ=America/Los_Angeles ORE_NO_ENRICH=1 bun codex-out/chat/session-loop.ts midnight
```

```text
[DEEP] {"mode":"midnight","depth":25,"extra":0,"expected":8,"kept":3,"kept_skills":[{"skill":"learning","n":2},{"skill":"","n":1}]}
AssertionError: Post-goal memory on the second day is omitted from session extra
```

**Minimised steps:** Pin the clock; set a one-minute daily goal. Start June 1 at 23:58 PDT. Review three distinct new exercises Easy for 60 seconds each at June 1 23:59, June 2 00:01 and June 2 00:02. End at 00:03. The second review meets June 2's goal; the third is after it. Expected rounded third-review stability gain of 8 in `depth_extra_days`. Actual: the field is absent (read as zero), while total depth is correctly 25 and kept counts are correct. **3/3 reproduced.**

**Ranked hypotheses and probes:** (1) Extra calculation handles only the session's first date; (2) timezone/session timestamps are assigned incorrectly; (3) rounding erases the gain. Explicit offset timestamps and LA timezone remove ambiguity; moving all reviews to one local day yields `extra:17, expected:17`; the new-day third review alone contributes about 8 days, not a sub-rounding amount. Source inspection confirms (1), contradicts (2)/(3). Control: `session-loop.ts same-day`; [control log](logs/pass-session-loop.ts-same-day.txt).

**Cause:** `packages/core/src/sessions.ts:182–191` takes `day` from `own[0]` and excludes all other days when building `pastGoal`. The receipt at line 217 therefore drops later dates' extra memory; `apps/desktop/src/end-says.ts:83` consumes that missing count in the result explanation.

### CHAT-08 — Search joins Japanese characters across unrelated text boundaries

**S3 — false search hit with no passage to open. Mac reproduced; the same indexing code is used on iPhone.**

**Red command — [search-loop.ts](search-loop.ts):**

```sh
ORE_NO_ENRICH=1 bun codex-out/chat/search-loop.ts cjk-phantom
```

Relevant output (source ids vary):

```text
body: "日本。語。"
query: "日本語"
hits: [{kind:"item",title:"Language notes",snippet:"日本。語。"}]
AssertionError: Search found a Japanese word absent from source
```

**Minimised steps:** Create one source with title `Language notes` and body `日本。語。`; search `日本語`. Expected no hit: the word is absent. Actual: a hit with no bracketed matching passage. **3/3 reproduced.**

**Ranked hypotheses and probes:** (1) Index construction removes boundaries before phrase matching; (2) FTS merely treats punctuation as a separator; (3) a stale index leaks an earlier document. Fresh scratch libraries reproduce. `search-probes.ts` inspects the stored `chars`: `日本語。`, `日本。語。` and even `日x本x語。` all collapse to the same character sequence and match; `日本の語。` keeps its extra Japanese character and does not match. Intervening Latin letters disappearing distinguishes (1) from ordinary punctuation tokenization (2); fresh libraries reject (3). [Probe output](logs/search-probes.txt).

**Cause:** `packages/core/src/db.ts:287–294` builds `chars` with `s.match(UNSPACED)?.join(" ")`, discarding all intervening punctuation and Latin words. Lines 182–187 search a phrase against that artificially adjacent sequence without verifying the contiguous match in the source.

## PR 523 — static concern, not a reproduced branch finding

Reviewed `git diff master...origin/claude/project-thread-nr9jj8` at `fec50efeefa9895319bbf3233a7370c91cc5ba59`. **No PR code was executed.** The no-red-loop rule keeps this outside the eight confirmed findings. This is a logic concern, not a comment on its appearance.

**PR523-L1 — A session's stone can borrow “ready” from an untouched exercise. Proposed S2, Mac and iPhone end screen.** At that branch's `apps/desktop/src/Lap.tsx:79–93`, the comment and renderer call the stones the session's own memories; `near = Math.min(nowSkill.ready, n - c)` assigns their ready state from the entire skill. `nowSkill.ready` includes exercises not reviewed this session (`packages/core/src/today.ts:103–114`). A session keeping one rough exercise with no gems can therefore render one ready stone simply because another exercise in that skill is ready.

**Static trace:** `kept=[{skill:"learning",n:1}]`, `cut=[]`, `now.learning.ready=1` → lines 90–92 yield `n=1,c=0,near=1` → `slots=["ready"]`. This is reasoning from the diff, not a run. The alternative “ready is already session-filtered” is ruled out by master core's caller contract and the below probe; “the reviewed exercise really is ready” is ruled out by unchanged skill-wide ready count and its own rough gem. A different intended meaning for the row would need an explicit decision; it currently says these are the session's own stones.

A **passing master-only premise probe**, not a PR reproduction:

```sh
ORE_NO_ENRICH=1 bun codex-out/chat/pr523-premise.ts
```

[pr523-premise.ts](pr523-premise.ts) creates exercise A, reviews it Easy the previous day, and leaves it untouched. It reviews new exercise B Good in the current session. Output [pr523-premise.txt](logs/pr523-premise.txt) confirms skill `ready:1` both before/after, B's gem `rough`, no cut gems, and `kept_skills:[{skill:"learning",n:1}]`. These are reachable inputs for the static trace. A future branch red test should pass those actual core results through `endPlan` and assert a rough slot. Ranked causes: (1) whole-skill/session scope mismatch, supported; (2) impossible input state, rejected by core probe; (3) renderer later corrects the kind, contradicted by direct `r.slots` use at branch lines 197 and 204–206.

## Leads and explicit gaps

- PR523-L1 above has a reachable-input probe and static cause, but no permitted branch red run; do not count it as reproduced.
- Hand-edited duplicate skill ids/names and path-like ids deserve a focused follow-up: the parser accepts a plain string id and does not visibly enforce uniqueness; no destructive-operation loop was established, so no finding is claimed.
- No new claim about archived/deleted-source tutor continuation: reimported citation navigation was exercised, but archived/deleted-source context recovery was not fully isolated.
- A ready/rough interpretation change could resolve PR523-L1 by design; the current code comments explicitly describe session-specific stones, which is why it is raised.
- F575's long-running reimport test and F577's highlight-end trimming were left to the intake/media run; this run does not claim them fixed or regressed.

## What passed

Commands for these controls are collected in [pass-controls.ts](pass-controls.ts); all 12 entries exited 0 in the final run. Output files start with `logs/pass-`.

- `chat-loop.ts roundtrip`: 300 seeded save/read/save/read cases preserve complete turns, including frontmatter-looking lines, `---`, fenced code, emoji, RTL, CRLF, null characters, CJK, citations arrays, and alternate AI stamps.
- `chat-loop.ts race`: eight concurrent stale merge saves retain all nine distinct turn ids.
- `chat-probes.ts`: different-word versions retain both AI stamps; direct retry without version flipping retains its section.
- `ai-loop.ts tutor`: four turns switching Claude/Claude/Codex/Codex and models return complete, correct AI stamps through the actual adapter with fake executables.
- `ai-loop.ts tutor`: null, empty, cut-off JSON, and an empty reply terminate with errors; a 120,000-character valid reply is preserved.
- `ai-loop.ts ask-same` and `ask-fresh`: same-vendor continuation with a changed model, and fresh Codex exercise conversation, both pass.
- `import-loop.ts`: synthetic saved Claude-share variants preserve code indentation, table cells, Unicode/RTL, first-to-last turn order, title, explicit artifact omission notice, and exclude tool-status/page chrome.
- `import-loop.ts`: `2026-11-24T15:30:00+09:00` becomes `2026-11-23` in LA as D339 requires; empty/non-chat markup returns null from the chat recognizer. This is recognizer-level coverage, not a claim that every generic HTML add refuses that markup.
- `search-loop.ts punctuation`: quotes, star, hyphen, colon, NEAR, OR, unmatched parentheses, composed/decomposed accents, CJK, `C++`, `C#` and underscores return expected hits without SQL errors. Emoji-only search was not established as supported or broken.
- `search-loop.ts lifecycle`: archived sources and their notes leave results; restoration returns them; external note edits replace indexed content; removing the source directory removes its hits.
- `skills-loop.ts`: slash/dot/emoji/Japanese/C++/C# names get distinct safe generated ids, case-only duplicate creation is refused, rename preserves notes, remove/recreate isolates old notes, restore recovers them, and No skill/refiling propagates to exercises.
- `skills-loop.ts`: changing skill importance changes inherited retention without changing stored FSRS stability/difficulty; source importance overrides it; archived skills' exercises leave the due queue and return when restored. This is not an exhaustive queue-order test.
- `session-loop.ts same-day`: after-goal memory count is correct within one local date.
- `session-loop.ts undo-repeat`: an undone rating is excluded; repeat review does not turn an initial miss into a first-try kept exercise; No skill contributes one correctly named empty-id entry, with correct total counts.
- `citation-browser.cjs unchanged`: the actual saved citation opens and highlights the correct passage when its source is unchanged.
- `phone-search.ts`: exact-accent/exact-case matches and a Chinese substring agree across the real phone SQL shim and Mac; four specific accent/case queries are the failures above.
- PR 523 static checks: reduced-motion rows are not inherently clipped by the rolling-window rule; `overflow:hidden` is gated on `data-rolls`, which is absent under reduced motion. Not reported as a bug.

Final scope check: tracked repository diff remains empty. The pre-existing untracked `docs/reviews/2026-11-24-codex-deep-scan-2/` was not changed by this run. No full test/build/e2e suite was run because this was a findings-only scan with no implementation changes; all loops are bounded, local, and complete.
