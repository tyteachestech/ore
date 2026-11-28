# Notetaker — five days in Ore

Tested commit `bc54898cb31499443087573de5778a6848b685cc`, with the supplied release WebKit app and real Codex AI, November 28–December 2, 2026 (08:00 local, moved forward only). Started with 69 sources, 38 exercise files and 15 source-note files. I read **How the web works**, wrote and revisited structured source and skill notes, linked sources and a skill, annotated four passages, moved blocks, recovered a failed save, edited a separate phone note, reviewed three resulting exercises, then renamed/archived linked targets and searched my notes. Two S2 findings; no unexplained note loss. I skipped imports, broad library review, visual taste, native iOS keyboard testing, and physical-device sync. The supplied phone seed has no sync connection to the Mac copy, so merging yesterday’s Mac note with phone edits was not testable. Only `codex-out/notetaker/` contains my scripts and report; library writes went through the apps. No product files changed.

## Findings, greatest measured cost first

### 1. Tutor quotes a saved source but provides no way to open that evidence

**S2 · Mac · Day 5, Read/Ask.** Two requests consumed **91,028.847 ms** and still left a manual source-finding task. This is a citation delivery failure, not a claim that the answer’s quoted content was false.

From a fresh Mac page on this library:

1. Open **Spaced repetition**, rename it **Spaced repetition — review timing**, then archive it through Source actions. (On the final test library, these steps are already done.)
2. Return Home, open Tutor, and send: “In my saved, archived source Spaced repetition — review timing, why are reviews spaced apart instead of repeated all at once? Use that saved source and cite the supporting passage.”
3. Inspect the first answer and open **Sources**. The study quotation is followed by plain text “Spaced repetition — review timing, Research and application”; it is not a button or link. The only clickable source is **Learning Science**, supporting the separate advice to schedule recall.
4. Ask: “Please give me a clickable Ore citation to the specific passage in Spaced repetition — review timing that you just quoted. The first answer only gave a clickable Learning Science citation.”
5. The reply tells you to open Archived, find the source, and ask again from its reader. Reload, open Tutor → Chats → **Why spaced reviews work**: the same missing passage link remains.

**Expected:** The quoted saved passage has an Ore citation that opens it. If the passage cannot be cited, the answer explains that before presenting it as sourced evidence.

**Actual:** The stored reply contains a Markdown link to the local absolute `doc.md:70` path. Rendering turns it into inert text. The quotation really exists at line 70 of the named source, but its citation object is absent. A different, valid citation makes the reply appear source-backed without providing access to the evidence for its main example. The follow-up requests a manual detour instead of supplying it. The wait showed “Reading your sources…” and later “A reply takes about 10 seconds”; the first request actually took 64.181 seconds.

**Verification:** One real generated answer inspected twice, initially and after reloading/reopening its saved chat; same defect both times. One corrective follow-up also failed to deliver the citation. This is **not** two independent AI generations reproducing identical wording. The returned citation list and source file confirm the mismatch; the reopened Tutor contains zero anchor elements and only the Learning Science citation button.

**Evidence:** [First answer](day5-archived-source-answer.png), [follow-up](day5-citation-followup.png), [reopened chat and Sources](day5-citation-reopened-sources.png), [visible wait](day5-tutor-wait.png). Request/response details: `requests.jsonl`; saved library/chat snapshot: `final-files.json`.

**Suspected code:** `apps/desktop/src/Tutor.tsx:1074–1075` deliberately renders non-`#cite-` links as spans. `packages/core/src/ai/tutor.ts:374–384` checks for an empty citation list, so one secondary citation does not establish that the quoted passage has a usable citation. These are inspection leads, not a proven root-cause fix. Do not solve this by blindly opening arbitrary local paths.

### 2. Phone link result lies under the keyboard bar; a tap applies Heading

**S2 · iPhone · Day 3, Read/write.** Ordinary skill-note linking becomes a formatting mistake requiring recovery.

From a fresh phone page at 390 × 844 with touch:

1. Open **Web Development**, then its full-screen skill note.
2. Write a short paragraph. On a new line, use the keyboard bar’s **Link to a source or skill** control (or type `[[`). Search **How the web works**.
3. The result appears at the bottom, partly hidden behind the keyboard bar. Tap its centre.
4. Leave and reopen the skill note, start another link, and search **Spaced repetition**. Tap the result centre around `(195, 809)`.

**Expected:** A visible 44-point result target above the keyboard bar; tapping it inserts the selected source link.

**Actual:** The result rectangle is `x=13, y=787, width=364, height=44`; the bar starts at `y=799`. It covers 32 of the result’s 44 points, including its label and centre. The actual centre tap hit **Heading** and changed the pending text into `## [[Spaced repetition` instead of inserting a link. Return/Enter selected the first source as a workaround. Undo was available to recover the accidental formatting.

**Verification:** Occlusion reproduced **2/2 picker openings**, with two different source searches and a leave/reopen between them. One actual centre tap confirmed the wrong Heading action. The first locator tap timed out because Heading intercepted it; its eight-second automation timeout is not counted as app latency. The wrong-action tap itself took 6 ms. This is supplied touch WebKit with the app’s keyboard bar, not a physical iPhone or native software-keyboard test.

**Evidence:** [First covered result](day3-link-covered-first.png), [second covered result](day3-link-covered-repeat.png), [wrong Heading action](day3-link-tap-wrong-action.png), [measured bounds](phone-link-overlap.json). Phone IndexedDB snapshot: `day3-phone-files.json`.

**Suspected code:** `apps/desktop/src/styles.css:3565–3573` places the keyboard bar and note-menu sheet; the comment assumes the note page ends above the bar. Bottom room is reserved for `.phone-reader`, while the full skill note uses `.phone-page.phone-note` in `apps/desktop/src/phone/PhoneApp.tsx:464` and padding at `styles.css:3581`. Check its containing/stacking context and bottom inset. This differs from F41’s top clipping and F34’s missing link targets: the sources are found, but their tap target is covered.

## Known rows and earlier fixes

No known row was conclusively observed returning.

- **F796 / #562 held:** interrupted Explain retained its answer and 34,133 ms of active time. Its eventual review recorded 90,878 ms, incorporating that prior time; the day’s total matched Home and the end screen.
- **F871 / #587 held:** Make this exercise clearer showed all three revised key points and saved them with the accepted question, answer and AI stamp (`codex`, `gpt-6.2-sol`, `chat@3`). Evidence: `day4-clearer-proposal.png` and `day4-clearer-files.json`.
- **F312 held:** renaming the skill updated the source’s Linked from name immediately.
- **F807 / #582:** Review Ask’s chat was saved to the library. Reopening that future-due exercise’s Ask panel was not completed, so persistence through that exact UI path is not claimed as a pass.
- **F808 / #582 and F872 / #587:** Finding 1 exposes a nearby gap, not a proven recurrence of their exact cases. The archived source was read and accurately quoted; the answer had one valid citation rather than zero. I did not attribute this to archived-source exclusion or the zero-citation retry logic failing to run.
- Skipped the specified open rows and did not turn automation focus errors, incomplete early snapshots, or the independent phone seed into new findings.

## What passed

- Structured source note retained headings, three list entries, all 12 table cells, display math, a toggle, a callout and three ID-based links after leaving and reopening.
- Source note stayed byte-for-byte identical after Day 1: 1,343 bytes; SHA-256 `334cd978e5b8912fd5abcb149545f838f70af82409c23f69118d0fe584b23a56`.
- All **14 pre-existing notes I did not edit** remained unchanged; the edited source note was previously empty.
- Skill note retained its settled text through subsequent days, rename and reopen; the final file exactly matches the Day 3 snapshot.
- Source-to-source, source-to-skill and skill-to-source links saved as ID links and opened their targets; backlinks showed the referring heading/line.
- Undo/redo restored edited text; cut/paste and pointer block drag changed the intended block order and persisted after reopening.
- Injected `notes` write failure showed “Notes not saved”, retained the draft across navigation, and saved it after storage recovered and Try again was pressed.
- Four new highlights persisted alongside the one existing highlight; two new highlights retained my annotations. The canonical evidence is `annotations.tys-mac.jsonl`, not a `highlights.json` file in this library.
- Esc canceled two untouched new selections; Enter saved them on Day 2. Already annotated selections survived Esc. This was intentional cancellation, not lost saved data.
- Phone paragraph, to-do creation and a link inserted with Return persisted when reopening the same page’s skill note and in IndexedDB. Checkbox completion itself was not established.
- Two source-note exercises and one DNS-highlight Explain exercise reflected what I wrote/read; no plainly wrong grading was observed. Skill-note exercise drafting is not implemented in the current spec and was not claimed here.
- The highlight exercise’s source passage opened at the right location; my notes were accessible alongside the source. Review itself did not display the personal annotation or label note-derived exercises, recorded as context friction only.
- All three recorded ratings were my **Good** choices, including when the AI suggested Easy.
- Source and skill links survived renames; the archived linked source remained readable. Written link labels stayed as authored while IDs continued to resolve.
- Searching **packet budget** found the source note and opened it.
- Day 4 recorded three new exercises and 180,934 ms of review time; the end screen/Home showed 3 of 10 minutes. Day 5 reset to zero while retaining the prior partial day in the week view.

## File and day verification

[verification.json](verification.json) contains note comparisons, merged active annotations and new review records. [audit.py](audit.py) can rerun the read-only comparison. Snapshots are retained for each day and at final completion. Day 2’s last snapshot preceded the final corrected skill-note save; Day 3 and the final file agree. Caret-placement mistakes made by the test script were corrected in the editor and excluded from findings.

| Day | Local date | Newly recorded reviews | Recorded review time | New rated exercises due next |
|---|---|---:|---:|---|
| 1 | Nov 28 | 0 | 0 | None |
| 2 | Nov 29 | 0 | 0 | None |
| 3 | Nov 30 | 0 | 0 | None |
| 4 | Dec 1 | 3 Good | 180,934 ms | All three Dec 4, around 08:00–08:03 local |
| 5 | Dec 2 | 0 | 0 | Dec 4 dates unchanged |

The three Day 4 elapsed values are **19,361 + 90,878 + 70,695 ms**. Each is below the 180,000 ms per-review goal-credit cap. Session endings counted the single exercise completed in that session; the daily ring accumulated all three sessions. This checks the exercised subset of the backlog, not every pre-existing due item. I did not test a long missed-day interval, a bonus lap, or the full daily new-exercise limit.

## Where the minutes went

Only review time and explicitly instrumented waits support exact durations. Reading/writing was not continuously timed; inventing minute totals from tool execution would count test administration as learning. The categories below overlap: AI waits can fall inside review time. No new source was added on any day.

| Day | Review | Reading/writing | Adding sources | Waiting measured | Lost effort |
|---|---:|---|---:|---|---|
| 1 | 0 | One source, structured note, three links, annotations; duration unmetered | 0 | Home 1.581 s; paste 0.075 s | Clarified Esc versus Enter by reading code; duration unmetered |
| 2 | 0 | Skill recall, backlink, undo/redo, two block moves, failed-save recovery; unmetered | 0 | Skill open 0.315 s; save 0.323 s; drag action 0.013 s | No confirmed product-caused loss |
| 3 | 0 | Phone paragraph, to-do and link; unmetered | 0 | Home 1.091 s; control/tap actions 0.034 s | Two obstructed link attempts; one wrong-format recovery; duration unmetered |
| 4 | 3 min 0.934 s | Note-derived exercise/context and revised exercise inspection | 0 | AI requests 40.963 s, including a duplicate 8.525 s grade caused by tester navigation | Extra grade is excluded as product friction; context detour unmetered |
| 5 | 0 | Renames, archive, search and Tutor question; unmetered | 0 | Tutor requests 91.029 s; two link opens/search 0.757 s | 26.848 s corrective follow-up still produced no passage link; manual detour remained |

## Felt slow

The exact request waits, slowest first:

| Wait | Day | Action | What the screen showed |
|---:|---:|---|---|
| 64.181 s | 5 | Ask about named archived source | Reading your sources; later “A reply takes about 10 seconds” |
| 26.848 s | 5 | Ask for missing clickable citation | Reply pending, then manual instructions instead of citation |
| 13.575 s | 4 | Make this exercise clearer | Pending Ask reply, then usable proposal with key points |
| 9.722 s | 4 | Grade HTTP troubleshooting answer | Checking your answer |
| 9.140 s | 4 | Grade DNS answer | Checking your answer; completed UI measured at 9.419 s |
| 8.525 s | 4 | Regrade DNS after tester navigation | Duplicate test action; not independently filed as a bug |
| 1.581 s | 1 | Mac Home usable | Initial navigation; blank duration not separately measured |
| 1.091 s | 3 | Phone Home usable | Initial navigation; blank duration not separately measured |

[Complete measured-wait ledger](felt-slow.md) includes all action measurements, observed upper bounds and **334 captured CLI request durations**, sorted slowest first. `requests.jsonl` retains their raw timings and responses. The long AI waits had visible progress; no blank-wait finding is asserted. The 100 ms input-response requirement cannot be inferred from a full request duration: e.g. Review appeared in 54 ms and rating controls in 114 ms while grading continued.

The chronological [friction log](log.md) is the source of the grouped findings above. No automated product tests or builds were run because this was a findings-only learner session.
