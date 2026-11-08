# Stress test, 2026-11-08

Six testers drove the app through the mock harness (Chromium + the real `ore` CLI on scratch libraries), each in one area: damaged files, reading and highlighting, review, scale, keyboard and menus, and first run with no AI. Together they wrote 84 findings, every one reproduced twice. The findings themselves are not kept in the repo; the PRs below list what each one fixed.

Fixed, one PR per area, each fix with a test that failed first: #134 damaged library, #138 reader, #146 review, #149 first run, then scale and controls.

## Calls for Tyler
1. **A source that can't be read (files-10).** Doctor now names the folder and says what to do, but the app itself says nothing: the source just leaves the lists, and its cards keep coming up in Review. Should Home show one quiet line, "1 source couldn't be read", that opens what doctor found? Recommended: yes, since it's the only way he would learn about it.
2. **Due cards before new drafts (review-08).** D65 and `ore due --help` both say due cards come first and drafts fill the room that's left. The queue puts each draft at the top of its topic lane instead (R = 0), so a session that stops at the goal can drop due cards. Recommended: due first, as D65 says.
3. **A card missed today counts as due (review-07).** It holds back "caught up" until he answers it again. Its relearn pass now survives a session ending (#146). Keep it as it is? Recommended: keep it.
4. **Where focus goes back (controls-07).**
   - The sidebar's ⋯ and + are `display:none` until hovered, so focus can't go back to them after their menu closes. Recommended: focus goes back to their row.
   - ⇧⌘S with focus in the sidebar: recommended, focus moves to the list where the view has one.
5. **⌘K and ⌘/ inside Review (controls-08).** Both are blocked during Review today. They now work in Settings. Should they work in Review too?
6. **Archive and Highlight share 1 in the reader (controls-09).** This is the same question as the rating keys, which is already waiting.
7. **Wording the scale fixes chose**, change any you like:
   - When the toolbar is narrow, Collected drops from a chip per type, to one "Collected N" chip, to none.
   - A source added with `--no-enrich` reads "No prequestions yet · Write them".
   - Deleting a skill says "Its N sources (and M archived)".

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
