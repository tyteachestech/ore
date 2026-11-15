# Triage (2026-11-15)

Run on c63019d. The Mac tester did a whole day in 26 min: 16 ratings over 11 min 16 s of review, past the goal to the end screen, reading with four highlights and notes, the reader quiz, two adds with real enrichment, Finish → Done with a drafting failure and its retry, then the next day. The phone tester did the same in a commute pass, with an interruption and a reload mid-review. No crash or data loss; every saved FSRS step matched a recomputation; every note and annotation file he had kept its checksum. Full reports, screenshots and scripts: `codex-out/{mac,phone}/` in the Mac worktree `~/Developer/ore-wt/rehearsal`.

| Report | Verdict | Row |
| --- | --- | --- |
| mac 1: Review omits the supporting highlights | Real: `loadPassage` read only `annotation`, never `also` | F194, fixed |
| mac 2: tomorrow brings a duplicate of today's exercise | Real, from his library: AIMA ch. 1 imported twice | F198, his call |
| mac 3: drafting retry shows no running or done state | Real: Try again cleared the toast and said nothing more | F196, fixed |
| mac 4: a missed new exercise returns as New and Again | Real: the relearn entry kept `state: draft` | F195, fixed |
| mac: finished source's exercises wait behind older drafts | Works as D176/D65 rank it; a rule question | F199, his call |
| phone 1: unreadable tables with no next step | Real for the line: the phone showed nothing; the flattened table itself is the known pdf.js limit until the Mac reads it (D125) | F197, fixed |
| mac + phone: ratings below the fold on long answers | Known F14, now seen 7 of 13 times on the phone | F14, still open |
