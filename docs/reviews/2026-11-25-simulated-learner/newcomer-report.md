# Newcomer: learning how transformers work

Tested release commit `63c9b83b14cd9cbdcee3f5acd80b699f601d0d54` in connected WebKit at 1280×800 (Mac) and 390×844 with touch (phone), screenshots at 2×. Played five ordered sessions: imported four real sources into an empty Mac library, read and annotated the article, finished its quiz, used real AI feedback and a tutor, reviewed new exercises, read the PDF and Wikipedia, searched a remembered passage, set a goal and plan, and tried the empty phone copy. Two repeatable S2 findings follow. No repository or library files were edited directly. Scheduling across real days, video playback, and phone review could not be completed with this setup; details below. The [friction log](log.md) and saved audits distinguish observed behavior from setup limits. This is a first-week simulation, not evidence of five days of retained knowledge.

## Findings

### 1. S2 — Finishing a source hides minutes of exercise drafting (Mac)

A newcomer finishes the quiz, returns Home, and cannot tell whether the exercises exist yet. The article's drafting request took **168.410 seconds**; the PDF's took **53.318 seconds**. Home and the source offered no visible drafting status. During the article wait I tried source review twice, got no exercise, and spent at least **82 seconds** looking for an explanation before reading the code. “New exercises tomorrow” communicates availability but does not distinguish still drafting from ready.

Reproduce from a fresh Mac page on an empty scratch library:

1. Add `https://jalammar.github.io/illustrated-transformer/`, read it, and mark a Key point.
2. Finish the source, answer its recall/quiz, and choose Done on its closing screen.
3. While real AI is still drafting, inspect Home, reopen the source, and use Source actions → Review this source.
4. Repeat the finish flow on `https://arxiv.org/pdf/1706.03762` and inspect Home while drafting runs.

**Expected:** a visible, persistent drafting state, followed by a ready state, so I can leave confidently or know why reviewing cannot start. **Actual:** the background request continued without such a state; I had to inspect implementation to understand what the app was doing. Exercises did eventually save: seven from the article and four from the PDF. No exercise loss observed.

**Reproduction:** 2/2 natural finishes, two different sources. Two early article review attempts also found nothing. Screenshots: [article wait](d2-no-review.png), [PDF wait](d3-pdf-drafting-invisible.png). Request durations: [bridge timings](bridge-timings.jsonl). Suspected code: `apps/desktop/src/Finish.tsx:198–218`; initial `run()` is started without pending or success feedback. This is the initial path, **not a claimed recurrence of F196**, which covers retry after drafting fails.

### 2. S2 — Imported PDF inserts reversed, duplicate section headings (Mac)

The canonical Markdown for *Attention Is All You Need* inserts “Model Architecture,” “Background,” then “Introduction” together before the real “1 Introduction.” A learner following the paper's structure encounters the wrong order and duplicate headings. Elsewhere “Why Self-Attention” is inserted before “3.5 Positional Encoding.” The import reports no structural problem.

Reproduce from a fresh page:

1. Add `https://arxiv.org/pdf/1706.03762` and open the saved PDF source.
2. Read past the abstract into the second page's content.
3. Observe the three reversed headings above “1 Introduction.” Continue to the positional-encoding section and observe the misplaced next-section heading.
4. Leave the reader, reopen the same source, and return to these passages.

**Expected:** the paper's numbered sections appear once, at their actual positions and in order. **Actual:** synthetic headings precede the real headings and some are reversed. Verified against the [original PDF](https://arxiv.org/pdf/1706.03762), whose second page proceeds through sections 1, 2, and 3 in order.

**Reproduction:** 2/2 reader opens of the same saved import, corroborated in `items/2026/attention-is-all-you-need-01M89JV8EPH5CJH36Y4J2TFGNR/doc.md` in the scratch library. This was not two independent imports. Screenshots: [first open](d3-pdf-heading-order.png), [reopened](d3-pdf-heading-order-repeat.png). Suspected code: `packages/core/src/ingest/pdf.ts:680–689`; outline-title matching does not remove the section number from the extracted heading, and successive unmatched entries are inserted at index zero of the same page, reversing them. I did not test downstream chapter-recall corruption.

## Known rows and unconfirmed friction

- No fixed row was confidently observed recurring. F196 is related to finding 1 but its retry path was not tested.
- PDF table notation still contains raw single-dollar LaTeX and damaged powers/parentheses. These overlap the already open PDF limitations F148/F150/F151/F153 and are not counted as new findings. Evidence: [table](d3-pdf-table.png), [display formula](d3-pdf-formula.png).
- “Just mark done” on the PDF showed only “Saving…” for at least **50.4 seconds**, while a key-points AI call lasted **60.056 seconds**. Closing/reopening retained my text; a second key-points request lasted **42.905 seconds**. The ambiguous Saving state was not reproduced in two independent flows, so it remains a log item, not a third confirmed finding. [Screenshot](d3-pdf-just-mark-done-wait.png).
- The long article includes an embedded promotional video's transcript before its main prose. I had to get past that material to reach the article, but importing embedded content may be intentional; no completeness loss was demonstrated.

## Coverage and constraints

### Sources and saved content

| Source | Saved evidence | Limits |
|---|---|---|
| [The Illustrated Transformer](https://jalammar.github.io/illustrated-transformer/) | Title, Jay Alammar, main sections through acknowledgements, 41 Markdown images, diagram rendering, two highlight notes, a Key point, source note, recall and quiz answers | No publication date in frontmatter; embedded video added ahead of article. Counts are structural checks, not a pixel comparison of every image. |
| [3Blue1Brown: Transformers](https://www.youtube.com/watch?v=wjZofJX0v4M) | Title, author, 2024-04-01 date, nine chapter headings, timestamped transcript through the ending and description; transcript Key point and note saved | Playback unavailable in supplied shim; read the 12:27–14:21 passage instead of watching it. |
| [Attention Is All You Need](https://arxiv.org/pdf/1706.03762) | Title, authors in body, abstract through references and appendix, three Markdown images, tables and seven display-math blocks | Authors/date absent from frontmatter; known formula/table fidelity limits and new heading-order finding. Not certified as fully faithful. |
| [Wikipedia: Transformer](https://en.wikipedia.org/wiki/Transformer_(deep_learning_architecture)) | Title, Wikipedia attribution, stored date, 43 headings, 19 Markdown images, 125 display-math delimiter pairs, indented pseudocode, Applications and references | Stored date was not independently validated as the article's last revision date. |

The source audit is [d1-library-audit.json](d1-library-audit.json). Its article entry was captured during the quiz, before all answers had been saved; final state is in the later audits. The “tables” metric in that raw audit counts pipe-containing lines, not distinct tables.

### Setup limits that must not become product findings

- `page.clock` advanced the browser by one day at a time, but the real CLI kept November 25 timestamps. Tomorrow's drafts did not mature through Home. I used the visible **Review this source** action to review new exercises. All saved review due dates remain based on November 25; actual multi-day FSRS scheduling was not tested.
- The supplied shim returns no player port without a separate player server (`apps/desktop/scripts/mock/tauri.js:95–96`). Both video surfaces showed a failure and a YouTube fallback. I did not start a server or claim a playback regression.
- The phone seed was empty and had neither Mac sync nor AI, as specified. A real Mac owner would expect sources and progress there. Both article URL attempts failed with an explicit connection message and “Your Mac will try it”; no partial article was saved. I then pasted my own short transformer notes to exercise reading, note persistence and recall. This was **not a successful phone article import**. No phone exercises existed, so a short review was impossible. Saved phone evidence is IndexedDB, not the scratch directory: [keys](day-4-indexeddb-keys.json), [values](day-4-indexeddb.json).
- Kept one context and one page at a time. Mac page stayed open through days 1–3; saved its browser state and closed it for phone day 4, then restored it for Mac day 5. Thus day 5 reused the library but not the same page. Only my context/pages were closed.
- No deliberate command-failure injection, native app test, sync test, or independent second import of the PDF was performed. Browser automation selector mistakes and script startup time are excluded from product findings.

## What passed

- All four Mac URLs saved readable material with explicit Adding feedback; none was silently saved as a login/error page.
- Article diagrams rendered after scrolling; highlights, Key point, two highlight notes and source note persisted.
- Finish retained a substantive recall and quiz answers; feedback identified the missing distinction between decoder self-attention and attention to the source.
- Tutor explained that distinction with source citations; closing and reopening retained the answer. Its Add exercise action saved an exercise with AI provenance.
- Review questions were answerable and related to the source and marked passages, including an applied question about feed-forward weight sharing.
- The deliberately incorrect claim that reversed query/key attention scores must be equal received corrective feedback; the chosen Again rating saved.
- My chosen Good rating saved even when the AI recommended Easy or Hard. AI did not silently choose the recorded rating.
- Search for “animal tired” found the remembered passage; opening the result scrolled to the relevant article text.
- Five-minute goal and morning-coffee plan survived reopening Settings and matched `skills.yaml`.
- Phone pasted-note read, note editing/reopening, and Finish recall persisted in IndexedDB; failed URL imports gave a next step.
- Day 5 end screen showed **7 minutes**, **2 memories kept**, and **+5 days of memory**. The ring included the bonus lap and its accessible label said “7 of 5 minutes today.” Counts matched the saved records, within the clock limitation below. [End screen](d5-review-end.png).
- The Transformers skill retained my concrete coworker-explanation goal and suggested marking a technique with Try it. The reviewed article was assigned to AI, not Transformers; neither skill claimed mastery. Home offered remaining reading and my morning-coffee review plan. [Transformers](d5-transformers-skill.png), [AI](d5-ai-skill.png), [Home](d5-home.png).

## Saved review and due-date checks

| Simulated day | Recorded ratings | Counted active time | What saved next |
|---|---|---:|---|
| 1 | None; Finish quiz is not FSRS review | 0 | Article Done; quiz/recall saved; exercise drafting began |
| 2 | One Good, tutor-created Explain | 26.693 s | Due Nov 27; user rating 3 retained despite AI recommendation 4 |
| 3 | One Good Fact, one Again Explain | 39.010 s | Good due Nov 27, Again due Nov 26; PDF Done and four drafts eventually saved |
| 4 | None | 0 | Phone note, recall and Done status persisted; two URL retry entries, no exercises |
| 5 | Two Good Explain | 360.000 s, capped | Both due Nov 27; user rating 3 retained despite AI recommendations 2 and 4 |

Final Mac library: **four sources, twelve exercises, five recorded reviews**. Seven exercises came from article finishing, four from PDF finishing, one from the tutor. Video and Wikipedia were not finished and had no drafted review exercises in this run. Final audit: [day-5-audit.json](day-5-audit.json); earlier checkpoint: [day-3-audit.json](day-3-audit.json).

All Mac records are dated **November 25**, even though browser days advanced through November 29. Their active times therefore add to **425,703 ms = 7.09505 minutes** for the CLI's one day. The end screen rounds that to 7. Day 5 raw elapsed records are 324,134 and 262,723 ms; each contributes only the documented 180,000 ms cap. I advanced the page clock by 120,000 ms during each answer, so these are **not six minutes of observed human thinking**; they also contain time spent inspecting the run. The +5 days display matches rounding the two new 2.3065-day stability values (sum 4.613), not a demonstrated five-day retention result. Counting checked against `apps/desktop/src/review-session.ts` and `packages/core/src/study.ts` after using the screens.

Tomorrow's practical next step was clear enough: return after coffee, review, and continue the video/Wikipedia reading. Whether the correct exercises would actually appear tomorrow remains unverified because only browser time moved.

## Where the minutes went

These are measured buckets, **not an exhaustive time-use ledger**. Reading and tool/report work were not continuously timed. AI calls can overlap reading and other calls; do not sum columns into a session duration. “Lost” means observed interruption, not all background request time.

| Day | Review | Reading | Adding | Waiting | Lost / detours |
|---|---|---|---|---|---|
| 1 | 0 FSRS; four Finish quiz answers | Full article pass plus highlights and notes; duration not separately timed | Four save/readiness observations total 16.687 s (0.278 min); article timing is an upper bound | Recall ≤6.653 s; quiz Q1 ≤44.864 s, Q2 6.882 s, Q4 6.373 s; final Done 1.342 s | Embedded promo before article; playback unavailable. Detour duration not measured |
| 2 | 26.693 s (0.445 min) counted | Video transcript excerpt, not playback; duration not separately timed | One tutor exercise; save duration not separately timed | Tutor 16.374 s, grade 7.728 s; article drafting 168.410 s spans the day boundary | At least 82 s of unexplained drafting/searching; two empty review attempts; read code to learn why |
| 3 | 39.010 s (0.650 min) counted | PDF formulas/tables, Wikipedia code/math, search; duration not separately timed | No new source | Grade 9.401 s; Just mark done ≥50.4 s observed; key-points calls 60.056 and 42.905 s; drafting 53.318 s in background | PDF structure required original comparison; ambiguous Saving caused close/reopen; detour duration not separately timed |
| 4 | 0; no exercises | Pasted notes/read/note-reopen/recall sequence 46 s including tool overhead | Two URL attempts refused; first outcome observed by 8.106 s; fallback paste succeeded | Done 1.329 s | Could not perform planned article import or review; no Mac sync in seed. Lost duration not separately timed |
| 5 | 360 s (6 min) counted; includes accelerated time and inspection | Skill/goal/progress inspection, not a reading session | None | Explain feedback 10.425 and 15.488 s | No additional confirmed friction; actual retained learning over days cannot be inferred |

## Felt slow

All measured waits/action responses from the log, slowest first. “UI” means time from the action to the observed screen state using `performance.now()`; “bridge” is request-to-response time measured by the same monotonic clock. Upper bounds include observation delay. Rows with both describe the same operation and must not be added together.

| Seconds | Day | Action and what the learner saw |
|---:|---:|---|
| 168.410 bridge | 1→2 | Article exercise drafting; no visible pending state |
| ≥82 observed | 2 | Unexplained wait/search for first exercises, within the drafting interval above |
| 60.056 bridge | 3 | First PDF key-points request; Just mark done showed Saving for ≥50.4 s |
| 53.318 bridge | 3 | PDF exercise drafting; no visible pending state |
| ≤44.864 UI | 1 | First quiz feedback observation; waiting message shown |
| 42.905 bridge | 3 | Second PDF key-points request after reopening; a second request, not a repeated confirmed Saving-state finding |
| 16.374 bridge | 2 | Tutor answer, retained across close/reopen |
| 15.488 UI / 15.339 bridge | 5 | Context-of-“cut” Explain feedback; Checking your answer shown |
| 10.425 UI / 10.314 bridge | 5 | Feed-forward weight-sharing Explain feedback; Checking your answer shown |
| 9.401 UI / 8.931 bridge | 3 | Incorrect-answer Explain feedback; Checking your answer shown |
| ≤8.106 UI | 4 | First phone URL refusal observed; explicit connection/Mac retry message |
| 7.728 UI / 7.673 bridge | 2 | First Explain feedback; checking message shown |
| ≤7.071 UI | 1 | Article save/readiness; Adding shown |
| 6.882 UI | 1 | Quiz question 2 feedback |
| ≤6.653 UI | 1 | Recall to next step |
| 6.373 UI | 1 | Quiz question 4 feedback |
| 3.390 UI | 1 | YouTube import save/readiness observation; Adding shown |
| 3.385 UI | 1 | Wikipedia import save/readiness observation; Adding shown |
| 2.841 UI | 1 | PDF import save/readiness observation; Adding shown |
| 1.342 UI | 1 | Finish Done closes |
| 1.329 UI | 4 | Phone Finish Done |
| ≤0.647 UI | 3 | Search result opening, **includes a deliberate 0.500 s settle** |
| 0.303 UI | 3 | Search results for “animal tired” |
| 0.114 UI | 1 | Quiz Q3 submission; grading continued in background |
| 0.104 UI | 2 | Good response observed; final wrapping-up could continue |
| 0.100 UI | 5 | Good to next exercise |
| 0.093 UI | 3 | Fact Good response |
| 0.060 UI | 1 | Finish opens quiz |
| 0.056 UI | 1 | Article reopen |
| 0.051 UI | 4 | Add sheet closes, **not import completion** |
| 0.042 UI | 1 | Add dialog opens |
| 0.040 UI | 2 | Answer reveal, **not AI grading completion** |

Timing corrections to the contemporaneous log: the 45.471 s Q1 line is a duplicate caused by a waiter resolving after Next; use only the ≤44.864 s observation. “First Explain grade 40 ms” measured reveal, not grading. The 104 ms Good line did not measure final end-screen readiness. The 46 s phone sequence includes tool overhead and is not pure reading time. The 120-second clock jumps are synthetic, never wall-clock waits. No unexplained >1-second foreground blank interval was established independently of the hidden background-drafting finding.
