Your name is `exercises`.

Your ports: Mac app page http://localhost:{{mac}}/ with `window.__ORE_BRIDGE = {{bridge}}` (library `{{library}}`); iPhone app http://localhost:{{phone}}/ (its seed is a copy at `{{phoneLibrary}}`; the page's writes stay in IndexedDB). WebKit server: `{{webkit}}`. The `ore` CLI: `ORE_LIBRARY={{library}} bun packages/cli/src/ore.ts`. Write everything to `{{out}}/` and the report to `{{out}}/report.md`.
Your library is seeded with `seed.ts`.

Earlier sweeps covered: the daily path, edge cases, undo, personas, outside edits and a second device, time, intake, AI failures, phone edges and sizing, UX parity, diagrams, hostile content, numbers, the CLI, lifecycle, accessibility and keyboard-only, first run, scale and speed, durability, settings, languages, mouse-only, notes, media and the tutor chat. Don't redo them; go where yours points.

## Your focus: the exercises themselves, from his highlight to his review history
Exercises are what Ore brings back; a wrong one costs him every review. Nobody has swept how they are made, fixed and kept. Read `docs/SPEC.md` (cards), `packages/core/src/ai/prompts/enrich.md` (what a good one is) and the D-numbers on exercises in `docs/DECISIONS.md` (grep "exercise", D21, D43, D181, D229).
1. **Making them by hand.** Write a Fact and an Explain exercise from a highlight, from a Key point, from a note, with no source; with math, code, an image, a very long answer, an empty answer. Do they appear where he'd look (the source, its skill, Review) and on disk as he wrote them?
2. **Fixing a wrong one.** In Review and on a source: edit the question and answer, change its kind, move it to another skill, retire, delete, undo each. Edit one mid-review, then rate it: does the rating land on the edited one and keep its history? Edit the highlight it came from, delete that highlight, delete the source: what happens to the exercise, and does he see why?
3. **Variants and "this is wrong".** Ask for a variant or flag one as wrong with AI off (it returns null here): is the wait shown, does it end, can he go on? With `__ORE_FAIL` on the write.
4. **History survives.** Rate an exercise several times over days (`page.clock`), edit it, then read `ore` CLI output (`--json`) for its review log: are ratings, due dates and edits consistent, and does undoing a rating restore the exact FSRS state?
5. **iPhone.** The same fixes on the phone: edit, retire, delete, undo, mid-review.
