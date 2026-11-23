# Sweeps

Every outside-tester sweep (Codex or ChatGPT) Ore has run, one row per tester, with what each angle found.
Read it before you write a sweep's prompts: pick angles nobody has taken, and borrow the shape of the ones that paid off.
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

Not counted here: the 2026-11-01 bug sweep and the 2026-11-08 stress test (Claude testers), the Impeccable design rounds, and rows found by Claude threads or Tyler.

## Ground not yet covered

Ranked by likely yield.

1. **The real Tauri window.** Native menu bar, ⌘Q with drafts open, the quick quiz's global shortcut and menu bar item, reminders firing, open at login. Every tester so far drove a browser page. F15 has been open since 11-11, and these are the paths that run on his Mac every day.
2. ~~**Highlighting at its limits.**~~ Taken by sweep 7. Overlapping highlights, and highlights across headings, tables, math, images, code, transcripts and the PDF view. Sweep 6 found two WebKit page crashes from overlapping paint layers (F331, F339), and that kind of crash rarely comes alone.
3. ~~**Reimport and anchoring, for every source type.**~~ Taken by sweep 8. A better reader re-imports a source that already has highlights, notes and exercises (D122 keeps the original for this). Anchoring is a core rule, and only the lifecycle tester touched it, with one changed page.
4. ~~**A library from an older Ore.**~~ Taken by sweep 9. Open a library written by an earlier commit: old frontmatter, card files, review logs, skills.yaml. Nobody has tested an upgrade, and his ~/Ore is weeks of formats deep.
5. ~~**Months of use in a few minutes.**~~ Taken by sweep 10. Run 60–90 simulated days of sessions with `page.clock`: queue order (D22, D24), new exercises a day, the backlog that never empties, levels, the end screen. The time tester only jumped days. The numbers tester checked one moment.
6. **Mac and iPhone writing at once.** Both apps on one iCloud folder at the same time: per-device review logs, note merges, an archive on one device while the source is open on the other. The outside tester only simulated a second device through files.
7. **The kept original.** OriginalPage and OriginalSlides for PDFs, slides and pages, against what doc.md shows, plus Reimport from it. No prompt has aimed at this surface.
8. **A day-long soak.** The Mac left open a whole working day, with background enrichment, many adds, timers, stale screens and memory growth. "Mac left open overnight" was the normal case behind sweep 2's midnight bug.
9. **Drag and paste from other apps.** Finder files, Safari links and images, Preview pages and Notes text, dropped or pasted into Add, notes and the reader. The pointer tester stayed inside Ore.
10. ~~**The Feed over weeks.**~~ Taken by sweep 11. Feeds that change, vanish, return malformed or double up, many followed feeds, and posts kept versus left. The Feed has only been reached in passing, yet it has produced bugs every time (F143, F144, F303).
11. **The other AI vendor and model switches.** `ai: codex` against `claude`, and a model changed mid-enrichment or mid-grade. Check the vendor, model and prompt version stamps on every write. The ai tester used the mock, and two of its "mock-only" drops turned out real.
12. ~~**Mac offline or on a bad network.**~~ Taken by sweep 11. Imports, the tutor, grading and Feed refresh while offline, on a captive portal or very slow, then back online. s4b did this on the phone only.
13. **Courses and playlists end to end.** Filing, lessons, next lesson and progress on both devices. s1 iPhone left the next lesson untested, and lifecycle and organize only touched courses.
14. **Ask your library at real scale.** Retrieval and citations over 950 sources (`ORE_SEED_SCALE=4`, which sweep 6's prompt missed): wrong-source citations, misses, waits.
15. **Recovering from the library's own git history.** Restore a source, note or day from the snapshots and see what each screen shows afterwards. No one has tested it.

## What paid off

- **Angles that check a written contract found the most:** cli 10, settings mid-use 8, languages 8, a11y 8 (and 7 more in the 11-13 pass), intake 7. Each had a rule to break: exit codes, "every setting reaches open screens", D122, WCAG.
- **A first sweep on a new platform or harness finds a lot, then confirm rounds fade:** iPhone release loop 11, then 5, 3, 1. The 11-09 loop went 6, then down to 0. s4a found 7 on the phone's first edge pass.
- **Real tasks beat checklists:** diagram tasks (d2) found 5 where the 80-item checklist (d1) found 2. The six UX-parity checklists averaged under 2, with reader 0 and lists 0.
- **Walk-throughs find little:** persona 1, daily 2, looks 1, rehearsal 3 + 1. The rehearsal on his real library still found bugs a seed never shows (F194, F195).
- **Mock limits hide real bugs:** sweep 2 dropped empty AI replies as mock-only, and sweep 6 showed both were real (F329, F330). Prefer real AI or real-shaped faults over the mock's nulls.
