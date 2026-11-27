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
- **Count only real bugs:** a red script or a reproduced step for each, as deep scan 1 asked. Mock-only drops are suspect (F329, F330).
- **OpenAI's filter refuses hostile-content prompts** (deep scan 5, untrusted). Angles marked *Claude lane* run as Claude passes, not Codex.

Status: **done** (a pass covered it and nothing points back), **partly** (covered by reading only, on a small seed, or before big changes), **open** (no pass yet), **running**.

## Queue
Ranked by what it does for the foundation: data that can't be lost, imports that come in whole (D122), and a test suite CI can trust. Rewrite this list when a pass lands.

1. **running** Learners over days (the "Run another Codex learner pass" thread: asker, importer, returner, real clock).
2. **Burn down the open rows.** About twenty `open` rows in `findings.md` need no call from Tyler (F1, F2, F3, F6, F13, F294, F421, F538, F547, F548, F660, F662, F684, F727, F729, F737 among them). Reading scouts write a red script for each, Codex drafts a fix, Claude QAs. The bugs are already known, so every hour goes to fixing.
3. **done (#564)** Flaky tests are races. Causes found for F142, F347, F348, F397, F516, F575 and a new one in the corners journey (F751); each failing journey now prints the `ore` calls in flight. Still open: F515, F623, F651 (not reproduced under load), F349 and F748 (need Tyler's Mac), and the new office-03 "error: undefined" (F752). A pass on the Mac takes the last two.
4. **Mac and iPhone writing at once.** Both on one iCloud folder: a rating on each, a note edited on both, Archive on one while the source is open on the other, a conflict copy. Deep scan 1 and 4 did it below the screens; nobody has run both apps.
5. **Import at real breadth, deep (D122).** The running importer brings one file of each kind as a learner; start from its report and go deep: many files per type read against their source from start to end, EPUB books from his Calibre library, long textbooks, scans with and without the page reader downloaded (#494; refused with the next step when it is missing), and `bun run intake:live` over fifty popular sites. Fixtures for any bug are rewritten or openly licensed (D96).
6. **Upgrade from an older library, rich.** Sweep 9 found nothing on a small seed with no media, PDF or chats. Redo with a copy of ~/Ore as written by a commit from 11-10, 11-17 and 11-24.
7. **The real Mac window** (Codex computer use on the installed app). Menu bar, ⌘Q with drafts open (F15), the quick quiz's global shortcut, open at login, the updater relaunching it, drag and paste from Finder, Safari, Preview and Notes. Every tester so far drove a browser page.
8. **done (this PR)** What merged since the last pass (#542 to #566), read by Claude in the cloud: three bugs fixed test first (a lock's boot read from a clock that stops in sleep, a wrong `jobs:` in skills.yaml blanking every screen, Ask about this missing from usage.jsonl). Left for their own passes: Ore Cloud's server (queue 15, Claude lane), Vega charts on a hostile page (queue 14), the end screen's sounds by ear. Next time, start from the last commit this row names: f9bfe6d.
9. **Recover from the library's git history.** Restore a source, a note or a whole day from the snapshots, then see what each screen and the index show.
10. **A day-long soak.** The Mac open eight hours with background enrichment, many adds, timers: memory growth, stale screens, the midnight turn.
11. **A11y recheck.** VoiceOver and keyboard only over the whole loop. The last full pass was 11-15; most screens changed since.
12. **New learners.** An exam crammer (deadline, a big new batch, Importance), a language learner (vocabulary, audio, another script), a researcher with fifty papers. Each a five-day run with real AI.
13. **CLI and `/ore` skill recheck.** Sweep 3 found 10; many commands changed since. Every `--json` answer against `packages/cli/src/answers.ts`, exit codes, the library's AGENTS.md.
14. *Claude lane:* **Hostile content** in sources and feeds (scripts, paths, commands, huge files), which Codex refused.
15. *Claude lane:* **Ore Cloud security** (`packages/cloud`: `guard.ts`, `server.ts`, `import.ts`) with `/security-and-hardening`, before it takes outside input (D355).

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
| Web at breadth: fifty live sites | open | queue 5 (`intake:live` exists, never run by a pass) |
| YouTube and other video | done | sweep 5 media, ux 7, ux 13 |
| Podcasts and audio, recordings | done | sweep 5 media, deep scan 2 media (recording in the learner pass) |
| PDF papers | done | deep scan 2 media, newcomer 11-26 (BERT) |
| Long textbooks, scans, the page reader | running | learner days importer (one of each); deep: queue 5 |
| EPUB books | running | learner days importer (one book); deep: queue 5 |
| Word, RTF, PowerPoint, Excel, notebooks, Markdown, screenshots | partly | deep scan 5 office (reading only) |
| Shared AI chats | done | deep scan 2 chat |
| Feeds and newsletters | done | sweep 11, deep scan 5 feeds |
| Courses and playlists | partly | deep scan 5 courses (reading only), ux 8 |
| Other scripts (CJK, RTL, Thai) | done | sweep 4 languages (F285 open) |
| Reimport and anchoring | done | sweep 8, deep scan 1 intake, deep scan 5 original |
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

### Platform
| Angle | Status | Runs |
|---|---|---|
| Release build under its CSP in WebKit | done | release loop 11-11 |
| iPhone build at 390 pt with touch | done | release loop, s1 to s5, ux rounds |
| iPhone in the real Simulator, next to Apple's apps | done | codex phone 11-12, native scout 11-19 |
| The real Mac window (menus, shortcuts, ⌘Q, updater) | open | queue 7 (F15 open since 11-11) |
| Drag and paste from other apps | open | queue 7 |
| Mac and iPhone writing at once | partly | deep scan 1 data, deep scan 4 edges (files only): queue 4 |
| Upgrade from an older library | partly | sweep 9 (small seed): queue 6 |

### Data integrity
| Angle | Status | Runs |
|---|---|---|
| Writes killed, refused or raced | done | sweep 4 durability, deep scan 4 edges (300 trials) |
| Review replay, frontmatter round-trips, the index rebuilt | done | deep scan 1 data, deep scan 3 engine |
| Library changed outside the app | done | sweep 2 outside |
| iCloud conflict copies | done | deep scan 4 edges, deep scan 5 phone |
| Recovery from the library's git history | open | queue 9 |

### AI
| Angle | Status | Runs |
|---|---|---|
| Slow, missing or failing AI | done | sweep 2 ai, deep scan 3 engine |
| Codex against Claude, switches mid-job, stamps (D21) | done | deep scan 5 aivendor |
| An AI per job | partly | merged-since pass 11-27 (reading; F-new-jobs-typo) |
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
| Ore Cloud security | open | queue 15, Claude lane |

### The suite and the backlog
| Angle | Status | Runs |
|---|---|---|
| Tests missing for recent merges | partly | test-gap hunt 11-13 |
| Flaky tests traced to their cause | partly | flaky pass 11-27 (#564): 6 of 11 traced; F349 and F748 need the Mac |
| Open rows that need no call from Tyler | open | queue 2 |
| The `ore` CLI and `/ore` skill as an agent uses them | partly | sweep 3 cli, deep scan 3 library: queue 13 |
