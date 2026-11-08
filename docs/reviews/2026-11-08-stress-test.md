# Stress test, 2026-11-08

Six testers drove the app through the mock harness (Chromium + the real `ore` CLI on scratch libraries), each in one area: damaged files, reading and highlighting, review, scale, keyboard and menus, and first run with no AI. Together they wrote 84 findings, every one reproduced twice. The findings themselves are not kept in the repo; the PRs below list what each one fixed.

Fixed, one PR per area, each fix with a test that failed first: #134 damaged library, #138 reader, #146 review, #149 first run, then scale and controls.

## Calls for Tyler (answered 2026-11-08)
1. **A source that can't be read (files-10).** Yes: Home shows one quiet line, "1 source couldn't be read". Its hint says why (what doctor says) and a click shows the doc.md in Finder.
2. **Due cards before new drafts (review-08).** Replaced by D144: over a backlog, one card in five is new, mixed in, up to `new_per_day`.
3. **A card missed today counts as due (review-07).** Kept: it is successive relearning.
4. **Where focus goes back (controls-07).** Back to the row, and ⇧⌘S goes to the list. The keyboard pass builds it.
5. **⌘K and ⌘/ inside Review (controls-08).** Yes. They open over Review and Esc goes back to the card. An action from the palette leaves Review as Esc does (a typed answer is kept), then runs.
6. **Archive and Highlight share 1 in the reader (controls-09).** Nothing to change.
7. **Wording the scale fixes chose.** Kept as built.

## Not fixed here
- **reader-12:** a drag that starts inside link text selects nothing. This may be Chromium only. Check it in the macOS webview.
- **For the import loop:**
  - files-06: a binary file named .md or .txt is saved as a source of junk. It should be refused (D96).
  - files-18: reimport after the kept original was deleted says "only a source added from a link or a file", which is the wrong reason.
- **Follow-up:** move the reader's shown-text skeleton (`apps/desktop/src/text.ts`) into core, so that core anchoring and the reader share one map.

## Lessons for the next sweep
- Adding sources in the mock spends real AI on enrichment unless `ORE_NO_ENRICH` is set. The bridge now sets it unless `ORE_MOCK_ENRICH` is set.
- Fix workers go in worktrees. Uncommitted edits in the shared checkout break `ore` for the testers running against it.
- The vite on :1420 serves only the main checkout, so a worktree runs its own vite.
- Local e2e is flaky when many agents share the machine. CI decides.

## Round 2 (evening): today's features

Six personas over a 113-card backlog with drafts, tries and one source broken on disk, in the same mock harness: the backlog grinder (40 cards; New drafts approved, edited and deleted; undo of a rating; ⌘K and ⌘/ over Review), the try loop (the end screen's try line opens the passage; To try, How did it go + Next time I'll…, Used record; undo and redo), the tutor with a passage and a web citation, keyboard only, the broken source, and undo everywhere (a rating from Home after Review, archive, pin). Held up: the 1-in-5 new-card share, drafts flagged New, undo and redo of every step tried, ⌘K and ⌘/ over Review with Esc back to the card, the try loop's rounds, citation pills and their hover card, Home's "couldn't be read" line with its reason, and a card whose source can't be read (it says so under the answer and still rates).

Fixed in #192: ⌘K → All sources from Home left focus on the body (arrows and Enter did nothing until ~30 Tabs); a highlight over a passage already highlighted, with a note, dropped the intent and the note silently (`ore highlight --intent apply --note`, the `/ore` skill's path).

### Calls for Tyler
1. **Rescued over a backlog.** With everything overdue, "N rescued just before you'd have forgotten them" is nearly every card, every session (13 of 14). Keep it, or show it only when it is a minority of the session?
2. **A write-up's confirmation.** Saving "How did it go" closes the box with no toast; "a card comes from how it went" is said only in the undo toast. Fine as a quiet step, or one toast?
3. **The picker by keyboard.** Enter on Start review puts focus on the "What to review" panel itself: Space does nothing until ↓ picks a row. Focus the first row instead?

### Lessons
- Review ignores a rating digit for 300 ms after the answer shows (the same keys pick how sure): a script must wait, a person never notices.
- The mock bridge answers a cited item that doesn't exist (`"item": "x"` in a mock reply) with a 500 the app survives; cite a seeded item to test the jump.
