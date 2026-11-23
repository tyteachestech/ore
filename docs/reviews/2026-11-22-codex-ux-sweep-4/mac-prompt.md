Your name is `mac`.

Your ports: Mac app page http://localhost:{{mac}}/ with `window.__ORE_BRIDGE = {{bridge}}` (library `{{library}}`). WebKit server: `{{webkit}}`. The `ore` CLI: `ORE_NO_ENRICH=1 ORE_LIBRARY={{library}} bun packages/cli/src/ore.ts` (always keep ORE_NO_ENRICH=1, or real AI starts). Write everything to `{{out}}/` and the report to `{{out}}/report.md`. Your library is seeded with `seed.ts`. Mac only: do not open the iPhone app.

Earlier sweeps covered many angles (see `docs/reviews/sweeps.md`). Three UX sweeps ran today (records `docs/reviews/2026-11-22-codex-ux-sweep/`, `-2/`, `-3/`; findings F459–F473 and the newest rows in `docs/reviews/findings.md`). Their reports list what passed: don't redo those paths. Round 3 fixed ⌘Z during a save once for the whole app (`whileOut` in `apps/desktop/src/ore.ts`, `Toast.tsx`): check it held, on any save you meet, with `window.__ORE_SLOW`, but don't spend the run on it. New since then: on the iPhone, a collection heading in the drawer has a long-press menu (Rename…, Move up, Move down, Delete collection) and a skill's menu has Move up and Move down. Tyler's standing rule: the iPhone strives for parity with the Mac, so a Mac feature missing on the phone is a finding.

## Your focus: obvious UX mishaps a Mac user hits in minutes, round 4
Tyler's words: "basic things that I figured would have been handled already". Hunt the obvious: a control that does nothing, focus lost after an action, Esc or Enter misbehaving, a missing or wrong Undo, a list not showing a change made elsewhere, a wait with no sign, an error with no next step, a label that misleads, an empty state that leaves you stuck.

Walk real tasks end to end, each from a fresh page, then repeat once, on ground rounds 1 to 3 touched least:
1. **Adding sources**: the Add box with a link, pasted text, a file (Open file…), a YouTube link, a feed link; a bad link; Cancel mid-add; then the new source's first open (title, author, skills).
2. **All sources and Home**: sort, filter, search, multi-select with ⌘ and ⇧, every bulk action with Undo, the No skill list, Continue reading's rows and their menus.
3. **The source's header and ⋯**: rename the title and author, skills picker, Importance, Reimport, Copy as Markdown, Archive, Delete with Undo.
4. **Window and navigation**: Back and Forward, the sidebar folded and peeked, ⌘K from every screen, ⌘, Settings, the shortcuts sheet, a narrow window (800×600).
For each candidate, read the code to confirm it is the app and not the mock, and give the file and line.
