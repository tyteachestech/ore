# Codex sweep 8: triage

Two testers: `reimport` (reimport-report.md, three findings) and `upgrade` (upgrade-report.md, none). Each finding was checked against the code and reproduced by a test that failed before its fix.

| Finding | Verdict | Cause | Fix | Guard |
|---|---|---|---|---|
| R1: after two reimports, the second ⌘Z brings back the newer version, and the first reimport's removed highlight and note stay deleted | Real, S1. F362 | There was one stash per source (`.ore/reimport/<id>/`), and every reimport deleted and rewrote it. `undoReimport` swapped only that one pair, and the reader put the same unnamed `reimport --undo` on every history step. So the second Undo swapped the first one's result back | Each reimport keeps its own stash, `.ore/reimport/<id>/<step>/` (a ULID), and returns that `step`. `undoReimport(lib, ref, step)` and `ore reimport <item> --undo --step <step>` swap exactly that stash, and running it again redoes it. Without `--step` it acts on the latest stash, as before. The reader's reimport toast and the PDF tables toast pass their own step. A source keeps its last 10 stashes | core `two reimports undo one at a time: …`; e2e `reimport twice, then ⌘Z twice: …` |
| R2: a Key point lands on a reworded copy of its sentence left at the old offset, while the intact copy that still has the saved context sits elsewhere | Real, S2. F363 | `anchor()` accepted the quote at its old offset before it looked at the context or at other occurrences | The position fast path now needs the quote and its saved prefix and suffix to match exactly. Otherwise every exact occurrence is scored by context (`contextScore`), and the old offset only breaks a tie through its position term. When nothing tells the copies apart, the old offset still wins (`method: position`). The existing anchoring, reimport and golden tests stay green | core `exact: a quote that occurs twice follows the copy whose context still matches, …` |
| R3: a question whose passage is gone after a reimport keeps `anchor: null` without telling him: the toast is silent, and "Show where it was asked" does nothing | Real, S2. F364 | `rewrite` left questions out of `removed` and returned nothing else about them. In the reader, `jumpToHighlight` returned quietly when it found no range | `Reimported.unplaced` lists the questions whose passage is gone. The CLI returns them, and the toast says "A question's passage is no longer in it; the question is kept". When a highlight has no anchor, "Show where it was asked" (and any Collected jump to one) now shows "The passage it was marked on is no longer in this source." | core `a question whose passage is gone after a reimport is kept and reported, …`; the e2e journey above |

## Upgrade tester

The tester found nothing on a library written by `aa6bc6f` (Nov 6). It also reported that its first direct `ore today` started background enrichment, which added topics and exercises and replaced three prequestions. That was checked against the code and is by design, not a finding:

- `today` (packages/cli/src/cmd-study.ts) calls `startCatchUp(lib)`, with the comment "Home opening is the day's usual first command (D8)".
- `startCatchUp` (packages/cli/src/background.ts) runs the day's catch-up only when it is due, and never when `ORE_NO_ENRICH` is set.
- The browser bridge sets `ORE_NO_ENRICH=1` (scripts/mock/bridge.ts), and the tester's first direct CLI call didn't. D8 says enrichment runs in the background and catches up once a day.

The only effect was on the test: the later Mac run wasn't on fully untouched old data. The tester already says so in its report.

## Known rows

F5 (the wrong reason given when the kept original is gone) was seen again and is already open. It was not part of this pass.

## Review of #443: reimport and anchoring

| Item | Verdict | Cause | Fix | Guard |
|---|---|---|---|---|
| 1, 9: a background tables read's Undo was step-less | Real. F368 | `TablesLine` called `onRead({ changed: true, regions: 0 })` after a background read, with no step, so the toast ran `reimport --undo` alone, which took the newest stash | `readTables` records its step (`tables-<id>.step` in the logs, cleared when a read starts); `tables --status` returns it as `tables_step`, and the background path passes it. One Reader helper, `reimported(id, what, step)`, gives the reimport and tables toasts Undo and Redo of their own step, and none without one | core `PDF: tables and display formulas read by Docling…` (`Its step, for a read run in the background`); e2e `PDF tables: read in the background…` |
| 2: a second step-less undo redid | Real. F369 | The step-less undo took `steps().at(-1)`, the stash just undone | An undone stash holds an `undone` mark (dropped when its step is run again, a redo). A step-less undo takes the newest stash not undone; there is no step-less redo, `--step` redoes. `reimport` and `tables` usage lines and SPEC say so | core `a step-less undo takes back the newest reimport not yet undone…` |
| 3: context never refreshed at the old offset | Real. F372 | `reanchorItem` revised only a non-`position` anchor, and a quote at its old offset with changed context comes back as `position` | `reanchorItem` saves the new selector whenever the method isn't `position` or the prefix or suffix differ; `moved` still counts only real moves | core `a highlight still at its offset whose context changed takes the new context…` |
| 6: an old flat stash was ignored forever | Real. F370 | `steps()` listed only ULID folders | `steps()` moves a flat stash's files into a step folder named by a ULID of its doc.md's time and dated so, on first touch (any undo, or any reimport's prune) | core `a stash in the old flat layout is one step…` |
| 7: up to 10 full stashes per source, fills included | Real. F371 | The cap was per source and pruned only by that source's next reimport; `fillOwed` stashed though no Undo reaches it | The app's Undo lives while the window is open (history.ts, 50 steps, a relaunch starts empty); the old code kept one per source until its next reimport. Chosen: a stash lives a day, any reimport removes older ones of every source (and empty source folders), and `fillOwed` keeps none (`stash: false`). The per-source cap is gone | core `a stash lives a day…`; owed `No Undo reaches a fill, so it keeps no stash` |
| 8: `tables` repeated the mapping and dropped `unplaced` | Real. F375 | Its own inline map, written before `unplaced` | One `brief` helper for both commands; `tables` returns `unplaced`; the tables toast uses the reimport toast's `lostText` | core `ore tables reports the questions whose passage the read took away…` |
| 10: no red run for F364 in the PR | Real (PR body) | — | Run against master's `ingest/index.ts`: `TypeError: undefined is not an object (evaluating 'r.unplaced.map')`; added to the PR body | — |
