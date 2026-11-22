Your name is `mac`.

Your ports: Mac app page http://localhost:{{mac}}/ with `window.__ORE_BRIDGE = {{bridge}}` (library `{{library}}`). WebKit server: `{{webkit}}`. The `ore` CLI: `ORE_NO_ENRICH=1 ORE_LIBRARY={{library}} bun packages/cli/src/ore.ts` (always keep ORE_NO_ENRICH=1, or real AI starts). Write everything to `{{out}}/` and the report to `{{out}}/report.md`. Your library is seeded with `seed.ts`. Mac only: do not open the iPhone app.

Earlier sweeps covered many angles (see `docs/reviews/sweeps.md`). Two UX sweeps ran today (F459–F467 in PR #492, F469–F473 in PR #493; records `docs/reviews/2026-11-22-codex-ux-sweep/` and `-2/`). Their reports list what passed: don't redo those paths. Both found the same class most: a change put on the Undo history only after its write lands (⌘Z during the write undid the step before), and a second press during a write. Check that class on every save you meet with `window.__ORE_SLOW`.

## Your focus: obvious UX mishaps a Mac user hits in minutes, round 3
Tyler's words: "basic things that I figured would have been handled already". Hunt the obvious: a control that does nothing, focus lost after an action, Esc or Enter misbehaving, a missing or wrong Undo, a list not showing a change made elsewhere, a wait with no sign, an error with no next step, a label that misleads, an empty state that leaves you stuck.

Walk real tasks end to end, each from a fresh page, then repeat once:
1. **Reading deeply**: highlights of each colour, Key points, a highlight's note, Collected, the outline, Find, the Original view of a PDF, a video or podcast source with its transcript, Finish with recall; then edit and delete each with Undo.
2. **The Feed**: follow a feed (a local RSS server you start with `Bun.serve` inside your script is fine), read a post, keep one as a source, mark read, unfollow with Undo.
3. **Review's edges**: Explain answers with the grader off, Later, retire an exercise, edit an exercise in Review, Leave review mid-way, the end screen's buttons.
4. **Settings and Ask your library**: every Settings control changed and changed back; Ask a question of the library, open a citation.
For each candidate, read the code to confirm it is the app and not the mock, and give the file and line.
