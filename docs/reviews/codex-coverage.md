# Codex coverage plan

Every angle a Codex test-and-fix pass can take on Ore, what has been covered and what is still open, so passes run in a loop down one list instead of picking afresh each time. Tyler, 2026-11-27: run passes continuously, three at a time, to make Ore's foundation as robust as possible.

`sweeps.md` is the log (one row per tester, what each found). This file is the plan: one row per angle, and the queue the next pass takes from. `findings.md` holds every bug.

## How the loop runs
1. The coordinator starts one thread per angle, at most three at once, taking the top row of **Queue** that is not running. A thread that finishes is replaced by the next row.
2. The thread writes its prompts in `docs/reviews/<date>-<angle>/` (borrow the shape of the last pass of its kind: `2026-11-25-codex-deep-scan-5/` for reading scouts, `2026-11-26-simulated-learner-3x/` for learners in the app), reads `findings.md` first, and runs the testers on Tyler's Mac.
3. Codex scouts and may draft fixes; Claude QAs every fix and picks the best long-term one, runs `/code-review` on the merged whole, and merges once CI is green (`docs/WORKFLOW.md`). A bug fix starts with its failing test.
4. In the PR that merges the pass: a row per tester in `sweeps.md`, a row per bug in `findings.md`, and this file updated (the angle's Status, its runs, and the Queue).

Rules every pass keeps:
- **Mac load:** `apps/desktop/scripts/mac-load.sh check` before starting; at most three Codex testers across all threads, started two minutes apart (#557); a big-library run goes alone; `clean <worktree>` after. With the app's AI on Codex, each grade and draft is a `codex exec` that counts as a tester (F746).
- **Codex runs outside its sandbox** only on Tyler's typed yes in that thread itself.
- **Every pass goes through the screens and logs what using them was like** (Tyler, 2026-11-27: "is codex using the UI in its tests still? would want to make sure we're optimizing ui/ux along the way"; the passes of that week ran scripts below the screens). Whatever its angle, a pass reaches what it tests through the app at least once where a screen shows it: the Mac screens and the phone build in WebKit on the mock (in the cloud: `bunx playwright install webkit && bunx playwright install-deps webkit` from `apps/desktop`; WebKit crashes at launch on his Mac), and the installed app's own window through computer use in the background (grant `com.tylerpoelking.ore` by its bundle id, since the name "Ore" resolves to the phone app; reading only while it is on ~/Ore). On the way it writes a `findings.md` row for each UX miss it meets, not only each bug: more presses than the app Ore copies there, a wait that shows nothing, a Mac or iPhone convention missing, a thing the Mac does that the iPhone doesn't, an element with no purpose (the purpose rule), wording that isn't the app's own. A plain miss is fixed in the pass, test first; a taste call is a `Tyler:` row with two or three options, one element at a time. Its `sweeps.md` row counts UX misses beside bugs. Reopen this if three passes in a row log no UX row: then UX gets its own passes again and the others go back to scripts.
- **Count only real bugs:** a red script or a reproduced step for each, as deep scan 1 asked. Mock-only drops are suspect (F329, F330).
- **OpenAI's filter refuses hostile-content prompts** (deep scan 5, untrusted). Angles marked *Claude lane* run as Claude passes, not Codex.

Status: **done** (a pass covered it and nothing points back), **partly** (covered by reading only, on a small seed, or before big changes), **open** (no pass yet), **running**.

## Queue
Ranked by what it does for the foundation: data that can't be lost, imports that come in whole (D122), and a test suite CI can trust. Rewrite this list when a pass lands.

1. **running** Learners over days (the "Run another Codex learner pass" thread: asker, importer, returner, real clock).
2. **Burn down the open rows.** About twenty `open` rows in `findings.md` need no call from Tyler (F1, F2, F3, F6, F13, F294, F421, F538, F547, F548, F660, F662, F684, F727, F729, F737 among them). Reading scouts write a red script for each, Codex drafts a fix, Claude QAs. The bugs are already known, so every hour goes to fixing.
3. **done (#564)** Flaky tests are races. Causes found for F142, F347, F348, F397, F516, F575 and a new one in the corners journey (F751); each failing journey now prints the `ore` calls in flight. Still open: F515, F623, F651 (not reproduced under load), F349 and F748 (need Tyler's Mac), and the new office-03 "error: undefined" (F752). A pass on the Mac takes the last two.
4. **done** Mac and iPhone writing at once ([two devices 11-27](2026-11-27-two-devices/), Claude in the cloud: both apps on one folder; 2 fixed). Left: real iCloud between his two devices, below.
5. **done (#567)** Import at real breadth, deep (D122): 86 live pages, 357 Office files, 12 notebooks, 38 EPUBs, 26 PDFs and 31 media links, each read against its original. 26 bugs fixed test first; a scanned page among text pages (F790) left to the learner pass's scanned-PDF fix. Not yet run: PDFs with the page reader downloaded, and listening to what was transcribed. Leads: script-drawn figures (ciechanow.ski), Distill's hidden formula cache, an arXiv margin stamp left in a PDF's text, Speaker Deck just under its word floor, CSS-drawn fractions (mathsisfun), a book's language never saved.
6. **Upgrade from an older library, rich.** Sweep 9 found nothing on a small seed with no media, PDF or chats. Redo with a copy of ~/Ore as written by a commit from 11-10, 11-17 and 11-24.
7. **partly (11-27, Claude, computer use in the background)** **The real Mac window.** The menu bar was read on the installed app for the first time: its items were the shortcut sheet's sentences (fixed, F756), and three items don't say their state (F757, open). An "Ore Debug" copy on a scratch library then found that a command chosen from the menu bar ran without end (F801, fixed #576). In the background, computer use types unreliably into the page (13 letters sent, 6 arrived) and can't press a system-wide shortcut or drag from another app, so the rest needed the window in front, with Tyler's screen for twenty minutes: ⌘Q lost a note and a guess typed just before it (F15 and F803, fixed #576: the quit never told the pages), a drag from Finder and the quick quiz's global shortcut worked. Still to do in the "Ore Debug" copy (`scripts/mock/README.md`): open at login (needs his yes, it changes a login item), the updater relaunching it, drag and paste from Safari, Preview and Notes, and the Dock's Quit, which still skips the save.
8. **done (#570)** What merged since the last pass (#542 to #566), read by Claude in the cloud: three bugs fixed test first (a lock's boot read from a clock that stops in sleep, a wrong `jobs:` in skills.yaml blanking every screen, Ask about this missing from usage.jsonl). Left for their own passes: Ore Cloud's server (queue 15, Claude lane), Vega charts on a hostile page (queue 14), the end screen's sounds by ear. Next time, start from the last commit this row names: f9bfe6d.
9. **done (#578)** Recover from the library's git history ([history recovery 11-27](2026-11-27-history-recovery/)): three Codex reading scouts on the Mac, then Claude through the screens in the cloud (a note, a highlight, a whole day restored with the app open). 13 found, 11 fixed test first: a snapshot committing a restore's conflict marks or onto a detached checkout, two snapshots at once (F643 by another road), session end failing with no git, a cut's Undo doubling restored text, a rolled-back session still open, ⌘Z writing an older note or importance over a restore and sticking on a step that can never apply, and no recipe for agents (now in AGENTS.md and `/ore`). Left: an open Review doesn't rebuild after its day is rolled back, and existing libraries never get a newer AGENTS.md.
10. **A day-long soak.** The Mac open eight hours with background enrichment, many adds, timers: memory growth, stale screens, the midnight turn.
11. **A11y recheck.** VoiceOver and keyboard only over the whole loop. The last full pass was 11-15; most screens changed since.
12. **New learners.** An exam crammer (deadline, a big new batch, Importance), a language learner (vocabulary, audio, another script), a researcher with fifty papers. Each a five-day run with real AI.
13. **done (#580)** **CLI and `/ore` skill recheck** ([11-28](2026-11-28-codex-cli-recheck/), three Codex reading scouts on the Mac, Codex drafted the fixes, Claude reviewed): 24 found, 24 fixed test first. Worst: the /ore skill's heredoc let a line of his answer run as a command; failed commands that still wrote (a highlight moved, a course renamed, the AI switched); undo of a cut, a reimport and an accepted skill that put back the wrong thing; `ore doctor` blind to broken chats, inbox entries, variants and images. Through the screens: Review stuck on an exercise an agent retired mid-review (fixed). Left open: a reimport's Undo doesn't re-anchor highlights made on the newer text. Not covered: the CLI with real AI (every run stubbed it), and two agents at once on one library.
14. *Claude lane:* **Hostile content** in sources and feeds (scripts, paths, commands, huge files), which Codex refused.
15. **done (#572)** *Claude lane:* **Ore Cloud security.** Sign-in, sessions, account deletion and the private-address guard held; four bugs fixed (a zip bomb, an import that could take the server down, no import limits, yt-dlp past the guard), one wording row open. Still open, each needing the server online or Tyler: Apple tokens revoked on delete (his .p8 key, #551), IPv6 egress if the host gets it (the firewall in #571 covers IPv4), and a pass on the live server once #550 deploys it.
16. **done (#591)** **An import corpus per type** (Tyler, 2026-11-28: "we need a way bigger test suite of different sources per source type"): `bun run corpus` (`packages/core/corpus/README.md`) imports every file in a list or folder, audits each doc.md against its original read from its own bytes, and reports what changed since the accepted run. Run on his Mac over copies of ~/Calibre Library, his iCloud library and Downloads (184 EPUBs, his PDFs and Office files, read only, results kept in `.corpus/`), and in the cloud over 47 openly licensed files (`open.json`, baseline in the repo). 7 bugs fixed test first (no outline in 29 of 184 books, note backlinks kept as text, figure captions as headings, sort-form and "Unknown" authors, publishers' stamps on every PDF page and id titles, Excel character codes, notebook pictures dropped). Not yet in the corpus: web pages, YouTube, podcasts and audio, feeds, chats (live, so `intake:live` covers them), scans with the page reader. Leads left: calibre's PDF-made EPUBs with a paragraph per line, a PDF's U+FFFD letters, "Downloaded by" lines a few publishers vary, no outline in ten papers, a PLOS running head joined to a heading, a figure's word labels read as text (the Transformer paper), an author block taken as a heading (NIST).

## Angles

### Learners (real use, days in a row)
| Angle | Status | Runs |
|---|---|---|
| Tyler's own day on a copy of ~/Ore, real AI | done | rehearsal 11-15, learner 11-25 owner, 3× 11-26 owner |
| Short bursts on the phone, backgrounded, a missed day | done | learner 11-25 and 11-26 commuter |
| First week from an empty library | done | sweep 4 firstrun, learner 11-25 and 11-26 newcomer |
| Every wait timed on his real library | done | learner 11-25 stopwatch (F737 open) |
| Days that really move (due dates, new-exercise limit, a missed day) | running | learner days (asker, importer, returner), after F739 |
| Months in minutes | done | sweep 10 months |
| Exam crammer, language learner, researcher with fifty papers | open | queue 12 |

### Import (D122: every type comes in whole)
| Angle | Status | Runs |
|---|---|---|
| Web articles | done | sweep 2 intake, sweep 3 hostile, newcomer runs |
| Web at breadth: fifty live sites | done | deep import 11-27 (86 live pages, 4 fixed); left: script-drawn figures, Distill's hidden formula cache, course pages' navigation |
| YouTube and other video | done | sweep 5 media, ux 7, ux 13, deep import 11-27 media (19 videos word by word; 4 fixed) |
| Podcasts and audio, recordings | done | sweep 5 media, deep scan 2 media (recording in the learner pass) |
| PDF papers | done | deep scan 2 media, newcomer 11-26 (BERT) |
| Long textbooks, scans, the page reader | partly | deep import 11-27 PDFs (26 files, 5,131 pages; 7 fixed); with the page reader downloaded: not yet run; a scanned page among text pages: F790 |
| EPUB books | done | deep import 11-27 books (38 books, his Calibre library; 7 fixed); import corpus 11-28 (184 of his books, 16 open ones; 4 fixed); left: real DRM, layout by sight |
| Word, RTF, PowerPoint, Excel, notebooks, Markdown, screenshots | done | deep scan 5 office (reading only); deep import 11-27 (357 real Office files, 12 notebooks; 3 fixed) |
| Shared AI chats | done | deep scan 2 chat |
| Feeds and newsletters | done | sweep 11, deep scan 5 feeds |
| Courses and playlists | partly | deep scan 5 courses (reading only), ux 8 |
| Other scripts (CJK, RTL, Thai) | done | sweep 4 languages (F285 open) |
| Reimport and anchoring | done | sweep 8, deep scan 1 intake, deep scan 5 original |
| Many files per type, each against its original (`bun run corpus`) | done | import corpus 11-28 (queue 16): books, PDFs, Office, notebooks; web, media, feeds and chats not yet in it |
| Ore Cloud's server import against the Mac's | open | queue 8 |

### Screens and journeys
| Angle | Status | Runs |
|---|---|---|
| Home, lists, sidebar, All sources | done | ux 1 to 18, sweep 6 organize, deep scan 4 refactors |
| Reader and highlights | done | sweep 7, ux 3, deep scan 4 refactors |
| Notes and the editor | done | sweep 5 notes, deep scan 3 library, deep scan 5 editor |
| Diagrams | done | diagram sweeps d1 to d6, deep scan 5 editor |
| Review, the session and its undo | done | many; deep scan 3 engine, deep scan 4 refactors |
| Exercises: making, fixing, Forge, Dig | done | sweep 6 exercises, ux 8 |
| Tutor chat | done | sweep 5 tutor, deep scan 2 chat |
| Ask your library | running | deep scan 2 chat; on his real library: learner days asker |
| Search and ⌘K | done | deep scan 2 chat, ux 9 |
| Settings, every setting mid-use | partly | sweep 4 settings; AI per job (#560) read in the merged-since pass 11-27 |
| End screen, ring, sounds, mole voice | partly | ux rounds by sight; sounds and voice never checked: queue 8 |
| Finish a source | done | ux 17 (F538 open) |
| Quick quiz window | partly | deep scan 5 shell (reading); real window: queue 7 |

### UX (what using it is like; every pass adds to these)
| Angle | Status | Runs |
|---|---|---|
| The core loop by hand in WebKit: add, read, highlight, review, end | partly | ux 1 to 18 (Codex, Chromium and WebKit); ux real UI 11-27 (Mac and iPhone, a walk: F758) |
| Mac conventions in the installed app: menu bar, window, shortcuts | partly | ux real UI 11-27 (menu bar read); the rest: queue 7 |
| iPhone against the Mac, screen by screen | partly | release loop s1 to s5, native scout 11-19, ux real UI 11-27 (Today, Add, a source); a gap is a fix, not a question (Tyler 11-22) |
| Presses and waits counted per task against the reference app | open | no pass has counted; the stopwatch learner timed waits only |
| The purpose rule, element by element | partly | design critique rounds to 11-23; screens added since unchecked |

### Platform
| Angle | Status | Runs |
|---|---|---|
| Release build under its CSP in WebKit | done | release loop 11-11 |
| iPhone build at 390 pt with touch | done | release loop, s1 to s5, ux rounds |
| iPhone in the real Simulator, next to Apple's apps | done | codex phone 11-12, native scout 11-19 |
| The real Mac window (menus, shortcuts, ⌘Q, updater) | partly | ux real UI 11-27 (menu bar); ⌘Q, shortcuts, updater: queue 7 (F15 open since 11-11) |
| Drag and paste from other apps | open | queue 7 |
| Mac and iPhone writing at once | done | deep scan 1 data, deep scan 4 edges (files only), [two devices 11-27](2026-11-27-two-devices/) (both apps on one folder; `e2e/journeys/two-devices.ts` keeps it) |
| Real iCloud between his Mac and iPhone (its delay, conflict versions) | open | needs his two devices, not a Codex pass |
| Upgrade from an older library | partly | sweep 9 (small seed): queue 6 |

### Data integrity
| Angle | Status | Runs |
|---|---|---|
| Writes killed, refused or raced | done | sweep 4 durability, deep scan 4 edges (300 trials) |
| Review replay, frontmatter round-trips, the index rebuilt | done | deep scan 1 data, deep scan 3 engine |
| Library changed outside the app | done | sweep 2 outside |
| iCloud conflict copies | done | deep scan 4 edges, deep scan 5 phone |
| Recovery from the library's git history | done | history recovery 11-27 (#578): a note, a source, a whole day; open Review after a roll-back (F825) left |

### AI
| Angle | Status | Runs |
|---|---|---|
| Slow, missing or failing AI | done | sweep 2 ai, deep scan 3 engine |
| Codex against Claude, switches mid-job, stamps (D21) | done | deep scan 5 aivendor |
| An AI per job | partly | merged-since pass 11-27 (reading; F754) |
| Real AI on real sources | done | learner runs 11-25 and 11-26 |
| Exercise and grading quality | eval, not a pass | `bun run eval:questions`, `eval:grade` |

### Failure, load, access
| Angle | Status | Runs |
|---|---|---|
| Offline and bad network | done | s4b (phone), sweep 11 (Mac) |
| Time: midnight, zones, DST, a clock set back | done | sweep 2 time, deep scan 3 engine |
| Ten times the library | done | sweep 4 scale (F293, F294 open) |
| What one action reads and writes at 950 sources | done | deep scan 5 perf |
| A day-long soak, memory growth | partly | deep scan 5 soak (stale screens only): queue 10 |
| VoiceOver and keyboard only | partly | sweep 3 a11y, 11-13 pass, deep scan 5 keys: queue 11 |
| Light, dark, sizes, zoom, reduced motion | done | sweep 6 looks |
| Hostile content | partly | sweep 3 hostile; Codex refused the deep version: queue 14, Claude lane |
| Ore Cloud security | partly | security pass 11-27 (#572), reading and local tests; the live server once it is up (#550) |

### The suite and the backlog
| Angle | Status | Runs |
|---|---|---|
| Tests missing for recent merges | partly | test-gap hunt 11-13 |
| Flaky tests traced to their cause | partly | flaky pass 11-27 (#564): 6 of 11 traced; F349 and F748 need the Mac |
| Open rows that need no call from Tyler | open | queue 2 |
| The `ore` CLI and `/ore` skill as an agent uses them | done | sweep 3 cli, deep scan 3 library, [CLI recheck 11-28](2026-11-28-codex-cli-recheck/) (#580) |
