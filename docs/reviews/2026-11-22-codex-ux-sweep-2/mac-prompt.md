Your name is `mac`.

Your ports: Mac app page http://localhost:{{mac}}/ with `window.__ORE_BRIDGE = {{bridge}}` (library `{{library}}`). WebKit server: `{{webkit}}`. The `ore` CLI: `ORE_NO_ENRICH=1 ORE_LIBRARY={{library}} bun packages/cli/src/ore.ts` (always keep ORE_NO_ENRICH=1, or real AI starts). Write everything to `{{out}}/` and the report to `{{out}}/report.md`. Your library is seeded with `seed.ts`. Mac only: do not open the iPhone app.

Earlier sweeps covered many angles (see `docs/reviews/sweeps.md`). A first UX sweep ran today (F459–F467, PR #492, record `docs/reviews/2026-11-22-codex-ux-sweep/`) and found: Forge Undo during a save, a Forge use saved twice, the Forge's new-try form with no button, ⌘K New collection by pointer, an iPhone skill page stale after unfiling, iPhone Add a link losing its text, the small phone's end screen opening scrolled. Its reports list what passed: don't redo those paths. Yesterday's basic sweep found F445–F451.

## Your focus: obvious UX mishaps a Mac user hits in minutes, on the ground round 1 left
Tyler's words: "basic things that I figured would have been handled already". A careful Mac user who knows Notes, Mail, Finder, Reader, Linear and Notion, in a real study hour. Hunt the obvious: a control that does nothing, focus lost after an action, Esc or Enter that misbehave, a missing Undo, a list that doesn't show a change made elsewhere, a wait with no sign, an error with no next step, a label that says one thing and does another, something hidden until hover that you need, two controls doing the same thing, an empty state that leaves you stuck. A press while a write is still out (use `window.__ORE_SLOW`) is worth one try on every save, since round 1 found two bugs there.

Walk real tasks end to end, each from a fresh page, then repeat once:
1. **Notes**: a source's note and a skill's note: type, format, links (`[[`), a table, a to-do, paste, ⌘Z, leave and come back, Linked from.
2. **The tutor**: ask about a passage, chips in the field, a long reply, retry after a failure, a chat reopened later, a new chat.
3. **Adding and finding**: the Add box with a link, text and a file; All sources and Home lists: sort, filter, search, multi-select, right-click and ⋯ actions; Find in a source; the outline.
4. **The sidebar and skill pages**: collections (make, rename, reorder, collapse, delete with Undo), a skill's goal, icon, colour and Importance, its tabs (sources, questions, Forge, Dig).
5. **Keyboard**: the shortcuts sheet, then every listed shortcut once from Home and once from a source; anything listed that does nothing.
For each candidate, read the code to confirm it is the app and not the mock, and give the file and line.
