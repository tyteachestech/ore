# Simulated learner, 2026-11-25

Tyler asked whether his spare Codex usage could do more for the app as it is than another code-bug hunt, and said yes to this: Codex uses Ore as a learner would, for days in a row, and says where it felt slow, confusing, broken or off. No new features come out of it (the purpose rule): only fixes to what is there.

It differs from the walk-throughs before it (`../sweeps.md`: persona, daily, the 11-15 rehearsal) in three ways. It plays **five days**, so what one day sets up the next must honour. **AI is real** on the Mac (`ORE_MOCK_REAL_AI=1 ORE_MOCK_ENRICH=1`, on Codex through `ORE_AI=codex`, so it spends Codex usage, not Claude's). And its main output is a **friction log with measured waits**, not a list of bugs.

| Tester | Who | Library |
|---|---|---|
| `owner` | Tyler's five days on the Mac | a copy of `~/Ore` |
| `commuter` | Tyler's five days on the iPhone | a copy of `~/Ore` |
| `newcomer` | A first week from nothing, real imports | empty |
| `stopwatch` | Every wait in his day, timed | a copy of `~/Ore` |

Run from a worktree on the Mac, two testers at a time (the runner sees to it):

```bash
mkdir -p /tmp/ore-learner && ditto ~/Ore /tmp/ore-learner/library   # never the original; waits on iCloud downloads
ORE_MOCK_REAL_AI=1 ORE_MOCK_ENRICH=1 ORE_AI=codex bun run sweep docs/reviews/2026-11-25-simulated-learner
```

Reports land beside this file as `<name>-report.md` and `<name>-log.md`; verified findings go to `../findings.md`.

## What came back

All four ran in about an hour (2026-11-25), with no crash and no lost data. Ten rows in `../findings.md`: six fixed in #542, test first; two open (note typing on the iPhone lags after a highlight in his longest book, in WebKit only; the first scroll through that book catches while it mounts); one for Tyler (the phone's finish quiz has no answer to show before the Mac has found the key points); one in the tooling.

What the run could not do: **days never moved for `ore`.** `page.clock` moves the page; the bridge's `ore` kept 2026-11-25, so due dates, the day's count and the new-exercise limit stayed on day 1. The second day's queue, a missed day and the one-in-five mix of new exercises are unchecked. The next run of this kind needs a bridge that takes a date.

What it measured on his real library (67 sources), medians: Home usable in 256 ms on the Mac; a rating to the next exercise 127 ms on the Mac and 69 ms on the iPhone; his longest book readable in 204 ms; search 322 ms; a URL readable in 1.8 s; an Explain grade 9.7 s and exercises drafted 32 s after Finish (both the AI, on Codex here), each with its wait shown or in the background.
