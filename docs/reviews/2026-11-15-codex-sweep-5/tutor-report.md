# Tutor sweep — 2026-11-15

Tested the supplied release build in WebKit at 1280 × 800, with 2× screenshots: 50 exchanges about one source and 50 in the library-wide tutor, rich Markdown, citation navigation, closing/switching/reloading during replies, second-question drafts, Stop, failures and retry, saved-chat reopening, deletion/Undo, and two windows editing one saved chat. Checked Review streaming and Stop against the review files. Inspected iPhone Home, a source, and Review at 390 × 844 with touch. No real AI ran. Browser replies used the supplied hooks; a separate probe replaced `runAgent` with a deterministic function to capture real core context and exercise its citation validator and logger on a copy inside this report folder. No tracked repository files changed. Six findings follow; each was reproduced twice. Live vendor sandboxing, real generation quality/latency, native iOS execution, and real provider cancellation were not tested.

## Findings

### 1. Two windows silently overwrite each other's chat turns — S1, Mac

1. Open a fresh Mac page using the initialization in `driver.cjs`. Open the tutor and send `Two windows 1`, returning the simple fake reply from that script.
2. Open a second page in the same context, initialize the bridge, open the tutor, and select that same saved chat from Chats.
3. In window A send `Window A unique 1` and wait for its save.
4. In window B send `Window B unique 1` and wait for its save.
5. Read the corresponding `chats/<id>.json`, or reload and reopen it.

Expected: keep both turns, or reject the stale save with a recoverable conflict. Actual: the file contains only the shared first exchange and window B's exchange. Window A still displays its own exchange, giving no warning that it was deleted from disk. This does not require simultaneous writes; a stale window is sufficient. Reproduced **2/2**, with distinct chats.

Evidence: `concurrent.json` records disk contents and both visible transcripts; screenshots `concurrent-1-a.png`, `concurrent-1-b.png`, `concurrent-2-a.png`, `concurrent-2-b.png`. Replay: `concurrent.cjs` from `driver.cjs`.

Suspect: `packages/core/src/chats.ts:72–78` reads the existing chat only to keep timestamps, then replaces all turns with the submitted copy. `apps/desktop/src/Tutor.tsx:119–133` serializes writes only inside one window; no base revision or cross-window merge is sent.

### 2. A second citation in the same source does not navigate — S2, Mac

1. From a fresh Mac page, stay on Home and open the tutor.
2. Return the two valid citations constructed in `citation-same-source.cjs`: source `01M7FR3XGAM1B2CH41MCM029SX`, offsets **58–159** under Overview and **3194–3468** under In practice.
3. Click the first citation. It opens the source and highlights the correct quote.
4. Click the second citation while that source remains open.

Expected: scroll to In practice and highlight the second quote. Actual: the first quote stays highlighted and scrollTop stays **15**. Both quotes are real, in-bounds passages in the unchanged source. Reproduced **2/2** from Home with separate chats. An initial click while the source was already open also failed to move during the broader citation check.

Evidence: `same-source-citations.json`, `same-source-citation-1.png`, `same-source-citation-2.png`. Replay: `citation-same-source.cjs`.

Suspect: `apps/desktop/src/Reader.tsx:1283–1291`: quote navigation is guarded by `jumped.current`, and the painting effect does not depend on `p.jumpTo`. `Tutor.tsx:978` supplies the new offset correctly.

### 3. Ordinary code indexing is rejected as a missing citation — S2, Mac/core

1. Use `bun codex-out/tutor/context-probe.ts`. This uses the copied library and a fake adapter, so it cannot call an AI provider.
2. Give the real `TutorOutput` validator a reply of ``Use `xs[1]` to access the second element.``, with no citations, card, exercise, or worked steps.
3. Run the real tutor task's `check` callback on that reply.

Expected: inline code remains code; it does not need a numbered citation. Actual: `Error: marker [1] has no citation`. Reproduced **2/2**. The normal adapter would treat this as invalid output and request a rewrite; two such replies would fail the turn. That adapter retry was not simulated by this probe, so the observed result is the validator rejection, not a claimed live-provider failure.

Evidence: `context-results.json` (the two `mode: code` entries), `context-summary.json`, and `context-lib/.ore/logs/tutor.jsonl`. Screenshot: not applicable, core validation runs before the checked UI reply. The browser hook alone cannot test this because it bypasses the validator.

Suspect: `packages/core/src/ai/tutor.ts:269–272` scans all reply text with `/\[(\d+)\]/g`, including code. The earlier citation-repair code at lines 257–263 already excludes backtick code, but this final marker check does not.

### 4. Retrying “this part” drops the section context — S2, Mac

1. From a fresh page open “Retrieval-augmented generation, explained”.
2. Scroll “The core idea” to the top of the reader. Open the tutor and start a new chat.
3. Send `Explain this part 1` with a simple fake response, logging `__TAURI_INTERNALS__.invoke` requests as in `driver.cjs`.
4. Click “Try another reply”.

Expected: retry the same question with the same source and section context. Actual: the original request contains `--at=The core idea`; the retry keeps `--item` but drops `--at`. This makes a retry of a location-dependent question less informed. Reproduced **2/2** after scrolling; the preliminary checks above the first heading correctly had no section and are not counted.

Evidence: `retry-context.json`, `retry-context-1.png`, `retry-context-2.png`. Replay: `retry.cjs`.

Suspect: `apps/desktop/src/Tutor.tsx:234–239` reconstructs the turn without copying `old.at`.

### 5. Mathematical replies display raw LaTeX — S2, Mac

1. From a fresh page open the tutor and return a reply containing `$$\frac{1}{1+e^{-x}}$$` and `Inline $E=mc^2$` using `__ORE_REPLY.tutor`.
2. Repeat in a source chat and a library-wide chat. The exact rich reply is in `long.cjs`.

Expected: fractions, exponents, and inline formulas are readable as mathematical notation. Actual: dollar delimiters, backslashes, braces, and caret syntax are printed literally. This obstructs learning from formulas; it is not a spacing or color preference. Reproduced in **both 50-turn journeys** and visible in the final reply of each.

Evidence: `source-long-50.png`, `library-long-50.png`; `source-long.json` and `library-long.json` retain the fake reply in earlier-turn request data.

Suspect: `apps/desktop/src/Tutor.tsx:991–998` uses only `remarkGfm` for replies and steps, with no math parser/renderer. Review's `Ask.tsx` uses the same GFM-only pattern, but this report does not claim a separate visual reproduction there.

### 6. Saved chats cannot be renamed — S3, Mac

1. From a fresh page open the tutor and send a question to create a chat.
2. Open Chats with the title button and right-click the chat row.
3. Inspect the row menu and title controls for Rename.
4. Repeat with a second saved chat.

Expected: let the learner give a saved conversation a recognizable name for later retrieval. Actual: the row menu contains only “Delete chat”; the title only opens the list. There is no rename/edit-title control. Reproduced **2/2**. This is a missing history action, not a failed text field.

Evidence: `history.json`, `history-no-rename-1.png`, `history-no-rename-2.png`. Replay: `history.cjs`.

Suspect: `apps/desktop/src/Tutor.tsx:1093–1175` (`ChatList`): the row actions only define Delete, and the title is only a popover trigger.

## Known rows seen again

None confirmed. In particular, the stopped-reply check did not count a missing AI stamp when the injected stream omitted that stamp; that would be a harness omission, not evidence that F186 returned. F261–F265 were checked within the fake-adapter limitations below. Ordinary code being mistaken for a citation is a separate defect from F262's repaired quote handling.

## What passed and coverage limits

- **Long source chat:** 50 saved exchanges, first and last present on disk. Median send-and-save 167 ms; 95th percentile 218 ms. These are local fake-reply UI/storage timings, not AI latency.
- **Long library chat:** 50 saved exchanges, first and last present on disk. Median 176 ms; 95th percentile 234 ms. The request log also contains earlier source-chat requests, since the observer was not reset; the final 50 are the library journey.
- **Rich text:** headings, bold, code and table elements rendered; formulas failed as above.
- **Close, type, and Stop:** 2/2 runs kept the waiting draft, blocked Enter from sending a second concurrent request, displayed a streamed partial reply, and retained the stopped reply after reload/reopening (`interrupt.json`).
- **Switch source:** delayed replies landed in their original conversation after navigation; they were not inserted into a new conversation (`lifecycle.json`).
- **New chat while waiting:** 2/2 background replies were saved in their original chat, while the foreground chat kept only its own exchange (`background.json`).
- **Reload during a wait:** the submitted question was saved; reopening said “No reply came: Ore closed before it did.” and offered Try again, 2/2 (`lifecycle.json`).
- **Failure/retry:** injected tutor failures named the error and offered a working Try again, 2/2. No permanently spinning wait in these tested paths.
- **Delete/Undo:** both deleted chats came back with their exchanges after ⌘Z (`history.json`, `history-undo-1.png`, `history-undo-2.png`).
- **Citation boundaries:** deleted-source and outside-library item references showed `no item matches` and an escape route; no outside file was opened (`citations.json`). Out-of-bounds passage offsets did not navigate or explain the failure; because that reply bypassed validation, this is recorded as defensive behavior, not a separate confirmed production defect.
- **Core citation repair:** unknown passage `P999` and an outside-library path were dropped, their marker removed, and `general` set true (`context-results.json`).
- **Whole source:** the real context assembler sent passages through the final “In practice” section with `reading.whole: true`, plus the supplied reading position and marked passages (`context-requests.json`).
- **Notes and recent misses:** in two isolated copied-library probes, the current source's highlight note `OWN_HIGHLIGHT_NOTE` reached context, another source's `PRIVATE_OTHER_SOURCE_NOTE` and `PRIVATE_OTHER_HIGHLIGHT_NOTE` did not, and five recent missed exercise questions were included when the AI skill was in scope. An attachment escaping the chat folder (`../private.md`) was refused. This tests assembly and path validation, not provider tool permissions.
- **Long-history policy:** at 50 prior long exchanges the assembler retained six full exchanges and 30 earlier question lines. The first retained line was Question 15. Questions 1–14 are therefore absent under the explicit D293 cap; this is the current documented limit, not a recurrence of the old six-turn-only F264 defect.
- **Turn logs:** copied-library core runs appended success/error entries with model/prompt, repair counts, usage, and timing for the fake adapter. UI-hook replies intentionally create no core turn log because they bypass `tutor()`. A one-to-one comparison between the browser's fake turns and real AI telemetry is therefore unavailable in this setup.
- **Review:** 2/2 requests named the current exercise ID; injected partial text appeared before completion; Stop retained it with “Stopped”; typed follow-ups survived; late completion did not replace it. Review files were byte-for-byte unchanged by asking/stopping (`review.json`, `review-stream-*.png`, `review-stop-*.png`). One explicit Good rating was then used solely to reach the end screen.
- **Review end screen:** inspected after that rating; it offered Keep going and Done, with no Ask/Tutor control (`review-end.png`). Exercise-specific chat on that screen could not be tested because it is not exposed.
- **iPhone:** no tutor on Home or the source screen; Review hides Ask as a Mac AI action. Captured `phone-home.png`, `phone-source.png`, `phone-review.png`, and the exercise action sheet. No phone chat journey exists in this build to run the Mac cases against.
- **Enter Review during a source reply:** 2/2 runs started Review with Quiz me while the source tutor was waiting, let the reply land during Review, then left Review and found the correct reply in the original chat (`review-background.json`, `review-background-1.png`, `review-background-2.png`).

## Harness notes

`node codex-out/tutor/driver.cjs` connects to the supplied WebKit server and initializes only the tutor Mac port. It accepts short JavaScript commands on stdin, such as `await require('./concurrent.cjs')();`. Use `long.cjs` on a fresh source chat, then a fresh Home chat. `phone.cjs` closes the desktop context before opening the touch context. The run kept at most two pages in one context and did not launch or stop any server. All test pages and contexts were closed at completion. All screenshots, scripts, copied probe fixtures, and evidence are inside `codex-out/tutor/`. The assigned live scratch library was changed only by UI-driven core commands; the core-only probe changed its own copied fixture through core APIs.
