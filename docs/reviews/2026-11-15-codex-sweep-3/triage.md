# Codex sweep 3: triage

Five Codex testers (hostile content, numbers, CLI, lifecycle, accessibility) reported 31 findings. Each was reproduced before it was fixed; every row is in `docs/reviews/findings.md` with its guard.

| Report | Finding | Verdict |
|---|---|---|
| CLI-01 | A rejected multi-field edit still changed the source | fixed, round 1 |
| CLI-02 | Adding for a missing question left a source behind | fixed, round 1 |
| CLI-03 | Import accepted a skill that doesn't exist | fixed, round 1 |
| CLI-04 | An inbox import where every item failed exited 0 | fixed, round 1 |
| CLI-05 | A failed editor reported success | fixed, round 1 |
| CLI-06 | An AI rating could be logged without its stamp | fixed, round 1 |
| CLI-07 | Both agent guides told agents to write library files by hand | fixed, round 1 |
| CLI-08 | Doctor called malformed session and variant lines healthy | fixed, round 1 |
| CLI-09 | Doctor's "retire the card" advice left the same error | fixed, round 1 |
| CLI-10 | Feed recovery named a flag that doesn't exist; SPEC lagged the CLI | fixed, round 1 |
| N1 | Retiring an exercise took away an earned level | fixed, round 2 |
| N2 | "One Good from cut" undercounted an overdue backlog | fixed, round 2 |
| N3 | The skill page's strength stayed stale after a retire in Review | fixed, round 3 |
| L1 | Undo of a filing gave every exercise the source's skills | fixed, round 2 |
| L2 | A new skill named like a deleted one took its old note | fixed, round 2 |
| L3 | An archived source's questions stayed on the open skill page | fixed, round 3 |
| H1 | Find in a 10,000-line note froze the page per key | fixed, round 3 |
| H2 | A 20 MB source froze the page for 4 s while it came in | fixed, round 3 (batches); reading in and indexing remain one pass each |
| H3 | Mail, heading and relative links in notes did nothing | fixed, round 3 |
| H4 | The iPhone told him to press ⌘O for a relative link | fixed, round 3 (a one-line phone string, no test) |
| H5 | A local-file link was named as an empty file | fixed, round 3 |
| A1 | iPhone note focus off-screen; Review's Done left focus on the page | fixed, round 4 |
| A2 | Settings let Tab and ⌥Tab fall off onto the page | fixed, round 4 |
| A3 | The iPhone's refused link wasn't read out | fixed, round 4 |
| A4 | Explain's answer and the phone's marking fallback weren't read out | fixed, round 4 |
| A5 | Quiet saves (highlight, Key point, note) weren't read out | fixed, round 4 |
| A6 | The skill picker had no name and no ticked state | fixed, round 4 |
| A7 | Settings clips at 200% zoom | Tyler: layout, for the design pass |
| A8 | Dividers resize only by dragging | Tyler: a key way, or mouse only as Finder and Notion |
| A9 | Two iPhone taps under 44 pt | fixed, round 4 |
| A10 | Explain's marks read as unnamed pictures | fixed, round 4 (every icon now hidden from VoiceOver unless named) |
