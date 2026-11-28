# Asker — four-day learner report

Tested release WebKit on Mac, 1280 × 800 at 2×, against the assigned scratch library on ports 1767/1768. Dates advanced forward through November 27–30, 2026. The supplied copy contained **67 sources (23 active, 44 archived), 38 exercise files**. I asked ten library questions, opened every returned citation, missed three exercises and continued all three chats the next day, applied one clearer exercise, used the longest book with an @-mentioned second source and screenshot, reopened its saved chat after reimport, and compared one question in English, misspelled English, and Spanish. I read the previous three runs and known findings before testing. This run did not add new sources, test iPhone, exhaust the new-exercise quota, test a missed calendar day, or exercise scan/podcast fixes from #562. No product files were changed. All test artifacts are in this folder; library changes went through the app. One tester context was restarted before Day 2 ratings because of an automation selector error; there was never more than one owned context/page at a time. Owned browser connections are now closed.

## Findings

### 1. A clearer exercise keeps obsolete grading criteria — S2 · Mac

**Cost:** the improvement made on Day 2 penalized the learner on Day 3. Even reproducing the app's new model answer exactly was marked incomplete. This was the most disruptive moment: I had to reconcile two conflicting definitions of a correct answer before trusting Review again.

1. From a fresh page on the original seed, start Review and reach exercise `01M4J5754B2XBSV9Q3726M5GWV`, from **How to write good prompts**.
2. Answer and reveal it. Open **Ask about this**, ask about consistent knowledge versus identical wording, then send **Make this exercise clearer**.
3. Use the proposed exercise. In this run the new question was “Why should a spaced-repetition exercise ask you to recall the same idea on every review?” The new answer was “Each review strengthens the idea you actually bring to mind, so recalling a different fact gives you practice with that fact instead. You can explain the same idea in different words each time.”
4. Rate Again, leave, advance to the next day and reload. Reach the exercise again and answer in line with that explanation.
5. Observe the old criterion “Explains that related knowledge left unrecalled can be inhibited, making changing retrieval targets unreliable.” It is marked missed. Leave/reopen without rating and answer with the exact proposed model answer: the same criterion is missed again.

**Expected:** accepting a revised Explain exercise leaves its question, answer and grading criteria consistent. **Actual:** the question and answer change, while all three old criteria remain. The grader says the missing point is that recall can make related facts harder to retrieve, even when the learner reproduces the displayed Answer. The screen says “You were sure about this one. Worth a careful look.” The learner can still choose their own rating; no incorrect rating was automatically recorded. I left this exercise unrated on Day 3.

**Reproduction:** 2/2 Day 3 grades after one accepted proposal: first a faithful paraphrase, then the exact new answer after reload. The proposal itself is real AI output and may vary on a new run. Persistence was also verified through the source's **Review this source** action.

**Evidence:** [first wrong mark](day3-clearer-old-rubric.png), [exact-answer repeat](day3-clearer-old-rubric-repeat.png), [accepted proposal](day2-used-exercise.png), [source exercise after reload](day3-source-exercise-edited.png), [before](exercise-before.md), [after](exercise-after.md). The two relevant backend grade waits were 9.834 s and 8.962 s; the full repeat interaction included tester correction of a confidence toggle and is not treated as app latency.

**Suspected cause:** `packages/core/src/ai/chat.ts:11` limits a proposal to question and answer. `apps/desktop/src/Review.tsx:1093` calls `setText` with the rubric argument undefined. Reading those lines was necessary to explain why “Exercise updated” did not include the criteria. The screen should not present a rewritten model answer as sufficient while grading against a requirement it removed.

### 2. Source-based answers sometimes have no links to verify them — S2 · Mac

**Cost:** two of ten Day 1 questions produced plausible, source-specific explanations with no citation controls. I had to locate the source text separately to verify them after waiting a combined **89.805 s** for those answers.

1. From a fresh page, open the tutor on Home and start a new library chat.
2. Ask: “Use only my saved A closer look at Description, Effective prompting techniques, and The Description-Discernment loop together. How would I specify a product-video script, assess the draft, and revise my request? Show what each of the three sources adds.”
3. Read the response: it names all three lessons and gives one numbered section per lesson, but has no citation pills or Sources list.
4. Start another new library chat and ask: “In my saved Choosing the right model lesson, how should I use representative examples to choose a model instead of always picking the biggest? Use only that saved lesson.”
5. The reply begins “In your saved Choosing the right model lesson” and gives specific model-selection instructions, again without any citation link.

**Expected:** a source-based explanation offers clickable supporting passages, as seven other source-backed answers in this run did. **Actual:** there is no route from either answer to its evidence and no indication that links are missing. Both saved turns have an empty citations array and `general: false`. This is an evidence-access failure, not a claim that the explanations were factually wrong.

**Reproduction:** 2 independent new chats out of 10 Day 1 questions, on different subject matter. AI output is variable; identical-prompt repeat frequency was not measured.

**Evidence:** [three-lesson answer](day1-q2.png), [model-selection answer](day1-q7.png), saved chats `mwz67xof-5` and `mwz6bj4t-23` in [chat audit](chats-audit.json). Full questions/replies and quote checks are in [chats-audit.txt](chats-audit.txt).

**Suspected cause:** `packages/core/src/ai/prompts/tutor.md:20` asks for a citation after each source-based claim, but `packages/core/src/ai/tutor.ts:311` onward validates supplied citations and does not reject a source-based answer containing none. `apps/desktop/src/Tutor.tsx:1097` only renders Sources when citations exist. This is distinct from the known eight-source retrieval limit: the visible failure here is absence of evidence links, regardless of retrieval success.

## Known rows and regression checks

- **F807 (#582) held:** all three Review chats survived leaving, reload and the next day; each follow-up continued its earlier Moon/video-record/database-column example. See [retrieval chat](day3-restored-edited.png), [API Fact chat](day3-restored-api-fact.png), [API Explain chat](day3-restored-api-explain.png).
- **F808 (#582) held:** the archived MCP lesson `01M627T4CGDT6XW6PDPPG79TPF` was cited three times; all quotes match and open in the saved lesson. [Evidence](day1-q3-cite1.png).
- **F739 (#559) held:** ratings and FSRS due timestamps followed the page's November 28/29 dates. See the daily audit below. Release-build testing does not test the separate Vite cold-start fixes in #559.
- **F796 (#562) held:** an interrupted answer retained 30,659 ms in its draft and returned with its exact text. The later rating recorded 121,520 ms including that earlier segment. [Draft evidence](day2-interruption-draft.json).
- **F589 held:** the saved book chat, all three turns and its screenshot survived reimport; the old conceptual-slippage citation found the quote at its new location. The book's text hash changed. [Saved chat](day3-chat-after-reimport.png), [settled citation](day3-reimport-verified.png), [highlight text](reimport-citation-verified.json). An initial 450 ms probe ran before the book had finished opening; a settled repeat reached the correct words in 687.990 ms. It is not a regression.
- **Known retrieval limitation observed, not a new finding:** the three-source benchmark question used the saved AI Snake Oil chapter but linked to web copies of Scaling up and Mitchell's book. This is consistent with the open retrieval limitations F729/F390; this run did not establish the exact ranking cause. The archived MCP success does not prove that every multi-source question retrieves all named sources.
- No fixed row was confirmed to have returned. The known open visual issues were not re-reported.

## Citation audit

No demonstrably wrong citation was found. The **30 returned citations comprised 28 local citations and 2 external links**. All 28 local quotes occur in their stated source and support the adjacent claims in context. Every citation control was pressed. Two long-book probes were repeated with an explicit wait for the highlighted quote after the initial fixed 450 ms screenshot was too early; see [Day 1 book quote](day4-q8-citation-verified.png) and [mentioned-book quote](day4-mentioned-citation-verified.png). Full source IDs, questions and quotes are in [the audit](chats-audit.txt); click evidence is in [citations.jsonl](citations.jsonl).

Day 1's external Scaling up quote was checked against [Our World in Data](https://ourworldindata.org/scaling-up-ai). The external [Mitchell PDF](https://thuvien.utm.edu.vn/ktpm/ths/10.2..pdf) exceeded the web fetch tool's size limit. Its quote matches the saved book exactly, but the external file was not fully verified. The mock's external-link action records the requested URL, so opening those controls is not proof of a native browser tab loading. Neither external quote is labeled wrong.

Day 4 asked the same Values Guide question three ways in separate chats. Plain English and typo English used the identical definition and family-security quotes. Spanish used separate terminal/instrumental definition passages and the same family-security quote. All seven citations point to `01M80RPYXPRXM11CNAWXA7K7JS`; all answers agree about goals versus means. [English](day4-plain.png), [typos](day4-typo.png), [Spanish](day4-spanish.png).

## Daily file audit

| Day | Recorded ratings | Credited review time | Next-day evidence |
| --- | --- | --- | --- |
| 1 · Nov 27 | None | 0 ms | Asking/reading created chats, not ratings. |
| 2 · Nov 28 | Three Again ratings, one first-seen exercise | 170,210 ms | All three due Nov 29 at 08:02:08, 08:02:30 and 08:02:57 local; not due yet at exactly 08:00. The end screen showed **3 min**, matching rounded review time. |
| 3 · Nov 29 | Two Good ratings; edited exercise inspected twice but not rated | 62,465 ms | API Fact moved to Dec 3 08:07:17 local; API Explain to Dec 2 08:07:46. The unrated edited exercise retained its Nov 29 due date. |
| 4 · Nov 30 | None | 0 ms | Home showed **0 of 10 min**. The two API exercises remained future-due; the unrated exercise remained due. |

On Day 2 `today.new_today` was 1; on Days 3/4 it reset to 0. These match the saved review histories. Day 3 opened at zero credited minutes, then `today.active_ms` reached 62,465 after the two ratings. Day 3's end record reports two reviews, two kept and one rescued; I did not capture its settled animated minute numeral and do not claim a screenshot verification of it. Day 2's end record reports three reviews, zero kept/rescued. There are no duplicate ratings from chat reopening or source reimport. Evidence: [Day 2 end](day2-end.png), [final Home](day4-final-home.png), [final files](final-files.json), [request timings and today responses](requests.jsonl). The 20 s deliberately advanced during the Day 2 interruption is included in credited time. No calendar time moved backward.

## Where the minutes went

These columns are **not additive**: AI waits inside Review overlap credited review time, and the attachment is part of the reading journey. I did not independently time prose reading or diagnostic/code-inspection time; unknown time is marked rather than estimated.

| Day | Review credited | Reading / asking | Adding | Waiting for complete AI replies | Lost / recovery |
| --- | --- | --- | --- | --- | --- |
| 1 | 0.000 min | 10 questions; 18 citation presses; reading duration not separately metered | 0 sources | 5.084 min | Two answers required manual evidence lookup; duration not metered. |
| 2 | 2.837 min | Three missed exercises, four chat turns, one accepted rewrite | 0 sources | 0.733 min, plus a captured 9.357 s grade; first grade lacks a clean action timer | Interrupted answer resumed without lost credit. |
| 3 | 1.041 min | Long-book passage; @ source; screenshot; three book turns and three resumed review turns | 0 sources; attachment backend 0.114 s; reimport 1.064 s | 1.371 min; three captured grade calls totaled 29.930 s, partly overlapping chat waits | Extra grade to confirm obsolete criteria cost at least 8.962 s backend time; diagnosis not metered. |
| 4 | 0.000 min | Three equivalent questions; seven citation presses; final settled citation checks | 0 sources | 0.703 min | No new learner recovery; tester-only verification excluded. |

Across 23 completed tutor/Review-Ask turns, full-answer waits totaled 7.891 min. Day 1 alone spent 5.084 min waiting across ten questions. Every validly measured send showed its Stop/busy control within 14.4–57.6 ms. The supplied bridge buffers answers, so these are completion waits, not native first-token timings; no streaming regression is claimed. Citations and ordinary transitions were much faster. The friction was accumulated waiting and having to verify or reconcile answers, not unacknowledged clicks.

## What passed

- Missing personal shoot settings were explicitly declined without invented numbers.
- The wrong photography title was corrected to the right saved Sean Tucker video.
- Archived MCP evidence was available and clickable.
- All three Review chats persisted and continued the next day.
- The clearer question/answer persisted through reload and appeared in its source's exercises; grading consistency failed as described above.
- @-mention selected and saved AI Snake Oil as the second source; the answer cited both it and the open book.
- The screenshot was saved with the chat, displayed after reload, and correctly read as “the concept letter slips to group of letters.”
- Reimport of the longest source completed with feedback; saved chat/attachment and relocated citation survived.
- English, typo English and Spanish answers agreed, with supporting local quotes.
- Ratings, due dates, first-seen count and daily minutes followed the moved page dates; AI did not set recorded ratings.

## Felt slow

Every action/completion measurement from the log is listed below, slowest first. Citation rows labeled “settle” include an intentional **450 ms** delay; the find row includes **500 ms**. These are upper bounds including observation delay, not pure app latency. Backend-only grades/attachment and Day 1 Q1 are labeled. A 45.836 s diagnostic interaction is excluded as app latency because it included a tester confidence-selection correction. Selector timeouts, screenshot saves and manual inspection time are excluded.

| Day | Seconds | Action / measurement |
| --- | ---: | --- |
| 1 | 90.230 | day1-q1 full backend reply; initial action timer invalid due to selector error; bridge performance.now measurement |
| 1 | 48.148 | day1-q7 In my saved Choosing the right model lesson, how should I use representative examples to choose a model instead of always picking the biggest? Use only that saved lesson.; acknowledged 15.9 ms |
| 1 | 41.657 | day1-q2 Use only my saved A closer look at Description, Effective prompting techniques, and The Description-Discernment loop together. How would I specify a product-video script, assess the draft, and revise my request? Show what each of the three sources adds.; acknowledged 16.2 ms |
| 3 | 24.289 | day3-mention-answer @AI Snake Oil: What Artificial Intelligence Can Do, What It Can't, and How to Tell the Difference - Chapter 1  Compare this book passage with the cited source: why should I not equate success on a narrow task with understanding? Cite each source separately.; acknowledged 29.7 ms |
| 1 | 23.978 | day1-q8 In Melanie Mitchell’s AI book, why can an adversarial image fool a classifier without looking meaningfully different to us? Explain from the book and cite it.; acknowledged 21.1 ms |
| 1 | 23.972 | day1-q3 In my archived MCP lesson, why does MCP reduce integration maintenance, and what remains my responsibility when selecting tools? Use the saved lesson, with quotes.; acknowledged 14.4 ms |
| 3 | 18.205 | day3-deep Here in Active Symbols and Analogy Making, why does abc to abd map ppqqrrss to ppqqrrtt rather than ppqqrrst? I do not understand conceptual slippage. Explain using this passage, not general advice.; acknowledged 31.9 ms |
| 1 | 17.413 | day1-q10 In Values Guide, how does frustration help identify a value, and why do I still need to rank values that conflict? Cite the guide and distinguish its advice from your example.; acknowledged 15.7 ms |
| 1 | 16.438 | day1-q9 According to my saved How to Photograph Big Products video, why turn off the flash trigger for a test shot, and what should that shot look like? Cite the transcript.; acknowledged 15.0 ms |
| 1 | 16.408 | day1-q5 I remember a saved video called Photographing Giant Furniture, part 1, by Sean Tucker. Is that the right title? Why does he use white walls if he plans to cut the product out later? Find and cite the saved source.; acknowledged 16.0 ms |
| 3 | 16.208 | day3-image In this screenshot, what does the paragraph immediately above Problem 3 say is slipping? Quote the short phrase from the image and explain why changing only the last character is too literal.; acknowledged 57.6 ms |
| 4 | 15.418 | day4-spanish En Values Guide, ¿cuál es la diferencia entre un valor terminal y un valor instrumental? Da el ejemplo de la seguridad familiar y cita la guía.; acknowledged 15.8 ms |
| 1 | 15.404 | day1-q6 In Values Guide, what is the difference between a terminal value and an instrumental value? Give one example from the guide and cite the passage.; acknowledged 16.0 ms |
| 2 | 13.897 | day2-clearer Make this exercise clearer; acknowledged 17.8 ms |
| 4 | 13.897 | day4-plain In Values Guide, what is the difference between a terminal value and an instrumental value? Give the family-security example and cite the guide.; acknowledged 18.6 ms |
| 4 | 12.889 | day4-typo In Values Guide, what is the differnce between a termnal value and an instrumntal value? Give the family-securty example and cite the guide.; acknowledged 16.0 ms |
| 1 | 11.383 | day1-q4 According to my saved library only, what exact shutter speed and aperture did I use for my own latest sponsored chair shoot? If the library does not say, say that. Do not search the web or guess.; acknowledged 19.2 ms |
| 3 | 11.135 | Backend grade only: 01M64QC521VBJKTT5BVY7WSAJJ |
| 2 | 10.875 | day2-ask1 I confused identical wording with consistent knowledge. Give me a safe rewording example and explain why recalling a different fact is different.; acknowledged 30.2 ms |
| 2 | 10.354 | day2-ask2 I pictured the client connecting straight to the database. Can you explain why the interface is an endpoint, using a request to fetch one video record?; acknowledged 15.1 ms |
| 3 | 9.834 | Backend grade only: 01M4J5754B2XBSV9Q3726M5GWV |
| 2 | 9.357 | Backend grade only: 01M64QC521VBJKTT5BVY7WSAJJ |
| 3 | 8.962 | Backend grade only: 01M4J5754B2XBSV9Q3726M5GWV |
| 3 | 8.855 | day3-continue-edited Yesterday we distinguished wording from the idea. Is “the Moon goes around Earth” a safe rewording of “the Moon orbits Earth”, and why?; acknowledged 21.2 ms |
| 2 | 8.850 | day2-ask3 I got this backward. How do shared endpoints let the web app and mobile app survive a database change? Give a small before-and-after example.; acknowledged 15.3 ms |
| 3 | 7.847 | day3-continue-api-explain Continue your name-to-display_name example from yesterday. What single thing must remain stable for both clients?; acknowledged 16.5 ms |
| 3 | 6.842 | day3-continue-api-fact Yesterday you used GET /api/videos/42. Is the JSON response also part of the interface contract, and why?; acknowledged 20.2 ms |
| 3 | 1.064 | Reimported longest book from its kept original |
| 4 | 0.701 | Repeated Day 1 book citation 1 with settled highlight; correct adversarial-image quote |
| 1 | 0.689 | day1-q8 citation 2 opened; includes 450 ms settle |
| 3 | 0.688 | Saved book citation after reimport reaches correct quote from Home; prior 450 ms probe was too early |
| 3 | 0.550 | Find conceptual slippage deep in longest book; includes 500 ms settle |
| 1 | 0.534 | day1-q8 citation 1 opened; includes 450 ms settle |
| 4 | 0.511 | day4-typo citation 1 opened; includes 450 ms settle |
| 3 | 0.510 | day3-mention-answer citation 1 opened; includes 450 ms settle |
| 1 | 0.504 | day1-q3 citation 2 opened; includes 450 ms settle |
| 1 | 0.504 | day1-q9 citation 3 opened; includes 450 ms settle |
| 1 | 0.504 | day1-q9 citation 2 opened; includes 450 ms settle |
| 3 | 0.503 | day3-deep citation 1 opened; includes 450 ms settle |
| 3 | 0.503 | day3-mention-answer citation 2 opened; includes 450 ms settle |
| 1 | 0.500 | day1-q5 citation 3 opened; includes 450 ms settle |
| 4 | 0.499 | day4-spanish citation 3 opened; includes 450 ms settle |
| 1 | 0.499 | day1-q5 citation 1 opened; includes 450 ms settle |
| 3 | 0.497 | day3-deep citation 2 opened; includes 450 ms settle |
| 4 | 0.496 | day4-plain citation 1 opened; includes 450 ms settle |
| 1 | 0.496 | day1-q6 citation 1 opened; includes 450 ms settle |
| 1 | 0.495 | day1-q3 citation 1 opened; includes 450 ms settle |
| 1 | 0.495 | day1-q10 citation 1 opened; includes 450 ms settle |
| 1 | 0.495 | day1-q9 citation 1 opened; includes 450 ms settle |
| 1 | 0.494 | day1-q1 citation 1 opened; includes 450 ms settle |
| 1 | 0.491 | day1-q3 citation 3 opened; includes 450 ms settle |
| 1 | 0.491 | day1-q10 citation 2 opened; includes 450 ms settle |
| 1 | 0.491 | day1-q5 citation 2 opened; includes 450 ms settle |
| 1 | 0.489 | day1-q6 citation 2 opened; includes 450 ms settle |
| 4 | 0.489 | day4-spanish citation 1 opened; includes 450 ms settle |
| 4 | 0.478 | day4-spanish citation 2 opened; includes 450 ms settle |
| 4 | 0.478 | day4-typo citation 2 opened; includes 450 ms settle |
| 4 | 0.477 | day4-plain citation 2 opened; includes 450 ms settle |
| 3 | 0.474 | day3-deep citation 3 opened; includes 450 ms settle |
| 1 | 0.474 | day1-q1 citation 2 opened; includes 450 ms settle |
| 1 | 0.466 | day1-q1 citation 3 opened; includes 450 ms settle |
| 2 | 0.209 | Used suggested clearer exercise |
| 2 | 0.182 | day2-rate3 chose Again; next question |
| 3 | 0.177 | day3-rate-api-fact chose Good; next question |
| 3 | 0.162 | day3-rate-api-explain chose Good; next question |
| 1 | 0.160 | day1-q1 citation 1 opened |
| 2 | 0.153 | day2-rate1 chose Again; next question |
| 2 | 0.148 | day2-rate2 chose Again; next question |
| 3 | 0.114 | Backend attachment save only: day3-deep-passage.png |
| 2 | 0.065 | Wrong retrieval answer revealed |
| 4 | 0.039 | Repeated mentioned-book citation 2; correct tail-event quote |
