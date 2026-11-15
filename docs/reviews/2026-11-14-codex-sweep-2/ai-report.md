# AI sweep — ai

Tested the supplied Mac release page in connected WebKit at 1280×800, 2× resolution, and the iPhone page at 390×844 with touch. Read the working agreement, daily-session guide, findings register, D21, D116, D146, AI adapter and callers. Exercised real 5 s, 30 s and 120 s response delays; missing Claude/Codex, signed-out, rate-limit, timeout and invalid-JSON errors; null results; late grading; provider/model changes; leaving and returning; five-source import; long questions; missing citations; and saved AI attribution. Found four new issues, each reproduced twice. No product files or findings-register rows were changed. AI is disabled in this harness: synthetic replies/stream events test UI behavior and persistence, not model quality. Real background enrichment of five sources and background variant generation could not be exercised here; existing core tests cover their output and attribution. Empty-library/no-answer retrieval was checked in core tests, not against an emptied browser library. The phone has no AI service; its review fallback was tested instead of injecting Mac bridge hooks into it.

## Findings

### AI-1 — A null reply to Review’s Ask crashes the review view

**S1 · Mac · reproduced 2/2 fresh-page recovery runs**, also at all three delay durations.

1. Open a fresh Mac page with the supplied bridge and `tauri.js` init scripts.
2. Start review. In What to review, select only Teaching.
3. Type an answer, choose Think so, and click Check. The null grade gives the self-marking fallback.
4. Click Ask about this, then “Why is this the answer?” Leave `ask` at the harness’s default null response.
5. For the slow versions, set `window.__ORE_SLOW = { ask: 5000 }`, `30000`, or `120000` before step 4.

**Expected:** A failed/empty-answer message inside the chat, Retry, and the exercise and rating controls retained.

**Actual:** The review is replaced by “This view hit a snag. null is not an object (evaluating 'i.session')”. Go home recovers the app, but the learner has to leave the review. This is the crash on receiving null, not a complaint that mock AI produces no answer. Injected rejected commands show their error and Retry correctly.

**Evidence:** [first crash](ask-null-crash-1.png), [second crash](ask-null-crash-2.png), [120 s crash](slow-ask-120000-end.png). Reproducer: `node codex-out/ai/recovery.cjs`.

**Suspected cause:** `apps/desktop/src/Ask.tsx:57` dereferences `r.session` and `r.reply` inside a React state-updater callback. The exception occurs when React runs that callback, outside the surrounding request’s `try/catch`. `apps/desktop/src/Review.tsx:1399` wraps that updater in another state update.

### AI-2 — Tutor and palette Ask remain busy after a null reply; Stop does nothing

**S2 · Mac · reproduced 2/2 fresh-page recovery runs** (one tutor entry, one ⌘K entry), plus both entry points at 5 s, 30 s and 120 s.

1. Open a fresh Mac page.
2. Open the tutor and send “Why does retrieval help?” Alternatively press ⌘K, type that question, and choose Ask your library.
3. Let the harness return null. Confirm `window.__ORE_INFLIGHT` is empty.
4. Click Stop the reply. Close and reopen the tutor.

**Expected:** The completed empty response settles as a failure, with a reason and Try again. Stop must settle a reply shown as running.

**Actual:** “Reading your sources…” remains on screen; after five seconds it adds “A reply takes about 10 seconds.” Stop has no effect, closing/reopening keeps the same wait, and this conversation cannot send a follow-up. A new chat is a way out. An empty object also leaves the wait; an empty-string reply renders an empty bubble instead of an error. Those additional malformed shapes were tested once and are not counted as separate findings.

**Evidence:** [first Stop attempt](tutor-null-stop-1.png), [second Stop attempt](tutor-null-stop-2.png), [reopened](tutor-null-reopen-1.png), [120 s result](slow-tutor-120000-end.png); `slow.jsonl` records no commands still in flight. Reproducer: `recovery.cjs`.

**Suspected cause:** `apps/desktop/src/Tutor.tsx:182` removes the job before dereferencing the reply at line 184. When null throws, line 186’s `mine()` check is already false, so it discards the error. Stop also requires that now-deleted job (`Tutor.tsx:212`).

### AI-3 — Leaving and reopening an enrichment retry shows a false failure and permits a second run

**S2 · Mac · reproduced 2/2.** Only the concurrent commands were observed; no real AI usage was incurred and no duplicate exercises are claimed.

1. Open a fresh page on an unenriched source old enough to offer Try again. The test source is “AI sweep source”, created through Add; the script fixes the page’s clock 21 minutes ahead to cross the reader’s 20-minute age cutoff without editing its file.
2. Set `window.__ORE_SLOW = { enrich: 120000 }` and click Try again.
3. While enrichment is pending, click Home, then reopen the same source through ⌘K.
4. Click Try again on the reopened source.

**Expected:** The reopened source shows that its existing enrichment is still running and observes that run’s completion. It should not announce failure or offer another run while the first is pending.

**Actual:** It says “Couldn’t write prequestions” and offers Try again while the first `enrich <same-id>` is still in flight. Clicking it produces two simultaneous enrichment commands for that source. Reading remains available.

**Evidence:** [first reopen](enrich-reopen-1.png), [second reopen](enrich-reopen-2.png), [two pending commands, first run](enrich-reopen-1-inflight.json), [second run](enrich-reopen-2-inflight.json). Reproducer: `enrich-reopen.cjs`.

**Suspected cause:** `retrying` belongs to the mounted Reader (`apps/desktop/src/Reader.tsx:725`, `:1165`); navigating away destroys it. Reopening derives failure from source age (`:1108`) without knowing the earlier job. Core’s enrichment calls the agent before its write lock (`packages/core/src/ai/enrich.ts`), so a second command is not prevented from asking AI again by the write lock.

### AI-4 — Stopped streamed tutor text is saved without its AI attribution

**S2 · Mac · reproduced 2/2; saved files inspected.** This violates the rule that AI output records vendor, model and prompt version.

1. Open a fresh page, set `window.__ORE_SLOW = { tutor: 120000 }`, and send a tutor message.
2. Read that request’s `--stream=<id>` from the browser request log. Emit the normal stream event: `window.__emit('ore-progress', { stream: id, reply: 'A partial explanation about spacing and recall.' })`.
3. Once those words appear, click Stop the reply.
4. Read the resulting `chats/<id>.json` in the scratch library.

**Expected:** The retained AI text has vendor/model/prompt provenance, with its stopped status. It must remain traceable even when the final response never arrives.

**Actual:** The file retains `reply`, `citations: []`, `steps: []`, `marks: []`, and `stopped: true`, but has no `ai` field at all. This is real chat persistence through the app; the stream text was synthetic because AI is disabled. Normal completed replies do save their stamp, including a reply whose provider/model Settings changed mid-flight.

**Evidence:** [first stopped reply](tutor-stopped-partial-1.png), [second stopped reply](tutor-stopped-partial-2.png), exact saved-file copies [first](stopped-chat-1.json) and [second](stopped-chat-2.json), [completed reply for comparison](completed-chat-provenance.json). Reproducer: `tutor-edges.cjs`.

**Suspected cause:** `apps/desktop/src/Tutor.tsx:218` saves partial text without an AI stamp. The stamp is attached only on normal completion at line 184; current progress events contain text/search status, not provenance.

## Known rows seen again

None confirmed. These four do not duplicate the existing tutor bubble/contrast rows or the review-start races. The existing short-window rating-layout finding was not re-audited.

## What passed and coverage limits

| Step | 5 s / 30 s / 120 s | Completion and ability to continue |
| --- | --- | --- |
| Explain grading (`grade`) | All three run in real elapsed time | “Checking your answer…”; ratings remain available. Null becomes an unexpected-reply message with self-marking and Retry. No dedicated Stop; rating/leaving ignores late results. |
| Tutor (`tutor`) | All three | Named read-stage wait and Stop while genuinely pending. Null completion has AI-2. A real Stop before completion settles; later output is ignored. |
| ⌘K Ask your library | All three | This UI calls `tutor`, not `ask-library` (`App.tsx:2540`). Same wait and AI-2. |
| Review Ask (`ask`) | All three | Three dots labeled Thinking; no dedicated cancel control. A null completion has AI-1. |
| Reader Explain (`explain`) | All three | “Explaining…”; null says “Explaining needs AI” with Retry. Esc closes it and reading continues; no process-cancel control. |
| Enrichment retry (`enrich`) | All three | “Writing prequestions…”; reading remains usable. Null returns to “Couldn’t write prequestions” with Try again. No dedicated cancel control. Reopening has AI-3. |
| Question variants (`remix`) | Not injectable through these page hooks | Generation runs in a detached CLI process and is disabled by `ORE_NO_ENRICH`. The browser does not call `remix`; it reviews an already-written variant or the original. Core variant tests passed. No live generation claim. |

- **30 injected rejection checks passed:** missing Claude, missing Codex, signed-out, rate-limit, timeout and invalid-output reasons appeared with Retry in each of grade, tutor, Review Ask, Explain and enrichment. These verify display/recovery of supplied errors, not actual vendor installation/authentication or real rate limiting. See `failure-*.png` and `failures.jsonl`.
- **D21 passed twice:** rated the Explain exercise Hard, then rated the next Fact Hard while the earlier grade was still pending. Released an AI suggestion of Easy. The review log was byte-for-byte unchanged by the late grade; its feedback did not appear on the next exercise. See `late-grade-1-calls.json`, `late-grade-2-calls.json`, and corresponding screenshots/log copies.
- **Recorded rating and attribution passed:** a completed synthetic grade suggested 4; choosing Hard saved `rating: 2`, `ai_rating: 4`, and the supplied vendor/model/prompt stamp. See `grade-provenance-log.txt`.
- **Provider/model change passed for pending tutor:** switched Claude → ChatGPT → Claude, selected Haiku, then switched to ChatGPT before releasing the original reply. The original reply remained in its chat and retained its original stamp. Settings were restored to Claude/Sonnet. See `flight-tutor-calls.json` and `completed-chat-provenance.json`.
- **Settings during grading:** opening Settings through ⌘K leaves Review. Changing provider and releasing the old grade did not put old feedback on another screen or record a rating. Direct ⌘, did not open Settings while Review held focus. See `grade-settings-calls.json` and screenshots. A model-only change during a still-open grade was not exercised.
- **New chat during a pending reply passed:** the old reply saved to the old chat, the new chat kept its unsent draft, and choosing the old chat reopened the reply. See `tutor-background-chat.json`, `tutor-new-chat-old-reply.png`, `tutor-old-chat-returned.png`.
- **Long question:** a 19,525-character question submitted and displayed its synthetic reply without a crash (`tutor-long.png`). No live token-limit behavior was tested.
- **Missing citation target:** a synthetic reply citing a nonexistent/deleted ID opened an error, “no item matches …”, with “Esc back to sources”; the chat remained intact. No crash or broken rating was observed (`tutor-missing-citation-click.png`). Actual deletion mid-reply was not performed.
- **Five-source import:** five original Markdown fixtures selected together through Add → File → Enter were saved and listed. The bridge disabled their background AI; no claim that five concurrent enrichment jobs completed. See `batch-five-listed.png` and `batch-add-calls.json`.
- **iPhone:** a typed Explain answer falls back to “Checking answers runs on your Mac for now. Mark what you got.” Both key-point controls and all four rating buttons remain present (`phone-check.png`). No phone AI backend, provider switching, or native iOS process behavior was tested.
- **Focused core verification:** **103 passed, 0 failed**, 477 assertions across `ai.test.ts`, `ask-library.test.ts`, `tutor.test.ts`, `remix.test.ts`, and `chats.test.ts`. Fake vendor executables, no real AI. Tests cover empty-library tutor/general-knowledge behavior, absent library answers, malformed output retry, vendor/model selection, enrichment stamps, and variant writing/checking. Log: `core-tests.log`; sampled written output: `core-provenance-samples.json`. Temp artifacts stayed under `codex-out/ai/tmp`.

All screenshots, scripts, extracted evidence and this report are in `codex-out/ai/`. Library mutations were made by the app against the supplied scratch libraries. Product code, the findings register, the running servers, the installed app and `~/Ore` were left alone. Existing unrelated tracked edits were not changed.
