# Newcomer friction log

Subject: transformers for work. Five sessions on one real day; no simulated scheduling claims. Times use performance.now(). Tool/inspection time is not human reading time.

- Day 1 | Open | Startup measurement 164 ms reached body only; INVALID as a Home-ready time. Home then inspected visually.
- Day 1 | Add | open dialog | 36 ms (action to observed state).
- Day 1 | Add | Harvard article readable | 1340 ms (action to observed state).
- Day 1 | Add | PDF first observed readable by 5027 ms; Adding then Reading the pages for headings, tables and formulas shown. Bound includes observation delay.
- Day 1 | Add | Wikipedia Attention refused with HTTP 429 and retry/Browser tab instructions; no partial source saved. Exact completion time unavailable; poll endpoint assumed success and was invalid.
- Day 1 | Read | Highlight double-click sequence 836 ms, including an intentional 500 ms harness pause; not a pure app delay.
- Day 1 | Read | Finish opens recall | 90 ms (action to observed state).
- Day 1 | Read | Quiz first observed ready by 53476 ms (upper bound); key-point wait shown.
- Day 1 | Read | Quiz 1 answer reveal 194 ms; this was not completed AI feedback.
- Day 1 | Read | Quiz 1 remaining AI wait after an earlier observation: 3858 ms; full request 9027 ms.
- Day 1 | Read | Quiz 2 Check press → pending state 44 ms; not AI completion. Checking indicator/source shown; saved result checked afterward.
- Day 1 | Read | Quiz 3 Check press → pending state 70 ms; not AI completion. Checking indicator/source shown; saved result checked afterward.
- Day 1 | Read | Quiz 4 Check press → pending state 66 ms; not AI completion. Checking indicator/source shown; saved result checked afterward.
- Day 1 | Read | Done closes finished article | 1336 ms (action to observed state).
- Day 1 | Add | Wikipedia retry outcome | 822 ms (action to observed state).

## Day 2 — first review, video and tutor
- Day 2 | Review | first source review opens | 52 ms (action to observed state).
- Day 2 | Review | Two early source-review attempts returned to reader while drafting; second clearly said This source’s exercises are still being drafted (F734 passes). Used video meanwhile.
- Day 2 | Read | Player cannot start in this harness; fallback says watch on YouTube. Read 00:00–04:08 transcript and marked contextual embeddings instead; no playback claim (same setup limit as prior run).
- Day 2 | Read/tutor | INVALID completion measurement 23822 ms: wrong Stop-control selector. Use full-reply bound and request duration below.
- Day 2 | Read/tutor | Full reply observed by 30792 ms; Reading your sources stayed visible.
- Day 2 | Review | Correct Explain feedback observed by 12448 ms; checking state shown.
- Day 2 | Review | Good press returned in 24 ms; next-screen usability not separately timed.
- Day 2 | Review | Fact answer recalled: weighted sum of value vectors, weights from query/key compatibility.
- Day 2 | Close | Escape press returned in 6 ms after rating settled; end screen then checked. One earlier Escape during the pending rating did not close; not reproduced twice, excluded as a finding.

## Day 3 — review, PDF, search and settings
- Day 3 | Review | Explain feedback observed by 11432 ms.
- Day 3 | Review | Wrong multi-head answer checked by 13916 ms.
- Day 3 | Read/search | remembered positional passage results | 325 ms (action to observed state).
- Day 3 | Read/search | Remembered-passage press returned in 26 ms; result screenshot checked afterward, not a full paint timing.
- Day 3 | Read | Compared original Harvard article: equations render there; Ore shows raw TeX. Original has 8 Vega charts, absent from imported reading flow (mask/position demonstrations). Reopened import to confirm; screenshots saved.

## Day 4 — phone
- Day 4 | Open | Empty independent seed. A Mac learner would expect the three sources, notes, ratings and goal here; no sync was provided, so this is a setup limitation.
- Day 4 | Add | Article URL failed with connection error; outcome observed by 7636 ms, including polling delay. Read status shown, then “Your Mac will try it” fallback. Switched to HTML file import through the visible picker.
- Day 4 | Read | phone article opens | 326 ms (action to observed state).
- Day 4 | Read/review | HTML-file import and note persisted across source/note reopening. Today has no Start review; phone has no exercises or AI, so short review could not be performed.

## Day 5 — goal and skill
- Day 5 | Review | Home Start press returned in 37 ms; Again exercise checked after settling, not a full paint timing.
- Day 5 | Review | Added 180000 ms with page.clock to exercise goal accounting; synthetic time, not measured thinking or a new calendar day.
- Day 5 | Review | Added a second synthetic 60000 ms while answering the positional-encoding exercise.
- Day 5 | Close | End screen: 7 of 5 minutes, 1 memory kept, +2 days, 1 new exercise tomorrow. Skill AI is Lv 0 with 0 cut gems, and suggests Try it. No mastery claim.
- Day 3/5 | Read | BERT Masked-LM explanation appears after the next-sentence task and a footnote, instead of between its introduction and mismatch caveat. Original PDF page 4 confirms order. Reproduced on repeated opens; detour time not isolated.

## Reconciled friction and request timings

The entries below reconcile the live observations with the request timer and saved files. Request durations use performance.now() at request/requestfinished, so background waits are labelled. They overlap other activity and must not be added to review time.

- Day 1 | Add | Video transcript import request 4576 ms; the already-open reader stayed visible. An attempted wait for automatic navigation was invalid as a product latency measurement.
- Day 1 | Add | Wikipedia refused twice, first request 1037 ms and retry UI outcome 822 ms. Both offered retry/Browser tab steps; no partial source saved.
- Day 1 | Read | Attention’s inline math and equation were raw TeX. Had to compare the original to read the formula; repeated on Day 3. The screen should have preserved readable math. Detour time not isolated.
- Day 1/3 | Read | Masking and positional chart outputs missing, although generating code remained. Original-site comparison confirmed the missing demonstrations; reopened in Day 5. Screen should have retained the figures or said content was incomplete. Detour time not isolated.
- Day 1 | Read/Finish | Key-point request 54921 ms under “Finding the key points…”; long but correctly labelled (F735). Recall feedback request 20893 ms ran in the background.
- Day 1 | Read/quiz | Four AI checks took 9027, 6561, 6118 and 7127 ms; checking state shown. All four checks persisted. Earlier 44–194 ms observations measured reveals/presses, not AI completion.
- Day 1→2 | Review | Exercise drafting request 81209 ms in background. Tried source review twice before ready; second explicitly said still drafting. Used transcript while waiting. Six exercises eventually available.
- Day 2 | Read/tutor | Request 23826 ms; full reply observed by 30792 ms. “Reading your sources” indicated progress, but approximately ten seconds was optimistic. Explained decoder shift correctly with citations.
- Day 2 | Review | Explain grading 12145 ms; checking visible, UI feedback observed by 12448 ms. Good recorded despite AI suggesting Easy.
- Day 3 | Review | Explain grades 10994 and 9043 ms; UI feedback observed by 11432 and 13916 ms. Wrong multi-head answer corrected, Again saved.
- Day 3 | Read | PDF formula and table spot checks worked, but Task #1’s masking explanation appeared after Task #2. Compared original PDF; rechecked on Day 5. Screen should preserve the argument order; detour not timed.
- Day 3 | Plan | Five-minute daily goal and “I open my work notebook” saved and survived Settings reopening; no friction observed.
- Day 4 | Add | HTML-file completion latency not isolated: a wait incorrectly expected auto-open, while the source had already landed on Today. Excluded that harness timeout from app waits.
- Day 4 | Review | No Start review after reading: no phone AI/exercises in this setup. Cannot judge a first phone review from this run.
- Day 5 | Review | Corrected multi-head and positional grades took 10247 and 12449 ms, with checking states. No separate UI-completion measurements.
- Day 5 | Close | Read saved reviews and minute-counting code as requested to audit the ring, not to discover a feature. Six ratings total 415812 ms after per-rating cap, displayed as 7/5 minutes. Four synthetic minutes were injected; not a claim of seven minutes of human study.
- Day 5 | Wrap up | Three S2 findings grouped from the repeated reading friction. No repeatable empty wait over one second established; no notes or ratings lost. Active replacement browser context closed and connection disconnected.
