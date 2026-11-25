# Your run: perf (a big library, below the screens)

Your name is `perf`. Your folder is `{{out}}/`. Your library is `{{library}}` (the big seed, ~950 sources). Budget: about 60 minutes. Never run `bun run bench` (CI's job) and keep any loop under two minutes of CPU.

1. **Core and the CLI at scale**: time each `ore` command the app runs at start and on each screen (`bun packages/cli/src/ore.ts <cmd> --json` on `{{library}}`; read `apps/desktop/src/ore.ts` for the list), and find the ones whose time grows faster than the library (double the library by copying sources in a scratch copy and time again). For each slow one, find the step: reads of every doc.md, a reread of every card, an index query without an index, a sort in a loop, git status over the whole library.
2. **What one action costs**: rating one exercise, filing one source, archiving one, renaming a skill, a note save: count the files read and written and the commands run (wrap `fs` in your script) and name anything that touches every source (sweep 4 left one open: filing or archiving one source rereads both source lists).
3. **The Mac page at scale** (`http://localhost:{{mac}}/`, setup in the preamble; one page): time to Home, to open a source, to start Review, to type in search, to scroll the source list; count `ore` calls per action; long tasks over 100 ms (`PerformanceObserver` longtask) and what code they are in.
4. **The phone at scale** (`http://localhost:{{phone}}/`): the open rows from sweep 4 (opening a skill ~500 ms, starting Review ~330 ms at 1,191 sources): profile them and name the step.
A finding is a red script that shows a cost that grows with the library where it shouldn't, or an action that does work for every source; give the times at two sizes.
