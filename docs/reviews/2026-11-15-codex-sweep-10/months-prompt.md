Your name is `months`.

Your ports: Mac app page http://localhost:{{mac}}/ with `window.__ORE_BRIDGE = {{bridge}}` (library `{{library}}`); iPhone app http://localhost:{{phone}}/ (its seed is a copy at `{{phoneLibrary}}`; the page's writes stay in IndexedDB). WebKit server: `{{webkit}}`. The `ore` CLI: `ORE_LIBRARY={{library}} ORE_NO_ENRICH=1 bun packages/cli/src/ore.ts` (keep `ORE_NO_ENRICH=1`: without it a read like `today` starts AI enrichment). Write everything to `{{out}}/` and the report to `{{out}}/report.md`.

Read `docs/reviews/sweeps.md` first: it lists every earlier tester's angle. Yours is new ground.
Your library is seeded with `seed-big.ts` (about 240 sources and their exercises).

## Your focus: months of daily use, run in minutes
Ore is a daily habit of 10 minutes to an hour over a due backlog that never empties (`docs/design/daily-session.md`). Earlier testers jumped days or checked one moment; nobody has lived 60–90 days in it. Read `docs/design/daily-session.md`, `packages/core/src/queue.ts` and `scheduler.ts`, D21–D24 and every decision on the queue, new exercises a day, levels and the end screen (grep DECISIONS.md for queue, new a day, backlog, level, goal, lap).
1. **A day, then the next.** With `page.clock` (install it before the page loads; move it with `setSystemTime`/`runFor`), do a session each day for 60–90 days: rate as a real learner would (mostly Good, some Again, a few Easy; skip some days, a week away once, a 3-hour session once). Script it, bounded, one page at a time; reload the page each new day.
2. **Check each day, from the library's files and `ore ... --json`**: is the queue in the decided order (D22, D24), are new exercises a day within the limit, does the due count on Home match `ore due`, do due dates follow FSRS (one ts-fsrs, priority never changes the math), does a week away come back as a sensible backlog rather than a wall, do the goal ring, laps and end screen count that day's minutes only (midnight, DST: the clock crossing 2026-03-08 and 2026-11-01 in America/New_York), do skill levels move sensibly?
3. **Drift.** Anything that grows without bound over the months (review logs read in full each day, sessions, slow screens, a list that never empties though it should), and numbers on screen that disagree with each other or the files.
4. **iPhone.** A shorter run (14 days) on the phone copy, then compare its schedule with what the Mac would have done for the same ratings.
Report wrong schedules, wrong counts and lost reviews first.
