# Sweeps

Every outside-tester sweep (Codex or ChatGPT) Ore has run, one row per tester, with what each angle found.
Read it before you write a sweep's prompts: take the next angle from [codex-coverage.md](codex-coverage.md), and borrow the shape of the ones that paid off.
When a sweep's triage is done, add a row per tester here.

"Real bugs" counts only what a triage or a `findings.md` row confirms: no "not a bug", Tyler's calls or mock artefacts. Paths are relative to `docs/reviews/`.

| Date | Sweep | Tester | Angle | Mac/iPhone | Real bugs | Fixed in |
|---|---|---|---|---|---|---|
| 11-09 | [codex sweep loop](2026-11-09-codex-sweeps.md) | Codex, rounds 1–10 | General bug hunt on the mock: undo, failed and slow writes, focus. Each round retested the last | Mac | 30 (6, 3, 6, 4, 4, 2, 2, 2, 1, 0) | #215 |
| 11-10 | [UX parity](2026-11-10-codex-ux/) chat | Codex | Checklist against ChatGPT, Claude and Notion AI | Mac | 3 (+1 for Tyler, built later) | #237 |
| 11-10 | [UX parity](2026-11-10-codex-ux/notes.md) notes | Codex | Checklist against Notion | Mac | 1 | #238 |
| 11-10 | [UX parity](2026-11-10-codex-ux/review.md) review | Codex | Checklist against Anki and Mochi | Mac | 1 (+1 for Tyler) | #243 |
| 11-10 | [UX parity](2026-11-10-codex-ux/reader-lists.md) reader | Codex | Checklist against Readwise, Books, YouTube | Mac | 0 | #245 (record only) |
| 11-10 | [UX parity](2026-11-10-codex-ux/reader-lists.md) lists | Codex | Checklist against Linear, Raindrop, Finder. Thin: it read "covered" as "skip" | Mac | 0 (3 for Tyler) | — |
| 11-10 | [UX parity](2026-11-10-codex-ux/lists2.md) lists rerun | Codex | Same checklist on every list, big seed, Feed posts | Mac | 5 (+2 for Tyler) | #250 |
| 11-11 | [release loop](2026-11-11-codex-release-loop.md) rehearsal | Codex | Tyler's 10-minute Review on the release build, real AI, a copy of ~/Ore | Mac | 4 | #256 |
| 11-11 | [release loop](2026-11-11-codex-release-loop.md) sweeps 1–4, Mac | Codex | Installed-app conditions: release CSP, WebKit, compiled `ore` | Mac | 3 (1, 2, 0) | #258, #266, #274 |
| 11-11 | [release loop](2026-11-11-codex-release-loop.md) sweeps 1–4, iPhone | Codex | Phone build at 390 pt with real taps, plus the Simulator by hand | iPhone | 20 (11, 5, 3, 1) | #258, #266 |
| 11-11 | [diagram sweeps](2026-11-11-diagram-sweeps/) d1 | Codex | 80-item checklist against Excalidraw | Mac | 2 | #268 |
| 11-11 | [diagram sweeps](2026-11-11-diagram-sweeps/) d2 | Codex | Seven real study tasks in the diagram editor | Mac | 5 | #268, #276 |
| 11-11 | [diagram sweeps](2026-11-11-diagram-sweeps/) d3–d6 | Codex | Confirm the fixes, then save, reopen, edit again | Mac | 8 (5, 2, 1, 0) | #279, #280 |
| 11-12 | [codex phone](2026-11-12-codex-phone/) | Codex | First run in the real iOS Simulator: four people's journeys | iPhone | 2 | #288 |
| 11-12 | [codex sweeps](2026-11-12-codex-sweeps/) s1 desktop | Codex | New menus, type-select, picks, as five study tasks | Mac | 5 | #322 |
| 11-12 | [codex sweeps](2026-11-12-codex-sweeps/) s1 iPhone | Codex | Reading, the share card, skill page, Settings, as tasks | iPhone | 4 | #324 |
| 11-12 | [codex sweeps](2026-11-12-codex-sweeps/) s2 desktop | Codex | Confirm s1, a 10-minute session, read and find, tend a skill | Mac | 2 | #326 |
| 11-12 | [codex sweeps](2026-11-12-codex-sweeps/) s2 iPhone | Codex | Confirm s1, hold to act, review on the bus, search | iPhone | 3 (+1 seen once, F49) | #326 |
| 11-13 | [codex sweeps](2026-11-12-codex-sweeps/s3-desktop-prompt.md) s3 desktop | Codex | Confirm s2, a backlog session, adding sources, notes, held writes | Mac | 7 (F55, F56, F143–F147) | #340, #349, #393 |
| 11-13 | [codex sweeps](2026-11-12-codex-sweeps/s3-phone-prompt.md) s3 iPhone | Codex | Confirm s2 on the phone | iPhone | 3 (F53, F54, F57) | #340 |
| 11-13 | [phone edges](2026-11-13-codex-phone-edges/) s4a | Codex | Data at its extremes: empty, big, long text, largest text size, smallest phone | iPhone | 7 (F68–F75, one open) | #350, #358 |
| 11-13 | [phone edges](2026-11-13-codex-phone-edges/) s4b | Codex | Interruptions: offline, cut imports, quitting mid-task, rotation, double taps | iPhone | 4 (+1 shared with s4a) | #350 |
| 11-13 | [phone sizing](2026-11-13-codex-phone-sizing/) s5 | Codex | Every phone screen after the iPhone sizes and two-line titles | iPhone | 4 (F98–F101, one in the docs) | #374, #378 |
| 11-13 | findings F110–F119 | Codex accessibility pass | VoiceOver, contrast, focus | Mac | 7 (+2 found while verifying, +1 for Tyler) | #384 |
| 11-13 | findings F106–F109 | Codex test-gap hunt | Tests missing for the day's merges; tests that reach the network | code | 4 (1 in the app, 3 in tests) | #385 |
| 11-13 | findings F122–F124 | Codex import-gap job | Open gap cells in the intake grid | core | 3 | #386 |
| 11-13 | findings F93–F97 | Codex demo sweep | The release build in WebKit as a product-video demo | Mac | 4 (one in tooling) | #376, #379, #381 |
| 11-13 | findings F125–F127 | Codex filming rehearsal r2 | Rehearsing the product video on the demo library | Mac | 3 (two in the demo seed) | #383 |
| 11-13 | [architecture](2026-11-13-architecture.md) | Codex | Architecture deep read, report only | code | 0 (proposals) | — |
| 11-14 | [ad hoc](2026-11-14-codex-adhoc/) daily | Codex | One real day, start to finish, seeded library, AI off | both | 2 | #404 |
| 11-14 | [ad hoc](2026-11-14-codex-adhoc/) edge | Codex | Edge cases on the everyday surfaces | both | 4 | #404 |
| 11-14 | [ad hoc](2026-11-14-codex-adhoc/) persona | Codex | Five learners with their own goals | both | 1 | #404 |
| 11-14 | [sweep 2](2026-11-14-codex-sweep-2/) outside | Codex | Library changed outside the app: CLI, Finder, iCloud, a second device | Mac | 4 | #406 |
| 11-14 | [sweep 2](2026-11-14-codex-sweep-2/) time | Codex | Days away, midnight, time zones, a clock set back | both | 4 | #406 |
| 11-14 | [sweep 2](2026-11-14-codex-sweep-2/) intake | Codex | Unusual files and links through Add | Mac | 7 | #406, #407, #411 |
| 11-14 | [sweep 2](2026-11-14-codex-sweep-2/) ai | Codex | AI that is slow, missing or fails | Mac | 2 (2 dropped as mock-only, later real: F329, F330) | #406 |
| 11-15 | [sweep 3](2026-11-15-codex-sweep-3/) hostile | Codex | Hostile and odd content: scripts, links, names, sizes | both | 5 | #424 |
| 11-15 | [sweep 3](2026-11-15-codex-sweep-3/) numbers | Codex | Every count, level and date shown is true | both | 3 | #424 |
| 11-15 | [sweep 3](2026-11-15-codex-sweep-3/) cli | Codex | `ore` and the `/ore` skill as an agent uses them | CLI | 10 | #423 |
| 11-15 | [sweep 3](2026-11-15-codex-sweep-3/) lifecycle | Codex | Archive, restore, delete, merge, rename, and what hangs off each | both | 3 | #424 |
| 11-15 | [sweep 3](2026-11-15-codex-sweep-3/) a11y | Codex | VoiceOver and keyboard only, the whole loop | both | 8 (+2 for Tyler) | #424 |
| 11-15 | [sweep 4](2026-11-15-codex-sweep-4/) firstrun | Codex | The first week from an empty library | both | 3 | #429 |
| 11-15 | [sweep 4](2026-11-15-codex-sweep-4/) scale | Codex | A library ten times today's | both | 3 (2 open) | #430 |
| 11-15 | [sweep 4](2026-11-15-codex-sweep-4/) durability | Codex | Writes that are killed, refused or raced | both | 3 | #430 |
| 11-15 | [sweep 4](2026-11-15-codex-sweep-4/) settings | Codex | Every setting, changed mid-use | both | 8 (+1 for Tyler) | #429 |
| 11-15 | [sweep 4](2026-11-15-codex-sweep-4/) languages | Codex | Reading and reviewing in other scripts | both | 8 (1 open) | #430 |
| 11-15 | [rehearsal](2026-11-15-rehearsal/) mac | Codex | His real daily path on a copy of ~/Ore with real AI | Mac | 3 (+1 rule change, D279) | #415 |
| 11-15 | [rehearsal](2026-11-15-rehearsal/) phone | Codex | His real daily path on the phone | iPhone | 1 | #415 |
| 11-15 | [sweep 5](2026-11-15-codex-sweep-5/) fresh | Codex | What shipped in the last four days | both | 3 | #434 |
| 11-15 | [sweep 5](2026-11-15-codex-sweep-5/) pointer | Codex | The whole loop by mouse and trackpad only | both | 4 | #434 |
| 11-15 | [sweep 5](2026-11-15-codex-sweep-5/) notes | Codex | Notes as he writes them, and what reaches the disk | both | 4 | #436 |
| 11-15 | [sweep 5](2026-11-15-codex-sweep-5/) media | Codex | Videos, podcasts and recordings | both | 2 | #436 |
| 11-15 | [sweep 5](2026-11-15-codex-sweep-5/) tutor | Codex | The rebuilt tutor chat, faked replies | both | 5 (+3 from the PR's review) | #437 |
| 11-15 | [sweep 6](2026-11-15-codex-sweep-6/) today | Codex | What merged today: iPhone reading, Aa sheet, edge carry, round 6 | both | 3 | #440 |
| 11-15 | [sweep 6](2026-11-15-codex-sweep-6/) exercises | Codex | Making, fixing and keeping exercises and their history | both | 3 | #440 |
| 11-15 | [sweep 6](2026-11-15-codex-sweep-6/) looks | Codex | Light and dark, window sizes, zoom, reduced motion, contrast | both | 1 | #440 |
| 11-15 | [sweep 6](2026-11-15-codex-sweep-6/) organize | Codex | Finding and organizing a big library (238 sources, not 950) | both | 4 (+9 from #440's review, F339–F347) | #440 |
| 11-15 | [sweep 7](2026-11-15-codex-sweep-7/) highlights | Codex | Highlighting at its limits: overlaps, formulas, code, tables, every source type | both | 4 (+3 of the same kinds the fix found) | #442 |
| 11-15 | [sweep 8](2026-11-15-codex-sweep-8/) reimport | Codex | Reimport a source that has highlights, notes, questions and exercises; the kept original changed | Mac | 3 | #443 |
| 11-15 | [sweep 9](2026-11-15-codex-sweep-8/) upgrade | Codex | A library written by Ore as of 11-06 (`aa6bc6f`), opened and used by today's | both | 0 (small seed: no media, PDF or chats) | — |
| 11-15 | [sweep 10](2026-11-15-codex-sweep-10/) months | Codex | 60–90 simulated days of sessions with `page.clock` | both | 1 | #443 |
| 11-15 | [sweep 11](2026-11-15-codex-sweep-10/) offline | Codex | The Feed over weeks; the Mac offline or on a bad network | both | 2 | #443 |
| 11-19 | [native scout](2026-11-19-phone-native-feel/) | Codex | How the iPhone app feels next to Apple's own apps (Settings, Files, Safari) in the Simulator: touch, keyboard, edges, type, controls | iPhone | 8 | #467 (keyboard) |
| 11-22 | [ux sweep](2026-11-22-codex-ux-sweep/) mac | Codex | Obvious mishaps a first-time Mac user hits in minutes, the last five days first | Mac | 4 | #492 |
| 11-22 | [ux sweep](2026-11-22-codex-ux-sweep/) phone | Codex | The same on the iPhone, 390×844 and 375×667 | iPhone | 3 | #492 |
| 11-22 | [ux sweep 2](2026-11-22-codex-ux-sweep-2/) mac | Codex | Round 2: notes, tutor, lists, sidebar and skill pages, keys | Mac | 3 | #493 |
| 11-22 | [ux sweep 2](2026-11-22-codex-ux-sweep-2/) phone | Codex | Round 2: notes, reader, skill pages, search, Settings | iPhone | 2 | #493 |
| 11-22 | [ux sweep 3](2026-11-22-codex-ux-sweep-3/) mac | Codex | Round 3: reading deeply, Feed, Review edges, Settings | Mac | 6 | #495 |
| 11-22 | [ux sweep 3](2026-11-22-codex-ux-sweep-3/) phone | Codex | Round 3: drawer, Review, reading, long-press menus | iPhone | 5 (1 open for Tyler) | #495 |
| 11-22 | [ux sweep 4](2026-11-22-codex-ux-sweep-4/) mac | Codex | Round 4: adding, lists, the source header, windows | Mac | 4 | #495 |
| 11-22 | [ux sweep 4](2026-11-22-codex-ux-sweep-4/) phone | Codex | Round 4: collection actions and a parity walk | iPhone | 6 (2 parity gaps next) | #495 |
| 11-22 | [ux sweep 5](2026-11-22-codex-ux-sweep-5/) mac | Codex | Round 5: a first hour, broad | Mac | 3 | #501 |
| 11-22 | [ux sweep 5](2026-11-22-codex-ux-sweep-5/) phone | Codex | Round 5: twenty minutes on the bus, broad | iPhone | 3 | #501 |
| 11-23 | [ux sweep 6](2026-11-23-codex-ux-sweep-6/) mac | Codex | Round 6: a first hour, broad, nothing slow | Mac | 1 | #502 |
| 11-23 | [ux sweep 6](2026-11-23-codex-ux-sweep-6/) phone | Codex | Round 6: the bus ride, broad | iPhone | 0 | — |
| 11-23 | [ux sweep 7](2026-11-23-codex-ux-sweep-7/) mac | Codex | Round 7: other content (book, video, PDF, Spanish) | Mac | 3 | #504 |
| 11-23 | [ux sweep 7](2026-11-23-codex-ux-sweep-7/) phone | Codex | Round 7: other content | iPhone | 3 | #504 |
| 11-23 | [ux sweep 8](2026-11-23-codex-ux-sweep-8/) mac | Codex | Round 8: features no round had used (courses, Feed, Ask, Dig, quick quiz, audio) | Mac | 1 (to an intake thread) | — |
| 11-23 | [ux sweep 8](2026-11-23-codex-ux-sweep-8/) phone | Codex | Round 8: the same on the iPhone | iPhone | 3 | #506 |
| 11-23 | [ux sweep 9](2026-11-23-codex-ux-sweep-9/) mac | Codex | Round 9: recheck, then the tutor's long chats, Archive, search, keyboard Review | Mac | 1 | #508 |
| 11-23 | [ux sweep 9](2026-11-23-codex-ux-sweep-9/) phone | Codex | Round 9: the same on the iPhone, notes that link sources | iPhone | 3 | #508 |
| 11-23 | [ux sweep 10](2026-11-23-codex-ux-sweep-10/) mac | Codex | Round 10: Academy lessons with video (#507), recheck | Mac | 3 | #509 |
| 11-23 | [ux sweep 10](2026-11-23-codex-ux-sweep-10/) phone | Codex | Round 10: Filter and Select (#500), recheck | iPhone | 1 | #509 |
| 11-23 | [ux sweep 11](2026-11-23-codex-ux-sweep-11/) mac | Codex | Round 11: recheck of round 10, fresh journeys | Mac | 2 | #510 |
| 11-23 | [ux sweep 11](2026-11-23-codex-ux-sweep-11/) phone | Codex | Round 11: recheck of round 10, fresh journeys | iPhone | 0 | — |
| 11-23 | [ux sweep 12](2026-11-23-codex-ux-sweep-12/) mac | Codex | Round 12: recheck of round 11, other source kinds | Mac | 1 | #511 |
| 11-23 | [ux sweep 12](2026-11-23-codex-ux-sweep-12/) phone | Codex | Round 12: recheck of round 11, audio, Forge, collections | iPhone | 0 | — |
| 11-23 | [ux sweep 13](2026-11-23-codex-ux-sweep-13/) mac | Codex | Round 13: recheck of round 12, subtitles, image, PDF, audio | Mac | 1 | #512 |
| 11-23 | [ux sweep 14](2026-11-23-codex-ux-sweep-14/) mac | Codex | Round 14: recheck of round 13, Feed, All sources, exercises, quick quiz | Mac | 1 | #513 |
| 11-23 | [ux sweep 15](2026-11-23-codex-ux-sweep-15/) mac | Codex | Round 15: typing behind panels and menus, new paths | Mac | 2 | #514 |
| 11-23 | [ux sweep 15](2026-11-23-codex-ux-sweep-15/) phone | Codex | Round 15: typing in sheets over a note, new paths | iPhone | 0 | — |
| 11-23 | [ux sweep 16](2026-11-23-codex-ux-sweep-16/) mac | Codex | Round 16: recheck of round 15, the typing guard everywhere, new paths | Mac | 1 | #515 |
| 11-23 | [ux sweep 17](2026-11-23-codex-ux-sweep-17/) mac | Codex | Round 17: recheck of round 16, delayed actions on a left screen | Mac | 1 | #516 |
| 11-23 | [ux sweep 18](2026-11-23-codex-ux-sweep-18/) mac | Codex | Round 18: recheck of round 17, note links, author edit, warm-up | Mac | 0 | — |
| 11-24 | [deep scan](2026-11-24-codex-deep-scan/) data | Codex, diagnosing-bugs loop | Below the screens: review replay fuzz, two devices on one library, the index rebuilt, frontmatter round-trips, git restore, AI stamps | both | 8 | #522 |
| 11-24 | [deep scan](2026-11-24-codex-deep-scan/) intake | Codex, diagnosing-bugs loop | Reimport and anchoring, the same input twice, refusals and killed imports, what doc.md claims, Mac vs phone imports | both | 8 | #522 |
| 11-24 | [deep scan 2](2026-11-24-codex-deep-scan-2/) chat | Codex, diagnosing-bugs loop | Tutor chats and their versions, Claude chat import, search and ⌘K, skills and Importance, end screen counts, phone search | both | 8 | #525 |
| 11-24 | [deep scan 2](2026-11-24-codex-deep-scan-2/) media | Codex, diagnosing-bugs loop | PDF reimport and background reread, diagrams, audio transcripts and podcast feeds, the phone's fs and rescan, F575/F577 | both | 6 + F577 | #525 |
| 11-24 | [deep scan 3](2026-11-24-codex-deep-scan-3/) engine | Codex, diagnosing-bugs loop | AI drafts, checks and remixes under races and bad replies, D21, queue and FSRS replay, Undo across devices, sessions over midnight, DST, stats | both | 8 | #526 |
| 11-24 | [deep scan 3](2026-11-24-codex-deep-scan-3/) library | Codex, diagnosing-bugs loop | Links and backlinks, the note editor's round-trips, cut and Undo, Feed previews, frontmatter and skills.yaml, CLI --json and init, Add edges, F575 | both | 11 | #526 |
| 11-25 | [deep scan 4](2026-11-25-codex-deep-scan-4/) refactors | Codex, diagnosing-bugs loop; Codex also drafted the fixes | The six refactors of #529–#537: change.ts, list-actions.ts, review-session.ts, highlights.ts, answer types; F618, F631 | both | 9 | #538 |
| 11-25 | [deep scan 4](2026-11-25-codex-deep-scan-4/) edges | Codex, diagnosing-bugs loop; Codex also drafted the fixes | Earlier scans' Leads, writes killed mid-way (300 trials), damaged index, iCloud conflict copies, a 30-day lifecycle, Ask at scale | both | 11 | #538 |
| 11-25 | [deep scan 5](2026-11-25-codex-deep-scan-5/) phone | Codex, diagnosing-bugs loop, code reading only; Codex also drafted the fixes | The iPhone's file layer, iCloud writes and rescans, waiting sources, Settings saves, the phone's lists | iPhone | 7 | #541 |
| 11-25 | [deep scan 5](2026-11-25-codex-deep-scan-5/) shell | Codex, diagnosing-bugs loop, code reading only; Codex also drafted the fixes | The Tauri shell: native menus, the quick quiz window, the auto-updater, shortcuts across windows | Mac | 4 (1 open, 1 partly) | #541 |
| 11-25 | [deep scan 5](2026-11-25-codex-deep-scan-5/) office | Codex, diagnosing-bugs loop, code reading only; Codex also drafted the fixes | Word, RTF, PowerPoint, Excel, notebooks, Markdown files and screenshots against D122 | both | 15 | #541 |
| 11-25 | [deep scan 5](2026-11-25-codex-deep-scan-5/) original | Codex, diagnosing-bugs loop, code reading only; Codex also drafted the fixes | The kept original: its bytes, the PDF and slide views against doc.md, Reimport from it, `ore doctor` | both | 8 (1 open) | #541 |
| 11-25 | [deep scan 5](2026-11-25-codex-deep-scan-5/) aivendor | Codex, diagnosing-bugs loop, code reading only; Codex also drafted the fixes | `ai: codex` against `claude`, switches mid-job, Stop, late replies, the stamp on every AI write | both | 8 | #541 |
| 11-25 | [deep scan 5](2026-11-25-codex-deep-scan-5/) editor | Codex, diagnosing-bugs loop, code reading only; Codex also drafted the fixes | The note editor's tables, paste, Turn into and equations; the diagram matrix; note links | Mac | 7 | #541 |
| 11-25 | [deep scan 5](2026-11-25-codex-deep-scan-5/) feeds | Codex, diagnosing-bugs loop, code reading only; Codex also drafted the fixes | Feed parsing (bases, encodings, ids, Atom), refresh races, Mark read and Undo, the waiting queue | Mac | 10 | #541 |
| 11-25 | [deep scan 5](2026-11-25-codex-deep-scan-5/) keys | Codex, diagnosing-bugs loop, code reading only; Codex also drafted the fixes | Shortcuts: input methods, clashes and Replace, modifiers in Review, held keys, the number pad | Mac | 5 | #541 |
| 11-25 | [deep scan 5](2026-11-25-codex-deep-scan-5/) courses | Codex, diagnosing-bugs loop, code reading only; Codex also drafted the fixes | Courses and playlists: adding again, filters, Archive, the Reader's lesson line, collections | both | 6 | #541 |
| 11-25 | [deep scan 5](2026-11-25-codex-deep-scan-5/) soak | Codex, diagnosing-bugs loop, in the app; Codex also drafted the fixes | The Mac left open: stale screens, late answers, coming back from other apps | Mac | 2 | #541 |
| 11-25 | [deep scan 5](2026-11-25-codex-deep-scan-5/) perf | Codex, diagnosing-bugs loop, in the app; Codex also drafted the fixes | What one action reads and writes at 950 sources; profiles of F293 and F294 | both | 3 (+ F293's cause; F294 open) | #541 |
| 11-25 | [deep scan 5](2026-11-25-codex-deep-scan-5/) untrusted | Codex | Hostile content in sources and feeds: refused by OpenAI's cyber filter before it ran, not reworded | both | not run | — |
| 11-25 | [simulated learner](2026-11-25-simulated-learner/) owner | Codex | Five days as Tyler on a copy of ~/Ore, real AI (on Codex), a friction log with measured waits | Mac | 2 | #542 |
| 11-25 | [simulated learner](2026-11-25-simulated-learner/) commuter | Codex | Five days of short bursts on the phone, backgrounded mid-exercise, a missed day | iPhone | 1 (+1 for Tyler) | #542 |
| 11-25 | [simulated learner](2026-11-25-simulated-learner/) newcomer | Codex | A first week from an empty library: a real article, video, arXiv PDF and Wikipedia page, real AI | Mac | 3 | #542 |
| 11-25 | [simulated learner](2026-11-25-simulated-learner/) stopwatch | Codex | Every wait in his day timed on his real library, three runs each, Mac and iPhone | both | 2 (open) | — |
| 11-26 | [simulated learner 3×](2026-11-26-simulated-learner-3x/) owner | Codex | The 11-25 owner again, three testers at once to measure the Mac's load | Mac | 2 | #544 |
| 11-26 | [simulated learner 3×](2026-11-26-simulated-learner-3x/) commuter | Codex | The 11-25 commuter again, at once with two others | iPhone | 1 | #544 |
| 11-26 | [simulated learner 3×](2026-11-26-simulated-learner-3x/) newcomer | Codex | A first day on a new subject (transformers): a Quarto article, a video, BERT's PDF, Wikipedia (refused, 429) | both | 3 (1 fixed, 2 open) | #544 |
| 11-27 | [upgrade, rich](2026-11-27-upgrade-rich/) | Claude (cloud, scripted) | Libraries written by Ore of 11-06, 11-10, 11-17 and 11-24 (15 file types, highlights, notes with links and a diagram, chats, cards, reviews), read, written and reimported by master's CLI, then every skill, source and a review in master's Mac and iPhone builds | both | 1 | #568 |

Not counted here: the 2026-11-01 bug sweep and the 2026-11-08 stress test (Claude testers), the Impeccable design rounds, and rows found by Claude threads or Tyler.

## Ground not yet covered

The angles still open, and the queue the next pass takes from, are in [codex-coverage.md](codex-coverage.md). Update it in the PR that merges a pass.

## What paid off

- **Angles that check a written contract found the most:** cli 10, settings mid-use 8, languages 8, a11y 8 (and 7 more in the 11-13 pass), intake 7. Each had a rule to break: exit codes, "every setting reaches open screens", D122, WCAG.
- **A first sweep on a new platform or harness finds a lot, then confirm rounds fade:** iPhone release loop 11, then 5, 3, 1. The 11-09 loop went 6, then down to 0. s4a found 7 on the phone's first edge pass.
- **Real tasks beat checklists:** diagram tasks (d2) found 5 where the 80-item checklist (d1) found 2. The six UX-parity checklists averaged under 2, with reader 0 and lists 0.
- **Walk-throughs find little:** persona 1, daily 2, looks 1, rehearsal 3 + 1. The rehearsal on his real library still found bugs a seed never shows (F194, F195).
- **A red script per finding, below the screens:** the 11-24 deep scan asked Codex for a reproducing script before a finding counted, and drove core and the CLI instead of pages. 16 of 16 were real, after eighteen UX rounds had ended clean.
- **Days in a row need one clock:** the 11-25 simulated learners moved days with `page.clock`, which moves the page and not the bridge's `ore`, so no second day's queue was ever checked. Until the bridge takes a date, a multi-day tester can only check what one day shows. Timing every wait on his real library (stopwatch) found what no bug hunt had: the two slow spots are both in his longest book.
- **Mock limits hide real bugs:** sweep 2 dropped empty AI replies as mock-only, and sweep 6 showed both were real (F329, F330). Prefer real AI or real-shaped faults over the mock's nulls.
