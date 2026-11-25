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
