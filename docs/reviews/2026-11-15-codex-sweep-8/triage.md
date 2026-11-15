# Codex sweep 8: triage

Two testers: `reimport` (reimport-report.md, three findings) and `upgrade` (upgrade-report.md, none). Each finding was checked against the code and reproduced by a test that failed before its fix.

| Finding | Verdict | Cause | Fix | Guard |
|---|---|---|---|---|
| R1: after two reimports, the second ⌘Z brings back the newer version, and the first reimport's removed highlight and note stay deleted | Real, S1. F-new-reimport-undo-stack | There was one stash per source (`.ore/reimport/<id>/`), and every reimport deleted and rewrote it. `undoReimport` swapped only that one pair, and the reader put the same unnamed `reimport --undo` on every history step. So the second Undo swapped the first one's result back | Each reimport keeps its own stash, `.ore/reimport/<id>/<step>/` (a ULID), and returns that `step`. `undoReimport(lib, ref, step)` and `ore reimport <item> --undo --step <step>` swap exactly that stash, and running it again redoes it. Without `--step` it acts on the latest stash, as before. The reader's reimport toast and the PDF tables toast pass their own step. A source keeps its last 10 stashes | core `two reimports undo one at a time: …`; e2e `reimport twice, then ⌘Z twice: …` |
| R2: a Key point lands on a reworded copy of its sentence left at the old offset, while the intact copy that still has the saved context sits elsewhere | Real, S2. F-new-anchor-duplicate-context | `anchor()` accepted the quote at its old offset before it looked at the context or at other occurrences | The position fast path now needs the quote and its saved prefix and suffix to match exactly. Otherwise every exact occurrence is scored by context (`contextScore`), and the old offset only breaks a tie through its position term. When nothing tells the copies apart, the old offset still wins (`method: position`). The existing anchoring, reimport and golden tests stay green | core `exact: a quote that occurs twice follows the copy whose context still matches, …` |
| R3: a question whose passage is gone after a reimport keeps `anchor: null` without telling him: the toast is silent, and "Show where it was asked" does nothing | Real, S2. F-new-reimport-unplaced-question | `rewrite` left questions out of `removed` and returned nothing else about them. In the reader, `jumpToHighlight` returned quietly when it found no range | `Reimported.unplaced` lists the questions whose passage is gone. The CLI returns them, and the toast says "A question's passage is no longer in it; the question is kept". When a highlight has no anchor, "Show where it was asked" (and any Collected jump to one) now shows "The passage it was marked on is no longer in this source." | core `a question whose passage is gone after a reimport is kept and reported, …`; the e2e journey above |

## Upgrade tester

The tester found nothing on a library written by `aa6bc6f` (Nov 6). It also reported that its first direct `ore today` started background enrichment, which added topics and exercises and replaced three prequestions. That was checked against the code and is by design, not a finding:

- `today` (packages/cli/src/cmd-study.ts) calls `startCatchUp(lib)`, with the comment "Home opening is the day's usual first command (D8)".
- `startCatchUp` (packages/cli/src/background.ts) runs the day's catch-up only when it is due, and never when `ORE_NO_ENRICH` is set.
- The browser bridge sets `ORE_NO_ENRICH=1` (scripts/mock/bridge.ts), and the tester's first direct CLI call didn't. D8 says enrichment runs in the background and catches up once a day.

The only effect was on the test: the later Mac run wasn't on fully untouched old data. The tester already says so in its report.

## Known rows

F5 (the wrong reason given when the kept original is gone) was seen again and is already open. It was not part of this pass.
