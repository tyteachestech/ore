# Simulated learner, three at once, 2026-11-26

Tyler asked for another simulated learner run (`../2026-11-25-simulated-learner/`) with three Codex testers at once, to see what that does to his Mac's memory. The Mac-load rule allows two (`docs/WORKFLOW.md`, after five froze the Mac on 2026-11-15), so this run raised `MAX_TESTERS` to 3 in its own worktree only, and a watcher sampled memory every 10 s, ready to stop every tester on critical pressure or 10% free for 30 s. It never had to.

Testers: `owner` (Mac) and `commuter` (iPhone) on a copy of `~/Ore` (395 MB), `newcomer` from an empty library, with the 11-25 prompts and a preamble that sends them past that run's ground. Real AI on Codex (`ORE_MOCK_REAL_AI=1 ORE_MOCK_ENRICH=1 ORE_AI=codex`). Codex ran sandboxed.

## Memory (24 GB Mac, `memory.csv`)

| | Before | Peak load | After |
|---|---|---|---|
| Free memory (`memory_pressure`) | 56% | **25%** (11:20, six minutes in) | 72% |
| Kernel pressure level | normal | **warning** for 6 min (11:17 to 11:23), never critical | normal |
| Swap used | 3.9 GB | **8.2 GB** | 7.1 GB |
| Compressed memory | 6.4 GB | 11.0 GB | 3.1 GB |
| Codex and its scripts (RSS) | — | 4.5 GB | — |
| Playwright's WebKit (RSS) | — | 2.2 GB | — |

All three started within a second of each other (11:14:58): the load check before each start passed every time, because the first two had not yet taken their memory. The squeeze came in the next six minutes, while all three loaded the app, the library and their first pages, and eased on its own while all three still ran (normal pressure from 11:23 to the end, 57 to 60% free). Swap grew by 4.3 GB and never came back below 7 GB in the run. The commuter ended at 11:34, the others at 11:45: 31 minutes in all, against about an hour for four testers two at a time on 11-25.

What it means: three fit on this Mac with nothing heavy beside them, but the peak sat exactly on the check's 25% line, and the check can't see a start that hasn't loaded yet. A fourth, or three beside a heavy app, would have gone below it.

## What came back

Seven rows in `../findings.md`, from 2026-11-26: four fixed test first (the next exercise opening mid-question after a long answer; Review's key points and feedback showing raw backticks; recall feedback always failing after the quiz; a Pandoc or Quarto page's formulas as raw TeX), two import gaps open (charts a page draws in the browser; a paragraph out of order in BERT's PDF), one in the tooling (the load check counts the app's own Codex AI calls as testers). F730, F731, F732 and F738 held. Days still did not move for `ore` (F739).
