# Newcomer — five-session learner report

I learned transformer basics for work, starting with an empty source library. Across five ordered sessions I attempted four real imports, read and annotated Harvard’s article, completed its recall and four-question quiz, rated six exercises, used the tutor, read BERT’s tables and formulas, searched a remembered passage, changed the review goal and plan, and read and saved a note on the phone. Three imports succeeded; Wikipedia refused both attempts. Three repeatable S2 import defects made the material harder to learn. No saved notes or ratings were lost. This was one real day, not a retention study: source-specific review supplied the early sessions, and four minutes were deliberately advanced for the final goal check. Video playback and a phone review could not be completed in this setup. Pure appearance, unrelated known issues, destructive actions, and injected write failures were not tested.

## Findings, in learner-cost order

### 1. Teaching charts silently disappear from the long article — S2, Mac

The article keeps the Python that creates its demonstrations but loses their visual output. For a newcomer, code alone does not explain the masking pattern or positional waves. The missing content is not identified as missing. This repeatedly interrupted reading on sessions 1 and 3, with a final recheck in session 5.

1. Open a fresh Mac page with bridge 1768 and the supplied Tauri init script.
2. Add [The Annotated Transformer](https://nlp.seas.harvard.edu/annotated-transformer/) through Add source. In the already-used library, open it from All sources → Done instead.
3. Read the end of the Decoder section, just before Attention. The `show_example(example_mask)` code is immediately followed by the Attention heading.
4. Compare the same location on the original site: a triangular masking chart belongs between them. Check the positional encoding demonstration as a second location.
5. Close the reader and reopen the saved source. The charts are still absent.

**Expected:** retain the teaching charts, for example as static figures, or explicitly identify the incomplete import and provide the next step. D122/D96 promise the source whole.

**Actual:** the import succeeds and can be finished and quizzed with no missing-content warning. The live original contains eight Vega chart embeds. Imported Markdown retains five ordinary images and the chart-generating code, but no equivalent chart output. The masking chart was visually compared twice; the positional demonstration was also inspected. This is missing learning content, not a request for interactive charts.

**Reproduction:** 2/2 separate opens of the same saved import, plus later confirmation; one network import, not two independent imports.

**Evidence:** [first reading](d1-article-attention.png), [reopened reading](d5-article-chart-missing-repeat.png), [original masking chart](original-article-chart.png), [saved-source audit](day5-final.json). Source ID `01M8CMQ1Q6MS5WZK8D5QB7WYNX`.

**Suspected location:** `packages/core/src/ingest/web.ts:399–405`, static HTML preprocessing and Defuddle conversion. The runtime-created chart output is not recovered. This is an investigation lead, not a proven patch location.

### 2. The article’s equations become raw TeX — S2, Mac

The text asks the learner to understand attention scaling, but the denominator and matrix equation display programming-like markup. I had to consult the original to read the equation normally.

1. From a fresh Mac page, add or reopen the Harvard article above.
2. Go to Attention and read the key-dimension description and the equation below the attention diagram.
3. Observe literal `d_k`, `\sqrt{d_k}`, and the raw display-equation command text.
4. Open the original website at the same section. Subscripts, fractions and roots render there.
5. Reopen Ore’s source and repeat the check.

**Expected:** readable inline and display math, preserving the meaning of the original.

**Actual:** mathematical delimiters/structure are lost during import, leaving raw TeX in ordinary prose. The article is accepted as complete. This affects the article itself; it is not the known PDF inline-math issue or the previous AI-feedback formatting issue.

**Reproduction:** 2/2 opens, sessions 1 and 3; visible again during the session-5 chart check. One saved import.

**Evidence:** [inline math](d1-article-attention.png), [repeated display-math check](d3-article-math-repeat.png), [rendered original equation](original-article-math.png). Same source ID as finding 1.

**Suspected location:** `packages/core/src/ingest/web.ts:399–405`, especially math normalization before/after Defuddle. This source uses math-marked HTML spans; existing normalization did not preserve their renderable structure.

### 3. BERT’s explanation of masked prediction appears under the next task — S2, Mac

The paragraph that explains how masked language modeling works lands after the next-sentence-prediction task and a broken footnote. The caveat appears before the procedure it qualifies. A newcomer can mistake which explanation belongs to which training task.

1. From a fresh Mac page, add [the BERT PDF](https://arxiv.org/pdf/1810.04805), or open its saved source.
2. Allow the visible page-reading improvement to finish.
3. Read section 3.1, Task #1: Masked LM, through Task #2: Next Sentence Prediction.
4. Observe the order: Task #1 introduction → mismatch caveat → Task #2 → dangling footnote → paragraph explaining random masking and prediction.
5. Compare original PDF page 4: the masking explanation is at the top of the right column, following the Task #1 introduction at the bottom of the left column. It precedes the caveat and Task #2.
6. Reopen the saved source and repeat.

**Expected:** the original paragraph order, with footnotes outside the main explanation.

**Actual:** the saved `doc.md` puts the explanatory paragraph at line 136, after Task #2 at line 132 and a footnote at line 134. Its words survive, but their placement misleads. This differs from F733’s duplicated/reversed outline headings.

**Reproduction:** 2/2 opens, sessions 3 and 5; one PDF import. Confirmed against the retained original PDF, not inferred from prose alone.

**Evidence:** [displaced paragraph in the reader](d5-pdf-displaced-paragraph.png), [original PDF page 4](original-bert-page4.png), [saved-source audit](day5-final.json). Source ID `01M8CMT7XETXP972CEPY0ET9S7`.

**Suspected location:** `packages/core/src/ingest/pdf.ts:569–576`, the check that decides whether to trust detected region order or keep PDF drawing order. Footnote handling may also contribute. Root cause not isolated.

## Session record and saved-file checks

All library mutations went through the app. Audits read the library only. The audit includes a `.ore/reimport` backup; count only paths beginning `items/` when counting current sources.

| Session | What happened | What the saved data confirmed |
| --- | --- | --- |
| 1 | Attempted Harvard article, 3Blue1Brown video, BERT PDF and Wikipedia. Read attention, masking, position and training material; skimmed implementation code. Created two annotated highlights, a Key point and a source note. Finished, recalled and answered four quiz questions. | Three current sources. Article marked done, recall and all four quiz checks saved. Two article annotations and notes persisted on reopening. Six exercises subsequently drafted: four from reading questions, one from the attention highlight, one from notes. |
| 2 | First source-specific review: correct Explain answer about scaling, then Fact about weighted values. Chose Good, including when AI suggested Easy. Read video transcript 00:00–04:08, marked contextual embedding, and asked the tutor about shifting decoder input. | Two ratings, 48,126 ms total recorded review time; both Good. Transcript annotation/note saved. Tutor’s reply explained the target-token leak and cited the article. No plainly incorrect answer observed. |
| 3 | Correct Explain about distant tokens, deliberately wrong multi-head explanation, then Again. Read BERT pretraining, tables and formulas. Searched positional material. Set five minutes/day and plan “I open my work notebook”; reopened Settings. | Two ratings, 56,373 ms; Good and Again. Corrective feedback rejected the mistaken claim that heads merely repeat identical weights. `skills.yaml` retained both settings. |
| 4, phone | Started from separate empty seed. URL import failed and offered the Mac queue. Used the visible file picker to import the retained article HTML; read Attention, wrote a note, reopened it, returned to Today. | IndexedDB export contains article, original HTML, saved note and queued URL. No exercises or review records. The phone seed directory is not its writable store. |
| 5 | Normal Home Start brought back the failed multi-head exercise as Again. Answered correctly, chose Good. Then source-specific review of positional encoding, Good. Read end screen, Home and AI skill. | Six total ratings of five unique exercises; six exercise files, one unreviewed exercise. Session receipts match 2 kept/+5 days, 1 kept/+2 days, 1 kept, and 1 kept/+2 days. AI vendor/model/prompt version recorded where AI was used. |

Audits: [session 1](day1-final.json), [session 2](day2-final.json), [session 3](day3-final.json), [phone IndexedDB](day4-indexeddb.json), [session 5](day5-final.json).

### Import completeness and availability

| Material | Time and result | Content checked |
| --- | --- | --- |
| Harvard article | 989 ms add request; readable at 1,340 ms | Correct title, prose through closing credits, sections, code and five ordinary images. Authors remain in body, but author/date metadata absent. Math and runtime charts fail as above. |
| [3Blue1Brown video](https://www.youtube.com/watch?v=eMlx5fFNoYc) | 4,576 ms add request; exact reader-ready time not isolated | Title, author, publication date, timestamped sections/transcript extending beyond 25 minutes and description present. Read early transcript; did not independently verify every caption. Player failed explicitly in this harness and offered YouTube. |
| BERT PDF | 2,396 ms add request; first observed readable by 5,027 ms | Original PDF retained; title, sections, appendix ending, four images, eight rendered tables and three display-math blocks present. Author/date absent from frontmatter; authors visible in text. Table 1 could scroll horizontally. Inline math limitations remain known; reading order fails above. |
| [Wikipedia attention page](https://en.wikipedia.org/wiki/Attention_(machine_learning)) | First refusal request 1,037 ms; retry outcome 822 ms | HTTP 429 both times, with retry/Browser tab next steps. No half-source saved. This fourth requested import did not succeed. |

The seed already supplied an AI skill and imports were assigned to it, so no redundant subject skill was created. At the end it showed level 0 and zero cut gems, with a prompt to demonstrate an ability through Try it. It did not claim mastery after these few reviews. Home offered ongoing reading and one new exercise tomorrow. [Skill](d5-skill.png), [Home](d5-home.png), [final end screen](d5-final-end.png).

### End-screen accounting

`packages/core/src/study.ts:133–136` caps each rating’s contribution at three minutes. The six raw elapsed values were 24,996, 23,130, 22,804, 33,569, 240,225 and 131,313 ms. Their capped sum is **415,812 ms = 6.9302 minutes**, correctly displayed as **7 of 5 minutes**. The last session’s one kept memory and rounded +2 days agree with its saved receipt and stability change. The extra ring lap is expected.

Four minutes were injected with `page.clock` while answering. The capped total is an accounting check, not seven minutes of independently measured human study. All reviews have the real date November 26. Due dates and tomorrow’s count were not judged as if five calendar days had passed. After the final ratings, the five reviewed exercises had saved due dates on November 28; the sixth had no rating. Same-day relearning of the Again answer worked.

## Where the minutes went

Continuous wall-time recording was not implemented for reading, settings or diagnostic detours. Those minutes are **not measured**, not zero. AI request times overlap thinking, other activity and recorded review time; do not add columns into a daily total.

| Session | Review, saved/capped | Reading | Adding | Waiting, measured request durations | Lost / diverted |
| --- | --- | --- | --- | --- | --- |
| 1 | 0 min of scheduled review; Finish quiz separate | Article, highlights, notes, recall and four answers; duration not measured | Three successful adds: 7.961 s combined request time; Wikipedia first refusal 1.037 s and retry 0.822 s UI outcome | Key points 54.921 s; four quiz checks 28.833 s combined; recall feedback 20.893 s in background. Exercise drafting 81.209 s crossed into session 2 | Raw math and absent charts required original-site comparison; detour not timed. Two refused Wikipedia attempts |
| 2 | 0.802 min | Early video transcript and tutor reply; duration not measured | None | Explain grading 12.145 s; tutor 23.826 s, full reply observed by 30.792 s | Two early review attempts while drafts unfinished; clear status on second. Video playback unavailable in harness |
| 3 | 0.940 min | PDF sections, formula/table spot checks, remembered-passage search; duration not measured | None | Two Explain grades 20.037 s combined; search results 0.325 s | PDF order needed original-page comparison; detour not timed |
| 4 | 0 | Short phone article read and note; duration not measured | URL failure observed by 7.636 s; HTML import completion not isolated | No AI | Switched from failed URL to file import. No phone exercises, hence no short review |
| 5 | 5.189 min, including synthetic advancement subject to cap | Skill/Home/end-screen inspection; duration not measured | None | Two Explain grades 22.696 s combined | No additional learner interruption; evidence rechecks excluded from study time |

## Felt slow

Measured with `performance.now()`. Request durations in [bridge.jsonl](bridge.jsonl) run from browser request to response completion; they are not all blocking UI waits. UI bounds include observation delays. The table lists every measured operation over one second, slowest first; overlapping UI bounds appear alongside their request rather than being counted twice. Progress/checking text was observed for the major AI waits. No repeatable blank wait over one second was established.

| Duration | Session and action | What the learner saw / timing limit |
| --- | --- | --- |
| 81.209 s | 1→2, draft exercises after Finish | Background work; source review explicitly said still drafting. F734 fix worked |
| 54.921 s | 1, find key points | “Finding the key points…”; Continue→quiz observed by 53.476 s because request began earlier |
| 23.826 s | 2, tutor reply | “Reading your sources”; full reply observed by 30.792 s. Its approximately-ten-seconds expectation was optimistic |
| 20.893 s | 1, recall feedback | Background feedback, overlapped subsequent work |
| 12.449 s | 5, positional Explain grade | Checking state; no separate precise UI-completion measurement |
| 12.145 s | 2, scaling Explain grade | Checking; usable feedback observed by 12.448 s |
| 10.994 s | 3, distant-token Explain grade | Checking; feedback observed by 11.432 s |
| 10.247 s | 5, corrected multi-head grade | Checking |
| 9.043 s | 3, wrong multi-head grade | Feedback observed by 13.916 s; polling adds uncertainty |
| 9.027 s | 1, quiz check 1 | Checking/source answer; an additional 3.858 s was measured after an earlier observation, not a second check |
| ≤7.636 s | 4, phone URL failure | Import/read status then Mac-queue fallback; includes observation delay |
| 7.127 s | 1, quiz check 4 | Checking; result persisted |
| 6.561 s | 1, quiz check 2 | Checking; result persisted |
| 6.118 s | 1, quiz check 3 | Checking; result persisted |
| 4.576 s | 1, video import | Add request; reader-ready endpoint was not measured correctly |
| 2.396 s | 1, PDF initial import | Adding / reading pages shown; first reader observation ≤5.027 s |
| 1.340 s | 1, article becomes readable | Includes 0.989 s add request |
| 1.336 s | 1, Done exits Finish quiz | Returned to finished article |
| 1.037 s | 1, Wikipedia refusal | Actionable HTTP 429 error |

Other recorded actions, descending: highlight double-click 836 ms **includes an intentional 500 ms harness pause**; Wikipedia retry 822 ms; phone reader open 326 ms; search results 325 ms; quiz first answer reveal 194 ms; Finish opens recall 90 ms; quiz Check presses 70/66/44 ms to pending state; source-review press 52 ms; Home Start press 37 ms; Add dialog 36 ms; search-result press 26 ms; Good press 24 ms; Escape return 6 ms. Press-return measurements do not establish the next screen’s usability or time to first feedback. The startup 164 ms measure only waited for `body`; it is excluded as a Home-ready result. An initial tutor measurement used the wrong stop-control selector and is excluded.

## Known rows and constraints

- **No confirmed recurrence of a fixed row.** F734’s drafting message and F735’s key-point wait label both appeared correctly. F733’s duplicate outline-heading pattern was not observed in BERT; finding 3 concerns paragraph order.
- Known PDF inline math and table-format limits overlap F148/F150/F151/F153; they are not new findings here. The known below-fold review controls were not promoted into a new finding.
- F739 applies: five sessions occurred within one real day. Early reviews used Review this source. No daily scheduling regression is claimed.
- Phone starts from its own empty seed, not the Mac library. A learner would expect the Mac sources/progress, but missing sync is a setup limitation. Its URL import queued for a Mac; HTML-file fallback was tested. Without AI/exercises it could not provide the requested short review. Phone native keyboard and touch text selection were not validated.
- The player visibly failed and supplied a YouTube fallback; actual video playback was not verified. Wikipedia was refused twice. Neither limitation is disguised as successful coverage.
- Feature discovery used the UI. Code inspection was used afterward for import diagnosis and the specifically requested minute-accounting check, not to locate a hidden learning feature.
- No test suite, server, watcher or extra browser was launched. A first runner lost interactive stdin and left a connection/page that this sandbox could not terminate; the replacement used one controlled context, closed between Mac and phone journeys, and at most two controlled pages. Thus a strict one-total-context claim cannot be made. The active replacement context was closed and its connection disconnected at the end. Shared servers and other testers were left alone.
- Only this tester’s output folder was written directly. Other working-tree edits were observed and left untouched. No findings registry edits, fixes, commits or pushes were made.

## What passed

- Empty Home led to adding sources without reading implementation code to find the action.
- Import errors offered next steps; Wikipedia did not become a partial saved source.
- Article prose through the end, ordinary images and code survived; originals remained available.
- Highlights, Key point and two annotation notes survived reopening; the source note also persisted.
- Finish retained the recall, all four quiz checks and the article’s done status.
- Draft exercises reflected reading questions, a highlighted definition and notes; all sampled questions were answerable from the material.
- Correct Explain answers received useful feedback; the deliberately wrong answer was rejected with a meaningful correction.
- Choosing Good over AI’s Easy persisted the learner’s actual rating.
- The failed multi-head exercise returned as Again, and the corrected answer was saved.
- Transcript timestamps, highlighting and a saved transcript note worked despite unavailable playback.
- Tutor explained the missing decoder-shift detail with a concrete sequence and source citations.
- Search found and opened the remembered positional passage.
- Five-minute goal and review plan survived Settings reopening and matched `skills.yaml`.
- Phone file import, short reading and note reopening worked within its single journey; IndexedDB retained the note.
- Final minutes, kept counts and depth increments agreed with saved review/session records; skill did not overstate mastery.
