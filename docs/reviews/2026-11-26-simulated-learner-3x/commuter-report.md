# Commuter — five phone sessions

I used one WebKit context and one phone page for all five sessions on the owner's copied library (67 sources, 38 exercises, 10-minute goal): 22 effective ratings, a miss that returned, a source detour, two simulated hidden hours, touch highlights and a note in *Values Guide*, section-by-section reading to the ending, Finish, search, an article-link attempt, pasted text, large-text review, and a return after a simulated missed day. **One new S2 finding; no confirmed data loss or crash.** I skipped pure visual taste, native keyboard/selection handles, real iCloud sync, relaunch, Mac AI, and the known excluded defects. The article remains queued, and four quiz questions remain held for the Mac. This was a functional reading rehearsal and skim, not a claim to have read every word of the 88-minute guide. [Friction log](log.md), [exercise audit](exercise-audit.md), [timings](felt-slow.md).

## Findings

### 1. Rating a long answer hides the opening of the next question — S2 · iPhone

Large-text review repeatedly opened the next exercise partway down the question. I had to scroll upward before I could understand what I was being asked. This costs a recovery gesture on consecutive exercises in a short phone session.

Steps from a fresh phone page with this seed:

1. Use large iOS text, up to Ore's supported scale of 1.647. In this browser, set `document.documentElement.style.setProperty('--type', '1.647')`; keep 390×844 and verify `--keyboard` is `0px`.
2. Today → Start review → Start review. For a same-day journey through all the seed's exercises, first set New exercises a day to 20 in Settings; otherwise continue when these exercises become available.
3. Answer a long Explain exercise, reveal/check it, and scroll down through its answer and key points to the rating buttons.
4. Tap Good or Hard. Let the next question settle without touching its content.
5. Notice that the question begins above the viewport. Scroll up to recover its opening. Repeat with the next long answer.

**Expected:** a new exercise opens at the top of its question. **Actual:** the shared review scroller retains a nonzero position. At 390×844 with no keyboard inset, `01M78B5FPAPFE3D0TXK4EDCZF7` (rational action) arrived at **scrollTop 269**, question top **−134.375 px**; `01M78B5FPB2B3ZTD0EKH9Y8S0H` (export deadline) arrived at **scrollTop 429**, question top **−294.375 px**. Focus was on the review container, not an answer field. Both openings became visible by scrolling up.

**Reproduced:** 2/2 targeted long-answer transitions in Day 5, independently of the small-viewport test. Three analogous arrivals occurred on Day 4 at 375×667, but that resize also triggered a false keyboard inset; those are supporting observations only. A short-answer transition in Day 5 arrived correctly at scrollTop 0.

**Screenshots:** [rational-action arrival](day5-large-arrival2.png), [export-deadline arrival](day5-large-arrival3.png); conditional small-phone evidence: [arrival](day4-third.png) and [same question after scrolling up](day4-third-top.png).

**Suspected code:** `apps/desktop/src/Review.tsx:275` resets the next exercise's answer state without resetting the persistent `.review-body` scroll position. Its focus effect at line 309 deliberately uses `preventScroll`. The end-screen reset at line 1275 handles a different transition. This is related to the class of F465, but it affects **one exercise becoming the next**, not the end screen. No code was changed.

## Known rows and limits

- No previously fixed row was conclusively shown to have returned.
- **F730 passed:** two hour-long hidden intervals produced 38,313ms and 15,458ms saved exercise times. The first retained its question; the second retained its typed draft. These checks used Undo of the last rating because the queue had run out. They are simulated visibility events, not native OS suspension.
- **F738 passed:** Finish says “4 quiz questions wait on your Mac,” saves the recall to `notes.md`, and leaves *Values Guide* with `status: reading`. I could not take that quiz on the phone, but the reason and next step are now explicit. [Held quiz](day3-finish-held.png).
- **F14 remains:** many long answers put ratings below the viewport; all encountered IDs and measured button positions are in [exercise-audit.md](exercise-audit.md). It is not filed again.
- **F465 not established as recurrent:** Day 4's end screenshot was below the ring, but resizing the same live page made the keyboard adapter infer 177px of keyboard. Day 5's ordinary ending opened with the ring visible. The conditional Day 4 screenshot cannot support a native end-screen regression.
- **F739/setup:** Days 1–4 were sessions within the same calendar day. The queue ran out after Day 2's fifth rating, so the requested second set of three was not available. I temporarily raised the copied library's cap to 20 for Day 4, then restored 10. Only Day 5 moved two days. The phone core uses the page clock, and its new-day reset was observed; that does not validate the Mac bridge's clock.
- The two API exercises without quoted passages are from notes and have no evidence anchors in their seed files, as in the prior run. Their source links remain available. No raw Markdown was observed in the inspected exercise questions or answers.
- The failed article fetch is a browser/native-fetch limitation: the link was kept with “Your Mac will try it.” It was not successfully imported.

## What passed

- Eight Day 1 ratings saved; the first miss returned after three intervening exercises and received a separate rating.
- A source detour after three Day 2 ratings resumed the same next question.
- Two hidden-hour checks kept the current question and excluded hidden time; the typed draft survived the second.
- Two paragraph highlights made by touch saved, one with Key point intent and one with the exact note text.
- Reopening *Values Guide* returned to the reading area; search for “prioritize” found both source text and the new Key point, and opening the hit opened the source with Find.
- Finish saved the recall without falsely completing the four unavailable quiz questions.
- Pasted Markdown became *Values on the commute*, retaining its heading, two paragraphs, and `source.md` original.
- The review content stayed within the viewport horizontally; confidence choices and rating controls remained reachable by scrolling.
- The missed-day return showed 0 of 10 and no overdue/guilt/streak message.
- The goal did not force review closed. Leaving showed the end screen; Done returned to Today.
- The final 10-minute ring and 6 memories kept / +31 days agreed with persisted records.

## Saved data and end-screen checks

The phone's effective files are the read-only seed plus its IndexedDB overlay. Each day's `*-db.json` captures the overlay; [final-db.json](final-db.json) is the last one. [summary.json](summary.json) groups the saved reviews; [exercise-audit.md](exercise-audit.md) records every rated ID, rating, elapsed time, and next due date. Undo records are applied when counting effective ratings. There were 24 rating writes, two undone, leaving **22 effective ratings**; the miss and its recovery both count. No complete independent FSRS/priority-order reconstruction is claimed.

| Session | Effective ratings | Added review time | Calendar-day total | Display check |
|---|---:|---:|---:|---|
| Day 1 | 8 | 11m 48.562s | 11m 48.562s | Today showed 12; end screenshot was caught during animation at 11, so its settled number was not independently captured |
| Day 2 | 5 | 3m 09.337s | 14m 57.899s | End ring 15; last burst 2 kept / +5 days matches its summary; first burst separately saved 3 kept / +6 days |
| Day 3 | 0 | 0 | 14m 57.899s | Reading/recall did not add review time |
| Day 4 | 3 | 3m 08.008s | 18m 05.907s | 3 kept / +6 days matches summary; ring number outside captured viewport, not verified |
| Day 5 | 6 | 10m 04.928s | 10m 04.928s | Settled ring and accessible label: 10 of 10; 6 kept / +31 days matches summary |

The final saved settings contain `goal_minutes: 10`, `new_per_day: 10`. *Values Guide* retains the two new annotations and saved recall. The new pasted source has its own `doc.md` and original. The attempted article exists as a waiting inbox link. These are saved test-page files, not writes to the owner's library or proof of synchronization.

## Where the minutes went

Review durations below come from persisted ratings, capped at three minutes per exercise as the app counts them. They include injected 30–90 second thinking intervals and some real tester overhead. “Waiting” sums measured successful interactions, including Playwright actionability checks; it is not pure app latency. Reading/add/recovery time was not fully instrumented, so missing values are stated rather than estimated.

| Day | Review | Reading / Finish | Adding | Measured waiting | Lost / recovery |
|---|---:|---|---|---:|---|
| 1 | 11m 49s | 2m injected reading plus touch annotation work; total not recorded | — | 3.909s | Known long-answer scrolling; duration not recorded |
| 2 | 3m 09s effective | Brief source detour; duration not recorded | — | 3.477s | Queue ended after 5 ratings; two diagnostic reratings substituted for unavailable sixth exercise. Two hidden hours excluded |
| 3 | — | 5m 30s injected across 11 section visits, plus recall/search; total not recorded | One queued link, one saved text; total not recorded | 2.558s | Four quiz questions deferred; no native import available in this harness |
| 4 | 3m 08s | Settings/size setup; no substantive reading | — | 2.244s | Three next-question scroll recoveries observed; timing not recorded, geometry conditional on resize |
| 5 | 10m 05s | — | — | 2.531s | Two independently confirmed upward-scroll recoveries; timing not recorded |

## Felt slow

[Every measured wait, slowest first](felt-slow.md), with raw events in [timings.jsonl](timings.jsonl).

- Initial opening: **1,106ms**, with “Opening your library” shown.
- Longest successful tap-call measurements: review picker **495ms**; pasted-text Add **486ms**; other review starts **439–447ms**. These include automation settling before the touch.
- Search “prioritize” to first result: **189ms**.
- Actual touchstart to next question plus two rendered frames, isolated at the end: **107ms and 97ms**. This distinction matters: the 495ms tap-call measurement does not prove a 495ms unresponsive app.
- No repeated blank wait over one second was established. The repeated learner cost was losing the beginning of the next question, not waiting for its data.

## Scope and reproduction caveats

Used the pre-served phone build at port 1766 and connected WebKit at port 1760. One context, one page, both closed after the run. No server or browser was launched or stopped. Native iOS Settings are unavailable here; `--type=1.647` simulates the maximum the app supports (D250). Resizing from 844 to 667 in the same page was interpreted by its keyboard adapter as a keyboard: Day 4 cannot stand alone as a native-device layout verdict. The reported question-scroll defect was therefore confirmed twice back at 390×844 with `--keyboard=0px`.

The CommonJS driver and phase files document an interactive run, not a turnkey unattended test. Screenshots may catch transitions; only the explicitly settled evidence supports the finding. Selector mistakes, one screenshot timeout and a PTY command-length stall are excluded from product findings. Some exploratory Day 1 ratings used No idea, manual marking and an explicit confirmation; these are simulated UI ratings, not evidence of a real learner's mastery.

Checkout HEAD: `2ea55273b0eddc873666d6a07783d183e4234f3f`; the prebuilt phone bundle's compile revision was not separately attested. No repository source or findings registry was changed. Existing unrelated changes to `apps/desktop/scripts/mac-load.ts` and `docs/reviews/2026-11-26-simulated-learner-3x/` were left alone. All retained artifacts are under `codex-out/commuter/`. One setup scratch listing was accidentally written to `codex-out/commuter-known.tmp` and immediately moved into this folder; no outside artifact remains.
