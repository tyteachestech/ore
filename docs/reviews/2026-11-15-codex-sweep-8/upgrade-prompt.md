Your name is `upgrade`.

Your ports: Mac app page http://localhost:{{mac}}/ with `window.__ORE_BRIDGE = {{bridge}}` (library `{{library}}`); iPhone app http://localhost:{{phone}}/ (its seed is a copy at `{{phoneLibrary}}`; the page's writes stay in IndexedDB). WebKit server: `{{webkit}}`. The `ore` CLI: `ORE_LIBRARY={{library}} bun packages/cli/src/ore.ts`. Write everything to `{{out}}/` and the report to `{{out}}/report.md`.

Read `docs/reviews/sweeps.md` first: it lists every earlier tester's angle. Yours is new ground.

## Your focus: a library written by an older Ore
Your library was NOT seeded by today's code: it is a copy of a library made by Ore as of 2026-11-06 (commit aa6bc6f, its own `seed.ts`), nine days and many format changes ago. Tyler's real library is weeks of formats deep, so whatever today's app does to an old library, it does to his. Read `git log --since=2026-11-06 --oneline -- packages/core/src` and the decisions it names for every change to the files on disk (frontmatter fields, `cards/`, `reviews/`, `sessions/`, `skills.yaml`, the old `topics/` folder, highlight files, notes); `git show aa6bc6f:packages/core/src/...` shows the old code. Snapshot the library's files before you start (copy to `{{out}}/before/`).
1. **Opening it.** Open every screen on the Mac: Home, All sources, every skill, a source of each kind, Review, Settings, the Feed, ⌘K. Does anything fail to load, show blank, show wrong counts, or lose data that is on disk (skills, priorities, highlights, notes, questions, exercises and their review history, due dates)? Compare against the files.
2. **Using it.** Do a normal day on it: read, highlight, write a note, review a dozen exercises (rate, undo), file a source, rename a skill. Then diff the library against `before/`: what did today's app rewrite, and is every rewrite a faithful upgrade (nothing dropped, no field silently reset, review history and FSRS state kept, the old `topics/` handled or left alone sensibly)? Does `ore` (`--json`) read it all without errors (`ls`, `show`, `due`, `card show`, `search`, `doctor` or `check` if they exist)?
3. **Mixed ages.** A source made by the old app beside one made today: same behaviour on every screen?
4. **iPhone.** Open the phone copy (also the old library): same checks on Today, Sources, a source and Review.
Report lost or reset data first (S1), then screens that fail on old files (S1/S2), then silent rewrites.
