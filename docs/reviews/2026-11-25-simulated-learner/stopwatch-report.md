# Stopwatch — the owner's library, timed

The daily loop was responsive except for **typing a source note on iPhone after making a highlight in the longest book**. That added about five seconds to one 51-character sentence. I ran three fresh-page workflows on each build: review, reading, notes, search, skill navigation and adding; the Mac also ran three real grades, three tutor questions and three imports through exercise drafting. The starting library had 67 sources, not the benchmark's 950. I used the supplied WebKit server and scratch copies only. This is a same-day repetition study: Mac files accumulated changes between pages; each phone context started from its seed. I did not advance calendar dates, simulate a multi-day learning history, judge visual taste, or test the installed app, native iOS keyboard/selection handles or native streaming. Instrumentation corrections and supplemental samples are separated below.

## Findings, most costly first

### 1. S2 — Writing a note after highlighting the long book lags on most keys

**iPhone build in WebKit.** Two primary fresh-page runs reproduced this, plus one independent fresh-page diagnostic: **3/3 after highlighting**. No lost text was found.

1. Open a fresh phone page at `http://localhost:1772/` with the supplied phone initialization, touch enabled, 390 × 844, dark mode.
2. Open **Artificial Intelligence - A Guide To Thinking Humans**, Melanie Mitchell, from Home. Its `doc.md` is **638,121 bytes**.
3. In the prologue, select the opening words beginning “Computers seem to be getting smarter”. Tap **Key point** in **Highlight as**, then dismiss the highlight popup.
4. Tap **Note**, focus the note, and type a short sentence continuously. The measured sentence was 51 characters, with 30 ms between requested keys.
5. Return to Source, reopen Note, and check the text saved. It does save; responsiveness is the problem.

**Expected:** characters keep up with typing, as they did before the new highlight and on Mac. **Actual:** run 2 took **7,113 ms**, run 3 **7,159 ms**, versus **2,145 ms** in the unhighlighted phone run. Input-event → next animation-frame medians were **129 / 130 ms**; **34 of 51 inputs** in each slow run exceeded 50 ms. Worst input-frame gaps were **139 / 141 ms**, and worst keydown-frame gaps **192 / 196 ms**. These are event-to-frame measurements, not a claim about physical touchscreen latency. There is no indicator during the lag; the text just trails the requested typing.

**Reproduction boundary:** selection in the phone harness was a DOM Range, followed by real `page.tap()` on the toolbar. Native selection handles were unavailable. Run 2's first selection wait used the wrong popup selector; the highlight action and subsequent input measurements completed normally. Run 3 and the separate diagnostic used the corrected toolbar selector. A real-device confirmation remains worthwhile before calling this a native iPhone regression.

**Why this is not bridge startup:** phone commands run in-process; no Bun child process is involved. In the fresh diagnostic, the same note took **2,142 ms before** the highlight and **6,970 ms after** it. A further typing sample was **7,004 ms**. Clearing the browser's CSS highlight registry, without changing the saved note or annotation, brought it down to **1,835 ms**. Restoring those same registry entries stayed fast (**1,871 ms**). This narrows the problem to transient selection/highlight rendering state; it does **not** prove that all static highlights are expensive. Instrumented Range/Element rectangle reads produced no call over 5 ms, so the specific JavaScript hotspot is not established.

**Suspect code, not a proven hot line:** `apps/desktop/src/Reader.tsx:1383` paints source ranges through the CSS Custom Highlight API; `apps/desktop/src/styles.css:3404` moves the still-mounted source pane offscreen while its note is open. `apps/desktop/src/phone/PhoneApp.tsx:828` reads the caret following selection changes. Profile browser paint/invalidation across that transition before choosing a fix.

Evidence: [highlight context, run 2](iphone2-highlight.png), [highlight context, run 3](iphone3-highlight.png), [note context](phone-note-lag.png), [run 2 key samples](iphone2-keys.json), [run 3 key samples](iphone3-keys.json), [diagnostic script](diagnose-phone.cjs), [cleared-registry samples](phone-diagnostic-clear-css-highlights.json). The note-context screenshot was taken after the diagnostic reset; the timing traces, not the still image, establish the lag.

### 2. S3 — The first scroll through the long book catches several times

**Mac and iPhone.** Reproduced on **2/2 usable cold Mac traces** and **3/3 phone traces**. The third Mac trace was already warm and stayed smooth; an earlier trace accidentally targeted a non-scrolling element and is excluded.

1. Open a fresh page and the same 638,121-byte book from Home.
2. As soon as the first paragraph is readable, scroll through the source.
3. After the remaining content has mounted, repeat the scroll.

**Expected:** the initial readable page can be scrolled without noticeable catches. **Actual:** the first phone scroll had four animation-frame gaps over 50 ms in each run; worst gaps were **109, 102 and 111 ms**. The two cold Mac runs had four each, worst **101 and 107 ms**. Text remained on screen; this was brief stuttering, not a blank page or a multi-second freeze. A 120-frame sweep covered 21,600 CSS pixels. Subsequent broad sweeps across almost the whole book had **zero gaps over 50 ms**, all three samples on each device (Mac worst frame 29 ms; phone 20 ms).

Likely explanation: the first paragraph is ready before the remaining chunks mount. `apps/desktop/src/Reader.tsx:555`–`:575` mounts incrementally, up to 16 slices/about 200 KB per pass. The cold/warm comparison supports an initial-render cost, but a browser CPU profile is still needed to attribute each stall to that loop. The warm sweep target moved slightly as layout settled, reaching roughly 95–99% rather than every final pixel.

Evidence: [source context](mac-long-source.png); `timings.jsonl` rows 184, 201, 76, 112 and 148 contain the actual cold-frame gaps. Supplemental `whole-source warm scroll` rows provide the controls. A screenshot cannot demonstrate dropped frames.

## Timing results

Times are milliseconds unless marked seconds. Each three-value row lists trials 1 / 2 / 3, then median and worst. “Usable” endpoints are defined in [driver.cjs](driver.cjs) and [flows.cjs](flows.cjs). Browser `performance.now()` surrounds the action; actionability checks, locator polling and one final animation frame are included. These are conservative workflow timings, not pure JavaScript execution times. In particular, a 250 ms Reveal timing does not mean a 250 ms unresponsive button.

| Step | Mac trials | Mac median / worst | iPhone trials | iPhone median / worst |
|---|---|---|---|---|
| Page → Home usable | 256 / 245 / 264 | **256 / 264** | 1080 / 1290 / 1287 | **1287 / 1290** |
| Home → first exercise, picker action times summed | 374 / 367 / 319¹ | **367 / 374** | 683 / 654 / 656 | **656 / 683** |
| Explain answer → grade | 11.133 / 9.435 / 9.678 s | **9.678 / 11.133 s** | 81 / 87 / 68, manual fallback | **81 / 87** |
| Home → longest source's first readable paragraph | 204 / 201 / 204 | **204 / 204** | 228 / 267 / 233 | **233 / 267** |
| Mac sentence double-click → highlight popup | 819 / 824 / 825 | **824 / 825** | Native selection not tested | — |
| Highlight save command completion | 62 / 54 / 59 | **59 / 62** | In-process save verified in IndexedDB | Not independently timed |
| 51 characters in source note, including deliberate pacing | 1737 / 1822 / 1948 | **1822 / 1948** | 2145 / 7113 / 7159² | **7113 / 7159** |
| Per-input next-frame median across each typing run | 10 / 9 / 11 | **10 / 11** | 10 / 129 / 130² | **129 / 130** |
| Search → full-text results for “learning” | 322 / 313 / 328 | **322 / 328** | 361 / 363 / 351 | **361 / 363** |
| Sidebar → AI skill, usable content | First endpoint too early / 153 / 149 | Two primary samples; supplement 295 | 450 / 459 / 454 | **454 / 459** |
| Skill → Home | 81 / 78 / third selector invalid | Supplement 77 | 1169 / 1184 / 1167 | **1169 / 1184** |
| All sources scrollable | 94 / 90 / 87 | **90 / 94** | 373 / 377 / 386 | **377 / 386** |
| Add URL → readable | 1818 / 1313 / 1807 | **1807 / 1818** | Queued: 447 / 425 / 422 | **425 / 447**, not imported |
| Capture timestamp → initial enrichment timestamp³ | 20.527 / 23.066 / 18.171 s | **20.527 / 23.066 s** | No AI | — |
| Finish → exercises drafted | 32.320 / 31.736 / 35.599 s | **32.320 / 35.599 s** | No AI | — |
| Tutor send → text received through bridge | ≤20.888 / 19.334 / 16.513 s⁴ | **19.334 / ≤20.888 s** | No AI; not requested | — |

¹ The Mac queue shrank across persistent runs. On trial 3 one skill remained, so there was no picker. After correcting the script's expectation, the direct route took 319 ms. It was a repeat on that page, not a cold first press.

² Trial 1 typed before creating a new highlight; trials 2/3 typed after. The difference is the finding, not three interchangeable baseline samples. Each sentence was 51 characters despite the raw helper's “50 keys” label. The first Mac/phone key files contain 50 recovered input-frame samples; subsequent runs have all 51.

³ Server file timestamps, not browser-visible completion times. The source remains readable during initial enrichment. Reader polling for prequestions is in `Reader.tsx:1243`. These are background stages, not waiting required to read.

⁴ The first tutor run initially matched “Working” incorrectly; that 76 ms record is discarded. The corrected 20.888 s observation is an upper bound, sampled after arrival. The other two wait for an actual answer paragraph. **None is a valid native streaming-first-token benchmark** because the bridge buffers output.

### Ratings and Reveal

| Device | Next-exercise samples | Median | 95th percentile | Worst | Reveal samples; median / p95 / worst |
|---|---:|---:|---:|---:|---|
| Mac | 32 | **127 ms** | **135 ms** | **137 ms** | 31; 259 / 277 / 278 ms |
| iPhone | 33 | **69 ms** | **82 ms** | **83 ms** | 30; 268 / 294 / 298 ms |

The Mac queue ran out during run 3. Ten source-review ratings supplied the remaining samples; they are explicitly supplemental to the daily queue. The 395 ms last-rating → **end screen** transition is excluded from next-exercise statistics. Three later single-rating diagnostic sessions are also excluded. Ratings were deliberately **Again** to exercise the loop; these are UI timing samples, not an honest assessment of the owner's knowledge.

The slowest Mac next-exercise transition followed the beneficial-machine question about an AI editor maximizing audience retention while an engaging edit might mislead viewers (`01M73GRQKZYRGP028GZX14EHBW`). Its `review` command took **47 ms**; the complete transition took **137 ms**. The slowest phone one followed “In a web application, what is the API interface between the clients and the backend?” (`83 ms`).

### Review ending: distinguish totals from animation

The initial endpoint waited for the mole's speech, not necessarily the final number. Mac observed endpoints were 816 / 3860 / 835 ms; phone 871 / 860 / 854 ms. Screenshots show the expected totals, but those durations must not be presented as exact numeric-settle times.

A corrected supplement compared `.end-lap-n`'s number with the ring's final accessible label: **Mac 239 / 204 / 206 ms (median 206, worst 239); phone 87 / 74 / 71 ms (median 74, worst 87)**. These were extra short reviews with unchanged rounded totals: 5 minutes on Mac, 0 on each fresh phone seed. They do not benchmark an increasing minute count or a bonus lap. Number counting and goal laps are in `Lap.tsx:46`; the longer scene timing is in `Review.tsx:1305` and `:1538`.

### What was visible during the long waits

- **Grade:** at 0.5 and 2 seconds the answer/key points and **Checking your answer…** were visible. At 10 seconds the 11.133-second trial also said **This can take about 20 seconds.** The other two grades had already arrived. Manual rating remained available. The phone promptly said checking runs on the Mac and offered manual rating.
- **URL import:** **Adding…** and **Cancel** were visible at 100 and 500 ms; readable content followed in 1.3–1.8 seconds. Initial AI enrichment happened in the background. After Finish, Home was usable and the toast said **Finished … · exercises start tomorrow**. By 10 seconds that toast was gone; there was no continuous drafting indicator. I checked the saved exercise files to establish completion. This did not block another learning task.
- **Tutor:** the submitted question, working indicator and stop control remained available. The bridge returned text only after the command completed. See [mac2-tutor-words.png](mac2-tutor-words.png) and [mac3-tutor-words.png](mac3-tutor-words.png).
- **Phone startup:** the build has **Opening your library** (`PhoneApp.tsx:1186`). Intermediate startup paint was not timestamped, so this run does not certify that the indicator appears within 100 ms. The measured Home-ready endpoint is valid.
- **Phone Back:** a screen transition is visible. The 1.17-second locator endpoint includes the 300 ms slide and locator polling/action stabilization; it does not establish 1.17 seconds of blank or blocked UI (`PhoneApp.tsx:61`, `:96`).
- **Highlight:** double-click selects text first, then the Mac deliberately waits 500 ms for a possible third click (`Reader.tsx:2948`). Observed pointerdown → highlight-command starts were **511 / 507 / 514 ms**; saves took another **62 / 54 / 59 ms**. The popup was observed by 819–825 ms. The exact first highlight-paint timestamp was not isolated; save completion and final annotations were checked separately. Phone synthetic selection → toolbar was 860 ms in run 3 and 831 ms in the diagnostic; tapping Key point → popup took 85 / 77 / 86 ms.

## Where the minutes went

These are **seconds spent in timed actions**, not invented reading/thinking time. Review excludes AI; reading includes the scroll probe and paced typing; AI waiting combines grade and tutor. Background drafting is separate and can overlap other use, so the columns must not be summed into a real session duration. Navigation/startup measurements are in the timing table. Extra typing cost is already inside reading, not an additional total.

| Day / run | Review UI | Reading / note actions | Adding until readable or queued | Grade + tutor wait | Background draft | Extra time lost to note lag |
|---|---:|---:|---:|---:|---:|---:|
| Mac 1 | 5.41 s | 4.68 s | 1.82 s | ≤32.02 s | 32.32 s | None measured |
| Mac 2 | 8.25 s | 4.98 s | 1.31 s | 28.77 s | 31.74 s | None measured |
| Mac 3, including extra source review | 5.08 s | 5.12 s | 1.81 s | 26.19 s | 35.60 s | None measured |
| iPhone 1 | 5.09 s | 4.61 s | 0.45 s | No AI | No AI | Baseline |
| iPhone 2 | 4.95 s | 9.65 s | 0.43 s | No AI | No AI | **4.97 s** |
| iPhone 3 | 4.95 s | 10.55 s | 0.42 s | No AI | No AI | **5.01 s** |

The review clock measures time from exercise shown to rating, including answer checking, with a 180,000 ms cap per exercise (`review-session.ts:347`, `:514`). That is different from action latency. The harness paused while I corrected selectors and a terminal input-length problem; one Mac exercise recorded **276,114 ms**, contributing the capped **180,000 ms**. This was not an Ore freeze and is not counted as lost learner time above. The added source in run 1 was finished later in a supplement, not immediately after capture. No uninterrupted ten-minute human study session is claimed.

## Saved-data checks

[Saved-data audit](saved-data-audit.json) contains the read-only verification against the Mac scratch files and each phone page's IndexedDB snapshot. Seed files also contain older history; the audit preserves timestamps so older entries are distinguishable.

- Mac primary runs recorded **11, 11 and 1 ratings**. The extra source session recorded **10**, the pilot **1**, and three later end-number checks **1 each**. All were rating 1 (Again), matching the requested presses; no AI rating was silently recorded.
- Mac cumulative capped review time was **74,514 ms after run 1**, **96,661 ms after run 2**, **276,661 ms after the ordinary run 3**, and **279,774 ms after its source-review supplement**. Rounded end totals were **1, 2 and 5 minutes**, matching screenshots. The final three short diagnostics add 867 ms and still display 5.
- Phone runs recorded **11 ratings each**, elapsed totals **3,956 / 3,803 / 3,782 ms**. Their rounded end totals were 0 minutes, as shown. These short values reflect paced test answers, not meaningful study.
- Each review line has `state_after.due`; the inspected source-review examples moved to November 26 at their actual bridge time. No artificial future date was introduced. Mac times come from the real bridge clock; browser time was installed at the real time and not advanced.
- Mac saved the three new book highlights (six create/update annotation records) and all three appended note sentences. A fresh diagnostic Mac page reopened and displayed the complete note. Phone runs 2/3 saved their new highlight and note; run 1 saved its note. No missing text was found.
- The three Learning Scientists imports—Retrieval Practice, Spaced Practice and Elaboration—are readable, marked done and each has **three saved draft exercises**. They record Codex, model `gpt-6.2-sol`, prompt `enrich@17`. Initial enrichment completed **20.527 / 23.066 / 18.171 seconds after capture**; draft creation after Finish is separately timed above. These are draft files, not proof that every generated exercise is good or that tomorrow's queue was tested.
- Each phone URL attempt persisted a queued inbox link and displayed **Couldn’t reach … Your Mac will try it.** The browser's cross-origin fetch path differs from native `http_fetch` (`phone/core.ts:69`–`:96`), so this is a harness limit, not an import regression. Mac-to-phone synchronization was outside this setup.

## Attribution: what the calls prove

The probe wraps the actual Tauri-shim invocation and records command arguments, start time and completion time; it is a bridge-call ledger rather than a server process log. Completed values in `*-probe.json` can fill in calls that were still pending when an action row was written. A missing `ms` means pending at that snapshot, not zero. No claim about hidden filesystem reads follows just from command names.

| Step | Observed work | Interpretation and code |
|---|---|---|
| Mac Home | Four calls: `today`, `ls`, `ls --archived`, `skills`; run 1 64 / 79 / 73 / 43 ms, overlapping | 256 ms Home readiness; not one command per source. |
| Start review | `tries --now`, `session start`, `today`, `due --start`, current/next `card show`; six starts | 294–298 ms picker → exercise. `review-session.ts:322`–`:335` preloads the next exercise. |
| Rate | `review` then next-card preload; worst measured write 47 ms in the 137 ms transition | No whole-library `ls` in that transition. A source lookup sometimes occurs on Reveal for evidence. |
| Long-source open | `show` + `notes`, then `opened`, `backlinks`, `ls`, `ls --archived`; run 2 initial reads 47 / 43 ms | First paragraph usable at 201 ms; follow-up refreshes and chunk mounting continue. No per-row bridge call found. |
| Search | One `search learning`; run 2 61 ms | `Palette.tsx:99` adds a 150 ms debounce. 313 ms total is not 313 ms of core search. |
| AI skill | Six read starts: backlinks, questions, tries, stats, questions, notes; run 2 54–81 ms, overlapping | Duplicate questions read observed, but 153 ms usable page is not a demonstrated learner defect. |
| Grade | One `grade` call plus source evidence read | Run 2 grade 9379 ms of 9435 ms; run 3 9621 of 9678. AI dominates, not rendering or process boot. `Review.tsx:920` supplies progress copy. |
| Add URL | One `add` plus list/source refreshes | Spaced Practice add 1125 ms of 1313 ms; Elaboration add 1259 of 1807. Visible Adding feedback. |
| Finish drafting | One `enrich` plus Home/list refreshes | 31.693 s command in the 31.736 s run; 35.532 in 35.599. Background path is `Finish.tsx:197`–`:220`. |
| Tutor | `chat --set`, `tutor`, `chat --set` | Commands 18.921 / 16.203 s versus observed paragraphs 19.334 / 16.513 s. Bridge buffering hides actual first tokens. |
| Phone Home | Snapshot fetch/JSON parse/hash/mount and SQLite readiness, then local commands | `phone/core.ts:128`–`:151`; this is not native iCloud disk boot. Do not generalize 1.29 s to installed iPhone startup. |

The bridge's default command is `bun packages/cli/src/ore.ts` (`scripts/mock/bridge.ts:7`, `:48`), whereas the app ships a compiled binary. A read-only `--help` control compared that source entrypoint with a temporary compiled binary: warm median **34.50 ms versus 14.34 ms**, roughly **20 ms extra startup**. The first compiled call was **837.71 ms**, recorded rather than discarded silently; subsequent six were 14.01–14.99 ms. This baseline isolates some harness cost, not all work: it would be wrong to subtract 20 ms mechanically from overlapping real commands. The temporary binary was removed after measurement. Nothing was installed.

`bridge.ts:50` collects stdout/stderr completely before answering. It does not relay the native streaming events. Thus the tutor's full-answer wait is useful for this rehearsal but cannot support a native first-words defect. Phone typing has neither that bridge nor subprocess boot, so the reproduced note lag survives this distinction.

## Felt slow

The complete descending list of **every accepted primary action over 100 ms**, including what remained visible and its attribution, is in [felt-slow.md](felt-slow.md). It is the detailed timing appendix to this report. The slowest classes were:

1. Background exercise drafting: 31.7–35.6 seconds, Home usable.
2. Tutor response through the buffering bridge: 16.5–≤20.9 seconds, working/stop controls visible.
3. Explain grading: 9.4–11.1 seconds, explicit progress and manual rating available.
4. iPhone typing after highlighting: 7.1 seconds for 51 characters, about five seconds beyond the baseline; repeated per-key delay with no useful feedback.
5. End-scene animation proxy: up to 3.86 seconds, not the numeric-total latency.
6. Initial long-source sweep: about 2.1–2.2 seconds for 120 requested frames, with four brief cold-render catches; warm sweeps about 1.9 seconds without >50 ms gaps.
7. URL → readable: 1.3–1.8 seconds, Adding visible.
8. Phone Home: 1.08–1.29 seconds, browser snapshot boot.
9. Phone skill → Home locator endpoint: 1.17–1.18 seconds, transition/polling included.

Supplemental diagnostics, not mixed into those distributions: full-book warm sweeps Mac **1912/1918/1914 ms**, phone **1910/1917/1915 ms**; before/after-highlight typing **2142/6970 ms**; repeated sticky typing **7004 ms**; cleared/restored highlight registry **1835/1871 ms**; corrected numeric-end samples listed above. Raw records preserve all of these and the invalid measurements.

## Known rows checked

No fixed row was confirmed to have returned. Existing below-fold ratings (F14) were not escalated. F293 is the known phone skill/review slowdown at 1,191 sources; this library has 67 sources and the new finding concerns note typing after a highlight. F246 concerns Find in a 10,000-line note, not this 51-character source note. The initial background draft is not F196's failed-draft retry. The old book still contains publisher front matter; its stored import predates F649's markers, so this run does not establish a recurrence of that import fix. The other explicitly excluded open rows were not retested as findings.

## What passed

- Both builds opened Home, started review, revealed answers, accepted ratings, ended sessions, and returned to learning without a crash.
- Next-exercise latency stayed under 140 ms on Mac and 85 ms on phone in the primary samples.
- Real Mac grading showed progress and allowed the learner to choose the recorded rating; phone offered manual fallback.
- The largest source's first text appeared in under 270 ms on both builds.
- Mac typing remained within 19 ms per measured input-frame sample on that source.
- Mac highlights and note edits survived reopening; phone edits were present in its saved IndexedDB files.
- Search, AI skill navigation and source lists worked with the owner's actual content.
- Three Mac URL imports became readable and each generated three persisted draft exercises.
- Warm long-source scrolling had no sampled animation-frame gaps above 50 ms.
- Saved session totals agreed with the capped review durations, including the disclosed harness idle time.

## Reproducibility and limits

Read `CLAUDE.md`, the daily-session design, known findings and bench guide before testing. Repository HEAD observed at the end: `63c9b83b14cd9cbdcee3f5acd80b699f601d0d54`; the pre-served build's exact compile revision was not independently attested. No repository source, test or findings-registry file was changed. No server/browser was launched or stopped. Own contexts were closed after use. Git working-tree status remained clean; all output is under `codex-out/stopwatch/`.

`driver.cjs` + `flows.cjs` are the reusable timing helper and workflows; this was an interactive run, not one unattended executable. `timings.jsonl` is the raw record; `summary.json` and `report-data.cjs` explicitly identify accepted samples and exclusions. `automation-log.md` preserves the original live log, including tester errors; `log.md` is the reconciled learner-friction log. Locator mistakes, an early match on “Working”, a non-scrolling element, an already-exhausted queue and a PTY line-length stall were excluded rather than called app defects. No complete set of three valid primary skill-ready or final-number-onset samples is claimed; the supplementary checks are labeled. No failure injection was used, and no persistence/AI/sync claim goes beyond the checks above.
