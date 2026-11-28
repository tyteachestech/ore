# Researcher: four days organising a teaching question

Tested the Mac release build in supplied WebKit at 1280 × 800, 2× screenshots, against only the assigned copy of the real library. The question was **“How should I combine retrieval practice and feedback when teaching a new idea?”** Day 1 (Nov 28) created it in Learning, ran Begin research, added a practical article and primary paper, filed/pinned/ordered them and wrote a skill note. Day 2 answered it from the article and finished the article. Day 3 renamed/moved the skill, split the article into Teaching Experiments, restored a relevant lesson from an existing course and archived the finished article. Day 4 reviewed its exercises and checked the saved state. One repeated S2 issue emerged. Skipped iPhone, visual taste, full-course completion, new playlist import, dedicated merge (none found in the inspected skill menu), and unrelated known issues. No product files were changed. Library changes went through the app; scripts, screenshots and reports are confined to this folder.

## Finding: archiving the finished source removes the answer’s evidence link

**S2 · Mac · 2/2 archive cycles, also present after reload and on Day 4.**

Archiving what I had finished broke the route from my answer back to its evidence. The answer text remained, but the source name and clickable link disappeared. I had to leave the question and find the article in All sources → Archived. This cost more than the ordinary AI waits because it removed information I needed to revisit the research.

### Reproduce from a fresh page and the original seed

1. Open Learning. Add the question above through Questions → +.
2. Choose Begin research. Add **How can we maximize students’ learning with feedback?** (`https://www.retrievalpractice.org/strategies/2018/5/25/feedback`), or add that URL and file it in Learning.
3. Open the article. In Collected, answer the question with a short summary, save it, and choose **Answered + exercise**.
4. Open Learning → Answered. Confirm the answer has the article title as a link.
5. Open that article and use Source actions → Archive.
6. Return to Learning → Answered. Reload and open Answered again.
7. Restore the article through All sources → Archived. The answer’s source link returns. Archive it again: the link disappears again.

The actual journey also renamed Learning to Learning & Feedback and filed the article under Teaching Experiments before archiving. The answer link survived that reorganisation; archive alone toggled it off and restore toggled it on in both cycles.

**Expected:** keep the answer’s named, clickable source even when the source is archived. D75 says each answer contribution names its source and links back to it. Archiving a completed reading should not erase that attribution.

**Actual:** the answer renders as plain text with no source title, link, or explanation of what happened. Its stored contribution still contains the correct item ID, so this is lost access/attribution in the interface, not lost answer data.

**Screenshots:** [before archive](day3-answer-after-split.png), [first disappearance](day3-answer-lost-source-link.png), [after reload](day3-answer-lost-source-link-reload.png), [restored link](day3-restored-source-link.png), [second archive](day3-archive-link-second-cycle.png), [clear Day 4 view](day4-answer-evidence.png).

**Likely cause:** `packages/core/src/questions.ts:22–23` builds its title lookup with `listItems(lib)`, which excludes archived sources (`packages/core/src/items.ts:309–312`). At `questions.ts:40`, the contribution therefore has no `item_title`. `apps/desktop/src/SkillPage.tsx:840–843` requires that title to render the source button. The archive filter for candidate reading sources is also being used to resolve already-saved answer attribution.

**Saved evidence:** question annotation `01M8HE5KC4WEVJBBDAACT2WTF8`, revision 3, status `done`, `card: true`; answer contribution still names article `01M8HE7XS7Z3EK9XBWM750K2TS`. Its article remains `status: done`, with `finished_at: 2026-11-29T16:02:53.569Z` and `archived_at: 2026-11-30T16:03:10.326Z`. See [final file snapshot](final-files.json). No finding row was added to the repo because this run is findings-only.

## Known rows and regression checks

No fixed row was demonstrated to have come back.

- **F12 / D204, known limit:** after restarting Review, Learning & Feedback was absent from the selection list although the skill showed one new question-derived exercise. The globally limited new queue explained it. I had to read the queue rules to understand why that particular exercise could not be selected. Logged separately; not presented as a new bug.
- **#595 / F884:** after Again and leaving Review, the missed exercise returned after two intervening exercises on restart. Held in this journey.
- **#600 / F892:** a kept tutor exercise retained three cited passages in its file; Review displayed the quote and Open in source returned to the source passage. [Review evidence](day4-kept-exercise-evidence.png), [source jump](day4-kept-exercise-jump-settled.png).
- **#593, related to F874/F875:** the tutor successfully used the explicitly named archived article, supplied three clickable passage citations, and opened the source from them. This checks the successful archived-source path. It does **not** fully retest the renamed-title retrieval edge or forced rejection of a mixed local-file citation. [Tutor citations](day4-archived-citations.png).
- **#593 / F877:** Home showed 6 minutes below goal and 11 after 10:49.547; the exact 9:33 rounding boundary was **not validly retested**. A fractional test-clock value made `elapsed_ms` noninteger; the CLI refused it. I advanced the clock to an integer and retried. No extra rating was saved. This harness mistake is excluded from findings.

## What passed

- Begin research returned five results with a visible “Finding sources…” state; two chosen sources imported and linked to the question.
- Pinning both sources, changing their order and Undo restored the original order.
- The article surfaced the question in Collected; the saved answer and Answered status survived navigation, reload and later days.
- Answered + exercise produced a draft with the expected question, answer, skills and Codex/model/prompt provenance.
- The article’s finish recall and three quiz answers persisted; a learner correction to a missed key point persisted too.
- Renaming Learning preserved its stable ID, note, answer and exercise; moving its collection supported Undo and Redo.
- Splitting the article’s filing into Teaching Experiments updated all three article exercises; the question stayed in Learning & Feedback.
- Restoring Additional activities retained its AI Fluency course grouping and part 14; the other archived lessons stayed archived.
- The lesson’s application note survived reopening and produced a new exercise with provenance.
- Archiving the finished article retained its text, note, answer contribution and reviewable exercises.
- A simulated filing-save failure showed an error and rolled back; retry saved, and Undo restored the paper’s original skills. [Failure state](day4-filing-save-failure.png).
- All four graded Review answers kept my Good rating even when the AI suggested Easy.
- Day changes advanced timestamps and review dates; no ratings or goal credit leaked into Days 1–3.
- Day 4 skill breakdowns agreed with files/review replay: Teaching Experiments had 3 rough, 2 new, 5 days deep, level 0; Learning & Feedback had 1 nearly cut, 1 new, 15 days deep, level 0. [Teaching Experiments](day4-experiments-strength.png).

## File audit and daily counts

Final library: **70 sources, 44 exercises**, versus 67 sources and 38 exercises initially. The three added sources are the question snippet, feedback article and feedback paper. The six added exercises are one from the question, three from finishing the article, one from the course note and one kept from the tutor. An exercise file’s `state: draft` alone does not determine whether it has been reviewed: its review log is replayed.

| Day, local date | Ratings | New exercises first rated | Credited review time | File/UI checks |
|---|---:|---:|---:|---|
| 1 · Nov 28 | 0 | 0 | 0 | Question and two research sources captured that day; no goal credit for organising |
| 2 · Nov 29 | 0 | 0 | 0 | Answer saved and question marked done; answer exercise and three finish exercises dated Nov 29 |
| 3 · Nov 30 | 0 | 0 | 0 | Rename/collection/filer changes persisted; article archived; answer retained its source ID |
| 4 · Dec 1 | 5 | 3 | 10:49.547 | Home/end showed 11 min and goal met; course-note and tutor drafts remained unreviewed |

The first burst saved Good and Again; its two capped elapsed times gave **6:00**. The second saved Good, Good and Good for **4:49.547**. Its end screen correctly counted **three memories kept and +5 days** for that burst, while the ring showed the whole day. [Settled end](day4-end-settled.png), [final Home](day4-final-home.png), [review records](final-audit.json). Three deliberation intervals were advanced by 180 seconds each; review time is simulated credited time, not a measurement of human effort. Credit is the sum of `min(elapsed_ms, 180000)` per saved rating (`packages/core/src/study.ts`, used by Today).

Final next-due dates, all from saved `state_after`:

| Exercise | Latest rating | Next due, UTC |
|---|---|---|
| Existing prompt-design exercise `01M4J5754B2XBSV9Q3726M5GWV` | Good | Dec 12, 16:04:06.526 |
| Why explanatory feedback transfers `01M8M0R88A1B06081TEF69BJ26` | Again, then Good | Dec 3, 16:12:49.277 |
| Partial recall `01M8M0R88BSPC2VHPHQ07KR3DR` | Good | Dec 3, 16:10:59.423 |
| Workshop activity `01M8M0R88BSPC2VHPHQ07KR3DS` | Good | Dec 3, 16:12:26.756 |

The missed exercise’s first rating scheduled Dec 2; its same-day recovery moved it to Dec 3. The question-derived draft was not rated. No further-day due execution was tested, and there was no skipped calendar day in this four-consecutive-day scenario.

## Where the minutes went

These are measured intervals and task counts, **not invented whole-session totals**. Reading, writing and organisation were not continuously timed. “Lost” time excludes deliberate reproduction and harness troubleshooting. Waiting can overlap reviewing, so columns must not be added as disjoint totals.

| Day | Review | Reading | Adding/organising | Waiting | Lost effort |
|---|---|---|---|---|---|
| 1 | 0 | Read five research candidates; duration unmetered | 1 question, 2 sources, skill note, pins/order; duration unmetered | Research 45.299 s; paper import 2.348 s; article import ≤7.735 s | Submenu pointer attempt repeated; human reproducibility unresolved |
| 2 | 0 rated review | 1 article, recall and 3 finish questions; duration unmetered | 1 answer, 1 answer-based draft; three finish drafts generated | Finish/quiz AI waits were not reliably end-to-end timed | Corrected one AI key-point mark; single occurrence |
| 3 | 0 | 1 course lesson; duration unmetered | Rename, collection move/undo/redo, new skill, refile, course note, archive | Rename 0.306 s; collection action 0.042 s | Lost source link; needed All sources → Archived → article instead of the answer’s one source link |
| 4 | 10:49.547 credited, with 9 simulated minutes | Tutor evidence and supporting source; duration unmetered | 1 tutor exercise; filing fail/retry/undo | Four grades total 41.257 s; tutor response ≤24.252 s | Could not choose question draft after restart (known limit); code read needed to explain queue |

## Felt slow

The longest dependable wait was research at **45.299 seconds**. Grade waits were **8.917–12.463 seconds**. These waits had visible working states; no repeated blank wait over one second or unexplained ignored press was confirmed. Durations below are from `performance.now()` and include automation scheduling. A completion taking over 100 ms is not itself evidence that the first response was silent.

All recorded intervals, slowest first. Upper bounds were observed after completion and must not be treated as exact latency. Early UI echoes do not prove disk-write completion; persistence was checked separately.

| Action | Seconds | Qualification |
|---|---:|---|
| D1 research results | 45.299 | Observed UI/action interval |
| D4 archived-source tutor upper bound | 24.252 | Upper bound; completion observed late |
| D4 grade workshop exercise | 12.463 | Observed UI/action interval |
| D4 grade same-day retry | 9.941 | Observed UI/action interval |
| D4 grade first answer | 9.937 | Observed UI/action interval |
| D4 grade partial-recall exercise | 8.917 | Observed UI/action interval |
| D1 first research add upper bound | 7.735 | Upper bound; completion observed late |
| D1 add feedback paper | 2.348 | Observed UI/action interval |
| D4 start selected review | 0.838 | Observed UI/action interval |
| D4 rate first Good | 0.309 | Observed UI/action interval |
| D3 rename skill | 0.306 | Observed UI/action interval |
| D2 reload home | 0.300 | Observed UI/action interval |
| D1 save question | 0.286 | Observed UI/action interval |
| D3 reload home | 0.248 | Observed UI/action interval |
| D4 reload home | 0.229 | Observed UI/action interval |
| D2 finish source | 0.224 | Observed UI/action interval |
| D2 quiz feedback | 0.212 | Invalid as grading latency: measured Next availability only |
| D2 open feedback article | 0.137 | Observed UI/action interval |
| D1 open Learning | 0.065 | Observed UI/action interval |
| D2 save answer from article | 0.046 | Early UI echo; persistence verified separately |
| D3 move skill collection | 0.042 | Observed UI/action interval |
| D4 keep cited tutor exercise | 0.039 | Immediate UI response; saved evidence verified later |
| D2 answered plus exercise | 0.030 | Immediate UI response; draft verified later |
| D1 add question opens | 0.029 | Observed UI/action interval |
| D1 Begin research feedback | 0.029 | Observed UI/action interval |
| D1 pin practical guide | 0.025 | Observed UI/action interval |
| D2 recall Continue | 0.017 | Action only; not full AI wait |

## Limits and evidence

The main finding comes from repeated friction-log entries on Day 3 and was still visible on Day 4. One generic finish question’s rubric was narrower than the article’s valid teaching activities; the learner could correct it. That was a single AI output, so it is not promoted to a finding. A source-menu pointer interaction closed twice during automation but was not isolated from pointer timing; it is also not promoted.

The test used one owned browser context and one page and closed both at completion. No test server, watcher or browser was launched or stopped. The shared supplied WebKit was disconnected, not shut down. The only pre-existing Git status entry outside this output was an untracked run-7 report directory; it was left untouched.

Artifacts: [friction log](log.md), [raw timings](timings.jsonl), [bridge observations](requests.jsonl), [final file snapshot](final-files.json), [final reviews](final-audit.json), [read-only audit script](audit.py), [browser driver](driver.cjs). The driver accepts interactive commands; numbered steps above describe the reproduction rather than claiming the driver is a complete replay script.
