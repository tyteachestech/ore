# Spanish learner: four days in Ore

I used the supplied release WebKit app on November 28, 29, 30 and December 1, 2026, starting with an empty library: Spanish news, captioned YouTube, two Spanish podcast episode pages, a pasted A2 reader, and an English grammar explainer; Spanish Wikipedia refused both attempts with HTTP 429. I read Spanish, saved English vocabulary notes and Key points, finished the reader, reviewed on days 2 and 4, and used the separate phone copy on day 3. Three repeatable issues interrupted reading or listening; no saved-data loss was demonstrated. This run covered vocabulary, accents, synonyms, source evidence, interruption and save recovery. It did not establish Wikipedia fidelity, native YouTube playback (the supplied mock has no native player port), Mac–phone sync, a full ten-minute goal, largest iOS text size or native keyboard behavior. No product files were changed. Evidence was captured against commit `a98ed8031748c3e99ad18f0a54f2096ec29c1cb5`.

## Findings, ordered by learner cost

### 1. Podcast episodes become indistinguishable articles without their audio — S2, Mac

**Cost:** the listening task could not be completed in Ore. After adding a second episode, both list entries had the same title.

1. From a fresh Mac page, press ⌘N and add `https://www.spanishpodcast.org/podcasts_con_transcripcion/216t.html`.
2. Open the saved source. Its text starts with “La paella es deliciosa o está deliciosa.” Try to listen while reading.
3. Add `https://www.spanishpodcast.org/podcasts_con_transcripcion/215t.html`, whose text starts with “Soy feliz y estoy feliz”.
4. Open All sources and compare the two rows; open the second episode.

**Expected:** retain each episode's identity and playable audio alongside its transcript, or explain that only the transcript can be kept and offer the next step. **Actual:** both save as Article named `Español Podcast / Spanishpodcast |`, with neither audio nor timestamped transcript, and no partial-import notice. The full authored Spanish text remains readable. The saved original HTML for each includes its own `<audio>` element and an MP3 URL (`EP216/216paella.mp3`, `EP215/215soyfeliz.mp3`); the item folders contain only `doc.md` and `source.html`. Missing author/date also makes the identical entries harder to identify.

**Reproduced:** 2/2 separate episodes, days 1 and 4; import completion 1,595 and 1,135 ms. Screenshots: [first episode](day1-add-podcast.png), [two indistinguishable rows](day4-two-podcasts-list.png), [second episode](day4-second-podcast.png). Metadata and kept-file lists: [final-files.json](final-files.json).

**Suspected cause:** `packages/core/src/ingest/audio.ts:205` and `:235` require `/podcast(s)/`, `/episode(s)/`, or a host beginning `podcast(s).`; this site's `/podcasts_con_transcripcion/` matches none. This is an uncovered case of the episode-as-article problem in **F797**, not evidence that the Oxford-specific fix regressed. **D215's conservative detection rule needs a decision here:** the two originals contain explicit audio players and episode numbers, but the URL rule discards that evidence. Broader episode recognition or an explicit partial-import choice would preserve the promise; no rule was changed in this run.

### 2. A quiz point falsely says “No passage found” when two points share one sentence — S2, Mac

**Cost:** while checking past-tense Spanish, I could not follow the second point back to its evidence, and the screen implied the source did not support it.

1. From a fresh page on this run's library, open **Mi familia — lectura A2** in All sources → Done.
2. Source actions → Move to To read → Finish. Continue through recall and the first two quiz questions.
3. On question 3, answer: `Cuando era joven, mi abuela trabajo como enfermera. Trabajo aqui es pasado, con acento en la o.` Choose confidence and Check.
4. Inspect the two rubric points: the youth phrase and the past-tense verb. Try to open the second point's passage.

**Expected:** both points link to their shared supporting sentence. **Actual:** the first highlights “Cuando era joven trabajó como enfermera en un hospital.” The second says **No passage found** and its passage button is disabled. Both saved points have that same exact evidence and start position. This is a display/link problem, not an absent AI citation. The grading itself gave 2/2 for the answer explicitly acknowledging the accent.

**Reproduced:** 2/2 Finish visits, days 1 and 4, with a fresh Mac page on day 4. The repeat used the same saved question and evidence; fresh AI generation may produce different questions. The original pasted material is [graded-reader.txt](graded-reader.txt). Screenshots: [day 1](day1-quiz3-feedback.png), [day 4](day4-repeat-quiz3-feedback.png). Saved rubric: the reader's `meta.prequestions[2]` in [final-files.json](final-files.json).

**Suspected cause:** `apps/desktop/src/Finish.tsx:186–190` deduplicates passages by start position while retaining only the first point's index. At `:613`, the other point no longer has a passage with its own index; `:628` renders “No passage found”. No matching known findings row was located.

### 3. Find misses “corazon” while library search finds “corazón” — S3, Mac

**Cost:** finding an unfamiliar Spanish word required leaving the source's Find bar or knowing the missing accent in advance.

1. From a fresh page, open the saved **216t.html** podcast transcript above.
2. Press ⌘F and type `corazon`.
3. Change it to `corazón`.
4. Close Find, press ⌘K and search `corazon`; open the podcast result.

**Expected:** an accent-omitting word search finds the same passage in either search surface. **Actual:** direct Find says **Not found** for `corazon` and **1/1** for `corazón`. Library search finds it without the accent and correctly opens Find with the accented spelling. This matters for Spanish recall, where the learner may remember the word before its written accent.

**Reproduced:** 2/2, days 1 and 4 after a fresh page. Screenshots: [day 1 unaccented](day1-find-unaccented.png), [day 1 accented](day1-find-accented.png), [day 4 unaccented](day4-find-unaccented-repeat.png), [day 4 accented](day4-find-accented-repeat.png). Library result-to-passage took 54 ms on day 1.

**Suspected cause:** `apps/desktop/src/Find.tsx:12–49` folds case, quotes and whitespace, and normalizes composed accents, but does not ignore an omitted accent. **F590/F591 held** for phone/library search and landing on the correctly spelled word; this is the remaining direct-Find behavior, not a recurrence of their fixed paths.

## Known rows and recent fixes

- **F797:** the episode-as-article failure is observable on Spanishpodcast's different URL shape, described above. The original Oxford case was not rerun.
- **F734:** day 2 initially said All caught up while exercises were still being drafted. This is the already documented Home visibility limitation, not a new report or demonstrated regression in “Review this source”.
- **#595 / F884 held:** I rated nurse Again, left and restarted. Crafts, walk and cousin intervened; nurse returned next, with the retry no longer labelled New.
- **#593 / F877, limited check:** 54,741 ms on day 4 showed `<1 of 10 min` on Home, with goal unmet. The end ring showed 0 whole minutes, consistent with flooring. I did not repeat the exact 9:33 boundary or a bonus lap; the ring's zero is not reported as a separate finding.
- **#600 / F892 held for saving evidence:** the kept tutor exercise has two actual passage anchors, for event location and person location, with vendor/model/prompt provenance. Review landing from that new exercise was not tested; it waits until the next day.
- **#600 / F891, limited check:** phone Search showed “Source note” on its own visible line above the title. Largest text size/longest-title coverage was not repeated.
- **F739 held:** review logs moved to November 29 and December 1, and the phone saved November 30. No Mac rating appeared on the missed day. Other fixes in #593/#595/#600 were outside this language journey.

## What passed

- News retained Spanish prose through its ending, with accents and ñ; its title, date and author were saved.
- YouTube retained Spanish captions through the ending at approximately 07:12, with accents and `source.vtt`; the transcript was not translated. Playback itself remains unverified in this harness.
- Both podcast transcripts retained their authored Spanish text; the English introductions were present in the originals, not an Ore translation.
- The English grammar explanation retained its Spanish examples, comparison table and eleven practice sentences.
- Spanish Key points with English notes persisted for **lengua materna**, **empujar el carro**, **manualidades** and **dar un paseo**.
- Drafted exercises did target those words. Reader questions/answers were Spanish; rubrics and grading feedback were often English. News exercises used Spanish questions with some English vocabulary answers. This matched the saved learner intent better than the news's initial generic English prequestions.
- `tebeos` in place of `cómics` earned 2/2, and feedback explicitly recognized the synonym.
- `tia` and `panaderia`, with correctly accented `trabajó`, earned 2/2; feedback still taught the missing noun accents. Omitting the accent in `trabajo` received a justified tense correction, not a false synonym rejection.
- AI grades did not choose my recorded rating: the synonym answer suggested Easy, but saved my Good; the tense answer suggested Hard, but saved my Again.
- Phone paste → double-tap highlight → Key point → English note → edit/reopen → Finish kept accents, ñ, ¿ and ¡. Phone `corazon` search found `corazón` twice.
- The phone's kept original equals the Mac's pasted original byte for byte. Recall and Done were saved in IndexedDB without pretending AI was running; this separate empty copy had no exercises to review.
- A forced source-note write failure showed an error after 1,310 ms. Leaving/reopening kept the typed text; after clearing the failure it saved, survived full-page reload/reopening, and matched `notes.md`.
- Adding, grading and tutor waits showed progress text. No repeatable blank wait over one second or unacknowledged press over 100 ms was established. First DOM changes alone were not treated as proof of meaningful feedback.

## Saved-data check across the days

[verification.json](verification.json) contains the compact audit; [final-files.json](final-files.json) contains the source, exercise, review and session records. [day3-phone-storage.json](day3-phone-storage.json) is the phone's IndexedDB export. No direct library writes were used.

| Day | Saved facts and comparison with the screen |
| --- | --- |
| 1 — Nov 28 | Five sources saved; both Wikipedia requests refused without creating an item. Reader finished at 08:10:36.346 local. No ratings or review minutes. The six reader exercises finished drafting afterward. |
| 2 — Nov 29 | Seven ratings across six exercises: Again, Good, Good, Good, Good, Good, Again. Sum of credited time: **252,509 ms**. First interrupted session has an end receipt for one review, zero kept. The second session was interrupted before a settled end screen; its six ratings still persisted, but it has no end receipt. I do not claim a verified day-2 final end count. |
| 3 — Nov 30 | Separate phone reader captured at 08:00:48.938, recall at 08:01:49.137, finished at 08:02:00.684. Zero ratings. Mac logs have no reviews this day, so the aunt exercise due Nov 30 remained due for day 4. |
| 4 — Dec 1 | At 08:00, two Spanish exercises were ready: the missed aunt and new video vocabulary. Four unfiled news exercises were deliberately excluded. Two Good ratings total **54,741 ms**. End receipt and screen agree: **2 kept**, **+5 days of memory** (rounded stability gain 4.5274485 days). Home shows `<1 of 10 min`, not goal met. |

After day 4, the aunt and video exercises are due December 9; crafts, walk, cousin and gustar are due December 7. Nurse became due December 1 at **08:03:37.096**, after the short day-4 review ended at 08:01:55; later Home data correctly includes it. It was not silently lost from the initial queue. Final library: **6 sources, 12 exercises, 9 ratings**. The extra source is the second podcast; Wikipedia never imported. The twelfth exercise is the tutor exercise, correctly waiting until tomorrow. `new_today` is 1 on day 4, against the configured limit of 10; this run did not reach the limit. Repeating Finish on day 4 updated the reader's `finished_at` to Dec 1; [day1-finished.json](day1-finished.json) preserves the original day-1 finish.

Ore credits visible time per rated exercise, capped at three minutes (`packages/core/src/study.ts:139–142`, `apps/desktop/src/review-session.ts:370–386,573`). Reading is excluded. These totals include time spent orchestrating the test while an exercise remained visible; they are recorded app time, not a claim about uninterrupted human study.

## Where the minutes went

The table reports measured time only. Reading/composing time was not separately metered, so a complete wall-clock allocation is unavailable. Waiting overlaps adding/review; **do not add these columns together**. Debugging selectors and writing this report are excluded.

| Day | Review credited | Reading | Adding: submission to completion/refusal | Waiting that exceeded 1 second | Lost / repeated effort |
| --- | --- | --- | --- | --- | --- |
| 1 | 0:00 | News, video transcript, podcast excerpts, full reader and three quiz answers; duration not recorded | **0:08.562**, seven attempts | **0:14.137 measured**: video, podcast and past-tense check; other quiz/drafting waits not reliably timed | Two refused Wikipedia attempts: **0:01.371** plus unmetered preparation; listening unavailable; one Find detour; one false missing-passage link |
| 2 | **4:12.509** | Reopened the reader; duration not recorded | None | **0:17.784**, two completed Explain grades; initial background drafting wait not reliably timed | One extra confidence/Check action; interrupted session retained ratings |
| 3 | **0:00** | Phone reader, highlight, note, recall and reopen; duration not separately recorded | **0:00.113** | None measured over 1 second | No demonstrated lost work |
| 4 | **0:54.741** | Grammar, saved quiz repeat and tutor exercise; duration not recorded | **0:01.135**, second podcast | **0:34.806** to measured endpoints: accent grade, podcast, tutor first rendered reply and injected save error; tutor exercise usable by a later **0:47.927** observation | Second episode could not be listened to; Find detour and false missing-passage link repeated; note failure recovered |

The longest reliable AI-grade wait was **9.402 seconds**. The tutor began rendering after **23.942 seconds**; its complete exercise was present at the later 47.927-second observation, so 47.927 is an **upper bound**, not a claimed response latency. The first-day AI drafting time and the first two quiz checks lack reliable endpoint measurements and are not estimated.

## Felt slow

Every captured action-to-endpoint measurement follows, slowest first. `performance.now()` was used around actions; values include Playwright actionability. Import completion means the add dialog resolved, not that background AI drafting finished. Values under 100 ms are retained for completeness. Cached repeated quiz feedback is identified separately from fresh AI grading.

| Day | Action / measured endpoint | Milliseconds |
| --- | --- | ---: |
| 4 | Tutor exercise present at later observation — UPPER BOUND, not latency | 47,927 |
| 4 | Tutor: Stop disappears / first reply text; exercise still rendering | 23,942 |
| 2 | aunt-no-accents check | 9,402 |
| 1 | Quiz past tense check | 8,884 |
| 4 | aunt-noun-accents check | 8,419 |
| 2 | gustar-synonym check | 8,382 |
| 1 | Add video | 3,658 |
| 1 | Add podcast | 1,595 |
| 4 | Injected note failure: Escape to error (includes save debounce) | 1,310 |
| 4 | Add podcast-second | 1,135 |
| 1 | Add news | 904 |
| 1 | Add wikipedia | 845 |
| 4 | empujar rate Good | 832 |
| 1 | Add grammar | 777 |
| 1 | Add wikipedia-retry | 526 |
| 4 | Day 4 open: Home shell available | 337 |
| 1 | Add graded-reader | 257 |
| 2 | Rate nurse Again | 220 |
| 2 | nurse-retry rate Good | 219 |
| 1 | Recall to questions | 218 |
| 2 | cousin-synonym rate Good | 217 |
| 2 | gustar-synonym rate Good | 217 |
| 2 | walk rate Good | 216 |
| 4 | Repeat quiz 1 | 213 |
| 4 | Repeat quiz 2 | 213 |
| 4 | Repeat quiz 3 | 210 |
| 2 | crafts rate Good | 204 |
| 1 | Day 1 open: shell visible, not all content loaded | 142 |
| 3 | Phone paste graded reader | 113 |
| 3 | Phone corazon search to note | 68 |
| 1 | Search corazon to passage | 54 |
| 1 | Highlight lengua materna | 52 |
| 4 | Keep tutor exercise | 45 |
| 1 | Highlight manualidades | 43 |
| 1 | Finish Done: click/available Home button; NOT completed navigation | 43 |
| 2 | Cousin Explain: answer/rating controls revealed; NOT AI grade completion | 42 |
| 2 | nurse-retry check | 42 |
| 4 | empujar check | 42 |
| 2 | crafts check | 41 |
| 2 | walk check | 41 |

Raw measurements: [timings.jsonl](timings.jsonl). Chronological experience: [log.md](log.md). Screenshots use 2× device scale. The driver’s owned context was closed; its client process was stopped after remote disconnect did not exit promptly. Supplied servers and browser were not stopped.
