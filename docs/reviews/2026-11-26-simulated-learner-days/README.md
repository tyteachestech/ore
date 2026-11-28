# Simulated learner run, days that pass (2026-11-26 to 27)

Three Codex learners on Tyler's Mac, started two minutes apart (#557), with real AI on Codex (`ORE_MOCK_REAL_AI=1 ORE_MOCK_ENRICH=1 ORE_AI=codex`) and, for the first time, days that move for `ore` too (`ORE_BRIDGE_PAGE_CLOCK=1`, F739 fixed in #559): a tester moves the page with `page.clock.setSystemTime` and every `ore` call runs at that time.

- `returner`: seven calendar days on a copy of `~/Ore` (395 MB), two of them missed. Report and log here.
- `importer`: an empty library and ten kinds of source (EPUB, MP3, podcast page and feed, PDF slides, PowerPoint, a JPEG 2000 scan, a notebook, an Altair page, OpenStax, Wikipedia), four days, one on the phone.
- `asker`: Ask your library, the tutor and Review's Ask about this on a copy of `~/Ore`. Stopped after day 4 when the running session ended, so it has a log and no report.

The Mac started at 44% free memory; the runner's load check held each start until two minutes had passed and three testers' Codex processes allowed it. Returner ran 24 min, importer 34.

## What came of it

Seven findings, all fixed, Codex drafting each fix test first and Claude checking it:
- #562: OpenStax formulas doubled by MathML's `annotation-xml` (F794); a scanned PDF's Original tab drew white pages, its JPEG 2000 images undecoded (F795); a resumed answer lost the time already spent on it (F796); a podcast host's episode page came in as its blurb (F797, Tyler: keep the recording and its transcript, D215 amended).
- The next PR: Review's Ask about this came back empty for an exercise he returned to; Ask your library never cited archived sources, even named ones (both Tyler: fix them).

What held: the seven-day calendar (due dates, the day's mix, missed days costing nothing, end screens and Home agreeing with the files), F744's charts, EPUB, MP3, slides, notebooks, Wikipedia, every citation the asker opened.

Along the way, the merge script (`bun run ship`) numbered a PR's rows before its checks, so a master that moved meanwhile left two rows one number (three times on #562); it now numbers once the checks pass with master unchanged, and waits for GitHub to say the PR merges.
